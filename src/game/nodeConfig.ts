// Configuración y utilidades de los nodos de ruta.

import { getLanguage, type Language } from './i18n'
import type { BranchNode, Difficulty, Pokemon, RouteNode, RunChallenges } from './types'

export function nodeTypeLabel(node: RouteNode): string {
  const en = getLanguage() === 'en'
  switch (node.type) {
    case 'battle': return en ? 'Battle' : 'Combate'
    case 'rest': return en ? 'Rest' : 'Descanso'
    case 'shop': return en ? 'Shop' : 'Tienda'
    case 'boss': return en ? 'Boss' : 'Jefe'
    case 'teamRocket': return 'TeamR'
    case 'spin': return 'Spin'
    case 'pokeRand': return 'PokeRand'
    case 'move': return 'Move'
    case 'mega': return 'Mega'
    case 'gmax': return 'G-MAX'
    case 'primal': return 'Primal'
    case 'trade': return en ? 'Trade' : 'Intercambio'
    case 'rival': return 'Rival'
    case 'blackmarket': return en ? 'Black Market' : 'Mercado Negro'
    case 'speculator': return en ? 'Speculator' : 'Especulador'
    case 'safari': return 'Safari'
    case 'orchard': return en ? 'Berry Orchard' : 'Huerto de Bayas'
    case 'fossil': return en ? 'Fossil Lab' : 'Laboratorio de Fósiles'
    case 'fishing': return en ? 'Fishing' : 'Pesca'
    case 'mine': return en ? 'Mine' : 'Mina'
    case 'daycare': return en ? 'Daycare' : 'Guardería'
    case 'weather': return en ? 'Weather Station' : 'Estación Meteorológica'
    case 'mirror': return en ? 'Mirror Battle' : 'Combate Espejo'
    case 'ranch': return en ? 'Pokémon Ranch' : 'Rancho Pokémon'
    case 'double': return en ? 'Double Battle' : 'Combate Doble'
    case 'casino': return 'Casino'
    case 'elite': return en ? 'Elite' : 'Elite'
    case 'legendary': return en ? 'Legendary' : 'Legendario'
    default: return node.type
  }
}

// Genera un tramo de ruta cooperativa (nodos + jefe final) con nodos de
// intercambio en posiciones proporcionales. Usa el RNG con semilla para que
// ambos jugadores generen exactamente el mismo tramo.
// Ruta de una etapa del Modo Original: 9 nodos (Tienda/Combate/Descanso/Rival)
// + 1 jefe que otorga una medalla al final.
export function buildOriginalStageRoute(stageNum: number): RouteNode[] {
  const types: Array<'battle' | 'shop' | 'rest' | 'rival'> = ['battle', 'battle', 'rest', 'battle', 'shop', 'rival', 'battle', 'rest', 'shop']
  const nodes: RouteNode[] = []
  for (let i = 0; i < types.length; i++) {
    const label = types[i] === 'battle' ? `Combate #${i + 1}` : types[i] === 'rest' ? 'Descanso' : types[i] === 'shop' ? 'Tienda' : 'Rival'
    nodes.push({ id: 3000 + stageNum * 100 + i, type: types[i], label, done: false })
  }
  nodes.push({ id: 4000 + stageNum, type: 'boss', label: `Jefe #${stageNum}`, done: false })
  return nodes
}

export function generateCoopRouteSegment(startId: number, totalNodes: number, rr: () => number, challenges: RunChallenges, difficulty: Difficulty = 'medium'): RouteNode[] {
  const segment: RouteNode[] = []
  let tradeCount = 2
  if (difficulty === 'hard') tradeCount = 4
  else if (difficulty === 'easy') tradeCount = 1
  const tradePositions = new Set<number>()
  if (difficulty === 'easy') {
    tradePositions.add(Math.min(totalNodes - 1, Math.ceil(totalNodes / 2)))
  } else {
    for (let t = 1; t <= tradeCount; t++) {
      tradePositions.add(Math.max(1, Math.floor((totalNodes * t) / (tradeCount + 1))))
    }
  }
  for (let i = 1; i < totalNodes; i++) {
    const id = startId + i - 1
    let type: RouteNode['type'] = 'battle'
    if (tradePositions.has(i)) {
      type = 'trade'
    } else {
      const r = rr()
      if (r < 0.18 && !challenges.noShops) {
        type = 'shop'
      } else if (r < 0.36 && !challenges.noRests) {
        type = 'rest'
      } else if (r < 0.50) {
        type = 'teamRocket'
      } else if (r < 0.62) {
        type = 'spin'
      }
    }
    segment.push({ id, type, label: `${nodeTypeLabel({ id, type, label: '', done: false })} #${id}`, done: false })
  }
  segment.push({ id: startId + totalNodes - 1, type: 'boss', label: `Combate Final (#${startId + totalNodes - 1})`, done: false })
  return segment
}

