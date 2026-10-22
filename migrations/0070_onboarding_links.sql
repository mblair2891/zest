-- Unique expiring onboarding links for a venue point of contact and an entity contact.
-- The raw token is emailed once. Only the hash is stored.

create table if not exists onboarding_links (
  id text primary key,
  kind text not null check (kind in ('venue', 'entity')),
  token_hash text not null unique,
  prospect_id text,
  org_id text,
  location_id text,
  operator_id text,
  user_id text,
  email text not null,
  name text not null default '',
  phone text not null default '',
  scope text not null default 'location' check (scope in ('location', 'entity')),
  seat text not null default 'owner' check (seat in ('owner', 'manager', 'accountant')),
  expires_at timestamptz not null,
  sent_at timestamptz,
  opened_at timestamptz,
  started_at timestamptz,
  password_set_at timestamptz,
  completed_at timestamptz,
  revoked_at timestamptz,
  email_status text not null default 'logged_only',
  created_by text,
  created_at timestamptz not null default now(),
  steps jsonb not null default '{}'::jsonb
);

create index if not exists onboarding_links_prospect_idx
  on onboarding_links (prospect_id, created_at desc);
create index if not exists onboarding_links_operator_idx
  on onboarding_links (operator_id, created_at desc);
create index if not exists onboarding_links_location_idx
  on onboarding_links (location_id, created_at desc);

alter table locations add column if not exists summex_agreement_at timestamptz;
alter table locations add column if not exists summex_agreement_name text;
