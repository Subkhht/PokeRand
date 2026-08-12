import type { PokemonIVs, Pokemon } from './types'

// ---------------------------------------------------------------------------
// Naturalezas: cada Pokémon nace con una que modifica +10%/-10% dos stats
// (nunca HP). Solo se muestra en el panel de detalles.
// ---------------------------------------------------------------------------

export type MetaStatKey = 'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed'

interface NatureDef {
  id: string
  es: string
  en: string
  up?: MetaStatKey
  down?: MetaStatKey
}

const NATURES: NatureDef[] = [
  { id: 'hardy', es: 'Fuerte', en: 'Hardy' },
  { id: 'lonely', es: 'Huraña', en: 'Lonely', up: 'attack', down: 'defense' },
  { id: 'brave', es: 'Audaz', en: 'Brave', up: 'attack', down: 'speed' },
  { id: 'adamant', es: 'Firme', en: 'Adamant', up: 'attack', down: 'spAttack' },
  { id: 'naughty', es: 'Traviesa', en: 'Naughty', up: 'attack', down: 'spDefense' },
  { id: 'bold', es: 'Osada', en: 'Bold', up: 'defense', down: 'attack' },
  { id: 'docile', es: 'Dócil', en: 'Docile' },
  { id: 'relaxed', es: 'Plácida', en: 'Relaxed', up: 'defense', down: 'speed' },
  { id: 'impish', es: 'Alegre', en: 'Impish', up: 'defense', down: 'spAttack' },
  { id: 'lax', es: 'Floja', en: 'Lax', up: 'defense', down: 'spDefense' },
  { id: 'timid', es: 'Miedosa', en: 'Timid', up: 'speed', down: 'attack' },
  { id: 'hasty', es: 'Activa', en: 'Hasty', up: 'speed', down: 'defense' },
  { id: 'serious', es: 'Seria', en: 'Serious' },
  { id: 'jolly', es: 'Risueña', en: 'Jolly', up: 'speed', down: 'spAttack' },
  { id: 'naive', es: 'Ingenua', en: 'Naive', up: 'speed', down: 'spDefense' },
  { id: 'modest', es: 'Modesta', en: 'Modest', up: 'spAttack', down: 'attack' },
  { id: 'mild', es: 'Afable', en: 'Mild', up: 'spAttack', down: 'defense' },
  { id: 'quiet', es: 'Serena', en: 'Quiet', up: 'spAttack', down: 'speed' },
  { id: 'bashful', es: 'Tímida', en: 'Bashful' },
  { id: 'rash', es: 'Alocada', en: 'Rash', up: 'spAttack', down: 'spDefense' },
  { id: 'calm', es: 'Mansa', en: 'Calm', up: 'spDefense', down: 'attack' },
  { id: 'gentle', es: 'Amable', en: 'Gentle', up: 'spDefense', down: 'defense' },
  { id: 'sassy', es: 'Grosera', en: 'Sassy', up: 'spDefense', down: 'speed' },
  { id: 'careful', es: 'Cauta', en: 'Careful', up: 'spDefense', down: 'spAttack' },
  { id: 'quirky', es: 'Rara', en: 'Quirky' },
]

const NATURE_BY_ID = new Map(NATURES.map(n => [n.id, n]))

export function randomNature(): string {
  return NATURES[Math.floor(Math.random() * NATURES.length)].id
}

export function natureName(id: string | undefined, lang: 'es' | 'en'): string {
  if (!id) return '—'
  return (NATURE_BY_ID.get(id) as NatureDef | undefined)?.[lang] ?? id
}

// Devuelve qué stats sube y baja una naturaleza.
export function natureStatMods(id: string | undefined): { up?: MetaStatKey; down?: MetaStatKey } {
  if (!id) return {}
  const def = NATURE_BY_ID.get(id) as NatureDef | undefined
  if (!def) return {}
  return { up: def.up, down: def.down }
}

// Devuelve el multiplicador de una naturaleza para una stat dada.
export function natureMultiplier(id: string | undefined, stat: MetaStatKey): number {
  if (!id) return 1
  const def = NATURE_BY_ID.get(id) as NatureDef | undefined
  if (!def) return 1
  if (def.up === stat) return 1.1
  if (def.down === stat) return 0.9
  return 1
}

