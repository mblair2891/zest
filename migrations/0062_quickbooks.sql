-- QuickBooks Online: one company per entity, or one company for the venue.
-- Tokens stay on the server. The back office sees the company name, the map, and the log.

create table if not exists qbo_connections (
  id text primary key,
  location_id text not null references locations (id) on delete cascade,
  org_id text not null,
  entity_id text not null default '',
  realm_id text not null,
  company_name text not null default '',
  environment text not null default 'sandbox',
  access_token text not null default '',
  refresh_token text not null default '',
  access_expires_at_ms bigint not null default 0,
  refresh_expires_at_ms bigint not null default 0,
  auto_sync boolean not null default false,
  status text not null default 'connected',
  last_error text,
  cache jsonb not null default '{}'::jsonb,
  connected_by text,
  connected_at_ms bigint not null,
  updated_at_ms bigint not null
);

create unique index if not exists qbo_connections_loc_entity_uidx
  on qbo_connections (location_id, entity_id);

create table if not exists qbo_oauth_states (
  state text primary key,
  location_id text not null,
  org_id text not null,
  entity_id text not null default '',
  user_id text not null,
  environment text not null,
  redirect_uri text not null,
  created_at_ms bigint not null,
  expires_at_ms bigint not null
);

create table if not exists qbo_account_maps (
  connection_id text not null references qbo_connections (id) on delete cascade,
  summex_code text not null,
  qbo_account_id text not null,
  qbo_account_name text not null default '',
  primary key (connection_id, summex_code)
);

create table if not exists qbo_class_maps (
  connection_id text not null references qbo_connections (id) on delete cascade,
  entity_id text not null,
  qbo_class_id text not null,
  qbo_class_name text not null default '',
  primary key (connection_id, entity_id)
);

create table if not exists qbo_sync_log (
  id text primary key,
  location_id text not null,
  connection_id text,
  entity_id text not null default '',
  business_date text not null,
  trigger text not null,
  status text not null,
  attempt integer not null default 1,
  doc_number text,
  qbo_id text,
  error text,
  summary text,
  created_at_ms bigint not null
);

create index if not exists qbo_sync_log_loc_idx
  on qbo_sync_log (location_id, created_at_ms desc);

create table if not exists qbo_posted (
  id text primary key,
  connection_id text not null references qbo_connections (id) on delete cascade,
  location_id text not null,
  business_date text not null,
  doc_number text not null,
  qbo_id text,
  payload jsonb not null,
  created_at_ms bigint not null,
  unique (connection_id, doc_number)
);
