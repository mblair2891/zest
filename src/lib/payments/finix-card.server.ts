/**
 * Quantum Payments card authorization on the Finix rail.
 * Sandbox keys stay on the sandbox host. Live keys run only when the location is live.
 * The check stays open until a paid transfer webhook closes it.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { authorizeCardPresent } from "./finix";
import { missingFinixKeyMessage, readFinixCreds, type FinixMode } from "./finix-keys";
import { liveCardGate } from "./finix-events";
import type { CardPresentInput, CardPresentResult } from "./types";

export async function captureFinixCardPresent(opts: {
  input: CardPresentInput;
  merchantId: string;
  readerId: string | null;
  splits?: Array<{ merchantId: string; amountCents: number }>;
  mode?: FinixMode;
  locationLive?: boolean;
}): Promise<CardPresentResult> {
  const mode: FinixMode = opts.mode ?? (opts.locationLive ? "live" : "sandbox");
  const sandbox = mode === "sandbox";
  const creds = readFinixCreds(mode);
  if (!creds.ok) {
    return {
      ok: false,
      status: "unavailable",
      sandbox,
      error: missingFinixKeyMessage(creds.missing),
    };
  }
  const merchantId = opts.merchantId.trim();
  if (mode === "live") {
    const gate = liveCardGate({ locationLive: opts.locationLive !== false, merchantId });
    if (!gate.ok) {
      return { ok: false, status: "unavailable", sandbox: false, error: gate.error };
    }
    if (!opts.readerId) {
      return {
        ok: false,
        status: "requires_terminal",
        sandbox: false,
        error:
          "Present card on an enrolled Quantum reader supplied through Summex. Tablets run the POS; they are not card terminals. Use cash or keep the check open.",
      };
    }
  } else if (!merchantId) {
    return {
      ok: false,
      status: "unavailable",
      sandbox: true,
      error: "This selling entity does not have a Quantum Payments merchant. Use cash or keep the check open.",
    };
  }

  const sql = await getSql();
  if (opts.input.clientMutationId) {
    const dup = await sql<{ id: string; last4: string | null; status: string }>`
      select id, last4, status from summex_payments
      where location_id = ${opts.input.locationId}
        and client_mutation_id = ${opts.input.clientMutationId}
      limit 1
    `;
    if (dup[0]?.status === "authorized" || dup[0]?.status === "captured") {
      return {
        ok: true,
        status: dup[0].status === "captured" ? "captured" : "authorized",
        sandbox,
        paymentId: dup[0].id,
        last4: dup[0].last4,
        hostBrand: opts.input.hostBrand ?? undefined,
      };
    }
  }

  const authorized = await authorizeCardPresent({
    mode,
    locationLive: mode === "live",
    merchantId,
    amountCents: opts.input.amountCents,
    readerId: opts.readerId,
    idempotencyId: opts.input.clientMutationId || undefined,
    checkId: opts.input.checkId,
    splits: opts.splits,
  });
  if (!authorized.ok || !authorized.id) {
    return {
      ok: false,
      status: "unavailable",
      sandbox,
      error: authorized.error || "Card capture could not start. Use cash or keep the check open.",
    };
  }

  const id = newId("zpay");
  await sql`
    insert into summex_payments (
      id, org_id, location_id, merchant_id, amount_cents, currency, status, method, last4,
      processor, processor_payment_id, capture_mode, check_id, reader_id, host_brand,
      client_mutation_id
    ) values (
      ${id},
      ${opts.input.orgId},
      ${opts.input.locationId},
      ${merchantId},
      ${opts.input.amountCents},
      ${"usd"},
      ${"authorized"},
      ${"card"},
      ${authorized.last4},
      ${"quantum_payments"},
      ${authorized.id},
      ${sandbox ? "sandbox" : "live"},
      ${opts.input.checkId ?? null},
      ${opts.readerId},
      ${opts.input.hostBrand ?? null},
      ${opts.input.clientMutationId ?? null}
    )
  `;
  return {
    ok: true,
    status: "authorized",
    sandbox,
    paymentId: id,
    last4: authorized.last4,
    hostBrand: opts.input.hostBrand ?? undefined,
  };
}
