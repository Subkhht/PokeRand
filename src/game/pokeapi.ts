import type { Move, Pokemon, RawLevelUpMove, StatusType, StatChange } from './types'
import { getLanguage } from './i18n'

const API_BASE = 'https://pokeapi.co/api/v2'

// Nivel mínimo de aparición para formas que evolucionan por piedra, intercambio,
// amistad, etc. Sin un nivel de evolución definido, no deben aparecer al principio.
const SPECIAL_EVOLUTION_MIN_APPEAR_LEVEL = 20

const generationSpeciesCache = new Map<number, number[]>()
const pokemonCache = new Map<string | number, Pokemon>()
const moveDetailsCache = new Map<string, Move>()
const legendaryIdsCache = new Map<number, Promise<Set<number>>>()
let allFormIdsPromise: Promise<number[]> | null = null
let runSeed = 0

export function setRunSeed(seed: number): void {
  runSeed = seed
  // Al cambiar de run, se limpia la caché de Pokémon para que los movimientos
  // se reconstruyan con la configuración actual (p. ej. chance de estado).
  pokemonCache.clear()
}

interface PokeApiNamedResource {
  name: string
  url: string
}

interface PokeApiPokemon {
  id: number
  name: string
  sprites: {
    front_default: string | null
    other?: {
      showdown?: {
        front_default: string | null
      }
    }
    versions?: {
      'generation-v'?: {
        'black-white'?: {
          animated?: {
            front_default: string | null
          }
        }
      }
    }
  }
  stats: Array<{
    base_stat: number
    stat: PokeApiNamedResource
  }>
  types: Array<{
    slot: number
    type: PokeApiNamedResource
  }>
  moves: Array<{
    move: PokeApiNamedResource
  }>
}

interface EvolutionChainNode {
  species: PokeApiNamedResource
  evolves_to: EvolutionChainNode[]
  evolution_details?: Array<{
    evolved_form?: PokeApiNamedResource | null
    min_level?: number | null
    trigger?: { name: string } | null
    item?: { name: string } | null
    held_item?: { name: string } | null
  }>
}

// IDs oficiales de los starters por generación
export const startersByGen: Record<number, number[]> = {
  1: [1, 4, 7, 25, 133], // Bulbasaur, Charmander, Squirtle, Pikachu, Eevee
  2: [152, 155, 158], // Chikorita, Cyndaquil, Totodile
  3: [252, 255, 258], // Treecko, Torchic, Mudkip
  4: [387, 390, 393], // Turtwig, Chimchar, Piplup
  5: [495, 498, 501], // Snivy, Tepig, Oshawott
  6: [650, 653, 656], // Chespin, Fennekin, Froakie
  7: [722, 725, 728], // Rowlet, Litten, Popplio
  8: [810, 813, 816], // Grookey, Scorbunny, Sobble
  9: [906, 909, 912]  // Sprigatito, Fuecoco, Quaxly
}

export interface PokemonDetails {
  id: number
  name: string
  highResImage: string
  description: string
  height: number
  weight: number
  types: string[]
  stats: Array<{ name: string; value: number }>
  evolutions: Array<{ id: number; name: string; sprite: string; level: number | null; trigger: string }>
}

