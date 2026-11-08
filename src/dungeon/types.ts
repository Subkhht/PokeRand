import type { Language } from '../game/i18n'
import type { Pokemon } from '../game/types'

export type DungeonId = 'forest' | 'cave' | 'tower' | 'desert' | 'abyss' | 'endless'

export type DungeonView = 'menu' | 'team' | 'shop' | 'expedition' | 'run' | 'result'

export type FloorModifier = 'none' | 'darkness' | 'fog' | 'sandstorm' | 'lava' | 'ice'

export interface DungeonDef {
  id: DungeonId
  name: string
  nameEn: string
  desc: string
  descEn: string
  icon: string
  floors: number
  levelStart: number
  levelEnd: number
  enemyPool: number[]
  bossId: number
  bossPool: number[]
  bossLevel: number
  minionPool: number[]
  floorModifiers: FloorModifier[]
  reward: number
  unlockAfter?: DungeonId
  palette: {
    floor: string
    floorAlt: string
    wall: string
    wallTop: string
    accent: string
    fog: string
  }
  intro: string[]
  introEn: string[]
}

export type ActiveEffect =
  | 'heal'
  | 'healLeader'
  | 'healTeam'
  | 'healFullSingle'
  | 'fullRestore'
  | 'revive'
  | 'reviveFull'
  | 'escape'
  | 'cure'
  | 'curePoison'
  | 'cureSleep'
  | 'cureParalyze'
  | 'attack'
  | 'defense'
  | 'spAttack'
  | 'spDefense'
  | 'speed'
  | 'crit'
  | 'crystals'
  | 'xp'
  | 'reveal'
  | 'warp'
  | 'paralyze'
  | 'sleep'
  | 'pp'
  | 'ppLeader'
  | 'damage'

export interface ActiveItemDef {
  id: string
  name: string
  nameEn: string
  sprite: string
  desc: string
  descEn: string
  price: number
  effect: ActiveEffect
  power: number
}

export interface HeldItemDef {
  id: string
  name: string
  nameEn: string
  sprite: string
  desc: string
  descEn: string
  price: number
  type: string
  boost: number
}

export interface DungeonShopOffer {
  itemId: string
  price: number
  sold: boolean
}

export type FloorEventKind = 'monsterHouse' | 'treasure' | 'kecleonShop' | 'rest' | 'mystery'

export interface FloorEvent {
  kind: FloorEventKind
  x: number
  y: number
  triggered: boolean
}

export type GuildMissionKind = 'reachFloor' | 'defeatEnemies' | 'recruit' | 'collectCrystals' | 'defeatBoss' | 'noFaints'

export interface GuildMission {
  kind: GuildMissionKind
  target: number
  reward: number
}

export interface DailyMission extends GuildMission {
  date: string
  progress: number
  completed: boolean
}

export interface MissionStart {
  enemiesDefeated: number
  recruits: number
  crystalsEarned: number
}

export interface DungeonRecord {
  bestFloor: number
  runs: number
  wins: number
}

export interface PassiveEffects {
  maxHp: number
  attackPct: number
  defense: number
  recruitPct: number
  revealTraps: boolean
  bagSlots: number
  xpPct: number
  critPct: number
  healPerTurn: number
  reflectPct: number
  crystalPct: number
}

export interface PassiveDef {
  id: string
  name: string
  nameEn: string
  icon: string
  desc: string
  descEn: string
  price: number
  effects: Partial<PassiveEffects>
}

export type UpgradeKind =
  | 'maxHp'
  | 'attack'
  | 'defense'
  | 'spAttack'
  | 'bag'
  | 'recruit'
  | 'luck'
  | 'level'
  | 'pp'
  | 'heal'

export interface UpgradeDef {
  id: string
  name: string
  nameEn: string
  icon: string
  desc: string
  descEn: string
  maxLevel: number
  costs: number[]
  kind: UpgradeKind
  perLevel: number
}

export interface DungeonStats {
  runs: number
  wins: number
  bestFloor: number
  totalCrystals: number
  enemiesDefeated: number
  recruits: number
  missions: number
  bestRun: { dungeonId: DungeonId; floor: number; date: string } | null
}

export interface DungeonPokemonMeta {
  name: string
  types: string[]
  descEs?: string
  descEn?: string
}

