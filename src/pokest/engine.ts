import { getLanguage, type Language } from '../game/i18n'
import {
  POKEST_AFFLICTIONS,
  POKEST_DUNGEONS,
  POKEST_EVENTS,
  POKEST_NODE_LABELS,
  POKEST_VIRTUES,
  createEnemy,
  createHero,
  getAffliction,
  getDungeon,
  getEvent,
  getHeroDef,
  getQuirk,
  getVirtue,
} from './data'
import type {
  PokestDungeonId,
  PokestEventOption,
  PokestHero,
  PokestNode,
  PokestRank,
  PokestRunState,
  PokestSave,
  PokestSkill,
  PokestStatus,
} from './types'

export type TorchLevel = 'bright' | 'dim' | 'dark' | 'black'

const TORCH_COST = 8
const BOSS_TORCH_COST = 15

function L(es: string, en: string): string {
  return getLanguage() === 'en' ? en : es
}

export function cloneRun(run: PokestRunState): PokestRunState {
  return JSON.parse(JSON.stringify(run)) as PokestRunState
}

export function logRun(run: PokestRunState, es: string, en: string): void {
  run.log.push(L(es, en))
  if (run.log.length > 80) run.log.splice(0, run.log.length - 80)
}

export function narrate(run: PokestRunState, es: string, en: string): void {
  run.narrator = es
  run.narratorEn = en
}

export function getQuirkMods(hero: PokestHero): {
  atkPct: number
  defPct: number
  stressPct: number
  stressResist: number
  crit: number
  healPct: number
} {
  const mods = { atkPct: 0, defPct: 0, stressPct: 0, stressResist: 0, crit: 0, healPct: 0 }
  for (const id of hero.quirks ?? []) {
    const quirk = getQuirk(id)
    if (!quirk) continue
    mods.atkPct += quirk.atkPct ?? 0
    mods.defPct += quirk.defPct ?? 0
    mods.stressPct += quirk.stressPct ?? 0
    mods.stressResist += quirk.stressResist ?? 0
    mods.crit += quirk.crit ?? 0
    mods.healPct += quirk.healPct ?? 0
  }
  return mods
}

export function getCurrentCombatant(run: PokestRunState): PokestHero | undefined {
  const id = run.turnOrder[run.turnIndex]
  return [...run.party, ...run.enemies].find((unit) => unit.instanceId === id)
}

export function isHeroTurn(run: PokestRunState): boolean {
  const current = getCurrentCombatant(run)
  return Boolean(current && !current.isEnemy && current.alive && run.phase === 'combat')
}

export function getTorchLevel(torch: number): TorchLevel {
  if (torch > 66) return 'bright'
  if (torch > 33) return 'dim'
  if (torch > 0) return 'dark'
  return 'black'
}

