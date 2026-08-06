import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'
import { t } from '../game/i18n'

interface PokeEntry {
  name: string
  id: number
}

const EASY: PokeEntry[] = [
  { name: 'Pikachu', id: 25 },
  { name: 'Charizard', id: 6 },
  { name: 'Bulbasaur', id: 1 },
  { name: 'Charmander', id: 4 },
  { name: 'Squirtle', id: 7 },
  { name: 'Gengar', id: 94 },
  { name: 'Mewtwo', id: 150 },
  { name: 'Snorlax', id: 143 },
  { name: 'Eevee', id: 133 },
  { name: 'Jigglypuff', id: 39 },
  { name: 'Meowth', id: 52 },
  { name: 'Psyduck', id: 54 },
  { name: 'Pidgey', id: 16 },
  { name: 'Geodude', id: 74 },
  { name: 'Onix', id: 95 },
  { name: 'Cubone', id: 104 },
  { name: 'Magikarp', id: 129 },
  { name: 'Machop', id: 66 },
  { name: 'Gastly', id: 92 },
  { name: 'Gyarados', id: 130 },
]

const MEDIUM: PokeEntry[] = [
  { name: 'Dragonite', id: 149 },
  { name: 'Lucario', id: 448 },
  { name: 'Gardevoir', id: 282 },
  { name: 'Garchomp', id: 445 },
  { name: 'Metagross', id: 376 },
  { name: 'Tyranitar', id: 248 },
  { name: 'Salamence', id: 373 },
  { name: 'Scizor', id: 212 },
  { name: 'Blaziken', id: 257 },
  { name: 'Swampert', id: 260 },
  { name: 'Sceptile', id: 254 },
  { name: 'Umbreon', id: 197 },
  { name: 'Espeon', id: 196 },
  { name: 'Absol', id: 359 },
  { name: 'Heracross', id: 214 },
  { name: 'Houndoom', id: 229 },
  { name: 'Weavile', id: 461 },
  { name: 'Electivire', id: 466 },
  { name: 'Gliscor', id: 472 },
  { name: 'Togekiss', id: 468 },
  { name: 'Milotic', id: 350 },
]

const HARD: PokeEntry[] = [
  { name: 'Goldeen', id: 118 },
  { name: 'Seaking', id: 119 },
  { name: 'Tentacool', id: 72 },
  { name: 'Luvdisc', id: 370 },
  { name: 'Finneon', id: 456 },
  { name: 'Wurmple', id: 265 },
  { name: 'Silcoon', id: 266 },
  { name: 'Cascoon', id: 268 },
  { name: 'Kricketot', id: 401 },
  { name: 'Burmy', id: 412 },
  { name: 'Nincada', id: 290 },
  { name: 'Shroomish', id: 285 },
  { name: 'Seedot', id: 273 },
  { name: 'Lotad', id: 270 },
  { name: 'Surskit', id: 283 },
  { name: 'Remoraid', id: 223 },
  { name: 'Barboach', id: 339 },
  { name: 'Wooper', id: 194 },
  { name: 'Poliwag', id: 60 },
  { name: 'Horsea', id: 116 },
  { name: 'Shellder', id: 90 },
  { name: 'Krabby', id: 98 },
  { name: 'Chinchou', id: 170 },
  { name: 'Qwilfish', id: 211 },
  { name: 'Staryu', id: 120 },
  { name: 'Clamperl', id: 366 },
  { name: 'Feebas', id: 349 },
  { name: 'Mime Jr.', id: 439 },
]

const ROUNDS = 4
const ROUND_SECONDS = [8, 7, 6, 5]
const OPTION_COUNTS = [4, 5, 5, 6]
const ZOOMS = [1, 1, 1.3, 1.55]

