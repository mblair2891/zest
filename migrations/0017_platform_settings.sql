-- Typed platform settings (key/value JSON internally — never shown as JSON in UI).
-- Plan commercial fields migrated off pricing_rules JSON.

create table if not exists platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists platform_team (
  user_id text primary key references "user" ("id") on delete cascade,
  role text not null default 'read_only',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  invited_by text
);

create index if not exists platform_team_status_idx on platform_team (status);

alter table plans add column if not exists monthly_cents int not null default 0;
alter table plans add column if not exists onboarding_fee_cents int not null default 0;
alter table plans add column if not exists active boolean not null default true;
alter table plans add column if not exists sort_order int not null default 0;
alter table plans add column if not exists module_flags jsonb not null default '{}'::jsonb;

-- One-time copy of plan monthly / onboarding fees from the old JSON blob.
update plans p
set monthly_cents = coalesce(
  (
    select (r.rules -> 'planMonthlyCents' ->> p.slug)::int
    from pricing_rules r
    where r.id = 'default'
  ),
  p.monthly_cents
)
where p.monthly_cents = 0;

update plans p
set onboarding_fee_cents = coalesce(
  (
    select (r.rules -> 'onboardingFeeCents' ->> p.slug)::int
    from pricing_rules r
    where r.id = 'default'
  ),
  p.onboarding_fee_cents
)
where p.onboarding_fee_cents = 0;

update plans set sort_order = 10 where slug = 'starter' and sort_order = 0;
update plans set sort_order = 20 where slug = 'full_service' and sort_order = 0;
update plans set sort_order = 30 where slug = 'food_hall' and sort_order = 0;
update plans set sort_order = 90 where slug = 'platform_internal' and sort_order = 0;

update plans
set module_flags = jsonb_build_object(
  'crm', features @> '["guests_crm"]'::jsonb,
  'waitlist', features @> '["host_stand"]'::jsonb,
  'reservations', features @> '["host_stand"]'::jsonb,
  'qrOrder', features @> '["online_kiosk"]'::jsonb,
  'voice', features @> '["advanced_ops"]'::jsonb,
  'aiInsights', (features @> '["drink_ai"]'::jsonb) or (features @> '["ai_inventory"]'::jsonb),
  'kiosk', features @> '["online_kiosk"]'::jsonb,
  'giftCards', features @> '["guests_crm"]'::jsonb,
  'offline', true
)
where module_flags = '{}'::jsonb;

insert into platform_team (user_id, role, status)
select user_id, 'admin', 'active' from platform_admin
on conflict (user_id) do nothing;
