import type { Move, Pokemon, StatusType } from './types'
import { applyDamage } from './engine'
import { getTypeEffectiveness } from './typesChart'
import type { PvpState, PvpPlayerState } from './pvp'
import { t, moveName, statusAppliedLine, statusLabel, getLanguage } from './i18n'
import { abilityName, weatherName, weatherTypeMultiplier, weatherChipDmg, WEATHER_SETTERS, hasAbility, type WeatherKind } from './pokemonMeta'
import {
  getAbilityMoveImmunity, absorbAbilityMove, getAbilityMoveType, getAbilityStabTypes,
  adjustEffectivenessForAbilities, getAbilityAccuracyMultiplier, getAbilityCritInfo,
  getAbilityPriorityBonus, blocksPriorityMove, getAbilitySpeedMultiplier,
  getAbilityDamageMultiplier, getAbilityStatusImmune, getAbilityStatDropBlocked,
  isIndirectDamageImmune, isWeatherSuppressed, getSleepTick, getBurnDamage,
  applyAbilityOnHit, applyAbilityEntrySelf, applyAbilitySwitchOut,
  applyAbilityEndTurn, isContactMove, isTrappedByAbility,
  adjustAbilityStatChange, applyAbilityStatDropReaction,
} from './abilities'

export interface PvpAction {
  kind: 'move' | 'switch'
  index: number
}

function getStageMultiplier(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage))
  if (s > 0) return (2 + s) / 2
  if (s < 0) return 2 / (2 - s)
  return 1
}

function clonePlayerState(p: PvpPlayerState): PvpPlayerState {
  return JSON.parse(JSON.stringify(p)) as PvpPlayerState
}

// Valida que el índice corresponda a un Pokémon vivo y distinto del activo.
function isValidSwitchTarget(ps: PvpPlayerState, index: number): boolean {
  return (
    index >= 0 &&
    index < ps.team.length &&
    index !== ps.active &&
    ps.team[index].hp > 0
  )
}

// Ejecuta un cambio de Pokémon (limpiando estado/stat stages).
function doSwitch(ps: PvpPlayerState, index: number): boolean {
  if (!isValidSwitchTarget(ps, index)) return false
  const incoming = ps.team[index]
  ps.active = index
  ps.revealed[index] = true
  ps.team[index] = {
    ...incoming,
    hp: Math.max(1, incoming.hp),
    status: undefined,
    statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
  }
  return true
}

// Habilidades al entrar: Intimidación baja el Ataque del rival y los creadores
// de clima establecen el clima. Solo el rival activo se ve afectado (PvP 1vs1).
function applyPvpEntryAbilities(
  entering: Pokemon,
  opponent: Pokemon,
  weather: WeatherKind,
  setWeather: (w: WeatherKind) => void
): { opponentUpdated: Pokemon; logs: string[] } {
  const logs: string[] = []
  let opp = opponent
  const ability = entering.ability
  if (hasAbility(entering, 'intimidate') && opp.hp > 0) {
    const stages = opp.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
    if (hasAbility(opp, 'guard-dog')) {
      if (stages.attack < 6) {
        opp = { ...opp, statStages: { ...stages, attack: Math.min(6, stages.attack + 1) } }
        logs.push(t('b.abilityEntryStat', { name: opp.name, ability: abilityName('guard-dog', getLanguage()), stat: t('stat.attack') }))
      }
    } else if (stages.attack > -6 && !getAbilityStatDropBlocked(opp, 'attack')) {
      opp = { ...opp, statStages: { ...stages, attack: stages.attack - 1 } }
      logs.push(t('b.abilityIntimidate', { name: entering.name, target: opp.name, ability: abilityName(ability, getLanguage()) }))
      const reaction = applyAbilityStatDropReaction(opp, -1, 'attack')
      opp = reaction.pokemon
      logs.push(...reaction.logs)
    }
  }
  const weatherToSet = ability ? WEATHER_SETTERS[ability] : undefined
  if (weatherToSet && weatherToSet !== weather) {
    setWeather(weatherToSet)
    logs.push(t('b.abilityWeather', { name: entering.name, weather: weatherName(weatherToSet, getLanguage()) }))
  }
  if (hasAbility(entering, 'supersweet-syrup') && opp.hp > 0) {
    const stages = opp.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
    if (stages.speed > -6) {
      opp = { ...opp, statStages: { ...stages, speed: stages.speed - 1 } }
      logs.push(t('b.abilityEntryDrop', { name: entering.name, target: opp.name, stat: t('stat.speed'), ability: abilityName(ability, getLanguage()) }))
    }
  }
  return { opponentUpdated: opp, logs }
}

