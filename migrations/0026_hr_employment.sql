-- Entity-scoped HR / employment. Optional per employer (host or tenant).

create table if not exists hr_applicants (
  id text primary key,
  org_id text not null,
  location_id text not null references locations (id) on delete cascade,
  employer_id text not null,
  name text not null,
  email text,
  phone text,
  role text,
  stage text not null default 'applied',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_applicants_loc_emp_idx
  on hr_applicants (location_id, employer_id);

create table if not exists hr_onboarding (
  id text primary key,
  org_id text not null,
  location_id text not null references locations (id) on delete cascade,
  employer_id text not null,
  employee_id text not null,
  employee_name text not null,
  checklist jsonb not null default '[]'::jsonb,
  i9_section1_at timestamptz,
  i9_section2_at timestamptz,
  i9_section3_at timestamptz,
  i9_status text not null default 'not_started',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists hr_onboarding_loc_emp_idx
  on hr_onboarding (location_id, employer_id);

create table if not exists hr_packets (
  id text primary key,
  org_id text not null,
  location_id text not null references locations (id) on delete cascade,
  employer_id text not null,
  employee_id text,
  employee_name text not null,
  employee_email text,
  template_id text not null,
  state text not null,
  title text not null,
  body text,
  status text not null default 'draft',
  provider text,
  provider_envelope_id text,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  counter_signed_at timestamptz,
  expires_at timestamptz,
  file_name text,
  file_kind text,
  created_at timestamptz not null default now()
);
create index if not exists hr_packets_loc_emp_idx
  on hr_packets (location_id, employer_id);

create table if not exists hr_time_off (
  id text primary key,
  org_id text not null,
  location_id text not null references locations (id) on delete cascade,
  employer_id text not null,
  employee_id text not null,
  employee_name text not null,
  kind text not null default 'pto',
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'requested',
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists hr_time_off_loc_emp_idx
  on hr_time_off (location_id, employer_id);

create table if not exists hr_writeups (
  id text primary key,
  org_id text not null,
  location_id text not null references locations (id) on delete cascade,
  employer_id text not null,
  employee_id text not null,
  employee_name text not null,
  title text not null,
  body text not null,
  severity text not null default 'coaching',
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists hr_writeups_loc_emp_idx
  on hr_writeups (location_id, employer_id);

create table if not exists hr_availability (
  id text primary key,
  org_id text not null,
  location_id text not null references locations (id) on delete cascade,
  employer_id text not null,
  employee_id text not null,
  weekday smallint not null,
  start_min integer not null default 0,
  end_min integer not null default 1440
);
create index if not exists hr_avail_emp_idx
  on hr_availability (location_id, employee_id);

create table if not exists hr_eligibility (
  location_id text not null references locations (id) on delete cascade,
  employer_id text not null,
  employee_id text not null,
  minor boolean not null default false,
  alcohol boolean not null default false,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (location_id, employee_id)
);

-- Encrypted tax / SSN. Ciphertext only; last4 for display. Never log plaintext.
create table if not exists hr_tax_pii (
  location_id text not null references locations (id) on delete cascade,
  employee_id text not null,
  ssn_last4 text,
  ssn_cipher text,
  tax_cipher text,
  updated_at timestamptz not null default now(),
  primary key (location_id, employee_id)
);
