import { useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'

interface Question {
  q: string
  options: string[]
  correct: number
}

const QUESTIONS: Array<{ q: string; options: string[]; correct: number }> = [
  { q: '¿Cuál es el tipo de Pikachu?', options: ['Eléctrico', 'Agua', 'Normal', 'Planta'], correct: 0 },
  { q: '¿De qué tipo es Mewtwo?', options: ['Psíquico', 'Siniestro', 'Dragón', 'Fantasma'], correct: 0 },
  { q: '¿Qué Pokémon evoluciona a Charizard?', options: ['Charmander', 'Squirtle', 'Bulbasaur', 'Pidgey'], correct: 0 },
  { q: '¿Cuál es el número de la Pokédex de Gengar?', options: ['94', '42', '109', '130'], correct: 0 },
  { q: '¿Qué tipo es súper eficaz contra Agua?', options: ['Planta', 'Fuego', 'Hielo', 'Volador'], correct: 0 },
  { q: '¿Cuál de estos Pokémon es Legendario?', options: ['Mewtwo', 'Snorlax', 'Gyarados', 'Lucario'], correct: 0 },
  { q: '¿Qué Pokémon es de tipos Agua y Hielo?', options: ['Lapras', 'Milotic', 'Starmie', 'Walrein'], correct: 0 },
  { q: '¿En qué generación aparece Lucario por primera vez?', options: ['4ª', '1ª', '3ª', '6ª'], correct: 0 },
  { q: '¿Cuánto pesa aproximadamente Snorlax?', options: ['460 kg', '120 kg', '280 kg', '60 kg'], correct: 0 },
  { q: '¿Qué tipo NO afecta a los Pokémon Fantasma?', options: ['Normal', 'Siniestro', 'Psíquico', 'Hada'], correct: 0 },
  { q: '¿Cuál es el inicial de tipo Agua de Kanto?', options: ['Squirtle', 'Totodile', 'Mudkip', 'Oshawott'], correct: 0 },
  { q: '¿Cuántos tipos de Pokémon existen?', options: ['18', '15', '16', '20'], correct: 0 },
  { q: '¿Cuál de estos ataques es de tipo Eléctrico?', options: ['Rayo', 'Lanzallamas', 'Hidrobomba', 'Terremoto'], correct: 0 },
  { q: '¿Qué Pokémon tiene los tipos Dragón y Volador?', options: ['Dragonite', 'Charizard', 'Gyarados', 'Aerodactyl'], correct: 0 },
  { q: '¿Cuál de estos NO es un Pokémon inicial?', options: ['Pidgey', 'Bulbasaur', 'Chimchar', 'Oshawott'], correct: 0 },
  { q: '¿Qué tipo tiene Eevee en su forma base?', options: ['Normal', 'Eléctrico', 'Agua', 'Hada'], correct: 0 },
  { q: '¿Qué Pokémon evoluciona de Magikarp?', options: ['Gyarados', 'Milotic', 'Lanturn', 'Wailord'], correct: 0 },
  { q: '¿Cuál es la altura de Pikachu?', options: ['0,4 m', '0,8 m', '1,2 m', '0,2 m'], correct: 0 },
  { q: '¿Qué tipo es débil contra el tipo Lucha?', options: ['Normal', 'Volador', 'Eléctrico', 'Fantasma'], correct: 0 },
  { q: '¿Cuál de estos Pokémon es de tipo Fantasma?', options: ['Gastly', 'Abra', 'Koffing', 'Grimer'], correct: 0 },
  { q: '¿Cuál tiene más PS base?', options: ['Snorlax', 'Charizard', 'Blastoise', 'Pikachu'], correct: 0 },
  { q: '¿Cuál es la región de la primera generación?', options: ['Kanto', 'Johto', 'Hoenn', 'Sinnoh'], correct: 0 },
  { q: '¿Qué tipo es súper eficaz contra Dragón?', options: ['Hada', 'Eléctrico', 'Agua', 'Fuego'], correct: 0 },
  { q: '¿Cuál de estos Pokémon es de tipo Lucha?', options: ['Hitmonlee', 'Drowzee', 'Machop', 'Hitmonlee'], correct: 0 },
  { q: '¿Qué tipo es débil contra Eléctrico?', options: ['Volador', 'Roca', 'Planta', 'Hielo'], correct: 0 },
  { q: '¿Cuál es el inicial de Planta de Johto?', options: ['Chikorita', 'Treecko', 'Turtwig', 'Snivy'], correct: 0 },
  { q: '¿Qué Pokémon es de tipos Bicho y Volador?', options: ['Butterfree', 'Gengar', 'Onix', 'Pikachu'], correct: 0 },
  { q: '¿Cuál de estos ataques es de tipo Psíquico?', options: ['Confusión', 'Látigo Cepa', 'Burbuja', 'Garra'], correct: 0 },
  { q: '¿Qué Eeveelution se consigue con la Piedra Trueno?', options: ['Jolteon', 'Vaporeon', 'Flareon', 'Espeon'], correct: 0 },
  { q: '¿Cuál es el número de la Pokédex de Charizard?', options: ['6', '150', '25', '94'], correct: 0 },
  { q: '¿Qué tipo NO afecta a los Pokémon de Acero?', options: ['Veneno', 'Fuego', 'Lucha', 'Tierra'], correct: 0 },
  { q: '¿Cuál de estos es de tipo Siniestro?', options: ['Umbreon', 'Espeon', 'Vaporeon', 'Jolteon'], correct: 0 },
  { q: '¿Cuánto pesa Magikarp?', options: ['10 kg', '2 kg', '30 kg', '55 kg'], correct: 0 },
  { q: '¿Cuál es el Pokémon más famoso de la franquicia?', options: ['Pikachu', 'Charizard', 'Mewtwo', 'Eevee'], correct: 0 },
  { q: '¿Qué tipos tiene Gardevoir?', options: ['Psíquico y Hada', 'Psíquico y Eléctrico', 'Hada y Volador', 'Psíquico y Fantasma'], correct: 0 },
  { q: '¿En qué generación se introdujo el tipo Hada?', options: ['6ª', '3ª', '5ª', '8ª'], correct: 0 },
  { q: '¿Cuál de estos es un Legendario de tipo Agua?', options: ['Suicune', 'Gyarados', 'Lapras', 'Milotic'], correct: 0 },
  { q: '¿Qué Pokémon tiene una forma Gigamax?', options: ['Charizard', 'Pikachu', 'Mewtwo', 'Snorlax'], correct: 0 },
  { q: '¿Qué tipo es súper eficaz contra Roca?', options: ['Agua', 'Eléctrico', 'Dragón', 'Siniestro'], correct: 0 },
  { q: '¿Cuál de estos ataques es de tipo Fuego?', options: ['Lanzallamas', 'Rayo', 'Hidrobomba', 'Rayo de Hielo'], correct: 0 },
  { q: '¿Qué Pokémon es el número 25 de la Pokédex?', options: ['Pikachu', 'Eevee', 'Meowth', 'Psyduck'], correct: 0 },
  { q: '¿Qué tipo es inmune a los ataques de Tierra?', options: ['Volador', 'Hielo', 'Agua', 'Eléctrico'], correct: 0 },
  { q: '¿Qué Pokémon es conocido como el "Pokémon Rata"?', options: ['Rattata', 'Meowth', 'Zubat', 'Pidgey'], correct: 0 },
  { q: '¿Cuál es la evolución de Eevee con la Piedra Hoja?', options: ['Leafeon', 'Glaceon', 'Jolteon', 'Espeon'], correct: 0 },
]

const ROUNDS = 6

export default function TriviaPokemon({ onComplete }: CasinoMinigameProps): JSX.Element {
  const [started, setStarted] = useState(false)
  const [round, setRound] = useState(1)
  const [current, setCurrent] = useState<Question | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [result, setResult] = useState<number | null>(null)
  const [used, setUsed] = useState<Set<number>>(new Set())

  const start = (): void => {
    playClick()
    const idx = Math.floor(Math.random() * QUESTIONS.length)
    setUsed(new Set([idx]))
    setCurrent(QUESTIONS[idx])
    setRound(1)
    setCorrect(0)
    setResult(null)
    setStarted(true)
    setRevealed(false)
    setSelected(null)
  }

  const nextRound = (): void => {
    const pool = QUESTIONS.map((_, i) => i).filter(i => !used.has(i))
    const idx = pool[Math.floor(Math.random() * pool.length)]
    setUsed(prev => new Set(prev).add(idx))
    setCurrent(QUESTIONS[idx])
    setRound(r => r + 1)
    setRevealed(false)
    setSelected(null)
  }

  const choose = (optIdx: number): void => {
    if (!current || revealed || result !== null) return
    setSelected(optIdx)
    setRevealed(true)
    const isCorrect = optIdx === current.correct
    if (isCorrect) {
      playEvolution()
      setCorrect(c => c + 1)
    } else {
      playHit()
    }
    setTimeout(() => {
      if (round >= ROUNDS) {
        const score = Math.round((correct + (isCorrect ? 1 : 0)) / ROUNDS * 1000)
        setResult(score)
        setTimeout(() => onComplete(score), 900)
      } else {
        nextRound()
      }
    }, 1200)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '1.25rem 1rem 1rem' }}>
      {!started ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '3rem', animation: 'casinoBounce 0.9s ease infinite' }}>🧠</div>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0, maxWidth: '340px' }}>
            {ROUNDS} preguntas sobre Pokémon. Tipos, números, regiones y curiosidades. ¿Cuánto sabes?
          </p>
          <button className="cta" type="button" onClick={start} style={{ background: '#f0abfc', color: '#1a1033' }}>
            🧠 ¡Empezar!
          </button>
        </div>
      ) : current ? (
        <>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>
            Pregunta {round}/{ROUNDS} · Aciertos: <strong style={{ color: '#ffcb05' }}>{correct}</strong>
          </p>
          <div
            style={{
              background: 'linear-gradient(160deg, rgba(240,171,252,0.12), rgba(240,171,252,0.03))',
              border: '2px solid rgba(240,171,252,0.5)',
              borderRadius: '12px', padding: '1rem 1.2rem', maxWidth: '420px', width: '100%',
              animation: 'casinoSlideUp 0.35s ease',
            }}
          >
            <p style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '1rem', margin: 0, textAlign: 'center' }}>
              {current.q}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', maxWidth: '420px', width: '100%' }}>
            {current.options.map((opt, i) => {
              const isCorrect = revealed && i === current.correct
              const isWrong = revealed && i === selected && i !== current.correct
              return (
                <button
                  key={`${i}-${opt}`}
                  type="button"
                  onClick={() => choose(i)}
                  disabled={revealed}
                  style={{
                    padding: '12px 14px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.9rem',
                    background: isCorrect ? 'rgba(52,211,153,0.4)' : isWrong ? 'rgba(255,82,82,0.4)' : '#2a2a55',
                    border: `2px solid ${isCorrect ? '#34d399' : isWrong ? '#ff5252' : 'rgba(255,255,255,0.2)'}`,
                    color: '#f3f1ff', cursor: revealed ? 'default' : 'pointer',
                    transition: 'transform 0.1s ease, background 0.3s ease',
                    animation: revealed && isCorrect ? 'casinoMatch 0.5s ease' : 'none',
                  }}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </>
      ) : null}
      {result !== null && (
        <p style={{ color: result >= 800 ? '#ffcb05' : result >= 400 ? '#34d399' : '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem', margin: 0, animation: 'casinoSlideUp 0.4s ease' }}>
          {result >= 800 ? '🏆 ¡Poké-enciclopedia!' : result >= 400 ? '🙂 ¡No está mal!' : '📚 ¡A repasar!'} · {result} pts
        </p>
      )}
    </div>
  )
}
