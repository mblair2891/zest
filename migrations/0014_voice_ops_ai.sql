-- Voice command audit and AI recommendation decisions (location/entity scoped).

create table if not exists voice_commands (
  id text primary key,
  location_id text not null,
  operator_id text,
  user_id text,
  transcript text not null,
  intent text not null,
  ok boolean not null default false,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists voice_commands_loc_idx on voice_commands (location_id, created_at desc);

create table if not exists ops_ai_decisions (
  id text primary key,
  location_id text not null,
  operator_id text,
  user_id text,
  rec_type text not null,
  rec_id text,
  action text not null,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ops_ai_decisions_loc_idx on ops_ai_decisions (location_id, rec_type, created_at desc);
