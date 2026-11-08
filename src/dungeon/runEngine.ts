import { buildPokemonFromApi, getSpeciesIdsByPrimaryType, pokemonSpriteUrl } from '../game/pokeapi'
import { createSeededRandom } from '../game/engine'
import { playRockBreak, playTreeBreak } from '../game/sound'
import { getTypeEffectiveness } from '../game/typesChart'
import type { Language } from '../game/i18n'
import type { Move, Pokemon } from '../game/types'
import {
  ACTIVE_ITEMS,
  ACTIVE_BY_ID,
  DUNGEON_BY_ID,
  DUNGEON_PRIMARY_TYPES,
  HELD_ITEM_BY_ID,
  MAX_PARTY_SIZE,
  computeBonuses,
} from './data'
import { generateDungeonMap, isStairs, isWalkable, randomFloorInRoom, randomFloorTile, roomIndexAt } from './mapgen'
import { loadPmdAssets } from './pmdAssets'
import type {
  ActiveItemDef,
  DungeonDef,
  DungeonMonster,
  DungeonResult,
  DungeonRun,
  DungeonSave,
  DungeonId,
  DungeonShopOffer,
  FloorEvent,
  FloorModifier,
  GuildMission,
  GuildMissionKind,
  MapRock,
  MapTree,
  PmdSprites,
  RunBonuses,
} from './types'

const STRUGGLE: Move = {
  name: 'Forcejeo',
  enName: 'Struggle',
  power: 40,
  type: 'normal',
  accuracy: null,
  description: 'Ataque de emergencia sin PP.',
  damageClass: 'physical',
}

const ENCOUNTER_ROSTER_SIZE = 18

function generateGuildMission(dungeon: DungeonDef): GuildMission {
  const floorTarget = dungeon.id === 'endless'
    ? 10
    : Math.max(2, Math.min(dungeon.floors - 1, 3 + Math.floor(Math.random() * 2)))
  const kinds: GuildMissionKind[] = ['reachFloor', 'defeatEnemies', 'recruit', 'collectCrystals', 'noFaints']
  if (dungeon.id !== 'endless') kinds.push('defeatBoss')
  const kind = choose(kinds)
  const reward = 25 + dungeon.levelStart * 2 + Math.floor(dungeon.floors * 1.5)
  switch (kind) {
    case 'reachFloor':
    case 'noFaints':
      return { kind, target: floorTarget, reward }
    case 'defeatEnemies':
      return { kind, target: 6 + Math.floor(dungeon.levelStart / 8), reward }
    case 'recruit':
      return { kind, target: 1, reward }
    case 'collectCrystals':
      return { kind, target: 40 + dungeon.levelStart * 2, reward }
    case 'defeatBoss':
      return { kind, target: 1, reward: reward + 30 }
    default:
      return { kind: 'reachFloor', target: floorTarget, reward }
  }
}

function pickEncounterPool(pool: number[], size: number): number[] {
  const shuffled = [...new Set(pool)]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  return shuffled.slice(0, Math.max(0, size))
}

