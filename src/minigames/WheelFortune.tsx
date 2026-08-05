import { useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playEvolution } from '../game/sound'

const SECTORS = [
  { label: '500', color: '#60a5fa', score: 500 },
  { label: '250', color: '#94a3b8', score: 250 },
  { label: '750', color: '#34d399', score: 750 },
  { label: '100', color: '#94a3b8', score: 100 },
  { label: 'JACKPOT', color: '#facc15', score: 1000 },
  { label: '100', color: '#94a3b8', score: 100 },
  { label: '750', color: '#34d399', score: 750 },
  { label: '250', color: '#94a3b8', score: 250 },
]

const SEGMENT = 360 / SECTORS.length

export default function WheelFortune({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ score: number; label: string; color: string } | null>(null)
  const targetRef = useRef(0)

  const spin = (): void => {
    if (spinning || result) return
    playClick()
    setSpinning(true)
    const extra = 5 * 360 + 720 + Math.random() * 1080
    const final = targetRef.current + extra
    targetRef.current = final
    setRotation(final)
  }

  useEffect(() => {
    if (!spinning || result) return
    const timer = setTimeout(() => {
      playEvolution()
      const normalized = ((360 - (targetRef.current % 360)) % 360)
      const sectorIndex = Math.floor(normalized / SEGMENT) % SECTORS.length
      const sector = SECTORS[sectorIndex]
      setResult(sector)
      setSpinning(false)
      setTimeout(() => onComplete(sector.score), 700)
    }, 4600)
    return () => clearTimeout(timer)
  }, [spinning, result, onComplete])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '26px', padding: '1.25rem 1rem 1rem' }}>
      <div style={{ position: 'relative', width: '240px', height: '240px' }}>
        <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', zIndex: 2, fontSize: '2rem', animation: result ? 'casinoPulse 0.5s ease infinite' : 'none' }}>▼</div>
        <div
          style={{
            width: '100%', height: '100%', borderRadius: '50%',
            border: '4px solid #f0abfc',
            boxShadow: '0 0 24px rgba(240,171,252,0.4)',
            background: 'conic-gradient(' + SECTORS.map((s, i) => `${s.color} ${i * SEGMENT}deg ${(i + 1) * SEGMENT}deg`).join(', ') + ')',
            transform: `rotate(${rotation}deg)`,
            transition: result ? 'none' : 'transform 4.5s cubic-bezier(0.15, 0.6, 0.2, 1)',
            position: 'relative',
          }}
        >
          {SECTORS.map((s, i) => {
            const angle = i * SEGMENT + SEGMENT / 2
            return (
              <div
                key={i}
                style={{
                  position: 'absolute', left: '50%', top: '50%',
                  transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-92px)`,
                  transformOrigin: 'center',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: s.label === 'JACKPOT' ? '0.6rem' : '0.7rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </div>
            )
          })}
        </div>
      </div>

      {!result && (
        <button className="cta" type="button" onClick={spin} disabled={spinning} style={{ background: spinning ? '#475569' : '#f0abfc', color: '#1a1033' }}>
          {spinning ? 'Girando...' : '🎡 ¡Girar!'}
        </button>
      )}
      {result && (
        <div style={{ textAlign: 'center', animation: 'casinoSlideUp 0.4s ease' }}>
          <p style={{ color: result.color, fontWeight: 'bold', fontSize: '1.2rem', margin: '0 0 0.25rem' }}>
            {result.label === 'JACKPOT' ? '🏆 ¡JACKPOT!' : `¡${result.score} puntos!`}
          </p>
          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0 }}>Calculando premio...</p>
        </div>
      )}
    </div>
  )
}
