-- Local employee ↔ payroll-provider employee id. Hours export only — not a payroll run.

create table if not exists hr_payroll_map (
  location_id text not null references locations (id) on delete cascade,
  employer_id text not null,
  employee_id text not null,
  provider text not null default 'csv',
  provider_employee_id text not null,
  updated_at timestamptz not null default now(),
  primary key (location_id, employer_id, employee_id, provider)
);
create index if not exists hr_payroll_map_emp_idx
  on hr_payroll_map (location_id, employer_id);
