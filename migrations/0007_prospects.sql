-- Prospect intake, pricing quotes, post-contract onboarding.
-- Subscriber lifecycle lives on prospects until (and after) an org is created.

create table if not exists pricing_rules (
  id text primary key,
  version int not null default 1,
  rules jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists prospects (
  id text primary key,
  status text not null default 'prospect',
  owner_user_id text,
  email text,
  answers jsonb not null default '{}'::jsonb,
  quote jsonb,
  quote_issued_at timestamptz,
  accepted_at timestamptz,
  contracted_at timestamptz,
  contract_signed_by text,
  org_id text references organizations (id) on delete set null,
  public_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospects_status_idx on prospects (status);
create index if not exists prospects_owner_idx on prospects (owner_user_id);
create index if not exists prospects_email_idx on prospects (email);
create index if not exists prospects_org_idx on prospects (org_id);

create table if not exists onboarding_runs (
  id text primary key,
  prospect_id text not null references prospects (id) on delete cascade,
  org_id text references organizations (id) on delete set null,
  status text not null default 'in_progress',
  steps jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists onboarding_runs_prospect_uidx
  on onboarding_runs (prospect_id);

create table if not exists operators (
  id text primary key,
  org_id text not null references organizations (id) on delete cascade,
  location_id text references locations (id) on delete cascade,
  legal_name text not null,
  dba text,
  contact_email text,
  contact_phone text,
  station_types jsonb not null default '[]'::jsonb,
  payout_bank_last4 text,
  payout_routing_token text,
  created_at timestamptz not null default now()
);

create index if not exists operators_org_idx on operators (org_id);
create index if not exists operators_loc_idx on operators (location_id);

alter table organizations add column if not exists legal_name text;
alter table organizations add column if not exists dba text;
alter table organizations add column if not exists billing_email text;
alter table organizations add column if not exists phone text;
alter table organizations add column if not exists hq_address text;
alter table organizations add column if not exists tax_id text;

alter table locations add column if not exists address text;
alter table locations add column if not exists host_brand_name text;
alter table locations add column if not exists operating_model text not null default 'single';
alter table locations add column if not exists setup jsonb not null default '{}'::jsonb;

alter table org_subscriptions add column if not exists max_locations_override int;
alter table org_subscriptions add column if not exists max_seats_override int;

insert into pricing_rules (id, version, rules)
values (
  'default',
  1,
  '{
    "planMonthlyCents": {"starter": 0, "full_service": 0, "food_hall": 0, "platform_internal": 0},
    "perLocationFeeCents": 4900,
    "perOperatorFeeCents": 2900,
    "seatPackSize": 8,
    "seatPackFeeCents": 4000,
    "devicePackSize": 4,
    "devicePackFeeCents": 2500,
    "annualDiscountPercent": 10,
    "onboardingFeeCents": {"starter": 49900, "full_service": 149900, "food_hall": 249900, "platform_internal": 0},
    "gmvScaleCents": {"under_50k": 0, "50_150k": 4900, "150_400k": 9900, "400k_plus": 19900},
    "basePlanByLocationType": {
      "restaurant": "full_service",
      "food_hall": "food_hall",
      "truck_pod": "food_hall",
      "ghost_kitchen": "starter",
      "catering": "starter",
      "bar_lounge": "full_service",
      "cafe": "starter",
      "qsr": "starter"
    }
  }'::jsonb
)
on conflict (id) do nothing;