export interface DungeonSave {
  version: 1
  crystals: number
  ownedActives: string[]
  ownedPassives: string[]
  ownedHeldItems: string[]
  equippedHeldItems: Record<number, string>
  upgrades: Record<string, number>
  unlockedStarters: number[]
  pokemonMeta: Record<number, DungeonPokemonMeta>
  settledRecruits: number[]
  selectedTeam: number[]
  equippedPassives: string[]
  unlockedDungeons: DungeonId[]
  clearedDungeons: DungeonId[]
  dungeonRecords: Partial<Record<DungeonId, DungeonRecord>>
  dailyMission: DailyMission
  stats: DungeonStats
}

export interface RunBonuses {
  maxHp: number
  attack: number
  defense: number
  spAttack: number
  bagSlots: number
  recruitPct: number
  luckPct: number
  levelBonus: number
  ppBonus: number
  xpPct: number
  critPct: number
  healPerTurn: number
  reflectPct: number
  crystalPct: number
  revealTraps: boolean
  attackPct: number
  maxHpPassive: number
}

export type TileKind = 0 | 1 | 2

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface MapTree {
  x: number
  y: number
  /** Frame index in the 5×3 tree sprite sheet. */
  frame: number
  flip: boolean
  scale: number
  /** Árbol especial rompible (solo Bosque Susurrante). */
  special?: boolean
  broken?: boolean
}

export interface MapRock {
  x: number
  y: number
  flip: boolean
  scale: number
  /** Roca negra especial rompible (solo Caverna Cristal). */
  special?: boolean
  broken?: boolean
}

export interface DungeonMap {
  width: number
  height: number
  tiles: TileKind[][]
  rooms: Rect[]
  start: { x: number; y: number }
  stairs: { x: number; y: number }
  trees?: MapTree[]
  rocks?: MapRock[]
}

export interface PmdSprites {
  walk: HTMLImageElement | null
  idle: HTMLImageElement | null
  walkFrames: number
  walkFrameW: number
  walkFrameH: number
  idleFrames: number
  idleFrameW: number
  idleFrameH: number
  walkDurations: number[]
  idleDurations: number[]
  isFallback: boolean
}

export interface DungeonMonster {
  uid: string
  p: Pokemon
  x: number
  y: number
  isPlayer: boolean
  isLeader: boolean
  isBoss?: boolean
  bossEnraged?: boolean
  heldItem?: string
  facing: number
  xp: number
  level: number
  status: 'none' | 'poison' | 'sleep' | 'paralyze'
  statusTurns: number
  pmd: PmdSprites | null
  animUntil: number
  lastMoved: number
}

export interface GroundItem {
  id: string
  x: number
  y: number
  itemId: string
  amount: number
}

export interface Trap {
  x: number
  y: number
  kind: 'damage' | 'sleep' | 'warp' | 'pp'
  revealed: boolean
}

export interface Chest {
  x: number
  y: number
  opened: boolean
}

export interface FloatText {
  x: number
  y: number
  text: string
  color: string
  born: number
}

export interface DialogueLine {
  speakerId?: number
  name: string
  text: string
  emotion?: string
  side?: 'left' | 'right'
}

export type RunStatus = 'playing' | 'won' | 'lost' | 'escaped'

export interface DungeonRun {
  dungeonId: DungeonId
  lang: Language
  floor: number
  totalFloors: number
  encounterPool: number[]
  bossId: number
  floorModifier: FloorModifier
  events: FloorEvent[]
  shopOffers: DungeonShopOffer[] | null
  mission: GuildMission
  missionStart: MissionStart
  missionComplete: boolean
  map: DungeonMap
  party: DungeonMonster[]
  fallen: DungeonMonster[]
  trail: Array<{ x: number; y: number }>
  enemies: DungeonMonster[]
  items: GroundItem[]
  traps: Trap[]
  chests: Chest[]
  bag: Record<string, number>
  bagCapacity: number
  leaderUid: string
  crystalsEarned: number
  enemiesDefeated: number
  recruits: number
  turn: number
  log: string[]
  status: RunStatus
  dialogue: DialogueLine[]
  selectedMove: number | null
  floatTexts: FloatText[]
  revealMap: boolean
  bossDefeated: boolean
  startedAt: number
  bonuses: RunBonuses
  templates: Record<number, Pokemon>
  assets: Record<number, PmdSprites>
  pendingFloor: number | null
}

export interface DungeonResult {
  status: RunStatus
  dungeonId: DungeonId
  floor: number
  crystalsEarned: number
  enemiesDefeated: number
  recruits: number
  missionsCompleted: number
  isFirstClear: boolean
}
