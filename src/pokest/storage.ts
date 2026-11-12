import {
  POKEST_DEFAULT_TEAM_IDS,
  POKEST_HERO_DEFS,
  POKEST_MAX_TEAM,
  POKEST_STARTING_GOLD,
  POKEST_STORAGE_KEY,
  createHero,
  getDungeon,
} from './data'
import type { PokestDungeonId, PokestHero, PokestRunState, PokestSave } from './types'

export type PokestRunOutcome = 'victory' | 'defeat' | 'retreat'

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function defaultPokestSave(): PokestSave {
  const roster = POKEST_DEFAULT_TEAM_IDS.map((id) => createHero(id))
  return {
    version: 1,
    gold: POKEST_STARTING_GOLD,
    roster,
    teamIds: roster.map((hero) => hero.instanceId),
    unlockedDungeons: ['crypt'],
    clearedDungeons: [],
    runs: 0,
    victories: 0,
    fallen: 0,
    activeRun: null,
    lastMessage: 'El pueblo espera. Forma tu equipo y entra en la Cripta Umbría.',
    lastMessageEn: 'The town waits. Form your team and enter the Gloom Crypt.',
  }
}

function hydrateHero(hero: PokestHero): PokestHero {
  const base = createHero(hero.defId, hero.level, hero.instanceId)
  return {
    ...base,
    ...hero,
    skills: hero.skills?.length ? hero.skills : base.skills,
    quirks: hero.quirks ?? base.quirks,
    weaponLevel: hero.weaponLevel ?? 0,
    armorLevel: hero.armorLevel ?? 0,
    maxStress: 200,
    cooldowns: hero.cooldowns ?? {},
  }
}

function hydrateRun(run: PokestRunState): PokestRunState {
  return {
    ...run,
    narrator: run.narrator ?? '',
    narratorEn: run.narratorEn ?? '',
    party: run.party.map((hero) => ({
      ...hero,
      quirks: hero.quirks ?? [],
      weaponLevel: hero.weaponLevel ?? 0,
      armorLevel: hero.armorLevel ?? 0,
      cooldowns: hero.cooldowns ?? {},
    })),
    enemies: run.enemies.map((hero) => ({
      ...hero,
      quirks: hero.quirks ?? [],
      weaponLevel: hero.weaponLevel ?? 0,
      armorLevel: hero.armorLevel ?? 0,
      cooldowns: hero.cooldowns ?? {},
    })),
  }
}