function extractEvolutionLine(chainNode: EvolutionChainNode, targetId: number): Array<{ id: number; name: string; sprite: string; level: number | null; trigger: string }> {
  const allNodes: Array<{ id: number; name: string; level: number | null; trigger: string; speciesUrl: string }> = []

  function walk(node: EvolutionChainNode, parentLevel: number | null, parentTrigger: string) {
    const match = node.species.url.match(/\/pokemon-species\/(\d+)\//)
    const id = match ? parseInt(match[1], 10) : 0
    allNodes.push({ id, name: node.species.name, level: parentLevel, trigger: parentTrigger, speciesUrl: node.species.url })
    for (const evo of node.evolves_to) {
      const details = evo.evolution_details?.[0]
      const evoLevel = details?.min_level ?? null
      const evoTrigger = details?.trigger?.name ?? 'level-up'
      walk(evo, evoLevel, evoTrigger)
    }
  }

  walk(chainNode, null, 'level-up')

  const targetIdx = allNodes.findIndex(n => n.id === targetId)
  if (targetIdx === -1) return []

  const result = allNodes.map(n => ({
    id: n.id,
    name: n.name,
    sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${n.id}.png`,
    level: n.level,
    trigger: n.trigger,
  }))

  return result
}

export async function fetchPokemonDetails(id: number): Promise<PokemonDetails> {
  const resPokemon = await fetch(`${API_BASE}/pokemon/${id}`)
  const dataPokemon = await resPokemon.json()

  const lang = getLanguage()
  const flavorLang = lang === 'en' ? 'en' : 'es'
  const fallbackLang = lang === 'en' ? 'es' : 'en'
  let description = lang === 'en' ? 'No description available.' : 'Sin descripción disponible.'
  try {
    const resSpecies = await fetch(`${API_BASE}/pokemon-species/${id}`)
    if (resSpecies.ok) {
      const dataSpecies = await resSpecies.json()
      const flavorEntry = dataSpecies.flavor_text_entries.find(
        (entry: any) => entry.language.name === flavorLang
      ) ?? dataSpecies.flavor_text_entries.find(
        (entry: any) => entry.language.name === fallbackLang
      )
      if (flavorEntry) {
        description = flavorEntry.flavor_text.replace(/[\n\f]/g, ' ')
      }
    }
  } catch {}

  const highResImage = dataPokemon.sprites.other?.['official-artwork']?.front_default 
    || dataPokemon.sprites.front_default

  const STAT_NAMES: Record<string, string> = lang === 'en'
    ? {
      'hp': 'HP',
      'attack': 'Attack',
      'defense': 'Defense',
      'special-attack': 'Sp. Atk',
      'special-defense': 'Sp. Def',
      'speed': 'Speed'
    }
    : {
      'hp': 'HP',
      'attack': 'Ataque',
      'defense': 'Defensa',
      'special-attack': 'Atq. Esp.',
      'special-defense': 'Def. Esp.',
      'speed': 'Velocidad'
    }

  let evolutions: Array<{ id: number; name: string; sprite: string; level: number | null; trigger: string }> = []
  try {
    const resSpecies = await fetch(`${API_BASE}/pokemon-species/${id}`)
    if (resSpecies.ok) {
      const dataSpecies = await resSpecies.json()
      if (dataSpecies.evolution_chain?.url) {
        const evoRes = await fetch(dataSpecies.evolution_chain.url)
        if (evoRes.ok) {
          const evoData = await evoRes.json()
          evolutions = extractEvolutionLine(evoData.chain, id)
        }
      }
    }
  } catch {}

  return {
    id: dataPokemon.id,
    name: dataPokemon.name,
    highResImage,
    description,
    height: dataPokemon.height / 10,
    weight: dataPokemon.weight / 10,
    types: dataPokemon.types.map((t: any) => t.type.name),
    stats: dataPokemon.stats.map((s: any) => ({
      name: STAT_NAMES[s.stat.name] || s.stat.name.toUpperCase(),
      value: s.base_stat
    })),
    evolutions,
  }
}

const EVOLUTION_ITEM_REVERSE: Record<string, string> = {
  'metal-coat': 'Metal Coat',
  'king-s-rock': "King's Rock",
  'dragon-scale': 'Dragon Scale',
  'up-grade': 'Up-Grade',
  'dubious-disc': 'Dubious Disc',
  'reaper-cloth': 'Reaper Cloth',
  'protector': 'Protector',
  'electirizer': 'Electirizer',
  'magmarizer': 'Magmarizer',
  'prism-scale': 'Prism Scale',
  'sachet': 'Sachet',
  'whipped-dream': 'Whipped Dream',
  'auspicious-armor': 'Auspicious Armor',
  'malicious-armor': 'Malicious Armor',
  'razor-claw': 'Razor Claw',
  'razor-fang': 'Razor Fang',
  'oval-stone': 'Oval Stone',
  'deep-sea-tooth': 'Deep Sea Tooth',
  'deep-sea-scale': 'Deep Sea Scale',
}

export function getEvolutionItemDisplayName(pokeApiName: string): string {
  return EVOLUTION_ITEM_REVERSE[pokeApiName] ?? pokeApiName
}

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function extractIdFromResourceUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/)
  if (!match) {
    throw new Error(`No se pudo extraer ID desde ${url}`)
  }
  return Number(match[1])
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function makeShinySprite(sprite: string, id: number): string {
  if (sprite.includes('/showdown/') && !sprite.includes('/animated/')) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${id}.gif`
  }
  if (sprite.includes('/animated/')) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/shiny/${id}.gif`
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Fallo al pedir ${url}: ${response.status}`)
  }
  return (await response.json()) as T
}

const REGIONAL_FORM_RANGES = [
  [10001, 10032],
  [10080, 10086],
  [10091, 10116],
  [10118, 10157],
  [10160, 10194],
  [10229, 10263],
  [10272, 10277],
]

async function getAllFormIds(): Promise<number[]> {
  if (allFormIdsPromise) return allFormIdsPromise

  allFormIdsPromise = (async () => {
    const data = await fetchJson<{ results: PokeApiNamedResource[] }>(
      `${API_BASE}/pokemon?limit=1351&offset=0`
    )
    const allIds = data.results.map(r => extractIdFromResourceUrl(r.url))
    return allIds.filter(id => REGIONAL_FORM_RANGES.some(([lo, hi]) => id >= lo && id <= hi))
  })()

  return allFormIdsPromise
}

export async function getSpeciesIdsByGeneration(generation: number): Promise<number[]> {
  const cached = generationSpeciesCache.get(generation)
  if (cached) return cached

  const generationData = await fetchJson<{ pokemon_species: PokeApiNamedResource[] }>(
    `${API_BASE}/generation/${generation}`
  )

  const ids = generationData.pokemon_species.map((species) => extractIdFromResourceUrl(species.url))
  generationSpeciesCache.set(generation, ids)
  return ids
}

async function getLegendaryIdsByGeneration(generation: number): Promise<Set<number>> {
  const cached = legendaryIdsCache.get(generation)
  if (cached) return cached

  const promise = (async () => {
    const ids = await getSpeciesIdsByGeneration(generation)
    const flags = await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetch(`${API_BASE}/pokemon-species/${id}`)
        if (!res.ok) return false
        const data = await res.json()
        return data.is_legendary === true || data.is_mythical === true
      } catch {
        return false
      }
    }))
    const set = new Set<number>()
    ids.forEach((id, index) => {
      if (flags[index]) set.add(id)
    })
    return set
  })()

  legendaryIdsCache.set(generation, promise)
  return promise
}

