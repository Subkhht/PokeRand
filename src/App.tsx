import { useMemo, useState, Component, type ReactNode } from 'react'
import './App.css'
import { applyDamage, healPokemon, randomFrom, scalePokemonForNode, startRun } from './game/engine'
import {
  getBalancedPokemonByGeneration,
  getRandomStarterByGeneration,
  evolvePokemon,
  fetchPokemonDetails,
  checkAndLearnNewMove,
  type PokemonDetails
} from './game/pokeapi'
import { getTypeEffectiveness } from './game/typesChart'
import type { Move, Pokemon, RouteNode, RunConfig, RunModifier, DefeatSummary } from './game/types'

type Screen = 'setup' | 'route' | 'battle' | 'shop' | 'victory' | 'defeat'
type Difficulty = 'easy' | 'medium' | 'hard'

const difficultyNodeCounts: Record<Difficulty, number> = {
  easy: 5,
  medium: 10,
  hard: 25
}

const difficultyLabels: Record<Difficulty, { title: string; desc: string }> = {
  easy: { title: 'Fácil', desc: '5 rutas (Aventura corta)' },
  medium: { title: 'Intermedia', desc: '10 rutas (Aventura estándar)' },
  hard: { title: 'Difícil', desc: '25 rutas (Desafío extremo)' }
}

