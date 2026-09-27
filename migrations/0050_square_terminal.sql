-- Square Terminal checkouts and webhook idempotency. Tokens only. No PAN.

create table if not exists square_webhook_events (
  id text primary key,
  event_id text not null,
  event_type text not null,
  checkout_id text,
  payment_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists square_webhook_events_event_uidx
  on square_webhook_events (event_id);

create table if not exists square_checkouts (
  id text primary key,
  org_id text not null,
  location_id text not null,
  check_id text,
  device_id text,
  amount_cents integer not null,
  currency text not null default 'USD',
  status text not null,
  square_checkout_id text,
  square_payment_id text,
  reference_id text,
  note text,
  sandbox boolean not null default true,
  simulated boolean not null default false,
  client_mutation_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists square_checkouts_sq_uidx
  on square_checkouts (square_checkout_id)
  where square_checkout_id is not null;
