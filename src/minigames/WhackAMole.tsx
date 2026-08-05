import { useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'

const HOLES = 9
const GAME_TIME = 10
const HOLE_EMOJIS = ['🐭', '🐹', '🐰', '🦊', '🐸', '🐻', '🐤', '🦔', '🐯']

export default function WhackAMole({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [holes, setHoles] = useState<Array<{ active: boolean; emoji: string; bonus: boolean }>>(
    Array.from({ length: HOLES }, () => ({ active: false, emoji: '🕳️', bonus: false }))
  )
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_TIME)
  const [started, setStarted] = useState(false)
  const [result, setResult] = useState<number | null>(null)

  const scoreRef = useRef(0)
  const timeRef = useRef(GAME_TIME)
  const finishedRef = useRef(false)

  const start = (): void => {
    if (started) return
    playClick()
    setStarted(true)
    setScore(0)
    scoreRef.current = 0
    timeRef.current = GAME_TIME
    finishedRef.current = false
    setHoles(Array.from({ length: HOLES }, () => ({ active: false, emoji: '🕳️', bonus: false })))
  }

  const whack = (i: number): void => {
    if (!started || finishedRef.current || result !== null) return
    const hole = holes[i]
    if (!hole.active) {
      playClick()
      return
    }
    playHit()
    const pts = hole.bonus ? 300 : 100
    scoreRef.current += pts
    setScore(scoreRef.current)
    setHoles(prev => {
      const next = [...prev]
      next[i] = { active: false, emoji: '🕳️', bonus: false }
      return next
    })
  }

  useEffect(() => {
    let interval: number | undefined
    let spawnInterval: number | undefined
    if (started && result === null) {
      interval = window.setInterval(() => {
        timeRef.current -= 1
        setTimeLeft(timeRef.current)
        if (timeRef.current <= 0) {
          finishedRef.current = true
          playEvolution()
          const finalScore = Math.min(1000, Math.round(scoreRef.current))
          setResult(finalScore)
          setTimeout(() => onComplete(finalScore), 800)
          if (interval !== undefined) window.clearInterval(interval)
          if (spawnInterval !== undefined) window.clearInterval(spawnInterval)
        }
      }, 1000)
      spawnInterval = window.setInterval(() => {
        setHoles(prev => {
          const next = prev.map(h => ({ ...h }))
          next.forEach((h, idx) => {
            if (!h.active && Math.random() < 0.35) {
              next[idx] = { active: true, emoji: HOLE_EMOJIS[Math.floor(Math.random() * HOLE_EMOJIS.length)], bonus: Math.random() < 0.15 }
            } else if (h.active && Math.random() < 0.25) {
              next[idx] = { active: false, emoji: '🕳️', bonus: false }
            }
          })
          return next
        })
      }, 650)
    }
    return () => {
      if (interval !== undefined) window.clearInterval(interval)
      if (spawnInterval !== undefined) window.clearInterval(spawnInterval)
    }
  }, [started, result, onComplete])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '1.25rem 1rem 1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', maxWidth: '360px', width: '100%' }}>
        {holes.map((hole, i) => (
          <button
            key={i}
            type="button"
            onClick={() => whack(i)}
            disabled={result !== null}
            style={{
              aspectRatio: '1', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.12)',
              background: 'radial-gradient(circle at 50% 30%, #3a2a5c, #241a3d)',
              fontSize: hole.active ? '2.2rem' : '1.4rem',
              cursor: hole.active && result === null ? 'pointer' : 'default',
              transition: 'transform 0.12s ease',
              boxShadow: hole.bonus ? '0 0 20px rgba(255,203,5,0.8)' : 'inset 0 6px 12px rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: hole.active ? 'casinoWhackPop 0.35s ease' : 'none',
              opacity: hole.active ? 1 : 0.6,
            }}
          >
            {hole.active ? (hole.bonus ? <span style={{ animation: 'casinoPulse 0.6s ease infinite' }}>⭐ {hole.emoji}</span> : hole.emoji) : '🕳️'}
          </button>
        ))}
      </div>
      <div style={{ textAlign: 'center', minHeight: '3rem' }}>
        {result === null && (
          <>
            {!started ? (
              <button className="cta" type="button" onClick={start} style={{ background: '#f0abfc', color: '#1a1033' }}>
                🐭 ¡Empezar!
              </button>
            ) : (
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>
                ⏱ {timeLeft}s · Puntos: <strong style={{ color: '#ffcb05' }}>{score}</strong>
              </p>
            )}
          </>
        )}
        {result !== null && (
          <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
            {result >= 800 ? '⚡ ¡Reflejos de gato!' : `¡${result} puntos!`}
          </p>
        )}
      </div>
    </div>
  )
}
