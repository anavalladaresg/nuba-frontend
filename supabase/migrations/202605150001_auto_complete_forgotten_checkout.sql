alter table public.user_work_settings
  add column if not exists auto_complete_forgotten_checkout boolean not null default false,
  add column if not exists auto_complete_grace_minutes integer not null default 30;

alter table public.user_work_settings
  drop constraint if exists user_work_settings_auto_complete_grace_minutes_check;

alter table public.user_work_settings
  add constraint user_work_settings_auto_complete_grace_minutes_check
  check (auto_complete_grace_minutes >= 0 and auto_complete_grace_minutes <= 720);
