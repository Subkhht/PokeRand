import type { Move, Pokemon, RawLevelUpMove, StatusType } from './types'

const API_BASE = 'https://pokeapi.co/api/v2'

const generationSpeciesCache = new Map<number, number[]>()
const pokemonCache = new Map<string | number, Pokemon>()

interface PokeApiNamedResource {
  name: string
  url: string
}

interface PokeApiPokemon {
  id: number
  name: string
  sprites: {
    front_default: string | null
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
  }>
}

// IDs oficiales de los starters por generación
export const startersByGen: Record<number, number[]> = {
  1: [1, 4, 7],       // Bulbasaur, Charmander, Squirtle
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
}

export async function fetchPokemonDetails(id: number): Promise<PokemonDetails> {
  const resPokemon = await fetch(`${API_BASE}/pokemon/${id}`)
  const dataPokemon = await resPokemon.json()

  const resSpecies = await fetch(`${API_BASE}/pokemon-species/${id}`)
  const dataSpecies = await resSpecies.json()

  const flavorEntry = dataSpecies.flavor_text_entries.find(
    (entry: any) => entry.language.name === 'es'
  ) ?? dataSpecies.flavor_text_entries.find(
    (entry: any) => entry.language.name === 'en'
  )

  const description = flavorEntry 
    ? flavorEntry.flavor_text.replace(/[\n\f]/g, ' ') 
    : 'Sin descripción disponible.'

  const highResImage = dataPokemon.sprites.other?.['official-artwork']?.front_default 
    || dataPokemon.sprites.front_default

  const STAT_NAMES: Record<string, string> = {
    'hp': 'HP',
    'attack': 'Ataque',
    'defense': 'Defensa',
    'special-attack': 'Atq. Esp.',
    'special-defense': 'Def. Esp.',
    'speed': 'Velocidad'
  }

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
    }))
  }
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

async function getSpeciesIdsByGeneration(generation: number): Promise<number[]> {
  const cached = generationSpeciesCache.get(generation)
  if (cached) return cached

  const generationData = await fetchJson<{ pokemon_species: PokeApiNamedResource[] }>(
    `${API_BASE}/generation/${generation}`
  )

  const ids = generationData.pokemon_species.map((species) => extractIdFromResourceUrl(species.url))
  generationSpeciesCache.set(generation, ids)
  return ids
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
  try {
    const res = await fetch(moveUrl)
    const data = await res.json()

    // 🚫 Descartamos movimientos de estado (Protect, Growl, Dance, etc.) o sin potencia real
    if (
      !data.power || 
      data.power <= 0 || 
      data.damage_class?.name === 'status'
    ) {
      return null
    }

    const esName = data.names?.find((n: any) => n.language?.name === 'es')?.name
    const moveName = esName || capitalize(data.name.replace(/-/g, ' '))

    const ailmentRaw = data.ailment?.name
    const ailment: StatusType | undefined = ailmentRaw && AILMENT_MAP[ailmentRaw] ? AILMENT_MAP[ailmentRaw] : undefined
    const ailmentChance = (data.meta?.ailment_chance ?? 0) > 0 ? data.meta.ailment_chance / 100 : undefined

    const minHits = data.meta?.min_hits ?? undefined
    const maxHits = data.meta?.max_hits ?? undefined

    const recoilCategory = data.meta?.category?.name === 'recoil' || data.meta?.category?.name === 'damage+recoil' || data.meta?.category?.name === 'recoil-percent'
    const rawDrain = data.meta?.drain ?? 0
    const recoilPercent = recoilCategory && rawDrain < 0 ? Math.abs(rawDrain) / 100 : undefined
    const drainPercent = rawDrain > 0 ? rawDrain / 100 : undefined

    const critRateStage: number | undefined = (data.meta?.crit_rate ?? 0) > 0 ? data.meta.crit_rate : undefined

    return {
      name: moveName,
      type: data.type.name,
      power: data.power,
      accuracy: data.accuracy ?? 100,
      description: data.effect_entries.find((e: any) => e.language.name === 'es')?.short_effect
        || data.effect_entries.find((e: any) => e.language.name === 'en')?.short_effect
        || 'Ataque de daño directo.',
      url: moveUrl,
      ailment,
      ailmentChance,
      minHits,
      maxHits,
      recoilPercent,
      drainPercent,
      critRatio: critRateStage,
    }
  } catch {
    return null
  }
}

// Límite realista de potencia de movimiento según el nivel del Pokémon
export function getMaxMovePowerForLevel(level: number, difficulty: string = 'medium'): number {
  if (difficulty === 'infinite') {
    if (level <= 14) return 100
    if (level <= 22) return 130
    return 150
  }
  if (difficulty === 'hard') {
    if (level <= 12) return 85
    if (level <= 20) return 100
    return 150
  }
  if (level <= 12) return 60
  if (level <= 22) return 85
  return 150
}

