import type {
  ActiveItemDef,
  DungeonDef,
  DungeonId,
  DungeonSave,
  PassiveDef,
  RunBonuses,
  UpgradeDef,
  UpgradeKind,
} from './types'

export const DUNGEON_STORAGE_KEY = 'pokerand_dungeon_v1'
export const MAX_PASSIVE_SLOTS = 3
export const MAX_PARTY_SIZE = 4

export const DUNGEONS: DungeonDef[] = [
  {
    id: 'forest',
    name: 'Bosque Susurrante',
    nameEn: 'Whispering Woods',
    desc: 'Un laberinto de árboles vivos donde los Pokémon salvajes protegen sus secretos. Ideal para empezar.',
    descEn: 'A maze of living trees where wild Pokémon guard their secrets. A good place to start.',
    icon: '🌲',
    floors: 5,
    levelStart: 5,
    levelEnd: 9,
    enemyPool: [10, 13, 16, 19, 21, 43, 69, 161],
    minionPool: [16, 43, 69],
    bossId: 3,
    bossLevel: 11,
    reward: 60,
    palette: {
      floor: '#3b4b34',
      floorAlt: '#425539',
      wall: '#1d2419',
      wallTop: '#2b3826',
      accent: '#8fdc7a',
      fog: 'rgba(18, 32, 16, 0.55)',
    },
    intro: [
      'El aire huele a resina y a musgo húmedo.',
      'Unas huellas pequeñas se pierden entre los helechos.',
    ],
    introEn: [
      'The air smells of resin and damp moss.',
      'Small footprints vanish among the ferns.',
    ],
  },
  {
    id: 'cave',
    name: 'Caverna Cristal',
    nameEn: 'Crystal Cavern',
    desc: 'Galerías profundas iluminadas por vetas de cristal. Los ecos no siempre son tuyos.',
    descEn: 'Deep galleries lit by crystal veins. The echoes are not always yours.',
    icon: '💎',
    floors: 7,
    levelStart: 10,
    levelEnd: 16,
    enemyPool: [41, 42, 74, 75, 95, 104, 111, 246],
    minionPool: [74, 95, 246],
    bossId: 208,
    bossLevel: 18,
    reward: 120,
    unlockAfter: 'forest',
    palette: {
      floor: '#37405a',
      floorAlt: '#3f4966',
      wall: '#181d2c',
      wallTop: '#252d45',
      accent: '#7fd8ff',
      fog: 'rgba(12, 18, 34, 0.55)',
    },
    intro: [
      'Los cristales zumban con una energía antigua.',
      'Algo grande se arrastra en la oscuridad.',
    ],
    introEn: [
      'The crystals hum with an ancient energy.',
      'Something large drags itself through the dark.',
    ],
  },
  {
    id: 'tower',
    name: 'Torre Celeste',
    nameEn: 'Celestial Tower',
    desc: 'Una torre rota que atraviesa las nubes. En la cima espera una presencia que no debería existir.',
    descEn: 'A broken tower piercing the clouds. At the top waits a presence that should not exist.',
    icon: '🗼',
    floors: 8,
    levelStart: 17,
    levelEnd: 24,
    enemyPool: [81, 82, 100, 101, 137, 239, 240, 243],
    minionPool: [82, 101, 239],
    bossId: 150,
    bossLevel: 27,
    reward: 220,
    unlockAfter: 'cave',
    palette: {
      floor: '#4a4258',
      floorAlt: '#544b64',
      wall: '#221d2e',
      wallTop: '#332b44',
      accent: '#e6b3ff',
      fog: 'rgba(24, 16, 34, 0.55)',
    },
    intro: [
      'El viento aúlla entre vigas de piedra flotante.',
      'Cada piso parece más alto que el anterior.',
    ],
    introEn: [
      'The wind howls between floating stone beams.',
      'Each floor seems taller than the last.',
    ],
  },
]

export const DUNGEON_BY_ID: Record<DungeonId, DungeonDef> = DUNGEONS.reduce(
  (acc, dungeon) => {
    acc[dungeon.id] = dungeon
    return acc
  },
  {} as Record<DungeonId, DungeonDef>,
)

