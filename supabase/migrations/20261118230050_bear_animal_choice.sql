-- Shared character choice; existing sessions continue with Bear.
-- Existing RLS and service-role-only table privileges remain in place.
alter table public.bear_sessions
  add column animal text not null default 'bear'
  constraint bear_sessions_animal_check check (animal in ('bear', 'goose', 'frog'));
