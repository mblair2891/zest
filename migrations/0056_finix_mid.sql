-- Merchant number (MID) stored with the Finix merchant id on the payment account.
alter table payment_accounts add column if not exists finix_mid text;
