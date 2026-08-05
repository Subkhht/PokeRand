import { useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'

interface PokeEntry {
  name: string
  id: number
}

const POOL: PokeEntry[] = [
  { name: 'Pikachu', id: 25 },
  { name: 'Charizard', id: 6 },
  { name: 'Bulbasaur', id: 1 },
  { name: 'Squirtle', id: 7 },
  { name: 'Gengar', id: 94 },
  { name: 'Mewtwo', id: 150 },
  { name: 'Snorlax', id: 143 },
  { name: 'Eevee', id: 133 },
  { name: 'Lugia', id: 249 },
  { name: 'Gyarados', id: 130 },
  { name: 'Dragonite', id: 149 },
  { name: 'Machamp', id: 68 },
]

const ROUNDS = 3

const spriteUrl = (id: number): string => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`

export default function GuessPokemon({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [round, setRound] = useState(0)
  const [current, setCurrent] = useState<PokeEntry | null>(null)
  const [options, setOptions] = useState<PokeEntry[]>([])
  const [correct, setCorrect] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [started, setStarted] = useState(false)

  const newRound = (): void => {
    const pick = POOL[Math.floor(Math.random() * POOL.length)]
    const others = POOL.filter(p => p.id !== pick.id).sort(() => 0.5 - Math.random()).slice(0, 3)
    setCurrent(pick)
    setOptions([pick, ...others].sort(() => 0.5 - Math.random()))
    setRevealed(false)
  }

  const start = (): void => {
    playClick()
    setRound(1)
    setCorrect(0)
    setResult(null)
    setStarted(true)
    newRound()
  }

  const choose = (entry: PokeEntry): void => {
    if (!current || revealed || result !== null) return
    setRevealed(true)
    if (entry.id === current.id) {
      playEvolution()
      setCorrect(c => c + 1)
    } else {
      playHit()
    }
    setTimeout(() => {
      if (round >= ROUNDS) {
        const score = Math.min(1000, Math.max(100, correct * 330))
        setResult(score)
        setTimeout(() => onComplete(score), 900)
      } else {
        setRound(r => r + 1)
        newRound()
      }
    }, 1200)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px', padding: '1.25rem 1rem 1rem' }}>
      {!started ? (
        <button className="cta" type="button" onClick={start} style={{ background: '#f0abfc', color: '#1a1033' }}>
          ❓ ¡Empezar!
        </button>
      ) : current ? (
        <>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>
            Ronda {round}/{ROUNDS} · Aciertos: {correct}
          </p>
          <div style={{ textAlign: 'center' }}>
            <img
              src={spriteUrl(current.id)}
              alt="?"
              style={{
                width: '130px', height: '130px', imageRendering: 'pixelated',
                filter: revealed ? 'none' : 'brightness(0) contrast(1.1)',
                transition: 'filter 0.5s ease',
                animation: 'casinoPulse 1.2s ease infinite',
              }}
            />
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
            {revealed ? `¡Es ${current.name}!` : '¿Quién es ese Pokémon?'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', maxWidth: '340px', width: '100%' }}>
            {options.map(opt => {
              const isCorrect = revealed && opt.id === current.id
              const isWrong = revealed && opt.id !== current.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => choose(opt)}
                  disabled={revealed}
                  style={{
                    padding: '10px 14px', borderRadius: '10px', border: '2px solid rgba(255,255,255,0.15)',
                    background: isCorrect ? 'rgba(52,211,153,0.35)' : isWrong ? 'rgba(255,82,82,0.35)' : '#2a2a55',
                    color: '#f3f1ff', fontSize: '0.95rem', fontWeight: 'bold', textTransform: 'capitalize',
                    cursor: revealed ? 'default' : 'pointer',
                    transition: 'background 0.3s ease, transform 0.1s ease',
                  }}
                >
                  {opt.name}
                </button>
              )
            })}
          </div>
        </>
      ) : null}
      {result !== null && (
        <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
          {result >= 800 ? '🧑‍🏫 ¡Experto Pokémon!' : `¡${result} puntos!`}
        </p>
      )}
    </div>
  )
}
