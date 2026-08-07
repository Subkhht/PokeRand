import { useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'
import { t } from '../game/i18n'

interface ArrowState {
  x: number
  y: number
  vy: number
  flying: boolean
  hit: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

const W = 460
const H = 320
const GROUND_Y = 270
const TARGET_CX = 400
const TARGET_R = 26
const ARROW_R = 8

const LAUNCH_X = 40
const LAUNCH_Y = GROUND_Y - 22
const VX = 280
const GRAVITY = 320

const FORK_TIPS = [
  { x: 26, y: GROUND_Y - 48 },
  { x: 54, y: GROUND_Y - 48 },
]

// Posición del proyectil en el reposo y al cargar (retroceso del tirachinas).
function ballRestPosition(): { x: number; y: number } {
  return { x: LAUNCH_X, y: GROUND_Y - 24 }
}

function ballPullPosition(power: number): { x: number; y: number } {
  return { x: LAUNCH_X - 6 - power * 16, y: GROUND_Y - 14 + power * 20 }
}

function drawPokeball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  // Mitad superior roja
  ctx.beginPath()
  ctx.arc(x, y, r, Math.PI, 0)
  ctx.fillStyle = '#ef4444'
  ctx.fill()
  // Mitad inferior blanca
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI)
  ctx.fillStyle = '#f8fafc'
  ctx.fill()
  // Contorno y banda
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(x - r, y - 1.6, r * 2, 3.2)
  // Botón central
  ctx.beginPath()
  ctx.arc(x, y, 2.6, 0, Math.PI * 2)
  ctx.fillStyle = '#f8fafc'
  ctx.fill()
  ctx.stroke()
  // Brillo
  ctx.beginPath()
  ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.25, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fill()
}

