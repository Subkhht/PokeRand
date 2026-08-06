import { useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'
import { shuffle } from './pokeData'
import { t } from '../game/i18n'

const SIZE = 5
const VOLTORB_COUNT = 7

function weightedValue(): number {
  const r = Math.random()
  if (r < 0.6) return 1
  if (r < 0.85) return 2
  return 3
}

interface BoardData {
  cells: number[]
  maxValue: number
  totalSafe: number
}

function buildBoard(): BoardData {
  const cells: number[] = Array.from({ length: SIZE * SIZE }, () => 0)
  const candidates = Array.from({ length: SIZE * SIZE }, (_, i) => i).filter(i => i !== 0)
  const voltorbs = new Set(shuffle(candidates).slice(0, VOLTORB_COUNT))
  let maxValue = 0
  let totalSafe = 0
  for (let i = 0; i < cells.length; i++) {
    if (voltorbs.has(i)) {
      cells[i] = 0
    } else {
      cells[i] = weightedValue()
      maxValue += cells[i]
      totalSafe++
    }
  }
  return { cells, maxValue, totalSafe }
}

function lineInfo(cells: number[], start: number, step: number): { pts: number; vol: number } {
  let pts = 0
  let vol = 0
  for (let i = 0; i < SIZE; i++) {
    const v = cells[start + i * step]
    if (v === 0) vol++
    else pts += v
  }
  return { pts, vol }
}

export default function VoltorbFlip({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [started, setStarted] = useState(false)
  const [board, setBoard] = useState<BoardData | null>(null)
  const [revealed, setRevealed] = useState<boolean[]>([])
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing')
  const [revealedValue, setRevealedValue] = useState(0)
  const [result, setResult] = useState<number | null>(null)

  const start = (): void => {
    playClick()
    const b = buildBoard()
    setBoard(b)
    setRevealed(Array.from({ length: SIZE * SIZE }, () => false))
    setStatus('playing')
    setRevealedValue(0)
    setResult(null)
    setStarted(true)
  }

  const finish = (won: boolean, value: number): void => {
    setStatus(won ? 'won' : 'lost')
    if (won) playEvolution()
    else playHit()
    setTimeout(() => {
      const b = board
      if (!b) return
      const score = won
        ? Math.round((value / b.maxValue) * 1000)
        : Math.round((value / b.maxValue) * 600)
      setResult(score)
      setTimeout(() => onComplete(score), 800)
    }, 500)
  }

  const flip = (i: number): void => {
    if (!board || status !== 'playing' || result !== null || revealed[i]) return
    const next = [...revealed]
    next[i] = true
    setRevealed(next)
    if (board.cells[i] === 0) {
      finish(false, revealedValue)
    } else {
      playClick()
      const nv = revealedValue + board.cells[i]
      setRevealedValue(nv)
      const safeRevealed = next.filter((r, idx) => r && board.cells[idx] !== 0).length
      if (safeRevealed === board.totalSafe) {
        setRevealed(next)
        setTimeout(() => finish(true, nv), 200)
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '1.25rem 1rem 1rem' }}>
      {!started ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '3rem', animation: 'casinoBounce 0.9s ease infinite' }}>💣</div>
          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0, maxWidth: '360px' }}>
            {t('mg.voltorb.introA')} <strong style={{ color: '#ffcb05' }}>{t('mg.voltorb.pointsVoltorb')}</strong>{t('mg.voltorb.introB')}
            sin tocar un Voltorb 💣. ¡Revela todas las seguras para ganar!
          </p>
          <button className="cta" type="button" onClick={start} style={{ background: '#f0abfc', color: '#1a1033' }}>
            💣 ¡Empezar!
          </button>
        </div>
      ) : board ? (
        <>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>
            Puntos revelados: <strong style={{ color: '#ffcb05' }}>{revealedValue}</strong> · Casillas seguras restantes:{' '}
            <strong>{board.totalSafe - revealed.filter((r, i) => r && board.cells[i] !== 0).length}</strong>
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `44px repeat(${SIZE}, 1fr)`,
              gridTemplateRows: `28px repeat(${SIZE}, 1fr)`,
              gap: '6px',
              maxWidth: '380px',
              width: '100%',
            }}
          >
            {/* Corner */}
            <div style={{ gridRow: 1, gridColumn: 1 }} />
            {Array.from({ length: SIZE }, (_, c) => {
              const info = board && lineInfo(board.cells, c, SIZE)
              return (
                <div
                  key={`ch-${c}`}
                  style={{
                    gridRow: 1,
                    gridColumn: c + 2,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,203,5,0.12)', border: '1px solid #5a5a96', borderRadius: '6px',
                    color: info && info.vol >= 3 ? '#ff8a80' : '#ffcb05', fontWeight: 'bold', fontSize: '0.68rem', lineHeight: 1.15,
                  }}
                >
                  <span>{info?.pts}</span>
                  <span>{info?.vol}</span>
                </div>
              )
            })}
            {Array.from({ length: SIZE }, (_, r) => {
              const info = board && lineInfo(board.cells, r * SIZE, 1)
              return (
                <div
                  key={`rh-${r}`}
                  style={{
                    gridRow: r + 2,
                    gridColumn: 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,203,5,0.12)', border: '1px solid #5a5a96', borderRadius: '6px',
                    color: info && info.vol >= 3 ? '#ff8a80' : '#ffcb05', fontWeight: 'bold', fontSize: '0.68rem', lineHeight: 1.15,
                  }}
                >
                  <span>{info?.pts}</span>
                  <span>{info?.vol}</span>
                </div>
              )
            })}
            {revealed.map((r, i) => {
              const val = board.cells[i]
              const row = Math.floor(i / SIZE)
              const col = i % SIZE
              const isVoltorb = r && val === 0
              const revealedSafe = r && val > 0
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => flip(i)}
                  disabled={status !== 'playing' || result !== null || r}
                  style={{
                    aspectRatio: '1', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold',
                    gridRow: row + 2,
                    gridColumn: col + 2,
                    background: isVoltorb ? 'rgba(255,82,82,0.45)' : revealedSafe ? (val === 3 ? 'rgba(255,203,5,0.4)' : val === 2 ? 'rgba(52,211,153,0.35)' : 'rgba(129,199,255,0.3)') : '#2a2a55',
                    border: `2px solid ${isVoltorb ? '#ff5252' : revealedSafe ? (val === 3 ? '#ffcb05' : val === 2 ? '#34d399' : '#81c7ff') : '#5a5a96'}`,
                    color: revealedSafe ? '#f3f1ff' : '#7d7ab5',
                    cursor: status === 'playing' && result === null && !r ? 'pointer' : 'default',
                    boxShadow: isVoltorb ? '0 0 14px rgba(255,82,82,0.6)' : 'none',
                    animation: isVoltorb ? 'casinoDiceShake 0.3s ease' : r ? 'casinoFlipIn 0.35s ease' : 'casinoPulse 2s ease infinite',
                  }}
                >
                  {isVoltorb ? '💣' : revealedSafe ? val : '?'}
                </button>
              )
            })}
          </div>
          {status !== 'playing' && result === null && (
            <p style={{ color: status === 'won' ? '#34d399' : '#ff8a80', fontWeight: 'bold', fontSize: '1rem', margin: 0, animation: 'casinoSlideUp 0.3s ease' }}>
              {status === 'won' ? t('mg.voltorb.won') : t('mg.voltorb.boom')}
            </p>
          )}
        </>
      ) : null}
      {result !== null && (
        <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
          {result >= 800 ? t('mg.voltorb.logic') : result >= 400 ? '💡 ¡Bien pensado!' : '🌀 ¡Cuidado con los Voltorb!'} · {result} pts
        </p>
      )}
    </div>
  )
}