const spriteUrl = (id: number): string => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`

export default function GuessPokemon({ onComplete }: CasinoMinigameProps): JSX.Element {
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const [round, setRound] = useState(1)
  const [current, setCurrent] = useState<PokeEntry | null>(null)
  const [options, setOptions] = useState<PokeEntry[]>([])
  const [correct, setCorrect] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS[0])
  const [result, setResult] = useState<number | null>(null)
  const [started, setStarted] = useState(false)
  const answeredRef = useRef(false)
  const correctRef = useRef(0)

  const poolForRound = (r: number): PokeEntry[] => {
    if (r === 1) return EASY
    if (r === 2) return [...EASY, ...MEDIUM]
    if (r === 3) return [...MEDIUM, ...HARD]
    return HARD
  }

  const newRound = useCallback((): void => {
    const pool = poolForRound(round)
    const pick = pool[Math.floor(Math.random() * pool.length)]
    const count = OPTION_COUNTS[round - 1] ?? 4
    const others = pool.filter(p => p.id !== pick.id).sort(() => 0.5 - Math.random()).slice(0, count - 1)
    setCurrent(pick)
    setOptions([pick, ...others].sort(() => 0.5 - Math.random()))
    setRevealed(false)
    setSelectedId(null)
    setTimedOut(false)
    setTimeLeft(ROUND_SECONDS[round - 1] ?? 8)
    answeredRef.current = false
  }, [round])

  const start = (): void => {
    playClick()
    setRound(1)
    setCorrect(0)
    correctRef.current = 0
    setResult(null)
    setStarted(true)
  }

  const advance = useCallback((): void => {
    if (round >= ROUNDS) {
      const score = Math.min(1000, Math.max(50, correctRef.current * 250))
      setResult(score)
      setTimeout(() => onCompleteRef.current(score), 900)
    } else {
      setRound(r => r + 1)
    }
  }, [round])

  const timeoutRound = useCallback((): void => {
    if (answeredRef.current) return
    answeredRef.current = true
    playHit()
    setTimedOut(true)
    setRevealed(true)
    setTimeout(() => advance(), 1200)
  }, [advance])

  const choose = (entry: PokeEntry): void => {
    if (!current || revealed || result !== null || answeredRef.current) return
    answeredRef.current = true
    setSelectedId(entry.id)
    setRevealed(true)
    if (entry.id === current.id) {
      playEvolution()
      correctRef.current += 1
      setCorrect(correctRef.current)
    } else {
      playHit()
    }
    setTimeout(() => advance(), 1200)
  }

  useEffect(() => {
    if (!started) return
    newRound()
  }, [round, started, newRound])

  useEffect(() => {
    if (!started || !current || revealed || result !== null) return
    const iv = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(iv)
  }, [started, current, revealed, result])

  useEffect(() => {
    if (!started || !current || revealed || result !== null || timeLeft > 0) return
    timeoutRound()
  }, [timeLeft, started, current, revealed, result, timeoutRound])

  const secondsForRound = ROUND_SECONDS[round - 1] ?? 8
  const timeFrac = timeLeft / secondsForRound

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '1.25rem 1rem 1rem' }}>
      {!started ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '3rem' }}>❓</div>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0, maxWidth: '360px' }}>
            {ROUNDS} rondas con dificultad creciente: Pokémon más raros, más opciones y menos tiempo. ¡No dejes que se acabe el cronómetro!
          </p>
          <button className="cta" type="button" onClick={start} style={{ background: '#f0abfc', color: '#1a1033' }}>
            ❓ ¡Empezar!
          </button>
        </div>
      ) : current ? (
        <>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>
            Ronda {round}/{ROUNDS} · Aciertos: {correct}
          </p>

          {/* Timer bar */}
          {result === null && (
            <div style={{ width: '100%', maxWidth: '300px', height: '14px', background: 'rgba(0,0,0,0.45)', borderRadius: '7px', overflow: 'hidden', border: '2px solid #3f3f6e' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, timeFrac * 100)}%`,
                  background: timeFrac > 0.5 ? '#34d399' : timeFrac > 0.25 ? '#ffcb05' : '#ff8a80',
                  transition: 'width 1s linear, background 0.3s ease',
                }}
              />
            </div>
          )}

          <div
            style={{
              width: '130px',
              height: '130px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
              background: 'radial-gradient(circle at 50% 35%, #cfeaff 0%, #8fc6f5 45%, #5d9ee0 100%)',
              border: '2px solid #f0abfc',
              boxShadow: '0 0 18px rgba(240,171,252,0.4), inset 0 0 12px rgba(0,0,0,0.25)',
            }}
          >
            <img
              src={spriteUrl(current.id)}
              alt="?"
              style={{
                width: '130px',
                height: '130px',
                imageRendering: 'pixelated',
                transform: `scale(${ZOOMS[round - 1] ?? 1})`,
                filter: revealed ? 'none' : 'brightness(0) contrast(1.2)',
                transition: 'filter 0.5s ease',
              }}
            />
          </div>

          <p style={{ color: timedOut ? '#ff8a80' : '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
            {revealed ? (timedOut ? t('mg.guessPoke.timeout') : t('mg.guessPoke.is', { name: current.name })) : t('mg.guessPoke.title')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', maxWidth: '360px', width: '100%' }}>
            {options.map(opt => {
              const isCorrect = revealed && opt.id === current.id
              const isWrong = revealed && opt.id === selectedId && opt.id !== current.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => choose(opt)}
                  disabled={revealed}
                  style={{
                    padding: '9px 12px', borderRadius: '10px', border: '2px solid rgba(255,255,255,0.15)',
                    background: isCorrect ? 'rgba(52,211,153,0.4)' : isWrong ? 'rgba(255,82,82,0.4)' : '#2a2a55',
                    color: '#f3f1ff', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'capitalize',
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
        <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'slideInRight 0.4s ease' }}>
          {result >= 800 ? t('mg.guessPoke.expert') : result >= 400 ? '🙂 ¡Buen ojo!' : '👀 ¡A entrenar!'} · {result} pts
        </p>
      )}
    </div>
  )
}