export function loadPokestSave(): PokestSave {
  const fallback = defaultPokestSave()
  try {
    const raw = localStorage.getItem(POKEST_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PokestSave>
    if (!parsed || typeof parsed !== 'object') return fallback
    const roster = Array.isArray(parsed.roster) && parsed.roster.length > 0
      ? parsed.roster.map(hydrateHero)
      : fallback.roster
    const teamIds = Array.isArray(parsed.teamIds)
      ? parsed.teamIds.filter((id) => roster.some((hero) => hero.instanceId === id)).slice(0, POKEST_MAX_TEAM)
      : []
    const unlocked = Array.isArray(parsed.unlockedDungeons) && parsed.unlockedDungeons.length > 0
      ? parsed.unlockedDungeons
      : fallback.unlockedDungeons
    return {
      ...fallback,
      ...parsed,
      version: 1,
      gold: typeof parsed.gold === 'number' ? Math.max(0, Math.floor(parsed.gold)) : fallback.gold,
      roster,
      teamIds: teamIds.length > 0 ? teamIds : roster.slice(0, POKEST_MAX_TEAM).map((hero) => hero.instanceId),
      unlockedDungeons: unlocked.includes('crypt') ? unlocked : ['crypt', ...unlocked],
      clearedDungeons: Array.isArray(parsed.clearedDungeons) ? parsed.clearedDungeons : [],
      runs: typeof parsed.runs === 'number' ? parsed.runs : 0,
      victories: typeof parsed.victories === 'number' ? parsed.victories : 0,
      fallen: typeof parsed.fallen === 'number' ? parsed.fallen : 0,
      activeRun: parsed.activeRun && typeof parsed.activeRun === 'object' && Array.isArray(parsed.activeRun.party) && Array.isArray(parsed.activeRun.enemies)
        ? hydrateRun(parsed.activeRun as PokestRunState)
        : null,
      lastMessage: typeof parsed.lastMessage === 'string' ? parsed.lastMessage : fallback.lastMessage,
      lastMessageEn: typeof parsed.lastMessageEn === 'string' ? parsed.lastMessageEn : fallback.lastMessageEn,
    }
  } catch {
    return fallback
  }
}

export function persistPokestSave(save: PokestSave): void {
  try {
    localStorage.setItem(POKEST_STORAGE_KEY, JSON.stringify(save))
  } catch {
    // Sin persistencia si el navegador la bloquea.
  }
}

export function settleRun(save: PokestSave, run: PokestRunState, outcome: PokestRunOutcome): PokestSave {
  const dungeon = getDungeon(run.dungeonId)
  const survivors: PokestHero[] = run.party
    .filter((hero) => hero.alive)
    .map((hero) => ({
      ...hero,
      hp: hero.deathsDoor ? 1 : Math.max(1, hero.hp),
      stress: hero.deathsDoor ? Math.min(200, hero.stress + 15) : hero.stress,
      rank: 1,
      guard: 0,
      stun: 0,
      bleed: 0,
      blight: 0,
      weak: 0,
      vulnerable: 0,
      cooldowns: {},
      isEnemy: undefined,
    }))
  const partyIds = new Set(run.party.map((hero) => hero.instanceId))
  let roster = [...save.roster.filter((hero) => !partyIds.has(hero.instanceId)), ...survivors]

  if (roster.length === 0) {
    const available = POKEST_HERO_DEFS.filter((def) => !roster.some((hero) => hero.defId === def.id))
    const def = randomFrom(available.length > 0 ? available : POKEST_HERO_DEFS)
    roster = [createHero(def.id)]
  }

  const deadCount = run.party.filter((hero) => !hero.alive).length
  const cleared = new Set<PokestDungeonId>(save.clearedDungeons)
  const unlocked = new Set<PokestDungeonId>(save.unlockedDungeons)
  let bonusGold = 0

  if (outcome === 'victory') {
    cleared.add(run.dungeonId)
    bonusGold = dungeon.reward
    // Desbloquea cualquier dungeon que dependa de la recién completada.
    for (const id of ['crypt', 'abyss'] as PokestDungeonId[]) {
      const candidate = getDungeon(id)
      if (candidate.unlockAfter === run.dungeonId) unlocked.add(id)
    }
  }

  const teamIds = save.teamIds
    .filter((id) => roster.some((hero) => hero.instanceId === id))
    .slice(0, POKEST_MAX_TEAM)
  const fallbackTeam = roster.slice(0, POKEST_MAX_TEAM).map((hero) => hero.instanceId)
  const finalTeam = teamIds.length > 0 ? teamIds : fallbackTeam

  const message = outcome === 'victory'
    ? `¡${dungeon.name} conquistada! +${bonusGold} de oro.`
    : outcome === 'defeat'
      ? 'La expedición ha fracasado. Los caídos no volverán.'
      : 'Habéis escapado con vida. El pueblo os recibe en silencio.'
  const messageEn = outcome === 'victory'
    ? `${dungeon.nameEn} conquered! +${bonusGold} gold.`
    : outcome === 'defeat'
      ? 'The expedition failed. The fallen will not return.'
      : 'You escaped with your lives. The town receives you in silence.'

  return {
    ...save,
    gold: Math.max(0, save.gold + run.gold + bonusGold),
    roster,
    teamIds: finalTeam,
    unlockedDungeons: [...unlocked],
    clearedDungeons: [...cleared],
    runs: save.runs + 1,
    victories: save.victories + (outcome === 'victory' ? 1 : 0),
    fallen: save.fallen + deadCount,
    activeRun: null,
    lastMessage: message,
    lastMessageEn: messageEn,
  }
}
