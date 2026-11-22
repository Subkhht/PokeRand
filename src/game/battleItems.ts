// Objetos equipables y Poké Balls: definiciones y cálculos de captura.
// Extraído de App.tsx para reducir el tamaño del componente principal.

import type { Pokemon } from './types'

export interface HoldableItem {
  name: string
  desc: string
  price: number
  attackMod?: number
  defenseMod?: number
  spAttackMod?: number
  spDefenseMod?: number
  speedMod?: number
  maxHpMod?: number
  healPerTurn?: number
  damageBoost?: number
  damageReduction?: number
  critChance?: number
  lifesteal?: number
  lowHpBonus?: number
  firstStrikeBonus?: number
  accuracyMod?: number
  physicalBoost?: number
  specialBoost?: number
  superEffectiveBoost?: number
  choiceLock?: boolean
  focusSash?: boolean
  endureChance?: number
  quickClawChance?: number
  assaultVest?: boolean
  eviolite?: boolean
  lifeOrb?: boolean
  rockyHelmet?: boolean
  bigRoot?: boolean
  healFraction?: number
  berryHeal?: number
  resistType?: string
  ironBall?: boolean
  isMegaStone?: boolean
  isGmaxBand?: boolean
  isPrimalOrb?: boolean
  isExpShare?: boolean
  isRedCard?: boolean
  statDropImmune?: boolean
  weatherImmune?: boolean
  powderImmune?: boolean
  secondaryImmune?: boolean
  loadedDice?: boolean
  weaknessPolicy?: boolean
  airBalloon?: boolean
  whiteHerb?: boolean
  mentalHerb?: boolean
  throatSpray?: boolean
  noContact?: boolean
  typeBoost?: { types: string[]; boost: number; onlyIds?: number[] }
}

// ¿Un Pokémon puede seguir evolucionando? (para la Joya Evolutiva/Eviolite).
export function canStillEvolve(pokemon: Pokemon): boolean {
  return pokemon.evolutionLevel != null || (pokemon.heldItemEvolutions?.length ?? 0) > 0 || pokemon.heldItemRequired != null
}

