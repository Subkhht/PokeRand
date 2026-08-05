import { useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'

const W = 460
const H = 320
const GROUND_Y = 270
const GOAL_CX = 390
const GOAL_R = 22
const BALL_R = 10

export default function PokeballToss({ onComplete }: CasinoMinigameProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const powerRef = useRef(0)
  const chargingRef = useRef(false)
  const thrownRef = useRef(false)
  const ballRef = useRef({ x: 40, y: GROUND_Y - 24, vx: 0, vy: 0, flying: false, settled: false })
  const powerDirRef = useRef(1)
  const resultRef = useRef<number | null>(null)

  const [power, setPower] = useState(0)
  const [charging, setCharging] = useState(false)
  const [result, setResult] = useState<number | null>(null)

  const startCharge = (): void => {
    if (result !== null || thrownRef.current) return
    playClick()
    chargingRef.current = true
    setCharging(true)
    powerRef.current = 0
    powerDirRef.current = 1
  }

  const release = (): void => {
    if (!chargingRef.current) return
    chargingRef.current = false
    setCharging(false)
    const p = powerRef.current
    thrownRef.current = true
    ballRef.current = { x: 40, y: GROUND_Y - 24, vx: 60 + p * 260, vy: -(30 + p * 160), flying: true, settled: false }
    playHit()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    const goalOffset = Math.random() * 30 - 15

    const update = (dt: number): void => {
      if (chargingRef.current) {
        powerRef.current += powerDirRef.current * dt * 1.1
        if (powerRef.current >= 1) { powerRef.current = 1; powerDirRef.current = -1 }
        if (powerRef.current <= 0) { powerRef.current = 0; powerDirRef.current = 1 }
        setPower(powerRef.current)
      }
      const ball = ballRef.current
      if (ball.flying && !ball.settled) {
        ball.vy += 420 * dt
        ball.x += ball.vx * dt
        ball.y += ball.vy * dt
        const goalY = GROUND_Y - 60 + goalOffset
        const dist = Math.hypot(ball.x - GOAL_CX, ball.y - goalY)
        if (dist < GOAL_R + BALL_R) {
          ball.settled = true
          ball.flying = false
          playEvolution()
          const score = Math.max(100, Math.round(1000 - (dist / (GOAL_R + BALL_R)) * 500))
          resultRef.current = score
          setResult(score)
          setTimeout(() => onComplete(score), 700)
        } else if (ball.y > GROUND_Y - BALL_R) {
          ball.settled = true
          ball.flying = false
          const xDist = Math.abs(ball.x - GOAL_CX)
          const score = Math.max(50, Math.round(1000 - (xDist / (W / 2)) * 700))
          resultRef.current = score
          setResult(score)
          setTimeout(() => onComplete(score), 700)
        }
      }
    }

    const draw = (): void => {
      ctx.clearRect(0, 0, W, H)
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#1a1033')
      bg.addColorStop(1, '#2b1b4d')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      ctx.strokeStyle = '#3f3f6e'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(0, GROUND_Y)
      ctx.lineTo(W, GROUND_Y)
      ctx.stroke()

      const goalY = GROUND_Y - 60 + goalOffset
      ctx.fillStyle = 'rgba(240,171,252,0.15)'
      ctx.strokeStyle = '#f0abfc'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(GOAL_CX, goalY, GOAL_R, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#f0abfc'
      ctx.fillText('1000', GOAL_CX, goalY - 30)

      const ball = ballRef.current
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2)
      ctx.fillStyle = '#ee3b2f'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, BALL_R, Math.PI, 0)
      ctx.fillStyle = '#f8fafc'
      ctx.fill()
      ctx.fillStyle = '#1a1033'
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, 2.5, 0, Math.PI * 2)
      ctx.fill()
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
  }, [result, onComplete])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px', padding: '1.25rem 1rem 1rem' }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: 'min(100%, 460px)', height: 'auto', border: '2px solid #7c5fd6', borderRadius: '12px', touchAction: 'none' }}
      />
      {result === null && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%', maxWidth: '380px' }}>
          <div style={{ width: '100%', height: '22px', background: 'rgba(0,0,0,0.4)', borderRadius: '11px', overflow: 'hidden', border: '1px solid #3f3f6e' }}>
            <div
              style={{
                height: '100%',
                width: `${power * 100}%`,
                background: power > 0.85 ? '#ff8a80' : power > 0.6 ? '#ffcb05' : '#34d399',
                transition: 'width 0.05s linear',
                boxShadow: '0 0 10px currentColor',
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
        </div>
      )}
      {result !== null && (
        <div style={{ textAlign: 'center', animation: 'casinoSlideUp 0.4s ease' }}>
          <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0 }}>
            {result >= 800 ? '⚾ ¡Captura perfecta!' : `¡${result} puntos!`}
          </p>
        </div>
      )}
    </div>
  )
}
