-- Card-not-present payment instrument. The Finix token is not stored.
-- Card number, expiration, and CVV are never written.

alter table summex_payments
  add column if not exists payment_instrument_id text;

alter table summex_payments
  add column if not exists buyer_identity_id text;

alter table summex_payments
  add column if not exists customer_ref text;

create index if not exists summex_payments_instrument_idx
  on summex_payments (location_id, payment_instrument_id)
  where payment_instrument_id is not null;

alter table pos_checks
  add column if not exists card_not_present_instrument_id text;
