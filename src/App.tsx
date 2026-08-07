import { useMemo, useState, useEffect, useRef, useCallback, Component, type ReactNode, type CSSProperties } from 'react'
import './App.css'
import { applyDamage, applyNoEvolutionBuff, healPokemon, randomFrom, scalePokemonForNode, balanceWildPokemonToTeam, startRun, generateBossRushRoute, ALL_TYPES, createSeededRandom, getDailyConfig, RUN_MODIFIERS } from './game/engine'
import { playHover, playClick, playHit, playEvolution, startMenuMusic, startBattleMusic, playVictoryFanfare, playDefeatMusic, setVolume, getVolume, setSfxVolume, getSfxVolume, setMenuMusicTrack, setBattleMusicTrack, stopMusic, unlockAudio, isMusicMuted, setMusicMuted } from './game/sound'
import {
  getBalancedPokemonByGeneration,
  getRandomStarterByGeneration,
  getRandomPokemonByGeneration,
  evolvePokemon,
  fetchPokemonDetails,
  checkAndLearnNewMove,
  getMoveDetails,
  getSpeciesIdsByGeneration,
  buildPokemonFromApi,
  makeShinySprite,
  canEvolveWithStone,
  stripRegional,
  setRunSeed,
  type PokemonDetails
} from './game/pokeapi'
import { getTypeEffectiveness } from './game/typesChart'
import { isLeaderboardEnabled, submitInfiniteScore, fetchInfiniteLeaderboard, formatDuration, getCurrentUser, onAuthChange, signUpWithUsername, signIn, signOut, getUsername, isUsernameTaken, type LeaderboardEntry, type InfiniteScoreInsert } from './game/leaderboard'
import { isCoopEnabled, createCoopSession, joinCoopSession, getCoopSession, markNodeReady, getCoopProgress, submitExchangeOffer, getCoopExchange, completeCoopExchange, cancelExchangeOffer, sendCoopChat, getCoopChat, finishCoopSession, resetCoopSession, cancelCoopSession as deleteCoopSessionRpc, type CoopTrade, type CoopExchange, type CoopChatMessage } from './game/coop'
import { isPvpEnabled, createPvpRoom, findPvpOpponent, joinPvpRoom, getPvpMatch, getPvpState, submitPvpAction, resolvePvpTurn as resolvePvpTurnRpc, forfeitPvpMatch, cancelPvpMatch, finishPvpMatch, clearPvpAction, startPvpTimer, expirePvpTimer, getPvpElo, getPvpEloLeaderboard, awardPvpElo, rematchPvpRoom, serializePvpPokemon, type PvpTurnSnapshot, type PvpRoomResult, type PvpState, type PvpEloEntry } from './game/pvp'
import { resolvePvpTurn, type PvpAction } from './game/pvpBattle'
import CasinoMinigame from './minigames/CasinoMinigame'
import MinigamePractice from './minigames/MinigamePractice'
import BackgroundLayer from './BackgroundLayer'
import BackgroundPreview from './BackgroundPreview'
import { BACKGROUNDS } from './game/backgrounds'
import type { User } from '@supabase/supabase-js'
import type { Move, Pokemon, RouteNode, RunConfig, RunModifier, DefeatSummary, RunChallenges, RunStats, Achievement, AchievementState, MetaProgression, StatusType } from './game/types'
import { t, getLanguage, setLanguage as setI18nLanguage, achName, achDesc, runModName, runModDesc, runEventTitle, runEventDesc, itemDesc, metaItemDesc, moveName, statusLabel, statusAppliedLine, themeName, themeDesc, bgName, bgDesc, type Language } from './game/i18n'

type Screen = 'setup' | 'route' | 'battle' | 'shop' | 'spin' | 'pokeRand' | 'move' | 'mega' | 'gmax' | 'primal' | 'trade' | 'blackmarket' | 'double' | 'casino' | 'victory' | 'defeat' | 'coliseum_select' | 'pvp'
type Difficulty = 'easy' | 'medium' | 'hard' | 'infinite' | 'coliseum'

