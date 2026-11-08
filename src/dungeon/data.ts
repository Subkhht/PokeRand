import type {
  ActiveItemDef,
  DailyMission,
  DungeonDef,
  DungeonId,
  DungeonSave,
  GuildMissionKind,
  HeldItemDef,
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
    enemyPool: [
      10, 11, 13, 14, 16, 19, 21, 23, 25, 29, 32, 43, 46, 48, 69, 102, 114,
      123, 127, 161, 163, 165, 167, 172, 173, 175, 187, 191, 194, 200, 204,
      214, 273, 285, 287, 290, 300, 315, 353, 406, 412, 415, 420, 427, 438,
      455, 540, 543, 548, 557, 590,
    ],
    minionPool: [10, 13, 16, 43, 69, 161, 273, 285],
    bossId: 3,
    bossPool: [3, 154, 254, 389, 470, 497, 652, 709, 724, 787, 812, 893, 908, 251, 492, 640],
    bossLevel: 11,
    floorModifiers: ['fog', 'darkness'],
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
    enemyPool: [
      27, 28, 35, 41, 42, 50, 51, 66, 67, 74, 75, 88, 89, 95, 104, 105, 109,
      110, 111, 112, 138, 140, 142, 169, 213, 246, 247, 299, 302, 303, 304,
      305, 337, 338, 343, 344, 345, 347, 369, 408, 410, 524, 525, 527, 529,
      557, 558, 564, 566, 618, 632, 688, 696, 698, 703, 714, 744, 769, 774,
      837, 838, 843, 844,
    ],
    minionPool: [41, 74, 95, 246, 304, 337, 529, 703],
    bossId: 208,
    bossPool: [76, 208, 248, 306, 464, 526, 623, 697, 699, 934, 377, 379, 639, 485, 383, 718, 719, 645, 1003],
    bossLevel: 18,
    floorModifiers: ['darkness', 'lava', 'ice'],
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
    enemyPool: [
      25, 26, 81, 82, 100, 101, 125, 135, 137, 163, 164, 169, 176, 177, 178,
      181, 196, 197, 200, 227, 233, 239, 240, 280, 281, 282, 310, 311, 312,
      325, 326, 353, 354, 355, 356, 358, 403, 404, 405, 417, 425, 426, 429,
      433, 436, 437, 462, 466, 468, 474, 475, 479, 561, 574, 575, 576, 577,
      578, 579, 587, 599, 600, 601, 605, 606, 622, 623, 677, 678, 694, 695,
      702, 707, 738, 777, 778, 780, 782, 783, 784, 825, 826, 849, 856, 857,
      858, 876,
    ],
    minionPool: [81, 100, 137, 239, 599, 605, 622, 677],
    bossId: 150,
    bossPool: [65, 150, 376, 462, 466, 474, 475, 479, 635, 738, 784, 823, 887, 144, 145, 146, 243, 380, 381, 641, 642, 785, 791, 792, 800, 894, 895],
    bossLevel: 27,
    floorModifiers: ['darkness', 'fog', 'ice'],
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
  {
    id: 'desert',
    name: 'Desierto Espejismo',
    nameEn: 'Mirage Desert',
    desc: 'Un mar de dunas donde el sol borra los caminos. Solo los más resistentes cruzan la tormenta.',
    descEn: 'A sea of dunes where the sun erases the paths. Only the toughest cross the storm.',
    icon: '🏜️',
    floors: 6,
    levelStart: 25,
    levelEnd: 31,
    enemyPool: [27, 50, 74, 111, 328, 449, 450, 529, 551, 552, 557, 843],
    minionPool: [27, 50, 74, 111, 328, 529, 557, 843],
    bossId: 330,
    bossPool: [330, 445, 450, 553, 530, 248, 934, 844, 383, 645, 718, 384, 637],
    bossLevel: 33,
    floorModifiers: ['sandstorm', 'lava', 'fog'],
    reward: 300,
    unlockAfter: 'tower',
    palette: {
      floor: '#8a6a3d',
      floorAlt: '#9a7846',
      wall: '#3d2c1b',
      wallTop: '#5a4228',
      accent: '#ffd27a',
      fog: 'rgba(60, 40, 18, 0.55)',
    },
    intro: [
      'El viento arrastra arena ardiente entre las ruinas.',
      'Las huellas desaparecen en cuanto las dejas atrás.',
    ],
    introEn: [
      'Wind drags burning sand through the ruins.',
      'Footprints vanish as soon as you leave them behind.',
    ],
  },
  {
    id: 'abyss',
    name: 'Abismo Distorsión',
    nameEn: 'Distortion Abyss',
    desc: 'Un vacío donde las leyes del mundo se rompen. Algo antiguo espera en el fondo.',
    descEn: 'A void where the world\'s laws break. Something ancient waits at the bottom.',
    icon: '🌀',
    floors: 8,
    levelStart: 32,
    levelEnd: 39,
    enemyPool: [92, 93, 94, 200, 302, 353, 354, 355, 356, 425, 426, 442, 477, 607, 608, 778],
    minionPool: [92, 200, 302, 353, 355, 425, 442, 607],
    bossId: 487,
    bossPool: [487, 491, 488, 635, 609, 887, 778, 800, 717, 792, 571, 858, 94, 477, 302],
    bossLevel: 40,
    floorModifiers: ['darkness', 'fog', 'ice'],
    reward: 450,
    unlockAfter: 'desert',
    palette: {
      floor: '#2e2a3d',
      floorAlt: '#383247',
      wall: '#15121f',
      wallTop: '#241f33',
      accent: '#c084fc',
      fog: 'rgba(18, 12, 28, 0.6)',
    },
    intro: [
      'El suelo flota en fragmentos sobre un vacío violeta.',
      'Susurros que no son tuyos llaman desde abajo.',
    ],
    introEn: [
      'The ground floats in fragments over a violet void.',
      'Whispers that are not yours call from below.',
    ],
  },
  {
    id: 'endless',
    name: 'Mazmorra Infinita',
    nameEn: 'Endless Dungeon',
    desc: 'No tiene final. Desciende todo lo que puedas y vuelve con tus Cristales... si puedes.',
    descEn: 'It has no end. Descend as far as you can and return with your Crystals... if you can.',
    icon: '♾️',
    floors: 999,
    levelStart: 5,
    levelEnd: 100,
    enemyPool: [1, 4, 7, 25, 133, 447],
    minionPool: [],
    bossId: 150,
    bossPool: [150, 384, 493, 890, 800, 718, 487, 483, 484, 791, 792, 894, 895, 1007, 1008],
    bossLevel: 100,
    floorModifiers: ['none', 'darkness', 'fog', 'sandstorm', 'lava', 'ice'],
    reward: 500,
    unlockAfter: 'abyss',
    palette: {
      floor: '#2a3a4a',
      floorAlt: '#33465a',
      wall: '#121c26',
      wallTop: '#203040',
      accent: '#7fd8ff',
      fog: 'rgba(10, 20, 30, 0.55)',
    },
    intro: [
      'Las escaleras no terminan nunca.',
      'Cada piso es más profundo. Cada eco, más antiguo.',
    ],
    introEn: [
      'The stairs never end.',
      'Every floor is deeper. Every echo, older.',
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

// Reparto de las 1025 especies por su tipo principal. Las tres mazmorras
// originales cubren todos los tipos; las nuevas reutilizan tipos afines.
export const DUNGEON_PRIMARY_TYPES: Record<DungeonId, string[]> = {
  forest: ['grass', 'bug', 'fairy', 'normal', 'flying', 'poison', 'fighting'],
  cave: ['rock', 'ground', 'steel', 'ice', 'water', 'dark', 'fire'],
  tower: ['electric', 'psychic', 'dragon', 'ghost'],
  desert: ['ground', 'rock', 'fire', 'steel', 'dark', 'flying'],
  abyss: ['ghost', 'dark', 'psychic', 'dragon', 'fairy', 'poison'],
  endless: [
    'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
    'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
  ],
}

export const GUILD_RANKS = [
  { min: 0, name: 'Novato', nameEn: 'Novice' },
  { min: 3, name: 'Bronce', nameEn: 'Bronze' },
  { min: 7, name: 'Plata', nameEn: 'Silver' },
  { min: 12, name: 'Oro', nameEn: 'Gold' },
  { min: 18, name: 'Diamante', nameEn: 'Diamond' },
  { min: 25, name: 'Maestro', nameEn: 'Master' },
]

export function guildRank(missions: number): { name: string; nameEn: string; min: number; next: number | null } {
  let current = GUILD_RANKS[0]
  let next: number | null = null
  for (const rank of GUILD_RANKS) {
    if (missions >= rank.min) current = rank
    else {
      next = rank.min
      break
    }
  }
  return { ...current, next }
}

export function todayKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function createDailyMission(date = todayKey()): DailyMission {
  let hash = 0
  for (let index = 0; index < date.length; index++) {
    hash = (hash * 31 + date.charCodeAt(index)) >>> 0
  }
  const kinds: GuildMissionKind[] = ['defeatEnemies', 'recruit', 'collectCrystals', 'reachFloor', 'defeatBoss']
  const kind = kinds[hash % kinds.length]
  const target = kind === 'defeatEnemies'
    ? 8
    : kind === 'recruit'
      ? 2
      : kind === 'collectCrystals'
        ? 150
        : kind === 'reachFloor'
          ? 4
          : 1
  return { date, kind, target, reward: 60, progress: 0, completed: false }
}

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
    desc: 'Restaura 20 PS a todo el equipo.',
    descEn: 'Restores 20 HP to the whole team.',
    price: 30,
    effect: 'healTeam',
    power: 20,
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
  {
    id: 'pocion',
    name: 'Poción',
    nameEn: 'Potion',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png',
    desc: 'Restaura 30 PS al líder.',
    descEn: 'Restores 30 HP to the leader.',
    price: 20,
    effect: 'healLeader',
    power: 30,
  },
  {
    id: 'super-pocion',
    name: 'Superpoción',
    nameEn: 'Super Potion',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/super-potion.png',
    desc: 'Restaura 70 PS al aliado más herido.',
    descEn: 'Restores 70 HP to the most injured ally.',
    price: 50,
    effect: 'heal',
    power: 70,
  },
  {
    id: 'pocion-maxima',
    name: 'Poción Máxima',
    nameEn: 'Max Potion',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/max-potion.png',
    desc: 'Restaura todos los PS del aliado más herido.',
    descEn: 'Fully restores the most injured ally.',
    price: 120,
    effect: 'healFullSingle',
    power: 999,
  },
  {
    id: 'restauracion-total',
    name: 'Restauración Total',
    nameEn: 'Full Restore',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/full-restore.png',
    desc: 'Restaura todos los PS y cura todos los estados del equipo.',
    descEn: 'Fully restores the team and cures all status conditions.',
    price: 160,
    effect: 'fullRestore',
    power: 999,
  },
  {
    id: 'revivir-maximo',
    name: 'Revivir Máximo',
    nameEn: 'Max Revive',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/max-revive.png',
    desc: 'Revive a un aliado caído con todos sus PS.',
    descEn: 'Revives a fallen ally with full HP.',
    price: 140,
    effect: 'reviveFull',
    power: 100,
  },
  {
    id: 'antidoto',
    name: 'Antídoto',
    nameEn: 'Antidote',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/antidote.png',
    desc: 'Cura el veneno del equipo.',
    descEn: 'Cures poison on the team.',
    price: 10,
    effect: 'curePoison',
    power: 0,
  },
  {
    id: 'despertar',
    name: 'Despertar',
    nameEn: 'Awakening',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/awakening.png',
    desc: 'Despierta al equipo.',
    descEn: 'Wakes up the team.',
    price: 10,
    effect: 'cureSleep',
    power: 0,
  },
  {
    id: 'cura-paralisis',
    name: 'Cura Parálisis',
    nameEn: 'Paralyze Heal',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/paralyze-heal.png',
    desc: 'Cura la parálisis del equipo.',
    descEn: 'Cures paralysis on the team.',
    price: 10,
    effect: 'cureParalyze',
    power: 0,
  },
  {
    id: 'baya-leppa',
    name: 'Baya Leppa',
    nameEn: 'Leppa Berry',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/leppa-berry.png',
    desc: 'Restaura los PP de los movimientos del líder.',
    descEn: 'Restores the leader\'s move PP.',
    price: 25,
    effect: 'ppLeader',
    power: 0,
  },
  {
    id: 'muneco-pokemon',
    name: 'Poké Doll',
    nameEn: 'Poké Doll',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-doll.png',
    desc: 'Duerme a todos los enemigos de la sala.',
    descEn: 'Puts every enemy in the room to sleep.',
    price: 45,
    effect: 'sleep',
    power: 0,
  },
  {
    id: 'x-ataque-especial',
    name: 'X Ataque Especial',
    nameEn: 'X Sp. Atk',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-sp-atk.png',
    desc: 'Aumenta el Ataque Especial del equipo durante la expedición.',
    descEn: 'Raises the team Sp. Attack for the expedition.',
    price: 45,
    effect: 'spAttack',
    power: 3,
  },
  {
    id: 'x-defensa-especial',
    name: 'X Defensa Especial',
    nameEn: 'X Sp. Def',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-sp-def.png',
    desc: 'Aumenta la Defensa Especial del equipo durante la expedición.',
    descEn: 'Raises the team Sp. Defense for the expedition.',
    price: 45,
    effect: 'spDefense',
    power: 3,
  },
  {
    id: 'x-velocidad',
    name: 'X Velocidad',
    nameEn: 'X Speed',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-speed.png',
    desc: 'Aumenta la Velocidad del equipo durante la expedición.',
    descEn: 'Raises the team Speed for the expedition.',
    price: 45,
    effect: 'speed',
    power: 3,
  },
  {
    id: 'golpe-certero',
    name: 'Golpe Certero',
    nameEn: 'Dire Hit',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dire-hit.png',
    desc: 'Aumenta la probabilidad de golpe crítico del equipo durante la expedición.',
    descEn: 'Raises the team critical-hit chance for the expedition.',
    price: 50,
    effect: 'crit',
    power: 5,
  },
  {
    id: 'amuleto-moneda',
    name: 'Amuleto Moneda',
    nameEn: 'Amulet Coin',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/amulet-coin.png',
    desc: 'Aumenta un 25% los Cristales de Gremio obtenidos durante la expedición.',
    descEn: 'Increases Guild Crystals earned during the expedition by 25%.',
    price: 65,
    effect: 'crystals',
    power: 25,
  },
  {
    id: 'huevo-suerte',
    name: 'Huevo Suerte',
    nameEn: 'Lucky Egg',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lucky-egg.png',
    desc: 'Aumenta un 25% la experiencia obtenida durante la expedición.',
    descEn: 'Increases experience earned during the expedition by 25%.',
    price: 65,
    effect: 'xp',
    power: 25,
  },
]

export const ACTIVE_BY_ID: Record<string, ActiveItemDef> = ACTIVE_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item
    return acc
  },
  {} as Record<string, ActiveItemDef>,
)

