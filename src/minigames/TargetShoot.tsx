import { useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'

interface Target {
  id: number
  x: number
  y: number
  r: number
  ttl: number
  points: number
}

const W = 460
const H = 320
const GAME_TIME = 8
const MAX_TARGETS = 3

export default function TargetShoot({ onComplete }: CasinoMinigameProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const targetsRef = useRef<Target[]>([])
  const nextIdRef = useRef(0)
  const timeLeftRef = useRef(GAME_TIME)
  const hitsRef = useRef(0)
  const scoreRef = useRef(0)
  const startedRef = useRef(false)
  const finishedRef = useRef(false)

  const [timeLeft, setTimeLeft] = useState(GAME_TIME)
  const [started, setStarted] = useState(false)
  const [result, setResult] = useState<number | null>(null)

  const start = (): void => {
    if (started) return
    playClick()
    startedRef.current = true
    setStarted(true)
    targetsRef.current = []
    nextIdRef.current = 0
    timeLeftRef.current = GAME_TIME
    hitsRef.current = 0
    scoreRef.current = 0
    finishedRef.current = false
    spawnTarget(true)
  }

  const spawnTarget = (big = false): void => {
    const r = big ? 26 : 12 + Math.random() * 12
    targetsRef.current.push({
      id: nextIdRef.current++,
      x: 40 + Math.random() * (W - 80),
      y: 30 + Math.random() * (H - 90),
      r,
      ttl: 1.3 + Math.random() * 0.7,
      points: big ? 200 : Math.round((1 - (r - 12) / 24) * 150 + 60),
    })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    let spawnTimer = 0

    const update = (dt: number): void => {
      if (!startedRef.current || finishedRef.current) return
      timeLeftRef.current -= dt
      setTimeLeft(Math.max(0, timeLeftRef.current))
      if (timeLeftRef.current <= 0) {
        finishedRef.current = true
        playEvolution()
        const score = Math.min(1000, Math.round(scoreRef.current))
        setResult(score)
        setTimeout(() => onComplete(score), 800)
        return
      }
      targetsRef.current = targetsRef.current.filter(t => (t.ttl -= dt) > 0)
      if (targetsRef.current.length < MAX_TARGETS) {
        spawnTimer -= dt
        if (spawnTimer <= 0) {
          spawnTarget(false)
          spawnTimer = 0.35
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

      for (const t of targetsRef.current) {
        const alpha = Math.min(1, t.ttl / 0.3)
        ctx.globalAlpha = alpha
        ctx.fillStyle = t.r > 22 ? '#ff8a33' : '#ffcb05'
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = t.r > 22 ? '#fff' : '#000'
        ctx.font = `bold ${Math.max(8, t.r / 2)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(t.points), t.x, t.y)
        ctx.globalAlpha = 1
      }

      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(`⏱ ${Math.ceil(timeLeftRef.current)}s`, 12, 10)
      ctx.textAlign = 'right'
      ctx.fillText(`🎯 ${scoreRef.current}`, W - 12, 10)
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

  const shoot = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!startedRef.current || finishedRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (W / rect.width)
    const y = (e.clientY - rect.top) * (H / rect.height)
    const targets = targetsRef.current
    let best = -1
    let bestDist = Infinity
    targets.forEach((t, i) => {
      const d = Math.hypot(t.x - x, t.y - y)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    if (best !== -1 && bestDist < targets[best].r) {
      const t = targets[best]
      hitsRef.current++
      scoreRef.current += t.points
      targets.splice(best, 1)
      playHit()
    } else {
      playClick()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '1.25rem 1rem 1rem' }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={shoot}
        style={{ width: 'min(100%, 460px)', height: 'auto', border: '2px solid #7c5fd6', borderRadius: '12px', cursor: started && result === null ? 'crosshair' : 'default', touchAction: 'none' }}
      />
      {!started && result === null && (
        <button className="cta" type="button" onClick={start} style={{ background: '#f0abfc', color: '#1a1033' }}>
          🎯 ¡Empezar!
        </button>
      )}
      {started && result === null && <p style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>⏱ Tiempo restante: {Math.ceil(timeLeft)}s · Haz clic en las dianas</p>}
      {result !== null && (
        <div style={{ textAlign: 'center', animation: 'casinoSlideUp 0.4s ease' }}>
          <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0 }}>
            {result >= 800 ? '🏆 ¡Apunta como un sniper!' : `¡${result} puntos!`}
          </p>
        </div>
      )}
    </div>
  )
}