// Lista de ataques básicos de relleno por si el Pokémon tiene menos de 4 ataques de daño válidos
const FALLBACK_MOVES: Move[] = [
  { name: 'Placaje', type: 'normal', power: 40, accuracy: 100, description: 'Ataque físico básico.' },
  { name: 'Ataque Rápido', type: 'normal', power: 40, accuracy: 100, description: 'Ataque rápido de daño directo.' },
  { name: 'Cabezazo', type: 'normal', power: 70, accuracy: 100, description: 'Golpe de cabeza potente.' },
  { name: 'Derribo', type: 'normal', power: 90, accuracy: 85, description: 'Carga contundente de gran impacto.' }
]

// Procesa movimientos asignando solo aquellos acordes al nivel actual del Pokémon
export async function fetchPokemonMoves(
  moveEntries: any[],
  level: number = 10,
  difficulty: string = 'medium'
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
      type: 'normal',
      power: 40,
      accuracy: 100,
      description: 'Ataque físico básico.'
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
  difficulty: string = 'medium'
): Promise<Pokemon> {
  const cacheKey = `${identifier}_lvl${targetLevel}`
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

  const statMap = new Map(data.stats.map((entry) => [entry.stat.name, entry.base_stat]))
  const baseStatTotal = data.stats.reduce((acc, entry) => acc + entry.base_stat, 0)
  
  const { moves: parsedMoves, rawLevelUpMoves } = await fetchPokemonMoves(data.moves, targetLevel, difficulty)
  const sortedTypes = [...data.types].sort((a, b) => a.slot - b.slot).map(t => t.type.name)

  const pokemon: Pokemon = {
    id: data.id,
    name: capitalize(data.name),
    level: targetLevel,
    maxHp: (statMap.get('hp') ?? 45) + 35 + (targetLevel - 10) * 4,
    hp: (statMap.get('hp') ?? 45) + 35 + (targetLevel - 10) * 4,
    attack: (statMap.get('attack') ?? 50) + 5 + (targetLevel - 10) * 2,
    defense: (statMap.get('defense') ?? 50) + 5 + (targetLevel - 10) * 2,
    speed: (statMap.get('speed') ?? 50) + (targetLevel - 10) * 2,
    types: sortedTypes,
    baseStatTotal,
    sprite: (() => {
      const id = data.id
      const baseSprite = id >= 1 && id <= 649
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`
        : data.sprites.front_default ?? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
      return shiny ? makeShinySprite(baseSprite, id) : baseSprite
    })(),
    shiny: shiny || undefined,
    moves: parsedMoves,
    rawLevelUpMoves
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
  isBoss: boolean
): number[] {
  if (ids.length <= 10) return ids

  const total = ids.length
  // Los Pokémon legendarios y míticos suelen estar al final del listado de la generación (último 12%)
  const legendaryCutoff = Math.floor(total * 0.88)
  const nonLegendaryIds = ids.slice(0, legendaryCutoff)
  const legendaryIds = ids.slice(legendaryCutoff)

  if (isBoss) {
    // El jefe final tiene un 40% de probabilidad de ser legendario/mítico y 60% de ser un Pokémon potente no-legendario
    if (Math.random() < 0.4 && legendaryIds.length > 0) {
      return legendaryIds
    }
    return ids.slice(Math.floor(total * 0.4))
  }

  if (progressRatio < 0.35) {
    // Principio de la aventura: solo Pokémon no-legendarios, priorizando las especies de las primeras rutas (primer 65%)
    const earlyCandidates = nonLegendaryIds.slice(0, Math.floor(total * 0.65))
    return earlyCandidates.length > 0 ? earlyCandidates : nonLegendaryIds
  }

  if (progressRatio < 0.70) {
    // Mitad de la aventura: especies estándar no legendarias
    return nonLegendaryIds.length > 0 ? nonLegendaryIds : ids
  }

  // Final de la aventura (nodos de combate normales): especies avanzadas no legendarias
  return nonLegendaryIds.length > 0 ? nonLegendaryIds : ids
}

const HARD_HELD_ITEMS = [
  { name: 'Muscle Band', attackMod: 0.15 },
  { name: 'Wise Glasses', speedMod: 0.15 },
  { name: 'Rocky Helmet', defenseMod: 0.15 },
  { name: 'Sitrus Berry', maxHpMod: 15, healPerTurn: 8 },
  { name: 'Quick Claw', speedMod: 0.20 },
  { name: 'Scope Lens', critChance: 0.20 },
  { name: 'Choice Band', attackMod: 0.25 },
]

function applyHardHeldItem(pokemon: Pokemon, difficulty: string, isBoss: boolean): Pokemon {
  if (difficulty !== 'hard' && difficulty !== 'infinite') return pokemon
  if (pokemon.holdItem) return pokemon
  const chance = isBoss ? 1.0 : difficulty === 'infinite' ? 0.65 : 0.4
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
  difficulty: string = 'medium'
): Promise<Pokemon> {
  const allIds = await getSpeciesIdsByGeneration(generation)
  const progressRatio = stepIndex / Math.max(1, totalNodes - 1)

  const candidateIds = filterSpeciesIdsForProgress(allIds, progressRatio, isBoss)

  const levelMult = difficulty === 'infinite' ? 2.5 : difficulty === 'hard' ? 2.0 : 1.5
  const scaledLevel = 10 + Math.floor(stepIndex * levelMult) + (isBoss ? 2 : 0)

  let minBst = 150
  let maxBst = 999

  if (difficulty === 'infinite') {
    if (isBoss) {
      minBst = 580
      maxBst = 999
    } else if (progressRatio < 0.25) {
      minBst = 320
      maxBst = 550
    } else if (progressRatio < 0.50) {
      minBst = 440
      maxBst = 650
    } else if (progressRatio < 0.75) {
      minBst = 520
      maxBst = 750
    } else {
      minBst = 600
      maxBst = 999
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

  const shuffledCandidates = [...candidateIds].sort(() => 0.5 - Math.random())
  const attempts = Math.min(7, shuffledCandidates.length)

  let bestCandidate: Pokemon | null = null
  let bestDiff = Infinity

  for (let i = 0; i < attempts; i++) {
    const candidateId = shuffledCandidates[i]
    try {
      const pokemon = await buildPokemonFromApi(candidateId, generation, scaledLevel, shiny, difficulty)
      const bst = pokemon.baseStatTotal ?? 350

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

  const randomId = randomFrom(allIds)
  return applyHardHeldItem(await buildPokemonFromApi(randomId, generation, scaledLevel, shiny, difficulty), difficulty, isBoss)
}

export async function getRandomPokemonByGeneration(generation: number): Promise<Pokemon> {
  const ids = await getSpeciesIdsByGeneration(generation)
  const randomId = randomFrom(ids)
  return buildPokemonFromApi(randomId, generation)
}

export async function getRandomStarterByGeneration(generation: number, shiny: boolean = false): Promise<Pokemon> {
  const starters = startersByGen[generation] ?? startersByGen[1]
  const randomStarterId = randomFrom(starters)
  return buildPokemonFromApi(randomStarterId, generation, 10, shiny)
}

export async function evolvePokemon(currentPokemon: Pokemon): Promise<Pokemon | null> {
  try {
    let identifier: string | number = currentPokemon.id

    if (!identifier || Number.isNaN(Number(identifier))) {
      const match = currentPokemon.sprite?.match(/\/(\d+)\.(png|gif)/)
      if (match) {
        identifier = parseInt(match[1], 10)
      } else {
        identifier = currentPokemon.name.toLowerCase().split('-')[0]
      }
    }

    const speciesRes = await fetch(`${API_BASE}/pokemon-species/${identifier}`)
    if (!speciesRes.ok) {
      console.warn(`No se encontró la especie en PokeAPI para: ${identifier}`)
      return null
    }
    const speciesData = await speciesRes.json()

    if (!speciesData.evolution_chain?.url) return null
    const evoRes = await fetch(speciesData.evolution_chain.url)
    if (!evoRes.ok) return null
    const evoData = await evoRes.json()

    const currentSpeciesName = speciesData.name.toLowerCase()

    function findNextEvolution(chainNode: EvolutionChainNode): string | null {
      if (chainNode.species.name.toLowerCase() === currentSpeciesName) {
        if (chainNode.evolves_to && chainNode.evolves_to.length > 0) {
          const randomEvo = randomFrom(chainNode.evolves_to)
          const validForms = (randomEvo.evolution_details ?? [])
            .map(d => d.evolved_form?.name)
            .filter((n): n is string => !!n)
          if (validForms.length > 0) {
            return randomFrom(validForms)
          }
          return randomEvo.species.name
        }
        return null
      }

      for (const child of chainNode.evolves_to || []) {
        const found = findNextEvolution(child)
        if (found) return found
      }

      return null
    }

    const nextEvoName = findNextEvolution(evoData.chain)

    if (!nextEvoName) {
      return null 
    }

    const newBasePokemon = await buildPokemonFromApi(nextEvoName, 1, currentPokemon.level, currentPokemon.shiny ?? false)

    const evolvedPokemon: Pokemon = {
      ...newBasePokemon,
      level: currentPokemon.level,
      maxHp: newBasePokemon.maxHp + 15,
      hp: newBasePokemon.maxHp + 15,
      attack: newBasePokemon.attack + 5,
      defense: newBasePokemon.defense + 5,
      speed: newBasePokemon.speed + 3,
      holdItem: currentPokemon.holdItem,
    }

    return evolvedPokemon
  } catch (error) {
    console.error("Error al intentar evolucionar el Pokémon:", error)
    return null
  }
}