export interface StarterDef {
  id: number
  name: string
  nameEn: string
  desc: string
  descEn: string
  icon: string
  color: string
  types: string[]
}

export const STARTERS: StarterDef[] = [
  {
    id: 1,
    name: 'Bulbasaur',
    nameEn: 'Bulbasaur',
    desc: 'Equilibrado y resistente. Semilla curativa.',
    descEn: 'Balanced and sturdy. Healing seed.',
    icon: '🌱',
    color: '#63c46b',
    types: ['grass', 'poison'],
  },
  {
    id: 4,
    name: 'Charmander',
    nameEn: 'Charmander',
    desc: 'Frágil pero con gran ataque especial.',
    descEn: 'Fragile but with great special attack.',
    icon: '🔥',
    color: '#f0803c',
    types: ['fire'],
  },
  {
    id: 7,
    name: 'Squirtle',
    nameEn: 'Squirtle',
    desc: 'Defensa sólida y buena reserva de PS.',
    descEn: 'Solid defense and good HP pool.',
    icon: '💧',
    color: '#5aa9e6',
    types: ['water'],
  },
  {
    id: 25,
    name: 'Pikachu',
    nameEn: 'Pikachu',
    desc: 'Rápido y letal. Ideal para emboscadas.',
    descEn: 'Fast and lethal. Ideal for ambushes.',
    icon: '⚡',
    color: '#f4d03f',
    types: ['electric'],
  },
  {
    id: 133,
    name: 'Eevee',
    nameEn: 'Eevee',
    desc: 'Comodín versátil con mucha suerte.',
    descEn: 'Versatile wildcard with plenty of luck.',
    icon: '⭐',
    color: '#c9a26b',
    types: ['normal'],
  },
  {
    id: 447,
    name: 'Riolu',
    nameEn: 'Riolu',
    desc: 'Aura combativa. Golpea duro y resiste.',
    descEn: 'Fighting aura. Hits hard and endures.',
    icon: '🥊',
    color: '#6d8bd8',
    types: ['fighting'],
  },
]

export const STARTER_BY_ID: Record<number, StarterDef> = STARTERS.reduce(
  (acc, starter) => {
    acc[starter.id] = starter
    return acc
  },
  {} as Record<number, StarterDef>,
)

// Descripciones breves para los Pokémon que pueden reclutarse en las mazmorras.
// Se mantienen al estilo de las fichas de los iniciales.
export const RECRUIT_DESCRIPTIONS: Record<number, { es: string; en: string }> = {
  10: { es: 'Pequeño y voraz. Evoluciona muy rápido.', en: 'Small and hungry. Evolves quickly.' },
  13: { es: 'Veneno en la cola. Mejor no tocarlo.', en: 'Poison in its tail. Best not to touch.' },
  16: { es: 'Rápido y común. Buen explorador.', en: 'Fast and common. A good scout.' },
  19: { es: 'Ágil y mordaz. Siempre encuentra comida.', en: 'Nimble and fierce. Always finds food.' },
  21: { es: 'Territorial y veloz. Ataca sin avisar.', en: 'Territorial and swift. Strikes without warning.' },
  41: { es: 'Orienta con ecos en la oscuridad.', en: 'Navigates by echoes in the dark.' },
  42: { es: 'Colmillos sedientos. Vuela sin descanso.', en: 'Thirsty fangs. Flies without rest.' },
  43: { es: 'Absorbe luz de noche. Olor medicinal.', en: 'Absorbs moonlight. A medicinal scent.' },
  69: { es: 'Raíces firmes y tallos flexibles.', en: 'Firm roots and flexible stems.' },
  74: { es: 'Duro como la roca. Puños fiables.', en: 'Hard as rock. Reliable fists.' },
  75: { es: 'Rueda por las cuevas sin freno.', en: 'Rolls through caves without brakes.' },
  81: { es: 'Chispas constantes. Flota sin rumbo.', en: 'Constant sparks. Drifts aimlessly.' },
  82: { es: 'Triple campo magnético. Muy ruidoso.', en: 'Triple magnetic field. Very loud.' },
  95: { es: 'Serpiente de piedra. Muro viviente.', en: 'Stone serpent. A living wall.' },
  100: { es: 'Una chispa y explota. Manéjalo bien.', en: 'One spark and it blows. Handle with care.' },
  101: { es: 'Rueda veloz. Explosión imprevisible.', en: 'Rolls fast. Unpredictable explosion.' },
  104: { es: 'Solitario y resistente. Golpea con hueso.', en: 'Lone and sturdy. Strikes with bone.' },
  111: { es: 'Embestidas brutales. Piel de roca.', en: 'Brutal charges. Rocky hide.' },
  137: { es: 'Datos hechos Pokémon. Ataca a distancia.', en: 'Data turned Pokémon. Attacks from afar.' },
  161: { es: 'Vigila el horizonte desde su cola.', en: 'Keeps watch from atop its tail.' },
  239: { es: 'Energía eléctrica en cada puño.', en: 'Electric energy in every punch.' },
  240: { es: 'Cuerpo ardiente. Pequeño pero intenso.', en: 'Burning body. Small but intense.' },
  243: { es: 'Relámpago vivo. Velocidad salvaje.', en: 'Living lightning. Savage speed.' },
  246: { es: 'Come tierra. Crece lento pero fuerte.', en: 'Eats earth. Grows slow but strong.' },
}

