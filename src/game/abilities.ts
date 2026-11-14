import type { Move, Pokemon, StatusType } from './types'
import type { WeatherKind } from './pokemonMeta'
import { ABILITY_CATALOG } from './abilityCatalog'
import { getLanguage, t } from './i18n'

// ---------------------------------------------------------------------------
// Motor central de habilidades.
//
// Todas las habilidades tienen un efecto real en el juego. Las que no pueden
// trasladarse tal cual (por ejemplo las que dependen de género, clima especial
// o terreno) usan una versión adaptada y coherente con el resto del combate.
// ---------------------------------------------------------------------------

export type AbilityStatKey = 'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed'

export interface AbilityStages {
  attack: number
  defense: number
  spAttack: number
  spDefense: number
  speed: number
}

export const EMPTY_ABILITY_STAGES: AbilityStages = {
  attack: 0,
  defense: 0,
  spAttack: 0,
  spDefense: 0,
  speed: 0,
}

export function abilityNameFor(id: string | undefined): string {
  if (!id) return '—'
  const entry = ABILITY_CATALOG[id]
  return entry ? entry[getLanguage()] : id
}

export function abilityStages(p: Pokemon): AbilityStages {
  return p.statStages ?? { ...EMPTY_ABILITY_STAGES }
}

// Habilidades que ignoran las habilidades defensivas del rival.
const ABILITY_IGNORERS = new Set(['mold-breaker', 'teravolt', 'turboblaze'])

export function abilityDeniedBy(target: Pokemon, source?: Pokemon): boolean {
  return !!source && !!target.ability && ABILITY_IGNORERS.has(source.ability ?? '')
}

// Habilidad propia con posibilidad de que el atacante la ignore.
export function abilityIs(p: Pokemon | undefined, id: string, source?: Pokemon): boolean {
  return !!p && p.ability === id && !abilityDeniedBy(p, source)
}

const SOUND_WORDS = [
  'sonic', 'sónico', 'sonico', 'sound', 'sonido', 'voz', 'voice', 'canto', 'song', 'sing',
  'rugido', 'roar', 'bramido', 'screech', 'chirrido', 'eco', 'echo', 'melod', 'lullaby',
  'arrullo', 'alarido', 'uproar', 'alboroto', 'snarl', 'gruñido', 'gruñido', 'hyper voice',
  'psicorruido', 'psyshock', 'resonancia', 'resonance', 'estruendo', 'boomburst', 'round',
  'conversación', 'confide', 'silbato', 'whistle', 'disarming voice', 'voz cautivadora',
]

const BALL_BOMB_WORDS = [
  'ball', 'bola', 'bomb', 'bomba', 'bala', 'bullet', 'sphere', 'esfera', 'seed bomb',
  'bomba semilla', 'sludge bomb', 'bomba lodo', 'shadow ball', 'bola sombra',
  'energy ball', 'bola de energía', 'aura sphere', 'esfera aural', 'focus blast',
  'onda certera', 'gyro ball', 'girobola', 'rock blast', 'pedrada', 'bullet seed',
  'semillero', 'zap cannon', 'electrocañón', 'cannon', 'cañón', 'magnet bomb',
  'bomba imán', 'mud bomb', 'bomba fango', 'egg bomb', 'bomba huevo', 'mist ball',
  'bola niebla', 'octazooka', 'octazuka', 'pollen puff', 'bomba de polen',
]

const POWDER_WORDS = [
  'polvo', 'powder', 'espora', 'spore', 'spora', 'pollen', 'polen', 'stun spore',
  'paralizador', 'sleep powder', 'somnífero', 'poison powder', 'veneno', 'rage powder',
  'polvo ira', 'cotton spore', 'esporas de algodón', 'magic powder', 'polvo mágico',
]

const EXPLOSION_WORDS = [
  'explosion', 'explosión', 'explosivo', 'self-destruct', 'autodestrucción',
  'detonation', 'detonación', 'blast', 'estallido', 'final gambit', 'último recurso',
]

const PUNCH_WORDS = [
  'punch', 'puño', 'punzada', 'comet punch', 'megapunch', 'megapuño', 'fire punch',
  'puño fuego', 'ice punch', 'puño hielo', 'thunder punch', 'puño trueno',
  'mach punch', 'puño certero', 'bullet punch', 'puño bala', 'drain punch',
  'puño drenaje', 'focus punch', 'puño focus', 'hammer arm', 'brazo martillo',
  'dynamic punch', 'puño dinámico', 'close combat', 'a bocajarro', 'meteor mash',
  'puño meteoro', 'shadow punch', 'puño sombra', 'sky uppercut', 'golpe aéreo',
  'storm throw', 'llave giro', 'circle throw', 'llave circular', 'arm thrust',
  'empuje', 'power-up punch', 'puño incremento', 'ice hammer', 'martillo hielo',
]

const BITE_WORDS = [
  'bite', 'mordisco', 'fang', 'colmillo', 'crunch', 'triturar', 'jaw', 'mandíbula',
  'poison fang', 'colmillo veneno', 'fire fang', 'colmillo fuego', 'ice fang',
  'colmillo hielo', 'thunder fang', 'colmillo trueno', 'psychic fangs',
  'psicocolmillo', 'hyper fang', 'hipercolmillo', 'bug bite', 'picadura',
  'fishious rend', 'branch poke', 'mordedura', 'jaw lock', 'trabazón',
]

const SLICING_WORDS = [
  'slash', 'corte', 'cut', 'cuchilla', 'blade', 'sword', 'espada', 'claw', 'garra',
  'leaf blade', 'hoja aguda', 'sacred sword', 'espada santa', 'night slash',
  'tajo umbrío', 'psycho cut', 'psicocorte', 'cross poison', 'veneno cruzado',
  'aerial ace', 'aéreo', 'fury cutter', 'corte furia', 'x-scissor', 'tijera x',
  'razor leaf', 'hoja afilada', 'dragon claw', 'garra dragón', 'metal claw',
  'garra metal', 'shadow claw', 'garra umbría', 'crush claw', 'garra brutal',
  'dragon tail', 'cola dragón', 'breaking swipe', 'golpe arrasador', 'kowtow cleave',
]

const PULSE_WORDS = [
  'pulse', 'pulso', 'aura', 'wave', 'onda', 'dragon pulse', 'pulso dragón',
  'dark pulse', 'pulso umbrío', 'water pulse', 'hidropulso', 'heal pulse',
  'pulso cura', 'aura sphere', 'esfera aural', 'origin pulse', 'pulso origen',
  'dragon energy', 'dracoenergy', 'terrain pulse', 'pulso terreno', 'misty explosion',
]

const WIND_WORDS = [
  'wind', 'viento', 'gust', 'ráfaga', 'twister', 'ciclón', 'hurricane', 'huracán',
  'air cutter', 'viento cortante', 'air slash', 'tajo aéreo', 'tailwind', 'viento afín',
  'fairy wind', 'viento feérico', 'icy wind', 'viento hielo', 'ominous wind',
  'viento aciago', 'razor wind', 'viento cortante', 'bleakwind storm', 'vendaval puro',
]

function moveText(move: Move): string {
  return `${move.name ?? ''} ${move.enName ?? ''} ${move.description ?? ''}`.toLowerCase()
}

