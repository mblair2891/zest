-- Software plans + per-org subscriptions (SaaS fees, not merchant processing).

create table if not exists plans (
  id text primary key,
  slug text not null unique,
  name text not null,
  features jsonb not null default '[]'::jsonb,
  max_locations int not null default 1,
  max_seats int not null default 8
);

create table if not exists org_subscriptions (
  id text primary key,
  org_id text not null unique references organizations (id) on delete cascade,
  plan_id text not null references plans (id),
  status text not null default 'trialing',
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into plans (id, slug, name, features, max_locations, max_seats)
values
  (
    'starter',
    'starter',
    'Starter',
    '["pos_core","kds","reports_cash","menu_admin","saas_console"]'::jsonb,
    1,
    8
  ),
  (
    'full_service',
    'full_service',
    'Full service',
    '["pos_core","kds","host_stand","online_kiosk","labor","inventory","reports_cash","menu_admin","guests_crm","integrations","drink_ai","marketing_suite","location_website","advanced_ops","saas_console"]'::jsonb,
    5,
    40
  ),
  (
    'food_hall',
    'food_hall',
    'Food hall',
    '["pos_core","kds","host_stand","online_kiosk","labor","inventory","reports_cash","menu_admin","guests_crm","integrations","hall_settlement","vendor_portal","ai_inventory","drink_ai","marketing_suite","location_website","advanced_ops","saas_console"]'::jsonb,
    10,
    80
  ),
  (
    'platform_internal',
    'platform_internal',
    'Platform internal',
    '["pos_core","kds","host_stand","online_kiosk","labor","inventory","reports_cash","menu_admin","guests_crm","integrations","hall_settlement","vendor_portal","truck_pod","ai_inventory","drink_ai","advanced_ops","marketing_suite","location_website","saas_console"]'::jsonb,
    999,
    9999
  )
on conflict (id) do nothing;
