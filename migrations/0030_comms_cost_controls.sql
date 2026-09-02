-- SMS allotment / overage + AI daily throttle.
-- Email (Resend) stays included and is never counted against SMS.

alter table front_settings
  add column if not exists sms_enabled boolean not null default true;

alter table front_settings
  add column if not exists sms_monthly_cap integer;

create table if not exists comms_cap_alerts (
  id text primary key,
  location_id text not null,
  period text not null,
  threshold integer not null,
  sent_at timestamptz not null default now(),
  unique (location_id, period, threshold)
);

create index if not exists comms_cap_alerts_loc_idx
  on comms_cap_alerts (location_id, period);

create table if not exists ai_usage_log (
  id text primary key,
  location_id text not null,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_log_loc_day_idx
  on ai_usage_log (location_id, created_at desc);
