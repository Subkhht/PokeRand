export interface CasinoMinigameProps {
  onComplete: (score: number) => void
}

export interface CasinoMinigameDef {
  key: string
  name: string
  desc: string
}

export const CASINO_MINIGAMES: CasinoMinigameDef[] = [
  { key: 'wheel', name: '🎡 Rueda de la Fortuna', desc: 'Pulsa para detener la rueda en la zona más alta.' },
  { key: 'slingshot', name: '🪃 Catapulta', desc: 'Carga potencia y suelta para acertar el centro de la diana.' },
  { key: 'target', name: '🎯 Tiro al Blanco', desc: 'Dispara a las dianas antes de que desaparezcan.' },
  { key: 'simon', name: '🔴 Secuencia de Luces', desc: 'Repite la secuencia cada vez más larga.' },
  { key: 'memory', name: '🃏 Memoria', desc: 'Encuentra todas las parejas con el menor número de intentos.' },
  { key: 'mole', name: '🐭 Reflejos', desc: 'Golpea a los Pokémon que salen de sus agujeros.' },
  { key: 'dice', name: '🎲 Dados', desc: 'Lanza los dados y consigue la puntuación más alta.' },
  { key: 'slots', name: '🎰 Tragamonedas', desc: 'Alinea tres símbolos iguales.' },
  { key: 'guessNum', name: '🔢 Adivina el Número', desc: 'Adivina el número secreto con pocos intentos.' },
  { key: 'guessPoke', name: '❓ ¿Quién es ese Pokémon?', desc: 'Identifica al Pokémon por su silueta.' },
  { key: 'toss', name: '⚾ Lanza la Poké Ball', desc: 'Lanza la Poké Ball con la potencia justa.' },
  { key: 'pachinko', name: '🃏 Pachinko', desc: 'Suelta la bola y llega a la casilla central.' },
  { key: 'guessType', name: '🌈 Adivina el Tipo', desc: 'Descubre el tipo principal de cada Pokémon.' },
  { key: 'trivia', name: '🧠 Trivia Pokémon', desc: 'Responde preguntas sobre tipos, números y regiones.' },
  { key: 'fishing', name: '🎣 Pesca', desc: 'Pulsa justo cuando el corcho se hunda para pescar.' },
  { key: 'catchCoins', name: '🪙 Atrapa Monedas', desc: 'Recoge monedas y evita los Voltorb que caen.' },
  { key: 'voltorbFlip', name: '💣 Voltorb Flip', desc: 'Voltea casillas y esquiva los Voltorb.' },
  { key: 'slidePuzzle', name: '🧩 Puzle Deslizante', desc: 'Ordena las fichas del Pokémon.' },
  { key: 'guessDex', name: '📖 Adivina la Pokédex', desc: 'Reconoce al Pokémon por su nombre y número.' },
]
