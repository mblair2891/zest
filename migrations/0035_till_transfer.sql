-- In-shift till-to-till cash transfers. Cash moves at accept, not at request.

create table if not exists pos_till_transfers (
  id text primary key,
  location_id text not null,
  org_id text not null default '',
  status text not null default 'pending',
  from_sink_key text not null,
  from_till_name text not null default '',
  from_employee_id text not null default '',
  from_employee_name text not null default '',
  to_sink_key text not null,
  to_till_name text not null default '',
  to_employee_id text not null default '',
  to_employee_name text not null default '',
  amount_cents integer not null,
  requested_mix jsonb not null default '{}'::jsonb,
  handed_mix jsonb not null default '{}'::jsonb,
  note text,
  requested_at_ms bigint not null,
  resolved_at_ms bigint,
  reverse_of_id text,
  reverse_id text,
  reversed_by_id text,
  reversed_by_name text,
  reprint_count integer not null default 0,
  print_ok boolean not null default false,
  last_printed_at_ms bigint,
  accepted_by_id text,
  accepted_by_name text,
  updated_at_ms bigint not null,
  device_id text,
  user_agent text,
  ip text
);

create index if not exists pos_till_transfers_loc_idx
  on pos_till_transfers (location_id, requested_at_ms desc);

create index if not exists pos_till_transfers_from_idx
  on pos_till_transfers (location_id, from_sink_key, status);

create index if not exists pos_till_transfers_to_idx
  on pos_till_transfers (location_id, to_sink_key, status);

create table if not exists pos_till_transfer_audit (
  id text primary key,
  location_id text not null,
  org_id text not null default '',
  transfer_id text not null,
  at_ms bigint not null,
  kind text not null,
  employee_id text not null default '',
  employee_name text not null default '',
  detail text not null default ''
);

create index if not exists pos_till_transfer_audit_xfer_idx
  on pos_till_transfer_audit (transfer_id, at_ms desc);

create index if not exists pos_till_transfer_audit_loc_idx
  on pos_till_transfer_audit (location_id, at_ms desc);
