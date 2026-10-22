-- Venue-chosen password scope for a location user.
-- location = whole venue. entity = one selling entity (operator_id).

alter table memberships
  add column if not exists admin_scope text;
