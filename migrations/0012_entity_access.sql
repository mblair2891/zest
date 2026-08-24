-- Per-entity staff logins and host-location device registry.

alter table memberships add column if not exists operator_id text;
create index if not exists memberships_operator_idx on memberships (operator_id);

alter table invites add column if not exists operator_id text;

create table if not exists location_devices (
  id text primary key,
  location_id text not null references locations (id) on delete cascade,
  label text not null,
  type text not null,
  status text not null default 'pending',
  serial text,
  claim_code text,
  assigned_operator_id text,
  assigned_function text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists location_devices_loc_idx on location_devices (location_id);
create unique index if not exists location_devices_claim_uidx
  on location_devices (claim_code)
  where claim_code is not null;