export function torchLabel(level: TorchLevel, language: Language = getLanguage()): string {
  const labels: Record<TorchLevel, { es: string; en: string }> = {
    bright: { es: 'Radiante', en: 'Radiant' },
    dim: { es: 'Tenue', en: 'Dim' },
    dark: { es: 'Oscuridad', en: 'Darkness' },
    black: { es: 'Negro absoluto', en: 'Absolute black' },
  }
  return language === 'en' ? labels[level].en : labels[level].es
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function buildNodes(dungeonId: PokestDungeonId): PokestNode[] {
  const sequence: PokestNode['type'][] = dungeonId === 'crypt'
    ? ['battle', 'event', 'battle', 'camp', 'elite', 'treasure', 'boss']
    : ['battle', 'event', 'battle', 'camp', 'elite', 'event', 'treasure', 'boss']
  return sequence.map((type, index) => ({ id: `node-${index}`, type, done: false }))
}

export function startRun(save: PokestSave, dungeonId: PokestDungeonId, teamIds: string[]): PokestRunState {
  const dungeon = getDungeon(dungeonId)
  const selected = teamIds
    .map((id) => save.roster.find((hero) => hero.instanceId === id))
    .filter((hero): hero is PokestHero => Boolean(hero))
    .slice(0, 4)
  const fallback = save.roster.filter((hero) => hero.alive).slice(0, 4)
  const team = (selected.length > 0 ? selected : fallback).map((hero, index) => ({
    ...hero,
    rank: (index + 1) as PokestRank,
    hp: Math.max(1, hero.hp),
    guard: 0,
    stun: 0,
    bleed: 0,
    blight: 0,
    weak: 0,
    vulnerable: 0,
    cooldowns: {},
  }))
  const run: PokestRunState = {
    dungeonId,
    nodes: buildNodes(dungeonId),
    currentNode: 0,
    torch: 100,
    maxTorch: 100,
    gold: 0,
    provisions: { food: 2, torch: 2, bandage: 2 },
    party: team,
    enemies: [],
    turnOrder: [],
    turnIndex: -1,
    round: 1,
    phase: 'map',
    log: [
      ...dungeon.intro.map((line, index) => (getLanguage() === 'en' ? dungeon.introEn[index] ?? line : line)),
      L('La expedición comienza. La antorcha está encendida.', 'The expedition begins. The torch is lit.'),
    ],
    narrator: dungeon.intro[0],
    narratorEn: dungeon.introEn[0] ?? dungeon.intro[0],
    eventId: null,
    campUsed: false,
    lastReward: null,
    startedAt: Date.now(),
  }
  return run
}

function computeTurnOrder(run: PokestRunState): string[] {
  return [...run.party, ...run.enemies]
    .filter((unit) => unit.alive)
    .map((unit) => {
      const fearPenalty = unit.affliction === 'miedo' ? 0.8 : 1
      return { id: unit.instanceId, speed: unit.spd * fearPenalty + Math.random() * 3 }
    })
    .sort((a, b) => b.speed - a.speed)
    .map((entry) => entry.id)
}

function stepTurnIndex(run: PokestRunState): void {
  run.turnIndex += 1
  if (run.turnIndex >= run.turnOrder.length) {
    run.round += 1
    run.turnOrder = computeTurnOrder(run)
    run.turnIndex = 0
    logRun(run, `— Ronda ${run.round} —`, `— Round ${run.round} —`)
  }
}

function allEnemiesDead(run: PokestRunState): boolean {
  return run.enemies.length > 0 && run.enemies.every((enemy) => !enemy.alive)
}

function allHeroesDead(run: PokestRunState): boolean {
  return run.party.length > 0 && run.party.every((hero) => !hero.alive)
}

function checkCombatEnd(run: PokestRunState): boolean {
  if (run.phase !== 'combat') return true
  if (allEnemiesDead(run)) {
    const node = run.nodes[run.currentNode]
    const dungeon = getDungeon(run.dungeonId)
    const base = node?.type === 'boss' ? dungeon.reward : node?.type === 'elite' ? 55 : 28
    const gold = base + Math.floor(Math.random() * 18)
    run.gold += gold
    run.lastReward = {
      gold,
      text: `El grupo respira. +${gold} de oro.`,
      textEn: `The party breathes. +${gold} gold.`,
    }
    for (const hero of run.party) {
      if (hero.alive) addXp(run, hero, node?.type === 'boss' ? 40 : 14)
    }
    run.phase = 'combatWon'
    narrate(run, 'Otra victoria. Otra cicatriz. La oscuridad no perdona, pero tampoco olvida.', 'Another victory. Another scar. The dark does not forgive, but it does not forget.')
    logRun(run, 'Los enemigos han caído.', 'The enemies have fallen.')
    return true
  }
  if (allHeroesDead(run)) {
    run.phase = 'defeat'
    narrate(run, 'La ruina ha llegado a este lugar. Y vosotros la habéis dejado entrar.', 'Ruin has come to this place. And you let it in.')
    logRun(run, 'La última luz se apaga. La expedición ha fracasado.', 'The last light goes out. The expedition has failed.')
    return true
  }
  return false
}

function nextTurnOrStop(run: PokestRunState): void {
  stepTurnIndex(run)
}

function processCurrentTurn(run: PokestRunState): void {
  let safety = 0
  while (safety < 60) {
    safety += 1
    if (checkCombatEnd(run)) return
    if (run.turnOrder.length === 0) {
      run.turnOrder = computeTurnOrder(run)
      run.turnIndex = 0
      if (run.turnOrder.length === 0) {
        checkCombatEnd(run)
        return
      }
    }
    const current = getCurrentCombatant(run)
    if (!current || !current.alive) {
      nextTurnOrStop(run)
      continue
    }
    if (current.stun > 0) {
      current.stun -= 1
      logRun(run, `${current.name} está aturdido y pierde el turno.`, `${current.name} is stunned and loses the turn.`)
      nextTurnOrStop(run)
      continue
    }
    if (current.bleed > 0) {
      const damage = 8 + Math.floor(Math.random() * 5)
      applyRawDamage(run, current, damage, 'Sangrado', 'Bleed')
      current.bleed -= 1
      if (!current.alive) {
        nextTurnOrStop(run)
        continue
      }
    }
    if (current.blight > 0) {
      const damage = 7 + Math.floor(Math.random() * 5)
      applyRawDamage(run, current, damage, 'Corrosión', 'Blight')
      current.blight -= 1
      if (!current.alive) {
        nextTurnOrStop(run)
        continue
      }
    }
    for (const key of Object.keys(current.cooldowns)) {
      current.cooldowns[key] = Math.max(0, current.cooldowns[key] - 1)
    }
    return
  }
}

export function advanceTurn(run: PokestRunState): void {
  if (run.phase !== 'combat') return
  stepTurnIndex(run)
  processCurrentTurn(run)
}

function endTurn(run: PokestRunState): void {
  const current = getCurrentCombatant(run)
  if (current) {
    if (current.guard > 0) current.guard -= 1
    if (current.weak > 0) current.weak -= 1
    if (current.vulnerable > 0) current.vulnerable -= 1
  }
  advanceTurn(run)
}

function addXp(run: PokestRunState, hero: PokestHero, amount: number): void {
  if (!hero.alive) return
  hero.xp += amount
  const threshold = hero.level * 30
  if (hero.xp >= threshold) {
    hero.xp -= threshold
    hero.level += 1
    const hpGain = Math.max(4, Math.round(hero.maxHp * 0.08))
    const atkGain = Math.max(1, Math.round(hero.atk * 0.08))
    const defGain = Math.max(1, Math.round(hero.def * 0.08))
    const spdGain = Math.max(1, Math.round(hero.spd * 0.05))
    hero.maxHp += hpGain
    hero.hp = Math.min(hero.maxHp, hero.hp + hpGain)
    hero.atk += atkGain
    hero.def += defGain
    hero.spd += spdGain
    logRun(run, `${hero.name} alcanza el nivel ${hero.level}.`, `${hero.name} reaches level ${hero.level}.`)
  }
}

export function trainHero(hero: PokestHero, amount: number): boolean {
  if (!hero.alive) return false
  let leveled = false
  hero.xp += amount
  while (hero.xp >= hero.level * 30) {
    hero.xp -= hero.level * 30
    hero.level += 1
    const hpGain = Math.max(4, Math.round(hero.maxHp * 0.08))
    const atkGain = Math.max(1, Math.round(hero.atk * 0.08))
    const defGain = Math.max(1, Math.round(hero.def * 0.08))
    const spdGain = Math.max(1, Math.round(hero.spd * 0.05))
    hero.maxHp += hpGain
    hero.hp = Math.min(hero.maxHp, hero.hp + hpGain)
    hero.atk += atkGain
    hero.def += defGain
    hero.spd += spdGain
    leveled = true
  }
  return leveled
}

function applyStatus(target: PokestHero, status: PokestStatus, turns: number): void {
  if (!target.alive) return
  if (status === 'bleed') target.bleed = Math.max(target.bleed, turns)
  if (status === 'blight') target.blight = Math.max(target.blight, turns)
  if (status === 'stun') target.stun = Math.max(target.stun, turns)
  if (status === 'weak') target.weak = Math.max(target.weak, turns)
  if (status === 'vulnerable') target.vulnerable = Math.max(target.vulnerable, turns)
}

function addStress(run: PokestRunState, hero: PokestHero, amount: number): void {
  if (hero.isEnemy || !hero.alive) return
  const mods = getQuirkMods(hero)
  let value = amount
  if (hero.affliction === 'paranoia') value *= 1.3
  if (hero.affliction === 'ira') value *= 1.2
  if (hero.virtue === 'templanza') value *= 0.8
  value *= 1 + mods.stressPct
  if (run.torch < 34) value *= 1.15
  if (run.torch <= 0) value *= 1.3
  value = Math.max(0, Math.round(value * (1 - (hero.stressResist + mods.stressResist) / 100)))
  if (value <= 0) return
  const before = hero.stress
  hero.stress = clamp(hero.stress + value, 0, 200)
  const actual = hero.stress - before
  if (actual > 0) logRun(run, `${hero.name} gana ${actual} de estrés.`, `${hero.name} gains ${actual} stress.`)
  if (hero.stress >= 100 && !hero.affliction && !hero.virtue) {
    resolveStress(run, hero)
  }
  if (hero.stress >= 200 && hero.alive) {
    if (hero.deathsDoor) {
      hero.hp = 0
      hero.alive = false
      logRun(run, `El corazón de ${hero.name} no resiste. Ha muerto.`, `${hero.name}'s heart gives out. They have died.`)
    } else {
      hero.hp = 0
      hero.deathsDoor = true
      hero.stress = 200
      logRun(run, `${hero.name} sufre un ataque al corazón y queda al borde de la muerte.`, `${hero.name} suffers a heart attack and is at death's door.`)
    }
  }
}

function resolveStress(run: PokestRunState, hero: PokestHero): void {
  const isVirtue = Math.random() < 0.25
  if (isVirtue) {
    const virtue = randomFrom(POKEST_VIRTUES)
    hero.virtue = virtue.id
    narrate(run, 'La mente se rompe... pero encuentra algo más fuerte al otro lado.', 'The mind breaks... but finds something stronger on the other side.')
    logRun(run, `${hero.name} resiste la oscuridad: ${virtue.name}.`, `${hero.name} resists the darkness: ${virtue.nameEn}.`)
  } else {
    const affliction = randomFrom(POKEST_AFFLICTIONS)
    hero.affliction = affliction.id
    narrate(run, 'La oscuridad encuentra una grieta. Y entra.', 'The darkness finds a crack. And it enters.')
    logRun(run, `${hero.name} sucumbe a la aflicción: ${affliction.name}.`, `${hero.name} succumbs to the affliction: ${affliction.nameEn}.`)
  }
}

function reduceStress(run: PokestRunState, hero: PokestHero, amount: number): void {
  if (hero.isEnemy || !hero.alive) return
  let value = amount
  if (hero.virtue === 'esperanza') value *= 1.2
  if (hero.affliction === 'obsesion') value *= 0.8
  value = Math.max(0, Math.round(value))
  if (value <= 0) return
  const before = hero.stress
  hero.stress = clamp(hero.stress - value, 0, 200)
  const actual = before - hero.stress
  if (actual > 0) logRun(run, `${hero.name} reduce ${actual} de estrés.`, `${hero.name} reduces ${actual} stress.`)
}

function healTarget(run: PokestRunState, target: PokestHero, amount: number): void {
  if (!target.alive || target.isEnemy) return
  const mods = getQuirkMods(target)
  const before = target.hp
  target.hp = Math.min(target.maxHp, target.hp + Math.round(amount * (1 + mods.healPct)))
  if (target.hp > 0) target.deathsDoor = false
  const healed = target.hp - before
  if (healed > 0) {
    logRun(run, `${target.name} recupera ${healed} PS.`, `${target.name} recovers ${healed} HP.`)
  }
}

function killTarget(run: PokestRunState, target: PokestHero): void {
  target.hp = 0
  target.alive = false
  if (target.isEnemy) {
    logRun(run, `${target.name} ha sido derrotado.`, `${target.name} has been defeated.`)
  } else {
    narrate(run, 'Un héroe ha caído. Su nombre se queda en la piedra y en la memoria.', 'A hero has fallen. Their name remains in stone and memory.')
    logRun(run, `${target.name} ha muerto. Esta pérdida es permanente.`, `${target.name} has died. This loss is permanent.`)
  }
}

function applyRawDamage(run: PokestRunState, target: PokestHero, amount: number, sourceEs: string, sourceEn: string): void {
  if (!target.alive) return
  if (target.deathsDoor) {
    killTarget(run, target)
    return
  }
  const damage = Math.max(1, Math.round(amount))
  target.hp -= damage
  logRun(run, `${sourceEs}: ${target.name} recibe ${damage} de daño.`, `${sourceEn}: ${target.name} takes ${damage} damage.`)
  if (target.hp <= 0) {
    if (target.isEnemy) {
      killTarget(run, target)
    } else {
      target.hp = 0
      target.deathsDoor = true
      logRun(run, `${target.name} está en la puerta de la muerte.`, `${target.name} is at death's door.`)
    }
  }
}

function dealDamage(run: PokestRunState, attacker: PokestHero, target: PokestHero, skill: PokestSkill): void {
  if (!target.alive) return
  if (target.deathsDoor) {
    killTarget(run, target)
    return
  }
  const attackerMods = getQuirkMods(attacker)
  const targetMods = getQuirkMods(target)
  const crit = Math.random() * 100 < skill.crit + attackerMods.crit
  let damage = skill.power + attacker.atk * 0.9 - target.def * 0.45
  damage *= 1 + attackerMods.atkPct
  damage *= 1 - targetMods.defPct
  if (attacker.weak > 0) damage *= 0.75
  if (attacker.affliction === 'ira') damage *= 1.1
  if (attacker.affliction === 'miedo' || attacker.affliction === 'obsesion') damage *= 0.85
  if (attacker.virtue === 'valor') damage *= 1.15
  if (target.guard > 0) damage *= 0.5
  if (target.vulnerable > 0) damage *= 1.25
  if (target.virtue === 'determinacion') damage *= 0.9
  if (attacker.isEnemy && run.torch < 34) damage *= 1.15
  if (attacker.isEnemy && run.torch <= 0) damage *= 1.3
  damage *= 0.9 + Math.random() * 0.2
  if (crit) damage *= 1.5
  const finalDamage = Math.max(1, Math.round(damage))
  target.hp -= finalDamage
  const stressGain = skill.stressDamage ?? Math.round(finalDamage * 0.3)
  logRun(
    run,
    `${attacker.name} usa ${skill.name} sobre ${target.name}: ${finalDamage} de daño${crit ? ' ¡CRÍTICO!' : ''}.`,
    `${attacker.name} uses ${skill.nameEn} on ${target.name}: ${finalDamage} damage${crit ? ' CRITICAL!' : ''}.`,
  )
  if (!target.isEnemy) {
    addStress(run, target, stressGain + (crit ? 3 : 0))
  }
  if (target.hp <= 0) {
    if (target.isEnemy) {
      killTarget(run, target)
    } else {
      target.hp = 0
      target.deathsDoor = true
      logRun(run, `${target.name} está en la puerta de la muerte.`, `${target.name} is at death's door.`)
    }
  }
}

function getOpponents(run: PokestRunState, attacker: PokestHero): PokestHero[] {
  return attacker.isEnemy ? run.party : run.enemies
}

function getAllies(run: PokestRunState, attacker: PokestHero): PokestHero[] {
  return attacker.isEnemy ? run.enemies : run.party
}

export function getTargetCandidates(run: PokestRunState, attacker: PokestHero, skill: PokestSkill): PokestHero[] {
  if (skill.target === 'self') return [attacker]
  if (skill.target === 'allEnemies') {
    return getOpponents(run, attacker).filter((unit) => unit.alive && (skill.targetRanks.length === 0 || skill.targetRanks.includes(unit.rank)))
  }
  if (skill.target === 'allAllies') {
    return getAllies(run, attacker).filter((unit) => unit.alive)
  }
  if (skill.target === 'ally') {
    return getAllies(run, attacker).filter((unit) => unit.alive)
  }
  return getOpponents(run, attacker).filter((unit) => unit.alive && (skill.targetRanks.length === 0 || skill.targetRanks.includes(unit.rank)))
}

function resolveTargets(run: PokestRunState, attacker: PokestHero, skill: PokestSkill, targetId?: string): PokestHero[] {
  const candidates = getTargetCandidates(run, attacker, skill)
  if (candidates.length === 0) return []
  if (skill.target === 'self' || skill.target === 'allEnemies' || skill.target === 'allAllies') return candidates
  if (targetId) {
    const chosen = candidates.find((unit) => unit.instanceId === targetId)
    return chosen ? [chosen] : []
  }
  return [randomFrom(candidates)]
}

function applySkillToTarget(run: PokestRunState, attacker: PokestHero, skill: PokestSkill, target: PokestHero): void {
  if (!target.alive) return
  if (skill.effect === 'damage') {
    if (Math.random() * 100 > skill.accuracy) {
      logRun(run, `${attacker.name} falla ${skill.name}.`, `${attacker.name} misses ${skill.nameEn}.`)
      return
    }
    dealDamage(run, attacker, target, skill)
    if (skill.status && target.alive) {
      applyStatus(target, skill.status, skill.statusTurns ?? 2)
    }
    return
  }
  if (skill.effect === 'heal') {
    healTarget(run, target, skill.power)
    if (skill.stressHeal) reduceStress(run, target, skill.stressHeal)
    return
  }
  if (skill.effect === 'stressHeal') {
    reduceStress(run, target, skill.power)
    if (skill.heal) healTarget(run, target, skill.heal)
    return
  }
  if (skill.effect === 'guard') {
    target.guard = Math.max(target.guard, skill.statusTurns ?? 2)
    if (skill.heal) healTarget(run, target, skill.heal)
    logRun(run, `${target.name} queda protegido.`, `${target.name} is protected.`)
    return
  }
  if (skill.effect === 'stressDamage') {
    if (!target.isEnemy) {
      addStress(run, target, skill.stressDamage ?? skill.power)
    }
    logRun(run, `${attacker.name} usa ${skill.name} sobre ${target.name}.`, `${attacker.name} uses ${skill.nameEn} on ${target.name}.`)
    if (skill.status && target.alive) applyStatus(target, skill.status, skill.statusTurns ?? 2)
    return
  }
  if (skill.stressDamage && !target.isEnemy) {
    addStress(run, target, skill.stressDamage)
  }
}

export function canUseSkill(run: PokestRunState, hero: PokestHero, skill: PokestSkill): boolean {
  if (run.phase !== 'combat') return false
  const current = getCurrentCombatant(run)
  if (!current || current.instanceId !== hero.instanceId || current.isEnemy) return false
  if (!hero.alive || hero.stun > 0) return false
  if (!skill.rank.includes(hero.rank)) return false
  if ((hero.cooldowns[skill.id] ?? 0) > 0) return false
  return getTargetCandidates(run, hero, skill).length > 0
}

export function passTurn(run: PokestRunState): void {
  if (run.phase !== 'combat') return
  const current = getCurrentCombatant(run)
  if (!current || current.isEnemy || !current.alive) return
  logRun(run, `${current.name} espera y observa.`, `${current.name} waits and watches.`)
  endTurn(run)
}

export function canMoveHero(run: PokestRunState, hero: PokestHero, direction: -1 | 1): boolean {
  if (run.phase !== 'combat' || !hero.alive) return false
  const current = getCurrentCombatant(run)
  if (!current || current.instanceId !== hero.instanceId || current.isEnemy) return false
  const targetRank = hero.rank + direction
  return targetRank >= 1 && targetRank <= 4
}

export function moveHero(run: PokestRunState, heroId: string, direction: -1 | 1): boolean {
  const hero = run.party.find((unit) => unit.instanceId === heroId)
  if (!hero || !canMoveHero(run, hero, direction)) return false
  const oldRank = hero.rank
  const targetRank = (hero.rank + direction) as PokestRank
  const other = run.party.find((unit) => unit.instanceId !== hero.instanceId && unit.rank === targetRank)
  hero.rank = targetRank
  if (other) other.rank = oldRank
  const verbEs = direction < 0 ? 'avanza' : 'retrocede'
  const verbEn = direction < 0 ? 'advances' : 'retreats'
  logRun(run, `${hero.name} ${verbEs} al rango ${targetRank}.`, `${hero.name} ${verbEn} to rank ${targetRank}.`)
  endTurn(run)
  return true
}

export function useHeroSkill(run: PokestRunState, heroId: string, skillId: string, targetId?: string): boolean {
  const hero = run.party.find((unit) => unit.instanceId === heroId)
  if (!hero || !hero.alive || run.phase !== 'combat') return false
  const current = getCurrentCombatant(run)
  if (!current || current.instanceId !== heroId || current.isEnemy) return false
  const skill = hero.skills.find((item) => item.id === skillId)
  if (!skill) return false
  if (!canUseSkill(run, hero, skill)) return false
  const targets = resolveTargets(run, hero, skill, targetId)
  if (targets.length === 0) return false
  hero.cooldowns[skill.id] = skill.cooldown
  logRun(run, `${hero.name} usa ${skill.name}.`, `${hero.name} uses ${skill.nameEn}.`)
  for (const target of targets) applySkillToTarget(run, hero, skill, target)
  endTurn(run)
  return true
}

export function performEnemyTurn(run: PokestRunState): void {
  if (run.phase !== 'combat') return
  const current = getCurrentCombatant(run)
  if (!current || !current.isEnemy || !current.alive) return
  const usable = current.skills.filter((skill) => {
    if (!skill.rank.includes(current.rank)) return false
    if ((current.cooldowns[skill.id] ?? 0) > 0) return false
    return getTargetCandidates(run, current, skill).length > 0
  })
  if (usable.length === 0) {
    logRun(run, `${current.name} duda y pierde el turno.`, `${current.name} hesitates and loses the turn.`)
    endTurn(run)
    return
  }
  const skill = randomFrom(usable)
  const targets = resolveTargets(run, current, skill)
  current.cooldowns[skill.id] = skill.cooldown
  logRun(run, `${current.name} usa ${skill.name}.`, `${current.name} uses ${skill.nameEn}.`)
  for (const target of targets) applySkillToTarget(run, current, skill, target)
  endTurn(run)
}

export function enterNode(run: PokestRunState): void {
  if (run.phase !== 'map') return
  const node = run.nodes[run.currentNode]
  if (!node) {
    run.phase = 'victory'
    return
  }
  run.torch = clamp(run.torch - (node.type === 'boss' ? BOSS_TORCH_COST : TORCH_COST), 0, run.maxTorch)
  if (run.torch <= 0) {
    logRun(run, 'La antorcha se apaga. La oscuridad os rodea.', 'The torch goes out. Darkness surrounds you.')
  } else if (run.torch < 34) {
    logRun(run, 'La luz es débil. Los monstruos parecen más audaces.', 'The light is weak. The monsters seem bolder.')
  }
  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
    startCombat(run, node)
    return
  }
  if (node.type === 'event') {
    const event = randomFrom(POKEST_EVENTS)
    run.eventId = event.id
    run.phase = 'event'
    logRun(run, `Evento: ${event.title}.`, `Event: ${event.titleEn}.`)
    return
  }
  if (node.type === 'camp') {
    run.phase = 'camp'
    run.campUsed = false
    logRun(run, 'Encontráis un lugar seguro para acampar.', 'You find a safe place to camp.')
    return
  }
  if (node.type === 'treasure') {
    const gold = 40 + Math.floor(Math.random() * 30)
    run.gold += gold
    run.lastReward = {
      gold,
      text: `Un cofre polvoriento contiene ${gold} de oro.`,
      textEn: `A dusty chest contains ${gold} gold.`,
    }
    run.phase = 'treasure'
    logRun(run, `Tesoro: +${gold} de oro.`, `Treasure: +${gold} gold.`)
  }
}

