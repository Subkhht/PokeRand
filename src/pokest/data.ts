import { pokemonSpriteUrl } from '../game/pokeapi'
import type {
  PokestAfflictionDef,
  PokestDungeonDef,
  PokestDungeonId,
  PokestEnemyDef,
  PokestEvent,
  PokestHero,
  PokestHeroDef,
  PokestNodeType,
  PokestQuirkDef,
  PokestRank,
  PokestRole,
  PokestSkill,
  PokestVirtueDef,
} from './types'

export const POKEST_STORAGE_KEY = 'pokerand_pokest_v1'

export const POKEST_MAX_ROSTER = 8
export const POKEST_MAX_TEAM = 4
export const POKEST_REST_COST = 25
export const POKEST_RECRUIT_COST = 60
export const POKEST_STARTING_GOLD = 120
export const POKEST_DEFAULT_TEAM_IDS = [6, 9, 282, 94]

type SkillInput = Omit<Partial<PokestSkill>, 'rank' | 'targetRanks'> & {
  id: string
  name: string
  nameEn: string
  rank?: number[]
  targetRanks?: number[]
}

function skill(input: SkillInput): PokestSkill {
  const { rank, targetRanks, ...rest } = input
  return {
    target: 'enemy',
    effect: 'damage',
    power: 10,
    accuracy: 90,
    crit: 5,
    cooldown: 0,
    ...rest,
    rank: (rank ?? [1, 2, 3, 4]) as PokestRank[],
    targetRanks: (targetRanks ?? [1, 2, 3, 4]) as PokestRank[],
  }
}

export const POKEST_ROLE_LABELS: Record<PokestRole, { es: string; en: string }> = {
  tank: { es: 'Bastión', en: 'Bastion' },
  bruiser: { es: 'Castigador', en: 'Bruiser' },
  healer: { es: 'Sanador', en: 'Healer' },
  support: { es: 'Apoyo', en: 'Support' },
  assassin: { es: 'Asesino', en: 'Assassin' },
  ranged: { es: 'Tirador', en: 'Ranged' },
}

export const POKEST_NODE_LABELS: Record<PokestNodeType, { es: string; en: string; icon: string }> = {
  battle: { es: 'Combate', en: 'Battle', icon: '⚔️' },
  elite: { es: 'Élite', en: 'Elite', icon: '💀' },
  event: { es: 'Evento', en: 'Event', icon: '❓' },
  camp: { es: 'Campamento', en: 'Camp', icon: '🔥' },
  treasure: { es: 'Tesoro', en: 'Treasure', icon: '💰' },
  boss: { es: 'Jefe', en: 'Boss', icon: '👑' },
}

