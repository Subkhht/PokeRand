import { useMemo, useState, useEffect, useRef, Component, type ReactNode, type CSSProperties } from 'react'
import './App.css'
import { applyDamage, applyNoEvolutionBuff, healPokemon, randomFrom, scalePokemonForNode, balanceWildPokemonToTeam, startRun, generateBossRushRoute, ALL_TYPES, createSeededRandom, getDailyConfig, RUN_MODIFIERS } from './game/engine'
import { playHover, playClick, playHit, playEvolution, startMenuMusic, startBattleMusic, playVictoryFanfare, playDefeatMusic, setVolume, getVolume, setSfxVolume, getSfxVolume, setMenuMusicTrack, setBattleMusicTrack, stopMusic, isMusicMuted, setMusicMuted } from './game/sound'
import {
  getBalancedPokemonByGeneration,
  getRandomStarterByGeneration,
  getRandomPokemonByGeneration,
  evolvePokemon,
  fetchPokemonDetails,
  checkAndLearnNewMove,
  getMoveDetails,
  getSpeciesIdsByGeneration,
  buildPokemonFromApi,
  makeShinySprite,
  canEvolveWithStone,
  stripRegional,
  setRunSeed,
  type PokemonDetails
} from './game/pokeapi'
import { getTypeEffectiveness } from './game/typesChart'
import { isLeaderboardEnabled, submitInfiniteScore, fetchInfiniteLeaderboard, formatDuration, getCurrentUser, onAuthChange, signUpWithUsername, signIn, signOut, getUsername, isUsernameTaken, type LeaderboardEntry, type InfiniteScoreInsert } from './game/leaderboard'
import { isCoopEnabled, createCoopSession, joinCoopSession, getCoopSession, markNodeReady, getCoopProgress, submitExchangeOffer, getCoopExchange, completeCoopExchange, cancelExchangeOffer, finishCoopSession, resetCoopSession, cancelCoopSession as deleteCoopSessionRpc, type CoopTrade, type CoopExchange } from './game/coop'
import type { User } from '@supabase/supabase-js'
import type { Move, Pokemon, RouteNode, RunConfig, RunModifier, DefeatSummary, RunChallenges, RunStats, Achievement, AchievementState, MetaProgression, StatusType } from './game/types'

type Screen = 'setup' | 'route' | 'battle' | 'shop' | 'spin' | 'pokeRand' | 'move' | 'mega' | 'gmax' | 'trade' | 'victory' | 'defeat' | 'coliseum_select'
type Difficulty = 'easy' | 'medium' | 'hard' | 'infinite' | 'coliseum'

const STATUS_LABELS: Record<StatusType, string> = {
  burn: '🔥 Quemado',
  poison: '☠️ Envenenado',
  paralysis: '⚡ Paralizado',
  freeze: '🧊 Congelado',
  sleep: '💤 Dormido',
  confusion: '💫 Confundido',
  flinch: '❕ Aturdido',
}

const STATUS_COLORS: Record<StatusType, string> = {
  burn: '#ff8a33',
  poison: '#a855f7',
  paralysis: '#eab308',
  freeze: '#4d9bff',
  sleep: '#9b98cf',
  confusion: '#ec4899',
  flinch: '#ffcb05',
}

function StatusBadge({ status, compact = false }: { status?: Pokemon['status']; compact?: boolean }) {
  if (!status) return null
  const label = STATUS_LABELS[status.type]
  const color = STATUS_COLORS[status.type]
  return (
    <span
      title={label}
      style={{
        fontSize: compact ? '0.65rem' : '0.75rem',
        color,
        fontWeight: 'bold',
        marginLeft: '4px',
        whiteSpace: 'nowrap',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}
    >
      {compact ? label.split(' ')[0] : label}
    </span>
  )
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={() => { playClick(); void copy() }}
      title={copied ? '¡Copiado!' : 'Copiar código'}
      style={{
        background: copied ? 'rgba(55,209,107,0.2)' : 'rgba(255,255,255,0.08)',
        border: copied ? '1px solid rgba(55,209,107,0.5)' : '1px solid rgba(255,255,255,0.2)',
        borderRadius: '6px',
        padding: '6px 8px',
        cursor: 'pointer',
        color: copied ? '#37d16b' : '#f3f1ff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
      }}
    >
      {copied ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

const difficultyNodeCounts: Record<Difficulty, number> = {
  easy: 5,
  medium: 10,
  hard: 25,
  infinite: 0,
  coliseum: 8
}

const authInputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid #3f3f6e',
  background: 'rgba(15,23,42,0.8)',
  color: '#f3f1ff',
  fontSize: '0.9rem',
}

const difficultyLabels: Record<Difficulty, { title: string; desc: string }> = {
  easy: { title: 'Fácil', desc: '3 insignias · 5 rutas por etapa' },
  medium: { title: 'Intermedia', desc: '3 insignias · 10 rutas por etapa' },
  hard: { title: 'Difícil', desc: '3 insignias · 25 rutas por etapa' },
  infinite: { title: 'Infinite', desc: 'Sin límite (Aventura infinita)' },
  coliseum: { title: 'COLISEUM', desc: '8 jefes a nivel 50' },
}

const generations = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const generationRegions: Record<number, string> = {
  0: 'Todas',
  1: 'Kanto',
  2: 'Johto',
  3: 'Hoenn',
  4: 'Sinnoh',
  5: 'Unova',
  6: 'Kalos',
  7: 'Alola',
  8: 'Galar',
  9: 'Paldea'
}

const maxTeamSize = 6

// Catálogo base de la Tienda
const ALL_SHOP_ITEMS: Record<string, { price: number; desc: string }> = {
  'Potion': { price: 50, desc: 'Restaura 25 HP de un Pokémon.' },
  'Super Potion': { price: 100, desc: 'Restaura 50 HP de un Pokémon.' },
  'Hyper Potion': { price: 160, desc: 'Restaura 120 HP de un Pokémon.' },
  'Full Restore': { price: 300, desc: 'Restaura todo el HP y cura estados.' },
  'Oran Berry': { price: 30, desc: 'Restaura 15 HP de un Pokémon.' },
  'Lum Berry': { price: 60, desc: 'Restaura 30 HP y cura estados.' },
  'X Attack': { price: 75, desc: 'Aumenta permanentemente en +5 el ataque.' },
  'X Defense': { price: 75, desc: 'Aumenta permanentemente en +5 la defensa.' },
  'X Speed': { price: 75, desc: 'Aumenta permanentemente en +5 la velocidad.' },
  'Full Heal': { price: 80, desc: 'Restaura 40 HP y cura estados.' },
  'Revive': { price: 150, desc: 'Revive a un Pokémon debilitado con el 50% de su HP.' },
  'Max Revive': { price: 300, desc: 'Revive a un Pokémon debilitado con el HP completo.' },
  'Elixir': { price: 120, desc: 'Restaura 80 HP de un Pokémon.' },
  'Super Elixir': { price: 250, desc: 'Restaura 200 HP de un Pokémon.' },
  'Full Elixir': { price: 400, desc: 'Restaura todo el HP y cura todos los estados.' },
  'X Attack 2': { price: 150, desc: 'Aumenta permanentemente en +10 el ataque.' },
  'X Defense 2': { price: 150, desc: 'Aumenta permanentemente en +10 la defensa.' },
  'X Speed 2': { price: 150, desc: 'Aumenta permanentemente en +10 la velocidad.' },
  'Cuerda Huida': { price: 200, desc: 'Permite escapar de cualquier combate de la aventura.' },
  'Moomoo Milk': { price: 120, desc: 'Restaura 100 HP de un Pokémon.' },
  'Berry Juice': { price: 40, desc: 'Restaura 20 HP de un Pokémon.' },
  'Fresh Water': { price: 60, desc: 'Restaura 30 HP de un Pokémon.' },
  'Soda Pop': { price: 80, desc: 'Restaura 40 HP de un Pokémon.' },
  'Lemonade': { price: 100, desc: 'Restaura 60 HP de un Pokémon.' },
  'Poké Ball': { price: 20, desc: 'Una ball básica para capturar Pokémon salvajes.' },
  'Great Ball': { price: 50, desc: 'Una ball con mayor ratio de captura.' },
  'Ultra Ball': { price: 80, desc: 'Una ball con alto ratio de captura.' },
  'Master Ball': { price: 500, desc: '¡Captura cualquier Pokémon sin fallo!' },
  'Quick Ball': { price: 60, desc: 'Más efectiva si se usa al inicio del combate.' },
  'Timer Ball': { price: 60, desc: 'Más efectiva cuantos más turnos hayan pasado.' },
  'Dusk Ball': { price: 60, desc: 'Más efectiva en la oscuridad.' },
  'Net Ball': { price: 60, desc: 'Más efectiva contra tipos Agua o Bicho.' },
  'Level Ball': { price: 60, desc: 'Más efectiva si superas en nivel al rival.' },
  'Repeat Ball': { price: 60, desc: 'Más efectiva si ya capturaste esa especie.' },
  'Love Ball': { price: 60, desc: 'Más efectiva si es de la misma familia evolutiva.' },
  'Friend Ball': { price: 60, desc: 'Una ball especial amistosa.' },
  'Heavy Ball': { price: 60, desc: 'Más efectiva contra Pokémon pesados.' },
  'Fire Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Water Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Thunder Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Leaf Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Moon Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Sun Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Shiny Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Dusk Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Dawn Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
  'Ice Stone': { price: 120, desc: 'Piedra que evoluciona a ciertos Pokémon.' },
}

const EVOLUTION_STONES = ['Fire Stone', 'Water Stone', 'Thunder Stone', 'Leaf Stone', 'Moon Stone', 'Sun Stone', 'Shiny Stone', 'Dusk Stone', 'Dawn Stone', 'Ice Stone'] as const

const EVOLUTION_STONE_UNLOCK_IDS: Record<string, string> = {
  'Fire Stone': 'unlock_fire_stone',
  'Water Stone': 'unlock_water_stone',
  'Thunder Stone': 'unlock_thunder_stone',
  'Leaf Stone': 'unlock_leaf_stone',
  'Moon Stone': 'unlock_moon_stone',
  'Sun Stone': 'unlock_sun_stone',
  'Shiny Stone': 'unlock_shiny_stone',
  'Dusk Stone': 'unlock_dusk_stone',
  'Dawn Stone': 'unlock_dawn_stone',
  'Ice Stone': 'unlock_ice_stone',
}

const EVOLUTION_STONE_ITEM_NAMES: Record<string, string> = {
  'Fire Stone': 'fire-stone',
  'Water Stone': 'water-stone',
  'Thunder Stone': 'thunder-stone',
  'Leaf Stone': 'leaf-stone',
  'Moon Stone': 'moon-stone',
  'Sun Stone': 'sun-stone',
  'Shiny Stone': 'shiny-stone',
  'Dusk Stone': 'dusk-stone',
  'Dawn Stone': 'dawn-stone',
  'Ice Stone': 'ice-stone',
  'Gorra de Ash': 'gorra-de-ash',
}

const EVOLUTION_ITEM_UNLOCK_IDS: Record<string, string> = {
  'Metal Coat': 'unlock_metal_coat',
  "King's Rock": 'unlock_kings_rock',
  'Dragon Scale': 'unlock_dragon_scale',
  'Up-Grade': 'unlock_up_grade',
  'Dubious Disc': 'unlock_dubious_disc',
  'Reaper Cloth': 'unlock_reaper_cloth',
  'Protector': 'unlock_protector',
  'Electirizer': 'unlock_electirizer',
  'Magmarizer': 'unlock_magmarizer',
  'Prism Scale': 'unlock_prism_scale',
  'Sachet': 'unlock_sachet',
  'Whipped Dream': 'unlock_whipped_dream',
  'Gorra de Ash': 'unlock_gorra_de_ash',
}

const itemDescriptions: Record<string, string> = {
  Potion: 'Restaura 25 HP al Pokémon activo.',
  'Super Potion': 'Restaura 50 HP al Pokémon activo.',
  'Hyper Potion': 'Restaura 120 HP al Pokémon activo.',
  'Full Restore': 'Restaura todo el HP y cura estados.',
  'X Attack': 'Aumenta permanentemente en +5 el ataque.',
  'X Defense': 'Aumenta permanentemente en +5 la defensa.',
  'X Speed': 'Aumenta permanentemente en +5 la velocidad.',
  'Oran Berry': 'Restaura 15 HP al Pokémon activo.',
  'Lum Berry': 'Restaura 30 HP y cura estados.',
  'Full Heal': 'Restaura 40 HP y cura estados.',
  'Revive': 'Revive a un Pokémon debilitado con 50% HP.',
  'Max Revive': 'Revive a un Pokémon debilitado con el HP completo.',
  'Elixir': 'Restaura 80 HP al Pokémon activo.',
  'Super Elixir': 'Restaura 200 HP al Pokémon activo.',
  'Full Elixir': 'Restaura todo el HP y cura estados.',
  'X Attack 2': 'Aumenta permanentemente en +10 el ataque.',
  'X Defense 2': 'Aumenta permanentemente en +10 la defensa.',
  'X Speed 2': 'Aumenta permanentemente en +10 la velocidad.',
  'Poké Ball': 'Una ball básica para capturar Pokémon salvajes.',
  'Great Ball': 'Una ball con mayor ratio de captura (x1.5).',
  'Ultra Ball': 'Una ball con alto ratio de captura (x2).',
  'Master Ball': '¡Captura cualquier Pokémon sin fallo!',
  'Quick Ball': 'Más efectiva al inicio (x5 en turno 1).',
  'Timer Ball': 'Mejora con los turnos (hasta x4).',
  'Dusk Ball': 'Efectiva en la oscuridad (x3).',
  'Net Ball': 'Efectiva contra Agua/Bicho (x3).',
  'Level Ball': 'Mejor si superas en nivel al rival (hasta x8).',
  'Repeat Ball': 'x3.5 si ya capturaste esa especie.',
  'Love Ball': 'x8 si es de la misma familia evolutiva.',
  'Friend Ball': 'Una ball especial amistosa (x1).',
  'Heavy Ball': 'Mejor contra Pokémon pesados (hasta x4).',
  'Cuerda Huida': 'Escapa de cualquier combate de la aventura.',
  'Moomoo Milk': 'Restaura 100 HP de un Pokémon.',
  'Berry Juice': 'Restaura 20 HP de un Pokémon.',
  'Fresh Water': 'Restaura 30 HP de un Pokémon.',
  'Soda Pop': 'Restaura 40 HP de un Pokémon.',
  'Lemonade': 'Restaura 60 HP de un Pokémon.',
}

const ITEM_SPRITES: Record<string, string> = {
  'Potion': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png',
  'Super Potion': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/super-potion.png',
  'Hyper Potion': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hyper-potion.png',
  'Full Restore': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/full-restore.png',
  'Oran Berry': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/oran-berry.png',
  'Lum Berry': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lum-berry.png',
  'X Attack': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-attack.png',
  'X Defense': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-defense.png',
  'X Speed': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-speed.png',
  'Full Heal': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/full-heal.png',
  'Revive': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/revive.png',
  'Max Revive': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/max-revive.png',
  'Muscle Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/muscle-band.png',
  'Wise Glasses': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/wise-glasses.png',
  'Choice Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/choice-band.png',
  'Leftovers': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/leftovers.png',
  'Focus Sash': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-sash.png',
  'Assault Vest': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/assault-vest.png',
  'Quick Claw': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/quick-claw.png',
  'Eviolite': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/eviolite.png',
  'Life Orb': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/life-orb.png',
  'Rocky Helmet': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rocky-helmet.png',
  'Scope Lens': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/scope-lens.png',
  'Shell Bell': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shell-bell.png',
  'Choice Scarf': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/choice-scarf.png',
  'Babiri Berry': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/babiri-berry.png',
  'Big Root': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/big-root.png',
  'Wide Lens': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/wide-lens.png',
  'Sitrus Berry': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sitrus-berry.png',
  'Guts Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/muscle-band.png',
  'Vest Protector': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/assault-vest.png',
  'Focus Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-band.png',
  'Rare Candy': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png',
  'Elixir': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/elixir.png',
  'Super Elixir': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/max-elixir.png',
  'Full Elixir': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/max-potion.png',
  'X Attack 2': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-attack.png',
  'X Defense 2': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-defense.png',
  'X Speed 2': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-speed.png',
  'Dragon Fang': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-fang.png',
  'Guardian Charm': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/guard-spec.png',
  'Berserker Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/macho-brace.png',
  'Phantom Cloak': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/black-sludge.png',
  'Swift Feather': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-bracer.png',
  'Iron Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/iron-ball.png',
  'Vampire Fang': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/float-stone.png',
  'Cursed Blade': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/razor-claw.png',
  'Mega Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/key-stone.png',
  'Dynamax Band': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/power-bracer.png',
  'Poké Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
  'Great Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png',
  'Ultra Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png',
  'Master Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png',
  'Quick Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/quick-ball.png',
  'Timer Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/timer-ball.png',
  'Dusk Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dusk-ball.png',
  'Net Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/net-ball.png',
  'Level Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/level-ball.png',
  'Repeat Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/repeat-ball.png',
  'Love Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/love-ball.png',
  'Friend Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/friend-ball.png',
  'Heavy Ball': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/heavy-ball.png',
  'Fire Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fire-stone.png',
  'Water Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/water-stone.png',
  'Thunder Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/thunder-stone.png',
  'Leaf Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/leaf-stone.png',
  'Moon Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/moon-stone.png',
  'Sun Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sun-stone.png',
  'Shiny Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shiny-stone.png',
  'Dusk Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dusk-stone.png',
  'Dawn Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dawn-stone.png',
  'Ice Stone': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ice-stone.png',
  'Metal Coat': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/metal-coat.png',
  'Dragon Scale': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-scale.png',
  'Up-Grade': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/up-grade.png',
  'Dubious Disc': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dubious-disc.png',
  'Reaper Cloth': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/reaper-cloth.png',
  'Protector': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/protector.png',
  'Electirizer': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/electirizer.png',
  'Magmarizer': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/magmarizer.png',
  'Prism Scale': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/prism-scale.png',
  'Sachet': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sachet.png',
  'Whipped Dream': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/whipped-dream.png',
  'Cuerda Huida': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/escape-rope.png',
  'Moomoo Milk': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/moomoo-milk.png',
  'Berry Juice': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/berry-juice.png',
  'Fresh Water': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fresh-water.png',
  'Soda Pop': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/soda-pop.png',
  'Lemonade': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lemonade.png',
}

interface HoldableItem {
  name: string
  desc: string
  price: number
  attackMod?: number
  defenseMod?: number
  speedMod?: number
  maxHpMod?: number
  healPerTurn?: number
  damageBoost?: number
  damageReduction?: number
  critChance?: number
  lifesteal?: number
  lowHpBonus?: number
  firstStrikeBonus?: number
  isMegaStone?: boolean
  isGmaxBand?: boolean
}

const HOLDABLE_ITEMS: Record<string, HoldableItem> = {
  'Muscle Band': { name: 'Muscle Band', desc: '+15% Ataque', price: 200, attackMod: 0.15 },
  'Wise Glasses': { name: 'Wise Glasses', desc: '+15% Velocidad', price: 200, speedMod: 0.15 },
  'Choice Band': { name: 'Choice Band', desc: '+25% Ataque', price: 350, attackMod: 0.25 },
  'Leftovers': { name: 'Leftovers', desc: 'Recupera 6 HP por turno', price: 300, healPerTurn: 6 },
  'Focus Sash': { name: 'Focus Sash', desc: '+20 HP máximos', price: 250, maxHpMod: 20 },
  'Assault Vest': { name: 'Assault Vest', desc: '+20% Defensa', price: 300, defenseMod: 0.20 },
  'Quick Claw': { name: 'Quick Claw', desc: '+20% Velocidad', price: 250, speedMod: 0.20 },
  'Eviolite': { name: 'Eviolite', desc: '+10% Defensa y Ataque', price: 200, attackMod: 0.10, defenseMod: 0.10 },
  'Life Orb': { name: 'Life Orb', desc: '+30% Daño, -5 HP por turno', price: 400, damageBoost: 0.30, healPerTurn: -5 },
  'Rocky Helmet': { name: 'Rocky Helmet', desc: '+15% Defensa', price: 200, defenseMod: 0.15 },
  'Scope Lens': { name: 'Scope Lens', desc: '20% Golpe Crítico', price: 250, critChance: 0.20 },
  'Shell Bell': { name: 'Shell Bell', desc: '20% Robo de Vida', price: 300, lifesteal: 0.20 },
  'Choice Scarf': { name: 'Choice Scarf', desc: '+30% Velocidad', price: 350, speedMod: 0.30 },
  'Babiri Berry': { name: 'Babiri Berry', desc: '20% Reducción de Daño', price: 250, damageReduction: 0.20 },
  'Big Root': { name: 'Big Root', desc: '25% Robo de Vida', price: 350, lifesteal: 0.25 },
  'Wide Lens': { name: 'Wide Lens', desc: '15% Crítico, +10% Velocidad', price: 200, critChance: 0.15, speedMod: 0.10 },
  'Sitrus Berry': { name: 'Sitrus Berry', desc: '+15 HP máximos, +8 HP/turno', price: 200, maxHpMod: 15, healPerTurn: 8 },
  'Guts Band': { name: 'Guts Band', desc: '+20% Ataque, +15% daño bajo 30% HP', price: 300, attackMod: 0.20, lowHpBonus: 0.15 },
  'Vest Protector': { name: 'Vest Protector', desc: '+25% Defensa, 15% Reducción daño', price: 400, defenseMod: 0.25, damageReduction: 0.15 },
  'Focus Band': { name: 'Focus Band', desc: '25% Crítico, +10% Ataque', price: 300, critChance: 0.25, attackMod: 0.10 },
  'Dragon Fang': { name: 'Dragon Fang', desc: '+20% Ataque, +10% Velocidad', price: 350, attackMod: 0.20, speedMod: 0.10 },
  'Guardian Charm': { name: 'Guardian Charm', desc: '+15% Defensa, +10 HP máximos', price: 300, defenseMod: 0.15, maxHpMod: 10 },
  'Berserker Band': { name: 'Berserker Band', desc: '+30% Ataque bajo 25% HP', price: 400, attackMod: 0.10, lowHpBonus: 0.30 },
  'Phantom Cloak': { name: 'Phantom Cloak', desc: '10% Reducción daño, +10% Velocidad', price: 350, damageReduction: 0.10, speedMod: 0.10 },
  'Swift Feather': { name: 'Swift Feather', desc: '+15% Velocidad, 10% Crítico', price: 300, speedMod: 0.15, critChance: 0.10 },
  'Iron Ball': { name: 'Iron Ball', desc: '+25% Defensa, -10% Velocidad', price: 250, defenseMod: 0.25, speedMod: -0.10 },
  'Vampire Fang': { name: 'Vampire Fang', desc: '15% Robo de Vida', price: 350, lifesteal: 0.15 },
  'Cursed Blade': { name: 'Cursed Blade', desc: '+35% Ataque, -5 HP por turno', price: 450, attackMod: 0.35, healPerTurn: -5 },
  'Mega Stone': { name: 'Mega Stone', desc: 'Permite mega-evolucionar 1 vez por combate', price: 700, isMegaStone: true },
  'Dynamax Band': { name: 'Dynamax Band', desc: 'Permite gigamaximar 1 vez por combate (3 turnos)', price: 0, isGmaxBand: true },
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
}

const HOLDABLE_ITEM_NAMES = Object.keys(HOLDABLE_ITEMS)

// --- Pokéballs ---
interface PokeBallDef {
  name: string
  rate: number
  desc: string
  price: number
  spriteKey: string
  isMaster?: boolean
  rateFn?: (target: Pokemon, turns: number, alreadyCaught: boolean, playerLevel?: number) => number
}

const POKEBALLS: PokeBallDef[] = [
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
]

const POKEBALL_NAMES = POKEBALLS.map(b => b.name)
const POKEBALL_RATES: Record<string, number> = {}
for (const b of POKEBALLS) POKEBALL_RATES[b.name] = b.rate
const POKEBALL_DEFS: Record<string, PokeBallDef> = {}
for (const b of POKEBALLS) POKEBALL_DEFS[b.name] = b
const POKEBALL_PRICES: Record<string, number> = {}
for (const b of POKEBALLS) POKEBALL_PRICES[b.name] = b.price

// IDs de meta-shop para desbloquear pokeballs
const POKEBALL_UNLOCK_IDS: Record<string, string> = {
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
}

function getPokeBallRate(ballName: string, target: Pokemon, turns: number, alreadyCaught: boolean, playerLevel?: number): number {
  const def = POKEBALL_DEFS[ballName]
  if (!def) return 1
  if (def.rateFn) return def.rateFn(target, turns, alreadyCaught, playerLevel)
  return def.rate
}

const GYM_BADGES = [
  { id: 'boulder', name: 'Boulder Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/1.png' },
  { id: 'cascade', name: 'Cascade Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/2.png' },
  { id: 'thunder', name: 'Thunder Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/3.png' },
  { id: 'rainbow', name: 'Rainbow Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/4.png' },
  { id: 'soul', name: 'Soul Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/5.png' },
  { id: 'marsh', name: 'Marsh Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/6.png' },
  { id: 'volcano', name: 'Volcano Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/7.png' },
  { id: 'earth', name: 'Earth Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/8.png' },
  { id: 'zephyr', name: 'Zephyr Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/9.png' },
  { id: 'hive', name: 'Hive Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/10.png' },
  { id: 'plain', name: 'Plain Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/11.png' },
  { id: 'fog', name: 'Fog Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/12.png' },
  { id: 'storm', name: 'Storm Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/13.png' },
  { id: 'mineral', name: 'Mineral Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/14.png' },
  { id: 'glacier', name: 'Glacier Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/15.png' },
  { id: 'rising', name: 'Rising Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/16.png' },
  { id: 'stone', name: 'Stone Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/17.png' },
  { id: 'knuckle', name: 'Knuckle Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/18.png' },
  { id: 'dynamo', name: 'Dynamo Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/19.png' },
  { id: 'heat', name: 'Heat Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/20.png' },
  { id: 'balance', name: 'Balance Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/21.png' },
  { id: 'feather', name: 'Feather Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/22.png' },
  { id: 'mind', name: 'Mind Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/23.png' },
  { id: 'rain', name: 'Rain Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/24.png' },
  { id: 'coal', name: 'Coal Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/25.png' },
  { id: 'forest', name: 'Forest Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/26.png' },
  { id: 'cobble', name: 'Cobble Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/27.png' },
  { id: 'fen', name: 'Fen Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/28.png' },
  { id: 'relic', name: 'Relic Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/29.png' },
  { id: 'mine', name: 'Mine Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/30.png' },
  { id: 'icicle', name: 'Icicle Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/31.png' },
  { id: 'beacon', name: 'Beacon Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/32.png' },
]

const MEGA_CAPABLE_IDS = new Set([
  3, 6, 9, 15, 18, 26, 36, 65, 71, 80, 94, 115, 121, 127, 130, 142, 149, 150,
  154, 160, 181, 208, 212, 214, 227, 229, 248,
  254, 257, 260, 282, 302, 303, 306, 308,   310, 319, 323, 334, 354, 358, 359, 362, 373, 376, 380, 381, 384, 398,
  428, 445, 448, 460, 475, 478, 485, 491,
  500, 530, 531, 545, 560, 604, 609, 623,
  652, 655, 658, 668, 670, 678, 687, 689, 691, 701, 718, 719,
  740, 768, 780, 801, 807,
  870, 952, 970, 978, 998,
])

const MEGA_FORM_IDS: Record<number, number | number[]> = {
  3: 10033, 6: [10034, 10035], 9: 10036, 15: 10090, 18: 10073,
  26: [10304, 10305], 36: 10278, 65: 10037, 71: 10279, 80: 10071,
  94: 10038, 115: 10039, 121: 10280, 127: 10040, 130: 10041,
  142: 10042, 149: 10281, 150: [10043, 10044],
  154: 10282, 160: 10283, 181: 10045, 208: 10072, 212: 10046,
  214: 10047, 227: 10284, 229: 10048, 248: 10049,
  254: 10065, 257: 10050, 260: 10064, 282: 10051, 302: 10066,
  303: 10052, 306: 10053, 308: 10054,   310: 10055, 319: 10070, 323: 10087, 334: 10067, 354: 10056,
  358: 10306, 359: [10057, 10307], 362: 10074, 373: 10089, 376: 10076,
  380: 10062, 381: 10063, 384: 10079, 398: 10308,
  428: 10088, 445: [10058, 10309], 448: [10059, 10310],
  460: 10060, 475: 10068, 478: 10285, 485: 10311, 491: 10312,
  500: 10286, 530: 10287, 531: 10069, 545: 10288, 560: 10289,
  604: 10290, 609: 10291, 623: 10313,
  652: 10292, 655: 10293, 658: 10294, 668: 10295, 670: 10296,
  678: [10314, 10326], 687: 10297, 689: 10298, 691: 10299,
  701: 10300, 718: 10301, 719: 10075,
  740: 10315, 768: 10316, 780: 10302, 801: [10317, 10318],
  807: 10319,
  870: 10303, 952: 10320, 970: 10321, 978: [10322, 10323, 10324],
  998: 10325,
}

const GMAX_CAPABLE_IDS = new Set([
  3, 6, 9, 12, 25, 52, 68, 94, 99, 131, 133, 143, 569, 809,
  812, 815, 818, 823, 826, 834, 839, 841, 842, 844, 849, 851,
  858, 861, 869, 879, 884, 892,
])

const GMAX_FORM_IDS: Record<number, number | number[]> = {
  3: 10195, 6: 10196, 9: 10197, 12: 10198, 25: 10199, 52: 10200,
  68: 10201, 94: 10202, 99: 10203, 131: 10204, 133: 10205, 143: 10206,
  569: 10207, 809: 10208, 812: 10209, 815: 10210, 818: 10211,
  823: 10212, 826: 10213, 834: 10214, 839: 10215, 841: 10216,
  842: 10217, 844: 10218, 849: [10219, 10228], 851: 10220,
  858: 10221, 861: 10222, 869: 10223, 879: 10224, 884: 10225,
  892: [10226, 10227],
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', name: 'Primera Victoria', desc: 'Gana tu primera partida', icon: '🏆', hidden: false },
  { id: 'streak_3', name: 'En Racha', desc: 'Gana 3 partidas seguidas', icon: '🔥', hidden: false },
  { id: 'streak_5', name: 'Incombustible', desc: 'Gana 5 partidas seguidas', icon: '🌋', hidden: false },
  { id: 'streak_10', name: 'Leyenda Viva', desc: 'Gana 10 partidas seguidas', icon: '👑', hidden: false },
  { id: 'nuzlocke_win', name: 'Superviviente', desc: 'Gana una partida con Nuzlocke', icon: '💀', hidden: false },
  { id: 'solo_win', name: 'Uno Contra Todos', desc: 'Gana con solo 1 Pokémon en el equipo', icon: '⭐', hidden: false },
  { id: 'speedrun_win', name: 'Relámpago', desc: 'Gana una partida con Speedrun activo', icon: '⚡', hidden: false },
  { id: 'no_item_win', name: 'Purista', desc: 'Gana sin usar items', icon: '🚫', hidden: false },
  { id: 'ironman_win', name: 'Invencible', desc: 'Gana una partida Ironman', icon: '🛡️', hidden: false },
  { id: 'perfect_battle', name: 'Flawless', desc: 'Gana un combate sin recibir daño', icon: '✨', hidden: false },
  { id: 'one_shot', name: 'Golpe Definitivo', desc: 'Derrota a un Pokémon enemigo en 1 golpe', icon: '💥', hidden: false },
  { id: 'comeback', name: 'Resurgir', desc: 'Gana un combate con solo 1 Pokémon con ≤10% HP', icon: '❤️‍🔥', hidden: false },
  { id: 'collector_10', name: 'Coleccionista', desc: 'Captura 10 Pokémon en una partida', icon: '📦', hidden: false },
  { id: 'collector_25', name: 'Maestro Pokédex', desc: 'Captura 25 Pokémon en una partida', icon: '📖', hidden: false },
  { id: 'rich', name: 'Magnate', desc: 'Acumula $999 en una partida', icon: '💰', hidden: false },
  { id: 'crit_master', name: 'Crítico Nato', desc: 'Lanza 5 golpes críticos en una partida', icon: '🎯', hidden: false },
  { id: 'all_gens', name: 'Viajero Multiversal', desc: 'Gana al menos 1 partida en cada generación', icon: '🌍', hidden: false },
  { id: 'infinite_20', name: 'Infinito y Más Allá', desc: 'Llega al nodo 20 en modo Infinite', icon: '🚀', hidden: false },
  { id: 'shiny_catch', name: 'Afortunado', desc: 'Captura un Pokémon shiny', icon: '✨', hidden: false },
  { id: 'legendary_catch', name: 'Cazador de Leyendas', desc: 'Captura un Pokémon con BST ≥ 600', icon: '🐉', hidden: false },
  { id: 'daily_3', name: 'Habitual', desc: 'Juega desafíos diarios', icon: '📅', hidden: false },
  { id: 'meta_100', name: 'Inversor', desc: 'Acumula 100 PokéCoins', icon: '🪙', hidden: false },
  { id: 'boss_rush_win', name: 'Rush Total', desc: 'Gana una partida Boss Rush', icon: '🏆', hidden: false },
  { id: 'hard_win', name: 'Veterano', desc: 'Gana una partida en dificultad Hard', icon: '🎖️', hidden: false },
  { id: 'gauntlet_win', name: 'Gauntlet Master', desc: 'Gana una partida Challenge Gauntlet', icon: '🎯', hidden: false },
  { id: 'synergy_master', name: 'Maestro de Sinergias', desc: 'Activa una sinergia de items', icon: '🔗', hidden: false },
  { id: 'super_effective_10', name: 'Tierra de Nadie', desc: 'Landa 10 golpes supereficaces en una partida', icon: '🌿', hidden: false },
  { id: 'big_spender', name: 'Derrochador', desc: 'Gasta $500 en tiendas en una partida', icon: '💸', hidden: false },
  { id: 'rookie', name: 'Novato', desc: 'Gana una partida en dificultad Fácil', icon: '🐣', hidden: false },
  { id: 'infinite_50', name: 'Sin Límites', desc: 'Llega al nodo 50 en modo Infinite', icon: '🌌', hidden: false },
  { id: 'full_team', name: 'Equipo Completo', desc: 'Gana con 6 Pokémon en el equipo', icon: '🤝', hidden: false },
  { id: 'battle_20', name: 'Veterano de Guerra', desc: 'Gana 20 combates en una partida', icon: '⚔️', hidden: false },
  { id: 'item_user_10', name: 'Experimentado', desc: 'Usa 10 objetos en una partida', icon: '🧪', hidden: false },
  { id: 'gambler', name: 'Jugador', desc: 'Gana un nodo Spin', icon: '🎰', hidden: false },
  { id: 'pokeRand_master', name: 'Maestro Aleatorio', desc: 'Gana un nodo PokeRand', icon: '🎲', hidden: false },
  { id: 'streak_15', name: 'Racha Imparable', desc: 'Gana 15 partidas seguidas', icon: '🔥', hidden: false },
  { id: 'streak_20', name: 'Leyenda de Racha', desc: 'Gana 20 partidas seguidas', icon: '🔥', hidden: false },
  { id: 'streak_25', name: 'Dios de la Racha', desc: 'Gana 25 partidas seguidas', icon: '🔥', hidden: false },
  { id: 'battle_50', name: 'Comandante', desc: 'Gana 50 combates en una partida', icon: '⚔️', hidden: false },
  { id: 'battle_100', name: 'General', desc: 'Gana 100 combates en una partida', icon: '⚔️', hidden: false },
  { id: 'battle_200', name: 'Estratega', desc: 'Gana 200 combates en una partida', icon: '⚔️', hidden: false },
  { id: 'battle_500', name: 'Conquistador', desc: 'Gana 500 combates en una partida', icon: '⚔️', hidden: false },
  { id: 'damage_1000', name: 'Aprendiz de Daño', desc: 'Inflige 1000 de daño en una partida', icon: '💥', hidden: false },
  { id: 'damage_5000', name: 'Especialista en Daño', desc: 'Inflige 5000 de daño en una partida', icon: '💥', hidden: false },
  { id: 'damage_10000', name: 'Maestro del Daño', desc: 'Inflige 10000 de daño en una partida', icon: '💥', hidden: false },
  { id: 'damage_50000', name: 'Dios del Daño', desc: 'Inflige 50000 de daño en una partida', icon: '💥', hidden: false },
  { id: 'tank_500', name: 'Escudo Humano', desc: 'Recibe 500 de daño en una partida', icon: '🛡️', hidden: false },
  { id: 'tank_1000', name: 'Muro Viviente', desc: 'Recibe 1000 de daño en una partida', icon: '🛡️', hidden: false },
  { id: 'crit_10', name: 'Crítico Frecuente', desc: 'Lanza 10 golpes críticos en una partida', icon: '🎯', hidden: false },
  { id: 'crit_20', name: 'Crítico Experto', desc: 'Lanza 20 golpes críticos en una partida', icon: '🎯', hidden: false },
  { id: 'crit_50', name: 'Crítico Legendario', desc: 'Lanza 50 golpes críticos en una partida', icon: '🎯', hidden: false },
  { id: 'super_effective_25', name: 'Eficaz Mejorado', desc: 'Acierta 25 golpes supereficaces', icon: '🌿', hidden: false },
  { id: 'super_effective_50', name: 'Súper Eficaz', desc: 'Acierta 50 golpes supereficaces', icon: '🌿', hidden: false },
  { id: 'super_effective_100', name: 'Maestro de Tipos', desc: 'Acierta 100 golpes supereficaces', icon: '🌿', hidden: false },
  { id: 'one_shot_5', name: 'Fulminante', desc: 'Derrota 5 Pokémon de 1 golpe', icon: '💥', hidden: false },
  { id: 'one_shot_10', name: 'Aniquilador', desc: 'Derrota 10 Pokémon de 1 golpe', icon: '💥', hidden: false },
  { id: 'collector_50', name: 'Acumulador', desc: 'Captura 50 Pokémon en una partida', icon: '📦', hidden: false },
  { id: 'item_user_25', name: 'Dependiente', desc: 'Usa 25 objetos en una partida', icon: '🧪', hidden: false },
  { id: 'item_user_50', name: 'Farmacéutico', desc: 'Usa 50 objetos en una partida', icon: '🧪', hidden: false },
  { id: 'rich_5000', name: 'Millonario', desc: 'Acumula $5000 en una partida', icon: '💰', hidden: false },
  { id: 'rich_10000', name: 'Magnate Global', desc: 'Acumula $10000 en una partida', icon: '💰', hidden: false },
  { id: 'rich_50000', name: 'Croesus', desc: 'Acumula $50000 en una partida', icon: '💰', hidden: false },
  { id: 'spender_1000', name: 'Gastador', desc: 'Gasta $1000 en tiendas en una partida', icon: '💸', hidden: false },
  { id: 'spender_5000', name: 'Derrochador Élite', desc: 'Gasta $5000 en tiendas en una partida', icon: '💸', hidden: false },
  { id: 'nodes_30', name: 'Explorador', desc: 'Limpia 30 nodos en una partida', icon: '🚶', hidden: false },
  { id: 'nodes_50', name: 'Aventurero', desc: 'Limpia 50 nodos en una partida', icon: '🚶', hidden: false },
  { id: 'nodes_100', name: 'Leyenda del Camino', desc: 'Limpia 100 nodos en una partida', icon: '🚶', hidden: false },
  { id: 'infinite_100', name: 'Infinito Profundo', desc: 'Llega al nodo 100 en modo Infinite', icon: '🌌', hidden: false },
  { id: 'total_wins_5', name: 'Victorioso', desc: 'Gana 5 partidas en total', icon: '🏆', hidden: false },
  { id: 'total_wins_10', name: 'Campeón Recurrente', desc: 'Gana 10 partidas en total', icon: '🏆', hidden: false },
  { id: 'total_wins_25', name: 'Leyenda Viva', desc: 'Gana 25 partidas en total', icon: '🏆', hidden: false },
  { id: 'total_wins_50', name: 'Inmortal', desc: 'Gana 50 partidas en total', icon: '🏆', hidden: false },
  { id: 'total_runs_10', name: 'Jugador Dedicado', desc: 'Juega 10 partidas en total', icon: '🎮', hidden: false },
  { id: 'total_runs_25', name: 'Veterano', desc: 'Juega 25 partidas en total', icon: '🎮', hidden: false },
  { id: 'total_runs_50', name: 'Adicto', desc: 'Juega 50 partidas en total', icon: '🎮', hidden: false },
  { id: 'meta_500', name: 'Coleccionista de Monedas', desc: 'Acumula 500 PokéCoins', icon: '🪙', hidden: false },
  { id: 'meta_1000', name: 'Inversor Mayorista', desc: 'Acumula 1000 PokéCoins', icon: '🪙', hidden: false },
  { id: 'meta_5000', name: 'Tiburón Financiero', desc: 'Acumula 5000 PokéCoins', icon: '🪙', hidden: false },
  { id: 'medium_win', name: 'Competente', desc: 'Gana en dificultad Media', icon: '🥈', hidden: false },
  { id: 'noShops_win', name: 'Ermitaño', desc: 'Gana con el desafío Sin Tiendas', icon: '🏪', hidden: false },
  { id: 'noRests_win', name: 'Insomne', desc: 'Gana con el desafío Sin Descanso', icon: '🛌', hidden: false },
  { id: 'allShiny_win', name: 'Brillante', desc: 'Gana con el desafío Todos Shiny', icon: '✨', hidden: false },
  { id: 'noMoney_win', name: 'Pobreza', desc: 'Gana con el desafío Sin Dinero', icon: '💸', hidden: false },
  { id: 'egglocke_win', name: 'Criador', desc: 'Gana con el desafío Egglocke', icon: '🥚', hidden: false },
  { id: 'nuzlockeHC_win', name: 'Superviviente Extremo', desc: 'Gana con Nuzlocke Hardcore', icon: '💀', hidden: false },
  { id: 'noHeal_win', name: 'Autosuficiente', desc: 'Gana con el desafío Sin Curación', icon: '🚑', hidden: false },
  { id: 'allTeamRocket_win', name: 'Team Rocket Forever', desc: 'Gana con el desafío Todo Team Rocket', icon: '🔴', hidden: false },
  { id: 'triple_challenge', name: 'Tres Retos', desc: 'Gana con 3 desafíos activos', icon: '🎯', hidden: false },
  { id: 'challenge_mania', name: 'Manía de Retos', desc: 'Gana con 5+ desafíos activos', icon: '🎯', hidden: false },
  { id: 'team_diversity_10', name: 'Versátil', desc: 'Usa 10 Pokémon diferentes en una partida', icon: '🔄', hidden: false },
  { id: 'team_diversity_20', name: 'Polivalente', desc: 'Usa 20 Pokémon diferentes en una partida', icon: '🔄', hidden: false },
  { id: 'total_turns_500', name: 'Paciente', desc: 'Juega 500 turnos en una partida', icon: '⌛', hidden: false },
  { id: 'total_turns_1000', name: 'Táctico', desc: 'Juega 1000 turnos en una partida', icon: '⌛', hidden: false },
  { id: 'back_from_brink', name: 'Al Límite', desc: 'Gana un combate con 1 HP restante', icon: '❤️‍🔥', hidden: false },
  { id: 'first_try', name: 'Novato con Suerte', desc: 'Gana tu primera partida', icon: '🍀', hidden: false },
  { id: 'hoarder_15', name: 'Acaparador', desc: 'Ten 15 objetos en el inventario', icon: '📦', hidden: false },
  { id: 'evolution_master', name: 'Evolucionador', desc: 'Evoluciona 5 Pokémon en una partida', icon: '🌀', hidden: false },
  { id: 'first_mega', name: 'Mega Evolución', desc: 'Mega-evoluciona un Pokémon por primera vez', icon: '💎', hidden: false },
  { id: 'mega_win', name: 'Poder Mega', desc: 'Gana una partida usando megaevolución', icon: '💎', hidden: false },
  { id: 'mega_master', name: 'Maestro Mega', desc: 'Mega-evoluciona 10 Pokémon en total', icon: '🔮', hidden: false },
  { id: 'first_gmax', name: 'Gigamax', desc: 'Gigamaxima un Pokémon por primera vez', icon: '⚡', hidden: false },
  { id: 'gmax_win', name: 'Poder Gigamax', desc: 'Gana una partida usando Gigamax', icon: '⚡', hidden: false },
  { id: 'gmax_master', name: 'Maestro Gigamax', desc: 'Gigamaxima 10 Pokémon en total', icon: '🌟', hidden: false },
]

const SYNERGIES: Array<{ items: string[]; name: string; desc: string; effect: (pokemon: Pokemon) => Partial<Pokemon> }> = [
  {
    items: ['Life Orb', 'Guts Band'],
    name: 'Furia Desatada',
    desc: '+20% daño adicional y +20% a bajo HP',
    effect: (p) => ({ attack: Math.round(p.attack * 1.1) })
  },
  {
    items: ['Choice Band', 'Choice Scarf'],
    name: 'Elección Absoluta',
    desc: '+15% a todos los stats ofensivos',
    effect: (p) => ({ attack: Math.round(p.attack * 1.1), speed: Math.round(p.speed * 1.1) })
  },
  {
    items: ['Leftovers', 'Sitrus Berry'],
    name: 'Regeneración Total',
    desc: '+4 HP/turno extra',
    effect: (p) => ({ maxHp: p.maxHp + 10, hp: Math.min(p.hp + 10, p.maxHp + 10) })
  },
  {
    items: ['Scope Lens', 'Wide Lens'],
    name: 'Ojo de Águila',
    desc: '+15% crítico adicional y +5% SPD',
    effect: (p) => ({ speed: Math.round(p.speed * 1.05) })
  },
  {
    items: ['Shell Bell', 'Big Root'],
    name: 'Vampirismo Extremo',
    desc: '+10% lifesteal adicional',
    effect: (p) => ({ attack: Math.round(p.attack * 1.05) })
  },
  {
    items: ['Assault Vest', 'Vest Protector'],
    name: 'Fortaleza Total',
    desc: '+10% defensa y +10 maxHP',
    effect: (p) => ({ defense: Math.round(p.defense * 1.1), maxHp: p.maxHp + 10, hp: Math.min(p.hp + 10, p.maxHp + 10) })
  },
  {
    items: ['Muscle Band', 'Focus Band'],
    name: 'Potencia Bruta',
    desc: '+10% ataque y +5% crítico',
    effect: (p) => ({ attack: Math.round(p.attack * 1.1) })
  },
  {
    items: ['Quick Claw', 'Choice Scarf'],
    name: 'Velocidad Límite',
    desc: '+15% velocidad',
    effect: (p) => ({ speed: Math.round(p.speed * 1.15) })
  },
  {
    items: ['Rocky Helmet', 'Babiri Berry'],
    name: 'Castigo Reflejado',
    desc: '+15 defensa permanente',
    effect: (p) => ({ defense: p.defense + 15 })
  },
  {
    items: ['Eviolite', 'Focus Sash'],
    name: 'Juventud Eterna',
    desc: '+10% a todos los stats',
    effect: (p) => ({
      attack: Math.round(p.attack * 1.1),
      defense: Math.round(p.defense * 1.1),
      speed: Math.round(p.speed * 1.1),
    })
  },
]

const RANDOM_EVENTS = [
  {
    id: 'legendary_appears',
    weight: 3,
    icon: '🐉',
    title: '¡Pokémon Legendario!',
    desc: 'Un Pokémon poderoso aparece delante de ti. ¿Capturarlo?',
    minRouteProgress: 0.5,
  },
  {
    id: 'mysterious_trader',
    weight: 5,
    icon: '🎭',
    title: 'Comerciante Misterioso',
    desc: 'Un extraño ofrece intercambiar uno de tus Pokémon por uno más fuerte.',
    minRouteProgress: 0.3,
  },
  {
    id: 'evolution_merchant',
    weight: 4,
    icon: '🧳',
    title: 'Mercader Misterioso',
    desc: 'Un misterioso mercader vende objetos evolutivos.',
    minRouteProgress: 0.2,
  },
  {
    id: 'trap',
    weight: 6,
    icon: '⚠️',
    title: '¡Trampa de Team Rocket!',
    desc: 'Una bomba explota. Tu Pokémon activo pierde 30% HP.',
    minRouteProgress: 0.2,
  },
  {
    id: 'fairy_blessing',
    weight: 5,
    icon: '🧚',
    title: 'Bendición del Hada',
    desc: 'Un hada te bendice. Tu Pokémon activo recupera HP completo.',
    minRouteProgress: 0.1,
  },
  {
    id: 'treasure_chest',
    weight: 4,
    icon: '📦',
    title: 'Cofre del Tesoro',
    desc: 'Encuentras un cofre con una poción y dinero.',
    minRouteProgress: 0.0,
  },
  {
    id: 'mysterious_help',
    weight: 6,
    icon: '🩺',
    title: 'Ayuda Misteriosa',
    desc: 'Una fuerza misteriosa revive a uno de tus Pokémon debilitados.',
    minRouteProgress: 0.0,
  },
  {
    id: 'shiny_spot',
    weight: 2,
    icon: '✨',
    title: 'Zona Brillante',
    desc: 'Un destello brillante te hace sentir que algo especial se acerca.',
    minRouteProgress: 0.4,
  },
]

const THEMES: Array<{ id: string; name: string; desc: string; price: number; colors: Record<string, string> }> = [
  { id: 'dark', name: 'Oscuro (Default)', desc: 'El tema clásico oscuro', price: 0, colors: { bg: '#12122b', surface: '#1c1c3a', border: '#3f3f6e', text: '#f8fafc', accent: '#4d9bff', muted: '#9b98cf' } },
  { id: 'retro', name: 'Retro Game Boy', desc: 'Verde y negro clásico', price: 50, colors: { bg: '#0f380f', surface: '#1a5c1a', border: '#306230', text: '#9bbc0f', accent: '#9bbc0f', muted: '#306230' } },
  { id: 'light', name: 'Claro', desc: 'Tema blanco limpio', price: 40, colors: { bg: '#f1f5f9', surface: '#ffffff', border: '#d9d6f2', text: '#1c1c3a', accent: '#2563eb', muted: '#9b98cf' } },
  { id: 'neon', name: 'Neón Cyberpunk', desc: 'Rosa neón y negro', price: 75, colors: { bg: '#0a0a0f', surface: '#1a1a2e', border: '#e94560', text: '#f3f1ff', accent: '#e94560', muted: '#7c7c9a' } },
  { id: 'crimson', name: 'Carmesí', desc: 'Rojo oscuro y dorado', price: 75, colors: { bg: '#1a0000', surface: '#2d0a0a', border: '#8b0000', text: '#ffd700', accent: '#ff4444', muted: '#8b4513' } },
  { id: 'ocean', name: 'Océano Profundo', desc: 'Azules y turquesa', price: 60, colors: { bg: '#001220', surface: '#001f3f', border: '#0074D9', text: '#f3f1ff', accent: '#7FDBFF', muted: '#39CCCC' } },
  { id: 'forest', name: 'Bosque Encantado', desc: 'Verdes y tierra', price: 60, colors: { bg: '#0d1f0d', surface: '#1a2e1a', border: '#2d5a27', text: '#d4edda', accent: '#28a745', muted: '#6b8e23' } },
]

interface MetaShopItem {
  id: string
  name: string
  desc: string
  price: number
  spriteKey: string
  category: 'consumable' | 'holdable' | 'theme' | 'upgrade' | 'music' | 'pokeball' | 'evolution_stone' | 'evolution_item'
}

const META_SHOP_ITEMS: MetaShopItem[] = [
  { id: 'unlock_hyper_potion', name: 'Hyper Potion', desc: 'Restaura 120 HP. Aparece en tiendas.', price: 30, spriteKey: 'Hyper Potion', category: 'consumable' },
  { id: 'unlock_full_restore', name: 'Full Restore', desc: 'Cura total. Aparece en tiendas.', price: 60, spriteKey: 'Full Restore', category: 'consumable' },
  { id: 'unlock_max_revive', name: 'Max Revive', desc: 'Revive con HP completo.', price: 80, spriteKey: 'Max Revive', category: 'consumable' },
  { id: 'unlock_rare_candy', name: 'Rare Candy', desc: 'Sube 1 nivel. Aparece en drops.', price: 40, spriteKey: 'Rare Candy', category: 'consumable' },
  { id: 'unlock_elixir', name: 'Elixir', desc: 'Restaura 80 HP.', price: 25, spriteKey: 'Elixir', category: 'consumable' },
  { id: 'unlock_super_elixir', name: 'Super Elixir', desc: 'Restaura 200 HP.', price: 50, spriteKey: 'Super Elixir', category: 'consumable' },
  { id: 'unlock_full_elixir', name: 'Full Elixir', desc: 'Restaura todo HP y cura estados.', price: 80, spriteKey: 'Full Elixir', category: 'consumable' },
  { id: 'unlock_x_attack_2', name: 'X Attack 2', desc: '+10 ataque permanente.', price: 45, spriteKey: 'X Attack 2', category: 'consumable' },
  { id: 'unlock_x_defense_2', name: 'X Defense 2', desc: '+10 defensa permanente.', price: 45, spriteKey: 'X Defense 2', category: 'consumable' },
  { id: 'unlock_x_speed_2', name: 'X Speed 2', desc: '+10 velocidad permanente.', price: 45, spriteKey: 'X Speed 2', category: 'consumable' },
  { id: 'unlock_smoke_ball', name: 'Cuerda Huida', desc: 'Escapa de cualquier combate. Aparece en tiendas (25%).', price: 60, spriteKey: 'Cuerda Huida', category: 'consumable' },
  { id: 'unlock_moomoo_milk', name: 'Moomoo Milk', desc: 'Restaura 100 HP. Aparece en tiendas.', price: 30, spriteKey: 'Moomoo Milk', category: 'consumable' },
  { id: 'unlock_berry_juice', name: 'Berry Juice', desc: 'Restaura 20 HP. Aparece en tiendas.', price: 15, spriteKey: 'Berry Juice', category: 'consumable' },
  { id: 'unlock_fresh_water', name: 'Fresh Water', desc: 'Restaura 30 HP. Aparece en tiendas.', price: 20, spriteKey: 'Fresh Water', category: 'consumable' },
  { id: 'unlock_soda_pop', name: 'Soda Pop', desc: 'Restaura 40 HP. Aparece en tiendas.', price: 25, spriteKey: 'Soda Pop', category: 'consumable' },
  { id: 'unlock_lemonade', name: 'Lemonade', desc: 'Restaura 60 HP. Aparece en tiendas.', price: 30, spriteKey: 'Lemonade', category: 'consumable' },
  { id: 'unlock_muscle_band', name: 'Muscle Band', desc: '+15% Ataque.', price: 40, spriteKey: 'Muscle Band', category: 'holdable' },
  { id: 'unlock_wise_glasses', name: 'Wise Glasses', desc: '+15% Velocidad.', price: 40, spriteKey: 'Wise Glasses', category: 'holdable' },
  { id: 'unlock_choice_band', name: 'Choice Band', desc: '+25% Ataque.', price: 70, spriteKey: 'Choice Band', category: 'holdable' },
  { id: 'unlock_leftovers', name: 'Leftovers', desc: 'Recupera 6 HP por turno.', price: 60, spriteKey: 'Leftovers', category: 'holdable' },
  { id: 'unlock_focus_sash', name: 'Focus Sash', desc: '+20 HP máximos.', price: 50, spriteKey: 'Focus Sash', category: 'holdable' },
  { id: 'unlock_assault_vest', name: 'Assault Vest', desc: '+20% Defensa.', price: 60, spriteKey: 'Assault Vest', category: 'holdable' },
  { id: 'unlock_quick_claw', name: 'Quick Claw', desc: '+20% Velocidad.', price: 50, spriteKey: 'Quick Claw', category: 'holdable' },
  { id: 'unlock_eviolite', name: 'Eviolite', desc: '+10% Ataque y Defensa.', price: 40, spriteKey: 'Eviolite', category: 'holdable' },
  { id: 'unlock_life_orb', name: 'Life Orb', desc: '+30% Daño, -5 HP/turno.', price: 100, spriteKey: 'Life Orb', category: 'holdable' },
  { id: 'unlock_rocky_helmet', name: 'Rocky Helmet', desc: '+15% Defensa.', price: 40, spriteKey: 'Rocky Helmet', category: 'holdable' },
  { id: 'unlock_scope_lens', name: 'Scope Lens', desc: '20% Golpe Crítico.', price: 70, spriteKey: 'Scope Lens', category: 'holdable' },
  { id: 'unlock_shell_bell', name: 'Shell Bell', desc: '20% Lifesteal.', price: 90, spriteKey: 'Shell Bell', category: 'holdable' },
  { id: 'unlock_choice_scarf', name: 'Choice Scarf', desc: '+30% Velocidad.', price: 70, spriteKey: 'Choice Scarf', category: 'holdable' },
  { id: 'unlock_babiri_berry', name: 'Babiri Berry', desc: '20% Reducción de Daño.', price: 50, spriteKey: 'Babiri Berry', category: 'holdable' },
  { id: 'unlock_big_root', name: 'Big Root', desc: '25% Lifesteal.', price: 90, spriteKey: 'Big Root', category: 'holdable' },
  { id: 'unlock_wide_lens', name: 'Wide Lens', desc: '15% Crítico, +10% Velocidad.', price: 40, spriteKey: 'Wide Lens', category: 'holdable' },
  { id: 'unlock_sitrus_berry', name: 'Sitrus Berry', desc: '+15 HP máx, +8 HP/turno.', price: 40, spriteKey: 'Sitrus Berry', category: 'holdable' },
  { id: 'unlock_guts_band', name: 'Guts Band', desc: '+20% ATK, +15% bajo 30% HP.', price: 60, spriteKey: 'Guts Band', category: 'holdable' },
  { id: 'unlock_vest_protector', name: 'Vest Protector', desc: '+25% DEF, -15% daño.', price: 80, spriteKey: 'Vest Protector', category: 'holdable' },
  { id: 'unlock_focus_band', name: 'Focus Band', desc: '25% Crítico, +10% ATK.', price: 60, spriteKey: 'Focus Band', category: 'holdable' },
  { id: 'unlock_dragon_fang', name: 'Dragon Fang', desc: '+20% ATK, +10% Velocidad.', price: 70, spriteKey: 'Dragon Fang', category: 'holdable' },
  { id: 'unlock_guardian_charm', name: 'Guardian Charm', desc: '+15% DEF, +10 HP máx.', price: 60, spriteKey: 'Guardian Charm', category: 'holdable' },
  { id: 'unlock_berserker_band', name: 'Berserker Band', desc: '+30% ATK bajo 25% HP.', price: 80, spriteKey: 'Berserker Band', category: 'holdable' },
  { id: 'unlock_phantom_cloak', name: 'Phantom Cloak', desc: '10% Reducción, +10% Vel.', price: 70, spriteKey: 'Phantom Cloak', category: 'holdable' },
  { id: 'unlock_swift_feather', name: 'Swift Feather', desc: '+15% Vel, 10% Crítico.', price: 60, spriteKey: 'Swift Feather', category: 'holdable' },
  { id: 'unlock_iron_ball', name: 'Iron Ball', desc: '+25% DEF, -10% Vel.', price: 50, spriteKey: 'Iron Ball', category: 'holdable' },
  { id: 'unlock_vampire_fang', name: 'Vampire Fang', desc: '15% Lifesteal.', price: 70, spriteKey: 'Vampire Fang', category: 'holdable' },
  { id: 'unlock_cursed_blade', name: 'Cursed Blade', desc: '+35% ATK, -5 HP/turno.', price: 90, spriteKey: 'Cursed Blade', category: 'holdable' },
  { id: 'unlock_mega_node', name: 'Nodo Mega', desc: 'Desbloquea nodos de Mega Piedra en Hard/Infinite.', price: 150, spriteKey: 'Mega Stone', category: 'upgrade' },
  { id: 'unlock_gmax_node', name: 'Nodo G-MAX', desc: 'Desbloquea nodos G-MAX en Hard/Infinite.', price: 200, spriteKey: 'Dynamax Band', category: 'upgrade' },
  { id: 'unlock_quick_ball', name: 'Quick Ball', desc: 'x5 en el primer turno. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Quick Ball', category: 'pokeball' },
  { id: 'unlock_timer_ball', name: 'Timer Ball', desc: 'Mejora con los turnos (hasta x4). Aparece en tiendas y descansos.', price: 35, spriteKey: 'Timer Ball', category: 'pokeball' },
  { id: 'unlock_dusk_ball', name: 'Dusk Ball', desc: 'x3 en oscuridad. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Dusk Ball', category: 'pokeball' },
  { id: 'unlock_net_ball', name: 'Net Ball', desc: 'x3 contra Agua/Bicho. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Net Ball', category: 'pokeball' },
  { id: 'unlock_level_ball', name: 'Level Ball', desc: 'Mejor si tu nivel supera al rival. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Level Ball', category: 'pokeball' },
  { id: 'unlock_repeat_ball', name: 'Repeat Ball', desc: 'x3.5 si ya capturaste esa especie. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Repeat Ball', category: 'pokeball' },
  { id: 'unlock_love_ball', name: 'Love Ball', desc: 'x8 si es misma familia. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Love Ball', category: 'pokeball' },
  { id: 'unlock_friend_ball', name: 'Friend Ball', desc: 'Ratio base x1. Aparece en tiendas y descansos.', price: 30, spriteKey: 'Friend Ball', category: 'pokeball' },
  { id: 'unlock_heavy_ball', name: 'Heavy Ball', desc: 'Mejor contra Pokémon pesados. Aparece en tiendas y descansos.', price: 35, spriteKey: 'Heavy Ball', category: 'pokeball' },
  { id: 'unlock_great_ball', name: 'Great Ball', desc: 'x1.5 de captura. Aparece en tiendas y descansos.', price: 25, spriteKey: 'Great Ball', category: 'pokeball' },
  { id: 'unlock_ultra_ball', name: 'Ultra Ball', desc: 'x2 de captura. Aparece en tiendas y descansos.', price: 50, spriteKey: 'Ultra Ball', category: 'pokeball' },
  { id: 'unlock_master_ball', name: 'Master Ball', desc: 'Captura cualquier Pokémon sin fallo. Aparece raramente en tiendas.', price: 100, spriteKey: 'Master Ball', category: 'pokeball' },
  { id: 'unlock_fire_stone', name: 'Fire Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Fire Stone', category: 'evolution_stone' },
  { id: 'unlock_water_stone', name: 'Water Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Water Stone', category: 'evolution_stone' },
  { id: 'unlock_thunder_stone', name: 'Thunder Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Thunder Stone', category: 'evolution_stone' },
  { id: 'unlock_leaf_stone', name: 'Leaf Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Leaf Stone', category: 'evolution_stone' },
  { id: 'unlock_moon_stone', name: 'Moon Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Moon Stone', category: 'evolution_stone' },
  { id: 'unlock_sun_stone', name: 'Sun Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Sun Stone', category: 'evolution_stone' },
  { id: 'unlock_shiny_stone', name: 'Shiny Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Shiny Stone', category: 'evolution_stone' },
  { id: 'unlock_dusk_stone', name: 'Dusk Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Dusk Stone', category: 'evolution_stone' },
  { id: 'unlock_dawn_stone', name: 'Dawn Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Dawn Stone', category: 'evolution_stone' },
  { id: 'unlock_ice_stone', name: 'Ice Stone', desc: 'Evoluciona a ciertos Pokémon. Aparece en tiendas y Spin.', price: 50, spriteKey: 'Ice Stone', category: 'evolution_stone' },
  { id: 'unlock_metal_coat', name: 'Metal Coat', desc: 'Evoluciona a Steelix y Scizor. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Metal Coat', category: 'evolution_item' },
  { id: 'unlock_kings_rock', name: "King's Rock", desc: 'Evoluciona a Politoed y Slowking. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: "King's Rock", category: 'evolution_item' },
  { id: 'unlock_dragon_scale', name: 'Dragon Scale', desc: 'Evoluciona a Kingdra. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Dragon Scale', category: 'evolution_item' },
  { id: 'unlock_up_grade', name: 'Up-Grade', desc: 'Evoluciona a Porygon2. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Up-Grade', category: 'evolution_item' },
  { id: 'unlock_dubious_disc', name: 'Dubious Disc', desc: 'Evoluciona a Porygon-Z. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Dubious Disc', category: 'evolution_item' },
  { id: 'unlock_reaper_cloth', name: 'Reaper Cloth', desc: 'Evoluciona a Dusknoir. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Reaper Cloth', category: 'evolution_item' },
  { id: 'unlock_protector', name: 'Protector', desc: 'Evoluciona a Rhyperior. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Protector', category: 'evolution_item' },
  { id: 'unlock_electirizer', name: 'Electirizer', desc: 'Evoluciona a Electivire. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Electirizer', category: 'evolution_item' },
  { id: 'unlock_magmarizer', name: 'Magmarizer', desc: 'Evoluciona a Magmortar. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Magmarizer', category: 'evolution_item' },
  { id: 'unlock_prism_scale', name: 'Prism Scale', desc: 'Evoluciona a Milotic. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Prism Scale', category: 'evolution_item' },
  { id: 'unlock_sachet', name: 'Sachet', desc: 'Evoluciona a Aromatisse. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Sachet', category: 'evolution_item' },
  { id: 'unlock_whipped_dream', name: 'Whipped Dream', desc: 'Evoluciona a Slurpuff. Aparece con el Comerciante Misterioso.', price: 40, spriteKey: 'Whipped Dream', category: 'evolution_item' },
  { id: 'unlock_gorra_de_ash', name: 'Gorra de Ash', desc: 'Evoluciona a Greninja en Greninja-Ash. Aparece con el Comerciante Misterioso.', price: 50, spriteKey: 'Gorra de Ash', category: 'evolution_item' },
  { id: 'music_menu_chill', name: 'Menú Relax', desc: 'Música de menú relajante y ambiental.', price: 40, spriteKey: 'Potion', category: 'music' },
  { id: 'music_battle_epic', name: 'Batalla Épica', desc: 'Música de batalla más intensa y rápida.', price: 60, spriteKey: 'Potion', category: 'music' },
]

function fallbackSprite(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  const src = img.src

  if (src.includes('/other/showdown/')) {
    img.src = src
      .replace(/\/other\/showdown\/shiny\/(\d+)\.gif/, '/shiny/$1.png')
      .replace(/\/other\/showdown\/(\d+)\.gif/, '/$1.png')
    img.onerror = null
    return
  }

  if (src.includes('/animated/')) {
    img.src = src
      .replace(/\/animated\/shiny\/(\d+)\.gif/, '/other/showdown/shiny/$1.gif')
      .replace(/\/animated\/(\d+)\.gif/, '/other/showdown/$1.gif')
    return
  }

  img.onerror = null
}

const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030',
  grass: '#78c850', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0',
  ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848',
  steel: '#b8b8d0', fairy: '#ee99ac',
}

// Entrenadores normales (clase + nombre)
const TRAINER_TYPES: Array<{ label: string; name: string; sprite: string }> = [
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
const GYM_LEADERS: Array<{ name: string; badge: string; sprite: string }> = [
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

interface PokedexEntry {
  id: number
  name: string
  sprite: string
  types: string[]
  seen: boolean
  caught: boolean
}

function nodeTypeLabel(node: RouteNode): string {
  switch (node.type) {
    case 'battle':
      return 'Combate'
    case 'rest':
      return 'Descanso'
    case 'shop':
      return 'Tienda'
    case 'boss':
      return 'Jefe'
    case 'teamRocket':
      return 'TeamR'
    case 'spin':
      return 'Spin'
    case 'pokeRand':
      return 'PokeRand'
    case 'move':
      return 'Move'
    case 'mega':
      return 'Mega'
    case 'gmax':
      return 'G-MAX'
    case 'trade':
      return 'Intercambio'
    default:
      return node.type
  }
}

const NODE_EMOJIS: Record<string, string> = {
  battle: '⚔️',
  rest: '🏕️',
  shop: '🏪',
  boss: '👑',
  teamRocket: '®️',
  spin: '🎰',
  pokeRand: '🎲',
  move: '🧬',
  mega: '💎',
  gmax: '⚡',
  trade: '🤝',
}

const NODE_TYPE_COLORS: Record<string, string> = {
  battle: '#7d7ab5',
  rest: '#37d16b',
  shop: '#ffcb05',
  boss: '#ee3b2f',
  teamRocket: '#ee3b2f',
  spin: '#a855f7',
  pokeRand: '#4d9bff',
  move: '#56e0cd',
  mega: '#ff9ad6',
  gmax: '#9da6ff',
  trade: '#37d16b',
}

function getNodeMapLayout(nodeCount: number): { positions: Array<{ x: number; y: number }>; width: number; height: number } {
  const perRow = nodeCount <= 6 ? nodeCount : Math.min(6, Math.max(4, Math.ceil(Math.sqrt(nodeCount * 2.5))))
  const rows = Math.ceil(nodeCount / perRow)
  const spacingX = 150
  const spacingY = 145
  const marginX = 75
  const width = marginX * 2 + (perRow - 1) * spacingX
  const height = 70 + (rows - 1) * spacingY + 90
  const positions: Array<{ x: number; y: number }> = []
  for (let i = 0; i < nodeCount; i++) {
    const row = Math.floor(i / perRow)
    const col = row % 2 === 0 ? i % perRow : perRow - 1 - (i % perRow)
    const rowCount = Math.min(perRow, nodeCount - row * perRow)
    const rowCenteredOffset = (row % 2 === 0 ? 1 : -1) * (perRow - rowCount) * spacingX / 2
    positions.push({ x: marginX + rowCenteredOffset + col * spacingX, y: 70 + row * spacingY })
  }
  return { positions, width, height }
}

function moveTooltip(move: Move): string {
  const accuracy = move.accuracy === null ? 'Siempre acierta' : `${move.accuracy}% precisión`
  let info = `${move.name}\nPotencia: ${move.power}\n${accuracy}`
  if (move.ailment) {
    const chance = move.ailmentChance ? ` (${Math.round(move.ailmentChance * 100)}%)` : ''
    info += `\nEfecto: ${STATUS_LABELS[move.ailment]}${chance}`
  }
  if (move.minHits && move.maxHits) {
    info += `\nGolpes: ${move.minHits}-${move.maxHits}`
  }
  if (move.recoilPercent) {
    info += `\nRecoil: ${Math.round(move.recoilPercent * 100)}%`
  }
  if (move.drainPercent) {
    info += `\nDrena: ${Math.round(move.drainPercent * 100)}% HP`
  }
  if (move.critRatio && move.critRatio > 0) {
    info += `\nAlto ratio de crítico`
  }
  info += `\n${move.description}`
  return info
}

function getStageMultiplier(stage: number): number {
  if (stage > 0) return (2 + stage) / 2
  if (stage < 0) return 2 / (2 - stage)
  return 1
}

function getEffectiveStats(pokemon: Pokemon): { attack: number; defense: number; speed: number; maxHp: number } {
  const item = pokemon.holdItem ? HOLDABLE_ITEMS[pokemon.holdItem] : null
  const stages = pokemon.statStages ?? { attack: 0, defense: 0, speed: 0 }
  const atkStage = getStageMultiplier(stages.attack)
  const defStage = getStageMultiplier(stages.defense)
  const spdStage = getStageMultiplier(stages.speed)
  return {
    attack: Math.round(pokemon.attack * (1 + (item?.attackMod ?? 0)) * atkStage),
    defense: Math.round(pokemon.defense * (1 + (item?.defenseMod ?? 0)) * defStage),
    speed: Math.round(pokemon.speed * (1 + (item?.speedMod ?? 0)) * spdStage),
    maxHp: pokemon.maxHp,
  }
}

function groupInventory(items: string[]): Array<{ name: string; count: number; description: string }> {
  const counts = new Map<string, number>()
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1)
  }

  return [...counts.entries()].map(([name, count]) => ({
    name,
    count,
    description: itemDescriptions[name] ?? 'No effect description available.'
  }))
}

// Reparte los niveles de un equipo de entrenador dentro de los rangos conocidos
// por dificultad, para que no todos los Pokémon tengan el mismo nivel.
// El primer Pokémon (líder) es el más fuerte y el resto baja progresivamente.
function trainerMemberLevelOffset(idx: number, teamSize: number, isBoss: boolean, difficulty: string): number {
  const progress = idx / Math.max(1, teamSize - 1)
  const jitter = Math.floor(Math.random() * 3) - 1 // -1, 0, +1
  if (difficulty === 'infinite') {
    // -1..+3 sobre el nivel máximo del equipo
    return Math.round((1 - progress) * 4) - 1 + jitter
  }
  if (isBoss) {
    // 0..+2 por encima del promedio del equipo
    return Math.round((1 - progress) * 2) + jitter
  }
  // -1..+1 alrededor del promedio del equipo
  return Math.round((1 - progress) * 2) - 1 + jitter
}

interface ProgressionData {
  completedMedium: number[]
  completedAny: number[]
  completedHard: number[]
  completedColiseum: number[]
  completedLeague: number[]
}

interface VictoryUnlocks {
  genName: string
  nextGenNumber: number | null
  nextGenName: string | null
  unlockedHard: boolean
  unlockedInfinite: boolean
}

function getFirstHealthyIndex(team: Pokemon[], currentIndex: number): number {
  return team.findIndex((pokemon, index) => index !== currentIndex && pokemon.hp > 0)
}

function MainApp() {
  const [screen, setScreen] = useState<Screen>('setup')
  const [generation, setGeneration] = useState<number>(1)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [currentRunGen, setCurrentRunGen] = useState<number>(1)
  const [victoryUnlocks, setVictoryUnlocks] = useState<VictoryUnlocks | null>(null)

  const [progression, setProgression] = useState<ProgressionData>(() => {
    try {
      const saved = localStorage.getItem('pokerand_progression')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          completedMedium: Array.isArray(parsed.completedMedium) ? parsed.completedMedium : [],
          completedAny: Array.isArray(parsed.completedAny) ? parsed.completedAny : [],
          completedHard: Array.isArray(parsed.completedHard) ? parsed.completedHard : [],
          completedColiseum: Array.isArray(parsed.completedColiseum) ? parsed.completedColiseum : [],
          completedLeague: Array.isArray(parsed.completedLeague) ? parsed.completedLeague : []
        }
      }
    } catch {
      // fallback
    }
    return { completedMedium: [], completedAny: [], completedHard: [], completedColiseum: [], completedLeague: [] }
  })

  const [team, setTeam] = useState<Pokemon[]>([])
  const [coliseumTempTeam, setColiseumTempTeam] = useState<Pokemon[]>([])
  const [coliseumSeed, setColiseumSeed] = useState(0)
  const [coliseumSearch, setColiseumSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [enemy, setEnemy] = useState<Pokemon | null>(null)
  const [route, setRoute] = useState<RouteNode[]>([])
  const [routeIndex, setRouteIndex] = useState<number>(0)

  // Combate de entrenador
  const [isTrainerBattle, setIsTrainerBattle] = useState<boolean>(false)
  const [trainerTeam, setTrainerTeam] = useState<Pokemon[]>([])
  const [trainerPokemonIndex, setTrainerPokemonIndex] = useState<number>(0)
  const [trainerName, setTrainerName] = useState<string>('')
  const [trainerSprite, setTrainerSprite] = useState<string>('')
  const [trainerBadge, setTrainerBadge] = useState<string>('')

  // Economía y Tienda
  const [money, setMoney] = useState<number>(100)
  const [shopStock, setShopStock] = useState<string[]>([])
  const [shopQty, setShopQty] = useState<Record<string, number>>({})
  const [sellQty, setSellQty] = useState<Record<string, number>>({})

  const [inventory, setInventory] = useState<string[]>([])
  const [modifier, setModifier] = useState<RunModifier | null>(null)
  const [runChallenges, setRunChallenges] = useState<RunChallenges>({
    noShops: false,
    noRests: false,
    allShiny: false,
    allTeamRocket: false,
    nuzlocke: false,
    soloStarter: false,
    fixedTeam: false,
    noEvolution: false,
    noItems: false,
    restrictedMoves: false,
    firstStrike: false,
    fixedLevel: false,
    noCrits: false,
    typeRandomizer: false,
    noPurchasing: false,
    blindRoute: false,
    bossRush: false,
    speedrun: false,
    noMoney: false,
    doubleModifiers: false,
    scalingEnemies: false,
    noHealing: false,
    ironman: false,
    totalRandomizer: false,
    nuzlockeHardcore: false,
    challengeGauntlet: false,
    egglocke: false,
  })
  const [battleLog, setBattleLog] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [apiError, setApiError] = useState<string>('')
  const [restEncounter, setRestEncounter] = useState<Pokemon | null>(null)
  const [restRewardItem, setRestRewardItem] = useState<string>('')
  const [legendaryEncounter, setLegendaryEncounter] = useState<Pokemon | null>(null)

  // Resumen de derrota
  const [defeatSummary, setDefeatSummary] = useState<DefeatSummary | null>(null)

  // Ranking mundial (modo Infinite)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[] | null>(null)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [scoreSubmitState, setScoreSubmitState] = useState<'idle' | 'submitting' | 'submitted' | 'error' | 'disabled' | 'loginRequired'>('idle')
  const [submitIsNewBest, setSubmitIsNewBest] = useState<boolean | null>(null)
  const [showEndRunModal, setShowEndRunModal] = useState(false)
  const [voluntaryRunEnd, setVoluntaryRunEnd] = useState(false)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authUsername, setAuthUsername] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'info' | 'success'; text: string } | null>(null)

  // Modal de selección de objetivo para Revive
  const [reviveModal, setReviveModal] = useState<{ itemName: string; itemIndex: number } | null>(null)
  const [equipModal, setEquipModal] = useState<{ itemName: string; itemIndex: number } | null>(null)
  const [stoneEvoModal, setStoneEvoModal] = useState<{ stoneName: string; stoneIndex: number } | null>(null)
  const [stoneEvoTargets, setStoneEvoTargets] = useState<Pokemon[]>([])
  const [stoneEvoCanEvolve, setStoneEvoCanEvolve] = useState<Set<number>>(new Set())

  // Captura de Pokémon salvaje
  const [captureModal, setCaptureModal] = useState(false)
  const [captureMessage, setCaptureMessage] = useState<string | null>(null)
  const [evoPopup, setEvoPopup] = useState<{ oldSprite: string; newSprite: string; oldName: string; newName: string } | null>(null)
  const [leagueOffer, setLeagueOffer] = useState(false)
  const [leagueTeamSelection, setLeagueTeamSelection] = useState(false)
  const [tempLeagueTeam, setTempLeagueTeam] = useState<Pokemon[]>([])
  const [battleTurns, setBattleTurns] = useState(0)
  const [enemyHitFlash, setEnemyHitFlash] = useState(false)

  const battleStartHPRef = useRef<number>(0)

  // Team Rocket
  const [isTeamRocketBattle, setIsTeamRocketBattle] = useState<boolean>(false)
  const [teamRocketFainted, setTeamRocketFainted] = useState<boolean>(false)
  const [teamRocketTeam, setTeamRocketTeam] = useState<Pokemon[]>([])
  const [teamRocketStealMessage, setTeamRocketStealMessage] = useState<string>('')
  const [teamRocketPickModal, setTeamRocketPickModal] = useState<boolean>(false)

  // Spin (Ruleta)
  const [spinItems, setSpinItems] = useState<string[]>([])
  const [spinAnimating, setSpinAnimating] = useState<boolean>(false)
  const [spinWinnerIndex, setSpinWinnerIndex] = useState<number | null>(null)
  const [spinRevealed, setSpinRevealed] = useState<boolean>(false)

  // PokeRand (Ruleta de Pokémon)
  const [pokeRandPokemon, setPokeRandPokemon] = useState<Pokemon[]>([])
  const [pokeRandAnimating, setPokeRandAnimating] = useState<boolean>(false)
  const [pokeRandWinnerIndex, setPokeRandWinnerIndex] = useState<number | null>(null)
  const [pokeRandRevealed, setPokeRandRevealed] = useState<boolean>(false)

  // Move node (intercambio de movimientos)
  const [moveOptions, setMoveOptions] = useState<Move[]>([])
  const [selectedNewMove, setSelectedNewMove] = useState<Move | null>(null)
  const [moveOptionsByIndex, setMoveOptionsByIndex] = useState<Record<number, Move[]>>({})

  // Egglocke
  const [eggInventory, setEggInventory] = useState<Array<{ name: string; sprite: string; types: string[]; hatchIn: number; id: number }>>([])

  const [pcStorage, setPcStorage] = useState<Pokemon[]>([])
  const [modifier2, setModifier2] = useState<RunModifier | null>(null)
  const [gauntletKeys, setGauntletKeys] = useState<Array<keyof RunChallenges>>([])

  // Speedrun timer
  const [speedrunSeconds, setSpeedrunSeconds] = useState<number>(0)
  const speedrunTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const megaNodeSpawnedRef = useRef(false)
  const [battleMegaUsed, setBattleMegaUsed] = useState(false)
  const [battleGmaxUsed, setBattleGmaxUsed] = useState(false)
  const originalPokemonDataRef = useRef<Record<number, { sprite: string; attack: number; defense: number; speed: number }>>({})

  const runStartTimeRef = useRef<number>(0)
  const pendingScoreRef = useRef<InfiniteScoreInsert | null>(null)
  const showLeaderboardRef = useRef(false)
  const routeMapRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => { showLeaderboardRef.current = showLeaderboard }, [showLeaderboard])
  useEffect(() => {
    if (difficulty === 'infinite' && routeMapRef.current) {
      routeMapRef.current.scrollTop = routeMapRef.current.scrollHeight
    }
  }, [routeIndex, difficulty])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pokerand_pending_score')
      if (raw) {
        const parsed = JSON.parse(raw) as InfiniteScoreInsert & { route?: number }
        if (parsed.node === undefined && typeof parsed.route === 'number') parsed.node = parsed.route
        pendingScoreRef.current = parsed
      }
    } catch {
      pendingScoreRef.current = null
    }
  }, [])

  // Pokédex
  const [showPokedex, setShowPokedex] = useState<boolean>(false)
  const [pokedexSearch, setPokedexSearch] = useState<string>('')
  const [selectedPokemonDetail, setSelectedPokemonDetail] = useState<PokemonDetails | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false)

  // Opciones / Volumen
  const [showOptions, setShowOptions] = useState<boolean>(false)
  const optionsBeganInBattle = useRef(false)
  const [volume, setVolumeState] = useState<number>(() => Math.round(getVolume() * 100))
  const [sfxVol, setSfxVolState] = useState<number>(() => Math.round(getSfxVolume() * 100))
  const [musicMuted, setMusicMutedState] = useState<boolean>(() => isMusicMuted())

  const [pokedex, setPokedex] = useState<Record<number, PokedexEntry>>(() => {
    try {
      const saved = localStorage.getItem('pokerand_pokedex')
      if (!saved) return {}
      const parsed = JSON.parse(saved)
      const migrated: Record<number, PokedexEntry> = {}
      for (const [key, val] of Object.entries(parsed) as [string, any][]) {
        const id = Number(key)
        let name: string = val.name ?? ''
        if (name.startsWith('legendary-')) {
          name = name.replace('legendary-', '')
        }
        migrated[id] = {
          ...val,
          name,
          seen: val.seen ?? true,
          caught: val.caught ?? true
        }
      }
      return migrated
    } catch {
      return {}
    }
  })

  const [record, setRecord] = useState(() => {
    const wins = Number(localStorage.getItem('pokerand_wins') ?? '0')
    const losses = Number(localStorage.getItem('pokerand_losses') ?? '0')
    return { wins, losses }
  })

  const [winStreak, setWinStreak] = useState<number>(() => Number(localStorage.getItem('pokerand_streak') ?? '0'))
  const [bestStreak, setBestStreak] = useState<number>(() => Number(localStorage.getItem('pokerand_best_streak') ?? '0'))
  const [runStats, setRunStats] = useState<RunStats>({
    battlesWon: 0, battlesLost: 0, totalDamageDealt: 0, totalDamageTaken: 0,
    critsLanded: 0, superEffectiveHits: 0, koFirstTurn: 0, captures: 0,
    itemsUsed: 0, moneySpent: 0, moneyEarned: 0, nodesCleared: 0,
    teamSizeMax: 1, lowestHPEver: 999, totalTurns: 0, pokemonUsed: [],
    challengesActive: [], evolutions: 0
  })
  const [achievements, setAchievements] = useState<AchievementState>(() => {
    try {
      const saved = localStorage.getItem('pokerand_achievements')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [metaProgression, setMetaProgression] = useState<MetaProgression>(() => {
    try {
      const saved = localStorage.getItem('pokerand_meta')
      if (saved) {
        const data = JSON.parse(saved) as MetaProgression
        if (!data.ownedMusic) data.ownedMusic = []
        if (!data.activeMenuMusic) data.activeMenuMusic = 'default'
        if (!data.activeBattleMusic) data.activeBattleMusic = 'default'
        if (typeof data.totalMegas !== 'number') data.totalMegas = 0
        if (typeof data.totalGmax !== 'number') data.totalGmax = 0
        return data
      }
    } catch {}
    return { pokeCoins: 0, totalRuns: 0, totalWins: 0, bestStreak: 0, unlockedStarters: [], permanentlyUnlockedItems: [], ownedThemes: ['dark'], activeTheme: 'dark', ownedMusic: [], activeMenuMusic: 'default', activeBattleMusic: 'default', totalMegas: 0, totalGmax: 0 }
  })
  const [showAchievements, setShowAchievements] = useState<boolean>(false)
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null)
  const [shinyNextEncounter, setShinyNextEncounter] = useState<boolean>(false)
  const dailySeed = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  })()
  const dailySeedRef = useRef(dailySeed)
  const [dailyPlayed, setDailyPlayed] = useState<boolean>(() => {
    try { return localStorage.getItem('pokerand_daily') === dailySeedRef.current } catch { return false }
  })
  const isDailyRunRef = useRef(false)

  // --- Modo cooperativo ---
  const [coopMode, setCoopMode] = useState<boolean>(false)
  const coopModeRef = useRef(false)
  const [coopSessionCode, setCoopSessionCode] = useState<string>('')
  const coopSessionCodeRef = useRef('')
  const [coopSeed, setCoopSeed] = useState<string>('')
  const coopSeedRef = useRef('')
  const [coopMyRole, setCoopMyRole] = useState<'a' | 'b' | null>(null)
  const coopMyRoleRef = useRef<'a' | 'b' | null>(null)
  const [coopGen, setCoopGen] = useState<number>(1)
  const coopGenRef = useRef(1)
  const [coopDiff, setCoopDiff] = useState<'easy' | 'medium' | 'hard'>('medium')
  const coopDiffRef = useRef<'easy' | 'medium' | 'hard'>('medium')
  const [coopPartnerJoined, setCoopPartnerJoined] = useState<boolean>(false)
  const [coopJoinCode, setCoopJoinCode] = useState<string>('')
  const [coopWaiting, setCoopWaiting] = useState<boolean>(false)
  const [coopStarting, setCoopStarting] = useState<boolean>(false)
  const coopAutoStartedRef = useRef(false)
  const [coopWaitingNode, setCoopWaitingNode] = useState<number>(0)
  const [coopSessionEndedMsg, setCoopSessionEndedMsg] = useState<string>('')
  const [coopMyOffer, setCoopMyOffer] = useState<CoopTrade['offer'] | null>(null)
  const [coopMyOfferSubmitted, setCoopMyOfferSubmitted] = useState<boolean>(false)
  const coopSubmittedOfferRef = useRef<CoopTrade['offer'] | null>(null)
  const coopExchangeAppliedRef = useRef(false)
  const [coopExchange, setCoopExchange] = useState<CoopExchange | null>(null)
  const [coopTradeMsg, setCoopTradeMsg] = useState<string>('')
  const [coopError, setCoopError] = useState<string>('')

  useEffect(() => { coopModeRef.current = coopMode }, [coopMode])
  useEffect(() => { coopSessionCodeRef.current = coopSessionCode }, [coopSessionCode])
  useEffect(() => { coopSeedRef.current = coopSeed }, [coopSeed])
  useEffect(() => { coopMyRoleRef.current = coopMyRole }, [coopMyRole])
  useEffect(() => { coopGenRef.current = coopGen }, [coopGen])
  useEffect(() => { coopDiffRef.current = coopDiff }, [coopDiff])

  const [activeRandomEvent, setActiveRandomEvent] = useState<{ id: string; icon: string; title: string; desc: string } | null>(null)
  const routeSeedRef = useRef('')
  const routeRandRef = useRef<() => number>(() => Math.random())
  const teamRef = useRef<Pokemon[]>([])
  useEffect(() => { teamRef.current = team }, [team])
  const [traderModal, setTraderModal] = useState<boolean>(false)
  const [merchantItems, setMerchantItems] = useState<Array<{ name: string; price: number }> | null>(null)
  const [randomEventUsed, setRandomEventUsed] = useState<Set<string>>(new Set())
  const [showMetaShop, setShowMetaShop] = useState<boolean>(false)
  const [unlockPopup, setUnlockPopup] = useState<{ name: string; spriteKey: string } | null>(null)
  const [badges, setBadges] = useState<Array<{ id: string; name: string; sprite: string }>>([])
  const [currentStage, setCurrentStage] = useState<number>(1)

  const currentNode = useMemo(() => route[routeIndex] ?? null, [route, routeIndex])
  const activePokemon = useMemo(() => team[activeIndex] ?? null, [team, activeIndex])
  const inventoryEntries = useMemo(() => groupInventory(inventory), [inventory])

  useEffect(() => { startMenuMusic() }, [])

  // Restaurar sesión de Supabase y reaccionar a cambios de login/logout
  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null
    void getCurrentUser().then((user) => {
      if (!cancelled) setAuthUser(user)
    })
    void onAuthChange((user) => {
      if (cancelled) return
      setAuthUser(user)
      if (user) void submitPendingScore()
    }).then((cleanup) => {
      if (cancelled) cleanup()
      else unsubscribe = cleanup
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset mega/gmax state when battle ends
  useEffect(() => {
    if (screen === 'defeat' || screen === 'victory') {
      const capturedOrigData = { ...originalPokemonDataRef.current }
      originalPokemonDataRef.current = {}
      setTeam(prev => prev.map((p, i) => {
        const reset = { statStages: { attack: 0, defense: 0, speed: 0 }, furiaActive: false }
        const orig = capturedOrigData[i]
        if (orig) return { ...p, megaEvolved: false, gmaxEvolved: false, gmaxTurnsLeft: undefined, ...orig, ...reset }
        return { ...p, megaEvolved: false, gmaxEvolved: false, gmaxTurnsLeft: undefined, ...reset }
      }))
      setBattleMegaUsed(false)
      setBattleGmaxUsed(false)
    }
  }, [screen])

  // Speedrun: auto-defeat when timer reaches 0
  useEffect(() => {
    if (runChallenges.speedrun && speedrunSeconds === 0 && screen === 'battle') {
      if (speedrunTimerRef.current) {
        clearInterval(speedrunTimerRef.current)
        speedrunTimerRef.current = null
      }
      const fullLogs = ['⏱️ ¡Tiempo agotado! Has perdido por Speedrun.', ...battleLog]
      setBattleLog(fullLogs)
      setDefeatSummary({
        finalTeam: team,
        battleLog: fullLogs,
        enemy: enemy,
        lastNodeLabel: currentNode?.label
      })
      handleInfiniteRunDefeat(team)
      const losses = record.losses + 1
      persistRecord(record.wins, losses)
      if (isDailyRunRef.current) {
        setDailyPlayed(true)
        localStorage.setItem('pokerand_daily', dailySeed)
      }
      setScreen('defeat')
      playDefeatMusic()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedrunSeconds])

  useEffect(() => {
    const theme = THEMES.find(t => t.id === metaProgression.activeTheme) ?? THEMES[0]
    const root = document.documentElement
    if (theme.id === 'dark') {
      root.style.removeProperty('--surface')
      root.style.removeProperty('--border')
      root.style.removeProperty('--text')
      root.style.removeProperty('--accent')
      root.style.removeProperty('--muted')
    } else {
      root.style.setProperty('--surface', theme.colors.surface)
      root.style.setProperty('--border', theme.colors.border)
      root.style.setProperty('--text', theme.colors.text)
      root.style.setProperty('--accent', theme.colors.accent)
      root.style.removeProperty('--muted')
      root.style.setProperty('--muted', theme.colors.muted)
    }
    document.body.style.color = theme.colors.text
  }, [metaProgression.activeTheme])

  function buyMetaItem(item: MetaShopItem): void {
    if (metaProgression.pokeCoins < item.price) return
    if (item.category === 'theme') {
      if (metaProgression.ownedThemes.includes(item.id)) return
      const updated = { ...metaProgression, pokeCoins: metaProgression.pokeCoins - item.price, ownedThemes: [...metaProgression.ownedThemes, item.id] }
      setMetaProgression(updated)
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      setUnlockPopup({ name: item.name, spriteKey: 'Potion' })
      setTimeout(() => setUnlockPopup(null), 3000)
      return
    }
    if (item.category === 'music') {
      if (metaProgression.ownedMusic.includes(item.id)) return
      const updated = { ...metaProgression, pokeCoins: metaProgression.pokeCoins - item.price, ownedMusic: [...metaProgression.ownedMusic, item.id] }
      setMetaProgression(updated)
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      setUnlockPopup({ name: item.name, spriteKey: 'Potion' })
      setTimeout(() => setUnlockPopup(null), 3000)
      return
    }
    if (metaProgression.permanentlyUnlockedItems.includes(item.id)) return
    const updated = { ...metaProgression, pokeCoins: metaProgression.pokeCoins - item.price, permanentlyUnlockedItems: [...metaProgression.permanentlyUnlockedItems, item.id] }
    setMetaProgression(updated)
    localStorage.setItem('pokerand_meta', JSON.stringify(updated))
    setUnlockPopup({ name: item.name, spriteKey: 'spriteKey' in item ? (item as MetaShopItem).spriteKey : 'Potion' })
    setTimeout(() => setUnlockPopup(null), 3000)
  }

  function setTheme(themeId: string): void {
    if (!metaProgression.ownedThemes.includes(themeId)) return
    const updated = { ...metaProgression, activeTheme: themeId }
    setMetaProgression(updated)
    localStorage.setItem('pokerand_meta', JSON.stringify(updated))
  }

  const LOCKED_CONSUMABLE_MAP: Record<string, string> = {
    unlock_hyper_potion: 'Hyper Potion',
    unlock_full_restore: 'Full Restore',
    unlock_max_revive: 'Max Revive',
    unlock_rare_candy: 'Rare Candy',
    unlock_elixir: 'Elixir',
    unlock_super_elixir: 'Super Elixir',
    unlock_full_elixir: 'Full Elixir',
    unlock_x_attack_2: 'X Attack 2',
    unlock_x_defense_2: 'X Defense 2',
    unlock_x_speed_2: 'X Speed 2',
    unlock_smoke_ball: 'Cuerda Huida',
    unlock_moomoo_milk: 'Moomoo Milk',
    unlock_berry_juice: 'Berry Juice',
    unlock_fresh_water: 'Fresh Water',
    unlock_soda_pop: 'Soda Pop',
    unlock_lemonade: 'Lemonade',
  }
  const LOCKED_HOLDABLE_MAP: Record<string, string> = {
    unlock_muscle_band: 'Muscle Band',
    unlock_wise_glasses: 'Wise Glasses',
    unlock_choice_band: 'Choice Band',
    unlock_leftovers: 'Leftovers',
    unlock_focus_sash: 'Focus Sash',
    unlock_assault_vest: 'Assault Vest',
    unlock_quick_claw: 'Quick Claw',
    unlock_eviolite: 'Eviolite',
    unlock_life_orb: 'Life Orb',
    unlock_rocky_helmet: 'Rocky Helmet',
    unlock_scope_lens: 'Scope Lens',
    unlock_shell_bell: 'Shell Bell',
    unlock_choice_scarf: 'Choice Scarf',
    unlock_babiri_berry: 'Babiri Berry',
    unlock_big_root: 'Big Root',
    unlock_wide_lens: 'Wide Lens',
    unlock_sitrus_berry: 'Sitrus Berry',
    unlock_guts_band: 'Guts Band',
    unlock_vest_protector: 'Vest Protector',
    unlock_focus_band: 'Focus Band',
    unlock_dragon_fang: 'Dragon Fang',
    unlock_guardian_charm: 'Guardian Charm',
    unlock_berserker_band: 'Berserker Band',
    unlock_phantom_cloak: 'Phantom Cloak',
    unlock_swift_feather: 'Swift Feather',
    unlock_iron_ball: 'Iron Ball',
    unlock_vampire_fang: 'Vampire Fang',
    unlock_cursed_blade: 'Cursed Blade',
  }
  const LOCKED_POKEBALL_MAP: Record<string, string> = {}
  for (const [ballName, unlockId] of Object.entries(POKEBALL_UNLOCK_IDS)) {
    LOCKED_POKEBALL_MAP[unlockId] = ballName
  }
  const LOCKED_EVOLUTION_STONE_MAP: Record<string, string> = {}
  for (const [stoneName, unlockId] of Object.entries(EVOLUTION_STONE_UNLOCK_IDS)) {
    LOCKED_EVOLUTION_STONE_MAP[unlockId] = stoneName
  }

  const isConsumableUnlocked = (name: string) => !Object.values(LOCKED_CONSUMABLE_MAP).includes(name) || metaProgression.permanentlyUnlockedItems.some(k => LOCKED_CONSUMABLE_MAP[k] === name)
  const isHoldableUnlocked = (name: string) => !Object.values(LOCKED_HOLDABLE_MAP).includes(name) || metaProgression.permanentlyUnlockedItems.some(k => LOCKED_HOLDABLE_MAP[k] === name)
  const isPokeballUnlocked = (name: string) => name === 'Poké Ball' || !POKEBALL_UNLOCK_IDS[name] || metaProgression.permanentlyUnlockedItems.some(k => LOCKED_POKEBALL_MAP[k] === name)
  const isEvolutionStoneUnlocked = (name: string) => !EVOLUTION_STONE_UNLOCK_IDS[name] || metaProgression.permanentlyUnlockedItems.some(k => LOCKED_EVOLUTION_STONE_MAP[k] === name)

  function isGenUnlocked(gen: number): boolean {
    if (gen === 1) return true
    if (gen === 0) {
      return generations.every((g) => progression.completedMedium.includes(g))
    }
    return progression.completedMedium.includes(gen - 1)
  }

  function isHardUnlocked(gen: number): boolean {
    if (gen === 0) {
      return isGenUnlocked(0) && progression.completedAny.length > 0
    }
    return progression.completedAny.includes(gen)
  }

  function isInfiniteUnlocked(gen: number): boolean {
    return progression.completedHard.includes(gen)
  }

  function isColiseumUnlocked(): boolean {
    return generations.every(g => progression.completedMedium.includes(g))
  }

  function handleSelectGeneration(gen: number) {
    if (!isGenUnlocked(gen)) return
    setGeneration(gen)
    if (difficulty === 'hard' && !isHardUnlocked(gen)) {
      setDifficulty('medium')
    }
    if (difficulty === 'infinite' && !isInfiniteUnlocked(gen)) {
      setDifficulty('medium')
    }
    const challengesLocked = gen === 0
      ? !generations.every((g) => progression.completedMedium.includes(g))
      : !progression.completedMedium.includes(gen)
    if (challengesLocked && (runChallenges.noShops || runChallenges.noRests || runChallenges.allShiny || runChallenges.allTeamRocket || runChallenges.nuzlocke || runChallenges.soloStarter || runChallenges.fixedTeam || runChallenges.noEvolution || runChallenges.noItems || runChallenges.restrictedMoves || runChallenges.firstStrike || runChallenges.fixedLevel || runChallenges.noCrits || runChallenges.typeRandomizer || runChallenges.noPurchasing || runChallenges.blindRoute || runChallenges.bossRush || runChallenges.speedrun || runChallenges.noMoney || runChallenges.doubleModifiers || runChallenges.scalingEnemies || runChallenges.noHealing || runChallenges.ironman || runChallenges.totalRandomizer || runChallenges.nuzlockeHardcore || runChallenges.challengeGauntlet || runChallenges.egglocke)) {
      setRunChallenges({ noShops: false, noRests: false, allShiny: false, allTeamRocket: false, nuzlocke: false, soloStarter: false, fixedTeam: false, noEvolution: false, noItems: false, restrictedMoves: false, firstStrike: false, fixedLevel: false, noCrits: false, typeRandomizer: false, noPurchasing: false, blindRoute: false, bossRush: false, speedrun: false, noMoney: false, doubleModifiers: false, scalingEnemies: false, noHealing: false, ironman: false, totalRandomizer: false, nuzlockeHardcore: false, challengeGauntlet: false, egglocke: false })
    }
  }

  function handleSelectDifficulty(diff: Difficulty) {
    if (diff === 'hard' && !isHardUnlocked(generation)) return
    if (diff === 'infinite' && !isInfiniteUnlocked(generation)) return
    if (diff === 'coliseum' && !isColiseumUnlocked()) return
    setDifficulty(diff)
  }

  function getEffectiveGen(): number {
    if (isDailyRunRef.current) return currentRunGen
    if (generation === 0) {
      const unlockedGens = generations.filter((g) => isGenUnlocked(g))
      if (unlockedGens.length === 0) return 1
      return unlockedGens[Math.floor(Math.random() * unlockedGens.length)]
    }
    return generation
  }

  function getMaxTeamLevel(): number {
    return team.reduce((max, p) => Math.max(max, p.level), 0)
  }

  async function handleSelectPokedexPokemon(id: number) {
    setIsLoadingDetail(true)
    try {
      const details = await fetchPokemonDetails(id)
      setSelectedPokemonDetail(details)
    } catch {
      setApiError('No se pudieron obtener los detalles del Pokémon.')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  function registerInPokedex(pokemon: Pokemon): void {
    setPokedex((prev) => {
      let pokemonId = Number(pokemon.id)

      if (isNaN(pokemonId) && pokemon.sprite) {
        const match = pokemon.sprite.match(/\/(\d+)\.(png|gif)/)
        if (match) {
          pokemonId = parseInt(match[1], 10)
        }
      }

      if (isNaN(pokemonId) || !pokemonId) return prev
      if (prev[pokemonId]?.caught) return prev

      const updated: Record<number, PokedexEntry> = {
        ...prev,
        [pokemonId]: {
          id: pokemonId,
          name: pokemon.name,
          sprite: pokemon.sprite,
          types: (pokemon as any).types ?? [],
          seen: true,
          caught: true
        }
      }
      localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
      return updated
    })
  }

  function seenInPokedex(pokemon: Pokemon): void {
    setPokedex((prev) => {
      let pokemonId = Number(pokemon.id)

      if (isNaN(pokemonId) && pokemon.sprite) {
        const match = pokemon.sprite.match(/\/(\d+)\.(png|gif)/)
        if (match) {
          pokemonId = parseInt(match[1], 10)
        }
      }

      if (isNaN(pokemonId) || !pokemonId) return prev
      if (prev[pokemonId]) return prev

      const updated: Record<number, PokedexEntry> = {
        ...prev,
        [pokemonId]: {
          id: pokemonId,
          name: pokemon.name,
          sprite: pokemon.sprite,
          types: (pokemon as any).types ?? [],
          seen: true,
          caught: false
        }
      }
      localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
      return updated
    })
  }

  function persistRecord(nextWins: number, nextLosses: number): void {
    localStorage.setItem('pokerand_wins', String(nextWins))
    localStorage.setItem('pokerand_losses', String(nextLosses))
    setRecord({ wins: nextWins, losses: nextLosses })
  }

  function unlockAchievement(id: string): void {
    setAchievements(prev => {
      if (prev[id]?.unlocked) return prev
      const updated = { ...prev, [id]: { unlocked: true, date: new Date().toISOString() } }
      localStorage.setItem('pokerand_achievements', JSON.stringify(updated))
      const achievement = ACHIEVEMENTS.find(a => a.id === id)
      if (achievement) setNewAchievement(achievement)
      return updated
    })
  }

  useEffect(() => {
    if (runStats.captures >= 10) unlockAchievement('collector_10')
    if (runStats.captures >= 25) unlockAchievement('collector_25')
    if (runStats.captures >= 50) unlockAchievement('collector_50')
    if (runStats.moneyEarned >= 999) unlockAchievement('rich')
    if (runStats.moneyEarned >= 5000) unlockAchievement('rich_5000')
    if (runStats.moneyEarned >= 10000) unlockAchievement('rich_10000')
    if (runStats.moneyEarned >= 50000) unlockAchievement('rich_50000')
    if (runStats.critsLanded >= 5) unlockAchievement('crit_master')
    if (runStats.critsLanded >= 10) unlockAchievement('crit_10')
    if (runStats.critsLanded >= 20) unlockAchievement('crit_20')
    if (runStats.critsLanded >= 50) unlockAchievement('crit_50')
    if (runStats.koFirstTurn >= 1) unlockAchievement('one_shot')
    if (runStats.koFirstTurn >= 5) unlockAchievement('one_shot_5')
    if (runStats.koFirstTurn >= 10) unlockAchievement('one_shot_10')
    if (runStats.superEffectiveHits >= 10) unlockAchievement('super_effective_10')
    if (runStats.superEffectiveHits >= 25) unlockAchievement('super_effective_25')
    if (runStats.superEffectiveHits >= 50) unlockAchievement('super_effective_50')
    if (runStats.superEffectiveHits >= 100) unlockAchievement('super_effective_100')
    if (runStats.moneySpent >= 500) unlockAchievement('big_spender')
    if (runStats.moneySpent >= 1000) unlockAchievement('spender_1000')
    if (runStats.moneySpent >= 5000) unlockAchievement('spender_5000')
    if (runStats.battlesWon >= 20) unlockAchievement('battle_20')
    if (runStats.battlesWon >= 50) unlockAchievement('battle_50')
    if (runStats.battlesWon >= 100) unlockAchievement('battle_100')
    if (runStats.battlesWon >= 200) unlockAchievement('battle_200')
    if (runStats.battlesWon >= 500) unlockAchievement('battle_500')
    if (runStats.itemsUsed >= 10) unlockAchievement('item_user_10')
    if (runStats.itemsUsed >= 25) unlockAchievement('item_user_25')
    if (runStats.itemsUsed >= 50) unlockAchievement('item_user_50')
    if (runStats.totalDamageDealt >= 1000) unlockAchievement('damage_1000')
    if (runStats.totalDamageDealt >= 5000) unlockAchievement('damage_5000')
    if (runStats.totalDamageDealt >= 10000) unlockAchievement('damage_10000')
    if (runStats.totalDamageDealt >= 50000) unlockAchievement('damage_50000')
    if (runStats.totalDamageTaken >= 500) unlockAchievement('tank_500')
    if (runStats.totalDamageTaken >= 1000) unlockAchievement('tank_1000')
    if (runStats.nodesCleared >= 30) unlockAchievement('nodes_30')
    if (runStats.nodesCleared >= 50) unlockAchievement('nodes_50')
    if (runStats.nodesCleared >= 100) unlockAchievement('nodes_100')
    if (runStats.totalTurns >= 500) unlockAchievement('total_turns_500')
    if (runStats.totalTurns >= 1000) unlockAchievement('total_turns_1000')
    if (runStats.pokemonUsed.length >= 10) unlockAchievement('team_diversity_10')
    if (runStats.pokemonUsed.length >= 20) unlockAchievement('team_diversity_20')
    if (runStats.evolutions >= 5) unlockAchievement('evolution_master')
    if (runStats.lowestHPEver > 0 && team.some(p => p.hp > 0 && p.hp <= p.maxHp * 0.1)) unlockAchievement('comeback')
    if (runStats.lowestHPEver === 1) unlockAchievement('back_from_brink')
    if (metaProgression.pokeCoins >= 100) unlockAchievement('meta_100')
    if (metaProgression.pokeCoins >= 500) unlockAchievement('meta_500')
    if (metaProgression.pokeCoins >= 1000) unlockAchievement('meta_1000')
    if (metaProgression.pokeCoins >= 5000) unlockAchievement('meta_5000')
  }, [runStats, team, metaProgression.pokeCoins])

  useEffect(() => {
    if (team.length >= 6) unlockAchievement('full_team')
  }, [team])

  useEffect(() => {
    if (inventory.length >= 15) unlockAchievement('hoarder_15')
  }, [inventory])

  useEffect(() => {
    if (metaProgression.totalWins >= 5) unlockAchievement('total_wins_5')
    if (metaProgression.totalWins >= 10) unlockAchievement('total_wins_10')
    if (metaProgression.totalWins >= 25) unlockAchievement('total_wins_25')
    if (metaProgression.totalWins >= 50) unlockAchievement('total_wins_50')
    if (metaProgression.totalRuns >= 10) unlockAchievement('total_runs_10')
    if (metaProgression.totalRuns >= 25) unlockAchievement('total_runs_25')
    if (metaProgression.totalRuns >= 50) unlockAchievement('total_runs_50')
  }, [metaProgression.totalWins, metaProgression.totalRuns])

  useEffect(() => {
    if (metaProgression.totalMegas >= 10) unlockAchievement('mega_master')
  }, [metaProgression.totalMegas])

  useEffect(() => {
    if (metaProgression.totalGmax >= 10) unlockAchievement('gmax_master')
  }, [metaProgression.totalGmax])

  useEffect(() => {
    if (winStreak >= 3) unlockAchievement('streak_3')
    if (winStreak >= 5) unlockAchievement('streak_5')
    if (winStreak >= 10) unlockAchievement('streak_10')
    if (winStreak >= 15) unlockAchievement('streak_15')
    if (winStreak >= 20) unlockAchievement('streak_20')
    if (winStreak >= 25) unlockAchievement('streak_25')
  }, [winStreak])

  useEffect(() => {
    const legendaryIds = Object.entries(pokedex).filter(([,e]) => e.name.startsWith('legendary-')).map(([id]) => Number(id))
    if (legendaryIds.length === 0) return
    legendaryIds.forEach(id => {
      fetchPokemonDetails(id).then(details => {
        setPokedex(prev => {
          if (!prev[id]?.name.startsWith('legendary-')) return prev
          const updated = { ...prev, [id]: { ...prev[id], name: details.name } }
          localStorage.setItem('pokerand_pokedex', JSON.stringify(updated))
          return updated
        })
      }).catch(() => {})
    })
  }, [pokedex])

  function awardPokeCoins(amount: number, reason: string): void {
    setMetaProgression(prev => {
      const updated = { ...prev, pokeCoins: prev.pokeCoins + amount }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
    setBattleLog(prev => [`🪙 +${amount} PokéCoins (${reason})`, ...prev])
  }

  function triggerRandomEvent(routeProgress: number): void {
    if (Math.random() > 0.25) return
    const eligible = RANDOM_EVENTS.filter(e => routeProgress >= e.minRouteProgress && !randomEventUsed.has(e.id))
    if (eligible.length === 0) return
    const totalWeight = eligible.reduce((s, e) => s + e.weight, 0)
    let roll = Math.random() * totalWeight
    for (const event of eligible) {
      roll -= event.weight
      if (roll <= 0) {
        setActiveRandomEvent({ id: event.id, icon: event.icon, title: event.title, desc: event.desc })
        setRandomEventUsed(prev => new Set(prev).add(event.id))
        return
      }
    }
  }

  async function handleRandomEventChoice(): Promise<void> {
    if (!activeRandomEvent) return
    const event = activeRandomEvent
    setActiveRandomEvent(null)
    const current = team[activeIndex]
    if (!current) return

    switch (event.id) {
      case 'legendary_appears': {
        const legendaryIds = [144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,480,481,482,483,484,485,486,487,488,491,492,493,494,638,639,640,641,642,643,644,645,646,647,648,649]
        const id = legendaryIds[Math.floor(Math.random() * legendaryIds.length)]
        const legendaryLevel = difficulty === 'infinite'
          ? getMaxTeamLevel() + (Math.floor(Math.random() * 3) - 1)
          : current.level + 5
        const legendaryData = await buildPokemonFromApi(id, 1, legendaryLevel)
        const legendary: Pokemon = {
          ...legendaryData,
          level: current.level + 5,
          hp: current.maxHp + 40,
          maxHp: current.maxHp + 40,
          attack: current.attack + 20,
          defense: current.defense + 10,
          speed: current.speed + 10,
        }
        setTeam(prev => prev.map(p => p.hp <= 0 ? p : { ...p, hp: p.maxHp }))
        setBattleLog(prev => [`🐉 ¡Un Pokémon legendario apareció! Fue un encuentro de descanso. Todo el equipo vivo se ha curado.`, ...prev])
        setLegendaryEncounter(legendary)
        setScreen('route')
        break
      }
      case 'mysterious_trader': {
        setTraderModal(true)
        break
      }
      case 'evolution_merchant': {
        const unlockedItems = Object.keys(EVOLUTION_ITEM_UNLOCK_IDS).filter(n => metaProgression.permanentlyUnlockedItems.includes(EVOLUTION_ITEM_UNLOCK_IDS[n]))
        if (unlockedItems.length > 0) {
          const shuffled = [...unlockedItems].sort(() => 0.5 - Math.random())
          const selected = shuffled.slice(0, 5).map(name => ({ name, price: 60 + Math.floor(Math.random() * 60) }))
          setMerchantItems(selected)
        } else {
          setBattleLog(prev => ['🧳 El mercader misterioso se fue... no tenía objetos para ti.', ...prev].slice(0, 15))
        }
        break
      }
      case 'trap': {
        const dmg = Math.floor(current.maxHp * 0.3)
        setTeam(prev => prev.map((p, i) => i === activeIndex ? { ...p, hp: Math.max(1, p.hp - dmg) } : p))
        setBattleLog(prev => [`⚠️ ¡La trampa explotó! ${current.name} perdió ${dmg} HP.`, ...prev])
        break
      }
      case 'fairy_blessing': {
        setTeam(prev => prev.map((p, i) => i === activeIndex ? { ...p, hp: p.maxHp } : p))
        setBattleLog(prev => [`🧚 ¡${current.name} fue curado completamente!`, ...prev])
        break
      }
      case 'treasure_chest': {
        const gold = 50 + Math.floor(Math.random() * 100)
        setMoney(prev => prev + gold)
        const items = ['Potion', 'X Attack', 'Oran Berry', 'Lum Berry']
        const item = items[Math.floor(Math.random() * items.length)]
        setInventory(prev => [...prev, item])
        setBattleLog(prev => [`📦 ¡Cofre abierto! +$${gold} y ${item}`, ...prev])
        break
      }
      case 'shiny_spot': {
        setShinyNextEncounter(true)
        setBattleLog(prev => [`✨ ¡La zona brilla! Tu próximo encuentro de descanso será shiny.`, ...prev])
        break
      }
      case 'mysterious_help': {
        const faintedIdx = team.findIndex(p => p.hp <= 0)
        if (faintedIdx >= 0) {
          const revivedHp = Math.max(1, Math.floor(team[faintedIdx].maxHp * 0.5))
          setTeam(prev => prev.map((p, i) => i === faintedIdx ? { ...p, hp: revivedHp } : p))
          setBattleLog(prev => [`🩺 ¡${team[faintedIdx].name} fue revivido con ${revivedHp} HP por una fuerza misteriosa!`, ...prev])
        } else {
          setBattleLog(prev => [`🩺 Una fuerza misteriosa pasa de largo... todos tus Pokémon están en pie.`, ...prev])
        }
        break
      }
    }
  }

  async function handleTraderChoice(index: number): Promise<void> {
    setTraderModal(false)
    const traded = team[index]
    if (!traded) return
    try {
      const gen = currentRunGen === 0 ? 1 : currentRunGen
      const newPkmn = await getRandomPokemonByGeneration(gen)
      const scaled: Pokemon = {
        ...newPkmn,
        level: traded.level,
        hp: newPkmn.maxHp + (traded.level - 10) * 3,
        maxHp: newPkmn.maxHp + (traded.level - 10) * 3,
        attack: newPkmn.attack + (traded.level - 10) * 2,
        defense: newPkmn.defense + (traded.level - 10) * 2,
        speed: newPkmn.speed + (traded.level - 10) * 2,
      }
      scaled.hp = scaled.maxHp
      registerInPokedex(scaled)
      setTeam(prev => prev.map((p, i) => i === index ? scaled : p))
      if (index === activeIndex) {
        setActiveIndex(0)
      }
      setBattleLog(prev => [`🎭 El comerciante intercambió a ${traded.name} por ${scaled.name}!`, ...prev].slice(0, 15))
    } catch {
      setBattleLog(prev => [`🎭 El comerciante se fue sin hacer nada.`, ...prev].slice(0, 15))
    }
  }

  function handleAchievementDismiss(): void {
    setNewAchievement(null)
  }

  function generateRandomNodeType(id: number, rng: () => number = Math.random): RouteNode {
    let type: RouteNode['type'] = 'battle'
    if (runChallenges.bossRush) {
      type = 'battle'
    } else if (runChallenges.allTeamRocket) {
      type = 'teamRocket'
    } else {
      const rand = rng()
      if (difficulty === 'infinite') {
        if (rand < 0.10 && !runChallenges.noShops) {
          type = 'shop'
        } else if (rand < 0.20 && !runChallenges.noRests) {
          type = 'rest'
        } else if (rand < 0.30) {
          type = 'teamRocket'
        } else if (rand < 0.36) {
          type = 'spin'
        } else if (rand < 0.42) {
          type = 'pokeRand'
        } else if (rand < 0.48) {
          type = 'move'
        } else if (rand < 0.54 && metaProgression.permanentlyUnlockedItems.includes('unlock_mega_node')) {
          type = 'mega'
        } else if (rand < 0.60 && metaProgression.permanentlyUnlockedItems.includes('unlock_gmax_node')) {
          type = 'gmax'
        }
      } else if (difficulty === 'medium') {
        if (rand < 0.15 && !runChallenges.noShops) {
          type = 'shop'
        } else if (rand < 0.35 && !runChallenges.noRests) {
          type = 'rest'
        } else if (rand < 0.47) {
          type = 'teamRocket'
        } else if (rand < 0.57) {
          type = 'spin'
        }
      } else {
        if (rand < 0.15 && !runChallenges.noShops) {
          type = 'shop'
        } else if (rand < 0.40 && !runChallenges.noRests) {
          type = 'rest'
        } else if (rand < 0.52) {
          type = 'teamRocket'
        }
      }
    }
    return {
      id,
      type,
      label: type === 'teamRocket' ? `TeamR #${id}` : type === 'spin' ? `Spin #${id}` : type === 'pokeRand' ? `PokeRand #${id}` : type === 'move' ? `Move #${id}` : type === 'mega' ? `Mega #${id}` : type === 'gmax' ? `G-MAX #${id}` : `Ruta ${id}`,
      done: false
    }
  }

  async function startNewRun(sameRoute = false): Promise<void> {
    const dailyCfg = isDailyRunRef.current ? getDailyConfig(dailySeed, [1,2,3,4,5,6,7,8,9]) : null
    const effectiveGen = coopModeRef.current ? (coopGenRef.current || generation) : (dailyCfg ? dailyCfg.generation : generation)
    const effectiveDifficulty = coopModeRef.current ? (coopDiffRef.current || 'medium') : (dailyCfg ? dailyCfg.difficulty : difficulty)
    // Semilla de la ruta: se guarda para poder "reiniciar" con los mismos nodos.
    const routeSeed = coopModeRef.current
      ? (coopSeedRef.current || String(Math.random()).slice(2, 12))
      : isDailyRunRef.current
        ? dailySeed
        : sameRoute && routeSeedRef.current
          ? routeSeedRef.current
          : String(Math.random()).slice(2, 12)
    routeSeedRef.current = routeSeed

    if (!dailyCfg) {
      if (!isGenUnlocked(effectiveGen)) {
        setApiError('Esta generación aún está bloqueada.')
        return
      }
      if (effectiveDifficulty === 'hard' && !isHardUnlocked(effectiveGen)) {
        setApiError('El modo difícil para esta generación aún está bloqueado.')
        return
      }
      if (effectiveDifficulty === 'infinite' && !isInfiniteUnlocked(effectiveGen)) {
        setApiError('El modo Infinite se desbloquea completando Difícil en esta generación.')
        return
      }
      if (effectiveDifficulty === 'infinite' && !authUser) {
        setApiError('Para jugar al modo Infinite necesitas una cuenta. Crea una o inicia sesión en el ranking.')
        openLeaderboard()
        return
      }
    }

    megaNodeSpawnedRef.current = false

    if (coopModeRef.current && coopSeedRef.current) {
      setRunSeed(parseFloat(coopSeedRef.current) || Math.random())
    } else {
      setRunSeed(Math.random())
    }

    setIsLoading(true)
    setApiError('')

    try {
      const targetGen = coopModeRef.current ? (coopGenRef.current || getEffectiveGen()) : (dailyCfg ? effectiveGen : getEffectiveGen())
      setCurrentRunGen(targetGen)

      // Handle challengeGauntlet: randomly pick 3 challenges
      let activeChallenges = { ...runChallenges }
      if (activeChallenges.challengeGauntlet) {
        const allChallengeKeys: Array<keyof RunChallenges> = [
          'noShops', 'noRests', 'allShiny', 'allTeamRocket', 'nuzlocke',
          'soloStarter', 'fixedTeam', 'noEvolution', 'noItems', 'restrictedMoves',
          'firstStrike', 'fixedLevel', 'noCrits', 'typeRandomizer', 'noPurchasing',
          'blindRoute', 'bossRush', 'speedrun', 'noMoney', 'doubleModifiers',
          'scalingEnemies', 'noHealing', 'ironman', 'totalRandomizer', 'egglocke'
        ]
        const shuffled = [...allChallengeKeys].sort(() => Math.random() - 0.5)
        const picked = shuffled.slice(0, 3)
        activeChallenges = { ...activeChallenges }
        for (const key of allChallengeKeys) {
          activeChallenges[key] = picked.includes(key)
        }
        activeChallenges.challengeGauntlet = true
        setRunChallenges(activeChallenges)
        setGauntletKeys(picked)
      }

      // Handle nuzlockeHardcore: nuzlocke + noItems + noRests
      if (activeChallenges.nuzlockeHardcore) {
        activeChallenges = { ...activeChallenges, nuzlocke: true, noItems: true, noRests: true }
      }

      // --- COLISEUM: skip starter, go to team selection ---
      if (effectiveDifficulty === 'coliseum') {
        activeChallenges = { ...activeChallenges, fixedLevel: true, noEvolution: true, noMoney: true, noShops: true, noRests: true }
        setRunChallenges(activeChallenges)
        const coliseumRoute: RouteNode[] = []
        for (let i = 1; i <= 8; i++) {
          coliseumRoute.push({ id: i, type: 'boss', label: `Jefe #${i}`, done: false })
        }
        setRoute(coliseumRoute)
        setRouteIndex(0)
        setMoney(0)
        setInventory([])
        setModifier(null)
        setModifier2(null)
        setBadges([])
        setCurrentStage(1)
        setEnemy(null)
        setIsTrainerBattle(false)
        setTrainerTeam([])
        setTrainerPokemonIndex(0)
        setTrainerName('')
        setTrainerSprite('')
        setTrainerBadge('')
        setRunStats({
          battlesWon: 0, battlesLost: 0, totalDamageDealt: 0, totalDamageTaken: 0,
          critsLanded: 0, superEffectiveHits: 0, koFirstTurn: 0, captures: 0,
          itemsUsed: 0, moneySpent: 0, moneyEarned: 0, nodesCleared: 0, evolutions: 0,
          teamSizeMax: 6, lowestHPEver: 9999, totalTurns: 0, pokemonUsed: [], challengesActive: [],
        })
        setRandomEventUsed(new Set())
        setActiveRandomEvent(null)
        setColiseumTempTeam([])
        setColiseumSeed(Math.floor(Math.random() * 1000000))
        setScreen('coliseum_select')
        return
      }

      // Handle ironman: noEvolution + fixedTeam + noHealing
      if (activeChallenges.ironman) {
        activeChallenges = { ...activeChallenges, noEvolution: true, fixedTeam: true, noHealing: true }
        setRunChallenges(activeChallenges)
      }

      const starter = await getRandomStarterByGeneration(targetGen, activeChallenges.allShiny)
      const config: RunConfig = { generation: targetGen }
      const run = startRun(config, activeChallenges.doubleModifiers)

      if (isDailyRunRef.current) {
        const dailyCfg = getDailyConfig(dailySeed, [targetGen])
        const fixedMod = RUN_MODIFIERS.find(m => m.id === dailyCfg.modifierId)
        if (fixedMod) run.modifier = fixedMod
      }

      if (run.modifier2) {
        setModifier2(run.modifier2)
      } else {
        setModifier2(null)
      }

      registerInPokedex(starter)

      const totalNodes = difficultyNodeCounts[effectiveDifficulty]
      let customRoute: RouteNode[] = []

      const routeRand = createSeededRandom(routeSeed)
      const rr = () => routeRand()
      routeRandRef.current = rr

      if (coopModeRef.current) {
        // Ruta compartida: misma forma para ambos jugadores (misma semilla).
        // Los encuentros, tiendas y descansos siguen siendo aleatorios por jugador.
        const coopNodes = difficultyNodeCounts[coopDiffRef.current || 'medium'] || 10
        const tradePos1 = Math.max(1, Math.floor(coopNodes / 3))
        const tradePos2 = Math.max(2, Math.floor((coopNodes * 2) / 3))
        for (let i = 1; i < coopNodes; i++) {
          let type: RouteNode['type'] = 'battle'
          if (i === tradePos1 || i === tradePos2) {
            type = 'trade'
          } else {
            const r = rr()
            if (r < 0.18 && !activeChallenges.noShops) {
              type = 'shop'
            } else if (r < 0.36 && !activeChallenges.noRests) {
              type = 'rest'
            } else if (r < 0.50) {
              type = 'teamRocket'
            } else if (r < 0.62) {
              type = 'spin'
            }
          }
          customRoute.push({ id: i, type, label: `${nodeTypeLabel({ id: i, type, label: '', done: false })} #${i}`, done: false })
        }
        customRoute.push({ id: coopNodes, type: 'boss', label: `Combate Final (#${coopNodes})`, done: false })
      } else if (activeChallenges.bossRush) {
        customRoute = generateBossRushRoute(totalNodes)
      } else if (effectiveDifficulty === 'infinite') {
        for (let i = 1; i <= 5; i++) {
          customRoute.push(generateRandomNodeType(i, rr))
        }
      } else {
        const spinPositions: number[] = []
        const pokeRandPositions: number[] = []
        const movePositions: number[] = []
        let megaPosition: number | null = null
        let gmaxPosition: number | null = null
        if (!activeChallenges.allTeamRocket) {
          if (effectiveDifficulty === 'hard') {
            const available = Array.from({ length: totalNodes - 2 }, (_, k) => k + 2)
            while (spinPositions.length < 2 && available.length > 0) {
              const idx = Math.floor(rr() * available.length)
              spinPositions.push(available[idx])
              available.splice(idx, 1)
            }
            while (pokeRandPositions.length < 2 && available.length > 0) {
              const idx = Math.floor(rr() * available.length)
              pokeRandPositions.push(available[idx])
              available.splice(idx, 1)
            }
            if (available.length > 0) {
              const idx = Math.floor(rr() * available.length)
              movePositions.push(available[idx])
              available.splice(idx, 1)
            }
            if (available.length > 0 && metaProgression.permanentlyUnlockedItems.includes('unlock_mega_node')) {
              const idx = Math.floor(rr() * available.length)
              megaPosition = available[idx]
              available.splice(idx, 1)
              megaNodeSpawnedRef.current = true
            }
            if (available.length > 0 && metaProgression.permanentlyUnlockedItems.includes('unlock_gmax_node')) {
              const idx = Math.floor(rr() * available.length)
              gmaxPosition = available[idx]
              available.splice(idx, 1)
            }
          } else if (effectiveDifficulty === 'medium') {
            const available = Array.from({ length: totalNodes - 2 }, (_, k) => k + 2)
            const idx = Math.floor(rr() * available.length)
            spinPositions.push(available[idx])
            available.splice(idx, 1)
            if (available.length > 0) {
              const idx2 = Math.floor(rr() * available.length)
              pokeRandPositions.push(available[idx2])
              available.splice(idx2, 1)
            }
            if (available.length > 0) {
              const idx3 = Math.floor(rr() * available.length)
              movePositions.push(available[idx3])
              available.splice(idx3, 1)
            }
          }
        }

        for (let i = 1; i < totalNodes; i++) {
          let type: RouteNode['type'] = 'battle'

          if (spinPositions.includes(i)) {
            type = 'spin'
          } else if (pokeRandPositions.includes(i)) {
            type = 'pokeRand'
          } else if (movePositions.includes(i)) {
            type = 'move'
          } else if (megaPosition !== null && i === megaPosition) {
            type = 'mega'
          } else if (gmaxPosition !== null && i === gmaxPosition) {
            type = 'gmax'
          } else if (activeChallenges.bossRush) {
            type = 'battle'
          } else if (activeChallenges.allTeamRocket) {
            type = 'teamRocket'
          } else {
            const rand = rr()
            if (rand < 0.15 && !activeChallenges.noShops) {
              type = 'shop'
            } else if (rand < 0.40 && !activeChallenges.noRests) {
              type = 'rest'
            } else if (rand < 0.52) {
              type = 'teamRocket'
            }
          }

          customRoute.push({
            id: i,
            type,
            label: type === 'teamRocket' ? `TeamR #${i}` : type === 'spin' ? `Spin #${i}` : type === 'pokeRand' ? `PokeRand #${i}` : type === 'move' ? `Move #${i}` : type === 'mega' ? `Mega #${i}` : type === 'gmax' ? `G-MAX #${i}` : `Ruta ${i}`,
            done: false
          })
        }

        customRoute.push({
          id: totalNodes,
          type: 'boss',
          label: `Combate Final (#${totalNodes})`,
          done: false
        })
      }

      const hpBonus = run.modifier?.playerMaxHpBonus ?? 0
      let starterWithBonus = {
        ...starter,
        maxHp: starter.maxHp + hpBonus,
        hp: starter.hp + hpBonus,
      }
      if (activeChallenges.noEvolution) {
        starterWithBonus = applyNoEvolutionBuff(starterWithBonus)
      }
      if (activeChallenges.fixedLevel) {
        starterWithBonus = { ...starterWithBonus, level: 50 }
      }
      setTeam([starterWithBonus])
      setActiveIndex(0)
      setMoney(activeChallenges.noMoney ? 0 : 100)
      setInventory([run.item, ...Array(5).fill('Poké Ball')])
      setModifier(run.modifier)
      setRoute(customRoute)
      setRouteIndex(0)
      setBadges([])
      setCurrentStage(1)
      setEnemy(null)
      setIsTrainerBattle(false)
      setTrainerTeam([])
      setTrainerPokemonIndex(0)
      setTrainerName('')
      setTrainerSprite('')
      setTrainerBadge('')
      setRestEncounter(null)
      setDefeatSummary(null)
      setVictoryUnlocks(null)
      setEggInventory([])
      setSpeedrunSeconds(0)
      if (speedrunTimerRef.current) {
        clearInterval(speedrunTimerRef.current)
        speedrunTimerRef.current = null
      }

      const challengeDescriptions: string[] = []
      if (activeChallenges.noShops) challengeDescriptions.push('🚫 Desafío: Sin tiendas.')
      if (activeChallenges.noRests) challengeDescriptions.push('🚫 Desafío: Sin descansos.')
      if (activeChallenges.allShiny) challengeDescriptions.push('✨ Desafío: Todos los Pokémon son Shiny.')
      if (activeChallenges.allTeamRocket) challengeDescriptions.push('🔴 Desafío: ¡Todos los nodos son TeamR!')
      if (activeChallenges.nuzlocke) challengeDescriptions.push('💀 Desafío: Nuzlocke (muerte = liberación).')
      if (activeChallenges.soloStarter) challengeDescriptions.push('🌟 Desafío: Solo Starter (sin capturas).')
      if (activeChallenges.fixedTeam) challengeDescriptions.push('🔒 Desafío: Equipo Fijo.')
      if (activeChallenges.noEvolution) challengeDescriptions.push('🚫 Desafío: Sin Evolución.')
      if (activeChallenges.noItems) challengeDescriptions.push('🚫 Desafío: Sin Objetos en batalla.')
      if (activeChallenges.restrictedMoves) challengeDescriptions.push('⚔️ Desafío: Solo 2 movimientos.')
      if (activeChallenges.firstStrike) challengeDescriptions.push('⚡ Desafío: Primer Golpe (recoil).')
      if (activeChallenges.fixedLevel) challengeDescriptions.push('📊 Desafío: Nivel Fijo.')
      if (activeChallenges.noCrits) challengeDescriptions.push('🚫 Desafío: Sin Críticos.')
      if (activeChallenges.typeRandomizer) challengeDescriptions.push('🎲 Desafío: Tipo Randomizado.')
      if (activeChallenges.noPurchasing) challengeDescriptions.push('🚫 Desafío: Sin Compras.')
      if (activeChallenges.blindRoute) challengeDescriptions.push('👁️‍🗨️ Desafío: Ruta Ciega.')
      if (activeChallenges.bossRush) challengeDescriptions.push('🏆 Desafío: Boss Rush.')
      if (activeChallenges.speedrun) challengeDescriptions.push('⏱️ Desafío: Speedrun (30s/turno).')
      if (activeChallenges.noMoney) challengeDescriptions.push('💸 Desafío: Sin Dinero.')
      if (activeChallenges.doubleModifiers) challengeDescriptions.push('🎰 Desafío: Modifiers Duplos.')
      if (activeChallenges.scalingEnemies) challengeDescriptions.push('📈 Desafío: Enemigos Reforzados.')
      if (activeChallenges.noHealing) challengeDescriptions.push('🚫 Desafío: Sin Curación.')
      if (activeChallenges.ironman) challengeDescriptions.push('🔒 Desafío: Ironman (todo fijo).')
      if (activeChallenges.totalRandomizer) challengeDescriptions.push('🎲 Desafío: Randomizer Total.')
      if (activeChallenges.nuzlockeHardcore) challengeDescriptions.push('💀 Desafío: Nuzlocke Hardcore.')
      if (activeChallenges.challengeGauntlet) challengeDescriptions.push('🎰 Desafío: Gauntlet (3 al azar).')
      if (activeChallenges.egglocke) challengeDescriptions.push('🥚 Desafío: Egglocke.')

      setBattleLog([
        `Tu inicial es ${starter.name}${starter.shiny ? ' ✨' : ''}.`,
        `Modo: ${effectiveGen === 0 ? 'Random All-Stars' : `Gen ${effectiveGen}`}.`,
        `Dificultad: ${difficultyLabels[effectiveDifficulty].title}${effectiveDifficulty === 'infinite' ? ' (Sin límite)' : ` (3 etapas de ${totalNodes} rutas)`}.`,
        `Recibes $${activeChallenges.noMoney ? '0' : '100'} de inicio e item: ${run.item}.`,
        ...challengeDescriptions,
      ])
      const activeChallengeNames: string[] = []
      if (activeChallenges.nuzlocke) activeChallengeNames.push('Nuzlocke')
      if (activeChallenges.soloStarter) activeChallengeNames.push('Solo Starter')
      if (activeChallenges.noItems) activeChallengeNames.push('Sin Items')
      if (activeChallenges.noHealing) activeChallengeNames.push('Sin Curación')
      if (activeChallenges.bossRush) activeChallengeNames.push('Boss Rush')
      if (activeChallenges.speedrun) activeChallengeNames.push('Speedrun')
      if (activeChallenges.ironman) activeChallengeNames.push('Ironman')

      setRunStats({
        battlesWon: 0, battlesLost: 0, totalDamageDealt: 0, totalDamageTaken: 0,
        critsLanded: 0, superEffectiveHits: 0, koFirstTurn: 0, captures: 0,
        itemsUsed: 0, moneySpent: 0, moneyEarned: 0, nodesCleared: 0, evolutions: 0,
        teamSizeMax: 1, lowestHPEver: starterWithBonus.hp, totalTurns: 0,
        pokemonUsed: [starterWithBonus.name], challengesActive: activeChallengeNames,
      })
      setRandomEventUsed(new Set())
      setShinyNextEncounter(false)
      setActiveRandomEvent(null)

      runStartTimeRef.current = Date.now()
      setScoreSubmitState('idle')
      setVoluntaryRunEnd(false)
      setShowEndRunModal(false)
      setScreen('route')
      startBattleMusic()
    } catch {
      setApiError('No se pudo cargar PokeAPI. Reintenta en unos segundos.')
    } finally {
      setIsLoading(false)
    }
  }

  function finalizeRunVictory(): void {
    const wins = record.wins + 1
    persistRecord(wins, record.losses)

    // Actualizar progresión de desbloqueos
    const genPlayed = currentRunGen
    const isMediumOrHard = difficulty === 'medium' || difficulty === 'hard'

    const newlyUnlockedHard = !progression.completedAny.includes(genPlayed)
    const newlyUnlockedNextGen = isMediumOrHard && genPlayed < 9 && !progression.completedMedium.includes(genPlayed)
    const newlyUnlockedInfinite = difficulty === 'hard' && !progression.completedHard.includes(genPlayed)

    const nextCompletedAny = Array.from(new Set([...progression.completedAny, genPlayed]))
    const nextCompletedMedium = isMediumOrHard
      ? Array.from(new Set([...progression.completedMedium, genPlayed]))
      : progression.completedMedium
    const nextCompletedHard = difficulty === 'hard'
      ? Array.from(new Set([...progression.completedHard, genPlayed]))
      : progression.completedHard

    const updatedProgression: ProgressionData = {
      completedAny: nextCompletedAny,
      completedMedium: nextCompletedMedium,
      completedHard: nextCompletedHard,
      completedColiseum: progression.completedColiseum,
      completedLeague: currentNode && currentNode.id >= 1000
        ? Array.from(new Set([...progression.completedLeague, genPlayed]))
        : progression.completedLeague
    }

    localStorage.setItem('pokerand_progression', JSON.stringify(updatedProgression))
    setProgression(updatedProgression)

    setVictoryUnlocks({
      genName: generationRegions[genPlayed],
      nextGenNumber: newlyUnlockedNextGen ? genPlayed + 1 : null,
      nextGenName: newlyUnlockedNextGen ? generationRegions[genPlayed + 1] : null,
      unlockedHard: newlyUnlockedHard,
      unlockedInfinite: newlyUnlockedInfinite
    })

    const newStreak = winStreak + 1
    setWinStreak(newStreak)
    localStorage.setItem('pokerand_streak', String(newStreak))
    if (newStreak > bestStreak) {
      setBestStreak(newStreak)
      localStorage.setItem('pokerand_best_streak', String(newStreak))
    }
    unlockAchievement('first_win')
    if (runChallenges.nuzlocke || runChallenges.nuzlockeHardcore) unlockAchievement('nuzlocke_win')
    if (team.length <= 1) unlockAchievement('solo_win')
    if (runChallenges.speedrun) unlockAchievement('speedrun_win')
    if (runChallenges.noItems) unlockAchievement('no_item_win')
    if (runChallenges.ironman) unlockAchievement('ironman_win')
    if (difficulty === 'hard') unlockAchievement('hard_win')
    if (difficulty === 'easy') unlockAchievement('rookie')
    if (runChallenges.bossRush) unlockAchievement('boss_rush_win')
    if (runChallenges.challengeGauntlet) unlockAchievement('gauntlet_win')
    if (nextCompletedAny.length >= 9) unlockAchievement('all_gens')

    if (difficulty === 'medium') unlockAchievement('medium_win')
    if (metaProgression.totalWins === 0) unlockAchievement('first_try')

    if (runChallenges.noShops) unlockAchievement('noShops_win')
    if (runChallenges.noRests) unlockAchievement('noRests_win')
    if (runChallenges.allShiny) unlockAchievement('allShiny_win')
    if (runChallenges.noMoney) unlockAchievement('noMoney_win')
    if (runChallenges.egglocke) unlockAchievement('egglocke_win')
    if (runChallenges.nuzlockeHardcore) unlockAchievement('nuzlockeHC_win')
    if (runChallenges.noHealing) unlockAchievement('noHeal_win')
    if (runChallenges.allTeamRocket) unlockAchievement('allTeamRocket_win')

    const activeChallengeCount = Object.entries(runChallenges).filter(([k, v]) => v && k !== 'allShiny').length
    if (activeChallengeCount >= 3) unlockAchievement('triple_challenge')
    if (activeChallengeCount >= 5) unlockAchievement('challenge_mania')
    if (battleMegaUsed) unlockAchievement('mega_win')
    if (battleGmaxUsed) unlockAchievement('gmax_win')

    const hasActiveChallenge = activeChallengeCount > 0
    const baseCoins = difficulty === 'easy' ? 10 : difficulty === 'hard' ? 20 : 15

    setMetaProgression(prev => {
      const coins = baseCoins + (hasActiveChallenge ? 15 : 0)
      const updated = { ...prev, totalRuns: prev.totalRuns + 1, totalWins: prev.totalWins + 1, bestStreak: Math.max(prev.bestStreak, newStreak), pokeCoins: prev.pokeCoins + coins }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
    awardPokeCoins(baseCoins, `¡Victoria! (${difficulty === 'easy' ? 'Fácil' : difficulty === 'hard' ? 'Difícil' : 'Medio'})`)
    if (currentNode && currentNode.id >= 1000) {
      awardPokeCoins(15, '🏆 Victoria en la Liga Pokémon')
    }
    if (hasActiveChallenge) awardPokeCoins(15, 'Bonus Desafío Activo')
    if (team.length <= 1) awardPokeCoins(5, 'Bonus Solo Pokémon')

    setScreen('victory')
    playVictoryFanfare()
    if (isDailyRunRef.current && Object.values(runChallenges).every(v => !v)) {
      setDailyPlayed(true)
      localStorage.setItem('pokerand_daily', dailySeed)
      awardPokeCoins(15, 'Bonus Desafío Diario')
      unlockAchievement('daily_3')
    }
  }

  async function completeCurrentNode(): Promise<void> {
    if (difficulty === 'coliseum') {
      setTeam(prev => prev.map(p => ({ ...p, hp: p.maxHp, status: undefined })))
      setBattleLog(prev => [`💊 ¡Equipo curado automáticamente!`, ...prev].slice(0, 15))
    }

    setRestEncounter(null)
    setRestRewardItem('')
    setLegendaryEncounter(null)
    setBattleTurns(0)
    if (speedrunTimerRef.current) {
      clearInterval(speedrunTimerRef.current)
      speedrunTimerRef.current = null
    }
    setSpeedrunSeconds(0)
    const restoredOrigData = { ...originalPokemonDataRef.current }
    originalPokemonDataRef.current = {}
    setTeam(prev => prev.map((p, i) => {
      const orig = restoredOrigData[i]
      if (orig) return { ...p, megaEvolved: false, gmaxEvolved: false, gmaxTurnsLeft: undefined, ...orig }
      return { ...p, megaEvolved: false, gmaxEvolved: false, gmaxTurnsLeft: undefined }
    }))
    setBattleGmaxUsed(false)
    setRoute((previous) =>
      previous.map((node, index) => (index === routeIndex ? { ...node, done: true } : node))
    )

    // --- Gate de ritmo cooperativo: esperar a que el compañero complete el nodo ---
    if (coopModeRef.current && coopSessionCodeRef.current && currentNode) {
      const gateResult = await waitForCoopPartner(routeIndex)
      if (gateResult === 'won' || gateResult === 'lost') {
        handleCoopSessionEnded(gateResult)
        return
      }
    }

    if (routeIndex >= route.length - 1) {
      if (difficulty === 'infinite') {
        if (routeIndex >= 19) unlockAchievement('infinite_20')
        if (routeIndex >= 49) unlockAchievement('infinite_50')
        if (routeIndex >= 99) unlockAchievement('infinite_100')
        const nextId = route.length + 1
        const batch = Array.from({ length: 5 }, (_, k) => generateRandomNodeType(nextId + k, routeRandRef.current))
        setRoute((previous) => [...previous, ...batch])
        setBattleLog((prev) => [
          `♾️ ¡Modo Infinite! Aparecen 5 nuevas rutas...`,
          ...prev
        ].slice(0, 15))
        setRouteIndex((previous) => previous + 1)
        setScreen('route')
        return
      }

      if (difficulty === 'coliseum') {
        unlockAchievement('first_win')
        if (difficulty === 'coliseum') unlockAchievement('hard_win')
        setMetaProgression(prev => {
          const updated = { ...prev, totalRuns: prev.totalRuns + 1, totalWins: prev.totalWins + 1, bestStreak: Math.max(prev.bestStreak, winStreak + 1) }
          localStorage.setItem('pokerand_meta', JSON.stringify(updated))
          return updated
        })
        setProgression(prev => {
          const genPlayed = currentRunGen
          const updated = { ...prev, completedColiseum: Array.from(new Set([...prev.completedColiseum, genPlayed])) }
          localStorage.setItem('pokerand_progression', JSON.stringify(updated))
          return updated
        })
        setWinStreak(prev => prev + 1)
        awardPokeCoins(30, '👑 Victoria en COLISEUM')
        setScreen('victory')
        playVictoryFanfare()
        return
      }

      // Cooperativo: sin insignias ni etapas, victoria directa.
      if (coopModeRef.current) {
        finalizeRunVictory()
        return
      }

      // Sistema de insignias: al derrotar un jefe, obtienes una insignia
      if (currentNode?.type === 'boss' && currentNode.id < 1000) {
        const availableBadges = GYM_BADGES.filter(b => !badges.some(h => h.id === b.id))
        if (availableBadges.length > 0) {
          const newBadge = availableBadges[Math.floor(Math.random() * availableBadges.length)]
          const updatedBadges = [...badges, newBadge]
          setBadges(updatedBadges)
          setCurrentStage(updatedBadges.length + 1)
          setBattleLog((prev) => [`🏅 ¡Obtuviste la ${newBadge.name}! (${updatedBadges.length}/3)`, ...prev].slice(0, 15))
          const stageCoins = Math.floor((difficulty === 'easy' ? 10 : difficulty === 'hard' ? 20 : 15) / 2)
          awardPokeCoins(stageCoins, `🏅 Bonus por completar la etapa ${updatedBadges.length} de 3`)
        }
        if (badges.length < 2) {
          // Generar nueva ruta para la siguiente etapa
          const totalNodesPerStage = difficultyNodeCounts[difficulty]
          const newRoute: RouteNode[] = []
          const startId = route.length + 1
          for (let i = 0; i < totalNodesPerStage - 1; i++) {
            newRoute.push(generateRandomNodeType(startId + i, routeRandRef.current))
          }
          const finalNodeId = startId + totalNodesPerStage - 1
          newRoute.push({ id: finalNodeId, label: `Jefe #${finalNodeId}`, type: 'boss', done: false })
          setRoute(newRoute)
          setRouteIndex(0)
          setScreen('route')
          return
        }
        // badges.length >= 2 → 3ª insignia ya entregada → ofrecer liga
        if ((difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') && currentNode && currentNode.id < 1000) {
          setLeagueOffer(true)
          return
        }
      }

      finalizeRunVictory()
      return
    }

    setRouteIndex((previous) => previous + 1)
    setRunStats(prev => ({ ...prev, nodesCleared: prev.nodesCleared + 1 }))
    const progress = route.length > 0 ? (routeIndex + 1) / route.length : 0
    if (difficulty !== 'coliseum') triggerRandomEvent(progress)
    if (!activeRandomEvent) setScreen('route')
  }

  // --- Cooperativo: helpers ---

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  async function waitForCoopPartner(nodeIndex: number): Promise<'ready' | 'won' | 'lost'> {
    const code = coopSessionCodeRef.current
    if (!code) return 'ready'

    await markNodeReady(code, nodeIndex)
    setCoopWaitingNode(nodeIndex)
    setCoopWaiting(true)

    try {
      let isA = coopMyRoleRef.current === 'a'
      let polls = 0
      while (true) {
        const prog = await getCoopProgress(code, nodeIndex)
        if (!prog) {
          // Error de servidor: no bloquear al jugador
          return 'ready'
        }
        if (prog.finished) {
          // El compañero terminó la sesión. Si ganó la run, nosotros también
          // (cooperativo). Si perdió/abandonó, la run termina para ambos.
          return prog.result === 'won' ? 'won' : 'lost'
        }
        const partnerReady = isA ? prog.b_ready : prog.a_ready
        if (partnerReady) return 'ready'
        polls++
        // Red de seguridad: si el compañero nunca responde (~5 min), continúa
        // en solitario en vez de quedarse esperando para siempre.
        if (polls >= 120) {
          setBattleLog((prev) => ['🤝 Tu compañero no responde. Continúas en solitario.', ...prev].slice(0, 15))
          return 'ready'
        }
        await sleep(2500)
      }
    } finally {
      setCoopWaiting(false)
    }
  }

  function handleCoopSessionEnded(result: 'won' | 'lost'): void {
    if (result === 'won') {
      setVoluntaryRunEnd(false)
      finalizeRunVictory()
    } else {
      setCoopSessionEndedMsg('Tu compañero finalizó o abandonó la sesión. La run ha terminado para ambos.')
      // Cierre de partida completo (derrota), igual que el jugador que perdió,
      // para que ambos reciban el mismo trato (récord, racha y PokéCoins).
      const losses = record.losses + 1
      persistRecord(record.wins, losses)
      setWinStreak(0)
      localStorage.setItem('pokerand_streak', '0')
      setMetaProgression(prev => {
        const updated = { ...prev, totalRuns: prev.totalRuns + 1 }
        localStorage.setItem('pokerand_meta', JSON.stringify(updated))
        return updated
      })
      awardPokeCoins(5, 'Partida completada (cooperativo)')
      setScreen('defeat')
      playDefeatMusic()
    }
  }

  async function handleCreateCoopSession(): Promise<void> {
    if (!authUser) {
      setCoopError('Para jugar en cooperativo necesitas iniciar sesión o crear una cuenta.')
      openLeaderboard()
      return
    }
    if (!isCoopEnabled()) {
      setCoopError('Cooperativo no disponible: configura Supabase en las variables de entorno.')
      return
    }
    setCoopError('')
    setIsLoading(true)
    try {
      isDailyRunRef.current = false
      const seed = String(Math.random()).slice(2, 12)
      const gen = coopGen || generation || 1
      const code = await createCoopSession(seed, gen, coopDiff)
      if (!code) {
        setCoopError('No se pudo crear la sesión. Revisa que las tablas existan en Supabase (schema.sql).')
        return
      }
      setCoopMode(true)
      setCoopSessionCode(code)
      setCoopSeed(seed)
      setCoopMyRole('a')
      setCoopPartnerJoined(false)
      coopModeRef.current = true
      coopSessionCodeRef.current = code
      coopSeedRef.current = seed
      coopMyRoleRef.current = 'a'
      coopGenRef.current = gen
      coopDiffRef.current = coopDiff
      coopAutoStartedRef.current = false
    } finally {
      setIsLoading(false)
    }
  }

  async function handleJoinCoopSession(): Promise<void> {
    const codeInput = coopJoinCode.trim().toUpperCase()
    if (codeInput.length < 4) {
      setCoopError('Introduce el código de sesión de 6 letras.')
      return
    }
    if (!authUser) {
      setCoopError('Para jugar en cooperativo necesitas iniciar sesión o crear una cuenta.')
      openLeaderboard()
      return
    }
    setCoopError('')
    setIsLoading(true)
    try {
      isDailyRunRef.current = false
      const session = await joinCoopSession(codeInput)
      if (!session) {
        setCoopError('No se pudo unir a la sesión. Comprueba el código o que no esté llena.')
        return
      }
      setCoopMode(true)
      setCoopSessionCode(session.code)
      setCoopSeed(session.seed)
      setCoopMyRole('b')
      setCoopGen(session.gen || 1)
      setCoopDiff((session.difficulty as 'easy' | 'medium' | 'hard') || 'medium')
      setCoopPartnerJoined(true)
      // Fijar refs directamente: startNewRun los lee de forma síncrona antes de
      // que los useEffect sincronicen el estado.
      coopModeRef.current = true
      coopSessionCodeRef.current = session.code
      coopSeedRef.current = session.seed
      coopMyRoleRef.current = 'b'
      coopGenRef.current = session.gen || 1
      coopDiffRef.current = (session.difficulty as 'easy' | 'medium' | 'hard') || 'medium'
      // La partida empieza automáticamente al unirse.
      setCoopStarting(true)
      await startNewRun()
      // Mantiene la pantalla de carga unos segundos antes de entrar.
      await sleep(2500)
    } catch {
      setCoopError('No se pudo iniciar la aventura. Reintenta.')
    } finally {
      setIsLoading(false)
      setCoopStarting(false)
    }
  }

  function cancelCoopSession(): void {
    if (coopSessionCodeRef.current) void deleteCoopSessionRpc(coopSessionCodeRef.current)
    coopAutoStartedRef.current = false
    setCoopMode(false)
    setCoopSessionCode('')
    setCoopSeed('')
    setCoopJoinCode('')
    setCoopMyRole(null)
    setCoopPartnerJoined(false)
    setCoopError('')
  }

  function abandonCoopRun(): void {
    setCoopWaiting(false)
    if (coopSessionCodeRef.current) void finishCoopSession(coopSessionCodeRef.current, 'lost')
    setVoluntaryRunEnd(true)
    setDefeatSummary(null)
    setScreen('defeat')
  }

  async function restartRun(): Promise<void> {
    if (coopModeRef.current && coopSessionCodeRef.current) {
      const exists = await resetCoopSession(coopSessionCodeRef.current)
      setCoopSessionEndedMsg('')
      setCoopWaiting(false)
      if (!exists) {
        // La sesión fue eliminada al terminar (ambos jugadores). Mejor volver al
        // menú para crear una sesión nueva en vez de generar códigos distintos.
        setCoopError('La sesión anterior terminó y fue eliminada. Crea una nueva sesión desde el menú y comparte el código.')
        resetToSetup()
        return
      }
      setVoluntaryRunEnd(false)
      setDefeatSummary(null)
      await startNewRun(true)
      return
    }
    setVoluntaryRunEnd(false)
    setDefeatSummary(null)
    await startNewRun(false)
  }

  // Polling mientras se crea la sesión: cuando el compañero se une, el jugador A
  // arranca la partida automáticamente (igual que el B al unirse).
  useEffect(() => {
    if (!coopMode || !coopSessionCode || coopMyRole !== 'a') return
    const code = coopSessionCode
    let cancelled = false
    const timer = setInterval(async () => {
      if (cancelled || coopAutoStartedRef.current) return
      const sess = await getCoopSession(code)
      if (!sess) return
      if (sess.player_b_id) {
        coopAutoStartedRef.current = true
        setCoopPartnerJoined(true)
        setCoopStarting(true)
        try {
          await startNewRun()
          // Mantiene la pantalla de carga unos segundos antes de entrar.
          await sleep(2500)
        } finally {
          setCoopStarting(false)
        }
      }
    }, 3000)
    return () => { cancelled = true; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coopMode, coopSessionCode, coopMyRole])

  // Al terminar la run (victoria o derrota), cierra la sesión cooperativa para
  // que el compañero que espera en un nodo quede liberado.
  useEffect(() => {
    if (screen !== 'victory' && screen !== 'defeat') return
    if (!coopModeRef.current || !coopSessionCodeRef.current) return
    const code = coopSessionCodeRef.current
    const result = screen === 'victory' ? 'won' : 'lost'
    void finishCoopSession(code, result).then((ok) => {
      if (!ok) {
        // Reintenta una vez por si la primera llamada falló.
        setTimeout(() => { void finishCoopSession(code, result) }, 3000)
      }
    })
  }, [screen])

  function buildOfferFromPokemon(p: Pokemon): CoopTrade['offer'] {
    return {
      kind: 'pokemon',
      id: p.id,
      name: p.name,
      sprite: p.sprite,
      level: p.level,
      shiny: p.shiny,
      hp: p.hp,
      maxHp: p.maxHp,
      attack: p.attack,
      defense: p.defense,
      speed: p.speed,
      moves: p.moves.map(m => ({ name: m.name, power: m.power, type: m.type, accuracy: m.accuracy })),
      types: p.types,
      holdItem: p.holdItem,
      status: p.status ? { type: p.status.type, turns: p.status.turns } : null,
    }
  }

  function rebuildPokemonFromOffer(offer: CoopTrade['offer']): Pokemon {
    return {
      id: offer.id ?? 1,
      name: offer.name ?? '???',
      sprite: offer.sprite ?? '',
      level: offer.level ?? 10,
      hp: offer.hp ?? 10,
      maxHp: offer.maxHp ?? 10,
      attack: offer.attack ?? 10,
      defense: offer.defense ?? 10,
      speed: offer.speed ?? 10,
      moves: (offer.moves ?? []).map(m => ({ ...m, description: '', accuracy: m.accuracy })),
      types: offer.types,
      holdItem: offer.holdItem ?? undefined,
      shiny: offer.shiny,
      status: offer.status ? { type: offer.status.type as StatusType, turns: offer.status.turns } : undefined,
    }
  }

  function offerLabel(ex: CoopExchange): string {
    const partner = coopMyRoleRef.current === 'a' ? ex.b_offer : ex.a_offer
    if (!partner) return '...'
    return partner.kind === 'pokemon' ? `${partner.name} (Nv.${partner.level})` : (partner.itemName ?? 'un objeto')
  }

  function applyOfferToLocal(offer: CoopTrade['offer']): void {
    if (!offer) return
    if (offer.kind === 'pokemon') {
      const rebuilt = rebuildPokemonFromOffer(offer)
      if (teamRef.current.length < maxTeamSize) {
        setTeam(prev => [...prev, rebuilt])
        setCoopTradeMsg(`🤝 ¡Intercambio completado! Recibiste a ${rebuilt.name} de tu compañero.`)
      } else {
        setPcStorage(prev => [...prev, rebuilt])
        setCoopTradeMsg(`🤝 ¡Intercambio completado! Recibiste a ${rebuilt.name} (enviado al PC).`)
      }
    } else {
      setInventory(prev => [...prev, offer.itemName ?? 'Potion'])
      setCoopTradeMsg(`🤝 ¡Intercambio completado! Recibiste ${offer.itemName ?? 'un objeto'} de tu compañero.`)
    }
  }

  function coopSelectPokemon(idx: number): void {
    const p = team[idx]
    if (!p) return
    if (team.length <= 1) {
      setCoopTradeMsg('No puedes intercambiar a tu único Pokémon.')
      return
    }
    setCoopMyOffer(buildOfferFromPokemon(p))
    setCoopTradeMsg(`Seleccionaste a ${p.name} como oferta. Pulsa "Intercambiar".`)
  }

  function coopSelectItem(itemName: string): void {
    setCoopMyOffer({ kind: 'item', itemName, itemIcon: ITEM_SPRITES[itemName] })
    setCoopTradeMsg(`Seleccionaste ${itemName} como oferta. Pulsa "Intercambiar".`)
  }

  async function coopConfirmExchange(): Promise<void> {
    if (!coopSessionCodeRef.current || !coopMyOffer) return
    const ok = await submitExchangeOffer(coopSessionCodeRef.current, routeIndex, coopMyOffer)
    if (!ok) {
      setCoopTradeMsg('No se pudo enviar tu oferta. Revisa la conexión con Supabase.')
      return
    }
    // Guardamos la oferta para poder devolverla si el intercambio no se completa.
    coopSubmittedOfferRef.current = coopMyOffer
    // Retira la oferta de tu lado: ya está comprometida en el intercambio.
    if (coopMyOffer.kind === 'pokemon') {
      const id = coopMyOffer.id
      setTeam(prev => {
        const idx = prev.findIndex(p => p.id === id)
        if (idx === -1) return prev
        return prev.filter((_, i) => i !== idx)
      })
    } else {
      const itemName = coopMyOffer.itemName!
      setInventory(prev => {
        const out = [...prev]
        const i = out.indexOf(itemName)
        if (i !== -1) out.splice(i, 1)
        return out
      })
    }
    setCoopMyOffer(null)
    setCoopMyOfferSubmitted(true)
    setCoopTradeMsg('🤝 Oferta enviada. Esperando a que tu compañero pulse "Intercambiar"...')
  }

  // Salir del nodo de intercambio: si el intercambio no se completó, devolver
  // la oferta al jugador y cancelarla en la base de datos para que nadie la pierda.
  async function leaveTradeNode(): Promise<void> {
    const code = coopSessionCodeRef.current
    let completed = coopExchange?.completed ?? false
    if (code && coopMyOfferSubmitted && !completed) {
      const ex = await getCoopExchange(code, routeIndex)
      if (ex) {
        completed = ex.completed
        if (ex.completed && !coopExchangeAppliedRef.current) {
          const partnerOffer = await completeCoopExchange(code, routeIndex)
          if (partnerOffer && partnerOffer.kind) {
            coopExchangeAppliedRef.current = true
            applyOfferToLocal(partnerOffer)
          }
        }
      }
    }
    if (coopMyOfferSubmitted && !completed && coopSubmittedOfferRef.current) {
      const offer = coopSubmittedOfferRef.current
      if (code) await cancelExchangeOffer(code, routeIndex)
      if (offer.kind === 'pokemon') {
        const rebuilt = rebuildPokemonFromOffer(offer)
        if (teamRef.current.length < maxTeamSize) {
          setTeam(prev => [...prev, rebuilt])
        } else {
          setPcStorage(prev => [...prev, rebuilt])
        }
        setCoopTradeMsg(`↩️ El intercambio no se completó. ${rebuilt.name} volvió a tu equipo.`)
      } else {
        setInventory(prev => [...prev, offer.itemName ?? 'Potion'])
        setCoopTradeMsg(`↩️ El intercambio no se completó. ${offer.itemName ?? 'el objeto'} volvió a tu inventario.`)
      }
      coopSubmittedOfferRef.current = null
    }
    coopSubmittedOfferRef.current = null
    await completeCurrentNode()
  }

  // Polling del intercambio en el nodo actual
  useEffect(() => {
    if (screen !== 'trade') return
    const code = coopSessionCodeRef.current
    if (!code) return
    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      const ex = await getCoopExchange(code, routeIndex)
      if (!ex) return
      setCoopExchange(ex)
      // Ambos jugadores listos → completar el intercambio. complete_exchange es
      // idempotente: cada jugador recibe la oferta del otro una sola vez.
      if (ex.a_ready && ex.b_ready && !coopExchangeAppliedRef.current) {
        const partnerOffer = await completeCoopExchange(code, routeIndex)
        if (partnerOffer && partnerOffer.kind) {
          coopExchangeAppliedRef.current = true
          applyOfferToLocal(partnerOffer)
        }
      }
    }
    void poll()
    const timer = setInterval(() => void poll(), 2500)
    return () => { cancelled = true; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, routeIndex, coopSessionCode])

  // Cancelar la oferta: si ya se envió, la devuelve al jugador y la cancela en
  // la base de datos (si el intercambio aún no se completó). Si solo estaba
  // seleccionada, simplemente limpia la selección.
  async function cancelCoopOffer(): Promise<void> {
    const code = coopSessionCodeRef.current
    if (!code) return
    if (coopMyOfferSubmitted) {
      if (coopExchange?.completed || coopExchangeAppliedRef.current) {
        setCoopTradeMsg('El intercambio ya se completó, no se puede cancelar.')
        return
      }
      await cancelExchangeOffer(code, routeIndex)
      const offer = coopSubmittedOfferRef.current
      if (offer) {
        if (offer.kind === 'pokemon') {
          const rebuilt = rebuildPokemonFromOffer(offer)
          if (teamRef.current.length < maxTeamSize) {
            setTeam(prev => [...prev, rebuilt])
          } else {
            setPcStorage(prev => [...prev, rebuilt])
          }
        } else {
          setInventory(prev => [...prev, offer.itemName ?? 'Potion'])
        }
      }
      coopSubmittedOfferRef.current = null
      coopExchangeAppliedRef.current = false
      setCoopMyOfferSubmitted(false)
      setCoopMyOffer(null)
      setCoopExchange(null)
      setCoopTradeMsg('↩️ Intercambio cancelado. Puedes elegir otra oferta.')
    } else {
      setCoopMyOffer(null)
      setCoopTradeMsg('Selección cancelada.')
    }
  }

  function pickRocketPokemon(pokemon: Pokemon): void {
    if (runChallenges.soloStarter) {
      setBattleLog((prev) => ['🚫 Desafío Solo Starter: No puedes capturar Pokémon.', ...prev].slice(0, 15))
      setTeamRocketPickModal(false)
      setTeamRocketTeam([])
      completeCurrentNode()
      return
    }
    if (runChallenges.fixedTeam) {
      setBattleLog((prev) => ['🔒 Desafío Equipo Fijo: No puedes cambiar tu equipo.', ...prev].slice(0, 15))
      setTeamRocketPickModal(false)
      setTeamRocketTeam([])
      completeCurrentNode()
      return
    }
    let captured: Pokemon = { ...pokemon, hp: Math.floor(pokemon.maxHp / 2), holdItem: (difficulty === 'hard' || difficulty === 'infinite') ? null : pokemon.holdItem }
    if (runChallenges.noEvolution) captured = applyNoEvolutionBuff(captured)
    if (runChallenges.fixedLevel) captured = { ...captured, level: 50 }
    registerInPokedex(captured)
    if (captured.shiny) unlockAchievement('shiny_catch')
    if ((captured.attack + captured.defense + captured.speed + captured.maxHp) >= 600) unlockAchievement('legendary_catch')
    if (team.length >= 6) {
      setPcStorage((prev) => [...prev, captured])
      setBattleLog((prev) => [
        `✅ ¡${pokemon.name} capturado! Se envió al PC (equipo lleno).`,
        ...prev
      ].slice(0, 15))
    } else {
      setTeam((prev) => [...prev, captured])
      setBattleLog((prev) => [
        `✅ ¡${pokemon.name} se unió a tu equipo!`,
        ...prev
      ].slice(0, 15))
    }
    setTeamRocketPickModal(false)
    setTeamRocketTeam([])
    setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
    completeCurrentNode()
  }

  function removeFaintedPokemon(indexToRemove: number): void {
    const target = team[indexToRemove]
    if (!target || target.hp > 0) return

    const newTeam = team.filter((_, idx) => idx !== indexToRemove)
    setTeam(newTeam)

    if (activeIndex >= newTeam.length) {
      const healthyIdx = newTeam.findIndex((p) => p.hp > 0)
      setActiveIndex(healthyIdx !== -1 ? healthyIdx : 0)
    } else if (indexToRemove < activeIndex) {
      setActiveIndex((prev) => Math.max(0, prev - 1))
    }

    setBattleLog((prev) => [`Liberaste a ${target.name} del equipo.`, ...prev].slice(0, 15))
  }

  function withdrawFromPC(pcIndex: number): void {
    const pokemon = pcStorage[pcIndex]
    if (!pokemon) return
    if (runChallenges.soloStarter || runChallenges.fixedTeam) {
      setBattleLog((prev) => ['🚫 No puedes modificar tu equipo con este desafío.', ...prev].slice(0, 15))
      return
    }
    if (team.length < maxTeamSize) {
      setTeam((prev) => [...prev, pokemon])
      setPcStorage((prev) => prev.filter((_, i) => i !== pcIndex))
      setBattleLog((prev) => [`📦 ${pokemon.name} pasó del PC al equipo.`, ...prev].slice(0, 15))
    } else {
      const swapOut = team[activeIndex]
      const newTeam = team.map((p, i) => i === activeIndex ? pokemon : p)
      setTeam(newTeam)
      setPcStorage((prev) => prev.map((p, i) => i === pcIndex ? swapOut : p))
      setBattleLog((prev) => [`📦 Intercambiaste a ${swapOut.name} por ${pokemon.name} del PC.`, ...prev].slice(0, 15))
    }
  }

  function depositToPC(teamIndex: number): void {
    const pokemon = team[teamIndex]
    if (!pokemon) return
    if (runChallenges.soloStarter || runChallenges.fixedTeam) {
      setBattleLog((prev) => ['🚫 No puedes modificar tu equipo con este desafío.', ...prev].slice(0, 15))
      return
    }
    if (team.length <= 1) {
      setBattleLog((prev) => ['No puedes depositar a tu único Pokémon.', ...prev].slice(0, 15))
      return
    }
    setPcStorage((prev) => [...prev, pokemon])
    const newTeam = team.filter((_, i) => i !== teamIndex)
    setTeam(newTeam)
    if (activeIndex >= newTeam.length) {
      const healthyIdx = newTeam.findIndex((p) => p.hp > 0)
      setActiveIndex(healthyIdx !== -1 ? healthyIdx : 0)
    } else if (teamIndex < activeIndex) {
      setActiveIndex((prev) => Math.max(0, prev - 1))
    }
    setBattleLog((prev) => [`📦 ${pokemon.name} fue depositado en el PC.`, ...prev].slice(0, 15))
  }

  async function enterNode(): Promise<void> {
    if (!activePokemon || !currentNode) return

    if (currentNode.type === 'shop') {
      const allConsumableKeys = Object.keys(ALL_SHOP_ITEMS).filter(i => isConsumableUnlocked(i) && !POKEBALL_NAMES.includes(i) && !EVOLUTION_STONE_UNLOCK_IDS[i])
      const allHoldableKeys = HOLDABLE_ITEM_NAMES.filter(isHoldableUnlocked).filter(n => n !== 'Mega Stone' && n !== 'Dynamax Band' && !EVOLUTION_ITEM_UNLOCK_IDS[n])
      const shuffledConsumables = [...allConsumableKeys].sort(() => 0.5 - Math.random())
      const shuffledHoldables = [...allHoldableKeys].sort(() => 0.5 - Math.random())
      const selectedConsumables = shuffledConsumables.slice(0, 2)
      const selectedHoldables = shuffledHoldables.slice(0, 1)
      const unlockedNonBasicBalls = POKEBALL_NAMES.filter(b => b !== 'Poké Ball' && isPokeballUnlocked(b))
      const rareBalls = unlockedNonBasicBalls.length > 0
        ? unlockedNonBasicBalls.filter(b => b !== 'Master Ball' || Math.random() < 0.15)
        : []
      const ballPool = ['Poké Ball', ...rareBalls]
      const shuffledBalls = [...ballPool].sort(() => 0.5 - Math.random())
      const selectedBalls = shuffledBalls.slice(0, 2)
      const unlockedStones = EVOLUTION_STONES.filter(s => isEvolutionStoneUnlocked(s))
      const selectedStone = unlockedStones.length > 0 ? [unlockedStones[Math.floor(Math.random() * unlockedStones.length)]] : []
      const smokeBallChance = isConsumableUnlocked('Cuerda Huida') && Math.random() < 0.25 ? ['Cuerda Huida'] : []
      setShopStock([...selectedConsumables, ...selectedHoldables, ...selectedBalls, ...selectedStone, ...smokeBallChance])
      if (runChallenges.noPurchasing) {
        setBattleLog((prev) => [
          `🚫 Desafío Sin Compras: No puedes comprar nada en la tienda.`,
          ...prev
        ].slice(0, 15))
      }
      const potionBonus = modifier?.shopPotionBonus ?? 0
      if (potionBonus > 0) {
        setInventory((prev) => [...prev, ...Array(potionBonus).fill('Potion')])
        setBattleLog((prev) => [
          `Mercado en Oferta: ¡Recibes ${potionBonus} Poción${potionBonus > 1 ? 'es' : ''} gratis!`,
          ...prev
        ].slice(0, 15))
      }
      setScreen('shop')
      return
    }

    if (currentNode.type === 'trade') {
      setIsLoading(true)
      setApiError('')
      setCoopTradeMsg('')
      setCoopMyOffer(null)
      setCoopMyOfferSubmitted(false)
      setCoopExchange(null)
      coopExchangeAppliedRef.current = false
      coopSubmittedOfferRef.current = null
      setIsLoading(false)
      setScreen('trade')
      return
    }

    if (currentNode.type === 'spin') {
      const healingPool = Object.keys(ALL_SHOP_ITEMS).filter(i => isConsumableUnlocked(i) && !POKEBALL_NAMES.includes(i) && !EVOLUTION_STONE_UNLOCK_IDS[i] && i !== 'Cuerda Huida')
      const passivePool = HOLDABLE_ITEM_NAMES.filter(isHoldableUnlocked).filter(n => n !== 'Mega Stone' && n !== 'Dynamax Band' && !EVOLUTION_ITEM_UNLOCK_IDS[n])
      const unlockedStones = EVOLUTION_STONES.filter(s => isEvolutionStoneUnlocked(s))
      const selectedStone = unlockedStones.length > 0 ? [unlockedStones[Math.floor(Math.random() * unlockedStones.length)]] : []
      const shuffledH = [...healingPool].sort(() => 0.5 - Math.random())
      const shuffledP = [...passivePool].sort(() => 0.5 - Math.random())
      const items = [...shuffledH.slice(0, 3), ...shuffledP.slice(0, 2), ...selectedStone].sort(() => 0.5 - Math.random())
      setSpinItems(items)
      setSpinWinnerIndex(null)
      setSpinRevealed(false)
      setSpinAnimating(false)
      setScreen('spin')
      return
    }

    if (currentNode.type === 'pokeRand') {
      setIsLoading(true)
      setApiError('')
      try {
        const targetGen = getEffectiveGen()
        const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))
        const fetches = Array.from({ length: 6 }, () => {
          const targetLevel = difficulty === 'infinite'
            ? getMaxTeamLevel() + 1 + Math.floor(Math.random() * 2)
            : avgPlayerLevel + Math.floor(Math.random() * 3) - 1
          return getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length, coopModeRef.current ? targetLevel : undefined)
            .then((base) => {
              const levelDiff = targetLevel - base.level
              const scaled = scalePokemonForNode(base, currentNode, routeIndex, levelDiff, difficulty)
              return runChallenges.fixedLevel ? { ...scaled, level: 50 } : scaled
            })
        })
        const pokemonList = await Promise.all(fetches)
        setPokeRandPokemon(pokemonList)
        setPokeRandWinnerIndex(null)
        setPokeRandRevealed(false)
        setPokeRandAnimating(false)
        setScreen('pokeRand')
      } catch {
        setApiError('No se pudieron generar Pokémon. Reintenta.')
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (currentNode.type === 'move') {
      setIsLoading(true)
      setApiError('')
      setSelectedNewMove(null)
      setMoveOptionsByIndex({})
      try {
        const pokemon = team[activeIndex]
        if (!pokemon || !pokemon.rawLevelUpMoves || pokemon.rawLevelUpMoves.length === 0) {
          setBattleLog((prev) => ['Tu Pokémon no tiene movimientos disponibles para aprender.', ...prev].slice(0, 15))
          completeCurrentNode()
          setScreen('route')
          return
        }
        const currentMoveUrls = new Set(pokemon.moves.map(m => m.url).filter(Boolean))
        const learnable = pokemon.rawLevelUpMoves.filter(m => !currentMoveUrls.has(m.url))
        const pool = learnable.length >= 2 ? learnable : [...learnable, ...pokemon.rawLevelUpMoves.filter(m => currentMoveUrls.has(m.url))]
        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 10)
        const allDetails = (await Promise.all(shuffled.map(m => getMoveDetails(m.url)))).filter((m): m is Move => m !== null)
        const moveDetails = allDetails.slice(0, 2)
        if (moveDetails.length === 0) {
          setBattleLog((prev) => ['No se encontraron movimientos compatibles.', ...prev].slice(0, 15))
          completeCurrentNode()
          setScreen('route')
          return
        }
        setMoveOptions(moveDetails)
        setMoveOptionsByIndex({ [activeIndex]: moveDetails })
        setScreen('move')
      } catch {
        setApiError('No se pudieron cargar los movimientos. Reintenta.')
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (currentNode.type === 'gmax') {
      setIsLoading(true)
      setApiError('')
      try {
        const targetGen = getEffectiveGen()
        const gmaxId = Array.from(GMAX_CAPABLE_IDS)[Math.floor(Math.random() * GMAX_CAPABLE_IDS.size)]
        const base = await buildPokemonFromApi(gmaxId, targetGen, 1, false, difficulty)
        const gmaxLevelDelta = difficulty === 'infinite'
          ? getMaxTeamLevel() + 1 + Math.floor(Math.random() * 2) - base.level
          : (modifier?.enemyLevelDelta ?? 0)
        let scaled = scalePokemonForNode(base, currentNode, routeIndex, gmaxLevelDelta, difficulty)
        if (runChallenges.fixedLevel) scaled = { ...scaled, level: 50 }
        if (runChallenges.totalRandomizer) {
          scaled = {
            ...scaled,
            attack: scaled.attack + Math.floor(Math.random() * 20) - 10,
            defense: scaled.defense + Math.floor(Math.random() * 20) - 10,
            speed: scaled.speed + Math.floor(Math.random() * 20) - 10,
          }
        }
        const formId = GMAX_FORM_IDS[scaled.id]
        const gmaxFormId = Array.isArray(formId) ? formId[Math.floor(Math.random() * formId.length)] : formId
        const gmaxSprite = gmaxFormId
          ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${gmaxFormId}.png`
          : scaled.sprite
        const gmaxMultiplier = difficulty === 'infinite' ? 1.45 : difficulty === 'hard' ? 1.40 : 1.30
        const gmaxEnemy: Pokemon = {
          ...scaled,
          gmaxEvolved: true,
          gmaxTurnsLeft: 3,
          sprite: gmaxSprite,
          attack: Math.floor(scaled.attack * gmaxMultiplier),
          defense: Math.floor(scaled.defense * gmaxMultiplier),
          speed: Math.floor(scaled.speed * gmaxMultiplier),
          maxHp: Math.floor(scaled.maxHp * (1 + (gmaxMultiplier - 1) * 0.5)),
          hp: Math.floor(scaled.hp * (1 + (gmaxMultiplier - 1) * 0.5)),
          statStages: { attack: 0, defense: 0, speed: 0 },
        }
        seenInPokedex({ ...gmaxEnemy, id: gmaxFormId ?? gmaxEnemy.id, sprite: gmaxSprite })
        setIsTrainerBattle(false)
        setEnemy(gmaxEnemy)
        setBattleLog(prev => [`⚡ ¡Un Pokémon Gigamax aparece! ${gmaxEnemy.name} está listo para el combate.`, ...prev].slice(0, 15))
        startBattleMusic()
        setBattleTurns(0)
        setScreen('battle')
      } catch {
        setApiError('Error al generar el Pokémon G-MAX.')
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (currentNode.type === 'mega') {
      const alreadyHas = inventory.includes('Mega Stone') || team.some(p => p.holdItem === 'Mega Stone')
      if (!alreadyHas || difficulty === 'infinite') {
        setInventory(prev => [...prev, 'Mega Stone'])
        setBattleLog(prev => [`💎 ¡Recibes una Mega Piedra! Un Pokémon puede equiparla para mega-evolucionar en combate.`, ...prev].slice(0, 15))
      } else {
        const price = 200
        setMetaProgression(prev => ({ ...prev, pokeCoins: prev.pokeCoins + price }))
        setBattleLog(prev => [`💎 Ya tienes una Mega Piedra. Recibes ${price} PokéCoins en su lugar.`, ...prev].slice(0, 15))
      }
      setScreen('mega')
      return
    }

    if (currentNode.type === 'rest') {
    if (restEncounter) return
    setIsLoading(true)
    setApiError('')

    const effectiveGen = getEffectiveGen()
    const challengesUnlocked = effectiveGen === 0
      ? generations.every((g) => progression.completedMedium.includes(g))
      : progression.completedMedium.includes(effectiveGen)

    if (!challengesUnlocked) {
      setRunChallenges({ noShops: false, noRests: false, allShiny: false, allTeamRocket: false, nuzlocke: false, soloStarter: false, fixedTeam: false, noEvolution: false, noItems: false, restrictedMoves: false, firstStrike: false, fixedLevel: false, noCrits: false, typeRandomizer: false, noPurchasing: false, blindRoute: false, bossRush: false, speedrun: false, noMoney: false, doubleModifiers: false, scalingEnemies: false, noHealing: false, ironman: false, totalRandomizer: false, nuzlockeHardcore: false, challengeGauntlet: false, egglocke: false })
    }

    try {
      if (runChallenges.egglocke) {
        const targetGen = getEffectiveGen()
        const restPokemonBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length)
        const eggId = Math.floor(Math.random() * 900) + 1
        const eggEntry = {
          name: restPokemonBase.name,
          sprite: restPokemonBase.sprite,
          types: (restPokemonBase as any).types ?? ['normal'],
          hatchIn: 2 + Math.floor(Math.random() * 2),
          id: eggId
        }
        setEggInventory(prev => [...prev, eggEntry])
        const unlockedBalls = POKEBALL_NAMES.filter(b => isPokeballUnlocked(b) && b !== 'Master Ball')
        const ballReward = Math.random() < 0.35 ? randomFrom(unlockedBalls) : null
        const rewardItem = ballReward ?? (runChallenges.noHealing
          ? randomFrom(['X Attack', 'X Defense', 'X Speed'])
          : randomFrom(['Potion', 'Super Potion', 'X Attack', 'Oran Berry']))
        setRestRewardItem(rewardItem)
        setInventory((previous) => [...previous, rewardItem])
        setBattleLog((prev) => [
          `${currentNode.label}: ¡Obtuviste un Huevo de ${eggEntry.name}! (Eclosiona en ${eggEntry.hatchIn} battles)`,
          `También obtienes ${rewardItem}.`,
          ...prev
        ].slice(0, 15))
        completeCurrentNode()
        setScreen('route')
        return
      }

      const targetGen = getEffectiveGen()
      const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))
      const restTargetLevel = difficulty === 'infinite'
        ? getMaxTeamLevel() + (Math.floor(Math.random() * 3) - 1)
        : avgPlayerLevel - 2 + Math.floor(Math.random() * 3) - 1
      const restPokemonBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length, coopModeRef.current ? restTargetLevel : undefined)
      const levelDiff = restTargetLevel - restPokemonBase.level
      const generatedEncounter = scalePokemonForNode(restPokemonBase, currentNode, routeIndex, levelDiff, difficulty)
      if (shinyNextEncounter) {
        generatedEncounter.shiny = true
        generatedEncounter.sprite = makeShinySprite(generatedEncounter.sprite, generatedEncounter.id)
        setShinyNextEncounter(false)
      } else if (!runChallenges.allShiny && Math.random() < 0.02) {
        generatedEncounter.shiny = true
        generatedEncounter.sprite = makeShinySprite(generatedEncounter.sprite, generatedEncounter.id)
      }
      const unlockedBalls = POKEBALL_NAMES.filter(b => isPokeballUnlocked(b) && b !== 'Master Ball')
      const ballReward = Math.random() < 0.35 ? randomFrom(unlockedBalls) : null
      const rewardItem = ballReward ?? (runChallenges.noHealing
        ? randomFrom(['X Attack', 'X Defense', 'X Speed'])
        : randomFrom(['Potion', 'Super Potion', 'X Attack', 'Oran Berry']))

      setRestEncounter(generatedEncounter)
      seenInPokedex(generatedEncounter)
      setRestRewardItem(rewardItem)
      setInventory((previous) => [...previous, rewardItem])
      setBattleLog((prev) => [
        `${currentNode.label}: encuentras a ${generatedEncounter.name} y obtienes ${rewardItem}.`,
        ...prev
      ])
    } catch {
      setApiError('No se pudo generar el encuentro de descanso. Reintenta.')
    } finally {
      setIsLoading(false)
    }
    return
    }

    setIsLoading(true)
    setApiError('')

    try {
      const targetGen = getEffectiveGen()
      const isBoss = currentNode.type === 'boss'
      const isTeamRocket = currentNode.type === 'teamRocket'

      const extraEnemyLevels = runChallenges.scalingEnemies ? routeIndex : 0

      if (isTeamRocket) {
        const progress = routeIndex / Math.max(1, route.length - 1)
        // El tamaño del equipo escala con el progreso: 1-2 al inicio hasta 5-6 al final.
        const teamSize = Math.max(1, Math.min(6, 1 + Math.floor(progress * 4) + Math.floor(Math.random() * 2)))
        const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))

        const fetches = Array.from({ length: teamSize }, (_, idx) => {
          const targetLevel = difficulty === 'infinite'
            ? getMaxTeamLevel() + trainerMemberLevelOffset(idx, teamSize, false, difficulty)
            : avgPlayerLevel + trainerMemberLevelOffset(idx, teamSize, false, difficulty)
          // En Infinite, genera al rival directamente a su nivel objetivo para que
          // respete etapas evolutivas y movimientos según el nivel. En Co-op, igual.
          const baseStepIndex = difficulty === 'infinite' ? Math.max(0, targetLevel - 10) : routeIndex
          return getBalancedPokemonByGeneration(targetGen, baseStepIndex, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length, coopModeRef.current ? targetLevel : undefined)
            .then((base) => {
              const levelDiff = targetLevel - base.level
              let scaled = scalePokemonForNode(base, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff + extraEnemyLevels , difficulty)
              if (runChallenges.fixedLevel) scaled = { ...scaled, level: 50 }
              if (runChallenges.totalRandomizer) {
                scaled = {
                  ...scaled,
                  attack: scaled.attack + Math.floor(Math.random() * 20) - 10,
                  defense: scaled.defense + Math.floor(Math.random() * 20) - 10,
                  speed: scaled.speed + Math.floor(Math.random() * 20) - 10,
                }
              }
              return scaled
            })
        })
        const rocketTeam = await Promise.all(fetches)
        rocketTeam.forEach(p => seenInPokedex(p))

        setIsTrainerBattle(true)
        setTrainerTeam(rocketTeam)
        setTrainerPokemonIndex(0)
        setTrainerName('TeamR Grunt')
        setTrainerSprite("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='12' fill='%23111'/%3E%3Ctext x='48' y='62' font-family='Arial Black,Arial' font-size='52' font-weight='900' fill='%23ef4444' text-anchor='middle'%3ER%3C/text%3E%3Ccircle cx='48' cy='80' r='3' fill='%23ef4444'/%3E%3C/svg%3E")
        setTrainerBadge('')
        setEnemy({ ...rocketTeam[0], statStages: { attack: 0, defense: 0, speed: 0 } })
        setIsTeamRocketBattle(true)
        setTeamRocketFainted(false)
        setTeamRocketTeam(rocketTeam.map(p => ({ ...p, statStages: p.statStages ?? { attack: 0, defense: 0, speed: 0 } })))
        setTeamRocketStealMessage('')
        setTeamRocketPickModal(false)
        setBattleLog((prev) => [
          `🔴 ¡Un TeamR Grunt te desafía! Tiene ${teamSize} Pokémon.`,
          `Envía a ${rocketTeam[0].name} Nv.${rocketTeam[0].level}.`,
          ...prev
        ])
      } else {
        const willBeTrainer = isBoss || Math.random() < 0.5

      if (willBeTrainer) {
        const progress = routeIndex / Math.max(1, route.length - 1)
        const isLeague = currentNode.id >= 1000
        const maxSize = isBoss ? 6 : Math.max(1, Math.min(6, Math.floor(progress * 6) + 1))
        const teamSize = isBoss ? maxSize : Math.max(1, Math.min(maxSize, 1 + Math.floor(Math.random() * maxSize)))
        const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))

        const fetches = Array.from({ length: teamSize }, (_, idx) =>
          difficulty === 'coliseum'
            ? (async () => {
                try {
                  const ids = await getSpeciesIdsByGeneration(targetGen)
                  const id = ids[Math.floor(Math.random() * ids.length)] || 1
                  const pokemon = await buildPokemonFromApi(id, targetGen, 50, false, difficulty)
                  return { ...pokemon, level: 50, statStages: { attack: 0, defense: 0, speed: 0 } }
                } catch {
                  return { id: 1, name: 'Bulbasaur', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png', level: 50, hp: 100, maxHp: 100, attack: 50, defense: 50, speed: 50, moves: [], statStages: { attack: 0, defense: 0, speed: 0 } } as Pokemon
                }
              })()
            : (() => {
                const targetLevel = difficulty === 'infinite'
                  ? getMaxTeamLevel() + trainerMemberLevelOffset(idx, teamSize, isBoss, difficulty) + (isLeague ? 2 : 0)
                  : avgPlayerLevel + trainerMemberLevelOffset(idx, teamSize, isBoss, difficulty) + (isLeague ? 2 : 0)
                // En Infinite, genera al rival directamente a su nivel objetivo para que
                // respete etapas evolutivas y movimientos según el nivel. En Co-op,
                // igual: la especie debe ser coherente con el nivel objetivo real.
                const baseStepIndex = difficulty === 'infinite' ? Math.max(0, targetLevel - 10) : routeIndex
                return getBalancedPokemonByGeneration(targetGen, baseStepIndex, route.length, isBoss, runChallenges.allShiny, difficulty, isBoss ? badges.length : -1, badges.length, coopModeRef.current ? targetLevel : undefined)
                  .then((base) => {
                    const levelDiff = targetLevel - base.level
                    let scaled = scalePokemonForNode(base, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff + extraEnemyLevels , difficulty)
                    if (runChallenges.fixedLevel) scaled = { ...scaled, level: 50 }
                    if (runChallenges.totalRandomizer) {
                      scaled = {
                        ...scaled,
                        attack: scaled.attack + Math.floor(Math.random() * 20) - 10,
                        defense: scaled.defense + Math.floor(Math.random() * 20) - 10,
                        speed: scaled.speed + Math.floor(Math.random() * 20) - 10,
                      }
                    }
                    return scaled
                  })
              })()
        )
        const newTrainerTeam = await Promise.all(fetches)

        let chosenName = ''
        let chosenSprite = ''
        let chosenBadge = ''
        if (isBoss) {
          const leader = randomFrom(GYM_LEADERS)
          chosenName = leader.name
          chosenSprite = leader.sprite
          chosenBadge = leader.badge
        } else {
          const trainer = randomFrom(TRAINER_TYPES)
          chosenName = `${trainer.label} ${trainer.name}`
          chosenSprite = trainer.sprite
          chosenBadge = ''
        }

        setIsTrainerBattle(true)
        const megaTeam = newTrainerTeam.map(p => {
          if (isBoss && (difficulty === 'hard' || difficulty === 'infinite') && Math.random() < 0.15 && MEGA_CAPABLE_IDS.has(p.id)) {
            const formId = MEGA_FORM_IDS[p.id]
            if (formId) {
              const megaFormId = Array.isArray(formId) ? formId[Math.floor(Math.random() * formId.length)] : formId
              const megaSprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${megaFormId}.png`
              seenInPokedex({ ...p, id: megaFormId, sprite: megaSprite })
              return {
                ...p,
                id: megaFormId,
                sprite: megaSprite,
                attack: Math.floor(p.attack * 1.15),
                defense: Math.floor(p.defense * 1.15),
                speed: Math.floor(p.speed * 1.15),
              }
            }
          }
          return p
        })
        setTrainerTeam(megaTeam.map(p => ({ ...p, statStages: p.statStages ?? { attack: 0, defense: 0, speed: 0 } })))
        newTrainerTeam.forEach(p => seenInPokedex(p))
        setTrainerPokemonIndex(0)
        setTrainerName(chosenName)
        setTrainerSprite(chosenSprite)
        setTrainerBadge(chosenBadge)
        setEnemy({ ...megaTeam[0], statStages: { attack: 0, defense: 0, speed: 0 } })
        setBattleLog((prev) => [
          isBoss
            ? `🏆 ¡El Líder ${chosenName} quiere combatir! (${chosenBadge})`
            : `⚔️ ¡${chosenName} quiere combatir! Tiene ${teamSize} Pokémon.`,
          `Envía a ${megaTeam[0].name} Nv.${megaTeam[0].level}.`,
          ...prev
        ])
      } else {
        const avgPlayerLevel = Math.round(team.reduce((s, p) => s + p.level, 0) / Math.max(1, team.length))
        const wildLevelOffset = Math.floor(Math.random() * 3) - 1
        const targetLevel = difficulty === 'infinite'
          ? getMaxTeamLevel() + (Math.floor(Math.random() * 3) - 1)
          : avgPlayerLevel + wildLevelOffset
        const enemyBase = await getBalancedPokemonByGeneration(targetGen, routeIndex, route.length, false, runChallenges.allShiny, difficulty, -1, badges.length, coopModeRef.current ? targetLevel : undefined)
        const levelDiff = targetLevel - enemyBase.level
        let generatedEnemy = scalePokemonForNode(enemyBase, currentNode, routeIndex, (modifier?.enemyLevelDelta ?? 0) + levelDiff + extraEnemyLevels , difficulty)
        generatedEnemy = balanceWildPokemonToTeam(generatedEnemy, team, difficulty)
        if (runChallenges.fixedLevel) generatedEnemy = { ...generatedEnemy, level: 50 }
        if (runChallenges.totalRandomizer) {
          generatedEnemy = {
            ...generatedEnemy,
            attack: generatedEnemy.attack + Math.floor(Math.random() * 20) - 10,
            defense: generatedEnemy.defense + Math.floor(Math.random() * 20) - 10,
            speed: generatedEnemy.speed + Math.floor(Math.random() * 20) - 10,
          }
        }
        generatedEnemy = { ...generatedEnemy, statStages: { attack: 0, defense: 0, speed: 0 } }
        setIsTrainerBattle(false)
        setTrainerTeam([])
        setTrainerPokemonIndex(0)
        setTrainerName('')
        setTrainerSprite('')
    setTrainerBadge('')
    setReviveModal(null)
    setEquipModal(null)
        setEnemy(generatedEnemy)
        seenInPokedex(generatedEnemy)
        setBattleLog((prev) => [
          `🌿 ¡Un ${generatedEnemy.name} salvaje (Nv.${generatedEnemy.level}) apareció!`,
          ...prev
        ])
      }
      }

      setTeam(prev => prev.map(p => ({ ...p, megaEvolved: false, gmaxEvolved: false, gmaxTurnsLeft: undefined, statStages: { attack: 0, defense: 0, speed: 0 }, furiaActive: false })))
      setBattleMegaUsed(false)
      setBattleGmaxUsed(false)
      originalPokemonDataRef.current = {}
      battleStartHPRef.current = activePokemon.hp
      setBattleTurns(0)
      setScreen('battle')

      if (runChallenges.speedrun) {
        setSpeedrunSeconds(30)
        if (speedrunTimerRef.current) clearInterval(speedrunTimerRef.current)
        speedrunTimerRef.current = setInterval(() => {
          setSpeedrunSeconds(prev => {
            if (prev <= 1) {
              if (speedrunTimerRef.current) clearInterval(speedrunTimerRef.current)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } catch {
      setApiError('No se pudo generar rival desde PokeAPI. Reintenta.')
    } finally {
      setIsLoading(false)
    }
  }

  function spinRoulette(): void {
    if (spinAnimating || spinRevealed) return
    setSpinAnimating(true)
    setSpinWinnerIndex(null)
    setSpinRevealed(false)

    const winner = Math.floor(Math.random() * spinItems.length)
    const spinDuration = 3000
    const startTime = Date.now()

    function tick() {
      const elapsed = Date.now() - startTime
      if (elapsed < spinDuration) {
        setSpinWinnerIndex(Math.floor(Math.random() * spinItems.length))
        requestAnimationFrame(tick)
      } else {
        setSpinWinnerIndex(winner)
    setSpinAnimating(false)
    setPokeRandPokemon([])
    setPokeRandWinnerIndex(null)
    setPokeRandRevealed(false)
    setPokeRandAnimating(false)
        setSpinRevealed(true)
      }
    }
    requestAnimationFrame(tick)
  }

  function claimSpinItem(): void {
    if (spinWinnerIndex === null) return
    const item = spinItems[spinWinnerIndex]
    setInventory((prev) => [...prev, item])
    setBattleLog((prev) => [
      `🎰 ¡Giraste la Ruleta y obtuviste ${item}!`,
      ...prev
    ].slice(0, 15))
    unlockAchievement('gambler')
    completeCurrentNode()
    setScreen('route')
  }

  function pokeRandSpin(): void {
    if (pokeRandAnimating || pokeRandRevealed) return
    setPokeRandAnimating(true)
    setPokeRandWinnerIndex(null)
    setPokeRandRevealed(false)

    const winner = Math.floor(Math.random() * pokeRandPokemon.length)
    const spinDuration = 3000
    const startTime = Date.now()

    function tick() {
      const elapsed = Date.now() - startTime
      if (elapsed < spinDuration) {
        setPokeRandWinnerIndex(Math.floor(Math.random() * pokeRandPokemon.length))
        requestAnimationFrame(tick)
      } else {
        setPokeRandWinnerIndex(winner)
        setPokeRandAnimating(false)
        setPokeRandRevealed(true)
      }
    }
    requestAnimationFrame(tick)
  }

  function claimPokeRandPokemon(): void {
    if (pokeRandWinnerIndex === null) return
    let pokemon = pokeRandPokemon[pokeRandWinnerIndex]
    if (runChallenges.soloStarter) {
      setBattleLog((prev) => ['🚫 Desafío Solo Starter: No puedes capturar Pokémon.', ...prev].slice(0, 15))
      return
    }
    if (runChallenges.fixedTeam) {
      setBattleLog((prev) => ['🔒 Desafío Equipo Fijo: No puedes cambiar tu equipo.', ...prev].slice(0, 15))
      return
    }
    if (runChallenges.noEvolution) pokemon = applyNoEvolutionBuff(pokemon)
    if (runChallenges.fixedLevel) pokemon = { ...pokemon, level: 50 }
    if (difficulty === 'hard' || difficulty === 'infinite') pokemon = { ...pokemon, holdItem: null }
    registerInPokedex(pokemon)
    setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
    if (pokemon.shiny) unlockAchievement('shiny_catch')
    if ((pokemon.attack + pokemon.defense + pokemon.speed + pokemon.maxHp) >= 600) unlockAchievement('legendary_catch')
    unlockAchievement('pokeRand_master')
    if (team.length >= maxTeamSize) {
      setPcStorage((prev) => [...prev, pokemon])
      setBattleLog((prev) => [
        `🎲 ¡PokeRand: ${pokemon.name} se envió al PC (equipo lleno)!`,
        ...prev
      ].slice(0, 15))
    } else {
      setTeam((prev) => [...prev, pokemon])
      setBattleLog((prev) => [
        `🎲 ¡PokeRand: ${pokemon.name} se unió a tu equipo!`,
        ...prev
      ].slice(0, 15))
    }
    completeCurrentNode()
    setScreen('route')
  }

  function skipPokeRandPokemon(): void {
    setBattleLog((prev) => [
      `🎲 ¡PokeRand: decidiste no capturar al Pokémon.`,
      ...prev
    ].slice(0, 15))
    completeCurrentNode()
    setScreen('route')
  }

  function replaceTeamMove(moveIndex: number): void {
    if (!selectedNewMove || !activePokemon) return
    const nextTeam = team.map((pokemon, index) => {
      if (index !== activeIndex) return pokemon
      const newMoves = [...pokemon.moves]
      newMoves[moveIndex] = selectedNewMove
      return { ...pokemon, moves: newMoves }
    })
    setTeam(nextTeam)
    setBattleLog((prev) => [
      `📝 ¡${activePokemon.name} reemplazó ${activePokemon.moves[moveIndex].name} por ${selectedNewMove.name}!`,
      ...prev
    ].slice(0, 15))
    setMoveOptions([])
    setSelectedNewMove(null)
    setMoveOptionsByIndex({})
    completeCurrentNode()
    setScreen('route')
  }

  function skipMoveNode(): void {
    setBattleLog((prev) => [
      `📝 Decidiste no cambiar movimientos.`,
      ...prev
    ].slice(0, 15))
    setMoveOptions([])
    setSelectedNewMove(null)
    setMoveOptionsByIndex({})
    completeCurrentNode()
    setScreen('route')
  }

  function buyShopItem(itemName: string, qty = 1) {
    if (runChallenges.noPurchasing) {
      setBattleLog((prev) => ['🚫 Desafío Sin Compras: No puedes comprar nada.', ...prev].slice(0, 15))
      return
    }
    const item = ALL_SHOP_ITEMS[itemName]
    if (!item) return
    const discount = modifier?.shopDiscount ?? 0
    const hardMarkup = (difficulty === 'hard' || difficulty === 'infinite') ? 1.4 : 1
    const stageMarkup = 1 + badges.length * 0.15
    const finalPrice = Math.floor(item.price * (1 - discount) * hardMarkup * stageMarkup)
    const total = finalPrice * qty
    if (money < total) return

    setMoney((prev) => prev - total)
    setInventory((prev) => [...prev, ...Array(qty).fill(itemName)])
    setRunStats(prev => ({ ...prev, moneySpent: prev.moneySpent + total }))
    setBattleLog((prev) => [`Compraste ${qty}× ${itemName} por $${total}.`, ...prev].slice(0, 15))
    setShopQty(prev => ({ ...prev, [itemName]: 1 }))
  }

  function buyHoldableItem(itemName: string) {
    if (runChallenges.noPurchasing) {
      setBattleLog((prev) => ['🚫 Desafío Sin Compras: No puedes comprar nada.', ...prev].slice(0, 15))
      return
    }
    if (HOLDABLE_ITEM_NAMES.includes(itemName)) {
      const holdableIdx = inventory.indexOf(itemName)
      if (holdableIdx !== -1) {
        setEquipModal({ itemName, itemIndex: holdableIdx })
        return
      }
    }
    const item = HOLDABLE_ITEMS[itemName]
    if (!item) return
    const discount = modifier?.shopDiscount ?? 0
    const hardMarkup = (difficulty === 'hard' || difficulty === 'infinite') ? 1.4 : 1
    const stageMarkup = 1 + badges.length * 0.15
    const finalPrice = Math.floor(item.price * (1 - discount) * hardMarkup * stageMarkup)
    if (money < finalPrice) return

    setMoney((prev) => prev - finalPrice)
    setInventory((prev) => [...prev, itemName])
    setRunStats(prev => ({ ...prev, moneySpent: prev.moneySpent + finalPrice }))
    setBattleLog((prev) => [`Compraste ${itemName} por $${finalPrice}.`, ...prev].slice(0, 15))
  }

  function sellItems(itemName: string, qty: number) {
    if (qty <= 0) return
    const consumable = ALL_SHOP_ITEMS[itemName]
    const holdable = HOLDABLE_ITEMS[itemName]
    const data = consumable ?? holdable
    if (!data) return
    const sellPrice = Math.floor(data.price * 0.5)
    const total = sellPrice * qty

    setMoney((prev) => prev + total)
    setInventory((prev) => {
      const out: string[] = []
      let remaining = qty
      for (const i of prev) {
        if (i === itemName && remaining > 0) {
          remaining--
        } else {
          out.push(i)
        }
      }
      return out
    })
    setBattleLog((prev) => [`💰 Vendiste ${qty}× ${itemName} por $${total}.`, ...prev].slice(0, 15))
    setSellQty(prev => ({ ...prev, [itemName]: 1 }))
  }

  function equipItem(itemName: string, pokemonIndex: number) {
    const pokemon = team[pokemonIndex]
    if (!pokemon || pokemon.hp <= 0) return
    if (!HOLDABLE_ITEMS[itemName]) return

    const itemIdx = inventory.indexOf(itemName)
    if (itemIdx === -1) return

    setTeam((prev) =>
      prev.map((p, i) => {
        if (i !== pokemonIndex) return p
        const stats = HOLDABLE_ITEMS[itemName]
        let updated: Pokemon = {
          ...p,
          holdItem: itemName,
          maxHp: p.maxHp + (stats.maxHpMod ?? 0),
          hp: Math.min(p.hp + (stats.maxHpMod ?? 0), p.maxHp + (stats.maxHpMod ?? 0)),
        }
        return updated
      })
    )
    setInventory((prev) => {
      const idx = prev.indexOf(itemName)
      if (idx === -1) return prev
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
    })
    setBattleLog((prev) => [`Equipaste ${itemName} a ${pokemon.name}.`, ...prev].slice(0, 15))

    const syn = SYNERGIES.find(s => s.items.includes(itemName))
    if (syn) {
      const otherItem = syn.items.find(i => i !== itemName)
      const hasOtherInTeam = team.some((p, i) => i !== pokemonIndex && p.holdItem === otherItem)
      if (hasOtherInTeam) {
        setBattleLog((prev) => [`🔗 ¡SINERGIA: ${syn.name}! ${syn.desc}`, ...prev].slice(0, 15))
        unlockAchievement('synergy_master')
      }
    }
  }

  function unequipItem(pokemonIndex: number) {
    const pokemon = team[pokemonIndex]
    if (!pokemon || !pokemon.holdItem) return

    const itemName = pokemon.holdItem
    const stats = HOLDABLE_ITEMS[itemName]

    setTeam((prev) =>
      prev.map((p, i) => {
        if (i !== pokemonIndex) return p
        return {
          ...p,
          holdItem: null,
          maxHp: Math.max(1, p.maxHp - (stats?.maxHpMod ?? 0)),
          hp: p.hp <= 0 ? 0 : Math.min(p.hp, p.maxHp - (stats?.maxHpMod ?? 0)),
        }
      })
    )
    setInventory((prev) => [...prev, itemName])
    setBattleLog((prev) => [`Desequipaste ${itemName} de ${pokemon.name}.`, ...prev].slice(0, 15))
  }

  function processStatusTick(p: Pokemon): { updatedPokemon: Pokemon; skipTurn: boolean; log: string[] } {
    if (!p.status) return { updatedPokemon: p, skipTurn: false, log: [] }

    const logs: string[] = []
    let updated = { ...p }
    let skipTurn = false

    switch (p.status.type) {
      case 'burn': {
        const burnDmg = Math.max(1, Math.floor(p.maxHp / 16))
        updated = { ...updated, hp: Math.max(0, updated.hp - burnDmg) }
        logs.push(`🔥 ${updated.name} sufre daño por quemadura (${burnDmg}).`)
        break
      }
      case 'poison': {
        const poisonDmg = Math.max(1, Math.floor(p.maxHp / 8))
        updated = { ...updated, hp: Math.max(0, updated.hp - poisonDmg) }
        logs.push(`☠️ ${updated.name} sufre daño por veneno (${poisonDmg}).`)
        break
      }
      case 'paralysis': {
        if (Math.random() < 0.25) {
          skipTurn = true
          logs.push(`⚡ ${updated.name} está paralizado y no puede moverse.`)
        }
        break
      }
      case 'freeze': {
        if (Math.random() < 0.20) {
          updated = { ...updated, status: undefined }
          logs.push(`🧊 ${updated.name} se descongeló.`)
        } else {
          skipTurn = true
          logs.push(`🧊 ${updated.name} está congelado y no puede moverse.`)
        }
        break
      }
      case 'sleep': {
        const remaining = (p.status.turns ?? 2) - 1
        if (remaining <= 0) {
          updated = { ...updated, status: undefined }
          logs.push(`💤 ${updated.name} se despertó.`)
        } else {
          updated = { ...updated, status: { ...updated.status!, turns: remaining } }
          skipTurn = true
          logs.push(`💤 ${updated.name} está dormido y no puede moverse.`)
        }
        break
      }
      case 'confusion': {
        const remaining = (p.status.turns ?? 3) - 1
        if (remaining <= 0) {
          updated = { ...updated, status: undefined }
          logs.push(`💫 ${updated.name} se desconfundió.`)
        } else {
          updated = { ...updated, status: { ...updated.status!, turns: remaining } }
        }
        break
      }
      case 'flinch': {
        skipTurn = true
        updated = { ...updated, status: undefined }
        logs.push(`❕ ${updated.name} está aturdido y pierde su turno.`)
        break
      }
    }

    if (updated.hp <= 0) {
      updated = { ...updated, hp: 0 }
      logs.push(`💀 ${updated.name} fue debilitado por su estado.`)
    }

    return { updatedPokemon: updated, skipTurn, log: logs }
  }

  function applyAilmentToTarget(target: Pokemon, move: Move): Pokemon {
    if (!move.ailment || !move.ailmentChance) return target
    if (target.status) return target
    if (Math.random() >= move.ailmentChance) return target

    const ailmentTurns: Record<StatusType, number> = {
      burn: 999,
      poison: 999,
      paralysis: 999,
      freeze: 999,
      sleep: Math.floor(Math.random() * 2) + 2,
      confusion: Math.floor(Math.random() * 3) + 2,
      flinch: 1,
    }

    return {
      ...target,
      status: { type: move.ailment, turns: ailmentTurns[move.ailment] },
    }
  }

  function performHit(
    attacker: Pokemon,
    defender: Pokemon,
    move: Move,
    isEnemyHit: boolean
  ): { updatedDefender: Pokemon; updatedAttacker: Pokemon; lines: string[]; attackerHeal: number; crits: number } {
    const enemyBoost = isEnemyHit ? modifier?.enemyAttackDelta ?? 0 : 0

    const attackerItem = attacker.holdItem ? HOLDABLE_ITEMS[attacker.holdItem] : null
    const defenderItem = defender.holdItem ? HOLDABLE_ITEMS[defender.holdItem] : null

    const playerAtkMod = !isEnemyHit ? (modifier?.playerAttackMod ?? 0) : 0
    const playerSpdMod = !isEnemyHit ? (modifier?.playerSpeedMod ?? 0) : 0
    const playerDefMod = isEnemyHit ? (modifier?.playerDefenseMod ?? 0) : 0
    const enemyDefDelta = !isEnemyHit ? (modifier?.enemyDefenseDelta ?? 0) : 0
    const enemySpdDelta = isEnemyHit ? (modifier?.enemySpeedDelta ?? 0) : 0

    // Burn halves attacker's physical attack
    const burnNerf = attacker.status?.type === 'burn' ? 0.5 : 1
    const paralysisSpdNerf = attacker.status?.type === 'paralysis' ? 0.75 : 1

    const atkStages = attacker.statStages ?? { attack: 0, defense: 0, speed: 0 }
    const defStages = defender.statStages ?? { attack: 0, defense: 0, speed: 0 }
    const atkStageMult = getStageMultiplier(atkStages.attack)
    const spdStageMult = getStageMultiplier(atkStages.speed)
    const defStageMult = getStageMultiplier(defStages.defense)

    const effectiveAttacker: Pokemon = {
      ...attacker,
      attack: Math.round(attacker.attack * (1 + (attackerItem?.attackMod ?? 0) + playerAtkMod) * burnNerf * atkStageMult),
      speed: Math.round(attacker.speed * (1 + (attackerItem?.speedMod ?? 0) + playerSpdMod) * paralysisSpdNerf * spdStageMult + enemySpdDelta)
    }
    const effectiveDefender: Pokemon = {
      ...defender,
      defense: Math.round(defender.defense * (1 + (defenderItem?.defenseMod ?? 0) + playerDefMod) * defStageMult + enemyDefDelta)
    }

    const effectiveMove = runChallenges.typeRandomizer
      ? { ...move, type: randomFrom(ALL_TYPES) }
      : move

    const defTypes = (effectiveDefender as any).types ?? []
    const primaryType = defTypes[0] || 'normal'
    const secondaryType = defTypes[1] || undefined

    const { effectiveness, message } = getTypeEffectiveness(effectiveMove.type, primaryType, secondaryType)

    // --- STAB (Same-Type Attack Bonus) ---
    const attackerTypes: string[] = (attacker as any).types ?? []
    const stabBonus = attackerTypes.some(t => t === effectiveMove.type) ? 1.5 : 1

    // --- Accuracy check ---
    if (move.accuracy !== null && move.accuracy < 100) {
      const accRoll = Math.random() * 100
      if (accRoll >= move.accuracy) {
        return {
          updatedDefender: defender,
          updatedAttacker: attacker,
          lines: [`${attacker.name} usó ${effectiveMove.name} pero falló.`],
          attackerHeal: 0,
          crits: 0,
        }
      }
    }

    // --- Multi-hit ---
    let totalHits = 1
    if (move.minHits && move.maxHits) {
      totalHits = Math.floor(Math.random() * (move.maxHits - move.minHits + 1)) + move.minHits
    }

    let currentDefender = effectiveDefender
    const lines: string[] = []
    let totalDamage = 0
    let totalCrits = 0

    for (let hit = 0; hit < totalHits; hit++) {
      const result = applyDamage(effectiveAttacker, currentDefender, effectiveMove, enemyBoost)
      let finalDamage = Math.floor(result.damage * effectiveness * stabBonus)
      if (attackerItem?.damageBoost) {
        finalDamage = Math.floor(finalDamage * (1 + attackerItem.damageBoost))
      }
      if (attackerItem?.lowHpBonus && attacker.hp < attacker.maxHp * 0.3) {
        finalDamage = Math.floor(finalDamage * (1 + attackerItem.lowHpBonus))
      }
      if (attackerItem?.firstStrikeBonus && attacker.hp === attacker.maxHp) {
        finalDamage = Math.floor(finalDamage * (1 + attackerItem.firstStrikeBonus))
      }
      if (defenderItem?.damageReduction) {
        finalDamage = Math.floor(finalDamage * (1 - defenderItem.damageReduction))
      }

      // --- Crit: base from items/modifiers + move crit stage ---
      const modCrit = !isEnemyHit ? (modifier?.playerCritChance ?? 0) : 0
      const moveCritStage = move.critRatio ?? 0
      const moveCritChance = moveCritStage >= 3 ? 0.5 : moveCritStage === 2 ? 0.25 : moveCritStage === 1 ? 0.125 : 0
      const totalCrit = (attackerItem?.critChance ?? 0) + modCrit + moveCritChance
      const isCrit = !runChallenges.noCrits && totalCrit > 0 && Math.random() < totalCrit
      if (isCrit) {
        finalDamage = Math.floor(finalDamage * 1.5)
        totalCrits++
      }

      const newHp = Math.max(0, currentDefender.hp - finalDamage)
      currentDefender = { ...currentDefender, hp: newHp }
      totalDamage += finalDamage

      let hitLine = totalHits > 1
        ? `${attacker.name} usa ${effectiveMove.name}${runChallenges.typeRandomizer && effectiveMove.type !== move.type ? ` [${effectiveMove.type}]` : ''} (${hit + 1}/${totalHits}): ${finalDamage} de daño.`
        : `${attacker.name} usa ${effectiveMove.name}${runChallenges.typeRandomizer && effectiveMove.type !== move.type ? ` [${effectiveMove.type}]` : ''}: ${finalDamage} de daño.`
      if (isCrit) hitLine += ' ¡Golpe crítico!'
      if (message) hitLine += ` (${message})`
      lines.push(hitLine)

      if (currentDefender.hp <= 0) break
    }

    // --- Ailment application on first hit only ---
    if (totalHits > 0 && currentDefender.hp > 0) {
      const ailmentedDefender = applyAilmentToTarget(currentDefender, move)
      if (ailmentedDefender.status && ailmentedDefender.status.type !== currentDefender.status?.type) {
        currentDefender = ailmentedDefender
        const ailmentLabel = STATUS_LABELS[ailmentedDefender.status.type]
        lines.push(`${currentDefender.name} fue ${ailmentLabel.split(' ')[1]} ${ailmentLabel.split(' ')[0]}.`)
      }
    }

    // --- Stat changes ---
    let attackerStages = effectiveAttacker.statStages ?? { attack: 0, defense: 0, speed: 0 }
    if (effectiveMove.statChanges && effectiveMove.statChanges.length > 0) {
      const isDamaging = (effectiveMove.power ?? 0) > 0
      const cat = effectiveMove.metaCategory ?? ''
      for (const sc of effectiveMove.statChanges) {
        const rolled = sc.chance == null || Math.random() * 100 < sc.chance
        if (!rolled) continue
        const applyToAttacker = cat === 'net-good-stats'
          || (isDamaging && sc.change > 0)
        const applyToDefender = cat === 'net-bad-stats'
          || (isDamaging && sc.change < 0)
          || (!isDamaging && cat === '')
        if (!applyToAttacker && !applyToDefender) continue
        if (applyToAttacker) {
          const statKey = sc.stat as keyof typeof attackerStages
          const oldStage = attackerStages[statKey]
          const newStage = Math.max(-6, Math.min(6, oldStage + sc.change))
          if (newStage !== oldStage) {
            attackerStages = { ...attackerStages, [statKey]: newStage }
            const direction = sc.change > 0 ? 'subió' : 'bajó'
            const statName = statKey === 'attack' ? 'Ataque' : statKey === 'defense' ? 'Defensa' : 'Velocidad'
            lines.push(`${effectiveAttacker.name} ${direction} su ${statName}! (${oldStage > 0 ? '+' : ''}${oldStage} → ${newStage > 0 ? '+' : ''}${newStage})`)
          }
        } else if (applyToDefender && currentDefender.hp > 0) {
          let newStages = currentDefender.statStages ?? { attack: 0, defense: 0, speed: 0 }
          const statKey = sc.stat as keyof typeof newStages
          const oldStage = newStages[statKey]
          const newStage = Math.max(-6, Math.min(6, oldStage + sc.change))
          if (newStage !== oldStage) {
            newStages = { ...newStages, [statKey]: newStage }
            currentDefender = { ...currentDefender, statStages: newStages }
            const direction = sc.change > 0 ? 'subió' : 'bajó'
            const statName = statKey === 'attack' ? 'Ataque' : statKey === 'defense' ? 'Defensa' : 'Velocidad'
            lines.push(`${currentDefender.name} ${direction} su ${statName}! (${oldStage > 0 ? '+' : ''}${oldStage} → ${newStage > 0 ? '+' : ''}${newStage})`)
          }
        }
      }
    }

    // --- Furia (Rage): boost defender's Attack when hit while furiaActive ---
    if (totalDamage > 0 && currentDefender.hp > 0 && defender.furiaActive) {
      let newStages = currentDefender.statStages ?? { attack: 0, defense: 0, speed: 0 }
      if (newStages.attack < 6) {
        newStages = { ...newStages, attack: Math.min(6, newStages.attack + 1) }
        currentDefender = { ...currentDefender, statStages: newStages }
        lines.push(`💢 ¡${currentDefender.name} se enfurece! Su Ataque sube! (${newStages.attack > 0 ? '+' : ''}${newStages.attack})`)
      }
    }

    // --- Fire thaws frozen ---
    if (effectiveMove.type === 'fire' && currentDefender.status?.type === 'freeze' && currentDefender.hp > 0) {
      currentDefender = { ...currentDefender, status: undefined }
      lines.push(`🔥 ¡El ataque de fuego descongeló a ${currentDefender.name}!`)
    }

    // --- Recoil damage ---
    let recoilDamage = 0
    const hasAttackerStageChange = attackerStages.attack !== 0 || attackerStages.defense !== 0 || attackerStages.speed !== 0
    const furiaActive = move.name === 'Furia' || attacker.furiaActive || false
    let updatedAttacker = hasAttackerStageChange
      ? { ...attacker, statStages: attackerStages, furiaActive }
      : { ...attacker, furiaActive }
    if (move.recoilPercent && move.recoilPercent > 0 && totalDamage > 0) {
      recoilDamage = Math.floor(totalDamage * move.recoilPercent)
      updatedAttacker = { ...updatedAttacker, hp: Math.max(1, updatedAttacker.hp - recoilDamage) }
      lines.push(`${attacker.name} sufre recoil (${recoilDamage}).`)
    }

    // --- Drain (Absorb, Megaagotar, etc.) ---
    if (move.drainPercent && move.drainPercent > 0 && totalDamage > 0 && updatedAttacker.hp > 0) {
      const drainHeal = Math.floor(totalDamage * move.drainPercent)
      updatedAttacker = { ...updatedAttacker, hp: Math.min(updatedAttacker.maxHp, updatedAttacker.hp + drainHeal) }
      lines.push(`${attacker.name} drena ${drainHeal} HP.`)
    }

    // --- Lifesteal ---
    const modLifesteal = !isEnemyHit ? (modifier?.playerLifesteal ?? 0) : 0
    const totalLifesteal = (attackerItem?.lifesteal ?? 0) + modLifesteal
    let attackerHeal = 0
    if (totalLifesteal > 0 && totalDamage > 0) {
      attackerHeal = Math.floor(totalDamage * totalLifesteal)
    }

    return {
      updatedDefender: { ...currentDefender, defense: defender.defense },
      updatedAttacker,
      lines,
      attackerHeal,
      crits: totalCrits,
    }
  }

  async function onPlayerMove(move: Move): Promise<void> {
    if (!activePokemon || !enemy) return

    setBattleTurns(t => t + 1)

    if (runChallenges.speedrun && speedrunSeconds <= 0) {
      setBattleLog((prev) => ['⏱️ ¡Se acabó el tiempo! Pierdes tu turno.', ...prev].slice(0, 15))
      return
    }

    const nextTeam = team.map((pokemon, index) => (index === activeIndex ? { ...pokemon } : pokemon))
    let nextPlayer = { ...nextTeam[activeIndex] }
    let nextEnemy = { ...enemy }
    const logs: string[] = []

    // --- Status ticks at start of turn ---
    const playerTick = processStatusTick(nextPlayer)
    nextPlayer = playerTick.updatedPokemon
    logs.push(...playerTick.log)

    const enemyTick = processStatusTick(nextEnemy)
    nextEnemy = enemyTick.updatedPokemon
    logs.push(...enemyTick.log)

    // Check if status killed either side
    if (nextPlayer.hp <= 0) {
      nextTeam[activeIndex] = nextPlayer
      const nextAliveIndex = getFirstHealthyIndex(nextTeam, activeIndex)
      if (nextAliveIndex === -1) {
        const fullLogs = ['¡Todo tu equipo ha sido debilitado!', ...logs, ...battleLog]
        if (speedrunTimerRef.current) clearInterval(speedrunTimerRef.current)
        setTeam(nextTeam)
        setBattleLog(fullLogs)
        setDefeatSummary({ finalTeam: nextTeam, battleLog: fullLogs, enemy: nextEnemy, lastNodeLabel: currentNode?.label })
        handleInfiniteRunDefeat(nextTeam)
        const losses = record.losses + 1
        persistRecord(record.wins, losses)
        setWinStreak(0)
        localStorage.setItem('pokerand_streak', '0')
        setMetaProgression(prev => {
          const updated = { ...prev, totalRuns: prev.totalRuns + 1 }
          localStorage.setItem('pokerand_meta', JSON.stringify(updated))
          return updated
        })
        awardPokeCoins(5, 'Partida completada (derrota)')
        if (isDailyRunRef.current) { setDailyPlayed(true); localStorage.setItem('pokerand_daily', dailySeed) }
        setScreen('defeat')
        playDefeatMusic()
        return
      }
      if (runChallenges.nuzlocke) {
        const nuzlockeTeam = nextTeam.filter((_, idx) => idx !== activeIndex)
        setTeam(nuzlockeTeam)
        setActiveIndex(Math.max(0, Math.min(activeIndex, nuzlockeTeam.length - 1)))
        setBattleLog((prev) => [`💀 Nuzlocke: ${nextPlayer.name} fue debilitado por su estado y liberado.`, ...logs, ...prev].slice(0, 15))
      } else {
        setTeam(nextTeam)
        setActiveIndex(nextAliveIndex)
        setBattleLog((prev) => [`${nextPlayer.name} fue debilitado por su estado.`, ...logs, ...prev].slice(0, 15))
      }
      if (isTeamRocketBattle) setTeamRocketFainted(true)
      setEnemy(nextEnemy)
      return
    }
    if (nextEnemy.hp <= 0) {
      // Enemy died from status — treat as victory (reuses enemy defeat logic below)
      logs.push(`💀 ${nextEnemy.name} fue debilitado por su estado.`)
      // Fall through to the enemy.hp <= 0 block at the end of this function
    }

    // --- Skip turn checks ---
    const playerSkipped = playerTick.skipTurn
    const enemySkipped = enemyTick.skipTurn

    // --- Confusion self-hit check ---
    let playerConfusedSelfHit = false
    let enemyConfusedSelfHit = false
    if (nextPlayer.status?.type === 'confusion' && !playerSkipped && Math.random() < 1 / 3) {
      playerConfusedSelfHit = true
      const confusionDmg = Math.max(1, Math.floor((40 * nextPlayer.attack * 0.5) / Math.max(1, nextPlayer.defense) * 0.45 + 2))
      nextPlayer = { ...nextPlayer, hp: Math.max(0, nextPlayer.hp - confusionDmg) }
      logs.push(`💫 ¡${nextPlayer.name} se golpeó a sí mismo! (${confusionDmg})`)
    }
    if (nextEnemy.status?.type === 'confusion' && !enemySkipped && Math.random() < 1 / 3) {
      enemyConfusedSelfHit = true
      const confusionDmg = Math.max(1, Math.floor((40 * nextEnemy.attack * 0.5) / Math.max(1, nextEnemy.defense) * 0.45 + 2))
      nextEnemy = { ...nextEnemy, hp: Math.max(0, nextEnemy.hp - confusionDmg) }
      logs.push(`💫 ¡${nextEnemy.name} se golpeó a sí mismo! (${confusionDmg})`)
    }

    const playerItem = nextPlayer.holdItem ? HOLDABLE_ITEMS[nextPlayer.holdItem] : null
    const enemyItem = nextEnemy.holdItem ? HOLDABLE_ITEMS[nextEnemy.holdItem] : null
    const playerParalysisNerf = nextPlayer.status?.type === 'paralysis' ? 0.75 : 1
    const enemyParalysisNerf = nextEnemy.status?.type === 'paralysis' ? 0.75 : 1
    const playerPriority = move.priority ?? 0
    const enemyMoveForPriority = nextEnemy.moves[Math.floor(Math.random() * nextEnemy.moves.length)]
    const enemyPriority = enemyMoveForPriority.priority ?? 0

    let playerStarts: boolean
    if (playerPriority !== enemyPriority) {
      playerStarts = playerPriority > enemyPriority
    } else {
      const pStages = nextPlayer.statStages ?? { attack: 0, defense: 0, speed: 0 }
      const eStages = nextEnemy.statStages ?? { attack: 0, defense: 0, speed: 0 }
      const pSpdStage = getStageMultiplier(pStages.speed)
      const eSpdStage = getStageMultiplier(eStages.speed)
      const playerEffectiveSpeed = Math.round(nextPlayer.speed * (1 + (playerItem?.speedMod ?? 0)) * playerParalysisNerf * pSpdStage)
      const enemyEffectiveSpeed = Math.round(nextEnemy.speed * (1 + (enemyItem?.speedMod ?? 0)) * enemyParalysisNerf * eSpdStage)
      playerStarts = playerEffectiveSpeed >= enemyEffectiveSpeed
    }

    let playerCrits = 0
    const doPlayerAttack = async () => {
      if (nextPlayer.hp <= 0 || nextEnemy.hp <= 0 || playerSkipped || playerConfusedSelfHit) return
      if (move.name !== 'Furia') nextPlayer = { ...nextPlayer, furiaActive: false }
      const playerHit = performHit(nextPlayer, nextEnemy, move, false)
      const prevEnemyHp = nextEnemy.hp
      nextEnemy = playerHit.updatedDefender
      nextPlayer = playerHit.updatedAttacker
      if (nextEnemy.hp < prevEnemyHp) {
        setEnemyHitFlash(true)
        playHit()
        setTimeout(() => setEnemyHitFlash(false), 400)
      }
      playerCrits = playerHit.crits
      if (playerHit.attackerHeal > 0) {
        const healed = Math.min(nextPlayer.maxHp, nextPlayer.hp + playerHit.attackerHeal)
        nextPlayer = { ...nextPlayer, hp: healed }
        logs.push(`${nextPlayer.name} recupera ${playerHit.attackerHeal} HP por vampirismo.`)
      }
      logs.push(...playerHit.lines)

      if (runChallenges.firstStrike && nextEnemy.hp > 0) {
        const recoil = Math.floor(nextPlayer.maxHp * 0.08)
        nextPlayer = { ...nextPlayer, hp: Math.max(1, nextPlayer.hp - recoil) }
        logs.push(`⚡ ¡Recoil por Primer Golpe! ${nextPlayer.name} pierde ${recoil} HP.`)
      }
    }

    const doEnemyAttack = async () => {
      if (nextEnemy.hp <= 0 || nextPlayer.hp <= 0 || enemySkipped || enemyConfusedSelfHit) return
      const enemyMove = enemyMoveForPriority
      if (enemyMove.name !== 'Furia') nextEnemy = { ...nextEnemy, furiaActive: false }
      const enemyHit = performHit(nextEnemy, nextPlayer, enemyMove, true)
      nextPlayer = enemyHit.updatedDefender
      nextEnemy = enemyHit.updatedAttacker
      if (enemyHit.attackerHeal > 0) {
        const healed = Math.min(nextEnemy.maxHp, nextEnemy.hp + enemyHit.attackerHeal)
        nextEnemy = { ...nextEnemy, hp: healed }
        logs.push(`${nextEnemy.name} recupera ${enemyHit.attackerHeal} HP por vampirismo.`)
      }
      logs.push(...enemyHit.lines)
    }

    if (playerStarts) {
      await doPlayerAttack()
      await doEnemyAttack()
    } else {
      await doEnemyAttack()
      await doPlayerAttack()
    }

    // --- Efectos pasivos por turno ---
    const modHealBonus = modifier?.healBonus ?? 0
    const modHealReduction = modifier?.healReduction ?? 0
    const applyTurnEffects = (p: Pokemon): Pokemon => {
      const item = p.holdItem ? HOLDABLE_ITEMS[p.holdItem] : null
      if (!item) return p
      let updated = { ...p }
      if (item.healPerTurn && updated.hp > 0) {
        let healAmount = item.healPerTurn
        if (healAmount > 0) {
          healAmount = Math.floor(healAmount * (1 - modHealReduction)) + modHealBonus
        }
        const newHp = Math.min(updated.maxHp, updated.hp + healAmount)
        updated = { ...updated, hp: Math.max(1, newHp) }
        if (healAmount > 0) logs.push(`${updated.name} recupera ${healAmount} HP por ${item.name}.`)
        else logs.push(`${updated.name} pierde ${Math.abs(healAmount)} HP por ${item.name}.`)
      }
      return updated
    }

    nextPlayer = applyTurnEffects(nextPlayer)
    nextEnemy = applyTurnEffects(nextEnemy)

    // --- G-MAX turn counter decrement ---
    if (nextPlayer.gmaxEvolved && nextPlayer.gmaxTurnsLeft) {
      const newTurns = nextPlayer.gmaxTurnsLeft - 1
      nextPlayer = { ...nextPlayer, gmaxTurnsLeft: newTurns }
      if (newTurns <= 0) {
        const orig = originalPokemonDataRef.current[activeIndex]
        if (orig) {
          nextPlayer = { ...nextPlayer, gmaxEvolved: false, ...orig }
        } else {
          nextPlayer = { ...nextPlayer, gmaxEvolved: false }
        }
        logs.push(`⏳ ${nextPlayer.name} volvió a su tamaño normal.`)
      }
    }

    // --- Track run stats ---
    setRunStats(prev => {
      const playerDmg = Math.max(0, activePokemon.hp - nextPlayer.hp)
      const enemyDmg = Math.max(0, enemy.hp - nextEnemy.hp)
      return {
        ...prev,
        totalDamageDealt: prev.totalDamageDealt + enemyDmg,
        totalDamageTaken: prev.totalDamageTaken + playerDmg,
        totalTurns: prev.totalTurns + 1,
        lowestHPEver: Math.min(prev.lowestHPEver, nextPlayer.hp),
        critsLanded: prev.critsLanded + playerCrits,
      }
    })

    // --- Jugador debilitado ---
    if (nextPlayer.hp <= 0) {
      nextTeam[activeIndex] = nextPlayer
      const nextAliveIndex = getFirstHealthyIndex(nextTeam, activeIndex)

      if (nextAliveIndex === -1) {
        const fullLogs = ['¡Todo tu equipo ha sido debilitado!', ...logs, ...battleLog]
        if (speedrunTimerRef.current) clearInterval(speedrunTimerRef.current)
        setTeam(nextTeam)
        setBattleLog(fullLogs)
        setDefeatSummary({
          finalTeam: nextTeam,
          battleLog: fullLogs,
          enemy: nextEnemy,
          lastNodeLabel: currentNode?.label
        })
        handleInfiniteRunDefeat(nextTeam)
        const losses = record.losses + 1
        persistRecord(record.wins, losses)
        setWinStreak(0)
        localStorage.setItem('pokerand_streak', '0')
        setMetaProgression(prev => {
          const updated = { ...prev, totalRuns: prev.totalRuns + 1 }
          localStorage.setItem('pokerand_meta', JSON.stringify(updated))
          return updated
        })
        awardPokeCoins(5, 'Partida completada (derrota)')
        if (isDailyRunRef.current) {
          setDailyPlayed(true)
          localStorage.setItem('pokerand_daily', dailySeed)
        }
        setScreen('defeat')
        playDefeatMusic()
        return
      }

      if (runChallenges.nuzlocke) {
        const nuzlockeTeam = nextTeam.filter((_, idx) => idx !== activeIndex)
        const newActiveIdx = Math.min(activeIndex, nuzlockeTeam.length - 1)
        setTeam(nuzlockeTeam)
        setActiveIndex(Math.max(0, newActiveIdx))
        setBattleLog((prev) => [`💀 Nuzlocke: ${nextPlayer.name} fue debilitado y liberado.`, ...logs, ...prev].slice(0, 15))
      } else {
        setTeam(nextTeam)
        setActiveIndex(nextAliveIndex)
        setBattleLog((prev) => [`${nextPlayer.name} cayó debilitado.`, ...logs, ...prev].slice(0, 15))
      }
      if (isTeamRocketBattle) setTeamRocketFainted(true)
      setEnemy(nextEnemy)
      return
    }

    // --- Enemigo derrotado ---
    if (nextEnemy.hp <= 0) {
      // --- Batalla de entrenador: verificar si hay más Pokémon ---
      const baseLevelsGained = runChallenges.fixedLevel ? 0 : 1

      // Subida de nivel para TODOS los miembros vivos del equipo
      const updatedTeamPromises = nextTeam.map(async (pokemon) => {
        if (pokemon.hp <= 0) return pokemon

        const levelsGained = baseLevelsGained

        const hpGain = levelsGained * 3
        const atkGain = levelsGained * 2
        const defGain = levelsGained * 2
        const spdGain = levelsGained * 2
        const oldLevel = pokemon.level
        const newLevel = oldLevel + levelsGained
        const newMaxHp = pokemon.maxHp + hpGain

        let updatedPokemon: Pokemon = {
          ...pokemon,
          level: runChallenges.fixedLevel ? 50 : newLevel,
          maxHp: newMaxHp,
          hp: Math.min(newMaxHp, pokemon.hp + (difficulty === 'coliseum' ? 0 : Math.round(newMaxHp * 0.10)) + hpGain),
          attack: pokemon.attack + atkGain,
          defense: pokemon.defense + defGain,
          speed: pokemon.speed + spdGain
        }

        if (levelsGained > 0) {
          updatedPokemon = { ...updatedPokemon, level: newLevel }
        }

        // Auto-evolución al alcanzar el nivel de evolución
        if (!runChallenges.noEvolution && updatedPokemon.evolutionLevel && updatedPokemon.level >= updatedPokemon.evolutionLevel) {
          const itemOk = !updatedPokemon.heldItemRequired || updatedPokemon.holdItem === updatedPokemon.heldItemRequired
          if (itemOk) {
            try {
              const evolved = await evolvePokemon(updatedPokemon)
              if (evolved) {
                const consumedItem = updatedPokemon.holdItem
                const { updatedPokemon: finalEvolved } = await checkAndLearnNewMove(evolved, oldLevel, updatedPokemon.level, difficulty)
                registerInPokedex(finalEvolved)
                playEvolution()
                setEvoPopup({ oldSprite: updatedPokemon.sprite, newSprite: finalEvolved.sprite, oldName: updatedPokemon.name, newName: finalEvolved.name })
                setTimeout(() => setEvoPopup(null), 2000)
                updatedPokemon = finalEvolved
                if (consumedItem && updatedPokemon.heldItemRequired) {
                  updatedPokemon = { ...updatedPokemon, holdItem: undefined }
                  logs.push(`✅ ${consumedItem} fue consumido en la evolución.`)
                }
                setRunStats(prev => ({ ...prev, evolutions: prev.evolutions + 1 }))
                logs.push(`✨ ¡${updatedPokemon.name} evolucionó en ${finalEvolved.name}!`)
              }
            } catch {}
          }
        }

        return updatedPokemon
      })

      const newTeam = await Promise.all(updatedTeamPromises)
      const pendingPc: Pokemon[] = []

      const baseMoneyReward = Math.floor((40 + nextEnemy.level * 5) / (isTrainerBattle ? trainerTeam.length : 1))
      const hardMoneyPenalty = difficulty === 'hard' ? 0.6 : difficulty === 'infinite' ? 0.55 : 1
      const trainerMoneyPenalty = isTeamRocketBattle ? 0.4 : (isTrainerBattle && currentNode?.type !== 'boss') ? 0.5 : 1
      const wildMoneyPenalty = (!isTrainerBattle && currentNode?.type === 'battle') ? 0.7 : 1
      const moneyReward = runChallenges.noMoney ? 0 : Math.floor(baseMoneyReward * (modifier?.moneyMultiplier ?? 1) * hardMoneyPenalty * trainerMoneyPenalty * wildMoneyPenalty)
      if (!runChallenges.noMoney) setMoney((prev) => prev + moneyReward)

      setRunStats(prev => ({
        ...prev,
        battlesWon: prev.battlesWon + 1,
        moneyEarned: prev.moneyEarned + moneyReward,
        pokemonUsed: Array.from(new Set([...prev.pokemonUsed, ...newTeam.filter(p => p.hp > 0).map(p => p.name)])),
        teamSizeMax: Math.max(prev.teamSizeMax, newTeam.filter(p => p.hp > 0).length),
      }))

      // Egglocke: hatch eggs after battle
      if (runChallenges.egglocke && eggInventory.length > 0) {
        const hatchedEggs: typeof eggInventory = []
        const remainingEggs: typeof eggInventory = []
        for (const egg of eggInventory) {
          if (egg.hatchIn <= 1) {
            hatchedEggs.push(egg)
          } else {
            remainingEggs.push({ ...egg, hatchIn: egg.hatchIn - 1 })
          }
        }
        if (hatchedEggs.length > 0) {
          for (const egg of hatchedEggs) {
            const built = await buildPokemonFromApi(egg.id, getEffectiveGen(), nextPlayer.level, false, difficulty)
            const hatchedPokemon: Pokemon = {
              ...built,
              level: runChallenges.fixedLevel ? 50 : nextPlayer.level,
            }
            registerInPokedex(hatchedPokemon)
            if (newTeam.filter(p => p.hp > 0).length < maxTeamSize) {
              newTeam.push(hatchedPokemon)
              logs.push(`🥚 ¡El Huevo de ${egg.name} ha eclosionado!`)
            } else {
              pendingPc.push(hatchedPokemon)
              logs.push(`🥚 El Huevo de ${egg.name} eclosionó y fue enviado al PC.`)
            }
          }
        }
        setEggInventory(remainingEggs)
      }

      if (pendingPc.length > 0) {
        setPcStorage((prev) => [...prev, ...pendingPc])
      }

      let logMsg = runChallenges.noMoney
        ? `Derrotaste a ${nextEnemy.name}. ¡Todo el equipo ganó experiencia!`
        : `Derrotaste a ${nextEnemy.name}. ¡Todo el equipo ganó experiencia! +$${moneyReward}`

      // --- Batalla de entrenador: enviar siguiente Pokémon ---
      if (isTrainerBattle) {
        const updatedTrainerTeam = trainerTeam.map((p, idx) => idx === trainerPokemonIndex ? nextEnemy : p)
        const nextTrainerIndex = updatedTrainerTeam.findIndex((p, idx) => idx > trainerPokemonIndex && p.hp > 0)

        if (nextTrainerIndex === -1) {
          const baseTotalReward = 40 + nextEnemy.level * 5 * trainerTeam.length
          const totalReward = Math.floor(baseTotalReward * (modifier?.moneyMultiplier ?? 1) * hardMoneyPenalty * trainerMoneyPenalty)
          setMoney((prev) => prev + totalReward)
          setTeam(newTeam)
          setTrainerTeam(updatedTrainerTeam)
          setEnemy(nextEnemy)

          if (isTeamRocketBattle) {
            setIsTeamRocketBattle(false)
            if (teamRocketFainted) {
              const aliveTeam = newTeam.filter((p) => p.hp > 0)
              if (aliveTeam.length > 0) {
                const stolen = aliveTeam[Math.floor(Math.random() * aliveTeam.length)]
                const remainingTeam = newTeam.filter((p) => p !== stolen)
                const msg = `🔴 ¡TeamR te robó a ${stolen.name}! Se lo llevan...`
                setTeamRocketStealMessage(msg)
                setBattleLog((prev) => [
                  msg,
                  `🏆 ¡Derrotaste al TeamR Grunt! +$${totalReward + moneyReward}`,
                  logMsg,
                  ...logs,
                  ...prev
                ].slice(0, 15))
                const hasAliveAfter = remainingTeam.some((p) => p.hp > 0)
                if (hasAliveAfter) {
                  setTeam(remainingTeam)
                  if (activeIndex >= remainingTeam.length) {
                    const healthyIdx = remainingTeam.findIndex((p) => p.hp > 0)
                    setActiveIndex(healthyIdx !== -1 ? healthyIdx : 0)
                  }
                  setTimeout(() => { setTeamRocketStealMessage(''); completeCurrentNode() }, 3000)
                } else {
                  setTimeout(() => {
                    setTeamRocketStealMessage('')
                    setTeam(remainingTeam)
                    setDefeatSummary({
                      finalTeam: remainingTeam,
                      battleLog: [`¡TeamR te dejó sin Pokémon vivos!`, ...battleLog],
                      enemy: nextEnemy,
                      lastNodeLabel: currentNode?.label
                    })
                    handleInfiniteRunDefeat(remainingTeam)
                    const losses = record.losses + 1
                    persistRecord(record.wins, losses)
                    if (isDailyRunRef.current) {
                      setDailyPlayed(true)
                      localStorage.setItem('pokerand_daily', dailySeed)
                    }
                    setScreen('defeat')
                    playDefeatMusic()
                  }, 3000)
                }
                return
              }
            } else {
              const defeated = updatedTrainerTeam.filter((p) => p.hp <= 0)
              setTeamRocketTeam(defeated)
              setTeamRocketPickModal(true)
              setBattleLog((prev) => [
                `🏆 ¡Derrotaste al TeamR Grunt sin bajas! ¡Elige un Pokémon! +$${totalReward + moneyReward}`,
                logMsg,
                ...logs,
                ...prev
              ].slice(0, 15))
              setTeam(newTeam)
              return
            }
          }

          if (currentNode.type === 'gmax') {
            const alreadyHas = inventory.includes('Dynamax Band') || team.some(p => p.holdItem === 'Dynamax Band')
            if (!alreadyHas) {
              setInventory(prev => [...prev, 'Dynamax Band'])
              logs.push(`⚡ ¡Has obtenido la Banda Dynamax! Equípala para gigamaximar en combate.`)
            } else {
              const price = 100
              setMetaProgression(prev => ({ ...prev, pokeCoins: prev.pokeCoins + price }))
              logs.push(`⚡ Ya tienes una Banda Dynamax. Recibes ${price} PokéCoins en su lugar.`)
            }
          }
          setBattleLog((prev) => [
            `🏆 ¡Derrotaste al entrenador ${trainerName}! +$${totalReward + moneyReward}`,
            logMsg,
            ...logs,
            ...prev
          ].slice(0, 15))
          completeCurrentNode()
          return
        }

        const nextPkmn = updatedTrainerTeam[nextTrainerIndex]
        setTrainerTeam(updatedTrainerTeam)
        setTrainerPokemonIndex(nextTrainerIndex)
        setEnemy({ ...nextPkmn, statStages: { attack: 0, defense: 0, speed: 0 } })
        setTeam(newTeam)
        setBattleLog((prev) => [
          `${trainerName} envía a ${nextPkmn.name} Nv.${nextPkmn.level}!`,
          logMsg,
          ...logs,
          ...prev
        ].slice(0, 15))
        return
      }

      // --- G-MAX miniboss reward ---
      if (currentNode.type === 'gmax') {
        const alreadyHas = inventory.includes('Dynamax Band') || team.some(p => p.holdItem === 'Dynamax Band')
        if (!alreadyHas) {
          setInventory(prev => [...prev, 'Dynamax Band'])
          logs.push(`⚡ ¡Has obtenido la Banda Dynamax! Equípala para gigamaximar en combate.`)
        } else {
          const price = 100
          setMetaProgression(prev => ({ ...prev, pokeCoins: prev.pokeCoins + price }))
          logs.push(`⚡ Ya tienes una Banda Dynamax. Recibes ${price} PokéCoins en su lugar.`)
        }
      }

      // --- Batalla salvaje → victoria directa ---
      if (nextPlayer.hp >= battleStartHPRef.current) {
        unlockAchievement('perfect_battle')
      }
      logMsg = `🌿 Derrotaste al ${nextEnemy.name} salvaje y ganaste $${moneyReward}. ¡Equipo fortalecido!`
      setTeam(newTeam)
      setEnemy(nextEnemy)
      setBattleLog((prev) => [logMsg, ...logs, ...prev].slice(0, 15))
      completeCurrentNode()
      return
    }

    nextTeam[activeIndex] = nextPlayer
    setTeam(nextTeam)
    setEnemy(nextEnemy)
    setBattleLog((prev) => [...logs, ...prev].slice(0, 15))
  }

  function attemptCapture(ballName: string): void {
    if (!enemy || !activePokemon) return

    const ballIdx = inventory.indexOf(ballName)
    if (ballIdx === -1) return

    setCaptureModal(false)
    setCaptureMessage(null)

    const def = POKEBALL_DEFS[ballName]
    if (!def) return

    // Master Ball: captura automática
    if (def.isMaster) {
      setInventory(prev => prev.filter((_, i) => i !== ballIdx))
      const capturedPkmn = { ...enemy, holdItem: (difficulty === 'hard' || difficulty === 'infinite') ? null : enemy.holdItem }
      registerInPokedex(capturedPkmn)
      setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
      if (capturedPkmn.shiny) unlockAchievement('shiny_catch')
      const bst = capturedPkmn.attack + capturedPkmn.defense + capturedPkmn.speed + capturedPkmn.maxHp
      if (bst >= 600) unlockAchievement('legendary_catch')
      setBattleLog(prev => [`🏆 ¡${capturedPkmn.name} fue capturado con ${ballName}!`, ...prev].slice(0, 15))
      if (team.length >= maxTeamSize) {
        setPcStorage(prev => [...prev, capturedPkmn])
        setBattleLog(prev => [`📦 ${capturedPkmn.name} fue enviado al PC (equipo lleno).`, ...prev].slice(0, 15))
      } else {
        setTeam(prev => [...prev, capturedPkmn])
      }
      completeCurrentNode()
      return
    }

    // Fórmula de captura
    const maxHP = enemy.maxHp
    const currentHP = enemy.hp
    const hpFactor = Math.max(0.05, (3 * maxHP - 2 * currentHP) / (3 * maxHP))
    const ballRate = getPokeBallRate(ballName, enemy, battleTurns, !!pokedex[enemy.id]?.caught, activePokemon.level)
    const statusMult = enemy.status
      ? (enemy.status.type === 'sleep' || enemy.status.type === 'freeze' ? 2.5 : 1.5)
      : 1
    const speciesRate = (enemy.captureRate ?? 45) / 255
    const catchProbability = Math.min(hpFactor * ballRate * statusMult * speciesRate, 1)

    // Consumir la ball
    setInventory(prev => prev.filter((_, i) => i !== ballIdx))

    if (Math.random() < catchProbability) {
      // Captura exitosa
      const capturedPkmn = { ...enemy, holdItem: (difficulty === 'hard' || difficulty === 'infinite') ? null : enemy.holdItem }
      registerInPokedex(capturedPkmn)
      setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
      if (capturedPkmn.shiny) unlockAchievement('shiny_catch')
      const bst = capturedPkmn.attack + capturedPkmn.defense + capturedPkmn.speed + capturedPkmn.maxHp
      if (bst >= 600) unlockAchievement('legendary_catch')
      setBattleLog(prev => [`🏆 ¡${capturedPkmn.name} fue capturado con ${ballName}! (${Math.round(catchProbability * 100)}%)`, ...prev].slice(0, 15))
      if (team.length >= maxTeamSize) {
        setPcStorage(prev => [...prev, capturedPkmn])
        setBattleLog(prev => [`📦 ${capturedPkmn.name} fue enviado al PC (equipo lleno).`, ...prev].slice(0, 15))
      } else {
        setTeam(prev => [...prev, capturedPkmn])
      }
      completeCurrentNode()
    } else {
      // Falló
      setBattleLog(prev => [`💨 ¡${enemy.name} escapó de la ${ballName}! (${Math.round(catchProbability * 100)}%)`, ...prev].slice(0, 15))
      setCaptureMessage(`¡${enemy.name} escapó!`)
      setTimeout(() => setCaptureMessage(null), 2000)
    }
  }

  function openCaptureMenu(): void {
    const hasBalls = inventory.some(i => POKEBALL_NAMES.includes(i))
    if (!hasBalls) {
      setBattleLog(prev => ['No tienes Poké Balls para capturar.', ...prev].slice(0, 15))
      return
    }
    if (runChallenges.soloStarter) {
      setBattleLog(prev => ['🚫 Desafío Solo Starter: No puedes capturar Pokémon.', ...prev].slice(0, 15))
      return
    }
    if (runChallenges.fixedTeam) {
      setBattleLog(prev => ['🔒 Desafío Equipo Fijo: No puedes cambiar tu equipo.', ...prev].slice(0, 15))
      return
    }
    setCaptureModal(true)
  }

  function megaEvolveActive(): void {
    if (!activePokemon || activePokemon.holdItem !== 'Mega Stone' || battleMegaUsed || activePokemon.gmaxEvolved || !MEGA_CAPABLE_IDS.has(activePokemon.id)) return
    const formId = MEGA_FORM_IDS[activePokemon.id]
    const megaFormId = Array.isArray(formId) ? formId[Math.floor(Math.random() * formId.length)] : formId
    const megaSprite = megaFormId
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${megaFormId}.png`
      : null
    setTeam(prev => prev.map((p, i) => i === activeIndex ? {
      ...p,
      megaEvolved: true,
      sprite: megaSprite ?? p.sprite,
      attack: Math.floor(p.attack * 1.15),
      defense: Math.floor(p.defense * 1.15),
      speed: Math.floor(p.speed * 1.15),
    } : p))
    if (megaFormId) {
      registerInPokedex({ ...activePokemon, id: megaFormId, sprite: megaSprite ?? activePokemon.sprite })
    }
    originalPokemonDataRef.current[activeIndex] = {
      sprite: activePokemon.sprite,
      attack: activePokemon.attack,
      defense: activePokemon.defense,
      speed: activePokemon.speed,
    }
    setBattleMegaUsed(true)
    setMetaProgression(prev => {
      const totalMegas = prev.totalMegas + 1
      const updated = { ...prev, totalMegas }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
    unlockAchievement('first_mega')
    setBattleLog(prev => [`💥 ¡${activePokemon.name} ha mega-evolucionado! Stats aumentados un 15%.`, ...prev].slice(0, 15))
  }

  function gmaxEvolveActive(): void {
    if (!activePokemon || activePokemon.holdItem !== 'Dynamax Band' || battleGmaxUsed || activePokemon.gmaxEvolved || !GMAX_CAPABLE_IDS.has(activePokemon.id)) return
    const formId = GMAX_FORM_IDS[activePokemon.id]
    const gmaxFormId = Array.isArray(formId) ? formId[Math.floor(Math.random() * formId.length)] : formId
    const gmaxSprite = gmaxFormId
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${gmaxFormId}.png`
      : null
    setTeam(prev => prev.map((p, i) => i === activeIndex ? {
      ...p,
      gmaxEvolved: true,
      gmaxTurnsLeft: 3,
      sprite: gmaxSprite ?? p.sprite,
      attack: Math.floor(p.attack * 1.15),
      defense: Math.floor(p.defense * 1.15),
      speed: Math.floor(p.speed * 1.15),
    } : p))
    if (gmaxFormId) {
      registerInPokedex({ ...activePokemon, id: gmaxFormId, sprite: gmaxSprite ?? activePokemon.sprite })
    }
    if (!originalPokemonDataRef.current[activeIndex]) {
      originalPokemonDataRef.current[activeIndex] = {
        sprite: activePokemon.sprite,
        attack: activePokemon.attack,
        defense: activePokemon.defense,
        speed: activePokemon.speed,
      }
    }
    setBattleGmaxUsed(true)
    setMetaProgression(prev => {
      const totalGmax = prev.totalGmax + 1
      const updated = { ...prev, totalGmax }
      localStorage.setItem('pokerand_meta', JSON.stringify(updated))
      return updated
    })
    unlockAchievement('first_gmax')
    unlockAchievement('gmax_master')
    setBattleLog(prev => [`⚡ ¡${activePokemon.name} ha gigamaximado! Stats aumentados un 15% por 3 turnos.`, ...prev].slice(0, 15))
  }

  function switchActive(index: number): void {
    const target = team[index]
    if (!target || target.hp <= 0 || index === activeIndex) return
    const orig = originalPokemonDataRef.current[activeIndex]
    setTeam(prev => prev.map((p, i) => {
      if (i === activeIndex && orig) return { ...p, megaEvolved: false, gmaxEvolved: false, gmaxTurnsLeft: undefined, ...orig }
      return p
    }))
    setActiveIndex(index)
    if (screen === 'move') {
      setSelectedNewMove(null)
      if (moveOptionsByIndex[index]) {
        setMoveOptions(moveOptionsByIndex[index])
      } else {
        setMoveOptions([])
        const pokemon = team[index]
        if (pokemon?.rawLevelUpMoves && pokemon.rawLevelUpMoves.length > 0) {
          const currentMoveUrls = new Set(pokemon.moves.map(m => m.url).filter(Boolean))
          const learnable = pokemon.rawLevelUpMoves.filter(m => !currentMoveUrls.has(m.url))
          const pool = learnable.length >= 2 ? learnable : [...learnable, ...pokemon.rawLevelUpMoves.filter(m => currentMoveUrls.has(m.url))]
          const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 10)
          Promise.all(shuffled.map(m => getMoveDetails(m.url))).then(moveDetails => {
            const filtered = moveDetails.filter((m): m is Move => m !== null).slice(0, 2)
            setMoveOptions(filtered)
            setMoveOptionsByIndex(prev => ({ ...prev, [index]: filtered }))
          })
        }
      }
    }
  }

  async function handleStoneEvolution(teamIndex: number): Promise<void> {
    if (!stoneEvoModal) return
    const targetPokemon = team[teamIndex]
    if (!targetPokemon) return
    const stoneItemName = EVOLUTION_STONE_ITEM_NAMES[stoneEvoModal.stoneName]
    if (!stoneItemName) return

    setIsLoading(true)
    try {
      const result = await canEvolveWithStone(targetPokemon.id, stoneItemName)
      if (!result.canEvolve || !result.evolvedName) {
        setBattleLog((prev) => [`${stoneEvoModal.stoneName} no tiene efecto en ${targetPokemon.name}.`, ...prev].slice(0, 15))
        setStoneEvoModal(null)
        setStoneEvoTargets([])
        setStoneEvoCanEvolve(new Set())
        return
      }

      const evolvedName = result.evolvedName.includes('-') ? stripRegional(result.evolvedName) : result.evolvedName
      const newBase = await buildPokemonFromApi(evolvedName, 1, targetPokemon.level, targetPokemon.shiny ?? false)
      const evolved: Pokemon = {
        ...newBase,
        name: evolvedName === 'greninja-ash' ? 'Greninja Ash' : newBase.name,
        level: targetPokemon.level,
        maxHp: newBase.maxHp + 15,
        hp: newBase.maxHp + 15,
        attack: newBase.attack + 5,
        defense: newBase.defense + 5,
        speed: newBase.speed + 3,
        holdItem: targetPokemon.holdItem,
      }
      registerInPokedex(evolved)
      playEvolution()
      setEvoPopup({ oldSprite: targetPokemon.sprite, newSprite: evolved.sprite, oldName: targetPokemon.name, newName: evolved.name })
      setTimeout(() => setEvoPopup(null), 2000)
      setTeam(prev => prev.map((p, i) => i === teamIndex ? evolved : p))
      setRunStats(prev => ({ ...prev, evolutions: prev.evolutions + 1 }))
      setInventory(prev => prev.filter((_, i) => i !== stoneEvoModal.stoneIndex))
      setBattleLog((prev) => [`✨ ¡${targetPokemon.name} evolucionó en ${evolved.name} con ${stoneEvoModal.stoneName}!`, ...prev].slice(0, 15))
    } catch {
      setApiError('Error al procesar la evolución.')
    } finally {
      setIsLoading(false)
      setStoneEvoModal(null)
      setStoneEvoTargets([])
      setStoneEvoCanEvolve(new Set())
    }
  }

  function consumeInventoryItem(itemName: string): void {
    const itemIndex = inventory.indexOf(itemName)
    if (itemIndex === -1) return
    if (HOLDABLE_ITEMS[itemName]) return
    if (POKEBALL_NAMES.includes(itemName)) {
      if (screen === 'battle' && enemy && !isTrainerBattle && currentNode?.type !== 'gmax') {
        if (isLoading) return
        if (runChallenges.soloStarter) {
          setBattleLog((prev) => ['🚫 Desafío Solo Starter: No puedes capturar Pokémon.', ...prev].slice(0, 15))
          return
        }
        if (runChallenges.fixedTeam) {
          setBattleLog((prev) => ['🔒 Desafío Equipo Fijo: No puedes cambiar tu equipo.', ...prev].slice(0, 15))
          return
        }
        attemptCapture(itemName)
      }
      return
    }

    if (EVOLUTION_STONE_UNLOCK_IDS[itemName] || itemName === 'Gorra de Ash') {
      const candidates = team.filter(p => p.hp > 0)
      if (candidates.length === 0) {
        setBattleLog((prev) => ['No tienes Pokémon en pie para usar la piedra.', ...prev].slice(0, 15))
        return
      }
      setStoneEvoTargets(candidates)
      setStoneEvoModal({ stoneName: itemName, stoneIndex: itemIndex })
      setStoneEvoCanEvolve(new Set())
      const stoneItemName = EVOLUTION_STONE_ITEM_NAMES[itemName]
      if (stoneItemName) {
        Promise.all(candidates.map(p => canEvolveWithStone(p.id, stoneItemName)))
          .then(results => {
            const evolvable = new Set<number>()
            candidates.forEach((p, i) => {
              if (results[i]?.canEvolve) {
                const realIdx = team.indexOf(p)
                if (realIdx >= 0) evolvable.add(realIdx)
              }
            })
            setStoneEvoCanEvolve(evolvable)
          })
          .catch(() => { /* sin resaltar si falla la consulta */ })
      }
      return
    }

    if (itemName === 'Cuerda Huida') {
      if (screen !== 'battle') {
        setBattleLog((prev) => ['La Cuerda Huida solo se puede usar durante un combate.', ...prev].slice(0, 15))
        return
      }
      if (currentNode?.type === 'boss') {
        setBattleLog((prev) => ['🚫 No puedes escapar de un combate contra un jefe.', ...prev].slice(0, 15))
        return
      }
      setInventory(prev => prev.filter((_, i) => i !== itemIndex))
      setBattleLog((prev) => [`💨 ¡Usaste la Cuerda Huida y escapaste del combate!`, ...prev].slice(0, 15))
      completeCurrentNode()
      return
    }

    if (runChallenges.noItems) {
      setBattleLog((prev) => ['🚫 Desafío Sin Objetos: No puedes usar items en batalla.', ...prev].slice(0, 15))
      return
    }

    if (runChallenges.noHealing && (itemName.includes('Potion') || itemName.includes('Berry') || itemName === 'Full Restore' || itemName === 'Full Heal' || itemName === 'Elixir' || itemName === 'Super Elixir' || itemName === 'Full Elixir')) {
      setBattleLog((prev) => ['🚫 Desafío Sin Curación: No puedes usar items de curación.', ...prev].slice(0, 15))
      return
    }

    if (itemName === 'Revive' || itemName === 'Max Revive') {
      const hasFainted = team.some((p) => p.hp <= 0)
      if (!hasFainted) {
        setBattleLog((prev) => ['No tienes ningún Pokémon debilitado para revivir.', ...prev].slice(0, 15))
        return
      }
      setReviveModal({ itemName, itemIndex })
      return
    }

    if (!activePokemon) return

    let updatedPokemon: Pokemon | null = null

    if (itemName === 'Potion' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 25)
    } else if (itemName === 'Super Potion' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 50)
    } else if (itemName === 'Hyper Potion' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 120)
    } else if (itemName === 'Full Restore' && (activePokemon.hp < activePokemon.maxHp || activePokemon.status)) {
      updatedPokemon = { ...activePokemon, hp: activePokemon.maxHp, status: undefined }
    } else if (itemName === 'Oran Berry' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 15)
    } else if (itemName === 'Lum Berry' && (activePokemon.hp < activePokemon.maxHp || activePokemon.status)) {
      updatedPokemon = { ...healPokemon(activePokemon, 30), status: undefined }
    } else if (itemName === 'Full Heal' && (activePokemon.hp < activePokemon.maxHp || activePokemon.status)) {
      updatedPokemon = { ...healPokemon(activePokemon, 40), status: undefined }
    } else if (itemName === 'X Attack') {
      updatedPokemon = { ...activePokemon, attack: activePokemon.attack + 5 }
    } else if (itemName === 'X Defense') {
      updatedPokemon = { ...activePokemon, defense: activePokemon.defense + 5 }
    } else if (itemName === 'X Speed') {
      updatedPokemon = { ...activePokemon, speed: activePokemon.speed + 5 }
    } else if (itemName === 'Elixir' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 80)
    } else if (itemName === 'Moomoo Milk' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 100)
    } else if (itemName === 'Lemonade' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 60)
    } else if (itemName === 'Soda Pop' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 40)
    } else if (itemName === 'Fresh Water' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 30)
    } else if (itemName === 'Berry Juice' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 20)
    } else if (itemName === 'Super Elixir' && activePokemon.hp < activePokemon.maxHp) {
      updatedPokemon = healPokemon(activePokemon, 200)
    } else if (itemName === 'Full Elixir') {
      updatedPokemon = { ...activePokemon, hp: activePokemon.maxHp, status: undefined }
    } else if (itemName === 'X Attack 2') {
      updatedPokemon = { ...activePokemon, attack: activePokemon.attack + 10 }
    } else if (itemName === 'X Defense 2') {
      updatedPokemon = { ...activePokemon, defense: activePokemon.defense + 10 }
    } else if (itemName === 'X Speed 2') {
      updatedPokemon = { ...activePokemon, speed: activePokemon.speed + 10 }
    }

    if (!updatedPokemon) return

    setTeam((previous) =>
      previous.map((pokemon, index) => (index === activeIndex ? updatedPokemon : pokemon))
    )
    setInventory((previous) => previous.filter((_, index) => index !== itemIndex))
    setBattleLog((prev) => [`Usaste ${itemName} en ${activePokemon.name}.`, ...prev].slice(0, 15))
  }

  function applyRevive(targetIndex: number): void {
    if (!reviveModal) return
    const { itemName, itemIndex } = reviveModal
    const target = team[targetIndex]
    if (!target || target.hp > 0) return

    const restoredHp = itemName === 'Max Revive' ? target.maxHp : Math.floor(target.maxHp * 0.5)
    const revivedPkmn: Pokemon = { ...target, hp: restoredHp }

    setTeam((prev) => prev.map((p, idx) => (idx === targetIndex ? revivedPkmn : p)))
    setInventory((prev) => prev.filter((_, idx) => idx !== itemIndex))
    setBattleLog((prev) => [`¡${revivedPkmn.name} ha sido revivido con ${revivedPkmn.hp} HP!`, ...prev].slice(0, 15))
    setReviveModal(null)
  }

  function captureRestPokemon(): void {
    if (!restEncounter) return

    if (runChallenges.soloStarter) {
      setBattleLog((prev) => ['🚫 Desafío Solo Starter: No puedes capturar Pokémon.', ...prev].slice(0, 15))
      completeCurrentNode()
      return
    }

    if (runChallenges.fixedTeam) {
      setBattleLog((prev) => ['🔒 Desafío Equipo Fijo: No puedes cambiar tu equipo.', ...prev].slice(0, 15))
      completeCurrentNode()
      return
    }

    const hpBonus = modifier?.playerMaxHpBonus ?? 0
    let captured: Pokemon = { ...restEncounter, maxHp: restEncounter.maxHp + hpBonus, hp: restEncounter.hp + hpBonus, holdItem: (difficulty === 'hard' || difficulty === 'infinite') ? null : restEncounter.holdItem }
    if (runChallenges.noEvolution) captured = applyNoEvolutionBuff(captured)
    if (runChallenges.fixedLevel) captured = { ...captured, level: 50 }
    registerInPokedex(captured)
    setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
    if (captured.shiny) unlockAchievement('shiny_catch')
    if ((captured.attack + captured.defense + captured.speed + captured.maxHp) >= 600) unlockAchievement('legendary_catch')
    if (team.length >= maxTeamSize) {
      setPcStorage((prev) => [...prev, captured])
      setBattleLog((prev) => [`Capturaste a ${captured.name} y se envió al PC (equipo lleno).`, ...prev].slice(0, 15))
    } else {
      setTeam((previous) => [...previous, captured])
      setBattleLog((prev) => [`Capturaste a ${captured.name}.`, ...prev].slice(0, 15))
    }
    completeCurrentNode()
  }

  function skipRestCapture(): void {
    if (!restEncounter) return

    setBattleLog((prev) => [`Dejaste ir a ${restEncounter.name}.`, ...prev].slice(0, 15))
    completeCurrentNode()
  }

  function captureLegendaryPokemon(): void {
    if (!legendaryEncounter) return

    if (runChallenges.soloStarter) {
      setBattleLog((prev) => ['🚫 Desafío Solo Starter: No puedes capturar Pokémon.', ...prev].slice(0, 15))
      return
    }

    if (runChallenges.fixedTeam) {
      setBattleLog((prev) => ['🔒 Desafío Equipo Fijo: No puedes cambiar tu equipo.', ...prev].slice(0, 15))
      return
    }

    const hpBonus = modifier?.playerMaxHpBonus ?? 0
    let captured: Pokemon = { ...legendaryEncounter, maxHp: legendaryEncounter.maxHp + hpBonus, hp: legendaryEncounter.hp + hpBonus, holdItem: (difficulty === 'hard' || difficulty === 'infinite') ? null : legendaryEncounter.holdItem }
    if (runChallenges.noEvolution) captured = applyNoEvolutionBuff(captured)
    if (runChallenges.fixedLevel) captured = { ...captured, level: 50 }
    registerInPokedex(captured)
    setRunStats(prev => ({ ...prev, captures: prev.captures + 1 }))
    if (captured.shiny) unlockAchievement('shiny_catch')
    if ((captured.attack + captured.defense + captured.speed + captured.maxHp) >= 600) unlockAchievement('legendary_catch')
    if (team.length >= maxTeamSize) {
      setPcStorage((prev) => [...prev, captured])
      setBattleLog((prev) => [`🐉 ¡Capturaste al legendario ${captured.name} y se envió al PC (equipo lleno)!`, ...prev].slice(0, 15))
    } else {
      setTeam((previous) => [...previous, captured])
      setBattleLog((prev) => [`🐉 ¡Capturaste al legendario ${captured.name}!`, ...prev].slice(0, 15))
    }
    setLegendaryEncounter(null)
  }

  function skipLegendaryCapture(): void {
    if (!legendaryEncounter) return

    setBattleLog((prev) => [`Dejaste ir al legendario ${legendaryEncounter.name}.`, ...prev].slice(0, 15))
    setLegendaryEncounter(null)
  }

  function handleInfiniteRunDefeat(finalTeam: Pokemon[]): void {
    if (difficulty !== 'infinite') {
      setScoreSubmitState('idle')
      return
    }
    if (!isLeaderboardEnabled()) {
      setScoreSubmitState('disabled')
      return
    }
    setSubmitIsNewBest(null)
    const durationSeconds = Math.max(0, Math.round((Date.now() - runStartTimeRef.current) / 1000))
    const entry: InfiniteScoreInsert = {
      node: routeIndex + 1,
      generation: currentRunGen,
      is_random: generation === 0,
      duration_seconds: durationSeconds,
      team: finalTeam.map((p) => ({ name: p.name, level: p.level, sprite: p.sprite, shiny: !!p.shiny })),
      challenges: runStats.challengesActive,
    }
    if (!authUser) {
      pendingScoreRef.current = entry
      localStorage.setItem('pokerand_pending_score', JSON.stringify(entry))
      setScoreSubmitState('loginRequired')
      return
    }
    void submitPendingScore(entry)
  }

  function handleEndRunConfirm(): void {
    playClick()
    setShowEndRunModal(false)
    if (speedrunTimerRef.current) {
      clearInterval(speedrunTimerRef.current)
      speedrunTimerRef.current = null
    }
    const finalTeam = team
    setVoluntaryRunEnd(true)
    setDefeatSummary({
      finalTeam,
      battleLog: [`🏁 Has terminado la aventura en el Nodo ${routeIndex + 1}.`, ...battleLog],
      lastNodeLabel: currentNode?.label,
    })
    handleInfiniteRunDefeat(finalTeam)
    setScreen('defeat')
    playDefeatMusic()
  }

  async function submitPendingScore(entry?: InfiniteScoreInsert): Promise<void> {
    const target = entry ?? pendingScoreRef.current
    if (!target) return
    setScoreSubmitState('submitting')
    const result = await submitInfiniteScore(target)
    if (result.ok) {
      pendingScoreRef.current = null
      localStorage.removeItem('pokerand_pending_score')
      setSubmitIsNewBest(result.isNewBest)
      setScoreSubmitState('submitted')
      if (showLeaderboardRef.current) void loadLeaderboard()
    } else {
      setScoreSubmitState('error')
    }
  }

  function openLeaderboard(): void {
    playClick()
    setShowLeaderboard(true)
    void loadLeaderboard()
  }

  function friendlyAuthError(msg: string): string {
    if (/rate limit|rate_limit/i.test(msg)) {
      return 'Demasiados intentos en poco tiempo. Supabase limita los intentos de registro/login por hora; espera unos minutos y vuelve a intentarlo.'
    }
    if (/invalid login credentials/i.test(msg)) {
      return 'Email o contraseña incorrectos.'
    }
    return msg
  }

  async function handleAuthSubmit(): Promise<void> {
    setAuthMessage(null)
    if (authLoading) return
    if (!authEmail.trim() || !authPassword) {
      setAuthMessage({ type: 'error', text: 'Introduce tu email y contraseña.' })
      return
    }
    setAuthLoading(true)
    if (authMode === 'signup') {
      const username = authUsername.trim()
      if (!username) {
        setAuthLoading(false)
        setAuthMessage({ type: 'error', text: 'Elige un nombre de usuario.' })
        return
      }
      const taken = await isUsernameTaken(username)
      if (taken) {
        setAuthLoading(false)
        setAuthMessage({ type: 'error', text: 'Ese nombre de usuario ya está en uso.' })
        return
      }
      const res = await signUpWithUsername(authEmail, authPassword, username)
      if (!res.ok) {
        setAuthMessage({ type: 'error', text: friendlyAuthError(res.error ?? 'No se pudo crear la cuenta.') })
      } else if (res.needsEmailConfirmation) {
        setAuthMessage({ type: 'info', text: 'Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.' })
      } else {
        setAuthMessage({ type: 'success', text: 'Cuenta creada. ¡Bienvenido!' })
      }
    } else {
      const res = await signIn(authEmail, authPassword)
      if (!res.ok) {
        setAuthMessage({ type: 'error', text: friendlyAuthError(res.error ?? 'No se pudo iniciar sesión.') })
      }
    }
    setAuthLoading(false)
  }

  function handleLogout(): void {
    void signOut()
  }

  async function loadLeaderboard(): Promise<void> {
    if (!isLeaderboardEnabled()) {
      setLeaderboardEntries([])
      return
    }
    setLeaderboardLoading(true)
    const entries = await fetchInfiniteLeaderboard(50)
    setLeaderboardEntries(entries)
    setLeaderboardLoading(false)
  }

  function resetToSetup(): void {
    setScreen('setup')
    startMenuMusic()
    runStartTimeRef.current = 0
    setScoreSubmitState('idle')
    setSubmitIsNewBest(null)
    setShowEndRunModal(false)
    setVoluntaryRunEnd(false)
    setTeam([])
    setActiveIndex(0)
    setEnemy(null)
    setRoute([])
    setRouteIndex(0)
    setInventory([])
    setMoney(100)
    setShopStock([])
    setModifier(null)
    setModifier2(null)
    setBattleLog([])
    setApiError('')
    setRestEncounter(null)
    setRestRewardItem('')
    setLegendaryEncounter(null)
    setDefeatSummary(null)
    setVictoryUnlocks(null)
    setIsTrainerBattle(false)
    isDailyRunRef.current = false
    setTrainerTeam([])
    setTrainerPokemonIndex(0)
    setTrainerName('')
    setTrainerSprite('')
    setTrainerBadge('')
    setIsTeamRocketBattle(false)
    setTeamRocketFainted(false)
    setTeamRocketTeam([])
    setTeamRocketStealMessage('')
    setTeamRocketPickModal(false)
    setCoopMode(false)
    setCoopSessionCode('')
    setCoopSeed('')
    setCoopJoinCode('')
    setCoopMyRole(null)
    setCoopPartnerJoined(false)
    setCoopWaiting(false)
    setCoopStarting(false)
    coopAutoStartedRef.current = false
    setCoopSessionEndedMsg('')
    setCoopTradeMsg('')
    setCoopError('')
    setSpinItems([])
    setSpinWinnerIndex(null)
    setSpinRevealed(false)
    setSpinAnimating(false)
    setEggInventory([])
    setPcStorage([])
    setSpeedrunSeconds(0)
    battleStartHPRef.current = 0
    if (speedrunTimerRef.current) {
      clearInterval(speedrunTimerRef.current)
      speedrunTimerRef.current = null
    }
  }

  function onRestartRun(): void {
    if (screen === 'route' || screen === 'battle' || screen === 'shop' || screen === 'spin' || screen === 'pokeRand' || screen === 'move' || screen === 'mega' || screen === 'gmax' || screen === 'trade') {
      if (coopModeRef.current && coopSessionCodeRef.current) {
        void finishCoopSession(coopSessionCodeRef.current, 'lost')
      }
      resetToSetup()
    }
  }

  function closeOptions(): void {
    const wasInBattle = optionsBeganInBattle.current
    optionsBeganInBattle.current = false
    setShowOptions(false)
    if (wasInBattle) {
      startBattleMusic(true)
    } else {
      stopMusic()
      setTimeout(startMenuMusic, 350)
    }
  }

  const pokedexList = Object.values(pokedex)
  const pokedexSeen = pokedexList.filter(p => p.seen).length
  const pokedexCaught = pokedexList.filter(p => p.caught).length
  const filteredPokedex = pokedexList.filter((pkmn) => {
    const term = pokedexSearch.toLowerCase().trim()
    if (!term) return true
    const formattedId = `#${String(pkmn.id).padStart(3, '0')}`
    return pkmn.name.toLowerCase().includes(term) || String(pkmn.id).includes(term) || formattedId.includes(term)
  })

  const toggleMusicMuted = (): void => {
    playClick()
    const next = !musicMuted
    setMusicMuted(next)
    setMusicMutedState(next)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="left-toolbar">
          <button
            className="tiny-btn"
            type="button"
            title={musicMuted ? 'Activar música' : 'Silenciar música'}
            onClick={toggleMusicMuted}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {musicMuted ? (
                <>
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </>
              ) : (
                <>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </>
              )}
            </svg>
          </button>
          <button className="tiny-btn" type="button" onClick={() => setShowPokedex(true)}>
            Pokédex ({pokedexCaught}/{pokedexSeen})
          </button>
          <button className="tiny-btn" type="button" onClick={() => { playClick(); optionsBeganInBattle.current = screen === 'battle'; setShowOptions(!showOptions) }}>
            Opciones
          </button>
          <button className="tiny-btn" type="button" onClick={openLeaderboard}>
            Ranking ♾️
          </button>
          <button className="tiny-btn" type="button" onClick={() => { playClick(); setShowAchievements(!showAchievements) }}>
            Logros
          </button>
          <button className="tiny-btn" type="button" onClick={onRestartRun}>
            Volver a inicio
          </button>
        </div>
        <h1>PokeRand</h1>
        <div className="record-box">
          {winStreak >= 2 && <span style={{ color: '#ff8a33', fontWeight: 'bold', marginRight: '0.5rem' }}>🔥 {winStreak}</span>}
          <span style={{ color: '#ffcb05', fontWeight: 'bold' }}>🪙 {metaProgression.pokeCoins}</span>
          <span style={{ color: '#ffcb05', fontWeight: 'bold', marginLeft: '0.5rem' }}>💵 ${money}</span>
          <span style={{ color: '#10b981', fontWeight: 'bold' }}>W {record.wins}</span>
          <span style={{ color: '#ee3b2f', fontWeight: 'bold' }}>L {record.losses}</span>
        </div>
      </header>

      {/* Modal Revive: selección de objetivo */}
      {reviveModal && (
        <div className="modal-backdrop" onClick={() => setReviveModal(null)}>
          <div
            className="panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '1.5rem',
              maxWidth: '380px',
              width: '90%',
              margin: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              {ITEM_SPRITES[reviveModal.itemName] && (
                <img
                  src={ITEM_SPRITES[reviveModal.itemName]}
                  alt={reviveModal.itemName}
                  style={{ width: '36px', height: '36px', imageRendering: 'pixelated' }}
                />
              )}
              <div>
                <h3 style={{ margin: 0, color: '#ffcb05', fontSize: '1.1rem' }}>{reviveModal.itemName}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#9b98cf' }}>
                  {reviveModal.itemName === 'Max Revive' ? 'Revive con HP completo' : 'Revive con 50% HP'}
                </p>
              </div>
            </div>
            <p style={{ color: '#d9d6f2', fontSize: '0.85rem', marginBottom: '1rem' }}>Elige a qué Pokémon debilitado dárselo:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {team.map((pkmn, idx) => {
                const isFainted = pkmn.hp <= 0
                const restoredHp = reviveModal.itemName === 'Max Revive' ? pkmn.maxHp : Math.floor(pkmn.maxHp * 0.5)
                return (
                  <button
                    key={`revive-target-${idx}`}
                    type="button"
                    onClick={() => applyRevive(idx)}
                    disabled={!isFainted}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: isFainted ? '1px solid rgba(250, 204, 21, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                      background: isFainted ? 'rgba(250, 204, 21, 0.08)' : 'rgba(255,255,255,0.03)',
                      cursor: isFainted ? 'pointer' : 'not-allowed',
                      opacity: isFainted ? 1 : 0.45,
                      transition: 'all 0.2s'
                    }}
                  >
                    <img
                      src={pkmn.sprite}
                      alt={pkmn.name}
                      onError={fallbackSprite}
                      style={{
                        width: '44px',
                        height: '44px',
                        filter: isFainted ? 'none' : 'grayscale(100%)',
                        opacity: isFainted ? 1 : 0.5
                      }}
                    />
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '0.95rem', textTransform: 'capitalize', color: isFainted ? '#f8fafc' : '#7d7ab5' }}>
                        {pkmn.name}
                        <StatusBadge status={pkmn.status} compact />
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: isFainted ? '#9b98cf' : '#475569' }}>
                        Nv. {pkmn.level} · HP: {pkmn.hp}/{pkmn.maxHp}
                      </span>
                    </div>
                    {isFainted && (
                      <span style={{ fontSize: '0.8rem', color: '#7ceb95', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        → {restoredHp} HP
                      </span>
                    )}
                    {!isFainted && (
                      <span style={{ fontSize: '0.75rem', color: '#7d7ab5' }}>No debilitado</span>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => setReviveModal(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal Equipar Objeto Pasivo */}
      {equipModal && (
        <div className="modal-backdrop" onClick={() => setEquipModal(null)}>
          <div
            className="panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '1.5rem',
              maxWidth: '380px',
              width: '90%',
              margin: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              {ITEM_SPRITES[equipModal.itemName] && (
                <img
                  src={ITEM_SPRITES[equipModal.itemName]}
                  alt={equipModal.itemName}
                  style={{ width: '36px', height: '36px', imageRendering: 'pixelated' }}
                />
              )}
              <div>
                <h3 style={{ margin: 0, color: '#cba3ff', fontSize: '1.1rem' }}>{equipModal.itemName}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#9b98cf' }}>
                  {HOLDABLE_ITEMS[equipModal.itemName]?.desc}
                </p>
              </div>
            </div>
            <p style={{ color: '#d9d6f2', fontSize: '0.85rem', marginBottom: '1rem' }}>Elige a qué Pokémon equipárselo:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {team.map((pkmn, idx) => {
                const isAlive = pkmn.hp > 0
                const hasItem = !!pkmn.holdItem
                const canEquip = isAlive && !hasItem
                const eff = getEffectiveStats(pkmn)
                const item = HOLDABLE_ITEMS[equipModal.itemName]
                const isGmaxEquip = equipModal.itemName === 'Dynamax Band'
                const isMegaEquip = equipModal.itemName === 'Mega Stone'
                const canUseTransform = isGmaxEquip ? GMAX_CAPABLE_IDS.has(pkmn.id) : isMegaEquip ? MEGA_CAPABLE_IDS.has(pkmn.id) : false
                const highlightGreen = canEquip && (isGmaxEquip || isMegaEquip) && canUseTransform
                return (
                  <button
                    key={`equip-target-${idx}`}
                    type="button"
                    onClick={() => {
                      equipItem(equipModal.itemName, idx)
                      setEquipModal(null)
                    }}
                    disabled={!canEquip}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: highlightGreen ? '1px solid rgba(74, 222, 128, 0.6)' : canEquip ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                      background: highlightGreen ? 'rgba(74, 222, 128, 0.12)' : canEquip ? 'rgba(168, 85, 247, 0.08)' : 'rgba(255,255,255,0.03)',
                      cursor: canEquip ? 'pointer' : 'not-allowed',
                      opacity: canEquip ? 1 : 0.45,
                      transition: 'all 0.2s'
                    }}
                  >
                    <img
                      src={pkmn.sprite}
                      alt={pkmn.name}
                      onError={fallbackSprite}
                      style={{
                        width: '44px',
                        height: '44px',
                        filter: isAlive ? 'none' : 'grayscale(100%)',
                        opacity: isAlive ? 1 : 0.5
                      }}
                    />
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '0.95rem', textTransform: 'capitalize', color: canEquip ? '#f8fafc' : '#7d7ab5' }}>
                        {pkmn.name}
                        <StatusBadge status={pkmn.status} compact />
                        {pkmn.holdItem && <span style={{ fontSize: '0.7rem', color: '#b8a1ff', marginLeft: '6px' }}>({pkmn.holdItem})</span>}
                        {isGmaxEquip && (
                          <span style={{ fontSize: '0.7rem', color: canUseTransform ? '#4ade80' : '#7d7ab5', marginLeft: '6px' }}>
                            {canUseTransform ? '✓ Puede Gigamax' : 'No puede'}
                          </span>
                        )}
                        {isMegaEquip && (
                          <span style={{ fontSize: '0.7rem', color: canUseTransform ? '#4ade80' : '#7d7ab5', marginLeft: '6px' }}>
                            {canUseTransform ? '✓ Puede Mega' : 'No puede'}
                          </span>
                        )}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: canEquip ? '#9b98cf' : '#475569' }}>
                        Nv. {pkmn.level} · ATK: {eff.attack} · DEF: {eff.defense} · SPD: {eff.speed}
                      </span>
                    </div>
                    {canEquip && item && (
                      <div style={{ fontSize: '0.65rem', color: '#cba3ff', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {item.attackMod && <div>ATK {eff.attack} → {Math.round(pkmn.attack * (1 + item.attackMod))}</div>}
                        {item.defenseMod && <div>DEF {eff.defense} → {Math.round(pkmn.defense * (1 + item.defenseMod))}</div>}
                        {item.speedMod && <div>SPD {eff.speed} → {Math.round(pkmn.speed * (1 + item.speedMod))}</div>}
                        {item.maxHpMod && <div>HP {pkmn.maxHp} → {pkmn.maxHp + item.maxHpMod}</div>}
                        {item.healPerTurn && item.healPerTurn > 0 && <div>+{item.healPerTurn} HP/turno</div>}
                        {item.healPerTurn && item.healPerTurn < 0 && <div>{item.healPerTurn} HP/turno</div>}
                        {item.damageBoost && <div>+{Math.round(item.damageBoost * 100)}% daño</div>}
                      </div>
                    )}
                    {!isAlive && (
                      <span style={{ fontSize: '0.75rem', color: '#7d7ab5' }}>Debilitado</span>
                    )}
                    {hasItem && (
                      <span style={{ fontSize: '0.75rem', color: '#7d7ab5' }}>Ocupado</span>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => setEquipModal(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Stone Evolution Modal */}
      {stoneEvoModal && (
        <div className="modal-backdrop" onClick={() => { setStoneEvoModal(null); setStoneEvoTargets([]); setStoneEvoCanEvolve(new Set()) }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', color: '#4d9bff' }}>Evolucionar con {stoneEvoModal.stoneName}</h3>
            <p style={{ fontSize: '0.85rem', color: '#9b98cf', marginBottom: '1rem' }}>Selecciona un Pokémon para evolucionar:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stoneEvoTargets.map((pkmn, idx) => {
                const realIdx = team.indexOf(pkmn)
                const canEvo = stoneEvoCanEvolve.has(realIdx)
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px',
                    background: canEvo ? 'rgba(74,222,128,0.12)' : 'rgba(30,41,59,0.6)',
                    border: canEvo ? '1px solid rgba(74,222,128,0.6)' : '1px solid #3f3f6e',
                    boxShadow: canEvo ? '0 0 10px rgba(74,222,128,0.35)' : 'none',
                    cursor: 'pointer'
                  }}
                    onClick={() => handleStoneEvolution(realIdx)}>
                    <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '40px', height: '40px' }} />
                    <div>
                      <strong style={{ textTransform: 'capitalize', color: canEvo ? '#a7f3d0' : '#f3f1ff' }}>{pkmn.name}</strong>
                      <StatusBadge status={pkmn.status} compact />
                      <span style={{ fontSize: '0.75rem', color: '#9b98cf', marginLeft: '8px' }}>Nv.{pkmn.level}</span>
                      {canEvo && <span style={{ fontSize: '0.7rem', color: '#4ade80', marginLeft: '8px' }}>✓ Puede evolucionar</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Capture Modal */}
      {captureModal && enemy && (
        <div className="modal-backdrop" onClick={() => setCaptureModal(false)}>
          <div
            className="panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '1.5rem',
              maxWidth: '420px',
              width: '90%',
              margin: 'auto'
            }}
          >
            <h3 style={{ margin: '0 0 0.25rem', color: '#37d16b', textAlign: 'center' }}>
              🏐 Capturar {enemy.name}<StatusBadge status={enemy.status} />
            </h3>
            <p className="muted" style={{ textAlign: 'center', margin: '0 0 1rem', fontSize: '0.8rem' }}>
              HP: {enemy.hp}/{enemy.maxHp} · Turno: {battleTurns}
              {enemy.status && ` · ${STATUS_LABELS[enemy.status.type]}`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {POKEBALLS.map(b => {
                const count = inventory.filter(i => i === b.name).length
                const unlockId = POKEBALL_UNLOCK_IDS[b.name]
                const isUnlocked = b.name === 'Poké Ball' || !unlockId || metaProgression.permanentlyUnlockedItems.includes(unlockId)
                if (count <= 0) return null
                if (!isUnlocked) return null
                const ballRate = getPokeBallRate(b.name, enemy, battleTurns, !!pokedex[enemy.id]?.caught, activePokemon?.level ?? 50)
                const hpFactor = Math.max(0.05, (3 * enemy.maxHp - 2 * enemy.hp) / (3 * enemy.maxHp))
                const statusMult = enemy.status ? (enemy.status.type === 'sleep' || enemy.status.type === 'freeze' ? 2.5 : 1.5) : 1
                const speciesRate = (enemy.captureRate ?? 45) / 255
                const chance = b.isMaster ? 100 : Math.min(Math.round(hpFactor * ballRate * statusMult * speciesRate * 100), 100)
                return (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => attemptCapture(b.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      background: 'rgba(34, 197, 94, 0.06)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      color: '#f3f1ff'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.06)' }}
                  >
                    {ITEM_SPRITES[b.name] && (
                      <img src={ITEM_SPRITES[b.name]} alt={b.name} style={{ width: '32px', height: '32px', imageRendering: 'pixelated' }} />
                    )}
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <strong>{b.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#9b98cf', marginLeft: '8px' }}>x{count}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: chance >= 90 ? '#37d16b' : chance >= 50 ? '#eab308' : chance >= 20 ? '#ff8a33' : '#ee3b2f', fontSize: '1.3rem' }}>
                        {chance}%
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#7d7ab5' }}>{b.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => setCaptureModal(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Evolution popup */}
      {evoPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, background: 'rgba(0,0,0,0.6)', animation: 'evoFadeIn 0.3s' }}>
          <div style={{ textAlign: 'center', padding: '2rem', borderRadius: '6px', background: '#1c1c3a', border: '3px solid #4d9bff', boxShadow: '4px 4px 0 0 rgba(0,0,0,0.55)' }}>
            <p style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem' }}>✨ ¡Evolución!</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'center' }}>
              <div style={{ animation: 'evoFlash 0.6s' }}>
                <img src={evoPopup.oldSprite} alt="" style={{ width: '80px', height: '80px', imageRendering: 'pixelated', filter: 'brightness(2) sepia(0.5)' }} />
              </div>
              <span style={{ color: '#9b98cf', fontSize: '1.5rem' }}>→</span>
              <div style={{ animation: 'evoAppear 0.6s' }}>
                <img src={evoPopup.newSprite} alt="" style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }} />
              </div>
            </div>
            <p style={{ color: '#f3f1ff', marginTop: '0.75rem' }}>
              <span style={{ textTransform: 'capitalize' }}>{evoPopup.oldName}</span>
              {' '}evolucionó en{' '}
              <strong style={{ color: '#4d9bff', textTransform: 'capitalize' }}>{evoPopup.newName}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Capture message overlay */}
      {captureMessage && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.85)', color: '#ffcb05', padding: '1.5rem 2.5rem',
          borderRadius: '16px', fontSize: '1.2rem', fontWeight: 'bold',
          border: '2px solid #ffcb05', zIndex: 10000,
          textAlign: 'center', pointerEvents: 'none', animation: 'fadeIn 0.3s ease'
        }}>
          {captureMessage}
        </div>
      )}

      {/* Modal Pokédex */}
      {showPokedex && (
        <div className="modal-backdrop" onClick={() => { setShowPokedex(false); setSelectedPokemonDetail(null); setPokedexSearch(''); }}>
          <div className="pokedex-frame" onClick={(e) => e.stopPropagation()}>
            <div className="pokedex-top-bar">
              <div className="big-blue-sensor"></div>
              <div className="mini-leds">
                <div className="led red"></div>
                <div className="led yellow"></div>
                <div className="led green"></div>
              </div>
            </div>

            <div className="pokedex-screen">
              {selectedPokemonDetail ? (
                <div className="pokedex-detail-view">
                  <button className="tiny-btn back-btn" onClick={() => setSelectedPokemonDetail(null)}>
                    ← Volver a la lista
                  </button>

                  <div className="detail-header" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <img
                      className="high-res-img"
                      src={selectedPokemonDetail.highResImage}
                      alt={selectedPokemonDetail.name}
                    />
                    <div className="detail-title">
                      <span className="pokedex-id">#{String(selectedPokemonDetail.id).padStart(3, '0')}</span>
                      <h2 style={{ textTransform: 'capitalize', margin: '4px 0 8px 0', color: '#4d9bff' }}>
                        {selectedPokemonDetail.name}
                      </h2>
                      <div className="types-list" style={{ display: 'flex', gap: '4px' }}>
                        {selectedPokemonDetail.types.map((t) => (
                          <span key={t} className="type-badge">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="description-box">{selectedPokemonDetail.description}</p>

                  <div className="physical-stats">
                    <div>
                      <span>Altura</span>
                      <strong>{selectedPokemonDetail.height} m</strong>
                    </div>
                    <div>
                      <span>Peso</span>
                      <strong>{selectedPokemonDetail.weight} kg</strong>
                    </div>
                  </div>

                  {selectedPokemonDetail.evolutions.length > 0 && (
                    <>
                      <h3 style={{ fontSize: '0.9rem', color: '#9b98cf', marginTop: '12px' }}>Cadena Evolutiva</h3>
                      <div className="evolution-chain" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', padding: '8px 0' }}>
                        {selectedPokemonDetail.evolutions.map((evo, idx) => {
                          const entry = pokedex[evo.id]
                          const known = !!entry?.caught
                          return (
                            <div key={evo.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {idx > 0 && <span style={{ color: '#7d7ab5', fontSize: '1.2rem' }}>→</span>}
                              <div
                                className="pokedex-card"
                                style={{
                                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                                  padding: '6px', borderRadius: '8px', background: 'rgba(15,23,42,0.6)',
                                  border: evo.id === selectedPokemonDetail.id ? '2px solid #4d9bff' : '1px solid #3f3f6e',
                                  minWidth: '80px', opacity: known ? 1 : 0.5, cursor: known ? 'pointer' : 'default'
                                }}
                                onClick={() => known && handleSelectPokedexPokemon(evo.id)}
                              >
                                <img
                                  src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${evo.id}.gif`}
                                  alt={evo.name}
                                  onError={(e) => { (e.target as HTMLImageElement).src = evo.sprite }}
                                  style={{ width: '56px', height: '56px', imageRendering: 'pixelated', filter: known ? 'none' : 'brightness(0) invert(0)' }}
                                />
                                <strong style={{ textTransform: 'capitalize', fontSize: '0.75rem', color: evo.id === selectedPokemonDetail.id ? '#4d9bff' : '#f3f1ff', textAlign: 'center' }}>
                                  {known ? evo.name : '???'}
                                </strong>
                                {evo.level && (
                                  <span style={{ fontSize: '0.65rem', color: '#a855f7' }}>Nv. {evo.level}</span>
                                )}
                                {!evo.level && evo.trigger && evo.trigger !== 'level-up' && (
                                  <span style={{ fontSize: '0.65rem', color: '#ffcb05' }}>{evo.trigger}</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  <h3 style={{ fontSize: '0.9rem', color: '#9b98cf', marginTop: '8px' }}>Estadísticas Base</h3>
                  <div className="stats-grid">
                    {selectedPokemonDetail.stats.map((st) => (
                      <div key={st.name} className="stat-row">
                        <span className="stat-name">{st.name}</span>
                        <span> </span>
                        <strong>{st.value}</strong>
                        <div className="meter">
                          <div style={{ width: `${Math.min(100, (st.value / 150) * 100)}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="modal-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ fontSize: '0.65rem', color: '#4d9bff', margin: 0 }}>
                        Pokédex ({pokedexSeen} vistos · {pokedexCaught} capturados)
                      </h2>
                    </div>

                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type="text"
                        placeholder="🔍 Buscar por nombre o ID..."
                        value={pokedexSearch}
                        onChange={(e) => setPokedexSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          background: 'rgba(15, 23, 42, 0.8)',
                          color: '#fff',
                          fontSize: '0.85rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      {pokedexSearch && (
                        <button
                          type="button"
                          onClick={() => setPokedexSearch('')}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: '#9b98cf',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          ✖
                        </button>
                      )}
                    </div>
                  </div>

                  {isLoadingDetail ? (
                    <p className="muted" style={{ textAlign: 'center', padding: '2rem 0' }}>Cargando datos oficiales...</p>
                  ) : pokedexList.length === 0 ? (
                    <p className="muted" style={{ padding: '1rem 0', textAlign: 'center' }}>
                      Aún no has registrado ningún Pokémon. ¡Inicia una partida!
                    </p>
                  ) : filteredPokedex.length === 0 ? (
                    <p className="muted" style={{ padding: '2rem 0', textAlign: 'center' }}>
                      No se encontraron Pokémon que coincidan con "{pokedexSearch}".
                    </p>
                  ) : (
                    <div className="pokedex-grid">
                      {filteredPokedex.sort((a, b) => a.id - b.id).map((pkmn) => (
                        <div
                          key={pkmn.id}
                          className="pokedex-card clickable"
                          onClick={() => pkmn.caught ? handleSelectPokedexPokemon(pkmn.id) : undefined}
                          style={!pkmn.caught ? { opacity: 0.6 } : undefined}
                        >
                          <span className="pokedex-id">#{String(pkmn.id).padStart(3, '0')}</span>
                          <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pkmn.id}.gif`} alt={pkmn.name} onError={fallbackSprite} style={{ width: '60px', height: '60px', filter: pkmn.caught ? 'none' : 'brightness(0) invert(0)', imageRendering: pkmn.caught ? undefined : 'auto' }} />
                          <strong style={{ textTransform: 'capitalize', display: 'block', fontSize: '0.85rem' }}>
                            {pkmn.caught ? pkmn.name : '???'}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pokedex-controls">
              <div className="d-pad" title="D-Pad Pokédex"></div>
              <button
                className="pokedex-close-btn"
                onClick={() => { setShowPokedex(false); setSelectedPokemonDetail(null); setPokedexSearch(''); }}
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Opciones */}
      {showOptions && (
        <div className="modal-backdrop" onClick={closeOptions}>
          <div className="pokedex-frame" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
            <div className="pokedex-top-bar">
              <div className="big-blue-sensor"></div>
              <div className="mini-leds">
                <div className="led red"></div>
                <div className="led yellow"></div>
                <div className="led green"></div>
              </div>
            </div>

            <div className="pokedex-screen" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                    🎵 Volumen de Música
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#9b98cf', minWidth: '20px' }}>🔈</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volume}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setVolumeState(v)
                        setVolume(v / 100)
                        if (musicMuted) {
                          setMusicMuted(false)
                          setMusicMutedState(false)
                        }
                      }}
                      style={{ flex: 1, accentColor: '#10b981', height: '6px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#9b98cf', minWidth: '32px', textAlign: 'right' }}>{volume}%</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                  <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                    🔉 Volumen de Efectos
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#9b98cf', minWidth: '20px' }}>🔈</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={sfxVol}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setSfxVolState(v)
                        setSfxVolume(v / 100)
                      }}
                      style={{ flex: 1, accentColor: '#f59e0b', height: '6px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#9b98cf', minWidth: '32px', textAlign: 'right' }}>{sfxVol}%</span>
                  </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                  🎨 Tema Visual
                </strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {THEMES.filter(t => metaProgression.ownedThemes.includes(t.id)).map(theme => (
                    <button key={theme.id} type="button"
                      onClick={() => { playClick(); setTheme(theme.id) }}
                      style={{
                        padding: '6px 12px', borderRadius: '8px', border: `2px solid ${metaProgression.activeTheme === theme.id ? '#ffcb05' : '#475569'}`,
                        background: theme.colors.bg, color: theme.colors.text, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold',
                      }}>
                      {theme.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Music selectors */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.75rem' }}>
                  🎵 Música
                </strong>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#9b98cf', marginBottom: '0.25rem' }}>Menú:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {[
                      { id: 'default', name: 'Menú Clásico', always: true },
                      { id: 'chill', name: 'Menú Relax', always: false },
                    ].map(track => {
                      const unlocked = track.always || metaProgression.ownedMusic.includes('music_menu_chill')
                      const active = metaProgression.activeMenuMusic === track.id
                      return (
                        <button key={track.id} type="button"
                          onClick={() => {
                            if (!unlocked) return
                            playClick()
                            const updated = { ...metaProgression, activeMenuMusic: track.id }
                            setMetaProgression(updated)
                            localStorage.setItem('pokerand_meta', JSON.stringify(updated))
                            setMenuMusicTrack(track.id)
                            stopMusic()
                            setTimeout(startMenuMusic, 350)
                          }}
                          disabled={!unlocked}
                          style={{
                            padding: '6px 12px', borderRadius: '8px',
                            border: `2px solid ${active ? '#ffcb05' : '#475569'}`,
                            background: unlocked ? '#1c1c3a' : '#12122b',
                            color: unlocked ? '#f3f1ff' : '#475569',
                            cursor: unlocked ? 'pointer' : 'not-allowed',
                            fontSize: '0.75rem', fontWeight: 'bold',
                            opacity: unlocked ? 1 : 0.5,
                          }}>
                          {track.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#9b98cf', marginBottom: '0.25rem' }}>Batalla:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {[
                      { id: 'default', name: 'Batalla Clásica', always: true },
                      { id: 'epic', name: 'Batalla Épica', always: false },
                    ].map(track => {
                      const unlocked = track.always || metaProgression.ownedMusic.includes('music_battle_epic')
                      const active = metaProgression.activeBattleMusic === track.id
                      return (
                        <button key={track.id} type="button"
                          onClick={() => {
                            if (!unlocked) return
                            playClick()
                            const updated = { ...metaProgression, activeBattleMusic: track.id }
                            setMetaProgression(updated)
                            localStorage.setItem('pokerand_meta', JSON.stringify(updated))
                            setBattleMusicTrack(track.id)
                            startBattleMusic(true)
                          }}
                          disabled={!unlocked}
                          style={{
                            padding: '6px 12px', borderRadius: '8px',
                            border: `2px solid ${active ? '#ffcb05' : '#475569'}`,
                            background: unlocked ? '#1c1c3a' : '#12122b',
                            color: unlocked ? '#f3f1ff' : '#475569',
                            cursor: unlocked ? 'pointer' : 'not-allowed',
                            fontSize: '0.75rem', fontWeight: 'bold',
                            opacity: unlocked ? 1 : 0.5,
                          }}>
                          {track.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
              <strong style={{ fontSize: '1rem', color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                💾 Datos
              </strong>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="tiny-btn" type="button" onClick={() => {
                  const data: Record<string, string> = {}
                  const keys = ['pokerand_progression', 'pokerand_pokedex', 'pokerand_wins', 'pokerand_losses', 'pokerand_streak', 'pokerand_best_streak', 'pokerand_achievements', 'pokerand_meta']
                  for (const k of keys) {
                    const v = localStorage.getItem(k)
                    if (v) data[k] = v
                  }
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = 'pokerand_backup.json'; a.click()
                  URL.revokeObjectURL(url)
                }} style={{ color: '#4d9bff' }}>📤 Exportar datos</button>
                <label className="tiny-btn" style={{ color: '#ffcb05', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', border: '1px solid #ffcb05', background: 'rgba(250,204,21,0.1)', fontSize: '0.75rem' }}>
                  📥 Importar datos
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => {
                    const file = e.target.files?.[0]; if (!file) return
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      try {
                        const data = JSON.parse(ev.target?.result as string)
                        if (typeof data !== 'object' || !data) throw new Error()
                        for (const [k, v] of Object.entries(data)) {
                          if (typeof v === 'string') localStorage.setItem(k, v)
                        }
                        alert('✅ Datos importados. Recarga la página.')
                      } catch { alert('❌ Archivo no válido.') }
                    }
                    reader.readAsText(file); e.target.value = ''
                  }} />
                </label>
              </div>
            </div>

            <div className="pokedex-controls">
              <div className="d-pad" title="D-Pad Options"></div>
              <button
                className="pokedex-close-btn"
                onClick={closeOptions}
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Rocket: Mensaje de robo */}
      {teamRocketStealMessage && (
        <div className="teamrocket-steal-banner">
          <div className="teamrocket-steal-content">
            <span className="teamrocket-steal-icon">🔴</span>
            <p>{teamRocketStealMessage}</p>
          </div>
        </div>
      )}

      {/* Team Rocket: Elegir Pokémon */}
      {teamRocketPickModal && (
        <div className="modal-backdrop" onClick={() => { setTeamRocketPickModal(false); setTeamRocketTeam([]); completeCurrentNode() }}>
          <div className="teamrocket-pick-panel" onClick={(e) => e.stopPropagation()}>
            <h3>🔴 ¡TeamR derrotado!</h3>
            <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>No perdiste ningún Pokémon. ¡Elige uno del equipo enemigo para unirlo al tuyo!</p>
            <div className="teamrocket-pick-grid">
              {teamRocketTeam.filter((p) => p.hp <= 0).map((pkmn, idx) => (
                <button
                  key={`rocket-pick-${idx}`}
                  className="teamrocket-pick-card"
                  onClick={() => { playClick(); pickRocketPokemon(pkmn) }}
                  onMouseEnter={playHover}
                  type="button"
                >
                  <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '64px', height: '64px', imageRendering: 'pixelated' }} />
                  <strong style={{ textTransform: 'capitalize' }}>{pkmn.name}</strong>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Nv. {pkmn.level}</span>
                  {pkmn.types && (
                    <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', marginTop: '4px' }}>
                      {pkmn.types.map((t) => (
                        <span key={t} style={{ background: TYPE_COLORS[t] ?? '#475569', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                className="secondary"
                onClick={() => { playClick(); setTeamRocketPickModal(false); setTeamRocketTeam([]); completeCurrentNode() }}
                onMouseEnter={playHover}
                type="button"
              >
                Omitir (no quedarse con ninguno)
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'coliseum_select' && (
        <section className="panel setup-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0, color: '#ffcb05' }}>👑 COLISEUM</h2>
            <button className="tiny-btn" onClick={() => { playClick(); setColiseumTempTeam([]); setRunChallenges({ noShops: false, noRests: false, allShiny: false, allTeamRocket: false, nuzlocke: false, soloStarter: false, fixedTeam: false, noEvolution: false, noItems: false, restrictedMoves: false, firstStrike: false, fixedLevel: false, noCrits: false, typeRandomizer: false, noPurchasing: false, blindRoute: false, bossRush: false, speedrun: false, noMoney: false, doubleModifiers: false, scalingEnemies: false, noHealing: false, ironman: false, totalRandomizer: false, nuzlockeHardcore: false, challengeGauntlet: false, egglocke: false }); setScreen('setup'); stopMusic() }} type="button" style={{ color: '#ff8a80' }}>
              ✕ Salir
            </button>
          </div>
          <p style={{ textAlign: 'center', color: '#9b98cf', marginBottom: '1rem' }}>
            Selecciona 6 Pokémon de tu Pokédex para enfrentar 8 jefes a nivel 50.
          </p>
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#7d7ab5', marginBottom: '0.5rem' }}>
            Elegidos: {coliseumTempTeam.length}/6
          </p>
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <input type="text" placeholder="🔍 Buscar Pokémon..." value={coliseumSearch} onChange={e => setColiseumSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
            {coliseumSearch && <button type="button" onClick={() => setColiseumSearch('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9b98cf', cursor: 'pointer', fontSize: '0.9rem' }}>✖</button>}
          </div>
          {coliseumTempTeam.length === 6 && (
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <button className="cta" onClick={async () => {
                setIsLoading(true)
                try {
                  const built = await Promise.all(coliseumTempTeam.map(p => buildPokemonFromApi(p.id, 1, 50, false, 'coliseum_' + coliseumSeed)))
                  setTeam(built)
                  built.forEach(p => registerInPokedex(p))
                  setBattleLog(['👑 ¡COLISEUM! Enfrenta 8 jefes a nivel 50.', ...battleLog])
                  setScreen('route')
                  startBattleMusic()
                } catch {
                  setApiError('Error al preparar el equipo.')
                } finally {
                  setIsLoading(false)
                }
              }} style={{ background: '#ffcb05', color: '#000' }} disabled={isLoading}>
                {isLoading ? 'Preparando equipo...' : '👑 ¡Comenzar COLISEUM!'}
              </button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
            {Object.values(pokedex).filter(p => p.caught).filter(p => {
              const term = coliseumSearch.toLowerCase().trim()
              return !term || p.name.toLowerCase().includes(term) || String(p.id).includes(term)
            }).sort((a, b) => a.id - b.id).map(pkmn => {
              const selectedIdx = coliseumTempTeam.findIndex(p => p.id === pkmn.id)
              return (
                <div key={pkmn.id}
                  onClick={() => {
                    if (selectedIdx >= 0) {
                      setColiseumTempTeam(prev => prev.filter(p => p.id !== pkmn.id))
                    } else if (coliseumTempTeam.length < 6) {
                      setColiseumTempTeam(prev => [...prev, { id: pkmn.id, name: pkmn.name, sprite: pkmn.sprite, level: 1, hp: 1, maxHp: 1, attack: 1, defense: 1, speed: 1, moves: [], types: pkmn.types }])
                    }
                  }}
                  style={{
                    padding: '8px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer',
                    background: selectedIdx >= 0 ? 'rgba(250,204,21,0.2)' : 'rgba(30,41,59,0.6)',
                    border: selectedIdx >= 0 ? '2px solid #ffcb05' : '1px solid #3f3f6e',
                    opacity: selectedIdx < 0 && coliseumTempTeam.length >= 6 ? 0.4 : 1
                  }}
                >
                  <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pkmn.id}.gif`}
                    alt={pkmn.name} onError={fallbackSprite}
                    style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }} />
                  <div style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: selectedIdx >= 0 ? '#ffcb05' : '#f3f1ff' }}>{pkmn.name}</div>
                  {selectedIdx >= 0 && <div style={{ fontSize: '0.65rem', color: '#ffcb05' }}>#{selectedIdx + 1}</div>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {screen === 'setup' && (
        <section className="panel setup-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '0.75rem' }}>1. Selecciona la Generación</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="cta" type="button" onClick={() => { playClick(); startNewRun() }} onMouseEnter={playHover} disabled={isLoading} style={{ padding: '6px 10px', fontSize: '0.8rem', marginTop: 0 }}>
                {isLoading ? '...' : 'Iniciar Aventura'}
              </button>
              <button className="tiny-btn" type="button" onClick={() => { playClick(); setShowMetaShop(true) }}>
                🪙 Tienda Meta ({metaProgression.pokeCoins} 🪙)
              </button>
            </div>
          </div>
          <div className="generation-grid">
            {generations.map((gen) => {
              const unlocked = isGenUnlocked(gen)
              const hardUnlocked = isHardUnlocked(gen)
              const completedMed = progression.completedMedium.includes(gen)
              const completedAny = progression.completedAny.includes(gen)
              const completedHard = progression.completedHard.includes(gen)
              const completedColiseum = progression.completedColiseum.includes(gen)
              const completedLeague = progression.completedLeague.includes(gen)

              return (
                <button
                  key={gen}
                  className={`gen-tile ${generation === gen ? 'is-active' : ''} ${!unlocked ? 'is-locked' : ''}`}
                  onClick={() => { playClick(); handleSelectGeneration(gen) }}
                  onMouseEnter={playHover}
                  type="button"
                  disabled={isLoading || !unlocked}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Gen {gen} {unlocked ? '' : '🔒'}</span>
                    <span>
                      {completedHard ? (
                        <span className="badge-medium" title="Completado en Difícil">🏆🏆</span>
                      ) : completedMed ? (
                        <span className="badge-medium" title="Completado en Intermedio">🏆</span>
                      ) : completedAny ? (
                        <span className="badge-easy" title="Completado en Fácil">⭐</span>
                      ) : null}
                      {completedColiseum && (
                        <span className="badge-medium" title="Completado en COLISEUM" style={{ marginLeft: '4px' }}>👑</span>
                      )}
                      {completedLeague && (
                        <span className="badge-medium" title="Completado en Liga" style={{ marginLeft: '4px' }}>🏅</span>
                      )}
                    </span>
                  </div>
                  <strong>{generationRegions[gen]}</strong>

                  {!unlocked && (
                    <span className="lock-text">
                      🔒 Pásate Gen {gen - 1} en Intermedio
                    </span>
                  )}
                  {unlocked && hardUnlocked && (
                    <span className="unlock-tag">🔥 Difícil disponible</span>
                  )}
                </button>
              )
            })}

            {(() => {
              const randomUnlocked = isGenUnlocked(0)
              const randomCompletedHard = generations.every((g) => progression.completedHard.includes(g))
              const randomCompletedMed = generations.every((g) => progression.completedMedium.includes(g))
              const randomCompletedAny = progression.completedAny.length > 0
              const randomCompletedColiseum = generations.every((g) => progression.completedColiseum.includes(g))
              const randomCompletedLeague = generations.every((g) => progression.completedLeague.includes(g))
              return (
                <button
                  key={0}
                  className={`gen-tile ${generation === 0 ? 'is-active' : ''} ${!randomUnlocked ? 'is-locked' : ''}`}
                  onClick={() => { playClick(); handleSelectGeneration(0) }}
                  onMouseEnter={playHover}
                  type="button"
                  disabled={isLoading || !randomUnlocked}
                  style={{
                    gridColumn: '1 / -1',
                    borderColor: randomUnlocked ? '#eab308' : '#475569',
                    background: !randomUnlocked
                      ? 'rgba(15, 23, 42, 0.6)'
                      : generation === 0
                        ? 'rgba(234, 179, 8, 0.25)'
                        : 'rgba(234, 179, 8, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '12px',
                    opacity: randomUnlocked ? 1 : 0.65,
                    cursor: randomUnlocked ? 'pointer' : 'not-allowed'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem', color: randomUnlocked ? '#ffcb05' : '#7d7ab5' }}>
                      🎲 RANDOM {randomUnlocked ? '' : '🔒'}
                    </span>
                    <span>
                      {randomCompletedHard ? (
                        <span className="badge-medium" title="Completado en Difícil">🏆🏆</span>
                      ) : randomCompletedMed ? (
                        <span className="badge-medium" title="Completado en Intermedio">🏆</span>
                      ) : randomCompletedAny ? (
                        <span className="badge-easy" title="Completado en Fácil">⭐</span>
                      ) : null}
                      {randomCompletedColiseum && (
                        <span className="badge-medium" title="Completado en COLISEUM" style={{ marginLeft: '4px' }}>👑</span>
                      )}
                      {randomCompletedLeague && (
                        <span className="badge-medium" title="Completado en Liga" style={{ marginLeft: '4px' }}>🏅</span>
                      )}
                    </span>
                    <strong style={{ fontSize: '1rem', color: randomUnlocked ? '#ffcb05' : '#7d7ab5' }}>
                      — {randomUnlocked ? 'Mezclar todas las generaciones' : 'Todas las Generaciones'}
                    </strong>
                  </div>
                  {!randomUnlocked && (
                    <span className="lock-text">
                      🔒 Completa todas las generaciones en Intermedio para desbloquear
                    </span>
                  )}
                </button>
              )
            })()}
          </div>

          <h2 style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>2. Selecciona la Dificultad</h2>
          <div className="generation-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => {
              const isHard = diff === 'hard'
              const hardUnlocked = isHardUnlocked(generation)
              const isLocked = isHard && !hardUnlocked

              return (
                <button
                  key={diff}
                  className={`gen-tile ${difficulty === diff ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''}`}
                  onClick={() => { playClick(); handleSelectDifficulty(diff) }}
                  onMouseEnter={playHover}
                  type="button"
                  disabled={isLoading || isLocked}
                  style={{ opacity: isLocked ? 0.65 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{difficultyLabels[diff].title} {isLocked ? '🔒' : ''}</span>
                  </div>
                  <strong>{difficultyNodeCounts[diff]} rutas/etapa ({difficultyNodeCounts[diff] * 3} total)</strong>
                  {isLocked && (
                    <span className="lock-text">
                      🔒 Completa {generationRegions[generation]} 1 vez
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="generation-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
            {(() => {
              const infUnlocked = isInfiniteUnlocked(generation)
              return (
                <button
                  className={`gen-tile ${difficulty === 'infinite' ? 'is-active' : ''} ${!infUnlocked ? 'is-locked' : ''}`}
                  onClick={() => {
                    playClick()
                    handleSelectDifficulty('infinite')
                    if (infUnlocked && !authUser) {
                      setApiError('Para jugar al modo Infinite necesitas una cuenta. Crea una o inicia sesión en el ranking.')
                      openLeaderboard()
                    }
                  }}
                  onMouseEnter={playHover}
                  type="button"
                  disabled={isLoading || !infUnlocked}
                  style={{
                    borderColor: infUnlocked ? '#a855f7' : '#475569',
                    background: !infUnlocked
                      ? 'rgba(15, 23, 42, 0.6)'
                      : difficulty === 'infinite' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(168, 85, 247, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '12px',
                    opacity: infUnlocked ? 1 : 0.65,
                    cursor: infUnlocked ? 'pointer' : 'not-allowed'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem', color: infUnlocked ? '#cba3ff' : '#7d7ab5' }}>♾️ INFINITE {infUnlocked ? '' : '🔒'}</span>
                    <strong style={{ fontSize: '1rem', color: infUnlocked ? '#cba3ff' : '#7d7ab5' }}>— Rutas infinitas</strong>
                  </div>
                  {infUnlocked && !authUser && (
                    <span className="lock-text" style={{ color: '#ffcb05' }}>
                      🔑 Requiere cuenta (inicia sesión en Ranking ♾️)
                    </span>
                  )}
                  {!infUnlocked && (
                    <span className="lock-text">
                      🔒 Completa {generationRegions[generation]} en Difícil
                    </span>
                  )}
                </button>
              )
            })()}
          </div>

          <div className="generation-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
            {(() => {
              const coliseumUnlocked = isColiseumUnlocked()
              return (
            <button
              className={`gen-tile ${difficulty === 'coliseum' ? 'is-active' : ''}`}
              onClick={() => { if (!coliseumUnlocked) return; playClick(); handleSelectDifficulty('coliseum') }}
              onMouseEnter={playHover}
              type="button"
              disabled={isLoading || !coliseumUnlocked}
              style={{
                borderColor: difficulty === 'coliseum' ? '#ffcb05' : '#475569',
                background: difficulty === 'coliseum' ? 'rgba(250,204,21,0.15)' : 'rgba(15,23,42,0.6)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '4px', padding: '12px', opacity: coliseumUnlocked ? 1 : 0.65,
                cursor: (!isLoading && coliseumUnlocked) ? 'pointer' : 'not-allowed'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem', color: coliseumUnlocked ? '#ffcb05' : '#7d7ab5' }}>👑 COLISEUM {coliseumUnlocked ? '' : '🔒'}</span>
                <strong style={{ fontSize: '1rem', color: coliseumUnlocked ? '#ffcb05' : '#7d7ab5' }}>— 8 jefes a nivel 50</strong>
              </div>
              {coliseumUnlocked ? (
                <span className="lock-text" style={{ color: '#9b98cf', fontSize: '0.75rem' }}>
                  Elige 6 Pokémon de tu Pokédex para enfrentarlos
                </span>
              ) : (
                <span className="lock-text">
                  🔒 Completa todas las generaciones en Intermedio
                </span>
              )}
            </button>
            )})()}
          </div>

          <h2 style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>🎲 Desafío Diario</h2>
          <div className="generation-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
            {(() => {
              const dailyConfig = getDailyConfig(dailySeed, [1,2,3,4,5,6,7,8,9])
              const diffLabel = dailyConfig?.difficulty === 'easy' ? 'Fácil' : dailyConfig?.difficulty === 'hard' ? 'Difícil' : 'Medio'
              const genLabel = dailyConfig ? `${generationRegions[dailyConfig.generation]}` : ''
              const modName = dailyConfig ? RUN_MODIFIERS.find(m => m.id === dailyConfig.modifierId)?.name ?? '' : ''
              return (
            <button
              className="gen-tile"
              onClick={() => {
                if (!dailyConfig) return
                playClick()
                isDailyRunRef.current = true
                startNewRun()
              }}
              onMouseEnter={playHover}
              type="button"
              disabled={isLoading || dailyPlayed || !dailyConfig || coopMode}
              style={{
                borderColor: dailyPlayed ? '#475569' : '#37d16b',
                background: dailyPlayed ? 'rgba(15,23,42,0.6)' : 'rgba(34,197,94,0.1)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '12px',
                opacity: dailyPlayed ? 0.65 : 1, cursor: dailyPlayed ? 'not-allowed' : 'pointer',
                border: `1px solid ${dailyPlayed ? '#475569' : '#37d16b'}`, borderRadius: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem', color: dailyPlayed ? '#7d7ab5' : '#37d16b' }}>📅 {dailyPlayed ? 'Completado hoy ✅' : 'Desafío del Día'}</span>
              </div>
              <strong style={{ fontSize: '0.85rem', color: '#9b98cf' }}>
                {dailyPlayed ? 'Vuelve mañana para uno nuevo' : `Gen ${dailyConfig?.generation} (${genLabel}) — ${diffLabel} — ${modName}`}
              </strong>
            </button>
              )
            })()}
          </div>

          <h2 style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>🤝 Cooperativo</h2>
          <div className="generation-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
            {!coopMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid #3f3f6e', borderRadius: '12px', background: 'rgba(15,23,42,0.6)' }}>
                <p style={{ margin: '0', color: '#9b98cf', fontSize: '0.8rem' }}>
                  Juega una run compartida con un amigo: misma ruta, mismos nodos, intercambios de Pokémon y objetos. Ambos necesitan cuenta.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <label style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '4px', color: '#9b98cf', fontSize: '0.75rem' }}>
                    Generación
                    <select
                      value={coopGen}
                      onChange={(e) => setCoopGen(Number(e.target.value))}
                      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                    >
                      {generations.map((g) => (
                        <option key={g} value={g} disabled={!isGenUnlocked(g)}>Gen {g} — {generationRegions[g]}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '4px', color: '#9b98cf', fontSize: '0.75rem' }}>
                    Dificultad
                    <select
                      value={coopDiff}
                      onChange={(e) => setCoopDiff(e.target.value as 'easy' | 'medium' | 'hard')}
                      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                    >
                      <option value="easy">Fácil (5 rutas)</option>
                      <option value="medium">Intermedio (10 rutas)</option>
                      <option value="hard">Difícil (25 rutas)</option>
                    </select>
                  </label>
                </div>
                <button
                  className="cta"
                  type="button"
                  disabled={isLoading}
                  onClick={() => { playClick(); void handleCreateCoopSession() }}
                  style={{ background: '#37d16b', color: '#12122b' }}
                >
                  ➕ Crear sesión
                </button>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={coopJoinCode}
                    onChange={(e) => setCoopJoinCode(e.target.value.toUpperCase())}
                    placeholder="Código (6 letras)"
                    maxLength={6}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', textTransform: 'uppercase' }}
                  />
                  <button
                    className="secondary"
                    type="button"
                    disabled={isLoading}
                    onClick={() => { playClick(); void handleJoinCoopSession() }}
                  >
                    🔑 Unirse
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid #37d16b', borderRadius: '12px', background: 'rgba(34,197,94,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: '#37d16b', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                      🎮 Código de sesión
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <span style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '2rem', letterSpacing: '8px', textShadow: '0 2px 0 rgba(0,0,0,0.5)' }}>
                        {coopSessionCode}
                      </span>
                      <CopyCodeButton code={coopSessionCode} />
                    </div>
                  </div>
                  <button className="tiny-btn" type="button" onClick={cancelCoopSession} style={{ color: '#ff8a80', alignSelf: 'flex-start' }}>
                    ✕ Cancelar
                  </button>
                </div>
                {coopMyRole === 'a' ? (
                  coopPartnerJoined ? (
                    <p style={{ margin: '0', color: '#37d16b', fontSize: '0.85rem' }}>✅ ¡Tu compañero se ha unido! Pulsa "Iniciar Aventura" para empezar.</p>
                  ) : (
                    <p style={{ margin: '0', color: '#ffcb05', fontSize: '0.85rem' }}>⏳ Comparte este código con tu amigo y espera a que se una...</p>
                  )
                ) : (
                  <p style={{ margin: '0', color: '#37d16b', fontSize: '0.85rem' }}>✅ Sesión unida. Pulsa "Iniciar Aventura" cuando tu compañero esté listo.</p>
                )}
                <p style={{ margin: '0', color: '#7d7ab5', fontSize: '0.75rem' }}>
                  Gen {coopGen} ({generationRegions[coopGen]}) — {coopDiff === 'easy' ? 'Fácil' : coopDiff === 'hard' ? 'Difícil' : 'Intermedio'}. Misma ruta para ambos (misma semilla); tiendas, enemigos y descansos distintos por jugador.
                </p>
              </div>
            )}
            {coopError && <p className="error-line" style={{ marginTop: '4px' }}>{coopError}</p>}
          </div>

          <h2 style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>3. Desafíos de Run <span className="muted" style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>(opcional)</span></h2>
          {(() => {
            const challengesUnlocked = generation === 0
              ? generations.every((g) => progression.completedMedium.includes(g))
              : progression.completedMedium.includes(generation)

            const challengeCategories = [
              {
                title: '🗺️ Ruta',
                items: [
                  { key: 'noShops' as const, label: '🚫🏪 Sin Tiendas', desc: 'Se eliminan todos los nodos de tienda de la ruta.' },
                  { key: 'noRests' as const, label: '🚫🏕️ Sin Descansos', desc: 'Se eliminan todos los nodos de descanso de la ruta.' },
                  { key: 'allTeamRocket' as const, label: '🔴 Solo TeamR', desc: 'Todos los nodos no-boss se convierten en batallas Team Rocket.' },
                  { key: 'bossRush' as const, label: '🏆 Boss Rush', desc: 'Solo combates y boss final, sin tiendas ni descansos.' },
                  { key: 'blindRoute' as const, label: '👁️‍🗨️ Ruta Ciega', desc: 'No puedes ver qué nodo sigue hasta completar el actual.' },
                ]
              },
              {
                title: '✨ Visual',
                items: [
                  { key: 'allShiny' as const, label: '✨ Solo Shiny', desc: 'Todos los Pokémon (aliados y rivales) son Shiny.' },
                ]
              },
              {
                title: '⚔️ Combate',
                items: [
                  { key: 'noItems' as const, label: '🚫🎒 Sin Objetos', desc: 'No puedes usar consumables (pociones, X items, etc.) en batalla.' },
                  { key: 'restrictedMoves' as const, label: '⚔️ 2 Movimientos', desc: 'Cada Pokémon solo puede usar sus 2 primeros movimientos.' },
                  { key: 'firstStrike' as const, label: '⚡ Primer Golpe', desc: 'Si atacas primero y no debilitas al rival, recibes recoil del 8% HP.' },
                  { key: 'noCrits' as const, label: '🚫💥 Sin Críticos', desc: 'Se desactivan completamente los golpes críticos.' },
                  { key: 'typeRandomizer' as const, label: '🎲🎯 Tipo Random', desc: 'El tipo de cada movimiento se randomiza cada turno.' },
                  { key: 'fixedLevel' as const, label: '📊 Nivel Fijo', desc: 'Todos los Pokémon están en nivel 50, siempre.' },
                ]
              },
              {
                title: '🎯 Equipo',
                items: [
                  { key: 'soloStarter' as const, label: '🌟 Solo Starter', desc: 'No puedes capturar ni agregar Pokémon a tu equipo.' },
                  { key: 'fixedTeam' as const, label: '🔒 Equipo Fijo', desc: 'Tu equipo inicial no puede cambiarse durante la run.' },
                  { key: 'noEvolution' as const, label: '🚫🧬 Sin Evolución', desc: 'No puedes evolucionar Pokémon en los descansos.' },
                  { key: 'egglocke' as const, label: '🥚 Egglocke', desc: 'En los descansos obtienes huevos que eclosionan tras 2-3 batallas.' },
                ]
              },
              {
                title: '💰 Economía',
                items: [
                  { key: 'noPurchasing' as const, label: '🚫💰 Sin Compras', desc: 'No puedes comprar nada en la Pokémart.' },
                  { key: 'noMoney' as const, label: '💸 Sin Dinero', desc: 'No recibes dinero por derrotar rivales.' },
                ]
              },
              {
                title: '📈 Dificultad',
                items: [
                  { key: 'scalingEnemies' as const, label: '📈 Enemigos Reforzados', desc: 'Los enemigos ganan +1 nivel extra por cada nodo avanzado.' },
                  { key: 'noHealing' as const, label: '🚫💊 Sin Curación', desc: 'Ni tiendas, ni descansos, ni items curan HP.' },
                  { key: 'doubleModifiers' as const, label: '🎰 2 Modifiers', desc: 'Recibes 2 modificadores aleatorios en vez de 1.' },
                  { key: 'speedrun' as const, label: '⏱️ Speedrun', desc: 'Tienes 30 segundos por turno. Si se agota, pierdes 15% HP.' },
                  { key: 'totalRandomizer' as const, label: '🎲 Total Random', desc: 'Stats de ataque, defensa y velocidad de los enemigos son randomizados.' },
                ]
              },
              {
                title: '💀 Extremo',
                items: [
                  { key: 'nuzlocke' as const, label: '💀 Nuzlocke', desc: 'Si un Pokémon muere, se libera automáticamente.' },
                  { key: 'ironman' as const, label: '🔒 Ironman', desc: 'Activa Sin Evolución + Equipo Fijo + Sin Curación.' },
                  { key: 'nuzlockeHardcore' as const, label: '💀💀 Nuzlocke Hardcore', desc: 'Activa Nuzlocke + Sin Objetos + Sin Descansos.' },
                  { key: 'challengeGauntlet' as const, label: '🎰 Gauntlet (3 al azar)', desc: 'Se seleccionan 3 desafíos aleatorios al iniciar la run.' },
                ]
              },
            ]

            return (
              <div className="challenge-section" style={!challengesUnlocked ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
                {!challengesUnlocked && (
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#fbbf24' }}>
                    🔒 Completa la {generation === 0 ? 'todas las generaciones' : `Gen ${generation} (${generationRegions[generation]})`} en Intermedio o Difícil para desbloquear los desafíos.
                  </p>
                )}
                {challengeCategories.map((cat) => (
                  <div key={cat.title} style={{ marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: '#9b98cf', fontWeight: 'normal', textAlign: 'center' }}>{cat.title}</h3>
                    <div className="challenge-toggles">
                      {cat.items.map((item) => (
                        <button
                          key={item.key}
                          className={`challenge-toggle ${runChallenges[item.key] ? 'is-active' : ''}`}
                          onClick={() => {
                            playClick()
                            if (item.key === 'challengeGauntlet' && runChallenges.challengeGauntlet && gauntletKeys.length > 0) {
                              setRunChallenges((c) => {
                                const next = { ...c, challengeGauntlet: false }
                                for (const key of gauntletKeys) {
                                  next[key] = false
                                }
                                return next
                              })
                              setGauntletKeys([])
                              return
                            }
                            setRunChallenges((c) => {
                              const next = !c[item.key]
                              if (item.key === 'ironman') {
                                return { ...c, ironman: next, noEvolution: next, fixedTeam: next, noHealing: next }
                              }
                              if (item.key === 'nuzlockeHardcore') {
                                return { ...c, nuzlockeHardcore: next, nuzlocke: next, noItems: next, noRests: next }
                              }
                              return { ...c, [item.key]: next }
                            })
                          }}
                          onMouseEnter={playHover}
                          type="button"
                          disabled={!challengesUnlocked}
                          title={item.desc}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button className="cta" onClick={() => {
              playClick()
              if (coopMode) {
                if (!coopSessionCode) { setCoopError('Primero crea o únete a una sesión cooperativa.'); return }
                if (coopMyRole === 'a' && !coopPartnerJoined) { setCoopError('Espera a que tu compañero se una a la sesión.'); return }
              }
              startNewRun()
            }} onMouseEnter={playHover} type="button" disabled={isLoading}>
              {isLoading ? 'Cargando PokeAPI...' : "Iniciar Aventura"}
            </button>
            <button className="secondary" onClick={() => { playClick(); setShowPokedex(true) }} onMouseEnter={playHover} type="button">
              📖 Abrir Pokédex
            </button>
          </div>
          {apiError && <p className="error-line">{apiError}</p>}
        </section>
      )}

      {(screen === 'route' || screen === 'battle' || screen === 'shop' || screen === 'spin' || screen === 'pokeRand' || screen === 'move' || screen === 'mega' || screen === 'gmax' || screen === 'trade') && activePokemon && (
        <section className="roulette-layout">
          <article className="panel trainer-panel">
            <p className="muted small-tag">Trainer</p>
            <img className={`sprite trainer-sprite${activePokemon.megaEvolved ? ' mega-active' : ''}${activePokemon.gmaxEvolved ? ' gmax-active' : ''}`} src={activePokemon.sprite} alt={activePokemon.name} onError={fallbackSprite} />
            <h2>
              {activePokemon.name}{activePokemon.shiny ? ' ✨' : ''}
              <StatusBadge status={activePokemon.status} />
            </h2>
            <p className="muted" style={{ fontSize: '1.2rem' }}>
              {generation === 0 ? 'Random All-Stars' : `Gen ${generation}`} · Nv.{activePokemon.level}
            </p>

            <div className="hp-line">
              <span>HP</span>
              <strong>{activePokemon.hp}/{activePokemon.maxHp}</strong>
            </div>
            <div className="meter">
              <div style={{ width: `${(activePokemon.hp / activePokemon.maxHp) * 100}%` }}></div>
            </div>

            <p className="label">Team {team.length}/{maxTeamSize}</p>
            <div className="team-grid">
              {team.map((pokemon, index) => (
                <div key={`${pokemon.id}-${index}`} className="sprite-tooltip-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    className={`team-slot ${index === activeIndex ? 'is-active' : ''} ${pokemon.hp <= 0 ? 'is-fainted' : ''}`}
                    type="button"
                    onClick={() => switchActive(index)}
                    disabled={pokemon.hp <= 0 || isLoading}
                  >
                    <img src={pokemon.sprite} alt={pokemon.name} onError={fallbackSprite} />
                    {pokemon.holdItem && ITEM_SPRITES[pokemon.holdItem] && (
                      <img
                        src={ITEM_SPRITES[pokemon.holdItem]}
                        alt={pokemon.holdItem}
                        title={`${pokemon.holdItem}: ${HOLDABLE_ITEMS[pokemon.holdItem]?.desc ?? ''}`}
                        style={{ width: '18px', height: '18px', imageRendering: 'pixelated', position: 'absolute', bottom: '4px', right: '4px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
                      />
                    )}
                    <strong>{pokemon.name}{pokemon.shiny ? ' ✨' : ''}</strong>
                    <span>
                      {pokemon.hp}/{pokemon.maxHp}
                      <StatusBadge status={pokemon.status} compact />
                    </span>
                  </button>
                  <div className="sprite-tooltip">
                    <div className="tooltip-name">
                      {pokemon.name}
                      <StatusBadge status={pokemon.status} />
                    </div>
                    {pokemon.holdItem && (
                      <div style={{ fontSize: '0.65rem', color: '#cba3ff', marginBottom: '4px' }}>
                        {ITEM_SPRITES[pokemon.holdItem] && (
                          <img src={ITEM_SPRITES[pokemon.holdItem]} alt="" style={{ width: '14px', height: '14px', imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: '3px' }} />
                        )}
                        {pokemon.holdItem} — {HOLDABLE_ITEMS[pokemon.holdItem]?.desc}
                      </div>
                    )}
                    {pokemon.types && pokemon.types.length > 0 && (
                      <div className="tooltip-types">
                        {pokemon.types.map((t) => (
                          <span key={t} className="tooltip-type-badge" style={{ background: TYPE_COLORS[t] ?? '#475569', color: '#fff' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {(() => {
                      const eff = getEffectiveStats(pokemon)
                      const stages = pokemon.statStages ?? { attack: 0, defense: 0, speed: 0 }
                      const hasItem = !!pokemon.holdItem
                      const isMegaGmax = pokemon.megaEvolved || pokemon.gmaxEvolved
                      const fmt = (base: number, eff_: number, stage_: number) => {
                        const parts: ReactNode[] = []
                        if (hasItem && base !== eff_ && !isMegaGmax) {
                          parts.push(<strong key="v">{eff_}</strong>)
                          parts.push(<span key="i" style={{ fontSize: '0.7rem', color: '#7ceb95' }}> (+{eff_ - base})</span>)
                        } else if (isMegaGmax) {
                          parts.push(<strong key="v" style={{ color: '#ff9ad6' }}>{eff_}</strong>)
                          parts.push(<span key="i" style={{ fontSize: '0.7rem', color: '#ff9ad6' }}> (+{eff_ - base})</span>)
                        } else {
                          parts.push(<strong key="v">{base}</strong>)
                        }
                        if (stage_ !== 0) {
                          const color = stage_ > 0 ? '#7ceb95' : '#ee3b2f'
                          parts.push(<span key="s" style={{ fontSize: '0.7rem', color, marginLeft: '2px' }}>({stage_ > 0 ? '+' : ''}{stage_})</span>)
                        }
                        return <>{parts}</>
                      }
                      return (
                        <>
                          <div className="tooltip-stat"><span>Nivel</span><strong>{pokemon.level}</strong></div>
                          <div className="tooltip-stat"><span>HP</span><strong>{pokemon.hp}/{pokemon.maxHp}</strong></div>
                          <div className="tooltip-stat"><span>Ataque</span>{fmt(pokemon.attack, eff.attack, stages.attack)}</div>
                          <div className="tooltip-stat"><span>Defensa</span>{fmt(pokemon.defense, eff.defense, stages.defense)}</div>
                          <div className="tooltip-stat"><span>Velocidad</span>{fmt(pokemon.speed, eff.speed, stages.speed)}</div>
                        </>
                      )
                    })()}
                    {pokemon.moves.length > 0 && (
                      <div className="tooltip-moves">
                        {pokemon.moves.slice(0, 4).map((m) => (
                          <span key={m.name}>{m.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {pokemon.hp <= 0 && (
                    <button
                      type="button"
                      className="tiny-btn"
                      style={{ background: '#ee3b2f', color: '#fff', fontSize: '0.7rem', padding: '2px 4px' }}
                      onClick={() => removeFaintedPokemon(index)}
                    >
                      🗑️ Liberar
                    </button>
                  )}
                  {pokemon.holdItem && (
                    <button
                      type="button"
                      className="tiny-btn"
                      style={{ background: '#7c3aed', color: '#fff', fontSize: '0.6rem', padding: '1px 4px' }}
                      onClick={(e) => { e.stopPropagation(); unequipItem(index) }}
                    >
                      ✕ Quitar {pokemon.holdItem}
                    </button>
                  )}
                  {pokemon.hp > 0 && team.length > 1 && (
                    <button
                      type="button"
                      className="tiny-btn"
                      style={{ background: '#3b82f6', color: '#fff', fontSize: '0.6rem', padding: '1px 4px' }}
                      onClick={(e) => { e.stopPropagation(); depositToPC(index) }}
                    >
                      → PC
                    </button>
                  )}
                </div>
              ))}
              {Array.from({ length: Math.max(0, maxTeamSize - team.length) }).map((_, index) => (
                <div key={`empty-${index}`} className="team-slot empty">
                  Empty
                </div>
              ))}
            </div>

            {pcStorage.length > 0 && (
              <>
                <p className="label" style={{ marginTop: '0.75rem' }}>PC ({pcStorage.length})</p>
                <div className="team-grid">
                  {pcStorage.map((pokemon, index) => (
                    <div key={`pc-${index}`} className="sprite-tooltip-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <button
                        className="team-slot"
                        type="button"
                        onClick={() => withdrawFromPC(index)}
                        disabled={isLoading}
                      >
                        <img src={pokemon.sprite} alt={pokemon.name} onError={fallbackSprite} />
                        {pokemon.holdItem && ITEM_SPRITES[pokemon.holdItem] && (
                          <img
                            src={ITEM_SPRITES[pokemon.holdItem]}
                            alt={pokemon.holdItem}
                            title={`${pokemon.holdItem}: ${HOLDABLE_ITEMS[pokemon.holdItem]?.desc ?? ''}`}
                            style={{ width: '18px', height: '18px', imageRendering: 'pixelated', position: 'absolute', bottom: '4px', right: '4px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
                          />
                        )}
                        <strong>{pokemon.name}{pokemon.shiny ? ' ✨' : ''}</strong>
                        <span>
                          {pokemon.hp}/{pokemon.maxHp}
                          <StatusBadge status={pokemon.status} compact />
                        </span>
                      </button>
                      <button
                        type="button"
                        className="tiny-btn"
                        style={{ background: '#3b82f6', color: '#fff', fontSize: '0.6rem', padding: '1px 4px' }}
                        onClick={() => withdrawFromPC(index)}
                      >
                        → Equipo
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {team.length > 1 && pcStorage.length > 0 && (
              <p style={{ fontSize: '0.7rem', color: '#7d7ab5', marginTop: '0.5rem', textAlign: 'center' }}>
                Haz clic en "→ Equipo" para sacar del PC. Si el equipo está lleno, se intercambia con el activo.
              </p>
            )}
          </article>

          <article className="panel center-panel">
            <h2>
              {difficulty === 'infinite' ? `Ruta #${route.length}` : `Ruta (${routeIndex + 1}/${route.length})`}
              {runChallenges.speedrun && screen === 'battle' && (
                <span style={{ marginLeft: '10px', fontSize: '0.9rem', color: speedrunSeconds <= 10 ? '#ee3b2f' : '#ffcb05', fontWeight: 'bold' }}>
                  ⏱️ {speedrunSeconds}s
                </span>
              )}
            </h2>
            {difficulty === 'infinite' && (
              <div style={{ textAlign: 'right', marginBottom: '0.5rem' }}>
                <button className="tiny-btn" type="button" onClick={() => { playClick(); setShowEndRunModal(true) }} style={{ color: '#ffcb05', borderColor: '#ffcb05' }}>
                  🏁 Terminar run
                </button>
              </div>
            )}
            {difficulty !== 'infinite' && difficulty !== 'coliseum' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', padding: '6px 10px', background: 'rgba(250,204,21,0.08)', borderRadius: '8px', border: '1px solid rgba(250,204,21,0.2)' }}>
                <span style={{ fontSize: '0.85rem', color: '#ffcb05', fontWeight: 'bold' }}>Etapa {currentStage}/3</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[0, 1, 2].map(i => {
                    const badge = badges[i]
                    return (
                      <div key={i} style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: badge ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.05)',
                        border: badge ? '2px solid #ffcb05' : '2px dashed #475569',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', transition: 'all 0.3s'
                      }}>
                        {badge ? (
                          <img src={badge.sprite} alt={badge.name} style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                            title={badge.name} />
                        ) : (
                          <span style={{ fontSize: '0.65rem', color: '#475569' }}>?</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {runChallenges.egglocke && eggInventory.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.5rem' }}>
                🥚 Huevos: {eggInventory.length} {eggInventory.map(e => `(${e.name}: ${e.hatchIn})`).join(' ')}
              </div>
            )}
            {modifier2 && (
              <div style={{ fontSize: '0.75rem', color: '#cba3ff', marginBottom: '0.5rem' }}>
                🎰 Modifier 2: <strong>{modifier2.name}</strong> — {modifier2.description}
              </div>
            )}
            <div
              className="route-map"
              ref={difficulty === 'infinite' ? routeMapRef : undefined}
              style={difficulty === 'infinite'
                ? { paddingRight: '4px', maxHeight: '340px', overflowY: 'auto' }
                : { paddingRight: '4px' }}
            >
              {(() => {
                const { positions, width, height } = getNodeMapLayout(route.length)
                const points = positions.map((p) => `${p.x},${p.y}`).join(' ')
                return (
                  <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Mapa de la ruta">
                    <polyline points={points} fill="none" stroke="#3f3f6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {route.map((node, index) => {
                      const pos = positions[index]
                      const isCurrent = index === routeIndex
                      const isDone = node.done
                      const isBlindHidden = runChallenges.blindRoute && index > routeIndex
                      const color = NODE_TYPE_COLORS[node.type] ?? '#7d7ab5'
                      const label = isBlindHidden ? '???' : nodeTypeLabel(node)
                      const clickable = isCurrent && screen === 'route' && !isLoading && !(node.type === 'rest' && restEncounter)
                      return (
                        <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                          className={isCurrent ? 'map-node map-node-current' : 'map-node'}
                          style={{ opacity: isDone ? 0.45 : 1, cursor: clickable ? 'pointer' : 'default' }}
                          onClick={clickable ? () => enterNode() : undefined}>
                          <circle r="42" fill={color} fillOpacity="0.14" stroke={isCurrent ? '#ffcb05' : color} strokeWidth={isCurrent ? 4 : 2.5} />
                          <text y="0" textAnchor="middle" dominantBaseline="central" fontSize="44" style={{ pointerEvents: 'none' }}>{isBlindHidden ? '?' : NODE_EMOJIS[node.type] ?? '•'}</text>
                          {!isBlindHidden && (
                            <>
                              <text y="-54" textAnchor="middle" fontSize="15" fill={isCurrent ? '#ffcb05' : '#9b98cf'}>#{node.id}</text>
                              <text y="64" textAnchor="middle" fontSize="16" fill={isCurrent ? '#ffcb05' : '#d9d6f2'} fontWeight={isCurrent ? 'bold' : 'normal'}>{label}</text>
                            </>
                          )}
                        </g>
                      )
                    })}
                  </svg>
                )
              })()}
            </div>

            {screen === 'shop' && (
              <div className="action-block shop-block" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: '#ffcb05' }}>🏪 Pokémart</h3>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#7ceb95' }}>
                    Dinero: ${money}
                  </span>
                </div>

                <div className="shop-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                  {shopStock.map((itemName) => {
                    const consumable = ALL_SHOP_ITEMS[itemName]
                    const holdable = HOLDABLE_ITEMS[itemName]
                    if (!consumable && !holdable) return null
                    const data = consumable ?? holdable!
                    const itemIcon = ITEM_SPRITES[itemName]
                    const isHoldable = !!holdable
                    const hardMarkup = (difficulty === 'hard' || difficulty === 'infinite') ? 1.4 : 1
                    const stageMarkup = 1 + badges.length * 0.15
                    const finalPrice = Math.floor(data.price * (1 - (modifier?.shopDiscount ?? 0)) * hardMarkup * stageMarkup)
                    const qty = shopQty[itemName] ?? 1
                    const maxQty = isHoldable ? 1 : Math.max(1, Math.min(99, Math.floor(money / finalPrice)))
                    const totalPrice = finalPrice * qty
                    const canBuy = money >= totalPrice

                        const stepperBtnStyle: CSSProperties = {
                      background: '#2a2a55',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      width: '26px',
                      height: '26px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      lineHeight: '1',
                    }

                    return (
                      <div
                        key={itemName}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: isHoldable ? 'rgba(168, 85, 247, 0.12)' : 'rgba(0,0,0,0.3)',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: isHoldable ? '1px solid rgba(168, 85, 247, 0.3)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {itemIcon && (
                            <img
                              src={itemIcon}
                              alt={itemName}
                              style={{ width: '28px', height: '28px', imageRendering: 'pixelated' }}
                            />
                          )}
                          <div>
                            <strong style={{ color: isHoldable ? '#cba3ff' : '#4d9bff' }}>{itemName}</strong>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#9b98cf' }}>{data.desc}</p>
                            {isHoldable && <span style={{ fontSize: '0.65rem', color: '#b8a1ff' }}>objeto pasivo</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {!isHoldable && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                aria-label={`Reducir cantidad de ${itemName}`}
                                style={stepperBtnStyle}
                                onClick={() => setShopQty(prev => ({ ...prev, [itemName]: Math.max(1, (prev[itemName] ?? 1) - 1) }))}
                              >−</button>
                              <span style={{ minWidth: '20px', textAlign: 'center', color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                {qty}
                              </span>
                              <button
                                type="button"
                                aria-label={`Aumentar cantidad de ${itemName}`}
                                style={{ ...stepperBtnStyle, background: '#10b981' }}
                                onClick={() => setShopQty(prev => ({ ...prev, [itemName]: Math.min(maxQty, (prev[itemName] ?? 1) + 1) }))}
                              >+</button>
                            </div>
                          )}
                          <button
                            className="tiny-btn"
                            type="button"
                            onClick={() => isHoldable ? buyHoldableItem(itemName) : buyShopItem(itemName, qty)}
                            disabled={!canBuy}
                            style={{
                              background: canBuy ? '#10b981' : '#475569',
                              minWidth: '70px',
                              color: canBuy ? '#12122b' : '#d9d6f2',
                              fontWeight: 'bold',
                              cursor: canBuy ? 'pointer' : 'not-allowed'
                            }}
                          >
                            {isHoldable ? `$${finalPrice}` : `${qty > 1 ? `${qty}× ` : ''}$${totalPrice}`}
                          </button>
                        </div>
                      </div>
                    )
                  })}


                </div>

                <details style={{ marginTop: '1rem', borderTop: '1px solid #3f3f6e', paddingTop: '0.75rem' }}>
                  <summary style={{ cursor: 'pointer', color: '#ff8a80', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    🏷️ Vender Objetos (50% del precio)
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {inventoryEntries.length === 0 ? (
                      <p style={{ color: '#7d7ab5', fontSize: '0.8rem' }}>No tienes objetos para vender.</p>
                    ) : (
                      inventoryEntries.map((entry) => {
                        if (entry.name === 'Mega Stone' || entry.name === 'Dynamax Band') return null
                        const consumable = ALL_SHOP_ITEMS[entry.name]
                        const holdable = HOLDABLE_ITEMS[entry.name]
                        if (!consumable && !holdable) return null
                        const data = consumable ?? holdable!
                        const sellPrice = Math.floor(data.price * 0.5)
                        const itemIcon = ITEM_SPRITES[entry.name]
                        const qty = Math.min(sellQty[entry.name] ?? 1, entry.count)
                        const totalSell = sellPrice * qty

                    const stepperBtnStyle: CSSProperties = {
                          background: '#4a2a2a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          width: '24px',
                          height: '24px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          lineHeight: '1',
                        }

                        return (
                          <div key={entry.name}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              background: 'rgba(248, 113, 113, 0.08)', padding: '6px 10px', borderRadius: '6px',
                              border: '1px solid rgba(248, 113, 113, 0.2)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {itemIcon && <img src={itemIcon} alt={entry.name} style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }} />}
                              <span style={{ color: '#f3f1ff', fontSize: '0.85rem' }}>
                                {entry.name} {entry.count > 1 && <span style={{ color: '#ff8a80', fontWeight: 'bold' }}>×{entry.count}</span>}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {entry.count > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <button
                                    type="button"
                                    aria-label={`Reducir cantidad a vender de ${entry.name}`}
                                    style={stepperBtnStyle}
                                    onClick={() => setSellQty(prev => ({ ...prev, [entry.name]: Math.max(1, (prev[entry.name] ?? 1) - 1) }))}
                                  >−</button>
                                  <span style={{ minWidth: '16px', textAlign: 'center', color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Aumentar cantidad a vender de ${entry.name}`}
                                    style={{ ...stepperBtnStyle, background: '#ee3b2f' }}
                                    onClick={() => setSellQty(prev => ({ ...prev, [entry.name]: Math.min(entry.count, (prev[entry.name] ?? 1) + 1) }))}
                                  >+</button>
                                </div>
                              )}
                              <button className="tiny-btn" type="button"
                                onClick={() => sellItems(entry.name, qty)}
                                style={{ background: '#ee3b2f', minWidth: '60px', color: '#12122b', fontWeight: 'bold' }}
                              >
                                {entry.count > 1 && qty > 1 ? `${qty}× ` : ''}${totalSell}
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </details>

                <button className="cta" onClick={completeCurrentNode} type="button" style={{ width: '100%' }}>
                  Salir de la Tienda
                </button>
              </div>
            )}

            {screen === 'trade' && (
              <div className="action-block shop-block" style={{ marginTop: '1rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: '#37d16b' }}>🤝 Nodo de Intercambio</h3>
                </div>

                {coopTradeMsg && <p style={{ color: '#ffcb05', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{coopTradeMsg}</p>}

                {!coopMyOfferSubmitted ? (
                  <>
                    <p className="label" style={{ margin: '0 0 0.35rem' }}>1️⃣ Elige qué ofreces (un Pokémon o un objeto)</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.5rem' }}>
                      {team.map((pokemon, idx) => {
                        const selected = coopMyOffer?.kind === 'pokemon' && coopMyOffer.id === pokemon.id
                        return (
                          <button
                            key={`of-${pokemon.id}-${idx}`}
                            type="button"
                            className="tiny-btn"
                            disabled={team.length <= 1}
                            onClick={() => coopSelectPokemon(idx)}
                            style={{ background: selected ? '#37d16b' : '#2a2a55', color: '#fff', border: selected ? '2px solid #0f7a43' : '2px solid transparent' }}
                          >
                            <img src={pokemon.sprite} alt={pokemon.name} onError={fallbackSprite} style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '4px', imageRendering: 'pixelated' }} />
                            {pokemon.name} Nv.{pokemon.level}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.75rem' }}>
                      {Array.from(new Set(inventory)).filter(i => i !== 'Mega Stone' && i !== 'Dynamax Band').map((itemName) => {
                        const count = inventory.filter(i => i === itemName).length
                        const selected = coopMyOffer?.kind === 'item' && coopMyOffer.itemName === itemName
                        return (
                          <button key={itemName} type="button" className="tiny-btn" onClick={() => coopSelectItem(itemName)} style={{ background: selected ? '#37d16b' : '#2a2a55', color: '#fff', border: selected ? '2px solid #0f7a43' : '2px solid transparent' }}>
                            {ITEM_SPRITES[itemName] && <img src={ITEM_SPRITES[itemName]} alt="" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px', imageRendering: 'pixelated' }} />}
                            {itemName} ×{count}
                          </button>
                        )
                      })}
                      {inventory.length === 0 && <span style={{ color: '#7d7ab5', fontSize: '0.8rem' }}>No tienes objetos.</span>}
                    </div>
                    {coopMyOffer && (
                      <p style={{ color: '#f3f1ff', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        Tu oferta: <strong style={{ color: '#37d16b' }}>{coopMyOffer.kind === 'pokemon' ? `${coopMyOffer.name} (Nv.${coopMyOffer.level})` : coopMyOffer.itemName}</strong>
                      </p>
                    )}
                    <button
                      className="cta"
                      type="button"
                      disabled={!coopMyOffer}
                      onClick={() => void coopConfirmExchange()}
                      style={{ width: '100%', background: coopMyOffer ? '#37d16b' : '#475569', color: coopMyOffer ? '#12122b' : '#d9d6f2', marginBottom: '0.5rem' }}
                    >
                      🤝 ¡Intercambiar! (los dos deben pulsarlo)
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      disabled={!coopMyOffer}
                      onClick={() => void cancelCoopOffer()}
                      style={{ width: '100%', marginBottom: '0.5rem' }}
                    >
                      ✕ Cancelar selección
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ color: '#37d16b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      ✅ Tu oferta fue enviada. Esperando a que tu compañero pulse "Intercambiar"...
                    </p>
                    {coopExchange && ((coopMyRole === 'a' ? coopExchange.b_ready : coopExchange.a_ready)) && !coopExchange.completed && (
                      <p style={{ color: '#9b98cf', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        🎁 Tu compañero ofrece: <strong style={{ color: '#f3f1ff' }}>{offerLabel(coopExchange)}</strong>
                      </p>
                    )}
                    {coopExchange?.completed && (
                      <p style={{ color: '#37d16b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        🎉 ¡Intercambio completado! El cambio se ha realizado automáticamente.
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#9b98cf', fontSize: '0.8rem' }}>Estado:</span>
                      <span style={{ color: coopMyOfferSubmitted ? '#37d16b' : '#9b98cf', fontSize: '0.85rem', fontWeight: 'bold' }}>Tú ✅</span>
                      <span style={{ color: '#9b98cf' }}>·</span>
                      <span style={{ color: coopExchange?.completed ? '#37d16b' : (coopExchange?.a_ready && coopExchange?.b_ready ? '#ffcb05' : '#9b98cf'), fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {coopExchange?.completed ? 'Compañero ✅' : (coopExchange?.a_ready && coopExchange?.b_ready ? '¡Ambos listos!' : 'Compañero ⏳')}
                      </span>
                    </div>
                    {!coopExchange?.completed && (
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => void cancelCoopOffer()}
                        style={{ width: '100%', marginBottom: '0.5rem', color: '#ff8a80' }}
                      >
                        ✕ Cancelar intercambio (recuperar oferta)
                      </button>
                    )}
                  </>
                )}

                <button className="cta" onClick={() => void leaveTradeNode()} type="button" style={{ width: '100%' }}>
                  Salir del Nodo
                </button>
              </div>
            )}

            {screen === 'spin' && (
              <div className="action-block spin-block">
                <h3 style={{ margin: '0 0 0.5rem', color: '#cba3ff', textAlign: 'center' }}>🎰 ¡Ruleta del Botín!</h3>
                <p className="muted" style={{ textAlign: 'center', margin: '0 0 1rem' }}>Gira para obtener un objeto al azar</p>
                <div className="roulette-wheel">
                  <div className={`roulette-items ${spinAnimating ? 'spinning' : ''}`}>
                    {spinItems.map((item, idx) => {
                      const isHoldable = !!HOLDABLE_ITEMS[item]
                      const itemIcon = ITEM_SPRITES[item]
                      const isWinner = spinRevealed && idx === spinWinnerIndex
                      const desc = isHoldable ? HOLDABLE_ITEMS[item].desc : ALL_SHOP_ITEMS[item]?.desc ?? ''
                      return (
                        <div
                          key={`spin-${idx}`}
                          className={`roulette-item ${isWinner ? 'winner' : ''} ${spinWinnerIndex === idx && spinAnimating ? 'highlight' : ''}`}
                        >
                          {itemIcon && (
                            <img src={itemIcon} alt={item} className="roulette-item-icon" />
                          )}
                          <span className="roulette-item-name">{item}</span>
                          <span className="roulette-item-desc">{desc}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {!spinRevealed && !spinAnimating && (
                  <button className="cta spin-cta" onClick={spinRoulette} type="button">
                    ¡Girar!
                  </button>
                )}
                {spinAnimating && (
                  <p style={{ textAlign: 'center', color: '#cba3ff', fontWeight: 'bold', margin: '0.5rem 0' }}>Girando...</p>
                )}
                {spinRevealed && spinWinnerIndex !== null && (
                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <p style={{ color: '#7ceb95', fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
                      ¡Obtuviste {spinItems[spinWinnerIndex]}!
                    </p>
                    <button className="cta spin-cta" onClick={claimSpinItem} type="button">
                      Recoger objeto
                    </button>
                  </div>
                )}
              </div>
            )}

            {screen === 'pokeRand' && (
              <div className="action-block pokeRand-block">
                <h3 style={{ margin: '0 0 0.5rem', color: '#4d9bff', textAlign: 'center' }}>🎲 ¡PokeRand Ruleta!</h3>
                <p className="muted" style={{ textAlign: 'center', margin: '0 0 1rem' }}>Gira para obtener un Pokémon que se una a tu equipo</p>
                <div className="roulette-wheel" style={{ borderColor: 'rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.06)' }}>
                  <div className={`roulette-items ${pokeRandAnimating ? 'spinning' : ''}`}>
                    {pokeRandPokemon.map((pokemon, idx) => {
                      const isWinner = pokeRandRevealed && idx === pokeRandWinnerIndex
                      return (
                        <div
                          key={`pr-${pokemon.id}-${idx}`}
                          className={`roulette-item ${isWinner ? 'winner' : ''} ${pokeRandWinnerIndex === idx && pokeRandAnimating ? 'highlight' : ''}`}
                          style={isWinner ? { borderColor: '#4d9bff', boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)' } : undefined}
                        >
                          <img src={pokemon.sprite} alt={pokemon.name} className="roulette-item-icon" onError={fallbackSprite} style={{ width: '48px', height: '48px' }} />
                          <span className="roulette-item-name">{pokemon.name}</span>
                          <span className="roulette-item-desc">Nv.{pokemon.level}</span>
                          <span className="roulette-item-desc" style={{ fontSize: '0.55rem', color: '#9b98cf' }}>
                            {pokemon.types?.join('/')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {!pokeRandRevealed && !pokeRandAnimating && (
                  <button className="cta pokeRand-cta" onClick={pokeRandSpin} type="button">
                    ¡Girar!
                  </button>
                )}
                {pokeRandAnimating && (
                  <p style={{ textAlign: 'center', color: '#4d9bff', fontWeight: 'bold', margin: '0.5rem 0' }}>Girando...</p>
                )}
                {pokeRandRevealed && pokeRandWinnerIndex !== null && (
                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <p style={{ color: '#7ceb95', fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
                      ¡{pokeRandPokemon[pokeRandWinnerIndex].name} quiere unirse a tu equipo!
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        className="cta pokeRand-cta"
                        onClick={claimPokeRandPokemon}
                        type="button"
                        style={{ width: 'auto', padding: '10px 24px' }}
                      >
                        {team.length >= maxTeamSize ? `Capturar → PC (${pcStorage.length} en PC)` : `Capturar (${team.length}/${maxTeamSize})`}
                      </button>
                      <button
                        className="secondary"
                        onClick={skipPokeRandPokemon}
                        type="button"
                        style={{ padding: '10px 24px' }}
                      >
                        Liberar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {screen === 'move' && (
              <div className="action-block">
                <h3 style={{ margin: '0 0 0.5rem', color: '#f3f1ff', textAlign: 'center' }}>📝 ¡Move Tutor!</h3>
                {!selectedNewMove ? (
                  <>
                    <p className="muted" style={{ textAlign: 'center', margin: '0 0 0.75rem' }}>
                      Elige un movimiento para <strong>{activePokemon?.name}</strong> o salta el nodo.
                    </p>
                    <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                      {moveOptions.map((move) => (
                        <button
                          key={`move-opt-${move.name}`}
                          className="move-btn move-opt-btn"
                          type="button"
                          onClick={() => setSelectedNewMove(move)}
                          style={{ borderColor: TYPE_COLORS[move.type] ?? '#475569' }}
                        >
                          <strong>{move.name}</strong>
                          <span className="muted" style={{ fontSize: '0.5rem' }}>
                            {move.type.toUpperCase()} · Pwr {move.power} · Acc {move.accuracy ?? '—'}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button className="secondary" onClick={skipMoveNode} type="button">
                        Saltar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="muted" style={{ textAlign: 'center', margin: '0 0 0.75rem' }}>
                      <strong style={{ color: TYPE_COLORS[selectedNewMove.type] ?? '#f3f1ff' }}>{selectedNewMove.name}</strong>
                      {' '} — Elige qué movimiento reemplazar:
                    </p>
                    <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                      {activePokemon?.moves.map((move, idx) => (
                        <button
                          key={`move-replace-${idx}`}
                          className="move-btn move-opt-btn"
                          type="button"
                          onClick={() => replaceTeamMove(idx)}
                          style={{ borderColor: TYPE_COLORS[move.type] ?? '#475569' }}
                        >
                          <strong>{move.name}</strong>
                          <span className="muted" style={{ fontSize: '0.5rem' }}>
                            {move.type.toUpperCase()} · Pwr {move.power}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button className="secondary" onClick={() => { setSelectedNewMove(null) }} type="button">
                        ← Volver
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {screen === 'mega' && (
              <div className="action-block" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>💎</div>
                <h3 style={{ margin: '0 0 0.5rem', color: '#ff9ad6' }}>¡Mega Piedra!</h3>
                {inventory.includes('Mega Stone') || team.some(p => p.holdItem === 'Mega Stone') ? (
                  <>
                    <p style={{ margin: '0 0 0.25rem' }}>Has recibido una <strong>Mega Piedra</strong>.</p>
                    <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 1rem' }}>
                      Equípala a un Pokémon y durante el combate podrás mega-evolucionar una vez.
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ margin: '0 0 0.25rem' }}>Ya tenías una Mega Piedra.</p>
                    <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 1rem' }}>
                      Recibiste PokéCoins como compensación.
                    </p>
                  </>
                )}
                <button className="cta" onClick={() => { completeCurrentNode(); setScreen('route') }} type="button" style={{ background: '#ff9ad6' }}>
                  Continuar
                </button>
              </div>
            )}

            {screen === 'route' && legendaryEncounter && (
              <div className="action-block">
                <p>
                  🐉 ¡Un Pokémon Legendario apareció! <strong>{legendaryEncounter.name}</strong> está esperando ser capturado.
                </p>
                <p style={{ color: '#fbbf24', fontSize: '0.85rem' }}>✨ El equipo se ha curado por completo.</p>
                <div className="capture-card" style={{ border: '2px solid #fbbf24', boxShadow: '0 0 12px rgba(251,191,36,0.4)' }}>
                  <img className="sprite" src={legendaryEncounter.sprite} alt={legendaryEncounter.name} onError={fallbackSprite} />
                </div>
                <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                  <button className="cta" onClick={captureLegendaryPokemon} type="button" style={{ background: '#d97706' }}>
                    {team.length >= maxTeamSize ? `Capturar → PC (${pcStorage.length} en PC)` : '¡Capturar Legendario!'}
                  </button>
                  <button className="secondary" onClick={skipLegendaryCapture} type="button">
                    Skip
                  </button>
                </div>
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type !== 'rest' && !legendaryEncounter && (
              <div className="action-block">
                <p>
                  Next node: <strong>{currentNode.label}</strong> ({nodeTypeLabel(currentNode)})
                </p>
                <button className={`cta ${currentNode.type === 'teamRocket' ? 'cta-danger' : ''}`} onClick={enterNode} type="button" disabled={isLoading}>
                  {isLoading ? 'Searching rival...' : currentNode.type === 'teamRocket' ? '🔴 Enfrentar a TeamR!' : currentNode.type === 'spin' ? '🎰 ¡Girar la Ruleta!' : currentNode.type === 'pokeRand' ? '🎲 ¡Girar la Ruleta Pokémon!' : currentNode.type === 'mega' ? '💎 ¡Recoger Mega Piedra!' : currentNode.type === 'gmax' ? '⚡ ¡Enfrentar G-MAX!' : currentNode.type === 'trade' ? '🤝 Intercambiar' : 'Enter node'}
                </button>
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type === 'rest' && restEncounter && !legendaryEncounter && (
              <div className="action-block">
                <p>
                  Rest stop: <strong>{restEncounter.name}{restEncounter.shiny ? ' ✨' : ''}</strong> is waiting.
                </p>
                <p className="muted">Reward item added: {restRewardItem}</p>
                <div className="capture-card" style={restEncounter.shiny ? { border: '2px solid #ffcb05', boxShadow: '0 0 12px rgba(250,204,21,0.4)' } : undefined}>
                  <img className="sprite" src={restEncounter.sprite} alt={restEncounter.name} onError={fallbackSprite} />
                </div>
                <div className="moves-grid" style={{ marginBottom: '1rem' }}>
                  <button className="cta" onClick={captureRestPokemon} type="button">
                    {team.length >= maxTeamSize ? `Capturar → PC (${pcStorage.length} en PC)` : 'Capturar'}
                  </button>
                  <button className="secondary" onClick={skipRestCapture} type="button">
                    Skip
                  </button>
                </div>
                <div className="evolve-section" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Descansa para recuperar energía:</p>
                  <button className="cta" onClick={() => { if (runChallenges.noHealing) { setBattleLog(prev => ['🚫 Desafío Sin Curación: No puedes curar en descanso.', ...prev].slice(0, 15)); completeCurrentNode(); return } setTeam(prev => prev.map(p => p.hp <= 0 ? { ...p, hp: Math.max(1, Math.floor(p.maxHp * 0.5)) } : { ...p, hp: p.maxHp })); setBattleLog(prev => ['💊 ¡Equipo restaurado completamente en el descanso!', ...prev].slice(0, 15)); completeCurrentNode() }} type="button"                     style={{ background: '#ee3b2f', width: '100%' }}>
                    💊 Curar Equipo
                  </button>
                </div>
              </div>
            )}

            {screen === 'route' && currentNode && currentNode.type === 'rest' && !restEncounter && !legendaryEncounter && (
              <div className="action-block">
                <p>
                  Rest stop: <strong>{currentNode.label}</strong>.
                </p>
                <button className="cta" onClick={enterNode} type="button" disabled={isLoading}>
                  {isLoading ? 'Searching encounter...' : 'Enter rest'}
                </button>
              </div>
            )}

            {screen === 'battle' && enemy && (
              <div className="action-block">
                {isTrainerBattle ? (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      {trainerSprite && (
                        <img
                          src={trainerSprite}
                          alt={trainerName}
                          style={{ width: '72px', height: '72px', imageRendering: 'pixelated' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      )}
                      <div>
                        <p style={{ margin: '0', fontWeight: 'bold', color: '#ffcb05', fontSize: '0.95rem' }}>
                          {trainerBadge ? `🏆 Líder ${trainerName}` : `⚔️ ${trainerName}`}
                        </p>
                        {trainerBadge && (
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#fbbf24' }}>{trainerBadge}</p>
                        )}
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#9b98cf' }}>
                          Equipo: {trainerTeam.length} Pokémon
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {trainerTeam.map((tp, idx) => {
                        const isActive = idx === trainerPokemonIndex
                        const isDefeated = idx < trainerPokemonIndex || (idx === trainerPokemonIndex && tp.hp <= 0)
                        return (
                          <div
                            key={`trainer-pkmn-${idx}`}
                            title={`${tp.name} Nv.${tp.level} – ${tp.hp}/${tp.maxHp} HP`}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '6px',
                              border: isActive ? '2px solid #ffcb05' : '1px solid rgba(255,255,255,0.15)',
                              background: isDefeated ? 'rgba(239,68,68,0.15)' : isActive ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.05)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              overflow: 'hidden', position: 'relative'
                            }}
                          >
                            <img
                              src={tp.sprite}
                              alt={tp.name}
                              onError={fallbackSprite}
                              style={{
                                width: '34px', height: '34px',
                                filter: isDefeated ? 'grayscale(100%) brightness(0.5)' : 'none',
                                opacity: isDefeated ? 0.4 : 1
                              }}
                            />
                            {tp.status && (
                              <span style={{ position: 'absolute', top: 1, right: 1, fontSize: '0.6rem', lineHeight: 1, textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
                                {STATUS_LABELS[tp.status.type].split(' ')[0]}
                              </span>
                            )}
                            {isActive && (
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                height: '3px', background: '#ffcb05', borderRadius: '0 0 4px 4px'
                              }} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: '0 0 4px 0', color: '#86efac', fontSize: '0.85rem' }}>🌿 Pokémon Salvaje</p>
                )}

                <p style={{ margin: '0 0 4px 0', fontSize: '1.2rem' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{enemy.name}{enemy.shiny ? ' ✨' : ''}</strong>
                  <StatusBadge status={enemy.status} />
                  {' · '}Nv. {enemy.level}
                </p>
                <img className={`sprite enemy-sprite${enemy.gmaxEvolved ? ' gmax-active' : ''}`} src={enemy.sprite} alt={enemy.name} onError={fallbackSprite} style={enemyHitFlash ? { filter: 'brightness(1.5) sepia(1) hue-rotate(-40deg) saturate(5)', transition: 'filter 0.05s' } : { transition: 'filter 0.3s' }} />
                <div className="hp-line">
                  <span>HP rival</span>
                  <strong>{enemy.hp}/{enemy.maxHp}</strong>
                </div>
                <div className="meter enemy-meter">
                  <div style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}></div>
                </div>

                <div className="moves-grid">
                  {(runChallenges.restrictedMoves ? activePokemon.moves.slice(0, 2) : activePokemon.moves).map((move) => (
                    <button
                      key={move.name}
                      className="move-btn"
                      onClick={() => onPlayerMove(move)}
                      type="button"
                      disabled={isLoading || (runChallenges.speedrun && speedrunSeconds <= 0)}
                      title={moveTooltip(move)}
                      style={move.ailment ? { borderColor: STATUS_COLORS[move.ailment] } : undefined}
                    >
                      {move.name} ({move.type}{runChallenges.typeRandomizer ? ' *' : ''}){move.minHits ? ` x${move.minHits}-${move.maxHits}` : ''}{move.ailment ? ` ${STATUS_LABELS[move.ailment].split(' ')[0]}` : ''}
                    </button>
                  ))}
                </div>
                {!isTrainerBattle && currentNode?.type !== 'gmax' && (
                  <button
                    className="cta"
                    onClick={openCaptureMenu}
                    type="button"
                    disabled={isLoading || !inventory.some(i => POKEBALL_NAMES.includes(i))}
                    style={{ marginTop: '8px', width: '100%', background: '#37d16b' }}
                  >
                    🏐 Capturar ({inventory.filter(i => POKEBALL_NAMES.includes(i)).length} balls)
                  </button>
                )}
                {activePokemon.holdItem === 'Mega Stone' && !battleMegaUsed && !activePokemon.gmaxEvolved && MEGA_CAPABLE_IDS.has(activePokemon.id) && (
                  <button
                    className="cta"
                    onClick={megaEvolveActive}
                    type="button"
                    style={{ marginTop: '8px', width: '100%', background: '#e060a8' }}
                  >
                    💥 ¡Mega Evolucionar!
                  </button>
                )}
                {activePokemon.holdItem === 'Dynamax Band' && !battleGmaxUsed && !activePokemon.gmaxEvolved && !activePokemon.megaEvolved && GMAX_CAPABLE_IDS.has(activePokemon.id) && (
                  <button
                    className="cta"
                    onClick={gmaxEvolveActive}
                    type="button"
                    style={{ marginTop: '8px', width: '100%', background: '#6b8cff' }}
                  >
                    ⚡ ¡Gigamaximar!
                  </button>
                )}
              </div>
            )}

            {apiError && <p className="error-line">{apiError}</p>}
          </article>

          <article className="panel items-panel">
            <h2>Items</h2>
            <div className="items-grid">
              {inventoryEntries.length > 0 ? (
                inventoryEntries.map((entry) => {
                  const itemIcon = ITEM_SPRITES[entry.name]
                  const isHoldable = !!HOLDABLE_ITEMS[entry.name]
                  if (isHoldable) {
                    const holdableIdx = inventory.indexOf(entry.name)
                    return (
                      <button
                        key={entry.name}
                        className="item-slot filled item-button"
                        type="button"
                        onClick={() => setEquipModal({ itemName: entry.name, itemIndex: holdableIdx })}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderLeft: '3px solid #b8a1ff' }}
                      >
                        {itemIcon && (
                          <img
                            src={itemIcon}
                            alt={entry.name}
                            style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                          />
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <strong style={{ color: '#cba3ff' }}>{entry.name}</strong>
                          <span style={{ fontSize: '0.6rem', color: '#7c3aed' }}>x{entry.count} · equipar</span>
                        </div>
                      </button>
                    )
                  }
                  return (
                    <button
                      key={entry.name}
                      className="item-slot filled item-button"
                      type="button"
                      onClick={() => consumeInventoryItem(entry.name)}
                      title={entry.description}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px' }}
                    >
                      {itemIcon && (
                        <img
                          src={itemIcon}
                          alt={entry.name}
                          style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                        />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <strong>{entry.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#9b98cf' }}>x{entry.count}</span>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="item-slot empty">No items</div>
              )}
            </div>

            {modifier && (
              <div className="modifier-box">
                <p className="small-tag">Modifier</p>
                <strong>{modifier.name}</strong>
                <p className="muted">{modifier.description}</p>
              </div>
            )}

            <div className="log-mini">
              <p className="small-tag">Battle log</p>
              <ul>
                {battleLog.map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ul>
            </div>
          </article>
        </section>
      )}

      {screen === 'victory' && (
        <section className="panel end-panel">
          <h2>¡Victoria!</h2>
          <p>Has completado la ruta ({coopMode ? (difficultyNodeCounts[coopDiff] || 10) : difficultyNodeCounts[difficulty]} nodos) y derrotado al jefe final.</p>

          {victoryUnlocks && (
            <div
              className="victory-unlocks-box"
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                padding: '1.25rem',
                margin: '1.5rem 0',
                textAlign: 'left'
              }}
            >
              <h3 style={{ color: '#34d399', margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>
                🎉 ¡Progreso de la Aventura!
              </h3>
              {victoryUnlocks.nextGenNumber ? (
                <p style={{ margin: '6px 0', color: '#f8fafc', fontSize: '0.95rem' }}>
                  🔓 <strong>¡NUEVA GENERACIÓN DESBLOQUEADA!</strong> Gen {victoryUnlocks.nextGenNumber} ({victoryUnlocks.nextGenName}) ya está disponible para jugar.
                </p>
              ) : difficulty === 'easy' && currentRunGen < 9 && !progression.completedMedium.includes(currentRunGen) ? (
                <p style={{ margin: '6px 0', color: '#9b98cf', fontSize: '0.85rem' }}>
                  💡 <em>Consejo: Completa la Gen {currentRunGen} ({victoryUnlocks.genName}) en dificultad Intermedia para desbloquear la Gen {currentRunGen + 1}.</em>
                </p>
              ) : null}

              {victoryUnlocks.unlockedHard && (
                <p style={{ margin: '6px 0', color: '#fb923c', fontSize: '0.95rem' }}>
                  🔥 <strong>¡MODO DÍFICIL DESBLOQUEADO!</strong> Ahora puedes desafiar la Gen {currentRunGen} ({victoryUnlocks.genName}) en dificultad Difícil (25 rutas).
                </p>
              )}
              {victoryUnlocks.unlockedInfinite && (
                <p style={{ margin: '6px 0', color: '#cba3ff', fontSize: '0.95rem' }}>
                  ♾️ <strong>¡MODO INFINITE DESBLOQUEADO!</strong> Ahora puedes jugar la Gen {currentRunGen} ({victoryUnlocks.genName}) en modo Infinite (rutas infinitas).
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button className="cta" onClick={resetToSetup} type="button">
              Iniciar otra partida
            </button>
            <button className="cta" onClick={() => { playClick(); void restartRun() }} type="button" style={{ background: '#37d16b', color: '#12122b' }}>
              🔄 Reiniciar
            </button>
          </div>
        </section>
      )}

      {screen === 'defeat' && (
        <section className="panel end-panel defeat-panel">
          <div className="defeat-header">
            <h2 className="defeat-title">{voluntaryRunEnd ? '🏁 AVENTURA TERMINADA' : '💀 HAS SIDO DERROTADO'}</h2>
            <p className="muted">{voluntaryRunEnd ? 'Has decidido finalizar la aventura.' : 'Tu equipo ha quedado fuera de combate.'}</p>
          </div>

          {coopSessionEndedMsg && (
            <p style={{ margin: '0 0 1rem 0', padding: '0.6rem 0.9rem', borderRadius: '8px', background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.4)', color: '#ffcb05', fontSize: '0.85rem' }}>
              🤝 {coopSessionEndedMsg}
            </p>
          )}

          {defeatSummary && (
            <div className="defeat-details-grid" style={{ marginTop: '1rem', textAlign: 'left' }}>
              <div className="defeat-box" style={{ marginBottom: '1.5rem' }}>
                <h3 className="section-subtitle" style={{ fontSize: '1rem', color: '#ff8a80' }}>🛡️ Equipo Caído</h3>
                <div className="fainted-team-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {defeatSummary.finalTeam.map((pkmn, idx) => (
                    <div key={`${pkmn.id}-${idx}`} className="fainted-card" style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '48px', height: '48px', opacity: 0.6, filter: 'grayscale(100%)' }} />
                      <strong style={{ display: 'block', fontSize: '0.85rem' }}>{pkmn.name}<StatusBadge status={pkmn.status} compact /></strong>
                      <span className="muted" style={{ fontSize: '0.75rem' }}>Nv. {pkmn.level}</span>
                    </div>
                  ))}
                </div>
              </div>

              {defeatSummary.enemy && (
                <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Caíste luchando contra <strong>{defeatSummary.enemy.name} (Nv. {defeatSummary.enemy.level})</strong> en el nodo <em>{defeatSummary.lastNodeLabel ?? 'de combate'}</em>.
                </p>
              )}

              <div className="log-mini defeat-log" style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                <p className="small-tag">Últimas acciones</p>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                  {defeatSummary.battleLog.slice(0, 5).map((line, index) => (
                    <li key={`defeat-log-${index}`}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {difficulty === 'infinite' && (
            <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid #3f3f6e', fontSize: '0.85rem' }}>
              {scoreSubmitState === 'submitting' && <span style={{ color: '#9b98cf' }}>⏳ Enviando puntuación al ranking mundial...</span>}
              {scoreSubmitState === 'submitted' && (
                <span style={{ color: '#37d16b' }}>
                  ✅ ¡Puntuación registrada en el ranking mundial!
                  {submitIsNewBest === true && <strong style={{ color: '#ffcb05' }}> ¡Nuevo récord personal en esta generación!</strong>}
                  {submitIsNewBest === false && ' Se conserva tu mejor marca de esta generación.'}
                </span>
              )}
              {scoreSubmitState === 'error' && <span style={{ color: '#ff8a80' }}>⚠️ No se pudo enviar la puntuación al ranking.</span>}
              {scoreSubmitState === 'loginRequired' && (
                <span style={{ color: '#ffcb05' }}>
                  🔑 ¡Llegaste al Nodo #{pendingScoreRef.current?.node}! Inicia sesión o crea una cuenta para registrar tu puntuación en el ranking mundial.
                </span>
              )}
              {scoreSubmitState === 'disabled' && <span style={{ color: '#9b98cf' }}>⚙️ Ranking no configurado. Añade las variables de entorno de Supabase para habilitarlo.</span>}
              <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                <button className="tiny-btn" type="button" onClick={openLeaderboard}>
                  🌍 Ver ranking mundial
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button className="cta" onClick={resetToSetup} type="button">
              Intentar de nuevo
            </button>
            <button className="cta" onClick={() => { playClick(); void restartRun() }} type="button" style={{ background: '#37d16b', color: '#12122b' }}>
              🔄 Reiniciar
            </button>
          </div>
        </section>
      )}

      {/* Coop: entrando a la aventura (auto-inicio al unirse) */}
      {coopStarting && (
        <div className="modal-backdrop" style={{ zIndex: 10001 }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎒</div>
            <h3 style={{ color: '#37d16b', margin: '0 0 0.5rem' }}>Entrando a la Aventura...</h3>
            <div className="spin-anim" style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>⏳</div>
            <p style={{ color: '#9b98cf', margin: 0, fontSize: '0.85rem' }}>
              Generando tu run cooperativa...
            </p>
          </div>
        </div>
      )}

      {/* Coop: esperando al compañero */}
      {coopWaiting && (
        <div className="modal-backdrop" style={{ zIndex: 10000 }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🤝</div>
            <h3 style={{ color: '#37d16b', margin: '0 0 0.5rem' }}>Esperando a tu compañero...</h3>
            <p style={{ color: '#9b98cf', margin: '0 0 1rem', fontSize: '0.9rem' }}>
              Completaste el nodo {coopWaitingNode + 1}. Tu compañero aún no termina su parte.
            </p>
            <div className="spin-anim" style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⏳</div>
            <p style={{ color: '#7d7ab5', fontSize: '0.75rem' }}>Ambos deben completar cada nodo para avanzar.</p>
            <button className="tiny-btn" type="button" onClick={abandonCoopRun} style={{ color: '#ff8a80', marginTop: '0.5rem' }}>
              ✕ Abandonar sesión
            </button>
          </div>
        </div>
      )}

      {/* Achievement Popup */}
      {newAchievement && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', left: '20px', zIndex: 9999, background: '#1c1c3a', border: '3px solid #ffcb05', borderRadius: '6px', padding: '1rem 1.5rem', boxShadow: '4px 4px 0 0 rgba(0,0,0,0.6)', animation: 'slideInRight 0.5s ease', maxWidth: '300px', marginLeft: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem' }}>{newAchievement.icon}</span>
          <div>
            <div style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>¡Logro Desbloqueado!</div>
            <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem' }}>{newAchievement.name}</div>
            <div style={{ color: '#9b98cf', fontSize: '0.8rem' }}>{newAchievement.desc}</div>
          </div>
        </div>
        <button onClick={handleAchievementDismiss} style={{ position: 'absolute', top: '4px', right: '8px', background: 'none', border: 'none', color: '#7d7ab5', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
      </div>
      )}

      {/* Random Event Modal */}
      {activeRandomEvent && (
        <div className="modal-backdrop" onClick={() => { playClick(); handleRandomEventChoice() }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{activeRandomEvent.icon}</div>
            <h3 style={{ color: '#ffcb05', margin: '0.5rem 0' }}>{activeRandomEvent.title}</h3>
            <p style={{ color: '#d9d6f2', marginBottom: '1.5rem' }}>{activeRandomEvent.desc}</p>
            <button className="cta" onClick={() => { playClick(); handleRandomEventChoice() }} style={{ background: '#ffcb05', color: '#000' }}>¡Continuar!</button>
          </div>
        </div>
      )}

      {/* Trader Modal */}
      {traderModal && (
        <div className="modal-backdrop" onClick={() => setTraderModal(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <h3 style={{ color: '#ffcb05', textAlign: 'center', marginBottom: '0.5rem' }}>🎭 Comerciante Misterioso</h3>
            <p style={{ color: '#9b98cf', textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>Elige un Pokémon para intercambiar por uno nuevo de la misma generación.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {team.map((p, i) => (
                <button key={i} onClick={() => { playClick(); handleTraderChoice(i) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: i === activeIndex ? 'rgba(56,189,248,0.15)' : 'rgba(30,41,59,0.6)', border: `1px solid ${i === activeIndex ? '#4d9bff' : '#3f3f6e'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'left', color: '#f3f1ff' }}>
                  <img src={p.sprite} alt={p.name} style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{p.name} {p.shiny ? '✨' : ''}<StatusBadge status={p.status} compact /></div>
                    <div style={{ color: '#9b98cf', fontSize: '0.75rem' }}>Nv.{p.level} — HP:{p.hp}/{p.maxHp} — ATK:{p.attack} DEF:{p.defense} SPD:{p.speed}</div>
                  </div>
                </button>
              ))}
            </div>
            <button className="cta" onClick={() => { playClick(); setTraderModal(false); setBattleLog(prev => [`🎭 Rechazaste el intercambio.`, ...prev].slice(0, 15)) }} style={{ marginTop: '1rem', background: '#7d7ab5', width: '100%' }}>Rechazar</button>
          </div>
        </div>
      )}

      {/* Mercader Misterioso Modal */}
      {merchantItems && (
        <div className="modal-backdrop" onClick={() => setMerchantItems(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.5rem' }}>
            <h3 style={{ color: '#ffcb05', margin: '0 0 0.5rem' }}>🧳 Mercader Misterioso</h3>
            <p style={{ color: '#9b98cf', fontSize: '0.85rem', marginBottom: '1rem' }}>El mercader te ofrece objetos evolutivos:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {merchantItems.map(item => {
                const canBuy = money >= item.price
                return (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(30,41,59,0.6)', border: '1px solid #3f3f6e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {ITEM_SPRITES[item.name] && <img src={ITEM_SPRITES[item.name]} alt={item.name} style={{ width: '32px', height: '32px' }} onError={fallbackSprite} />}
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#9b98cf', fontSize: '0.75rem' }}>${item.price}</div>
                      </div>
                    </div>
                    <button className="cta" onClick={() => { if (money >= item.price) { setMoney(prev => prev - item.price); setInventory(prev => [...prev, item.name]); setBattleLog(prev => [`🧳 Compraste ${item.name} por $${item.price}.`, ...prev].slice(0, 15)) } }} disabled={!canBuy} style={{ fontSize: '0.8rem', padding: '4px 14px', background: canBuy ? '#ffcb05' : '#475569', color: '#000' }}>
                      {canBuy ? 'Comprar' : 'No alcanza'}
                    </button>
                  </div>
                )
              })}
            </div>
            <button className="cta" onClick={() => setMerchantItems(null)} style={{ marginTop: '1rem', background: '#7d7ab5', width: '100%' }}>Salir</button>
          </div>
        </div>
      )}

      {/* League Offer Modal */}
      {leagueOffer && (
        <div className="modal-backdrop" onClick={() => { setLeagueOffer(false); finalizeRunVictory() }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏆</div>
            <h3 style={{ color: '#ffcb05', margin: '0.5rem 0' }}>¡Campeón de la Liga!</h3>
            <p style={{ color: '#d9d6f2', marginBottom: '1rem' }}>
              Has derrotado al líder de gimnasio. ¿Deseas entrar a la <strong style={{ color: '#4d9bff' }}>Liga Pokémon</strong>?
            </p>
            <p style={{ color: '#9b98cf', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Deberás elegir 6 Pokémon de tu equipo y PC. Una vez dentro no podrás cambiarlos.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="cta" onClick={() => { setLeagueOffer(false); setLeagueTeamSelection(true) }} style={{ background: '#4d9bff', color: '#000' }}>
                ¡Sí, a la Liga!
              </button>
              <button className="cta" onClick={() => { setLeagueOffer(false); finalizeRunVictory() }} style={{ background: '#7d7ab5' }}>
                No, terminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* League Team Selection Modal */}
      {leagueTeamSelection && (
        <div className="modal-backdrop" onClick={() => setLeagueTeamSelection(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <h3 style={{ color: '#4d9bff', margin: '0 0 0.5rem' }}>🏆 Equipo para la Liga</h3>
            <p style={{ color: '#9b98cf', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Selecciona 6 Pokémon de tu equipo y PC ({tempLeagueTeam.length}/6)
            </p>
            {tempLeagueTeam.length === 6 && (
              <button className="cta" onClick={async () => {
                setLeagueTeamSelection(false)
                const healed = tempLeagueTeam.map(p => ({ ...p, hp: p.maxHp, status: undefined }))
                const maxLvl = Math.max(...healed.map(p => p.level)) + 2
                const leagueRoute: RouteNode[] = []
                for (let i = 0; i < 4; i++) {
                  leagueRoute.push({ id: 1000 + i, type: 'boss', label: `Liga #${i + 1}`, done: false })
                }
                setTeam(healed)
                setPcStorage([])
                setRoute(leagueRoute)
                setRouteIndex(0)
                setScreen('route')
                setBattleLog(prev => [`🏆 ¡Bienvenido a la Liga Pokémon! 4 jefes te esperan (Nv.${maxLvl}).`, ...prev].slice(0, 15))
              }} style={{ background: '#4d9bff', color: '#000', width: '100%', marginBottom: '1rem' }}>
                🏆 ¡Comenzar Liga!
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '6px' }}>
              {[...team.map(p => ({ ...p, _source: 'team' as const })), ...pcStorage.map(p => ({ ...p, _source: 'pc' as const }))].map((pkmn, idx) => {
                const key = `${pkmn._source}-${idx}`
                const selected = tempLeagueTeam.some(p => p.id === pkmn.id && p.hp === pkmn.hp)
                return (
                  <div key={key}
                    onClick={() => {
                      if (selected) {
                        setTempLeagueTeam(prev => prev.filter(p => !(p.id === pkmn.id && p.hp === pkmn.hp)))
                      } else if (tempLeagueTeam.length < 6) {
                        setTempLeagueTeam(prev => [...prev, pkmn])
                      }
                    }}
                    style={{
                      padding: '6px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer',
                      background: selected ? 'rgba(56,189,248,0.2)' : 'rgba(30,41,59,0.6)',
                      border: selected ? '2px solid #4d9bff' : '1px solid #3f3f6e', opacity: !selected && tempLeagueTeam.length >= 6 ? 0.4 : 1
                    }}
                  >
                    <img src={pkmn.sprite} alt={pkmn.name} onError={fallbackSprite} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} />
                    <div style={{ fontSize: '0.7rem', textTransform: 'capitalize', color: selected ? '#4d9bff' : '#f3f1ff' }}>{pkmn.name}</div>
                    <div style={{ fontSize: '0.6rem', color: pkmn._source === 'team' ? '#7ceb95' : '#9b98cf' }}>Nv.{pkmn.level}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Achievements Modal */}
      {showAchievements && (
        <div className="modal-backdrop" onClick={() => setShowAchievements(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <h2 style={{ color: '#4d9bff', textAlign: 'center', marginBottom: '1rem' }}>🏅 Logros ({Object.values(achievements).filter(a => a.unlocked).length}/{ACHIEVEMENTS.length})</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {ACHIEVEMENTS.map(a => {
                const unlocked = achievements[a.id]?.unlocked
                return (
                  <div key={a.id} style={{ background: unlocked ? 'rgba(250,204,21,0.1)' : 'rgba(30,41,59,0.5)', border: `1px solid ${unlocked ? '#ffcb05' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>{a.icon}</span>
                      <div>
                        <div style={{ color: unlocked ? '#ffcb05' : '#9b98cf', fontWeight: 'bold', fontSize: '0.85rem' }}>{a.name}</div>
                        <div style={{ color: '#7d7ab5', fontSize: '0.75rem' }}>{a.desc}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button className="cta" onClick={() => setShowAchievements(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Run Stats on Victory */}
      {screen === 'victory' && (
        <div className="panel" style={{ maxWidth: '400px', margin: '0 auto', padding: '1rem' }}>
          <h3 style={{ color: '#4d9bff', textAlign: 'center', marginBottom: '0.75rem' }}>📊 Estadísticas de la Run</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '1.1rem' }}>
            <div style={{ color: '#9b98cf' }}>⚔️ Batallas ganadas:</div><div style={{ color: '#37d16b', fontWeight: 'bold' }}>{runStats.battlesWon}</div>
            <div style={{ color: '#9b98cf' }}>💥 Daño total infligido:</div><div style={{ color: '#ff8a80', fontWeight: 'bold' }}>{runStats.totalDamageDealt}</div>
            <div style={{ color: '#9b98cf' }}>🛡️ Daño total recibido:</div><div style={{ color: '#fb923c', fontWeight: 'bold' }}>{runStats.totalDamageTaken}</div>
            <div style={{ color: '#9b98cf' }}>🎯 Golpes críticos:</div><div style={{ color: '#ffcb05', fontWeight: 'bold' }}>{runStats.critsLanded}</div>
            <div style={{ color: '#9b98cf' }}>🔄 Turnos jugados:</div><div style={{ color: '#d9d6f2', fontWeight: 'bold' }}>{runStats.totalTurns}</div>
            <div style={{ color: '#9b98cf' }}>📦 Capturas:</div><div style={{ color: '#22d3ee', fontWeight: 'bold' }}>{runStats.captures}</div>
            <div style={{ color: '#9b98cf' }}>💰 Dinero ganado:</div><div style={{ color: '#ffcb05', fontWeight: 'bold' }}>${runStats.moneyEarned}</div>
            <div style={{ color: '#9b98cf' }}>💸 Dinero gastado:</div><div style={{ color: '#ff8a80', fontWeight: 'bold' }}>${runStats.moneySpent}</div>
            <div style={{ color: '#9b98cf' }}>🪙 PokéCoins ganadas:</div><div style={{ color: '#ffcb05', fontWeight: 'bold' }}>+{(() => { const b = difficulty === 'easy' ? 10 : difficulty === 'hard' ? 20 : 15; const c = Object.entries(runChallenges).some(([k, v]) => v && k !== 'allShiny') ? 15 : 0; return b + c + (team.length <= 1 ? 5 : 0) })()}</div>
            {winStreak >= 2 && <><div style={{ color: '#9b98cf' }}>🔥 Racha:</div><div style={{ color: '#ff8a33', fontWeight: 'bold' }}>{winStreak} seguidas</div></>}
          </div>
        </div>
      )}

      {/* Run Stats on Defeat */}
      {screen === 'defeat' && (
        <div className="panel" style={{ maxWidth: '400px', margin: '0 auto', padding: '1rem' }}>
          <h3 style={{ color: '#ee3b2f', textAlign: 'center', marginBottom: '0.75rem' }}>📊 Estadísticas de la Run</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '1.1rem' }}>
            <div style={{ color: '#9b98cf' }}>⚔️ Batallas ganadas:</div><div style={{ color: '#37d16b', fontWeight: 'bold' }}>{runStats.battlesWon}</div>
            <div style={{ color: '#9b98cf' }}>💥 Daño total infligido:</div><div style={{ color: '#ff8a80', fontWeight: 'bold' }}>{runStats.totalDamageDealt}</div>
            <div style={{ color: '#9b98cf' }}>🛡️ Daño total recibido:</div><div style={{ color: '#fb923c', fontWeight: 'bold' }}>{runStats.totalDamageTaken}</div>
            <div style={{ color: '#9b98cf' }}>🔄 Turnos jugados:</div><div style={{ color: '#d9d6f2', fontWeight: 'bold' }}>{runStats.totalTurns}</div>
            <div style={{ color: '#9b98cf' }}>📦 Capturas:</div><div style={{ color: '#22d3ee', fontWeight: 'bold' }}>{runStats.captures}</div>
            <div style={{ color: '#9b98cf' }}>🪙 PokéCoins ganadas:</div><div style={{ color: '#ffcb05', fontWeight: 'bold' }}>+5</div>
          </div>
        </div>
      )}

      {/* End Run Modal (modo Infinite) */}
      {showEndRunModal && (
        <div className="modal-backdrop" onClick={() => setShowEndRunModal(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏁</div>
            <h3 style={{ color: '#ffcb05', margin: '0.5rem 0' }}>¿Terminar la aventura?</h3>
            <p style={{ color: '#d9d6f2', marginBottom: '1.25rem' }}>
              Se registrará tu progreso en el ranking mundial (Nodo #{routeIndex + 1}).
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="cta" type="button" onClick={() => { playClick(); setShowEndRunModal(false) }} style={{ background: '#7d7ab5', marginTop: 0 }}>
                No, seguir
              </button>
              <button className="cta" type="button" onClick={handleEndRunConfirm} style={{ marginTop: 0 }}>
                Sí, terminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="modal-backdrop" onClick={() => setShowLeaderboard(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <h2 style={{ color: '#cba3ff', textAlign: 'center', margin: '0 0 0.5rem' }}>🌍 Ranking Mundial — ♾️ Infinite</h2>
            <p style={{ textAlign: 'center', color: '#9b98cf', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Los entrenadores se ordenan por el nodo más lejano alcanzado. Si empatan, gana el que tardó menos.
            </p>

            {isLeaderboardEnabled() && (
              authUser ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '0.6rem 0.9rem', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <span style={{ color: '#d9d6f2', fontWeight: 'bold', fontSize: '0.9rem' }}>👤 {getUsername(authUser) || authUser.email}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {pendingScoreRef.current && (
                      <button className="cta" type="button" onClick={() => void submitPendingScore()} style={{ fontSize: '0.75rem', padding: '4px 12px', marginTop: 0 }}>
                        📤 Registrar puntuación (Nodo #{pendingScoreRef.current.node})
                      </button>
                    )}
                    <button className="tiny-btn" type="button" onClick={handleLogout}>Cerrar sesión</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '1.25rem', padding: '1rem', borderRadius: '8px', background: 'rgba(15,23,42,0.5)', border: '1px solid #3f3f6e' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.9rem' }}>
                    {(['signin', 'signup'] as const).map((mode) => (
                      <button
                        key={mode}
                        className="tiny-btn"
                        type="button"
                        onClick={() => { playClick(); setAuthMode(mode); setAuthMessage(null) }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          background: authMode === mode ? 'rgba(168,85,247,0.25)' : 'transparent',
                          borderColor: authMode === mode ? '#a855f7' : '#3f3f6e',
                          color: authMode === mode ? '#cba3ff' : '#9b98cf'
                        }}
                      >
                        {mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {authMode === 'signup' && (
                      <input
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        maxLength={20}
                        placeholder="Nombre de usuario (aparece en el ranking)"
                        style={authInputStyle}
                      />
                    )}
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="Email"
                      style={authInputStyle}
                    />
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Contraseña (mín. 6 caracteres)"
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleAuthSubmit() }}
                      style={authInputStyle}
                    />
                    <button className="cta" type="button" onClick={() => void handleAuthSubmit()} disabled={authLoading} style={{ marginTop: '0.25rem' }}>
                      {authLoading ? '...' : authMode === 'signup' ? 'Crear cuenta y entrar' : 'Iniciar sesión'}
                    </button>
                    {authMessage && (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: authMessage.type === 'error' ? '#ff8a80' : authMessage.type === 'info' ? '#9b98cf' : '#37d16b' }}>
                        {authMessage.text}
                      </p>
                    )}
                  </div>
                </div>
              )
            )}

            {!isLeaderboardEnabled() ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px dashed #3f3f6e' }}>
                <p style={{ color: '#9b98cf', fontSize: '0.9rem', marginBottom: '0.5rem' }}>⚙️ El ranking aún no está configurado.</p>
                <p style={{ color: '#7d7ab5', fontSize: '0.8rem', margin: 0 }}>
                  Copia <strong style={{ color: '#cba3ff' }}>.env.example</strong> a <strong style={{ color: '#cba3ff' }}>.env</strong>, rellena tus credenciales de Supabase (URL + anon key) y ejecuta el esquema de <strong style={{ color: '#cba3ff' }}>supabase/schema.sql</strong>.
                </p>
              </div>
            ) : leaderboardLoading && !leaderboardEntries ? (
              <p style={{ textAlign: 'center', color: '#9b98cf' }}>Cargando ranking...</p>
            ) : !leaderboardEntries || leaderboardEntries.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9b98cf' }}>Aún no hay puntuaciones. ¡Sé el primero en llegar lejos en modo Infinite!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {leaderboardEntries.map((entry, idx) => {
                  const isMe = authUser !== null && entry.user_id === authUser.id
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`
                  return (
                    <div
                      key={entry.id ?? idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '44px 1fr auto',
                        gap: '0.75rem',
                        alignItems: 'center',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        background: isMe ? 'rgba(168,85,247,0.15)' : 'rgba(15,23,42,0.5)',
                        border: `1px solid ${isMe ? '#a855f7' : '#3f3f6e'}`
                      }}
                    >
                      <div style={{ textAlign: 'center', fontWeight: 'bold', color: idx < 3 ? '#ffcb05' : '#9b98cf' }}>{medal}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <strong style={{ color: '#f3f1ff', fontSize: '0.9rem' }}>{entry.player_name}</strong>
                          {isMe && <span style={{ color: '#cba3ff', fontSize: '0.7rem' }}>(tú)</span>}
                          <span style={{ color: '#7d7ab5', fontSize: '0.75rem' }}>
                            {entry.is_random ? `🎲 Random · Gen ${entry.generation}` : `Gen ${entry.generation}`}
                          </span>
                          {entry.challenges && entry.challenges.length > 0 && (
                            <span style={{ color: '#fb923c', fontSize: '0.7rem' }}>🎲 {entry.challenges.join(', ')}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '2px', marginTop: '4px', alignItems: 'flex-end' }}>
                          {(entry.team ?? []).map((member, mi) => (
                            <img
                              key={`${entry.id}-${mi}`}
                              src={member.sprite}
                              alt={member.name}
                              title={`${member.name} Nv.${member.level}`}
                              onError={fallbackSprite}
                              style={{ width: '28px', height: '28px', imageRendering: 'pixelated' }}
                            />
                          ))}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#cba3ff', fontWeight: 'bold', fontSize: '1.05rem' }}>Nodo #{entry.node}</div>
                        <div style={{ color: '#9b98cf', fontSize: '0.75rem' }}>⏱️ {formatDuration(entry.duration_seconds)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button className="cta" onClick={() => setShowLeaderboard(false)} style={{ marginTop: '1.25rem', background: '#7d7ab5', width: '100%' }}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Meta Shop Modal */}
      {showMetaShop && (
        <div className="modal-backdrop" onClick={() => setShowMetaShop(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <h2 style={{ color: '#ffcb05', textAlign: 'center', marginBottom: '0.5rem' }}>🪙 PokéShop</h2>
            <p style={{ textAlign: 'center', color: '#9b98cf', marginBottom: '1rem' }}>Tus PokéCoins: <strong style={{ color: '#ffcb05' }}>{metaProgression.pokeCoins}</strong></p>

            <h3 style={{ color: '#4d9bff', marginBottom: '0.5rem' }}>🎨 Temas Visuales</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {THEMES.map(theme => {
                const owned = metaProgression.ownedThemes.includes(theme.id)
                const active = metaProgression.activeTheme === theme.id
                return (
                  <div key={theme.id} style={{ background: theme.colors.bg, border: `2px solid ${active ? '#ffcb05' : theme.colors.border}`, borderRadius: '6px', padding: '0.75rem', cursor: owned ? 'pointer' : 'default', opacity: owned ? 1 : 0.7 }}
                    onClick={() => owned ? setTheme(theme.id) : undefined}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '0.5rem' }}>
                      {[theme.colors.bg, theme.colors.surface, theme.colors.accent, theme.colors.text].map((c, i) => (
                        <div key={i} style={{ width: '16px', height: '16px', borderRadius: '4px', background: c, border: '1px solid rgba(255,255,255,0.2)' }} />
                      ))}
                    </div>
                    <div style={{ color: theme.colors.text, fontWeight: 'bold', fontSize: '0.85rem' }}>{theme.name}</div>
                    <div style={{ color: theme.colors.muted, fontSize: '0.75rem' }}>{theme.desc}</div>
                    {owned ? (
                      active ? <div style={{ color: '#ffcb05', fontSize: '0.75rem', marginTop: '4px' }}>✅ Activo</div> : <div style={{ color: theme.colors.muted, fontSize: '0.75rem', marginTop: '4px' }}>Tocado para activar</div>
                    ) : (
                      <button className="cta" onClick={(e) => { e.stopPropagation(); buyMetaItem({ ...theme, id: theme.id, category: 'theme' as const, spriteKey: theme.id }) }}
                        disabled={metaProgression.pokeCoins < theme.price}
                        style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '4px 12px', background: metaProgression.pokeCoins >= theme.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {theme.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 style={{ color: '#ff8a33', marginBottom: '0.5rem' }}>🧪 Items Curativos</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Al comprar un item, empezará a aparecer en tiendas y drops durante las partidas.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'consumable').map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>📦</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#ff8a33', fontSize: '0.7rem' }}>Consumible</div>
                      </div>
                    </div>
                    <div style={{ color: '#7d7ab5', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{item.desc}</div>
                    {owned ? (
                      <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>✅ Desbloqueado</div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 style={{ color: '#ee3b2f', marginBottom: '0.5rem' }}>🏐 Poké Balls</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Desbloquea distintos tipos de Poké Balls para usar en la captura de Pokémon salvajes.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'pokeball').map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>🏐</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#ee3b2f', fontSize: '0.7rem' }}>Poké Ball</div>
                      </div>
                    </div>
                    <div style={{ color: '#7d7ab5', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{item.desc}</div>
                    {owned ? (
                      <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>✅ Desbloqueado</div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 style={{ color: '#a855f7', marginBottom: '0.5rem' }}>💎 Piedras Evolutivas</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Desbloquea piedras evolutivas para evolucionar ciertos Pokémon. Aparecen en tiendas y Spin.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'evolution_stone').map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>💎</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#a855f7', fontSize: '0.7rem' }}>Piedra Evolutiva</div>
                      </div>
                    </div>
                    <div style={{ color: '#7d7ab5', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{item.desc}</div>
                    {owned ? (
                      <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>✅ Desbloqueado</div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 style={{ color: '#ff8a33', marginBottom: '0.5rem' }}>🔧 Objetos Evolutivos</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Objetos para evolucionar Pokémon por intercambio. Aparecen con el Comerciante Misterioso.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'evolution_item').map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>🔧</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#ff8a33', fontSize: '0.7rem' }}>Objeto Evolutivo</div>
                      </div>
                    </div>
                    <div style={{ color: '#7d7ab5', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{item.desc}</div>
                    {owned ? (
                      <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>✅ Desbloqueado</div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 style={{ color: '#22d3ee', marginBottom: '0.5rem' }}>⚙️ Mejoras</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Desbloquea nodos especiales en las rutas Hard/Infinite.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'upgrade').map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>⚙️</span>
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#22d3ee', fontSize: '0.7rem' }}>Mejora</div>
                      </div>
                    </div>
                    <div style={{ color: '#7d7ab5', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{item.desc}</div>
                    {owned ? (
                      <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>✅ Desbloqueado</div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 style={{ color: '#ff9ad6', marginBottom: '0.5rem' }}>🎵 Música</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Nuevas pistas musicales para el menú y los combates.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'music').map(item => {
                const owned = metaProgression.ownedMusic.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>🎵</span>
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#ff9ad6', fontSize: '0.7rem' }}>Música</div>
                      </div>
                    </div>
                    <div style={{ color: '#7d7ab5', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{item.desc}</div>
                    {owned ? (
                      <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>✅ Desbloqueado</div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <h3 style={{ color: '#a855f7', marginBottom: '0.5rem' }}>⚔️ Objetos Pasivos</h3>
            <p style={{ color: '#7d7ab5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Se equipan a un Pokémon y otorgan efectos permanentes durante la batalla.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {META_SHOP_ITEMS.filter(item => item.category === 'holdable').map(item => {
                const owned = metaProgression.permanentlyUnlockedItems.includes(item.id)
                return (
                  <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${owned ? '#37d16b' : '#3f3f6e'}`, borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {ITEM_SPRITES[item.spriteKey]
                        ? <img src={ITEM_SPRITES[item.spriteKey]} alt={item.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
                        : <span style={{ fontSize: '1.5rem' }}>📦</span>
                      }
                      <div>
                        <div style={{ color: '#f3f1ff', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: '#a855f7', fontSize: '0.7rem' }}>Objeto Pasivo</div>
                      </div>
                    </div>
                    <div style={{ color: '#7d7ab5', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{item.desc}</div>
                    {owned ? (
                      <div style={{ color: '#37d16b', fontSize: '0.8rem', fontWeight: 'bold' }}>✅ Desbloqueado</div>
                    ) : (
                      <button className="cta" onClick={() => buyMetaItem(item)}
                        disabled={metaProgression.pokeCoins < item.price}
                        style={{ fontSize: '0.8rem', padding: '6px 16px', background: metaProgression.pokeCoins >= item.price ? '#ffcb05' : '#475569', color: '#000' }}>
                        🪙 {item.price}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button className="cta" onClick={() => setShowMetaShop(false)}>Cerrar Tienda</button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Animation Popup */}
      {unlockPopup && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#1c1c3a', border: '3px solid #ffcb05', borderRadius: '8px', padding: '2rem 3rem', textAlign: 'center', boxShadow: '5px 5px 0 0 rgba(0,0,0,0.6)', animation: 'slideInRight 0.5s ease' }}>
          <div style={{ marginBottom: '0.5rem', animation: 'pulseGlow 1s infinite' }}>
            {ITEM_SPRITES[unlockPopup.spriteKey]
              ? <img src={ITEM_SPRITES[unlockPopup.spriteKey]} alt={unlockPopup.name} style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }} onError={fallbackSprite} />
              : <span style={{ fontSize: '4rem' }}>📦</span>
            }
          </div>
          <div style={{ color: '#ffcb05', fontWeight: 'bold', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.25rem' }}>¡Item Desbloqueado!</div>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.4rem', marginBottom: '0.5rem' }}>{unlockPopup.name}</div>
          <div style={{ color: '#9b98cf', fontSize: '0.9rem' }}>Ahora puede aparecer en las aventuras</div>
        </div>
      )}

    </main>
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
          <h2>Algo salió mal.</h2>
          <button className="cta" onClick={() => window.location.reload()}>
            Recargar aplicación
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  )
}