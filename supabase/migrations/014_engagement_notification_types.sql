-- Extend notification types to support engagement/reminder notifications

-- Drop the old check constraint
alter table public.notifications
  drop constraint notifications_type_check;

-- Add the new check constraint with additional types
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('expense', 'settlement', 'group_settled', 'debt_reminder', 'activity_nudge', 'quicksplit_reminder', 'weekly_summary'));

-- Add indexes for common engagement queries
create index idx_notifications_type_unread on notifications(user_id, type, is_read);