const heroDefs: PokestHeroDef[] = [
  {
    id: 6,
    name: 'Charizard',
    title: 'Cruzado Ígneo',
    titleEn: 'Flame Crusader',
    role: 'bruiser',
    baseHp: 125,
    baseAtk: 20,
    baseDef: 13,
    baseSpd: 8,
    stressResist: 10,
    lore: 'Un veterano de las cumbres. Su llama ilumina la vanguardia y castiga a los que osan acercarse.',
    loreEn: 'A veteran of the peaks. His flame lights the vanguard and punishes those who dare come close.',
    skills: [
      skill({ id: 'char-flame', name: 'Llamarada', nameEn: 'Flamethrower', rank: [1, 2], targetRanks: [1, 2], power: 15, accuracy: 90, crit: 8, cooldown: 1 }),
      skill({ id: 'char-claw', name: 'Garra Dragón', nameEn: 'Dragon Claw', rank: [1, 2, 3], targetRanks: [1, 2], power: 11, accuracy: 95, crit: 15 }),
      skill({ id: 'char-roar', name: 'Rugido Ígneo', nameEn: 'Fire Roar', rank: [1, 2], target: 'allEnemies', targetRanks: [1, 2, 3], power: 7, accuracy: 85, crit: 5, cooldown: 3, status: 'weak', statusTurns: 2 }),
    ],
  },
  {
    id: 9,
    name: 'Blastoise',
    title: 'Bastión de Marea',
    titleEn: 'Tide Bastion',
    role: 'tank',
    baseHp: 150,
    baseAtk: 15,
    baseDef: 18,
    baseSpd: 5,
    stressResist: 20,
    lore: 'La primera línea hecha carne. Sus cañones responden mientras su caparazón aguanta lo imposible.',
    loreEn: 'The front line made flesh. His cannons answer while his shell endures the impossible.',
    skills: [
      skill({ id: 'blast-cannon', name: 'Cañón Agua', nameEn: 'Water Cannon', rank: [2, 3, 4], targetRanks: [2, 3, 4], power: 11, accuracy: 95, crit: 5 }),
      skill({ id: 'blast-protect', name: 'Protección', nameEn: 'Protect', rank: [1, 2, 3, 4], target: 'allAllies', effect: 'guard', power: 0, accuracy: 100, crit: 0, cooldown: 3 }),
      skill({ id: 'blast-hydro', name: 'Hidrobomba', nameEn: 'Hydro Pump', rank: [1, 2, 3], targetRanks: [1, 3], power: 16, accuracy: 85, crit: 8, cooldown: 2 }),
    ],
  },
  {
    id: 282,
    name: 'Gardevoir',
    title: 'Vestal del Velo',
    titleEn: 'Veiled Vestal',
    role: 'healer',
    baseHp: 95,
    baseAtk: 12,
    baseDef: 9,
    baseSpd: 10,
    stressResist: 25,
    lore: 'Escucha los pensamientos heridos y responde con una luz que calma hasta el miedo más antiguo.',
    loreEn: 'She hears wounded thoughts and answers with a light that soothes even the oldest fear.',
    skills: [
      skill({ id: 'gard-wish', name: 'Deseo', nameEn: 'Wish', rank: [1, 2, 3, 4], target: 'ally', effect: 'heal', power: 30, accuracy: 100, crit: 0, cooldown: 1 }),
      skill({ id: 'gard-psychic', name: 'Psicorrayo', nameEn: 'Psybeam', rank: [2, 3, 4], targetRanks: [2, 3, 4], power: 11, accuracy: 95, crit: 8 }),
      skill({ id: 'gard-bless', name: 'Bendición', nameEn: 'Blessing', rank: [1, 2, 3, 4], target: 'allAllies', effect: 'stressHeal', power: 10, heal: 12, accuracy: 100, crit: 0, cooldown: 3 }),
    ],
  },
  {
    id: 94,
    name: 'Gengar',
    title: 'Bandido de Sombras',
    titleEn: 'Shadow Bandit',
    role: 'assassin',
    baseHp: 100,
    baseAtk: 19,
    baseDef: 10,
    baseSpd: 12,
    stressResist: 10,
    lore: 'Sonríe desde el fondo de la sala. Cuando la antorcha parpadea, alguien ya ha dejado de respirar.',
    loreEn: 'He smiles from the back of the room. When the torch flickers, someone has already stopped breathing.',
    skills: [
      skill({ id: 'geng-shadow', name: 'Bola Sombra', nameEn: 'Shadow Ball', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 12, accuracy: 90, crit: 15 }),
      skill({ id: 'geng-lick', name: 'Lengüetazo', nameEn: 'Lick', rank: [1, 2], targetRanks: [1, 2], power: 8, accuracy: 95, crit: 5, cooldown: 2, status: 'stun', statusTurns: 1 }),
      skill({ id: 'geng-stab', name: 'Puñalada', nameEn: 'Stab', rank: [1, 2, 3], targetRanks: [1, 2], power: 14, accuracy: 90, crit: 10, cooldown: 2, status: 'bleed', statusTurns: 2 }),
    ],
  },
  {
    id: 143,
    name: 'Snorlax',
    title: 'El Lepero',
    titleEn: 'The Leper',
    role: 'bruiser',
    baseHp: 170,
    baseAtk: 18,
    baseDef: 15,
    baseSpd: 3,
    stressResist: 30,
    lore: 'Lento, enorme y difícil de matar. Su ronquido es la última cosa que muchos escuchan.',
    loreEn: 'Slow, enormous and hard to kill. His snore is the last thing many hear.',
    skills: [
      skill({ id: 'snor-body', name: 'Placaje Pesado', nameEn: 'Heavy Slam', rank: [1, 2], targetRanks: [1, 2], power: 15, accuracy: 90, crit: 5 }),
      skill({ id: 'snor-rest', name: 'Descanso', nameEn: 'Rest', rank: [1, 2, 3, 4], target: 'self', effect: 'heal', power: 40, stressHeal: 20, accuracy: 100, crit: 0, cooldown: 3 }),
      skill({ id: 'snor-snore', name: 'Ronquido', nameEn: 'Snore', rank: [1, 2, 3], target: 'allEnemies', targetRanks: [1, 2, 3], power: 7, accuracy: 85, crit: 5, cooldown: 3, status: 'weak', statusTurns: 2 }),
    ],
  },
  {
    id: 212,
    name: 'Scizor',
    title: 'Cazador de Recompensas',
    titleEn: 'Bounty Hunter',
    role: 'bruiser',
    baseHp: 115,
    baseAtk: 21,
    baseDef: 14,
    baseSpd: 9,
    stressResist: 10,
    lore: 'No persigue monstruos por honor, sino por el brillo del oro. Aun así, nunca falla una presa.',
    loreEn: 'He does not hunt monsters for honor, but for the glint of gold. Even so, he never misses his prey.',
    skills: [
      skill({ id: 'sciz-x', name: 'Pinza X', nameEn: 'X-Scissor', rank: [1, 2, 3], targetRanks: [1, 3], power: 12, accuracy: 95, crit: 10 }),
      skill({ id: 'sciz-kill', name: 'Tijera Asesina', nameEn: 'Assassin Scissors', rank: [1, 2], targetRanks: [1, 2], power: 17, accuracy: 85, crit: 15, cooldown: 2 }),
      skill({ id: 'sciz-fire', name: 'Corte Fuego', nameEn: 'Fire Slash', rank: [1, 2, 3], targetRanks: [1, 2], power: 10, accuracy: 90, crit: 8, cooldown: 2, status: 'bleed', statusTurns: 2 }),
    ],
  },
  {
    id: 123,
    name: 'Scyther',
    title: 'Arquero del Bosque',
    titleEn: 'Forest Archer',
    role: 'ranged',
    baseHp: 100,
    baseAtk: 18,
    baseDef: 9,
    baseSpd: 13,
    stressResist: 5,
    lore: 'Rápido como una hoja al viento. Ataca desde la retaguardia y desaparece antes de que el eco llegue.',
    loreEn: 'Fast as a leaf in the wind. He strikes from the back and vanishes before the echo arrives.',
    skills: [
      skill({ id: 'scy-air', name: 'Tajo Aéreo', nameEn: 'Air Slash', rank: [2, 3, 4], targetRanks: [2, 3, 4], power: 10, accuracy: 95, crit: 20 }),
      skill({ id: 'scy-quick', name: 'Ataque Rápido', nameEn: 'Quick Attack', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 7, accuracy: 100, crit: 10 }),
      skill({ id: 'scy-x', name: 'Tijera X', nameEn: 'X-Scissor', rank: [2, 3, 4], targetRanks: [2, 4], power: 15, accuracy: 85, crit: 10, cooldown: 2 }),
    ],
  },
  {
    id: 65,
    name: 'Alakazam',
    title: 'Ocultista del Vacío',
    titleEn: 'Void Occultist',
    role: 'support',
    baseHp: 85,
    baseAtk: 10,
    baseDef: 8,
    baseSpd: 14,
    stressResist: 20,
    lore: 'Ve demasiado. Cada visión le cuesta un poco de cordura, pero sus aliados siguen en pie gracias a ello.',
    loreEn: 'He sees too much. Every vision costs him a little sanity, but his allies stay standing because of it.',
    skills: [
      skill({ id: 'ala-psy', name: 'Onda Mental', nameEn: 'Psychic Wave', rank: [2, 3, 4], targetRanks: [2, 4], power: 11, accuracy: 95, crit: 10 }),
      skill({ id: 'ala-heal', name: 'Sanación', nameEn: 'Heal', rank: [1, 2, 3, 4], target: 'ally', effect: 'heal', power: 22, stressHeal: 8, accuracy: 100, crit: 0, cooldown: 2 }),
      skill({ id: 'ala-warp', name: 'Distorsión', nameEn: 'Warp', rank: [2, 3, 4], target: 'allEnemies', targetRanks: [1, 2, 3, 4], power: 6, accuracy: 85, crit: 5, cooldown: 3, status: 'weak', statusTurns: 2 }),
    ],
  },
  {
    id: 448,
    name: 'Lucario',
    title: 'Monje de Acero',
    titleEn: 'Steel Monk',
    role: 'bruiser',
    baseHp: 115,
    baseAtk: 20,
    baseDef: 12,
    baseSpd: 11,
    stressResist: 15,
    lore: 'Su aura detecta el miedo antes de que se convierta en derrota. Golpea con la precisión de un juramento.',
    loreEn: 'His aura detects fear before it becomes defeat. He strikes with the precision of an oath.',
    skills: [
      skill({ id: 'luc-aura', name: 'Esfera Aural', nameEn: 'Aura Sphere', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 11, accuracy: 100, crit: 10 }),
      skill({ id: 'luc-kick', name: 'Patada Relámpago', nameEn: 'Thunder Kick', rank: [1, 2, 3], targetRanks: [1, 2], power: 13, accuracy: 90, crit: 10, cooldown: 3, status: 'stun', statusTurns: 1 }),
      skill({ id: 'luc-counter', name: 'Contraataque', nameEn: 'Counter', rank: [1, 2, 3, 4], target: 'self', effect: 'guard', power: 0, heal: 10, accuracy: 100, crit: 0, cooldown: 2 }),
    ],
  },
  {
    id: 609,
    name: 'Chandelure',
    title: 'Lámpara de Almas',
    titleEn: 'Soul Lamp',
    role: 'ranged',
    baseHp: 90,
    baseAtk: 16,
    baseDef: 9,
    baseSpd: 8,
    stressResist: 15,
    lore: 'Ilumina el camino con fuego que no calienta. Los que se acercan demasiado pierden algo más que la vista.',
    loreEn: 'She lights the way with fire that gives no warmth. Those who come too close lose more than their sight.',
    skills: [
      skill({ id: 'chan-wisp', name: 'Fuego Fatuo', nameEn: 'Will-O-Wisp', rank: [2, 3, 4], targetRanks: [2, 4], power: 10, accuracy: 90, crit: 5, status: 'blight', statusTurns: 2 }),
      skill({ id: 'chan-inferno', name: 'Llamarada', nameEn: 'Inferno', rank: [2, 3, 4], target: 'allEnemies', targetRanks: [1, 2, 3, 4], power: 7, accuracy: 85, crit: 5, cooldown: 3, status: 'blight', statusTurns: 2 }),
      skill({ id: 'chan-curse', name: 'Maldición', nameEn: 'Curse', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 12, accuracy: 95, crit: 5, cooldown: 2, status: 'vulnerable', statusTurns: 2 }),
    ],
  },
  {
    id: 637,
    name: 'Volcarona',
    title: 'Médico de Peste',
    titleEn: 'Plague Doctor',
    role: 'support',
    baseHp: 105,
    baseAtk: 13,
    baseDef: 10,
    baseSpd: 10,
    stressResist: 20,
    lore: 'Sus polvos curan y corroen a partes iguales. Nadie sabe si su máscara es una bendición o una advertencia.',
    loreEn: 'Her powders heal and corrode in equal measure. No one knows if her mask is a blessing or a warning.',
    skills: [
      skill({ id: 'volc-poison', name: 'Polvo Veneno', nameEn: 'Poison Powder', rank: [2, 3, 4], targetRanks: [2, 4], power: 6, accuracy: 90, crit: 5, status: 'blight', statusTurns: 3 }),
      skill({ id: 'volc-dance', name: 'Danza Aleteo', nameEn: 'Flame Dance', rank: [1, 2, 3, 4], target: 'allAllies', effect: 'stressHeal', power: 12, heal: 8, accuracy: 100, crit: 0, cooldown: 2 }),
      skill({ id: 'volc-solar', name: 'Llama Solar', nameEn: 'Solar Flare', rank: [2, 3, 4], targetRanks: [2, 3, 4], power: 13, accuracy: 90, crit: 10, cooldown: 2 }),
    ],
  },
  {
    id: 359,
    name: 'Absol',
    title: 'Sepulturero',
    titleEn: 'Grave Robber',
    role: 'assassin',
    baseHp: 100,
    baseAtk: 20,
    baseDef: 9,
    baseSpd: 12,
    stressResist: 10,
    lore: 'Llega cuando el desastre ya está escrito. No lo anuncia: lo cobra.',
    loreEn: 'He arrives when disaster is already written. He does not announce it: he collects it.',
    skills: [
      skill({ id: 'abs-slash', name: 'Cuchillada', nameEn: 'Slash', rank: [1, 2, 3], targetRanks: [1, 2], power: 13, accuracy: 95, crit: 15 }),
      skill({ id: 'abs-ambush', name: 'Emboscada', nameEn: 'Ambush', rank: [1, 2], targetRanks: [1, 2], power: 17, accuracy: 85, crit: 20, cooldown: 2 }),
      skill({ id: 'abs-omen', name: 'Presagio', nameEn: 'Omen', rank: [1, 2, 3, 4], target: 'allAllies', effect: 'stressHeal', power: 10, accuracy: 100, crit: 0, cooldown: 2 }),
    ],
  },
]