function startCombat(run: PokestRunState, node: PokestNode): void {
  const dungeon = getDungeon(run.dungeonId)
  const count = node.type === 'boss' ? 2 : node.type === 'elite' ? 3 : 2 + (Math.random() < 0.45 ? 1 : 0)
  const enemies: PokestHero[] = []
  for (let index = 0; index < count; index += 1) {
    const isBoss = node.type === 'boss' && index === 0
    const enemyId = isBoss ? dungeon.bossPool[0] : randomFrom(dungeon.enemyPool)
    const level = dungeon.level + Math.floor(run.currentNode / 3) + (node.type === 'elite' ? 1 : 0)
    enemies.push(createEnemy(enemyId, level, (index + 1) as PokestRank))
  }
  run.enemies = enemies
  run.turnOrder = computeTurnOrder(run)
  run.turnIndex = -1
  run.round = 1
  run.phase = 'combat'
  narrate(run, 'La campana de la expedición repica. No hay marcha atrás.', 'The expedition bell tolls. There is no turning back.')
  logRun(run, '¡Los enemigos bloquean el paso!', 'Enemies block the way!')
  if (node.type === 'boss') {
    narrate(run, 'Algo antiguo respira en la oscuridad. La dungeon muestra su verdadero rostro.', 'Something ancient breathes in the dark. The dungeon shows its true face.')
    logRun(run, 'Una presencia enorme llena la sala. Es el jefe de la dungeon.', 'An enormous presence fills the room. It is the dungeon boss.')
  }
  advanceTurn(run)
}

