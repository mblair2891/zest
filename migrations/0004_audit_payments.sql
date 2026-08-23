-- Audit trail + Summex Payments merchant facade (sandbox/live).

create table if not exists audit_events (
  id text primary key,
  org_id text,
  actor_user_id text,
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_org_idx on audit_events (org_id);
create index if not exists audit_events_action_idx on audit_events (action);

create table if not exists summex_merchants (
  id text primary key,
  org_id text not null references organizations (id) on delete cascade,
  location_id text references locations (id) on delete set null,
  status text not null default 'sandbox',
  created_at timestamptz not null default now()
);

create unique index if not exists summex_merchants_org_loc_uidx
  on summex_merchants (org_id, location_id);

create table if not exists summex_payments (
  id text primary key,
  org_id text not null references organizations (id) on delete cascade,
  location_id text,
  merchant_id text,
  amount_cents int not null,
  currency text not null default 'usd',
  status text not null,
  method text not null,
  last4 text,
  created_at timestamptz not null default now()
);

create index if not exists summex_payments_org_idx on summex_payments (org_id);

create table if not exists summex_deposits (
  id text primary key,
  org_id text not null references organizations (id) on delete cascade,
  amount_cents int not null,
  status text not null,
  scheduled_for timestamptz,
  created_at timestamptz not null default now()
);
