-- Additive upgrade; existing sessions and clients continue to work.
alter table public.bear_sessions add column voice_state jsonb not null default '{}', add column stop_id uuid;
alter table public.bear_messages add column voice text not null default '', add column rate numeric not null default 0.88 check(rate between 0.5 and 1.5);
