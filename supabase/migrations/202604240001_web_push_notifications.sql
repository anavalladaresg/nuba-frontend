create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  platform character varying,
  user_agent text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  last_success_at timestamp with time zone,
  last_failure_at timestamp with time zone,
  failure_count integer not null default 0 check (failure_count >= 0)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

create index if not exists push_subscriptions_last_seen_at_idx
  on public.push_subscriptions(last_seen_at desc);

create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  work_session_id uuid references public.work_sessions(id) on delete cascade,
  push_subscription_id uuid references public.push_subscriptions(id) on delete cascade,
  reminder_type character varying not null
    check (reminder_type in ('START', 'PAUSE', 'STOP', 'SMART_STOP', 'TEST')),
  dedupe_key character varying not null,
  delivered boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

create index if not exists notification_delivery_logs_user_id_sent_at_idx
  on public.notification_delivery_logs(user_id, sent_at desc);

create unique index if not exists notification_delivery_logs_subscription_dedupe_idx
  on public.notification_delivery_logs(push_subscription_id, dedupe_key);
