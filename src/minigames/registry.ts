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
]
