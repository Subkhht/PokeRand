-- Esquema del ranking mundial del modo Infinite con cuentas de usuario.
-- Ejecuta este script en Supabase: SQL Editor → New Query

-- 1) Tabla de perfiles: el nombre de usuario del ranking vive aquí.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

-- 2) Al crear una cuenta (auth.users), se crea su perfil con el username
--    elegido en el formulario de registro (user_metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3) Tabla del ranking. user_id y player_name los rellena el servidor,
--    nunca el cliente, para que no se pueda suplantar el nombre.
create table if not exists public.infinite_leaderboard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_name text not null default 'Entrenador Anónimo',
  node integer not null,
  generation integer not null default 1,
  is_random boolean not null default false,
  duration_seconds integer not null default 0,
  team jsonb not null default '[]'::jsonb,
  challenges jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Migración si la tabla ya existía (versión sin cuentas):
alter table public.infinite_leaderboard add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.infinite_leaderboard add column if not exists is_random boolean not null default false;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'infinite_leaderboard' and column_name = 'route'
  ) then
    alter table public.infinite_leaderboard rename column route to node;
  end if;
end $$;
delete from public.infinite_leaderboard where user_id is null;
alter table public.infinite_leaderboard alter column user_id set not null;

-- 4) Trigger que fija la identidad del registro a partir de la sesión actual.
create or replace function public.set_leaderboard_identity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para registrar puntuaciones';
  end if;
  new.user_id := v_uid;
  new.player_name := (select username from public.profiles where id = v_uid);
  return new;
end;
$$;

drop trigger if exists infinite_leaderboard_set_identity on public.infinite_leaderboard;
create trigger infinite_leaderboard_set_identity
  before insert on public.infinite_leaderboard
  for each row execute procedure public.set_leaderboard_identity();

-- Índice para ordenar por nodo alcanzado
create index if not exists infinite_leaderboard_node_idx
  on public.infinite_leaderboard (node desc, duration_seconds asc);

-- 5) Seguridad (RLS):
alter table public.profiles enable row level security;
alter table public.infinite_leaderboard enable row level security;

drop policy if exists "Lectura pública de perfiles" on public.profiles;
create policy "Lectura pública de perfiles"
  on public.profiles for select
  using (true);

drop policy if exists "Edición del propio perfil" on public.profiles;
create policy "Edición del propio perfil"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Lectura pública del ranking" on public.infinite_leaderboard;
create policy "Lectura pública del ranking"
  on public.infinite_leaderboard for select
  using (true);

-- La inserción solo es válida si el registro pertenece al usuario autenticado.
-- El trigger ya fuerza user_id = auth.uid(), esta política lo refuerza.
drop policy if exists "Inserción autenticada de puntuaciones" on public.infinite_leaderboard;
create policy "Inserción autenticada de puntuaciones"
  on public.infinite_leaderboard for insert
  with check (auth.uid() = user_id);

-- 6) Permisos:
--    - Cualquiera puede leer el ranking y los usernames.
--    - Solo usuarios autenticados pueden insertar puntuaciones.
revoke all on public.infinite_leaderboard from anon;
revoke all on public.infinite_leaderboard from authenticated;
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;

grant select on public.infinite_leaderboard to anon;
grant select on public.infinite_leaderboard to authenticated;
grant insert on public.infinite_leaderboard to authenticated;

grant select on public.profiles to anon;
grant select on public.profiles to authenticated;
