-- Application id sent with a Finix connect. The username and password stay off this table.
alter table station_activity_log
  add column if not exists application_id text not null default '';
