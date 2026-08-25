-- Location training → scheduled_live → live. Existing rows stay live.
alter table locations
  add column if not exists lifecycle_status text not null default 'live';
alter table locations
  add column if not exists go_live_at timestamptz;
alter table locations
  add column if not exists training_track_inventory boolean not null default false;

create index if not exists locations_lifecycle_idx on locations (lifecycle_status);
