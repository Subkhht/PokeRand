import { useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'
import { t } from '../game/i18n'

const COLORS = [
  { key: 'red', color: '#ff5252', glow: '#ff8a80', name: t('mg.simon.red') },
  { key: 'blue', color: '#448aff', glow: '#82b1ff', name: t('mg.simon.blue') },
  { key: 'green', color: '#34d399', glow: '#6ee7b7', name: t('mg.simon.green') },
  { key: 'yellow', color: '#ffd740', glow: '#fff59d', name: t('mg.simon.yellow') },
]

const MAX_ROUND = 8

export default function SimonGame({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [playerTurn, setPlayerTurn] = useState(false)
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<number | null>(null)

  const seqRef = useRef<string[]>([])
  const roundRef = useRef(0)
  const idxRef = useRef(0)
  const finishedRef = useRef(false)
  const timeoutRef = useRef<number | null>(null)

  const showSequence = (): void => {
    setPlayerTurn(false)
    let i = 0
    const step = (): void => {
      if (finishedRef.current) return
      if (i >= seqRef.current.length) {
        setPlayerTurn(true)
        idxRef.current = 0
        return
      }
      const k = seqRef.current[i]
      setActiveKey(k)
      playHit()
      timeoutRef.current = window.setTimeout(() => {
        setActiveKey(null)
        timeoutRef.current = window.setTimeout(step, 300)
      }, 450)
      i++
    }
    timeoutRef.current = window.setTimeout(step, 600)
  }

  const startGame = (): void => {
    if (finishedRef.current) return
    playClick()
    finishedRef.current = false
    setResult(null)
    seqRef.current = []
    roundRef.current = 0
    idxRef.current = 0
    setRound(0)
    nextRound()
  }

  const nextRound = (): void => {
    const pool = COLORS.map(c => c.key)
    const next = [...seqRef.current, pool[Math.floor(Math.random() * pool.length)]]
    seqRef.current = next
    roundRef.current = next.length
    setRound(next.length)
    showSequence()
  }

  const press = (key: string): void => {
    if (!playerTurn || finishedRef.current) return
    playClick()
    setActiveKey(key)
    timeoutRef.current = window.setTimeout(() => setActiveKey(null), 200)
    if (key === seqRef.current[idxRef.current]) {
      idxRef.current++
      if (idxRef.current >= seqRef.current.length) {
        if (seqRef.current.length >= MAX_ROUND) {
          finishedRef.current = true
          playEvolution()
          const score = 1000
          setResult(score)
          setTimeout(() => onComplete(score), 800)
        } else {
          setPlayerTurn(false)
          timeoutRef.current = window.setTimeout(nextRound, 800)
        }
      }
    } else {
      finishedRef.current = true
      playHit()
      const score = Math.max(50, roundRef.current * 130)
      setResult(score)
      setTimeout(() => onComplete(score), 800)
    }
  }

  useEffect(() => {
    return () => { if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current) }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '1.25rem 1rem 1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        {COLORS.map(c => {
          const isActive = activeKey === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => press(c.key)}
              disabled={!playerTurn}
              style={{
                width: '110px', height: '110px', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.2)',
                background: isActive ? c.glow : c.color,
                boxShadow: isActive ? `0 0 30px ${c.glow}, inset 0 0 20px rgba(255,255,255,0.4)` : 'inset 0 -8px 16px rgba(0,0,0,0.35)',
                transition: 'background 0.1s ease, box-shadow 0.1s ease, transform 0.1s ease',
                transform: isActive ? 'scale(0.94)' : 'scale(1)',
                cursor: playerTurn ? 'pointer' : 'not-allowed',
                opacity: playerTurn ? 1 : 0.75,
              }}
            />
          )
        })}
      </div>
      <div style={{ textAlign: 'center', minHeight: '3.5rem' }}>
        {result === null && (
          <>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: '0 0 0.25rem' }}>
              {round > 0 ? `${t('mg.simon.round')} ${round} / ${MAX_ROUND}` : t('mg.simon.watch')}
            </p>
            {playerTurn && <p style={{ color: '#f0abfc', fontSize: '0.85rem', margin: 0 }}>👆 ¡Tu turno! Repite la secuencia</p>}
            {!playerTurn && round > 0 && <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Observa la secuencia...</p>}
            {round === 0 && (
              <button className="cta" type="button" onClick={startGame} style={{ background: '#f0abfc', color: '#1a1033' }}>
                🔴 ¡Empezar!
              </button>
            )}
          </>
        )}
        {result !== null && (
          <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
            {result >= 800 ? '🧠 ¡Memoria de elefante!' : `¡${result} puntos!`}
          </p>
        )}
      </div>
    </div>
  )
}
