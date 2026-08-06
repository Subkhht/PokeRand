import { useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'
import { FISH_POOL, randomFrom, spriteUrl, type DexEntry } from './pokeData'
import { t } from '../game/i18n'

const W = 420
const H = 300
const WATER_Y = 150
const CASTS = 6
const TELEGRAPH = 0.6
const SINK_WINDOW = 0.7
const BOB_X = 200

type Phase = 'idle' | 'bob' | 'telegraph' | 'sink' | 'caught' | 'missed' | 'escaped'

export default function Fishing({ onComplete }: CasinoMinigameProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const startedRef = useRef(false)
  const finishedRef = useRef(false)
  const phaseRef = useRef<Phase>('idle')
  const castRef = useRef(1)
  const castElapsedRef = useRef(0)
  const bobDurRef = useRef(1.6)
  const scoreRef = useRef(0)
  const lastCatchRef = useRef<DexEntry | null>(null)
  const splashesRef = useRef<Array<{ x: number; y: number; r: number; life: number }>>([])

  const [phase, setPhase] = useState<Phase>('idle')
  const [cast, setCast] = useState(1)
  const [score, setScore] = useState(0)
  const [lastCatch, setLastCatch] = useState<DexEntry | null>(null)
  const [result, setResult] = useState<number | null>(null)
  const [started, setStarted] = useState(false)

  const syncPhase = (p: Phase): void => {
    phaseRef.current = p
    setPhase(p)
  }

  const startCast = (): void => {
    castElapsedRef.current = 0
    bobDurRef.current = 1.2 + Math.random() * 1.0
    syncPhase('bob')
  }

  const advanceCast = (): void => {
    if (castRef.current >= CASTS) {
      finishedRef.current = true
      const finalScore = Math.min(1000, scoreRef.current)
      setResult(finalScore)
      setTimeout(() => onCompleteRef.current(finalScore), 800)
    } else {
      castRef.current += 1
      setCast(castRef.current)
      startCast()
    }
  }

  const hook = (): void => {
    if (!startedRef.current || finishedRef.current || result !== null) return
    const ph = phaseRef.current
    if (ph === 'sink') {
      const sinkStart = bobDurRef.current + TELEGRAPH
      const mid = sinkStart + SINK_WINDOW / 2
      const precision = Math.max(0, 1 - Math.abs(castElapsedRef.current - mid) / (SINK_WINDOW / 2))
      const pts = 60 + Math.round(precision * 140)
      scoreRef.current += pts
      const poke = randomFrom(FISH_POOL)
      lastCatchRef.current = poke
      setLastCatch(poke)
      setScore(scoreRef.current)
      for (let i = 0; i < 10; i++) {
        splashesRef.current.push({ x: BOB_X + (Math.random() - 0.5) * 40, y: WATER_Y, r: 4 + Math.random() * 14, life: 0.6 })
      }
      syncPhase('caught')
      playEvolution()
      setTimeout(advanceCast, 1200)
    } else if (ph === 'bob' || ph === 'telegraph') {
      syncPhase('missed')
      playHit()
      setTimeout(advanceCast, 900)
    }
  }

  const start = (): void => {
    playClick()
    startedRef.current = true
    finishedRef.current = false
    scoreRef.current = 0
    setScore(0)
    castRef.current = 1
    setCast(1)
    setResult(null)
    setLastCatch(null)
    lastCatchRef.current = null
    splashesRef.current = []
    setStarted(true)
    startCast()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()

    const update = (dt: number): void => {
      if (!startedRef.current || finishedRef.current) return
      if (phaseRef.current === 'bob' || phaseRef.current === 'telegraph') {
        castElapsedRef.current += dt
        if (phaseRef.current === 'bob' && castElapsedRef.current >= bobDurRef.current) {
          syncPhase('telegraph')
        } else if (phaseRef.current === 'telegraph' && castElapsedRef.current >= bobDurRef.current + TELEGRAPH) {
          syncPhase('sink')
        }
      } else if (phaseRef.current === 'sink') {
        castElapsedRef.current += dt
        if (castElapsedRef.current >= bobDurRef.current + TELEGRAPH + SINK_WINDOW) {
          syncPhase('escaped')
          playHit()
          setTimeout(advanceCast, 900)
        }
      }
      const sp = splashesRef.current
      for (let i = sp.length - 1; i >= 0; i--) {
        sp[i].life -= dt
        sp[i].r += 30 * dt
        if (sp[i].life <= 0) sp.splice(i, 1)
      }
    }

    const bobY = (t: number): number => {
      const ph = phaseRef.current
      if (ph === 'sink' || ph === 'caught' || ph === 'escaped' || ph === 'missed') {
        return WATER_Y + 16
      }
      const speed = ph === 'telegraph' ? 9 : 6
      return WATER_Y + Math.sin(t * speed) * 3
    }

    const draw = (now: number): void => {
      ctx.clearRect(0, 0, W, H)
      const t = now / 1000

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, WATER_Y)
      sky.addColorStop(0, '#0f1830')
      sky.addColorStop(1, '#1d3a66')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, WATER_Y)

      // Stars
      for (let i = 0; i < 24; i++) {
        const sx = (i * 97.3) % W
        const sy = (i * 53.7) % (WATER_Y - 30)
        const a = 0.3 + 0.4 * Math.sin(t * 2 + i)
        ctx.beginPath()
        ctx.arc(sx, sy, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(230, 240, 255, ${a})`
        ctx.fill()
      }

      // Moon
      ctx.beginPath()
      ctx.arc(W - 60, 40, 18, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(248, 240, 190, 0.85)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(W - 54, 34, 17, 0, Math.PI * 2)
      ctx.fillStyle = '#1d3a66'
      ctx.fill()

      // Water
      const water = ctx.createLinearGradient(0, WATER_Y, 0, H)
      water.addColorStop(0, '#1f5f86')
      water.addColorStop(1, '#0b2038')
      ctx.fillStyle = water
      ctx.fillRect(0, WATER_Y, W, H - WATER_Y)

      // Surface waves
      ctx.strokeStyle = 'rgba(180, 230, 255, 0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let x = 0; x <= W; x += 4) {
        const y = WATER_Y + Math.sin(x * 0.05 + t * 2.2) * 3
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Underwater subtle lines
      ctx.strokeStyle = 'rgba(90, 160, 210, 0.18)'
      ctx.lineWidth = 1.5
      for (let i = 0; i < 3; i++) {
        const base = WATER_Y + 40 + i * 32
        ctx.beginPath()
        for (let x = 0; x <= W; x += 6) {
          const y = base + Math.sin(x * 0.04 + t + i) * 4
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // Fishing rod silhouette (top-left)
      ctx.strokeStyle = '#8a6a3a'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-10, H)
      ctx.quadraticCurveTo(20, 60, 60, 14)
      ctx.stroke()
      ctx.lineWidth = 3
      ctx.strokeStyle = '#c9a06b'
      ctx.beginPath()
      ctx.moveTo(58, 18)
      ctx.quadraticCurveTo(90, 8, 108, 10)
      ctx.stroke()

      // Fishing line
      const by = bobY(t)
      ctx.strokeStyle = 'rgba(230, 240, 255, 0.7)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(108, 10)
      ctx.quadraticCurveTo(150, by - 30, BOB_X, by - 12)
      ctx.stroke()

      // Bubbles during telegraph
      if (phaseRef.current === 'telegraph') {
        const local = castElapsedRef.current - bobDurRef.current
        for (let i = 0; i < 6; i++) {
          const bt = local + i * 0.09
          const bx = BOB_X + Math.sin(i * 2.7) * 10
          const prog = ((bt % 0.7) / 0.7)
          const byy = WATER_Y - prog * 26
          ctx.beginPath()
          ctx.arc(bx, byy, 2.5 - prog * 1.2, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(200, 240, 255, ${1 - prog})`
          ctx.stroke()
        }
      }

      // Ripple around bobber
      const rippleR = 10 + Math.sin(t * 5) * 3
      ctx.beginPath()
      ctx.ellipse(BOB_X, WATER_Y + 4, rippleR, rippleR * 0.4, 0, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(200, 240, 255, 0.4)'
      ctx.stroke()

      // Bobber
      ctx.save()
      ctx.translate(BOB_X, by)
      const scale = phaseRef.current === 'sink' || phaseRef.current === 'caught' || phaseRef.current === 'escaped' ? 0.8 : 1
      ctx.scale(scale, scale)
      ctx.beginPath()
      ctx.arc(0, 0, 9, 0, Math.PI)
      ctx.fillStyle = '#f8fafc'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(0, 0, 9, Math.PI, 0)
      ctx.fillStyle = '#ee3b2f'
      ctx.fill()
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(-9, -1.2, 18, 2.4)
      ctx.beginPath()
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2)
      ctx.fillStyle = '#f8fafc'
      ctx.fill()
      ctx.restore()

      // Splash particles
      for (const sp of splashesRef.current) {
        ctx.beginPath()
        ctx.arc(sp.x, sp.y - sp.r * 0.3, Math.max(1, sp.r * 0.35), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 240, 255, ${Math.max(0, sp.life / 0.6)})`
        ctx.fill()
      }
    }

    const loop = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      update(dt)
      draw(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '1.25rem 1rem 1rem' }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={() => { playClick(); hook() }}
        style={{ width: 'min(100%, 420px)', height: 'auto', border: '2px solid #3a7ab5', borderRadius: '12px', touchAction: 'none', cursor: 'pointer' }}
      />
      {result === null && (
        <>
          {!started ? (
            <button className="cta" type="button" onClick={start} style={{ background: '#60a5fa', color: '#0b1020' }}>
              🎣 ¡Empezar a pescar!
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>
                Lanzamiento {cast}/{CASTS} · Puntos: <strong style={{ color: '#ffcb05' }}>{score}</strong>
              </p>
              <button
                className="cta"
                type="button"
                onClick={() => { playClick(); hook() }}
                disabled={phase === 'caught' || phase === 'missed' || phase === 'escaped'}
                style={{ width: 'min(100%, 260px)', background: '#ee3b2f', color: '#fff' }}
              >
                🎣 ¡Recoger!
              </button>
              {phase === 'caught' && lastCatch && (
                <div style={{ textAlign: 'center', animation: 'casinoWhackPop 0.4s ease' }}>
                  <img
                    src={spriteUrl(lastCatch.id)}
                    alt={lastCatch.name}
                    style={{ width: '64px', height: '64px', imageRendering: 'pixelated' }}
                  />
                  <p style={{ color: '#34d399', fontWeight: 'bold', fontSize: '0.95rem', margin: '2px 0 0', textTransform: 'capitalize' }}>
                    {t('mg.fishing.caught', { name: lastCatch.name })}
                  </p>
                </div>
              )}
              {phase === 'missed' && (
                <p style={{ color: '#f59e0b', fontSize: '0.9rem', margin: 0, animation: 'casinoSlideUp 0.3s ease' }}>
                  {t('mg.fishing.early')}
                </p>
              )}
              {phase === 'escaped' && (
                <p style={{ color: '#ff8a80', fontSize: '0.9rem', margin: 0, animation: 'casinoSlideUp 0.3s ease' }}>
                  {t('mg.fishing.escaped')}
                </p>
              )}
            </div>
          )}
        </>
      )}
      {result !== null && (
        <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
          {result >= 800 ? '🎣 ¡Pesca legendaria!' : result >= 400 ? '🐟 ¡Buen pescador!' : '💧 ¡Casi, sigue intentándolo!'} · {result} pts
        </p>
      )}
    </div>
  )
}