// 1. Obtiene detalles del movimiento y descarta los de estado/sin daño
const AILMENT_MAP: Record<string, StatusType> = {
  'burn': 'burn',
  'poison': 'poison',
  'paralysis': 'paralysis',
  'freeze': 'freeze',
  'sleep': 'sleep',
  'confusion': 'confusion',
  'flinch': 'flinch',
}
export async function getMoveDetails(moveUrl: string): Promise<Move | null> {
  const cached = moveDetailsCache.get(moveUrl)
  if (cached) return cached
  try {
    const res = await fetch(moveUrl)
    const data = await res.json()

    // Solo se aceptan movimientos de DAÑO (physical/special). Los movimientos de
    // estado (damage_class 'status', potencia 0) se descartan salvo Drenadoras
    // (Leech Seed), que funciona bien. Así los Pokémon solo tienen ataques de
    // daño + Drenadoras.
    const dc = data.damage_class?.name
    // El ailment puede venir en el nivel raíz o dentro de meta según la versión
    // de la API/caché del navegador. Se comprueban ambos.
    const ailmentName = data.meta?.ailment?.name ?? data.ailment?.name
    const isLeechSeed = ailmentName === 'leech-seed'
    if (dc !== 'physical' && dc !== 'special' && dc !== 'status') return null
    if (dc === 'status' && !isLeechSeed) return null
    if ((dc === 'physical' || dc === 'special') && (!data.power || data.power <= 0)) return null

    const esName = data.names?.find((n: any) => n.language?.name === 'es')?.name
    const moveName = esName || capitalize(data.name.replace(/-/g, ' '))
    const enName = data.names?.find((n: any) => n.language?.name === 'en')?.name || capitalize(data.name.replace(/-/g, ' '))

    const ailmentRaw = ailmentName
    const flinchRaw = data.meta?.flinch_chance ?? 0
    // El flinch (aturdimiento) se parsea aparte: muchos movimientos de daño lo
    // tienen en meta.flinch_chance. Si el movimiento también trae una afección
    // real (quemadura, parálisis, veneno...), esa tiene prioridad; el flinch
    // solo se usa cuando no hay afección principal (p. ej. Ataque Rápido no,
    // pero Golpe Cabeza sí que solo aturde).
    let ailment: StatusType | undefined
    let ailmentChance: number | undefined
    if (ailmentRaw && AILMENT_MAP[ailmentRaw]) {
      ailment = AILMENT_MAP[ailmentRaw]
      // En movimientos de ESTADO, si tienen afección y PokeAPI no da chance
      // (ailment_chance 0/null, p. ej. Yawn), se considera garantizada al 100%.
      // En movimientos de daño, la chance es la que indica la API.
      if (dc === 'status') {
        ailmentChance = (data.meta?.ailment_chance ?? 0) > 0 ? data.meta.ailment_chance / 100 : 1
      } else {
        ailmentChance = (data.meta?.ailment_chance ?? 0) > 0 ? data.meta.ailment_chance / 100 : undefined
      }
    } else if (flinchRaw > 0) {
      ailment = 'flinch'
      ailmentChance = flinchRaw / 100
    }

    const minHits = data.meta?.min_hits ?? undefined
    const maxHits = data.meta?.max_hits ?? undefined

    const recoilCategory = data.meta?.category?.name === 'recoil' || data.meta?.category?.name === 'damage+recoil' || data.meta?.category?.name === 'recoil-percent'
    const rawDrain = data.meta?.drain ?? 0
    const recoilPercent = recoilCategory && rawDrain < 0 ? Math.abs(rawDrain) / 100 : undefined
    const drainPercent = rawDrain > 0 ? rawDrain / 100 : undefined

    const critRateStage: number | undefined = (data.meta?.crit_rate ?? 0) > 0 ? data.meta.crit_rate : undefined

    const priority = data.priority ?? 0

    const statChance = data.meta?.stat_chance ?? undefined

    // Algunos movimientos suben la Velocidad del usuario en generaciones modernas
    // (p. ej. Rapid Spin desde Gen 8), pero en este juego se prefiere el
    // comportamiento clásico sin ese boost. Se filtra el stat change aquí.
    const NO_SPEED_BOOST = new Set(['rapid-spin'])
    const statChanges: StatChange[] | undefined = data.stat_changes?.length > 0
      ? data.stat_changes.map((sc: any) => ({
          stat: sc.stat.name === 'attack' ? 'attack' : sc.stat.name === 'defense' ? 'defense' : sc.stat.name === 'speed' ? 'speed' : sc.stat.name === 'special-attack' ? 'special-attack' : sc.stat.name === 'special-defense' ? 'special-defense' : null,
          change: sc.change,
          chance: statChance,
        })).filter((sc: StatChange | null) => sc !== null)
        .filter((sc: StatChange) => !(NO_SPEED_BOOST.has(data.name) && sc.stat === 'speed'))
      : undefined

    const metaCategory = data.meta?.category?.name ?? undefined

    // Descripción con preferencia al español: se intenta el short_effect en 'es',
    // luego el efecto completo en 'es', y como último recurso el inglés.
    const esEntry = data.effect_entries?.find((e: any) => e.language.name === 'es')
    const enEntry = data.effect_entries?.find((e: any) => e.language.name === 'en')
    const cleanText = (s: string): string => s
      .replace(/\$effect_chance/g, String(data.meta?.ailment_chance ?? data.meta?.stat_chance ?? 100))
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const description = cleanText(
      esEntry?.short_effect || esEntry?.effect || enEntry?.short_effect || enEntry?.effect || 'Ataque de daño directo.'
    )

    const move: Move = {
      name: moveName,
      enName,
      type: data.type.name,
      power: data.power,
      accuracy: data.accuracy ?? 100,
      description,
      url: moveUrl,
      damageClass: data.damage_class?.name === 'special' ? 'special' : 'physical',
      leechSeed: ailmentName === 'leech-seed' || /leech-seed|drenadoras/i.test(moveName),
      disable: ailmentName === 'disable' || /disable|anulación/i.test(moveName),
      fakeOut: data.name === 'fake-out' || /fake-out|abatimiento|sorpresa/i.test(moveName),
      ailment,
      ailmentChance,
      minHits,
      maxHits,
      recoilPercent,
      drainPercent,
      critRatio: critRateStage,
      priority,
      statChanges,
      statChance,
      metaCategory,
    }
    moveDetailsCache.set(moveUrl, move)
    return move
  } catch {
    return null
  }
}

// Límite realista de potencia de movimiento según el nivel del Pokémon
export function getMaxMovePowerForLevel(level: number, difficulty: string = 'medium'): number {
  if (difficulty.startsWith('coliseum')) return 150
  if (difficulty === 'easy') {
    if (level <= 12) return 45
    if (level <= 22) return 65
    return 120
  }
  if (difficulty === 'hard' || difficulty === 'infinite') {
    // Early-game: los rivales no deben arrasar con movimientos de 85+ de potencia
    // cuando el starter del jugador ronda el nivel 10. Se sube gradualmente.
    if (level <= 12) return 65
    if (level <= 20) return 85
    return 150
  }
  if (level <= 12) return 60
  if (level <= 22) return 85
  return 150
}

// Lista de ataques básicos de relleno por si el Pokémon tiene menos de 4 ataques de daño válidos
const FALLBACK_MOVES: Move[] = [
  { name: 'Placaje', enName: 'Tackle', type: 'normal', power: 40, accuracy: 100, description: 'Ataque físico básico.', priority: 0, damageClass: 'physical' },
  { name: 'Ataque Rápido', enName: 'Quick Attack', type: 'normal', power: 40, accuracy: 100, description: 'Ataque rápido de daño directo.', priority: 1, damageClass: 'physical' },
  { name: 'Cabezazo', enName: 'Headbutt', type: 'normal', power: 70, accuracy: 100, description: 'Golpe de cabeza potente.', priority: 0, damageClass: 'physical' },
  { name: 'Derribo', enName: 'Take Down', type: 'normal', power: 90, accuracy: 85, description: 'Carga contundente de gran impacto.', priority: 0, damageClass: 'physical' }
]

