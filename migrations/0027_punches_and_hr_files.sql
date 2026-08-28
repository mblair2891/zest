-- Entity-scoped time punches (clock in/out) and stored HR packet / I-9 files.

create table if not exists location_punches (
  id text primary key,
  org_id text not null,
  location_id text not null references locations (id) on delete cascade,
  employer_id text not null,
  employee_id text not null,
  employee_name text not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  regular_minutes integer not null default 0,
  ot_minutes integer not null default 0,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists location_punches_loc_emp_idx
  on location_punches (location_id, employer_id, employee_id);

alter table hr_packets add column if not exists file_data text;
alter table hr_onboarding add column if not exists i9_files jsonb not null default '[]'::jsonb;
