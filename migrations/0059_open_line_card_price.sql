-- Open Food and Open Liquor store the typed amount as the card unit.
-- Regular menu items leave this null and keep live cash-discount rounding.
alter table pos_check_items add column if not exists card_price_cents integer;
