import type { Move, Pokemon, PokemonIVs, RawLevelUpMove, StatusType, StatChange } from './types'
import { getLanguage } from './i18n'
import { generateIVs, ivStatBonus, natureMultiplier, randomNature } from './pokemonMeta'

const API_BASE = 'https://pokeapi.co/api/v2'

// Nivel mínimo de aparición para formas que evolucionan por piedra, intercambio,
// amistad, etc. Sin un nivel de evolución definido, no deben aparecer al principio.
const SPECIAL_EVOLUTION_MIN_APPEAR_LEVEL = 20

// Pokémon de evolución por amistad (sin nivel mínimo en la API) que en este
// juego evolucionan a nivel 10.
const FRIENDSHIP_EVOLVE_LEVEL_10 = ['pichu', 'cleffa', 'igglybuff', 'togepi', 'azurill', 'budew', 'chingling']
// Pokémon que en este juego evolucionan a nivel 25.
const FRIENDSHIP_EVOLVE_LEVEL_25 = ['buneary', 'woobat', 'swadloon', 'snom']
// Nivel al que Kubfu evoluciona con los manuscritos.
const KUBFU_EVOLVE_LEVEL = 30

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
  abilities: Array<{
    is_hidden: boolean
    slot: number
    ability: PokeApiNamedResource
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
  highResImageShiny?: string
  description: string
  height: number
  weight: number
  types: string[]
  stats: Array<{ name: string; value: number }>
  evolutions: Array<{ id: number; name: string; sprite: string; level: number | null; trigger: string; item: string | null; chance?: number; branch?: boolean; parent?: number; isGroup?: boolean }>
}

// Calcula cómo evoluciona una etapa en ESTE juego (nivel de evolución por
// amistad, intercambio, etc. o el objeto que se debe usar), en lugar de
// mostrar los datos crudos de PokeAPI.
function gameEvolutionInfo(sourceName: string, details?: NonNullable<EvolutionChainNode['evolution_details']>[number]): { level: number | null; trigger: string; item: string | null } {
  const trigger = details?.trigger?.name ?? 'level-up'
  const minLevel = details?.min_level ?? null
  const itemSlug = details?.item?.name ?? details?.held_item?.name ?? null
  const item = itemSlug ? getEvolutionItemDisplayName(itemSlug) : null

  // Las evoluciones con objeto de uso (piedras, manuscritos, armaduras...) no
  // tienen nivel: el objeto se consume desde el inventario.
  if (trigger === 'use-item') {
    return { level: null, trigger, item }
  }

  const name = sourceName.toLowerCase()
  let level: number | null
  if (FRIENDSHIP_EVOLVE_LEVEL_25.includes(name)) {
    level = 25
  } else if (name === 'kubfu') {
    level = KUBFU_EVOLVE_LEVEL
  } else if (name === 'porygon2') {
    // Porygon-Z evoluciona con el Disco Raro al nivel 45 en este juego.
    level = 45
  } else if (name === 'aipom') {
    // Aipom → Ambipom evoluciona al nivel 25 en este juego.
    level = 25
  } else if (name === 'dusclops') {
    // Dusclops → Dusknoir evoluciona con el Paño Siniestro al nivel 45.
    level = 45
  } else if (name === 'seadra') {
    // Seadra → Kingdra evoluciona con la Escama Dragón al nivel 45.
    level = 45
  } else if (name === 'slowpoke' && details?.held_item?.name === 'kings-rock') {
    // Slowpoke → Slowking evoluciona con la Roca del Rey al nivel 30.
    level = 30
  } else if (name === 'happiny') {
    // Happiny → Chansey evoluciona con la Piedra Oval al nivel 35.
    level = 35
  } else if (name === 'bisharp') {
    // Bisharp → Kingambit evoluciona al nivel 70.
    level = 70
  } else if (minLevel) {
    level = minLevel
  } else if (trigger === 'trade') {
    level = 35
  } else if (FRIENDSHIP_EVOLVE_LEVEL_10.includes(name)) {
    level = 10
  } else {
    level = 45
  }

  return { level, trigger, item }
}

