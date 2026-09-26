-- Menu files for one selling entity. Analyze reads this row. It does not take an unsaved blob.

create table if not exists menu_uploads (
  id text primary key,
  org_id text not null default '',
  location_id text not null references locations (id) on delete cascade,
  entity_id text not null default '',
  file_name text not null,
  mime text not null,
  byte_size integer not null,
  body_b64 text not null,
  created_at timestamptz not null default now()
);

create index if not exists menu_uploads_entity_idx
  on menu_uploads (location_id, entity_id, created_at desc);
