-- Multi-tenant control plane: orgs, memberships, locations, invites.

create table if not exists organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  venue_default_type text not null default 'restaurant',
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  org_id text references organizations (id) on delete cascade,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create unique index if not exists memberships_user_org_uidx
  on memberships (user_id, org_id)
  where org_id is not null;

create unique index if not exists memberships_platform_admin_uidx
  on memberships (user_id)
  where role = 'platform_admin' and org_id is null;

create index if not exists memberships_org_idx on memberships (org_id);
create index if not exists memberships_user_idx on memberships (user_id);

create table if not exists locations (
  id text primary key,
  org_id text not null references organizations (id) on delete cascade,
  name text not null,
  venue_type text not null,
  timezone text not null default 'America/Los_Angeles',
  status text not null default 'active',
  enabled_packages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists locations_org_idx on locations (org_id);

create table if not exists invites (
  id text primary key,
  org_id text not null references organizations (id) on delete cascade,
  email text not null,
  role text not null,
  token text not null unique,
  invited_by text,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invites_org_idx on invites (org_id);
create index if not exists invites_email_idx on invites (email);
