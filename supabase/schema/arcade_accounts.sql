-- Shared accounts: one private manual save per game and a shared preference record.
create table public.arcade_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9][a-z0-9-]{0,63}$')
    constraint arcade_saves_supported_game check (game_id in ('colonization','park-builder','rivas-shapes')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 1048576),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
create table public.arcade_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 8192),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.arcade_saves enable row level security;
alter table public.arcade_preferences enable row level security;
revoke all on public.arcade_saves, public.arcade_preferences from anon;
grant select, insert, update, delete on public.arcade_saves, public.arcade_preferences to authenticated;
create policy "Read own saves" on public.arcade_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own saves" on public.arcade_saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own saves" on public.arcade_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own saves" on public.arcade_saves for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Read own preferences" on public.arcade_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own preferences" on public.arcade_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own preferences" on public.arcade_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own preferences" on public.arcade_preferences for delete to authenticated using ((select auth.uid()) = user_id);

-- Compare-and-swap prevents a stale device from replacing a newer save.
-- These are invoker functions: all table ownership policies still apply.
create function public.put_arcade_save(p_game_id text, p_payload jsonb, p_expected_revision bigint default null)
returns public.arcade_saves language plpgsql security invoker set search_path = public, pg_temp as $$
declare saved public.arcade_saves; owner_id uuid := auth.uid();
begin
  if owner_id is null then raise insufficient_privilege using message = 'Sign in to save to your account'; end if;
  if p_expected_revision is null then
    insert into public.arcade_saves(user_id, game_id, payload) values (owner_id, p_game_id, p_payload)
    on conflict (user_id, game_id) do nothing returning * into saved;
  else
    update public.arcade_saves set payload = p_payload, revision = revision + 1, updated_at = clock_timestamp()
    where user_id = owner_id and game_id = p_game_id and revision = p_expected_revision returning * into saved;
  end if;
  if saved.user_id is null then raise sqlstate '40001' using message = 'Cloud save changed on another device. Refresh and review it before trying again.'; end if;
  return saved;
end; $$;
create function public.put_arcade_preferences(p_payload jsonb, p_expected_revision bigint default null)
returns public.arcade_preferences language plpgsql security invoker set search_path = public, pg_temp as $$
declare saved public.arcade_preferences; owner_id uuid := auth.uid();
begin
  if owner_id is null then raise insufficient_privilege using message = 'Sign in to sync settings'; end if;
  if p_expected_revision is null then
    insert into public.arcade_preferences(user_id, payload) values (owner_id, p_payload)
    on conflict (user_id) do nothing returning * into saved;
  else
    update public.arcade_preferences set payload = p_payload, revision = revision + 1, updated_at = clock_timestamp()
    where user_id = owner_id and revision = p_expected_revision returning * into saved;
  end if;
  if saved.user_id is null then raise sqlstate '40001' using message = 'Cloud settings changed on another device. Refresh and review them first.'; end if;
  return saved;
end; $$;
revoke all on function public.put_arcade_save(text, jsonb, bigint) from public, anon;
revoke all on function public.put_arcade_preferences(jsonb, bigint) from public, anon;
grant execute on function public.put_arcade_save(text, jsonb, bigint) to authenticated;
grant execute on function public.put_arcade_preferences(jsonb, bigint) to authenticated;
