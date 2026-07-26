import type { Move, Pokemon, RouteNode, RunModifier, ShopItem } from './types'

export function applyDamage(
  attacker: Pokemon,
  defender: Pokemon,
  move: Move,
  attackBoost = 0
): { damage: number } {
  const effectiveAttack = attacker.attack + attackBoost
  const baseDamage = Math.floor((move.power * effectiveAttack) / Math.max(1, defender.defense))
  const finalDamage = Math.max(3, Math.floor(baseDamage * 0.45) + 2)

  return { damage: finalDamage }
}

export function healPokemon(pokemon: Pokemon, amount: number): Pokemon {
  return {
    ...pokemon,
    hp: Math.min(pokemon.maxHp, pokemon.hp + amount)
  }
}

export function scalePokemonForNode(base: Pokemon, node: RouteNode, stepIndex: number, levelDelta = 0, difficulty: string = 'medium'): Pokemon {
  const levelMultiplier = difficulty === 'infinite' ? 2.5 : difficulty === 'hard' ? 2.0 : 1.5
  const hpMultiplier = difficulty === 'infinite' ? 6 : difficulty === 'hard' ? 5 : 4
  const statMultiplier = difficulty === 'infinite' ? 3 : difficulty === 'hard' ? 2.5 : 2

  const bonusLevel = Math.floor(stepIndex * levelMultiplier) + (node.type === 'boss' ? 2 : 0) + levelDelta
  const targetLevel = base.level + bonusLevel

  const hpBonus = bonusLevel * hpMultiplier
  const statBonus = bonusLevel * statMultiplier

  return {
    ...base,
    level: targetLevel,
    maxHp: base.maxHp + hpBonus,
    hp: base.maxHp + hpBonus,
    attack: base.attack + statBonus,
    defense: base.defense + statBonus,
    speed: base.speed + statBonus
  }
}

export function applyNoEvolutionBuff(pokemon: Pokemon): Pokemon {
  return {
    ...pokemon,
    attack: Math.floor(pokemon.attack * 1.3),
    defense: Math.floor(pokemon.defense * 1.3),
    speed: Math.floor(pokemon.speed * 1.3),
    maxHp: Math.floor(pokemon.maxHp * 1.3),
    hp: Math.floor(pokemon.hp * 1.3),
  }
}

export function generateRoute(): RouteNode[] {
  const possibleMiddleTypes: Array<'battle' | 'rest' | 'shop'> = [
    'battle', 'battle', 'battle', // Mayor probabilidad de combates
    'rest', 'rest',               // Probabilidad media de descanso
    'shop'                        // Probabilidad de tiendas
  ]

  const route: RouteNode[] = [
  ]

  // Generar aleatoriamente los nodos del 2 al 9
  for (let i = 1; i <= 9; i++) {
    const randomType = randomFrom(possibleMiddleTypes)
    let label = 'Combate'

    if (randomType === 'rest') label = 'Descanso'
    else if (randomType === 'shop') label = 'Tienda'

    route.push({
      id: i,
      type: randomType,
      label: `${label} ${i}`,
      done: false
    })
  }

  // La última casilla siempre es el Jefe Final
  route.push({ id: 10, type: 'boss', label: 'Jefe Final', done: false })

  return route
}

export function generateBossRushRoute(totalNodes: number): RouteNode[] {
  const route: RouteNode[] = []
  for (let i = 1; i < totalNodes; i++) {
    route.push({
      id: i,
      type: 'battle',
      label: `Ruta ${i}`,
      done: false
    })
  }
  route.push({ id: totalNodes, type: 'boss', label: 'Jefe Final', done: false })
  return route
}

export const ALL_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark',
  'steel', 'fairy'
]

export function randomFromType(): string {
  return randomFrom(ALL_TYPES)
}

