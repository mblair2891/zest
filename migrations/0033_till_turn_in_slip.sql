-- Turn-in bag slip print status. Count is saved even if the printer fails.

alter table till_closeouts add column if not exists slip_print_ok boolean not null default false;
alter table till_closeouts add column if not exists slip_printed_at_ms bigint;
alter table till_closeouts add column if not exists slip_reprint_count integer not null default 0;
alter table till_closeouts add column if not exists print_override_reason text;
alter table till_closeouts add column if not exists print_override_by_id text;
alter table till_closeouts add column if not exists print_override_by_name text;
