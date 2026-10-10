-- One row per incoming Finix webhook, including rejected deliveries.
create table if not exists finix_webhook_log (
  id text primary key,
  event_type text not null,
  result text not null,
  event_id text,
  created_at timestamptz not null default now()
);

create index if not exists finix_webhook_log_created_idx
  on finix_webhook_log (created_at desc);