export function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export const RUN_MODIFIERS: RunModifier[] = [
  {
    id: 'none',
    name: 'Aventura Normal',
    description: 'Sin modificadores adicionales. La experiencia clásica.',
  },
  {
    id: 'tempestad',
    name: 'Tempestad Feroz',
    description: 'Los rivales pegan +8 más fuerte, pero ganas +50% dinero.',
    enemyAttackDelta: 8,
    moneyMultiplier: 1.5,
  },
  {
    id: 'mercado',
    name: 'Mercado en Oferta',
    description: 'Las tiendas regalan 1 poción extra y todo cuesta -20%.',
    shopPotionBonus: 1,
    shopDiscount: 0.20,
  },
  {
    id: 'equilibrada',
    name: 'Ruta Equilibrada',
    description: 'Descansos curan +15 HP extra. Ideal para aprender.',
    healBonus: 15,
  },
  {
    id: 'furia',
    name: 'Furia del Rival',
    description: 'Enemigos +10 ATK, pero tu equipo tiene +15% Ataque.',
    enemyAttackDelta: 10,
    playerAttackMod: 0.15,
  },
  {
    id: 'escudo',
    name: 'Escudo Natural',
    description: 'Tu equipo tiene +20% Defensa, pero enemigos +5 ATK.',
    playerDefenseMod: 0.20,
    enemyAttackDelta: 5,
  },
  {
    id: 'velocidad',
    name: 'Velocidad Extrema',
    description: 'Tu equipo +25% Velocidad, pero enemigos +8 Vel.',
    playerSpeedMod: 0.25,
    enemySpeedDelta: 8,
  },
  {
    id: 'codicia',
    name: 'Codicia',
    description: 'Ganas +75% dinero, pero enemigos +12 ATK.',
    moneyMultiplier: 1.75,
    enemyAttackDelta: 12,
  },
  {
    id: 'vampirismo',
    name: 'Vampirismo',
    description: 'Tu equipo tiene 15% Robo de Vida, pero -20 HP máx.',
    playerLifesteal: 0.15,
    playerMaxHpBonus: -20,
  },
  {
    id: 'berserker',
    name: 'Berserker',
    description: '+25% Ataque para tu equipo, pero -15% Defensa.',
    playerAttackMod: 0.25,
    playerDefenseMod: -0.15,
  },
  {
    id: 'fortuna',
    name: 'Fortuna',
    description: '+15% Crítico para ambos bandos. Quien golpee primero.',
    playerCritChance: 0.15,
  },
  {
    id: 'tanque',
    name: 'Tanque',
    description: '+25% Defensa, +10 HP máx, pero -10% Velocidad.',
    playerDefenseMod: 0.25,
    playerMaxHpBonus: 10,
    playerSpeedMod: -0.10,
  },
  {
    id: 'asesino',
    name: 'Asesino',
    description: '+30% Vel, +10% Crítico, pero -20% Defensa.',
    playerSpeedMod: 0.30,
    playerCritChance: 0.10,
    playerDefenseMod: -0.20,
  },
  {
    id: 'tacano',
    name: 'Tacaño',
    description: 'Todo en tienda cuesta -30%, pero descansos curan 50% menos.',
    shopDiscount: 0.30,
    healReduction: 0.50,
  },
  {
    id: 'prodigio',
    name: 'Pródigo',
    description: 'Descansos curan el doble, pero tiendas +40% precios.',
    healBonus: 100,
    shopDiscount: -0.40,
  },
  {
    id: 'hardcore',
    name: 'Modo Hardcore',
    description: 'Enemigos +3 niveles y +10 ATK, pero ganas x2 dinero.',
    enemyLevelDelta: 3,
    enemyAttackDelta: 10,
    moneyMultiplier: 2.0,
  },
  {
    id: 'frail',
    name: 'Huesos Frágiles',
    description: 'Tu equipo +20% ATK y +20% Vel, pero -30 HP máx.',
    playerAttackMod: 0.20,
    playerSpeedMod: 0.20,
    playerMaxHpBonus: -30,
  },
  {
    id: 'regeneracion',
    name: 'Regeneración',
    description: 'Descansos curan +30 HP y tiendas +1 poción, pero enemigos +7 ATK.',
    healBonus: 30,
    shopPotionBonus: 1,
    enemyAttackDelta: 7,
  },
  {
    id: 'critico',
    name: 'Ojo de Halcón',
    description: '+20% Crítico y +10% Velocidad, pero enemigos +10 Defensa.',
    playerCritChance: 0.20,
    playerSpeedMod: 0.10,
    enemyDefenseDelta: 10,
  },
  {
    id: 'desesperacion',
    name: 'Desesperación',
    description: '+40% Ataque cuando estás bajo 50% HP, pero -15% Defensa.',
    playerAttackMod: 0.10,
    playerDefenseMod: -0.15,
  },
]

export function startRun(config: { generation: number }, doubleModifiers = false) {
  const modifier1 = randomFrom(RUN_MODIFIERS)
  const modifier2 = doubleModifiers ? randomFrom(RUN_MODIFIERS.filter(m => m.id !== modifier1.id && m.id !== 'none')) : null
  return {
    config,
    route: generateRoute(),
    item: 'Potion',
    modifier: modifier1,
    modifier2: modifier2 ?? undefined
  }
}

export const SHOP_CATALOG: ShopItem[] = [
  { id: 'potion', name: 'Potion', price: 50, description: 'Restaura 25 HP a tu Pokémon activo.', type: 'heal', value: 25 },
  { id: 'super_potion', name: 'Super Potion', price: 100, description: 'Restaura 50 HP a tu Pokémon activo.', type: 'heal', value: 50 },
  { id: 'x_attack', name: 'X Attack', price: 80, description: 'Aumenta permanentemente +5 el Ataque.', type: 'buff', value: 5 },
  { id: 'x_defense', name: 'X Defense', price: 80, description: 'Aumenta permanentemente +5 la Defensa.', type: 'buff', value: 5 },
  { id: 'rare_candy', name: 'Rare Candy', price: 200, description: 'Sube 1 Nivel a tu Pokémon activo.', type: 'level', value: 1 },
  { id: 'revive', name: 'Revive', price: 150, description: 'Revive a un Pokémon debilitado con 50% HP.', type: 'revive', value: 0.5 },
  { id: 'max_revive', name: 'Max Revive', price: 300, description: 'Revive a un Pokémon debilitado con HP completo.', type: 'revive', value: 1 }
]

export function generateShopStock(): ShopItem[] {
  // Mezclamos y elegimos 4 objetos al azar para la tienda
  const shuffled = [...SHOP_CATALOG].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, 4)
}

