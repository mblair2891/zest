/**
 * Card-not-present and online cards.
 * The browser sends a Finix token id. This server does not accept a card number,
 * an expiration, or a CVV. It creates a payment instrument and stores that id
 * on the order. A transfer or authorization uses that instrument as the source.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";
import { EMPTY_LOCATION_SETUP, type LocationSetup } from "@/lib/saas/types";
import { chargeFinixPaymentInstrument, exchangeFinixCardToken } from "./finix";
import { claimPaymentIdempotencyId } from "./payment-idempotency.server";
import {
  cardNotPresentRejectsRawCard,
  finixJsEnvironment,
  parseFinixInstrumentId,
  parseFinixTokenId,
} from "./finix-tokenize";
import {
  finixModeForLocation,
  missingFinixKeyMessage,
  readFinixApiCreds,
  type FinixMode,
} from "./finix-keys";
import { liveCardGate } from "./finix-events";
import { locationLifecycleStatus } from "./mode";

type LocationRow = {
  id: string;
  org_id: string;
  setup: unknown;
  lifecycle_status: string | null;
};

export type CardTokenFormConfig =
  | {
      ok: true;
      mode: FinixMode;
      environment: "sandbox" | "prod";
      applicationId: string;
      merchantReady: boolean;
    }
  | { ok: false; error: string };

export type CardTokenExchange =
  | {
      ok: true;
      tokenId: string;
      identityId: string;
      instrumentId: string;
      last4: string | null;
      paymentId: string;
      mode: FinixMode;
    }
  | { ok: false; error: string };

export type CardInstrumentCharge =
  | { ok: true; id: string; instrumentId: string; kind: "transfer" | "authorization"; duplicate?: boolean }
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

async function loadLocation(userId: string, orgId: string, locationId: string): Promise<{
  loc: LocationRow;
  mode: FinixMode;
  live: boolean;
}> {
  const sql = await getSql();
  const rows = await sql<LocationRow>`
    select id, org_id, setup, lifecycle_status
    from locations
    where id = ${locationId}
    limit 1
  `;
  const loc = rows[0];
  if (!loc) throw new ForbiddenError("Location not found");
  if (loc.org_id !== orgId) throw new ForbiddenError("Location mismatch");
  await requireMembership(userId, loc.org_id, undefined, loc.id);
  const setup = setupOf(loc.setup);
  const lifecycle = locationLifecycleStatus(setup, loc.lifecycle_status);
  const live = lifecycle === "live";
  return { loc, mode: finixModeForLocation(live), live };
}

async function merchantFor(locationId: string, entityId?: string): Promise<string> {
  const sql = await getSql();
  if (entityId) {
    const op = await sql<{ finix_merchant_id: string | null }>`
      select finix_merchant_id from payment_accounts
      where operator_id = ${entityId} and kind = ${"operator"}
      limit 1
    `;
    const fromOp = realMerchant(String(op[0]?.finix_merchant_id ?? ""));
    if (fromOp) return fromOp;
  }
  const rows = await sql<{ finix_merchant_id: string | null }>`
    select finix_merchant_id from payment_accounts
    where location_id = ${locationId}
      and finix_merchant_id is not null
    limit 8
  `;
  for (const row of rows) {
    const id = realMerchant(String(row.finix_merchant_id ?? ""));
    if (id) return id;
  }
  return "";
}

export async function cardTokenFormConfig(
  userId: string,
  input: { orgId: string; locationId: string; entityId?: string },
): Promise<CardTokenFormConfig> {
  const { mode } = await loadLocation(userId, input.orgId, input.locationId);
  const creds = readFinixApiCreds(mode);
  if (!creds.ok) return { ok: false, error: missingFinixKeyMessage(creds.missing) };
  const merchantId = await merchantFor(input.locationId, input.entityId);
  return {
    ok: true,
    mode,
    environment: finixJsEnvironment(mode),
    applicationId: creds.creds.applicationId.trim(),
    merchantReady: Boolean(merchantId),
  };
}

export async function exchangeCardToken(
  userId: string,
  input: {
    orgId: string;
    locationId: string;
    token: string;
    name?: string;
    checkId?: string;
    orderId?: string;
    customerRef?: string;
    entityId?: string;
    amountCents?: number;
  },
): Promise<CardTokenExchange> {
  const rejected = cardNotPresentRejectsRawCard(input as unknown as Record<string, unknown>);
  if (rejected) return { ok: false, error: rejected };
  const tokenId = parseFinixTokenId(input.token);
  if (!tokenId) return { ok: false, error: "The card form did not return a token." };
  const { loc, mode } = await loadLocation(userId, input.orgId, input.locationId);
  const exchanged = await exchangeFinixCardToken({
    mode,
    token: tokenId,
    name: input.name,
    checkId: input.checkId,
    orderId: input.orderId,
  });
  if (!exchanged.ok) return exchanged;
  const merchantId = await merchantFor(loc.id, input.entityId);
  const amountCents = Math.max(0, Math.round(input.amountCents || 0));
  const paymentId = newId("zpay");
  const sql = await getSql();
  await sql`
    insert into summex_payments (
      id, org_id, location_id, merchant_id, amount_cents, currency, status, method, last4,
      processor, processor_payment_id, capture_mode, check_id, reader_id, client_mutation_id,
      payment_instrument_id, buyer_identity_id, customer_ref
    ) values (
      ${paymentId},
      ${loc.org_id},
      ${loc.id},
      ${merchantId || null},
      ${amountCents},
      ${"usd"},
      ${"pending"},
      ${"card"},
      ${exchanged.last4},
      ${"quantum_payments"},
      ${null},
      ${mode},
      ${input.checkId || input.orderId || null},
      ${""},
      ${`cnp:${paymentId}`.slice(0, 80)},
      ${exchanged.instrumentId},
      ${exchanged.identityId},
      ${input.customerRef?.slice(0, 80) || null}
    )
  `;
  if (input.checkId) {
    await sql`
      update pos_checks
      set card_not_present_instrument_id = ${exchanged.instrumentId}
      where id = ${input.checkId} and location_id = ${loc.id}
    `;
  }
  return {
    ok: true,
    tokenId: exchanged.tokenId,
    identityId: exchanged.identityId,
    instrumentId: exchanged.instrumentId,
    last4: exchanged.last4,
    paymentId,
    mode,
  };
}

export async function chargeStoredInstrument(
  userId: string,
  input: {
    orgId: string;
    locationId: string;
    paymentId: string;
    amountCents: number;
    kind: "transfer" | "authorization";
    entityId?: string;
  },
): Promise<CardInstrumentCharge> {
  const rejected = cardNotPresentRejectsRawCard(input as unknown as Record<string, unknown>);
  if (rejected) return { ok: false, error: rejected };
  const { loc, mode, live } = await loadLocation(userId, input.orgId, input.locationId);
  const sql = await getSql();
  const rows = await sql<{
    payment_instrument_id: string | null;
    processor_payment_id: string | null;
    merchant_id: string | null;
    check_id: string | null;
    customer_ref: string | null;
    idempotency_id: string | null;
  }>`
    select payment_instrument_id, processor_payment_id, merchant_id, check_id, customer_ref, idempotency_id
    from summex_payments
    where id = ${input.paymentId} and location_id = ${loc.id}
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "That order does not have a payment instrument." };
  const existing = String(row.processor_payment_id ?? "").trim();
  const instrumentId = parseFinixInstrumentId(row.payment_instrument_id);
  if (!instrumentId) return { ok: false, error: "That order does not have a payment instrument." };
  if (existing) {
    return { ok: true, id: existing, instrumentId, kind: input.kind, duplicate: true };
  }
  const merchantId = realMerchant(String(row.merchant_id ?? "")) || (await merchantFor(loc.id, input.entityId));
  if (live) {
    const gate = liveCardGate({ locationLive: true, merchantId });
    if (!gate.ok) return { ok: false, error: gate.error };
  }
  const idempotencyId = await claimPaymentIdempotencyId({
    paymentId: input.paymentId,
    locationId: loc.id,
    existing: row.idempotency_id,
  });
  const charged = await chargeFinixPaymentInstrument({
    mode,
    locationLive: live,
    instrumentId,
    merchantId,
    amountCents: input.amountCents,
    kind: input.kind,
    checkId: row.check_id || undefined,
    orderId: row.customer_ref || undefined,
    idempotencyId,
  });
  if (!charged.ok) {
    if (charged.keepIdempotency === false) {
      await sql`
        update summex_payments
        set idempotency_id = null
        where id = ${input.paymentId}
          and location_id = ${loc.id}
          and processor_payment_id is null
      `;
    }
    return charged;
  }
  const status = input.kind === "authorization" ? "authorized" : "captured";
  await sql`
    update summex_payments
    set processor_payment_id = ${charged.id},
        status = ${status},
        merchant_id = ${merchantId},
        amount_cents = ${Math.max(0, Math.round(input.amountCents))},
        idempotency_id = ${idempotencyId}
    where id = ${input.paymentId} and location_id = ${loc.id}
  `;
  return { ok: true, id: charged.id, instrumentId, kind: input.kind };
}
