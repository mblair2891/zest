-- State calendar review tasks and draft/labor bulletin fields.
-- Never auto-write venue tax or wage rows.

alter table reg_bulletins add column if not exists status text not null default 'published';
alter table reg_bulletins add column if not exists kind text not null default 'tax';
alter table reg_bulletins add column if not exists suggested_labor jsonb;
alter table reg_bulletins add column if not exists source_url text;

alter table reg_bulletin_acks add column if not exists apply_on date;

create table if not exists reg_review_tasks (
  id text primary key,
  state text not null,
  city text not null default '',
  window_mmdd text not null,
  window_date date not null,
  kinds text not null default 'labor',
  status text not null default 'open',
  source_url text,
  created_at timestamptz not null default now()
);

create unique index if not exists reg_review_tasks_window_uidx
  on reg_review_tasks (state, city, window_date);

create index if not exists reg_review_tasks_status_idx on reg_review_tasks (status);
