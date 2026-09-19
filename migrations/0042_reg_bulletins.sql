-- Platform-authored jurisdiction bulletins. Never auto-write venue tax rows.

create table if not exists reg_bulletins (
  id text primary key,
  title text not null,
  body text not null,
  effective_on date not null,
  severity text not null default 'info',
  scope_kind text not null default 'all',
  scope_country text not null default 'US',
  scope_state text not null default '',
  scope_city text not null default '',
  scope_district text not null default '',
  suggested_tax jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists reg_bulletins_effective_idx on reg_bulletins (effective_on desc);
create index if not exists reg_bulletins_scope_idx on reg_bulletins (scope_kind, scope_state);

create table if not exists reg_bulletin_acks (
  bulletin_id text not null references reg_bulletins (id) on delete cascade,
  location_id text not null,
  status text not null,
  updated_at timestamptz not null default now(),
  primary key (bulletin_id, location_id)
);

create index if not exists reg_bulletin_acks_loc_idx on reg_bulletin_acks (location_id);
