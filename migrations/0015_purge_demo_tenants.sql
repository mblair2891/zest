-- Remove all is_demo tenants. Idempotent. Never deletes platform_admin
-- (memberships.role = platform_admin and org_id is null).

delete from locations
  where coalesce(is_demo, false) = true
     or id like 'loc_demo_%'
     or id = 'loc_hall';

delete from organizations
  where coalesce(is_demo, false) = true
     or id like 'org_demo%'
     or slug like 'demo-%';
