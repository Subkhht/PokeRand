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

const W = 460
const H = 320
const GROUND_Y = 270
const TARGET_CX = 400
const TARGET_R = 26
const ARROW_R = 7

const LAUNCH_X = 40
const LAUNCH_Y = GROUND_Y - 20
const VX = 280
const GRAVITY = 320

export default function Slingshot({ onComplete }: CasinoMinigameProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const powerRef = useRef(0)
  const chargingRef = useRef(false)
  const flyingRef = useRef(false)
  const arrowRef = useRef<ArrowState>({ x: LAUNCH_X, y: LAUNCH_Y, vy: 0, flying: false, hit: false })
  const minDistRef = useRef(Infinity)
  const scoreRef = useRef<number | null>(null)

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

    const finish = (score: number): void => {
      if (scoreRef.current !== null) return
      scoreRef.current = score
      playEvolution()
      setResult(score)
      setTimeout(() => onComplete(score), 700)
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
          const score = Math.max(200, Math.round(1000 - (dist / (TARGET_R + ARROW_R)) * 700))
          finish(score)
        } else if (arrow.y > GROUND_Y) {
          arrow.hit = true
          arrow.y = GROUND_Y
          const best = minDistRef.current
          const score = best < 60
            ? Math.max(80, Math.round(1000 - (best / 60) * 900))
            : 50
          finish(score)
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

      ctx.fillStyle = 'rgba(250,204,21,0.15)'
      ctx.strokeStyle = '#ffcb05'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(TARGET_CX, targetY, TARGET_R, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(TARGET_CX, targetY, TARGET_R * 0.6, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#ffcb05'
      ctx.beginPath()
      ctx.arc(TARGET_CX, targetY, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#fff'
      ctx.fillText('1000', TARGET_CX, targetY - TARGET_R - 10)

      ctx.fillStyle = '#7c5fd6'
      ctx.fillRect(20, GROUND_Y - 30, 16, 30)
      ctx.fillStyle = '#a78bfa'
      ctx.beginPath()
      ctx.moveTo(36, GROUND_Y)
      ctx.lineTo(20, GROUND_Y - 30)
      ctx.lineTo(20, GROUND_Y)
      ctx.closePath()
      ctx.fill()

      const arrow = arrowRef.current
      const ax = arrow.flying || arrow.hit ? arrow.x : LAUNCH_X
      const ay = arrow.flying || arrow.hit ? arrow.y : GROUND_Y - 24
      ctx.fillStyle = '#ffcb05'
      ctx.strokeStyle = '#c78a00'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(ax, ay, ARROW_R, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
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