export function completeCombat(run: PokestRunState): void {
  if (run.phase !== 'combatWon') return
  const node = run.nodes[run.currentNode]
  run.enemies = []
  run.turnOrder = []
  run.turnIndex = 0
  if (node) node.done = true
  if (node?.type === 'boss' || run.currentNode >= run.nodes.length - 1) {
    run.phase = 'victory'
    narrate(run, 'La dungeon calla. Por ahora. Pero la victoria tiene un precio, y siempre se cobra.', 'The dungeon falls silent. For now. But victory has a price, and it always collects.')
    logRun(run, 'La dungeon ha sido conquistada.', 'The dungeon has been conquered.')
  } else {
    completeNode(run)
  }
}

export function completeNode(run: PokestRunState): void {
  const node = run.nodes[run.currentNode]
  if (node) node.done = true
  run.currentNode += 1
  run.eventId = null
  run.campUsed = false
  run.lastReward = null
  if (run.currentNode >= run.nodes.length) {
    run.phase = 'victory'
    logRun(run, 'La dungeon ha sido conquistada.', 'The dungeon has been conquered.')
  } else {
    run.phase = 'map'
    const next = run.nodes[run.currentNode]
    if (next) {
      logRun(run, `El camino continúa hacia ${POKEST_NODE_LABELS[next.type].es.toLowerCase()}.`, `The path continues toward the ${POKEST_NODE_LABELS[next.type].en.toLowerCase()}.`)
    }
  }
}

