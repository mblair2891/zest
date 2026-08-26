-- Server-authoritative POS floor of record.
-- Open checks, operator-tagged lines, ODS tickets/events, table status, payments.
-- Devices for a location share this floor; Zustand is a cache.

create table if not exists pos_checks (
  id text primary key,
  location_id text not null references locations (id) on delete cascade,
  org_id text not null,
  table_id text,
  tab_name text,
  number integer not null,
  type text not null default 'dine_in',
  status text not null default 'open',
  server_id text not null default '',
  server_name text not null default '',
  guest_count integer not null default 1,
  discount_percent integer not null default 0,
  discount_cents integer not null default 0,
  auto_grat_applied boolean not null default false,
  service_charge_cents integer not null default 0,
  note text,
  check_printed_at_ms bigint,
  merged_table_ids jsonb not null default '[]'::jsonb,
  client_mutation_id text,
  created_at_ms bigint not null,
  updated_at_ms bigint not null,
  closed_at_ms bigint
);

create index if not exists pos_checks_loc_status_idx
  on pos_checks (location_id, status, updated_at_ms desc);

create unique index if not exists pos_checks_loc_mut_uidx
  on pos_checks (location_id, client_mutation_id)
  where client_mutation_id is not null;

create table if not exists pos_check_items (
  id text primary key,
  check_id text not null references pos_checks (id) on delete cascade,
  location_id text not null,
  menu_item_id text,
  name text not null,
  operator_id text,
  vendor_name text,
  quantity integer not null default 1,
  unit_price_cents integer not null default 0,
  modifiers jsonb not null default '[]'::jsonb,
  note text,
  seat integer,
  course text not null default 'entree',
  station text not null default 'kitchen',
  -- sent | started | ready | delivered  (draft/held before send)
  item_status text not null default 'draft',
  sent boolean not null default false,
  held boolean not null default false,
  voided boolean not null default false,
  comped boolean not null default false,
  discount_cents integer not null default 0,
  tax_exempt boolean not null default false,
  ticket_id text,
  created_at_ms bigint not null,
  updated_at_ms bigint not null,
  fired_at_ms bigint,
  started_at_ms bigint,
  ready_at_ms bigint,
  delivered_at_ms bigint
);

create index if not exists pos_check_items_check_idx
  on pos_check_items (check_id);

create index if not exists pos_check_items_loc_op_idx
  on pos_check_items (location_id, operator_id);

create table if not exists pos_tickets (
  id text primary key,
  location_id text not null,
  check_id text not null references pos_checks (id) on delete cascade,
  order_number integer not null,
  table_label text not null default '',
  server_name text not null default '',
  server_id text,
  station text not null,
  operator_id text,
  vendor_name text,
  status text not null default 'new',
  course text not null default 'entree',
  items jsonb not null default '[]'::jsonb,
  created_at_ms bigint not null,
  started_at_ms bigint,
  ready_at_ms bigint,
  bumped_at_ms bigint
);

create index if not exists pos_tickets_loc_station_idx
  on pos_tickets (location_id, station, status);

create index if not exists pos_tickets_check_idx
  on pos_tickets (check_id);

create table if not exists pos_ticket_events (
  id text primary key,
  location_id text not null,
  ticket_id text not null,
  check_id text not null,
  kind text not null,
  actor_id text,
  actor_name text,
  operator_id text,
  at_ms bigint not null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists pos_ticket_events_ticket_idx
  on pos_ticket_events (ticket_id, at_ms);

create index if not exists pos_ticket_events_loc_idx
  on pos_ticket_events (location_id, at_ms desc);

create table if not exists pos_table_status (
  location_id text not null references locations (id) on delete cascade,
  table_id text not null,
  status text not null default 'empty',
  check_id text,
  server_id text,
  guest_count integer,
  seated_at_ms bigint,
  status_since_ms bigint not null,
  updated_at_ms bigint not null,
  primary key (location_id, table_id)
);

create table if not exists pos_check_payments (
  id text primary key,
  check_id text not null references pos_checks (id) on delete cascade,
  location_id text not null,
  method text not null,
  amount_cents integer not null,
  tip_cents integer not null default 0,
  tendered_cents integer,
  change_cents integer,
  last4 text,
  gift_card_code text,
  house_account_id text,
  employee_id text not null default '',
  processor text,
  charge_brand text,
  sandbox boolean not null default false,
  client_mutation_id text,
  at_ms bigint not null
);

create index if not exists pos_check_payments_check_idx
  on pos_check_payments (check_id);

create unique index if not exists pos_check_payments_loc_mut_uidx
  on pos_check_payments (location_id, client_mutation_id)
  where client_mutation_id is not null;
