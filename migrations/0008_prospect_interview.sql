-- AI / guided interview on Stage A prospect intake.

alter table prospects add column if not exists interview_free_text text;
alter table prospects add column if not exists interview_messages jsonb not null default '[]'::jsonb;
alter table prospects add column if not exists interview_recommendation jsonb;
alter table prospects add column if not exists interview_source text;
alter table prospects add column if not exists interview_status text not null default 'none';
