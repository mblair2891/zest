-- Accepted till-to-till transfers frozen on the close snapshot.

alter table till_closeouts add column if not exists transfers_in_cents integer not null default 0;
alter table till_closeouts add column if not exists transfers_out_cents integer not null default 0;
alter table till_closeouts add column if not exists transfer_lines jsonb not null default '[]'::jsonb;
