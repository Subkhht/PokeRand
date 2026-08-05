export interface DexEntry {
  id: number
  name: string
  types: string[]
}

export const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'

export const spriteUrl = (id: number): string => `${SPRITE_BASE}/${id}.png`

export const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030',
  grass: '#78c850', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0',
  ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848',
  steel: '#b8b8d0', fairy: '#ee99ac',
}

export const TYPE_NAMES: Record<string, string> = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico',
  grass: 'Planta', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno',
  ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro',
  steel: 'Acero', fairy: 'Hada',
}

export const ALL_TYPES = Object.keys(TYPE_NAMES)

export const POKEDEX: DexEntry[] = [
  { id: 1, name: 'Bulbasaur', types: ['grass', 'poison'] },
  { id: 2, name: 'Ivysaur', types: ['grass', 'poison'] },
  { id: 3, name: 'Venusaur', types: ['grass', 'poison'] },
  { id: 4, name: 'Charmander', types: ['fire'] },
  { id: 5, name: 'Charmeleon', types: ['fire'] },
  { id: 6, name: 'Charizard', types: ['fire', 'flying'] },
  { id: 7, name: 'Squirtle', types: ['water'] },
  { id: 8, name: 'Wartortle', types: ['water'] },
  { id: 9, name: 'Blastoise', types: ['water'] },
  { id: 10, name: 'Caterpie', types: ['bug'] },
  { id: 12, name: 'Butterfree', types: ['bug', 'flying'] },
  { id: 16, name: 'Pidgey', types: ['normal', 'flying'] },
  { id: 25, name: 'Pikachu', types: ['electric'] },
  { id: 26, name: 'Raichu', types: ['electric'] },
  { id: 35, name: 'Clefairy', types: ['fairy'] },
  { id: 37, name: 'Vulpix', types: ['fire'] },
  { id: 39, name: 'Jigglypuff', types: ['normal', 'fairy'] },
  { id: 41, name: 'Zubat', types: ['poison', 'flying'] },
  { id: 43, name: 'Oddish', types: ['grass', 'poison'] },
  { id: 52, name: 'Meowth', types: ['normal'] },
  { id: 54, name: 'Psyduck', types: ['water'] },
  { id: 58, name: 'Growlithe', types: ['fire'] },
  { id: 60, name: 'Poliwag', types: ['water'] },
  { id: 63, name: 'Abra', types: ['psychic'] },
  { id: 66, name: 'Machop', types: ['fighting'] },
  { id: 69, name: 'Bellsprout', types: ['grass', 'poison'] },
  { id: 72, name: 'Tentacool', types: ['water', 'poison'] },
  { id: 74, name: 'Geodude', types: ['rock', 'ground'] },
  { id: 77, name: 'Ponyta', types: ['fire'] },
  { id: 79, name: 'Slowpoke', types: ['water', 'psychic'] },
  { id: 81, name: 'Magnemite', types: ['electric', 'steel'] },
  { id: 84, name: 'Doduo', types: ['normal', 'flying'] },
  { id: 88, name: 'Grimer', types: ['poison'] },
  { id: 90, name: 'Shellder', types: ['water'] },
  { id: 92, name: 'Gastly', types: ['ghost', 'poison'] },
  { id: 95, name: 'Onix', types: ['rock', 'ground'] },
  { id: 96, name: 'Drowzee', types: ['psychic'] },
  { id: 98, name: 'Krabby', types: ['water'] },
  { id: 100, name: 'Voltorb', types: ['electric'] },
  { id: 102, name: 'Exeggcute', types: ['grass', 'psychic'] },
  { id: 104, name: 'Cubone', types: ['ground'] },
  { id: 106, name: 'Hitmonlee', types: ['fighting'] },
  { id: 108, name: 'Lickitung', types: ['normal'] },
  { id: 109, name: 'Koffing', types: ['poison'] },
  { id: 111, name: 'Rhyhorn', types: ['ground', 'rock'] },
  { id: 113, name: 'Chansey', types: ['normal'] },
  { id: 116, name: 'Horsea', types: ['water'] },
  { id: 118, name: 'Goldeen', types: ['water'] },
  { id: 120, name: 'Staryu', types: ['water'] },
  { id: 122, name: 'Mr. Mime', types: ['psychic', 'fairy'] },
  { id: 123, name: 'Scyther', types: ['bug', 'flying'] },
  { id: 125, name: 'Electabuzz', types: ['electric'] },
  { id: 126, name: 'Magmar', types: ['fire'] },
  { id: 127, name: 'Pinsir', types: ['bug'] },
  { id: 128, name: 'Tauros', types: ['normal'] },
  { id: 129, name: 'Magikarp', types: ['water'] },
  { id: 130, name: 'Gyarados', types: ['water', 'flying'] },
  { id: 131, name: 'Lapras', types: ['water', 'ice'] },
  { id: 133, name: 'Eevee', types: ['normal'] },
  { id: 134, name: 'Vaporeon', types: ['water'] },
  { id: 135, name: 'Jolteon', types: ['electric'] },
  { id: 136, name: 'Flareon', types: ['fire'] },
  { id: 143, name: 'Snorlax', types: ['normal'] },
  { id: 144, name: 'Articuno', types: ['ice', 'flying'] },
  { id: 145, name: 'Zapdos', types: ['electric', 'flying'] },
  { id: 146, name: 'Moltres', types: ['fire', 'flying'] },
  { id: 147, name: 'Dratini', types: ['dragon'] },
  { id: 149, name: 'Dragonite', types: ['dragon', 'flying'] },
  { id: 150, name: 'Mewtwo', types: ['psychic'] },
  { id: 151, name: 'Mew', types: ['psychic'] },
  { id: 196, name: 'Espeon', types: ['psychic'] },
  { id: 197, name: 'Umbreon', types: ['dark'] },
  { id: 212, name: 'Scizor', types: ['bug', 'steel'] },
  { id: 248, name: 'Tyranitar', types: ['rock', 'dark'] },
  { id: 254, name: 'Sceptile', types: ['grass'] },
  { id: 257, name: 'Blaziken', types: ['fire', 'fighting'] },
  { id: 260, name: 'Swampert', types: ['water', 'ground'] },
  { id: 282, name: 'Gardevoir', types: ['psychic', 'fairy'] },
  { id: 350, name: 'Milotic', types: ['water'] },
  { id: 373, name: 'Salamence', types: ['dragon', 'flying'] },
  { id: 376, name: 'Metagross', types: ['steel', 'psychic'] },
  { id: 445, name: 'Garchomp', types: ['dragon', 'ground'] },
  { id: 448, name: 'Lucario', types: ['fighting', 'steel'] },
]

