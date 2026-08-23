-- Platform admin bootstrap metadata. Better Auth owns "user" / "account";
-- this table flags the SaaS control-plane admin and first-login password reset.
-- Do not put tenant/restaurant data here.

create table if not exists platform_admin (
  user_id text primary key references "user" ("id") on delete cascade,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists platform_admin_user_id_idx on platform_admin (user_id);