export function collectTreasure(run: PokestRunState): void {
  if (run.phase !== 'treasure') return
  completeNode(run)
}

function optionRequirementsMet(run: PokestRunState, option: PokestEventOption): boolean {
  const req = option.requires
  if (!req) return true
  if (req.food && run.provisions.food < req.food) return false
  if (req.torch && run.provisions.torch < req.torch) return false
  if (req.bandage && run.provisions.bandage < req.bandage) return false
  if (req.gold && run.gold < req.gold) return false
  return true
}

export function canChooseEventOption(run: PokestRunState, option: PokestEventOption): boolean {
  return optionRequirementsMet(run, option)
}

function payRequirements(run: PokestRunState, option: PokestEventOption): void {
  if (option.effect.type === 'gamble') return
  const req = option.requires
  if (!req) return
  if (req.food) run.provisions.food = Math.max(0, run.provisions.food - req.food)
  if (req.torch) run.provisions.torch = Math.max(0, run.provisions.torch - req.torch)
  if (req.bandage) run.provisions.bandage = Math.max(0, run.provisions.bandage - req.bandage)
  if (req.gold) run.gold = Math.max(0, run.gold - req.gold)
}

export function applyEventOption(run: PokestRunState, optionId: string): boolean {
  if (run.phase !== 'event') return false
  const event = getEvent(run.eventId)
  const option = event?.options.find((item) => item.id === optionId)
  if (!event || !option) return false
  if (!optionRequirementsMet(run, option)) {
    logRun(run, 'No tenéis los recursos necesarios.', 'You lack the required resources.')
    return false
  }
  payRequirements(run, option)
  const effect = option.effect
  if (effect.type === 'stressHealAll') {
    for (const hero of run.party) reduceStress(run, hero, effect.value)
  } else if (effect.type === 'stressDamageAll') {
    for (const hero of run.party) addStress(run, hero, effect.value)
  } else if (effect.type === 'healAll') {
    for (const hero of run.party) healTarget(run, hero, effect.value)
  } else if (effect.type === 'damageAll') {
    for (const hero of run.party) applyRawDamage(run, hero, effect.value, 'Trampa', 'Trap')
  } else if (effect.type === 'gold') {
    run.gold = Math.max(0, run.gold + effect.value)
    logRun(run, `Oro ${effect.value >= 0 ? '+' : ''}${effect.value}.`, `Gold ${effect.value >= 0 ? '+' : ''}${effect.value}.`)
  } else if (effect.type === 'torch') {
    run.torch = clamp(run.torch + effect.value, 0, run.maxTorch)
    logRun(run, `Antorcha ${effect.value >= 0 ? '+' : ''}${effect.value}.`, `Torch ${effect.value >= 0 ? '+' : ''}${effect.value}.`)
  } else if (effect.type === 'food') {
    run.provisions.food = Math.max(0, run.provisions.food + effect.value)
    logRun(run, `Raciones ${effect.value >= 0 ? '+' : ''}${effect.value}.`, `Rations ${effect.value >= 0 ? '+' : ''}${effect.value}.`)
  } else if (effect.type === 'bandage') {
    run.provisions.bandage = Math.max(0, run.provisions.bandage + effect.value)
    logRun(run, `Vendas ${effect.value >= 0 ? '+' : ''}${effect.value}.`, `Bandages ${effect.value >= 0 ? '+' : ''}${effect.value}.`)
  } else if (effect.type === 'healRandom') {
    const target = randomFrom(run.party.filter((hero) => hero.alive))
    if (target) healTarget(run, target, effect.value)
  } else if (effect.type === 'damageRandom') {
    const target = randomFrom(run.party.filter((hero) => hero.alive))
    if (target) applyRawDamage(run, target, effect.value, 'Trampa', 'Trap')
  } else if (effect.type === 'cureBleedAll') {
    for (const hero of run.party) {
      hero.bleed = 0
      hero.blight = 0
    }
    logRun(run, 'Las heridas han sido limpiadas.', 'The wounds have been cleaned.')
  } else if (effect.type === 'gamble') {
    if (Math.random() < 0.5) {
      run.gold += 50
      logRun(run, '¡La suerte sonríe! +50 de oro.', 'Luck smiles! +50 gold.')
    } else {
      run.gold = Math.max(0, run.gold - effect.value)
      for (const hero of run.party) addStress(run, hero, 10)
      logRun(run, 'La suerte se vuelve cruel. Pérdida de oro y estrés.', 'Luck turns cruel. Gold lost and stress gained.')
    }
  }
  if (option.stress) {
    for (const hero of run.party) addStress(run, hero, option.stress)
  }
  logRun(run, `${event.title}: ${option.label}.`, `${event.titleEn}: ${option.labelEn}.`)
  if (allHeroesDead(run)) {
    run.phase = 'defeat'
    return true
  }
  completeNode(run)
  return true
}

