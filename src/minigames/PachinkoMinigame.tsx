import { useEffect, useRef, useState, type JSX } from 'react'
import { playClick, playHit } from '../game/sound'
import boardBgUrl from '../assets/poke-pinball.png'

interface Peg {
  x: number
  y: number
  r: number
}

interface SlotCell {
  x: number
  y: number
  ring: number
  score: number
}

interface PachinkoMinigameProps {
  onComplete: (score: number) => void
}

const W = 530
const H = 700
const CX = W / 2
const BALL_R = 9
const GRAVITY = 1500
const RESTITUTION = 0.72
const APEX_Y = 602

const SLOT_COUNT = 9
const SLOT_W = 50
const WALL_W = 6
const FLOOR_Y = H - 8
const WALL_H = 34
const WALL_TOP = FLOOR_Y - WALL_H
const SLOT_TOP = FLOOR_Y - 52
const TOTAL_W = SLOT_COUNT * SLOT_W + (SLOT_COUNT - 1) * WALL_W
const SLOT_LEFT = CX - TOTAL_W / 2
const SLOT_RIGHT = SLOT_LEFT + TOTAL_W

const SCORES = [1000, 500, 250, 100, 50]

const RING_COLORS = [
  { bg: 'rgba(250, 204, 21, 0.35)', stroke: '#facc15', text: '#fff7cc' },
  { bg: 'rgba(192, 132, 252, 0.30)', stroke: '#c084fc', text: '#e9d5ff' },
  { bg: 'rgba(96, 165, 250, 0.28)', stroke: '#60a5fa', text: '#bfdbfe' },
  { bg: 'rgba(148, 163, 184, 0.25)', stroke: '#94a3b8', text: '#cbd5e1' },
  { bg: 'rgba(100, 116, 139, 0.25)', stroke: '#64748b', text: '#94a3b8' },
]

function buildPegs(): Peg[] {
  const pegs: Peg[] = []
  const spacing = 40
  const vSpacing = 38
  const topY = 70
  const rows = Math.round((APEX_Y - 18 - topY) / vSpacing) + 1
  const margin = 10
  const count = Math.floor((SLOT_RIGHT - SLOT_LEFT - 2 * margin) / spacing) + 2
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1)
    const y = topY + (APEX_Y - 18 - topY) * t
    const offset = (i % 2) * (spacing / 2)
    const startX = CX - ((count - 1) * spacing) / 2 + offset - 1
    for (let c = 0; c < count; c++) {
      const x = startX + c * spacing
      pegs.push({ x, y, r: 7 })
    }
  }
  return pegs
}

function buildSlots(): SlotCell[] {
  const cells: SlotCell[] = []
  const center = Math.floor(SLOT_COUNT / 2)
  for (let i = 0; i < SLOT_COUNT; i++) {
    const x = SLOT_LEFT + i * (SLOT_W + WALL_W) + SLOT_W / 2
    const ring = Math.abs(i - center)
    cells.push({ x, y: (WALL_TOP + FLOOR_Y) / 2, ring, score: SCORES[ring] })
  }
  return cells
}

