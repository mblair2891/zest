-- One row per station card-reader event: connect, entity match, or Finix key status.
-- Credential values are not stored. Presence is yes or no.
create table if not exists station_activity_log (
  id text primary key,
  location_id text not null,
  at timestamptz not null default now(),
  station_name text not null,
  action text not null,
  environment text not null default '',
  username_present text not null default '',
  password_present text not null default '',
  merchant_id text not null default '',
  device_id text not null default '',
  check_entity text not null default '',
  reader_entity text not null default '',
  result text not null default ''
);

create index if not exists station_activity_log_location_idx
  on station_activity_log (location_id, at desc);
