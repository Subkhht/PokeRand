import type { SupabaseClient, User } from '@supabase/supabase-js'

export interface LeaderboardTeamMember {
  name: string
  level: number
  sprite: string
  shiny?: boolean
}

export interface InfiniteScoreInsert {
  node: number
  generation: number
  is_random?: boolean
  duration_seconds: number
  team: LeaderboardTeamMember[]
  challenges?: string[]
}

export interface LeaderboardEntry extends InfiniteScoreInsert {
  id: string
  user_id: string
  player_name: string
  created_at: string
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

export function isLeaderboardEnabled(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

// --- Autenticación ---

export async function getCurrentUser(): Promise<User | null> {
  const client = await getClient()
  if (!client) return null
  const { data } = await client.auth.getUser()
  return data.user ?? null
}

export async function onAuthChange(cb: (user: User | null) => void): Promise<() => void> {
  const client = await getClient()
  if (!client) return () => {}
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null)
  })
  return () => data.subscription.unsubscribe()
}

export function getUsername(user: User | null): string {
  if (!user) return ''
  return (user.user_metadata?.username as string | undefined) ?? ''
}

export interface AuthResult {
  ok: boolean
  user: User | null
  needsEmailConfirmation?: boolean
  error?: string
}

export async function signUpWithUsername(email: string, password: string, username: string): Promise<AuthResult> {
  const client = await getClient()
  if (!client) return { ok: false, user: null, error: 'El ranking no está configurado.' }
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { username: username.trim() } },
  })
  if (error) return { ok: false, user: null, error: error.message }
  return { ok: true, user: data.session?.user ?? data.user ?? null, needsEmailConfirmation: !data.session }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const client = await getClient()
  if (!client) return { ok: false, user: null, error: 'El ranking no está configurado.' }
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error) return { ok: false, user: null, error: error.message }
  return { ok: true, user: data.user ?? null }
}

export async function signOut(): Promise<void> {
  const client = await getClient()
  if (!client) return
  await client.auth.signOut()
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const client = await getClient()
  if (!client) return false
  const { data, error } = await client
    .from('profiles')
    .select('username')
    .eq('username', username.trim())
    .maybeSingle()
  if (error) return false
  return data !== null
}

// --- Ranking ---

export interface ScoreSubmitResult {
  ok: boolean
  isNewBest: boolean
}

export async function submitInfiniteScore(entry: InfiniteScoreInsert): Promise<ScoreSubmitResult> {
  const client = await getClient()
  if (!client) return { ok: false, isNewBest: false }
  const { data, error } = await client.rpc('submit_infinite_score', {
    p_node: entry.node,
    p_generation: entry.generation,
    p_is_random: entry.is_random ?? false,
    p_duration_seconds: entry.duration_seconds,
    p_team: entry.team,
    p_challenges: entry.challenges ?? [],
  })
  if (error) {
    console.error('[leaderboard] submit error:', error)
    return { ok: false, isNewBest: false }
  }
  const isNewBest = (data as { is_new_best?: boolean } | null)?.is_new_best ?? true
  return { ok: true, isNewBest }
}

export async function fetchInfiniteLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const client = await getClient()
  if (!client) return []
  const { data, error } = await client
    .from('infinite_leaderboard')
    .select('*')
    .order('node', { ascending: false })
    .order('duration_seconds', { ascending: true })
    .limit(limit)
  if (error) {
    console.error('[leaderboard] fetch error:', error)
    return []
  }
  return (data ?? []) as LeaderboardEntry[]
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