const HELD_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items'

export const HELD_ITEMS: HeldItemDef[] = [
  { id: 'panuelo-seda', name: 'Pañuelo Seda', nameEn: 'Silk Scarf', sprite: `${HELD_SPRITE_BASE}/silk-scarf.png`, desc: 'Potencia un 20% los movimientos de tipo Normal.', descEn: 'Boosts Normal-type moves by 20%.', price: 60, type: 'normal', boost: 20 },
  { id: 'carbon', name: 'Carbón', nameEn: 'Charcoal', sprite: `${HELD_SPRITE_BASE}/charcoal.png`, desc: 'Potencia un 20% los movimientos de tipo Fuego.', descEn: 'Boosts Fire-type moves by 20%.', price: 60, type: 'fire', boost: 20 },
  { id: 'agua-mistica', name: 'Agua Mística', nameEn: 'Mystic Water', sprite: `${HELD_SPRITE_BASE}/mystic-water.png`, desc: 'Potencia un 20% los movimientos de tipo Agua.', descEn: 'Boosts Water-type moves by 20%.', price: 60, type: 'water', boost: 20 },
  { id: 'iman', name: 'Imán', nameEn: 'Magnet', sprite: `${HELD_SPRITE_BASE}/magnet.png`, desc: 'Potencia un 20% los movimientos de tipo Eléctrico.', descEn: 'Boosts Electric-type moves by 20%.', price: 60, type: 'electric', boost: 20 },
  { id: 'semilla-milagro', name: 'Semilla Milagro', nameEn: 'Miracle Seed', sprite: `${HELD_SPRITE_BASE}/miracle-seed.png`, desc: 'Potencia un 20% los movimientos de tipo Planta.', descEn: 'Boosts Grass-type moves by 20%.', price: 60, type: 'grass', boost: 20 },
  { id: 'hielo-perpetuo', name: 'Hielo Perpetuo', nameEn: 'Never-Melt Ice', sprite: `${HELD_SPRITE_BASE}/never-melt-ice.png`, desc: 'Potencia un 20% los movimientos de tipo Hielo.', descEn: 'Boosts Ice-type moves by 20%.', price: 60, type: 'ice', boost: 20 },
  { id: 'cinturon-negro', name: 'Cinturón Negro', nameEn: 'Black Belt', sprite: `${HELD_SPRITE_BASE}/black-belt.png`, desc: 'Potencia un 20% los movimientos de tipo Lucha.', descEn: 'Boosts Fighting-type moves by 20%.', price: 60, type: 'fighting', boost: 20 },
  { id: 'flecha-venenosa', name: 'Flecha Venenosa', nameEn: 'Poison Barb', sprite: `${HELD_SPRITE_BASE}/poison-barb.png`, desc: 'Potencia un 20% los movimientos de tipo Veneno.', descEn: 'Boosts Poison-type moves by 20%.', price: 60, type: 'poison', boost: 20 },
  { id: 'arena-suave', name: 'Arena Suave', nameEn: 'Soft Sand', sprite: `${HELD_SPRITE_BASE}/soft-sand.png`, desc: 'Potencia un 20% los movimientos de tipo Tierra.', descEn: 'Boosts Ground-type moves by 20%.', price: 60, type: 'ground', boost: 20 },
  { id: 'pico-afilado', name: 'Pico Afilado', nameEn: 'Sharp Beak', sprite: `${HELD_SPRITE_BASE}/sharp-beak.png`, desc: 'Potencia un 20% los movimientos de tipo Volador.', descEn: 'Boosts Flying-type moves by 20%.', price: 60, type: 'flying', boost: 20 },
  { id: 'cuchara-torcida', name: 'Cuchara Torcida', nameEn: 'Twisted Spoon', sprite: `${HELD_SPRITE_BASE}/twisted-spoon.png`, desc: 'Potencia un 20% los movimientos de tipo Psíquico.', descEn: 'Boosts Psychic-type moves by 20%.', price: 60, type: 'psychic', boost: 20 },
  { id: 'polvo-plata', name: 'Polvo Plata', nameEn: 'Silver Powder', sprite: `${HELD_SPRITE_BASE}/silver-powder.png`, desc: 'Potencia un 20% los movimientos de tipo Bicho.', descEn: 'Boosts Bug-type moves by 20%.', price: 60, type: 'bug', boost: 20 },
  { id: 'piedra-dura', name: 'Piedra Dura', nameEn: 'Hard Stone', sprite: `${HELD_SPRITE_BASE}/hard-stone.png`, desc: 'Potencia un 20% los movimientos de tipo Roca.', descEn: 'Boosts Rock-type moves by 20%.', price: 60, type: 'rock', boost: 20 },
  { id: 'tarjeta-hechizo', name: 'Tarjeta Hechizo', nameEn: 'Spell Tag', sprite: `${HELD_SPRITE_BASE}/spell-tag.png`, desc: 'Potencia un 20% los movimientos de tipo Fantasma.', descEn: 'Boosts Ghost-type moves by 20%.', price: 60, type: 'ghost', boost: 20 },
  { id: 'colmillo-dragon', name: 'Colmillo Dragón', nameEn: 'Dragon Fang', sprite: `${HELD_SPRITE_BASE}/dragon-fang.png`, desc: 'Potencia un 20% los movimientos de tipo Dragón.', descEn: 'Boosts Dragon-type moves by 20%.', price: 60, type: 'dragon', boost: 20 },
  { id: 'gafas-negras', name: 'Gafas Negras', nameEn: 'Black Glasses', sprite: `${HELD_SPRITE_BASE}/black-glasses.png`, desc: 'Potencia un 20% los movimientos de tipo Siniestro.', descEn: 'Boosts Dark-type moves by 20%.', price: 60, type: 'dark', boost: 20 },
  { id: 'revestimiento-metalico', name: 'Revestimiento Metálico', nameEn: 'Metal Coat', sprite: `${HELD_SPRITE_BASE}/metal-coat.png`, desc: 'Potencia un 20% los movimientos de tipo Acero.', descEn: 'Boosts Steel-type moves by 20%.', price: 60, type: 'steel', boost: 20 },
  { id: 'pluma-hada', name: 'Pluma Hada', nameEn: 'Fairy Feather', sprite: `${HELD_SPRITE_BASE}/fairy-feather.png`, desc: 'Potencia un 20% los movimientos de tipo Hada.', descEn: 'Boosts Fairy-type moves by 20%.', price: 60, type: 'fairy', boost: 20 },
]

