-- Reuse plastic: close a spent life, issue a new ledger under the same printed number.
-- Current-life uniqueness replaces the old always-unique (location, code_hash).

alter table gift_cards add column if not exists pan_hash text;
alter table gift_cards add column if not exists pin_hash text;
alter table gift_cards add column if not exists replaces_id text;
alter table gift_cards add column if not exists replaced_by_id text;
alter table gift_cards add column if not exists closed_at_ms bigint;
alter table gift_cards add column if not exists close_reason text;

drop index if exists gift_cards_loc_hash_uidx;

create unique index if not exists gift_cards_loc_hash_current_uidx
  on gift_cards (location_id, code_hash)
  where status is distinct from 'closed';

create unique index if not exists gift_cards_pan_current_uidx
  on gift_cards (pan_hash)
  where pan_hash is not null and status is distinct from 'closed';

create index if not exists gift_cards_last4_pin_idx
  on gift_cards (code_last4, pin_hash)
  where pin_hash is not null and status is distinct from 'closed';
