import { useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playEvolution } from '../game/sound'
import { t } from '../game/i18n'

const SYMBOLS = ['🟠', '🍒', '💎', '⭐', '🎰', '👑']
const REEL_COUNT = 3
const SPIN_TIME = 3000

export default function SlotMachine({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [reels, setReels] = useState<number[]>([0, 1, 2])
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [highlight, setHighlight] = useState<number[]>([])

  const spin = (): void => {
    if (spinning || result !== null) return
    playClick()
    setSpinning(true)
    setHighlight([])
    const finalReels: number[] = []
    for (let r = 0; r < REEL_COUNT; r++) {
      const finalIdx = Math.floor(Math.random() * SYMBOLS.length)
      finalReels.push(finalIdx)
      const start = Date.now()
      const timer = window.setInterval(() => {
        setReels(prev => {
          const next = [...prev]
          next[r] = Math.floor(Math.random() * SYMBOLS.length)
          return next
        })
        if (Date.now() - start > SPIN_TIME) {
          window.clearInterval(timer)
          setReels(prev => {
            const next = [...prev]
            next[r] = finalIdx
            return next
          })
          if (r === REEL_COUNT - 1) {
            window.setTimeout(() => {
              setSpinning(false)
              playEvolution()
              const s0 = finalReels[0]
              const s1 = finalReels[1]
              const s2 = finalReels[2]
              let score = 50
              let hl: number[] = []
              if (s0 === s1 && s1 === s2) {
                score = s0 === 2 || s0 === 4 ? 1000 : 800
                hl = [0, 1, 2]
              } else if (s0 === s1 || s1 === s2 || s0 === s2) {
                score = 400
                hl = s0 === s1 ? [0, 1] : s1 === s2 ? [1, 2] : [0, 2]
              }
              setHighlight(hl)
              setResult(score)
              setTimeout(() => onComplete(score), 900)
            }, 350)
          }
        }
      }, 80)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '26px', padding: '1.25rem 1rem 1rem' }}>
      <div
        style={{
          display: 'flex', gap: '10px', padding: '14px 18px', borderRadius: '14px',
          background: 'linear-gradient(180deg, #2a1a4d, #1a1033)',
          border: '3px solid #f0abfc', boxShadow: '0 0 24px rgba(240,171,252,0.3)',
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)', zIndex: 2, fontSize: '1.2rem' }}>▼</div>
        {reels.map((idx, r) => (
          <div
            key={r}
            style={{
              width: '80px', height: '100px', borderRadius: '10px', background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem',
              overflow: 'hidden', boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.25)',
              border: highlight.includes(r) ? '4px solid #ffcb05' : '4px solid rgba(0,0,0,0.2)',
              animation: highlight.includes(r) ? 'casinoPulse 0.5s ease infinite' : 'none',
            }}
          >
            <span style={{ animation: spinning ? 'casinoReelSpin 0.08s linear infinite' : 'casinoReelStop 0.3s ease' }}>
              {SYMBOLS[idx]}
            </span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', minHeight: '3rem' }}>
        {result === null && (
          <button className="cta" type="button" onClick={spin} disabled={spinning} style={{ background: spinning ? '#475569' : '#f0abfc', color: '#1a1033' }}>
            {spinning ? t('mg.spinning') : '🎰 ¡Tirar de la palanca!'}
          </button>
        )}
        {result !== null && (
          <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
            {result >= 800 ? '👑 ¡JACKPOT!' : result >= 400 ? '🎉 ¡Pareja!' : `¡${result} puntos!`}
          </p>
        )}
      </div>
    </div>
  )
}
