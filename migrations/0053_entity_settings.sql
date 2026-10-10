-- Entity-owned settings. Venue name, address, and timezone stay on the location.
alter table operators add column if not exists menu_display_name text;
alter table operators add column if not exists tip_percents jsonb;
alter table operators add column if not exists pin_length smallint;
