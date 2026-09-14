-- Venue admin Users tab may show the 4-digit station PIN (not a password).
-- Stations still authenticate on pin_hash. Disabled rows keep pin_display.
alter table location_staff add column if not exists pin_display text;