export const ACTIVE_ITEMS: ActiveItemDef[] = [
  {
    id: 'baya-oran',
    name: 'Baya Oran',
    nameEn: 'Oran Berry',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/oran-berry.png',
    desc: 'Restaura 25 PS al aliado más herido.',
    descEn: 'Restores 25 HP to the most injured ally.',
    price: 20,
    effect: 'heal',
    power: 25,
  },
  {
    id: 'semilla-vivificadora',
    name: 'Revivir',
    nameEn: 'Revive',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/revive.png',
    desc: 'Revive a un aliado caído con la mitad de sus PS.',
    descEn: 'Revives a fallen ally with half their HP.',
    price: 80,
    effect: 'revive',
    power: 50,
  },
  {
    id: 'orbe-huida',
    name: 'Cuerda Huida',
    nameEn: 'Escape Rope',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/escape-rope.png',
    desc: 'Te saca de la mazmorra conservando los cristales obtenidos.',
    descEn: 'Escapes the dungeon keeping the crystals earned.',
    price: 50,
    effect: 'escape',
    power: 0,
  },
  {
    id: 'semilla-cura',
    name: 'Cura Total',
    nameEn: 'Full Heal',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/full-heal.png',
    desc: 'Cura todos los estados alterados del equipo.',
    descEn: 'Cures all status conditions on the team.',
    price: 30,
    effect: 'cure',
    power: 0,
  },
  {
    id: 'semilla-poder',
    name: 'Ataque X',
    nameEn: 'X Attack',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-attack.png',
    desc: 'Aumenta el Ataque y Ataque Especial del equipo durante la expedición.',
    descEn: 'Raises the team Attack and Sp. Attack for the expedition.',
    price: 45,
    effect: 'attack',
    power: 3,
  },
  {
    id: 'semilla-hierro',
    name: 'Defensa X',
    nameEn: 'X Defense',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-defense.png',
    desc: 'Aumenta la Defensa del equipo durante la expedición.',
    descEn: 'Raises the team Defense for the expedition.',
    price: 45,
    effect: 'defense',
    power: 3,
  },
  {
    id: 'lagrima-lince',
    name: 'Lente Ancha',
    nameEn: 'Wide Lens',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/wide-lens.png',
    desc: 'Revela el mapa y todas las trampas del piso.',
    descEn: 'Reveals the map and every trap on the floor.',
    price: 25,
    effect: 'reveal',
    power: 0,
  },
  {
    id: 'semilla-teletransporte',
    name: 'MT Psíquico',
    nameEn: 'Psychic TM',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-psychic.png',
    desc: 'Teletransporta al líder hasta las escaleras del piso.',
    descEn: 'Teleports the leader to the floor stairs.',
    price: 35,
    effect: 'warp',
    power: 0,
  },
  {
    id: 'semilla-paralisis',
    name: 'MT Eléctrica',
    nameEn: 'Electric TM',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-electric.png',
    desc: 'Paraliza a todos los enemigos de la sala.',
    descEn: 'Paralyzes every enemy in the room.',
    price: 40,
    effect: 'paralyze',
    power: 0,
  },
  {
    id: 'elixir-maximo',
    name: 'Elixir Máximo',
    nameEn: 'Max Elixir',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/max-elixir.png',
    desc: 'Restaura todos los PP de los movimientos del equipo.',
    descEn: 'Restores all move PP for the team.',
    price: 50,
    effect: 'pp',
    power: 0,
  },
  {
    id: 'bomba-humo',
    name: 'Bola de Humo',
    nameEn: 'Smoke Ball',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/smoke-ball.png',
    desc: 'Hiere a todos los enemigos de la sala.',
    descEn: 'Damages every enemy in the room.',
    price: 65,
    effect: 'damage',
    power: 22,
  },
]

