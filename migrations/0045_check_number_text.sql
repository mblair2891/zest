-- Daily check ids (260922-T1-03) are text. Legacy integer rows become their digit string.
alter table pos_checks
  alter column number type text using number::text;

alter table pos_tickets
  alter column order_number type text using order_number::text;
