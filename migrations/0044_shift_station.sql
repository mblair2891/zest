-- Optional station / section / break on scheduled shifts.

alter table location_shifts add column if not exists station text;
alter table location_shifts add column if not exists section text;
alter table location_shifts add column if not exists break_minutes integer;
