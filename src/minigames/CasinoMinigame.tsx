import { useEffect, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { CASINO_MINIGAMES } from './registry'
import MinigamePlayer from './MinigamePlayer'

export default function CasinoMinigame({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [gameKey, setGameKey] = useState<string | null>(null)
  const [rollingName, setRollingName] = useState('')

  useEffect(() => {
    const pick = CASINO_MINIGAMES[Math.floor(Math.random() * CASINO_MINIGAMES.length)]
    let current = 0
    const nameTimer = setInterval(() => {
      current = (current + 1) % CASINO_MINIGAMES.length
      setRollingName(CASINO_MINIGAMES[current].name)
    }, 90)
    const pickTimer = setTimeout(() => {
      clearInterval(nameTimer)
      setRollingName(pick.name)
      setTimeout(() => {
        setGameKey(pick.key)
      }, 600)
    }, 1900)
    return () => {
      clearInterval(nameTimer)
      clearTimeout(pickTimer)
    }
  }, [])

  if (gameKey === null) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem', animation: 'casinoFadeIn 0.3s ease' }}>
        <div style={{ fontSize: '3rem', animation: 'casinoBounce 0.9s ease infinite' }}>🎰</div>
        <p style={{ color: '#f0abfc', fontWeight: 'bold', fontSize: '1.1rem', margin: '1rem 0 0.25rem' }}>Eligiendo minijuego...</p>
        <p style={{ color: '#cbd5e1', fontSize: '0.85rem', minHeight: '1.4em' }}>{rollingName}</p>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '0.75rem' }}>
          {CASINO_MINIGAMES.map((g, i) => (
            <span
              key={g.key}
              style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: i === Math.floor(performance.now() / 90) % CASINO_MINIGAMES.length ? '#f0abfc' : '#475569',
                animation: 'casinoPulse 0.4s ease infinite',
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ animation: 'casinoSlideUp 0.35s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        <p style={{ color: '#f0abfc', fontWeight: 'bold', fontSize: '0.95rem', margin: 0 }}>
          {CASINO_MINIGAMES.find(g => g.key === gameKey)?.name}
        </p>
      </div>
      <MinigamePlayer gameKey={gameKey} onComplete={onComplete} />
    </div>
  )
}
