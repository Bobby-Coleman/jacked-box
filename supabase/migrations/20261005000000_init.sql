-- RiffRaff accounts: profiles, Premium entitlements, and live-voice usage.
-- Row level security: people can read (and edit) only their own rows. Entitlements are written
-- only by the RevenueCat webhook (service role), never by the app.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text check (char_length(name) <= 24),
  avatar jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  premium boolean not null default false,
  product_id text,
  store text,
  expires_at timestamptz,
  will_renew boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

create policy "entitlements: read own" on public.entitlements
  for select using (auth.uid() = user_id);

-- Live voice (ElevenLabs) usage, to keep costs bounded per person per day.
create table if not exists public.tts_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  chars integer not null default 0,
  primary key (user_id, day)
);

alter table public.tts_usage enable row level security;
-- No policies: only the tts function (service role) touches this table.

-- Atomically add characters and return the new daily total.
create or replace function public.add_tts_chars(p_user uuid, p_chars integer)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.tts_usage (user_id, day, chars)
  values (p_user, current_date, p_chars)
  on conflict (user_id, day) do update set chars = public.tts_usage.chars + excluded.chars
  returning chars;
$$;

revoke all on function public.add_tts_chars(uuid, integer) from public, anon, authenticated;

-- Cached voice clips (text -> mp3), so repeated lines cost nothing.
insert into storage.buckets (id, name, public)
values ('tts-cache', 'tts-cache', true)
on conflict (id) do nothing;
