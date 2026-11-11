create table public.bear_sessions (
 id uuid primary key, code_hash text unique not null, tablet_hash text not null,
 controller_hash text, pair_until timestamptz not null, expires_at timestamptz not null,
 tablet_seen timestamptz, controller_seen timestamptz
);
create table public.bear_messages (
 id bigint generated always as identity primary key,
 session_id uuid not null references public.bear_sessions(id) on delete cascade,
 request_id uuid not null unique, text text not null check(length(text) <= 500),
 lang text not null, emotion text not null, status text not null default 'queued',
 created_at timestamptz not null default now()
);
create index bear_messages_session_idx on public.bear_messages(session_id,id);
create table public.bear_limits (key text primary key, hits integer not null, until_at timestamptz not null);
alter table public.bear_sessions enable row level security;
alter table public.bear_messages enable row level security;
alter table public.bear_limits enable row level security;
revoke all on public.bear_sessions, public.bear_messages, public.bear_limits from anon, authenticated;
grant all on public.bear_sessions, public.bear_messages, public.bear_limits to service_role;
grant usage, select on sequence public.bear_messages_id_seq to service_role;
create function public.bear_rate_limit(p_key text, p_max integer) returns boolean
language sql security invoker set search_path = '' as $$
 insert into public.bear_limits as l(key,hits,until_at) values(p_key,1,now()+interval '1 minute')
 on conflict(key) do update set hits=case when l.until_at<now() then 1 else l.hits+1 end,
 until_at=case when l.until_at<now() then now()+interval '1 minute' else l.until_at end
 returning hits<=p_max;
$$;
revoke all on function public.bear_rate_limit(text,integer) from public, anon, authenticated;
grant execute on function public.bear_rate_limit(text,integer) to service_role;
