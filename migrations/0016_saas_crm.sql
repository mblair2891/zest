-- SaaS CRM: accounts, contacts, deals, activities, support tickets, software invoices.
-- Independent of POS card processing (Quantum Payments).

create table if not exists crm_accounts (
  id text primary key,
  name text not null,
  legal_name text,
  stage text not null default 'lead',
  owner_user_id text,
  tags jsonb not null default '[]'::jsonb,
  source text not null default 'inbound',
  prospect_id text references prospects (id) on delete set null,
  org_id text references organizations (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_accounts_stage_idx on crm_accounts (stage);
create index if not exists crm_accounts_owner_idx on crm_accounts (owner_user_id);
create index if not exists crm_accounts_org_idx on crm_accounts (org_id);
create unique index if not exists crm_accounts_prospect_uidx
  on crm_accounts (prospect_id);

create table if not exists crm_contacts (
  id text primary key,
  account_id text not null references crm_accounts (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text not null default 'other',
  created_at timestamptz not null default now()
);

create index if not exists crm_contacts_account_idx on crm_contacts (account_id);
create index if not exists crm_contacts_email_idx on crm_contacts (email);

create table if not exists crm_opportunities (
  id text primary key,
  account_id text not null references crm_accounts (id) on delete cascade,
  name text not null,
  amount_cents int not null default 0,
  plan_slug text,
  stage text not null default 'lead',
  close_date date,
  probability int not null default 10,
  prospect_id text references prospects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_opps_account_idx on crm_opportunities (account_id);
create index if not exists crm_opps_stage_idx on crm_opportunities (stage);

create table if not exists crm_activities (
  id text primary key,
  account_id text not null references crm_accounts (id) on delete cascade,
  contact_id text references crm_contacts (id) on delete set null,
  kind text not null default 'note',
  body text not null default '',
  due_at timestamptz,
  done_at timestamptz,
  actor_user_id text,
  created_at timestamptz not null default now()
);

create index if not exists crm_activities_account_idx on crm_activities (account_id, created_at desc);
create index if not exists crm_activities_due_idx on crm_activities (due_at)
  where done_at is null and due_at is not null;

create table if not exists support_tickets (
  id text primary key,
  account_id text references crm_accounts (id) on delete set null,
  org_id text references organizations (id) on delete set null,
  subject text not null,
  priority text not null default 'normal',
  status text not null default 'open',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx on support_tickets (status);
create index if not exists support_tickets_account_idx on support_tickets (account_id);

create table if not exists support_ticket_comments (
  id text primary key,
  ticket_id text not null references support_tickets (id) on delete cascade,
  body text not null,
  author_user_id text,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_comments_idx
  on support_ticket_comments (ticket_id, created_at);

create table if not exists saas_invoices (
  id text primary key,
  org_id text not null references organizations (id) on delete cascade,
  amount_cents int not null,
  status text not null default 'open',
  due_at timestamptz,
  paid_at timestamptz,
  stripe_invoice_id text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists saas_invoices_org_idx on saas_invoices (org_id);
create index if not exists saas_invoices_status_idx on saas_invoices (status);