export const HELD_ITEM_BY_ID: Record<string, HeldItemDef> = HELD_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item
    return acc
  },
  {} as Record<string, HeldItemDef>,
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
  {
    id: 'piel-gruesa',
    name: 'Piel Gruesa',
    nameEn: 'Thick Fat',
    icon: '🧈',
    desc: '+10 PS máximos y +2 de Defensa para todo el equipo.',
    descEn: '+10 max HP and +2 Defense for the whole team.',
    price: 150,
    effects: { maxHp: 10, defense: 2 },
  },
  {
    id: 'corazon-igneo',
    name: 'Corazón Ígneo',
    nameEn: 'Flame Heart',
    icon: '❤️‍🔥',
    desc: '+10% de Ataque y +10% de cristales obtenidos.',
    descEn: '+10% Attack and +10% crystals earned.',
    price: 160,
    effects: { attackPct: 10, crystalPct: 10 },
  },
  {
    id: 'iman-bolsa',
    name: 'Imán de Bolsa',
    nameEn: 'Bag Magnet',
    icon: '🧲',
    desc: '+1 espacio de bolsa y +6% de reclutamiento.',
    descEn: '+1 bag slot and +6% recruit chance.',
    price: 130,
    effects: { bagSlots: 1, recruitPct: 6 },
  },
  {
    id: 'sabio-experto',
    name: 'Sabio Experto',
    nameEn: 'Wise Expert',
    icon: '🧠',
    desc: '+15% de experiencia y +4% de crítico.',
    descEn: '+15% experience and +4% critical chance.',
    price: 170,
    effects: { xpPct: 15, critPct: 4 },
  },
  {
    id: 'espejo-brumoso',
    name: 'Espejo Brumoso',
    nameEn: 'Misty Mirror',
    icon: '🪞',
    desc: 'Refleja el 15% del daño recibido y +1 de Defensa.',
    descEn: 'Reflects 15% of damage taken and +1 Defense.',
    price: 180,
    effects: { reflectPct: 15, defense: 1 },
  },
  {
    id: 'baston-curativo',
    name: 'Bastón Curativo',
    nameEn: 'Healing Staff',
    icon: '🩹',
    desc: 'Recupera 1 PS por turno y +6 PS máximos.',
    descEn: 'Recovers 1 HP per turn and +6 max HP.',
    price: 150,
    effects: { healPerTurn: 1, maxHp: 6 },
  },
  {
    id: 'ojo-halcon',
    name: 'Ojo de Halcón',
    nameEn: 'Hawk Eye',
    icon: '🦅',
    desc: '+6% de crítico y +6% de reclutamiento.',
    descEn: '+6% critical chance and +6% recruit chance.',
    price: 160,
    effects: { critPct: 6, recruitPct: 6 },
  },
  {
    id: 'brujula-gremio',
    name: 'Brújula del Gremio',
    nameEn: 'Guild Compass',
    icon: '🧭',
    desc: 'Revela las trampas de cada piso y +10% de cristales.',
    descEn: 'Reveals traps on every floor and +10% crystals.',
    price: 150,
    effects: { revealTraps: true, crystalPct: 10 },
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