function hasWord(move: Move, words: string[]): boolean {
  const text = moveText(move)
  return words.some(w => text.includes(w))
}

export function isSoundMove(move: Move): boolean { return hasWord(move, SOUND_WORDS) }
export function isBallOrBombMove(move: Move): boolean { return hasWord(move, BALL_BOMB_WORDS) }
export function isPowderMove(move: Move): boolean { return hasWord(move, POWDER_WORDS) }
export function isExplosionMove(move: Move): boolean { return hasWord(move, EXPLOSION_WORDS) }
export function isPunchingMove(move: Move): boolean { return hasWord(move, PUNCH_WORDS) }
export function isBitingMove(move: Move): boolean { return hasWord(move, BITE_WORDS) }
export function isSlicingMove(move: Move): boolean { return hasWord(move, SLICING_WORDS) }
export function isPulseMove(move: Move): boolean { return hasWord(move, PULSE_WORDS) }
export function isWindMove(move: Move): boolean { return hasWord(move, WIND_WORDS) }
export function isDamagingMove(move: Move): boolean { return (move.power ?? 0) > 0 }
export function isHealingMove(move: Move): boolean {
  return (move.drainPercent ?? 0) > 0 || /cura|heal|recover|recuper|síntesis|synthesis|rest|descanso|wish|deseo|shine|brillo/i.test(moveText(move))
}
export function isContactMove(move: Move): boolean {
  return move.damageClass !== 'special' && (move.power ?? 0) > 0 && !isSoundMove(move) && !hasWord(move, ['pulso', 'pulse', 'rayo', 'beam', 'bola', 'ball', 'bomba', 'bomb', 'onda', 'wave', 'viento', 'wind'])
}

// ---------------------------------------------------------------------------
// Clima
// ---------------------------------------------------------------------------

export function isWeatherSuppressed(...mons: Array<Pokemon | undefined | null>): boolean {
  return mons.some(m => !!m && m.hp > 0 && (m.ability === 'air-lock' || m.ability === 'cloud-nine'))
}

// Los tipos cambiados por habilidades -ate / Normalize / Voz Fluida.
export function getAbilityMoveType(attacker: Pokemon, move: Move): string {
  const ability = attacker.ability
  if (!ability) return move.type
  if (ability === 'normalize') return 'normal'
  if (move.type !== 'normal') {
    if (ability === 'liquid-voice' && isSoundMove(move)) return 'water'
    return move.type
  }
  switch (ability) {
    case 'aerilate': return 'flying'
    case 'pixilate': return 'fairy'
    case 'refrigerate': return 'ice'
    case 'galvanize': return 'electric'
    case 'dragonize': return 'dragon'
    default: return move.type
  }
}

// Tipos del atacante para calcular STAB (Protean/Libero cambian antes del golpe).
export function getAbilityStabTypes(attacker: Pokemon, moveType: string): string[] {
  const types = attacker.types ?? []
  if ((attacker.ability === 'protean' || attacker.ability === 'libero') && !attacker.abilityState?.protean) {
    return [moveType]
  }
  return types
}

// Cambios de efectividad por habilidades que ignoran inmunidades de tipo.
export function adjustEffectivenessForAbilities(
  attacker: Pokemon,
  moveType: string,
  effectiveness: number,
): number {
  if (effectiveness !== 0) return effectiveness
  const ignoresGhost = attacker.ability === 'scrappy' || attacker.ability === 'minds-eye'
  if (ignoresGhost && (moveType === 'normal' || moveType === 'fighting')) return 1
  return effectiveness
}

// ---------------------------------------------------------------------------
// Inmunidades y absorciones de movimientos
// ---------------------------------------------------------------------------

export interface AbilityMoveImmunity {
  ability: string
  healFraction?: number
  boostStat?: AbilityStatKey
  boostStages?: number
  setFlag?: 'flashFire'
}

const TYPE_ABSORB: Record<string, { types: string[]; heal?: number; boost?: AbilityStatKey; stages?: number }> = {
  'water-absorb': { types: ['water'], heal: 1 / 4 },
  'volt-absorb': { types: ['electric'], heal: 1 / 4 },
  'dry-skin': { types: ['water'], heal: 1 / 4 },
  'flash-fire': { types: ['fire'] },
  'well-baked-body': { types: ['fire'], boost: 'defense', stages: 2 },
  'sap-sipper': { types: ['grass'], boost: 'attack', stages: 1 },
  'lightning-rod': { types: ['electric'], boost: 'spAttack', stages: 1 },
  'motor-drive': { types: ['electric'], boost: 'speed', stages: 1 },
  'storm-drain': { types: ['water'], boost: 'spAttack', stages: 1 },
  'levitate': { types: ['ground'] },
  'earth-eater': { types: ['ground'], heal: 1 / 4 },
  'wind-rider': { types: ['flying'], boost: 'attack', stages: 1 },
}

export function getAbilityMoveImmunity(
  defender: Pokemon,
  move: Move,
  attacker?: Pokemon,
  effectiveness = 1,
): AbilityMoveImmunity | null {
  const ability = defender.ability
  if (!ability || abilityDeniedBy(defender, attacker)) return null

  const absorb = TYPE_ABSORB[ability]
  if (absorb && absorb.types.includes(move.type)) {
    return {
      ability,
      healFraction: absorb.heal,
      boostStat: absorb.boost,
      boostStages: absorb.stages,
      setFlag: ability === 'flash-fire' ? 'flashFire' : undefined,
    }
  }

  if (ability === 'bulletproof' && isBallOrBombMove(move)) return { ability }
  if (ability === 'soundproof' && isSoundMove(move)) return { ability }
  if (ability === 'overcoat' && isPowderMove(move)) return { ability }
  if (ability === 'damp' && isExplosionMove(move)) return { ability }
  if ((ability === 'good-as-gold' || ability === 'magic-bounce') && !isDamagingMove(move)) return { ability }
  if (ability === 'wonder-guard' && isDamagingMove(move) && effectiveness <= 1) return { ability }
  if (ability === 'telepathy' && isDamagingMove(move) && isSoundMove(move)) return { ability }
  if (ability === 'shield-dust' && isPowderMove(move)) return { ability }

  return null
}

// Aplica el efecto de una inmunidad/absorción al defensor.
export function absorbAbilityMove(
  defender: Pokemon,
  immunity: AbilityMoveImmunity,
): { defender: Pokemon; logs: string[] } {
  let updated = defender
  const logs: string[] = []
  const name = abilityNameFor(immunity.ability)
  if (immunity.healFraction) {
    const heal = Math.max(1, Math.floor(updated.maxHp * immunity.healFraction))
    updated = { ...updated, hp: Math.min(updated.maxHp, updated.hp + heal) }
    logs.push(t('b.abilityAbsorb', { name: updated.name, hp: heal, ability: name }))
  }
  if (immunity.boostStat) {
    const stages = abilityStages(updated)
    const key = immunity.boostStat
    const stagesCount = immunity.boostStages ?? 1
    if (stages[key] < 6) {
      const next = Math.min(6, stages[key] + stagesCount)
      updated = { ...updated, statStages: { ...stages, [key]: next } }
      logs.push(t('b.abilityEntryStat', { name: updated.name, ability: name, stat: statLabel(key) }))
    }
  }
  if (immunity.setFlag === 'flashFire') {
    updated = { ...updated, abilityState: { ...(updated.abilityState ?? {}), flashFire: 1 } }
    logs.push(t('b.abilityFlashFire', { name: updated.name, ability: name }))
  }
  return { defender: updated, logs }
}

