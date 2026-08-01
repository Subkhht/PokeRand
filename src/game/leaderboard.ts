import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

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

const client: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

export function isLeaderboardEnabled(): boolean {
  return client !== null
}

// --- Autenticación ---

export async function getCurrentUser(): Promise<User | null> {
  if (!client) return null
  const { data } = await client.auth.getUser()
  return data.user ?? null
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
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
  if (!client) return { ok: false, user: null, error: 'El ranking no está configurado.' }
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error) return { ok: false, user: null, error: error.message }
  return { ok: true, user: data.user ?? null }
}

export async function signOut(): Promise<void> {
  if (!client) return
  await client.auth.signOut()
}

export async function isUsernameTaken(username: string): Promise<boolean> {
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

export async function submitInfiniteScore(entry: InfiniteScoreInsert): Promise<boolean> {
  if (!client) return false
  const { error } = await client.from('infinite_leaderboard').insert(entry)
  if (error) {
    console.error('[leaderboard] submit error:', error)
    return false
  }
  return true
}

export async function fetchInfiniteLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
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
