/**
 * Sandbox manual card sale. Training and sandbox locations only.
 * The card number is sent to the processor and is not stored.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";
import { EMPTY_LOCATION_SETUP, type LocationSetup } from "@/lib/saas/types";
import { parseCardProcessor } from "./adapter";
import { parentMerchantForCapture } from "./finix-events";
import { chargeManualCardOnFinix } from "./finix";
import {
  manualCardEntryVisible,
  parseManualCard,
  redactCardText,
  type ManualCard,
} from "./manual-card";
import {
  envPaymentsDefault,
  locationLifecycleStatus,
  parseLocationPaymentsMode,
  resolvePaymentsMode,
} from "./mode";

type Share = {
  entityId: string;
  kind: "host" | "operator";
  displayName: string;
  amountCents: number;
};

export type ManualCardChargeInput = {
  orgId: string;
  locationId: string;
  amountCents: number;
  checkId?: string;
  number: string;
  expirationMonth: number;
  expirationYear: number;
  securityCode: string;
  postalCode: string;
  entities: Share[];
};

export type ManualCardChargeResult =
  | { ok: true; transferId: string; last4: string; merchantId: string }
  | { ok: false; error: string };

function setupOf(raw: unknown): LocationSetup {
  if (!raw || typeof raw !== "object") return { ...EMPTY_LOCATION_SETUP };
  return { ...EMPTY_LOCATION_SETUP, ...(raw as LocationSetup) };
}

function realMerchant(id: string): string {
  const value = id.trim();
  if (!value.startsWith("MU") || value.toLowerCase().includes("sandbox")) return "";
  return value;
}

async function storedMerchant(
  locationId: string,
  entityId: string,
  kind: "host" | "operator",
): Promise<string> {
  const sql = await getSql();
  const rows =
    kind === "host"
      ? await sql<{ finix_merchant_id: string | null }>`
          select finix_merchant_id from payment_accounts
          where location_id = ${locationId} and kind = ${"host"}
          limit 1
        `
      : await sql<{ finix_merchant_id: string | null }>`
          select finix_merchant_id from payment_accounts
          where operator_id = ${entityId} and kind = ${"operator"}
          limit 1
        `;
  return realMerchant(String(rows[0]?.finix_merchant_id ?? ""));
}

export async function chargeManualCard(
  userId: string,
  input: ManualCardChargeInput,
): Promise<ManualCardChargeResult> {
  const parsed = parseManualCard({
    number: input.number,
    expiration: `${String(input.expirationMonth).padStart(2, "0")}/${input.expirationYear}`,
    securityCode: input.securityCode,
    postalCode: input.postalCode,
  });
  const secrets = [String(input.number ?? ""), String(input.securityCode ?? "")];
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const card: ManualCard = parsed.card;
  if (input.amountCents <= 0) return { ok: false, error: "Invalid amount" };

  const sql = await getSql();
  const rows = await sql<{
    id: string;
    org_id: string;
    setup: unknown;
    lifecycle_status: string | null;
    operating_model: string | null;
  }>`
    select id, org_id, setup, lifecycle_status, operating_model
    from locations
    where id = ${input.locationId}
    limit 1
  `;
  const loc = rows[0];
  if (!loc) throw new ForbiddenError("Location not found");
  if (loc.org_id !== input.orgId) throw new ForbiddenError("Location mismatch");
  await requireMembership(userId, loc.org_id, undefined, loc.id);

  const setup = setupOf(loc.setup);
  const lifecycle = locationLifecycleStatus(setup, loc.lifecycle_status);
  const resolved = resolvePaymentsMode({
    platformDefault: envPaymentsDefault(),
    locationOverride: parseLocationPaymentsMode(setup.paymentsMode),
    lifecycleStatus: lifecycle,
  });
  if (
    !manualCardEntryVisible({
      lifecycleStatus: lifecycle,
      paymentsMode: resolved.mode,
      lifecycleForcesSandbox: resolved.lifecycleForcesSandbox,
    })
  ) {
    return { ok: false, error: "Manual entry is off when the location is live." };
  }
  if (parseCardProcessor(setup.cardProcessor) !== "finix") {
    return { ok: false, error: "Manual entry is off for this card processor. The check stays open." };
  }

  if (input.checkId) {
    const prior = await sql<{
      processor_payment_id: string | null;
      last4: string | null;
      merchant_id: string | null;
    }>`
      select processor_payment_id, last4, merchant_id
      from summex_payments
      where location_id = ${loc.id}
        and check_id = ${input.checkId}
        and status = ${"captured"}
        and method = ${"card"}
        and processor = ${"quantum_payments"}
      limit 1
    `;
    const existing = String(prior[0]?.processor_payment_id ?? "").trim();
    if (existing) {
      return {
        ok: true,
        transferId: existing,
        last4: String(prior[0]?.last4 ?? "").replace(/\D/g, "").slice(-4),
        merchantId: String(prior[0]?.merchant_id ?? ""),
      };
    }
  }

  const payable = input.entities.filter((share) => share.amountCents > 0);
  if (!payable.length) {
    return {
      ok: false,
      error: "This selling entity does not have a Quantum Payments merchant. Use cash or keep the check open.",
    };
  }
  const splitSum = payable.reduce((sum, share) => sum + share.amountCents, 0);
  if (Math.abs(splitSum - input.amountCents) > 1) {
    return { ok: false, error: "Split does not match the tender. Use cash or keep the check open." };
  }
  const shares = [];
  for (const share of payable) {
    const merchantId = await storedMerchant(loc.id, share.entityId, share.kind);
    shares.push({
      kind: share.kind,
      entityId: share.entityId,
      merchantId,
      amountCents: share.amountCents,
    });
  }
  const planned = parentMerchantForCapture({
    peerVenue: loc.operating_model === "peer_venue",
    shares,
  });
  if (!planned.ok) return { ok: false, error: planned.error };

  const charged = await chargeManualCardOnFinix({
    card,
    amountCents: input.amountCents,
    merchantId: planned.parentMerchantId,
    checkId: input.checkId,
    splits: planned.splits,
  });
  if (!charged.ok) {
    return { ok: false, error: redactCardText(charged.error, secrets) };
  }

  try {
    const id = newId("zpay");
    await sql`
      insert into summex_payments (
        id, org_id, location_id, merchant_id, amount_cents, currency, status, method, last4,
        processor, processor_payment_id, capture_mode, check_id, reader_id, client_mutation_id
      ) values (
        ${id},
        ${loc.org_id},
        ${loc.id},
        ${planned.parentMerchantId},
        ${Math.max(0, Math.round(input.amountCents))},
        ${"usd"},
        ${"captured"},
        ${"card"},
        ${charged.last4},
        ${"quantum_payments"},
        ${charged.transferId},
        ${"sandbox"},
        ${input.checkId ?? null},
        ${""},
        ${`manual:${input.checkId ?? id}`.slice(0, 80)}
      )
    `;
  } catch {
    /* The transfer already succeeded. The check still closes. */
  }
  return {
    ok: true,
    transferId: charged.transferId,
    last4: charged.last4,
    merchantId: planned.parentMerchantId,
  };
}
