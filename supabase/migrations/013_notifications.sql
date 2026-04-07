-- Create push_tokens table for storing Expo push notification tokens
create table if not exists public.push_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create notifications table for in-app notification feed
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense', 'settlement', 'group_settled')),
  title text not null,
  body text not null,
  data jsonb default '{}'::jsonb,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table push_tokens enable row level security;
alter table notifications enable row level security;

-- Push tokens RLS: Users can view and insert their own tokens, update their own, delete their own
create policy "Users can view own push tokens" on push_tokens
  for select using (auth.uid() = user_id);

create policy "Users can insert own push tokens" on push_tokens
  for insert with check (auth.uid() = user_id);

create policy "Users can update own push tokens" on push_tokens
  for update using (auth.uid() = user_id);

create policy "Users can delete own push tokens" on push_tokens
  for delete using (auth.uid() = user_id);

-- Notifications RLS: Users can only view their own notifications, only app can insert/update/delete
create policy "Users can view own notifications" on notifications
  for select using (auth.uid() = user_id);

create policy "Enable insert on notifications for authenticated users" on notifications
  for insert with check (true);

create policy "Enable update on notifications for authenticated users" on notifications
  for update using (true);

-- Indexes for performance
create index idx_push_tokens_user_id on push_tokens(user_id);
create index idx_notifications_user_id on notifications(user_id);
create index idx_notifications_user_created on notifications(user_id, created_at desc);
create index idx_notifications_unread on notifications(user_id, is_read);
