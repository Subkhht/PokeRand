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
}

export interface RouteNode {
  id: number
  type: 'battle' | 'rest' | 'shop' | 'boss'
  label: string
  done: boolean
}

export interface RunModifier {
  id?: string
  name: string
  description: string
  enemyAttackDelta?: number
  shopPotionBonus?: number
  healBonus?: number
}

export interface RunConfig {
  generation: number
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