// Procesa movimientos asignando solo aquellos acordes al nivel actual del Pokémon
export async function fetchPokemonMoves(
  moveEntries: any[],
  level: number = 10,
  difficulty: string = 'medium',
  pokemonId?: number
): Promise<{ moves: Move[]; rawLevelUpMoves: RawLevelUpMove[] }> {
  const maxAllowedPower = getMaxMovePowerForLevel(level, difficulty)

  const rawLevelUpMoves: RawLevelUpMove[] = []
  for (const m of moveEntries) {
    const details = m.version_group_details || []
    const levelUpDetail = details.find((d: any) => d.move_learn_method?.name === 'level-up')
    if (levelUpDetail) {
      rawLevelUpMoves.push({
        name: capitalize(m.move.name.replace(/-/g, ' ')),
        url: m.move.url,
        level: levelUpDetail.level_learned_at ?? 1
      })
    }
  }

  rawLevelUpMoves.sort((a, b) => a.level - b.level)

  const eligibleLevelUp = rawLevelUpMoves.filter((m) => m.level <= level)
  const candidatePool = eligibleLevelUp.length >= 4 ? eligibleLevelUp : rawLevelUpMoves.slice(0, 10)

  if (difficulty.startsWith('coliseum')) {
    const movesByPower: Array<{ entry: typeof rawLevelUpMoves[0]; power: number }> = []
    for (const entry of candidatePool) {
      const move = await getMoveDetails(entry.url)
      if (move && move.power > 0) {
        movesByPower.push({ entry, power: move.power })
      }
    }
    movesByPower.sort((a, b) => b.power - a.power)
    const topPool = movesByPower.slice(0, Math.min(10, movesByPower.length))
    const shuffled = [...topPool].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, 4)
    const moves: Move[] = []
    const seenNames = new Set<string>()
    for (const { entry } of selected) {
      if (seenNames.has(entry.name)) continue
      seenNames.add(entry.name)
      const move = await getMoveDetails(entry.url)
      if (move) moves.push(move)
    }
    return { moves, rawLevelUpMoves }
  }

  const shuffledCandidates = [...candidatePool].sort(() => 0.5 - Math.random())
  const validMoves: Move[] = []
  const seenNames = new Set<string>()

  for (const entry of shuffledCandidates) {
    if (validMoves.length >= 4) break
    const move = await getMoveDetails(entry.url)
    if (move && move.power <= maxAllowedPower && !seenNames.has(move.name)) {
      seenNames.add(move.name)
      validMoves.push(move)
    }
  }

  if (validMoves.length < 4) {
    for (const entry of rawLevelUpMoves) {
      if (validMoves.length >= 4) break
      if (seenNames.has(entry.name)) continue
      const move = await getMoveDetails(entry.url)
      if (move && move.power <= maxAllowedPower && !seenNames.has(move.name)) {
        seenNames.add(move.name)
        validMoves.push(move)
      }
    }
  }

  // Charmander siempre aprende Ascuas (Ember): si aparece en sus movimientos de
  // nivel, se garantiza que esté en el moveset de los 4 ataques.
  if (pokemonId === 4 && !seenNames.has('Ascuas') && !seenNames.has('Ember')) {
    const emberEntry = rawLevelUpMoves.find((m) => /ember|ascuas/i.test(m.name))
    if (emberEntry) {
      const ember = await getMoveDetails(emberEntry.url)
      if (ember && ember.power <= maxAllowedPower) {
        if (validMoves.length < 4) {
          validMoves.push(ember)
        } else {
          // Reemplaza el movimiento de menor potencia para dejar sitio a Ascuas.
          let minIdx = 0
          for (let i = 1; i < validMoves.length; i++) {
            if ((validMoves[i].power ?? 0) < (validMoves[minIdx].power ?? 0)) minIdx = i
          }
          validMoves[minIdx] = ember
        }
        seenNames.add(ember.name)
      }
    }
  }

  for (const fallback of FALLBACK_MOVES) {
    if (validMoves.length === 4) break
    if (!seenNames.has(fallback.name) && fallback.power <= maxAllowedPower) {
      validMoves.push(fallback)
      seenNames.add(fallback.name)
    }
  }

  while (validMoves.length < 4) {
    const basicTackle: Move = {
      name: `Tackle ${validMoves.length + 1}`,
      enName: `Tackle ${validMoves.length + 1}`,
      type: 'normal',
      power: 40,
      accuracy: 100,
      description: 'Ataque físico básico.',
      priority: 0,
      damageClass: 'physical',
    }
    validMoves.push(basicTackle)
  }

  return {
    moves: validMoves.slice(0, 4),
    rawLevelUpMoves
  }
}

