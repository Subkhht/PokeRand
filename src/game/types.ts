export interface Move {
  name: string
  power: number
  type: string
  accuracy: number | null
  description: string
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
  speed: number
  moves: Move[]
  types?: string[]
  baseStatTotal?: number
  rawLevelUpMoves?: RawLevelUpMove[]
  holdItem?: string | null
  shiny?: boolean
}

export interface RouteNode {
  id: number
  type: 'battle' | 'rest' | 'shop' | 'boss' | 'teamRocket' | 'spin' | 'pokeRand'
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
  value: number // Cantidad de cura o buff
}