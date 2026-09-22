-- Archive vs hard-delete a selling entity. Location contact is operational.
-- Checklist rows are items, not a JSON blob.

alter table operators add column if not exists archived_at timestamptz;
alter table locations add column if not exists archived_at timestamptz;
alter table locations add column if not exists contact_name text;
alter table locations add column if not exists contact_email text;
alter table locations add column if not exists contact_phone text;

create table if not exists onboarding_check_items (
  id text primary key,
  location_id text not null references locations (id) on delete cascade,
  operator_id text not null default '',
  item_key text not null,
  label text not null,
  required boolean not null default false,
  status text not null default 'not_started',
  updated_at timestamptz not null default now(),
  unique (location_id, operator_id, item_key)
);

create index if not exists onboarding_check_items_loc_idx
  on onboarding_check_items (location_id, operator_id);
