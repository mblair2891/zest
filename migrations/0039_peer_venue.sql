-- Peer venue: building wrapper with no host merchant.
-- host_entity_id is NULL on peer (and until a single-operator entity exists).
-- Selling entities carry KYC/MCC and onboarding status independently.

alter table locations
  add column if not exists host_entity_id text references operators (id) on delete set null;

create index if not exists locations_host_entity_idx
  on locations (host_entity_id)
  where host_entity_id is not null;

-- Peer houses never have a host merchant identity.
update locations
set host_entity_id = null
where operating_model = 'peer_venue';

alter table operators add column if not exists ein text;
alter table operators add column if not exists mcc text;
alter table operators add column if not exists owners_note text;

-- invited → in_progress → finix_pending → ready (legacy: draft/complete/expired still parse)
alter table operators add column if not exists entity_status text;

update operators
set entity_status = case
  when onboard_status = 'complete' then 'finix_pending'
  when onboard_status = 'in_progress' then 'in_progress'
  when onboard_status = 'invited' then 'invited'
  when onboard_status = 'expired' then 'invited'
  else 'invited'
end
where entity_status is null;
