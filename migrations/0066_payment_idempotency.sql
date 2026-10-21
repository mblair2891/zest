-- Idempotency id for a Finix transfer or authorization.
-- The same value is sent again when that payment is retried.
-- The card number, expiration, CVV, and token are not stored here.

alter table summex_payments
  add column if not exists idempotency_id text;

create index if not exists summex_payments_idempotency_idx
  on summex_payments (location_id, idempotency_id)
  where idempotency_id is not null;
