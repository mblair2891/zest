-- First-party gift ledger. Codes are stored hashed. No third-party gift network.

create table if not exists gift_cards (
  id text primary key,
  location_id text not null references locations (id) on delete cascade,
  org_id text not null,
  code_hash text not null,
  code_last4 text not null,
  issuer_kind text not null,
  issuer_id text not null,
  issuer_name text not null,
  balance_cents integer not null default 0,
  original_balance_cents integer not null default 0,
  status text not null default 'active',
  source text not null default 'summex',
  issued_to_name text,
  issued_to_email text,
  sold_by_employee_id text,
  sold_by_operator_id text,
  issued_at_ms bigint not null,
  expires_at_ms bigint,
  breakage_processed_at_ms bigint,
  notes text,
  client_mutation_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists gift_cards_loc_hash_uidx
  on gift_cards (location_id, code_hash);

create index if not exists gift_cards_loc_issuer_idx
  on gift_cards (location_id, issuer_id, status);

create table if not exists gift_ledger (
  id text primary key,
  location_id text not null,
  org_id text not null,
  card_id text not null references gift_cards (id) on delete cascade,
  kind text not null,
  amount_cents integer not null default 0,
  issuer_id text,
  issuer_kind text,
  counterparty_id text,
  counterparty_kind text,
  tender text,
  check_id text,
  actor_id text,
  actor_name text,
  note text,
  at_ms bigint not null,
  client_mutation_id text
);

create index if not exists gift_ledger_loc_idx
  on gift_ledger (location_id, at_ms desc);

create index if not exists gift_ledger_card_idx
  on gift_ledger (card_id, at_ms);

create unique index if not exists gift_ledger_loc_mut_uidx
  on gift_ledger (location_id, client_mutation_id)
  where client_mutation_id is not null;