export const ACTIVE_BY_ID: Record<string, ActiveItemDef> = ACTIVE_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item
    return acc
  },
  {} as Record<string, ActiveItemDef>,
)

export const PASSIVE_ITEMS: PassiveDef[] = [
  {
    id: 'agallas',
    name: 'Agallas',
    nameEn: 'Guts',
    icon: '🔥',
    desc: '+12% de Ataque para todo el equipo.',
    descEn: '+12% Attack for the whole team.',
    price: 120,
    effects: { attackPct: 12 },
  },
  {
    id: 'coraza',
    name: 'Coraza',
    nameEn: 'Sturdy Shell',
    icon: '🐢',
    desc: '+3 de Defensa para todo el equipo.',
    descEn: '+3 Defense for the whole team.',
    price: 110,
    effects: { defense: 3 },
  },
  {
    id: 'bolsa-honda',
    name: 'Bolsa Honda',
    nameEn: 'Deep Bag',
    icon: '🎒',
    desc: '+2 espacios en la bolsa de la expedición.',
    descEn: '+2 expedition bag slots.',
    price: 90,
    effects: { bagSlots: 2 },
  },
  {
    id: 'arco-amigo',
    name: 'Arco Amigo',
    nameEn: 'Friend Bow',
    icon: '🏹',
    desc: '+12% de probabilidad de reclutar enemigos.',
    descEn: '+12% chance to recruit enemies.',
    price: 130,
    effects: { recruitPct: 12 },
  },
  {
    id: 'amuleto-suerte',
    name: 'Amuleto Suerte',
    nameEn: 'Lucky Charm',
    icon: '🍀',
    desc: '+15% de cristales obtenidos.',
    descEn: '+15% crystals earned.',
    price: 140,
    effects: { crystalPct: 15 },
  },
  {
    id: 'campana-concha',
    name: 'Campana Concha',
    nameEn: 'Shell Bell',
    icon: '🔔',
    desc: 'El equipo recupera 2 PS al final de cada turno.',
    descEn: 'The team recovers 2 HP at the end of each turn.',
    price: 120,
    effects: { healPerTurn: 2 },
  },
  {
    id: 'lente-visor',
    name: 'Lente Visor',
    nameEn: 'Scope Lens',
    icon: '🔭',
    desc: '+8% de probabilidad de golpe crítico.',
    descEn: '+8% critical hit chance.',
    price: 130,
    effects: { critPct: 8 },
  },
  {
    id: 'repartir-exp',
    name: 'Repartir Exp',
    nameEn: 'Exp. Share',
    icon: '📈',
    desc: '+20% de experiencia obtenida.',
    descEn: '+20% experience gained.',
    price: 150,
    effects: { xpPct: 20 },
  },
  {
    id: 'cinta-experto',
    name: 'Cinta Experto',
    nameEn: 'Expert Belt',
    icon: '🎗️',
    desc: '+8% de Ataque y +4% de crítico.',
    descEn: '+8% Attack and +4% critical chance.',
    price: 180,
    effects: { attackPct: 8, critPct: 4 },
  },
  {
    id: 'bufanda-trampas',
    name: 'Bufanda Trampas',
    nameEn: 'Trap Scarf',
    icon: '🧣',
    desc: 'Revela las trampas al entrar en cada piso y +1 Defensa.',
    descEn: 'Reveals traps on every floor and +1 Defense.',
    price: 100,
    effects: { revealTraps: true, defense: 1 },
  },
]