const enemyDefs: Record<string, PokestEnemyDef> = {
  gastly: {
    id: 'gastly', name: 'Gastly', nameEn: 'Gastly', spriteId: 92, hp: 55, atk: 10, def: 5, spd: 9, stressResist: 0,
    type: 'Espectro', typeEn: 'Ghost',
    skills: [
      skill({ id: 'e-lick', name: 'Lengüetazo', nameEn: 'Lick', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 7, accuracy: 90, stressDamage: 6 }),
    ],
  },
  haunter: {
    id: 'haunter', name: 'Haunter', nameEn: 'Haunter', spriteId: 93, hp: 70, atk: 12, def: 6, spd: 10, stressResist: 0,
    type: 'Espectro', typeEn: 'Ghost',
    skills: [
      skill({ id: 'e-claw', name: 'Garra Umbría', nameEn: 'Shadow Claw', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 9, accuracy: 90, stressDamage: 5 }),
      skill({ id: 'e-curse', name: 'Maldición', nameEn: 'Curse', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], effect: 'stressDamage', power: 10, accuracy: 100 }),
    ],
  },
  cubone: {
    id: 'cubone', name: 'Cubone', nameEn: 'Cubone', spriteId: 104, hp: 80, atk: 12, def: 10, spd: 5, stressResist: 0,
    type: 'Hueso', typeEn: 'Bone',
    skills: [
      skill({ id: 'e-bone', name: 'Huesomerang', nameEn: 'Bone Club', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 8, accuracy: 90, stressDamage: 4 }),
    ],
  },
  misdreavus: {
    id: 'misdreavus', name: 'Misdreavus', nameEn: 'Misdreavus', spriteId: 200, hp: 65, atk: 11, def: 6, spd: 11, stressResist: 0,
    type: 'Lamento', typeEn: 'Wail',
    skills: [
      skill({ id: 'e-wail', name: 'Lamento', nameEn: 'Wail', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], effect: 'stressDamage', power: 12, accuracy: 100 }),
    ],
  },
  sableye: {
    id: 'sableye', name: 'Sableye', nameEn: 'Sableye', spriteId: 302, hp: 75, atk: 13, def: 8, spd: 9, stressResist: 0,
    type: 'Gema', typeEn: 'Gem',
    skills: [
      skill({ id: 'e-gem', name: 'Garra Gema', nameEn: 'Gem Claw', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 10, accuracy: 90, stressDamage: 4 }),
    ],
  },
  duskull: {
    id: 'duskull', name: 'Duskull', nameEn: 'Duskull', spriteId: 355, hp: 70, atk: 10, def: 9, spd: 6, stressResist: 0,
    type: 'Espectro', typeEn: 'Ghost',
    skills: [
      skill({ id: 'e-wisp', name: 'Fuego Fatuo', nameEn: 'Will-O-Wisp', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 6, accuracy: 90, status: 'blight', statusTurns: 2, stressDamage: 4 }),
    ],
  },
  spiritomb: {
    id: 'spiritomb', name: 'Spiritomb', nameEn: 'Spiritomb', spriteId: 442, hp: 95, atk: 15, def: 11, spd: 7, stressResist: 0,
    type: 'Odio', typeEn: 'Grudge',
    skills: [
      skill({ id: 'e-pulse', name: 'Pulso Umbrío', nameEn: 'Dark Pulse', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 11, accuracy: 90, stressDamage: 7 }),
    ],
  },
  golbat: {
    id: 'golbat', name: 'Golbat', nameEn: 'Golbat', spriteId: 42, hp: 75, atk: 12, def: 7, spd: 12, stressResist: 0,
    type: 'Vampiro', typeEn: 'Vampire',
    skills: [
      skill({ id: 'e-bite', name: 'Mordisco', nameEn: 'Bite', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 9, accuracy: 90, stressDamage: 5 }),
    ],
  },
  crobat: {
    id: 'crobat', name: 'Crobat', nameEn: 'Crobat', spriteId: 169, hp: 90, atk: 15, def: 8, spd: 14, stressResist: 0,
    type: 'Vampiro', typeEn: 'Vampire',
    skills: [
      skill({ id: 'e-wing', name: 'Ala Aérea', nameEn: 'Air Cutter', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 10, accuracy: 95, stressDamage: 5 }),
      skill({ id: 'e-toxic', name: 'Colmillo Tóxico', nameEn: 'Toxic Fang', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 7, accuracy: 90, status: 'blight', statusTurns: 2, stressDamage: 6 }),
    ],
  },
  umbreon: {
    id: 'umbreon', name: 'Umbreon', nameEn: 'Umbreon', spriteId: 197, hp: 100, atk: 13, def: 12, spd: 8, stressResist: 0,
    type: 'Luna', typeEn: 'Moon',
    skills: [
      skill({ id: 'e-moon', name: 'Rayo Luna', nameEn: 'Moonlight Ray', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 10, accuracy: 90, stressDamage: 7 }),
    ],
  },
  honchkrow: {
    id: 'honchkrow', name: 'Honchkrow', nameEn: 'Honchkrow', spriteId: 430, hp: 95, atk: 16, def: 9, spd: 10, stressResist: 0,
    type: 'Cuervo', typeEn: 'Raven',
    skills: [
      skill({ id: 'e-peck', name: 'Picotazo', nameEn: 'Peck', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 11, accuracy: 90, stressDamage: 5 }),
    ],
  },
  weavile: {
    id: 'weavile', name: 'Weavile', nameEn: 'Weavile', spriteId: 461, hp: 85, atk: 18, def: 8, spd: 13, stressResist: 0,
    type: 'Filo', typeEn: 'Blade',
    skills: [
      skill({ id: 'e-ice', name: 'Garra Hielo', nameEn: 'Ice Claw', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 12, accuracy: 90, crit: 10, stressDamage: 5 }),
    ],
  },
  zoroark: {
    id: 'zoroark', name: 'Zoroark', nameEn: 'Zoroark', spriteId: 571, hp: 90, atk: 17, def: 8, spd: 12, stressResist: 0,
    type: 'Ilusión', typeEn: 'Illusion',
    skills: [
      skill({ id: 'e-illusion', name: 'Garra Ilusoria', nameEn: 'Illusion Claw', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 11, accuracy: 90, stressDamage: 8 }),
    ],
  },
  bisharp: {
    id: 'bisharp', name: 'Bisharp', nameEn: 'Bisharp', spriteId: 625, hp: 105, atk: 18, def: 13, spd: 9, stressResist: 0,
    type: 'Filo', typeEn: 'Blade',
    skills: [
      skill({ id: 'e-slash', name: 'Tajo Brutal', nameEn: 'Brutal Slash', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 12, accuracy: 90, crit: 8, stressDamage: 6 }),
    ],
  },
  pangoro: {
    id: 'pangoro', name: 'Pangoro', nameEn: 'Pangoro', spriteId: 675, hp: 120, atk: 17, def: 12, spd: 6, stressResist: 0,
    type: 'Puño', typeEn: 'Fist',
    skills: [
      skill({ id: 'e-hammer', name: 'Martillo', nameEn: 'Hammer Arm', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 13, accuracy: 85, stressDamage: 7 }),
    ],
  },
  gengar: {
    id: 'gengar', name: 'Gengar', nameEn: 'Gengar', spriteId: 94, hp: 280, atk: 20, def: 12, spd: 12, stressResist: 0, boss: true,
    type: 'Señor de la Cripta', typeEn: 'Crypt Lord',
    skills: [
      skill({ id: 'boss-shadow', name: 'Bola Sombra', nameEn: 'Shadow Ball', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 10, accuracy: 90, crit: 10, stressDamage: 8 }),
      skill({ id: 'boss-curse', name: 'Maldición', nameEn: 'Curse', rank: [1, 2, 3, 4], target: 'allEnemies', targetRanks: [1, 2, 3, 4], effect: 'stressDamage', power: 16, accuracy: 100, cooldown: 2 }),
      skill({ id: 'boss-lick', name: 'Lengüetazo', nameEn: 'Lick', rank: [1, 2, 3, 4], targetRanks: [1, 2], power: 14, accuracy: 90, cooldown: 2, status: 'stun', statusTurns: 1, stressDamage: 6 }),
    ],
  },
  tyranitar: {
    id: 'tyranitar', name: 'Tyranitar', nameEn: 'Tyranitar', spriteId: 248, hp: 340, atk: 24, def: 16, spd: 7, stressResist: 0, boss: true,
    type: 'Tirano del Abismo', typeEn: 'Abyss Tyrant',
    skills: [
      skill({ id: 'boss-slam', name: 'Golpe Sísmico', nameEn: 'Seismic Slam', rank: [1, 2, 3, 4], targetRanks: [1, 2, 3, 4], power: 18, accuracy: 85, crit: 8, stressDamage: 8 }),
      skill({ id: 'boss-quake', name: 'Terremoto', nameEn: 'Earthquake', rank: [1, 2, 3, 4], target: 'allEnemies', targetRanks: [1, 2, 3, 4], power: 12, accuracy: 85, cooldown: 2, stressDamage: 6 }),
      skill({ id: 'boss-roar', name: 'Rugido Abisal', nameEn: 'Abyssal Roar', rank: [1, 2, 3, 4], target: 'allEnemies', targetRanks: [1, 2, 3, 4], effect: 'stressDamage', power: 18, accuracy: 100, cooldown: 3 }),
    ],
  },
}

