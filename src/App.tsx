import { useMemo, useState, useEffect, useRef, useCallback, startTransition, lazy, Suspense, Component, Fragment, type ReactNode, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { ALL_SHOP_ITEMS, EVOLUTION_STONES, EVOLUTION_STONE_UNLOCK_IDS, EVOLUTION_STONE_ITEM_NAMES, EVOLUTION_ITEM_UNLOCK_IDS, BERRY_DROPS, TREASURES, TREASURE_DROPS, rollMagmaEmblem, EEVEE_EVOLUTIONS, itemDescriptions, ITEM_SPRITES } from './game/itemData'
import { canStillEvolve, HOLDABLE_ITEMS, HOLDABLE_ITEM_NAMES, POKEBALLS, POKEBALL_NAMES, POKEBALL_DEFS, POKEBALL_UNLOCK_IDS, getPokeBallRate, REGION_LEGENDARIES, ALL_LEGENDARIES } from './game/battleItems'
import { GYM_BADGES, MEGA_CAPABLE_IDS, MEGA_FORM_IDS, MEGA_SPRITE_OVERRIDES, GMAX_CAPABLE_IDS, GMAX_FORM_IDS, PRIMAL_CAPABLE_IDS, PRIMAL_FORM_IDS, ORIGIN_CAPABLE_IDS, ORIGIN_FORM_IDS } from './game/forms'
import { ACHIEVEMENTS, SYNERGIES, RANDOM_EVENTS, THEMES, REDESIGNS } from './game/runContent'
import { metaShopItemMatches, META_SHOP_ITEMS, type MetaShopItem } from './game/metaShop'
import { TYPE_COLORS, typeIconUrl, TRAINER_TYPES, GYM_LEADERS, type PokedexEntry } from './game/typeData'
import { nodeTypeLabel, buildOriginalStageRoute, generateCoopRouteSegment, NODE_EMOJIS, NODE_TYPE_COLORS, type FossilOption, type DaycareEgg, FOSSIL_REVIVALS, speculatorTypeMultiplier, speculatorPrice, getNodeMapLayout, nearestBranchNodes, getBranchMapLayout, trainerTeamSize, trainerMaxSize, trainerMemberLevelOffset, getFirstHealthyIndex, softenFirstBattleEnemy, difficultyLabel, generations, generationRegions, maxTeamSize } from './game/nodeConfig'
import './App.css'
import { applyDamage, applyNoEvolutionBuff, healPokemon, randomFrom, scalePokemonForNode, balanceWildPokemonToTeam, startRun, generateBossRushRoute, ALL_TYPES, createSeededRandom, getDailyConfig, RUN_MODIFIERS } from './game/engine'
import { playHover, playClick, playSelect, playHit, playEvolution, playCapture, playPerfectCapture, playEquip, playPurchase, playError, playCoin, playSlotMachine, playAchievement, playBadgeFanfare, startMenuMusic, startBattleMusic, playVictoryFanfare, playDefeatMusic, setVolume, getVolume, setSfxVolume, getSfxVolume, setMenuMusicTrack, setBattleMusicTrack, stopMusic, unlockAudio, isMusicMuted, setMusicMuted } from './game/sound'
import { DUNGEON_STORAGE_KEY } from './dungeon/data'
import { POKEST_STORAGE_KEY } from './pokest/data'
import {
  getBalancedPokemonByGeneration,
  getRandomStarterByGeneration,
  getRandomPokemonByGeneration,
  evolvePokemon,
  fetchPokemonDetails,
  checkAndLearnNewMove,
  getMoveDetails,
  getSpeciesIdsByGeneration,
  getSpeciesIdsByPrimaryType,
  getAllSpeciesList,
  fetchPokemonTypes,
  buildPokemonFromApi,
  preloadGeneration,
  startersByGen,
  makeShinySprite,
  pokemonSpriteUrl,
  canEvolveWithStone,
  stripRegional,
  setRunSeed,
  getPokemonAbilities,
  getFirstStageSpeciesId,
  type PokemonDetails
} from './game/pokeapi'
import { getTypeEffectiveness } from './game/typesChart'
import { abilityName, abilityDesc, weatherName, weatherDescription, weatherTypeMultiplier, weatherChipDmg, WEATHER_SETTERS, WEATHER_INFO, natureName, natureStatMods, natureMultiplier, randomNature, generateIVs, ivStatBonus, hasAbility, type WeatherKind, type MetaStatKey } from './game/pokemonMeta'
import {
  getAbilityMoveImmunity, absorbAbilityMove, getAbilityMoveType, getAbilityStabTypes,
  adjustEffectivenessForAbilities, getAbilityAccuracyMultiplier, getAbilityCritInfo,
  getAbilityPriorityBonus, blocksPriorityMove, getAbilitySpeedMultiplier,
  getAbilityDamageMultiplier, getAbilityStatusImmune, getAbilityStatDropBlocked,
  isIndirectDamageImmune, isWeatherSuppressed, getSleepTick,
  getBurnDamage, applyAbilityOnHit, applyAbilityEntrySelf,
  applyAbilityEndTurn, isContactMove, isTrappedByAbility,
  adjustAbilityStatChange, applyAbilityStatDropReaction, applyAbilitySwitchOut,
  isPowderMove, isSoundMove,
} from './game/abilities'
import { isLeaderboardEnabled, submitInfiniteScore, fetchInfiniteLeaderboard, formatDuration, getCurrentUser, onAuthChange, signUpWithUsername, signIn, signOut, getUsername, isUsernameTaken, type LeaderboardEntry, type InfiniteScoreInsert } from './game/leaderboard'
import { isCoopEnabled, createCoopSession, joinCoopSession, getCoopSession, markNodeReady, getCoopProgress, submitExchangeOffer, getCoopExchange, completeCoopExchange, cancelExchangeOffer, sendCoopChat, getCoopChat, finishCoopSession, resetCoopSession, clearCoopRestart, cancelCoopSession as deleteCoopSessionRpc, type CoopTrade, type CoopExchange, type CoopChatMessage } from './game/coop'
import { isPvpEnabled, createPvpRoom, findPvpOpponent, joinPvpRoom, getPvpMatch, getPvpState, submitPvpAction, resolvePvpTurn as resolvePvpTurnRpc, forfeitPvpMatch, cancelPvpMatch, finishPvpMatch, clearPvpAction, startPvpTimer, expirePvpTimer, getPvpElo, getPvpEloLeaderboard, awardPvpElo, rematchPvpRoom, serializePvpPokemon, type PvpTurnSnapshot, type PvpRoomResult, type PvpState, type PvpEloEntry } from './game/pvp'
import { resolvePvpTurn, type PvpAction } from './game/pvpBattle'
import BackgroundLayer from './BackgroundLayer'
import BackgroundPreview from './BackgroundPreview'
import { BACKGROUNDS } from './game/backgrounds'
import type { User } from '@supabase/supabase-js'
import type { Move, Pokemon, PokemonIVs, RouteNode, BranchNode, RunConfig, RunModifier, DefeatSummary, RunChallenges, RunStats, Achievement, AchievementState, MetaProgression, StatusType, Difficulty } from './game/types'
import { t, getLanguage, setLanguage as setI18nLanguage, achName, achDesc, runModName, runModDesc, runEventTitle, runEventDesc, itemDesc, itemLocalizedName, metaItemDesc, moveName, statusLabel, statusAppliedLine, themeName, themeDesc, bgName, bgDesc, type Language, getChangelog, getLatestChangelogVersion } from './game/i18n'

// Pantallas pesadas cargadas bajo demanda para aligerar el bundle inicial.
const DungeonMode = lazy(() => import('./dungeon/DungeonMode').then(m => ({ default: m.DungeonMode })))
const PokestDungeon = lazy(() => import('./pokest/PokestDungeon').then(m => ({ default: m.PokestDungeon })))
const CasinoMinigame = lazy(() => import('./minigames/CasinoMinigame'))
const MinigamePractice = lazy(() => import('./minigames/MinigamePractice'))

function LazyLoadingPanel({ label }: { label: string }) {
  return (
    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#9b98cf', fontSize: '0.9rem' }}>
      {label}
    </div>
  )
}

type Screen = 'setup' | 'route' | 'battle' | 'shop' | 'spin' | 'pokeRand' | 'move' | 'mega' | 'gmax' | 'primal' | 'trade' | 'blackmarket' | 'speculator' | 'safari' | 'orchard' | 'fossil' | 'fishing' | 'mine' | 'daycare' | 'weather' | 'mirror' | 'ranch' | 'double' | 'casino' | 'victory' | 'defeat' | 'coliseum_select' | 'pvp' | 'dungeon' | 'pokest'

// Historial local de partidas finalizadas (victorias/derrotas). Solo se
// registran runs que terminan de verdad: no se cuentan reinicios ni abandonos.
interface MatchRecord {
  result: 'win' | 'loss'
  date: number
  mode: Difficulty
  generation: number
  duration: number
  team: Array<{ name: string; sprite: string; shiny?: boolean; level?: number }>
  challenges: string[]
}

interface AccessibilitySettings {
  reduceAnimations: boolean
  highContrast: boolean
  colorBlind: boolean
  readableFont: boolean
  textScale: number
  floatingDamage: boolean
  battleSpeed: 1 | 2 | 4
}

const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  reduceAnimations: false,
  highContrast: false,
  colorBlind: false,
  readableFont: false,
  textScale: 100,
  floatingDamage: true,
  battleSpeed: 1,
}

const MATCH_HISTORY_KEY = 'pokerand_match_history'
const MAX_MATCH_HISTORY = 20

function loadMatchHistory(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(MATCH_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveMatchRecord(entry: MatchRecord): void {
  const history = loadMatchHistory()
  history.unshift(entry)
  localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_MATCH_HISTORY)))
}

const STATUS_COLORS: Record<StatusType, string> = {
  burn: '#ff8a33',
  poison: '#a855f7',
  paralysis: '#eab308',
  freeze: '#4d9bff',
  sleep: '#9b98cf',
  confusion: '#ec4899',
  flinch: '#ffcb05',
}

// Color de la barra de vida según el porcentaje de HP restante: verde > 50%,
// amarillo > 25%, rojo por debajo. La transición de color la hace el CSS.
function hpBarColor(ratio: number): string {
  if (ratio > 0.5) return '#37d16b'
  if (ratio > 0.25) return '#facc15'
  return '#ee3b2f'
}

function StatusBadge({ status, compact = false }: { status?: Pokemon['status']; compact?: boolean }) {
  if (!status) return null
  const label = statusLabel(status.type)
  const color = STATUS_COLORS[status.type]
  const emoji = label.split(' ')[0]
  const text = label.split(' ').slice(1).join(' ')
  return (
    <span
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: compact ? '1px 6px' : '2px 8px',
        borderRadius: '999px',
        background: `${color}2e`,
        border: `1.5px solid ${color}`,
        color,
        fontWeight: 'bold',
        fontSize: compact ? '0.6rem' : '0.72rem',
        marginLeft: '5px',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        boxShadow: `0 0 8px ${color}66`,
        animation: 'casinoPulse 1.8s ease infinite',
      }}
    >
      <span style={{ fontSize: compact ? '0.62rem' : '0.78rem' }}>{emoji}</span>
      {!compact && <span>{text}</span>}
    </span>
  )
}

// Insignia verde para el estado de Drenadoras (Leech Seed), igual que StatusBadge.
function LeechSeedBadge({ compact = false }: { compact?: boolean }) {
  const color = '#4ade80'
  const label = statusLabel('leechSeed')
  const emoji = label.split(' ')[0]
  const text = label.split(' ').slice(1).join(' ')
  return (
    <span
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: compact ? '1px 6px' : '2px 8px',
        borderRadius: '999px',
        background: `${color}2e`,
        border: `1.5px solid ${color}`,
        color,
        fontWeight: 'bold',
        fontSize: compact ? '0.6rem' : '0.72rem',
        marginLeft: '5px',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        boxShadow: `0 0 8px ${color}66`,
        animation: 'casinoPulse 1.8s ease infinite',
      }}
    >
      <span style={{ fontSize: compact ? '0.62rem' : '0.78rem' }}>{emoji}</span>
      {!compact && <span>{text}</span>}
    </span>
  )
}

// Indicador visual flotante sobre el sprite del Pokémon para su estado/Drenadoras.
function StatusFloat({ pokemon }: { pokemon?: Pokemon }) {
  if (!pokemon) return null
  const emoji = pokemon.status
    ? statusLabel(pokemon.status.type).split(' ')[0]
    : pokemon.leechSeed
      ? '🌱'
      : null
  if (!emoji) return null
  return (
    <span
      style={{
        position: 'absolute',
        top: '-14px',
        right: '-6px',
        fontSize: '1.35rem',
        lineHeight: 1,
        zIndex: 5,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.85))',
        animation: 'casinoBounce 0.9s ease infinite',
      }}
    >
      {emoji}
    </span>
  )
}

interface CombatFloatData {
  id: number
  text: string
  color: string
}

function FloatingCombatText({ data }: { data: CombatFloatData | null }) {
  if (!data) return null
  return (
    <span key={data.id} className="damage-float" style={{ color: data.color }}>
      {data.text}
    </span>
  )
}

// Clase CSS de animación sobre el sprite según el estado del Pokémon.
function statusSpriteClass(status?: Pokemon['status'], leechSeed?: boolean): string {
  let cls = ''
  if (status) {
    switch (status.type) {
      case 'burn': cls = 'status-burn'; break
      case 'poison': cls = 'status-poison'; break
      case 'paralysis': cls = 'status-paralysis'; break
      case 'freeze': cls = 'status-freeze'; break
      case 'sleep': cls = 'status-sleep'; break
      case 'confusion': cls = 'status-confusion'; break
      case 'flinch': cls = 'status-flinch'; break
      default: cls = ''
    }
  }
  if (leechSeed) return `${cls} status-leech`.trim()
  return cls
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={() => { playClick(); void copy() }}
      title={copied ? t('lb.copied') : t('lb.copyCode')}
      style={{
        background: copied ? 'rgba(55,209,107,0.2)' : 'rgba(255,255,255,0.08)',
        border: copied ? '1px solid rgba(55,209,107,0.5)' : '1px solid rgba(255,255,255,0.2)',
        borderRadius: '6px',
        padding: '6px 8px',
        cursor: 'pointer',
        color: copied ? '#37d16b' : '#f3f1ff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
      }}
    >
      {copied ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

function SetupBanner() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    let acc = 0

    interface FloatItem { x: number; y: number; r: number; vx: number; vy: number; type: number; rot: number }
    const items: FloatItem[] = Array.from({ length: 16 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 9 + Math.random() * 14,
      vx: (Math.random() - 0.5) * 0.05,
      vy: -0.03 - Math.random() * 0.05,
      type: i % 3,
      rot: Math.random() * Math.PI * 2,
    }))

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }
    resize()

    const drawPokeball = (x: number, y: number, r: number, rot: number): void => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rot)
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fillStyle = '#f8fafc'; ctx.fill()
      ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fillStyle = '#ee3b2f'; ctx.fill()
      ctx.fillStyle = '#1a1a2e'; ctx.fillRect(-r, -r * 0.12, r * 2, r * 0.24)
      ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2); ctx.fillStyle = '#f8fafc'; ctx.fill()
      ctx.restore()
    }

    const drawCoin = (x: number, y: number, r: number): void => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = '#ffcb05'; ctx.fill()
      ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.stroke()
      ctx.font = `bold ${r}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#7a5200'; ctx.fillText('$', x, y + 1)
    }

    const drawStar = (x: number, y: number, r: number, rot: number): void => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const a1 = (i * Math.PI * 2) / 5 - Math.PI / 2
        const a2 = a1 + Math.PI / 5
        ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r)
        ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45)
      }
      ctx.closePath()
      ctx.fillStyle = '#f0abfc'; ctx.fill()
      ctx.restore()
    }

    const loop = (now: number): void => {
      resize()
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) { raf = requestAnimationFrame(loop); return }
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      acc += dt
      // La decoración de la barra superior no necesita 60 fps.
      if (acc < 1 / 30) { raf = requestAnimationFrame(loop); return }
      acc = 0
      const t = now / 1000
      ctx.clearRect(0, 0, w, h)
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#2a1a4e')
      g.addColorStop(0.6, '#241a52')
      g.addColorStop(1, '#1a1033')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      for (let i = 0; i < 26; i++) {
        const sx = (i * 97.3) % w
        const sy = (i * 53.7) % h
        const a = 0.25 + 0.35 * Math.sin(t * 1.5 + i)
        ctx.beginPath(); ctx.arc(sx, sy, 1.3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(240, 235, 255, ${a})`; ctx.fill()
      }

      for (const it of items) {
        it.x += it.vx * dt
        it.y += it.vy * dt
        it.rot += dt * 0.8
        if (it.y < -20) { it.y = 1.05; it.x = Math.random() }
        if (it.x < -0.05) it.x = 1.05
        if (it.x > 1.05) it.x = -0.05
        const px = it.x * w
        const py = it.y * h
        if (it.type === 0) drawPokeball(px, py, it.r, it.rot)
        else if (it.type === 1) drawCoin(px, py, it.r * 0.8)
        else drawStar(px, py, it.r, it.rot)
      }

      const glow = ctx.createLinearGradient(0, h - 6, 0, h)
      glow.addColorStop(0, 'rgba(240,171,252,0.0)')
      glow.addColorStop(1, 'rgba(240,171,252,0.45)')
      ctx.fillStyle = glow
      ctx.fillRect(0, h - 6, w, 6)

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} className="setup-hero-canvas" />
}

function drawPokeballSprite(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fillStyle = '#f8fafc'; ctx.fill()
  ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fillStyle = '#ee3b2f'; ctx.fill()
  ctx.fillStyle = '#1a1a2e'; ctx.fillRect(-r, -r * 0.12, r * 2, r * 0.24)
  ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2); ctx.fillStyle = '#f8fafc'; ctx.fill()
  ctx.restore()
}

function drawCoinSprite(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = '#ffcb05'; ctx.fill()
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.stroke()
  ctx.font = `bold ${r}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#7a5200'; ctx.fillText('$', x, y + 1)
}

function drawStarSprite(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a1 = (i * Math.PI * 2) / 5 - Math.PI / 2
    const a2 = a1 + Math.PI / 5
    ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r)
    ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45)
  }
  ctx.closePath()
  ctx.fillStyle = '#f0abfc'; ctx.fill()
  ctx.restore()
}

function TopbarCanvas({ paused = false }: { paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    let acc = 0

    interface FloatItem { x: number; y: number; r: number; vx: number; type: number; rot: number }
    const items: FloatItem[] = Array.from({ length: 12 }, (_, i) => ({
      x: Math.random(),
      y: 0.15 + Math.random() * 0.7,
      r: 5 + Math.random() * 8,
      vx: (0.015 + Math.random() * 0.04) * (i % 2 === 0 ? 1 : -1),
      type: i % 3,
      rot: Math.random() * Math.PI * 2,
    }))

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }
    resize()

    const loop = (now: number): void => {
      resize()
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) { raf = requestAnimationFrame(loop); return }
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      acc += dt
      // La decoración de la barra superior no necesita 60 fps.
      if (acc < 1 / 30) { raf = requestAnimationFrame(loop); return }
      acc = 0
      const t = now / 1000
      ctx.clearRect(0, 0, w, h)

      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, 'rgba(42, 26, 78, 0.35)')
      g.addColorStop(1, 'rgba(26, 16, 51, 0.6)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      for (let i = 0; i < 18; i++) {
        const sx = (i * 83.7 + t * 12) % w
        const sy = (i * 47.3) % h
        const a = 0.2 + 0.3 * Math.sin(t * 1.6 + i)
        ctx.beginPath(); ctx.arc(sx, sy, 1.1, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(240, 235, 255, ${a})`; ctx.fill()
      }

      ctx.globalAlpha = 0.55
      for (const it of items) {
        it.x += it.vx * dt
        it.rot += dt * 0.7
        if (it.x > 1.05) it.x = -0.05
        if (it.x < -0.05) it.x = 1.05
        const px = it.x * w
        const py = it.y * h
        if (it.type === 0) drawPokeballSprite(ctx, px, py, it.r, it.rot)
        else if (it.type === 1) drawCoinSprite(ctx, px, py, it.r * 0.8)
        else drawStarSprite(ctx, px, py, it.r, it.rot)
      }
      ctx.globalAlpha = 1

      if (!paused) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [paused])

  return <canvas ref={canvasRef} className="topbar-canvas" />
}

function ResetLoadingScreen() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const start = performance.now()
    const DURATION = 1500

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }
    resize()

    const loop = (now: number): void => {
      resize()
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) { raf = requestAnimationFrame(loop); return }
      const elapsed = now - start
      const prog = Math.min(1, elapsed / DURATION)
      const t = now / 1000

      ctx.clearRect(0, 0, w, h)
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#2a1a4e')
      g.addColorStop(1, '#1a1033')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      for (let i = 0; i < 20; i++) {
        const sx = (i * 83.7) % w
        const sy = (i * 47.3) % h
        const a = 0.25 + 0.35 * Math.sin(t * 1.5 + i)
        ctx.beginPath(); ctx.arc(sx, sy, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(240, 235, 255, ${a})`; ctx.fill()
      }

      const cx = w / 2
      const cy = h / 2 - 34
      ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fill()
      ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(240,171,252,0.4)'
      ctx.lineWidth = 3
      ctx.stroke()
      drawPokeballSprite(ctx, cx, cy, 30, t * 2.6)

      const barW = Math.min(240, w - 80)
      const barX = (w - barW) / 2
      const barY = cy + 58
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(barX, barY, barW, 12)
      ctx.fillStyle = '#34d399'
      ctx.fillRect(barX, barY, barW * prog, 12)
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1
      ctx.strokeRect(barX, barY, barW, 12)
      ctx.font = 'bold 13px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#f3f1ff'
      ctx.fillText(`${Math.round(prog * 100)}%`, w / 2, barY + 34)

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} className="reset-loading-canvas" />
}

const difficultyNodeCounts: Record<Difficulty, number> = {
  easy: 5,
  medium: 10,
  hard: 25,
  infinite: 0,
  coliseum: 8,
  original: 10,
  branch: 22,
}

const authInputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid #3f3f6e',
  background: 'rgba(15,23,42,0.8)',
  color: '#f3f1ff',
  fontSize: '0.9rem',
}

// Catálogo base de la Tienda
function ShopItemToggle({ id, disabled, onToggle }: { id: string; disabled: boolean; onToggle: (id: string) => void }): ReactNode {
  const [checked, setChecked] = useState(!disabled)
  return (
    <label style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 2, display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '2px', borderRadius: '4px', background: 'rgba(15,23,42,0.7)', lineHeight: 1 }} title={t('shop.toggleHint')}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => {
          // Estado local: la casilla cambia al instante sin esperar el re-render.
          setChecked(c => !c)
          onToggle(id)
        }}
        style={{ accentColor: '#37d16b', cursor: 'pointer', width: '15px', height: '15px', margin: 0 }}
      />
    </label>
  )
}

function fallbackSprite(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  const src = img.src

  // Último recurso para sprites de Pokémon: sprite estático base, que existe
  // para TODOS los IDs de PokeAPI (formas normales, alternas, mega, primal, etc.).
  // Resuelve también los fallos de los GIF animados (Gen V) y de Showdown.
  const idMatch = src.match(/\/(\d+)\.(png|gif)/)
  if (idMatch && src.includes('raw.githubusercontent.com/PokeAPI')) {
    const base = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idMatch[1]}.png`
    if (img.src !== base) {
      img.src = base
      img.onerror = null
      return
    }
  }

  img.onerror = null
}

function PokemonMetaTooltip({ p, showHeader = true }: { p: Pokemon; showHeader?: boolean }): ReactNode {
  const en = getLanguage() === 'en'
  const lang = en ? 'en' : 'es'
  const statLabel = (k: MetaStatKey) => k === 'attack' ? (en ? 'Attack' : 'Ataque') : k === 'defense' ? (en ? 'Defense' : 'Defensa') : k === 'spAttack' ? (en ? 'Sp. Atk' : 'At. Esp.') : k === 'spDefense' ? (en ? 'Sp. Def' : 'Def. Esp.') : (en ? 'Speed' : 'Velocidad')
  const ivs = p.ivs ? [
    { key: 'hp', label: en ? 'HP' : 'PS', val: p.ivs.hp },
    { key: 'attack', label: en ? 'Atk' : 'Ata', val: p.ivs.attack },
    { key: 'defense', label: en ? 'Def' : 'Def', val: p.ivs.defense },
    { key: 'spAttack', label: en ? 'SpA' : 'AE', val: p.ivs.spAttack },
    { key: 'spDefense', label: en ? 'SpD' : 'DE', val: p.ivs.spDefense },
    { key: 'speed', label: en ? 'Spe' : 'Vel', val: p.ivs.speed },
  ] : null
  const ivColor = (v: number) => v >= 31 ? '#facc15' : v >= 25 ? '#4ade80' : v >= 15 ? '#fbbf24' : '#94a3b8'
  const total = ivs ? ivs.reduce((s, x) => s + x.val, 0) : 0
  const totalColor = total >= 170 ? '#facc15' : total >= 120 ? '#4ade80' : '#94a3b8'
  return (
    <div style={{ minWidth: '220px' }}>
      {showHeader && (
        <div style={{ fontSize: '0.72rem', color: '#9b98cf', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '5px', marginBottom: '6px' }}>
          {p.name}{p.shiny ? ' ✨' : ''}
        </div>
      )}
      {p.ability && (
        <div style={{ margin: '4px 0 6px', padding: '6px 9px', borderRadius: '8px', background: 'rgba(157,166,255,0.12)', border: '1px solid rgba(157,166,255,0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.6rem', color: '#9b98cf', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{en ? 'Ability' : 'Habilidad'}</span>
            <strong style={{ fontSize: '0.82rem', color: '#9da6ff' }}>{abilityName(p.ability, lang)}</strong>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#b8b5dc', lineHeight: 1.35, marginTop: '2px' }}>{abilityDesc(p.ability, lang)}</div>
        </div>
      )}
      {p.nature && (() => {
        const mods = natureStatMods(p.nature)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', margin: '2px 0 6px' }}>
            <span style={{ fontSize: '0.6rem', color: '#9b98cf', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{en ? 'Nature' : 'Naturaleza'}</span>
            <strong style={{ fontSize: '0.8rem', color: '#7ceb95' }}>{natureName(p.nature, lang)}</strong>
            {mods.up && <span style={{ fontSize: '0.66rem', color: '#4ade80', fontWeight: 'bold', background: 'rgba(74,222,128,0.12)', padding: '1px 5px', borderRadius: '4px' }}>↑ {statLabel(mods.up)}</span>}
            {mods.down && <span style={{ fontSize: '0.66rem', color: '#f87171', fontWeight: 'bold', background: 'rgba(248,113,113,0.12)', padding: '1px 5px', borderRadius: '4px' }}>↓ {statLabel(mods.down)}</span>}
          </div>
        )
      })()}
      {ivs && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.6rem', color: '#9b98cf', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{en ? 'IVs' : 'IVs'}</span>
            <strong style={{ fontSize: '0.72rem', color: totalColor }}>{total}/186</strong>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px 6px' }}>
            {ivs.map(iv => (
              <div key={iv.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.66rem', color: '#d9d6f2', background: 'rgba(154,152,207,0.10)', borderRadius: '5px', padding: '2px 6px' }}>
                <span>{iv.label}</span>
                <strong style={{ color: ivColor(iv.val) }}>{iv.val}{iv.val >= 31 ? '★' : ''}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function moveTooltip(move: Move): string {
  const en = getLanguage() === 'en'
  const accuracy = move.accuracy === null
    ? (en ? 'Always hits' : 'Siempre acierta')
    : `${move.accuracy}% ${en ? 'accuracy' : 'precisión'}`
  const isStatus = !move.power || move.power <= 0
  const cls = isStatus
    ? (en ? 'Status' : 'Estado')
    : move.damageClass === 'special' ? (en ? 'Special' : 'Especial') : (en ? 'Physical' : 'Físico')
  let info = `${moveName(move)}\n${isStatus ? (en ? 'Status move' : 'Movimiento de estado') : `${cls} · ${en ? 'Power' : 'Potencia'}: ${move.power}`}\n${accuracy}`
  if (move.ailment) {
    const pct = Math.round((move.ailmentChance ?? 1) * 100)
    info += `\n${en ? 'Effect' : 'Efecto'}: ${statusLabel(move.ailment ?? '')} (${pct}%)`
  }
  if (move.statChanges && move.statChanges.length > 0) {
    for (const sc of move.statChanges) {
      const statName = sc.stat === 'attack' ? (en ? 'Attack' : 'Ataque') : sc.stat === 'defense' ? (en ? 'Defense' : 'Defensa') : sc.stat === 'speed' ? (en ? 'Speed' : 'Velocidad') : sc.stat === 'special-attack' ? (en ? 'Sp. Atk' : 'At. Esp.') : (en ? 'Sp. Def' : 'Def. Esp.')
      const dir = sc.change > 0 ? (en ? 'Raises' : 'Sube') : (en ? 'Lowers' : 'Baja')
      const pct = sc.chance != null ? ` (${sc.chance}%)` : ''
      info += `\n${en ? 'Effect' : 'Efecto'}: ${dir} ${statName}${pct}`
    }
  }
  if (move.minHits && move.maxHits) {
    info += `\n${en ? 'Hits' : 'Golpes'}: ${move.minHits}-${move.maxHits}`
  }
  if (move.recoilPercent) {
    info += `\nRecoil: ${Math.round(move.recoilPercent * 100)}%`
  }
  if (move.drainPercent) {
    info += `\n${en ? 'Drains' : 'Drena'}: ${Math.round(move.drainPercent * 100)}% HP`
  }
  if (move.critRatio && move.critRatio > 0) {
    info += `\n${en ? 'High critical hit ratio' : 'Alto ratio de crítico'}`
  }
  return info
}

// Resumen compacto de efectos del movimiento para los botones de combate.
function moveEffectSummary(move: Move): string {
  const parts: string[] = []
  if (move.ailment) {
    const pct = move.ailmentChance != null && move.ailmentChance < 1 ? `${Math.round(move.ailmentChance * 100)}% ` : ''
    parts.push(`${pct}${statusLabel(move.ailment).split(' ').slice(1).join(' ') || statusLabel(move.ailment)}`)
  }
  if (move.statChanges && move.statChanges.length > 0) {
    for (const sc of move.statChanges) {
      const statName = sc.stat === 'attack' ? t('b.statAtk') : sc.stat === 'defense' ? t('b.statDef') : sc.stat === 'speed' ? t('b.statVel') : sc.stat === 'special-attack' ? t('b.statSpAtk') : t('b.statSpDef')
      const dir = sc.change > 0 ? '↑' : '↓'
      const pct = sc.chance != null ? ` ${sc.chance}%` : ''
      parts.push(`${dir} ${statName}${pct}`)
    }
  }
  if (move.minHits && move.maxHits) parts.push(t('b.effectHits', { min: move.minHits, max: move.maxHits }))
  if (move.drainPercent) parts.push(t('b.effectDrain', { pct: Math.round(move.drainPercent * 100) }))
  if (move.recoilPercent) parts.push(t('b.effectRecoil', { pct: Math.round(move.recoilPercent * 100) }))
  return parts.join(' · ')
}

// Detecta movimientos de protección (Protección/Protect, Detección, Defensa
// Férrea, etc.): movimientos de estado sin efecto propio que bloquean el
// próximo ataque del rival.
function isProtectMove(move: Move): boolean {
  if ((move.power ?? 0) > 0) return false
  if (move.ailment) return false
  if (move.statChanges && move.statChanges.length > 0) return false
  return /proteg|protec|protect|evita todos los ataques|evade all attacks|escudo|shield|refugio/i.test(`${move.name} ${move.description}`)
}

function getStageMultiplier(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage))
  if (s > 0) return (2 + s) / 2
  if (s < 0) return 2 / (2 - s)
  return 1
}

// Tooltip con el tema integrado para descripciones de objetos y movimientos.
// Usa display:contents para no alterar el layout y un portal fijo que sigue al
// cursor (posicionado por ref, sin re-renderizar en cada movimiento).
function ThemedTooltip({ content, children }: { content: ReactNode; children: ReactNode }): ReactNode {
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  if (!content) return <>{children}</>
  return (
    <span
      style={{ display: 'contents' }}
      onMouseEnter={(e) => {
        setVisible(true)
        if (tooltipRef.current) {
          tooltipRef.current.style.left = `${e.clientX}px`
          tooltipRef.current.style.top = `${e.clientY}px`
        }
      }}
      onMouseLeave={() => setVisible(false)}
      onMouseMove={(e) => {
        if (tooltipRef.current) {
          tooltipRef.current.style.left = `${e.clientX}px`
          tooltipRef.current.style.top = `${e.clientY}px`
        }
      }}
    >
      {children}
      {createPortal(
        <div ref={tooltipRef} className="theme-tooltip" style={{ display: visible ? 'block' : 'none' }}>{content}</div>,
        document.body
      )}
    </span>
  )
}

function WeatherTooltip({ weather, style }: { weather: Exclude<WeatherKind, 'none'>; style?: CSSProperties }): ReactNode {
  const lang = getLanguage()
  return (
    <ThemedTooltip
      content={(
        <div>
          <strong style={{ display: 'block', marginBottom: '4px', color: '#cba3ff' }}>
            {WEATHER_INFO[weather].icon} {weatherName(weather, lang)}
          </strong>
          <span>{weatherDescription(weather, lang)}</span>
        </div>
      )}
    >
      <div style={{ ...style, cursor: 'help' }}>
        {WEATHER_INFO[weather].icon} {weatherName(weather, lang)}
      </div>
    </ThemedTooltip>
  )
}

function getEffectiveStats(pokemon: Pokemon): { attack: number; defense: number; spAttack: number; spDefense: number; speed: number; maxHp: number } {
  const item = pokemon.holdItem ? HOLDABLE_ITEMS[pokemon.holdItem] : null
  const stages = pokemon.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
  const atkStage = getStageMultiplier(stages.attack)
  const defStage = getStageMultiplier(stages.defense)
  const spaStage = getStageMultiplier(stages.spAttack ?? 0)
  const spDefStage = getStageMultiplier(stages.spDefense ?? 0)
  const spdStage = getStageMultiplier(stages.speed)
  return {
    attack: Math.round(pokemon.attack * (1 + (item?.attackMod ?? 0)) * atkStage),
    defense: Math.round(pokemon.defense * (1 + (item?.defenseMod ?? 0)) * defStage),
    spAttack: Math.round(pokemon.spAttack * (1 + (item?.spAttackMod ?? 0)) * spaStage),
    spDefense: Math.round(pokemon.spDefense * (1 + (item?.spDefenseMod ?? 0)) * spDefStage),
    speed: Math.round(pokemon.speed * (1 + (item?.speedMod ?? 0)) * spdStage),
    maxHp: pokemon.maxHp,
  }
}

function groupInventory(items: string[]): Array<{ name: string; count: number; description: string }> {
  const counts = new Map<string, number>()
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1)
  }

  return [...counts.entries()].map(([name, count]) => ({
    name,
    count,
    description: itemDesc(name) !== name ? itemDesc(name) : (itemDescriptions[name] ?? 'No effect description available.')
  }))
}

// Calcula el tamaño de equipo de TeamR/Rival. En rutas finitas escala con el
// progreso (2 → 6). En Infinite la ruta crece sin límite, así que escala de
// forma monótona con los nodos completados para evitar picos y caídas en cada
// lote de 5 nodos nuevos.
interface ProgressionData {
  completedMedium: number[]
  completedAny: number[]
  completedHard: number[]
  completedColiseum: number[]
  completedLeague: number[]
  completedOriginal: number[]
  completedBranch: number[]
}

interface VictoryUnlocks {
  genName: string
  nextGenNumber: number | null
  nextGenName: string | null
  unlockedHard: boolean
  unlockedInfinite: boolean
}

function MainApp() {
  const [screen, setScreen] = useState<Screen>('setup')
  const [showIntro, setShowIntro] = useState(true)
  const [introLeaving, setIntroLeaving] = useState(false)
  const [generation, setGeneration] = useState<number>(1)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [currentRunGen, setCurrentRunGen] = useState<number>(1)
  const [victoryUnlocks, setVictoryUnlocks] = useState<VictoryUnlocks | null>(null)
  const [starterOptions, setStarterOptions] = useState<Pokemon[]>([])
  const [showStarterSelect, setShowStarterSelect] = useState(false)
  const chosenStarterIdRef = useRef<number | null>(null)
  // Medallas del Modo Original: cada una es una insignia distinta (no se repiten).
  const [originalMedals, setOriginalMedals] = useState<Array<{ id: string; name: string; sprite: string }>>([])
  // Modo Ruta: mapa de nodos ramificado. branchMap[col] = nodos de esa columna;
  // la última columna siempre contiene el jefe de la etapa.
  const [branchMap, setBranchMap] = useState<BranchNode[][] | null>(null)
  const [branchCol, setBranchCol] = useState<number>(0)
  const [branchMedals, setBranchMedals] = useState<Array<{ id: string; name: string; sprite: string }>>([])

  const [progression, setProgression] = useState<ProgressionData>(() => {
    try {
      const saved = localStorage.getItem('pokerand_progression')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          completedMedium: Array.isArray(parsed.completedMedium) ? parsed.completedMedium : [],
          completedAny: Array.isArray(parsed.completedAny) ? parsed.completedAny : [],
          completedHard: Array.isArray(parsed.completedHard) ? parsed.completedHard : [],
          completedColiseum: Array.isArray(parsed.completedColiseum) ? parsed.completedColiseum : [],
          completedLeague: Array.isArray(parsed.completedLeague) ? parsed.completedLeague : [],
          completedOriginal: Array.isArray(parsed.completedOriginal) ? parsed.completedOriginal : [],
          completedBranch: Array.isArray(parsed.completedBranch) ? parsed.completedBranch : [],
        }
      }
    } catch {
      // fallback
    }
    return { completedMedium: [], completedAny: [], completedHard: [], completedColiseum: [], completedLeague: [], completedOriginal: [], completedBranch: [] }
  })

  const [team, setTeam] = useState<Pokemon[]>([])
  const [coliseumTempTeam, setColiseumTempTeam] = useState<Pokemon[]>([])
  const [coliseumSeed, setColiseumSeed] = useState(0)
  const [coliseumSearch, setColiseumSearch] = useState('')
  const preColiseumChallengesRef = useRef<RunChallenges | null>(null)
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [enemy, setEnemy] = useState<Pokemon | null>(null)
  const [route, setRoute] = useState<RouteNode[]>([])
  const [routeIndex, setRouteIndex] = useState<number>(0)

  // Tamaño de nodos por lote en el modo Infinite (configurable en el setup).
  const [infiniteNodeSize, setInfiniteNodeSize] = useState<number>(5)

  // Combate de entrenador
  const [isTrainerBattle, setIsTrainerBattle] = useState<boolean>(false)
  const [trainerTeam, setTrainerTeam] = useState<Pokemon[]>([])
  const [trainerPokemonIndex, setTrainerPokemonIndex] = useState<number>(0)
  const [trainerName, setTrainerName] = useState<string>('')
  const [trainerSprite, setTrainerSprite] = useState<string>('')
  const [trainerBadge, setTrainerBadge] = useState<string>('')

  // Economía y Tienda
  const [money, setMoney] = useState<number>(100)
  const [shopStock, setShopStock] = useState<string[]>([])
  const [shopRerollsUsed, setShopRerollsUsed] = useState(0)
  const [shopBoughtCount, setShopBoughtCount] = useState<Record<string, number>>({})
  const [sellQty, setSellQty] = useState<Record<string, number>>({})

  const [inventory, setInventory] = useState<string[]>([])
  const [modifier, setModifier] = useState<RunModifier | null>(null)
  const [runChallenges, setRunChallenges] = useState<RunChallenges>({
    noShops: false,
    noRests: false,
    allShiny: false,
    allTeamRocket: false,
    nuzlocke: false,
    soloStarter: false,
    fixedTeam: false,
    noEvolution: false,
    noItems: false,
    restrictedMoves: false,
    firstStrike: false,
    fixedLevel: false,
    noCrits: false,
    typeRandomizer: false,
    noPurchasing: false,
    blindRoute: false,
    bossRush: false,
    speedrun: false,
    noMoney: false,
    doubleModifiers: false,
    scalingEnemies: false,
    noHealing: false,
    ironman: false,
    totalRandomizer: false,
    nuzlockeHardcore: false,
    challengeGauntlet: false,
    egglocke: false,
  })
  const [battleLog, setBattleLog] = useState<string[]>([])
  const [battleLogExpanded, setBattleLogExpanded] = useState(false)
  const [accessibility, setAccessibility] = useState<AccessibilitySettings>(() => {
    try {
      const raw = localStorage.getItem('pokerand_accessibility')
      if (!raw) return DEFAULT_ACCESSIBILITY
      const parsed = { ...DEFAULT_ACCESSIBILITY, ...JSON.parse(raw) } as AccessibilitySettings
      return {
        ...parsed,
        reduceAnimations: !!parsed.reduceAnimations,
        highContrast: !!parsed.highContrast,
        colorBlind: !!parsed.colorBlind,
        readableFont: !!parsed.readableFont,
        floatingDamage: parsed.floatingDamage !== false,
        textScale: Math.max(85, Math.min(130, Number(parsed.textScale) || 100)),
        battleSpeed: parsed.battleSpeed === 2 || parsed.battleSpeed === 4 ? parsed.battleSpeed : 1,
      }
    } catch {
      return DEFAULT_ACCESSIBILITY
    }
  })
  // Modo de bajo rendimiento: si el dispositivo no mantiene ~40 fps, se pausan
  // las animaciones decorativas de los canvas (el juego sigue igual).
  const [lowPerformance, setLowPerformance] = useState<boolean>(() => {
    try { return localStorage.getItem('pokerand_low_performance') === '1' } catch { return false }
  })
  const [playerCombatFloat, setPlayerCombatFloat] = useState<CombatFloatData | null>(null)
  const [enemyCombatFloat, setEnemyCombatFloat] = useState<CombatFloatData | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [apiError, setApiError] = useState<string>('')
  const [restEncounter, setRestEncounter] = useState<Pokemon | null>(null)
  const [restRewardItem, setRestRewardItem] = useState<string>('')
  const [restExtraItems, setRestExtraItems] = useState<string[]>([])
  const [coinExchangeMsg, setCoinExchangeMsg] = useState<string | null>(null)
  const [legendaryEncounter, setLegendaryEncounter] = useState<Pokemon | null>(null)

  // Resumen de derrota
  const [defeatSummary, setDefeatSummary] = useState<DefeatSummary | null>(null)

  // Ranking mundial (modo Infinite)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardTab, setLeaderboardTab] = useState<'infinite' | 'elo'>('infinite')
  const [pvpEloLeaderboard, setPvpEloLeaderboard] = useState<PvpEloEntry[]>([])
  const [leaderboardByGen, setLeaderboardByGen] = useState<Record<number, LeaderboardEntry[]>>({})
  const [leaderboardGen, setLeaderboardGen] = useState(0)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [scoreSubmitState, setScoreSubmitState] = useState<'idle' | 'submitting' | 'submitted' | 'error' | 'disabled' | 'loginRequired'>('idle')
  const [submitIsNewBest, setSubmitIsNewBest] = useState<boolean | null>(null)
  const [showEndRunModal, setShowEndRunModal] = useState(false)
  const [voluntaryRunEnd, setVoluntaryRunEnd] = useState(false)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authUsername, setAuthUsername] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'info' | 'success'; text: string } | null>(null)

  // Modal de selección de objetivo para Revive
  const [reviveModal, setReviveModal] = useState<{ itemName: string; itemIndex: number } | null>(null)
  const [equipModal, setEquipModal] = useState<{ itemName: string; itemIndex: number } | null>(null)
  const [stoneEvoModal, setStoneEvoModal] = useState<{ stoneName: string; stoneIndex: number } | null>(null)
  const [stoneEvoTargets, setStoneEvoTargets] = useState<Pokemon[]>([])
  const [stoneEvoCanEvolve, setStoneEvoCanEvolve] = useState<Set<number>>(new Set())

  // Captura de Pokémon salvaje
  const [captureModal, setCaptureModal] = useState(false)
  const [captureMessage, setCaptureMessage] = useState<string | null>(null)
  const [captureSummary, setCaptureSummary] = useState<Pokemon | null>(null)
  const captureSummaryCompleteNodeRef = useRef(false)
  const [metaEditModal, setMetaEditModal] = useState<{ kind: 'nature' | 'ivs' | 'ability'; itemIndex: number } | null>(null)
  const [abilityTargetIdx, setAbilityTargetIdx] = useState<number | null>(null)
  const [abilityChoices, setAbilityChoices] = useState<string[] | null>(null)
  const [evoPopup, setEvoPopup] = useState<{ oldSprite: string; newSprite: string; oldName: string; newName: string } | null>(null)
  const [leagueOffer, setLeagueOffer] = useState(false)
  const [leagueTeamSelection, setLeagueTeamSelection] = useState(false)
  const [tempLeagueTeam, setTempLeagueTeam] = useState<string[]>([])
  const [battleTurns, setBattleTurns] = useState(0)
  // Intentos de huida en el combate salvaje actual (cada fallo facilita el siguiente).
  const [escapeAttempts, setEscapeAttempts] = useState(0)
  const [enemyHitFlash, setEnemyHitFlash] = useState(false)
  const [weather, setWeather] = useState<WeatherKind>('none')

  const battleStartHPRef = useRef<number>(0)
  const battleMinHpRef = useRef<number>(0)

  // Team Rocket
  const [isTeamRocketBattle, setIsTeamRocketBattle] = useState<boolean>(false)
  const [isRivalBattle, setIsRivalBattle] = useState<boolean>(false)
  const [teamRocketFainted, setTeamRocketFainted] = useState<boolean>(false)
  const [teamRocketTeam, setTeamRocketTeam] = useState<Pokemon[]>([])
  const [teamRocketStealMessage, setTeamRocketStealMessage] = useState<string>('')
  const [teamRocketPickModal, setTeamRocketPickModal] = useState<boolean>(false)

  // Spin (Ruleta)
  const [spinItems, setSpinItems] = useState<string[]>([])
  const [spinAnimating, setSpinAnimating] = useState<boolean>(false)
  const [spinWinnerIndex, setSpinWinnerIndex] = useState<number | null>(null)
  const [spinRevealed, setSpinRevealed] = useState<boolean>(false)

  // PokeRand (Ruleta de Pokémon)
  const [pokeRandPokemon, setPokeRandPokemon] = useState<Pokemon[]>([])
  const [pokeRandAnimating, setPokeRandAnimating] = useState<boolean>(false)
  const [pokeRandWinnerIndex, setPokeRandWinnerIndex] = useState<number | null>(null)
  const [pokeRandRevealed, setPokeRandRevealed] = useState<boolean>(false)

  // Mercado Negro
  const [blackMarketItems, setBlackMarketItems] = useState<string[]>([])
  const [blackMarketPokemon, setBlackMarketPokemon] = useState<Pokemon[]>([])
  const [speculatorConfirm, setSpeculatorConfirm] = useState<{ kind: 'team' | 'pc'; index: number; name: string; price: number } | null>(null)
  // Safari: 3 siluetas, Pokémon elegido, humor, caricias y bolas.
  const [safariChoices, setSafariChoices] = useState<Pokemon[]>([])
  const [safariSelected, setSafariSelected] = useState<Pokemon | null>(null)
  const [safariLoading, setSafariLoading] = useState(false)
  const [safariMood, setSafariMood] = useState(60)
  const [safariBonus, setSafariBonus] = useState(0)
  const [safariPetCount, setSafariPetCount] = useState(0)
  const [safariThreat, setSafariThreat] = useState(0)
  const [safariLog, setSafariLog] = useState<string[]>([])
  const [safariSelectedBall, setSafariSelectedBall] = useState('')
  // Huerto de Bayas: bayas plantadas y modales de plantar/cosechar.
  const [orchardPlanted, setOrchardPlanted] = useState<string[]>([])
  const [orchardPlantedNodeId, setOrchardPlantedNodeId] = useState<number | null>(null)
  const [orchardPlantModal, setOrchardPlantModal] = useState(false)
  const [orchardSelected, setOrchardSelected] = useState<string[]>([])
  const [orchardHarvest, setOrchardHarvest] = useState<Array<{ name: string; count: number }> | null>(null)
  // Laboratorio de Fósiles.
  const [fossilChoices, setFossilChoices] = useState<FossilOption[]>([])
  const [fossilBusy, setFossilBusy] = useState(false)
  // Pesca.
  const [fishingEncounter, setFishingEncounter] = useState<Pokemon | null>(null)
  const [fishingPhase, setFishingPhase] = useState<'idle' | 'waiting' | 'bite' | 'caught' | 'missed'>('idle')
  const [fishingLoading, setFishingLoading] = useState(false)
  const [fishingBusy, setFishingBusy] = useState(false)
  const [fishingMessage, setFishingMessage] = useState('')
  const [fishingAttempts, setFishingAttempts] = useState(0)
  const fishingTimersRef = useRef<{ bite?: ReturnType<typeof setTimeout>; escape?: ReturnType<typeof setTimeout> }>({})
  // Mina.
  const [miningDigs, setMiningDigs] = useState(0)
  const [miningBusy, setMiningBusy] = useState(false)
  const [miningMessage, setMiningMessage] = useState('')
  const [miningReveal, setMiningReveal] = useState<string | null>(null)
  const miningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const miningRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guardería.
  const [daycareEgg, setDaycareEgg] = useState<DaycareEgg | null>(null)
  const [daycareLoading, setDaycareLoading] = useState(false)
  const [eggHatch, setEggHatch] = useState<Pokemon | null>(null)
  const [eggHatchPlacement, setEggHatchPlacement] = useState<'team' | 'pc'>('team')
  // Estación Meteorológica.
  const [weatherStation, setWeatherStation] = useState<{ weather: Exclude<WeatherKind, 'none'>; battlesLeft: number } | null>(null)
  // Rancho Pokémon.
  const [ranchConfirm, setRanchConfirm] = useState<{ kind: 'team' | 'pc'; index: number; name: string } | null>(null)
  const [ranchResult, setRanchResult] = useState<Array<{ name: string; count: number }> | null>(null)

  // Casino (Pachinko)
  const [casinoScore, setCasinoScore] = useState<number | null>(null)
  const [casinoReward, setCasinoReward] = useState<{ label: string; money: number; item: string | null } | null>(null)
  const [casinoPlayed, setCasinoPlayed] = useState<boolean>(false)

  // Combate Doble (2 vs 2)
  const [doubleEnemies, setDoubleEnemies] = useState<Pokemon[]>([])
  const [doubleActives, setDoubleActives] = useState<(number | undefined)[]>([])
  const [doubleMoves, setDoubleMoves] = useState<Array<{ moveIdx: number; target: number } | null>>([null, null])
  const [doubleActiveSlot, setDoubleActiveSlot] = useState<number>(0)
  const [doubleChoosingSwitch, setDoubleChoosingSwitch] = useState(false)
  const [doubleLog, setDoubleLog] = useState<string[]>([])
  const [doubleFinished, setDoubleFinished] = useState<boolean>(false)
  const [doubleHits, setDoubleHits] = useState<Array<{ kind: 'enemy' | 'player'; index: number; key: number }>>([])
  const doubleHitKeyRef = useRef(0)

  // Evoluciones de Eevee obtenidas en la run actual (para el logro Familia Eevee).
  const eeveeEvolutionsRef = useRef<Set<number>>(new Set())

  // Si el slot activo queda vacío o su Pokémon está debilitado, cambia
  // automáticamente al primer slot con un Pokémon vivo.
  useEffect(() => {
    if (screen !== 'double') return
    const slot = doubleActiveSlot
    const teamIdx = doubleActives[slot]
    if (teamIdx === undefined || !team[teamIdx] || team[teamIdx].hp <= 0) {
      const aliveSlot = doubleActives.findIndex(ti => ti !== undefined && team[ti] && team[ti].hp > 0)
      if (aliveSlot !== -1 && aliveSlot !== slot) setDoubleActiveSlot(aliveSlot)
    }
  }, [doubleActives, doubleActiveSlot, screen, team])

  // Si el objetivo seleccionado para un movimiento se debilitó, reasigna
  // automáticamente al primer enemigo vivo para no atacar a un rival caído.
  useEffect(() => {
    if (screen !== 'double') return
    const firstAlive = doubleEnemies.findIndex(e => e.hp > 0)
    setDoubleMoves(prev => {
      let changed = false
      const next = prev.map(sel => {
        if (!sel) return sel
        if (sel.target >= 0 && doubleEnemies[sel.target] && doubleEnemies[sel.target].hp > 0) return sel
        if (firstAlive === -1) return sel
        changed = true
        return { ...sel, target: firstAlive }
      })
      return changed ? next : prev
    })
  }, [doubleEnemies, screen])

  // Move node (intercambio de movimientos)
  const [moveOptions, setMoveOptions] = useState<Move[]>([])
  const [selectedNewMove, setSelectedNewMove] = useState<Move | null>(null)
  const [moveOptionsByIndex, setMoveOptionsByIndex] = useState<Record<number, Move[]>>({})
  const moveFromItemRef = useRef(false)

  // Egglocke
  const [eggInventory, setEggInventory] = useState<Array<{ name: string; sprite: string; types: string[]; hatchIn: number; id: number }>>([])

  const [pcStorage, setPcStorage] = useState<Pokemon[]>([])
  const [dragItem, setDragItem] = useState<{ type: 'team' | 'pc'; index: number } | null>(null)
  // Fuente real del arrastre (ref síncrona para los onDrop; el estado solo
  // sirve para la clase visual is-dragging).
  const dragSourceRef = useRef<{ type: 'team' | 'pc'; index: number } | null>(null)
  // Arrastre táctil: el HTML5 DnD no funciona con el dedo, así que se
  // implementa con Pointer Events (solo touch) como alternativa.
  const touchDragRef = useRef<{ type: 'team' | 'pc'; index: number; startX: number; startY: number; active: boolean } | null>(null)
  // Tras un arrastre el navegador dispara un "click" en la casilla de origen;
  // se suprime para que el reordenado no cambie además el Pokémon activo.
  const suppressClickRef = useRef(false)
  const [modifier2, setModifier2] = useState<RunModifier | null>(null)
  const [gauntletKeys, setGauntletKeys] = useState<Array<keyof RunChallenges>>([])

  // Speedrun timer
  const [speedrunSeconds, setSpeedrunSeconds] = useState<number>(0)
  const speedrunTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const megaNodeSpawnedRef = useRef(false)
  const [battleMegaUsed, setBattleMegaUsed] = useState(false)
  const [battleGmaxUsed, setBattleGmaxUsed] = useState(false)
  const [battlePrimalUsed, setBattlePrimalUsed] = useState(false)
  const [battleOriginUsed, setBattleOriginUsed] = useState(false)

  const runStartTimeRef = useRef<number>(0)
  const pendingScoreRef = useRef<InfiniteScoreInsert | null>(null)
  const showLeaderboardRef = useRef(false)
  const routeMapRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => { showLeaderboardRef.current = showLeaderboard }, [showLeaderboard])
  useEffect(() => {
    if (difficulty === 'infinite' && routeMapRef.current) {
      routeMapRef.current.scrollTop = routeMapRef.current.scrollHeight
    }
  }, [routeIndex, difficulty])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pokerand_pending_score')
      if (raw) {
        const parsed = JSON.parse(raw) as InfiniteScoreInsert & { route?: number }
        if (parsed.node === undefined && typeof parsed.route === 'number') parsed.node = parsed.route
        pendingScoreRef.current = parsed
      }
    } catch {
      pendingScoreRef.current = null
    }
  }, [])

  // Pokédex
  const [showPokedex, setShowPokedex] = useState<boolean>(false)
  const [pokedexMode, setPokedexMode] = useState<'normal' | 'shiny'>('normal')
  const [pokedexSearch, setPokedexSearch] = useState<string>('')
  const [selectedPokemonDetail, setSelectedPokemonDetail] = useState<PokemonDetails | null>(null)
  const [selectedPokemonShiny, setSelectedPokemonShiny] = useState<boolean>(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false)

  // Opciones / Volumen
  const [showOptions, setShowOptions] = useState<boolean>(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState<boolean>(false)
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false)
  const [showChangelog, setShowChangelog] = useState<boolean>(false)
  const [seenChangelogVersion, setSeenChangelogVersion] = useState<string>(() => {
    try { return localStorage.getItem('pokerand_seen_changelog') ?? '' } catch { return '' }
  })
  const [changelogExpanded, setChangelogExpanded] = useState<string | null>(null)
  const [language, setLanguageState] = useState<Language>(getLanguage())
  const changeLanguage = (lang: Language): void => {
    setI18nLanguage(lang)
    setLanguageState(lang)
    playClick()
  }
  const optionsBeganInBattle = useRef(false)
  const [volume, setVolumeState] = useState<number>(() => Math.round(getVolume() * 100))
  const [sfxVol, setSfxVolState] = useState<number>(() => Math.round(getSfxVolume() * 100))
  const [musicMuted, setMusicMutedState] = useState<boolean>(() => isMusicMuted())

  const [pokedex, setPokedex] = useState<Record<number, PokedexEntry>>(() => {
    try {
      const saved = localStorage.getItem('pokerand_pokedex')
      if (!saved) return {}
      const parsed = JSON.parse(saved)
      const migrated: Record<number, PokedexEntry> = {}
      for (const [key, val] of Object.entries(parsed) as [string, any][]) {
        const id = Number(key)
        let name: string = val.name ?? ''
        if (name.startsWith('legendary-')) {
          name = name.replace('legendary-', '')
        }
        const hasShinyData = !!(val.shinySeen || val.shinyCaught)
        const spriteLooksShiny = typeof val.sprite === 'string' && val.sprite.includes('/shiny/')
        const shinySprite = hasShinyData
          ? (typeof val.shinySprite === 'string' && val.shinySprite
            ? val.shinySprite
            : (spriteLooksShiny ? val.sprite : pokemonSpriteUrl(id, true)))
          : val.shinySprite
        // Migración: antes el sprite shiny sobrescribía el normal. Si la
        // entrada también está capturada en la Pokédex normal, restauramos el
        // sprite normal y conservamos el shiny en su propio campo.
        const normalSprite = val.caught && spriteLooksShiny ? pokemonSpriteUrl(id, false) : val.sprite
        migrated[id] = {
          ...val,
          name,
          sprite: normalSprite,
          shinySprite,
          seen: val.seen ?? true,
          caught: val.caught ?? true
        }
      }
      return migrated
    } catch {
      return {}
    }
  })

  const [record, setRecord] = useState(() => {
    const wins = Number(localStorage.getItem('pokerand_wins') ?? '0')
    const losses = Number(localStorage.getItem('pokerand_losses') ?? '0')
    return { wins, losses }
  })

  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>(() => loadMatchHistory())
  const [showMatchHistory, setShowMatchHistory] = useState(false)
  const [matchFilter, setMatchFilter] = useState<'all' | 'win' | 'loss'>('all')
  const [hoveredPoke, setHoveredPoke] = useState<{ idx: number; slot: number } | null>(null)

  const [winStreak, setWinStreak] = useState<number>(() => Number(localStorage.getItem('pokerand_streak') ?? '0'))
  const [bestStreak, setBestStreak] = useState<number>(() => Number(localStorage.getItem('pokerand_best_streak') ?? '0'))
  const [runStats, setRunStats] = useState<RunStats>({
    battlesWon: 0, battlesLost: 0, totalDamageDealt: 0, totalDamageTaken: 0,
    critsLanded: 0, superEffectiveHits: 0, koFirstTurn: 0, captures: 0,
    itemsUsed: 0, moneySpent: 0, moneyEarned: 0, nodesCleared: 0,
    teamSizeMax: 1, lowestHPEver: 999, totalTurns: 0, pokemonUsed: [],
    challengesActive: [], evolutions: 0
  })
  const [achievements, setAchievements] = useState<AchievementState>(() => {
    try {
      const saved = localStorage.getItem('pokerand_achievements')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const achievementsRef = useRef<AchievementState>(achievements)
  achievementsRef.current = achievements
  const typesMigrationRef = useRef(false)
  const [metaProgression, setMetaProgression] = useState<MetaProgression>(() => {
    try {
      const saved = localStorage.getItem('pokerand_meta')
      if (saved) {
        const data = JSON.parse(saved) as MetaProgression
        if (!data.ownedMusic) data.ownedMusic = []
        if (!data.activeMenuMusic) data.activeMenuMusic = 'default'
        if (!data.activeBattleMusic) data.activeBattleMusic = 'default'
        if (typeof data.totalMegas !== 'number') data.totalMegas = 0
        if (typeof data.totalGmax !== 'number') data.totalGmax = 0
        if (!Array.isArray(data.ownedBackgrounds)) data.ownedBackgrounds = ['none']
        if (!data.activeBackground) data.activeBackground = 'none'
        if (typeof data.gameboyMode !== 'boolean') data.gameboyMode = false
        if (!Array.isArray(data.disabledItems)) data.disabledItems = []
        return data
      }
    } catch { }
    return { pokeCoins: 0, totalRuns: 0, totalWins: 0, bestStreak: 0, unlockedStarters: [], permanentlyUnlockedItems: [], ownedThemes: ['dark'], activeTheme: 'dark', ownedBackgrounds: ['none'], activeBackground: 'none', ownedMusic: [], activeMenuMusic: 'default', activeBattleMusic: 'default', gameboyMode: false, totalMegas: 0, totalGmax: 0, coopRuns: 0, coopWins: 0, coopTrades: 0, disabledItems: [] }
  })

  const [secretModalOpen, setSecretModalOpen] = useState(false)
  const [secretPassword, setSecretPassword] = useState('')
  const [secretUnlocked, setSecretUnlocked] = useState(false)
  const [secretMsg, setSecretMsg] = useState<{ text: string; error: boolean } | null>(null)
  const secretKeyBufferRef = useRef('')
  const [secretAddOpen, setSecretAddOpen] = useState(false)
  const [secretPokemonQuery, setSecretPokemonQuery] = useState('')
  const [secretAddLoading, setSecretAddLoading] = useState(false)
  const [secretAddError, setSecretAddError] = useState('')
  const [showAchievements, setShowAchievements] = useState<boolean>(false)
  const [showMinigamePractice, setShowMinigamePractice] = useState<boolean>(false)
  const [showResetModal, setShowResetModal] = useState<boolean>(false)
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null)
  const [dexToast, setDexToast] = useState<string | null>(null)
  const dexToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [shinyNextEncounter, setShinyNextEncounter] = useState<boolean>(false)
  const [legendaryNextEncounter, setLegendaryNextEncounter] = useState<boolean>(false)
  const dailySeed = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  })()
  const dailySeedRef = useRef(dailySeed)
  const [dailyPlayed, setDailyPlayed] = useState<boolean>(() => {
    try { return localStorage.getItem('pokerand_daily') === dailySeedRef.current } catch { return false }
  })
  const isDailyRunRef = useRef(false)
  const preDailyDifficultyRef = useRef<Difficulty | null>(null)

  // --- Modo cooperativo ---
  const [coopMode, setCoopMode] = useState<boolean>(false)
  const coopModeRef = useRef(false)
  const [coopSessionCode, setCoopSessionCode] = useState<string>('')
  const coopSessionCodeRef = useRef('')
  const [coopSeed, setCoopSeed] = useState<string>('')
  const coopSeedRef = useRef('')
  const [coopMyRole, setCoopMyRole] = useState<'a' | 'b' | null>(null)
  const coopMyRoleRef = useRef<'a' | 'b' | null>(null)
  const [coopGen, setCoopGen] = useState<number>(1)
  const coopGenRef = useRef(1)
  const [coopDiff, setCoopDiff] = useState<'easy' | 'medium' | 'hard'>('medium')
  const coopDiffRef = useRef<'easy' | 'medium' | 'hard'>('medium')
  const [coopPartnerJoined, setCoopPartnerJoined] = useState<boolean>(false)
  const [coopJoinCode, setCoopJoinCode] = useState<string>('')
  const [coopWaiting, setCoopWaiting] = useState<boolean>(false)
  const [coopStarting, setCoopStarting] = useState<boolean>(false)
  const coopAutoStartedRef = useRef(false)
  const coopRestartInitiatedRef = useRef(false)
  const [coopWaitingNode, setCoopWaitingNode] = useState<number>(0)
  const [coopSessionEndedMsg, setCoopSessionEndedMsg] = useState<string>('')
  const [coopMyOffer, setCoopMyOffer] = useState<CoopTrade['offer'] | null>(null)
  const [coopMyOfferSubmitted, setCoopMyOfferSubmitted] = useState<boolean>(false)
  const coopSubmittedOfferRef = useRef<CoopTrade['offer'] | null>(null)
  const coopExchangeAppliedRef = useRef(false)
  const coopSelectedPokemonRef = useRef<Pokemon | null>(null)
  const [coopExchange, setCoopExchange] = useState<CoopExchange | null>(null)
  const [coopTradeMsg, setCoopTradeMsg] = useState<string>('')
  const [coopError, setCoopError] = useState<string>('')
  const [coopRestartBlockedMsg, setCoopRestartBlockedMsg] = useState<string>('')
  const [coopChatOpen, setCoopChatOpen] = useState<boolean>(false)
  const [coopChatMsgs, setCoopChatMsgs] = useState<CoopChatMessage[]>([])
  const [coopChatText, setCoopChatText] = useState<string>('')
  const coopChatLastRef = useRef<string | null>(null)
  const coopChatPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { coopModeRef.current = coopMode }, [coopMode])
  useEffect(() => { coopSessionCodeRef.current = coopSessionCode }, [coopSessionCode])
  useEffect(() => { coopSeedRef.current = coopSeed }, [coopSeed])
  useEffect(() => { coopMyRoleRef.current = coopMyRole }, [coopMyRole])
  useEffect(() => { coopGenRef.current = coopGen }, [coopGen])
  useEffect(() => { coopDiffRef.current = coopDiff }, [coopDiff])

  // --- Modo PvP 1vs1 ---
  const [showPvpModal, setShowPvpModal] = useState<boolean>(false)
  const [pvpTeams, setPvpTeams] = useState<Pokemon[][]>(() => {
    try {
      const raw = localStorage.getItem('pokerand_pvp_teams')
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed) && parsed.length >= 1) {
          return Array.from({ length: 3 }, (_, i) => (parsed[i] && Array.isArray(parsed[i]) ? (parsed[i] as Pokemon[]) : []))
        }
      }
    } catch { /* ignore */ }
    // Migración: el antiguo equipo único pasa a la ranura 1.
    try {
      const old = localStorage.getItem('pokerand_pvp_team')
      if (old) return [JSON.parse(old) as Pokemon[], [], []]
    } catch { /* ignore */ }
    return [[], [], []]
  })

  // Migración: re-parsea los moves guardados sin `ailment` (equipos PvP de
  // versiones anteriores) consultando PokeAPI, para que el texto azul del
  // efecto se muestre siempre que el movimiento aplique un estado.
  const pvpTeamsRef = useRef(pvpTeams)
  useEffect(() => { pvpTeamsRef.current = pvpTeams }, [pvpTeams])
  useEffect(() => {
    const migrate = async () => {
      const teams = pvpTeamsRef.current
      let changed = false
      const migrated = await Promise.all(teams.map(async (team) => {
        if (team.length === 0) return team
        const newTeam = await Promise.all(team.map(async (p) => {
          const needsFix = p.moves.some((m) => (m.metaCategory === 'damage-ailment' || m.metaCategory === 'net-good-stats' || m.metaCategory === 'net-bad-stats') && !m.ailment && !m.statChanges)
          if (!needsFix) return p
          const fixedMoves = await Promise.all(p.moves.map(async (m) => {
            if (!m.url) return m
            try {
              const fresh = await getMoveDetails(m.url)
              if (fresh) return { ...m, ailment: fresh.ailment, ailmentChance: fresh.ailmentChance, statChanges: fresh.statChanges }
            } catch { /* keep old */ }
            return m
          }))
          if (fixedMoves.some((m, i) => m.ailment !== p.moves[i]?.ailment || m.statChanges !== p.moves[i]?.statChanges)) changed = true
          return { ...p, moves: fixedMoves }
        }))
        return newTeam
      }))
      if (!changed) return
      setPvpTeams(migrated)
      localStorage.setItem('pokerand_pvp_teams', JSON.stringify(migrated))
    }
    void migrate()
  }, [])

  const [pvpActiveSlot, setPvpActiveSlot] = useState<number>(() => {
    const n = Number(localStorage.getItem('pokerand_pvp_active_slot') ?? 0)
    return n >= 0 && n <= 2 ? n : 0
  })
  const pvpTeam = pvpTeams[pvpActiveSlot] ?? []
  const [showPvpTeamBuilder, setShowPvpTeamBuilder] = useState<boolean>(false)
  const [pvpBuildTeam, setPvpBuildTeam] = useState<Pokemon[]>([])
  const [pvpBuildSelected, setPvpBuildSelected] = useState<number | null>(null)
  const [pvpBuildSelectedShiny, setPvpBuildSelectedShiny] = useState<boolean>(false)
  const [pvpBuildDexMode, setPvpBuildDexMode] = useState<'normal' | 'shiny'>('normal')
  const [pvpBuildMoves, setPvpBuildMoves] = useState<Move[]>([])
  const [pvpBuildSelectedMoveNames, setPvpBuildSelectedMoveNames] = useState<Set<string>>(new Set())
  const [pvpBuildLoading, setPvpBuildLoading] = useState<boolean>(false)
  const [pvpBuildSearch, setPvpBuildSearch] = useState<string>('')
  const [pvpSearching, setPvpSearching] = useState<boolean>(false)
  const [pvpRoomCode, setPvpRoomCode] = useState<string>('')
  const [pvpJoinCode, setPvpJoinCode] = useState<string>('')
  const [pvpWaitingOpponent, setPvpWaitingOpponent] = useState<boolean>(false)
  const [pvpError, setPvpError] = useState<string>('')
  const [pvpMatchId, setPvpMatchId] = useState<string | null>(null)
  const pvpMatchIdRef = useRef<string | null>(null)
  const [pvpRole, setPvpRole] = useState<'a' | 'b' | null>(null)
  const [pvpSnapshot, setPvpSnapshot] = useState<PvpTurnSnapshot | null>(null)
  const [pvpMyAction, setPvpMyAction] = useState<PvpAction | null>(null)
  const [pvpMyActionTurn, setPvpMyActionTurn] = useState<number>(-1)
  const [pvpChoosingSwitch, setPvpChoosingSwitch] = useState<boolean>(false)
  const [pvpTimerLeft, setPvpTimerLeft] = useState<number>(0)
  const [pvpHit, setPvpHit] = useState<{ side: 'a' | 'b'; key: number } | null>(null)
  const [pvpMyElo, setPvpMyElo] = useState<number>(0)
  const [pvpOppElo, setPvpOppElo] = useState<number>(0)
  const [pvpEloGain, setPvpEloGain] = useState<number | null>(null)
  const [pvpEloRewarded, setPvpEloRewarded] = useState<boolean>(false)
  const pvpEloRewardedRef = useRef(false)
  const pvpPrevTeamHpRef = useRef<{ a: number[]; b: number[] }>({ a: [], b: [] })
  const pvpTimerTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pvpLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pvpResolvingRef = useRef(false)
  const pvpSearchingRef = useRef(false)
  useEffect(() => { pvpSearchingRef.current = pvpSearching }, [pvpSearching])

  useEffect(() => { pvpMatchIdRef.current = pvpMatchId }, [pvpMatchId])

  const [activeRandomEvent, setActiveRandomEvent] = useState<{ id: string; icon: string; title: string; desc: string } | null>(null)
  const routeSeedRef = useRef('')
  const routeRandRef = useRef<() => number>(() => Math.random())
  const teamRef = useRef<Pokemon[]>([])
  const daycareEggRef = useRef<DaycareEgg | null>(null)
  useEffect(() => { teamRef.current = team; daycareEggRef.current = daycareEgg }, [team, daycareEgg])

  const weatherStationRef = useRef<{ weather: Exclude<WeatherKind, 'none'>; battlesLeft: number } | null>(null)
  useEffect(() => { weatherStationRef.current = weatherStation }, [weatherStation])

  // El huevo ocupa una casilla del equipo mientras se lleva encima.
  function teamHasRoom(currentTeam: Pokemon[]): boolean {
    return currentTeam.length + (daycareEggRef.current ? 1 : 0) < maxTeamSize
  }

  function chooseWeatherStation(nextWeather: Exclude<WeatherKind, 'none'>): void {
    const next = { weather: nextWeather, battlesLeft: 2 }
    weatherStationRef.current = next
    setWeatherStation(next)
    playSelect()
  }

  // Consume un combate del clima elegido en la Estación Meteorológica.
  function consumeWeatherStation(): WeatherKind | null {
    const current = weatherStationRef.current
    if (!current || current.battlesLeft <= 0) return null
    const remaining = current.battlesLeft - 1
    const next = remaining > 0 ? { ...current, battlesLeft: remaining } : null
    weatherStationRef.current = next
    setWeatherStation(next)
    return current.weather
  }

  // Al mostrar el mapa de rutas, precargar la generación en segundo plano para
  // que entrar en un nodo sea casi instantáneo (las llamadas son idempotentes
  // gracias a la caché en memoria, así que repetirlas es gratuito).
  useEffect(() => {
    if (screen === 'route' && currentRunGen > 0) {
      preloadGeneration(currentRunGen)
    }
  }, [screen, currentRunGen])
  const [traderModal, setTraderModal] = useState<boolean>(false)
  const [merchantItems, setMerchantItems] = useState<Array<{ name: string; price: number }> | null>(null)
  const [randomEventUsed, setRandomEventUsed] = useState<Set<string>>(new Set())
  const [showMetaShop, setShowMetaShop] = useState<boolean>(false)
  const [metaShopSearch, setMetaShopSearch] = useState('')
  const [unlockPopup, setUnlockPopup] = useState<{ name: string; spriteKey: string } | null>(null)
  const [badges, setBadges] = useState<Array<{ id: string; name: string; sprite: string }>>([])
  const [currentStage, setCurrentStage] = useState<number>(1)
  const [stageNotice, setStageNotice] = useState<{ medal: { name: string; sprite: string }; stage: number } | null>(null)

  const currentNode = useMemo(() => route[routeIndex] ?? null, [route, routeIndex])
  const activePokemon = useMemo(() => team[activeIndex] ?? null, [team, activeIndex])

  useEffect(() => {
    if (!stageNotice) return
    playBadgeFanfare()
    const timer = window.setTimeout(() => setStageNotice(null), 2400)
    return () => window.clearTimeout(timer)
  }, [stageNotice])
  const inventoryEntries = useMemo(() => groupInventory(inventory), [inventory])
  const inventoryOrderRef = useRef<string[]>([])
  const inventorySlotEntries = useMemo(() => {
    const entriesByName = new Map(inventoryEntries.map((entry) => [entry.name, entry]))
    const activeNames = new Set(entriesByName.keys())
    inventoryOrderRef.current = inventoryOrderRef.current.filter((name) => activeNames.has(name))
    for (const entry of inventoryEntries) {
      if (!inventoryOrderRef.current.includes(entry.name)) inventoryOrderRef.current.push(entry.name)
    }
    return inventoryOrderRef.current.flatMap((name) => {
      const entry = entriesByName.get(name)
      return entry ? [entry] : []
    })
  }, [inventoryEntries])

  useEffect(() => {
    if (screen === 'setup') inventoryOrderRef.current = []
  }, [screen])

  // Habilidades de entrada: se aplican una vez al comenzar cada batalla y se
  // resetean al salir del combate (junto con el clima).
  const entryAbilitiesAppliedRef = useRef(false)
  useEffect(() => {
    if (screen !== 'battle' && screen !== 'double') {
      entryAbilitiesAppliedRef.current = false
      setWeather('none')
    }
  }, [screen])

  useEffect(() => { startMenuMusic() }, [])

  // Precarga diferida de las pantallas pesadas para no bloquear el primer render.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import('./dungeon/DungeonMode')
      void import('./pokest/PokestDungeon')
      void import('./minigames/CasinoMinigame')
      void import('./minigames/MinigamePractice')
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!showIntro) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [showIntro])

  // Desbloquear el audio en la primera interacción (los navegadores bloquean el
  // autoplay con sonido hasta que el usuario hace clic/toca/teclea).
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('touchstart', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('touchstart', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Restaurar sesión de Supabase y reaccionar a cambios de login/logout
  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null
    void getCurrentUser().then((user) => {
      if (!cancelled) setAuthUser(user)
    })
    void onAuthChange((user) => {
      if (cancelled) return
      setAuthUser(user)
      if (user) void submitPendingScore()
    }).then((cleanup) => {
      if (cancelled) cleanup()
      else unsubscribe = cleanup
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset mega/gmax state when battle ends
  useEffect(() => {
    if (screen === 'defeat' || screen === 'victory') {
      setTeam(prev => prev.map((p) => {
        const reset = { statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, furiaActive: false }
        const orig = p.megaOrig
        if (orig) return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, originEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, ...orig, ...reset }
        return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, originEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, ...reset }
      }))
      setBattleMegaUsed(false)
      setBattleGmaxUsed(false)
      setBattlePrimalUsed(false)
      setBattleOriginUsed(false)
    }
  }, [screen])

  // Speedrun: auto-defeat when timer reaches 0
  useEffect(() => {
    if (runChallenges.speedrun && speedrunSeconds === 0 && screen === 'battle') {
      if (speedrunTimerRef.current) {
        clearInterval(speedrunTimerRef.current)
        speedrunTimerRef.current = null
      }
      const fullLogs = ['⏱️ ¡Tiempo agotado! Has perdido por Speedrun.', ...battleLog]
      setBattleLog(fullLogs)
      setDefeatSummary({
        finalTeam: team,
        battleLog: fullLogs,
        enemy: enemy,
        lastNodeLabel: currentNode?.label
      })
      handleInfiniteRunDefeat(team)
      const losses = record.losses + 1
      persistRecord(record.wins, losses)
      recordFinishedRun('loss', team)
      if (isDailyRunRef.current) {
        setDailyPlayed(true)
        localStorage.setItem('pokerand_daily', dailySeed)
      }
      setScreen('defeat')
      playDefeatMusic()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedrunSeconds])

  useEffect(() => {
    const theme = THEMES.find(t => t.id === metaProgression.activeTheme) ?? THEMES[0]
    const root = document.documentElement
    root.setAttribute('data-theme', theme.id)
    if (theme.id === 'dark') {
      root.style.removeProperty('--bg-dark')
      root.style.removeProperty('--surface')
      root.style.removeProperty('--border')
      root.style.removeProperty('--text')
      root.style.removeProperty('--accent')
      root.style.removeProperty('--muted')
    } else {
      root.style.setProperty('--bg-dark', theme.colors.bg)
      root.style.setProperty('--surface', theme.colors.surface)
      root.style.setProperty('--border', theme.colors.border)
      root.style.setProperty('--text', theme.colors.text)
      root.style.setProperty('--accent', theme.colors.accent)
      root.style.removeProperty('--muted')
      root.style.setProperty('--muted', theme.colors.muted)
    }
    document.body.style.color = theme.colors.text
  }, [metaProgression.activeTheme])

  // Rediseño Game Boy: aplica el atributo que activa el estilo de consola.
  useEffect(() => {
    const root = document.documentElement
    if (metaProgression.gameboyMode) root.setAttribute('data-gameboy', 'true')
    else root.removeAttribute('data-gameboy')
  }, [metaProgression.gameboyMode])

  // Detecta equipos que no mantienen una tasa de refresco fluida y pausa los
  // fondos animados para priorizar la jugabilidad.
  useEffect(() => {
    if (lowPerformance) return
    let raf = 0
    let frames = 0
    let start = 0
    const timer = window.setTimeout(() => {
      const sample = (now: number): void => {
        if (!start) start = now
        frames++
        if (now - start < 2000) {
          raf = requestAnimationFrame(sample)
          return
        }
        const fps = frames / ((now - start) / 1000)
        if (fps < 40 && document.visibilityState === 'visible') {
          setLowPerformance(true)
          try { localStorage.setItem('pokerand_low_performance', '1') } catch {}
        }
      }
      raf = requestAnimationFrame(sample)
    }, 3000)
    return () => { window.clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [lowPerformance])

  // Preferencias de accesibilidad y ritmo de combate.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-reduce-animations', String(accessibility.reduceAnimations))
    root.setAttribute('data-low-performance', String(lowPerformance))
    root.setAttribute('data-high-contrast', String(accessibility.highContrast))
    root.setAttribute('data-colorblind', String(accessibility.colorBlind))
    root.setAttribute('data-readable-font', String(accessibility.readableFont))
    root.setAttribute('data-battle-speed', String(accessibility.battleSpeed))
    root.style.fontSize = `${Math.max(85, Math.min(130, accessibility.textScale))}%`
    localStorage.setItem('pokerand_accessibility', JSON.stringify(accessibility))
  }, [accessibility, lowPerformance])

  // Código secreto: escribir "adminsub" abre el modal de contraseña del modo secreto.
  useEffect(() => {
    const SECRET = 'adminsub'
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      const key = e.key.toLowerCase()
      if (key.length === 1) {
        secretKeyBufferRef.current = (secretKeyBufferRef.current + key).slice(-SECRET.length)
        if (secretKeyBufferRef.current === SECRET) {
          secretKeyBufferRef.current = ''
          setSecretPassword('')
          setSecretMsg(null)
          setSecretModalOpen(true)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function submitSecretPassword(): void {
    if (secretPassword === 'admin123') {
      setSecretUnlocked(true)
      setSecretModalOpen(false)
      setSecretPassword('')
      setSecretMsg({ text: '🔓 ¡Has desbloqueado el modo secreto!', error: false })
      setTimeout(() => setSecretMsg(null), 2500)
    } else {
      setSecretModalOpen(false)
      setSecretPassword('')
      setSecretMsg({ text: '❌ Te has equivocado', error: true })
      setTimeout(() => setSecretMsg(null), 2000)
    }
  }

  function addSecretCoins(): void {
    setMetaProgression(prev => {
      const updated = { ...prev, pokeCoins: prev.pokeCoins + 100 }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
  }

  // Modo secreto: activa TODA la Pokédex (todas las especies como vistas y capturadas).
  async function unlockAllPokedex(): Promise<void> {
    setSecretAddLoading(true)
    setSecretAddError('')
    try {
      const species = await getAllSpeciesList()
      const entries: Record<number, PokedexEntry> = {}
      for (const s of species) {
        entries[s.id] = {
          id: s.id,
          name: s.name,
          sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${s.id}.png`,
          types: [],
          seen: true,
          caught: true,
        }
      }
      setPokedex(prev => {
        const updated = { ...prev, ...entries }
        localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
        return updated
      })
      setBattleLog((prev) => [t('b.secretDexUnlocked', { n: species.length }), ...prev].slice(0, 15))
      // Rellena los tipos de cada especie en lotes en segundo plano para que los
      // logros de Pokédex (p. ej. Maestro de Tipos) funcionen con la Pokédex
      // completa.
      void (async () => {
        const BATCH = 60
        for (let i = 0; i < species.length; i += BATCH) {
          const batch = species.slice(i, i + BATCH)
          const typesResults = await Promise.all(batch.map(s => fetchPokemonTypes(s.id).catch(() => [] as string[])))
          setPokedex(prev => {
            const updated = { ...prev }
            batch.forEach((s, idx) => {
              if (updated[s.id] && typesResults[idx].length > 0) {
                updated[s.id] = { ...updated[s.id], types: typesResults[idx] }
              }
            })
            localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
            return updated
          })
        }
      })()
    } catch {
      setSecretAddError('No se pudo cargar la lista de especies.')
    } finally {
      setSecretAddLoading(false)
    }
  }

  async function secretAddPokemon(): Promise<void> {
    const query = secretPokemonQuery.trim()
    if (!query) return
    setSecretAddLoading(true)
    setSecretAddError('')
    try {
      const level = activePokemon?.level ?? team[0]?.level ?? 50
      const pokemon = await buildPokemonFromApi(query, getEffectiveGen(), level, false)
      registerInPokedex(pokemon)
      const withStages: Pokemon = { ...pokemon, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, hp: pokemon.maxHp }
      if (teamHasRoom(team)) {
        setTeam(prev => [...prev, withStages])
      } else {
        setPcStorage(prev => [...prev, withStages])
      }
      setBattleLog(prev => [t('b.secretAdded', { name: pokemon.name, lvl: pokemon.level, toPc: !teamHasRoom(team) ? t('b.toPc') : '' }), ...prev].slice(0, 15))
      setSecretPokemonQuery('')
      setSecretAddOpen(false)
    } catch {
      setSecretAddError('No se encontró ese Pokémon en PokeAPI. Usa un ID o un nombre válido (ej. 25, pikachu).')
    } finally {
      setSecretAddLoading(false)
    }
  }

  function buyMetaItem(item: MetaShopItem): void {
    if (isMetaItemLocked(item)) return
    if (metaProgression.pokeCoins < item.price) return
    if (item.category === 'theme') {
      if (metaProgression.ownedThemes.includes(item.id)) return
      const updated = { ...metaProgression, pokeCoins: metaProgression.pokeCoins - item.price, ownedThemes: [...metaProgression.ownedThemes, item.id] }
      setMetaProgression(updated)
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      setUnlockPopup({ name: item.name, spriteKey: 'Potion' })
      setTimeout(() => setUnlockPopup(null), 3000)
      return
    }
    if (item.category === 'music') {
      if (metaProgression.ownedMusic.includes(item.id)) return
      const updated = { ...metaProgression, pokeCoins: metaProgression.pokeCoins - item.price, ownedMusic: [...metaProgression.ownedMusic, item.id] }
      setMetaProgression(updated)
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      setUnlockPopup({ name: item.name, spriteKey: 'Potion' })
      setTimeout(() => setUnlockPopup(null), 3000)
      return
    }
    if (metaProgression.permanentlyUnlockedItems.includes(item.id)) return
    const updated = { ...metaProgression, pokeCoins: metaProgression.pokeCoins - item.price, permanentlyUnlockedItems: [...metaProgression.permanentlyUnlockedItems, item.id] }
    if (item.id === 'gameboy') updated.gameboyMode = true
    setMetaProgression(updated)
    localStorage.setItem('pokerand_meta', JSON.stringify(updated))
    setUnlockPopup({ name: item.name, spriteKey: 'spriteKey' in item ? (item as MetaShopItem).spriteKey : 'Potion' })
    setTimeout(() => setUnlockPopup(null), 3000)
  }

  // Marca/desmarca un objeto desbloqueado para que aparezca (o no) en la partida.
  // Se envuelve en startTransition para que la casilla responda al instante y el
  // re-render pesado de la app no bloquee la interfaz.
  const toggleItemEnabled = (id: string): void => {
    startTransition(() => {
      setMetaProgression(prev => {
        const disabled = prev.disabledItems ?? []
        const updated = { ...prev, disabledItems: disabled.includes(id) ? disabled.filter(d => d !== id) : [...disabled, id] }
        localStorage.setItem('pokerand_meta', JSON.stringify(updated))
        return updated
      })
    })
  }

  function setTheme(themeId: string): void {
    if (!metaProgression.ownedThemes.includes(themeId)) return
    const updated = { ...metaProgression, activeTheme: themeId }
    setMetaProgression(updated)
    localStorage.setItem('pokerand_meta', JSON.stringify(updated))
  }

  function setBackground(bgId: string): void {
    if (!metaProgression.ownedBackgrounds.includes(bgId)) return
    const updated = { ...metaProgression, activeBackground: bgId }
    setMetaProgression(updated)
    localStorage.setItem('pokerand_meta', JSON.stringify(updated))
  }

  function buyBackground(bg: (typeof BACKGROUNDS)[number]): void {
    if (bg.id === 'none') return
    if (metaProgression.ownedBackgrounds.includes(bg.id)) return
    if (metaProgression.pokeCoins < bg.price) return
    const updated = { ...metaProgression, pokeCoins: metaProgression.pokeCoins - bg.price, ownedBackgrounds: [...metaProgression.ownedBackgrounds, bg.id], activeBackground: bg.id }
    setMetaProgression(updated)
    localStorage.setItem('pokerand_meta', JSON.stringify(updated))
    setUnlockPopup({ name: bgName(bg.id), spriteKey: 'Potion' })
    setTimeout(() => setUnlockPopup(null), 3000)
  }

  const LOCKED_CONSUMABLE_MAP: Record<string, string> = {
    unlock_hyper_potion: 'Hyper Potion',
    unlock_full_restore: 'Full Restore',
    unlock_max_revive: 'Max Revive',
    unlock_rare_candy: 'Rare Candy',
    unlock_nature_machine: 'Máquina de Naturalezas',
    unlock_iv_reroll: 'Reroll de IVs',
    unlock_ability_capsule: 'Cápsula de Habilidad',
    unlock_elixir: 'Elixir',
    unlock_super_elixir: 'Super Elixir',
    unlock_full_elixir: 'Full Elixir',
    unlock_x_attack_2: 'X Attack 2',
    unlock_x_defense_2: 'X Defense 2',
    unlock_x_speed_2: 'X Speed 2',
    unlock_x_sp_attack_2: 'X Sp. Attack 2',
    unlock_x_sp_defense_2: 'X Sp. Defense 2',
    unlock_smoke_ball: 'Cuerda Huida',
    unlock_poke_radar: 'Poké Radar',
    unlock_azure_flute: 'Flauta Celeste',
    unlock_moomoo_milk: 'Moomoo Milk',
    unlock_berry_juice: 'Berry Juice',
    unlock_fresh_water: 'Fresh Water',
    unlock_soda_pop: 'Soda Pop',
    unlock_lemonade: 'Lemonade',
    unlock_disco_mt: 'Disco MT',
    unlock_protein: 'Proteína',
    unlock_calcium: 'Calcio',
    unlock_iron: 'Hierro',
    unlock_zinc: 'Zinc',
    unlock_carbos: 'Carburante',
    unlock_sacred_ash: 'Sacred Ash',
    unlock_polvo_energia: 'Polvo Energía',
    unlock_raiz_energia: 'Raíz Energía',
    unlock_polvo_curacion: 'Polvo Curación',
    unlock_mas_ps: 'Más PS',
    unlock_perla_grande: 'Perla Grande',
    unlock_seta_pequena: 'Seta Pequeña',
    unlock_polvo_estelar: 'Polvo Estelar',
    unlock_seta_grande: 'Seta Grande',
    unlock_perla: 'Perla',
    unlock_corazon_marino: 'Corazón Marino',
    unlock_correo_aereo: 'Correo Aéreo',
    unlock_fragmento_estelar: 'Fragmento Estelar',
    unlock_pieza_dorada: 'Pieza Dorada',
    unlock_perla_rara: 'Perla Rara',
    unlock_cometa: 'Cometa',
    unlock_pieza_dorada_2: 'Pieza Dorada II',
    unlock_hueso_raro: 'Hueso Raro',
    unlock_miel: 'Miel',
    unlock_fragmento_rojo: 'Fragmento Rojo',
    unlock_fragmento_azul: 'Fragmento Azul',
    unlock_fragmento_amarillo: 'Fragmento Amarillo',
    unlock_fragmento_verde: 'Fragmento Verde',
    unlock_antidoto: 'Antídoto',
    unlock_antiquemar: 'Antiquemar',
    unlock_paralizador: 'Paralizador',
    unlock_despertar: 'Despertar',
    unlock_descongelar: 'Descongelar',
    unlock_baya_caquic: 'Baya Caquic',
    unlock_baya_zreza: 'Baya Zreza',
    unlock_baya_atania: 'Baya Atania',
    unlock_baya_algama: 'Baya Algama',
    unlock_baya_safre: 'Baya Safre',
    unlock_baya_siendrepis: 'Baya Siendrepis',
    unlock_baya_cuaja: 'Baya Cuaja',
    unlock_baya_wiki: 'Baya Wiki',
    unlock_baya_mago: 'Baya Mago',
    unlock_baya_aguav: 'Baya Aguav',
    unlock_baya_ango: 'Baya Ango',
  }
  const LOCKED_HOLDABLE_MAP: Record<string, string> = {
    unlock_muscle_band: 'Muscle Band',
    unlock_wise_glasses: 'Wise Glasses',
    unlock_choice_band: 'Choice Band',
    unlock_leftovers: 'Leftovers',
    unlock_focus_sash: 'Focus Sash',
    unlock_assault_vest: 'Assault Vest',
    unlock_quick_claw: 'Quick Claw',
    unlock_eviolite: 'Eviolite',
    unlock_life_orb: 'Life Orb',
    unlock_rocky_helmet: 'Rocky Helmet',
    unlock_scope_lens: 'Scope Lens',
    unlock_shell_bell: 'Shell Bell',
    unlock_choice_scarf: 'Choice Scarf',
    unlock_babiri_berry: 'Babiri Berry',
    unlock_big_root: 'Big Root',
    unlock_wide_lens: 'Wide Lens',
    unlock_telescopio: 'Telescopio',
    unlock_sitrus_berry: 'Sitrus Berry',
    unlock_guts_band: 'Choice Specs',
    unlock_vest_protector: 'Charcoal',
    unlock_focus_band: 'Focus Band',
    unlock_dragon_fang: 'Dragon Fang',
    unlock_guardian_charm: 'Mystic Water',
    unlock_berserker_band: 'Expert Belt',
    unlock_phantom_cloak: 'Miracle Seed',
    unlock_swift_feather: 'Sharp Beak',
    unlock_iron_ball: 'Iron Ball',
    unlock_vampire_fang: 'Black Glasses',
    unlock_cursed_blade: 'Twisted Spoon',
    unlock_focus_sash_2: 'Focus Sash II',
    unlock_scope_lens_2: 'Scope Lens II',
    unlock_shell_bell_2: 'Shell Bell II',
    unlock_assault_vest_2: 'Assault Vest II',
    unlock_leftovers_2: 'Leftovers II',
    unlock_quick_claw_2: 'Quick Claw II',
    unlock_repartir_exp: 'Repartir Exp',
    unlock_tarjeta_roja: 'Tarjeta Roja',
    unlock_diamansfera: 'Diamansfera',
    unlock_lustresfera: 'Lustresfera',
    unlock_griseosfera: 'Griseosfera',
    unlock_baya_oca: 'Baya Oca',
    unlock_baya_kasib: 'Baya Kasib',
    unlock_baya_meloc: 'Baya Shuca',
    unlock_baya_zidra: 'Baya Coba',
    unlock_baya_aou: 'Baya Charti',
    unlock_baya_perismon: 'Baya Payapa',
    unlock_baya_colbur: 'Baya Colbur',
    unlock_baya_waca: 'Baya Waca',
    unlock_baya_rindo: 'Baya Rindo',
    unlock_baya_chilan: 'Baya Chilan',
    unlock_clear_amulet: 'Amuleto Claro',
    unlock_safety_goggles: 'Gafas Protectoras',
    unlock_covert_cloak: 'Capa Furtiva',
    unlock_loaded_dice: 'Dado Cargado',
    unlock_weakness_policy: 'Seguro Debilidad',
    unlock_air_balloon: 'Globo Helio',
    unlock_white_herb: 'Hierba Blanca',
    unlock_mental_herb: 'Hierba Mental',
    unlock_throat_spray: 'Espray Bucal',
    unlock_protective_pads: 'Guantes Protectores',
  }

  // Una baya está desbloqueada según el mapa al que pertenezca (consumible o
  // equipable). Las que no están en ningún mapa (Oran/Lum) siempre están libres.
  // "isItemEnabled": el jugador puede desmarcar un objeto desbloqueado en la
  // Tienda Meta para que no aparezca en la partida (por defecto todos activos).
  const isItemEnabled = (id: string) => !metaProgression.disabledItems.includes(id)
  const isActive = (id: string) => metaProgression.permanentlyUnlockedItems.includes(id) && isItemEnabled(id)
  const isConsumableUnlocked = (name: string) => {
    const key = Object.keys(LOCKED_CONSUMABLE_MAP).find(k => LOCKED_CONSUMABLE_MAP[k] === name)
    if (!key) return true
    return metaProgression.permanentlyUnlockedItems.includes(key) && isItemEnabled(key)
  }
  const isHoldableUnlocked = (name: string) => {
    const key = Object.keys(LOCKED_HOLDABLE_MAP).find(k => LOCKED_HOLDABLE_MAP[k] === name)
    if (!key) return true
    return metaProgression.permanentlyUnlockedItems.includes(key) && isItemEnabled(key)
  }
  const isPokeballUnlocked = (name: string) => {
    if (name === 'Poké Ball') return true
    const unlockId = POKEBALL_UNLOCK_IDS[name]
    if (!unlockId) return true
    return metaProgression.permanentlyUnlockedItems.includes(unlockId) && isItemEnabled(unlockId)
  }
  const isEvolutionStoneUnlocked = (name: string) => {
    const unlockId = EVOLUTION_STONE_UNLOCK_IDS[name]
    if (!unlockId) return true
    return metaProgression.permanentlyUnlockedItems.includes(unlockId) && isItemEnabled(unlockId)
  }
  const isBerryUnlocked = (name: string) => {
    if (Object.values(LOCKED_CONSUMABLE_MAP).includes(name)) return isConsumableUnlocked(name)
    if (Object.values(LOCKED_HOLDABLE_MAP).includes(name)) return isHoldableUnlocked(name)
    return true
  }
  // Un objeto solo puede venderse en tiendas/Mercado Negro si su categoría
  // concreta (consumible, ball, piedra u objeto equipable) está desbloqueada.
  const isShopItemUnlocked = (name: string) => {
    if (TREASURES.includes(name)) return false
    if (HOLDABLE_ITEMS[name]) return isHoldableUnlocked(name)
    if (POKEBALL_NAMES.includes(name)) return isPokeballUnlocked(name)
    if ((EVOLUTION_STONES as readonly string[]).includes(name)) return isEvolutionStoneUnlocked(name)
    return isConsumableUnlocked(name)
  }

  // Master Ball y Entebola requieren el resto de Poké Balls. Se excluyen entre
  // sí para no crear un requisito circular imposible de completar.
  const missingRequiredBalls = (item: MetaShopItem): string[] => {
    if (!item.requiresAllBalls) return []
    return META_SHOP_ITEMS
      .filter(other => other.category === 'pokeball'
        && other.id !== 'unlock_master_ball'
        && other.id !== 'unlock_ente_ball'
        && !metaProgression.permanentlyUnlockedItems.includes(other.id))
      .map(other => other.name)
  }

  const isMetaItemLocked = (item: MetaShopItem): boolean => {
    if (item.requires && !metaProgression.permanentlyUnlockedItems.includes(item.requires)) return true
    if (item.requiresAllBalls && missingRequiredBalls(item).length > 0) return true
    return false
  }

  function isGenUnlocked(gen: number): boolean {
    if (gen === 1) return true
    if (gen === 0) {
      return generations.every((g) => progression.completedMedium.includes(g))
    }
    return progression.completedMedium.includes(gen - 1)
  }

  function isHardUnlocked(gen: number): boolean {
    if (gen === 0) {
      return isGenUnlocked(0) && progression.completedAny.length > 0
    }
    return progression.completedAny.includes(gen)
  }

  function isInfiniteUnlocked(gen: number): boolean {
    return progression.completedHard.includes(gen)
  }

  // Modo Ruta: se desbloquea completando Intermedio en la generación.
  function isBranchUnlocked(gen: number): boolean {
    if (gen === 0) {
      return isGenUnlocked(0) && generations.some(g => progression.completedMedium.includes(g))
    }
    return progression.completedMedium.includes(gen)
  }

  function isColiseumUnlocked(): boolean {
    return generations.every(g => progression.completedMedium.includes(g))
  }

  function handleSelectGeneration(gen: number) {
    if (!isGenUnlocked(gen)) return
    playSelect()
    setGeneration(gen)
    if (difficulty === 'hard' && !isHardUnlocked(gen)) {
      setDifficulty('medium')
    }
    if (difficulty === 'infinite' && !isInfiniteUnlocked(gen)) {
      setDifficulty('medium')
    }
    if (difficulty === 'branch' && !isBranchUnlocked(gen)) {
      setDifficulty('medium')
    }
    const challengesLocked = gen === 0
      ? !generations.every((g) => progression.completedMedium.includes(g))
      : !progression.completedMedium.includes(gen)
    // En Cooperativo y COLISEUM los desafíos están siempre disponibles, así que
    // no se resetean al cambiar de generación. En Infinite sí se bloquean.
    const challengesAlwaysAvailable = coopMode || difficulty === 'coliseum'
    if (!challengesAlwaysAvailable && challengesLocked && (runChallenges.noShops || runChallenges.noRests || runChallenges.allShiny || runChallenges.allTeamRocket || runChallenges.nuzlocke || runChallenges.soloStarter || runChallenges.fixedTeam || runChallenges.noEvolution || runChallenges.noItems || runChallenges.restrictedMoves || runChallenges.firstStrike || runChallenges.fixedLevel || runChallenges.noCrits || runChallenges.typeRandomizer || runChallenges.noPurchasing || runChallenges.blindRoute || runChallenges.bossRush || runChallenges.speedrun || runChallenges.noMoney || runChallenges.doubleModifiers || runChallenges.scalingEnemies || runChallenges.noHealing || runChallenges.ironman || runChallenges.totalRandomizer || runChallenges.nuzlockeHardcore || runChallenges.challengeGauntlet || runChallenges.egglocke)) {
      setRunChallenges({ noShops: false, noRests: false, allShiny: false, allTeamRocket: false, nuzlocke: false, soloStarter: false, fixedTeam: false, noEvolution: false, noItems: false, restrictedMoves: false, firstStrike: false, fixedLevel: false, noCrits: false, typeRandomizer: false, noPurchasing: false, blindRoute: false, bossRush: false, speedrun: false, noMoney: false, doubleModifiers: false, scalingEnemies: false, noHealing: false, ironman: false, totalRandomizer: false, nuzlockeHardcore: false, challengeGauntlet: false, egglocke: false })
    }
  }

  function handleSelectDifficulty(diff: Difficulty) {
    if (diff === 'hard' && !isHardUnlocked(generation)) return
    if (diff === 'infinite' && !isInfiniteUnlocked(generation)) return
    if (diff === 'coliseum' && !isColiseumUnlocked()) return
    if (diff === 'branch' && !isBranchUnlocked(generation)) return
    playSelect()
    setDifficulty(diff)
    // Infinite no permite desafíos: al seleccionarlo se limpian los que hubiera.
    if (diff === 'infinite' && !coopMode) {
      setRunChallenges({ noShops: false, noRests: false, allShiny: false, allTeamRocket: false, nuzlocke: false, soloStarter: false, fixedTeam: false, noEvolution: false, noItems: false, restrictedMoves: false, firstStrike: false, fixedLevel: false, noCrits: false, typeRandomizer: false, noPurchasing: false, blindRoute: false, bossRush: false, speedrun: false, noMoney: false, doubleModifiers: false, scalingEnemies: false, noHealing: false, ironman: false, totalRandomizer: false, nuzlockeHardcore: false, challengeGauntlet: false, egglocke: false })
    }
  }

  function getEffectiveGen(): number {
    if (coopModeRef.current && coopGenRef.current) return coopGenRef.current
    if (isDailyRunRef.current) return currentRunGen
    if (generation === 0) {
      const unlockedGens = generations.filter((g) => isGenUnlocked(g))
      if (unlockedGens.length === 0) return 1
      return unlockedGens[Math.floor(Math.random() * unlockedGens.length)]
    }
    return generation
  }

  // Índice de etapa para la progresión de dificultad (pokémon evolucionados
  // según el avance). El Modo Original no da insignias sino medallas, así que
  // usa las medallas ganadas como progreso entre etapas.
  function getStageProgression(): number {
    return difficulty === 'original' ? originalMedals.length : difficulty === 'branch' ? branchMedals.length : badges.length
  }

  function balDiff(d: Difficulty): string {
    return d
  }

  function getMaxTeamLevel(): number {
    return team.reduce((max, p) => Math.max(max, p.level), 0)
  }

  // En Infinite los enemigos ya no apuntan SIEMPRE al nivel máximo del equipo:
  // usan la media entre el máximo y el promedio. Así un equipo desparejo no
  // dispara la dificultad al miembro más alto, y los combates escalan suave.
  function getInfiniteTargetLevel(): number {
    const maxLvl = getMaxTeamLevel()
    const avgLvl = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))
    return Math.round((maxLvl + avgLvl) / 2)
  }

  async function handleSelectPokedexPokemon(id: number, isShiny = false) {
    setIsLoadingDetail(true)
    setSelectedPokemonShiny(isShiny)
    try {
      const details = await fetchPokemonDetails(id)
      setSelectedPokemonDetail(details)
    } catch {
      setApiError('No se pudieron obtener los detalles del Pokémon.')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  function registerInPokedex(pokemon: Pokemon): void {
    // Logro Familia Eevee: acumula las evoluciones de Eevee obtenidas en la run.
    if (EEVEE_EVOLUTIONS.includes(Number(pokemon.id))) {
      eeveeEvolutionsRef.current.add(Number(pokemon.id))
      if (eeveeEvolutionsRef.current.size >= EEVEE_EVOLUTIONS.length) {
        unlockAchievement('eevee_master')
      }
    }
    setPokedex((prev) => {
      let pokemonId = Number(pokemon.id)

      if (isNaN(pokemonId) && pokemon.sprite) {
        const match = pokemon.sprite.match(/\/(\d+)\.(png|gif)/)
        if (match) {
          pokemonId = parseInt(match[1], 10)
        }
      }

      if (isNaN(pokemonId) || !pokemonId) return prev

      const current: PokedexEntry = prev[pokemonId] ?? { id: pokemonId, name: pokemon.name, sprite: pokemon.sprite, types: (pokemon as any).types ?? [], seen: false, caught: false }

      // La Pokédex normal y la de shinies son independientes: un shiny no
      // desbloquea la entrada normal y un Pokémon normal no toca la shiny.
      if (pokemon.shiny) {
        if (current.shinyCaught) return prev
        const updated: Record<number, PokedexEntry> = {
          ...prev,
          [pokemonId]: {
            ...current,
            name: pokemon.name,
            sprite: current.caught || current.seen ? current.sprite : pokemonSpriteUrl(pokemonId, false),
            shinySprite: pokemon.sprite,
            types: (pokemon as any).types ?? [],
            shinySeen: true,
            shinyCaught: true,
          }
        }
        localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
        return updated
      }

      if (current.caught) return prev
      const updated: Record<number, PokedexEntry> = {
        ...prev,
        [pokemonId]: {
          ...current,
          name: pokemon.name,
          sprite: pokemon.sprite,
          types: (pokemon as any).types ?? [],
          seen: true,
          caught: true,
        }
      }
      localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
      return updated
    })
  }

  // Recompensa por completar la Pokédex de cada generación (además de los logros).
  const lastCaughtCountRef = useRef<number>(-1)
  const checkGenerationDexCompletion = useCallback(async (): Promise<void> => {
    for (let gen = 1; gen <= 9; gen++) {
      if ((metaProgression.completedGenDex ?? []).includes(gen)) continue
      try {
        const ids = await getSpeciesIdsByGeneration(gen)
        if (ids.length === 0) continue
        const complete = ids.every(id => pokedex[id]?.caught)
        if (complete) {
          const reward = 50
          setMetaProgression(prev => {
            const completed = prev.completedGenDex ?? []
            if (completed.includes(gen)) return prev
            const updated = { ...prev, pokeCoins: prev.pokeCoins + reward, completedGenDex: [...completed, gen] }
            localStorage.setItem('pokerand_meta', JSON.stringify(updated))
            return updated
          })
          const msg = t('b.genDexComplete', { gen, coins: reward })
          setDexToast(msg)
          if (dexToastTimerRef.current) clearTimeout(dexToastTimerRef.current)
          dexToastTimerRef.current = setTimeout(() => setDexToast(null), 5000)
        }
      } catch { }
    }
  }, [metaProgression, pokedex])

  useEffect(() => {
    const caughtCount = Object.values(pokedex).filter(e => e.caught).length
    if (caughtCount === lastCaughtCountRef.current) return
    lastCaughtCountRef.current = caughtCount
    if (caughtCount === 0) return
    void checkGenerationDexCompletion()
  }, [pokedex, checkGenerationDexCompletion])

  function seenInPokedex(pokemon: Pokemon): void {
    setPokedex((prev) => {
      let pokemonId = Number(pokemon.id)

      if (isNaN(pokemonId) && pokemon.sprite) {
        const match = pokemon.sprite.match(/\/(\d+)\.(png|gif)/)
        if (match) {
          pokemonId = parseInt(match[1], 10)
        }
      }

      if (isNaN(pokemonId) || !pokemonId) return prev
      const current: PokedexEntry = prev[pokemonId] ?? { id: pokemonId, name: pokemon.name, sprite: pokemon.sprite, types: (pokemon as any).types ?? [], seen: false, caught: false }

      // Independencia total entre la Pokédex normal y la shiny.
      if (pokemon.shiny) {
        if (current.shinySeen) return prev
        const updated: Record<number, PokedexEntry> = {
          ...prev,
          [pokemonId]: {
            ...current,
            name: pokemon.name,
            sprite: current.caught || current.seen ? current.sprite : pokemonSpriteUrl(pokemonId, false),
            shinySprite: pokemon.sprite,
            types: (pokemon as any).types ?? [],
            shinySeen: true,
            shinyCaught: current.shinyCaught ?? false,
          }
        }
        localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
        return updated
      }

      if (current.seen) return prev
      const updated: Record<number, PokedexEntry> = {
        ...prev,
        [pokemonId]: {
          ...current,
          name: pokemon.name,
          sprite: pokemon.sprite,
          types: (pokemon as any).types ?? [],
          seen: true,
          caught: false,
        }
      }
      localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
      return updated
    })
  }

  function persistRecord(nextWins: number, nextLosses: number): void {
    localStorage.setItem('pokerand_wins', String(nextWins))
    localStorage.setItem('pokerand_losses', String(nextLosses))
    setRecord({ wins: nextWins, losses: nextLosses })
  }

  // Registra una partida finalizada (victoria o derrota real) en el historial.
  function recordFinishedRun(result: 'win' | 'loss', finalTeam: Pokemon[]): void {
    const duration = Math.max(0, Math.round((Date.now() - runStartTimeRef.current) / 1000))
    const challenges = (Object.keys(runChallenges) as Array<keyof RunChallenges>)
      .filter((k) => runChallenges[k])
    const entry: MatchRecord = {
      result,
      date: Date.now(),
      mode: difficulty,
      generation: currentRunGen,
      duration,
      team: finalTeam
        .filter((p) => p && p.name)
        .map((p) => ({ name: p.name, sprite: p.sprite, shiny: !!p.shiny, level: p.level })),
      challenges,
    }
    saveMatchRecord(entry)
    setMatchHistory((prev) => [entry, ...prev].slice(0, MAX_MATCH_HISTORY))
  }

  function unlockAchievement(id: string): void {
    const achievement = ACHIEVEMENTS.find(a => a.id === id)
    setAchievements(prev => {
      if (prev[id]?.unlocked) return prev
      return { ...prev, [id]: { unlocked: true, date: new Date().toISOString() } }
    })
    if (achievementsRef.current[id]?.unlocked) return
    const updated = { ...achievementsRef.current, [id]: { unlocked: true, date: new Date().toISOString() } }
    achievementsRef.current = updated
    localStorage.setItem('pokerand_achievements', JSON.stringify(updated))
    if (achievement) {
      setNewAchievement(achievement)
      playAchievement()
    }
  }

  function claimAchievement(id: string): void {
    const achievement = ACHIEVEMENTS.find(a => a.id === id)
    if (!achievement) return
    const entry = achievementsRef.current[id]
    if (!entry?.unlocked || entry.claimed) return
    const updated = { ...achievementsRef.current, [id]: { ...entry, claimed: true } }
    achievementsRef.current = updated
    localStorage.setItem('pokerand_achievements', JSON.stringify(updated))
    setAchievements(prev => {
      if (!prev[id]?.unlocked || prev[id]?.claimed) return prev
      return { ...prev, [id]: { ...prev[id], claimed: true } }
    })
    awardPokeCoins(achievement.reward, `${t('ach.reward')}: ${achName(achievement.id)}`)
    setBattleLog(prev => [t('b.claimRewardAch', { name: achName(achievement.id), coins: achievement.reward }), ...prev].slice(0, 15))
  }

  function claimAllAchievements(): void {
    const claimable = ACHIEVEMENTS.filter(a => {
      const entry = achievementsRef.current[a.id]
      return entry?.unlocked && !entry.claimed
    })
    if (claimable.length === 0) return

    const updated = { ...achievementsRef.current }
    for (const achievement of claimable) {
      updated[achievement.id] = { ...updated[achievement.id], claimed: true }
    }
    achievementsRef.current = updated
    localStorage.setItem('pokerand_achievements', JSON.stringify(updated))
    setAchievements(updated)

    const totalReward = claimable.reduce((sum, achievement) => sum + achievement.reward, 0)
    awardPokeCoins(totalReward, t('ach.collectAll'))
    setBattleLog(prev => [t('b.claimAllRewardsAch', { count: claimable.length, coins: totalReward }), ...prev].slice(0, 15))
  }

  useEffect(() => {
    if (runStats.captures >= 10) unlockAchievement('collector_10')
    if (runStats.captures >= 25) unlockAchievement('collector_25')
    if (runStats.captures >= 50) unlockAchievement('collector_50')
    if (runStats.moneyEarned >= 999) unlockAchievement('rich')
    if (runStats.moneyEarned >= 5000) unlockAchievement('rich_5000')
    if (runStats.moneyEarned >= 10000) unlockAchievement('rich_10000')
    if (runStats.moneyEarned >= 50000) unlockAchievement('rich_50000')
    if (runStats.critsLanded >= 5) unlockAchievement('crit_master')
    if (runStats.critsLanded >= 10) unlockAchievement('crit_10')
    if (runStats.critsLanded >= 20) unlockAchievement('crit_20')
    if (runStats.critsLanded >= 50) unlockAchievement('crit_50')
    if (runStats.koFirstTurn >= 1) unlockAchievement('one_shot')
    if (runStats.koFirstTurn >= 5) unlockAchievement('one_shot_5')
    if (runStats.koFirstTurn >= 10) unlockAchievement('one_shot_10')
    if (runStats.superEffectiveHits >= 10) unlockAchievement('super_effective_10')
    if (runStats.superEffectiveHits >= 25) unlockAchievement('super_effective_25')
    if (runStats.superEffectiveHits >= 50) unlockAchievement('super_effective_50')
    if (runStats.superEffectiveHits >= 100) unlockAchievement('super_effective_100')
    if (runStats.moneySpent >= 500) unlockAchievement('big_spender')
    if (runStats.moneySpent >= 1000) unlockAchievement('spender_1000')
    if (runStats.moneySpent >= 5000) unlockAchievement('spender_5000')
    if (runStats.battlesWon >= 20) unlockAchievement('battle_20')
    if (runStats.battlesWon >= 50) unlockAchievement('battle_50')
    if (runStats.battlesWon >= 100) unlockAchievement('battle_100')
    if (runStats.battlesWon >= 200) unlockAchievement('battle_200')
    if (runStats.battlesWon >= 500) unlockAchievement('battle_500')
    if (runStats.itemsUsed >= 10) unlockAchievement('item_user_10')
    if (runStats.itemsUsed >= 25) unlockAchievement('item_user_25')
    if (runStats.itemsUsed >= 50) unlockAchievement('item_user_50')
    if (runStats.totalDamageDealt >= 1000) unlockAchievement('damage_1000')
    if (runStats.totalDamageDealt >= 5000) unlockAchievement('damage_5000')
    if (runStats.totalDamageDealt >= 10000) unlockAchievement('damage_10000')
    if (runStats.totalDamageDealt >= 50000) unlockAchievement('damage_50000')
    if (runStats.totalDamageTaken >= 500) unlockAchievement('tank_500')
    if (runStats.totalDamageTaken >= 1000) unlockAchievement('tank_1000')
    if (runStats.nodesCleared >= 30) unlockAchievement('nodes_30')
    if (runStats.nodesCleared >= 50) unlockAchievement('nodes_50')
    if (runStats.nodesCleared >= 100) unlockAchievement('nodes_100')
    if (runStats.totalTurns >= 500) unlockAchievement('total_turns_500')
    if (runStats.totalTurns >= 1000) unlockAchievement('total_turns_1000')
    if (runStats.pokemonUsed.length >= 10) unlockAchievement('team_diversity_10')
    if (runStats.pokemonUsed.length >= 20) unlockAchievement('team_diversity_20')
    if (runStats.evolutions >= 5) unlockAchievement('evolution_master')
    if (metaProgression.pokeCoins >= 100) unlockAchievement('meta_100')
    if (metaProgression.pokeCoins >= 500) unlockAchievement('meta_500')
    if (metaProgression.pokeCoins >= 1000) unlockAchievement('meta_1000')
    if (metaProgression.pokeCoins >= 5000) unlockAchievement('meta_5000')
  }, [runStats, team, metaProgression.pokeCoins])

  useEffect(() => {
    if (team.length >= 6) unlockAchievement('full_team')
  }, [team])

  useEffect(() => {
    if (inventory.length >= 15) unlockAchievement('hoarder_15')
  }, [inventory])

  useEffect(() => {
    if (metaProgression.totalWins >= 5) unlockAchievement('total_wins_5')
    if (metaProgression.totalWins >= 10) unlockAchievement('total_wins_10')
    if (metaProgression.totalWins >= 25) unlockAchievement('total_wins_25')
    if (metaProgression.totalWins >= 50) unlockAchievement('total_wins_50')
    if (metaProgression.totalRuns >= 10) unlockAchievement('total_runs_10')
    if (metaProgression.totalRuns >= 25) unlockAchievement('total_runs_25')
    if (metaProgression.totalRuns >= 50) unlockAchievement('total_runs_50')
  }, [metaProgression.totalWins, metaProgression.totalRuns])

  useEffect(() => {
    if (metaProgression.totalMegas >= 10) unlockAchievement('mega_master')
  }, [metaProgression.totalMegas])

  useEffect(() => {
    if (metaProgression.totalGmax >= 10) unlockAchievement('gmax_master')
  }, [metaProgression.totalGmax])

  useEffect(() => {
    if (metaProgression.coopWins >= 5) unlockAchievement('coop_wins_5')
    if (metaProgression.coopWins >= 10) unlockAchievement('coop_wins_10')
  }, [metaProgression.coopWins])

  useEffect(() => {
    if (metaProgression.coopTrades >= 5) unlockAchievement('coop_trades_5')
    if (metaProgression.coopTrades >= 10) unlockAchievement('coop_trades_10')
  }, [metaProgression.coopTrades])

  useEffect(() => {
    const allThemesOwned = THEMES.every(t => metaProgression.ownedThemes.includes(t.id))
    const allItemsOwned = META_SHOP_ITEMS.every(item => {
      if (item.category === 'theme') return metaProgression.ownedThemes.includes(item.id)
      if (item.category === 'music') return metaProgression.ownedMusic.includes(item.id)
      return metaProgression.permanentlyUnlockedItems.includes(item.id)
    })
    const allBackgroundsOwned = BACKGROUNDS.every(bg => bg.id === 'none' || metaProgression.ownedBackgrounds.includes(bg.id))
    if (allThemesOwned && allItemsOwned && allBackgroundsOwned) unlockAchievement('meta_complete')
  }, [metaProgression.ownedThemes, metaProgression.ownedMusic, metaProgression.permanentlyUnlockedItems, metaProgression.ownedBackgrounds])

  useEffect(() => {
    if (winStreak >= 3) unlockAchievement('streak_3')
    if (winStreak >= 5) unlockAchievement('streak_5')
    if (winStreak >= 10) unlockAchievement('streak_10')
    if (winStreak >= 15) unlockAchievement('streak_15')
    if (winStreak >= 20) unlockAchievement('streak_20')
    if (winStreak >= 25) unlockAchievement('streak_25')
  }, [winStreak])

  // Logros acumulativos de la Pokédex (se guardan entre partidas).
  useEffect(() => {
    // Migración: si hay entradas capturadas sin tipos (p. ej. una Pokédex
    // desbloqueada con el modo secreto antes de que se guardaran los tipos), se
    // rellenan en segundo plano para que los logros funcionen.
    const entriesWithoutTypes = Object.entries(pokedex).filter(([, e]) => e.caught && !(e.types?.length))
    if (entriesWithoutTypes.length > 0 && !typesMigrationRef.current) {
      typesMigrationRef.current = true
      void (async () => {
        const ids = entriesWithoutTypes.map(([id]) => Number(id))
        const BATCH = 60
        for (let i = 0; i < ids.length; i += BATCH) {
          const batchIds = ids.slice(i, i + BATCH)
          const results = await Promise.all(batchIds.map(id => fetchPokemonTypes(id).catch(() => [] as string[])))
          setPokedex(prev => {
            const updated = { ...prev }
            batchIds.forEach((id, idx) => {
              if (updated[id] && results[idx].length > 0) {
                updated[id] = { ...updated[id], types: results[idx] }
              }
            })
            localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
            return updated
          })
        }
      })()
    }

    const allEntries = Object.values(pokedex)
    const caughtEntries = allEntries.filter(p => p.caught)
    if (caughtEntries.length >= 50) unlockAchievement('cazador_50')
    if (caughtEntries.length >= 100) unlockAchievement('cazador_100')
    if (allEntries.filter(p => p.shinyCaught).length >= 10) unlockAchievement('shiny_dex_10')
    const legendaryCaught = caughtEntries.filter(p => ALL_LEGENDARIES.includes(p.id)).length
    if (legendaryCaught >= 5) unlockAchievement('legendary_catcher_5')
    const typesCaught = new Set(caughtEntries.flatMap(p => p.types ?? []))
    if (Object.keys(TYPE_COLORS).every(t => typesCaught.has(t))) unlockAchievement('type_master')
  }, [pokedex])

  useEffect(() => {
    const legendaryIds = Object.entries(pokedex).filter(([, e]) => e.name.startsWith('legendary-')).map(([id]) => Number(id))
    if (legendaryIds.length === 0) return
    legendaryIds.forEach(id => {
      fetchPokemonDetails(id).then(details => {
        setPokedex(prev => {
          if (!prev[id]?.name.startsWith('legendary-')) return prev
          const updated = { ...prev, [id]: { ...prev[id], name: details.name } }
          localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
          return updated
        })
      }).catch(() => { })
    })
  }, [pokedex])

  function awardPokeCoins(amount: number, reason: string): void {
    setMetaProgression(prev => {
      const updated = { ...prev, pokeCoins: prev.pokeCoins + amount }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
    setBattleLog(prev => [t('b.coinsEarned', { amount, reason }), ...prev])
  }

  function triggerRandomEvent(routeProgress: number): void {
    if (Math.random() > 0.25) return
    // En Modo Original no salen eventos aleatorios salvo el Mercader Misterioso,
    // que además puede aparecer varias veces durante la run.
    const onlyMerchant = difficulty === 'original'
    // En Intermedio y Difícil los eventos son totalmente aleatorios y pueden
    // repetirse durante la misma partida.
    const repeatable = difficulty === 'medium' || difficulty === 'hard'
    let eligible = onlyMerchant
      ? RANDOM_EVENTS.filter(e => e.id === 'evolution_merchant' && routeProgress >= e.minRouteProgress)
      : RANDOM_EVENTS.filter(e => routeProgress >= e.minRouteProgress && (repeatable || !randomEventUsed.has(e.id)))
    // En modo Infinite la run es larga: si ya se usaron todos los eventos,
    // se reinicia el conjunto para que sigan apareciendo.
    if (!onlyMerchant && eligible.length === 0 && difficulty === 'infinite' && randomEventUsed.size > 0) {
      setRandomEventUsed(new Set())
      eligible = RANDOM_EVENTS.filter(e => routeProgress >= e.minRouteProgress)
    }
    if (eligible.length === 0) return
    const totalWeight = eligible.reduce((s, e) => s + e.weight, 0)
    let roll = Math.random() * totalWeight
    for (const event of eligible) {
      roll -= event.weight
      if (roll <= 0) {
        setActiveRandomEvent({ id: event.id, icon: event.icon, title: event.title, desc: event.desc })
        // En Modo Original el Mercader Misterioso no se marca como usado para
        // poder repetirse; en Intermedio/Difícil tampoco se limita. El resto de
        // modos mantienen cada evento una sola vez.
        if (!onlyMerchant && !repeatable) setRandomEventUsed(prev => new Set(prev).add(event.id))
        return
      }
    }
  }

  async function handleRandomEventChoice(): Promise<void> {
    if (!activeRandomEvent) return
    const event = activeRandomEvent
    setActiveRandomEvent(null)
    const current = team[activeIndex]
    if (!current) return

    switch (event.id) {
      case 'legendary_appears': {
        const legendaryIds = [144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 480, 481, 482, 483, 484, 485, 486, 487, 488, 491, 492, 493, 494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649]
        const id = legendaryIds[Math.floor(Math.random() * legendaryIds.length)]
        const legendaryData = await buildPokemonFromApi(id, 1, current.level)
        const legendary: Pokemon = {
          ...legendaryData,
          level: current.level,
          hp: current.maxHp + 20,
          maxHp: current.maxHp + 20,
          attack: current.attack + 10,
          defense: current.defense + 5,
          speed: current.speed + 5,
        }
        setTeam(prev => prev.map(p => p.hp <= 0 ? p : { ...p, hp: p.maxHp }))
        setBattleLog(prev => [t('b.legendAppeared'), ...prev])
        setLegendaryEncounter(legendary)
        setScreen('route')
        break
      }
      case 'mysterious_trader': {
        setTraderModal(true)
        break
      }
      case 'evolution_merchant': {
        const unlockedItems = Object.keys(EVOLUTION_ITEM_UNLOCK_IDS).filter(n => isActive(EVOLUTION_ITEM_UNLOCK_IDS[n]))
        if (unlockedItems.length > 0) {
          const shuffled = [...unlockedItems].sort(() => 0.5 - Math.random())
          const selected = shuffled.slice(0, 5).map(name => ({ name, price: 60 + Math.floor(Math.random() * 60) }))
          setMerchantItems(selected)
        } else {
          setBattleLog(prev => [t('b.merchantLeft'), ...prev].slice(0, 15))
        }
        break
      }
      case 'trap': {
        const dmg = Math.floor(current.maxHp * 0.3)
        setTeam(prev => prev.map((p, i) => i === activeIndex ? { ...p, hp: Math.max(1, p.hp - dmg) } : p))
        setBattleLog(prev => [t('b.trap', { name: current.name, dmg }), ...prev])
        break
      }
      case 'fairy_blessing': {
        setTeam(prev => prev.map((p, i) => i === activeIndex ? { ...p, hp: p.maxHp } : p))
        setBattleLog(prev => [t('b.fairyBlessing', { name: current.name }), ...prev])
        break
      }
      case 'treasure_chest': {
        const gold = 50 + Math.floor(Math.random() * 100)
        setMoney(prev => prev + gold)
        const items = ['Potion', 'X Attack', ...BERRY_DROPS.filter(isBerryUnlocked), ...TREASURE_DROPS.filter(isConsumableUnlocked)]
        const item = items[Math.floor(Math.random() * items.length)]
        const magmaEmblem = rollMagmaEmblem()
        setInventory(prev => [...prev, item, ...magmaEmblem])
        setBattleLog(prev => [t('b.coinChest', { gold, item }), ...(magmaEmblem.length > 0 ? [t('rest.magmaEmblemFound')] : []), ...prev])
        break
      }
      case 'shiny_spot': {
        setShinyNextEncounter(true)
        setBattleLog(prev => [t('b.shinySpot'), ...prev])
        break
      }
      case 'mysterious_help': {
        const faintedIdx = team.findIndex(p => p.hp <= 0)
        if (faintedIdx >= 0) {
          const revivedHp = Math.max(1, Math.floor(team[faintedIdx].maxHp * 0.5))
          setTeam(prev => prev.map((p, i) => i === faintedIdx ? { ...p, hp: revivedHp, status: undefined } : p))
          setBattleLog(prev => [t('b.mysteriousHelp', { name: team[faintedIdx].name, hp: revivedHp }), ...prev])
        } else {
          setBattleLog(prev => [t('b.mysteriousHelpNone'), ...prev])
        }
        break
      }
    }
  }

  async function handleTraderChoice(index: number): Promise<void> {
    setTraderModal(false)
    const traded = team[index]
    if (!traded) return
    try {
      const gen = currentRunGen === 0 ? 1 : currentRunGen
      const newPkmn = await getRandomPokemonByGeneration(gen)
      const scaled: Pokemon = {
        ...newPkmn,
        level: traded.level,
        hp: newPkmn.maxHp + (traded.level - 10) * 3,
        maxHp: newPkmn.maxHp + (traded.level - 10) * 3,
        attack: newPkmn.attack + (traded.level - 10) * 2,
        defense: newPkmn.defense + (traded.level - 10) * 2,
        speed: newPkmn.speed + (traded.level - 10) * 2,
      }
      scaled.hp = scaled.maxHp
      registerInPokedex(scaled)
      setTeam(prev => prev.map((p, i) => i === index ? scaled : p))
      if (index === activeIndex) {
        setActiveIndex(0)
      }
      setBattleLog(prev => [t('b.traderSwapped', { a: traded.name, b: scaled.name }), ...prev].slice(0, 15))
    } catch {
      setBattleLog(prev => [t('b.traderLeft'), ...prev].slice(0, 15))
    }
  }

  function handleAchievementDismiss(): void {
    setNewAchievement(null)
  }

  function generateRandomNodeType(id: number, rng: () => number = Math.random, branchStage: number = 1): RouteNode {
    let type: RouteNode['type'] = 'battle'
    if (runChallenges.bossRush) {
      type = 'battle'
    } else if (runChallenges.allTeamRocket) {
      type = 'teamRocket'
    } else {
      const rand = rng()
      if (difficulty === 'infinite') {
        if (rand < 0.10 && !runChallenges.noShops) {
          type = 'shop'
        } else if (rand < 0.20 && !runChallenges.noRests) {
          type = 'rest'
        } else if (rand < 0.30) {
          type = 'teamRocket'
        } else if (rand < 0.36) {
          type = 'spin'
        } else if (rand < 0.42) {
          type = 'pokeRand'
        } else if (rand < 0.48) {
          type = 'move'
        } else if (rand < 0.54 && isActive('unlock_mega_node')) {
          type = 'mega'
        } else if (rand < 0.60 && isActive('unlock_gmax_node')) {
          type = 'gmax'
        } else if (rand < 0.63 && isActive('unlock_primal_node')) {
          type = 'primal'
        } else if (rand < 0.69 && isActive('unlock_casino_node')) {
          type = 'casino'
        }
      } else if (difficulty === 'medium' || difficulty === 'branch') {
        if (rand < 0.15 && !runChallenges.noShops) {
          type = 'shop'
        } else if (rand < 0.35 && !runChallenges.noRests) {
          type = 'rest'
        } else if (rand < 0.47) {
          type = 'teamRocket'
        } else if (rand < 0.57) {
          type = 'spin'
        }
        // Modo Ruta: nodos especiales Mega/G-MAX/Primal (y Casino) solo si están
        // desbloqueados en la Tienda Meta Y a partir del stage 7, con probabilidad baja.
        if (difficulty === 'branch' && branchStage >= 7) {
          if (rand < 0.61 && isActive('unlock_mega_node')) {
            type = 'mega'
          } else if (rand < 0.65 && isActive('unlock_gmax_node')) {
            type = 'gmax'
          } else if (rand < 0.67 && isActive('unlock_primal_node')) {
            type = 'primal'
          } else if (rand < 0.70 && isActive('unlock_casino_node')) {
            type = 'casino'
          }
        }
      } else {
        if (rand < 0.15 && !runChallenges.noShops) {
          type = 'shop'
        } else if (rand < 0.40 && !runChallenges.noRests) {
          type = 'rest'
        } else if (rand < 0.52) {
          type = 'teamRocket'
        }
      }
    }
    // Nuevos nodos con baja probabilidad (no en COLISEUM): el rival recurrente
    // aparece cada ~6 nodos, el Mercado Negro y el Combate Doble son raros.
    if (difficulty !== 'coliseum' && (type === 'battle' || type === 'teamRocket')) {
      const r2 = rng()
      if (id % 6 === 0 && r2 < 0.5) {
        type = 'rival'
      } else if (r2 < 0.03) {
        type = 'blackmarket'
      } else if (r2 < 0.06) {
        type = 'double'
      } else if (r2 < 0.09) {
        type = 'rival'
      }
    }
    // Especulador: nodo exclusivo de Difícil e Infinite.
    if (!runChallenges.allTeamRocket && !runChallenges.bossRush
      && (difficulty === 'hard' || difficulty === 'infinite')
      && (type === 'battle' || type === 'teamRocket') && rng() < 0.06) {
      type = 'speculator'
    }
    // Safari: nodo de captura especial en rutas normales.
    if (!runChallenges.allTeamRocket && !runChallenges.bossRush
      && difficulty !== 'coliseum'
      && (type === 'battle' || type === 'teamRocket') && rng() < 0.04) {
      type = 'safari'
    }
    // Huerto de Bayas: exclusivo de Difícil e Infinite.
    if (!runChallenges.allTeamRocket && !runChallenges.bossRush
      && (difficulty === 'hard' || difficulty === 'infinite')
      && (type === 'battle' || type === 'teamRocket') && rng() < 0.04) {
      type = 'orchard'
    }
    if (!runChallenges.allTeamRocket && !runChallenges.bossRush
      && difficulty !== 'coliseum' && isActive('unlock_fossil_lab')
      && (type === 'battle' || type === 'teamRocket') && rng() < 0.03) {
      type = 'fossil'
    }
    if (!runChallenges.allTeamRocket && !runChallenges.bossRush
      && difficulty !== 'coliseum' && isActive('unlock_fishing_node')
      && (type === 'battle' || type === 'teamRocket') && rng() < 0.03) {
      type = 'fishing'
    }
    // Mina: solo si hay al menos un tesoro desbloqueado que pueda aparecer.
    if (!runChallenges.allTeamRocket && !runChallenges.bossRush
      && difficulty !== 'coliseum' && isActive('unlock_mine_node')
      && TREASURE_DROPS.some(isConsumableUnlocked)
      && (type === 'battle' || type === 'teamRocket') && rng() < 0.03) {
      type = 'mine'
    }
    if (!runChallenges.allTeamRocket && !runChallenges.bossRush
      && difficulty !== 'coliseum' && isActive('unlock_daycare_node')
      && (type === 'battle' || type === 'teamRocket') && rng() < 0.03) {
      type = 'daycare'
    }
    if (!runChallenges.allTeamRocket && !runChallenges.bossRush
      && difficulty !== 'coliseum'
      && (type === 'battle' || type === 'teamRocket') && rng() < 0.03) {
      type = 'weather'
    }
    if (!runChallenges.allTeamRocket && !runChallenges.bossRush
      && difficulty !== 'coliseum'
      && (type === 'battle' || type === 'teamRocket') && rng() < 0.03) {
      type = 'mirror'
    }
    if (!runChallenges.allTeamRocket && !runChallenges.bossRush
      && (difficulty === 'hard' || difficulty === 'infinite')
      && (type === 'battle' || type === 'teamRocket') && rng() < 0.03) {
      type = 'ranch'
    }
    return {
      id,
      type,
      label: type === 'teamRocket' ? `TeamR #${id}` : type === 'spin' ? `Spin #${id}` : type === 'pokeRand' ? `PokeRand #${id}` : type === 'move' ? `Move #${id}` : type === 'mega' ? `Mega #${id}` : type === 'gmax' ? `G-MAX #${id}` : type === 'primal' ? `Primal #${id}` : type === 'casino' ? `Casino #${id}` : type === 'rival' ? `Rival #${id}` : type === 'blackmarket' ? `Mercado Negro #${id}` : type === 'speculator' ? `Especulador #${id}` : type === 'safari' ? `Safari #${id}` : type === 'orchard' ? `Huerto de Bayas #${id}` : type === 'fossil' ? `Laboratorio de Fósiles #${id}` : type === 'fishing' ? `Pesca #${id}` : type === 'mine' ? `Mina #${id}` : type === 'daycare' ? `Guardería #${id}` : type === 'weather' ? `Estación Meteorológica #${id}` : type === 'mirror' ? `Combate Espejo #${id}` : type === 'ranch' ? `Rancho Pokémon #${id}` : type === 'double' ? `Doble #${id}` : `Ruta ${id}`,
      done: false
    }
  }

  // Anchura de cada columna del mapa del Modo Ruta (nº de nodos a elegir en
  // cada paso). La última columna es siempre el jefe de la etapa.
  const BRANCH_COLUMN_SIZES = [2, 3, 4, 3, 4, 3, 2]

  // Genera una etapa del Modo Ruta: un mapa ramificado de 7 columnas
  // (2-3-4-3-4-3-2 nodos cada una) más el jefe final. Devuelve tanto las
  // columnas agrupadas (para el mapa) como la lista aplanada (para `route`).
  function generateBranchStage(stageNum: number, rng: () => number = Math.random): { columns: BranchNode[][]; flat: RouteNode[] } {
    const columns: BranchNode[][] = []
    const flat: RouteNode[] = []
    let id = 5000 + stageNum * 100
    for (let c = 0; c < BRANCH_COLUMN_SIZES.length; c++) {
      const col: BranchNode[] = []
      for (let r = 0; r < BRANCH_COLUMN_SIZES[c]; r++) {
        const base = generateRandomNodeType(id, rng, stageNum)
        const branch: BranchNode = { ...base, col: c, row: r }
        col.push(branch)
        // `flat` alimenta `route`: se guarda el nodo ramificado (con col/row)
        // para poder calcular la conectividad "2 nodos más próximos" más tarde.
        flat.push(branch)
        id++
      }
      columns.push(col)
    }
    const boss: BranchNode = {
      id,
      type: 'boss',
      label: `Jefe #${stageNum}`,
      done: false,
      col: BRANCH_COLUMN_SIZES.length,
      row: 0,
    }
    columns.push([boss])
    flat.push(boss)
    return { columns, flat }
  }

  // Índice del primer nodo de una columna dentro de la lista aplanada `route`.
  function branchColumnStartIndex(columns: BranchNode[][], col: number): number {
    let idx = 0
    for (let c = 0; c < col; c++) idx += columns[c].length
    return idx
  }

  function handleStartRunClick(): void {
    playClick()
    if (coopMode) {
      if (!coopSessionCode) { setCoopError(t('coop.needSession')); return }
      if (coopMyRole === 'a' && !coopPartnerJoined) { setCoopError('Espera a que tu compañero se una a la sesión.'); return }
    }
    if (difficulty === 'original') {
      void openStarterSelect()
      return
    }
    startNewRun()
  }

  async function openStarterSelect(): Promise<void> {
    setIsLoading(true)
    setApiError('')
    try {
      const targetGen = getEffectiveGen()
      const ids = startersByGen[targetGen] ?? startersByGen[1]
      const options = await Promise.all(ids.map(id => buildPokemonFromApi(id, targetGen, 10, false, 'original')))
      setStarterOptions(options)
      setShowStarterSelect(true)
    } catch {
      setApiError('No se pudieron cargar los iniciales.')
    } finally {
      setIsLoading(false)
    }
  }

  function confirmOriginalStarter(starter: Pokemon): void {
    chosenStarterIdRef.current = starter.id
    setShowStarterSelect(false)
    startNewRun()
  }

  async function startNewRun(sameRoute = false): Promise<void> {
    const dailyCfg = isDailyRunRef.current ? getDailyConfig(dailySeed, [1, 2, 3, 4, 5, 6, 7, 8, 9]) : null
    const effectiveGen = coopModeRef.current ? (coopGenRef.current || generation) : (dailyCfg ? dailyCfg.generation : generation)
    const effectiveDifficulty = coopModeRef.current ? (coopDiffRef.current || 'medium') : (dailyCfg ? dailyCfg.difficulty : difficulty)
    // El Desafío Diario tiene su propia dificultad (no la del menú): se aplica
    // durante la run y se restaura al volver al menú.
    if (isDailyRunRef.current && dailyCfg) {
      preDailyDifficultyRef.current = difficulty
      setDifficulty(dailyCfg.difficulty)
    }
    // Semilla de la ruta: se guarda para poder "reiniciar" con los mismos nodos.
    const routeSeed = coopModeRef.current
      ? (coopSeedRef.current || String(Math.random()).slice(2, 12))
      : isDailyRunRef.current
        ? dailySeed
        : sameRoute && routeSeedRef.current
          ? routeSeedRef.current
          : String(Math.random()).slice(2, 12)
    routeSeedRef.current = routeSeed

    if (!dailyCfg) {
      if (!isGenUnlocked(effectiveGen)) {
        setApiError('Esta generación aún está bloqueada.')
        return
      }
      if (effectiveDifficulty === 'hard' && !isHardUnlocked(effectiveGen)) {
        setApiError('El modo difícil para esta generación aún está bloqueado.')
        return
      }
      if (effectiveDifficulty === 'infinite' && !isInfiniteUnlocked(effectiveGen)) {
        setApiError('El modo Infinite se desbloquea completando Difícil en esta generación.')
        return
      }
      if (effectiveDifficulty === 'branch' && !isBranchUnlocked(effectiveGen)) {
        setApiError('El modo Ruta se desbloquea completando Intermedio en esta generación.')
        return
      }
      if (effectiveDifficulty === 'infinite' && !authUser) {
        setApiError('Para jugar al modo Infinite necesitas una cuenta. Crea una o inicia sesión en el ranking.')
        openLeaderboard()
        return
      }
    }

    megaNodeSpawnedRef.current = false

    if (coopModeRef.current && coopSeedRef.current) {
      setRunSeed(parseFloat(coopSeedRef.current) || Math.random())
    } else {
      setRunSeed(Math.random())
    }

    // En Co-op, la dificultad de la run es la de la sesión (Fácil/Intermedio/Difícil),
    // no la del menú principal. Si no, los combates (TeamR incluido) se escalarían
    // con la dificultad que tuviera el menú (p. ej. Infinite → multiplicadores enormes).
    if (coopModeRef.current && coopDiffRef.current) {
      setDifficulty(coopDiffRef.current)
    }

    setIsLoading(true)
    setApiError('')

    try {
      const targetGen = coopModeRef.current ? (coopGenRef.current || getEffectiveGen()) : (dailyCfg ? effectiveGen : getEffectiveGen())
      setCurrentRunGen(targetGen)
      // Precarga en segundo plano las especies y legendarios de la generación:
      // así el primer enemigo no tarda en aparecer al entrar en un nodo.
      preloadGeneration(targetGen)

      // Handle challengeGauntlet: randomly pick 3 challenges
      let activeChallenges = { ...runChallenges }
      if (activeChallenges.challengeGauntlet) {
        const allChallengeKeys: Array<keyof RunChallenges> = [
          'noShops', 'noRests', 'allShiny', 'allTeamRocket', 'nuzlocke',
          'soloStarter', 'fixedTeam', 'noEvolution', 'noItems', 'restrictedMoves',
          'firstStrike', 'fixedLevel', 'noCrits', 'typeRandomizer', 'noPurchasing',
          'blindRoute', 'bossRush', 'speedrun', 'noMoney', 'doubleModifiers',
          'scalingEnemies', 'noHealing', 'ironman', 'totalRandomizer', 'egglocke'
        ]
        const shuffled = [...allChallengeKeys].sort(() => Math.random() - 0.5)
        const picked = shuffled.slice(0, 3)
        activeChallenges = { ...activeChallenges }
        for (const key of allChallengeKeys) {
          activeChallenges[key] = picked.includes(key)
        }
        activeChallenges.challengeGauntlet = true
        setRunChallenges(activeChallenges)
        setGauntletKeys(picked)
      }

      // Handle nuzlockeHardcore: nuzlocke + noItems + noRests
      if (activeChallenges.nuzlockeHardcore) {
        activeChallenges = { ...activeChallenges, nuzlocke: true, noItems: true, noRests: true }
      }

      // --- COLISEUM: skip starter, go to team selection ---
      if (effectiveDifficulty === 'coliseum') {
        preColiseumChallengesRef.current = { ...runChallenges }
        activeChallenges = { ...activeChallenges, fixedLevel: true, noEvolution: true, noMoney: true, noShops: true, noRests: true }
        setRunChallenges(activeChallenges)
        const coliseumRoute: RouteNode[] = []
        for (let i = 1; i <= 8; i++) {
          coliseumRoute.push({ id: i, type: 'boss', label: `Jefe #${i}`, done: false })
        }
        setRoute(coliseumRoute)
        setRouteIndex(0)
        setMoney(0)
        setInventory([])
        setOrchardPlanted([])
        setOrchardPlantedNodeId(null)
        setOrchardPlantModal(false)
        setOrchardSelected([])
        setOrchardHarvest(null)
        setFossilChoices([])
        setFossilBusy(false)
        setFishingEncounter(null)
        setFishingPhase('idle')
        setFishingBusy(false)
        setFishingMessage('')
        setFishingAttempts(0)
        setMiningDigs(0)
        setMiningBusy(false)
        setMiningMessage('')
        setMiningReveal(null)
        setDaycareEgg(null)
        setDaycareLoading(false)
        setEggHatch(null)
        setEggHatchPlacement('team')
        setWeatherStation(null)
        setRanchConfirm(null)
        setRanchResult(null)
        setPcStorage([])
        setModifier(null)
        setModifier2(null)
        setBadges([])
        setCurrentStage(1)
        setEnemy(null)
        setIsTrainerBattle(false)
        setTrainerTeam([])
        setTrainerPokemonIndex(0)
        setTrainerName('')
        setTrainerSprite('')
        setTrainerBadge('')
        setRunStats({
          battlesWon: 0, battlesLost: 0, totalDamageDealt: 0, totalDamageTaken: 0,
          critsLanded: 0, superEffectiveHits: 0, koFirstTurn: 0, captures: 0,
          itemsUsed: 0, moneySpent: 0, moneyEarned: 0, nodesCleared: 0, evolutions: 0,
          teamSizeMax: 6, lowestHPEver: 9999, totalTurns: 0, pokemonUsed: [], challengesActive: [],
        })
        setRandomEventUsed(new Set())
        setActiveRandomEvent(null)
        setColiseumTempTeam([])
        setColiseumSeed(Math.floor(Math.random() * 1000000))
        setScreen('coliseum_select')
        return
      }

      // Handle ironman: noEvolution + fixedTeam + noHealing
      if (activeChallenges.ironman) {
        activeChallenges = { ...activeChallenges, noEvolution: true, fixedTeam: true, noHealing: true }
        setRunChallenges(activeChallenges)
      }

      // Reinicia el conteo de evoluciones de Eevee para la run nueva.
      eeveeEvolutionsRef.current = new Set()

      // En Modo Original el jugador elige su inicial (chosenStarterIdRef).
      let starter: Pokemon
      if (effectiveDifficulty === 'original') {
        const starterId = chosenStarterIdRef.current ?? randomFrom(startersByGen[targetGen] ?? startersByGen[1])
        starter = await buildPokemonFromApi(starterId, targetGen, 10, activeChallenges.allShiny, 'original')
      } else {
        starter = await getRandomStarterByGeneration(targetGen, activeChallenges.allShiny, effectiveDifficulty)
      }
      const config: RunConfig = { generation: targetGen }
      const run = startRun(config, activeChallenges.doubleModifiers)

      if (isDailyRunRef.current) {
        const dailyCfg = getDailyConfig(dailySeed, [targetGen])
        const fixedMod = RUN_MODIFIERS.find(m => m.id === dailyCfg.modifierId)
        if (fixedMod) run.modifier = fixedMod
      }

      // En Modo Original no hay modificadores de run.
      if (run.modifier2 && effectiveDifficulty !== 'original') {
        setModifier2(run.modifier2)
      } else {
        setModifier2(null)
      }

      registerInPokedex(starter)

      const totalNodes = difficultyNodeCounts[effectiveDifficulty]
      let customRoute: RouteNode[] = []

      const routeRand = createSeededRandom(routeSeed)
      const rr = () => routeRand()
      routeRandRef.current = rr

      if (coopModeRef.current) {
        // Ruta compartida: misma forma para ambos jugadores (misma semilla).
        // Los encuentros, tiendas y descansos siguen siendo aleatorios por jugador.
        const coopNodes = difficultyNodeCounts[coopDiffRef.current || 'medium'] || 10
        customRoute = generateCoopRouteSegment(1, coopNodes, rr, activeChallenges, coopDiffRef.current || 'medium')
      } else if (effectiveDifficulty === 'branch') {
        // Modo Ruta: mapa ramificado de nodos (2-3-4-3-4-3-2) + jefe por etapa.
        // Tiene prioridad sobre desafíos de forma de ruta (p. ej. Boss Rush).
        setBranchMedals([])
        const stage = generateBranchStage(1, rr)
        setBranchMap(stage.columns)
        setBranchCol(0)
        customRoute = stage.flat
      } else if (activeChallenges.bossRush) {
        customRoute = generateBossRushRoute(totalNodes)
      } else if (effectiveDifficulty === 'original') {
        // Modo Original: 8 etapas; cada una termina en un jefe que da una medalla.
        setOriginalMedals([])
        customRoute = buildOriginalStageRoute(1)
      } else if (effectiveDifficulty === 'infinite') {
        for (let i = 1; i <= infiniteNodeSize; i++) {
          customRoute.push(generateRandomNodeType(i, rr))
        }
      } else {
        const spinPositions: number[] = []
        const pokeRandPositions: number[] = []
        const movePositions: number[] = []
        let megaPosition: number | null = null
        let gmaxPosition: number | null = null
        let primalPosition: number | null = null
        const casinoPositions: number[] = []
        if (!activeChallenges.allTeamRocket) {
          if (effectiveDifficulty === 'hard') {
            const available = Array.from({ length: totalNodes - 2 }, (_, k) => k + 2)
            while (spinPositions.length < 2 && available.length > 0) {
              const idx = Math.floor(rr() * available.length)
              spinPositions.push(available[idx])
              available.splice(idx, 1)
            }
            while (pokeRandPositions.length < 2 && available.length > 0) {
              const idx = Math.floor(rr() * available.length)
              pokeRandPositions.push(available[idx])
              available.splice(idx, 1)
            }
            if (available.length > 0) {
              const idx = Math.floor(rr() * available.length)
              movePositions.push(available[idx])
              available.splice(idx, 1)
            }
            if (available.length > 0 && isActive('unlock_mega_node')) {
              const idx = Math.floor(rr() * available.length)
              megaPosition = available[idx]
              available.splice(idx, 1)
              megaNodeSpawnedRef.current = true
            }
            if (available.length > 0 && isActive('unlock_gmax_node')) {
              const idx = Math.floor(rr() * available.length)
              gmaxPosition = available[idx]
              available.splice(idx, 1)
            }
            if (available.length > 0 && isActive('unlock_primal_node')) {
              const idx = Math.floor(rr() * available.length)
              primalPosition = available[idx]
              available.splice(idx, 1)
            }
            if (isActive('unlock_casino_node')) {
              while (casinoPositions.length < 2 && available.length > 0) {
                const idx = Math.floor(rr() * available.length)
                casinoPositions.push(available[idx])
                available.splice(idx, 1)
              }
            }
          } else if (effectiveDifficulty === 'medium') {
            const available = Array.from({ length: totalNodes - 2 }, (_, k) => k + 2)
            const idx = Math.floor(rr() * available.length)
            spinPositions.push(available[idx])
            available.splice(idx, 1)
            if (available.length > 0) {
              const idx2 = Math.floor(rr() * available.length)
              pokeRandPositions.push(available[idx2])
              available.splice(idx2, 1)
            }
            if (available.length > 0) {
              const idx3 = Math.floor(rr() * available.length)
              movePositions.push(available[idx3])
              available.splice(idx3, 1)
            }
          }
        }

        for (let i = 1; i < totalNodes; i++) {
          let type: RouteNode['type'] = 'battle'

          if (spinPositions.includes(i)) {
            type = 'spin'
          } else if (pokeRandPositions.includes(i)) {
            type = 'pokeRand'
          } else if (movePositions.includes(i)) {
            type = 'move'
          } else if (megaPosition !== null && i === megaPosition) {
            type = 'mega'
          } else if (gmaxPosition !== null && i === gmaxPosition) {
            type = 'gmax'
          } else if (primalPosition !== null && i === primalPosition) {
            type = 'primal'
          } else if (casinoPositions.includes(i)) {
            type = 'casino'
          } else if (activeChallenges.bossRush) {
            type = 'battle'
          } else if (activeChallenges.allTeamRocket) {
            type = 'teamRocket'
          } else {
            const rand = rr()
            if (rand < 0.15 && !activeChallenges.noShops) {
              type = 'shop'
            } else if (rand < 0.40 && !activeChallenges.noRests) {
              type = 'rest'
            } else if (rand < 0.52) {
              type = 'teamRocket'
            }
          }

          // Nodos nuevos en Medio y Difícil (misma probabilidad baja que Infinite):
          // el Rival recurrente aparece cada ~6 nodos, el Mercado Negro y el
          // Combate Doble son raros.
          if ((effectiveDifficulty === 'medium' || effectiveDifficulty === 'hard') && (type === 'battle' || type === 'teamRocket')) {
            const r2 = rr()
            if (i % 6 === 0 && r2 < 0.5) {
              type = 'rival'
            } else if (r2 < 0.03) {
              type = 'blackmarket'
            } else if (r2 < 0.06) {
              type = 'double'
            } else if (r2 < 0.09) {
              type = 'rival'
            }
          }
          // Especulador: exclusivo de Difícil (Infinite usa generateRandomNodeType).
          if (!activeChallenges.allTeamRocket && !activeChallenges.bossRush
            && effectiveDifficulty === 'hard'
            && (type === 'battle' || type === 'teamRocket') && rr() < 0.06) {
            type = 'speculator'
          }
          if (!activeChallenges.allTeamRocket && !activeChallenges.bossRush
            && (type === 'battle' || type === 'teamRocket') && rr() < 0.04) {
            type = 'safari'
          }
          if (!activeChallenges.allTeamRocket && !activeChallenges.bossRush
            && effectiveDifficulty === 'hard'
            && (type === 'battle' || type === 'teamRocket') && rr() < 0.04) {
            type = 'orchard'
          }
          if (!activeChallenges.allTeamRocket && !activeChallenges.bossRush
            && isActive('unlock_fossil_lab')
            && (type === 'battle' || type === 'teamRocket') && rr() < 0.03) {
            type = 'fossil'
          }
          if (!activeChallenges.allTeamRocket && !activeChallenges.bossRush
            && isActive('unlock_fishing_node')
            && (type === 'battle' || type === 'teamRocket') && rr() < 0.03) {
            type = 'fishing'
          }
          if (!activeChallenges.allTeamRocket && !activeChallenges.bossRush
            && isActive('unlock_mine_node')
            && TREASURE_DROPS.some(isConsumableUnlocked)
            && (type === 'battle' || type === 'teamRocket') && rr() < 0.03) {
            type = 'mine'
          }
          if (!activeChallenges.allTeamRocket && !activeChallenges.bossRush
            && isActive('unlock_daycare_node')
            && (type === 'battle' || type === 'teamRocket') && rr() < 0.03) {
            type = 'daycare'
          }
          if (!activeChallenges.allTeamRocket && !activeChallenges.bossRush
            && (type === 'battle' || type === 'teamRocket') && rr() < 0.03) {
            type = 'weather'
          }
          if (!activeChallenges.allTeamRocket && !activeChallenges.bossRush
            && (type === 'battle' || type === 'teamRocket') && rr() < 0.03) {
            type = 'mirror'
          }
          if (!activeChallenges.allTeamRocket && !activeChallenges.bossRush
            && effectiveDifficulty === 'hard'
            && (type === 'battle' || type === 'teamRocket') && rr() < 0.03) {
            type = 'ranch'
          }

          customRoute.push({
            id: i,
            type,
            label: type === 'teamRocket' ? `TeamR #${i}` : type === 'spin' ? `Spin #${i}` : type === 'pokeRand' ? `PokeRand #${i}` : type === 'move' ? `Move #${i}` : type === 'mega' ? `Mega #${i}` : type === 'gmax' ? `G-MAX #${i}` : type === 'primal' ? `Primal #${i}` : type === 'casino' ? `Casino #${i}` : type === 'rival' ? `Rival #${i}` : type === 'blackmarket' ? `Mercado Negro #${i}` : type === 'speculator' ? `Especulador #${i}` : type === 'safari' ? `Safari #${i}` : type === 'orchard' ? `Huerto de Bayas #${i}` : type === 'fossil' ? `Laboratorio de Fósiles #${i}` : type === 'fishing' ? `Pesca #${i}` : type === 'mine' ? `Mina #${i}` : type === 'daycare' ? `Guardería #${i}` : type === 'weather' ? `Estación Meteorológica #${i}` : type === 'mirror' ? `Combate Espejo #${i}` : type === 'ranch' ? `Rancho Pokémon #${i}` : type === 'double' ? `Doble #${i}` : `Ruta ${i}`,
            done: false
          })
        }

        customRoute.push({
          id: totalNodes,
          type: 'boss',
          label: `Combate Final (#${totalNodes})`,
          done: false
        })
      }

      const hpBonus = (effectiveDifficulty === 'original' ? null : run.modifier)?.playerMaxHpBonus ?? 0
      let starterWithBonus = {
        ...starter,
        maxHp: starter.maxHp + hpBonus,
        hp: starter.hp + hpBonus,
      }
      if (activeChallenges.noEvolution) {
        starterWithBonus = applyNoEvolutionBuff(starterWithBonus)
      }
      if (activeChallenges.fixedLevel) {
        starterWithBonus = { ...starterWithBonus, level: 50 }
      }
      setTeam([starterWithBonus])
      setActiveIndex(0)
      // Mejoras de inicio de la Tienda Meta: bolas, pociones y dinero extra.
      const extraBalls = isActive('start_pokeballs_5') ? 5 : 0
      const extraPotions =
        (isActive('start_potion_1') ? 1 : 0) +
        (isActive('start_potion_2') ? 1 : 0)
      const extraMoney =
        ((isActive('start_money_1') ? 1 : 0) +
          (isActive('start_money_2') ? 1 : 0)) * 100
      setMoney(activeChallenges.noMoney ? 0 : 100 + extraMoney)
      const startingItems: string[] = [run.item]
      for (let i = 0; i < 5 + extraBalls; i++) startingItems.push('Poké Ball')
      for (let i = 0; i < extraPotions; i++) startingItems.push('Potion')
      if (isActive('start_revive_1')) startingItems.push('Revive')
      // Caja Bonguri: 2 Poké Balls + 1 ball de bonguri aleatoria.
      if (isActive('unlock_caja_bonguri')) {
        startingItems.push('Poké Ball', 'Poké Ball')
        const apricornBalls = ['Level Ball', 'Friend Ball', 'Love Ball', 'Heavy Ball', 'Fast Ball'].filter(isPokeballUnlocked)
        startingItems.push(apricornBalls.length > 0 ? apricornBalls[Math.floor(Math.random() * apricornBalls.length)] : 'Poké Ball')
      }
      // Estuche de MT: empiezas con un Disco MT en el inventario.
      if (isActive('unlock_estuche_mt')) startingItems.push('Disco MT')
      // Saco bayas: 1 baya extra aleatoria de las desbloqueadas.
      if (isActive('unlock_saco_bayas')) {
        const unlockedBerries = BERRY_DROPS.filter(isBerryUnlocked)
        if (unlockedBerries.length > 0) startingItems.push(unlockedBerries[Math.floor(Math.random() * unlockedBerries.length)])
      }
      setInventory(startingItems)
      setOrchardPlanted([])
      setOrchardPlantedNodeId(null)
      setOrchardPlantModal(false)
      setOrchardSelected([])
      setOrchardHarvest(null)
      setFossilChoices([])
      setFossilBusy(false)
      setFishingEncounter(null)
      setFishingPhase('idle')
      setFishingBusy(false)
      setFishingMessage('')
      setFishingAttempts(0)
      setMiningDigs(0)
      setMiningBusy(false)
      setMiningMessage('')
      setMiningReveal(null)
      setDaycareEgg(null)
      setDaycareLoading(false)
      setEggHatch(null)
      setEggHatchPlacement('team')
      setWeatherStation(null)
      setRanchConfirm(null)
      setRanchResult(null)
      setModifier(effectiveDifficulty === 'original' ? null : run.modifier)
      setRoute(customRoute)
      setRouteIndex(0)
      setBadges([])
      setCurrentStage(1)
      if (effectiveDifficulty !== 'branch') {
        setBranchMap(null)
        setBranchCol(0)
        setBranchMedals([])
      }
      setEnemy(null)
      setIsTrainerBattle(false)
      setTrainerTeam([])
      setTrainerPokemonIndex(0)
      setTrainerName('')
      setTrainerSprite('')
      setTrainerBadge('')
      setRestEncounter(null)
      setDefeatSummary(null)
      setVictoryUnlocks(null)
      // Nueva partida: se limpia el PC para no arrastrar Pokémon de la run anterior.
      setPcStorage([])
      setEggInventory([])
      setSpeedrunSeconds(0)
      if (speedrunTimerRef.current) {
        clearInterval(speedrunTimerRef.current)
        speedrunTimerRef.current = null
      }

      const challengeDescriptions: string[] = []
      if (activeChallenges.noShops) challengeDescriptions.push(t('bch.noShops'))
      if (activeChallenges.noRests) challengeDescriptions.push(t('bch.noRests'))
      if (activeChallenges.allShiny) challengeDescriptions.push(t('bch.allShiny'))
      if (activeChallenges.allTeamRocket) challengeDescriptions.push(t('bch.allTeamRocket'))
      if (activeChallenges.nuzlocke) challengeDescriptions.push(t('bch.nuzlocke'))
      if (activeChallenges.soloStarter) challengeDescriptions.push(t('bch.soloStarter'))
      if (activeChallenges.fixedTeam) challengeDescriptions.push(t('bch.fixedTeam'))
      if (activeChallenges.noEvolution) challengeDescriptions.push(t('bch.noEvolution'))
      if (activeChallenges.noItems) challengeDescriptions.push(t('bch.noItems'))
      if (activeChallenges.restrictedMoves) challengeDescriptions.push(t('bch.restrictedMoves'))
      if (activeChallenges.firstStrike) challengeDescriptions.push(t('bch.firstStrike'))
      if (activeChallenges.fixedLevel) challengeDescriptions.push(t('bch.fixedLevel'))
      if (activeChallenges.noCrits) challengeDescriptions.push(t('bch.noCrits'))
      if (activeChallenges.typeRandomizer) challengeDescriptions.push(t('bch.typeRandomizer'))
      if (activeChallenges.noPurchasing) challengeDescriptions.push(t('bch.noPurchasing'))
      if (activeChallenges.blindRoute) challengeDescriptions.push(t('bch.blindRoute'))
      if (activeChallenges.bossRush) challengeDescriptions.push(t('bch.bossRush'))
      if (activeChallenges.speedrun) challengeDescriptions.push(t('bch.speedrun'))
      if (activeChallenges.noMoney) challengeDescriptions.push(t('bch.noMoney'))
      if (activeChallenges.doubleModifiers) challengeDescriptions.push(t('bch.doubleModifiers'))
      if (activeChallenges.scalingEnemies) challengeDescriptions.push(t('bch.scalingEnemies'))
      if (activeChallenges.noHealing) challengeDescriptions.push(t('bch.noHealing'))
      if (activeChallenges.ironman) challengeDescriptions.push(t('bch.ironman'))
      if (activeChallenges.totalRandomizer) challengeDescriptions.push(t('bch.totalRandomizer'))
      if (activeChallenges.nuzlockeHardcore) challengeDescriptions.push(t('bch.nuzlockeHardcore'))
      if (activeChallenges.challengeGauntlet) challengeDescriptions.push(t('bch.challengeGauntlet'))
      if (activeChallenges.egglocke) challengeDescriptions.push(t('bch.egglocke'))

      setBattleLog([
        t('b.starter', { name: `${starter.name}${starter.shiny ? ' ✨' : ''}` }),
        `Modo: ${effectiveGen === 0 ? 'Random All-Stars' : `Gen ${effectiveGen}`}.`,
        `${t('common.difficulty')}: ${difficultyLabel(language, effectiveDifficulty).title}${effectiveDifficulty === 'infinite' ? t('b.noLimit') : effectiveDifficulty === 'branch' ? (language === 'en' ? ' · Branching map · 8 medals' : ' · Mapa de rutas · 8 medallas') : t('b.threeStages', { n: totalNodes })}.`,
        t('b.receiveStart', { money: activeChallenges.noMoney ? '0' : '100', item: run.item }),
        ...challengeDescriptions,
      ])
      const activeChallengeNames: string[] = []
      if (activeChallenges.nuzlocke) activeChallengeNames.push('Nuzlocke')
      if (activeChallenges.soloStarter) activeChallengeNames.push('Solo Starter')
      if (activeChallenges.noItems) activeChallengeNames.push('Sin Items')
      if (activeChallenges.noHealing) activeChallengeNames.push('Sin Curación')
      if (activeChallenges.bossRush) activeChallengeNames.push('Boss Rush')
      if (activeChallenges.speedrun) activeChallengeNames.push('Speedrun')
      if (activeChallenges.ironman) activeChallengeNames.push('Ironman')

      setRunStats({
        battlesWon: 0, battlesLost: 0, totalDamageDealt: 0, totalDamageTaken: 0,
        critsLanded: 0, superEffectiveHits: 0, koFirstTurn: 0, captures: 0,
        itemsUsed: 0, moneySpent: 0, moneyEarned: 0, nodesCleared: 0, evolutions: 0,
        teamSizeMax: 1, lowestHPEver: starterWithBonus.hp, totalTurns: 0,
        pokemonUsed: [starterWithBonus.name], challengesActive: activeChallengeNames,
      })
      setRandomEventUsed(new Set())
      setShinyNextEncounter(false)
      setLegendaryNextEncounter(false)
      setActiveRandomEvent(null)

      runStartTimeRef.current = Date.now()
      setScoreSubmitState('idle')
      setVoluntaryRunEnd(false)
      setShowEndRunModal(false)
      setScreen('route')
      startBattleMusic()

      // Logros cooperativos: primera run / contador de runs
      if (coopModeRef.current) {
        setMetaProgression(prev => {
          const updated = { ...prev, coopRuns: prev.coopRuns + 1 }
          localStorage.setItem('pokerand_meta', JSON.stringify(updated))
          return updated
        })
        unlockAchievement('coop_first_run')
      }
    } catch {
      setApiError('No se pudo cargar PokeAPI. Reintenta en unos segundos.')
    } finally {
      setIsLoading(false)
    }
  }

  function unlockDifficultyBadge(): void {
    if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') return
    const genPlayed = currentRunGen
    const isMediumOrHard = difficulty === 'medium' || difficulty === 'hard'
    const updatedProgression: ProgressionData = {
      ...progression,
      completedAny: Array.from(new Set([...progression.completedAny, genPlayed])),
      completedMedium: isMediumOrHard
        ? Array.from(new Set([...progression.completedMedium, genPlayed]))
        : progression.completedMedium,
      completedHard: difficulty === 'hard'
        ? Array.from(new Set([...progression.completedHard, genPlayed]))
        : progression.completedHard,
    }
    localStorage.setItem('pokerand_progression', JSON.stringify(updatedProgression))
    setProgression(updatedProgression)
    if (difficulty === 'hard') unlockAchievement('hard_win')
    if (difficulty === 'easy') unlockAchievement('rookie')
    if (difficulty === 'medium') unlockAchievement('medium_win')
  }

  function finalizeRunVictory(): void {
    const wins = record.wins + 1
    persistRecord(wins, record.losses)
    recordFinishedRun('win', team)
    // Actualizar progresión de desbloqueos
    const genPlayed = currentRunGen
    const isMediumOrHard = difficulty === 'medium' || difficulty === 'hard'

    const newlyUnlockedHard = !progression.completedAny.includes(genPlayed)
    const newlyUnlockedNextGen = isMediumOrHard && genPlayed < 9 && !progression.completedMedium.includes(genPlayed)
    const newlyUnlockedInfinite = difficulty === 'hard' && !progression.completedHard.includes(genPlayed)

    const nextCompletedAny = Array.from(new Set([...progression.completedAny, genPlayed]))
    const nextCompletedMedium = isMediumOrHard
      ? Array.from(new Set([...progression.completedMedium, genPlayed]))
      : progression.completedMedium
    const nextCompletedHard = difficulty === 'hard'
      ? Array.from(new Set([...progression.completedHard, genPlayed]))
      : progression.completedHard

    const updatedProgression: ProgressionData = {
      completedAny: nextCompletedAny,
      completedMedium: nextCompletedMedium,
      completedHard: nextCompletedHard,
      completedColiseum: progression.completedColiseum,
      completedLeague: currentNode && currentNode.id >= 1000 && currentNode.id < 2000
        ? Array.from(new Set([...progression.completedLeague, genPlayed]))
        : progression.completedLeague,
      completedOriginal: difficulty === 'original'
        ? Array.from(new Set([...progression.completedOriginal, genPlayed]))
        : progression.completedOriginal,
      completedBranch: difficulty === 'branch'
        ? Array.from(new Set([...progression.completedBranch, genPlayed]))
        : progression.completedBranch
    }

    localStorage.setItem('pokerand_progression', JSON.stringify(updatedProgression))
    setProgression(updatedProgression)

    setVictoryUnlocks({
      genName: generationRegions[genPlayed],
      nextGenNumber: newlyUnlockedNextGen ? genPlayed + 1 : null,
      nextGenName: newlyUnlockedNextGen ? generationRegions[genPlayed + 1] : null,
      unlockedHard: newlyUnlockedHard,
      unlockedInfinite: newlyUnlockedInfinite
    })

    const newStreak = winStreak + 1
    setWinStreak(newStreak)
    localStorage.setItem('pokerand_streak', String(newStreak))
    if (newStreak > bestStreak) {
      setBestStreak(newStreak)
      localStorage.setItem('pokerand_best_streak', String(newStreak))
    }
    unlockAchievement('first_win')
    if (runChallenges.nuzlocke || runChallenges.nuzlockeHardcore) unlockAchievement('nuzlocke_win')
    if (team.length <= 1) unlockAchievement('solo_win')
    if (runChallenges.speedrun) unlockAchievement('speedrun_win')
    if (runChallenges.noItems) unlockAchievement('no_item_win')
    if (runChallenges.ironman) unlockAchievement('ironman_win')
    if (difficulty === 'hard') unlockAchievement('hard_win')
    if (difficulty === 'easy') unlockAchievement('rookie')
    if (runChallenges.bossRush) unlockAchievement('boss_rush_win')
    if (runChallenges.challengeGauntlet) unlockAchievement('gauntlet_win')
    if (nextCompletedAny.length >= 9) unlockAchievement('all_gens')

    if (difficulty === 'medium') unlockAchievement('medium_win')
    if (metaProgression.totalWins === 0) unlockAchievement('first_try')

    // Logros cooperativos: victoria compartida
    if (coopModeRef.current) {
      setMetaProgression(prev => {
        const updated = { ...prev, coopWins: prev.coopWins + 1 }
        localStorage.setItem('pokerand_meta', JSON.stringify(updated))
        return updated
      })
      unlockAchievement('coop_win')
      if (coopDiffRef.current === 'hard') unlockAchievement('coop_hard_win')
    }

    if (runChallenges.noShops) unlockAchievement('noShops_win')
    if (runChallenges.noRests) unlockAchievement('noRests_win')
    if (runChallenges.allShiny) unlockAchievement('allShiny_win')
    if (runChallenges.noMoney) unlockAchievement('noMoney_win')
    if (runChallenges.egglocke) unlockAchievement('egglocke_win')
    if (runChallenges.nuzlockeHardcore) unlockAchievement('nuzlockeHC_win')
    if (runChallenges.noHealing) unlockAchievement('noHeal_win')
    if (runChallenges.allTeamRocket) unlockAchievement('allTeamRocket_win')

    const activeChallengeCount = Object.entries(runChallenges).filter(([k, v]) => v && k !== 'allShiny').length
    if (activeChallengeCount >= 3) unlockAchievement('triple_challenge')
    if (activeChallengeCount >= 5) unlockAchievement('challenge_mania')
    if (battleMegaUsed) unlockAchievement('mega_win')
    if (battleGmaxUsed) unlockAchievement('gmax_win')
    if (modifier?.forcedWeather || modifier2?.forcedWeather) unlockAchievement('weather_mania_win')
    if (difficulty === 'original') unlockAchievement('original_win')

    const hasActiveChallenge = activeChallengeCount > 0
    const baseCoins = difficulty === 'easy' ? 10 : difficulty === 'hard' ? 20 : 15

    setMetaProgression(prev => {
      const coins = baseCoins + (hasActiveChallenge ? 15 : 0)
      const updated = { ...prev, totalRuns: prev.totalRuns + 1, totalWins: prev.totalWins + 1, bestStreak: Math.max(prev.bestStreak, newStreak), pokeCoins: prev.pokeCoins + coins }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
    awardPokeCoins(baseCoins, `¡Victoria! (${difficulty === 'easy' ? 'Fácil' : difficulty === 'hard' ? 'Difícil' : 'Medio'})`)
    if (currentNode && currentNode.id >= 1000 && currentNode.id < 2000) {
      awardPokeCoins(15, '🏆 Victoria en la Liga Pokémon')
    }
    if (hasActiveChallenge) awardPokeCoins(15, 'Bonus Desafío Activo')
    if (team.length <= 1) awardPokeCoins(5, 'Bonus Solo Pokémon')

    setScreen('victory')
    playVictoryFanfare()
    if (isDailyRunRef.current && Object.values(runChallenges).every(v => !v)) {
      setDailyPlayed(true)
      localStorage.setItem('pokerand_daily', dailySeed)
      awardPokeCoins(15, 'Bonus Desafío Diario')
      unlockAchievement('daily_3')
    }
  }

  async function completeCurrentNode(): Promise<void> {
    clearFishingTimers()
    clearMiningTimers()
    advanceDaycareEgg()
    // Las etapas de stats (subidas/bajadas de Ataque, Def. Esp., etc.) solo
    // duran un combate: se eliminan SIEMPRE al completar el nodo, tanto bufos
    // como debufos, para que nada se "pegue" de un combate a otro. También se
    // limpian los estados ligados al combate como Drenadoras o Anulación.
    setTeam(prev => prev.map(p => ({
      ...p,
      statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
      furiaActive: false,
      leechSeed: false,
      disabled: undefined,
      lastMove: undefined,
      justEntered: false,
      choiceLockedMove: undefined,
    })))

    if (difficulty === 'coliseum') {
      setTeam(prev => prev.map(p => ({ ...p, hp: p.maxHp, status: undefined })))
      setBattleLog(prev => [t('b.autoHeal'), ...prev].slice(0, 15))
    }

    setRestEncounter(null)
    setRestRewardItem('')
    setRestExtraItems([])
    setLegendaryEncounter(null)
    setBattleTurns(0)
    if (speedrunTimerRef.current) {
      clearInterval(speedrunTimerRef.current)
      speedrunTimerRef.current = null
    }
    setSpeedrunSeconds(0)
    setTeam(prev => prev.map((p) => {
      const orig = p.megaOrig
      if (orig) return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, originEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, ...orig }
      return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, originEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined }
    }))
    setBattleGmaxUsed(false)
    setBattlePrimalUsed(false)
    setBattleOriginUsed(false)
    setRoute((previous) =>
      previous.map((node, index) => (index === routeIndex ? { ...node, done: true } : node))
    )

    // --- Modo Ruta: el mapa ramificado avanza columna a columna hasta el jefe ---
    if (difficulty === 'branch') {
      if (currentNode?.type === 'boss') {
        // Derrotar al jefe de la etapa → una medalla nueva.
        const available = GYM_BADGES.filter(b => !branchMedals.some(m => m.id === b.id))
        const medal = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null
        if (!medal) return
        const newMedals = [...branchMedals, medal]
        setBranchMedals(newMedals)
        setStageNotice({ medal, stage: newMedals.length + 1 })
        awardPokeCoins(5, '🎖️ Bonus por derrotar a un jefe del Modo Ruta')
        if (newMedals.length >= 8) {
          // 8 medallas → modo completado.
          unlockAchievement('branch_win')
          setBattleLog((prev) => [t('b.originalMedal', { n: newMedals.length, total: 8 }), ...prev].slice(0, 15))
          finalizeRunVictory()
          return
        }
        const nextStage = newMedals.length + 1
        const stage = generateBranchStage(nextStage, routeRandRef.current)
        setBranchMap(stage.columns)
        setBranchCol(0)
        setRoute(stage.flat)
        setRouteIndex(0)
        setScreen('route')
        setBattleLog((prev) => [
          t('b.originalMedal', { n: newMedals.length, total: 8 }),
          `🗺️ ${language === 'en' ? 'Stage' : 'Etapa'} ${nextStage} — ${language === 'en' ? 'choose your path' : 'elige tu camino'}`,
          ...prev
        ].slice(0, 15))
        return
      }
      // Nodo normal completado → avanzar a la siguiente columna del mapa.
      const columns = branchMap
      if (!columns) return
      const nextCol = branchCol + 1
      if (nextCol < columns.length) {
        setBranchCol(nextCol)
        setRouteIndex(branchColumnStartIndex(columns, nextCol))
        setScreen('route')
        return
      }
      return
    }

    // --- Gate de ritmo cooperativo: esperar a que el compañero complete el nodo ---
    if (coopModeRef.current && coopSessionCodeRef.current && currentNode) {
      // Usamos currentNode.id (único en toda la run) y no routeIndex: el índice
      // se reinicia a 0 en cada etapa, y coop_progress está indexado por nodo,
      // por lo que con índices los jefes de etapas distintas colisionaban y el
      // gate creía que el compañero ya había terminado.
      const gateResult = await waitForCoopPartner(currentNode.id)
      if (gateResult === 'won' || gateResult === 'lost') {
        handleCoopSessionEnded(gateResult)
        return
      }
    }

    if (routeIndex >= route.length - 1) {
      // Modo Original: al derrotar el jefe de una etapa se gana una medalla.
      // Con 8 medallas, la Calle Victoria y la Liga son obligatorias.
      if (currentNode && currentNode.id >= 4000 && difficulty === 'original') {
        // Medalla única: se elige una insignia que aún no se haya ganado.
        const available = GYM_BADGES.filter(b => !originalMedals.some(m => m.id === b.id))
        const medal = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null
        if (!medal) return
        const newMedals = [...originalMedals, medal]
        setOriginalMedals(newMedals)
        setStageNotice({ medal, stage: newMedals.length + 1 })
        awardPokeCoins(5, '🎖️ Bonus por derrotar a un jefe del Modo Original')
        if (newMedals.length >= 8) {
          setTempLeagueTeam([])
          setLeagueTeamSelection(true)
          return
        }
        setRoute(buildOriginalStageRoute(newMedals.length + 1))
        setRouteIndex(0)
        setScreen('route')
        setBattleLog((prev) => [t('b.originalMedal', { n: newMedals.length, total: 8 }), ...prev].slice(0, 15))
        return
      }
      // Calle Victoria completada → Encuentro legendario de la región antes de la Liga.
      if (currentNode && currentNode.id >= 2000) {
        const maxLvl = Math.max(...team.map(p => p.level)) + 2
        // Si el nodo completado es la Calle Victoria (no el encuentro legendario),
        // se abre el mapa del legendario: un solo nodo salvaje y capturable.
        if (difficulty === 'original' && currentNode.type !== 'legendary') {
          setRoute([{ id: 3000, type: 'legendary', label: 'Legendario de la región', done: false }])
          setRouteIndex(0)
          setScreen('route')
          setBattleLog(prev => [t('b.legendaryEncounterWelcome', { lvl: maxLvl }), ...prev].slice(0, 15))
          return
        }
        // Encuentro legendario completado → Liga (4 jefes en un mapa nuevo).
        const leagueRoute: RouteNode[] = []
        for (let i = 0; i < 4; i++) {
          leagueRoute.push({ id: 1000 + i, type: 'boss', label: `Liga #${i + 1}`, done: false })
        }
        setRoute(leagueRoute)
        setRouteIndex(0)
        setScreen('route')
        setBattleLog(prev => [t('b.leagueWelcome', { lvl: maxLvl }), ...prev].slice(0, 15))
        return
      }
      if (difficulty === 'infinite') {
        if ((routeIndex + 1) % 10 === 0) awardPokeCoins(5, t('b.infiniteBonus10'))
        if (routeIndex >= 19) unlockAchievement('infinite_20')
        if (routeIndex >= 49) unlockAchievement('infinite_50')
        if (routeIndex >= 99) unlockAchievement('infinite_100')
        const nextId = route.length + 1
        const batch = Array.from({ length: infiniteNodeSize }, (_, k) => generateRandomNodeType(nextId + k, routeRandRef.current))
        setRoute((previous) => [...previous, ...batch])
        setBattleLog((prev) => [
          t('b.infiniteNewRoutes'),
          ...prev
        ].slice(0, 15))
        setRouteIndex((previous) => previous + 1)
        setScreen('route')
        return
      }

      if (difficulty === 'coliseum') {
        unlockAchievement('first_win')
        unlockAchievement('coliseum_win')
        if (difficulty === 'coliseum') unlockAchievement('hard_win')
        setMetaProgression(prev => {
          const updated = { ...prev, totalRuns: prev.totalRuns + 1, totalWins: prev.totalWins + 1, bestStreak: Math.max(prev.bestStreak, winStreak + 1) }
          localStorage.setItem('pokerand_meta', JSON.stringify(updated))
          return updated
        })
        setProgression(prev => {
          const genPlayed = currentRunGen
          const updated = { ...prev, completedColiseum: Array.from(new Set([...prev.completedColiseum, genPlayed])) }
          localStorage.setItem('pokerand_progression', JSON.stringify(updated))
          return updated
        })
        setWinStreak(prev => prev + 1)
        awardPokeCoins(30, '👑 Victoria en COLISEUM')
        setScreen('victory')
        playVictoryFanfare()
        return
      }

      // Sistema de insignias: al derrotar un jefe, obtienes una insignia
      if (currentNode?.type === 'boss' && currentNode.id < 1000) {
        const availableBadges = GYM_BADGES.filter(b => !badges.some(h => h.id === b.id))
        if (availableBadges.length > 0) {
          const newBadge = availableBadges[Math.floor(Math.random() * availableBadges.length)]
          const updatedBadges = [...badges, newBadge]
          setBadges(updatedBadges)
          setCurrentStage(updatedBadges.length + 1)
          setStageNotice({ medal: newBadge, stage: updatedBadges.length + 1 })
          setBattleLog((prev) => [t('battle.obtainedBadge', { badge: newBadge.name, n: updatedBadges.length }), ...prev].slice(0, 15))
          const diffForCoins = coopModeRef.current ? (coopDiffRef.current || 'medium') : difficulty
          const stageCoins = Math.floor((diffForCoins === 'easy' ? 10 : diffForCoins === 'hard' ? 20 : 15) / 2)
          awardPokeCoins(stageCoins, `🏅 Bonus por completar la etapa ${updatedBadges.length} de 3`)
        }
        if (badges.length < 2) {
          // Generar nueva ruta para la siguiente etapa
          const totalNodesPerStage = coopModeRef.current
            ? (difficultyNodeCounts[coopDiffRef.current || 'medium'] || 10)
            : difficultyNodeCounts[difficulty]
          const startId = route.length + 1
          const newRoute = coopModeRef.current
            ? generateCoopRouteSegment(startId, totalNodesPerStage, routeRandRef.current, runChallenges, coopDiffRef.current || 'medium')
            : (() => {
              const nr: RouteNode[] = []
              for (let i = 0; i < totalNodesPerStage - 1; i++) {
                nr.push(generateRandomNodeType(startId + i, routeRandRef.current))
              }
              nr.push({ id: startId + totalNodesPerStage - 1, label: `Jefe #${startId + totalNodesPerStage - 1}`, type: 'boss', done: false })
              // En dificultad Difícil, garantizar 2 nodos de Casino por etapa.
              if (
                difficulty === 'hard' &&
                !runChallenges.allTeamRocket &&
                isActive('unlock_casino_node') &&
                nr.length > 2
              ) {
                const candidates = nr.map((_, idx) => idx).filter(idx => idx < nr.length - 1 && nr[idx].type !== 'boss')
                const rr = routeRandRef.current
                let placed = 0
                while (placed < 2 && candidates.length > 0) {
                  const idx = Math.floor(rr() * candidates.length)
                  const pos = candidates.splice(idx, 1)[0]
                  nr[pos] = { ...nr[pos], id: nr[pos].id, type: 'casino', label: `Casino #${nr[pos].id}`, done: false }
                  placed++
                }
              }
              return nr
            })()
          setRoute(newRoute)
          setRouteIndex(0)
          setScreen('route')
          return
        }
        // badges.length >= 2 → 3ª insignia ya entregada
        if (coopModeRef.current) {
          // Cooperativo: sin liga, victoria directa
          finalizeRunVictory()
          return
        }
        if ((difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') && currentNode && currentNode.id < 1000) {
          // Llegar a la liga significa haber completado el modo: desbloquea la
          // insignia de dificultad aunque luego pierdas en la liga.
          unlockDifficultyBadge()
          setLeagueOffer(true)
          return
        }
      }

      finalizeRunVictory()
      return
    }

    setRouteIndex((previous) => previous + 1)
    setRunStats(prev => ({ ...prev, nodesCleared: prev.nodesCleared + 1 }))
    if (difficulty === 'infinite' && (routeIndex + 1) % 10 === 0) awardPokeCoins(5, t('b.infiniteBonus10'))
    const progress = route.length > 0 ? (routeIndex + 1) / route.length : 0
    // En la Liga (ids 1000-1999) no hay PC ni eventos aleatorios: es una
    // sucesión de jefes sin ningún tipo de curación entre combates.
    const isLeagueNode = currentNode ? currentNode.id >= 1000 && currentNode.id < 2000 : false
    if (difficulty !== 'coliseum' && !isLeagueNode) triggerRandomEvent(progress)
    if (!activeRandomEvent) setScreen('route')
  }

  // --- Cooperativo: helpers ---

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  async function waitForCoopPartner(nodeIndex: number): Promise<'ready' | 'won' | 'lost'> {
    const code = coopSessionCodeRef.current
    if (!code) return 'ready'

    await markNodeReady(code, nodeIndex)
    setCoopWaitingNode(nodeIndex)
    setCoopWaiting(true)

    try {
      let isA = coopMyRoleRef.current === 'a'
      let polls = 0
      while (true) {
        const prog = await getCoopProgress(code, nodeIndex)
        if (!prog) {
          // Error de servidor: no bloquear al jugador
          return 'ready'
        }
        if (prog.finished) {
          // El compañero terminó la sesión. Si ganó la run, nosotros también
          // (cooperativo). Si perdió/abandonó, la run termina para ambos.
          return prog.result === 'won' ? 'won' : 'lost'
        }
        const partnerReady = isA ? prog.b_ready : prog.a_ready
        if (partnerReady) return 'ready'
        polls++
        // Red de seguridad: si el compañero nunca responde (~5 min), continúa
        // en solitario en vez de quedarse esperando para siempre.
        if (polls >= 120) {
          setBattleLog((prev) => [t('b.soloPartnerLeft'), ...prev].slice(0, 15))
          return 'ready'
        }
        await sleep(2500)
      }
    } finally {
      setCoopWaiting(false)
    }
  }

  function handleCoopSessionEnded(result: 'won' | 'lost'): void {
    if (result === 'won') {
      setVoluntaryRunEnd(false)
      finalizeRunVictory()
    } else {
      setCoopSessionEndedMsg('Tu compañero finalizó o abandonó la sesión. La run ha terminado para ambos.')
      // Cierre de partida completo (derrota), igual que el jugador que perdió,
      // para que ambos reciban el mismo trato (récord, racha y PokéCoins).
      const losses = record.losses + 1
      persistRecord(record.wins, losses)
      recordFinishedRun('loss', team)
      setWinStreak(0)
      localStorage.setItem('pokerand_streak', '0')
      setMetaProgression(prev => {
        const updated = { ...prev, totalRuns: prev.totalRuns + 1 }
        localStorage.setItem('pokerand_meta', JSON.stringify(updated))
        return updated
      })
      awardPokeCoins(5, 'Partida completada (cooperativo)')
      setScreen('defeat')
      playDefeatMusic()
    }
  }

  async function handleCreateCoopSession(): Promise<void> {
    if (!authUser) {
      setCoopError('Para jugar en cooperativo necesitas iniciar sesión o crear una cuenta.')
      openLeaderboard()
      return
    }
    if (!isCoopEnabled()) {
      setCoopError('Cooperativo no disponible: configura Supabase en las variables de entorno.')
      return
    }
    setCoopError('')
    setIsLoading(true)
    try {
      isDailyRunRef.current = false
      const seed = String(Math.random()).slice(2, 12)
      const gen = coopGen || generation || 1
      const code = await createCoopSession(seed, gen, coopDiff)
      if (!code) {
        setCoopError('No se pudo crear la sesión. Revisa que las tablas existan en Supabase (schema.sql).')
        return
      }
      setCoopMode(true)
      setCoopSessionCode(code)
      setCoopSeed(seed)
      setCoopMyRole('a')
      setCoopPartnerJoined(false)
      coopModeRef.current = true
      coopSessionCodeRef.current = code
      coopSeedRef.current = seed
      coopMyRoleRef.current = 'a'
      coopGenRef.current = gen
      coopDiffRef.current = coopDiff
      coopAutoStartedRef.current = false
    } finally {
      setIsLoading(false)
    }
  }

  async function handleJoinCoopSession(): Promise<void> {
    const codeInput = coopJoinCode.trim().toUpperCase()
    if (codeInput.length < 4) {
      setCoopError(t('coop.needCode'))
      return
    }
    if (!authUser) {
      setCoopError('Para jugar en cooperativo necesitas iniciar sesión o crear una cuenta.')
      openLeaderboard()
      return
    }
    setCoopError('')
    setIsLoading(true)
    try {
      isDailyRunRef.current = false
      const session = await joinCoopSession(codeInput)
      if (!session) {
        setCoopError('No se pudo unir a la sesión. Comprueba el código o que no esté llena.')
        return
      }
      setCoopMode(true)
      setCoopSessionCode(session.code)
      setCoopSeed(session.seed)
      setCoopMyRole('b')
      setCoopGen(session.gen || 1)
      setCoopDiff((session.difficulty as 'easy' | 'medium' | 'hard') || 'medium')
      setCoopPartnerJoined(true)
      // Fijar refs directamente: startNewRun los lee de forma síncrona antes de
      // que los useEffect sincronicen el estado.
      coopModeRef.current = true
      coopSessionCodeRef.current = session.code
      coopSeedRef.current = session.seed
      coopMyRoleRef.current = 'b'
      coopGenRef.current = session.gen || 1
      coopDiffRef.current = (session.difficulty as 'easy' | 'medium' | 'hard') || 'medium'
      // La partida empieza automáticamente al unirse.
      setCoopStarting(true)
      await startNewRun()
      // Mantiene la pantalla de carga unos segundos antes de entrar.
      await sleep(2500)
    } catch {
      setCoopError('No se pudo iniciar la aventura. Reintenta.')
    } finally {
      setIsLoading(false)
      setCoopStarting(false)
    }
  }

  function cancelCoopSession(): void {
    if (coopSessionCodeRef.current) void deleteCoopSessionRpc(coopSessionCodeRef.current)
    coopAutoStartedRef.current = false
    setCoopMode(false)
    setCoopSessionCode('')
    setCoopSeed('')
    setCoopJoinCode('')
    setCoopMyRole(null)
    setCoopPartnerJoined(false)
    setCoopError('')
  }

  function abandonCoopRun(): void {
    setCoopWaiting(false)
    if (coopSessionCodeRef.current) void finishCoopSession(coopSessionCodeRef.current, 'lost')
    setVoluntaryRunEnd(true)
    setDefeatSummary(null)
    setScreen('defeat')
  }

  async function restartRun(): Promise<void> {
    if (coopModeRef.current && coopSessionCodeRef.current) {
      coopRestartInitiatedRef.current = true
      const reset = await resetCoopSession(coopSessionCodeRef.current)
      if (reset === 'blocked') {
        coopRestartInitiatedRef.current = false
        setCoopError(t('coop.waitPartnerFinish'))
        setCoopRestartBlockedMsg(t('coop.waitPartnerFinish'))
        return
      }
      let exists = reset === 'ok'
      setCoopSessionEndedMsg('')
      setCoopRestartBlockedMsg('')
      setCoopWaiting(false)
      if (!exists) {
        // La sesión fue eliminada (p. ej. esquema antiguo o cancelada). Se recrea
        // con la misma semilla para seguir jugando sin pasar por el menú.
        const seed = coopSeedRef.current || String(Math.random()).slice(2, 12)
        const newCode = await createCoopSession(seed, coopGenRef.current || 1, coopDiffRef.current || 'medium')
        if (newCode) {
          coopSessionCodeRef.current = newCode
          coopSeedRef.current = seed
          setCoopSessionCode(newCode)
          setCoopError(`🤝 Sesión recreada: ${newCode}. Compártela con tu compañero.`)
          exists = true
        }
      }
      if (exists) {
        setVoluntaryRunEnd(false)
        setDefeatSummary(null)
        await startNewRun(true)
        return
      }
      setCoopError('No se pudo reiniciar la sesión cooperativa.')
      resetToSetup()
      return
    }
    setVoluntaryRunEnd(false)
    setDefeatSummary(null)
    await startNewRun(false)
  }

  // Polling mientras se crea la sesión: cuando el compañero se une, el jugador A
  // arranca la partida automáticamente (igual que el B al unirse).
  useEffect(() => {
    if (!coopMode || !coopSessionCode || coopMyRole !== 'a') return
    const code = coopSessionCode
    let cancelled = false
    const timer = setInterval(async () => {
      if (cancelled || coopAutoStartedRef.current) return
      const sess = await getCoopSession(code)
      if (!sess) return
      if (sess.player_b_id) {
        coopAutoStartedRef.current = true
        setCoopPartnerJoined(true)
        setCoopStarting(true)
        try {
          await startNewRun()
          // Mantiene la pantalla de carga unos segundos antes de entrar.
          await sleep(2500)
        } finally {
          setCoopStarting(false)
        }
      }
    }, 3000)
    return () => { cancelled = true; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coopMode, coopSessionCode, coopMyRole])

  // Al terminar la run (victoria o derrota), cierra la sesión cooperativa para
  // que el compañero que espera en un nodo quede liberado.
  useEffect(() => {
    if (screen !== 'victory' && screen !== 'defeat') return
    if (!coopModeRef.current || !coopSessionCodeRef.current) return
    const code = coopSessionCodeRef.current
    const result = screen === 'victory' ? 'won' : 'lost'
    void finishCoopSession(code, result).then((ok) => {
      if (!ok) {
        // Reintenta una vez por si la primera llamada falló.
        setTimeout(() => { void finishCoopSession(code, result) }, 3000)
      }
    })
  }, [screen])

  // En cooperativo, si estás en victoria/derrota y el compañero reinicia la
  // sesión (señal restart_requested), arranca la partida de nuevo automáticamente
  // para que los dos entren a la vez en la misma ruta.
  useEffect(() => {
    if (!coopModeRef.current || !coopSessionCodeRef.current) return
    if (screen !== 'victory' && screen !== 'defeat') return
    const code = coopSessionCodeRef.current
    let cancelled = false
    const timer = setInterval(async () => {
      if (cancelled) return
      const sess = await getCoopSession(code)
      if (!sess) return
      // Si el compañero ya terminó, se puede reiniciar: se limpia el aviso.
      const otherFinished = coopMyRoleRef.current === 'a' ? sess.finished_b : sess.finished_a
      if (otherFinished) setCoopRestartBlockedMsg('')
      if (sess.restart_requested && !coopRestartInitiatedRef.current) {
        cancelled = true
        clearInterval(timer)
        await clearCoopRestart(code)
        setCoopSessionEndedMsg('')
        setCoopRestartBlockedMsg('')
        setVoluntaryRunEnd(false)
        setDefeatSummary(null)
        await startNewRun(true)
      }
    }, 3000)
    return () => { cancelled = true; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, coopMode, coopSessionCode])

  // Reinicia el ref de reinicio local al salir de la pantalla de victoria/derrota,
  // para que en la siguiente run la detección automática vuelva a funcionar.
  useEffect(() => {
    if (screen !== 'victory' && screen !== 'defeat') {
      coopRestartInitiatedRef.current = false
      setCoopRestartBlockedMsg('')
    }
  }, [screen])

  function buildOfferFromPokemon(p: Pokemon): CoopTrade['offer'] {
    return {
      kind: 'pokemon',
      id: p.id,
      name: p.name,
      sprite: p.sprite,
      level: p.level,
      shiny: p.shiny,
      hp: p.hp,
      maxHp: p.maxHp,
      attack: p.attack,
      defense: p.defense,
      spAttack: p.spAttack,
      spDefense: p.spDefense,
      speed: p.speed,
      moves: p.moves.map(m => ({ name: m.name, power: m.power, type: m.type, accuracy: m.accuracy })),
      types: p.types,
      holdItem: p.holdItem,
      status: p.status ? { type: p.status.type, turns: p.status.turns } : null,
    }
  }

  function rebuildPokemonFromOffer(offer: CoopTrade['offer']): Pokemon {
    return {
      id: offer.id ?? 1,
      name: offer.name ?? '???',
      sprite: offer.sprite ?? '',
      level: offer.level ?? 10,
      hp: offer.hp ?? 10,
      maxHp: offer.maxHp ?? 10,
      attack: offer.attack ?? 10,
      defense: offer.defense ?? 10,
      spAttack: offer.spAttack ?? 10,
      spDefense: offer.spDefense ?? 10,
      speed: offer.speed ?? 10,
      moves: (offer.moves ?? []).map(m => ({ ...m, description: '', accuracy: m.accuracy })),
      types: offer.types,
      holdItem: offer.holdItem ?? undefined,
      shiny: offer.shiny,
      status: offer.status ? { type: offer.status.type as StatusType, turns: offer.status.turns } : undefined,
    }
  }

  // --- Modo PvP 1vs1 ---

  function openPvpModal(): void {
    playClick()
    if (!authUser) {
      setPvpError(t('pvp.needLogin'))
      setShowPvpModal(true)
      return
    }
    setPvpError('')
    setShowPvpModal(true)
  }

  function openPvpTeamBuilder(): void {
    playClick()
    setPvpBuildTeam(pvpTeam.map(p => JSON.parse(JSON.stringify(p)) as Pokemon))
    setPvpBuildSelected(null)
    setPvpBuildSelectedShiny(false)
    setPvpBuildDexMode('normal')
    setPvpBuildMoves([])
    setPvpBuildSelectedMoveNames(new Set())
    setPvpBuildSearch('')
    setShowPvpTeamBuilder(true)
  }

  async function loadPvpBuildMoves(id: number, existingMoveNames: string[] = [], shiny = false): Promise<void> {
    setPvpBuildLoading(true)
    setPvpBuildSelected(id)
    setPvpBuildSelectedShiny(shiny)
    setPvpBuildMoves([])
    try {
      const base = await buildPokemonFromApi(id, 1, 50, shiny, 'pvp')
      const levelUp = (base.rawLevelUpMoves ?? []).slice(0, 40)
      const details = (await Promise.all(levelUp.map(m => getMoveDetails(m.url)))).filter((m): m is Move => m !== null)
      const seen = new Set<string>()
      const unique = details.filter(m => {
        if (seen.has(m.name)) return false
        seen.add(m.name)
        return true
      })
      setPvpBuildMoves(unique)
      setPvpBuildSelectedMoveNames(new Set(unique.filter(m => existingMoveNames.includes(m.name)).map(m => m.name)))
    } catch {
      setPvpBuildMoves([])
    } finally {
      setPvpBuildLoading(false)
    }
  }

  function addPvpBuildPokemon(): void {
    if (pvpBuildSelected === null) return
    const isShiny = pvpBuildSelectedShiny
    const samePokemon = (p: Pokemon) => p.id === pvpBuildSelected && !!p.shiny === isShiny
    const existing = pvpBuildTeam.find(samePokemon)
    if (existing) {
      setPvpBuildTeam(prev => prev.map(p => samePokemon(p)
        ? { ...existing, moves: pvpBuildMoves.filter(m => pvpBuildSelectedMoveNames.has(m.name)) }
        : p))
      setPvpBuildSelected(null)
      setPvpBuildMoves([])
      setPvpBuildSelectedMoveNames(new Set())
      return
    }
    if (pvpBuildTeam.length >= 6) return
    void (async () => {
      try {
        const full = await buildPokemonFromApi(pvpBuildSelected, 1, 50, isShiny, 'pvp')
        const chosenMoves = pvpBuildMoves.filter(m => pvpBuildSelectedMoveNames.has(m.name))
        const pokemon: Pokemon = {
          ...full,
          shiny: isShiny || undefined,
          hp: full.maxHp,
          moves: chosenMoves,
        }
        setPvpBuildTeam(prev => [...prev, pokemon])
        setPvpBuildSelected(null)
        setPvpBuildMoves([])
        setPvpBuildSelectedMoveNames(new Set())
      } catch {
        setPvpError('No se pudo añadir el Pokémon.')
      }
    })()
  }

  function savePvpTeam(): void {
    if (pvpBuildTeam.length === 0) {
      setPvpError('Tu equipo PvP no puede estar vacío.')
      return
    }
    const saved = pvpBuildTeam.map(p => serializePvpPokemon(p))
    const next = pvpTeams.map((t, i) => (i === pvpActiveSlot ? saved : t))
    setPvpTeams(next)
    localStorage.setItem('pokerand_pvp_teams', JSON.stringify(next))
    localStorage.setItem('pokerand_pvp_active_slot', String(pvpActiveSlot))
    setShowPvpTeamBuilder(false)
    playClick()
  }

  function selectPvpTeamSlot(slot: number): void {
    if (slot < 0 || slot > 2) return
    setPvpActiveSlot(slot)
    localStorage.setItem('pokerand_pvp_active_slot', String(slot))
    setPvpError('')
  }

  async function startPvpOnline(): Promise<void> {
    if (!authUser) { openLeaderboard(); return }
    if (!isPvpEnabled()) {
      setPvpError('El PvP no está configurado: añade tus credenciales de Supabase en el .env y ejecuta schema.sql.')
      return
    }
    if (pvpTeam.length === 0) {
      setPvpError('Primero crea tu equipo con "Hacerse el equipo".')
      return
    }
    setPvpError('')
    setPvpSearching(true)
    const result = await findPvpOpponent(pvpTeam)
    if (!result) {
      setPvpSearching(false)
      setPvpError('Error al buscar oponente. Inténtalo de nuevo.')
      return
    }
    if (result.joined) {
      startPvpBattle(result, 'b')
      return
    }
    setPvpMatchId(result.match_id)
    setPvpRoomCode(result.code ?? '')
    setPvpWaitingOpponent(true)
  }

  async function createPvpCustom(): Promise<void> {
    if (!authUser) { openLeaderboard(); return }
    if (!isPvpEnabled()) {
      setPvpError('El PvP no está configurado: añade tus credenciales de Supabase en el .env y ejecuta schema.sql.')
      return
    }
    if (pvpTeam.length === 0) {
      setPvpError('Primero crea tu equipo con "Hacerse el equipo".')
      return
    }
    setPvpError('')
    const result = await createPvpRoom(pvpTeam)
    if (!result) {
      setPvpError('Error al crear la sala.')
      return
    }
    setPvpRoomCode(result.code ?? '')
    setPvpMatchId(result.match_id)
    setPvpWaitingOpponent(true)
  }

  async function joinPvpCustom(): Promise<void> {
    if (!authUser) { openLeaderboard(); return }
    if (!isPvpEnabled()) {
      setPvpError('El PvP no está configurado: añade tus credenciales de Supabase en el .env y ejecuta schema.sql.')
      return
    }
    if (pvpTeam.length === 0) {
      setPvpError('Primero crea tu equipo con "Hacerse el equipo".')
      return
    }
    const code = pvpJoinCode.trim().toUpperCase()
    if (code.length < 4) {
      setPvpError(t('pvp.needRoomCode'))
      return
    }
    setPvpError('')
    const result = await joinPvpRoom(code, pvpTeam)
    if (!result) {
      setPvpError('No se pudo entrar a la sala. Comprueba el código.')
      return
    }
    startPvpBattle(result, result.is_host ? 'a' : 'b')
  }

  function startPvpBattle(result: PvpRoomResult, role: 'a' | 'b'): void {
    setPvpRole(role)
    setPvpMatchId(result.match_id)
    setPvpRoomCode(result.code ?? '')
    setPvpSnapshot(null)
    setPvpMyAction(null)
    setPvpMyActionTurn(-1)
    setPvpChoosingSwitch(false)
    setPvpTimerLeft(0)
    setPvpHit(null)
    setPvpEloGain(null)
    setPvpEloRewarded(false)
    pvpEloRewardedRef.current = false
    pvpPrevTeamHpRef.current = { a: [], b: [] }
    // Cargar Elo propio y del rival para mostrarlo durante la partida.
    void getPvpElo().then((r) => { if (r) setPvpMyElo(r.elo) })
    if (result.match_id) {
      void getPvpMatch(result.match_id).then((m) => {
        if (!m) return
        if (role === 'a') { setPvpMyElo(m.a_elo); setPvpOppElo(m.b_elo) }
        else { setPvpMyElo(m.b_elo); setPvpOppElo(m.a_elo) }
      })
    }
    setPvpSearching(false)
    setPvpWaitingOpponent(false)
    setShowPvpModal(false)
    setScreen('pvp')
    startBattleMusic()
  }

  function cancelPvpWaiting(): void {
    if (pvpMatchIdRef.current && pvpWaitingOpponent) {
      void cancelPvpMatch(pvpMatchIdRef.current)
    }
    setPvpWaitingOpponent(false)
    setPvpSearching(false)
    setPvpRoomCode('')
    setPvpMatchId(null)
    setPvpError('')
  }

  async function pvpSubmitMove(index: number): Promise<void> {
    if (!pvpMatchId || !pvpSnapshot || !pvpRole) return
    const side = pvpSnapshot.state[pvpRole]
    const active = side.team[side.active]
    if (!active || index < 0 || index >= active.moves.length) return
    if ((active.moves[index].pp ?? 0) <= 0) return
    playClick()
    const snap = await submitPvpAction(pvpMatchId, { kind: 'move', index }, pvpSnapshot.turn)
    if (snap) {
      setPvpSnapshot(snap)
      setPvpMyAction({ kind: 'move', index })
      setPvpMyActionTurn(snap.turn)
    } else {
      setPvpError('No se pudo registrar el ataque. Espera al siguiente turno.')
    }
  }

  async function pvpSubmitSwitch(index: number): Promise<void> {
    if (!pvpMatchId || !pvpSnapshot || !pvpRole) return
    const target = pvpSnapshot.state[pvpRole].team[index]
    if (!target || target.hp <= 0) return
    playClick()
    const snap = await submitPvpAction(pvpMatchId, { kind: 'switch', index }, pvpSnapshot.turn)
    if (snap) {
      setPvpSnapshot(snap)
      setPvpMyAction({ kind: 'switch', index })
      setPvpMyActionTurn(snap.turn)
      setPvpChoosingSwitch(false)
    } else {
      setPvpError('No se pudo cambiar de Pokémon.')
    }
  }

  async function pvpCancelAction(): Promise<void> {
    if (!pvpMatchId || !pvpSnapshot || pvpMyActionTurn !== pvpSnapshot.turn) return
    playClick()
    const snap = await clearPvpAction(pvpMatchId, pvpSnapshot.turn)
    if (snap) {
      setPvpSnapshot(snap)
      setPvpMyAction(null)
      setPvpMyActionTurn(-1)
      setPvpChoosingSwitch(false)
    } else {
      setPvpError('No se pudo cancelar la acción.')
    }
  }

  async function pvpStartTimer(): Promise<void> {
    if (!pvpMatchId || !pvpSnapshot) return
    playClick()
    const snap = await startPvpTimer(pvpMatchId)
    if (snap) {
      setPvpSnapshot(snap)
    } else {
      setPvpError('No se pudo iniciar la cuenta atrás.')
    }
  }

  // Revancha: reutiliza el código de la partida anterior para que el mismo
  // rival pueda volver a jugar contra ti.
  async function pvpRematch(): Promise<void> {
    if (!pvpRoomCode || pvpTeam.length === 0) return
    playClick()
    setPvpError('')
    const result = await rematchPvpRoom(pvpRoomCode, pvpTeam)
    if (!result) {
      setPvpError('No se pudo crear la revancha.')
      return
    }
    if (result.joined) {
      startPvpBattle(result, 'b')
    } else {
      setPvpMatchId(result.match_id)
      setPvpRoomCode(result.code ?? '')
      setPvpSnapshot(null)
      setPvpEloGain(null)
      setPvpEloRewarded(false)
      pvpEloRewardedRef.current = false
      setPvpWaitingOpponent(true)
    }
  }

  async function pvpForfeit(): Promise<void> {
    if (pvpMatchId) void forfeitPvpMatch(pvpMatchId)
    pvpLeave()
  }

  function pvpLeave(): void {
    if (pvpLoopRef.current) {
      clearInterval(pvpLoopRef.current)
      pvpLoopRef.current = null
    }
    setPvpSnapshot(null)
    setPvpMyAction(null)
    setPvpMyActionTurn(-1)
    setPvpChoosingSwitch(false)
    setPvpTimerLeft(0)
    setPvpHit(null)
    setPvpEloGain(null)
    setPvpEloRewarded(false)
    pvpEloRewardedRef.current = false
    pvpPrevTeamHpRef.current = { a: [], b: [] }
    if (pvpTimerTickRef.current) {
      clearInterval(pvpTimerTickRef.current)
      pvpTimerTickRef.current = null
    }
    setPvpMatchId(null)
    setPvpRole(null)
    setPvpRoomCode('')
    setPvpSearching(false)
    setPvpWaitingOpponent(false)
    setPvpError('')
    setShowPvpModal(false)
    setScreen('setup')
    startMenuMusic()
  }

  // Polling mientras se espera a que el rival entre en la sala (online/custom).
  useEffect(() => {
    if (!pvpWaitingOpponent || !pvpMatchId) return
    const matchId = pvpMatchId
    const isOnline = pvpSearchingRef.current
    let cancelled = false
    let retries = 0
    const timer = setInterval(async () => {
      if (cancelled) return
      const match = await getPvpMatch(matchId)
      if (!match) return
      if (match.status === 'active') {
        cancelled = true
        clearInterval(timer)
        setPvpWaitingOpponent(false)
        setPvpSearching(false)
        startPvpBattle(
          { match_id: matchId, code: match.code, is_host: true, opponent_name: match.b_name, player_name: match.a_name },
          'a'
        )
        return
      }
      // Online: si llevamos un rato esperando, puede que otro jugador haya
      // creado una sala mientras tanto (dos búsquedas simultáneas). Reintenta.
      if (isOnline && !cancelled) {
        retries++
        if (retries >= 3) {
          retries = 0
          void cancelPvpMatch(matchId)
          const retry = await findPvpOpponent(pvpTeam)
          if (cancelled) return
          if (retry?.joined) {
            cancelled = true
            clearInterval(timer)
            setPvpWaitingOpponent(false)
            startPvpBattle(retry, 'b')
          } else if (retry) {
            cancelled = true
            clearInterval(timer)
            setPvpMatchId(retry.match_id)
            setPvpRoomCode(retry.code ?? '')
          }
        }
      }
    }, 3000)
    return () => { cancelled = true; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pvpWaitingOpponent, pvpMatchId])

  // Bucle principal del combate PvP: lee el estado compartido y, cuando ambos
  // jugadores han enviado su acción, resuelve el turno localmente y lo guarda.
  useEffect(() => {
    if (screen !== 'pvp' || !pvpMatchId) return
    const matchId = pvpMatchId
    let cancelled = false

    const tryResolve = async (snap: PvpTurnSnapshot): Promise<void> => {
      if (pvpResolvingRef.current) return
      pvpResolvingRef.current = true
      try {
        const { state: nextState, changed } = resolvePvpTurn(snap.state, snap.action_a, snap.action_b)
        if (changed) {
          const ok = await resolvePvpTurnRpc(matchId, nextState, snap.turn)
          if (ok) {
            if (nextState.phase === 'finished' && nextState.winner) {
              // Esperamos a que finish_pvp_match confirme el resultado en servidor.
              await finishPvpMatch(matchId, nextState.winner)
            }
            const fresh = await getPvpState(matchId)
            if (fresh && !cancelled) {
              setPvpSnapshot(fresh)
              detectPvpHit(fresh.state)
              setPvpMyAction(null)
              setPvpMyActionTurn(-1)
              setPvpChoosingSwitch(false)
            }
          }
        }
      } finally {
        pvpResolvingRef.current = false
      }
    }

    // Detecta golpes: si el HP de algún Pokémon del equipo bajó, animación roja
    // + sonido. Se compara por índice de equipo (no solo el activo) para que
    // también detecte el golpe a un Pokémon recién sacado con un cambio.
    const detectPvpHit = (st: PvpState): void => {
      if (st.phase === 'finished') return
      for (const side of ['a', 'b'] as const) {
        const ps = st[side]
        const prevArr = pvpPrevTeamHpRef.current[side]
        ps.team.forEach((p, i) => {
          const prevHp = prevArr[i]
          if (prevHp !== undefined && p.hp < prevHp) {
            setPvpHit(prevState => ({ side, key: (prevState?.key ?? 0) + 1 }))
            playHit()
          }
          prevArr[i] = p.hp
        })
      }
    }

    const poll = async (): Promise<void> => {
      if (cancelled) return
      const snap = await getPvpState(matchId)
      if (!snap || cancelled) return
      setPvpSnapshot(snap)
      const st = snap.state
      detectPvpHit(st)
      // Otorgar Elo cuando la partida termina y gané (reintenta cada poll hasta
      // que award_pvp_elo confirme; evita la carrera con finish_pvp_match).
      if (pvpRole && st.phase === 'finished' && st.winner === pvpRole && !pvpEloRewardedRef.current) {
        void awardPvpElo(matchId).then((points) => {
          if (typeof points === 'number') {
            pvpEloRewardedRef.current = true
            setPvpEloRewarded(true)
            setPvpEloGain(points)
            setPvpMyElo(prev => prev + points)
          }
        })
      }
      // Registrar en la Pokédex (silueta) los Pokémon del rival que se revelan.
      if (pvpRole && st.phase !== 'finished') {
        const oppSide = pvpRole === 'a' ? 'b' : 'a'
        const opp = st[oppSide]
        if (opp && opp.team[opp.active] && opp.revealed?.[opp.active]) {
          seenInPokedex(opp.team[opp.active])
        }
      }
      // Cuenta atrás: si venció y el rival no actuó, el que esperaba gana.
      if (snap.timer_by && snap.timer_until && st.phase !== 'finished') {
        const until = Date.parse(snap.timer_until)
        if (!isNaN(until) && until <= Date.now()) {
          const ok = await expirePvpTimer(matchId)
          if (ok) {
            const fresh = await getPvpState(matchId)
            if (fresh && !cancelled) setPvpSnapshot(fresh)
          }
        }
      }
      if (st.phase === 'picking' && snap.action_a && snap.action_b) {
        await tryResolve(snap)
      } else if (st.phase === 'switch') {
        const sf = st.switchFor
        const needA = sf === 'a' || sf === 'both'
        const needB = sf === 'b' || sf === 'both'
        const aOk = !needA || snap.action_a?.kind === 'switch'
        const bOk = !needB || snap.action_b?.kind === 'switch'
        if (aOk && bOk) await tryResolve(snap)
      } else if (st.phase !== 'picking') {
        setPvpChoosingSwitch(false)
      }
    }

    pvpLoopRef.current = setInterval(() => { void poll() }, 2500)
    void poll()
    return () => {
      cancelled = true
      if (pvpLoopRef.current) {
        clearInterval(pvpLoopRef.current)
        pvpLoopRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, pvpMatchId])

  // Cuenta atrás visible del timer PvP (se refresca cada segundo).
  useEffect(() => {
    if (screen !== 'pvp' || !pvpSnapshot?.timer_until) {
      if (pvpTimerTickRef.current) {
        clearInterval(pvpTimerTickRef.current)
        pvpTimerTickRef.current = null
      }
      setPvpTimerLeft(0)
      return
    }
    const until = Date.parse(pvpSnapshot.timer_until)
    const update = () => setPvpTimerLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)))
    update()
    if (pvpTimerTickRef.current) clearInterval(pvpTimerTickRef.current)
    pvpTimerTickRef.current = setInterval(update, 1000)
    return () => {
      if (pvpTimerTickRef.current) {
        clearInterval(pvpTimerTickRef.current)
        pvpTimerTickRef.current = null
      }
    }
  }, [screen, pvpSnapshot])

  function offerLabel(ex: CoopExchange): string {
    const partner = coopMyRoleRef.current === 'a' ? ex.b_offer : ex.a_offer
    if (!partner) return '...'
    return partner.kind === 'pokemon' ? `${partner.name} (Nv.${partner.level})` : (partner.itemName ?? 'un objeto')
  }

  function applyOfferToLocal(offer: CoopTrade['offer']): void {
    if (!offer) return
    // Logros cooperativos: intercambios completados
    setMetaProgression(prev => {
      const updated = { ...prev, coopTrades: prev.coopTrades + 1 }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
    unlockAchievement('coop_first_trade')
    if (offer.kind === 'pokemon') {
      const rebuilt = rebuildPokemonFromOffer(offer)
      if (teamHasRoom(teamRef.current)) {
        setTeam(prev => [...prev, rebuilt])
        setCoopTradeMsg(`🤝 ¡Intercambio completado! Recibiste a ${rebuilt.name} de tu compañero.`)
      } else {
        setPcStorage(prev => [...prev, rebuilt])
        setCoopTradeMsg(`🤝 ¡Intercambio completado! Recibiste a ${rebuilt.name} (enviado al PC).`)
      }
    } else {
      setInventory(prev => [...prev, offer.itemName ?? 'Potion'])
      setCoopTradeMsg(`🤝 ¡Intercambio completado! Recibiste ${offer.itemName ?? 'un objeto'} de tu compañero.`)
    }
  }

  function coopSelectPokemon(idx: number): void {
    const p = team[idx]
    if (!p) return
    if (team.length <= 1) {
      setCoopTradeMsg('No puedes intercambiar a tu único Pokémon.')
      return
    }
    // Guardamos la instancia exacta (no su id de especie) para retirar del
    // equipo el Pokémon correcto aunque haya varios de la misma especie.
    coopSelectedPokemonRef.current = p
    setCoopMyOffer(buildOfferFromPokemon(p))
    setCoopTradeMsg(`Seleccionaste a ${p.name} como oferta. Pulsa "Intercambiar".`)
  }

  function coopSelectItem(itemName: string): void {
    setCoopMyOffer({ kind: 'item', itemName, itemIcon: ITEM_SPRITES[itemName] })
    setCoopTradeMsg(`Seleccionaste ${itemName} como oferta. Pulsa "Intercambiar".`)
  }

  async function coopConfirmExchange(): Promise<void> {
    if (!coopSessionCodeRef.current || !coopMyOffer) return
    const ok = await submitExchangeOffer(coopSessionCodeRef.current, routeIndex, coopMyOffer)
    if (!ok) {
      setCoopTradeMsg('No se pudo enviar tu oferta. Revisa la conexión con Supabase.')
      return
    }
    // Guardamos la oferta para poder devolverla si el intercambio no se completa.
    coopSubmittedOfferRef.current = coopMyOffer
    // Retira la oferta de tu lado: ya está comprometida en el intercambio.
    if (coopMyOffer.kind === 'pokemon') {
      const target = coopSelectedPokemonRef.current
      setTeam(prev => {
        if (target) {
          return prev.filter(p => p !== target)
        }
        // Fallback (no debería pasar): eliminar por id de especie.
        const idx = prev.findIndex(p => p.id === coopMyOffer.id)
        if (idx === -1) return prev
        return prev.filter((_, i) => i !== idx)
      })
      coopSelectedPokemonRef.current = null
    } else {
      const itemName = coopMyOffer.itemName!
      setInventory(prev => {
        const out = [...prev]
        const i = out.indexOf(itemName)
        if (i !== -1) out.splice(i, 1)
        return out
      })
    }
    setCoopMyOffer(null)
    setCoopMyOfferSubmitted(true)
    setCoopTradeMsg('🤝 Oferta enviada. Esperando a que tu compañero pulse "Intercambiar"...')
  }

  // Salir del nodo de intercambio: si el intercambio no se completó, devolver
  // la oferta al jugador y cancelarla en la base de datos para que nadie la pierda.
  async function leaveTradeNode(): Promise<void> {
    const code = coopSessionCodeRef.current
    let completed = coopExchange?.completed ?? false
    if (code && coopMyOfferSubmitted && !completed) {
      const ex = await getCoopExchange(code, routeIndex)
      if (ex) completed = ex.completed
    }
    // Si el intercambio ya se completó, aplicar la oferta del compañero una
    // sola vez (la guarda se re-comprueba tras el await para que el polling y
    // este flujo no la apliquen dos veces).
    if (code && coopMyOfferSubmitted && completed && !coopExchangeAppliedRef.current) {
      const partnerOffer = await completeCoopExchange(code, routeIndex)
      if (partnerOffer && partnerOffer.kind && !coopExchangeAppliedRef.current) {
        coopExchangeAppliedRef.current = true
        applyOfferToLocal(partnerOffer)
      }
    }
    // Si NO se completó, devolver la oferta SOLO si la cancelación en la base
    // de datos tiene éxito (si falla, el intercambio se completó justo ahora y
    // la oferta ya está comprometida: no hay que devolverla para no duplicar).
    if (coopMyOfferSubmitted && !completed && coopSubmittedOfferRef.current) {
      const offer = coopSubmittedOfferRef.current
      const cancelled = code ? await cancelExchangeOffer(code, routeIndex) : false
      if (cancelled) {
        if (offer.kind === 'pokemon') {
          const rebuilt = rebuildPokemonFromOffer(offer)
          if (teamHasRoom(teamRef.current)) {
            setTeam(prev => [...prev, rebuilt])
          } else {
            setPcStorage(prev => [...prev, rebuilt])
          }
          setCoopTradeMsg(`↩️ El intercambio no se completó. ${rebuilt.name} volvió a tu equipo.`)
        } else {
          setInventory(prev => [...prev, offer.itemName ?? 'Potion'])
          setCoopTradeMsg(`↩️ El intercambio no se completó. ${offer.itemName ?? 'el objeto'} volvió a tu inventario.`)
        }
        coopSubmittedOfferRef.current = null
      } else {
        // El intercambio se completó mientras tanto: aplicar la oferta del compañero.
        if (code && !coopExchangeAppliedRef.current) {
          const partnerOffer = await completeCoopExchange(code, routeIndex)
          if (partnerOffer && partnerOffer.kind && !coopExchangeAppliedRef.current) {
            coopExchangeAppliedRef.current = true
            applyOfferToLocal(partnerOffer)
          }
        }
      }
    }
    coopSelectedPokemonRef.current = null
    coopSubmittedOfferRef.current = null
    await completeCurrentNode()
  }

  // Polling del intercambio en el nodo actual
  useEffect(() => {
    if (screen !== 'trade') return
    const code = coopSessionCodeRef.current
    if (!code) return
    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      const ex = await getCoopExchange(code, routeIndex)
      if (cancelled || !ex) return
      setCoopExchange(ex)
      // Ambos jugadores listos → completar el intercambio. complete_exchange es
      // idempotente: cada jugador recibe la oferta del otro una sola vez. La
      // guarda se re-comprueba tras el await para que dos polls solapados (o un
      // poll y leaveTradeNode) no apliquen la oferta dos veces.
      if (ex.a_ready && ex.b_ready && !coopExchangeAppliedRef.current) {
        const partnerOffer = await completeCoopExchange(code, routeIndex)
        if (cancelled) return
        if (partnerOffer && partnerOffer.kind && !coopExchangeAppliedRef.current) {
          coopExchangeAppliedRef.current = true
          applyOfferToLocal(partnerOffer)
        }
      }
    }
    void poll()
    const timer = setInterval(() => void poll(), 2500)
    return () => { cancelled = true; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, routeIndex, coopSessionCode])

  // Chat rápido del cooperativo: envía mensajes y emojis, y los recoge cada 3s.
  async function coopSendChat(text: string): Promise<void> {
    const code = coopSessionCodeRef.current
    const msg = text.trim()
    if (!code || !msg) return
    const ok = await sendCoopChat(code, msg)
    if (ok) {
      setCoopChatText('')
      coopChatLastRef.current = new Date().toISOString()
    }
  }

  useEffect(() => {
    if (!coopMode || !coopSessionCode || !coopChatOpen) return
    const code = coopSessionCode
    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      const msgs = await getCoopChat(code, coopChatLastRef.current)
      if (cancelled) return
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1]
        coopChatLastRef.current = last.created_at
        setCoopChatMsgs(prev => [...prev, ...msgs].slice(-60))
      }
    }
    void poll()
    coopChatPollRef.current = setInterval(() => void poll(), 3000)
    return () => {
      cancelled = true
      if (coopChatPollRef.current) {
        clearInterval(coopChatPollRef.current)
        coopChatPollRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coopMode, coopSessionCode, coopChatOpen])

  // Cancelar la oferta: si ya se envió, la devuelve al jugador y la cancela en
  // la base de datos (si el intercambio aún no se completó). Si solo estaba
  // seleccionada, simplemente limpia la selección.
  async function cancelCoopOffer(): Promise<void> {
    const code = coopSessionCodeRef.current
    if (!code) return
    if (coopMyOfferSubmitted) {
      if (coopExchange?.completed || coopExchangeAppliedRef.current) {
        setCoopTradeMsg('El intercambio ya se completó, no se puede cancelar.')
        return
      }
      // Re-consultamos el estado en la base de datos: el compañero pudo haber
      // completado el intercambio mientras tanto (el estado local puede estar
      // desactualizado hasta 2.5s).
      const ex = await getCoopExchange(code, routeIndex)
      if (ex && (ex.completed || coopExchangeAppliedRef.current)) {
        setCoopTradeMsg('El intercambio ya se completó, no se puede cancelar.')
        return
      }
      // Solo devolvemos la oferta si la cancelación en la BD tiene éxito: si
      // falla, el intercambio se completó justo ahora y la oferta ya está
      // comprometida con el compañero (devolverla duplicaría el Pokémon).
      const cancelled = await cancelExchangeOffer(code, routeIndex)
      if (!cancelled) {
        setCoopTradeMsg('El intercambio ya se completó, no se puede cancelar.')
        return
      }
      const offer = coopSubmittedOfferRef.current
      if (offer) {
        if (offer.kind === 'pokemon') {
          const rebuilt = rebuildPokemonFromOffer(offer)
          if (teamHasRoom(teamRef.current)) {
            setTeam(prev => [...prev, rebuilt])
          } else {
            setPcStorage(prev => [...prev, rebuilt])
          }
        } else {
          setInventory(prev => [...prev, offer.itemName ?? 'Potion'])
        }
      }
      coopSubmittedOfferRef.current = null
      coopSelectedPokemonRef.current = null
      coopExchangeAppliedRef.current = false
      setCoopMyOfferSubmitted(false)
      setCoopMyOffer(null)
      setCoopExchange(null)
      setCoopTradeMsg('↩️ Intercambio cancelado. Puedes elegir otra oferta.')
    } else {
      coopSelectedPokemonRef.current = null
      setCoopMyOffer(null)
      setCoopTradeMsg('Selección cancelada.')
    }
  }

  function pickRocketPokemon(pokemon: Pokemon): void {
    if (runChallenges.soloStarter) {
      setBattleLog((prev) => [t('b.challengeSoloStarter'), ...prev].slice(0, 15))
      setTeamRocketPickModal(false)
      setTeamRocketTeam([])
      completeCurrentNode()
      return
    }
    if (runChallenges.fixedTeam) {
      setBattleLog((prev) => [t('b.challengeFixedTeam'), ...prev].slice(0, 15))
      setTeamRocketPickModal(false)
      setTeamRocketTeam([])
      completeCurrentNode()
      return
    }
    let captured: Pokemon = { ...pokemon, hp: Math.floor(pokemon.maxHp / 2), holdItem: (difficulty === 'hard' || difficulty === 'infinite') ? null : pokemon.holdItem }
    playCapture()
    if (runChallenges.noEvolution) captured = applyNoEvolutionBuff(captured)
    if (runChallenges.fixedLevel) captured = { ...captured, level: 50 }
    registerInPokedex(captured)
    if (captured.shiny) unlockAchievement('shiny_catch')
    if ((captured.attack + captured.defense + captured.speed + captured.maxHp) >= 600) unlockAchievement('legendary_catch')
    if (!teamHasRoom(team)) {
      setPcStorage((prev) => [...prev, captured])
      setBattleLog((prev) => [
        t('b.capturedPC2', { name: pokemon.name }),
        ...prev
      ].slice(0, 15))
    } else {
      setTeam((prev) => [...prev, captured])
      setBattleLog((prev) => [
        t('b.joinedTeam', { name: pokemon.name }),
        ...prev
      ].slice(0, 15))
    }
    setTeamRocketPickModal(false)
    setTeamRocketTeam([])
    setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
    captureSummaryCompleteNodeRef.current = true
    setCaptureSummary(captured)
  }

  function removeFaintedPokemon(indexToRemove: number): void {
    const target = team[indexToRemove]
    if (!target || target.hp > 0) return

    const newTeam = team.filter((_, idx) => idx !== indexToRemove)
    setTeam(newTeam)

    if (activeIndex >= newTeam.length) {
      const healthyIdx = newTeam.findIndex((p) => p.hp > 0)
      setActiveIndex(healthyIdx !== -1 ? healthyIdx : 0)
    } else if (indexToRemove < activeIndex) {
      setActiveIndex((prev) => Math.max(0, prev - 1))
    }

    setBattleLog((prev) => [t('b.released', { name: target.name }), ...prev].slice(0, 15))
  }

  function withdrawFromPC(pcIndex: number): void {
    const pokemon = pcStorage[pcIndex]
    if (!pokemon) return
    if (runChallenges.soloStarter || runChallenges.fixedTeam) {
      setBattleLog((prev) => [t('b.noModifyTeam'), ...prev].slice(0, 15))
      return
    }
    if (teamHasRoom(team)) {
      setTeam((prev) => [...prev, pokemon])
      setPcStorage((prev) => prev.filter((_, i) => i !== pcIndex))
      setBattleLog((prev) => [t('b.withdrawnPC', { name: pokemon.name }), ...prev].slice(0, 15))
    } else {
      const swapOut = team[activeIndex]
      if (swapOut.hp <= 0) {
        setBattleLog((prev) => [t('b.noDepositFainted', { name: swapOut.name }), ...prev].slice(0, 15))
        return
      }
      const newTeam = team.map((p, i) => i === activeIndex ? pokemon : p)
      setTeam(newTeam)
      setPcStorage((prev) => prev.map((p, i) => i === pcIndex ? swapOut : p))
      setBattleLog((prev) => [t('b.swappedPC', { a: swapOut.name, b: pokemon.name }), ...prev].slice(0, 15))
    }
  }

  // --- Mercado Negro: comprar objetos baratos, vender y comprar Pokémon ---
  function blackMarketItemPrice(itemName: string): number {
    const data = ALL_SHOP_ITEMS[itemName] ?? HOLDABLE_ITEMS[itemName]
    if (!data) return 0
    return Math.max(1, Math.floor(data.price * 0.85))
  }

  function blackMarketBuyItem(itemName: string): void {
    if (runChallenges.noPurchasing || !isShopItemUnlocked(itemName)) { playError(); return }
    const price = blackMarketItemPrice(itemName)
    if (money < price) { playError(); return }
    playPurchase()
    setMoney((prev) => prev - price)
    setInventory((prev) => [...prev, itemName])
    setBattleLog((prev) => [t('b.boughtMarket', { item: itemLocalizedName(itemName), price }), ...prev].slice(0, 15))
  }

  function blackMarketSellItem(itemName: string): void {
    playPurchase()
    setInventory((prev) => {
      const idx = prev.indexOf(itemName)
      if (idx === -1) return prev
      const out = [...prev]
      out.splice(idx, 1)
      return out
    })
    const data = ALL_SHOP_ITEMS[itemName] ?? HOLDABLE_ITEMS[itemName]
    const value = data ? Math.max(1, Math.floor(data.price * 0.5)) : 10
    setMoney((prev) => prev + value)
    setBattleLog((prev) => [t('b.soldMarket', { item: itemLocalizedName(itemName), value }), ...prev].slice(0, 15))
  }

  function blackMarketBuyPokemon(idx: number): void {
    if (runChallenges.noPurchasing) { playError(); return }
    if (runChallenges.soloStarter || runChallenges.fixedTeam) {
      setBattleLog((prev) => [t('b.noModifyTeam'), ...prev].slice(0, 15))
      return
    }
    const pokemon = blackMarketPokemon[idx]
    if (!pokemon) return
    const price = 100 + pokemon.level * 15
    if (money < price) { playError(); return }
    playPurchase()
    setMoney((prev) => prev - price)
    const purchased = { ...pokemon, hp: pokemon.maxHp, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } }
    registerInPokedex(purchased)
    if (teamHasRoom(team)) {
      setTeam((prev) => [...prev, purchased])
    } else {
      setPcStorage((prev) => [...prev, purchased])
    }
    setBattleLog((prev) => [t('b.boughtMarketPokemon', { name: pokemon.name, lvl: pokemon.level, price }), ...prev].slice(0, 15))
  }

  function sellSpeculatorPokemon(kind: 'team' | 'pc', index: number, price: number): void {
    if (runChallenges.soloStarter || runChallenges.fixedTeam) {
      playError()
      setBattleLog((prev) => [t('b.noModifyTeam'), ...prev].slice(0, 15))
      return
    }
    if (kind === 'team') {
      const sold = team[index]
      if (!sold) return
      if (team.length <= 1) {
        playError()
        setBattleLog((prev) => [t('b.speculatorLastTeam'), ...prev].slice(0, 15))
        return
      }
      const nextTeam = team.filter((_, i) => i !== index)
      setTeam(nextTeam)
      setActiveIndex((prev) => (prev > index ? prev - 1 : prev === index ? Math.min(index, nextTeam.length - 1) : prev))
      setMoney((prev) => prev + price)
      setRunStats((prev) => ({ ...prev, moneyEarned: prev.moneyEarned + price }))
      setBattleLog((prev) => [t('b.speculatorSold', { name: sold.name, price }), ...prev].slice(0, 15))
    } else {
      const sold = pcStorage[index]
      if (!sold) return
      setPcStorage((prev) => prev.filter((_, i) => i !== index))
      setMoney((prev) => prev + price)
      setRunStats((prev) => ({ ...prev, moneyEarned: prev.moneyEarned + price }))
      setBattleLog((prev) => [t('b.speculatorSold', { name: sold.name, price }), ...prev].slice(0, 15))
    }
    playPurchase()
    setSpeculatorConfirm(null)
  }

  // --- Rancho Pokémon ---
  function ranchRewardPool(pokemon: Pokemon): string[] {
    const berries = BERRY_DROPS.filter(isBerryUnlocked)
    const treasures = TREASURE_DROPS.filter(isConsumableUnlocked)
    const stones = EVOLUTION_STONES.filter(isEvolutionStoneUnlocked)
    const holdables = HOLDABLE_ITEM_NAMES.filter(isHoldableUnlocked)
    const consumables = Object.keys(ALL_SHOP_ITEMS).filter(item =>
      !TREASURES.includes(item) &&
      !POKEBALL_NAMES.includes(item) &&
      !(EVOLUTION_STONES as readonly string[]).includes(item) &&
      isConsumableUnlocked(item)
    )
    const primary = pokemon.types?.[0] ?? 'normal'
    let pool: string[] = []
    if (['grass', 'bug', 'fairy'].includes(primary)) pool = [...berries, ...treasures]
    else if (['rock', 'ground', 'steel'].includes(primary)) pool = [...treasures, ...stones]
    else if (['fire', 'electric', 'ice', 'dragon'].includes(primary)) pool = [...stones, ...holdables]
    else if (['water', 'flying'].includes(primary)) pool = [...consumables, ...berries]
    else pool = [...holdables, ...treasures]
    if (pokemon.level >= 30) pool = [...pool, ...stones, ...holdables]
    if (pool.length === 0) pool = [...treasures, ...berries, ...consumables, ...holdables, ...stones]
    if (pool.length === 0) pool = ['Potion']
    return pool
  }

  function ranchRewardCount(pokemon: Pokemon): number {
    const bst = pokemon.baseStatTotal
      ?? pokemon.maxHp + pokemon.attack + pokemon.defense + pokemon.spAttack + pokemon.spDefense + pokemon.speed
    let count = 1
    if (pokemon.level >= 20) count++
    if (pokemon.level >= 40) count++
    if (bst >= 480) count++
    if (pokemon.shiny) count++
    return Math.min(5, count)
  }

  function ranchRewardItems(pokemon: Pokemon): string[] {
    const pool = ranchRewardPool(pokemon)
    const count = ranchRewardCount(pokemon)
    return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)] ?? 'Potion')
  }

  function sellRanchPokemon(kind: 'team' | 'pc', index: number): void {
    if (runChallenges.soloStarter || runChallenges.fixedTeam) {
      playError()
      setBattleLog(prev => [t('b.noModifyTeam'), ...prev].slice(0, 15))
      return
    }
    const sold = kind === 'team' ? team[index] : pcStorage[index]
    if (!sold) return
    if (kind === 'team' && team.length <= 1) {
      playError()
      setBattleLog(prev => [t('b.speculatorLastTeam'), ...prev].slice(0, 15))
      return
    }
    const rewards = ranchRewardItems(sold)
    if (kind === 'team') {
      const nextTeam = team.filter((_, i) => i !== index)
      setTeam(nextTeam)
      setActiveIndex(prev => (prev > index ? prev - 1 : prev === index ? Math.min(index, nextTeam.length - 1) : prev))
    } else {
      setPcStorage(prev => prev.filter((_, i) => i !== index))
    }
    setInventory(prev => [...prev, ...rewards])
    const grouped = new Map<string, number>()
    for (const item of rewards) grouped.set(item, (grouped.get(item) ?? 0) + 1)
    setRanchResult(Array.from(grouped.entries()).map(([name, count]) => ({ name, count })))
    setRanchConfirm(null)
    playPurchase()
    setBattleLog(prev => [
      `🐑 Intercambiaste a ${sold.name} por ${rewards.length} objeto${rewards.length === 1 ? '' : 's'}.`,
      ...prev,
    ].slice(0, 15))
  }

  // --- Combate Doble (2 vs 2) ---
  function doubleSelectMove(slot: number, moveIdx: number): void {
    const firstAlive = doubleEnemies.findIndex(e => e.hp > 0)
    setDoubleMoves(prev => {
      const next = [...prev]
      const existing = next[slot]
      if (existing) {
        const curTarget = existing.target
        const curAlive = curTarget >= 0 && doubleEnemies[curTarget] && doubleEnemies[curTarget].hp > 0
        next[slot] = { ...existing, moveIdx, target: curAlive ? curTarget : (firstAlive >= 0 ? firstAlive : 0) }
      } else {
        next[slot] = { moveIdx, target: firstAlive >= 0 ? firstAlive : 0 }
      }
      return next
    })
  }

  function doubleSelectTarget(slot: number, target: number): void {
    setDoubleMoves(prev => {
      const next = [...prev]
      next[slot] = next[slot] ? { ...next[slot]!, target } : { moveIdx: 0, target }
      return next
    })
  }

  function performDoubleHit(attacker: Pokemon, defender: Pokemon, move: Move): { attacker: Pokemon; defender: Pokemon; log: string[] } {
    const log: string[] = []
    if (defender.protected && !hasAbility(attacker, 'unseen-fist') && !hasAbility(attacker, 'piercing-drill')) {
      return { attacker: { ...attacker, protected: false }, defender: { ...defender, protected: false }, log: [t('b.protected', { defender: defender.name, attacker: attacker.name })] }
    }
    const abilityMoveType = getAbilityMoveType(attacker, move)
    const effectiveMove = abilityMoveType !== move.type ? { ...move, type: abilityMoveType } : move
    const battleWeatherActive = !isWeatherSuppressed(attacker, defender)
    const battleWeather: WeatherKind = battleWeatherActive ? weather : 'none'
    // --- Precisión (Indefenso, Ojo Compuesto y clima sobre Trueno) ---
    const noGuard = hasAbility(attacker, 'no-guard') || hasAbility(defender, 'no-guard')
    if (move.accuracy != null && move.accuracy < 100 && !noGuard) {
      let acc = move.accuracy
      if (hasAbility(attacker, 'compound-eyes')) acc = Math.min(100, acc * 1.3)
      acc = Math.min(100, acc * getAbilityAccuracyMultiplier(attacker, defender, effectiveMove, battleWeather, battleWeatherActive))
      if (effectiveMove.type === 'electric' && (move.name === 'Trueno' || move.enName === 'Thunder')) {
        if (battleWeather === 'rain') acc = 100
        else if (battleWeather === 'sun') acc = Math.min(acc, 50)
      }
      if (Math.random() * 100 >= acc) {
        return { attacker, defender, log: [t('b.missed', { attacker: attacker.name, move: moveName(effectiveMove) })] }
      }
    }
    const defTypes = defender.types ?? []
    let { effectiveness, message } = getTypeEffectiveness(effectiveMove.type, defTypes[0] || 'normal', defTypes[1])
    effectiveness = adjustEffectivenessForAbilities(attacker, effectiveMove.type, effectiveness)

    // --- Habilidades de inmunidad/absorción del defensor ---
    const defenderAbility = defender.ability
    const abilityImmunity = getAbilityMoveImmunity(defender, effectiveMove, attacker, effectiveness)
    const abilityBlocked = !!abilityImmunity
    let abilityBlockMsg: string | null = null
    if (abilityBlocked) {
      effectiveness = 0
      message = null
      abilityBlockMsg = t('b.abilityBlocked', { ability: abilityName(defenderAbility, getLanguage()) })
    }

    const stab = getAbilityStabTypes(attacker, effectiveMove.type).some(t => t === effectiveMove.type) ? (hasAbility(attacker, 'adaptability') ? 2 : 1.5) : 1

    // --- Stats efectivas con habilidades (Agallas, Potencia Bruta, Poder Solar, Escama Especial) ---
    const attackerStatused = !!attacker.status
    const burnNerfD = attacker.status?.type === 'burn' ? 0.5 : 1
    const gutsMult = hasAbility(attacker, 'guts') && attackerStatused ? 1.5 : 1
    const hugePowerMult = hasAbility(attacker, 'huge-power') || hasAbility(attacker, 'pure-power') ? 2 : 1
    const solarPowerMult = hasAbility(attacker, 'solar-power') && battleWeather === 'sun' ? 1.5 : 1
    const attackerEffective: Pokemon = {
      ...attacker,
      attack: Math.round(attacker.attack * burnNerfD * gutsMult * hugePowerMult),
      spAttack: Math.round(attacker.spAttack * solarPowerMult),
    }
    const marvelScale = hasAbility(defender, 'marvel-scale') && defender.status ? 1.5 : 1
    const defenderEffective: Pokemon = {
      ...defender,
      defense: Math.round(defender.defense * marvelScale),
      spDefense: Math.round(defender.spDefense * marvelScale),
    }

    const defenderHpBefore = defender.hp
    const result = applyDamage(attackerEffective, defenderEffective, effectiveMove)
    let damage = Math.max(1, Math.floor(result.damage * effectiveness * stab))

    // --- Multiplicadores por habilidad y clima ---
    damage = Math.floor(damage * weatherTypeMultiplier(battleWeather, effectiveMove.type))
    const lowHp = attacker.hp / Math.max(1, attacker.maxHp) <= 1 / 3
    const pinchMult = (lowHp
      && ((hasAbility(attacker, 'blaze') && effectiveMove.type === 'fire')
        || (hasAbility(attacker, 'overgrow') && effectiveMove.type === 'grass')
        || (hasAbility(attacker, 'torrent') && effectiveMove.type === 'water')
        || (hasAbility(attacker, 'swarm') && effectiveMove.type === 'bug')))
      ? 1.5 : 1
    const technicianMult = hasAbility(attacker, 'technician') && (effectiveMove.power ?? 0) <= 60 ? 1.5 : 1
    const tintedLensMult = hasAbility(attacker, 'tinted-lens') && effectiveness < 1 ? 2 : 1
    const toughClawsMult = hasAbility(attacker, 'tough-claws') && effectiveMove.damageClass !== 'special' ? 1.3 : 1
    const thickFatMult = hasAbility(defender, 'thick-fat', attacker) && (effectiveMove.type === 'fire' || effectiveMove.type === 'ice') ? 0.5 : 1
    const extraAbilityMult = getAbilityDamageMultiplier(attacker, defender, effectiveMove, {
      effectiveness,
      weather: battleWeather,
      weatherActive: battleWeatherActive,
      isCrit: false,
      isContact: isContactMove(effectiveMove),
      defenderAtFullHp: defender.hp >= defender.maxHp,
      movedLast: false,
    })
    damage = Math.floor(damage * pinchMult * technicianMult * tintedLensMult * toughClawsMult * thickFatMult * extraAbilityMult)
    if (hasAbility(defender, 'dry-skin', attacker) && effectiveMove.type === 'fire') damage = Math.floor(damage * 1.25)
    if (hasAbility(defender, 'multiscale', attacker) && defender.hp >= defender.maxHp) damage = Math.floor(damage * 0.5)
    const critInfo = getAbilityCritInfo(attacker, defender, effectiveMove)
    const critChance = ((effectiveMove.critRatio ?? 0) >= 3 ? 0.5 : (effectiveMove.critRatio ?? 0) === 2 ? 0.25 : (effectiveMove.critRatio ?? 0) === 1 ? 0.125 : 0) + critInfo.chanceBonus
    const isCrit = !runChallenges.noCrits && !critInfo.immune && (critInfo.always || (critChance > 0 && Math.random() < critChance))
    if (isCrit) damage = Math.floor(damage * (hasAbility(attacker, 'sniper') ? 2 : 1.5))

    if (effectiveness === 0) {
      damage = 0
      log.push(t('battle.noEffect'))
    }
    const newHp = Math.max(0, defender.hp - damage)
    let finalDefender: Pokemon = { ...defender, hp: newHp }
    const hitLine = t('b.usesHit', { attacker: attacker.name, move: moveName(effectiveMove), dmg: damage })
      + (isCrit ? t('b.critSuffix') : '')
      + (message ? ` (${message})` : '')
      + (abilityBlockMsg ? ` (${abilityBlockMsg})` : '')
    log.push(hitLine)

    // --- Absorción/efecto de inmunidad ---
    if (abilityBlocked && abilityImmunity && finalDefender.hp > 0) {
      const absorbed = absorbAbilityMove(finalDefender, abilityImmunity)
      finalDefender = absorbed.defender
      log.push(...absorbed.logs)
    }

    // --- Robustez (Sturdy): aguanta con 1 HP a plena vida ---
    if (finalDefender.hp <= 0 && hasAbility(defender, 'sturdy', attacker) && defender.hp >= defender.maxHp) {
      finalDefender = { ...finalDefender, hp: 1 }
      log.push(t('b.abilitySturdy', { name: finalDefender.name, ability: abilityName(defenderAbility, getLanguage()) }))
    }

    // --- Efectos de contacto del defensor (Piel Áspera, Estática...) ---
    let finalAttacker = attacker
    const isContact = isContactMove(effectiveMove) && !hasAbility(attacker, 'long-reach')
    if (damage > 0 && isContact && finalDefender.hp > 0 && finalAttacker.hp > 0) {
      if (hasAbility(defender, 'rough-skin', attacker)) {
        const skinDmg = Math.max(1, Math.floor(finalAttacker.maxHp / 8))
        finalAttacker = { ...finalAttacker, hp: Math.max(1, finalAttacker.hp - skinDmg) }
        log.push(t('b.abilityRoughSkin', { name: finalAttacker.name, dmg: skinDmg, ability: abilityName(defenderAbility, getLanguage()) }))
      }
      const contactStatus: Array<{ ability: string; status: StatusType }> = [
        { ability: 'static', status: 'paralysis' },
        { ability: 'flame-body', status: 'burn' },
        { ability: 'poison-point', status: 'poison' },
      ]
      for (const cs of contactStatus) {
        if (!hasAbility(defender, cs.ability, attacker)) continue
        if (finalAttacker.status) break
        if (Math.random() < 0.30) {
          finalAttacker = { ...finalAttacker, status: { type: cs.status, turns: 999 } }
          log.push(t('b.abilityContactStatus', { name: finalAttacker.name, status: statusLabel(cs.status), ability: abilityName(defenderAbility, getLanguage()) }))
          break
        }
      }
    }

    // --- Efectos adicionales al recibir el golpe ---
    const onHit = applyAbilityOnHit(finalAttacker, finalDefender, effectiveMove, damage, {
      defenderHpBefore,
      isContact,
      isCrit,
      weather: battleWeather,
    })
    finalAttacker = onHit.attacker
    finalDefender = onHit.defender
    log.push(...onHit.logs)

    // Aplicar estado (parálisis, quemadura, veneno, confusión...) como en el
    // combate normal: solo si el objetivo sobrevive al golpe.
    if (finalDefender.hp > 0) {
      const ailmented = applyAilmentToTarget(finalDefender, effectiveMove)
      if (ailmented.status && ailmented.status.type !== finalDefender.status?.type) {
        finalDefender = ailmented
        log.push(statusAppliedLine(finalDefender.name, ailmented.status.type))
      }
    }
    if (defender.ability === 'synchronize' && finalDefender.status && !finalAttacker.status && finalDefender.status.type !== 'flinch') {
      if (!getAbilityStatusImmune(finalAttacker, finalDefender.status.type, battleWeather, battleWeatherActive)) {
        finalAttacker = { ...finalAttacker, status: { ...finalDefender.status } }
        log.push(t('b.abilityContactStatus', { name: finalAttacker.name, status: statusLabel(finalDefender.status.type), ability: abilityName('synchronize', getLanguage()) }))
      }
    }
    return { attacker: finalAttacker, defender: finalDefender, log }
  }

  function doubleEnemyCounterattack(
    teamCopy: Pokemon[],
    actives: (number | undefined)[],
    enemies: Pokemon[],
    log: string[],
    hits: Array<{ kind: 'enemy' | 'player'; index: number; key: number }>
  ): void {
    for (let e = 0; e < 2; e++) {
      const enemy = enemies[e]
      if (!enemy || enemy.hp <= 0) continue
      const aliveTargets = actives.filter((ti): ti is number => {
        if (ti === undefined) return false
        const p = teamCopy[ti]
        return !!p && p.hp > 0
      })
      if (aliveTargets.length === 0) break
      const targetIdx = aliveTargets[Math.floor(Math.random() * aliveTargets.length)]
      const move = enemy.moves[Math.floor(Math.random() * enemy.moves.length)]
      const before = teamCopy[targetIdx].hp
      const hit = performDoubleHit(enemy, teamCopy[targetIdx], move)
      enemies[e] = hit.attacker
      teamCopy[targetIdx] = hit.defender
      log.push(...hit.log)
      if (hit.defender.hp < before) {
        doubleHitKeyRef.current += 1
        hits.push({ kind: 'player', index: actives.indexOf(targetIdx), key: doubleHitKeyRef.current })
        playHit()
      }
      if (hit.defender.hp <= 0) log.push(t('b.fainted', { name: hit.defender.name }))
    }
  }

  function doubleAutoSwitchAfterFaint(teamCopy: Pokemon[], actives: (number | undefined)[], log: string[]): (number | undefined)[] {
    const nextActives = [...actives]
    for (let i = 0; i < 2; i++) {
      const ti = nextActives[i]
      if (ti !== undefined && teamCopy[ti] && teamCopy[ti].hp > 0) continue
      const alive = teamCopy
        .map((p, idx) => ({ p, idx }))
        .filter(x => x.p.hp > 0 && !nextActives.includes(x.idx))
      if (alive.length > 0) {
        nextActives[i] = alive[0].idx
        log.push(`🔁 Sale ${teamCopy[nextActives[i] as number].name}!`)
      } else {
        // Sin reemplazo: este slot queda vacío (el combate sigue 1vs2 o 1vs1).
        nextActives[i] = undefined
      }
    }
    return nextActives
  }

  function doubleCheckEnd(teamCopy: Pokemon[], enemies: Pokemon[], log: string[]): void {
    const allEnemiesFainted = enemies.every(p => p.hp <= 0)
    const allPlayerFainted = teamCopy.every(p => p.hp <= 0)

    if (allEnemiesFainted) {
      // Dúo Perfecto: ganar el doble sin perder ningún Pokémon.
      if (teamCopy.every(p => p.hp > 0)) unlockAchievement('double_win')
      const baseMoney = Math.floor(40 + enemies.reduce((s, p) => s + p.level, 0) * 4)
      const moneyReward = runChallenges.noMoney ? 0 : Math.floor(baseMoney * (modifier?.moneyMultiplier ?? 1))
      if (!runChallenges.noMoney) setMoney(prev => prev + moneyReward)
      setBattleLog(prev => [t('b.doubleWon', { money: moneyReward }), ...prev].slice(0, 15))
      setDoubleFinished(true)
      return
    }
    if (allPlayerFainted) {
      setDoubleFinished(true)
      const losses = record.losses + 1
      persistRecord(record.wins, losses)
      recordFinishedRun('loss', teamCopy)
      handleInfiniteRunDefeat(teamCopy)
      if (isDailyRunRef.current) {
        setDailyPlayed(true)
        localStorage.setItem('pokerand_daily', dailySeed)
      }
      setDefeatSummary({
        finalTeam: teamCopy,
        battleLog: [...log],
        enemy: enemies.find(p => p.hp > 0) ?? null,
        lastNodeLabel: currentNode?.label
      })
      setScreen('defeat')
      playDefeatMusic()
    }
  }

  function resolveDoubleTurn(): void {
    if (doubleFinished) return
    const enemies = [...doubleEnemies]
    const teamCopy = team.map(p => ({ ...p }))
    const actives = [...doubleActives]
    const log = [...doubleLog]
    const hits: Array<{ kind: 'enemy' | 'player'; index: number; key: number }> = []

    // Los Pokémon del jugador atacan primero (cada uno a su objetivo).
    for (let i = 0; i < 2; i++) {
      const sel = doubleMoves[i]
      const teamIdx = actives[i]
      if (teamIdx === undefined || !sel) continue
      const attacker = teamCopy[teamIdx]
      if (!attacker || attacker.hp <= 0) continue
      const move = attacker.moves[sel.moveIdx]
      let targetIndex = sel.target
      if (targetIndex < 0 || !enemies[targetIndex] || enemies[targetIndex].hp <= 0) {
        targetIndex = enemies.findIndex(e => e.hp > 0)
      }
      const target = targetIndex >= 0 ? enemies[targetIndex] : undefined
      if (!move || !target) continue
      const before = target.hp
      const hit = performDoubleHit(attacker, target, move)
      teamCopy[teamIdx] = hit.attacker
      enemies[targetIndex] = hit.defender
      log.push(...hit.log)
      if (hit.defender.hp < before) {
        doubleHitKeyRef.current += 1
        hits.push({ kind: 'enemy', index: targetIndex, key: doubleHitKeyRef.current })
        playHit()
      }
      if (hit.defender.hp <= 0) log.push(t('b.fainted', { name: hit.defender.name }))
    }

    // Los enemigos vivos contraatacan (objetivo aleatorio entre los activos vivos).
    doubleEnemyCounterattack(teamCopy, actives, enemies, log, hits)

    // --- Habilidades y clima por turno (los 4 activos) ---
    const endLog: string[] = []
    const doubleWeatherSuppressed = [...teamCopy, ...enemies].some(m => m && m.hp > 0 && (m.ability === 'air-lock' || m.ability === 'cloud-nine'))
    const firstEnemy = enemies.find(e => e && e.hp > 0)
    const firstPlayer = teamCopy.find(p => p && p.hp > 0)
    actives.forEach((ti) => {
      if (ti === undefined || !teamCopy[ti] || teamCopy[ti].hp <= 0) return
      teamCopy[ti] = applyTurnAbilities(teamCopy[ti], endLog, firstEnemy, doubleWeatherSuppressed)
    })
    enemies.forEach((e, ei) => {
      if (!e || e.hp <= 0) return
      enemies[ei] = applyTurnAbilities(e, endLog, firstPlayer, doubleWeatherSuppressed)
    })

    // Contador de turnos de Gigamax en dobles (jugador y rival).
    const tickGmax = (unit: Pokemon): Pokemon => {
      if (!unit.gmaxEvolved || !unit.gmaxTurnsLeft || unit.hp <= 0) return unit
      const turns = unit.gmaxTurnsLeft - 1
      if (turns > 0) return { ...unit, gmaxTurnsLeft: turns }
      const restored = unit.megaOrig
        ? { ...unit, gmaxEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, ...unit.megaOrig }
        : { ...unit, gmaxEvolved: false, gmaxTurnsLeft: undefined }
      endLog.push(t('b.gmaxBackNormal', { name: restored.name }))
      return restored
    }
    actives.forEach((ti) => {
      if (ti === undefined || !teamCopy[ti]) return
      teamCopy[ti] = tickGmax(teamCopy[ti])
    })
    enemies.forEach((e, ei) => {
      if (!e) return
      enemies[ei] = tickGmax(e)
    })
    // Mal Sueño (Bad Dreams) en dobles: daña a los rivales dormidos.
    if (firstPlayer?.ability === 'bad-dreams') {
      enemies.forEach((e, ei) => {
        if (e && e.hp > 0 && e.status?.type === 'sleep' && !isIndirectDamageImmune(e)) enemies[ei] = { ...e, hp: Math.max(1, e.hp - Math.max(1, Math.floor(e.maxHp / 8))) }
      })
    }
    if (firstEnemy?.ability === 'bad-dreams') {
      actives.forEach((ti) => {
        const p = ti !== undefined ? teamCopy[ti] : undefined
        if (ti !== undefined && p && p.hp > 0 && p.status?.type === 'sleep' && !isIndirectDamageImmune(p)) teamCopy[ti] = { ...p, hp: Math.max(1, p.hp - Math.max(1, Math.floor(p.maxHp / 8))) }
      })
    }
    log.push(...endLog)

    // Auto-cambio: si un activo se debilitó, entra el siguiente vivo del equipo.
    const nextActives = doubleAutoSwitchAfterFaint(teamCopy, actives, log)

    setTeam(teamCopy)
    setDoubleActives(nextActives)
    setDoubleEnemies(enemies)
    setDoubleMoves([null, null])
    setDoubleLog(log.slice(-40))
    setDoubleHits(hits)
    setDoubleChoosingSwitch(false)

    doubleCheckEnd(teamCopy, enemies, log)
  }

  function doubleSwitchPokemon(slot: number, teamIdx: number): void {
    if (doubleFinished) return
    if (!team[teamIdx] || team[teamIdx].hp <= 0) return
    if (doubleActives[slot] === teamIdx) return
    const enemies = [...doubleEnemies]
    const teamCopy = team.map(p => ({ ...p }))
    const actives = [...doubleActives]
    const log = [...doubleLog]
    const hits: Array<{ kind: 'enemy' | 'player'; index: number; key: number }> = []

    // El cambio gasta el turno: el Pokémon que entra no ataca y los enemigos atacan.
    const outgoingIdx = actives[slot]
    actives[slot] = teamIdx
    log.push(t('b.enteredBattle', { name: teamCopy[teamIdx].name }))

    // Efectos de salida del que se va (Cura Natural, Regeneración).
    if (outgoingIdx !== undefined && teamCopy[outgoingIdx]) {
      let out = teamCopy[outgoingIdx]
      // Al salir del campo se revierte Mega/G-MAX/Primal/Origen.
      if (out.megaOrig) {
        out = {
          ...out,
          megaEvolved: false,
          gmaxEvolved: false,
          primalEvolved: false,
          originEvolved: false,
          gmaxTurnsLeft: undefined,
          megaOrig: undefined,
          ...out.megaOrig,
        }
      }
      if (hasAbility(out, 'natural-cure')) out = { ...out, status: undefined }
      if (hasAbility(out, 'regenerator')) out = { ...out, hp: Math.min(out.maxHp, out.hp + Math.floor(out.maxHp / 3)) }
      teamCopy[outgoingIdx] = out
    }
    // Habilidades de entrada del que entra (Intimidación frente a los enemigos y clima).
    const entryLogs: string[] = []
    let incomingPokemon = teamCopy[teamIdx]
    enemies.forEach((e, ei) => {
      if (!e || e.hp <= 0) return
      const entry = applyEntryAbilities(incomingPokemon, e)
      enemies[ei] = entry.opponentUpdated
      entryLogs.push(...entry.logs)
    })
    const incomingSelf = applyAbilityEntrySelf(incomingPokemon, enemies.find(e => e && e.hp > 0) ?? incomingPokemon)
    incomingPokemon = incomingSelf.entering
    teamCopy[teamIdx] = incomingPokemon
    entryLogs.push(...incomingSelf.logs)
    log.push(...entryLogs)

    doubleEnemyCounterattack(teamCopy, actives, enemies, log, hits)

    // --- Habilidades y clima por turno ---
    const endLog: string[] = []
    const doubleWeatherSuppressed = [...teamCopy, ...enemies].some(m => m && m.hp > 0 && (m.ability === 'air-lock' || m.ability === 'cloud-nine'))
    const firstEnemy = enemies.find(e => e && e.hp > 0)
    const firstPlayer = teamCopy.find(p => p && p.hp > 0)
    actives.forEach((ti) => {
      if (ti === undefined || !teamCopy[ti] || teamCopy[ti].hp <= 0) return
      teamCopy[ti] = applyTurnAbilities(teamCopy[ti], endLog, firstEnemy, doubleWeatherSuppressed)
    })
    enemies.forEach((e, ei) => {
      if (!e || e.hp <= 0) return
      enemies[ei] = applyTurnAbilities(e, endLog, firstPlayer, doubleWeatherSuppressed)
    })
    log.push(...endLog)

    const nextActives = doubleAutoSwitchAfterFaint(teamCopy, actives, log)

    setTeam(teamCopy)
    setDoubleActives(nextActives)
    setDoubleEnemies(enemies)
    setDoubleMoves([null, null])
    setDoubleLog(log.slice(-40))
    setDoubleHits(hits)
    setDoubleChoosingSwitch(false)

    doubleCheckEnd(teamCopy, enemies, log)
  }

  function doubleLeave(): void {
    setBattleLog(prev => [t('b.doubleComplete'), ...prev].slice(0, 15))
    completeCurrentNode()
  }

  function depositToPC(teamIndex: number): void {
    const pokemon = team[teamIndex]
    if (!pokemon) return
    // Los Pokémon debilitados no pueden ir al PC: se quedan en el equipo
    // hasta que se liberen.
    if (pokemon.hp <= 0) {
      setBattleLog((prev) => [t('b.noDepositFainted', { name: pokemon.name }), ...prev].slice(0, 15))
      return
    }
    if (runChallenges.soloStarter || runChallenges.fixedTeam) {
      setBattleLog((prev) => [t('b.noModifyTeam'), ...prev].slice(0, 15))
      return
    }
    if (team.length <= 1) {
      setBattleLog((prev) => [t('b.noDepositOnly'), ...prev].slice(0, 15))
      return
    }
    setPcStorage((prev) => [...prev, pokemon])
    const newTeam = team.filter((_, i) => i !== teamIndex)
    setTeam(newTeam)
    if (activeIndex >= newTeam.length) {
      const healthyIdx = newTeam.findIndex((p) => p.hp > 0)
      setActiveIndex(healthyIdx !== -1 ? healthyIdx : 0)
    } else if (teamIndex < activeIndex) {
      setActiveIndex((prev) => Math.max(0, prev - 1))
    }
    setBattleLog((prev) => [t('b.depositedPC', { name: pokemon.name }), ...prev].slice(0, 15))
  }

  // --- Arrastrar y soltar: reordenar equipo y PC, o mover entre ambos ---
  function canDragTeam(): boolean {
    return !runChallenges.soloStarter && !runChallenges.fixedTeam
  }

  // --- Arrastre táctil (fallback al HTML5 DnD, que no funciona con el dedo) ---
  function pointerDragStart(e: ReactPointerEvent, src: { type: 'team' | 'pc'; index: number }): void {
    if (e.pointerType === 'mouse' || !canDragTeam()) return
    touchDragRef.current = { ...src, startX: e.clientX, startY: e.clientY, active: false }
  }

  function pointerDragMove(e: ReactPointerEvent): void {
    const t = touchDragRef.current
    if (!t || e.pointerType === 'mouse') return
    if (!t.active) {
      // Solo se convierte en arrastre si el dedo se mueve lo suficiente:
      // un toque sin arrastre sigue siendo un tap (cambiar Pokémon / retirar).
      if (Math.hypot(e.clientX - t.startX, e.clientY - t.startY) > 12) {
        t.active = true
        dragSourceRef.current = { type: t.type, index: t.index }
        setDragItem({ type: t.type, index: t.index })
        suppressClickRef.current = true
        document.body.style.touchAction = 'none'
      }
    }
    if (t.active) e.preventDefault()
  }

  function pointerDragEnd(e: ReactPointerEvent): void {
    const t = touchDragRef.current
    if (!t) return
    touchDragRef.current = null
    document.body.style.touchAction = ''
    if (!t.active) return
    // Se busca la casilla de destino bajo el dedo (data-drop-type/index).
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const target = el?.closest?.('[data-drop-type]') as HTMLElement | null
    if (target) {
      const dtype = target.dataset.dropType
      const didx = Number(target.dataset.dropIndex ?? -1)
      if (dtype === 'team' && didx >= 0) {
        if (t.type === 'team') reorderTeam(t.index, didx)
        else movePCToTeam(t.index, didx)
      } else if (dtype === 'pc') {
        if (t.type === 'pc') {
          if (didx >= 0) reorderPC(t.index, didx)
        } else {
          depositToPC(t.index)
        }
      }
    }
    dragSourceRef.current = null
    setDragItem(null)
    suppressClickRef.current = true
    setTimeout(() => { suppressClickRef.current = false }, 400)
  }

  function pointerDragCancel(): void {
    const t = touchDragRef.current
    touchDragRef.current = null
    document.body.style.touchAction = ''
    if (!t?.active) return
    dragSourceRef.current = null
    setDragItem(null)
  }

  function reorderTeam(fromIdx: number, toIdx: number): void {
    if (fromIdx === toIdx) return
    setTeam(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
    setActiveIndex(prev => {
      let next: number
      if (prev === fromIdx) next = toIdx
      else if (fromIdx < toIdx && prev > fromIdx && prev <= toIdx) next = prev - 1
      else if (fromIdx > toIdx && prev >= toIdx && prev < fromIdx) next = prev + 1
      else next = prev
      return Math.max(0, Math.min(team.length - 1, next))
    })
  }

  function reorderPC(fromIdx: number, toIdx: number): void {
    if (fromIdx === toIdx) return
    setPcStorage(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }

  // Saca un Pokémon del PC al equipo: si hay hueco lo inserta en `toSlot`, y si
  // el equipo está lleno intercambia con el Pokémon de esa casilla.
  function movePCToTeam(pcIndex: number, toSlot?: number): void {
    const pokemon = pcStorage[pcIndex]
    if (!pokemon) return
    if (!canDragTeam()) {
      setBattleLog((prev) => [t('b.noModifyTeam'), ...prev].slice(0, 15))
      return
    }
    if (teamHasRoom(team)) {
      const newTeam = [...team]
      const insertAt = toSlot !== undefined ? Math.min(toSlot, newTeam.length) : newTeam.length
      newTeam.splice(insertAt, 0, pokemon)
      setTeam(newTeam)
      setPcStorage(prev => prev.filter((_, i) => i !== pcIndex))
      if (insertAt <= activeIndex) setActiveIndex(prev => prev + 1)
      setBattleLog((prev) => [t('b.withdrawnPC', { name: pokemon.name }), ...prev].slice(0, 15))
    } else {
      const target = toSlot !== undefined ? Math.min(toSlot, team.length - 1) : activeIndex
      const swapOut = team[target]
      if (swapOut.hp <= 0) {
        setBattleLog((prev) => [t('b.noDepositFainted', { name: swapOut.name }), ...prev].slice(0, 15))
        return
      }
      const newTeam = team.map((p, i) => i === target ? pokemon : p)
      setTeam(newTeam)
      setPcStorage(prev => prev.map((p, i) => i === pcIndex ? swapOut : p))
      setBattleLog((prev) => [t('b.swappedPC', { a: swapOut.name, b: pokemon.name }), ...prev].slice(0, 15))
    }
  }

  function generateShopStock(excludeStone?: string): string[] {
    const allConsumableKeys = Object.keys(ALL_SHOP_ITEMS).filter(i => isConsumableUnlocked(i) && !POKEBALL_NAMES.includes(i) && !EVOLUTION_STONE_UNLOCK_IDS[i] && !TREASURES.includes(i))
    const allHoldableKeys = HOLDABLE_ITEM_NAMES.filter(isHoldableUnlocked).filter(n => n !== 'Mega Stone' && n !== 'Dynamax Band' && n !== 'Prisma Rojo' && n !== 'Prisma Azul' && !EVOLUTION_ITEM_UNLOCK_IDS[n])
    const shuffledConsumables = [...allConsumableKeys].sort(() => 0.5 - Math.random())
    const shuffledHoldables = [...allHoldableKeys].sort(() => 0.5 - Math.random())
    // Mejoras de Espacio de Tienda: +1 objeto por cada versión desbloqueada.
    const extraSlots = (isActive('unlock_shop_slot') ? 1 : 0) +
      (isActive('unlock_shop_slot_2') ? 1 : 0)
    const selectedConsumables = shuffledConsumables.slice(0, 2 + extraSlots)
    const selectedHoldables = shuffledHoldables.slice(0, 1)
    const unlockedNonBasicBalls = POKEBALL_NAMES.filter(b => b !== 'Poké Ball' && isPokeballUnlocked(b))
    const rareBalls = unlockedNonBasicBalls.length > 0
      ? unlockedNonBasicBalls.filter(b => b !== 'Master Ball' || Math.random() < 0.15)
      : []
    const ballPool = ['Poké Ball', ...rareBalls]
    const shuffledBalls = [...ballPool].sort(() => 0.5 - Math.random())
    const selectedBalls = shuffledBalls.slice(0, 2)
    let unlockedStones = EVOLUTION_STONES.filter(s => isEvolutionStoneUnlocked(s))
    if (excludeStone) {
      // Al rerollear evitamos repetir la misma piedra (si hay otra disponible).
      const others = unlockedStones.filter(s => s !== excludeStone)
      unlockedStones = others.length > 0 ? others : unlockedStones
    }
    const selectedStone = unlockedStones.length > 0 ? [unlockedStones[Math.floor(Math.random() * unlockedStones.length)]] : []
    const smokeBallChance = isConsumableUnlocked('Cuerda Huida') && Math.random() < 0.25 ? ['Cuerda Huida'] : []
    return [...selectedConsumables, ...selectedHoldables, ...selectedBalls, ...selectedStone, ...smokeBallChance]
  }

  const maxShopRerolls = () => {
    let n = 0
    if (isActive('unlock_reroll')) n += 1
    if (isActive('unlock_reroll_2')) n += 1
    return n
  }

  // Compras permitidas por objeto en cada tienda: 1 por defecto + 1 por cada
  // mejora de Stock de Tienda (I a IV).
  const shopBuyAllowance = 1 +
    (isActive('unlock_shop_stock_1') ? 1 : 0) +
    (isActive('unlock_shop_stock_2') ? 1 : 0) +
    (isActive('unlock_shop_stock_3') ? 1 : 0) +
    (isActive('unlock_shop_stock_4') ? 1 : 0)

  function rerollShop(): void {
    if (shopRerollsUsed >= maxShopRerolls()) return
    const currentStone = shopStock.find(n => EVOLUTION_STONE_UNLOCK_IDS[n])
    setShopStock(generateShopStock(currentStone))
    setShopBoughtCount({})
    setShopRerollsUsed(prev => prev + 1)
    playClick()
    setBattleLog((prev) => [t('b.rerolled', { used: shopRerollsUsed + 1, max: maxShopRerolls() }), ...prev].slice(0, 15))
  }

  async function enterNode(overrideNode?: RouteNode): Promise<void> {
    // En el Modo Ruta el jugador elige un nodo del mapa: se le pasa explícitamente
    // para no depender del `currentNode` del render actual (routeIndex aún no se
    // ha actualizado). En el resto de modos se usa el nodo actual de la ruta.
    const currentNode = overrideNode ?? route[routeIndex] ?? null
    if (!activePokemon || !currentNode) return

    // Red de seguridad: las etapas de stats y los estados ligados al combate
    // SIEMPRE se eliminan al entrar a un nodo nuevo, cubriendo cualquier ruta
    // de fin de combate que no pasara por completeCurrentNode.
    setTeam(prev => prev.map(p => ({
      ...p,
      statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
      furiaActive: false,
      leechSeed: false,
      disabled: undefined,
      lastMove: undefined,
      justEntered: false,
      choiceLockedMove: undefined,
    })))

    // El flag de batalla TeamR debe reflejar SIEMPRE el nodo actual, para que un
    // TeamR escapado (Cuerda Huida) o un combate normal no hereden el robo/elección.
    setIsTeamRocketBattle(currentNode.type === 'teamRocket')
    setIsRivalBattle(currentNode.type === 'rival')

    if (currentNode.type === 'legendary') {
      // Solo existe en el Modo Original (no se genera aleatoriamente en ningún
      // otro modo): combate salvaje contra un legendario de la región, que se
      // puede debilitar y capturar como cualquier Pokémon salvaje.
      if (difficulty !== 'original') {
        setBattleLog(prev => [t('b.legendaryOnlyOriginal'), ...prev].slice(0, 15))
        completeCurrentNode()
        return
      }
      setIsLoading(true)
      setApiError('')
      try {
        const gen = currentRunGen
        const ids = REGION_LEGENDARIES[gen] ?? REGION_LEGENDARIES[1]
        const id = ids[Math.floor(Math.random() * ids.length)]
        const maxLvl = Math.max(...team.map(p => p.level)) + 2
        const legendaryData = await buildPokemonFromApi(id, 1, maxLvl, false, 'original', true)
        const legendary: Pokemon = {
          ...legendaryData,
          level: maxLvl,
          hp: legendaryData.maxHp,
          maxHp: legendaryData.maxHp,
        }
        seenInPokedex(legendary)
        setIsTrainerBattle(false)
        setTrainerTeam([])
        setTrainerPokemonIndex(0)
        setTrainerName('')
        setTrainerSprite('')
        setTrainerBadge('')
        setReviveModal(null)
        setEquipModal(null)
        setEnemy({ ...legendary, justEntered: true })
        setBattleLog((prev) => [
          t('b.wildAppeared', { name: legendary.name, lvl: legendary.level }),
          ...prev
        ])
        setScreen('battle')
      } catch {
        setApiError(t('b.legendError'))
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (currentNode.type === 'speculator') {
      // Especulador: vende Pokémon del equipo o PC por dinero de la partida.
      setSpeculatorConfirm(null)
      setIsLoading(false)
      setApiError('')
      setScreen('speculator')
      return
    }

    if (currentNode.type === 'safari') {
      // Safari: 3 siluetas y captura solo con Poké Balls.
      setIsLoading(false)
      setApiError('')
      setScreen('safari')
      void prepareSafari(currentNode)
      return
    }

    if (currentNode.type === 'orchard') {
      // Huerto de Bayas: plantar ahora para cosechar en otro Huerto.
      setIsLoading(false)
      setApiError('')
      setOrchardPlantModal(false)
      setOrchardSelected([])
      setOrchardHarvest(null)
      setScreen('orchard')
      return
    }

    if (currentNode.type === 'fossil') {
      // Laboratorio de Fósiles: dos fósiles aleatorios para revivir.
      setIsLoading(false)
      setApiError('')
      setFossilBusy(false)
      setFossilChoices([...FOSSIL_REVIVALS].sort(() => 0.5 - Math.random()).slice(0, 2))
      setScreen('fossil')
      return
    }

    if (currentNode.type === 'fishing') {
      // Pesca: minijuego de caña para atrapar un Pokémon de tipo Agua.
      setIsLoading(false)
      setApiError('')
      setFishingBusy(false)
      setFishingAttempts(0)
      void prepareFishing()
      setScreen('fishing')
      return
    }

    if (currentNode.type === 'mine') {
      // Mina: excavar para encontrar tesoros desbloqueados en la Tienda Meta.
      setIsLoading(false)
      setApiError('')
      setMiningDigs(0)
      setMiningBusy(false)
      setMiningMessage('')
      setMiningReveal(null)
      setScreen('mine')
      return
    }

    if (currentNode.type === 'daycare') {
      // Guardería: recibe un huevo si no tienes uno activo y hay hueco.
      setIsLoading(false)
      setApiError('')
      setEggHatch(null)
      setScreen('daycare')
      if (!daycareEgg && team.length < maxTeamSize) void prepareDaycareEgg()
      return
    }

    if (currentNode.type === 'weather') {
      // Estación Meteorológica: elegir clima para los próximos 2 combates.
      setIsLoading(false)
      setApiError('')
      setScreen('weather')
      return
    }

    if (currentNode.type === 'ranch') {
      // Rancho Pokémon: intercambiar Pokémon por objetos.
      setIsLoading(false)
      setApiError('')
      setRanchConfirm(null)
      setRanchResult(null)
      setScreen('ranch')
      return
    }

    if (currentNode.type === 'blackmarket') {
      // Mercado Negro: vende objetos/Pokémon y compra objetos baratos y Pokémon.
      const blackItems = [...Object.keys(ALL_SHOP_ITEMS)].filter(i => isShopItemUnlocked(i) && !TREASURES.includes(i))
      const shuffledItems = [...blackItems].sort(() => 0.5 - Math.random())
      setBlackMarketItems(shuffledItems.slice(0, 6))
      setBlackMarketPokemon([])
      setIsLoading(true)
      setApiError('')
      try {
        const targetGen = getEffectiveGen()
        const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))
        const targetLevel = difficulty === 'infinite' ? getInfiniteTargetLevel() : avgPlayerLevel
        const fetches = Array.from({ length: 4 }, () =>
          getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, balDiff(difficulty), -1, getStageProgression(), targetLevel)
            .then((base) => {
              const levelDiff = targetLevel - base.level
              let scaled = scalePokemonForNode(base, currentNode, routeIndex, levelDiff, balDiff(difficulty))
              if (runChallenges.fixedLevel) scaled = { ...scaled, level: 50 }
              return scaled
            })
        )
        const list = await Promise.all(fetches)
        setBlackMarketPokemon(list)
      } catch {
        setApiError('No se pudo generar el catálogo del mercado negro.')
      } finally {
        setIsLoading(false)
      }
      setScreen('blackmarket')
      return
    }

    if (currentNode.type === 'double') {
      setIsLoading(true)
      setApiError('')
      try {
        const targetGen = getEffectiveGen()
        const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))
        const targetLevel = difficulty === 'infinite' ? getInfiniteTargetLevel() : avgPlayerLevel + 1
        const fetches = Array.from({ length: 2 }, (_, idx) =>
          getBalancedPokemonByGeneration(targetGen, routeIndex + idx, route.length, false, runChallenges.allShiny, balDiff(difficulty), -1, getStageProgression(), targetLevel)
            .then((base) => {
              const levelDiff = targetLevel - base.level
              let scaled = scalePokemonForNode(base, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff, balDiff(difficulty))
              if (runChallenges.fixedLevel) scaled = { ...scaled, level: 50 }
              if (runChallenges.totalRandomizer) {
                scaled = {
                  ...scaled,
                  attack: scaled.attack + Math.floor(Math.random() * 20) - 10,
                  defense: scaled.defense + Math.floor(Math.random() * 20) - 10,
                  speed: scaled.speed + Math.floor(Math.random() * 20) - 10,
                }
              }
              return { ...scaled, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } }
            })
        )
        const enemies = await Promise.all(fetches)
        enemies.forEach(p => seenInPokedex(p))
        // Los 2 primeros Pokémon vivos del equipo son los que participan.
        const aliveIdx = team.map((p, i) => (p.hp > 0 ? i : -1)).filter(i => i >= 0)
        const activesIdx = aliveIdx.slice(0, 2)
        // --- Habilidades de entrada: clima e Intimidación entre los 2v2 ---
        setWeather('none')
        const activePokemons = activesIdx.map(i => team[i]).filter(Boolean) as Pokemon[]
        const entryLogs: string[] = []
        const enemyWithEntry: Pokemon[] = enemies.map(e => {
          let en: Pokemon = e
          for (const ap of activePokemons) {
            const entry = applyEntryAbilities(ap, en)
            en = entry.opponentUpdated
            entryLogs.push(...entry.logs)
          }
          const selfEntry = applyAbilityEntrySelf(en, activePokemons[0] ?? en)
          entryLogs.push(...selfEntry.logs)
          return selfEntry.entering
        })
        const teamWithEntry = team.map((p, i) => {
          if (!activesIdx.includes(i)) return p
          let updated = p
          for (const e of enemies) {
            const entry = applyEntryAbilities(e, updated)
            updated = entry.opponentUpdated
            entryLogs.push(...entry.logs)
          }
          const selfEntry = applyAbilityEntrySelf(updated, enemyWithEntry[0] ?? updated)
          entryLogs.push(...selfEntry.logs)
          return selfEntry.entering
        })
        const forcedWeather = (modifier?.forcedWeather ?? modifier2?.forcedWeather) as WeatherKind | undefined
        const stationWeather = consumeWeatherStation()
        if (stationWeather) {
          setWeather(stationWeather)
          entryLogs.push(t('b.stationWeather', { weather: weatherName(stationWeather, getLanguage()) }))
        } else if (forcedWeather) {
          setWeather(forcedWeather)
          entryLogs.push(t('b.abilityWeather', { name: runModName('weathermania'), weather: weatherName(forcedWeather, getLanguage()) }))
        }
        setTeam(teamWithEntry)
        setDoubleActives(activesIdx)
        setDoubleEnemies(enemyWithEntry)
        setDoubleMoves([null, null])
        setDoubleActiveSlot(0)
        setDoubleChoosingSwitch(false)
        setDoubleLog([t('b.doubleChallenge', { a: enemies[0].name, b: enemies[1].name }), ...entryLogs])
        setDoubleHits([])
        doubleHitKeyRef.current = 0
        setDoubleFinished(false)
        setScreen('double')
      } catch {
        setApiError('No se pudo preparar el combate doble.')
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (currentNode.type === 'shop') {
      setShopRerollsUsed(0)
      setShopBoughtCount({})
      setShopStock(generateShopStock())
      if (runChallenges.noPurchasing) {
        setBattleLog((prev) => [
          t('b.challengeNoBuying'),
          ...prev
        ].slice(0, 15))
      }
      const potionBonus = modifier?.shopPotionBonus ?? 0
      if (potionBonus > 0) {
        setInventory((prev) => [...prev, ...Array(potionBonus).fill('Potion')])
        setBattleLog((prev) => [
          t('b.shopPotionBonus', { n: potionBonus }),
          ...prev
        ].slice(0, 15))
      }
      setScreen('shop')
      return
    }

    if (currentNode.type === 'trade') {
      setIsLoading(true)
      setApiError('')
      setCoopTradeMsg('')
      setCoopMyOffer(null)
      setCoopMyOfferSubmitted(false)
      setCoopExchange(null)
      coopExchangeAppliedRef.current = false
      coopSubmittedOfferRef.current = null
      coopSelectedPokemonRef.current = null
      setIsLoading(false)
      setScreen('trade')
      return
    }

    if (currentNode.type === 'spin') {
      const healingPool = Object.keys(ALL_SHOP_ITEMS).filter(i => isConsumableUnlocked(i) && !POKEBALL_NAMES.includes(i) && !EVOLUTION_STONE_UNLOCK_IDS[i] && i !== 'Cuerda Huida')
      const passivePool = HOLDABLE_ITEM_NAMES.filter(isHoldableUnlocked).filter(n => n !== 'Mega Stone' && n !== 'Dynamax Band' && n !== 'Prisma Rojo' && n !== 'Prisma Azul' && !EVOLUTION_ITEM_UNLOCK_IDS[n])
      const unlockedStones = EVOLUTION_STONES.filter(s => isEvolutionStoneUnlocked(s))
      const selectedStone = unlockedStones.length > 0 ? [unlockedStones[Math.floor(Math.random() * unlockedStones.length)]] : []
      const shuffledH = [...healingPool].sort(() => 0.5 - Math.random())
      const shuffledP = [...passivePool].sort(() => 0.5 - Math.random())
      const items = [...shuffledH.slice(0, 3), ...shuffledP.slice(0, 2), ...selectedStone].sort(() => 0.5 - Math.random())
      setSpinItems(items)
      setSpinWinnerIndex(null)
      setSpinRevealed(false)
      setSpinAnimating(false)
      setScreen('spin')
      return
    }

    if (currentNode.type === 'pokeRand') {
      setIsLoading(true)
      setApiError('')
      try {
        const targetGen = getEffectiveGen()
        const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))
        const fetches = Array.from({ length: 6 }, () => {
          const targetLevel = difficulty === 'infinite'
            ? getInfiniteTargetLevel() + 1 + Math.floor(Math.random() * 2)
            : avgPlayerLevel + Math.floor(Math.random() * 3) - 1
          return getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, balDiff(difficulty), -1, getStageProgression(), targetLevel)
            .then((base) => {
              const levelDiff = targetLevel - base.level
              const scaled = scalePokemonForNode(base, currentNode, routeIndex, levelDiff, balDiff(difficulty))
              return runChallenges.fixedLevel ? { ...scaled, level: 50 } : scaled
            })
        })
        const pokemonList = await Promise.all(fetches)
        setPokeRandPokemon(pokemonList)
        setPokeRandWinnerIndex(null)
        setPokeRandRevealed(false)
        setPokeRandAnimating(false)
        setScreen('pokeRand')
      } catch {
        setApiError('No se pudieron generar Pokémon. Reintenta.')
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (currentNode.type === 'casino') {
      setCasinoScore(null)
      setCasinoReward(null)
      setCasinoPlayed(false)
      setScreen('casino')
      return
    }

    if (currentNode.type === 'move') {
      await openMoveTutor(false)
      return
    }

    if (currentNode.type === 'gmax') {
      setIsLoading(true)
      setApiError('')
      try {
        const targetGen = getEffectiveGen()
        const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))
        const gmaxId = Array.from(GMAX_CAPABLE_IDS)[Math.floor(Math.random() * GMAX_CAPABLE_IDS.size)]
        const gmaxTargetLevel = difficulty === 'infinite'
          ? getInfiniteTargetLevel() + 2
          : avgPlayerLevel + 2
        const base = await buildPokemonFromApi(gmaxId, targetGen, gmaxTargetLevel, false, difficulty, true)
        const gmaxLevelDelta = modifier?.enemyLevelDelta ?? 0
        let scaled = scalePokemonForNode({ ...base, minAppearLevel: undefined }, currentNode, routeIndex, gmaxLevelDelta, balDiff(difficulty))
        if (runChallenges.fixedLevel) scaled = { ...scaled, level: 50 }
        if (runChallenges.totalRandomizer) {
          scaled = {
            ...scaled,
            attack: scaled.attack + Math.floor(Math.random() * 20) - 10,
            defense: scaled.defense + Math.floor(Math.random() * 20) - 10,
            speed: scaled.speed + Math.floor(Math.random() * 20) - 10,
          }
        }
        const formId = GMAX_FORM_IDS[scaled.id]
        const gmaxFormId = Array.isArray(formId) ? formId[Math.floor(Math.random() * formId.length)] : formId
        const gmaxSprite = gmaxFormId
          ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${gmaxFormId}.png`
          : scaled.sprite
        const gmaxMultiplier = difficulty === 'infinite' ? 1.45 : difficulty === 'hard' ? 1.40 : 1.30
        const gmaxEnemy: Pokemon = {
          ...scaled,
          gmaxEvolved: true,
          gmaxTurnsLeft: 3,
          sprite: gmaxSprite,
          holdItem: null,
          attack: Math.floor(scaled.attack * gmaxMultiplier),
          defense: Math.floor(scaled.defense * gmaxMultiplier),
          speed: Math.floor(scaled.speed * gmaxMultiplier),
          maxHp: Math.floor(scaled.maxHp * (1 + (gmaxMultiplier - 1) * 0.5)),
          hp: Math.floor(scaled.hp * (1 + (gmaxMultiplier - 1) * 0.5)),
          statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
        }
        seenInPokedex({ ...gmaxEnemy, id: gmaxFormId ?? gmaxEnemy.id, sprite: gmaxSprite })
        setIsTrainerBattle(false)
        // Cada combate G-MAX es independiente: se permite volver a Mega/G-MAX.
        setBattleMegaUsed(false)
        setBattleGmaxUsed(false)
        setBattlePrimalUsed(false)
        setBattleOriginUsed(false)
        setTeam(prev => prev.map((p) => {
          const orig = p.megaOrig
          if (orig) return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, originEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, ...orig }
          return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, originEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined }
        }))
        setEnemy(gmaxEnemy)
        setBattleLog(prev => [t('b.gmaxAppears', { name: gmaxEnemy.name }), ...prev].slice(0, 15))
        startBattleMusic()
        setBattleTurns(0)
        setScreen('battle')
      } catch {
        setApiError(t('b.gmaxError'))
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (currentNode.type === 'mega') {
      const alreadyHas = inventory.includes('Mega Stone') || team.some(p => p.holdItem === 'Mega Stone')
      if (!alreadyHas || difficulty === 'infinite') {
        setInventory(prev => [...prev, 'Mega Stone'])
        setBattleLog(prev => [t('b.megaStoneGot'), ...prev].slice(0, 15))
      } else {
        const price = 200
        setMetaProgression(prev => ({ ...prev, pokeCoins: prev.pokeCoins + price }))
        setBattleLog(prev => [t('b.alreadyMegaCoin', { coins: price }), ...prev].slice(0, 15))
      }
      setScreen('mega')
      return
    }

    if (currentNode.type === 'primal') {
      const redHas = inventory.includes('Prisma Rojo') || team.some(p => p.holdItem === 'Prisma Rojo')
      const blueHas = inventory.includes('Prisma Azul') || team.some(p => p.holdItem === 'Prisma Azul')
      const orbName = Math.random() < 0.5 ? 'Prisma Rojo' : 'Prisma Azul'
      const alreadyHas = orbName === 'Prisma Rojo' ? redHas : blueHas
      if (!alreadyHas || difficulty === 'infinite') {
        setInventory(prev => [...prev, orbName])
        setBattleLog(prev => [t('b.orbGot', { orb: orbName, poke: orbName === 'Prisma Rojo' ? 'Groudon' : 'Kyogre' }), ...prev].slice(0, 15))
      } else {
        const price = 150
        setMetaProgression(prev => ({ ...prev, pokeCoins: prev.pokeCoins + price }))
        setBattleLog(prev => [t('b.alreadyOrbCoin', { orb: orbName, coins: price }), ...prev].slice(0, 15))
      }
      setScreen('primal')
      return
    }

    if (currentNode.type === 'rest') {
      if (restEncounter) return
      setIsLoading(true)
      setApiError('')

      try {
        if (runChallenges.egglocke) {
          const targetGen = getEffectiveGen()
          const restPokemonBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, balDiff(difficulty), -1, getStageProgression())
          const eggId = Math.floor(Math.random() * 900) + 1
          const eggEntry = {
            name: restPokemonBase.name,
            sprite: restPokemonBase.sprite,
            types: (restPokemonBase as any).types ?? ['normal'],
            hatchIn: 2 + Math.floor(Math.random() * 2),
            id: eggId
          }
          setEggInventory(prev => [...prev, eggEntry])
          const unlockedBalls = POKEBALL_NAMES.filter(b => isPokeballUnlocked(b) && b !== 'Master Ball')
          const ballReward = Math.random() < 0.35 ? randomFrom(unlockedBalls) : null
          const rewardItem = ballReward ?? (runChallenges.noHealing
            ? randomFrom(['X Attack', 'X Defense', 'X Speed'])
            : randomFrom(['Potion', 'Super Potion', 'X Attack', ...BERRY_DROPS.filter(isBerryUnlocked), ...TREASURE_DROPS.filter(isConsumableUnlocked)]))
          const dowsingExtraEgg = (isActive('unlock_dowsing') ? 1 : 0) + (isActive('unlock_dowsing_2') ? 1 : 0)
          const restExtraPoolEgg = runChallenges.noHealing
            ? ['X Attack', 'X Defense', 'X Speed']
            : ['Potion', 'Super Potion', 'X Attack', ...BERRY_DROPS.filter(isBerryUnlocked), ...TREASURE_DROPS.filter(isConsumableUnlocked), ...unlockedBalls]
          const extraItemsEgg: string[] = []
          for (let i = 0; i < dowsingExtraEgg; i++) extraItemsEgg.push(randomFrom(restExtraPoolEgg))
          const magmaEmblemEgg = rollMagmaEmblem()
          setRestRewardItem(rewardItem)
          setRestExtraItems([...extraItemsEgg, ...magmaEmblemEgg])
          setInventory((previous) => [...previous, rewardItem, ...extraItemsEgg, ...magmaEmblemEgg])
          setBattleLog((prev) => [
            t('rest.eggFound', { name: eggEntry.name, n: eggEntry.hatchIn, label: currentNode.label }),
            t('rest.eggItem', { item: itemLocalizedName(rewardItem) }),
            ...extraItemsEgg.map(item => t('rest.dowsingFound', { item: itemLocalizedName(item) })),
            ...(magmaEmblemEgg.length > 0 ? [t('rest.magmaEmblemFound')] : []),
            ...prev
          ].slice(0, 15))
          completeCurrentNode()
          setScreen('route')
          return
        }

        const targetGen = getEffectiveGen()
        const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))
        const restTargetLevel = difficulty === 'infinite'
          ? getInfiniteTargetLevel() + (Math.floor(Math.random() * 3) - 1)
          : avgPlayerLevel - 2 + Math.floor(Math.random() * 3) - 1
        const restPokemonBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, balDiff(difficulty), -1, getStageProgression(), restTargetLevel)
        const levelDiff = restTargetLevel - restPokemonBase.level
        const generatedEncounter = scalePokemonForNode(restPokemonBase, currentNode, routeIndex, levelDiff, balDiff(difficulty))
        generatedEncounter.holdItem = null
        if (shinyNextEncounter) {
          generatedEncounter.shiny = true
          generatedEncounter.sprite = makeShinySprite(generatedEncounter.sprite, generatedEncounter.id)
          setShinyNextEncounter(false)
        } else if (!runChallenges.allShiny && Math.random() < 0.02) {
          generatedEncounter.shiny = true
          generatedEncounter.sprite = makeShinySprite(generatedEncounter.sprite, generatedEncounter.id)
        }
        const unlockedBalls = POKEBALL_NAMES.filter(b => isPokeballUnlocked(b) && b !== 'Master Ball')
        const ballReward = Math.random() < 0.35 ? randomFrom(unlockedBalls) : null
        const rewardItem = ballReward ?? (runChallenges.noHealing
          ? randomFrom(['X Attack', 'X Defense', 'X Speed'])
          : randomFrom(['Potion', 'Super Potion', 'X Attack', ...BERRY_DROPS.filter(isBerryUnlocked), ...TREASURE_DROPS.filter(isConsumableUnlocked)]))
        const dowsingExtra = (isActive('unlock_dowsing') ? 1 : 0) + (isActive('unlock_dowsing_2') ? 1 : 0)
        const restExtraPool = runChallenges.noHealing
          ? ['X Attack', 'X Defense', 'X Speed']
          : ['Potion', 'Super Potion', 'X Attack', ...BERRY_DROPS.filter(isBerryUnlocked), ...TREASURE_DROPS.filter(isConsumableUnlocked), ...unlockedBalls]
        const extraItems: string[] = []
        for (let i = 0; i < dowsingExtra; i++) extraItems.push(randomFrom(restExtraPool))
        const magmaEmblem = rollMagmaEmblem()

        setRestEncounter(generatedEncounter)
        seenInPokedex(generatedEncounter)
        setRestRewardItem(rewardItem)
        setRestExtraItems([...extraItems, ...magmaEmblem])
        setInventory((previous) => [...previous, rewardItem, ...extraItems, ...magmaEmblem])
        setBattleLog((prev) => [
          t('rest.found', { label: currentNode.label, name: generatedEncounter.name, item: itemLocalizedName(rewardItem) }),
          ...extraItems.map(item => t('rest.dowsingFound', { item: itemLocalizedName(item) })),
          ...(magmaEmblem.length > 0 ? [t('rest.magmaEmblemFound')] : []),
          ...prev
        ])
      } catch {
        setApiError(t('rest.error'))
      } finally {
        setIsLoading(false)
      }
      return
    }

    setIsLoading(true)
    setApiError('')

    try {
      const targetGen = getEffectiveGen()
      const isBoss = currentNode.type === 'boss'
      const isTeamRocket = currentNode.type === 'teamRocket'

      const extraEnemyLevels = runChallenges.scalingEnemies ? routeIndex : 0

      if (currentNode.type === 'mirror') {
        // Combate Espejo: el rival copia exactamente tu equipo y niveles.
        const mirrorTeam = team.map(p => ({
          ...p,
          moves: p.moves.map(m => ({ ...m })),
          hp: p.maxHp,
          maxHp: p.maxHp,
          status: undefined,
          statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
          justEntered: false,
          leechSeed: false,
          megaEvolved: false,
          gmaxEvolved: false,
          primalEvolved: false,
          originEvolved: false,
          gmaxTurnsLeft: undefined,
          megaOrig: undefined,
          abilityState: undefined,
          protected: false,
          disabled: undefined,
          lastMove: undefined,
          choiceLockedMove: undefined,
        }))
        if (mirrorTeam.length === 0) throw new Error('empty mirror team')
        mirrorTeam.forEach(p => seenInPokedex(p))
        setIsTrainerBattle(true)
        setTrainerTeam(mirrorTeam)
        setTrainerPokemonIndex(0)
        setTrainerName(language === 'en' ? 'Mirror Trainer' : 'Entrenador Espejo')
        setTrainerSprite("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='12' fill='%232a1b4d'/%3E%3Cellipse cx='48' cy='44' rx='20' ry='26' fill='%23c084fc'/%3E%3Cellipse cx='48' cy='44' rx='14' ry='20' fill='%23e9d5ff'/%3E%3Cpath d='M20 88 q0 -30 28 -30 q28 0 28 30' fill='%23c084fc'/%3E%3C/svg%3E")
        setTrainerBadge('')
        setEnemy({ ...mirrorTeam[0], statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } })
        setIsTeamRocketBattle(false)
        setIsRivalBattle(false)
        setBattleLog(prev => [
          language === 'en' ? '🪞 Mirror Battle: your rival copies your team.' : '🪞 Combate Espejo: el rival copia tu equipo.',
          t('b.sendsOut', { name: mirrorTeam[0].name, lvl: mirrorTeam[0].level }),
          ...prev
        ])
      } else if (currentNode.type === 'rival') {
        // Rival recurrente: escala contigo y da más dinero que el resto.
        const teamSize = trainerTeamSize(routeIndex, route.length, difficulty)
        const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))
        const fetches = Array.from({ length: teamSize }, (_, idx) => {
          const targetLevel = difficulty === 'infinite'
            ? getInfiniteTargetLevel() + trainerMemberLevelOffset(idx, teamSize, true, difficulty)
            : avgPlayerLevel + trainerMemberLevelOffset(idx, teamSize, true, difficulty)
          const baseStepIndex = difficulty === 'infinite' ? Math.max(0, targetLevel - 10) : routeIndex
          return getBalancedPokemonByGeneration(targetGen, baseStepIndex, route.length, false, runChallenges.allShiny, balDiff(difficulty), -1, getStageProgression(), targetLevel)
            .then((base) => {
              const levelDiff = targetLevel - base.level
              let scaled = scalePokemonForNode(base, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff + extraEnemyLevels, balDiff(difficulty))
              if (runChallenges.fixedLevel) scaled = { ...scaled, level: 50 }
              if (runChallenges.totalRandomizer) {
                scaled = {
                  ...scaled,
                  attack: scaled.attack + Math.floor(Math.random() * 20) - 10,
                  defense: scaled.defense + Math.floor(Math.random() * 20) - 10,
                  speed: scaled.speed + Math.floor(Math.random() * 20) - 10,
                }
              }
              return scaled
            })
        })
        const rivalTeam = await Promise.all(fetches)
        rivalTeam.forEach(p => seenInPokedex(p))
        setIsTrainerBattle(true)
        setTrainerTeam(rivalTeam)
        setTrainerPokemonIndex(0)
        setTrainerName('Rival')
        setTrainerSprite("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='12' fill='%23ffffff'/%3E%3Ccircle cx='48' cy='36' r='17' fill='%234d9bff'/%3E%3Cpath d='M20 88 q0 -30 28 -30 q28 0 28 30' fill='%234d9bff'/%3E%3C/svg%3E")
        setTrainerBadge('')
        setEnemy({ ...rivalTeam[0], statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } })
        setIsTeamRocketBattle(false)
        setIsRivalBattle(true)
        setBattleLog((prev) => [
          t('b.rivalChallenge', { n: teamSize }),
          t('b.sendsOut', { name: rivalTeam[0].name, lvl: rivalTeam[0].level }),
          ...prev
        ])
      } else if (isTeamRocket) {
        // El tamaño del equipo escala igual que el Rival (2 → 6).
        const teamSize = trainerTeamSize(routeIndex, route.length, difficulty)
        const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))

        const fetches = Array.from({ length: teamSize }, (_, idx) => {
          const targetLevel = difficulty === 'infinite'
            ? getInfiniteTargetLevel() + trainerMemberLevelOffset(idx, teamSize, false, difficulty)
            : avgPlayerLevel + trainerMemberLevelOffset(idx, teamSize, false, difficulty)
          // En Infinite, genera al rival directamente a su nivel objetivo para que
          // respete etapas evolutivas y movimientos según el nivel. En Co-op, igual.
          const baseStepIndex = difficulty === 'infinite' ? Math.max(0, targetLevel - 10) : routeIndex
          return getBalancedPokemonByGeneration(targetGen, baseStepIndex, route.length, false, runChallenges.allShiny, balDiff(difficulty), -1, getStageProgression(), targetLevel)
            .then((base) => {
              const levelDiff = targetLevel - base.level
              let scaled = scalePokemonForNode(base, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff + extraEnemyLevels, balDiff(difficulty))
              if (runChallenges.fixedLevel) scaled = { ...scaled, level: 50 }
              if (runChallenges.totalRandomizer) {
                scaled = {
                  ...scaled,
                  attack: scaled.attack + Math.floor(Math.random() * 20) - 10,
                  defense: scaled.defense + Math.floor(Math.random() * 20) - 10,
                  speed: scaled.speed + Math.floor(Math.random() * 20) - 10,
                }
              }
              return scaled
            })
        })
        const rocketTeam = await Promise.all(fetches)
        rocketTeam.forEach(p => seenInPokedex(p))

        setIsTrainerBattle(true)
        setTrainerTeam(rocketTeam)
        setTrainerPokemonIndex(0)
        setTrainerName('TeamR Grunt')
        setTrainerSprite("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='12' fill='%23111'/%3E%3Ctext x='48' y='62' font-family='Arial Black,Arial' font-size='52' font-weight='900' fill='%23ef4444' text-anchor='middle'%3ER%3C/text%3E%3Ccircle cx='48' cy='80' r='3' fill='%23ef4444'/%3E%3C/svg%3E")
        setTrainerBadge('')
        setEnemy({ ...rocketTeam[0], statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } })
        setIsTeamRocketBattle(true)
        setTeamRocketFainted(false)
        setTeamRocketTeam(rocketTeam.map(p => ({ ...p, statStages: p.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } })))
        setTeamRocketStealMessage('')
        setTeamRocketPickModal(false)
        setBattleLog((prev) => [
          t('b.teamRocketChallenge', { n: teamSize }),
          t('b.sendsOut', { name: rocketTeam[0].name, lvl: rocketTeam[0].level }),
          ...prev
        ])
      } else {
        const isElite = currentNode.type === 'elite'
        const willBeTrainer = isBoss || isElite || Math.random() < 0.5

        if (willBeTrainer) {
          const isLeague = currentNode.id >= 1000
          // En Fácil, los jefes de las etapas 1 y 2 llevan la mitad de Pokémon (3);
          // el jefe de la última etapa (3ª insignia) conserva los 6.
          const maxSize = isBoss ? ((difficulty === 'easy' && !isLeague && badges.length < 2) ? 3 : 6) : trainerMaxSize(routeIndex, route.length, difficulty)
          // Élite: equipo mínimo de 4 y hasta 6 a lo largo de la Calle Victoria.
          const teamSize = isBoss ? maxSize : isElite ? Math.max(4, maxSize) : Math.max(1, Math.min(maxSize, 1 + Math.floor(Math.random() * maxSize)))
          const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))

          const fetches = Array.from({ length: teamSize }, (_, idx) =>
            difficulty === 'coliseum'
              ? (async () => {
                try {
                  const ids = await getSpeciesIdsByGeneration(targetGen)
                  const id = ids[Math.floor(Math.random() * ids.length)] || 1
                  const pokemon = await buildPokemonFromApi(id, targetGen, 50, false, difficulty)
                  return { ...pokemon, level: 50, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } }
                } catch {
                  return { id: 1, name: 'Bulbasaur', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png', level: 50, hp: 100, maxHp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50, moves: [], statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } } as Pokemon
                }
              })()
              : (() => {
                const targetLevel = difficulty === 'infinite'
                  ? getInfiniteTargetLevel() + trainerMemberLevelOffset(idx, teamSize, isBoss, difficulty) + (isLeague ? 2 : 0)
                  : avgPlayerLevel + trainerMemberLevelOffset(idx, teamSize, isBoss, difficulty) + (isLeague ? 2 : 0)
                // En Infinite, genera al rival directamente a su nivel objetivo para que
                // respete etapas evolutivas y movimientos según el nivel. En Co-op,
                // igual: la especie debe ser coherente con el nivel objetivo real.
                const baseStepIndex = difficulty === 'infinite' ? Math.max(0, targetLevel - 10) : routeIndex
                return getBalancedPokemonByGeneration(targetGen, baseStepIndex, route.length, isBoss, runChallenges.allShiny, balDiff(difficulty), isBoss ? getStageProgression() : -1, getStageProgression(), targetLevel, isElite)
                  .then((base) => {
                    const levelDiff = targetLevel - base.level
                    let scaled = scalePokemonForNode(base, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff + extraEnemyLevels, balDiff(difficulty))
                    if (runChallenges.fixedLevel) scaled = { ...scaled, level: 50 }
                    if (runChallenges.totalRandomizer) {
                      scaled = {
                        ...scaled,
                        attack: scaled.attack + Math.floor(Math.random() * 20) - 10,
                        defense: scaled.defense + Math.floor(Math.random() * 20) - 10,
                        speed: scaled.speed + Math.floor(Math.random() * 20) - 10,
                      }
                    }
                    return scaled
                  })
              })()
          )
          const newTrainerTeam = await Promise.all(fetches)

          let chosenName = ''
          let chosenSprite = ''
          let chosenBadge = ''
          if (isBoss) {
            const leader = randomFrom(GYM_LEADERS)
            chosenName = leader.name
            chosenSprite = leader.sprite
            chosenBadge = leader.badge
          } else {
            const trainer = randomFrom(TRAINER_TYPES)
            chosenName = isElite ? `Elite ${trainer.label} ${trainer.name}` : `${trainer.label} ${trainer.name}`
            chosenSprite = trainer.sprite
            chosenBadge = ''
          }

          setIsTrainerBattle(true)
          // Los jefes pueden sacar Megas en Difícil/Infinite siempre, y en el
          // Modo Ruta solo a partir del stage 7 (7ª y 8ª medalla).
          const bossCanMega = (difficulty === 'hard' || difficulty === 'infinite') || (difficulty === 'branch' && getStageProgression() >= 6)
          const megaTeam = newTrainerTeam.map(p => {
            if (isBoss && bossCanMega && Math.random() < 0.15 && MEGA_CAPABLE_IDS.has(p.id)) {
              const formId = MEGA_FORM_IDS[p.id]
              if (formId) {
                const megaFormId = Array.isArray(formId) ? formId[Math.floor(Math.random() * formId.length)] : formId
                const megaSprite = MEGA_SPRITE_OVERRIDES[megaFormId] ?? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${megaFormId}.png`
                seenInPokedex({ ...p, id: megaFormId, sprite: megaSprite })
                return {
                  ...p,
                  id: megaFormId,
                  sprite: megaSprite,
                  attack: Math.floor(p.attack * 1.15),
                  defense: Math.floor(p.defense * 1.15),
                  speed: Math.floor(p.speed * 1.15),
                }
              }
            }
            return p
          })
          const trainerTeamShiny = !runChallenges.allShiny && Math.random() < 0.01
          const shinyTrainerTeam = trainerTeamShiny
            ? megaTeam.map(p => ({ ...p, shiny: true, sprite: makeShinySprite(p.sprite, p.id) }))
            : megaTeam
          setTrainerTeam(shinyTrainerTeam.map(p => ({ ...p, statStages: p.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } })))
          shinyTrainerTeam.forEach(p => seenInPokedex(p))
          setTrainerPokemonIndex(0)
          setTrainerName(chosenName)
          setTrainerSprite(chosenSprite)
          setTrainerBadge(chosenBadge)
          // Primer combate de la run: se suaviza al rival para que no pueda
          // debilitar al starter de un golpe y el jugador pueda empezar a actuar.
          let firstEnemy: Pokemon = { ...shinyTrainerTeam[0], statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } }
          if (routeIndex === 0 && !isBoss) {
            firstEnemy = { ...softenFirstBattleEnemy(firstEnemy, team), statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } }
          }
          setEnemy(firstEnemy)
          setBattleLog((prev) => [
            isBoss
              ? t('b.leaderChallenge', { name: chosenName, badge: chosenBadge })
              : isElite
                ? t('b.eliteChallenge', { name: chosenName, n: teamSize })
                : t('b.trainerChallenge', { name: chosenName, n: teamSize }),
            t('b.sendsOut', { name: firstEnemy.name, lvl: firstEnemy.level }),
            ...prev
          ])
        } else {
          const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))
          const wildLevelOffset = difficulty === 'easy'
            ? Math.floor(Math.random() * 3) - 2 // -2..0
            : Math.floor(Math.random() * 3) - 1 // -1..0..+1
          const targetLevel = difficulty === 'infinite'
            ? getInfiniteTargetLevel() + (Math.floor(Math.random() * 3) - 1)
            : avgPlayerLevel + wildLevelOffset
          const enemyBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, balDiff(difficulty), -1, getStageProgression(), targetLevel)
          const levelDiff = targetLevel - enemyBase.level
          let generatedEnemy = scalePokemonForNode(enemyBase, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff + extraEnemyLevels, balDiff(difficulty))
          generatedEnemy = balanceWildPokemonToTeam(generatedEnemy, team, balDiff(difficulty))
          if (runChallenges.fixedLevel) generatedEnemy = { ...generatedEnemy, level: 50 }
          if (runChallenges.totalRandomizer) {
            generatedEnemy = {
              ...generatedEnemy,
              attack: generatedEnemy.attack + Math.floor(Math.random() * 20) - 10,
              defense: generatedEnemy.defense + Math.floor(Math.random() * 20) - 10,
              speed: generatedEnemy.speed + Math.floor(Math.random() * 20) - 10,
            }
          }
          generatedEnemy = { ...generatedEnemy, holdItem: null, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } }
          if (legendaryNextEncounter) {
            const ids = REGION_LEGENDARIES[getEffectiveGen()] ?? REGION_LEGENDARIES[1]
            const legendId = ids[Math.floor(Math.random() * ids.length)]
            const legendBase = await buildPokemonFromApi(legendId, getEffectiveGen(), Math.max(targetLevel, 40), runChallenges.allShiny || shinyNextEncounter, balDiff(difficulty), true)
            generatedEnemy = scalePokemonForNode(legendBase, currentNode, routeIndex, 0, balDiff(difficulty))
            generatedEnemy = { ...generatedEnemy, holdItem: null, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } }
            setLegendaryNextEncounter(false)
            if (shinyNextEncounter) setShinyNextEncounter(false)
          }
          if (shinyNextEncounter) {
            generatedEnemy = { ...generatedEnemy, shiny: true, sprite: makeShinySprite(generatedEnemy.sprite, generatedEnemy.id) }
            setShinyNextEncounter(false)
          } else if (!runChallenges.allShiny && Math.random() < 0.02) {
            generatedEnemy = { ...generatedEnemy, shiny: true, sprite: makeShinySprite(generatedEnemy.sprite, generatedEnemy.id) }
          }
          // Primer combate de la run: se suaviza al rival para que no pueda
          // debilitar al starter de un golpe y el jugador pueda empezar a actuar.
          if (routeIndex === 0 && !isBoss) {
            generatedEnemy = softenFirstBattleEnemy(generatedEnemy, team)
          }
          setIsTrainerBattle(false)
          setTrainerTeam([])
          setTrainerPokemonIndex(0)
          setTrainerName('')
          setTrainerSprite('')
          setTrainerBadge('')
          setReviveModal(null)
          setEquipModal(null)
          setEnemy({ ...generatedEnemy, justEntered: true })
          seenInPokedex(generatedEnemy)
          setBattleLog((prev) => [
            t('b.wildAppeared', { name: generatedEnemy.name, lvl: generatedEnemy.level }),
            ...prev
          ])
        }
      }

      setTeam(prev => prev.map((p, i) => {
        const orig = p.megaOrig
        const entered = i === activeIndex
        if (orig) return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, originEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, leechSeed: false, disabled: undefined, lastMove: undefined, justEntered: entered, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, furiaActive: false }
        return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, originEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, leechSeed: false, disabled: undefined, lastMove: undefined, justEntered: entered, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, furiaActive: false }
      }))
      setBattleMegaUsed(false)
      setBattleGmaxUsed(false)
      setBattlePrimalUsed(false)
      setBattleOriginUsed(false)
      battleStartHPRef.current = activePokemon.hp
      battleMinHpRef.current = activePokemon.hp
      setBattleTurns(0)
      setScreen('battle')

      if (runChallenges.speedrun) {
        setSpeedrunSeconds(30)
        if (speedrunTimerRef.current) clearInterval(speedrunTimerRef.current)
        speedrunTimerRef.current = setInterval(() => {
          setSpeedrunSeconds(prev => {
            if (prev <= 1) {
              if (speedrunTimerRef.current) clearInterval(speedrunTimerRef.current)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } catch {
      setApiError('No se pudo generar rival desde PokeAPI. Reintenta.')
    } finally {
      setIsLoading(false)
    }
  }

  // Modo Ruta: el jugador elige uno de los nodos de la columna actual del mapa.
  // Se marca routeIndex hacia ese nodo y se entra en él (el mapa se oculta al
  // cambiar a la pantalla del nodo, dejando todo el espacio al juego).
  function enterBranchNode(nodeId: number): void {
    if (difficulty !== 'branch' || !branchMap || screen !== 'route' || isLoading) return
    const column = branchMap[branchCol]
    if (!column) return
    const chosen = column.find(n => n.id === nodeId)
    if (!chosen || chosen.done) return
    // Regla del Modo Ruta: desde la fila actual solo se puede avanzar a los
    // 2 nodos más próximos al elegido en la fila anterior (o a cualquiera en
    // la primera fila).
    if (branchCol > 0) {
      const doneNodes = route.filter(n => n.done) as BranchNode[]
      const lastDone = doneNodes[doneNodes.length - 1]
      if (!lastDone) return
      const reachable = nearestBranchNodes(lastDone, branchMap[branchCol - 1].length, column)
      if (!reachable.some(n => n.id === nodeId)) return
    }
    playClick()
    setRouteIndex(route.findIndex(n => n.id === nodeId))
    void enterNode(chosen)
  }

  function spinRoulette(): void {
    if (spinAnimating || spinRevealed) return
    playSlotMachine()
    setSpinAnimating(true)
    setSpinWinnerIndex(null)
    setSpinRevealed(false)

    const winner = Math.floor(Math.random() * spinItems.length)
    const spinDuration = 3000
    const startTime = Date.now()

    function tick() {
      const elapsed = Date.now() - startTime
      if (elapsed < spinDuration) {
        setSpinWinnerIndex(Math.floor(Math.random() * spinItems.length))
        requestAnimationFrame(tick)
      } else {
        setSpinWinnerIndex(winner)
        setSpinAnimating(false)
        setPokeRandPokemon([])
        setPokeRandWinnerIndex(null)
        setPokeRandRevealed(false)
        setPokeRandAnimating(false)
        setSpinRevealed(true)
      }
    }
    requestAnimationFrame(tick)
  }

  function claimSpinItem(): void {
    if (spinWinnerIndex === null) return
    const item = spinItems[spinWinnerIndex]
    setInventory((prev) => [...prev, item])
    setBattleLog((prev) => [
      t('spin.logWon', { item }),
      ...prev
    ].slice(0, 15))
    unlockAchievement('gambler')
    completeCurrentNode()
    setScreen('route')
  }

  function pokeRandSpin(): void {
    if (pokeRandAnimating || pokeRandRevealed) return
    playSlotMachine()
    setPokeRandAnimating(true)
    setPokeRandWinnerIndex(null)
    setPokeRandRevealed(false)

    const winner = Math.floor(Math.random() * pokeRandPokemon.length)
    const spinDuration = 3000
    const startTime = Date.now()

    function tick() {
      const elapsed = Date.now() - startTime
      if (elapsed < spinDuration) {
        setPokeRandWinnerIndex(Math.floor(Math.random() * pokeRandPokemon.length))
        requestAnimationFrame(tick)
      } else {
        setPokeRandWinnerIndex(winner)
        setPokeRandAnimating(false)
        setPokeRandRevealed(true)
      }
    }
    requestAnimationFrame(tick)
  }

  function claimPokeRandPokemon(): void {
    if (pokeRandWinnerIndex === null) return
    let pokemon = pokeRandPokemon[pokeRandWinnerIndex]
    if (runChallenges.soloStarter) {
      setBattleLog((prev) => [t('b.challengeSoloStarter'), ...prev].slice(0, 15))
      return
    }
    if (runChallenges.fixedTeam) {
      setBattleLog((prev) => [t('b.challengeFixedTeam'), ...prev].slice(0, 15))
      return
    }
    if (runChallenges.noEvolution) pokemon = applyNoEvolutionBuff(pokemon)
    if (runChallenges.fixedLevel) pokemon = { ...pokemon, level: 50 }
    if (difficulty === 'hard' || difficulty === 'infinite') pokemon = { ...pokemon, holdItem: null }
    registerInPokedex(pokemon)
    setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
    if (pokemon.shiny) unlockAchievement('shiny_catch')
    if ((pokemon.attack + pokemon.defense + pokemon.speed + pokemon.maxHp) >= 600) unlockAchievement('legendary_catch')
    unlockAchievement('pokeRand_master')
    if (!teamHasRoom(team)) {
      setPcStorage((prev) => [...prev, pokemon])
      setBattleLog((prev) => [
        t('pokerand.logPC', { name: pokemon.name }),
        ...prev
      ].slice(0, 15))
    } else {
      setTeam((prev) => [...prev, pokemon])
      setBattleLog((prev) => [
        t('pokerand.logJoin', { name: pokemon.name }),
        ...prev
      ].slice(0, 15))
    }
    captureSummaryCompleteNodeRef.current = true
    setCaptureSummary(pokemon)
  }

  function skipPokeRandPokemon(): void {
    setBattleLog((prev) => [
      t('pokerand.logSkip'),
      ...prev
    ].slice(0, 15))
    completeCurrentNode()
    setScreen('route')
  }

  // --- Safari ---
  function safariNatureProfile(pokemon: Pokemon): { tolerance: number; label: string } {
    const mods = natureStatMods(pokemon.nature)
    if (mods.up === 'speed') return { tolerance: 5, label: 'juguetón' }
    if (mods.up === 'attack') return { tolerance: 2, label: 'orgulloso' }
    if (mods.up === 'spAttack') return { tolerance: 4, label: 'curioso' }
    if (mods.up === 'defense') return { tolerance: 3, label: 'tranquilo' }
    if (mods.up === 'spDefense') return { tolerance: 3, label: 'cauteloso' }
    return { tolerance: 4, label: 'neutral' }
  }

  function safariMoodEmoji(mood: number): string {
    if (mood >= 70) return '😊'
    if (mood >= 40) return '😐'
    if (mood >= 20) return '😟'
    return '😠'
  }

  function safariAvailableBalls(): string[] {
    return Array.from(new Set(inventory.filter(name => POKEBALL_NAMES.includes(name))))
  }

  function safariCaptureChance(ballName: string): number {
    if (!safariSelected) return 0
    const ball = POKEBALL_DEFS[ballName]
    if (ball?.isMaster) return 1
    const ballRate = ball?.rate ?? 1
    const speciesRate = (safariSelected.captureRate ?? 45) / 255
    const levelPenalty = Math.max(0, safariSelected.level - (activePokemon?.level ?? safariSelected.level)) * 0.005
    const base = 0.10 + speciesRate * 0.30 + (safariMood / 100) * 0.25 + safariBonus / 100
    return Math.max(0.05, Math.min(0.95, base + (ballRate - 1) * 0.06 - levelPenalty))
  }

  async function prepareSafari(node: RouteNode): Promise<void> {
    setSafariLoading(true)
    setSafariChoices([])
    setSafariSelected(null)
    setSafariLog([])
    setSafariMood(60)
    setSafariBonus(0)
    setSafariPetCount(0)
    setSafariThreat(0)
    try {
      const targetGen = getEffectiveGen()
      const avgPlayerLevel = Math.round(team.reduce((sum, p) => sum + p.level, 0) / Math.max(1, team.length))
      const targetLevel = difficulty === 'infinite' ? getInfiniteTargetLevel() : avgPlayerLevel
      const picks: Pokemon[] = []
      const used = new Set<number>()
      for (let attempt = 0; attempt < 14 && picks.length < 3; attempt++) {
        const base = await getBalancedPokemonByGeneration(
          targetGen, routeIndex, route.length, false, runChallenges.allShiny,
          balDiff(difficulty), -1, getStageProgression(), targetLevel,
        )
        if (used.has(base.id)) continue
        used.add(base.id)
        const levelDiff = targetLevel - base.level
        let scaled = scalePokemonForNode(base, node, routeIndex, levelDiff, balDiff(difficulty))
        if (runChallenges.fixedLevel) scaled = { ...scaled, level: 50 }
        picks.push(scaled)
      }
      setSafariChoices(picks)
    } catch {
      setApiError('No se pudo preparar el Safari.')
    } finally {
      setSafariLoading(false)
    }
  }

  function selectSafariPokemon(pokemon: Pokemon): void {
    playSelect()
    setSafariSelected(pokemon)
    setSafariMood(55 + Math.floor(Math.random() * 21))
    setSafariBonus(0)
    setSafariPetCount(0)
    setSafariThreat(0)
    const balls = safariAvailableBalls()
    setSafariSelectedBall(balls[0] ?? '')
    setSafariLog([`Has elegido una silueta... ¡es ${pokemon.name}!`])
  }

  function safariPokemonAttack(): void {
    if (!safariSelected) return
    if (!activePokemon || activePokemon.hp <= 0) {
      setSafariLog(prev => [`⚠️ ¡${safariSelected.name} se siente amenazado!`, ...prev].slice(0, 6))
      return
    }
    const damagingMoves = safariSelected.moves.filter(m => (m.power ?? 0) > 0)
    const move = damagingMoves.length > 0
      ? damagingMoves[Math.floor(Math.random() * damagingMoves.length)]
      : null
    if (!move) {
      setSafariLog(prev => [`⚠️ ¡${safariSelected.name} te mira con desconfianza!`, ...prev].slice(0, 6))
      return
    }
    const res = applyDamage(safariSelected, activePokemon, move)
    const defTypes = activePokemon.types ?? ['normal']
    const { effectiveness } = getTypeEffectiveness(move.type, defTypes[0] || 'normal', defTypes[1])
    const stab = safariSelected.types?.includes(move.type) ? 1.5 : 1
    const damage = Math.max(1, Math.floor((Number.isFinite(res.damage) ? res.damage : 3) * Math.max(0.25, effectiveness) * stab))
    const newHp = Math.max(1, activePokemon.hp - damage)
    setTeam(prev => prev.map((p, i) => i === activeIndex ? { ...p, hp: newHp } : p))
    setSafariMood(prev => Math.max(0, prev - 5))
    setSafariThreat(0)
    setSafariLog(prev => [`⚠️ ¡${safariSelected.name} se sintió amenazado y usó ${moveName(move)}! ${activePokemon.name} perdió ${damage} HP.`, ...prev].slice(0, 6))
  }

  function petSafariPokemon(): void {
    if (!safariSelected) return
    const profile = safariNatureProfile(safariSelected)
    const nextPet = safariPetCount + 1
    const overTolerance = Math.max(0, nextPet - profile.tolerance)
    const goodChance = Math.max(0.10, Math.min(0.94,
      0.58 + (safariMood - 50) / 250 - overTolerance * 0.16
      + (profile.tolerance >= 5 ? 0.08 : profile.tolerance <= 2 ? -0.08 : 0)
    ))
    const good = Math.random() < goodChance
    const moodDelta = good ? 8 + Math.floor(Math.random() * 8) : -(10 + Math.floor(Math.random() * 10))
    const bonusDelta = good ? 5 + Math.floor(Math.random() * 5) : -(5 + Math.floor(Math.random() * 5))
    const nextMood = Math.max(0, Math.min(100, safariMood + moodDelta))
    const nextThreat = good ? Math.max(0, safariThreat - 8) : safariThreat + 20
    setSafariPetCount(nextPet)
    setSafariMood(nextMood)
    setSafariBonus(prev => Math.max(0, Math.min(60, prev + bonusDelta)))
    setSafariThreat(nextThreat)
    setSafariLog(prev => [
      good
        ? `💚 A ${safariSelected.name} le gusta la caricia (${profile.label}). Humor ${nextMood}%.`
        : `💢 A ${safariSelected.name} no le gusta la caricia (${profile.label}). Humor ${nextMood}%.`,
      ...prev,
    ].slice(0, 6))
    if (good) playSelect()
    else playError()
    if (!good && (nextMood < 25 || nextThreat >= 60)) {
      setTimeout(() => safariPokemonAttack(), 350)
    }
  }

  function throwSafariBall(): void {
    if (!safariSelected) return
    const balls = safariAvailableBalls()
    const ballName = safariSelectedBall || balls[0]
    if (!ballName) {
      setSafariLog(prev => ['🎒 No tienes Poké Balls. Puedes seguir acariciando o salir del Safari.', ...prev].slice(0, 6))
      playError()
      return
    }
    const ballIndex = inventory.indexOf(ballName)
    if (ballIndex === -1) return
    const chance = safariCaptureChance(ballName)
    const nextInventory = [...inventory]
    nextInventory.splice(ballIndex, 1)
    setInventory(nextInventory)
    setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
    if (!nextInventory.some(item => POKEBALL_NAMES.includes(item))) setSafariSelectedBall('')
    else if (!nextInventory.includes(ballName)) {
      setSafariSelectedBall(nextInventory.find(item => POKEBALL_NAMES.includes(item)) ?? '')
    }

    if (Math.random() < chance) {
      const hpBonus = modifier?.playerMaxHpBonus ?? 0
      let captured: Pokemon = {
        ...safariSelected,
        maxHp: safariSelected.maxHp + hpBonus,
        hp: safariSelected.maxHp + hpBonus,
        holdItem: (difficulty === 'hard' || difficulty === 'infinite') ? null : safariSelected.holdItem,
      }
      if (runChallenges.noEvolution) captured = applyNoEvolutionBuff(captured)
      if (runChallenges.fixedLevel) captured = { ...captured, level: 50 }
      registerInPokedex(captured)
      setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
      if (captured.shiny) unlockAchievement('shiny_catch')
      if ((captured.attack + captured.defense + captured.speed + captured.maxHp) >= 600) unlockAchievement('legendary_catch')
      if (!teamHasRoom(team)) {
        setPcStorage(prev => [...prev, captured])
        setBattleLog(prev => [t('b.capturedPC', { name: captured.name }), ...prev].slice(0, 15))
      } else {
        setTeam(prev => [...prev, captured])
        setBattleLog(prev => [t('b.captured', { name: captured.name }), ...prev].slice(0, 15))
      }
      playCapture()
      captureSummaryCompleteNodeRef.current = true
      setCaptureSummary(captured)
      setSafariLog(prev => [`🏆 ¡${captured.name} fue capturado con ${ballName}!`, ...prev].slice(0, 6))
      return
    }

    const nextMood = Math.max(0, safariMood - 12)
    const nextThreat = safariThreat + 25
    setSafariMood(nextMood)
    setSafariThreat(nextThreat)
    setSafariBonus(prev => Math.max(0, prev - 5))
    setSafariLog(prev => [`💨 ¡${safariSelected.name} se soltó de la ${ballName}!`, ...prev].slice(0, 6))
    playError()
    if (nextMood < 25 || nextThreat >= 60) {
      setTimeout(() => safariPokemonAttack(), 350)
    }
  }

  // --- Huerto de Bayas ---
  function orchardAvailableBerries(): string[] {
    return Array.from(new Set(inventory.filter(item => BERRY_DROPS.includes(item))))
  }

  function addOrchardBerry(name: string): void {
    if (orchardSelected.length >= 3) return
    const owned = inventory.filter(item => item === name).length
    const chosen = orchardSelected.filter(item => item === name).length
    if (chosen >= owned) return
    setOrchardSelected(prev => [...prev, name])
  }

  function removeOrchardBerry(name: string): void {
    setOrchardSelected(prev => {
      const idx = prev.lastIndexOf(name)
      if (idx === -1) return prev
      const next = [...prev]
      next.splice(idx, 1)
      return next
    })
  }

  function plantOrchardBerries(): void {
    if (orchardSelected.length === 0 || orchardPlanted.length > 0) return
    const planted = [...orchardSelected]
    setInventory(prev => {
      const next = [...prev]
      for (const berry of planted) {
        const idx = next.indexOf(berry)
        if (idx !== -1) next.splice(idx, 1)
      }
      return next
    })
    setOrchardPlanted(planted)
    setOrchardPlantedNodeId(currentNode?.id ?? null)
    setOrchardSelected([])
    setOrchardPlantModal(false)
    playSelect()
    setBattleLog(prev => [
      `🫐 Plantaste ${planted.length} baya${planted.length === 1 ? '' : 's'}: ${Array.from(new Set(planted)).map(itemLocalizedName).join(', ')}.`,
      ...prev,
    ].slice(0, 15))
  }

  function harvestOrchard(): void {
    if (orchardPlanted.length === 0) return
    // En el mismo Huerto donde se plantaron, solo se recuperan exactamente las
    // bayas plantadas. Las bayas extra solo se obtienen en un Huerto posterior.
    const sameNode = orchardPlantedNodeId !== null && currentNode?.id === orchardPlantedNodeId
    const extras: string[] = []
    if (!sameNode) {
      const pool = BERRY_DROPS.filter(isBerryUnlocked)
      for (let i = orchardPlanted.length; i < 3; i++) {
        extras.push(pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : 'Oran Berry')
      }
    }
    const harvest = sameNode ? [...orchardPlanted] : [...orchardPlanted, ...extras].slice(0, 3)
    setInventory(prev => [...prev, ...harvest])
    setOrchardPlanted([])
    setOrchardPlantedNodeId(null)
    const grouped = new Map<string, number>()
    for (const berry of harvest) grouped.set(berry, (grouped.get(berry) ?? 0) + 1)
    setOrchardHarvest(Array.from(grouped.entries()).map(([name, count]) => ({ name, count })))
    playCapture()
    setBattleLog(prev => [
      `🫐 Cosechaste ${harvest.length} baya${harvest.length === 1 ? '' : 's'} del Huerto.`,
      ...prev,
    ].slice(0, 15))
  }

  // --- Guardería ---
  async function prepareDaycareEgg(): Promise<void> {
    setDaycareLoading(true)
    try {
      const ids = (await getSpeciesIdsByGeneration(getEffectiveGen()))
        .filter(id => !ALL_LEGENDARIES.includes(id))
      if (ids.length === 0) return
      const randomId = ids[Math.floor(Math.random() * ids.length)]
      const baseId = await getFirstStageSpeciesId(randomId)
      const shiny = runChallenges.allShiny || Math.random() < 0.03
      let pokemon = await buildPokemonFromApi(
        baseId, getEffectiveGen(), 10, shiny, balDiff(difficulty), true,
      )
      pokemon = { ...pokemon, level: 10, hp: pokemon.maxHp, holdItem: null }
      const totalNodes = 5
      setDaycareEgg({ pokemon, nodesLeft: totalNodes, totalNodes })
      playSelect()
    } catch {
      setApiError('No se pudo preparar el huevo de la Guardería.')
    } finally {
      setDaycareLoading(false)
    }
  }

  function advanceDaycareEgg(): void {
    if (!daycareEgg) return
    if (currentNode?.type === 'daycare') return
    const nextLeft = daycareEgg.nodesLeft - 1
    if (nextLeft > 0) {
      setDaycareEgg({ ...daycareEgg, nodesLeft: nextLeft })
      return
    }
    const hatched: Pokemon = {
      ...daycareEgg.pokemon,
      level: 10,
      hp: daycareEgg.pokemon.maxHp,
      holdItem: null,
    }
    setDaycareEgg(null)
    registerInPokedex(hatched)
    setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
    if (hatched.shiny) unlockAchievement('shiny_catch')
    if ((hatched.attack + hatched.defense + hatched.speed + hatched.maxHp) >= 600) unlockAchievement('legendary_catch')
    const placement: 'team' | 'pc' = team.length >= maxTeamSize ? 'pc' : 'team'
    if (placement === 'pc') setPcStorage(prev => [...prev, hatched])
    else setTeam(prev => [...prev, hatched])
    setEggHatchPlacement(placement)
    setEggHatch(hatched)
    playCapture()
    setBattleLog(prev => [
      `🥚 ¡El huevo ha eclosionado! Ha nacido ${hatched.name}${hatched.shiny ? ' ✨' : ''}.`,
      ...prev,
    ].slice(0, 15))
  }

  // --- Mina ---
  function clearMiningTimers(): void {
    if (miningTimerRef.current) clearTimeout(miningTimerRef.current)
    if (miningRevealTimerRef.current) clearTimeout(miningRevealTimerRef.current)
    miningTimerRef.current = null
    miningRevealTimerRef.current = null
  }

  function digMine(): void {
    if (miningBusy || miningDigs >= 3) return
    clearMiningTimers()
    setMiningBusy(true)
    setMiningDigs(prev => prev + 1)
    setMiningMessage('⛏️ Excavando...')
    playClick()
    const delay = 650 / Math.max(1, accessibility.battleSpeed)
    miningTimerRef.current = setTimeout(() => {
      const pool = TREASURE_DROPS.filter(isConsumableUnlocked)
      const found = pool.length > 0 && Math.random() < 0.6
        ? pool[Math.floor(Math.random() * pool.length)]
        : null
      if (found) {
        setInventory(prev => [...prev, found])
        setMiningReveal(found)
        setMiningMessage(`¡Has encontrado ${itemLocalizedName(found)}!`)
        playCoin()
        miningRevealTimerRef.current = setTimeout(() => setMiningReveal(null), 1800)
      } else {
        setMiningMessage(pool.length === 0
          ? 'No tienes ningún tesoro desbloqueado en la Tienda Meta.'
          : 'Solo has encontrado piedras...')
        playError()
      }
      setMiningBusy(false)
    }, delay)
  }

  // --- Pesca ---
  function clearFishingTimers(): void {
    if (fishingTimersRef.current.bite) clearTimeout(fishingTimersRef.current.bite)
    if (fishingTimersRef.current.escape) clearTimeout(fishingTimersRef.current.escape)
    fishingTimersRef.current = {}
  }

  async function prepareFishing(): Promise<void> {
    clearFishingTimers()
    setFishingLoading(true)
    setFishingEncounter(null)
    setFishingPhase('idle')
    setFishingBusy(false)
    setFishingMessage('')
    try {
      const waterIds = new Set((await getSpeciesIdsByPrimaryType('water'))
        .filter(id => !ALL_LEGENDARIES.includes(id)))
      if (waterIds.size === 0) waterIds.add(129)
      const avgLevel = team.length > 0
        ? Math.round(team.reduce((sum, p) => sum + p.level, 0) / team.length)
        : 1
      const targetLevel = difficulty === 'infinite' ? getInfiniteTargetLevel() : Math.max(1, avgLevel)
      const shiny = runChallenges.allShiny || Math.random() < 0.05
      let caught = await getBalancedPokemonByGeneration(
        getEffectiveGen(), routeIndex, route.length, false, shiny,
        balDiff(difficulty), -1, getStageProgression(), targetLevel, false, waterIds,
      )
      caught = {
        ...caught,
        hp: caught.maxHp,
        holdItem: (difficulty === 'hard' || difficulty === 'infinite') ? null : caught.holdItem,
      }
      if (runChallenges.noEvolution) caught = applyNoEvolutionBuff(caught)
      if (runChallenges.fixedLevel) caught = { ...caught, level: 50 }
      setFishingEncounter(caught)
    } catch {
      setApiError('No se pudo preparar la Pesca.')
    } finally {
      setFishingLoading(false)
    }
  }

  function castFishingLine(): void {
    if (fishingPhase === 'waiting' || fishingPhase === 'bite') return
    if (fishingAttempts >= 3 || fishingLoading || fishingBusy) return
    setFishingAttempts(prev => prev + 1)
    setFishingPhase('waiting')
    setFishingMessage('Has lanzado la caña. Espera a que algo pique...')
    playClick()
    clearFishingTimers()
    fishingTimersRef.current.bite = setTimeout(() => {
      setFishingPhase('bite')
      setFishingMessage('¡Pica! ¡Tira de la caña ahora!')
      playHit()
      fishingTimersRef.current.escape = setTimeout(() => {
        setFishingPhase('missed')
        setFishingMessage('Se ha escapado... vuelve a intentarlo.')
        playError()
      }, 900)
    }, 1100 + Math.random() * 1900)
  }

  function reelFishingLine(): void {
    if (fishingPhase !== 'bite' || !fishingEncounter || fishingBusy) return
    clearFishingTimers()
    setFishingBusy(true)
    setFishingPhase('caught')
    const caught = fishingEncounter
    registerInPokedex(caught)
    setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
    if (caught.shiny) unlockAchievement('shiny_catch')
    if ((caught.attack + caught.defense + caught.speed + caught.maxHp) >= 600) unlockAchievement('legendary_catch')
    if (!teamHasRoom(team)) {
      setPcStorage(prev => [...prev, caught])
      setBattleLog(prev => [t('b.capturedPC', { name: caught.name }), ...prev].slice(0, 15))
    } else {
      setTeam(prev => [...prev, caught])
      setBattleLog(prev => [t('b.captured', { name: caught.name }), ...prev].slice(0, 15))
    }
    playCapture()
    setFishingMessage(`¡Has pescado a ${caught.name}!`)
    captureSummaryCompleteNodeRef.current = true
    setCaptureSummary(caught)
  }

  async function reviveFossil(fossil: FossilOption): Promise<void> {
    if (fossilBusy) return
    if (runChallenges.soloStarter || runChallenges.fixedTeam) {
      setBattleLog((prev) => [t('b.noModifyTeam'), ...prev].slice(0, 15))
      completeCurrentNode()
      return
    }
    setFossilBusy(true)
    try {
      const avgLevel = team.length > 0
        ? Math.round(team.reduce((sum, p) => sum + p.level, 0) / team.length)
        : 1
      const targetLevel = difficulty === 'infinite'
        ? getInfiniteTargetLevel()
        : Math.max(1, avgLevel)
      let revived = await buildPokemonFromApi(
        fossil.speciesId, getEffectiveGen(), targetLevel,
        runChallenges.allShiny, balDiff(difficulty), true,
      )
      revived = {
        ...revived,
        hp: revived.maxHp,
        holdItem: null,
      }
      if (runChallenges.noEvolution) revived = applyNoEvolutionBuff(revived)
      if (runChallenges.fixedLevel) revived = { ...revived, level: 50 }
      registerInPokedex(revived)
      setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
      if (revived.shiny) unlockAchievement('shiny_catch')
      if ((revived.attack + revived.defense + revived.speed + revived.maxHp) >= 600) unlockAchievement('legendary_catch')
      if (!teamHasRoom(team)) {
        setPcStorage(prev => [...prev, revived])
        setBattleLog(prev => [t('b.capturedPC', { name: revived.name }), ...prev].slice(0, 15))
      } else {
        setTeam(prev => [...prev, revived])
        setBattleLog(prev => [t('b.captured', { name: revived.name }), ...prev].slice(0, 15))
      }
      playCapture()
      captureSummaryCompleteNodeRef.current = true
      setCaptureSummary(revived)
    } catch {
      setBattleLog(prev => ['🦖 No se pudo revivir el fósil. Inténtalo de nuevo.', ...prev].slice(0, 15))
    } finally {
      setFossilBusy(false)
    }
  }

  function casinoRewardForScore(score: number): { label: string; money: number; item: string | null } {
    const unlockedItems = Object.keys(ALL_SHOP_ITEMS).filter(i => isConsumableUnlocked(i))
    const unlockedHoldables = HOLDABLE_ITEM_NAMES.filter(isHoldableUnlocked)
    const unlockedStones = EVOLUTION_STONES.filter(s => isEvolutionStoneUnlocked(s))
    if (score >= 800) {
      const rareItems = unlockedItems.filter(i => i === 'Master Ball' || i === 'Max Revive' || i === 'Full Restore' || i === 'Full Elixir')
      const pool = [...(rareItems.length > 0 ? rareItems : ['Ultra Ball']), ...(unlockedHoldables.length > 0 ? [unlockedHoldables[Math.floor(Math.random() * unlockedHoldables.length)]] : [])]
      const item = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : 'Ultra Ball'
      return { label: t('casino.jackpot'), money: 600, item }
    }
    if (score >= 400) {
      const goodItems = ['Ultra Ball', 'Hyper Potion', 'Revive', 'Max Revive', 'Elixir'].filter(i => unlockedItems.includes(i))
      const holdable = unlockedHoldables.length > 0 ? [unlockedHoldables[Math.floor(Math.random() * unlockedHoldables.length)]] : []
      const pool = [...goodItems, ...holdable]
      const item = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
      return { label: t('casino.greatPrize'), money: 300, item }
    }
    if (score >= 200) {
      const goodItems = ['Great Ball', 'Super Potion', 'Lum Berry', 'Full Heal'].filter(i => unlockedItems.includes(i))
      const stone = unlockedStones.length > 0 ? [unlockedStones[Math.floor(Math.random() * unlockedStones.length)]] : []
      const pool = [...goodItems, ...stone]
      const item = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
      return { label: t('casino.goodPrize'), money: 150, item }
    }
    const basicItems = ['Poké Ball', 'Potion', ...BERRY_DROPS.filter(isBerryUnlocked)].filter(i => unlockedItems.includes(i) || isHoldableUnlocked(i))
    const item = basicItems.length > 0 ? basicItems[Math.floor(Math.random() * basicItems.length)] : null
    return { label: t('casino.consolation'), money: 60, item }
  }

  function casinoComplete(score: number): void {
    if (casinoPlayed) return
    setCasinoPlayed(true)
    const reward = casinoRewardForScore(score)
    setCasinoScore(score)
    setCasinoReward(reward)
  }

  function claimCasinoReward(): void {
    if (casinoScore === null || casinoReward === null) return
    const { money: rewardMoney, item } = casinoReward
    const grantedMoney = runChallenges.noMoney ? 0 : rewardMoney
    if (!runChallenges.noMoney) setMoney(prev => prev + grantedMoney)
    if (item) setInventory(prev => [...prev, item])
    setBattleLog((prev) => [
      t('casino.logReward', { label: casinoReward.label, money: grantedMoney, item: item ? ` y ${item}.` : '.' }),
      ...prev
    ].slice(0, 15))
    completeCurrentNode()
    setScreen('route')
  }

  function skipCasino(): void {
    setBattleLog((prev) => [t('b.casinoLeft'), ...prev].slice(0, 15))
    completeCurrentNode()
    setScreen('route')
  }

  async function openMoveTutor(fromItem: boolean): Promise<void> {
    setIsLoading(true)
    setApiError('')
    setSelectedNewMove(null)
    setMoveOptionsByIndex({})
    try {
      const pokemon = team[activeIndex]
      if (!pokemon || !pokemon.rawLevelUpMoves || pokemon.rawLevelUpMoves.length === 0) {
        setBattleLog((prev) => [t('b.noMovesToLearn'), ...prev].slice(0, 15))
        if (fromItem) {
          setScreen('route')
        } else {
          completeCurrentNode()
          setScreen('route')
        }
        return
      }
      const currentMoveUrls = new Set(pokemon.moves.map(m => m.url).filter(Boolean))
      const learnable = pokemon.rawLevelUpMoves.filter(m => !currentMoveUrls.has(m.url))
      const pool = learnable.length >= 2 ? learnable : [...learnable, ...pokemon.rawLevelUpMoves.filter(m => currentMoveUrls.has(m.url))]
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 10)
      const allDetails = (await Promise.all(shuffled.map(m => getMoveDetails(m.url)))).filter((m): m is Move => m !== null)
      const moveDetails = allDetails.slice(0, 2)
      if (moveDetails.length === 0) {
        setBattleLog((prev) => [t('b.noMovesCompat'), ...prev].slice(0, 15))
        if (fromItem) {
          setScreen('route')
        } else {
          completeCurrentNode()
          setScreen('route')
        }
        return
      }
      moveFromItemRef.current = fromItem
      if (fromItem) {
        setBattleLog((prev) => [t('b.tmUsed', { name: pokemon.name }), ...prev].slice(0, 15))
      }
      setMoveOptions(moveDetails)
      setMoveOptionsByIndex({ [activeIndex]: moveDetails })
      setScreen('move')
    } catch {
      setApiError('No se pudieron cargar los movimientos. Reintenta.')
      if (fromItem) setScreen('route')
    } finally {
      setIsLoading(false)
    }
  }

  function replaceTeamMove(moveIndex: number): void {
    if (!selectedNewMove || !activePokemon) return
    const fromItem = moveFromItemRef.current
    const nextTeam = team.map((pokemon, index) => {
      if (index !== activeIndex) return pokemon
      const newMoves = [...pokemon.moves]
      newMoves[moveIndex] = selectedNewMove
      return { ...pokemon, moves: newMoves }
    })
    setTeam(nextTeam)
    setBattleLog((prev) => [
      `${fromItem ? '💿' : '📝'} ${activePokemon.name} ${t('move.replaced')} ${moveName(activePokemon.moves[moveIndex])} ${t('move.with')} ${moveName(selectedNewMove)} ${fromItem ? t('move.withDisco') : t('move.withTutor')}!`,
      ...prev
    ].slice(0, 15))
    setMoveOptions([])
    setSelectedNewMove(null)
    setMoveOptionsByIndex({})
    moveFromItemRef.current = false
    if (fromItem) {
      setInventory((prev) => {
        const idx = prev.indexOf('Disco MT')
        if (idx === -1) return prev
        return prev.filter((_, i) => i !== idx)
      })
      setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
      setScreen('route')
    } else {
      completeCurrentNode()
      setScreen('route')
    }
  }

  function skipMoveNode(): void {
    const fromItem = moveFromItemRef.current
    setBattleLog((prev) => [
      fromItem ? t('b.moveSkipTM') : t('b.moveSkipTutor'),
      ...prev
    ].slice(0, 15))
    setMoveOptions([])
    setSelectedNewMove(null)
    setMoveOptionsByIndex({})
    moveFromItemRef.current = false
    if (fromItem) {
      setScreen('route')
    } else {
      completeCurrentNode()
      setScreen('route')
    }
  }

  function buyShopItem(itemName: string, qty = 1) {
    if (runChallenges.noPurchasing) {
      setBattleLog((prev) => [t('b.challengeNoBuying'), ...prev].slice(0, 15))
      return
    }
    const item = ALL_SHOP_ITEMS[itemName]
    if (!item) return
    const alreadyBought = shopBoughtCount[itemName] ?? 0
    if (alreadyBought + qty > shopBuyAllowance) {
      setBattleLog((prev) => [t('b.shopSoldOut'), ...prev].slice(0, 15))
      return
    }
    const discount = modifier?.shopDiscount ?? 0
    const hardMarkup = (difficulty === 'hard' || difficulty === 'infinite') ? 1.4 : 1
    const stageMarkup = 1 + badges.length * 0.15
    const finalPrice = Math.floor(item.price * (1 - discount) * hardMarkup * stageMarkup)
    const total = finalPrice * qty
    if (money < total) { playError(); return }

    playPurchase()

    setMoney((prev) => prev - total)
    setInventory((prev) => [...prev, ...Array(qty).fill(itemName)])
    setShopBoughtCount((prev) => ({ ...prev, [itemName]: (prev[itemName] ?? 0) + qty }))
    setRunStats(prev => ({ ...prev, moneySpent: prev.moneySpent + total }))
    setBattleLog((prev) => [t('b.bought', { qty, item: itemLocalizedName(itemName), total }), ...prev].slice(0, 15))
  }

  function buyHoldableItem(itemName: string) {
    if (runChallenges.noPurchasing) {
      setBattleLog((prev) => [t('b.challengeNoBuying'), ...prev].slice(0, 15))
      return
    }
    const alreadyBought = shopBoughtCount[itemName] ?? 0
    if (alreadyBought >= shopBuyAllowance) {
      setBattleLog((prev) => [t('b.shopSoldOut'), ...prev].slice(0, 15))
      return
    }
    if (HOLDABLE_ITEM_NAMES.includes(itemName)) {
      const holdableIdx = inventory.indexOf(itemName)
      if (holdableIdx !== -1) {
        setEquipModal({ itemName, itemIndex: holdableIdx })
        return
      }
    }
    const item = HOLDABLE_ITEMS[itemName]
    if (!item) return
    const discount = modifier?.shopDiscount ?? 0
    const hardMarkup = (difficulty === 'hard' || difficulty === 'infinite') ? 1.4 : 1
    const stageMarkup = 1 + badges.length * 0.15
    const finalPrice = Math.floor(item.price * (1 - discount) * hardMarkup * stageMarkup)
    if (money < finalPrice) { playError(); return }

    playPurchase()

    setMoney((prev) => prev - finalPrice)
    setInventory((prev) => [...prev, itemName])
    setShopBoughtCount((prev) => ({ ...prev, [itemName]: (prev[itemName] ?? 0) + 1 }))
    setRunStats(prev => ({ ...prev, moneySpent: prev.moneySpent + finalPrice }))
    setBattleLog((prev) => [t('b.bought', { qty: 1, item: itemLocalizedName(itemName), total: finalPrice }), ...prev].slice(0, 15))
  }

  function sellItems(itemName: string, qty: number) {
    if (qty <= 0) return
    const consumable = ALL_SHOP_ITEMS[itemName]
    const holdable = HOLDABLE_ITEMS[itemName]
    const data = consumable ?? holdable
    if (!data) return
    const sellPrice = Math.floor(data.price * 0.5)
    const total = sellPrice * qty

    setMoney((prev) => prev + total)
    setInventory((prev) => {
      const out: string[] = []
      let remaining = qty
      for (const i of prev) {
        if (i === itemName && remaining > 0) {
          remaining--
        } else {
          out.push(i)
        }
      }
      return out
    })
    setBattleLog((prev) => [t('b.sold', { qty, item: itemLocalizedName(itemName), total }), ...prev].slice(0, 15))
    setSellQty(prev => ({ ...prev, [itemName]: 1 }))
  }

  function equipItem(itemName: string, pokemonIndex: number) {
    const pokemon = team[pokemonIndex]
    if (!pokemon || pokemon.hp <= 0) { playError(); return }
    if (!HOLDABLE_ITEMS[itemName]) { playError(); return }

    const itemIdx = inventory.indexOf(itemName)
    if (itemIdx === -1) { playError(); return }

    playEquip()

    setTeam((prev) =>
      prev.map((p, i) => {
        if (i !== pokemonIndex) return p
        const stats = HOLDABLE_ITEMS[itemName]
        let updated: Pokemon = {
          ...p,
          holdItem: itemName,
          maxHp: p.maxHp + (stats.maxHpMod ?? 0),
          hp: Math.min(p.hp + (stats.maxHpMod ?? 0), p.maxHp + (stats.maxHpMod ?? 0)),
        }
        return updated
      })
    )
    setInventory((prev) => {
      const idx = prev.indexOf(itemName)
      if (idx === -1) return prev
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
    })
    setBattleLog((prev) => [t('b.equipped', { item: itemLocalizedName(itemName), name: pokemon.name }), ...prev].slice(0, 15))

    const syn = SYNERGIES.find(s => s.items.includes(itemName))
    if (syn) {
      const otherItem = syn.items.find(i => i !== itemName)
      const hasOtherInTeam = team.some((p, i) => i !== pokemonIndex && p.holdItem === otherItem)
      if (hasOtherInTeam) {
        setBattleLog((prev) => [t('b.synergy', { name: syn.name, desc: syn.desc }), ...prev].slice(0, 15))
        unlockAchievement('synergy_master')
      }
    }
  }

  function unequipItem(pokemonIndex: number) {
    const pokemon = team[pokemonIndex]
    if (!pokemon || !pokemon.holdItem) return

    const itemName = pokemon.holdItem
    const stats = HOLDABLE_ITEMS[itemName]

    setTeam((prev) =>
      prev.map((p, i) => {
        if (i !== pokemonIndex) return p
        return {
          ...p,
          holdItem: null,
          maxHp: Math.max(1, p.maxHp - (stats?.maxHpMod ?? 0)),
          hp: p.hp <= 0 ? 0 : Math.min(p.hp, p.maxHp - (stats?.maxHpMod ?? 0)),
        }
      })
    )
    setInventory((prev) => [...prev, itemName])
    setBattleLog((prev) => [t('b.unequipped', { item: itemLocalizedName(itemName), name: pokemon.name }), ...prev].slice(0, 15))
  }

  function processStatusTick(p: Pokemon): { updatedPokemon: Pokemon; skipTurn: boolean; log: string[] } {
    // Pereza (Truant): alterna un turno de acción y otro de descanso.
    if (p.ability === 'truant') {
      const active = (p.abilityState?.truant ?? 0) === 0
      if (!active) {
        return {
          updatedPokemon: { ...p, abilityState: { ...(p.abilityState ?? {}), truant: 0 } },
          skipTurn: true,
          log: [t('b.abilityTruant', { name: p.name })],
        }
      }
      p = { ...p, abilityState: { ...(p.abilityState ?? {}), truant: 1 } }
    }
    // Hierba Mental: cura una anulación o confusión una vez.
    if (p.holdItem && HOLDABLE_ITEMS[p.holdItem]?.mentalHerb && (p.disabled || p.status?.type === 'confusion')) {
      const curedStatus = p.status?.type === 'confusion' ? undefined : p.status
      return {
        updatedPokemon: { ...p, disabled: undefined, status: curedStatus, holdItem: undefined },
        skipTurn: false,
        log: [t('b.itemMentalHerb', { name: p.name, item: itemLocalizedName(p.holdItem) })],
      }
    }
    if (!p.status) return { updatedPokemon: p, skipTurn: false, log: [] }

    const logs: string[] = []
    let updated = { ...p }
    let skipTurn = false

    switch (p.status.type) {
      case 'burn': {
        if (isIndirectDamageImmune(updated)) break
        const burnDmg = getBurnDamage(updated, Math.max(1, Math.floor(p.maxHp / 16)))
        updated = { ...updated, hp: Math.max(0, updated.hp - burnDmg) }
        logs.push(t('b.burn', { name: updated.name, dmg: burnDmg }))
        break
      }
      case 'poison': {
        if (updated.ability === 'poison-heal') {
          const heal = Math.max(1, Math.floor(updated.maxHp / 8))
          updated = { ...updated, hp: Math.min(updated.maxHp, updated.hp + heal) }
          logs.push(t('b.abilityWeatherHeal', { name: updated.name, hp: heal, ability: abilityName('poison-heal', getLanguage()) }))
          break
        }
        if (isIndirectDamageImmune(updated)) break
        const poisonDmg = Math.max(1, Math.floor(p.maxHp / 8))
        updated = { ...updated, hp: Math.max(0, updated.hp - poisonDmg) }
        logs.push(t('b.poison', { name: updated.name, dmg: poisonDmg }))
        break
      }
      case 'paralysis': {
        if (Math.random() < 0.25) {
          skipTurn = true
          logs.push(t('b.paralysis', { name: updated.name }))
        }
        break
      }
      case 'freeze': {
        if (Math.random() < 0.20) {
          updated = { ...updated, status: undefined }
          logs.push(t('b.thawed', { name: updated.name }))
        } else {
          skipTurn = true
          logs.push(t('b.freeze', { name: updated.name }))
        }
        break
      }
      case 'sleep': {
        const remaining = (p.status.turns ?? 2) - getSleepTick(p)
        if (remaining <= 0) {
          updated = { ...updated, status: undefined }
          logs.push(t('b.wokeUp', { name: updated.name }))
        } else {
          updated = { ...updated, status: { ...updated.status!, turns: remaining } }
          skipTurn = true
          logs.push(t('b.sleep', { name: updated.name }))
        }
        break
      }
      case 'confusion': {
        const remaining = (p.status.turns ?? 3) - 1
        if (remaining <= 0) {
          updated = { ...updated, status: undefined }
          logs.push(t('b.unconfused', { name: updated.name }))
        } else {
          updated = { ...updated, status: { ...updated.status!, turns: remaining } }
        }
        break
      }
      case 'flinch': {
        skipTurn = true
        updated = { ...updated, status: undefined }
        logs.push(t('b.flinch', { name: updated.name }))
        if (updated.ability === 'steadfast') {
          const stages = updated.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
          if (stages.speed < 6) {
            updated = { ...updated, statStages: { ...stages, speed: stages.speed + 1 } }
            logs.push(t('b.abilitySpeedBoost', { name: updated.name, ability: abilityName('steadfast', getLanguage()) }))
          }
        }
        break
      }
    }

    if (updated.hp <= 0) {
      updated = { ...updated, hp: 0 }
      logs.push(t('b.debilitatedStatus', { name: updated.name }))
    }

    return { updatedPokemon: updated, skipTurn, log: logs }
  }

  function applyAilmentToTarget(target: Pokemon, move: Move): Pokemon {
    if (!move.ailment) return target
    if (target.status) return target
    // Habilidades de inmunidad a estados (todas las del catálogo).
    if (getAbilityStatusImmune(target, move.ailment, weather, !isWeatherSuppressed(target))) return target
    // Si el movimiento trae afección pero no chance (p. ej. Polvo Veneno con
    // ailment_chance 0 en PokeAPI), se aplica garantizada.
    const chance = move.ailmentChance ?? 1
    if (Math.random() >= chance) return target

    const ailmentTurns: Record<StatusType, number> = {
      burn: 999,
      poison: 999,
      paralysis: 999,
      freeze: 999,
      sleep: Math.floor(Math.random() * 2) + 2,
      confusion: Math.floor(Math.random() * 3) + 2,
      flinch: 1,
    }

    return {
      ...target,
      status: { type: move.ailment, turns: ailmentTurns[move.ailment] },
    }
  }

  // Efectos de habilidades al ENTRAR en combate: Intimidación baja el Ataque
  // del rival y los creadores de clima establecen el clima de la batalla.
  const applyEntryAbilities = useCallback((entering: Pokemon, opponent: Pokemon): { opponentUpdated: Pokemon; logs: string[] } => {
    const logs: string[] = []
    let opp = opponent
    const ability = entering.ability
    if (hasAbility(entering, 'intimidate') && opp.hp > 0) {
      const stages = opp.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
      if (hasAbility(opp, 'guard-dog')) {
        if (stages.attack < 6) {
          opp = { ...opp, statStages: { ...stages, attack: Math.min(6, stages.attack + 1) } }
          logs.push(t('b.abilityEntryStat', { name: opp.name, ability: abilityName('guard-dog', getLanguage()), stat: t('stat.attack') }))
        }
      } else if (stages.attack > -6 && !getAbilityStatDropBlocked(opp, 'attack') && !HOLDABLE_ITEMS[opp.holdItem ?? '']?.statDropImmune) {
        opp = { ...opp, statStages: { ...stages, attack: stages.attack - 1 } }
        logs.push(t('b.abilityIntimidate', { name: entering.name, target: opp.name, ability: abilityName(ability, getLanguage()) }))
        const reaction = applyAbilityStatDropReaction(opp, -1, 'attack')
        opp = reaction.pokemon
        logs.push(...reaction.logs)
        if (HOLDABLE_ITEMS[opp.holdItem ?? '']?.whiteHerb) {
          const restored = { ...(opp.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }) }
          for (const key of ['attack', 'defense', 'spAttack', 'spDefense', 'speed'] as const) {
            if (restored[key] < 0) restored[key] = 0
          }
          opp = { ...opp, statStages: restored, holdItem: undefined }
          logs.push(t('b.itemWhiteHerb', { name: opp.name, item: itemLocalizedName('Hierba Blanca') }))
        }
      }
    }
    const weatherToSet = ability ? WEATHER_SETTERS[ability] : undefined
    if (weatherToSet && weatherToSet !== weather) {
      setWeather(weatherToSet)
      unlockAchievement('weather_setter')
      logs.push(t('b.abilityWeather', { name: entering.name, weather: weatherName(weatherToSet, getLanguage()) }))
    }
    if (hasAbility(entering, 'supersweet-syrup') && opp.hp > 0) {
      const stages = opp.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
      if (stages.speed > -6) {
        opp = { ...opp, statStages: { ...stages, speed: stages.speed - 1 } }
        logs.push(t('b.abilityEntryDrop', { name: entering.name, target: opp.name, stat: t('stat.speed'), ability: abilityName(ability, getLanguage()) }))
      }
    }
    return { opponentUpdated: opp, logs }
  }, [weather])

  // Efectos de habilidades y clima al FINAL del turno (compartido entre el
  // combate normal y los combates dobles).
  function applyTurnAbilities(p: Pokemon, logs: string[], opponent?: Pokemon, forcedSuppressed = false): Pokemon {
    let updated = { ...p }
    if (updated.hp <= 0) return updated
    const suppressed = forcedSuppressed || isWeatherSuppressed(updated, opponent)
    const turnWeather: WeatherKind = suppressed ? 'none' : weather
    // Impulso (Speed Boost): +1 Velocidad al final del turno.
    if (hasAbility(updated, 'speed-boost')) {
      const stages = updated.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
      if (stages.speed < 6) {
        updated = { ...updated, statStages: { ...stages, speed: stages.speed + 1 } }
        logs.push(t('b.abilitySpeedBoost', { name: updated.name, ability: abilityName(updated.ability, getLanguage()) }))
      }
    }
    // Daño de clima (arena y granizo). Las Gafas Protectoras lo anulan.
    const turnItem = updated.holdItem ? HOLDABLE_ITEMS[updated.holdItem] : null
    const chip = turnItem?.weatherImmune ? 0 : weatherChipDmg(updated, turnWeather)
    if (chip > 0) {
      updated = { ...updated, hp: Math.max(0, updated.hp - chip) }
      logs.push(t('b.weatherChip', { name: updated.name, dmg: chip, weather: weatherName(turnWeather, getLanguage()) }))
    }
    // Cura Lluvia (Rain Dish) y Piel Seca (Dry Skin) curan bajo la lluvia.
    if (turnWeather === 'rain' && (hasAbility(updated, 'rain-dish') || hasAbility(updated, 'dry-skin')) && updated.hp > 0) {
      const heal = hasAbility(updated, 'rain-dish')
        ? Math.max(1, Math.floor(updated.maxHp / 16))
        : Math.max(1, Math.floor(updated.maxHp / 8))
      updated = { ...updated, hp: Math.min(updated.maxHp, updated.hp + heal) }
      logs.push(t('b.abilityWeatherHeal', { name: updated.name, hp: heal, ability: abilityName(updated.ability, getLanguage()) }))
    }
    // Poder Solar (Solar Power): pierde HP bajo el sol.
    if (turnWeather === 'sun' && hasAbility(updated, 'solar-power') && updated.hp > 1) {
      const loss = Math.max(1, Math.floor(updated.maxHp / 8))
      updated = { ...updated, hp: Math.max(1, updated.hp - loss) }
      logs.push(t('b.abilitySolarPower', { name: updated.name, dmg: loss, ability: abilityName(updated.ability, getLanguage()) }))
    }
    // Hidratación (Hydration) cura estados bajo la lluvia.
    if (turnWeather === 'rain' && hasAbility(updated, 'hydration') && updated.status) {
      updated = { ...updated, status: undefined }
      logs.push(t('b.abilityHydration', { name: updated.name, ability: abilityName(updated.ability, getLanguage()) }))
    }
    // Mudar (Shed Skin): 1/3 de curar su estado cada turno.
    if (hasAbility(updated, 'shed-skin') && updated.status && Math.random() < 1 / 3) {
      updated = { ...updated, status: undefined }
      logs.push(t('b.abilityShedSkin', { name: updated.name, ability: abilityName(updated.ability, getLanguage()) }))
    }
    // Resto de habilidades con efecto de fin de turno.
    const extra = applyAbilityEndTurn(updated, turnWeather, opponent, !suppressed)
    updated = extra.pokemon
    logs.push(...extra.logs)
    return updated
  }

  // Al comenzar cada batalla, se aplican las habilidades de entrada de ambos
  // lados (Intimidación y creadores de clima) una sola vez por combate.
  useEffect(() => {
    if (screen === 'battle' && enemy && activePokemon && !entryAbilitiesAppliedRef.current) {
      entryAbilitiesAppliedRef.current = true
      setEscapeAttempts(0)
      const playerEntry = applyEntryAbilities(activePokemon, enemy)
      const enemyEntry = applyEntryAbilities(enemy, activePokemon)
      const playerBase = enemyEntry.opponentUpdated
      const enemyBase = playerEntry.opponentUpdated
      const playerSelf = applyAbilityEntrySelf(playerBase, enemyBase)
      const enemySelf = applyAbilityEntrySelf(enemyBase, playerSelf.entering)
      setEnemy(enemySelf.entering)
      setTeam(prev => prev.map((p, i) => i === activeIndex ? playerSelf.entering : p))
      const forcedWeather = (modifier?.forcedWeather ?? modifier2?.forcedWeather) as WeatherKind | undefined
      const logs = [...playerEntry.logs, ...enemyEntry.logs, ...playerSelf.logs, ...enemySelf.logs]
      const stationWeather = consumeWeatherStation()
      if (stationWeather) {
        setWeather(stationWeather)
        logs.push(t('b.stationWeather', { weather: weatherName(stationWeather, getLanguage()) }))
      } else if (forcedWeather) {
        setWeather(forcedWeather)
        logs.push(t('b.abilityWeather', { name: runModName('weathermania'), weather: weatherName(forcedWeather, getLanguage()) }))
      }
      if (logs.length > 0) {
        setBattleLog(prev => [...logs, ...prev].slice(0, 15))
      }
    }
  }, [screen, enemy, activePokemon, activeIndex, applyEntryAbilities, modifier, modifier2])

  function performHit(
    attacker: Pokemon,
    defender: Pokemon,
    move: Move,
    isEnemyHit: boolean,
    defenderMovedFirst = false
  ): { updatedDefender: Pokemon; updatedAttacker: Pokemon; lines: string[]; attackerHeal: number; crits: number; superEffective: boolean } {
    // El defensor está protegido (Protección/Protect): se bloquea el ataque,
    // salvo que el atacante tenga Puño Invisible o Taladro Perforador.
    if (defender.protected && !hasAbility(attacker, 'unseen-fist') && !hasAbility(attacker, 'piercing-drill')) {
      return {
        updatedDefender: { ...defender, protected: false },
        updatedAttacker: { ...attacker, protected: false },
        lines: [t('b.protected', { defender: defender.name, attacker: attacker.name })],
        attackerHeal: 0,
        crits: 0,
        superEffective: false,
      }
    }
    // El atacante intenta usar un movimiento anulado (Anulación/Disable).
    if (attacker.disabled && attacker.disabled.move === move.name) {
      return {
        updatedDefender: defender,
        updatedAttacker: attacker,
        lines: [t('b.disabled', { name: attacker.name, move: moveName(move) })],
        attackerHeal: 0,
        crits: 0,
        superEffective: false,
      }
    }
    const enemyBoost = isEnemyHit ? modifier?.enemyAttackDelta ?? 0 : 0

    const attackerItem = attacker.holdItem && !hasAbility(attacker, 'klutz') ? HOLDABLE_ITEMS[attacker.holdItem] : null
    const defenderItem = defender.holdItem && !hasAbility(defender, 'klutz') ? HOLDABLE_ITEMS[defender.holdItem] : null

    const playerAtkMod = !isEnemyHit ? (modifier?.playerAttackMod ?? 0) : 0
    const playerSpdMod = !isEnemyHit ? (modifier?.playerSpeedMod ?? 0) : 0
    const playerDefMod = isEnemyHit ? (modifier?.playerDefenseMod ?? 0) : 0
    const enemyDefDelta = !isEnemyHit ? (modifier?.enemyDefenseDelta ?? 0) : 0
    const enemySpdDelta = isEnemyHit ? (modifier?.enemySpeedDelta ?? 0) : 0

    // Burn halves attacker's physical attack
    const burnNerf = attacker.status?.type === 'burn' ? 0.5 : 1
    const paralysisSpdNerf = attacker.status?.type === 'paralysis' ? 0.75 : 1

    const atkStages = attacker.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
    const defStages = defender.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
    const atkStageMult = getStageMultiplier(atkStages.attack)
    const spaStageMult = getStageMultiplier(atkStages.spAttack ?? 0)
    const spdStageMult = getStageMultiplier(atkStages.speed)
    const defStageMult = getStageMultiplier(defStages.defense)
    const spDefStageMult = getStageMultiplier(defStages.spDefense ?? 0)

    const battleWeatherActive = !isWeatherSuppressed(attacker, defender)
    const battleWeather: WeatherKind = battleWeatherActive ? weather : 'none'
    const attackerStatused = !!attacker.status
    const gutsMod = hasAbility(attacker, 'guts') && attackerStatused ? 1.5 : 1
    const hugePowerMod = hasAbility(attacker, 'huge-power') || hasAbility(attacker, 'pure-power') ? 2 : 1
    const solarPowerMod = hasAbility(attacker, 'solar-power') && battleWeather === 'sun' ? 1.5 : 1
    const abilitySpeed = getAbilitySpeedMultiplier(attacker, battleWeather, battleWeatherActive)
    const marvelScaleMod = hasAbility(defender, 'marvel-scale') && !!defender.status ? 1.5 : 1
    // Indefenso (Unaware): ignora las etapas del rival.
    const attackStageMult = hasAbility(defender, 'unaware', attacker) ? 1 : atkStageMult
    const specialAttackStageMult = hasAbility(defender, 'unaware', attacker) ? 1 : spaStageMult
    const defenseStageMult = hasAbility(attacker, 'unaware') ? 1 : defStageMult
    const specialDefenseStageMult = hasAbility(attacker, 'unaware') ? 1 : spDefStageMult

    const effectiveAttacker: Pokemon = {
      ...attacker,
      attack: Math.round(attacker.attack * (1 + (attackerItem?.attackMod ?? 0) + playerAtkMod) * burnNerf * attackStageMult * gutsMod * hugePowerMod),
      spAttack: Math.round(attacker.spAttack * (1 + (attackerItem?.spAttackMod ?? 0) + playerAtkMod) * specialAttackStageMult * solarPowerMod),
      speed: Math.round(attacker.speed * (1 + (attackerItem?.speedMod ?? 0) + playerSpdMod) * paralysisSpdNerf * spdStageMult * abilitySpeed + enemySpdDelta)
    }
    const effectiveDefender: Pokemon = {
      ...defender,
      defense: Math.round(defender.defense * (1 + (defenderItem?.defenseMod ?? 0) + (defenderItem?.eviolite && canStillEvolve(defender) ? 0.50 : 0) + playerDefMod) * defenseStageMult * marvelScaleMod + enemyDefDelta),
      spDefense: Math.round(defender.spDefense * (1 + (defenderItem?.spDefenseMod ?? 0) + (defenderItem?.eviolite && canStillEvolve(defender) ? 0.50 : 0) + playerDefMod) * specialDefenseStageMult + enemyDefDelta)
    }

    const abilityMoveType = getAbilityMoveType(attacker, move)
    const effectiveMove = runChallenges.typeRandomizer
      ? { ...move, type: randomFrom(ALL_TYPES) }
      : (abilityMoveType !== move.type ? { ...move, type: abilityMoveType } : move)

    const defTypes = (effectiveDefender as any).types ?? []
    const primaryType = defTypes[0] || 'normal'
    const secondaryType = defTypes[1] || undefined

    let { effectiveness, message } = getTypeEffectiveness(effectiveMove.type, primaryType, secondaryType)
    effectiveness = adjustEffectivenessForAbilities(attacker, effectiveMove.type, effectiveness)

    // --- Bola Férrea (desde Gen 5): un Pokémon de tipo Volador que la lleva
    // recibe SIEMPRE efectividad neutral de los movimientos de tipo Tierra,
    // sin importar las debilidades o resistencias de su tipo secundario. ---
    if (defenderItem?.ironBall && effectiveMove.type === 'ground' && defTypes.includes('flying')) {
      effectiveness = 1
      message = null
    }

    // --- Habilidades de inmunidad/absorción del defensor ---
    const defenderAbility = defender.ability
    const abilityImmunity = getAbilityMoveImmunity(defender, effectiveMove, attacker, effectiveness)
    const airBalloonBlocked = !!defenderItem?.airBalloon && defender.holdItem === 'Globo Helio' && effectiveMove.type === 'ground' && (effectiveMove.power ?? 0) > 0
    const powderBlocked = !!defenderItem?.powderImmune && isPowderMove(effectiveMove)
    const defenderAbilityBlocked = !!abilityImmunity || airBalloonBlocked || powderBlocked
    let abilityBlockMessage: string | null = null
    if (defenderAbilityBlocked) {
      effectiveness = 0
      message = null
      abilityBlockMessage = airBalloonBlocked
        ? t('b.itemBlocked', { item: itemLocalizedName('Globo Helio') })
        : powderBlocked
          ? t('b.itemBlocked', { item: itemLocalizedName('Gafas Protectoras') })
          : t('b.abilityBlocked', { ability: abilityName(defenderAbility, getLanguage()) })
    }

    // --- Sebo (Thick Fat): mitad de daño de Fuego y Hielo ---
    let thickFatMult = 1
    if (hasAbility(defender, 'thick-fat', attacker) && (effectiveMove.type === 'fire' || effectiveMove.type === 'ice')) {
      thickFatMult = 0.5
    }

    // --- STAB (Same-Type Attack Bonus) ---
    const attackerTypes: string[] = getAbilityStabTypes(attacker, effectiveMove.type)
    const stabBonus = attackerTypes.some(t => t === effectiveMove.type)
      ? (hasAbility(attacker, 'adaptability') ? 2 : 1.5)
      : 1

    // --- Accuracy check ---
    const noGuardBoth = hasAbility(attacker, 'no-guard') || hasAbility(defender, 'no-guard')
    if (move.accuracy !== null && move.accuracy < 100 && !noGuardBoth) {
      const attackerItem = attacker.holdItem && !hasAbility(attacker, 'klutz') ? HOLDABLE_ITEMS[attacker.holdItem] : null
      let effectiveAccuracy = move.accuracy
      const abilityAcc = hasAbility(attacker, 'compound-eyes') ? 1.3 : 1
      effectiveAccuracy = Math.min(100, effectiveAccuracy * abilityAcc * getAbilityAccuracyMultiplier(attacker, defender, effectiveMove, battleWeather, battleWeatherActive))
      // Trueno (Thunder): bajo lluvia acierta siempre; bajo sol solo 50%.
      if (effectiveMove.type === 'electric' && (effectiveMove.name === 'Trueno' || effectiveMove.enName === 'Thunder')) {
        if (battleWeather === 'rain') effectiveAccuracy = 100
        else if (battleWeather === 'sun') effectiveAccuracy = Math.min(effectiveAccuracy, 50)
      }
      if (defenderMovedFirst && attackerItem?.accuracyMod) {
        effectiveAccuracy = Math.min(100, effectiveAccuracy * (1 + attackerItem.accuracyMod))
      }
      const accRoll = Math.random() * 100
      if (accRoll >= effectiveAccuracy) {
        return {
          updatedDefender: defender,
          updatedAttacker: { ...attacker, protected: false },
          lines: [t('b.missed', { attacker: attacker.name, move: moveName(effectiveMove) })],
          attackerHeal: 0,
          crits: 0,
          superEffective: false,
        }
      }
    }

    // --- Multi-hit ---
    let totalHits = 1
    if (move.minHits && move.maxHits) {
      totalHits = Math.floor(Math.random() * (move.maxHits - move.minHits + 1)) + move.minHits
      if (attackerItem?.loadedDice) {
        const loadedMinimum = move.maxHits <= 2 ? move.maxHits : 4
        totalHits = Math.min(move.maxHits, Math.max(totalHits, loadedMinimum))
      }
    }

    let currentDefender = effectiveDefender
    const lines: string[] = []
    let totalDamage = 0
    let totalCrits = 0
    const defenderAtFullHp = currentDefender.hp >= currentDefender.maxHp
    const defenderHpBefore = defender.hp
    let resistBerryUsed = false

    const isDamagingMove = (effectiveMove.power ?? 0) > 0
    if (isDamagingMove && effectiveness === 0) {
      // Movimiento sin efecto (p. ej. Eléctrico contra Tierra): no golpea ni
      // aplica efectos secundarios.
      lines.push(t('battle.noEffect'))
      // Habilidades que absorben el ataque, curan o suben stats al defensor.
      if (defenderAbilityBlocked && abilityImmunity && currentDefender.hp > 0) {
        const absorbed = absorbAbilityMove(currentDefender, abilityImmunity)
        currentDefender = absorbed.defender
        lines.push(...absorbed.logs)
      }
      if (airBalloonBlocked && currentDefender.holdItem === 'Globo Helio') {
        currentDefender = { ...currentDefender, holdItem: undefined }
        lines.push(t('b.itemAirBalloon', { name: currentDefender.name, item: itemLocalizedName('Globo Helio') }))
      }
    } else if (isDamagingMove) {
      for (let hit = 0; hit < totalHits; hit++) {
        const result = applyDamage(effectiveAttacker, currentDefender, effectiveMove, enemyBoost)
        let finalDamage = Math.floor(result.damage * effectiveness * stabBonus)
        // --- Multiplicadores por habilidad y clima del atacante ---
        const weatherMult = weatherTypeMultiplier(battleWeather, effectiveMove.type)
        const lowHpAbility = attacker.hp / Math.max(1, attacker.maxHp) <= 1 / 3
        const pinchType = effectiveMove.type
        const pinchMult = (lowHpAbility
          && ((hasAbility(attacker, 'blaze') && pinchType === 'fire')
            || (hasAbility(attacker, 'overgrow') && pinchType === 'grass')
            || (hasAbility(attacker, 'torrent') && pinchType === 'water')
            || (hasAbility(attacker, 'swarm') && pinchType === 'bug')))
          ? 1.5 : 1
        const technicianMult = hasAbility(attacker, 'technician') && (effectiveMove.power ?? 0) <= 60 ? 1.5 : 1
        const tintedLensMult = hasAbility(attacker, 'tinted-lens') && effectiveness < 1 ? 2 : 1
        const toughClawsMult = hasAbility(attacker, 'tough-claws') && effectiveMove.damageClass !== 'special' ? 1.3 : 1
        const extraAbilityMult = getAbilityDamageMultiplier(attacker, defender, effectiveMove, {
          effectiveness,
          weather: battleWeather,
          weatherActive: battleWeatherActive,
          isCrit: false,
          isContact: isContactMove(effectiveMove),
          defenderAtFullHp,
          movedLast: false,
        })
        finalDamage = Math.floor(finalDamage * weatherMult * pinchMult * technicianMult * tintedLensMult * toughClawsMult * thickFatMult * extraAbilityMult)
        if (hasAbility(defender, 'dry-skin', attacker) && effectiveMove.type === 'fire') {
          finalDamage = Math.floor(finalDamage * 1.25)
        }
        if (hasAbility(defender, 'multiscale', attacker) && defenderAtFullHp) {
          finalDamage = Math.floor(finalDamage * 0.5)
        }
        if (attackerItem?.damageBoost) {
          finalDamage = Math.floor(finalDamage * (1 + attackerItem.damageBoost))
        }
        // Potenciadores por tipo y Pokémon (Diamansfera/Lustresfera): solo afectan
        // a Dialga/Palkia y a movimientos de los tipos indicados.
        const typeBoost = attackerItem?.typeBoost
        if (typeBoost && (!typeBoost.onlyIds || typeBoost.onlyIds.includes(attacker.id)) && typeBoost.types.includes(effectiveMove.type)) {
          finalDamage = Math.floor(finalDamage * (1 + typeBoost.boost))
        }
        // Potenciadores de categoría (Muscle Band / Wise Glasses).
        const categoryBoost = effectiveMove.damageClass === 'special' ? (attackerItem?.specialBoost ?? 0) : (attackerItem?.physicalBoost ?? 0)
        if (categoryBoost) {
          finalDamage = Math.floor(finalDamage * (1 + categoryBoost))
        }
        // Cinturón Experto (Expert Belt): +daño si el movimiento es superefectivo.
        if (attackerItem?.superEffectiveBoost && effectiveness > 1) {
          finalDamage = Math.floor(finalDamage * (1 + attackerItem.superEffectiveBoost))
        }
        if (attackerItem?.lowHpBonus && attacker.hp < attacker.maxHp * 0.3) {
          finalDamage = Math.floor(finalDamage * (1 + attackerItem.lowHpBonus))
        }
        if (attackerItem?.firstStrikeBonus && attacker.hp === attacker.maxHp) {
          finalDamage = Math.floor(finalDamage * (1 + attackerItem.firstStrikeBonus))
        }
        if (defenderItem?.damageReduction) {
          finalDamage = Math.floor(finalDamage * (1 - defenderItem.damageReduction))
        }
        // Baya resistente (Baya Oca, Kasib, Babiri...): reduce a la mitad un
        // movimiento superefectivo de su tipo. Se consume al activarse.
        if (defenderItem?.resistType && !resistBerryUsed && !hasAbility(attacker, 'unnerve') && effectiveMove.type === defenderItem.resistType && effectiveness > 1) {
          finalDamage = Math.floor(finalDamage / 2)
          resistBerryUsed = true
        }

        // --- Crit: base from items/modifiers + move crit stage + habilidad ---
        const modCrit = !isEnemyHit ? (modifier?.playerCritChance ?? 0) : 0
        const moveCritStage = effectiveMove.critRatio ?? 0
        const moveCritChance = moveCritStage >= 3 ? 0.5 : moveCritStage === 2 ? 0.25 : moveCritStage === 1 ? 0.125 : 0
        const critInfo = getAbilityCritInfo(attacker, defender, effectiveMove)
        const totalCrit = (attackerItem?.critChance ?? 0) + modCrit + moveCritChance + critInfo.chanceBonus
        const isCrit = !runChallenges.noCrits && !critInfo.immune && (critInfo.always || (totalCrit > 0 && Math.random() < totalCrit))
        if (isCrit) {
          finalDamage = Math.floor(finalDamage * (hasAbility(attacker, 'sniper') ? 2 : 1.5))
          totalCrits++
        }

        const newHp = Math.max(0, currentDefender.hp - finalDamage)
        currentDefender = { ...currentDefender, hp: newHp }
        totalDamage += finalDamage

        const typeNote = runChallenges.typeRandomizer && effectiveMove.type !== move.type ? ` [${effectiveMove.type}]` : ''
        let hitLine = totalHits > 1
          ? t('b.usesHitMulti', { attacker: attacker.name, move: moveName(effectiveMove) + typeNote, dmg: finalDamage, hit: hit + 1, total: totalHits })
          : t('b.usesHit', { attacker: attacker.name, move: moveName(effectiveMove) + typeNote, dmg: finalDamage })
        if (isCrit) hitLine += t('b.critSuffix')
        if (message) hitLine += ` (${message})`
        if (abilityBlockMessage) hitLine += ` (${abilityBlockMessage})`
        lines.push(hitLine)

        if (currentDefender.hp <= 0) break
      }
      // --- Objetos de supervivencia y bayas (se resuelven tras los golpes) ---
      // Baya resistente consumida: se elimina del Pokémon.
      if (resistBerryUsed) {
        currentDefender = {
          ...currentDefender,
          holdItem: undefined,
          abilityState: hasAbility(defender, 'unburden')
            ? { ...(currentDefender.abilityState ?? {}), unburden: 1 }
            : currentDefender.abilityState,
        }
        lines.push(t('b.resistBerry', { name: currentDefender.name, berry: itemLocalizedName(defender.holdItem ?? '') }))
      }
      // Cinta Focus (Focus Sash): a plena vida aguanta un golpe letal y se consume.
      if (currentDefender.hp <= 0 && defenderItem?.focusSash && defenderAtFullHp) {
        currentDefender = {
          ...currentDefender,
          hp: 1,
          holdItem: undefined,
          abilityState: hasAbility(defender, 'unburden')
            ? { ...(currentDefender.abilityState ?? {}), unburden: 1 }
            : currentDefender.abilityState,
        }
        lines.push(t('b.focusSash', { name: currentDefender.name }))
      } else if (currentDefender.hp <= 0 && defenderItem?.endureChance && Math.random() < defenderItem.endureChance) {
        // Cinta Focus (Focus Band): probabilidad de aguantar un golpe letal.
        currentDefender = { ...currentDefender, hp: 1 }
        lines.push(t('b.focusBand', { name: currentDefender.name }))
      } else if (currentDefender.hp <= 0 && hasAbility(defender, 'sturdy') && defenderAtFullHp) {
        // Robustez (Sturdy): a plena vida aguanta un golpe letal con 1 HP.
        currentDefender = { ...currentDefender, hp: 1 }
        lines.push(t('b.abilitySturdy', { name: currentDefender.name, ability: abilityName(defender.ability, getLanguage()) }))
      }
      // Globo Helio: se pincha al recibir cualquier golpe (o al bloquear uno de Tierra).
      if (defenderItem?.airBalloon && (totalDamage > 0 || airBalloonBlocked) && currentDefender.holdItem === 'Globo Helio') {
        currentDefender = { ...currentDefender, holdItem: undefined }
        lines.push(t('b.itemAirBalloon', { name: currentDefender.name, item: itemLocalizedName('Globo Helio') }))
      }
      // Seguro Debilidad: +2 Ataque y At. Esp. tras un golpe superefectivo.
      if (defenderItem?.weaknessPolicy && effectiveness > 1 && totalDamage > 0 && currentDefender.hp > 0 && currentDefender.holdItem === 'Seguro Debilidad') {
        const stages = currentDefender.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
        currentDefender = {
          ...currentDefender,
          holdItem: undefined,
          statStages: {
            ...stages,
            attack: Math.min(6, stages.attack + 2),
            spAttack: Math.min(6, stages.spAttack + 2),
          },
        }
        lines.push(t('b.itemWeaknessPolicy', { name: currentDefender.name, item: itemLocalizedName('Seguro Debilidad') }))
      }
      // Baya Sitrus: restaura HP al estar por debajo del 50%. Se consume.
      // Cachetero (Cheek Pouch) y Maduración (Ripen) potencian la baya;
      // Liviano (Unburden) acelera al Pokémon tras consumirla.
      if (defenderItem?.berryHeal && !hasAbility(attacker, 'unnerve') && totalDamage > 0 && currentDefender.hp > 0 && currentDefender.hp < currentDefender.maxHp / 2) {
        let sitrusHeal = Math.floor(currentDefender.maxHp * defenderItem.berryHeal)
        if (hasAbility(defender, 'ripen')) sitrusHeal *= 2
        if (hasAbility(defender, 'cheek-pouch')) sitrusHeal += Math.max(1, Math.floor(currentDefender.maxHp / 3))
        currentDefender = {
          ...currentDefender,
          hp: Math.min(currentDefender.maxHp, currentDefender.hp + sitrusHeal),
          holdItem: undefined,
          abilityState: {
            ...(currentDefender.abilityState ?? {}),
            ...(hasAbility(defender, 'unburden') ? { unburden: 1 } : {}),
            ...(hasAbility(defender, 'cud-chew') ? { cudChew: 1 } : {}),
          },
        }
        lines.push(t('b.sitrusHeal', { name: currentDefender.name, hp: sitrusHeal }))
      }
    } else {
      // Movimiento de estado: no hace daño, solo puede aplicar su efecto.
      lines.push(effectiveness === 0 && (move.ailment || move.leechSeed || move.disable)
        ? t('battle.noEffect')
        : t('b.statusMove', { attacker: attacker.name, move: moveName(effectiveMove) }))
    }

    // --- Ailment application on first hit only ---
    const cloakBlocksSecondary = !!defenderItem?.secondaryImmune && (effectiveMove.power ?? 0) > 0
    if (effectiveness > 0 && totalHits > 0 && currentDefender.hp > 0 && !cloakBlocksSecondary) {
      // Sorpresa/Abatimiento (Fake Out): solo aturde en la PRIMERA acción del
      // Pokémon tras entrar a la lucha; si ya actuó antes, no aturde.
      const firstAction = attacker.justEntered ?? false
      const canFlinch = !effectiveMove.fakeOut || firstAction
      if (canFlinch) {
        const ailmentedDefender = applyAilmentToTarget(currentDefender, move)
        if (ailmentedDefender.status && ailmentedDefender.status.type !== currentDefender.status?.type) {
          currentDefender = ailmentedDefender
          lines.push(statusAppliedLine(currentDefender.name, ailmentedDefender.status.type))
        }
      } else {
        lines.push(t('b.alreadyKnewFakeOut', { attacker: attacker.name, move: moveName(effectiveMove) }))
      }
      // Drenadoras (Leech Seed): siembra al objetivo para drenarle HP por turno.
      if (effectiveMove.leechSeed && !currentDefender.leechSeed) {
        currentDefender = { ...currentDefender, leechSeed: true }
        lines.push(`🌱 ¡${currentDefender.name} fue sembrado con Drenadoras!`)
      }
      // Anulación (Disable): bloquea el último movimiento usado del objetivo.
      if (effectiveMove.disable && currentDefender.lastMove && !currentDefender.disabled) {
        currentDefender = { ...currentDefender, disabled: { move: currentDefender.lastMove, turns: 4 } }
        lines.push(t('b.disabled', { name: currentDefender.name, move: currentDefender.lastMove ?? '' }))
      }
    }

    // --- Stat changes ---
    let attackerStages = effectiveAttacker.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
    if (effectiveMove.statChanges && effectiveMove.statChanges.length > 0) {
      const isDamaging = (effectiveMove.power ?? 0) > 0
      const cat = effectiveMove.metaCategory ?? ''
      const changes = effectiveMove.statChanges

      // Decidir si los cambios afectan al atacante o al defensor. La categoría de
      // PokeAPI es poco fiable (Malicioso/Leer sale como 'net-good-stats' aunque
      // baja la Defensa del RIVAL), así que en movimientos de estado se usa el
      // conjunto de cambios: solo negativos → rival; con positivos o mezcla →
      // uno mismo (Danza Espada, Rompecoraza).
      let changesHitSelf: boolean
      if (isDamaging) {
        changesHitSelf = cat === 'net-good-stats' || cat === 'damage+raise' || cat === 'damage-raise'
      } else if (cat === 'net-bad-stats' || cat === 'swagger') {
        changesHitSelf = false
      } else {
        changesHitSelf = changes.some(sc => sc.change > 0)
      }

      for (const sc of changes) {
        const rolled = sc.chance == null || Math.random() * 100 < sc.chance
        if (!rolled) continue

        if (changesHitSelf) {
          const stageKey: keyof typeof attackerStages = sc.stat === 'special-attack' ? 'spAttack' : sc.stat === 'special-defense' ? 'spDefense' : sc.stat
          const change = adjustAbilityStatChange(attacker, Number.isFinite(sc.change) ? sc.change : 0)
          const oldStage = attackerStages[stageKey] ?? 0
          const newStage = Math.max(-6, Math.min(6, oldStage + change))
          if (newStage !== oldStage) {
            attackerStages = { ...attackerStages, [stageKey]: newStage }
            const direction = change > 0 ? 'subió' : 'bajó'
            const statName = sc.stat === 'attack' ? 'Ataque' : sc.stat === 'defense' ? 'Defensa' : sc.stat === 'special-attack' ? 'At. Esp.' : sc.stat === 'special-defense' ? 'Def. Esp.' : 'Velocidad'
            lines.push(direction === 'subió' ? t('b.statUp', { name: effectiveAttacker.name, stat: statName, old: `${oldStage > 0 ? '+' : ''}${oldStage}`, new: `${newStage > 0 ? '+' : ''}${newStage}` }) : t('b.statDown', { name: effectiveAttacker.name, stat: statName, old: `${oldStage > 0 ? '+' : ''}${oldStage}`, new: `${newStage > 0 ? '+' : ''}${newStage}` }))
          }
        } else if (currentDefender.hp > 0) {
          let newStages = currentDefender.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
          const stageKey: keyof typeof newStages = sc.stat === 'special-attack' ? 'spAttack' : sc.stat === 'special-defense' ? 'spDefense' : sc.stat
          const change = adjustAbilityStatChange(currentDefender, Number.isFinite(sc.change) ? sc.change : 0)
          // Habilidades de protección: Cuerpo Claro/Humo Blanco/Metal Pesado
          // bloquean la bajada; Desafiante/Competitivo/Alarmado reaccionan.
          const statDropBlocked = change < 0 && (
            getAbilityStatDropBlocked(currentDefender, stageKey as 'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed')
            || !!defenderItem?.statDropImmune
          )
          // Capa Furtiva anula los cambios de stats secundarios de golpes dañinos.
          if (isDamaging && defenderItem?.secondaryImmune) continue
          if (statDropBlocked) {
            lines.push(defenderItem?.statDropImmune
              ? t('b.itemNoStatDown', { name: currentDefender.name, item: itemLocalizedName('Amuleto Claro') })
              : t('b.abilityNoStatDown', { name: currentDefender.name, ability: abilityName(currentDefender.ability, getLanguage()) }))
            continue
          }
          const oldStage = newStages[stageKey] ?? 0
          const newStage = Math.max(-6, Math.min(6, oldStage + change))
          if (newStage !== oldStage) {
            newStages = { ...newStages, [stageKey]: newStage }
            currentDefender = { ...currentDefender, statStages: newStages }
            const direction = change > 0 ? 'subió' : 'bajó'
            const statName = sc.stat === 'attack' ? 'Ataque' : sc.stat === 'defense' ? 'Defensa' : sc.stat === 'special-attack' ? 'At. Esp.' : sc.stat === 'special-defense' ? 'Def. Esp.' : 'Velocidad'
            lines.push(direction === 'subió' ? t('b.statUp', { name: currentDefender.name, stat: statName, old: `${oldStage > 0 ? '+' : ''}${oldStage}`, new: `${newStage > 0 ? '+' : ''}${newStage}` }) : t('b.statDown', { name: currentDefender.name, stat: statName, old: `${oldStage > 0 ? '+' : ''}${oldStage}`, new: `${newStage > 0 ? '+' : ''}${newStage}` }))
            if (change < 0) {
              const reaction = applyAbilityStatDropReaction(currentDefender, change, stageKey as 'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed')
              currentDefender = reaction.pokemon
              lines.push(...reaction.logs)
              if (defenderItem?.whiteHerb && currentDefender.holdItem === 'Hierba Blanca') {
                const restored = { ...(currentDefender.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }) }
                for (const key of ['attack', 'defense', 'spAttack', 'spDefense', 'speed'] as const) {
                  if (restored[key] < 0) restored[key] = 0
                }
                currentDefender = { ...currentDefender, statStages: restored, holdItem: undefined }
                lines.push(t('b.itemWhiteHerb', { name: currentDefender.name, item: itemLocalizedName('Hierba Blanca') }))
              }
            }
          }
        }
      }
    }

    // --- Furia (Rage): boost defender's Attack when hit while furiaActive ---
    if (totalDamage > 0 && currentDefender.hp > 0 && defender.furiaActive) {
      let newStages = currentDefender.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
      if (newStages.attack < 6) {
        newStages = { ...newStages, attack: Math.min(6, newStages.attack + 1) }
        currentDefender = { ...currentDefender, statStages: newStages }
        lines.push(t('b.rage', { name: currentDefender.name, stage: `${newStages.attack > 0 ? '+' : ''}${newStages.attack}` }))
      }
    }

    // --- Fire thaws frozen ---
    if (effectiveMove.type === 'fire' && currentDefender.status?.type === 'freeze' && currentDefender.hp > 0) {
      currentDefender = { ...currentDefender, status: undefined }
      lines.push(t('b.thawFire', { name: currentDefender.name }))
    }

    // --- Recoil damage ---
    let recoilDamage = 0
    const hasAttackerStageChange = attackerStages.attack !== 0 || attackerStages.defense !== 0 || attackerStages.spAttack !== 0 || attackerStages.spDefense !== 0 || attackerStages.speed !== 0
    const furiaActive = move.name === 'Furia' || attacker.furiaActive || false
    const protectUsed = isProtectMove(effectiveMove)
    let updatedAttacker: Pokemon = hasAttackerStageChange
      ? { ...attacker, statStages: attackerStages, furiaActive, protected: protectUsed, lastMove: effectiveMove.name, justEntered: false }
      : { ...attacker, furiaActive, protected: protectUsed, lastMove: effectiveMove.name, justEntered: false }
    // Espray Bucal: +1 At. Esp. al usar un movimiento de sonido.
    if (attackerItem?.throatSpray && isSoundMove(effectiveMove) && updatedAttacker.holdItem === 'Espray Bucal') {
      const stages = updatedAttacker.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
      updatedAttacker = {
        ...updatedAttacker,
        holdItem: undefined,
        statStages: { ...stages, spAttack: Math.min(6, stages.spAttack + 1) },
      }
      lines.push(t('b.itemThroatSpray', { name: updatedAttacker.name, item: itemLocalizedName('Espray Bucal') }))
    }
    // Sincronía (Synchronize): devuelve el estado alterado al atacante.
    if (defender.ability === 'synchronize' && currentDefender.status && !updatedAttacker.status && currentDefender.status.type !== 'flinch') {
      if (!getAbilityStatusImmune(updatedAttacker, currentDefender.status.type, battleWeather, battleWeatherActive)) {
        updatedAttacker = { ...updatedAttacker, status: { ...currentDefender.status } }
        lines.push(t('b.abilityContactStatus', { name: updatedAttacker.name, status: statusLabel(currentDefender.status.type), ability: abilityName('synchronize', getLanguage()) }))
      }
    }
    if (move.recoilPercent && move.recoilPercent > 0 && totalDamage > 0 && !hasAbility(attacker, 'rock-head')) {
      recoilDamage = Math.floor(totalDamage * move.recoilPercent)
      updatedAttacker = { ...updatedAttacker, hp: Math.max(1, updatedAttacker.hp - recoilDamage) }
      lines.push(t('b.recoil', { name: attacker.name, dmg: recoilDamage }))
    }
    // --- Vida Esfera (Life Orb): pierdes 1/10 del daño infligido ---
    if (attackerItem?.lifeOrb && totalDamage > 0) {
      const orbRecoil = Math.max(1, Math.floor(totalDamage / 10))
      updatedAttacker = { ...updatedAttacker, hp: Math.max(1, updatedAttacker.hp - orbRecoil) }
      lines.push(t('b.lifeOrb', { name: attacker.name, hp: orbRecoil }))
    }
    // --- Casco Dentado (Rocky Helmet): el atacante (físico) pierde 1/6 de su HP ---
    if (defenderItem?.rockyHelmet && !attackerItem?.noContact && totalDamage > 0 && effectiveMove.damageClass !== 'special') {
      const helmetRecoil = Math.max(1, Math.floor(attacker.maxHp / 6))
      updatedAttacker = { ...updatedAttacker, hp: Math.max(1, updatedAttacker.hp - helmetRecoil) }
      lines.push(t('b.rockyHelmet', { name: attacker.name, hp: helmetRecoil }))
    }
    // --- Habilidades de contacto del defensor (movimientos físicos) ---
    const isContact = isContactMove(effectiveMove) && !hasAbility(attacker, 'long-reach') && !attackerItem?.noContact
    if (totalDamage > 0 && isContact && updatedAttacker.hp > 0) {
      const contactAbility = defender.ability
      if (hasAbility(defender, 'rough-skin', attacker)) {
        const skinDmg = Math.max(1, Math.floor(attacker.maxHp / 8))
        updatedAttacker = { ...updatedAttacker, hp: Math.max(1, updatedAttacker.hp - skinDmg) }
        lines.push(t('b.abilityRoughSkin', { name: attacker.name, dmg: skinDmg, ability: abilityName(contactAbility, getLanguage()) }))
      }
      const contactStatus: Array<{ ability: string; status: StatusType; turns: number }> = [
        { ability: 'static', status: 'paralysis', turns: 999 },
        { ability: 'flame-body', status: 'burn', turns: 999 },
        { ability: 'poison-point', status: 'poison', turns: 999 },
      ]
      for (const cs of contactStatus) {
        if (!hasAbility(defender, cs.ability, attacker)) continue
        if (updatedAttacker.status) break
        if (Math.random() < 0.30) {
          updatedAttacker = { ...updatedAttacker, status: { type: cs.status, turns: cs.turns } }
          lines.push(t('b.abilityContactStatus', { name: attacker.name, status: statusLabel(cs.status), ability: abilityName(contactAbility, getLanguage()) }))
          break
        }
      }
    }

    // --- Efectos adicionales al recibir el golpe (motor central) ---
    const onHit = applyAbilityOnHit(updatedAttacker, currentDefender, effectiveMove, totalDamage, {
      defenderHpBefore,
      isContact,
      isCrit: totalCrits > 0,
      weather: battleWeather,
    })
    updatedAttacker = onHit.attacker
    currentDefender = onHit.defender
    lines.push(...onHit.logs)

    // --- Drain (Absorb, Megaagotar, etc.) ---
    if (move.drainPercent && move.drainPercent > 0 && totalDamage > 0 && updatedAttacker.hp > 0) {
      const drainMult = attackerItem?.bigRoot ? 1.30 : 1
      const drainHeal = Math.floor(totalDamage * move.drainPercent * drainMult)
      if (defender.ability === 'liquid-ooze') {
        updatedAttacker = { ...updatedAttacker, hp: Math.max(1, updatedAttacker.hp - drainHeal) }
        lines.push(t('b.abilityOpponentDamage', { name: defender.name, target: attacker.name, dmg: drainHeal, ability: abilityName('liquid-ooze', getLanguage()) }))
      } else {
        updatedAttacker = { ...updatedAttacker, hp: Math.min(updatedAttacker.maxHp, updatedAttacker.hp + drainHeal) }
        lines.push(t('b.drained', { name: attacker.name, hp: drainHeal }))
      }
    }

    // --- Lifesteal ---
    const modLifesteal = !isEnemyHit ? (modifier?.playerLifesteal ?? 0) : 0
    const totalLifesteal = (attackerItem?.lifesteal ?? 0) + modLifesteal
    let attackerHeal = 0
    if (totalLifesteal > 0 && totalDamage > 0) {
      attackerHeal = Math.floor(totalDamage * totalLifesteal)
    }

    return {
      // Importante: NO persistir las stats efectivas (ya multiplicadas por ítem,
      // etapas y habilidades). Solo se guardan HP/estado/cambios de la batalla;
      // si se guardara la Defensa/Def. Esp. efectiva, cada turno se volvería a
      // multiplicar y se dispararía exponencialmente (bug histórico de la Def.S.).
      updatedDefender: { ...currentDefender, defense: defender.defense, spDefense: defender.spDefense },
      updatedAttacker,
      lines,
      attackerHeal,
      crits: totalCrits,
      superEffective: effectiveness > 1 && totalDamage > 0,
    }
  }

  // Subida de nivel tras un combate (equipo activo y PC con Repartir Exp).
  // Aplica +1 nivel, estadísticas y la auto-evolución al alcanzar el nivel.
  async function levelUpPokemonAfterBattle(pokemon: Pokemon, levelsGained: number, logs: string[]): Promise<Pokemon> {
    if (pokemon.hp <= 0) return pokemon

    const hpGain = levelsGained * 3
    const atkGain = levelsGained * 2
    const defGain = levelsGained * 2
    const spaGain = levelsGained * 2
    const spDefGain = levelsGained * 2
    const spdGain = levelsGained * 2
    const oldLevel = pokemon.level
    const newLevel = oldLevel + levelsGained
    const newMaxHp = pokemon.maxHp + hpGain

    let updatedPokemon: Pokemon = {
      ...pokemon,
      level: runChallenges.fixedLevel ? 50 : newLevel,
      maxHp: newMaxHp,
      hp: Math.min(newMaxHp, pokemon.hp + (difficulty === 'coliseum' ? 0 : Math.round(newMaxHp * 0.10)) + hpGain),
      attack: pokemon.attack + atkGain,
      defense: pokemon.defense + defGain,
      spAttack: pokemon.spAttack + spaGain,
      spDefense: pokemon.spDefense + spDefGain,
      speed: pokemon.speed + spdGain
    }

    if (levelsGained > 0) {
      updatedPokemon = { ...updatedPokemon, level: newLevel }
    }

    // Nivel Máximo: alcanzar el nivel 100 con un Pokémon.
    if (updatedPokemon.level >= 100) unlockAchievement('level_100')

    // Auto-evolución al alcanzar el nivel de evolución
    if (!runChallenges.noEvolution && updatedPokemon.evolutionLevel && updatedPokemon.level >= updatedPokemon.evolutionLevel) {
      // Si el Pokémon evoluciona con objeto (p. ej. Clamperl → Huntail con
      // Deep Sea Tooth o → Gorebyss con Deep Sea Scale), se elige la rama
      // según el objeto equipado. Sin objeto, no evoluciona por esta vía.
      const itemEvolutions = updatedPokemon.heldItemEvolutions ?? []
      const matched = itemEvolutions.find(e => e.item === updatedPokemon.holdItem) ?? null
      // Tener ramas alternativas con objeto (p. ej. Kirlia → Gallade,
      // Snorunt → Froslass o Slowpoke → Slowking) NO debe bloquear la
      // evolución normal por nivel (Gardevoir, Glalie, Slowbro...). Solo se
      // bloquea si la evolución por defecto exige un objeto equipado.
      const itemOk = !!matched || !updatedPokemon.heldItemRequired
      if (itemOk) {
        try {
          // El objeto que el Pokémon necesita para evolucionar a su forma
          // especial (p. ej. Gorra de Ash para Greninja-Ash). Solo se
          // consume si esta evolución es exactamente la del objeto.
          const requiredItem = matched ? matched.item : updatedPokemon.heldItemRequired
          const targetName = matched ? matched.target : undefined
          const evolved = await evolvePokemon(updatedPokemon, targetName)
          if (evolved) {
            const consumedItem = updatedPokemon.holdItem
            const { updatedPokemon: finalEvolved } = await checkAndLearnNewMove(evolved, oldLevel, updatedPokemon.level, difficulty)
            registerInPokedex(finalEvolved)
            playEvolution()
            setEvoPopup({ oldSprite: updatedPokemon.sprite, newSprite: finalEvolved.sprite, oldName: updatedPokemon.name, newName: finalEvolved.name })
            setTimeout(() => setEvoPopup(null), 2000 / accessibility.battleSpeed)
            updatedPokemon = finalEvolved
            if (consumedItem && requiredItem && consumedItem === requiredItem) {
              updatedPokemon = { ...updatedPokemon, holdItem: undefined }
              logs.push(t('b.itemConsumedEvo', { item: itemLocalizedName(consumedItem) }))
            }
            setRunStats(prev => ({ ...prev, evolutions: prev.evolutions + 1 }))
            logs.push(t('b.evolved', { name: updatedPokemon.name, evolved: finalEvolved.name }))
          }
        } catch { }
      }
    }

    return updatedPokemon
  }

  function showCombatFloat(target: 'player' | 'enemy', text: string, color: string): void {
    if (!accessibility.floatingDamage) return
    const data: CombatFloatData = { id: Date.now() + Math.random(), text, color }
    if (target === 'player') setPlayerCombatFloat(data)
    else setEnemyCombatFloat(data)
    window.setTimeout(() => {
      if (target === 'player') setPlayerCombatFloat(prev => prev?.id === data.id ? null : prev)
      else setEnemyCombatFloat(prev => prev?.id === data.id ? null : prev)
    }, 900 / accessibility.battleSpeed)
  }

  // Probabilidad de huida de un combate salvaje. Fuga (Run Away) garantiza
  // la huida salvo que el rival impida escapar con una habilidad de trampa.
  function getEscapeChance(): number {
    if (!activePokemon || !enemy) return 0
    if (hasAbility(activePokemon, 'run-away')) return 1
    const playerSpeed = activePokemon.speed * getStageMultiplier(activePokemon.statStages?.speed ?? 0)
    const enemySpeed = enemy.speed * getStageMultiplier(enemy.statStages?.speed ?? 0)
    const speedFactor = (playerSpeed - enemySpeed) / Math.max(1, enemySpeed)
    return Math.max(0.15, Math.min(0.95, 0.4 + speedFactor * 0.35 + escapeAttempts * 0.1))
  }

  function attemptEscape(): void {
    if (!activePokemon || !enemy || screen !== 'battle' || isTrainerBattle) return
    if (currentNode?.type === 'gmax') return
    if (activePokemon.hp <= 0) return
    if (isTrappedByAbility(activePokemon, enemy)) {
      playError()
      setBattleLog(prev => [t('b.escapeTrapped', { ability: abilityName(enemy.ability, getLanguage()) }), ...prev].slice(0, 15))
      const trappedEscapeMove = activePokemon.moves[0] ?? {
        name: 'Huida',
        power: 0,
        type: 'normal',
        accuracy: null,
        description: '',
      }
      void onPlayerMove(trappedEscapeMove, { escape: true })
      return
    }
    const chance = getEscapeChance()
    if (Math.random() < chance) {
      playSelect()
      setBattleLog(prev => [
        hasAbility(activePokemon, 'run-away')
          ? t('b.escapeRunAway', { name: activePokemon.name })
          : t('b.escapeSuccess', { name: activePokemon.name }),
        ...prev,
      ].slice(0, 15))
      setIsTeamRocketBattle(false)
      void completeCurrentNode()
      return
    }
    setEscapeAttempts(prev => prev + 1)
    playError()
    const nextChance = Math.round(Math.max(0.15, Math.min(0.95, chance + 0.1)) * 100)
    setBattleLog(prev => [t('b.escapeFail', { chance: nextChance }), ...prev].slice(0, 15))
    // Un intento fallido consume el turno: el rival ataca y se aplican los
    // efectos de fin de turno, el clima, los estados, etc.
    const escapeMove = activePokemon.moves[0] ?? {
      name: 'Huida',
      power: 0,
      type: 'normal',
      accuracy: null,
      description: '',
    }
    void onPlayerMove(escapeMove, { escape: true })
  }

  async function onPlayerMove(move: Move, options?: { escape?: boolean }): Promise<void> {
    if (!activePokemon || !enemy) return
    const isEscape = options?.escape ?? false

    // Si el Pokémon activo está debilitado no se puede atacar: se fuerza el
    // cambio al siguiente sano o la derrota en lugar de quedarse bloqueado.
    if (activePokemon.hp <= 0) {
      const nextAliveIndex = getFirstHealthyIndex(team, activeIndex)
      if (nextAliveIndex === -1) {
        setBattleLog((prev) => [t('b.partyFainted', { name: activePokemon.name }), ...prev].slice(0, 15))
        setScreen('defeat')
        playDefeatMusic()
        return
      }
      setTeam(prev => prev.map((p, i) => i === nextAliveIndex ? { ...p, justEntered: true } : p))
      setActiveIndex(nextAliveIndex)
      return
    }

    // --- Objetos Choice y Chaleco Asalto: restricciones del movimiento ---
    const activeHoldable = activePokemon.holdItem ? HOLDABLE_ITEMS[activePokemon.holdItem] : null
    if (!isEscape && activeHoldable?.assaultVest && (!move.power || move.power <= 0)) {
      setBattleLog((prev) => [t('b.assaultVestBlock', { name: activePokemon.name }), ...prev].slice(0, 15))
      return
    }
    let choiceLockedMove = activePokemon.choiceLockedMove
    if (!isEscape && activeHoldable?.choiceLock) {
      if (choiceLockedMove && choiceLockedMove !== move.name) {
        setBattleLog((prev) => [t('b.choiceLock', { name: activePokemon.name, move: moveName({ name: choiceLockedMove ?? '' }) }), ...prev].slice(0, 15))
        return
      }
      if (!choiceLockedMove) {
        choiceLockedMove = move.name
      }
    }

    setBattleTurns(t => t + 1)

    if (runChallenges.speedrun && speedrunSeconds <= 0) {
      setBattleLog((prev) => [t('b.timeUp'), ...prev].slice(0, 15))
      return
    }

    const nextTeam = team.map((pokemon, index) => (index === activeIndex ? { ...pokemon } : pokemon))
    let nextPlayer = { ...nextTeam[activeIndex] }
    // Se persiste el movimiento bloqueado por el objeto Choice en el propio
    // nextPlayer para que el setTeam final de la función lo conserve.
    if (choiceLockedMove) {
      nextPlayer = { ...nextPlayer, choiceLockedMove }
      nextTeam[activeIndex] = nextPlayer
    }
    let nextEnemy = { ...enemy }
    const logs: string[] = []

    // --- Status ticks at start of turn ---
    const playerTick = processStatusTick(nextPlayer)
    nextPlayer = playerTick.updatedPokemon
    logs.push(...playerTick.log)

    const enemyTick = processStatusTick(nextEnemy)
    nextEnemy = enemyTick.updatedPokemon
    logs.push(...enemyTick.log)

    // --- Drenadoras (Leech Seed): drena HP del sembrado y cura al otro lado ---
    const leechDrain = (p: Pokemon): number => (p.leechSeed && p.hp > 0 ? Math.max(1, Math.floor(p.maxHp / 8)) : 0)
    const enemySeedDrain = leechDrain(nextEnemy)
    const playerSeedDrain = leechDrain(nextPlayer)
    if (enemySeedDrain > 0) {
      nextEnemy = { ...nextEnemy, hp: Math.max(0, nextEnemy.hp - enemySeedDrain) }
      nextPlayer = { ...nextPlayer, hp: Math.min(nextPlayer.maxHp, nextPlayer.hp + enemySeedDrain) }
      logs.push(t('b.drenadorasDrain', { victim: nextEnemy.name, healer: nextPlayer.name, hp: enemySeedDrain }))
    }
    if (playerSeedDrain > 0) {
      nextPlayer = { ...nextPlayer, hp: Math.max(0, nextPlayer.hp - playerSeedDrain) }
      nextEnemy = { ...nextEnemy, hp: Math.min(nextEnemy.maxHp, nextEnemy.hp + playerSeedDrain) }
      logs.push(t('b.drenadorasDrain', { victim: nextPlayer.name, healer: nextEnemy.name, hp: playerSeedDrain }))
    }

    // --- Anulación (Disable): decrementa los turnos del movimiento anulado ---
    const tickDisable = (p: Pokemon): Pokemon => {
      if (!p.disabled) return p
      const turns = p.disabled.turns - 1
      if (turns <= 0) return { ...p, disabled: undefined }
      return { ...p, disabled: { ...p.disabled, turns } }
    }
    nextPlayer = tickDisable(nextPlayer)
    nextEnemy = tickDisable(nextEnemy)

    // Check if status killed either side
    if (nextPlayer.hp <= 0) {
      nextTeam[activeIndex] = nextPlayer
      const nextAliveIndex = getFirstHealthyIndex(nextTeam, activeIndex)
      if (nextAliveIndex === -1) {
        const fullLogs = [t('b.allFainted'), ...logs, ...battleLog]
        if (speedrunTimerRef.current) clearInterval(speedrunTimerRef.current)
        setTeam(nextTeam)
        setBattleLog(fullLogs)
        setDefeatSummary({ finalTeam: nextTeam, battleLog: fullLogs, enemy: nextEnemy, lastNodeLabel: currentNode?.label })
        handleInfiniteRunDefeat(nextTeam)
        const losses = record.losses + 1
        persistRecord(record.wins, losses)
        recordFinishedRun('loss', nextTeam)
        setWinStreak(0)
        localStorage.setItem('pokerand_streak', '0')
        setMetaProgression(prev => {
          const updated = { ...prev, totalRuns: prev.totalRuns + 1 }
          localStorage.setItem('pokerand_meta', JSON.stringify(updated))
          return updated
        })
        awardPokeCoins(5, 'Partida completada (derrota)')
        if (isDailyRunRef.current) { setDailyPlayed(true); localStorage.setItem('pokerand_daily', dailySeed) }
        setScreen('defeat')
        playDefeatMusic()
        return
      }
      if (runChallenges.nuzlocke) {
        const nuzlockeTeam = nextTeam.filter((_, idx) => idx !== activeIndex)
        setTeam(nuzlockeTeam)
        setActiveIndex(Math.max(0, Math.min(activeIndex, nuzlockeTeam.length - 1)))
        setBattleLog((prev) => [t('b.nuzlockeReleasedStatus', { name: nextPlayer.name }), ...logs, ...prev].slice(0, 15))
      } else {
        if (nextTeam[nextAliveIndex]) nextTeam[nextAliveIndex] = { ...nextTeam[nextAliveIndex], justEntered: true }
        setTeam(nextTeam)
        setActiveIndex(nextAliveIndex)
        setBattleLog((prev) => [t('b.partyFaintedStatus', { name: nextPlayer.name }), ...logs, ...prev].slice(0, 15))
      }
      if (isTeamRocketBattle) setTeamRocketFainted(true)
      setEnemy(nextEnemy)
      return
    }
    if (nextEnemy.hp <= 0) {
      // Enemy died from status — treat as victory (reuses enemy defeat logic below)
      logs.push(t('b.debilitatedStatus', { name: nextEnemy.name }))
      // Fall through to the enemy.hp <= 0 block at the end of this function
    }

    // --- Skip turn checks ---
    const playerSkipped = playerTick.skipTurn
    const enemySkipped = enemyTick.skipTurn

    // --- Confusion self-hit check ---
    let playerConfusedSelfHit = false
    let enemyConfusedSelfHit = false
    if (nextPlayer.status?.type === 'confusion' && !playerSkipped && Math.random() < 1 / 3) {
      playerConfusedSelfHit = true
      const confusionDmg = Math.max(1, Math.floor((40 * nextPlayer.attack * 0.5) / Math.max(1, nextPlayer.defense) * 0.45 + 2))
      nextPlayer = { ...nextPlayer, hp: Math.max(0, nextPlayer.hp - confusionDmg) }
      logs.push(t('b.confusedSelf', { name: nextPlayer.name, dmg: confusionDmg }))
    }
    if (nextEnemy.status?.type === 'confusion' && !enemySkipped && Math.random() < 1 / 3) {
      enemyConfusedSelfHit = true
      const confusionDmg = Math.max(1, Math.floor((40 * nextEnemy.attack * 0.5) / Math.max(1, nextEnemy.defense) * 0.45 + 2))
      nextEnemy = { ...nextEnemy, hp: Math.max(0, nextEnemy.hp - confusionDmg) }
      logs.push(t('b.confusedSelf', { name: nextEnemy.name, dmg: confusionDmg }))
    }

    const playerItem = nextPlayer.holdItem ? HOLDABLE_ITEMS[nextPlayer.holdItem] : null
    const enemyItem = nextEnemy.holdItem ? HOLDABLE_ITEMS[nextEnemy.holdItem] : null
    const playerParalysisNerf = nextPlayer.status?.type === 'paralysis' ? 0.75 : 1
    const enemyParalysisNerf = nextEnemy.status?.type === 'paralysis' ? 0.75 : 1
    const enemyMoveForPriority = nextEnemy.moves[Math.floor(Math.random() * nextEnemy.moves.length)]
    const playerPriority = isEscape
      ? -99
      : (move.priority ?? 0) + getAbilityPriorityBonus(nextPlayer, move)
    const enemyPriority = (enemyMoveForPriority.priority ?? 0) + getAbilityPriorityBonus(nextEnemy, enemyMoveForPriority)
    const speedWeatherActive = !isWeatherSuppressed(nextPlayer, nextEnemy)
    const speedWeather: WeatherKind = speedWeatherActive ? weather : 'none'

    let playerStarts: boolean
    if (playerPriority !== enemyPriority) {
      playerStarts = playerPriority > enemyPriority
    } else {
      const pStages = nextPlayer.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
      const eStages = nextEnemy.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
      const pSpdStage = getStageMultiplier(pStages.speed)
      const eSpdStage = getStageMultiplier(eStages.speed)
      const playerEffectiveSpeed = Math.round(nextPlayer.speed * (1 + (playerItem?.speedMod ?? 0)) * playerParalysisNerf * pSpdStage * getAbilitySpeedMultiplier(nextPlayer, speedWeather, speedWeatherActive))
      const enemyEffectiveSpeed = Math.round(nextEnemy.speed * (1 + (enemyItem?.speedMod ?? 0)) * enemyParalysisNerf * eSpdStage * getAbilitySpeedMultiplier(nextEnemy, speedWeather, speedWeatherActive))
      playerStarts = playerEffectiveSpeed >= enemyEffectiveSpeed
    }

    // Garra Rápida (Quick Claw): probabilidad de atacar primero.
    const playerQuickClaw = (playerItem?.quickClawChance ?? 0) > 0 && Math.random() < (playerItem?.quickClawChance ?? 0)
    const enemyQuickClaw = (enemyItem?.quickClawChance ?? 0) > 0 && Math.random() < (enemyItem?.quickClawChance ?? 0)
    if (playerQuickClaw && !enemyQuickClaw) playerStarts = true
    else if (enemyQuickClaw && !playerQuickClaw) playerStarts = false

    let playerCrits = 0
    const doPlayerAttack = async () => {
      if (isEscape) return
      if (nextPlayer.hp <= 0 || nextEnemy.hp <= 0 || playerSkipped || playerConfusedSelfHit) return
      if ((move.priority ?? 0) > 0 && blocksPriorityMove(nextEnemy)) {
        logs.push(t('b.abilityProtectPriority', { name: nextEnemy.name, ability: abilityName(nextEnemy.ability, getLanguage()) }))
        return
      }
      if (move.name !== 'Furia') nextPlayer = { ...nextPlayer, furiaActive: false }
      const playerHit = performHit(nextPlayer, nextEnemy, move, false, !playerStarts)
      const prevEnemyHp = nextEnemy.hp
      nextEnemy = playerHit.updatedDefender
      nextPlayer = playerHit.updatedAttacker
      if (nextEnemy.hp < prevEnemyHp) {
        const damageDealt = prevEnemyHp - nextEnemy.hp
        setEnemyHitFlash(true)
        playHit()
        showCombatFloat(
          'enemy',
          `-${damageDealt}${playerHit.crits > 0 ? ' CRIT' : playerHit.superEffective ? ' SUPER' : ''}`,
          playerHit.crits > 0 ? '#ffcb05' : playerHit.superEffective ? '#ff8a33' : '#f3f1ff',
        )
        setTimeout(() => setEnemyHitFlash(false), 400 / accessibility.battleSpeed)
      }
      // Golpe Definitivo: el ataque del jugador debilita al enemigo de un golpe.
      if (prevEnemyHp > 0 && nextEnemy.hp <= 0) {
        setRunStats(prev => ({ ...prev, koFirstTurn: prev.koFirstTurn + 1 }))
      }
      if (playerHit.superEffective) {
        setRunStats(prev => ({ ...prev, superEffectiveHits: prev.superEffectiveHits + 1 }))
      }
      playerCrits = playerHit.crits
      if (playerHit.attackerHeal > 0) {
        const healed = Math.min(nextPlayer.maxHp, nextPlayer.hp + playerHit.attackerHeal)
        nextPlayer = { ...nextPlayer, hp: healed }
        showCombatFloat('player', `+${playerHit.attackerHeal}`, '#37d16b')
        logs.push(t('b.vampirism', { name: nextPlayer.name, hp: playerHit.attackerHeal }))
      }
      logs.push(...playerHit.lines)

      if (runChallenges.firstStrike && nextEnemy.hp > 0) {
        const recoil = Math.floor(nextPlayer.maxHp * 0.08)
        nextPlayer = { ...nextPlayer, hp: Math.max(1, nextPlayer.hp - recoil) }
        logs.push(t('b.recoilFirstStrike', { name: nextPlayer.name, hp: recoil }))
      }
    }

    const doEnemyAttack = async () => {
      if (nextEnemy.hp <= 0 || nextPlayer.hp <= 0 || enemySkipped || enemyConfusedSelfHit) return
      if ((enemyMoveForPriority.priority ?? 0) > 0 && blocksPriorityMove(nextPlayer)) {
        logs.push(t('b.abilityProtectPriority', { name: nextPlayer.name, ability: abilityName(nextPlayer.ability, getLanguage()) }))
        return
      }
      let enemyMove = enemyMoveForPriority
      // Objetos Choice del rival: se queda con el primer movimiento elegido.
      const enemyHoldable = nextEnemy.holdItem ? HOLDABLE_ITEMS[nextEnemy.holdItem] : null
      if (enemyHoldable?.choiceLock) {
        if (nextEnemy.choiceLockedMove) {
          const locked = nextEnemy.moves.find(m => m.name === nextEnemy.choiceLockedMove)
          if (locked) enemyMove = locked
        } else {
          nextEnemy = { ...nextEnemy, choiceLockedMove: enemyMove.name }
        }
      }
      // Chaleco Asalto del rival: no puede usar movimientos de estado.
      if (enemyHoldable?.assaultVest && (!enemyMove.power || enemyMove.power <= 0)) {
        const damagingMoves = nextEnemy.moves.filter(m => (m.power ?? 0) > 0)
        if (damagingMoves.length > 0) enemyMove = damagingMoves[Math.floor(Math.random() * damagingMoves.length)]
      }
      // Anulación: el rival evita su movimiento anulado si puede.
      if (nextEnemy.disabled && nextEnemy.disabled.move === enemyMove.name) {
        const usable = nextEnemy.moves.filter(m => m.name !== nextEnemy.disabled?.move)
        if (usable.length > 0) {
          enemyMove = usable[Math.floor(Math.random() * usable.length)]
          logs.push(t('b.disabledUsed', { name: nextEnemy.name, move: enemyMove.name }))
        } else {
          logs.push(t('b.disabledCant', { name: nextEnemy.name }))
          return
        }
      }
      if (enemyMove.name !== 'Furia') nextEnemy = { ...nextEnemy, furiaActive: false }
      const playerHpBeforeEnemyHit = nextPlayer.hp
      const enemyHit = performHit(nextEnemy, nextPlayer, enemyMove, true, playerStarts)
      nextPlayer = enemyHit.updatedDefender
      nextEnemy = enemyHit.updatedAttacker
      const damageTaken = Math.max(0, playerHpBeforeEnemyHit - nextPlayer.hp)
      if (damageTaken > 0) {
        showCombatFloat(
          'player',
          `-${damageTaken}${enemyHit.crits > 0 ? ' CRIT' : enemyHit.superEffective ? ' SUPER' : ''}`,
          enemyHit.crits > 0 ? '#ffcb05' : enemyHit.superEffective ? '#ff8a33' : '#ff8a80',
        )
      }
      if (enemyHit.attackerHeal > 0) {
        const healed = Math.min(nextEnemy.maxHp, nextEnemy.hp + enemyHit.attackerHeal)
        nextEnemy = { ...nextEnemy, hp: healed }
        showCombatFloat('enemy', `+${enemyHit.attackerHeal}`, '#37d16b')
        logs.push(t('b.vampirism', { name: nextEnemy.name, hp: enemyHit.attackerHeal }))
      }
      logs.push(...enemyHit.lines)

      // --- Tarjeta Roja: si el Pokémon la lleva equipada y es golpeado por un
      // movimiento de daño (sobreviviendo), el rival es obligado a cambiar a
      // otro Pokémon de su equipo. El objeto se consume. ---
      if (nextPlayer.holdItem === 'Tarjeta Roja' && isTrainerBattle) {
        const playerTookDamage = nextPlayer.hp < playerHpBeforeEnemyHit
        const isDamaging = (enemyMove.power ?? 0) > 0
        if (playerTookDamage && isDamaging && nextPlayer.hp > 0) {
          const currentEnemyIndex = trainerPokemonIndex
          const teamWithCurrent = trainerTeam.map((p, idx) => idx === currentEnemyIndex ? nextEnemy : p)
          const aliveOthers = teamWithCurrent
            .map((p, idx) => ({ p, idx }))
            .filter(x => x.p.hp > 0 && x.idx !== currentEnemyIndex)
          if (aliveOthers.length > 0) {
            const picked = aliveOthers[Math.floor(Math.random() * aliveOthers.length)]
            nextPlayer = { ...nextPlayer, holdItem: undefined }
            const redCardEnemy: Pokemon = { ...picked.p, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, justEntered: true }
            const redEnemyEntry = applyEntryAbilities(redCardEnemy, nextPlayer)
            const redPlayerEntry = applyEntryAbilities(nextPlayer, redCardEnemy)
            nextPlayer = redEnemyEntry.opponentUpdated
            nextEnemy = redPlayerEntry.opponentUpdated
            const redEnemySelf = applyAbilityEntrySelf(nextEnemy, nextPlayer)
            nextEnemy = redEnemySelf.entering
            const redPlayerSelf = applyAbilityEntrySelf(nextPlayer, nextEnemy)
            nextPlayer = redPlayerSelf.entering
            setTrainerTeam(teamWithCurrent)
            setTrainerPokemonIndex(picked.idx)
            logs.push(t('b.redCard', { name: nextPlayer.name }))
            logs.push(t('b.enemySendsOut', { trainer: trainerName, name: picked.p.name, lvl: picked.p.level }))
            logs.push(...redPlayerEntry.logs, ...redEnemyEntry.logs, ...redPlayerSelf.logs, ...redEnemySelf.logs)
          }
        }
      }
    }

    const attackPause = 140 / accessibility.battleSpeed
    if (playerStarts) {
      await doPlayerAttack()
      await sleep(attackPause)
      await doEnemyAttack()
    } else {
      await doEnemyAttack()
      await sleep(attackPause)
      await doPlayerAttack()
    }

    // --- Efectos pasivos por turno ---
    const modHealBonus = modifier?.healBonus ?? 0
    const modHealReduction = modifier?.healReduction ?? 0
    const applyTurnEffects = (p: Pokemon): Pokemon => {
      const item = p.holdItem ? HOLDABLE_ITEMS[p.holdItem] : null
      if (!item) return p
      let updated = { ...p }
      // Restos (Leftovers): recupera una fracción del HP máximo cada turno.
      if (item.healFraction && updated.hp > 0) {
        let healAmount = Math.max(1, Math.floor(updated.maxHp * item.healFraction))
        if (healAmount > 0) {
          healAmount = Math.floor(healAmount * (1 - modHealReduction)) + modHealBonus
        }
        updated = { ...updated, hp: Math.min(updated.maxHp, updated.hp + healAmount) }
        if (healAmount > 0) logs.push(t('b.itemHealTurn', { name: updated.name, hp: healAmount, item: item.name }))
      }
      if (item.healPerTurn && updated.hp > 0) {
        let healAmount = item.healPerTurn
        if (healAmount > 0) {
          healAmount = Math.floor(healAmount * (1 - modHealReduction)) + modHealBonus
        }
        const newHp = Math.min(updated.maxHp, updated.hp + healAmount)
        updated = { ...updated, hp: Math.max(1, newHp) }
        if (healAmount > 0) logs.push(t('b.itemHealTurn', { name: updated.name, hp: healAmount, item: item.name }))
        else logs.push(t('b.itemDamageTurn', { name: updated.name, hp: Math.abs(healAmount), item: item.name }))
      }
      return updated
    }

    nextPlayer = applyTurnEffects(nextPlayer)
    nextEnemy = applyTurnEffects(nextEnemy)

    // --- Habilidades y clima por turno ---
    nextPlayer = applyTurnAbilities(nextPlayer, logs, nextEnemy)
    nextEnemy = applyTurnAbilities(nextEnemy, logs, nextPlayer)
    // Mal Sueño (Bad Dreams) daña al rival dormido; el registro ya se añadió.
    if (nextPlayer.ability === 'bad-dreams' && nextEnemy.status?.type === 'sleep' && nextEnemy.hp > 0 && !isIndirectDamageImmune(nextEnemy)) {
      nextEnemy = { ...nextEnemy, hp: Math.max(1, nextEnemy.hp - Math.max(1, Math.floor(nextEnemy.maxHp / 8))) }
    }
    if (nextEnemy.ability === 'bad-dreams' && nextPlayer.status?.type === 'sleep' && nextPlayer.hp > 0 && !isIndirectDamageImmune(nextPlayer)) {
      nextPlayer = { ...nextPlayer, hp: Math.max(1, nextPlayer.hp - Math.max(1, Math.floor(nextPlayer.maxHp / 8))) }
    }

    // --- G-MAX turn counter decrement ---
    if (nextPlayer.gmaxEvolved && nextPlayer.gmaxTurnsLeft) {
      const newTurns = nextPlayer.gmaxTurnsLeft - 1
      nextPlayer = { ...nextPlayer, gmaxTurnsLeft: newTurns }
      if (newTurns <= 0) {
        const orig = nextPlayer.megaOrig
        if (orig) {
          nextPlayer = { ...nextPlayer, gmaxEvolved: false, megaOrig: undefined, ...orig }
        } else {
          nextPlayer = { ...nextPlayer, gmaxEvolved: false }
        }
        logs.push(t('b.gmaxBackNormal', { name: nextPlayer.name }))
      }
    }

    // --- Track run stats ---
    battleMinHpRef.current = Math.min(battleMinHpRef.current, nextPlayer.hp)
    setRunStats(prev => {
      const playerDmg = Math.max(0, activePokemon.hp - nextPlayer.hp)
      const enemyDmg = Math.max(0, enemy.hp - nextEnemy.hp)
      return {
        ...prev,
        totalDamageDealt: prev.totalDamageDealt + enemyDmg,
        totalDamageTaken: prev.totalDamageTaken + playerDmg,
        totalTurns: prev.totalTurns + 1,
        lowestHPEver: Math.min(prev.lowestHPEver, nextPlayer.hp),
        critsLanded: prev.critsLanded + playerCrits,
      }
    })

    // --- Jugador debilitado ---
    if (nextPlayer.hp <= 0) {
      nextTeam[activeIndex] = nextPlayer
      const nextAliveIndex = getFirstHealthyIndex(nextTeam, activeIndex)

      if (nextAliveIndex === -1) {
        const fullLogs = [t('b.allFainted'), ...logs, ...battleLog]
        if (speedrunTimerRef.current) clearInterval(speedrunTimerRef.current)
        setTeam(nextTeam)
        setBattleLog(fullLogs)
        setDefeatSummary({
          finalTeam: nextTeam,
          battleLog: fullLogs,
          enemy: nextEnemy,
          lastNodeLabel: currentNode?.label
        })
        handleInfiniteRunDefeat(nextTeam)
        const losses = record.losses + 1
        persistRecord(record.wins, losses)
        recordFinishedRun('loss', nextTeam)
        setWinStreak(0)
        localStorage.setItem('pokerand_streak', '0')
        setMetaProgression(prev => {
          const updated = { ...prev, totalRuns: prev.totalRuns + 1 }
          localStorage.setItem('pokerand_meta', JSON.stringify(updated))
          return updated
        })
        awardPokeCoins(5, 'Partida completada (derrota)')
        if (isDailyRunRef.current) {
          setDailyPlayed(true)
          localStorage.setItem('pokerand_daily', dailySeed)
        }
        setScreen('defeat')
        playDefeatMusic()
        return
      }

      if (runChallenges.nuzlocke) {
        const nuzlockeTeam = nextTeam.filter((_, idx) => idx !== activeIndex)
        const newActiveIdx = Math.min(activeIndex, nuzlockeTeam.length - 1)
        setTeam(nuzlockeTeam)
        setActiveIndex(Math.max(0, newActiveIdx))
        setBattleLog((prev) => [t('b.nuzlockeReleased', { name: nextPlayer.name }), ...logs, ...prev].slice(0, 15))
      } else {
        if (nextTeam[nextAliveIndex]) nextTeam[nextAliveIndex] = { ...nextTeam[nextAliveIndex], justEntered: true }
        setTeam(nextTeam)
        setActiveIndex(nextAliveIndex)
        setBattleLog((prev) => [t('b.partyFainted', { name: nextPlayer.name }), ...logs, ...prev].slice(0, 15))
      }
      if (isTeamRocketBattle) setTeamRocketFainted(true)
      setEnemy(nextEnemy)
      return
    }

    // --- Enemigo derrotado ---
    if (nextEnemy.hp <= 0) {
      // Climatología: la batalla se gana con clima activo.
      if (weather !== 'none') unlockAchievement('weather_win')
      // Logros de remontada: se comprueban en la victoria (antes de la curación
      // automática por subir de nivel). Para entrenadores, solo cuando es la
      // victoria final de todo el equipo rival.
      const isFullWin = !isTrainerBattle || (() => {
        const updatedTrainerTeam = trainerTeam.map((p, idx) => idx === trainerPokemonIndex ? nextEnemy : p)
        return updatedTrainerTeam.findIndex((p) => p.hp > 0) === -1
      })()
      if (isFullWin) {
        if (nextPlayer.hp === 1) unlockAchievement('back_from_brink')
        const finalTeam = [...nextTeam]
        finalTeam[activeIndex] = nextPlayer
        const aliveTeam = finalTeam.filter(p => p.hp > 0)
        if (aliveTeam.length === 1 && aliveTeam[0].hp > 0 && aliveTeam[0].hp <= aliveTeam[0].maxHp * 0.1) {
          unlockAchievement('comeback')
        }
      }
      // --- Batalla de entrenador: verificar si hay más Pokémon ---
      const baseLevelsGained = runChallenges.fixedLevel ? 0 : 1

      // Subida de nivel para TODOS los miembros vivos del equipo
      const updatedTeamPromises = nextTeam.map(async (pokemon) =>
        levelUpPokemonAfterBattle(pokemon, baseLevelsGained, logs)
      )

      const newTeam = await Promise.all(updatedTeamPromises)
      // Habilidades de recolección: Recojo y Recogemiel aportan dinero extra.
      if (isFullWin && !runChallenges.noMoney) {
        const pickupBonus = newTeam.some(p => p.ability === 'pickup') ? 20 : 0
        const honeyBonus = newTeam.some(p => p.ability === 'honey-gather') ? 15 : 0
        const fetchBonus = newTeam.some(p => p.ability === 'ball-fetch') ? 10 : 0
        const utilityBonus = pickupBonus + honeyBonus + fetchBonus
        if (utilityBonus > 0) {
          setMoney(prev => prev + utilityBonus)
          logs.push(t('b.abilityUtilityReward', { money: utilityBonus }))
        }
      }
      const pendingPc: Pokemon[] = []

      // Repartir Exp: si algún Pokémon (equipo o PC) lo lleva equipado, todos
      // los Pokémon del PC ganan la misma experiencia tras el combate que el
      // equipo activo (1 nivel).
      const hasExpShare = [...nextTeam, ...pcStorage].some(p => {
        const h = p.holdItem ? HOLDABLE_ITEMS[p.holdItem] : null
        return !!h?.isExpShare
      })
      if (hasExpShare && pcStorage.length > 0) {
        const updatedPc = await Promise.all(
          pcStorage.map(async (pokemon) => levelUpPokemonAfterBattle(pokemon, baseLevelsGained, logs))
        )
        const leveledNames = updatedPc
          .filter((p, i) => p.level > (pcStorage[i]?.level ?? 0))
          .map(p => p.name)
        if (leveledNames.length > 0) {
          logs.push(t('b.expShareGain', { names: leveledNames.join(', ') }))
        }
        setPcStorage(updatedPc)
      }

      const baseMoneyReward = Math.floor((40 + nextEnemy.level * 5) / (isTrainerBattle ? trainerTeam.length : 1))
      const hardMoneyPenalty = difficulty === 'hard' ? 0.6 : difficulty === 'infinite' ? 0.55 : 1
      const trainerMoneyPenalty = isTeamRocketBattle ? 0.4 : (isTrainerBattle && currentNode?.type !== 'boss') ? 0.5 : 1
      const wildMoneyPenalty = (!isTrainerBattle && currentNode?.type === 'battle') ? 0.7 : 1
      // El Rival recurrente da bastante más dinero que el resto.
      const rivalMoneyBonus = isRivalBattle ? 2.2 : 1
      const moneyReward = runChallenges.noMoney ? 0 : Math.floor(baseMoneyReward * (modifier?.moneyMultiplier ?? 1) * hardMoneyPenalty * trainerMoneyPenalty * wildMoneyPenalty * rivalMoneyBonus)
      if (!runChallenges.noMoney) setMoney((prev) => prev + moneyReward)

      setRunStats(prev => ({
        ...prev,
        battlesWon: prev.battlesWon + 1,
        moneyEarned: prev.moneyEarned + moneyReward,
        pokemonUsed: Array.from(new Set([...prev.pokemonUsed, ...newTeam.filter(p => p.hp > 0).map(p => p.name)])),
        teamSizeMax: Math.max(prev.teamSizeMax, newTeam.filter(p => p.hp > 0).length),
      }))

      // Egglocke: hatch eggs after battle
      if (runChallenges.egglocke && eggInventory.length > 0) {
        const hatchedEggs: typeof eggInventory = []
        const remainingEggs: typeof eggInventory = []
        for (const egg of eggInventory) {
          if (egg.hatchIn <= 1) {
            hatchedEggs.push(egg)
          } else {
            remainingEggs.push({ ...egg, hatchIn: egg.hatchIn - 1 })
          }
        }
        if (hatchedEggs.length > 0) {
          for (const egg of hatchedEggs) {
            const built = await buildPokemonFromApi(egg.id, getEffectiveGen(), nextPlayer.level, false, difficulty)
            const hatchedPokemon: Pokemon = {
              ...built,
              level: runChallenges.fixedLevel ? 50 : nextPlayer.level,
            }
            registerInPokedex(hatchedPokemon)
            if (newTeam.filter(p => p.hp > 0).length < maxTeamSize) {
              newTeam.push(hatchedPokemon)
              logs.push(t('b.eggHatched', { name: egg.name }))
            } else {
              pendingPc.push(hatchedPokemon)
              logs.push(t('b.eggHatchedPC', { name: egg.name }))
            }
          }
        }
        setEggInventory(remainingEggs)
      }

      if (pendingPc.length > 0) {
        setPcStorage((prev) => [...prev, ...pendingPc])
      }

      let logMsg = runChallenges.noMoney
        ? t('b.defeatedWild2', { name: nextEnemy.name })
        : t('b.defeatedWildMoney', { name: nextEnemy.name, money: moneyReward })

      // --- Batalla de entrenador: enviar siguiente Pokémon ---
      if (isTrainerBattle) {
        const updatedTrainerTeam = trainerTeam.map((p, idx) => idx === trainerPokemonIndex ? nextEnemy : p)
        // Búsqueda circular: primero los que quedan después del índice actual y,
        // si no hay, los anteriores (la Tarjeta Roja puede haber mezclado el orden).
        const aliveAfter = updatedTrainerTeam.findIndex((p, idx) => idx > trainerPokemonIndex && p.hp > 0)
        const aliveBefore = updatedTrainerTeam.findIndex((p, idx) => idx < trainerPokemonIndex && p.hp > 0)
        const nextTrainerIndex = aliveAfter !== -1 ? aliveAfter : aliveBefore

        if (nextTrainerIndex === -1) {
          const baseTotalReward = 40 + nextEnemy.level * 5 * trainerTeam.length
          const totalReward = Math.floor(baseTotalReward * (modifier?.moneyMultiplier ?? 1) * hardMoneyPenalty * trainerMoneyPenalty)
          setMoney((prev) => prev + totalReward)
          setTeam(newTeam)
          setTrainerTeam(updatedTrainerTeam)
          setEnemy(nextEnemy)

          if (isTeamRocketBattle) {
            setIsTeamRocketBattle(false)
            if (teamRocketFainted) {
              const aliveTeam = newTeam.filter((p) => p.hp > 0)
              if (aliveTeam.length > 0) {
                const stolen = aliveTeam[Math.floor(Math.random() * aliveTeam.length)]
                const remainingTeam = newTeam.filter((p) => p !== stolen)
                const msg = t('b.teamRStole', { name: stolen.name })
                setTeamRocketStealMessage(msg)
                setBattleLog((prev) => [
                  msg,
                  t('b.defeatedTeamR', { money: totalReward + moneyReward }),
                  logMsg,
                  ...logs,
                  ...prev
                ].slice(0, 15))
                const hasAliveAfter = remainingTeam.some((p) => p.hp > 0)
                if (hasAliveAfter) {
                  setTeam(remainingTeam)
                  if (activeIndex >= remainingTeam.length) {
                    const healthyIdx = remainingTeam.findIndex((p) => p.hp > 0)
                    setActiveIndex(healthyIdx !== -1 ? healthyIdx : 0)
                  }
                  setTimeout(() => { setTeamRocketStealMessage(''); completeCurrentNode() }, 3000)
                } else {
                  setTimeout(() => {
                    setTeamRocketStealMessage('')
                    setTeam(remainingTeam)
                    setDefeatSummary({
                      finalTeam: remainingTeam,
                      battleLog: [t('b.teamRNoPokemon'), ...battleLog],
                      enemy: nextEnemy,
                      lastNodeLabel: currentNode?.label
                    })
                    handleInfiniteRunDefeat(remainingTeam)
                    const losses = record.losses + 1
                    persistRecord(record.wins, losses)
                    recordFinishedRun('loss', remainingTeam)
                    if (isDailyRunRef.current) {
                      setDailyPlayed(true)
                      localStorage.setItem('pokerand_daily', dailySeed)
                    }
                    setScreen('defeat')
                    playDefeatMusic()
                  }, 3000)
                }
                return
              }
            } else {
              const defeated = updatedTrainerTeam.filter((p) => p.hp <= 0)
              setTeamRocketTeam(defeated)
              setTeamRocketPickModal(true)
              setBattleLog((prev) => [
                t('b.defeatedTeamRNoLoss', { money: totalReward + moneyReward }),
                logMsg,
                ...logs,
                ...prev
              ].slice(0, 15))
              setTeam(newTeam)
              return
            }
          }

          if (currentNode.type === 'gmax') {
            const alreadyHas = inventory.includes('Dynamax Band') || team.some(p => p.holdItem === 'Dynamax Band')
            // En modo Infinite siempre se entrega el objeto, incluso si ya hay uno.
            if (!alreadyHas || difficulty === 'infinite') {
              setInventory(prev => [...prev, 'Dynamax Band'])
              logs.push(t('b.dynamaxBandGot'))
            } else {
              const price = 100
              setMetaProgression(prev => ({ ...prev, pokeCoins: prev.pokeCoins + price }))
              logs.push(t('b.alreadyHaveCoin', { coins: price }))
            }
          }
          setBattleLog((prev) => [
            t('b.defeatedTrainer', { name: trainerName, money: totalReward + moneyReward }),
            logMsg,
            ...logs,
            ...prev
          ].slice(0, 15))
          completeCurrentNode()
          return
        }

        const nextPkmn = updatedTrainerTeam[nextTrainerIndex]
        const newEnemyBase: Pokemon = { ...nextPkmn, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, justEntered: true }
        // Habilidades de entrada del nuevo enemigo y del activo del jugador.
        // applyEntryAbilities devuelve el rival afectado, no el que entra.
        const enemyEntry = applyEntryAbilities(newEnemyBase, newTeam[activeIndex])
        const playerEntry = applyEntryAbilities(newTeam[activeIndex], newEnemyBase)
        const playerBase = enemyEntry.opponentUpdated
        const enemyBase = playerEntry.opponentUpdated
        const enemySelf = applyAbilityEntrySelf(enemyBase, playerBase)
        const playerSelf = applyAbilityEntrySelf(playerBase, enemySelf.entering)
        setTrainerTeam(updatedTrainerTeam)
        setTrainerPokemonIndex(nextTrainerIndex)
        setEnemy(enemySelf.entering)
        setTeam(newTeam.map((p, i) => i === activeIndex ? playerSelf.entering : p))
        setBattleLog((prev) => [
          t('b.enemySendsOut', { trainer: trainerName, name: nextPkmn.name, lvl: nextPkmn.level }),
          ...playerEntry.logs,
          ...enemyEntry.logs,
          ...playerSelf.logs,
          ...enemySelf.logs,
          logMsg,
          ...logs,
          ...prev
        ].slice(0, 15))
        return
      }

      // --- G-MAX miniboss reward ---
      if (currentNode.type === 'gmax') {
        const alreadyHas = inventory.includes('Dynamax Band') || team.some(p => p.holdItem === 'Dynamax Band')
        // En modo Infinite siempre se entrega el objeto, incluso si ya hay uno.
        if (!alreadyHas || difficulty === 'infinite') {
          setInventory(prev => [...prev, 'Dynamax Band'])
          logs.push(t('b.dynamaxBandGot'))
        } else {
          const price = 100
          setMetaProgression(prev => ({ ...prev, pokeCoins: prev.pokeCoins + price }))
          logs.push(t('b.alreadyHaveCoin', { coins: price }))
        }
      }

      // --- Batalla salvaje → victoria directa ---
      if (battleStartHPRef.current > 0 && battleMinHpRef.current >= battleStartHPRef.current) {
        unlockAchievement('perfect_battle')
      }
      logMsg = t('b.defeatedWild', { name: nextEnemy.name, money: moneyReward })
      setTeam(newTeam)
      setEnemy(nextEnemy)
      setBattleLog((prev) => [logMsg, ...logs, ...prev].slice(0, 15))
      completeCurrentNode()
      return
    }

    nextTeam[activeIndex] = nextPlayer
    setTeam(nextTeam)
    setEnemy(nextEnemy)
    setBattleLog((prev) => [...logs, ...prev].slice(0, 15))
  }

  // Logros por IVs del Pokémon capturado (Joyas de IVs y Criador de Élite).
  function checkIvAchievements(p: Pokemon): void {
    if (!p.ivs) return
    const ivs = p.ivs
    if ([ivs.hp, ivs.attack, ivs.defense, ivs.spAttack, ivs.spDefense, ivs.speed].some(v => v >= 31)) {
      unlockAchievement('perfect_iv')
    }
    if (ivs.hp + ivs.attack + ivs.defense + ivs.spAttack + ivs.spDefense + ivs.speed >= 150) {
      unlockAchievement('high_iv')
    }
  }

  async function attemptCapture(ballName: string): Promise<void> {
    if (!enemy || !activePokemon) return

    const ballIdx = inventory.indexOf(ballName)
    if (ballIdx === -1) return

    setCaptureModal(false)
    setCaptureMessage(null)

    const def = POKEBALL_DEFS[ballName]
    if (!def) return

    // El rival del combate lleva sus stats infladas por el balance de dificultad
    // (scalePokemonForNode + balanceWildPokemonToTeam). Al capturarlo, se
    // reconstruye con las stats base de su especie al nivel actual para que no
    // herede esa inflación en el equipo del jugador.
    const buildCleanCaptured = async (): Promise<Pokemon> => {
      try {
        const fresh = await buildPokemonFromApi(enemy.id, getEffectiveGen(), enemy.level, enemy.shiny ?? false, difficulty, false, { nature: enemy.nature, ivs: enemy.ivs })
        return {
          ...fresh,
          hp: Math.min(fresh.maxHp, enemy.hp),
          holdItem: (difficulty === 'hard' || difficulty === 'infinite') ? null : enemy.holdItem,
        }
      } catch {
        return { ...enemy, holdItem: (difficulty === 'hard' || difficulty === 'infinite') ? null : enemy.holdItem }
      }
    }

    // Master Ball: captura automática
    if (def.isMaster) {
      playPerfectCapture()
      setInventory(prev => prev.filter((_, i) => i !== ballIdx))
      const capturedPkmn = await buildCleanCaptured()
      registerInPokedex(capturedPkmn)
      setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
      if (capturedPkmn.shiny) unlockAchievement('shiny_catch')
      const bst = capturedPkmn.attack + capturedPkmn.defense + capturedPkmn.speed + capturedPkmn.maxHp
      if (bst >= 600) unlockAchievement('legendary_catch')
      checkIvAchievements(capturedPkmn)
      setBattleLog(prev => [`🏆 ¡${capturedPkmn.name} fue capturado con ${ballName}!`, ...prev].slice(0, 15))
      if (!teamHasRoom(team)) {
        setPcStorage(prev => [...prev, capturedPkmn])
        setBattleLog(prev => [`📦 ${capturedPkmn.name} fue enviado al PC (equipo lleno).`, ...prev].slice(0, 15))
      } else {
        setTeam(prev => [...prev, capturedPkmn])
      }
      captureSummaryCompleteNodeRef.current = true
      setCaptureSummary(capturedPkmn)
      return
    }

    // Fórmula de captura
    const maxHP = enemy.maxHp
    const currentHP = enemy.hp
    const hpFactor = Math.max(0.05, (3 * maxHP - 2 * currentHP) / (3 * maxHP))
    const ballRate = getPokeBallRate(ballName, enemy, battleTurns, !!pokedex[enemy.id]?.caught, activePokemon.level)
    const statusMult = enemy.status
      ? (enemy.status.type === 'sleep' || enemy.status.type === 'freeze' ? 2.5 : 1.5)
      : 1
    const speciesRate = (enemy.captureRate ?? 45) / 255
    const abilityCatchBonus = hasAbility(activePokemon, 'illuminate') ? 1.2
      : hasAbility(activePokemon, 'run-away') ? 1.1
      : 1
    const catchProbability = Math.min(hpFactor * ballRate * statusMult * speciesRate * abilityCatchBonus, 1)

    // Consumir la ball
    setInventory(prev => prev.filter((_, i) => i !== ballIdx))

    if (Math.random() < catchProbability) {
      // Captura exitosa
      playCapture()
      const capturedPkmn = await buildCleanCaptured()
      registerInPokedex(capturedPkmn)
      setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
      if (capturedPkmn.shiny) unlockAchievement('shiny_catch')
      const bst = capturedPkmn.attack + capturedPkmn.defense + capturedPkmn.speed + capturedPkmn.maxHp
      if (bst >= 600) unlockAchievement('legendary_catch')
      checkIvAchievements(capturedPkmn)
      setBattleLog(prev => [`🏆 ¡${capturedPkmn.name} fue capturado con ${ballName}! (${Math.round(catchProbability * 100)}%)`, ...prev].slice(0, 15))
      if (!teamHasRoom(team)) {
        setPcStorage(prev => [...prev, capturedPkmn])
        setBattleLog(prev => [`📦 ${capturedPkmn.name} fue enviado al PC (equipo lleno).`, ...prev].slice(0, 15))
      } else {
        setTeam(prev => [...prev, capturedPkmn])
      }
      captureSummaryCompleteNodeRef.current = true
      setCaptureSummary(capturedPkmn)
    } else {
      // Falló
      playHit()
      setBattleLog(prev => [t('b.escapedBall', { name: enemy.name, ball: ballName, pct: Math.round(catchProbability * 100) }), ...prev].slice(0, 15))
      setCaptureMessage(`¡${enemy.name} escapó!`)
      setTimeout(() => setCaptureMessage(null), 2000 / accessibility.battleSpeed)
    }
  }

  // Cierra el resumen de captura y continúa con el nodo (combate/descanso) o
  // simplemente se cierra (legendario).
  function closeCaptureSummary(): void {
    const shouldComplete = captureSummaryCompleteNodeRef.current
    setCaptureSummary(null)
    captureSummaryCompleteNodeRef.current = false
    if (shouldComplete) void completeCurrentNode()
  }

  function openCaptureMenu(): void {
    const hasBalls = inventory.some(i => POKEBALL_NAMES.includes(i))
    if (!hasBalls) {
      setBattleLog(prev => [t('b.noBalls'), ...prev].slice(0, 15))
      return
    }
    if (runChallenges.soloStarter) {
      setBattleLog(prev => [t('b.challengeSoloStarter'), ...prev].slice(0, 15))
      return
    }
    if (runChallenges.fixedTeam) {
      setBattleLog(prev => [t('b.challengeFixedTeam'), ...prev].slice(0, 15))
      return
    }
    setCaptureModal(true)
  }

  function megaEvolveActive(targetIndex: number = activeIndex): void {
    const target = team[targetIndex]
    if (!target || target.holdItem !== 'Mega Stone' || battleMegaUsed || target.gmaxEvolved || !MEGA_CAPABLE_IDS.has(target.id)) return
    const formId = MEGA_FORM_IDS[target.id]
    const megaFormId = Array.isArray(formId) ? formId[Math.floor(Math.random() * formId.length)] : formId
    const megaSprite = megaFormId
      ? MEGA_SPRITE_OVERRIDES[megaFormId] ?? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${megaFormId}.png`
      : null
    setTeam(prev => prev.map((p, i) => i === targetIndex ? {
      ...p,
      megaEvolved: true,
      megaOrig: { sprite: p.sprite, attack: p.attack, defense: p.defense, spAttack: p.spAttack, spDefense: p.spDefense, speed: p.speed },
      sprite: megaSprite ?? p.sprite,
      attack: Math.floor(p.attack * 1.15),
      defense: Math.floor(p.defense * 1.15),
      spAttack: Math.floor(p.spAttack * 1.15),
      spDefense: Math.floor(p.spDefense * 1.15),
      speed: Math.floor(p.speed * 1.15),
    } : p))
    if (megaFormId) {
      registerInPokedex({ ...target, id: megaFormId, sprite: megaSprite ?? target.sprite })
    }
    setBattleMegaUsed(true)
    setMetaProgression(prev => {
      const totalMegas = prev.totalMegas + 1
      const updated = { ...prev, totalMegas }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
    unlockAchievement('first_mega')
    setBattleLog(prev => [t('b.megaEvolved', { name: target.name }), ...prev].slice(0, 15))
  }

  function gmaxEvolveActive(targetIndex: number = activeIndex): void {
    const target = team[targetIndex]
    if (!target || target.holdItem !== 'Dynamax Band' || battleGmaxUsed || target.gmaxEvolved || !GMAX_CAPABLE_IDS.has(target.id)) return
    const formId = GMAX_FORM_IDS[target.id]
    const gmaxFormId = Array.isArray(formId) ? formId[Math.floor(Math.random() * formId.length)] : formId
    const gmaxSprite = gmaxFormId
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${gmaxFormId}.png`
      : null
    setTeam(prev => prev.map((p, i) => i === targetIndex ? {
      ...p,
      gmaxEvolved: true,
      gmaxTurnsLeft: 3,
      megaOrig: p.megaOrig ?? { sprite: p.sprite, attack: p.attack, defense: p.defense, spAttack: p.spAttack, spDefense: p.spDefense, speed: p.speed },
      sprite: gmaxSprite ?? p.sprite,
      attack: Math.floor(p.attack * 1.15),
      defense: Math.floor(p.defense * 1.15),
      spAttack: Math.floor(p.spAttack * 1.15),
      spDefense: Math.floor(p.spDefense * 1.15),
      speed: Math.floor(p.speed * 1.15),
    } : p))
    if (gmaxFormId) {
      registerInPokedex({ ...target, id: gmaxFormId, sprite: gmaxSprite ?? target.sprite })
    }
    setBattleGmaxUsed(true)
    setMetaProgression(prev => {
      const totalGmax = prev.totalGmax + 1
      const updated = { ...prev, totalGmax }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
    unlockAchievement('first_gmax')
    setBattleLog(prev => [t('b.gmaxEvolved', { name: target.name }), ...prev].slice(0, 15))
  }

  function primalEvolveActive(targetIndex: number = activeIndex): void {
    const target = team[targetIndex]
    if (!target || !target.holdItem || (target.holdItem !== 'Prisma Rojo' && target.holdItem !== 'Prisma Azul')) return
    if (battlePrimalUsed || target.megaEvolved || target.gmaxEvolved || !PRIMAL_CAPABLE_IDS.has(target.id)) return
    const formId = PRIMAL_FORM_IDS[target.id]
    const primalSprite = formId
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${formId}.png`
      : null
    setTeam(prev => prev.map((p, i) => i === targetIndex ? {
      ...p,
      primalEvolved: true,
      megaOrig: { sprite: p.sprite, attack: p.attack, defense: p.defense, spAttack: p.spAttack, spDefense: p.spDefense, speed: p.speed },
      sprite: primalSprite ?? p.sprite,
      attack: Math.floor(p.attack * 1.15),
      defense: Math.floor(p.defense * 1.15),
      spAttack: Math.floor(p.spAttack * 1.15),
      spDefense: Math.floor(p.spDefense * 1.15),
      speed: Math.floor(p.speed * 1.15),
    } : p))
    if (formId) {
      registerInPokedex({ ...target, id: formId, sprite: primalSprite ?? target.sprite })
    }
    setBattlePrimalUsed(true)
    setBattleLog(prev => [t('b.primalEvolved', { name: target.name }), ...prev].slice(0, 15))
  }

  function originEvolveActive(targetIndex: number = activeIndex): void {
    const target = team[targetIndex]
    if (!target || !target.holdItem) return
    const orb = target.holdItem
    if (orb !== 'Diamansfera' && orb !== 'Lustresfera' && orb !== 'Griseosfera') return
    if (battleOriginUsed || target.megaEvolved || target.gmaxEvolved || target.primalEvolved || !ORIGIN_CAPABLE_IDS.has(target.id)) return
    const formId = ORIGIN_FORM_IDS[target.id]
    const originSprite = formId
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${formId}.png`
      : null
    setTeam(prev => prev.map((p, i) => i === targetIndex ? {
      ...p,
      originEvolved: true,
      megaOrig: { sprite: p.sprite, attack: p.attack, defense: p.defense, spAttack: p.spAttack, spDefense: p.spDefense, speed: p.speed },
      sprite: originSprite ?? p.sprite,
      attack: Math.floor(p.attack * 1.15),
      defense: Math.floor(p.defense * 1.15),
      spAttack: Math.floor(p.spAttack * 1.15),
      spDefense: Math.floor(p.spDefense * 1.15),
      speed: Math.floor(p.speed * 1.15),
    } : p))
    if (formId) {
      registerInPokedex({ ...target, id: formId, sprite: originSprite ?? target.sprite })
    }
    setBattleOriginUsed(true)
    setBattleLog(prev => [t('b.originEvolved', { name: target.name }), ...prev].slice(0, 15))
  }

  function handleTeamSlotDrop(srcIndex: number, destIndex: number): void {
    if (screen === 'double') {
      const srcActive = doubleActives.indexOf(srcIndex)
      const destActive = doubleActives.indexOf(destIndex)
      if (srcActive === -1 && destActive !== -1) {
        setDoubleActiveSlot(destActive)
        doubleSwitchPokemon(destActive, srcIndex)
        return
      }
      if (srcActive !== -1 && destActive === -1) {
        doubleSwitchPokemon(srcActive, destIndex)
        return
      }
      if (srcActive !== -1 && destActive !== -1) {
        setDoubleActiveSlot(destActive)
        return
      }
      // En dobles no reordenamos las casillas para no desalinear los activos.
      return
    }
    reorderTeam(srcIndex, destIndex)
  }

  function switchActive(index: number): void {
    // En combate doble, pulsar un Pokémon del equipo cambia el activo del slot
    // seleccionado (o enfoca ese slot si ya está en el campo).
    if (screen === 'double') {
      const target = team[index]
      if (!target || target.hp <= 0) return
      const activeSlot = doubleActives.indexOf(index)
      if (activeSlot !== -1) {
        setDoubleActiveSlot(activeSlot)
        return
      }
      if (doubleFinished) return
      doubleSwitchPokemon(doubleActiveSlot, index)
      return
    }
    const target = team[index]
    if (!target || target.hp <= 0 || index === activeIndex) return
    if (screen === 'battle' && enemy && isTrappedByAbility(activePokemon, enemy)) {
      setBattleLog(prev => [t('b.abilityTrapped', { name: activePokemon.name, ability: abilityName(enemy.ability, getLanguage()) }), ...prev].slice(0, 15))
      playError()
      return
    }
    const orig = team[activeIndex]?.megaOrig
    setTeam(prev => prev.map((p, i) => {
      // Al cambiar de Pokémon se pierden Drenadoras y Anulación (como en los juegos reales),
      // y el que entra cuenta como "recién llegado" para Sorpresa/Abatimiento.
      if (i === activeIndex && orig) {
        const outgoing: Pokemon = { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, originEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, leechSeed: false, disabled: undefined, lastMove: undefined, justEntered: false, choiceLockedMove: undefined, ...orig }
        return applyAbilitySwitchOut(outgoing).pokemon
      }
      if (i === activeIndex) {
        const outgoing = { ...p, leechSeed: false, disabled: undefined, lastMove: undefined, justEntered: false, choiceLockedMove: undefined }
        return applyAbilitySwitchOut(outgoing).pokemon
      }
      if (i === index) return { ...p, justEntered: true }
      return p
    }))
    setActiveIndex(index)
    // Habilidades de entrada del Pokémon que entra (Intimidación, clima) y
    // efectos de salida (Cura Natural, Regeneración) ya aplicados arriba.
    if (screen === 'battle' && enemy) {
      const entry = applyEntryAbilities(target, enemy)
      const selfEntry = applyAbilityEntrySelf(target, entry.opponentUpdated)
      setEnemy(entry.opponentUpdated)
      setTeam(prev => prev.map((p, i) => i === index ? selfEntry.entering : p))
      const entryLogs = [...entry.logs, ...selfEntry.logs]
      if (entryLogs.length > 0) {
        setBattleLog(prev => [...entryLogs, ...prev].slice(0, 15))
      }
    }
    if (screen === 'move') {
      setSelectedNewMove(null)
      if (moveOptionsByIndex[index]) {
        setMoveOptions(moveOptionsByIndex[index])
      } else {
        setMoveOptions([])
        const pokemon = team[index]
        if (pokemon?.rawLevelUpMoves && pokemon.rawLevelUpMoves.length > 0) {
          const currentMoveUrls = new Set(pokemon.moves.map(m => m.url).filter(Boolean))
          const learnable = pokemon.rawLevelUpMoves.filter(m => !currentMoveUrls.has(m.url))
          const pool = learnable.length >= 2 ? learnable : [...learnable, ...pokemon.rawLevelUpMoves.filter(m => currentMoveUrls.has(m.url))]
          const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 10)
          Promise.all(shuffled.map(m => getMoveDetails(m.url))).then(moveDetails => {
            const filtered = moveDetails.filter((m): m is Move => m !== null).slice(0, 2)
            setMoveOptions(filtered)
            setMoveOptionsByIndex(prev => ({ ...prev, [index]: filtered }))
          })
        }
      }
    }
  }

  async function handleStoneEvolution(teamIndex: number): Promise<void> {
    if (!stoneEvoModal) return
    const targetPokemon = team[teamIndex]
    if (!targetPokemon) return
    const stoneItemName = EVOLUTION_STONE_ITEM_NAMES[stoneEvoModal.stoneName]
    if (!stoneItemName) return

    setIsLoading(true)
    try {
      const result = await canEvolveWithStone(targetPokemon.id, stoneItemName)
      if (!result.canEvolve || !result.evolvedName) {
        setBattleLog((prev) => [t('b.stoneNoEffect', { stone: stoneEvoModal.stoneName, name: targetPokemon.name }), ...prev].slice(0, 15))
        setStoneEvoModal(null)
        setStoneEvoTargets([])
        setStoneEvoCanEvolve(new Set())
        return
      }

      const evolvedName = result.evolvedName.includes('-') ? stripRegional(result.evolvedName) : result.evolvedName
      const newBase = await buildPokemonFromApi(evolvedName, 1, targetPokemon.level, targetPokemon.shiny ?? false, 'medium', false, { nature: targetPokemon.nature, ivs: targetPokemon.ivs })
      const evolved: Pokemon = {
        ...newBase,
        name: evolvedName === 'greninja-ash' ? 'Greninja Ash' : newBase.name,
        level: targetPokemon.level,
        maxHp: newBase.maxHp + 15,
        hp: newBase.maxHp + 15,
        attack: newBase.attack + 5,
        defense: newBase.defense + 5,
        spAttack: newBase.spAttack + 5,
        spDefense: newBase.spDefense + 5,
        speed: newBase.speed + 3,
        holdItem: targetPokemon.holdItem,
      }
      registerInPokedex(evolved)
      playEvolution()
      setEvoPopup({ oldSprite: targetPokemon.sprite, newSprite: evolved.sprite, oldName: targetPokemon.name, newName: evolved.name })
      setTimeout(() => setEvoPopup(null), 2000 / accessibility.battleSpeed)
      setTeam(prev => prev.map((p, i) => i === teamIndex ? evolved : p))
      setRunStats(prev => ({ ...prev, evolutions: prev.evolutions + 1 }))
      setInventory(prev => prev.filter((_, i) => i !== stoneEvoModal.stoneIndex))
      setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
      setBattleLog((prev) => [t('b.evolvedStone', { name: targetPokemon.name, evolved: evolved.name, stone: stoneEvoModal.stoneName }), ...prev].slice(0, 15))
    } catch {
      setApiError('Error al procesar la evolución.')
    } finally {
      setIsLoading(false)
      setStoneEvoModal(null)
      setStoneEvoTargets([])
      setStoneEvoCanEvolve(new Set())
    }
  }

  function consumeInventoryItem(itemName: string): void {
    const itemIndex = inventory.indexOf(itemName)
    if (itemIndex === -1) return
    if (HOLDABLE_ITEMS[itemName]) return
    if (POKEBALL_NAMES.includes(itemName)) {
      if (screen === 'battle' && enemy && !isTrainerBattle && currentNode?.type !== 'gmax') {
        if (isLoading) return
        if (runChallenges.soloStarter) {
          setBattleLog((prev) => [t('b.challengeSoloStarter'), ...prev].slice(0, 15))
          return
        }
        if (runChallenges.fixedTeam) {
          setBattleLog((prev) => [t('b.challengeFixedTeam'), ...prev].slice(0, 15))
          return
        }
        attemptCapture(itemName)
      }
      return
    }

    if (EVOLUTION_STONE_UNLOCK_IDS[itemName] || itemName === 'Gorra de Ash' || itemName === 'Auspicious Armor' || itemName === 'Malicious Armor' || itemName === 'Tart Apple' || itemName === 'Sweet Apple' || itemName === 'Syrupy Apple' || itemName === 'Cracked Pot' || itemName === 'Peat Block' || itemName === 'Unremarkable Teacup' || itemName === 'Metal Alloy' || itemName === 'Galarica Cuff' || itemName === 'Galarica Wreath') {
      const candidates = team.filter(p => p.hp > 0)
      if (candidates.length === 0) {
        setBattleLog((prev) => [t('b.noPokemonForStone'), ...prev].slice(0, 15))
        return
      }
      setStoneEvoTargets(candidates)
      setStoneEvoModal({ stoneName: itemName, stoneIndex: itemIndex })
      setStoneEvoCanEvolve(new Set())
      const stoneItemName = EVOLUTION_STONE_ITEM_NAMES[itemName]
      if (stoneItemName) {
        Promise.all(candidates.map(p => canEvolveWithStone(p.id, stoneItemName)))
          .then(results => {
            const evolvable = new Set<number>()
            candidates.forEach((p, i) => {
              if (results[i]?.canEvolve) {
                const realIdx = team.indexOf(p)
                if (realIdx >= 0) evolvable.add(realIdx)
              }
            })
            setStoneEvoCanEvolve(evolvable)
          })
          .catch(() => { /* sin resaltar si falla la consulta */ })
      }
      return
    }

    if (itemName === 'Disco MT') {
      if (screen !== 'route') {
        setBattleLog((prev) => [t('b.discoRouteOnly'), ...prev].slice(0, 15))
        return
      }
      if (!activePokemon) return
      void openMoveTutor(true)
      return
    }

    if (itemName === 'Cuerda Huida') {
      if (screen !== 'battle') {
        setBattleLog((prev) => [t('b.escapeRopeBattleOnly'), ...prev].slice(0, 15))
        return
      }
      if (currentNode?.type === 'boss') {
        setBattleLog((prev) => [t('b.cannotEscapeBoss'), ...prev].slice(0, 15))
        return
      }
      setInventory(prev => prev.filter((_, i) => i !== itemIndex))
      setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
      setBattleLog((prev) => [t('b.escapeRopeUsed'), ...prev].slice(0, 15))
      setIsTeamRocketBattle(false)
      completeCurrentNode()
      return
    }

    if (itemName === 'Poké Radar') {
      if (screen !== 'route') {
        setBattleLog((prev) => [t('b.pokeRadarRouteOnly'), ...prev].slice(0, 15))
        return
      }
      if (shinyNextEncounter) {
        setBattleLog((prev) => [t('b.pokeRadarActive'), ...prev].slice(0, 15))
        return
      }
      setInventory(prev => prev.filter((_, i) => i !== itemIndex))
      setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
      setShinyNextEncounter(true)
      setBattleLog((prev) => [t('b.pokeRadarUsed'), ...prev].slice(0, 15))
      return
    }

    if (itemName === 'Flauta Celeste') {
      if (screen !== 'route') {
        setBattleLog((prev) => [t('b.azureFluteRouteOnly'), ...prev].slice(0, 15))
        return
      }
      if (legendaryNextEncounter) {
        setBattleLog((prev) => [t('b.azureFluteActive'), ...prev].slice(0, 15))
        return
      }
      setInventory(prev => prev.filter((_, i) => i !== itemIndex))
      setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
      setLegendaryNextEncounter(true)
      setBattleLog((prev) => [t('b.azureFluteUsed'), ...prev].slice(0, 15))
      return
    }

    if (itemName === 'Emblema Magma') {
      setInventory(prev => prev.filter((_, i) => i !== itemIndex))
      setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
      awardPokeCoins(5, t('b.magmaEmblemRedeemed'))
      playCoin()
      setCoinExchangeMsg(t('b.magmaEmblemRedeemed'))
      setTimeout(() => setCoinExchangeMsg(null), 3000)
      return
    }

    if (itemName === 'Máquina de Naturalezas' || itemName === 'Reroll de IVs' || itemName === 'Cápsula de Habilidad') {
      const candidates = team.filter(p => p.hp > 0)
      if (candidates.length === 0) {
        setBattleLog((prev) => [t('b.noPokemonForStone'), ...prev].slice(0, 15))
        return
      }
      setAbilityTargetIdx(null)
      setAbilityChoices(null)
      setMetaEditModal({ kind: itemName === 'Máquina de Naturalezas' ? 'nature' : itemName === 'Reroll de IVs' ? 'ivs' : 'ability', itemIndex })
      return
    }

    if (runChallenges.noItems) {
      setBattleLog((prev) => [t('b.challengeNoItemsBattle'), ...prev].slice(0, 15))
      return
    }

    if (runChallenges.noHealing && (itemName.includes('Potion') || itemName.includes('Berry') || itemName === 'Full Restore' || itemName === 'Full Heal' || itemName === 'Elixir' || itemName === 'Super Elixir' || itemName === 'Full Elixir')) {
      setBattleLog((prev) => [t('b.challengeNoHealItem'), ...prev].slice(0, 15))
      return
    }

    if (itemName === 'Sacred Ash') {
      const hasFainted = team.some((p) => p.hp <= 0)
      if (!hasFainted) {
        setBattleLog((prev) => [t('b.noFaintedSacredAsh'), ...prev].slice(0, 15))
        return
      }
      setTeam(prev => prev.map(p => p.hp <= 0 ? { ...p, hp: p.maxHp, status: undefined } : p))
      setInventory((previous) => previous.filter((_, index) => index !== itemIndex))
      setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
      setBattleLog((prev) => [t('b.sacredAshUsed'), ...prev].slice(0, 15))
      return
    }

    if (itemName === 'Revive' || itemName === 'Max Revive') {
      const hasFainted = team.some((p) => p.hp <= 0)
      if (!hasFainted) {
        setBattleLog((prev) => [t('b.noFaintedToRevive'), ...prev].slice(0, 15))
        return
      }
      setReviveModal({ itemName, itemIndex })
      return
    }

    if (!activePokemon) return

    let updatedPokemon: Pokemon | null = null

    if (itemName === 'Potion' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 25)
    } else if (itemName === 'Super Potion' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 50)
    } else if (itemName === 'Hyper Potion' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 120)
    } else if (itemName === 'Full Restore' && (activePokemon.hp < activePokemon.maxHp || activePokemon.status)) {
      updatedPokemon = { ...activePokemon, hp: activePokemon.maxHp, status: undefined }
    } else if (itemName === 'Oran Berry' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 15)
    } else if (itemName === 'Lum Berry' && (activePokemon.hp < activePokemon.maxHp || activePokemon.status)) {
      updatedPokemon = { ...healPokemon(activePokemon, 30), status: undefined }
    } else if (itemName === 'Full Heal' && (activePokemon.hp < activePokemon.maxHp || activePokemon.status)) {
      updatedPokemon = { ...healPokemon(activePokemon, 40), status: undefined }
    } else if (itemName === 'Antídoto' && activePokemon.status?.type === 'poison') {
      updatedPokemon = { ...activePokemon, status: undefined }
    } else if (itemName === 'Antiquemar' && activePokemon.status?.type === 'burn') {
      updatedPokemon = { ...activePokemon, status: undefined }
    } else if (itemName === 'Paralizador' && activePokemon.status?.type === 'paralysis') {
      updatedPokemon = { ...activePokemon, status: undefined }
    } else if (itemName === 'Despertar' && activePokemon.status?.type === 'sleep') {
      updatedPokemon = { ...activePokemon, status: undefined }
    } else if (itemName === 'Descongelar' && activePokemon.status?.type === 'freeze') {
      updatedPokemon = { ...activePokemon, status: undefined }
    } else if (itemName === 'Baya Caquic' && activePokemon.status?.type === 'confusion') {
      updatedPokemon = { ...activePokemon, status: undefined }
    } else if (itemName === 'Baya Zreza' && activePokemon.status?.type === 'paralysis') {
      updatedPokemon = { ...activePokemon, status: undefined }
    } else if (itemName === 'Baya Atania' && activePokemon.status?.type === 'burn') {
      updatedPokemon = { ...activePokemon, status: undefined }
    } else if (itemName === 'Baya Algama' && activePokemon.status?.type === 'poison') {
      updatedPokemon = { ...activePokemon, status: undefined }
    } else if (itemName === 'Baya Safre' && activePokemon.status?.type === 'freeze') {
      updatedPokemon = { ...activePokemon, status: undefined }
    } else if (itemName === 'Baya Siendrepis' && activePokemon.status?.type === 'sleep') {
      updatedPokemon = { ...activePokemon, status: undefined }
    } else if (itemName === 'Baya Cuaja' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 25)
    } else if (itemName === 'Baya Wiki' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 35)
    } else if (itemName === 'Baya Mago' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 45)
    } else if (itemName === 'Baya Aguav' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 55)
    } else if (itemName === 'Baya Ango' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 65)
    } else if (itemName === 'X Attack') {
      updatedPokemon = { ...activePokemon, attack: activePokemon.attack + 5 }
    } else if (itemName === 'X Defense') {
      updatedPokemon = { ...activePokemon, defense: activePokemon.defense + 5 }
    } else if (itemName === 'X Speed') {
      updatedPokemon = { ...activePokemon, speed: activePokemon.speed + 5 }
    } else if (itemName === 'X Sp. Attack') {
      updatedPokemon = { ...activePokemon, spAttack: activePokemon.spAttack + 5 }
    } else if (itemName === 'X Sp. Defense') {
      updatedPokemon = { ...activePokemon, spDefense: activePokemon.spDefense + 5 }
    } else if (itemName === 'Elixir' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 80)
    } else if (itemName === 'Moomoo Milk' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 100)
    } else if (itemName === 'Lemonade' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 60)
    } else if (itemName === 'Soda Pop' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 40)
    } else if (itemName === 'Fresh Water' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 30)
    } else if (itemName === 'Berry Juice' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 20)
    } else if (itemName === 'Super Elixir' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 200)
    } else if (itemName === 'Full Elixir') {
      updatedPokemon = { ...activePokemon, hp: activePokemon.maxHp, status: undefined }
    } else if (itemName === 'Polvo Energía' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 60)
    } else if (itemName === 'Raíz Energía' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 120)
    } else if (itemName === 'Polvo Curación' && activePokemon.status) {
      updatedPokemon = { ...activePokemon, status: undefined }
    } else if (itemName === 'Más PS') {
      updatedPokemon = { ...activePokemon, maxHp: activePokemon.maxHp + 15, hp: activePokemon.hp + 15 }
    } else if (itemName === 'X Attack 2') {
      updatedPokemon = { ...activePokemon, attack: activePokemon.attack + 10 }
    } else if (itemName === 'X Defense 2') {
      updatedPokemon = { ...activePokemon, defense: activePokemon.defense + 10 }
    } else if (itemName === 'X Speed 2') {
      updatedPokemon = { ...activePokemon, speed: activePokemon.speed + 10 }
    } else if (itemName === 'X Sp. Attack 2') {
      updatedPokemon = { ...activePokemon, spAttack: activePokemon.spAttack + 10 }
    } else if (itemName === 'X Sp. Defense 2') {
      updatedPokemon = { ...activePokemon, spDefense: activePokemon.spDefense + 10 }
    } else if (itemName === 'Proteína') {
      updatedPokemon = { ...activePokemon, attack: activePokemon.attack + 15 }
    } else if (itemName === 'Calcio') {
      updatedPokemon = { ...activePokemon, spAttack: activePokemon.spAttack + 15 }
    } else if (itemName === 'Hierro') {
      updatedPokemon = { ...activePokemon, defense: activePokemon.defense + 15 }
    } else if (itemName === 'Zinc') {
      updatedPokemon = { ...activePokemon, spDefense: activePokemon.spDefense + 15 }
    } else if (itemName === 'Carburante') {
      updatedPokemon = { ...activePokemon, speed: activePokemon.speed + 15 }
    }

    if (!updatedPokemon) return

    setTeam((previous) =>
      previous.map((pokemon, index) => (index === activeIndex ? updatedPokemon : pokemon))
    )
    setInventory((previous) => previous.filter((_, index) => index !== itemIndex))
    setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
    setBattleLog((prev) => [t('b.usedItem', { item: itemLocalizedName(itemName), name: activePokemon.name }), ...prev].slice(0, 15))
  }

  // Aplica la Máquina de Naturalezas a un Pokémon del equipo.
  function applyNatureMachine(teamIdx: number): void {
    const modal = metaEditModal
    const pokemon = team[teamIdx]
    if (!modal || !pokemon) return
    const oldNature = pokemon.nature
    const newNature = randomNature()
    let updated: Pokemon = { ...pokemon, nature: newNature }
    const statFields: Array<[MetaStatKey, 'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed']> = [
      ['attack', 'attack'], ['defense', 'defense'], ['spAttack', 'spAttack'], ['spDefense', 'spDefense'], ['speed', 'speed'],
    ]
    for (const [key, field] of statFields) {
      const oldMult = natureMultiplier(oldNature, key)
      const newMult = natureMultiplier(newNature, key)
      const val = pokemon[field]
      updated = { ...updated, [field]: Math.round(val / oldMult * newMult) }
    }
    setTeam(prev => prev.map((p, i) => (i === teamIdx ? updated : p)))
    setInventory(prev => prev.filter((_, i) => i !== modal.itemIndex))
    setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
    setBattleLog(prev => [t('b.natureChanged', { name: pokemon.name, nature: natureName(newNature, getLanguage()) }), ...prev].slice(0, 15))
    setMetaEditModal(null)
  }

  // Re-tira los IVs de un Pokémon del equipo con el Reroll de IVs.
  function applyIvReroll(teamIdx: number): void {
    const modal = metaEditModal
    const pokemon = team[teamIdx]
    if (!modal || !pokemon) return
    const oldIvs = pokemon.ivs ?? { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
    const newIvs = generateIVs()
    const applyStat = (ivField: keyof PokemonIVs, statField: keyof Pokemon): Pokemon => {
      const oldBonus = ivStatBonus(oldIvs[ivField], pokemon.level)
      const newBonus = ivStatBonus(newIvs[ivField], pokemon.level)
      const val = pokemon[statField] as number
      return { ...updated, [statField]: val - oldBonus + newBonus }
    }
    let updated: Pokemon = { ...pokemon, ivs: newIvs }
    updated = applyStat('hp', 'maxHp')
    updated = applyStat('attack', 'attack')
    updated = applyStat('defense', 'defense')
    updated = applyStat('spAttack', 'spAttack')
    updated = applyStat('spDefense', 'spDefense')
    updated = applyStat('speed', 'speed')
    const hpRatio = pokemon.maxHp > 0 ? pokemon.hp / pokemon.maxHp : 1
    updated = { ...updated, hp: Math.min(updated.maxHp, Math.max(0, Math.round(updated.maxHp * hpRatio))) }
    const total = newIvs.hp + newIvs.attack + newIvs.defense + newIvs.spAttack + newIvs.spDefense + newIvs.speed
    setTeam(prev => prev.map((p, i) => (i === teamIdx ? updated : p)))
    setInventory(prev => prev.filter((_, i) => i !== modal.itemIndex))
    setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
    setBattleLog(prev => [t('b.ivsRerolled', { name: pokemon.name, total }), ...prev].slice(0, 15))
    setMetaEditModal(null)
  }

  // Cambia la habilidad de un Pokémon por otra de su especie (Cápsula de Habilidad).
  async function applyAbilityChange(teamIdx: number, chosenAbility?: string): Promise<void> {
    const modal = metaEditModal
    const pokemon = team[teamIdx]
    if (!modal || !pokemon) return
    let newAbility = chosenAbility
    if (!newAbility) {
      let abilities: string[] = []
      try {
        abilities = await getPokemonAbilities(pokemon.id)
      } catch { }
      const alternatives = abilities.filter(a => a !== pokemon.ability)
      if (alternatives.length === 0) {
        setBattleLog(prev => [t('b.abilityNoAlternative', { name: pokemon.name }), ...prev].slice(0, 15))
        setMetaEditModal(null)
        setAbilityTargetIdx(null)
        setAbilityChoices(null)
        return
      }
      newAbility = alternatives[Math.floor(Math.random() * alternatives.length)]
    }
    const updated: Pokemon = { ...pokemon, ability: newAbility }
    setTeam(prev => prev.map((p, i) => (i === teamIdx ? updated : p)))
    setInventory(prev => prev.filter((_, i) => i !== modal.itemIndex))
    setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
    setBattleLog(prev => [t('b.abilityChanged', { name: pokemon.name, ability: abilityName(newAbility, getLanguage()) }), ...prev].slice(0, 15))
    setMetaEditModal(null)
    setAbilityTargetIdx(null)
    setAbilityChoices(null)
  }

  function applyRevive(targetIndex: number): void {
    if (!reviveModal) return
    const { itemName, itemIndex } = reviveModal
    const target = team[targetIndex]
    if (!target || target.hp > 0) return

    const restoredHp = itemName === 'Max Revive' ? target.maxHp : Math.floor(target.maxHp * 0.5)
    const revivedPkmn: Pokemon = { ...target, hp: restoredHp, status: undefined }

    setTeam((prev) => prev.map((p, idx) => (idx === targetIndex ? revivedPkmn : p)))
    setInventory((prev) => prev.filter((_, idx) => idx !== itemIndex))
    setRunStats(prev => ({ ...prev, itemsUsed: prev.itemsUsed + 1 }))
    setBattleLog((prev) => [t('b.revived', { name: revivedPkmn.name, hp: revivedPkmn.hp }), ...prev].slice(0, 15))
    setReviveModal(null)
  }

  function captureRestPokemon(): void {
    if (!restEncounter) return

    if (runChallenges.soloStarter) {
      setBattleLog((prev) => [t('b.challengeSoloStarter'), ...prev].slice(0, 15))
      completeCurrentNode()
      return
    }

    if (runChallenges.fixedTeam) {
      setBattleLog((prev) => [t('b.challengeFixedTeam'), ...prev].slice(0, 15))
      completeCurrentNode()
      return
    }

    const hpBonus = modifier?.playerMaxHpBonus ?? 0
    let captured: Pokemon = { ...restEncounter, maxHp: restEncounter.maxHp + hpBonus, hp: restEncounter.hp + hpBonus, holdItem: (difficulty === 'hard' || difficulty === 'infinite') ? null : restEncounter.holdItem }
    if (runChallenges.noEvolution) captured = applyNoEvolutionBuff(captured)
    if (runChallenges.fixedLevel) captured = { ...captured, level: 50 }
    registerInPokedex(captured)
    setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
    if (captured.shiny) unlockAchievement('shiny_catch')
    if ((captured.attack + captured.defense + captured.speed + captured.maxHp) >= 600) unlockAchievement('legendary_catch')
    if (!teamHasRoom(team)) {
      setPcStorage((prev) => [...prev, captured])
      setBattleLog((prev) => [t('b.capturedPC', { name: captured.name }), ...prev].slice(0, 15))
    } else {
      setTeam((previous) => [...previous, captured])
      setBattleLog((prev) => [t('b.captured', { name: captured.name }), ...prev].slice(0, 15))
    }
    captureSummaryCompleteNodeRef.current = true
    setCaptureSummary(captured)
  }

  function skipRestCapture(): void {
    if (!restEncounter) return

    setBattleLog((prev) => [t('rest.letGo', { name: restEncounter.name }), ...prev].slice(0, 15))
    completeCurrentNode()
  }

  function captureLegendaryPokemon(): void {
    if (!legendaryEncounter) return

    if (runChallenges.soloStarter) {
      setBattleLog((prev) => [t('b.challengeSoloStarter'), ...prev].slice(0, 15))
      return
    }

    if (runChallenges.fixedTeam) {
      setBattleLog((prev) => [t('b.challengeFixedTeam'), ...prev].slice(0, 15))
      return
    }

    const hpBonus = modifier?.playerMaxHpBonus ?? 0
    let captured: Pokemon = { ...legendaryEncounter, maxHp: legendaryEncounter.maxHp + hpBonus, hp: legendaryEncounter.hp + hpBonus, holdItem: (difficulty === 'hard' || difficulty === 'infinite') ? null : legendaryEncounter.holdItem }
    if (runChallenges.noEvolution) captured = applyNoEvolutionBuff(captured)
    if (runChallenges.fixedLevel) captured = { ...captured, level: 50 }
    registerInPokedex(captured)
    setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
    if (captured.shiny) unlockAchievement('shiny_catch')
    if ((captured.attack + captured.defense + captured.speed + captured.maxHp) >= 600) unlockAchievement('legendary_catch')
    if (!teamHasRoom(team)) {
      setPcStorage((prev) => [...prev, captured])
      setBattleLog((prev) => [t('b.capturedLegendPC', { name: captured.name }), ...prev].slice(0, 15))
    } else {
      setTeam((previous) => [...previous, captured])
      setBattleLog((prev) => [t('b.capturedLegend', { name: captured.name }), ...prev].slice(0, 15))
    }
    setLegendaryEncounter(null)
    captureSummaryCompleteNodeRef.current = false
    setCaptureSummary(captured)
  }

  function skipLegendaryCapture(): void {
    if (!legendaryEncounter) return

    setBattleLog((prev) => [t('rest.letGoLegend', { name: legendaryEncounter.name }), ...prev].slice(0, 15))
    setLegendaryEncounter(null)
  }

  function handleInfiniteRunDefeat(finalTeam: Pokemon[]): void {
    if (difficulty !== 'infinite') {
      setScoreSubmitState('idle')
      return
    }
    if (!isLeaderboardEnabled()) {
      setScoreSubmitState('disabled')
      return
    }
    setSubmitIsNewBest(null)
    const durationSeconds = Math.max(0, Math.round((Date.now() - runStartTimeRef.current) / 1000))
    const entry: InfiniteScoreInsert = {
      node: routeIndex + 1,
      generation: currentRunGen,
      is_random: generation === 0,
      duration_seconds: durationSeconds,
      team: finalTeam.map((p) => ({ name: p.name, level: p.level, sprite: p.sprite, shiny: !!p.shiny })),
      challenges: runStats.challengesActive,
    }
    if (!authUser) {
      pendingScoreRef.current = entry
      localStorage.setItem('pokerand_pending_score', JSON.stringify(entry))
      setScoreSubmitState('loginRequired')
      return
    }
    void submitPendingScore(entry)
  }

  function handleEndRunConfirm(): void {
    playClick()
    setShowEndRunModal(false)
    if (speedrunTimerRef.current) {
      clearInterval(speedrunTimerRef.current)
      speedrunTimerRef.current = null
    }
    const finalTeam = team
    setVoluntaryRunEnd(true)
    setDefeatSummary({
      finalTeam,
      battleLog: [t('b.runEnded', { n: routeIndex + 1 }), ...battleLog],
      lastNodeLabel: currentNode?.label,
    })
    handleInfiniteRunDefeat(finalTeam)
    setScreen('defeat')
    playDefeatMusic()
  }

  async function submitPendingScore(entry?: InfiniteScoreInsert): Promise<void> {
    const target = entry ?? pendingScoreRef.current
    if (!target) return
    setScoreSubmitState('submitting')
    const result = await submitInfiniteScore(target)
    if (result.ok) {
      pendingScoreRef.current = null
      localStorage.removeItem('pokerand_pending_score')
      setSubmitIsNewBest(result.isNewBest)
      setScoreSubmitState('submitted')
      if (showLeaderboardRef.current) void loadLeaderboard()
    } else {
      setScoreSubmitState('error')
    }
  }

  function openLeaderboard(): void {
    playClick()
    setShowLeaderboard(true)
    setLeaderboardGen(0)
    void loadLeaderboard()
    if (isLeaderboardEnabled()) {
      void getPvpEloLeaderboard().then((rows) => setPvpEloLeaderboard(rows ?? []))
    }
  }

  function friendlyAuthError(msg: string): string {
    if (/rate limit|rate_limit/i.test(msg)) {
      return 'Demasiados intentos en poco tiempo. Supabase limita los intentos de registro/login por hora; espera unos minutos y vuelve a intentarlo.'
    }
    if (/invalid login credentials/i.test(msg)) {
      return 'Email o contraseña incorrectos.'
    }
    // La base de datos rechaza el registro si el nombre de usuario ya existe
    // (la unicidad es insensible a mayúsculas). Supabase lo devuelve como un
    // error genérico de "database error saving new user".
    if (/database error saving new user|unique.*username|username.*already/i.test(msg)) {
      return t('auth.usernameTaken')
    }
    return msg
  }

  async function handleAuthSubmit(): Promise<void> {
    setAuthMessage(null)
    if (authLoading) return
    if (!authEmail.trim() || !authPassword) {
      setAuthMessage({ type: 'error', text: t('auth.needEmailPass') })
      return
    }
    setAuthLoading(true)
    if (authMode === 'signup') {
      const username = authUsername.trim()
      if (!username) {
        setAuthLoading(false)
        setAuthMessage({ type: 'error', text: 'Elige un nombre de usuario.' })
        return
      }
      const taken = await isUsernameTaken(username)
      if (taken) {
        setAuthLoading(false)
        setAuthMessage({ type: 'error', text: t('auth.usernameTaken') })
        return
      }
      const res = await signUpWithUsername(authEmail, authPassword, username)
      if (!res.ok) {
        setAuthMessage({ type: 'error', text: friendlyAuthError(res.error ?? 'No se pudo crear la cuenta.') })
      } else if (res.needsEmailConfirmation) {
        setAuthMessage({ type: 'info', text: 'Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.' })
      } else {
        setAuthMessage({ type: 'success', text: 'Cuenta creada. ¡Bienvenido!' })
      }
    } else {
      const res = await signIn(authEmail, authPassword)
      if (!res.ok) {
        setAuthMessage({ type: 'error', text: friendlyAuthError(res.error ?? 'No se pudo iniciar sesión.') })
      }
    }
    setAuthLoading(false)
  }

  function handleLogout(): void {
    void signOut()
  }

  async function loadLeaderboard(): Promise<void> {
    if (!isLeaderboardEnabled()) {
      setLeaderboardByGen({})
      return
    }
    setLeaderboardLoading(true)
    const gens = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    const results = await Promise.all(gens.map((g) => fetchInfiniteLeaderboard(50, g)))
    const grouped: Record<number, LeaderboardEntry[]> = {}
    gens.forEach((g, i) => { grouped[g] = results[i] })
    setLeaderboardByGen(grouped)
    setLeaderboardLoading(false)
  }

  const latestChangelogVersion = getLatestChangelogVersion()
  const hasUnseenChangelog = latestChangelogVersion !== '' && seenChangelogVersion !== latestChangelogVersion

  function openChangelog(): void {
    playClick()
    setChangelogExpanded(null)
    setShowChangelog(true)
    if (latestChangelogVersion) {
      setSeenChangelogVersion(latestChangelogVersion)
      try { localStorage.setItem('pokerand_seen_changelog', latestChangelogVersion) } catch {}
    }
  }

  function resetToSetup(): void {
    // Si venimos de COLISEUM, restaura los desafíos que tenía el jugador antes
    // de que el modo los forzara (Nivel Fijo etc.), para que no se hereden en
    // otras partidas.
    if (preColiseumChallengesRef.current) {
      setRunChallenges(preColiseumChallengesRef.current)
      preColiseumChallengesRef.current = null
    }
    // Al volver al menú principal, borra la sesión cooperativa para no dejar
    // datos muertos en la base de datos.
    if (coopSessionCodeRef.current) void deleteCoopSessionRpc(coopSessionCodeRef.current)
    coopAutoStartedRef.current = false
    setScreen('setup')
    startMenuMusic()
    runStartTimeRef.current = 0
    setScoreSubmitState('idle')
    setSubmitIsNewBest(null)
    setShowEndRunModal(false)
    setVoluntaryRunEnd(false)
    setTeam([])
    setActiveIndex(0)
    setEnemy(null)
    setRoute([])
    setRouteIndex(0)
    setBranchMap(null)
    setBranchCol(0)
    setBranchMedals([])
    setInventory([])
    setMoney(100)
    setShopStock([])
    setModifier(null)
    setModifier2(null)
    setBattleLog([])
    setApiError('')
    setRestEncounter(null)
    setRestRewardItem('')
    setRestExtraItems([])
    setLegendaryEncounter(null)
    setDefeatSummary(null)
    setVictoryUnlocks(null)
    setDaycareEgg(null)
    setDaycareLoading(false)
    setEggHatch(null)
    setEggHatchPlacement('team')
    setWeatherStation(null)
    setRanchConfirm(null)
    setRanchResult(null)
    setIsTrainerBattle(false)
    // Si se abandona una run diaria a mitad (p. ej. con "Volver a inicio"),
    // se consume: no se puede repetir el Desafío del Día el mismo día.
    if (isDailyRunRef.current) {
      setDailyPlayed(true)
      localStorage.setItem('pokerand_daily', dailySeed)
    }
    isDailyRunRef.current = false
    if (preDailyDifficultyRef.current) {
      setDifficulty(preDailyDifficultyRef.current)
      preDailyDifficultyRef.current = null
    }
    setTrainerTeam([])
    setTrainerPokemonIndex(0)
    setTrainerName('')
    setTrainerSprite('')
    setTrainerBadge('')
    setIsTeamRocketBattle(false)
    setTeamRocketFainted(false)
    setTeamRocketTeam([])
    setTeamRocketStealMessage('')
    setTeamRocketPickModal(false)
    setCoopMode(false)
    setCoopSessionCode('')
    setCoopSeed('')
    setCoopJoinCode('')
    setCoopMyRole(null)
    setCoopPartnerJoined(false)
    setCoopWaiting(false)
    setCoopStarting(false)
    coopAutoStartedRef.current = false
    setCoopSessionEndedMsg('')
    setCoopTradeMsg('')
    setCoopError('')
    coopSubmittedOfferRef.current = null
    coopSelectedPokemonRef.current = null
    coopExchangeAppliedRef.current = false
    setBlackMarketItems([])
    setBlackMarketPokemon([])
    setDoubleEnemies([])
    setDoubleActives([])
    setDoubleMoves([null, null])
    setDoubleActiveSlot(0)
    setDoubleLog([])
    setDoubleFinished(false)
    setDoubleHits([])
    doubleHitKeyRef.current = 0
    setSpinItems([])
    setSpinWinnerIndex(null)
    setSpinRevealed(false)
    setSpinAnimating(false)
    setCasinoScore(null)
    setCasinoReward(null)
    setCasinoPlayed(false)
    setEggInventory([])
    setPcStorage([])
    setLeagueOffer(false)
    setLeagueTeamSelection(false)
    setTempLeagueTeam([])
    setSpeedrunSeconds(0)
    battleStartHPRef.current = 0
    battleMinHpRef.current = 0
    if (speedrunTimerRef.current) {
      clearInterval(speedrunTimerRef.current)
      speedrunTimerRef.current = null
    }
  }

  function onRestartRun(): void {
    setShowRestartConfirm(false)
    if (screen === 'pvp') {
      void pvpForfeit()
      return
    }
    if (screen === 'route' || screen === 'battle' || screen === 'shop' || screen === 'spin' || screen === 'pokeRand' || screen === 'move' || screen === 'mega' || screen === 'gmax' || screen === 'primal' || screen === 'trade' || screen === 'blackmarket' || screen === 'speculator' || screen === 'safari' || screen === 'orchard' || screen === 'fossil' || screen === 'fishing' || screen === 'mine' || screen === 'daycare' || screen === 'weather' || screen === 'mirror' || screen === 'ranch' || screen === 'double' || screen === 'casino') {
      // En Co-op, "Volver a inicio" solo sale a nivel local: NO se finaliza la
      // sesión, para no interrumpir la partida del compañero (la sesión queda
      // activa y el compañero puede continuar solo).
      resetToSetup()
    }
  }

  // Tecla R dentro de una aventura: muestra un modal de carga y resetea la run
  // con nodos nuevos (empieza de cero pero mantiene generación/dificultad/desafíos).
  const resetPendingRef = useRef(false)
  const startNewRunRef = useRef(startNewRun)
  startNewRunRef.current = startNewRun

  const quickReset = useCallback((): void => {
    if (coopModeRef.current) return
    if (isDailyRunRef.current) return
    if (document.querySelector('.modal-backdrop')) return
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    const adventure =
      screen === 'route' || screen === 'battle' || screen === 'shop' || screen === 'spin' ||
      screen === 'pokeRand' || screen === 'move' || screen === 'mega' || screen === 'gmax' ||
      screen === 'primal' || screen === 'trade' || screen === 'blackmarket' || screen === 'speculator' || screen === 'safari' || screen === 'orchard' || screen === 'fossil' || screen === 'fishing' || screen === 'mine' || screen === 'daycare' || screen === 'weather' || screen === 'mirror' || screen === 'ranch' || screen === 'double' ||
      screen === 'casino'
    if (!adventure) return
    if (resetPendingRef.current) return
    resetPendingRef.current = true
    playClick()
    setShowResetModal(true)
    setTimeout(() => {
      setShowResetModal(false)
      resetPendingRef.current = false
      void startNewRunRef.current(false)
    }, 1500)
  }, [screen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey) return
      quickReset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [quickReset])

  function closeOptions(): void {
    const wasInBattle = optionsBeganInBattle.current
    optionsBeganInBattle.current = false
    setShowOptions(false)
    if (wasInBattle) {
      startBattleMusic(true)
    } else {
      stopMusic()
      setTimeout(startMenuMusic, 350)
    }
  }

  const pokedexList = Object.values(pokedex)
  const normalDexList = pokedexList.filter(p => p.seen)
  const pokedexSeen = normalDexList.length
  const pokedexCaught = normalDexList.filter(p => p.caught).length
  const shinyDexList = pokedexList.filter(p => p.shinySeen)
  const shinyDexSeen = shinyDexList.length
  const shinyDexCaught = shinyDexList.filter(p => p.shinyCaught).length
  const activeDexList = pokedexMode === 'shiny' ? shinyDexList : normalDexList
  // PvP: Pokémon capturados (normales) y shinys capturados por separado.
  const pvpBuildNormalDex = pokedexList.filter(p => p.caught)
  const pvpBuildShinyDex = pokedexList.filter(p => p.shinyCaught)
  const pvpBuildSourceDex = pvpBuildDexMode === 'shiny' ? pvpBuildShinyDex : pvpBuildNormalDex

  const leaderboardActiveEntries: LeaderboardEntry[] = leaderboardGen === 0
    ? Object.values(leaderboardByGen).flat().sort((a, b) => (b.node - a.node) || (a.duration_seconds - b.duration_seconds))
    : (leaderboardByGen[leaderboardGen] ?? [])
  const filteredPokedex = activeDexList.filter((pkmn) => {
    const term = pokedexSearch.toLowerCase().trim()
    if (!term) return true
    const formattedId = `#${String(pkmn.id).padStart(3, '0')}`
    return pkmn.name.toLowerCase().includes(term) || String(pkmn.id).includes(term) || formattedId.includes(term)
  })

  const startMoneyBonus = ((isActive('start_money_1') ? 1 : 0) +
    (isActive('start_money_2') ? 1 : 0)) * 100

  const toggleMusicMuted = (): void => {
    playClick()
    const next = !musicMuted
    setMusicMuted(next)
    setMusicMutedState(next)
  }

  const enterSite = (): void => {
    if (introLeaving) return
    setIntroLeaving(true)
    unlockAudio()
    playClick()
    window.setTimeout(() => {
      setShowIntro(false)
      setIntroLeaving(false)
    }, 380)
  }

  return (
    <main className={`app-shell${screen === 'dungeon' ? ' app-shell--dungeon' : ''}${screen === 'pokest' ? ' app-shell--pokest' : ''}`}>
      {showIntro && (
        <div
          className={`pokerand-intro${introLeaving ? ' is-leaving' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={language === 'en' ? 'Enter PokeRand' : 'Entrar en PokeRand'}
          onClick={enterSite}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              enterSite()
            }
          }}
        >
          <div className="pokerand-intro-stars" aria-hidden="true" />
          <div className="pokerand-intro-content">
            <div className="pokerand-intro-ball" aria-hidden="true" />
            <h1 className="pokerand-intro-title">POKERAND</h1>
            <p className="pokerand-intro-sub">
              {language === 'en' ? 'Pokémon Roguelike Adventure' : 'Aventura Roguelike Pokémon'}
            </p>
            <div className="pokerand-intro-hint">
              {language === 'en' ? 'Click to enter' : 'Haz clic para entrar'}
              <span className="pokerand-intro-blink">▸</span>
            </div>
            <span className="pokerand-intro-note">
              {language === 'en' ? 'Click or press Enter' : 'Haz clic o pulsa Enter'}
            </span>
          </div>
        </div>
      )}
      {screen !== 'dungeon' && screen !== 'pokest' && <BackgroundLayer backgroundId={metaProgression.activeBackground} paused={accessibility.reduceAnimations || lowPerformance} />}
      {screen !== 'dungeon' && screen !== 'pokest' && (
      <header className="topbar">
        <TopbarCanvas paused={accessibility.reduceAnimations || lowPerformance} />
        <div className="left-toolbar">
          <button
            className="tiny-btn"
            type="button"
            title={musicMuted ? t('topbar.musicToggle') : t('topbar.musicMute')}
            onClick={toggleMusicMuted}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {musicMuted ? (
                <>
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </>
              ) : (
                <>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </>
              )}
            </svg>
          </button>
          <button className="tiny-btn" type="button" onClick={() => setShowPokedex(true)}>
            {t('topbar.pokedex')} ({pokedexCaught}/{pokedexSeen})
          </button>
          <button className="tiny-btn" type="button" onClick={() => { playClick(); optionsBeganInBattle.current = screen === 'battle'; setShowOptions(!showOptions) }}>
            {t('topbar.options')}
          </button>
          <button className="tiny-btn" type="button" onClick={openLeaderboard}>
            {t('topbar.ranking')}
          </button>
          <button className="tiny-btn" type="button" onClick={() => { playClick(); setShowAchievements(!showAchievements) }}>
            {t('topbar.achievements')}
          </button>
          {isActive('unlock_casino_node') && (
            <button className="tiny-btn" type="button" onClick={() => { playClick(); setShowMinigamePractice(true) }}>
              🎮 {t('topbar.minigames')}
            </button>
          )}
          <button className="tiny-btn" type="button" onClick={() => { playClick(); if (screen === 'setup') { onRestartRun() } else { setShowRestartConfirm(true) } }}>
            {t('topbar.restart')}
          </button>
          {!coopMode && (screen === 'route' || screen === 'battle' || screen === 'shop' || screen === 'spin' || screen === 'pokeRand' || screen === 'move' || screen === 'mega' || screen === 'gmax' || screen === 'primal' || screen === 'trade' || screen === 'blackmarket' || screen === 'speculator' || screen === 'safari' || screen === 'orchard' || screen === 'fossil' || screen === 'fishing' || screen === 'mine' || screen === 'daycare' || screen === 'weather' || screen === 'mirror' || screen === 'ranch' || screen === 'double' || screen === 'casino') && (
            <button
              className="tiny-btn"
              type="button"
              onClick={() => { playClick(); quickReset() }}
              style={{ color: '#ff8a33', borderColor: '#ff8a33' }}
            >
              {t('topbar.quickRestart')}
            </button>
          )}
        </div>
        <h1 style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
          PokeRand
          <button
            type="button"
            onClick={() => { playClick(); setShowHelpModal(true) }}
            title={hasUnseenChangelog ? t('changelog.title') : t('help.title')}
            style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(155,152,207,0.4)',
              color: '#9b98cf', fontSize: '0.62rem', fontFamily: "'Courier New', monospace", cursor: 'pointer',
              padding: '3px 9px', borderRadius: '999px', lineHeight: 1,
              WebkitTextFillColor: '#9b98cf', textTransform: 'none', letterSpacing: '0',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.webkitTextFillColor = '#ffcb05'; e.currentTarget.style.color = '#ffcb05' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.webkitTextFillColor = '#9b98cf'; e.currentTarget.style.color = '#9b98cf' }}
          >
            {t('help.version')}
            {hasUnseenChangelog && (
              <span className="version-badge-blink" aria-label="Novedades sin ver" style={{ position: 'absolute', top: '-5px', right: '-5px', width: '13px', height: '13px', borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 0 0 2px #12122b' }}>!</span>
            )}
          </button>
        </h1>
        <div className="topbar-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div className="record-box">
            {winStreak >= 2 && <span style={{ color: '#ff8a33', fontWeight: 'bold', marginRight: '0.5rem' }}>🔥 {winStreak}</span>}
            <span style={{ color: '#ffcb05', fontWeight: 'bold' }}>🪙 {metaProgression.pokeCoins}</span>
            {secretUnlocked && (
              <button
                className="tiny-btn"
                type="button"
                onClick={addSecretCoins}
                title="Modo secreto: +100 PokéCoins"
                style={{ marginLeft: '0.4rem', color: '#ffcb05', background: '#2a2a55', fontWeight: 'bold', padding: '2px 8px' }}
              >
                +
              </button>
            )}
            <span style={{ color: '#ffcb05', fontWeight: 'bold', marginLeft: '0.5rem' }}>💵 ${screen === 'setup' ? 100 + startMoneyBonus : money}</span>
            {daycareEgg && (
              <span title={language === 'en' ? 'Egg hatching soon' : 'Huevo a punto de eclosionar'} style={{ color: '#fde68a', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                🥚 {daycareEgg.nodesLeft}
              </span>
            )}
            {weatherStation && (
              <span title={language === 'en' ? 'Weather Station battles left' : 'Combates con clima restantes'} style={{ color: '#93c5fd', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                🌦️ {weatherStation.battlesLeft}
              </span>
            )}
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>W {record.wins}</span>
            <span style={{ color: '#ee3b2f', fontWeight: 'bold' }}>L {record.losses}</span>
          </div>
          <button
            className="tiny-btn"
            type="button"
            onClick={() => {
              playClick()
              if (isActive('unlock_history')) {
                setShowMatchHistory(true)
              } else {
                setShowMetaShop(true)
              }
            }}
            title={isActive('unlock_history')
              ? (language === 'en' ? 'Match history' : 'Historial de partidas')
              : (language === 'en' ? 'Buy the Match History in the meta shop' : 'Compra el Historial en la tienda meta')}
            style={{ color: '#4d9bff', borderColor: isActive('unlock_history') ? 'rgba(77,155,255,0.5)' : 'rgba(155,152,207,0.4)' }}
          >
            {language === 'en' ? 'History' : 'Historial'}
            {!isActive('unlock_history') && ' 🔒'}
          </button>
        </div>
      </header>
      )}

      {screen === 'dungeon' && (
        <Suspense fallback={<LazyLoadingPanel label={language === 'en' ? 'Loading dungeon...' : 'Cargando mazmorra...'} />}>
          <DungeonMode language={language} onExit={() => setScreen('setup')} />
        </Suspense>
      )}

      {screen === 'pokest' && createPortal(
        <Suspense fallback={<LazyLoadingPanel label={language === 'en' ? 'Loading...' : 'Cargando...'} />}>
          <PokestDungeon language={language} onExit={() => setScreen('setup')} />
        </Suspense>,
        document.body,
      )}

      {/* Modal Revive: selección de objetivo */}
      {reviveModal && (
        <div className="modal-backdrop" onClick={() => setReviveModal(null)}>
          <div
            className="panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '1.5rem',
              maxWidth: '380px',
              width: '90%',
              margin: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              {ITEM_SPRITES[reviveModal.itemName] && (
                <img
                  src={ITEM_SPRITES[reviveModal.itemName]}
                  alt={reviveModal.itemName}
                  style={{ width: '36px', height: '36px', imageRendering: 'pixelated' }}
                />
              )}
              <div>
                <h3 style={{ margin: 0, color: '#ffcb05', fontSize: '1.1rem' }}>{itemLocalizedName(reviveModal.itemName)}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#9b98cf' }}>
                  {reviveModal.itemName === 'Max Revive' ? 'Revive con HP completo' : 'Revive con 50% HP'}
                </p>
              </div>
            </div>
            <p style={{ color: '#d9d6f2', fontSize: '0.85rem', marginBottom: '1rem' }}>Elige a qué Pokémon debilitado dárselo:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {team.map((pkmn, idx) => {
                const isFainted = pkmn.hp <= 0
                const restoredHp = reviveModal.itemName === 'Max Revive' ? pkmn.maxHp : Math.floor(pkmn.maxHp * 0.5)
                return (
                  <button
                    key={`revive-target-${idx}`}
                    type="button"
                    onClick={() => applyRevive(idx)}
                    disabled={!isFainted}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: isFainted ? '1px solid rgba(250, 204, 21, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                      background: isFainted ? 'rgba(250, 204, 21, 0.08)' : 'rgba(255,255,255,0.03)',
                      cursor: isFainted ? 'pointer' : 'not-allowed',
                      opacity: isFainted ? 1 : 0.45,
                      transition: 'all 0.2s'
                    }}
                  >
                    <img
                      src={pkmn.sprite}
                      alt={pkmn.name}
                      onError={fallbackSprite}
                      style={{
                        width: '44px',
                        height: '44px',
                        filter: isFainted ? 'none' : 'grayscale(100%)',
                        opacity: isFainted ? 1 : 0.5
                      }}
                    />
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '0.95rem', textTransform: 'capitalize', color: isFainted ? '#f8fafc' : '#7d7ab5' }}>
                        {pkmn.name}
                        <StatusBadge status={pkmn.status} compact />
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: isFainted ? '#9b98cf' : '#475569' }}>
                        Nv. {pkmn.level} · HP: {pkmn.hp}/{pkmn.maxHp}
                      </span>
                    </div>
                    {isFainted && (
                      <span style={{ fontSize: '0.8rem', color: '#7ceb95', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        → {restoredHp} HP
                      </span>
                    )}
                    {!isFainted && (
                      <span style={{ fontSize: '0.75rem', color: '#7d7ab5' }}>No debilitado</span>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => setReviveModal(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal Máquina de Naturalezas / Reroll de IVs / Cápsula de Habilidad */}
      {metaEditModal && (
        <div className="modal-backdrop" onClick={() => { setMetaEditModal(null); setAbilityTargetIdx(null); setAbilityChoices(null) }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ padding: '1.5rem', maxWidth: '380px', width: '90%', margin: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              {ITEM_SPRITES[metaEditModal.kind === 'nature' ? 'Máquina de Naturalezas' : metaEditModal.kind === 'ivs' ? 'Reroll de IVs' : 'Cápsula de Habilidad'] && (
                <img
                  src={ITEM_SPRITES[metaEditModal.kind === 'nature' ? 'Máquina de Naturalezas' : metaEditModal.kind === 'ivs' ? 'Reroll de IVs' : 'Cápsula de Habilidad']}
                  alt=""
                  style={{ width: '36px', height: '36px', imageRendering: 'pixelated' }}
                />
              )}
              <div>
                <h3 style={{ margin: 0, color: '#ffcb05', fontSize: '1.1rem' }}>
                  {itemLocalizedName(metaEditModal.kind === 'nature' ? 'Máquina de Naturalezas' : metaEditModal.kind === 'ivs' ? 'Reroll de IVs' : 'Cápsula de Habilidad')}
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#9b98cf' }}>
                  {metaEditModal.kind === 'nature' ? t('metaEdit.naturePrompt') : metaEditModal.kind === 'ivs' ? t('metaEdit.ivsPrompt') : t('metaEdit.abilityPrompt')}
                </p>
              </div>
            </div>

            {metaEditModal.kind === 'ability' && abilityChoices !== null && abilityTargetIdx !== null ? (
              <>
                <p style={{ color: '#d9d6f2', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  {t('metaEdit.abilityCurrent', { name: team[abilityTargetIdx]?.name ?? '', ability: abilityName(team[abilityTargetIdx]?.ability, getLanguage()) })}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {abilityChoices.map((ab) => (
                    <button
                      key={ab}
                      type="button"
                      className="tiny-btn"
                      style={{ width: '100%', justifyContent: 'flex-start', color: '#9da6ff' }}
                      onClick={() => void applyAbilityChange(abilityTargetIdx, ab)}
                    >
                      {abilityName(ab, getLanguage())} — {abilityDesc(ab, getLanguage())}
                    </button>
                  ))}
                </div>
                <button type="button" className="secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => { setAbilityChoices(null); setAbilityTargetIdx(null) }}>
                  {t('common.cancel')}
                </button>
              </>
            ) : (
              <>
                <p style={{ color: '#d9d6f2', fontSize: '0.85rem', marginBottom: '1rem' }}>{t('metaEdit.choosePokemon')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {team.map((pkmn, idx) => {
                    const isAlive = pkmn.hp > 0
                    const showAbilityPreview = metaEditModal.kind === 'ability'
                    return (
                      <button
                        key={`metaedit-target-${idx}`}
                        type="button"
                        disabled={!isAlive}
                        onClick={() => {
                          if (metaEditModal.kind === 'ability') {
                            setAbilityTargetIdx(idx)
                            void getPokemonAbilities(pkmn.id).then((list) => {
                              const alts = list.filter(a => a !== pkmn.ability)
                              setAbilityChoices(alts.length > 0 ? alts : [])
                              if (alts.length === 0) {
                                setBattleLog(prev => [t('b.abilityNoAlternative', { name: pkmn.name }), ...prev].slice(0, 15))
                                setMetaEditModal(null)
                                setAbilityTargetIdx(null)
                                setAbilityChoices(null)
                              }
                            }).catch(() => {
                              setBattleLog(prev => [t('b.abilityNoAlternative', { name: pkmn.name }), ...prev].slice(0, 15))
                              setMetaEditModal(null)
                              setAbilityTargetIdx(null)
                              setAbilityChoices(null)
                            })
                          } else if (metaEditModal.kind === 'nature') {
                            applyNatureMachine(idx)
                          } else {
                            applyIvReroll(idx)
                          }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                          opacity: isAlive ? 1 : 0.45, cursor: isAlive ? 'pointer' : 'not-allowed',
                          background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: '8px', padding: '8px 10px'
                        }}
                      >
                        <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} />
                        <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                          <strong style={{ display: 'block', fontSize: '0.85rem', textTransform: 'capitalize', color: isAlive ? '#f8fafc' : '#7d7ab5' }}>{pkmn.name}</strong>
                          {showAbilityPreview && pkmn.ability && (
                            <span style={{ fontSize: '0.7rem', color: '#9da6ff' }}>{abilityName(pkmn.ability, getLanguage())}</span>
                          )}
                          {!showAbilityPreview && (
                            <span style={{ fontSize: '0.7rem', color: '#7d7ab5' }}>Nv. {pkmn.level}</span>
                          )}
                        </div>
                        {!isAlive && <span style={{ fontSize: '0.7rem', color: '#ff8a80' }}>{t('pvp.defeated')}</span>}
                      </button>
                    )
                  })}
                </div>
                <button type="button" className="secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => { setMetaEditModal(null); setAbilityTargetIdx(null); setAbilityChoices(null) }}>
                  {t('common.cancel')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Equipar Objeto Pasivo */}
      {equipModal && (
        <div className="modal-backdrop" onClick={() => setEquipModal(null)}>
          <div
            className="panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '1.5rem',
              maxWidth: '380px',
              width: '90%',
              margin: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              {ITEM_SPRITES[equipModal.itemName] && (
                <img
                  src={ITEM_SPRITES[equipModal.itemName]}
                  alt={equipModal.itemName}
                  style={{ width: '36px', height: '36px', imageRendering: 'pixelated' }}
                />
              )}
              <div>
                <h3 style={{ margin: 0, color: '#cba3ff', fontSize: '1.1rem' }}>{itemLocalizedName(equipModal.itemName)}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#9b98cf' }}>
                  {itemDesc(equipModal.itemName)}
                </p>
              </div>
            </div>
            <p style={{ color: '#d9d6f2', fontSize: '0.85rem', marginBottom: '1rem' }}>Elige a qué Pokémon equipárselo:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {team.map((pkmn, idx) => {
                const isAlive = pkmn.hp > 0
                const hasItem = !!pkmn.holdItem
                const canEquip = isAlive && !hasItem
                const eff = getEffectiveStats(pkmn)
                const item = HOLDABLE_ITEMS[equipModal.itemName]
                const isGmaxEquip = equipModal.itemName === 'Dynamax Band'
                const isMegaEquip = equipModal.itemName === 'Mega Stone'
                const isPrimalEquip = equipModal.itemName === 'Prisma Rojo' || equipModal.itemName === 'Prisma Azul'
                const isOriginEquip = equipModal.itemName === 'Diamansfera' || equipModal.itemName === 'Lustresfera' || equipModal.itemName === 'Griseosfera'
                const canUseTransform = isGmaxEquip ? GMAX_CAPABLE_IDS.has(pkmn.id) : isMegaEquip ? MEGA_CAPABLE_IDS.has(pkmn.id) : isPrimalEquip ? PRIMAL_CAPABLE_IDS.has(pkmn.id) : isOriginEquip ? ORIGIN_CAPABLE_IDS.has(pkmn.id) : false
                const highlightGreen = canEquip && (isGmaxEquip || isMegaEquip || isPrimalEquip || isOriginEquip) && canUseTransform
                return (
                  <button
                    key={`equip-target-${idx}`}
                    type="button"
                    onClick={() => {
                      equipItem(equipModal.itemName, idx)
                      setEquipModal(null)
                    }}
                    disabled={!canEquip}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: highlightGreen ? '1px solid rgba(74, 222, 128, 0.6)' : canEquip ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                      background: highlightGreen ? 'rgba(74, 222, 128, 0.12)' : canEquip ? 'rgba(168, 85, 247, 0.08)' : 'rgba(255,255,255,0.03)',
                      cursor: canEquip ? 'pointer' : 'not-allowed',
                      opacity: canEquip ? 1 : 0.45,
                      transition: 'all 0.2s'
                    }}
                  >
                    <img
                      src={pkmn.sprite}
                      alt={pkmn.name}
                      onError={fallbackSprite}
                      style={{
                        width: '44px',
                        height: '44px',
                        filter: isAlive ? 'none' : 'grayscale(100%)',
                        opacity: isAlive ? 1 : 0.5
                      }}
                    />
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '0.95rem', textTransform: 'capitalize', color: canEquip ? '#f8fafc' : '#7d7ab5' }}>
                        {pkmn.name}
                        <StatusBadge status={pkmn.status} compact />
                        {pkmn.holdItem && <span style={{ fontSize: '0.7rem', color: '#b8a1ff', marginLeft: '6px' }}>({itemLocalizedName(pkmn.holdItem)})</span>}
                        {isGmaxEquip && (
                          <span style={{ fontSize: '0.7rem', color: canUseTransform ? '#4ade80' : '#7d7ab5', marginLeft: '6px' }}>
                            {canUseTransform ? '✓ Puede Gigamax' : 'No puede'}
                          </span>
                        )}
                        {isMegaEquip && (
                          <span style={{ fontSize: '0.7rem', color: canUseTransform ? '#4ade80' : '#7d7ab5', marginLeft: '6px' }}>
                            {canUseTransform ? '✓ Puede Mega' : 'No puede'}
                          </span>
                        )}
                        {isOriginEquip && (
                          <span style={{ fontSize: '0.7rem', color: canUseTransform ? '#4ade80' : '#7d7ab5', marginLeft: '6px' }}>
                            {canUseTransform ? '✓ Puede Forma Origen' : 'No puede'}
                          </span>
                        )}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: canEquip ? '#9b98cf' : '#475569' }}>
                        Nv. {pkmn.level} · ATK: {eff.attack} · DEF: {eff.defense} · At.Esp: {eff.spAttack} · Def.Esp: {eff.spDefense} · SPD: {eff.speed}
                      </span>
                    </div>
                    {canEquip && item && (
                      <div style={{ fontSize: '0.65rem', color: '#cba3ff', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {item.attackMod && <div>ATK {eff.attack} → {Math.round(pkmn.attack * (1 + item.attackMod))}</div>}
                        {item.defenseMod && <div>DEF {eff.defense} → {Math.round(pkmn.defense * (1 + item.defenseMod))}</div>}
                        {item.spAttackMod && <div>At.Esp {eff.spAttack} → {Math.round(pkmn.spAttack * (1 + item.spAttackMod))}</div>}
                        {item.spDefenseMod && <div>Def.Esp {eff.spDefense} → {Math.round(pkmn.spDefense * (1 + item.spDefenseMod))}</div>}
                        {item.speedMod && <div>SPD {eff.speed} → {Math.round(pkmn.speed * (1 + item.speedMod))}</div>}
                        {item.maxHpMod && <div>HP {pkmn.maxHp} → {pkmn.maxHp + item.maxHpMod}</div>}
                        {item.healPerTurn && item.healPerTurn > 0 && <div>+{item.healPerTurn} HP/turno</div>}
                        {item.healPerTurn && item.healPerTurn < 0 && <div>{item.healPerTurn} HP/turno</div>}
                        {item.damageBoost && <div>+{Math.round(item.damageBoost * 100)}% daño</div>}
                        {item.typeBoost && <div>+{Math.round(item.typeBoost.boost * 100)}% daño {item.typeBoost.types.map(t => t === 'steel' ? 'Acero' : t === 'dragon' ? 'Dragón' : t === 'water' ? 'Agua' : t === 'ghost' ? 'Fantasma' : t).join('/')} ({item.typeBoost.onlyIds?.includes(483) ? 'Dialga' : item.typeBoost.onlyIds?.includes(484) ? 'Palkia' : item.typeBoost.onlyIds?.includes(487) ? 'Giratina' : 'específico'})</div>}
                      </div>
                    )}
                    {!isAlive && (
                      <span style={{ fontSize: '0.75rem', color: '#7d7ab5' }}>Debilitado</span>
                    )}
                    {hasItem && (
                      <span style={{ fontSize: '0.75rem', color: '#7d7ab5' }}>Ocupado</span>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => setEquipModal(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Stone Evolution Modal */}
      {stoneEvoModal && (
        <div className="modal-backdrop" onClick={() => { setStoneEvoModal(null); setStoneEvoTargets([]); setStoneEvoCanEvolve(new Set()) }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', color: '#4d9bff' }}>Evolucionar con {stoneEvoModal.stoneName}</h3>
            <p style={{ fontSize: '0.85rem', color: '#9b98cf', marginBottom: '1rem' }}>Selecciona un Pokémon para evolucionar:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stoneEvoTargets.map((pkmn, idx) => {
                const realIdx = team.indexOf(pkmn)
                const canEvo = stoneEvoCanEvolve.has(realIdx)
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px',
                    background: canEvo ? 'rgba(74,222,128,0.12)' : 'rgba(30,41,59,0.6)',
                    border: canEvo ? '1px solid rgba(74,222,128,0.6)' : '1px solid #3f3f6e',
                    boxShadow: canEvo ? '0 0 10px rgba(74,222,128,0.35)' : 'none',
                    cursor: 'pointer'
                  }}
                    onClick={() => handleStoneEvolution(realIdx)}>
                    <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '40px', height: '40px' }} />
                    <div>
                      <strong style={{ textTransform: 'capitalize', color: canEvo ? '#a7f3d0' : '#f3f1ff' }}>{pkmn.name}</strong>
                      <StatusBadge status={pkmn.status} compact />
                      <span style={{ fontSize: '0.75rem', color: '#9b98cf', marginLeft: '8px' }}>Nv.{pkmn.level}</span>
                      {canEvo && <span style={{ fontSize: '0.7rem', color: '#4ade80', marginLeft: '8px' }}>✓ Puede evolucionar</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Capture Modal */}
      {captureModal && enemy && (
        <div className="modal-backdrop" onClick={() => setCaptureModal(false)}>
          <div
            className="panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '1.5rem',
              maxWidth: '420px',
              width: '90%',
              margin: 'auto'
            }}
          >
            <h3 style={{ margin: '0 0 0.25rem', color: '#37d16b', textAlign: 'center' }}>
              🏐 Capturar {enemy.name}<StatusBadge status={enemy.status} />
            </h3>
            <p className="muted" style={{ textAlign: 'center', margin: '0 0 1rem', fontSize: '0.8rem' }}>
              HP: {enemy.hp}/{enemy.maxHp} · Turno: {battleTurns}
              {enemy.status && ` · ${statusLabel(enemy.status.type)}`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {POKEBALLS.map(b => {
                const count = inventory.filter(i => i === b.name).length
                const unlockId = POKEBALL_UNLOCK_IDS[b.name]
                const isUnlocked = b.name === 'Poké Ball' || !unlockId || isActive(unlockId)
                if (count <= 0) return null
                if (!isUnlocked) return null
                const ballRate = getPokeBallRate(b.name, enemy, battleTurns, !!pokedex[enemy.id]?.caught, activePokemon?.level ?? 50)
                const hpFactor = Math.max(0.05, (3 * enemy.maxHp - 2 * enemy.hp) / (3 * enemy.maxHp))
                const statusMult = enemy.status ? (enemy.status.type === 'sleep' || enemy.status.type === 'freeze' ? 2.5 : 1.5) : 1
                const speciesRate = (enemy.captureRate ?? 45) / 255
                const catchAbilityBonus = hasAbility(activePokemon, 'illuminate') ? 1.2 : hasAbility(activePokemon, 'run-away') ? 1.1 : 1
                const chance = b.isMaster ? 100 : Math.min(Math.round(hpFactor * ballRate * statusMult * speciesRate * catchAbilityBonus * 100), 100)
                return (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => attemptCapture(b.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      background: 'rgba(34, 197, 94, 0.06)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      color: '#f3f1ff'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.06)' }}
                  >
                    {ITEM_SPRITES[b.name] && (
                      <img src={ITEM_SPRITES[b.name]} alt={b.name} style={{ width: '32px', height: '32px', imageRendering: 'pixelated' }} />
                    )}
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <strong>{b.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#9b98cf', marginLeft: '8px' }}>x{count}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: chance >= 90 ? '#37d16b' : chance >= 50 ? '#eab308' : chance >= 20 ? '#ff8a33' : '#ee3b2f', fontSize: '1.3rem' }}>
                        {chance}%
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#7d7ab5' }}>{b.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => setCaptureModal(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Resumen de captura: naturaleza, IVs y habilidad del ejemplar */}
      {captureSummary && (
        <div className="modal-backdrop" onClick={closeCaptureSummary}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px', textAlign: 'center', padding: '1.5rem' }}>
            <h3 style={{ color: '#4d9bff', margin: '0 0 0.5rem' }}>{t('capture.summary')}</h3>
            <div style={{ margin: '0.25rem 0' }}>
              <img className="sprite" src={captureSummary.sprite} alt={captureSummary.name} onError={fallbackSprite} style={{ width: '96px', height: '96px', imageRendering: 'pixelated' }} />
            </div>
            <h4 style={{ margin: '0 0 0.75rem', color: '#f3f1ff', textTransform: 'capitalize' }}>
              {captureSummary.name}{captureSummary.shiny ? ' ✨' : ''} <span style={{ color: '#7d7ab5', fontSize: '0.8rem' }}>Nv.{captureSummary.level}</span>
            </h4>
            <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '0.75rem' }}>
              <PokemonMetaTooltip p={captureSummary} showHeader={false} />
            </div>
            <button className="cta" onClick={closeCaptureSummary} type="button" style={{ marginTop: '1rem', width: '100%' }}>{t('route.continue')}</button>
          </div>
        </div>
      )}

      {eggHatch && createPortal(
        <div className="modal-backdrop" onClick={() => setEggHatch(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px', textAlign: 'center', padding: '1.5rem' }}>
            <h3 style={{ color: '#fde68a', margin: '0 0 0.5rem' }}>🥚 ¡El huevo ha eclosionado!</h3>
            <img src={eggHatch.sprite} alt={eggHatch.name} onError={fallbackSprite} style={{ width: '96px', height: '96px', imageRendering: 'pixelated' }} />
            <h4 style={{ color: '#f3f1ff', margin: '0.4rem 0 0.25rem', textTransform: 'capitalize' }}>
              {eggHatch.name}{eggHatch.shiny ? ' ✨' : ''} <span style={{ color: '#7d7ab5', fontSize: '0.8rem' }}>Nv.{eggHatch.level}</span>
            </h4>
            <p style={{ color: '#d9d6f2', fontSize: '0.78rem', margin: '0 0 0.25rem' }}>
              {t('stat.ability')}: {abilityName(eggHatch.ability, language)} · {t('stat.nature')}: {natureName(eggHatch.nature, language)}
            </p>
            <p style={{ color: '#9b98cf', fontSize: '0.78rem', margin: '0 0 0.9rem' }}>
              Se ha unido a {eggHatchPlacement === 'team' ? (language === 'en' ? 'your team' : 'tu equipo') : (language === 'en' ? 'your PC' : 'tu PC')}.
            </p>
            <button className="cta" type="button" onClick={() => setEggHatch(null)} style={{ width: '100%' }}>Cerrar</button>
          </div>
        </div>,
        document.body,
      )}

      {/* Evolution popup */}
      {evoPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, background: 'rgba(0,0,0,0.6)', animation: 'evoFadeIn 0.3s' }}>
          <div style={{ textAlign: 'center', padding: '2rem', borderRadius: '6px', background: '#1c1c3a', border: '3px solid #4d9bff', boxShadow: '4px 4px 0 0 rgba(0,0,0,0.55)' }}>
            <p style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem' }}>✨ ¡Evolución!</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'center' }}>
              <div style={{ animation: 'evoFlash 0.6s' }}>
                <img src={evoPopup.oldSprite} alt="" style={{ width: '80px', height: '80px', imageRendering: 'pixelated', filter: 'brightness(2) sepia(0.5)' }} />
              </div>
              <span style={{ color: '#9b98cf', fontSize: '1.5rem' }}>→</span>
              <div style={{ animation: 'evoAppear 0.6s' }}>
                <img src={evoPopup.newSprite} alt="" style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }} />
              </div>
            </div>
            <p style={{ color: '#f3f1ff', marginTop: '0.75rem' }}>
              <span style={{ textTransform: 'capitalize' }}>{evoPopup.oldName}</span>
              {' '}evolucionó en{' '}
              <strong style={{ color: '#4d9bff', textTransform: 'capitalize' }}>{evoPopup.newName}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Capture message overlay */}
      {captureMessage && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.85)', color: '#ffcb05', padding: '1.5rem 2.5rem',
          borderRadius: '16px', fontSize: '1.2rem', fontWeight: 'bold',
          border: '2px solid #ffcb05', zIndex: 10000,
          textAlign: 'center', pointerEvents: 'none', animation: 'fadeIn 0.3s ease'
        }}>
          {captureMessage}
        </div>
      )}

      {/* Modal Pokédex */}
      {showPokedex && (
        <div className="modal-backdrop" onClick={() => { setShowPokedex(false); setSelectedPokemonDetail(null); setSelectedPokemonShiny(false); setPokedexSearch(''); }}>
          <div className="pokedex-frame" onClick={(e) => e.stopPropagation()}>
            <div className="pokedex-top-bar">
              <div className="big-blue-sensor"></div>
              <div className="mini-leds">
                <div className="led red"></div>
                <div className="led yellow"></div>
                <div className="led green"></div>
              </div>
            </div>

            <div className="pokedex-screen">
              {selectedPokemonDetail ? (
                <div className="pokedex-detail-view">
                  <button className="tiny-btn back-btn" onClick={() => setSelectedPokemonDetail(null)}>
                    {t('minigames.backToList')}
                  </button>

                  <div className="detail-header" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <img
                      className="high-res-img"
                      src={selectedPokemonShiny && selectedPokemonDetail.highResImageShiny ? selectedPokemonDetail.highResImageShiny : selectedPokemonDetail.highResImage}
                      alt={selectedPokemonDetail.name}
                    />
                    <div className="detail-title">
                      <span className="pokedex-id">#{String(selectedPokemonDetail.id).padStart(3, '0')}</span>
                      <h2 style={{ textTransform: 'capitalize', margin: '4px 0 8px 0', color: '#4d9bff' }}>
                        {selectedPokemonDetail.name}
                      </h2>
                      <div className="types-list" style={{ display: 'flex', gap: '4px' }}>
                        {selectedPokemonDetail.types.map((t) => (
                          <span key={t} className="type-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {typeIconUrl(t) && (
                              <img
                                src={typeIconUrl(t)}
                                alt={t}
                                style={{ width: '16px', height: '16px', imageRendering: 'pixelated' }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                            )}
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="description-box">{selectedPokemonDetail.description}</p>

                  <div className="physical-stats">
                    <div>
                      <span>{t('pokedex.height')}</span>
                      <strong>{selectedPokemonDetail.height} m</strong>
                    </div>
                    <div>
                      <span>{t('pokedex.weight')}</span>
                      <strong>{selectedPokemonDetail.weight} kg</strong>
                    </div>
                  </div>

                  {selectedPokemonDetail.evolutions.length > 0 && (
                    <>
                      <h3 style={{ fontSize: '0.9rem', color: '#9b98cf', marginTop: '12px' }}>{t('pokedex.evoChain')}</h3>
                      <div className="evolution-chain" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', padding: '8px 0' }}>
                        {(() => {
                          const evos = selectedPokemonDetail.evolutions
                          // Se reconstruye el árbol evolutivo. Si el nodo trae
                          // `parent` (cadenas genéricas) se usa directamente; si
                          // no (cadenas manuales tipo Eevee/Pikachu) se deduce
                          // con la rama: un hermano comparte el padre del anterior.
                          const byId = new Map<number, (typeof evos)[number]>()
                          evos.forEach(ev => byId.set(ev.id, ev))
                          const childrenByParent = new Map<number, (typeof evos)[number][]>()
                          let prevParent: (typeof evos)[number] | undefined
                          evos.forEach((ev, i) => {
                            if (i === 0) return
                            let parent: (typeof evos)[number] | undefined
                            if (ev.parent != null) {
                              parent = byId.get(ev.parent)
                            } else if (!ev.branch) {
                              parent = evos[i - 1]
                            } else {
                              parent = prevParent
                            }
                            if (!parent) parent = evos[0]
                            if (!childrenByParent.has(parent.id)) childrenByParent.set(parent.id, [])
                            childrenByParent.get(parent.id)!.push(ev)
                            prevParent = parent
                          })

                          const renderCard = (evo: (typeof evos)[number]): ReactNode => {
                            const entry = pokedex[evo.id]
                            const known = selectedPokemonShiny ? (entry?.shinyCaught ?? false) : !!entry?.caught
                            return (
                              <div
                                className="pokedex-card"
                                style={{
                                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                                  padding: '6px', borderRadius: '8px', background: 'rgba(15,23,42,0.6)',
                                  border: evo.id === selectedPokemonDetail.id ? '2px solid #4d9bff' : '1px solid #3f3f6e',
                                  minWidth: '80px', opacity: known ? 1 : 0.5, cursor: known ? 'pointer' : 'default'
                                }}
                                onClick={() => known && handleSelectPokedexPokemon(evo.id, selectedPokemonShiny)}
                              >
                                <img
                                  src={pokemonSpriteUrl(evo.id, selectedPokemonShiny)}
                                  alt={evo.name}
                                  onError={(e) => { (e.target as HTMLImageElement).src = evo.sprite }}
                                  style={{ width: '56px', height: '56px', imageRendering: 'pixelated', filter: known ? undefined : 'brightness(0) invert(0)' }}
                                />
                                <strong style={{ textTransform: 'capitalize', fontSize: '0.75rem', color: evo.id === selectedPokemonDetail.id ? '#4d9bff' : '#f3f1ff', textAlign: 'center' }}>
                                  {known ? evo.name : '???'}
                                </strong>
                                {evo.item && (
                                  <span style={{ fontSize: '0.72rem', color: '#ffcb05', fontWeight: 'bold', textAlign: 'center' }}>{itemLocalizedName(evo.item)}</span>
                                )}
                                {evo.level && (
                                  <span style={{ fontSize: '0.85rem', color: '#a855f7', fontWeight: 'bold' }}>{t('pokedex.lv')} {evo.level}</span>
                                )}
                                {!evo.level && !evo.item && evo.trigger && evo.trigger !== 'level-up' && (
                                  <span style={{ fontSize: '0.85rem', color: '#ffcb05', fontWeight: 'bold' }}>{t(`evo.trigger.${evo.trigger}`)}</span>
                                )}
                                {evo.chance != null && (
                                  <span style={{ fontSize: '0.72rem', color: '#4d9bff', fontWeight: 'bold', textAlign: 'center' }}>{t('pokedex.chance')} {evo.chance}%</span>
                                )}
                              </div>
                            )
                          }

                          const renderNode = (evo: (typeof evos)[number]): ReactNode => {
                            // Nodo grupo (p. ej. las formas de Wormadam): no se
                            // dibuja tarjeta propia, solo sus hijos en horizontal.
                            if (evo.isGroup) {
                              const groupKids = childrenByParent.get(evo.id) ?? []
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                  {groupKids.map((k, i) => (
                                    <Fragment key={`${k.id}-g-${i}`}>
                                      {i > 0 && <span style={{ color: '#7d7ab5', fontSize: '1.2rem' }}>/</span>}
                                      {renderCard(k)}
                                    </Fragment>
                                  ))}
                                </div>
                              )
                            }
                            const kids = childrenByParent.get(evo.id) ?? []
                            // Un hijo con el mismo id que su padre (las formas de
                            // Wormadam, p. ej. planta) se muestra como tarjeta
                            // hoja para no entrar en bucle.
                            const realKids = kids.filter(k => k.id !== evo.id)
                            const selfKids = kids.filter(k => k.id === evo.id)
                            if (realKids.length === 0) {
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                  {renderCard(evo)}
                                  {selfKids.map((k, i) => (
                                    <Fragment key={`${k.id}-s-${i}`}>
                                      <span style={{ color: '#7d7ab5', fontSize: '1.2rem' }}>{i === 0 ? '→' : '/'}</span>
                                      {renderCard(k)}
                                    </Fragment>
                                  ))}
                                </div>
                              )
                            }
                            if (realKids.length === 1) {
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                  {renderCard(evo)}
                                  {selfKids.map((k, i) => (
                                    <Fragment key={`${k.id}-s-${i}`}>
                                      <span style={{ color: '#7d7ab5', fontSize: '1.2rem' }}>{i === 0 ? '→' : '/'}</span>
                                      {renderCard(k)}
                                    </Fragment>
                                  ))}
                                  <span style={{ color: '#7d7ab5', fontSize: '1.2rem' }}>→</span>
                                  {renderNode(realKids[0])}
                                </div>
                              )
                            }
                            const hasNested = realKids.some(k => (childrenByParent.get(k.id) ?? []).some(c => c.id !== k.id))
                            if (!hasNested) {
                              // Hermanos sin descendencia (Eevee, Ralts, Scyther...):
                              // se muestran en horizontal separados por "/".
                              const allKids = [...selfKids, ...realKids]
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                  {renderCard(evo)}
                                  {allKids.map((k, i) => (
                                    <Fragment key={`${k.id}-${i}`}>
                                      <span style={{ color: '#7d7ab5', fontSize: '1.2rem' }}>{i === 0 ? '→' : '/'}</span>
                                      {renderCard(k)}
                                    </Fragment>
                                  ))}
                                </div>
                              )
                            }
                            // Ramas anidadas (p. ej. Wurmple o Burmy): el Pokémon
                            // queda a la izquierda y las flechas apuntan hacia cada
                            // rama a su derecha (↗ arriba, ↘ abajo).
                            const half = Math.ceil(realKids.length / 2)
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {renderCard(evo)}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {realKids.map((k, i) => (
                                    <div key={`${k.id}-n-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                      <span style={{ color: '#7d7ab5', fontSize: '1.2rem' }}>{i < half ? '↗' : '↘'}</span>
                                      {renderNode(k)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          }

                          return renderNode(evos[0])
                        })()}
                      </div>
                    </>
                  )}

                  <h3 style={{ fontSize: '0.9rem', color: '#9b98cf', marginTop: '8px' }}>{t('pokedex.baseStats')}</h3>
                  <div className="stats-grid">
                    {selectedPokemonDetail.stats.map((st) => (
                      <div key={st.name} className="stat-row">
                        <span className="stat-name">{st.name}</span>
                        <span> </span>
                        <strong>{st.value}</strong>
                        <div className="meter">
                          <div style={{ width: `${Math.min(100, (st.value / 150) * 100)}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="modal-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h2 style={{ fontSize: '0.65rem', color: '#4d9bff', margin: 0 }}>
                        {pokedexMode === 'shiny' ? '✨ Shiny Pokédex' : 'Pokédex'} (
                        {pokedexMode === 'shiny' ? `${shinyDexSeen} ${t('pokedex.seen2b')} · ${shinyDexCaught} ${t('pokedex.caught2b')}` : `${pokedexSeen} ${t('pokedex.seen2b')} · ${pokedexCaught} ${t('pokedex.caught2b')}`})
                      </h2>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => { playClick(); setPokedexMode('normal') }}
                          style={{
                            background: pokedexMode === 'normal' ? 'rgba(77,155,255,0.25)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${pokedexMode === 'normal' ? '#4d9bff' : '#3f3f6e'}`,
                            color: pokedexMode === 'normal' ? '#4d9bff' : '#9b98cf',
                            borderRadius: '999px', padding: '2px 10px', fontSize: '0.62rem', fontWeight: 'bold', cursor: 'pointer'
                          }}
                        >
                          {language === 'en' ? 'Normal' : 'Normal'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { playClick(); setPokedexMode('shiny') }}
                          style={{
                            background: pokedexMode === 'shiny' ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${pokedexMode === 'shiny' ? '#ffcb05' : '#3f3f6e'}`,
                            color: pokedexMode === 'shiny' ? '#ffcb05' : '#9b98cf',
                            borderRadius: '999px', padding: '2px 10px', fontSize: '0.62rem', fontWeight: 'bold', cursor: 'pointer'
                          }}
                        >
                          ✨ Shiny
                        </button>
                        {secretUnlocked && (
                          <button
                            type="button"
                            onClick={() => { playClick(); unlockAllPokedex() }}
                            disabled={secretAddLoading}
                            title={language === 'en' ? 'Secret mode: unlock the whole Pokédex' : 'Modo secreto: activa toda la Pokédex'}
                            style={{
                              background: 'rgba(255,203,5,0.15)',
                              border: '1px solid #ffcb05',
                              color: '#ffcb05',
                              borderRadius: '999px', padding: '2px 10px', fontSize: '0.62rem', fontWeight: 'bold', cursor: 'pointer'
                            }}
                          >
                            🗝️ {language === 'en' ? 'Full Pokédex' : 'Toda la Pokédex'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type="text"
                        placeholder={t('pokedex.search2')}
                        value={pokedexSearch}
                        onChange={(e) => setPokedexSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          background: 'rgba(15, 23, 42, 0.8)',
                          color: '#fff',
                          fontSize: '0.85rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      {pokedexSearch && (
                        <button
                          type="button"
                          onClick={() => setPokedexSearch('')}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: '#9b98cf',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          ✖
                        </button>
                      )}
                    </div>
                  </div>

                  {isLoadingDetail ? (
                    <p className="muted" style={{ textAlign: 'center', padding: '2rem 0' }}>Cargando datos oficiales...</p>
                  ) : (pokedexMode === 'shiny' ? shinyDexList.length : normalDexList.length) === 0 ? (
                    <p className="muted" style={{ padding: '1rem 0', textAlign: 'center' }}>
                      {pokedexMode === 'shiny'
                        ? (language === 'en' ? 'No shiny Pokémon found yet. Use a Poké Radar or keep exploring!' : 'Aún no hay Pokémon shiny vistos. ¡Usa un Poké Radar o sigue explorando!')
                        : t('pokedex.empty2')}
                    </p>
                  ) : filteredPokedex.length === 0 ? (
                    <p className="muted" style={{ padding: '2rem 0', textAlign: 'center' }}>
                      No se encontraron Pokémon que coincidan con "{pokedexSearch}".
                    </p>
                  ) : (
                    <div className="pokedex-grid">
                      {filteredPokedex.sort((a, b) => a.id - b.id).map((pkmn) => {
                        const isShiny = pokedexMode === 'shiny'
                        const known = isShiny ? (pkmn.shinyCaught ?? false) : pkmn.caught
                        return (
                          <div
                            key={pkmn.id}
                            className="pokedex-card clickable"
                            onClick={() => known ? handleSelectPokedexPokemon(pkmn.id, isShiny) : undefined}
                            style={!known ? { opacity: 0.6 } : undefined}
                          >
                            <span className="pokedex-id">#{String(pkmn.id).padStart(3, '0')}</span>
                            <img
                              src={pokemonSpriteUrl(pkmn.id, isShiny)}
                              alt={pkmn.name}
                              onError={fallbackSprite}
                              style={{ width: '60px', height: '60px', filter: known ? undefined : 'brightness(0) invert(0)', imageRendering: known ? undefined : 'auto' }}
                            />
                            <strong style={{ textTransform: 'capitalize', display: 'block', fontSize: '0.85rem' }}>
                              {known ? (isShiny ? `${pkmn.name} ✨` : pkmn.name) : '???'}
                            </strong>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pokedex-controls">
              <div className="d-pad" title="D-Pad Pokédex"></div>
              <button
                className="pokedex-close-btn"
                onClick={() => { setShowPokedex(false); setSelectedPokemonDetail(null); setSelectedPokemonShiny(false); setPokedexSearch(''); }}
              >
                {t('options.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Opciones */}
      {showOptions && (
        <div className="modal-backdrop" onClick={closeOptions}>
          <div className="pokedex-frame" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="pokedex-top-bar">
              <div className="big-blue-sensor"></div>
              <div className="mini-leds">
                <div className="led red"></div>
                <div className="led yellow"></div>
                <div className="led green"></div>
              </div>
            </div>

            <div className="pokedex-screen" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                    🎵 {t('options.musicVolume')}
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#9b98cf', minWidth: '20px' }}>🔈</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volume}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setVolumeState(v)
                        setVolume(v / 100)
                        if (musicMuted) {
                          setMusicMuted(false)
                          setMusicMutedState(false)
                        }
                      }}
                      className="range-slider"
                      style={{ flex: 1, height: '6px', cursor: 'pointer', background: `linear-gradient(to right, #10b981 ${volume}%, rgba(255,255,255,0.12) ${volume}%)` }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#9b98cf', minWidth: '32px', textAlign: 'right' }}>{volume}%</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                  <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                    🔉 {t('options.sfxVolume')}
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#9b98cf', minWidth: '20px' }}>🔈</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={sfxVol}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setSfxVolState(v)
                        setSfxVolume(v / 100)
                      }}
                      className="range-slider"
                      style={{ flex: 1, height: '6px', cursor: 'pointer', background: `linear-gradient(to right, #f59e0b ${sfxVol}%, rgba(255,255,255,0.12) ${sfxVol}%)` }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#9b98cf', minWidth: '32px', textAlign: 'right' }}>{sfxVol}%</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                  <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.6rem' }}>
                    ♿ {t('options.accessibility')}
                  </strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.45rem 0.75rem', marginBottom: '0.75rem' }}>
                    {([
                      ['reduceAnimations', t('options.reduceAnimations')],
                      ['highContrast', t('options.highContrast')],
                      ['colorBlind', t('options.colorBlind')],
                      ['readableFont', t('options.readableFont')],
                      ['floatingDamage', t('options.floatingDamage')],
                    ] as const).map(([key, label]) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#d9d6f2' }}>
                        <input
                          type="checkbox"
                          checked={accessibility[key]}
                          onChange={(e) => {
                            playClick()
                            setAccessibility(prev => ({ ...prev, [key]: e.target.checked }))
                          }}
                          style={{ width: '16px', height: '16px', accentColor: '#4d9bff', cursor: 'pointer' }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9b98cf', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                      <span>{t('options.textSize')}</span><span>{accessibility.textScale}%</span>
                    </div>
                    <input
                      type="range"
                      min={85}
                      max={130}
                      step={5}
                      value={accessibility.textScale}
                      onChange={(e) => setAccessibility(prev => ({ ...prev, textScale: Number(e.target.value) }))}
                      className="range-slider"
                      style={{ width: '100%', height: '6px', cursor: 'pointer', background: `linear-gradient(to right, #4d9bff ${((accessibility.textScale - 85) / 45) * 100}%, rgba(255,255,255,0.12) ${((accessibility.textScale - 85) / 45) * 100}%)` }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#9b98cf', fontSize: '0.78rem' }}>⚡ {t('options.battleSpeed')}</span>
                    {([1, 2, 4] as const).map(speed => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => { playClick(); setAccessibility(prev => ({ ...prev, battleSpeed: speed })) }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '7px',
                          border: `1px solid ${accessibility.battleSpeed === speed ? '#ffcb05' : '#475569'}`,
                          background: accessibility.battleSpeed === speed ? 'rgba(250,204,21,0.16)' : 'transparent',
                          color: accessibility.battleSpeed === speed ? '#ffcb05' : '#9b98cf',
                          fontWeight: 'bold',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        x{speed}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                  <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                    🎨 {t('options.theme')}
                  </strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {THEMES.filter(t => metaProgression.ownedThemes.includes(t.id)).map(theme => (
                      <button key={theme.id} type="button"
                        onClick={() => { playClick(); setTheme(theme.id) }}
                        style={{
                          padding: '6px 12px', borderRadius: '8px', border: `2px solid ${metaProgression.activeTheme === theme.id ? '#ffcb05' : '#475569'}`,
                          background: theme.colors.bg, color: theme.colors.text, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold',
                        }}>
                        {themeName(theme.id)}
                      </button>
                    ))}
                  </div>
                  {metaProgression.permanentlyUnlockedItems.includes('gameboy') && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem', cursor: 'pointer', fontSize: '0.8rem', color: '#9b98cf' }}>
                      <input
                        type="checkbox"
                        checked={metaProgression.gameboyMode}
                        onChange={(e) => {
                          playClick()
                          const updated = { ...metaProgression, gameboyMode: e.target.checked }
                          setMetaProgression(updated)
                          localStorage.setItem('pokerand_meta', JSON.stringify(updated))
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#8bac0f', cursor: 'pointer' }}
                      />
                      🕹️ {language === 'en' ? 'Game Boy redesign' : 'Rediseño Game Boy'}
                    </label>
                  )}
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                  <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                    🌐 {t('options.language')}
                  </strong>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {([['es', t('lang.spanish')], ['en', t('lang.english')]] as Array<[Language, string]>).map(([lang, label]) => (
                      <button key={lang} type="button"
                        onClick={() => changeLanguage(lang)}
                        style={{
                          padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                          border: `2px solid ${language === lang ? '#ffcb05' : '#475569'}`,
                          background: language === lang ? 'rgba(250,204,21,0.15)' : 'transparent',
                          color: language === lang ? '#ffcb05' : '#9b98cf', fontWeight: 'bold', fontSize: '0.8rem',
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Music selectors */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                  <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.75rem' }}>
                    🎵 {t('options.music')}
                  </strong>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#9b98cf', marginBottom: '0.25rem' }}>{t('options.menu')}:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {[
                        { id: 'default', name: 'Menú Clásico', always: true },
                        { id: 'chill', name: 'Menú Relax', always: false },
                      ].map(track => {
                        const unlocked = track.always || metaProgression.ownedMusic.includes('music_menu_chill')
                        const active = metaProgression.activeMenuMusic === track.id
                        return (
                          <button key={track.id} type="button"
                            onClick={() => {
                              if (!unlocked) return
                              playClick()
                              const updated = { ...metaProgression, activeMenuMusic: track.id }
                              setMetaProgression(updated)
                              localStorage.setItem('pokerand_meta', JSON.stringify(updated))
                              setMenuMusicTrack(track.id)
                              stopMusic()
                              setTimeout(startMenuMusic, 350)
                            }}
                            disabled={!unlocked}
                            style={{
                              padding: '6px 12px', borderRadius: '8px',
                              border: `2px solid ${active ? '#ffcb05' : '#475569'}`,
                              background: unlocked ? '#1c1c3a' : '#12122b',
                              color: unlocked ? '#f3f1ff' : '#475569',
                              cursor: unlocked ? 'pointer' : 'not-allowed',
                              fontSize: '0.75rem', fontWeight: 'bold',
                              opacity: unlocked ? 1 : 0.5,
                            }}>
                            {track.id === 'default' ? (language === 'en' ? 'Classic Menu' : 'Menú Clásico') : (language === 'en' ? 'Relax Menu' : 'Menú Relax')}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#9b98cf', marginBottom: '0.25rem' }}>Batalla:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {[
                        { id: 'default', name: 'Batalla Clásica', always: true },
                        { id: 'epic', name: 'Batalla Épica', always: false },
                      ].map(track => {
                        const unlocked = track.always || metaProgression.ownedMusic.includes('music_battle_epic')
                        const active = metaProgression.activeBattleMusic === track.id
                        return (
                          <button key={track.id} type="button"
                            onClick={() => {
                              if (!unlocked) return
                              playClick()
                              const updated = { ...metaProgression, activeBattleMusic: track.id }
                              setMetaProgression(updated)
                              localStorage.setItem('pokerand_meta', JSON.stringify(updated))
                              setBattleMusicTrack(track.id)
                              startBattleMusic(true)
                            }}
                            disabled={!unlocked}
                            style={{
                              padding: '6px 12px', borderRadius: '8px',
                              border: `2px solid ${active ? '#ffcb05' : '#475569'}`,
                              background: unlocked ? '#1c1c3a' : '#12122b',
                              color: unlocked ? '#f3f1ff' : '#475569',
                              cursor: unlocked ? 'pointer' : 'not-allowed',
                              fontSize: '0.75rem', fontWeight: 'bold',
                              opacity: unlocked ? 1 : 0.5,
                            }}>
                            {track.id === 'default' ? (language === 'en' ? 'Classic Menu' : 'Menú Clásico') : (language === 'en' ? 'Relax Menu' : 'Menú Relax')}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
              <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                {t('options.data')}
              </strong>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="tiny-btn" type="button" onClick={() => {
                  const data: Record<string, string> = {}
                  const keys = ['pokerand_progression', 'pokerand_pokedex', 'pokerand_wins', 'pokerand_losses', 'pokerand_streak', 'pokerand_best_streak', 'pokerand_achievements', 'pokerand_meta', DUNGEON_STORAGE_KEY, POKEST_STORAGE_KEY]
                  for (const k of keys) {
                    const v = localStorage.getItem(k)
                    if (v) data[k] = v
                  }
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = 'pokerand_backup.json'; a.click()
                  URL.revokeObjectURL(url)
                }} style={{ color: '#4d9bff' }}>{t('options.exportData')}</button>
                <label className="tiny-btn" style={{ color: '#ffcb05', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', border: '1px solid #ffcb05', background: 'rgba(250,204,21,0.1)', fontSize: '0.75rem' }}>
                  {t('options.importData')}
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => {
                    const file = e.target.files?.[0]; if (!file) return
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      try {
                        const data = JSON.parse(ev.target?.result as string)
                        if (typeof data !== 'object' || !data) throw new Error()
                        for (const [k, v] of Object.entries(data)) {
                          if (typeof v === 'string') localStorage.setItem(k, v)
                        }
                        alert('✅ Datos importados. Recarga la página.')
                      } catch { alert('❌ Archivo no válido.') }
                    }
                    reader.readAsText(file); e.target.value = ''
                  }} />
                </label>
              </div>
            </div>

            <div className="pokedex-controls">
              <div className="d-pad" title="D-Pad Options"></div>
              <button
                className="pokedex-close-btn"
                onClick={closeOptions}
              >
                {t('options.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Rocket: Mensaje de robo */}
      {teamRocketStealMessage && (
        <div className="teamrocket-steal-banner">
          <div className="teamrocket-steal-content">
            <span className="teamrocket-steal-icon">🔴</span>
            <p>{teamRocketStealMessage}</p>
          </div>
        </div>
      )}

      {/* Team Rocket: Elegir Pokémon */}
      {teamRocketPickModal && (
        <div className="modal-backdrop" onClick={() => { setTeamRocketPickModal(false); setTeamRocketTeam([]); completeCurrentNode() }}>
          <div className="teamrocket-pick-panel" onClick={(e) => e.stopPropagation()}>
            <h3>{t('teamRocket.defeated')}</h3>
            <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>{t('teamRocket.pickDesc')}</p>
            <div className="teamrocket-pick-grid">
              {teamRocketTeam.filter((p) => p.hp <= 0).map((pkmn, idx) => (
                <button
                  key={`rocket-pick-${idx}`}
                  className="teamrocket-pick-card"
                  onClick={() => { playClick(); pickRocketPokemon(pkmn) }}
                  onMouseEnter={playHover}
                  type="button"
                >
                  <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '64px', height: '64px', imageRendering: 'pixelated' }} />
                  <strong style={{ textTransform: 'capitalize' }}>{pkmn.name}</strong>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Nv. {pkmn.level}</span>
                  {pkmn.types && (
                    <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', marginTop: '4px' }}>
                      {pkmn.types.map((t) => (
                        <span key={t} style={{ background: TYPE_COLORS[t] ?? '#475569', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                className="secondary"
                onClick={() => { playClick(); setTeamRocketPickModal(false); setTeamRocketTeam([]); completeCurrentNode() }}
                onMouseEnter={playHover}
                type="button"
              >
                {t('teamRocket.skip')}
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'pvp' && (() => {
        if (!pvpSnapshot || !pvpRole) {
          return (
            <section className="panel setup-panel" style={{ maxWidth: '780px', minHeight: '440px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h2 style={{ margin: '0 0 1.2rem', color: '#cba3ff', fontSize: '1.6rem' }}>{t('pvp.setupTitle')}</h2>
              {pvpWaitingOpponent ? (
                <>
                  <p style={{ color: '#cba3ff', fontSize: '1.35rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>{t('pvp.waitingRematch')}</p>
                  {pvpRoomCode && (
                    <p style={{ color: '#ffcb05', fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '0.2em', marginBottom: '0.75rem' }}>
                      CÓDIGO: {pvpRoomCode}
                    </p>
                  )}
                  <button className="cta" type="button" onClick={cancelPvpWaiting} style={{ color: '#ff8a80', marginTop: '1rem', maxWidth: '260px', alignSelf: 'center' }}>{t('pvp.cancel')}</button>
                </>
              ) : (
                <>
                  <p style={{ color: '#9b98cf', fontSize: '1.15rem' }}>{t('pvp.loadingBattle')}</p>
                  <button className="cta" type="button" onClick={pvpLeave} style={{ color: '#ff8a80', marginTop: '1rem', maxWidth: '260px', alignSelf: 'center' }}>{t('pvp.abandon')}</button>
                </>
              )}
            </section>
          )
        }

        const st = pvpSnapshot.state
        const myRole = pvpRole
        const my = st[myRole]
        const myActive = my.team[my.active]
        const iSubmitted = pvpMyAction !== null && pvpMyActionTurn === pvpSnapshot.turn
        const canActPicking = st.phase === 'picking' && !iSubmitted
        const mySwitchNeeded = st.phase === 'switch' && (st.switchFor === myRole || st.switchFor === 'both') && !iSubmitted
        const canSwitchNow = my.team.some((p, i) => i !== my.active && p.hp > 0)

        const hpBar = (p: Pokemon | undefined) => {
          if (!p) return null
          const pct = Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100))
          const color = pct > 50 ? '#37d16b' : pct > 20 ? '#ffcb05' : '#ee3b2f'
          return (
            <div style={{ width: '100%', height: '12px', borderRadius: '6px', background: 'rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color }} />
            </div>
          )
        }

        const teamColumn = (side: 'a' | 'b') => {
          const ps = st[side]
          const isMine = side === myRole
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.9rem', color: '#cba3ff', fontWeight: 'bold', textAlign: 'center' }}>
                {t('pvp.playerLabel', { side: side === 'a' ? 'A' : 'B' })} — {ps.username ?? '?'}
                <span style={{ color: '#ffcb05', fontWeight: 'bold', marginLeft: '4px' }}>· Elo {side === 'a' ? (myRole === 'a' ? pvpMyElo : pvpOppElo) : (myRole === 'b' ? pvpMyElo : pvpOppElo)}</span>
              </div>
              {ps.team.map((p, i) => {
                const revealed = isMine || ps.revealed?.[i]
                const isActive = ps.active === i
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.4rem 0.55rem',
                      borderRadius: '8px',
                      border: `1px solid ${isActive ? '#ffcb05' : '#3f3f6e'}`,
                      background: isActive ? 'rgba(255,203,5,0.1)' : 'rgba(15,23,42,0.5)',
                      minHeight: '48px'
                    }}
                  >
                    {revealed ? (
                      <>
                        <img src={p.sprite} alt={p.name} onError={fallbackSprite} style={{ width: '42px', height: '42px', imageRendering: 'pixelated' }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', color: '#f3f1ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: p.hp <= 0 ? '#ee3b2f' : '#7d7ab5' }}>
                            {p.hp <= 0 ? t('pvp.defeated') : `Nv.${p.level} · HP ${Math.max(0, p.hp)}/${p.maxHp}`}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#7d7ab5', fontSize: '0.85rem', width: '100%', textAlign: 'center' }}>{t('pvp.hidden')}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        }

        if (st.phase === 'finished') {
          const iWon = st.winner === myRole
          return (
            <section className="panel setup-panel" style={{ maxWidth: '780px', minHeight: '440px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h2 style={{ margin: '0 0 1rem', color: iWon ? '#ffcb05' : '#ee3b2f', fontSize: '1.7rem' }}>
                {st.winner ? (iWon ? t('pvp.victory') : t('pvp.defeat')) : t('pvp.draw')}
              </h2>
              <p style={{ color: '#9b98cf', marginBottom: '1rem', fontSize: '1.05rem' }}>
                {st.winner ? t('pvp.wonCombat', { name: (st.winner === 'a' ? st.a.username : st.b.username) ?? t('pvp.rival') }) : t('pvp.bothFainted')}
              </p>
              {pvpEloRewarded && (
                <div style={{ marginBottom: '1rem', padding: '0.6rem', borderRadius: '8px', background: 'rgba(255,203,5,0.1)', border: '1px solid #ffcb05' }}>
                  <p style={{ margin: 0, color: '#ffcb05', fontSize: '1.05rem', fontWeight: 'bold' }}>
                    {iWon ? t('pvp.eloGain', { n: pvpEloGain ?? 0 }) : t('pvp.yourElo', { n: pvpMyElo })}
                  </p>
                  <p style={{ margin: '0.25rem 0 0', color: '#9b98cf', fontSize: '0.85rem' }}>
                    {t('pvp.rivalElo', { n: pvpOppElo })}
                  </p>
                </div>
              )}
              <div style={{ maxHeight: '240px', overflowY: 'auto', textAlign: 'left', marginBottom: '1rem', padding: '0.6rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                {st.log.slice(-12).reverse().map((line, i) => (
                  <p key={i} style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', color: '#d9d6f2' }}>{line}</p>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="cta" type="button" onClick={() => void pvpRematch()} style={{ flex: 1, fontSize: '1.05rem' }}>{t('pvp.rematch')}</button>
                <button className="cta" type="button" onClick={pvpLeave} style={{ flex: 1, background: '#7d7ab5', fontSize: '1.05rem' }}>{t('pvp.backToMenu')}</button>
              </div>
            </section>
          )
        }

        return (
          <section className="panel setup-panel" style={{ maxWidth: '1280px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, color: '#cba3ff', fontSize: '1.5rem' }}>{t('pvp.setupTitle')}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: '#9b98cf', fontSize: '0.9rem' }}>{t('pvp.turn', { n: pvpSnapshot.turn + 1 })}</span>
                {pvpSnapshot.timer_by && pvpSnapshot.timer_until ? (
                  <span style={{ color: pvpTimerLeft <= 60 ? '#ff8a80' : '#ffcb05', fontSize: '0.95rem', fontWeight: 'bold' }}>
                    ⏱️ {Math.floor(pvpTimerLeft / 60)}:{String(pvpTimerLeft % 60).padStart(2, '0')}
                  </span>
                ) : (
                  <button className="tiny-btn" type="button" onClick={() => void pvpStartTimer()} style={{ color: '#ffcb05' }}>{t('pvp.countdown')}</button>
                )}
                <button className="tiny-btn" type="button" onClick={() => void pvpForfeit()} style={{ color: '#ff8a80' }}>{t('pvp.surrender')}</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr', gap: '1rem', alignItems: 'start' }}>
              {/* Columna izquierda: siempre el Jugador A */}
              {teamColumn('a')}

              {/* Centro: combate */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minHeight: '620px' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    {(() => {
                      const pk = st.a.team[st.a.active]
                      const nm = myRole === 'a' ? 'Tú' : 'Rival'
                      const side = 'a' as const
                      const hit = pvpHit !== null && pvpHit.side === side
                      return (
                        <>
                          <div style={{ fontSize: '0.8rem', color: '#9b98cf', fontWeight: 'bold', marginBottom: '2px' }}>{nm}</div>
                          <img key={hit ? pvpHit.key : undefined} className={`${hit ? 'pvp-hit-flash' : ''} ${statusSpriteClass(pk?.status, pk?.leechSeed)}`} src={pk?.sprite} alt={pk?.name} onError={fallbackSprite} style={{ width: '128px', height: '128px', imageRendering: 'pixelated' }} />
                          <div style={{ fontSize: '0.95rem', color: '#f3f1ff', fontWeight: 'bold' }}>{pk?.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#7d7ab5' }}>Nv.{pk?.level}</div>
                          {pk?.status && <div style={{ marginTop: '2px' }}><StatusBadge status={pk.status} compact /></div>}
                          {pk?.leechSeed && <div style={{ marginTop: '2px' }}><LeechSeedBadge compact /></div>}
                          {hpBar(pk)}
                        </>
                      )
                    })()}
                  </div>
                  <div style={{ fontSize: '2.2rem', color: '#ffcb05', fontWeight: 'bold' }}>VS</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    {(() => {
                      const pk = st.b.team[st.b.active]
                      const nm = myRole === 'b' ? 'Tú' : 'Rival'
                      const side = 'b' as const
                      const hit = pvpHit !== null && pvpHit.side === side
                      return (
                        <>
                          <div style={{ fontSize: '0.8rem', color: '#9b98cf', fontWeight: 'bold', marginBottom: '2px' }}>{nm}</div>
                          <img key={hit ? pvpHit.key : undefined} className={`${hit ? 'pvp-hit-flash' : ''} ${statusSpriteClass(pk?.status, pk?.leechSeed)}`} src={pk?.sprite} alt={pk?.name} onError={fallbackSprite} style={{ width: '128px', height: '128px', imageRendering: 'pixelated' }} />
                          <div style={{ fontSize: '0.95rem', color: '#f3f1ff', fontWeight: 'bold' }}>{pk?.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#7d7ab5' }}>Nv.{pk?.level}</div>
                          {pk?.status && <div style={{ marginTop: '2px' }}><StatusBadge status={pk.status} compact /></div>}
                          {pk?.leechSeed && <div style={{ marginTop: '2px' }}><LeechSeedBadge compact /></div>}
                          {hpBar(pk)}
                        </>
                      )
                    })()}
                  </div>
                </div>

                {st.weather && st.weather !== 'none' && (
                  <WeatherTooltip
                    weather={st.weather}
                    style={{ display: 'inline-block', alignSelf: 'center', padding: '2px 10px', borderRadius: '999px', background: 'rgba(154,152,207,0.18)', color: '#c4b5fd', fontSize: '0.75rem', fontWeight: 'bold' }}
                  />
                )}

                <div style={{ maxHeight: '220px', minHeight: '120px', overflowY: 'auto', padding: '0.5rem 0.6rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid #3f3f6e' }}>
                  {st.log.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#7d7ab5' }}>{t('pvp.pickMoveStart')}</p>
                  ) : (
                    st.log.slice(-10).reverse().map((line, i) => (
                      <p key={i} style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', color: '#d9d6f2' }}>{line}</p>
                    ))
                  )}
                </div>

                {/* Altura fija: el panel no cambia de tamaño al realizar acciones ni al esperar al rival */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', height: '240px', minHeight: '240px', justifyContent: 'flex-start', overflowY: 'auto' }}>

                  {st.phase === 'switch' && mySwitchNeeded && !iSubmitted && (
                    <div style={{ padding: '0.7rem', borderRadius: '8px', background: 'rgba(168,85,247,0.1)', border: '1px solid #a855f7' }}>
                      <strong style={{ color: '#cba3ff', fontSize: '0.95rem' }}>{t('pvp.pickNext')}</strong>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                        {my.team.map((p, i) => (
                          p.hp > 0 && p.id !== myActive?.id ? (
                            <button key={i} className="tiny-btn" type="button" onClick={() => void pvpSubmitSwitch(i)}>
                              <img src={p.sprite} alt={p.name} onError={fallbackSprite} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} />
                              {p.name}
                            </button>
                          ) : null
                        ))}
                      </div>
                    </div>
                  )}

                  {st.phase === 'picking' && canActPicking && myActive && !pvpChoosingSwitch && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                        {myActive.moves.map((m, i) => {
                          const pp = m.pp ?? 0
                          const outOfPp = pp <= 0
                          return (
                            <button
                              key={i}
                              className="move-btn"
                              type="button"
                              disabled={outOfPp}
                              onClick={() => void pvpSubmitMove(i)}
                              style={{
                                padding: '0.65rem 0.75rem',
                                borderRadius: '10px',
                                border: '1px solid #3f3f6e',
                                background: 'rgba(15,23,42,0.6)',
                                color: '#d9d6f2',
                                cursor: outOfPp ? 'not-allowed' : 'pointer',
                                opacity: outOfPp ? 0.45 : 1,
                                letterSpacing: '0.02em',
                                textAlign: 'left',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.3rem',
                                lineHeight: 1.3,
                              }}
                            >
                              <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: outOfPp ? '#7d7ab5' : '#f3f1ff' }}>{moveName(m)}</div>
                              <div style={{ fontSize: '0.72rem', color: '#9b98cf' }}>{m.type.toUpperCase()} · PWR {m.power} · {m.accuracy}%</div>
                              {moveEffectSummary(m) && <div style={{ fontSize: '0.7rem', color: '#7dd3fc' }}>{moveEffectSummary(m)}</div>}
                              <div style={{ fontSize: '0.68rem', color: outOfPp ? '#ee3b2f' : '#7d7ab5' }}>
                                {outOfPp ? t('pvp.noPP') : t('pvp.pp', { n: pp, max: m.maxPp ?? 10 })}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      <button className="cta" type="button" disabled={!canSwitchNow} onClick={() => setPvpChoosingSwitch(true)} style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.95rem' }}>
                        🔁 Cambiar de Pokémon
                      </button>
                    </>
                  )}

                  {st.phase === 'picking' && canActPicking && myActive && pvpChoosingSwitch && (
                    <div style={{ padding: '0.7rem', borderRadius: '8px', background: 'rgba(56,189,248,0.08)', border: '1px solid #38bdf8' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <strong style={{ color: '#7dd3fc', fontSize: '0.95rem' }}>{t('pvp.switchPokemon')}</strong>
                        <button className="tiny-btn" type="button" onClick={() => setPvpChoosingSwitch(false)}>{t('pvp.backToMoves')}</button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {my.team.map((p, i) => (
                          p.hp > 0 && i !== my.active ? (
                            <button key={i} className="tiny-btn" type="button" onClick={() => void pvpSubmitSwitch(i)}>
                              <img src={p.sprite} alt={p.name} onError={fallbackSprite} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} />
                              {p.name}
                            </button>
                          ) : null
                        ))}
                        {!canSwitchNow && <span style={{ color: '#7d7ab5', fontSize: '0.85rem' }}>{t('common.noPokemon')}</span>}
                      </div>
                    </div>
                  )}

                  {iSubmitted && (
                    <div style={{ textAlign: 'center', padding: '0.9rem', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <p style={{ margin: '0 0 0.6rem', color: '#37d16b', fontSize: '1rem', fontWeight: 'bold' }}>
                        {t('pvp.waitingRival')}
                      </p>
                      <button className="tiny-btn" type="button" onClick={() => void pvpCancelAction()} style={{ color: '#ff8a80' }}>
                        {t('coop.cancelAction')}
                      </button>
                    </div>
                  )}

                  {!iSubmitted && st.phase === 'picking' && !canActPicking && (
                    <div style={{ textAlign: 'center', padding: '0.9rem', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <p style={{ margin: 0, color: '#37d16b', fontSize: '1rem', fontWeight: 'bold' }}>{t('pvp.rivalChoosing')}</p>
                    </div>
                  )}

                  {st.phase === 'switch' && !mySwitchNeeded && !iSubmitted && (
                    <div style={{ textAlign: 'center', padding: '0.9rem', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <p style={{ margin: 0, color: '#37d16b', fontSize: '1rem', fontWeight: 'bold' }}>{t('pvp.rivalPickingNext')}</p>
                    </div>
                  )}

                  {pvpError && <p style={{ margin: 0, textAlign: 'center', color: '#ff8a80', fontSize: '0.85rem' }}>{pvpError}</p>}
                </div>
              </div>

              {/* Columna derecha: siempre el Jugador B */}
              {teamColumn('b')}
            </div>
          </section>
        )
      })()}

      {screen === 'coliseum_select' && (
        <section className="panel setup-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0, color: '#ffcb05' }}>👑 COLISEUM</h2>
            <button className="tiny-btn" onClick={() => { playClick(); preColiseumChallengesRef.current = null; setColiseumTempTeam([]); setRunChallenges({ noShops: false, noRests: false, allShiny: false, allTeamRocket: false, nuzlocke: false, soloStarter: false, fixedTeam: false, noEvolution: false, noItems: false, restrictedMoves: false, firstStrike: false, fixedLevel: false, noCrits: false, typeRandomizer: false, noPurchasing: false, blindRoute: false, bossRush: false, speedrun: false, noMoney: false, doubleModifiers: false, scalingEnemies: false, noHealing: false, ironman: false, totalRandomizer: false, nuzlockeHardcore: false, challengeGauntlet: false, egglocke: false }); setScreen('setup'); stopMusic() }} type="button" style={{ color: '#ff8a80' }}>
              {t('coliseum.exit')}
            </button>
          </div>
          <p style={{ textAlign: 'center', color: '#9b98cf', marginBottom: '1rem' }}>
            {t('coliseum.select')}
          </p>
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#7d7ab5', marginBottom: '0.5rem' }}>
            {t('coliseum.picked', { n: coliseumTempTeam.length })}
          </p>
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <input type="text" placeholder="🔍 Buscar Pokémon..." value={coliseumSearch} onChange={e => setColiseumSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
            {coliseumSearch && <button type="button" onClick={() => setColiseumSearch('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9b98cf', cursor: 'pointer', fontSize: '0.9rem' }}>✖</button>}
          </div>
          {coliseumTempTeam.length === 6 && (
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <button className="cta" onClick={async () => {
                setIsLoading(true)
                try {
                  const built = await Promise.all(coliseumTempTeam.map(p => buildPokemonFromApi(p.id, 1, 50, false, 'coliseum_' + coliseumSeed)))
                  setTeam(built)
                  built.forEach(p => registerInPokedex(p))
                  setBattleLog([t('b.coliseumIntro'), ...battleLog])
                  setScreen('route')
                  startBattleMusic()
                } catch {
                  setApiError(t('coliseum.error'))
                } finally {
                  setIsLoading(false)
                }
              }} style={{ background: '#ffcb05', color: '#000' }} disabled={isLoading}>
                {isLoading ? t('coliseum.preparing') : t('coliseum.start')}
              </button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
            {Object.values(pokedex).filter(p => p.caught).filter(p => {
              const term = coliseumSearch.toLowerCase().trim()
              return !term || p.name.toLowerCase().includes(term) || String(p.id).includes(term)
            }).sort((a, b) => a.id - b.id).map(pkmn => {
              const selectedIdx = coliseumTempTeam.findIndex(p => p.id === pkmn.id)
              return (
                <div key={pkmn.id}
                  onClick={() => {
                    if (selectedIdx >= 0) {
                      setColiseumTempTeam(prev => prev.filter(p => p.id !== pkmn.id))
                    } else if (coliseumTempTeam.length < 6) {
                      setColiseumTempTeam(prev => [...prev, { id: pkmn.id, name: pkmn.name, sprite: pkmn.sprite, level: 1, hp: 1, maxHp: 1, attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1, moves: [], types: pkmn.types }])
                    }
                  }}
                  style={{
                    padding: '8px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer',
                    background: selectedIdx >= 0 ? 'rgba(250,204,21,0.2)' : 'rgba(30,41,59,0.6)',
                    border: selectedIdx >= 0 ? '2px solid #ffcb05' : '1px solid #3f3f6e',
                    opacity: selectedIdx < 0 && coliseumTempTeam.length >= 6 ? 0.4 : 1
                  }}
                >
                  <img src={pokemonSpriteUrl(pkmn.id)}
                    alt={pkmn.name} onError={fallbackSprite}
                    style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }} />
                  <div style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: selectedIdx >= 0 ? '#ffcb05' : '#f3f1ff' }}>{pkmn.name}</div>
                  {selectedIdx >= 0 && <div style={{ fontSize: '0.65rem', color: '#ffcb05' }}>#{selectedIdx + 1}</div>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {screen === 'setup' && (
        <section className="panel setup-panel">
          <div className="setup-hero">
            <SetupBanner />
            <div className="setup-hero-visuals" aria-hidden="true">
              <span className="setup-hero-ring setup-hero-ring--a" />
              <span className="setup-hero-ring setup-hero-ring--b" />
              <span className="setup-hero-ring setup-hero-ring--c" />
              <span className="setup-hero-core" />
            </div>
            <div className="setup-hero-overlay">
              <div className="setup-hero-copy">
                <h1 className="setup-hero-title">{t('setup.welcome')}</h1>
                <p className="setup-hero-sub">{t('setup.subtitle')}</p>
              </div>
              <div className="setup-hero-actions">
                <button className="cta setup-start" type="button" onClick={handleStartRunClick} onMouseEnter={playHover} disabled={isLoading}>
                  {isLoading ? t('setup.loading') : t('setup.startAdventure')}
                </button>
                <button className="tiny-btn" type="button" onClick={() => { playClick(); setShowMetaShop(true) }}>
                  🪙 {t('setup.metaShop')} ({metaProgression.pokeCoins} 🪙)
                </button>
                <button
                  className="tiny-btn setup-dungeon"
                  type="button"
                  onClick={() => { playClick(); setScreen('dungeon') }}
                  onMouseEnter={playHover}
                  style={{ borderColor: '#df3b2f', color: '#ff8a7e' }}
                >
                  🔷 {language === 'en' ? 'Mystery Dungeon' : 'Mazmorra Misteriosa'}
                </button>
                <button
                  className="tiny-btn setup-pokest"
                  type="button"
                  onClick={() => { playClick(); setScreen('pokest') }}
                  onMouseEnter={playHover}
                >
                  ⚔️ Pokest Dungeon
                </button>
              </div>
            </div>
          </div>

          <div className="setup-grid">
            <div className="setup-col">
              <div className="setup-card setup-card-gen">
                <h2 className="setup-card-title"><span className="setup-step">1</span> {t('setup.selectGeneration')}</h2>
                <div className="generation-grid">
                  {generations.map((gen) => {
                    const unlocked = isGenUnlocked(gen)
                    const completedMed = progression.completedMedium.includes(gen)
                    const completedAny = progression.completedAny.includes(gen)
                    const completedHard = progression.completedHard.includes(gen)
                    const completedColiseum = progression.completedColiseum.includes(gen)
                    const completedLeague = progression.completedLeague.includes(gen)
                    const completedOriginal = progression.completedOriginal.includes(gen)
                    const completedBranch = progression.completedBranch.includes(gen)

                    return (
                      <button
                        key={gen}
                        className={`gen-tile ${generation === gen ? 'is-active' : ''} ${!unlocked ? 'is-locked' : ''}`}
                        onClick={() => { playClick(); handleSelectGeneration(gen) }}
                        onMouseEnter={playHover}
                        type="button"
                        disabled={isLoading || !unlocked}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0 8px' }}>
                          <span style={{ whiteSpace: 'nowrap' }}>Gen {gen} {unlocked ? '' : '🔒'}</span>
                          <span className="gen-tile-badges" aria-label={language === 'en' ? 'Completion badges' : 'Insignias de finalización'}>
                            {completedHard ? (
                              <span className="badge-medium" title={language === 'en' ? 'Completed on Hard' : 'Completado en Difícil'}>🏆🏆</span>
                            ) : completedMed ? (
                              <span className="badge-medium" title={language === 'en' ? 'Completed on Medium' : 'Completado en Intermedio'}>🏆</span>
                            ) : completedAny ? (
                              <span className="badge-easy" title={language === 'en' ? 'Completed on Easy' : 'Completado en Fácil'}>⭐</span>
                            ) : null}
                            {completedColiseum && (
                              <span className="badge-medium" title={language === 'en' ? 'Completed on COLISEUM' : 'Completado en COLISEUM'}>👑</span>
                            )}
                            {completedLeague && (
                              <span className="badge-medium" title={language === 'en' ? 'Completed on the League' : 'Completado en Liga'}>🏅</span>
                            )}
                            {completedOriginal && (
                              <span className="badge-medium" title={language === 'en' ? 'Completed on Original' : 'Completado en Modo Original'}>🕹️</span>
                            )}
                            {completedBranch && (
                              <span className="badge-medium" title={language === 'en' ? 'Completed on Path Mode' : 'Completado en Modo Ruta'}>🗺️</span>
                            )}
                          </span>
                        </div>
                        <strong>{generationRegions[gen]}</strong>

                        {!unlocked && (
                          <span className="lock-text">
                            🔒 {t('setup.passGen', { gen: gen - 1 })}
                          </span>
                        )}
                      </button>
                    )
                  })}

                  {(() => {
                    const randomUnlocked = isGenUnlocked(0)
                    const randomCompletedHard = generations.every((g) => progression.completedHard.includes(g))
                    const randomCompletedMed = generations.every((g) => progression.completedMedium.includes(g))
                    const randomCompletedAny = progression.completedAny.length > 0
                    const randomCompletedColiseum = generations.every((g) => progression.completedColiseum.includes(g))
                    const randomCompletedLeague = generations.every((g) => progression.completedLeague.includes(g))
                    const randomCompletedBranch = generations.every((g) => progression.completedBranch.includes(g))
                    return (
                      <button
                        key={0}
                        className={`gen-tile ${generation === 0 ? 'is-active' : ''} ${!randomUnlocked ? 'is-locked' : ''}`}
                        onClick={() => { playClick(); handleSelectGeneration(0) }}
                        onMouseEnter={playHover}
                        type="button"
                        disabled={isLoading || !randomUnlocked}
                        style={{
                          gridColumn: '1 / -1',
                          borderColor: randomUnlocked ? '#eab308' : '#475569',
                          background: !randomUnlocked
                            ? 'rgba(15, 23, 42, 0.6)'
                            : generation === 0
                              ? 'rgba(234, 179, 8, 0.25)'
                              : 'rgba(234, 179, 8, 0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '12px',
                          opacity: randomUnlocked ? 1 : 0.65,
                          cursor: randomUnlocked ? 'pointer' : 'not-allowed'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '0 8px' }}>
                          <span style={{ fontSize: '1.2rem', color: randomUnlocked ? '#ffcb05' : '#7d7ab5', whiteSpace: 'nowrap' }}>
                            {t('setup.randomAllStars')} {randomUnlocked ? '' : '🔒'}
                          </span>
                          <span className="gen-tile-badges" aria-label={language === 'en' ? 'Completion badges' : 'Insignias de finalización'}>
                            {randomCompletedHard ? (
                              <span className="badge-medium" title={language === 'en' ? 'Completed on Hard' : 'Completado en Difícil'}>🏆🏆</span>
                            ) : randomCompletedMed ? (
                              <span className="badge-medium" title={language === 'en' ? 'Completed on Medium' : 'Completado en Intermedio'}>🏆</span>
                            ) : randomCompletedAny ? (
                              <span className="badge-easy" title={language === 'en' ? 'Completed on Easy' : 'Completado en Fácil'}>⭐</span>
                            ) : null}
                            {randomCompletedColiseum && (
                              <span className="badge-medium" title={language === 'en' ? 'Completed on COLISEUM' : 'Completado en COLISEUM'}>👑</span>
                            )}
                            {randomCompletedLeague && (
                              <span className="badge-medium" title={language === 'en' ? 'Completed on the League' : 'Completado en Liga'}>🏅</span>
                            )}
                            {randomCompletedBranch && (
                              <span className="badge-medium" title={language === 'en' ? 'Completed on Path Mode' : 'Completado en Modo Ruta'}>🗺️</span>
                            )}
                          </span>
                          <strong style={{ fontSize: '1rem', color: randomUnlocked ? '#ffcb05' : '#7d7ab5', whiteSpace: 'nowrap' }}>
                            — {randomUnlocked ? t('setup.mixAllGens') : t('setup.allGens')}
                          </strong>
                        </div>
                        {!randomUnlocked && (
                          <span className="lock-text">
                            {t('setup.unlockAllGens')}
                          </span>
                        )}
                      </button>
                    )
                  })()}
                </div>
              </div>

              <div className="setup-card setup-card-pvp" style={{ marginTop: '0.75rem' }}>
                <h2 className="setup-card-title">{t('pvp.setupTitle')}</h2>
                <div className="generation-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0' }}>
                  <button
                    className="gen-tile"
                    type="button"
                    onClick={openPvpModal}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '12px', border: '1px solid #a855f7', background: 'rgba(168,85,247,0.1)', borderRadius: '12px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '1.2rem', color: '#cba3ff' }}>{t('pvp.play')}</span>
                    <strong style={{ fontSize: '0.85rem', color: '#9b98cf' }}>
                      {pvpTeam.length > 0 ? t('pvp.buildTeam', { n: pvpTeam.length }) : t('pvp.buildTeamFirst', { n: pvpTeam.length })}
                    </strong>
                  </button>
                </div>
              </div>
            </div>

            <div className="setup-col">
              <div className="setup-card setup-card-diff">
                <h2 className="setup-card-title"><span className="setup-step">2</span> {t('setup.selectDifficulty')}</h2>
                <div className="generation-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => {
                    const isHard = diff === 'hard'
                    const hardUnlocked = isHardUnlocked(generation)
                    const isLocked = isHard && !hardUnlocked

                    return (
                      <button
                        key={diff}
                        className={`gen-tile ${difficulty === diff ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''}`}
                        onClick={() => { playClick(); handleSelectDifficulty(diff) }}
                        onMouseEnter={playHover}
                        type="button"
                        disabled={isLoading || isLocked}
                        style={{ opacity: isLocked ? 0.65 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{difficultyLabel(language, diff).title} {isLocked ? '🔒' : ''}</span>
                        </div>
                        <strong>{difficultyNodeCounts[diff]} {language === 'en' ? 'routes/stage' : 'rutas/etapa'} ({difficultyNodeCounts[diff] * 3} {language === 'en' ? 'total' : 'total'})</strong>
                        {isLocked && (
                          <span className="lock-text">
                            {t('setup.completeRegionOnce', { region: generationRegions[generation] })}
                          </span>
                        )}
                      </button>
                    )
                  })}
                  <button
                    className={`gen-tile ${difficulty === 'original' ? 'is-active' : ''}`}
                    onClick={() => { playClick(); handleSelectDifficulty('original') }}
                    onMouseEnter={playHover}
                    type="button"
                    disabled={isLoading}
                    style={{
                      borderColor: difficulty === 'original' ? '#4d9bff' : 'rgba(77, 155, 255, 0.5)',
                      background: difficulty === 'original' ? 'rgba(77, 155, 255, 0.25)' : 'rgba(77, 155, 255, 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      padding: '10px',
                    }}
                  >
                    <span style={{ fontSize: '1rem', color: '#4d9bff', whiteSpace: 'nowrap' }}>🕹️ {language === 'en' ? 'Original' : 'Original'}</span>
                    <strong style={{ fontSize: '1.1rem', color: '#9b98cf' }}>{language === 'en' ? 'Pick starter' : 'Elige inicial'}</strong>
                  </button>
                </div>

                <div className="generation-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
                  {(() => {
                    const branchUnlocked = isBranchUnlocked(generation)
                    return (
                      <button
                        className={`gen-tile ${difficulty === 'branch' ? 'is-active' : ''} ${!branchUnlocked ? 'is-locked' : ''}`}
                        onClick={() => { playClick(); handleSelectDifficulty('branch') }}
                        onMouseEnter={playHover}
                        type="button"
                        disabled={isLoading || !branchUnlocked}
                        style={{
                          borderColor: difficulty === 'branch' ? '#ee3b2f' : branchUnlocked ? 'rgba(238, 59, 47, 0.6)' : '#475569',
                          background: difficulty === 'branch' ? 'rgba(238, 59, 47, 0.28)' : branchUnlocked ? 'rgba(238, 59, 47, 0.08)' : 'rgba(15, 23, 42, 0.6)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '12px',
                          opacity: branchUnlocked ? 1 : 0.65,
                          cursor: (!isLoading && branchUnlocked) ? 'pointer' : 'not-allowed'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem', color: branchUnlocked ? '#ff5c52' : '#7d7ab5' }}>🗺️ {language === 'en' ? 'PATH' : 'RUTA'} {branchUnlocked ? '' : '🔒'}</span>
                          <strong style={{ fontSize: '1rem', color: branchUnlocked ? '#ff5c52' : '#7d7ab5' }}>— {language === 'en' ? 'Choose your route' : 'Elige tu ruta'}</strong>
                        </div>
                        {!branchUnlocked && (
                          <span className="lock-text">
                            {language === 'en' ? 'Complete Medium to unlock' : 'Completa Intermedio para desbloquear'}
                          </span>
                        )}
                      </button>
                    )
                  })()}
                </div>

                <div className="generation-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
                  {(() => {
                    const infUnlocked = isInfiniteUnlocked(generation)
                    return (
                      <button
                        className={`gen-tile ${difficulty === 'infinite' ? 'is-active' : ''} ${!infUnlocked ? 'is-locked' : ''}`}
                        onClick={() => {
                          playClick()
                          handleSelectDifficulty('infinite')
                          if (infUnlocked && !authUser) {
                            setApiError('Para jugar al modo Infinite necesitas una cuenta. Crea una o inicia sesión en el ranking.')
                            openLeaderboard()
                          }
                        }}
                        onMouseEnter={playHover}
                        type="button"
                        disabled={isLoading || !infUnlocked}
                        style={{
                          borderColor: infUnlocked ? '#a855f7' : '#475569',
                          background: !infUnlocked
                            ? 'rgba(15, 23, 42, 0.6)'
                            : difficulty === 'infinite' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(168, 85, 247, 0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '12px',
                          opacity: infUnlocked ? 1 : 0.65,
                          cursor: infUnlocked ? 'pointer' : 'not-allowed'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem', color: infUnlocked ? '#cba3ff' : '#7d7ab5' }}>♾️ INFINITE {infUnlocked ? '' : '🔒'}</span>
                          <strong style={{ fontSize: '1rem', color: infUnlocked ? '#cba3ff' : '#7d7ab5' }}>— {language === 'en' ? 'Endless routes' : 'Rutas infinitas'}</strong>
                        </div>
                        {infUnlocked && !authUser && (
                          <span className="lock-text" style={{ color: '#ffcb05' }}>
                            🔑 Requiere cuenta (inicia sesión en Ranking ♾️)
                          </span>
                        )}
                        {!infUnlocked && (
                          <span className="lock-text">
                            🔒 Completa {generationRegions[generation]} en Difícil
                          </span>
                        )}
                      </button>
                    )
                  })()}
                  {difficulty === 'infinite' && (
                    <div
                      className="panel"
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                        <span>{language === 'en' ? 'Nodes per batch' : 'Nodos por lote'}</span>
                        <strong style={{ color: '#cba3ff' }}>{infiniteNodeSize}</strong>
                      </label>
                      <input
                        type="range"
                        min={3}
                        max={12}
                        step={1}
                        value={infiniteNodeSize}
                        onChange={(e) => setInfiniteNodeSize(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#a855f7' }}
                      />
                      <span className="muted" style={{ fontSize: '0.7rem' }}>
                        {language === 'en'
                          ? `Each stage shows ${infiniteNodeSize} nodes. Lower = shorter, faster stages. Higher = longer routes.`
                          : `Cada etapa muestra ${infiniteNodeSize} nodos. Menos = etapas más cortas y rápidas. Más = rutas más largas.`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="generation-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
                  {(() => {
                    const coliseumUnlocked = isColiseumUnlocked()
                    return (
                      <button
                        className={`gen-tile ${difficulty === 'coliseum' ? 'is-active' : ''}`}
                        onClick={() => { if (!coliseumUnlocked) return; playClick(); handleSelectDifficulty('coliseum') }}
                        onMouseEnter={playHover}
                        type="button"
                        disabled={isLoading || !coliseumUnlocked}
                        style={{
                          borderColor: difficulty === 'coliseum' ? '#ffcb05' : '#475569',
                          background: difficulty === 'coliseum' ? 'rgba(250,204,21,0.15)' : 'rgba(15,23,42,0.6)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: '4px', padding: '12px', opacity: coliseumUnlocked ? 1 : 0.65,
                          cursor: (!isLoading && coliseumUnlocked) ? 'pointer' : 'not-allowed'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem', color: coliseumUnlocked ? '#ffcb05' : '#7d7ab5' }}>{t('setup.coliseum')} {coliseumUnlocked ? '' : '🔒'}</span>
                          <strong style={{ fontSize: '1rem', color: coliseumUnlocked ? '#ffcb05' : '#7d7ab5' }}>{t('setup.coliseum8')}</strong>
                        </div>
                        {!coliseumUnlocked && (
                          <span className="lock-text">
                            {t('setup.unlockColiseum')}
                          </span>
                        )}
                      </button>
                    )
                  })()}
                </div>

                <h2 style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>🎲 {t('setup.daily')}</h2>
                <div className="generation-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
                  {(() => {
                    const dailyConfig = getDailyConfig(dailySeed, [1, 2, 3, 4, 5, 6, 7, 8, 9])
                    const diffLabel = dailyConfig ? difficultyLabel(language, dailyConfig.difficulty).title : ''
                    const genLabel = dailyConfig ? `${generationRegions[dailyConfig.generation]}` : ''
                    const modName = dailyConfig ? runModName(dailyConfig.modifierId) : ''
                    return (
                      <button
                        className="gen-tile"
                        onClick={() => {
                          if (!dailyConfig) return
                          playClick()
                          isDailyRunRef.current = true
                          startNewRun()
                        }}
                        onMouseEnter={playHover}
                        type="button"
                        disabled={isLoading || dailyPlayed || !dailyConfig || coopMode}
                        style={{
                          borderColor: dailyPlayed ? '#475569' : '#37d16b',
                          background: dailyPlayed ? 'rgba(15,23,42,0.6)' : 'rgba(34,197,94,0.1)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '12px',
                          opacity: dailyPlayed ? 0.65 : 1, cursor: dailyPlayed ? 'not-allowed' : 'pointer',
                          border: `1px solid ${dailyPlayed ? '#475569' : '#37d16b'}`, borderRadius: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem', color: dailyPlayed ? '#7d7ab5' : '#37d16b' }}>📅 {dailyPlayed ? t('setup.dailyDone2') : t('setup.dailyTitle')}</span>
                        </div>
                        <strong style={{ fontSize: '0.85rem', color: '#9b98cf' }}>
                          {dailyPlayed ? t('setup.dailyTomorrow') : `Gen ${dailyConfig?.generation} (${genLabel}) — ${diffLabel} — ${modName}`}
                        </strong>
                      </button>
                    )
                  })()}
                </div>
              </div>

              <div className="setup-card setup-card-coop">
                <h2 className="setup-card-title">{t('coop.title2')}</h2>
                <div className="generation-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0' }}>
                  {!coopMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid #3f3f6e', borderRadius: '12px', background: 'rgba(15,23,42,0.6)' }}>
                      <p style={{ margin: '0', color: '#9b98cf', fontSize: '0.8rem' }}>
                        {t('coop.intro')}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <label style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '4px', color: '#9b98cf', fontSize: '0.75rem' }}>
                          {t('coop.generation')}
                          <select
                            value={coopGen}
                            onChange={(e) => setCoopGen(Number(e.target.value))}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                          >
                            {generations.map((g) => (
                              <option key={g} value={g} disabled={!isGenUnlocked(g)}>Gen {g} — {generationRegions[g]}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '4px', color: '#9b98cf', fontSize: '0.75rem' }}>
                          {t('coop.difficulty')}
                          <select
                            value={coopDiff}
                            onChange={(e) => setCoopDiff(e.target.value as 'easy' | 'medium' | 'hard')}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                          >
                            <option value="easy">{t('coop.easy')}</option>
                            <option value="medium">{t('coop.medium')}</option>
                            <option value="hard">{t('coop.hard')}</option>
                          </select>
                        </label>
                      </div>
                      <button
                        className="cta"
                        type="button"
                        disabled={isLoading}
                        onClick={() => { playClick(); void handleCreateCoopSession() }}
                        style={{ background: '#37d16b', color: '#12122b' }}
                      >
                        {t('coop.create')}
                      </button>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          value={coopJoinCode}
                          onChange={(e) => setCoopJoinCode(e.target.value.toUpperCase())}
                          placeholder={t('coop.joinCode')}
                          maxLength={6}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', textTransform: 'uppercase' }}
                        />
                        <button
                          className="secondary"
                          type="button"
                          disabled={isLoading}
                          onClick={() => { playClick(); void handleJoinCoopSession() }}
                        >
                          {t('coop.join')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid #37d16b', borderRadius: '12px', background: 'rgba(34,197,94,0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ color: '#37d16b', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                            {t('coop.sessionCode')}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <span style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '2rem', letterSpacing: '8px', textShadow: '0 2px 0 rgba(0,0,0,0.5)' }}>
                              {coopSessionCode}
                            </span>
                            <CopyCodeButton code={coopSessionCode} />
                          </div>
                        </div>
                        <button className="tiny-btn" type="button" onClick={cancelCoopSession} style={{ color: '#ff8a80', alignSelf: 'flex-start' }}>
                          {t('pvp.cancel')}
                        </button>
                      </div>
                      {coopMyRole === 'a' ? (
                        coopPartnerJoined ? (
                          <p style={{ margin: '0', color: '#37d16b', fontSize: '0.85rem' }}>{t('coop.partnerJoined')}</p>
                        ) : (
                          <p style={{ margin: '0', color: '#ffcb05', fontSize: '0.85rem' }}>{t('coop.shareCode')}</p>
                        )
                      ) : (
                        <p style={{ margin: '0', color: '#37d16b', fontSize: '0.85rem' }}>{t('coop.sessionJoined')}</p>
                      )}
                      <p style={{ margin: '0', color: '#7d7ab5', fontSize: '0.75rem' }}>
                        {t('coop.sessionInfo', { gen: coopGen, region: generationRegions[coopGen], diff: difficultyLabel(language, coopDiff).title })}
                      </p>
                    </div>
                  )}
                  {coopError && <p className="error-line" style={{ marginTop: '4px' }}>{coopError}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="setup-grid">
            <div className="setup-col">
              <div className="setup-card setup-card-challenges">
                <h2 className="setup-card-title"><span className="setup-step">3</span> {t('setup.challenges')} <span className="muted" style={{ fontSize: '0.6rem', fontWeight: 'normal' }}>{t('setup.challengesOptional')}</span></h2>
                {(() => {
                  // En Cooperativo y COLISEUM los desafíos están siempre disponibles.
                  // En Infinite NO se permiten (siempre bloqueados). En el resto
                  // siguen el desbloqueo normal (completar la generación en Intermedio).
                  const challengesUnlocked = coopMode || difficulty === 'coliseum'
                    ? true
                    : (difficulty === 'infinite'
                      ? false
                      : (generation === 0
                        ? generations.every((g) => progression.completedMedium.includes(g))
                        : progression.completedMedium.includes(generation)))

                  const challengeCategories = [
                    {
                      title: t('challenge.cat.route'),
                      items: [
                        { key: 'noShops' as const, label: t('ch.noShops'), desc: t('ch.noShops.desc') },
                        { key: 'noRests' as const, label: t('ch.noRests'), desc: t('ch.noRests.desc') },
                        { key: 'allTeamRocket' as const, label: t('ch.allTeamRocket'), desc: t('ch.allTeamRocket.desc') },
                        { key: 'bossRush' as const, label: t('ch.bossRush'), desc: t('ch.bossRush.desc') },
                        { key: 'blindRoute' as const, label: t('ch.blindRoute'), desc: t('ch.blindRoute.desc') },
                      ]
                    },
                    {
                      title: t('challenge.cat.visual'),
                      items: [
                        { key: 'allShiny' as const, label: t('ch.allShiny'), desc: t('ch.allShiny.desc') },
                      ]
                    },
                    {
                      title: t('challenge.cat.combat'),
                      items: [
                        { key: 'noItems' as const, label: t('ch.noItems'), desc: t('ch.noItems.desc') },
                        { key: 'restrictedMoves' as const, label: t('ch.restrictedMoves'), desc: t('ch.restrictedMoves.desc') },
                        { key: 'firstStrike' as const, label: t('ch.firstStrike'), desc: t('ch.firstStrike.desc') },
                        { key: 'noCrits' as const, label: t('ch.noCrits'), desc: t('ch.noCrits.desc') },
                        { key: 'typeRandomizer' as const, label: t('ch.typeRandomizer'), desc: t('ch.typeRandomizer.desc') },
                        { key: 'fixedLevel' as const, label: t('ch.fixedLevel'), desc: t('ch.fixedLevel.desc') },
                      ]
                    },
                    {
                      title: t('challenge.cat.team'),
                      items: [
                        { key: 'soloStarter' as const, label: t('ch.soloStarter'), desc: t('ch.soloStarter.desc') },
                        { key: 'fixedTeam' as const, label: t('ch.fixedTeam'), desc: t('ch.fixedTeam.desc') },
                        { key: 'noEvolution' as const, label: t('ch.noEvolution'), desc: t('ch.noEvolution.desc') },
                        { key: 'egglocke' as const, label: t('ch.egglocke'), desc: t('ch.egglocke.desc') },
                      ]
                    },
                    {
                      title: t('challenge.cat.economy'),
                      items: [
                        { key: 'noPurchasing' as const, label: t('ch.noPurchasing'), desc: t('ch.noPurchasing.desc') },
                        { key: 'noMoney' as const, label: t('ch.noMoney'), desc: t('ch.noMoney.desc') },
                      ]
                    },
                    {
                      title: t('challenge.cat.difficulty'),
                      items: [
                        { key: 'scalingEnemies' as const, label: t('ch.scalingEnemies'), desc: t('ch.scalingEnemies.desc') },
                        { key: 'noHealing' as const, label: t('ch.noHealing'), desc: t('ch.noHealing.desc') },
                        { key: 'doubleModifiers' as const, label: t('ch.doubleModifiers'), desc: t('ch.doubleModifiers.desc') },
                        { key: 'speedrun' as const, label: t('ch.speedrun'), desc: t('ch.speedrun.desc') },
                        { key: 'totalRandomizer' as const, label: t('ch.totalRandomizer'), desc: t('ch.totalRandomizer.desc') },
                      ]
                    },
                    {
                      title: t('challenge.cat.extreme'),
                      items: [
                        { key: 'nuzlocke' as const, label: t('ch.nuzlocke'), desc: t('ch.nuzlocke.desc') },
                        { key: 'ironman' as const, label: t('ch.ironman'), desc: t('ch.ironman.desc') },
                        { key: 'nuzlockeHardcore' as const, label: t('ch.nuzlockeHardcore'), desc: t('ch.nuzlockeHardcore.desc') },
                        { key: 'challengeGauntlet' as const, label: t('ch.challengeGauntlet'), desc: t('ch.challengeGauntlet.desc') },
                      ]
                    },
                  ]

                  return (
                    <div className="challenge-section" style={!challengesUnlocked ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
                      {!challengesUnlocked && (
                        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#fbbf24' }}>
                          {difficulty === 'infinite'
                            ? t('ch.locked')
                            : t('ch.lockedGens', { region: generation === 0 ? 'todas las generaciones' : `Gen ${generation} (${generationRegions[generation]})` })}
                        </p>
                      )}
                      {challengeCategories.map((cat) => (
                        <div key={cat.title} style={{ marginBottom: '0.75rem' }}>
                          <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: '#9b98cf', fontWeight: 'normal', textAlign: 'center' }}>{cat.title}</h3>
                          <div className="challenge-toggles">
                            {cat.items.map((item) => (
                              <button
                                key={item.key}
                                className={`challenge-toggle ${runChallenges[item.key] ? 'is-active' : ''}`}
                                onClick={() => {
                                  playClick()
                                  if (item.key === 'challengeGauntlet' && runChallenges.challengeGauntlet && gauntletKeys.length > 0) {
                                    setRunChallenges((c) => {
                                      const next = { ...c, challengeGauntlet: false }
                                      for (const key of gauntletKeys) {
                                        next[key] = false
                                      }
                                      return next
                                    })
                                    setGauntletKeys([])
                                    return
                                  }
                                  setRunChallenges((c) => {
                                    const next = !c[item.key]
                                    if (item.key === 'ironman') {
                                      return { ...c, ironman: next, noEvolution: next, fixedTeam: next, noHealing: next }
                                    }
                                    if (item.key === 'nuzlockeHardcore') {
                                      return { ...c, nuzlockeHardcore: next, nuzlocke: next, noItems: next, noRests: next }
                                    }
                                    return { ...c, [item.key]: next }
                                  })
                                }}
                                onMouseEnter={playHover}
                                type="button"
                                disabled={!challengesUnlocked}
                                title={item.desc}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>

          <div className="setup-footer">
            <button className="cta setup-start" onClick={handleStartRunClick} onMouseEnter={playHover} type="button" disabled={isLoading}>
              {isLoading ? t('setup.loading') : t('setup.startAdventure')}
            </button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="secondary" onClick={() => { playClick(); setShowPokedex(true) }} onMouseEnter={playHover} type="button">
                📖 Abrir Pokédex
              </button>
            </div>
            {apiError && <p className="error-line">{apiError}</p>}
          </div>
        </section>
      )}

      {(screen === 'route' || screen === 'battle' || screen === 'shop' || screen === 'spin' || screen === 'pokeRand' || screen === 'move' || screen === 'mega' || screen === 'gmax' || screen === 'primal' || screen === 'trade' || screen === 'blackmarket' || screen === 'speculator' || screen === 'safari' || screen === 'orchard' || screen === 'fossil' || screen === 'fishing' || screen === 'mine' || screen === 'daycare' || screen === 'weather' || screen === 'mirror' || screen === 'ranch' || screen === 'double' || screen === 'casino') && activePokemon && (
        <section className="roulette-layout">
          <article className="panel trainer-panel">
            <p className="muted small-tag">{t('route.trainer')}</p>
            <div style={{ position: 'relative', display: 'block', width: 'fit-content', margin: '0 auto' }}>
              <ThemedTooltip content={<PokemonMetaTooltip p={activePokemon} />}>
                <img className={`sprite trainer-sprite${activePokemon.megaEvolved ? ' mega-active' : ''}${activePokemon.gmaxEvolved ? ' gmax-active' : ''} ${statusSpriteClass(activePokemon.status, activePokemon.leechSeed)}`} src={activePokemon.sprite} alt={activePokemon.name} onError={fallbackSprite} />
              </ThemedTooltip>
              <StatusFloat pokemon={activePokemon} />
              <FloatingCombatText data={playerCombatFloat} />
            </div>
            <h2>
              {activePokemon.name}{activePokemon.shiny ? ' ✨' : ''}
              {activePokemon.leechSeed && <LeechSeedBadge />}
              <StatusBadge status={activePokemon.status} />
            </h2>
            <p className="muted" style={{ fontSize: '1.2rem' }}>
              {generation === 0 ? 'Random All-Stars' : `Gen ${generation}`} · Nv.{activePokemon.level}
            </p>

            <div className="hp-line">
              <span>HP</span>
              <strong>{activePokemon.hp}/{activePokemon.maxHp}</strong>
            </div>
            <div className="meter">
              <div style={{ width: `${(activePokemon.hp / activePokemon.maxHp) * 100}%`, background: hpBarColor(activePokemon.hp / activePokemon.maxHp) }}></div>
            </div>

            <p className="label">{t('route.team')} {team.length}/{maxTeamSize}{daycareEgg ? ' · 🥚 1' : ''}</p>
            <div className="team-grid" onDragOver={(e) => { e.preventDefault() }}>
              {team.map((pokemon, index) => (
                <div key={`${pokemon.id}-${index}`} className="sprite-tooltip-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    className={`team-slot ${index === activeIndex ? 'is-active' : ''} ${pokemon.hp <= 0 ? 'is-fainted' : ''} ${dragItem?.type === 'team' && dragItem.index === index ? 'is-dragging' : ''}`}
                    type="button"
                    data-drop-type="team"
                    data-drop-index={index}
                    onClick={() => {
                      if (suppressClickRef.current) { suppressClickRef.current = false; return }
                      switchActive(index)
                    }}
                    disabled={pokemon.hp <= 0 || isLoading}
                    draggable={!isLoading && canDragTeam()}
                    onPointerDown={(e) => pointerDragStart(e, { type: 'team', index })}
                    onPointerMove={pointerDragMove}
                    onPointerUp={pointerDragEnd}
                    onPointerCancel={pointerDragCancel}
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'team'); suppressClickRef.current = true; dragSourceRef.current = { type: 'team', index }; setDragItem({ type: 'team', index }) }}
                    onDragEnd={() => { dragSourceRef.current = null; setDragItem(null); setTimeout(() => { suppressClickRef.current = false }, 400) }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      const src = dragSourceRef.current
                      if (!src) return
                      if (src.type === 'team') handleTeamSlotDrop(src.index, index)
                      else if (src.type === 'pc') movePCToTeam(src.index, index)
                      dragSourceRef.current = null
                      setDragItem(null)
                    }}
                  >
                    <img src={pokemon.sprite} alt={pokemon.name} onError={fallbackSprite} />
                    {pokemon.holdItem && ITEM_SPRITES[pokemon.holdItem] && (
                      <ThemedTooltip content={`${itemLocalizedName(pokemon.holdItem ?? '')}: ${itemDesc(pokemon.holdItem ?? '')}`}>
                        <img
                          src={ITEM_SPRITES[pokemon.holdItem]}
                          alt={pokemon.holdItem}
                          style={{ width: '18px', height: '18px', imageRendering: 'pixelated', position: 'absolute', bottom: '4px', right: '4px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
                        />
                      </ThemedTooltip>
                    )}
                    <strong style={{ color: '#f8fafc', fontSize: '0.82rem', lineHeight: 1.2, textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{pokemon.name}{pokemon.shiny ? ' ✨' : ''}{pokemon.leechSeed && <LeechSeedBadge compact />}</strong>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                      <strong style={{ color: pokemon.hp <= 0 ? '#f87171' : '#7ceb95', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{pokemon.hp}</strong>
                      <span style={{ color: '#a9a7d6' }}>/{pokemon.maxHp}</span>
                      <StatusBadge status={pokemon.status} compact />
                    </span>
                  </button>
                  <div className="sprite-tooltip">
                    <div className="tooltip-name">
                      {pokemon.name}
                      {pokemon.leechSeed && <LeechSeedBadge />}
                      <StatusBadge status={pokemon.status} />
                    </div>
                    {pokemon.holdItem && (
                      <div style={{ fontSize: '0.65rem', color: '#cba3ff', marginBottom: '4px' }}>
                        {ITEM_SPRITES[pokemon.holdItem] && (
                          <img src={ITEM_SPRITES[pokemon.holdItem]} alt="" style={{ width: '14px', height: '14px', imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: '3px' }} />
                        )}
                        {itemLocalizedName(pokemon.holdItem ?? '')} — {itemDesc(pokemon.holdItem ?? '')}
                      </div>
                    )}
                    {pokemon.types && pokemon.types.length > 0 && (
                      <div className="tooltip-types">
                        {pokemon.types.map((t) => (
                          <span key={t} className="tooltip-type-badge" style={{ background: TYPE_COLORS[t] ?? '#475569', color: '#fff' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {(() => {
                      const eff = getEffectiveStats(pokemon)
                      const stages = pokemon.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
                      const isMegaGmax = pokemon.megaEvolved || pokemon.gmaxEvolved
                      const fmt = (base: number, eff_: number, stage_: number) => {
                        const parts: ReactNode[] = []
                        const diff = eff_ - base
                        if (diff !== 0) {
                          const color = isMegaGmax ? '#ff9ad6' : diff > 0 ? '#7ceb95' : '#ff8a80'
                          parts.push(<strong key="v" style={{ color }}>{eff_}</strong>)
                          parts.push(<span key="i" style={{ fontSize: '0.7rem', color }}> ({diff > 0 ? '+' : ''}{diff})</span>)
                        } else {
                          parts.push(<strong key="v">{base}</strong>)
                        }
                        if (stage_ !== 0) {
                          const color = stage_ > 0 ? '#7ceb95' : '#ee3b2f'
                          parts.push(<span key="s" style={{ fontSize: '0.7rem', color, marginLeft: '2px' }}>({stage_ > 0 ? '+' : ''}{stage_})</span>)
                        }
                        return <>{parts}</>
                      }
                      return (
                        <>
                          <div className="tooltip-stat"><span>{t('stat.level')}</span><strong>{pokemon.level}</strong></div>
                          <div className="tooltip-stat"><span>{t('stat.hp')}</span><strong>{pokemon.hp}/{pokemon.maxHp}</strong></div>
                          <div className="tooltip-stat"><span>{t('stat.attack')}</span>{fmt(pokemon.attack, eff.attack, stages.attack)}</div>
                          <div className="tooltip-stat"><span>{t('stat.defense')}</span>{fmt(pokemon.defense, eff.defense, stages.defense)}</div>
                          <div className="tooltip-stat"><span>{t('stat.spAtk')}</span>{fmt(pokemon.spAttack, eff.spAttack, stages.spAttack ?? 0)}</div>
                          <div className="tooltip-stat"><span>{t('stat.spDef')}</span>{fmt(pokemon.spDefense, eff.spDefense, stages.spDefense ?? 0)}</div>
                          <div className="tooltip-stat"><span>{t('stat.speed')}</span>{fmt(pokemon.speed, eff.speed, stages.speed)}</div>
                        </>
                      )
                    })()}
                    {pokemon.moves.length > 0 && (
                      <div className="tooltip-moves">
                        {pokemon.moves.slice(0, 4).map((m) => (
                          <span key={m.name} className="tooltip-move">
                            {moveName(m)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {pokemon.hp <= 0 && (
                    <button
                      type="button"
                      className="tiny-btn"
                      style={{ background: '#ee3b2f', color: '#fff', fontSize: '0.7rem', padding: '2px 4px' }}
                      onClick={() => removeFaintedPokemon(index)}
                    >
                      🗑️ Liberar
                    </button>
                  )}
                  {pokemon.holdItem && (
                    <button
                      type="button"
                      className="tiny-btn"
                      style={{ background: '#7c3aed', color: '#fff', fontSize: '0.6rem', padding: '1px 4px' }}
                      onClick={(e) => { e.stopPropagation(); unequipItem(index) }}
                    >
                      ✕ Quitar {itemLocalizedName(pokemon.holdItem ?? '')}
                    </button>
                  )}
                  {pokemon.hp > 0 && team.length > 1 && (
                    <button
                      type="button"
                      className="tiny-btn"
                      style={{ background: '#3b82f6', color: '#fff', fontSize: '0.6rem', padding: '1px 4px' }}
                      onClick={(e) => { e.stopPropagation(); depositToPC(index) }}
                    >
                      → PC
                    </button>
                  )}
                </div>
              ))}
              {daycareEgg && (
                <div className="team-slot" title={`${language === 'en' ? 'Egg' : 'Huevo'}: ${daycareEgg.nodesLeft} ${language === 'en' ? 'nodes left' : 'nodos restantes'}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', borderStyle: 'dashed', borderColor: '#fde68a', cursor: 'default' }}>
                  <img src={ITEM_SPRITES['Huevo']} alt="Huevo" style={{ width: '34px', height: '34px', imageRendering: 'pixelated' }} />
                  <strong style={{ color: '#fde68a', fontSize: '0.72rem' }}>Huevo</strong>
                  <span style={{ color: '#d9d6f2', fontSize: '0.7rem' }}>{daycareEgg.nodesLeft}</span>
                </div>
              )}
              {Array.from({ length: Math.max(0, maxTeamSize - team.length - (daycareEgg ? 1 : 0)) }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="team-slot empty"
                  data-drop-type="team"
                  data-drop-index={team.length + index}
                  onDragOver={(e) => { e.preventDefault() }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const src = dragSourceRef.current
                    if (!src) return
                    const toIdx = team.length + index
                    if (src.type === 'team') reorderTeam(src.index, toIdx)
                    else if (src.type === 'pc') movePCToTeam(src.index, toIdx)
                    dragSourceRef.current = null
                    setDragItem(null)
                  }}
                >
                  Empty
                </div>
              ))}
            </div>

            {pcStorage.length > 0 && (
              <>
                <p className="label" style={{ marginTop: '0.75rem' }}>PC ({pcStorage.length})</p>
                <div
                  className="team-grid"
                  data-drop-type="pc"
                  data-drop-index="-1"
                  onDragOver={(e) => { e.preventDefault() }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const src = dragSourceRef.current
                    if (!src) return
                    // Soltar un miembro del equipo en el hueco del PC lo manda al PC.
                    if (src.type === 'team') depositToPC(src.index)
                    dragSourceRef.current = null
                    setDragItem(null)
                  }}
                >
                  {pcStorage.map((pokemon, index) => (
                    <div key={`pc-${index}`} className="sprite-tooltip-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <button
                        className={`team-slot ${dragItem?.type === 'pc' && dragItem.index === index ? 'is-dragging' : ''}`}
                        type="button"
                        data-drop-type="pc"
                        data-drop-index={index}
                        onClick={() => {
                          if (suppressClickRef.current) { suppressClickRef.current = false; return }
                          withdrawFromPC(index)
                        }}
                        disabled={isLoading}
                        draggable={!isLoading && canDragTeam()}
                        onPointerDown={(e) => pointerDragStart(e, { type: 'pc', index })}
                        onPointerMove={pointerDragMove}
                        onPointerUp={pointerDragEnd}
                        onPointerCancel={pointerDragCancel}
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'pc'); suppressClickRef.current = true; dragSourceRef.current = { type: 'pc', index }; setDragItem({ type: 'pc', index }) }}
                        onDragEnd={() => { dragSourceRef.current = null; setDragItem(null); setTimeout(() => { suppressClickRef.current = false }, 400) }}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                        onDrop={(e) => {
                          e.preventDefault(); e.stopPropagation()
                          const src = dragSourceRef.current
                          if (!src) return
                          if (src.type === 'pc') reorderPC(src.index, index)
                          else if (src.type === 'team') depositToPC(src.index)
                          dragSourceRef.current = null
                          setDragItem(null)
                        }}
                      >
                        <img src={pokemon.sprite} alt={pokemon.name} onError={fallbackSprite} />
                        {pokemon.holdItem && ITEM_SPRITES[pokemon.holdItem] && (
                          <img
                            src={ITEM_SPRITES[pokemon.holdItem]}
                            alt={pokemon.holdItem}
                            title={`${itemLocalizedName(pokemon.holdItem ?? '')}: ${itemDesc(pokemon.holdItem ?? '')}`}
                            style={{ width: '18px', height: '18px', imageRendering: 'pixelated', position: 'absolute', bottom: '4px', right: '4px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
                          />
                        )}
                        <strong style={{ color: '#f8fafc', fontSize: '0.82rem', lineHeight: 1.2, textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{pokemon.name}{pokemon.shiny ? ' ✨' : ''}</strong>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                          <strong style={{ color: pokemon.hp <= 0 ? '#f87171' : '#7ceb95', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{pokemon.hp}</strong>
                          <span style={{ color: '#a9a7d6' }}>/{pokemon.maxHp}</span>
                          <StatusBadge status={pokemon.status} compact />
                        </span>
                      </button>
                      <button
                        type="button"
                        className="tiny-btn"
                        style={{ background: '#3b82f6', color: '#fff', fontSize: '0.6rem', padding: '1px 4px' }}
                        onClick={() => withdrawFromPC(index)}
                      >
                        → Equipo
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {team.length > 1 && pcStorage.length > 0 && (
              <p style={{ fontSize: '0.7rem', color: '#7d7ab5', marginTop: '0.5rem', textAlign: 'center' }}>
                Arrastra los Pokémon para reordenar el equipo y el PC, o arrastra entre ambos. Si el equipo está lleno, se intercambia con el de la casilla.
              </p>
            )}
          </article>

          <article className="panel center-panel">
            <h2>
              {difficulty === 'infinite' ? `${t('route.route')} #${route.length}` : `${t('route.route')} (${routeIndex + 1}/${route.length})`}
              {runChallenges.speedrun && screen === 'battle' && (
                <span style={{ marginLeft: '10px', fontSize: '0.9rem', color: speedrunSeconds <= 10 ? '#ee3b2f' : '#ffcb05', fontWeight: 'bold' }}>
                  ⏱️ {speedrunSeconds}s
                </span>
              )}
            </h2>
            {difficulty === 'infinite' && (
              <div style={{ textAlign: 'right', marginBottom: '0.5rem' }}>
                <button className="tiny-btn" type="button" onClick={() => { playClick(); setShowEndRunModal(true) }} style={{ color: '#ffcb05', borderColor: '#ffcb05' }}>
                  🏁 Terminar run
                </button>
              </div>
            )}
            {difficulty === 'original' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', padding: '6px 10px', background: 'rgba(77,155,255,0.1)', borderRadius: '8px', border: '1px solid rgba(77,155,255,0.35)' }}>
                <span style={{ fontSize: '0.85rem', color: '#4d9bff', fontWeight: 'bold' }}>🏅 {language === 'en' ? 'Medals' : 'Medallas'}: {originalMedals.length}/8</span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {Array.from({ length: 8 }, (_, i) => {
                    const medal = originalMedals[i]
                    return (
                      <div key={i} style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        background: medal ? 'rgba(77,155,255,0.3)' : 'rgba(255,255,255,0.05)',
                        border: medal ? '2px solid #4d9bff' : '2px dashed #475569',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                      }}>
                        {medal ? <img src={medal.sprite} alt={medal.name} style={{ width: '13px', height: '13px', imageRendering: 'pixelated' }} /> : <span style={{ fontSize: '0.55rem', color: '#475569' }}>?</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {difficulty === 'branch' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', padding: '6px 10px', background: 'rgba(238,59,47,0.1)', borderRadius: '8px', border: '1px solid rgba(238,59,47,0.4)' }}>
                <span style={{ fontSize: '0.85rem', color: '#ff5c52', fontWeight: 'bold' }}>🗺️ {language === 'en' ? 'Path medals' : 'Medallas de ruta'}: {branchMedals.length}/8</span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {Array.from({ length: 8 }, (_, i) => {
                    const medal = branchMedals[i]
                    return (
                      <div key={i} style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        background: medal ? 'rgba(238,59,47,0.3)' : 'rgba(255,255,255,0.05)',
                        border: medal ? '2px solid #ee3b2f' : '2px dashed #475569',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                      }}>
                        {medal ? <img src={medal.sprite} alt={medal.name} style={{ width: '13px', height: '13px', imageRendering: 'pixelated' }} /> : <span style={{ fontSize: '0.55rem', color: '#475569' }}>?</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {difficulty !== 'infinite' && difficulty !== 'coliseum' && difficulty !== 'original' && difficulty !== 'branch' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', padding: '6px 10px', background: 'rgba(250,204,21,0.08)', borderRadius: '8px', border: '1px solid rgba(250,204,21,0.2)' }}>
                <span style={{ fontSize: '0.85rem', color: '#ffcb05', fontWeight: 'bold' }}>{t('route.stage')} {currentStage}/3</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[0, 1, 2].map(i => {
                    const badge = badges[i]
                    return (
                      <div key={i} style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: badge ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.05)',
                        border: badge ? '2px solid #ffcb05' : '2px dashed #475569',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', transition: 'all 0.3s'
                      }}>
                        {badge ? (
                          <img src={badge.sprite} alt={badge.name} style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                            title={badge.name} />
                        ) : (
                          <span style={{ fontSize: '0.65rem', color: '#475569' }}>?</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {runChallenges.egglocke && eggInventory.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.5rem' }}>
                🥚 Huevos: {eggInventory.length} {eggInventory.map(e => `(${e.name}: ${e.hatchIn})`).join(' ')}
              </div>
            )}
            {modifier2 && (
              <div style={{ fontSize: '0.75rem', color: '#cba3ff', marginBottom: '0.5rem' }}>
                🎰 Modifier 2: <strong>{runModName(modifier2.id ?? '')}</strong> — {runModDesc(modifier2.id ?? '')}
              </div>
            )}
            <div
              className={difficulty === 'infinite' ? 'route-map is-infinite' : 'route-map'}
              ref={difficulty === 'infinite' ? routeMapRef : undefined}
              style={difficulty === 'infinite'
                ? { paddingRight: '4px', maxHeight: '340px', overflowY: 'auto', overflowX: 'auto' }
                : difficulty === 'branch'
                  ? { paddingRight: '4px', maxHeight: '620px', overflowY: 'auto', overflowX: 'hidden' }
                  : { paddingRight: '4px' }}
            >
              {difficulty === 'branch' ? (
                // Mapa ramificado del Modo Ruta: se muestra solo en la pantalla de
                // ruta y cuando no hay ningún nodo en curso (al entrar en un nodo
                // se oculta para dejar espacio al juego).
                screen === 'route' && branchMap && !restEncounter ? (
                  (() => {
                    const { positions, width, height } = getBranchMapLayout(branchMap)
                    const doneNodes: BranchNode[] = []
                    const doneIds = new Set<number>()
                    route.forEach(n => { if (n.done) { doneNodes.push(n as BranchNode); doneIds.add(n.id) } })
                    // Nodo elegido en la fila anterior (el último completado).
                    const lastDone = doneNodes.length > 0 ? doneNodes[doneNodes.length - 1] : null
                    const currentRow = branchMap[branchCol] ?? []
                    // En la primera fila se puede elegir cualquiera; después solo los
                    // 2 nodos más próximos al nodo elegido en la fila anterior.
                    const reachableNodes = branchCol === 0 || !lastDone
                      ? currentRow
                      : nearestBranchNodes(lastDone, branchMap[branchCol - 1].length, currentRow)
                    const currentColumnNodes = reachableNodes
                    // Líneas del camino elegido: nodos completados en orden + nodo actual.
                    const pathEdges: Array<[number, number]> = []
                    for (let i = 0; i < doneNodes.length - 1; i++) {
                      pathEdges.push([doneNodes[i].id, doneNodes[i + 1].id])
                    }
                    // Nodo que se está jugando ahora mismo (mapa oculto pero el trazo
                    // del camino queda para cuando se vuelva a mostrar).
                    const firstChoiceId = branchMap[branchCol]?.[0]?.id
                    if (doneNodes.length > 0 && currentNode && currentNode.id !== doneNodes[doneNodes.length - 1].id && currentNode.id !== firstChoiceId) {
                      pathEdges.push([doneNodes[doneNodes.length - 1].id, currentNode.id])
                    }
                    return (
                      <svg
                        viewBox={`0 0 ${width} ${height}`}
                        style={{ width: 'min(780px, 100%)', height: 'auto', display: 'block', maxWidth: '100%', margin: '0 auto' }}
                        role="img"
                        aria-label={t('route.ariaMap')}
                      >
                        {/* Conexiones entre filas: cada nodo solo avanza a los 2 más próximos */}
                        {branchMap.slice(0, -1).map((col, c) => {
                          const next = branchMap[c + 1]
                          return col.map((node) => {
                            const reach = next.length <= 2 ? next : nearestBranchNodes(node, col.length, next)
                            return (
                              <g key={`e-${node.id}`}>
                                {reach.map((nn) => (
                                  <line key={`e-${node.id}-${nn.id}`} x1={positions.get(node.id)?.x} y1={positions.get(node.id)?.y} x2={positions.get(nn.id)?.x} y2={positions.get(nn.id)?.y} stroke="#3f3f6e" strokeWidth="2" strokeLinecap="round" />
                                ))}
                              </g>
                            )
                          })
                        })}
                        {/* Camino elegido resaltado */}
                        {pathEdges.map(([a, b]) => {
                          const pa = positions.get(a); const pb = positions.get(b)
                          if (!pa || !pb) return null
                          return <line key={`p-${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#ee3b2f" strokeWidth="5" strokeLinecap="round" />
                        })}
                        {/* Opciones actuales: aristas desde el nodo elegido anterior */}
                        {lastDone && branchCol > 0 && currentColumnNodes.length > 0 && currentColumnNodes.map(nn => {
                          const pa = positions.get(lastDone.id); const pb = positions.get(nn.id)
                          if (!pa || !pb) return null
                          return <line key={`f-${lastDone.id}-${nn.id}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#ee3b2f" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 5" opacity="0.75" />
                        })}
                        {branchMap.flat().map((node) => {
                          const pos = positions.get(node.id)
                          if (!pos) return null
                          const isCurrentChoice = currentColumnNodes.some(n => n.id === node.id)
                          // El estado "completado" vive en la lista `route`, no en los
                          // nodos de branchMap (que son copias), así que se consulta por id.
                          const isDone = doneIds.has(node.id)
                          const isCurrentNode = currentNode?.id === node.id && screen !== 'route'
                          const clickable = isCurrentChoice && !isDone && !isLoading && screen === 'route'
                          // Opciones descartadas de filas ya pasadas o nodos de la fila
                          // actual que NO son alcanzables: tono grisáceo.
                          const isUnchosen = !isDone && !isCurrentChoice && node.col <= branchCol
                          const isBoss = node.type === 'boss'
                          const color = NODE_TYPE_COLORS[node.type] ?? '#7d7ab5'
                          const radius = isBoss ? 52 : 46
                          return (
                            <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                              className={isCurrentChoice ? 'map-node map-node-current' : 'map-node'}
                              style={{
                                opacity: isUnchosen ? 0.5 : 1,
                                cursor: clickable ? 'pointer' : 'default',
                                filter: isUnchosen ? 'grayscale(0.9)' : undefined,
                              }}
                              onClick={clickable ? () => enterBranchNode(node.id) : undefined}
                            >
                              {/* Anillo rojo en los nodos elegibles */}
                              {clickable && (
                                <>
                                  <circle r={radius + 6} fill="none" stroke="#ee3b2f" strokeWidth="3" className="branch-pulse" />
                                  <circle r={radius + 12} fill="none" stroke="rgba(238,59,47,0.25)" strokeWidth="2" />
                                </>
                              )}
                              {/* Camino elegido en rojo, opciones descartadas en gris */}
                              <circle r={radius}
                                fill={clickable ? '#ee3b2f' : isDone ? '#ee3b2f' : color}
                                fillOpacity={clickable ? 0.30 : isDone ? 0.35 : isUnchosen ? 0.10 : 0.14}
                                stroke={clickable ? '#ff5c52' : isCurrentNode ? '#ffcb05' : isDone ? '#ee3b2f' : isUnchosen ? '#6b7280' : color}
                                strokeWidth={clickable ? 4 : isDone ? 4 : isCurrentNode ? 4 : 2.5}
                              />
                              <text y="0" textAnchor="middle" dominantBaseline="central" fontSize={isBoss ? '50' : '42'} style={{ pointerEvents: 'none' }}>{NODE_EMOJIS[node.type] ?? '•'}</text>
                              {isBoss ? (
                                <text y={radius + 20} textAnchor="middle" fontSize="17" fill={isCurrentNode ? '#ffcb05' : '#f87171'} fontWeight="bold">{node.label}</text>
                              ) : (
                                <text y={radius + 18} textAnchor="middle" fontSize="14" fill={clickable ? '#ff8a80' : isCurrentNode ? '#ffcb05' : isDone ? '#ff8a80' : isUnchosen ? '#9ca3af' : '#d9d6f2'} fontWeight={clickable || isDone || isCurrentNode ? 'bold' : 'normal'}>
                                  {nodeTypeLabel(node)}
                                </text>
                              )}
                            </g>
                          )
                        })}
                      </svg>
                    )
                  })()
                ) : branchMap ? (
                  <p className="muted" style={{ textAlign: 'center', fontSize: '0.8rem', padding: '0.5rem 0' }}>
                    🗺️ {language === 'en' ? 'Node map hidden during the node...' : 'Mapa de nodos oculto durante el nodo...'}
                  </p>
                ) : null
              ) : (
              (() => {
                const { positions, width, height } = getNodeMapLayout(route.length)
                const points = positions.map((p) => `${p.x},${p.y}`).join(' ')
                const isInfiniteMap = difficulty === 'infinite'
                // En Infinite, el mapa no se comprime: se muestra a escala 1:1
                // (cada nodo mantiene su tamaño) y el contenedor hace scroll.
                const displayWidth = isInfiniteMap ? Math.max(width, 480) : width
                const displayHeight = isInfiniteMap ? Math.max(height, 340) : height
                return (
                  <svg
                    viewBox={`0 0 ${width} ${height}`}
                    style={{
                      width: isInfiniteMap ? `${displayWidth * 0.9}px` : '100%',
                      height: isInfiniteMap ? `${displayHeight * 0.9}px` : 'auto',
                      display: 'block',
                      maxWidth: isInfiniteMap ? 'none' : '100%',
                    }}
                    role="img"
                    aria-label={t('route.ariaMap')}
                  >
                    <polyline points={points} fill="none" stroke="#3f3f6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {route.map((node, index) => {
                      const pos = positions[index]
                      const isCurrent = index === routeIndex
                      const isDone = node.done
                      const isBlindHidden = runChallenges.blindRoute && index > routeIndex
                      const color = NODE_TYPE_COLORS[node.type] ?? '#7d7ab5'
                      const label = isBlindHidden ? '???' : nodeTypeLabel(node)
                      const clickable = isCurrent && screen === 'route' && !isLoading && !(node.type === 'rest' && restEncounter)
                      return (
                        <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                          className={isCurrent ? 'map-node map-node-current' : 'map-node'}
                          style={{ opacity: isDone ? 0.45 : 1, cursor: clickable ? 'pointer' : 'default' }}
                          onClick={clickable ? () => enterNode() : undefined}>
                          <circle r="42" fill={color} fillOpacity="0.14" stroke={isCurrent ? '#ffcb05' : color} strokeWidth={isCurrent ? 4 : 2.5} />
                          <text y="0" textAnchor="middle" dominantBaseline="central" fontSize="44" style={{ pointerEvents: 'none' }}>{isBlindHidden ? '?' : NODE_EMOJIS[node.type] ?? '•'}</text>
                          {!isBlindHidden && (
                            <>
                              <text y="-54" textAnchor="middle" fontSize="15" fill={isCurrent ? '#ffcb05' : '#9b98cf'}>#{node.id}</text>
                              <text y="64" textAnchor="middle" fontSize="16" fill={isCurrent ? '#ffcb05' : '#d9d6f2'} fontWeight={isCurrent ? 'bold' : 'normal'}>{label}</text>
                            </>
                          )}
                        </g>
                      )
                    })}
                  </svg>
                )
              })()
              )}
            </div>

            {screen === 'shop' && (
              <div className="action-block shop-block" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: '#ffcb05' }}>{t('shop.mart')}</h3>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#7ceb95' }}>
                    {t('shop.money')}: ${money}
                  </span>
                </div>

                <div className="shop-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                  {shopStock.map((itemName) => {
                    const consumable = ALL_SHOP_ITEMS[itemName]
                    const holdable = HOLDABLE_ITEMS[itemName]
                    if (!consumable && !holdable) return null
                    const data = consumable ?? holdable!
                    const itemIcon = ITEM_SPRITES[itemName]
                    const isHoldable = !!holdable
                    const hardMarkup = (difficulty === 'hard' || difficulty === 'infinite') ? 1.4 : 1
                    const stageMarkup = 1 + badges.length * 0.15
                    const finalPrice = Math.floor(data.price * (1 - (modifier?.shopDiscount ?? 0)) * hardMarkup * stageMarkup)
                    const bought = shopBoughtCount[itemName] ?? 0
                    const allowance = shopBuyAllowance
                    const remaining = Math.max(0, allowance - bought)
                    const soldOut = remaining <= 0
                    const totalPrice = finalPrice
                    const canBuy = !runChallenges.noPurchasing && money >= totalPrice && remaining >= 1

                    return (
                      <div
                        key={itemName}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: isHoldable ? 'rgba(168, 85, 247, 0.12)' : 'rgba(0,0,0,0.3)',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: isHoldable ? '1px solid rgba(168, 85, 247, 0.3)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {itemIcon && (
                            <img
                              src={itemIcon}
                              alt={itemName}
                              style={{ width: '28px', height: '28px', imageRendering: 'pixelated' }}
                            />
                          )}
                          <div>
                            <strong style={{ color: isHoldable ? '#cba3ff' : '#4d9bff' }}>{itemLocalizedName(itemName)}</strong>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#9b98cf' }}>{itemDesc(itemName)}</p>
                            {isHoldable && <span style={{ fontSize: '0.65rem', color: '#b8a1ff' }}>objeto pasivo</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {soldOut ? (
                            <button
                              className="tiny-btn buy-red"
                              type="button"
                              disabled
                              style={{ minWidth: '70px', cursor: 'not-allowed' }}
                            >
                              {t('shop.soldOut')}
                            </button>
                          ) : (
                            <button
                              className={`tiny-btn ${canBuy ? 'buy-green' : 'buy-red'}`}
                              type="button"
                              onClick={() => isHoldable ? buyHoldableItem(itemName) : buyShopItem(itemName, 1)}
                              disabled={!canBuy}
                              style={{
                                minWidth: '70px',
                                cursor: canBuy ? 'pointer' : 'not-allowed'
                              }}
                            >
                              ${totalPrice}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}


                </div>

                {maxShopRerolls() > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <button
                      className="cta"
                      type="button"
                      onClick={rerollShop}
                      disabled={shopRerollsUsed >= maxShopRerolls()}
                      style={{ flex: 1, background: shopRerollsUsed < maxShopRerolls() ? '#a855f7' : '#475569', color: shopRerollsUsed < maxShopRerolls() ? '#12122b' : '#d9d6f2' }}
                    >
                      🎲 Reroll tienda ({shopRerollsUsed}/{maxShopRerolls()})
                    </button>
                  </div>
                )}

                <details style={{ marginTop: '1rem', borderTop: '1px solid #3f3f6e', paddingTop: '0.75rem' }}>
                  <summary style={{ cursor: 'pointer', color: '#ff8a80', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    🏷️ Vender Objetos (50% del precio)
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {inventoryEntries.length === 0 ? (
                      <p style={{ color: '#7d7ab5', fontSize: '0.8rem' }}>No tienes objetos para vender.</p>
                    ) : (
                      inventoryEntries.map((entry) => {
                        if (entry.name === 'Mega Stone' || entry.name === 'Dynamax Band' || entry.name === 'Prisma Rojo' || entry.name === 'Prisma Azul') return null
                        const consumable = ALL_SHOP_ITEMS[entry.name]
                        const holdable = HOLDABLE_ITEMS[entry.name]
                        if (!consumable && !holdable) return null
                        const data = consumable ?? holdable!
                        const sellPrice = Math.floor(data.price * 0.5)
                        const itemIcon = ITEM_SPRITES[entry.name]
                        const qty = Math.min(sellQty[entry.name] ?? 1, entry.count)
                        const totalSell = sellPrice * qty

                        const stepperBtnStyle: CSSProperties = {
                          background: '#4a2a2a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          width: '24px',
                          height: '24px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          lineHeight: '1',
                        }

                        return (
                          <div key={entry.name}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              background: 'rgba(248, 113, 113, 0.08)', padding: '6px 10px', borderRadius: '6px',
                              border: '1px solid rgba(248, 113, 113, 0.2)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {itemIcon && <img src={itemIcon} alt={entry.name} style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }} />}
                              <span style={{ color: '#f3f1ff', fontSize: '0.85rem' }}>
                                {itemLocalizedName(entry.name)} {entry.count > 1 && <span style={{ color: '#ff8a80', fontWeight: 'bold' }}>×{entry.count}</span>}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {entry.count > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <button
                                    type="button"
                                    aria-label={`Reducir cantidad a vender de ${entry.name}`}
                                    style={stepperBtnStyle}
                                    onClick={() => setSellQty(prev => ({ ...prev, [entry.name]: Math.max(1, (prev[entry.name] ?? 1) - 1) }))}
                                  >−</button>
                                  <span style={{ minWidth: '16px', textAlign: 'center', color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Aumentar cantidad a vender de ${entry.name}`}
                                    style={{ ...stepperBtnStyle, background: '#ee3b2f' }}
                                    onClick={() => setSellQty(prev => ({ ...prev, [entry.name]: Math.min(entry.count, (prev[entry.name] ?? 1) + 1) }))}
                                  >+</button>
                                </div>
                              )}
                              <button className="tiny-btn" type="button"
                                onClick={() => sellItems(entry.name, qty)}
                                style={{ background: '#ee3b2f', minWidth: '60px', color: '#12122b', fontWeight: 'bold' }}
                              >
                                {entry.count > 1 && qty > 1 ? `${qty}× ` : ''}${totalSell}
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </details>

                <button className="cta" onClick={completeCurrentNode} type="button" style={{ width: '100%' }}>
                  {t('shop.leave')}
                </button>
              </div>
            )}

            {screen === 'blackmarket' && (
              <div className="action-block shop-block" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: '#fb923c' }}>{t('shop.blackMarket')}</h3>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#7ceb95' }}>{t('shop.money')}: ${money}</span>
                </div>
                <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Objetos a precios reducidos, vende lo que no uses y compra Pokémon acordes a tu nivel.</p>

                <h4 style={{ color: '#fb923c', margin: '0 0 0.4rem', fontSize: '0.9rem' }}>{t('shop.buyItems')}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                  {blackMarketItems.map((itemName) => {
                    const price = blackMarketItemPrice(itemName)
                    const canBuy = !runChallenges.noPurchasing && money >= price
                    return (
                      <div key={itemName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          {ITEM_SPRITES[itemName] && <img src={ITEM_SPRITES[itemName]} alt={itemName} style={{ width: '26px', height: '26px', imageRendering: 'pixelated', flexShrink: 0 }} />}
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ display: 'block', color: '#f3f1ff', fontSize: '0.85rem' }}>{itemLocalizedName(itemName)}</strong>
                            <p style={{ margin: 0, color: '#9b98cf', fontSize: '0.7rem', lineHeight: 1.3 }}>{itemDesc(itemName)}</p>
                          </div>
                        </div>
                        <button
                          className={`tiny-btn ${canBuy ? 'buy-green' : 'buy-red'}`}
                          type="button"
                          disabled={!canBuy}
                          onClick={() => blackMarketBuyItem(itemName)}
                          style={{
                            minWidth: '76px',
                            cursor: canBuy ? 'pointer' : 'not-allowed'
                          }}
                        >
                          🪙 ${price}
                        </button>
                      </div>
                    )
                  })}
                </div>

                <h4 style={{ color: '#fb923c', margin: '0 0 0.4rem', fontSize: '0.9rem' }}>{t('shop.sellItems')}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                  {inventory.length === 0 ? (
                    <p style={{ color: '#7d7ab5', fontSize: '0.8rem' }}>No tienes objetos para vender.</p>
                  ) : (
                    Array.from(new Set(inventory)).filter(i => i !== 'Mega Stone' && i !== 'Dynamax Band' && i !== 'Prisma Rojo' && i !== 'Prisma Azul').map((itemName) => {
                      const count = inventory.filter(i => i === itemName).length
                      const data = ALL_SHOP_ITEMS[itemName] ?? HOLDABLE_ITEMS[itemName]
                      const value = data ? Math.max(1, Math.floor(data.price * 0.5)) : 10
                      return (
                        <div key={itemName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                          <span style={{ color: '#f3f1ff', fontSize: '0.85rem' }}>{itemLocalizedName(itemName)} ×{count}</span>
                          <button className="tiny-btn" type="button" onClick={() => blackMarketSellItem(itemName)} style={{ color: '#37d16b' }}>Vender ${value}</button>
                        </div>
                      )
                    })
                  )}
                </div>

                <h4 style={{ color: '#fb923c', margin: '0 0 0.4rem', fontSize: '0.9rem' }}>{t('shop.buyPokemon')}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {blackMarketPokemon.length === 0 ? (
                    <p style={{ color: '#7d7ab5', fontSize: '0.8rem' }}>Cargando Pokémon...</p>
                  ) : (
                    blackMarketPokemon.map((p, idx) => {
                      const price = 100 + p.level * 15
                      const canBuy = !runChallenges.noPurchasing && money >= price
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.5)', padding: '6px 10px', borderRadius: '6px', border: '1px solid #3f3f6e' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img src={p.sprite} alt={p.name} onError={fallbackSprite} style={{ width: '32px', height: '32px', imageRendering: 'pixelated' }} />
                            <div>
                              <strong style={{ color: '#f3f1ff', fontSize: '0.85rem' }}>{p.name} <span style={{ color: '#7d7ab5' }}>Nv.{p.level}</span></strong>
                              <div style={{ fontSize: '0.7rem', color: '#9b98cf' }}>{p.types?.join(' / ')}</div>
                            </div>
                          </div>
                          <button
                            className={`tiny-btn ${canBuy ? 'buy-green' : 'buy-red'}`}
                            type="button"
                            disabled={!canBuy}
                            onClick={() => blackMarketBuyPokemon(idx)}
                            style={{
                              minWidth: '76px',
                              cursor: canBuy ? 'pointer' : 'not-allowed'
                            }}
                          >
                            🪙 ${price}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>

                <button className="cta" onClick={completeCurrentNode} type="button" style={{ width: '100%', marginTop: '1rem' }}>{t('shop.leaveMarket')}</button>
              </div>
            )}

            {screen === 'daycare' && (
              <div className="action-block shop-block" style={{ marginTop: '1rem', borderColor: 'rgba(253,230,138,0.6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: '#fde68a' }}>🥚 Guardería</h3>
                  <span style={{ fontSize: '0.8rem', color: '#9b98cf' }}>Huevo de la aventura</span>
                </div>

                {daycareLoading ? (
                  <p style={{ color: '#9b98cf', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Preparando el huevo...</p>
                ) : daycareEgg ? (
                  <div style={{ background: 'rgba(253,230,138,0.08)', border: '1px solid rgba(253,230,138,0.45)', borderRadius: '10px', padding: '1rem', marginBottom: '0.85rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                      <img src={ITEM_SPRITES['Huevo']} alt="Huevo" style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }} />
                    </div>
                    <p style={{ color: '#f3f1ff', fontSize: '0.9rem', textAlign: 'center', margin: '0 0 0.5rem', fontWeight: 'bold' }}>
                      Huevo misterioso
                    </p>
                    <p style={{ color: '#fde68a', fontSize: '0.85rem', textAlign: 'center', margin: '0 0 0.5rem', fontWeight: 'bold' }}>
                      🥚 Eclosiona en {daycareEgg.nodesLeft} nodo{daycareEgg.nodesLeft === 1 ? '' : 's'}
                    </p>
                    <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(0,0,0,0.35)', overflow: 'hidden', marginBottom: '0.65rem' }}>
                      <div style={{ height: '100%', width: `${Math.round(((daycareEgg.totalNodes - daycareEgg.nodesLeft) / daycareEgg.totalNodes) * 100)}%`, background: '#fde68a' }} />
                    </div>
                    <p style={{ color: '#d9d6f2', fontSize: '0.76rem', margin: '0 0 0.2rem' }}>
                      Ocupa <strong style={{ color: '#fde68a' }}>1 hueco del equipo</strong> mientras lo llevas.
                    </p>
                    <p style={{ color: '#9b98cf', fontSize: '0.72rem', margin: '0.6rem 0 0' }}>
                      El Pokémon será aleatorio, siempre de primera etapa evolutiva y nivel 10, con sus propios IVs y habilidad.
                    </p>
                  </div>
                ) : team.length >= maxTeamSize ? (
                  <p style={{ color: '#fca5a5', fontSize: '0.82rem', margin: '0 0 0.85rem' }}>
                    No tienes ningún hueco libre en el equipo ({team.length}/{maxTeamSize}). Libera o envía un Pokémon al PC para poder llevar el huevo.
                  </p>
                ) : (
                  <p style={{ color: '#9b98cf', fontSize: '0.82rem', margin: '0 0 0.85rem' }}>
                    No hay ningún huevo activo. Vuelve a visitar la Guardería para recibir uno.
                  </p>
                )}

                {!daycareLoading && !daycareEgg && team.length < maxTeamSize && (
                  <button
                    type="button"
                    onClick={() => void prepareDaycareEgg()}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fde68a', background: 'rgba(253,230,138,0.18)', color: '#fef3c7', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '0.55rem' }}
                  >
                    🥚 Recibir huevo
                  </button>
                )}
                <button
                  type="button"
                  onClick={completeCurrentNode}
                  disabled={daycareLoading}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #64748b', background: 'transparent', color: '#cbd5e1', fontWeight: 'bold', fontSize: '0.82rem', cursor: daycareLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >
                  🚪 Marcharse
                </button>
              </div>
            )}

            {screen === 'mine' && (() => {
              const unlockedTreasures = TREASURE_DROPS.filter(isConsumableUnlocked)
              return (
                <div className="action-block shop-block" style={{ marginTop: '1rem', borderColor: 'rgba(192,132,87,0.6)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: '#c08457' }}>⛏️ Mina</h3>
                    <span style={{ fontSize: '0.8rem', color: '#9b98cf' }}>{miningDigs}/3 excavaciones</span>
                  </div>
                  <p style={{ color: '#9b98cf', fontSize: '0.82rem', lineHeight: 1.45, marginBottom: '0.6rem' }}>
                    Excava para encontrar tesoros que hayas desbloqueado en la Tienda Meta. Tienes 3 excavaciones por visita.
                  </p>
                  <p style={{ color: '#a8a5cf', fontSize: '0.76rem', margin: '0 0 0.8rem' }}>
                    Tesoros disponibles: <strong style={{ color: '#fbbf24' }}>{unlockedTreasures.length}</strong>
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '0.8rem' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ fontSize: '1.1rem', opacity: i < miningDigs ? 0.35 : 1, filter: i < miningDigs ? 'grayscale(1)' : 'none' }}>⛏️</span>
                    ))}
                  </div>

                  <p style={{ color: miningMessage.startsWith('¡') ? '#fde68a' : '#9b98cf', fontSize: '0.82rem', textAlign: 'center', margin: '0 0 0.8rem', minHeight: '1.2rem' }}>
                    {miningMessage || (unlockedTreasures.length === 0
                      ? 'No tienes tesoros desbloqueados. Marcharte es la única opción.'
                      : 'Pulsa Excavar para buscar un tesoro.')}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    <button
                      type="button"
                      onClick={digMine}
                      disabled={miningBusy || miningDigs >= 3 || unlockedTreasures.length === 0}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #c08457', background: miningBusy || miningDigs >= 3 || unlockedTreasures.length === 0 ? 'rgba(71,85,105,0.18)' : 'rgba(192,132,87,0.20)', color: miningBusy || miningDigs >= 3 || unlockedTreasures.length === 0 ? '#7d7ab5' : '#f5d6b3', fontWeight: 'bold', fontSize: '0.88rem', cursor: miningBusy || miningDigs >= 3 || unlockedTreasures.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                    >
                      {miningBusy ? '⛏️ Excavando...' : miningDigs >= 3 ? 'Sin excavaciones restantes' : '⛏️ Excavar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { clearMiningTimers(); completeCurrentNode() }}
                      disabled={miningBusy}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #64748b', background: 'transparent', color: '#cbd5e1', fontWeight: 'bold', fontSize: '0.82rem', cursor: miningBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                    >
                      🚪 Marcharse
                    </button>
                  </div>

                  {miningReveal && createPortal(
                    <div className="modal-backdrop" onClick={() => { clearMiningTimers(); setMiningReveal(null) }}>
                      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '340px', textAlign: 'center', padding: '1.5rem' }}>
                        <h3 style={{ color: '#fbbf24', margin: '0 0 0.5rem' }}>⛏️ ¡Tesoro encontrado!</h3>
                        <img src={ITEM_SPRITES[miningReveal]} alt={miningReveal} style={{ width: '72px', height: '72px', imageRendering: 'pixelated' }} />
                        <h4 style={{ color: '#f3f1ff', margin: '0.5rem 0 0.25rem' }}>{itemLocalizedName(miningReveal)}</h4>
                        <p style={{ color: '#9b98cf', fontSize: '0.78rem', margin: 0 }}>Se ha añadido a tu inventario.</p>
                      </div>
                    </div>,
                    document.body,
                  )}
                </div>
              )
            })()}

            {screen === 'fishing' && (
              <div className="action-block shop-block" style={{ marginTop: '1rem', borderColor: 'rgba(56,189,248,0.55)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: '#38bdf8' }}>🎣 Pesca</h3>
                  <span style={{ fontSize: '0.8rem', color: '#9b98cf' }}>{fishingAttempts}/3 intentos</span>
                </div>
                <p style={{ color: '#9b98cf', fontSize: '0.82rem', lineHeight: 1.45, marginBottom: '0.8rem' }}>
                  Lanza la caña y recógela justo cuando pique para atrapar un Pokémon de tipo Agua. Tienes 3 intentos y un 5% de probabilidad de que sea shiny.
                </p>

                <div style={{ position: 'relative', height: '110px', borderRadius: '10px', marginBottom: '0.8rem', overflow: 'hidden', background: 'linear-gradient(180deg, #0c4a6e 0%, #075985 55%, #164e63 100%)', border: '1px solid rgba(56,189,248,0.45)' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '55%', height: '2px', background: 'rgba(186,230,253,0.25)' }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', background: 'rgba(2,132,199,0.25)' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem' }}>
                    {fishingPhase === 'waiting' ? '〰️' : fishingPhase === 'bite' ? '💦' : fishingPhase === 'caught' ? '🐟' : fishingPhase === 'missed' ? '🌊' : '🎣'}
                  </div>
                  {fishingPhase === 'bite' && (
                    <div style={{ position: 'absolute', left: '50%', bottom: '10px', transform: 'translateX(-50%)', color: '#fef08a', fontWeight: 'bold', fontSize: '0.8rem', textShadow: '0 1px 3px #000' }}>¡PICA!</div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '0.75rem' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: i < fishingAttempts ? '#38bdf8' : 'rgba(148,163,184,0.35)' }} />
                  ))}
                </div>

                <p style={{ color: fishingPhase === 'bite' ? '#fef08a' : fishingPhase === 'caught' ? '#86efac' : fishingPhase === 'missed' ? '#fca5a5' : '#9b98cf', fontSize: '0.82rem', textAlign: 'center', margin: '0 0 0.8rem', minHeight: '1.2rem' }}>
                  {fishingLoading ? 'Preparando el agua...' : fishingMessage || (fishingAttempts >= 3 ? 'No queda ningún intento. Puedes marcharte.' : 'Pulsa Lanzar caña para empezar.')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {fishingPhase === 'bite' ? (
                    <button
                      type="button"
                      onClick={reelFishingLine}
                      disabled={fishingBusy}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #fef08a', background: 'rgba(254,240,138,0.22)', color: '#fef9c3', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      🎣 ¡Tirar de la caña!
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={castFishingLine}
                      disabled={fishingPhase === 'waiting' || fishingLoading || fishingAttempts >= 3 || !fishingEncounter || fishingBusy}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #38bdf8', background: fishingPhase === 'waiting' || fishingLoading || fishingAttempts >= 3 || !fishingEncounter ? 'rgba(71,85,105,0.18)' : 'rgba(56,189,248,0.18)', color: fishingPhase === 'waiting' || fishingLoading || fishingAttempts >= 3 || !fishingEncounter ? '#7d7ab5' : '#bae6fd', fontWeight: 'bold', fontSize: '0.85rem', cursor: fishingPhase === 'waiting' || fishingLoading || fishingAttempts >= 3 || !fishingEncounter ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                    >
                      {fishingPhase === 'waiting' ? '⏳ Esperando a que pique...' : '🎣 Lanzar caña'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { clearFishingTimers(); completeCurrentNode() }}
                    disabled={fishingBusy}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #64748b', background: 'transparent', color: '#cbd5e1', fontWeight: 'bold', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    🚪 Marcharse
                  </button>
                </div>
              </div>
            )}

            {screen === 'fossil' && (
              <div className="action-block shop-block" style={{ marginTop: '1rem', borderColor: 'rgba(214,166,106,0.55)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: '#d6a66a' }}>🦖 Laboratorio de Fósiles</h3>
                  <span style={{ fontSize: '0.8rem', color: '#9b98cf' }}>2 fósiles disponibles</span>
                </div>
                <p style={{ color: '#9b98cf', fontSize: '0.82rem', lineHeight: 1.45, marginBottom: '0.9rem' }}>
                  Elige uno de los dos fósiles para revivir un Pokémon especial adaptado al nivel de tu aventura. El fósil se consumirá al revivir.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  {fossilChoices.map(fossil => (
                    <button
                      key={fossil.item}
                      type="button"
                      onClick={() => void reviveFossil(fossil)}
                      disabled={fossilBusy}
                      style={{ padding: '1rem 0.75rem', borderRadius: '10px', border: '1px solid #d6a66a', background: 'rgba(214,166,106,0.10)', cursor: fossilBusy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: fossilBusy ? 0.6 : 1 }}
                    >
                      <img src={ITEM_SPRITES[fossil.item]} alt={fossil.item} style={{ width: '64px', height: '64px', imageRendering: 'pixelated' }} />
                      <div style={{ color: '#f3e3c8', fontWeight: 'bold', fontSize: '0.85rem', marginTop: '0.4rem' }}>{itemLocalizedName(fossil.item)}</div>
                      <div style={{ color: '#9b98cf', fontSize: '0.7rem' }}>Revivir Pokémon</div>
                    </button>
                  ))}
                </div>
                {fossilBusy && <p style={{ color: '#d6a66a', fontSize: '0.8rem', textAlign: 'center', marginBottom: '0.75rem' }}>Reviviendo el fósil...</p>}
                <button className="cta" type="button" disabled={fossilBusy} onClick={completeCurrentNode} style={{ width: '100%' }}>Marcharse</button>
              </div>
            )}

            {screen === 'orchard' && (() => {
              const berries = orchardAvailableBerries()
              const plantedCounts = new Map<string, number>()
              for (const berry of orchardPlanted) plantedCounts.set(berry, (plantedCounts.get(berry) ?? 0) + 1)
              const selectedCounts = new Map<string, number>()
              for (const berry of orchardSelected) selectedCounts.set(berry, (selectedCounts.get(berry) ?? 0) + 1)
              const sameOrchard = orchardPlantedNodeId !== null && currentNode?.id === orchardPlantedNodeId
              return (
                <div className="action-block shop-block" style={{ marginTop: '1rem', borderColor: 'rgba(163,230,53,0.55)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: '#a3e635' }}>🫐 Huerto de Bayas</h3>
                    <span style={{ fontSize: '0.8rem', color: '#9b98cf' }}>Solo en Difícil e Infinite</span>
                  </div>
                  <p style={{ color: '#9b98cf', fontSize: '0.82rem', lineHeight: 1.45, marginBottom: '0.8rem' }}>
                    Planta hasta 3 bayas. Si las recoges en este mismo Huerto recuperarás exactamente las que plantaste; si esperas a otro Huerto, recibirás las plantadas más bayas extra hasta un máximo de 3.
                  </p>

                  {orchardPlanted.length > 0 ? (
                    <div style={{ background: 'rgba(163,230,53,0.10)', border: '1px solid rgba(163,230,53,0.45)', borderRadius: '8px', padding: '0.65rem', marginBottom: '0.8rem' }}>
                      <div style={{ color: '#d9f99d', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.35rem' }}>🌱 Bayas plantadas ({orchardPlanted.length}/3)</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {Array.from(plantedCounts.entries()).map(([name, count]) => (
                          <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.25)', border: '1px solid #3f3f6e', borderRadius: '6px', padding: '3px 6px', color: '#f3f1ff', fontSize: '0.72rem' }}>
                            {ITEM_SPRITES[name] && <img src={ITEM_SPRITES[name]} alt={name} style={{ width: '20px', height: '20px', imageRendering: 'pixelated' }} />}
                            {itemLocalizedName(name)} ×{count}
                          </span>
                        ))}
                      </div>
                      <p style={{ color: sameOrchard ? '#fca5a5' : '#bef264', fontSize: '0.72rem', margin: '0.55rem 0 0' }}>
                        {sameOrchard
                          ? 'Estás en el mismo Huerto: al recoger recuperarás exactamente estas bayas, sin extras.'
                          : 'Has avanzado de Huerto: al recoger recibirás estas bayas más extras hasta 3.'}
                      </p>
                    </div>
                  ) : (
                    <p style={{ color: '#7d7ab5', fontSize: '0.78rem', margin: '0 0 0.8rem' }}>No hay bayas plantadas todavía.</p>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    <button
                      type="button"
                      onClick={harvestOrchard}
                      disabled={orchardPlanted.length === 0}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${orchardPlanted.length > 0 ? '#a3e635' : '#475569'}`, background: orchardPlanted.length > 0 ? 'rgba(163,230,53,0.18)' : 'rgba(71,85,105,0.18)', color: orchardPlanted.length > 0 ? '#d9f99d' : '#7d7ab5', fontWeight: 'bold', fontSize: '0.85rem', cursor: orchardPlanted.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
                    >
                      🧺 Recoger {orchardPlanted.length > 0 ? `(${orchardPlanted.length} plantadas)` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOrchardSelected([]); setOrchardPlantModal(true) }}
                      disabled={orchardPlanted.length > 0 || berries.length === 0}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${orchardPlanted.length === 0 && berries.length > 0 ? '#84cc16' : '#475569'}`, background: orchardPlanted.length === 0 && berries.length > 0 ? 'rgba(132,204,22,0.18)' : 'rgba(71,85,105,0.18)', color: orchardPlanted.length === 0 && berries.length > 0 ? '#bef264' : '#7d7ab5', fontWeight: 'bold', fontSize: '0.85rem', cursor: orchardPlanted.length === 0 && berries.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
                    >
                      🌱 Cosechar
                    </button>
                    {berries.length === 0 && orchardPlanted.length === 0 && (
                      <p style={{ color: '#7d7ab5', fontSize: '0.76rem', margin: 0, textAlign: 'center' }}>No tienes bayas para plantar.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => { setOrchardPlantModal(false); setOrchardSelected([]); setOrchardHarvest(null); completeCurrentNode() }}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #64748b', background: 'transparent', color: '#cbd5e1', fontWeight: 'bold', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      🚪 Marcharse
                    </button>
                  </div>

                  {orchardPlantModal && createPortal(
                    <div className="modal-backdrop" onClick={() => setOrchardPlantModal(false)}>
                      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', maxHeight: '80vh', overflow: 'auto', padding: '1.25rem' }}>
                        <h3 style={{ color: '#a3e635', margin: '0 0 0.4rem' }}>🌱 Selecciona hasta 3 bayas</h3>
                        <p style={{ color: '#9b98cf', fontSize: '0.78rem', margin: '0 0 0.75rem' }}>Seleccionadas: {orchardSelected.length}/3</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '0.9rem' }}>
                          {berries.map(name => {
                            const owned = inventory.filter(item => item === name).length
                            const chosen = selectedCounts.get(name) ?? 0
                            return (
                              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid #3f3f6e', borderRadius: '6px', padding: '5px 8px' }}>
                                {ITEM_SPRITES[name] && <img src={ITEM_SPRITES[name]} alt={name} style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }} />}
                                <span style={{ flex: 1, color: '#f3f1ff', fontSize: '0.78rem' }}>{itemLocalizedName(name)} <span style={{ color: '#7d7ab5' }}>({owned})</span></span>
                                <button type="button" onClick={() => removeOrchardBerry(name)} disabled={chosen === 0} style={{ width: '24px', height: '24px', borderRadius: '5px', border: '1px solid #64748b', background: 'transparent', color: chosen > 0 ? '#f3f1ff' : '#475569', cursor: chosen > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>−</button>
                                <span style={{ minWidth: '16px', textAlign: 'center', color: '#d9f99d', fontWeight: 'bold', fontSize: '0.8rem' }}>{chosen}</span>
                                <button type="button" onClick={() => addOrchardBerry(name)} disabled={chosen >= owned || orchardSelected.length >= 3} style={{ width: '24px', height: '24px', borderRadius: '5px', border: '1px solid #64748b', background: 'transparent', color: chosen < owned && orchardSelected.length < 3 ? '#f3f1ff' : '#475569', cursor: chosen < owned && orchardSelected.length < 3 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>+</button>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button type="button" onClick={plantOrchardBerries} disabled={orchardSelected.length === 0} style={{ flex: 1, padding: '8px 10px', borderRadius: '7px', border: '1px solid #84cc16', background: orchardSelected.length > 0 ? '#84cc16' : 'rgba(71,85,105,0.3)', color: orchardSelected.length > 0 ? '#1a2e05' : '#7d7ab5', fontWeight: 'bold', cursor: orchardSelected.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                            Plantar ({orchardSelected.length})
                          </button>
                          <button type="button" onClick={() => setOrchardPlantModal(false)} style={{ padding: '8px 12px', borderRadius: '7px', border: '1px solid #64748b', background: 'transparent', color: '#cbd5e1', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )}

                  {orchardHarvest && createPortal(
                    <div className="modal-backdrop" onClick={() => setOrchardHarvest(null)}>
                      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center', padding: '1.5rem' }}>
                        <h3 style={{ color: '#a3e635', margin: '0 0 0.4rem' }}>🧺 ¡Cosecha recogida!</h3>
                        <p style={{ color: '#d9d6f2', fontSize: '0.82rem', marginBottom: '0.8rem' }}>Has recibido estas bayas:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '1rem', textAlign: 'left' }}>
                          {orchardHarvest.map(({ name, count }) => (
                            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid #3f3f6e', borderRadius: '6px', padding: '6px 8px' }}>
                              {ITEM_SPRITES[name] && <img src={ITEM_SPRITES[name]} alt={name} style={{ width: '28px', height: '28px', imageRendering: 'pixelated' }} />}
                              <span style={{ color: '#f3f1ff', fontSize: '0.82rem' }}>{itemLocalizedName(name)} <strong style={{ color: '#d9f99d' }}>×{count}</strong></span>
                            </div>
                          ))}
                        </div>
                        <button type="button" className="cta" onClick={() => setOrchardHarvest(null)} style={{ width: '100%' }}>Cerrar</button>
                      </div>
                    </div>,
                    document.body,
                  )}
                </div>
              )
            })()}

            {screen === 'safari' && (() => {
              const balls = safariAvailableBalls()
              const profile = safariSelected ? safariNatureProfile(safariSelected) : null
              const chance = safariSelectedBall ? safariCaptureChance(safariSelectedBall) : 0
              const moodColor = safariMood >= 60 ? '#37d16b' : safariMood >= 30 ? '#facc15' : '#ef4444'
              return (
                <div className="action-block shop-block" style={{ marginTop: '1rem', borderColor: 'rgba(34,197,94,0.55)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: '#22c55e' }}>🦁 Safari</h3>
                    <span style={{ fontSize: '0.85rem', color: '#9b98cf' }}>Solo Poké Balls · sin ataques</span>
                  </div>

                  {safariLoading ? (
                    <p style={{ color: '#9b98cf', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Preparando las siluetas del Safari...</p>
                  ) : !safariSelected ? (
                    <>
                      <p style={{ color: '#9b98cf', fontSize: '0.82rem', lineHeight: 1.45, marginBottom: '0.9rem' }}>
                        Elige una de las tres siluetas. El Pokémon aparecerá adaptado al nivel de tu aventura. Después podrás acariciarlo para mejorar su humor y su captura, pero ten cuidado: si te pasas o se siente amenazado, puede reaccionar mal.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                        {safariChoices.map((p, index) => (
                          <button
                            key={`${p.id}-${index}`}
                            type="button"
                            onClick={() => selectSafariPokemon(p)}
                            style={{ padding: '1rem 0.75rem', borderRadius: '10px', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.08)', cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            <img src={p.sprite} alt="Silueta" onError={fallbackSprite} style={{ width: '72px', height: '72px', imageRendering: 'pixelated', filter: 'brightness(0) saturate(100%)', opacity: 0.85 }} />
                            <div style={{ color: '#86efac', fontWeight: 'bold', fontSize: '0.85rem', marginTop: '0.4rem' }}>Silueta {index + 1}</div>
                            <div style={{ color: '#7d7ab5', fontSize: '0.7rem' }}>Haz clic para revelar</div>
                          </button>
                        ))}
                      </div>
                      {safariChoices.length === 0 && <p style={{ color: '#ff8a80', fontSize: '0.82rem' }}>No se encontraron Pokémon para el Safari.</p>}
                      <button className="cta" type="button" onClick={() => { setSafariSelected(null); setSafariChoices([]); completeCurrentNode() }} style={{ width: '100%' }}>Salir del Safari</button>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                        <img src={safariSelected.sprite} alt={safariSelected.name} onError={fallbackSprite} style={{ width: '92px', height: '92px', imageRendering: 'pixelated' }} />
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ display: 'block', color: '#f3f1ff', fontSize: '1.1rem', textTransform: 'capitalize' }}>{safariSelected.name} {safariSelected.shiny ? '✨' : ''}</strong>
                          <span style={{ color: '#9b98cf', fontSize: '0.78rem' }}>Nv. {safariSelected.level} · Naturaleza: {natureName(safariSelected.nature, language)} ({profile?.label})</span>
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {safariSelected.types?.map(type => (
                              <span key={type} style={{ background: TYPE_COLORS[type] ?? '#475569', color: '#fff', fontSize: '0.6rem', padding: '1px 6px', borderRadius: '4px', textTransform: 'capitalize' }}>{type}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9b98cf', fontSize: '0.72rem', marginBottom: '2px' }}>
                            <span>Humor {safariMoodEmoji(safariMood)}</span><span>{safariMood}%</span>
                          </div>
                          <div style={{ height: '9px', background: '#0f172a', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ width: `${safariMood}%`, height: '100%', background: moodColor, transition: 'width 0.25s ease' }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9b98cf', fontSize: '0.72rem', marginBottom: '2px' }}>
                            <span>Tensión</span><span>{safariThreat}%</span>
                          </div>
                          <div style={{ height: '9px', background: '#0f172a', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ width: `${safariThreat}%`, height: '100%', background: safariThreat >= 60 ? '#ef4444' : '#fb923c', transition: 'width 0.25s ease' }} />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', color: '#cbd5e1', fontSize: '0.78rem', marginBottom: '0.7rem' }}>
                        <span>Caricias: <strong style={{ color: '#86efac' }}>{safariPetCount}</strong> / tolerancia {profile?.tolerance}</span>
                        <span>Bonus captura: <strong style={{ color: '#7dd3fc' }}>+{safariBonus}%</strong></span>
                        <span>Posibilidad: <strong style={{ color: '#fde047' }}>{Math.round(chance * 100)}%</strong></span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.8rem' }}>
                        <button
                          type="button"
                          onClick={petSafariPokemon}
                          style={{ padding: '8px 12px', borderRadius: '7px', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.16)', color: '#86efac', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          🤚 Acariciar
                        </button>
                        <select
                          value={safariSelectedBall}
                          onChange={(e) => setSafariSelectedBall(e.target.value)}
                          disabled={balls.length === 0}
                          style={{ padding: '8px 10px', borderRadius: '7px', border: '1px solid #3f3f6e', background: '#0f172a', color: '#f3f1ff', fontSize: '0.8rem', fontFamily: 'inherit' }}
                        >
                          {balls.length === 0 ? <option value="">Sin Poké Balls</option> : balls.map(ball => {
                            const count = inventory.filter(item => item === ball).length
                            return <option key={ball} value={ball}>{itemLocalizedName(ball)} ×{count} · {Math.round(safariCaptureChance(ball) * 100)}%</option>
                          })}
                        </select>
                        <button
                          type="button"
                          onClick={throwSafariBall}
                          disabled={balls.length === 0}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '7px',
                            border: `1px solid ${balls.length > 0 ? '#10b981' : '#dc2626'}`,
                            background: balls.length > 0 ? '#10b981' : 'rgba(239,68,68,0.16)',
                            color: balls.length > 0 ? '#052e16' : '#ff8a80',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: balls.length > 0 ? 'pointer' : 'not-allowed',
                            fontFamily: 'inherit',
                          }}
                        >
                          Lanzar {safariSelectedBall ? itemLocalizedName(safariSelectedBall) : 'Poké Ball'}
                        </button>
                      </div>

                      {safariLog.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '0.8rem' }}>
                          {safariLog.map((line, index) => (
                            <div key={`${line}-${index}`} style={{ fontSize: '0.72rem', color: index === 0 ? '#f3f1ff' : '#9b98cf', background: 'rgba(0,0,0,0.22)', padding: '4px 7px', borderRadius: '5px' }}>{line}</div>
                          ))}
                        </div>
                      )}

                      <button className="cta" type="button" onClick={() => { setSafariSelected(null); setSafariChoices([]); completeCurrentNode() }} style={{ width: '100%' }}>Salir del Safari</button>
                    </>
                  )}
                </div>
              )
            })()}

            {screen === 'weather' && (
              <div className="action-block shop-block" style={{ marginTop: '1rem', borderColor: 'rgba(96,165,250,0.55)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: '#60a5fa' }}>🌦️ Estación Meteorológica</h3>
                  <span style={{ fontSize: '0.8rem', color: '#9b98cf' }}>Próximos 2 combates</span>
                </div>
                <p style={{ color: '#9b98cf', fontSize: '0.82rem', lineHeight: 1.45, marginBottom: '0.8rem' }}>
                  Elige el clima que estará activo durante los próximos 2 combates. Se aplicará al empezar cada batalla.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '0.8rem' }}>
                  {(['rain', 'sun', 'sand', 'hail'] as const).map(option => {
                    const selected = weatherStation?.weather === option
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => chooseWeatherStation(option)}
                        style={{ padding: '0.75rem', borderRadius: '9px', border: `1px solid ${selected ? '#60a5fa' : '#3f3f6e'}`, background: selected ? 'rgba(96,165,250,0.20)' : 'rgba(0,0,0,0.25)', color: '#f3f1ff', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <div style={{ fontSize: '1.5rem', lineHeight: 1 }}>{WEATHER_INFO[option].icon}</div>
                        <strong style={{ display: 'block', margin: '0.35rem 0 0.2rem', fontSize: '0.82rem', color: selected ? '#bfdbfe' : '#f3f1ff' }}>{weatherName(option, language)}</strong>
                        <span style={{ display: 'block', color: '#9b98cf', fontSize: '0.68rem', lineHeight: 1.3 }}>{weatherDescription(option, language)}</span>
                      </button>
                    )
                  })}
                </div>
                <p style={{ color: weatherStation ? '#bfdbfe' : '#9b98cf', fontSize: '0.8rem', textAlign: 'center', margin: '0 0 0.8rem' }}>
                  {weatherStation
                    ? `${WEATHER_INFO[weatherStation.weather].icon} ${weatherName(weatherStation.weather, language)} · ${weatherStation.battlesLeft} combate${weatherStation.battlesLeft === 1 ? '' : 's'} restante${weatherStation.battlesLeft === 1 ? '' : 's'}`
                    : 'Todavía no has elegido ningún clima.'}
                </p>
                <button className="cta" type="button" onClick={completeCurrentNode} style={{ width: '100%' }}>Marcharse</button>
              </div>
            )}

            {screen === 'ranch' && (() => {
              const canModifyTeam = !runChallenges.soloStarter && !runChallenges.fixedTeam
              const renderRow = (p: Pokemon, kind: 'team' | 'pc', index: number) => {
                const count = ranchRewardCount(p)
                const canSell = canModifyTeam && !(kind === 'team' && team.length <= 1)
                return (
                  <div key={`${kind}-${index}-${p.name}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.3)', padding: '7px 10px', borderRadius: '6px', border: '1px solid rgba(163,230,53,0.22)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <img src={p.sprite} alt={p.name} onError={fallbackSprite} style={{ width: '34px', height: '34px', imageRendering: 'pixelated', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', color: '#f3f1ff', fontSize: '0.85rem', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{p.shiny ? ' ✨' : ''} <span style={{ color: '#9b98cf', fontWeight: 'normal' }}>Nv.{p.level}</span></strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {p.types?.map(type => (
                            <span key={type} style={{ background: TYPE_COLORS[type] ?? '#475569', color: '#fff', fontSize: '0.58rem', padding: '1px 5px', borderRadius: '3px', textTransform: 'capitalize' }}>{type}</span>
                          ))}
                          <span style={{ color: '#bef264', fontSize: '0.62rem' }}>🧺 {count} objeto{count === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canSell}
                      onClick={() => { if (!canSell) { playError(); return } setRanchConfirm({ kind, index, name: p.name }) }}
                      title={!canModifyTeam ? t('b.noModifyTeam') : kind === 'team' && team.length <= 1 ? t('b.speculatorLastTeam') : undefined}
                      style={{ minWidth: '104px', padding: '6px 9px', borderRadius: '6px', border: `1px solid ${canSell ? '#a3e635' : '#dc2626'}`, background: canSell ? 'rgba(163,230,53,0.18)' : 'rgba(239,68,68,0.18)', color: canSell ? '#d9f99d' : '#ff8a80', fontWeight: 'bold', fontSize: '0.72rem', cursor: canSell ? 'pointer' : 'not-allowed', fontFamily: 'inherit', flexShrink: 0 }}
                    >
                      Intercambiar
                    </button>
                  </div>
                )
              }
              return (
                <div className="action-block shop-block" style={{ marginTop: '1rem', borderColor: 'rgba(163,230,53,0.55)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: '#a3e635' }}>🐑 Rancho Pokémon</h3>
                    <span style={{ fontSize: '0.8rem', color: '#9b98cf' }}>Solo en Difícil e Infinite</span>
                  </div>
                  <p style={{ color: '#9b98cf', fontSize: '0.8rem', lineHeight: 1.45, marginBottom: '0.75rem' }}>
                    Intercambia Pokémon por <strong style={{ color: '#bef264' }}>objetos y materiales</strong> según su especie, tipo y nivel. No recibirás dinero directamente.
                  </p>

                  {ranchConfirm && (
                    <div style={{ background: 'rgba(163,230,53,0.12)', border: '1px solid #a3e635', borderRadius: '8px', padding: '0.7rem', marginBottom: '0.9rem' }}>
                      <strong style={{ display: 'block', color: '#d9f99d', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                        ¿Intercambiar a {ranchConfirm.name}?
                      </strong>
                      <p style={{ margin: '0 0 0.55rem', color: '#d9d6f2', fontSize: '0.78rem' }}>
                        Recibirás objetos y materiales. Esta acción no se puede deshacer.
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => sellRanchPokemon(ranchConfirm.kind, ranchConfirm.index)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #a3e635', background: '#a3e635', color: '#1a2e05', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                          Confirmar intercambio
                        </button>
                        <button type="button" onClick={() => setRanchConfirm(null)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #64748b', background: 'transparent', color: '#cbd5e1', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <h4 style={{ color: '#a3e635', margin: '0 0 0.4rem', fontSize: '0.9rem' }}>Equipo ({team.length})</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                    {team.length === 0 ? (
                      <p style={{ color: '#7d7ab5', fontSize: '0.8rem', margin: 0 }}>No tienes Pokémon en el equipo.</p>
                    ) : team.map((p, index) => renderRow(p, 'team', index))}
                  </div>

                  <h4 style={{ color: '#a3e635', margin: '0 0 0.4rem', fontSize: '0.9rem' }}>PC ({pcStorage.length})</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                    {pcStorage.length === 0 ? (
                      <p style={{ color: '#7d7ab5', fontSize: '0.8rem', margin: 0 }}>No tienes Pokémon en el PC.</p>
                    ) : pcStorage.map((p, index) => renderRow(p, 'pc', index))}
                  </div>

                  <button className="cta" type="button" onClick={completeCurrentNode} style={{ width: '100%' }}>Marcharse</button>

                  {ranchResult && createPortal(
                    <div className="modal-backdrop" onClick={() => setRanchResult(null)}>
                      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px', textAlign: 'center', padding: '1.5rem' }}>
                        <h3 style={{ color: '#a3e635', margin: '0 0 0.5rem' }}>🐑 ¡Intercambio completado!</h3>
                        <p style={{ color: '#d9d6f2', fontSize: '0.8rem', marginBottom: '0.8rem' }}>Has recibido estos objetos:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '1rem', textAlign: 'left' }}>
                          {ranchResult.map(({ name, count }) => (
                            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid #3f3f6e', borderRadius: '6px', padding: '6px 8px' }}>
                              {ITEM_SPRITES[name] && <img src={ITEM_SPRITES[name]} alt={name} style={{ width: '28px', height: '28px', imageRendering: 'pixelated' }} />}
                              <span style={{ color: '#f3f1ff', fontSize: '0.82rem' }}>{itemLocalizedName(name)} <strong style={{ color: '#d9f99d' }}>×{count}</strong></span>
                            </div>
                          ))}
                        </div>
                        <button className="cta" type="button" onClick={() => setRanchResult(null)} style={{ width: '100%' }}>Cerrar</button>
                      </div>
                    </div>,
                    document.body,
                  )}
                </div>
              )
            })()}

            {screen === 'speculator' && (() => {
              const canModifyTeam = !runChallenges.soloStarter && !runChallenges.fixedTeam
              const renderRow = (p: Pokemon, kind: 'team' | 'pc', index: number) => {
                const price = speculatorPrice(p)
                const typeMult = speculatorTypeMultiplier(p)
                const canSell = canModifyTeam && !(kind === 'team' && team.length <= 1)
                return (
                  <div key={`${kind}-${index}-${p.name}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.3)', padding: '7px 10px', borderRadius: '6px', border: '1px solid rgba(255,138,51,0.22)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <img src={p.sprite} alt={p.name} onError={fallbackSprite} style={{ width: '34px', height: '34px', imageRendering: 'pixelated', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', color: '#f3f1ff', fontSize: '0.85rem', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{p.shiny ? ' ✨' : ''} <span style={{ color: '#9b98cf', fontWeight: 'normal' }}>Nv.{p.level}</span></strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {p.types?.map(type => (
                            <span key={type} style={{ background: TYPE_COLORS[type] ?? '#475569', color: '#fff', fontSize: '0.58rem', padding: '1px 5px', borderRadius: '3px', textTransform: 'capitalize' }}>{type}</span>
                          ))}
                          <span style={{ color: '#ffb37a', fontSize: '0.62rem' }}>Tipo ×{typeMult.toFixed(2)}{p.shiny ? ' · ✨ ×2' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canSell}
                      onClick={() => { if (!canSell) { playError(); return } setSpeculatorConfirm({ kind, index, name: p.name, price }) }}
                      title={!canModifyTeam ? t('b.noModifyTeam') : kind === 'team' && team.length <= 1 ? t('b.speculatorLastTeam') : undefined}
                      style={{
                        minWidth: '104px',
                        padding: '6px 9px',
                        borderRadius: '6px',
                        border: `1px solid ${canSell ? '#10b981' : '#dc2626'}`,
                        background: canSell ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                        color: canSell ? '#7ceb95' : '#ff8a80',
                        fontWeight: 'bold',
                        fontSize: '0.72rem',
                        cursor: canSell ? 'pointer' : 'not-allowed',
                        fontFamily: 'inherit',
                        flexShrink: 0,
                      }}
                    >
                      Vender ${price}
                    </button>
                  </div>
                )
              }
              return (
                <div className="action-block shop-block" style={{ marginTop: '1rem', borderColor: 'rgba(255,138,51,0.55)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: '#ff8a33' }}>🙊 Especulador</h3>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#7ceb95' }}>{t('shop.money')}: ${money}</span>
                  </div>
                  <p style={{ color: '#9b98cf', fontSize: '0.8rem', lineHeight: 1.45, marginBottom: '0.75rem' }}>
                    Vende Pokémon de tu equipo o del PC por dinero de la partida. El precio depende del <strong style={{ color: '#ffb37a' }}>tipo</strong>, nivel y rareza: los tipos más poderosos pagan más. Los shinys valen el doble.
                  </p>

                  {speculatorConfirm && (
                    <div style={{ background: 'rgba(255,138,51,0.12)', border: '1px solid #ff8a33', borderRadius: '8px', padding: '0.7rem', marginBottom: '0.9rem' }}>
                      <strong style={{ display: 'block', color: '#ffb37a', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                        ¿Vender a {speculatorConfirm.name}?
                      </strong>
                      <p style={{ margin: '0 0 0.55rem', color: '#d9d6f2', fontSize: '0.78rem' }}>
                        Recibirás <strong style={{ color: '#7ceb95' }}>${speculatorConfirm.price}</strong>. Esta acción no se puede deshacer.
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => sellSpeculatorPokemon(speculatorConfirm.kind, speculatorConfirm.index, speculatorConfirm.price)}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #10b981', background: '#10b981', color: '#052e16', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Confirmar venta
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpeculatorConfirm(null)}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #64748b', background: 'transparent', color: '#cbd5e1', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <h4 style={{ color: '#ff8a33', margin: '0 0 0.4rem', fontSize: '0.9rem' }}>Equipo ({team.length})</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                    {team.length === 0 ? (
                      <p style={{ color: '#7d7ab5', fontSize: '0.8rem', margin: 0 }}>No tienes Pokémon en el equipo.</p>
                    ) : team.map((p, index) => renderRow(p, 'team', index))}
                  </div>

                  <h4 style={{ color: '#ff8a33', margin: '0 0 0.4rem', fontSize: '0.9rem' }}>PC ({pcStorage.length})</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto', marginBottom: '1rem' }}>
                    {pcStorage.length === 0 ? (
                      <p style={{ color: '#7d7ab5', fontSize: '0.8rem', margin: 0 }}>No tienes Pokémon en el PC.</p>
                    ) : pcStorage.map((p, index) => renderRow(p, 'pc', index))}
                  </div>

                  <button className="cta" onClick={() => { setSpeculatorConfirm(null); completeCurrentNode() }} type="button" style={{ width: '100%' }}>
                    Salir del Especulador
                  </button>
                </div>
              )
            })()}

            {screen === 'trade' && (
              <div className="action-block shop-block" style={{ marginTop: '1rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: '#37d16b' }}>🤝 Nodo de Intercambio</h3>
                </div>

                {coopTradeMsg && <p style={{ color: '#ffcb05', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{coopTradeMsg}</p>}

                {!coopMyOfferSubmitted ? (
                  <>
                    <p className="label" style={{ margin: '0 0 0.35rem' }}>1️⃣ Elige qué ofreces (un Pokémon o un objeto)</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.5rem' }}>
                      {team.map((pokemon, idx) => {
                        const selected = coopMyOffer?.kind === 'pokemon' && coopMyOffer.id === pokemon.id
                        return (
                          <button
                            key={`of-${pokemon.id}-${idx}`}
                            type="button"
                            className="tiny-btn"
                            disabled={team.length <= 1}
                            onClick={() => coopSelectPokemon(idx)}
                            style={{ background: selected ? '#37d16b' : '#2a2a55', color: '#fff', border: selected ? '2px solid #0f7a43' : '2px solid transparent' }}
                          >
                            <img src={pokemon.sprite} alt={pokemon.name} onError={fallbackSprite} style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '4px', imageRendering: 'pixelated' }} />
                            {pokemon.name} Nv.{pokemon.level}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.75rem' }}>
                      {Array.from(new Set(inventory)).filter(i => i !== 'Mega Stone' && i !== 'Dynamax Band' && i !== 'Prisma Rojo' && i !== 'Prisma Azul').map((itemName) => {
                        const count = inventory.filter(i => i === itemName).length
                        const selected = coopMyOffer?.kind === 'item' && coopMyOffer.itemName === itemName
                        return (
                          <button key={itemName} type="button" className="tiny-btn" onClick={() => coopSelectItem(itemName)} style={{ background: selected ? '#37d16b' : '#2a2a55', color: '#fff', border: selected ? '2px solid #0f7a43' : '2px solid transparent' }}>
                            {ITEM_SPRITES[itemName] && <img src={ITEM_SPRITES[itemName]} alt="" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px', imageRendering: 'pixelated' }} />}
                            {itemLocalizedName(itemName)} ×{count}
                          </button>
                        )
                      })}
                      {inventory.length === 0 && <span style={{ color: '#7d7ab5', fontSize: '0.8rem' }}>No tienes objetos.</span>}
                    </div>
                    {coopMyOffer && (
                      <p style={{ color: '#f3f1ff', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        Tu oferta: <strong style={{ color: '#37d16b' }}>{coopMyOffer.kind === 'pokemon' ? `${coopMyOffer.name} (Nv.${coopMyOffer.level})` : itemLocalizedName(coopMyOffer.itemName ?? '')}</strong>
                      </p>
                    )}
                    <button
                      className="cta"
                      type="button"
                      disabled={!coopMyOffer}
                      onClick={() => void coopConfirmExchange()}
                      style={{ width: '100%', background: coopMyOffer ? '#37d16b' : '#475569', color: coopMyOffer ? '#12122b' : '#d9d6f2', marginBottom: '0.5rem' }}
                    >
                      🤝 ¡Intercambiar! (los dos deben pulsarlo)
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      disabled={!coopMyOffer}
                      onClick={() => void cancelCoopOffer()}
                      style={{ width: '100%', marginBottom: '0.5rem' }}
                    >
                      {t('coop.cancelSelection')}
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ color: '#37d16b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      ✅ Tu oferta fue enviada. Esperando a que tu compañero pulse "Intercambiar"...
                    </p>
                    {coopExchange && ((coopMyRole === 'a' ? coopExchange.b_ready : coopExchange.a_ready)) && !coopExchange.completed && (
                      <p style={{ color: '#9b98cf', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        🎁 Tu compañero ofrece: <strong style={{ color: '#f3f1ff' }}>{offerLabel(coopExchange)}</strong>
                      </p>
                    )}
                    {coopExchange?.completed && (
                      <p style={{ color: '#37d16b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        🎉 ¡Intercambio completado! El cambio se ha realizado automáticamente.
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#9b98cf', fontSize: '0.8rem' }}>Estado:</span>
                      <span style={{ color: coopMyOfferSubmitted ? '#37d16b' : '#9b98cf', fontSize: '0.85rem', fontWeight: 'bold' }}>Tú ✅</span>
                      <span style={{ color: '#9b98cf' }}>·</span>
                      <span style={{ color: coopExchange?.completed ? '#37d16b' : (coopExchange?.a_ready && coopExchange?.b_ready ? '#ffcb05' : '#9b98cf'), fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {coopExchange?.completed ? 'Compañero ✅' : (coopExchange?.a_ready && coopExchange?.b_ready ? '¡Ambos listos!' : 'Compañero ⏳')}
                      </span>
                    </div>
                    {!coopExchange?.completed && (
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => void cancelCoopOffer()}
                        style={{ width: '100%', marginBottom: '0.5rem', color: '#ff8a80' }}
                      >
                        {t('coop.cancelTrade')}
                      </button>
                    )}
                  </>
                )}

                <button className="cta" onClick={() => void leaveTradeNode()} type="button" style={{ width: '100%' }}>
                  Salir del Nodo
                </button>
              </div>
            )}

            {screen === 'spin' && (
              <div className="action-block spin-block">
                <h3 style={{ margin: '0 0 0.5rem', color: '#cba3ff', textAlign: 'center' }}>{t('spin.title')}</h3>
                <p className="muted" style={{ textAlign: 'center', margin: '0 0 1rem' }}>{t('spin.desc')}</p>
                <div className="roulette-wheel">
                  <div className={`roulette-items ${spinAnimating ? 'spinning' : ''}`}>
                    {spinItems.map((item, idx) => {
                      const itemIcon = ITEM_SPRITES[item]
                      const isWinner = spinRevealed && idx === spinWinnerIndex
                      return (
                        <div
                          key={`spin-${idx}`}
                          className={`roulette-item ${isWinner ? 'winner' : ''} ${spinWinnerIndex === idx && spinAnimating ? 'highlight' : ''}`}
                        >
                          {itemIcon && (
                            <img src={itemIcon} alt={item} className="roulette-item-icon" />
                          )}
                          <span className="roulette-item-name">{itemLocalizedName(item)}</span>
                          <span className="roulette-item-desc">{itemDesc(item)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {!spinRevealed && !spinAnimating && (
                  <button className="cta spin-cta" onClick={spinRoulette} type="button">
                    {t('spin.spin')}
                  </button>
                )}
                {spinAnimating && (
                  <p style={{ textAlign: 'center', color: '#cba3ff', fontWeight: 'bold', margin: '0.5rem 0' }}>{t('spin.spinning')}</p>
                )}
                {spinRevealed && spinWinnerIndex !== null && (
                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <p style={{ color: '#7ceb95', fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
                      {t('spin.got', { item: itemLocalizedName(spinItems[spinWinnerIndex]) })}
                    </p>
                    <button className="cta spin-cta" onClick={claimSpinItem} type="button">
                      {t('spin.collect')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {screen === 'pokeRand' && (
              <div className="action-block pokeRand-block">
                <h3 style={{ margin: '0 0 0.5rem', color: '#4d9bff', textAlign: 'center' }}>{t('pokerand.title')}</h3>
                <p className="muted" style={{ textAlign: 'center', margin: '0 0 1rem' }}>{t('pokerand.desc')}</p>
                <div className="roulette-wheel" style={{ borderColor: 'rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.06)' }}>
                  <div className={`roulette-items ${pokeRandAnimating ? 'spinning' : ''}`}>
                    {pokeRandPokemon.map((pokemon, idx) => {
                      const isWinner = pokeRandRevealed && idx === pokeRandWinnerIndex
                      return (
                        <div
                          key={`pr-${pokemon.id}-${idx}`}
                          className={`roulette-item ${isWinner ? 'winner' : ''} ${pokeRandWinnerIndex === idx && pokeRandAnimating ? 'highlight' : ''}`}
                          style={isWinner ? { borderColor: '#4d9bff', boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)' } : undefined}
                        >
                          <img src={pokemon.sprite} alt={pokemon.name} className="roulette-item-icon" onError={fallbackSprite} style={{ width: '48px', height: '48px' }} />
                          <span className="roulette-item-name">{pokemon.name}</span>
                          <span className="roulette-item-desc">Nv.{pokemon.level}</span>
                          <span className="roulette-item-desc" style={{ fontSize: '0.55rem', color: '#9b98cf' }}>
                            {pokemon.types?.join('/')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {!pokeRandRevealed && !pokeRandAnimating && (
                  <button className="cta pokeRand-cta" onClick={pokeRandSpin} type="button">
                    {t('pokerand.spin')}
                  </button>
                )}
                {pokeRandAnimating && (
                  <p style={{ textAlign: 'center', color: '#4d9bff', fontWeight: 'bold', margin: '0.5rem 0' }}>{t('pokerand.spinning')}</p>
                )}
                {pokeRandRevealed && pokeRandWinnerIndex !== null && (
                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <p style={{ color: '#7ceb95', fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
                      {t('pokerand.join', { name: pokeRandPokemon[pokeRandWinnerIndex].name })}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        className="cta pokeRand-cta"
                        onClick={claimPokeRandPokemon}
                        type="button"
                        style={{ width: 'auto', padding: '10px 24px' }}
                      >
                        {team.length + (daycareEgg ? 1 : 0) >= maxTeamSize ? t('route.captureToPC', { n: pcStorage.length }) : t('route.captureTeam', { n: team.length, max: maxTeamSize })}
                      </button>
                      <button
                        className="secondary"
                        onClick={skipPokeRandPokemon}
                        type="button"
                        style={{ padding: '10px 24px' }}
                      >
                        {t('pokerand.release')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {screen === 'casino' && (
              <div className="action-block casino-block">
                <h3 style={{ margin: '0 0 0.5rem', color: '#f0abfc', textAlign: 'center' }}>{t('casino.title')}</h3>
                <p className="muted" style={{ textAlign: 'center', margin: '0 0 0.5rem' }}>
                  {t('casino.desc')}
                </p>
                <Suspense fallback={<LazyLoadingPanel label={t('casino.title')} />}>
                  <CasinoMinigame onComplete={casinoComplete} />
                </Suspense>
                {casinoScore !== null && casinoReward && (
                  <div style={{ textAlign: 'center', marginTop: '0.75rem', padding: '0.75rem', border: '1px solid rgba(240, 171, 252, 0.4)', borderRadius: '10px', background: 'rgba(240, 171, 252, 0.08)' }}>
                    <p style={{ color: '#f0abfc', fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 0.25rem' }}>
                      {casinoReward.label}
                    </p>
                    <p style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '1rem', margin: '0 0 0.25rem' }}>
                      +${runChallenges.noMoney ? 0 : casinoReward.money}
                    </p>
                    {casinoReward.item && (
                      <p style={{ color: '#f3f1ff', fontSize: '0.9rem', margin: '0 0 0.5rem' }}>
                        + {casinoReward.item}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button className="cta" onClick={claimCasinoReward} type="button" style={{ background: '#f0abfc', color: '#1a1033' }}>
                        {t('route.claim')}
                      </button>
                      <button className="secondary" onClick={skipCasino} type="button">
                        {t('route.exit')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {screen === 'move' && (
              <div className="action-block">
                <h3 style={{ margin: '0 0 0.5rem', color: moveFromItemRef.current ? '#38bdf8' : '#f3f1ff', textAlign: 'center' }}>
                  {moveFromItemRef.current ? t('move.disco') : t('move.tutor')}
                </h3>
                {!selectedNewMove ? (
                  <>
                    <p className="muted" style={{ textAlign: 'center', margin: '0 0 0.75rem' }}>
                      {moveFromItemRef.current
                        ? <>{t('move.chooseFor', { name: activePokemon?.name ?? '' })} {t('move.discoUse')}</>
                        : <>{t('move.chooseFor', { name: activePokemon?.name ?? '' })} {t('move.orSkip')}</>}
                    </p>
                    <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                      {moveOptions.map((move) => (
                        <ThemedTooltip key={`move-opt-${move.name}`} content={moveTooltip(move)}>
                          <button
                            className="move-btn move-opt-btn"
                            type="button"
                            onClick={() => setSelectedNewMove(move)}
                            style={{ borderColor: TYPE_COLORS[move.type] ?? '#475569' }}
                          >
                            <strong className="move-btn-line">{moveName(move)}</strong>
                            <span className="muted" style={{ fontSize: '0.5rem' }}>
                              {move.type.toUpperCase()} · Pwr {move.power} · Acc {move.accuracy ?? '—'}
                            </span>
                            {moveEffectSummary(move) && <span className="move-btn-effect">{moveEffectSummary(move)}</span>}
                          </button>
                        </ThemedTooltip>
                      ))}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button className="secondary" onClick={skipMoveNode} type="button">
                        {moveFromItemRef.current ? 'Salir (guardar Disco MT)' : 'Saltar'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="muted" style={{ textAlign: 'center', margin: '0 0 0.75rem' }}>
                      <strong style={{ color: TYPE_COLORS[selectedNewMove.type] ?? '#f3f1ff' }}>{selectedNewMove.name}</strong>
                      {' '} {t('move.replaceWhich')}
                    </p>
                    <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                      {activePokemon?.moves.map((move, idx) => (
                        <ThemedTooltip key={`move-replace-${idx}`} content={moveTooltip(move)}>
                          <button
                            className="move-btn move-opt-btn"
                            type="button"
                            onClick={() => replaceTeamMove(idx)}
                            style={{ borderColor: TYPE_COLORS[move.type] ?? '#475569' }}
                          >
                            <strong className="move-btn-line">{moveName(move)}</strong>
                            <span className="muted" style={{ fontSize: '0.5rem' }}>
                              {move.type.toUpperCase()} · Pwr {move.power}
                            </span>
                            {moveEffectSummary(move) && <span className="move-btn-effect">{moveEffectSummary(move)}</span>}
                          </button>
                        </ThemedTooltip>
                      ))}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button className="secondary" onClick={() => { setSelectedNewMove(null) }} type="button">
                        ← Volver
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {screen === 'mega' && (
              <div className="action-block" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>💎</div>
                <h3 style={{ margin: '0 0 0.5rem', color: '#ff9ad6' }}>{t('mega.title')}</h3>
                {inventory.includes('Mega Stone') || team.some(p => p.holdItem === 'Mega Stone') ? (
                  <>
                    <p style={{ margin: '0 0 0.25rem' }}><span dangerouslySetInnerHTML={{ __html: t('mega.got') }} /></p>
                    <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 1rem' }}>
                      {t('mega.gotDesc')}
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ margin: '0 0 0.25rem' }}>{t('mega.already')}</p>
                    <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 1rem' }}>
                      {t('mega.alreadyDesc')}
                    </p>
                  </>
                )}
                <button className="cta" onClick={() => { completeCurrentNode(); setScreen('route') }} type="button" style={{ background: '#ff9ad6' }}>
                  {t('route.continue')}
                </button>
              </div>
            )}

            {screen === 'primal' && (
              <div className="action-block" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>🔮</div>
                <h3 style={{ margin: '0 0 0.5rem', color: '#ff8a33' }}>{t('primal.title')}</h3>
                {inventory.includes('Prisma Rojo') || team.some(p => p.holdItem === 'Prisma Rojo') ? (
                  <>
                    <p style={{ margin: '0 0 0.25rem' }}><span dangerouslySetInnerHTML={{ __html: t('primal.gotRed') }} /></p>
                    <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 1rem' }}>
                      {t('primal.gotRedDesc')}
                    </p>
                  </>
                ) : inventory.includes('Prisma Azul') || team.some(p => p.holdItem === 'Prisma Azul') ? (
                  <>
                    <p style={{ margin: '0 0 0.25rem' }}><span dangerouslySetInnerHTML={{ __html: t('primal.gotBlue') }} /></p>
                    <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 1rem' }}>
                      {t('primal.gotBlueDesc')}
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ margin: '0 0 0.25rem' }}>{t('primal.already')}</p>
                    <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 1rem' }}>
                      {t('primal.alreadyDesc')}
                    </p>
                  </>
                )}
                <button className="cta" onClick={() => { completeCurrentNode(); setScreen('route') }} type="button" style={{ background: '#ff8a33' }}>
                  {t('route.continue')}
                </button>
              </div>
            )}

            {screen === 'route' && legendaryEncounter && (
              <div className="action-block">
                <p>
                  🐉 ¡Un Pokémon Legendario apareció! <strong>{legendaryEncounter.name}</strong> está esperando ser capturado.
                </p>
                <div className="capture-card" style={{ border: '2px solid #fbbf24', boxShadow: '0 0 12px rgba(251,191,36,0.4)' }}>
                  <img className="sprite" src={legendaryEncounter.sprite} alt={legendaryEncounter.name} onError={fallbackSprite} />
                </div>
                <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                  <button className="cta" onClick={captureLegendaryPokemon} type="button" style={{ background: '#d97706' }}>
                    {team.length + (daycareEgg ? 1 : 0) >= maxTeamSize ? t('route.captureToPC', { n: pcStorage.length }) : t('route.captureLegend')}
                  </button>
                  <button className="secondary" onClick={skipLegendaryCapture} type="button">
                    Skip
                  </button>
                </div>
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type !== 'rest' && !legendaryEncounter && difficulty !== 'branch' && (
              <div className="action-block">
                <p>
                  {t('route.nextNode', { name: `${nodeTypeLabel(currentNode)} #${currentNode.id}` })}
                </p>
                <button className={`cta ${currentNode.type === 'teamRocket' ? 'cta-danger' : ''}`} onClick={() => enterNode()} type="button" disabled={isLoading}>
                  {isLoading ? t('node.searching') : currentNode.type === 'teamRocket' ? t('node.teamRocket') : currentNode.type === 'spin' ? t('node.spin') : currentNode.type === 'pokeRand' ? t('node.pokeRand') : currentNode.type === 'mega' ? t('node.mega') : currentNode.type === 'gmax' ? t('node.gmax') : currentNode.type === 'primal' ? t('node.primal') : currentNode.type === 'trade' ? t('node.trade') : currentNode.type === 'rival' ? t('node.rival') : currentNode.type === 'blackmarket' ? t('node.blackmarket') : currentNode.type === 'speculator' ? t('node.speculator') : currentNode.type === 'safari' ? t('node.safari') : currentNode.type === 'orchard' ? t('node.orchard') : currentNode.type === 'fossil' ? t('node.fossil') : currentNode.type === 'fishing' ? t('node.fishing') : currentNode.type === 'mine' ? t('node.mine') : currentNode.type === 'daycare' ? t('node.daycare') : currentNode.type === 'weather' ? t('node.weather') : currentNode.type === 'mirror' ? t('node.mirror') : currentNode.type === 'ranch' ? t('node.ranch') : currentNode.type === 'double' ? t('node.double') : currentNode.type === 'casino' ? t('node.casino') : currentNode.type === 'legendary' ? t('node.legendary') : t('node.enter')}
                </button>
              </div>
            )}

            {screen === 'route' && difficulty === 'branch' && !restEncounter && (
              <div className="action-block" style={{ border: '1px solid rgba(238,59,47,0.4)' }}>
                <p style={{ color: '#ff8a80', fontWeight: 'bold' }}>
                  {branchMap && branchMap[branchCol] && branchMap[branchCol][0]?.type === 'boss'
                    ? (language === 'en' ? '👑 The boss awaits! Enter the final node.' : '👑 ¡El jefe te espera! Entra en el nodo final.')
                    : (language === 'en' ? '🛣️ Choose a red node to continue your path.' : '🛣️ Elige un nodo rojo del mapa para continuar tu camino.')}
                </p>
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type === 'rest' && restEncounter && !legendaryEncounter && (
              <div className="action-block">
                <p>
                  <span dangerouslySetInnerHTML={{ __html: t('rest.waiting', { name: restEncounter.name + (restEncounter.shiny ? ' ✨' : '') }) }} />
                </p>
                <p className="muted">{t('rest.rewardAdded', { item: itemLocalizedName(restRewardItem) })}</p>
                {restExtraItems.length > 0 && (
                  <p className="muted" style={{ color: '#ffcb05' }}>
                    📡 {restExtraItems.map(item => itemLocalizedName(item)).join(' · ')}
                  </p>
                )}
                <div className="capture-card" style={restEncounter.shiny ? { border: '2px solid #ffcb05', boxShadow: '0 0 12px rgba(250,204,21,0.4)' } : undefined}>
                  <img className="sprite" src={restEncounter.sprite} alt={restEncounter.name} onError={fallbackSprite} />
                </div>
                <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                  <button className="cta" onClick={captureRestPokemon} type="button">
                    {team.length + (daycareEgg ? 1 : 0) >= maxTeamSize ? t('route.captureToPC', { n: pcStorage.length }) : t('route.catchLabel')}
                  </button>
                  <button className="secondary" onClick={skipRestCapture} type="button">
                    {t('common.skip')}
                  </button>
                </div>
                <div className="evolve-section" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>{t('rest.healPrompt')}</p>
                  <button className="cta" onClick={() => { if (runChallenges.noHealing) { setBattleLog(prev => [t('b.challengeNoHealRest'), ...prev].slice(0, 15)); completeCurrentNode(); return } setTeam(prev => prev.map(p => p.hp <= 0 ? { ...p, hp: Math.max(1, Math.floor(p.maxHp * 0.5)), status: undefined } : { ...p, hp: p.maxHp, status: undefined })); setBattleLog(prev => [t('b.restHealed'), ...prev].slice(0, 15)); completeCurrentNode() }} type="button" style={{ background: '#ee3b2f', width: '100%' }}>
                    {t('rest.healTeam')}
                  </button>
                </div>
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type === 'rest' && !restEncounter && !legendaryEncounter && difficulty !== 'branch' && (
              <div className="action-block">
                <p>
                  {t('b.restStop', { name: `${nodeTypeLabel(currentNode)} #${currentNode.id}` })}
                </p>
                <button className="cta" onClick={() => enterNode()} type="button" disabled={isLoading}>
                  {isLoading ? t('rest.searching') : t('rest.enter')}
                </button>
              </div>
            )}

            {screen === 'double' && (
              <div className="action-block" style={{ marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', color: '#facc15', textAlign: 'center' }}>🥊 Combate Doble</h3>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '0.75rem' }}>
                  {doubleEnemies.map((enemy, idx) => {
                    const hit = doubleHits.find(h => h.kind === 'enemy' && h.index === idx)
                    return (
                      <div key={idx} style={{ textAlign: 'center', flex: 1, maxWidth: 180, opacity: enemy.hp <= 0 ? 0.35 : 1 }}>
                        <img key={hit ? hit.key : undefined} className={`${hit ? 'pvp-hit-flash' : ''} ${statusSpriteClass(enemy.status, enemy.leechSeed)}`} src={enemy.sprite} alt={enemy.name} onError={fallbackSprite} style={{ width: 72, height: 72, imageRendering: 'pixelated' }} />
                        <div style={{ fontSize: '0.8rem', color: '#f3f1ff', fontWeight: 'bold' }}>{enemy.name}{enemy.hp <= 0 ? ' (debilitado)' : ''}<StatusBadge status={enemy.status} compact />{enemy.leechSeed && <LeechSeedBadge compact />}</div>
                        <div style={{ fontSize: '0.7rem', color: '#7d7ab5' }}>HP {Math.max(0, enemy.hp)}/{enemy.maxHp}</div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '0.75rem' }}>
                  {doubleActives.map((teamIdx, slot) => {
                    if (teamIdx === undefined) return null
                    const pokemon = team[teamIdx]
                    if (!pokemon) return null
                    const hit = doubleHits.find(h => h.kind === 'player' && h.index === slot)
                    return (
                      <div key={slot} style={{ textAlign: 'center', flex: 1, maxWidth: 180 }}>
                        <img key={hit ? hit.key : undefined} className={`${hit ? 'pvp-hit-flash' : ''} ${statusSpriteClass(pokemon.status, pokemon.leechSeed)}`} src={pokemon.sprite} alt={pokemon.name} onError={fallbackSprite} style={{ width: 72, height: 72, imageRendering: 'pixelated' }} />
                        <div style={{ fontSize: '0.8rem', color: '#ffcb05', fontWeight: 'bold' }}>{pokemon.name}<StatusBadge status={pokemon.status} compact />{pokemon.leechSeed && <LeechSeedBadge compact />}</div>
                        <div style={{ fontSize: '0.7rem', color: '#7d7ab5' }}>HP {Math.max(0, pokemon.hp)}/{pokemon.maxHp}</div>
                      </div>
                    )
                  })}
                </div>

                {weather !== 'none' && (
                  <WeatherTooltip
                    weather={weather}
                    style={{ display: 'inline-block', margin: '0 auto 0.5rem', padding: '2px 10px', borderRadius: '999px', background: 'rgba(154,152,207,0.18)', color: '#c4b5fd', fontSize: '0.75rem', fontWeight: 'bold' }}
                  />
                )}

                <div style={{ maxHeight: '110px', overflowY: 'auto', padding: '0.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid #3f3f6e', marginBottom: '0.75rem' }}>
                  {doubleLog.map((line, i) => (
                    <p key={i} style={{ margin: '0 0 0.2rem', fontSize: '0.78rem', color: '#d9d6f2' }}>{line}</p>
                  ))}
                </div>

                {doubleFinished ? (
                  <button className="cta" type="button" onClick={doubleLeave} style={{ width: '100%' }}>{t('route.continue')}</button>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {doubleActives.map((teamIdx, slot) => {
                        if (teamIdx === undefined) return null
                        const pokemon = team[teamIdx]
                        if (!pokemon) return null
                        const sel = doubleMoves[slot]
                        return (
                          <button
                            key={slot}
                            className="tiny-btn"
                            type="button"
                            onClick={() => setDoubleActiveSlot(slot)}
                            style={{ flex: 1, background: doubleActiveSlot === slot ? '#a855f7' : '#2a2a55', color: '#fff', border: doubleActiveSlot === slot ? '2px solid #cba3ff' : '2px solid transparent' }}
                          >
                            {pokemon.name}{sel ? ' ✓' : ''}
                          </button>
                        )
                      })}
                    </div>
                    <p style={{ margin: '0 0 0.55rem', color: '#7d7ab5', fontSize: '0.72rem', textAlign: 'center' }}>
                      Pulsa o arrastra un Pokémon del equipo para cambiarlo. El cambio consume el turno.
                    </p>

                    {(() => {
                      const slot = doubleActiveSlot
                      const teamIdx = doubleActives[slot]
                      if (teamIdx === undefined) {
                        return <p style={{ margin: '0 0 0.5rem', color: '#7d7ab5', fontSize: '0.8rem', textAlign: 'center' }}>Este Pokémon está debilitado.</p>
                      }
                      const pokemon = team[teamIdx]
                      const canSwitchNow = team.some((p, idx) => p.hp > 0 && !doubleActives.includes(idx))
                      if (!pokemon || pokemon.hp <= 0) {
                        return <p style={{ margin: '0 0 0.5rem', color: '#7d7ab5', fontSize: '0.8rem', textAlign: 'center' }}>Este Pokémon está debilitado.</p>
                      }
                      if (doubleChoosingSwitch) {
                        const backups = team.map((p, idx) => ({ p, idx })).filter(x => x.p.hp > 0 && !doubleActives.includes(x.idx))
                        return (
                          <div style={{ padding: '0.6rem', borderRadius: '8px', background: 'rgba(56,189,248,0.08)', border: '1px solid #38bdf8', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                              <strong style={{ color: '#7dd3fc', fontSize: '0.85rem' }}>{t('pvp.switchPokemon')}</strong>
                              <button className="tiny-btn" type="button" onClick={() => setDoubleChoosingSwitch(false)}>{t('pvp.backToMoves')}</button>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {backups.map(({ p, idx }) => (
                                <button key={idx} className="tiny-btn" type="button" onClick={() => doubleSwitchPokemon(slot, idx)}>
                                  <img src={p.sprite} alt={p.name} onError={fallbackSprite} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} />
                                  {p.name}
                                </button>
                              ))}
                              {backups.length === 0 && <span style={{ color: '#7d7ab5', fontSize: '0.8rem' }}>{t('common.noPokemon')}</span>}
                            </div>
                            <p style={{ margin: '0.5rem 0 0', color: '#7d7ab5', fontSize: '0.75rem' }}>El cambio gasta el turno: el Pokémon que entra no ataca y los enemigos sí.</p>
                          </div>
                        )
                      }
                      const sel = doubleMoves[slot]
                      return (
                        <>
                          <p style={{ margin: '0 0 0.3rem', color: '#9b98cf', fontSize: '0.8rem' }}>1️⃣ Elige un movimiento:</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.6rem' }}>
                            {pokemon.moves.map((m, mi) => (
                              <ThemedTooltip key={mi} content={moveTooltip(m)}>
                                <button
                                  className="tiny-btn move-btn double-move-btn"
                                  type="button"
                                  onClick={() => doubleSelectMove(slot, mi)}
                                  style={{ width: '100%', background: sel?.moveIdx === mi ? '#a855f7' : '#2a2a55', color: '#fff', border: sel?.moveIdx === mi ? '2px solid #cba3ff' : '2px solid transparent' }}
                                >
                                  <span className="move-btn-line">{moveName(m)} ({m.type})</span>
                                  {moveEffectSummary(m) && <span className="move-btn-effect">{moveEffectSummary(m)}</span>}
                                </button>
                              </ThemedTooltip>
                            ))}
                          </div>
                          <p style={{ margin: '0 0 0.3rem', color: '#9b98cf', fontSize: '0.8rem' }}>2️⃣ Elige el objetivo:</p>
                          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
                            {doubleEnemies.map((enemy, ei) => (
                              enemy.hp > 0 ? (
                                <button
                                  key={ei}
                                  className="tiny-btn"
                                  type="button"
                                  onClick={() => doubleSelectTarget(slot, ei)}
                                  style={{ flex: 1, background: sel?.target === ei ? '#ee3b2f' : '#2a2a55', color: '#fff', border: sel?.target === ei ? '2px solid #ff8a80' : '2px solid transparent' }}
                                >
                                  🎯 {enemy.name}
                                </button>
                              ) : null
                            ))}
                          </div>
                          {sel && (
                            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#7dd3fc', textAlign: 'center' }}>
                              Listo: {pokemon.name} usará <strong>{pokemon.moves[sel.moveIdx]?.name}</strong> contra <strong>{doubleEnemies[sel.target]?.name}</strong>.
                            </p>
                          )}
                          {pokemon.holdItem === 'Mega Stone' && !battleMegaUsed && !pokemon.gmaxEvolved && MEGA_CAPABLE_IDS.has(pokemon.id) && (
                            <button
                              className="cta"
                              type="button"
                              onClick={() => megaEvolveActive(teamIdx)}
                              style={{ width: '100%', marginBottom: '0.5rem', background: '#e060a8' }}
                            >
                              💥 ¡Mega Evolucionar!
                            </button>
                          )}
                          {pokemon.holdItem === 'Dynamax Band' && !battleGmaxUsed && !pokemon.gmaxEvolved && !pokemon.megaEvolved && GMAX_CAPABLE_IDS.has(pokemon.id) && (
                            <button
                              className="cta"
                              type="button"
                              onClick={() => gmaxEvolveActive(teamIdx)}
                              style={{ width: '100%', marginBottom: '0.5rem', background: '#6b8cff' }}
                            >
                              ⚡ ¡Gigamaximar!
                            </button>
                          )}
                          {(pokemon.holdItem === 'Prisma Rojo' || pokemon.holdItem === 'Prisma Azul') && !battlePrimalUsed && !pokemon.megaEvolved && !pokemon.gmaxEvolved && PRIMAL_CAPABLE_IDS.has(pokemon.id) && (
                            <button
                              className="cta"
                              type="button"
                              onClick={() => primalEvolveActive(teamIdx)}
                              style={{ width: '100%', marginBottom: '0.5rem', background: '#ff8a33' }}
                            >
                              🔮 ¡Primal Reversion!
                            </button>
                          )}
                          {(pokemon.holdItem === 'Diamansfera' || pokemon.holdItem === 'Lustresfera' || pokemon.holdItem === 'Griseosfera') && !battleOriginUsed && !pokemon.megaEvolved && !pokemon.gmaxEvolved && !pokemon.primalEvolved && !pokemon.originEvolved && ORIGIN_CAPABLE_IDS.has(pokemon.id) && (
                            <button
                              className="cta"
                              type="button"
                              onClick={() => originEvolveActive(teamIdx)}
                              style={{ width: '100%', marginBottom: '0.5rem', background: '#4d9bff' }}
                            >
                              🌀 ¡Forma Origen!
                            </button>
                          )}
                          {canSwitchNow && (
                            <button
                              className="tiny-btn"
                              type="button"
                              onClick={() => setDoubleChoosingSwitch(true)}
                              style={{ width: '100%', marginBottom: '0.5rem', background: '#2a2a55', color: '#7dd3fc', border: '1px solid #38bdf8' }}
                            >
                              🔁 Cambiar de Pokémon (gasta turno)
                            </button>
                          )}
                        </>
                      )
                    })()}

                    {(() => {
                      const anyAlive = doubleActives.some(ti => ti !== undefined)
                      const allReady = doubleActives.every((ti, i) => ti === undefined || doubleMoves[i] !== null)
                      const ready = anyAlive && allReady
                      return (
                        <button
                          className="cta"
                          type="button"
                          onClick={resolveDoubleTurn}
                          disabled={doubleChoosingSwitch || !ready}
                          style={{ width: '100%', background: ready && !doubleChoosingSwitch ? '#facc15' : '#475569', color: ready && !doubleChoosingSwitch ? '#12122b' : '#d9d6f2' }}
                        >
                          🥊 ¡Atacar!
                        </button>
                      )
                    })()}
                  </>
                )}
              </div>
            )}

            {screen === 'battle' && enemy && (
              <div className="action-block">
                {isTrainerBattle ? (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      {trainerSprite && (
                        <img
                          src={trainerSprite}
                          alt={trainerName}
                          style={{ width: '72px', height: '72px', imageRendering: 'pixelated' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      )}
                      <div>
                        <p style={{ margin: '0', fontWeight: 'bold', color: '#ffcb05', fontSize: '0.95rem' }}>
                          {trainerBadge ? `🏆 ${t('battle.leader', { name: trainerName })}` : `⚔️ ${trainerName}`}
                        </p>
                        {trainerBadge && (
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#fbbf24' }}>{trainerBadge}</p>
                        )}
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#9b98cf' }}>
                          {t('b.trainerTeam', { n: trainerTeam.length })}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {trainerTeam.map((tp, idx) => {
                        const isActive = idx === trainerPokemonIndex
                        const isDefeated = idx < trainerPokemonIndex || (idx === trainerPokemonIndex && tp.hp <= 0)
                        return (
                          <div
                            key={`trainer-pkmn-${idx}`}
                            title={`${tp.name} Nv.${tp.level} – ${tp.hp}/${tp.maxHp} HP`}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '6px',
                              border: isActive ? '2px solid #ffcb05' : '1px solid rgba(255,255,255,0.15)',
                              background: isDefeated ? 'rgba(239,68,68,0.15)' : isActive ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.05)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              overflow: 'hidden', position: 'relative'
                            }}
                          >
                            <img
                              src={tp.sprite}
                              alt={tp.name}
                              onError={fallbackSprite}
                              style={{
                                width: '34px', height: '34px',
                                filter: isDefeated ? 'grayscale(100%) brightness(0.5)' : 'none',
                                opacity: isDefeated ? 0.4 : 1
                              }}
                            />
                            {tp.status && (
                              <span style={{ position: 'absolute', top: 1, right: 1, fontSize: '0.6rem', lineHeight: 1, textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
                                {statusLabel(tp.status.type).split(' ')[0]}
                              </span>
                            )}
                            {isActive && (
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                height: '3px', background: '#ffcb05', borderRadius: '0 0 4px 4px'
                              }} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: '0 0 4px 0', color: '#86efac', fontSize: '0.85rem' }}>{t('b.wildPokemon')}</p>
                )}

                <p style={{ margin: '0 0 4px 0', fontSize: '1.2rem' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{enemy.name}{enemy.shiny ? ' ✨' : ''}</strong>
                  {enemy.leechSeed && <LeechSeedBadge />}
                  <StatusBadge status={enemy.status} />
                  {' · '}Nv. {enemy.level}
                </p>
                {weather !== 'none' && (
                  <WeatherTooltip
                    weather={weather}
                    style={{ display: 'inline-block', margin: '0 0 6px 0', padding: '2px 8px', borderRadius: '999px', background: 'rgba(154,152,207,0.18)', color: '#c4b5fd', fontSize: '0.75rem', fontWeight: 'bold' }}
                  />
                )}
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img className={`sprite enemy-sprite${enemy.gmaxEvolved ? ' gmax-active' : ''} ${statusSpriteClass(enemy.status, enemy.leechSeed)}`} src={enemy.sprite} alt={enemy.name} onError={fallbackSprite} style={enemyHitFlash ? { filter: 'brightness(1.5) sepia(1) hue-rotate(-40deg) saturate(5)', transition: 'filter 0.05s' } : { transition: 'filter 0.3s' }} />
                  <StatusFloat pokemon={enemy} />
                  <FloatingCombatText data={enemyCombatFloat} />
                </div>
                <div className="hp-line">
                  <span>HP rival</span>
                  <strong>{enemy.hp}/{enemy.maxHp}</strong>
                </div>
                <div className="meter enemy-meter">
                  <div style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%`, background: hpBarColor(enemy.hp / enemy.maxHp) }}></div>
                </div>

                <div className="moves-grid">
                  {activePokemon.hp <= 0 ? (
                    <div className="panel" style={{ padding: '0.8rem', textAlign: 'center', border: '1px solid #ff8a80', background: 'rgba(239,68,68,0.12)' }}>
                      <p style={{ margin: '0 0 0.4rem', color: '#ff8a80', fontWeight: 'bold' }}>
                        💀 {activePokemon.name} {t('b.debilitado')}
                      </p>
                      <p style={{ margin: '0 0 0.6rem', color: '#9b98cf', fontSize: '0.85rem' }}>
                        {t('b.mustSwitch')}
                      </p>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {team.map((p, idx) => (
                          p.hp > 0 && idx !== activeIndex ? (
                            <button key={idx} className="tiny-btn" type="button" onClick={() => switchActive(idx)}>
                              <img src={p.sprite} alt={p.name} onError={fallbackSprite} style={{ width: '34px', height: '34px', imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: '4px' }} />
                              {p.name}
                            </button>
                          ) : null
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {(runChallenges.restrictedMoves ? activePokemon.moves.slice(0, 2) : activePokemon.moves).map((move) => {
                        const isDisabled = activePokemon.disabled?.move === move.name
                        const moveHoldable = activePokemon.holdItem ? HOLDABLE_ITEMS[activePokemon.holdItem] : null
                        const isStatusMove = !move.power || move.power <= 0
                        const assaultVestBlocked = !!moveHoldable?.assaultVest && isStatusMove
                        const choiceBlocked = !!moveHoldable?.choiceLock && !!activePokemon.choiceLockedMove && activePokemon.choiceLockedMove !== move.name
                        const moveDisabled = isLoading || isDisabled || (runChallenges.speedrun && speedrunSeconds <= 0) || assaultVestBlocked || choiceBlocked
                        const blockTitle = choiceBlocked
                          ? `🔒 Solo puedes usar ${moveName({ name: activePokemon.choiceLockedMove ?? '' })}`
                          : assaultVestBlocked
                            ? '🦺 Chaleco Asalto: no puedes usar movimientos de estado'
                            : isDisabled
                              ? '🚫 Anulado por Anulación'
                              : moveTooltip(move)
                        return (
                          <ThemedTooltip key={move.name} content={blockTitle}>
                            <button
                              className="move-btn"
                              onClick={() => onPlayerMove(move)}
                              type="button"
                              disabled={moveDisabled}
                              style={{
                                borderColor: isDisabled || choiceBlocked || assaultVestBlocked ? '#ff8a80' : (TYPE_COLORS[move.type] ?? '#475569'),
                                ...(isDisabled || choiceBlocked || assaultVestBlocked ? { opacity: 0.5, textDecoration: 'line-through' } : {}),
                              }}
                            >
                              <span className="move-btn-line">{isDisabled || choiceBlocked || assaultVestBlocked ? '🚫 ' : ''}{moveName(move)} ({move.type}{runChallenges.typeRandomizer ? ' *' : ''}){move.minHits ? ` x${move.minHits}-${move.maxHits}` : ''}</span>
                              {moveEffectSummary(move) && <span className="move-btn-effect">{moveEffectSummary(move)}</span>}
                            </button>
                          </ThemedTooltip>
                        )
                      })}
                    </>
                  )}
                </div>
                {!isTrainerBattle && currentNode?.type !== 'gmax' && activePokemon.hp > 0 && (
                  <button
                    className="cta"
                    onClick={attemptEscape}
                    type="button"
                    disabled={isLoading || (runChallenges.speedrun && speedrunSeconds <= 0)}
                    title={t('b.escapeHint')}
                    style={{ marginTop: '8px', width: '100%', background: hasAbility(activePokemon, 'run-away') ? '#7c3aed' : '#0ea5e9' }}
                  >
                    {hasAbility(activePokemon, 'run-away')
                      ? t('b.escapeSure')
                      : t('b.escapeTryChance', { chance: Math.round(getEscapeChance() * 100) })}
                  </button>
                )}
                {!isTrainerBattle && currentNode?.type !== 'gmax' && (
                  <button
                    className="cta"
                    onClick={openCaptureMenu}
                    type="button"
                    disabled={isLoading || !inventory.some(i => POKEBALL_NAMES.includes(i))}
                    style={{ marginTop: '8px', width: '100%', background: '#37d16b' }}
                  >
                    {t('route.capture')} ({inventory.filter(i => POKEBALL_NAMES.includes(i)).length} {language === 'en' ? 'balls' : 'balls'})
                  </button>
                )}
                {activePokemon.holdItem === 'Mega Stone' && !battleMegaUsed && !activePokemon.gmaxEvolved && MEGA_CAPABLE_IDS.has(activePokemon.id) && (
                  <button
                    className="cta"
                    onClick={() => megaEvolveActive()}
                    type="button"
                    style={{ marginTop: '8px', width: '100%', background: '#e060a8' }}
                  >
                    💥 ¡Mega Evolucionar!
                  </button>
                )}
                {activePokemon.holdItem === 'Dynamax Band' && !battleGmaxUsed && !activePokemon.gmaxEvolved && !activePokemon.megaEvolved && GMAX_CAPABLE_IDS.has(activePokemon.id) && (
                  <button
                    className="cta"
                    onClick={() => gmaxEvolveActive()}
                    type="button"
                    style={{ marginTop: '8px', width: '100%', background: '#6b8cff' }}
                  >
                    ⚡ ¡Gigamaximar!
                  </button>
                )}
                {(activePokemon.holdItem === 'Prisma Rojo' || activePokemon.holdItem === 'Prisma Azul') && !battlePrimalUsed && !activePokemon.megaEvolved && !activePokemon.gmaxEvolved && PRIMAL_CAPABLE_IDS.has(activePokemon.id) && (
                  <button
                    className="cta"
                    onClick={() => primalEvolveActive()}
                    type="button"
                    style={{ marginTop: '8px', width: '100%', background: '#ff8a33' }}
                  >
                    🔮 ¡Primal Reversion!
                  </button>
                )}
                {(activePokemon.holdItem === 'Diamansfera' || activePokemon.holdItem === 'Lustresfera' || activePokemon.holdItem === 'Griseosfera') && !battleOriginUsed && !activePokemon.megaEvolved && !activePokemon.gmaxEvolved && !activePokemon.primalEvolved && !activePokemon.originEvolved && ORIGIN_CAPABLE_IDS.has(activePokemon.id) && (
                  <button
                    className="cta"
                    onClick={() => originEvolveActive()}
                    type="button"
                    style={{ marginTop: '8px', width: '100%', background: '#4d9bff' }}
                  >
                    🌀 ¡Forma Origen!
                  </button>
                )}
              </div>
            )}

            {apiError && <p className="error-line">{apiError}</p>}
          </article>

          <article className="panel items-panel">
            <h2>{t('route.items')}</h2>
            <div className="items-grid">
              {inventorySlotEntries.length > 0 ? (
                inventorySlotEntries.map((entry) => {
                  const itemIcon = ITEM_SPRITES[entry.name]
                  const isHoldable = !!HOLDABLE_ITEMS[entry.name]
                  if (isHoldable) {
                    const holdableIdx = inventory.indexOf(entry.name)
                    return (
                      <button
                        key={entry.name}
                        className="item-slot filled item-button"
                        type="button"
                        onClick={() => setEquipModal({ itemName: entry.name, itemIndex: holdableIdx })}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderLeft: '3px solid #b8a1ff' }}
                      >
                        {itemIcon && (
                          <img
                            src={itemIcon}
                            alt={entry.name}
                            style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                          />
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <strong style={{ color: '#cba3ff' }}>{itemLocalizedName(entry.name)}</strong>
                          <span style={{ fontSize: '0.6rem', color: '#7c3aed' }}>x{entry.count} · equipar</span>
                        </div>
                      </button>
                    )
                  }
                  return (
                    <ThemedTooltip key={entry.name} content={entry.description}>
                      <button
                        className="item-slot filled item-button"
                        type="button"
                        onClick={() => consumeInventoryItem(entry.name)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', width: '100%' }}
                      >
                        {itemIcon && (
                          <img
                            src={itemIcon}
                            alt={entry.name}
                            style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                          />
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <strong>{itemLocalizedName(entry.name)}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#9b98cf' }}>x{entry.count}</span>
                        </div>
                      </button>
                    </ThemedTooltip>
                  )
                })
              ) : (
                <div className="item-slot empty">No items</div>
              )}
            </div>

            {modifier && (
              <div className="modifier-box">
                <p className="small-tag">Modifier</p>
                <strong>{runModName(modifier.id ?? '')}</strong>
                <p className="muted">{runModDesc(modifier.id ?? '')}</p>
              </div>
            )}

            <div className={`log-mini${battleLogExpanded ? ' expanded' : ''}`}>
              <div className="log-mini-header">
                <p className="small-tag">Battle log</p>
                <button
                  className="log-expand-btn"
                  type="button"
                  onClick={() => setBattleLogExpanded(prev => !prev)}
                  aria-expanded={battleLogExpanded}
                  title={battleLogExpanded ? t('battle.logCollapse') : t('battle.logExpand')}
                >
                  {battleLogExpanded ? '⤡' : '⤢'}
                </button>
              </div>
              <ul>
                {battleLog.map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ul>
              {secretUnlocked && (
                <button
                  className="tiny-btn"
                  type="button"
                  onClick={() => setSecretAddOpen(true)}
                  style={{ width: '100%', marginTop: '0.5rem', color: '#ffcb05', background: '#2a2a55', border: '1px solid #ffcb05', fontWeight: 'bold' }}
                >
                  ➕ Añadir Pokémon
                </button>
              )}
            </div>
          </article>
        </section>
      )}

      {screen === 'victory' && (
        <section className="panel end-panel">
          <h2>{t('victory.header')}</h2>
          <p>
            {coopMode
              ? t('victory.completedCoop', { n: difficultyNodeCounts[coopDiff] || 10 })
              : difficulty === 'branch'
                ? (language === 'en' ? 'You conquered 8 branching paths and got all 8 medals!' : '¡Conquistaste 8 mapas de rutas y conseguiste las 8 medallas!')
                : t('victory.completedMedium', { n: difficultyNodeCounts[difficulty] })}
          </p>

          {victoryUnlocks && (
            <div
              className="victory-unlocks-box"
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                padding: '1.25rem',
                margin: '1.5rem 0',
                textAlign: 'left'
              }}
            >
              <h3 style={{ color: '#34d399', margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>
                {t('victory.progress')}
              </h3>
              {victoryUnlocks.nextGenNumber ? (
                <p style={{ margin: '6px 0', color: '#f8fafc', fontSize: '0.95rem' }}>
                  🔓 <strong>¡NUEVA GENERACIÓN DESBLOQUEADA!</strong> Gen {victoryUnlocks.nextGenNumber} ({victoryUnlocks.nextGenName}) ya está disponible para jugar.
                </p>
              ) : difficulty === 'easy' && currentRunGen < 9 && !progression.completedMedium.includes(currentRunGen) ? (
                <p style={{ margin: '6px 0', color: '#9b98cf', fontSize: '0.85rem' }}>
                  💡 <em>Consejo: Completa la Gen {currentRunGen} ({victoryUnlocks.genName}) en dificultad Intermedia para desbloquear la Gen {currentRunGen + 1}.</em>
                </p>
              ) : null}

              {victoryUnlocks.unlockedHard && (
                <p style={{ margin: '6px 0', color: '#fb923c', fontSize: '0.95rem' }}>
                  🔥 <strong>¡MODO DÍFICIL DESBLOQUEADO!</strong> Ahora puedes desafiar la Gen {currentRunGen} ({victoryUnlocks.genName}) en dificultad Difícil (25 rutas).
                </p>
              )}
              {victoryUnlocks.unlockedInfinite && (
                <p style={{ margin: '6px 0', color: '#cba3ff', fontSize: '0.95rem' }}>
                  {t('victory.infiniteUnlocked2', { gen: currentRunGen, region: victoryUnlocks.genName })}
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button className="cta" onClick={resetToSetup} type="button">
              Iniciar otra partida
            </button>
            {!isDailyRunRef.current && (
              <button className="cta" onClick={() => { playClick(); void restartRun() }} type="button" style={{ background: '#37d16b', color: '#12122b' }}>
                {t('end.restartRun')}
              </button>
            )}
          </div>
        </section>
      )}

      {screen === 'defeat' && (
        <section className="panel end-panel defeat-panel">
          <div className="defeat-header">
            <h2 className="defeat-title">{voluntaryRunEnd ? t('defeat.ended') : t('defeat.lost')}</h2>
            <p className="muted">{voluntaryRunEnd ? t('defeat.endedMsg') : t('defeat.lostMsg')}</p>
          </div>

          {coopSessionEndedMsg && (
            <p style={{ margin: '0 0 1rem 0', padding: '0.6rem 0.9rem', borderRadius: '8px', background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.4)', color: '#ffcb05', fontSize: '0.85rem' }}>
              🤝 {coopSessionEndedMsg}
            </p>
          )}

          {coopRestartBlockedMsg && (
            <p style={{ margin: '0 0 1rem 0', padding: '0.6rem 0.9rem', borderRadius: '8px', background: 'rgba(255,138,128,0.12)', border: '1px solid rgba(255,138,128,0.4)', color: '#ff8a80', fontSize: '0.85rem' }}>
              ⏳ {coopRestartBlockedMsg}
            </p>
          )}

          {defeatSummary && (
            <div className="defeat-details-grid" style={{ marginTop: '1rem', textAlign: 'left' }}>
              <div className="defeat-box" style={{ marginBottom: '1.5rem' }}>
                <h3 className="section-subtitle" style={{ fontSize: '1rem', color: '#ff8a80' }}>{t('defeat.fallenTeam')}</h3>
                <div className="fainted-team-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {defeatSummary.finalTeam.map((pkmn, idx) => (
                    <div key={`${pkmn.id}-${idx}`} className="fainted-card" style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '48px', height: '48px', opacity: 0.6, filter: 'grayscale(100%)' }} />
                      <strong style={{ display: 'block', fontSize: '0.85rem' }}>{pkmn.name}<StatusBadge status={pkmn.status} compact /></strong>
                      <span className="muted" style={{ fontSize: '0.75rem' }}>Nv. {pkmn.level}</span>
                    </div>
                  ))}
                </div>
              </div>

              {defeatSummary.enemy && (
                <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {t('defeat.fellTo', { name: `${defeatSummary.enemy.name} (Nv. ${defeatSummary.enemy.level})`, node: defeatSummary.lastNodeLabel ?? t('defeat.nodeCombat') })}
                </p>
              )}

              <div className="log-mini defeat-log" style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                <p className="small-tag">{t('defeat.lastActions')}</p>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                  {defeatSummary.battleLog.slice(0, 5).map((line, index) => (
                    <li key={`defeat-log-${index}`}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {difficulty === 'infinite' && (
            <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid #3f3f6e', fontSize: '0.85rem' }}>
              {scoreSubmitState === 'submitting' && <span style={{ color: '#9b98cf' }}>⏳ Enviando puntuación al ranking mundial...</span>}
              {scoreSubmitState === 'submitted' && (
                <span style={{ color: '#37d16b' }}>
                  ✅ ¡Puntuación registrada en el ranking mundial!
                  {submitIsNewBest === true && <strong style={{ color: '#ffcb05' }}> ¡Nuevo récord personal en esta generación!</strong>}
                  {submitIsNewBest === false && ' Se conserva tu mejor marca de esta generación.'}
                </span>
              )}
              {scoreSubmitState === 'error' && <span style={{ color: '#ff8a80' }}>⚠️ No se pudo enviar la puntuación al ranking.</span>}
              {scoreSubmitState === 'loginRequired' && (
                <span style={{ color: '#ffcb05' }}>
                  🔑 ¡Llegaste al Nodo #{pendingScoreRef.current?.node}! Inicia sesión o crea una cuenta para registrar tu puntuación en el ranking mundial.
                </span>
              )}
              {scoreSubmitState === 'disabled' && <span style={{ color: '#9b98cf' }}>⚙️ Ranking no configurado. Añade las variables de entorno de Supabase para habilitarlo.</span>}
              <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                <button className="tiny-btn" type="button" onClick={openLeaderboard}>
                  🌍 Ver ranking mundial
                </button>
              </div>
            </div>
          )}

          {coopRestartBlockedMsg && (
            <p style={{ margin: '0 0 1rem 0', padding: '0.6rem 0.9rem', borderRadius: '8px', background: 'rgba(255,138,128,0.12)', border: '1px solid rgba(255,138,128,0.4)', color: '#ff8a80', fontSize: '0.85rem' }}>
              ⏳ {coopRestartBlockedMsg}
            </p>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button className="cta" onClick={resetToSetup} type="button">
              {t('end.backToMainMenu')}
            </button>
            {!isDailyRunRef.current && (
              <button className="cta" onClick={() => { playClick(); void restartRun() }} type="button" style={{ background: '#37d16b', color: '#12122b' }}>
                {t('end.restartRun')}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Coop: entrando a la aventura (auto-inicio al unirse) */}
      {coopStarting && (
        <div className="modal-backdrop" style={{ zIndex: 10001 }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎒</div>
            <h3 style={{ color: '#37d16b', margin: '0 0 0.5rem' }}>{t('coop.entering')}</h3>
            <div className="spin-anim" style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>⏳</div>
            <p style={{ color: '#9b98cf', margin: 0, fontSize: '0.85rem' }}>
              Generando tu run cooperativa...
            </p>
          </div>
        </div>
      )}

      {/* Coop: esperando al compañero */}
      {coopWaiting && (
        <div className="modal-backdrop" style={{ zIndex: 10000 }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🤝</div>
            <h3 style={{ color: '#37d16b', margin: '0 0 0.5rem' }}>{t('coop.waiting')}</h3>
            <p style={{ color: '#9b98cf', margin: '0 0 1rem', fontSize: '0.9rem' }}>
              Completaste el nodo {coopWaitingNode}. Tu compañero aún no termina su parte.
            </p>
            <div className="spin-anim" style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⏳</div>
            <p style={{ color: '#7d7ab5', fontSize: '0.75rem' }}>Ambos deben completar cada nodo para avanzar.</p>
            <button className="tiny-btn" type="button" onClick={abandonCoopRun} style={{ color: '#ff8a80', marginTop: '0.5rem' }}>
              ✕ Abandonar sesión
            </button>
          </div>
        </div>
      )}

      {/* Achievement Popup */}
      {newAchievement && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', left: '20px', zIndex: 9999, background: '#1c1c3a', border: '3px solid #ffcb05', borderRadius: '6px', padding: '1rem 1.5rem', boxShadow: '4px 4px 0 0 rgba(0,0,0,0.6)', animation: 'slideInRight 0.5s ease', maxWidth: '300px', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '2rem' }}>{newAchievement.icon}</span>
            <div>
              <div style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>¡Logro Desbloqueado!</div>
              <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem' }}>{newAchievement.name}</div>
              <div style={{ color: '#9b98cf', fontSize: '0.8rem' }}>{newAchievement.desc}</div>
              <div style={{ color: '#ffcb05', fontSize: '0.8rem', fontWeight: 'bold', marginTop: '0.25rem' }}>🪙 +{newAchievement.reward} — reclama en la pestaña de Logros</div>
            </div>
          </div>
          <button onClick={handleAchievementDismiss} style={{ position: 'absolute', top: '4px', right: '8px', background: 'none', border: 'none', color: '#7d7ab5', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
      )}

      {dexToast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9998, background: '#1c1c3a', border: '2px solid #4d9bff', borderRadius: '6px', padding: '0.7rem 1.1rem', boxShadow: '4px 4px 0 0 rgba(0,0,0,0.6)', maxWidth: '320px', color: '#f3f1ff', fontSize: '0.9rem', animation: 'slideInRight 0.5s ease' }}>
          {dexToast}
        </div>
      )}

      {/* Random Event Modal */}
      {activeRandomEvent && (
        <div className="modal-backdrop" onClick={() => { playClick(); handleRandomEventChoice() }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{activeRandomEvent.icon}</div>
            <h3 style={{ color: '#ffcb05', margin: '0.5rem 0' }}>{runEventTitle(activeRandomEvent.id)}</h3>
            <p style={{ color: '#d9d6f2', marginBottom: '1.5rem' }}>{runEventDesc(activeRandomEvent.id)}</p>
            <button className="cta" onClick={() => { playClick(); handleRandomEventChoice() }} style={{ background: '#ffcb05', color: '#000' }}>{t('route.continue')}</button>
          </div>
        </div>
      )}

      {/* Trader Modal */}
      {traderModal && (
        <div className="modal-backdrop" onClick={() => setTraderModal(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <h3 style={{ color: '#ffcb05', textAlign: 'center', marginBottom: '0.5rem' }}>🎭 Comerciante Misterioso</h3>
            <p style={{ color: '#9b98cf', textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>Elige un Pokémon para intercambiar por uno nuevo de la misma generación.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {team.map((p, i) => (
                <button key={i} onClick={() => { playClick(); handleTraderChoice(i) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: i === activeIndex ? 'rgba(56,189,248,0.15)' : 'rgba(30,41,59,0.6)', border: `1px solid ${i === activeIndex ? '#4d9bff' : '#3f3f6e'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'left', color: '#f3f1ff' }}>
                  <img src={p.sprite} alt={p.name} style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{p.name} {p.shiny ? '✨' : ''}<StatusBadge status={p.status} compact /></div>
                    <div style={{ color: '#9b98cf', fontSize: '0.75rem' }}>Nv.{p.level} — HP:{p.hp}/{p.maxHp} — ATK:{p.attack} DEF:{p.defense} SPD:{p.speed}</div>
                  </div>
                </button>
              ))}
            </div>
            <button className="cta" onClick={() => { playClick(); setTraderModal(false); setBattleLog(prev => [t('b.tradeRejected'), ...prev].slice(0, 15)) }} style={{ marginTop: '1rem', background: '#7d7ab5', width: '100%' }}>Rechazar</button>
          </div>
        </div>
      )}

      {/* Mercader Misterioso Modal */}
      {merchantItems && (
        <div className="modal-backdrop" onClick={() => setMerchantItems(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.5rem' }}>
            <h3 style={{ color: '#ffcb05', margin: '0 0 0.5rem' }}>🧳 Mercader Misterioso</h3>
            <p style={{ color: '#9b98cf', fontSize: '0.85rem', marginBottom: '1rem' }}>El mercader te ofrece objetos evolutivos:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {merchantItems.map(item => {
                const canBuy = money >= item.price
                return (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(30,41,59,0.6)', border: '1px solid #3f3f6e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {ITEM_SPRITES[item.name] && <img src={ITEM_SPRITES[item.name]} alt={item.name} style={{ width: '32px', height: '32px' }} onError={fallbackSprite} />}
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{itemLocalizedName(item.name)}</div>
                        <div style={{ color: '#9b98cf', fontSize: '0.75rem' }}>${item.price}</div>
                      </div>
                    </div>
                    <button className="cta" onClick={() => { if (money >= item.price) { setMoney(prev => prev - item.price); setInventory(prev => [...prev, item.name]); setBattleLog(prev => [`🧳 Compraste ${itemLocalizedName(item.name)} por $${item.price}.`, ...prev].slice(0, 15)) } }} disabled={!canBuy} style={{ fontSize: '0.8rem', padding: '4px 14px', background: canBuy ? '#ffcb05' : '#475569', color: '#000' }}>
                      {canBuy ? 'Comprar' : 'No alcanza'}
                    </button>
                  </div>
                )
              })}
            </div>
            <button className="cta" onClick={() => setMerchantItems(null)} style={{ marginTop: '1rem', background: '#7d7ab5', width: '100%' }}>Salir</button>
          </div>
        </div>
      )}

      {/* Selección de inicial en Modo Original */}
      {showStarterSelect && (
        <div className="modal-backdrop" onClick={() => { playClick(); setShowStarterSelect(false); setScreen('setup') }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', padding: '1.5rem', animation: 'casinoSlideUp 0.35s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, color: '#4d9bff' }}>🕹️ Modo Original — Elige tu inicial</h2>
              <button className="tiny-btn" type="button" onClick={() => { playClick(); setShowStarterSelect(false); setScreen('setup') }} style={{ color: '#ff8a80' }}>{t('common.close')}</button>
            </div>
            <p style={{ color: '#9b98cf', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              {language === 'en'
                ? 'Pick the Pokémon you will start with. Defeat 8 gym leaders to earn medals, then Victory Road and the League are mandatory.'
                : 'Elige el Pokémon con el que empezarás. Derrota a 8 líderes de gimnasio para ganar medallas, y después la Calle Victoria y la Liga son obligatorias.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {starterOptions.map(starter => (
                <button
                  key={starter.id}
                  type="button"
                  onClick={() => { playClick(); confirmOriginalStarter(starter) }}
                  onMouseEnter={playHover}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    padding: '10px', borderRadius: '12px', cursor: 'pointer',
                    background: 'rgba(77, 155, 255, 0.1)', border: '2px solid rgba(77, 155, 255, 0.5)',
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(77, 155, 255, 0.25)' }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(77, 155, 255, 0.1)' }}
                >
                  <img src={starter.sprite} alt={starter.name} onError={fallbackSprite} style={{ width: '72px', height: '72px', imageRendering: 'pixelated' }} />
                  <strong style={{ textTransform: 'capitalize', color: '#f3f1ff', fontSize: '0.85rem' }}>{starter.name}</strong>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {starter.types?.map(tp => (
                      <span key={tp} style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '999px', background: `${TYPE_COLORS[tp] ?? '#475569'}`, color: '#fff' }}>{tp}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* League Offer Modal */}
      {leagueOffer && (
        <div className="modal-backdrop" onClick={() => { setLeagueOffer(false); finalizeRunVictory() }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏆</div>
            <h3 style={{ color: '#ffcb05', margin: '0.5rem 0' }}>¡Campeón de la Liga!</h3>
            <p style={{ color: '#d9d6f2', marginBottom: '1rem' }}>
              Has derrotado al líder de gimnasio. ¿Deseas entrar a la <strong style={{ color: '#4d9bff' }}>Liga Pokémon</strong>?
            </p>
            <p style={{ color: '#9b98cf', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Deberás elegir entre 1 y 6 Pokémon de tu equipo y PC. Una vez dentro no podrás cambiarlos.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="cta" onClick={() => { setLeagueOffer(false); setTempLeagueTeam([]); setLeagueTeamSelection(true) }} style={{ background: '#4d9bff', color: '#000' }}>
                ¡Sí, a la Liga!
              </button>
              <button className="cta" onClick={() => { setLeagueOffer(false); finalizeRunVictory() }} style={{ background: '#7d7ab5' }}>
                No, terminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* League Team Selection Modal */}
      {leagueTeamSelection && (() => {
        // Identidad única por Pokémon (equipo y PC pueden tener duplicados de
        // la misma especie, así que no se puede usar id+hp).
        const leaguePool = [
          ...team.map((p, i) => ({ key: `team-${i}`, pkmn: p, isTeam: true })),
          ...pcStorage.map((p, i) => ({ key: `pc-${i}`, pkmn: p, isTeam: false })),
        ]
        const selectedKeys = new Set(tempLeagueTeam)
        const lastSelectedKey = tempLeagueTeam[tempLeagueTeam.length - 1]
        const lastSelected = lastSelectedKey
          ? leaguePool.find(({ key }) => key === lastSelectedKey)
          : undefined
        return (
          <div className="modal-backdrop" onClick={() => setLeagueTeamSelection(false)}>
            <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '880px', maxHeight: '86vh', overflow: 'auto', padding: '1.5rem' }}>
              <h3 style={{ color: '#4d9bff', margin: '0 0 0.5rem' }}>🏆 Equipo para la Liga</h3>
              <p style={{ color: '#9b98cf', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Selecciona entre 1 y 6 Pokémon de tu equipo y PC ({tempLeagueTeam.length}/6)
              </p>
              <p style={{ color: '#fbbf24', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                ⚠️ Los Pokémon que NO selecciones se eliminarán al comenzar la Calle Victoria.
              </p>
              {tempLeagueTeam.length >= 1 && (
                <button className="cta" onClick={() => {
                  setLeagueTeamSelection(false)
                  // Los elegidos forman el equipo de la Liga. El resto de Pokémon
                  // que tenías antes de la Liga se ELIMINAN: el PC de la Liga queda
                  // vacío, así lo que captures después (p. ej. el legendario) nunca
                  // se pierde en un PC al que no se pueda acceder.
                  const healed = leaguePool
                    .filter(({ key }) => selectedKeys.has(key))
                    .map(({ pkmn }) => ({ ...pkmn, hp: pkmn.maxHp, status: undefined }))
                  const unselectedCount = leaguePool.filter(({ key }) => !selectedKeys.has(key)).length
                  const maxLvl = Math.max(...healed.map(p => p.level)) + 2
                  // Calle Victoria: 4 entrenadores → tienda → 4 entrenadores → tienda.
                  const victoryRoute: RouteNode[] = []
                  for (let i = 0; i < 4; i++) victoryRoute.push({ id: 2000 + i, type: 'elite', label: `Calle Victoria #${i + 1}`, done: false })
                  victoryRoute.push({ id: 2010, type: 'shop', label: `Tienda`, done: false })
                  for (let i = 0; i < 4; i++) victoryRoute.push({ id: 2020 + i, type: 'elite', label: `Calle Victoria #${5 + i}`, done: false })
                  victoryRoute.push({ id: 2030, type: 'shop', label: `Tienda`, done: false })
                  setTeam(healed)
                  setPcStorage([])
                  setRoute(victoryRoute)
                  setRouteIndex(0)
                  setScreen('route')
                  if (unselectedCount > 0) {
                    setBattleLog(prev => [t('b.leagueUnselectedReleased', { n: unselectedCount }), ...prev].slice(0, 15))
                  }
                  setBattleLog(prev => [t('b.victoryRoadWelcome', { lvl: maxLvl }), ...prev].slice(0, 15))
                }} style={{ background: '#4d9bff', color: '#000', width: '100%', marginBottom: '1rem' }}>
                  🗻 ¡Comenzar la Calle Victoria!
                </button>
              )}
              <div className="league-select-layout">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '6px', alignContent: 'start' }}>
                  {leaguePool.map(({ key, pkmn, isTeam }) => {
                    const selected = selectedKeys.has(key)
                    const isLastSelected = key === lastSelectedKey
                    return (
                      <div key={key}
                        onClick={() => {
                          if (selected) {
                            setTempLeagueTeam(prev => prev.filter(k => k !== key))
                          } else if (tempLeagueTeam.length < 6) {
                            setTempLeagueTeam(prev => [...prev, key])
                          }
                        }}
                        style={{
                          padding: '6px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer',
                          background: isLastSelected ? 'rgba(250,204,21,0.14)' : selected ? 'rgba(56,189,248,0.2)' : 'rgba(30,41,59,0.6)',
                          border: isLastSelected ? '2px solid #ffcb05' : selected ? '2px solid #4d9bff' : '1px solid #3f3f6e',
                          opacity: !selected && tempLeagueTeam.length >= 6 ? 0.4 : 1
                        }}
                      >
                        <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} />
                        <div style={{ fontSize: '0.7rem', textTransform: 'capitalize', color: isLastSelected ? '#ffcb05' : selected ? '#4d9bff' : '#f3f1ff' }}>{pkmn.name}</div>
                        <div style={{ fontSize: '0.6rem', color: isTeam ? '#7ceb95' : '#9b98cf' }}>Nv.{pkmn.level}</div>
                      </div>
                    )
                  })}
                </div>

                <aside className="league-select-detail">
                  {lastSelected ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.6rem' }}>
                        <img src={lastSelected.pkmn.sprite} alt={lastSelected.pkmn.name} onError={fallbackSprite} style={{ width: '64px', height: '64px', imageRendering: 'pixelated' }} />
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ display: 'block', color: '#f3f1ff', fontSize: '0.95rem', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lastSelected.pkmn.name}{lastSelected.pkmn.shiny ? ' ✨' : ''}
                          </strong>
                          <span style={{ color: '#9b98cf', fontSize: '0.75rem' }}>Nv. {lastSelected.pkmn.level} · {lastSelected.isTeam ? (language === 'en' ? 'Team' : 'Equipo') : 'PC'}</span>
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {lastSelected.pkmn.types?.map(type => (
                              <span key={type} style={{ background: TYPE_COLORS[type] ?? '#475569', color: '#fff', fontSize: '0.6rem', padding: '1px 6px', borderRadius: '4px', textTransform: 'capitalize' }}>{type}</span>
                            ))}
                          </div>
                          {lastSelected.pkmn.ability && (
                            <div style={{ color: '#9da6ff', fontSize: '0.68rem', marginTop: '3px' }}>
                              {language === 'en' ? 'Ability' : 'Habilidad'}: {abilityName(lastSelected.pkmn.ability, language)}
                            </div>
                          )}
                        </div>
                      </div>

                      <h4 style={{ color: '#4d9bff', margin: '0 0 0.35rem', fontSize: '0.8rem' }}>{language === 'en' ? 'Stats' : 'Estadísticas'}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.2rem 0.6rem', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                        {([
                          ['HP', lastSelected.pkmn.maxHp, '#7ceb95'],
                          [language === 'en' ? 'Attack' : 'Ataque', lastSelected.pkmn.attack, '#ff8a80'],
                          [language === 'en' ? 'Defense' : 'Defensa', lastSelected.pkmn.defense, '#fdba74'],
                          [language === 'en' ? 'Sp. Atk' : 'At. Esp.', lastSelected.pkmn.spAttack, '#7dd3fc'],
                          [language === 'en' ? 'Sp. Def' : 'Def. Esp.', lastSelected.pkmn.spDefense, '#c4b5fd'],
                          [language === 'en' ? 'Speed' : 'Velocidad', lastSelected.pkmn.speed, '#fde047'],
                        ] as const).map(([label, value, color]) => (
                          <Fragment key={label}>
                            <span style={{ color: '#9b98cf' }}>{label}</span>
                            <strong style={{ color, textAlign: 'right' }}>{value}</strong>
                          </Fragment>
                        ))}
                      </div>

                      <h4 style={{ color: '#4d9bff', margin: '0 0 0.35rem', fontSize: '0.8rem' }}>{language === 'en' ? 'Moves' : 'Ataques'}</h4>
                      {lastSelected.pkmn.moves.length === 0 ? (
                        <p style={{ color: '#7d7ab5', fontSize: '0.75rem', margin: 0 }}>{language === 'en' ? 'No moves.' : 'Sin ataques.'}</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {lastSelected.pkmn.moves.map(move => (
                            <div key={move.name} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid #3f3f6e', borderRadius: '6px', padding: '5px 6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                <span style={{ color: '#f3f1ff', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{moveName(move)}</span>
                                <span style={{ background: TYPE_COLORS[move.type] ?? '#475569', color: '#fff', fontSize: '0.58rem', fontWeight: 'bold', padding: '1px 5px', borderRadius: '3px', textTransform: 'capitalize', flexShrink: 0 }}>{move.type}</span>
                              </div>
                              <div style={{ color: '#9b98cf', fontSize: '0.65rem', marginTop: '2px' }}>
                                PWR {move.power || '—'} · ACC {move.accuracy ?? '—'}
                              </div>
                              {moveEffectSummary(move) && (
                                <div style={{ color: '#7dd3fc', fontSize: '0.62rem', marginTop: '2px' }}>{moveEffectSummary(move)}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p style={{ color: '#7d7ab5', fontSize: '0.8rem', margin: 0, textAlign: 'center', padding: '1rem 0' }}>
                      {language === 'en' ? 'Select a Pokémon to see its stats and moves.' : 'Selecciona un Pokémon para ver sus estadísticas y ataques.'}
                    </p>
                  )}
                </aside>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Achievements Modal */}
      {showAchievements && (
        <div className="modal-backdrop" onClick={() => setShowAchievements(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <h2 style={{ color: '#4d9bff', textAlign: 'center', marginBottom: '0.25rem' }}>{t('ach.title')} ({Object.values(achievements).filter(a => a.unlocked).length}/{ACHIEVEMENTS.length})</h2>
            <button
              type="button"
              onClick={() => { playClick(); claimAllAchievements() }}
              disabled={!ACHIEVEMENTS.some(a => achievements[a.id]?.unlocked && !achievements[a.id]?.claimed)}
              style={{ display: 'block', margin: '0 auto 0.75rem', background: '#ffcb05', color: '#000', border: 'none', borderRadius: '4px', padding: '0.4rem 0.75rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', opacity: ACHIEVEMENTS.some(a => achievements[a.id]?.unlocked && !achievements[a.id]?.claimed) ? 1 : 0.5 }}
            >
              {t('ach.collectAll')}
            </button>
            <div style={{ color: '#ffcb05', textAlign: 'center', marginBottom: '1rem', fontSize: '0.9rem' }}>
              🪙 {ACHIEVEMENTS.filter(a => achievements[a.id]?.unlocked && !achievements[a.id]?.claimed).reduce((sum, a) => sum + a.reward, 0)} PokéCoins por reclamar
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {ACHIEVEMENTS.map(a => {
                const unlocked = achievements[a.id]?.unlocked
                const claimed = achievements[a.id]?.claimed
                return (
                  <div key={a.id} style={{ background: unlocked ? 'rgba(250,204,21,0.1)' : 'rgba(30,41,59,0.5)', border: `1px solid ${unlocked ? (claimed ? '#37d16b' : '#ffcb05') : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>{a.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: unlocked ? '#ffcb05' : '#9b98cf', fontWeight: 'bold', fontSize: '0.85rem' }}>{achName(a.id)}</div>
                        <div style={{ color: '#7d7ab5', fontSize: '0.75rem' }}>{achDesc(a.id)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ color: unlocked ? '#ffcb05' : '#7d7ab5', fontSize: '0.8rem', fontWeight: 'bold' }}>🪙 +{a.reward}</span>
                      {!unlocked ? (
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>🔒 {language === 'en' ? 'Locked' : 'Bloqueado'}</span>
                      ) : claimed ? (
                        <span style={{ color: '#37d16b', fontSize: '0.75rem', fontWeight: 'bold' }}>✓ {language === 'en' ? 'Claimed' : 'Reclamado'}</span>
                      ) : (
                        <button
                          onClick={() => { playClick(); claimAchievement(a.id) }}
                          style={{ background: '#ffcb05', color: '#000', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
                        >
                          Reclamar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button className="cta" onClick={() => setShowAchievements(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de historial de partidas */}
      {showMatchHistory && (
        <div className="modal-backdrop" onClick={() => setShowMatchHistory(false)}>
          <div
            className="panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '720px',
              width: 'min(94vw, 720px)',
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: 0,
            }}
          >
            <div style={{ position: 'sticky', top: 0, zIndex: 5, padding: '1.1rem 1.5rem 1rem', background: 'linear-gradient(135deg, rgba(26,18,55,0.97), rgba(20,12,45,0.97))', borderBottom: '1px solid rgba(155,152,207,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h2 style={{ color: '#4d9bff', margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🕒 {language === 'en' ? 'Match History' : 'Historial de partidas'}
                </h2>
                <button
                  className="tiny-btn"
                  type="button"
                  onClick={() => setShowMatchHistory(false)}
                  title={t('common.close')}
                  style={{ color: '#9b98cf', borderColor: 'rgba(155,152,207,0.35)', padding: '2px 8px' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: language === 'en' ? 'All' : 'Todas', color: '#9b98cf' },
                  { key: 'win', label: `🏆 ${language === 'en' ? 'Wins' : 'Victorias'}`, color: '#37d16b' },
                  { key: 'loss', label: `💀 ${language === 'en' ? 'Losses' : 'Derrotas'}`, color: '#ff6b5e' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => { playClick(); setMatchFilter(f.key as 'all' | 'win' | 'loss') }}
                    style={{
                      background: matchFilter === f.key ? `${f.color}2b` : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${matchFilter === f.key ? f.color : 'rgba(155,152,207,0.3)'}`,
                      color: matchFilter === f.key ? f.color : '#9b98cf',
                      borderRadius: '999px',
                      padding: '3px 12px',
                      fontSize: '0.72rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '1.1rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
                {[
                  { label: language === 'en' ? 'Matches' : 'Partidas', value: String(matchHistory.length), color: '#f3f1ff' },
                  { label: 'W', value: String(matchHistory.filter((m) => m.result === 'win').length), color: '#37d16b' },
                  { label: 'L', value: String(matchHistory.filter((m) => m.result === 'loss').length), color: '#ff6b5e' },
                  { label: 'WR', value: `${matchHistory.length ? Math.round((matchHistory.filter((m) => m.result === 'win').length / matchHistory.length) * 100) : 0}%`, color: '#ffcb05' },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                    <span style={{ color: s.color, fontSize: '1.05rem', fontWeight: 'bold', lineHeight: 1 }}>{s.value}</span>
                    <span style={{ color: '#7d7ab5', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {(() => {
                const filtered = matchHistory.filter((m) => matchFilter === 'all' || m.result === matchFilter)
                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', color: '#9b98cf', padding: '2.5rem 1rem' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>{matchHistory.length === 0 ? '🎮' : '🔍'}</div>
                      <div>
                        {matchHistory.length === 0
                          ? (language === 'en' ? 'No finished matches yet. Play a run to see it here.' : 'Aún no hay partidas terminadas. Juega una partida para verla aquí.')
                          : (language === 'en' ? 'No matches in this filter.' : 'No hay partidas en este filtro.')}
                      </div>
                    </div>
                  )
                }
                return filtered.map((m, idx) => {
                  const win = m.result === 'win'
                  const accent = win ? '#37d16b' : '#ff6b5e'
                  return (
                    <div
                      key={`${m.date}-${idx}`}
                      style={{
                        position: 'relative',
                        borderRadius: '12px',
                        background: win
                          ? 'linear-gradient(135deg, rgba(16,185,129,0.13), rgba(15,23,42,0.55))'
                          : 'linear-gradient(135deg, rgba(238,59,47,0.13), rgba(15,23,42,0.55))',
                        border: `1px solid ${win ? 'rgba(16,185,129,0.45)' : 'rgba(238,59,47,0.45)'}`,
                        padding: '0.85rem 1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{win ? '🏆' : '💀'}</span>
                          <div>
                            <div style={{ color: accent, fontWeight: 'bold', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {win ? (language === 'en' ? 'Victory' : 'Victoria') : (language === 'en' ? 'Defeat' : 'Derrota')}
                            </div>
                            <div style={{ color: '#7d7ab5', fontSize: '0.7rem' }}>
                              {new Date(m.date).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              {' · '}
                              {new Date(m.date).toLocaleTimeString(language === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ flexShrink: 0, background: 'rgba(255,203,5,0.1)', border: '1px solid rgba(255,203,5,0.35)', color: '#ffcb05', fontSize: '0.68rem', padding: '2px 9px', borderRadius: '999px', fontWeight: 'bold' }}>
                            🎮 {difficultyLabel(language, m.mode).title}
                          </span>
                          <span style={{ flexShrink: 0, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.35)', color: '#22d3ee', fontSize: '0.68rem', padding: '2px 9px', borderRadius: '999px', fontWeight: 'bold' }}>
                            🌍 {m.generation === 0 ? 'Random All-Stars' : `Gen ${m.generation}`}
                          </span>
                          <span style={{ flexShrink: 0, background: 'rgba(240,171,252,0.1)', border: '1px solid rgba(240,171,252,0.35)', color: '#f0abfc', fontSize: '0.68rem', padding: '2px 9px', borderRadius: '999px', fontWeight: 'bold' }}>
                            ⏱️ {formatDuration(m.duration)}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                        {m.team.map((p, i) => (
                          <div
                            key={i}
                            className="match-team-slot"
                            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(155,152,207,0.25)', borderRadius: '8px', padding: '5px 8px', minWidth: '62px' }}
                            onMouseEnter={() => setHoveredPoke({ idx, slot: i })}
                            onMouseLeave={() => setHoveredPoke(null)}
                          >
                            {hoveredPoke && hoveredPoke.idx === idx && hoveredPoke.slot === i && (
                              <span className="match-level-tooltip" style={{ opacity: 1, visibility: 'visible' }}>
                                {language === 'en' ? 'Lv.' : 'Nv.'} {typeof p.level === 'number' ? p.level : '?'}
                              </span>
                            )}
                            <img src={p.sprite} alt={p.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} />
                            <span style={{ color: '#d4d0ff', fontSize: '0.62rem', maxWidth: '88px', textAlign: 'center', overflowWrap: 'anywhere', lineHeight: 1.25 }}>{p.name}{p.shiny ? ' ✨' : ''}</span>
                          </div>
                        ))}
                      </div>
                      {m.challenges.length > 0 && (
                        <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {m.challenges.map((k, i) => (
                            <span key={i} style={{ flexShrink: 0, background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.35)', color: '#fcd34d', fontSize: '0.68rem', padding: '2px 8px', borderRadius: '999px', overflowWrap: 'anywhere' }}>
                              {t(`bch.${k}`)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal de reset (tecla R) */}
      {showResetModal && (
        <div className="modal-backdrop" style={{ cursor: 'wait' }}>
          <div
            style={{
              position: 'relative',
              width: 'min(90vw, 400px)',
              height: '270px',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '3px solid #f0abfc',
              boxShadow: '0 0 40px rgba(240,171,252,0.5)',
              animation: 'casinoFadeIn 0.2s ease',
            }}
          >
            <ResetLoadingScreen />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingBottom: '18px',
                pointerEvents: 'none',
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: '#f0abfc',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontFamily: 'var(--font-title)',
                }}
              >
                {t('run.restarting')}
              </p>
              <p style={{ margin: '4px 0 0', color: '#9b98cf', fontSize: '0.8rem' }}>
                Generando nuevos nodos
              </p>
            </div>
          </div>
        </div>
      )}

      {showMinigamePractice && (
        <Suspense fallback={<LazyLoadingPanel label={language === 'en' ? 'Loading minigames...' : 'Cargando minijuegos...'} />}>
          <MinigamePractice onClose={() => setShowMinigamePractice(false)} />
        </Suspense>
      )}

      {/* Run Stats on Victory */}
      {screen === 'victory' && (
        <div className="panel" style={{ maxWidth: '400px', margin: '0 auto', padding: '1rem' }}>
          <h3 style={{ color: '#4d9bff', textAlign: 'center', marginBottom: '0.75rem' }}>{t('runstats.title')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '1.1rem' }}>
            <div style={{ color: '#9b98cf' }}>{t('runstats.battlesWon')}</div><div style={{ color: '#37d16b', fontWeight: 'bold' }}>{runStats.battlesWon}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.time')}</div><div style={{ color: '#22d3ee', fontWeight: 'bold' }}>{formatDuration(Math.max(0, Math.round((Date.now() - runStartTimeRef.current) / 1000)))}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.damageDealt')}</div><div style={{ color: '#ff8a80', fontWeight: 'bold' }}>{runStats.totalDamageDealt}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.damageTaken')}</div><div style={{ color: '#fb923c', fontWeight: 'bold' }}>{runStats.totalDamageTaken}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.crits')}</div><div style={{ color: '#ffcb05', fontWeight: 'bold' }}>{runStats.critsLanded}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.turns')}</div><div style={{ color: '#d9d6f2', fontWeight: 'bold' }}>{runStats.totalTurns}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.captures')}</div><div style={{ color: '#22d3ee', fontWeight: 'bold' }}>{runStats.captures}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.moneyEarned')}</div><div style={{ color: '#ffcb05', fontWeight: 'bold' }}>${runStats.moneyEarned}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.moneySpent')}</div><div style={{ color: '#ff8a80', fontWeight: 'bold' }}>${runStats.moneySpent}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.coinsEarned')}</div><div style={{ color: '#ffcb05', fontWeight: 'bold' }}>+{(() => { const b = difficulty === 'easy' ? 10 : difficulty === 'hard' ? 20 : 15; const c = Object.entries(runChallenges).some(([k, v]) => v && k !== 'allShiny') ? 15 : 0; return b + c + (team.length <= 1 ? 5 : 0) })()}</div>
            {winStreak >= 2 && <><div style={{ color: '#9b98cf' }}>{t('runstats.streak')}</div><div style={{ color: '#ff8a33', fontWeight: 'bold' }}>{t('runstats.streakCount', { n: winStreak })}</div></>}
          </div>
        </div>
      )}

      {/* Run Stats on Defeat */}
      {screen === 'defeat' && (
        <div className="panel" style={{ maxWidth: '400px', margin: '0 auto', padding: '1rem' }}>
          <h3 style={{ color: '#ee3b2f', textAlign: 'center', marginBottom: '0.75rem' }}>{t('runstats.title')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '1.1rem' }}>
            <div style={{ color: '#9b98cf' }}>{t('runstats.battlesWon')}</div><div style={{ color: '#37d16b', fontWeight: 'bold' }}>{runStats.battlesWon}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.time')}</div><div style={{ color: '#22d3ee', fontWeight: 'bold' }}>{formatDuration(Math.max(0, Math.round((Date.now() - runStartTimeRef.current) / 1000)))}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.damageDealt')}</div><div style={{ color: '#ff8a80', fontWeight: 'bold' }}>{runStats.totalDamageDealt}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.damageTaken')}</div><div style={{ color: '#fb923c', fontWeight: 'bold' }}>{runStats.totalDamageTaken}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.turns')}</div><div style={{ color: '#d9d6f2', fontWeight: 'bold' }}>{runStats.totalTurns}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.captures')}</div><div style={{ color: '#22d3ee', fontWeight: 'bold' }}>{runStats.captures}</div>
            <div style={{ color: '#9b98cf' }}>{t('runstats.coinsEarned')}</div><div style={{ color: '#ffcb05', fontWeight: 'bold' }}>+5</div>
          </div>
        </div>
      )}

      {/* End Run Modal (modo Infinite) */}
      {showEndRunModal && (
        <div className="modal-backdrop" onClick={() => setShowEndRunModal(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏁</div>
            <h3 style={{ color: '#ffcb05', margin: '0.5rem 0' }}>¿Terminar la aventura?</h3>
            <p style={{ color: '#d9d6f2', marginBottom: '1.25rem' }}>
              Se registrará tu progreso en el ranking mundial (Nodo #{routeIndex + 1}).
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="cta" type="button" onClick={() => { playClick(); setShowEndRunModal(false) }} style={{ background: '#7d7ab5', marginTop: 0 }}>
                No, seguir
              </button>
              <button className="cta" type="button" onClick={handleEndRunConfirm} style={{ marginTop: 0 }}>
                Sí, terminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PvP 1vs1 Modal */}
      {showPvpModal && (
        <div className="modal-backdrop" onClick={() => setShowPvpModal(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}>
            <h2 style={{ color: '#cba3ff', textAlign: 'center', margin: '0 0 1rem' }}>{t('pvp.setupTitle')}</h2>

            {!authUser ? (
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(15,23,42,0.5)', borderRadius: '8px', border: '1px solid #3f3f6e' }}>
                <p style={{ color: '#9b98cf', marginBottom: '0.75rem' }}>{t('pvp.needLogin')}</p>
                <button className="cta" type="button" onClick={() => { setShowPvpModal(false); openLeaderboard() }} style={{ width: '100%' }}>
                  {t('pvp.loginOrCreate')}
                </button>
              </div>
            ) : !isPvpEnabled() ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px dashed #3f3f6e' }}>
                <p style={{ color: '#9b98cf', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('pvp.notConfigured')}</p>
                <p style={{ color: '#7d7ab5', fontSize: '0.8rem', margin: 0 }}>
                  Copia <strong style={{ color: '#cba3ff' }}>.env.example</strong> a <strong style={{ color: '#cba3ff' }}>.env</strong>, rellena tus credenciales de Supabase y ejecuta el esquema de <strong style={{ color: '#cba3ff' }}>supabase/schema.sql</strong>.
                </p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(15,23,42,0.5)', border: '1px solid #3f3f6e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#f3f1ff', fontSize: '0.9rem' }}>{t('pvp.yourTeam', { n: pvpTeam.length })}</strong>
                    <button className="tiny-btn" type="button" onClick={openPvpTeamBuilder}>{t('pvp.buildTeamBtn')}</button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    {[0, 1, 2].map((slot) => {
                      const team = pvpTeams[slot] ?? []
                      const active = slot === pvpActiveSlot
                      return (
                        <button
                          key={slot}
                          className="tiny-btn"
                          type="button"
                          onClick={() => selectPvpTeamSlot(slot)}
                          style={{
                            flex: 1,
                            background: active ? 'rgba(168,85,247,0.3)' : 'rgba(15,23,42,0.6)',
                            border: `1px solid ${active ? '#a855f7' : '#3f3f6e'}`,
                            color: active ? '#cba3ff' : '#9b98cf',
                            fontWeight: active ? 'bold' : 'normal'
                          }}
                        >
                          {t('pvp.teamX', { n: slot + 1 })}{team.length > 0 ? ` (${team.length})` : ` (${t('pvp.empty')})`}
                        </button>
                      )
                    })}
                  </div>
                  {pvpTeam.length === 0 ? (
                    <p style={{ margin: 0, color: '#7d7ab5', fontSize: '0.8rem' }}>{t('lb.noTeam')}</p>
                  ) : (
                    <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                      {pvpTeam.map((p, i) => (
                        <img key={i} src={p.sprite} alt={p.name} title={`${p.name}${p.shiny ? ' ✨' : ''}`} onError={fallbackSprite} style={{ width: '40px', height: '40px', imageRendering: 'pixelated', filter: p.shiny ? 'drop-shadow(0 0 5px #ffcb05)' : undefined }} />
                      ))}
                    </div>
                  )}
                </div>

                {pvpWaitingOpponent ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(168,85,247,0.08)', borderRadius: '8px', border: '1px solid #a855f7' }}>
                    <p style={{ color: '#cba3ff', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      {pvpSearching ? t('pvp.searching') : t('pvp.waitingRival')}
                    </p>
                    {pvpRoomCode && (
                      <p style={{ color: '#ffcb05', fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '0.2em', marginBottom: '0.5rem' }}>
                        CÓDIGO: {pvpRoomCode}
                      </p>
                    )}
                    <button className="tiny-btn" type="button" onClick={cancelPvpWaiting} style={{ color: '#ff8a80' }}>{t('pvp.cancel')}</button>
                  </div>
                ) : (
                  <>
                    <button className="cta" type="button" style={{ width: '100%', marginBottom: '0.75rem' }} onClick={() => void startPvpOnline()}>
                      {t('pvp.playOnline')}
                    </button>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="cta" type="button" style={{ flex: 1, background: '#7d7ab5' }} onClick={() => void createPvpCustom()}>
                        {t('pvp.createRoom')}
                      </button>
                      <input
                        value={pvpJoinCode}
                        onChange={(e) => setPvpJoinCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        placeholder={t('pvp.codePlaceholder')}
                        style={{ width: '110px', textAlign: 'center', letterSpacing: '0.15em', padding: '8px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                      />
                      <button className="cta" type="button" style={{ flex: 1, background: '#7d7ab5' }} onClick={() => void joinPvpCustom()}>
                        {t('pvp.enter')}
                      </button>
                    </div>
                    <p style={{ textAlign: 'center', color: '#7d7ab5', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                      {t('pvp.roomDesc')}
                    </p>
                  </>
                )}

                {pvpError && <p style={{ textAlign: 'center', color: '#ff8a80', fontSize: '0.85rem', marginTop: '0.5rem' }}>{pvpError}</p>}
              </>
            )}

            <button className="cta" type="button" onClick={() => setShowPvpModal(false)} style={{ marginTop: '1rem', background: '#7d7ab5', width: '100%' }}>{t('common.close')}</button>
          </div>
        </div>
      )}

      {/* Constructor de equipo PvP */}
      {showPvpTeamBuilder && (
        <div className="modal-backdrop" onClick={() => setShowPvpTeamBuilder(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px', maxHeight: '88vh', overflow: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, color: '#ffcb05' }}>{t('pvp.yourTeam2')}</h2>
              <button className="tiny-btn" type="button" onClick={() => setShowPvpTeamBuilder(false)} style={{ color: '#ff8a80' }}>{t('pvp.close')}</button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', padding: '0.6rem', background: 'rgba(15,23,42,0.5)', borderRadius: '8px', border: '1px solid #3f3f6e' }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const p = pvpBuildTeam[i]
                return (
                  <div key={i} style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '8px', border: p ? (p.shiny ? '1px solid #ffcb05' : '1px solid #a855f7') : '1px dashed #3f3f6e', display: 'flex', alignItems: 'center', justifyContent: 'center', background: p?.shiny ? 'rgba(250,204,21,0.12)' : 'rgba(0,0,0,0.3)' }}>
                    {p ? (
                      <>
                        <img src={p.sprite} alt={p.name} title={`${p.name}${p.shiny ? ' ✨' : ''}`} onError={fallbackSprite} className="pvp-sprite-bob" style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }} />
                        {p.shiny && <span style={{ position: 'absolute', top: '-5px', left: '-5px', fontSize: '0.75rem', textShadow: '0 1px 2px #000' }}>✨</span>}
                        <button
                          type="button"
                          onClick={() => {
                            setPvpBuildTeam(prev => prev.filter((_, x) => x !== i))
                            if (pvpBuildSelected === p.id && pvpBuildSelectedShiny === !!p.shiny) {
                              setPvpBuildSelected(null)
                              setPvpBuildMoves([])
                              setPvpBuildSelectedMoveNames(new Set())
                            }
                          }}
                          style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', background: '#ee3b2f', color: '#fff', border: 'none', fontSize: '10px', lineHeight: '18px', cursor: 'pointer', padding: 0 }}
                        >✕</button>
                      </>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
              {([
                ['normal', t('pvp.caughtTab', { n: pvpBuildNormalDex.length }), '#a855f7', 'rgba(168,85,247,0.22)'],
                ['shiny', t('pvp.shinyCaughtTab', { n: pvpBuildShinyDex.length }), '#ffcb05', 'rgba(250,204,21,0.18)'],
              ] as const).map(([mode, label, color, bg]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    playClick()
                    setPvpBuildDexMode(mode)
                    setPvpBuildSelected(null)
                    setPvpBuildSelectedShiny(false)
                    setPvpBuildMoves([])
                    setPvpBuildSelectedMoveNames(new Set())
                  }}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: pvpBuildDexMode === mode ? bg : 'rgba(15,23,42,0.5)',
                    border: `1px solid ${pvpBuildDexMode === mode ? color : '#3f3f6e'}`,
                    color: pvpBuildDexMode === mode ? color : '#9b98cf',
                    fontWeight: pvpBuildDexMode === mode ? 'bold' : 'normal',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <input type="text" placeholder={t('pvp.searchPokemon')} value={pvpBuildSearch} onChange={e => setPvpBuildSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem' }}>
              {pvpBuildSourceDex.filter(p => {
                const term = pvpBuildSearch.toLowerCase().trim()
                return !term || p.name.toLowerCase().includes(term) || String(p.id).includes(term)
              }).sort((a, b) => a.id - b.id).map(pkmn => {
                const isShiny = pvpBuildDexMode === 'shiny'
                const inTeam = pvpBuildTeam.some(p => p.id === pkmn.id && !!p.shiny === isShiny)
                const isSelected = pvpBuildSelected === pkmn.id && pvpBuildSelectedShiny === isShiny
                const sprite = pokemonSpriteUrl(pkmn.id, isShiny)
                return (
                  <div
                    key={`${pkmn.id}-${isShiny ? 'shiny' : 'normal'}`}
                    onClick={() => {
                      if (!inTeam && pvpBuildTeam.length >= 6) return
                      if (isSelected) {
                        setPvpBuildSelected(null)
                        setPvpBuildMoves([])
                        setPvpBuildSelectedMoveNames(new Set())
                      } else {
                        void loadPvpBuildMoves(
                          pkmn.id,
                          inTeam ? (pvpBuildTeam.find(p => p.id === pkmn.id && !!p.shiny === isShiny)?.moves.map(m => m.name) ?? []) : [],
                          isShiny,
                        )
                      }
                    }}
                    style={{ border: `1px solid ${isSelected ? (isShiny ? '#ffcb05' : '#a855f7') : inTeam ? '#37d16b' : '#3f3f6e'}`, borderRadius: '8px', padding: '6px', textAlign: 'center', cursor: 'pointer', background: isSelected ? (isShiny ? 'rgba(250,204,21,0.14)' : 'rgba(168,85,247,0.15)') : 'rgba(15,23,42,0.5)' }}
                  >
                    <img src={sprite} alt={pkmn.name} onError={fallbackSprite} className="pvp-sprite-bob" style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }} />
                    <div style={{ fontSize: '0.7rem', color: isShiny ? '#ffcb05' : '#f3f1ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isShiny ? '✨ ' : ''}{pkmn.name}</div>
                    {inTeam && <div style={{ fontSize: '0.65rem', color: '#37d16b' }}>✓ En equipo</div>}
                  </div>
                )
              })}
            </div>
            {pvpBuildSourceDex.length === 0 && (
              <p style={{ color: '#7d7ab5', fontSize: '0.8rem', textAlign: 'center', margin: '0 0 1rem' }}>
                {pvpBuildDexMode === 'shiny' ? t('pvp.shinyCaughtEmpty') : t('pvp.caughtEmpty')}
              </p>
            )}

            {pvpBuildSelected !== null && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid #a855f7', marginBottom: '1rem' }}>
                <strong style={{ color: '#cba3ff', fontSize: '0.9rem' }}>Elige 4 ataques</strong>
                <p style={{ color: '#7d7ab5', fontSize: '0.75rem', margin: '0.25rem 0 0.5rem' }}>
                  {t('pvp.moves4', { n: pvpBuildSelectedMoveNames.size, rest: pvpBuildLoading ? t('pvp.loadingMoves') : pvpBuildMoves.length > 0 ? t('pvp.canLearn', { n: pvpBuildMoves.length }) : t('pvp.available') })}
                </p>
                {pvpBuildLoading ? (
                  <p style={{ color: '#9b98cf', fontSize: '0.85rem' }}>Cargando ataques...</p>
                ) : pvpBuildMoves.length === 0 ? (
                  <p style={{ color: '#9b98cf', fontSize: '0.85rem' }}>{t('pvp.noMoves')}</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.35rem', maxHeight: '200px', overflowY: 'auto' }}>
                    {pvpBuildMoves.map((m) => {
                      const selected = pvpBuildSelectedMoveNames.has(m.name)
                      const disabled = !selected && pvpBuildSelectedMoveNames.size >= 4
                      return (
                        <div
                          key={m.name}
                          onClick={() => {
                            if (selected) {
                              const next = new Set(pvpBuildSelectedMoveNames)
                              next.delete(m.name)
                              setPvpBuildSelectedMoveNames(next)
                            } else if (pvpBuildSelectedMoveNames.size < 4) {
                              const next = new Set(pvpBuildSelectedMoveNames)
                              next.add(m.name)
                              setPvpBuildSelectedMoveNames(next)
                            }
                          }}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', border: `1px solid ${selected ? '#a855f7' : '#3f3f6e'}`, borderRadius: '6px', padding: '5px 8px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, background: selected ? 'rgba(168,85,247,0.15)' : 'rgba(0,0,0,0.25)' }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <span style={{ color: selected ? '#cba3ff' : '#d9d6f2', fontSize: '0.8rem', display: 'block' }}>{moveName(m)}</span>
                            <span style={{ color: '#7d7ab5', fontSize: '0.7rem', display: 'block' }}>PWR {m.power}</span>
                            {moveEffectSummary(m) && <span style={{ color: '#7dd3fc', fontSize: '0.62rem', display: 'block' }}>{moveEffectSummary(m)}</span>}
                          </div>
                          <span style={{ background: TYPE_COLORS[m.type] ?? '#475569', color: '#fff', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', textTransform: 'capitalize', flexShrink: 0 }}>{m.type}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                  <button className="cta" type="button" disabled={pvpBuildSelectedMoveNames.size === 0 || pvpBuildLoading} onClick={addPvpBuildPokemon} style={{ fontSize: '0.85rem', padding: '6px 14px', marginTop: 0 }}>
                    ➕ Añadir al equipo
                  </button>
                  <button className="tiny-btn" type="button" onClick={() => { setPvpBuildSelected(null); setPvpBuildMoves([]); setPvpBuildSelectedMoveNames(new Set()) }}>{t('common.cancel')}</button>
                </div>
              </div>
            )}

            <button className="cta" type="button" onClick={savePvpTeam} disabled={pvpBuildTeam.length === 0} style={{ width: '100%', background: '#37d16b' }}>
              💾 Guardar equipo ({pvpBuildTeam.length}/6)
            </button>
            {pvpError && <p style={{ textAlign: 'center', color: '#ff8a80', fontSize: '0.85rem', marginTop: '0.5rem' }}>{pvpError}</p>}
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="modal-backdrop" onClick={() => setShowLeaderboard(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <h2 style={{ color: '#cba3ff', textAlign: 'center', margin: '0 0 0.75rem' }}>
              {leaderboardTab === 'infinite' ? `🌍 ${t('lb.title2')} — ♾️ Infinite` : '⚔️ Elo PvP Ranking'}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
              {([['infinite', '♾️ Infinite'], ['elo', '⚔️ Elo PvP']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { playClick(); setLeaderboardTab(tab) }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    background: leaderboardTab === tab ? 'rgba(168,85,247,0.25)' : 'rgba(15,23,42,0.5)',
                    border: `1px solid ${leaderboardTab === tab ? '#a855f7' : '#3f3f6e'}`,
                    color: leaderboardTab === tab ? '#cba3ff' : '#9b98cf'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p style={{ textAlign: 'center', color: '#9b98cf', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {leaderboardTab === 'infinite'
                ? 'Los entrenadores se ordenan por el nodo más lejano alcanzado. Si empatan, gana el que tardó menos.'
                : 'Los entrenadores se ordenan por puntos Elo. Se ganan al vencer en PvP: cuantos más Pokémon tuyos sobrevivan, más Elo obtienes.'}
            </p>

            {isLeaderboardEnabled() && (
              authUser ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '0.6rem 0.9rem', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <span style={{ color: '#d9d6f2', fontWeight: 'bold', fontSize: '0.9rem' }}>👤 {getUsername(authUser) || authUser.email}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {pendingScoreRef.current && (
                      <button className="cta" type="button" onClick={() => void submitPendingScore()} style={{ fontSize: '0.75rem', padding: '4px 12px', marginTop: 0 }}>
                        📤 Registrar puntuación (Nodo #{pendingScoreRef.current.node})
                      </button>
                    )}
                    <button className="tiny-btn" type="button" onClick={handleLogout}>{t('lb.logout')}</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '1.25rem', padding: '1rem', borderRadius: '8px', background: 'rgba(15,23,42,0.5)', border: '1px solid #3f3f6e' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.9rem' }}>
                    {(['signin', 'signup'] as const).map((mode) => (
                      <button
                        key={mode}
                        className="tiny-btn"
                        type="button"
                        onClick={() => { playClick(); setAuthMode(mode); setAuthMessage(null) }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          background: authMode === mode ? 'rgba(168,85,247,0.25)' : 'transparent',
                          borderColor: authMode === mode ? '#a855f7' : '#3f3f6e',
                          color: authMode === mode ? '#cba3ff' : '#9b98cf'
                        }}
                      >
                        {mode === 'signup' ? t('lb.register') : t('lb.login')}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {authMode === 'signup' && (
                      <input
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        maxLength={20}
                        placeholder="Nombre de usuario (aparece en el ranking)"
                        style={authInputStyle}
                      />
                    )}
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="Email"
                      style={authInputStyle}
                    />
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Contraseña (mín. 6 caracteres)"
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleAuthSubmit() }}
                      style={authInputStyle}
                    />
                    <button className="cta" type="button" onClick={() => void handleAuthSubmit()} disabled={authLoading} style={{ marginTop: '0.25rem' }}>
                      {authLoading ? '...' : authMode === 'signup' ? 'Crear cuenta y entrar' : 'Iniciar sesión'}
                    </button>
                    {authMessage && (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: authMessage.type === 'error' ? '#ff8a80' : authMessage.type === 'info' ? '#9b98cf' : '#37d16b' }}>
                        {authMessage.text}
                      </p>
                    )}
                  </div>
                </div>
              )
            )}

            {leaderboardTab === 'elo' ? (
              pvpEloLeaderboard.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9b98cf' }}>{t('pvp.noElo')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {pvpEloLeaderboard.map((entry, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`
                    return (
                      <div
                        key={`${entry.player_name}-${idx}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '44px 1fr auto',
                          gap: '0.75rem',
                          alignItems: 'center',
                          padding: '0.6rem 0.75rem',
                          borderRadius: '8px',
                          background: 'rgba(15,23,42,0.5)',
                          border: '1px solid #3f3f6e'
                        }}
                      >
                        <div style={{ textAlign: 'center', fontWeight: 'bold', color: idx < 3 ? '#ffcb05' : '#9b98cf' }}>{medal}</div>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ color: '#f3f1ff', fontSize: '0.9rem' }}>{entry.player_name}</strong>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '1.05rem' }}>Elo {entry.elo}</div>
                          <div style={{ color: '#9b98cf', fontSize: '0.75rem' }}>{entry.wins} victorias</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              <>
                {!isLeaderboardEnabled() ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px dashed #3f3f6e' }}>
                    <p style={{ color: '#9b98cf', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('lb.notConfigured')}</p>
                    <p style={{ color: '#7d7ab5', fontSize: '0.8rem', margin: 0 }}>
                      {t('lb.copyEnv')}
                    </p>
                  </div>
                ) : leaderboardLoading && Object.keys(leaderboardByGen).length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#9b98cf' }}>Cargando ranking...</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'center', marginBottom: '1rem' }}>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => { playClick(); setLeaderboardGen(g) }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            background: leaderboardGen === g ? 'rgba(168,85,247,0.25)' : 'transparent',
                            border: `1px solid ${leaderboardGen === g ? '#a855f7' : '#3f3f6e'}`,
                            color: leaderboardGen === g ? '#cba3ff' : '#9b98cf'
                          }}
                        >
                          {g === 0 ? 'Todos' : `Gen ${g}`}
                        </button>
                      ))}
                    </div>

                    {leaderboardActiveEntries.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#9b98cf' }}>
                        {leaderboardGen === 0 ? t('lb.emptyInfinite') : t('lb.emptyGen', { gen: leaderboardGen })}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {leaderboardActiveEntries.map((entry, idx) => {
                          const isMe = authUser !== null && entry.user_id === authUser.id
                          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`
                          return (
                            <div
                              key={entry.id ?? idx}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '44px 1fr auto',
                                gap: '0.75rem',
                                alignItems: 'center',
                                padding: '0.6rem 0.75rem',
                                borderRadius: '8px',
                                background: isMe ? 'rgba(168,85,247,0.15)' : 'rgba(15,23,42,0.5)',
                                border: `1px solid ${isMe ? '#a855f7' : '#3f3f6e'}`
                              }}
                            >
                              <div style={{ textAlign: 'center', fontWeight: 'bold', color: idx < 3 ? '#ffcb05' : '#9b98cf' }}>{medal}</div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <strong style={{ color: '#f3f1ff', fontSize: '0.9rem' }}>{entry.player_name}</strong>
                                  {isMe && <span style={{ color: '#cba3ff', fontSize: '0.7rem' }}>(tú)</span>}
                                  <span style={{ color: '#7d7ab5', fontSize: '0.75rem' }}>
                                    {entry.is_random ? `🎲 Random · Gen ${entry.generation}` : `Gen ${entry.generation}`}
                                  </span>
                                  {entry.challenges && entry.challenges.length > 0 && (
                                    <span style={{ color: '#fb923c', fontSize: '0.7rem' }}>🎲 {entry.challenges.join(', ')}</span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '2px', marginTop: '4px', alignItems: 'flex-end' }}>
                                  {(entry.team ?? []).map((member, mi) => (
                                    <img
                                      key={`${entry.id}-${mi}`}
                                      src={member.sprite}
                                      alt={member.name}
                                      title={`${member.name} Nv.${member.level}`}
                                      onError={fallbackSprite}
                                      style={{ width: '28px', height: '28px', imageRendering: 'pixelated' }}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ color: '#cba3ff', fontWeight: 'bold', fontSize: '1.05rem' }}>Nodo #{entry.node}</div>
                                <div style={{ color: '#9b98cf', fontSize: '0.75rem' }}>⏱️ {formatDuration(entry.duration_seconds)}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <button className="cta" onClick={() => setShowLeaderboard(false)} style={{ marginTop: '1.25rem', background: '#7d7ab5', width: '100%' }}>{t('common.close')}</button>
          </div>
        </div>
      )}

      {/* Meta Shop Modal */}
      {/* Modal Tutorial / Cómo se juega */}
      {showHelpModal && (
        <div className="modal-backdrop" onClick={() => setShowHelpModal(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px', maxHeight: '86vh', overflow: 'auto', padding: '1.5rem', animation: 'casinoSlideUp 0.35s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, color: '#ffcb05' }}>❓ {t('help.title')} <span style={{ fontSize: '0.7rem', color: '#7d7ab5', fontWeight: 'normal' }}>{t('help.version')}</span></h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button className="tiny-btn" type="button" onClick={openChangelog} title={t('changelog.title')} style={{ position: 'relative' }}>
                  📜 {t('changelog.button')}
                  {hasUnseenChangelog && (
                    <span className="version-badge-blink" aria-label="Novedades sin ver" style={{ position: 'absolute', top: '-5px', right: '-5px', width: '13px', height: '13px', borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 0 0 2px #1c1c3a' }}>!</span>
                  )}
                </button>
                <button className="tiny-btn" type="button" onClick={() => setShowHelpModal(false)} style={{ color: '#ff8a80' }}>{t('common.close')}</button>
              </div>
            </div>

            <div style={{ color: '#d9d6f2', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.25rem', animation: 'casinoFadeIn 0.5s ease' }}>
              {t('help.intro')}
            </div>

            <div className="help-section" style={{ marginBottom: '1.25rem', animation: 'casinoSlideUp 0.4s ease' }}>
              <h3 style={{ color: '#4d9bff', margin: '0 0 0.5rem', fontSize: '1rem' }}>{t('help.howTitle')}</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#d9d6f2', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <li>{t('help.how1')}</li>
                <li>{t('help.how2')}</li>
                <li>{t('help.how3')}</li>
                <li>{t('help.how4')}</li>
              </ol>
            </div>

            <div className="help-section" style={{ marginBottom: '1.25rem', animation: 'casinoSlideUp 0.45s ease' }}>
              <h3 style={{ color: '#ff8a33', margin: '0 0 0.5rem', fontSize: '1rem' }}>{t('help.nodesTitle')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.5rem' }}>
                {([
                  ['battle', 'help.battle'], ['rest', 'help.rest'], ['shop', 'help.shop'], ['boss', 'help.boss'],
                  ['teamRocket', 'help.teamRocket'], ['spin', 'help.spin'], ['pokeRand', 'help.pokeRand'], ['move', 'help.move'],
                  ['mega', 'help.mega'], ['gmax', 'help.gmax'], ['primal', 'help.primal'], ['trade', 'help.trade'],
                  ['rival', 'help.rival'], ['blackmarket', 'help.blackmarket'], ['speculator', 'help.speculator'], ['safari', 'help.safari'], ['orchard', 'help.orchard'], ['fossil', 'help.fossil'], ['fishing', 'help.fishing'], ['mine', 'help.mine'], ['daycare', 'help.daycare'], ['weather', 'help.weather'], ['mirror', 'help.mirror'], ['ranch', 'help.ranch'], ['double', 'help.double'], ['casino', 'help.casino'],
                  ['elite', 'help.elite'], ['legendary', 'help.legendary'],
                ] as Array<[string, string]>).map(([type, key], i) => (
                  <div
                    key={type}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px',
                      background: 'rgba(15,23,42,0.6)', border: `1px solid ${NODE_TYPE_COLORS[type] ?? '#3f3f6e'}`, borderLeft: `4px solid ${NODE_TYPE_COLORS[type] ?? '#3f3f6e'}`,
                      animation: `casinoWhackPop 0.35s ease both`, animationDelay: `${i * 0.03}s`,
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{NODE_EMOJIS[type] ?? '•'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#f3f1ff' }}>{nodeTypeLabel({ type, id: 0, label: '', done: false } as RouteNode)}</div>
                      <div style={{ fontSize: '0.72rem', color: '#9b98cf', lineHeight: '1.35' }}>{t(key)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="help-section" style={{ marginBottom: '1.25rem', animation: 'casinoSlideUp 0.5s ease' }}>
              <h3 style={{ color: '#37d16b', margin: '0 0 0.5rem', fontSize: '1rem' }}>{t('help.battleTitle')}</h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#d9d6f2', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <li>{t('help.battle1')}</li>
                <li>{t('help.battle2')}</li>
                <li>{t('help.battle3')}</li>
              </ul>
            </div>

            <div className="help-section" style={{ marginBottom: '1.25rem', animation: 'casinoSlideUp 0.55s ease' }}>
              <h3 style={{ color: '#ffcb05', margin: '0 0 0.5rem', fontSize: '1rem' }}>{t('help.progTitle')}</h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#d9d6f2', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <li>{t('help.prog1')}</li>
                <li>{t('help.prog2')}</li>
                <li>{t('help.prog3')}</li>
              </ul>
            </div>

            <div className="help-section" style={{ marginBottom: '1.25rem', animation: 'casinoSlideUp 0.6s ease' }}>
              <h3 style={{ color: '#cba3ff', margin: '0 0 0.5rem', fontSize: '1rem' }}>{t('help.modesTitle')}</h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#d9d6f2', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <li>{t('help.modes1')}</li>
                <li>{t('help.modes2')}</li>
                <li>{t('help.modes3')}</li>
                <li>{t('help.modes4')}</li>
                <li style={{ color: '#ff8a80' }}>{t('help.modes5')}</li>
              </ul>
            </div>

            <div className="help-section" style={{ marginBottom: '1.25rem', animation: 'casinoSlideUp 0.65s ease' }}>
              <h3 style={{ color: '#fb923c', margin: '0 0 0.5rem', fontSize: '1rem' }}>{t('help.chalTitle')}</h3>
              <p style={{ margin: 0, color: '#d9d6f2', fontSize: '0.9rem', lineHeight: '1.6' }}>{t('help.chal1')}</p>
            </div>

            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button className="cta" onClick={() => setShowHelpModal(false)} style={{ background: '#ffcb05', color: '#000' }}>{t('help.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial de versiones */}
      {showChangelog && (() => {
        const entries = getChangelog()
        const latestVersion = entries[0]?.version ?? ''
        const openVersion = changelogExpanded === '__none__'
          ? null
          : (changelogExpanded ?? latestVersion)
        return (
          <div className="modal-backdrop" onClick={() => setShowChangelog(false)}>
            <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px', width: '100%', maxHeight: '86vh', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column', animation: 'casinoSlideUp 0.35s ease' }}>
              <div style={{ padding: '1.25rem 1.4rem 0.9rem', borderBottom: '1px solid rgba(63,63,110,0.7)', background: 'linear-gradient(180deg, rgba(77,155,255,0.10), transparent)', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div>
                    <h2 style={{ margin: 0, color: '#ffcb05' }}>{t('changelog.title')}</h2>
                    <p style={{ margin: '0.3rem 0 0', color: '#9b98cf', fontSize: '0.78rem', lineHeight: 1.4 }}>{t('changelog.intro')}</p>
                  </div>
                  <button className="tiny-btn" type="button" onClick={() => setShowChangelog(false)} style={{ color: '#ff8a80', flexShrink: 0 }}>{t('common.close')}</button>
                </div>
              </div>

              <div style={{ padding: '1rem 1.1rem', flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {entries.map((g, index) => {
                  const isLatest = index === 0
                  const isOpen = openVersion === g.version
                  return (
                    <div
                      key={g.version}
                      style={{
                        border: `1px solid ${isLatest ? 'rgba(255,203,5,0.55)' : 'rgba(63,63,110,0.9)'}`,
                        background: isLatest ? 'rgba(255,203,5,0.06)' : 'rgba(15,23,42,0.42)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setChangelogExpanded(isOpen ? '__none__' : g.version)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.7rem 0.85rem', background: 'transparent', border: 0, color: 'inherit', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '999px', background: isLatest ? 'rgba(255,203,5,0.18)' : 'rgba(77,155,255,0.14)', border: `1px solid ${isLatest ? 'rgba(255,203,5,0.55)' : 'rgba(77,155,255,0.35)'}`, color: isLatest ? '#ffcb05' : '#9ec5ff', fontSize: '0.78rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          {g.version}
                        </span>
                        {isLatest && (
                          <span style={{ padding: '2px 7px', borderRadius: '999px', background: 'rgba(255,203,5,0.14)', color: '#ffe27a', fontSize: '0.64rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {t('changelog.latest')}
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto', color: '#7d7ab5', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                          {g.items.length === 1 ? t('changelog.change') : t('changelog.changes', { n: g.items.length })}
                        </span>
                        <span style={{ color: '#9b98cf', fontSize: '0.8rem', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }}>▾</span>
                      </button>

                      {isOpen && (
                        <ul style={{ listStyle: 'none', margin: 0, padding: '0 0.8rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {g.items.map((item, idx) => (
                            <li key={idx} style={{ background: 'rgba(0,0,0,0.18)', borderLeft: `3px solid ${isLatest ? '#ffcb05' : '#4d9bff'}`, borderRadius: '5px', padding: '0.45rem 0.6rem', color: '#d9d6f2', fontSize: '0.82rem', lineHeight: 1.5 }}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ padding: '0.8rem 1.1rem 1rem', borderTop: '1px solid rgba(63,63,110,0.7)', textAlign: 'center', flexShrink: 0 }}>
                <button className="cta" type="button" onClick={() => setShowChangelog(false)} style={{ background: '#ffcb05', color: '#000', width: '100%' }}>{t('help.close')}</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal Confirmar Volver a inicio */}
      {showRestartConfirm && (
        <div className="modal-backdrop" onClick={() => setShowRestartConfirm(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', padding: '1.5rem', textAlign: 'center' }}>
            <h3 style={{ color: '#ffcb05', margin: '0 0 0.75rem' }}>{t('restart.title')}</h3>
            <p style={{ color: '#d9d6f2', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{t('restart.desc')}</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="cta" type="button" onClick={onRestartRun} style={{ flex: 1, background: '#ee3b2f', color: '#fff' }}>
                {t('restart.confirm')}
              </button>
              <button className="cta" type="button" onClick={() => { playClick(); setShowRestartConfirm(false) }} style={{ flex: 1, background: '#7d7ab5' }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMetaShop && (
        <div className="modal-backdrop" onClick={() => setShowMetaShop(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <h2 style={{ color: '#ffcb05', textAlign: 'center', marginBottom: '0.5rem' }}>🪙 {t('shop.title')}</h2>
            <p style={{ textAlign: 'center', color: '#9b98cf', marginBottom: '1rem' }}>{t('shop.yourCoins')}: <strong style={{ color: '#ffcb05' }}>{metaProgression.pokeCoins}</strong></p>
            {(() => {
              const metaSections = [
                { id: 'meta-themes', icon: '🎨', label: t('shop.themes') },
                { id: 'meta-redesigns', icon: '🕹️', label: language === 'en' ? 'Redesigns' : 'Rediseños' },
                { id: 'meta-backgrounds', icon: '🖼️', label: t('shop.backgrounds') },
                { id: 'meta-consumables', icon: '🧪', label: t('shop.consumables') },
                { id: 'meta-treasures', icon: '💰', label: t('shop.treasures') },
                { id: 'meta-berries', icon: '🫐', label: t('shop.berries') },
                { id: 'meta-disco', icon: '💿', label: t('shop.disco') },
                { id: 'meta-pokeballs', icon: '🏐', label: t('shop.pokeballs') },
                { id: 'meta-stones', icon: '💎', label: t('shop.stones') },
                { id: 'meta-evo-items', icon: '🔧', label: t('shop.evoItems') },
                { id: 'meta-upgrades', icon: '⚙️', label: t('shop.upgrades') },
                { id: 'meta-music', icon: '🎵', label: t('shop.music') },
                { id: 'meta-holdables', icon: '🎒', label: t('shop.holdables') },
              ]
              return (
                <div className="meta-nav-zone">
                  <button
                    className="meta-nav-handle"
                    type="button"
                    onClick={(e) => { playClick(); e.currentTarget.closest('.meta-nav-zone')?.classList.toggle('open') }}
                  >
                    🧭 {t('shop.sections')} <span className="meta-nav-chevron" style={{ fontSize: '0.6rem' }}>▾</span>
                  </button>
                  <div className="meta-nav-bar">
                    {metaSections.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { playClick(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                        title={s.label}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '0.45rem 0.85rem', borderRadius: '999px',
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'rgba(45,58,84,0.55)',
                          color: '#e2e8f0',
                          cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.02em',
                          whiteSpace: 'nowrap',
                          transition: 'transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(77,155,255,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(77,155,255,0.3)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(45,58,84,0.55)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                      >
                        <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{s.icon}</span>
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                value={metaShopSearch}
                onChange={(e) => setMetaShopSearch(e.target.value)}
                placeholder={t('shop.search')}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '2px solid #3f3f6e',
                  background: 'rgba(15,23,42,0.7)',
                  color: '#f3f1ff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              {(() => {
                const term = metaShopSearch.trim().toLowerCase()
                if (!term) return null
                const visibleThemes = THEMES.filter(t => themeName(t.id).toLowerCase().includes(term) || themeDesc(t.id).toLowerCase().includes(term))
                const visibleItems = META_SHOP_ITEMS.filter(i => i.name.toLowerCase().includes(term) || i.desc.toLowerCase().includes(term))
                const visibleBgs = BACKGROUNDS.filter(bg => bg.id === 'none' || bgName(bg.id).toLowerCase().includes(term) || bgDesc(bg.id).toLowerCase().includes(term))
                const visibleRedesigns = REDESIGNS.filter(r => r.name.toLowerCase().includes(term) || r.desc.toLowerCase().includes(term))
                if (visibleThemes.length === 0 && visibleItems.length === 0 && visibleBgs.length === 0 && visibleRedesigns.length === 0) {
                  return <p style={{ color: '#7d7ab5', fontSize: '0.85rem', textAlign: 'center', margin: '0.75rem 0 0' }}>{t('shop.noResultsSearch', { q: metaShopSearch })}</p>
                }
                return null
              })()}
            </div>

            <h3 id="meta-themes" style={{ color: '#4d9bff', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>🎨 {t('shop.themes')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {THEMES.filter(t => metaShopItemMatches(t, metaShopSearch.trim().toLowerCase())).map(theme => {
                const owned = metaProgression.ownedThemes.includes(theme.id)
                const active = metaProgression.activeTheme === theme.id
                return (
                  <div key={theme.id} style={{ background: theme.colors.bg, border: `2px solid ${active ? '#ffcb05' : theme.colors.border}`, borderRadius: '6px', padding: '0.75rem', cursor: owned ? 'pointer' : 'default', opacity: owned ? 1 : 0.7 }}
                    onClick={() => owned ? setTheme(theme.id) : undefined}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '0.5rem' }}>
                      {[theme.colors.bg, theme.colors.surface, theme.colors.accent, theme.colors.text].map((c, i) => (
                        <div key={i} style={{ width: '16px', height: '16px', borderRadius: '4px', background: c, border: '1px solid rgba(255,255,255,0.2)' }} />
                      ))}
                    </div>
                    <div style={{ color: theme.colors.text, fontWeight: 'bold', fontSize: '0.85rem' }}>{themeName(theme.id)}</div>
                    <div style={{ color: theme.colors.muted, fontSize: '0.75rem' }}>{themeDesc(theme.id)}</div>
                    {owned ? (
                      active ? <div style={{ color: '#ffcb05', fontSize: '0.75rem', marginTop: '4px' }}>{t('shop.active')}</div> : <div style={{ color: theme.colors.muted, fontSize: '0.75rem', marginTop: '4px' }}>{t('shop.tapToActivateTheme')}</div>
                    ) : (
                      <button className="cta" onClick={(e) => { e.stopPropagation(); buyMetaItem({ ...theme, id: theme.id, category: 'theme' as const, spriteKey: theme.id }) }}
                        disabled={metaProgression.pokeCoins < theme.price}
                        style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '4px 12px', background: metaProgression.pokeCoins >= theme.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {theme.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 id="meta-redesigns" style={{ color: '#ffcb05', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>🕹️ {language === 'en' ? 'Redesigns' : 'Rediseños'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {REDESIGNS.filter(r => metaShopItemMatches(r, metaShopSearch.trim().toLowerCase())).map(redesign => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(redesign.id)
                const active = owned && metaProgression.gameboyMode
                return (
                  <div key={redesign.id} style={{ background: redesign.colors.bg, border: `2px solid ${active ? '#ffcb05' : redesign.colors.border}`, borderRadius: '6px', padding: '0.75rem', cursor: owned ? 'pointer' : 'default', opacity: owned ? 1 : 0.7 }}
                    onClick={() => owned ? (() => { playClick(); const updated = { ...metaProgression, gameboyMode: true }; setMetaProgression(updated); localStorage.setItem('pokerand_meta', JSON.stringify(updated)) })() : undefined}>
                    <div style={{ height: '64px', borderRadius: '6px', marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: redesign.colors.surface, fontSize: '2rem' }}>
                      {redesign.icon}
                    </div>
                    <div style={{ color: redesign.colors.text, fontWeight: 'bold', fontSize: '0.85rem' }}>{redesign.name}</div>
                    <div style={{ color: redesign.colors.border, fontSize: '0.75rem' }}>{redesign.desc}</div>
                    {owned ? (
                      active ? <div style={{ color: '#ffcb05', fontSize: '0.75rem', marginTop: '4px' }}>{t('shop.active')}</div> : <div style={{ color: redesign.colors.border, fontSize: '0.75rem', marginTop: '4px' }}>{t('shop.tapToActivateTheme')}</div>
                    ) : (
                      <button className="cta" onClick={(e) => { e.stopPropagation(); buyMetaItem({ ...redesign, spriteKey: redesign.icon, category: 'redesign' as const }) }}
                        disabled={metaProgression.pokeCoins < redesign.price}
                        style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '4px 12px', background: metaProgression.pokeCoins >= redesign.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {redesign.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 id="meta-backgrounds" style={{ color: '#22d3ee', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>🖼️ {t('shop.backgrounds')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.backgroundsDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {BACKGROUNDS.filter(bg => bg.id === 'none' || metaShopItemMatches(bg, metaShopSearch.trim().toLowerCase())).map(bg => {
                const owned = metaProgression.ownedBackgrounds.includes(bg.id)
                const active = metaProgression.activeBackground === bg.id
                return (
                  <div key={bg.id} style={{ background: 'rgba(30,41,59,0.6)', border: `2px solid ${active ? '#ffcb05' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem', cursor: owned ? 'pointer' : 'default', opacity: owned ? 1 : 0.7 }}
                    onClick={() => owned ? setBackground(bg.id) : undefined}>
                    <div style={{ height: '52px', borderRadius: '6px', marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                      {bg.id === 'none' ? (
                        <div style={{ width: '100%', height: '100%', background: bg.preview, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
                          <span style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }}>{bg.icon}</span>
                        </div>
                      ) : (
                        <BackgroundPreview backgroundId={bg.id} height={52} />
                      )}
                    </div>
                    <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{bgName(bg.id)}</div>
                    <div style={{ color: '#9b98cf', fontSize: '0.75rem', marginBottom: '0.4rem' }}>{bgDesc(bg.id)}</div>
                    {owned ? (
                      active ? <div style={{ color: '#ffcb05', fontSize: '0.75rem', fontWeight: 'bold' }}>{t('shop.active')}</div> : <div style={{ color: '#9b98cf', fontSize: '0.75rem' }}>{t('shop.tapToActivate')}</div>
                    ) : (
                      <button className="cta" onClick={(e) => { e.stopPropagation(); buyBackground(bg) }}
                        disabled={metaProgression.pokeCoins < bg.price}
                        style={{ marginTop: '0.3rem', fontSize: '0.75rem', padding: '4px 12px', background: metaProgression.pokeCoins >= bg.price ? '#22d3ee' : '#475569', color: '#000' }}>
                        🪙 {bg.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 id="meta-consumables" style={{ color: '#ff8a33', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>🧪 {t('shop.consumables')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.consumablesDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'consumable' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                const locked = item.requires ? !metaProgression.permanentlyUnlockedItems.includes(item.requires) : false
                const disabled = !isItemEnabled(item.id)
                return (
                  <div key={item.id} style={{ position: 'relative', background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem', opacity: locked ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>📦</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{itemLocalizedName(item.name)}</div>
                        <div style={{ color: '#ff8a33', fontSize: '0.7rem' }}>{t('shop.catConsumable')}</div>
                      </div>
                    </div>
                    <div style={{ color: '#d9d6f2', fontSize: '1rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>{metaItemDesc(item.id)}</div>
                    {owned ? (
                      <div>
                        <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.unlocked')}</div>
                        <ShopItemToggle id={item.id} disabled={disabled} onToggle={toggleItemEnabled} />
                      </div>
                    ) : locked ? (
                      <div style={{ color: '#7d7ab5', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.requires', { name: META_SHOP_ITEMS.find(i => i.id === item.requires)?.name ?? (language === 'en' ? 'the previous upgrade' : 'la mejora anterior') })}</div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 id="meta-treasures" style={{ color: '#fbbf24', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>💰 {t('shop.treasures')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.treasuresDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'treasure' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                const disabled = !isItemEnabled(item.id)
                return (
                  <div key={item.id} style={{ position: 'relative', background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>💰</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{itemLocalizedName(item.name)}</div>
                        <div style={{ color: '#fbbf24', fontSize: '0.7rem' }}>{t('shop.catTreasure')}</div>
                      </div>
                    </div>
                    <div style={{ color: '#d9d6f2', fontSize: '1rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>{metaItemDesc(item.id)}</div>
                    {owned ? (
                      <div>
                        <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.unlocked')}</div>
                        <ShopItemToggle id={item.id} disabled={disabled} onToggle={toggleItemEnabled} />
                      </div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 id="meta-berries" style={{ color: '#78c850', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>🫐 {t('shop.berries')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.berriesDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'berry' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                const disabled = !isItemEnabled(item.id)
                return (
                  <div key={item.id} style={{ position: 'relative', background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>🫐</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{itemLocalizedName(item.name)}</div>
                        <div style={{ color: '#78c850', fontSize: '0.7rem' }}>{t('shop.catBerry')}</div>
                      </div>
                    </div>
                    <div style={{ color: '#d9d6f2', fontSize: '1rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>{metaItemDesc(item.id)}</div>
                    {owned ? (
                      <div>
                        <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.unlocked')}</div>
                        <ShopItemToggle id={item.id} disabled={disabled} onToggle={toggleItemEnabled} />
                      </div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 id="meta-disco" style={{ color: '#38bdf8', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>💿 {t('shop.disco')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.discoDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'disco_mt' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                const disabled = !isItemEnabled(item.id)
                return (
                  <div key={item.id} style={{ position: 'relative', background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>💿</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{itemLocalizedName(item.name)}</div>
                        <div style={{ color: '#38bdf8', fontSize: '0.7rem' }}>{t('shop.catDisco')}</div>
                      </div>
                    </div>
                    <div style={{ color: '#d9d6f2', fontSize: '1rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>{metaItemDesc(item.id)}</div>
                    {owned ? (
                      <div>
                        <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.unlocked')}</div>
                        <ShopItemToggle id={item.id} disabled={disabled} onToggle={toggleItemEnabled} />
                      </div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 id="meta-pokeballs" style={{ color: '#ee3b2f', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>🏐 {t('shop.pokeballs')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.pokeballsDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'pokeball' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                const disabled = !isItemEnabled(item.id)
                const locked = isMetaItemLocked(item)
                const missingBalls = missingRequiredBalls(item)
                return (
                  <div key={item.id} style={{ position: 'relative', background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>🏐</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{itemLocalizedName(item.name)}</div>
                        <div style={{ color: '#ee3b2f', fontSize: '0.7rem' }}>{t('shop.catPokeball')}</div>
                      </div>
                    </div>
                    <div style={{ color: '#d9d6f2', fontSize: '1rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>{metaItemDesc(item.id)}</div>
                    {owned ? (
                      <div>
                        <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.unlocked')}</div>
                        <ShopItemToggle id={item.id} disabled={disabled} onToggle={toggleItemEnabled} />
                      </div>
                    ) : locked ? (
                      <div
                        title={missingBalls.length > 0 ? `${language === 'en' ? 'Missing' : 'Faltan'}: ${missingBalls.join(', ')}` : undefined}
                        style={{ color: item.requiresAllBalls ? '#fb923c' : '#7d7ab5', fontSize: '0.8rem', fontWeight: 'bold', lineHeight: 1.35 }}
                      >
                        {item.requiresAllBalls
                          ? t('shop.requiresAllBalls', { n: missingBalls.length })
                          : t('shop.requires', { name: META_SHOP_ITEMS.find(i => i.id === item.requires)?.name ?? (language === 'en' ? 'the previous upgrade' : 'la mejora anterior') })}
                      </div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 id="meta-stones" style={{ color: '#a855f7', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>💎 {t('shop.stones')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.stonesDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'evolution_stone' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                const disabled = !isItemEnabled(item.id)
                return (
                  <div key={item.id} style={{ position: 'relative', background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>💎</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{itemLocalizedName(item.name)}</div>
                        <div style={{ color: '#a855f7', fontSize: '0.7rem' }}>{t('shop.catStone')}</div>
                      </div>
                    </div>
                    <div style={{ color: '#d9d6f2', fontSize: '1rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>{metaItemDesc(item.id)}</div>
                    {owned ? (
                      <div>
                        <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.unlocked')}</div>
                        <ShopItemToggle id={item.id} disabled={disabled} onToggle={toggleItemEnabled} />
                      </div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 id="meta-evo-items" style={{ color: '#ff8a33', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>🔧 {t('shop.evoItems')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.evoItemsDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'evolution_item' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                const disabled = !isItemEnabled(item.id)
                return (
                  <div key={item.id} style={{ position: 'relative', background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>🔧</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{itemLocalizedName(item.name)}</div>
                        <div style={{ color: '#ff8a33', fontSize: '0.7rem' }}>{t('shop.catEvoItem')}</div>
                      </div>
                    </div>
                    <div style={{ color: '#d9d6f2', fontSize: '1rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>{metaItemDesc(item.id)}</div>
                    {owned ? (
                      <div>
                        <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.unlocked')}</div>
                        <ShopItemToggle id={item.id} disabled={disabled} onToggle={toggleItemEnabled} />
                      </div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 id="meta-upgrades" style={{ color: '#22d3ee', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>⚙️ {t('shop.upgrades')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.upgradesDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'upgrade' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                const locked = item.requires ? !metaProgression.permanentlyUnlockedItems.includes(item.requires) : false
                const disabled = !isItemEnabled(item.id)
                return (
                  <div key={item.id} style={{ position: 'relative', background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem', opacity: locked ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>
                        {ITEM_SPRITES[item.spriteKey]
                          ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '36px', height: '36px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                          : item.spriteKey === 'money' ? '💰' : item.spriteKey === 'dice' ? '🎲' : '⚙️'}
                      </span>
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{itemLocalizedName(item.name)}</div>
                        <div style={{ color: '#22d3ee', fontSize: '0.7rem' }}>{t('shop.catUpgrade')}</div>
                      </div>
                    </div>
                    <div style={{ color: '#d9d6f2', fontSize: '1rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>{metaItemDesc(item.id)}</div>
                    {owned ? (
                      <div>
                        <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.unlocked')}</div>
                        <ShopItemToggle id={item.id} disabled={disabled} onToggle={toggleItemEnabled} />
                      </div>
                    ) : locked ? (
                      <div style={{ color: '#7d7ab5', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.requires', { name: META_SHOP_ITEMS.find(i => i.id === item.requires)?.name ?? (language === 'en' ? 'the previous upgrade' : 'la mejora anterior') })}</div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 id="meta-music" style={{ color: '#ff9ad6', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>{t('shop.music')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.musicDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'music' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.ownedMusic.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>🎵</span>
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{itemLocalizedName(item.name)}</div>
                        <div style={{ color: '#ff9ad6', fontSize: '0.7rem' }}>{t('shop.catMusic')}</div>
                      </div>
                    </div>
                    <div style={{ color: '#d9d6f2', fontSize: '1rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>{metaItemDesc(item.id)}</div>
                    {owned ? (
                      <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.unlocked')}</div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 id="meta-holdables" style={{ color: '#a855f7', marginBottom: '0.5rem', scrollMarginTop: '60px' }}>{t('shop.holdables')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.holdablesDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'holdable' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                const locked = item.requires ? !metaProgression.permanentlyUnlockedItems.includes(item.requires) : false
                const disabled = !isItemEnabled(item.id)
                return (
                  <div key={item.id} style={{ position: 'relative', background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem', opacity: locked ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>📦</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{itemLocalizedName(item.name)}</div>
                        <div style={{ color: '#a855f7', fontSize: '0.7rem' }}>{t('shop.catHoldable')}</div>
                      </div>
                    </div>
                    <div style={{ color: '#d9d6f2', fontSize: '1rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>{metaItemDesc(item.id)}</div>
                    {owned ? (
                      <div>
                        <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.unlocked')}</div>
                        <ShopItemToggle id={item.id} disabled={disabled} onToggle={toggleItemEnabled} />
                      </div>
                    ) : locked ? (
                      <div style={{ color: '#7d7ab5', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.requires', { name: META_SHOP_ITEMS.find(i => i.id === item.requires)?.name ?? (language === 'en' ? 'the previous version' : 'la versión anterior') })}</div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button className="cta" onClick={() => setShowMetaShop(false)}>{t('shop.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Añadir Pokémon (Modo Secreto) */}
      {secretAddOpen && (
        <div className="modal-backdrop" onClick={() => setSecretAddOpen(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.5rem', textAlign: 'center' }}>
            <h3 style={{ color: '#ffcb05', margin: '0 0 0.75rem' }}>➕ Añadir Pokémon (Modo Secreto)</h3>
            <p style={{ color: '#9b98cf', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Escribe un ID o nombre de PokeAPI (ej. 25 o pikachu). Se añadirá al nivel del Pokémon activo.
            </p>
            <input
              type="text"
              value={secretPokemonQuery}
              onChange={(e) => setSecretPokemonQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void secretAddPokemon() }}
              placeholder="ID o nombre (ej. 25, pikachu, charizard-mega-y)"
              autoFocus
              style={authInputStyle}
            />
            {secretAddError && <p style={{ color: '#ff8a80', fontSize: '0.8rem', marginTop: '0.5rem' }}>{secretAddError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="cta" type="button" onClick={() => void secretAddPokemon()} disabled={secretAddLoading} style={{ flex: 1 }}>
                {secretAddLoading ? 'Añadiendo...' : 'Añadir'}
              </button>
              <button className="cta" type="button" onClick={() => { setSecretAddOpen(false); setSecretAddError('') }} style={{ flex: 1, background: '#7d7ab5' }}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modo Secreto */}
      {secretModalOpen && (
        <div className="modal-backdrop" onClick={() => { setSecretModalOpen(false); setSecretPassword('') }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px', padding: '1.5rem', textAlign: 'center' }}>
            <h3 style={{ color: '#cba3ff', margin: '0 0 0.75rem' }}>🔒 Modo Secreto</h3>
            <p style={{ color: '#9b98cf', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Introduce la contraseña:</p>
            <input
              type="password"
              value={secretPassword}
              onChange={(e) => setSecretPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSecretPassword() }}
              autoFocus
              style={authInputStyle}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="cta" type="button" onClick={submitSecretPassword} style={{ flex: 1 }}>Confirmar</button>
              <button className="cta" type="button" onClick={() => { setSecretModalOpen(false); setSecretPassword('') }} style={{ flex: 1, background: '#7d7ab5' }}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje del Modo Secreto */}
      {secretMsg && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }}>
          <div style={{ padding: '1.5rem 2.5rem', borderRadius: '10px', background: '#1c1c3a', border: `2px solid ${secretMsg.error ? '#ff8a80' : '#37d16b'}`, color: secretMsg.error ? '#ff8a80' : '#37d16b', fontSize: '1.3rem', fontWeight: 'bold', textAlign: 'center', boxShadow: '5px 5px 0 rgba(0,0,0,0.5)', animation: 'slideInRight 0.3s ease' }}>
            {secretMsg.text}
          </div>
        </div>
      )}

      {/* Unlock Animation Popup */}
      {unlockPopup && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#1c1c3a', border: '3px solid #ffcb05', borderRadius: '8px', padding: '2rem 3rem', textAlign: 'center', boxShadow: '5px 5px 0 0 rgba(0,0,0,0.6)', animation: 'slideInRight 0.5s ease' }}>
          <div style={{ marginBottom: '0.5rem', animation: 'pulseGlow 1s infinite' }}>
            {unlockPopup.spriteKey === 'money' ? (
              <span style={{ fontSize: '4rem' }}>💰</span>
            ) : (
              ITEM_SPRITES[unlockPopup.spriteKey]
                ? <img src={ITEM_SPRITES[unlockPopup.spriteKey]} alt={unlockPopup.name} style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                : <span style={{ fontSize: '4rem' }}>📦</span>
            )}
          </div>
          <div style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.25rem' }}>¡Item Desbloqueado!</div>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.4rem', marginBottom: '0.5rem' }}>{unlockPopup.name}</div>
          <div style={{ color: '#9b98cf', fontSize: '0.9rem' }}>Ahora puede aparecer en las aventuras</div>
        </div>
      )}

      {stageNotice && (
        <div className="stage-notice" role="status" aria-live="assertive">
          <div className="stage-notice-card">
            <button
              className="stage-notice-spark"
              type="button"
              onClick={() => setStageNotice(null)}
              aria-label={t('stageNotice.close')}
              title={t('stageNotice.close')}
            >
              ✦
            </button>
            <img src={stageNotice.medal.sprite} alt={stageNotice.medal.name} className="stage-notice-medal" />
            <div className="stage-notice-kicker">{language === 'en' ? 'Badge obtained' : '¡Medalla conseguida!'}</div>
            <div className="stage-notice-name">{stageNotice.medal.name}</div>
            <div className="stage-notice-stage">
              {language === 'en' ? `You passed to Stage ${stageNotice.stage}` : `Has pasado a la Etapa ${stageNotice.stage}`}
            </div>
          </div>
        </div>
      )}

      {/* Mensaje central de canje de Emblema Magma */}
      {coinExchangeMsg && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#1c1c3a', border: '3px solid #ffcb05', borderRadius: '8px', padding: '1.75rem 2.5rem', textAlign: 'center', boxShadow: '5px 5px 0 0 rgba(0,0,0,0.6)', animation: 'slideInRight 0.3s ease' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <img src={ITEM_SPRITES['Emblema Magma']} alt="Emblema Magma" style={{ width: '70px', height: '70px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
          </div>
          <div style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '1rem' }}>{coinExchangeMsg}</div>
        </div>
      )}

      {/* Chat rápido cooperativo */}
      {coopMode && coopSessionCode && (
        <>
          {coopChatOpen && (
            <div style={{ position: 'fixed', bottom: '74px', right: '16px', zIndex: 9000, width: '300px', maxWidth: 'calc(100vw - 32px)', background: '#1c1c3a', border: '2px solid #37d16b', borderRadius: '10px', boxShadow: '4px 4px 0 rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(55,209,107,0.15)', borderBottom: '1px solid rgba(55,209,107,0.3)' }}>
                <strong style={{ color: '#37d16b', fontSize: '0.85rem' }}>🤝 Chat con tu compañero</strong>
                <button className="tiny-btn" type="button" onClick={() => setCoopChatOpen(false)} style={{ padding: '2px 8px', color: '#ff8a80' }}>✕</button>
              </div>
              <div style={{ height: '220px', overflowY: 'auto', padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {coopChatMsgs.length === 0 && <p style={{ margin: 0, color: '#7d7ab5', fontSize: '0.75rem' }}>{t('coop.noMessages')}</p>}
                {coopChatMsgs.map((m, i) => (
                  <div key={i} style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '6px', padding: '0.35rem 0.5rem' }}>
                    <span style={{ color: '#37d16b', fontSize: '0.7rem', fontWeight: 'bold' }}>{m.username ?? '?'}: </span>
                    <span style={{ color: '#f3f1ff', fontSize: '0.8rem' }}>{m.message}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', padding: '0.35rem 0.6rem', borderTop: '1px solid #3f3f6e' }}>
                {['👍', '❤️', '🔥', '😂', '😮', '💀', '🙏', '⚔️', '🤝', '👏', '😢', '😤'].map((e) => (
                  <button key={e} className="tiny-btn" type="button" onClick={() => void coopSendChat(e)} style={{ padding: '2px 6px', fontSize: '0.9rem' }}>{e}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', padding: '0.5rem 0.6rem', borderTop: '1px solid #3f3f6e' }}>
                <input
                  value={coopChatText}
                  onChange={(e) => setCoopChatText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void coopSendChat(coopChatText) }}
                  maxLength={120}
                  placeholder="Escribe un mensaje..."
                  style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #3f3f6e', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                />
                <button className="cta" type="button" onClick={() => void coopSendChat(coopChatText)} style={{ padding: '6px 12px', fontSize: '0.8rem', marginTop: 0 }}>{t('coop.send')}</button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCoopChatOpen(o => !o)}
            style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 9001, width: '46px', height: '46px', borderRadius: '50%', background: '#1c1c3a', border: '2px solid #37d16b', color: '#37d16b', fontSize: '1.3rem', cursor: 'pointer', boxShadow: '3px 3px 0 rgba(0,0,0,0.5)' }}
          >
            💬
          </button>
        </>
      )}

      {screen !== 'dungeon' && screen !== 'pokest' && (
        <footer className="site-footer" aria-label={t('credits.title')}>
          <div className="site-footer-head">
            <h2>◈ {t('credits.title')}</h2>
            <span>POKERAND // SPRITE CREDITS</span>
          </div>
          <p className="site-footer-intro">{t('credits.intro')}</p>
          <div className="site-footer-grid">
            <section>
              <h3>{t('credits.pokemon.title')} · PokéAPI</h3>
              <p>{t('credits.pokemon.desc')}</p>
              <div className="site-footer-links">
                <a href="https://pokeapi.co/" target="_blank" rel="noopener noreferrer">pokeapi.co</a>
                <a href="https://github.com/PokeAPI/sprites" target="_blank" rel="noopener noreferrer">PokeAPI/sprites</a>
              </div>
            </section>
            <section>
              <h3>{t('credits.pmd.title')} · PMD SpriteCollab</h3>
              <p>{t('credits.pmd.desc')}</p>
              <div className="site-footer-links">
                <a href="https://github.com/PMDCollab/SpriteCollab" target="_blank" rel="noopener noreferrer">GitHub</a>
                <a href="https://sprites.pmdcollab.org/" target="_blank" rel="noopener noreferrer">sprites.pmdcollab.org</a>
              </div>
            </section>
            <section>
              <h3>{t('credits.legal.title')}</h3>
              <p>{t('credits.legal.desc')}</p>
              <div className="site-footer-links">
                <a href="https://github.com/Subkhht/PokeRand" target="_blank" rel="noopener noreferrer">GitHub / PokeRand</a>
              </div>
            </section>
          </div>
          <p className="site-footer-note">{t('credits.note')}</p>
        </footer>
      )}

    </main>
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
          <h2>Algo salió mal.</h2>
          <button className="cta" onClick={() => window.location.reload()}>
            Recargar aplicación
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  )
}