function statLabel(stat: AbilityStatKey): string {
  const keys: Record<AbilityStatKey, string> = {
    attack: 'stat.attack',
    defense: 'stat.defense',
    spAttack: 'stat.spAtk',
    spDefense: 'stat.spDef',
    speed: 'stat.speed',
  }
  return t(keys[stat])
}

// ---------------------------------------------------------------------------
// Precisión, críticos y prioridad
// ---------------------------------------------------------------------------

export function getAbilityAccuracyMultiplier(
  attacker: Pokemon,
  defender: Pokemon,
  move: Move,
  weather: WeatherKind,
  weatherActive = true,
): number {
  let mult = 1
  if (attacker.ability === 'hustle') mult *= 0.8
  if (attacker.ability === 'victory-star') mult *= 1.1
  if (attacker.ability === 'keen-eye' || attacker.ability === 'illuminate') mult *= 1.1
  if (attacker.ability === 'minds-eye') mult *= 1.5
  if (weatherActive && weather === 'sand' && defender.ability === 'sand-veil') mult *= 0.8
  if (weatherActive && weather === 'hail' && defender.ability === 'snow-cloak') mult *= 0.8
  if (defender.ability === 'tangled-feet' && defender.status?.type === 'confusion') mult *= 0.5
  if (defender.ability === 'illusion' && defender.justEntered) mult *= 0.9
  if (defender.ability === 'wonder-skin' && !isDamagingMove(move)) mult *= 0.5
  if (defender.ability === 'sand-veil' && !weatherActive) mult *= 1
  return Math.max(0.1, Math.min(2, mult))
}

export interface AbilityCritInfo {
  chanceBonus: number
  immune: boolean
  always: boolean
}

export function getAbilityCritInfo(attacker: Pokemon, defender: Pokemon, move: Move): AbilityCritInfo {
  const attackerAbility = attacker.ability
  const defenderAbility = defender.ability
  const immune = defenderAbility === 'battle-armor' || defenderAbility === 'shell-armor'
  const always = attackerAbility === 'merciless' && !!defender.status
  let chanceBonus = 0
  if (attackerAbility === 'super-luck') chanceBonus += 0.125
  if (attackerAbility === 'focus-energy') chanceBonus += 0.125
  if (isSlicingMove(move) && attackerAbility === 'sharpness') chanceBonus += 0.02
  return { chanceBonus, immune, always }
}

export function getAbilityCritMultiplier(attacker: Pokemon): number {
  return attacker.ability === 'sniper' ? 2 : 1.5
}

export function getAbilityPriorityBonus(attacker: Pokemon, move: Move): number {
  let bonus = 0
  if (attacker.ability === 'prankster' && !isDamagingMove(move)) bonus += 1
  if (attacker.ability === 'gale-wings' && move.type === 'flying' && attacker.hp >= attacker.maxHp) bonus += 1
  if (attacker.ability === 'triage' && isHealingMove(move)) bonus += 3
  if (attacker.ability === 'quick-draw' && Math.random() < 0.3) bonus += 1
  if (attacker.ability === 'stall') bonus -= 1
  return bonus
}

// Habilidades que bloquean movimientos con prioridad positiva.
export function blocksPriorityMove(defender: Pokemon): boolean {
  return defender.ability === 'queenly-majesty'
    || defender.ability === 'dazzling'
    || defender.ability === 'armor-tail'
}

// Habilidades de trampa: impiden el cambio voluntario (los Fantasma escapan).
export function isTrappedByAbility(p: Pokemon, opponent: Pokemon | undefined): boolean {
  if (!opponent || opponent.hp <= 0 || p.hp <= 0) return false
  if ((p.types ?? []).includes('ghost')) return false
  if (opponent.ability === 'shadow-tag') return true
  if (opponent.ability === 'arena-trap' && !(p.types ?? []).includes('flying')) return true
  if (opponent.ability === 'magnet-pull' && (p.types ?? []).includes('steel')) return true
  return false
}

// ---------------------------------------------------------------------------
// Velocidad
// ---------------------------------------------------------------------------

export function getAbilitySpeedMultiplier(p: Pokemon, weather: WeatherKind, weatherActive = true): number {
  let mult = 1
  if (weatherActive) {
    if (weather === 'rain' && p.ability === 'swift-swim') mult *= 2
    if (weather === 'sun' && p.ability === 'chlorophyll') mult *= 2
    if (weather === 'sand' && p.ability === 'sand-rush') mult *= 2
    if (weather === 'hail' && p.ability === 'slush-rush') mult *= 2
  }
  if (p.ability === 'quick-feet' && p.status) mult *= 1.5
  if (p.ability === 'unburden' && p.abilityState?.unburden) mult *= 2
  if (p.ability === 'slow-start' && (p.abilityState?.slowstart ?? 5) > 0) mult *= 0.5
  if ((p.ability === 'surge-surfer' || p.ability === 'electric-surge') && p.abilityState?.terrain) mult *= 2
  if (p.ability === 'hero' && p.abilityState?.hero) mult *= 1.5
  return mult
}

// ---------------------------------------------------------------------------
// Multiplicadores de daño
// ---------------------------------------------------------------------------

export interface AbilityDamageContext {
  effectiveness: number
  weather: WeatherKind
  weatherActive: boolean
  isCrit: boolean
  isContact: boolean
  defenderAtFullHp: boolean
  movedLast?: boolean
}

const ateBoost: Record<string, number> = {
  aerilate: 1.2,
  pixilate: 1.2,
  refrigerate: 1.2,
  galvanize: 1.2,
  dragonize: 1.2,
  normalize: 1,
}

