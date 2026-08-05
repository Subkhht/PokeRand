import { useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'

const W = 460
const H = 320
const GROUND_Y = 270
const BALL_R = 10
const GOAL_R = 20
const GOAL_CX = 380
const GOAL_Y_BASE = 235
const LAUNCH_X = 40
const LAUNCH_Y = GROUND_Y - 26
const GRAVITY = 460

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

interface Star {
  x: number
  y: number
  r: number
  phase: number
  speed: number
}

function trajectoryPoints(p: number): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = []
  let x = LAUNCH_X
  let y = LAUNCH_Y
  let vx = 90 + p * 300
  let vy = -(110 + p * 240)
  const dt = 1 / 30
  for (let i = 0; i < 120; i++) {
    vy += GRAVITY * dt
    x += vx * dt
    y += vy * dt
    if (y > GROUND_Y - BALL_R) break
    pts.push({ x, y })
  }
  return pts
}

export default function PokeballToss({ onComplete }: CasinoMinigameProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const powerRef = useRef(0)
  const chargingRef = useRef(false)
  const thrownRef = useRef(false)
  const ballRef = useRef({ x: LAUNCH_X, y: LAUNCH_Y, vx: 0, vy: 0, flying: false, settled: false, rot: 0 })
  const powerDirRef = useRef(1)
  const resultRef = useRef<number | null>(null)
  const goalOffsetRef = useRef(Math.random() * 26 - 13)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const trailRef = useRef<Array<{ x: number; y: number }>>([])
  const particlesRef = useRef<Particle[]>([])
  const goalFlashRef = useRef(0)
  const starsRef = useRef<Star[]>(
    Array.from({ length: 45 }, () => ({
      x: Math.random() * W,
      y: Math.random() * (GROUND_Y - 50),
      r: Math.random() * 1.6 + 0.4,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 2 + 0.6,
    }))
  )

  const [power, setPower] = useState(0)
  const [charging, setCharging] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const spawnParticles = (x: number, y: number, color: string, count: number, spread = 120): void => {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2
      const speed = 30 + Math.random() * spread
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 40,
        life: 0.6 + Math.random() * 0.5,
        maxLife: 1,
        color,
        size: 2 + Math.random() * 3,
      })
    }
  }

  const startCharge = (): void => {
    if (result !== null || thrownRef.current) return
    playClick()
    chargingRef.current = true
    setCharging(true)
    powerRef.current = 0
    powerDirRef.current = 1
    setPower(0)
  }

  const release = (): void => {
    if (!chargingRef.current) return
    chargingRef.current = false
    setCharging(false)
    const p = powerRef.current
    thrownRef.current = true
    ballRef.current = {
      x: LAUNCH_X,
      y: LAUNCH_Y,
      vx: 90 + p * 300,
      vy: -(110 + p * 240),
      flying: true,
      settled: false,
      rot: 0,
    }
    trailRef.current = []
    playHit()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    const goalY = GOAL_Y_BASE + goalOffsetRef.current

    const update = (dt: number): void => {
      if (chargingRef.current) {
        powerRef.current += powerDirRef.current * dt * 0.95
        if (powerRef.current >= 1) { powerRef.current = 1; powerDirRef.current = -1 }
        if (powerRef.current <= 0) { powerRef.current = 0; powerDirRef.current = 1 }
        setPower(powerRef.current)
      }

      // Particles
      const parts = particlesRef.current
      for (let i = parts.length - 1; i >= 0; i--) {
        const pt = parts[i]
        pt.life -= dt
        if (pt.life <= 0) {
          parts.splice(i, 1)
          continue
        }
        pt.x += pt.vx * dt
        pt.y += pt.vy * dt
        pt.vy += 260 * dt
      }

      const ball = ballRef.current
      if (ball.flying && !ball.settled) {
        ball.vy += GRAVITY * dt
        ball.x += ball.vx * dt
        ball.y += ball.vy * dt
        ball.rot += ball.vx * 0.06 * dt
        trailRef.current.unshift({ x: ball.x, y: ball.y })
        if (trailRef.current.length > 14) trailRef.current.pop()

        const dist = Math.hypot(ball.x - GOAL_CX, ball.y - goalY)
        if (ball.vy > 0 && dist < GOAL_R + BALL_R) {
          ball.settled = true
          ball.flying = false
          playEvolution()
          goalFlashRef.current = performance.now()
          spawnParticles(GOAL_CX, goalY, '#ffcb05', 16, 160)
          spawnParticles(GOAL_CX, goalY, '#f0abfc', 10, 110)
          resultRef.current = 1000
          setResult(1000)
          setMsg('🎯 ¡GOOOL! ¡Captura perfecta!')
          setTimeout(() => onCompleteRef.current(1000), 750)
        } else if (ball.y > GROUND_Y - BALL_R) {
          ball.settled = true
          ball.flying = false
          ball.y = GROUND_Y - BALL_R
          spawnParticles(ball.x, GROUND_Y - 2, '#8a6a3a', 8, 60)
          const xDist = Math.abs(ball.x - GOAL_CX)
          const score = Math.max(50, Math.round(1000 - (xDist / 220) * 700))
          resultRef.current = score
          setResult(score)
          setMsg(
            score >= 850 ? '🔥 ¡Casi perfecto!' :
            score >= 550 ? '🙂 ¡Buen lanzamiento!' :
            '💨 ¡Muy corto!'
          )
          setTimeout(() => onCompleteRef.current(score), 750)
        }
      }
    }

    const draw = (): void => {
      ctx.clearRect(0, 0, W, H)

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
      sky.addColorStop(0, '#140d33')
      sky.addColorStop(0.6, '#241a52')
      sky.addColorStop(1, '#3a2a6e')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, GROUND_Y)

      // Stars
      const now = performance.now()
      for (const s of starsRef.current) {
        const a = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(now / 900 * s.speed + s.phase))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(240, 235, 255, ${a})`
        ctx.fill()
      }

      // Moon
      ctx.beginPath()
      ctx.arc(70, 55, 22, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(248, 240, 190, 0.9)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(78, 48, 20, 0, Math.PI * 2)
      ctx.fillStyle = '#241a52'
      ctx.fill()

      // Distant hills
      ctx.beginPath()
      ctx.moveTo(0, GROUND_Y)
      for (let x = 0; x <= W; x += 20) {
        const y = GROUND_Y - (26 + 22 * Math.sin(x * 0.02) + 10 * Math.cos(x * 0.045))
        ctx.lineTo(x, y)
      }
      ctx.lineTo(W, GROUND_Y)
      ctx.closePath()
      ctx.fillStyle = '#2b1b4d'
      ctx.fill()

      // Ground
      const ground = ctx.createLinearGradient(0, GROUND_Y, 0, H)
      ground.addColorStop(0, '#1d4a2a')
      ground.addColorStop(1, '#0f2b16')
      ctx.fillStyle = ground
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
      ctx.fillStyle = '#34d399'
      ctx.fillRect(0, GROUND_Y, W, 3)

      // Goal hoop
      ctx.strokeStyle = '#5a5a96'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(GOAL_CX, GROUND_Y)
      ctx.lineTo(GOAL_CX, goalY + GOAL_R)
      ctx.stroke()
      ctx.strokeStyle = '#f0abfc'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(GOAL_CX, goalY, GOAL_R, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = '#ffcb05'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(GOAL_CX, goalY, GOAL_R - 5, 0, Math.PI * 2)
      ctx.stroke()
      // Goal label
      ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#f0abfc'
      ctx.fillText('¡OBJETIVO!', GOAL_CX, goalY - GOAL_R - 8)

      // Trajectory preview while charging
      if (chargingRef.current) {
        const pts = trajectoryPoints(powerRef.current)
        ctx.fillStyle = 'rgba(255, 203, 5, 0.8)'
        for (let i = 0; i < pts.length; i += 2) {
          ctx.beginPath()
          ctx.arc(pts[i].x, pts[i].y, 2.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Trail
      trailRef.current.forEach((t, i) => {
        const a = 1 - i / trailRef.current.length
        ctx.beginPath()
        ctx.arc(t.x, t.y, BALL_R * 0.85 * a, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(238, 59, 47, ${0.35 * a})`
        ctx.fill()
      })

      // Poké Ball
      const ball = ballRef.current
      ctx.save()
      ctx.translate(ball.x, ball.y)
      ctx.rotate(ball.rot)
      ctx.beginPath()
      ctx.arc(0, 0, BALL_R, 0, Math.PI)
      ctx.fillStyle = '#f8fafc'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(0, 0, BALL_R, Math.PI, 0)
      ctx.fillStyle = '#ee3b2f'
      ctx.fill()
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(-BALL_R, -1.5, BALL_R * 2, 3)
      ctx.beginPath()
      ctx.arc(0, 0, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#f8fafc'
      ctx.fill()
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(0, 0, BALL_R, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      // Goal flash ring
      const flashElapsed = (performance.now() - goalFlashRef.current) / 700
      if (flashElapsed >= 0 && flashElapsed < 1) {
        const r = GOAL_R + 6 + flashElapsed * 60
        ctx.beginPath()
        ctx.arc(GOAL_CX, goalY, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 203, 5, ${1 - flashElapsed})`
        ctx.lineWidth = 4
        ctx.stroke()
      }

      // Particles
      for (const pt of particlesRef.current) {
        const a = Math.max(0, pt.life / pt.maxLife)
        ctx.globalAlpha = a
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, pt.size * a, 0, Math.PI * 2)
        ctx.fillStyle = pt.color
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const loop = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      update(dt)
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

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
          <div style={{ width: '100%', height: '24px', background: 'rgba(0,0,0,0.45)', borderRadius: '12px', overflow: 'hidden', border: '2px solid #3f3f6e', position: 'relative' }}>
            <div
              style={{
                height: '100%',
                width: `${power * 100}%`,
                background: 'linear-gradient(90deg, #34d399 0%, #ffcb05 55%, #ff8a80 100%)',
                boxShadow: '0 0 12px rgba(255, 203, 5, 0.6)',
              }}
            />
            <span
              style={{
                position: 'absolute',
                top: '-3px',
                bottom: '-3px',
                width: '4px',
                background: '#f8fafc',
                left: `${power * 100}%`,
                borderRadius: '2px',
                boxShadow: '0 0 6px #fff',
              }}
            />
          </div>
          <button
            className="cta"
            type="button"
            onPointerDown={startCharge}
            onPointerUp={release}
            onPointerLeave={release}
            style={{ width: '100%', background: '#ee3b2f', color: '#fff', touchAction: 'none', userSelect: 'none' }}
          >
            {charging ? `⚾ Cargando... ${Math.round(power * 100)}%` : 'Mantén pulsado para lanzar'}
          </button>
          <p style={{ color: '#7d7ab5', fontSize: '0.72rem', margin: 0, textAlign: 'center' }}>
            Suelta cuando la trayectoria apunte al aro dorado 🎯
          </p>
        </div>
      )}
      {result !== null && (
        <div style={{ textAlign: 'center', animation: 'slideInRight 0.4s ease' }}>
          <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.1rem', margin: 0 }}>
            {msg}
          </p>
          <p style={{ color: '#f0abfc', fontWeight: 'bold', fontSize: '1.4rem', margin: '0.25rem 0 0' }}>
            {result} pts
          </p>
        </div>
      )}
    </div>
  )
}
