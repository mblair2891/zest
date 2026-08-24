-- Floor PIN hashes + entity-scoped schedule.

create table if not exists location_staff (
  id text primary key,
  location_id text not null references locations (id) on delete cascade,
  operator_id text,
  name text not null,
  role text not null default 'staff',
  pin_hash text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists location_staff_loc_idx on location_staff (location_id);
create index if not exists location_staff_op_idx on location_staff (operator_id);

create table if not exists location_shifts (
  id text primary key,
  location_id text not null references locations (id) on delete cascade,
  operator_id text,
  employee_id text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  published boolean not null default false,
  role text,
  created_at timestamptz not null default now()
);

create index if not exists location_shifts_loc_idx on location_shifts (location_id, start_at);
create index if not exists location_shifts_emp_idx on location_shifts (employee_id, start_at);