// Multiplicadores adicionales que no estaban ya implementados en el combate.
export function getAbilityDamageMultiplier(
  attacker: Pokemon,
  defender: Pokemon,
  move: Move,
  ctx: AbilityDamageContext,
): number {
  let mult = 1
  const atk = attacker.ability
  const def = abilityDeniedBy(defender, attacker) ? undefined : defender.ability

  // --- Ataque: potenciadores de movimiento ---
  if (atk && ateBoost[atk] && move.type === 'normal') mult *= ateBoost[atk]
  if (atk === 'flash-fire' && move.type === 'fire' && attacker.abilityState?.flashFire) mult *= 1.5
  if (atk === 'water-bubble' && move.type === 'water') mult *= 2
  if (atk === 'steelworker' && move.type === 'steel') mult *= 1.5
  if (atk === 'dragons-maw' && move.type === 'dragon') mult *= 1.5
  if (atk === 'rocky-payload' && move.type === 'rock') mult *= 1.5
  if (atk === 'transistor' && move.type === 'electric') mult *= 1.3
  if (atk === 'sharpness' && isSlicingMove(move)) mult *= 1.5
  if (atk === 'strong-jaw' && isBitingMove(move)) mult *= 1.5
  if (atk === 'iron-fist' && isPunchingMove(move)) mult *= 1.2
  if (atk === 'mega-launcher' && isPulseMove(move)) mult *= 1.5
  if (atk === 'punk-rock' && isSoundMove(move)) mult *= 1.3
  if (atk === 'reckless' && (move.recoilPercent ?? 0) > 0) mult *= 1.2
  if (atk === 'sheer-force' && (move.ailment || (move.statChanges?.length ?? 0) > 0)) mult *= 1.3
  if (atk === 'analytic' && ctx.movedLast) mult *= 1.3
  if (atk === 'sand-force' && ctx.weatherActive && ctx.weather === 'sand'
    && ['rock', 'ground', 'steel'].includes(move.type)) mult *= 1.3
  if (atk === 'flare-boost' && attacker.hp >= attacker.maxHp) mult *= 1.5
  if (atk === 'toxic-boost' && !!attacker.status) mult *= 1.5
  if (atk === 'hustle') mult *= 1.5
  if (atk === 'gorilla-tactics') mult *= 1.5
  if (atk === 'defeatist' && attacker.hp > attacker.maxHp / 2) mult *= 0.5
  if (atk === 'slow-start' && (attacker.abilityState?.slowstart ?? 5) > 0) mult *= 0.5
  if (atk === 'orichalcum-pulse' && ctx.weatherActive && ctx.weather === 'sun') mult *= 1.33
  if (atk === 'hadron-engine' && move.damageClass === 'special') mult *= 1.33
  if (atk === 'protosynthesis' && ctx.weatherActive && ctx.weather === 'sun') mult *= 1.3
  if (atk === 'quark-drive') mult *= 1.3
  if (atk === 'neuroforce' && ctx.effectiveness > 1) mult *= 1.25
  if (atk === 'rivalry') {
    const shared = (attacker.types ?? []).some(type => (defender.types ?? []).includes(type))
    mult *= shared ? 1.25 : 0.75
  }
  if (atk === 'stakeout' && defender.justEntered) mult *= 2
  if (atk === 'dark-aura' && move.type === 'dark') mult *= 1.33
  if (atk === 'fairy-aura' && move.type === 'fairy') mult *= 1.33
  if (atk === 'aura-break' && (move.type === 'dark' || move.type === 'fairy')) mult *= 0.75
  if (atk === 'steely-spirit' && move.type === 'steel') mult *= 1.5
  if (atk === 'battery' && move.damageClass === 'special') mult *= 1.3
  if (atk === 'plus' && move.damageClass === 'special') mult *= 1.5
  if (atk === 'minus' && move.damageClass === 'special') mult *= 1.5
  if (atk === 'supreme-overlord') mult *= 1.1
  if (atk === 'mycelium-might' && move.damageClass === 'special') mult *= 1.5
  if (atk === 'mega-sol' && ctx.weatherActive && ctx.weather === 'sun' && move.type === 'fire') mult *= 1.5
  if (atk === 'flower-gift' && ctx.weatherActive && ctx.weather === 'sun') mult *= 1.2
  if (atk === 'fire-mane' && move.type === 'fire') mult *= 1.5
  if (atk === 'parental-bond' && isDamagingMove(move)) mult *= 1.25
  if (atk === 'sword-of-ruin' && move.damageClass !== 'special') mult *= 1.33
  if (atk === 'tablets-of-ruin' && move.damageClass === 'special') mult *= 1.33
  if ((atk === 'wind-power' || atk === 'electromorphosis') && move.type === 'electric' && attacker.abilityState?.charge) mult *= 2

  // --- Defensa: reducciones y debilidades ---
  if (def === 'water-bubble' && move.type === 'fire') mult *= 0.5
  if (def === 'heatproof' && move.type === 'fire') mult *= 0.5
  if (def === 'purifying-salt' && move.type === 'ghost') mult *= 0.5
  if (def === 'fluffy' && ctx.isContact) mult *= 0.5
  if (def === 'fluffy' && move.type === 'fire') mult *= 2
  if (def === 'fur-coat' && move.damageClass !== 'special') mult *= 0.5
  if (def === 'ice-scales' && move.damageClass === 'special') mult *= 0.5
  if (def === 'punk-rock' && isSoundMove(move)) mult *= 0.5
  if ((def === 'filter' || def === 'solid-rock' || def === 'prism-armor') && ctx.effectiveness > 1) mult *= 0.75
  if (def === 'shadow-shield' && ctx.defenderAtFullHp) mult *= 0.5
  if (def === 'tera-shell' && ctx.effectiveness > 1) mult *= 0.5
  if (def === 'vessel-of-ruin' && move.damageClass !== 'special') mult *= 0.75
  if (def === 'beads-of-ruin' && move.damageClass === 'special') mult *= 0.75
  if (def === 'sword-of-ruin' && move.damageClass !== 'special') mult *= 1.33
  if (def === 'tablets-of-ruin' && move.damageClass === 'special') mult *= 1.33
  if (def === 'wonder-guard' && ctx.effectiveness <= 1 && isDamagingMove(move)) mult *= 0
  if (def === 'sap-sipper' && move.type === 'grass') mult *= 0
  if (def === 'well-baked-body' && move.type === 'fire') mult *= 0
  if (def === 'wind-rider' && move.type === 'flying') mult *= 0

  return Math.max(0, mult)
}

// ---------------------------------------------------------------------------
// Estados e inmunidades
// ---------------------------------------------------------------------------

export function getAbilityStatusImmune(
  p: Pokemon,
  ailment: StatusType,
  weather: WeatherKind = 'none',
  weatherActive = true,
): boolean {
  const ability = p.ability
  if (!ability) return false
  if (ability === 'comatose') return true
  if (ability === 'purifying-salt' && (ailment === 'burn' || ailment === 'poison')) return true
  if (ability === 'immunity' && ailment === 'poison') return true
  if (ability === 'pastel-veil' && ailment === 'poison') return true
  if (ability === 'water-veil' && ailment === 'burn') return true
  if (ability === 'water-bubble' && ailment === 'burn') return true
  if (ability === 'thermal-exchange' && ailment === 'burn') return true
  if (ability === 'magma-armor' && ailment === 'freeze') return true
  if (ability === 'limber' && ailment === 'paralysis') return true
  if ((ability === 'insomnia' || ability === 'vital-spirit' || ability === 'sweet-veil') && ailment === 'sleep') return true
  if ((ability === 'own-tempo' || ability === 'oblivious') && ailment === 'confusion') return true
  if (ability === 'inner-focus' && ailment === 'flinch') return true
  if (ability === 'leaf-guard' && weatherActive && weather === 'sun' && ailment !== 'confusion') return true
  if (ability === 'flower-veil' && weatherActive && weather === 'sun' && (p.types ?? []).includes('grass') && ailment !== 'confusion') return true
  if (ability === 'good-as-gold') return true
  return false
}

export function getAbilityStatDropBlocked(
  p: Pokemon,
  stat: AbilityStatKey,
): boolean {
  const ability = p.ability
  if (!ability) return false
  if (ability === 'clear-body' || ability === 'white-smoke' || ability === 'full-metal-body' || ability === 'mirror-armor') return true
  if (ability === 'hyper-cutter' && stat === 'attack') return true
  if (ability === 'big-pecks' && stat === 'defense') return true
  if (ability === 'guard-dog' && stat === 'attack') return true
  if (ability === 'oblivious' && stat === 'attack') return true
  return false
}

