import { useState, useRef, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playEvolution } from '../game/sound'
import { t } from '../game/i18n'

const DICE_FACES: Record<number, string[][]> = {
  1: [['', '', ''], ['', '●', ''], ['', '', '']],
  2: [['●', '', ''], ['', '', ''], ['', '', '●']],
  3: [['●', '', ''], ['', '●', ''], ['', '', '●']],
  4: [['●', '', '●'], ['', '', ''], ['●', '', '●']],
  5: [['●', '', '●'], ['', '●', ''], ['●', '', '●']],
  6: [['●', '', '●'], ['●', '', '●'], ['●', '', '●']],
}

const MAX_ROLLS = 3

export default function DiceGame({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [rolls, setRolls] = useState(0)
  const [dice, setDice] = useState<[number, number]>([6, 6])
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const finishedRef = useRef(false)

  const roll = (): void => {
    if (rolling || result !== null) return
    playClick()
    setRolling(true)
    let frames = 0
    const anim = window.setInterval(() => {
      frames++
      const d1 = Math.floor(Math.random() * 6) + 1
      const d2 = Math.floor(Math.random() * 6) + 1
      setDice([d1, d2])
      if (frames > 12) {
        window.clearInterval(anim)
        const finalD1 = Math.floor(Math.random() * 6) + 1
        const finalD2 = Math.floor(Math.random() * 6) + 1
        setDice([finalD1, finalD2])
        setRolling(false)
        playEvolution()
        const sum = finalD1 + finalD2
        const nextRolls = rolls + 1
        setRolls(nextRolls)
        setTotal(sum)
        if (nextRolls >= MAX_ROLLS || sum === 12) {
          finishedRef.current = true
          const score = Math.min(1000, Math.max(100, sum * 80))
          setResult(score)
          setTimeout(() => onComplete(score), 900)
        }
      }
    }, 90)
  }

  const keep = (): void => {
    if (total === null || result !== null) return
    finishedRef.current = true
    playEvolution()
    const score = Math.min(1000, Math.max(100, total * 80))
    setResult(score)
    setTimeout(() => onComplete(score), 900)
  }

  const renderDie = (value: number): JSX.Element => {
    const face = DICE_FACES[value]
    return (
      <div
        style={{
          width: '80px', height: '80px', borderRadius: '14px', background: '#fff',
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)',
          padding: '10px', boxShadow: '0 6px 14px rgba(0,0,0,0.4)',
          animation: rolling ? 'casinoDiceShake 0.18s linear infinite' : 'casinoDiceLand 0.4s ease',
        }}
      >
        {face.flat().map((dot, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {dot === '●' && <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#1a1033' }} />}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', padding: '1.25rem 1rem 1rem' }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        {renderDie(dice[0])}
        <span style={{ fontSize: '1.6rem', color: '#f0abfc' }}>+</span>
        {renderDie(dice[1])}
      </div>
      <div style={{ textAlign: 'center', minHeight: '4rem' }}>
        {result === null && (
          <>
            {rolls === 0 ? (
              <button className="cta" type="button" onClick={roll} style={{ background: '#f0abfc', color: '#1a1033' }}>
                🎲 ¡Lanzar dados!
              </button>
            ) : rolling ? (
              <p style={{ color: '#f0abfc', fontSize: '1rem', margin: 0 }}>Lanzando...</p>
            ) : (
              <>
                <p style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Total: {total}</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button className="cta" type="button" onClick={keep} style={{ background: '#34d399', color: '#052e16' }}>
                    🛑 Quedarme
                  </button>
                  {rolls < MAX_ROLLS && (
                    <button className="cta" type="button" onClick={roll} style={{ background: '#ff8a33', color: '#1a1033' }}>
                      🔄 Relanzar ({MAX_ROLLS - rolls})
                    </button>
                  )}
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.5rem 0 0' }}>
                  {total === 12 ? '🎉 ¡Doble seis!' : t('mg.dice.rerollHint')}
                </p>
              </>
            )}
          </>
        )}
        {result !== null && (
          <div style={{ animation: 'casinoSlideUp 0.4s ease' }}>
            <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0 }}>
              {result >= 800 ? t('mg.dice.lucky') : `¡${result} puntos!`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
