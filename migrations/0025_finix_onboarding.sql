-- Quantum Payments onboarding (processor tokens only). Never store SSN, PAN, or full account numbers.

create table if not exists payment_accounts (
  id text primary key,
  org_id text not null,
  location_id text,
  operator_id text,
  kind text not null,
  payments_provider text not null default 'sandbox',
  finix_identity_id text,
  finix_merchant_id text,
  finix_payment_instrument_id text,
  onboarding_status text not null default 'not_started',
  payout_bank_last4 text,
  payout_routing_last4 text,
  onboarding_link text,
  onboarding_form_id text,
  rejection_reason text,
  approved_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists payment_accounts_host_uidx
  on payment_accounts (location_id)
  where kind = 'host' and location_id is not null;

create unique index if not exists payment_accounts_op_uidx
  on payment_accounts (operator_id)
  where kind = 'operator' and operator_id is not null;

create index if not exists payment_accounts_org_idx
  on payment_accounts (org_id, kind);

create table if not exists finix_webhook_events (
  id text primary key,
  event_id text not null,
  event_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create unique index if not exists finix_webhook_events_event_uidx
  on finix_webhook_events (event_id);

create index if not exists finix_webhook_events_entity_idx
  on finix_webhook_events (entity_id);
