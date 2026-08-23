-- Prospect intake, quote snapshots, onboarding runs, audit.
-- No tenant seed. JSON stored as text for Neon + PGLite parity.

create table if not exists pricing_rules (
  id text primary key,
  rules_json text not null,
  updated_at timestamptz not null default now()
);

create table if not exists prospects (
  id text primary key,
  public_token text not null unique,
  status text not null default 'prospect',
  billing_email text,
  company_json text not null default '{}',
  answers_json text not null default '{}',
  quote_json text,
  quote_issued_at timestamptz,
  accepted_at timestamptz,
  contracted_at timestamptz,
  contract_signed_by text,
  org_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospects_status_idx on prospects (status);
create index if not exists prospects_token_idx on prospects (public_token);

create table if not exists onboarding_runs (
  id text primary key,
  prospect_id text not null references prospects(id) on delete cascade,
  steps_json text not null default '{}',
  payload_json text not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_runs_prospect_idx on onboarding_runs (prospect_id);

create table if not exists audit_events (
  id text primary key,
  prospect_id text,
  actor text not null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_prospect_idx on audit_events (prospect_id);
