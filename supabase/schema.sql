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

-- Una sola entrada por usuario y generación: se conserva el mejor resultado.
-- Primero se eliminan duplicados (se queda la mejor), luego se añade la restricción.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'infinite_leaderboard_user_gen_unique'
  ) then
    delete from public.infinite_leaderboard a
    using public.infinite_leaderboard b
    where a.user_id = b.user_id
      and a.generation = b.generation
      and (a.node < b.node or (a.node = b.node and a.id > b.id));
    alter table public.infinite_leaderboard
      add constraint infinite_leaderboard_user_gen_unique unique (user_id, generation);
  end if;
end $$;

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

-- Función para registrar puntuaciones: el servidor toma user_id y player_name
-- de la sesión, y si el usuario ya tiene una run de esa generación, solo la
-- actualiza cuando la nueva alcanza un nodo más lejano (se conserva el mejor).
create or replace function public.submit_infinite_score(
  p_node integer,
  p_generation integer,
  p_is_random boolean default false,
  p_duration_seconds integer default 0,
  p_team jsonb default '[]'::jsonb,
  p_challenges jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_best integer;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para registrar puntuaciones';
  end if;

  select node into v_best
  from public.infinite_leaderboard
  where user_id = v_uid and generation = p_generation;

  if v_best is null then
    insert into public.infinite_leaderboard
      (user_id, player_name, node, generation, is_random, duration_seconds, team, challenges)
    values (
      v_uid,
      (select username from public.profiles where id = v_uid),
      p_node,
      p_generation,
      coalesce(p_is_random, false),
      coalesce(p_duration_seconds, 0),
      coalesce(p_team, '[]'::jsonb),
      coalesce(p_challenges, '[]'::jsonb)
    );
    return jsonb_build_object('created', true, 'best', p_node, 'is_new_best', true);
  end if;

  if p_node > v_best then
    update public.infinite_leaderboard
    set node = p_node,
        player_name = (select username from public.profiles where id = v_uid),
        is_random = coalesce(p_is_random, false),
        duration_seconds = coalesce(p_duration_seconds, 0),
        team = coalesce(p_team, '[]'::jsonb),
        challenges = coalesce(p_challenges, '[]'::jsonb)
    where user_id = v_uid and generation = p_generation;
    return jsonb_build_object('created', false, 'best', p_node, 'is_new_best', true);
  end if;

  return jsonb_build_object('created', false, 'best', v_best, 'is_new_best', false);
end;
$$;

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

-- La puntuación se registra SOLO a través de la función submit_infinite_score
-- (que conserva el mejor resultado por generación). No se permite insertar
-- directamente sobre la tabla para no saltarse esa lógica.
drop policy if exists "Inserción autenticada de puntuaciones" on public.infinite_leaderboard;

-- 6) Permisos:
--    - Cualquiera puede leer el ranking y los usernames.
--    - Solo usuarios autenticados pueden registrar puntuaciones (vía RPC).
revoke all on public.infinite_leaderboard from anon;
revoke all on public.infinite_leaderboard from authenticated;
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;

grant select on public.infinite_leaderboard to anon;
grant select on public.infinite_leaderboard to authenticated;

grant select on public.profiles to anon;
grant select on public.profiles to authenticated;

grant execute on function public.submit_infinite_score to authenticated;

-- ============================================================================
-- MODO COOPERATIVO
-- ============================================================================
-- Ejecuta este bloque tras el esquema del ranking (los perfiles ya existen).
-- Las tres tablas se manipulan SOLO a través de las funciones RPC (security
-- definer), que toman la identidad de la sesión con auth.uid().