// ---------------------------------------------------------------------------
// IVs (Individual Values): 0-31 por stat, se generan al crear el Pokémon.
// ---------------------------------------------------------------------------

export function generateIVs(): PokemonIVs {
  const r = () => Math.floor(Math.random() * 32)
  return { hp: r(), attack: r(), defense: r(), spAttack: r(), spDefense: r(), speed: r() }
}

export function ivStatBonus(iv: number, level: number): number {
  return Math.round(iv * level / 100)
}

// ---------------------------------------------------------------------------
// Habilidades: catálogo bilingüe. `IMPLEMENTED_ABILITIES` marca las que tienen
// efecto en combate; el resto se muestra con una descripción genérica.
// ---------------------------------------------------------------------------

interface AbilityInfo {
  es: string
  en: string
  desc: { es: string; en: string }
}

const GEN_DESC: { es: string; en: string } = {
  es: 'Esta habilidad aún no tiene efecto en combate.',
  en: 'This ability has no battle effect yet.',
}

export const ABILITY_INFO: Record<string, AbilityInfo> = {
  'intimidate': { es: 'Intimidación', en: 'Intimidate', desc: { es: 'Al entrar al combate baja el Ataque del rival.', en: 'On switch-in, lowers the opponent\'s Attack.' } },
  'levitate': { es: 'Levitación', en: 'Levitate', desc: { es: 'Inmune a movimientos de tipo Tierra.', en: 'Immune to Ground-type moves.' } },
  'rough-skin': { es: 'Piel Áspera', en: 'Rough Skin', desc: { es: 'Daña al contacto (1/8 del HP máximo).', en: 'Damages on contact (1/8 of max HP).' } },
  'static': { es: 'Electricidad Estática', en: 'Static', desc: { es: '30% de paralizar al contacto.', en: '30% chance to paralyze on contact.' } },
  'flame-body': { es: 'Cuerpo Llama', en: 'Flame Body', desc: { es: '30% de quemar al contacto.', en: '30% chance to burn on contact.' } },
  'poison-point': { es: 'Punto Tóxico', en: 'Poison Point', desc: { es: '30% de envenenar al contacto.', en: '30% chance to poison on contact.' } },
  'blaze': { es: 'Mar Llamas', en: 'Blaze', desc: { es: '+50% de daño en movimientos de Fuego con HP ≤1/3.', en: '+50% Fire move damage at ≤1/3 HP.' } },
  'overgrow': { es: 'Espesura', en: 'Overgrow', desc: { es: '+50% de daño en movimientos de Planta con HP ≤1/3.', en: '+50% Grass move damage at ≤1/3 HP.' } },
  'torrent': { es: 'Torrente', en: 'Torrent', desc: { es: '+50% de daño en movimientos de Agua con HP ≤1/3.', en: '+50% Water move damage at ≤1/3 HP.' } },
  'swarm': { es: 'Enjambre', en: 'Swarm', desc: { es: '+50% de daño en movimientos de Bicho con HP ≤1/3.', en: '+50% Bug move damage at ≤1/3 HP.' } },
  'thick-fat': { es: 'Sebo', en: 'Thick Fat', desc: { es: 'Reduce a la mitad el daño de Fuego y Hielo.', en: 'Halves Fire and Ice damage.' } },
  'sturdy': { es: 'Robustez', en: 'Sturdy', desc: { es: 'A plena vida aguanta un golpe letal con 1 HP.', en: 'Survives a lethal hit with 1 HP at full health.' } },
  'guts': { es: 'Agallas', en: 'Guts', desc: { es: '+50% Ataque cuando tiene un estado alterado.', en: '+50% Attack while statused.' } },
  'water-absorb': { es: 'Absorbe Agua', en: 'Water Absorb', desc: { es: 'Inmune al Agua y cura 1/4 del HP máximo.', en: 'Immune to Water, heals 1/4 of max HP.' } },
  'volt-absorb': { es: 'Absorbe Electricidad', en: 'Volt Absorb', desc: { es: 'Inmune al Eléctrico y cura 1/4 del HP máximo.', en: 'Immune to Electric, heals 1/4 of max HP.' } },
  'flash-fire': { es: 'Ignífugo', en: 'Flash Fire', desc: { es: 'Inmune al Fuego; al recibirlo, potencia sus movimientos de Fuego.', en: 'Immune to Fire; powers up Fire moves after being hit.' } },
  'multiscale': { es: 'Escama Multiescama', en: 'Multiscale', desc: { es: 'Reduce a la mitad el daño a plena vida.', en: 'Halves damage at full HP.' } },
  'huge-power': { es: 'Potencia Bruta', en: 'Huge Power', desc: { es: 'Duplica el Ataque.', en: 'Doubles Attack.' } },
  'pure-power': { es: 'Poder Puro', en: 'Pure Power', desc: { es: 'Duplica el Ataque.', en: 'Doubles Attack.' } },
  'speed-boost': { es: 'Impulso', en: 'Speed Boost', desc: { es: 'Sube +1 Velocidad al final de cada turno.', en: 'Raises Speed by 1 each turn.' } },
  'adaptability': { es: 'Adaptable', en: 'Adaptability', desc: { es: 'STAB ×2 en lugar de ×1.5.', en: 'STAB becomes ×2 instead of ×1.5.' } },
  'technician': { es: 'Técnico', en: 'Technician', desc: { es: '+50% de daño en movimientos de potencia ≤60.', en: '+50% damage for moves with power ≤60.' } },
  'compound-eyes': { es: 'Ojo Compuesto', en: 'Compound Eyes', desc: { es: '+30% de precisión en sus movimientos.', en: '+30% accuracy for its moves.' } },
  'sniper': { es: 'Francotirador', en: 'Sniper', desc: { es: 'Los críticos hacen ×2 de daño.', en: 'Critical hits deal ×2 damage.' } },
  'tinted-lens': { es: 'Cristal Lente', en: 'Tinted Lens', desc: { es: 'Los movimientos poco efectivos hacen ×2.', en: 'Not-very-effective moves deal ×2 damage.' } },
  'clear-body': { es: 'Cuerpo Claro', en: 'Clear Body', desc: { es: 'Inmune a la bajada de stats.', en: 'Immune to stat drops.' } },
  'hyper-cutter': { es: 'Cortador', en: 'Hyper Cutter', desc: { es: 'Inmune a la bajada de Ataque.', en: 'Immune to Attack drops.' } },
  'white-smoke': { es: 'Humo Blanco', en: 'White Smoke', desc: { es: 'Inmune a la bajada de stats.', en: 'Immune to stat drops.' } },
  'natural-cure': { es: 'Cura Natural', en: 'Natural Cure', desc: { es: 'Cura su estado alterado al cambiar.', en: 'Cures its status on switch-out.' } },
  'regenerator': { es: 'Regeneración', en: 'Regenerator', desc: { es: 'Recupera 1/3 del HP al cambiar.', en: 'Heals 1/3 of HP on switch-out.' } },
  'immunity': { es: 'Inmunidad', en: 'Immunity', desc: { es: 'Inmune al envenenamiento.', en: 'Immune to poison.' } },
  'water-veil': { es: 'Velo Agua', en: 'Water Veil', desc: { es: 'Inmune a las quemaduras.', en: 'Immune to burn.' } },
  'magma-armor': { es: 'Armadura Magma', en: 'Magma Armor', desc: { es: 'Inmune a la congelación.', en: 'Immune to freeze.' } },
  'limber': { es: 'Flexibilidad', en: 'Limber', desc: { es: 'Inmune a la parálisis.', en: 'Immune to paralysis.' } },
  'insomnia': { es: 'Insomnio', en: 'Insomnia', desc: { es: 'Inmune al sueño.', en: 'Immune to sleep.' } },
  'vital-spirit': { es: 'Espíritu Vital', en: 'Vital Spirit', desc: { es: 'Inmune al sueño.', en: 'Immune to sleep.' } },
  'own-tempo': { es: 'Ritmo Propio', en: 'Own Tempo', desc: { es: 'Inmune a la confusión.', en: 'Immune to confusion.' } },
  'no-guard': { es: 'Indefenso', en: 'No Guard', desc: { es: 'Todos sus movimientos aciertan siempre.', en: 'Its moves never miss.' } },
  'rock-head': { es: 'Cabeza Roca', en: 'Rock Head', desc: { es: 'No recibe daño de retroceso.', en: 'No recoil damage.' } },
  'drizzle': { es: 'Llovizna', en: 'Drizzle', desc: { es: 'Crea lluvia al entrar al combate.', en: 'Starts rain on switch-in.' } },
  'drought': { es: 'Sequía', en: 'Drought', desc: { es: 'Crea sol abrasador al entrar al combate.', en: 'Starts harsh sunlight on switch-in.' } },
  'sand-stream': { es: 'Chorro de Arena', en: 'Sand Stream', desc: { es: 'Crea tormenta de arena al entrar al combate.', en: 'Starts a sandstorm on switch-in.' } },
  'snow-warning': { es: 'Nevada', en: 'Snow Warning', desc: { es: 'Crea granizo al entrar al combate.', en: 'Starts hail on switch-in.' } },
  'swift-swim': { es: 'Nado Rápido', en: 'Swift Swim', desc: { es: 'Duplica la Velocidad bajo la lluvia.', en: 'Doubles Speed in rain.' } },
  'chlorophyll': { es: 'Clorofila', en: 'Chlorophyll', desc: { es: 'Duplica la Velocidad bajo el sol.', en: 'Doubles Speed in sunlight.' } },
  'sand-rush': { es: 'Ímpetu Arena', en: 'Sand Rush', desc: { es: 'Duplica la Velocidad en tormenta de arena.', en: 'Doubles Speed in sandstorm.' } },
  'slush-rush': { es: 'Ímpetu Nevado', en: 'Slush Rush', desc: { es: 'Duplica la Velocidad bajo el granizo.', en: 'Doubles Speed in hail.' } },
  'tough-claws': { es: 'Garra Dura', en: 'Tough Claws', desc: { es: '+30% de daño en movimientos de contacto.', en: '+30% damage on contact moves.' } },
  'marvel-scale': { es: 'Escama Especial', en: 'Marvel Scale', desc: { es: '+50% Defensa cuando tiene un estado alterado.', en: '+50% Defense while statused.' } },
  'quick-feet': { es: 'Pies Rápidos', en: 'Quick Feet', desc: { es: '+50% Velocidad cuando tiene un estado alterado.', en: '+50% Speed while statused.' } },
  'rain-dish': { es: 'Cura Lluvia', en: 'Rain Dish', desc: { es: 'Recupera 1/16 del HP máximo bajo la lluvia.', en: 'Heals 1/16 of max HP in rain.' } },
  'dry-skin': { es: 'Piel Seca', en: 'Dry Skin', desc: { es: 'Cura 1/4 con el Agua; el Fuego le hace ×1.25.', en: 'Heals 1/4 from Water; takes ×1.25 Fire damage.' } },
  'shed-skin': { es: 'Mudar', en: 'Shed Skin', desc: { es: '1/3 de curar su estado alterado cada turno.', en: '1/3 chance to cure its status each turn.' } },
  'solar-power': { es: 'Poder Solar', en: 'Solar Power', desc: { es: '×1.5 At. Esp. bajo el sol, pero pierde HP cada turno.', en: '×1.5 Sp. Atk in sun, but loses HP each turn.' } },
  'hydration': { es: 'Hidratación', en: 'Hydration', desc: { es: 'Cura su estado alterado bajo la lluvia.', en: 'Cures its status in rain.' } },
  'sap-sipper': { es: 'Absorbe Savia', en: 'Sap Sipper', desc: { es: 'Inmune al Planta y sube su Ataque.', en: 'Immune to Grass, raises Attack.' } },
  'lightning-rod': { es: 'Pararrayos', en: 'Lightning Rod', desc: { es: 'Inmune al Eléctrico y sube su At. Esp.', en: 'Immune to Electric, raises Sp. Atk.' } },
  'motor-drive': { es: 'Motorizar', en: 'Motor Drive', desc: { es: 'Inmune al Eléctrico y sube su Velocidad.', en: 'Immune to Electric, raises Speed.' } },
}

