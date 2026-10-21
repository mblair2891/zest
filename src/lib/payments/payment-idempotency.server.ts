/**
 * Claim the idempotency id stored on a payment row.
 * A saved UUID is reused. An empty or invalid value is replaced once, before the Finix call.
 * Two callers racing on an empty value share the winner's id.
 */
import { getSql } from "@/lib/db";
import { finixAttemptIdempotencyId, mintFinixAttemptIdempotencyId } from "./idempotency";

const UUID_SQL =
  "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

export async function claimPaymentIdempotencyId(opts: {
  paymentId: string;
  locationId: string;
  existing?: unknown;
}): Promise<string> {
  const saved = finixAttemptIdempotencyId(opts.existing);
  if (saved) return saved;
  const minted = mintFinixAttemptIdempotencyId();
  const sql = await getSql();
  const claimed = await sql<{ idempotency_id: string }>`
    update summex_payments
    set idempotency_id = ${minted}
    where id = ${opts.paymentId}
      and location_id = ${opts.locationId}
      and (
        idempotency_id is null
        or btrim(idempotency_id) = ''
        or idempotency_id !~* ${UUID_SQL}
      )
    returning idempotency_id
  `;
  const won = finixAttemptIdempotencyId(claimed[0]?.idempotency_id);
  if (won) return won;
  const again = await sql<{ idempotency_id: string | null }>`
    select idempotency_id from summex_payments
    where id = ${opts.paymentId} and location_id = ${opts.locationId}
    limit 1
  `;
  return finixAttemptIdempotencyId(again[0]?.idempotency_id) ?? minted;
}