// Efectos de habilidades y clima al final del turno.
function applyPvpTurnAbilities(p: Pokemon, weather: WeatherKind, logs: string[], opponent?: Pokemon): Pokemon {
  let updated = { ...p }
  if (updated.hp <= 0) return updated
  const suppressed = isWeatherSuppressed(updated, opponent)
  const turnWeather: WeatherKind = suppressed ? 'none' : weather
  if (hasAbility(updated, 'speed-boost')) {
    const stages = updated.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
    if (stages.speed < 6) {
      updated = { ...updated, statStages: { ...stages, speed: stages.speed + 1 } }
      logs.push(t('b.abilitySpeedBoost', { name: updated.name, ability: abilityName(updated.ability, getLanguage()) }))
    }
  }
  const chip = weatherChipDmg(updated, turnWeather)
  if (chip > 0) {
    updated = { ...updated, hp: Math.max(0, updated.hp - chip) }
    logs.push(t('b.weatherChip', { name: updated.name, dmg: chip, weather: weatherName(turnWeather, getLanguage()) }))
  }
  if (turnWeather === 'rain' && (hasAbility(updated, 'rain-dish') || hasAbility(updated, 'dry-skin')) && updated.hp > 0) {
    const heal = hasAbility(updated, 'rain-dish')
      ? Math.max(1, Math.floor(updated.maxHp / 16))
      : Math.max(1, Math.floor(updated.maxHp / 8))
    updated = { ...updated, hp: Math.min(updated.maxHp, updated.hp + heal) }
    logs.push(t('b.abilityWeatherHeal', { name: updated.name, hp: heal, ability: abilityName(updated.ability, getLanguage()) }))
  }
  if (turnWeather === 'sun' && hasAbility(updated, 'solar-power') && updated.hp > 1) {
    const loss = Math.max(1, Math.floor(updated.maxHp / 8))
    updated = { ...updated, hp: Math.max(1, updated.hp - loss) }
    logs.push(t('b.abilitySolarPower', { name: updated.name, dmg: loss, ability: abilityName(updated.ability, getLanguage()) }))
  }
  if (turnWeather === 'rain' && hasAbility(updated, 'hydration') && updated.status) {
    updated = { ...updated, status: undefined }
    logs.push(t('b.abilityHydration', { name: updated.name, ability: abilityName(updated.ability, getLanguage()) }))
  }
  if (hasAbility(updated, 'shed-skin') && updated.status && Math.random() < 1 / 3) {
    updated = { ...updated, status: undefined }
    logs.push(t('b.abilityShedSkin', { name: updated.name, ability: abilityName(updated.ability, getLanguage()) }))
  }
  const extra = applyAbilityEndTurn(updated, turnWeather, opponent, !suppressed)
  updated = extra.pokemon
  logs.push(...extra.logs)
  return updated
}

// Inmunidades de habilidad a estados.
function isStatusImmune(p: Pokemon, ailment: StatusType, weather: WeatherKind = 'none', weatherActive = true): boolean {
  return getAbilityStatusImmune(p, ailment, weather, weatherActive)
}

// Determina ganador y siguiente fase tras aplicar golpes/cambios.
function finalizeTurn(state: PvpState, log: string[], a: PvpPlayerState, b: PvpPlayerState): PvpState {
  const aAllFainted = a.team.every((p) => p.hp <= 0)
  const bAllFainted = b.team.every((p) => p.hp <= 0)

  let winner: 'a' | 'b' | null = null
  if (aAllFainted && bAllFainted) {
    winner = null
  } else if (bAllFainted) {
    winner = 'a'
  } else if (aAllFainted) {
    winner = 'b'
  }

  const curA = a.team[a.active]
  const curB = b.team[b.active]

  let phase: PvpState['phase']
  let switchFor: PvpState['switchFor'] = null

  if (winner) {
    phase = 'finished'
    const wName = winner === 'a' ? (a.username ?? t('pvp.playerA')) : (b.username ?? t('pvp.playerB'))
    log.push(`🏆 ¡${wName} gana la batalla!`)
  } else if (aAllFainted && bAllFainted) {
    phase = 'finished'
    log.push('🤝 ¡Empate! Ambos equipos quedaron debilitados.')
  } else if (curA.hp <= 0 && curB.hp <= 0) {
    phase = 'switch'
    switchFor = 'both'
    log.push(t('b.bothFaintedChoose'))
  } else if (curA.hp <= 0) {
    phase = 'switch'
    switchFor = 'a'
    log.push(t('b.faintedChoose', { name: curA.name, side: t('pvp.playerA') }))
  } else if (curB.hp <= 0) {
    phase = 'switch'
    switchFor = 'b'
    log.push(t('b.faintedChoose', { name: curB.name, side: t('pvp.playerB') }))
  } else {
    phase = 'picking'
  }

  return { ...state, phase, winner, switchFor, log: log.slice(-50), a, b }
}

/**
 * Resuelve un turno completo de PvP a partir del estado compartido y las
 * acciones de ambos jugadores. Devuelve el nuevo estado (o el mismo con
 * changed=false si falta alguna acción necesaria).
 *
 * Reglas:
 * - Se puede atacar o cambiar de Pokémon durante la fase 'picking'.
 * - Los cambios de Pokémon siempre se resuelven antes que los ataques.
 * - El Pokémon más rápido (o con mayor prioridad) ataca primero; si debilita
 *   al rival con el primer golpe, el rival NO ataca.
 */
