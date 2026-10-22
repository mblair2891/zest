-- Production phase on a kitchen or bar ticket. Status stays the milestone
-- (new, in_progress, ready, bumped). Phase names the step inside that milestone.
alter table pos_tickets add column if not exists phase text;