export function isIndirectDamageImmune(p: Pokemon): boolean {
  return p.ability === 'magic-guard'
}

// Simple duplica los cambios de stats; Contrario los invierte.
export function adjustAbilityStatChange(p: Pokemon, change: number): number {
  if (p.ability === 'simple') return change * 2
  if (p.ability === 'contrary') return -change
  return change
}

// Reacciones a una bajada de stats (Desafiante, Competitivo, Alarmado).
export function applyAbilityStatDropReaction(
  p: Pokemon,
  change: number,
  stat: AbilityStatKey,
): { pokemon: Pokemon; logs: string[] } {
  let updated = p
  const logs: string[] = []
  if (change >= 0) return { pokemon: updated, logs }
  const reactions: Array<{ ability: string; target: AbilityStatKey; amount: number }> = [
    { ability: 'defiant', target: 'attack', amount: 2 },
    { ability: 'competitive', target: 'spAttack', amount: 2 },
    { ability: 'rattled', target: 'speed', amount: 1 },
  ]
  for (const reaction of reactions) {
    if (updated.ability !== reaction.ability) continue
    const res = addStage(updated, reaction.target, reaction.amount)
    if (res.changed) {
      updated = res.pokemon
      logs.push(t('b.abilityEntryStat', { name: updated.name, ability: abilityNameFor(reaction.ability), stat: statLabel(reaction.target) }))
    }
  }
  if (updated.ability === 'guard-dog' && stat === 'attack') {
    const res = addStage(updated, 'attack', 2)
    if (res.changed) {
      updated = res.pokemon
      logs.push(t('b.abilityEntryStat', { name: updated.name, ability: abilityNameFor('guard-dog'), stat: statLabel('attack') }))
    }
  }
  return { pokemon: updated, logs }
}

export function isWeatherDamageImmune(p: Pokemon, weather: WeatherKind): boolean {
  if (p.ability === 'magic-guard' || p.ability === 'overcoat') return true
  if (weather === 'sand') {
    if (p.ability === 'sand-force' || p.ability === 'sand-rush' || p.ability === 'sand-veil') return true
  }
  if (weather === 'hail' && p.ability === 'ice-body') return true
  return false
}

export function getSleepTick(p: Pokemon): number {
  return p.ability === 'early-bird' ? 2 : 1
}

export function getBurnDamage(p: Pokemon, base: number): number {
  return p.ability === 'heatproof' ? Math.max(1, Math.floor(base / 2)) : base
}

// ---------------------------------------------------------------------------
// Efectos al recibir un golpe
// ---------------------------------------------------------------------------

export interface AbilityOnHitResult {
  attacker: Pokemon
  defender: Pokemon
  logs: string[]
}

function addStage(p: Pokemon, stat: AbilityStatKey, amount: number): { pokemon: Pokemon; changed: boolean } {
  const stages = abilityStages(p)
  const current = stages[stat]
  const next = Math.max(-6, Math.min(6, current + amount))
  if (next === current) return { pokemon: p, changed: false }
  return { pokemon: { ...p, statStages: { ...stages, [stat]: next } }, changed: true }
}

