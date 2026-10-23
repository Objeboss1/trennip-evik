-- One diary per logged-in user. Run this once in the Supabase SQL editor
-- for project oygfbystyotkqjcajgot. After that, the site syncs each account
-- across devices. Until then the browser keeps a private copy per account.

create table if not exists public.paevikud (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint paevikud_data_object check (jsonb_typeof(data) = 'object')
);

alter table public.paevikud enable row level security;

grant select, insert, update, delete on table public.paevikud to authenticated;

drop policy if exists "read own diary" on public.paevikud;
create policy "read own diary"
  on public.paevikud
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert own diary" on public.paevikud;
create policy "insert own diary"
  on public.paevikud
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own diary" on public.paevikud;
create policy "update own diary"
  on public.paevikud
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own diary" on public.paevikud;
create policy "delete own diary"
  on public.paevikud
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_paevik_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists paevikud_updated_at on public.paevikud;
create trigger paevikud_updated_at
  before update on public.paevikud
  for each row
  execute function public.set_paevik_updated_at();

revoke all on function public.set_paevik_updated_at() from public, anon, authenticated;
