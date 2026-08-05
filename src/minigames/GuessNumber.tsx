import { useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'

const MAX = 10
const MAX_TRIES = 3

export default function GuessNumber({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [secret, setSecret] = useState<number | null>(null)
  const [tries, setTries] = useState(0)
  const [hint, setHint] = useState('')
  const [guessed, setGuessed] = useState<number[]>([])
  const [result, setResult] = useState<number | null>(null)
  const [started, setStarted] = useState(false)
  const [lastGuess, setLastGuess] = useState<number | null>(null)

  const start = (): void => {
    playClick()
    setSecret(Math.floor(Math.random() * MAX) + 1)
    setTries(0)
    setHint('')
    setGuessed([])
    setResult(null)
    setStarted(true)
    setLastGuess(null)
  }

  const guess = (n: number): void => {
    if (secret === null || result !== null || guessed.includes(n)) return
    setLastGuess(n)
    setGuessed(prev => [...prev, n])
    const nextTries = tries + 1
    setTries(nextTries)
    if (n === secret) {
      playEvolution()
      const score = Math.max(150, 1000 - (nextTries - 1) * 280)
      setResult(score)
      setHint(`🎉 ¡Correcto! Era ${secret}`)
      setTimeout(() => onComplete(score), 900)
    } else {
      playHit()
      if (nextTries >= MAX_TRIES) {
        const score = 50
        setResult(score)
        setHint(`😢 Se acabaron los intentos. Era ${secret}`)
        setTimeout(() => onComplete(score), 900)
      } else {
        setHint(n < secret ? '📈 ¡Más alto!' : '📉 ¡Más bajo!')
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px', padding: '1.25rem 1rem 1rem' }}>
      {!started ? (
        <button className="cta" type="button" onClick={start} style={{ background: '#f0abfc', color: '#1a1033' }}>
          🔢 ¡Empezar!
        </button>
      ) : (
        <>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>
            Adivina el número secreto (1-{MAX}) · {MAX_TRIES - tries} intentos
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', maxWidth: '320px', width: '100%' }}>
            {Array.from({ length: MAX }, (_, i) => i + 1).map(n => {
              const used = guessed.includes(n)
              const isLast = lastGuess === n && result === null
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => guess(n)}
                  disabled={used || result !== null}
                  style={{
                    aspectRatio: '1', borderRadius: '10px', border: '2px solid rgba(255,255,255,0.15)',
                    background: used ? 'rgba(148,163,184,0.2)' : '#2a2a55',
                    color: used ? '#64748b' : '#f3f1ff',
                    fontSize: '1.1rem', fontWeight: 'bold',
                    cursor: used ? 'not-allowed' : 'pointer',
                    transition: 'transform 0.1s ease',
                    animation: isLast ? 'casinoNumberPop 0.4s ease' : 'none',
                  }}
                >
                  {n}
                </button>
              )
            })}
          </div>
          {hint && result === null && (
            <p style={{ color: '#ffcb05', fontSize: '1rem', margin: 0, animation: 'casinoSlideUp 0.3s ease', fontWeight: 'bold' }}>{hint}</p>
          )}
          {result !== null && (
            <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.1rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
              {hint} · {result} puntos
            </p>
          )}
        </>
      )}
    </div>
  )
}