export const NODE_EMOJIS: Record<string, string> = {
  battle: '⚔️',
  rest: '🏕️',
  shop: '🏪',
  boss: '👑',
  teamRocket: '®️',
  spin: '🎰',
  pokeRand: '🎲',
  move: '🧬',
  mega: '💎',
  gmax: '⚡',
  primal: '🔮',
  trade: '🤝',
  rival: '👤',
  blackmarket: '🕶️',
  speculator: '🙊',
  safari: '🦁',
  orchard: '🫐',
  fossil: '🦖',
  fishing: '🎣',
  mine: '⛏️',
  daycare: '🥚',
  weather: '🌦️',
  mirror: '🪞',
  ranch: '🐑',
  double: '🥊',
  casino: '🃏',
  elite: '🗻',
  legendary: '🐉',
}

export const NODE_TYPE_COLORS: Record<string, string> = {
  battle: '#7d7ab5',
  rest: '#37d16b',
  shop: '#ffcb05',
  boss: '#ee3b2f',
  teamRocket: '#ee3b2f',
  spin: '#a855f7',
  pokeRand: '#4d9bff',
  move: '#56e0cd',
  mega: '#ff9ad6',
  gmax: '#9da6ff',
  primal: '#ff8a33',
  trade: '#37d16b',
  rival: '#f472b6',
  blackmarket: '#fb923c',
  speculator: '#ff8a33',
  safari: '#22c55e',
  orchard: '#a3e635',
  fossil: '#d6a66a',
  fishing: '#38bdf8',
  mine: '#c08457',
  daycare: '#fde68a',
  weather: '#60a5fa',
  mirror: '#c084fc',
  ranch: '#a3e635',
  double: '#facc15',
  casino: '#f0abfc',
  elite: '#cba3ff',
  legendary: '#ffcb05',
}

// Especulador: los tipos más raros/poderosos pagan mejor. El multiplicador es
// visible en la interfaz para que la venta sea clara.
export const SPECULATOR_TYPE_MULTIPLIERS: Record<string, number> = {
  normal: 1.00,
  bug: 1.00,
  grass: 1.05,
  water: 1.10,
  fire: 1.10,
  electric: 1.15,
  flying: 1.15,
  poison: 1.20,
  ground: 1.20,
  rock: 1.25,
  fighting: 1.30,
  ice: 1.30,
  psychic: 1.35,
  ghost: 1.40,
  dark: 1.45,
  steel: 1.50,
  fairy: 1.55,
  dragon: 1.60,
}

export interface FossilOption {
  item: string
  speciesId: number
  speciesName: string
}

export interface DaycareEgg {
  pokemon: Pokemon
  nodesLeft: number
  totalNodes: number
}

export const FOSSIL_REVIVALS: FossilOption[] = [
  { item: 'Fósil Hélix', speciesId: 138, speciesName: 'Omanyte' },
  { item: 'Fósil Domo', speciesId: 140, speciesName: 'Kabuto' },
  { item: 'Ámbar Viejo', speciesId: 142, speciesName: 'Aerodactyl' },
  { item: 'Fósil Raíz', speciesId: 345, speciesName: 'Lileep' },
  { item: 'Fósil Garra', speciesId: 347, speciesName: 'Anorith' },
  { item: 'Fósil Cráneo', speciesId: 408, speciesName: 'Cranidos' },
  { item: 'Fósil Coraza', speciesId: 410, speciesName: 'Shieldon' },
  { item: 'Fósil Tapa', speciesId: 564, speciesName: 'Tirtouga' },
  { item: 'Fósil Pluma', speciesId: 566, speciesName: 'Archen' },
  { item: 'Fósil Mandíbula', speciesId: 696, speciesName: 'Tyrunt' },
  { item: 'Fósil Vela', speciesId: 698, speciesName: 'Amaura' },
]

export function speculatorTypeMultiplier(pokemon: Pokemon): number {
  const primary = pokemon.types?.[0] ?? 'normal'
  const secondary = pokemon.types?.[1]
  const base = SPECULATOR_TYPE_MULTIPLIERS[primary] ?? 1
  return secondary && secondary !== primary ? base + 0.05 : base
}

