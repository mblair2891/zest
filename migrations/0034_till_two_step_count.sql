-- Two-step blind count: first total, then denomination on mismatch.

alter table till_closeouts add column if not exists first_counted_cents integer;
alter table till_closeouts add column if not exists first_submitted_at_ms bigint;
alter table till_closeouts add column if not exists denom_counted_cents integer;
alter table till_closeouts add column if not exists manager_ack_at_ms bigint;
alter table till_closeouts add column if not exists manager_ack_by_id text;
alter table till_closeouts add column if not exists notify_sent_at_ms bigint;