export function applyAbilityOnHit(
  attacker: Pokemon,
  defender: Pokemon,
  move: Move,
  damage: number,
  opts: {
    defenderHpBefore: number
    isContact: boolean
    isCrit: boolean
    weather: WeatherKind
  },
): AbilityOnHitResult {
  let atk = attacker
  let def = defender
  const logs: string[] = []
  if (damage <= 0) return { attacker: atk, defender: def, logs }

  // Disfraz / Cara de Hielo: el primer golpe no hace daño y rompe la máscara.
  if ((def.ability === 'disguise' || def.ability === 'ice-face') && !def.abilityState?.[def.ability]) {
    def = {
      ...def,
      hp: opts.defenderHpBefore,
      abilityState: { ...(def.abilityState ?? {}), [def.ability!]: 1 },
    }
    logs.push(t('b.abilityDisguise', { name: def.name, ability: abilityNameFor(def.ability) }))
    return { attacker: atk, defender: def, logs }
  }

  // Cambio de tipo por Color Cambio (defensor) y Protean/Libero (atacante).
  if (def.ability === 'color-change' && !def.abilityState?.colorChange) {
    def = {
      ...def,
      types: [move.type],
      abilityState: { ...(def.abilityState ?? {}), colorChange: 1 },
    }
    logs.push(t('b.abilityTypeChange', { name: def.name, type: move.type, ability: abilityNameFor(def.ability) }))
  }
  if ((atk.ability === 'protean' || atk.ability === 'libero') && !atk.abilityState?.protean) {
    atk = {
      ...atk,
      types: [move.type],
      abilityState: { ...(atk.abilityState ?? {}), protean: 1 },
    }
    logs.push(t('b.abilityTypeChange', { name: atk.name, type: move.type, ability: abilityNameFor(atk.ability) }))
  }

  // Habilidades defensivas que reaccionan al golpe.
  const defBoosts: Array<{ condition: boolean; stat: AbilityStatKey; amount: number }> = [
    { condition: def.ability === 'stamina', stat: 'defense', amount: 1 },
    { condition: def.ability === 'weak-armor' && opts.isContact, stat: 'speed', amount: 2 },
    { condition: def.ability === 'weak-armor' && opts.isContact, stat: 'defense', amount: -1 },
    { condition: def.ability === 'justified' && move.type === 'dark', stat: 'attack', amount: 1 },
    { condition: def.ability === 'rattled' && ['bug', 'dark', 'ghost'].includes(move.type), stat: 'speed', amount: 1 },
    { condition: def.ability === 'water-compaction' && move.type === 'water', stat: 'defense', amount: 2 },
    { condition: def.ability === 'steam-engine' && (move.type === 'water' || move.type === 'fire'), stat: 'speed', amount: 6 },
    { condition: def.ability === 'thermal-exchange' && move.type === 'fire', stat: 'attack', amount: 1 },
    { condition: def.ability === 'anger-shell' && def.hp <= def.maxHp / 2 && !def.abilityState?.angerShell, stat: 'attack', amount: 1 },
  ]
  for (const boost of defBoosts) {
    if (!boost.condition) continue
    const res = addStage(def, boost.stat, boost.amount)
    if (res.changed) {
      def = res.pokemon
      logs.push(t('b.abilityEntryStat', { name: def.name, ability: abilityNameFor(def.ability), stat: statLabel(boost.stat) }))
    }
  }
  if (def.ability === 'anger-shell' && def.hp <= def.maxHp / 2 && !def.abilityState?.angerShell) {
    def = { ...def, abilityState: { ...(def.abilityState ?? {}), angerShell: 1 } }
    for (const [stat, amount] of [['spAttack', 1], ['speed', 1], ['defense', -1], ['spDefense', -1]] as Array<[AbilityStatKey, number]>) {
      const res = addStage(def, stat, amount)
      if (res.changed) def = res.pokemon
    }
    logs.push(t('b.abilityStatUp', { name: def.name, ability: abilityNameFor('anger-shell') }))
  }
  if (def.ability === 'berserk' && def.hp <= def.maxHp / 2 && !def.abilityState?.berserk) {
    def = { ...def, abilityState: { ...(def.abilityState ?? {}), berserk: 1 } }
    const res = addStage(def, 'spAttack', 1)
    if (res.changed) {
      def = res.pokemon
      logs.push(t('b.abilityEntryStat', { name: def.name, ability: abilityNameFor('berserk'), stat: statLabel('spAttack') }))
    }
  }
  if (def.ability === 'anger-point' && opts.isCrit && !def.abilityState?.angerPoint) {
    def = { ...def, abilityState: { ...(def.abilityState ?? {}), angerPoint: 1 } }
    const res = addStage(def, 'attack', 6)
    if (res.changed) {
      def = res.pokemon
      logs.push(t('b.abilityEntryStat', { name: def.name, ability: abilityNameFor('anger-point'), stat: statLabel('attack') }))
    }
  }
  if (def.ability === 'cursed-body' && !atk.disabled && Math.random() < 0.3) {
    atk = { ...atk, disabled: { move: move.name, turns: 4 } }
    logs.push(t('b.abilityCursedBody', { name: atk.name, move: move.name, ability: abilityNameFor(def.ability) }))
  }
  if (def.ability === 'toxic-debris' && opts.isContact && !atk.status) {
    atk = { ...atk, status: { type: 'poison', turns: 999 } }
    logs.push(t('b.abilityContactStatus', { name: atk.name, status: t('status.poison'), ability: abilityNameFor(def.ability) }))
  }
  if (def.ability === 'seed-sower' && !def.abilityState?.seedSower) {
    def = { ...def, abilityState: { ...(def.abilityState ?? {}), seedSower: 1 } }
    const res = addStage(def, 'defense', 1)
    if (res.changed) {
      def = res.pokemon
      logs.push(t('b.abilityEntryStat', { name: def.name, ability: abilityNameFor(def.ability), stat: statLabel('defense') }))
    }
  }
  if (def.ability === 'wind-power' && isWindMove(move) && !def.abilityState?.charge) {
    def = { ...def, abilityState: { ...(def.abilityState ?? {}), charge: 1 } }
    logs.push(t('b.abilityCharge', { name: def.name, ability: abilityNameFor(def.ability) }))
  }
  if (def.ability === 'electromorphosis' && !def.abilityState?.charge) {
    def = { ...def, abilityState: { ...(def.abilityState ?? {}), charge: 1 } }
    logs.push(t('b.abilityCharge', { name: def.name, ability: abilityNameFor(def.ability) }))
  }

  // Efectos de contacto del defensor (los básicos ya viven en el combate).
  const isContact = opts.isContact && atk.ability !== 'long-reach'
  if (isContact) {
    if (def.ability === 'iron-barbs') {
      const dmg = Math.max(1, Math.floor(atk.maxHp / 8))
      atk = { ...atk, hp: Math.max(1, atk.hp - dmg) }
      logs.push(t('b.abilityRoughSkin', { name: atk.name, dmg, ability: abilityNameFor(def.ability) }))
    }
    if (def.ability === 'gooey' || def.ability === 'tangling-hair') {
      const res = addStage(atk, 'speed', -1)
      if (res.changed) {
        atk = res.pokemon
        logs.push(t('b.abilityEntryDrop', { name: def.name, target: atk.name, stat: statLabel('speed'), ability: abilityNameFor(def.ability) }))
      }
    }
    if (def.ability === 'effect-spore' && !atk.status && Math.random() < 0.3) {
      const options: StatusType[] = ['poison', 'paralysis', 'sleep']
      const status = options[Math.floor(Math.random() * options.length)]
      atk = { ...atk, status: { type: status, turns: status === 'sleep' ? 3 : 999 } }
      logs.push(t('b.abilityContactStatus', { name: atk.name, status: t(`status.${status}` as never), ability: abilityNameFor(def.ability) }))
    }
    if (def.ability === 'cute-charm' && !atk.status && Math.random() < 0.3) {
      const res = addStage(atk, 'attack', -1)
      if (res.changed) {
        atk = res.pokemon
        logs.push(t('b.abilityEntryDrop', { name: def.name, target: atk.name, stat: statLabel('attack'), ability: abilityNameFor(def.ability) }))
      }
    }
    if (def.ability === 'spicy-spray' && move.type === 'fire' && !atk.status && Math.random() < 1) {
      atk = { ...atk, status: { type: 'burn', turns: 999 } }
      logs.push(t('b.abilityContactStatus', { name: atk.name, status: t('status.burn'), ability: abilityNameFor(def.ability) }))
    }
    if (def.ability === 'mummy' && atk.ability !== 'mummy') {
      atk = { ...atk, ability: 'mummy' }
      logs.push(t('b.abilityCopy', { name: atk.name, ability: abilityNameFor('mummy'), ability2: abilityNameFor(def.ability) }))
    }
    if (def.ability === 'lingering-aroma' && atk.ability !== 'lingering-aroma') {
      atk = { ...atk, ability: 'lingering-aroma' }
      logs.push(t('b.abilityCopy', { name: atk.name, ability: abilityNameFor('lingering-aroma'), ability2: abilityNameFor(def.ability) }))
    }
    if (def.ability === 'wandering-spirit' && def.ability !== atk.ability) {
      const old = atk.ability
      atk = { ...atk, ability: def.ability }
      def = { ...def, ability: old }
      logs.push(t('b.abilityCopy', { name: atk.name, ability: abilityNameFor(atk.ability), ability2: abilityNameFor(def.ability) }))
    }
    if ((def.ability === 'pickpocket' || def.ability === 'magician') && atk.holdItem && atk.ability !== 'sticky-hold') {
      const item = atk.holdItem
      atk = { ...atk, holdItem: undefined }
      def = { ...def, holdItem: item }
      logs.push(t('b.abilityItemSteal', { name: def.name, item, ability: abilityNameFor(def.ability) }))
    }
  }

  // Efectos del atacante al golpear (Toque Tóxico / Cadena Tóxica).
  if (def.hp > 0 && !def.status && (atk.ability === 'poison-touch' || atk.ability === 'toxic-chain' || atk.ability === 'poison-puppeteer')) {
    if (Math.random() < 0.3) {
      def = { ...def, status: { type: 'poison', turns: 999 } }
      logs.push(t('b.abilityContactStatus', { name: def.name, status: t('status.poison'), ability: abilityNameFor(atk.ability) }))
    }
  }

  // Reacción al debilitar al rival.
  if (def.hp <= 0) {
    const koBoosts: Array<{ ability: string; stat: AbilityStatKey }> = [
      { ability: 'moxie', stat: 'attack' },
      { ability: 'chilling-neigh', stat: 'attack' },
      { ability: 'grim-neigh', stat: 'spAttack' },
      { ability: 'beast-boost', stat: 'speed' },
      { ability: 'soul-heart', stat: 'spAttack' },
      { ability: 'battle-bond', stat: 'attack' },
      { ability: 'as-one-glastrier', stat: 'attack' },
      { ability: 'as-one-spectrier', stat: 'spAttack' },
    ]
    for (const boost of koBoosts) {
      if (atk.ability !== boost.ability) continue
      const res = addStage(atk, boost.stat, boost.ability === 'beast-boost' ? 1 : 1)
      if (res.changed) {
        atk = res.pokemon
        logs.push(t('b.abilityFaintBoost', { name: atk.name, ability: abilityNameFor(atk.ability), stat: statLabel(boost.stat) }))
      }
    }
  }

  // Represalias al debilitar o al recibir un golpe fuerte.
  if (def.hp <= 0 && def.ability === 'aftermath' && isContact) {
    const dmg = Math.max(1, Math.floor(atk.maxHp / 4))
    atk = { ...atk, hp: Math.max(1, atk.hp - dmg) }
    logs.push(t('b.abilityOpponentDamage', { name: def.name, target: atk.name, dmg, ability: abilityNameFor(def.ability) }))
  }
  if (def.hp > 0 && def.ability === 'innards-out') {
    const dmg = Math.max(1, Math.floor(atk.maxHp / 4))
    atk = { ...atk, hp: Math.max(1, atk.hp - dmg) }
    logs.push(t('b.abilityOpponentDamage', { name: def.name, target: atk.name, dmg, ability: abilityNameFor(def.ability) }))
  }

  return { attacker: atk, defender: def, logs }
}

