-- Stripe Terminal adapter behind Quantum Payments. Tokens only. No PAN.

alter table payment_accounts
  add column if not exists stripe_account_id text;

create table if not exists stripe_webhook_events (
  id text primary key,
  event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists stripe_webhook_events_event_uidx
  on stripe_webhook_events (event_id);