export async function buildPokemonFromApi(
  identifier: string | number,
  _generation: number,
  targetLevel: number = 10,
  shiny: boolean = false,
  difficulty: string = 'medium',
  bypassMinAppearLevel: boolean = false
): Promise<Pokemon> {
  const cacheKey = `${identifier}_lvl${targetLevel}_${difficulty}_b${bypassMinAppearLevel ? 1 : 0}_r${runSeed}`
  const cached = pokemonCache.get(cacheKey)
  if (cached) {
    const result = { ...cached, hp: cached.maxHp }
    if (shiny) {
      result.shiny = true
      result.sprite = makeShinySprite(result.sprite, result.id)
    }
    return result
  }

  const data = await fetchJson<PokeApiPokemon>(`${API_BASE}/pokemon/${identifier}`)

  let captureRate = 45
  try {
    const speciesRes = await fetch(`${API_BASE}/pokemon-species/${data.id}`)
    if (speciesRes.ok) {
      const speciesData = await speciesRes.json()
      captureRate = speciesData.capture_rate ?? 45
    }
  } catch {}

  const statMap = new Map(data.stats.map((entry) => [entry.stat.name, entry.base_stat]))
  const baseStatTotal = data.stats.reduce((acc, entry) => acc + entry.base_stat, 0)
  
  const { moves: parsedMoves, rawLevelUpMoves } = await fetchPokemonMoves(data.moves, targetLevel, difficulty, data.id)
  const sortedTypes = [...data.types].sort((a, b) => a.slot - b.slot).map(t => t.type.name)

  const pokemon: Pokemon = {
    id: data.id,
    name: capitalize(data.name),
    level: targetLevel,
    maxHp: (statMap.get('hp') ?? 45) + 35 + (targetLevel - 10) * 4,
    hp: (statMap.get('hp') ?? 45) + 35 + (targetLevel - 10) * 4,
    attack: (statMap.get('attack') ?? 50) + 5 + (targetLevel - 10) * 2,
    defense: (statMap.get('defense') ?? 50) + 5 + (targetLevel - 10) * 2,
    spAttack: (statMap.get('special-attack') ?? 50) + 5 + (targetLevel - 10) * 2,
    spDefense: (statMap.get('special-defense') ?? 50) + 5 + (targetLevel - 10) * 2,
    speed: (statMap.get('speed') ?? 50) + (targetLevel - 10) * 2,
    types: sortedTypes,
    baseStatTotal,
    sprite: (() => {
      const id = data.id
      const gen5Animated = data.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default
      const baseSprite = gen5Animated ?? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
      return shiny ? makeShinySprite(baseSprite, id) : baseSprite
    })(),
    shiny: shiny || undefined,
    moves: parsedMoves,
    rawLevelUpMoves,
    captureRate,
    evolutionLevel: undefined,
    evolutionChainId: data.id
  }

  const evoInfo = await getEvolutionInfo(data.id)
  if (evoInfo.nextName) {
    pokemon.evolutionLevel = evoInfo.evolutionLevel ?? undefined
    pokemon.heldItemRequired = evoInfo.heldItem ?? undefined
  }
  if (evoInfo.heldItemEvolutions.length > 0) {
    pokemon.heldItemEvolutions = evoInfo.heldItemEvolutions
  }
  pokemon.minAppearLevel = evoInfo.minAppearLevel ?? undefined

  // La forma G-MAX puede saltarse el umbral mínimo de aparición: es una forma
  // especial que se enfrenta al nivel del jugador, no depende de la cadena
  // evolutiva real (así un G-MAX Charizard puede aparecer a nivel 20).
  if (!bypassMinAppearLevel && pokemon.minAppearLevel && targetLevel < pokemon.minAppearLevel) {
    const diff = pokemon.minAppearLevel - targetLevel
    pokemon.level = pokemon.minAppearLevel
    pokemon.maxHp += diff * 4
    pokemon.hp += diff * 4
    pokemon.attack += diff * 2
    pokemon.defense += diff * 2
    pokemon.spAttack += diff * 2
    pokemon.spDefense += diff * 2
    pokemon.speed += diff * 2
    if (pokemon.evolutionLevel && pokemon.level >= pokemon.evolutionLevel) {
      pokemon.evolutionLevel = undefined
    }
  }

  pokemonCache.set(cacheKey, pokemon)
  return pokemon
}

// Verifica e imparte nuevos movimientos cuando el Pokémon sube de nivel
export async function checkAndLearnNewMove(
  pokemon: Pokemon,
  _oldLevel: number,
  newLevel: number,
  difficulty: string = 'medium'
): Promise<{ updatedPokemon: Pokemon; learnedMoveName: string | null }> {
  if (!pokemon.rawLevelUpMoves || pokemon.rawLevelUpMoves.length === 0) {
    return { updatedPokemon: pokemon, learnedMoveName: null }
  }

  const maxPower = getMaxMovePowerForLevel(newLevel, difficulty)
  const knownMoveUrls = new Set(pokemon.moves.map((m) => m.url).filter(Boolean))

  const candidates = pokemon.rawLevelUpMoves.filter(
    (m) => m.level <= newLevel && !knownMoveUrls.has(m.url)
  )

  if (candidates.length === 0) {
    return { updatedPokemon: pokemon, learnedMoveName: null }
  }

  for (const candidate of [...candidates].reverse()) {
    const move = await getMoveDetails(candidate.url)
    if (move && move.power <= maxPower) {
      let minPowerIdx = 0
      for (let i = 1; i < pokemon.moves.length; i++) {
        if (pokemon.moves[i].power < pokemon.moves[minPowerIdx].power) {
          minPowerIdx = i
        }
      }

      if (move.power >= pokemon.moves[minPowerIdx].power) {
        const nextMoves = [...pokemon.moves]
        nextMoves[minPowerIdx] = move

        return {
          updatedPokemon: {
            ...pokemon,
            moves: nextMoves
          },
          learnedMoveName: move.name
        }
      }
    }
  }

  return { updatedPokemon: pokemon, learnedMoveName: null }
}

function filterSpeciesIdsForProgress(
  ids: number[],
  progressRatio: number,
  isBoss: boolean,
  bossStage: number = -1,
  legendaryIds: Set<number> = new Set()
): number[] {
  if (ids.length <= 10) return ids

  const nonLegendaryIds = ids.filter(id => !legendaryIds.has(id))
  const legendaryList = ids.filter(id => legendaryIds.has(id))
  const nonLegendaryTotal = nonLegendaryIds.length

  if (isBoss) {
    if (bossStage === 0) {
      return nonLegendaryIds.slice(0, Math.floor(nonLegendaryTotal * 0.5))
    }
    if (bossStage === 1) {
      return nonLegendaryIds.slice(Math.floor(nonLegendaryTotal * 0.3))
    }
    if (Math.random() < 0.4 && legendaryList.length > 0) {
      return legendaryList
    }
    return nonLegendaryIds.slice(Math.floor(nonLegendaryTotal * 0.35))
  }

  if (progressRatio < 0.35) {
    // Principio de la aventura: solo Pokémon no-legendarios de las primeras rutas
    const earlyCandidates = nonLegendaryIds.slice(0, Math.floor(nonLegendaryTotal * 0.65))
    return earlyCandidates.length > 0 ? earlyCandidates : nonLegendaryIds
  }

  if (progressRatio < 0.70) {
    return nonLegendaryIds.length > 0 ? nonLegendaryIds : ids
  }

  return nonLegendaryIds.length > 0 ? nonLegendaryIds : ids
}

const HARD_HELD_ITEMS = [
  { name: 'Muscle Band', attackMod: 0.15 },
  { name: 'Wise Glasses', spAttackMod: 0.15 },
  { name: 'Rocky Helmet', defenseMod: 0.15 },
  { name: 'Sitrus Berry', maxHpMod: 15, healPerTurn: 8 },
  { name: 'Quick Claw', speedMod: 0.20 },
  { name: 'Scope Lens', critChance: 0.20 },
  { name: 'Choice Band', attackMod: 0.25 },
]

