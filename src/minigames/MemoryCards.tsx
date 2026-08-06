import { useState, useRef, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'
import { t } from '../game/i18n'

const EMOJIS = ['⚔️', '🔥', '💧', '🌿', '⚡', '💎', '🐉', '🌟']
const PAIRS = 8

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface Card {
  emoji: string
  id: number
}

export default function MemoryCards({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [cards, setCards] = useState<Card[]>(() => shuffle([...EMOJIS, ...EMOJIS].slice(0, PAIRS * 2)).map((e, i) => ({ emoji: e, id: i })))
  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [result, setResult] = useState<number | null>(null)
  const lockRef = useRef(false)
  const finishedRef = useRef(false)

  const flipCard = (index: number): void => {
    if (lockRef.current || flipped.includes(index) || matched.includes(index) || result !== null) return
    playClick()
    const nextFlipped = [...flipped, index]
    setFlipped(nextFlipped)
    if (nextFlipped.length === 2) {
      lockRef.current = true
      const [a, b] = nextFlipped
      setMoves(m => m + 1)
      if (cards[a].emoji === cards[b].emoji) {
        playHit()
        setTimeout(() => {
          const newMatched = [...matched, a, b]
          setMatched(newMatched)
          setFlipped([])
          lockRef.current = false
          if (newMatched.length === PAIRS * 2) {
            finishedRef.current = true
            playEvolution()
            const score = Math.max(100, Math.round(1000 - moves * 60))
            setResult(score)
            setTimeout(() => onComplete(score), 800)
          }
        }, 350)
      } else {
        playClick()
        setTimeout(() => {
          setFlipped([])
          lockRef.current = false
        }, 700)
      }
    }
  }

  const startGame = (): void => {
    playClick()
    setCards(shuffle([...EMOJIS, ...EMOJIS].slice(0, PAIRS * 2)).map((e, i) => ({ emoji: e, id: i })))
    setFlipped([])
    setMatched([])
    setMoves(0)
    setResult(null)
    finishedRef.current = false
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px', padding: '1.25rem 1rem 1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', maxWidth: '380px', width: '100%' }}>
        {cards.map((card, i) => {
          const isFlipped = flipped.includes(i) || matched.includes(i)
          const isMatched = matched.includes(i)
          return (
            <button
              key={`${card.id}-${i}`}
              type="button"
              onClick={() => flipCard(i)}
              disabled={result !== null}
              style={{
                aspectRatio: '1', borderRadius: '10px', border: '2px solid rgba(255,255,255,0.15)',
                background: isMatched ? 'rgba(52,211,153,0.25)' : '#2a2a55',
                fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: result === null && !isFlipped ? 'pointer' : 'default',
                transform: isMatched ? 'scale(0.94)' : 'scale(1)',
                transition: 'transform 0.2s ease, background 0.3s ease',
                animation: isMatched ? 'casinoMatch 0.4s ease' : 'none',
                position: 'relative',
              }}
            >
              {isFlipped ? (
                <span style={{ animation: 'casinoFlipIn 0.3s ease' }}>{card.emoji}</span>
              ) : (
                <span style={{ color: '#7d7ab5', fontSize: '1.2rem' }}>❓</span>
              )}
            </button>
          )
        })}
      </div>
      <div style={{ textAlign: 'center', minHeight: '3.5rem' }}>
        {result === null && (
          <>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: '0 0 0.25rem' }}>
              Parejas: {matched.length / 2} / {PAIRS} · Intentos: {moves}
            </p>
            {moves === 0 && (
              <button className="cta" type="button" onClick={startGame} style={{ background: '#f0abfc', color: '#1a1033' }}>
                🃏 ¡Empezar!
              </button>
            )}
          </>
        )}
        {result !== null && (
          <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
            {result >= 800 ? t('mg.memory.perfect') : t('mg.pointsResult', { n: result })}
          </p>
        )}
      </div>
    </div>
  )
}
