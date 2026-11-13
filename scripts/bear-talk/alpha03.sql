-- Latest live reaction; expires quickly and does not create speech messages.
alter table public.bear_sessions add column reaction jsonb;