function applyHardHeldItem(pokemon: Pokemon, difficulty: string, isBoss: boolean): Pokemon {
  if (difficulty !== 'hard' && difficulty !== 'infinite') return pokemon
  if (pokemon.holdItem) return pokemon
  const chance = isBoss ? 1.0 : difficulty === 'infinite' ? 0.5 : 0.4
  if (Math.random() > chance) return pokemon
  const item = HARD_HELD_ITEMS[Math.floor(Math.random() * HARD_HELD_ITEMS.length)]
  return { ...pokemon, holdItem: item.name }
}

export async function getBalancedPokemonByGeneration(
  generation: number,
  stepIndex: number,
  totalNodes: number,
  isBoss: boolean = false,
  shiny: boolean = false,
  difficulty: string = 'medium',
  bossStage: number = -1,
  stageIndex: number = 0,
  forcedLevel?: number
): Promise<Pokemon> {
  const allIds = await getSpeciesIdsByGeneration(generation)
  const legendaryIds = await getLegendaryIdsByGeneration(generation)
  const routeProgress = stepIndex / Math.max(1, totalNodes - 1)

  // Progreso efectivo: combina la etapa actual con la posición dentro de la ruta.
  // Infinite no tiene etapas, así que usa el progreso de la ruta directamente.
  const progressRatio = difficulty === 'infinite'
    ? routeProgress
    : (stageIndex + routeProgress) / 3

  const candidateIds = filterSpeciesIdsForProgress(allIds, progressRatio, isBoss, bossStage, legendaryIds)

  const levelMult = difficulty === 'easy' ? 1.0 : difficulty === 'infinite' ? 1.0 : difficulty === 'hard' ? 2.0 : 1.5
  // forcedLevel: genera la especie directamente a un nivel concreto (el nivel
  // objetivo del rival) para que la especie, sus evoluciones y sus movimientos
  // sean coherentes con ese nivel y no aparezcan formas evolucionadas a niveles
  // bajos (p. ej. un Venusaur nivel 16).
  const scaledLevel = forcedLevel ?? (10 + Math.floor((stageIndex * totalNodes + stepIndex) * levelMult) + (isBoss ? 2 : 0))

  let minBst = 150
  let maxBst = 999

  if (isBoss) {
    if (bossStage === 0) {
      minBst = 350; maxBst = 500
    } else if (bossStage === 1) {
      minBst = 450; maxBst = 600
    } else {
      minBst = 580; maxBst = 999
    }
  } else if (difficulty === 'infinite') {
    if (isBoss) {
      minBst = 540
      maxBst = 999
    } else if (progressRatio < 0.25) {
      minBst = 260
      maxBst = 480
    } else if (progressRatio < 0.50) {
      minBst = 370
      maxBst = 560
    } else if (progressRatio < 0.75) {
      minBst = 450
      maxBst = 640
    } else {
      minBst = 520
      maxBst = 800
    }
  } else if (difficulty === 'hard') {
    if (isBoss) {
      minBst = 530
      maxBst = 999
    } else if (progressRatio < 0.35) {
      minBst = 200
      maxBst = 420
    } else if (progressRatio < 0.70) {
      minBst = 380
      maxBst = 530
    } else {
      minBst = 480
      maxBst = 700
    }
  } else if (difficulty === 'easy') {
    if (isBoss) {
      minBst = 380
      maxBst = 900
    } else if (progressRatio < 0.35) {
      minBst = 120
      maxBst = 320
    } else if (progressRatio < 0.70) {
      minBst = 240
      maxBst = 420
    } else {
      minBst = 340
      maxBst = 540
    }
  } else {
    if (isBoss) {
      minBst = 470
      maxBst = 999
    } else if (progressRatio < 0.35) {
      minBst = 150
      maxBst = 385
    } else if (progressRatio < 0.70) {
      minBst = 320
      maxBst = 485
    } else {
      minBst = 420
      maxBst = 620
    }
  }

  // Formas regionales (Alola/Galar/Hisui/Paldea) como antes, pero respetando
  // su nivel mínimo de aparición (no formas evolucionadas por piedra a niveles bajos).
  if (Math.random() < 0.02) {
    const formIds = await getAllFormIds()
    if (formIds.length > 0) {
      const randomId = formIds[Math.floor(Math.random() * formIds.length)]
      const form = await buildPokemonFromApi(randomId, generation, scaledLevel, shiny, difficulty)
      if (!(form.minAppearLevel && scaledLevel < form.minAppearLevel)) {
        return applyHardHeldItem(form, difficulty, isBoss)
      }
    }
  }

  const shuffledCandidates = [...candidateIds].sort(() => 0.5 - Math.random())
  const attempts = Math.min(7, shuffledCandidates.length)

  let bestCandidate: Pokemon | null = null
  let bestDiff = Infinity

  for (let i = 0; i < attempts; i++) {
    const candidateId = shuffledCandidates[i]
    try {
      const pokemon = await buildPokemonFromApi(candidateId, generation, scaledLevel, shiny, difficulty)
      const bst = pokemon.baseStatTotal ?? 350

      if (pokemon.minAppearLevel && scaledLevel < pokemon.minAppearLevel) continue

      if (bst >= minBst && bst <= maxBst) {
        return applyHardHeldItem(pokemon, difficulty, isBoss)
      }

      const targetMid = (minBst + maxBst) / 2
      const diff = Math.abs(bst - targetMid)
      if (diff < bestDiff) {
        bestDiff = diff
        bestCandidate = pokemon
      }
    } catch {
      continue
    }
  }

  if (bestCandidate) return applyHardHeldItem(bestCandidate, difficulty, isBoss)

  // Fallback: evita que formas con nivel mínimo de aparición (piedras, intercambio,
  // evoluciones por nivel) se cuelen a niveles bajos.
  const pool = candidateIds.length > 0 ? candidateIds : allIds
  for (let attempt = 0; attempt < 20; attempt++) {
    const randomId = randomFrom(pool)
    const pokemon = await buildPokemonFromApi(randomId, generation, scaledLevel, shiny, difficulty)
    if (pokemon.minAppearLevel && scaledLevel < pokemon.minAppearLevel) continue
    return applyHardHeldItem(pokemon, difficulty, isBoss)
  }
  // Último recurso: si el pool está casi vacío de válidos, baja el nivel de
  // aparición (nunca por debajo del nivel solicitado) y reusa la caché.
  const lastPokemon = await buildPokemonFromApi(randomFrom(pool), generation, scaledLevel, shiny, difficulty)
  if (lastPokemon.minAppearLevel && scaledLevel < lastPokemon.minAppearLevel) {
    return applyHardHeldItem(
      await buildPokemonFromApi(lastPokemon.id, generation, Math.max(scaledLevel, lastPokemon.minAppearLevel), shiny, difficulty),
      difficulty, isBoss
    )
  }
  return applyHardHeldItem(lastPokemon, difficulty, isBoss)
}