export const POKEST_HERO_DEFS = heroDefs
export const POKEST_ENEMY_DEFS = enemyDefs

export const POKEST_DUNGEONS: Record<PokestDungeonId, PokestDungeonDef> = {
  crypt: {
    id: 'crypt',
    name: 'Cripta Umbría',
    nameEn: 'Gloom Crypt',
    desc: 'Pasillos de piedra, susurros entre los nichos y una antorcha que nunca dura lo suficiente.',
    descEn: 'Stone corridors, whispers between the niches and a torch that never lasts long enough.',
    icon: '🕯️',
    length: 7,
    level: 1,
    enemyPool: ['gastly', 'haunter', 'cubone', 'misdreavus', 'sableye', 'duskull', 'spiritomb'],
    bossPool: ['gengar'],
    reward: 180,
    palette: { bg: '#120b18', accent: '#c084fc', glow: 'rgba(192, 132, 252, 0.35)', fog: '#2a1638' },
    intro: [
      'La cripta huele a tierra húmeda y a promesas rotas.',
      'Algo se mueve entre las tumbas. La antorcha tiembla.',
    ],
    introEn: [
      'The crypt smells of wet earth and broken promises.',
      'Something moves among the graves. The torch trembles.',
    ],
  },
  abyss: {
    id: 'abyss',
    name: 'Fosa Abisal',
    nameEn: 'Abyssal Pit',
    desc: 'Una grieta bajo la tierra donde la luz muere y los antiguos tiranos siguen royendo el mundo.',
    descEn: 'A crack beneath the earth where light dies and ancient tyrants keep gnawing at the world.',
    icon: '🌋',
    length: 8,
    level: 2,
    enemyPool: ['golbat', 'crobat', 'umbreon', 'honchkrow', 'weavile', 'zoroark', 'bisharp', 'pangoro'],
    bossPool: ['tyranitar'],
    reward: 260,
    unlockAfter: 'crypt',
    palette: { bg: '#120d0a', accent: '#ff7a45', glow: 'rgba(255, 122, 69, 0.30)', fog: '#2b160f' },
    intro: [
      'El aire se vuelve denso. Cada paso resuena como una sentencia.',
      'En el fondo de la fosa, algo enorme abre los ojos.',
    ],
    introEn: [
      'The air grows thick. Every step echoes like a sentence.',
      'At the bottom of the pit, something enormous opens its eyes.',
    ],
  },
}