export function resolvePvpTurn(
  state: PvpState,
  actionA: PvpAction | null,
  actionB: PvpAction | null
): { state: PvpState; changed: boolean } {
  const a = clonePlayerState(state.a)
  const b = clonePlayerState(state.b)
  const log = [...state.log]
  const meta = {
    weather: (state.weather ?? 'none') as WeatherKind,
    entryApplied: state.entryApplied ?? false,
  }

  // Habilidades de entrada al comenzar la batalla (una sola vez, al resolver
  // el primer turno). Intimidación mutua y creadores de clima.
  if (!meta.entryApplied && state.phase === 'picking') {
    const actA = a.team[a.active]
    const actB = b.team[b.active]
    if (actA && actB) {
      const entryA = applyPvpEntryAbilities(actA, actB, meta.weather, (w) => { meta.weather = w })
      const entryB = applyPvpEntryAbilities(actB, actA, meta.weather, (w) => { meta.weather = w })
      const aBase = entryB.opponentUpdated
      const bBase = entryA.opponentUpdated
      const aSelf = applyAbilityEntrySelf(aBase, bBase)
      const bSelf = applyAbilityEntrySelf(bBase, aSelf.entering)
      a.team[a.active] = aSelf.entering
      b.team[b.active] = bSelf.entering
      log.push(...entryA.logs, ...entryB.logs, ...aSelf.logs, ...bSelf.logs)
      meta.entryApplied = true
    }
  }

  const finalWithMeta = (lg: string[]): PvpState =>
    finalizeTurn({ ...state, weather: meta.weather, entryApplied: meta.entryApplied }, lg, a, b)

  // Aplica las habilidades de salida (Cura Natural, Regeneración) al que se
  // va y las de entrada del que entra frente al activo contrario.
  const applySwitchAbilities = (side: PvpPlayerState, oppSide: PvpPlayerState, outgoingIdx: number): void => {
    const outgoing = side.team[outgoingIdx]
    if (outgoing) {
      const switched = applyAbilitySwitchOut(outgoing)
      side.team[outgoingIdx] = switched.pokemon
      log.push(...switched.logs)
    }
    const incoming = side.team[side.active]
    const oppActive = oppSide.team[oppSide.active]
    if (incoming && oppActive && oppActive.hp > 0) {
      const entry = applyPvpEntryAbilities(incoming, oppActive, meta.weather, (w) => { meta.weather = w })
      oppSide.team[oppSide.active] = entry.opponentUpdated
      const selfEntry = applyAbilityEntrySelf(incoming, entry.opponentUpdated)
      side.team[side.active] = selfEntry.entering
      log.push(...entry.logs, ...selfEntry.logs)
    }
  }

  if (state.phase === 'switch') {
    const switchSides: Array<'a' | 'b'> =
      state.switchFor === 'both' ? ['a', 'b'] : state.switchFor ? [state.switchFor] : []
    let changed = false
    for (const side of switchSides) {
      const action = side === 'a' ? actionA : actionB
      if (!action || action.kind !== 'switch') continue
      const ps = side === 'a' ? a : b
      const oppSide = side === 'a' ? b : a
      if (isTrappedByAbility(ps.team[ps.active], oppSide.team[oppSide.active])) {
        log.push(t('b.abilityTrapped', { name: ps.team[ps.active].name, ability: abilityName(oppSide.team[oppSide.active].ability, getLanguage()) }))
        continue
      }
      const outgoingIdx = ps.active
      if (doSwitch(ps, action.index)) {
        applySwitchAbilities(ps, oppSide, outgoingIdx)
        const who = side === 'a' ? (a.username ?? t('pvp.playerA')) : (b.username ?? t('pvp.playerB'))
        log.push(t('b.switchOut2', { side: who, name: ps.team[ps.active].name }))
        changed = true
      }
    }
    if (!changed) return { state, changed: false }
    return { state: finalWithMeta(log), changed: true }
  }

  // phase 'picking'
  const activeA = a.team[a.active]
  const activeB = b.team[b.active]
  if (!activeA || !activeB || !actionA || !actionB) {
    return { state, changed: false }
  }

  const switchA = actionA.kind === 'switch'
  const switchB = actionB.kind === 'switch'

  // 1) Cambios de Pokémon: se resuelven primero.
  if (switchA || switchB) {
    let changed = false
    if (switchA) {
      if (isTrappedByAbility(a.team[a.active], b.team[b.active])) {
        log.push(t('b.abilityTrapped', { name: a.team[a.active].name, ability: abilityName(b.team[b.active].ability, getLanguage()) }))
        return { state, changed: false }
      }
      const outgoingIdx = a.active
      if (doSwitch(a, actionA.index)) {
        log.push(t('b.switchOut', { side: a.username ?? t('pvp.playerA'), name: a.team[a.active].name }))
        applySwitchAbilities(a, b, outgoingIdx)
        changed = true
      }
    }
    if (switchB) {
      if (isTrappedByAbility(b.team[b.active], a.team[a.active])) {
        log.push(t('b.abilityTrapped', { name: b.team[b.active].name, ability: abilityName(a.team[a.active].ability, getLanguage()) }))
        return { state, changed: false }
      }
      const outgoingIdx = b.active
      if (doSwitch(b, actionB.index)) {
        log.push(t('b.switchOut', { side: b.username ?? t('pvp.playerB'), name: b.team[b.active].name }))
        applySwitchAbilities(b, a, outgoingIdx)
        changed = true
      }
    }
    if (!changed) return { state, changed: false }
    if (switchA && switchB) {
      return { state: finalWithMeta(log), changed: true }
    }

    // Solo un lado cambió: el otro ataca al recién entrado (sin prioridad de
    // velocidad, porque el cambio ocurre primero).
    const moveSide: 'a' | 'b' = switchA ? 'b' : 'a'
    const movePokemon = moveSide === 'a' ? a.team[a.active] : b.team[b.active]
    const moveIdx = moveSide === 'a' ? actionA.index : actionB.index
    const move = moveSide === 'a' ? activeA.moves[moveIdx] : activeB.moves[moveIdx]
    if (move) {
      const tick = processStatusTick(movePokemon)
      log.push(...tick.log)
      let curMove = tick.updatedPokemon
      let curDef = moveSide === 'a' ? b.team[b.active] : a.team[a.active]
      if (!tick.skipTurn) {
        const hit = performPvpHit(curMove, curDef, move, meta.weather)
        curMove = {
          ...hit.updatedAttacker,
          moves: hit.updatedAttacker.moves.map((m, i) =>
            i === moveIdx ? { ...m, pp: Math.max(0, (m.pp ?? 1) - (curDef.ability === 'pressure' ? 2 : 1)) } : m
          ),
        }
        curDef = hit.updatedDefender
        log.push(...hit.lines)
      }
      // Efectos de habilidad y clima por turno.
      const turnLog: string[] = []
      curMove = applyPvpTurnAbilities(curMove, meta.weather, turnLog, curDef)
      curDef = applyPvpTurnAbilities(curDef, meta.weather, turnLog, curMove)
      log.push(...turnLog)
      if (moveSide === 'a') a.team[a.active] = { ...curMove }
      else b.team[b.active] = { ...curMove }
      if (moveSide === 'a') b.team[b.active] = { ...curDef }
      else a.team[a.active] = { ...curDef }
    }
    return { state: finalWithMeta(log), changed: true }
  }

  // 2) Ambos atacan: orden por prioridad y luego velocidad.
  const idxA = actionA.index
  const idxB = actionB.index
  const moveA = activeA.moves[idxA]
  const moveB = activeB.moves[idxB]
  if (!moveA || !moveB) return { state, changed: false }

  const tickA = processStatusTick(activeA)
  const tickB = processStatusTick(activeB)
  let curA = tickA.updatedPokemon
  let curB = tickB.updatedPokemon
  log.push(...tickA.log, ...tickB.log)

  const prioA = (moveA.priority ?? 0) + getAbilityPriorityBonus(curA, moveA)
  const prioB = (moveB.priority ?? 0) + getAbilityPriorityBonus(curB, moveB)
  let first: 'a' | 'b'
  let bothAct = false

  if (tickA.skipTurn && tickB.skipTurn) {
    first = 'a'
    bothAct = false
  } else if (tickA.skipTurn) {
    first = 'b'
    bothAct = false
  } else if (tickB.skipTurn) {
    first = 'a'
    bothAct = false
  } else {
    bothAct = true
    first = prioA !== prioB
      ? (prioA > prioB ? 'a' : 'b')
      : (effectiveSpeed(curA, meta.weather, curB) >= effectiveSpeed(curB, meta.weather, curA) ? 'a' : 'b')
  }

  const second: 'a' | 'b' | null = bothAct ? (first === 'a' ? 'b' : 'a') : null

  function applyMove(attackerSide: 'a' | 'b', defenderSide: 'a' | 'b'): void {
    const attacker = attackerSide === 'a' ? curA : curB
    const defender = defenderSide === 'a' ? curA : curB
    const move = attackerSide === 'a' ? moveA : moveB
    const moveIdx = attackerSide === 'a' ? idxA : idxB
    if ((move.priority ?? 0) > 0 && blocksPriorityMove(defender)) {
      log.push(t('b.abilityProtectPriority', { name: defender.name, ability: abilityName(defender.ability, getLanguage()) }))
      return
    }
    const hit = performPvpHit(attacker, defender, move, meta.weather)
    // Consume PP del movimiento usado.
    const withPp = {
      ...hit.updatedAttacker,
      moves: hit.updatedAttacker.moves.map((m, i) =>
        i === moveIdx ? { ...m, pp: Math.max(0, (m.pp ?? 1) - (defender.ability === 'pressure' ? 2 : 1)) } : m
      ),
    }
    if (attackerSide === 'a') curA = withPp
    else curB = withPp
    if (defenderSide === 'a') curA = hit.updatedDefender
    else curB = hit.updatedDefender
    log.push(...hit.lines)
  }

  applyMove(first, first === 'a' ? 'b' : 'a')
  if (second) {
    const defenderAfterFirst = first === 'a' ? curB : curA
    if (defenderAfterFirst.hp > 0) {
      applyMove(second, second === 'a' ? 'b' : 'a')
    } else {
      log.push(t('b.faintedNoAttack', { name: defenderAfterFirst.name }))
    }
  }

  // Efectos de habilidad y clima por turno (ambos activos).
  const turnLog: string[] = []
  curA = applyPvpTurnAbilities(curA, meta.weather, turnLog, curB)
  curB = applyPvpTurnAbilities(curB, meta.weather, turnLog, curA)
  // Mal Sueño (Bad Dreams) daña al rival dormido; el registro ya se añadió.
  if (curA.ability === 'bad-dreams' && curB.status?.type === 'sleep' && curB.hp > 0 && !isIndirectDamageImmune(curB)) {
    curB = { ...curB, hp: Math.max(1, curB.hp - Math.max(1, Math.floor(curB.maxHp / 8))) }
  }
  if (curB.ability === 'bad-dreams' && curA.status?.type === 'sleep' && curA.hp > 0 && !isIndirectDamageImmune(curA)) {
    curA = { ...curA, hp: Math.max(1, curA.hp - Math.max(1, Math.floor(curA.maxHp / 8))) }
  }
  log.push(...turnLog)

  a.team[a.active] = { ...curA }
  b.team[b.active] = { ...curB }

  return { state: finalWithMeta(log), changed: true }
}

