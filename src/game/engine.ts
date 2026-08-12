import type { Move, Pokemon, RouteNode, RunModifier, ShopItem } from './types'

export function createSeededRandom(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  }
  let s = h | 0
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export function getDailyConfig(seed: string, unlockedGens: number[]): { generation: number; difficulty: 'easy' | 'medium' | 'hard'; modifierId: string } {
  const rng = createSeededRandom(seed)
  const gen = unlockedGens[Math.floor(rng() * unlockedGens.length)]
  const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard']
  const difficulty = difficulties[Math.floor(rng() * difficulties.length)]
  const modifierIdx = Math.floor(rng() * RUN_MODIFIERS.length)
  return { generation: gen, difficulty, modifierId: RUN_MODIFIERS[modifierIdx].id ?? 'none' }
}

export function applyDamage(
  attacker: Pokemon,
  defender: Pokemon,
  move: Move,
  attackBoost = 0
): { damage: number } {
  const isSpecial = move.damageClass === 'special'
  const effectiveAttack = (isSpecial ? attacker.spAttack : attacker.attack) + attackBoost
  const effectiveDefense = isSpecial ? defender.spDefense : defender.defense
  const baseDamage = Math.floor((move.power * effectiveAttack) / Math.max(1, effectiveDefense))
  const finalDamage = Math.max(3, Math.floor(baseDamage * 0.45) + 2)

  // Red de seguridad: nunca devolver NaN (si alguna stat llegó corrupta, se
  // degrada a un valor mínimo de daño en lugar de romper el combate).
  return { damage: Number.isFinite(finalDamage) ? finalDamage : 3 }
}

export function healPokemon(pokemon: Pokemon, amount: number): Pokemon {
  return {
    ...pokemon,
    hp: Math.min(pokemon.maxHp, pokemon.hp + amount)
  }
}

export function scalePokemonForNode(base: Pokemon, _node: RouteNode, _stepIndex: number, levelDelta = 0, difficulty: string = 'medium'): Pokemon {
  const hpMultiplier = difficulty === 'easy' ? 3 : difficulty === 'infinite' ? 5.2 : difficulty === 'hard' ? 5 : difficulty === 'coliseum' ? 5 : 4
  const statMultiplier = difficulty === 'easy' ? 1.5 : difficulty === 'infinite' ? 2.55 : difficulty === 'hard' ? 2.5 : difficulty === 'coliseum' ? 2.5 : 2

  // El nivel mínimo de aparición ya se aplica en buildPokemonFromApi.
  // Aquí solo limitamos el piso: el nivel final nunca baja del umbral de
  // aparición (evita que un Raichu o Venusaur salga a nivel 14 tras ajustar).
  // Seguir permitiendo bajar el nivel a un rival para igualarlo al promedio
  // del equipo, siempre que no se pase por debajo de ese umbral.
  const targetLevel = Math.max(base.minAppearLevel ?? 1, base.level + levelDelta)
  // Usamos el cambio de nivel REAL (no el delta pedido) para las stats: si el
  // nivel queda limitado por el umbral mínimo de aparición de la evolución,
  // las stats no deben reducirse (ej. un Charizard Nv.36 no baja sus stats por
  // un delta negativo aunque el rival sea de nivel menor).
  const actualLevelDelta = targetLevel - base.level
  const hpBonus = actualLevelDelta * hpMultiplier
  const statBonus = actualLevelDelta * statMultiplier

  return {
    ...base,
    level: targetLevel,
    maxHp: Math.max(20, base.maxHp + hpBonus),
    hp: Math.max(20, base.maxHp + hpBonus),
    attack: Math.max(10, base.attack + statBonus),
    defense: Math.max(10, base.defense + statBonus),
    spAttack: Math.max(10, base.spAttack + statBonus),
    spDefense: Math.max(10, base.spDefense + statBonus),
    speed: Math.max(10, base.speed + statBonus)
  }
}

export function applyNoEvolutionBuff(pokemon: Pokemon): Pokemon {
  return pokemon
}

export function getTeamStatAverages(team: Pokemon[]): { attack: number; defense: number; spAttack: number; spDefense: number; speed: number; maxHp: number } {
  const alive = team.filter(p => p.hp > 0)
  const pool = alive.length > 0 ? alive : team
  if (pool.length === 0) {
    return { attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50, maxHp: 120 }
  }
  const avg = (f: (p: Pokemon) => number) => pool.reduce((acc, p) => acc + f(p), 0) / pool.length
  return {
    attack: avg(p => p.attack),
    defense: avg(p => p.defense),
    spAttack: avg(p => p.spAttack),
    spDefense: avg(p => p.spDefense),
    speed: avg(p => p.speed),
    maxHp: avg(p => p.maxHp),
  }
}

export function balanceWildPokemonToTeam(enemy: Pokemon, team: Pokemon[], difficulty: string): Pokemon {
  const teamAvg = getTeamStatAverages(team)
  const strength = difficulty === 'easy' ? 0.72 : difficulty === 'infinite' ? 1.02 : difficulty === 'hard' ? 1.05 : 0.95
  // El salvaje conserva la mayor parte de sus stats de especie (70%) y solo se
  // ajusta un 30% al equipo. Antes era 50/50 y un Pokémon débil "heredaba" un
  // Ataque/At.Esp. desorbitado de la defensa del equipo (p. ej. una Def. Esp.
  // alta del equipo inflaba el At. Esp. de cualquier salvaje).
  const blend = 0.7

  const attack = Math.max(10, Math.round(enemy.attack * blend + teamAvg.defense * strength * (1 - blend)))
  const defense = Math.max(10, Math.round(enemy.defense * blend + teamAvg.attack * strength * (1 - blend)))
  const spAttack = Math.max(10, Math.round(enemy.spAttack * blend + teamAvg.spDefense * strength * (1 - blend)))
  const spDefense = Math.max(10, Math.round(enemy.spDefense * blend + teamAvg.spAttack * strength * (1 - blend)))
  const speed = Math.max(10, Math.round(enemy.speed * blend + teamAvg.speed * strength * (1 - blend)))
  const maxHp = Math.max(20, Math.round(enemy.maxHp * blend + teamAvg.maxHp * strength * (1 - blend)))

  return {
    ...enemy,
    attack,
    defense,
    spAttack,
    spDefense,
    speed,
    maxHp,
    hp: maxHp,
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
  {
    id: 'weathermania',
    name: 'Weather Mania',
    description: 'Lluvia constante durante toda la partida: Agua +50%, Fuego -50% y Trueno siempre acierta.',
    forcedWeather: 'rain',
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