export default function Slingshot({ onComplete }: CasinoMinigameProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const powerRef = useRef(0)
  const chargingRef = useRef(false)
  const flyingRef = useRef(false)
  const arrowRef = useRef<ArrowState>({ x: LAUNCH_X, y: LAUNCH_Y, vy: 0, flying: false, hit: false })
  const minDistRef = useRef(Infinity)
  const scoreRef = useRef<number | null>(null)
  const ringRef = useRef<{ active: boolean; t: number; x: number; y: number }>({ active: false, t: 0, x: 0, y: 0 })
  const particlesRef = useRef<Particle[]>([])

  const [power, setPower] = useState(0)
  const [charging, setCharging] = useState(false)
  const [result, setResult] = useState<number | null>(null)

  const startCharge = (): void => {
    if (result !== null || flyingRef.current) return
    playClick()
    chargingRef.current = true
    setCharging(true)
    powerRef.current = 0
  }

  const release = (): void => {
    if (!chargingRef.current) return
    chargingRef.current = false
    setCharging(false)
    const p = powerRef.current
    flyingRef.current = true
    minDistRef.current = Infinity
    arrowRef.current = { x: LAUNCH_X, y: LAUNCH_Y, vy: -(40 + 220 * p), flying: true, hit: false }
    playHit()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    const targetOffset = Math.random() * 40 - 20
    const targetY = GROUND_Y - 40 + targetOffset
    const clouds = Array.from({ length: 4 }, (_, i) => ({
      x: (i * 130 + Math.random() * 40) % W,
      y: 24 + Math.random() * 42,
      s: 0.8 + Math.random() * 0.6,
      v: 4 + Math.random() * 5,
    }))

    const finish = (score: number): void => {
      if (scoreRef.current !== null) return
      scoreRef.current = score
      playEvolution()
      setResult(score)
      setTimeout(() => onComplete(score), 700)
    }

    const spawnParticles = (x: number, y: number): void => {
      particlesRef.current = Array.from({ length: 14 }, () => ({
        x,
        y,
        vx: (Math.random() - 0.5) * 160,
        vy: -Math.random() * 140 - 20,
        life: 0.5 + Math.random() * 0.4,
      }))
    }

    const update = (dt: number): void => {
      if (chargingRef.current) {
        powerRef.current = Math.min(1, powerRef.current + dt * 0.8)
        setPower(powerRef.current)
      }
      const arrow = arrowRef.current
      if (arrow.flying && !arrow.hit) {
        arrow.vy += GRAVITY * dt
        arrow.x += VX * dt
        arrow.y += arrow.vy * dt
        const dist = Math.hypot(arrow.x - TARGET_CX, arrow.y - targetY)
        if (dist < minDistRef.current) minDistRef.current = dist
        if (dist < TARGET_R + ARROW_R) {
          arrow.hit = true
          arrow.x = TARGET_CX + (arrow.x - TARGET_CX)
          arrow.y = targetY
          ringRef.current = { active: true, t: 0, x: arrow.x, y: arrow.y }
          spawnParticles(arrow.x, arrow.y)
          const score = Math.max(200, Math.round(1000 - (dist / (TARGET_R + ARROW_R)) * 700))
          finish(score)
        } else if (arrow.y > GROUND_Y) {
          arrow.hit = true
          arrow.y = GROUND_Y
          spawnParticles(arrow.x, arrow.y)
          const best = minDistRef.current
          const score = best < 60
            ? Math.max(80, Math.round(1000 - (best / 60) * 900))
            : 50
          finish(score)
        }
      }
      if (ringRef.current.active) {
        ringRef.current.t += dt
      }
      particlesRef.current = particlesRef.current
        .filter(p => p.life > 0)
        .map(p => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          vy: p.vy + 300 * dt,
          life: p.life - dt,
        }))
    }

    const drawTrajectory = (): void => {
      if (!chargingRef.current) return
      let vx = VX
      let vy = -(40 + 220 * powerRef.current)
      let x = LAUNCH_X
      let y = LAUNCH_Y
      const dt = 0.028
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 7])
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let i = 0; i < 80; i++) {
        vy += GRAVITY * dt
        x += vx * dt
        y += vy * dt
        if (y > GROUND_Y) break
        ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    const draw = (): void => {
      ctx.clearRect(0, 0, W, H)

      // Cielo
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
      sky.addColorStop(0, '#0e0b26')
      sky.addColorStop(0.55, '#241b4d')
      sky.addColorStop(1, '#3b2a63')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, GROUND_Y)

      // Sol con brillo
      const sunGrad = ctx.createRadialGradient(392, 44, 4, 392, 44, 46)
      sunGrad.addColorStop(0, 'rgba(255,203,5,0.95)')
      sunGrad.addColorStop(0.4, 'rgba(255,203,5,0.35)')
      sunGrad.addColorStop(1, 'rgba(255,203,5,0)')
      ctx.fillStyle = sunGrad
      ctx.beginPath()
      ctx.arc(392, 44, 46, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffcb05'
      ctx.beginPath()
      ctx.arc(392, 44, 16, 0, Math.PI * 2)
      ctx.fill()

      // Nubes
      ctx.fillStyle = 'rgba(203,213,225,0.28)'
      for (const c of clouds) {
        ctx.beginPath()
        ctx.ellipse(c.x, c.y, 22 * c.s, 9 * c.s, 0, 0, Math.PI * 2)
        ctx.ellipse(c.x + 16 * c.s, c.y - 5 * c.s, 15 * c.s, 7 * c.s, 0, 0, Math.PI * 2)
        ctx.ellipse(c.x - 17 * c.s, c.y - 3 * c.s, 14 * c.s, 6 * c.s, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // Colinas
      ctx.fillStyle = '#2d2150'
      ctx.beginPath()
      ctx.moveTo(0, GROUND_Y)
      for (let x = 0; x <= W; x += 8) {
        ctx.lineTo(x, GROUND_Y - 10 - Math.sin(x * 0.02) * 12 - Math.sin(x * 0.05) * 6)
      }
      ctx.lineTo(W, GROUND_Y)
      ctx.closePath()
      ctx.fill()

      // Suelo
      const grass = ctx.createLinearGradient(0, GROUND_Y, 0, H)
      grass.addColorStop(0, '#3f8f4e')
      grass.addColorStop(1, '#2c6338')
      ctx.fillStyle = grass
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
      ctx.strokeStyle = '#5bb86b'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(0, GROUND_Y)
      ctx.lineTo(W, GROUND_Y)
      ctx.stroke()

      // Diente (objetivo)
      const ringColors = ['#ffcb05', '#f59e0b', '#ef4444', '#7dd3fc']
      for (let i = 3; i >= 0; i--) {
        ctx.beginPath()
        ctx.arc(TARGET_CX, targetY, TARGET_R * (0.85 - i * 0.2), 0, Math.PI * 2)
        ctx.fillStyle = ringColors[i]
        ctx.fill()
      }
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(TARGET_CX, targetY, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffcb05'
      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur = 4
      ctx.fillText('1000', TARGET_CX, targetY - TARGET_R - 10)
      ctx.shadowBlur = 0

      // Tirachinas: horquilla
      ctx.strokeStyle = '#8b5a2b'
      ctx.lineWidth = 7
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(LAUNCH_X, GROUND_Y + 4)
      ctx.lineTo(FORK_TIPS[0].x, FORK_TIPS[0].y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(LAUNCH_X, GROUND_Y + 4)
      ctx.lineTo(FORK_TIPS[1].x, FORK_TIPS[1].y)
      ctx.stroke()

      // Proyectil: posición según cargando
      const arrow = arrowRef.current
      const resting = ballRestPosition()
      const pulled = ballPullPosition(powerRef.current)
      const bx = arrow.flying || arrow.hit ? arrow.x : (chargingRef.current ? pulled.x : resting.x)
      const by = arrow.flying || arrow.hit ? arrow.y : (chargingRef.current ? pulled.y : resting.y)

      // Goma del tirachinas (se tensa al cargar)
      if (!arrow.flying && !arrow.hit) {
        ctx.strokeStyle = chargingRef.current ? '#e0743a' : '#c0552f'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(FORK_TIPS[0].x, FORK_TIPS[0].y)
        ctx.lineTo(bx, by)
        ctx.moveTo(FORK_TIPS[1].x, FORK_TIPS[1].y)
        ctx.lineTo(bx, by)
        ctx.stroke()
      }

      // Trayectoria prevista al cargar
      drawTrajectory()

      drawPokeball(ctx, bx, by, ARROW_R)

      // Partículas de impacto
      for (const p of particlesRef.current) {
        const a = Math.max(0, p.life / 0.9)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,203,5,${a})`
        ctx.fill()
      }

      // Anillo de impacto
      if (ringRef.current.active && ringRef.current.t < 0.5) {
        const t = ringRef.current.t / 0.5
        ctx.beginPath()
        ctx.arc(ringRef.current.x, ringRef.current.y, 6 + t * 34, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,203,5,${1 - t})`
        ctx.lineWidth = 3
        ctx.stroke()
      }
    }

    const loop = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      for (const c of clouds) {
        c.x += c.v * dt
        if (c.x - 24 > W) c.x = -24
      }
      update(dt)
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [result, onComplete])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '1.25rem 1rem 1rem' }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: 'min(100%, 460px)', height: 'auto', border: '2px solid #7c5fd6', borderRadius: '12px', touchAction: 'none' }}
      />
      {result === null && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '380px' }}>
          <div style={{ width: '100%', height: '20px', background: 'rgba(0,0,0,0.4)', borderRadius: '10px', overflow: 'hidden', border: '1px solid #3f3f6e' }}>
            <div
              style={{
                height: '100%',
                width: `${power * 100}%`,
                background: power > 0.85 ? '#ff8a80' : power > 0.65 ? '#ffcb05' : power > 0.35 ? '#34d399' : '#60a5fa',
                transition: 'width 0.05s linear',
                boxShadow: '0 0 10px currentColor',
              }}
            />
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0 }}>Zona ideal de potencia: 60-80%</p>
          <button
            className="cta"
            type="button"
            onPointerDown={startCharge}
            onPointerUp={release}
            onPointerLeave={release}
            onPointerCancel={release}
            style={{ width: '100%', background: charging ? (power > 0.85 ? '#ff8a80' : '#f0abfc') : '#f0abfc', color: '#1a1033', touchAction: 'none', userSelect: 'none' }}
          >
            {charging ? `⚡ ${t('mg.loading')}... ${Math.round(power * 100)}%` : t('mg.slingshot.hold')}
          </button>
        </div>
      )}
      {result !== null && (
        <div style={{ textAlign: 'center', animation: 'casinoSlideUp 0.4s ease' }}>
          <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0 }}>
            {result >= 800 ? t('mg.slingshot.perfect') : `${t('mg.points')}: ${result}`}
          </p>
        </div>
      )}
    </div>
  )
}
