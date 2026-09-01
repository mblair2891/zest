-- Per-entity capture splits. Guest pays one check; each brand is a merchant.

create table if not exists summex_payment_splits (
  id text primary key,
  payment_id text not null,
  org_id text not null,
  location_id text not null,
  entity_id text not null,
  entity_kind text not null,
  display_name text,
  merchandise_cents int not null default 0,
  tax_cents int not null default 0,
  service_cents int not null default 0,
  tip_cents int not null default 0,
  amount_cents int not null,
  finix_merchant_id text,
  transfer_id text,
  status text not null default 'recorded',
  created_at timestamptz not null default now()
);

create index if not exists summex_payment_splits_pay_idx
  on summex_payment_splits (payment_id);

create index if not exists summex_payment_splits_loc_idx
  on summex_payment_splits (location_id, entity_id);