export function speculatorPrice(pokemon: Pokemon): number {
  const bst = pokemon.baseStatTotal
    ?? pokemon.maxHp + pokemon.attack + pokemon.defense + pokemon.spAttack + pokemon.spDefense + pokemon.speed
  const base = 25 + pokemon.level * 6 + Math.floor(bst / 10)
  const typeMult = speculatorTypeMultiplier(pokemon)
  const shinyMult = pokemon.shiny ? 2 : 1
  return Math.max(20, Math.round(base * typeMult * shinyMult))
}

export function getNodeMapLayout(nodeCount: number): { positions: Array<{ x: number; y: number }>; width: number; height: number } {
  const perRow = nodeCount <= 6 ? nodeCount : Math.min(6, Math.max(4, Math.ceil(Math.sqrt(nodeCount * 2.5))))
  const rows = Math.ceil(nodeCount / perRow)
  const spacingX = 150
  const spacingY = 145
  const marginX = 75
  const width = marginX * 2 + (perRow - 1) * spacingX
  const height = 70 + (rows - 1) * spacingY + 90
  const positions: Array<{ x: number; y: number }> = []
  for (let i = 0; i < nodeCount; i++) {
    const row = Math.floor(i / perRow)
    const col = row % 2 === 0 ? i % perRow : perRow - 1 - (i % perRow)
    const rowCount = Math.min(perRow, nodeCount - row * perRow)
    const rowCenteredOffset = (row % 2 === 0 ? 1 : -1) * (perRow - rowCount) * spacingX / 2
    positions.push({ x: marginX + rowCenteredOffset + col * spacingX, y: 70 + row * spacingY })
  }
  return { positions, width, height }
}

// Posición horizontal normalizada (0..1) de un nodo dentro de su fila.
export function branchRowX(row: number, rowSize: number): number {
  return (row + 1) / (rowSize + 1)
}

// Devuelve los 2 nodos más próximos de la siguiente fila a un nodo dado. Regla
// del Modo Ruta: cada nodo solo puede avanzar a los 2 nodos más cercanos.
export function nearestBranchNodes(prev: BranchNode, prevRowSize: number, nextRow: BranchNode[]): BranchNode[] {
  if (nextRow.length <= 2) return [...nextRow]
  const prevX = branchRowX(prev.row, prevRowSize)
  return [...nextRow]
    .sort((a, b) => Math.abs(branchRowX(a.row, nextRow.length) - prevX) - Math.abs(branchRowX(b.row, nextRow.length) - prevX))
    .slice(0, 2)
}

// Diseño del mapa ramificado del Modo Ruta: cada columna se muestra como una
// fila horizontal y el avance fluye hacia abajo (de arriba a abajo), dejando
// más espacio entre nodos. Los nodos de cada fila se reparten en horizontal
// (2-3-4-3-4-3-2 + jefe final en la última fila).
export function getBranchMapLayout(columns: BranchNode[][]): { positions: Map<number, { x: number; y: number }>; width: number; height: number } {
  const spacingY = 180
  const marginY = 80
  const width = 660
  const height = marginY * 2 + (columns.length - 1) * spacingY + 70
  const positions = new Map<number, { x: number; y: number }>()
  for (let c = 0; c < columns.length; c++) {
    const n = columns[c].length
    const y = marginY + c * spacingY
    for (let r = 0; r < n; r++) {
      const x = (width * (r + 1)) / (n + 1)
      positions.set(columns[c][r].id, { x, y })
    }
  }
  return { positions, width, height }
}

// Tooltip del Pokémon (al pasar el cursor por encima en combate): muestra la
// habilidad, la naturaleza y los IVs del ejemplar en tarjetas de colores.

// Utilidades de equipos rivales y balance del primer combate.
export function trainerTeamSize(routeIndex: number, routeLength: number, difficulty: string): number {
  if (difficulty === 'infinite') {
    return Math.max(2, Math.min(6, 2 + Math.floor((routeIndex + 1) / 5)))
  }
  const progress = routeIndex / Math.max(1, routeLength - 1)
  return Math.max(2, Math.min(6, 2 + Math.floor(progress * 4)))
}

// Tamaño máximo de equipo para entrenadores normales (1 → 6). Igual que
// trainerTeamSize: monótono en Infinite para evitar picos por el crecimiento
// ilimitado de la ruta, y mantiene el rango 1..6 junto con su variación aleatoria.
export function trainerMaxSize(routeIndex: number, routeLength: number, difficulty: string): number {
  if (difficulty === 'infinite') {
    return Math.min(6, 1 + Math.floor(routeIndex / 5))
  }
  const progress = routeIndex / Math.max(1, routeLength - 1)
  return Math.max(1, Math.min(6, Math.floor(progress * 6) + 1))
}

