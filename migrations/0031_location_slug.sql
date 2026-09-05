-- Unique venue slug → {slug}.summex.app (path fallback /v/{slug}).
-- One-time wildcard DNS. No per-tenant records.

alter table locations
  add column if not exists slug text;

update locations
set slug = trim(both '-' from lower(regexp_replace(coalesce(name, 'venue'), '[^a-zA-Z0-9]+', '-', 'g')))
  || '-' || right(replace(id, '-', ''), 4)
where slug is null or btrim(slug) = '';

create unique index if not exists locations_slug_uidx
  on locations (slug)
  where slug is not null and btrim(slug) <> '';