const generations = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const generationRegions: Record<number, string> = {
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

const maxTeamSize = 6

// Catálogo base de la Tienda
const ALL_SHOP_ITEMS: Record<string, { price: number; desc: string }> = {
  'Potion': { price: 50, desc: 'Restaura 25 HP de un Pokémon.' },
  'Super Potion': { price: 100, desc: 'Restaura 50 HP de un Pokémon.' },
  'Hyper Potion': { price: 160, desc: 'Restaura 120 HP de un Pokémon.' },
  'Full Restore': { price: 300, desc: 'Restaura todo el HP del Pokémon activo.' },
  'Oran Berry': { price: 30, desc: 'Restaura 15 HP de un Pokémon.' },
  'Lum Berry': { price: 60, desc: 'Restaura 30 HP de un Pokémon.' },
  'X Attack': { price: 75, desc: 'Aumenta permanentemente en +5 el ataque.' },
  'X Defense': { price: 75, desc: 'Aumenta permanentemente en +5 la defensa.' },
  'X Speed': { price: 75, desc: 'Aumenta permanentemente en +5 la velocidad.' },
  'Full Heal': { price: 80, desc: 'Restaura 40 HP del Pokémon activo.' },
  'Revive': { price: 150, desc: 'Revive a un Pokémon debilitado con el 50% de su HP.' },
  'Max Revive': { price: 300, desc: 'Revive a un Pokémon debilitado con el HP completo.' }
}

const itemDescriptions: Record<string, string> = {
  Potion: 'Restaura 25 HP al Pokémon activo.',
  'Super Potion': 'Restaura 50 HP al Pokémon activo.',
  'Hyper Potion': 'Restaura 120 HP al Pokémon activo.',
  'Full Restore': 'Restaura todo el HP del Pokémon activo.',
  'X Attack': 'Aumenta permanentemente en +5 el ataque.',
  'X Defense': 'Aumenta permanentemente en +5 la defensa.',
  'X Speed': 'Aumenta permanentemente en +5 la velocidad.',
  'Oran Berry': 'Restaura 15 HP al Pokémon activo.',
  'Lum Berry': 'Restaura 30 HP al Pokémon activo.',
  'Full Heal': 'Restaura 40 HP al Pokémon activo.',
  'Revive': 'Revive a un Pokémon debilitado con 50% HP.',
  'Max Revive': 'Revive a un Pokémon debilitado con el HP completo.'
}

const ITEM_SPRITES: Record<string, string> = {
  'Potion': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png',
  'Super Potion': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/super-potion.png',
  'Hyper Potion': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hyper-potion.png',
  'Full Restore': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/full-restore.png',
  'Oran Berry': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/oran-berry.png',
  'Lum Berry': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lum-berry.png',
  'X Attack': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-attack.png',
  'X Defense': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-defense.png',
  'X Speed': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-speed.png',
  'Full Heal': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/full-heal.png',
  'Revive': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/revive.png',
  'Max Revive': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/max-revive.png',
}

// Entrenadores normales (clase + nombre)
const TRAINER_TYPES: Array<{ label: string; name: string; sprite: string }> = [
  { label: 'Youngster', name: 'Miguel',   sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/youngster.png' },
  { label: 'Youngster', name: 'Tommy',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/youngster.png' },
  { label: 'Lass',      name: 'Laura',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/lass.png' },
  { label: 'Lass',      name: 'Ana',      sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/lass.png' },
  { label: 'Hiker',     name: 'Jorge',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/hiker.png' },
  { label: 'Hiker',     name: 'Bruno',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/hiker.png' },
  { label: 'Fisherman', name: 'Carlos',   sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fisherman.png' },
  { label: 'Fisherman', name: 'Pedro',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fisherman.png' },
  { label: 'Camper',    name: 'Ricky',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/camper.png' },
  { label: 'Biker',     name: 'Gus',      sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/biker.png' },
  { label: 'Beauty',    name: 'Valeria',  sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/beauty.png' },
  { label: 'Gentleman', name: 'Arthur',   sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/gentleman.png' },
  { label: 'Sailor',    name: 'Ramiro',   sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/sailor.png' },
  { label: 'Bug Catcher', name: 'Diego',  sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/bug-catcher.png' },
  { label: 'Picnicker', name: 'Mia',      sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/picnicker.png' },
  { label: 'Ace Trainer', name: 'Sergio', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/ace-trainer-m.png' },
  { label: 'Ace Trainer', name: 'Elena',  sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/ace-trainer-f.png' },
  { label: 'Black Belt', name: 'Kenji',   sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/black-belt.png' },
  { label: 'Psychic',   name: 'Marco',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/psychic-m.png' },
  { label: 'Swimmer',   name: 'Max',      sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/swimmer-m.png' },
]

// Líderes de Gimnasio (solo aparecen en el Jefe Final)
const GYM_LEADERS: Array<{ name: string; badge: string; sprite: string }> = [
  { name: 'Brock',    badge: 'Médalla Roca',       sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/brock.png' },
  { name: 'Misty',    badge: 'Médalla Cascada',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/misty.png' },
  { name: 'Surge',    badge: 'Médalla Trueno',     sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/lt-surge.png' },
  { name: 'Erika',    badge: 'Médalla Arco Iris',  sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/erika.png' },
  { name: 'Sabrina',  badge: 'Médalla Pantano',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/sabrina.png' },
  { name: 'Blaine',   badge: 'Médalla Volcán',     sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/blaine.png' },
  { name: 'Giovanni', badge: 'Médalla Tierra',     sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/giovanni.png' },
  { name: 'Falkner',  badge: 'Médalla Ala',        sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/falkner.png' },
  { name: 'Bugsy',    badge: 'Médalla Colmíllo',   sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/bugsy.png' },
  { name: 'Whitney',  badge: 'Médalla Lisa',       sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/whitney.png' },
  { name: 'Morty',    badge: 'Médalla Niebla',     sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/morty.png' },
  { name: 'Chuck',    badge: 'Médalla Tormenta',   sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/chuck.png' },
  { name: 'Jasmine',  badge: 'Médalla Mineral',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/jasmine.png' },
  { name: 'Pryce',    badge: 'Médalla Glaciar',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/pryce.png' },
  { name: 'Clair',    badge: 'Médalla Ascenso',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/clair.png' },
  { name: 'Roxanne',  badge: 'Médalla Roca',       sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/roxanne.png' },
  { name: 'Brawly',   badge: 'Médalla Puño',      sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/brawly.png' },
  { name: 'Wattson',  badge: 'Médalla Dinámo',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/wattson.png' },
  { name: 'Flannery', badge: 'Médalla Calor',      sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/flannery.png' },
  { name: 'Norman',   badge: 'Médalla Balance',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/norman.png' },
  { name: 'Winona',   badge: 'Médalla Pluma',      sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/winona.png' },
  { name: 'Tate',     badge: 'Médalla Mente',      sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/tate.png' },
  { name: 'Juan',     badge: 'Médalla Lluvia',     sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/juan.png' },
  { name: 'Roark',    badge: 'Médalla Carbona',    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/roark.png' },
  { name: 'Gardenia', badge: 'Médalla Bosque',     sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/gardenia.png' },
  { name: 'Maylene',  badge: 'Médalla Cobra',      sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/maylene.png' },
  { name: 'Fantina',  badge: 'Médalla Relevo',     sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fantina.png' },
  { name: 'Byron',    badge: 'Médalla Mina',       sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/byron.png' },
  { name: 'Candice',  badge: 'Médalla Escarcha',   sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/candice.png' },
  { name: 'Volkner',  badge: 'Médalla Faro',       sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/volkner.png' },
]

interface PokedexEntry {
  id: number
  name: string
  sprite: string
  types: string[]
}

function nodeTypeLabel(node: RouteNode): string {
  switch (node.type) {
    case 'battle':
      return 'Combate'
    case 'rest':
      return 'Descanso'
    case 'shop':
      return 'Tienda'
    case 'boss':
      return 'Jefe'
    default:
      return node.type
  }
}

function moveTooltip(move: Move): string {
  const accuracy = move.accuracy === null ? 'Always hits' : `${move.accuracy}% accuracy`
  return `${move.name}\nPower: ${move.power}\n${accuracy}\n${move.description}`
}

function groupInventory(items: string[]): Array<{ name: string; count: number; description: string }> {
  const counts = new Map<string, number>()
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1)
  }

  return [...counts.entries()].map(([name, count]) => ({
    name,
    count,
    description: itemDescriptions[name] ?? 'No effect description available.'
  }))
}

interface ProgressionData {
  completedMedium: number[]
  completedAny: number[]
}

interface VictoryUnlocks {
  genName: string
  nextGenNumber: number | null
  nextGenName: string | null
  unlockedHard: boolean
}

function getFirstHealthyIndex(team: Pokemon[], currentIndex: number): number {
  return team.findIndex((pokemon, index) => index !== currentIndex && pokemon.hp > 0)
}

function MainApp() {
  const [screen, setScreen] = useState<Screen>('setup')
  const [generation, setGeneration] = useState<number>(1)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [currentRunGen, setCurrentRunGen] = useState<number>(1)
  const [victoryUnlocks, setVictoryUnlocks] = useState<VictoryUnlocks | null>(null)

  const [progression, setProgression] = useState<ProgressionData>(() => {
    try {
      const saved = localStorage.getItem('pokerand_progression')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          completedMedium: Array.isArray(parsed.completedMedium) ? parsed.completedMedium : [],
          completedAny: Array.isArray(parsed.completedAny) ? parsed.completedAny : []
        }
      }
    } catch {
      // fallback
    }
    return { completedMedium: [], completedAny: [] }
  })

  const [team, setTeam] = useState<Pokemon[]>([])
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [enemy, setEnemy] = useState<Pokemon | null>(null)
  const [route, setRoute] = useState<RouteNode[]>([])
  const [routeIndex, setRouteIndex] = useState<number>(0)

  // Combate de entrenador
  const [isTrainerBattle, setIsTrainerBattle] = useState<boolean>(false)
  const [trainerTeam, setTrainerTeam] = useState<Pokemon[]>([])
  const [trainerPokemonIndex, setTrainerPokemonIndex] = useState<number>(0)
  const [trainerName, setTrainerName] = useState<string>('')
  const [trainerSprite, setTrainerSprite] = useState<string>('')
  const [trainerBadge, setTrainerBadge] = useState<string>('')

  // Economía y Tienda
  const [money, setMoney] = useState<number>(200)
  const [shopStock, setShopStock] = useState<string[]>([])

  const [inventory, setInventory] = useState<string[]>([])
  const [modifier, setModifier] = useState<RunModifier | null>(null)
  const [battleLog, setBattleLog] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [apiError, setApiError] = useState<string>('')
  const [restEncounter, setRestEncounter] = useState<Pokemon | null>(null)
  const [restRewardItem, setRestRewardItem] = useState<string>('')

  // Resumen de derrota
  const [defeatSummary, setDefeatSummary] = useState<DefeatSummary | null>(null)

  // Modal de selección de objetivo para Revive
  const [reviveModal, setReviveModal] = useState<{ itemName: string; itemIndex: number } | null>(null)

  // Pokédex
  const [showPokedex, setShowPokedex] = useState<boolean>(false)
  const [pokedexSearch, setPokedexSearch] = useState<string>('')
  const [selectedPokemonDetail, setSelectedPokemonDetail] = useState<PokemonDetails | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false)

  const [pokedex, setPokedex] = useState<Record<number, PokedexEntry>>(() => {
    try {
      const saved = localStorage.getItem('pokerand_pokedex')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const [record, setRecord] = useState(() => {
    const wins = Number(localStorage.getItem('pokerand_wins') ?? '0')
    const losses = Number(localStorage.getItem('pokerand_losses') ?? '0')
    return { wins, losses }
  })

  const currentNode = useMemo(() => route[routeIndex] ?? null, [route, routeIndex])
  const activePokemon = useMemo(() => team[activeIndex] ?? null, [team, activeIndex])
  const inventoryEntries = useMemo(() => groupInventory(inventory), [inventory])

  function isGenUnlocked(gen: number): boolean {
    if (gen === 1) return true
    if (gen === 0) {
      return generations.every((g) => g === 1 || progression.completedMedium.includes(g - 1))
    }
    return progression.completedMedium.includes(gen - 1)
  }

  function isHardUnlocked(gen: number): boolean {
    if (gen === 0) {
      return isGenUnlocked(0) && progression.completedAny.length > 0
    }
    return progression.completedAny.includes(gen)
  }

  function handleSelectGeneration(gen: number) {
    if (!isGenUnlocked(gen)) return
    setGeneration(gen)
    if (difficulty === 'hard' && !isHardUnlocked(gen)) {
      setDifficulty('medium')
    }
  }

  function handleSelectDifficulty(diff: Difficulty) {
    if (diff === 'hard' && !isHardUnlocked(generation)) return
    setDifficulty(diff)
  }

  function getEffectiveGen(): number {
    if (generation === 0) {
      const unlockedGens = generations.filter((g) => isGenUnlocked(g))
      if (unlockedGens.length === 0) return 1
      return unlockedGens[Math.floor(Math.random() * unlockedGens.length)]
    }
    return generation
  }

  async function handleSelectPokedexPokemon(id: number) {
    setIsLoadingDetail(true)
    try {
      const details = await fetchPokemonDetails(id)
      setSelectedPokemonDetail(details)
    } catch {
      setApiError('No se pudieron obtener los detalles del Pokémon.')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  function registerInPokedex(pokemon: Pokemon): void {
    setPokedex((prev) => {
      let pokemonId = Number(pokemon.id)

      if (isNaN(pokemonId) && pokemon.sprite) {
        const match = pokemon.sprite.match(/\/(\d+)\.png/)
        if (match) {
          pokemonId = parseInt(match[1], 10)
        }
      }

      if (isNaN(pokemonId) || !pokemonId) return prev
      if (prev[pokemonId]) return prev

      const updated: Record<number, PokedexEntry> = {
        ...prev,
        [pokemonId]: {
          id: pokemonId,
          name: pokemon.name,
          sprite: pokemon.sprite,
          types: (pokemon as any).types ?? []
        }
      }
      localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
      return updated
    })
  }

  function persistRecord(nextWins: number, nextLosses: number): void {
    localStorage.setItem('pokerand_wins', String(nextWins))
    localStorage.setItem('pokerand_losses', String(nextLosses))
    setRecord({ wins: nextWins, losses: nextLosses })
  }

  async function startNewRun(): Promise<void> {
    if (!isGenUnlocked(generation)) {
      setApiError('Esta generación aún está bloqueada.')
      return
    }
    if (difficulty === 'hard' && !isHardUnlocked(generation)) {
      setApiError('El modo difícil para esta generación aún está bloqueado.')
      return
    }

    setIsLoading(true)
    setApiError('')

    try {
      const targetGen = getEffectiveGen()
      setCurrentRunGen(targetGen)

      const starter = await getRandomStarterByGeneration(targetGen)
      const config: RunConfig = { generation: targetGen }
      const run = startRun(config)

      registerInPokedex(starter)

      const totalNodes = difficultyNodeCounts[difficulty]
      let customRoute: RouteNode[] = []

      for (let i = 1; i < totalNodes; i++) {
        let type: RouteNode['type'] = 'battle'

        if (i > 0) {
          const rand = Math.random()
          if (rand < 0.15) {
            type = 'shop'
          } else if (rand < 0.40) {
            type = 'rest'
          }
        }

        customRoute.push({
          id: i,
          type,
          label: `Ruta ${i}`,
          done: false
        })
      }

      customRoute.push({
        id: totalNodes,
        type: 'boss',
        label: `Combate Final (#${totalNodes})`,
        done: false
      })

      setTeam([starter])
      setActiveIndex(0)
      setMoney(200)
      setInventory([run.item])
      setModifier(run.modifier)
      setRoute(customRoute)
      setRouteIndex(0)
      setEnemy(null)
      setIsTrainerBattle(false)
      setTrainerTeam([])
      setTrainerPokemonIndex(0)
      setTrainerName('')
      setTrainerSprite('')
      setTrainerBadge('')
      setRestEncounter(null)
      setRestRewardItem('')
      setDefeatSummary(null)
      setVictoryUnlocks(null)
      setBattleLog([
        `Tu inicial es ${starter.name}.`,
        `Modo: ${generation === 0 ? 'Random All-Stars' : `Gen ${generation}`}.`,
        `Dificultad: ${difficultyLabels[difficulty].title} (${totalNodes} rutas).`,
        `Recibes $200 de inicio e item: ${run.item}.`
      ])
      setScreen('route')
    } catch {
      setApiError('No se pudo cargar PokeAPI. Reintenta en unos segundos.')
    } finally {
      setIsLoading(false)
    }
  }

  function completeCurrentNode(): void {
    setRestEncounter(null)
    setRestRewardItem('')
    setRoute((previous) =>
      previous.map((node, index) => (index === routeIndex ? { ...node, done: true } : node))
    )

    if (routeIndex >= route.length - 1) {
      const wins = record.wins + 1
      persistRecord(wins, record.losses)

      // Actualizar progresión de desbloqueos
      const genPlayed = currentRunGen
      const isMediumOrHard = difficulty === 'medium' || difficulty === 'hard'

      const newlyUnlockedHard = !progression.completedAny.includes(genPlayed)
      const newlyUnlockedNextGen = isMediumOrHard && genPlayed < 9 && !progression.completedMedium.includes(genPlayed)

      const nextCompletedAny = Array.from(new Set([...progression.completedAny, genPlayed]))
      const nextCompletedMedium = isMediumOrHard
        ? Array.from(new Set([...progression.completedMedium, genPlayed]))
        : progression.completedMedium

      const updatedProgression: ProgressionData = {
        completedAny: nextCompletedAny,
        completedMedium: nextCompletedMedium
      }

      localStorage.setItem('pokerand_progression', JSON.stringify(updatedProgression))
      setProgression(updatedProgression)

      setVictoryUnlocks({
        genName: generationRegions[genPlayed],
        nextGenNumber: newlyUnlockedNextGen ? genPlayed + 1 : null,
        nextGenName: newlyUnlockedNextGen ? generationRegions[genPlayed + 1] : null,
        unlockedHard: newlyUnlockedHard
      })

      setScreen('victory')
      return
    }

    setRouteIndex((previous) => previous + 1)
    setScreen('route')
  }

  function removeFaintedPokemon(indexToRemove: number): void {
    const target = team[indexToRemove]
    if (!target || target.hp > 0) return

    const newTeam = team.filter((_, idx) => idx !== indexToRemove)
    setTeam(newTeam)

    if (activeIndex >= newTeam.length) {
      const healthyIdx = newTeam.findIndex((p) => p.hp > 0)
      setActiveIndex(healthyIdx !== -1 ? healthyIdx : 0)
    } else if (indexToRemove < activeIndex) {
      setActiveIndex((prev) => Math.max(0, prev - 1))
    }

    setBattleLog((prev) => [`Liberaste a ${target.name} del equipo.`, ...prev].slice(0, 15))
  }

  async function handleEvolveTarget(index: number): Promise<void> {
    const targetPokemon = team[index]
    if (!targetPokemon) return

    setIsLoading(true)
    setApiError('')

    try {
      const evolved = await evolvePokemon(targetPokemon)

      if (!evolved) {
        setApiError(`${targetPokemon.name} no puede evolucionar más.`)
        return
      }

      registerInPokedex(evolved)

      setTeam((prevTeam) =>
        prevTeam.map((p, i) => (i === index ? evolved : p))
      )

      setBattleLog((prev) => [
        `¡${targetPokemon.name} evolucionó en ${evolved.name}!`,
        ...prev
      ].slice(0, 15))

      completeCurrentNode()
    } catch {
      setApiError('No se pudo procesar la evolución. Reintenta.')
    } finally {
      setIsLoading(false)
    }
  }

  async function enterNode(): Promise<void> {
    if (!activePokemon || !currentNode) return

    if (currentNode.type === 'shop') {
      const allItemKeys = Object.keys(ALL_SHOP_ITEMS)
      const shuffled = [...allItemKeys].sort(() => 0.5 - Math.random())
      setShopStock(shuffled.slice(0, 3))
      setScreen('shop')
      return
    }

    if (currentNode.type === 'rest') {
      setIsLoading(true)
      setApiError('')

      try {
        const targetGen = getEffectiveGen()
        const restPokemonBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false)
        const generatedEncounter = scalePokemonForNode(restPokemonBase, currentNode, routeIndex)
        const rewardItem = randomFrom(['Potion', 'Super Potion', 'X Attack', 'Oran Berry'])

        setRestEncounter(generatedEncounter)
        setRestRewardItem(rewardItem)
        setInventory((previous) => [...previous, rewardItem])
        setBattleLog((prev) => [
          `${currentNode.label}: encuentras a ${generatedEncounter.name} y obtienes ${rewardItem}.`,
          ...prev
        ])
      } catch {
        setApiError('No se pudo generar el encuentro de descanso. Reintenta.')
      } finally {
        setIsLoading(false)
      }
      return
    }

    setIsLoading(true)
    setApiError('')

    try {
      const targetGen = getEffectiveGen()
      const isBoss = currentNode.type === 'boss'

      // El jefe siempre es entrenador; el resto se decide aleatoriamente (50/50)
      const willBeTrainer = isBoss || Math.random() < 0.5

      if (willBeTrainer) {
        // Calcular tamaño del equipo entrenador según progreso (1–6)
        const progress = routeIndex / Math.max(1, route.length - 1) // 0..1
        const maxSize = isBoss ? 6 : Math.max(1, Math.min(6, Math.floor(progress * 6) + 1))
        const teamSize = isBoss ? maxSize : Math.max(1, Math.min(maxSize, 1 + Math.floor(Math.random() * maxSize)))

        // Cargar todos los Pokémon del entrenador en paralelo
        const fetches = Array.from({ length: teamSize }, () =>
          getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, isBoss)
            .then((base) => scalePokemonForNode(base, currentNode, routeIndex))
        )
        const newTrainerTeam = await Promise.all(fetches)

        // Elegir entrenador según tipo de nodo
        let chosenName = ''
        let chosenSprite = ''
        let chosenBadge = ''
        if (isBoss) {
          const leader = randomFrom(GYM_LEADERS)
          chosenName = leader.name
          chosenSprite = leader.sprite
          chosenBadge = leader.badge
        } else {
          const trainer = randomFrom(TRAINER_TYPES)
          chosenName = `${trainer.label} ${trainer.name}`
          chosenSprite = trainer.sprite
          chosenBadge = ''
        }

        setIsTrainerBattle(true)
        setTrainerTeam(newTrainerTeam)
        setTrainerPokemonIndex(0)
        setTrainerName(chosenName)
        setTrainerSprite(chosenSprite)
        setTrainerBadge(chosenBadge)
        setEnemy(newTrainerTeam[0])
        setBattleLog((prev) => [
          isBoss
            ? `🏆 ¡El Líder ${chosenName} quiere combatir! (${chosenBadge})`
            : `⚔️ ¡${chosenName} quiere combatir! Tiene ${teamSize} Pokémon.`,
          `Envía a ${newTrainerTeam[0].name} Nv.${newTrainerTeam[0].level}.`,
          ...prev
        ])
      } else {
        // Combate salvaje (un solo Pokémon)
        const enemyBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false)
        const generatedEnemy = scalePokemonForNode(enemyBase, currentNode, routeIndex)
        setIsTrainerBattle(false)
        setTrainerTeam([])
        setTrainerPokemonIndex(0)
        setTrainerName('')
        setTrainerSprite('')
        setTrainerBadge('')
        setEnemy(generatedEnemy)
        setBattleLog((prev) => [
          `🌿 ¡Un ${generatedEnemy.name} salvaje (Nv.${generatedEnemy.level}) apareció!`,
          ...prev
        ])
      }

      setScreen('battle')
    } catch {
      setApiError('No se pudo generar rival desde PokeAPI. Reintenta.')
    } finally {
      setIsLoading(false)
    }
  }

  function buyShopItem(itemName: string) {
    const item = ALL_SHOP_ITEMS[itemName]
    if (!item || money < item.price) return

    setMoney((prev) => prev - item.price)
    setInventory((prev) => [...prev, itemName])
    setBattleLog((prev) => [`Compraste ${itemName} por $${item.price}.`, ...prev].slice(0, 15))
  }

  function healTeamAtShop() {
    const healCost = 100
    const needsHealing = team.some((pkmn) => pkmn.hp > 0 && pkmn.hp < pkmn.maxHp)

    if (!needsHealing || money < healCost) return

    setMoney((prev) => prev - healCost)
    setTeam((prevTeam) =>
      prevTeam.map((pkmn) => (pkmn.hp > 0 ? { ...pkmn, hp: pkmn.maxHp } : pkmn))
    )
    setBattleLog((prev) => [`Restauraste la salud de tu equipo activo por $${healCost}.`, ...prev].slice(0, 15))
  }

  function performHit(
    attacker: Pokemon,
    defender: Pokemon,
    move: Move,
    isEnemyHit: boolean
  ): { updatedDefender: Pokemon; line: string } {
    const enemyBoost = isEnemyHit ? modifier?.enemyAttackDelta ?? 0 : 0

    const defTypes = (defender as any).types ?? []
    const primaryType = defTypes[0] || 'normal'
    const secondaryType = defTypes[1] || undefined

    const { effectiveness, message } = getTypeEffectiveness(move.type, primaryType, secondaryType)
    const result = applyDamage(attacker, defender, move, enemyBoost)

    const finalDamage = Math.floor(result.damage * effectiveness)
    const newHp = Math.max(0, defender.hp - finalDamage)

    const updatedDefender: Pokemon = {
      ...defender,
      hp: newHp
    }

    let line = `${attacker.name} usa ${move.name}: ${finalDamage} de daño.`
    if (message) {
      line += ` (${message})`
    }

    return {
      updatedDefender,
      line
    }
  }

  async function onPlayerMove(move: Move): Promise<void> {
    if (!activePokemon || !enemy) return

    const nextTeam = team.map((pokemon, index) => (index === activeIndex ? { ...pokemon } : pokemon))
    let nextPlayer = { ...nextTeam[activeIndex] }
    let nextEnemy = { ...enemy }
    const logs: string[] = []

    const playerStarts = nextPlayer.speed >= nextEnemy.speed

    if (playerStarts) {
      const playerHit = performHit(nextPlayer, nextEnemy, move, false)
      nextEnemy = playerHit.updatedDefender
      logs.push(playerHit.line)

      if (nextEnemy.hp > 0) {
        const enemyMove = nextEnemy.moves[Math.floor(Math.random() * nextEnemy.moves.length)]
        const enemyHit = performHit(nextEnemy, nextPlayer, enemyMove, true)
        nextPlayer = enemyHit.updatedDefender
        logs.push(enemyHit.line)
      }
    } else {
      const enemyMove = nextEnemy.moves[Math.floor(Math.random() * nextEnemy.moves.length)]
      const enemyHit = performHit(nextEnemy, nextPlayer, enemyMove, true)
      nextPlayer = enemyHit.updatedDefender
      logs.push(enemyHit.line)

      if (nextPlayer.hp > 0) {
        const playerHit = performHit(nextPlayer, nextEnemy, move, false)
        nextEnemy = playerHit.updatedDefender
        logs.push(playerHit.line)
      }
    }

    // --- Jugador debilitado ---
    if (nextPlayer.hp <= 0) {
      nextTeam[activeIndex] = nextPlayer
      const nextAliveIndex = getFirstHealthyIndex(nextTeam, activeIndex)

      if (nextAliveIndex === -1) {
        const fullLogs = ['¡Todo tu equipo ha sido debilitado!', ...logs, ...battleLog]
        setTeam(nextTeam)
        setBattleLog(fullLogs)
        setDefeatSummary({
          finalTeam: nextTeam,
          battleLog: fullLogs,
          enemy: nextEnemy,
          lastNodeLabel: currentNode?.label
        })
        const losses = record.losses + 1
        persistRecord(record.wins, losses)
        setScreen('defeat')
        return
      }

      setTeam(nextTeam)
      setActiveIndex(nextAliveIndex)
      setBattleLog((prev) => [`${nextPlayer.name} cayó debilitado.`, ...logs, ...prev].slice(0, 15))
      setEnemy(nextEnemy)
      return
    }

    // --- Enemigo derrotado ---
    if (nextEnemy.hp <= 0) {
      // Calcular exp por este Pokémon
      const levelDiff = nextEnemy.level - nextPlayer.level
      let levelsGained = 1
      if (levelDiff > 0) levelsGained = 1 + levelDiff
      else if (levelDiff < -2) levelsGained = 0

      const hpGain = levelsGained * 4
      const statBoost = (stat: number) => Math.max(1, Math.round((stat * 0.04) * levelsGained))
      const oldLevel = nextPlayer.level
      const newLevel = oldLevel + levelsGained
      const newMaxHp = nextPlayer.maxHp + hpGain

      let leveledPlayer: Pokemon = {
        ...nextPlayer,
        level: newLevel,
        maxHp: newMaxHp,
        hp: Math.min(newMaxHp, nextPlayer.hp + Math.round(newMaxHp * 0.20) + hpGain),
        attack: nextPlayer.attack + statBoost(nextPlayer.attack),
        defense: nextPlayer.defense + statBoost(nextPlayer.defense),
        speed: nextPlayer.speed + statBoost(nextPlayer.speed)
      }

      let moveLearnedMsg = ''
      if (levelsGained > 0) {
        const { updatedPokemon, learnedMoveName } = await checkAndLearnNewMove(leveledPlayer, oldLevel, newLevel)
        leveledPlayer = updatedPokemon
        if (learnedMoveName) moveLearnedMsg = ` ¡Aprendió ${learnedMoveName}! ✨`
      }

      const moneyReward = Math.floor((80 + nextEnemy.level * 10) / (isTrainerBattle ? trainerTeam.length : 1))
      setMoney((prev) => prev + moneyReward)
      nextTeam[activeIndex] = leveledPlayer

      let logMsg = `Derrotaste a ${nextEnemy.name}.`
      if (levelsGained > 1) logMsg += ` Subió +${levelsGained} niveles (Nv. ${newLevel}).${moveLearnedMsg}`
      else if (levelsGained === 1) logMsg += ` Subió al Nv. ${newLevel}.${moveLearnedMsg}`

      // --- Batalla de entrenador: enviar siguiente Pokémon ---
      if (isTrainerBattle) {
        const updatedTrainerTeam = trainerTeam.map((p, idx) => idx === trainerPokemonIndex ? nextEnemy : p)
        const nextTrainerIndex = updatedTrainerTeam.findIndex((p, idx) => idx > trainerPokemonIndex && p.hp > 0)

        if (nextTrainerIndex === -1) {
          // Entrenador sin Pokémon → victoria
          const totalReward = 80 + nextEnemy.level * 10 * trainerTeam.length
          setMoney((prev) => prev + totalReward)
          setTeam(nextTeam)
          setTrainerTeam(updatedTrainerTeam)
          setEnemy(nextEnemy)
          setBattleLog((prev) => [
            `🏆 ¡Derrotaste al entrenador ${trainerName}! +$${totalReward + moneyReward}`,
            logMsg,
            ...logs,
            ...prev
          ].slice(0, 15))
          completeCurrentNode()
          return
        }

        // Siguiente Pokémon del entrenador
        const nextPkmn = updatedTrainerTeam[nextTrainerIndex]
        setTrainerTeam(updatedTrainerTeam)
        setTrainerPokemonIndex(nextTrainerIndex)
        setEnemy(nextPkmn)
        setTeam(nextTeam)
        setBattleLog((prev) => [
          `${trainerName} envía a ${nextPkmn.name} Nv.${nextPkmn.level}!`,
          logMsg,
          ...logs,
          ...prev
        ].slice(0, 15))
        return
      }

      // --- Batalla salvaje → victoria directa ---
      logMsg = `🌿 Derrotaste al ${nextEnemy.name} salvaje y ganaste $${moneyReward}.` + logMsg.replace(`Derrotaste a ${nextEnemy.name}.`, '')
      setTeam(nextTeam)
      setEnemy(nextEnemy)
      setBattleLog((prev) => [logMsg, ...logs, ...prev].slice(0, 15))
      completeCurrentNode()
      return
    }

    nextTeam[activeIndex] = nextPlayer
    setTeam(nextTeam)
    setEnemy(nextEnemy)
    setBattleLog((prev) => [...logs, ...prev].slice(0, 15))
  }

  function switchActive(index: number): void {
    const target = team[index]
    if (!target || target.hp <= 0 || index === activeIndex) return
    setActiveIndex(index)
  }

  function useInventoryItem(itemName: string): void {
    const itemIndex = inventory.indexOf(itemName)
    if (itemIndex === -1) return

    // Revive y Max Revive: abrir modal de selección
    if (itemName === 'Revive' || itemName === 'Max Revive') {
      const hasFainted = team.some((p) => p.hp <= 0)
      if (!hasFainted) {
        setBattleLog((prev) => ['No tienes ningún Pokémon debilitado para revivir.', ...prev].slice(0, 15))
        return
      }
      setReviveModal({ itemName, itemIndex })
      return
    }

    if (!activePokemon) return

    let updatedPokemon: Pokemon | null = null

    if (itemName === 'Potion' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 25)
    } else if (itemName === 'Super Potion' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 50)
    } else if (itemName === 'Hyper Potion' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 120)
    } else if (itemName === 'Full Restore' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = { ...activePokemon, hp: activePokemon.maxHp }
    } else if (itemName === 'Oran Berry' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 15)
    } else if (itemName === 'Lum Berry' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 30)
    } else if (itemName === 'Full Heal' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 40)
    } else if (itemName === 'X Attack') {
      updatedPokemon = { ...activePokemon, attack: activePokemon.attack + 5 }
    } else if (itemName === 'X Defense') {
      updatedPokemon = { ...activePokemon, defense: activePokemon.defense + 5 }
    } else if (itemName === 'X Speed') {
      updatedPokemon = { ...activePokemon, speed: activePokemon.speed + 5 }
    }

    if (!updatedPokemon) return

    setTeam((previous) =>
      previous.map((pokemon, index) => (index === activeIndex ? updatedPokemon : pokemon))
    )
    setInventory((previous) => previous.filter((_, index) => index !== itemIndex))
    setBattleLog((prev) => [`Usaste ${itemName} en ${activePokemon.name}.`, ...prev].slice(0, 15))
  }

  function applyRevive(targetIndex: number): void {
    if (!reviveModal) return
    const { itemName, itemIndex } = reviveModal
    const target = team[targetIndex]
    if (!target || target.hp > 0) return

    const restoredHp = itemName === 'Max Revive' ? target.maxHp : Math.floor(target.maxHp * 0.5)
    const revivedPkmn: Pokemon = { ...target, hp: restoredHp }

    setTeam((prev) => prev.map((p, idx) => (idx === targetIndex ? revivedPkmn : p)))
    setInventory((prev) => prev.filter((_, idx) => idx !== itemIndex))
    setBattleLog((prev) => [`¡${revivedPkmn.name} ha sido revivido con ${revivedPkmn.hp} HP!`, ...prev].slice(0, 15))
    setReviveModal(null)
  }

  function captureRestPokemon(): void {
    if (!restEncounter) return

    if (team.length >= maxTeamSize) {
      setBattleLog((prev) => ['Tu equipo ya esta completo.', ...prev].slice(0, 15))
      return
    }

    registerInPokedex(restEncounter)
    setTeam((previous) => [...previous, restEncounter])
    setBattleLog((prev) => [`Capturaste a ${restEncounter.name}.`, ...prev].slice(0, 15))
    completeCurrentNode()
  }

  function skipRestCapture(): void {
    if (!restEncounter) return

    setBattleLog((prev) => [`Dejaste ir a ${restEncounter.name}.`, ...prev].slice(0, 15))
    completeCurrentNode()
  }

  function resetToSetup(): void {
    setScreen('setup')
    setTeam([])
    setActiveIndex(0)
    setEnemy(null)
    setRoute([])
    setRouteIndex(0)
    setInventory([])
    setMoney(200)
    setShopStock([])
    setModifier(null)
    setBattleLog([])
    setApiError('')
    setRestEncounter(null)
    setRestRewardItem('')
    setDefeatSummary(null)
    setVictoryUnlocks(null)
    setIsTrainerBattle(false)
    setTrainerTeam([])
    setTrainerPokemonIndex(0)
    setTrainerName('')
    setTrainerSprite('')
    setTrainerBadge('')
  }

  function onRestartRun(): void {
    if (screen === 'route' || screen === 'battle' || screen === 'shop') {
      resetToSetup()
    }
  }

  const pokedexList = Object.values(pokedex)
  const filteredPokedex = pokedexList.filter((pkmn) => {
    const term = pokedexSearch.toLowerCase().trim()
    if (!term) return true
    const formattedId = `#${String(pkmn.id).padStart(3, '0')}`
    return pkmn.name.toLowerCase().includes(term) || String(pkmn.id).includes(term) || formattedId.includes(term)
  })

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="left-toolbar">
          <button className="tiny-btn" type="button" onClick={() => setShowPokedex(true)}>
            📖 Pokédex ({pokedexList.length})
          </button>
          <button className="tiny-btn" type="button" onClick={onRestartRun}>
            Restart
          </button>
        </div>
        <h1>PokeRand</h1>
        <div className="record-box">
          <span style={{ color: '#facc15', fontWeight: 'bold' }}>💵 ${money}</span>
          <span style={{ color: '#10b981', fontWeight: 'bold' }}>W {record.wins}</span>
          <span style={{ color: '#ef4444', fontWeight: 'bold' }}>L {record.losses}</span>
        </div>
      </header>

      {/* Modal Revive: selección de objetivo */}
      {reviveModal && (
        <div className="modal-backdrop" onClick={() => setReviveModal(null)}>
          <div
            className="revive-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              border: '1px solid rgba(250, 204, 21, 0.4)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '380px',
              width: '90%',
              margin: 'auto',
              boxShadow: '0 25px 50px rgba(0,0,0,0.6)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              {ITEM_SPRITES[reviveModal.itemName] && (
                <img
                  src={ITEM_SPRITES[reviveModal.itemName]}
                  alt={reviveModal.itemName}
                  style={{ width: '36px', height: '36px', imageRendering: 'pixelated' }}
                />
              )}
              <div>
                <h3 style={{ margin: 0, color: '#facc15', fontSize: '1.1rem' }}>{reviveModal.itemName}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                  {reviveModal.itemName === 'Max Revive' ? 'Revive con HP completo' : 'Revive con 50% HP'}
                </p>
              </div>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '1rem' }}>Elige a qué Pokémon debilitado dárselo:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {team.map((pkmn, idx) => {
                const isFainted = pkmn.hp <= 0
                const restoredHp = reviveModal.itemName === 'Max Revive' ? pkmn.maxHp : Math.floor(pkmn.maxHp * 0.5)
                return (
                  <button
                    key={`revive-target-${idx}`}
                    type="button"
                    onClick={() => applyRevive(idx)}
                    disabled={!isFainted}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: isFainted ? '1px solid rgba(250, 204, 21, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                      background: isFainted ? 'rgba(250, 204, 21, 0.08)' : 'rgba(255,255,255,0.03)',
                      cursor: isFainted ? 'pointer' : 'not-allowed',
                      opacity: isFainted ? 1 : 0.45,
                      transition: 'all 0.2s'
                    }}
                  >
                    <img
                      src={pkmn.sprite}
                      alt={pkmn.name}
                      style={{
                        width: '44px',
                        height: '44px',
                        filter: isFainted ? 'none' : 'grayscale(100%)',
                        opacity: isFainted ? 1 : 0.5
                      }}
                    />
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '0.95rem', textTransform: 'capitalize', color: isFainted ? '#f8fafc' : '#64748b' }}>
                        {pkmn.name}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: isFainted ? '#94a3b8' : '#475569' }}>
                        Nv. {pkmn.level} · HP: {pkmn.hp}/{pkmn.maxHp}
                      </span>
                    </div>
                    {isFainted && (
                      <span style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        → {restoredHp} HP
                      </span>
                    )}
                    {!isFainted && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>No debilitado</span>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => setReviveModal(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal Pokédex */}
      {showPokedex && (
        <div className="modal-backdrop" onClick={() => { setShowPokedex(false); setSelectedPokemonDetail(null); setPokedexSearch(''); }}>
          <div className="pokedex-frame" onClick={(e) => e.stopPropagation()}>
            <div className="pokedex-top-bar">
              <div className="big-blue-sensor"></div>
              <div className="mini-leds">
                <div className="led red"></div>
                <div className="led yellow"></div>
                <div className="led green"></div>
              </div>
            </div>

            <div className="pokedex-screen">
              {selectedPokemonDetail ? (
                <div className="pokedex-detail-view">
                  <button className="tiny-btn back-btn" onClick={() => setSelectedPokemonDetail(null)}>
                    ← Volver a la lista
                  </button>

                  <div className="detail-header" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <img
                      className="high-res-img"
                      src={selectedPokemonDetail.highResImage}
                      alt={selectedPokemonDetail.name}
                    />
                    <div className="detail-title">
                      <span className="pokedex-id">#{String(selectedPokemonDetail.id).padStart(3, '0')}</span>
                      <h2 style={{ textTransform: 'capitalize', margin: '4px 0 8px 0', color: '#38bdf8' }}>
                        {selectedPokemonDetail.name}
                      </h2>
                      <div className="types-list" style={{ display: 'flex', gap: '4px' }}>
                        {selectedPokemonDetail.types.map((t) => (
                          <span key={t} className="type-badge">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="description-box">{selectedPokemonDetail.description}</p>

                  <div className="physical-stats">
                    <div>
                      <span>Altura</span>
                      <strong>{selectedPokemonDetail.height} m</strong>
                    </div>
                    <div>
                      <span>Peso</span>
                      <strong>{selectedPokemonDetail.weight} kg</strong>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '8px' }}>Estadísticas Base</h3>
                  <div className="stats-grid">
                    {selectedPokemonDetail.stats.map((st) => (
                      <div key={st.name} className="stat-row">
                        <span className="stat-name">{st.name}</span>
                        <span> </span>
                        <strong>{st.value}</strong>
                        <div className="meter">
                          <div style={{ width: `${Math.min(100, (st.value / 150) * 100)}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="modal-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ fontSize: '1.2rem', color: '#38bdf8', margin: 0 }}>
                        Pokédex ({pokedexList.length})
                      </h2>
                    </div>

                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type="text"
                        placeholder="🔍 Buscar por nombre o ID..."
                        value={pokedexSearch}
                        onChange={(e) => setPokedexSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          background: 'rgba(15, 23, 42, 0.8)',
                          color: '#fff',
                          fontSize: '0.85rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      {pokedexSearch && (
                        <button
                          type="button"
                          onClick={() => setPokedexSearch('')}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          ✖
                        </button>
                      )}
                    </div>
                  </div>

                  {isLoadingDetail ? (
                    <p className="muted" style={{ textAlign: 'center', padding: '2rem 0' }}>Cargando datos oficiales...</p>
                  ) : pokedexList.length === 0 ? (
                    <p className="muted" style={{ padding: '1rem 0', textAlign: 'center' }}>
                      Aún no has registrado ningún Pokémon. ¡Inicia una partida!
                    </p>
                  ) : filteredPokedex.length === 0 ? (
                    <p className="muted" style={{ padding: '2rem 0', textAlign: 'center' }}>
                      No se encontraron Pokémon que coincidan con "{pokedexSearch}".
                    </p>
                  ) : (
                    <div className="pokedex-grid">
                      {filteredPokedex.sort((a, b) => a.id - b.id).map((pkmn) => (
                        <div
                          key={pkmn.id}
                          className="pokedex-card clickable"
                          onClick={() => handleSelectPokedexPokemon(pkmn.id)}
                        >
                          <span className="pokedex-id">#{String(pkmn.id).padStart(3, '0')}</span>
                          <img src={pkmn.sprite} alt={pkmn.name} style={{ width: '60px', height: '60px' }} />
                          <strong style={{ textTransform: 'capitalize', display: 'block', fontSize: '0.85rem' }}>
                            {pkmn.name}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pokedex-controls">
              <div className="d-pad" title="D-Pad Pokédex"></div>
              <button
                className="pokedex-close-btn"
                onClick={() => { setShowPokedex(false); setSelectedPokemonDetail(null); setPokedexSearch(''); }}
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'setup' && (
        <section className="panel setup-panel">
          <h2>1. Selecciona la Generación</h2>
          <div className="generation-grid">
            {generations.map((gen) => {
              const unlocked = isGenUnlocked(gen)
              const hardUnlocked = isHardUnlocked(gen)
              const completedMed = progression.completedMedium.includes(gen)
              const completedAny = progression.completedAny.includes(gen)

              return (
                <button
                  key={gen}
                  className={`gen-tile ${generation === gen ? 'is-active' : ''} ${!unlocked ? 'is-locked' : ''}`}
                  onClick={() => handleSelectGeneration(gen)}
                  type="button"
                  disabled={isLoading || !unlocked}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Gen {gen} {unlocked ? '' : '🔒'}</span>
                    {completedMed ? (
                      <span className="badge-medium" title="Completado en Intermedio / Difícil">🏆</span>
                    ) : completedAny ? (
                      <span className="badge-easy" title="Completado en Fácil">⭐</span>
                    ) : null}
                  </div>
                  <strong>{generationRegions[gen]}</strong>

                  {!unlocked && (
                    <span className="lock-text">
                      🔒 Pásate Gen {gen - 1} en Intermedio
                    </span>
                  )}
                  {unlocked && hardUnlocked && (
                    <span className="unlock-tag">🔥 Difícil disponible</span>
                  )}
                </button>
              )
            })}

            {(() => {
              const randomUnlocked = isGenUnlocked(0)
              return (
                <button
                  key={0}
                  className={`gen-tile ${generation === 0 ? 'is-active' : ''} ${!randomUnlocked ? 'is-locked' : ''}`}
                  onClick={() => handleSelectGeneration(0)}
                  type="button"
                  disabled={isLoading || !randomUnlocked}
                  style={{
                    gridColumn: '1 / -1',
                    borderColor: randomUnlocked ? '#eab308' : '#475569',
                    background: !randomUnlocked
                      ? 'rgba(15, 23, 42, 0.6)'
                      : generation === 0
                      ? 'rgba(234, 179, 8, 0.25)'
                      : 'rgba(234, 179, 8, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '12px',
                    opacity: randomUnlocked ? 1 : 0.65,
                    cursor: randomUnlocked ? 'pointer' : 'not-allowed'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem', color: randomUnlocked ? '#facc15' : '#64748b' }}>
                      🎲 RANDOM {randomUnlocked ? '' : '🔒'}
                    </span>
                    <strong style={{ fontSize: '1rem', color: randomUnlocked ? '#facc15' : '#64748b' }}>
                      — {randomUnlocked ? 'Mezclar todas las generaciones' : 'Modo Caos (Completa todas las generaciones)'}
                    </strong>
                  </div>
                  {!randomUnlocked && (
                    <span className="lock-text">
                      🔒 Completa todas las generaciones en Intermedio para desbloquear
                    </span>
                  )}
                </button>
              )
            })()}
          </div>

          <h2 style={{ marginTop: '1.5rem' }}>2. Selecciona la Dificultad</h2>
          <div className="generation-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => {
              const isHard = diff === 'hard'
              const hardUnlocked = isHardUnlocked(generation)
              const isLocked = isHard && !hardUnlocked

              return (
                <button
                  key={diff}
                  className={`gen-tile ${difficulty === diff ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''}`}
                  onClick={() => handleSelectDifficulty(diff)}
                  type="button"
                  disabled={isLoading || isLocked}
                  style={{ opacity: isLocked ? 0.65 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{difficultyLabels[diff].title} {isLocked ? '🔒' : ''}</span>
                  </div>
                  <strong>{difficultyNodeCounts[diff]} rutas</strong>
                  {isLocked && (
                    <span className="lock-text">
                      🔒 Completa {generationRegions[generation]} 1 vez
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button className="cta" onClick={startNewRun} type="button" disabled={isLoading}>
              {isLoading ? 'Cargando PokeAPI...' : "Iniciar Aventura"}
            </button>
            <button className="secondary" onClick={() => setShowPokedex(true)} type="button">
              📖 Abrir Pokédex
            </button>
          </div>
          {apiError && <p className="error-line">{apiError}</p>}
        </section>
      )}

      {(screen === 'route' || screen === 'battle' || screen === 'shop') && activePokemon && (
        <section className="roulette-layout">
          <article className="panel trainer-panel">
            <p className="muted small-tag">Trainer</p>
            <img className="sprite trainer-sprite" src={activePokemon.sprite} alt={activePokemon.name} />
            <h2>{activePokemon.name}</h2>
            <p className="muted">
              {generation === 0 ? 'Random All-Stars' : `Gen ${generation}`} · Nv.{activePokemon.level}
            </p>

            <div className="hp-line">
              <span>HP</span>
              <strong>{activePokemon.hp}/{activePokemon.maxHp}</strong>
            </div>
            <div className="meter">
              <div style={{ width: `${(activePokemon.hp / activePokemon.maxHp) * 100}%` }}></div>
            </div>

            <p className="label">Team {team.length}/{maxTeamSize}</p>
            <div className="team-grid">
              {team.map((pokemon, index) => (
                <div key={`${pokemon.id}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    className={`team-slot ${index === activeIndex ? 'is-active' : ''} ${pokemon.hp <= 0 ? 'is-fainted' : ''}`}
                    type="button"
                    onClick={() => switchActive(index)}
                    disabled={pokemon.hp <= 0 || isLoading}
                  >
                    <img src={pokemon.sprite} alt={pokemon.name} />
                    <strong>{pokemon.name}</strong>
                    <span>{pokemon.hp}/{pokemon.maxHp}</span>
                  </button>
                  {pokemon.hp <= 0 && (
                    <button
                      type="button"
                      className="tiny-btn"
                      style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', padding: '2px 4px' }}
                      onClick={() => removeFaintedPokemon(index)}
                    >
                      🗑️ Liberar
                    </button>
                  )}
                </div>
              ))}
              {Array.from({ length: Math.max(0, maxTeamSize - team.length) }).map((_, index) => (
                <div key={`empty-${index}`} className="team-slot empty">
                  Empty
                </div>
              ))}
            </div>
          </article>

          <article className="panel center-panel">
            <h2>Ruta ({routeIndex + 1}/{route.length})</h2>
            <div className="route-grid" style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
              {route.map((node, index) => {
                const stateClass = index === routeIndex ? 'current' : node.done ? 'done' : 'pending'
                return (
                  <div key={node.id} className={`node ${stateClass}`}>
                    <span>#{node.id}</span>
                    <strong>{nodeTypeLabel(node)}</strong>
                  </div>
                )
              })}
            </div>

            {/* Pantalla Interactiva de la Tienda */}
            {screen === 'shop' && (
              <div className="action-block shop-block" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: '#facc15' }}>🏪 Pokémart</h3>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#4ade80' }}>
                    Dinero: ${money}
                  </span>
                </div>

                <div className="shop-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                  {/* Renderiza los 3 objetos seleccionados aleatoriamente */}
                  {shopStock.map((itemName) => {
                    const data = ALL_SHOP_ITEMS[itemName]
                    if (!data) return null
                    const itemIcon = ITEM_SPRITES[itemName]

                    return (
                      <div
                        key={itemName}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'rgba(0,0,0,0.3)',
                          padding: '8px 12px',
                          borderRadius: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {itemIcon && (
                            <img
                              src={itemIcon}
                              alt={itemName}
                              style={{ width: '28px', height: '28px', imageRendering: 'pixelated' }}
                            />
                          )}
                          <div>
                            <strong style={{ color: '#38bdf8' }}>{itemName}</strong>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>{data.desc}</p>
                          </div>
                        </div>
                        <button
                          className="tiny-btn"
                          type="button"
                          onClick={() => buyShopItem(itemName)}
                          disabled={money < data.price}
                          style={{
                            background: money >= data.price ? '#10b981' : '#475569',
                            minWidth: '70px',
                            color: money >= data.price ? '#0f172a' : '#cbd5e1',
                            fontWeight: 'bold',
                            cursor: money >= data.price ? 'pointer' : 'not-allowed'
                          }}
                        >
                          ${data.price}
                        </button>
                      </div>
                    )
                  })}

                  {/* Servicio de Enfermería (Solo activo si hay Pokémon vivos con falta de HP) */}
                  {(() => {
                    const needsHealing = team.some((pkmn) => pkmn.hp > 0 && pkmn.hp < pkmn.maxHp)
                    const canAffordAndNeeds = money >= 100 && needsHealing

                    return (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'rgba(239, 68, 68, 0.15)',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        <div>
                          <strong style={{ color: '#f87171' }}>💊 Curación Completa</strong>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                            {needsHealing
                              ? 'Restaura el HP de todos los Pokémon vivos.'
                              : 'Tu equipo activo ya tiene la salud al máximo.'}
                          </p>
                        </div>
                        <button
                          className="tiny-btn"
                          type="button"
                          onClick={healTeamAtShop}
                          disabled={!canAffordAndNeeds}
                          style={{
                            background: canAffordAndNeeds ? '#ef4444' : '#475569',
                            minWidth: '70px',
                            color: canAffordAndNeeds ? '#0f172a' : '#cbd5e1',
                            fontWeight: 'bold',
                            cursor: canAffordAndNeeds ? 'pointer' : 'not-allowed'
                          }}
                        >
                          $100
                        </button>
                      </div>
                    )
                  })()}
                </div>

                <button className="cta" onClick={completeCurrentNode} type="button" style={{ width: '100%' }}>
                  Salir de la Tienda
                </button>
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type === 'rest' && restEncounter && (
              <div className="action-block">
                <p>
                  Rest stop: <strong>{restEncounter.name}</strong> is waiting to be captured.
                </p>
                <p className="muted">Reward item added: {restRewardItem}</p>
                <div className="capture-card">
                  <img className="sprite" src={restEncounter.sprite} alt={restEncounter.name} />
                </div>
                <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                  <button className="cta" onClick={captureRestPokemon} type="button" disabled={team.length >= maxTeamSize}>
                    Capture
                  </button>
                  <button className="secondary" onClick={skipRestCapture} type="button">
                    Skip
                  </button>
                </div>

                <div className="evolve-section" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>O evoluciona a un integrante:</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {team.map((pokemon, idx) => (
                      <button
                        key={`evo-${pokemon.id}-${idx}`}
                        className="tiny-btn"
                        type="button"
                        onClick={() => handleEvolveTarget(idx)}
                        disabled={isLoading || pokemon.hp <= 0}
                      >
                        Evolucionar {pokemon.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type !== 'rest' && (
              <div className="action-block">
                <p>
                  Next node: <strong>{currentNode.label}</strong> ({nodeTypeLabel(currentNode)})
                </p>
                <button className="cta" onClick={enterNode} type="button" disabled={isLoading}>
                  {isLoading ? 'Searching rival...' : 'Enter node'}
                </button>
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type === 'rest' && !restEncounter && (
              <div className="action-block">
                <p>
                  Rest stop: <strong>{currentNode.label}</strong>.
                </p>
                <button className="cta" onClick={enterNode} type="button" disabled={isLoading}>
                  {isLoading ? 'Searching encounter...' : 'Enter rest'}
                </button>
              </div>
            )}

            {screen === 'battle' && enemy && (
              <div className="action-block">
                {/* Encabezado del combate */}
                {isTrainerBattle ? (
                  <div style={{ marginBottom: '0.75rem' }}>
                    {/* Sprite del entrenador */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      {trainerSprite && (
                        <img
                          src={trainerSprite}
                          alt={trainerName}
                          style={{ width: '72px', height: '72px', imageRendering: 'pixelated' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      )}
                      <div>
                        <p style={{ margin: '0', fontWeight: 'bold', color: '#facc15', fontSize: '0.95rem' }}>
                          {trainerBadge ? `🏆 Líder ${trainerName}` : `⚔️ ${trainerName}`}
                        </p>
                        {trainerBadge && (
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#fbbf24' }}>{trainerBadge}</p>
                        )}
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                          Equipo: {trainerTeam.length} Pokémon
                        </p>
                      </div>
                    </div>
                    {/* Miniaturas del equipo */}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {trainerTeam.map((tp, idx) => {
                        const isActive = idx === trainerPokemonIndex
                        const isDefeated = idx < trainerPokemonIndex || (idx === trainerPokemonIndex && tp.hp <= 0)
                        return (
                          <div
                            key={`trainer-pkmn-${idx}`}
                            title={`${tp.name} Nv.${tp.level} – ${tp.hp}/${tp.maxHp} HP`}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '6px',
                              border: isActive ? '2px solid #facc15' : '1px solid rgba(255,255,255,0.15)',
                              background: isDefeated ? 'rgba(239,68,68,0.15)' : isActive ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.05)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              overflow: 'hidden', position: 'relative'
                            }}
                          >
                            <img
                              src={tp.sprite}
                              alt={tp.name}
                              style={{
                                width: '34px', height: '34px',
                                filter: isDefeated ? 'grayscale(100%) brightness(0.5)' : 'none',
                                opacity: isDefeated ? 0.4 : 1
                              }}
                            />
                            {isActive && (
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                height: '3px', background: '#facc15', borderRadius: '0 0 4px 4px'
                              }} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: '0 0 4px 0', color: '#86efac', fontSize: '0.85rem' }}>🌿 Pokémon Salvaje</p>
                )}

                {/* Pokémon enemigo activo */}
                <p style={{ margin: '0 0 4px 0' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{enemy.name}</strong>
                  {' · '}Nv.&nbsp;{enemy.level}
                </p>
                <img className="sprite enemy-sprite" src={enemy.sprite} alt={enemy.name} />
                <div className="hp-line">
                  <span>HP rival</span>
                  <strong>{enemy.hp}/{enemy.maxHp}</strong>
                </div>
                <div className="meter enemy-meter">
                  <div style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}></div>
                </div>

                <div className="moves-grid">
                  {activePokemon.moves.map((move) => (
                    <button
                      key={move.name}
                      className="move-btn"
                      onClick={() => onPlayerMove(move)}
                      type="button"
                      disabled={isLoading}
                      title={moveTooltip(move)}
                    >
                      {move.name} ({move.type})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {apiError && <p className="error-line">{apiError}</p>}
          </article>

          <article className="panel items-panel">
            <h2>Items</h2>
            <div className="items-grid">
              {inventoryEntries.length > 0 ? (
                inventoryEntries.map((entry) => {
                  const itemIcon = ITEM_SPRITES[entry.name]
                  return (
                    <button
                      key={entry.name}
                      className="item-slot filled item-button"
                      type="button"
                      onClick={() => useInventoryItem(entry.name)}
                      title={entry.description}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px' }}
                    >
                      {itemIcon && (
                        <img
                          src={itemIcon}
                          alt={entry.name}
                          style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                        />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <strong>{entry.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>x{entry.count}</span>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="item-slot empty">No items</div>
              )}
            </div>

            {modifier && (
              <div className="modifier-box">
                <p className="small-tag">Modifier</p>
                <strong>{modifier.name}</strong>
                <p className="muted">{modifier.description}</p>
              </div>
            )}

            <div className="log-mini">
              <p className="small-tag">Battle log</p>
              <ul>
                {battleLog.map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ul>
            </div>
          </article>
        </section>
      )}

      {screen === 'victory' && (
        <section className="panel end-panel">
          <h2>¡Victoria!</h2>
          <p>Has completado la ruta ({difficultyNodeCounts[difficulty]} nodos) y derrotado al jefe final.</p>

          {victoryUnlocks && (
            <div
              className="victory-unlocks-box"
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                padding: '1.25rem',
                margin: '1.5rem 0',
                textAlign: 'left'
              }}
            >
              <h3 style={{ color: '#34d399', margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>
                🎉 ¡Progreso de la Aventura!
              </h3>
              {victoryUnlocks.nextGenNumber ? (
                <p style={{ margin: '6px 0', color: '#f8fafc', fontSize: '0.95rem' }}>
                  🔓 <strong>¡NUEVA GENERACIÓN DESBLOQUEADA!</strong> Gen {victoryUnlocks.nextGenNumber} ({victoryUnlocks.nextGenName}) ya está disponible para jugar.
                </p>
              ) : difficulty === 'easy' && currentRunGen < 9 && !progression.completedMedium.includes(currentRunGen) ? (
                <p style={{ margin: '6px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                  💡 <em>Consejo: Completa la Gen {currentRunGen} ({victoryUnlocks.genName}) en dificultad Intermedia para desbloquear la Gen {currentRunGen + 1}.</em>
                </p>
              ) : null}

              {victoryUnlocks.unlockedHard && (
                <p style={{ margin: '6px 0', color: '#fb923c', fontSize: '0.95rem' }}>
                  🔥 <strong>¡MODO DÍFICIL DESBLOQUEADO!</strong> Ahora puedes desafiar la Gen {currentRunGen} ({victoryUnlocks.genName}) en dificultad Difícil (25 rutas).
                </p>
              )}
            </div>
          )}

          <button className="cta" onClick={resetToSetup} type="button">
            Iniciar otra partida
          </button>
        </section>
      )}

      {screen === 'defeat' && (
        <section className="panel end-panel defeat-panel">
          <div className="defeat-header">
            <h2 className="defeat-title">💀 HAS SIDO DERROTADO</h2>
            <p className="muted">Tu equipo ha quedado fuera de combate.</p>
          </div>

          {defeatSummary && (
            <div className="defeat-details-grid" style={{ marginTop: '1rem', textAlign: 'left' }}>
              <div className="defeat-box" style={{ marginBottom: '1.5rem' }}>
                <h3 className="section-subtitle" style={{ fontSize: '1rem', color: '#f87171' }}>🛡️ Equipo Caído</h3>
                <div className="fainted-team-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {defeatSummary.finalTeam.map((pkmn, idx) => (
                    <div key={`${pkmn.id}-${idx}`} className="fainted-card" style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <img src={pkmn.sprite} alt={pkmn.name} style={{ width: '48px', height: '48px', opacity: 0.6, filter: 'grayscale(100%)' }} />
                      <strong style={{ display: 'block', fontSize: '0.85rem' }}>{pkmn.name}</strong>
                      <span className="muted" style={{ fontSize: '0.75rem' }}>Nv. {pkmn.level}</span>
                    </div>
                  ))}
                </div>
              </div>

              {defeatSummary.enemy && (
                <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Caíste luchando contra <strong>{defeatSummary.enemy.name} (Nv. {defeatSummary.enemy.level})</strong> en el nodo <em>{defeatSummary.lastNodeLabel ?? 'de combate'}</em>.
                </p>
              )}

              <div className="log-mini defeat-log" style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                <p className="small-tag">Últimas acciones</p>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                  {defeatSummary.battleLog.slice(0, 5).map((line, index) => (
                    <li key={`defeat-log-${index}`}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <button className="cta" onClick={resetToSetup} type="button" style={{ marginTop: '1.5rem' }}>
            Intentar de nuevo
          </button>
        </section>
      )}
    </main>
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
          <h2>Algo salió mal.</h2>
          <button className="cta" onClick={() => window.location.reload()}>
            Recargar aplicación
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  )
}