function extractEvolutionLine(chainNode: EvolutionChainNode, targetId: number): Array<{ id: number; name: string; sprite: string; level: number | null; trigger: string; item: string | null; branch?: boolean; parent?: number; isGroup?: boolean }> {
  const allNodes: Array<{ id: number; name: string; level: number | null; trigger: string; item: string | null; speciesUrl: string; branch: boolean; parent: number | null }> = []

  // `isBranch` marca los hermanos alternativos (2º, 3º... hijo del mismo padre):
  // la Pokédex los separa con "/" en vez de "→" (como Eevee o Pikachu).
  // `parent` guarda el id del padre para reconstruir el árbol (p. ej. Wurmple).
  function walk(node: EvolutionChainNode, parentId: number | null, parentLevel: number | null, parentTrigger: string, parentItem: string | null, isBranch = false) {
    const match = node.species.url.match(/\/pokemon-species\/(\d+)\//)
    const id = match ? parseInt(match[1], 10) : 0
    allNodes.push({ id, name: node.species.name, level: parentLevel, trigger: parentTrigger, item: parentItem, speciesUrl: node.species.url, branch: isBranch, parent: parentId })
    node.evolves_to.forEach((evo, i) => {
      const info = gameEvolutionInfo(node.species.name, evo.evolution_details?.[0])
      walk(evo, id, info.level, info.trigger, info.item, i > 0)
    })
  }

  walk(chainNode, null, null, 'level-up', null)

  const targetIdx = allNodes.findIndex(n => n.id === targetId)
  if (targetIdx === -1) return []

  const result = allNodes.map(n => ({
    id: n.id,
    name: n.name,
    sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${n.id}.png`,
    level: n.level,
    trigger: n.trigger,
    item: n.item,
    ...(n.branch ? { branch: true } : {}),
    ...(n.parent !== null ? { parent: n.parent } : {}),
  }))

  return result
}

// Resuelve el id de una variante regional (p. ej. graveler + '-alola' → 10110).
// Devuelve null si esa variante no existe.
async function resolveRegionalSpeciesId(speciesName: string, suffix: string): Promise<number | null> {
  try {
    // El endpoint /pokemon-species no acepta nombres regionales (404), pero
    // /pokemon sí los resuelve al id de la variante regional.
    const res = await fetch(`${API_BASE}/pokemon/${speciesName}${suffix}`)
    if (!res.ok) return null
    const data = await res.json()
    return Number(data.id)
  } catch {
    return null
  }
}

// Convierte una línea evolutiva base en su variante regional (p. ej.
// geodude → geodude-alola). Si una etapa no tiene variante regional, se deja la
// forma base.
async function mapRegionalEvolutionLine(
  line: Array<{ id: number; name: string; sprite: string; level: number | null; trigger: string; item: string | null; branch?: boolean; parent?: number; isGroup?: boolean }>,
  suffix: string
): Promise<Array<{ id: number; name: string; sprite: string; level: number | null; trigger: string; item: string | null; branch?: boolean; parent?: number; isGroup?: boolean }>> {
  // Primero se resuelve el id regional de cada etapa y se construye el mapa
  // id original → id regional para remapear también el campo `parent`.
  const idMap = new Map<number, number>()
  const resolved = await Promise.all(line.map(async (node) => {
    const regionalId = await resolveRegionalSpeciesId(node.name, suffix)
    const mappedId = regionalId !== null ? regionalId : node.id
    idMap.set(node.id, mappedId)
    return { node, regionalId, mappedId }
  }))
  return resolved.map(({ node, regionalId, mappedId }) => ({
    ...node,
    id: mappedId,
    name: regionalId !== null ? `${node.name}${suffix}` : node.name,
    sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${mappedId}.png`,
    ...(node.parent != null ? { parent: idMap.get(node.parent) ?? node.parent } : {}),
  }))
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

  let evolutions: Array<{ id: number; name: string; sprite: string; level: number | null; trigger: string; item: string | null; chance?: number; branch?: boolean; parent?: number; isGroup?: boolean }> = []
  try {
    // Las formas regionales (p. ej. geodude-alola) comparten la cadena evolutiva
    // con la forma base: se resuelve la cadena base y luego se mapea a la variante.
    const regionalSuffix = getRegionalSuffix(dataPokemon.name)
    const baseName = regionalSuffix ? dataPokemon.name.slice(0, -regionalSuffix.length) : dataPokemon.name
    const resSpecies = await fetch(`${API_BASE}/pokemon-species/${baseName}`)
    if (resSpecies.ok) {
      const dataSpecies = await resSpecies.json()
      if (dataSpecies.evolution_chain?.url) {
        const evoRes = await fetch(dataSpecies.evolution_chain.url)
        if (evoRes.ok) {
          const evoData = await evoRes.json()
          const baseId = Number(dataSpecies.id)
          let line = extractEvolutionLine(evoData.chain, baseId)
          if (regionalSuffix) {
            line = await mapRegionalEvolutionLine(line, regionalSuffix)
          }
          evolutions = line
        }
      }
    }
  } catch {}

  // Meltan y Melmetal no están enlazados en la cadena de PokeAPI (evolución por
  // caramelos en Pokémon GO), así que se muestran como una línea evolutiva manual.
  if (dataPokemon.id === 808 || dataPokemon.id === 809) {
    evolutions = [
      { id: 808, name: 'meltan', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/808.png', level: null, trigger: 'level-up', item: null },
      { id: 809, name: 'melmetal', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/809.png', level: 35, trigger: 'level-up', item: null },
    ]
  }

  // Familia Sneasel: la cadena de PokeAPI enlaza Weavile → Sneasler (por la
  // forma Hisui), pero lo real es Sneasel → Weavile y Sneasel-Hisui → Sneasler.
  if (dataPokemon.id === 215 || dataPokemon.id === 461) {
    evolutions = [
      { id: 215, name: 'sneasel', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/215.png', level: null, trigger: 'level-up', item: null },
      { id: 461, name: 'weavile', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/461.png', level: 45, trigger: 'level-up', item: 'Razor Claw' },
    ]
  } else if (dataPokemon.id === 10235 || dataPokemon.id === 903) {
    evolutions = [
      { id: 10235, name: 'sneasel-hisui', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10235.png', level: null, trigger: 'level-up', item: null },
      { id: 903, name: 'sneasler', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/903.png', level: 45, trigger: 'level-up', item: 'Razor Claw' },
    ]
  }

  // Familia Zigzagoon/Linoone/Obstagoon: la cadena de PokeAPI pone Linoone →
  // Obstagoon, pero solo la línea de Galar (Zigzagoon-Galar → Linoone-Galar →
  // Obstagoon) evoluciona a Obstagoon. La forma normal de Linoone NO evoluciona.
  if (dataPokemon.id === 263 || dataPokemon.id === 264) {
    evolutions = [
      { id: 263, name: 'zigzagoon', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/263.png', level: null, trigger: 'level-up', item: null },
      { id: 264, name: 'linoone', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/264.png', level: 20, trigger: 'level-up', item: null },
    ]
  } else if (dataPokemon.id === 10174 || dataPokemon.id === 10175 || dataPokemon.id === 862) {
    evolutions = [
      { id: 10174, name: 'zigzagoon-galar', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10174.png', level: null, trigger: 'level-up', item: null },
      { id: 10175, name: 'linoone-galar', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10175.png', level: 20, trigger: 'level-up', item: null },
      { id: 862, name: 'obstagoon', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/862.png', level: 35, trigger: 'level-up', item: null },
    ]
  }

  // Familia Pikachu: en este juego Pikachu con la Piedra Trueno evoluciona un
  // 70% a Raichu y un 30% a Raichu de Alola. La línea evolutiva de la Pokédex
  // muestra ambas formas como ramas alternativas, sea cual sea el miembro visto.
  const PIKACHU_FAMILY = new Set([172, 25, 26, 10100])
  if (PIKACHU_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 172, name: 'pichu', sprite: spriteFor(172), level: null, trigger: 'level-up', item: null },
      { id: 25, name: 'pikachu', sprite: spriteFor(25), level: 10, trigger: 'level-up', item: null },
      { id: 26, name: 'raichu', sprite: spriteFor(26), level: null, trigger: 'use-item', item: 'Thunder Stone', chance: 70 },
      { id: 10100, name: 'raichu-alola', sprite: spriteFor(10100), level: null, trigger: 'use-item', item: 'Thunder Stone', chance: 30, branch: true },
    ]
  }

  // Familia Cubone: en este juego Cubone evoluciona por nivel (28) un 70% a
  // Marowak y un 30% a Marowak de Alola. La línea muestra ambas formas como
  // ramas alternativas, sea cual sea el miembro visto.
  const CUBONE_FAMILY = new Set([104, 105, 10115])
  if (CUBONE_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 104, name: 'cubone', sprite: spriteFor(104), level: null, trigger: 'level-up', item: null },
      { id: 105, name: 'marowak', sprite: spriteFor(105), level: 28, trigger: 'level-up', item: null, chance: 70 },
      { id: 10115, name: 'marowak-alola', sprite: spriteFor(10115), level: 28, trigger: 'level-up', item: null, chance: 30, branch: true },
    ]
  }

  // Familia Exeggcute: en este juego Exeggcute con la Piedra Hoja evoluciona
  // un 70% a Exeggutor y un 30% a Exeggutor de Alola. La línea muestra ambas
  // formas como ramas alternativas, sea cual sea el miembro visto.
  const EXEGGCUTE_FAMILY = new Set([102, 103, 10114])
  if (EXEGGCUTE_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 102, name: 'exeggcute', sprite: spriteFor(102), level: null, trigger: 'level-up', item: null },
      { id: 103, name: 'exeggutor', sprite: spriteFor(103), level: null, trigger: 'use-item', item: 'Leaf Stone', chance: 70 },
      { id: 10114, name: 'exeggutor-alola', sprite: spriteFor(10114), level: null, trigger: 'use-item', item: 'Leaf Stone', chance: 30, branch: true },
    ]
  }

  // Familia Koffing: en este juego Koffing evoluciona por nivel (35) un 70% a
  // Weezing y un 30% a Weezing de Galar. La línea muestra ambas formas como
  // ramas alternativas, sea cual sea el miembro visto.
  const KOFFING_FAMILY = new Set([109, 110, 10167])
  if (KOFFING_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 109, name: 'koffing', sprite: spriteFor(109), level: null, trigger: 'level-up', item: null },
      { id: 110, name: 'weezing', sprite: spriteFor(110), level: 35, trigger: 'level-up', item: null, chance: 70 },
      { id: 10167, name: 'weezing-galar', sprite: spriteFor(10167), level: 35, trigger: 'level-up', item: null, chance: 30, branch: true },
    ]
  }

  // Familia Oshawott: en este juego Dewott evoluciona por nivel (36) un 70% a
  // Samurott y un 30% a Samurott de Hisui. La línea muestra ambas formas como
  // ramas alternativas, sea cual sea el miembro visto.
  const OSHAWOTT_FAMILY = new Set([501, 502, 503, 10236])
  if (OSHAWOTT_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 501, name: 'oshawott', sprite: spriteFor(501), level: null, trigger: 'level-up', item: null },
      { id: 502, name: 'dewott', sprite: spriteFor(502), level: 17, trigger: 'level-up', item: null },
      { id: 503, name: 'samurott', sprite: spriteFor(503), level: 36, trigger: 'level-up', item: null, chance: 70 },
      { id: 10236, name: 'samurott-hisui', sprite: spriteFor(10236), level: 36, trigger: 'level-up', item: null, chance: 30, branch: true },
    ]
  }

  // Nosepass → Probopass: en este juego evoluciona con la Piedra Trueno.
  if (dataPokemon.id === 299 || dataPokemon.id === 476) {
    evolutions = evolutions.map(evo =>
      evo.id === 476 ? { ...evo, level: null, trigger: 'use-item', item: 'Thunder Stone' } : evo
    )
  }

  // Phione y Manaphy no evolucionan: se muestran solos en la cadena.
  if (dataPokemon.id === 489 || dataPokemon.id === 490) {
    evolutions = []
  }

  // Familia Yamask: en este juego Yamask evoluciona a Cofagrigus (nivel 34) y
  // Yamask de Galar a Runerigus (nivel 34). Runerigus ya no aparece en la línea
  // de Yamask normal (la cadena de PokeAPI lo enlaza con la base).
  const YAMASK_FAMILY = new Set([562, 563, 10179, 867])
  if (YAMASK_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    if (dataPokemon.id === 562 || dataPokemon.id === 563) {
      evolutions = [
        { id: 562, name: 'yamask', sprite: spriteFor(562), level: null, trigger: 'level-up', item: null },
        { id: 563, name: 'cofagrigus', sprite: spriteFor(563), level: 34, trigger: 'level-up', item: null },
      ]
    } else {
      evolutions = [
        { id: 10179, name: 'yamask-galar', sprite: spriteFor(10179), level: null, trigger: 'level-up', item: null },
        { id: 867, name: 'runerigus', sprite: spriteFor(867), level: 34, trigger: 'level-up', item: null },
      ]
    }
  }

  // Familia Dunsparce: en este juego evoluciona un 50% a Dudunsparce (2
  // segmentos) y un 50% a Dudunsparce (3 segmentos) al nivel 45. La línea
  // muestra ambas formas como ramas alternativas, sea cual sea el miembro visto.
  const DUNSPARCE_FAMILY = new Set([206, 982, 10255])
  if (DUNSPARCE_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 206, name: 'dunsparce', sprite: spriteFor(206), level: null, trigger: 'level-up', item: null },
      { id: 982, name: 'dudunsparce', sprite: spriteFor(982), level: 45, trigger: 'level-up', item: null, chance: 50 },
      { id: 10255, name: 'dudunsparce-three-segment', sprite: spriteFor(10255), level: 45, trigger: 'level-up', item: null, chance: 50, branch: true },
    ]
  }

  // Familia Tyrogue: en este juego evoluciona por igual (1/3) a Hitmonlee,
  // Hitmonchan o Hitmontop al nivel 20. La línea muestra las tres formas como
  // ramas alternativas, sea cual sea el miembro visto.
  const TYROGUE_FAMILY = new Set([236, 106, 107, 237])
  if (TYROGUE_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 236, name: 'tyrogue', sprite: spriteFor(236), level: null, trigger: 'level-up', item: null },
      { id: 106, name: 'hitmonlee', sprite: spriteFor(106), level: 20, trigger: 'level-up', item: null, chance: 33 },
      { id: 107, name: 'hitmonchan', sprite: spriteFor(107), level: 20, trigger: 'level-up', item: null, chance: 33, branch: true },
      { id: 237, name: 'hitmontop', sprite: spriteFor(237), level: 20, trigger: 'level-up', item: null, chance: 33, branch: true },
    ]
  }

  // Familia Nincada: en este juego Nincada evoluciona un 50% a Ninjask y un
  // 50% a Shedinja (nivel 20). La línea muestra ambas formas como ramas.
  const NINCADA_FAMILY = new Set([290, 291, 292])
  if (NINCADA_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 290, name: 'nincada', sprite: spriteFor(290), level: null, trigger: 'level-up', item: null },
      { id: 291, name: 'ninjask', sprite: spriteFor(291), level: 20, trigger: 'level-up', item: null, chance: 50 },
      { id: 292, name: 'shedinja', sprite: spriteFor(292), level: 20, trigger: 'level-up', item: null, chance: 50, branch: true },
    ]
  }

  // Familia Burmy: en este juego Burmy evoluciona un 50% a Wormadam y un 50% a
  // Mothim (nivel 20). Wormadam se divide en 3 formas (Planta, Arena, Basura)
  // con la misma probabilidad. El nodo "grupo" agrupa las formas sin repetir
  // una tarjeta de Wormadam.
  const BURMY_FAMILY = new Set([412, 413, 414, 10004, 10005])
  if (BURMY_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 412, name: 'burmy', sprite: spriteFor(412), level: null, trigger: 'level-up', item: null },
      { id: 5000, name: 'wormadam', sprite: '', level: null, trigger: 'level-up', item: null, isGroup: true, parent: 412 },
      { id: 413, name: 'wormadam-plant', sprite: spriteFor(413), level: 20, trigger: 'level-up', item: null, chance: 17, parent: 5000 },
      { id: 10004, name: 'wormadam-sandy', sprite: spriteFor(10004), level: 20, trigger: 'level-up', item: null, chance: 17, parent: 5000, branch: true },
      { id: 10005, name: 'wormadam-trash', sprite: spriteFor(10005), level: 20, trigger: 'level-up', item: null, chance: 17, parent: 5000, branch: true },
      { id: 414, name: 'mothim', sprite: spriteFor(414), level: 20, trigger: 'level-up', item: null, chance: 50, parent: 412, branch: true },
    ]
  }

  // Familia Eevee: en este juego Eevee evoluciona solo con piedras (Vaporeon:
  // Piedra Agua, Jolteon: Piedra Trueno, Flareon: Piedra Fuego, Espeon: Piedra
  // Solar, Umbreon: Piedra Lunar, Leafeon: Piedra Hoja, Glaceon: Piedra Hielo,
  // Sylveon: Piedra Alba).
  const EEVEE_FAMILY = new Set([133, 134, 135, 136, 196, 197, 470, 471, 700])
  if (EEVEE_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 133, name: 'eevee', sprite: spriteFor(133), level: null, trigger: 'level-up', item: null },
      { id: 134, name: 'vaporeon', sprite: spriteFor(134), level: null, trigger: 'use-item', item: 'Water Stone' },
      { id: 135, name: 'jolteon', sprite: spriteFor(135), level: null, trigger: 'use-item', item: 'Thunder Stone', branch: true },
      { id: 136, name: 'flareon', sprite: spriteFor(136), level: null, trigger: 'use-item', item: 'Fire Stone', branch: true },
      { id: 196, name: 'espeon', sprite: spriteFor(196), level: null, trigger: 'use-item', item: 'Sun Stone', branch: true },
      { id: 197, name: 'umbreon', sprite: spriteFor(197), level: null, trigger: 'use-item', item: 'Moon Stone', branch: true },
      { id: 470, name: 'leafeon', sprite: spriteFor(470), level: null, trigger: 'use-item', item: 'Leaf Stone', branch: true },
      { id: 471, name: 'glaceon', sprite: spriteFor(471), level: null, trigger: 'use-item', item: 'Ice Stone', branch: true },
      { id: 700, name: 'sylveon', sprite: spriteFor(700), level: null, trigger: 'use-item', item: 'Dawn Stone', branch: true },
    ]
  }

  // Familia Scyther: en este juego Scyther evoluciona a Scizor con el
  // Revestimiento Metálico y a Kleavor con el Mineral Negro (nivel 35).
  const SCYTHER_FAMILY = new Set([123, 212, 900])
  if (SCYTHER_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 123, name: 'scyther', sprite: spriteFor(123), level: null, trigger: 'level-up', item: null },
      { id: 212, name: 'scizor', sprite: spriteFor(212), level: 35, trigger: 'level-up', item: 'Metal Coat' },
      { id: 900, name: 'kleavor', sprite: spriteFor(900), level: 35, trigger: 'level-up', item: 'Mineral Negro', branch: true },
    ]
  }

  // Familia Wurmple: en este juego Wurmple evoluciona un 50% a Silcoon y un
  // 50% a Cascoon (nivel 7); luego Silcoon → Beautifly y Cascoon → Dustox.
  const WURMPLE_FAMILY = new Set([265, 266, 267, 268, 269])
  if (WURMPLE_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 265, name: 'wurmple', sprite: spriteFor(265), level: null, trigger: 'level-up', item: null },
      { id: 266, name: 'silcoon', sprite: spriteFor(266), level: 7, trigger: 'level-up', item: null, parent: 265, chance: 50 },
      { id: 267, name: 'beautifly', sprite: spriteFor(267), level: 10, trigger: 'level-up', item: null, parent: 266 },
      { id: 268, name: 'cascoon', sprite: spriteFor(268), level: 7, trigger: 'level-up', item: null, parent: 265, chance: 50 },
      { id: 269, name: 'dustox', sprite: spriteFor(269), level: 10, trigger: 'level-up', item: null, parent: 268 },
    ]
  }

  // Familia Espurr: en este juego Espurr evoluciona un 50% a Meowstic (macho)
  // y un 50% a Meowstic (hembra) al nivel 25. La línea muestra ambas formas
  // como ramas alternativas, sea cual sea el miembro visto.
  const ESPURR_FAMILY = new Set([677, 678, 10025])
  if (ESPURR_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 677, name: 'espurr', sprite: spriteFor(677), level: null, trigger: 'level-up', item: null },
      { id: 678, name: 'meowstic-male', sprite: spriteFor(678), level: 25, trigger: 'level-up', item: null, parent: 677, chance: 50 },
      { id: 10025, name: 'meowstic-female', sprite: spriteFor(10025), level: 25, trigger: 'level-up', item: null, parent: 677, chance: 50 },
    ]
  }

  // Familia Meowth: en este juego Meowth evoluciona a Persian (nivel 28) y
  // Meowth de Galar a Perrserker (nivel 28). Perrserker ya no aparece en la
  // línea de Meowth normal (la cadena de PokeAPI lo enlaza con la base).
  const MEOWTH_FAMILY = new Set([52, 53, 10107, 10108, 10161, 863])
  if (MEOWTH_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    if (dataPokemon.id === 52 || dataPokemon.id === 53) {
      evolutions = [
        { id: 52, name: 'meowth', sprite: spriteFor(52), level: null, trigger: 'level-up', item: null },
        { id: 53, name: 'persian', sprite: spriteFor(53), level: 28, trigger: 'level-up', item: null },
      ]
    } else if (dataPokemon.id === 10161 || dataPokemon.id === 863) {
      evolutions = [
        { id: 10161, name: 'meowth-galar', sprite: spriteFor(10161), level: null, trigger: 'level-up', item: null },
        { id: 863, name: 'perrserker', sprite: spriteFor(863), level: 28, trigger: 'level-up', item: null },
      ]
    } else {
      evolutions = [
        { id: 10107, name: 'meowth-alola', sprite: spriteFor(10107), level: null, trigger: 'level-up', item: null },
        { id: 10108, name: 'persian-alola', sprite: spriteFor(10108), level: 28, trigger: 'level-up', item: null },
      ]
    }
  }

  // Familia Qwilfish: en este juego Qwilfish normal ya no evoluciona, y
  // Qwilfish de Hisui evoluciona a Overqwil (nivel 45). Overqwil ya no aparece
  // en la línea de Qwilfish normal (la cadena de PokeAPI lo enlaza con la base).
  const QWILFISH_FAMILY = new Set([211, 10234, 904])
  if (QWILFISH_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    if (dataPokemon.id === 211) {
      evolutions = []
    } else {
      evolutions = [
        { id: 10234, name: 'qwilfish-hisui', sprite: spriteFor(10234), level: null, trigger: 'level-up', item: null },
        { id: 904, name: 'overqwil', sprite: spriteFor(904), level: 45, trigger: 'level-up', item: null },
      ]
    }
  }

  // Familia Corsola: en este juego Corsola normal ya no evoluciona, y Corsola
  // de Galar evoluciona a Cursola (nivel 38). Cursola ya no aparece en la
  // línea de Corsola normal.
  const CORSOLA_FAMILY = new Set([222, 10173, 864])
  if (CORSOLA_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    if (dataPokemon.id === 222) {
      evolutions = []
    } else {
      evolutions = [
        { id: 10173, name: 'corsola-galar', sprite: spriteFor(10173), level: null, trigger: 'level-up', item: null },
        { id: 864, name: 'cursola', sprite: spriteFor(864), level: 38, trigger: 'level-up', item: null },
      ]
    }
  }

  // Familia Honedge: en este juego Doublade con la Piedra Noche evoluciona un
  // 50% a Aegislash Escudo y un 50% a Aegislash Filo. La línea muestra ambas
  // formas como ramas alternativas, sea cual sea el miembro visto.
  const HONEDGE_FAMILY = new Set([679, 680, 681, 10026])
  if (HONEDGE_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 679, name: 'honedge', sprite: spriteFor(679), level: null, trigger: 'level-up', item: null },
      { id: 680, name: 'doublade', sprite: spriteFor(680), level: 35, trigger: 'level-up', item: null },
      { id: 681, name: 'aegislash-shield', sprite: spriteFor(681), level: null, trigger: 'use-item', item: 'Dusk Stone', chance: 50 },
      { id: 10026, name: 'aegislash-blade', sprite: spriteFor(10026), level: null, trigger: 'use-item', item: 'Dusk Stone', chance: 50, branch: true },
    ]
  }

  // Familia Pumpkaboo/Gourgeist: en este juego Pumpkaboo evoluciona a Gourgeist
  // al nivel 35 (la cadena de PokeAPI lo marca como intercambio). Las formas de
  // tamaño (Pumpkaboo pequeño, grande, super y sus Gourgeist) no tienen especie
  // propia en PokeAPI, así que no mostraban cadena: aquí se unen todos los
  // tamaños, cada Pumpkaboo con su Gourgeist del mismo tamaño.
  const PUMPKABOO_FAMILY = new Set([710, 711, 10027, 10028, 10029, 10030, 10031, 10032])
  if (PUMPKABOO_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 710, name: 'pumpkaboo-average', sprite: spriteFor(710), level: null, trigger: 'level-up', item: null },
      { id: 711, name: 'gourgeist-average', sprite: spriteFor(711), level: 35, trigger: 'level-up', item: null },
      { id: 10027, name: 'pumpkaboo-small', sprite: spriteFor(10027), level: null, trigger: 'level-up', item: null, parent: 710, branch: true },
      { id: 10030, name: 'gourgeist-small', sprite: spriteFor(10030), level: 35, trigger: 'level-up', item: null, parent: 10027 },
      { id: 10028, name: 'pumpkaboo-large', sprite: spriteFor(10028), level: null, trigger: 'level-up', item: null, parent: 710, branch: true },
      { id: 10031, name: 'gourgeist-large', sprite: spriteFor(10031), level: 35, trigger: 'level-up', item: null, parent: 10028 },
      { id: 10029, name: 'pumpkaboo-super', sprite: spriteFor(10029), level: null, trigger: 'level-up', item: null, parent: 710, branch: true },
      { id: 10032, name: 'gourgeist-super', sprite: spriteFor(10032), level: 35, trigger: 'level-up', item: null, parent: 10029 },
    ]
  }

  // Familia Rockruff/Lycanroc: en este juego Rockruff evoluciona al nivel 25 un
  // 33% a Lycanroc Día, un 33% a Lycanroc Noche y un 33% a Lycanroc Crepúsculo.
  // La línea muestra las tres formas como ramas alternativas con su probabilidad,
  // sea cual sea el miembro visto (incluido Rockruff Tacto Afín).
  const ROCKRUFF_FAMILY = new Set([744, 745, 10126, 10152, 10151])
  if (ROCKRUFF_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 744, name: 'rockruff', sprite: spriteFor(744), level: null, trigger: 'level-up', item: null },
      { id: 745, name: 'lycanroc-midday', sprite: spriteFor(745), level: 25, trigger: 'level-up', item: null, chance: 33 },
      { id: 10126, name: 'lycanroc-midnight', sprite: spriteFor(10126), level: 25, trigger: 'level-up', item: null, chance: 33, branch: true },
      { id: 10152, name: 'lycanroc-dusk', sprite: spriteFor(10152), level: 25, trigger: 'level-up', item: null, chance: 33, branch: true },
    ]
  }

  // Familia Basculin/Basculegion: en este juego Basculin de Raya Blanca evoluciona
  // al nivel 35 un 50% a Basculegion macho y un 50% a Basculegion hembra. La línea
  // muestra ambas formas como ramas alternativas con su probabilidad, sea cual
  // sea el miembro visto.
  const BASCULIN_FAMILY = new Set([10247, 902, 10248])
  if (BASCULIN_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 10247, name: 'basculin-white-striped', sprite: spriteFor(10247), level: null, trigger: 'level-up', item: null },
      { id: 902, name: 'basculegion-male', sprite: spriteFor(902), level: 35, trigger: 'level-up', item: null, chance: 50 },
      { id: 10248, name: 'basculegion-female', sprite: spriteFor(10248), level: 35, trigger: 'level-up', item: null, chance: 50, branch: true },
    ]
  }

  // Familia Tandemaus/Maushold: en este juego Tandemaus evoluciona al nivel 25
  // un 90% a Maushold de Cuatro y un 10% a Maushold de Tres. La línea muestra
  // ambas formas como ramas alternativas con su probabilidad, sea cual sea el
  // miembro visto.
  const TANDEMAUS_FAMILY = new Set([924, 925, 10257])
  if (TANDEMAUS_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 924, name: 'tandemaus', sprite: spriteFor(924), level: null, trigger: 'level-up', item: null },
      { id: 925, name: 'maushold-family-of-four', sprite: spriteFor(925), level: 25, trigger: 'level-up', item: null, chance: 90 },
      { id: 10257, name: 'maushold-family-of-three', sprite: spriteFor(10257), level: 25, trigger: 'level-up', item: null, chance: 10, branch: true },
    ]
  }

  // Familia Finizen/Palafin: en este juego Finizen evoluciona a Palafin (forma
  // zero, id 964) al nivel 38 y este a Palafin Hero al nivel 48. La línea se
  // muestra sea cual sea el miembro visto.
  const FINIZEN_FAMILY = new Set([963, 964, 10256])
  if (FINIZEN_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 963, name: 'finizen', sprite: spriteFor(963), level: null, trigger: 'level-up', item: null },
      { id: 964, name: 'palafin-zero', sprite: spriteFor(964), level: 38, trigger: 'level-up', item: null },
      { id: 10256, name: 'palafin-hero', sprite: spriteFor(10256), level: 48, trigger: 'level-up', item: null },
    ]
  }

  // Familia Wooper de Paldea/Clodsire: en este juego Wooper de Paldea evoluciona
  // solo a Clodsire al nivel 20 (la cadena de PokeAPI también enlaza Quagsire,
  // pero eso solo aplica al Wooper normal). La línea se muestra sea cual sea el
  // miembro visto.
  const WOOPER_PALDEA_FAMILY = new Set([10253, 980])
  if (WOOPER_PALDEA_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 10253, name: 'wooper-paldea', sprite: spriteFor(10253), level: null, trigger: 'level-up', item: null },
      { id: 980, name: 'clodsire', sprite: spriteFor(980), level: 20, trigger: 'level-up', item: null },
    ]
  }

  // Familia Sandshrew de Alola/Sandslash de Alola: en este juego Sandshrew de
  // Alola evoluciona con la Piedra Hielo (la cadena de PokeAPI usa la evolución
  // por nivel del Sandshrew normal, así que se muestra el objeto real). La
  // línea se muestra sea cual sea el miembro visto.
  const SANDSHREW_ALOLA_FAMILY = new Set([10101, 10102])
  if (SANDSHREW_ALOLA_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 10101, name: 'sandshrew-alola', sprite: spriteFor(10101), level: null, trigger: 'level-up', item: null },
      { id: 10102, name: 'sandslash-alola', sprite: spriteFor(10102), level: null, trigger: 'use-item', item: 'Ice Stone' },
    ]
  }

  // Familia Vulpix de Alola/Ninetales de Alola: en este juego Vulpix de Alola
  // evoluciona con la Piedra Hielo (la cadena de PokeAPI usa la Piedra Fuego
  // del Vulpix normal, así que se muestra el objeto real). La línea se muestra
  // sea cual sea el miembro visto.
  const VULPIX_ALOLA_FAMILY = new Set([10103, 10104])
  if (VULPIX_ALOLA_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 10103, name: 'vulpix-alola', sprite: spriteFor(10103), level: null, trigger: 'level-up', item: null },
      { id: 10104, name: 'ninetales-alola', sprite: spriteFor(10104), level: null, trigger: 'use-item', item: 'Ice Stone' },
    ]
  }

  // Familia Slowpoke de Galar: en este juego evoluciona con el Brazal Galanuez
  // a Slowbro de Galar o con la Corona Galanuez a Slowking de Galar (la cadena
  // de PokeAPI usa las evoluciones del Slowpoke normal, así que se muestran los
  // objetos reales). La línea se muestra sea cual sea el miembro visto.
  const SLOWPOKE_GALAR_FAMILY = new Set([10164, 10165, 10172])
  if (SLOWPOKE_GALAR_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 10164, name: 'slowpoke-galar', sprite: spriteFor(10164), level: null, trigger: 'level-up', item: null },
      { id: 10165, name: 'slowbro-galar', sprite: spriteFor(10165), level: null, trigger: 'use-item', item: 'Galarica Cuff' },
      { id: 10172, name: 'slowking-galar', sprite: spriteFor(10172), level: null, trigger: 'use-item', item: 'Galarica Wreath', branch: true },
    ]
  }

  // Farfetch'd normal NO evoluciona: se muestra solo en su cadena (la cadena de
  // PokeAPI enlaza Sirfetch'd, que solo aplica a la forma de Galar).
  if (dataPokemon.id === 83) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 83, name: 'farfetchd', sprite: spriteFor(83), level: null, trigger: 'level-up', item: null },
    ]
  }

  // Familia Farfetch'd de Galar/Sirfetch'd: en este juego Farfetch'd de Galar
  // evoluciona a Sirfetch'd al nivel 35. La línea se muestra sea cual sea el
  // miembro visto.
  const FARFETCHD_GALAR_FAMILY = new Set([10166, 865])
  if (FARFETCHD_GALAR_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 10166, name: 'farfetchd-galar', sprite: spriteFor(10166), level: null, trigger: 'level-up', item: null },
      { id: 865, name: 'sirfetchd', sprite: spriteFor(865), level: 35, trigger: 'level-up', item: null },
    ]
  }

  // Familia Darumaka/Darmanitan: en este juego Darumaka evoluciona al nivel 35
  // un 80% a Darmanitan y un 20% a Darmanitan Modo Daruma. La línea muestra
  // ambas formas como ramas alternativas con su probabilidad.
  const DARUMANITA_FAMILY = new Set([554, 555, 10017])
  if (DARUMANITA_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 554, name: 'darumaka', sprite: spriteFor(554), level: null, trigger: 'level-up', item: null },
      { id: 555, name: 'darmanitan-standard', sprite: spriteFor(555), level: 35, trigger: 'level-up', item: null, chance: 80 },
      { id: 10017, name: 'darmanitan-zen', sprite: spriteFor(10017), level: 35, trigger: 'level-up', item: null, chance: 20, branch: true },
    ]
  }

  // Familia Darumaka de Galar: en este juego evoluciona con la Piedra Hielo a
  // Darmanitan de Galar, y este con la Piedra Fuego a su Modo Daruma. Se usa la
  // estructura de árbol anidado (como Wurmple) con `parent`.
  const DARUMANITA_GALAR_FAMILY = new Set([10176, 10177, 10178])
  if (DARUMANITA_GALAR_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 10176, name: 'darumaka-galar', sprite: spriteFor(10176), level: null, trigger: 'level-up', item: null },
      { id: 10177, name: 'darmanitan-galar-standard', sprite: spriteFor(10177), level: null, trigger: 'use-item', item: 'Ice Stone', parent: 10176 },
      { id: 10178, name: 'darmanitan-galar-zen', sprite: spriteFor(10178), level: null, trigger: 'use-item', item: 'Fire Stone', parent: 10177 },
    ]
  }

  // Familia Mime Jr.: en este juego Mime Jr. evoluciona al nivel 20 a Mr. Mime
  // o con la Piedra Hielo a Mr. Mime de Galar, y este a Mr. Rime al nivel 42.
  // Se usa la estructura de árbol anidado (como Wurmple) con `parent`.
  const MIME_JR_FAMILY = new Set([439, 122, 10168, 866])
  if (MIME_JR_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 439, name: 'mime-jr', sprite: spriteFor(439), level: null, trigger: 'level-up', item: null },
      { id: 122, name: 'mr-mime', sprite: spriteFor(122), level: 20, trigger: 'level-up', item: null, parent: 439 },
      { id: 10168, name: 'mr-mime-galar', sprite: spriteFor(10168), level: null, trigger: 'use-item', item: 'Ice Stone', parent: 439, branch: true },
      { id: 866, name: 'mr-rime', sprite: spriteFor(866), level: 42, trigger: 'level-up', item: null, parent: 10168 },
    ]
  }

  // Familia Wishiwashi: en este juego la Forma Solitaria evoluciona a la Forma
  // Banco al nivel 45. La línea se muestra sea cual sea el miembro visto.
  const WISHIWASHI_FAMILY = new Set([746, 10127])
  if (WISHIWASHI_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 746, name: 'wishiwashi-solo', sprite: spriteFor(746), level: null, trigger: 'level-up', item: null },
      { id: 10127, name: 'wishiwashi-school', sprite: spriteFor(10127), level: 45, trigger: 'level-up', item: null },
    ]
  }

  // Familia Terapagos: en este juego Terapagos evoluciona a su forma Terastal
  // al nivel 25 y esta a la forma Stellar al nivel 50. La línea se muestra sea
  // cual sea el miembro visto.
  const TERAPAGOS_FAMILY = new Set([1024, 10276, 10277])
  if (TERAPAGOS_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 1024, name: 'terapagos', sprite: spriteFor(1024), level: null, trigger: 'level-up', item: null },
      { id: 10276, name: 'terapagos-terastal', sprite: spriteFor(10276), level: 25, trigger: 'level-up', item: null },
      { id: 10277, name: 'terapagos-stellar', sprite: spriteFor(10277), level: 50, trigger: 'level-up', item: null },
    ]
  }

  // Familia Toxel/Toxtricity: en este juego Toxel evoluciona al nivel 30 un 50%
  // a Toxtricity Amped y un 50% a Toxtricity Low-Key. La línea muestra ambas
  // formas como ramas alternativas con su probabilidad.
  const TOXEL_FAMILY = new Set([848, 849, 10184])
  if (TOXEL_FAMILY.has(dataPokemon.id)) {
    const spriteFor = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    evolutions = [
      { id: 848, name: 'toxel', sprite: spriteFor(848), level: null, trigger: 'level-up', item: null },
      { id: 849, name: 'toxtricity-amped', sprite: spriteFor(849), level: 30, trigger: 'level-up', item: null, chance: 50 },
      { id: 10184, name: 'toxtricity-low-key', sprite: spriteFor(10184), level: 30, trigger: 'level-up', item: null, chance: 50, branch: true },
    ]
  }

  // Los Pokémon sin evolución se muestran solos en la cadena evolutiva.
  if (evolutions.length === 0) {
    evolutions = [{
      id: dataPokemon.id,
      name: dataPokemon.name,
      sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dataPokemon.id}.png`,
      level: null,
      trigger: 'level-up',
      item: null,
    }]
  }

  return {
    id: dataPokemon.id,
    name: dataPokemon.name,
    highResImage,
    highResImageShiny: dataPokemon.sprites.other?.['official-artwork']?.front_shiny || undefined,
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
  // Piedras evolutivas
  'fire-stone': 'Fire Stone',
  'water-stone': 'Water Stone',
  'thunder-stone': 'Thunder Stone',
  'leaf-stone': 'Leaf Stone',
  'moon-stone': 'Moon Stone',
  'sun-stone': 'Sun Stone',
  'shiny-stone': 'Shiny Stone',
  'dusk-stone': 'Dusk Stone',
  'dawn-stone': 'Dawn Stone',
  'ice-stone': 'Ice Stone',
  'gorra-de-ash': 'Gorra de Ash',
  'metal-coat': 'Metal Coat',
  'kings-rock': "King's Rock",
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
  'scroll-of-darkness': 'Manuscrito sombras',
  'scroll-of-waters': 'Manuscrito aguas',
  'black-augurite': 'Mineral Negro',
  'tart-apple': 'Tart Apple',
  'sweet-apple': 'Sweet Apple',
  'syrupy-apple': 'Syrupy Apple',
  'cracked-pot': 'Cracked Pot',
  'peat-block': 'Peat Block',
  'unremarkable-teacup': 'Unremarkable Teacup',
  'metal-alloy': 'Metal Alloy',
  'galarica-cuff': 'Galarica Cuff',
  'galarica-wreath': 'Galarica Wreath',
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

// Sprites animados de Gen V que PokeAPI tiene mezclados por la generación
// automática de la Gen 8:
// - Silicobra (843): su "animated/843.gif" es en realidad el de Sandaconda,
//   así que usa su sprite estático.
// - Sandaconda (844): su animación real vive en "animated/843.gif" (no existe
//   "animated/844.gif"), así que se le asigna ese archivo.
// Mapa id → archivo de sprite animado que le corresponde (null = sin animación).
const GEN5_ANIMATED_FILES: Record<number, number | null> = {
  843: null,
  844: 843,
}

// URL del sprite animado (Gen V) para un id, o el estático si su animado no
// existe/es incorrecto. Se usa en la Pokédex, las cadenas evolutivas, el
// Coliseo y al construir Pokémon.
export function pokemonSpriteUrl(id: number, shiny: boolean = false): string {
  const base = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
  const file = id in GEN5_ANIMATED_FILES ? GEN5_ANIMATED_FILES[id] : id
  if (file === null) {
    return shiny ? `${base}/shiny/${id}.png` : `${base}/${id}.png`
  }
  const animPath = shiny ? `animated/shiny/${file}.gif` : `animated/${file}.gif`
  return `${base}/versions/generation-v/black-white/${animPath}`
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

// Formas Origen de Dialga, Palkia y Giratina: no deben aparecer como salvajes,
// solo se obtienen transformando al legendario con su esfera.
const EXCLUDED_FORM_IDS = new Set([10007, 10245, 10246])

async function getAllFormIds(): Promise<number[]> {
  if (allFormIdsPromise) return allFormIdsPromise

  allFormIdsPromise = (async () => {
    const data = await fetchJson<{ results: PokeApiNamedResource[] }>(
      `${API_BASE}/pokemon?limit=1351&offset=0`
    )
    const allIds = data.results.map(r => extractIdFromResourceUrl(r.url))
    return allIds.filter(id => REGIONAL_FORM_RANGES.some(([lo, hi]) => id >= lo && id <= hi) && !EXCLUDED_FORM_IDS.has(id))
  })()

  return allFormIdsPromise
}

let allSpeciesListPromise: Promise<Array<{ id: number; name: string }>> | null = null

// Lista de TODAS las especies (1-1025) con su nombre, para el modo secreto.
export function getAllSpeciesList(): Promise<Array<{ id: number; name: string }>> {
  if (allSpeciesListPromise) return allSpeciesListPromise
  allSpeciesListPromise = (async () => {
    const data = await fetchJson<{ results: PokeApiNamedResource[] }>(
      `${API_BASE}/pokemon-species?limit=1300&offset=0`
    )
    return data.results.map(r => ({ id: extractIdFromResourceUrl(r.url), name: r.name }))
  })()
  return allSpeciesListPromise
}

// Tipos de un Pokémon por su id (solo el listado de tipos, sin el resto de
// datos). Se usa para rellenar los tipos de la Pokédex en el modo secreto.
export async function fetchPokemonTypes(id: number): Promise<string[]> {
  const data = await fetchJson<PokeApiPokemon>(`${API_BASE}/pokemon/${id}`)
  return data.types.map(t => t.type.name)
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
  bypassMinAppearLevel: boolean = false,
  meta?: { nature?: string; ivs?: PokemonIVs }
): Promise<Pokemon> {
  const cacheKey = `${identifier}_lvl${targetLevel}_${difficulty}_b${bypassMinAppearLevel ? 1 : 0}_r${runSeed}`
  let base: Pokemon
  const cached = pokemonCache.get(cacheKey)
  if (cached) {
    base = { ...cached, hp: cached.maxHp }
    if (shiny) {
      base.shiny = true
      base.sprite = makeShinySprite(base.sprite, base.id)
    }
  } else {

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

  // Habilidad: se prefiere la primera no oculta (slot 1), si existe.
  const visibleAbilities = [...data.abilities].sort((a, b) => a.slot - b.slot).filter(a => !a.is_hidden)
  const ability = (visibleAbilities[0] ?? [...data.abilities].sort((a, b) => a.slot - b.slot)[0])?.ability?.name

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
      // Silicobra (843) y Sandaconda (844): PokeAPI mezcló sus sprites animados
      // de Gen V (el "animated/843.gif" es el de Sandaconda). Se resuelve aquí
      // la animación correcta o el estático.
      if (id in GEN5_ANIMATED_FILES) {
        return pokemonSpriteUrl(id, shiny)
      }
      const gen5Animated = data.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default
      const baseSprite = gen5Animated ?? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
      return shiny ? makeShinySprite(baseSprite, id) : baseSprite
    })(),
    shiny: shiny || undefined,
    moves: parsedMoves,
    rawLevelUpMoves,
    captureRate,
    ability,
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
  base = pokemon
  }

  return applyMetaToPokemon(base, meta)
}

// Aplica naturaleza e IVs a un Pokémon recién creado. Si `meta` se pasa (p. ej.
// en una evolución, para conservar los valores del Pokémon original), se usan
// esos; si no, se generan al azar en cada aparición.
function applyMetaToPokemon(pokemon: Pokemon, meta?: { nature?: string; ivs?: PokemonIVs }): Pokemon {
  const nature = meta?.nature ?? randomNature()
  const ivs = meta?.ivs ?? generateIVs()
  const level = pokemon.level
  return {
    ...pokemon,
    nature,
    ivs,
    maxHp: pokemon.maxHp + ivStatBonus(ivs.hp, level),
    hp: (pokemon.hp > 0 ? pokemon.hp : 0) + ivStatBonus(ivs.hp, level),
    attack: Math.floor((pokemon.attack + ivStatBonus(ivs.attack, level)) * natureMultiplier(nature, 'attack')),
    defense: Math.floor((pokemon.defense + ivStatBonus(ivs.defense, level)) * natureMultiplier(nature, 'defense')),
    spAttack: Math.floor((pokemon.spAttack + ivStatBonus(ivs.spAttack, level)) * natureMultiplier(nature, 'spAttack')),
    spDefense: Math.floor((pokemon.spDefense + ivStatBonus(ivs.spDefense, level)) * natureMultiplier(nature, 'spDefense')),
    speed: Math.floor((pokemon.speed + ivStatBonus(ivs.speed, level)) * natureMultiplier(nature, 'speed')),
  }
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
  forcedLevel?: number,
  isElite: boolean = false
): Promise<Pokemon> {
  const allIds = await getSpeciesIdsByGeneration(generation)
  const legendaryIds = await getLegendaryIdsByGeneration(generation)
  const routeProgress = stepIndex / Math.max(1, totalNodes - 1)

  // Progreso efectivo: combina la etapa actual con la posición dentro de la ruta.
  // Infinite no tiene etapas, así que usa el progreso de la ruta directamente.
  // El Modo Original tiene 8 etapas (medallas), el resto 3 (insignias).
  const stageDivisor = difficulty === 'original' ? 8 : 3
  const progressRatio = difficulty === 'infinite'
    ? routeProgress
    : (stageIndex + routeProgress) / stageDivisor

  const candidateIds = filterSpeciesIdsForProgress(allIds, progressRatio, isBoss, bossStage, legendaryIds)

  // En Fácil, los jefes no sacan Pokémon legendarios: se excluyen de los
  // candidatos y de cualquier pool de respaldo.
  const bossNoLegendary = isBoss && difficulty === 'easy'
  const effectiveCandidates = bossNoLegendary ? candidateIds.filter(id => !legendaryIds.has(id)) : candidateIds
  const fallbackIds = bossNoLegendary ? allIds.filter(id => !legendaryIds.has(id)) : allIds

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
  } else if (isElite) {
    // Calle Victoria: los entrenadores élite llevan especies notablemente más
    // fuertes que un entrenador normal, pero por debajo de los jefes de la Liga.
    if (difficulty === 'easy') {
      minBst = 380; maxBst = 600
    } else if (difficulty === 'infinite') {
      minBst = 520; maxBst = 800
    } else if (difficulty === 'hard') {
      minBst = 550; maxBst = 780
    } else {
      minBst = 500; maxBst = 700
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

  const shuffledCandidates = [...effectiveCandidates].sort(() => 0.5 - Math.random())
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
  const pool = effectiveCandidates.length > 0 ? effectiveCandidates : fallbackIds
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
        : (chainNode.species.name.toLowerCase() === 'kubfu'
          ? KUBFU_EVOLVE_LEVEL
          : (minLevel ?? (trigger === 'trade' ? 35 : (FRIENDSHIP_EVOLVE_LEVEL_10.includes(chainNode.species.name.toLowerCase()) ? 10 : 45))))
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

// Kubfu evoluciona con un objeto a sus dos formas (la cadena de la API solo
// apunta a una especie, así que se mapean manualmente los dos manuscritos).
const KUBFU_ITEM_EVOLUTIONS: Record<string, { target: string; level: number }> = {
  'scroll-of-darkness': { target: 'urshifu-single-strike', level: KUBFU_EVOLVE_LEVEL },
  'scroll-of-waters': { target: 'urshifu-rapid-strike', level: KUBFU_EVOLVE_LEVEL },
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
      const detailsArr = evo.evolution_details ?? []
      // Evoluciones por objeto de uso (p. ej. Kubfu → Urshifu con Manuscrito):
      // la cadena de Kubfu agrupa todos los detalles en un solo nodo, así que
      // se recorren todos y se buscan los de tipo "use-item".
      for (const details of detailsArr) {
        const trigger = details?.trigger?.name ?? 'level-up'
        const useItem = details?.item?.name ?? null
        if (trigger === 'use-item' && useItem) {
          const kubfuTarget = KUBFU_ITEM_EVOLUTIONS[useItem]
          result.push({
            item: getEvolutionItemDisplayName(useItem),
            target: kubfuTarget ? kubfuTarget.target : evo.species.name,
            level: kubfuTarget ? kubfuTarget.level : 30,
          })
        }
      }
      if (result.length > 0) continue
      const details = detailsArr[0]
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
      const trigger = details?.trigger?.name ?? 'level-up'
      // Las que evolucionan por piedra o intercambio no tienen nivel, pero
      // tampoco deberían aparecer al inicio del juego.
      if (trigger === 'use-item' || trigger === 'trade') return SPECIAL_EVOLUTION_MIN_APPEAR_LEVEL
      // El resto (nivel, amistad...) usa el nivel real de evolución de ESTE
      // juego como umbral mínimo de aparición (p. ej. Munchlax→Snorlax a 45).
      return gameEvolutionInfo(chainNode.species.name, details).level
    }
    const found = findPreEvolutionLevel(evo, speciesName)
    if (found) return found
  }
  return null
}

export async function getEvolutionInfo(pokemonId: number): Promise<{ nextName: string | null; evolutionLevel: number | null; heldItem: string | null; heldItemEvolutions: HeldItemEvo[]; minAppearLevel: number | null }> {
  try {
    // Meltan y Melmetal no están enlazados en la cadena de PokeAPI (evolución
    // por caramelos en Pokémon GO). En este juego Meltan evoluciona a Melmetal
    // al nivel 35, y Melmetal no aparece por debajo de ese nivel.
    if (pokemonId === 808) {
      return { nextName: 'melmetal', evolutionLevel: 35, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    if (pokemonId === 809) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 35 }
    }
    // Aerodactyl no tiene pre-evolución en la cadena de PokeAPI (fósil): no
    // debe aparecer por debajo del nivel 40.
    if (pokemonId === 142) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 40 }
    }
    // Sneasel-Hisui → Sneasler (la especie Hisui no tiene cadena propia en
    // PokeAPI: la cadena de Sneasel enlaza Weavile → Sneasler por error).
    if (pokemonId === 10235) {
      return { nextName: 'sneasler', evolutionLevel: 45, heldItem: 'Razor Claw', heldItemEvolutions: [{ item: 'Razor Claw', target: 'sneasler', level: 45 }], minAppearLevel: null }
    }
    // Sneasler es la forma final de Sneasel-Hisui: no aparece por debajo de 45.
    if (pokemonId === 903) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 45 }
    }
    // La forma normal de Linoone NO evoluciona a Obstagoon (solo lo hace la
    // línea de Galar). Zigzagoon-Galar → Linoone-Galar → Obstagoon.
    if (pokemonId === 264) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    if (pokemonId === 10174) {
      return { nextName: 'linoone-galar', evolutionLevel: 20, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    if (pokemonId === 10175) {
      return { nextName: 'obstagoon', evolutionLevel: 35, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    if (pokemonId === 862) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 35 }
    }
    // Porygon2 → Porygon-Z: en este juego evoluciona con el Disco Raro al
    // nivel 45 (la cadena de PokeAPI lo marca como intercambio a nivel 35).
    if (pokemonId === 233) {
      return { nextName: 'porygon-z', evolutionLevel: 45, heldItem: 'Dubious Disc', heldItemEvolutions: [{ item: 'Dubious Disc', target: 'porygon-z', level: 45 }], minAppearLevel: SPECIAL_EVOLUTION_MIN_APPEAR_LEVEL }
    }
    // Aipom → Ambipom evoluciona al nivel 25 en este juego.
    if (pokemonId === 190) {
      return { nextName: 'ambipom', evolutionLevel: 25, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Cubone → Marowak: 70% Marowak, 30% Marowak de Alola.
    if (pokemonId === 104) {
      return { nextName: Math.random() < 0.7 ? 'marowak' : 'marowak-alola', evolutionLevel: 28, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Scyther → Kleavor: evoluciona con el Mineral Negro al nivel 35. También
    // puede evolucionar a Scizor con el Revestimiento Metálico (nivel 35).
    if (pokemonId === 123) {
      return {
        nextName: 'kleavor',
        evolutionLevel: 35,
        heldItem: 'Mineral Negro',
        heldItemEvolutions: [
          { item: 'Metal Coat', target: 'scizor', level: 35 },
          { item: 'Mineral Negro', target: 'kleavor', level: 35 },
        ],
        minAppearLevel: null,
      }
    }
    // Kleavor es la evolución de Scyther con el Mineral Negro: no aparece por
    // debajo del nivel 35.
    if (pokemonId === 900) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 35 }
    }
    // Dusclops → Dusknoir: en este juego evoluciona con el Paño Siniestro al
    // nivel 45 (la cadena de PokeAPI lo marca como intercambio a nivel 35).
    if (pokemonId === 356) {
      return { nextName: 'dusknoir', evolutionLevel: 45, heldItem: 'Reaper Cloth', heldItemEvolutions: [{ item: 'Reaper Cloth', target: 'dusknoir', level: 45 }], minAppearLevel: 37 }
    }
    // Dusknoir es la evolución de Dusclops con el Paño Siniestro: no aparece
    // por debajo del nivel 45.
    if (pokemonId === 477) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 45 }
    }
    // Wurmple → Silcoon o Cascoon: 50% cada uno (la cadena de PokeAPI solo
    // apunta al primero, Silcoon).
    if (pokemonId === 265) {
      return { nextName: Math.random() < 0.5 ? 'silcoon' : 'cascoon', evolutionLevel: 7, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Espurr → Meowstic macho o hembra: 50% cada uno (nivel 25).
    if (pokemonId === 677) {
      return { nextName: Math.random() < 0.5 ? 'meowstic-male' : 'meowstic-female', evolutionLevel: 25, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Meowth → Persian (nivel 28). Perrserker NO es evolución de Meowth normal.
    if (pokemonId === 52) {
      return { nextName: 'persian', evolutionLevel: 28, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Meowth de Galar → Perrserker (nivel 28).
    if (pokemonId === 10161) {
      return { nextName: 'perrserker', evolutionLevel: 28, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Meowth de Alola → Persian de Alola (nivel 28): la forma de Alola no tiene
    // especie propia en PokeAPI, así que no evolucionaba.
    if (pokemonId === 10107) {
      return { nextName: 'persian-alola', evolutionLevel: 28, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Persian de Alola es la evolución de Meowth de Alola: no aparece por
    // debajo del nivel 28.
    if (pokemonId === 10108) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 28 }
    }
    // Geodude de Alola → Graveler de Alola (nivel 25) → Golem de Alola (nivel 35):
    // las formas de Alola no tienen especie propia en PokeAPI, así que no
    // evolucionaban.
    if (pokemonId === 10109) {
      return { nextName: 'graveler-alola', evolutionLevel: 25, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    if (pokemonId === 10110) {
      return { nextName: 'golem-alola', evolutionLevel: 35, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Golem de Alola es la evolución de Graveler de Alola: no aparece por
    // debajo del nivel 35.
    if (pokemonId === 10111) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 35 }
    }
    // Ponyta de Galar → Rapidash de Galar (nivel 40): la forma de Galar no tiene
    // especie propia en PokeAPI, así que no evolucionaba.
    if (pokemonId === 10162) {
      return { nextName: 'rapidash-galar', evolutionLevel: 40, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Rapidash de Galar es la evolución de Ponyta de Galar: no aparece por
    // debajo del nivel 40.
    if (pokemonId === 10163) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 40 }
    }
    // Farfetch'd normal NO evoluciona (solo la forma de Galar evoluciona a
    // Sirfetch'd; la cadena de PokeAPI lo enlaza con la base por error).
    if (pokemonId === 83) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Farfetch'd de Galar → Sirfetch'd (nivel 35): la forma de Galar no tiene
    // especie propia en PokeAPI, así que no evolucionaba.
    if (pokemonId === 10166) {
      return { nextName: 'sirfetchd', evolutionLevel: 35, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Sirfetch'd es la evolución de Farfetch'd de Galar: no aparece por debajo
    // del nivel 35.
    if (pokemonId === 865) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 35 }
    }
    // Darumaka → Darmanitan: en este juego evoluciona al nivel 35 un 80% a
    // Darmanitan normal y un 20% a Darmanitan Modo Daruma (la especie
    // "darmanitan" no existe como Pokémon en PokeAPI: hay que usar las formas).
    if (pokemonId === 554) {
      return { nextName: Math.random() < 0.8 ? 'darmanitan-standard' : 'darmanitan-zen', evolutionLevel: 35, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Darmanitan (normal y Modo Daruma) es la evolución de Darumaka: no aparece
    // por debajo del nivel 35.
    if (pokemonId === 555 || pokemonId === 10017) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 35 }
    }
    // Darumaka de Galar → Darmanitan de Galar con la Piedra Hielo (la forma de
    // Galar no tiene especie propia en PokeAPI, así que no evolucionaba con el
    // objeto).
    if (pokemonId === 10176) {
      return { nextName: 'darmanitan-galar-standard', evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Darmanitan de Galar → Modo Daruma con la Piedra Fuego.
    if (pokemonId === 10177) {
      return { nextName: 'darmanitan-galar-zen', evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: SPECIAL_EVOLUTION_MIN_APPEAR_LEVEL }
    }
    // Darmanitan de Galar Modo Daruma es la evolución de Darmanitan de Galar:
    // no aparece por debajo del nivel 20.
    if (pokemonId === 10178) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: SPECIAL_EVOLUTION_MIN_APPEAR_LEVEL }
    }
    // Mime Jr. → Mr. Mime (nivel 20) o → Mr. Mime de Galar con la Piedra Hielo
    // (la cadena de PokeAPI modela la forma de Galar con evolved_form, sin
    // objeto, así que se engancha aquí). Mr. Mime de Galar luego evoluciona a
    // Mr. Rime (nivel 42).
    if (pokemonId === 439) {
      return { nextName: 'mr-mime', evolutionLevel: 20, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Mr. Mime es la evolución de Mime Jr.: no aparece por debajo del nivel 20.
    if (pokemonId === 122) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 20 }
    }
    // Mr. Mime de Galar → Mr. Rime (nivel 42): la forma de Galar no tiene
    // especie propia en PokeAPI, así que no evolucionaba.
    if (pokemonId === 10168) {
      return { nextName: 'mr-rime', evolutionLevel: 42, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Mr. Rime es la evolución de Mr. Mime de Galar: no aparece por debajo del
    // nivel 42.
    if (pokemonId === 866) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 42 }
    }
    // Wishiwashi (Forma Solitaria) → Forma Banco (school): en este juego
    // evoluciona al nivel 45 (PokeAPI no tiene cadena: Wishiwashi es de una
    // sola etapa y su Forma Banco no tiene especie propia).
    if (pokemonId === 746) {
      return { nextName: 'wishiwashi-school', evolutionLevel: 45, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Wishiwashi Forma Banco es la evolución de la Forma Solitaria: no aparece
    // por debajo del nivel 45.
    if (pokemonId === 10127) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 45 }
    }
    // Terapagos → Terapagos Terastal (nivel 25) → Terapagos Stellar (nivel 50):
    // PokeAPI no tiene cadena (Terapagos es de una sola etapa y sus formas no
    // tienen especie propia).
    if (pokemonId === 1024) {
      return { nextName: 'terapagos-terastal', evolutionLevel: 25, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    if (pokemonId === 10276) {
      return { nextName: 'terapagos-stellar', evolutionLevel: 50, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Terapagos Stellar es la evolución de la forma Terastal: no aparece por
    // debajo del nivel 50.
    if (pokemonId === 10277) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 50 }
    }
    // Toxel → Toxtricity: en este juego evoluciona al nivel 30 un 50% a
    // Toxtricity Amped y un 50% a Toxtricity Low-Key (la especie "toxtricity"
    // no existe como Pokémon en PokeAPI: hay que usar las formas).
    if (pokemonId === 848) {
      return { nextName: Math.random() < 0.5 ? 'toxtricity-amped' : 'toxtricity-low-key', evolutionLevel: 30, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Toxtricity (Amped y Low-Key) es la evolución de Toxel: no aparece por
    // debajo del nivel 30.
    if (pokemonId === 849 || pokemonId === 10184) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 30 }
    }
    // Koffing → Weezing: 70% Weezing, 30% Weezing de Galar (nivel 35).
    if (pokemonId === 109) {
      return { nextName: Math.random() < 0.7 ? 'weezing' : 'weezing-galar', evolutionLevel: 35, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Dewott → Samurott: 70% Samurott, 30% Samurott de Hisui (nivel 36).
    if (pokemonId === 502) {
      return { nextName: Math.random() < 0.7 ? 'samurott' : 'samurott-hisui', evolutionLevel: 36, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Seadra → Kingdra: en este juego evoluciona con la Escama Dragón al nivel
    // 45 (la cadena de PokeAPI lo marca como intercambio a nivel 35).
    if (pokemonId === 117) {
      return { nextName: 'kingdra', evolutionLevel: 45, heldItem: 'Dragon Scale', heldItemEvolutions: [{ item: 'Dragon Scale', target: 'kingdra', level: 45 }], minAppearLevel: 32 }
    }
    // Kingdra es la evolución de Seadra con la Escama Dragón: no aparece por
    // debajo del nivel 45.
    if (pokemonId === 118) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 45 }
    }
    // Qwilfish normal NO evoluciona a Overqwil (solo lo hace la línea de Hisui).
    if (pokemonId === 211) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Qwilfish de Hisui → Overqwil (nivel 45 en este juego).
    if (pokemonId === 10234) {
      return { nextName: 'overqwil', evolutionLevel: 45, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Dunsparce → Dudunsparce (2 o 3 segmentos): 50% cada uno (nivel 45).
    if (pokemonId === 206) {
      return { nextName: Math.random() < 0.5 ? 'dudunsparce' : 'dudunsparce-three-segment', evolutionLevel: 45, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Slowpoke → Slowking: en este juego evoluciona con la Roca del Rey al
    // nivel 30 (la cadena de PokeAPI lo marca como intercambio a nivel 35).
    // Slowbro sigue evolucionando por nivel a 37.
    if (pokemonId === 79) {
      return { nextName: 'slowbro', evolutionLevel: 37, heldItem: null, heldItemEvolutions: [{ item: "King's Rock", target: 'slowking', level: 30 }], minAppearLevel: null }
    }
    // Slowpoke de Galar → Slowbro de Galar (Brazal Galanuez) o → Slowking de
    // Galar (Corona Galanuez): evoluciona con los objetos desde el inventario
    // (la forma de Galar no tiene especie propia en PokeAPI).
    if (pokemonId === 10164) {
      return { nextName: 'slowbro-galar', evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Slowbro/Slowking de Galar son las evoluciones de Slowpoke de Galar con
    // los objetos Galanuez: no aparecen por debajo del nivel 20.
    if (pokemonId === 10165 || pokemonId === 10172) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: SPECIAL_EVOLUTION_MIN_APPEAR_LEVEL }
    }
    // Corsola normal NO evoluciona a Cursola (solo lo hace la línea de Galar).
    if (pokemonId === 222) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Corsola de Galar → Cursola (nivel 38 en este juego).
    if (pokemonId === 10173) {
      return { nextName: 'cursola', evolutionLevel: 38, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Tyrogue → Hitmonlee / Hitmonchan / Hitmontop: 1/3 de probabilidad cada una.
    if (pokemonId === 236) {
      const tyrogueEvolutions = ['hitmonlee', 'hitmonchan', 'hitmontop']
      return { nextName: tyrogueEvolutions[Math.floor(Math.random() * tyrogueEvolutions.length)], evolutionLevel: 20, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Nincada → Ninjask o Shedinja: 50% cada uno (nivel 20).
    if (pokemonId === 290) {
      return { nextName: Math.random() < 0.5 ? 'ninjask' : 'shedinja', evolutionLevel: 20, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Shedinja es la evolución alternativa de Nincada: no aparece por debajo
    // del nivel 20.
    if (pokemonId === 292) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 20 }
    }
    // Burmy → Wormadam o Mothim: 50% cada uno (nivel 20). Wormadam tiene 3
    // formas (Planta, Arena, Basura) con la misma probabilidad.
    if (pokemonId === 412) {
      if (Math.random() < 0.5) {
        const wormadamForms = ['wormadam', 'wormadam-sandy', 'wormadam-trash']
        return { nextName: wormadamForms[Math.floor(Math.random() * wormadamForms.length)], evolutionLevel: 20, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
      }
      return { nextName: 'mothim', evolutionLevel: 20, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Happiny → Chansey: en este juego evoluciona con la Piedra Oval al nivel
    // 35 (la cadena de PokeAPI no marca nivel, así que por defecto daba 45).
    if (pokemonId === 440) {
      return { nextName: 'chansey', evolutionLevel: 35, heldItem: 'Oval Stone', heldItemEvolutions: [{ item: 'Oval Stone', target: 'chansey', level: 35 }], minAppearLevel: null }
    }
    // Nosepass → Probopass: en este juego evoluciona solo con la Piedra Trueno
    // (sin nivel), como las demás evoluciones por piedra.
    if (pokemonId === 299) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Phione y Manaphy no evolucionan (la cadena de PokeAPI enlaza Phione →
    // Manaphy por error; en realidad Manaphy genera a Phione por cría).
    if (pokemonId === 489 || pokemonId === 490) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Yamask → Cofagrigus (nivel 34). Runerigus NO es evolución de Yamask normal.
    if (pokemonId === 562) {
      return { nextName: 'cofagrigus', evolutionLevel: 34, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Yamask de Galar → Runerigus (nivel 34 en este juego).
    if (pokemonId === 10179) {
      return { nextName: 'runerigus', evolutionLevel: 34, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Runerigus es la evolución de Yamask de Galar: no aparece por debajo de 34.
    if (pokemonId === 867) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 34 }
    }
    // Doublade → Aegislash: en este juego evoluciona con la Piedra Noche un
    // 50% a la forma Escudo (aegislash-shield) y un 50% a la forma Filo
    // (aegislash-blade).
    if (pokemonId === 680) {
      return { nextName: Math.random() < 0.5 ? 'aegislash-shield' : 'aegislash-blade', evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Familia Pumpkaboo/Gourgeist: en este juego Pumpkaboo evoluciona a
    // Gourgeist al nivel 35 (la cadena de PokeAPI lo marca como intercambio y
    // el nombre de especie "gourgeist" no existe como Pokémon, así que la
    // evolución en juego fallaba). Cada tamaño (normal, pequeño, grande, super)
    // evoluciona a su Gourgeist del mismo tamaño.
    if (pokemonId === 710) {
      return { nextName: 'gourgeist-average', evolutionLevel: 35, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    if (pokemonId === 10027) {
      return { nextName: 'gourgeist-small', evolutionLevel: 35, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    if (pokemonId === 10028) {
      return { nextName: 'gourgeist-large', evolutionLevel: 35, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    if (pokemonId === 10029) {
      return { nextName: 'gourgeist-super', evolutionLevel: 35, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Gourgeist es la evolución de Pumpkaboo: no aparece por debajo del nivel 35.
    if (pokemonId === 711 || pokemonId === 10030 || pokemonId === 10031 || pokemonId === 10032) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 35 }
    }
    // Familia Rockruff/Lycanroc: en este juego Rockruff evoluciona al nivel 25
    // un 33% a Lycanroc Día, un 33% a Lycanroc Noche y un 33% a Lycanroc
    // Crepúsculo (la cadena de PokeAPI solo apunta al primero por defecto).
    if (pokemonId === 744) {
      const lycanrocForms = ['lycanroc-midday', 'lycanroc-midnight', 'lycanroc-dusk']
      return { nextName: lycanrocForms[Math.floor(Math.random() * lycanrocForms.length)], evolutionLevel: 25, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Rockruff Tacto Afín evoluciona siempre a Lycanroc Crepúsculo (nivel 25).
    if (pokemonId === 10151) {
      return { nextName: 'lycanroc-dusk', evolutionLevel: 25, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Lycanroc es la evolución de Rockruff: no aparece por debajo del nivel 25.
    if (pokemonId === 745 || pokemonId === 10126 || pokemonId === 10152) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 25 }
    }
    // Familia Basculin/Basculegion: en este juego Basculin de Raya Blanca
    // evoluciona al nivel 35 un 50% a Basculegion macho y un 50% a Basculegion
    // hembra (la cadena de PokeAPI lo marca como recoil-damage sin nivel y la
    // forma blanca no tiene especie propia, así que no evolucionaba).
    if (pokemonId === 10247) {
      return { nextName: Math.random() < 0.5 ? 'basculegion-male' : 'basculegion-female', evolutionLevel: 35, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Basculegion es la evolución de Basculin de Raya Blanca: no aparece por
    // debajo del nivel 35.
    if (pokemonId === 902 || pokemonId === 10248) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 35 }
    }
    // Familia Tandemaus/Maushold: en este juego Tandemaus evoluciona al nivel 25
    // un 90% a Maushold de Cuatro y un 10% a Maushold de Tres (la cadena de
    // PokeAPI apunta a "maushold", que no existe como Pokémon, así que la
    // evolución en juego fallaba).
    if (pokemonId === 924) {
      return { nextName: Math.random() < 0.9 ? 'maushold-family-of-four' : 'maushold-family-of-three', evolutionLevel: 25, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Maushold es la evolución de Tandemaus: no aparece por debajo del nivel 25.
    if (pokemonId === 925 || pokemonId === 10257) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 25 }
    }
    // Finizen → Palafin: en este juego Finizen evoluciona a Palafin al nivel 38
    // (la cadena de PokeAPI lo marca por nivel, pero la especie "palafin" no
    // existe como Pokémon: hay que usar "palafin-zero", id 964, o la evolución
    // en juego fallaba).
    if (pokemonId === 963) {
      return { nextName: 'palafin-zero', evolutionLevel: 38, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Palafin-zero es la evolución de Finizen (no aparece por debajo del 38) y
    // evoluciona a Palafin Hero al nivel 48 (la forma Hero no tiene especie
    // propia en PokeAPI, así que no evolucionaba).
    if (pokemonId === 964) {
      return { nextName: 'palafin-hero', evolutionLevel: 48, heldItem: null, heldItemEvolutions: [], minAppearLevel: 38 }
    }
    // Palafin-hero es la evolución de Palafin-zero: no aparece por debajo del
    // nivel 48.
    if (pokemonId === 10256) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 48 }
    }
    // Wooper de Paldea → Clodsire: en este juego evoluciona al nivel 20 (la
    // forma de Paldea no tiene especie propia en PokeAPI, así que no
    // evolucionaba). No evoluciona a Quagsire (eso lo hace Wooper normal).
    if (pokemonId === 10253) {
      return { nextName: 'clodsire', evolutionLevel: 20, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Clodsire es la evolución de Wooper de Paldea: no aparece por debajo del
    // nivel 20.
    if (pokemonId === 980) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 20 }
    }
    // Rattata de Alola → Raticate de Alola: en este juego evoluciona al nivel 20
    // (la forma de Alola no tiene especie propia en PokeAPI, así que no
    // evolucionaba).
    if (pokemonId === 10091) {
      return { nextName: 'raticate-alola', evolutionLevel: 20, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Raticate de Alola es la evolución de Rattata de Alola: no aparece por
    // debajo del nivel 20.
    if (pokemonId === 10092) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 20 }
    }
    // Sandshrew de Alola → Sandslash de Alola: en este juego evoluciona con la
    // Piedra Hielo (la forma de Alola no tiene especie propia en PokeAPI, así
    // que no evolucionaba con el objeto).
    if (pokemonId === 10101) {
      return { nextName: 'sandslash-alola', evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Sandslash de Alola es la evolución de Sandshrew de Alola con la Piedra
    // Hielo: no aparece por debajo del nivel 20.
    if (pokemonId === 10102) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: SPECIAL_EVOLUTION_MIN_APPEAR_LEVEL }
    }
    // Vulpix de Alola → Ninetales de Alola: en este juego evoluciona con la
    // Piedra Hielo (la forma de Alola no tiene especie propia en PokeAPI, así
    // que no evolucionaba con el objeto).
    if (pokemonId === 10103) {
      return { nextName: 'ninetales-alola', evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Ninetales de Alola es la evolución de Vulpix de Alola con la Piedra Hielo:
    // no aparece por debajo del nivel 20.
    if (pokemonId === 10104) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: SPECIAL_EVOLUTION_MIN_APPEAR_LEVEL }
    }
    // Diglett de Alola → Dugtrio de Alola: en este juego evoluciona al nivel 26
    // (la forma de Alola no tiene especie propia en PokeAPI, así que no
    // evolucionaba).
    if (pokemonId === 10105) {
      return { nextName: 'dugtrio-alola', evolutionLevel: 26, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Dugtrio de Alola es la evolución de Diglett de Alola: no aparece por
    // debajo del nivel 26.
    if (pokemonId === 10106) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 26 }
    }
    // Grimer de Alola → Muk de Alola: en este juego evoluciona al nivel 38
    // (la forma de Alola no tiene especie propia en PokeAPI, así que no
    // evolucionaba).
    if (pokemonId === 10112) {
      return { nextName: 'muk-alola', evolutionLevel: 38, heldItem: null, heldItemEvolutions: [], minAppearLevel: null }
    }
    // Muk de Alola es la evolución de Grimer de Alola: no aparece por debajo
    // del nivel 38.
    if (pokemonId === 10113) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 38 }
    }
    // Bisharp → Kingambit: en este juego evoluciona al nivel 70 (la cadena de
    // PokeAPI usa un trigger especial sin nivel, que por defecto daba 45).
    if (pokemonId === 625) {
      return { nextName: 'kingambit', evolutionLevel: 70, heldItem: null, heldItemEvolutions: [], minAppearLevel: 52 }
    }
    // Kingambit es la evolución de Bisharp: no aparece por debajo del nivel 70.
    if (pokemonId === 983) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: 70 }
    }
    // Probopass es la evolución de Nosepass con la Piedra Trueno: no aparece
    // por debajo del nivel 20.
    if (pokemonId === 476) {
      return { nextName: null, evolutionLevel: null, heldItem: null, heldItemEvolutions: [], minAppearLevel: SPECIAL_EVOLUTION_MIN_APPEAR_LEVEL }
    }
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
    const newBasePokemon = await buildPokemonFromApi(nextName, 1, currentPokemon.level, currentPokemon.shiny ?? false, 'medium', false, { nature: currentPokemon.nature, ivs: currentPokemon.ivs })
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
  // Hardcoded Eevee evolutions (all 8 eeveelutions with stones)
  if (pokemonId === 133) {
    const eeveeMap: Record<string, string> = {
      'fire-stone': 'flareon',
      'water-stone': 'vaporeon',
      'thunder-stone': 'jolteon',
      'leaf-stone': 'leafeon',
      'ice-stone': 'glaceon',
      'sun-stone': 'espeon',
      'moon-stone': 'umbreon',
      'dawn-stone': 'sylveon',
    }
    const evolved = eeveeMap[stoneItemName]
    if (evolved) return { canEvolve: true, evolvedName: evolved }
  }

  // Gorra de Ash: Greninja → Greninja-Ash (Battle Bond, ID 10117)
  if (pokemonId === 658 && stoneItemName === 'gorra-de-ash') {
    return { canEvolve: true, evolvedName: 'greninja-ash' }
  }

  // Pikachu con Piedra Trueno: 70% Raichu, 30% Raichu de Alola.
  if (pokemonId === 25 && stoneItemName === 'thunder-stone') {
    return { canEvolve: true, evolvedName: Math.random() < 0.7 ? 'raichu' : 'raichu-alola' }
  }

  // Exeggcute con la Piedra Hoja: 70% Exeggutor, 30% Exeggutor de Alola.
  if (pokemonId === 102 && stoneItemName === 'leaf-stone') {
    return { canEvolve: true, evolvedName: Math.random() < 0.7 ? 'exeggutor' : 'exeggutor-alola' }
  }

  // Nosepass con la Piedra Trueno: evoluciona a Probopass.
  if (pokemonId === 299 && stoneItemName === 'thunder-stone') {
    return { canEvolve: true, evolvedName: 'probopass' }
  }

  // Doublade con la Piedra Noche: 50% Aegislash Escudo, 50% Aegislash Filo.
  if (pokemonId === 680 && stoneItemName === 'dusk-stone') {
    return { canEvolve: true, evolvedName: Math.random() < 0.5 ? 'aegislash-shield' : 'aegislash-blade' }
  }

  // Sandshrew de Alola con la Piedra Hielo: evoluciona a Sandslash de Alola.
  if (pokemonId === 10101 && stoneItemName === 'ice-stone') {
    return { canEvolve: true, evolvedName: 'sandslash-alola' }
  }

  // Vulpix de Alola con la Piedra Hielo: evoluciona a Ninetales de Alola.
  if (pokemonId === 10103 && stoneItemName === 'ice-stone') {
    return { canEvolve: true, evolvedName: 'ninetales-alola' }
  }

  // Slowpoke de Galar con el Brazal Galanuez: evoluciona a Slowbro de Galar.
  if (pokemonId === 10164 && stoneItemName === 'galarica-cuff') {
    return { canEvolve: true, evolvedName: 'slowbro-galar' }
  }

  // Slowpoke de Galar con la Corona Galanuez: evoluciona a Slowking de Galar.
  if (pokemonId === 10164 && stoneItemName === 'galarica-wreath') {
    return { canEvolve: true, evolvedName: 'slowking-galar' }
  }

  // Darumaka de Galar con la Piedra Hielo: evoluciona a Darmanitan de Galar.
  if (pokemonId === 10176 && stoneItemName === 'ice-stone') {
    return { canEvolve: true, evolvedName: 'darmanitan-galar-standard' }
  }

  // Darmanitan de Galar con la Piedra Fuego: evoluciona a su Modo Daruma.
  if (pokemonId === 10177 && stoneItemName === 'fire-stone') {
    return { canEvolve: true, evolvedName: 'darmanitan-galar-zen' }
  }

  // Mime Jr. con la Piedra Hielo: evoluciona a Mr. Mime de Galar.
  if (pokemonId === 439 && stoneItemName === 'ice-stone') {
    return { canEvolve: true, evolvedName: 'mr-mime-galar' }
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