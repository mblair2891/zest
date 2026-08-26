import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import type { CardPresentInput, CardPresentResult } from "./types";

function clipLast4(raw: unknown): string {
  const d = String(raw ?? "").replace(/\D/g, "").slice(-4);
  return d.length === 4 ? d : "4242";
}

export async function captureSandbox(opts: {
  input: CardPresentInput;
  merchantId: string;
}): Promise<CardPresentResult> {
  const sql = await getSql();
  const id = newId("zpay");
  const last4 = clipLast4(opts.input.sandboxLast4);
  if (opts.input.clientMutationId) {
    const dup = await sql<{ id: string; last4: string | null }>`
      select id, last4 from summex_payments
      where location_id = ${opts.input.locationId}
        and client_mutation_id = ${opts.input.clientMutationId}
      limit 1
    `;
    if (dup[0]) {
      return {
        ok: true,
        status: "captured",
        sandbox: true,
        paymentId: dup[0].id,
        last4: dup[0].last4,
        hostBrand: opts.input.hostBrand ?? undefined,
      };
    }
  }
  await sql`
    insert into summex_payments (
      id, org_id, location_id, merchant_id, amount_cents, currency, status, method, last4,
      processor, processor_payment_id, capture_mode, check_id, reader_id, host_brand,
      client_mutation_id
    ) values (
      ${id},
      ${opts.input.orgId},
      ${opts.input.locationId},
      ${opts.merchantId},
      ${opts.input.amountCents},
      ${"usd"},
      ${"captured"},
      ${"card"},
      ${last4},
      ${"quantum_payments"},
      ${null},
      ${"sandbox"},
      ${opts.input.checkId ?? null},
      ${opts.input.readerId ?? null},
      ${opts.input.hostBrand ?? null},
      ${opts.input.clientMutationId ?? null}
    )
  `;
  return {
    ok: true,
    status: "captured",
    sandbox: true,
    paymentId: id,
    last4,
    hostBrand: opts.input.hostBrand ?? undefined,
  };
}