export async function getRandomPokemonByGeneration(generation: number): Promise<Pokemon> {
  if (Math.random() < 0.02) {
    const formIds = await getAllFormIds()
    if (formIds.length > 0) {
      const randomId = formIds[Math.floor(Math.random() * formIds.length)]
      return buildPokemonFromApi(randomId, generation)
    }
  }
  const ids = await getSpeciesIdsByGeneration(generation)
  const randomId = randomFrom(ids)
  return buildPokemonFromApi(randomId, generation)
}

export async function getRandomStarterByGeneration(generation: number, shiny: boolean = false, difficulty: string = 'medium'): Promise<Pokemon> {
  const starters = startersByGen[generation] ?? startersByGen[1]
  const randomStarterId = randomFrom(starters)
  return buildPokemonFromApi(randomStarterId, generation, 10, shiny, difficulty)
}
const REGIONAL_SUFFIXES = ['-alola', '-galar', '-hisui', '-paldea']

function getBaseName(name: string): string {
  for (const suffix of REGIONAL_SUFFIXES) {
    if (name.endsWith(suffix)) return name.slice(0, -suffix.length)
  }
  return name
}

function getRegionalSuffix(name: string): string {
  for (const suffix of REGIONAL_SUFFIXES) {
    if (name.endsWith(suffix)) return suffix
  }
  return ''
}

// Pokémon de evolución por amistad (sin nivel mínimo en la API) que en este
// juego evolucionan a nivel 10.
const FRIENDSHIP_EVOLVE_LEVEL_10 = ['pichu', 'cleffa', 'igglybuff', 'togepi', 'azurill', 'budew', 'chingling']
// Pokémon que en este juego evolucionan a nivel 25.
const FRIENDSHIP_EVOLVE_LEVEL_25 = ['buneary', 'woobat', 'swadloon', 'snom']

function findEvolutionForSpecies(chainNode: EvolutionChainNode, speciesName: string): { speciesName: string; level: number; trigger: string; heldItem: string | null } | null {
  const baseName = getBaseName(speciesName)
  const matchName = (name: string) => name.toLowerCase() === speciesName.toLowerCase() || name.toLowerCase() === baseName.toLowerCase()
  const regionalSuffix = getRegionalSuffix(speciesName)

  for (const evo of chainNode.evolves_to || []) {
    const sub = findEvolutionForSpecies(evo, speciesName)
    if (sub) return sub
  }
  if (matchName(chainNode.species.name)) {
    if (chainNode.evolves_to?.length) {
      const details = chainNode.evolves_to[0].evolution_details?.[0]
      const minLevel = details?.min_level ?? null
      const trigger = details?.trigger?.name ?? 'level-up'
      const evoLevel = FRIENDSHIP_EVOLVE_LEVEL_25.includes(chainNode.species.name.toLowerCase())
        ? 25
        : (minLevel ?? (trigger === 'trade' ? 35 : (FRIENDSHIP_EVOLVE_LEVEL_10.includes(chainNode.species.name.toLowerCase()) ? 10 : 45)))
      const heldItem = details?.held_item?.name ?? null
      // La API ya devuelve el nombre con sufijo regional para las formas
      // regionales (p. ej. dugtrio-alola). Solo se añade el sufijo si el nombre
      // evolucionado NO lo lleva (caso de cadenas compartidas con la forma base).
      const rawEvolvedName = chainNode.evolves_to[0].species.name
      const evolvedName = regionalSuffix && !rawEvolvedName.endsWith(regionalSuffix)
        ? rawEvolvedName + regionalSuffix
        : rawEvolvedName
      return { speciesName: evolvedName, level: evoLevel, trigger, heldItem }
    }
  }
  return null
}

interface HeldItemEvo {
  item: string
  target: string
  level: number
}

function findHeldItemEvolutions(chainNode: EvolutionChainNode, speciesName: string): HeldItemEvo[] {
  const baseName = getBaseName(speciesName)
  const matchName = (name: string) => name.toLowerCase() === speciesName.toLowerCase() || name.toLowerCase() === baseName.toLowerCase()
  const regionalSuffix = getRegionalSuffix(speciesName)

  for (const evo of chainNode.evolves_to || []) {
    const sub = findHeldItemEvolutions(evo, speciesName)
    if (sub.length > 0) return sub
  }
  if (matchName(chainNode.species.name)) {
    const result: HeldItemEvo[] = []
    for (const evo of chainNode.evolves_to || []) {
      const details = evo.evolution_details?.[0]
      const heldItem = details?.held_item?.name ?? null
      if (!heldItem) continue
      const trigger = details?.trigger?.name ?? 'level-up'
      const minLevel = details?.min_level ?? null
      const level = minLevel ?? (trigger === 'trade' ? 35 : 45)
      const rawEvolvedName = evo.species.name
      const evolvedName = regionalSuffix && !rawEvolvedName.endsWith(regionalSuffix)
        ? rawEvolvedName + regionalSuffix
        : rawEvolvedName
      result.push({ item: getEvolutionItemDisplayName(heldItem), target: evolvedName, level })
    }
    return result
  }
  return []
}

