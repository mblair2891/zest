-- Quantum Payments live capture metadata. Never store PAN or CVV.

alter table summex_payments
  add column if not exists processor text not null default 'quantum_payments';

alter table summex_payments
  add column if not exists processor_payment_id text;

alter table summex_payments
  add column if not exists capture_mode text not null default 'sandbox';

alter table summex_payments
  add column if not exists check_id text;

alter table summex_payments
  add column if not exists reader_id text;

alter table summex_payments
  add column if not exists host_brand text;

alter table summex_payments
  add column if not exists client_mutation_id text;

alter table summex_payments
  add column if not exists error text;

create unique index if not exists summex_payments_loc_mut_uidx
  on summex_payments (location_id, client_mutation_id)
  where client_mutation_id is not null;

create index if not exists summex_payments_processor_idx
  on summex_payments (processor_payment_id)
  where processor_payment_id is not null;
