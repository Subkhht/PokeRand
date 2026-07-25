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

export function scalePokemonForNode(base: Pokemon, node: RouteNode, stepIndex: number): Pokemon {
  // Ajustado: Los enemigos suben de nivel más despacio (antes stepIndex * 2, ahora stepIndex * 1.5)
  const bonusLevel = Math.floor(stepIndex * 1.5) + (node.type === 'boss' ? 2 : 0)
  const targetLevel = base.level + bonusLevel

  const hpBonus = bonusLevel * 4
  const statBonus = bonusLevel * 2

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

export function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function startRun(config: { generation: number }) {
  const modifiers: RunModifier[] = [
    { id: 'none', name: 'Aventura Normal', description: 'Sin modificadores adicionales.' },
    { id: 'rich-shops', name: 'Tiendas Abundantes', description: 'Consigues pociones extra en las tiendas.', shopPotionBonus: 1 }
  ]

  return {
    config,
    route: generateRoute(),
    item: 'Potion',
    modifier: randomFrom(modifiers)
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