export function campAction(run: PokestRunState, actionId: string): boolean {
  if (run.phase !== 'camp' || run.campUsed) return false
  if (actionId === 'eat') {
    if (run.provisions.food < 1) return false
    run.provisions.food -= 1
    for (const hero of run.party) {
      healTarget(run, hero, Math.round(hero.maxHp * 0.25))
      reduceStress(run, hero, 15)
    }
    logRun(run, 'El grupo comparte una ración junto al fuego.', 'The party shares a ration by the fire.')
  } else if (actionId === 'torch') {
    if (run.provisions.torch < 1) return false
    run.provisions.torch -= 1
    run.torch = clamp(run.torch + 35, 0, run.maxTorch)
    for (const hero of run.party) reduceStress(run, hero, 5)
    logRun(run, 'La antorcha arde de nuevo con fuerza.', 'The torch burns bright again.')
  } else if (actionId === 'bandage') {
    if (run.provisions.bandage < 1) return false
    run.provisions.bandage -= 1
    for (const hero of run.party) {
      healTarget(run, hero, 15)
      hero.bleed = 0
      hero.blight = 0
    }
    logRun(run, 'Las vendas limpian las heridas y el veneno.', 'Bandages clean wounds and poison.')
  } else if (actionId === 'sleep') {
    for (const hero of run.party) reduceStress(run, hero, 20)
    run.torch = clamp(run.torch - 10, 0, run.maxTorch)
    logRun(run, 'El grupo duerme un rato. La antorcha se consume.', 'The party sleeps for a while. The torch burns down.')
  } else {
    return false
  }
  run.campUsed = true
  completeNode(run)
  return true
}

