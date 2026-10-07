/**
 * Live Quantum Payments capture on the Finix rail.
 * FINIX_API_KEY and the selling entity’s finix_merchant_id. No Stripe call.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { authorizeCardPresent, finixConfigured } from "./finix";
import type { CardPresentInput, CardPresentResult } from "./types";

export async function captureFinixCardPresent(opts: {
  input: CardPresentInput;
  merchantId: string;
  readerId: string | null;
  splits?: Array<{ merchantId: string; amountCents: number }>;
}): Promise<CardPresentResult> {
  if (!finixConfigured()) {
    return {
      ok: false,
      status: "unavailable",
      sandbox: false,
      error: "Live Quantum Payments is not configured. Use cash or keep the check open.",
    };
  }
  const merchantId = opts.merchantId.trim();
  if (!merchantId) {
    return {
      ok: false,
      status: "unavailable",
      sandbox: false,
      error: "This selling entity does not have a Quantum Payments merchant. Use cash or keep the check open.",
    };
  }
  if (!opts.readerId) {
    return {
      ok: false,
      status: "requires_terminal",
      sandbox: false,
      error:
        "Present card on an enrolled Finix/Quantum reader supplied through Summex. Tablets run the POS; they are not card terminals. Use cash or keep the check open.",
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
    if (dup[0]?.status === "captured") {
      return {
        ok: true,
        status: "captured",
        sandbox: false,
        paymentId: dup[0].id,
        last4: dup[0].last4,
        hostBrand: opts.input.hostBrand ?? undefined,
      };
    }
  }

  const authorized = await authorizeCardPresent({
    merchantId,
    amountCents: opts.input.amountCents,
    readerId: opts.readerId,
    idempotencyId: opts.input.clientMutationId || undefined,
    splits: opts.splits,
  });
  if (!authorized.ok || !authorized.id) {
    return {
      ok: false,
      status: "unavailable",
      sandbox: false,
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
      ${"captured"},
      ${"card"},
      ${authorized.last4},
      ${"quantum_payments"},
      ${authorized.id},
      ${"live"},
      ${opts.input.checkId ?? null},
      ${opts.readerId},
      ${opts.input.hostBrand ?? null},
      ${opts.input.clientMutationId ?? null}
    )
  `;
  return {
    ok: true,
    status: "captured",
    sandbox: false,
    paymentId: id,
    last4: authorized.last4,
    hostBrand: opts.input.hostBrand ?? undefined,
  };
}
