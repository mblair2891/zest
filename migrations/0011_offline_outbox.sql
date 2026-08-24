-- Idempotent offline mutation log. Client ids prevent double-apply on reconnect.

create table if not exists offline_mutations (
  client_mutation_id text not null,
  location_id text not null,
  user_id text not null,
  kind text not null,
  payload jsonb not null,
  status text not null default 'applied',
  error text,
  created_at timestamptz not null default now(),
  applied_at timestamptz not null default now(),
  primary key (location_id, client_mutation_id)
);

create index if not exists offline_mutations_loc_idx
  on offline_mutations (location_id, created_at desc);

create index if not exists offline_mutations_user_idx
  on offline_mutations (user_id, created_at desc);
