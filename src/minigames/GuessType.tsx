import { useCallback, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'
import { ALL_TYPES, POKEDEX, TYPE_COLORS, TYPE_NAMES, randomFrom, shuffle } from './pokeData'
import { t } from '../game/i18n'

const ROUNDS = 6

interface Round {
  entry: typeof POKEDEX[number]
  options: string[]
}

function buildRound(): Round {
  const entry = randomFrom(POKEDEX)
  const primary = entry.types[0]
  const excluded = new Set(entry.types)
  const distractors = ALL_TYPES.filter(t => !excluded.has(t))
  const options = shuffle([primary, ...shuffle(distractors).slice(0, 3)])
  return { entry, options }
}

export default function GuessType({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [started, setStarted] = useState(false)
  const [round, setRound] = useState(1)
  const [data, setData] = useState<Round | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [result, setResult] = useState<number | null>(null)

  const start = (): void => {
    playClick()
    setRound(1)
    setCorrect(0)
    setResult(null)
    setStarted(true)
    setData(buildRound())
    setRevealed(false)
    setSelected(null)
  }

  const nextRound = useCallback((): void => {
    setRound(r => r + 1)
    setData(buildRound())
    setRevealed(false)
    setSelected(null)
  }, [])

  const choose = (type: string): void => {
    if (!data || revealed || result !== null) return
    setSelected(type)
    setRevealed(true)
    const isCorrect = type === data.entry.types[0]
    if (isCorrect) {
      playEvolution()
      setCorrect(c => c + 1)
    } else {
      playHit()
    }
    setTimeout(() => {
      if (round >= ROUNDS) {
        const score = Math.round(((correct + (isCorrect ? 1 : 0)) / ROUNDS) * 1000)
        setResult(score)
        setTimeout(() => onComplete(score), 900)
      } else {
        nextRound()
      }
    }, 1100)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '1.25rem 1rem 1rem' }}>
      {!started ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '3rem', animation: 'casinoBounce 0.9s ease infinite' }}>🌈</div>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0, maxWidth: '340px' }}>
            {ROUNDS} rondas. Descubre el tipo principal de cada Pokémon. ¡A por ellos!
          </p>
          <button className="cta" type="button" onClick={start} style={{ background: '#f0abfc', color: '#1a1033' }}>
            🌈 ¡Empezar!
          </button>
        </div>
      ) : data ? (
        <>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>
            Ronda {round}/{ROUNDS} · Aciertos: <strong style={{ color: '#ffcb05' }}>{correct}</strong>
          </p>
          <div
            style={{
              width: '150px', height: '150px', borderRadius: '16px',
              background: 'linear-gradient(160deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))',
              border: '3px solid #f0abfc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(240,171,252,0.35)',
              animation: revealed ? 'none' : 'casinoFlipIn 0.45s ease',
            }}
          >
            <img
              src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${data.entry.id}.png`}
              alt={data.entry.name}
              style={{ width: '120px', height: '120px', imageRendering: 'pixelated', animation: 'casinoBounce 1.4s ease infinite' }}
            />
          </div>
          <p style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '1.1rem', margin: 0, textTransform: 'capitalize' }}>
            {data.entry.name}
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
            {revealed ? (
              <span>
                {t('mg.guessType.types', { s: data.entry.types.length > 1 ? 's' : '' })}:{' '}
                {data.entry.types.map((t, i) => (
                  <span key={t} style={{ color: TYPE_COLORS[t], fontWeight: 'bold' }}>
                    {TYPE_NAMES[t]}
                    {i < data.entry.types.length - 1 ? ' · ' : ''}
                  </span>
                ))}
              </span>
            ) : (
              t('mg.guessType.ask')
            )}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', maxWidth: '340px', width: '100%' }}>
            {data.options.map(t => {
              const isCorrect = revealed && t === data.entry.types[0]
              const isWrong = revealed && t === selected && t !== data.entry.types[0]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => choose(t)}
                  disabled={revealed}
                  style={{
                    padding: '12px 14px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem',
                    background: isCorrect ? 'rgba(52,211,153,0.4)' : isWrong ? 'rgba(255,82,82,0.4)' : '#2a2a55',
                    border: `2px solid ${isCorrect ? '#34d399' : isWrong ? '#ff5252' : TYPE_COLORS[t]}`,
                    color: '#f3f1ff', cursor: revealed ? 'default' : 'pointer',
                    boxShadow: `0 0 10px ${TYPE_COLORS[t]}55`,
                    transition: 'transform 0.1s ease, background 0.3s ease',
                    animation: revealed && isCorrect ? 'casinoMatch 0.5s ease' : 'none',
                  }}
                >
                  {TYPE_NAMES[t]}
                </button>
              )
            })}
          </div>
        </>
      ) : null}
      {result !== null && (
        <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
          {result >= 800 ? '🎓 ¡Experto en tipos!' : result >= 400 ? '🙂 ¡Buen conocimiento!' : '📖 ¡A estudiar los tipos!'} · {result} pts
        </p>
      )}
    </div>
  )
}
