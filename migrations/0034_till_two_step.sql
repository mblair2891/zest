alter table pos_till_closeouts
  add column if not exists first_total_cents integer;

alter table pos_till_closeouts
  add column if not exists first_over_short_cents integer;

alter table pos_till_closeouts
  add column if not exists second_counted_cents integer;

alter table pos_till_closeouts
  add column if not exists notify_sent_at_ms bigint;

alter table pos_till_closeouts
  add column if not exists manager_ack_at_ms bigint;

alter table pos_till_closeouts
  add column if not exists manager_ack_by_id text;

alter table pos_till_closeouts
  add column if not exists manager_ack_by_name text;
