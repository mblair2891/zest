-- Location-scoped memberships + per-user active tenant context.
-- Shared-app model: tenant is chosen AFTER login, never via subdomain.

alter table memberships
  add column if not exists location_id text references locations (id) on delete cascade;

create index if not exists memberships_location_idx on memberships (location_id);

-- Org-wide (location_id null) or per-location membership. One row per pair.
drop index if exists memberships_user_org_uidx;
create unique index if not exists memberships_user_org_loc_uidx
  on memberships (user_id, org_id, coalesce(location_id, ''));

create table if not exists active_contexts (
  user_id text primary key references "user" ("id") on delete cascade,
  org_id text not null references organizations (id) on delete cascade,
  location_id text references locations (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists active_contexts_org_idx on active_contexts (org_id);
