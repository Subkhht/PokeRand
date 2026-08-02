import type { SupabaseClient } from '@supabase/supabase-js'

export interface CoopSession {
  code: string
  seed: string
  gen: number
  difficulty: string
  player_a_id: string
  player_b_id: string | null
  status: 'waiting' | 'active' | 'finished'
  result: 'won' | 'lost' | null
  created_at: string
}

export interface CoopTrade {
  id: string
  node: number
  depositor: string
  offer: {
    kind: 'pokemon' | 'item'
    // pokemon
    id?: number
    name?: string
    sprite?: string
    level?: number
    shiny?: boolean
    hp?: number
    maxHp?: number
    attack?: number
    defense?: number
    speed?: number
    moves?: Array<{ name: string; power: number; type: string; accuracy: number | null }>
    types?: string[]
    holdItem?: string | null
    status?: { type: string; turns: number } | null
    // item
    itemName?: string
    itemIcon?: string
  }
  claimed: boolean
  claimed_by: string | null
  created_at: string
}

export interface CoopNodeProgress {
  a_ready: boolean
  b_ready: boolean
  finished: boolean
  result: 'won' | 'lost' | null
}

export interface CoopExchange {
  a_offer: CoopTrade['offer'] | null
  b_offer: CoopTrade['offer'] | null
  a_ready: boolean
  b_ready: boolean
  completed: boolean
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

export function isCoopEnabled(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

export async function createCoopSession(seed: string, gen: number, difficulty: string): Promise<string | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('create_coop_session', { p_seed: seed, p_gen: gen, p_difficulty: difficulty })
  if (error) {
    console.error('create_coop_session:', error)
    return null
  }
  return typeof data === 'string' ? data : null
}

export async function joinCoopSession(code: string): Promise<CoopSession | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('join_coop_session', { p_code: code })
  if (error) {
    console.error('join_coop_session:', error)
    return null
  }
  return (data as CoopSession) ?? null
}

export async function getCoopSession(code: string): Promise<CoopSession | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('get_coop_session', { p_code: code })
  if (error) {
    console.error('get_coop_session:', error)
    return null
  }
  return (data as CoopSession) ?? null
}

export async function markNodeReady(code: string, node: number): Promise<boolean> {
  const client = await getClient()
  if (!client) return false
  const { error } = await client.rpc('mark_node_ready', { p_code: code, p_node: node })
  if (error) {
    console.error('mark_node_ready:', error)
    return false
  }
  return true
}

export async function getCoopProgress(code: string, node: number): Promise<CoopNodeProgress | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('get_coop_progress', { p_code: code, p_node: node })
  if (error) {
    console.error('get_coop_progress:', error)
    return null
  }
  return (data as CoopNodeProgress) ?? null
}

export async function finishCoopSession(code: string, result: 'won' | 'lost'): Promise<boolean> {
  const client = await getClient()
  if (!client) return false
  const { error } = await client.rpc('finish_coop_session', { p_code: code, p_result: result })
  if (error) {
    console.error('finish_coop_session:', error)
    return false
  }
  return true
}

export async function resetCoopSession(code: string): Promise<boolean> {
  const client = await getClient()
  if (!client) return false
  const { data, error } = await client.rpc('reset_coop_session', { p_code: code })
  if (error) {
    console.error('reset_coop_session:', error)
    return false
  }
  return data === true
}

export async function cancelCoopSession(code: string): Promise<boolean> {
  const client = await getClient()
  if (!client) return false
  const { data, error } = await client.rpc('cancel_coop_session', { p_code: code })
  if (error) {
    console.error('cancel_coop_session:', error)
    return false
  }
  return data === true
}

export async function submitExchangeOffer(code: string, node: number, offer: CoopTrade['offer']): Promise<boolean> {
  const client = await getClient()
  if (!client) return false
  const { error } = await client.rpc('submit_exchange_offer', { p_code: code, p_node: node, p_offer: offer })
  if (error) {
    console.error('submit_exchange_offer:', error)
    return false
  }
  return true
}

export async function getCoopExchange(code: string, node: number): Promise<CoopExchange | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('get_exchange', { p_code: code, p_node: node })
  if (error) {
    console.error('get_exchange:', error)
    return null
  }
  return (data as CoopExchange) ?? null
}

export async function completeCoopExchange(code: string, node: number): Promise<CoopTrade['offer'] | null> {
  const client = await getClient()
  if (!client) return null
  const { data, error } = await client.rpc('complete_exchange', { p_code: code, p_node: node })
  if (error) {
    console.error('complete_exchange:', error)
    return null
  }
  return (data as CoopTrade['offer']) ?? null
}