create table if not exists public.coop_sessions (
  code text primary key,
  seed text not null,
  gen integer not null default 1,
  difficulty text not null default 'medium',
  player_a_id uuid not null references public.profiles(id) on delete cascade,
  player_b_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','active','finished')),
  result text check (result in ('won','lost')),
  finished_a boolean not null default false,
  finished_b boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.coop_sessions add column if not exists finished_a boolean not null default false;
alter table public.coop_sessions add column if not exists finished_b boolean not null default false;

create table if not exists public.coop_progress (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.coop_sessions(code) on delete cascade,
  node integer not null,
  a_ready boolean not null default false,
  b_ready boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (code, node)
);

create table if not exists public.coop_trades (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.coop_sessions(code) on delete cascade,
  node integer not null,
  depositor uuid not null references public.profiles(id) on delete cascade,
  offer jsonb not null default '{}'::jsonb,
  claimed boolean not null default false,
  claimed_by uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Intercambio mutuo: cada jugador ofrece un Pokémon u objeto y ambos deben
-- pulsar "Intercambiar" para que se complete automáticamente.
create table if not exists public.coop_exchanges (
  code text not null references public.coop_sessions(code) on delete cascade,
  node integer not null,
  a_offer jsonb,
  b_offer jsonb,
  a_ready boolean not null default false,
  b_ready boolean not null default false,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (code, node)
);

-- Crear sesión: devuelve el código de 6 letras.
create or replace function public.create_coop_session(p_seed text, p_gen integer, p_difficulty text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_code text;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  -- Limpieza: borra sesiones huérfanas o terminadas con más de 24h para que
  -- la tabla no se llene.
  delete from public.coop_sessions
  where created_at < now() - interval '24 hours'
    and (status = 'finished' or player_b_id is null);
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into public.coop_sessions (code, seed, gen, difficulty, player_a_id, status)
  values (v_code, p_seed, p_gen, coalesce(p_difficulty, 'medium'), v_uid, 'waiting');
  return v_code;
end;
$$;

-- Unirse: valida que quede hueco y rellena player_b.
create or replace function public.join_coop_session(p_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sess public.coop_sessions%rowtype;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into v_sess from public.coop_sessions where code = upper(p_code);
  if not found then raise exception 'Sesión no encontrada'; end if;
  if v_sess.status = 'finished' then raise exception 'La sesión ya terminó'; end if;
  if v_sess.player_a_id = v_uid then
    return row_to_json(v_sess);
  end if;
  if v_sess.player_b_id is not null then
    raise exception 'La sesión ya tiene 2 jugadores';
  end if;
  update public.coop_sessions set player_b_id = v_uid, status = 'active'
  where code = v_sess.code;
  select * into v_sess from public.coop_sessions where code = v_sess.code;
  return row_to_json(v_sess);
end;
$$;

create or replace function public.get_coop_session(p_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_sess public.coop_sessions%rowtype;
begin
  select * into v_sess from public.coop_sessions where code = upper(p_code);
  if not found then raise exception 'Sesión no encontrada'; end if;
  return row_to_json(v_sess);
end;
$$;

-- Marcar nodo completado para el jugador actual.
create or replace function public.mark_node_ready(p_code text, p_node integer)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sess public.coop_sessions%rowtype;
  v_role text;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into v_sess from public.coop_sessions where code = upper(p_code);
  if not found then raise exception 'Sesión no encontrada'; end if;
  if v_uid = v_sess.player_a_id then
    v_role := 'a';
  elsif v_uid = v_sess.player_b_id then
    v_role := 'b';
  else
    raise exception 'No eres parte de la sesión';
  end if;
  insert into public.coop_progress (code, node, a_ready, b_ready)
  values (v_sess.code, p_node, false, false)
  on conflict (code, node) do nothing;
  if v_role = 'a' then
    update public.coop_progress set a_ready = true, updated_at = now()
    where code = v_sess.code and node = p_node;
  else
    update public.coop_progress set b_ready = true, updated_at = now()
    where code = v_sess.code and node = p_node;
  end if;
  return true;
end;
$$;

-- Estado del nodo + estado de la sesión (para saber si el compañero terminó).
create or replace function public.get_coop_progress(p_code text, p_node integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_sess public.coop_sessions%rowtype;
  v_prog public.coop_progress%rowtype;
begin
  select * into v_sess from public.coop_sessions where code = upper(p_code);
  if not found then raise exception 'Sesión no encontrada'; end if;
  select * into v_prog from public.coop_progress where code = v_sess.code and node = p_node;
  return jsonb_build_object(
    'a_ready', coalesce(v_prog.a_ready, false),
    'b_ready', coalesce(v_prog.b_ready, false),
    'finished', v_sess.status = 'finished',
    'result', v_sess.result
  );
end;
$$;

create or replace function public.deposit_trade(p_code text, p_node integer, p_offer jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  insert into public.coop_trades (code, node, depositor, offer)
  values (upper(p_code), p_node, v_uid, coalesce(p_offer, '{}'::jsonb));
  return true;
end;
$$;

-- Devuelve solo los intercambios sin reclamar del nodo.
create or replace function public.get_coop_trades(p_code text, p_node integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb)
    from (
      select id, node, depositor, offer, claimed, claimed_by
      from public.coop_trades
      where code = upper(p_code) and node = p_node and claimed = false
      order by created_at asc
    ) t
  ), '[]'::jsonb);
end;
$$;

-- Recoge un intercambio depositado por el compañero y devuelve su oferta.
create or replace function public.claim_trade(p_trade_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trade public.coop_trades%rowtype;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into v_trade from public.coop_trades where id = p_trade_id;
  if not found then raise exception 'Intercambio no encontrado'; end if;
  if v_trade.depositor = v_uid then raise exception 'No puedes recoger tu propio intercambio'; end if;
  if v_trade.claimed then raise exception 'Ya fue reclamado'; end if;
  update public.coop_trades set claimed = true, claimed_by = v_uid
  where id = p_trade_id;
  return v_trade.offer;
end;
$$;

-- Cierra la sesión (partida terminada para uno de los jugadores).
-- p_result: 'won' si quien termina ganó la run, 'lost' si perdió/abandonó.
-- Cuando AMBOS jugadores han terminado, la sesión se elimina (cascade a
-- progreso e intercambios) para que la base de datos no se llene.
create or replace function public.finish_coop_session(p_code text, p_result text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sess public.coop_sessions%rowtype;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into v_sess from public.coop_sessions where code = upper(p_code);
  if not found then
    return false;
  end if;
  if v_uid = v_sess.player_a_id then
    update public.coop_sessions
    set status = 'finished', result = p_result, finished_a = true
    where code = v_sess.code;
  elsif v_uid = v_sess.player_b_id then
    update public.coop_sessions
    set status = 'finished', result = p_result, finished_b = true
    where code = v_sess.code;
  else
    return false;
  end if;
  if exists (
    select 1 from public.coop_sessions
    where code = v_sess.code and finished_a and finished_b
  ) then
    delete from public.coop_sessions where code = v_sess.code;
  end if;
  return true;
end;
$$;

-- Cancela y elimina la sesión al instante (p. ej. al pulsar "Cancelar" en el
-- menú antes de empezar, o si el jugador abandona sin compañero).
create or replace function public.cancel_coop_session(p_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sess public.coop_sessions%rowtype;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into v_sess from public.coop_sessions where code = upper(p_code);
  if not found then return false; end if;
  if v_uid <> v_sess.player_a_id and v_uid <> v_sess.player_b_id then return false; end if;
  delete from public.coop_sessions where code = v_sess.code;
  return true;
end;
$$;

-- Reinicia la sesión (misma semilla, mismo código): borra progreso e intercambios.
-- Devuelve false si la sesión ya no existe (ambos terminaron y fue eliminada).
create or replace function public.reset_coop_session(p_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.coop_trades where code = upper(p_code);
  delete from public.coop_exchanges where code = upper(p_code);
  delete from public.coop_progress where code = upper(p_code);
  update public.coop_sessions set status = 'active', result = null,
         finished_a = false, finished_b = false
  where code = upper(p_code);
  return FOUND;
end;
$$;

-- Envía tu oferta y te marca listo para el intercambio del nodo.
create or replace function public.submit_exchange_offer(p_code text, p_node integer, p_offer jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sess public.coop_sessions%rowtype;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into v_sess from public.coop_sessions where code = upper(p_code);
  if not found then raise exception 'Sesión no encontrada'; end if;
  if v_uid = v_sess.player_a_id then
    insert into public.coop_exchanges (code, node, a_offer, a_ready)
    values (v_sess.code, p_node, coalesce(p_offer, '{}'::jsonb), true)
    on conflict (code, node)
    do update set a_offer = excluded.a_offer, a_ready = true, updated_at = now();
  elsif v_uid = v_sess.player_b_id then
    insert into public.coop_exchanges (code, node, b_offer, b_ready)
    values (v_sess.code, p_node, coalesce(p_offer, '{}'::jsonb), true)
    on conflict (code, node)
    do update set b_offer = excluded.b_offer, b_ready = true, updated_at = now();
  else
    raise exception 'No eres parte de la sesión';
  end if;
  return true;
end;
$$;

-- Estado del intercambio del nodo.
create or replace function public.get_exchange(p_code text, p_node integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ex public.coop_exchanges%rowtype;
begin
  select * into v_ex from public.coop_exchanges where code = upper(p_code) and node = p_node;
  return jsonb_build_object(
    'a_offer', v_ex.a_offer,
    'b_offer', v_ex.b_offer,
    'a_ready', coalesce(v_ex.a_ready, false),
    'b_ready', coalesce(v_ex.b_ready, false),
    'completed', coalesce(v_ex.completed, false)
  );
end;
$$;

-- Completa el intercambio cuando ambos están listos y devuelve la oferta
-- del compañero. Idempotente: ambos jugadores reciben la oferta del otro.
create or replace function public.complete_exchange(p_code text, p_node integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sess public.coop_sessions%rowtype;
  v_ex public.coop_exchanges%rowtype;
  v_ready boolean;
  v_partner_offer jsonb;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into v_sess from public.coop_sessions where code = upper(p_code);
  if not found then raise exception 'Sesión no encontrada'; end if;
  select * into v_ex from public.coop_exchanges where code = v_sess.code and node = p_node;
  if v_ex.code is null then
    raise exception 'No hay intercambio en este nodo';
  end if;
  v_ready := (v_ex.a_ready and v_ex.b_ready);
  if not v_ready then
    return null;
  end if;
  if not v_ex.completed then
    update public.coop_exchanges set completed = true, updated_at = now()
    where code = v_sess.code and node = p_node;
  end if;
  if v_uid = v_sess.player_a_id then
    v_partner_offer := v_ex.b_offer;
  else
    v_partner_offer := v_ex.a_offer;
  end if;
  return v_partner_offer;
end;
$$;

-- Seguridad: solo acceso vía RPC, sin lectura/escritura directa a las tablas.
alter table public.coop_sessions enable row level security;
alter table public.coop_progress enable row level security;
alter table public.coop_trades enable row level security;
alter table public.coop_exchanges enable row level security;

revoke all on public.coop_sessions from anon, authenticated;
revoke all on public.coop_progress from anon, authenticated;
revoke all on public.coop_trades from anon, authenticated;
revoke all on public.coop_exchanges from anon, authenticated;

grant execute on function public.create_coop_session to authenticated;
grant execute on function public.join_coop_session to authenticated;
grant execute on function public.get_coop_session to authenticated;
grant execute on function public.mark_node_ready to authenticated;
grant execute on function public.get_coop_progress to authenticated;
grant execute on function public.deposit_trade to authenticated;
grant execute on function public.get_coop_trades to authenticated;
grant execute on function public.claim_trade to authenticated;
grant execute on function public.finish_coop_session to authenticated;
grant execute on function public.reset_coop_session to authenticated;
grant execute on function public.submit_exchange_offer to authenticated;
grant execute on function public.get_exchange to authenticated;
grant execute on function public.complete_exchange to authenticated;
grant execute on function public.cancel_coop_session to authenticated;