export function retreatRun(run: PokestRunState): void {
  if (run.phase === 'victory' || run.phase === 'defeat' || run.phase === 'retreat') return
  run.phase = 'retreat'
  logRun(run, 'El grupo abandona la expedición y vuelve al pueblo.', 'The party abandons the expedition and returns to town.')
}

export function skillStatusLabel(status: PokestStatus, language: Language = getLanguage()): string {
  const labels: Record<PokestStatus, { es: string; en: string }> = {
    bleed: { es: 'Sangrado', en: 'Bleed' },
    blight: { es: 'Corrosión', en: 'Blight' },
    stun: { es: 'Aturdimiento', en: 'Stun' },
    weak: { es: 'Debilidad', en: 'Weak' },
    vulnerable: { es: 'Vulnerable', en: 'Vulnerable' },
  }
  return language === 'en' ? labels[status].en : labels[status].es
}

export function skillDescription(skill: PokestSkill, language: Language = getLanguage()): string {
  const parts: string[] = []
  if (skill.rank.length < 4) {
    parts.push(language === 'en' ? `Rank ${skill.rank.join('-')}` : `Rango ${skill.rank.join('-')}`)
  }
  if ((skill.target === 'enemy' || skill.target === 'allEnemies') && skill.targetRanks.length < 4) {
    parts.push(language === 'en' ? `Targets R${skill.targetRanks.join('-')}` : `Objetivos R${skill.targetRanks.join('-')}`)
  }
  if (skill.effect === 'damage') {
    parts.push(language === 'en' ? `Damage ${skill.power}` : `Daño ${skill.power}`)
    parts.push(language === 'en' ? `${skill.accuracy}% accuracy` : `${skill.accuracy}% precisión`)
  } else if (skill.effect === 'heal') {
    parts.push(language === 'en' ? `Heals ${skill.power} HP` : `Cura ${skill.power} PS`)
  } else if (skill.effect === 'stressHeal') {
    parts.push(language === 'en' ? `Reduces ${skill.power} stress` : `Reduce ${skill.power} de estrés`)
  } else if (skill.effect === 'guard') {
    parts.push(language === 'en' ? `Guards for ${skill.statusTurns ?? 2} turns` : `Protege durante ${skill.statusTurns ?? 2} turnos`)
  } else if (skill.effect === 'stressDamage') {
    parts.push(language === 'en' ? `Causes ${skill.stressDamage ?? skill.power} stress` : `Causa ${skill.stressDamage ?? skill.power} de estrés`)
  }
  if (skill.stressDamage && skill.effect !== 'stressDamage') {
    parts.push(language === 'en' ? `+${skill.stressDamage} stress` : `+${skill.stressDamage} estrés`)
  }
  if (skill.heal && skill.effect !== 'heal') {
    parts.push(language === 'en' ? `Heals ${skill.heal} HP` : `Cura ${skill.heal} PS`)
  }
  if (skill.stressHeal && skill.effect !== 'stressHeal') {
    parts.push(language === 'en' ? `-${skill.stressHeal} stress` : `-${skill.stressHeal} estrés`)
  }
  if (skill.status) {
    parts.push(skillStatusLabel(skill.status, language))
  }
  if (skill.cooldown > 0) {
    parts.push(language === 'en' ? `CD ${skill.cooldown}` : `Recarga ${skill.cooldown}`)
  }
  return parts.join(' · ')
}

