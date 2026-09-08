-- Venue-owner logins provisioned when the contract is signed.
-- Not platform admin. One-time password must change on first login.

create table if not exists subscriber_logins (
  user_id text primary key,
  prospect_id text not null references prospects (id) on delete cascade,
  username text not null,
  must_change_password boolean not null default true,
  invite_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriber_logins_prospect_uidx
  on subscriber_logins (prospect_id);

create unique index if not exists subscriber_logins_username_uidx
  on subscriber_logins (lower(username));

create index if not exists subscriber_logins_user_idx
  on subscriber_logins (user_id);
