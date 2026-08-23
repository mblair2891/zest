-- Guest kiosk, waitlist, and reservation check-in.
-- Isolated from tenant billing; location_id may be a demo location.

create table if not exists front_settings (
  location_id text primary key,
  kiosk_mode text not null default 'combined',
  waitlist_enabled boolean not null default false,
  waitlist_reason text,
  waitlist_reasons jsonb not null default '[]'::jsonb,
  sms_from text,
  updated_at timestamptz not null default now()
);

create table if not exists reservations (
  id text primary key,
  location_id text not null,
  name text not null,
  party_size integer not null,
  at timestamptz not null,
  phone text,
  email text,
  check_in_code text not null,
  status text not null default 'booked',
  table_suggestion text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists reservations_loc_at_idx on reservations (location_id, at);
create index if not exists reservations_code_idx on reservations (location_id, check_in_code);

create table if not exists waitlist_entries (
  id text primary key,
  location_id text not null,
  name text not null,
  party_size integer not null,
  phone text not null,
  quoted_minutes integer not null,
  status text not null default 'waiting',
  opt_out_token text not null unique,
  notes text,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

create index if not exists waitlist_loc_status_idx on waitlist_entries (location_id, status);

create table if not exists message_log (
  id text primary key,
  channel text not null,
  to_addr text not null,
  subject text,
  body text not null,
  provider text not null,
  kind text not null,
  location_id text,
  created_at timestamptz not null default now()
);

create index if not exists message_log_loc_idx on message_log (location_id, created_at desc);