export const FISH_POOL: DexEntry[] = [
  { id: 129, name: 'Magikarp', types: ['water'] },
  { id: 118, name: 'Goldeen', types: ['water'] },
  { id: 119, name: 'Seaking', types: ['water'] },
  { id: 60, name: 'Poliwag', types: ['water'] },
  { id: 61, name: 'Poliwhirl', types: ['water'] },
  { id: 116, name: 'Horsea', types: ['water'] },
  { id: 90, name: 'Shellder', types: ['water'] },
  { id: 98, name: 'Krabby', types: ['water'] },
  { id: 120, name: 'Staryu', types: ['water'] },
  { id: 72, name: 'Tentacool', types: ['water', 'poison'] },
  { id: 170, name: 'Chinchou', types: ['water', 'electric'] },
  { id: 223, name: 'Remoraid', types: ['water'] },
  { id: 318, name: 'Carvanha', types: ['water', 'dark'] },
  { id: 320, name: 'Wailmer', types: ['water'] },
  { id: 339, name: 'Barboach', types: ['water', 'ground'] },
  { id: 349, name: 'Feebas', types: ['water'] },
  { id: 370, name: 'Luvdisc', types: ['water'] },
  { id: 456, name: 'Finneon', types: ['water'] },
  { id: 194, name: 'Wooper', types: ['water', 'ground'] },
]

export function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function formatDexId(id: number): string {
  return `#${String(id).padStart(3, '0')}`
}