export function getNodeLabel(type: PokestNode['type'], language: Language = getLanguage()): string {
  const entry = POKEST_NODE_LABELS[type]
  return language === 'en' ? entry.en : entry.es
}

export function getHeroDisplayName(hero: PokestHero, language: Language = getLanguage()): string {
  return language === 'en' ? hero.name : hero.name
}

export function getAfflictionName(id: string | null, language: Language = getLanguage()): string {
  const affliction = getAffliction(id)
  if (!affliction) return ''
  return language === 'en' ? affliction.nameEn : affliction.name
}

export function getVirtueName(id: string | null, language: Language = getLanguage()): string {
  const virtue = getVirtue(id)
  if (!virtue) return ''
  return language === 'en' ? virtue.nameEn : virtue.name
}

export function getHeroDefFor(id: number) {
  return getHeroDef(id)
}

export function getDungeonDef(id: PokestDungeonId) {
  return getDungeon(id)
}

export function getEventDef(id: string | null) {
  return getEvent(id)
}

export function getAfflictionDef(id: string | null) {
  return getAffliction(id)
}

export function getVirtueDef(id: string | null) {
  return getVirtue(id)
}

export function createStarterHero(defId: number): PokestHero {
  return createHero(defId)
}

export function getDungeonList(): PokestDungeonId[] {
  return Object.keys(POKEST_DUNGEONS) as PokestDungeonId[]
}
