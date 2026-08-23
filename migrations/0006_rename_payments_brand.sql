-- Brand rename: Zest Payments tables → Summex.
-- Fresh installs already get summex_* from 0004; this is a no-op then.

alter table if exists zest_merchants rename to summex_merchants;
alter table if exists zest_payments rename to summex_payments;
alter table if exists zest_deposits rename to summex_deposits;
