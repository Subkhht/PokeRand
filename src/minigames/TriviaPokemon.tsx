import { useState, type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import { playClick, playHit, playEvolution } from '../game/sound'
import { t } from '../game/i18n'

interface Question {
  q: string
  options: string[]
  correct: number
}

const QUESTIONS: Array<{ q: string; options: string[]; correct: number }> = [
  { q: 'What type is Pikachu?', options: ['Electric', 'Water', 'Normal', 'Grass'], correct: 0 },
  { q: 'What type is Mewtwo?', options: ['Psychic', 'Dark', 'Dragon', 'Ghost'], correct: 0 },
  { q: 'Which Pokémon evolves into Charizard?', options: ['Charmander', 'Squirtle', 'Bulbasaur', 'Pidgey'], correct: 0 },
  { q: 'What is Gengar\'s Pokédex number?', options: ['94', '42', '109', '130'], correct: 0 },
  { q: 'What type is super effective against Water?', options: ['Grass', 'Fire', 'Ice', 'Flying'], correct: 0 },
  { q: 'Which of these Pokémon is Legendary?', options: ['Mewtwo', 'Snorlax', 'Gyarados', 'Lucario'], correct: 0 },
  { q: 'Which Pokémon is Water/Ice type?', options: ['Lapras', 'Milotic', 'Starmie', 'Walrein'], correct: 0 },
  { q: 'In which generation was Lucario introduced?', options: ['4th', '1st', '3rd', '6th'], correct: 0 },
  { q: 'How much does Snorlax weigh approximately?', options: ['460 kg', '120 kg', '280 kg', '60 kg'], correct: 0 },
  { q: 'What type does NOT affect Ghost Pokémon?', options: ['Normal', 'Dark', 'Psychic', 'Fairy'], correct: 0 },
  { q: 'What is the Water starter of Kanto?', options: ['Squirtle', 'Totodile', 'Mudkip', 'Oshawott'], correct: 0 },
  { q: 'How many Pokémon types are there?', options: ['18', '15', '16', '20'], correct: 0 },
  { q: 'Which of these moves is Electric type?', options: ['Thunderbolt', 'Flamethrower', 'Hydro Pump', 'Earthquake'], correct: 0 },
  { q: 'Which Pokémon is Dragon/Flying type?', options: ['Dragonite', 'Charizard', 'Gyarados', 'Aerodactyl'], correct: 0 },
  { q: 'Which of these is NOT a starter Pokémon?', options: ['Pidgey', 'Bulbasaur', 'Chimchar', 'Oshawott'], correct: 0 },
  { q: 'What type is Eevee in its base form?', options: ['Normal', 'Electric', 'Water', 'Fairy'], correct: 0 },
  { q: 'Which Pokémon evolves from Magikarp?', options: ['Gyarados', 'Milotic', 'Lanturn', 'Wailord'], correct: 0 },
  { q: 'How tall is Pikachu?', options: ['0.4 m', '0.8 m', '1.2 m', '0.2 m'], correct: 0 },
  { q: 'What type is weak against Fighting?', options: ['Normal', 'Flying', 'Electric', 'Ghost'], correct: 0 },
  { q: 'Which of these Pokémon is Ghost type?', options: ['Gastly', 'Abra', 'Koffing', 'Grimer'], correct: 0 },
  { q: 'Which has more base HP?', options: ['Snorlax', 'Charizard', 'Blastoise', 'Pikachu'], correct: 0 },
  { q: 'What is the region of the first generation?', options: ['Kanto', 'Johto', 'Hoenn', 'Sinnoh'], correct: 0 },
  { q: 'What type is super effective against Dragon?', options: ['Fairy', 'Electric', 'Water', 'Fire'], correct: 0 },
  { q: 'Which of these Pokémon is Fighting type?', options: ['Hitmonlee', 'Drowzee', 'Machop', 'Krabby'], correct: 0 },
  { q: 'What type is weak against Electric?', options: ['Flying', 'Rock', 'Grass', 'Ice'], correct: 0 },
  { q: 'What is the Grass starter of Johto?', options: ['Chikorita', 'Treecko', 'Turtwig', 'Snivy'], correct: 0 },
  { q: 'Which Pokémon is Bug/Flying type?', options: ['Butterfree', 'Gengar', 'Onix', 'Pikachu'], correct: 0 },
  { q: 'Which of these moves is Psychic type?', options: ['Confusion', 'Vine Whip', 'Bubble', 'Scratch'], correct: 0 },
  { q: 'Which Eeveelution is obtained with a Thunder Stone?', options: ['Jolteon', 'Vaporeon', 'Flareon', 'Espeon'], correct: 0 },
  { q: 'What is Charizard\'s Pokédex number?', options: ['6', '150', '25', '94'], correct: 0 },
  { q: 'What type does NOT affect Steel Pokémon?', options: ['Poison', 'Fire', 'Fighting', 'Ground'], correct: 0 },
  { q: 'Which of these is Dark type?', options: ['Umbreon', 'Espeon', 'Vaporeon', 'Jolteon'], correct: 0 },
  { q: 'How much does Magikarp weigh?', options: ['10 kg', '2 kg', '30 kg', '55 kg'], correct: 0 },
  { q: 'What is the most famous Pokémon of the franchise?', options: ['Pikachu', 'Charizard', 'Mewtwo', 'Eevee'], correct: 0 },
  { q: 'What types does Gardevoir have?', options: ['Psychic and Fairy', 'Psychic and Electric', 'Fairy and Flying', 'Psychic and Ghost'], correct: 0 },
  { q: 'In which generation was the Fairy type introduced?', options: ['6th', '3rd', '5th', '8th'], correct: 0 },
  { q: 'Which of these is a Water Legendary?', options: ['Suicune', 'Gyarados', 'Lapras', 'Milotic'], correct: 0 },
  { q: 'Which Pokémon has a Gigantamax form?', options: ['Charizard', 'Pikachu', 'Mewtwo', 'Snorlax'], correct: 0 },
  { q: 'What type is super effective against Rock?', options: ['Water', 'Electric', 'Dragon', 'Dark'], correct: 0 },
  { q: 'Which of these moves is Fire type?', options: ['Flamethrower', 'Thunderbolt', 'Hydro Pump', 'Ice Beam'], correct: 0 },
  { q: 'Which Pokémon is number 25 in the Pokédex?', options: ['Pikachu', 'Eevee', 'Meowth', 'Psyduck'], correct: 0 },
  { q: 'What type is immune to Ground attacks?', options: ['Flying', 'Ice', 'Water', 'Electric'], correct: 0 },
  { q: 'Which Pokémon is known as the "Rat Pokémon"?', options: ['Rattata', 'Meowth', 'Zubat', 'Pidgey'], correct: 0 },
  { q: 'Which is Eevee\'s evolution with a Leaf Stone?', options: ['Leafeon', 'Glaceon', 'Jolteon', 'Espeon'], correct: 0 },
]
const ROUNDS = 6

// Baraja las opciones de una pregunta y recalcula la posición de la correcta,
// para que no esté siempre en la misma casilla (arriba a la izquierda).
function prepareQuestion(q: (typeof QUESTIONS)[number]): Question {
  const options = [...q.options]
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }
  return { q: q.q, options, correct: options.indexOf(q.options[q.correct]) }
}

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
    setCurrent(prepareQuestion(QUESTIONS[idx]))
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
    setCurrent(prepareQuestion(QUESTIONS[idx]))
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
          {result >= 800 ? t('mg.trivia.encyclopedia') : result >= 400 ? t('mg.trivia.notBad') : '📚 ¡A repasar!'} · {result} pts
        </p>
      )}
    </div>
  )
}
