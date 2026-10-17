-- Void and comp reasons stay on the line and do not replace a guest note.
alter table pos_check_items add column if not exists action_reason text;
