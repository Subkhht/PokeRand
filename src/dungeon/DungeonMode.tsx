import { useEffect, useRef, useState } from 'react'
import {
  playAchievement,
  playClick,
  playCoin,
  playError,
  playHover,
  playPurchase,
  playRecruitUnlock,
  setBattleMusicTrack,
  startBattleMusic,
  startMenuMusic,
} from '../game/sound'
import type { Language } from '../game/i18n'
import {
  ACTIVE_ITEMS,
  DUNGEONS,
  DUNGEON_BY_ID,
  HELD_ITEM_BY_ID,
  HELD_ITEMS,
  MAX_PASSIVE_SLOTS,
  PASSIVE_BY_ID,
  PASSIVE_ITEMS,
  RECRUIT_DESCRIPTIONS,
  STARTER_BY_ID,
  UPGRADES,
  computeBonuses,
  createDailyMission,
  guildRank,
  isDungeonUnlocked,
  nextDungeonId,
  upgradeCost,
} from './data'
import { DungeonRunView } from './DungeonRun'
import { DungeonPortrait as Portrait } from './DungeonPortrait'
import { buildDungeonResult, prepareDungeonRun } from './runEngine'
import { applyDungeonResult, loadDungeonSave, persistDungeonSave, resetDungeonSave } from './storage'
import type { DungeonId, DungeonResult, DungeonRun, DungeonSave, DungeonView } from './types'
import './dungeon.css'

interface DungeonModeProps {
  language: Language
  onExit: () => void
}

function pct(n: number): string {
  return `${n > 0 ? '+' : ''}${n}%`
}

const TEAM_TYPE_ORDER = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
]

const TEAM_TYPE_INFO: Record<string, { es: string; en: string; color: string }> = {
  normal: { es: 'Normal', en: 'Normal', color: '#a8a878' },
  fire: { es: 'Fuego', en: 'Fire', color: '#f08030' },
  water: { es: 'Agua', en: 'Water', color: '#6890f0' },
  electric: { es: 'Eléctrico', en: 'Electric', color: '#f8d030' },
  grass: { es: 'Planta', en: 'Grass', color: '#78c850' },
  ice: { es: 'Hielo', en: 'Ice', color: '#98d8d8' },
  fighting: { es: 'Lucha', en: 'Fighting', color: '#c03028' },
  poison: { es: 'Veneno', en: 'Poison', color: '#a040a0' },
  ground: { es: 'Tierra', en: 'Ground', color: '#e0c068' },
  flying: { es: 'Volador', en: 'Flying', color: '#a890f0' },
  psychic: { es: 'Psíquico', en: 'Psychic', color: '#f85888' },
  bug: { es: 'Bicho', en: 'Bug', color: '#a8b820' },
  rock: { es: 'Roca', en: 'Rock', color: '#b8a038' },
  ghost: { es: 'Fantasma', en: 'Ghost', color: '#705898' },
  dragon: { es: 'Dragón', en: 'Dragon', color: '#7038f8' },
  dark: { es: 'Siniestro', en: 'Dark', color: '#705848' },
  steel: { es: 'Acero', en: 'Steel', color: '#b8b8d0' },
  fairy: { es: 'Hada', en: 'Fairy', color: '#ee99ac' },
}

const GENERATION_INFO = [
  { id: 1, region: 'Kanto', min: 1, max: 151 },
  { id: 2, region: 'Johto', min: 152, max: 251 },
  { id: 3, region: 'Hoenn', min: 252, max: 386 },
  { id: 4, region: 'Sinnoh', min: 387, max: 493 },
  { id: 5, region: 'Unova', min: 494, max: 649 },
  { id: 6, region: 'Kalos', min: 650, max: 721 },
  { id: 7, region: 'Alola', min: 722, max: 809 },
  { id: 8, region: 'Galar', min: 810, max: 905 },
  { id: 9, region: 'Paldea', min: 906, max: 1025 },
]

function generationForId(id: number): number {
  return GENERATION_INFO.find((generation) => id >= generation.min && id <= generation.max)?.id ?? 0
}

const UNLOCK_STAR_POSITIONS = [
  { left: 10, top: 12 },
  { left: 30, top: 4 },
  { left: 70, top: 4 },
  { left: 90, top: 12 },
  { left: 96, top: 46 },
  { left: 84, top: 82 },
  { left: 50, top: 94 },
  { left: 16, top: 82 },
  { left: 4, top: 46 },
]

interface UnlockCelebration {
  id: number
  name: string
  types: string[]
}

