import type { RunModifier } from './types'

export const starterItems = ['Potion', 'Super Potion', 'X Attack', 'Oran Berry']

export const runModifiers: RunModifier[] = [
  {
    name: 'Tempestad feroz',
    description: 'Los rivales pegan mas fuerte, pero los descansos curan extra.',
    enemyAttackDelta: 7,
    healBonus: 10,
    shopPotionBonus: 0
  },
  {
    name: 'Mercado en oferta',
    description: 'Cada tienda regala una pocion adicional.',
    enemyAttackDelta: 0,
    healBonus: 0,
    shopPotionBonus: 1
  },
  {
    name: 'Ruta equilibrada',
    description: 'Sin ventajas ni castigos, ideal para aprender.',
    enemyAttackDelta: 0,
    healBonus: 5,
    shopPotionBonus: 0
  }
]