function findPreEvolutionLevel(chainNode: EvolutionChainNode, speciesName: string): number | null {
  const baseName = getBaseName(speciesName)
  const matchName = (name: string) => name.toLowerCase() === speciesName.toLowerCase() || name.toLowerCase() === baseName.toLowerCase()

  if (matchName(chainNode.species.name)) return null

  for (const evo of chainNode.evolves_to || []) {
    // ¿Este nodo evoluciona DIRECTAMENTE al Pokémon objetivo? matchName usa el
    // nombre base del objetivo (maneja formas regionales), no el del propio evo.
    if (matchName(evo.species.name)) {
      const details = evo.evolution_details?.[0]
      const minLevel = details?.min_level ?? null
      const trigger = details?.trigger?.name ?? 'level-up'
      // Evoluciones por nivel usan su nivel como umbral. Las que evolucionan por
      // piedra o intercambio no tienen nivel, pero tampoco deberían aparecer al
      // inicio del juego. Las de amistad (Pichu→Pikachu, etc.) sí pueden.
      if (trigger === 'level-up' && minLevel) return minLevel
      if (trigger === 'use-item' || trigger === 'trade') return SPECIAL_EVOLUTION_MIN_APPEAR_LEVEL
      return null
    }
    const found = findPreEvolutionLevel(evo, speciesName)
    if (found) return found
  }
  return null
}

export async function getEvolutionInfo(pokemonId: number): Promise<{ nextName: string | null; evolutionLevel: number | null; heldItem: string | null; heldItemEvolutions: HeldItemEvo[]; minAppearLevel: number | null }> {
  try {
    const speciesRes = await fetch(`${API_BASE}/pokemon-species/${pokemonId}`)
    if (!speciesRes.ok) return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    const speciesData = await speciesRes.json()
    if (!speciesData.evolution_chain?.url) return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    const evoRes = await fetch(speciesData.evolution_chain.url)
    if (!evoRes.ok) return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    const evoData = await evoRes.json()
    const found = findEvolutionForSpecies(evoData.chain, speciesData.name)
    const heldItemEvolutions = findHeldItemEvolutions(evoData.chain, speciesData.name)
    const minLevel = findPreEvolutionLevel(evoData.chain, speciesData.name)
    if (found) {
      return { nextName: found.speciesName, evolutionLevel: found.trigger === 'use-item' ? null : found.level, heldItem: found.heldItem ? getEvolutionItemDisplayName(found.heldItem) : null, heldItemEvolutions, minAppearLevel: minLevel }
    }
    return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions, minAppearLevel: minLevel }
  } catch {
    return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
  }
}

export function stripRegional(name: string): string {
  const battleForms = ['-mega', '-gmax']
  for (const suffix of battleForms) {
    if (name.includes(suffix)) return name.split(suffix)[0]
  }
  return name
}

export async function evolvePokemon(currentPokemon: Pokemon, targetName?: string): Promise<Pokemon | null> {
  try {
    const info = await getEvolutionInfo(currentPokemon.id)
    const chosen = targetName ?? info.nextName
    if (!chosen) return null
    const nextName = chosen.includes('-') ? stripRegional(chosen) : chosen
    const newBasePokemon = await buildPokemonFromApi(nextName, 1, currentPokemon.level, currentPokemon.shiny ?? false)
    return {
      ...newBasePokemon,
      level: currentPokemon.level,
      maxHp: newBasePokemon.maxHp + 15,
      hp: newBasePokemon.maxHp + 15,
      attack: newBasePokemon.attack + 5,
      defense: newBasePokemon.defense + 5,
      spAttack: newBasePokemon.spAttack + 5,
      spDefense: newBasePokemon.spDefense + 5,
      speed: newBasePokemon.speed + 3,
      holdItem: currentPokemon.holdItem,
    }
  } catch (error) {
    console.error("Error al intentar evolucionar el Pokémon:", error)
    return null
  }
}

function findStoneEvolution(chainNode: EvolutionChainNode, speciesName: string, stoneItemName: string): { speciesName: string; level: number | null; trigger: string } | null {
  const baseName = getBaseName(speciesName)
  const matchName = (name: string) => name.toLowerCase() === speciesName.toLowerCase() || name.toLowerCase() === baseName.toLowerCase()
  const regionalSuffix = getRegionalSuffix(speciesName)

  if (matchName(chainNode.species.name)) {
    for (const evo of chainNode.evolves_to || []) {
      const allDetails = evo.evolution_details || []
      for (const details of allDetails) {
        if (details?.trigger?.name === 'use-item' && details?.item?.name === stoneItemName) {
          // No duplicar el sufijo regional si la API ya lo incluye.
          const rawEvolvedName = evo.species.name
          const evolvedName = regionalSuffix && !rawEvolvedName.endsWith(regionalSuffix)
            ? rawEvolvedName + regionalSuffix
            : rawEvolvedName
          return { speciesName: evolvedName, level: null, trigger: 'use-item' }
        }
      }
    }
  }
  for (const evo of chainNode.evolves_to || []) {
    const found = findStoneEvolution(evo, speciesName, stoneItemName)
    if (found) return found
  }
  return null
}

export async function canEvolveWithStone(pokemonId: number, stoneItemName: string): Promise<{ canEvolve: boolean; evolvedName: string | null }> {
  // Hardcoded Eevee evolutions (all 7 eeveelutions with stones)
  if (pokemonId === 133) {
    const eeveeMap: Record<string, string> = {
      'fire-stone': 'flareon',
      'water-stone': 'vaporeon',
      'thunder-stone': 'jolteon',
      'leaf-stone': 'leafeon',
      'ice-stone': 'glaceon',
      'sun-stone': 'espeon',
      'moon-stone': 'umbreon',
    }
    const evolved = eeveeMap[stoneItemName]
    if (evolved) return { canEvolve: true, evolvedName: evolved }
  }

  // Gorra de Ash: Greninja → Greninja-Ash (Battle Bond, ID 10117)
  if (pokemonId === 658 && stoneItemName === 'gorra-de-ash') {
    return { canEvolve: true, evolvedName: 'greninja-ash' }
  }

  try {
    const speciesRes = await fetch(`${API_BASE}/pokemon-species/${pokemonId}`)
    if (!speciesRes.ok) return { canEvolve: false, evolvedName: null }
    const speciesData = await speciesRes.json()
    if (!speciesData.evolution_chain?.url) return { canEvolve: false, evolvedName: null }
    const evoRes = await fetch(speciesData.evolution_chain.url)
    if (!evoRes.ok) return { canEvolve: false, evolvedName: null }
    const evoData = await evoRes.json()
    const found = findStoneEvolution(evoData.chain, speciesData.name, stoneItemName)
    if (found) {
      return { canEvolve: true, evolvedName: found.speciesName }
    }
    return { canEvolve: false, evolvedName: null }
  } catch {
    return { canEvolve: false, evolvedName: null }
  }
}