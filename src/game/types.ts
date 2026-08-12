export type StatusType = 'burn' | 'poison' | 'paralysis' | 'freeze' | 'sleep' | 'confusion' | 'flinch'

export interface StatusCondition {
  type: StatusType
  turns: number
  damage?: number
}

export interface StatChange {
  stat: 'attack' | 'defense' | 'speed' | 'special-attack' | 'special-defense'
  change: number
  chance?: number
}

export interface PokemonIVs {
  hp: number
  attack: number
  defense: number
  spAttack: number
  spDefense: number
  speed: number
}

export interface Move {
  name: string
  enName?: string
  power: number
  type: string
  accuracy: number | null
  description: string
  url?: string
  damageClass?: 'physical' | 'special'
  ailment?: StatusType
  ailmentChance?: number
  minHits?: number
  maxHits?: number
  recoilPercent?: number
  drainPercent?: number
  critRatio?: number
  priority?: number
  statChanges?: StatChange[]
  statChance?: number
  metaCategory?: string
  pp?: number
  maxPp?: number
  leechSeed?: boolean
  disable?: boolean
  fakeOut?: boolean
  isZMove?: boolean
}

export interface RawLevelUpMove {
  name: string
  url: string
  level: number
}

export interface Pokemon {
  id: number
  name: string
  sprite: string
  level: number
  hp: number
  maxHp: number
  attack: number
  defense: number
  spAttack: number
  spDefense: number
  speed: number
  moves: Move[]
  types?: string[]
  baseStatTotal?: number
  captureRate?: number
  evolutionLevel?: number
  evolutionChainId?: number
  minAppearLevel?: number
  heldItemRequired?: string | null
  heldItemEvolutions?: Array<{ item: string; target: string; level: number }>
  rawLevelUpMoves?: RawLevelUpMove[]
  holdItem?: string | null
  shiny?: boolean
  ability?: string
  nature?: string
  ivs?: PokemonIVs
  megaEvolved?: boolean
  gmaxEvolved?: boolean
  primalEvolved?: boolean
  originEvolved?: boolean
  gmaxTurnsLeft?: number
  megaOrig?: { sprite: string; attack: number; defense: number; spAttack: number; spDefense: number; speed: number }
  status?: StatusCondition
  statStages?: { attack: number; defense: number; spAttack: number; spDefense: number; speed: number }
  furiaActive?: boolean
  protected?: boolean
  leechSeed?: boolean
  lastMove?: string
  disabled?: { move: string; turns: number }
  justEntered?: boolean
  choiceLockedMove?: string
  zMoveUsed?: boolean
}

export interface RouteNode {
  id: number
  type: 'battle' | 'rest' | 'shop' | 'boss' | 'teamRocket' | 'spin' | 'pokeRand' | 'move' | 'mega' | 'gmax' | 'primal' | 'trade' | 'rival' | 'blackmarket' | 'double' | 'casino' | 'elite' | 'legendary'
  label: string
  done: boolean
}

export interface RunModifier {
  id?: string
  name: string
  description: string
  enemyAttackDelta?: number
  enemyDefenseDelta?: number
  enemySpeedDelta?: number
  enemyLevelDelta?: number
  shopPotionBonus?: number
  healBonus?: number
  healReduction?: number
  playerAttackMod?: number
  playerDefenseMod?: number
  playerSpeedMod?: number
  playerMaxHpBonus?: number
  playerCritChance?: number
  playerLifesteal?: number
  moneyMultiplier?: number
  shopDiscount?: number
  forcedWeather?: string
}

export interface RunConfig {
  generation: number
}

export interface RunChallenges {
  noShops: boolean
  noRests: boolean
  allShiny: boolean
  allTeamRocket: boolean
  nuzlocke: boolean
  soloStarter: boolean
  fixedTeam: boolean
  noEvolution: boolean
  noItems: boolean
  restrictedMoves: boolean
  firstStrike: boolean
  fixedLevel: boolean
  noCrits: boolean
  typeRandomizer: boolean
  noPurchasing: boolean
  blindRoute: boolean
  bossRush: boolean
  speedrun: boolean
  noMoney: boolean
  doubleModifiers: boolean
  scalingEnemies: boolean
  noHealing: boolean
  ironman: boolean
  totalRandomizer: boolean
  nuzlockeHardcore: boolean
  challengeGauntlet: boolean
  egglocke: boolean
}

export interface DefeatSummary {
  finalTeam: Pokemon[]
  battleLog: string[]
  enemy?: Pokemon | null
  lastNodeLabel?: string
}

export interface ShopItem {
  id: string
  name: string
  price: number
  description: string
  type: 'heal' | 'buff' | 'level' | 'revive'
  value: number
}

export interface RunStats {
  battlesWon: number
  battlesLost: number
  totalDamageDealt: number
  totalDamageTaken: number
  critsLanded: number
  superEffectiveHits: number
  koFirstTurn: number
  captures: number
  itemsUsed: number
  moneySpent: number
  moneyEarned: number
  nodesCleared: number
  teamSizeMax: number
  lowestHPEver: number
  totalTurns: number
  pokemonUsed: string[]
  challengesActive: string[]
  evolutions: number
}

export interface Achievement {
  id: string
  name: string
  desc: string
  icon: string
  hidden: boolean
  reward: number
}

export interface AchievementState {
  [id: string]: { unlocked: boolean; date: string; claimed?: boolean }
}

export interface MetaProgression {
  pokeCoins: number
  totalRuns: number
  totalWins: number
  bestStreak: number
  unlockedStarters: number[]
  permanentlyUnlockedItems: string[]
  ownedThemes: string[]
  activeTheme: string
  ownedBackgrounds: string[]
  activeBackground: string
  ownedMusic: string[]
  activeMenuMusic: string
  activeBattleMusic: string
  gameboyMode: boolean
  totalMegas: number
  totalGmax: number
  coopRuns: number
  coopWins: number
  coopTrades: number
  completedGenDex?: number[]
  totalZMoves?: number
  zMoveTypes?: string[]
}