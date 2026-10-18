-- Staff payroll fields. The name column stays the display name.
-- Existing names split once: last word is the last name, the rest is the first name.

alter table location_staff add column if not exists first_name text not null default '';
alter table location_staff add column if not exists last_name text not null default '';
alter table location_staff add column if not exists display_name text not null default '';
alter table location_staff add column if not exists employee_number text;
alter table location_staff add column if not exists pay_rate_type text not null default 'hourly';
alter table location_staff add column if not exists pay_rate_cents integer not null default 0;
alter table location_staff add column if not exists hire_date date;
alter table location_staff add column if not exists employment_status text;
alter table location_staff add column if not exists email text not null default '';
alter table location_staff add column if not exists phone text not null default '';
alter table location_staff add column if not exists position text not null default '';

update location_staff
set
  first_name = case
    when position(' ' in btrim(name)) = 0 then btrim(name)
    else regexp_replace(btrim(name), '\s+\S+$', '')
  end,
  last_name = case
    when position(' ' in btrim(name)) = 0 then ''
    else regexp_replace(btrim(name), '^.*\s+', '')
  end
where btrim(coalesce(first_name, '')) = ''
  and btrim(coalesce(name, '')) <> '';

update location_staff
set employment_status = case when coalesce(active, true) then 'active' else 'inactive' end
where employment_status is null or btrim(employment_status) = '';

alter table location_staff alter column employment_status set default 'active';

create unique index if not exists location_staff_employee_number_uidx
  on location_staff (location_id, employee_number)
  where employee_number is not null and btrim(employee_number) <> '';
