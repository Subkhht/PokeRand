// Colores/iconos de tipos, entrenadores y entradas de Pokédex.

export const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030',
  grass: '#78c850', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0',
  ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848',
  steel: '#b8b8d0', fairy: '#ee99ac',
}

// Iconos de tipo del repositorio de sprites de PokeAPI (numerados por el id de
// tipo: 1 normal, 2 lucha, 3 volador, 4 veneno, 5 tierra, 6 roca, 7 bicho,
// 8 fantasma, 9 acero, 10 fuego, 11 agua, 12 planta, 13 eléctrico, 14 psíquico,
// 15 hielo, 16 dragón, 17 siniestro, 18 hada).
export const TYPE_ICON_IDS: Record<string, number> = {
  normal: 1, fighting: 2, flying: 3, poison: 4, ground: 5, rock: 6,
  bug: 7, ghost: 8, steel: 9, fire: 10, water: 11, grass: 12,
  electric: 13, psychic: 14, ice: 15, dragon: 16, dark: 17, fairy: 18,
}

export function typeIconUrl(type: string): string {
  const id = TYPE_ICON_IDS[type]
  if (!id) return ''
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-ix/scarlet-violet/small/${id}.png`
}

// Entrenadores normales (clase + nombre)
export const TRAINER_TYPES: Array<{ label: string; name: string; sprite: string }> = [
  { label: 'Youngster', name: 'Miguel', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/youngster.png' },
  { label: 'Youngster', name: 'Tommy', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/youngster.png' },
  { label: 'Lass', name: 'Laura', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/lass.png' },
  { label: 'Lass', name: 'Ana', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/lass.png' },
  { label: 'Hiker', name: 'Jorge', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/hiker.png' },
  { label: 'Hiker', name: 'Bruno', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/hiker.png' },
  { label: 'Fisherman', name: 'Carlos', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/fisherman.png' },
  { label: 'Fisherman', name: 'Pedro', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/fisherman.png' },
  { label: 'Camper', name: 'Ricky', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/camper.png' },
  { label: 'Biker', name: 'Gus', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/biker.png' },
  { label: 'Beauty', name: 'Valeria', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/beauty.png' },
  { label: 'Gentleman', name: 'Arthur', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/gentleman.png' },
  { label: 'Sailor', name: 'Ramiro', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/sailor.png' },
  { label: 'Bug Catcher', name: 'Diego', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/bugcatcher.png' },
  { label: 'Picnicker', name: 'Mia', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/picnicker.png' },
  { label: 'Ace Trainer', name: 'Sergio', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/acetrainer.png' },
  { label: 'Ace Trainer', name: 'Elena', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/acetrainerf.png' },
  { label: 'Black Belt', name: 'Kenji', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blackbelt.png' },
  { label: 'Psychic', name: 'Marco', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/psychic.png' },
  { label: 'Swimmer', name: 'Max', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/swimmer.png' },
]

// Líderes de Gimnasio (solo aparecen en el Jefe Final)
export const GYM_LEADERS: Array<{ name: string; badge: string; sprite: string }> = [
  { name: 'Brock', badge: 'Médalla Roca', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/brock.png' },
  { name: 'Misty', badge: 'Médalla Cascada', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/misty.png' },
  { name: 'Surge', badge: 'Médalla Trueno', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/ltsurge.png' },
  { name: 'Erika', badge: 'Médalla Arco Iris', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/erika.png' },
  { name: 'Sabrina', badge: 'Médalla Pantano', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/sabrina.png' },
  { name: 'Blaine', badge: 'Médalla Volcán', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blaine.png' },
  { name: 'Giovanni', badge: 'Médalla Tierra', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/giovanni.png' },
  { name: 'Falkner', badge: 'Médalla Ala', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/falkner.png' },
  { name: 'Bugsy', badge: 'Médalla Colmíllo', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/bugsy.png' },
  { name: 'Whitney', badge: 'Médalla Lisa', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/whitney.png' },
  { name: 'Morty', badge: 'Médalla Niebla', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/morty.png' },
  { name: 'Chuck', badge: 'Médalla Tormenta', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/chuck.png' },
  { name: 'Jasmine', badge: 'Médalla Mineral', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/jasmine.png' },
  { name: 'Pryce', badge: 'Médalla Glaciar', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/pryce.png' },
  { name: 'Clair', badge: 'Médalla Ascenso', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/clair.png' },
  { name: 'Roxanne', badge: 'Médalla Roca', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/roxanne.png' },
  { name: 'Brawly', badge: 'Médalla Puño', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/brawly.png' },
  { name: 'Wattson', badge: 'Médalla Dinámo', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/wattson.png' },
  { name: 'Flannery', badge: 'Médalla Calor', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/flannery.png' },
  { name: 'Norman', badge: 'Médalla Balance', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/norman.png' },
  { name: 'Winona', badge: 'Médalla Pluma', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/winona.png' },
  { name: 'Tate', badge: 'Médalla Mente', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/tate.png' },
  { name: 'Juan', badge: 'Médalla Lluvia', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/juan.png' },
  { name: 'Roark', badge: 'Médalla Carbona', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/roark.png' },
  { name: 'Gardenia', badge: 'Médalla Bosque', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/gardenia.png' },
  { name: 'Maylene', badge: 'Médalla Cobra', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/maylene.png' },
  { name: 'Fantina', badge: 'Médalla Relevo', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/fantina.png' },
  { name: 'Byron', badge: 'Médalla Mina', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/byron.png' },
  { name: 'Candice', badge: 'Médalla Escarcha', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/candice.png' },
  { name: 'Volkner', badge: 'Médalla Faro', sprite: 'https://play.pokemonshowdown.com/sprites/trainers/volkner.png' },
]

export interface PokedexEntry {
  id: number
  name: string
  sprite: string
  types: string[]
  seen: boolean
  caught: boolean
  shinySeen?: boolean
  shinyCaught?: boolean
  // Sprite shiny independiente para no sobrescribir el sprite normal.
  shinySprite?: string
}

