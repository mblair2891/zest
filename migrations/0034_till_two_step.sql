-- Two-step blind count columns on till_closeouts.
-- 0032 created till_closeouts (not pos_till_closeouts). CREATE IF NOT EXISTS
-- so a half-applied DB can finish; ADD COLUMN IF NOT EXISTS so retries are safe.
-- Do not drop closeout rows.

create table if not exists till_closeouts (
  id text primary key,
  location_id text not null,
  org_id text not null,
  drawer_id text not null,
  drawer_name text not null,
  sink_type text not null default 'drawer',
  employee_id text not null,
  employee_name text not null,
  employee_role text not null default '',
  status text not null default 'counting',
  count_mode text not null default 'full_drawer',
  denomination_required boolean not null default false,
  next_shift_bank_cents integer not null default 0,
  denoms jsonb,
  counted_cents integer,
  turn_in_cents integer,
  bank_left_cents integer,
  over_short_cents integer,
  checks_cents integer not null default 0,
  money_orders_cents integer not null default 0,
  bag_number text,
  comment text,
  manager_note text,
  witness_employee_id text,
  witness_employee_name text,
  started_at_ms bigint not null,
  submitted_at_ms bigint,
  accepted_at_ms bigint,
  accepted_by_id text,
  accepted_by_name text,
  dropped_at_ms bigint,
  dropped_by_id text,
  voided_at_ms bigint,
  voided_by_id text,
  recount_of_id text,
  recount_count integer not null default 0,
  device_id text,
  ip text,
  cash_blocked boolean not null default true,
  opening_bank_corrected_cents integer,
  counterfeit_pulled_cents integer not null default 0,
  opening_bank_cents integer not null default 0,
  cash_sales_cents integer not null default 0,
  cash_refunds_cents integer not null default 0,
  paid_outs_cents integer not null default 0,
  paid_ins_cents integer not null default 0,
  drops_cents integer not null default 0,
  expected_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists till_closeouts_loc_status_idx
  on till_closeouts (location_id, status, started_at_ms desc);

create index if not exists till_closeouts_loc_emp_idx
  on till_closeouts (location_id, employee_id, started_at_ms desc);

create index if not exists till_closeouts_loc_drawer_idx
  on till_closeouts (location_id, drawer_id, started_at_ms desc);

alter table till_closeouts
  add column if not exists first_total_cents integer;

alter table till_closeouts
  add column if not exists first_over_short_cents integer;

alter table till_closeouts
  add column if not exists second_counted_cents integer;

alter table till_closeouts
  add column if not exists notify_sent_at_ms bigint;

alter table till_closeouts
  add column if not exists manager_ack_at_ms bigint;

alter table till_closeouts
  add column if not exists manager_ack_by_id text;

alter table till_closeouts
  add column if not exists manager_ack_by_name text;