export function abilityName(id: string | undefined, lang: 'es' | 'en'): string {
  if (!id) return '—'
  return ABILITY_INFO[id]?.[lang] ?? id
}

export function abilityDesc(id: string | undefined, lang: 'es' | 'en'): string {
  if (!id) return ''
  return ABILITY_INFO[id]?.desc?.[lang] ?? GEN_DESC[lang]
}

export function hasAbility(pokemon: Pokemon | undefined, ability: string): boolean {
  return !!pokemon && pokemon.ability === ability
}

// Habilidades que no bloquean los movimientos de tipo Tierra del rival.
export const ABILITY_GROUND_IMMUNE = new Set(['levitate'])

// Conjunto de habilidades implementadas (el resto no produce efectos).
export const IMPLEMENTED_ABILITIES = new Set(Object.keys(ABILITY_INFO))

// ---------------------------------------------------------------------------
// Clima: lluvia, sol, tormenta de arena y granizo.
// ---------------------------------------------------------------------------

export type WeatherKind = 'none' | 'rain' | 'sun' | 'sand' | 'hail'

export const WEATHER_INFO: Record<Exclude<WeatherKind, 'none'>, { es: string; en: string; icon: string }> = {
  rain: { es: 'Lluvia', en: 'Rain', icon: '🌧️' },
  sun: { es: 'Sol Abrasador', en: 'Harsh Sunlight', icon: '☀️' },
  sand: { es: 'Tormenta de Arena', en: 'Sandstorm', icon: '🌪️' },
  hail: { es: 'Granizo', en: 'Hail', icon: '❄️' },
}