export const POKEST_EVENTS: PokestEvent[] = [
  {
    id: 'altar',
    title: 'Altar de huesos',
    titleEn: 'Bone Altar',
    desc: 'Un altar improvisado con cráneos de Pokémon. La ofrenda parece esperar algo.',
    descEn: 'A makeshift altar of Pokémon skulls. The offering seems to expect something.',
    options: [
      {
        id: 'pray', label: 'Rezar', labelEn: 'Pray', desc: 'Calma al grupo y reduce su estrés.', descEn: 'Soothes the party and reduces their stress.',
        effect: { type: 'stressHealAll', value: 15 },
      },
      {
        id: 'loot', label: 'Saquea el altar', labelEn: 'Loot the altar', desc: 'Obtienes oro. El grupo paga el precio en estrés.', descEn: 'You gain gold. The party pays the price in stress.',
        stress: 10,
        effect: { type: 'gold', value: 45 },
      },
    ],
  },
  {
    id: 'spring',
    title: 'Manantial negro',
    titleEn: 'Black Spring',
    desc: 'Un agua oscura brota entre las rocas. No huele mal, pero refleja cosas que no están ahí.',
    descEn: 'Dark water springs between the rocks. It does not smell bad, but reflects things that are not there.',
    options: [
      {
        id: 'drink', label: 'Beber', labelEn: 'Drink', desc: 'Cura las heridas del grupo.', descEn: 'Heals the party\'s wounds.',
        effect: { type: 'healAll', value: 20 },
      },
      {
        id: 'ignore', label: 'Ignorar', labelEn: 'Ignore', desc: 'Mejor no tentar a la suerte.', descEn: 'Better not tempt fate.',
        effect: { type: 'stressHealAll', value: 2 },
      },
    ],
  },
  {
    id: 'trap',
    title: 'Trampa de púas',
    titleEn: 'Spike Trap',
    desc: 'El pasillo está sembrado de púas oxidadas. Alguien tendrá que abrir camino.',
    descEn: 'The corridor is covered in rusty spikes. Someone will have to clear the way.',
    options: [
      {
        id: 'disarm', label: 'Desactivar', labelEn: 'Disarm', desc: 'Usa una ración para distraer a los mecanismos.', descEn: 'Use a ration to distract the mechanisms.',
        requires: { food: 1 },
        effect: { type: 'stressHealAll', value: 0 },
      },
      {
        id: 'force', label: 'Forzar el paso', labelEn: 'Force the way', desc: 'Alguien recibirá daño, pero el grupo avanza.', descEn: 'Someone will take damage, but the party moves on.',
        stress: 5,
        effect: { type: 'damageRandom', value: 18 },
      },
    ],
  },
  {
    id: 'merchant',
    title: 'Comerciante errante',
    titleEn: 'Wandering Merchant',
    desc: 'Una figura encapuchada ofrece provisiones a cambio de oro. No muestra la cara.',
    descEn: 'A hooded figure offers supplies for gold. It does not show its face.',
    options: [
      {
        id: 'torch', label: 'Comprar antorcha', labelEn: 'Buy torch', desc: 'Recupera 25 de antorcha.', descEn: 'Restores 25 torch.',
        requires: { gold: 20 },
        effect: { type: 'torch', value: 25 },
      },
      {
        id: 'food', label: 'Comprar comida', labelEn: 'Buy food', desc: 'Añade una ración al inventario.', descEn: 'Adds one ration to the inventory.',
        requires: { gold: 15 },
        effect: { type: 'food', value: 1 },
      },
      {
        id: 'leave', label: 'Irse', labelEn: 'Leave', desc: 'No hay trato.', descEn: 'No deal.',
        effect: { type: 'stressHealAll', value: 1 },
      },
    ],
  },
  {
    id: 'shrine',
    title: 'Santuario olvidado',
    titleEn: 'Forgotten Shrine',
    desc: 'Una estatua sin rostro sostiene una llama que lleva siglos encendida.',
    descEn: 'A faceless statue holds a flame that has burned for centuries.',
    options: [
      {
        id: 'light', label: 'Encender', labelEn: 'Light it', desc: 'Consume una antorcha y recupera 30 de antorcha.', descEn: 'Consumes a torch and restores 30 torch.',
        requires: { torch: 1 },
        effect: { type: 'torch', value: 30 },
      },
      {
        id: 'defile', label: 'Profanar', labelEn: 'Defile', desc: 'El oro brilla entre las ofrendas. El grupo no lo olvidará.', descEn: 'Gold glints among the offerings. The party will not forget it.',
        stress: 12,
        effect: { type: 'gold', value: 50 },
      },
    ],
  },
  {
    id: 'wounded',
    title: 'Pokémon herido',
    titleEn: 'Wounded Pokémon',
    desc: 'Un Pokémon malherido se arrastra hasta vosotros. No parece hostil.',
    descEn: 'A badly wounded Pokémon crawls toward you. It does not seem hostile.',
    options: [
      {
        id: 'help', label: 'Ayudar', labelEn: 'Help', desc: 'Usa una venda para curar a un aliado.', descEn: 'Use a bandage to heal an ally.',
        requires: { bandage: 1 },
        effect: { type: 'healRandom', value: 30 },
      },
      {
        id: 'rob', label: 'Registrar sus bolsillos', labelEn: 'Search its pockets', desc: 'Obtienes oro, pero la culpa pesa.', descEn: 'You gain gold, but guilt weighs heavy.',
        stress: 8,
        effect: { type: 'gold', value: 25 },
      },
    ],
  },
  {
    id: 'gambler',
    title: 'Dados del destino',
    titleEn: 'Dice of Fate',
    desc: 'Un espíritu sonriente agita unos dados de hueso. La apuesta es alta.',
    descEn: 'A grinning spirit shakes bone dice. The bet is high.',
    options: [
      {
        id: 'bet', label: 'Apostar 20 de oro', labelEn: 'Bet 20 gold', desc: 'Gana 50 o pierde la apuesta y gana estrés.', descEn: 'Win 50 or lose the bet and gain stress.',
        requires: { gold: 20 },
        effect: { type: 'gamble', value: 20 },
      },
      {
        id: 'pass', label: 'No jugar', labelEn: 'Do not play', desc: 'La cordura es un bien escaso.', descEn: 'Sanity is a scarce commodity.',
        effect: { type: 'stressHealAll', value: 2 },
      },
    ],
  },
]

