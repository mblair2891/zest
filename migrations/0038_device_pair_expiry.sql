-- One-time station pair codes expire. Owner regenerates from the Devices row.

alter table location_devices
  add column if not exists claim_expires_at timestamptz;

create index if not exists location_devices_claim_exp_idx
  on location_devices (claim_expires_at)
  where claim_code is not null;
