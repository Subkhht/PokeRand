import { useMemo, useState, useEffect, useRef, Component, type ReactNode } from 'react'
import './App.css'
import { applyDamage, applyNoEvolutionBuff, healPokemon, randomFrom, scalePokemonForNode, startRun, generateBossRushRoute, ALL_TYPES } from './game/engine'
import { playHover, playClick, startMenuMusic, startBattleMusic, playVictoryFanfare, playDefeatMusic, setVolume, getVolume, setSfxVolume, getSfxVolume } from './game/sound'
import {
  getBalancedPokemonByGeneration,
  getRandomStarterByGeneration,
  evolvePokemon,
  fetchPokemonDetails,
  checkAndLearnNewMove,
  getMoveDetails,
  buildPokemonFromApi,
  type PokemonDetails
} from './game/pokeapi'
import { getTypeEffectiveness } from './game/typesChart'
import type { Move, Pokemon, RouteNode, RunConfig, RunModifier, DefeatSummary, RunChallenges } from './game/types'

type Screen = 'setup' | 'route' | 'battle' | 'shop' | 'spin' | 'pokeRand' | 'move' | 'victory' | 'defeat'
type Difficulty = 'easy' | 'medium' | 'hard' | 'infinite'

const difficultyNodeCounts: Record<Difficulty, number> = {
  easy: 5,
  medium: 10,
  hard: 25,
  infinite: 0
}

const difficultyLabels: Record<Difficulty, { title: string; desc: string }> = {
  easy: { title: 'Fácil', desc: '5 rutas (Aventura corta)' },
  medium: { title: 'Intermedia', desc: '10 rutas (Aventura estándar)' },
  hard: { title: 'Difícil', desc: '25 rutas (Desafío extremo)' },
  infinite: { title: 'Infinite', desc: 'Sin límite (Aventura infinita)' }
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
  'Muscle Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/muscle-band.png',
  'Wise Glasses': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/wise-glasses.png',
  'Choice Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/choice-band.png',
  'Leftovers': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/leftovers.png',
  'Focus Sash': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-sash.png',
  'Assault Vest': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/assault-vest.png',
  'Quick Claw': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/quick-claw.png',
  'Eviolite': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/eviolite.png',
  'Life Orb': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/life-orb.png',
  'Rocky Helmet': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rocky-helmet.png',
  'Scope Lens': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/scope-lens.png',
  'Shell Bell': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shell-bell.png',
  'Choice Scarf': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/choice-scarf.png',
  'Babiri Berry': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/babiri-berry.png',
  'Big Root': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/big-root.png',
  'Wide Lens': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/wide-lens.png',
  'Sitrus Berry': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sitrus-berry.png',
  'Guts Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/muscle-band.png',
  'Vest Protector': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/assault-vest.png',
  'Focus Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-band.png',
}

interface HoldableItem {
  name: string
  desc: string
  price: number
  attackMod?: number
  defenseMod?: number
  speedMod?: number
  maxHpMod?: number
  healPerTurn?: number
  damageBoost?: number
  damageReduction?: number
  critChance?: number
  lifesteal?: number
  lowHpBonus?: number
  firstStrikeBonus?: number
}

const HOLDABLE_ITEMS: Record<string, HoldableItem> = {
  'Muscle Band': { name: 'Muscle Band', desc: '+15% Ataque', price: 200, attackMod: 0.15 },
  'Wise Glasses': { name: 'Wise Glasses', desc: '+15% Velocidad', price: 200, speedMod: 0.15 },
  'Choice Band': { name: 'Choice Band', desc: '+25% Ataque', price: 350, attackMod: 0.25 },
  'Leftovers': { name: 'Leftovers', desc: 'Recupera 6 HP por turno', price: 300, healPerTurn: 6 },
  'Focus Sash': { name: 'Focus Sash', desc: '+20 HP máximos', price: 250, maxHpMod: 20 },
  'Assault Vest': { name: 'Assault Vest', desc: '+20% Defensa', price: 300, defenseMod: 0.20 },
  'Quick Claw': { name: 'Quick Claw', desc: '+20% Velocidad', price: 250, speedMod: 0.20 },
  'Eviolite': { name: 'Eviolite', desc: '+10% Defensa y Ataque', price: 200, attackMod: 0.10, defenseMod: 0.10 },
  'Life Orb': { name: 'Life Orb', desc: '+30% Daño, -5 HP por turno', price: 400, damageBoost: 0.30, healPerTurn: -5 },
  'Rocky Helmet': { name: 'Rocky Helmet', desc: '+15% Defensa', price: 200, defenseMod: 0.15 },
  'Scope Lens': { name: 'Scope Lens', desc: '20% Golpe Crítico', price: 250, critChance: 0.20 },
  'Shell Bell': { name: 'Shell Bell', desc: '20% Robo de Vida', price: 300, lifesteal: 0.20 },
  'Choice Scarf': { name: 'Choice Scarf', desc: '+30% Velocidad', price: 350, speedMod: 0.30 },
  'Babiri Berry': { name: 'Babiri Berry', desc: '20% Reducción de Daño', price: 250, damageReduction: 0.20 },
  'Big Root': { name: 'Big Root', desc: '25% Robo de Vida', price: 350, lifesteal: 0.25 },
  'Wide Lens': { name: 'Wide Lens', desc: '15% Crítico, +10% Velocidad', price: 200, critChance: 0.15, speedMod: 0.10 },
  'Sitrus Berry': { name: 'Sitrus Berry', desc: '+15 HP máximos, +8 HP/turno', price: 200, maxHpMod: 15, healPerTurn: 8 },
  'Guts Band': { name: 'Guts Band', desc: '+20% Ataque, +15% daño bajo 30% HP', price: 300, attackMod: 0.20, lowHpBonus: 0.15 },
  'Vest Protector': { name: 'Vest Protector', desc: '+25% Defensa, 15% Reducción daño', price: 400, defenseMod: 0.25, damageReduction: 0.15 },
  'Focus Band': { name: 'Focus Band', desc: '25% Crítico, +10% Ataque', price: 300, critChance: 0.25, attackMod: 0.10 },
}

const HOLDABLE_ITEM_NAMES = Object.keys(HOLDABLE_ITEMS)

function fallbackSprite(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  if (img.dataset.fallback) return
  img.dataset.fallback = '1'
  img.src = img.src.replace(/\/animated\/(\d+)\.gif/, '/$1.png')
}

const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030',
  grass: '#78c850', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0',
  ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848',
  steel: '#b8b8d0', fairy: '#ee99ac',
}