export const POKEST_AFFLICTIONS: PokestAfflictionDef[] = [
  { id: 'ira', name: 'Ira', nameEn: 'Rage', desc: '+10% daño, pero +20% estrés recibido.', descEn: '+10% damage, but +20% stress taken.', color: '#ef4444' },
  { id: 'miedo', name: 'Miedo', nameEn: 'Fear', desc: '-15% daño y velocidad reducida.', descEn: '-15% damage and reduced speed.', color: '#60a5fa' },
  { id: 'paranoia', name: 'Paranoia', nameEn: 'Paranoia', desc: '+30% estrés recibido.', descEn: '+30% stress taken.', color: '#a78bfa' },
  { id: 'obsesion', name: 'Obsesión', nameEn: 'Obsession', desc: '-15% daño y -20% curación de estrés.', descEn: '-15% damage and -20% stress healing.', color: '#f472b6' },
]

export const POKEST_VIRTUES: PokestVirtueDef[] = [
  { id: 'valor', name: 'Valor', nameEn: 'Valor', desc: '+15% daño.', descEn: '+15% damage.', color: '#fbbf24' },
  { id: 'esperanza', name: 'Esperanza', nameEn: 'Hope', desc: '+20% curación de estrés.', descEn: '+20% stress healing.', color: '#34d399' },
  { id: 'determinacion', name: 'Determinación', nameEn: 'Determination', desc: '-10% daño recibido.', descEn: '-10% damage taken.', color: '#60a5fa' },
  { id: 'templanza', name: 'Templanza', nameEn: 'Temperance', desc: '-20% estrés recibido.', descEn: '-20% stress taken.', color: '#c084fc' },
]

