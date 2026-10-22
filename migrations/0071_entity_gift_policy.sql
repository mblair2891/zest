-- Per-entity gift card choices. Venue rules stay on the location setup.
alter table operators add column if not exists gift_policy jsonb;
