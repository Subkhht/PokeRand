import type { SupabaseClient } from '@supabase/supabase-js'
import type { Move, Pokemon } from './types'

export interface PvpMatchInfo {
  id: string
  code: string | null
  status: 'waiting' | 'active' | 'finished'
  player_a_id: string
  player_b_id: string | null
  result: 'a' | 'b' | null
  a_name: string | null
  b_name: string | null
  a_elo: number
  b_elo: number
}

export interface PvpEloEntry {
  player_name: string
  elo: number
  wins: number
}

export interface PvpPlayerState {
  team: Pokemon[]
  active: number
  revealed: boolean[]
  username: string | null
}

export interface PvpState {
  phase: 'picking' | 'switch' | 'finished'
  winner: 'a' | 'b' | null
  switchFor: 'a' | 'b' | 'both' | null
  log: string[]
  a: PvpPlayerState
  b: PvpPlayerState
}

export interface PvpTurnSnapshot {
  state: PvpState
  turn: number
  action_a: { kind: 'move' | 'switch'; index: number } | null
  action_b: { kind: 'move' | 'switch'; index: number } | null
  timer_by: 'a' | 'b' | null
  timer_until: string | null
}

export interface PvpRoomResult {
  match_id: string
  code: string | null
  is_host: boolean
  opponent_name: string | null
  player_name: string | null
  joined?: boolean
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let clientPromise: Promise<SupabaseClient | null> | null = null

function getClient(): Promise<SupabaseClient | null> {
  if (!supabaseUrl || !supabaseAnonKey) return Promise.resolve(null)
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(supabaseUrl, supabaseAnonKey)
    )
  }
  return clientPromise
}

export function isPvpEnabled(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

// Serializa un Pokémon a un snapshot JSON seguro para la red. Incluye todo lo
// necesario para el combate (stats, movimientos completos, estado).
export function serializePvpPokemon(p: Pokemon): Pokemon {
  return {
    id: p.id,
    name: p.name,
    sprite: p.sprite,
    level: p.level,
    hp: p.hp,
    maxHp: p.maxHp,
    attack: p.attack,
    defense: p.defense,
    speed: p.speed,
    types: p.types ?? [],
    baseStatTotal: p.baseStatTotal,
    shiny: p.shiny,
    moves: p.moves.map((m: Move): Move => ({ ...m, pp: m.pp ?? 10, maxPp: m.maxPp ?? 10 })),
  }
}

export async function createPvpRoom(team: Pokemon[]): Promise<PvpRoomResult | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('create_pvp_room', { p_team: team.map(serializePvpPokemon) })
  if (error) {
    console.error('create_pvp_room:', error)
    return null
  }
  return (data as PvpRoomResult) ?? null
}

export async function findPvpOpponent(team: Pokemon[]): Promise<PvpRoomResult | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('find_pvp_opponent', { p_team: team.map(serializePvpPokemon) })
  if (error) {
    console.error('find_pvp_opponent:', error)
    return null
  }
  return (data as PvpRoomResult) ?? null
}

export async function joinPvpRoom(code: string, team: Pokemon[]): Promise<PvpRoomResult | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('join_pvp_room', { p_code: code, p_team: team.map(serializePvpPokemon) })
  if (error) {
    console.error('join_pvp_room:', error)
    return null
  }
  return (data as PvpRoomResult) ?? null
}

export async function getPvpMatch(matchId: string): Promise<PvpMatchInfo | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('get_pvp_match', { p_match_id: matchId })
  if (error) {
    console.error('get_pvp_match:', error)
    return null
  }
  return (data as PvpMatchInfo) ?? null
}

export async function getPvpState(matchId: string): Promise<PvpTurnSnapshot | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('get_pvp_state', { p_match_id: matchId })
  if (error) {
    console.error('get_pvp_state:', error)
    return null
  }
  return (data as PvpTurnSnapshot) ?? null
}