export function weatherName(weather: WeatherKind, lang: 'es' | 'en'): string {
  if (weather === 'none') return lang === 'es' ? 'Sin clima' : 'No weather'
  return WEATHER_INFO[weather][lang]
}

// Multiplicador de daño por tipo según el clima (se aplica como un STAB más).
export function weatherTypeMultiplier(weather: WeatherKind, moveType: string): number {
  if (weather === 'rain') {
    if (moveType === 'water') return 1.5
    if (moveType === 'fire') return 0.5
  }
  if (weather === 'sun') {
    if (moveType === 'fire') return 1.5
    if (moveType === 'water') return 0.5
  }
  return 1
}

// Velocidad ×2 por habilidad bajo su clima correspondiente.
export function weatherSpeedMultiplier(pokemon: Pokemon, weather: WeatherKind): number {
  if (weather === 'rain' && pokemon.ability === 'swift-swim') return 2
  if (weather === 'sun' && pokemon.ability === 'chlorophyll') return 2
  if (weather === 'sand' && pokemon.ability === 'sand-rush') return 2
  if (weather === 'hail' && pokemon.ability === 'slush-rush') return 2
  return 1
}

// Daño por turno del clima: arena y granizo dañan a los no inmunes.
export function weatherChipDmg(pokemon: Pokemon, weather: WeatherKind): number {
  const types = pokemon.types ?? []
  if (weather === 'sand') {
    if (types.includes('ground') || types.includes('rock') || types.includes('steel')) return 0
    return Math.max(1, Math.floor(pokemon.maxHp / 16))
  }
  if (weather === 'hail') {
    if (types.includes('ice')) return 0
    return Math.max(1, Math.floor(pokemon.maxHp / 16))
  }
  return 0
}

// Habilidades que crean clima al entrar.
export const WEATHER_SETTERS: Record<string, Exclude<WeatherKind, 'none'>> = {
  drizzle: 'rain',
  drought: 'sun',
  'sand-stream': 'sand',
  'snow-warning': 'hail',
}

export function isWeatherSpeedAbility(ability: string | undefined): boolean {
  return ability === 'swift-swim' || ability === 'chlorophyll' || ability === 'sand-rush' || ability === 'slush-rush'
}