export const PASSIVE_BY_ID: Record<string, PassiveDef> = PASSIVE_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item
    return acc
  },
  {} as Record<string, PassiveDef>,
)

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'vitalidad',
    name: 'Vitalidad',
    nameEn: 'Vitality',
    icon: '❤️',
    desc: '+8 PS máximos por nivel para todo el equipo.',
    descEn: '+8 max HP per level for the whole team.',
    maxLevel: 5,
    costs: [30, 50, 80, 120, 170],
    kind: 'maxHp',
    perLevel: 8,
  },
  {
    id: 'fuerza',
    name: 'Fuerza',
    nameEn: 'Might',
    icon: '⚔️',
    desc: '+2 de Ataque por nivel para todo el equipo.',
    descEn: '+2 Attack per level for the whole team.',
    maxLevel: 5,
    costs: [30, 50, 80, 120, 170],
    kind: 'attack',
    perLevel: 2,
  },
  {
    id: 'coraza-up',
    name: 'Coraza',
    nameEn: 'Guard',
    icon: '🛡️',
    desc: '+1 de Defensa por nivel para todo el equipo.',
    descEn: '+1 Defense per level for the whole team.',
    maxLevel: 5,
    costs: [25, 45, 75, 110, 160],
    kind: 'defense',
    perLevel: 1,
  },
  {
    id: 'foco',
    name: 'Foco',
    nameEn: 'Focus',
    icon: '✨',
    desc: '+2 de Ataque Especial por nivel para todo el equipo.',
    descEn: '+2 Sp. Attack per level for the whole team.',
    maxLevel: 5,
    costs: [30, 50, 80, 120, 170],
    kind: 'spAttack',
    perLevel: 2,
  },
  {
    id: 'mochila',
    name: 'Mochila',
    nameEn: 'Satchel',
    icon: '🎒',
    desc: '+1 espacio de bolsa por nivel.',
    descEn: '+1 bag slot per level.',
    maxLevel: 3,
    costs: [40, 80, 140],
    kind: 'bag',
    perLevel: 1,
  },
  {
    id: 'carisma',
    name: 'Carisma',
    nameEn: 'Charisma',
    icon: '🤝',
    desc: '+6% de probabilidad de reclutar por nivel.',
    descEn: '+6% recruit chance per level.',
    maxLevel: 4,
    costs: [40, 80, 130, 190],
    kind: 'recruit',
    perLevel: 6,
  },
  {
    id: 'fortuna',
    name: 'Fortuna',
    nameEn: 'Fortune',
    icon: '💠',
    desc: '+8% de cristales obtenidos por nivel.',
    descEn: '+8% crystals earned per level.',
    maxLevel: 4,
    costs: [45, 90, 140, 200],
    kind: 'luck',
    perLevel: 8,
  },
  {
    id: 'entrenamiento',
    name: 'Entrenamiento',
    nameEn: 'Training',
    icon: '🎓',
    desc: 'El equipo empieza un nivel más alto por nivel de mejora.',
    descEn: 'The team starts one level higher per upgrade level.',
    maxLevel: 3,
    costs: [80, 150, 240],
    kind: 'level',
    perLevel: 1,
  },
  {
    id: 'disciplina',
    name: 'Disciplina',
    nameEn: 'Discipline',
    icon: '🔷',
    desc: '+20% de PP inicial por nivel.',
    descEn: '+20% starting PP per level.',
    maxLevel: 3,
    costs: [50, 100, 160],
    kind: 'pp',
    perLevel: 20,
  },
  {
    id: 'botiquin',
    name: 'Botiquín',
    nameEn: 'First Aid Kit',
    icon: '🧰',
    desc: 'El equipo recupera +1 PS al final de cada turno por nivel.',
    descEn: 'The team recovers +1 HP at the end of each turn per level.',
    maxLevel: 3,
    costs: [60, 120, 200],
    kind: 'heal',
    perLevel: 1,
  },
]

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = UPGRADES.reduce(
  (acc, upgrade) => {
    acc[upgrade.id] = upgrade
    return acc
  },
  {} as Record<string, UpgradeDef>,
)

