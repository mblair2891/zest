-- Location Finix onboarding form. Processor tokens only.
-- finix_onboarding_state is PROVISIONING, APPROVED, UPDATE_REQUESTED, or REJECTED.

alter table payment_accounts
  add column if not exists finix_onboarding_state text;
