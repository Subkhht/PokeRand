import {
  DUNGEONS,
  DUNGEON_STORAGE_KEY,
  nextDungeonId,
} from './data'
import type { DungeonResult, DungeonSave, DungeonStats } from './types'

function emptyStats(): DungeonStats {
  return {
    runs: 0,
    wins: 0,
    bestFloor: 0,
    totalCrystals: 0,
    enemiesDefeated: 0,
    recruits: 0,
    bestRun: null,
  }
}

export function defaultDungeonSave(): DungeonSave {
  return {
    version: 1,
    crystals: 80,
    ownedActives: [],
    ownedPassives: [],
    upgrades: {},
    unlockedStarters: [1, 4, 7, 25, 133, 447],
    pokemonMeta: {},
    settledRecruits: [],
    selectedTeam: [4],
    equippedPassives: [],
    unlockedDungeons: ['forest'],
    clearedDungeons: [],
    stats: emptyStats(),
  }
}

export function loadDungeonSave(): DungeonSave {
  const fallback = defaultDungeonSave()
  try {
    const raw = localStorage.getItem(DUNGEON_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<DungeonSave>
    if (!parsed || typeof parsed !== 'object') return fallback
    return {
      ...fallback,
      ...parsed,
      version: 1,
      crystals: typeof parsed.crystals === 'number' ? Math.max(0, Math.floor(parsed.crystals)) : fallback.crystals,
      ownedActives: Array.isArray(parsed.ownedActives) ? parsed.ownedActives : fallback.ownedActives,
      ownedPassives: Array.isArray(parsed.ownedPassives) ? parsed.ownedPassives : fallback.ownedPassives,
      equippedPassives: Array.isArray(parsed.equippedPassives) ? parsed.equippedPassives : fallback.equippedPassives,
      upgrades: parsed.upgrades && typeof parsed.upgrades === 'object' ? parsed.upgrades : fallback.upgrades,
      unlockedStarters: Array.isArray(parsed.unlockedStarters) ? parsed.unlockedStarters : fallback.unlockedStarters,
      pokemonMeta: parsed.pokemonMeta && typeof parsed.pokemonMeta === 'object' ? parsed.pokemonMeta : fallback.pokemonMeta,
      settledRecruits: Array.isArray(parsed.settledRecruits) ? parsed.settledRecruits : fallback.settledRecruits,
      selectedTeam: Array.isArray(parsed.selectedTeam) && parsed.selectedTeam.length > 0 ? parsed.selectedTeam : fallback.selectedTeam,
      unlockedDungeons: Array.isArray(parsed.unlockedDungeons) && parsed.unlockedDungeons.length > 0 ? parsed.unlockedDungeons : fallback.unlockedDungeons,
      clearedDungeons: Array.isArray(parsed.clearedDungeons) ? parsed.clearedDungeons : fallback.clearedDungeons,
      stats: { ...emptyStats(), ...(parsed.stats ?? {}) },
    }
  } catch {
    return fallback
  }
}

export function persistDungeonSave(save: DungeonSave): void {
  try {
    localStorage.setItem(DUNGEON_STORAGE_KEY, JSON.stringify(save))
  } catch {
    // Sin almacenamiento disponible: la partida sigue en memoria.
  }
}

export function resetDungeonSave(): DungeonSave {
  const fresh = defaultDungeonSave()
  persistDungeonSave(fresh)
  return fresh
}

export function applyDungeonResult(save: DungeonSave, result: DungeonResult): DungeonSave {
  const firstClear = result.status === 'won' && !save.clearedDungeons.includes(result.dungeonId)
  const crystals = Math.max(0, Math.floor(result.crystalsEarned))
  const nextId = result.status === 'won' ? nextDungeonId(result.dungeonId) : null
  const unlockedDungeons = [...save.unlockedDungeons]
  if (nextId && !unlockedDungeons.includes(nextId)) unlockedDungeons.push(nextId)

  const clearedDungeons = result.status === 'won' && !save.clearedDungeons.includes(result.dungeonId)
    ? [...save.clearedDungeons, result.dungeonId]
    : save.clearedDungeons

  const bestRun = save.stats.bestRun
  const isBetter = !bestRun || result.floor > bestRun.floor
  const nextBest = isBetter
    ? { dungeonId: result.dungeonId, floor: result.floor, date: new Date().toISOString() }
    : bestRun

  const next: DungeonSave = {
    ...save,
    crystals: save.crystals + crystals,
    unlockedDungeons,
    clearedDungeons,
    stats: {
      ...save.stats,
      runs: save.stats.runs + 1,
      wins: save.stats.wins + (result.status === 'won' ? 1 : 0),
      bestFloor: Math.max(save.stats.bestFloor, result.floor),
      totalCrystals: save.stats.totalCrystals + crystals,
      enemiesDefeated: save.stats.enemiesDefeated + result.enemiesDefeated,
      recruits: save.stats.recruits + result.recruits,
      bestRun: nextBest,
    },
  }

  if (firstClear) {
    const dungeon = DUNGEONS.find((entry) => entry.id === result.dungeonId)
    if (dungeon) next.crystals += Math.floor(dungeon.reward * 0.5)
  }

  persistDungeonSave(next)
  return next
}
