-- Recorded pay period on punches and shifts.
-- A later cycle change does not move rows that already have these stamps.

alter table location_punches
  add column if not exists pay_period_start timestamptz,
  add column if not exists pay_period_end timestamptz;

alter table location_shifts
  add column if not exists pay_period_start timestamptz,
  add column if not exists pay_period_end timestamptz;