// ---------------------------------------------------------------------------
// Efectos al entrar / salir
// ---------------------------------------------------------------------------

export interface AbilityEntryResult {
  entering: Pokemon
  logs: string[]
}

export function applyAbilityEntrySelf(entering: Pokemon, opponent: Pokemon): AbilityEntryResult {
  let self = entering
  const logs: string[] = []
  const ability = self.ability
  if (!ability) return { entering: self, logs }

  // Reinicia los estados de habilidades que se activan una vez por entrada.
  const resetFlags = ['protean', 'colorChange', 'angerShell', 'berserk', 'angerPoint', 'disguise', 'ice-face', 'slowstart', 'truant', 'flashFire', 'charge']
  const state = { ...(self.abilityState ?? {}) }
  for (const flag of resetFlags) delete state[flag]
  if (ability === 'slow-start') state.slowstart = 5
  self = { ...self, abilityState: state }

  const boost = (stat: AbilityStatKey, stage: number): void => {
    const res = addStage(self, stat, stage)
    if (res.changed) {
      self = res.pokemon
      logs.push(t('b.abilityEntryStat', { name: self.name, ability: abilityNameFor(ability), stat: statLabel(stat) }))
    }
  }

  if (ability === 'download') {
    const def = opponent.defense ?? 0
    const spDef = opponent.spDefense ?? 0
    boost(def <= spDef ? 'attack' : 'spAttack', 1)
  }
  if (ability === 'intrepid-sword') boost('attack', 1)
  if (ability === 'dauntless-shield') boost('defense', 1)
  if (ability === 'eelevate') boost('speed', 1)
  if (ability === 'fire-mane') boost('speed', 1)
  if (ability === 'zero-to-hero' && self.abilityState?.hero) {
    boost('attack', 1)
    boost('spAttack', 1)
  }
  if (ability === 'hospitality') {
    const heal = Math.max(1, Math.floor(self.maxHp / 4))
    self = { ...self, hp: Math.min(self.maxHp, self.hp + heal) }
    logs.push(t('b.abilityWeatherHeal', { name: self.name, hp: heal, ability: abilityNameFor(ability) }))
  }
  if (ability === 'commander') {
    boost('spAttack', 1)
    boost('defense', 1)
  }
  if (ability === 'electric-surge') boost('speed', 1)
  if (ability === 'grassy-surge') boost('defense', 1)
  if (ability === 'misty-surge') boost('spDefense', 1)
  if (ability === 'psychic-surge') boost('spAttack', 1)
  if (ability === 'tera-shift' || ability === 'teraform-zero' || ability === 'embody-aspect') {
    boost('spAttack', 1)
  }
  if ((ability === 'costar' || ability === 'opportunist') && opponent.statStages) {
    const oppStages = opponent.statStages
    const current = abilityStages(self)
    const copied = { ...current }
    for (const stat of ['attack', 'defense', 'spAttack', 'spDefense', 'speed'] as AbilityStatKey[]) {
      if (oppStages[stat] > current[stat]) copied[stat] = oppStages[stat]
    }
    self = { ...self, statStages: copied }
    logs.push(t('b.abilityCopy', { name: self.name, ability: abilityNameFor(ability), ability2: abilityNameFor(ability) }))
  }
  if ((ability === 'trace' || ability === 'power-of-alchemy' || ability === 'receiver') && opponent.ability) {
    const copyAbility = ability
    self = { ...self, ability: opponent.ability }
    logs.push(t('b.abilityCopy', { name: self.name, ability: abilityNameFor(opponent.ability), ability2: abilityNameFor(copyAbility) }))
  }
  if (ability === 'mimicry') boost('spDefense', 1)
  if (ability === 'rks-system' || ability === 'multitype') boost('spAttack', 1)
  if (ability === 'hunger-switch') boost('attack', 1)
  if (ability === 'imposter') {
    self = { ...self, statStages: opponent.statStages ? { ...opponent.statStages } : self.statStages }
    logs.push(t('b.abilityCopy', { name: self.name, ability: abilityNameFor(opponent.ability ?? ability), ability2: abilityNameFor('imposter') }))
  }
  if (ability === 'pressure' || ability === 'unnerve') {
    logs.push(t('b.abilityPressure', { name: self.name, ability: abilityNameFor(ability) }))
  }
  if (ability === 'frisk') {
    logs.push(t('b.abilityFrisk', { name: self.name, ability: abilityNameFor(ability), target: opponent.name }))
  }
  if (ability === 'forewarn') {
    logs.push(t('b.abilityForewarn', { name: self.name, ability: abilityNameFor(ability), target: opponent.name }))
  }
  if (ability === 'anticipation') {
    logs.push(t('b.abilityAnticipation', { name: self.name, ability: abilityNameFor(ability) }))
  }
  if (ability === 'supersweet-syrup') {
    logs.push(t('b.abilitySupersweet', { name: self.name, ability: abilityNameFor(ability) }))
  }
  if (ability === 'screen-cleaner') {
    logs.push(t('b.abilityScreenCleaner', { name: self.name, ability: abilityNameFor(ability) }))
  }
  if (ability === 'pressure') {
    // Sin efecto mecánico adicional: evita que la habilidad quede vacía.
  }
  return { entering: self, logs }
}

export interface AbilitySwitchOutResult {
  pokemon: Pokemon
  logs: string[]
}

export function applyAbilitySwitchOut(p: Pokemon): AbilitySwitchOutResult {
  let updated = { ...p }
  const logs: string[] = []
  if (updated.ability === 'natural-cure' && updated.status) {
    updated = { ...updated, status: undefined }
    logs.push(t('b.abilityNaturalCure', { name: updated.name, ability: abilityNameFor(updated.ability) }))
  }
  if (updated.ability === 'regenerator' && updated.hp > 0) {
    const heal = Math.max(1, Math.floor(updated.maxHp / 3))
    updated = { ...updated, hp: Math.min(updated.maxHp, updated.hp + heal) }
    logs.push(t('b.abilityWeatherHeal', { name: updated.name, hp: heal, ability: abilityNameFor(updated.ability) }))
  }
  if (updated.ability === 'zero-to-hero') {
    updated = { ...updated, abilityState: { ...(updated.abilityState ?? {}), hero: 1 } }
    logs.push(t('b.abilityForm', { name: updated.name, ability: abilityNameFor(updated.ability) }))
  }
  return { pokemon: updated, logs }
}

