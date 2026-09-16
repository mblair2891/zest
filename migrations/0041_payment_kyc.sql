-- Per-entity KYC snapshot on the payments account. No SSN, PAN, or full account numbers.
alter table payment_accounts
  add column if not exists kyc jsonb not null default '{}'::jsonb;