export const HOLDABLE_ITEMS: Record<string, HoldableItem> = {
  'Muscle Band': { name: 'Muscle Band', desc: '+10% daño en movimientos físicos', price: 100, physicalBoost: 0.10 },
  'Wise Glasses': { name: 'Wise Glasses', desc: '+10% daño en movimientos especiales', price: 100, specialBoost: 0.10 },
  'Choice Band': { name: 'Choice Band', desc: '+50% Ataque, pero solo puedes usar un movimiento', price: 200, attackMod: 0.50, choiceLock: true },
  'Choice Specs': { name: 'Choice Specs', desc: '+50% At. Esp., pero solo puedes usar un movimiento', price: 200, spAttackMod: 0.50, choiceLock: true },
  'Choice Scarf': { name: 'Choice Scarf', desc: '+50% Velocidad, pero solo puedes usar un movimiento', price: 200, speedMod: 0.50, choiceLock: true },
  'Leftovers': { name: 'Leftovers', desc: 'Recupera 1/16 de tu HP máximo cada turno', price: 150, healFraction: 1 / 16 },
  'Focus Sash': { name: 'Focus Sash', desc: 'A plena vida, aguanta un golpe letal y se consume', price: 150, focusSash: true },
  'Assault Vest': { name: 'Assault Vest', desc: '+50% Def. Esp., pero no puedes usar movimientos de estado', price: 200, spDefenseMod: 0.50, assaultVest: true },
  'Quick Claw': { name: 'Quick Claw', desc: '20% de probabilidad de atacar primero', price: 150, quickClawChance: 0.20 },
  'Eviolite': { name: 'Eviolite', desc: '+50% Defensa y Def. Esp. si aún puede evolucionar', price: 120, eviolite: true },
  'Life Orb': { name: 'Life Orb', desc: '+30% daño, pero pierdes 1/10 del daño infligido', price: 250, damageBoost: 0.30, lifeOrb: true },
  'Rocky Helmet': { name: 'Rocky Helmet', desc: 'El rival que te golpee pierde 1/6 de su HP máximo', price: 150, rockyHelmet: true },
  'Scope Lens': { name: 'Scope Lens', desc: 'Aumenta la probabilidad de golpe crítico', price: 120, critChance: 0.20 },
  'Telescopio': { name: 'Telescopio', desc: '+20% precisión si el rival ya atacó este turno', price: 120, accuracyMod: 0.20 },
  'Shell Bell': { name: 'Shell Bell', desc: 'Recupera 1/8 del daño infligido', price: 150, lifesteal: 1 / 8 },
  'Big Root': { name: 'Big Root', desc: '+30% de recuperación con movimientos drenantes', price: 150, bigRoot: true },
  'Wide Lens': { name: 'Wide Lens', desc: '+10% de precisión', price: 100, accuracyMod: 0.10 },
  'Sitrus Berry': { name: 'Sitrus Berry', desc: 'Restaura el 25% del HP al caer al 50%. Se consume', price: 120, berryHeal: 0.25 },
  'Focus Band': { name: 'Focus Band', desc: '10% de probabilidad de aguantar un golpe letal', price: 150, endureChance: 0.10 },
  'Iron Ball': { name: 'Iron Ball', desc: 'Reduce la Velocidad a la mitad. Los Pokémon Volador reciben daño neutral de Tierra', price: 100, speedMod: -0.50, ironBall: true },
  'Dragon Fang': { name: 'Dragon Fang', desc: '+20% daño en movimientos de tipo Dragón', price: 150, typeBoost: { types: ['dragon'], boost: 0.20 } },
  'Expert Belt': { name: 'Expert Belt', desc: '+20% daño en movimientos superefectivos', price: 150, superEffectiveBoost: 0.20 },
  'Charcoal': { name: 'Charcoal', desc: '+20% daño en movimientos de tipo Fuego', price: 150, typeBoost: { types: ['fire'], boost: 0.20 } },
  'Mystic Water': { name: 'Mystic Water', desc: '+20% daño en movimientos de tipo Agua', price: 150, typeBoost: { types: ['water'], boost: 0.20 } },
  'Miracle Seed': { name: 'Miracle Seed', desc: '+20% daño en movimientos de tipo Planta', price: 150, typeBoost: { types: ['grass'], boost: 0.20 } },
  'Sharp Beak': { name: 'Sharp Beak', desc: '+20% daño en movimientos de tipo Volador', price: 150, typeBoost: { types: ['flying'], boost: 0.20 } },
  'Black Glasses': { name: 'Black Glasses', desc: '+20% daño en movimientos de tipo Siniestro', price: 150, typeBoost: { types: ['dark'], boost: 0.20 } },
  'Twisted Spoon': { name: 'Twisted Spoon', desc: '+20% daño en movimientos de tipo Psíquico', price: 150, typeBoost: { types: ['psychic'], boost: 0.20 } },
  'Tarjeta Roja': { name: 'Tarjeta Roja', desc: 'Si te golpean con daño y sobrevives, el rival cambia', price: 1000, isRedCard: true },
  'Mega Stone': { name: 'Mega Stone', desc: 'Permite mega-evolucionar 1 vez por combate', price: 700, isMegaStone: true },
  'Dynamax Band': { name: 'Dynamax Band', desc: 'Permite gigamaximar 1 vez por combate (3 turnos)', price: 0, isGmaxBand: true },
  'Prisma Rojo': { name: 'Prisma Rojo', desc: 'Despierta la Primal Reversion de Groudon (1 vez por combate)', price: 0, isPrimalOrb: true },
  'Prisma Azul': { name: 'Prisma Azul', desc: 'Despierta la Primal Reversion de Kyogre (1 vez por combate)', price: 0, isPrimalOrb: true },
  'Diamansfera': { name: 'Diamansfera', desc: '+20% daño en movimientos Acero y Dragón si lo lleva Dialga. Transforma a Dialga en su Forma Origen.', price: 700, typeBoost: { types: ['steel', 'dragon'], boost: 0.20, onlyIds: [483] } },
  'Lustresfera': { name: 'Lustresfera', desc: '+20% daño en movimientos Agua y Dragón si lo lleva Palkia. Transforma a Palkia en su Forma Origen.', price: 700, typeBoost: { types: ['water', 'dragon'], boost: 0.20, onlyIds: [484] } },
  'Griseosfera': { name: 'Griseosfera', desc: '+20% daño en movimientos Dragón y Fantasma si la lleva Giratina. Transforma a Giratina en su Forma Origen.', price: 700, typeBoost: { types: ['dragon', 'ghost'], boost: 0.20, onlyIds: [487] } },
  'Baya Oca': { name: 'Baya Oca', desc: 'Reduce a la mitad un movimiento Fuego superefectivo. Se consume', price: 120, resistType: 'fire' },
  'Baya Kasib': { name: 'Baya Kasib', desc: 'Reduce a la mitad un movimiento Fantasma superefectivo. Se consume', price: 120, resistType: 'ghost' },
  'Babiri Berry': { name: 'Babiri Berry', desc: 'Reduce a la mitad un movimiento Acero superefectivo. Se consume', price: 120, resistType: 'steel' },
  'Baya Waca': { name: 'Baya Waca', desc: 'Reduce a la mitad un movimiento Eléctrico superefectivo. Se consume', price: 120, resistType: 'electric' },
  'Baya Rindo': { name: 'Baya Rindo', desc: 'Reduce a la mitad un movimiento Planta superefectivo. Se consume', price: 120, resistType: 'grass' },
  'Baya Colbur': { name: 'Baya Colbur', desc: 'Reduce a la mitad un movimiento Siniestro superefectivo. Se consume', price: 120, resistType: 'dark' },
  'Baya Chilan': { name: 'Baya Chilan', desc: 'Reduce a la mitad un movimiento Normal superefectivo. Se consume', price: 120, resistType: 'normal' },
  'Baya Shuca': { name: 'Baya Shuca', desc: 'Reduce a la mitad un movimiento Tierra superefectivo. Se consume', price: 120, resistType: 'ground' },
  'Baya Coba': { name: 'Baya Coba', desc: 'Reduce a la mitad un movimiento Volador superefectivo. Se consume', price: 120, resistType: 'flying' },
  'Baya Charti': { name: 'Baya Charti', desc: 'Reduce a la mitad un movimiento Roca superefectivo. Se consume', price: 120, resistType: 'rock' },
  'Baya Payapa': { name: 'Baya Payapa', desc: 'Reduce a la mitad un movimiento Psíquico superefectivo. Se consume', price: 120, resistType: 'psychic' },
  'Metal Coat': { name: 'Metal Coat', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  "King's Rock": { name: "King's Rock", desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Dragon Scale': { name: 'Dragon Scale', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Up-Grade': { name: 'Up-Grade', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Dubious Disc': { name: 'Dubious Disc', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Reaper Cloth': { name: 'Reaper Cloth', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Protector': { name: 'Protector', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Electirizer': { name: 'Electirizer', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Magmarizer': { name: 'Magmarizer', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Prism Scale': { name: 'Prism Scale', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Sachet': { name: 'Sachet', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Whipped Dream': { name: 'Whipped Dream', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Focus Sash II': { name: 'Focus Sash II', desc: 'A plena vida, aguanta un golpe letal. +30 HP máximos', price: 200, focusSash: true, maxHpMod: 30 },
  'Scope Lens II': { name: 'Scope Lens II', desc: 'Mayor probabilidad de golpe crítico', price: 200, critChance: 0.30 },
  'Shell Bell II': { name: 'Shell Bell II', desc: 'Recupera 1/6 del daño infligido', price: 250, lifesteal: 1 / 6 },
  'Assault Vest II': { name: 'Assault Vest II', desc: '+65% Def. Esp., no puedes usar movimientos de estado', price: 250, spDefenseMod: 0.65, assaultVest: true },
  'Leftovers II': { name: 'Leftovers II', desc: 'Recupera 1/8 de tu HP máximo cada turno', price: 250, healFraction: 1 / 8 },
  'Quick Claw II': { name: 'Quick Claw II', desc: '35% de probabilidad de atacar primero', price: 200, quickClawChance: 0.35 },
  'Razor Claw': { name: 'Razor Claw', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Razor Fang': { name: 'Razor Fang', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Oval Stone': { name: 'Oval Stone', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Deep Sea Tooth': { name: 'Deep Sea Tooth', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Deep Sea Scale': { name: 'Deep Sea Scale', desc: 'Evoluciona a ciertos Pokémon al subir de nivel.', price: 200 },
  'Manuscrito sombras': { name: 'Manuscrito sombras', desc: 'Evoluciona a Kubfu en Urshifu Brusco al subir de nivel.', price: 400 },
  'Manuscrito aguas': { name: 'Manuscrito aguas', desc: 'Evoluciona a Kubfu en Urshifu Fluido al subir de nivel.', price: 400 },
  'Mineral Negro': { name: 'Mineral Negro', desc: 'Evoluciona a Scyther en Kleavor al subir de nivel.', price: 200 },
  'Repartir Exp': { name: 'Repartir Exp', desc: 'Todos los Pokémon del PC ganan 1 nivel tras cada combate.', price: 130, isExpShare: true },
  'Amuleto Claro': { name: 'Amuleto Claro', desc: 'Impide que el rival baje tus estadísticas.', price: 180, statDropImmune: true },
  'Gafas Protectoras': { name: 'Gafas Protectoras', desc: 'Inmune al daño del clima y a los movimientos de polvo.', price: 150, weatherImmune: true, powderImmune: true },
  'Capa Furtiva': { name: 'Capa Furtiva', desc: 'Anula los efectos secundarios de los movimientos de daño rivales.', price: 200, secondaryImmune: true },
  'Dado Cargado': { name: 'Dado Cargado', desc: 'Los movimientos de varios golpes siempre dan 4 o 5 golpes.', price: 170, loadedDice: true },
  'Seguro Debilidad': { name: 'Seguro Debilidad', desc: 'Al recibir un golpe superefectivo sube +2 Ataque y At. Esp. Se consume.', price: 200, weaknessPolicy: true },
  'Globo Helio': { name: 'Globo Helio', desc: 'Inmunidad a Tierra hasta recibir un golpe. Se consume.', price: 160, airBalloon: true },
  'Hierba Blanca': { name: 'Hierba Blanca', desc: 'Restaura las estadísticas bajadas una vez. Se consume.', price: 140, whiteHerb: true },
  'Hierba Mental': { name: 'Hierba Mental', desc: 'Cura la anulación o la confusión una vez. Se consume.', price: 120, mentalHerb: true },
  'Espray Bucal': { name: 'Espray Bucal', desc: 'Al usar un movimiento de sonido sube +1 At. Esp. Se consume.', price: 160, throatSpray: true },
  'Guantes Protectores': { name: 'Guantes Protectores', desc: 'Tus ataques no activan efectos de contacto del rival.', price: 140, noContact: true },
}

export const HOLDABLE_ITEM_NAMES = Object.keys(HOLDABLE_ITEMS)

// --- Pokéballs ---
export interface PokeBallDef {
  name: string
  rate: number
  desc: string
  price: number
  spriteKey: string
  isMaster?: boolean
  rateFn?: (target: Pokemon, turns: number, alreadyCaught: boolean, playerLevel?: number) => number
}

// Familias que evolucionan con Piedra Lunar (Bonus de la Ball Luna).
export const MOON_STONE_FAMILY = [29, 30, 31, 32, 33, 34, 35, 36, 39, 40, 300, 301, 517, 518]

export const POKEBALLS: PokeBallDef[] = [
  { name: 'Poké Ball', rate: 1, desc: 'Una ball básica para capturar Pokémon.', price: 20, spriteKey: 'poke-ball' },
  { name: 'Great Ball', rate: 1.5, desc: 'Una ball con mayor ratio de captura.', price: 50, spriteKey: 'great-ball' },
  { name: 'Ultra Ball', rate: 2, desc: 'Una ball con alto ratio de captura.', price: 80, spriteKey: 'ultra-ball' },
  { name: 'Master Ball', rate: 99, desc: '¡Captura cualquier Pokémon sin fallo!', price: 500, spriteKey: 'master-ball', isMaster: true },
  { name: 'Quick Ball', rate: 1, desc: 'Más efectiva si se usa al inicio del combate.', price: 60, spriteKey: 'quick-ball', rateFn: (_, turns) => turns <= 1 ? 5 : 1 },
  { name: 'Timer Ball', rate: 1, desc: 'Más efectiva cuantos más turnos hayan pasado.', price: 60, spriteKey: 'timer-ball', rateFn: (_, turns) => Math.min(1 + turns * 0.3, 4) },
  { name: 'Dusk Ball', rate: 1, desc: 'Más efectiva en la oscuridad (x3).', price: 60, spriteKey: 'dusk-ball', rateFn: () => 3 },
  { name: 'Net Ball', rate: 1, desc: 'Más efectiva contra tipos Agua o Bicho (x3).', price: 60, spriteKey: 'net-ball', rateFn: (target) => target.types?.some(t => t === 'water' || t === 'bug') ? 3 : 1 },
  { name: 'Level Ball', rate: 1, desc: 'Más efectiva si tu nivel supera al del rival.', price: 60, spriteKey: 'level-ball', rateFn: (target, _, __, playerLevel) => { const ratio = (playerLevel ?? 50) / target.level; return ratio >= 4 ? 8 : ratio >= 2 ? 4 : ratio >= 1 ? 2 : 1; } },
  { name: 'Repeat Ball', rate: 1, desc: 'Más efectiva si ya capturaste esta especie (x3.5).', price: 60, spriteKey: 'repeat-ball', rateFn: (_, __, alreadyCaught) => alreadyCaught ? 3.5 : 1 },
  { name: 'Love Ball', rate: 1, desc: 'Más efectiva si es de la misma familia evolutiva (x8).', price: 60, spriteKey: 'love-ball', rateFn: (_, __, alreadyCaught) => alreadyCaught ? 8 : 1 },
  { name: 'Friend Ball', rate: 1, desc: 'Hace más amistoso al Pokémon capturado.', price: 60, spriteKey: 'friend-ball' },
  { name: 'Heavy Ball', rate: 1, desc: 'Más efectiva contra Pokémon pesados.', price: 60, spriteKey: 'heavy-ball', rateFn: (target) => Math.max(1, Math.min(Math.floor(target.maxHp / 40), 4)) },
  { name: 'Luxury Ball', rate: 1.2, desc: 'Un poco más efectiva que la Poké Ball (x1.2).', price: 40, spriteKey: 'luxury-ball' },
  { name: 'Premier Ball', rate: 1, desc: 'Una ball estándar y elegante.', price: 30, spriteKey: 'premier-ball' },
  { name: 'Fast Ball', rate: 1, desc: 'Más efectiva contra Pokémon muy rápidos (x4).', price: 60, spriteKey: 'fast-ball', rateFn: (target) => target.speed >= 100 ? 4 : 1 },
  { name: 'Nidobola', rate: 1, desc: 'Más efectiva contra Pokémon de nivel bajo.', price: 60, spriteKey: 'nest-ball', rateFn: (target) => { const lv = target.level; return lv < 15 ? 4 : lv < 25 ? 3 : lv < 35 ? 2 : 1; } },
  { name: 'Buceobola', rate: 1, desc: 'Más efectiva contra Pokémon de tipo Agua (x3.5).', price: 60, spriteKey: 'dive-ball', rateFn: (target) => target.types?.some(t => t === 'water') ? 3.5 : 1 },
  { name: 'Sanabola', rate: 1, desc: 'Cura al Pokémon capturado.', price: 40, spriteKey: 'heal-ball' },
  { name: 'Safaribola', rate: 1.5, desc: 'Una ball de la Zona Safari (x1.5).', price: 40, spriteKey: 'safari-ball' },
  { name: 'Sueñobola', rate: 1, desc: 'Más efectiva contra Pokémon dormidos (x4).', price: 60, spriteKey: 'dream-ball', rateFn: (target) => target.status?.type === 'sleep' ? 4 : 1 },
  { name: 'Ball Luna', rate: 1, desc: 'Más efectiva contra Pokémon que evolucionan con Piedra Lunar (x4).', price: 60, spriteKey: 'moon-ball', rateFn: (target) => MOON_STONE_FAMILY.includes(Number(target.id)) ? 4 : 1 },
  { name: 'Entebola', rate: 1, desc: 'Más efectiva contra Pokémon legendarios (x5).', price: 100, spriteKey: 'beast-ball', rateFn: (target) => Object.values(REGION_LEGENDARIES).flat().includes(Number(target.id)) ? 5 : 1 },
]

export const POKEBALL_NAMES = POKEBALLS.map(b => b.name)
export const POKEBALL_RATES: Record<string, number> = {}
for (const b of POKEBALLS) POKEBALL_RATES[b.name] = b.rate
export const POKEBALL_DEFS: Record<string, PokeBallDef> = {}
for (const b of POKEBALLS) POKEBALL_DEFS[b.name] = b
export const POKEBALL_PRICES: Record<string, number> = {}
for (const b of POKEBALLS) POKEBALL_PRICES[b.name] = b.price

// IDs de meta-shop para desbloquear pokeballs
export const POKEBALL_UNLOCK_IDS: Record<string, string> = {
  'Great Ball': 'unlock_great_ball',
  'Ultra Ball': 'unlock_ultra_ball',
  'Quick Ball': 'unlock_quick_ball',
  'Timer Ball': 'unlock_timer_ball',
  'Dusk Ball': 'unlock_dusk_ball',
  'Net Ball': 'unlock_net_ball',
  'Level Ball': 'unlock_level_ball',
  'Repeat Ball': 'unlock_repeat_ball',
  'Love Ball': 'unlock_love_ball',
  'Friend Ball': 'unlock_friend_ball',
  'Heavy Ball': 'unlock_heavy_ball',
  'Master Ball': 'unlock_master_ball',
  'Luxury Ball': 'unlock_luxury_ball',
  'Premier Ball': 'unlock_premier_ball',
  'Fast Ball': 'unlock_fast_ball',
  'Nidobola': 'unlock_nido_ball',
  'Buceobola': 'unlock_buceo_ball',
  'Sanabola': 'unlock_sana_ball',
  'Safaribola': 'unlock_safari_ball',
  'Sueñobola': 'unlock_sueno_ball',
  'Ball Luna': 'unlock_luna_ball',
  'Entebola': 'unlock_ente_ball',
}

export function getPokeBallRate(ballName: string, target: Pokemon, turns: number, alreadyCaught: boolean, playerLevel?: number): number {
  const def = POKEBALL_DEFS[ballName]
  if (!def) return 1
  if (def.rateFn) return def.rateFn(target, turns, alreadyCaught, playerLevel)
  return def.rate
}


// Legendarios por región (usado también por la tasa de captura).
export const REGION_LEGENDARIES: Record<number, number[]> = {
  1: [144, 145, 146, 150, 151],
  2: [243, 244, 245, 249, 250, 251],
  3: [377, 378, 379, 380, 381, 382, 383, 384, 385],
  4: [480, 481, 482, 483, 484, 485, 486, 487, 488, 490, 491, 492, 493],
  5: [494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649],
  6: [716, 717, 718, 719, 720, 721],
  7: [785, 786, 787, 788, 791, 792, 800, 801, 802, 807, 808, 809],
  8: [888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898],
  9: [1001, 1002, 1003, 1004, 1007, 1008],
}

// Todos los legendarios de todas las generaciones (para logros y la Entebola).
export const ALL_LEGENDARIES = Object.values(REGION_LEGENDARIES).flat()

