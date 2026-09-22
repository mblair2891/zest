-- Original logo bytes. Screen + receipt derivatives live on locations.setup.brandLogos
-- so a Publish / configVersion bump can reach stations without the 2MB original.

create table if not exists brand_logos (
  location_id text not null references locations (id) on delete cascade,
  operator_id text not null default '',
  mime text not null,
  original_b64 text not null,
  updated_at timestamptz not null default now(),
  primary key (location_id, operator_id)
);
