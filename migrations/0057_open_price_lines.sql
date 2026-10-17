-- Open Food, Open Liquor, and open-price lines keep the typed amount on reload.
alter table pos_check_items add column if not exists open_price boolean not null default false;