const STATUS_COLORS: Record<StatusType, string> = {
  burn: '#ff8a33',
  poison: '#a855f7',
  paralysis: '#eab308',
  freeze: '#4d9bff',
  sleep: '#9b98cf',
  confusion: '#ec4899',
  flinch: '#ffcb05',
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

function TopbarCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()

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

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

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
  coliseum: 8
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

const difficultyLabels: Record<Difficulty, { title: string; desc: string }> = {
  easy: { title: 'Fácil', desc: '3 insignias · 5 rutas por etapa' },
  medium: { title: 'Intermedia', desc: '3 insignias · 10 rutas por etapa' },
  hard: { title: 'Difícil', desc: '3 insignias · 25 rutas por etapa' },
  infinite: { title: 'Infinite', desc: 'Sin límite (Aventura infinita)' },
  coliseum: { title: 'COLISEUM', desc: '8 jefes a nivel 50' },
}

function difficultyLabel(lang: Language, d: Difficulty): { title: string; desc: string } {
  if (lang === 'en') {
    const map: Record<Difficulty, { title: string; desc: string }> = {
      easy: { title: 'Easy', desc: '3 badges · 5 routes per stage' },
      medium: { title: 'Medium', desc: '3 badges · 10 routes per stage' },
      hard: { title: 'Hard', desc: '3 badges · 25 routes per stage' },
      infinite: { title: 'Infinite', desc: 'No limit (endless adventure)' },
      coliseum: { title: 'COLISEUM', desc: '8 bosses at level 50' },
    }
    return map[d]
  }
  return difficultyLabels[d]
}

const generations = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const generationRegions: Record<number, string> = {
  0: 'Todas',
  1: 'Kanto',
  2: 'Johto',
  3: 'Hoenn',
  4: 'Sinnoh',
  5: 'Unova',
  6: 'Kalos',
  7: 'Alola',
  8: 'Galar',
  9: 'Paldea'
}

const maxTeamSize = 6

// Catálogo base de la Tienda
const ALL_SHOP_ITEMS: Record<string, { price: number; desc: string }> = {
  'Potion': { price: 50, desc: 'Restaura 25 HP de un Pokémon.' },
  'Super Potion': { price: 100, desc: 'Restaura 50 HP de un Pokémon.' },
  'Hyper Potion': { price: 160, desc: 'Restaura 120 HP de un Pokémon.' },
  'Full Restore': { price: 300, desc: 'Restaura todo el HP y cura estados.' },
  'Oran Berry': { price: 30, desc: 'Restaura 15 HP de un Pokémon.' },
  'Lum Berry': { price: 60, desc: 'Restaura 30 HP y cura estados.' },
  'X Attack': { price: 75, desc: 'Aumenta permanentemente en +5 el ataque.' },
  'X Defense': { price: 75, desc: 'Aumenta permanentemente en +5 la defensa.' },
  'X Speed': { price: 75, desc: 'Aumenta permanentemente en +5 la velocidad.' },
  'Full Heal': { price: 80, desc: 'Restaura 40 HP y cura estados.' },
  'Antídoto': { price: 30, desc: 'Cura el envenenamiento de un Pokémon.' },
  'Antiquemar': { price: 30, desc: 'Cura las quemaduras de un Pokémon.' },
  'Paralizador': { price: 30, desc: 'Cura la parálisis de un Pokémon.' },
  'Despertar': { price: 30, desc: 'Despierta a un Pokémon dormido.' },
  'Descongelar': { price: 30, desc: 'Descongela a un Pokémon congelado.' },
  'Baya Caquic': { price: 35, desc: 'Cura la confusión de un Pokémon.' },
  'Baya Zreza': { price: 30, desc: 'Cura la parálisis de un Pokémon.' },
  'Baya Atania': { price: 30, desc: 'Cura las quemaduras de un Pokémon.' },
  'Baya Algama': { price: 30, desc: 'Cura el envenenamiento de un Pokémon.' },
  'Baya Safre': { price: 30, desc: 'Descongela a un Pokémon congelado.' },
  'Baya Siendrepis': { price: 30, desc: 'Despierta a un Pokémon dormido.' },
  'Revive': { price: 150, desc: 'Revive a un Pokémon debilitado con el 50% de su HP.' },
  'Max Revive': { price: 300, desc: 'Revive a un Pokémon debilitado con el HP completo.' },
  'Elixir': { price: 120, desc: 'Restaura 80 HP de un Pokémon.' },
  'Super Elixir': { price: 250, desc: 'Restaura 200 HP de un Pokémon.' },
  'Full Elixir': { price: 400, desc: 'Restaura todo el HP y cura todos los estados.' },
  'X Attack 2': { price: 150, desc: 'Aumenta permanentemente en +10 el ataque.' },
  'X Defense 2': { price: 150, desc: 'Aumenta permanentemente en +10 la defensa.' },
  'X Speed 2': { price: 150, desc: 'Aumenta permanentemente en +10 la velocidad.' },
  'Cuerda Huida': { price: 200, desc: 'Permite escapar de cualquier combate de la aventura.' },
  'Moomoo Milk': { price: 120, desc: 'Restaura 100 HP de un Pokémon.' },
  'Berry Juice': { price: 40, desc: 'Restaura 20 HP de un Pokémon.' },
  'Fresh Water': { price: 60, desc: 'Restaura 30 HP de un Pokémon.' },
  'Soda Pop': { price: 80, desc: 'Restaura 40 HP de un Pokémon.' },
  'Lemonade': { price: 100, desc: 'Restaura 60 HP de un Pokémon.' },
  'Poké Ball': { price: 20, desc: 'Una ball básica para capturar Pokémon salvajes.' },
  'Great Ball': { price: 50, desc: 'Una ball con mayor ratio de captura.' },
  'Ultra Ball': { price: 80, desc: 'Una ball con alto ratio de captura.' },
  'Master Ball': { price: 500, desc: '¡Captura cualquier Pokémon sin fallo!' },
  'Quick Ball': { price: 60, desc: 'Más efectiva si se usa al inicio del combate.' },
  'Timer Ball': { price: 60, desc: 'Más efectiva cuantos más turnos hayan pasado.' },
  'Dusk Ball': { price: 60, desc: 'Más efectiva en la oscuridad.' },
  'Net Ball': { price: 60, desc: 'Más efectiva contra tipos Agua o Bicho.' },
  'Level Ball': { price: 60, desc: 'Más efectiva si superas en nivel al rival.' },
  'Repeat Ball': { price: 60, desc: 'Más efectiva si ya capturaste esa especie.' },
  'Love Ball': { price: 60, desc: 'Más efectiva si es de la misma familia evolutiva.' },
  'Friend Ball': { price: 60, desc: 'Una ball especial amistosa.' },
  'Heavy Ball': { price: 60, desc: 'Más efectiva contra Pokémon pesados.' },
  'Fire Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Water Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Thunder Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Leaf Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Moon Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Sun Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Shiny Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Dusk Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Dawn Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Ice Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Disco MT': { price: 250, desc: 'Enseña un nuevo movimiento a un Pokémon, como el nodo Move Tutor.' },
  'Proteína': { price: 200, desc: 'Aumenta permanentemente en +15 el ataque de un Pokémon.' },
  'Calcio': { price: 200, desc: 'Aumenta permanentemente en +15 el Ataque Especial de un Pokémon.' },
  'Hierro': { price: 200, desc: 'Aumenta permanentemente en +15 la defensa de un Pokémon.' },
  'Zinc': { price: 200, desc: 'Aumenta permanentemente en +15 la Defensa Especial de un Pokémon.' },
  'Carburante': { price: 200, desc: 'Aumenta permanentemente en +15 la velocidad de un Pokémon.' },
  'Sacred Ash': { price: 400, desc: 'Revive a todos los Pokémon debilitados con el HP completo.' },
}

const EVOLUTION_STONES = ['Fire Stone', 'Water Stone', 'Thunder Stone', 'Leaf Stone', 'Moon Stone', 'Sun Stone', 'Shiny Stone', 'Dusk Stone', 'Dawn Stone', 'Ice Stone'] as const

const EVOLUTION_STONE_UNLOCK_IDS: Record<string, string> = {
  'Fire Stone': 'unlock_fire_stone',
  'Water Stone': 'unlock_water_stone',
  'Thunder Stone': 'unlock_thunder_stone',
  'Leaf Stone': 'unlock_leaf_stone',
  'Moon Stone': 'unlock_moon_stone',
  'Sun Stone': 'unlock_sun_stone',
  'Shiny Stone': 'unlock_shiny_stone',
  'Dusk Stone': 'unlock_dusk_stone',
  'Dawn Stone': 'unlock_dawn_stone',
  'Ice Stone': 'unlock_ice_stone',
}

const EVOLUTION_STONE_ITEM_NAMES: Record<string, string> = {
  'Fire Stone': 'fire-stone',
  'Water Stone': 'water-stone',
  'Thunder Stone': 'thunder-stone',
  'Leaf Stone': 'leaf-stone',
  'Moon Stone': 'moon-stone',
  'Sun Stone': 'sun-stone',
  'Shiny Stone': 'shiny-stone',
  'Dusk Stone': 'dusk-stone',
  'Dawn Stone': 'dawn-stone',
  'Ice Stone': 'ice-stone',
  'Gorra de Ash': 'gorra-de-ash',
  'Auspicious Armor': 'auspicious-armor',
  'Malicious Armor': 'malicious-armor',
}

const EVOLUTION_ITEM_UNLOCK_IDS: Record<string, string> = {
  'Metal Coat': 'unlock_metal_coat',
  "King's Rock": 'unlock_kings_rock',
  'Dragon Scale': 'unlock_dragon_scale',
  'Up-Grade': 'unlock_up_grade',
  'Dubious Disc': 'unlock_dubious_disc',
  'Reaper Cloth': 'unlock_reaper_cloth',
  'Protector': 'unlock_protector',
  'Electirizer': 'unlock_electirizer',
  'Magmarizer': 'unlock_magmarizer',
  'Prism Scale': 'unlock_prism_scale',
  'Sachet': 'unlock_sachet',
  'Whipped Dream': 'unlock_whipped_dream',
  'Gorra de Ash': 'unlock_gorra_de_ash',
  'Auspicious Armor': 'unlock_auspicious_armor',
  'Malicious Armor': 'unlock_malicious_armor',
  'Razor Claw': 'unlock_razor_claw',
  'Razor Fang': 'unlock_razor_fang',
  'Oval Stone': 'unlock_oval_stone',
  'Deep Sea Tooth': 'unlock_deep_sea_tooth',
  'Deep Sea Scale': 'unlock_deep_sea_scale',
}

// Bayas que pueden aparecer como drop. Oran y Lum siempre están disponibles;
// el resto se añaden según se desbloquean en la tienda meta.
const BERRY_DROPS = ['Oran Berry', 'Lum Berry', 'Baya Zreza', 'Baya Atania', 'Baya Algama', 'Baya Safre', 'Baya Siendrepis', 'Baya Caquic']

// Ids de las evoluciones de Eevee (Vaporeon, Jolteon, Flareon, Espeon, Umbreon,
// Leafeon, Glaceon, Sylveon). Se usan para el logro "Familia Eevee".
const EEVEE_EVOLUTIONS = [134, 135, 136, 196, 197, 470, 471, 700]

const itemDescriptions: Record<string, string> = {
  Potion: 'Restaura 25 HP al Pokémon activo.',
  'Super Potion': 'Restaura 50 HP al Pokémon activo.',
  'Hyper Potion': 'Restaura 120 HP al Pokémon activo.',
  'Full Restore': 'Restaura todo el HP y cura estados.',
  'X Attack': 'Aumenta permanentemente en +5 el ataque.',
  'X Defense': 'Aumenta permanentemente en +5 la defensa.',
  'X Speed': 'Aumenta permanentemente en +5 la velocidad.',
  'Oran Berry': 'Restaura 15 HP al Pokémon activo.',
  'Lum Berry': 'Restaura 30 HP y cura estados.',
  'Full Heal': 'Restaura 40 HP y cura estados.',
  'Antídoto': 'Cura el envenenamiento del Pokémon activo.',
  'Antiquemar': 'Cura las quemaduras del Pokémon activo.',
  'Paralizador': 'Cura la parálisis del Pokémon activo.',
  'Despertar': 'Despierta al Pokémon activo.',
  'Descongelar': 'Descongela al Pokémon activo.',
  'Baya Caquic': 'Cura la confusión del Pokémon activo.',
  'Baya Zreza': 'Cura la parálisis del Pokémon activo.',
  'Baya Atania': 'Cura las quemaduras del Pokémon activo.',
  'Baya Algama': 'Cura el envenenamiento del Pokémon activo.',
  'Baya Safre': 'Descongela al Pokémon activo.',
  'Baya Siendrepis': 'Despierta al Pokémon activo.',
  'Revive': 'Revive a un Pokémon debilitado con 50% HP.',
  'Max Revive': 'Revive a un Pokémon debilitado con el HP completo.',
  'Elixir': 'Restaura 80 HP al Pokémon activo.',
  'Super Elixir': 'Restaura 200 HP al Pokémon activo.',
  'Full Elixir': 'Restaura todo el HP y cura estados.',
  'X Attack 2': 'Aumenta permanentemente en +10 el ataque.',
  'X Defense 2': 'Aumenta permanentemente en +10 la defensa.',
  'X Speed 2': 'Aumenta permanentemente en +10 la velocidad.',
  'Poké Ball': 'Una ball básica para capturar Pokémon salvajes.',
  'Great Ball': 'Una ball con mayor ratio de captura (x1.5).',
  'Ultra Ball': 'Una ball con alto ratio de captura (x2).',
  'Master Ball': '¡Captura cualquier Pokémon sin fallo!',
  'Quick Ball': 'Más efectiva al inicio (x5 en turno 1).',
  'Timer Ball': 'Mejora con los turnos (hasta x4).',
  'Dusk Ball': 'Efectiva en la oscuridad (x3).',
  'Net Ball': 'Efectiva contra Agua/Bicho (x3).',
  'Level Ball': 'Mejor si superas en nivel al rival (hasta x8).',
  'Repeat Ball': 'x3.5 si ya capturaste esa especie.',
  'Love Ball': 'x8 si es de la misma familia evolutiva.',
  'Friend Ball': 'Una ball especial amistosa (x1).',
  'Heavy Ball': 'Mejor contra Pokémon pesados (hasta x4).',
  'Mega Stone': 'Permite mega-evolucionar 1 vez por combate.',
  'Dynamax Band': 'Permite gigamaximar 1 vez por combate (3 turnos).',
  'Prisma Rojo': 'Despierta la Primal Reversion de Groudon (1 vez por combate).',
  'Prisma Azul': 'Despierta la Primal Reversion de Kyogre (1 vez por combate).',
  'Cuerda Huida': 'Escapa de cualquier combate de la aventura.',
  'Moomoo Milk': 'Restaura 100 HP de un Pokémon.',
  'Berry Juice': 'Restaura 20 HP de un Pokémon.',
  'Fresh Water': 'Restaura 30 HP de un Pokémon.',
  'Soda Pop': 'Restaura 40 HP de un Pokémon.',
  'Lemonade': 'Restaura 60 HP de un Pokémon.',
  'Auspicious Armor': 'Armadura que evoluciona a Charcadet en Armarouge.',
  'Malicious Armor': 'Armadura que evoluciona a Charcadet en Ceruledge.',
  'Disco MT': 'Úsalo para enseñar un nuevo movimiento a tu Pokémon activo, igual que el nodo Move Tutor.',
  'Proteína': 'Aumenta permanentemente en +15 el ataque del Pokémon activo.',
  'Calcio': 'Aumenta permanentemente en +15 el Ataque Especial del Pokémon activo.',
  'Hierro': 'Aumenta permanentemente en +15 la defensa del Pokémon activo.',
  'Zinc': 'Aumenta permanentemente en +15 la Defensa Especial del Pokémon activo.',
  'Carburante': 'Aumenta permanentemente en +15 la velocidad del Pokémon activo.',
  'Sacred Ash': 'Revive a todos los Pokémon debilitados con el HP completo.',
}

const ITEM_SPRITES: Record<string, string> = {
  'Potion': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png',
  'Super Potion': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/super-potion.png',
  'Hyper Potion': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hyper-potion.png',
  'Full Restore': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/full-restore.png',
  'Oran Berry': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/oran-berry.png',
  'Lum Berry': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lum-berry.png',
  'X Attack': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-attack.png',
  'X Defense': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-defense.png',
  'X Speed': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-speed.png',
  'Full Heal': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/full-heal.png',
  'Antídoto': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/antidote.png',
  'Antiquemar': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/burn-heal.png',
  'Paralizador': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/paralyze-heal.png',
  'Despertar': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/awakening.png',
  'Descongelar': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ice-heal.png',
  'Baya Caquic': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/persim-berry.png',
  'Baya Zreza': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/cheri-berry.png',
  'Baya Atania': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rawst-berry.png',
  'Baya Algama': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/pecha-berry.png',
  'Baya Safre': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/aspear-berry.png',
  'Baya Siendrepis': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/chesto-berry.png',
  'Revive': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/revive.png',
  'Max Revive': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/max-revive.png',
  'Muscle Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/muscle-band.png',
  'Wise Glasses': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/wise-glasses.png',
  'Choice Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/choice-band.png',
  'Leftovers': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/leftovers.png',
  'Focus Sash': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-sash.png',
  'Assault Vest': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/assault-vest.png',
  'Quick Claw': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/quick-claw.png',
  'Eviolite': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/eviolite.png',
  'Life Orb': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/life-orb.png',
  'Rocky Helmet': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rocky-helmet.png',
  'Scope Lens': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/scope-lens.png',
  'Shell Bell': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shell-bell.png',
  'Choice Scarf': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/choice-scarf.png',
  'Babiri Berry': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/babiri-berry.png',
  'Big Root': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/big-root.png',
  'Wide Lens': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/wide-lens.png',
  'Sitrus Berry': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sitrus-berry.png',
  'Guts Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/muscle-band.png',
  'Vest Protector': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/assault-vest.png',
  'Focus Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-band.png',
  'Rare Candy': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png',
  'Elixir': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/elixir.png',
  'Super Elixir': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/max-elixir.png',
  'Full Elixir': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/max-potion.png',
  'X Attack 2': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-attack.png',
  'X Defense 2': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-defense.png',
  'X Speed 2': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-speed.png',
  'Dragon Fang': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-fang.png',
  'Guardian Charm': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/guard-spec.png',
  'Berserker Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/macho-brace.png',
  'Phantom Cloak': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/black-sludge.png',
  'Swift Feather': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-bracer.png',
  'Iron Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/iron-ball.png',
  'Vampire Fang': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/float-stone.png',
  'Cursed Blade': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/razor-claw.png',
  'Mega Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/key-stone.png',
  'Dynamax Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-bracer.png',
  'Prisma Rojo': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/red-orb.png',
  'Prisma Azul': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/blue-orb.png',
  'Poké Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
  'Great Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png',
  'Ultra Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png',
  'Master Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png',
  'Quick Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/quick-ball.png',
  'Timer Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/timer-ball.png',
  'Dusk Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dusk-ball.png',
  'Net Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/net-ball.png',
  'Level Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/level-ball.png',
  'Repeat Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/repeat-ball.png',
  'Love Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/love-ball.png',
  'Friend Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/friend-ball.png',
  'Heavy Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/heavy-ball.png',
  'Fire Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fire-stone.png',
  'Water Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/water-stone.png',
  'Thunder Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/thunder-stone.png',
  'Leaf Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/leaf-stone.png',
  'Moon Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/moon-stone.png',
  'Sun Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sun-stone.png',
  'Shiny Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shiny-stone.png',
  'Dusk Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dusk-stone.png',
  'Dawn Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dawn-stone.png',
  'Ice Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ice-stone.png',
  'Metal Coat': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/metal-coat.png',
  'Dragon Scale': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-scale.png',
  'Up-Grade': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/up-grade.png',
  'Dubious Disc': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dubious-disc.png',
  'Reaper Cloth': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/reaper-cloth.png',
  'Protector': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/protector.png',
  'Electirizer': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/electirizer.png',
  'Magmarizer': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/magmarizer.png',
  'Prism Scale': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/prism-scale.png',
  'Sachet': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sachet.png',
  'Whipped Dream': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/whipped-dream.png',
  'Cuerda Huida': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/escape-rope.png',
  'Moomoo Milk': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/moomoo-milk.png',
  'Berry Juice': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/berry-juice.png',
  'Fresh Water': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fresh-water.png',
  'Soda Pop': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/soda-pop.png',
  'Lemonade': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lemonade.png',
  'Disco MT': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-normal.png',
  'Proteína': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/protein.png',
  'Calcio': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/calcium.png',
  'Hierro': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/iron.png',
  'Zinc': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/zinc.png',
  'Carburante': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/carbos.png',
  'Sacred Ash': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sacred-ash.png',
  'Luxury Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/luxury-ball.png',
  'Premier Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/premier-ball.png',
  'Fast Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fast-ball.png',
  'Focus Sash II': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-sash.png',
  'Scope Lens II': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/scope-lens.png',
  'Shell Bell II': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shell-bell.png',
  'Assault Vest II': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/assault-vest.png',
  'Leftovers II': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/leftovers.png',
  'Quick Claw II': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/quick-claw.png',
  'Razor Claw': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/razor-claw.png',
  'Razor Fang': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/razor-fang.png',
  'Oval Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/oval-stone.png',
  'Deep Sea Tooth': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/deep-sea-tooth.png',
  'Deep Sea Scale': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/deep-sea-scale.png',
  'Repartir Exp': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/exp-share.png',
}

interface HoldableItem {
  name: string
  desc: string
  price: number
  attackMod?: number
  defenseMod?: number
  spAttackMod?: number
  spDefenseMod?: number
  speedMod?: number
  maxHpMod?: number
  healPerTurn?: number
  damageBoost?: number
  damageReduction?: number
  critChance?: number
  lifesteal?: number
  lowHpBonus?: number
  firstStrikeBonus?: number
  isMegaStone?: boolean
  isGmaxBand?: boolean
  isPrimalOrb?: boolean
  isExpShare?: boolean
}

const HOLDABLE_ITEMS: Record<string, HoldableItem> = {
  'Muscle Band': { name: 'Muscle Band', desc: '+15% Ataque', price: 200, attackMod: 0.15 },
  'Wise Glasses': { name: 'Wise Glasses', desc: '+15% At. Esp.', price: 200, spAttackMod: 0.15 },
  'Choice Band': { name: 'Choice Band', desc: '+25% Ataque', price: 350, attackMod: 0.25 },
  'Leftovers': { name: 'Leftovers', desc: 'Recupera 6 HP por turno', price: 300, healPerTurn: 6 },
  'Focus Sash': { name: 'Focus Sash', desc: '+20 HP máximos', price: 250, maxHpMod: 20 },
  'Assault Vest': { name: 'Assault Vest', desc: '+20% Def. Esp.', price: 300, spDefenseMod: 0.20 },
  'Quick Claw': { name: 'Quick Claw', desc: '+20% Velocidad', price: 250, speedMod: 0.20 },
  'Eviolite': { name: 'Eviolite', desc: '+10% Defensa y Def. Esp.', price: 200, defenseMod: 0.10, spDefenseMod: 0.10 },
  'Life Orb': { name: 'Life Orb', desc: '+30% Daño, -5 HP por turno', price: 400, damageBoost: 0.30, healPerTurn: -5 },
  'Rocky Helmet': { name: 'Rocky Helmet', desc: '+15% Defensa', price: 200, defenseMod: 0.15 },
  'Scope Lens': { name: 'Scope Lens', desc: '20% Golpe Crítico', price: 250, critChance: 0.20 },
  'Shell Bell': { name: 'Shell Bell', desc: '20% Robo de Vida', price: 300, lifesteal: 0.20 },
  'Choice Scarf': { name: 'Choice Scarf', desc: '+30% Velocidad', price: 350, speedMod: 0.30 },
  'Babiri Berry': { name: 'Babiri Berry', desc: '20% Reducción de Daño', price: 250, damageReduction: 0.20 },
  'Big Root': { name: 'Big Root', desc: '25% Robo de Vida', price: 350, lifesteal: 0.25 },
  'Wide Lens': { name: 'Wide Lens', desc: '15% Crítico, +10% Velocidad', price: 200, critChance: 0.15, speedMod: 0.10 },
  'Sitrus Berry': { name: 'Sitrus Berry', desc: '+15 HP máximos, +8 HP/turno', price: 200, maxHpMod: 15, healPerTurn: 8 },
  'Guts Band': { name: 'Guts Band', desc: '+20% Ataque, +15% daño bajo 30% HP', price: 300, attackMod: 0.20, lowHpBonus: 0.15 },
  'Vest Protector': { name: 'Vest Protector', desc: '+25% Defensa, 15% Reducción daño', price: 400, defenseMod: 0.25, damageReduction: 0.15 },
  'Focus Band': { name: 'Focus Band', desc: '25% Crítico, +10% Ataque', price: 300, critChance: 0.25, attackMod: 0.10 },
  'Dragon Fang': { name: 'Dragon Fang', desc: '+20% Ataque, +10% Velocidad', price: 350, attackMod: 0.20, speedMod: 0.10 },
  'Guardian Charm': { name: 'Guardian Charm', desc: '+15% Def. Esp., +10 HP máximos', price: 300, spDefenseMod: 0.15, maxHpMod: 10 },
  'Berserker Band': { name: 'Berserker Band', desc: '+30% Ataque bajo 25% HP', price: 400, attackMod: 0.10, lowHpBonus: 0.30 },
  'Phantom Cloak': { name: 'Phantom Cloak', desc: '10% Reducción daño, +10% Velocidad', price: 350, damageReduction: 0.10, speedMod: 0.10 },
  'Swift Feather': { name: 'Swift Feather', desc: '+15% Velocidad, 10% Crítico', price: 300, speedMod: 0.15, critChance: 0.10 },
  'Iron Ball': { name: 'Iron Ball', desc: '+25% Defensa, -10% Velocidad', price: 250, defenseMod: 0.25, speedMod: -0.10 },
  'Vampire Fang': { name: 'Vampire Fang', desc: '15% Robo de Vida', price: 350, lifesteal: 0.15 },
  'Cursed Blade': { name: 'Cursed Blade', desc: '+35% Ataque, -5 HP por turno', price: 450, attackMod: 0.35, healPerTurn: -5 },
  'Mega Stone': { name: 'Mega Stone', desc: 'Permite mega-evolucionar 1 vez por combate', price: 700, isMegaStone: true },
  'Dynamax Band': { name: 'Dynamax Band', desc: 'Permite gigamaximar 1 vez por combate (3 turnos)', price: 0, isGmaxBand: true },
  'Prisma Rojo': { name: 'Prisma Rojo', desc: 'Despierta la Primal Reversion de Groudon (1 vez por combate)', price: 0, isPrimalOrb: true },
  'Prisma Azul': { name: 'Prisma Azul', desc: 'Despierta la Primal Reversion de Kyogre (1 vez por combate)', price: 0, isPrimalOrb: true },
  'Metal Coat': { name: 'Metal Coat', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  "King's Rock": { name: "King's Rock", desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Dragon Scale': { name: 'Dragon Scale', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Up-Grade': { name: 'Up-Grade', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Dubious Disc': { name: 'Dubious Disc', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Reaper Cloth': { name: 'Reaper Cloth', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Protector': { name: 'Protector', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Electirizer': { name: 'Electirizer', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Magmarizer': { name: 'Magmarizer', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Prism Scale': { name: 'Prism Scale', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Sachet': { name: 'Sachet', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Whipped Dream': { name: 'Whipped Dream', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Focus Sash II': { name: 'Focus Sash II', desc: '+40 HP máximos', price: 350, maxHpMod: 40 },
  'Scope Lens II': { name: 'Scope Lens II', desc: '30% Golpe Crítico', price: 350, critChance: 0.30 },
  'Shell Bell II': { name: 'Shell Bell II', desc: '30% Robo de Vida', price: 400, lifesteal: 0.30 },
  'Assault Vest II': { name: 'Assault Vest II', desc: '+30% Def. Esp.', price: 400, spDefenseMod: 0.30 },
  'Leftovers II': { name: 'Leftovers II', desc: 'Recupera 12 HP por turno', price: 400, healPerTurn: 12 },
  'Quick Claw II': { name: 'Quick Claw II', desc: '+30% Velocidad', price: 350, speedMod: 0.30 },
  'Razor Claw': { name: 'Razor Claw', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Razor Fang': { name: 'Razor Fang', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Oval Stone': { name: 'Oval Stone', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Deep Sea Tooth': { name: 'Deep Sea Tooth', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Deep Sea Scale': { name: 'Deep Sea Scale', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Repartir Exp': { name: 'Repartir Exp', desc: 'Todos los Pokémon del PC ganan 1 nivel tras cada combate.', price: 130, isExpShare: true },
}

const HOLDABLE_ITEM_NAMES = Object.keys(HOLDABLE_ITEMS)

// --- Pokéballs ---
interface PokeBallDef {
  name: string
  rate: number
  desc: string
  price: number
  spriteKey: string
  isMaster?: boolean
  rateFn?: (target: Pokemon, turns: number, alreadyCaught: boolean, playerLevel?: number) => number
}

const POKEBALLS: PokeBallDef[] = [
  { name: 'Poké Ball', rate: 1, desc: 'Una ball básica para capturar Pokémon.', price: 20, spriteKey: 'poke-ball' },
  { name: 'Great Ball', rate: 1.5, desc: 'Una ball con mayor ratio de captura.', price: 50, spriteKey: 'great-ball' },
  { name: 'Ultra Ball', rate: 2, desc: 'Una ball con alto ratio de captura.', price: 80, spriteKey: 'ultra-ball' },
  { name: 'Master Ball', rate: 99, desc: '¡Captura cualquier Pokémon sin fallo!', price: 500, spriteKey: 'master-ball', isMaster: true },
  { name: 'Quick Ball', rate: 1, desc: 'Más efectiva si se usa al inicio del combate.', price: 60, spriteKey: 'quick-ball', rateFn: (_, turns) => turns <= 1 ? 5 : 1 },
  { name: 'Timer Ball', rate: 1, desc: 'Más efectiva cuantos más turnos hayan pasado.', price: 60, spriteKey: 'timer-ball', rateFn: (_, turns) => Math.min(1 + turns * 0.3, 4) },
  { name: 'Dusk Ball', rate: 1, desc: 'Más efectiva en la oscuridad (x3).', price: 60, spriteKey: 'dusk-ball', rateFn: () => 3 },
  { name: 'Net Ball', rate: 1, desc: 'Más efectiva contra tipos Agua o Bicho (x3).', price: 60, spriteKey: 'net-ball', rateFn: (target) => target.types?.some(t => t === 'water' || t === 'bug') ? 3 : 1 },
  { name: 'Level Ball', rate: 1, desc: 'Más efectiva si tu nivel supera al del rival.', price: 60, spriteKey: 'level-ball', rateFn: (target, _, __, playerLevel) => { const ratio = (playerLevel ?? 50) / target.level; return ratio >= 4 ? 8 : ratio >= 2 ? 4 : ratio >= 1 ? 2 : 1; } },
  { name: 'Repeat Ball', rate: 1, desc: 'Más efectiva si ya capturaste esta especie (x3.5).', price: 60, spriteKey: 'repeat-ball', rateFn: (_, __, alreadyCaught) => alreadyCaught ? 3.5 : 1 },
  { name: 'Love Ball', rate: 1, desc: 'Más efectiva si es de la misma familia evolutiva (x8).', price: 60, spriteKey: 'love-ball', rateFn: (_, __, alreadyCaught) => alreadyCaught ? 8 : 1 },
  { name: 'Friend Ball', rate: 1, desc: 'Hace más amistoso al Pokémon capturado.', price: 60, spriteKey: 'friend-ball' },
  { name: 'Heavy Ball', rate: 1, desc: 'Más efectiva contra Pokémon pesados.', price: 60, spriteKey: 'heavy-ball', rateFn: (target) => Math.max(1, Math.min(Math.floor(target.maxHp / 40), 4)) },
  { name: 'Luxury Ball', rate: 1.2, desc: 'Un poco más efectiva que la Poké Ball (x1.2).', price: 40, spriteKey: 'luxury-ball' },
  { name: 'Premier Ball', rate: 1, desc: 'Una ball estándar y elegante.', price: 30, spriteKey: 'premier-ball' },
  { name: 'Fast Ball', rate: 1, desc: 'Más efectiva contra Pokémon muy rápidos (x4).', price: 60, spriteKey: 'fast-ball', rateFn: (target) => target.speed >= 100 ? 4 : 1 },
]

const POKEBALL_NAMES = POKEBALLS.map(b => b.name)
const POKEBALL_RATES: Record<string, number> = {}
for (const b of POKEBALLS) POKEBALL_RATES[b.name] = b.rate
const POKEBALL_DEFS: Record<string, PokeBallDef> = {}
for (const b of POKEBALLS) POKEBALL_DEFS[b.name] = b
const POKEBALL_PRICES: Record<string, number> = {}
for (const b of POKEBALLS) POKEBALL_PRICES[b.name] = b.price

// IDs de meta-shop para desbloquear pokeballs
const POKEBALL_UNLOCK_IDS: Record<string, string> = {
  'Great Ball': 'unlock_great_ball',
  'Ultra Ball': 'unlock_ultra_ball',
  'Quick Ball': 'unlock_quick_ball',
  'Timer Ball': 'unlock_timer_ball',
  'Dusk Ball': 'unlock_dusk_ball',
  'Net Ball': 'unlock_net_ball',
  'Level Ball': 'unlock_level_ball',
  'Repeat Ball': 'unlock_repeat_ball',
  'Love Ball': 'unlock_love_ball',
  'Friend Ball': 'unlock_friend_ball',
  'Heavy Ball': 'unlock_heavy_ball',
  'Master Ball': 'unlock_master_ball',
  'Luxury Ball': 'unlock_luxury_ball',
  'Premier Ball': 'unlock_premier_ball',
  'Fast Ball': 'unlock_fast_ball',
}

function getPokeBallRate(ballName: string, target: Pokemon, turns: number, alreadyCaught: boolean, playerLevel?: number): number {
  const def = POKEBALL_DEFS[ballName]
  if (!def) return 1
  if (def.rateFn) return def.rateFn(target, turns, alreadyCaught, playerLevel)
  return def.rate
}

const GYM_BADGES = [
  { id: 'boulder', name: 'Boulder Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/1.png' },
  { id: 'cascade', name: 'Cascade Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/2.png' },
  { id: 'thunder', name: 'Thunder Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/3.png' },
  { id: 'rainbow', name: 'Rainbow Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/4.png' },
  { id: 'soul', name: 'Soul Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/5.png' },
  { id: 'marsh', name: 'Marsh Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/6.png' },
  { id: 'volcano', name: 'Volcano Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/7.png' },
  { id: 'earth', name: 'Earth Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/8.png' },
  { id: 'zephyr', name: 'Zephyr Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/9.png' },
  { id: 'hive', name: 'Hive Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/10.png' },
  { id: 'plain', name: 'Plain Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/11.png' },
  { id: 'fog', name: 'Fog Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/12.png' },
  { id: 'storm', name: 'Storm Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/13.png' },
  { id: 'mineral', name: 'Mineral Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/14.png' },
  { id: 'glacier', name: 'Glacier Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/15.png' },
  { id: 'rising', name: 'Rising Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/16.png' },
  { id: 'stone', name: 'Stone Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/17.png' },
  { id: 'knuckle', name: 'Knuckle Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/18.png' },
  { id: 'dynamo', name: 'Dynamo Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/19.png' },
  { id: 'heat', name: 'Heat Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/20.png' },
  { id: 'balance', name: 'Balance Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/21.png' },
  { id: 'feather', name: 'Feather Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/22.png' },
  { id: 'mind', name: 'Mind Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/23.png' },
  { id: 'rain', name: 'Rain Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/24.png' },
  { id: 'coal', name: 'Coal Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/25.png' },
  { id: 'forest', name: 'Forest Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/26.png' },
  { id: 'cobble', name: 'Cobble Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/27.png' },
  { id: 'fen', name: 'Fen Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/28.png' },
  { id: 'relic', name: 'Relic Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/29.png' },
  { id: 'mine', name: 'Mine Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/30.png' },
  { id: 'icicle', name: 'Icicle Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/31.png' },
  { id: 'beacon', name: 'Beacon Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/32.png' },
]

const MEGA_CAPABLE_IDS = new Set([
  3, 6, 9, 15, 18, 26, 36, 65, 71, 80, 94, 115, 121, 127, 130, 142, 149, 150,
  154, 160, 181, 208, 212, 214, 227, 229, 248,
  254, 257, 260, 282, 302, 303, 306, 308,   310, 319, 323, 334, 354, 358, 359, 362, 373, 376, 380, 381, 384, 398,
  428, 445, 448, 460, 475, 478, 485, 491,
  500, 530, 531, 545, 560, 604, 609, 623,
  652, 655, 658, 668, 670, 678, 687, 689, 691, 701, 718, 719,
  740, 768, 780, 801, 807,
  870, 952, 970, 978, 998,
])

const MEGA_FORM_IDS: Record<number, number | number[]> = {
  3: 10033, 6: [10034, 10035], 9: 10036, 15: 10090, 18: 10073,
  26: [10304, 10305], 36: 10278, 65: 10037, 71: 10279, 80: 10071,
  94: 10038, 115: 10039, 121: 10280, 127: 10040, 130: 10041,
  142: 10042, 149: 10281, 150: [10043, 10044],
  154: 10282, 160: 10283, 181: 10045, 208: 10072, 212: 10046,
  214: 10047, 227: 10284, 229: 10048, 248: 10049,
  254: 10065, 257: 10050, 260: 10064, 282: 10051, 302: 10066,
  303: 10052, 306: 10053, 308: 10054,   310: 10055, 319: 10070, 323: 10087, 334: 10067, 354: 10056,
  358: 10306, 359: [10057, 10307], 362: 10074, 373: 10089, 376: 10076,
  380: 10062, 381: 10063, 384: 10079, 398: 10308,
  428: 10088, 445: [10058, 10309], 448: [10059, 10310],
  460: 10060, 475: 10068, 478: 10285, 485: 10311, 491: 10312,
  500: 10286, 530: 10287, 531: 10069, 545: 10288, 560: 10289,
  604: 10290, 609: 10291, 623: 10313,
  652: 10292, 655: 10293, 658: 10294, 668: 10295, 670: 10296,
  678: [10314, 10326], 687: 10297, 689: 10298, 691: 10299,
  701: 10300, 718: 10301, 719: 10075,
  740: 10315, 768: 10316, 780: 10302, 801: [10317, 10318],
  807: 10319,
  870: 10303, 952: 10320, 970: 10321, 978: [10322, 10323, 10324],
  998: 10325,
}

const GMAX_CAPABLE_IDS = new Set([
  3, 6, 9, 12, 25, 52, 68, 94, 99, 131, 133, 143, 569, 809,
  812, 815, 818, 823, 826, 834, 839, 841, 842, 844, 849, 851,
  858, 861, 869, 879, 884, 892,
])

const GMAX_FORM_IDS: Record<number, number | number[]> = {
  3: 10195, 6: 10196, 9: 10197, 12: 10198, 25: 10199, 52: 10200,
  68: 10201, 94: 10202, 99: 10203, 131: 10204, 133: 10205, 143: 10206,
  569: 10207, 809: 10208, 812: 10209, 815: 10210, 818: 10211,
  823: 10212, 826: 10213, 834: 10214, 839: 10215, 841: 10216,
  842: 10217, 844: 10218, 849: [10219, 10228], 851: 10220,
  858: 10221, 861: 10222, 869: 10223, 879: 10224, 884: 10225,
  892: [10226, 10227],
}

const PRIMAL_CAPABLE_IDS = new Set([
  382, 383,
])

const PRIMAL_FORM_IDS: Record<number, number> = {
  382: 10077,
  383: 10078,
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', name: 'Primera Victoria', desc: 'Gana tu primera partida', icon: '🏆', hidden: false, reward: 15 },
  { id: 'streak_3', name: 'En Racha', desc: 'Gana 3 partidas seguidas', icon: '🔥', hidden: false, reward: 25 },
  { id: 'streak_5', name: 'Incombustible', desc: 'Gana 5 partidas seguidas', icon: '🌋', hidden: false, reward: 40 },
  { id: 'streak_10', name: 'Leyenda Viva', desc: 'Gana 10 partidas seguidas', icon: '👑', hidden: false, reward: 60 },
  { id: 'nuzlocke_win', name: 'Superviviente', desc: 'Gana una partida con Nuzlocke', icon: '💀', hidden: false, reward: 60 },
  { id: 'solo_win', name: 'Uno Contra Todos', desc: 'Gana con solo 1 Pokémon en el equipo', icon: '⭐', hidden: false, reward: 100 },
  { id: 'speedrun_win', name: 'Relámpago', desc: 'Gana una partida con Speedrun activo', icon: '⚡', hidden: false, reward: 60 },
  { id: 'no_item_win', name: 'Purista', desc: 'Gana sin usar items', icon: '🚫', hidden: false, reward: 60 },
  { id: 'ironman_win', name: 'Invencible', desc: 'Gana una partida Ironman', icon: '🛡️', hidden: false, reward: 60 },
  { id: 'perfect_battle', name: 'Flawless', desc: 'Gana un combate sin recibir daño', icon: '✨', hidden: false, reward: 40 },
  { id: 'one_shot', name: 'Golpe Definitivo', desc: 'Derrota a un Pokémon enemigo en 1 golpe', icon: '💥', hidden: false, reward: 15 },
  { id: 'comeback', name: 'Resurgir', desc: 'Gana un combate con solo 1 Pokémon con ≤10% HP', icon: '❤️‍🔥', hidden: false, reward: 25 },
  { id: 'collector_10', name: 'Coleccionista', desc: 'Captura 10 Pokémon en una partida', icon: '📦', hidden: false, reward: 15 },
  { id: 'collector_25', name: 'Maestro Pokédex', desc: 'Captura 25 Pokémon en una partida', icon: '📖', hidden: false, reward: 40 },
  { id: 'rich', name: 'Magnate', desc: 'Acumula $999 en una partida', icon: '💰', hidden: false, reward: 25 },
  { id: 'crit_master', name: 'Crítico Nato', desc: 'Lanza 5 golpes críticos en una partida', icon: '🎯', hidden: false, reward: 25 },
  { id: 'all_gens', name: 'Viajero Multiversal', desc: 'Gana al menos 1 partida en cada generación', icon: '🌍', hidden: false, reward: 40 },
  { id: 'infinite_20', name: 'Infinito y Más Allá', desc: 'Llega al nodo 20 en modo Infinite', icon: '🚀', hidden: false, reward: 40 },
  { id: 'shiny_catch', name: 'Afortunado', desc: 'Captura un Pokémon shiny', icon: '✨', hidden: false, reward: 25 },
  { id: 'legendary_catch', name: 'Cazador de Leyendas', desc: 'Captura un Pokémon con BST ≥ 600', icon: '🐉', hidden: false, reward: 40 },
  { id: 'daily_3', name: 'Habitual', desc: 'Juega desafíos diarios', icon: '📅', hidden: false, reward: 15 },
  { id: 'meta_100', name: 'Inversor', desc: 'Acumula 100 PokéCoins', icon: '🪙', hidden: false, reward: 25 },
  { id: 'boss_rush_win', name: 'Rush Total', desc: 'Gana una partida Boss Rush', icon: '🏆', hidden: false, reward: 25 },
  { id: 'hard_win', name: 'Veterano', desc: 'Gana una partida en dificultad Hard', icon: '🎖️', hidden: false, reward: 25 },
  { id: 'gauntlet_win', name: 'Gauntlet Master', desc: 'Gana una partida Challenge Gauntlet', icon: '🎯', hidden: false, reward: 40 },
  { id: 'synergy_master', name: 'Maestro de Sinergias', desc: 'Activa una sinergia de items', icon: '🔗', hidden: false, reward: 15 },
  { id: 'super_effective_10', name: 'Tierra de Nadie', desc: 'Landa 10 golpes supereficaces en una partida', icon: '🌿', hidden: false, reward: 15 },
  { id: 'big_spender', name: 'Derrochador', desc: 'Gasta $500 en tiendas en una partida', icon: '💸', hidden: false, reward: 15 },
  { id: 'rookie', name: 'Novato', desc: 'Gana una partida en dificultad Fácil', icon: '🐣', hidden: false, reward: 15 },
  { id: 'infinite_50', name: 'Sin Límites', desc: 'Llega al nodo 50 en modo Infinite', icon: '🌌', hidden: false, reward: 60 },
  { id: 'full_team', name: 'Equipo Completo', desc: 'Gana con 6 Pokémon en el equipo', icon: '🤝', hidden: false, reward: 15 },
  { id: 'battle_20', name: 'Veterano de Guerra', desc: 'Gana 20 combates en una partida', icon: '⚔️', hidden: false, reward: 25 },
  { id: 'item_user_10', name: 'Experimentado', desc: 'Usa 10 objetos en una partida', icon: '🧪', hidden: false, reward: 15 },
  { id: 'gambler', name: 'Jugador', desc: 'Gana un nodo Spin', icon: '🎰', hidden: false, reward: 15 },
  { id: 'pokeRand_master', name: 'Maestro Aleatorio', desc: 'Gana un nodo PokeRand', icon: '🎲', hidden: false, reward: 15 },
  { id: 'streak_15', name: 'Racha Imparable', desc: 'Gana 15 partidas seguidas', icon: '🔥', hidden: false, reward: 100 },
  { id: 'streak_20', name: 'Leyenda de Racha', desc: 'Gana 20 partidas seguidas', icon: '🔥', hidden: false, reward: 200 },
  { id: 'streak_25', name: 'Dios de la Racha', desc: 'Gana 25 partidas seguidas', icon: '🔥', hidden: false, reward: 250 },
  { id: 'battle_50', name: 'Comandante', desc: 'Gana 50 combates en una partida', icon: '⚔️', hidden: false, reward: 40 },
  { id: 'battle_100', name: 'General', desc: 'Gana 100 combates en una partida', icon: '⚔️', hidden: false, reward: 60 },
  { id: 'battle_200', name: 'Estratega', desc: 'Gana 200 combates en una partida', icon: '⚔️', hidden: false, reward: 100 },
  { id: 'battle_500', name: 'Conquistador', desc: 'Gana 500 combates en una partida', icon: '⚔️', hidden: false, reward: 250 },
  { id: 'damage_1000', name: 'Aprendiz de Daño', desc: 'Inflige 1000 de daño en una partida', icon: '💥', hidden: false, reward: 25 },
  { id: 'damage_5000', name: 'Especialista en Daño', desc: 'Inflige 5000 de daño en una partida', icon: '💥', hidden: false, reward: 40 },
  { id: 'damage_10000', name: 'Maestro del Daño', desc: 'Inflige 10000 de daño en una partida', icon: '💥', hidden: false, reward: 60 },
  { id: 'damage_50000', name: 'Dios del Daño', desc: 'Inflige 50000 de daño en una partida', icon: '💥', hidden: false, reward: 100 },
  { id: 'tank_500', name: 'Escudo Humano', desc: 'Recibe 500 de daño en una partida', icon: '🛡️', hidden: false, reward: 25 },
  { id: 'tank_1000', name: 'Muro Viviente', desc: 'Recibe 1000 de daño en una partida', icon: '🛡️', hidden: false, reward: 40 },
  { id: 'crit_10', name: 'Crítico Frecuente', desc: 'Lanza 10 golpes críticos en una partida', icon: '🎯', hidden: false, reward: 40 },
  { id: 'crit_20', name: 'Crítico Experto', desc: 'Lanza 20 golpes críticos en una partida', icon: '🎯', hidden: false, reward: 60 },
  { id: 'crit_50', name: 'Crítico Legendario', desc: 'Lanza 50 golpes críticos en una partida', icon: '🎯', hidden: false, reward: 100 },
  { id: 'super_effective_25', name: 'Eficaz Mejorado', desc: 'Acierta 25 golpes supereficaces', icon: '🌿', hidden: false, reward: 25 },
  { id: 'super_effective_50', name: 'Súper Eficaz', desc: 'Acierta 50 golpes supereficaces', icon: '🌿', hidden: false, reward: 40 },
  { id: 'super_effective_100', name: 'Maestro de Tipos', desc: 'Acierta 100 golpes supereficaces', icon: '🌿', hidden: false, reward: 60 },
  { id: 'one_shot_5', name: 'Fulminante', desc: 'Derrota 5 Pokémon de 1 golpe', icon: '💥', hidden: false, reward: 40 },
  { id: 'one_shot_10', name: 'Aniquilador', desc: 'Derrota 10 Pokémon de 1 golpe', icon: '💥', hidden: false, reward: 60 },
  { id: 'collector_50', name: 'Acumulador', desc: 'Captura 50 Pokémon en una partida', icon: '📦', hidden: false, reward: 60 },
  { id: 'item_user_25', name: 'Dependiente', desc: 'Usa 25 objetos en una partida', icon: '🧪', hidden: false, reward: 25 },
  { id: 'item_user_50', name: 'Farmacéutico', desc: 'Usa 50 objetos en una partida', icon: '🧪', hidden: false, reward: 40 },
  { id: 'rich_5000', name: 'Millonario', desc: 'Acumula $5000 en una partida', icon: '💰', hidden: false, reward: 40 },
  { id: 'rich_10000', name: 'Magnate Global', desc: 'Acumula $10000 en una partida', icon: '💰', hidden: false, reward: 60 },
  { id: 'rich_50000', name: 'Croesus', desc: 'Acumula $50000 en una partida', icon: '💰', hidden: false, reward: 100 },
  { id: 'spender_1000', name: 'Gastador', desc: 'Gasta $1000 en tiendas en una partida', icon: '💸', hidden: false, reward: 40 },
  { id: 'spender_5000', name: 'Derrochador Élite', desc: 'Gasta $5000 en tiendas en una partida', icon: '💸', hidden: false, reward: 60 },
  { id: 'nodes_30', name: 'Explorador', desc: 'Limpia 30 nodos en una partida', icon: '🚶', hidden: false, reward: 25 },
  { id: 'nodes_50', name: 'Aventurero', desc: 'Limpia 50 nodos en una partida', icon: '🚶', hidden: false, reward: 40 },
  { id: 'nodes_100', name: 'Leyenda del Camino', desc: 'Limpia 100 nodos en una partida', icon: '🚶', hidden: false, reward: 60 },
  { id: 'infinite_100', name: 'Infinito Profundo', desc: 'Llega al nodo 100 en modo Infinite', icon: '🌌', hidden: false, reward: 100 },
  { id: 'total_wins_5', name: 'Victorioso', desc: 'Gana 5 partidas en total', icon: '🏆', hidden: false, reward: 25 },
  { id: 'total_wins_10', name: 'Campeón Recurrente', desc: 'Gana 10 partidas en total', icon: '🏆', hidden: false, reward: 25 },
  { id: 'total_wins_25', name: 'Leyenda Viva', desc: 'Gana 25 partidas en total', icon: '🏆', hidden: false, reward: 60 },
  { id: 'total_wins_50', name: 'Inmortal', desc: 'Gana 50 partidas en total', icon: '🏆', hidden: false, reward: 60 },
  { id: 'total_runs_10', name: 'Jugador Dedicado', desc: 'Juega 10 partidas en total', icon: '🎮', hidden: false, reward: 15 },
  { id: 'total_runs_25', name: 'Veterano', desc: 'Juega 25 partidas en total', icon: '🎮', hidden: false, reward: 25 },
  { id: 'total_runs_50', name: 'Adicto', desc: 'Juega 50 partidas en total', icon: '🎮', hidden: false, reward: 60 },
  { id: 'meta_500', name: 'Coleccionista de Monedas', desc: 'Acumula 500 PokéCoins', icon: '🪙', hidden: false, reward: 40 },
  { id: 'meta_1000', name: 'Inversor Mayorista', desc: 'Acumula 1000 PokéCoins', icon: '🪙', hidden: false, reward: 60 },
  { id: 'meta_5000', name: 'Tiburón Financiero', desc: 'Acumula 5000 PokéCoins', icon: '🪙', hidden: false, reward: 100 },
  { id: 'medium_win', name: 'Competente', desc: 'Gana en dificultad Media', icon: '🥈', hidden: false, reward: 15 },
  { id: 'noShops_win', name: 'Ermitaño', desc: 'Gana con el desafío Sin Tiendas', icon: '🏪', hidden: false, reward: 100 },
  { id: 'noRests_win', name: 'Insomne', desc: 'Gana con el desafío Sin Descanso', icon: '🛌', hidden: false, reward: 100 },
  { id: 'allShiny_win', name: 'Brillante', desc: 'Gana con el desafío Todos Shiny', icon: '✨', hidden: false, reward: 40 },
  { id: 'noMoney_win', name: 'Pobreza', desc: 'Gana con el desafío Sin Dinero', icon: '💸', hidden: false, reward: 100 },
  { id: 'egglocke_win', name: 'Criador', desc: 'Gana con el desafío Egglocke', icon: '🥚', hidden: false, reward: 100 },
  { id: 'nuzlockeHC_win', name: 'Superviviente Extremo', desc: 'Gana con Nuzlocke Hardcore', icon: '💀', hidden: false, reward: 100 },
  { id: 'noHeal_win', name: 'Autosuficiente', desc: 'Gana con el desafío Sin Curación', icon: '🚑', hidden: false, reward: 100 },
  { id: 'allTeamRocket_win', name: 'Team Rocket Forever', desc: 'Gana con el desafío Todo Team Rocket', icon: '🔴', hidden: false, reward: 100 },
  { id: 'triple_challenge', name: 'Tres Retos', desc: 'Gana con 3 desafíos activos', icon: '🎯', hidden: false, reward: 100 },
  { id: 'challenge_mania', name: 'Manía de Retos', desc: 'Gana con 5+ desafíos activos', icon: '🎯', hidden: false, reward: 200 },
  { id: 'team_diversity_10', name: 'Versátil', desc: 'Usa 10 Pokémon diferentes en una partida', icon: '🔄', hidden: false, reward: 25 },
  { id: 'team_diversity_20', name: 'Polivalente', desc: 'Usa 20 Pokémon diferentes en una partida', icon: '🔄', hidden: false, reward: 40 },
  { id: 'total_turns_500', name: 'Paciente', desc: 'Juega 500 turnos en una partida', icon: '⌛', hidden: false, reward: 25 },
  { id: 'total_turns_1000', name: 'Táctico', desc: 'Juega 1000 turnos en una partida', icon: '⌛', hidden: false, reward: 40 },
  { id: 'back_from_brink', name: 'Al Límite', desc: 'Gana un combate con 1 HP restante', icon: '❤️‍🔥', hidden: false, reward: 25 },
  { id: 'first_try', name: 'Novato con Suerte', desc: 'Gana tu primera partida', icon: '🍀', hidden: false, reward: 15 },
  { id: 'hoarder_15', name: 'Acaparador', desc: 'Ten 15 objetos en el inventario', icon: '📦', hidden: false, reward: 25 },
  { id: 'evolution_master', name: 'Evolucionador', desc: 'Evoluciona 5 Pokémon en una partida', icon: '🌀', hidden: false, reward: 15 },
  { id: 'first_mega', name: 'Mega Evolución', desc: 'Mega-evoluciona un Pokémon por primera vez', icon: '💎', hidden: false, reward: 15 },
  { id: 'mega_win', name: 'Poder Mega', desc: 'Gana una partida usando megaevolución', icon: '💎', hidden: false, reward: 25 },
  { id: 'mega_master', name: 'Maestro Mega', desc: 'Mega-evoluciona 10 Pokémon en total', icon: '🔮', hidden: false, reward: 40 },
  { id: 'first_gmax', name: 'Gigamax', desc: 'Gigamaxima un Pokémon por primera vez', icon: '⚡', hidden: false, reward: 15 },
  { id: 'gmax_win', name: 'Poder Gigamax', desc: 'Gana una partida usando Gigamax', icon: '⚡', hidden: false, reward: 25 },
  { id: 'gmax_master', name: 'Maestro Gigamax', desc: 'Gigamaxima 10 Pokémon en total', icon: '🌟', hidden: false, reward: 60 },
  { id: 'coop_first_run', name: 'Compañero de Viaje', desc: 'Juega tu primera partida en cooperativo', icon: '🤝', hidden: false, reward: 15 },
  { id: 'coop_win', name: 'Victoria Compartida', desc: 'Gana una partida en cooperativo', icon: '🏆', hidden: false, reward: 25 },
  { id: 'coop_wins_5', name: 'Equipo Confiable', desc: 'Gana 5 partidas cooperativas', icon: '🫱🏻‍🫲🏽', hidden: false, reward: 40 },
  { id: 'coop_wins_10', name: 'Equipo Legendario', desc: 'Gana 10 partidas cooperativas', icon: '👥', hidden: false, reward: 60 },
  { id: 'coop_first_trade', name: 'Primer Trueque', desc: 'Completa tu primer intercambio en cooperativo', icon: '🔄', hidden: false, reward: 15 },
  { id: 'coop_trades_5', name: 'Trueques Frecuentes', desc: 'Completa 5 intercambios en total', icon: '🤝', hidden: false, reward: 40 },
  { id: 'coop_trades_10', name: 'Mercader Cooperativo', desc: 'Completa 10 intercambios en total', icon: '💼', hidden: false, reward: 60 },
  { id: 'coop_hard_win', name: 'Dúo Imparable', desc: 'Gana una partida cooperativa en dificultad Difícil', icon: '⚡', hidden: false, reward: 60 },
  { id: 'meta_complete', name: 'Magnate del PokéShop', desc: 'Compra todos los objetos de la Tienda Meta', icon: '🛍️', hidden: false, reward: 250 },
  { id: 'eevee_master', name: 'Familia Eevee', desc: 'Obtén todas las evoluciones de Eevee en una partida', icon: '🦊', hidden: false, reward: 250 },
]

const SYNERGIES: Array<{ items: string[]; name: string; desc: string; effect: (pokemon: Pokemon) => Partial<Pokemon> }> = [
  {
    items: ['Life Orb', 'Guts Band'],
    name: 'Furia Desatada',
    desc: '+20% daño adicional y +20% a bajo HP',
    effect: (p) => ({ attack: Math.round(p.attack * 1.1) })
  },
  {
    items: ['Choice Band', 'Choice Scarf'],
    name: 'Elección Absoluta',
    desc: '+15% a todos los stats ofensivos',
    effect: (p) => ({ attack: Math.round(p.attack * 1.1), spAttack: Math.round(p.spAttack * 1.1), speed: Math.round(p.speed * 1.1) })
  },
  {
    items: ['Leftovers', 'Sitrus Berry'],
    name: 'Regeneración Total',
    desc: '+4 HP/turno extra',
    effect: (p) => ({ maxHp: p.maxHp + 10, hp: Math.min(p.hp + 10, p.maxHp + 10) })
  },
  {
    items: ['Scope Lens', 'Wide Lens'],
    name: 'Ojo de Águila',
    desc: '+15% crítico adicional y +5% SPD',
    effect: (p) => ({ speed: Math.round(p.speed * 1.05) })
  },
  {
    items: ['Shell Bell', 'Big Root'],
    name: 'Vampirismo Extremo',
    desc: '+10% lifesteal adicional',
    effect: (p) => ({ attack: Math.round(p.attack * 1.05) })
  },
  {
    items: ['Assault Vest', 'Vest Protector'],
    name: 'Fortaleza Total',
    desc: '+10% defensa y +10 maxHP',
    effect: (p) => ({ defense: Math.round(p.defense * 1.1), spDefense: Math.round(p.spDefense * 1.1), maxHp: p.maxHp + 10, hp: Math.min(p.hp + 10, p.maxHp + 10) })
  },
  {
    items: ['Muscle Band', 'Focus Band'],
    name: 'Potencia Bruta',
    desc: '+10% ataque y +5% crítico',
    effect: (p) => ({ attack: Math.round(p.attack * 1.1) })
  },
  {
    items: ['Quick Claw', 'Choice Scarf'],
    name: 'Velocidad Límite',
    desc: '+15% velocidad',
    effect: (p) => ({ speed: Math.round(p.speed * 1.15) })
  },
  {
    items: ['Rocky Helmet', 'Babiri Berry'],
    name: 'Castigo Reflejado',
    desc: '+15 defensa permanente',
    effect: (p) => ({ defense: p.defense + 15 })
  },
  {
    items: ['Eviolite', 'Focus Sash'],
    name: 'Juventud Eterna',
    desc: '+10% a todos los stats',
    effect: (p) => ({
      attack: Math.round(p.attack * 1.1),
      defense: Math.round(p.defense * 1.1),
      spAttack: Math.round(p.spAttack * 1.1),
      spDefense: Math.round(p.spDefense * 1.1),
      speed: Math.round(p.speed * 1.1),
    })
  },
  {
    items: ['Wise Glasses', 'Choice Scarf'],
    name: 'Mente Ágil',
    desc: '+15% At. Esp. y +10% velocidad',
    effect: (p) => ({ spAttack: Math.round(p.spAttack * 1.15), speed: Math.round(p.speed * 1.1) })
  },
]

const RANDOM_EVENTS = [
  {
    id: 'legendary_appears',
    weight: 1,
    icon: '🐉',
    title: '¡Pokémon Legendario!',
    desc: 'Un Pokémon poderoso aparece delante de ti. ¿Capturarlo?',
    minRouteProgress: 0.5,
  },
  {
    id: 'mysterious_trader',
    weight: 5,
    icon: '🎭',
    title: 'Comerciante Misterioso',
    desc: 'Un extraño ofrece intercambiar uno de tus Pokémon por uno más fuerte.',
    minRouteProgress: 0.3,
  },
  {
    id: 'evolution_merchant',
    weight: 4,
    icon: '🧳',
    title: 'Mercader Misterioso',
    desc: 'Un misterioso mercader vende objetos evolutivos.',
    minRouteProgress: 0.2,
  },
  {
    id: 'trap',
    weight: 6,
    icon: '⚠️',
    title: '¡Trampa de Team Rocket!',
    desc: 'Una bomba explota. Tu Pokémon activo pierde 30% HP.',
    minRouteProgress: 0.2,
  },
  {
    id: 'fairy_blessing',
    weight: 5,
    icon: '🧚',
    title: 'Bendición del Hada',
    desc: 'Un hada te bendice. Tu Pokémon activo recupera HP completo.',
    minRouteProgress: 0.1,
  },
  {
    id: 'treasure_chest',
    weight: 4,
    icon: '📦',
    title: 'Cofre del Tesoro',
    desc: 'Encuentras un cofre con una poción y dinero.',
    minRouteProgress: 0.0,
  },
  {
    id: 'mysterious_help',
    weight: 6,
    icon: '🩺',
    title: 'Ayuda Misteriosa',
    desc: 'Una fuerza misteriosa revive a uno de tus Pokémon debilitados.',
    minRouteProgress: 0.0,
  },
  {
    id: 'shiny_spot',
    weight: 2,
    icon: '✨',
    title: 'Zona Brillante',
    desc: 'Un destello brillante te hace sentir que algo especial se acerca.',
    minRouteProgress: 0.4,
  },
]

const THEMES: Array<{ id: string; name: string; desc: string; price: number; colors: Record<string, string> }> = [
  { id: 'dark', name: 'Oscuro (Default)', desc: 'El tema clásico oscuro', price: 0, colors: { bg: '#12122b', surface: '#1c1c3a', border: '#3f3f6e', text: '#f8fafc', accent: '#4d9bff', muted: '#9b98cf' } },
  { id: 'retro', name: 'Retro Game Boy', desc: 'Verde y negro clásico', price: 50, colors: { bg: '#0f380f', surface: '#1b4d1b', border: '#3a7a3a', text: '#c8e08a', accent: '#9bbc0f', muted: '#7ca35c' } },
  { id: 'light', name: 'Claro', desc: 'Tema blanco limpio', price: 40, colors: { bg: '#eef3fa', surface: '#ffffff', border: '#cbd5e1', text: '#0f172a', accent: '#2563eb', muted: '#64748b' } },
  { id: 'neon', name: 'Neón Cyberpunk', desc: 'Rosa neón y negro', price: 75, colors: { bg: '#0a0a0f', surface: '#1a1a2e', border: '#e94560', text: '#f3f1ff', accent: '#e94560', muted: '#7c7c9a' } },
  { id: 'crimson', name: 'Carmesí', desc: 'Rojo oscuro y dorado', price: 75, colors: { bg: '#1a0000', surface: '#2d0a0a', border: '#8b0000', text: '#ffd700', accent: '#ff4444', muted: '#8b4513' } },
  { id: 'ocean', name: 'Océano Profundo', desc: 'Azules y turquesa', price: 60, colors: { bg: '#001220', surface: '#001f3f', border: '#0074D9', text: '#f3f1ff', accent: '#7FDBFF', muted: '#39CCCC' } },
  { id: 'forest', name: 'Bosque Encantado', desc: 'Verdes y tierra', price: 60, colors: { bg: '#0d1f0d', surface: '#1a2e1a', border: '#2d5a27', text: '#d4edda', accent: '#28a745', muted: '#6b8e23' } },
  { id: 'sunset', name: 'Atardecer', desc: 'Naranjas y rojos cálidos', price: 70, colors: { bg: '#1a0f00', surface: '#3a2205', border: '#7c4a03', text: '#ffe4b5', accent: '#ff8c42', muted: '#c9a06b' } },
  { id: 'aurora', name: 'Aurora Polar', desc: 'Verdes y azules boreales', price: 75, colors: { bg: '#02130f', surface: '#06231b', border: '#0e4d3a', text: '#d0fff0', accent: '#4dffc2', muted: '#6fb3a0' } },
  { id: 'sakura', name: 'Flores de Cerezo', desc: 'Rosas suaves y cálidos', price: 65, colors: { bg: '#2a0f1e', surface: '#431331', border: '#7a2455', text: '#ffe3f1', accent: '#ff6fb5', muted: '#d48ab3' } },
  { id: 'ice', name: 'Glaciar', desc: 'Azules y blanco hielo', price: 65, colors: { bg: '#0b1a2e', surface: '#12294a', border: '#2c5f8a', text: '#e8f4ff', accent: '#9be8ff', muted: '#8aa7c9' } },
  { id: 'desert', name: 'Desierto', desc: 'Arena y ámbar', price: 60, colors: { bg: '#1a1405', surface: '#2e2410', border: '#6b5620', text: '#f8edd0', accent: '#ffc94d', muted: '#c0a86a' } },
  { id: 'matrix', name: 'Matrix', desc: 'Verde neón sobre negro', price: 85, colors: { bg: '#000000', surface: '#0a1a0a', border: '#0f3d0f', text: '#a4f7a4', accent: '#22ff22', muted: '#2f6b2f' } },
  { id: 'midnight', name: 'Medianoche', desc: 'Azul profundo y plata', price: 70, colors: { bg: '#070b18', surface: '#101a30', border: '#2a3f6b', text: '#dbe6ff', accent: '#7aa2ff', muted: '#77839e' } },
  { id: 'candy', name: 'Caramelo', desc: 'Rosa chicle y vibrantes', price: 75, colors: { bg: '#1e0f1e', surface: '#3a1b33', border: '#7a3a63', text: '#ffe6f5', accent: '#ff77dd', muted: '#c98aa8' } },
  { id: 'lava', name: 'Volcán', desc: 'Lava ardiente y roca fundida', price: 90, colors: { bg: '#1a0500', surface: '#3a1205', border: '#7a2508', text: '#ffe3c4', accent: '#ff5a1f', muted: '#c87a4a' } },
  { id: 'galaxy', name: 'Galaxia', desc: 'Nebulosas violeta y estrellas', price: 90, colors: { bg: '#070216', surface: '#150a38', border: '#4b2a86', text: '#f3e8ff', accent: '#c084fc', muted: '#8a7bb8' } },
  { id: 'gold', name: 'Dorado', desc: 'Oro y negro lujoso', price: 110, colors: { bg: '#0d0a00', surface: '#221b05', border: '#8a6d1a', text: '#fff3c4', accent: '#ffd700', muted: '#b8a05a' } },
  { id: 'emerald', name: 'Esmeralda', desc: 'Verde joya y dorado', price: 90, colors: { bg: '#00160a', surface: '#00291a', border: '#0f7a4a', text: '#d9ffe9', accent: '#2ee6a0', muted: '#6fb896' } },
  { id: 'vaporwave', name: 'Vaporwave', desc: 'Estética retro ochentera', price: 95, colors: { bg: '#180833', surface: '#2d0a4e', border: '#c84bd0', text: '#e8f4ff', accent: '#22d3ee', muted: '#a87bc9' } },
  { id: 'ghost', name: 'Fantasma', desc: 'Misterio etéreo y cian', price: 85, colors: { bg: '#0a0a14', surface: '#161630', border: '#4a3a7a', text: '#e6f4ff', accent: '#67e8f9', muted: '#8f9bb5' } },
  { id: 'carbon', name: 'Carbono', desc: 'Grafito industrial con lima', price: 85, colors: { bg: '#0d0d0d', surface: '#1c1c1c', border: '#3d3d3d', text: '#f5f5f5', accent: '#a3e635', muted: '#7a7a7a' } },
  { id: 'bloodmoon', name: 'Luna Sangrienta', desc: 'Rojo sangre y luna pálida', price: 100, colors: { bg: '#12030a', surface: '#260711', border: '#8a1435', text: '#ffe4ee', accent: '#ff2e5f', muted: '#b07c92' } },
  { id: 'toxic', name: 'Tóxico', desc: 'Veneno ácido y ultravioleta', price: 90, colors: { bg: '#0e1100', surface: '#1e2600', border: '#5c6b00', text: '#f0ffd0', accent: '#b6f000', muted: '#8ba05c' } },
  { id: 'samurai', name: 'Samurái', desc: 'Rojo lacado, oro y negro', price: 95, colors: { bg: '#140404', surface: '#2b0d0d', border: '#b02020', text: '#ffe8c4', accent: '#ffb020', muted: '#c09a6a' } },
  { id: 'pastel', name: 'Pastel', desc: 'Tonos suaves y delicados', price: 80, colors: { bg: '#191424', surface: '#2e2740', border: '#6b5f8f', text: '#fdf3ff', accent: '#ff9fd4', muted: '#b3a6c9' } },
  { id: 'tropical', name: 'Tropical', desc: 'Paraíso aguamarina y mango', price: 85, colors: { bg: '#00141a', surface: '#063238', border: '#0f6b6b', text: '#e8ffff', accent: '#ffb340', muted: '#6fc7b8' } },
]

interface MetaShopItem {
  id: string
  name: string
  desc: string
  price: number
  spriteKey: string
  category: 'consumable' | 'holdable' | 'theme' | 'upgrade' | 'music' | 'pokeball' | 'evolution_stone' | 'evolution_item' | 'disco_mt'
  requires?: string
}

function metaShopItemMatches(item: { name: string; desc: string }, term: string): boolean {
  if (!term) return true
  return item.name.toLowerCase().includes(term) || item.desc.toLowerCase().includes(term)
}

const META_SHOP_ITEMS: MetaShopItem[] = [
  { id: 'unlock_hyper_potion', name: 'Hyper Potion', desc: 'Restaura 120 HP. Aparece en tiendas.', price: 30, spriteKey: 'Hyper Potion', category: 'consumable' },
  { id: 'unlock_full_restore', name: 'Full Restore', desc: 'Cura total. Aparece en tiendas.', price: 60, spriteKey: 'Full Restore', category: 'consumable' },
  { id: 'unlock_max_revive', name: 'Max Revive', desc: 'Revive con HP completo.', price: 80, spriteKey: 'Max Revive', category: 'consumable' },
  { id: 'unlock_rare_candy', name: 'Rare Candy', desc: 'Sube 1 nivel. Aparece en drops.', price: 40, spriteKey: 'Rare Candy', category: 'consumable' },
  { id: 'unlock_elixir', name: 'Elixir', desc: 'Restaura 80 HP.', price: 25, spriteKey: 'Elixir', category: 'consumable' },
  { id: 'unlock_super_elixir', name: 'Super Elixir', desc: 'Restaura 200 HP.', price: 50, spriteKey: 'Super Elixir', category: 'consumable' },
  { id: 'unlock_full_elixir', name: 'Full Elixir', desc: 'Restaura todo HP y cura estados.', price: 80, spriteKey: 'Full Elixir', category: 'consumable' },
  { id: 'unlock_x_attack_2', name: 'X Attack 2', desc: '+10 ataque permanente.', price: 45, spriteKey: 'X Attack 2', category: 'consumable' },
  { id: 'unlock_x_defense_2', name: 'X Defense 2', desc: '+10 defensa permanente.', price: 45, spriteKey: 'X Defense 2', category: 'consumable' },
  { id: 'unlock_x_speed_2', name: 'X Speed 2', desc: '+10 velocidad permanente.', price: 45, spriteKey: 'X Speed 2', category: 'consumable' },
  { id: 'unlock_smoke_ball', name: 'Cuerda Huida', desc: 'Escapa de cualquier combate. Aparece en tiendas (25%).', price: 60, spriteKey: 'Cuerda Huida', category: 'consumable' },
  { id: 'unlock_moomoo_milk', name: 'Moomoo Milk', desc: 'Restaura 100 HP. Aparece en tiendas.', price: 30, spriteKey: 'Moomoo Milk', category: 'consumable' },
  { id: 'unlock_berry_juice', name: 'Berry Juice', desc: 'Restaura 20 HP. Aparece en tiendas.', price: 15, spriteKey: 'Berry Juice', category: 'consumable' },
  { id: 'unlock_fresh_water', name: 'Fresh Water', desc: 'Restaura 30 HP. Aparece en tiendas.', price: 20, spriteKey: 'Fresh Water', category: 'consumable' },
  { id: 'unlock_soda_pop', name: 'Soda Pop', desc: 'Restaura 40 HP. Aparece en tiendas.', price: 25, spriteKey: 'Soda Pop', category: 'consumable' },
  { id: 'unlock_lemonade', name: 'Lemonade', desc: 'Restaura 60 HP. Aparece en tiendas.', price: 30, spriteKey: 'Lemonade', category: 'consumable' },
  { id: 'unlock_muscle_band', name: 'Muscle Band', desc: '+15% Ataque.', price: 40, spriteKey: 'Muscle Band', category: 'holdable' },
  { id: 'unlock_wise_glasses', name: 'Wise Glasses', desc: '+15% At. Esp.', price: 40, spriteKey: 'Wise Glasses', category: 'holdable' },
  { id: 'unlock_choice_band', name: 'Choice Band', desc: '+25% Ataque.', price: 70, spriteKey: 'Choice Band', category: 'holdable' },
  { id: 'unlock_leftovers', name: 'Leftovers', desc: 'Recupera 6 HP por turno.', price: 60, spriteKey: 'Leftovers', category: 'holdable' },
  { id: 'unlock_focus_sash', name: 'Focus Sash', desc: '+20 HP máximos.', price: 50, spriteKey: 'Focus Sash', category: 'holdable' },
  { id: 'unlock_assault_vest', name: 'Assault Vest', desc: '+20% Def. Esp.', price: 60, spriteKey: 'Assault Vest', category: 'holdable' },
  { id: 'unlock_quick_claw', name: 'Quick Claw', desc: '+20% Velocidad.', price: 50, spriteKey: 'Quick Claw', category: 'holdable' },
  { id: 'unlock_eviolite', name: 'Eviolite', desc: '+10% Defensa y Def. Esp.', price: 40, spriteKey: 'Eviolite', category: 'holdable' },
  { id: 'unlock_life_orb', name: 'Life Orb', desc: '+30% Daño, -5 HP/turno.', price: 100, spriteKey: 'Life Orb', category: 'holdable' },
  { id: 'unlock_rocky_helmet', name: 'Rocky Helmet', desc: '+15% Defensa.', price: 40, spriteKey: 'Rocky Helmet', category: 'holdable' },
  { id: 'unlock_scope_lens', name: 'Scope Lens', desc: '20% Golpe Crítico.', price: 70, spriteKey: 'Scope Lens', category: 'holdable' },
  { id: 'unlock_shell_bell', name: 'Shell Bell', desc: '20% Lifesteal.', price: 90, spriteKey: 'Shell Bell', category: 'holdable' },
  { id: 'unlock_choice_scarf', name: 'Choice Scarf', desc: '+30% Velocidad.', price: 70, spriteKey: 'Choice Scarf', category: 'holdable' },
  { id: 'unlock_babiri_berry', name: 'Babiri Berry', desc: '20% Reducción de Daño.', price: 50, spriteKey: 'Babiri Berry', category: 'holdable' },
  { id: 'unlock_big_root', name: 'Big Root', desc: '25% Lifesteal.', price: 90, spriteKey: 'Big Root', category: 'holdable' },
  { id: 'unlock_wide_lens', name: 'Wide Lens', desc: '15% Crítico, +10% Velocidad.', price: 40, spriteKey: 'Wide Lens', category: 'holdable' },
  { id: 'unlock_sitrus_berry', name: 'Sitrus Berry', desc: '+15 HP máx, +8 HP/turno.', price: 40, spriteKey: 'Sitrus Berry', category: 'holdable' },
  { id: 'unlock_guts_band', name: 'Guts Band', desc: '+20% ATK, +15% bajo 30% HP.', price: 60, spriteKey: 'Guts Band', category: 'holdable' },
  { id: 'unlock_vest_protector', name: 'Vest Protector', desc: '+25% DEF, -15% daño.', price: 80, spriteKey: 'Vest Protector', category: 'holdable' },
  { id: 'unlock_focus_band', name: 'Focus Band', desc: '25% Crítico, +10% ATK.', price: 60, spriteKey: 'Focus Band', category: 'holdable' },
  { id: 'unlock_dragon_fang', name: 'Dragon Fang', desc: '+20% ATK, +10% Velocidad.', price: 70, spriteKey: 'Dragon Fang', category: 'holdable' },
  { id: 'unlock_guardian_charm', name: 'Guardian Charm', desc: '+15% Def. Esp., +10 HP máx.', price: 60, spriteKey: 'Guardian Charm', category: 'holdable' },
  { id: 'unlock_berserker_band', name: 'Berserker Band', desc: '+30% ATK bajo 25% HP.', price: 80, spriteKey: 'Berserker Band', category: 'holdable' },
  { id: 'unlock_phantom_cloak', name: 'Phantom Cloak', desc: '10% Reducción, +10% Vel.', price: 70, spriteKey: 'Phantom Cloak', category: 'holdable' },
  { id: 'unlock_swift_feather', name: 'Swift Feather', desc: '+15% Vel, 10% Crítico.', price: 60, spriteKey: 'Swift Feather', category: 'holdable' },
  { id: 'unlock_iron_ball', name: 'Iron Ball', desc: '+25% DEF, -10% Vel.', price: 50, spriteKey: 'Iron Ball', category: 'holdable' },
  { id: 'unlock_vampire_fang', name: 'Vampire Fang', desc: '15% Lifesteal.', price: 70, spriteKey: 'Vampire Fang', category: 'holdable' },
  { id: 'unlock_cursed_blade', name: 'Cursed Blade', desc: '+35% ATK, -5 HP/turno.', price: 90, spriteKey: 'Cursed Blade', category: 'holdable' },
  { id: 'unlock_mega_node', name: 'Nodo Mega', desc: 'Desbloquea nodos de Mega Piedra en Hard/Infinite.', price: 150, spriteKey: 'Mega Stone', category: 'upgrade' },
  { id: 'unlock_gmax_node', name: 'Nodo G-MAX', desc: 'Desbloquea nodos G-MAX en Hard/Infinite.', price: 200, spriteKey: 'Dynamax Band', category: 'upgrade' },
  { id: 'unlock_primal_node', name: 'Nodo Primal', desc: 'Desbloquea nodos Primal en Hard/Infinite. Otorgan Prisma Rojo o Azul.', price: 250, spriteKey: 'Prisma Rojo', category: 'upgrade' },
  { id: 'unlock_casino_node', name: 'Nodo Casino', desc: 'Desbloquea nodos Casino en Hard/Infinite. Juega al Pachinko para ganar premios según tu puntuación.', price: 220, spriteKey: 'money', category: 'upgrade' },
  { id: 'unlock_reroll', name: 'Reroll', desc: 'Permite rerollear la tienda 1 vez por visita.', price: 120, spriteKey: 'dice', category: 'upgrade' },
  { id: 'unlock_reroll_2', name: 'Reroll II', desc: 'Otorga 1 reroll extra de tienda por visita.', price: 200, spriteKey: 'dice', category: 'upgrade', requires: 'unlock_reroll' },
  { id: 'unlock_shop_slot', name: 'Espacio de Tienda', desc: 'Las tiendas ofrecen 1 objeto más.', price: 100, spriteKey: 'money', category: 'upgrade' },
  { id: 'unlock_shop_slot_2', name: 'Espacio de Tienda II', desc: 'Las tiendas ofrecen 1 objeto más (se suma a la anterior).', price: 180, spriteKey: 'money', category: 'upgrade', requires: 'unlock_shop_slot' },
  { id: 'start_pokeballs_5', name: 'Inicio: +5 Poké Balls', desc: 'Empiezas cada aventura con 5 Poké Balls extra.', price: 180, spriteKey: 'Poké Ball', category: 'upgrade' },
  { id: 'start_potion_1', name: 'Inicio: +1 Poción', desc: 'Empiezas cada aventura con 1 Poción extra.', price: 140, spriteKey: 'Potion', category: 'upgrade' },
  { id: 'start_potion_2', name: 'Inicio: +1 Poción II', desc: 'Empiezas cada aventura con 1 Poción extra (se suma a la anterior).', price: 180, spriteKey: 'Potion', category: 'upgrade', requires: 'start_potion_1' },
  { id: 'start_money_1', name: 'Inicio: +$100', desc: 'Empiezas cada aventura con $100 extra.', price: 120, spriteKey: 'money', category: 'upgrade' },
  { id: 'start_money_2', name: 'Inicio: +$100 II', desc: 'Empiezas cada aventura con $100 extra (se suma a la anterior).', price: 160, spriteKey: 'money', category: 'upgrade', requires: 'start_money_1' },
  { id: 'start_revive_1', name: 'Inicio: +1 Revive', desc: 'Empiezas cada aventura con 1 Revive extra.', price: 200, spriteKey: 'Revive', category: 'upgrade' },
  { id: 'unlock_quick_ball', name: 'Quick Ball', desc: 'x5 en el primer turno. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Quick Ball', category: 'pokeball' },
  { id: 'unlock_timer_ball', name: 'Timer Ball', desc: 'Mejora con los turnos (hasta x4). Aparece en tiendas y descansos.', price: 35, spriteKey: 'Timer Ball', category: 'pokeball' },
  { id: 'unlock_dusk_ball', name: 'Dusk Ball', desc: 'x3 en oscuridad. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Dusk Ball', category: 'pokeball' },
  { id: 'unlock_net_ball', name: 'Net Ball', desc: 'x3 contra Agua/Bicho. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Net Ball', category: 'pokeball' },
  { id: 'unlock_level_ball', name: 'Level Ball', desc: 'Mejor si tu nivel supera al rival. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Level Ball', category: 'pokeball' },
  { id: 'unlock_repeat_ball', name: 'Repeat Ball', desc: 'x3.5 si ya capturaste esa especie. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Repeat Ball', category: 'pokeball' },
  { id: 'unlock_love_ball', name: 'Love Ball', desc: 'x8 si es misma familia. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Love Ball', category: 'pokeball' },
  { id: 'unlock_friend_ball', name: 'Friend Ball', desc: 'Ratio base x1. Aparece en tiendas y descansos.', price: 30, spriteKey: 'Friend Ball', category: 'pokeball' },
  { id: 'unlock_heavy_ball', name: 'Heavy Ball', desc: 'Mejor contra Pokémon pesados. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Heavy Ball', category: 'pokeball' },
  { id: 'unlock_great_ball', name: 'Great Ball', desc: 'x1.5 de captura. Aparece en tiendas y descansos.', price: 25, spriteKey: 'Great Ball', category: 'pokeball' },
  { id: 'unlock_ultra_ball', name: 'Ultra Ball', desc: 'x2 de captura. Aparece en tiendas y descansos.', price: 50, spriteKey: 'Ultra Ball', category: 'pokeball' },
  { id: 'unlock_master_ball', name: 'Master Ball', desc: 'Captura cualquier Pokémon sin fallo. Aparece raramente en tiendas.', price: 100, spriteKey: 'Master Ball', category: 'pokeball' },
  { id: 'unlock_fire_stone', name: 'Fire Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Fire Stone', category: 'evolution_stone' },
  { id: 'unlock_water_stone', name: 'Water Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Water Stone', category: 'evolution_stone' },
  { id: 'unlock_thunder_stone', name: 'Thunder Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Thunder Stone', category: 'evolution_stone' },
  { id: 'unlock_leaf_stone', name: 'Leaf Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Leaf Stone', category: 'evolution_stone' },
  { id: 'unlock_moon_stone', name: 'Moon Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Moon Stone', category: 'evolution_stone' },
  { id: 'unlock_sun_stone', name: 'Sun Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Sun Stone', category: 'evolution_stone' },
  { id: 'unlock_shiny_stone', name: 'Shiny Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Shiny Stone', category: 'evolution_stone' },
  { id: 'unlock_dusk_stone', name: 'Dusk Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Dusk Stone', category: 'evolution_stone' },
  { id: 'unlock_dawn_stone', name: 'Dawn Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Dawn Stone', category: 'evolution_stone' },
  { id: 'unlock_ice_stone', name: 'Ice Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Ice Stone', category: 'evolution_stone' },
  { id: 'unlock_metal_coat', name: 'Metal Coat', desc: 'Evoluciona a Steelix y Scizor. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Metal Coat', category: 'evolution_item' },
  { id: 'unlock_kings_rock', name: "King's Rock", desc: 'Evoluciona a Politoed y Slowking. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: "King's Rock", category: 'evolution_item' },
  { id: 'unlock_dragon_scale', name: 'Dragon Scale', desc: 'Evoluciona a Kingdra. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Dragon Scale', category: 'evolution_item' },
  { id: 'unlock_up_grade', name: 'Up-Grade', desc: 'Evoluciona a Porygon2. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Up-Grade', category: 'evolution_item' },
  { id: 'unlock_dubious_disc', name: 'Dubious Disc', desc: 'Evoluciona a Porygon-Z. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Dubious Disc', category: 'evolution_item' },
  { id: 'unlock_reaper_cloth', name: 'Reaper Cloth', desc: 'Evoluciona a Dusknoir. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Reaper Cloth', category: 'evolution_item' },
  { id: 'unlock_protector', name: 'Protector', desc: 'Evoluciona a Rhyperior. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Protector', category: 'evolution_item' },
  { id: 'unlock_electirizer', name: 'Electirizer', desc: 'Evoluciona a Electivire. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Electirizer', category: 'evolution_item' },
  { id: 'unlock_magmarizer', name: 'Magmarizer', desc: 'Evoluciona a Magmortar. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Magmarizer', category: 'evolution_item' },
  { id: 'unlock_prism_scale', name: 'Prism Scale', desc: 'Evoluciona a Milotic. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Prism Scale', category: 'evolution_item' },
  { id: 'unlock_sachet', name: 'Sachet', desc: 'Evoluciona a Aromatisse. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Sachet', category: 'evolution_item' },
  { id: 'unlock_whipped_dream', name: 'Whipped Dream', desc: 'Evoluciona a Slurpuff. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Whipped Dream', category: 'evolution_item' },
  { id: 'unlock_gorra_de_ash', name: 'Gorra de Ash', desc: 'Evoluciona a Greninja en Greninja-Ash. Aparece con el Comerciante Misterioso.', price: 50, spriteKey: 'Gorra de Ash', category: 'evolution_item' },
  { id: 'unlock_auspicious_armor', name: 'Auspicious Armor', desc: 'Evoluciona a Charcadet en Armarouge. Aparece con el Comerciante Misterioso.', price: 50, spriteKey: 'Auspicious Armor', category: 'evolution_item' },
  { id: 'unlock_malicious_armor', name: 'Malicious Armor', desc: 'Evoluciona a Charcadet en Ceruledge. Aparece con el Comerciante Misterioso.', price: 50, spriteKey: 'Malicious Armor', category: 'evolution_item' },
  { id: 'music_menu_chill', name: 'Menú Relax', desc: 'Música de menú relajante y ambiental.', price: 40, spriteKey: 'Potion', category: 'music' },
  { id: 'music_battle_epic', name: 'Batalla Épica', desc: 'Música de batalla más intensa y rápida.', price: 60, spriteKey: 'Potion', category: 'music' },
  { id: 'unlock_disco_mt', name: 'Disco MT', desc: 'Desbloquea el Disco MT: un objeto consumible que enseña un movimiento a tu Pokémon, igual que el nodo Move Tutor. Aparece en tiendas.', price: 120, spriteKey: 'Disco MT', category: 'disco_mt' },
  { id: 'unlock_protein', name: 'Proteína', desc: '+15 Ataque permanente. Aparece en tiendas.', price: 40, spriteKey: 'Proteína', category: 'consumable' },
  { id: 'unlock_calcium', name: 'Calcio', desc: '+15 At. Esp. permanente. Aparece en tiendas.', price: 40, spriteKey: 'Calcio', category: 'consumable' },
  { id: 'unlock_iron', name: 'Hierro', desc: '+15 Defensa permanente. Aparece en tiendas.', price: 40, spriteKey: 'Hierro', category: 'consumable' },
  { id: 'unlock_zinc', name: 'Zinc', desc: '+15 Def. Esp. permanente. Aparece en tiendas.', price: 40, spriteKey: 'Zinc', category: 'consumable' },
  { id: 'unlock_carbos', name: 'Carburante', desc: '+15 Velocidad permanente. Aparece en tiendas.', price: 40, spriteKey: 'Carburante', category: 'consumable' },
  { id: 'unlock_sacred_ash', name: 'Sacred Ash', desc: 'Revive a todo el equipo debilitado. Aparece en tiendas.', price: 90, spriteKey: 'Sacred Ash', category: 'consumable' },
  { id: 'unlock_antidoto', name: 'Antídoto', desc: 'Cura el envenenamiento. Aparece en tiendas.', price: 15, spriteKey: 'Antídoto', category: 'consumable' },
  { id: 'unlock_antiquemar', name: 'Antiquemar', desc: 'Cura las quemaduras. Aparece en tiendas.', price: 15, spriteKey: 'Antiquemar', category: 'consumable' },
  { id: 'unlock_paralizador', name: 'Paralizador', desc: 'Cura la parálisis. Aparece en tiendas.', price: 15, spriteKey: 'Paralizador', category: 'consumable' },
  { id: 'unlock_despertar', name: 'Despertar', desc: 'Despierta a un Pokémon dormido. Aparece en tiendas.', price: 15, spriteKey: 'Despertar', category: 'consumable' },
  { id: 'unlock_descongelar', name: 'Descongelar', desc: 'Descongela a un Pokémon congelado. Aparece en tiendas.', price: 15, spriteKey: 'Descongelar', category: 'consumable' },
  { id: 'unlock_baya_caquic', name: 'Baya Caquic', desc: 'Cura la confusión. Aparece en tiendas y drops.', price: 15, spriteKey: 'Baya Caquic', category: 'consumable' },
  { id: 'unlock_baya_zreza', name: 'Baya Zreza', desc: 'Cura la parálisis. Aparece en tiendas y drops.', price: 15, spriteKey: 'Baya Zreza', category: 'consumable' },
  { id: 'unlock_baya_atania', name: 'Baya Atania', desc: 'Cura las quemaduras. Aparece en tiendas y drops.', price: 15, spriteKey: 'Baya Atania', category: 'consumable' },
  { id: 'unlock_baya_algama', name: 'Baya Algama', desc: 'Cura el envenenamiento. Aparece en tiendas y drops.', price: 15, spriteKey: 'Baya Algama', category: 'consumable' },
  { id: 'unlock_baya_safre', name: 'Baya Safre', desc: 'Descongela a un Pokémon congelado. Aparece en tiendas y drops.', price: 15, spriteKey: 'Baya Safre', category: 'consumable' },
  { id: 'unlock_baya_siendrepis', name: 'Baya Siendrepis', desc: 'Despierta a un Pokémon dormido. Aparece en tiendas y drops.', price: 15, spriteKey: 'Baya Siendrepis', category: 'consumable' },
  { id: 'unlock_luxury_ball', name: 'Luxury Ball', desc: 'Ratio de captura x1.2. Aparece en tiendas y descansos.', price: 30, spriteKey: 'Luxury Ball', category: 'pokeball' },
  { id: 'unlock_premier_ball', name: 'Premier Ball', desc: 'Ratio estándar, elegante. Aparece en tiendas y descansos.', price: 25, spriteKey: 'Premier Ball', category: 'pokeball' },
  { id: 'unlock_fast_ball', name: 'Fast Ball', desc: 'x4 contra Pokémon muy rápidos. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Fast Ball', category: 'pokeball' },
  { id: 'unlock_focus_sash_2', name: 'Focus Sash II', desc: '+40 HP máximos.', price: 70, spriteKey: 'Focus Sash II', category: 'holdable', requires: 'unlock_focus_sash' },
  { id: 'unlock_scope_lens_2', name: 'Scope Lens II', desc: '30% Golpe Crítico.', price: 70, spriteKey: 'Scope Lens II', category: 'holdable', requires: 'unlock_scope_lens' },
  { id: 'unlock_shell_bell_2', name: 'Shell Bell II', desc: '30% Robo de Vida.', price: 90, spriteKey: 'Shell Bell II', category: 'holdable', requires: 'unlock_shell_bell' },
  { id: 'unlock_assault_vest_2', name: 'Assault Vest II', desc: '+30% Def. Esp.', price: 90, spriteKey: 'Assault Vest II', category: 'holdable', requires: 'unlock_assault_vest' },
  { id: 'unlock_leftovers_2', name: 'Leftovers II', desc: 'Recupera 12 HP por turno.', price: 90, spriteKey: 'Leftovers II', category: 'holdable', requires: 'unlock_leftovers' },
  { id: 'unlock_quick_claw_2', name: 'Quick Claw II', desc: '+30% Velocidad.', price: 70, spriteKey: 'Quick Claw II', category: 'holdable', requires: 'unlock_quick_claw' },
  { id: 'unlock_razor_claw', name: 'Razor Claw', desc: 'Evoluciona a Sneasel en Weavile. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Razor Claw', category: 'evolution_item' },
  { id: 'unlock_razor_fang', name: 'Razor Fang', desc: 'Evoluciona a Gligar en Gliscor. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Razor Fang', category: 'evolution_item' },
  { id: 'unlock_oval_stone', name: 'Oval Stone', desc: 'Evoluciona a Happiny en Chansey. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Oval Stone', category: 'evolution_item' },
  { id: 'unlock_deep_sea_tooth', name: 'Deep Sea Tooth', desc: 'Evoluciona a Clamperl en Huntail. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Deep Sea Tooth', category: 'evolution_item' },
  { id: 'unlock_deep_sea_scale', name: 'Deep Sea Scale', desc: 'Evoluciona a Clamperl en Gorebyss. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Deep Sea Scale', category: 'evolution_item' },
  { id: 'unlock_repartir_exp', name: 'Repartir Exp', desc: 'Todos los Pokémon del PC ganan 1 nivel tras cada combate.', price: 130, spriteKey: 'Repartir Exp', category: 'holdable' },
]

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

const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030',
  grass: '#78c850', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0',
  ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848',
  steel: '#b8b8d0', fairy: '#ee99ac',
}

// Entrenadores normales (clase + nombre)
const TRAINER_TYPES: Array<{ label: string; name: string; sprite: string }> = [
  { label: 'Youngster', name: 'Miguel', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/youngster.png' },
  { label: 'Youngster', name: 'Tommy', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/youngster.png' },
  { label: 'Lass', name: 'Laura', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/lass.png' },
  { label: 'Lass', name: 'Ana', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/lass.png' },
  { label: 'Hiker', name: 'Jorge', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/hiker.png' },
  { label: 'Hiker', name: 'Bruno', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/hiker.png' },
  { label: 'Fisherman', name: 'Carlos', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/fisherman.png' },
  { label: 'Fisherman', name: 'Pedro', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/fisherman.png' },
  { label: 'Camper', name: 'Ricky', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/camper.png' },
  { label: 'Biker', name: 'Gus', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/biker.png' },
  { label: 'Beauty', name: 'Valeria', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/beauty.png' },
  { label: 'Gentleman', name: 'Arthur', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/gentleman.png' },
  { label: 'Sailor', name: 'Ramiro', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/sailor.png' },
  { label: 'Bug Catcher', name: 'Diego', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/bugcatcher.png' },
  { label: 'Picnicker', name: 'Mia', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/picnicker.png' },
  { label: 'Ace Trainer', name: 'Sergio', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/acetrainer.png' },
  { label: 'Ace Trainer', name: 'Elena', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/acetrainerf.png' },
  { label: 'Black Belt', name: 'Kenji', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blackbelt.png' },
  { label: 'Psychic', name: 'Marco', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/psychic.png' },
  { label: 'Swimmer', name: 'Max', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/swimmer.png' },
]

// Líderes de Gimnasio (solo aparecen en el Jefe Final)
const GYM_LEADERS: Array<{ name: string; badge: string; sprite: string }> = [
  { name: 'Brock', badge: 'Médalla Roca', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/brock.png' },
  { name: 'Misty', badge: 'Médalla Cascada', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/misty.png' },
  { name: 'Surge', badge: 'Médalla Trueno', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/ltsurge.png' },
  { name: 'Erika', badge: 'Médalla Arco Iris', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/erika.png' },
  { name: 'Sabrina', badge: 'Médalla Pantano', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/sabrina.png' },
  { name: 'Blaine', badge: 'Médalla Volcán', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blaine.png' },
  { name: 'Giovanni', badge: 'Médalla Tierra', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/giovanni.png' },
  { name: 'Falkner', badge: 'Médalla Ala', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/falkner.png' },
  { name: 'Bugsy', badge: 'Médalla Colmíllo', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/bugsy.png' },
  { name: 'Whitney', badge: 'Médalla Lisa', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/whitney.png' },
  { name: 'Morty', badge: 'Médalla Niebla', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/morty.png' },
  { name: 'Chuck', badge: 'Médalla Tormenta', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/chuck.png' },
  { name: 'Jasmine', badge: 'Médalla Mineral', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/jasmine.png' },
  { name: 'Pryce', badge: 'Médalla Glaciar', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/pryce.png' },
  { name: 'Clair', badge: 'Médalla Ascenso', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/clair.png' },
  { name: 'Roxanne', badge: 'Médalla Roca', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/roxanne.png' },
  { name: 'Brawly', badge: 'Médalla Puño', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/brawly.png' },
  { name: 'Wattson', badge: 'Médalla Dinámo', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/wattson.png' },
  { name: 'Flannery', badge: 'Médalla Calor', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/flannery.png' },
  { name: 'Norman', badge: 'Médalla Balance', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/norman.png' },
  { name: 'Winona', badge: 'Médalla Pluma', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/winona.png' },
  { name: 'Tate', badge: 'Médalla Mente', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/tate.png' },
  { name: 'Juan', badge: 'Médalla Lluvia', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/juan.png' },
  { name: 'Roark', badge: 'Médalla Carbona', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/roark.png' },
  { name: 'Gardenia', badge: 'Médalla Bosque', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/gardenia.png' },
  { name: 'Maylene', badge: 'Médalla Cobra', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/maylene.png' },
  { name: 'Fantina', badge: 'Médalla Relevo', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/fantina.png' },
  { name: 'Byron', badge: 'Médalla Mina', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/byron.png' },
  { name: 'Candice', badge: 'Médalla Escarcha', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/candice.png' },
  { name: 'Volkner', badge: 'Médalla Faro', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/volkner.png' },
]

interface PokedexEntry {
  id: number
  name: string
  sprite: string
  types: string[]
  seen: boolean
  caught: boolean
}

function nodeTypeLabel(node: RouteNode): string {
  const en = getLanguage() === 'en'
  switch (node.type) {
    case 'battle': return en ? 'Battle' : 'Combate'
    case 'rest': return en ? 'Rest' : 'Descanso'
    case 'shop': return en ? 'Shop' : 'Tienda'
    case 'boss': return en ? 'Boss' : 'Jefe'
    case 'teamRocket': return 'TeamR'
    case 'spin': return 'Spin'
    case 'pokeRand': return 'PokeRand'
    case 'move': return 'Move'
    case 'mega': return 'Mega'
    case 'gmax': return 'G-MAX'
    case 'primal': return 'Primal'
    case 'trade': return en ? 'Trade' : 'Intercambio'
    case 'rival': return 'Rival'
    case 'blackmarket': return en ? 'Black Market' : 'Mercado Negro'
    case 'double': return en ? 'Double Battle' : 'Combate Doble'
    case 'casino': return 'Casino'
    default: return node.type
  }
}

// Genera un tramo de ruta cooperativa (nodos + jefe final) con nodos de
// intercambio en posiciones proporcionales. Usa el RNG con semilla para que
// ambos jugadores generen exactamente el mismo tramo.
function generateCoopRouteSegment(startId: number, totalNodes: number, rr: () => number, challenges: RunChallenges, difficulty: Difficulty = 'medium'): RouteNode[] {
  const segment: RouteNode[] = []
  let tradeCount = 2
  if (difficulty === 'hard') tradeCount = 4
  else if (difficulty === 'easy') tradeCount = 1
  const tradePositions = new Set<number>()
  if (difficulty === 'easy') {
    tradePositions.add(Math.min(totalNodes - 1, Math.ceil(totalNodes / 2)))
  } else {
    for (let t = 1; t <= tradeCount; t++) {
      tradePositions.add(Math.max(1, Math.floor((totalNodes * t) / (tradeCount + 1))))
    }
  }
  for (let i = 1; i < totalNodes; i++) {
    const id = startId + i - 1
    let type: RouteNode['type'] = 'battle'
    if (tradePositions.has(i)) {
      type = 'trade'
    } else {
      const r = rr()
      if (r < 0.18 && !challenges.noShops) {
        type = 'shop'
      } else if (r < 0.36 && !challenges.noRests) {
        type = 'rest'
      } else if (r < 0.50) {
        type = 'teamRocket'
      } else if (r < 0.62) {
        type = 'spin'
      }
    }
    segment.push({ id, type, label: `${nodeTypeLabel({ id, type, label: '', done: false })} #${id}`, done: false })
  }
  segment.push({ id: startId + totalNodes - 1, type: 'boss', label: `Combate Final (#${startId + totalNodes - 1})`, done: false })
  return segment
}

const NODE_EMOJIS: Record<string, string> = {
  battle: '⚔️',
  rest: '🏕️',
  shop: '🏪',
  boss: '👑',
  teamRocket: '®️',
  spin: '🎰',
  pokeRand: '🎲',
  move: '🧬',
  mega: '💎',
  gmax: '⚡',
  primal: '🔮',
  trade: '🤝',
  rival: '👤',
  blackmarket: '🕶️',
  double: '🥊',
  casino: '🃏',
}

const NODE_TYPE_COLORS: Record<string, string> = {
  battle: '#7d7ab5',
  rest: '#37d16b',
  shop: '#ffcb05',
  boss: '#ee3b2f',
  teamRocket: '#ee3b2f',
  spin: '#a855f7',
  pokeRand: '#4d9bff',
  move: '#56e0cd',
  mega: '#ff9ad6',
  gmax: '#9da6ff',
  primal: '#ff8a33',
  trade: '#37d16b',
  rival: '#f472b6',
  blackmarket: '#fb923c',
  double: '#facc15',
  casino: '#f0abfc',
}

function getNodeMapLayout(nodeCount: number): { positions: Array<{ x: number; y: number }>; width: number; height: number } {
  const perRow = nodeCount <= 6 ? nodeCount : Math.min(6, Math.max(4, Math.ceil(Math.sqrt(nodeCount * 2.5))))
  const rows = Math.ceil(nodeCount / perRow)
  const spacingX = 150
  const spacingY = 145
  const marginX = 75
  const width = marginX * 2 + (perRow - 1) * spacingX
  const height = 70 + (rows - 1) * spacingY + 90
  const positions: Array<{ x: number; y: number }> = []
  for (let i = 0; i < nodeCount; i++) {
    const row = Math.floor(i / perRow)
    const col = row % 2 === 0 ? i % perRow : perRow - 1 - (i % perRow)
    const rowCount = Math.min(perRow, nodeCount - row * perRow)
    const rowCenteredOffset = (row % 2 === 0 ? 1 : -1) * (perRow - rowCount) * spacingX / 2
    positions.push({ x: marginX + rowCenteredOffset + col * spacingX, y: 70 + row * spacingY })
  }
  return { positions, width, height }
}

function moveTooltip(move: Move): string {
  const accuracy = move.accuracy === null ? 'Siempre acierta' : `${move.accuracy}% precisión`
  const isStatus = !move.power || move.power <= 0
  const cls = isStatus ? 'Estado' : move.damageClass === 'special' ? 'Especial' : 'Físico'
  let info = `${moveName(move)}\n${isStatus ? 'Movimiento de estado' : `${cls} · Potencia: ${move.power}`}\n${accuracy}`
  if (move.ailment) {
    const pct = Math.round((move.ailmentChance ?? 1) * 100)
    info += `\nEfecto: ${statusLabel(move.ailment ?? '')} (${pct}%)`
  }
  if (move.statChanges && move.statChanges.length > 0) {
    for (const sc of move.statChanges) {
      const statName = sc.stat === 'attack' ? 'Ataque' : sc.stat === 'defense' ? 'Defensa' : sc.stat === 'speed' ? 'Velocidad' : sc.stat === 'special-attack' ? 'At. Esp.' : 'Def. Esp.'
      const dir = sc.change > 0 ? 'Sube' : 'Baja'
      const pct = sc.chance != null ? ` (${sc.chance}%)` : ''
      info += `\nEfecto: ${dir} ${statName}${pct}`
    }
  }
  if (move.minHits && move.maxHits) {
    info += `\nGolpes: ${move.minHits}-${move.maxHits}`
  }
  if (move.recoilPercent) {
    info += `\nRecoil: ${Math.round(move.recoilPercent * 100)}%`
  }
  if (move.drainPercent) {
    info += `\nDrena: ${Math.round(move.drainPercent * 100)}% HP`
  }
  if (move.critRatio && move.critRatio > 0) {
    info += `\nAlto ratio de crítico`
  }
  info += `\n${move.description}`
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
function trainerTeamSize(routeIndex: number, routeLength: number, difficulty: string): number {
  if (difficulty === 'infinite') {
    return Math.max(2, Math.min(6, 2 + Math.floor((routeIndex + 1) / 5)))
  }
  const progress = routeIndex / Math.max(1, routeLength - 1)
  return Math.max(2, Math.min(6, 2 + Math.floor(progress * 4)))
}

// Tamaño máximo de equipo para entrenadores normales (1 → 6). Igual que
// trainerTeamSize: monótono en Infinite para evitar picos por el crecimiento
// ilimitado de la ruta, y mantiene el rango 1..6 junto con su variación aleatoria.
function trainerMaxSize(routeIndex: number, routeLength: number, difficulty: string): number {
  if (difficulty === 'infinite') {
    return Math.min(6, 1 + Math.floor(routeIndex / 5))
  }
  const progress = routeIndex / Math.max(1, routeLength - 1)
  return Math.max(1, Math.min(6, Math.floor(progress * 6) + 1))
}

// Reparte los niveles de un equipo de entrenador dentro de los rangos conocidos
// por dificultad, para que no todos los Pokémon tengan el mismo nivel.
// El primer Pokémon (líder) es el más fuerte y el resto baja progresivamente.
function trainerMemberLevelOffset(idx: number, teamSize: number, isBoss: boolean, difficulty: string): number {
  const progress = idx / Math.max(1, teamSize - 1)
  const jitter = Math.floor(Math.random() * 3) - 1 // -1, 0, +1
  if (difficulty === 'easy') {
    // En Fácil los entrenadores van por debajo del promedio del equipo.
    return Math.round((1 - progress) * 2) - 2 + jitter
  }
  if (difficulty === 'infinite') {
    // -1..+3 sobre el nivel máximo del equipo
    return Math.round((1 - progress) * 4) - 1 + jitter
  }
  if (isBoss) {
    // 0..+2 por encima del promedio del equipo
    return Math.round((1 - progress) * 2) + jitter
  }
  // -1..+1 alrededor del promedio del equipo
  return Math.round((1 - progress) * 2) - 1 + jitter
}

interface ProgressionData {
  completedMedium: number[]
  completedAny: number[]
  completedHard: number[]
  completedColiseum: number[]
  completedLeague: number[]
}

interface VictoryUnlocks {
  genName: string
  nextGenNumber: number | null
  nextGenName: string | null
  unlockedHard: boolean
  unlockedInfinite: boolean
}

function getFirstHealthyIndex(team: Pokemon[], currentIndex: number): number {
  return team.findIndex((pokemon, index) => index !== currentIndex && pokemon.hp > 0)
}

// Suaviza al rival del primer combate para que no pueda debilitar al starter
// de un solo golpe: limita su ataque/at.especial según la defensa del equipo
// del jugador y rebaja la potencia de sus movimientos.
function softenFirstBattleEnemy(enemy: Pokemon, team: Pokemon[]): Pokemon {
  const avgDef = team.reduce((s, p) => s + p.defense, 0) / Math.max(1, team.length)
  const avgSpDef = team.reduce((s, p) => s + p.spDefense, 0) / Math.max(1, team.length)
  const atkCap = Math.max(20, Math.round(avgDef * 1.2))
  const spaCap = Math.max(20, Math.round(avgSpDef * 1.2))
  const moves = enemy.moves.map((m) => (m.power ?? 0) > 50 ? { ...m, power: 50 } : m)
  return {
    ...enemy,
    attack: Math.min(enemy.attack, atkCap),
    spAttack: Math.min(enemy.spAttack, spaCap),
    moves,
  }
}

function MainApp() {
  const [screen, setScreen] = useState<Screen>('setup')
  const [generation, setGeneration] = useState<number>(1)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [currentRunGen, setCurrentRunGen] = useState<number>(1)
  const [victoryUnlocks, setVictoryUnlocks] = useState<VictoryUnlocks | null>(null)

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
          completedLeague: Array.isArray(parsed.completedLeague) ? parsed.completedLeague : []
        }
      }
    } catch {
      // fallback
    }
    return { completedMedium: [], completedAny: [], completedHard: [], completedColiseum: [], completedLeague: [] }
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
  const [shopQty, setShopQty] = useState<Record<string, number>>({})
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
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [apiError, setApiError] = useState<string>('')
  const [restEncounter, setRestEncounter] = useState<Pokemon | null>(null)
  const [restRewardItem, setRestRewardItem] = useState<string>('')
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
  const [evoPopup, setEvoPopup] = useState<{ oldSprite: string; newSprite: string; oldName: string; newName: string } | null>(null)
  const [leagueOffer, setLeagueOffer] = useState(false)
  const [leagueTeamSelection, setLeagueTeamSelection] = useState(false)
  const [tempLeagueTeam, setTempLeagueTeam] = useState<Pokemon[]>([])
  const [battleTurns, setBattleTurns] = useState(0)
  const [enemyHitFlash, setEnemyHitFlash] = useState(false)

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

  // Move node (intercambio de movimientos)
  const [moveOptions, setMoveOptions] = useState<Move[]>([])
  const [selectedNewMove, setSelectedNewMove] = useState<Move | null>(null)
  const [moveOptionsByIndex, setMoveOptionsByIndex] = useState<Record<number, Move[]>>({})
  const moveFromItemRef = useRef(false)

  // Egglocke
  const [eggInventory, setEggInventory] = useState<Array<{ name: string; sprite: string; types: string[]; hatchIn: number; id: number }>>([])

  const [pcStorage, setPcStorage] = useState<Pokemon[]>([])
  const [modifier2, setModifier2] = useState<RunModifier | null>(null)
  const [gauntletKeys, setGauntletKeys] = useState<Array<keyof RunChallenges>>([])

  // Speedrun timer
  const [speedrunSeconds, setSpeedrunSeconds] = useState<number>(0)
  const speedrunTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const megaNodeSpawnedRef = useRef(false)
  const [battleMegaUsed, setBattleMegaUsed] = useState(false)
  const [battleGmaxUsed, setBattleGmaxUsed] = useState(false)
  const [battlePrimalUsed, setBattlePrimalUsed] = useState(false)

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
  const [pokedexSearch, setPokedexSearch] = useState<string>('')
  const [selectedPokemonDetail, setSelectedPokemonDetail] = useState<PokemonDetails | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false)

  // Opciones / Volumen
  const [showOptions, setShowOptions] = useState<boolean>(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState<boolean>(false)
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false)
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
        migrated[id] = {
          ...val,
          name,
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
        return data
      }
    } catch {}
    return { pokeCoins: 0, totalRuns: 0, totalWins: 0, bestStreak: 0, unlockedStarters: [], permanentlyUnlockedItems: [], ownedThemes: ['dark'], activeTheme: 'dark', ownedBackgrounds: ['none'], activeBackground: 'none', ownedMusic: [], activeMenuMusic: 'default', activeBattleMusic: 'default', totalMegas: 0, totalGmax: 0, coopRuns: 0, coopWins: 0, coopTrades: 0 }
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
  const [shinyNextEncounter, setShinyNextEncounter] = useState<boolean>(false)
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
  useEffect(() => { teamRef.current = team }, [team])
  const [traderModal, setTraderModal] = useState<boolean>(false)
  const [merchantItems, setMerchantItems] = useState<Array<{ name: string; price: number }> | null>(null)
  const [randomEventUsed, setRandomEventUsed] = useState<Set<string>>(new Set())
  const [showMetaShop, setShowMetaShop] = useState<boolean>(false)
  const [metaShopSearch, setMetaShopSearch] = useState('')
  const [unlockPopup, setUnlockPopup] = useState<{ name: string; spriteKey: string } | null>(null)
  const [badges, setBadges] = useState<Array<{ id: string; name: string; sprite: string }>>([])
  const [currentStage, setCurrentStage] = useState<number>(1)

  const currentNode = useMemo(() => route[routeIndex] ?? null, [route, routeIndex])
  const activePokemon = useMemo(() => team[activeIndex] ?? null, [team, activeIndex])
  const inventoryEntries = useMemo(() => groupInventory(inventory), [inventory])

  useEffect(() => { startMenuMusic() }, [])

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
        if (orig) return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, ...orig, ...reset }
        return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, ...reset }
      }))
      setBattleMegaUsed(false)
      setBattleGmaxUsed(false)
      setBattlePrimalUsed(false)
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
      if (team.length < maxTeamSize) {
        setTeam(prev => [...prev, withStages])
      } else {
        setPcStorage(prev => [...prev, withStages])
      }
      setBattleLog(prev => [t('b.secretAdded', { name: pokemon.name, lvl: pokemon.level, toPc: team.length >= maxTeamSize ? t('b.toPc') : '' }), ...prev].slice(0, 15))
      setSecretPokemonQuery('')
      setSecretAddOpen(false)
    } catch {
      setSecretAddError('No se encontró ese Pokémon en PokeAPI. Usa un ID o un nombre válido (ej. 25, pikachu).')
    } finally {
      setSecretAddLoading(false)
    }
  }

  function buyMetaItem(item: MetaShopItem): void {
    if (item.requires && !metaProgression.permanentlyUnlockedItems.includes(item.requires)) return
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
    setMetaProgression(updated)
    localStorage.setItem('pokerand_meta', JSON.stringify(updated))
    setUnlockPopup({ name: item.name, spriteKey: 'spriteKey' in item ? (item as MetaShopItem).spriteKey : 'Potion' })
    setTimeout(() => setUnlockPopup(null), 3000)
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
    unlock_elixir: 'Elixir',
    unlock_super_elixir: 'Super Elixir',
    unlock_full_elixir: 'Full Elixir',
    unlock_x_attack_2: 'X Attack 2',
    unlock_x_defense_2: 'X Defense 2',
    unlock_x_speed_2: 'X Speed 2',
    unlock_smoke_ball: 'Cuerda Huida',
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
    unlock_sitrus_berry: 'Sitrus Berry',
    unlock_guts_band: 'Guts Band',
    unlock_vest_protector: 'Vest Protector',
    unlock_focus_band: 'Focus Band',
    unlock_dragon_fang: 'Dragon Fang',
    unlock_guardian_charm: 'Guardian Charm',
    unlock_berserker_band: 'Berserker Band',
    unlock_phantom_cloak: 'Phantom Cloak',
    unlock_swift_feather: 'Swift Feather',
    unlock_iron_ball: 'Iron Ball',
    unlock_vampire_fang: 'Vampire Fang',
    unlock_cursed_blade: 'Cursed Blade',
    unlock_focus_sash_2: 'Focus Sash II',
    unlock_scope_lens_2: 'Scope Lens II',
    unlock_shell_bell_2: 'Shell Bell II',
    unlock_assault_vest_2: 'Assault Vest II',
    unlock_leftovers_2: 'Leftovers II',
    unlock_quick_claw_2: 'Quick Claw II',
    unlock_repartir_exp: 'Repartir Exp',
  }
  const LOCKED_POKEBALL_MAP: Record<string, string> = {}
  for (const [ballName, unlockId] of Object.entries(POKEBALL_UNLOCK_IDS)) {
    LOCKED_POKEBALL_MAP[unlockId] = ballName
  }
  const LOCKED_EVOLUTION_STONE_MAP: Record<string, string> = {}
  for (const [stoneName, unlockId] of Object.entries(EVOLUTION_STONE_UNLOCK_IDS)) {
    LOCKED_EVOLUTION_STONE_MAP[unlockId] = stoneName
  }

  const isConsumableUnlocked = (name: string) => !Object.values(LOCKED_CONSUMABLE_MAP).includes(name) || metaProgression.permanentlyUnlockedItems.some(k => LOCKED_CONSUMABLE_MAP[k] === name)
  const isHoldableUnlocked = (name: string) => !Object.values(LOCKED_HOLDABLE_MAP).includes(name) || metaProgression.permanentlyUnlockedItems.some(k => LOCKED_HOLDABLE_MAP[k] === name)
  const isPokeballUnlocked = (name: string) => name === 'Poké Ball' || !POKEBALL_UNLOCK_IDS[name] || metaProgression.permanentlyUnlockedItems.some(k => LOCKED_POKEBALL_MAP[k] === name)
  const isEvolutionStoneUnlocked = (name: string) => !EVOLUTION_STONE_UNLOCK_IDS[name] || metaProgression.permanentlyUnlockedItems.some(k => LOCKED_EVOLUTION_STONE_MAP[k] === name)

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

  function isColiseumUnlocked(): boolean {
    return generations.every(g => progression.completedMedium.includes(g))
  }

  function handleSelectGeneration(gen: number) {
    if (!isGenUnlocked(gen)) return
    setGeneration(gen)
    if (difficulty === 'hard' && !isHardUnlocked(gen)) {
      setDifficulty('medium')
    }
    if (difficulty === 'infinite' && !isInfiniteUnlocked(gen)) {
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

  async function handleSelectPokedexPokemon(id: number) {
    setIsLoadingDetail(true)
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
      if (prev[pokemonId]?.caught) return prev

      const updated: Record<number, PokedexEntry> = {
        ...prev,
        [pokemonId]: {
          id: pokemonId,
          name: pokemon.name,
          sprite: pokemon.sprite,
          types: (pokemon as any).types ?? [],
          seen: true,
          caught: true
        }
      }
      localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
      return updated
    })
  }

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
      if (prev[pokemonId]) return prev

      const updated: Record<number, PokedexEntry> = {
        ...prev,
        [pokemonId]: {
          id: pokemonId,
          name: pokemon.name,
          sprite: pokemon.sprite,
          types: (pokemon as any).types ?? [],
          seen: true,
          caught: false
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
    if (achievement) setNewAchievement(achievement)
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

  useEffect(() => {
    const legendaryIds = Object.entries(pokedex).filter(([,e]) => e.name.startsWith('legendary-')).map(([id]) => Number(id))
    if (legendaryIds.length === 0) return
    legendaryIds.forEach(id => {
      fetchPokemonDetails(id).then(details => {
        setPokedex(prev => {
          if (!prev[id]?.name.startsWith('legendary-')) return prev
          const updated = { ...prev, [id]: { ...prev[id], name: details.name } }
          localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
          return updated
        })
      }).catch(() => {})
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
    const eligible = RANDOM_EVENTS.filter(e => routeProgress >= e.minRouteProgress && !randomEventUsed.has(e.id))
    if (eligible.length === 0) return
    const totalWeight = eligible.reduce((s, e) => s + e.weight, 0)
    let roll = Math.random() * totalWeight
    for (const event of eligible) {
      roll -= event.weight
      if (roll <= 0) {
        setActiveRandomEvent({ id: event.id, icon: event.icon, title: event.title, desc: event.desc })
        setRandomEventUsed(prev => new Set(prev).add(event.id))
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
        const legendaryIds = [144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,480,481,482,483,484,485,486,487,488,491,492,493,494,638,639,640,641,642,643,644,645,646,647,648,649]
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
        const unlockedItems = Object.keys(EVOLUTION_ITEM_UNLOCK_IDS).filter(n => metaProgression.permanentlyUnlockedItems.includes(EVOLUTION_ITEM_UNLOCK_IDS[n]))
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
        const items = ['Potion', 'X Attack', ...BERRY_DROPS.filter(isConsumableUnlocked)]
        const item = items[Math.floor(Math.random() * items.length)]
        setInventory(prev => [...prev, item])
        setBattleLog(prev => [t('b.coinChest', { gold, item }), ...prev])
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
          setTeam(prev => prev.map((p, i) => i === faintedIdx ? { ...p, hp: revivedHp } : p))
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

  function generateRandomNodeType(id: number, rng: () => number = Math.random): RouteNode {
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
        } else if (rand < 0.54 && metaProgression.permanentlyUnlockedItems.includes('unlock_mega_node')) {
          type = 'mega'
        } else if (rand < 0.60 && metaProgression.permanentlyUnlockedItems.includes('unlock_gmax_node')) {
          type = 'gmax'
        } else if (rand < 0.63 && metaProgression.permanentlyUnlockedItems.includes('unlock_primal_node')) {
          type = 'primal'
        } else if (rand < 0.69 && metaProgression.permanentlyUnlockedItems.includes('unlock_casino_node')) {
          type = 'casino'
        }
      } else if (difficulty === 'medium') {
        if (rand < 0.15 && !runChallenges.noShops) {
          type = 'shop'
        } else if (rand < 0.35 && !runChallenges.noRests) {
          type = 'rest'
        } else if (rand < 0.47) {
          type = 'teamRocket'
        } else if (rand < 0.57) {
          type = 'spin'
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
    return {
      id,
      type,
      label: type === 'teamRocket' ? `TeamR #${id}` : type === 'spin' ? `Spin #${id}` : type === 'pokeRand' ? `PokeRand #${id}` : type === 'move' ? `Move #${id}` : type === 'mega' ? `Mega #${id}` : type === 'gmax' ? `G-MAX #${id}` : type === 'primal' ? `Primal #${id}` : type === 'casino' ? `Casino #${id}` : type === 'rival' ? `Rival #${id}` : type === 'blackmarket' ? `Mercado Negro #${id}` : type === 'double' ? `Doble #${id}` : `Ruta ${id}`,
      done: false
    }
  }

  function handleStartRunClick(): void {
    playClick()
    if (coopMode) {
      if (!coopSessionCode) { setCoopError(t('coop.needSession')); return }
      if (coopMyRole === 'a' && !coopPartnerJoined) { setCoopError('Espera a que tu compañero se una a la sesión.'); return }
    }
    startNewRun()
  }

  async function startNewRun(sameRoute = false): Promise<void> {
    const dailyCfg = isDailyRunRef.current ? getDailyConfig(dailySeed, [1,2,3,4,5,6,7,8,9]) : null
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

      const starter = await getRandomStarterByGeneration(targetGen, activeChallenges.allShiny, effectiveDifficulty)
      const config: RunConfig = { generation: targetGen }
      const run = startRun(config, activeChallenges.doubleModifiers)

      if (isDailyRunRef.current) {
        const dailyCfg = getDailyConfig(dailySeed, [targetGen])
        const fixedMod = RUN_MODIFIERS.find(m => m.id === dailyCfg.modifierId)
        if (fixedMod) run.modifier = fixedMod
      }

      if (run.modifier2) {
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
      } else if (activeChallenges.bossRush) {
        customRoute = generateBossRushRoute(totalNodes)
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
            if (available.length > 0 && metaProgression.permanentlyUnlockedItems.includes('unlock_mega_node')) {
              const idx = Math.floor(rr() * available.length)
              megaPosition = available[idx]
              available.splice(idx, 1)
              megaNodeSpawnedRef.current = true
            }
            if (available.length > 0 && metaProgression.permanentlyUnlockedItems.includes('unlock_gmax_node')) {
              const idx = Math.floor(rr() * available.length)
              gmaxPosition = available[idx]
              available.splice(idx, 1)
            }
            if (available.length > 0 && metaProgression.permanentlyUnlockedItems.includes('unlock_primal_node')) {
              const idx = Math.floor(rr() * available.length)
              primalPosition = available[idx]
              available.splice(idx, 1)
            }
            if (metaProgression.permanentlyUnlockedItems.includes('unlock_casino_node')) {
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

          customRoute.push({
            id: i,
            type,
            label: type === 'teamRocket' ? `TeamR #${i}` : type === 'spin' ? `Spin #${i}` : type === 'pokeRand' ? `PokeRand #${i}` : type === 'move' ? `Move #${i}` : type === 'mega' ? `Mega #${i}` : type === 'gmax' ? `G-MAX #${i}` : type === 'primal' ? `Primal #${i}` : type === 'casino' ? `Casino #${i}` : type === 'rival' ? `Rival #${i}` : type === 'blackmarket' ? `Mercado Negro #${i}` : type === 'double' ? `Doble #${i}` : `Ruta ${i}`,
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

      const hpBonus = run.modifier?.playerMaxHpBonus ?? 0
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
      const startItems = metaProgression.permanentlyUnlockedItems
      const extraBalls = startItems.includes('start_pokeballs_5') ? 5 : 0
      const extraPotions =
        (startItems.includes('start_potion_1') ? 1 : 0) +
        (startItems.includes('start_potion_2') ? 1 : 0)
      const extraMoney =
        ((startItems.includes('start_money_1') ? 1 : 0) +
         (startItems.includes('start_money_2') ? 1 : 0)) * 100
      setMoney(activeChallenges.noMoney ? 0 : 100 + extraMoney)
      const startingItems: string[] = [run.item]
      for (let i = 0; i < 5 + extraBalls; i++) startingItems.push('Poké Ball')
      for (let i = 0; i < extraPotions; i++) startingItems.push('Potion')
      if (startItems.includes('start_revive_1')) startingItems.push('Revive')
      setInventory(startingItems)
      setModifier(run.modifier)
      setRoute(customRoute)
      setRouteIndex(0)
      setBadges([])
      setCurrentStage(1)
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
        `${t('common.difficulty')}: ${difficultyLabel(language, effectiveDifficulty).title}${effectiveDifficulty === 'infinite' ? t('b.noLimit') : t('b.threeStages', { n: totalNodes })}.`,
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
      completedLeague: currentNode && currentNode.id >= 1000
        ? Array.from(new Set([...progression.completedLeague, genPlayed]))
        : progression.completedLeague
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

    const hasActiveChallenge = activeChallengeCount > 0
    const baseCoins = difficulty === 'easy' ? 10 : difficulty === 'hard' ? 20 : 15

    setMetaProgression(prev => {
      const coins = baseCoins + (hasActiveChallenge ? 15 : 0)
      const updated = { ...prev, totalRuns: prev.totalRuns + 1, totalWins: prev.totalWins + 1, bestStreak: Math.max(prev.bestStreak, newStreak), pokeCoins: prev.pokeCoins + coins }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
    awardPokeCoins(baseCoins, `¡Victoria! (${difficulty === 'easy' ? 'Fácil' : difficulty === 'hard' ? 'Difícil' : 'Medio'})`)
    if (currentNode && currentNode.id >= 1000) {
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
    // Las etapas de stats (subidas/bajadas de Ataque, Def. Esp., etc.) solo
    // debían durar un combate. Como las pantallas de victoria/derrota solo se
    // usan al terminar la run, aquí se resetean al completar CUALQUIER nodo:
    // evita que una Def. Esp. subida se "pegue" a niveles altos durante toda la run.
    setTeam(prev => prev.map(p => p.statStages && (p.statStages.attack !== 0 || p.statStages.defense !== 0 || p.statStages.spAttack !== 0 || p.statStages.spDefense !== 0 || p.statStages.speed !== 0)
      ? { ...p, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, furiaActive: false }
      : p))

    if (difficulty === 'coliseum') {
      setTeam(prev => prev.map(p => ({ ...p, hp: p.maxHp, status: undefined })))
      setBattleLog(prev => [t('b.autoHeal'), ...prev].slice(0, 15))
    }

    setRestEncounter(null)
    setRestRewardItem('')
    setLegendaryEncounter(null)
    setBattleTurns(0)
    if (speedrunTimerRef.current) {
      clearInterval(speedrunTimerRef.current)
      speedrunTimerRef.current = null
    }
    setSpeedrunSeconds(0)
    setTeam(prev => prev.map((p) => {
      const orig = p.megaOrig
      if (orig) return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, ...orig }
      return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined }
    }))
    setBattleGmaxUsed(false)
    setBattlePrimalUsed(false)
    setRoute((previous) =>
      previous.map((node, index) => (index === routeIndex ? { ...node, done: true } : node))
    )

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
      if (difficulty === 'infinite') {
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
                  metaProgression.permanentlyUnlockedItems.includes('unlock_casino_node') &&
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
    const progress = route.length > 0 ? (routeIndex + 1) / route.length : 0
    if (difficulty !== 'coliseum') triggerRandomEvent(progress)
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
      let exists = await resetCoopSession(coopSessionCodeRef.current)
      setCoopSessionEndedMsg('')
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
    setPvpBuildMoves([])
    setPvpBuildSelectedMoveNames(new Set())
    setPvpBuildSearch('')
    setShowPvpTeamBuilder(true)
  }

  async function loadPvpBuildMoves(id: number, existingMoveNames: string[] = []): Promise<void> {
    setPvpBuildLoading(true)
    setPvpBuildSelected(id)
    setPvpBuildMoves([])
    try {
      const base = await buildPokemonFromApi(id, 1, 50, false, 'pvp')
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
    const existing = pvpBuildTeam.find(p => p.id === pvpBuildSelected)
    if (existing) {
      setPvpBuildTeam(prev => prev.map(p => p.id === pvpBuildSelected
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
        const full = await buildPokemonFromApi(pvpBuildSelected, 1, 50, false, 'pvp')
        const chosenMoves = pvpBuildMoves.filter(m => pvpBuildSelectedMoveNames.has(m.name))
        const pokemon: Pokemon = {
          ...full,
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
      if (teamRef.current.length < maxTeamSize) {
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
          if (teamRef.current.length < maxTeamSize) {
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
          if (teamRef.current.length < maxTeamSize) {
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
    if (runChallenges.noEvolution) captured = applyNoEvolutionBuff(captured)
    if (runChallenges.fixedLevel) captured = { ...captured, level: 50 }
    registerInPokedex(captured)
    if (captured.shiny) unlockAchievement('shiny_catch')
    if ((captured.attack + captured.defense + captured.speed + captured.maxHp) >= 600) unlockAchievement('legendary_catch')
    if (team.length >= 6) {
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
    completeCurrentNode()
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
    if (team.length < maxTeamSize) {
      setTeam((prev) => [...prev, pokemon])
      setPcStorage((prev) => prev.filter((_, i) => i !== pcIndex))
      setBattleLog((prev) => [t('b.withdrawnPC', { name: pokemon.name }), ...prev].slice(0, 15))
    } else {
      const swapOut = team[activeIndex]
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
    const price = blackMarketItemPrice(itemName)
    if (money < price) return
    playClick()
    setMoney((prev) => prev - price)
    setInventory((prev) => [...prev, itemName])
    setBattleLog((prev) => [t('b.boughtMarket', { item: itemName, price }), ...prev].slice(0, 15))
  }

  function blackMarketSellItem(itemName: string): void {
    playClick()
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
    setBattleLog((prev) => [t('b.soldMarket', { item: itemName, value }), ...prev].slice(0, 15))
  }

  function blackMarketBuyPokemon(idx: number): void {
    if (runChallenges.soloStarter || runChallenges.fixedTeam) {
      setBattleLog((prev) => [t('b.noModifyTeam'), ...prev].slice(0, 15))
      return
    }
    const pokemon = blackMarketPokemon[idx]
    if (!pokemon) return
    const price = 100 + pokemon.level * 15
    if (money < price) return
    playClick()
    setMoney((prev) => prev - price)
    const purchased = { ...pokemon, hp: pokemon.maxHp, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } }
    registerInPokedex(purchased)
    if (team.length < maxTeamSize) {
      setTeam((prev) => [...prev, purchased])
    } else {
      setPcStorage((prev) => [...prev, purchased])
    }
    setBattleLog((prev) => [t('b.boughtMarketPokemon', { name: pokemon.name, lvl: pokemon.level, price }), ...prev].slice(0, 15))
  }

  // --- Combate Doble (2 vs 2) ---
  function doubleSelectMove(slot: number, moveIdx: number): void {
    setDoubleMoves(prev => {
      const next = [...prev]
      next[slot] = next[slot] ? { ...next[slot]!, moveIdx } : { moveIdx, target: 0 }
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
    if (move.accuracy != null && move.accuracy < 100 && Math.random() * 100 >= move.accuracy) {
      return { attacker, defender, log: [t('b.missed', { attacker: attacker.name, move: moveName(move) })] }
    }
    const defTypes = defender.types ?? []
    const { effectiveness, message } = getTypeEffectiveness(move.type, defTypes[0] || 'normal', defTypes[1])
    const stab = (attacker.types ?? []).some(t => t === move.type) ? 1.5 : 1
    const result = applyDamage(attacker, defender, move)
    const damage = Math.max(1, Math.floor(result.damage * effectiveness * stab))
    const newHp = Math.max(0, defender.hp - damage)
    const log = [t('b.usesHit', { attacker: attacker.name, move: moveName(move), dmg: damage }) + (message ? ` (${message})` : '')]
    let finalDefender: Pokemon = { ...defender, hp: newHp }
    // Aplicar estado (parálisis, quemadura, veneno, confusión...) como en el
    // combate normal: solo si el objetivo sobrevive al golpe.
    if (finalDefender.hp > 0) {
      const ailmented = applyAilmentToTarget(finalDefender, move)
      if (ailmented.status && ailmented.status.type !== finalDefender.status?.type) {
        finalDefender = ailmented
        log.push(statusAppliedLine(finalDefender.name, ailmented.status.type))
      }
    }
    return { attacker, defender: finalDefender, log }
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
      const target = enemies[sel.target]
      if (!move || !target || target.hp <= 0) continue
      const before = target.hp
      const hit = performDoubleHit(attacker, target, move)
      teamCopy[teamIdx] = hit.attacker
      enemies[sel.target] = hit.defender
      log.push(...hit.log)
      if (hit.defender.hp < before) {
        doubleHitKeyRef.current += 1
        hits.push({ kind: 'enemy', index: sel.target, key: doubleHitKeyRef.current })
        playHit()
      }
      if (hit.defender.hp <= 0) log.push(t('b.fainted', { name: hit.defender.name }))
    }

    // Los enemigos vivos contraatacan (objetivo aleatorio entre los activos vivos).
    doubleEnemyCounterattack(teamCopy, actives, enemies, log, hits)

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
    if (doubleActives[slot] === teamIdx) return
    const enemies = [...doubleEnemies]
    const teamCopy = team.map(p => ({ ...p }))
    const actives = [...doubleActives]
    const log = [...doubleLog]
    const hits: Array<{ kind: 'enemy' | 'player'; index: number; key: number }> = []

    // El cambio gasta el turno: el Pokémon que entra no ataca y los enemigos atacan.
    actives[slot] = teamIdx
    log.push(t('b.enteredBattle', { name: teamCopy[teamIdx].name }))

    doubleEnemyCounterattack(teamCopy, actives, enemies, log, hits)

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

  function generateShopStock(excludeStone?: string): string[] {
    const allConsumableKeys = Object.keys(ALL_SHOP_ITEMS).filter(i => isConsumableUnlocked(i) && !POKEBALL_NAMES.includes(i) && !EVOLUTION_STONE_UNLOCK_IDS[i])
    const allHoldableKeys = HOLDABLE_ITEM_NAMES.filter(isHoldableUnlocked).filter(n => n !== 'Mega Stone' && n !== 'Dynamax Band' && n !== 'Prisma Rojo' && n !== 'Prisma Azul' && !EVOLUTION_ITEM_UNLOCK_IDS[n])
    const shuffledConsumables = [...allConsumableKeys].sort(() => 0.5 - Math.random())
    const shuffledHoldables = [...allHoldableKeys].sort(() => 0.5 - Math.random())
    // Mejoras de Espacio de Tienda: +1 objeto por cada versión desbloqueada.
    const extraSlots = (metaProgression.permanentlyUnlockedItems.includes('unlock_shop_slot') ? 1 : 0) +
      (metaProgression.permanentlyUnlockedItems.includes('unlock_shop_slot_2') ? 1 : 0)
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
    if (metaProgression.permanentlyUnlockedItems.includes('unlock_reroll')) n += 1
    if (metaProgression.permanentlyUnlockedItems.includes('unlock_reroll_2')) n += 1
    return n
  }

  function rerollShop(): void {
    if (shopRerollsUsed >= maxShopRerolls()) return
    const currentStone = shopStock.find(n => EVOLUTION_STONE_UNLOCK_IDS[n])
    setShopStock(generateShopStock(currentStone))
    setShopRerollsUsed(prev => prev + 1)
    playClick()
    setBattleLog((prev) => [t('b.rerolled', { used: shopRerollsUsed + 1, max: maxShopRerolls() }), ...prev].slice(0, 15))
  }

  async function enterNode(): Promise<void> {
    if (!activePokemon || !currentNode) return

    // Red de seguridad: las etapas de stats SIEMPRE se reinician al entrar a un
    // nodo nuevo, cubriendo cualquier ruta de fin de combate que no pasara por
    // completeCurrentNode. Evita que At. Esp. / Def. Esp. se acumulen.
    setTeam(prev => prev.map(p => p.statStages && (p.statStages.attack !== 0 || p.statStages.defense !== 0 || p.statStages.spAttack !== 0 || p.statStages.spDefense !== 0 || p.statStages.speed !== 0)
      ? { ...p, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, furiaActive: false }
      : p))

    // El flag de batalla TeamR debe reflejar SIEMPRE el nodo actual, para que un
    // TeamR escapado (Cuerda Huida) o un combate normal no hereden el robo/elección.
    setIsTeamRocketBattle(currentNode.type === 'teamRocket')
    setIsRivalBattle(currentNode.type === 'rival')

    if (currentNode.type === 'blackmarket') {
      // Mercado Negro: vende objetos/Pokémon y compra objetos baratos y Pokémon.
      const blackItems = [...Object.keys(ALL_SHOP_ITEMS)].filter(i => isConsumableUnlocked(i))
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
          getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length, targetLevel)
            .then((base) => {
              const levelDiff = targetLevel - base.level
              let scaled = scalePokemonForNode(base, currentNode, routeIndex, levelDiff, difficulty)
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
          getBalancedPokemonByGeneration(targetGen, routeIndex + idx, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length, targetLevel)
            .then((base) => {
              const levelDiff = targetLevel - base.level
              let scaled = scalePokemonForNode(base, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff, difficulty)
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
        setDoubleActives(aliveIdx.slice(0, 2))
        setDoubleEnemies(enemies)
        setDoubleMoves([null, null])
        setDoubleActiveSlot(0)
        setDoubleChoosingSwitch(false)
        setDoubleLog([t('b.doubleChallenge', { a: enemies[0].name, b: enemies[1].name })])
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
          return getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length, targetLevel)
            .then((base) => {
              const levelDiff = targetLevel - base.level
              const scaled = scalePokemonForNode(base, currentNode, routeIndex, levelDiff, difficulty)
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
        let scaled = scalePokemonForNode({ ...base, minAppearLevel: undefined }, currentNode, routeIndex, gmaxLevelDelta, difficulty)
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
        const restPokemonBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length)
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
          : randomFrom(['Potion', 'Super Potion', 'X Attack', ...BERRY_DROPS.filter(isConsumableUnlocked)]))
        setRestRewardItem(rewardItem)
        setInventory((previous) => [...previous, rewardItem])
        setBattleLog((prev) => [
          t('rest.eggFound', { name: eggEntry.name, n: eggEntry.hatchIn, label: currentNode.label }),
          t('rest.eggItem', { item: rewardItem }),
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
      const restPokemonBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length, restTargetLevel)
      const levelDiff = restTargetLevel - restPokemonBase.level
      const generatedEncounter = scalePokemonForNode(restPokemonBase, currentNode, routeIndex, levelDiff, difficulty)
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
        : randomFrom(['Potion', 'Super Potion', 'X Attack', ...BERRY_DROPS.filter(isConsumableUnlocked)]))

      setRestEncounter(generatedEncounter)
      seenInPokedex(generatedEncounter)
      setRestRewardItem(rewardItem)
      setInventory((previous) => [...previous, rewardItem])
      setBattleLog((prev) => [
        t('rest.found', { label: currentNode.label, name: generatedEncounter.name, item: rewardItem }),
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

      if (currentNode.type === 'rival') {
        // Rival recurrente: escala contigo y da más dinero que el resto.
        const teamSize = trainerTeamSize(routeIndex, route.length, difficulty)
        const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))
        const fetches = Array.from({ length: teamSize }, (_, idx) => {
          const targetLevel = difficulty === 'infinite'
            ? getInfiniteTargetLevel() + trainerMemberLevelOffset(idx, teamSize, true, difficulty)
            : avgPlayerLevel + trainerMemberLevelOffset(idx, teamSize, true, difficulty)
          const baseStepIndex = difficulty === 'infinite' ? Math.max(0, targetLevel - 10) : routeIndex
          return getBalancedPokemonByGeneration(targetGen, baseStepIndex, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length, targetLevel)
            .then((base) => {
              const levelDiff = targetLevel - base.level
              let scaled = scalePokemonForNode(base, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff + extraEnemyLevels, difficulty)
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
          return getBalancedPokemonByGeneration(targetGen, baseStepIndex, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length, targetLevel)
            .then((base) => {
              const levelDiff = targetLevel - base.level
              let scaled = scalePokemonForNode(base, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff + extraEnemyLevels , difficulty)
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
        const willBeTrainer = isBoss || Math.random() < 0.5

      if (willBeTrainer) {
        const isLeague = currentNode.id >= 1000
        // En Fácil, los jefes de las etapas 1 y 2 llevan la mitad de Pokémon (3);
        // el jefe de la última etapa (3ª insignia) conserva los 6.
        const maxSize = isBoss ? ((difficulty === 'easy' && !isLeague && badges.length < 2) ? 3 : 6) : trainerMaxSize(routeIndex, route.length, difficulty)
        const teamSize = isBoss ? maxSize : Math.max(1, Math.min(maxSize, 1 + Math.floor(Math.random() * maxSize)))
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
                return getBalancedPokemonByGeneration(targetGen, baseStepIndex, route.length, isBoss, runChallenges.allShiny, difficulty, isBoss ? badges.length : -1, badges.length, targetLevel)
                  .then((base) => {
                    const levelDiff = targetLevel - base.level
                    let scaled = scalePokemonForNode(base, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff + extraEnemyLevels , difficulty)
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
          chosenName = `${trainer.label} ${trainer.name}`
          chosenSprite = trainer.sprite
          chosenBadge = ''
        }

        setIsTrainerBattle(true)
        const megaTeam = newTrainerTeam.map(p => {
          if (isBoss && (difficulty === 'hard' || difficulty === 'infinite') && Math.random() < 0.15 && MEGA_CAPABLE_IDS.has(p.id)) {
            const formId = MEGA_FORM_IDS[p.id]
            if (formId) {
              const megaFormId = Array.isArray(formId) ? formId[Math.floor(Math.random() * formId.length)] : formId
              const megaSprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${megaFormId}.png`
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
        setTrainerTeam(megaTeam.map(p => ({ ...p, statStages: p.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } })))
        newTrainerTeam.forEach(p => seenInPokedex(p))
        setTrainerPokemonIndex(0)
        setTrainerName(chosenName)
        setTrainerSprite(chosenSprite)
        setTrainerBadge(chosenBadge)
        // Primer combate de la run: se suaviza al rival para que no pueda
        // debilitar al starter de un golpe y el jugador pueda empezar a actuar.
        let firstEnemy: Pokemon = { ...megaTeam[0], statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } }
        if (routeIndex === 0 && !isBoss) {
          firstEnemy = { ...softenFirstBattleEnemy(firstEnemy, team), statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 } }
        }
        setEnemy(firstEnemy)
        setBattleLog((prev) => [
          isBoss
            ? t('b.leaderChallenge', { name: chosenName, badge: chosenBadge })
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
        const enemyBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length, targetLevel)
        const levelDiff = targetLevel - enemyBase.level
        let generatedEnemy = scalePokemonForNode(enemyBase, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff + extraEnemyLevels , difficulty)
        generatedEnemy = balanceWildPokemonToTeam(generatedEnemy, team, difficulty)
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
        if (orig) return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, leechSeed: false, disabled: undefined, lastMove: undefined, justEntered: entered, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, furiaActive: false }
        return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, leechSeed: false, disabled: undefined, lastMove: undefined, justEntered: entered, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, furiaActive: false }
      }))
      setBattleMegaUsed(false)
      setBattleGmaxUsed(false)
      setBattlePrimalUsed(false)
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

  function spinRoulette(): void {
    if (spinAnimating || spinRevealed) return
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
    if (team.length >= maxTeamSize) {
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
    completeCurrentNode()
    setScreen('route')
  }

  function skipPokeRandPokemon(): void {
    setBattleLog((prev) => [
      t('pokerand.logSkip'),
      ...prev
    ].slice(0, 15))
    completeCurrentNode()
    setScreen('route')
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
    const basicItems = ['Poké Ball', 'Potion', ...BERRY_DROPS.filter(isConsumableUnlocked)].filter(i => unlockedItems.includes(i))
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
    const discount = modifier?.shopDiscount ?? 0
    const hardMarkup = (difficulty === 'hard' || difficulty === 'infinite') ? 1.4 : 1
    const stageMarkup = 1 + badges.length * 0.15
    const finalPrice = Math.floor(item.price * (1 - discount) * hardMarkup * stageMarkup)
    const total = finalPrice * qty
    if (money < total) return

    setMoney((prev) => prev - total)
    setInventory((prev) => [...prev, ...Array(qty).fill(itemName)])
    setRunStats(prev => ({ ...prev, moneySpent: prev.moneySpent + total }))
    setBattleLog((prev) => [t('b.bought', { qty, item: itemName, total }), ...prev].slice(0, 15))
    setShopQty(prev => ({ ...prev, [itemName]: 1 }))
  }

  function buyHoldableItem(itemName: string) {
    if (runChallenges.noPurchasing) {
      setBattleLog((prev) => [t('b.challengeNoBuying'), ...prev].slice(0, 15))
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
    if (money < finalPrice) return

    setMoney((prev) => prev - finalPrice)
    setInventory((prev) => [...prev, itemName])
    setRunStats(prev => ({ ...prev, moneySpent: prev.moneySpent + finalPrice }))
    setBattleLog((prev) => [t('b.bought', { qty: 1, item: itemName, total: finalPrice }), ...prev].slice(0, 15))
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
    setBattleLog((prev) => [t('b.sold', { qty, item: itemName, total }), ...prev].slice(0, 15))
    setSellQty(prev => ({ ...prev, [itemName]: 1 }))
  }

  function equipItem(itemName: string, pokemonIndex: number) {
    const pokemon = team[pokemonIndex]
    if (!pokemon || pokemon.hp <= 0) return
    if (!HOLDABLE_ITEMS[itemName]) return

    const itemIdx = inventory.indexOf(itemName)
    if (itemIdx === -1) return

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
    setBattleLog((prev) => [t('b.equipped', { item: itemName, name: pokemon.name }), ...prev].slice(0, 15))

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
    setBattleLog((prev) => [t('b.unequipped', { item: itemName, name: pokemon.name }), ...prev].slice(0, 15))
  }

  function processStatusTick(p: Pokemon): { updatedPokemon: Pokemon; skipTurn: boolean; log: string[] } {
    if (!p.status) return { updatedPokemon: p, skipTurn: false, log: [] }

    const logs: string[] = []
    let updated = { ...p }
    let skipTurn = false

    switch (p.status.type) {
      case 'burn': {
        const burnDmg = Math.max(1, Math.floor(p.maxHp / 16))
        updated = { ...updated, hp: Math.max(0, updated.hp - burnDmg) }
        logs.push(t('b.burn', { name: updated.name, dmg: burnDmg }))
        break
      }
      case 'poison': {
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
        const remaining = (p.status.turns ?? 2) - 1
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

  function performHit(
    attacker: Pokemon,
    defender: Pokemon,
    move: Move,
    isEnemyHit: boolean
  ): { updatedDefender: Pokemon; updatedAttacker: Pokemon; lines: string[]; attackerHeal: number; crits: number; superEffective: boolean } {
    // El defensor está protegido (Protección/Protect): se bloquea el ataque.
    if (defender.protected) {
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

    const attackerItem = attacker.holdItem ? HOLDABLE_ITEMS[attacker.holdItem] : null
    const defenderItem = defender.holdItem ? HOLDABLE_ITEMS[defender.holdItem] : null

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

    const effectiveAttacker: Pokemon = {
      ...attacker,
      attack: Math.round(attacker.attack * (1 + (attackerItem?.attackMod ?? 0) + playerAtkMod) * burnNerf * atkStageMult),
      spAttack: Math.round(attacker.spAttack * (1 + (attackerItem?.spAttackMod ?? 0) + playerAtkMod) * spaStageMult),
      speed: Math.round(attacker.speed * (1 + (attackerItem?.speedMod ?? 0) + playerSpdMod) * paralysisSpdNerf * spdStageMult + enemySpdDelta)
    }
    const effectiveDefender: Pokemon = {
      ...defender,
      defense: Math.round(defender.defense * (1 + (defenderItem?.defenseMod ?? 0) + playerDefMod) * defStageMult + enemyDefDelta),
      spDefense: Math.round(defender.spDefense * (1 + (defenderItem?.spDefenseMod ?? 0) + playerDefMod) * spDefStageMult + enemyDefDelta)
    }

    const effectiveMove = runChallenges.typeRandomizer
      ? { ...move, type: randomFrom(ALL_TYPES) }
      : move

    const defTypes = (effectiveDefender as any).types ?? []
    const primaryType = defTypes[0] || 'normal'
    const secondaryType = defTypes[1] || undefined

    const { effectiveness, message } = getTypeEffectiveness(effectiveMove.type, primaryType, secondaryType)

    // --- STAB (Same-Type Attack Bonus) ---
    const attackerTypes: string[] = (attacker as any).types ?? []
    const stabBonus = attackerTypes.some(t => t === effectiveMove.type) ? 1.5 : 1

    // --- Accuracy check ---
    if (move.accuracy !== null && move.accuracy < 100) {
      const accRoll = Math.random() * 100
      if (accRoll >= move.accuracy) {
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
    }

    let currentDefender = effectiveDefender
    const lines: string[] = []
    let totalDamage = 0
    let totalCrits = 0

    const isDamagingMove = (effectiveMove.power ?? 0) > 0
    if (isDamagingMove) {
    for (let hit = 0; hit < totalHits; hit++) {
      const result = applyDamage(effectiveAttacker, currentDefender, effectiveMove, enemyBoost)
      let finalDamage = Math.floor(result.damage * effectiveness * stabBonus)
      if (attackerItem?.damageBoost) {
        finalDamage = Math.floor(finalDamage * (1 + attackerItem.damageBoost))
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

      // --- Crit: base from items/modifiers + move crit stage ---
      const modCrit = !isEnemyHit ? (modifier?.playerCritChance ?? 0) : 0
      const moveCritStage = move.critRatio ?? 0
      const moveCritChance = moveCritStage >= 3 ? 0.5 : moveCritStage === 2 ? 0.25 : moveCritStage === 1 ? 0.125 : 0
      const totalCrit = (attackerItem?.critChance ?? 0) + modCrit + moveCritChance
      const isCrit = !runChallenges.noCrits && totalCrit > 0 && Math.random() < totalCrit
      if (isCrit) {
        finalDamage = Math.floor(finalDamage * 1.5)
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
      lines.push(hitLine)

      if (currentDefender.hp <= 0) break
    }
    } else {
      // Movimiento de estado: no hace daño, solo puede aplicar su efecto.
      lines.push(t('b.statusMove', { attacker: attacker.name, move: moveName(effectiveMove) }))
    }

    // --- Ailment application on first hit only ---
    if (totalHits > 0 && currentDefender.hp > 0) {
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
          const change = Number.isFinite(sc.change) ? sc.change : 0
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
          const change = Number.isFinite(sc.change) ? sc.change : 0
          const oldStage = newStages[stageKey] ?? 0
          const newStage = Math.max(-6, Math.min(6, oldStage + change))
          if (newStage !== oldStage) {
            newStages = { ...newStages, [stageKey]: newStage }
            currentDefender = { ...currentDefender, statStages: newStages }
            const direction = change > 0 ? 'subió' : 'bajó'
            const statName = sc.stat === 'attack' ? 'Ataque' : sc.stat === 'defense' ? 'Defensa' : sc.stat === 'special-attack' ? 'At. Esp.' : sc.stat === 'special-defense' ? 'Def. Esp.' : 'Velocidad'
            lines.push(direction === 'subió' ? t('b.statUp', { name: currentDefender.name, stat: statName, old: `${oldStage > 0 ? '+' : ''}${oldStage}`, new: `${newStage > 0 ? '+' : ''}${newStage}` }) : t('b.statDown', { name: currentDefender.name, stat: statName, old: `${oldStage > 0 ? '+' : ''}${oldStage}`, new: `${newStage > 0 ? '+' : ''}${newStage}` }))
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
    let updatedAttacker = hasAttackerStageChange
      ? { ...attacker, statStages: attackerStages, furiaActive, protected: protectUsed, lastMove: effectiveMove.name, justEntered: false }
      : { ...attacker, furiaActive, protected: protectUsed, lastMove: effectiveMove.name, justEntered: false }
    if (move.recoilPercent && move.recoilPercent > 0 && totalDamage > 0) {
      recoilDamage = Math.floor(totalDamage * move.recoilPercent)
      updatedAttacker = { ...updatedAttacker, hp: Math.max(1, updatedAttacker.hp - recoilDamage) }
      lines.push(t('b.recoil', { name: attacker.name, dmg: recoilDamage }))
    }

    // --- Drain (Absorb, Megaagotar, etc.) ---
    if (move.drainPercent && move.drainPercent > 0 && totalDamage > 0 && updatedAttacker.hp > 0) {
      const drainHeal = Math.floor(totalDamage * move.drainPercent)
      updatedAttacker = { ...updatedAttacker, hp: Math.min(updatedAttacker.maxHp, updatedAttacker.hp + drainHeal) }
      lines.push(t('b.drained', { name: attacker.name, hp: drainHeal }))
    }

    // --- Lifesteal ---
    const modLifesteal = !isEnemyHit ? (modifier?.playerLifesteal ?? 0) : 0
    const totalLifesteal = (attackerItem?.lifesteal ?? 0) + modLifesteal
    let attackerHeal = 0
    if (totalLifesteal > 0 && totalDamage > 0) {
      attackerHeal = Math.floor(totalDamage * totalLifesteal)
    }

    return {
      updatedDefender: { ...currentDefender, defense: defender.defense },
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

    // Auto-evolución al alcanzar el nivel de evolución
    if (!runChallenges.noEvolution && updatedPokemon.evolutionLevel && updatedPokemon.level >= updatedPokemon.evolutionLevel) {
      // Si el Pokémon evoluciona con objeto (p. ej. Clamperl → Huntail con
      // Deep Sea Tooth o → Gorebyss con Deep Sea Scale), se elige la rama
      // según el objeto equipado. Sin objeto, no evoluciona por esta vía.
      const itemEvolutions = updatedPokemon.heldItemEvolutions ?? []
      const hasItemEvolutions = itemEvolutions.length > 0
      const matched = hasItemEvolutions
        ? itemEvolutions.find(e => e.item === updatedPokemon.holdItem)
        : null
      const itemOk = !hasItemEvolutions || !!matched
      if (itemOk) {
        try {
          // El objeto que el Pokémon necesita para evolucionar a su forma
          // especial (p. ej. Gorra de Ash para Greninja-Ash). Solo se
          // consume si esta evolución es exactamente la del objeto.
          const requiredItem = matched ? matched.item : undefined
          const targetName = matched ? matched.target : undefined
          const evolved = await evolvePokemon(updatedPokemon, targetName)
          if (evolved) {
            const consumedItem = updatedPokemon.holdItem
            const { updatedPokemon: finalEvolved } = await checkAndLearnNewMove(evolved, oldLevel, updatedPokemon.level, difficulty)
            registerInPokedex(finalEvolved)
            playEvolution()
            setEvoPopup({ oldSprite: updatedPokemon.sprite, newSprite: finalEvolved.sprite, oldName: updatedPokemon.name, newName: finalEvolved.name })
            setTimeout(() => setEvoPopup(null), 2000)
            updatedPokemon = finalEvolved
            if (consumedItem && requiredItem && consumedItem === requiredItem) {
              updatedPokemon = { ...updatedPokemon, holdItem: undefined }
              logs.push(t('b.itemConsumedEvo', { item: consumedItem }))
            }
            setRunStats(prev => ({ ...prev, evolutions: prev.evolutions + 1 }))
            logs.push(t('b.evolved', { name: updatedPokemon.name, evolved: finalEvolved.name }))
          }
        } catch {}
      }
    }

    return updatedPokemon
  }

  async function onPlayerMove(move: Move): Promise<void> {
    if (!activePokemon || !enemy) return

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

    setBattleTurns(t => t + 1)

    if (runChallenges.speedrun && speedrunSeconds <= 0) {
      setBattleLog((prev) => [t('b.timeUp'), ...prev].slice(0, 15))
      return
    }

    const nextTeam = team.map((pokemon, index) => (index === activeIndex ? { ...pokemon } : pokemon))
    let nextPlayer = { ...nextTeam[activeIndex] }
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
    const playerPriority = move.priority ?? 0
    const enemyMoveForPriority = nextEnemy.moves[Math.floor(Math.random() * nextEnemy.moves.length)]
    const enemyPriority = enemyMoveForPriority.priority ?? 0

    let playerStarts: boolean
    if (playerPriority !== enemyPriority) {
      playerStarts = playerPriority > enemyPriority
    } else {
      const pStages = nextPlayer.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
      const eStages = nextEnemy.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
      const pSpdStage = getStageMultiplier(pStages.speed)
      const eSpdStage = getStageMultiplier(eStages.speed)
      const playerEffectiveSpeed = Math.round(nextPlayer.speed * (1 + (playerItem?.speedMod ?? 0)) * playerParalysisNerf * pSpdStage)
      const enemyEffectiveSpeed = Math.round(nextEnemy.speed * (1 + (enemyItem?.speedMod ?? 0)) * enemyParalysisNerf * eSpdStage)
      playerStarts = playerEffectiveSpeed >= enemyEffectiveSpeed
    }

    let playerCrits = 0
    const doPlayerAttack = async () => {
      if (nextPlayer.hp <= 0 || nextEnemy.hp <= 0 || playerSkipped || playerConfusedSelfHit) return
      if (move.name !== 'Furia') nextPlayer = { ...nextPlayer, furiaActive: false }
      const playerHit = performHit(nextPlayer, nextEnemy, move, false)
      const prevEnemyHp = nextEnemy.hp
      nextEnemy = playerHit.updatedDefender
      nextPlayer = playerHit.updatedAttacker
      if (nextEnemy.hp < prevEnemyHp) {
        setEnemyHitFlash(true)
        playHit()
        setTimeout(() => setEnemyHitFlash(false), 400)
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
      let enemyMove = enemyMoveForPriority
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
      const enemyHit = performHit(nextEnemy, nextPlayer, enemyMove, true)
      nextPlayer = enemyHit.updatedDefender
      nextEnemy = enemyHit.updatedAttacker
      if (enemyHit.attackerHeal > 0) {
        const healed = Math.min(nextEnemy.maxHp, nextEnemy.hp + enemyHit.attackerHeal)
        nextEnemy = { ...nextEnemy, hp: healed }
        logs.push(t('b.vampirism', { name: nextEnemy.name, hp: enemyHit.attackerHeal }))
      }
      logs.push(...enemyHit.lines)
    }

    if (playerStarts) {
      await doPlayerAttack()
      await doEnemyAttack()
    } else {
      await doEnemyAttack()
      await doPlayerAttack()
    }

    // --- Efectos pasivos por turno ---
    const modHealBonus = modifier?.healBonus ?? 0
    const modHealReduction = modifier?.healReduction ?? 0
    const applyTurnEffects = (p: Pokemon): Pokemon => {
      const item = p.holdItem ? HOLDABLE_ITEMS[p.holdItem] : null
      if (!item) return p
      let updated = { ...p }
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
      // Logros de remontada: se comprueban en la victoria (antes de la curación
      // automática por subir de nivel). Para entrenadores, solo cuando es la
      // victoria final de todo el equipo rival.
      const isFullWin = !isTrainerBattle || (() => {
        const updatedTrainerTeam = trainerTeam.map((p, idx) => idx === trainerPokemonIndex ? nextEnemy : p)
        return updatedTrainerTeam.findIndex((p, idx) => idx > trainerPokemonIndex && p.hp > 0) === -1
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
        const nextTrainerIndex = updatedTrainerTeam.findIndex((p, idx) => idx > trainerPokemonIndex && p.hp > 0)

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
            if (!alreadyHas) {
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
        setTrainerTeam(updatedTrainerTeam)
        setTrainerPokemonIndex(nextTrainerIndex)
        setEnemy({ ...nextPkmn, statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }, justEntered: true })
        setTeam(newTeam)
        setBattleLog((prev) => [
          t('b.enemySendsOut', { trainer: trainerName, name: nextPkmn.name, lvl: nextPkmn.level }),
          logMsg,
          ...logs,
          ...prev
        ].slice(0, 15))
        return
      }

      // --- G-MAX miniboss reward ---
      if (currentNode.type === 'gmax') {
        const alreadyHas = inventory.includes('Dynamax Band') || team.some(p => p.holdItem === 'Dynamax Band')
        if (!alreadyHas) {
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
        const fresh = await buildPokemonFromApi(enemy.id, getEffectiveGen(), enemy.level, enemy.shiny ?? false, difficulty)
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
      setInventory(prev => prev.filter((_, i) => i !== ballIdx))
      const capturedPkmn = await buildCleanCaptured()
      registerInPokedex(capturedPkmn)
      setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
      if (capturedPkmn.shiny) unlockAchievement('shiny_catch')
      const bst = capturedPkmn.attack + capturedPkmn.defense + capturedPkmn.speed + capturedPkmn.maxHp
      if (bst >= 600) unlockAchievement('legendary_catch')
      setBattleLog(prev => [`🏆 ¡${capturedPkmn.name} fue capturado con ${ballName}!`, ...prev].slice(0, 15))
      if (team.length >= maxTeamSize) {
        setPcStorage(prev => [...prev, capturedPkmn])
        setBattleLog(prev => [`📦 ${capturedPkmn.name} fue enviado al PC (equipo lleno).`, ...prev].slice(0, 15))
      } else {
        setTeam(prev => [...prev, capturedPkmn])
      }
      completeCurrentNode()
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
    const catchProbability = Math.min(hpFactor * ballRate * statusMult * speciesRate, 1)

    // Consumir la ball
    setInventory(prev => prev.filter((_, i) => i !== ballIdx))

    if (Math.random() < catchProbability) {
      // Captura exitosa
      const capturedPkmn = await buildCleanCaptured()
      registerInPokedex(capturedPkmn)
      setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
      if (capturedPkmn.shiny) unlockAchievement('shiny_catch')
      const bst = capturedPkmn.attack + capturedPkmn.defense + capturedPkmn.speed + capturedPkmn.maxHp
      if (bst >= 600) unlockAchievement('legendary_catch')
      setBattleLog(prev => [`🏆 ¡${capturedPkmn.name} fue capturado con ${ballName}! (${Math.round(catchProbability * 100)}%)`, ...prev].slice(0, 15))
      if (team.length >= maxTeamSize) {
        setPcStorage(prev => [...prev, capturedPkmn])
        setBattleLog(prev => [`📦 ${capturedPkmn.name} fue enviado al PC (equipo lleno).`, ...prev].slice(0, 15))
      } else {
        setTeam(prev => [...prev, capturedPkmn])
      }
      completeCurrentNode()
    } else {
      // Falló
      setBattleLog(prev => [t('b.escapedBall', { name: enemy.name, ball: ballName, pct: Math.round(catchProbability * 100) }), ...prev].slice(0, 15))
      setCaptureMessage(`¡${enemy.name} escapó!`)
      setTimeout(() => setCaptureMessage(null), 2000)
    }
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

  function megaEvolveActive(): void {
    if (!activePokemon || activePokemon.holdItem !== 'Mega Stone' || battleMegaUsed || activePokemon.gmaxEvolved || !MEGA_CAPABLE_IDS.has(activePokemon.id)) return
    const formId = MEGA_FORM_IDS[activePokemon.id]
    const megaFormId = Array.isArray(formId) ? formId[Math.floor(Math.random() * formId.length)] : formId
    const megaSprite = megaFormId
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${megaFormId}.png`
      : null
    setTeam(prev => prev.map((p, i) => i === activeIndex ? {
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
      registerInPokedex({ ...activePokemon, id: megaFormId, sprite: megaSprite ?? activePokemon.sprite })
    }
    setBattleMegaUsed(true)
    setMetaProgression(prev => {
      const totalMegas = prev.totalMegas + 1
      const updated = { ...prev, totalMegas }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
    unlockAchievement('first_mega')
    setBattleLog(prev => [t('b.megaEvolved', { name: activePokemon.name }), ...prev].slice(0, 15))
  }

  function gmaxEvolveActive(): void {
    if (!activePokemon || activePokemon.holdItem !== 'Dynamax Band' || battleGmaxUsed || activePokemon.gmaxEvolved || !GMAX_CAPABLE_IDS.has(activePokemon.id)) return
    const formId = GMAX_FORM_IDS[activePokemon.id]
    const gmaxFormId = Array.isArray(formId) ? formId[Math.floor(Math.random() * formId.length)] : formId
    const gmaxSprite = gmaxFormId
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${gmaxFormId}.png`
      : null
    setTeam(prev => prev.map((p, i) => i === activeIndex ? {
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
      registerInPokedex({ ...activePokemon, id: gmaxFormId, sprite: gmaxSprite ?? activePokemon.sprite })
    }
    setBattleGmaxUsed(true)
    setMetaProgression(prev => {
      const totalGmax = prev.totalGmax + 1
      const updated = { ...prev, totalGmax }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
    unlockAchievement('first_gmax')
    setBattleLog(prev => [t('b.gmaxEvolved', { name: activePokemon.name }), ...prev].slice(0, 15))
  }

  function primalEvolveActive(): void {
    if (!activePokemon || !activePokemon.holdItem || (activePokemon.holdItem !== 'Prisma Rojo' && activePokemon.holdItem !== 'Prisma Azul')) return
    if (battlePrimalUsed || activePokemon.megaEvolved || activePokemon.gmaxEvolved || !PRIMAL_CAPABLE_IDS.has(activePokemon.id)) return
    const formId = PRIMAL_FORM_IDS[activePokemon.id]
    const primalSprite = formId
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${formId}.png`
      : null
    setTeam(prev => prev.map((p, i) => i === activeIndex ? {
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
      registerInPokedex({ ...activePokemon, id: formId, sprite: primalSprite ?? activePokemon.sprite })
    }
    setBattlePrimalUsed(true)
    setBattleLog(prev => [t('b.primalEvolved', { name: activePokemon.name }), ...prev].slice(0, 15))
  }

  function switchActive(index: number): void {
    const target = team[index]
    if (!target || target.hp <= 0 || index === activeIndex) return
    const orig = team[activeIndex]?.megaOrig
    setTeam(prev => prev.map((p, i) => {
      // Al cambiar de Pokémon se pierden Drenadoras y Anulación (como en los juegos reales),
      // y el que entra cuenta como "recién llegado" para Sorpresa/Abatimiento.
      if (i === activeIndex && orig) return { ...p, megaEvolved: false, gmaxEvolved: false, primalEvolved: false, gmaxTurnsLeft: undefined, megaOrig: undefined, leechSeed: false, disabled: undefined, lastMove: undefined, justEntered: false, ...orig }
      if (i === activeIndex) return { ...p, leechSeed: false, disabled: undefined, lastMove: undefined, justEntered: false }
      if (i === index) return { ...p, justEntered: true }
      return p
    }))
    setActiveIndex(index)
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
      const newBase = await buildPokemonFromApi(evolvedName, 1, targetPokemon.level, targetPokemon.shiny ?? false)
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
      setTimeout(() => setEvoPopup(null), 2000)
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

    if (EVOLUTION_STONE_UNLOCK_IDS[itemName] || itemName === 'Gorra de Ash' || itemName === 'Auspicious Armor' || itemName === 'Malicious Armor') {
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
      setTeam(prev => prev.map(p => p.hp <= 0 ? { ...p, hp: p.maxHp } : p))
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
    } else if (itemName === 'X Attack') {
      updatedPokemon = { ...activePokemon, attack: activePokemon.attack + 5 }
    } else if (itemName === 'X Defense') {
      updatedPokemon = { ...activePokemon, defense: activePokemon.defense + 5 }
    } else if (itemName === 'X Speed') {
      updatedPokemon = { ...activePokemon, speed: activePokemon.speed + 5 }
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
    } else if (itemName === 'X Attack 2') {
      updatedPokemon = { ...activePokemon, attack: activePokemon.attack + 10 }
    } else if (itemName === 'X Defense 2') {
      updatedPokemon = { ...activePokemon, defense: activePokemon.defense + 10 }
    } else if (itemName === 'X Speed 2') {
      updatedPokemon = { ...activePokemon, speed: activePokemon.speed + 10 }
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
    setBattleLog((prev) => [t('b.usedItem', { item: itemName, name: activePokemon.name }), ...prev].slice(0, 15))
  }

  function applyRevive(targetIndex: number): void {
    if (!reviveModal) return
    const { itemName, itemIndex } = reviveModal
    const target = team[targetIndex]
    if (!target || target.hp > 0) return

    const restoredHp = itemName === 'Max Revive' ? target.maxHp : Math.floor(target.maxHp * 0.5)
    const revivedPkmn: Pokemon = { ...target, hp: restoredHp }

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
    if (team.length >= maxTeamSize) {
      setPcStorage((prev) => [...prev, captured])
      setBattleLog((prev) => [t('b.capturedPC', { name: captured.name }), ...prev].slice(0, 15))
    } else {
      setTeam((previous) => [...previous, captured])
      setBattleLog((prev) => [t('b.captured', { name: captured.name }), ...prev].slice(0, 15))
    }
    completeCurrentNode()
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
    if (team.length >= maxTeamSize) {
      setPcStorage((prev) => [...prev, captured])
      setBattleLog((prev) => [t('b.capturedLegendPC', { name: captured.name }), ...prev].slice(0, 15))
    } else {
      setTeam((previous) => [...previous, captured])
      setBattleLog((prev) => [t('b.capturedLegend', { name: captured.name }), ...prev].slice(0, 15))
    }
    setLegendaryEncounter(null)
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
    setInventory([])
    setMoney(100)
    setShopStock([])
    setModifier(null)
    setModifier2(null)
    setBattleLog([])
    setApiError('')
    setRestEncounter(null)
    setRestRewardItem('')
    setLegendaryEncounter(null)
    setDefeatSummary(null)
    setVictoryUnlocks(null)
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
    if (screen === 'route' || screen === 'battle' || screen === 'shop' || screen === 'spin' || screen === 'pokeRand' || screen === 'move' || screen === 'mega' || screen === 'gmax' || screen === 'primal' || screen === 'trade' || screen === 'blackmarket' || screen === 'double' || screen === 'casino') {
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
      screen === 'primal' || screen === 'trade' || screen === 'blackmarket' || screen === 'double' ||
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
  const pokedexSeen = pokedexList.filter(p => p.seen).length
    const pokedexCaught = pokedexList.filter(p => p.caught).length

  const leaderboardActiveEntries: LeaderboardEntry[] = leaderboardGen === 0
    ? Object.values(leaderboardByGen).flat().sort((a, b) => (b.node - a.node) || (a.duration_seconds - b.duration_seconds))
    : (leaderboardByGen[leaderboardGen] ?? [])
  const filteredPokedex = pokedexList.filter((pkmn) => {
    const term = pokedexSearch.toLowerCase().trim()
    if (!term) return true
    const formattedId = `#${String(pkmn.id).padStart(3, '0')}`
    return pkmn.name.toLowerCase().includes(term) || String(pkmn.id).includes(term) || formattedId.includes(term)
  })

  const startMoneyBonus = ((metaProgression.permanentlyUnlockedItems.includes('start_money_1') ? 1 : 0) +
    (metaProgression.permanentlyUnlockedItems.includes('start_money_2') ? 1 : 0)) * 100

  const toggleMusicMuted = (): void => {
    playClick()
    const next = !musicMuted
    setMusicMuted(next)
    setMusicMutedState(next)
  }

  return (
    <main className="app-shell">
      <BackgroundLayer backgroundId={metaProgression.activeBackground} />
      <button
        type="button"
        onClick={() => { playClick(); setShowHelpModal(true) }}
        title={t('help.title')}
        style={{
          position: 'fixed', bottom: '6px', right: '10px', zIndex: 5,
          background: 'transparent', border: 'none', color: 'rgba(155,152,207,0.5)',
          fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit', opacity: 0.6,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6' }}
      >
        {t('help.version')}
      </button>
      <header className="topbar">
        <TopbarCanvas />
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
          {metaProgression.permanentlyUnlockedItems.includes('unlock_casino_node') && (
            <button className="tiny-btn" type="button" onClick={() => { playClick(); setShowMinigamePractice(true) }}>
              🎮 {t('topbar.minigames')}
            </button>
          )}
          <button className="tiny-btn" type="button" onClick={() => { playClick(); if (screen === 'setup') { onRestartRun() } else { setShowRestartConfirm(true) } }}>
            {t('topbar.restart')}
          </button>
          {!coopMode && (screen === 'route' || screen === 'battle' || screen === 'shop' || screen === 'spin' || screen === 'pokeRand' || screen === 'move' || screen === 'mega' || screen === 'gmax' || screen === 'primal' || screen === 'trade' || screen === 'blackmarket' || screen === 'double' || screen === 'casino') && (
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
        <h1>PokeRand</h1>
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
          <span style={{ color: '#10b981', fontWeight: 'bold' }}>W {record.wins}</span>
          <span style={{ color: '#ee3b2f', fontWeight: 'bold' }}>L {record.losses}</span>
        </div>
      </header>

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
                <h3 style={{ margin: 0, color: '#ffcb05', fontSize: '1.1rem' }}>{reviveModal.itemName}</h3>
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
                <h3 style={{ margin: 0, color: '#cba3ff', fontSize: '1.1rem' }}>{equipModal.itemName}</h3>
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
                const canUseTransform = isGmaxEquip ? GMAX_CAPABLE_IDS.has(pkmn.id) : isMegaEquip ? MEGA_CAPABLE_IDS.has(pkmn.id) : isPrimalEquip ? PRIMAL_CAPABLE_IDS.has(pkmn.id) : false
                const highlightGreen = canEquip && (isGmaxEquip || isMegaEquip || isPrimalEquip) && canUseTransform
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
                        {pkmn.holdItem && <span style={{ fontSize: '0.7rem', color: '#b8a1ff', marginLeft: '6px' }}>({pkmn.holdItem})</span>}
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
                const isUnlocked = b.name === 'Poké Ball' || !unlockId || metaProgression.permanentlyUnlockedItems.includes(unlockId)
                if (count <= 0) return null
                if (!isUnlocked) return null
                const ballRate = getPokeBallRate(b.name, enemy, battleTurns, !!pokedex[enemy.id]?.caught, activePokemon?.level ?? 50)
                const hpFactor = Math.max(0.05, (3 * enemy.maxHp - 2 * enemy.hp) / (3 * enemy.maxHp))
                const statusMult = enemy.status ? (enemy.status.type === 'sleep' || enemy.status.type === 'freeze' ? 2.5 : 1.5) : 1
                const speciesRate = (enemy.captureRate ?? 45) / 255
                const chance = b.isMaster ? 100 : Math.min(Math.round(hpFactor * ballRate * statusMult * speciesRate * 100), 100)
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
        <div className="modal-backdrop" onClick={() => { setShowPokedex(false); setSelectedPokemonDetail(null); setPokedexSearch(''); }}>
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
                      src={selectedPokemonDetail.highResImage}
                      alt={selectedPokemonDetail.name}
                    />
                    <div className="detail-title">
                      <span className="pokedex-id">#{String(selectedPokemonDetail.id).padStart(3, '0')}</span>
                      <h2 style={{ textTransform: 'capitalize', margin: '4px 0 8px 0', color: '#4d9bff' }}>
                        {selectedPokemonDetail.name}
                      </h2>
                      <div className="types-list" style={{ display: 'flex', gap: '4px' }}>
                        {selectedPokemonDetail.types.map((t) => (
                          <span key={t} className="type-badge">{t}</span>
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
                        {selectedPokemonDetail.evolutions.map((evo, idx) => {
                          const entry = pokedex[evo.id]
                          const known = !!entry?.caught
                          return (
                            <div key={evo.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {idx > 0 && <span style={{ color: '#7d7ab5', fontSize: '1.2rem' }}>→</span>}
                              <div
                                className="pokedex-card"
                                style={{
                                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                                  padding: '6px', borderRadius: '8px', background: 'rgba(15,23,42,0.6)',
                                  border: evo.id === selectedPokemonDetail.id ? '2px solid #4d9bff' : '1px solid #3f3f6e',
                                  minWidth: '80px', opacity: known ? 1 : 0.5, cursor: known ? 'pointer' : 'default'
                                }}
                                onClick={() => known && handleSelectPokedexPokemon(evo.id)}
                              >
                                <img
                                  src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${evo.id}.gif`}
                                  alt={evo.name}
                                  onError={(e) => { (e.target as HTMLImageElement).src = evo.sprite }}
                                  style={{ width: '56px', height: '56px', imageRendering: 'pixelated', filter: known ? 'none' : 'brightness(0) invert(0)' }}
                                />
                                <strong style={{ textTransform: 'capitalize', fontSize: '0.75rem', color: evo.id === selectedPokemonDetail.id ? '#4d9bff' : '#f3f1ff', textAlign: 'center' }}>
                                  {known ? evo.name : '???'}
                                </strong>
                                {evo.level && (
                                  <span style={{ fontSize: '0.85rem', color: '#a855f7', fontWeight: 'bold' }}>{t('pokedex.lv')} {evo.level}</span>
                                )}
                                {!evo.level && evo.trigger && evo.trigger !== 'level-up' && (
                                  <span style={{ fontSize: '0.85rem', color: '#ffcb05', fontWeight: 'bold' }}>{t(`evo.trigger.${evo.trigger}`)}</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ fontSize: '0.65rem', color: '#4d9bff', margin: 0 }}>
                        Pokédex ({pokedexSeen} {t('pokedex.seen2b')} · {pokedexCaught} {t('pokedex.caught2b')})
                      </h2>
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
                  ) : pokedexList.length === 0 ? (
                    <p className="muted" style={{ padding: '1rem 0', textAlign: 'center' }}>
                      {t('pokedex.empty2')}
                    </p>
                  ) : filteredPokedex.length === 0 ? (
                    <p className="muted" style={{ padding: '2rem 0', textAlign: 'center' }}>
                      No se encontraron Pokémon que coincidan con "{pokedexSearch}".
                    </p>
                  ) : (
                    <div className="pokedex-grid">
                      {filteredPokedex.sort((a, b) => a.id - b.id).map((pkmn) => (
                        <div
                          key={pkmn.id}
                          className="pokedex-card clickable"
                          onClick={() => pkmn.caught ? handleSelectPokedexPokemon(pkmn.id) : undefined}
                          style={!pkmn.caught ? { opacity: 0.6 } : undefined}
                        >
                          <span className="pokedex-id">#{String(pkmn.id).padStart(3, '0')}</span>
                          <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pkmn.id}.gif`} alt={pkmn.name} onError={fallbackSprite} style={{ width: '60px', height: '60px', filter: pkmn.caught ? 'none' : 'brightness(0) invert(0)', imageRendering: pkmn.caught ? undefined : 'auto' }} />
                          <strong style={{ textTransform: 'capitalize', display: 'block', fontSize: '0.85rem' }}>
                            {pkmn.caught ? pkmn.name : '???'}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pokedex-controls">
              <div className="d-pad" title="D-Pad Pokédex"></div>
              <button
                className="pokedex-close-btn"
                onClick={() => { setShowPokedex(false); setSelectedPokemonDetail(null); setPokedexSearch(''); }}
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
          <div className="pokedex-frame" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
            <div className="pokedex-top-bar">
              <div className="big-blue-sensor"></div>
              <div className="mini-leds">
                <div className="led red"></div>
                <div className="led yellow"></div>
                <div className="led green"></div>
              </div>
            </div>

            <div className="pokedex-screen" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                      style={{ flex: 1, accentColor: '#10b981', height: '6px', cursor: 'pointer' }}
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
                      style={{ flex: 1, accentColor: '#f59e0b', height: '6px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#9b98cf', minWidth: '32px', textAlign: 'right' }}>{sfxVol}%</span>
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
                  const keys = ['pokerand_progression', 'pokerand_pokedex', 'pokerand_wins', 'pokerand_losses', 'pokerand_streak', 'pokerand_best_streak', 'pokerand_achievements', 'pokerand_meta']
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

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem', marginTop: '0.75rem', padding: '0.85rem', background: 'rgba(255,154,214,0.08)', borderRadius: '10px', border: '1px solid rgba(255,154,214,0.35)' }}>
              <strong style={{ fontSize: '1rem', color: '#ffd0ec', display: 'block', marginBottom: '0.5rem' }}>
                {t('donate.title')}
              </strong>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: '#e6e2ff', lineHeight: '1.45' }}>
                {t('donate.desc')}
              </p>
              <a
                href="https://ko-fi.com/subkht"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '9px 16px', borderRadius: '8px',
                  background: '#ff5fa8', color: '#ffffff', fontWeight: 'bold', fontSize: '0.85rem',
                  border: '2px solid #ffd0ec',
                  textDecoration: 'none', cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
                onClick={playClick}
              >
                {t('donate.button')}
              </a>
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
            <h3>🔴 ¡TeamR derrotado!</h3>
            <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>No perdiste ningún Pokémon. ¡Elige uno del equipo enemigo para unirlo al tuyo!</p>
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
                Omitir (no quedarse con ninguno)
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
                  <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pkmn.id}.gif`}
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
            <div className="setup-hero-overlay">
              <div>
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
              </div>
            </div>
          </div>

          <div className="setup-grid">
            <div className="setup-col">
              <div className="setup-card">
                <h2 className="setup-card-title"><span className="setup-step">1</span> {t('setup.selectGeneration')}</h2>
                <div className="generation-grid">
            {generations.map((gen) => {
              const unlocked = isGenUnlocked(gen)
              const hardUnlocked = isHardUnlocked(gen)
              const infUnlocked = isInfiniteUnlocked(gen)
              const completedMed = progression.completedMedium.includes(gen)
              const completedAny = progression.completedAny.includes(gen)
              const completedHard = progression.completedHard.includes(gen)
              const completedColiseum = progression.completedColiseum.includes(gen)
              const completedLeague = progression.completedLeague.includes(gen)

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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                    </span>
                  </div>
                  <strong>{generationRegions[gen]}</strong>

                  {!unlocked && (
                    <span className="lock-text">
                      🔒 {t('setup.passGen', { gen: gen - 1 })}
                    </span>
                  )}
                  {unlocked && infUnlocked && (
                    <span className="unlock-tag-infinite">{t('setup.infiniteUnlocked')}</span>
                  )}
                  {unlocked && !infUnlocked && hardUnlocked && (
                    <span className="unlock-tag">{t('setup.hardAvailable')}</span>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
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

              <div className="setup-card" style={{ marginTop: '0.75rem' }}>
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
              <div className="setup-card">
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
            )})()}
          </div>

          <h2 style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>🎲 {t('setup.daily')}</h2>
          <div className="generation-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
            {(() => {
              const dailyConfig = getDailyConfig(dailySeed, [1,2,3,4,5,6,7,8,9])
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

              <div className="setup-card">
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
              <div className="setup-card">
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

      {(screen === 'route' || screen === 'battle' || screen === 'shop' || screen === 'spin' || screen === 'pokeRand' || screen === 'move' || screen === 'mega' || screen === 'gmax' || screen === 'primal' || screen === 'trade' || screen === 'blackmarket' || screen === 'double' || screen === 'casino') && activePokemon && (
        <section className="roulette-layout">
          <article className="panel trainer-panel">
            <p className="muted small-tag">{t('route.trainer')}</p>
            <div style={{ position: 'relative', display: 'block', width: 'fit-content', margin: '0 auto' }}>
              <img className={`sprite trainer-sprite${activePokemon.megaEvolved ? ' mega-active' : ''}${activePokemon.gmaxEvolved ? ' gmax-active' : ''} ${statusSpriteClass(activePokemon.status, activePokemon.leechSeed)}`} src={activePokemon.sprite} alt={activePokemon.name} onError={fallbackSprite} />
              <StatusFloat pokemon={activePokemon} />
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
              <div style={{ width: `${(activePokemon.hp / activePokemon.maxHp) * 100}%` }}></div>
            </div>

            <p className="label">{t('route.team')} {team.length}/{maxTeamSize}</p>
            <div className="team-grid">
              {team.map((pokemon, index) => (
                <div key={`${pokemon.id}-${index}`} className="sprite-tooltip-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    className={`team-slot ${index === activeIndex ? 'is-active' : ''} ${pokemon.hp <= 0 ? 'is-fainted' : ''}`}
                    type="button"
                    onClick={() => switchActive(index)}
                    disabled={pokemon.hp <= 0 || isLoading}
                  >
                    <img src={pokemon.sprite} alt={pokemon.name} onError={fallbackSprite} />
                    {pokemon.holdItem && ITEM_SPRITES[pokemon.holdItem] && (
                      <img
                        src={ITEM_SPRITES[pokemon.holdItem]}
                        alt={pokemon.holdItem}
                        title={`${pokemon.holdItem}: ${itemDesc(pokemon.holdItem ?? '')}`}
                        style={{ width: '18px', height: '18px', imageRendering: 'pixelated', position: 'absolute', bottom: '4px', right: '4px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
                      />
                    )}
                    <strong>{pokemon.name}{pokemon.shiny ? ' ✨' : ''}{pokemon.leechSeed && <LeechSeedBadge compact />}</strong>
                    <span>
                      {pokemon.hp}/{pokemon.maxHp}
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
                        {pokemon.holdItem} — {itemDesc(pokemon.holdItem ?? '')}
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
                      ✕ Quitar {pokemon.holdItem}
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
              {Array.from({ length: Math.max(0, maxTeamSize - team.length) }).map((_, index) => (
                <div key={`empty-${index}`} className="team-slot empty">
                  Empty
                </div>
              ))}
            </div>

            {pcStorage.length > 0 && (
              <>
                <p className="label" style={{ marginTop: '0.75rem' }}>PC ({pcStorage.length})</p>
                <div className="team-grid">
                  {pcStorage.map((pokemon, index) => (
                    <div key={`pc-${index}`} className="sprite-tooltip-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <button
                        className="team-slot"
                        type="button"
                        onClick={() => withdrawFromPC(index)}
                        disabled={isLoading}
                      >
                        <img src={pokemon.sprite} alt={pokemon.name} onError={fallbackSprite} />
                        {pokemon.holdItem && ITEM_SPRITES[pokemon.holdItem] && (
                          <img
                            src={ITEM_SPRITES[pokemon.holdItem]}
                            alt={pokemon.holdItem}
                            title={`${pokemon.holdItem}: ${itemDesc(pokemon.holdItem ?? '')}`}
                            style={{ width: '18px', height: '18px', imageRendering: 'pixelated', position: 'absolute', bottom: '4px', right: '4px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
                          />
                        )}
                        <strong>{pokemon.name}{pokemon.shiny ? ' ✨' : ''}</strong>
                        <span>
                          {pokemon.hp}/{pokemon.maxHp}
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
                Haz clic en "→ Equipo" para sacar del PC. Si el equipo está lleno, se intercambia con el activo.
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
            {difficulty !== 'infinite' && difficulty !== 'coliseum' && (
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
                : { paddingRight: '4px' }}
            >
              {(() => {
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
              })()}
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
                    const qty = shopQty[itemName] ?? 1
                    const maxQty = isHoldable ? 1 : Math.max(1, Math.min(99, Math.floor(money / finalPrice)))
                    const totalPrice = finalPrice * qty
                    const canBuy = money >= totalPrice

                        const stepperBtnStyle: CSSProperties = {
                      background: '#2a2a55',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      width: '26px',
                      height: '26px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      lineHeight: '1',
                    }

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
                            <strong style={{ color: isHoldable ? '#cba3ff' : '#4d9bff' }}>{itemName}</strong>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#9b98cf' }}>{itemDesc(itemName)}</p>
                            {isHoldable && <span style={{ fontSize: '0.65rem', color: '#b8a1ff' }}>objeto pasivo</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {!isHoldable && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                aria-label={`Reducir cantidad de ${itemName}`}
                                style={stepperBtnStyle}
                                onClick={() => setShopQty(prev => ({ ...prev, [itemName]: Math.max(1, (prev[itemName] ?? 1) - 1) }))}
                              >−</button>
                              <span style={{ minWidth: '20px', textAlign: 'center', color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                {qty}
                              </span>
                              <button
                                type="button"
                                aria-label={`Aumentar cantidad de ${itemName}`}
                                style={{ ...stepperBtnStyle, background: '#10b981' }}
                                onClick={() => setShopQty(prev => ({ ...prev, [itemName]: Math.min(maxQty, (prev[itemName] ?? 1) + 1) }))}
                              >+</button>
                            </div>
                          )}
                          <button
                            className="tiny-btn"
                            type="button"
                            onClick={() => isHoldable ? buyHoldableItem(itemName) : buyShopItem(itemName, qty)}
                            disabled={!canBuy}
                            style={{
                              background: canBuy ? '#10b981' : '#475569',
                              minWidth: '70px',
                              color: canBuy ? '#12122b' : '#d9d6f2',
                              fontWeight: 'bold',
                              cursor: canBuy ? 'pointer' : 'not-allowed'
                            }}
                          >
                            {isHoldable ? `$${finalPrice}` : `${qty > 1 ? `${qty}× ` : ''}$${totalPrice}`}
                          </button>
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
                                {entry.name} {entry.count > 1 && <span style={{ color: '#ff8a80', fontWeight: 'bold' }}>×{entry.count}</span>}
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
                    const canBuy = money >= price
                    return (
                      <div key={itemName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {ITEM_SPRITES[itemName] && <img src={ITEM_SPRITES[itemName]} alt={itemName} style={{ width: '26px', height: '26px', imageRendering: 'pixelated' }} />}
                          <strong style={{ color: '#f3f1ff', fontSize: '0.85rem' }}>{itemName}</strong>
                        </div>
                        <button className="tiny-btn" type="button" disabled={!canBuy} onClick={() => blackMarketBuyItem(itemName)} style={{ color: canBuy ? '#fb923c' : '#7d7ab5' }}>🪙 ${price}</button>
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
                          <span style={{ color: '#f3f1ff', fontSize: '0.85rem' }}>{itemName} ×{count}</span>
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
                      const canBuy = money >= price
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.5)', padding: '6px 10px', borderRadius: '6px', border: '1px solid #3f3f6e' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img src={p.sprite} alt={p.name} onError={fallbackSprite} style={{ width: '32px', height: '32px', imageRendering: 'pixelated' }} />
                            <div>
                              <strong style={{ color: '#f3f1ff', fontSize: '0.85rem' }}>{p.name} <span style={{ color: '#7d7ab5' }}>Nv.{p.level}</span></strong>
                              <div style={{ fontSize: '0.7rem', color: '#9b98cf' }}>{p.types?.join(' / ')}</div>
                            </div>
                          </div>
                          <button className="tiny-btn" type="button" disabled={!canBuy} onClick={() => blackMarketBuyPokemon(idx)} style={{ color: canBuy ? '#fb923c' : '#7d7ab5' }}>🪙 ${price}</button>
                        </div>
                      )
                    })
                  )}
                </div>

                <button className="cta" onClick={completeCurrentNode} type="button" style={{ width: '100%', marginTop: '1rem' }}>{t('shop.leaveMarket')}</button>
              </div>
            )}

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
                            {itemName} ×{count}
                          </button>
                        )
                      })}
                      {inventory.length === 0 && <span style={{ color: '#7d7ab5', fontSize: '0.8rem' }}>No tienes objetos.</span>}
                    </div>
                    {coopMyOffer && (
                      <p style={{ color: '#f3f1ff', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        Tu oferta: <strong style={{ color: '#37d16b' }}>{coopMyOffer.kind === 'pokemon' ? `${coopMyOffer.name} (Nv.${coopMyOffer.level})` : coopMyOffer.itemName}</strong>
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
                          <span className="roulette-item-name">{item}</span>
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
                      {t('spin.got', { item: spinItems[spinWinnerIndex] })}
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
                        {team.length >= maxTeamSize ? t('route.captureToPC', { n: pcStorage.length }) : t('route.captureTeam', { n: team.length, max: maxTeamSize })}
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
                <CasinoMinigame onComplete={casinoComplete} />
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
                        <button
                          key={`move-opt-${move.name}`}
                          className="move-btn move-opt-btn"
                          type="button"
                          onClick={() => setSelectedNewMove(move)}
                          title={moveTooltip(move)}
                          style={{ borderColor: TYPE_COLORS[move.type] ?? '#475569' }}
                        >
                          <strong>{moveName(move)}</strong>
                          <span className="muted" style={{ fontSize: '0.5rem' }}>
                            {move.type.toUpperCase()} · Pwr {move.power} · Acc {move.accuracy ?? '—'}
                          </span>
                          {moveEffectSummary(move) && <span className="move-btn-effect" style={{ fontSize: '0.55rem' }}>{moveEffectSummary(move)}</span>}
                        </button>
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
                        <button
                          key={`move-replace-${idx}`}
                          className="move-btn move-opt-btn"
                          type="button"
                          onClick={() => replaceTeamMove(idx)}
                          title={moveTooltip(move)}
                          style={{ borderColor: TYPE_COLORS[move.type] ?? '#475569' }}
                        >
                          <strong>{moveName(move)}</strong>
                          <span className="muted" style={{ fontSize: '0.5rem' }}>
                            {move.type.toUpperCase()} · Pwr {move.power}
                          </span>
                          {moveEffectSummary(move) && <span className="move-btn-effect" style={{ fontSize: '0.55rem' }}>{moveEffectSummary(move)}</span>}
                        </button>
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
                <p style={{ color: '#fbbf24', fontSize: '0.85rem' }}>✨ El equipo se ha curado por completo.</p>
                <div className="capture-card" style={{ border: '2px solid #fbbf24', boxShadow: '0 0 12px rgba(251,191,36,0.4)' }}>
                  <img className="sprite" src={legendaryEncounter.sprite} alt={legendaryEncounter.name} onError={fallbackSprite} />
                </div>
                <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                  <button className="cta" onClick={captureLegendaryPokemon} type="button" style={{ background: '#d97706' }}>
                    {team.length >= maxTeamSize ? t('route.captureToPC', { n: pcStorage.length }) : t('route.captureLegend')}
                  </button>
                  <button className="secondary" onClick={skipLegendaryCapture} type="button">
                    Skip
                  </button>
                </div>
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type !== 'rest' && !legendaryEncounter && (
              <div className="action-block">
                <p>
                  {t('route.nextNode', { name: `${nodeTypeLabel(currentNode)} #${currentNode.id}` })}
                </p>
                <button className={`cta ${currentNode.type === 'teamRocket' ? 'cta-danger' : ''}`} onClick={enterNode} type="button" disabled={isLoading}>
                  {isLoading ? t('node.searching') : currentNode.type === 'teamRocket' ? t('node.teamRocket') : currentNode.type === 'spin' ? t('node.spin') : currentNode.type === 'pokeRand' ? t('node.pokeRand') : currentNode.type === 'mega' ? t('node.mega') : currentNode.type === 'gmax' ? t('node.gmax') : currentNode.type === 'primal' ? t('node.primal') : currentNode.type === 'trade' ? t('node.trade') : currentNode.type === 'rival' ? t('node.rival') : currentNode.type === 'blackmarket' ? t('node.blackmarket') : currentNode.type === 'double' ? t('node.double') : currentNode.type === 'casino' ? t('node.casino') : t('node.enter')}
                </button>
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type === 'rest' && restEncounter && !legendaryEncounter && (
              <div className="action-block">
                <p>
                  <span dangerouslySetInnerHTML={{ __html: t('rest.waiting', { name: restEncounter.name + (restEncounter.shiny ? ' ✨' : '') }) }} />
                </p>
                <p className="muted">{t('rest.rewardAdded', { item: restRewardItem })}</p>
                <div className="capture-card" style={restEncounter.shiny ? { border: '2px solid #ffcb05', boxShadow: '0 0 12px rgba(250,204,21,0.4)' } : undefined}>
                  <img className="sprite" src={restEncounter.sprite} alt={restEncounter.name} onError={fallbackSprite} />
                </div>
                <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                  <button className="cta" onClick={captureRestPokemon} type="button">
                    {team.length >= maxTeamSize ? t('route.captureToPC', { n: pcStorage.length }) : t('route.catchLabel')}
                  </button>
                  <button className="secondary" onClick={skipRestCapture} type="button">
                    {t('common.skip')}
                  </button>
                </div>
                <div className="evolve-section" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>{t('rest.healPrompt')}</p>
                  <button className="cta" onClick={() => { if (runChallenges.noHealing) { setBattleLog(prev => [t('b.challengeNoHealRest'), ...prev].slice(0, 15)); completeCurrentNode(); return } setTeam(prev => prev.map(p => p.hp <= 0 ? { ...p, hp: Math.max(1, Math.floor(p.maxHp * 0.5)) } : { ...p, hp: p.maxHp })); setBattleLog(prev => [t('b.restHealed'), ...prev].slice(0, 15)); completeCurrentNode() }} type="button"                     style={{ background: '#ee3b2f', width: '100%' }}>
                    {t('rest.healTeam')}
                  </button>
                </div>
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type === 'rest' && !restEncounter && !legendaryEncounter && (
              <div className="action-block">
                <p>
                  {t('b.restStop', { name: `${nodeTypeLabel(currentNode)} #${currentNode.id}` })}
                </p>
                <button className="cta" onClick={enterNode} type="button" disabled={isLoading}>
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
                              <button
                                key={mi}
                                className="tiny-btn"
                                type="button"
                                onClick={() => doubleSelectMove(slot, mi)}
                                title={moveTooltip(m)}
                                style={{ background: sel?.moveIdx === mi ? '#a855f7' : '#2a2a55', color: '#fff', border: sel?.moveIdx === mi ? '2px solid #cba3ff' : '2px solid transparent' }}
                              >
                                {moveName(m)} ({m.type})
                                {moveEffectSummary(m) && <div style={{ fontSize: '0.6rem', color: '#7dd3fc', marginTop: '2px' }}>{moveEffectSummary(m)}</div>}
                              </button>
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
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img className={`sprite enemy-sprite${enemy.gmaxEvolved ? ' gmax-active' : ''} ${statusSpriteClass(enemy.status, enemy.leechSeed)}`} src={enemy.sprite} alt={enemy.name} onError={fallbackSprite} style={enemyHitFlash ? { filter: 'brightness(1.5) sepia(1) hue-rotate(-40deg) saturate(5)', transition: 'filter 0.05s' } : { transition: 'filter 0.3s' }} />
                  <StatusFloat pokemon={enemy} />
                </div>
                <div className="hp-line">
                  <span>HP rival</span>
                  <strong>{enemy.hp}/{enemy.maxHp}</strong>
                </div>
                <div className="meter enemy-meter">
                  <div style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}></div>
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
                    return (
                    <button
                      key={move.name}
                      className="move-btn"
                      onClick={() => onPlayerMove(move)}
                      type="button"
                      disabled={isLoading || isDisabled || (runChallenges.speedrun && speedrunSeconds <= 0)}
                      title={isDisabled ? `🚫 Anulado por Anulación` : moveTooltip(move)}
                      style={isDisabled ? { borderColor: '#ff8a80', opacity: 0.5, textDecoration: 'line-through' } : undefined}
                    >
                      <span className="move-btn-line">{isDisabled ? '🚫 ' : ''}{moveName(move)} ({move.type}{runChallenges.typeRandomizer ? ' *' : ''}){move.minHits ? ` x${move.minHits}-${move.maxHits}` : ''}</span>
                      {moveEffectSummary(move) && <span className="move-btn-effect">{moveEffectSummary(move)}</span>}
                    </button>
                    )
                  })}
                  </>
                  )}
                </div>
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
                    onClick={megaEvolveActive}
                    type="button"
                    style={{ marginTop: '8px', width: '100%', background: '#e060a8' }}
                  >
                    💥 ¡Mega Evolucionar!
                  </button>
                )}
                {activePokemon.holdItem === 'Dynamax Band' && !battleGmaxUsed && !activePokemon.gmaxEvolved && !activePokemon.megaEvolved && GMAX_CAPABLE_IDS.has(activePokemon.id) && (
                  <button
                    className="cta"
                    onClick={gmaxEvolveActive}
                    type="button"
                    style={{ marginTop: '8px', width: '100%', background: '#6b8cff' }}
                  >
                    ⚡ ¡Gigamaximar!
                  </button>
                )}
                {(activePokemon.holdItem === 'Prisma Rojo' || activePokemon.holdItem === 'Prisma Azul') && !battlePrimalUsed && !activePokemon.megaEvolved && !activePokemon.gmaxEvolved && PRIMAL_CAPABLE_IDS.has(activePokemon.id) && (
                  <button
                    className="cta"
                    onClick={primalEvolveActive}
                    type="button"
                    style={{ marginTop: '8px', width: '100%', background: '#ff8a33' }}
                  >
                    🔮 ¡Primal Reversion!
                  </button>
                )}
              </div>
            )}

            {apiError && <p className="error-line">{apiError}</p>}
          </article>

          <article className="panel items-panel">
            <h2>{t('route.items')}</h2>
            <div className="items-grid">
              {inventoryEntries.length > 0 ? (
                inventoryEntries.map((entry) => {
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
                          <strong style={{ color: '#cba3ff' }}>{entry.name}</strong>
                          <span style={{ fontSize: '0.6rem', color: '#7c3aed' }}>x{entry.count} · equipar</span>
                        </div>
                      </button>
                    )
                  }
                  return (
                    <button
                      key={entry.name}
                      className="item-slot filled item-button"
                      type="button"
                      onClick={() => consumeInventoryItem(entry.name)}
                      title={entry.description}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px' }}
                    >
                      {itemIcon && (
                        <img
                          src={itemIcon}
                          alt={entry.name}
                          style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                        />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <strong>{entry.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#9b98cf' }}>x{entry.count}</span>
                      </div>
                    </button>
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

            <div className="log-mini">
              <p className="small-tag">Battle log</p>
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
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#9b98cf', fontSize: '0.75rem' }}>${item.price}</div>
                      </div>
                    </div>
                    <button className="cta" onClick={() => { if (money >= item.price) { setMoney(prev => prev - item.price); setInventory(prev => [...prev, item.name]); setBattleLog(prev => [`🧳 Compraste ${item.name} por $${item.price}.`, ...prev].slice(0, 15)) } }} disabled={!canBuy} style={{ fontSize: '0.8rem', padding: '4px 14px', background: canBuy ? '#ffcb05' : '#475569', color: '#000' }}>
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
              <button className="cta" onClick={() => { setLeagueOffer(false); setLeagueTeamSelection(true) }} style={{ background: '#4d9bff', color: '#000' }}>
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
      {leagueTeamSelection && (
        <div className="modal-backdrop" onClick={() => setLeagueTeamSelection(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <h3 style={{ color: '#4d9bff', margin: '0 0 0.5rem' }}>🏆 Equipo para la Liga</h3>
            <p style={{ color: '#9b98cf', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Selecciona entre 1 y 6 Pokémon de tu equipo y PC ({tempLeagueTeam.length}/6)
            </p>
            {tempLeagueTeam.length >= 1 && (
              <button className="cta" onClick={async () => {
                setLeagueTeamSelection(false)
                const healed = tempLeagueTeam.map(p => ({ ...p, hp: p.maxHp, status: undefined }))
                const maxLvl = Math.max(...healed.map(p => p.level)) + 2
                const leagueRoute: RouteNode[] = []
                for (let i = 0; i < 4; i++) {
                  leagueRoute.push({ id: 1000 + i, type: 'boss', label: `Liga #${i + 1}`, done: false })
                }
                setTeam(healed)
                setPcStorage([])
                setRoute(leagueRoute)
                setRouteIndex(0)
                setScreen('route')
                setBattleLog(prev => [t('b.leagueWelcome', { lvl: maxLvl }), ...prev].slice(0, 15))
              }} style={{ background: '#4d9bff', color: '#000', width: '100%', marginBottom: '1rem' }}>
                🏆 ¡Comenzar Liga!
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '6px' }}>
              {[...team.map(p => ({ ...p, _source: 'team' as const })), ...pcStorage.map(p => ({ ...p, _source: 'pc' as const }))].map((pkmn, idx) => {
                const key = `${pkmn._source}-${idx}`
                const selected = tempLeagueTeam.some(p => p.id === pkmn.id && p.hp === pkmn.hp)
                return (
                  <div key={key}
                    onClick={() => {
                      if (selected) {
                        setTempLeagueTeam(prev => prev.filter(p => !(p.id === pkmn.id && p.hp === pkmn.hp)))
                      } else if (tempLeagueTeam.length < 6) {
                        setTempLeagueTeam(prev => [...prev, pkmn])
                      }
                    }}
                    style={{
                      padding: '6px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer',
                      background: selected ? 'rgba(56,189,248,0.2)' : 'rgba(30,41,59,0.6)',
                      border: selected ? '2px solid #4d9bff' : '1px solid #3f3f6e', opacity: !selected && tempLeagueTeam.length >= 6 ? 0.4 : 1
                    }}
                  >
                    <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} />
                    <div style={{ fontSize: '0.7rem', textTransform: 'capitalize', color: selected ? '#4d9bff' : '#f3f1ff' }}>{pkmn.name}</div>
                    <div style={{ fontSize: '0.6rem', color: pkmn._source === 'team' ? '#7ceb95' : '#9b98cf' }}>Nv.{pkmn.level}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Achievements Modal */}
      {showAchievements && (
        <div className="modal-backdrop" onClick={() => setShowAchievements(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <h2 style={{ color: '#4d9bff', textAlign: 'center', marginBottom: '0.25rem' }}>{t('ach.title')} ({Object.values(achievements).filter(a => a.unlocked).length}/{ACHIEVEMENTS.length})</h2>
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
        <MinigamePractice onClose={() => setShowMinigamePractice(false)} />
      )}

      {/* Run Stats on Victory */}
      {screen === 'victory' && (
        <div className="panel" style={{ maxWidth: '400px', margin: '0 auto', padding: '1rem' }}>
          <h3 style={{ color: '#4d9bff', textAlign: 'center', marginBottom: '0.75rem' }}>{t('runstats.title')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '1.1rem' }}>
            <div style={{ color: '#9b98cf' }}>{t('runstats.battlesWon')}</div><div style={{ color: '#37d16b', fontWeight: 'bold' }}>{runStats.battlesWon}</div>
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
                        <img key={i} src={p.sprite} alt={p.name} title={p.name} onError={fallbackSprite} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} />
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
                  <div key={i} style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '8px', border: p ? '1px solid #a855f7' : '1px dashed #3f3f6e', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                    {p ? (
                      <>
                        <img src={p.sprite} alt={p.name} title={p.name} onError={fallbackSprite} className="pvp-sprite-bob" style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }} />
                        <button
                          type="button"
                          onClick={() => {
                            setPvpBuildTeam(prev => prev.filter((_, x) => x !== i))
                            if (pvpBuildSelected === p.id) {
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

            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <input type="text" placeholder={t('pvp.searchPokemon')} value={pvpBuildSearch} onChange={e => setPvpBuildSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem' }}>
              {Object.values(pokedex).filter(p => p.caught).filter(p => {
                const term = pvpBuildSearch.toLowerCase().trim()
                return !term || p.name.toLowerCase().includes(term) || String(p.id).includes(term)
              }).sort((a, b) => a.id - b.id).map(pkmn => {
                const inTeam = pvpBuildTeam.some(p => p.id === pkmn.id)
                const isSelected = pvpBuildSelected === pkmn.id
                return (
                  <div
                    key={pkmn.id}
                    onClick={() => {
                      if (!inTeam && pvpBuildTeam.length >= 6) return
                      if (isSelected) {
                        setPvpBuildSelected(null)
                        setPvpBuildMoves([])
                        setPvpBuildSelectedMoveNames(new Set())
                      } else {
                        void loadPvpBuildMoves(pkmn.id, inTeam ? (pvpBuildTeam.find(p => p.id === pkmn.id)?.moves.map(m => m.name) ?? []) : [])
                      }
                    }}
                    style={{ border: `1px solid ${isSelected ? '#a855f7' : inTeam ? '#37d16b' : '#3f3f6e'}`, borderRadius: '8px', padding: '6px', textAlign: 'center', cursor: 'pointer', background: isSelected ? 'rgba(168,85,247,0.15)' : 'rgba(15,23,42,0.5)' }}
                  >
                    <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} className="pvp-sprite-bob" style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }} />
                    <div style={{ fontSize: '0.7rem', color: '#f3f1ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pkmn.name}</div>
                    {inTeam && <div style={{ fontSize: '0.65rem', color: '#37d16b' }}>✓ En equipo</div>}
                  </div>
                )
              })}
            </div>

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
              <button className="tiny-btn" type="button" onClick={() => setShowHelpModal(false)} style={{ color: '#ff8a80' }}>{t('common.close')}</button>
            </div>

            <div style={{ color: '#d9d6f2', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.25rem', animation: 'casinoFadeIn 0.5s ease' }}>
              {t('help.intro')}
            </div>

            <div className="help-section" style={{ marginBottom: '1.25rem', animation: 'casinoSlideUp 0.3s ease' }}>
              <h3 style={{ color: '#37d16b', margin: '0 0 0.5rem', fontSize: '1rem' }}>{t('help.changesTitle')}</h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#d9d6f2', fontSize: '0.88rem', lineHeight: '1.7' }}>
                <li>{t('help.changes1')}</li>
                <li>{t('help.changes2')}</li>
                <li>{t('help.changes3')}</li>
                <li>{t('help.changes4')}</li>
                <li>{t('help.changes5')}</li>
                <li>{t('help.changes6')}</li>
                <li>{t('help.changes7')}</li>
                <li>{t('help.changes8')}</li>
                <li>{t('help.changes9')}</li>
              </ul>
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
                  ['rival', 'help.rival'], ['blackmarket', 'help.blackmarket'], ['double', 'help.double'], ['casino', 'help.casino'],
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
                if (visibleThemes.length === 0 && visibleItems.length === 0 && visibleBgs.length === 0) {
                  return <p style={{ color: '#7d7ab5', fontSize: '0.85rem', textAlign: 'center', margin: '0.75rem 0 0' }}>{t('shop.noResultsSearch', { q: metaShopSearch })}</p>
                }
                return null
              })()}
            </div>

            <h3 style={{ color: '#4d9bff', marginBottom: '0.5rem' }}>🎨 {t('shop.themes')}</h3>
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

            <h3 style={{ color: '#22d3ee', marginBottom: '0.5rem' }}>🖼️ {t('shop.backgrounds')}</h3>
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

            <h3 style={{ color: '#ff8a33', marginBottom: '0.5rem' }}>🧪 {t('shop.consumables')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.consumablesDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'consumable' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>📦</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#ff8a33', fontSize: '0.7rem' }}>{t('shop.catConsumable')}</div>
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

            <h3 style={{ color: '#38bdf8', marginBottom: '0.5rem' }}>💿 {t('shop.disco')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.discoDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'disco_mt' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>💿</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#38bdf8', fontSize: '0.7rem' }}>{t('shop.catDisco')}</div>
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

            <h3 style={{ color: '#ee3b2f', marginBottom: '0.5rem' }}>🏐 {t('shop.pokeballs')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.pokeballsDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'pokeball' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>🏐</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#ee3b2f', fontSize: '0.7rem' }}>{t('shop.catPokeball')}</div>
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

            <h3 style={{ color: '#a855f7', marginBottom: '0.5rem' }}>💎 {t('shop.stones')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.stonesDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'evolution_stone' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>💎</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#a855f7', fontSize: '0.7rem' }}>{t('shop.catStone')}</div>
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

            <h3 style={{ color: '#ff8a33', marginBottom: '0.5rem' }}>🔧 {t('shop.evoItems')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.evoItemsDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'evolution_item' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>🔧</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#ff8a33', fontSize: '0.7rem' }}>{t('shop.catEvoItem')}</div>
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

            <h3 style={{ color: '#22d3ee', marginBottom: '0.5rem' }}>⚙️ {t('shop.upgrades')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.upgradesDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'upgrade' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                const locked = item.requires ? !metaProgression.permanentlyUnlockedItems.includes(item.requires) : false
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem', opacity: locked ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>
                        {ITEM_SPRITES[item.spriteKey]
                          ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '36px', height: '36px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                          : item.spriteKey === 'money' ? '💰' : item.spriteKey === 'dice' ? '🎲' : '⚙️'}
                      </span>
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#22d3ee', fontSize: '0.7rem' }}>{t('shop.catUpgrade')}</div>
                      </div>
                    </div>
                    <div style={{ color: '#d9d6f2', fontSize: '1rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>{metaItemDesc(item.id)}</div>
                    {owned ? (
                      <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.unlocked')}</div>
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

            <h3 style={{ color: '#ff9ad6', marginBottom: '0.5rem' }}>{t('shop.music')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.musicDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'music' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.ownedMusic.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>🎵</span>
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
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

            <h3 style={{ color: '#a855f7', marginBottom: '0.5rem' }}>{t('shop.holdables')}</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{t('shop.holdablesDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'holdable' && metaShopItemMatches(item, metaShopSearch.trim().toLowerCase())).map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                const locked = item.requires ? !metaProgression.permanentlyUnlockedItems.includes(item.requires) : false
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem', opacity: locked ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>📦</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#a855f7', fontSize: '0.7rem' }}>{t('shop.catHoldable')}</div>
                      </div>
                    </div>
                    <div style={{ color: '#d9d6f2', fontSize: '1rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>{metaItemDesc(item.id)}</div>
                    {owned ? (
                      <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('shop.unlocked')}</div>
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