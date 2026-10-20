-- Station reader sale idempotency id. A retry of that sale reuses it.
alter table pos_checks
  add column if not exists card_sale_idempotency_id text;
