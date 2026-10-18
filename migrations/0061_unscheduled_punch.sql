-- Unscheduled clock-in flag. Hours still count. The hours file marks the punch.

alter table location_punches
  add column if not exists unscheduled boolean not null default false;
