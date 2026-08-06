import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'
import { POKEDEX, formatDexId, randomFrom, shuffle, spriteUrl, type DexEntry } from './pokeData'
import { t } from '../game/i18n'

const ROUNDS = 5
const ROUND_SECONDS = [10, 8, 7, 6, 6]

export default function GuessDex({ onComplete }: CasinoMinigameProps): JSX.Element {
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const [started, setStarted] = useState(false)
  const [round, setRound] = useState(1)
  const [current, setCurrent] = useState<DexEntry | null>(null)
  const [options, setOptions] = useState<DexEntry[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS[0])
  const [result, setResult] = useState<number | null>(null)
  const answeredRef = useRef(false)
  const correctRef = useRef(0)

  const buildRound = useCallback((r: number): void => {
    const pick = randomFrom(POKEDEX)
    const others = shuffle(POKEDEX.filter(p => p.id !== pick.id)).slice(0, 3)
    setCurrent(pick)
    setOptions(shuffle([pick, ...others]))
    setSelectedId(null)
    setRevealed(false)
    setTimedOut(false)
    setTimeLeft(ROUND_SECONDS[r - 1] ?? 6)
    answeredRef.current = false
  }, [])

  const start = (): void => {
    playClick()
    setRound(1)
    setCorrect(0)
    correctRef.current = 0
    setResult(null)
    setStarted(true)
  }

  useEffect(() => {
    if (!started) return
    buildRound(round)
  }, [round, started, buildRound])

  const advance = useCallback((): void => {
    if (round >= ROUNDS) {
      const score = Math.min(1000, Math.round(correctRef.current * 200))
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

  const choose = (entry: DexEntry): void => {
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
    if (!started || !current || revealed || result !== null) return
    const iv = window.setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => window.clearInterval(iv)
  }, [started, current, revealed, result])

  useEffect(() => {
    if (!started || !current || revealed || result !== null || timeLeft > 0) return
    timeoutRound()
  }, [timeLeft, started, current, revealed, result, timeoutRound])

  const secondsForRound = ROUND_SECONDS[round - 1] ?? 6
  const timeFrac = timeLeft / secondsForRound

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '1.25rem 1rem 1rem' }}>
      {!started ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '3rem', animation: 'casinoBounce 0.9s ease infinite' }}>📖</div>
          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0, maxWidth: '340px' }}>
            {ROUNDS} rondas. Te damos el <strong style={{ color: '#ffcb05' }}>{t('mg.guessDex.name')}</strong> y el número de la Pokédex…
            ¡elige el sprite correcto! El tiempo cada vez es menor.
          </p>
          <button className="cta" type="button" onClick={start} style={{ background: '#f0abfc', color: '#1a1033' }}>
            📖 ¡Empezar!
          </button>
        </div>
      ) : current ? (
        <>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>
            Ronda {round}/{ROUNDS} · Aciertos: <strong style={{ color: '#ffcb05' }}>{correct}</strong>
          </p>
          {result === null && (
            <div style={{ width: '100%', maxWidth: '300px', height: '12px', background: 'rgba(0,0,0,0.45)', borderRadius: '6px', overflow: 'hidden', border: '2px solid #3f3f6e' }}>
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
          <div style={{ textAlign: 'center', animation: 'casinoSlideUp 0.3s ease' }}>
            <p style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, textTransform: 'capitalize' }}>
              {current.name}
            </p>
            <p style={{ color: '#7d7ab5', fontSize: '0.85rem', margin: '2px 0 0' }}>{formatDexId(current.id)}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', maxWidth: '320px', width: '100%' }}>
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
                    padding: '10px', borderRadius: '14px', cursor: revealed ? 'default' : 'pointer',
                    background: isCorrect ? 'rgba(52,211,153,0.35)' : isWrong ? 'rgba(255,82,82,0.35)' : '#2a2a55',
                    border: `3px solid ${isCorrect ? '#34d399' : isWrong ? '#ff5252' : 'rgba(255,255,255,0.15)'}`,
                    boxShadow: isCorrect ? '0 0 18px rgba(52,211,153,0.5)' : isWrong ? '0 0 18px rgba(255,82,82,0.5)' : 'none',
                    transition: 'transform 0.1s ease, background 0.3s ease',
                    animation: isCorrect ? 'casinoMatch 0.5s ease' : 'none',
                  }}
                >
                  <img
                    src={spriteUrl(opt.id)}
                    alt={opt.name}
                    style={{ width: '72px', height: '72px', imageRendering: 'pixelated', display: 'block', margin: '0 auto' }}
                  />
                </button>
              )
            })}
          </div>
          <p style={{ color: timedOut ? '#ff8a80' : '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
            {revealed ? (timedOut ? t('mg.guessDex.timeout') : t('mg.guessDex.correct')) : t('mg.guessDex.ask')}
          </p>
        </>
      ) : null}
      {result !== null && (
        <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
          {result >= 800 ? t('mg.guessDex.complete') : result >= 400 ? '🙂 ¡Buen ojo!' : '👀 ¡A reconocer sprites!'} · {result} pts
        </p>
      )}
    </div>
  )
}
