-- Platform email outbox. When no API key is set, rows stay logged_only
-- so operators can still see quote mail without a provider.

create table if not exists email_outbox (
  id text primary key,
  to_addr text not null,
  subject text not null,
  html text,
  text_body text not null,
  kind text not null,
  status text not null default 'logged_only',
  provider text,
  prospect_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_outbox_created_idx on email_outbox (created_at desc);
create index if not exists email_outbox_prospect_idx on email_outbox (prospect_id);