let uidCounter = 0
function nextUid(prefix: string): string {
  uidCounter += 1
  return `${prefix}-${uidCounter}-${Math.floor(Math.random() * 9999)}`
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function choose<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function clonePokemon(pokemon: Pokemon): Pokemon {
  return {
    ...pokemon,
    types: pokemon.types ? [...pokemon.types] : undefined,
    moves: pokemon.moves.map((move) => ({ ...move })),
    statStages: pokemon.statStages ? { ...pokemon.statStages } : undefined,
    status: pokemon.status ? { ...pokemon.status } : undefined,
  }
}

function ensureMovePp(move: Move, bonusPct = 0): void {
  const base = Math.max(
    5,
    Math.min(35, 20 - Math.floor((move.power ?? 0) / 10) + (move.accuracy === null ? 5 : 0)),
  )
  if (!move.maxPp || !move.pp) {
    move.maxPp = move.maxPp ?? base
    move.pp = move.pp ?? move.maxPp
  }
  if (bonusPct > 0) {
    move.maxPp = Math.max(1, Math.round(move.maxPp * (1 + bonusPct / 100)))
    move.pp = move.maxPp
  }
}

function applyBonusesToPokemon(pokemon: Pokemon, bonuses: RunBonuses): Pokemon {
  const p = clonePokemon(pokemon)
  p.maxHp = Math.max(1, p.maxHp + bonuses.maxHp)
  p.hp = p.maxHp
  p.attack = Math.max(1, Math.round((p.attack + bonuses.attack) * (1 + bonuses.attackPct / 100)))
  p.defense = Math.max(1, p.defense + bonuses.defense)
  p.spAttack = Math.max(1, Math.round((p.spAttack + bonuses.spAttack) * (1 + bonuses.attackPct / 100)))
  p.spDefense = Math.max(1, p.spDefense + Math.floor(bonuses.defense / 2))
  for (const move of p.moves) ensureMovePp(move, bonuses.ppBonus)
  return p
}

function fallbackPokemon(id: number, level: number, name: string): Pokemon {
  const power = 40 + (id % 25)
  return {
    id,
    name,
    sprite: pokemonSpriteUrl(id),
    level,
    hp: 24 + level * 4,
    maxHp: 24 + level * 4,
    attack: 14 + level * 2,
    defense: 12 + level * 2,
    spAttack: 14 + level * 2,
    spDefense: 12 + level * 2,
    speed: 12 + level,
    types: ['normal'],
    moves: [
      {
        name: 'Placaje',
        enName: 'Tackle',
        power,
        type: 'normal',
        accuracy: 100,
        description: 'Un ataque físico sencillo.',
        damageClass: 'physical',
      },
    ],
  }
}

function createMonster(
  pokemon: Pokemon,
  x: number,
  y: number,
  isPlayer: boolean,
  isLeader: boolean,
  assets: Record<number, PmdSprites>,
  isBoss = false,
): DungeonMonster {
  return {
    uid: nextUid(isPlayer ? 'ally' : isBoss ? 'boss' : 'foe'),
    p: pokemon,
    x,
    y,
    isPlayer,
    isLeader,
    isBoss,
    bossEnraged: false,
    facing: isPlayer ? 0 : 4,
    xp: 0,
    level: pokemon.level,
    status: 'none',
    statusTurns: 0,
    pmd: assets[pokemon.id] ?? null,
    animUntil: 0,
    lastMoved: 0,
  }
}

export interface PrepareDungeonOptions {
  save: DungeonSave
  dungeonId: DungeonId
  lang: Language
}

export async function prepareDungeonRun({ save, dungeonId, lang }: PrepareDungeonOptions): Promise<DungeonRun> {
  const dungeon = DUNGEON_BY_ID[dungeonId]
  if (!dungeon) throw new Error(`Mazmorra desconocida: ${dungeonId}`)
  const bonuses = computeBonuses(save)
  const teamIds = (save.selectedTeam.length ? save.selectedTeam : save.unlockedStarters).slice(0, MAX_PARTY_SIZE)
  const startLevel = dungeon.levelStart + 2 + bonuses.levelBonus

  const encounterTypeLists = Promise.all(
    (DUNGEON_PRIMARY_TYPES[dungeonId] ?? []).map((type) => getSpeciesIdsByPrimaryType(type).catch(() => [])),
  )

  const teamPokemon = await Promise.all(
    teamIds.map(async (id) => {
      try {
        const built = await buildPokemonFromApi(id, 0, startLevel, false, 'medium', true)
        return applyBonusesToPokemon(built, bonuses)
      } catch {
        const fallback = fallbackPokemon(id, startLevel, `Pokémon ${id}`)
        return applyBonusesToPokemon(fallback, bonuses)
      }
    }),
  )

  const templateLevels = new Map<number, number>()
  const bossPool = dungeon.bossPool.length ? dungeon.bossPool : [dungeon.bossId]
  const bossId = choose(bossPool)
  const dynamicPool = [...new Set((await encounterTypeLists).flat())]
  const candidatePool = [...new Set([...dynamicPool, ...dungeon.enemyPool])]
    .filter((id) => !bossPool.includes(id))
  const minionRoster = [...new Set(dungeon.minionPool)]
  const encounterPool = [
    ...minionRoster,
    ...pickEncounterPool(
      candidatePool.filter((id) => !minionRoster.includes(id)),
      Math.max(0, ENCOUNTER_ROSTER_SIZE - minionRoster.length),
    ),
  ]
  if (encounterPool.length === 0) encounterPool.push(16)
  for (const id of encounterPool) {
    if (!templateLevels.has(id)) templateLevels.set(id, dungeon.levelStart)
  }
  templateLevels.set(bossId, dungeon.bossLevel)

  const templates: Record<number, Pokemon> = {}
  await Promise.all(
    Array.from(templateLevels.entries()).map(async ([id, level]) => {
      try {
        templates[id] = await buildPokemonFromApi(id, 0, level, false, 'medium', true)
      } catch {
        templates[id] = fallbackPokemon(id, level, `Pokémon ${id}`)
      }
    }),
  )

  const assetEntries = [
    ...teamPokemon.map((pokemon) => ({ id: pokemon.id, fallbackUrl: pokemon.sprite })),
    ...Object.values(templates).map((pokemon) => ({ id: pokemon.id, fallbackUrl: pokemon.sprite })),
  ]
  const assets = await loadPmdAssets(assetEntries)

  const map = generateDungeonMap(`${dungeonId}-start-${Date.now()}`, { dungeonId })
  const occupied = new Set<string>([`${map.start.x},${map.start.y}`])
  const equippedHeldItems = save.equippedHeldItems ?? {}
  const party = teamPokemon.map((pokemon, index) => {
    let x = map.start.x
    let y = map.start.y
    if (index > 0) {
      const position = findFreeAdjacent(map, map.start, occupied)
      x = position.x
      y = position.y
    }
    const monster = createMonster(pokemon, x, y, true, index === 0, assets)
    const heldItem = equippedHeldItems[pokemon.id]
    if (heldItem && HELD_ITEM_BY_ID[heldItem]) monster.heldItem = heldItem
    return monster
  })
  const mission = generateGuildMission(dungeon)

  const bagCapacity = 4 + bonuses.bagSlots
  const startingBag: Record<string, number> = {}
  let bagSlotsUsed = 0
  for (const itemId of save.ownedActives) {
    if (bagSlotsUsed >= bagCapacity) break
    if (!ACTIVE_BY_ID[itemId]) continue
    startingBag[itemId] = 1
    bagSlotsUsed += 1
  }

  const run: DungeonRun = {
    dungeonId,
    lang,
    floor: 1,
    totalFloors: dungeon.floors,
    encounterPool,
    bossId,
    floorModifier: 'none',
    events: [],
    shopOffers: null,
    mission,
    missionStart: { enemiesDefeated: 0, recruits: 0, crystalsEarned: 0 },
    missionComplete: false,
    map,
    party,
    fallen: [],
    trail: [{ ...map.start }],
    enemies: [],
    items: [],
    traps: [],
    chests: [],
    bag: startingBag,
    bagCapacity,
    leaderUid: party[0]?.uid ?? '',
    crystalsEarned: 0,
    enemiesDefeated: 0,
    recruits: 0,
    turn: 0,
    log: [],
    status: 'playing',
    dialogue: [],
    selectedMove: 0,
    floatTexts: [],
    revealMap: false,
    bossDefeated: false,
    startedAt: Date.now(),
    bonuses,
    templates,
    assets,
    pendingFloor: null,
  }

  buildFloor(run, 1, true)
  return run
}

function findFreeAdjacent(
  map: DungeonRun['map'],
  start: { x: number; y: number },
  occupied: Set<string>,
): { x: number; y: number } {
  const candidates = [
    { x: start.x + 1, y: start.y },
    { x: start.x, y: start.y + 1 },
    { x: start.x - 1, y: start.y },
    { x: start.x, y: start.y - 1 },
    { x: start.x + 1, y: start.y + 1 },
    { x: start.x - 1, y: start.y + 1 },
    { x: start.x + 1, y: start.y - 1 },
    { x: start.x - 1, y: start.y - 1 },
  ]
  for (const candidate of candidates) {
    const key = `${candidate.x},${candidate.y}`
    if (isWalkable(map, candidate.x, candidate.y) && !occupied.has(key)) {
      occupied.add(key)
      return candidate
    }
  }
  occupied.add(`${start.x},${start.y}`)
  return { ...start }
}

function scaledTemplate(template: Pokemon, level: number): Pokemon {
  const p = clonePokemon(template)
  const delta = Math.max(0, level - template.level)
  if (delta === 0) {
    p.hp = p.maxHp
    for (const move of p.moves) ensureMovePp(move)
    return p
  }
  const hpGain = Math.round(p.maxHp * 0.09 * delta)
  p.maxHp += hpGain
  p.hp = p.maxHp
  p.attack = Math.round(p.attack * (1 + 0.07 * delta))
  p.defense = Math.round(p.defense * (1 + 0.06 * delta))
  p.spAttack = Math.round(p.spAttack * (1 + 0.07 * delta))
  p.spDefense = Math.round(p.spDefense * (1 + 0.06 * delta))
  p.speed = Math.round(p.speed * (1 + 0.05 * delta))
  p.level = level
  for (const move of p.moves) ensureMovePp(move)
  return p
}

function addLog(run: DungeonRun, text: string): void {
  run.log = [...run.log.slice(-70), text]
}

export function guildMissionProgress(run: DungeonRun): number {
  if (!run.mission || !run.missionStart) return 0
  switch (run.mission.kind) {
    case 'reachFloor':
    case 'noFaints':
      return run.floor
    case 'defeatEnemies':
      return Math.max(0, run.enemiesDefeated - run.missionStart.enemiesDefeated)
    case 'recruit':
      return Math.max(0, run.recruits - run.missionStart.recruits)
    case 'collectCrystals':
      return Math.max(0, run.crystalsEarned - run.missionStart.crystalsEarned)
    case 'defeatBoss':
      return run.bossDefeated ? 1 : 0
    default:
      return 0
  }
}

function checkMission(run: DungeonRun): void {
  if (!run.mission || !run.missionStart || run.missionComplete) return
  const progress = guildMissionProgress(run)
  const noFaintsFailed = run.mission.kind === 'noFaints' && run.fallen.length > 0
  if (progress < run.mission.target || noFaintsFailed) return
  run.missionComplete = true
  run.crystalsEarned += run.mission.reward
  addLog(run, langPick(
    run.lang,
    `¡Misión del Gremio completada! +${run.mission.reward} 💠`,
    `Guild mission complete! +${run.mission.reward} 💠`,
  ))
  const leader = getLeader(run)
  if (leader) pushFloat(run, leader.x, leader.y, `+${run.mission.reward} 💠`, '#7fd8ff')
}

function pushFloat(run: DungeonRun, x: number, y: number, text: string, color: string): void {
  run.floatTexts = [...run.floatTexts, { x, y, text, color, born: Date.now() }].slice(-24)
}

function setDialogue(run: DungeonRun, name: string, text: string, speakerId?: number, emotion = 'Normal'): void {
  run.dialogue = [{ name, text, speakerId, side: 'left', emotion }]
}

export function clearDialogue(run: DungeonRun): DungeonRun {
  run.dialogue = []
  return run
}

export function generateFloorEvents(run: DungeonRun, isBossFloor: boolean): FloorEvent[] {
  if (isBossFloor) return []
  const roomCount = run.map.rooms.length
  if (roomCount === 0) return []

  const usedRooms = new Set<number>()
  const startRoom = run.map.rooms.findIndex(
    (room) => run.map.start.x >= room.x && run.map.start.x < room.x + room.w && run.map.start.y >= room.y && run.map.start.y < room.y + room.h,
  )
  const stairsRoom = run.map.rooms.findIndex(
    (room) => run.map.stairs.x >= room.x && run.map.stairs.x < room.x + room.w && run.map.stairs.y >= room.y && run.map.stairs.y < room.y + room.h,
  )
  if (startRoom >= 0) usedRooms.add(startRoom)
  if (stairsRoom >= 0) usedRooms.add(stairsRoom)

  const kinds: FloorEvent['kind'][] = ['monsterHouse', 'treasure', 'kecleonShop', 'rest', 'mystery']
  const events: FloorEvent[] = []
  const count = 1 + (Math.random() < 0.4 ? 1 : 0)

  for (let index = 0; index < count; index++) {
    const available = run.map.rooms
      .map((room, roomIndex) => ({ room, roomIndex }))
      .filter((entry) => !usedRooms.has(entry.roomIndex))
    if (available.length === 0) break
    const picked = choose(available)
    usedRooms.add(picked.roomIndex)
    const x = picked.room.x + Math.floor(picked.room.w / 2)
    const y = picked.room.y + Math.floor(picked.room.h / 2)
    if (!isWalkable(run.map, x, y) || isStairs(run.map, x, y)) continue
    events.push({ kind: choose(kinds), x, y, triggered: false })
  }
  return events
}

function floorModifierFor(dungeon: DungeonDef, isBossFloor: boolean): FloorModifier {
  if (isBossFloor || dungeon.floorModifiers.length === 0) return 'none'
  return choose(dungeon.floorModifiers)
}

function buildFloor(run: DungeonRun, floor: number, isFirst = false): DungeonRun {
  const dungeon = DUNGEON_BY_ID[run.dungeonId]
  const seed = `${run.dungeonId}-${floor}-${run.startedAt}-${Math.floor(Math.random() * 999999)}`
  const map = generateDungeonMap(seed, { dungeonId: run.dungeonId })
  const rng = createSeededRandom(seed)
  run.map = map
  run.floor = floor
  run.pendingFloor = null
  run.bossDefeated = false
  run.revealMap = false
  run.enemies = []
  run.items = []
  run.traps = []
  run.chests = []
  run.dialogue = []
  run.selectedMove = run.selectedMove ?? 0
  run.shopOffers = null
  const isBossFloor = floor >= run.totalFloors
  run.floorModifier = floorModifierFor(dungeon, isBossFloor)
  run.events = generateFloorEvents(run, isBossFloor)

  const occupied = new Set<string>((run.events ?? []).map((event) => `${event.x},${event.y}`))
  const placedParty = run.party.map((monster, index) => {
    let position = { ...map.start }
    if (index > 0) position = findFreeAdjacent(map, map.start, occupied)
    else occupied.add(`${position.x},${position.y}`)
    return { ...monster, x: position.x, y: position.y, status: 'none' as const, statusTurns: 0 }
  })
  run.party = placedParty
  run.trail = [{ ...map.start }]

  const enemyLevel = Math.min(dungeon.levelEnd, dungeon.levelStart + floor - 1)
  const enemyCount = isBossFloor
    ? Math.min(2, 1 + Math.floor(floor / 6))
    : Math.min(5, 2 + Math.floor(floor / 2))
  const pool = run.encounterPool?.length
    ? run.encounterPool
    : dungeon.enemyPool.length
      ? dungeon.enemyPool
      : [16]

  for (let index = 0; index < enemyCount; index++) {
    const room = map.rooms[1 + Math.floor(rng() * Math.max(1, map.rooms.length - 1))] ?? map.rooms[0]
    const position = randomFloorInRoom(map, room, rng, occupied)
    const speciesId = pool[Math.floor(rng() * pool.length)]
    const template = run.templates[speciesId]
    const pokemon = template
      ? scaledTemplate(template, enemyLevel)
      : fallbackPokemon(speciesId, enemyLevel, `Pokémon ${speciesId}`)
    run.enemies.push(createMonster(pokemon, position.x, position.y, false, false, run.assets))
  }

  if (isBossFloor) {
    const bossId = run.bossId ?? dungeon.bossId
    const bossTemplate = run.templates[bossId]
    const bossPokemon = bossTemplate
      ? scaledTemplate(bossTemplate, dungeon.bossLevel)
      : fallbackPokemon(bossId, dungeon.bossLevel, `Jefe ${bossId}`)
    const bossRoom = map.rooms[map.rooms.length - 1] ?? map.rooms[0]
    const bossPosition = randomFloorInRoom(map, bossRoom, rng, occupied)
    run.enemies.push(createMonster(bossPokemon, bossPosition.x, bossPosition.y, false, false, run.assets, true))
    const minionCount = 1 + Math.floor(floor / 3)
    const minionPool = dungeon.minionPool.length ? dungeon.minionPool : pool
    for (let index = 0; index < minionCount; index++) {
      const position = randomFloorInRoom(map, bossRoom, rng, occupied)
      const speciesId = minionPool[Math.floor(rng() * minionPool.length)]
      const template = run.templates[speciesId]
      const pokemon = template
        ? scaledTemplate(template, enemyLevel)
        : fallbackPokemon(speciesId, enemyLevel, `Pokémon ${speciesId}`)
      run.enemies.push(createMonster(pokemon, position.x, position.y, false, false, run.assets))
    }
  }

  const itemCount = 2 + Math.floor(floor / 2)
  for (let index = 0; index < itemCount; index++) {
    const position = randomFloorTile(map, rng, occupied)
    const item = choose(ACTIVE_ITEMS)
    run.items.push({ id: nextUid('item'), x: position.x, y: position.y, itemId: item.id, amount: 1 })
  }

  const trapCount = 1 + Math.floor(floor / 2)
  const trapKinds: Array<'damage' | 'sleep' | 'warp' | 'pp'> = ['damage', 'sleep', 'warp', 'pp']
  for (let index = 0; index < trapCount; index++) {
    const position = randomFloorTile(map, rng, occupied)
    run.traps.push({
      x: position.x,
      y: position.y,
      kind: trapKinds[Math.floor(rng() * trapKinds.length)],
      revealed: run.bonuses.revealTraps,
    })
  }

  const chestCount = 1 + (floor % 2)
  for (let index = 0; index < chestCount; index++) {
    const position = randomFloorTile(map, rng, occupied)
    run.chests.push({ x: position.x, y: position.y, opened: false })
  }

  addLog(run, `— Piso ${floor} de ${run.totalFloors} —`)
  if (run.floorModifier !== 'none') {
    const labels: Record<string, { es: string; en: string }> = {
      darkness: { es: 'Oscuridad: la visión se reduce.', en: 'Darkness: vision is reduced.' },
      fog: { es: 'Niebla: cuesta ver más allá.', en: 'Fog: it is hard to see far.' },
      sandstorm: { es: 'Tormenta de arena: el equipo sufre daño cada turno.', en: 'Sandstorm: the team takes damage each turn.' },
      lava: { es: 'Suelo volcánico: el calor daña al equipo cada turno.', en: 'Volcanic floor: the heat hurts the team each turn.' },
      ice: { es: 'Hielo resbaladizo: puedes deslizarte al moverte.', en: 'Slippery ice: you may slide when moving.' },
    }
    const label = labels[run.floorModifier]
    if (label) addLog(run, langPick(run.lang, label.es, label.en))
  }
  if (run.bonuses.revealTraps) addLog(run, 'Tu bufanda detecta las trampas del piso.')

  if (isFirst) {
    const leader = getLeader(run)
    if (leader) setDialogue(run, leader.p.name, dungeon.intro[0] ?? 'La mazmorra te recibe.', leader.p.id)
  } else if (isBossFloor) {
    const boss = run.enemies.find((enemy) => enemy.isBoss)
    if (boss) {
      const message = langPick(run.lang, '¡No pienso dejar que llegues más lejos!', 'I will not let you get any further!')
      setDialogue(run, boss.p.name, message, boss.p.id)
    }
  }

  checkMission(run)
  return run
}

function langPick(lang: Language, es: string, en: string): string {
  return lang === 'en' ? en : es
}

function activeName(run: DungeonRun, item: ActiveItemDef): string {
  return run.lang === 'en' ? item.nameEn : item.name
}

export function getLeader(run: DungeonRun): DungeonMonster | null {
  return run.party.find((member) => member.uid === run.leaderUid) ?? run.party[0] ?? null
}

function consumeLeaderIncapacitation(run: DungeonRun, leader: DungeonMonster): boolean {
  if (leader.status === 'sleep') {
    leader.statusTurns -= 1
    if (leader.statusTurns <= 0) {
      leader.status = 'none'
      addLog(run, `${leader.p.name} ${langPick(run.lang, 'se despierta.', 'wakes up.')}`)
    } else {
      addLog(run, `${leader.p.name} ${langPick(run.lang, 'sigue dormido.', 'is still asleep.')}`)
      pushFloat(run, leader.x, leader.y, 'Zzz', '#a5b4fc')
    }
    finishTurn(run)
    return true
  }
  if (leader.status === 'paralyze' && Math.random() < 0.3) {
    addLog(run, `${leader.p.name} ${langPick(run.lang, 'está paralizado y no puede moverse.', 'is paralyzed and cannot move.')}`)
    pushFloat(run, leader.x, leader.y, 'PAR', '#c084fc')
    finishTurn(run)
    return true
  }
  return false
}

function monsterAt(run: DungeonRun, x: number, y: number): DungeonMonster | null {
  return (
    run.party.find((member) => member.x === x && member.y === y) ??
    run.enemies.find((enemy) => enemy.x === x && enemy.y === y) ??
    null
  )
}

function enemyAt(run: DungeonRun, x: number, y: number): DungeonMonster | null {
  return run.enemies.find((enemy) => enemy.x === x && enemy.y === y) ?? null
}

function directionRow(dx: number, dy: number): number {
  if (dx === 0 && dy > 0) return 0
  if (dx > 0 && dy > 0) return 1
  if (dx > 0 && dy === 0) return 2
  if (dx > 0 && dy < 0) return 3
  if (dx === 0 && dy < 0) return 4
  if (dx < 0 && dy < 0) return 5
  if (dx < 0 && dy === 0) return 6
  if (dx < 0 && dy > 0) return 7
  return 0
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

function effectiveCrystalMultiplier(run: DungeonRun): number {
  return 1 + run.bonuses.crystalPct / 100
}

export function selectMove(run: DungeonRun, index: number): DungeonRun {
  if (index >= 0 && index < 4) run.selectedMove = index
  return run
}

export function setLeader(run: DungeonRun, uid: string): DungeonRun {
  if (run.status !== 'playing') return run
  const index = run.party.findIndex((member) => member.uid === uid)
  if (index <= 0) return run
  const member = run.party[index]
  run.party = [member, ...run.party.filter((_, memberIndex) => memberIndex !== index)]
  for (const ally of run.party) ally.isLeader = ally.uid === uid
  run.leaderUid = uid
  run.trail = [{ x: member.x, y: member.y }]
  addLog(run, `${member.p.name} ${langPick(run.lang, 'pasa a ser el líder.', 'becomes the leader.')}`)
  pushFloat(run, member.x, member.y, '★', '#ffd166')
  return run
}

export function moveLeader(run: DungeonRun, dx: number, dy: number): DungeonRun {
  if (run.status !== 'playing' || run.pendingFloor !== null || run.dialogue.length > 0) return run
  const leader = getLeader(run)
  if (!leader) return run
  if (consumeLeaderIncapacitation(run, leader)) return run
  leader.facing = directionRow(dx, dy)
  const targetX = leader.x + dx
  const targetY = leader.y + dy

  const enemy = enemyAt(run, targetX, targetY)
  if (enemy) {
    const move = moveForAttack(leader, run.selectedMove ?? 0, run)
    performAttack(run, leader, enemy, move)
    finishTurn(run)
    return run
  }

  if (!isWalkable(run.map, targetX, targetY)) return run
  const blocker = run.party.find(
    (member) => member.uid !== leader.uid && member.x === targetX && member.y === targetY,
  )
  const previous = { x: leader.x, y: leader.y }
  if (blocker) {
    // El líder nunca debe quedar atrapado por sus compañeros: intercambian sitio.
    blocker.x = previous.x
    blocker.y = previous.y
    blocker.facing = directionRow(previous.x - targetX, previous.y - targetY)
    blocker.animUntil = Date.now() + 320
  }
  leader.x = targetX
  leader.y = targetY
  leader.animUntil = Date.now() + 320
  leader.lastMoved = Date.now()
  advanceTrail(run, previous)
  followParty(run)

  for (const member of run.party) {
    if (member.uid !== leader.uid) continue
    handleTile(run, member)
    break
  }

  if (run.floorModifier === 'ice' && run.status === 'playing' && run.pendingFloor === null && Math.random() < 0.5) {
    const slideX = leader.x + dx
    const slideY = leader.y + dy
    if (isWalkable(run.map, slideX, slideY) && !monsterAt(run, slideX, slideY)) {
      const slidePrevious = { x: leader.x, y: leader.y }
      leader.x = slideX
      leader.y = slideY
      leader.animUntil = Date.now() + 320
      advanceTrail(run, slidePrevious)
      followParty(run)
      handleTile(run, leader)
      pushFloat(run, leader.x, leader.y, langPick(run.lang, '¡Resbalón!', 'Slip!'), '#bfe8ff')
    }
  }

  finishTurn(run)
  return run
}

function advanceTrail(run: DungeonRun, previous: { x: number; y: number }): void {
  run.trail = [previous, ...run.trail.filter((tile) => tile.x !== previous.x || tile.y !== previous.y)].slice(0, 32)
}

function followParty(run: DungeonRun): void {
  const party = run.party
  for (let index = 1; index < party.length; index++) {
    const member = party[index]
    const target = run.trail[index - 1]
    if (!target) continue
    const blocked =
      run.party.some((other) => other.uid !== member.uid && other.x === target.x && other.y === target.y) ||
      run.enemies.some((enemy) => enemy.x === target.x && enemy.y === target.y)
    if (!blocked && isWalkable(run.map, target.x, target.y)) {
      member.facing = directionRow(target.x - member.x, target.y - member.y)
      member.x = target.x
      member.y = target.y
      member.animUntil = Date.now() + 320
    }
  }
}

function handleTile(run: DungeonRun, monster: DungeonMonster): void {
  const itemIndex = run.items.findIndex((item) => item.x === monster.x && item.y === monster.y)
  if (itemIndex >= 0) {
    const item = run.items[itemIndex]
    const definition = ACTIVE_BY_ID[item.itemId]
    const totalItems = Object.values(run.bag).reduce((sum, amount) => sum + amount, 0)
    if (definition && totalItems < run.bagCapacity) {
      run.bag = { ...run.bag, [item.itemId]: (run.bag[item.itemId] ?? 0) + item.amount }
      run.items = run.items.filter((_, index) => index !== itemIndex)
      addLog(run, `${langPick(run.lang, 'Recoges', 'You pick up')} ${activeName(run, definition)}.`)
      pushFloat(run, monster.x, monster.y, '+1 🎒', '#ffe08a')
    } else {
      addLog(run, langPick(run.lang, 'La bolsa está llena.', 'The bag is full.'))
    }
  }

  const chestIndex = run.chests.findIndex((chest) => chest.x === monster.x && chest.y === monster.y && !chest.opened)
  if (chestIndex >= 0) {
    openChest(run, chestIndex)
  }

  const trapIndex = run.traps.findIndex((trap) => trap.x === monster.x && trap.y === monster.y)
  if (trapIndex >= 0) {
    triggerTrap(run, trapIndex)
  }

  const eventIndex = run.events.findIndex(
    (event) => !event.triggered && event.x === monster.x && event.y === monster.y,
  )
  if (eventIndex >= 0) {
    triggerFloorEvent(run, eventIndex)
  }

  if (isStairs(run.map, monster.x, monster.y)) {
    handleStairs(run)
  }
}

function grantRandomActiveItem(
  run: DungeonRun,
  x: number,
  y: number,
  prefixEs: string,
  prefixEn: string,
): void {
  const totalItems = Object.values(run.bag).reduce((sum, amount) => sum + amount, 0)
  if (totalItems >= run.bagCapacity) {
    addLog(run, langPick(run.lang, 'La bolsa está llena.', 'The bag is full.'))
    return
  }
  const item = choose(ACTIVE_ITEMS)
  run.bag = { ...run.bag, [item.id]: (run.bag[item.id] ?? 0) + 1 }
  addLog(run, `${langPick(run.lang, prefixEs, prefixEn)} ${activeName(run, item)}.`)
  pushFloat(run, x, y, '+1 🎒', '#ffe08a')
}

function spawnEventEnemies(run: DungeonRun, x: number, y: number, count: number): void {
  const dungeon = DUNGEON_BY_ID[run.dungeonId]
  const pool = run.encounterPool.length ? run.encounterPool : dungeon.enemyPool
  if (pool.length === 0) return
  const occupied = new Set<string>([
    ...run.party.map((member) => `${member.x},${member.y}`),
    ...run.enemies.map((enemy) => `${enemy.x},${enemy.y}`),
    `${x},${y}`,
  ])
  const level = Math.min(dungeon.levelEnd, dungeon.levelStart + run.floor - 1)
  for (let index = 0; index < count; index++) {
    const position = randomFloorTile(run.map, Math.random, occupied)
    const speciesId = choose(pool)
    const template = run.templates[speciesId]
    const pokemon = template
      ? scaledTemplate(template, level)
      : fallbackPokemon(speciesId, level, `Pokémon ${speciesId}`)
    run.enemies.push(createMonster(pokemon, position.x, position.y, false, false, run.assets))
  }
}

function triggerFloorEvent(run: DungeonRun, eventIndex: number): void {
  const event = run.events[eventIndex]
  if (!event || event.triggered) return
  run.events = run.events.map((entry, index) => (index === eventIndex ? { ...entry, triggered: true } : entry))
  const leader = getLeader(run)

  switch (event.kind) {
    case 'monsterHouse': {
      const count = Math.min(7, 3 + Math.floor(run.floor / 2))
      spawnEventEnemies(run, event.x, event.y, count)
      addLog(run, langPick(run.lang, '¡Una casa de monstruos! Los enemigos aparecen por todas partes.', 'A monster house! Enemies appear everywhere.'))
      pushFloat(run, event.x, event.y, '👹', '#ff6b6b')
      break
    }
    case 'treasure': {
      const amount = Math.max(10, Math.round((12 + randInt(4, 12)) * effectiveCrystalMultiplier(run)))
      run.crystalsEarned += amount
      addLog(run, langPick(run.lang, `¡Sala del tesoro! Obtienes ${amount} 💠.`, `Treasure room! You get ${amount} 💠.`))
      pushFloat(run, event.x, event.y, `+${amount} 💠`, '#7fd8ff')
      grantRandomActiveItem(run, event.x, event.y, 'También encuentras', 'You also find')
      break
    }
    case 'kecleonShop': {
      const offers: DungeonShopOffer[] = []
      while (offers.length < 3) {
        const item = choose(ACTIVE_ITEMS)
        if (offers.some((offer) => offer.itemId === item.id)) continue
        offers.push({ itemId: item.id, price: item.price, sold: false })
      }
      run.shopOffers = offers
      addLog(run, langPick(run.lang, '¡Un Kecleon ha montado una tienda!', 'A Kecleon has set up shop!'))
      break
    }
    case 'rest': {
      for (const member of run.party) {
        const healed = Math.max(1, Math.round(member.p.maxHp * 0.5))
        member.p.hp = Math.min(member.p.maxHp, member.p.hp + healed)
        for (const move of member.p.moves) {
          if (typeof move.maxPp === 'number') {
            move.pp = Math.min(move.maxPp, (move.pp ?? 0) + Math.max(1, Math.round(move.maxPp * 0.25)))
          }
        }
        pushFloat(run, member.x, member.y, `+${healed}`, '#7fe08a')
      }
      addLog(run, langPick(run.lang, 'Encontráis un lugar seguro para descansar.', 'You find a safe place to rest.'))
      break
    }
    case 'mystery': {
      const roll = randInt(0, 4)
      if (roll === 0) {
        const amount = Math.max(8, Math.round((10 + randInt(2, 8)) * effectiveCrystalMultiplier(run)))
        run.crystalsEarned += amount
        addLog(run, langPick(run.lang, `Sala misteriosa: recibes ${amount} 💠.`, `Mystery room: you receive ${amount} 💠.`))
        pushFloat(run, event.x, event.y, `+${amount} 💠`, '#7fd8ff')
      } else if (roll === 1) {
        grantRandomActiveItem(run, event.x, event.y, 'Sala misteriosa: encuentras', 'Mystery room: you find')
      } else if (roll === 2 && leader) {
        const healed = Math.max(1, Math.round(leader.p.maxHp * 0.35))
        leader.p.hp = Math.min(leader.p.maxHp, leader.p.hp + healed)
        addLog(run, langPick(run.lang, 'Una luz cura al líder.', 'A light heals the leader.'))
        pushFloat(run, leader.x, leader.y, `+${healed}`, '#7fe08a')
      } else if (roll === 3) {
        run.revealMap = true
        run.traps = run.traps.map((trap) => ({ ...trap, revealed: true }))
        addLog(run, langPick(run.lang, 'La sala revela el mapa y las trampas.', 'The room reveals the map and traps.'))
      } else {
        spawnEventEnemies(run, event.x, event.y, 3)
        addLog(run, langPick(run.lang, '¡Una emboscada en la sala misteriosa!', 'An ambush in the mystery room!'))
        pushFloat(run, event.x, event.y, '👹', '#ff6b6b')
      }
      break
    }
  }
}

export function buyDungeonOffer(run: DungeonRun, index: number): DungeonRun {
  if (!run.shopOffers) return run
  const offer = run.shopOffers[index]
  if (!offer || offer.sold) return run
  const definition = ACTIVE_BY_ID[offer.itemId]
  if (!definition) return run
  if (run.crystalsEarned < offer.price) {
    addLog(run, langPick(run.lang, 'No tienes suficientes cristales.', 'You do not have enough crystals.'))
    return run
  }
  const totalItems = Object.values(run.bag).reduce((sum, amount) => sum + amount, 0)
  if (totalItems >= run.bagCapacity) {
    addLog(run, langPick(run.lang, 'La bolsa está llena.', 'The bag is full.'))
    return run
  }
  run.crystalsEarned -= offer.price
  run.bag = { ...run.bag, [offer.itemId]: (run.bag[offer.itemId] ?? 0) + 1 }
  run.shopOffers = run.shopOffers.map((entry, entryIndex) =>
    entryIndex === index ? { ...entry, sold: true } : entry,
  )
  addLog(run, langPick(run.lang, 'Compras', 'You buy') + ` ${activeName(run, definition)}.`)
  return run
}

export function closeDungeonShop(run: DungeonRun): DungeonRun {
  run.shopOffers = null
  return run
}

function openChest(run: DungeonRun, chestIndex: number): void {
  const chest = run.chests[chestIndex]
  run.chests = run.chests.map((entry, index) => (index === chestIndex ? { ...entry, opened: true } : entry))
  if (Math.random() < 0.55) {
    const amount = Math.max(3, Math.round((6 + randInt(2, 8)) * effectiveCrystalMultiplier(run)))
    run.crystalsEarned += amount
    addLog(run, `${langPick(run.lang, '¡Un cofre! Obtienes', 'A chest! You get')} ${amount} 💠.`)
    pushFloat(run, chest.x, chest.y, `+${amount} 💠`, '#7fd8ff')
  } else {
    const item = choose(ACTIVE_ITEMS)
    run.bag = { ...run.bag, [item.id]: (run.bag[item.id] ?? 0) + 1 }
    addLog(run, `${langPick(run.lang, '¡Un cofre! Encuentras', 'A chest! You find')} ${activeName(run, item)}.`)
    pushFloat(run, chest.x, chest.y, '+1 🎒', '#ffe08a')
  }
}

function triggerTrap(run: DungeonRun, trapIndex: number): void {
  const trap = run.traps[trapIndex]
  run.traps = run.traps.filter((_, index) => index !== trapIndex)
  const leader = getLeader(run)
  if (!leader) return
  switch (trap.kind) {
    case 'damage': {
      const damage = Math.max(2, Math.round(leader.p.maxHp * 0.14))
      leader.p.hp = Math.max(0, leader.p.hp - damage)
      addLog(run, `${langPick(run.lang, '¡Una trampa! El líder pierde', 'A trap! The leader loses')} ${damage} PS.`)
      pushFloat(run, leader.x, leader.y, `-${damage}`, '#ff6b6b')
      if (leader.p.hp <= 0) handleDefeat(run, leader, false)
      break
    }
    case 'sleep': {
      leader.status = 'sleep'
      leader.statusTurns = randInt(2, 4)
      addLog(run, langPick(run.lang, '¡Gas somnífero! El líder se duerme.', 'Sleeping gas! The leader falls asleep.'))
      pushFloat(run, leader.x, leader.y, 'Zzz', '#a5b4fc')
      break
    }
    case 'warp': {
      addLog(run, langPick(run.lang, '¡Una trampa de teletransporte!', 'A warp trap!'))
      leader.x = run.map.stairs.x
      leader.y = run.map.stairs.y
      handleStairs(run)
      break
    }
    case 'pp': {
      for (const move of leader.p.moves) {
        if (typeof move.pp === 'number') move.pp = Math.max(0, move.pp - 3)
      }
      addLog(run, langPick(run.lang, '¡Una trampa drena los PP del líder!', 'A trap drains the leader PP!'))
      pushFloat(run, leader.x, leader.y, '-PP', '#c084fc')
      break
    }
  }
}

function handleStairs(run: DungeonRun): void {
  if (run.floor >= run.totalFloors) {
    if (run.bossDefeated) {
      if (run.status === 'playing') {
        const bonus = Math.round(DUNGEON_BY_ID[run.dungeonId].reward * effectiveCrystalMultiplier(run))
        run.crystalsEarned += bonus
        run.status = 'won'
        addLog(run, langPick(run.lang, '¡Has escapado de la mazmorra!', 'You escaped the dungeon!'))
        pushFloat(run, run.map.stairs.x, run.map.stairs.y, `+${bonus} 💠`, '#7fd8ff')
      }
    } else {
      addLog(run, langPick(run.lang, 'El sello del jefe bloquea las escaleras.', 'The boss seal blocks the stairs.'))
    }
    return
  }
  run.pendingFloor = run.floor + 1
  addLog(run, langPick(run.lang, 'Encuentras las escaleras al siguiente piso.', 'You find the stairs to the next floor.'))
}

export function descendFloor(run: DungeonRun): DungeonRun {
  if (run.status !== 'playing' || run.pendingFloor === null) return run
  const nextFloor = run.pendingFloor
  const floorBonus = Math.round((6 + nextFloor * 2) * effectiveCrystalMultiplier(run))
  run.crystalsEarned += floorBonus
  addLog(run, `${langPick(run.lang, 'Desciendes al piso', 'You descend to floor')} ${nextFloor}. (+${floorBonus} 💠)`)
  for (const member of run.party) {
    const heal = Math.max(1, Math.round(member.p.maxHp * 0.2))
    member.p.hp = Math.min(member.p.maxHp, member.p.hp + heal)
    for (const move of member.p.moves) {
      if (typeof move.maxPp === 'number') {
        move.pp = Math.min(move.maxPp, (move.pp ?? 0) + Math.max(1, Math.round(move.maxPp * 0.25)))
      }
    }
  }
  return buildFloor(run, nextFloor)
}

export function waitTurn(run: DungeonRun): DungeonRun {
  if (run.status !== 'playing' || run.pendingFloor !== null || run.dialogue.length > 0) return run
  const leader = getLeader(run)
  if (leader && consumeLeaderIncapacitation(run, leader)) return run
  addLog(run, langPick(run.lang, 'Esperas un turno.', 'You wait a turn.'))
  finishTurn(run)
  return run
}

function moveForAttack(monster: DungeonMonster, index: number, run: DungeonRun): Move {
  const move = monster.p.moves[index] ?? monster.p.moves[0]
  if (!move) return STRUGGLE
  if (typeof move.pp === 'number' && move.pp <= 0) {
    addLog(run, `${monster.p.name} ${langPick(run.lang, 'no tiene PP y usa Forcejeo.', 'has no PP and uses Struggle.')}`)
    return STRUGGLE
  }
  if (typeof move.pp === 'number') move.pp = Math.max(0, move.pp - 1)
  return move
}

function performAttack(
  run: DungeonRun,
  attacker: DungeonMonster,
  defender: DungeonMonster,
  move: Move,
): void {
  attacker.facing = directionRow(defender.x - attacker.x, defender.y - attacker.y)
  attacker.animUntil = Date.now() + 380

  const accuracy = move.accuracy ?? 100
  if (accuracy < 100 && Math.random() * 100 > accuracy) {
    addLog(run, `${attacker.p.name} ${langPick(run.lang, 'falla', 'misses')} ${move.name}.`)
    pushFloat(run, defender.x, defender.y, langPick(run.lang, 'Fallo', 'Miss'), '#cbd5e1')
    return
  }

  const physical = move.damageClass !== 'special'
  const attackStat = physical ? attacker.p.attack : attacker.p.spAttack
  const defenseStat = physical ? defender.p.defense : defender.p.spDefense
  const types = defender.p.types ?? ['normal']
  const effectiveness = getTypeEffectiveness(move.type, types[0] ?? 'normal', types[1]).effectiveness
  const stab = (attacker.p.types ?? []).includes(move.type) ? 1.3 : 1
  const playerCrit = attacker.isPlayer ? run.bonuses.critPct : 0
  const crit = Math.random() < 0.06 + playerCrit / 100
  const variance = 0.88 + Math.random() * 0.24
  const power = Math.max(1, move.power ?? 0)
  const base = Math.floor(
    (((2 * attacker.level) / 5 + 2) * power * attackStat) / Math.max(1, defenseStat) / 50 + 2,
  )
  const sideMultiplier = attacker.isPlayer ? 1 : 0.82
  let damage = Math.max(1, Math.floor(base * effectiveness * stab * variance * sideMultiplier * (crit ? 1.55 : 1)))
  if (effectiveness === 0) damage = 0

  const heldItem = attacker.heldItem ? HELD_ITEM_BY_ID[attacker.heldItem] : null
  if (damage > 0 && heldItem && heldItem.type === move.type) {
    damage = Math.max(1, Math.round(damage * (1 + heldItem.boost / 100)))
  }

  if (damage > 0) {
    defender.p.hp = Math.max(0, defender.p.hp - damage)
    pushFloat(run, defender.x, defender.y, `-${damage}`, crit ? '#fbbf24' : '#ff8a8a')
    if (crit) addLog(run, langPick(run.lang, '¡Golpe crítico!', 'Critical hit!'))
    if (effectiveness > 1) addLog(run, langPick(run.lang, '¡Es muy eficaz!', 'It is super effective!'))
    if (effectiveness < 1 && effectiveness > 0) addLog(run, langPick(run.lang, 'No es muy eficaz...', 'It is not very effective...'))
    if (effectiveness === 0) addLog(run, langPick(run.lang, 'No afecta al objetivo.', 'It does not affect the target.'))
    addLog(
      run,
      `${attacker.p.name} → ${defender.p.name}: ${move.name} (${damage})`,
    )
  } else {
    addLog(run, `${attacker.p.name} ${langPick(run.lang, 'usa', 'uses')} ${move.name}...`)
  }

  if (damage > 0 && defender.isPlayer && defender.p.hp > 0 && run.bonuses.reflectPct > 0) {
    const reflected = Math.max(1, Math.round(damage * run.bonuses.reflectPct / 100))
    attacker.p.hp = Math.max(0, attacker.p.hp - reflected)
    pushFloat(run, attacker.x, attacker.y, `-${reflected}`, '#c084fc')
    addLog(run, `${attacker.p.name} ${langPick(run.lang, 'recibe', 'takes')} ${reflected} ${langPick(run.lang, 'de daño reflejado.', 'reflected damage.')}`)
    if (attacker.p.hp <= 0) handleDefeat(run, attacker, attacker.isPlayer, defender)
  }

  if (defender.isBoss && !defender.bossEnraged && defender.p.hp > 0 && defender.p.hp <= defender.p.maxHp / 2) {
    defender.bossEnraged = true
    defender.p.attack = Math.round(defender.p.attack * 1.25)
    defender.p.spAttack = Math.round(defender.p.spAttack * 1.25)
    addLog(run, langPick(run.lang, '¡El jefe entra en furia!', 'The boss enters a fury!'))
    pushFloat(run, defender.x, defender.y, langPick(run.lang, '¡Furia!', 'Fury!'), '#ff6b6b')
  }

  if (move.ailment && Math.random() * 100 < (move.ailmentChance ?? 15)) {
    if (move.ailment === 'poison' || move.ailment === 'burn') {
      defender.status = 'poison'
      defender.statusTurns = 4
    } else if (move.ailment === 'sleep') {
      defender.status = 'sleep'
      defender.statusTurns = randInt(2, 4)
    } else if (move.ailment === 'paralysis') {
      defender.status = 'paralyze'
      defender.statusTurns = 3
    }
    if (defender.status !== 'none') {
      addLog(run, `${defender.p.name} ${langPick(run.lang, 'sufre', 'suffers')} ${defender.status}.`)
    }
  }

  if (defender.p.hp <= 0) {
    handleDefeat(run, defender, defender.isPlayer, attacker)
  }
}

function handleDefeat(run: DungeonRun, monster: DungeonMonster, isAlly: boolean, killer?: DungeonMonster): void {
  if (isAlly) {
    run.party = run.party.filter((member) => member.uid !== monster.uid)
    run.fallen = [...run.fallen, { ...monster, p: { ...monster.p, hp: 0 } }]
    addLog(run, `${monster.p.name} ${langPick(run.lang, 'cae.', 'faints.')}`)
    if (monster.uid === run.leaderUid) {
      const nextLeader = run.party[0]
      if (nextLeader) {
        nextLeader.isLeader = true
        run.leaderUid = nextLeader.uid
        setDialogue(
          run,
          nextLeader.p.name,
          langPick(run.lang, '¡No te preocupes, yo tomo el relevo!', 'Do not worry, I will take over!'),
          nextLeader.p.id,
          'Determined',
        )
        addLog(run, `${nextLeader.p.name} ${langPick(run.lang, 'pasa a ser el líder.', 'becomes the leader.')}`)
      } else {
        run.status = 'lost'
        addLog(run, langPick(run.lang, 'Todo el equipo ha caído...', 'The whole team has fallen...'))
        setDialogue(run, '???', langPick(run.lang, 'La mazmorra reclama vuestros pasos...', 'The dungeon claims your steps...'))
      }
    }
    return
  }

  run.enemies = run.enemies.filter((enemy) => enemy.uid !== monster.uid)
  addLog(run, `${monster.p.name} ${langPick(run.lang, 'es derrotado.', 'is defeated.')}`)
  pushFloat(run, monster.x, monster.y, '¡K.O.!', '#fbbf24')
  run.enemiesDefeated += 1

  const crystals = Math.max(1, Math.round((1 + Math.floor(run.floor / 3) + randInt(0, 2)) * effectiveCrystalMultiplier(run)))
  run.crystalsEarned += crystals
  addLog(run, `+${crystals} 💠`)
  pushFloat(run, monster.x, monster.y, `+${crystals} 💠`, '#7fd8ff')

  if (killer && killer.isPlayer) {
    grantXp(run, killer, 8 + monster.level * 3)
  }

  if (monster.isBoss) {
    run.bossDefeated = true
    run.revealMap = true
    run.traps = run.traps.map((trap) => ({ ...trap, revealed: true }))
    const bonus = Math.round(DUNGEON_BY_ID[run.dungeonId].reward * effectiveCrystalMultiplier(run))
    run.crystalsEarned += bonus
    addLog(run, langPick(run.lang, '¡El guardián de la mazmorra ha caído!', 'The dungeon guardian has fallen!'))
    setDialogue(
      run,
      monster.p.name,
      langPick(run.lang, 'Impresionante... las escaleras son tuyas.', 'Impressive... the stairs are yours.'),
      monster.p.id,
      'Pain',
    )
    checkMission(run)
    return
  }

  const leader = getLeader(run)
  const recruitChance = 0.08 + run.bonuses.recruitPct / 100 + Math.max(0, (leader?.level ?? 1) - monster.level) * 0.02
  if (run.party.length < MAX_PARTY_SIZE && Math.random() < recruitChance) {
    const recruited: DungeonMonster = {
      ...monster,
      uid: nextUid('ally'),
      isPlayer: true,
      isLeader: false,
      isBoss: false,
      status: 'none',
      statusTurns: 0,
      animUntil: 0,
      p: { ...monster.p, hp: Math.max(1, Math.round(monster.p.maxHp * 0.5)) },
    }
    run.party = [...run.party, recruited]
    run.recruits += 1
    addLog(run, `¡${monster.p.name} ${langPick(run.lang, 'se une al equipo!', 'joins the team!')}`)
    addLog(
      run,
      langPick(
        run.lang,
        'Completa este piso para desbloquearlo en el Equipo de Expedición.',
        'Complete this floor to unlock it in the Expedition Team.',
      ),
    )
    setDialogue(
      run,
      monster.p.name,
      langPick(run.lang, '¡Eh! Puedo acompañaros... si me aceptáis.', 'Hey! I can come along... if you will have me.'),
      monster.p.id,
      'Happy',
    )
  }
  checkMission(run)
}

function grantXp(run: DungeonRun, monster: DungeonMonster, amount: number): void {
  const gain = Math.round(amount * (1 + run.bonuses.xpPct / 100))
  monster.xp += gain
  let threshold = 10 + monster.level * 8
  while (monster.xp >= threshold) {
    monster.xp -= threshold
    monster.level += 1
    monster.p.level = monster.level
    const hpGain = Math.max(2, Math.round(monster.p.maxHp * 0.08))
    monster.p.maxHp += hpGain
    monster.p.hp = Math.min(monster.p.maxHp, monster.p.hp + hpGain)
    monster.p.attack = Math.round(monster.p.attack * 1.05) + 1
    monster.p.defense = Math.round(monster.p.defense * 1.04) + 1
    monster.p.spAttack = Math.round(monster.p.spAttack * 1.05) + 1
    monster.p.spDefense = Math.round(monster.p.spDefense * 1.04) + 1
    addLog(run, `¡${monster.p.name} ${langPick(run.lang, 'sube al nivel', 'reaches level')} ${monster.level}!`)
    pushFloat(run, monster.x, monster.y, `¡Nv. ${monster.level}!`, '#fbbf24')
    threshold = 10 + monster.level * 8
  }
}

function floorModifierTick(run: DungeonRun): void {
  if (run.floorModifier !== 'sandstorm' && run.floorModifier !== 'lava') return
  const ratio = run.floorModifier === 'sandstorm' ? 0.02 : 0.03
  for (const member of [...run.party]) {
    const damage = Math.max(1, Math.round(member.p.maxHp * ratio))
    member.p.hp = Math.max(0, member.p.hp - damage)
    pushFloat(run, member.x, member.y, `-${damage}`, run.floorModifier === 'lava' ? '#ff9a62' : '#d6b36a')
    if (member.p.hp <= 0) handleDefeat(run, member, true)
  }
}

function finishTurn(run: DungeonRun): void {
  if (run.status !== 'playing') return
  run.turn += 1
  run.floatTexts = run.floatTexts.filter((floatText) => Date.now() - floatText.born < 1500)
  allyActions(run)
  if (run.status === 'playing') enemyActions(run)
  if (run.status === 'playing') floorModifierTick(run)
  if (run.status === 'playing') poisonTick(run)
  if (run.status === 'playing') regenTick(run)
  checkMission(run)
}

function allyActions(run: DungeonRun): void {
  const allies = [...run.party]
  for (const ally of allies) {
    if (run.status !== 'playing') return
    if (ally.uid === run.leaderUid) continue
    if (!run.party.some((member) => member.uid === ally.uid)) continue
    if (ally.status === 'sleep') {
      ally.statusTurns -= 1
      if (ally.statusTurns <= 0) ally.status = 'none'
      continue
    }
    const adjacent = run.enemies.find((enemy) => distance(ally, enemy) === 1)
    if (adjacent) {
      const move = moveForAttack(ally, randInt(0, Math.max(0, ally.p.moves.length - 1)), run)
      performAttack(run, ally, adjacent, move)
      continue
    }
    const target = nearestEnemy(run, ally)
    if (target && distance(ally, target) <= 4) {
      stepToward(run, ally, target, true)
    }
  }
}

function enemyActions(run: DungeonRun): void {
  const enemies = [...run.enemies]
  for (const enemy of enemies) {
    if (run.status !== 'playing') return
    if (!run.enemies.some((entry) => entry.uid === enemy.uid)) continue
    if (enemy.status === 'sleep') {
      enemy.statusTurns -= 1
      if (enemy.statusTurns <= 0) enemy.status = 'none'
      continue
    }
    if (enemy.status === 'paralyze' && Math.random() < 0.35) {
      pushFloat(run, enemy.x, enemy.y, 'Paralizado', '#c084fc')
      continue
    }
    const adjacent = run.party.find((member) => distance(member, enemy) === 1)
    if (adjacent) {
      const move = moveForAttack(enemy, randInt(0, Math.max(0, enemy.p.moves.length - 1)), run)
      performAttack(run, enemy, adjacent, move)
      continue
    }
    const target = nearestAlly(run, enemy)
    if (target && distance(enemy, target) <= (enemy.isBoss ? 10 : 5)) {
      stepToward(run, enemy, target, false)
    } else if (Math.random() < 0.18) {
      const direction = choose([
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 1, y: 1 },
        { x: -1, y: -1 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ])
      stepEnemy(run, enemy, direction.x, direction.y)
    }
  }
}

function nearestEnemy(run: DungeonRun, from: DungeonMonster): DungeonMonster | null {
  let best: DungeonMonster | null = null
  let bestDistance = Infinity
  for (const enemy of run.enemies) {
    const value = distance(from, enemy)
    if (value < bestDistance) {
      best = enemy
      bestDistance = value
    }
  }
  return best
}

function nearestAlly(run: DungeonRun, from: DungeonMonster): DungeonMonster | null {
  let best: DungeonMonster | null = null
  let bestDistance = Infinity
  for (const ally of run.party) {
    const value = distance(from, ally)
    if (value < bestDistance) {
      best = ally
      bestDistance = value
    }
  }
  return best
}

function stepToward(run: DungeonRun, monster: DungeonMonster, target: DungeonMonster, isAlly: boolean): void {
  const dx = Math.sign(target.x - monster.x)
  const dy = Math.sign(target.y - monster.y)
  const attempts = Math.abs(target.x - monster.x) >= Math.abs(target.y - monster.y)
    ? [{ x: dx, y: 0 }, { x: 0, y: dy }]
    : [{ x: 0, y: dy }, { x: dx, y: 0 }]
  for (const attempt of attempts) {
    if (attempt.x === 0 && attempt.y === 0) continue
    if (isAlly) {
      if (stepAlly(run, monster, attempt.x, attempt.y)) return
    } else if (stepEnemy(run, monster, attempt.x, attempt.y)) {
      return
    }
  }
}

function stepAlly(run: DungeonRun, monster: DungeonMonster, dx: number, dy: number): boolean {
  const x = monster.x + dx
  const y = monster.y + dy
  if (!isWalkable(run.map, x, y)) return false
  if (monsterAt(run, x, y)) return false
  monster.facing = directionRow(dx, dy)
  monster.x = x
  monster.y = y
  monster.animUntil = Date.now() + 320
  return true
}

function stepEnemy(run: DungeonRun, monster: DungeonMonster, dx: number, dy: number): boolean {
  const x = monster.x + dx
  const y = monster.y + dy
  if (!isWalkable(run.map, x, y)) return false
  if (monsterAt(run, x, y)) return false
  monster.facing = directionRow(dx, dy)
  monster.x = x
  monster.y = y
  monster.animUntil = Date.now() + 320
  return true
}

function poisonTick(run: DungeonRun): void {
  for (const monster of [...run.party, ...run.enemies]) {
    if (monster.status !== 'poison') continue
    const damage = Math.max(1, Math.round(monster.p.maxHp * 0.08))
    monster.p.hp = Math.max(0, monster.p.hp - damage)
    pushFloat(run, monster.x, monster.y, `-${damage}`, '#c084fc')
    if (monster.p.hp <= 0) {
      handleDefeat(run, monster, monster.isPlayer, getLeader(run) ?? undefined)
    }
  }
}

function regenTick(run: DungeonRun): void {
  if (run.bonuses.healPerTurn <= 0) return
  for (const member of run.party) {
    if (member.p.hp >= member.p.maxHp) continue
    member.p.hp = Math.min(member.p.maxHp, member.p.hp + run.bonuses.healPerTurn)
  }
}

function adjacentSpecialTree(run: DungeonRun, leader: DungeonMonster): { tree: MapTree; index: number } | null {
  const trees = run.map.trees ?? []
  let fallback = -1
  for (let index = 0; index < trees.length; index++) {
    const tree = trees[index]
    if (!tree.special || tree.broken || distance(leader, tree) !== 1) continue
    if (directionRow(tree.x - leader.x, tree.y - leader.y) === leader.facing) {
      return { tree, index }
    }
    if (fallback < 0) fallback = index
  }
  return fallback >= 0 ? { tree: trees[fallback], index: fallback } : null
}

function grantDecorationLoot(run: DungeonRun, x: number, y: number, source: 'tree' | 'rock'): void {
  const totalItems = Object.values(run.bag).reduce((sum, amount) => sum + amount, 0)
  if (totalItems < run.bagCapacity) {
    const item = choose(ACTIVE_ITEMS)
    run.bag = { ...run.bag, [item.id]: (run.bag[item.id] ?? 0) + 1 }
    const from = source === 'tree'
      ? langPick(run.lang, 'Del tronco cae', 'From the trunk falls')
      : langPick(run.lang, 'De entre los pedazos cae', 'From the rubble falls')
    addLog(run, `${from} ${activeName(run, item)}.`)
    pushFloat(run, x, y, '+1 🎒', '#ffe08a')
  } else {
    addLog(
      run,
      source === 'tree'
        ? langPick(run.lang, 'La bolsa está llena: el objeto del árbol se pierde.', 'The bag is full: the tree item is lost.')
        : langPick(run.lang, 'La bolsa está llena: el objeto de la roca se pierde.', 'The bag is full: the rock item is lost.'),
    )
    pushFloat(run, x, y, langPick(run.lang, '¡Bolsa llena!', 'Bag full!'), '#ff9a9a')
  }
}

function breakSpecialTree(
  run: DungeonRun,
  leader: DungeonMonster,
  target: { tree: MapTree; index: number },
  move: Move,
): void {
  leader.facing = directionRow(target.tree.x - leader.x, target.tree.y - leader.y)
  leader.animUntil = Date.now() + 380
  run.map.trees = (run.map.trees ?? []).map((tree, index) =>
    index === target.index ? { ...tree, broken: true } : tree,
  )
  // El tronco deja libre la casilla: pasa a ser suelo transitable.
  run.map.tiles[target.tree.y][target.tree.x] = 1
  addLog(run, `${leader.p.name} ${langPick(run.lang, 'usa', 'uses')} ${move.name}...`)
  addLog(run, langPick(run.lang, '¡El árbol se rompe en mil astillas!', 'The tree splinters into pieces!'))
  pushFloat(run, target.tree.x, target.tree.y, '💥', '#ffb347')
  playTreeBreak()
  grantDecorationLoot(run, target.tree.x, target.tree.y, 'tree')
}

function adjacentSpecialRock(run: DungeonRun, leader: DungeonMonster): { rock: MapRock; index: number } | null {
  const rocks = run.map.rocks ?? []
  let fallback = -1
  for (let index = 0; index < rocks.length; index++) {
    const rock = rocks[index]
    if (!rock.special || rock.broken || distance(leader, rock) !== 1) continue
    if (directionRow(rock.x - leader.x, rock.y - leader.y) === leader.facing) {
      return { rock, index }
    }
    if (fallback < 0) fallback = index
  }
  return fallback >= 0 ? { rock: rocks[fallback], index: fallback } : null
}

function breakSpecialRock(
  run: DungeonRun,
  leader: DungeonMonster,
  target: { rock: MapRock; index: number },
  move: Move,
): void {
  leader.facing = directionRow(target.rock.x - leader.x, target.rock.y - leader.y)
  leader.animUntil = Date.now() + 380
  run.map.rocks = (run.map.rocks ?? []).map((rock, index) =>
    index === target.index ? { ...rock, broken: true } : rock,
  )
  // La roca deja libre la casilla: pasa a ser suelo transitable.
  run.map.tiles[target.rock.y][target.rock.x] = 1
  addLog(run, `${leader.p.name} ${langPick(run.lang, 'usa', 'uses')} ${move.name}...`)
  addLog(run, langPick(run.lang, '¡La roca negra se parte en mil pedazos!', 'The black rock shatters into pieces!'))
  pushFloat(run, target.rock.x, target.rock.y, '💥', '#c084fc')
  playRockBreak()
  grantDecorationLoot(run, target.rock.x, target.rock.y, 'rock')
}

export function playerAttack(run: DungeonRun): DungeonRun {
  if (run.status !== 'playing' || run.pendingFloor !== null || run.dialogue.length > 0) return run
  const leader = getLeader(run)
  if (!leader) return run
  if (consumeLeaderIncapacitation(run, leader)) return run
  const adjacent = run.enemies.find((enemy) => distance(leader, enemy) === 1)
  if (!adjacent) {
    const treeTarget = adjacentSpecialTree(run, leader)
    const rockTarget = treeTarget ? null : adjacentSpecialRock(run, leader)
    if (!treeTarget && !rockTarget) {
      addLog(run, langPick(run.lang, 'No hay enemigos adyacentes.', 'There are no adjacent enemies.'))
      return run
    }
    const selected = leader.p.moves[run.selectedMove ?? 0] ?? leader.p.moves[0]
    const requiredType = treeTarget ? 'fire' : 'fighting'
    if (!selected || selected.type !== requiredType) {
      addLog(
        run,
        treeTarget
          ? langPick(
            run.lang,
            'Ese árbol solo puede romperse con un ataque de tipo Fuego.',
            'That tree can only be broken with a Fire-type attack.',
          )
          : langPick(
            run.lang,
            'Esa roca negra solo puede romperse con un ataque de tipo Lucha.',
            'That black rock can only be broken with a Fighting-type attack.',
          ),
      )
      return run
    }
    if (typeof selected.pp === 'number' && selected.pp <= 0) {
      addLog(run, langPick(run.lang, 'Ese movimiento no tiene PP.', 'That move has no PP left.'))
      return run
    }
    const move = moveForAttack(leader, run.selectedMove ?? 0, run)
    if (treeTarget) breakSpecialTree(run, leader, treeTarget, move)
    else if (rockTarget) breakSpecialRock(run, leader, rockTarget, move)
    finishTurn(run)
    return run
  }
  const move = moveForAttack(leader, run.selectedMove ?? 0, run)
  performAttack(run, leader, adjacent, move)
  finishTurn(run)
  return run
}

export function canUseItem(run: DungeonRun, itemId: string): boolean {
  const count = run.bag[itemId] ?? 0
  if (count <= 0) return false
  const definition = ACTIVE_BY_ID[itemId]
  if (!definition) return false
  if ((definition.effect === 'revive' || definition.effect === 'reviveFull') && run.fallen.length === 0) return false
  return true
}

export function useActiveItem(run: DungeonRun, itemId: string): DungeonRun {
  if (run.status !== 'playing' || run.pendingFloor !== null || run.dialogue.length > 0) return run
  if (!canUseItem(run, itemId)) return run
  const leader = getLeader(run)
  if (leader && consumeLeaderIncapacitation(run, leader)) return run
  const definition = ACTIVE_BY_ID[itemId]
  if (!definition) return run
  const count = run.bag[itemId] ?? 0
  run.bag = { ...run.bag, [itemId]: count - 1 }
  if (run.bag[itemId] <= 0) {
    const nextBag = { ...run.bag }
    delete nextBag[itemId]
    run.bag = nextBag
  }
  applyActiveEffect(run, definition)
  addLog(run, `${langPick(run.lang, 'Usas', 'You use')} ${activeName(run, definition)}.`)
  finishTurn(run)
  return run
}

function applyActiveEffect(run: DungeonRun, item: ActiveItemDef): void {
  const leader = getLeader(run)
  switch (item.effect) {
    case 'heal': {
      const target = [...run.party].sort((a, b) => a.p.hp / a.p.maxHp - b.p.hp / b.p.maxHp)[0]
      if (target) {
        const healed = Math.min(item.power, target.p.maxHp - target.p.hp)
        target.p.hp += healed
        pushFloat(run, target.x, target.y, `+${healed}`, '#7fe08a')
      }
      break
    }
    case 'healLeader': {
      if (leader) {
        const healed = Math.min(item.power, leader.p.maxHp - leader.p.hp)
        leader.p.hp += healed
        pushFloat(run, leader.x, leader.y, `+${healed}`, '#7fe08a')
      }
      break
    }
    case 'healTeam': {
      for (const member of run.party) {
        const healed = Math.min(item.power, member.p.maxHp - member.p.hp)
        member.p.hp += healed
        if (healed > 0) pushFloat(run, member.x, member.y, `+${healed}`, '#7fe08a')
      }
      addLog(run, langPick(run.lang, 'El equipo recupera PS.', 'The team recovers HP.'))
      break
    }
    case 'healFullSingle': {
      const target = [...run.party].sort((a, b) => a.p.hp / a.p.maxHp - b.p.hp / b.p.maxHp)[0]
      if (target) {
        const healed = target.p.maxHp - target.p.hp
        target.p.hp = target.p.maxHp
        pushFloat(run, target.x, target.y, `+${healed}`, '#7fe08a')
      }
      break
    }
    case 'revive': {
      const fallen = run.fallen[0]
      if (fallen) {
        const revived: DungeonMonster = {
          ...fallen,
          uid: nextUid('ally'),
          isLeader: false,
          isBoss: false,
          status: 'none',
          statusTurns: 0,
          p: { ...fallen.p, hp: Math.max(1, Math.round(fallen.p.maxHp * (item.power / 100))) },
          x: leader?.x ?? run.map.start.x,
          y: leader?.y ?? run.map.start.y,
        }
        run.fallen = run.fallen.slice(1)
        run.party = [...run.party, revived]
        addLog(run, `¡${revived.p.name} ${langPick(run.lang, 'vuelve al combate!', 'returns to battle!')}`)
        pushFloat(run, revived.x, revived.y, '¡Revive!', '#7fe08a')
      }
      break
    }
    case 'reviveFull': {
      const fallen = run.fallen[0]
      if (fallen) {
        const revived: DungeonMonster = {
          ...fallen,
          uid: nextUid('ally'),
          isLeader: false,
          isBoss: false,
          status: 'none',
          statusTurns: 0,
          p: { ...fallen.p, hp: fallen.p.maxHp },
          x: leader?.x ?? run.map.start.x,
          y: leader?.y ?? run.map.start.y,
        }
        run.fallen = run.fallen.slice(1)
        run.party = [...run.party, revived]
        addLog(run, `¡${revived.p.name} ${langPick(run.lang, 'vuelve al combate con todos sus PS!', 'returns to battle at full HP!')}`)
        pushFloat(run, revived.x, revived.y, '¡Revive!', '#7fe08a')
      }
      break
    }
    case 'escape': {
      run.status = 'escaped'
      addLog(run, langPick(run.lang, 'Escapas de la mazmorra con lo obtenido.', 'You escape the dungeon with your loot.'))
      break
    }
    case 'cure': {
      for (const member of run.party) {
        member.status = 'none'
        member.statusTurns = 0
      }
      addLog(run, langPick(run.lang, 'El equipo se cura de todo estado.', 'The team is cured of all status.'))
      break
    }
    case 'curePoison': {
      for (const member of run.party) {
        if (member.status === 'poison') {
          member.status = 'none'
          member.statusTurns = 0
        }
      }
      addLog(run, langPick(run.lang, 'El veneno del equipo desaparece.', 'The team is cured of poison.'))
      break
    }
    case 'cureSleep': {
      for (const member of run.party) {
        if (member.status === 'sleep') {
          member.status = 'none'
          member.statusTurns = 0
        }
      }
      addLog(run, langPick(run.lang, 'El equipo se despierta.', 'The team wakes up.'))
      break
    }
    case 'cureParalyze': {
      for (const member of run.party) {
        if (member.status === 'paralyze') {
          member.status = 'none'
          member.statusTurns = 0
        }
      }
      addLog(run, langPick(run.lang, 'La parálisis del equipo desaparece.', 'The team is cured of paralysis.'))
      break
    }
    case 'attack': {
      for (const member of run.party) member.p.attack += item.power
      addLog(run, langPick(run.lang, 'El equipo aumenta su ataque.', 'The team boosts its attack.'))
      break
    }
    case 'defense': {
      for (const member of run.party) member.p.defense += item.power
      addLog(run, langPick(run.lang, 'El equipo refuerza su defensa.', 'The team reinforces its defense.'))
      break
    }
    case 'spAttack': {
      for (const member of run.party) member.p.spAttack += item.power
      addLog(run, langPick(run.lang, 'El equipo potencia su ataque especial.', 'The team boosts its special attack.'))
      break
    }
    case 'spDefense': {
      for (const member of run.party) member.p.spDefense += item.power
      addLog(run, langPick(run.lang, 'El equipo refuerza su defensa especial.', 'The team reinforces its special defense.'))
      break
    }
    case 'speed': {
      for (const member of run.party) member.p.speed += item.power
      addLog(run, langPick(run.lang, 'El equipo gana velocidad.', 'The team gains speed.'))
      break
    }
    case 'crit': {
      run.bonuses.critPct = Math.min(100, run.bonuses.critPct + item.power)
      addLog(run, langPick(run.lang, 'El equipo afina su puntería crítica.', 'The team sharpens its critical aim.'))
      break
    }
    case 'crystals': {
      run.bonuses.crystalPct += item.power
      addLog(run, langPick(run.lang, 'El equipo atrae más Cristales de Gremio.', 'The team draws in more Guild Crystals.'))
      break
    }
    case 'xp': {
      run.bonuses.xpPct += item.power
      addLog(run, langPick(run.lang, 'El equipo gana más experiencia.', 'The team earns more experience.'))
      break
    }
    case 'fullRestore': {
      for (const member of run.party) {
        member.p.hp = member.p.maxHp
        member.status = 'none'
        member.statusTurns = 0
      }
      addLog(run, langPick(run.lang, 'El equipo recupera todos sus PS y estados.', 'The team recovers all HP and status.'))
      break
    }
    case 'reveal': {
      run.revealMap = true
      run.traps = run.traps.map((trap) => ({ ...trap, revealed: true }))
      addLog(run, langPick(run.lang, 'El mapa y las trampas quedan al descubierto.', 'The map and traps are revealed.'))
      break
    }
    case 'warp': {
      if (leader) {
        leader.x = run.map.stairs.x
        leader.y = run.map.stairs.y
        handleStairs(run)
      }
      break
    }
    case 'paralyze': {
      const room = leader ? roomIndexAt(run.map, leader.x, leader.y) : -1
      for (const enemy of run.enemies) {
        if (room < 0 || roomIndexAt(run.map, enemy.x, enemy.y) === room) {
          enemy.status = 'paralyze'
          enemy.statusTurns = 3
        }
      }
      addLog(run, langPick(run.lang, 'Los enemigos de la sala quedan paralizados.', 'The enemies in the room are paralyzed.'))
      break
    }
    case 'sleep': {
      const room = leader ? roomIndexAt(run.map, leader.x, leader.y) : -1
      for (const enemy of run.enemies) {
        if (room < 0 || roomIndexAt(run.map, enemy.x, enemy.y) === room) {
          enemy.status = 'sleep'
          enemy.statusTurns = 3
        }
      }
      addLog(run, langPick(run.lang, 'Los enemigos de la sala se duermen.', 'The enemies in the room fall asleep.'))
      break
    }
    case 'pp': {
      for (const member of run.party) {
        for (const move of member.p.moves) {
          if (typeof move.maxPp === 'number') move.pp = move.maxPp
        }
      }
      addLog(run, langPick(run.lang, 'Todos los PP quedan restaurados.', 'All PP are restored.'))
      break
    }
    case 'ppLeader': {
      if (leader) {
        for (const move of leader.p.moves) {
          if (typeof move.maxPp === 'number') move.pp = move.maxPp
        }
      }
      addLog(run, langPick(run.lang, 'El líder recupera todos sus PP.', 'The leader recovers all PP.'))
      break
    }
    case 'damage': {
      const room = leader ? roomIndexAt(run.map, leader.x, leader.y) : -1
      const targets = run.enemies.filter(
        (enemy) => room < 0 || roomIndexAt(run.map, enemy.x, enemy.y) === room,
      )
      for (const enemy of targets) {
        const damage = Math.max(1, Math.round(item.power * (1 + run.floor * 0.06)))
        enemy.p.hp = Math.max(0, enemy.p.hp - damage)
        pushFloat(run, enemy.x, enemy.y, `-${damage}`, '#ff8a8a')
        if (enemy.p.hp <= 0) handleDefeat(run, enemy, false, leader ?? undefined)
      }
      addLog(run, langPick(run.lang, 'Una explosión sacude la sala.', 'An explosion shakes the room.'))
      break
    }
  }
}

export function buildDungeonResult(run: DungeonRun, save: DungeonSave): DungeonResult {
  const lostPenalty = run.status === 'lost' ? 0.5 : 1
  return {
    status: run.status,
    dungeonId: run.dungeonId,
    floor: run.floor,
    crystalsEarned: Math.max(0, Math.round(run.crystalsEarned * lostPenalty)),
    enemiesDefeated: run.enemiesDefeated,
    recruits: run.recruits,
    missionsCompleted: run.missionComplete ? 1 : 0,
    isFirstClear: run.status === 'won' && !save.clearedDungeons.includes(run.dungeonId),
  }
}
