import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Language } from '../game/i18n'
import treeUrl from '../assets/Dungeon/arbol.png?inline'
import { DungeonPortrait } from '../dungeon/DungeonPortrait'
import type { PortraitEmotion } from '../dungeon/pmdAssets'
import {
  playClick,
  playCoin,
  playDefeatMusic,
  playError,
  playHit,
  playPurchase,
  playVictoryFanfare,
  startBattleMusic,
  startMenuMusic,
} from '../game/sound'
import {
  POKEST_DUNGEONS,
  POKEST_HERO_DEFS,
  POKEST_MAX_ROSTER,
  POKEST_MAX_TEAM,
  POKEST_MAX_UPGRADE,
  POKEST_NODE_LABELS,
  POKEST_QUIRK_COST,
  POKEST_RECRUIT_COST,
  POKEST_REST_COST,
  POKEST_TRAIN_COST,
  POKEST_ROLE_LABELS,
  createHero,
  getAffliction,
  getDungeon,
  getEvent,
  getQuirk,
  getVirtue,
} from './data'
import * as engine from './engine'
import { PokestPmdSprite } from './PokestPmdSprite'
import { loadPokestSave, persistPokestSave, settleRun, type PokestRunOutcome } from './storage'
import type {
  PokestDungeonId,
  PokestHero,
  PokestNodeType,
  PokestRunState,
  PokestSave,
  PokestSkill,
} from './types'
import './pokest.css'

interface PokestDungeonProps {
  language: Language
  onExit: () => void
}

type TownBuildingId = 'abbey' | 'stagecoach' | 'blacksmith' | 'sanatorium' | 'guild' | 'expedition'
type TownPanel = 'roster' | TownBuildingId | null

function L(language: Language, es: string, en: string): string {
  return language === 'en' ? en : es
}

function pct(value: number, max: number): number {
  return Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))
}

function roleLabel(role: PokestHero['role'], language: Language): string {
  const entry = POKEST_ROLE_LABELS[role]
  return language === 'en' ? entry.en : entry.es
}

function portraitEmotion(unit: PokestHero): PortraitEmotion {
  if (unit.deathsDoor) return 'Pain'
  if (unit.affliction === 'ira') return 'Angry'
  if (unit.affliction === 'miedo' || unit.affliction === 'paranoia' || unit.affliction === 'obsesion') return 'Worried'
  if (unit.virtue) return 'Determined'
  if (unit.stress >= 100) return 'Worried'
  if (unit.hp / Math.max(1, unit.maxHp) < 0.3) return 'Pain'
  return 'Normal'
}

function nodeDescription(type: PokestNodeType, language: Language): string {
  const descriptions: Record<PokestNodeType, { es: string; en: string }> = {
    battle: { es: 'Algo se arrastra en la oscuridad. Preparad las habilidades.', en: 'Something crawls in the dark. Ready your skills.' },
    elite: { es: 'Una presencia más fuerte que las demás bloquea el paso.', en: 'A presence stronger than the rest blocks the way.' },
    event: { es: 'Una decisión os espera entre las sombras.', en: 'A decision waits among the shadows.' },
    camp: { es: 'Un fuego improvisado os da un breve respiro.', en: 'An improvised fire gives you a brief respite.' },
    treasure: { es: 'El brillo del oro rompe la penumbra.', en: 'The glint of gold breaks the gloom.' },
    boss: { es: 'El aire pesa. La dungeon guarda su última prueba.', en: 'The air is heavy. The dungeon keeps its final trial.' },
  }
  return language === 'en' ? descriptions[type].en : descriptions[type].es
}

function unitStatuses(unit: PokestHero, language: Language): Array<{ key: string; label: string; tone: string }> {
  const statuses: Array<{ key: string; label: string; tone: string }> = []
  if (unit.deathsDoor) statuses.push({ key: 'death', label: L(language, 'Puerta de la muerte', "Death's Door"), tone: 'death' })
  if (unit.guard > 0) statuses.push({ key: 'guard', label: L(language, 'Protegido', 'Guarded'), tone: 'guard' })
  if (unit.stun > 0) statuses.push({ key: 'stun', label: L(language, 'Aturdido', 'Stunned'), tone: 'stun' })
  if (unit.bleed > 0) statuses.push({ key: 'bleed', label: L(language, 'Sangrado', 'Bleeding'), tone: 'bleed' })
  if (unit.blight > 0) statuses.push({ key: 'blight', label: L(language, 'Corrosión', 'Blighted'), tone: 'blight' })
  if (unit.weak > 0) statuses.push({ key: 'weak', label: L(language, 'Débil', 'Weak'), tone: 'weak' })
  if (unit.vulnerable > 0) statuses.push({ key: 'vulnerable', label: L(language, 'Vulnerable', 'Vulnerable'), tone: 'vulnerable' })
  const affliction = getAffliction(unit.affliction)
  if (affliction) statuses.push({ key: 'affliction', label: language === 'en' ? affliction.nameEn : affliction.name, tone: 'affliction' })
  const virtue = getVirtue(unit.virtue)
  if (virtue) statuses.push({ key: 'virtue', label: language === 'en' ? virtue.nameEn : virtue.name, tone: 'virtue' })
  return statuses
}

function Bar({ value, max, kind }: { value: number; max: number; kind: 'hp' | 'stress' | 'torch' }) {
  return (
    <div className={`pokest-bar pokest-bar--${kind}`}>
      <i style={{ width: `${pct(value, max)}%` }} />
    </div>
  )
}

interface UnitCardProps {
  unit: PokestHero
  language: Language
  isEnemy: boolean
  current?: boolean
  targetable?: boolean
  selected?: boolean
  compact?: boolean
  animated?: boolean
  rankOverride?: number | string
  onClick?: () => void
}