export function upgradeTotal(save: DungeonSave, kind: UpgradeKind): number {
  return UPGRADES.reduce((total, upgrade) => {
    if (upgrade.kind !== kind) return total
    return total + (save.upgrades[upgrade.id] ?? 0) * upgrade.perLevel
  }, 0)
}

export function computeBonuses(save: DungeonSave): RunBonuses {
  const bonuses: RunBonuses = {
    maxHp: upgradeTotal(save, 'maxHp'),
    attack: upgradeTotal(save, 'attack'),
    defense: upgradeTotal(save, 'defense'),
    spAttack: upgradeTotal(save, 'spAttack'),
    bagSlots: upgradeTotal(save, 'bag'),
    recruitPct: upgradeTotal(save, 'recruit'),
    luckPct: upgradeTotal(save, 'luck'),
    levelBonus: upgradeTotal(save, 'level'),
    ppBonus: upgradeTotal(save, 'pp'),
    xpPct: 0,
    critPct: 0,
    healPerTurn: upgradeTotal(save, 'heal'),
    reflectPct: 0,
    crystalPct: 0,
    revealTraps: false,
    attackPct: 0,
    maxHpPassive: 0,
  }

  for (const passiveId of save.equippedPassives) {
    const passive = PASSIVE_BY_ID[passiveId]
    if (!passive) continue
    const effect = passive.effects
    bonuses.maxHp += effect.maxHp ?? 0
    bonuses.maxHpPassive += effect.maxHp ?? 0
    bonuses.attackPct += effect.attackPct ?? 0
    bonuses.defense += effect.defense ?? 0
    bonuses.recruitPct += effect.recruitPct ?? 0
    bonuses.bagSlots += effect.bagSlots ?? 0
    bonuses.xpPct += effect.xpPct ?? 0
    bonuses.critPct += effect.critPct ?? 0
    bonuses.healPerTurn += effect.healPerTurn ?? 0
    bonuses.reflectPct += effect.reflectPct ?? 0
    bonuses.crystalPct += effect.crystalPct ?? 0
    if (effect.revealTraps) bonuses.revealTraps = true
  }

  // La mejora de Fortuna y el amuleto se acumulan en el multiplicador de cristales.
  bonuses.crystalPct += bonuses.luckPct
  return bonuses
}

export function upgradeCost(def: UpgradeDef, level: number): number | null {
  if (level >= def.maxLevel) return null
  return def.costs[level] ?? null
}

export function nextDungeonId(id: DungeonId): DungeonId | null {
  const index = DUNGEONS.findIndex((dungeon) => dungeon.id === id)
  if (index < 0 || index + 1 >= DUNGEONS.length) return null
  return DUNGEONS[index + 1].id
}

export function isDungeonUnlocked(save: DungeonSave, id: DungeonId): boolean {
  return save.unlockedDungeons.includes(id)
}

export function itemName(item: ActiveItemDef | PassiveDef | UpgradeDef, lang: 'es' | 'en'): string {
  return lang === 'en' ? item.nameEn : item.name
}

export function itemDesc(
  item: ActiveItemDef | PassiveDef | UpgradeDef | StarterDef | DungeonDef,
  lang: 'es' | 'en',
): string {
  if ('descEn' in item && item.descEn) return lang === 'en' ? item.descEn : item.desc
  return ''
}
