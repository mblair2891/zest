-- Location-admin logins from Tenants → Users (not only contract-signed invites).
-- prospect_id stays for pipeline invites; org-scoped rows may have a null prospect.

alter table subscriber_logins
  alter column prospect_id drop not null;

alter table subscriber_logins
  add column if not exists org_id text references organizations (id) on delete cascade;

alter table subscriber_logins
  add column if not exists location_id text references locations (id) on delete set null;

drop index if exists subscriber_logins_prospect_uidx;
create unique index if not exists subscriber_logins_prospect_uidx
  on subscriber_logins (prospect_id)
  where prospect_id is not null;

create index if not exists subscriber_logins_org_idx on subscriber_logins (org_id);
create index if not exists subscriber_logins_location_idx on subscriber_logins (location_id);
