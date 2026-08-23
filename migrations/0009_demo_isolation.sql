-- Prospect demos are first-class rows, never mixed into tenant lists, billing, or stats.

alter table organizations
  add column if not exists is_demo boolean not null default false;

alter table locations
  add column if not exists is_demo boolean not null default false;

create index if not exists organizations_is_demo_idx on organizations (is_demo);
create index if not exists locations_is_demo_idx on locations (is_demo);
