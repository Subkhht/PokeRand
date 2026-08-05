import { useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'

const W = 420
const H = 300
const GROUND_Y = 262
const BASKET_W = 84
const BASKET_H = 34
const GAME_TIME = 30

interface FallingItem {
  x: number
  y: number
  vy: number
  kind: 'coin' | 'bonus' | 'bomb'
  wobble: number
  phase: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
  size: number
}

export default function CatchCoins({ onComplete }: CasinoMinigameProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const startedRef = useRef(false)
  const finishedRef = useRef(false)
  const timeRef = useRef(GAME_TIME)
  const scoreRef = useRef(0)
  const basketXRef = useRef(W / 2)
  const keysRef = useRef<Set<string>>(new Set())
  const itemsRef = useRef<FallingItem[]>([])
  const particlesRef = useRef<Particle[]>([])
  const spawnAccRef = useRef(0)
  const shakeRef = useRef(0)

  const [started, setStarted] = useState(false)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_TIME)
  const [result, setResult] = useState<number | null>(null)

  const start = (): void => {
    playClick()
    startedRef.current = true
    finishedRef.current = false
    timeRef.current = GAME_TIME
    setTimeLeft(GAME_TIME)
    scoreRef.current = 0
    setScore(0)
    itemsRef.current = []
    particlesRef.current = []
    spawnAccRef.current = 0
    basketXRef.current = W / 2
    shakeRef.current = 0
    setResult(null)
    setStarted(true)
  }

  const spawnItem = (): void => {
    const roll = Math.random()
    const kind: FallingItem['kind'] = roll < 0.6 ? 'coin' : roll < 0.75 ? 'bonus' : 'bomb'
    itemsRef.current.push({
      x: 30 + Math.random() * (W - 60),
      y: -20,
      vy: 85 + Math.random() * 60,
      kind,
      wobble: Math.random() * 30,
      phase: Math.random() * Math.PI * 2,
    })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()

    const update = (dt: number): void => {
      // Keyboard movement
      const speed = 280
      if (keysRef.current.has('ArrowLeft') || keysRef.current.has('a')) basketXRef.current -= speed * dt
      if (keysRef.current.has('ArrowRight') || keysRef.current.has('d')) basketXRef.current += speed * dt
      basketXRef.current = Math.max(BASKET_W / 2, Math.min(W - BASKET_W / 2, basketXRef.current))

      if (startedRef.current && !finishedRef.current) {
        timeRef.current -= dt
        setTimeLeft(Math.max(0, Math.ceil(timeRef.current)))
        if (timeRef.current <= 0) {
          finishedRef.current = true
          playEvolution()
          const finalScore = Math.min(1000, Math.round(scoreRef.current))
          setResult(finalScore)
          setTimeout(() => onCompleteRef.current(finalScore), 800)
        }

        spawnAccRef.current += dt
        if (spawnAccRef.current >= 0.45) {
          spawnAccRef.current = 0
          spawnItem()
        }

        const items = itemsRef.current
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i]
          it.y += it.vy * dt
          it.phase += dt * 3
          const basketY = GROUND_Y - BASKET_H / 2
          if (it.y >= basketY) {
            const overlap = Math.abs(it.x - basketXRef.current) < BASKET_W / 2 - 4
            if (overlap) {
              if (it.kind === 'coin') {
                scoreRef.current += 10
                burst(it.x, basketY, '#ffcb05', 8)
              } else if (it.kind === 'bonus') {
                scoreRef.current += 30
                burst(it.x, basketY, '#f0abfc', 12)
                playEvolution()
              } else {
                scoreRef.current -= 50
                burst(it.x, basketY, '#ff5252', 14)
                shakeRef.current = 0.3
                playHit()
              }
              setScore(scoreRef.current)
              items.splice(i, 1)
            } else {
              if (it.kind === 'bomb') {
                scoreRef.current -= 20
                burst(it.x, GROUND_Y, '#ff8a80', 10)
                shakeRef.current = 0.2
                playHit()
                setScore(scoreRef.current)
              }
              items.splice(i, 1)
            }
          } else if (it.y > H + 20) {
            items.splice(i, 1)
          }
        }

        const parts = particlesRef.current
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]
          p.life -= dt
          if (p.life <= 0) { parts.splice(i, 1); continue }
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.vy += 260 * dt
        }

        if (shakeRef.current > 0) shakeRef.current -= dt
      }
    }

    const burst = (x: number, y: number, color: string, count: number): void => {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2
        const spd = 60 + Math.random() * 120
        particlesRef.current.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 60,
          life: 0.5 + Math.random() * 0.4,
          color,
          size: 2.5 + Math.random() * 3,
        })
      }
    }

    const draw = (): void => {
      ctx.clearRect(0, 0, W, H)
      const shakeX = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current * 40 : 0
      const shakeY = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current * 30 : 0
      ctx.save()
      ctx.translate(shakeX, shakeY)

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
      sky.addColorStop(0, '#1a1033')
      sky.addColorStop(1, '#3a2060')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, GROUND_Y)

      // Stars
      for (let i = 0; i < 22; i++) {
        const sx = (i * 83.7) % W
        const sy = (i * 47.3) % (GROUND_Y - 30)
        const a = 0.3 + 0.4 * Math.sin(performance.now() / 900 + i)
        ctx.beginPath()
        ctx.arc(sx, sy, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(240, 235, 255, ${a})`
        ctx.fill()
      }

      // Ground
      ctx.fillStyle = '#163b22'
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
      ctx.fillStyle = '#34d399'
      ctx.fillRect(0, GROUND_Y, W, 3)

      // Items
      for (const it of itemsRef.current) {
        const wob = Math.sin(it.phase) * it.wobble
        const x = it.x + wob
        if (it.kind === 'coin') {
          ctx.beginPath()
          ctx.arc(x, it.y, 9, 0, Math.PI * 2)
          ctx.fillStyle = '#ffcb05'
          ctx.fill()
          ctx.strokeStyle = '#b8860b'
          ctx.lineWidth = 2
          ctx.stroke()
          ctx.font = 'bold 10px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#7a5200'
          ctx.fillText('$', x, it.y + 1)
        } else if (it.kind === 'bonus') {
          ctx.font = '22px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('⭐', x, it.y)
          ctx.beginPath()
          ctx.arc(x, it.y, 16, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(240,171,252,0.6)'
          ctx.stroke()
        } else {
          ctx.font = '22px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('💣', x, it.y)
        }
      }

      // Basket
      const bx = basketXRef.current
      const by = GROUND_Y - BASKET_H / 2
      ctx.fillStyle = '#8a5a2b'
      ctx.strokeStyle = '#5c3a1c'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(bx - BASKET_W / 2, by - 10)
      ctx.lineTo(bx + BASKET_W / 2, by - 10)
      ctx.lineTo(bx + BASKET_W / 2 - 8, by + BASKET_H / 2)
      ctx.lineTo(bx - BASKET_W / 2 + 8, by + BASKET_H / 2)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      // Rim
      ctx.fillStyle = '#ffcb05'
      ctx.fillRect(bx - BASKET_W / 2, by - 12, BASKET_W, 5)

      // Particles
      for (const p of particlesRef.current) {
        const a = Math.max(0, p.life / 0.9)
        ctx.globalAlpha = a
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.restore()
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

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      keysRef.current.add(e.key)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault()
    }
    const up = (e: KeyboardEvent): void => {
      keysRef.current.delete(e.key)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '1.25rem 1rem 1rem' }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const scale = W / rect.width
          basketXRef.current = (e.clientX - rect.left) * scale
        }}
        style={{ width: 'min(100%, 420px)', height: 'auto', border: '2px solid #7c5fd6', borderRadius: '12px', touchAction: 'none', cursor: 'pointer' }}
      />
      {result === null && (
        <>
          {!started ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '2.5rem', animation: 'casinoBounce 0.9s ease infinite' }}>🪙</div>
              <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0, maxWidth: '360px' }}>
                Mueve la cesta con el ratón o las flechas ← →. Atrapa monedas 🪙 (+10), estrellas ⭐ (+30) y ¡evita los Voltorb 💣!
              </p>
              <button className="cta" type="button" onClick={start} style={{ background: '#f0abfc', color: '#1a1033' }}>
                🪙 ¡Empezar!
              </button>
            </div>
          ) : (
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>
              ⏱ {timeLeft}s · Puntos: <strong style={{ color: '#ffcb05' }}>{score}</strong>
            </p>
          )}
        </>
      )}
      {result !== null && (
        <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
          {result >= 800 ? '💰 ¡Cesta rebosante!' : result >= 400 ? '🪙 ¡Bueno recogiendo!' : '🧺 ¡Puedes mejorar!'} · {result} pts
        </p>
      )}
    </div>
  )
}
