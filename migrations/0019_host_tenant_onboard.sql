-- Host completeness + tenant (operator) self-serve invites.

alter table organizations add column if not exists host_status text not null default 'onboarding';
alter table organizations add column if not exists timezone text;
alter table organizations add column if not exists currency text not null default 'USD';
alter table organizations add column if not exists owner_contact_name text;
alter table organizations add column if not exists billing_contact_name text;
alter table organizations add column if not exists ops_contact_name text;
alter table organizations add column if not exists ops_contact_email text;
alter table organizations add column if not exists payments_mode text;
alter table organizations add column if not exists chargeback_fee_cents int;

alter table operators add column if not exists station_kind text not null default 'other';
alter table operators add column if not exists poc_name text;
alter table operators add column if not exists onboard_status text not null default 'draft';
alter table operators add column if not exists onboard_payload jsonb not null default '{}'::jsonb;
alter table operators add column if not exists menu_notes text;
alter table operators add column if not exists staff_notes text;

create table if not exists operator_invites (
  id text primary key,
  operator_id text not null references operators (id) on delete cascade,
  org_id text not null references organizations (id) on delete cascade,
  location_id text references locations (id) on delete cascade,
  email text,
  phone text,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  invited_by text,
  created_at timestamptz not null default now()
);

create index if not exists operator_invites_op_idx on operator_invites (operator_id, created_at desc);
create index if not exists operator_invites_org_idx on operator_invites (org_id);

-- Existing live hosts are ready to invite tenants.
update organizations o
set host_status = 'host_ready'
where o.host_status = 'onboarding'
  and (
    exists (select 1 from prospects p where p.org_id = o.id and p.status = 'live')
    or exists (select 1 from locations l where l.org_id = o.id)
  );