export const POKEST_QUIRK_COST = 40
export const POKEST_TRAIN_COST = 40
export const POKEST_MAX_UPGRADE = 5

export const POKEST_QUIRKS: PokestQuirkDef[] = [
  { id: 'valiente', name: 'Valiente', nameEn: 'Brave', desc: '+6% de daño.', descEn: '+6% damage.', positive: true, atkPct: 0.06 },
  { id: 'sereno', name: 'Sereno', nameEn: 'Calm', desc: '+10 de resistencia al estrés.', descEn: '+10 stress resistance.', positive: true, stressResist: 10 },
  { id: 'afortunado', name: 'Afortunado', nameEn: 'Lucky', desc: '+5% de crítico.', descEn: '+5% crit.', positive: true, crit: 5 },
  { id: 'sanador', name: 'Sanador', nameEn: 'Healer', desc: '+15% de curación.', descEn: '+15% healing.', positive: true, healPct: 0.15 },
  { id: 'resistente', name: 'Resistente', nameEn: 'Sturdy', desc: '-6% de daño recibido.', descEn: '-6% damage taken.', positive: true, defPct: 0.06 },
  { id: 'optimista', name: 'Optimista', nameEn: 'Optimist', desc: '-10% de estrés recibido.', descEn: '-10% stress taken.', positive: true, stressPct: -0.1 },
  { id: 'cobarde', name: 'Cobarde', nameEn: 'Coward', desc: '+15% de estrés recibido.', descEn: '+15% stress taken.', positive: false, stressPct: 0.15 },
  { id: 'fragil', name: 'Frágil', nameEn: 'Frail', desc: '+8% de daño recibido.', descEn: '+8% damage taken.', positive: false, defPct: -0.08 },
  { id: 'impulsivo', name: 'Impulsivo', nameEn: 'Impulsive', desc: '-5% de daño.', descEn: '-5% damage.', positive: false, atkPct: -0.05 },
  { id: 'insomne', name: 'Insomne', nameEn: 'Insomniac', desc: '-15% de curación.', descEn: '-15% healing.', positive: false, healPct: -0.15 },
  { id: 'pesimista', name: 'Pesimista', nameEn: 'Pessimist', desc: '+10% de estrés recibido.', descEn: '+10% stress taken.', positive: false, stressPct: 0.1 },
  { id: 'torpe', name: 'Torpe', nameEn: 'Clumsy', desc: '-5% de crítico.', descEn: '-5% crit.', positive: false, crit: -5 },
]