function UnitCard({ unit, language, isEnemy, current, targetable, selected, compact, animated, rankOverride, onClick }: UnitCardProps) {
  const statuses = unitStatuses(unit, language)
  const rank = rankOverride ?? unit.rank
  return (
    <button
      type="button"
      className={`pokest-unit-card${isEnemy ? ' is-enemy' : ' is-hero'}${current ? ' is-current' : ''}${targetable ? ' is-targetable' : ''}${selected ? ' is-selected' : ''}${compact ? ' is-compact' : ''}${unit.deathsDoor ? ' is-death-door' : ''}${unit.affliction ? ' is-afflicted' : ''}${unit.virtue ? ' is-virtuous' : ''}${onClick ? ' is-clickable' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="pokest-unit-top">
        <span className="pokest-rank">{rank === '—' ? '—' : `R${rank}`}</span>
        <span className="pokest-level">Nv. {unit.level}</span>
      </span>
      {animated
        ? <PokestPmdSprite id={unit.defId} size={compact ? 54 : 76} className="pokest-unit-sprite pokest-unit-sprite--animated" />
        : <DungeonPortrait id={unit.defId} emotion={portraitEmotion(unit)} className="pokest-unit-sprite pokest-unit-sprite--portrait" alt={unit.name} />}
      <strong className="pokest-unit-name">{unit.name}</strong>
      <span className="pokest-unit-sub">
        {isEnemy ? (language === 'en' ? unit.titleEn : unit.title) : roleLabel(unit.role, language)}
      </span>
      <span className="pokest-unit-bars">
        <Bar value={unit.hp} max={unit.maxHp} kind="hp" />
        {!isEnemy && <Bar value={unit.stress} max={unit.maxStress} kind="stress" />}
      </span>
      <span className="pokest-unit-values">
        <span>{Math.max(0, Math.round(unit.hp))}/{unit.maxHp}</span>
        {!isEnemy && <span>{Math.round(unit.stress)}/200</span>}
      </span>
      {statuses.length > 0 && (
        <span className="pokest-statuses">
          {statuses.map((status) => (
            <span key={status.key} className={`pokest-status pokest-status--${status.tone}`}>{status.label}</span>
          ))}
        </span>
      )}
      {!compact && (unit.quirks?.length ?? 0) > 0 && (
        <span className="pokest-quirks">
          {(unit.quirks ?? []).map((id) => {
            const quirk = getQuirk(id)
            if (!quirk) return null
            return (
              <span
                key={quirk.id}
                className={`pokest-quirk${quirk.positive ? ' is-positive' : ' is-negative'}`}
                title={language === 'en' ? quirk.descEn : quirk.desc}
              >
                {language === 'en' ? quirk.nameEn : quirk.name}
              </span>
            )
          })}
        </span>
      )}
    </button>
  )
}

function skillIcon(skill: PokestSkill): string {
  if (skill.status === 'bleed') return '🩸'
  if (skill.status === 'blight') return '☠️'
  if (skill.status === 'stun') return '✦'
  if (skill.effect === 'guard') return '🛡️'
  if (skill.effect === 'heal') return '✚'
  if (skill.effect === 'stressHeal') return '☾'
  if (skill.effect === 'stressDamage') return '🌀'
  if (skill.status === 'vulnerable') return '🎯'
  return '⚔️'
}

function BattleUnit({
  unit,
  language,
  side,
  current,
  targetable,
  selected,
  onClick,
}: {
  unit: PokestHero
  language: Language
  side: 'hero' | 'enemy'
  current?: boolean
  targetable?: boolean
  selected?: boolean
  onClick?: () => void
}) {
  const statuses = unitStatuses(unit, language).slice(0, 3)
  return (
    <button
      type="button"
      className={`pokest-battle-unit is-${side}${current ? ' is-current' : ''}${targetable ? ' is-targetable' : ''}${selected ? ' is-selected' : ''}${!unit.alive ? ' is-dead' : ''}${unit.deathsDoor ? ' is-death-door' : ''}${unit.affliction ? ' is-afflicted' : ''}${unit.virtue ? ' is-virtuous' : ''}${onClick ? ' is-clickable' : ''}`}
      onClick={onClick}
      aria-label={unit.name}
    >
      <span className="pokest-battle-rank">R{unit.rank}</span>
      <PokestPmdSprite id={unit.defId} size={side === 'hero' ? 126 : 126} className="pokest-battle-sprite" />
      <span className="pokest-battle-name">{unit.name}</span>
      <span className="pokest-battle-hp">
        <i style={{ width: `${pct(unit.hp, unit.maxHp)}%` }} />
      </span>
      <span className="pokest-battle-hp-text">{Math.max(0, Math.round(unit.hp))}/{unit.maxHp}</span>
      {statuses.length > 0 && (
        <span className="pokest-battle-statuses">
          {statuses.map((status) => (
            <span key={status.key} className={`pokest-battle-status is-${status.tone}`}>{status.label}</span>
          ))}
        </span>
      )}
    </button>
  )
}

function HudPartySlot({
  hero,
  language,
  active,
  selected,
  onClick,
}: {
  hero: PokestHero
  language: Language
  active: boolean
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`pokest-hud-slot${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}${!hero.alive ? ' is-dead' : ''}`}
      onClick={onClick}
    >
      <span className="pokest-hud-slot-rank">{hero.rank}</span>
      <DungeonPortrait id={hero.defId} emotion={portraitEmotion(hero)} className="pokest-hud-slot-portrait" alt="" />
      <span className="pokest-hud-slot-body">
        <span className="pokest-hud-slot-name">{hero.name}</span>
        <Bar value={hero.hp} max={hero.maxHp} kind="hp" />
        <Bar value={hero.stress} max={hero.maxStress} kind="stress" />
      </span>
      {hero.deathsDoor && <span className="pokest-hud-slot-death">💀</span>}
      {hero.affliction && <span className="pokest-hud-slot-afflicted">✦</span>}
      {hero.virtue && <span className="pokest-hud-slot-virtuous">✧</span>}
      <span className="pokest-hud-slot-level">{language === 'en' ? 'Lv' : 'Nv'} {hero.level}</span>
    </button>
  )
}

function HudSkillButton({
  skill,
  hero,
  run,
  language,
  onClick,
}: {
  skill: PokestSkill
  hero: PokestHero
  run: PokestRunState
  language: Language
  onClick: () => void
}) {
  const usable = engine.canUseSkill(run, hero, skill)
  const cooldown = hero.cooldowns[skill.id] ?? 0
  return (
    <button
      type="button"
      className={`pokest-hud-skill${cooldown > 0 ? ' is-cooling' : ''}`}
      onClick={onClick}
      disabled={!usable}
      title={`${language === 'en' ? skill.nameEn : skill.name} — ${engine.skillDescription(skill, language)}`}
    >
      <span className="pokest-hud-skill-icon">{skillIcon(skill)}</span>
      <span className="pokest-hud-skill-name">{language === 'en' ? skill.nameEn : skill.name}</span>
      {cooldown > 0 && <span className="pokest-hud-skill-cd">{cooldown}</span>}
    </button>
  )
}

export function PokestDungeon({ language, onExit }: PokestDungeonProps) {
  const [save, setSave] = useState<PokestSave>(() => loadPokestSave())
  const [selectedDungeon, setSelectedDungeon] = useState<PokestDungeonId>('crypt')
  const [townPanel, setTownPanel] = useState<TownPanel>(null)
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null)
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null)
  const [showCombatLog, setShowCombatLog] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)
  const toastTimer = useRef<number | null>(null)

  const notify = (es: string, en: string): void => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(L(language, es, en))
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => {
    persistPokestSave(save)
  }, [save])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const phase = save.activeRun?.phase
    if (phase === 'combat') startBattleMusic()
    else startMenuMusic()
  }, [save.activeRun?.phase])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      startMenuMusic()
    }
  }, [])

  useEffect(() => {
    const run = save.activeRun
    if (!run || run.phase !== 'combat') return
    const current = engine.getCurrentCombatant(run)
    if (!current || !current.isEnemy || !current.alive) return
    const timer = window.setTimeout(() => {
      setSave((prev) => {
        if (!prev.activeRun || prev.activeRun.phase !== 'combat') return prev
        const next = engine.cloneRun(prev.activeRun)
        engine.performEnemyTurn(next)
        return { ...prev, activeRun: next }
      })
    }, 720)
    return () => window.clearTimeout(timer)
  }, [save.activeRun])

  useEffect(() => {
    const phase = save.activeRun?.phase
    if (phase === 'combatWon' || phase === 'victory') playVictoryFanfare()
    else if (phase === 'defeat') playDefeatMusic()
  }, [save.activeRun?.phase])

  useEffect(() => {
    const run = save.activeRun
    if (!run || run.phase !== 'combat') return
    const current = engine.getCurrentCombatant(run)
    if (current && !current.isEnemy && current.alive) setSelectedHeroId(current.instanceId)
  }, [save.activeRun])

  useEffect(() => {
    const element = logRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [save.activeRun?.log.length, showCombatLog])

  const updateRun = (mutator: (run: PokestRunState) => void): void => {
    setSave((prev) => {
      if (!prev.activeRun) return prev
      const next = engine.cloneRun(prev.activeRun)
      mutator(next)
      return { ...prev, activeRun: next }
    })
  }

  const teamHeroes = useMemo(
    () => save.teamIds
      .map((id) => save.roster.find((hero) => hero.instanceId === id))
      .filter((hero): hero is PokestHero => Boolean(hero)),
    [save.teamIds, save.roster],
  )

  const selectedUnlocked = save.unlockedDungeons.includes(selectedDungeon)
  const canStart = teamHeroes.length > 0 && selectedUnlocked

  const rest = (): void => {
    if (save.gold < POKEST_REST_COST) {
      playError()
      notify('No hay oro suficiente para descansar.', 'Not enough gold to rest.')
      return
    }
    playPurchase()
    setSave((prev) => ({
      ...prev,
      gold: prev.gold - POKEST_REST_COST,
      roster: prev.roster.map((hero) => ({
        ...hero,
        hp: Math.min(hero.maxHp, hero.hp + Math.round(hero.maxHp * 0.4)),
        stress: Math.max(0, hero.stress - 30),
        deathsDoor: false,
        affliction: null,
        virtue: null,
      })),
      lastMessage: L(language, 'El grupo descansa y recupera fuerzas.', 'The party rests and recovers.'),
      lastMessageEn: 'The party rests and recovers.',
    }))
  }

  const recruit = (): void => {
    if (save.roster.length >= POKEST_MAX_ROSTER) {
      playError()
      notify('El roster está completo.', 'The roster is full.')
      return
    }
    if (save.gold < POKEST_RECRUIT_COST) {
      playError()
      notify('No hay oro suficiente para reclutar.', 'Not enough gold to recruit.')
      return
    }
    const available = POKEST_HERO_DEFS.filter((def) => !save.roster.some((hero) => hero.defId === def.id))
    const pool = available.length > 0 ? available : POKEST_HERO_DEFS
    const def = pool[Math.floor(Math.random() * pool.length)]
    const hero = createHero(def.id)
    playPurchase()
    setSave((prev) => ({
      ...prev,
      gold: prev.gold - POKEST_RECRUIT_COST,
      roster: [...prev.roster, hero],
      teamIds: prev.teamIds.length < POKEST_MAX_TEAM ? [...prev.teamIds, hero.instanceId] : prev.teamIds,
      lastMessage: L(language, `${hero.name} se une al pueblo.`, `${hero.name} joins the town.`),
      lastMessageEn: `${hero.name} joins the town.`,
    }))
  }

  const upgradeHero = (id: string, type: 'weapon' | 'armor'): void => {
    const hero = save.roster.find((item) => item.instanceId === id)
    if (!hero) return
    const level = type === 'weapon' ? hero.weaponLevel : hero.armorLevel
    if (level >= POKEST_MAX_UPGRADE) {
      playError()
      notify('La mejora ya está al máximo.', 'This upgrade is already maxed.')
      return
    }
    const cost = type === 'weapon' ? 30 + level * 20 : 25 + level * 20
    if (save.gold < cost) {
      playError()
      notify('No hay oro suficiente para la mejora.', 'Not enough gold for the upgrade.')
      return
    }
    playPurchase()
    setSave((prev) => ({
      ...prev,
      gold: prev.gold - cost,
      roster: prev.roster.map((item) => {
        if (item.instanceId !== id) return item
        if (type === 'weapon') return { ...item, weaponLevel: item.weaponLevel + 1, atk: item.atk + 3 }
        return { ...item, armorLevel: item.armorLevel + 1, def: item.def + 2 }
      }),
      lastMessage: L(language, `${hero.name} recibe una mejora de ${type === 'weapon' ? 'arma' : 'armadura'}.`, `${hero.name} receives a ${type === 'weapon' ? 'weapon' : 'armor'} upgrade.`),
      lastMessageEn: `${hero.name} receives a ${type === 'weapon' ? 'weapon' : 'armor'} upgrade.`,
    }))
  }

  const treatQuirk = (id: string): void => {
    const hero = save.roster.find((item) => item.instanceId === id)
    if (!hero) return
    const negative = hero.quirks.find((quirkId) => !getQuirk(quirkId)?.positive)
    if (!negative) {
      playError()
      notify('Este Pokémon no tiene secuelas negativas.', 'This Pokémon has no negative quirks.')
      return
    }
    if (save.gold < POKEST_QUIRK_COST) {
      playError()
      notify('No hay oro suficiente para el sanatorio.', 'Not enough gold for the sanatorium.')
      return
    }
    playPurchase()
    setSave((prev) => ({
      ...prev,
      gold: prev.gold - POKEST_QUIRK_COST,
      roster: prev.roster.map((item) => item.instanceId === id
        ? { ...item, quirks: item.quirks.filter((quirkId) => quirkId !== negative) }
        : item),
      lastMessage: L(language, `${hero.name} recibe tratamiento en el sanatorio.`, `${hero.name} receives treatment at the sanatorium.`),
      lastMessageEn: `${hero.name} receives treatment at the sanatorium.`,
    }))
  }

  const trainHero = (id: string): void => {
    const hero = save.roster.find((item) => item.instanceId === id)
    if (!hero) return
    if (save.gold < POKEST_TRAIN_COST) {
      playError()
      notify('No hay oro suficiente para entrenar.', 'Not enough gold to train.')
      return
    }
    playPurchase()
    setSave((prev) => ({
      ...prev,
      gold: prev.gold - POKEST_TRAIN_COST,
      roster: prev.roster.map((item) => {
        if (item.instanceId !== id) return item
        const next = { ...item, quirks: [...item.quirks] }
        engine.trainHero(next, 30)
        return next
      }),
      lastMessage: L(language, `${hero.name} entrena en el Gremio.`, `${hero.name} trains at the Guild.`),
      lastMessageEn: `${hero.name} trains at the Guild.`,
    }))
  }

  const openTownPanel = (panel: TownPanel): void => {
    playClick()
    setTownPanel(panel)
  }

  const closeTownPanel = (): void => {
    playClick()
    setTownPanel(null)
  }

  const toggleTeam = (id: string): void => {
    if (save.teamIds.includes(id)) {
      playClick()
      setSave((prev) => ({ ...prev, teamIds: prev.teamIds.filter((heroId) => heroId !== id) }))
      return
    }
    if (save.teamIds.length >= POKEST_MAX_TEAM) {
      playError()
      notify('Solo puedes llevar 4 Pokémon.', 'You can only take 4 Pokémon.')
      return
    }
    playClick()
    setSave((prev) => ({ ...prev, teamIds: [...prev.teamIds, id] }))
  }

  const moveTeam = (id: string, direction: -1 | 1): void => {
    playClick()
    setSave((prev) => {
      const index = prev.teamIds.indexOf(id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= prev.teamIds.length) return prev
      const next = [...prev.teamIds]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, teamIds: next }
    })
  }

  const startExpedition = (): void => {
    if (!canStart) {
      playError()
      notify('Selecciona al menos un Pokémon y una dungeon desbloqueada.', 'Select at least one Pokémon and an unlocked dungeon.')
      return
    }
    playClick()
    setTownPanel(null)
    const run = engine.startRun(save, selectedDungeon, save.teamIds)
    setSave((prev) => ({
      ...prev,
      activeRun: run,
      lastMessage: L(language, 'La expedición ha comenzado.', 'The expedition has begun.'),
      lastMessageEn: 'The expedition has begun.',
    }))
  }

  const finishRun = (outcome: PokestRunOutcome): void => {
    playClick()
    setPendingSkillId(null)
    setSave((prev) => (prev.activeRun ? settleRun(prev, prev.activeRun, outcome) : prev))
  }

  const exit = (): void => {
    playClick()
    startMenuMusic()
    onExit()
  }

  const currentUnit = save.activeRun ? engine.getCurrentCombatant(save.activeRun) : undefined
  const pendingSkill = save.activeRun && currentUnit
    ? currentUnit.skills.find((skill) => skill.id === pendingSkillId)
    : undefined
  const targetIds = save.activeRun && currentUnit && pendingSkill
    ? new Set(engine.getTargetCandidates(save.activeRun, currentUnit, pendingSkill).map((unit) => unit.instanceId))
    : new Set<string>()

  const executeSkill = (skillId: string, targetId?: string): void => {
    if (!save.activeRun || !currentUnit) return
    playHit()
    updateRun((run) => {
      engine.useHeroSkill(run, currentUnit.instanceId, skillId, targetId)
    })
    setPendingSkillId(null)
  }

  const selectSkill = (skill: PokestSkill): void => {
    if (!currentUnit) return
    playClick()
    if (skill.target === 'enemy' || skill.target === 'ally') {
      setPendingSkillId(skill.id)
      return
    }
    executeSkill(skill.id)
  }

  const handleUnitClick = (unit: PokestHero): void => {
    if (!save.activeRun || !currentUnit || !pendingSkill) return
    if (!targetIds.has(unit.instanceId)) {
      playError()
      return
    }
    executeSkill(pendingSkill.id, unit.instanceId)
  }

  const renderPartyRows = () => (
    <div className="pokest-party-list">
      {teamHeroes.length === 0 && <p className="pokest-empty">{L(language, 'Ningún Pokémon seleccionado.', 'No Pokémon selected.')}</p>}
      {teamHeroes.map((hero, index) => (
        <div className="pokest-party-row" key={hero.instanceId}>
          <span className="pokest-party-rank">{index + 1}</span>
          <DungeonPortrait id={hero.defId} emotion={portraitEmotion(hero)} className="pokest-party-portrait" alt="" />
          <span className="pokest-party-copy">
            <strong>{hero.name}</strong>
            <small>{roleLabel(hero.role, language)} · Nv. {hero.level}</small>
          </span>
          <span className="pokest-party-arrows">
            <button type="button" onClick={() => moveTeam(hero.instanceId, -1)} disabled={index === 0} aria-label={L(language, 'Subir rango', 'Move up')}>↑</button>
            <button type="button" onClick={() => moveTeam(hero.instanceId, 1)} disabled={index === teamHeroes.length - 1} aria-label={L(language, 'Bajar rango', 'Move down')}>↓</button>
          </span>
        </div>
      ))}
    </div>
  )

  const renderTownPanelContent = () => {
    if (!townPanel) return null

    if (townPanel === 'roster') {
      return (
        <>
          <div className="pokest-town-panel-section">
            <div className="pokest-section-head">
              <div>
                <span className="pokest-eyebrow">{L(language, 'ROSTER', 'ROSTER')}</span>
                <h3>{L(language, 'Tu roster', 'Your roster')}</h3>
              </div>
              <span className="pokest-counter">{save.roster.length}/{POKEST_MAX_ROSTER}</span>
            </div>
            <p className="pokest-section-copy">
              {L(language, 'Elige hasta 4 Pokémon. El orden marca su rango en combate. La muerte es permanente.', 'Choose up to 4 Pokémon. Their order sets their combat rank. Death is permanent.')}
            </p>
            <div className="pokest-roster-grid">
              {save.roster.map((hero) => {
                const teamIndex = save.teamIds.indexOf(hero.instanceId)
                return (
                  <UnitCard
                    key={hero.instanceId}
                    unit={hero}
                    language={language}
                    isEnemy={false}
                    selected={teamIndex >= 0}
                    rankOverride={teamIndex >= 0 ? teamIndex + 1 : '—'}
                    onClick={() => toggleTeam(hero.instanceId)}
                  />
                )
              })}
            </div>
          </div>
          <div className="pokest-town-panel-section">
            <div className="pokest-section-head">
              <div>
                <span className="pokest-eyebrow">{L(language, 'GRUPO', 'PARTY')}</span>
                <h3>{L(language, 'Orden de combate', 'Combat order')}</h3>
              </div>
              <span className="pokest-counter">{teamHeroes.length}/{POKEST_MAX_TEAM}</span>
            </div>
            {renderPartyRows()}
          </div>
        </>
      )
    }

    if (townPanel === 'abbey') {
      return (
        <>
          <div className="pokest-town-panel-section">
            <p className="pokest-section-copy">
              {L(language, 'La Abadía calma los nervios y cura las heridas. También retira aflicciones y virtudes antes de la próxima expedición.', 'The Abbey soothes nerves and heals wounds. It also removes afflictions and virtues before the next expedition.')}
            </p>
            <button type="button" className="pokest-primary" onClick={rest} disabled={save.gold < POKEST_REST_COST}>
              ⛪ {L(language, 'Descansar', 'Rest')} · {POKEST_REST_COST} 🪙
            </button>
          </div>
          <div className="pokest-town-panel-section">
            <span className="pokest-eyebrow">{L(language, 'ESTADO DEL ROSTER', 'ROSTER STATUS')}</span>
            <div className="pokest-town-panel-list">
              {save.roster.map((hero) => (
                <div className="pokest-town-roster-row" key={hero.instanceId}>
                  <DungeonPortrait id={hero.defId} emotion={portraitEmotion(hero)} className="pokest-town-row-portrait" alt="" />
                  <span className="pokest-town-row-copy">
                    <strong>{hero.name}</strong>
                    <small>{roleLabel(hero.role, language)} · Nv. {hero.level}</small>
                  </span>
                  <span className="pokest-town-row-bars">
                    <Bar value={hero.hp} max={hero.maxHp} kind="hp" />
                    <Bar value={hero.stress} max={hero.maxStress} kind="stress" />
                  </span>
                  <span className="pokest-town-row-values">{Math.max(0, Math.round(hero.hp))}/{hero.maxHp} · {Math.round(hero.stress)}/200</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )
    }

    if (townPanel === 'stagecoach') {
      return (
        <div className="pokest-town-panel-section">
          <p className="pokest-section-copy">
            {L(language, 'La Caravana trae nuevos Pokémon al pueblo. Cuantos más tengas, más opciones para formar el equipo.', 'The Stagecoach brings new Pokémon to town. The more you have, the more options to build your team.')}
          </p>
          <button
            type="button"
            className="pokest-primary"
            onClick={recruit}
            disabled={save.gold < POKEST_RECRUIT_COST || save.roster.length >= POKEST_MAX_ROSTER}
          >
            🐴 {L(language, 'Reclutar', 'Recruit')} · {POKEST_RECRUIT_COST} 🪙
          </button>
          <p className="pokest-empty">{L(language, 'Roster', 'Roster')} {save.roster.length}/{POKEST_MAX_ROSTER}</p>
        </div>
      )
    }

    if (townPanel === 'blacksmith') {
      return (
        <div className="pokest-town-panel-section">
          <p className="pokest-section-copy">
            {L(language, 'Mejora el arma y la armadura de cada Pokémon. Cada pieza tiene 5 niveles.', 'Upgrade each Pokémon’s weapon and armor. Each piece has 5 levels.')}
          </p>
          <div className="pokest-smith-list">
            {save.roster.map((hero) => {
              const weaponCost = 30 + hero.weaponLevel * 20
              const armorCost = 25 + hero.armorLevel * 20
              return (
                <div className="pokest-smith-row" key={hero.instanceId}>
                  <span className="pokest-smith-copy">
                    <strong>{hero.name}</strong>
                    <small>⚔️ {hero.weaponLevel}/{POKEST_MAX_UPGRADE} · 🛡️ {hero.armorLevel}/{POKEST_MAX_UPGRADE}</small>
                  </span>
                  <span className="pokest-smith-actions">
                    <button
                      type="button"
                      onClick={() => upgradeHero(hero.instanceId, 'weapon')}
                      disabled={save.gold < weaponCost || hero.weaponLevel >= POKEST_MAX_UPGRADE}
                      title={L(language, '+3 ATK', '+3 ATK')}
                    >
                      ⚔️ +3 · {weaponCost}
                    </button>
                    <button
                      type="button"
                      onClick={() => upgradeHero(hero.instanceId, 'armor')}
                      disabled={save.gold < armorCost || hero.armorLevel >= POKEST_MAX_UPGRADE}
                      title={L(language, '+2 DEF', '+2 DEF')}
                    >
                      🛡️ +2 · {armorCost}
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    if (townPanel === 'sanatorium') {
      return (
        <div className="pokest-town-panel-section">
          <p className="pokest-section-copy">
            {L(language, 'El Sanatorio retira una secuela negativa por tratamiento.', 'The Sanatorium removes one negative quirk per treatment.')}
          </p>
          {save.roster.some((hero) => hero.quirks.some((quirkId) => !getQuirk(quirkId)?.positive)) ? (
            <div className="pokest-sanatorium-list">
              {save.roster.map((hero) => {
                const negative = hero.quirks.find((quirkId) => !getQuirk(quirkId)?.positive)
                if (!negative) return null
                const quirk = getQuirk(negative)
                return (
                  <div className="pokest-sanatorium-row" key={hero.instanceId}>
                    <span className="pokest-sanatorium-copy">
                      <strong>{hero.name}</strong>
                      <small>{language === 'en' ? quirk?.nameEn : quirk?.name} — {language === 'en' ? quirk?.descEn : quirk?.desc}</small>
                    </span>
                    <button type="button" onClick={() => treatQuirk(hero.instanceId)} disabled={save.gold < POKEST_QUIRK_COST}>
                      🧪 {POKEST_QUIRK_COST}
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="pokest-empty">{L(language, 'No hay secuelas negativas que tratar.', 'No negative quirks to treat.')}</p>
          )}
        </div>
      )
    }

    if (townPanel === 'guild') {
      return (
        <div className="pokest-town-panel-section">
          <p className="pokest-section-copy">
            {L(language, 'El Gremio entrena a los héroes y les otorga experiencia para subir de nivel.', 'The Guild trains heroes and grants experience to level up.')}
          </p>
          <div className="pokest-smith-list">
            {save.roster.map((hero) => (
              <div className="pokest-smith-row" key={hero.instanceId}>
                <span className="pokest-smith-copy">
                  <strong>{hero.name}</strong>
                  <small>Nv. {hero.level} · XP {hero.xp}/{hero.level * 30}</small>
                </span>
                <span className="pokest-smith-actions">
                  <button type="button" onClick={() => trainHero(hero.instanceId)} disabled={save.gold < POKEST_TRAIN_COST}>
                    📜 +30 XP · {POKEST_TRAIN_COST}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (townPanel === 'expedition') {
      return (
        <>
          <div className="pokest-town-panel-section">
            <span className="pokest-eyebrow">{L(language, 'DUNGEONS', 'DUNGEONS')}</span>
            <h3>{L(language, 'Elige tu descenso', 'Choose your descent')}</h3>
            <div className="pokest-dungeon-list">
              {Object.values(POKEST_DUNGEONS).map((dungeon) => {
                const unlocked = save.unlockedDungeons.includes(dungeon.id)
                const cleared = save.clearedDungeons.includes(dungeon.id)
                const selected = selectedDungeon === dungeon.id
                return (
                  <button
                    key={dungeon.id}
                    type="button"
                    className={`pokest-dungeon-card${selected ? ' is-selected' : ''}${!unlocked ? ' is-locked' : ''}`}
                    onClick={() => {
                      if (!unlocked) {
                        playError()
                        return
                      }
                      playClick()
                      setSelectedDungeon(dungeon.id)
                    }}
                    disabled={!unlocked}
                  >
                    <span className="pokest-dungeon-icon">{dungeon.icon}</span>
                    <span className="pokest-dungeon-copy">
                      <strong>{language === 'en' ? dungeon.nameEn : dungeon.name}</strong>
                      <small>{language === 'en' ? dungeon.descEn : dungeon.desc}</small>
                      <em>{dungeon.length} {L(language, 'salas', 'rooms')} · Nv. {dungeon.level} · {dungeon.reward} 🪙</em>
                    </span>
                    {!unlocked && <span className="pokest-lock">🔒</span>}
                    {cleared && <span className="pokest-cleared">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="pokest-town-panel-section">
            <div className="pokest-section-head">
              <div>
                <span className="pokest-eyebrow">{L(language, 'GRUPO', 'PARTY')}</span>
                <h3>{L(language, 'Tu grupo', 'Your party')}</h3>
              </div>
              <span className="pokest-counter">{teamHeroes.length}/{POKEST_MAX_TEAM}</span>
            </div>
            {renderPartyRows()}
          </div>

          <button type="button" className="pokest-primary pokest-start" onClick={startExpedition} disabled={!canStart}>
            ⚔️ {L(language, 'Entrar en la dungeon', 'Enter the dungeon')}
          </button>
          {save.lastMessage && (
            <p className="pokest-town-message">{language === 'en' ? save.lastMessageEn ?? save.lastMessage : save.lastMessage}</p>
          )}
        </>
      )
    }

    return null
  }

  const renderTownPanel = () => {
    if (!townPanel) return null
    const panelTitles: Record<Exclude<TownPanel, null>, { icon: string; title: string; subtitle: string }> = {
      roster: { icon: '📋', title: L(language, 'Tu roster', 'Your roster'), subtitle: L(language, 'Elige hasta 4 Pokémon', 'Choose up to 4 Pokémon') },
      abbey: { icon: '⛪', title: L(language, 'Abadía', 'Abbey'), subtitle: L(language, 'Descanso y recuperación', 'Rest and recovery') },
      stagecoach: { icon: '🐴', title: L(language, 'Caravana', 'Stagecoach'), subtitle: L(language, 'Reclutar héroes', 'Recruit heroes') },
      blacksmith: { icon: '⚒️', title: L(language, 'Herrería', 'Blacksmith'), subtitle: L(language, 'Forja y armadura', 'Forge and armor') },
      sanatorium: { icon: '🧪', title: L(language, 'Sanatorio', 'Sanatorium'), subtitle: L(language, 'Tratar secuelas', 'Treat quirks') },
      guild: { icon: '📜', title: L(language, 'Gremio', 'Guild'), subtitle: L(language, 'Entrenar nivel', 'Train level') },
      expedition: { icon: '⚔️', title: L(language, 'Expedición', 'Expedition'), subtitle: L(language, 'Elige tu descenso', 'Choose your descent') },
    }
    const info = panelTitles[townPanel]
    return (
      <div className="pokest-town-panel-backdrop" onClick={closeTownPanel}>
        <div className="pokest-town-panel" onClick={(event) => event.stopPropagation()}>
          <div className="pokest-town-panel-head">
            <div>
              <span className="pokest-eyebrow">{info.icon} {info.subtitle}</span>
              <h2>{info.title}</h2>
            </div>
            <button type="button" className="pokest-town-panel-close" onClick={closeTownPanel}>✕</button>
          </div>
          <div className="pokest-town-panel-body">{renderTownPanelContent()}</div>
        </div>
      </div>
    )
  }

  const renderTown = () => {
    const buildings: Array<{ id: TownBuildingId; icon: string; name: string; desc: string }> = [
      { id: 'abbey', icon: '⛪', name: L(language, 'Abadía', 'Abbey'), desc: L(language, 'Descanso y estrés', 'Rest and stress') },
      { id: 'stagecoach', icon: '🐴', name: L(language, 'Caravana', 'Stagecoach'), desc: L(language, 'Reclutar héroes', 'Recruit heroes') },
      { id: 'expedition', icon: '⚔️', name: L(language, 'Expedición', 'Expedition'), desc: L(language, 'Entrar en la dungeon', 'Enter the dungeon') },
      { id: 'blacksmith', icon: '⚒️', name: L(language, 'Herrería', 'Blacksmith'), desc: L(language, 'Armas y armaduras', 'Weapons and armor') },
      { id: 'sanatorium', icon: '🧪', name: L(language, 'Sanatorio', 'Sanatorium'), desc: L(language, 'Tratar secuelas', 'Treat quirks') },
      { id: 'guild', icon: '📜', name: L(language, 'Gremio', 'Guild'), desc: L(language, 'Entrenar nivel', 'Train level') },
    ]
    return (
      <div className="pokest-town-hub">
        <div className="pokest-town-scene">
          <div className="pokest-town-sky" />
          <div className="pokest-town-moon" />
          <div className="pokest-town-hills" />
          <div className="pokest-town-tree is-left" style={{ backgroundImage: `url(${treeUrl})` }} />
          <div className="pokest-town-tree is-right" style={{ backgroundImage: `url(${treeUrl})` }} />
          <div className="pokest-town-road" />
          <div className="pokest-town-fog" />
          <div className="pokest-town-title">
            <span className="pokest-eyebrow">{L(language, 'EL PUEBLO', 'THE TOWN')}</span>
            <h2>{L(language, '¿A dónde quieres ir?', 'Where will you go?')}</h2>
            <p>{L(language, 'Elige un edificio para preparar la próxima expedición.', 'Choose a building to prepare the next expedition.')}</p>
          </div>
          <div className="pokest-town-buildings">
            {buildings.map((building) => (
              <button
                key={building.id}
                type="button"
                className={`pokest-town-building is-${building.id}`}
                onClick={() => openTownPanel(building.id)}
              >
                <span className="pokest-town-building-icon">{building.icon}</span>
                <strong>{building.name}</strong>
                <small>{building.desc}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="pokest-town-bottom">
          <div className="pokest-town-party-strip">
            <span className="pokest-eyebrow">{L(language, 'TU GRUPO', 'YOUR PARTY')}</span>
            {teamHeroes.length === 0 && <span className="pokest-empty">{L(language, 'Sin grupo', 'No party')}</span>}
            {teamHeroes.map((hero, index) => (
              <button
                key={hero.instanceId}
                type="button"
                className="pokest-town-party-slot"
                onClick={() => openTownPanel('roster')}
                title={hero.name}
              >
                <DungeonPortrait id={hero.defId} emotion={portraitEmotion(hero)} className="pokest-town-party-portrait" alt={hero.name} />
                <span className="pokest-town-party-rank">{index + 1}</span>
              </button>
            ))}
            <button type="button" className="pokest-town-roster-btn" onClick={() => openTownPanel('roster')}>
              📋 {L(language, 'Roster', 'Roster')} {save.roster.length}/{POKEST_MAX_ROSTER}
            </button>
          </div>
          <div className="pokest-town-bottom-message">
            {save.lastMessage
              ? (language === 'en' ? save.lastMessageEn ?? save.lastMessage : save.lastMessage)
              : L(language, 'El pueblo espera.', 'The town waits.')}
          </div>
          <div className="pokest-town-gold">🪙 {save.gold}</div>
        </div>

        {townPanel && renderTownPanel()}
      </div>
    )
  }

  const renderBattle = (run: PokestRunState) => {
    const dungeon = getDungeon(run.dungeonId)
    const torchLevel = engine.getTorchLevel(run.torch)
    const current = engine.getCurrentCombatant(run)
    const skill = current && !current.isEnemy
      ? current.skills.find((item) => item.id === pendingSkillId)
      : undefined
    const selectedHero = run.party.find((hero) => hero.instanceId === selectedHeroId && hero.alive)
      ?? (current && !current.isEnemy ? current : undefined)
      ?? run.party.find((hero) => hero.alive)
      ?? run.party[0]
    const heroTurn = Boolean(current && !current.isEnemy && current.alive)
    const affliction = selectedHero ? getAffliction(selectedHero.affliction) : undefined
    const virtue = selectedHero ? getVirtue(selectedHero.virtue) : undefined
    const mapPositions = [
      { col: 1, row: 2 }, { col: 2, row: 2 }, { col: 3, row: 1 }, { col: 4, row: 2 },
      { col: 5, row: 1 }, { col: 6, row: 2 }, { col: 7, row: 1 }, { col: 8, row: 2 },
    ]
    const style = {
      '--pd-accent': dungeon.palette.accent,
      '--pd-glow': dungeon.palette.glow,
      '--pd-fog': dungeon.palette.fog,
      '--pd-bg': dungeon.palette.bg,
    } as CSSProperties

    return (
      <div className="pokest-battle-view" style={style}>
        <div className="pokest-battle-scene">
          <div className="pokest-scene-sky" />
          <div className="pokest-scene-tree is-left" style={{ backgroundImage: `url(${treeUrl})` }} />
          <div className="pokest-scene-tree is-right" style={{ backgroundImage: `url(${treeUrl})` }} />
          <div className="pokest-scene-crypt">
            <div className="pokest-scene-arch" />
            <div className="pokest-scene-door" />
            <div className="pokest-scene-brazier is-left"><i /></div>
            <div className="pokest-scene-brazier is-right"><i /></div>
          </div>
          <div className="pokest-scene-floor" />
          <div className="pokest-scene-fog" />

          <div className="pokest-battle-topbar">
            <span>{dungeon.icon} {language === 'en' ? dungeon.nameEn : dungeon.name} · {L(language, 'Ronda', 'Round')} {run.round}</span>
            <span>🪙 {run.gold}</span>
            <span>🔥 {engine.torchLabel(torchLevel, language)}</span>
            <span className="pokest-battle-topbar-spacer" />
            <button type="button" onClick={() => { playClick(); updateRun(engine.retreatRun) }}>{L(language, 'Retirarse', 'Retreat')}</button>
            <button type="button" onClick={exit}>{L(language, 'Salir', 'Exit')}</button>
          </div>

          {(run.narrator || run.narratorEn) && (
            <div className="pokest-speech-bubble">
              “{language === 'en' ? run.narratorEn : run.narrator}”
            </div>
          )}

          <div className="pokest-battle-party">
            {[...run.party].sort((a, b) => b.rank - a.rank).map((hero) => (
              <BattleUnit
                key={hero.instanceId}
                unit={hero}
                language={language}
                side="hero"
                current={current?.instanceId === hero.instanceId}
                selected={selectedHero?.instanceId === hero.instanceId}
                targetable={Boolean(skill && skill.target === 'ally' && targetIds.has(hero.instanceId))}
                onClick={skill && skill.target === 'ally' ? () => handleUnitClick(hero) : undefined}
              />
            ))}
          </div>

          <div className="pokest-battle-enemies">
            {[...run.enemies].sort((a, b) => a.rank - b.rank).map((enemy) => (
              <BattleUnit
                key={enemy.instanceId}
                unit={enemy}
                language={language}
                side="enemy"
                current={current?.instanceId === enemy.instanceId}
                targetable={Boolean(skill && skill.target === 'enemy' && targetIds.has(enemy.instanceId))}
                onClick={skill && skill.target === 'enemy' ? () => handleUnitClick(enemy) : undefined}
              />
            ))}
          </div>

          {skill && (
            <div className="pokest-target-hint pokest-target-hint--battle">
              <span>{L(language, 'Selecciona un objetivo para', 'Select a target for')} <strong>{language === 'en' ? skill.nameEn : skill.name}</strong></span>
              <button type="button" onClick={() => setPendingSkillId(null)}>{L(language, 'Cancelar', 'Cancel')}</button>
            </div>
          )}

          {!heroTurn && current && (
            <div className="pokest-battle-enemy-turn">
              <span className="pokest-pulse-dot" />
              {L(language, 'Turno enemigo:', 'Enemy turn:')} {current.name}
            </div>
          )}

        </div>

        <div className="pokest-hud">
          <div className="pokest-hud-top">
            {[...run.party].sort((a, b) => a.rank - b.rank).map((hero) => (
              <HudPartySlot
                key={hero.instanceId}
                hero={hero}
                language={language}
                active={current?.instanceId === hero.instanceId}
                selected={selectedHero?.instanceId === hero.instanceId}
                onClick={() => { playClick(); setSelectedHeroId(hero.instanceId) }}
              />
            ))}
            <div className="pokest-hud-top-actions">
              <span>
                {heroTurn && current
                  ? `${L(language, 'Turno de', 'Turn of')} ${current.name}`
                  : current
                    ? `${L(language, 'Turno enemigo', 'Enemy turn')}: ${current.name}`
                    : ''}
              </span>
              <button type="button" onClick={() => { playClick(); setShowCombatLog((value) => !value) }}>
                📜 {L(language, 'Diario', 'Journal')}
              </button>
            </div>
          </div>

          <div className="pokest-hud-body">
            <div className="pokest-hud-hero">
              {selectedHero && (
                <>
                  <div className="pokest-hud-hero-head">
                    <DungeonPortrait id={selectedHero.defId} emotion={portraitEmotion(selectedHero)} className="pokest-hud-portrait" alt="" />
                    <div className="pokest-hud-hero-id">
                      <span className="pokest-hud-eyebrow">{roleLabel(selectedHero.role, language)}</span>
                      <strong>{selectedHero.name}</strong>
                      <span>Nv. {selectedHero.level} · {L(language, 'Rango', 'Rank')} {selectedHero.rank}</span>
                      <span className="pokest-hud-hero-bars">
                        <Bar value={selectedHero.hp} max={selectedHero.maxHp} kind="hp" />
                        <Bar value={selectedHero.stress} max={selectedHero.maxStress} kind="stress" />
                      </span>
                      <span className="pokest-hud-hp-text">
                        {Math.max(0, Math.round(selectedHero.hp))}/{selectedHero.maxHp} · {Math.round(selectedHero.stress)}/200
                      </span>
                    </div>
                  </div>
                  <div className="pokest-hud-stats">
                    <span>ATK {selectedHero.atk}</span>
                    <span>DEF {selectedHero.def}</span>
                    <span>SPD {selectedHero.spd}</span>
                    <span>EST {selectedHero.stressResist}%</span>
                  </div>
                  {(affliction || virtue) && (
                    <div className={`pokest-hud-affliction${virtue ? ' is-virtue' : ''}`}>
                      {virtue ? (language === 'en' ? virtue.nameEn : virtue.name) : (language === 'en' ? affliction?.nameEn : affliction?.name)}
                    </div>
                  )}
                  {(selectedHero.quirks?.length ?? 0) > 0 && (
                    <div className="pokest-hud-quirks">
                      {(selectedHero.quirks ?? []).map((id) => {
                        const quirk = getQuirk(id)
                        if (!quirk) return null
                        return (
                          <span key={quirk.id} className={quirk.positive ? 'is-positive' : 'is-negative'}>
                            {language === 'en' ? quirk.nameEn : quirk.name}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <div className="pokest-hud-move">
                    <button
                      type="button"
                      onClick={() => { playClick(); updateRun((state) => { engine.moveHero(state, selectedHero.instanceId, 1) }) }}
                      disabled={!heroTurn || !engine.canMoveHero(run, selectedHero, 1)}
                      title={L(language, 'Retroceder un rango', 'Move back one rank')}
                    >
                      ◀ {L(language, 'Retroceder', 'Retreat')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { playClick(); updateRun((state) => { engine.moveHero(state, selectedHero.instanceId, -1) }) }}
                      disabled={!heroTurn || !engine.canMoveHero(run, selectedHero, -1)}
                      title={L(language, 'Avanzar un rango', 'Move forward one rank')}
                    >
                      {L(language, 'Avanzar', 'Advance')} ▶
                    </button>
                  </div>
                  <div className="pokest-hud-skills">
                    {selectedHero.skills.map((item) => (
                      <HudSkillButton
                        key={item.id}
                        skill={item}
                        hero={selectedHero}
                        run={run}
                        language={language}
                        onClick={() => selectSkill(item)}
                      />
                    ))}
                    <button
                      type="button"
                      className="pokest-hud-skill pokest-hud-skill--pass"
                      onClick={() => { playClick(); setPendingSkillId(null); updateRun(engine.passTurn) }}
                      disabled={!heroTurn}
                    >
                      <span className="pokest-hud-skill-icon">…</span>
                      <span className="pokest-hud-skill-name">{L(language, 'Esperar', 'Wait')}</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="pokest-hud-map">
              <div className="pokest-hud-map-head">
                <span>{L(language, 'MAPA', 'MAP')}</span>
                <span>{Math.min(run.currentNode + 1, run.nodes.length)}/{run.nodes.length}</span>
              </div>
              <div className="pokest-hud-map-grid">
                {run.nodes.map((node, index) => {
                  const position = mapPositions[index % mapPositions.length]
                  const state = node.done ? 'done' : index === run.currentNode ? 'current' : index < run.currentNode ? 'past' : 'future'
                  return (
                    <div
                      key={node.id}
                      className={`pokest-hud-map-node is-${state}`}
                      style={{ gridColumn: position.col, gridRow: position.row }}
                    >
                      <span>{POKEST_NODE_LABELS[node.type].icon}</span>
                      <small>{engine.getNodeLabel(node.type, language)}</small>
                    </div>
                  )
                })}
              </div>
              <div className="pokest-hud-torch">
                <span className="pokest-hud-torch-icon">🔥</span>
                <span className="pokest-hud-torch-track">
                  <i style={{ height: `${pct(run.torch, run.maxTorch)}%` }} />
                </span>
                <span>{Math.round(run.torch)}</span>
              </div>
              {showCombatLog && (
                <div className="pokest-hud-log">
                  <div className="pokest-hud-log-head">
                    <span>{L(language, 'Diario', 'Journal')}</span>
                    <button type="button" onClick={() => setShowCombatLog(false)}>✕</button>
                  </div>
                  <div className="pokest-hud-log-scroll" ref={logRef}>
                    {run.log.map((line, index) => (
                      <p key={`${index}-${line}`}>{line}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderPhase = (run: PokestRunState) => {
    if (run.phase === 'combat') return null

    if (run.phase === 'map') {
      const node = run.nodes[run.currentNode]
      if (!node) return null
      return (
        <div className="pokest-phase-card">
          <span className="pokest-eyebrow">{L(language, 'SALA', 'ROOM')} {run.currentNode + 1}/{run.nodes.length}</span>
          <h3>{engine.getNodeLabel(node.type, language)}</h3>
          <p>{nodeDescription(node.type, language)}</p>
          <div className="pokest-node-reward">
            <span>🔥 -{node.type === 'boss' ? 15 : 8} {L(language, 'antorcha', 'torch')}</span>
            <span>🪙 {run.gold}</span>
          </div>
          <button type="button" className="pokest-primary" onClick={() => { playClick(); updateRun(engine.enterNode) }}>
            {L(language, 'Avanzar', 'Advance')}
          </button>
        </div>
      )
    }

    if (run.phase === 'event') {
      const event = getEvent(run.eventId)
      if (!event) return null
      return (
        <div className="pokest-phase-card pokest-event-card">
          <span className="pokest-eyebrow">{L(language, 'EVENTO', 'EVENT')}</span>
          <h3>{language === 'en' ? event.titleEn : event.title}</h3>
          <p>{language === 'en' ? event.descEn : event.desc}</p>
          <div className="pokest-event-options">
            {event.options.map((option) => {
              const disabled = !engine.canChooseEventOption(run, option)
              const req = option.requires
              return (
                <button
                  key={option.id}
                  type="button"
                  className="pokest-event-option"
                  disabled={disabled}
                  onClick={() => {
                    playClick()
                    updateRun((state) => { engine.applyEventOption(state, option.id) })
                  }}
                >
                  <strong>{language === 'en' ? option.labelEn : option.label}</strong>
                  <span>{language === 'en' ? option.descEn : option.desc}</span>
                  {req && (
                    <em>
                      {req.gold ? `🪙 ${req.gold} ` : ''}
                      {req.food ? `🍖 ${req.food} ` : ''}
                      {req.torch ? `🔥 ${req.torch} ` : ''}
                      {req.bandage ? `🩹 ${req.bandage}` : ''}
                    </em>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    if (run.phase === 'camp') {
      const actions = [
        { id: 'eat', icon: '🍖', label: L(language, 'Compartir ración', 'Share a ration'), desc: L(language, 'Cura un 25% del PS máximo y reduce 15 de estrés.', 'Heals 25% max HP and reduces 15 stress.'), disabled: run.provisions.food < 1 },
        { id: 'torch', icon: '🔥', label: L(language, 'Encender antorcha', 'Light a torch'), desc: L(language, 'Recupera 35 de antorcha y reduce 5 de estrés.', 'Restores 35 torch and reduces 5 stress.'), disabled: run.provisions.torch < 1 },
        { id: 'bandage', icon: '🩹', label: L(language, 'Vendar heridas', 'Bandage wounds'), desc: L(language, 'Cura 15 PS y elimina sangrado y corrosión.', 'Heals 15 HP and removes bleed and blight.'), disabled: run.provisions.bandage < 1 },
        { id: 'sleep', icon: '🌙', label: L(language, 'Dormir un rato', 'Sleep for a while'), desc: L(language, 'Reduce 20 de estrés. La antorcha baja 10.', 'Reduces 20 stress. Torch drops by 10.'), disabled: false },
      ]
      return (
        <div className="pokest-phase-card">
          <span className="pokest-eyebrow">{L(language, 'CAMPAMENTO', 'CAMP')}</span>
          <h3>{L(language, 'Un breve respiro', 'A brief respite')}</h3>
          <p>{L(language, 'Elige una sola acción antes de continuar.', 'Choose a single action before continuing.')}</p>
          <div className="pokest-camp-grid">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="pokest-camp-option"
                disabled={action.disabled}
                onClick={() => { playClick(); updateRun((state) => { engine.campAction(state, action.id) }) }}
              >
                <span>{action.icon}</span>
                <strong>{action.label}</strong>
                <small>{action.desc}</small>
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (run.phase === 'treasure') {
      return (
        <div className="pokest-phase-card pokest-treasure-card">
          <span className="pokest-treasure-icon">💰</span>
          <h3>{L(language, 'Tesoro', 'Treasure')}</h3>
          <p>{run.lastReward ? (language === 'en' ? run.lastReward.textEn : run.lastReward.text) : L(language, 'Un cofre vacío.', 'An empty chest.')}</p>
          <button type="button" className="pokest-primary" onClick={() => { playCoin(); updateRun(engine.collectTreasure) }}>
            {L(language, 'Recoger y continuar', 'Collect and continue')}
          </button>
        </div>
      )
    }

    if (run.phase === 'combatWon') {
      return (
        <div className="pokest-phase-card pokest-reward-card">
          <span className="pokest-eyebrow">{L(language, 'VICTORIA', 'VICTORY')}</span>
          <h3>{L(language, 'Los enemigos han caído', 'The enemies have fallen')}</h3>
          <p>{run.lastReward ? (language === 'en' ? run.lastReward.textEn : run.lastReward.text) : ''}</p>
          <button type="button" className="pokest-primary" onClick={() => { playClick(); updateRun(engine.completeCombat) }}>
            {L(language, 'Continuar', 'Continue')}
          </button>
        </div>
      )
    }

    if (run.phase === 'victory' || run.phase === 'defeat' || run.phase === 'retreat') {
      const survivors = run.party.filter((hero) => hero.alive)
      const fallen = run.party.filter((hero) => !hero.alive)
      const title = run.phase === 'victory'
        ? L(language, 'Dungeon conquistada', 'Dungeon conquered')
        : run.phase === 'defeat'
          ? L(language, 'La expedición ha fracasado', 'The expedition has failed')
          : L(language, 'Habéis escapado', 'You have escaped')
      return (
        <div className={`pokest-phase-card pokest-summary-card is-${run.phase}`}>
          <span className="pokest-eyebrow">{L(language, 'RESULTADO', 'RESULT')}</span>
          <h3>{title}</h3>
          <p>{L(language, 'Sobrevivientes:', 'Survivors:')} <strong>{survivors.map((hero) => hero.name).join(', ') || '—'}</strong></p>
          {fallen.length > 0 && <p>{L(language, 'Caídos:', 'Fallen:')} <strong>{fallen.map((hero) => hero.name).join(', ')}</strong></p>}
          <p>🪙 {run.gold}{run.phase === 'victory' ? ` + ${getDungeon(run.dungeonId).reward} ${L(language, 'bonus', 'bonus')}` : ''} · {L(language, 'Rondas', 'Rounds')}: {run.round}</p>
          <button type="button" className="pokest-primary" onClick={() => finishRun(run.phase === 'victory' ? 'victory' : run.phase === 'defeat' ? 'defeat' : 'retreat')}>
            {L(language, 'Volver al pueblo', 'Return to town')}
          </button>
        </div>
      )
    }

    return null
  }

  const renderRun = (run: PokestRunState) => {
    if (run.phase === 'combat') return renderBattle(run)
    const dungeon = getDungeon(run.dungeonId)
    const torchLevel = engine.getTorchLevel(run.torch)
    const current = engine.getCurrentCombatant(run)
    const skill = current && !current.isEnemy ? current.skills.find((item) => item.id === pendingSkillId) : undefined
    const style = {
      '--pd-accent': dungeon.palette.accent,
      '--pd-glow': dungeon.palette.glow,
      '--pd-fog': dungeon.palette.fog,
      '--pd-bg': dungeon.palette.bg,
    } as CSSProperties
    return (
      <div className="pokest-run" style={style}>
        <div className="pokest-run-top">
          <div className="pokest-run-title">
            <span className="pokest-eyebrow">{dungeon.icon} {L(language, 'EXPEDICIÓN', 'EXPEDITION')}</span>
            <h2>{language === 'en' ? dungeon.nameEn : dungeon.name}</h2>
          </div>
          <div className={`pokest-torch is-${torchLevel}`}>
            <span>🔥 {engine.torchLabel(torchLevel, language)}</span>
            <Bar value={run.torch} max={run.maxTorch} kind="torch" />
            <small>{Math.round(run.torch)}/{run.maxTorch}</small>
          </div>
          <div className="pokest-run-stats">
            <span>🪙 {run.gold}</span>
            <span>🏚️ {Math.min(run.currentNode + 1, run.nodes.length)}/{run.nodes.length}</span>
            <span>⚔️ {L(language, 'Ronda', 'Round')} {run.round}</span>
          </div>
          <button type="button" className="pokest-retreat" onClick={() => { playClick(); updateRun(engine.retreatRun) }}>
            {L(language, 'Retirarse', 'Retreat')}
          </button>
        </div>

        {(run.narrator || run.narratorEn) && (
          <div className="pokest-narrator">
            “{language === 'en' ? run.narratorEn : run.narrator}”
          </div>
        )}

        <div className="pokest-map-strip">
          {run.nodes.map((node, index) => {
            const state = node.done ? 'done' : index === run.currentNode ? 'current' : index < run.currentNode ? 'past' : 'future'
            return (
              <div key={node.id} className={`pokest-map-node is-${state}`}>
                <span>{POKEST_NODE_LABELS[node.type].icon}</span>
                <small>{engine.getNodeLabel(node.type, language)}</small>
              </div>
            )
          })}
        </div>

        <div className="pokest-run-grid">
          <aside className="pokest-run-party">
            <h3>{L(language, 'Tu grupo', 'Your party')}</h3>
            <div className="pokest-run-party-list">
              {run.party.map((hero) => (
                <UnitCard
                  key={hero.instanceId}
                  unit={hero}
                  language={language}
                  isEnemy={false}
                  compact
                  current={current?.instanceId === hero.instanceId}
                  targetable={Boolean(skill && skill.target === 'ally' && targetIds.has(hero.instanceId))}
                  onClick={skill && skill.target === 'ally' ? () => handleUnitClick(hero) : undefined}
                />
              ))}
            </div>
            <div className="pokest-provisions">
              <span>🍖 {run.provisions.food}</span>
              <span>🔥 {run.provisions.torch}</span>
              <span>🩹 {run.provisions.bandage}</span>
            </div>
          </aside>

          <main className="pokest-run-main">{renderPhase(run)}</main>

          <aside className="pokest-run-log">
            <h3>{L(language, 'Diario', 'Journal')}</h3>
            <div className="pokest-log-scroll" ref={logRef}>
              {run.log.map((line, index) => (
                <p key={`${index}-${line}`}>{line}</p>
              ))}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  const run = save.activeRun
  const combat = run?.phase === 'combat'
  return (
    <div className={`pokest-app${combat ? ' is-combat' : ''}`}>
      <div className="pokest-vignette" aria-hidden="true" />
      {!combat && (
        <header className="pokest-header">
          <div className="pokest-brand">
            <span className="pokest-brand-mark">⚔</span>
            <div>
              <strong>POKEST DUNGEON</strong>
              <span>{L(language, 'Un descenso a la oscuridad', 'A descent into darkness')}</span>
            </div>
          </div>
          <div className="pokest-header-stats">
            <span>🪙 {run ? run.gold : save.gold}</span>
            <span>🧬 {save.roster.length}/{POKEST_MAX_ROSTER}</span>
            <span>🏆 {save.victories}</span>
            <span>💀 {save.fallen}</span>
          </div>
          <button type="button" className="pokest-exit" onClick={exit}>↩ PokeRand</button>
        </header>
      )}

      {run ? renderRun(run) : renderTown()}

      {!combat && (
        <footer className="pokest-credits">
          {L(language, 'Sprites y retratos: PMD SpriteCollab · Pokémon © Nintendo / Creatures / GAME FREAK', 'Sprites and portraits: PMD SpriteCollab · Pokémon © Nintendo / Creatures / GAME FREAK')}
        </footer>
      )}

      {toast && <div className="pokest-toast">{toast}</div>}
    </div>
  )
}