export async function submitPvpAction(
  matchId: string,
  action: { kind: 'move' | 'switch'; index: number },
  turn: number
): Promise<PvpTurnSnapshot | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('submit_pvp_action', {
    p_match_id: matchId,
    p_action: action,
    p_turn: turn,
  })
  if (error) {
    console.error('submit_pvp_action:', error)
    return null
  }
  return (data as PvpTurnSnapshot) ?? null
}

export async function resolvePvpTurn(
  matchId: string,
  state: PvpState,
  turn: number
): Promise<boolean> {
  const client = await getClient()
  if (!client) return false
  const { data, error } = await client.rpc('resolve_pvp_turn', {
    p_match_id: matchId,
    p_state: state,
    p_turn: turn,
  })
  if (error) {
    console.error('resolve_pvp_turn:', error)
    return false
  }
  return data === true
}

export async function finishPvpMatch(matchId: string, result: 'a' | 'b'): Promise<boolean> {
  const client = await getClient()
  if (!client) return false
  const { data, error } = await client.rpc('finish_pvp_match', {
    p_match_id: matchId,
    p_result: result,
  })
  if (error) {
    console.error('finish_pvp_match:', error)
    return false
  }
  return data === true
}

export async function forfeitPvpMatch(matchId: string): Promise<boolean> {
  const client = await getClient()
  if (!client) return false
  const { data, error } = await client.rpc('forfeit_pvp_match', { p_match_id: matchId })
  if (error) {
    console.error('forfeit_pvp_match:', error)
    return false
  }
  return data === true
}

export async function cancelPvpMatch(matchId: string): Promise<boolean> {
  const client = await getClient()
  if (!client) return false
  const { data, error } = await client.rpc('cancel_pvp_match', { p_match_id: matchId })
  if (error) {
    console.error('cancel_pvp_match:', error)
    return false
  }
  return data === true
}

export async function clearPvpAction(matchId: string, turn: number): Promise<PvpTurnSnapshot | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('clear_pvp_action', { p_match_id: matchId, p_turn: turn })
  if (error) {
    console.error('clear_pvp_action:', error)
    return null
  }
  return (data as PvpTurnSnapshot) ?? null
}

export async function startPvpTimer(matchId: string): Promise<PvpTurnSnapshot | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('start_pvp_timer', { p_match_id: matchId })
  if (error) {
    console.error('start_pvp_timer:', error)
    return null
  }
  return (data as PvpTurnSnapshot) ?? null
}

export async function expirePvpTimer(matchId: string): Promise<boolean> {
  const client = await getClient()
  if (!client) return false
  const { data, error } = await client.rpc('expire_pvp_timer', { p_match_id: matchId })
  if (error) {
    console.error('expire_pvp_timer:', error)
    return false
  }
  return data === true
}

export async function getPvpElo(): Promise<{ elo: number; wins: number } | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('get_pvp_elo')
  if (error) {
    console.error('get_pvp_elo:', error)
    return null
  }
  return (data as { elo: number; wins: number }) ?? null
}

export async function getPvpEloLeaderboard(): Promise<PvpEloEntry[]> {
  const client = await getClient()
  if (!client) return []
  const { data, error } = await client.rpc('get_pvp_elo_leaderboard')
  if (error) {
    console.error('get_pvp_elo_leaderboard:', error)
    return []
  }
  return (data as PvpEloEntry[]) ?? []
}

export async function awardPvpElo(matchId: string): Promise<number | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('award_pvp_elo', { p_match_id: matchId })
  if (error) {
    console.error('award_pvp_elo:', error)
    return null
  }
  const points = (data as { points?: number } | null)?.points
  return typeof points === 'number' ? points : null
}

export async function rematchPvpRoom(code: string, team: Pokemon[]): Promise<PvpRoomResult | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('rematch_pvp_room', { p_code: code, p_team: team.map(serializePvpPokemon) })
  if (error) {
    console.error('rematch_pvp_room:', error)
    return null
  }
  return (data as PvpRoomResult) ?? null
}