// Reparte los niveles de un equipo de entrenador dentro de los rangos conocidos
// por dificultad, para que no todos los Pokémon tengan el mismo nivel.
// El primer Pokémon (líder) es el más fuerte y el resto baja progresivamente.
export function trainerMemberLevelOffset(idx: number, teamSize: number, isBoss: boolean, difficulty: string): number {
  const progress = idx / Math.max(1, teamSize - 1)
  const jitter = Math.floor(Math.random() * 3) - 1 // -1, 0, +1
  if (difficulty === 'easy') {
    // En Fácil los entrenadores van por debajo del promedio del equipo.
    return Math.round((1 - progress) * 2) - 2 + jitter
  }
  if (difficulty === 'infinite') {
    // -1..+3 sobre el nivel máximo del equipo
    return Math.round((1 - progress) * 4) - 1 + jitter
  }
  if (isBoss) {
    // 0..+2 por encima del promedio del equipo
    return Math.round((1 - progress) * 2) + jitter
  }
  // -1..+1 alrededor del promedio del equipo
  return Math.round((1 - progress) * 2) - 1 + jitter
}

export function getFirstHealthyIndex(team: Pokemon[], currentIndex: number): number {
  return team.findIndex((pokemon, index) => index !== currentIndex && pokemon.hp > 0)
}

// Suaviza al rival del primer combate para que no pueda debilitar al starter
// de un solo golpe: limita su ataque/at.especial según la defensa del equipo
// del jugador y rebaja la potencia de sus movimientos.
export function softenFirstBattleEnemy(enemy: Pokemon, team: Pokemon[]): Pokemon {
  const avgDef = team.reduce((s, p) => s + p.defense, 0) / Math.max(1, team.length)
  const avgSpDef = team.reduce((s, p) => s + p.spDefense, 0) / Math.max(1, team.length)
  const atkCap = Math.max(20, Math.round(avgDef * 1.2))
  const spaCap = Math.max(20, Math.round(avgSpDef * 1.2))
  const moves = enemy.moves.map((m) => (m.power ?? 0) > 50 ? { ...m, power: 50 } : m)
  return {
    ...enemy,
    attack: Math.min(enemy.attack, atkCap),
    spAttack: Math.min(enemy.spAttack, spaCap),
    moves,
  }
}


// Etiquetas de dificultad, generaciones y tamaño máximo de equipo.
export const difficultyLabels: Record<Difficulty, { title: string; desc: string }> = {
  easy: { title: 'Fácil', desc: '3 insignias · 5 rutas por etapa' },
  medium: { title: 'Intermedia', desc: '3 insignias · 10 rutas por etapa' },
  hard: { title: 'Difícil', desc: '3 insignias · 25 rutas por etapa' },
  infinite: { title: 'Infinite', desc: 'Sin límite (Aventura infinita)' },
  coliseum: { title: 'COLISEUM', desc: '8 jefes a nivel 50' },
  original: { title: 'Original', desc: '10 nodos · 8 etapas (Tienda/Combate/Descanso/Rival)' },
  branch: { title: 'Ruta', desc: 'Mapa de nodos · 8 medallas (2-3-4-3-4-3-2)' },
}

export function difficultyLabel(lang: Language, d: Difficulty): { title: string; desc: string } {
  if (lang === 'en') {
    const map: Record<Difficulty, { title: string; desc: string }> = {
      easy: { title: 'Easy', desc: '3 badges · 5 routes per stage' },
      medium: { title: 'Medium', desc: '3 badges · 10 routes per stage' },
      hard: { title: 'Hard', desc: '3 badges · 25 routes per stage' },
      infinite: { title: 'Infinite', desc: 'No limit (endless adventure)' },
      coliseum: { title: 'COLISEUM', desc: '8 bosses at level 50' },
      original: { title: 'Original', desc: '10 nodes · 8 stages (Shop/Battle/Rest/Rival)' },
      branch: { title: 'Path', desc: 'Branching node map · 8 medals (2-3-4-3-4-3-2)' },
    }
    return map[d]
  }
  return difficultyLabels[d]
}

export const generations = [1, 2, 3, 4, 5, 6, 7, 8, 9]
export const generationRegions: Record<number, string> = {
  0: 'Todas',
  1: 'Kanto',
  2: 'Johto',
  3: 'Hoenn',
  4: 'Sinnoh',
  5: 'Unova',
  6: 'Kalos',
  7: 'Alola',
  8: 'Galar',
  9: 'Paldea'
}

export const maxTeamSize = 6