export function getHeroDef(id: number): PokestHeroDef | undefined {
  return heroDefs.find((hero) => hero.id === id)
}

export function getEnemyDef(id: string): PokestEnemyDef | undefined {
  return enemyDefs[id]
}

export function getDungeon(id: PokestDungeonId): PokestDungeonDef {
  return POKEST_DUNGEONS[id]
}

export function getEvent(id: string | null): PokestEvent | undefined {
  return POKEST_EVENTS.find((event) => event.id === id)
}

export function getAffliction(id: string | null): PokestAfflictionDef | undefined {
  return POKEST_AFFLICTIONS.find((item) => item.id === id)
}

export function getVirtue(id: string | null): PokestVirtueDef | undefined {
  return POKEST_VIRTUES.find((item) => item.id === id)
}

export function getQuirk(id: string | null): PokestQuirkDef | undefined {
  return POKEST_QUIRKS.find((item) => item.id === id)
}

function randomQuirk(positive: boolean): PokestQuirkDef {
  const pool = POKEST_QUIRKS.filter((quirk) => quirk.positive === positive)
  return pool[Math.floor(Math.random() * pool.length)]
}

let instanceCounter = 0

function nextInstanceId(prefix: string): string {
  instanceCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${instanceCounter}-${Math.random().toString(36).slice(2, 6)}`
}

export function createHero(defId: number, level = 1, instanceId?: string): PokestHero {
  const def = getHeroDef(defId) ?? heroDefs[0]
  const scale = 1 + Math.max(0, level - 1) * 0.08
  const maxHp = Math.round(def.baseHp * scale)
  return {
    instanceId: instanceId ?? nextInstanceId(`hero-${def.id}`),
    defId: def.id,
    name: def.name,
    sprite: pokemonSpriteUrl(def.id),
    role: def.role,
    title: def.title,
    titleEn: def.titleEn,
    level,
    xp: 0,
    hp: maxHp,
    maxHp,
    stress: 0,
    maxStress: 200,
    atk: Math.round(def.baseAtk * scale),
    def: Math.round(def.baseDef * scale),
    spd: Math.round(def.baseSpd * scale),
    stressResist: def.stressResist,
    rank: 1,
    skills: def.skills,
    affliction: null,
    virtue: null,
    quirks: [randomQuirk(true).id, randomQuirk(false).id],
    weaponLevel: 0,
    armorLevel: 0,
    guard: 0,
    stun: 0,
    bleed: 0,
    blight: 0,
    weak: 0,
    vulnerable: 0,
    cooldowns: {},
    deathsDoor: false,
    alive: true,
  }
}

export function createEnemy(defId: string, level: number, rank: PokestRank): PokestHero {
  const def = getEnemyDef(defId) ?? enemyDefs.gastly
  const perLevel = def.boss ? 0.08 : 0.12
  const scale = 1 + Math.max(0, level - 1) * perLevel
  const maxHp = Math.round(def.hp * scale)
  return {
    instanceId: nextInstanceId(`enemy-${def.id}`),
    defId: def.spriteId,
    name: def.name,
    sprite: pokemonSpriteUrl(def.spriteId),
    role: 'bruiser',
    title: def.type,
    titleEn: def.typeEn,
    level,
    xp: 0,
    hp: maxHp,
    maxHp,
    stress: 0,
    maxStress: 200,
    atk: Math.round(def.atk * scale),
    def: Math.round(def.def * scale),
    spd: Math.round(def.spd * scale),
    stressResist: def.stressResist,
    rank,
    skills: def.skills,
    affliction: null,
    virtue: null,
    quirks: [],
    weaponLevel: 0,
    armorLevel: 0,
    guard: 0,
    stun: 0,
    bleed: 0,
    blight: 0,
    weak: 0,
    vulnerable: 0,
    cooldowns: {},
    deathsDoor: false,
    alive: true,
    isEnemy: true,
  }
}