function processStatusTick(p: Pokemon): { updatedPokemon: Pokemon; skipTurn: boolean; log: string[] } {
  if (p.ability === 'truant') {
    const active = (p.abilityState?.truant ?? 0) === 0
    if (!active) {
      return {
        updatedPokemon: { ...p, abilityState: { ...(p.abilityState ?? {}), truant: 0 } },
        skipTurn: true,
        log: [t('b.abilityTruant', { name: p.name })],
      }
    }
    p = { ...p, abilityState: { ...(p.abilityState ?? {}), truant: 1 } }
  }
  if (!p.status) return { updatedPokemon: p, skipTurn: false, log: [] }

  const logs: string[] = []
  let updated = { ...p }
  let skipTurn = false

  switch (p.status.type) {
    case 'burn': {
      if (isIndirectDamageImmune(updated)) break
      const burnDmg = getBurnDamage(updated, Math.max(1, Math.floor(p.maxHp / 16)))
      updated = { ...updated, hp: Math.max(0, updated.hp - burnDmg) }
      logs.push(t('b.burn', { name: updated.name, dmg: burnDmg }))
      break
    }
    case 'poison': {
      if (updated.ability === 'poison-heal') {
        const heal = Math.max(1, Math.floor(updated.maxHp / 8))
        updated = { ...updated, hp: Math.min(updated.maxHp, updated.hp + heal) }
        logs.push(t('b.abilityWeatherHeal', { name: updated.name, hp: heal, ability: abilityName('poison-heal', getLanguage()) }))
        break
      }
      if (isIndirectDamageImmune(updated)) break
      const poisonDmg = Math.max(1, Math.floor(p.maxHp / 8))
      updated = { ...updated, hp: Math.max(0, updated.hp - poisonDmg) }
      logs.push(t('b.poison', { name: updated.name, dmg: poisonDmg }))
      break
    }
    case 'paralysis': {
      if (Math.random() < 0.25) {
        skipTurn = true
        logs.push(t('b.paralysis', { name: updated.name }))
      }
      break
    }
    case 'freeze': {
      if (Math.random() < 0.20) {
        updated = { ...updated, status: undefined }
        logs.push(t('b.thawed', { name: updated.name }))
      } else {
        skipTurn = true
        logs.push(t('b.freeze', { name: updated.name }))
      }
      break
    }
    case 'sleep': {
      const remaining = (p.status.turns ?? 2) - getSleepTick(p)
      if (remaining <= 0) {
        updated = { ...updated, status: undefined }
        logs.push(t('b.wokeUp', { name: updated.name }))
      } else {
        updated = { ...updated, status: { ...updated.status!, turns: remaining } }
        skipTurn = true
        logs.push(t('b.sleep', { name: updated.name }))
      }
      break
    }
    case 'confusion': {
      const remaining = (p.status.turns ?? 3) - 1
      if (remaining <= 0) {
        updated = { ...updated, status: undefined }
        logs.push(t('b.unconfused', { name: updated.name }))
      } else {
        updated = { ...updated, status: { ...updated.status!, turns: remaining } }
      }
      break
    }
    case 'flinch': {
      skipTurn = true
      updated = { ...updated, status: undefined }
      logs.push(t('b.flinch', { name: updated.name }))
      if (updated.ability === 'steadfast') {
        const stages = updated.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
        if (stages.speed < 6) {
          updated = { ...updated, statStages: { ...stages, speed: stages.speed + 1 } }
          logs.push(t('b.abilitySpeedBoost', { name: updated.name, ability: abilityName('steadfast', getLanguage()) }))
        }
      }
      break
    }
  }

  if (updated.hp <= 0) {
    updated = { ...updated, hp: 0 }
    logs.push(t('b.debilitatedStatus', { name: updated.name }))
  }

  return { updatedPokemon: updated, skipTurn, log: logs }
}

