-- Tagged partner-demo tenants. Not public is_demo sites.
-- Factory reset / cleanup can target is_partner_demo without hiding
-- the org from Tenants (is_demo stays false).

alter table organizations
  add column if not exists is_partner_demo boolean not null default false;

alter table locations
  add column if not exists is_partner_demo boolean not null default false;

create index if not exists organizations_is_partner_demo_idx
  on organizations (is_partner_demo)
  where is_partner_demo = true;

create index if not exists locations_is_partner_demo_idx
  on locations (is_partner_demo)
  where is_partner_demo = true;
