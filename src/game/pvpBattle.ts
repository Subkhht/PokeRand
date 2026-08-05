import type { Move, Pokemon, StatusType } from './types'
import { applyDamage } from './engine'
import { getTypeEffectiveness } from './typesChart'
import type { PvpState, PvpPlayerState } from './pvp'

export interface PvpAction {
  kind: 'move' | 'switch'
  index: number
}

const STATUS_LABELS: Record<StatusType, string> = {
  burn: '🔥 Quemado',
  poison: '☠️ Envenenado',
  paralysis: '⚡ Paralizado',
  freeze: '🧊 Congelado',
  sleep: '💤 Dormido',
  confusion: '💫 Confundido',
  flinch: '❕ Aturdido',
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
    const wName = winner === 'a' ? (a.username ?? 'Jugador A') : (b.username ?? 'Jugador B')
    log.push(`🏆 ¡${wName} gana la batalla!`)
  } else if (aAllFainted && bAllFainted) {
    phase = 'finished'
    log.push('🤝 ¡Empate! Ambos equipos quedaron debilitados.')
  } else if (curA.hp <= 0 && curB.hp <= 0) {
    phase = 'switch'
    switchFor = 'both'
    log.push('💀 Ambos Pokémon se debilitaron. Cada jugador elige su siguiente Pokémon.')
  } else if (curA.hp <= 0) {
    phase = 'switch'
    switchFor = 'a'
    log.push(`💀 ${curA.name} se debilitó. El Jugador A elige su siguiente Pokémon.`)
  } else if (curB.hp <= 0) {
    phase = 'switch'
    switchFor = 'b'
    log.push(`💀 ${curB.name} se debilitó. El Jugador B elige su siguiente Pokémon.`)
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

  if (state.phase === 'switch') {
    const switchSides: Array<'a' | 'b'> =
      state.switchFor === 'both' ? ['a', 'b'] : state.switchFor ? [state.switchFor] : []
    let changed = false
    for (const side of switchSides) {
      const action = side === 'a' ? actionA : actionB
      if (!action || action.kind !== 'switch') continue
      const ps = side === 'a' ? a : b
      if (doSwitch(ps, action.index)) {
        const who = side === 'a' ? (a.username ?? 'Jugador A') : (b.username ?? 'Jugador B')
        log.push(`🔁 ${who} saca a ${ps.team[ps.active].name}.`)
        changed = true
      }
    }
    if (!changed) return { state, changed: false }
    return { state: finalizeTurn(state, log, a, b), changed: true }
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
    if (switchA && doSwitch(a, actionA.index)) {
      log.push(`🔁 ${a.username ?? 'Jugador A'} saca a ${a.team[a.active].name}.`)
      changed = true
    }
    if (switchB && doSwitch(b, actionB.index)) {
      log.push(`🔁 ${b.username ?? 'Jugador B'} saca a ${b.team[b.active].name}.`)
      changed = true
    }
    if (!changed) return { state, changed: false }
    if (switchA && switchB) {
      return { state: finalizeTurn(state, log, a, b), changed: true }
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
        const hit = performPvpHit(curMove, curDef, move)
        curMove = {
          ...hit.updatedAttacker,
          moves: hit.updatedAttacker.moves.map((m, i) =>
            i === moveIdx ? { ...m, pp: Math.max(0, (m.pp ?? 1) - 1) } : m
          ),
        }
        curDef = hit.updatedDefender
        log.push(...hit.lines)
      }
      if (moveSide === 'a') a.team[a.active] = { ...curMove }
      else b.team[b.active] = { ...curMove }
      if (moveSide === 'a') b.team[b.active] = { ...curDef }
      else a.team[a.active] = { ...curDef }
    }
    return { state: finalizeTurn(state, log, a, b), changed: true }
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

  const prioA = moveA.priority ?? 0
  const prioB = moveB.priority ?? 0
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
      : (effectiveSpeed(curA) >= effectiveSpeed(curB) ? 'a' : 'b')
  }

  const second: 'a' | 'b' | null = bothAct ? (first === 'a' ? 'b' : 'a') : null

  function applyMove(attackerSide: 'a' | 'b', defenderSide: 'a' | 'b'): void {
    const attacker = attackerSide === 'a' ? curA : curB
    const defender = defenderSide === 'a' ? curA : curB
    const move = attackerSide === 'a' ? moveA : moveB
    const moveIdx = attackerSide === 'a' ? idxA : idxB
    const hit = performPvpHit(attacker, defender, move)
    // Consume PP del movimiento usado.
    const withPp = {
      ...hit.updatedAttacker,
      moves: hit.updatedAttacker.moves.map((m, i) =>
        i === moveIdx ? { ...m, pp: Math.max(0, (m.pp ?? 1) - 1) } : m
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
      log.push(`💀 ${defenderAfterFirst.name} se debilitó y no pudo atacar.`)
    }
  }

  a.team[a.active] = { ...curA }
  b.team[b.active] = { ...curB }

  return { state: finalizeTurn(state, log, a, b), changed: true }
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

function effectiveSpeed(p: Pokemon): number {
  const stages = p.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
  const paralysisNerf = p.status?.type === 'paralysis' ? 0.75 : 1
  return Math.round(p.speed * paralysisNerf * getStageMultiplier(stages.speed))
}

// Resuelve un golpe individual (sin objetos, modificadores ni desafíos).
function performPvpHit(
  attacker: Pokemon,
  defender: Pokemon,
  move: Move
): { updatedDefender: Pokemon; updatedAttacker: Pokemon; lines: string[] } {
  // El defensor está protegido (Protección/Protect): se bloquea el ataque.
  if (defender.protected) {
    return {
      updatedDefender: { ...defender, protected: false },
      updatedAttacker: { ...attacker, protected: false },
      lines: [`🛡️ ¡${defender.name} se protegió del ataque de ${attacker.name}!`],
    }
  }
  const burnNerf = attacker.status?.type === 'burn' ? 0.5 : 1
  const paralysisSpdNerf = attacker.status?.type === 'paralysis' ? 0.75 : 1
  const atkStages = attacker.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
  const defStages = defender.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }

  const effectiveAttacker: Pokemon = {
    ...attacker,
    attack: Math.round(attacker.attack * burnNerf * getStageMultiplier(atkStages.attack)),
    spAttack: Math.round(attacker.spAttack * getStageMultiplier(atkStages.spAttack ?? 0)),
    speed: Math.round(attacker.speed * paralysisSpdNerf * getStageMultiplier(atkStages.speed)),
  }
  const effectiveDefender: Pokemon = {
    ...defender,
    defense: Math.round(defender.defense * getStageMultiplier(defStages.defense)),
    spDefense: Math.round(defender.spDefense * getStageMultiplier(defStages.spDefense ?? 0)),
  }

  const defTypes = (defender as any).types ?? []
  const { effectiveness, message } = getTypeEffectiveness(move.type, defTypes[0] || 'normal', defTypes[1])
  const stabBonus = ((attacker as any).types ?? []).some((t: string) => t === move.type) ? 1.5 : 1

  if (move.accuracy !== null && move.accuracy < 100) {
    if (Math.random() * 100 >= move.accuracy) {
      return {
        updatedDefender: defender,
        updatedAttacker: attacker,
        lines: [`${attacker.name} usó ${move.name} pero falló.`],
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

  for (let hit = 0; hit < totalHits; hit++) {
    const result = applyDamage(effectiveAttacker, currentDefender, move)
    let finalDamage = Math.floor(result.damage * effectiveness * stabBonus)

    const moveCritStage = move.critRatio ?? 0
    const moveCritChance = moveCritStage >= 3 ? 0.5 : moveCritStage === 2 ? 0.25 : moveCritStage === 1 ? 0.125 : 0
    const isCrit = moveCritChance > 0 && Math.random() < moveCritChance
    if (isCrit) finalDamage = Math.floor(finalDamage * 1.5)

    const newHp = Math.max(0, currentDefender.hp - finalDamage)
    currentDefender = { ...currentDefender, hp: newHp }
    totalDamage += finalDamage

    let hitLine = totalHits > 1
      ? `${attacker.name} usa ${move.name} (${hit + 1}/${totalHits}): ${finalDamage} de daño.`
      : `${attacker.name} usa ${move.name}: ${finalDamage} de daño.`
    if (isCrit) hitLine += ' ¡Golpe crítico!'
    if (message) hitLine += ` (${message})`
    lines.push(hitLine)

    if (currentDefender.hp <= 0) break
  }

  if (totalHits > 0 && currentDefender.hp > 0 && move.ailment && move.ailmentChance && !currentDefender.status) {
    if (Math.random() < move.ailmentChance) {
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
        status: { type: move.ailment, turns: ailmentTurns[move.ailment] },
      }
      lines.push(`${currentDefender.name} fue ${STATUS_LABELS[move.ailment].split(' ')[1]} ${STATUS_LABELS[move.ailment].split(' ')[0]}.`)
    }
  }

  let attackerStages = effectiveAttacker.statStages ?? { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
  if (move.statChanges && move.statChanges.length > 0) {
    const isDamaging = (move.power ?? 0) > 0
    const cat = move.metaCategory ?? ''
    const changes = move.statChanges

    // La categoría de PokeAPI es poco fiable (Malicioso/Leer sale como
    // 'net-good-stats' aunque baja la Defensa del rival): en movimientos de
    // estado se usa el conjunto de cambios (solo negativos → rival; con
    // positivos o mezcla → uno mismo, p. ej. Rompecoraza).
    let changesHitSelf: boolean
    if (isDamaging) {
      changesHitSelf = cat === 'net-good-stats' || cat === 'damage+raise'
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
        const change = Number.isFinite(sc.change) ? sc.change : 0
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
        const change = Number.isFinite(sc.change) ? sc.change : 0
        const oldStage = newStages[stageKey] ?? 0
        const newStage = Math.max(-6, Math.min(6, oldStage + change))
        if (newStage !== oldStage) {
          newStages = { ...newStages, [stageKey]: newStage }
          currentDefender = { ...currentDefender, statStages: newStages }
          const direction = change > 0 ? 'subió' : 'bajó'
          const statName = sc.stat === 'attack' ? 'Ataque' : sc.stat === 'defense' ? 'Defensa' : sc.stat === 'special-attack' ? 'At. Esp.' : sc.stat === 'special-defense' ? 'Def. Esp.' : 'Velocidad'
          lines.push(`${currentDefender.name} ${direction} su ${statName}! (${oldStage > 0 ? '+' : ''}${oldStage} → ${newStage > 0 ? '+' : ''}${newStage})`)
        }
      }
    }
  }

  const hasAttackerStageChange = attackerStages.attack !== 0 || attackerStages.defense !== 0 || attackerStages.spAttack !== 0 || attackerStages.spDefense !== 0 || attackerStages.speed !== 0
  const protectUsed = (move.power ?? 0) === 0 && /proteg|protec|protect|evita todos los ataques|evade all attacks|escudo|shield|refugio/i.test(`${move.name} ${move.description}`)
  let updatedAttacker = hasAttackerStageChange
    ? { ...attacker, statStages: attackerStages, protected: protectUsed }
    : { ...attacker, protected: protectUsed }
  if (move.recoilPercent && move.recoilPercent > 0 && totalDamage > 0) {
    const recoilDamage = Math.floor(totalDamage * move.recoilPercent)
    updatedAttacker = { ...updatedAttacker, hp: Math.max(1, updatedAttacker.hp - recoilDamage) }
    lines.push(`${attacker.name} sufre recoil (${recoilDamage}).`)
  }
  if (move.drainPercent && move.drainPercent > 0 && totalDamage > 0 && updatedAttacker.hp > 0) {
    const drainHeal = Math.floor(totalDamage * move.drainPercent)
    updatedAttacker = { ...updatedAttacker, hp: Math.min(updatedAttacker.maxHp, updatedAttacker.hp + drainHeal) }
    lines.push(`${attacker.name} drena ${drainHeal} HP.`)
  }

  return {
    updatedDefender: { ...currentDefender, defense: defender.defense },
    updatedAttacker,
    lines,
  }
}