export function DungeonMode({ language, onExit }: DungeonModeProps) {
  const en = language === 'en'
  const tx = (es: string, textEn: string) => (en ? textEn : es)

  const [save, setSave] = useState<DungeonSave>(() => loadDungeonSave())
  const [view, setView] = useState<DungeonView>('menu')
  const [run, setRun] = useState<DungeonRun | null>(null)
  const [result, setResult] = useState<DungeonResult | null>(null)
  const [selectedDungeon, setSelectedDungeon] = useState<DungeonId>('forest')
  const [lastDungeon, setLastDungeon] = useState<DungeonId>('forest')
  const [shopTab, setShopTab] = useState<'active' | 'passive' | 'held' | 'upgrade'>('active')
  const [teamFilter, setTeamFilter] = useState<'all' | 'team' | 'recruited'>('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [generationFilter, setGenerationFilter] = useState<'all' | number>('all')
  const [unlockQueue, setUnlockQueue] = useState<UnlockCelebration[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReset, setShowReset] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const resultHandled = useRef(false)
  const pendingRecruits = useRef<Map<number, number>>(new Map())
  const announcedRecruits = useRef<Set<number>>(new Set())

  const bonuses = computeBonuses(save)
  const rank = guildRank(save.stats.missions ?? 0)
  const daily = save.dailyMission ?? createDailyMission()
  const ownedHeldItems = save.ownedHeldItems ?? []
  const equippedHeldItems = save.equippedHeldItems ?? {}
  const dailyTitle = daily.kind === 'defeatEnemies'
    ? tx(`Derrota ${daily.target} enemigos`, `Defeat ${daily.target} enemies`)
    : daily.kind === 'recruit'
      ? tx(`Recluta ${daily.target} Pokémon`, `Recruit ${daily.target} Pokémon`)
      : daily.kind === 'collectCrystals'
        ? tx(`Consigue ${daily.target} cristales`, `Collect ${daily.target} crystals`)
        : daily.kind === 'reachFloor'
          ? tx(`Alcanza el piso ${daily.target}`, `Reach floor ${daily.target}`)
          : tx('Completa una expedición', 'Complete an expedition')
  const celebration = unlockQueue[0] ?? null

  useEffect(() => {
    if (!celebration) return
    const timer = window.setTimeout(() => setUnlockQueue((queue) => queue.slice(1)), 3600)
    return () => window.clearTimeout(timer)
  }, [celebration])

  useEffect(() => {
    persistDungeonSave(save)
  }, [save])

  // Si un recluta ya estaba en el equipo (por ejemplo, guardado de una versión
  // anterior), se marca como presentado para que no vuelva a mostrar la etiqueta.
  useEffect(() => {
    const missing = save.selectedTeam.filter((id) => !STARTER_BY_ID[id] && !save.settledRecruits.includes(id))
    if (missing.length === 0) return
    setSave((previous) => {
      const add = previous.selectedTeam.filter((id) => !STARTER_BY_ID[id] && !previous.settledRecruits.includes(id))
      if (add.length === 0) return previous
      return { ...previous, settledRecruits: [...previous.settledRecruits, ...add] }
    })
  }, [save.selectedTeam, save.settledRecruits])

  // Un Pokémon reclutado no se desbloquea hasta superar el piso donde se unió.
  useEffect(() => {
    if (!run) return
    const members = [...run.party, ...run.fallen]

    // Los que ya estaban desbloqueados no necesitan seguimiento pendiente.
    for (const id of save.unlockedStarters) pendingRecruits.current.delete(id)

    // Registra a los nuevos reclutas junto al piso en el que aparecieron.
    const unlockedSet = new Set(save.unlockedStarters)
    for (const member of members) {
      const id = member.p.id
      if (!unlockedSet.has(id) && !pendingRecruits.current.has(id)) {
        pendingRecruits.current.set(id, run.floor)
      }
    }

    const ready = [...pendingRecruits.current.entries()]
      .filter(([, floor]) => run.status === 'won' || run.floor > floor)
      .map(([id]) => id)

    const freshUnlocks: UnlockCelebration[] = []
    for (const id of ready) {
      if (save.unlockedStarters.includes(id) || announcedRecruits.current.has(id)) continue
      const member = members.find((entry) => entry.p.id === id)
      if (!member) continue
      freshUnlocks.push({
        id,
        name: member.p.name,
        types: member.p.types?.length ? member.p.types : ['normal'],
      })
      announcedRecruits.current.add(id)
    }
    if (freshUnlocks.length > 0) {
      playRecruitUnlock()
      setUnlockQueue((queue) => {
        const queued = new Set(queue.map((entry) => entry.id))
        return [...queue, ...freshUnlocks.filter((entry) => !queued.has(entry.id))]
      })
    }

    setSave((previous) => {
      const unlocked = [...previous.unlockedStarters]
      const meta = { ...previous.pokemonMeta }
      let changed = false

      for (const member of members) {
        const id = member.p.id
        const types = member.p.types?.length ? member.p.types : ['normal']
        const current = meta[id]
        if (!current || current.name !== member.p.name || current.types.join('|') !== types.join('|')) {
          meta[id] = { name: member.p.name, types }
          changed = true
        }
      }

      for (const id of ready) {
        if (!unlocked.includes(id)) {
          unlocked.push(id)
          changed = true
        }
      }

      return changed ? { ...previous, unlockedStarters: unlocked, pokemonMeta: meta } : previous
    })
  }, [run, save.unlockedStarters])

  useEffect(() => {
    if (!run) return
    if (run.status === 'playing') {
      resultHandled.current = false
      return
    }
    if (resultHandled.current) return
    resultHandled.current = true
    const outcome = buildDungeonResult(run, save)
    setSave((previous) => applyDungeonResult(previous, outcome))
    setResult(outcome)
    setView('result')
    setRun(null)
    pendingRecruits.current.clear()
    startMenuMusic()
    if (outcome.status === 'won') playAchievement()
    else if (outcome.status === 'lost') playError()
    else playCoin()
  }, [run, save])

  const go = (next: DungeonView) => {
    playClick()
    setError(null)
    setView(next)
  }

  const startExpedition = async (dungeonId: DungeonId) => {
    playClick()
    if (!isDungeonUnlocked(save, dungeonId)) {
      setError(tx('Esa mazmorra todavía está bloqueada.', 'That dungeon is still locked.'))
      playError()
      return
    }
    setSelectedDungeon(dungeonId)
    setLastDungeon(dungeonId)
    setLoading(true)
    pendingRecruits.current.clear()
    setError(null)
    try {
      const prepared = await prepareDungeonRun({ save, dungeonId, lang: language })
      resultHandled.current = false
      setRun(prepared)
      setResult(null)
      setView('run')
      setBattleMusicTrack(dungeonId === 'forest' || dungeonId === 'desert' ? 'default' : 'epic')
      startBattleMusic()
    } catch {
      setError(tx('No se pudo preparar la expedición. Revisa tu conexión e inténtalo de nuevo.', 'Could not prepare the expedition. Check your connection and try again.'))
      playError()
    } finally {
      setLoading(false)
    }
  }

  const exitMode = () => {
    playClick()
    startMenuMusic()
    onExit()
  }

  const toggleStarter = (id: number) => {
    playClick()
    setSave((previous) => {
      const isSelected = previous.selectedTeam.includes(id)
      if (isSelected) {
        if (previous.selectedTeam.length <= 1) {
          setError(tx('Necesitas al menos un Pokémon en el equipo.', 'You need at least one Pokémon on the team.'))
          return previous
        }
        setError(null)
        return { ...previous, selectedTeam: previous.selectedTeam.filter((entry) => entry !== id) }
      }
      if (previous.selectedTeam.length >= 4) {
        setError(tx('El equipo de expedición admite 4 Pokémon como máximo.', 'The expedition team holds up to 4 Pokémon.'))
        playError()
        return previous
      }
      setError(null)
      const settleFirstSelection = !STARTER_BY_ID[id] && !previous.settledRecruits.includes(id)
      return {
        ...previous,
        selectedTeam: [...previous.selectedTeam, id],
        settledRecruits: settleFirstSelection ? [...previous.settledRecruits, id] : previous.settledRecruits,
      }
    })
  }

  const buyActive = (id: string) => {
    playClick()
    const item = ACTIVE_ITEMS.find((entry) => entry.id === id)
    if (!item) return
    if (save.ownedActives.includes(id)) return
    if (save.crystals < item.price) {
      setError(tx('No tienes suficientes Cristales de Gremio.', 'You do not have enough Guild Crystals.'))
      playError()
      return
    }
    setError(null)
    setSave((previous) => ({
      ...previous,
      crystals: previous.crystals - item.price,
      ownedActives: [...previous.ownedActives, id],
    }))
    playPurchase()
  }

  const buyPassive = (id: string) => {
    playClick()
    const item = PASSIVE_BY_ID[id]
    if (!item) return
    if (save.ownedPassives.includes(id)) return
    if (save.crystals < item.price) {
      setError(tx('No tienes suficientes Cristales de Gremio.', 'You do not have enough Guild Crystals.'))
      playError()
      return
    }
    setError(null)
    setSave((previous) => ({
      ...previous,
      crystals: previous.crystals - item.price,
      ownedPassives: [...previous.ownedPassives, id],
    }))
    playPurchase()
  }

  const togglePassive = (id: string) => {
    playClick()
    if (!save.ownedPassives.includes(id)) return
    setSave((previous) => {
      if (previous.equippedPassives.includes(id)) {
        setError(null)
        return { ...previous, equippedPassives: previous.equippedPassives.filter((entry) => entry !== id) }
      }
      if (previous.equippedPassives.length >= MAX_PASSIVE_SLOTS) {
        setError(tx(`Solo puedes equipar ${MAX_PASSIVE_SLOTS} ventajas pasivas.`, `You can only equip ${MAX_PASSIVE_SLOTS} passive perks.`))
        playError()
        return previous
      }
      setError(null)
      return { ...previous, equippedPassives: [...previous.equippedPassives, id] }
    })
  }

  const buyHeldItem = (id: string) => {
    playClick()
    const item = HELD_ITEM_BY_ID[id]
    if (!item) return
    if ((save.ownedHeldItems ?? []).includes(id)) return
    if (save.crystals < item.price) {
      setError(tx('No tienes suficientes Cristales de Gremio.', 'You do not have enough Guild Crystals.'))
      playError()
      return
    }
    setError(null)
    setSave((previous) => ({
      ...previous,
      crystals: previous.crystals - item.price,
      ownedHeldItems: [...(previous.ownedHeldItems ?? []), id],
    }))
    playPurchase()
  }

  const equipHeldItem = (pokemonId: number, itemId: string) => {
    playClick()
    setSave((previous) => {
      if (itemId && !(previous.ownedHeldItems ?? []).includes(itemId)) return previous
      const equipped = { ...(previous.equippedHeldItems ?? {}) }
      if (!itemId) {
        delete equipped[pokemonId]
      } else {
        for (const key of Object.keys(equipped)) {
          if (equipped[Number(key)] === itemId) delete equipped[Number(key)]
        }
        equipped[pokemonId] = itemId
      }
      return { ...previous, equippedHeldItems: equipped }
    })
  }

  const buyUpgrade = (id: string) => {
    playClick()
    const definition = UPGRADES.find((entry) => entry.id === id)
    if (!definition) return
    const level = save.upgrades[id] ?? 0
    const cost = upgradeCost(definition, level)
    if (cost === null) return
    if (save.crystals < cost) {
      setError(tx('No tienes suficientes Cristales de Gremio.', 'You do not have enough Guild Crystals.'))
      playError()
      return
    }
    setError(null)
    setSave((previous) => ({
      ...previous,
      crystals: previous.crystals - cost,
      upgrades: { ...previous.upgrades, [id]: (previous.upgrades[id] ?? 0) + 1 },
    }))
    playPurchase()
  }

  const handleReset = () => {
    playClick()
    setSave(resetDungeonSave())
    setShowReset(false)
    setResult(null)
    setRun(null)
    pendingRecruits.current.clear()
    announcedRecruits.current.clear()
    setUnlockQueue([])
    setView('menu')
    setError(null)
  }

  const dismissCelebration = () => {
    playClick()
    setUnlockQueue((queue) => queue.slice(1))
  }

  const typeLabel = (type: string) => TEAM_TYPE_INFO[type]?.[en ? 'en' : 'es'] ?? type
  const typeColor = (type: string) => TEAM_TYPE_INFO[type]?.color ?? '#8fdc7a'
  const fallbackDescription = (types: string[], english: boolean) => {
    const typeText = types.map((type) => typeLabel(type)).join(english ? ' / ' : ' y ')
    return english
      ? `A ${typeText}-type companion.`
      : `Un compañero de tipo ${typeText}.`
  }
  const teamRoster = [...save.unlockedStarters].sort((a, b) => a - b).map((id) => {
    const starter = STARTER_BY_ID[id]
    const meta = save.pokemonMeta?.[id]
    const types = starter?.types?.length ? starter.types : meta?.types?.length ? meta.types : ['normal']
    const name = starter ? (en ? starter.nameEn : starter.name) : (meta?.name ?? `Pokémon ${id}`)
    const settled = save.settledRecruits.includes(id) || save.selectedTeam.includes(id)
    const shortDescription = RECRUIT_DESCRIPTIONS[id]
    const desc = starter
      ? (en ? starter.descEn : starter.desc)
      : shortDescription
        ? (en ? shortDescription.en : shortDescription.es)
        : fallbackDescription(types, en)
    const color = starter?.color ?? typeColor(types[0])
    return { id, name, desc, types, color, recruited: !starter, showRecruitBadge: !starter && !settled, generation: generationForId(id) }
  })
  const teamRosterById = new Map(teamRoster.map((member) => [member.id, member]))
  const filteredTeamRoster = teamRoster.filter((member) => {
    if (teamFilter === 'team' && !save.selectedTeam.includes(member.id)) return false
    if (teamFilter === 'recruited' && !member.recruited) return false
    if (typeFilter !== 'all' && !member.types.includes(typeFilter)) return false
    if (generationFilter !== 'all' && member.generation !== generationFilter) return false
    return true
  })

  const inRun = view === 'run' && run !== null

  return (
    <div className="dungeon-app">
      <div className="dungeon-aurora" aria-hidden="true" />
      {!inRun && (
        <header className="dungeon-header">
          <div className="dungeon-logo">
            <span className="dungeon-logo-mark" aria-hidden="true">
              <span className="dungeon-logo-glint" />
            </span>
            <span className="dungeon-logo-leds" aria-hidden="true">
              <i className="is-red" />
              <i className="is-yellow" />
              <i className="is-green" />
            </span>
            <div>
              <strong>{tx('MAZMORRA MISTERIOSA', 'MYSTERY DUNGEON')}</strong>
              <span>{tx('Pokédex del Gremio · PokeRand', 'Guild Pokédex · PokeRand')}</span>
            </div>
          </div>
          <div className="dungeon-header-right">
            <span className="dungeon-crystal-pill" title={tx('Cristales de Gremio', 'Guild Crystals')}>💠 {save.crystals}</span>
            <button type="button" className="dungeon-ghost-btn" onClick={() => { playClick(); setShowHelp(true) }} onMouseEnter={playHover}>
              📖 {tx('Cómo se juega', 'How to play')}
            </button>
            <button type="button" className="dungeon-ghost-btn" onClick={exitMode} onMouseEnter={playHover}>
              ← {tx('Modo clásico', 'Classic mode')}
            </button>
          </div>
        </header>
      )}

      {error && !inRun && (
        <div className="dungeon-toast" role="alert">{error}</div>
      )}

      {view === 'run' && run && (
        <DungeonRunView run={run} onChange={setRun} />
      )}

      {view === 'menu' && (
        <main className="dungeon-main">
          <section className="dungeon-hero">
            <div className="dungeon-hero-copy">
              <span className="dungeon-eyebrow">{tx('UNA NUEVA EXPEDICIÓN TE ESPERA', 'A NEW EXPEDITION AWAITS')}</span>
              <h1>{tx('Desciende. Recluta. Sobrevive.', 'Descend. Recruit. Survive.')}</h1>
              <p>
                {tx(
                  'La Mazmorra Misteriosa es un modo por turnos y por pasos: explora pisos generados, recluta Pokémon salvajes y vuelve con Cristales de Gremio para desbloquear objetos y mejoras permanentes.',
                  'Mystery Dungeon is a turn-based, step-driven mode: explore generated floors, recruit wild Pokémon and return with Guild Crystals to unlock items and permanent upgrades.',
                )}
              </p>
              <div className="dungeon-hero-actions">
                <button type="button" className="dungeon-primary-btn dungeon-primary-btn--big" onClick={() => go('expedition')} onMouseEnter={playHover}>
                  🗺️ {tx('Nueva expedición', 'New expedition')}
                </button>
                <button type="button" className="dungeon-secondary-btn dungeon-team-shortcut" onClick={() => go('team')} onMouseEnter={playHover}>
                  🧭 {tx('Equipo de expedición', 'Expedition team')}
                </button>
                <button type="button" className="dungeon-secondary-btn" onClick={() => go('shop')} onMouseEnter={playHover}>
                  🛒 {tx('Tienda del Gremio', 'Guild Shop')}
                </button>
              </div>
              <div className="dungeon-hero-team">
                {save.selectedTeam.map((id) => (
                  <div key={id} className="dungeon-hero-mon">
                    <Portrait id={id} className="dungeon-hero-portrait" />
                    <span>{teamRosterById.get(id)?.name ?? `Pokémon ${id}`}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="dungeon-hero-art">
              <div className="dungeon-hero-ring" />
              <Portrait id={save.selectedTeam[0] ?? 4} className="dungeon-hero-bigportrait" />
            </div>
          </section>

          <section className="dungeon-overview">
            <div className="dungeon-panel">
              <h3>📊 {tx('Registro del Gremio', 'Guild Record')}</h3>
              <div className="dungeon-stat-grid">
                <div><span>{save.stats.runs}</span><small>{tx('Expediciones', 'Expeditions')}</small></div>
                <div><span>{save.stats.wins}</span><small>{tx('Victorias', 'Victories')}</small></div>
                <div><span>{save.stats.bestFloor}</span><small>{tx('Mejor piso', 'Best floor')}</small></div>
                <div><span>{save.stats.totalCrystals}</span><small>{tx('Cristales totales', 'Total crystals')}</small></div>
                <div><span>{save.stats.enemiesDefeated}</span><small>{tx('Derrotados', 'Defeated')}</small></div>
                <div><span>{save.stats.recruits}</span><small>{tx('Reclutados', 'Recruited')}</small></div>
              </div>
              <div className="dungeon-guild-rank">
                <span>🏅 {tx('Rango del Gremio', 'Guild Rank')}: <strong>{en ? rank.nameEn : rank.name}</strong></span>
                <span>
                  {rank.next === null
                    ? tx('Rango máximo alcanzado', 'Maximum rank reached')
                    : tx(`${save.stats.missions ?? 0} misiones · siguiente rango a las ${rank.next}`, `${save.stats.missions ?? 0} missions · next rank at ${rank.next}`)}
                </span>
              </div>
              <div className="dungeon-daily-mission">
                <strong>📅 {tx('Misión diaria', 'Daily mission')}</strong>
                <span>{dailyTitle}</span>
                <span>{Math.min(daily.progress ?? 0, daily.target ?? 0)}/{daily.target} · +{daily.reward} 💠</span>
                {daily.completed && <span className="dungeon-mission-done">✔ {tx('Completada', 'Completed')}</span>}
              </div>
            </div>
            <div className="dungeon-panel">
              <h3>💠 {tx('Ventajas permanentes', 'Permanent perks')}</h3>
              <div className="dungeon-perk-list">
                <span>{tx('PS extra', 'Bonus HP')}: <strong>+{bonuses.maxHp}</strong></span>
                <span>{tx('Ataque', 'Attack')}: <strong>+{bonuses.attack} ({pct(bonuses.attackPct)})</strong></span>
                <span>{tx('Defensa', 'Defense')}: <strong>+{bonuses.defense}</strong></span>
                <span>{tx('Bolsa', 'Bag')}: <strong>+{bonuses.bagSlots}</strong></span>
                <span>{tx('Reclutamiento', 'Recruiting')}: <strong>{pct(bonuses.recruitPct)}</strong></span>
                <span>{tx('Cristales', 'Crystals')}: <strong>{pct(bonuses.crystalPct)}</strong></span>
                {bonuses.healPerTurn > 0 && (
                  <span>{tx('Regeneración', 'Regeneration')}: <strong>+{bonuses.healPerTurn} PS/{tx('turno', 'turn')}</strong></span>
                )}
              </div>
              <button type="button" className="dungeon-secondary-btn" onClick={() => go('shop')} onMouseEnter={playHover}>
                {tx('Mejorar en la tienda', 'Upgrade at the shop')} →
              </button>
              <button type="button" className="dungeon-link-btn" onClick={() => { playClick(); setShowReset(true) }}>
                {tx('Borrar progreso de la mazmorra', 'Reset dungeon progress')}
              </button>
            </div>
          </section>

          <footer className="dungeon-credits">
            <span>🎨 {tx('Sprites de Pokémon Mystery Dungeon:', 'Pokémon Mystery Dungeon sprites:')} <a href="https://github.com/PMDCollab/SpriteCollab" target="_blank" rel="noopener noreferrer">PMD SpriteCollab</a></span>
            <span>🧩 {tx('Sprites de Pokémon y objetos:', 'Pokémon and item sprites:')} <a href="https://pokeapi.co/" target="_blank" rel="noopener noreferrer">PokéAPI</a></span>
            <span className="dungeon-credits-legal">{tx('Pokémon © Nintendo, Game Freak y Creatures Inc. Todos los sprites pertenecen a sus autores.', 'Pokémon © Nintendo, Game Freak and Creatures Inc. All sprites belong to their authors.')}</span>
          </footer>
        </main>
      )}

      {view === 'expedition' && (
        <main className="dungeon-main">
          <div className="dungeon-view-head">
            <button type="button" className="dungeon-ghost-btn" onClick={() => go('menu')} onMouseEnter={playHover}>← {tx('Volver', 'Back')}</button>
            <h2>🗺️ {tx('Elige tu mazmorra', 'Choose your dungeon')}</h2>
            <span className="dungeon-crystal-pill">💠 {save.crystals}</span>
          </div>
          <div className="dungeon-dungeon-grid">
            {DUNGEONS.map((dungeon, index) => {
              const unlocked = isDungeonUnlocked(save, dungeon.id)
              const cleared = save.clearedDungeons.includes(dungeon.id)
              const requirement = dungeon.unlockAfter ? DUNGEON_BY_ID[dungeon.unlockAfter] : null
              const record = (save.dungeonRecords ?? {})[dungeon.id]
              return (
                <article
                  key={dungeon.id}
                  className={`dungeon-dungeon-card ${!unlocked ? 'is-locked' : ''} ${cleared ? 'is-cleared' : ''} ${selectedDungeon === dungeon.id ? 'is-selected' : ''}`}
                  style={{ borderColor: unlocked ? dungeon.palette.accent : undefined }}
                  onClick={() => unlocked && setSelectedDungeon(dungeon.id)}
                >
                  <div className="dungeon-dungeon-head">
                    <span className="dungeon-dungeon-icon">{dungeon.icon}</span>
                    <div>
                      <span className="dungeon-dex-no">No. {String(index + 1).padStart(3, '0')}</span>
                      <h3>{en ? dungeon.nameEn : dungeon.name}</h3>
                      <span>{dungeon.id === 'endless' ? '∞' : dungeon.floors} {tx('pisos', 'floors')} · Nv. {dungeon.levelStart}-{dungeon.levelEnd}</span>
                    </div>
                    {cleared && <span className="dungeon-badge dungeon-badge--clear">✔ {tx('Completada', 'Cleared')}</span>}
                    {!unlocked && <span className="dungeon-badge dungeon-badge--lock">🔒</span>}
                  </div>
                  <p>{en ? dungeon.descEn : dungeon.desc}</p>
                  <div className="dungeon-dungeon-meta">
                    <span>💠 {tx('Recompensa', 'Reward')} {dungeon.reward}</span>
                    <span>👑 {tx('Jefe', 'Boss')} Nv.{dungeon.bossLevel}</span>
                    {record && record.runs > 0 && (
                      <span>🏆 {tx('Mejor piso', 'Best floor')} {record.bestFloor} · {record.wins} {tx('victorias', 'wins')}</span>
                    )}
                  </div>
                  {unlocked ? (
                    <button
                      type="button"
                      className="dungeon-primary-btn"
                      disabled={loading}
                      onClick={(event) => { event.stopPropagation(); void startExpedition(dungeon.id) }}
                      onMouseEnter={playHover}
                    >
                      {loading && selectedDungeon === dungeon.id ? tx('Preparando...', 'Preparing...') : `▶ ${tx('Entrar', 'Enter')}`}
                    </button>
                  ) : (
                    <div className="dungeon-locked-note">
                      {tx('Completa', 'Clear')} <strong>{requirement ? (en ? requirement.nameEn : requirement.name) : '—'}</strong> {tx('para desbloquear.', 'to unlock.')}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
          <div className="dungeon-panel dungeon-tip-panel">
            <h3>🧭 {tx('Equipo de expedición', 'Expedition team')}</h3>
            <div className="dungeon-inline-team">
              {save.selectedTeam.map((id) => (
                <div key={id} className="dungeon-inline-mon">
                  <Portrait id={id} className="dungeon-inline-portrait" />
                  <span>{teamRosterById.get(id)?.name ?? `Pokémon ${id}`}</span>
                </div>
              ))}
              <button type="button" className="dungeon-secondary-btn" onClick={() => go('team')} onMouseEnter={playHover}>
                {tx('Cambiar equipo', 'Change team')}
              </button>
            </div>
          </div>
        </main>
      )}

      {view === 'team' && (
        <main className="dungeon-main">
          <div className="dungeon-view-head">
            <button type="button" className="dungeon-ghost-btn" onClick={() => go('menu')} onMouseEnter={playHover}>← {tx('Volver', 'Back')}</button>
            <h2>🧭 {tx('Equipo de expedición', 'Expedition team')}</h2>
            <span className="dungeon-selected-count">{save.selectedTeam.length}/4</span>
          </div>
          <p className="dungeon-view-sub">
            {tx('Elige hasta 4 Pokémon. El primero de la lista será el líder de la expedición.', 'Choose up to 4 Pokémon. The first in the list will be the expedition leader.')}
          </p>
          <div className="dungeon-team-filters" role="toolbar" aria-label={tx('Filtros de Pokémon', 'Pokémon filters')}>
            <button
              type="button"
              className={`dungeon-team-filter ${teamFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => { playClick(); setTeamFilter('all') }}
            >
              🧭 {tx('Todos', 'All')}
            </button>
            <button
              type="button"
              className={`dungeon-team-filter ${teamFilter === 'team' ? 'is-active' : ''}`}
              onClick={() => { playClick(); setTeamFilter('team') }}
            >
              ★ {tx('En equipo', 'On team')}
            </button>
            <button
              type="button"
              className={`dungeon-team-filter ${teamFilter === 'recruited' ? 'is-active' : ''}`}
              onClick={() => { playClick(); setTeamFilter('recruited') }}
            >
              🤝 {tx('Reclutados', 'Recruited')}
            </button>
            <select
              className="dungeon-team-select"
              aria-label={tx('Filtrar por generación', 'Filter by generation')}
              title={tx('Filtrar por generación', 'Filter by generation')}
              value={generationFilter === 'all' ? 'all' : String(generationFilter)}
              onChange={(event) => {
                playClick()
                setGenerationFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))
              }}
            >
              <option value="all">{tx('Todas las generaciones', 'All generations')}</option>
              {GENERATION_INFO.map((generation) => (
                <option key={generation.id} value={generation.id}>Gen {generation.id} · {generation.region}</option>
              ))}
            </select>
            <select
              className="dungeon-team-select"
              aria-label={tx('Filtrar por tipo', 'Filter by type')}
              title={tx('Filtrar por tipo', 'Filter by type')}
              value={typeFilter}
              onChange={(event) => {
                playClick()
                setTypeFilter(event.target.value)
              }}
            >
              <option value="all">{tx('Todos los tipos', 'All types')}</option>
              {TEAM_TYPE_ORDER.map((type) => (
                <option key={type} value={type}>{typeLabel(type)}</option>
              ))}
            </select>
          </div>
          <div className="dungeon-starter-grid">
            {filteredTeamRoster.map((member) => {
              const selectedIndex = save.selectedTeam.indexOf(member.id)
              const selected = selectedIndex >= 0
              return (
                <button
                  key={member.id}
                  type="button"
                  className={`dungeon-starter-card ${selected ? 'is-selected' : ''}`}
                  style={{ borderColor: selected ? member.color : undefined }}
                  onClick={() => toggleStarter(member.id)}
                  onMouseEnter={playHover}
                >
                  <div className="dungeon-starter-art" style={{ background: `${member.color}22` }}>
                    <span className="dungeon-dex-no">No. {String(member.id).padStart(3, '0')}</span>
                    <Portrait id={member.id} className="dungeon-starter-portrait" />
                    {selected && <span className="dungeon-starter-order">{selectedIndex + 1}</span>}
                    {member.showRecruitBadge && <span className="dungeon-recruit-tag">{tx('Reclutado', 'Recruited')}</span>}
                  </div>
                  <strong>{member.name}</strong>
                  <div className="dungeon-starter-types">
                    {member.types.map((type) => (
                      <span key={type} className={`dungeon-type dungeon-type--${type}`}>{typeLabel(type)}</span>
                    ))}
                  </div>
                  {member.desc && <span>{member.desc}</span>}
                  {selectedIndex === 0 && <em className="dungeon-leader-tag">★ {tx('Líder', 'Leader')}</em>}
                </button>
              )
            })}
          </div>
          {filteredTeamRoster.length === 0 && (
            <p className="dungeon-muted dungeon-team-empty">
              {tx('No hay Pokémon que coincidan con este filtro.', 'No Pokémon match this filter.')}
            </p>
          )}

          <section className="dungeon-panel">
            <h3>✨ {tx('Ventajas pasivas equipadas', 'Equipped passive perks')} ({save.equippedPassives.length}/{MAX_PASSIVE_SLOTS})</h3>
            <div className="dungeon-equip-row">
              {save.equippedPassives.map((id) => {
                const passive = PASSIVE_BY_ID[id]
                if (!passive) return null
                return (
                  <button key={id} type="button" className="dungeon-equip-chip" onClick={() => togglePassive(id)} onMouseEnter={playHover}>
                    {passive.icon} {en ? passive.nameEn : passive.name} ✕
                  </button>
                )
              })}
              {save.equippedPassives.length === 0 && (
                <span className="dungeon-muted">{tx('No hay ventajas equipadas. Cómpralas y equípalas en la tienda.', 'No perks equipped. Buy and equip them in the shop.')}</span>
              )}
            </div>
            <button type="button" className="dungeon-secondary-btn" onClick={() => go('shop')} onMouseEnter={playHover}>
              {tx('Gestionar ventajas', 'Manage perks')} →
            </button>
          </section>

          <section className="dungeon-panel">
            <h3>🎀 {tx('Objetos equipables', 'Held items')}</h3>
            <div className="dungeon-held-list">
              {save.selectedTeam.map((id) => {
                const member = teamRosterById.get(id)
                const equipped = equippedHeldItems[id] ?? ''
                return (
                  <label key={id} className="dungeon-held-row">
                    <span>{member?.name ?? `Pokémon ${id}`}</span>
                    <select
                      className="dungeon-team-select dungeon-held-select"
                      value={equipped}
                      onChange={(event) => equipHeldItem(id, event.target.value)}
                    >
                      <option value="">{tx('Ninguno', 'None')}</option>
                      {ownedHeldItems.map((heldId) => {
                        const held = HELD_ITEM_BY_ID[heldId]
                        if (!held) return null
                        return <option key={heldId} value={heldId}>{en ? held.nameEn : held.name}</option>
                      })}
                    </select>
                  </label>
                )
              })}
            </div>
            {ownedHeldItems.length === 0 && (
              <p className="dungeon-muted">{tx('Compra objetos equipables en la tienda del gremio.', 'Buy held items in the guild shop.')}</p>
            )}
            <button type="button" className="dungeon-secondary-btn" onClick={() => go('shop')} onMouseEnter={playHover}>
              {tx('Comprar equipables', 'Buy held items')} →
            </button>
          </section>

          <div className="dungeon-team-footer">
            <button type="button" className="dungeon-primary-btn dungeon-primary-btn--big" onClick={() => go('expedition')} onMouseEnter={playHover}>
              🗺️ {tx('Ir a elegir mazmorra', 'Choose a dungeon')}
            </button>
          </div>
        </main>
      )}

      {view === 'shop' && (
        <main className="dungeon-main">
          <div className="dungeon-view-head">
            <button type="button" className="dungeon-ghost-btn" onClick={() => go('menu')} onMouseEnter={playHover}>← {tx('Volver', 'Back')}</button>
            <h2>🛒 {tx('Tienda del Gremio', 'Guild Shop')}</h2>
            <span className="dungeon-crystal-pill">💠 {save.crystals}</span>
          </div>
          <p className="dungeon-view-sub">
            {tx('Los Cristales de Gremio se obtienen explorando mazmorras. No son PokéCoins y no se comparten con el modo clásico.', 'Guild Crystals are earned by exploring dungeons. They are not PokéCoins and are not shared with classic mode.')}
          </p>

          <div className="dungeon-tabs">
            <button type="button" className={`dungeon-tab ${shopTab === 'active' ? 'is-active' : ''}`} onClick={() => { playClick(); setShopTab('active') }}>
              🎒 {tx('Activos', 'Actives')}
            </button>
            <button type="button" className={`dungeon-tab ${shopTab === 'passive' ? 'is-active' : ''}`} onClick={() => { playClick(); setShopTab('passive') }}>
              ✨ {tx('Pasivos', 'Passives')}
            </button>
            <button type="button" className={`dungeon-tab ${shopTab === 'held' ? 'is-active' : ''}`} onClick={() => { playClick(); setShopTab('held') }}>
              🎀 {tx('Equipables', 'Held items')}
            </button>
            <button type="button" className={`dungeon-tab ${shopTab === 'upgrade' ? 'is-active' : ''}`} onClick={() => { playClick(); setShopTab('upgrade') }}>
              ⬆️ {tx('Mejoras', 'Upgrades')}
            </button>
          </div>

          {shopTab === 'active' && (
            <>
              <p className="dungeon-shop-note">
                {tx('Cada objeto activo desbloqueado aparece en tu bolsa al empezar cualquier expedición, hasta llenar su capacidad.', 'Each unlocked active item appears in your bag at the start of any expedition, up to its capacity.')}
              </p>
              <div className="dungeon-shop-grid">
                {ACTIVE_ITEMS.map((item) => {
                  const owned = save.ownedActives.includes(item.id)
                  return (
                    <article key={item.id} className={`dungeon-shop-card ${owned ? 'is-owned' : ''}`}>
                      <span className="dungeon-shop-icon">
                        <img
                          className="dungeon-item-sprite"
                          src={item.sprite}
                          alt=""
                          loading="lazy"
                          onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
                        />
                      </span>
                      <div className="dungeon-shop-copy">
                        <strong>{en ? item.nameEn : item.name}</strong>
                        <span>{en ? item.descEn : item.desc}</span>
                      </div>
                      {owned ? (
                        <span className="dungeon-badge dungeon-badge--clear">✔ {tx('Desbloqueado', 'Unlocked')}</span>
                      ) : (
                        <button
                          type="button"
                          className="dungeon-buy-btn"
                          onClick={() => buyActive(item.id)}
                          onMouseEnter={playHover}
                          disabled={save.crystals < item.price}
                        >
                          💠 {item.price}
                        </button>
                      )}
                    </article>
                  )
                })}
              </div>
            </>
          )}

          {shopTab === 'passive' && (
            <>
              <p className="dungeon-shop-note">
                {tx(`Compra ventajas pasivas y equipa hasta ${MAX_PASSIVE_SLOTS}. Sus efectos se aplican a toda la expedición.`, `Buy passive perks and equip up to ${MAX_PASSIVE_SLOTS}. Their effects apply to the whole expedition.`)}
              </p>
              <div className="dungeon-shop-grid">
                {PASSIVE_ITEMS.map((item) => {
                  const owned = save.ownedPassives.includes(item.id)
                  const equipped = save.equippedPassives.includes(item.id)
                  return (
                    <article key={item.id} className={`dungeon-shop-card ${owned ? 'is-owned' : ''} ${equipped ? 'is-equipped' : ''}`}>
                      <span className="dungeon-shop-icon">{item.icon}</span>
                      <div className="dungeon-shop-copy">
                        <strong>{en ? item.nameEn : item.name}</strong>
                        <span>{en ? item.descEn : item.desc}</span>
                      </div>
                      {!owned ? (
                        <button
                          type="button"
                          className="dungeon-buy-btn"
                          onClick={() => buyPassive(item.id)}
                          onMouseEnter={playHover}
                          disabled={save.crystals < item.price}
                        >
                          💠 {item.price}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`dungeon-equip-btn ${equipped ? 'is-equipped' : ''}`}
                          onClick={() => togglePassive(item.id)}
                          onMouseEnter={playHover}
                        >
                          {equipped ? `✔ ${tx('Equipado', 'Equipped')}` : tx('Equipar', 'Equip')}
                        </button>
                      )}
                    </article>
                  )
                })}
              </div>
            </>
          )}

          {shopTab === 'held' && (
            <>
              <p className="dungeon-shop-note">
                {tx('Los objetos equipables se asignan a cada Pokémon en el Equipo de Expedición. Solo puedes llevar uno por Pokémon y potencian los movimientos de su tipo.', 'Held items are assigned to each Pokémon in the Expedition Team. Each Pokémon can hold one, and they boost moves of their type.')}
              </p>
              <div className="dungeon-shop-grid">
                {HELD_ITEMS.map((item) => {
                  const owned = ownedHeldItems.includes(item.id)
                  return (
                    <article key={item.id} className={`dungeon-shop-card ${owned ? 'is-owned' : ''}`}>
                      <span className="dungeon-shop-icon">
                        <img
                          className="dungeon-item-sprite"
                          src={item.sprite}
                          alt=""
                          loading="lazy"
                          onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
                        />
                      </span>
                      <div className="dungeon-shop-copy">
                        <strong>{en ? item.nameEn : item.name}</strong>
                        <span>{en ? item.descEn : item.desc}</span>
                      </div>
                      {owned ? (
                        <span className="dungeon-badge dungeon-badge--clear">✔ {tx('Desbloqueado', 'Unlocked')}</span>
                      ) : (
                        <button
                          type="button"
                          className="dungeon-buy-btn"
                          onClick={() => buyHeldItem(item.id)}
                          onMouseEnter={playHover}
                          disabled={save.crystals < item.price}
                        >
                          💠 {item.price}
                        </button>
                      )}
                    </article>
                  )
                })}
              </div>
            </>
          )}

          {shopTab === 'upgrade' && (
            <div className="dungeon-upgrade-list">
              {UPGRADES.map((upgrade) => {
                const level = save.upgrades[upgrade.id] ?? 0
                const cost = upgradeCost(upgrade, level)
                const maxed = level >= upgrade.maxLevel
                return (
                  <article key={upgrade.id} className="dungeon-upgrade-card">
                    <span className="dungeon-shop-icon">{upgrade.icon}</span>
                    <div className="dungeon-upgrade-copy">
                      <strong>{en ? upgrade.nameEn : upgrade.name}</strong>
                      <span>{en ? upgrade.descEn : upgrade.desc}</span>
                      <div className="dungeon-pips">
                        {Array.from({ length: upgrade.maxLevel }).map((_, index) => (
                          <span key={index} className={`dungeon-pip ${index < level ? 'is-filled' : ''}`} />
                        ))}
                      </div>
                    </div>
                    {maxed ? (
                      <span className="dungeon-badge dungeon-badge--clear">MAX</span>
                    ) : (
                      <button
                        type="button"
                        className="dungeon-buy-btn"
                        onClick={() => buyUpgrade(upgrade.id)}
                        onMouseEnter={playHover}
                        disabled={cost === null || save.crystals < cost}
                      >
                        💠 {cost ?? '—'}
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </main>
      )}

      {view === 'result' && result && (
        <main className="dungeon-main dungeon-result-main">
          <section className={`dungeon-result-card dungeon-result-card--${result.status}`}>
            <div className="dungeon-result-icon">
              {result.status === 'won' ? '🏆' : result.status === 'escaped' ? '🌀' : '💀'}
            </div>
            <h1>
              {result.status === 'won'
                ? tx('¡Expedición completada!', 'Expedition complete!')
                : result.status === 'escaped'
                  ? tx('Has escapado', 'You escaped')
                  : tx('El equipo ha caído', 'The team has fallen')}
            </h1>
            <p>
              {result.status === 'won'
                ? tx(`Has conquistado ${DUNGEON_BY_ID[result.dungeonId].name}.`, `You have conquered ${DUNGEON_BY_ID[result.dungeonId].nameEn}.`)
                : result.status === 'escaped'
                  ? tx('Vuelves al campamento con lo que pudiste reunir.', 'You return to camp with what you could gather.')
                  : tx('La mazmorra se queda con parte de vuestro botín...', 'The dungeon keeps part of your loot...')}
            </p>
            <div className="dungeon-result-stats">
              <div><span>💠 +{result.crystalsEarned}</span><small>{tx('Cristales', 'Crystals')}</small></div>
              <div><span>☠️ {result.enemiesDefeated}</span><small>{tx('Derrotados', 'Defeated')}</small></div>
              <div><span>🤝 {result.recruits}</span><small>{tx('Reclutados', 'Recruited')}</small></div>
              <div><span>📜 {result.floor}</span><small>{tx('Piso alcanzado', 'Floor reached')}</small></div>
            </div>
            {result.isFirstClear && (
              <div className="dungeon-result-unlock">
                🎉 {tx('¡Primera victoria! Has recibido una bonificación extra de cristales.', 'First victory! You received an extra crystal bonus.')}
                {nextDungeonId(result.dungeonId) && (
                  <span>
                    {' '}{tx('Nueva mazmorra desbloqueada:', 'New dungeon unlocked:')}{' '}
                    <strong>
                      {en
                        ? DUNGEON_BY_ID[nextDungeonId(result.dungeonId) as DungeonId].nameEn
                        : DUNGEON_BY_ID[nextDungeonId(result.dungeonId) as DungeonId].name}
                    </strong>
                  </span>
                )}
              </div>
            )}
            <div className="dungeon-result-actions">
              <button type="button" className="dungeon-primary-btn" onClick={() => go('menu')} onMouseEnter={playHover}>
                🏕️ {tx('Volver al campamento', 'Back to camp')}
              </button>
              <button
                type="button"
                className="dungeon-secondary-btn"
                disabled={loading}
                onClick={() => void startExpedition(lastDungeon)}
                onMouseEnter={playHover}
              >
                🔁 {tx('Repetir expedición', 'Repeat expedition')}
              </button>
              <button type="button" className="dungeon-secondary-btn" onClick={() => go('shop')} onMouseEnter={playHover}>
                🛒 {tx('Ir a la tienda', 'Go to shop')}
              </button>
            </div>
          </section>
        </main>
      )}

      {loading && (
        <div className="dungeon-loading">
          <div className="dungeon-loading-spinner">🌀</div>
          <strong>{tx('Preparando la expedición...', 'Preparing the expedition...')}</strong>
          <span>{tx('Reclutando al equipo y cargando sprites de PMD Collab.', 'Assembling your team and loading PMD Collab sprites.')}</span>
        </div>
      )}

      {showHelp && (
        <div className="dungeon-modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="dungeon-modal" onClick={(event) => event.stopPropagation()}>
            <h2>📖 {tx('Cómo se juega', 'How to play')}</h2>
            <div className="dungeon-help-grid">
              <div><strong>🎮 {tx('Movimiento', 'Movement')}</strong><p>{tx('Flechas o WASD. También puedes usar la cruceta. Cada paso consume un turno.', 'Arrow keys or WASD. You can also use the D-pad. Every step consumes a turn.')}</p></div>
              <div><strong>⚔️ {tx('Combate', 'Combat')}</strong><p>{tx('Camina contra un enemigo para atacar con el movimiento seleccionado, o pulsa F.', 'Walk into an enemy to attack with the selected move, or press F.')}</p></div>
              <div><strong>🤝 {tx('Reclutamiento', 'Recruiting')}</strong><p>{tx('Al derrotar a un enemigo puede unirse al equipo si tienes hueco (máx. 4).', 'Defeated enemies may join your team if there is room (max 4).')}</p></div>
              <div><strong>💠 {tx('Cristales', 'Crystals')}</strong><p>{tx('Los Cristales de Gremio se gastan en la tienda del modo. No son PokéCoins.', 'Guild Crystals are spent in the mode shop. They are not PokéCoins.')}</p></div>
              <div><strong>🌀 {tx('Escaleras', 'Stairs')}</strong><p>{tx('Pisa las escaleras para bajar de piso. En el último piso, derrota al jefe para poder escapar.', 'Step on the stairs to descend. On the last floor, defeat the boss to escape.')}</p></div>
              <div><strong>🎒 {tx('Bolsa y objetos', 'Bag and items')}</strong><p>{tx('Recoge objetos del suelo y úsalos cuando los necesites. La bolsa tiene capacidad limitada.', 'Pick up items from the floor and use them when needed. Bag space is limited.')}</p></div>
            </div>
            <button type="button" className="dungeon-primary-btn" onClick={() => { playClick(); setShowHelp(false) }} onMouseEnter={playHover}>
              {tx('Entendido', 'Got it')}
            </button>
          </div>
        </div>
      )}

      {showReset && (
        <div className="dungeon-modal-backdrop" onClick={() => setShowReset(false)}>
          <div className="dungeon-modal" onClick={(event) => event.stopPropagation()}>
            <h2>⚠️ {tx('Borrar progreso', 'Reset progress')}</h2>
            <p>
              {tx('Se borrarán los cristales, objetos, ventajas, mejoras y marcas de la Mazmorra Misteriosa. El modo clásico no se verá afectado.', 'This will erase dungeon crystals, items, perks, upgrades and records. Classic mode will not be affected.')}
            </p>
            <div className="dungeon-modal-actions">
              <button type="button" className="dungeon-danger-btn" onClick={handleReset} onMouseEnter={playHover}>
                {tx('Sí, borrar todo', 'Yes, erase everything')}
              </button>
              <button type="button" className="dungeon-secondary-btn" onClick={() => { playClick(); setShowReset(false) }} onMouseEnter={playHover}>
                {tx('Cancelar', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {celebration && (
        <div className="dungeon-unlock-overlay" onClick={dismissCelebration} role="status" aria-live="polite">
          <div className="dungeon-unlock-card">
            <div className="dungeon-unlock-stars" aria-hidden="true">
              {UNLOCK_STAR_POSITIONS.map((star, index) => (
                <span
                  key={index}
                  style={{
                    left: `${star.left}%`,
                    top: `${star.top}%`,
                    animationDelay: `${index * 0.09}s`,
                  }}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="dungeon-unlock-kicker">
              ✨ {tx('¡Nuevo Pokémon desbloqueado!', 'New Pokémon unlocked!')} ✨
            </span>
            <Portrait id={celebration.id} className="dungeon-unlock-portrait" />
            <strong className="dungeon-unlock-name">{celebration.name}</strong>
            <div className="dungeon-unlock-types">
              {celebration.types.map((type) => (
                <span key={type} className={`dungeon-type dungeon-type--${type}`}>
                  {typeLabel(type)}
                </span>
              ))}
            </div>
            <span className="dungeon-unlock-sub">
              {tx('Ya está disponible en el Equipo de Expedición.', 'Now available in the Expedition Team.')}
            </span>
            <span className="dungeon-unlock-hint">{tx('Clic para continuar', 'Click to continue')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
