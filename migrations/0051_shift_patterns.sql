-- Named shift patterns. People are assigned later, on the shifts themselves.
-- Placed shifts point back with pattern_id. Deleting a pattern leaves those shifts.

create table if not exists location_shift_patterns (
  id text primary key,
  location_id text not null references locations (id) on delete cascade,
  operator_id text not null,
  name text not null,
  days jsonb not null default '[]'::jsonb,
  start_hm text not null,
  end_hm text not null,
  role text not null,
  created_at timestamptz not null default now()
);

create index if not exists location_shift_patterns_loc_idx
  on location_shift_patterns (location_id, operator_id);

alter table location_shifts add column if not exists pattern_id text;
