import type { Language } from '../game/i18n'

export type PokestDungeonId = 'crypt' | 'abyss'

export type PokestRole = 'tank' | 'bruiser' | 'healer' | 'support' | 'assassin' | 'ranged'

export type PokestRank = 1 | 2 | 3 | 4

export type PokestSkillTarget = 'enemy' | 'ally' | 'self' | 'allEnemies' | 'allAllies'

export type PokestSkillEffect = 'damage' | 'heal' | 'stressHeal' | 'guard' | 'stressDamage'

export type PokestStatus = 'bleed' | 'blight' | 'stun' | 'weak' | 'vulnerable'

export interface PokestSkill {
  id: string
  name: string
  nameEn: string
  rank: PokestRank[]
  target: PokestSkillTarget
  targetRanks: PokestRank[]
  effect: PokestSkillEffect
  power: number
  accuracy: number
  crit: number
  cooldown: number
  stressDamage?: number
  heal?: number
  stressHeal?: number
  status?: PokestStatus
  statusTurns?: number
}

export interface PokestHeroDef {
  id: number
  name: string
  title: string
  titleEn: string
  role: PokestRole
  baseHp: number
  baseAtk: number
  baseDef: number
  baseSpd: number
  stressResist: number
  skills: PokestSkill[]
  lore: string
  loreEn: string
}

export interface PokestHero {
  instanceId: string
  defId: number
  name: string
  sprite: string
  role: PokestRole
  title: string
  titleEn: string
  level: number
  xp: number
  hp: number
  maxHp: number
  stress: number
  maxStress: number
  atk: number
  def: number
  spd: number
  stressResist: number
  rank: PokestRank
  skills: PokestSkill[]
  affliction: string | null
  virtue: string | null
  quirks: string[]
  weaponLevel: number
  armorLevel: number
  guard: number
  stun: number
  bleed: number
  blight: number
  weak: number
  vulnerable: number
  cooldowns: Record<string, number>
  deathsDoor: boolean
  alive: boolean
  isEnemy?: boolean
}

export interface PokestEnemyDef {
  id: string
  name: string
  nameEn: string
  spriteId: number
  hp: number
  atk: number
  def: number
  spd: number
  stressResist: number
  skills: PokestSkill[]
  boss?: boolean
  type: string
  typeEn: string
}

export interface PokestDungeonDef {
  id: PokestDungeonId
  name: string
  nameEn: string
  desc: string
  descEn: string
  icon: string
  length: number
  level: number
  enemyPool: string[]
  bossPool: string[]
  reward: number
  unlockAfter?: PokestDungeonId
  palette: {
    bg: string
    accent: string
    glow: string
    fog: string
  }
  intro: string[]
  introEn: string[]
}

export type PokestNodeType = 'battle' | 'elite' | 'event' | 'camp' | 'treasure' | 'boss'

export interface PokestNode {
  id: string
  type: PokestNodeType
  done: boolean
}

export type PokestEventEffect =
  | { type: 'stressHealAll'; value: number }
  | { type: 'stressDamageAll'; value: number }
  | { type: 'healAll'; value: number }
  | { type: 'damageAll'; value: number }
  | { type: 'gold'; value: number }
  | { type: 'torch'; value: number }
  | { type: 'food'; value: number }
  | { type: 'bandage'; value: number }
  | { type: 'healRandom'; value: number }
  | { type: 'damageRandom'; value: number }
  | { type: 'cureBleedAll' }
  | { type: 'gamble'; value: number }

export interface PokestEventOption {
  id: string
  label: string
  labelEn: string
  desc: string
  descEn: string
  requires?: {
    food?: number
    torch?: number
    bandage?: number
    gold?: number
  }
  stress?: number
  effect: PokestEventEffect
}

export interface PokestEvent {
  id: string
  title: string
  titleEn: string
  desc: string
  descEn: string
  options: PokestEventOption[]
}

export interface PokestReward {
  gold: number
  text: string
  textEn: string
}

export type PokestRunPhase =
  | 'map'
  | 'combat'
  | 'event'
  | 'camp'
  | 'treasure'
  | 'combatWon'
  | 'victory'
  | 'defeat'
  | 'retreat'

export interface PokestRunState {
  dungeonId: PokestDungeonId
  nodes: PokestNode[]
  currentNode: number
  torch: number
  maxTorch: number
  gold: number
  provisions: {
    food: number
    torch: number
    bandage: number
  }
  party: PokestHero[]
  enemies: PokestHero[]
  turnOrder: string[]
  turnIndex: number
  round: number
  phase: PokestRunPhase
  log: string[]
  narrator: string
  narratorEn: string
  eventId: string | null
  campUsed: boolean
  lastReward: PokestReward | null
  startedAt: number
}

export interface PokestSave {
  version: 1
  gold: number
  roster: PokestHero[]
  teamIds: string[]
  unlockedDungeons: PokestDungeonId[]
  clearedDungeons: PokestDungeonId[]
  runs: number
  victories: number
  fallen: number
  activeRun: PokestRunState | null
  lastMessage: string | null
  lastMessageEn: string | null
}

export interface PokestAfflictionDef {
  id: string
  name: string
  nameEn: string
  desc: string
  descEn: string
  color: string
}

export interface PokestVirtueDef {
  id: string
  name: string
  nameEn: string
  desc: string
  descEn: string
  color: string
}

export interface PokestQuirkDef {
  id: string
  name: string
  nameEn: string
  desc: string
  descEn: string
  positive: boolean
  atkPct?: number
  defPct?: number
  stressPct?: number
  stressResist?: number
  crit?: number
  healPct?: number
}

export interface PokestEventContext {
  language: Language
}

export interface PokestActionOption {
  id: string
  label: string
  labelEn: string
  desc: string
  descEn: string
  disabled: boolean
}