// ---------------------------------------------------------------------------
// Efectos al final del turno
// ---------------------------------------------------------------------------

export interface AbilityTurnResult {
  pokemon: Pokemon
  logs: string[]
}

export function applyAbilityEndTurn(
  p: Pokemon,
  weather: WeatherKind,
  opponent?: Pokemon,
  weatherActive = true,
): AbilityTurnResult {
  let updated = { ...p }
  const logs: string[] = []
  if (updated.hp <= 0) return { pokemon: updated, logs }
  const ability = updated.ability

  if (ability === 'ice-body' && weatherActive && weather === 'hail') {
    const heal = Math.max(1, Math.floor(updated.maxHp / 16))
    updated = { ...updated, hp: Math.min(updated.maxHp, updated.hp + heal) }
    logs.push(t('b.abilityWeatherHeal', { name: updated.name, hp: heal, ability: abilityNameFor(ability) }))
  }
  if (ability === 'forecast') {
    const nextType = !weatherActive || weather === 'none' ? 'normal'
      : weather === 'rain' ? 'water'
      : weather === 'sun' ? 'fire'
      : weather === 'hail' ? 'ice'
      : 'normal'
    if ((updated.types ?? []).join(',') !== nextType) {
      updated = { ...updated, types: [nextType] }
      logs.push(t('b.abilityTypeChange', { name: updated.name, type: nextType, ability: abilityNameFor(ability) }))
    }
  }
  if (ability === 'harvest' && !updated.holdItem && (weatherActive && weather === 'sun' || !weatherActive)) {
    const berry = 'Baya Cuaja'
    updated = { ...updated, holdItem: berry }
    logs.push(t('b.abilityHarvest', { name: updated.name, item: berry, ability: abilityNameFor(ability) }))
  }
  if (ability === 'cud-chew' && updated.abilityState?.cudChew && !updated.holdItem) {
    const berry = 'Baya Cuaja'
    updated = { ...updated, holdItem: berry, abilityState: { ...(updated.abilityState ?? {}), cudChew: 0 } }
    logs.push(t('b.abilityHarvest', { name: updated.name, item: berry, ability: abilityNameFor(ability) }))
  }
  if (ability === 'moody') {
    const stats: AbilityStatKey[] = ['attack', 'defense', 'spAttack', 'spDefense', 'speed']
    const up = stats[Math.floor(Math.random() * stats.length)]
    const downPool = stats.filter(s => s !== up)
    const down = downPool[Math.floor(Math.random() * downPool.length)]
    const upRes = addStage(updated, up, 2)
    updated = upRes.pokemon
    const downRes = addStage(updated, down, -1)
    updated = downRes.pokemon
    logs.push(t('b.abilityMoody', { name: updated.name, up: statLabel(up), down: statLabel(down), ability: abilityNameFor(ability) }))
  }
  if (ability === 'slow-start' && (updated.abilityState?.slowstart ?? 5) > 0) {
    const turns = (updated.abilityState?.slowstart ?? 5) - 1
    updated = { ...updated, abilityState: { ...(updated.abilityState ?? {}), slowstart: turns } }
    if (turns === 0) logs.push(t('b.abilitySlowStartEnd', { name: updated.name, ability: abilityNameFor(ability) }))
  }
  if (ability === 'bad-dreams' && opponent && opponent.hp > 0 && opponent.status?.type === 'sleep') {
    const dmg = Math.max(1, Math.floor(opponent.maxHp / 8))
    // El daño se aplica al rival desde el llamador; aquí solo se registra.
    logs.push(t('b.abilityBadDreams', { name: updated.name, target: opponent.name, dmg, ability: abilityNameFor(ability) }))
  }
  if (ability === 'zen-mode' && !updated.abilityState?.zen && updated.hp <= updated.maxHp / 2) {
    updated = { ...updated, abilityState: { ...(updated.abilityState ?? {}), zen: 1 } }
    const res = addStage(updated, 'attack', 1)
    updated = res.pokemon
    const res2 = addStage(updated, 'spAttack', 1)
    updated = res2.pokemon
    const res3 = addStage(updated, 'speed', 1)
    updated = res3.pokemon
    logs.push(t('b.abilityForm', { name: updated.name, ability: abilityNameFor(ability) }))
  }
  if (ability === 'schooling' && !updated.abilityState?.school && updated.hp > updated.maxHp / 4) {
    updated = { ...updated, abilityState: { ...(updated.abilityState ?? {}), school: 1 } }
    const res = addStage(updated, 'attack', 1)
    updated = res.pokemon
    logs.push(t('b.abilityForm', { name: updated.name, ability: abilityNameFor(ability) }))
  }
  if (ability === 'stance-change') {
    const defensive = updated.hp > updated.maxHp / 2
    const current = updated.abilityState?.stance ?? 0
    const target = defensive ? 0 : 1
    if (current !== target) {
      updated = { ...updated, abilityState: { ...(updated.abilityState ?? {}), stance: target } }
      const res = addStage(updated, defensive ? 'defense' : 'attack', 1)
      updated = res.pokemon
      logs.push(t('b.abilityForm', { name: updated.name, ability: abilityNameFor(ability) }))
    }
  }
  if (ability === 'shields-down' && !updated.abilityState?.blade && updated.hp <= updated.maxHp / 2) {
    updated = { ...updated, abilityState: { ...(updated.abilityState ?? {}), blade: 1 } }
    const res = addStage(updated, 'attack', 1)
    updated = res.pokemon
    const res2 = addStage(updated, 'defense', -1)
    updated = res2.pokemon
    logs.push(t('b.abilityForm', { name: updated.name, ability: abilityNameFor(ability) }))
  }
  if (ability === 'power-construct' && !updated.abilityState?.complete && updated.hp <= updated.maxHp / 2) {
    updated = { ...updated, abilityState: { ...(updated.abilityState ?? {}), complete: 1 } }
    for (const stat of ['attack', 'defense', 'spAttack', 'spDefense'] as AbilityStatKey[]) {
      const res = addStage(updated, stat, 1)
      updated = res.pokemon
    }
    logs.push(t('b.abilityForm', { name: updated.name, ability: abilityNameFor(ability) }))
  }
  if (ability === 'ice-face' && updated.abilityState?.['ice-face'] && weatherActive && weather === 'hail') {
    updated = { ...updated, abilityState: { ...(updated.abilityState ?? {}), ['ice-face']: 0 } }
    logs.push(t('b.abilityForm', { name: updated.name, ability: abilityNameFor(ability) }))
  }
  return { pokemon: updated, logs }
}

// ---------------------------------------------------------------------------
// Utilidades para el resto del juego
// ---------------------------------------------------------------------------

export function getAbilityTeamUtility(ability: string): string | null {
  switch (ability) {
    case 'pickup': return 'pickup'
    case 'honey-gather': return 'honey'
    case 'illuminate': return 'illuminate'
    case 'synchronize': return 'synchronize'
    case 'compound-eyes': return 'compound'
    case 'super-luck': return 'luck'
    default: return null
  }
}