function effectiveSpeed(p: Pokemon, weather: WeatherKind = 'none', opponent?: Pokemon): number {
  const stages = p.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
  const paralysisNerf = p.status?.type === 'paralysis' ? 0.75 : 1
  const active = !isWeatherSuppressed(p, opponent)
  return Math.round(p.speed * paralysisNerf * getStageMultiplier(stages.speed) * getAbilitySpeedMultiplier(p, active ? weather : 'none', active))
}

// Resuelve un golpe individual (sin objetos ni modificadores de run). Incluye
// habilidades, clima y estados.
function performPvpHit(
  attacker: Pokemon,
  defender: Pokemon,
  move: Move,
  weather: WeatherKind = 'none'
): { updatedDefender: Pokemon; updatedAttacker: Pokemon; lines: string[] } {
  // El defensor está protegido (Protección/Protect): se bloquea el ataque,
  // salvo que el atacante tenga Puño Invisible o Taladro Perforador.
  if (defender.protected && !hasAbility(attacker, 'unseen-fist') && !hasAbility(attacker, 'piercing-drill')) {
    return {
      updatedDefender: { ...defender, protected: false },
      updatedAttacker: { ...attacker, protected: false },
      lines: [`🛡️ ¡${defender.name} se protegió del ataque de ${attacker.name}!`],
    }
  }
  const abilityMoveType = getAbilityMoveType(attacker, move)
  const effectiveMove = abilityMoveType !== move.type ? { ...move, type: abilityMoveType } : move
  const battleWeatherActive = !isWeatherSuppressed(attacker, defender)
  const battleWeather: WeatherKind = battleWeatherActive ? weather : 'none'
  const burnNerf = attacker.status?.type === 'burn' ? 0.5 : 1
  const paralysisSpdNerf = attacker.status?.type === 'paralysis' ? 0.75 : 1
  const atkStages = attacker.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
  const defStages = defender.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }

  // --- Multiplicadores de stats por habilidad ---
  const attackerStatused = !!attacker.status
  const gutsMod = hasAbility(attacker, 'guts') && attackerStatused ? 1.5 : 1
  const hugePowerMod = hasAbility(attacker, 'huge-power') || hasAbility(attacker, 'pure-power') ? 2 : 1
  const solarPowerMod = hasAbility(attacker, 'solar-power') && battleWeather === 'sun' ? 1.5 : 1
  const marvelScaleMod = hasAbility(defender, 'marvel-scale') && !!defender.status ? 1.5 : 1
  // Indefenso (Unaware): ignora las etapas del rival.
  const attackStageMult = hasAbility(defender, 'unaware', attacker) ? 1 : getStageMultiplier(atkStages.attack)
  const specialAttackStageMult = hasAbility(defender, 'unaware', attacker) ? 1 : getStageMultiplier(atkStages.spAttack ?? 0)
  const defenseStageMult = hasAbility(attacker, 'unaware') ? 1 : getStageMultiplier(defStages.defense)
  const specialDefenseStageMult = hasAbility(attacker, 'unaware') ? 1 : getStageMultiplier(defStages.spDefense ?? 0)

  const effectiveAttacker: Pokemon = {
    ...attacker,
    attack: Math.round((Number.isFinite(attacker.attack) ? attacker.attack : 10) * burnNerf * attackStageMult * gutsMod * hugePowerMod),
    spAttack: Math.round((Number.isFinite(attacker.spAttack) ? attacker.spAttack : 10) * specialAttackStageMult * solarPowerMod),
    speed: Math.round((Number.isFinite(attacker.speed) ? attacker.speed : 10) * paralysisSpdNerf * getStageMultiplier(atkStages.speed) * getAbilitySpeedMultiplier(attacker, battleWeather, battleWeatherActive)),
  }
  const effectiveDefender: Pokemon = {
    ...defender,
    defense: Math.round((Number.isFinite(defender.defense) ? defender.defense : 10) * defenseStageMult * marvelScaleMod),
    spDefense: Math.round((Number.isFinite(defender.spDefense) ? defender.spDefense : 10) * specialDefenseStageMult * marvelScaleMod),
  }

  const defTypes = (defender as any).types ?? []
  let { effectiveness, message } = getTypeEffectiveness(effectiveMove.type, defTypes[0] || 'normal', defTypes[1])
  effectiveness = adjustEffectivenessForAbilities(attacker, effectiveMove.type, effectiveness)

  // --- Habilidades de inmunidad/absorción del defensor ---
  const defenderAbility = defender.ability
  const abilityImmunity = getAbilityMoveImmunity(defender, effectiveMove, attacker, effectiveness)
  const abilityBlocked = !!abilityImmunity
  let abilityBlockMsg: string | null = null
  if (abilityBlocked) {
    effectiveness = 0
    message = null
    abilityBlockMsg = t('b.abilityBlocked', { ability: abilityName(defenderAbility, getLanguage()) })
  }

  const stabBonus = getAbilityStabTypes(attacker, effectiveMove.type).some((t: string) => t === effectiveMove.type)
    ? (hasAbility(attacker, 'adaptability') ? 2 : 1.5)
    : 1

  // --- Precisión (Indefenso, Ojo Compuesto y clima sobre Trueno) ---
  const noGuardBoth = hasAbility(attacker, 'no-guard') || hasAbility(defender, 'no-guard')
  if (move.accuracy !== null && move.accuracy < 100 && !noGuardBoth) {
    let effectiveAccuracy = move.accuracy
    if (hasAbility(attacker, 'compound-eyes')) effectiveAccuracy = Math.min(100, effectiveAccuracy * 1.3)
    effectiveAccuracy = Math.min(100, effectiveAccuracy * getAbilityAccuracyMultiplier(attacker, defender, effectiveMove, battleWeather, battleWeatherActive))
    if (effectiveMove.type === 'electric' && (effectiveMove.name === 'Trueno' || effectiveMove.enName === 'Thunder')) {
      if (battleWeather === 'rain') effectiveAccuracy = 100
      else if (battleWeather === 'sun') effectiveAccuracy = Math.min(effectiveAccuracy, 50)
    }
    if (Math.random() * 100 >= effectiveAccuracy) {
      return {
        updatedDefender: defender,
        updatedAttacker: attacker,
        lines: [t('b.missed', { attacker: attacker.name, move: moveName(effectiveMove) })],
      }
    }
  }

  let totalHits = 1
  if (move.minHits && move.maxHits) {
    totalHits = Math.floor(Math.random() * (move.maxHits - move.minHits + 1)) + move.minHits
  }

  let currentDefender = effectiveDefender
  const lines: string[] = []
  let totalDamage = 0
  let lastHitCrit = false

  // Movimiento sin efecto (p. ej. Eléctrico contra Tierra): no golpea ni
  // aplica efectos secundarios.
  if (effectiveness === 0) {
    lines.push(t('battle.noEffect'))
  } else {
  for (let hit = 0; hit < totalHits; hit++) {
    const result = applyDamage(effectiveAttacker, currentDefender, move)
    let finalDamage = Number.isFinite(result.damage) ? Math.floor(result.damage * effectiveness * stabBonus) : 3

    // --- Multiplicadores por habilidad y clima ---
    finalDamage = Math.floor(finalDamage * weatherTypeMultiplier(battleWeather, effectiveMove.type))
    const lowHpAbility = attacker.hp / Math.max(1, attacker.maxHp) <= 1 / 3
    const pinchMult = (lowHpAbility
      && ((hasAbility(attacker, 'blaze') && effectiveMove.type === 'fire')
        || (hasAbility(attacker, 'overgrow') && effectiveMove.type === 'grass')
        || (hasAbility(attacker, 'torrent') && effectiveMove.type === 'water')
        || (hasAbility(attacker, 'swarm') && effectiveMove.type === 'bug')))
      ? 1.5 : 1
    const technicianMult = hasAbility(attacker, 'technician') && (effectiveMove.power ?? 0) <= 60 ? 1.5 : 1
    const tintedLensMult = hasAbility(attacker, 'tinted-lens') && effectiveness < 1 ? 2 : 1
    const toughClawsMult = hasAbility(attacker, 'tough-claws') && effectiveMove.damageClass !== 'special' ? 1.3 : 1
    const thickFatMult = hasAbility(defender, 'thick-fat', attacker) && (effectiveMove.type === 'fire' || effectiveMove.type === 'ice') ? 0.5 : 1
    const extraAbilityMult = getAbilityDamageMultiplier(attacker, defender, effectiveMove, {
      effectiveness,
      weather: battleWeather,
      weatherActive: battleWeatherActive,
      isCrit: false,
      isContact: isContactMove(effectiveMove),
      defenderAtFullHp: defender.hp >= defender.maxHp,
      movedLast: false,
    })
    finalDamage = Math.floor(finalDamage * pinchMult * technicianMult * tintedLensMult * toughClawsMult * thickFatMult * extraAbilityMult)
    if (hasAbility(defender, 'dry-skin', attacker) && effectiveMove.type === 'fire') finalDamage = Math.floor(finalDamage * 1.25)
    if (hasAbility(defender, 'multiscale', attacker) && defender.hp >= defender.maxHp) finalDamage = Math.floor(finalDamage * 0.5)

    const critInfo = getAbilityCritInfo(attacker, defender, effectiveMove)
    const moveCritStage = effectiveMove.critRatio ?? 0
    const moveCritChance = moveCritStage >= 3 ? 0.5 : moveCritStage === 2 ? 0.25 : moveCritStage === 1 ? 0.125 : 0
    const critChance = moveCritChance + critInfo.chanceBonus
    const isCrit = !critInfo.immune && (critInfo.always || (critChance > 0 && Math.random() < critChance))
    lastHitCrit = lastHitCrit || isCrit
    if (isCrit) finalDamage = Math.floor(finalDamage * (hasAbility(attacker, 'sniper') ? 2 : 1.5))

    const curHp = Number.isFinite(currentDefender.hp) ? currentDefender.hp : currentDefender.maxHp
    const newHp = Math.max(0, curHp - finalDamage)
    currentDefender = { ...currentDefender, hp: newHp }
    totalDamage += finalDamage

    let hitLine = totalHits > 1
      ? t('b.usesHitMulti', { attacker: attacker.name, move: moveName(effectiveMove), dmg: finalDamage, hit: hit + 1, total: totalHits })
      : t('b.usesHit', { attacker: attacker.name, move: moveName(effectiveMove), dmg: finalDamage })
    if (isCrit) hitLine += t('b.critSuffix')
    if (message) hitLine += ` (${message})`
    if (abilityBlockMsg) hitLine += ` (${abilityBlockMsg})`
    lines.push(hitLine)

    if (currentDefender.hp <= 0) break
  }
  }

  // --- Absorción/efecto de inmunidad ---
  if (abilityBlocked && abilityImmunity && currentDefender.hp > 0) {
    const absorbed = absorbAbilityMove(currentDefender, abilityImmunity)
    currentDefender = absorbed.defender
    lines.push(...absorbed.logs)
  }

  // --- Robustez (Sturdy): aguanta con 1 HP a plena vida ---
  if (currentDefender.hp <= 0 && hasAbility(defender, 'sturdy', attacker) && defender.hp >= defender.maxHp) {
    currentDefender = { ...currentDefender, hp: 1 }
    lines.push(t('b.abilitySturdy', { name: currentDefender.name, ability: abilityName(defenderAbility, getLanguage()) }))
  }

  // --- Estado: solo si sobrevive y no es inmune por habilidad ---
  if (effectiveness > 0 && totalHits > 0 && currentDefender.hp > 0 && effectiveMove.ailment && !currentDefender.status && !isStatusImmune(currentDefender, effectiveMove.ailment, battleWeather, battleWeatherActive)) {
    const chance = effectiveMove.ailmentChance ?? 1
    if (Math.random() < chance) {
      const ailmentTurns: Record<StatusType, number> = {
        burn: 999,
        poison: 999,
        paralysis: 999,
        freeze: 999,
        sleep: Math.floor(Math.random() * 2) + 2,
        confusion: Math.floor(Math.random() * 3) + 2,
        flinch: 1,
      }
      currentDefender = {
        ...currentDefender,
        status: { type: effectiveMove.ailment, turns: ailmentTurns[effectiveMove.ailment] },
      }
      lines.push(statusAppliedLine(currentDefender.name, effectiveMove.ailment))
    }
  }

  // --- Cambios de stats ---
  let attackerStages = effectiveAttacker.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
  if (move.statChanges && move.statChanges.length > 0) {
    const isDamaging = (move.power ?? 0) > 0
    const cat = move.metaCategory ?? ''
    const changes = move.statChanges

    let changesHitSelf: boolean
    if (isDamaging) {
      changesHitSelf = cat === 'net-good-stats' || cat === 'damage+raise' || cat === 'damage-raise'
    } else if (cat === 'net-bad-stats' || cat === 'swagger') {
      changesHitSelf = false
    } else {
      changesHitSelf = changes.some(sc => sc.change > 0)
    }

    for (const sc of changes) {
      const rolled = sc.chance == null || Math.random() * 100 < sc.chance
      if (!rolled) continue

      if (changesHitSelf) {
        const stageKey: keyof typeof attackerStages = sc.stat === 'special-attack' ? 'spAttack' : sc.stat === 'special-defense' ? 'spDefense' : sc.stat
        const change = adjustAbilityStatChange(attacker, Number.isFinite(sc.change) ? sc.change : 0)
        const oldStage = attackerStages[stageKey] ?? 0
        const newStage = Math.max(-6, Math.min(6, oldStage + change))
        if (newStage !== oldStage) {
          attackerStages = { ...attackerStages, [stageKey]: newStage }
          const direction = change > 0 ? 'subió' : 'bajó'
          const statName = sc.stat === 'attack' ? 'Ataque' : sc.stat === 'defense' ? 'Defensa' : sc.stat === 'special-attack' ? 'At. Esp.' : sc.stat === 'special-defense' ? 'Def. Esp.' : 'Velocidad'
          lines.push(`${effectiveAttacker.name} ${direction} su ${statName}! (${oldStage > 0 ? '+' : ''}${oldStage} → ${newStage > 0 ? '+' : ''}${newStage})`)
        }
      } else if (currentDefender.hp > 0) {
        let newStages = currentDefender.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
        const stageKey: keyof typeof newStages = sc.stat === 'special-attack' ? 'spAttack' : sc.stat === 'special-defense' ? 'spDefense' : sc.stat
        const change = adjustAbilityStatChange(currentDefender, Number.isFinite(sc.change) ? sc.change : 0)
        // Habilidades de protección de bajada de stats.
        const statDropBlocked = change < 0 && getAbilityStatDropBlocked(currentDefender, stageKey as 'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed')
        if (statDropBlocked) {
          lines.push(t('b.abilityNoStatDown', { name: currentDefender.name, ability: abilityName(currentDefender.ability, getLanguage()) }))
          continue
        }
        const oldStage = newStages[stageKey] ?? 0
        const newStage = Math.max(-6, Math.min(6, oldStage + change))
        if (newStage !== oldStage) {
          newStages = { ...newStages, [stageKey]: newStage }
          currentDefender = { ...currentDefender, statStages: newStages }
          const direction = change > 0 ? 'subió' : 'bajó'
          const statName = sc.stat === 'attack' ? 'Ataque' : sc.stat === 'defense' ? 'Defensa' : sc.stat === 'special-attack' ? 'At. Esp.' : sc.stat === 'special-defense' ? 'Def. Esp.' : 'Velocidad'
          lines.push(`${currentDefender.name} ${direction} su ${statName}! (${oldStage > 0 ? '+' : ''}${oldStage} → ${newStage > 0 ? '+' : ''}${newStage})`)
          if (change < 0) {
            const reaction = applyAbilityStatDropReaction(currentDefender, change, stageKey as 'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed')
            currentDefender = reaction.pokemon
            lines.push(...reaction.logs)
          }
        }
      }
    }
  }

  const hasAttackerStageChange = attackerStages.attack !== 0 || attackerStages.defense !== 0 || attackerStages.spAttack !== 0 || attackerStages.spDefense !== 0 || attackerStages.speed !== 0
  const protectUsed = (move.power ?? 0) === 0 && /proteg|protec|protect|evita todos los ataques|evade all attacks|escudo|shield|refugio/i.test(`${move.name} ${move.description}`)
  let updatedAttacker: Pokemon = hasAttackerStageChange
    ? { ...attacker, statStages: attackerStages, protected: protectUsed }
    : { ...attacker, protected: protectUsed }
  // Sincronía (Synchronize): devuelve el estado alterado al atacante.
  if (defender.ability === 'synchronize' && currentDefender.status && !updatedAttacker.status && currentDefender.status.type !== 'flinch') {
    if (!getAbilityStatusImmune(updatedAttacker, currentDefender.status.type, battleWeather, battleWeatherActive)) {
      updatedAttacker = { ...updatedAttacker, status: { ...currentDefender.status } }
      lines.push(t('b.abilityContactStatus', { name: updatedAttacker.name, status: statusLabel(currentDefender.status.type), ability: abilityName('synchronize', getLanguage()) }))
    }
  }
  if (move.recoilPercent && move.recoilPercent > 0 && totalDamage > 0 && !hasAbility(attacker, 'rock-head')) {
    const recoilDamage = Math.floor(totalDamage * move.recoilPercent)
    updatedAttacker = { ...updatedAttacker, hp: Math.max(1, updatedAttacker.hp - recoilDamage) }
    lines.push(`${attacker.name} sufre recoil (${recoilDamage}).`)
  }
  if (move.drainPercent && move.drainPercent > 0 && totalDamage > 0 && updatedAttacker.hp > 0) {
    const drainHeal = Math.floor(totalDamage * move.drainPercent)
    if (defender.ability === 'liquid-ooze') {
      updatedAttacker = { ...updatedAttacker, hp: Math.max(1, updatedAttacker.hp - drainHeal) }
      lines.push(t('b.abilityOpponentDamage', { name: defender.name, target: attacker.name, dmg: drainHeal, ability: abilityName('liquid-ooze', getLanguage()) }))
    } else {
      updatedAttacker = { ...updatedAttacker, hp: Math.min(updatedAttacker.maxHp, updatedAttacker.hp + drainHeal) }
      lines.push(`${attacker.name} drena ${drainHeal} HP.`)
    }
  }

  // --- Efectos de contacto del defensor (Piel Áspera, Estática...) ---
  const isContact = isContactMove(effectiveMove) && !hasAbility(attacker, 'long-reach')
  if (totalDamage > 0 && isContact && currentDefender.hp > 0 && updatedAttacker.hp > 0) {
    if (hasAbility(defender, 'rough-skin', attacker)) {
      const skinDmg = Math.max(1, Math.floor(updatedAttacker.maxHp / 8))
      updatedAttacker = { ...updatedAttacker, hp: Math.max(1, updatedAttacker.hp - skinDmg) }
      lines.push(t('b.abilityRoughSkin', { name: updatedAttacker.name, dmg: skinDmg, ability: abilityName(defenderAbility, getLanguage()) }))
    }
    const contactStatus: Array<{ ability: string; status: StatusType }> = [
      { ability: 'static', status: 'paralysis' },
      { ability: 'flame-body', status: 'burn' },
      { ability: 'poison-point', status: 'poison' },
    ]
    for (const cs of contactStatus) {
      if (!hasAbility(defender, cs.ability, attacker)) continue
      if (updatedAttacker.status) break
      if (Math.random() < 0.30) {
        updatedAttacker = { ...updatedAttacker, status: { type: cs.status, turns: 999 } }
        lines.push(t('b.abilityContactStatus', { name: updatedAttacker.name, status: statusLabel(cs.status), ability: abilityName(defenderAbility, getLanguage()) }))
        break
      }
    }
  }

  // --- Efectos adicionales al recibir el golpe ---
  const onHit = applyAbilityOnHit(updatedAttacker, currentDefender, effectiveMove, totalDamage, {
    defenderHpBefore: defender.hp,
    isContact,
    isCrit: lastHitCrit,
    weather: battleWeather,
  })
  updatedAttacker = onHit.attacker
  currentDefender = onHit.defender
  lines.push(...onHit.logs)

  return {
    // No persistir las stats efectivas (ya multiplicadas): si se guardaran,
    // cada turno se volverían a multiplicar y crecerían exponencialmente.
    updatedDefender: { ...currentDefender, defense: defender.defense, spDefense: defender.spDefense },
    updatedAttacker,
    lines,
  }
}