// Entrenadores normales (clase + nombre)
const TRAINER_TYPES: Array<{ label: string; name: string; sprite: string }> = [
  { label: 'Youngster', name: 'Miguel', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/youngster.png' },
  { label: 'Youngster', name: 'Tommy', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/youngster.png' },
  { label: 'Lass', name: 'Laura', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/lass.png' },
  { label: 'Lass', name: 'Ana', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/lass.png' },
  { label: 'Hiker', name: 'Jorge', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/hiker.png' },
  { label: 'Hiker', name: 'Bruno', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/hiker.png' },
  { label: 'Fisherman', name: 'Carlos', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/fisherman.png' },
  { label: 'Fisherman', name: 'Pedro', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/fisherman.png' },
  { label: 'Camper', name: 'Ricky', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/camper.png' },
  { label: 'Biker', name: 'Gus', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/biker.png' },
  { label: 'Beauty', name: 'Valeria', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/beauty.png' },
  { label: 'Gentleman', name: 'Arthur', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/gentleman.png' },
  { label: 'Sailor', name: 'Ramiro', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/sailor.png' },
  { label: 'Bug Catcher', name: 'Diego', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/bugcatcher.png' },
  { label: 'Picnicker', name: 'Mia', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/picnicker.png' },
  { label: 'Ace Trainer', name: 'Sergio', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/acetrainer.png' },
  { label: 'Ace Trainer', name: 'Elena', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/acetrainerf.png' },
  { label: 'Black Belt', name: 'Kenji', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blackbelt.png' },
  { label: 'Psychic', name: 'Marco', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/psychic.png' },
  { label: 'Swimmer', name: 'Max', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/swimmer.png' },
]

// Líderes de Gimnasio (solo aparecen en el Jefe Final)
const GYM_LEADERS: Array<{ name: string; badge: string; sprite: string }> = [
  { name: 'Brock', badge: 'Médalla Roca', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/brock.png' },
  { name: 'Misty', badge: 'Médalla Cascada', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/misty.png' },
  { name: 'Surge', badge: 'Médalla Trueno', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/ltsurge.png' },
  { name: 'Erika', badge: 'Médalla Arco Iris', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/erika.png' },
  { name: 'Sabrina', badge: 'Médalla Pantano', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/sabrina.png' },
  { name: 'Blaine', badge: 'Médalla Volcán', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blaine.png' },
  { name: 'Giovanni', badge: 'Médalla Tierra', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/giovanni.png' },
  { name: 'Falkner', badge: 'Médalla Ala', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/falkner.png' },
  { name: 'Bugsy', badge: 'Médalla Colmíllo', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/bugsy.png' },
  { name: 'Whitney', badge: 'Médalla Lisa', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/whitney.png' },
  { name: 'Morty', badge: 'Médalla Niebla', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/morty.png' },
  { name: 'Chuck', badge: 'Médalla Tormenta', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/chuck.png' },
  { name: 'Jasmine', badge: 'Médalla Mineral', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/jasmine.png' },
  { name: 'Pryce', badge: 'Médalla Glaciar', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/pryce.png' },
  { name: 'Clair', badge: 'Médalla Ascenso', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/clair.png' },
  { name: 'Roxanne', badge: 'Médalla Roca', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/roxanne.png' },
  { name: 'Brawly', badge: 'Médalla Puño', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/brawly.png' },
  { name: 'Wattson', badge: 'Médalla Dinámo', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/wattson.png' },
  { name: 'Flannery', badge: 'Médalla Calor', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/flannery.png' },
  { name: 'Norman', badge: 'Médalla Balance', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/norman.png' },
  { name: 'Winona', badge: 'Médalla Pluma', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/winona.png' },
  { name: 'Tate', badge: 'Médalla Mente', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/tate.png' },
  { name: 'Juan', badge: 'Médalla Lluvia', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/juan.png' },
  { name: 'Roark', badge: 'Médalla Carbona', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/roark.png' },
  { name: 'Gardenia', badge: 'Médalla Bosque', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/gardenia.png' },
  { name: 'Maylene', badge: 'Médalla Cobra', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/maylene.png' },
  { name: 'Fantina', badge: 'Médalla Relevo', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/fantina.png' },
  { name: 'Byron', badge: 'Médalla Mina', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/byron.png' },
  { name: 'Candice', badge: 'Médalla Escarcha', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/candice.png' },
  { name: 'Volkner', badge: 'Médalla Faro', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/volkner.png' },
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
    case 'teamRocket':
      return 'TeamR'
    case 'spin':
      return 'Spin'
    case 'pokeRand':
      return 'PokeRand'
    case 'move':
      return 'Move'
    default:
      return node.type
  }
}

function moveTooltip(move: Move): string {
  const accuracy = move.accuracy === null ? 'Always hits' : `${move.accuracy}% accuracy`
  return `${move.name}\nPower: ${move.power}\n${accuracy}\n${move.description}`
}

function getEffectiveStats(pokemon: Pokemon): { attack: number; defense: number; speed: number; maxHp: number } {
  const item = pokemon.holdItem ? HOLDABLE_ITEMS[pokemon.holdItem] : null
  if (!item) return { attack: pokemon.attack, defense: pokemon.defense, speed: pokemon.speed, maxHp: pokemon.maxHp }
  return {
    attack: Math.round(pokemon.attack * (1 + (item.attackMod ?? 0))),
    defense: Math.round(pokemon.defense * (1 + (item.defenseMod ?? 0))),
    speed: Math.round(pokemon.speed * (1 + (item.speedMod ?? 0))),
    maxHp: pokemon.maxHp,
  }
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
  completedHard: number[]
}

interface VictoryUnlocks {
  genName: string
  nextGenNumber: number | null
  nextGenName: string | null
  unlockedHard: boolean
  unlockedInfinite: boolean
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
          completedAny: Array.isArray(parsed.completedAny) ? parsed.completedAny : [],
          completedHard: Array.isArray(parsed.completedHard) ? parsed.completedHard : []
        }
      }
    } catch {
      // fallback
    }
    return { completedMedium: [], completedAny: [], completedHard: [] }
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
  const [money, setMoney] = useState<number>(100)
  const [shopStock, setShopStock] = useState<string[]>([])

  const [inventory, setInventory] = useState<string[]>([])
  const [modifier, setModifier] = useState<RunModifier | null>(null)
  const [runChallenges, setRunChallenges] = useState<RunChallenges>({
    noShops: false,
    noRests: false,
    allShiny: false,
    allTeamRocket: false,
    nuzlocke: false,
    soloStarter: false,
    fixedTeam: false,
    noEvolution: false,
    noItems: false,
    restrictedMoves: false,
    firstStrike: false,
    fixedLevel: false,
    noCrits: false,
    typeRandomizer: false,
    noPurchasing: false,
    blindRoute: false,
    bossRush: false,
    speedrun: false,
    noMoney: false,
    doubleModifiers: false,
    scalingEnemies: false,
    noHealing: false,
    ironman: false,
    totalRandomizer: false,
    nuzlockeHardcore: false,
    challengeGauntlet: false,
    egglocke: false,
  })
  const [battleLog, setBattleLog] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [apiError, setApiError] = useState<string>('')
  const [restEncounter, setRestEncounter] = useState<Pokemon | null>(null)
  const [restRewardItem, setRestRewardItem] = useState<string>('')

  // Resumen de derrota
  const [defeatSummary, setDefeatSummary] = useState<DefeatSummary | null>(null)

  // Modal de selección de objetivo para Revive
  const [reviveModal, setReviveModal] = useState<{ itemName: string; itemIndex: number } | null>(null)
  const [equipModal, setEquipModal] = useState<{ itemName: string; itemIndex: number } | null>(null)

  // Team Rocket
  const [isTeamRocketBattle, setIsTeamRocketBattle] = useState<boolean>(false)
  const [teamRocketFainted, setTeamRocketFainted] = useState<boolean>(false)
  const [teamRocketTeam, setTeamRocketTeam] = useState<Pokemon[]>([])
  const [teamRocketStealMessage, setTeamRocketStealMessage] = useState<string>('')
  const [teamRocketPickModal, setTeamRocketPickModal] = useState<boolean>(false)

  // Spin (Ruleta)
  const [spinItems, setSpinItems] = useState<string[]>([])
  const [spinAnimating, setSpinAnimating] = useState<boolean>(false)
  const [spinWinnerIndex, setSpinWinnerIndex] = useState<number | null>(null)
  const [spinRevealed, setSpinRevealed] = useState<boolean>(false)

  // PokeRand (Ruleta de Pokémon)
  const [pokeRandPokemon, setPokeRandPokemon] = useState<Pokemon[]>([])
  const [pokeRandAnimating, setPokeRandAnimating] = useState<boolean>(false)
  const [pokeRandWinnerIndex, setPokeRandWinnerIndex] = useState<number | null>(null)
  const [pokeRandRevealed, setPokeRandRevealed] = useState<boolean>(false)

  // Move node (intercambio de movimientos)
  const [moveOptions, setMoveOptions] = useState<Move[]>([])
  const [selectedNewMove, setSelectedNewMove] = useState<Move | null>(null)
  const [moveOptionsByIndex, setMoveOptionsByIndex] = useState<Record<number, Move[]>>({})

  // Egglocke
  const [eggInventory, setEggInventory] = useState<Array<{ name: string; sprite: string; types: string[]; hatchIn: number; id: number }>>([])

  const [pcStorage, setPcStorage] = useState<Pokemon[]>([])
  const [modifier2, setModifier2] = useState<RunModifier | null>(null)
  const [gauntletKeys, setGauntletKeys] = useState<Array<keyof RunChallenges>>([])

  // Speedrun timer
  const [speedrunSeconds, setSpeedrunSeconds] = useState<number>(0)
  const speedrunTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Pokédex
  const [showPokedex, setShowPokedex] = useState<boolean>(false)
  const [pokedexSearch, setPokedexSearch] = useState<string>('')
  const [selectedPokemonDetail, setSelectedPokemonDetail] = useState<PokemonDetails | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false)

  // Opciones / Volumen
  const [showOptions, setShowOptions] = useState<boolean>(false)
  const [volume, setVolumeState] = useState<number>(() => Math.round(getVolume() * 100))
  const [sfxVol, setSfxVolState] = useState<number>(() => Math.round(getSfxVolume() * 100))

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

  useEffect(() => { startMenuMusic() }, [])

  // Speedrun: auto-defeat when timer reaches 0
  useEffect(() => {
    if (runChallenges.speedrun && speedrunSeconds === 0 && screen === 'battle') {
      if (speedrunTimerRef.current) {
        clearInterval(speedrunTimerRef.current)
        speedrunTimerRef.current = null
      }
      const fullLogs = ['⏱️ ¡Tiempo agotado! Has perdido por Speedrun.', ...battleLog]
      setBattleLog(fullLogs)
      setDefeatSummary({
        finalTeam: team,
        battleLog: fullLogs,
        enemy: enemy,
        lastNodeLabel: currentNode?.label
      })
      const losses = record.losses + 1
      persistRecord(record.wins, losses)
      setScreen('defeat')
      playDefeatMusic()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedrunSeconds])

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

  function isInfiniteUnlocked(gen: number): boolean {
    return progression.completedHard.includes(gen)
  }

  function handleSelectGeneration(gen: number) {
    if (!isGenUnlocked(gen)) return
    setGeneration(gen)
    if (difficulty === 'hard' && !isHardUnlocked(gen)) {
      setDifficulty('medium')
    }
    if (difficulty === 'infinite' && !isInfiniteUnlocked(gen)) {
      setDifficulty('medium')
    }
    const challengesLocked = gen === 0
      ? !generations.every((g) => progression.completedMedium.includes(g))
      : !progression.completedMedium.includes(gen)
    if (challengesLocked && (runChallenges.noShops || runChallenges.noRests || runChallenges.allShiny || runChallenges.allTeamRocket || runChallenges.nuzlocke || runChallenges.soloStarter || runChallenges.fixedTeam || runChallenges.noEvolution || runChallenges.noItems || runChallenges.restrictedMoves || runChallenges.firstStrike || runChallenges.fixedLevel || runChallenges.noCrits || runChallenges.typeRandomizer || runChallenges.noPurchasing || runChallenges.blindRoute || runChallenges.bossRush || runChallenges.speedrun || runChallenges.noMoney || runChallenges.doubleModifiers || runChallenges.scalingEnemies || runChallenges.noHealing || runChallenges.ironman || runChallenges.totalRandomizer || runChallenges.nuzlockeHardcore || runChallenges.challengeGauntlet || runChallenges.egglocke)) {
      setRunChallenges({ noShops: false, noRests: false, allShiny: false, allTeamRocket: false, nuzlocke: false, soloStarter: false, fixedTeam: false, noEvolution: false, noItems: false, restrictedMoves: false, firstStrike: false, fixedLevel: false, noCrits: false, typeRandomizer: false, noPurchasing: false, blindRoute: false, bossRush: false, speedrun: false, noMoney: false, doubleModifiers: false, scalingEnemies: false, noHealing: false, ironman: false, totalRandomizer: false, nuzlockeHardcore: false, challengeGauntlet: false, egglocke: false })
    }
  }

  function handleSelectDifficulty(diff: Difficulty) {
    if (diff === 'hard' && !isHardUnlocked(generation)) return
    if (diff === 'infinite' && !isInfiniteUnlocked(generation)) return
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
        const match = pokemon.sprite.match(/\/(\d+)\.(png|gif)/)
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

  function generateRandomNodeType(id: number): RouteNode {
    let type: RouteNode['type'] = 'battle'
    if (runChallenges.bossRush) {
      type = 'battle'
    } else if (runChallenges.allTeamRocket) {
      type = 'teamRocket'
    } else {
      const rand = Math.random()
      if (difficulty === 'infinite') {
        if (rand < 0.10 && !runChallenges.noShops) {
          type = 'shop'
        } else if (rand < 0.20 && !runChallenges.noRests) {
          type = 'rest'
        } else if (rand < 0.30) {
          type = 'teamRocket'
        } else if (rand < 0.36) {
          type = 'spin'
        } else if (rand < 0.42) {
          type = 'pokeRand'
        } else if (rand < 0.52) {
          type = 'move'
        }
      } else {
        if (rand < 0.15 && !runChallenges.noShops) {
          type = 'shop'
        } else if (rand < 0.40 && !runChallenges.noRests) {
          type = 'rest'
        } else if (rand < 0.52) {
          type = 'teamRocket'
        }
      }
    }
    return {
      id,
      type,
      label: type === 'teamRocket' ? `TeamR #${id}` : type === 'spin' ? `Spin #${id}` : type === 'pokeRand' ? `PokeRand #${id}` : type === 'move' ? `Move #${id}` : `Ruta ${id}`,
      done: false
    }
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
    if (difficulty === 'infinite' && !isInfiniteUnlocked(generation)) {
      setApiError('El modo Infinite se desbloquea completando Difícil en esta generación.')
      return
    }

    setIsLoading(true)
    setApiError('')

    try {
      const targetGen = getEffectiveGen()
      setCurrentRunGen(targetGen)

      // Handle challengeGauntlet: randomly pick 3 challenges
      let activeChallenges = { ...runChallenges }
      if (activeChallenges.challengeGauntlet) {
        const allChallengeKeys: Array<keyof RunChallenges> = [
          'noShops', 'noRests', 'allShiny', 'allTeamRocket', 'nuzlocke',
          'soloStarter', 'fixedTeam', 'noEvolution', 'noItems', 'restrictedMoves',
          'firstStrike', 'fixedLevel', 'noCrits', 'typeRandomizer', 'noPurchasing',
          'blindRoute', 'bossRush', 'speedrun', 'noMoney', 'doubleModifiers',
          'scalingEnemies', 'noHealing', 'ironman', 'totalRandomizer', 'egglocke'
        ]
        const shuffled = [...allChallengeKeys].sort(() => Math.random() - 0.5)
        const picked = shuffled.slice(0, 3)
        activeChallenges = { ...activeChallenges }
        for (const key of allChallengeKeys) {
          activeChallenges[key] = picked.includes(key)
        }
        activeChallenges.challengeGauntlet = true
        setRunChallenges(activeChallenges)
        setGauntletKeys(picked)
      }

      // Handle nuzlockeHardcore: nuzlocke + noItems + noRests
      if (activeChallenges.nuzlockeHardcore) {
        activeChallenges = { ...activeChallenges, nuzlocke: true, noItems: true, noRests: true }
        setRunChallenges(activeChallenges)
      }

      // Handle ironman: noEvolution + fixedTeam + noHealing
      if (activeChallenges.ironman) {
        activeChallenges = { ...activeChallenges, noEvolution: true, fixedTeam: true, noHealing: true }
        setRunChallenges(activeChallenges)
      }

      const starter = await getRandomStarterByGeneration(targetGen, activeChallenges.allShiny)
      const config: RunConfig = { generation: targetGen }
      const run = startRun(config, activeChallenges.doubleModifiers)

      if (run.modifier2) {
        setModifier2(run.modifier2)
      } else {
        setModifier2(null)
      }

      registerInPokedex(starter)

      const totalNodes = difficultyNodeCounts[difficulty]
      let customRoute: RouteNode[] = []

      if (activeChallenges.bossRush) {
        customRoute = generateBossRushRoute(totalNodes)
      } else if (difficulty === 'infinite') {
        for (let i = 1; i <= 5; i++) {
          customRoute.push(generateRandomNodeType(i))
        }
      } else {
        const spinPositions: number[] = []
        const pokeRandPositions: number[] = []
        const movePositions: number[] = []
        if (difficulty === 'hard') {
          const available = Array.from({ length: totalNodes - 2 }, (_, k) => k + 2)
          while (spinPositions.length < 2 && available.length > 0) {
            const idx = Math.floor(Math.random() * available.length)
            spinPositions.push(available[idx])
            available.splice(idx, 1)
          }
          while (pokeRandPositions.length < 2 && available.length > 0) {
            const idx = Math.floor(Math.random() * available.length)
            pokeRandPositions.push(available[idx])
            available.splice(idx, 1)
          }
          if (available.length > 0) {
            const idx = Math.floor(Math.random() * available.length)
            movePositions.push(available[idx])
            available.splice(idx, 1)
          }
        } else if (difficulty === 'medium') {
          const available = Array.from({ length: totalNodes - 2 }, (_, k) => k + 2)
          const idx = Math.floor(Math.random() * available.length)
          pokeRandPositions.push(available[idx])
          available.splice(idx, 1)
          if (available.length > 0) {
            const idx2 = Math.floor(Math.random() * available.length)
            movePositions.push(available[idx2])
            available.splice(idx2, 1)
          }
        }

        for (let i = 1; i < totalNodes; i++) {
          let type: RouteNode['type'] = 'battle'

          if (spinPositions.includes(i)) {
            type = 'spin'
          } else if (pokeRandPositions.includes(i)) {
            type = 'pokeRand'
          } else if (movePositions.includes(i)) {
            type = 'move'
          } else if (activeChallenges.bossRush) {
            type = 'battle'
          } else if (activeChallenges.allTeamRocket) {
            type = 'teamRocket'
          } else {
            const rand = Math.random()
            if (rand < 0.15 && !activeChallenges.noShops) {
              type = 'shop'
            } else if (rand < 0.40 && !activeChallenges.noRests) {
              type = 'rest'
            } else if (rand < 0.52) {
              type = 'teamRocket'
            }
          }

          customRoute.push({
            id: i,
            type,
            label: type === 'teamRocket' ? `TeamR #${i}` : type === 'spin' ? `Spin #${i}` : type === 'pokeRand' ? `PokeRand #${i}` : type === 'move' ? `Move #${i}` : `Ruta ${i}`,
            done: false
          })
        }

        customRoute.push({
          id: totalNodes,
          type: 'boss',
          label: `Combate Final (#${totalNodes})`,
          done: false
        })
      }

      const hpBonus = run.modifier?.playerMaxHpBonus ?? 0
      let starterWithBonus = {
        ...starter,
        maxHp: starter.maxHp + hpBonus,
        hp: starter.hp + hpBonus,
      }
      if (activeChallenges.noEvolution) {
        starterWithBonus = applyNoEvolutionBuff(starterWithBonus)
      }
      if (activeChallenges.fixedLevel) {
        starterWithBonus = { ...starterWithBonus, level: 50 }
      }
      setTeam([starterWithBonus])
      setActiveIndex(0)
      setMoney(activeChallenges.noMoney ? 0 : 100)
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
      setEggInventory([])
      setSpeedrunSeconds(0)
      if (speedrunTimerRef.current) {
        clearInterval(speedrunTimerRef.current)
        speedrunTimerRef.current = null
      }

      const challengeDescriptions: string[] = []
      if (activeChallenges.noShops) challengeDescriptions.push('🚫 Desafío: Sin tiendas.')
      if (activeChallenges.noRests) challengeDescriptions.push('🚫 Desafío: Sin descansos.')
      if (activeChallenges.allShiny) challengeDescriptions.push('✨ Desafío: Todos los Pokémon son Shiny.')
      if (activeChallenges.allTeamRocket) challengeDescriptions.push('🔴 Desafío: ¡Todos los nodos son TeamR!')
      if (activeChallenges.nuzlocke) challengeDescriptions.push('💀 Desafío: Nuzlocke (muerte = liberación).')
      if (activeChallenges.soloStarter) challengeDescriptions.push('🌟 Desafío: Solo Starter (sin capturas).')
      if (activeChallenges.fixedTeam) challengeDescriptions.push('🔒 Desafío: Equipo Fijo.')
      if (activeChallenges.noEvolution) challengeDescriptions.push('🚫 Desafío: Sin Evolución.')
      if (activeChallenges.noItems) challengeDescriptions.push('🚫 Desafío: Sin Objetos en batalla.')
      if (activeChallenges.restrictedMoves) challengeDescriptions.push('⚔️ Desafío: Solo 2 movimientos.')
      if (activeChallenges.firstStrike) challengeDescriptions.push('⚡ Desafío: Primer Golpe (recoil).')
      if (activeChallenges.fixedLevel) challengeDescriptions.push('📊 Desafío: Nivel Fijo.')
      if (activeChallenges.noCrits) challengeDescriptions.push('🚫 Desafío: Sin Críticos.')
      if (activeChallenges.typeRandomizer) challengeDescriptions.push('🎲 Desafío: Tipo Randomizado.')
      if (activeChallenges.noPurchasing) challengeDescriptions.push('🚫 Desafío: Sin Compras.')
      if (activeChallenges.blindRoute) challengeDescriptions.push('👁️‍🗨️ Desafío: Ruta Ciega.')
      if (activeChallenges.bossRush) challengeDescriptions.push('🏆 Desafío: Boss Rush.')
      if (activeChallenges.speedrun) challengeDescriptions.push('⏱️ Desafío: Speedrun (30s/turno).')
      if (activeChallenges.noMoney) challengeDescriptions.push('💸 Desafío: Sin Dinero.')
      if (activeChallenges.doubleModifiers) challengeDescriptions.push('🎰 Desafío: Modifiers Duplos.')
      if (activeChallenges.scalingEnemies) challengeDescriptions.push('📈 Desafío: Enemigos Reforzados.')
      if (activeChallenges.noHealing) challengeDescriptions.push('🚫 Desafío: Sin Curación.')
      if (activeChallenges.ironman) challengeDescriptions.push('🔒 Desafío: Ironman (todo fijo).')
      if (activeChallenges.totalRandomizer) challengeDescriptions.push('🎲 Desafío: Randomizer Total.')
      if (activeChallenges.nuzlockeHardcore) challengeDescriptions.push('💀 Desafío: Nuzlocke Hardcore.')
      if (activeChallenges.challengeGauntlet) challengeDescriptions.push('🎰 Desafío: Gauntlet (3 al azar).')
      if (activeChallenges.egglocke) challengeDescriptions.push('🥚 Desafío: Egglocke.')

      setBattleLog([
        `Tu inicial es ${starter.name}${starter.shiny ? ' ✨' : ''}.`,
        `Modo: ${generation === 0 ? 'Random All-Stars' : `Gen ${generation}`}.`,
        `Dificultad: ${difficultyLabels[difficulty].title}${difficulty === 'infinite' ? ' (Sin límite)' : ` (${totalNodes} rutas)`}.`,
        `Recibes $${activeChallenges.noMoney ? '0' : '100'} de inicio e item: ${run.item}.`,
        ...challengeDescriptions,
      ])
      setScreen('route')
      startBattleMusic()
    } catch {
      setApiError('No se pudo cargar PokeAPI. Reintenta en unos segundos.')
    } finally {
      setIsLoading(false)
    }
  }

  function completeCurrentNode(): void {
    setRestEncounter(null)
    setRestRewardItem('')
    if (speedrunTimerRef.current) {
      clearInterval(speedrunTimerRef.current)
      speedrunTimerRef.current = null
    }
    setSpeedrunSeconds(0)
    setRoute((previous) =>
      previous.map((node, index) => (index === routeIndex ? { ...node, done: true } : node))
    )

    if (routeIndex >= route.length - 1) {
      if (difficulty === 'infinite') {
        const nextId = route.length + 1
        const batch = Array.from({ length: 5 }, (_, k) => generateRandomNodeType(nextId + k))
        setRoute((previous) => [...previous, ...batch])
        setBattleLog((prev) => [
          `♾️ ¡Modo Infinite! Aparecen 5 nuevas rutas...`,
          ...prev
        ].slice(0, 15))
        setRouteIndex((previous) => previous + 1)
        setScreen('route')
        return
      }

      const wins = record.wins + 1
      persistRecord(wins, record.losses)

      // Actualizar progresión de desbloqueos
      const genPlayed = currentRunGen
      const isMediumOrHard = difficulty === 'medium' || difficulty === 'hard'

      const newlyUnlockedHard = !progression.completedAny.includes(genPlayed)
      const newlyUnlockedNextGen = isMediumOrHard && genPlayed < 9 && !progression.completedMedium.includes(genPlayed)
      const newlyUnlockedInfinite = difficulty === 'hard' && !progression.completedHard.includes(genPlayed)

      const nextCompletedAny = Array.from(new Set([...progression.completedAny, genPlayed]))
      const nextCompletedMedium = isMediumOrHard
        ? Array.from(new Set([...progression.completedMedium, genPlayed]))
        : progression.completedMedium
      const nextCompletedHard = difficulty === 'hard'
        ? Array.from(new Set([...progression.completedHard, genPlayed]))
        : progression.completedHard

      const updatedProgression: ProgressionData = {
        completedAny: nextCompletedAny,
        completedMedium: nextCompletedMedium,
        completedHard: nextCompletedHard
      }

      localStorage.setItem('pokerand_progression', JSON.stringify(updatedProgression))
      setProgression(updatedProgression)

      setVictoryUnlocks({
        genName: generationRegions[genPlayed],
        nextGenNumber: newlyUnlockedNextGen ? genPlayed + 1 : null,
        nextGenName: newlyUnlockedNextGen ? generationRegions[genPlayed + 1] : null,
        unlockedHard: newlyUnlockedHard,
        unlockedInfinite: newlyUnlockedInfinite
      })

      setScreen('victory')
      playVictoryFanfare()
      return
    }

    setRouteIndex((previous) => previous + 1)
    setScreen('route')
  }

  function pickRocketPokemon(pokemon: Pokemon): void {
    if (runChallenges.soloStarter) {
      setBattleLog((prev) => ['🚫 Desafío Solo Starter: No puedes capturar Pokémon.', ...prev].slice(0, 15))
      setTeamRocketPickModal(false)
      setTeamRocketTeam([])
      completeCurrentNode()
      return
    }
    if (runChallenges.fixedTeam) {
      setBattleLog((prev) => ['🔒 Desafío Equipo Fijo: No puedes cambiar tu equipo.', ...prev].slice(0, 15))
      setTeamRocketPickModal(false)
      setTeamRocketTeam([])
      completeCurrentNode()
      return
    }
    let captured = { ...pokemon, hp: Math.floor(pokemon.maxHp / 2) }
    if (runChallenges.noEvolution) captured = applyNoEvolutionBuff(captured)
    if (runChallenges.fixedLevel) captured = { ...captured, level: 50 }
    registerInPokedex(captured)
    if (team.length >= 6) {
      const faintedIndex = team.findIndex((p) => p.hp <= 0)
      if (faintedIndex !== -1) {
        const newTeam = [...team]
        newTeam[faintedIndex] = captured
        setTeam(newTeam)
        setBattleLog((prev) => [
          `✅ ¡${pokemon.name} reemplazó a ${team[faintedIndex].name} (borrado)!`,
          ...prev
        ].slice(0, 15))
      } else {
        setPcStorage((prev) => [...prev, captured])
        setBattleLog((prev) => [
          `✅ ¡${pokemon.name} se envió al PC (equipo lleno)!`,
          ...prev
        ].slice(0, 15))
      }
    } else {
      setTeam((prev) => [...prev, captured])
      setBattleLog((prev) => [
        `✅ ¡${pokemon.name} se unió a tu equipo!`,
        ...prev
      ].slice(0, 15))
    }
    setTeamRocketPickModal(false)
    setTeamRocketTeam([])
    completeCurrentNode()
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

  function withdrawFromPC(pcIndex: number): void {
    const pokemon = pcStorage[pcIndex]
    if (!pokemon) return
    if (runChallenges.soloStarter || runChallenges.fixedTeam) {
      setBattleLog((prev) => ['🚫 No puedes modificar tu equipo con este desafío.', ...prev].slice(0, 15))
      return
    }
    if (team.length < maxTeamSize) {
      setTeam((prev) => [...prev, pokemon])
      setPcStorage((prev) => prev.filter((_, i) => i !== pcIndex))
      setBattleLog((prev) => [`📦 ${pokemon.name} pasó del PC al equipo.`, ...prev].slice(0, 15))
    } else {
      const swapOut = team[activeIndex]
      const newTeam = team.map((p, i) => i === activeIndex ? pokemon : p)
      setTeam(newTeam)
      setPcStorage((prev) => prev.map((p, i) => i === pcIndex ? swapOut : p))
      setBattleLog((prev) => [`📦 Intercambiaste a ${swapOut.name} por ${pokemon.name} del PC.`, ...prev].slice(0, 15))
    }
  }

  function depositToPC(teamIndex: number): void {
    const pokemon = team[teamIndex]
    if (!pokemon) return
    if (runChallenges.soloStarter || runChallenges.fixedTeam) {
      setBattleLog((prev) => ['🚫 No puedes modificar tu equipo con este desafío.', ...prev].slice(0, 15))
      return
    }
    if (team.length <= 1) {
      setBattleLog((prev) => ['No puedes depositar a tu único Pokémon.', ...prev].slice(0, 15))
      return
    }
    setPcStorage((prev) => [...prev, pokemon])
    const newTeam = team.filter((_, i) => i !== teamIndex)
    setTeam(newTeam)
    if (activeIndex >= newTeam.length) {
      const healthyIdx = newTeam.findIndex((p) => p.hp > 0)
      setActiveIndex(healthyIdx !== -1 ? healthyIdx : 0)
    } else if (teamIndex < activeIndex) {
      setActiveIndex((prev) => Math.max(0, prev - 1))
    }
    setBattleLog((prev) => [`📦 ${pokemon.name} fue depositado en el PC.`, ...prev].slice(0, 15))
  }

  async function handleEvolveTarget(index: number): Promise<void> {
    const targetPokemon = team[index]
    if (!targetPokemon) return

    if (runChallenges.noEvolution) {
      setBattleLog((prev) => ['🚫 Desafío Sin Evolución: No puedes evolucionar Pokémon.', ...prev].slice(0, 15))
      return
    }

    setIsLoading(true)
    setApiError('')

    try {
      const evolvedBase = await evolvePokemon(targetPokemon)

      if (!evolvedBase) {
        setApiError(`${targetPokemon.name} no puede evolucionar más.`)
        return
      }

      // BONUS POR EVOLUCIÓN: +2 Nivel extra y mejora de estadísticas + cura completa
      const extraLevels = 2
      const bonusHp = 15
      const newLevel = evolvedBase.level + extraLevels
      const newMaxHp = evolvedBase.maxHp + bonusHp
      const hpRatio = targetPokemon.maxHp > 0 ? targetPokemon.hp / targetPokemon.maxHp : 1

      const evolvedPlusBoost: Pokemon = {
        ...evolvedBase,
        level: runChallenges.fixedLevel ? 50 : newLevel,
        maxHp: newMaxHp,
        hp: runChallenges.noHealing ? Math.max(1, Math.floor(newMaxHp * hpRatio)) : newMaxHp,
        attack: Math.round(evolvedBase.attack * 1.15), // +15% Ataque
        defense: Math.round(evolvedBase.defense * 1.15), // +15% Defensa
        speed: Math.round(evolvedBase.speed * 1.10)   // +10% Velocidad
      }

      // Comprobar si al subir este nivel aprende un ataque nuevo
      const { updatedPokemon: finalEvolved } = await checkAndLearnNewMove(
        evolvedPlusBoost,
        targetPokemon.level,
        runChallenges.fixedLevel ? 50 : newLevel,
        difficulty
      )

      registerInPokedex(finalEvolved)

      setTeam((prevTeam) =>
        prevTeam.map((p, i) => (i === index ? finalEvolved : p))
      )

      setBattleLog((prev) => [
        `✨ ¡${targetPokemon.name} evolucionó en ${finalEvolved.name}! (Nv.${finalEvolved.level} + Stats boosted)`,
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
      const allConsumableKeys = Object.keys(ALL_SHOP_ITEMS)
      const allHoldableKeys = HOLDABLE_ITEM_NAMES
      const shuffledConsumables = [...allConsumableKeys].sort(() => 0.5 - Math.random())
      const shuffledHoldables = [...allHoldableKeys].sort(() => 0.5 - Math.random())
      const selectedConsumables = shuffledConsumables.slice(0, 2)
      const selectedHoldables = shuffledHoldables.slice(0, 1)
      setShopStock([...selectedConsumables, ...selectedHoldables])
      if (runChallenges.noPurchasing) {
        setBattleLog((prev) => [
          `🚫 Desafío Sin Compras: No puedes comprar nada en la tienda.`,
          ...prev
        ].slice(0, 15))
      }
      const potionBonus = modifier?.shopPotionBonus ?? 0
      if (potionBonus > 0) {
        setInventory((prev) => [...prev, ...Array(potionBonus).fill('Potion')])
        setBattleLog((prev) => [
          `Mercado en Oferta: ¡Recibes ${potionBonus} Poción${potionBonus > 1 ? 'es' : ''} gratis!`,
          ...prev
        ].slice(0, 15))
      }
      setScreen('shop')
      return
    }

    if (currentNode.type === 'spin') {
      const healingPool = Object.keys(ALL_SHOP_ITEMS)
      const passivePool = HOLDABLE_ITEM_NAMES
      const shuffledH = [...healingPool].sort(() => 0.5 - Math.random())
      const shuffledP = [...passivePool].sort(() => 0.5 - Math.random())
      const items = [...shuffledH.slice(0, 4), ...shuffledP.slice(0, 2)].sort(() => 0.5 - Math.random())
      setSpinItems(items)
      setSpinWinnerIndex(null)
      setSpinRevealed(false)
      setSpinAnimating(false)
      setScreen('spin')
      return
    }

    if (currentNode.type === 'pokeRand') {
      setIsLoading(true)
      setApiError('')
      try {
        const targetGen = getEffectiveGen()
        const fetches = Array.from({ length: 6 }, () =>
          getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty)
        )
        const pokemonList = await Promise.all(fetches)
        setPokeRandPokemon(pokemonList)
        setPokeRandWinnerIndex(null)
        setPokeRandRevealed(false)
        setPokeRandAnimating(false)
        setScreen('pokeRand')
      } catch {
        setApiError('No se pudieron generar Pokémon. Reintenta.')
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (currentNode.type === 'move') {
      setIsLoading(true)
      setApiError('')
      setSelectedNewMove(null)
      setMoveOptionsByIndex({})
      try {
        const pokemon = team[activeIndex]
        if (!pokemon || !pokemon.rawLevelUpMoves || pokemon.rawLevelUpMoves.length === 0) {
          setBattleLog((prev) => ['Tu Pokémon no tiene movimientos disponibles para aprender.', ...prev].slice(0, 15))
          completeCurrentNode()
          setScreen('route')
          return
        }
        const currentMoveUrls = new Set(pokemon.moves.map(m => m.url).filter(Boolean))
        const learnable = pokemon.rawLevelUpMoves.filter(m => !currentMoveUrls.has(m.url))
        const pool = learnable.length >= 2 ? learnable : [...learnable, ...pokemon.rawLevelUpMoves.filter(m => currentMoveUrls.has(m.url))]
        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 10)
        const allDetails = (await Promise.all(shuffled.map(m => getMoveDetails(m.url)))).filter((m): m is Move => m !== null)
        const moveDetails = allDetails.slice(0, 2)
        if (moveDetails.length === 0) {
          setBattleLog((prev) => ['No se encontraron movimientos compatibles.', ...prev].slice(0, 15))
          completeCurrentNode()
          setScreen('route')
          return
        }
        setMoveOptions(moveDetails)
        setMoveOptionsByIndex({ [activeIndex]: moveDetails })
        setScreen('move')
      } catch {
        setApiError('No se pudieron cargar los movimientos. Reintenta.')
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (currentNode.type === 'rest') {
    setIsLoading(true)
    setApiError('')

    const effectiveGen = getEffectiveGen()
    const challengesUnlocked = effectiveGen === 0
      ? generations.every((g) => progression.completedMedium.includes(g))
      : progression.completedMedium.includes(effectiveGen)

    if (!challengesUnlocked) {
      setRunChallenges({ noShops: false, noRests: false, allShiny: false, allTeamRocket: false, nuzlocke: false, soloStarter: false, fixedTeam: false, noEvolution: false, noItems: false, restrictedMoves: false, firstStrike: false, fixedLevel: false, noCrits: false, typeRandomizer: false, noPurchasing: false, blindRoute: false, bossRush: false, speedrun: false, noMoney: false, doubleModifiers: false, scalingEnemies: false, noHealing: false, ironman: false, totalRandomizer: false, nuzlockeHardcore: false, challengeGauntlet: false, egglocke: false })
    }

    try {
      const targetGen = getEffectiveGen()
        const restPokemonBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty)

        if (runChallenges.egglocke) {
          const eggId = Math.floor(Math.random() * 900) + 1
          const eggEntry = {
            name: restPokemonBase.name,
            sprite: restPokemonBase.sprite,
            types: (restPokemonBase as any).types ?? ['normal'],
            hatchIn: 2 + Math.floor(Math.random() * 2),
            id: eggId
          }
          setEggInventory(prev => [...prev, eggEntry])
          const rewardItem = runChallenges.noHealing
            ? randomFrom(['X Attack', 'X Defense', 'Rare Candy'])
            : randomFrom(['Potion', 'Super Potion', 'X Attack', 'Oran Berry'])
          setRestRewardItem(rewardItem)
          setInventory((previous) => [...previous, rewardItem])
          setBattleLog((prev) => [
            `${currentNode.label}: ¡Obtuviste un Huevo de ${eggEntry.name}! (Eclosiona en ${eggEntry.hatchIn} battles)`,
            `También obtienes ${rewardItem}.`,
            ...prev
          ].slice(0, 15))
          completeCurrentNode()
          setScreen('route')
          return
        }

        const generatedEncounter = scalePokemonForNode(restPokemonBase, currentNode, routeIndex, modifier?.enemyLevelDelta ?? 0, difficulty)
        const rewardItem = runChallenges.noHealing
          ? randomFrom(['X Attack', 'X Defense', 'Rare Candy'])
          : randomFrom(['Potion', 'Super Potion', 'X Attack', 'Oran Berry'])

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
      const isTeamRocket = currentNode.type === 'teamRocket'

      const extraEnemyLevels = runChallenges.scalingEnemies ? routeIndex : 0

      if (isTeamRocket) {
        const progress = routeIndex / Math.max(1, route.length - 1)
        const teamSize = Math.max(2, Math.min(4, 2 + Math.floor(progress * 3)))

        const fetches = Array.from({ length: teamSize }, () =>
          getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty)
            .then((base) => {
              let scaled = scalePokemonForNode(base, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + extraEnemyLevels , difficulty)
              if (runChallenges.fixedLevel) scaled = { ...scaled, level: 50 }
              if (runChallenges.totalRandomizer) {
                scaled = {
                  ...scaled,
                  attack: scaled.attack + Math.floor(Math.random() * 20) - 10,
                  defense: scaled.defense + Math.floor(Math.random() * 20) - 10,
                  speed: scaled.speed + Math.floor(Math.random() * 20) - 10,
                }
              }
              return scaled
            })
        )
        const rocketTeam = await Promise.all(fetches)

        setIsTrainerBattle(true)
        setTrainerTeam(rocketTeam)
        setTrainerPokemonIndex(0)
        setTrainerName('TeamR Grunt')
        setTrainerSprite("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='12' fill='%23111'/%3E%3Ctext x='48' y='62' font-family='Arial Black,Arial' font-size='52' font-weight='900' fill='%23ef4444' text-anchor='middle'%3ER%3C/text%3E%3Ccircle cx='48' cy='80' r='3' fill='%23ef4444'/%3E%3C/svg%3E")
        setTrainerBadge('')
        setEnemy(rocketTeam[0])
        setIsTeamRocketBattle(true)
        setTeamRocketFainted(false)
        setTeamRocketTeam(rocketTeam)
        setTeamRocketStealMessage('')
        setTeamRocketPickModal(false)
        setBattleLog((prev) => [
          `🔴 ¡Un TeamR Grunt te desafía! Tiene ${teamSize} Pokémon.`,
          `Envía a ${rocketTeam[0].name} Nv.${rocketTeam[0].level}.`,
          ...prev
        ])
      } else {
        const willBeTrainer = isBoss || Math.random() < 0.5

      if (willBeTrainer) {
        const progress = routeIndex / Math.max(1, route.length - 1)
        const maxSize = isBoss ? 6 : Math.max(1, Math.min(6, Math.floor(progress * 6) + 1))
        const teamSize = isBoss ? maxSize : Math.max(1, Math.min(maxSize, 1 + Math.floor(Math.random() * maxSize)))

        const fetches = Array.from({ length: teamSize }, () =>
          getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, isBoss, runChallenges.allShiny, difficulty)
            .then((base) => {
              let scaled = scalePokemonForNode(base, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + extraEnemyLevels , difficulty)
              if (runChallenges.fixedLevel) scaled = { ...scaled, level: 50 }
              if (runChallenges.totalRandomizer) {
                scaled = {
                  ...scaled,
                  attack: scaled.attack + Math.floor(Math.random() * 20) - 10,
                  defense: scaled.defense + Math.floor(Math.random() * 20) - 10,
                  speed: scaled.speed + Math.floor(Math.random() * 20) - 10,
                }
              }
              return scaled
            })
        )
        const newTrainerTeam = await Promise.all(fetches)

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
        const enemyBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty)
        let generatedEnemy = scalePokemonForNode(enemyBase, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + extraEnemyLevels , difficulty)
        if (runChallenges.fixedLevel) generatedEnemy = { ...generatedEnemy, level: 50 }
        if (runChallenges.totalRandomizer) {
          generatedEnemy = {
            ...generatedEnemy,
            attack: generatedEnemy.attack + Math.floor(Math.random() * 20) - 10,
            defense: generatedEnemy.defense + Math.floor(Math.random() * 20) - 10,
            speed: generatedEnemy.speed + Math.floor(Math.random() * 20) - 10,
          }
        }
        setIsTrainerBattle(false)
        setTrainerTeam([])
        setTrainerPokemonIndex(0)
        setTrainerName('')
        setTrainerSprite('')
    setTrainerBadge('')
    setReviveModal(null)
    setEquipModal(null)
        setEnemy(generatedEnemy)
        setBattleLog((prev) => [
          `🌿 ¡Un ${generatedEnemy.name} salvaje (Nv.${generatedEnemy.level}) apareció!`,
          ...prev
        ])
      }
      }

      setScreen('battle')

      if (runChallenges.speedrun) {
        setSpeedrunSeconds(30)
        if (speedrunTimerRef.current) clearInterval(speedrunTimerRef.current)
        speedrunTimerRef.current = setInterval(() => {
          setSpeedrunSeconds(prev => {
            if (prev <= 1) {
              if (speedrunTimerRef.current) clearInterval(speedrunTimerRef.current)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } catch {
      setApiError('No se pudo generar rival desde PokeAPI. Reintenta.')
    } finally {
      setIsLoading(false)
    }
  }

  function spinRoulette(): void {
    if (spinAnimating || spinRevealed) return
    setSpinAnimating(true)
    setSpinWinnerIndex(null)
    setSpinRevealed(false)

    const winner = Math.floor(Math.random() * spinItems.length)
    const spinDuration = 3000
    const startTime = Date.now()

    function tick() {
      const elapsed = Date.now() - startTime
      if (elapsed < spinDuration) {
        setSpinWinnerIndex(Math.floor(Math.random() * spinItems.length))
        requestAnimationFrame(tick)
      } else {
        setSpinWinnerIndex(winner)
    setSpinAnimating(false)
    setPokeRandPokemon([])
    setPokeRandWinnerIndex(null)
    setPokeRandRevealed(false)
    setPokeRandAnimating(false)
        setSpinRevealed(true)
      }
    }
    requestAnimationFrame(tick)
  }

  function claimSpinItem(): void {
    if (spinWinnerIndex === null) return
    const item = spinItems[spinWinnerIndex]
    setInventory((prev) => [...prev, item])
    setBattleLog((prev) => [
      `🎰 ¡Giraste la Ruleta y obtuviste ${item}!`,
      ...prev
    ].slice(0, 15))
    completeCurrentNode()
    setScreen('route')
  }

  function pokeRandSpin(): void {
    if (pokeRandAnimating || pokeRandRevealed) return
    setPokeRandAnimating(true)
    setPokeRandWinnerIndex(null)
    setPokeRandRevealed(false)

    const winner = Math.floor(Math.random() * pokeRandPokemon.length)
    const spinDuration = 3000
    const startTime = Date.now()

    function tick() {
      const elapsed = Date.now() - startTime
      if (elapsed < spinDuration) {
        setPokeRandWinnerIndex(Math.floor(Math.random() * pokeRandPokemon.length))
        requestAnimationFrame(tick)
      } else {
        setPokeRandWinnerIndex(winner)
        setPokeRandAnimating(false)
        setPokeRandRevealed(true)
      }
    }
    requestAnimationFrame(tick)
  }

  function claimPokeRandPokemon(): void {
    if (pokeRandWinnerIndex === null) return
    let pokemon = pokeRandPokemon[pokeRandWinnerIndex]
    if (runChallenges.soloStarter) {
      setBattleLog((prev) => ['🚫 Desafío Solo Starter: No puedes capturar Pokémon.', ...prev].slice(0, 15))
      return
    }
    if (runChallenges.fixedTeam) {
      setBattleLog((prev) => ['🔒 Desafío Equipo Fijo: No puedes cambiar tu equipo.', ...prev].slice(0, 15))
      return
    }
    if (runChallenges.noEvolution) pokemon = applyNoEvolutionBuff(pokemon)
    if (runChallenges.fixedLevel) pokemon = { ...pokemon, level: 50 }
    if (team.length >= maxTeamSize) {
      setPcStorage((prev) => [...prev, pokemon])
      registerInPokedex(pokemon)
      setBattleLog((prev) => [
        `🎲 ¡PokeRand: ${pokemon.name} se envió al PC (equipo lleno)!`,
        ...prev
      ].slice(0, 15))
    } else {
      setTeam((prev) => [...prev, pokemon])
      registerInPokedex(pokemon)
      setBattleLog((prev) => [
        `🎲 ¡PokeRand: ${pokemon.name} se unió a tu equipo!`,
        ...prev
      ].slice(0, 15))
    }
    completeCurrentNode()
    setScreen('route')
  }

  function skipPokeRandPokemon(): void {
    setBattleLog((prev) => [
      `🎲 ¡PokeRand: decidiste no capturar al Pokémon.`,
      ...prev
    ].slice(0, 15))
    completeCurrentNode()
    setScreen('route')
  }

  function replaceTeamMove(moveIndex: number): void {
    if (!selectedNewMove || !activePokemon) return
    const nextTeam = team.map((pokemon, index) => {
      if (index !== activeIndex) return pokemon
      const newMoves = [...pokemon.moves]
      const oldName = newMoves[moveIndex].name
      newMoves[moveIndex] = selectedNewMove
      return { ...pokemon, moves: newMoves }
    })
    setTeam(nextTeam)
    setBattleLog((prev) => [
      `📝 ¡${activePokemon.name} reemplazó ${activePokemon.moves[moveIndex].name} por ${selectedNewMove.name}!`,
      ...prev
    ].slice(0, 15))
    setMoveOptions([])
    setSelectedNewMove(null)
    setMoveOptionsByIndex({})
    completeCurrentNode()
    setScreen('route')
  }

  function skipMoveNode(): void {
    setBattleLog((prev) => [
      `📝 Decidiste no cambiar movimientos.`,
      ...prev
    ].slice(0, 15))
    setMoveOptions([])
    setSelectedNewMove(null)
    setMoveOptionsByIndex({})
    completeCurrentNode()
    setScreen('route')
  }

  function buyShopItem(itemName: string) {
    if (runChallenges.noPurchasing) {
      setBattleLog((prev) => ['🚫 Desafío Sin Compras: No puedes comprar nada.', ...prev].slice(0, 15))
      return
    }
    const item = ALL_SHOP_ITEMS[itemName]
    if (!item) return
    const discount = modifier?.shopDiscount ?? 0
    const hardMarkup = difficulty === 'hard' ? 1.4 : difficulty === 'infinite' ? 1.5 : 1
    const finalPrice = Math.floor(item.price * (1 - discount) * hardMarkup)
    if (money < finalPrice) return

    setMoney((prev) => prev - finalPrice)
    setInventory((prev) => [...prev, itemName])
    setBattleLog((prev) => [`Compraste ${itemName} por $${finalPrice}.`, ...prev].slice(0, 15))
  }

  function buyHoldableItem(itemName: string) {
    if (runChallenges.noPurchasing) {
      setBattleLog((prev) => ['🚫 Desafío Sin Compras: No puedes comprar nada.', ...prev].slice(0, 15))
      return
    }
    const item = HOLDABLE_ITEMS[itemName]
    if (!item) return
    const discount = modifier?.shopDiscount ?? 0
    const hardMarkup = difficulty === 'hard' ? 1.4 : difficulty === 'infinite' ? 1.5 : 1
    const finalPrice = Math.floor(item.price * (1 - discount) * hardMarkup)
    if (money < finalPrice) return

    setMoney((prev) => prev - finalPrice)
    setInventory((prev) => [...prev, itemName])
    setBattleLog((prev) => [`Compraste ${itemName} por $${finalPrice}.`, ...prev].slice(0, 15))
  }

  function equipItem(itemName: string, pokemonIndex: number) {
    const pokemon = team[pokemonIndex]
    if (!pokemon || pokemon.hp <= 0) return
    if (!HOLDABLE_ITEMS[itemName]) return

    const itemIdx = inventory.indexOf(itemName)
    if (itemIdx === -1) return

    setTeam((prev) =>
      prev.map((p, i) => {
        if (i !== pokemonIndex) return p
        const stats = HOLDABLE_ITEMS[itemName]
        let updated: Pokemon = {
          ...p,
          holdItem: itemName,
          maxHp: p.maxHp + (stats.maxHpMod ?? 0),
          hp: Math.min(p.hp + (stats.maxHpMod ?? 0), p.maxHp + (stats.maxHpMod ?? 0)),
        }
        return updated
      })
    )
    setInventory((prev) => {
      const idx = prev.indexOf(itemName)
      if (idx === -1) return prev
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
    })
    setBattleLog((prev) => [`Equipaste ${itemName} a ${pokemon.name}.`, ...prev].slice(0, 15))
  }

  function unequipItem(pokemonIndex: number) {
    const pokemon = team[pokemonIndex]
    if (!pokemon || !pokemon.holdItem) return

    const itemName = pokemon.holdItem
    const stats = HOLDABLE_ITEMS[itemName]

    setTeam((prev) =>
      prev.map((p, i) => {
        if (i !== pokemonIndex) return p
        return {
          ...p,
          holdItem: null,
          maxHp: Math.max(1, p.maxHp - (stats?.maxHpMod ?? 0)),
          hp: Math.max(1, Math.min(p.hp, p.maxHp - (stats?.maxHpMod ?? 0))),
        }
      })
    )
    setInventory((prev) => [...prev, itemName])
    setBattleLog((prev) => [`Desequipaste ${itemName} de ${pokemon.name}.`, ...prev].slice(0, 15))
  }

  function healTeamAtShop() {
    if (runChallenges.noHealing) {
      setBattleLog((prev) => ['🚫 Desafío Sin Curación: No puedes curar en tienda.', ...prev].slice(0, 15))
      return
    }
    if (runChallenges.noPurchasing) {
      setBattleLog((prev) => ['🚫 Desafío Sin Compras: No puedes comprar curación.', ...prev].slice(0, 15))
      return
    }
    const baseHealCost = 100
    const hardMarkup = difficulty === 'hard' ? 1.4 : difficulty === 'infinite' ? 1.5 : 1
    const healCost = Math.floor(baseHealCost * (1 - (modifier?.shopDiscount ?? 0)) * hardMarkup)
    const needsHealing = team.some((pkmn) => pkmn.hp > 0 && pkmn.hp < pkmn.maxHp)

    if (!needsHealing || money < healCost) return

    const healReduction = modifier?.healReduction ?? 0
    const healBonus = modifier?.healBonus ?? 0

    setMoney((prev) => prev - healCost)
    setTeam((prevTeam) =>
      prevTeam.map((pkmn) => {
        if (pkmn.hp <= 0) return pkmn
        const missing = pkmn.maxHp - pkmn.hp
        const healed = Math.floor(missing * (1 - healReduction)) + healBonus
        return { ...pkmn, hp: Math.min(pkmn.maxHp, pkmn.hp + Math.max(0, healed)) }
      })
    )
    setBattleLog((prev) => [`Restauraste la salud de tu equipo activo por $${healCost}.`, ...prev].slice(0, 15))
  }

  function performHit(
    attacker: Pokemon,
    defender: Pokemon,
    move: Move,
    isEnemyHit: boolean
  ): { updatedDefender: Pokemon; line: string; attackerHeal: number; recoilDamage: number } {
    const enemyBoost = isEnemyHit ? modifier?.enemyAttackDelta ?? 0 : 0

    const attackerItem = attacker.holdItem ? HOLDABLE_ITEMS[attacker.holdItem] : null
    const defenderItem = defender.holdItem ? HOLDABLE_ITEMS[defender.holdItem] : null

    const playerAtkMod = !isEnemyHit ? (modifier?.playerAttackMod ?? 0) : 0
    const playerSpdMod = !isEnemyHit ? (modifier?.playerSpeedMod ?? 0) : 0
    const playerDefMod = isEnemyHit ? (modifier?.playerDefenseMod ?? 0) : 0
    const enemyDefDelta = !isEnemyHit ? (modifier?.enemyDefenseDelta ?? 0) : 0
    const enemySpdDelta = isEnemyHit ? (modifier?.enemySpeedDelta ?? 0) : 0

    const effectiveAttacker: Pokemon = {
      ...attacker,
      attack: Math.round(attacker.attack * (1 + (attackerItem?.attackMod ?? 0) + playerAtkMod)),
      speed: Math.round(attacker.speed * (1 + (attackerItem?.speedMod ?? 0) + playerSpdMod) + enemySpdDelta)
    }
    const effectiveDefender: Pokemon = {
      ...defender,
      defense: Math.round(defender.defense * (1 + (defenderItem?.defenseMod ?? 0) + playerDefMod) + enemyDefDelta)
    }

    const effectiveMove = runChallenges.typeRandomizer
      ? { ...move, type: randomFrom(ALL_TYPES) }
      : move

    const defTypes = (effectiveDefender as any).types ?? []
    const primaryType = defTypes[0] || 'normal'
    const secondaryType = defTypes[1] || undefined

    const { effectiveness, message } = getTypeEffectiveness(effectiveMove.type, primaryType, secondaryType)
    const result = applyDamage(effectiveAttacker, effectiveDefender, effectiveMove, enemyBoost)

    let finalDamage = Math.floor(result.damage * effectiveness)
    if (attackerItem?.damageBoost) {
      finalDamage = Math.floor(finalDamage * (1 + attackerItem.damageBoost))
    }
    if (attackerItem?.lowHpBonus && attacker.hp < attacker.maxHp * 0.3) {
      finalDamage = Math.floor(finalDamage * (1 + attackerItem.lowHpBonus))
    }
    if (attackerItem?.firstStrikeBonus && attacker.hp === attacker.maxHp) {
      finalDamage = Math.floor(finalDamage * (1 + attackerItem.firstStrikeBonus))
    }
    if (defenderItem?.damageReduction) {
      finalDamage = Math.floor(finalDamage * (1 - defenderItem.damageReduction))
    }

    const modCrit = !isEnemyHit ? (modifier?.playerCritChance ?? 0) : 0
    const totalCrit = (attackerItem?.critChance ?? 0) + modCrit
    const isCrit = !runChallenges.noCrits && totalCrit > 0 && Math.random() < totalCrit
    if (isCrit) {
      finalDamage = Math.floor(finalDamage * 1.5)
    }

    const newHp = Math.max(0, defender.hp - finalDamage)

    const updatedDefender: Pokemon = {
      ...defender,
      hp: newHp
    }

    const modLifesteal = !isEnemyHit ? (modifier?.playerLifesteal ?? 0) : 0
    const totalLifesteal = (attackerItem?.lifesteal ?? 0) + modLifesteal
    let attackerHeal = 0
    if (totalLifesteal > 0 && finalDamage > 0) {
      attackerHeal = Math.floor(finalDamage * totalLifesteal)
    }

    let recoilDamage = 0

    let line = `${attacker.name} usa ${effectiveMove.name}${runChallenges.typeRandomizer && effectiveMove.type !== move.type ? ` [${effectiveMove.type}]` : ''}: ${finalDamage} de daño.`
    if (isCrit) line += ' ¡Golpe crítico!'
    if (message) {
      line += ` (${message})`
    }

    return {
      updatedDefender,
      line,
      attackerHeal,
      recoilDamage
    }
  }

  async function onPlayerMove(move: Move): Promise<void> {
    if (!activePokemon || !enemy) return

    if (runChallenges.speedrun && speedrunSeconds <= 0) {
      setBattleLog((prev) => ['⏱️ ¡Se acabó el tiempo! Pierdes tu turno.', ...prev].slice(0, 15))
      return
    }

    const nextTeam = team.map((pokemon, index) => (index === activeIndex ? { ...pokemon } : pokemon))
    let nextPlayer = { ...nextTeam[activeIndex] }
    let nextEnemy = { ...enemy }
    const logs: string[] = []

    const playerItem = nextPlayer.holdItem ? HOLDABLE_ITEMS[nextPlayer.holdItem] : null
    const enemyItem = nextEnemy.holdItem ? HOLDABLE_ITEMS[nextEnemy.holdItem] : null
    const playerEffectiveSpeed = Math.round(nextPlayer.speed * (1 + (playerItem?.speedMod ?? 0)))
    const enemyEffectiveSpeed = Math.round(nextEnemy.speed * (1 + (enemyItem?.speedMod ?? 0)))

    const playerStarts = playerEffectiveSpeed >= enemyEffectiveSpeed

    if (playerStarts) {
      const playerHit = performHit(nextPlayer, nextEnemy, move, false)
      nextEnemy = playerHit.updatedDefender
      if (playerHit.attackerHeal > 0) {
        const healed = Math.min(nextPlayer.maxHp, nextPlayer.hp + playerHit.attackerHeal)
        nextPlayer = { ...nextPlayer, hp: healed }
        logs.push(`${nextPlayer.name} recupera ${playerHit.attackerHeal} HP por ${nextPlayer.holdItem ?? 'Vampirismo'}.`)
      }
      logs.push(playerHit.line)

      if (runChallenges.firstStrike && nextEnemy.hp > 0) {
        const recoil = Math.floor(nextPlayer.maxHp * 0.08)
        nextPlayer = { ...nextPlayer, hp: Math.max(1, nextPlayer.hp - recoil) }
        logs.push(`⚡ ¡Recoil por Primer Golpe! ${nextPlayer.name} pierde ${recoil} HP.`)
      }

      if (nextEnemy.hp > 0) {
        const enemyMove = nextEnemy.moves[Math.floor(Math.random() * nextEnemy.moves.length)]
        const enemyHit = performHit(nextEnemy, nextPlayer, enemyMove, true)
        nextPlayer = enemyHit.updatedDefender
        if (enemyHit.attackerHeal > 0) {
          const healed = Math.min(nextEnemy.maxHp, nextEnemy.hp + enemyHit.attackerHeal)
          nextEnemy = { ...nextEnemy, hp: healed }
          logs.push(`${nextEnemy.name} recupera ${enemyHit.attackerHeal} HP por ${nextEnemy.holdItem ?? 'Vampirismo'}.`)
        }
        logs.push(enemyHit.line)
      }
    } else {
      const enemyMove = nextEnemy.moves[Math.floor(Math.random() * nextEnemy.moves.length)]
      const enemyHit = performHit(nextEnemy, nextPlayer, enemyMove, true)
      nextPlayer = enemyHit.updatedDefender
      if (enemyHit.attackerHeal > 0) {
        const healed = Math.min(nextEnemy.maxHp, nextEnemy.hp + enemyHit.attackerHeal)
        nextEnemy = { ...nextEnemy, hp: healed }
        logs.push(`${nextEnemy.name} recupera ${enemyHit.attackerHeal} HP por ${nextEnemy.holdItem}.`)
      }
      logs.push(enemyHit.line)

      if (nextPlayer.hp > 0) {
        const playerHit = performHit(nextPlayer, nextEnemy, move, false)
        nextEnemy = playerHit.updatedDefender
        if (playerHit.attackerHeal > 0) {
          const healed = Math.min(nextPlayer.maxHp, nextPlayer.hp + playerHit.attackerHeal)
          nextPlayer = { ...nextPlayer, hp: healed }
          logs.push(`${nextPlayer.name} recupera ${playerHit.attackerHeal} HP por ${nextPlayer.holdItem ?? 'Vampirismo'}.`)
        }
        logs.push(playerHit.line)

        if (runChallenges.firstStrike && nextEnemy.hp > 0) {
          const recoil = Math.floor(nextPlayer.maxHp * 0.08)
          nextPlayer = { ...nextPlayer, hp: Math.max(1, nextPlayer.hp - recoil) }
          logs.push(`⚡ ¡Recoil por Primer Golpe! ${nextPlayer.name} pierde ${recoil} HP.`)
        }
      }
    }

    // --- Efectos pasivos por turno ---
    const modHealBonus = modifier?.healBonus ?? 0
    const modHealReduction = modifier?.healReduction ?? 0
    const applyTurnEffects = (p: Pokemon): Pokemon => {
      const item = p.holdItem ? HOLDABLE_ITEMS[p.holdItem] : null
      if (!item) return p
      let updated = { ...p }
      if (item.healPerTurn && updated.hp > 0) {
        let healAmount = item.healPerTurn
        if (healAmount > 0) {
          healAmount = Math.floor(healAmount * (1 - modHealReduction)) + modHealBonus
        }
        const newHp = Math.min(updated.maxHp, updated.hp + healAmount)
        updated = { ...updated, hp: Math.max(1, newHp) }
        if (healAmount > 0) logs.push(`${updated.name} recupera ${healAmount} HP por ${item.name}.`)
        else logs.push(`${updated.name} pierde ${Math.abs(healAmount)} HP por ${item.name}.`)
      }
      return updated
    }

    nextPlayer = applyTurnEffects(nextPlayer)
    nextEnemy = applyTurnEffects(nextEnemy)

    // --- Jugador debilitado ---
    if (nextPlayer.hp <= 0) {
      nextTeam[activeIndex] = nextPlayer
      const nextAliveIndex = getFirstHealthyIndex(nextTeam, activeIndex)

      if (nextAliveIndex === -1) {
        const fullLogs = ['¡Todo tu equipo ha sido debilitado!', ...logs, ...battleLog]
        if (speedrunTimerRef.current) clearInterval(speedrunTimerRef.current)
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
        playDefeatMusic()
        return
      }

      if (runChallenges.nuzlocke) {
        const nuzlockeTeam = nextTeam.filter((_, idx) => idx !== activeIndex)
        const newActiveIdx = Math.min(activeIndex, nuzlockeTeam.length - 1)
        setTeam(nuzlockeTeam)
        setActiveIndex(Math.max(0, newActiveIdx))
        setBattleLog((prev) => [`💀 Nuzlocke: ${nextPlayer.name} fue debilitado y liberado.`, ...logs, ...prev].slice(0, 15))
      } else {
        setTeam(nextTeam)
        setActiveIndex(nextAliveIndex)
        setBattleLog((prev) => [`${nextPlayer.name} cayó debilitado.`, ...logs, ...prev].slice(0, 15))
      }
      if (isTeamRocketBattle) setTeamRocketFainted(true)
      setEnemy(nextEnemy)
      return
    }

    // --- Enemigo derrotado (EXP SHARE PARA TODO EL EQUIPO) ---
    if (nextEnemy.hp <= 0) {
      const levelDiff = nextEnemy.level - nextPlayer.level
      let baseLevelsGained = 1
      if (levelDiff > 0) baseLevelsGained = 1 + levelDiff
      else if (levelDiff < -2) baseLevelsGained = 1

      // Subida de nivel para TODOS los miembros vivos del equipo
      const updatedTeamPromises = nextTeam.map(async (pokemon) => {
        if (pokemon.hp <= 0) return pokemon

        const levelsGained = runChallenges.fixedLevel ? 0 : baseLevelsGained

        const hpGain = levelsGained * 3
        const atkGain = levelsGained * 2
        const defGain = levelsGained * 2
        const spdGain = levelsGained * 2
        const oldLevel = pokemon.level
        const newLevel = oldLevel + levelsGained
        const newMaxHp = pokemon.maxHp + hpGain

        let updatedPokemon: Pokemon = {
          ...pokemon,
          level: runChallenges.fixedLevel ? 50 : newLevel,
          maxHp: newMaxHp,
          hp: Math.min(newMaxHp, pokemon.hp + Math.round(newMaxHp * 0.10) + hpGain),
          attack: pokemon.attack + atkGain,
          defense: pokemon.defense + defGain,
          speed: pokemon.speed + spdGain
        }

        if (levelsGained > 0) {
          const { updatedPokemon: learnedPkmn } = await checkAndLearnNewMove(updatedPokemon, oldLevel, newLevel, difficulty)
          updatedPokemon = learnedPkmn
        }

        return updatedPokemon
      })

      const newTeam = await Promise.all(updatedTeamPromises)
      const pendingPc: Pokemon[] = []

      const baseMoneyReward = Math.floor((40 + nextEnemy.level * 5) / (isTrainerBattle ? trainerTeam.length : 1))
      const hardMoneyPenalty = difficulty === 'hard' ? 0.6 : difficulty === 'infinite' ? 0.5 : 1
      const moneyReward = runChallenges.noMoney ? 0 : Math.floor(baseMoneyReward * (modifier?.moneyMultiplier ?? 1) * hardMoneyPenalty)
      if (!runChallenges.noMoney) setMoney((prev) => prev + moneyReward)

      // Egglocke: hatch eggs after battle
      if (runChallenges.egglocke && eggInventory.length > 0) {
        const hatchedEggs: typeof eggInventory = []
        const remainingEggs: typeof eggInventory = []
        for (const egg of eggInventory) {
          if (egg.hatchIn <= 1) {
            hatchedEggs.push(egg)
          } else {
            remainingEggs.push({ ...egg, hatchIn: egg.hatchIn - 1 })
          }
        }
        if (hatchedEggs.length > 0) {
          for (const egg of hatchedEggs) {
            const built = await buildPokemonFromApi(egg.id, getEffectiveGen(), nextPlayer.level, false, difficulty)
            const hatchedPokemon: Pokemon = {
              ...built,
              level: runChallenges.fixedLevel ? 50 : nextPlayer.level,
            }
            registerInPokedex(hatchedPokemon)
            if (newTeam.filter(p => p.hp > 0).length < maxTeamSize) {
              newTeam.push(hatchedPokemon)
              logs.push(`🥚 ¡El Huevo de ${egg.name} ha eclosionado!`)
            } else {
              pendingPc.push(hatchedPokemon)
              logs.push(`🥚 El Huevo de ${egg.name} eclosionó y fue enviado al PC.`)
            }
          }
        }
        setEggInventory(remainingEggs)
      }

      if (pendingPc.length > 0) {
        setPcStorage((prev) => [...prev, ...pendingPc])
      }

      let logMsg = runChallenges.noMoney
        ? `Derrotaste a ${nextEnemy.name}. ¡Todo el equipo ganó experiencia!`
        : `Derrotaste a ${nextEnemy.name}. ¡Todo el equipo ganó experiencia! +$${moneyReward}`

      // --- Batalla de entrenador: enviar siguiente Pokémon ---
      if (isTrainerBattle) {
        const updatedTrainerTeam = trainerTeam.map((p, idx) => idx === trainerPokemonIndex ? nextEnemy : p)
        const nextTrainerIndex = updatedTrainerTeam.findIndex((p, idx) => idx > trainerPokemonIndex && p.hp > 0)

        if (nextTrainerIndex === -1) {
          const baseTotalReward = 40 + nextEnemy.level * 5 * trainerTeam.length
          const totalReward = Math.floor(baseTotalReward * (modifier?.moneyMultiplier ?? 1) * hardMoneyPenalty)
          setMoney((prev) => prev + totalReward)
          setTeam(newTeam)
          setTrainerTeam(updatedTrainerTeam)
          setEnemy(nextEnemy)

          if (isTeamRocketBattle) {
            setIsTeamRocketBattle(false)
            if (teamRocketFainted) {
              const aliveTeam = newTeam.filter((p) => p.hp > 0)
              if (aliveTeam.length > 0) {
                const stolen = aliveTeam[Math.floor(Math.random() * aliveTeam.length)]
                const remainingTeam = newTeam.filter((p) => p !== stolen)
                const msg = `🔴 ¡TeamR te robó a ${stolen.name}! Se lo llevan...`
                setTeamRocketStealMessage(msg)
                setBattleLog((prev) => [
                  msg,
                  `🏆 ¡Derrotaste al TeamR Grunt! +$${totalReward + moneyReward}`,
                  logMsg,
                  ...logs,
                  ...prev
                ].slice(0, 15))
                const hasAliveAfter = remainingTeam.some((p) => p.hp > 0)
                if (hasAliveAfter) {
                  setTeam(remainingTeam)
                  setTimeout(() => { setTeamRocketStealMessage(''); completeCurrentNode() }, 3000)
                } else {
                  setTimeout(() => {
                    setTeamRocketStealMessage('')
                    setTeam(remainingTeam)
                    setDefeatSummary({
                      finalTeam: remainingTeam,
                      battleLog: [`¡TeamR te dejó sin Pokémon vivos!`, ...battleLog],
                      enemy: nextEnemy,
                      lastNodeLabel: currentNode?.label
                    })
                    const losses = record.losses + 1
                    persistRecord(record.wins, losses)
                    setScreen('defeat')
                    playDefeatMusic()
                  }, 3000)
                }
                return
              }
            } else {
              const defeated = updatedTrainerTeam.filter((p) => p.hp <= 0)
              setTeamRocketTeam(defeated)
              setTeamRocketPickModal(true)
              setBattleLog((prev) => [
                `🏆 ¡Derrotaste al TeamR Grunt sin bajas! ¡Elige un Pokémon! +$${totalReward + moneyReward}`,
                logMsg,
                ...logs,
                ...prev
              ].slice(0, 15))
              setTeam(newTeam)
              return
            }
          }

          setBattleLog((prev) => [
            `🏆 ¡Derrotaste al entrenador ${trainerName}! +$${totalReward + moneyReward}`,
            logMsg,
            ...logs,
            ...prev
          ].slice(0, 15))
          completeCurrentNode()
          return
        }

        const nextPkmn = updatedTrainerTeam[nextTrainerIndex]
        setTrainerTeam(updatedTrainerTeam)
        setTrainerPokemonIndex(nextTrainerIndex)
        setEnemy(nextPkmn)
        setTeam(newTeam)
        setBattleLog((prev) => [
          `${trainerName} envía a ${nextPkmn.name} Nv.${nextPkmn.level}!`,
          logMsg,
          ...logs,
          ...prev
        ].slice(0, 15))
        return
      }

      // --- Batalla salvaje → victoria directa ---
      logMsg = `🌿 Derrotaste al ${nextEnemy.name} salvaje y ganaste $${moneyReward}. ¡Equipo fortalecido!`
      setTeam(newTeam)
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
    if (screen === 'move') {
      setSelectedNewMove(null)
      if (moveOptionsByIndex[index]) {
        setMoveOptions(moveOptionsByIndex[index])
      } else {
        setMoveOptions([])
        const pokemon = team[index]
        if (pokemon?.rawLevelUpMoves && pokemon.rawLevelUpMoves.length > 0) {
          const currentMoveUrls = new Set(pokemon.moves.map(m => m.url).filter(Boolean))
          const learnable = pokemon.rawLevelUpMoves.filter(m => !currentMoveUrls.has(m.url))
          const pool = learnable.length >= 2 ? learnable : [...learnable, ...pokemon.rawLevelUpMoves.filter(m => currentMoveUrls.has(m.url))]
          const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 10)
          Promise.all(shuffled.map(m => getMoveDetails(m.url))).then(moveDetails => {
            const filtered = moveDetails.filter((m): m is Move => m !== null).slice(0, 2)
            setMoveOptions(filtered)
            setMoveOptionsByIndex(prev => ({ ...prev, [index]: filtered }))
          })
        }
      }
    }
  }

  function useInventoryItem(itemName: string): void {
    const itemIndex = inventory.indexOf(itemName)
    if (itemIndex === -1) return
    if (HOLDABLE_ITEMS[itemName]) return

    if (runChallenges.noItems) {
      setBattleLog((prev) => ['🚫 Desafío Sin Objetos: No puedes usar items en batalla.', ...prev].slice(0, 15))
      return
    }

    if (runChallenges.noHealing && (itemName.includes('Potion') || itemName.includes('Berry') || itemName === 'Full Restore' || itemName === 'Full Heal')) {
      setBattleLog((prev) => ['🚫 Desafío Sin Curación: No puedes usar items de curación.', ...prev].slice(0, 15))
      return
    }

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

    if (runChallenges.soloStarter) {
      setBattleLog((prev) => ['🚫 Desafío Solo Starter: No puedes capturar Pokémon.', ...prev].slice(0, 15))
      return
    }

    if (runChallenges.fixedTeam) {
      setBattleLog((prev) => ['🔒 Desafío Equipo Fijo: No puedes cambiar tu equipo.', ...prev].slice(0, 15))
      return
    }

    const hpBonus = modifier?.playerMaxHpBonus ?? 0
    let captured = { ...restEncounter, maxHp: restEncounter.maxHp + hpBonus, hp: restEncounter.hp + hpBonus }
    if (runChallenges.noEvolution) captured = applyNoEvolutionBuff(captured)
    if (runChallenges.fixedLevel) captured = { ...captured, level: 50 }
    registerInPokedex(captured)
    if (team.length >= maxTeamSize) {
      setPcStorage((prev) => [...prev, captured])
      setBattleLog((prev) => [`Capturaste a ${captured.name} y se envió al PC (equipo lleno).`, ...prev].slice(0, 15))
    } else {
      setTeam((previous) => [...previous, captured])
      setBattleLog((prev) => [`Capturaste a ${captured.name}.`, ...prev].slice(0, 15))
    }
    completeCurrentNode()
  }

  function skipRestCapture(): void {
    if (!restEncounter) return

    setBattleLog((prev) => [`Dejaste ir a ${restEncounter.name}.`, ...prev].slice(0, 15))
    completeCurrentNode()
  }

  function resetToSetup(): void {
    setScreen('setup')
    startMenuMusic()
    setTeam([])
    setActiveIndex(0)
    setEnemy(null)
    setRoute([])
    setRouteIndex(0)
    setInventory([])
    setMoney(100)
    setShopStock([])
    setModifier(null)
    setModifier2(null)
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
    setIsTeamRocketBattle(false)
    setTeamRocketFainted(false)
    setTeamRocketTeam([])
    setTeamRocketStealMessage('')
    setTeamRocketPickModal(false)
    setSpinItems([])
    setSpinWinnerIndex(null)
    setSpinRevealed(false)
    setSpinAnimating(false)
    setEggInventory([])
    setPcStorage([])
    setSpeedrunSeconds(0)
    if (speedrunTimerRef.current) {
      clearInterval(speedrunTimerRef.current)
      speedrunTimerRef.current = null
    }
  }

  function onRestartRun(): void {
    if (screen === 'route' || screen === 'battle' || screen === 'shop' || screen === 'spin' || screen === 'pokeRand' || screen === 'move') {
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
          <button className="tiny-btn" type="button" onClick={() => { playClick(); setShowOptions(!showOptions) }}>
            ⚙️ Opciones
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
                      onError={fallbackSprite}
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

      {/* Modal Equipar Objeto Pasivo */}
      {equipModal && (
        <div className="modal-backdrop" onClick={() => setEquipModal(null)}>
          <div
            className="revive-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '380px',
              width: '90%',
              margin: 'auto',
              boxShadow: '0 25px 50px rgba(0,0,0,0.6)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              {ITEM_SPRITES[equipModal.itemName] && (
                <img
                  src={ITEM_SPRITES[equipModal.itemName]}
                  alt={equipModal.itemName}
                  style={{ width: '36px', height: '36px', imageRendering: 'pixelated' }}
                />
              )}
              <div>
                <h3 style={{ margin: 0, color: '#c084fc', fontSize: '1.1rem' }}>{equipModal.itemName}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                  {HOLDABLE_ITEMS[equipModal.itemName]?.desc}
                </p>
              </div>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '1rem' }}>Elige a qué Pokémon equipárselo:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {team.map((pkmn, idx) => {
                const isAlive = pkmn.hp > 0
                const hasItem = !!pkmn.holdItem
                const canEquip = isAlive && !hasItem
                const eff = getEffectiveStats(pkmn)
                const item = HOLDABLE_ITEMS[equipModal.itemName]
                return (
                  <button
                    key={`equip-target-${idx}`}
                    type="button"
                    onClick={() => {
                      equipItem(equipModal.itemName, idx)
                      setEquipModal(null)
                    }}
                    disabled={!canEquip}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: canEquip ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                      background: canEquip ? 'rgba(168, 85, 247, 0.08)' : 'rgba(255,255,255,0.03)',
                      cursor: canEquip ? 'pointer' : 'not-allowed',
                      opacity: canEquip ? 1 : 0.45,
                      transition: 'all 0.2s'
                    }}
                  >
                    <img
                      src={pkmn.sprite}
                      alt={pkmn.name}
                      onError={fallbackSprite}
                      style={{
                        width: '44px',
                        height: '44px',
                        filter: isAlive ? 'none' : 'grayscale(100%)',
                        opacity: isAlive ? 1 : 0.5
                      }}
                    />
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '0.95rem', textTransform: 'capitalize', color: canEquip ? '#f8fafc' : '#64748b' }}>
                        {pkmn.name}
                        {pkmn.holdItem && <span style={{ fontSize: '0.7rem', color: '#a78bfa', marginLeft: '6px' }}>({pkmn.holdItem})</span>}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: canEquip ? '#94a3b8' : '#475569' }}>
                        Nv. {pkmn.level} · ATK: {eff.attack} · DEF: {eff.defense} · SPD: {eff.speed}
                      </span>
                    </div>
                    {canEquip && item && (
                      <div style={{ fontSize: '0.65rem', color: '#c084fc', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {item.attackMod && <div>ATK {eff.attack} → {Math.round(pkmn.attack * (1 + item.attackMod))}</div>}
                        {item.defenseMod && <div>DEF {eff.defense} → {Math.round(pkmn.defense * (1 + item.defenseMod))}</div>}
                        {item.speedMod && <div>SPD {eff.speed} → {Math.round(pkmn.speed * (1 + item.speedMod))}</div>}
                        {item.maxHpMod && <div>HP {pkmn.maxHp} → {pkmn.maxHp + item.maxHpMod}</div>}
                        {item.healPerTurn && item.healPerTurn > 0 && <div>+{item.healPerTurn} HP/turno</div>}
                        {item.healPerTurn && item.healPerTurn < 0 && <div>{item.healPerTurn} HP/turno</div>}
                        {item.damageBoost && <div>+{Math.round(item.damageBoost * 100)}% daño</div>}
                      </div>
                    )}
                    {!isAlive && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Debilitado</span>
                    )}
                    {hasItem && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ocupado</span>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => setEquipModal(null)}
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
                          <img src={pkmn.id >= 1 && pkmn.id <= 649 ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pkmn.id}.gif` : pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '60px', height: '60px' }} />
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

      {/* Modal Opciones */}
      {showOptions && (
        <div className="modal-backdrop" onClick={() => setShowOptions(false)}>
          <div className="pokedex-frame" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
            <div className="pokedex-top-bar">
              <div className="big-blue-sensor"></div>
              <div className="mini-leds">
                <div className="led red"></div>
                <div className="led yellow"></div>
                <div className="led green"></div>
              </div>
            </div>

            <div className="pokedex-screen" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                    🎵 Volumen de Música
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', minWidth: '20px' }}>🔈</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volume}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setVolumeState(v)
                        setVolume(v / 100)
                      }}
                      style={{ flex: 1, accentColor: '#10b981', height: '6px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', minWidth: '32px', textAlign: 'right' }}>{volume}%</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                  <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                    🔉 Volumen de Efectos
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', minWidth: '20px' }}>🔈</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={sfxVol}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setSfxVolState(v)
                        setSfxVolume(v / 100)
                      }}
                      style={{ flex: 1, accentColor: '#f59e0b', height: '6px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', minWidth: '32px', textAlign: 'right' }}>{sfxVol}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pokedex-controls">
              <div className="d-pad" title="D-Pad Options"></div>
              <button
                className="pokedex-close-btn"
                onClick={() => setShowOptions(false)}
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Rocket: Mensaje de robo */}
      {teamRocketStealMessage && (
        <div className="teamrocket-steal-banner">
          <div className="teamrocket-steal-content">
            <span className="teamrocket-steal-icon">🔴</span>
            <p>{teamRocketStealMessage}</p>
          </div>
        </div>
      )}

      {/* Team Rocket: Elegir Pokémon */}
      {teamRocketPickModal && (
        <div className="modal-backdrop" onClick={() => { setTeamRocketPickModal(false); setTeamRocketTeam([]); completeCurrentNode() }}>
          <div className="teamrocket-pick-panel" onClick={(e) => e.stopPropagation()}>
            <h3>🔴 ¡TeamR derrotado!</h3>
            <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>No perdiste ningún Pokémon. ¡Elige uno del equipo enemigo para unirlo al tuyo!</p>
            <div className="teamrocket-pick-grid">
              {teamRocketTeam.filter((p) => p.hp <= 0).map((pkmn, idx) => (
                <button
                  key={`rocket-pick-${idx}`}
                  className="teamrocket-pick-card"
                  onClick={() => { playClick(); pickRocketPokemon(pkmn) }}
                  onMouseEnter={playHover}
                  type="button"
                >
                  <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '64px', height: '64px', imageRendering: 'pixelated' }} />
                  <strong style={{ textTransform: 'capitalize' }}>{pkmn.name}</strong>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Nv. {pkmn.level}</span>
                  {pkmn.types && (
                    <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', marginTop: '4px' }}>
                      {pkmn.types.map((t) => (
                        <span key={t} style={{ background: TYPE_COLORS[t] ?? '#475569', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                className="secondary"
                onClick={() => { playClick(); setTeamRocketPickModal(false); setTeamRocketTeam([]); completeCurrentNode() }}
                onMouseEnter={playHover}
                type="button"
              >
                Omitir (no quedarse con ninguno)
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
              const completedHard = progression.completedHard.includes(gen)

              return (
                <button
                  key={gen}
                  className={`gen-tile ${generation === gen ? 'is-active' : ''} ${!unlocked ? 'is-locked' : ''}`}
                  onClick={() => { playClick(); handleSelectGeneration(gen) }}
                  onMouseEnter={playHover}
                  type="button"
                  disabled={isLoading || !unlocked}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Gen {gen} {unlocked ? '' : '🔒'}</span>
                    {completedHard ? (
                      <span className="badge-medium" title="Completado en Difícil">🏆🏆</span>
                    ) : completedMed ? (
                      <span className="badge-medium" title="Completado en Intermedio">🏆</span>
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
                  onClick={() => { playClick(); handleSelectGeneration(0) }}
                  onMouseEnter={playHover}
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
                  onClick={() => { playClick(); handleSelectDifficulty(diff) }}
                  onMouseEnter={playHover}
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

          <div className="generation-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
            {(() => {
              const infUnlocked = isInfiniteUnlocked(generation)
              return (
                <button
                  className={`gen-tile ${difficulty === 'infinite' ? 'is-active' : ''} ${!infUnlocked ? 'is-locked' : ''}`}
                  onClick={() => { playClick(); handleSelectDifficulty('infinite') }}
                  onMouseEnter={playHover}
                  type="button"
                  disabled={isLoading || !infUnlocked}
                  style={{
                    borderColor: infUnlocked ? '#a855f7' : '#475569',
                    background: !infUnlocked
                      ? 'rgba(15, 23, 42, 0.6)'
                      : difficulty === 'infinite' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(168, 85, 247, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '12px',
                    opacity: infUnlocked ? 1 : 0.65,
                    cursor: infUnlocked ? 'pointer' : 'not-allowed'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem', color: infUnlocked ? '#c084fc' : '#64748b' }}>♾️ INFINITE {infUnlocked ? '' : '🔒'}</span>
                    <strong style={{ fontSize: '1rem', color: infUnlocked ? '#c084fc' : '#64748b' }}>— Rutas infinitas</strong>
                  </div>
                  {!infUnlocked && (
                    <span className="lock-text">
                      🔒 Completa {generationRegions[generation]} en Difícil
                    </span>
                  )}
                </button>
              )
            })()}
          </div>

          <h2 style={{ marginTop: '1.5rem' }}>3. Desafíos de Run <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 'normal' }}>(opcional)</span></h2>
          {(() => {
            const challengesUnlocked = generation === 0
              ? generations.every((g) => progression.completedMedium.includes(g))
              : progression.completedMedium.includes(generation)

            const challengeCategories = [
              {
                title: '🗺️ Ruta',
                items: [
                  { key: 'noShops' as const, label: '🚫🏪 Sin Tiendas', desc: 'Se eliminan todos los nodos de tienda de la ruta.' },
                  { key: 'noRests' as const, label: '🚫🏕️ Sin Descansos', desc: 'Se eliminan todos los nodos de descanso de la ruta.' },
                  { key: 'allTeamRocket' as const, label: '🔴 Solo TeamR', desc: 'Todos los nodos no-boss se convierten en batallas Team Rocket.' },
                  { key: 'bossRush' as const, label: '🏆 Boss Rush', desc: 'Solo combates y boss final, sin tiendas ni descansos.' },
                  { key: 'blindRoute' as const, label: '👁️‍🗨️ Ruta Ciega', desc: 'No puedes ver qué nodo sigue hasta completar el actual.' },
                ]
              },
              {
                title: '✨ Visual',
                items: [
                  { key: 'allShiny' as const, label: '✨ Solo Shiny', desc: 'Todos los Pokémon (aliados y rivales) son Shiny.' },
                ]
              },
              {
                title: '⚔️ Combate',
                items: [
                  { key: 'noItems' as const, label: '🚫🎒 Sin Objetos', desc: 'No puedes usar consumables (pociones, X items, etc.) en batalla.' },
                  { key: 'restrictedMoves' as const, label: '⚔️ 2 Movimientos', desc: 'Cada Pokémon solo puede usar sus 2 primeros movimientos.' },
                  { key: 'firstStrike' as const, label: '⚡ Primer Golpe', desc: 'Si atacas primero y no debilitas al rival, recibes recoil del 8% HP.' },
                  { key: 'noCrits' as const, label: '🚫💥 Sin Críticos', desc: 'Se desactivan completamente los golpes críticos.' },
                  { key: 'typeRandomizer' as const, label: '🎲🎯 Tipo Random', desc: 'El tipo de cada movimiento se randomiza cada turno.' },
                  { key: 'fixedLevel' as const, label: '📊 Nivel Fijo', desc: 'Todos los Pokémon están en nivel 50, siempre.' },
                ]
              },
              {
                title: '🎯 Equipo',
                items: [
                  { key: 'soloStarter' as const, label: '🌟 Solo Starter', desc: 'No puedes capturar ni agregar Pokémon a tu equipo.' },
                  { key: 'fixedTeam' as const, label: '🔒 Equipo Fijo', desc: 'Tu equipo inicial no puede cambiarse durante la run.' },
                  { key: 'noEvolution' as const, label: '🚫🧬 Sin Evolución', desc: 'No puedes evolucionar Pokémon en los descansos.' },
                  { key: 'egglocke' as const, label: '🥚 Egglocke', desc: 'En los descansos obtienes huevos que eclosionan tras 2-3 batallas.' },
                ]
              },
              {
                title: '💰 Economía',
                items: [
                  { key: 'noPurchasing' as const, label: '🚫💰 Sin Compras', desc: 'No puedes comprar nada en la Pokémart.' },
                  { key: 'noMoney' as const, label: '💸 Sin Dinero', desc: 'No recibes dinero por derrotar rivales.' },
                ]
              },
              {
                title: '📈 Dificultad',
                items: [
                  { key: 'scalingEnemies' as const, label: '📈 Enemigos Reforzados', desc: 'Los enemigos ganan +1 nivel extra por cada nodo avanzado.' },
                  { key: 'noHealing' as const, label: '🚫💊 Sin Curación', desc: 'Ni tiendas, ni descansos, ni items curan HP.' },
                  { key: 'doubleModifiers' as const, label: '🎰 2 Modifiers', desc: 'Recibes 2 modificadores aleatorios en vez de 1.' },
                  { key: 'speedrun' as const, label: '⏱️ Speedrun', desc: 'Tienes 30 segundos por turno. Si se agota, pierdes 15% HP.' },
                  { key: 'totalRandomizer' as const, label: '🎲 Total Random', desc: 'Stats de ataque, defensa y velocidad de los enemigos son randomizados.' },
                ]
              },
              {
                title: '💀 Extremo',
                items: [
                  { key: 'nuzlocke' as const, label: '💀 Nuzlocke', desc: 'Si un Pokémon muere, se libera automáticamente.' },
                  { key: 'ironman' as const, label: '🔒 Ironman', desc: 'Activa Sin Evolución + Equipo Fijo + Sin Curación.' },
                  { key: 'nuzlockeHardcore' as const, label: '💀💀 Nuzlocke Hardcore', desc: 'Activa Nuzlocke + Sin Objetos + Sin Descansos.' },
                  { key: 'challengeGauntlet' as const, label: '🎰 Gauntlet (3 al azar)', desc: 'Se seleccionan 3 desafíos aleatorios al iniciar la run.' },
                ]
              },
            ]

            return (
              <div className="challenge-section" style={!challengesUnlocked ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
                {!challengesUnlocked && (
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#fbbf24' }}>
                    🔒 Completa la {generation === 0 ? 'todas las generaciones' : `Gen ${generation} (${generationRegions[generation]})`} en Intermedio o Difícil para desbloquear los desafíos.
                  </p>
                )}
                {challengeCategories.map((cat) => (
                  <div key={cat.title} style={{ marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'normal', textAlign: 'center' }}>{cat.title}</h3>
                    <div className="challenge-toggles">
                      {cat.items.map((item) => (
                        <button
                          key={item.key}
                          className={`challenge-toggle ${runChallenges[item.key] ? 'is-active' : ''}`}
                          onClick={() => {
                            playClick()
                            if (item.key === 'challengeGauntlet' && runChallenges.challengeGauntlet && gauntletKeys.length > 0) {
                              setRunChallenges((c) => {
                                const next = { ...c, challengeGauntlet: false }
                                for (const key of gauntletKeys) {
                                  next[key] = false
                                }
                                return next
                              })
                              setGauntletKeys([])
                              return
                            }
                            setRunChallenges((c) => {
                              const next = !c[item.key]
                              if (item.key === 'ironman') {
                                return { ...c, ironman: next, noEvolution: next, fixedTeam: next, noHealing: next }
                              }
                              if (item.key === 'nuzlockeHardcore') {
                                return { ...c, nuzlockeHardcore: next, nuzlocke: next, noItems: next, noRests: next }
                              }
                              return { ...c, [item.key]: next }
                            })
                          }}
                          onMouseEnter={playHover}
                          type="button"
                          disabled={!challengesUnlocked}
                          title={item.desc}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button className="cta" onClick={() => { playClick(); startNewRun() }} onMouseEnter={playHover} type="button" disabled={isLoading}>
              {isLoading ? 'Cargando PokeAPI...' : "Iniciar Aventura"}
            </button>
            <button className="secondary" onClick={() => { playClick(); setShowPokedex(true) }} onMouseEnter={playHover} type="button">
              📖 Abrir Pokédex
            </button>
          </div>
          {apiError && <p className="error-line">{apiError}</p>}
        </section>
      )}

      {(screen === 'route' || screen === 'battle' || screen === 'shop' || screen === 'spin' || screen === 'pokeRand' || screen === 'move') && activePokemon && (
        <section className="roulette-layout">
          <article className="panel trainer-panel">
            <p className="muted small-tag">Trainer</p>
            <img className="sprite trainer-sprite" src={activePokemon.sprite} alt={activePokemon.name} onError={fallbackSprite} />
            <h2>{activePokemon.name}{activePokemon.shiny ? ' ✨' : ''}</h2>
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
                <div key={`${pokemon.id}-${index}`} className="sprite-tooltip-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    className={`team-slot ${index === activeIndex ? 'is-active' : ''} ${pokemon.hp <= 0 ? 'is-fainted' : ''}`}
                    type="button"
                    onClick={() => switchActive(index)}
                    disabled={pokemon.hp <= 0 || isLoading}
                  >
                    <img src={pokemon.sprite} alt={pokemon.name} onError={fallbackSprite} />
                    {pokemon.holdItem && ITEM_SPRITES[pokemon.holdItem] && (
                      <img
                        src={ITEM_SPRITES[pokemon.holdItem]}
                        alt={pokemon.holdItem}
                        title={`${pokemon.holdItem}: ${HOLDABLE_ITEMS[pokemon.holdItem]?.desc ?? ''}`}
                        style={{ width: '18px', height: '18px', imageRendering: 'pixelated', position: 'absolute', bottom: '4px', right: '4px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
                      />
                    )}
                    <strong>{pokemon.name}{pokemon.shiny ? ' ✨' : ''}</strong>
                    <span>{pokemon.hp}/{pokemon.maxHp}</span>
                  </button>
                  <div className="sprite-tooltip">
                    <div className="tooltip-name">{pokemon.name}</div>
                    {pokemon.holdItem && (
                      <div style={{ fontSize: '0.65rem', color: '#c084fc', marginBottom: '4px' }}>
                        {ITEM_SPRITES[pokemon.holdItem] && (
                          <img src={ITEM_SPRITES[pokemon.holdItem]} alt="" style={{ width: '14px', height: '14px', imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: '3px' }} />
                        )}
                        {pokemon.holdItem} — {HOLDABLE_ITEMS[pokemon.holdItem]?.desc}
                      </div>
                    )}
                    {pokemon.types && pokemon.types.length > 0 && (
                      <div className="tooltip-types">
                        {pokemon.types.map((t) => (
                          <span key={t} className="tooltip-type-badge" style={{ background: TYPE_COLORS[t] ?? '#475569', color: '#fff' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {(() => {
                      const eff = getEffectiveStats(pokemon)
                      const hasItem = !!pokemon.holdItem
                      const fmt = (base: number, eff_: number) => hasItem && base !== eff_
                        ? <><strong>{eff_}</strong> <span style={{ fontSize: '0.6rem', color: '#4ade80' }}>(+{eff_ - base})</span></>
                        : <strong>{base}</strong>
                      return (
                        <>
                          <div className="tooltip-stat"><span>Nivel</span><strong>{pokemon.level}</strong></div>
                          <div className="tooltip-stat"><span>HP</span><strong>{pokemon.hp}/{pokemon.maxHp}</strong></div>
                          <div className="tooltip-stat"><span>Ataque</span>{fmt(pokemon.attack, eff.attack)}</div>
                          <div className="tooltip-stat"><span>Defensa</span>{fmt(pokemon.defense, eff.defense)}</div>
                          <div className="tooltip-stat"><span>Velocidad</span>{fmt(pokemon.speed, eff.speed)}</div>
                        </>
                      )
                    })()}
                    {pokemon.moves.length > 0 && (
                      <div className="tooltip-moves">
                        {pokemon.moves.slice(0, 4).map((m) => (
                          <span key={m.name}>{m.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
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
                  {pokemon.holdItem && (
                    <button
                      type="button"
                      className="tiny-btn"
                      style={{ background: '#7c3aed', color: '#fff', fontSize: '0.6rem', padding: '1px 4px' }}
                      onClick={(e) => { e.stopPropagation(); unequipItem(index) }}
                    >
                      ✕ Quitar {pokemon.holdItem}
                    </button>
                  )}
                  {pokemon.hp > 0 && team.length > 1 && (
                    <button
                      type="button"
                      className="tiny-btn"
                      style={{ background: '#3b82f6', color: '#fff', fontSize: '0.6rem', padding: '1px 4px' }}
                      onClick={(e) => { e.stopPropagation(); depositToPC(index) }}
                    >
                      → PC
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

            {pcStorage.length > 0 && (
              <>
                <p className="label" style={{ marginTop: '0.75rem' }}>PC ({pcStorage.length})</p>
                <div className="team-grid">
                  {pcStorage.map((pokemon, index) => (
                    <div key={`pc-${index}`} className="sprite-tooltip-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <button
                        className="team-slot"
                        type="button"
                        onClick={() => withdrawFromPC(index)}
                        disabled={isLoading}
                      >
                        <img src={pokemon.sprite} alt={pokemon.name} onError={fallbackSprite} />
                        {pokemon.holdItem && ITEM_SPRITES[pokemon.holdItem] && (
                          <img
                            src={ITEM_SPRITES[pokemon.holdItem]}
                            alt={pokemon.holdItem}
                            title={`${pokemon.holdItem}: ${HOLDABLE_ITEMS[pokemon.holdItem]?.desc ?? ''}`}
                            style={{ width: '18px', height: '18px', imageRendering: 'pixelated', position: 'absolute', bottom: '4px', right: '4px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
                          />
                        )}
                        <strong>{pokemon.name}{pokemon.shiny ? ' ✨' : ''}</strong>
                        <span>{pokemon.hp}/{pokemon.maxHp}</span>
                      </button>
                      <button
                        type="button"
                        className="tiny-btn"
                        style={{ background: '#3b82f6', color: '#fff', fontSize: '0.6rem', padding: '1px 4px' }}
                        onClick={() => withdrawFromPC(index)}
                      >
                        → Equipo
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {team.length > 1 && pcStorage.length > 0 && (
              <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.5rem', textAlign: 'center' }}>
                Haz clic en "→ Equipo" para sacar del PC. Si el equipo está lleno, se intercambia con el activo.
              </p>
            )}
          </article>

          <article className="panel center-panel">
            <h2>
              {difficulty === 'infinite' ? `Ruta #${route.length}` : `Ruta (${routeIndex + 1}/${route.length})`}
              {runChallenges.speedrun && screen === 'battle' && (
                <span style={{ marginLeft: '10px', fontSize: '0.9rem', color: speedrunSeconds <= 10 ? '#ef4444' : '#facc15', fontWeight: 'bold' }}>
                  ⏱️ {speedrunSeconds}s
                </span>
              )}
            </h2>
            {runChallenges.egglocke && eggInventory.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.5rem' }}>
                🥚 Huevos: {eggInventory.length} {eggInventory.map(e => `(${e.name}: ${e.hatchIn})`).join(' ')}
              </div>
            )}
            {modifier2 && (
              <div style={{ fontSize: '0.75rem', color: '#c084fc', marginBottom: '0.5rem' }}>
                🎰 Modifier 2: <strong>{modifier2.name}</strong> — {modifier2.description}
              </div>
            )}
            <div className="route-grid" style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
              {route.map((node, index) => {
                const isBlindHidden = runChallenges.blindRoute && index > routeIndex
                const stateClass = index === routeIndex ? 'current' : node.done ? 'done' : 'pending'
                const rocketClass = node.type === 'teamRocket' ? ' node-teamrocket' : ''
                const spinClass = node.type === 'spin' ? ' node-spin' : ''
                const pokeRandClass = node.type === 'pokeRand' ? ' node-pokerand' : ''
                const moveClass = node.type === 'move' ? ' node-move' : ''
                if (isBlindHidden) {
                  return (
                    <div key={node.id} className={`node pending`} style={{ opacity: 0.4 }}>
                      <span>#{node.id}</span>
                      <strong>???</strong>
                    </div>
                  )
                }
                return (
                  <div key={node.id} className={`node ${stateClass}${rocketClass}${spinClass}${pokeRandClass}${moveClass}`}>
                    <span>#{node.id}</span>
                    <strong>{nodeTypeLabel(node)}</strong>
                  </div>
                )
              })}
            </div>

            {screen === 'shop' && (
              <div className="action-block shop-block" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: '#facc15' }}>🏪 Pokémart</h3>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#4ade80' }}>
                    Dinero: ${money}
                  </span>
                </div>

                <div className="shop-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                  {shopStock.map((itemName) => {
                    const consumable = ALL_SHOP_ITEMS[itemName]
                    const holdable = HOLDABLE_ITEMS[itemName]
                    if (!consumable && !holdable) return null
                    const data = consumable ?? holdable!
                    const itemIcon = ITEM_SPRITES[itemName]
                    const isHoldable = !!holdable

                    return (
                      <div
                        key={itemName}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: isHoldable ? 'rgba(168, 85, 247, 0.12)' : 'rgba(0,0,0,0.3)',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: isHoldable ? '1px solid rgba(168, 85, 247, 0.3)' : 'none'
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
                            <strong style={{ color: isHoldable ? '#c084fc' : '#38bdf8' }}>{itemName}</strong>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>{data.desc}</p>
                            {isHoldable && <span style={{ fontSize: '0.65rem', color: '#a78bfa' }}>objeto pasivo</span>}
                          </div>
                        </div>
                        <button
                          className="tiny-btn"
                          type="button"
                          onClick={() => isHoldable ? buyHoldableItem(itemName) : buyShopItem(itemName)}
                          disabled={money < Math.floor(data.price * (1 - (modifier?.shopDiscount ?? 0)))}
                          style={{
                            background: money >= Math.floor(data.price * (1 - (modifier?.shopDiscount ?? 0))) ? '#10b981' : '#475569',
                            minWidth: '70px',
                            color: money >= Math.floor(data.price * (1 - (modifier?.shopDiscount ?? 0))) ? '#0f172a' : '#cbd5e1',
                            fontWeight: 'bold',
                            cursor: money >= Math.floor(data.price * (1 - (modifier?.shopDiscount ?? 0))) ? 'pointer' : 'not-allowed'
                          }}
                        >
                          ${Math.floor(data.price * (1 - (modifier?.shopDiscount ?? 0)))}
                        </button>
                      </div>
                    )
                  })}

                  {(() => {
                    const needsHealing = team.some((pkmn) => pkmn.hp > 0 && pkmn.hp < pkmn.maxHp)
                    const healCost = Math.floor(100 * (1 - (modifier?.shopDiscount ?? 0)) * (difficulty === 'hard' ? 1.4 : difficulty === 'infinite' ? 1.5 : 1))
                    const canAffordAndNeeds = money >= healCost && needsHealing

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
                          ${healCost}
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

            {screen === 'spin' && (
              <div className="action-block spin-block">
                <h3 style={{ margin: '0 0 0.5rem', color: '#c084fc', textAlign: 'center' }}>🎰 ¡Ruleta del Botín!</h3>
                <p className="muted" style={{ textAlign: 'center', margin: '0 0 1rem' }}>Gira para obtener un objeto al azar</p>
                <div className="roulette-wheel">
                  <div className={`roulette-items ${spinAnimating ? 'spinning' : ''}`}>
                    {spinItems.map((item, idx) => {
                      const isHoldable = !!HOLDABLE_ITEMS[item]
                      const itemIcon = ITEM_SPRITES[item]
                      const isWinner = spinRevealed && idx === spinWinnerIndex
                      const desc = isHoldable ? HOLDABLE_ITEMS[item].desc : ALL_SHOP_ITEMS[item]?.desc ?? ''
                      return (
                        <div
                          key={`spin-${idx}`}
                          className={`roulette-item ${isWinner ? 'winner' : ''} ${spinWinnerIndex === idx && spinAnimating ? 'highlight' : ''}`}
                        >
                          {itemIcon && (
                            <img src={itemIcon} alt={item} className="roulette-item-icon" />
                          )}
                          <span className="roulette-item-name">{item}</span>
                          <span className="roulette-item-desc">{desc}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {!spinRevealed && !spinAnimating && (
                  <button className="cta spin-cta" onClick={spinRoulette} type="button">
                    ¡Girar!
                  </button>
                )}
                {spinAnimating && (
                  <p style={{ textAlign: 'center', color: '#c084fc', fontWeight: 'bold', margin: '0.5rem 0' }}>Girando...</p>
                )}
                {spinRevealed && spinWinnerIndex !== null && (
                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <p style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
                      ¡Obtuviste {spinItems[spinWinnerIndex]}!
                    </p>
                    <button className="cta spin-cta" onClick={claimSpinItem} type="button">
                      Recoger objeto
                    </button>
                  </div>
                )}
              </div>
            )}

            {screen === 'pokeRand' && (
              <div className="action-block pokeRand-block">
                <h3 style={{ margin: '0 0 0.5rem', color: '#38bdf8', textAlign: 'center' }}>🎲 ¡PokeRand Ruleta!</h3>
                <p className="muted" style={{ textAlign: 'center', margin: '0 0 1rem' }}>Gira para obtener un Pokémon que se una a tu equipo</p>
                <div className="roulette-wheel" style={{ borderColor: 'rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.06)' }}>
                  <div className={`roulette-items ${pokeRandAnimating ? 'spinning' : ''}`}>
                    {pokeRandPokemon.map((pokemon, idx) => {
                      const isWinner = pokeRandRevealed && idx === pokeRandWinnerIndex
                      return (
                        <div
                          key={`pr-${pokemon.id}-${idx}`}
                          className={`roulette-item ${isWinner ? 'winner' : ''} ${pokeRandWinnerIndex === idx && pokeRandAnimating ? 'highlight' : ''}`}
                          style={isWinner ? { borderColor: '#38bdf8', boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)' } : undefined}
                        >
                          <img src={pokemon.sprite} alt={pokemon.name} className="roulette-item-icon" onError={fallbackSprite} style={{ width: '48px', height: '48px' }} />
                          <span className="roulette-item-name">{pokemon.name}</span>
                          <span className="roulette-item-desc">Nv.{pokemon.level}</span>
                          <span className="roulette-item-desc" style={{ fontSize: '0.55rem', color: '#94a3b8' }}>
                            {pokemon.types?.join('/')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {!pokeRandRevealed && !pokeRandAnimating && (
                  <button className="cta pokeRand-cta" onClick={pokeRandSpin} type="button">
                    ¡Girar!
                  </button>
                )}
                {pokeRandAnimating && (
                  <p style={{ textAlign: 'center', color: '#38bdf8', fontWeight: 'bold', margin: '0.5rem 0' }}>Girando...</p>
                )}
                {pokeRandRevealed && pokeRandWinnerIndex !== null && (
                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <p style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
                      ¡{pokeRandPokemon[pokeRandWinnerIndex].name} quiere unirse a tu equipo!
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        className="cta pokeRand-cta"
                        onClick={claimPokeRandPokemon}
                        type="button"
                        style={{ width: 'auto', padding: '10px 24px' }}
                      >
                        {team.length >= maxTeamSize ? `Capturar → PC (${pcStorage.length} en PC)` : `Capturar (${team.length}/${maxTeamSize})`}
                      </button>
                      <button
                        className="secondary"
                        onClick={skipPokeRandPokemon}
                        type="button"
                        style={{ padding: '10px 24px' }}
                      >
                        Liberar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {screen === 'move' && (
              <div className="action-block">
                <h3 style={{ margin: '0 0 0.5rem', color: '#e2e8f0', textAlign: 'center' }}>📝 ¡Move Tutor!</h3>
                {!selectedNewMove ? (
                  <>
                    <p className="muted" style={{ textAlign: 'center', margin: '0 0 0.75rem' }}>
                      Elige un movimiento para <strong>{activePokemon?.name}</strong> o salta el nodo.
                    </p>
                    <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                      {moveOptions.map((move) => (
                        <button
                          key={`move-opt-${move.name}`}
                          className="move-btn"
                          type="button"
                          onClick={() => setSelectedNewMove(move)}
                          style={{ borderColor: TYPE_COLORS[move.type] ?? '#475569' }}
                        >
                          <strong>{move.name}</strong>
                          <span className="muted" style={{ fontSize: '0.7rem' }}>
                            {move.type.toUpperCase()} · Pwr {move.power} · Acc {move.accuracy ?? '—'}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button className="secondary" onClick={skipMoveNode} type="button">
                        Saltar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="muted" style={{ textAlign: 'center', margin: '0 0 0.75rem' }}>
                      <strong style={{ color: TYPE_COLORS[selectedNewMove.type] ?? '#e2e8f0' }}>{selectedNewMove.name}</strong>
                      {' '} — Elige qué movimiento reemplazar:
                    </p>
                    <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                      {activePokemon?.moves.map((move, idx) => (
                        <button
                          key={`move-replace-${idx}`}
                          className="move-btn"
                          type="button"
                          onClick={() => replaceTeamMove(idx)}
                          style={{ borderColor: TYPE_COLORS[move.type] ?? '#475569' }}
                        >
                          <strong>{move.name}</strong>
                          <span className="muted" style={{ fontSize: '0.7rem' }}>
                            {move.type.toUpperCase()} · Pwr {move.power}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button className="secondary" onClick={() => { setSelectedNewMove(null) }} type="button">
                        ← Volver
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type === 'rest' && restEncounter && (
              <div className="action-block">
                <p>
                  Rest stop: <strong>{restEncounter.name}</strong> is waiting to be captured.
                </p>
                <p className="muted">Reward item added: {restRewardItem}</p>
                <div className="capture-card">
                  <img className="sprite" src={restEncounter.sprite} alt={restEncounter.name} onError={fallbackSprite} />
                </div>
                <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                  <button className="cta" onClick={captureRestPokemon} type="button">
                    {team.length >= maxTeamSize ? `Capturar → PC (${pcStorage.length} en PC)` : 'Capture'}
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
                <button className={`cta ${currentNode.type === 'teamRocket' ? 'cta-danger' : ''}`} onClick={enterNode} type="button" disabled={isLoading}>
                  {isLoading ? 'Searching rival...' : currentNode.type === 'teamRocket' ? '🔴 Enfrentar a TeamR!' : currentNode.type === 'spin' ? '🎰 ¡Girar la Ruleta!' : currentNode.type === 'pokeRand' ? '🎲 ¡Girar la Ruleta Pokémon!' : 'Enter node'}
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
                {isTrainerBattle ? (
                  <div style={{ marginBottom: '0.75rem' }}>
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
                              onError={fallbackSprite}
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

                <p style={{ margin: '0 0 4px 0' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{enemy.name}{enemy.shiny ? ' ✨' : ''}</strong>
                  {' · '}Nv.&nbsp;{enemy.level}
                </p>
                <img className="sprite enemy-sprite" src={enemy.sprite} alt={enemy.name} onError={fallbackSprite} />
                <div className="hp-line">
                  <span>HP rival</span>
                  <strong>{enemy.hp}/{enemy.maxHp}</strong>
                </div>
                <div className="meter enemy-meter">
                  <div style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}></div>
                </div>

                <div className="moves-grid">
                  {(runChallenges.restrictedMoves ? activePokemon.moves.slice(0, 2) : activePokemon.moves).map((move) => (
                    <button
                      key={move.name}
                      className="move-btn"
                      onClick={() => onPlayerMove(move)}
                      type="button"
                      disabled={isLoading || (runChallenges.speedrun && speedrunSeconds <= 0)}
                      title={moveTooltip(move)}
                    >
                      {move.name} ({move.type}{runChallenges.typeRandomizer ? ' *' : ''})
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
                  const isHoldable = !!HOLDABLE_ITEMS[entry.name]
                  if (isHoldable) {
                    const holdableIdx = inventory.indexOf(entry.name)
                    const holdDesc = HOLDABLE_ITEMS[entry.name]?.desc ?? entry.description
                    return (
                      <button
                        key={entry.name}
                        className="item-slot filled item-button"
                        type="button"
                        onClick={() => setEquipModal({ itemName: entry.name, itemIndex: holdableIdx })}
                        title={holdDesc}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderLeft: '3px solid #a78bfa' }}
                      >
                        {itemIcon && (
                          <img
                            src={itemIcon}
                            alt={entry.name}
                            style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                          />
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <strong style={{ color: '#c084fc' }}>{entry.name}</strong>
                          <span style={{ fontSize: '0.65rem', color: '#a78bfa' }}>{holdDesc}</span>
                          <span style={{ fontSize: '0.6rem', color: '#7c3aed' }}>x{entry.count} · equipar</span>
                        </div>
                      </button>
                    )
                  }
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
              {victoryUnlocks.unlockedInfinite && (
                <p style={{ margin: '6px 0', color: '#c084fc', fontSize: '0.95rem' }}>
                  ♾️ <strong>¡MODO INFINITE DESBLOQUEADO!</strong> Ahora puedes jugar la Gen {currentRunGen} ({victoryUnlocks.genName}) en modo Infinite (rutas infinitas).
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
                      <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '48px', height: '48px', opacity: 0.6, filter: 'grayscale(100%)' }} />
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