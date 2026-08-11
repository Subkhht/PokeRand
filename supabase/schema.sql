-- Esquema del ranking mundial del modo Infinite con cuentas de usuario.
-- Ejecuta este script en Supabase: SQL Editor → New Query

-- 1) Tabla de perfiles: el nombre de usuario del ranking vive aquí.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

-- La unicidad del username es insensible a mayúsculas/minúsculas: dos cuentas
-- no pueden compartir nombre aunque difieran en mayúsculas ("Pikachu" vs "pikachu").
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

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
alter table public.coop_sessions add column if not exists restart_requested boolean not null default false;

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
-- 'finished' es true si ALGUNO de los dos jugadores ha terminado su run, para
-- liberar al compañero que espera en un nodo (el estado 'finished' global solo
-- se pone cuando ambos han terminado).
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
    'finished', v_sess.status = 'finished' or v_sess.finished_a or v_sess.finished_b,
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
-- Marca como terminada la run SOLO del jugador que llama (finished_a/finished_b)
-- y pone la sesión en 'finished' cuando AMBOS han terminado. Así el compañero
-- que aún juega puede seguir, y nadie puede reiniciar antes de tiempo.
-- La sesión NO se borra: así el botón de "Reiniciar" puede volver a usarla con
-- la misma semilla sin ir al menú. La limpieza la hace la TTL de 24h de
-- create_coop_session y el borrado inmediato al cancelar.
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
  if not found then return false; end if;
  if v_uid <> v_sess.player_a_id and v_uid <> v_sess.player_b_id then return false; end if;

  if v_uid = v_sess.player_a_id then
    update public.coop_sessions
    set finished_a = true,
        result = p_result,
        status = case when v_sess.finished_b then 'finished' else status end
    where code = v_sess.code;
  else
    update public.coop_sessions
    set finished_b = true,
        result = p_result,
        status = case when v_sess.finished_a then 'finished' else status end
    where code = v_sess.code;
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
-- Devuelve 'blocked' si el compañero aún no ha terminado su run (no se puede
-- empezar de nuevo hasta que ambos terminen), 'missing' si la sesión ya no
-- existe, y 'ok' si el reinicio se completó.
-- Nota: cambió el tipo de retorno (boolean → text), así que se elimina la
-- versión anterior antes de recrearla.
drop function if exists public.reset_coop_session(text);
create or replace function public.reset_coop_session(p_code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sess public.coop_sessions%rowtype;
  v_other_finished boolean;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into v_sess from public.coop_sessions where code = upper(p_code);
  if not found then return 'missing'; end if;
  if v_uid <> v_sess.player_a_id and v_uid <> v_sess.player_b_id then return 'forbidden'; end if;

  -- Sin compañero (player_b null) siempre se puede reiniciar.
  if v_sess.player_b_id is null then
    v_other_finished := true;
  elsif v_uid = v_sess.player_a_id then
    v_other_finished := v_sess.finished_b;
  else
    v_other_finished := v_sess.finished_a;
  end if;

  if not v_other_finished then return 'blocked'; end if;

  delete from public.coop_trades where code = upper(p_code);
  delete from public.coop_exchanges where code = upper(p_code);
  delete from public.coop_progress where code = upper(p_code);
  update public.coop_sessions set status = 'active', result = null,
         finished_a = false, finished_b = false,
         restart_requested = true
  where code = upper(p_code);
  return 'ok';
end;
$$;

-- Marca como "leído" el reinicio del compañero: el jugador que detecta la señal
-- la limpia para que no se vuelva a disparar.
create or replace function public.clear_coop_restart(p_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  update public.coop_sessions set restart_requested = false
  where code = upper(p_code);
  return true;
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

-- Cancela la oferta del jugador actual (al salir del nodo sin completar el
-- intercambio) para que el intercambio no pueda completarse con una oferta
-- ya devuelta. Devuelve false si el intercambio ya se completó (la oferta
-- está comprometida con el compañero) o si no existe la fila.
create or replace function public.cancel_exchange_offer(p_code text, p_node integer)
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
  if v_uid = v_sess.player_a_id then
    update public.coop_exchanges
    set a_offer = null, a_ready = false, updated_at = now()
    where code = v_sess.code and node = p_node and completed = false;
    if not found then return false; end if;
  elsif v_uid = v_sess.player_b_id then
    update public.coop_exchanges
    set b_offer = null, b_ready = false, updated_at = now()
    where code = v_sess.code and node = p_node and completed = false;
    if not found then return false; end if;
  else
    return false;
  end if;
  return true;
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
grant execute on function public.cancel_exchange_offer to authenticated;
grant execute on function public.cancel_coop_session to authenticated;

-- ============================================================================
-- MODO PVP 1vs1
-- Tablas y funciones para el combate entre dos jugadores reales. Igual que
-- el cooperativo: identidad vía auth.uid(), solo acceso mediante RPC.
-- ============================================================================

create table if not exists public.pvp_matches (
  id uuid primary key default gen_random_uuid(),
  code text,
  status text not null default 'waiting' check (status in ('waiting','active','finished')),
  player_a_id uuid not null references public.profiles(id) on delete cascade,
  player_b_id uuid references public.profiles(id) on delete cascade,
  team_a jsonb not null default '[]'::jsonb,
  team_b jsonb not null default '[]'::jsonb,
  result text check (result in ('a','b')),
  created_at timestamptz not null default now()
);

create index if not exists pvp_matches_waiting_idx
  on public.pvp_matches (status) where status = 'waiting' and player_b_id is null;

-- Un único estado compartido por partida: ambos clientes leen/escriben aquí.
create table if not exists public.pvp_state (
  match_id uuid primary key references public.pvp_matches(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  turn integer not null default 0,
  action_a jsonb,
  action_b jsonb,
  timer_by text,
  timer_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.pvp_state add column if not exists timer_by text;
alter table public.pvp_state add column if not exists timer_until timestamptz;

-- Construye el estado inicial de la partida a partir de los equipos guardados.
create or replace function public.init_pvp_state(p_match_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_match public.pvp_matches%rowtype;
  v_a_revealed jsonb;
  v_b_revealed jsonb;
  v_a_name text;
  v_b_name text;
begin
  select * into v_match from public.pvp_matches where id = p_match_id;
  select coalesce(jsonb_agg(i = 0), '[]'::jsonb)
    from generate_series(0, greatest(0, jsonb_array_length(v_match.team_a) - 1)) i
    into v_a_revealed;
  select coalesce(jsonb_agg(i = 0), '[]'::jsonb)
    from generate_series(0, greatest(0, jsonb_array_length(v_match.team_b) - 1)) i
    into v_b_revealed;
  select username into v_a_name from public.profiles where id = v_match.player_a_id;
  select username into v_b_name from public.profiles where id = v_match.player_b_id;
  return jsonb_build_object(
    'phase', 'picking',
    'winner', null::text,
    'switchFor', null::text,
    'log', '[]'::jsonb,
    'a', jsonb_build_object('team', coalesce(v_match.team_a, '[]'::jsonb), 'active', 0, 'revealed', v_a_revealed, 'username', v_a_name),
    'b', jsonb_build_object('team', coalesce(v_match.team_b, '[]'::jsonb), 'active', 0, 'revealed', v_b_revealed, 'username', v_b_name)
  );
end;
$$;

-- Crea una sala personalizada (jugador A) y devuelve el código.
create or replace function public.create_pvp_room(p_team jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_id uuid;
  v_name text;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  delete from public.pvp_matches
  where created_at < now() - interval '24 hours'
    and (status = 'finished' or player_b_id is null);
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into public.pvp_matches (code, player_a_id, team_a, status)
  values (v_code, v_uid, coalesce(p_team, '[]'::jsonb), 'waiting')
  returning id into v_id;
  select username into v_name from public.profiles where id = v_uid;
  return jsonb_build_object('match_id', v_id, 'code', v_code, 'is_host', true, 'opponent_name', null::text, 'player_name', v_name);
end;
$$;

-- Emparejamiento online: intenta unirse a una sala abierta; si no hay ninguna,
-- crea una nueva y espera. Al unirse, rellena el equipo B, activa la partida
-- y crea el estado inicial.
create or replace function public.find_pvp_opponent(p_team jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.pvp_matches%rowtype;
  v_code text;
  v_id uuid;
  v_a_name text;
  v_b_name text;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  delete from public.pvp_matches
  where created_at < now() - interval '24 hours'
    and (status = 'finished' or player_b_id is null);
  select * into v_match from public.pvp_matches
  where status = 'waiting' and player_b_id is null and player_a_id <> v_uid
  order by created_at asc
  limit 1;
  if not found then
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    insert into public.pvp_matches (code, player_a_id, team_a, status)
    values (v_code, v_uid, coalesce(p_team, '[]'::jsonb), 'waiting')
    returning id into v_id;
    select username into v_b_name from public.profiles where id = v_uid;
    return jsonb_build_object('match_id', v_id, 'code', v_code, 'is_host', true, 'opponent_name', null::text, 'player_name', v_b_name, 'joined', false);
  end if;
  update public.pvp_matches
  set player_b_id = v_uid, team_b = coalesce(p_team, '[]'::jsonb), status = 'active'
  where id = v_match.id;
  insert into public.pvp_state (match_id, state, turn, action_a, action_b)
  values (v_match.id, public.init_pvp_state(v_match.id), 0, null, null);
  select username into v_a_name from public.profiles where id = v_match.player_a_id;
  select username into v_b_name from public.profiles where id = v_uid;
  return jsonb_build_object('match_id', v_match.id, 'code', v_match.code, 'is_host', false, 'opponent_name', v_a_name, 'player_name', v_b_name, 'joined', true);
end;
$$;

-- Entrar a una sala personalizada mediante código.
create or replace function public.join_pvp_room(p_code text, p_team jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.pvp_matches%rowtype;
  v_a_name text;
  v_b_name text;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into v_match from public.pvp_matches where code = upper(p_code);
  if not found then raise exception 'Sala no encontrada'; end if;
  if v_match.status = 'finished' then raise exception 'La sala ya terminó'; end if;
  if v_match.player_b_id is not null then raise exception 'La sala ya tiene 2 jugadores'; end if;
  if v_match.player_a_id = v_uid then
    select username into v_a_name from public.profiles where id = v_uid;
    return jsonb_build_object('match_id', v_match.id, 'code', v_match.code, 'is_host', true, 'opponent_name', null::text, 'player_name', v_a_name);
  end if;
  update public.pvp_matches
  set player_b_id = v_uid, team_b = coalesce(p_team, '[]'::jsonb), status = 'active'
  where id = v_match.id;
  insert into public.pvp_state (match_id, state, turn, action_a, action_b)
  values (v_match.id, public.init_pvp_state(v_match.id), 0, null, null);
  select username into v_a_name from public.profiles where id = v_match.player_a_id;
  select username into v_b_name from public.profiles where id = v_uid;
  return jsonb_build_object('match_id', v_match.id, 'code', v_match.code, 'is_host', false, 'opponent_name', v_a_name, 'player_name', v_b_name, 'joined', true);
end;
$$;

-- Datos de la partida (sin el estado de combate).
create or replace function public.get_pvp_match(p_match_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', m.id,
    'code', m.code,
    'status', m.status,
    'player_a_id', m.player_a_id,
    'player_b_id', m.player_b_id,
    'result', m.result,
    'created_at', m.created_at,
    'a_name', (select username from public.profiles where id = m.player_a_id),
    'b_name', (select username from public.profiles where id = m.player_b_id),
    'a_elo', coalesce((select e.elo from public.pvp_elo e where e.user_id = m.player_a_id), 0),
    'b_elo', coalesce((select e.elo from public.pvp_elo e where e.user_id = m.player_b_id), 0)
  )
  into v_result
  from public.pvp_matches m where m.id = p_match_id;
  if not found then raise exception 'Partida no encontrada'; end if;
  return v_result;
end;
$$;

-- Estado compartido de la partida (estado + turno + acciones pendientes).
create or replace function public.get_pvp_state(p_match_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object('state', s.state, 'turn', s.turn, 'action_a', s.action_a, 'action_b', s.action_b, 'timer_by', s.timer_by, 'timer_until', s.timer_until)
  into v_result
  from public.pvp_state s where s.match_id = p_match_id;
  if not found then raise exception 'La partida aún no ha comenzado'; end if;
  return v_result;
end;
$$;

-- Registra la acción del jugador actual para el turno indicado.
create or replace function public.submit_pvp_action(p_match_id uuid, p_action jsonb, p_turn integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_side text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select case when m.player_a_id = auth.uid() then 'a' when m.player_b_id = auth.uid() then 'b' end
  into v_side
  from public.pvp_matches m where m.id = p_match_id;
  if v_side is null then raise exception 'No participas en esta partida'; end if;
  -- Cualquier acción realizada mientras el timer está activo lo resetea a
  -- inactivo (el que espera deja de esperar porque el rival ya actuó).
  if v_side = 'a' then
    update public.pvp_state set action_a = p_action, timer_by = null, timer_until = null, updated_at = now()
    where match_id = p_match_id and turn = p_turn;
  else
    update public.pvp_state set action_b = p_action, timer_by = null, timer_until = null, updated_at = now()
    where match_id = p_match_id and turn = p_turn;
  end if;
  if not found then raise exception 'El turno ya cambió, recarga el estado'; end if;
  select jsonb_build_object('state', s.state, 'turn', s.turn, 'action_a', s.action_a, 'action_b', s.action_b, 'timer_by', s.timer_by, 'timer_until', s.timer_until)
  into v_result
  from public.pvp_state s where s.match_id = p_match_id;
  return v_result;
end;
$$;

-- Guarda el estado resuelto del turno y avanza al siguiente. Guardado seguro:
-- solo se aplica si el turno aún no se ha resuelto (evita carreras entre
-- los dos clientes, que pueden resolver localmente).
create or replace function public.resolve_pvp_turn(p_match_id uuid, p_state jsonb, p_turn integer)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if not exists (
    select 1 from public.pvp_matches m
    where m.id = p_match_id and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid())
  ) then
    raise exception 'No participas en esta partida';
  end if;
  update public.pvp_state
  set state = p_state, turn = p_turn + 1, action_a = null, action_b = null, updated_at = now()
  where match_id = p_match_id and turn = p_turn;
  return found;
end;
$$;

-- Marca la partida como terminada con un ganador.
create or replace function public.finish_pvp_match(p_match_id uuid, p_result text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if not exists (
    select 1 from public.pvp_matches m
    where m.id = p_match_id and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid())
  ) then
    raise exception 'No participas en esta partida';
  end if;
  update public.pvp_matches set status = 'finished', result = p_result where id = p_match_id;
  return found;
end;
$$;

-- Rendición: el rival gana.
create or replace function public.forfeit_pvp_match(p_match_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_side text;
  v_opp text;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select case when m.player_a_id = auth.uid() then 'a' when m.player_b_id = auth.uid() then 'b' end
  into v_side
  from public.pvp_matches m where m.id = p_match_id;
  if v_side is null then raise exception 'No participas en esta partida'; end if;
  v_opp := case when v_side = 'a' then 'b' else 'a' end;
  update public.pvp_matches set status = 'finished', result = v_opp where id = p_match_id;
  update public.pvp_state
  set state = state || jsonb_build_object('phase', 'finished', 'winner', v_opp)
  where match_id = p_match_id;
  return true;
end;
$$;

-- Abandona una sala sin empezar (o una partida en curso) eliminándola.
create or replace function public.cancel_pvp_match(p_match_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.pvp_matches
  where id = p_match_id and (player_a_id = auth.uid() or player_b_id = auth.uid());
  return found;
end;
$$;

-- Cancela la acción que el jugador actual envió en el turno indicado (si aún
-- no se ha resuelto el turno). Permite rectificar antes de que el rival actúe.
create or replace function public.clear_pvp_action(p_match_id uuid, p_turn integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_side text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select case when m.player_a_id = auth.uid() then 'a' when m.player_b_id = auth.uid() then 'b' end
  into v_side
  from public.pvp_matches m where m.id = p_match_id;
  if v_side is null then raise exception 'No participas en esta partida'; end if;
  if v_side = 'a' then
    update public.pvp_state set action_a = null, updated_at = now()
    where match_id = p_match_id and turn = p_turn;
  else
    update public.pvp_state set action_b = null, updated_at = now()
    where match_id = p_match_id and turn = p_turn;
  end if;
  if not found then raise exception 'El turno ya cambió, recarga el estado'; end if;
  select jsonb_build_object('state', s.state, 'turn', s.turn, 'action_a', s.action_a, 'action_b', s.action_b, 'timer_by', s.timer_by, 'timer_until', s.timer_until)
  into v_result
  from public.pvp_state s where s.match_id = p_match_id;
  return v_result;
end;
$$;

-- Inicia la cuenta atrás de 5 minutos. El jugador que la pulsa está esperando:
-- si el rival no actúa antes de que acabe, este jugador gana. Si el rival
-- (o cualquier jugador) actúa, submit_pvp_action la resetea a inactiva.
create or replace function public.start_pvp_timer(p_match_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_side text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select case when m.player_a_id = auth.uid() then 'a' when m.player_b_id = auth.uid() then 'b' end
  into v_side
  from public.pvp_matches m where m.id = p_match_id and m.status = 'active';
  if v_side is null then raise exception 'No participas en esta partida o no ha comenzado'; end if;
  update public.pvp_state
  set timer_by = v_side, timer_until = now() + interval '5 minutes', updated_at = now()
  where match_id = p_match_id;
  select jsonb_build_object('state', s.state, 'turn', s.turn, 'action_a', s.action_a, 'action_b', s.action_b, 'timer_by', s.timer_by, 'timer_until', s.timer_until)
  into v_result
  from public.pvp_state s where s.match_id = p_match_id;
  return v_result;
end;
$$;

-- Si la cuenta atrás venció y el rival no actuó, el que estaba esperando gana.
-- Idempotente: devuelve false si no hay timer activo o aún no expiró.
create or replace function public.expire_pvp_timer(p_match_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_timer_by text;
  v_until timestamptz;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select timer_by, timer_until into v_timer_by, v_until
  from public.pvp_state where match_id = p_match_id;
  if v_timer_by is null or v_until is null then return false; end if;
  if v_until > now() then return false; end if;
  update public.pvp_matches set status = 'finished', result = v_timer_by
  where id = p_match_id;
  update public.pvp_state
  set state = state || jsonb_build_object('phase', 'finished', 'winner', v_timer_by),
      timer_by = null, timer_until = null, updated_at = now()
  where match_id = p_match_id;
  return true;
end;
$$;

-- ============================================================================
-- ELO PvP
-- Ranking de jugadores con puntos Elo (empiezan en 0). Se otorgan al ganador
-- cuando termina la partida, según cuántos de sus Pokémon quedaron debilitados:
--   0 debilitados → +20, 1 → +18, 2 → +16, 3 → +14, 4 → +12, 5+ → +10
-- ============================================================================

create table if not exists public.pvp_elo (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  elo integer not null default 0,
  wins integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.pvp_matches add column if not exists elo_awarded boolean not null default false;

-- Elo del jugador actual.
create or replace function public.get_pvp_elo()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.pvp_elo%rowtype;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into v_row from public.pvp_elo where user_id = auth.uid();
  if not found then return jsonb_build_object('elo', 0, 'wins', 0); end if;
  return jsonb_build_object('elo', v_row.elo, 'wins', v_row.wins);
end;
$$;

-- Tabla de posiciones Elo (top 50).
create or replace function public.get_pvp_elo_leaderboard()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  into v_result
  from (
    select p.username as player_name, e.elo, e.wins
    from public.pvp_elo e
    join public.profiles p on p.id = e.user_id
    order by e.elo desc, e.wins desc
    limit 50
  ) t;
  return v_result;
end;
$$;

-- Otorga Elo al ganador de una partida terminada. Idempotente: solo se aplica
-- la primera vez (flag elo_awarded). Devuelve los puntos otorgados.
create or replace function public.award_pvp_elo(p_match_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_match public.pvp_matches%rowtype;
  v_state public.pvp_state%rowtype;
  v_winner text;
  v_team jsonb;
  v_fainted integer := 0;
  v_points integer;
  v_winner_id uuid;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into v_match from public.pvp_matches where id = p_match_id;
  if not found then raise exception 'Partida no encontrada'; end if;
  if v_match.elo_awarded then return null; end if;
  if v_match.status <> 'finished' or v_match.result is null then return null; end if;
  v_winner := v_match.result;
  v_winner_id := case when v_winner = 'a' then v_match.player_a_id else v_match.player_b_id end;
  select * into v_state from public.pvp_state where match_id = p_match_id;
  v_team := case when v_winner = 'a' then v_state.state->'a'->'team' else v_state.state->'b'->'team' end;
  select count(*) into v_fainted
  from jsonb_array_elements(coalesce(v_team, '[]'::jsonb)) p
  where coalesce((p->>'hp')::int, 1) <= 0;
  v_points := case
    when v_fainted <= 0 then 20
    when v_fainted = 1 then 18
    when v_fainted = 2 then 16
    when v_fainted = 3 then 14
    when v_fainted = 4 then 12
    else 10
  end;
  update public.pvp_matches set elo_awarded = true where id = p_match_id;
  insert into public.pvp_elo (user_id, elo, wins)
  values (v_winner_id, v_points, 1)
  on conflict (user_id) do update set
    elo = public.pvp_elo.elo + v_points,
    wins = public.pvp_elo.wins + 1,
    updated_at = now();
  return jsonb_build_object('points', v_points);
end;
$$;

-- Revancha: reutiliza el mismo código. Si hay una sala en espera con ese
-- código, se une; si no, la crea (así el primero se queda esperando).
create unique index if not exists pvp_matches_waiting_code_idx
  on public.pvp_matches (code) where status = 'waiting' and player_b_id is null;

create or replace function public.rematch_pvp_room(p_code text, p_team jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(p_code);
  v_match public.pvp_matches%rowtype;
  v_a_name text;
  v_b_name text;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into v_match from public.pvp_matches
  where code = v_code and status = 'waiting' and player_b_id is null and player_a_id <> v_uid
  limit 1;
  if not found then
    begin
      insert into public.pvp_matches (code, player_a_id, team_a, status)
      values (v_code, v_uid, coalesce(p_team, '[]'::jsonb), 'waiting')
      returning * into v_match;
    exception when unique_violation then
      select * into v_match from public.pvp_matches
      where code = v_code and status = 'waiting' and player_b_id is null and player_a_id <> v_uid
      limit 1;
      if not found then raise exception 'No se pudo preparar la revancha'; end if;
    end;
  end if;
  if v_match.player_a_id = v_uid then
    select username into v_a_name from public.profiles where id = v_uid;
    return jsonb_build_object('match_id', v_match.id, 'code', v_match.code, 'is_host', true, 'opponent_name', null::text, 'player_name', v_a_name, 'joined', false);
  end if;
  update public.pvp_matches
  set player_b_id = v_uid, team_b = coalesce(p_team, '[]'::jsonb), status = 'active'
  where id = v_match.id;
  insert into public.pvp_state (match_id, state, turn, action_a, action_b)
  values (v_match.id, public.init_pvp_state(v_match.id), 0, null, null);
  select username into v_a_name from public.profiles where id = v_match.player_a_id;
  select username into v_b_name from public.profiles where id = v_uid;
  return jsonb_build_object('match_id', v_match.id, 'code', v_match.code, 'is_host', false, 'opponent_name', v_a_name, 'player_name', v_b_name, 'joined', true);
end;
$$;

-- ============================================================================
-- CHAT CO-OP
-- Mensajes rápidos entre compañeros usando el código de sesión.
-- ============================================================================

create table if not exists public.coop_chat (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists coop_chat_code_idx on public.coop_chat (code, created_at);

create or replace function public.send_coop_chat(p_code text, p_message text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if p_message is null or length(p_message) = 0 then return false; end if;
  if length(p_message) > 200 then p_message := left(p_message, 200); end if;
  insert into public.coop_chat (code, user_id, message)
  values (upper(p_code), auth.uid(), p_message);
  return true;
end;
$$;

create or replace function public.get_coop_chat(p_code text, p_after timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  into v_result
  from (
    select c.message, c.created_at, u.username
    from public.coop_chat c
    join public.profiles u on u.id = c.user_id
    where c.code = upper(p_code)
      and (p_after is null or c.created_at > p_after)
    order by c.created_at asc
    limit 100
  ) t;
  return v_result;
end;
$$;

-- Seguridad PvP: solo acceso vía RPC.
alter table public.pvp_matches enable row level security;
alter table public.pvp_state enable row level security;
alter table public.pvp_elo enable row level security;
alter table public.coop_chat enable row level security;

revoke all on public.pvp_matches from anon, authenticated;
revoke all on public.pvp_state from anon, authenticated;
revoke all on public.pvp_elo from anon, authenticated;
revoke all on public.coop_chat from anon, authenticated;

grant execute on function public.init_pvp_state to authenticated;
grant execute on function public.create_pvp_room to authenticated;
grant execute on function public.find_pvp_opponent to authenticated;
grant execute on function public.join_pvp_room to authenticated;
grant execute on function public.get_pvp_match to authenticated;
grant execute on function public.get_pvp_state to authenticated;
grant execute on function public.submit_pvp_action to authenticated;
grant execute on function public.resolve_pvp_turn to authenticated;
grant execute on function public.finish_pvp_match to authenticated;
grant execute on function public.forfeit_pvp_match to authenticated;
grant execute on function public.cancel_pvp_match to authenticated;
grant execute on function public.clear_pvp_action to authenticated;
grant execute on function public.start_pvp_timer to authenticated;
grant execute on function public.expire_pvp_timer to authenticated;
grant execute on function public.get_pvp_elo to authenticated;
grant execute on function public.get_pvp_elo_leaderboard to authenticated;
grant execute on function public.award_pvp_elo to authenticated;
grant execute on function public.rematch_pvp_room to authenticated;
grant execute on function public.send_coop_chat to authenticated;
grant execute on function public.get_coop_chat to authenticated;
