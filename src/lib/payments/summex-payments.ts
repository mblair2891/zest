import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { requireActiveOrg } from "@/lib/saas/tenancy.server";

export type PaymentsMode = "sandbox" | "live";

export type PaymentIntent = {
  id: string;
  orgId: string;
  locationId: string | null;
  merchantId: string | null;
  amountCents: number;
  currency: string;
  status: "authorized" | "captured" | "voided" | "refunded";
  method: string;
  last4: string | null;
};

function mode(): PaymentsMode {
  return process.env.SUMMEX_PAYMENTS_MODE === "live" ? "live" : "sandbox";
}

async function ensureMerchant(orgId: string, locationId: string | null) {
  const sql = await getSql();
  const existing = locationId
    ? await sql<{ id: string }>`
        select id from summex_merchants
        where org_id = ${orgId} and location_id = ${locationId}
        limit 1
      `
    : await sql<{ id: string }>`
        select id from summex_merchants
        where org_id = ${orgId} and location_id is null
        limit 1
      `;
  if (existing[0]) return existing[0].id;
  const id = newId("zmer");
  await sql`
    insert into summex_merchants (id, org_id, location_id, status)
    values (${id}, ${orgId}, ${locationId}, ${mode()})
  `;
  return id;
}

export async function createMerchantAccount(orgId: string, locationId?: string) {
  const id = await ensureMerchant(orgId, locationId ?? null);
  return { id, mode: mode() };
}

export async function createPaymentIntent(opts: {
  orgId: string;
  locationId?: string | null;
  amountCents: number;
  method?: string;
  last4?: string | null;
}): Promise<PaymentIntent> {
  const sql = await getSql();
  const merchantId = await ensureMerchant(opts.orgId, opts.locationId ?? null);
  const id = newId("zpay");
  const method = opts.method ?? "card";
  await sql`
    insert into summex_payments (
      id, org_id, location_id, merchant_id, amount_cents, currency, status, method, last4
    ) values (
      ${id}, ${opts.orgId}, ${opts.locationId ?? null}, ${merchantId},
      ${opts.amountCents}, 'usd', 'authorized', ${method}, ${opts.last4 ?? null}
    )
  `;
  return {
    id,
    orgId: opts.orgId,
    locationId: opts.locationId ?? null,
    merchantId,
    amountCents: opts.amountCents,
    currency: "usd",
    status: "authorized",
    method,
    last4: opts.last4 ?? null,
  };
}

export async function capture(paymentId: string): Promise<void> {
  const sql = await getSql();
  await sql`update summex_payments set status = 'captured' where id = ${paymentId} and status = 'authorized'`;
}

export async function voidIntent(paymentId: string): Promise<void> {
  const sql = await getSql();
  await sql`update summex_payments set status = 'voided' where id = ${paymentId} and status = 'authorized'`;
}

export async function refund(paymentId: string): Promise<void> {
  const sql = await getSql();
  await sql`update summex_payments set status = 'refunded' where id = ${paymentId} and status = 'captured'`;
}

export async function listDeposits(orgId: string) {
  const sql = await getSql();
  const captured = await sql<{ amount_cents: number }>`
    select coalesce(sum(amount_cents), 0)::int as amount_cents
    from summex_payments
    where org_id = ${orgId} and status = 'captured'
  `;
  const existing = await sql<{
    id: string;
    amount_cents: number;
    status: string;
    scheduled_for: unknown;
  }>`
    select id, amount_cents, status, scheduled_for
    from summex_deposits
    where org_id = ${orgId}
    order by created_at desc
    limit 20
  `;
  return {
    capturedCents: Number(captured[0]?.amount_cents ?? 0),
    deposits: existing,
    mode: mode(),
  };
}

/** POS card path — sandbox or live via the Quantum Payments facade. Never fakes a live Visa. */
export async function recordCapturedCard(opts: {
  userId: string;
  orgId: string;
  locationId?: string | null;
  amountCents: number;
  last4?: string | null;
}): Promise<PaymentIntent> {
  await requireActiveOrg(opts.userId, opts.orgId);
  const loc = String(opts.locationId ?? "").trim();
  if (!loc) throw new Error("Location is required");
  const { captureCardPresent } = await import("./facade.server");
  const res = await captureCardPresent(opts.userId, {
    orgId: opts.orgId,
    locationId: loc,
    amountCents: opts.amountCents,
    sandboxLast4: opts.last4,
  });
  if (!res.ok) throw new Error(res.error || "Card capture failed");
  return {
    id: res.paymentId || "",
    orgId: opts.orgId,
    locationId: loc,
    merchantId: null,
    amountCents: opts.amountCents,
    currency: "usd",
    status: "captured",
    method: "card",
    last4: res.last4 ?? null,
  };
}
