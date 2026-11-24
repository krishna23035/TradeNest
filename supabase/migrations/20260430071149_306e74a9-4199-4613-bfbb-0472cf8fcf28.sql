-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles viewable by owner" on public.profiles for select using (auth.uid() = id);
create policy "Profiles insertable by owner" on public.profiles for insert with check (auth.uid() = id);
create policy "Profiles updatable by owner" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Watchlist
create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  name text,
  created_at timestamptz not null default now(),
  unique(user_id, symbol)
);
alter table public.watchlist enable row level security;
create policy "Watchlist select own" on public.watchlist for select using (auth.uid() = user_id);
create policy "Watchlist insert own" on public.watchlist for insert with check (auth.uid() = user_id);
create policy "Watchlist delete own" on public.watchlist for delete using (auth.uid() = user_id);

-- Portfolio
create table public.portfolio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  name text,
  quantity numeric not null default 0,
  avg_price numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.portfolio enable row level security;
create policy "Portfolio select own" on public.portfolio for select using (auth.uid() = user_id);
create policy "Portfolio insert own" on public.portfolio for insert with check (auth.uid() = user_id);
create policy "Portfolio update own" on public.portfolio for update using (auth.uid() = user_id);
create policy "Portfolio delete own" on public.portfolio for delete using (auth.uid() = user_id);

-- Predictions history
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  predicted_price numeric,
  current_price numeric,
  decision text,
  confidence numeric,
  rationale text,
  created_at timestamptz not null default now()
);
alter table public.predictions enable row level security;
create policy "Predictions select own" on public.predictions for select using (auth.uid() = user_id);
create policy "Predictions insert own" on public.predictions for insert with check (auth.uid() = user_id);