function buildWalls(): number[] {
  const walls: number[] = []
  for (let k = 0; k < SLOT_COUNT - 1; k++) {
    walls.push(SLOT_LEFT + k * (SLOT_W + WALL_W) + SLOT_W + WALL_W / 2)
  }
  return walls
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function nearestSlot(x: number, slots: SlotCell[]): SlotCell {
  let near = slots[0]
  let best = Math.abs(x - near.x)
  for (const cell of slots) {
    const d = Math.abs(x - cell.x)
    if (d < best) {
      best = d
      near = cell
    }
  }
  return near
}

export default function PachinkoMinigame({ onComplete }: PachinkoMinigameProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const phaseRef = useRef<'aim' | 'dropping' | 'settled'>('aim')
  const ballRef = useRef({ x: CX, y: 24, vx: 0, vy: 0 })
  const settleTimerRef = useRef(0)
  const stuckTimerRef = useRef(0)
  const lastHitRef = useRef(0)
  const aimXRef = useRef(CX)
  const scoreRef = useRef<number | null>(null)
  const pegsRef = useRef(buildPegs())
  const slotsRef = useRef(buildSlots())
  const wallsRef = useRef(buildWalls())

  const [phase, setPhase] = useState<'aim' | 'dropping' | 'settled'>('aim')
  const [score, setScore] = useState<number | null>(null)
  const [stuckMsg, setStuckMsg] = useState(false)

  const resetThrow = (): void => {
    ballRef.current = { x: CX, y: 24, vx: 0, vy: 0 }
    settleTimerRef.current = 0
    stuckTimerRef.current = 0
    scoreRef.current = null
    phaseRef.current = 'aim'
    setPhase('aim')
    setStuckMsg(true)
    setTimeout(() => setStuckMsg(false), 1500)
  }

  const releaseBall = (x: number): void => {
    if (phaseRef.current !== 'aim') return
    playClick()
    const clamped = Math.max(SLOT_LEFT + 20, Math.min(SLOT_RIGHT - 20, x))
    ballRef.current = { x: clamped, y: 24, vx: (Math.random() - 0.5) * 40, vy: 0 }
    settleTimerRef.current = 0
    stuckTimerRef.current = 0
    scoreRef.current = null
    phaseRef.current = 'dropping'
    setPhase('dropping')
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    let raf = 0
    let last = performance.now()
    const boardBg = new Image()
    boardBg.src = boardBgUrl
    let bgLoaded = false
    boardBg.onload = () => { bgLoaded = true }

    const settleBall = (): void => {
      const near = nearestSlot(ballRef.current.x, slotsRef.current)
      const ball = ballRef.current
      ball.x = near.x
      ball.y = FLOOR_Y - BALL_R
      ball.vx = 0
      ball.vy = 0
      scoreRef.current = near.score
      phaseRef.current = 'settled'
      setPhase('settled')
      setScore(near.score)
      setTimeout(() => onComplete(near.score), 600)
    }

    const update = (dt: number): void => {
      if (phaseRef.current !== 'dropping') return
      const ball = ballRef.current
      const sub = 8
      const h = dt / sub
      let settling = false
      for (let s = 0; s < sub; s++) {
        ball.vy += GRAVITY * h
        ball.x += ball.vx * h
        ball.y += ball.vy * h

        if (ball.x < SLOT_LEFT + BALL_R) {
          ball.x = SLOT_LEFT + BALL_R
          ball.vx = Math.abs(ball.vx) * RESTITUTION
        }
        if (ball.x > SLOT_RIGHT - BALL_R) {
          ball.x = SLOT_RIGHT - BALL_R
          ball.vx = -Math.abs(ball.vx) * RESTITUTION
        }

        for (const p of pegsRef.current) {
          const dx = ball.x - p.x
          const dy = ball.y - p.y
          const dist = Math.hypot(dx, dy)
          const min = BALL_R + p.r
          if (dist < min && dist > 0) {
            const nx = dx / dist
            const ny = dy / dist
            ball.x = p.x + nx * min
            ball.y = p.y + ny * min
            const vn = ball.vx * nx + ball.vy * ny
            if (vn < 0) {
              ball.vx -= (1 + RESTITUTION) * vn * nx
              ball.vy -= (1 + RESTITUTION) * vn * ny
              ball.vx += (Math.random() - 0.5) * 30
              const now = performance.now()
              if (now - lastHitRef.current > 45) {
                playHit()
                lastHitRef.current = now
              }
            }
          }
        }

        for (const wx of wallsRef.current) {
          if (ball.y + BALL_R > WALL_TOP && ball.y - BALL_R < FLOOR_Y) {
            const half = WALL_W / 2 + BALL_R
            if (Math.abs(ball.x - wx) < half) {
              if (ball.x < wx) {
                ball.x = wx - half
                ball.vx = Math.abs(ball.vx) * RESTITUTION
              } else {
                ball.x = wx + half
                ball.vx = -Math.abs(ball.vx) * RESTITUTION
              }
            }
          }
        }

        if (ball.y > FLOOR_Y - BALL_R) {
          ball.y = FLOOR_Y - BALL_R
          ball.vy = -Math.abs(ball.vy) * RESTITUTION
          ball.vx *= 0.9
        }

        if (ball.y > SLOT_TOP - 6) {
          stuckTimerRef.current = 0
          const speed = Math.hypot(ball.vx, ball.vy)
          if (speed < 5) {
            settleTimerRef.current += h
            if (settleTimerRef.current > 0.3) {
              settleBall()
              settling = true
              break
            }
          } else {
            settleTimerRef.current = 0
          }
        } else {
          settleTimerRef.current = 0
          const speed = Math.hypot(ball.vx, ball.vy)
          if (speed < 25) {
            stuckTimerRef.current += dt
            if (stuckTimerRef.current > 1.2) {
              resetThrow()
              return
            }
          } else {
            stuckTimerRef.current = 0
          }
        }
      }
      if (settling) return
    }

    const draw = (): void => {
      ctx.clearRect(0, 0, W, H)
      if (bgLoaded) {
        ctx.drawImage(boardBg, 0, 0, W, H)
      } else {
        const bg = ctx.createLinearGradient(0, 0, 0, H)
        bg.addColorStop(0, '#1a1033')
        bg.addColorStop(1, '#2b1b4d')
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, W, H)
      }

      for (const s of slotsRef.current) {
        const col = RING_COLORS[s.ring]
        ctx.fillStyle = col.bg
        ctx.strokeStyle = col.stroke
        ctx.lineWidth = 2
        roundRect(ctx, s.x - SLOT_W / 2 + 1, WALL_TOP, SLOT_W - 2, FLOOR_Y - WALL_TOP, 6)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#000000'
        ctx.font = 'bold 15px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(s.score), s.x, s.y)
      }

      for (const wx of wallsRef.current) {
        const wallG = ctx.createLinearGradient(wx - WALL_W / 2, 0, wx + WALL_W / 2, 0)
        wallG.addColorStop(0, '#5b4a8a')
        wallG.addColorStop(0.5, '#8b79c9')
        wallG.addColorStop(1, '#5b4a8a')
        ctx.fillStyle = wallG
        roundRect(ctx, wx - WALL_W / 2, WALL_TOP, WALL_W, FLOOR_Y - WALL_TOP, 2)
        ctx.fill()
      }

      for (const p of pegsRef.current) {
        const g = ctx.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, p.r)
        g.addColorStop(0, '#ffffff')
        g.addColorStop(0.3, '#c9b8ff')
        g.addColorStop(1, '#7c5fd6')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }

      if (phaseRef.current === 'aim') {
        ctx.globalAlpha = 0.4
        const g2 = ctx.createRadialGradient(aimXRef.current - 3, 21, 1, aimXRef.current, 24, BALL_R)
        g2.addColorStop(0, '#fff7cc')
        g2.addColorStop(1, '#c78a00')
        ctx.fillStyle = g2
        ctx.beginPath()
        ctx.arc(aimXRef.current, 24, BALL_R, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(aimXRef.current, 24)
        ctx.lineTo(aimXRef.current, APEX_Y)
        ctx.stroke()
        ctx.setLineDash([])
      }

      const b = ballRef.current
      const g3 = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, BALL_R)
      g3.addColorStop(0, '#fff7cc')
      g3.addColorStop(0.5, '#ffcb05')
      g3.addColorStop(1, '#c78a00')
      ctx.fillStyle = g3
      ctx.beginPath()
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2)
      ctx.fill()

      if (scoreRef.current !== null && phaseRef.current === 'settled') {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        roundRect(ctx, CX - 120, 12, 240, 46, 10)
        ctx.fill()
        ctx.fillStyle = '#ffcb05'
        ctx.font = 'bold 18px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`¡Puntuación: ${scoreRef.current}!`, CX, 35)
      }
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
  }, [onComplete])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        {RING_COLORS.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#cbd5e1' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: c.stroke, display: 'inline-block' }} />
            {SCORES[i]} pts
          </span>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const scaleX = W / rect.width
          releaseBall((e.clientX - rect.left) * scaleX)
        }}
        onPointerMove={(e) => {
          if (phaseRef.current !== 'aim') return
          const rect = e.currentTarget.getBoundingClientRect()
          const scaleX = W / rect.width
          aimXRef.current = Math.max(SLOT_LEFT + 20, Math.min(SLOT_RIGHT - 20, (e.clientX - rect.left) * scaleX))
        }}
        style={{
          width: 'min(100%, 530px)',
          height: 'auto',
          border: '2px solid #7c5fd6',
          borderRadius: '12px',
          cursor: phase === 'aim' ? 'crosshair' : 'default',
          touchAction: 'none'
        }}
      />
      {phase === 'aim' && (
        <button className="cta" type="button" onClick={() => releaseBall(CX + (Math.random() - 0.5) * 60)}>
          🎯 Soltar la bola
        </button>
      )}
      {phase === 'dropping' && <p style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Cayendo...</p>}
      {stuckMsg && <p style={{ color: '#ff8a80', fontWeight: 'bold', fontSize: '0.9rem' }}>⚠️ La bola se quedó atascada. ¡Reiniciando tirada!</p>}
      {phase === 'settled' && score !== null && (
        <p style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '1rem' }}>Has obtenido {score} puntos</p>
      )}
    </div>
  )
}
