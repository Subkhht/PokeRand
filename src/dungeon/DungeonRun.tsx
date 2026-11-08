import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { playClick, playHover } from '../game/sound'
import treeSheetUrl from '../assets/Dungeon/arboles.png'
import specialTreeUrl from '../assets/Dungeon/arbol.png'
import { ACTIVE_BY_ID, DUNGEON_BY_ID } from './data'
import { pmdPortraitUrl } from './pmdAssets'
import type { PortraitEmotion } from './pmdAssets'
import {
  canUseItem,
  clearDialogue,
  descendFloor,
  getLeader,
  moveLeader,
  playerAttack,
  selectMove,
  setLeader,
  useActiveItem as consumeActiveItem,
  waitTurn,
} from './runEngine'
import type { DungeonMonster, DungeonRun, PmdSprites } from './types'

const MIN_CELL = 40
const MAX_CELL = 56
const BOARD_BORDER = 4
const VIEW_RADIUS = 4
const TREE_SHEET_COLUMNS = 5
const TREE_SHEET_ROWS = 3

const FIREFLIES = Array.from({ length: 9 }, (_, index) => ({
  left: 6 + ((index * 37) % 88),
  top: 8 + ((index * 53) % 82),
  delay: (index * 0.83) % 5,
  duration: 4.2 + (index % 4) * 0.8,
}))

function tileHash(x: number, y: number): number {
  let hash = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177)
  return (hash ^ (hash >>> 16)) >>> 0
}

interface DungeonRunProps {
  run: DungeonRun
  onChange: (run: DungeonRun) => void
}

interface PmdSpriteProps {
  sprites: PmdSprites | null
  facing: number
  animUntil: number
  size: number
}

function PmdSprite({ sprites, facing, animUntil, size }: PmdSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let frameId = 0
    const start = performance.now()

    const draw = (now: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.imageSmoothingEnabled = false

      if (!sprites) {
        frameId = requestAnimationFrame(draw)
        return
      }

      if (sprites.isFallback) {
        const source = sprites.walk ?? sprites.idle
        if (source) {
          const ratio = Math.min(canvas.width / source.naturalWidth, canvas.height / source.naturalHeight)
          const width = source.naturalWidth * ratio
          const height = source.naturalHeight * ratio
          ctx.drawImage(source, (canvas.width - width) / 2, canvas.height - height, width, height)
        }
        frameId = requestAnimationFrame(draw)
        return
      }

      const walking = Date.now() < animUntil
      const source = walking ? sprites.walk ?? sprites.idle : sprites.idle ?? sprites.walk
      const frames = walking ? sprites.walkFrames : sprites.idleFrames
      const frameW = walking ? sprites.walkFrameW : sprites.idleFrameW
      const frameH = walking ? sprites.walkFrameH : sprites.idleFrameH
      const durations = walking ? sprites.walkDurations : sprites.idleDurations
      if (!source || frames <= 0 || frameW <= 0 || frameH <= 0) {
        frameId = requestAnimationFrame(draw)
        return
      }

      const totalTicks = durations.length
        ? durations.reduce((sum, tick) => sum + Math.max(1, tick), 0)
        : frames * 8
      const elapsedTicks = ((now - start) / (1000 / 60)) % totalTicks
      let acc = 0
      let frame = 0
      for (let index = 0; index < (durations.length || frames); index++) {
        acc += Math.max(1, durations[index] ?? 8)
        if (elapsedTicks < acc) {
          frame = index
          break
        }
      }
      frame %= Math.max(1, frames)
      const row = Math.max(0, Math.min(7, facing))
      // Usa una escala común para walk/idle: el sprite conserva su tamaño al moverse
      // y siempre queda dentro del cuadrado de la celda.
      const referenceW = Math.max(1, sprites.walkFrameW, sprites.idleFrameW)
      const referenceH = Math.max(1, sprites.walkFrameH, sprites.idleFrameH)
      const scale = Math.min(canvas.width / referenceW, canvas.height / referenceH)
      const drawW = Math.round(frameW * scale)
      const drawH = Math.round(frameH * scale)
      ctx.drawImage(
        source,
        frame * frameW,
        row * frameH,
        frameW,
        frameH,
        Math.round((canvas.width - drawW) / 2),
        canvas.height - drawH,
        drawW,
        drawH,
      )
      frameId = requestAnimationFrame(draw)
    }

    frameId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameId)
  }, [sprites, facing, animUntil, size])

  return <canvas ref={canvasRef} width={size} height={size} className="dungeon-sprite-canvas" />
}

function hpColor(ratio: number): string {
  if (ratio > 0.55) return '#5bd66f'
  if (ratio > 0.25) return '#f4c542'
  return '#e25555'
}

function MonsterBadge({ monster, lang }: { monster: DungeonMonster; lang: 'es' | 'en' }) {
  const ratio = Math.max(0, monster.p.hp / Math.max(1, monster.p.maxHp))
  return (
    <div className="dungeon-monster-badge">
      <div className="dungeon-monster-name">
        <span>{monster.isLeader ? '★ ' : ''}{monster.p.name}</span>
        <span className="dungeon-monster-level">Nv.{monster.level}</span>
      </div>
      <div className="dungeon-hp-track">
        <div className="dungeon-hp-fill" style={{ width: `${ratio * 100}%`, background: hpColor(ratio) }} />
      </div>
      <div className="dungeon-monster-meta">
        <span>{monster.p.hp}/{monster.p.maxHp} PS</span>
        {monster.status !== 'none' && (
          <span className={`dungeon-status dungeon-status--${monster.status}`}>
            {monster.status === 'poison' ? 'PSN' : monster.status === 'sleep' ? (lang === 'en' ? 'SLP' : 'DOR') : 'PAR'}
          </span>
        )}
      </div>
    </div>
  )
}

export function DungeonRunView({ run, onChange }: DungeonRunProps) {
  const dungeon = DUNGEON_BY_ID[run.dungeonId]
  const leader = getLeader(run)
  const logRef = useRef<HTMLDivElement | null>(null)
  const boardSlotRef = useRef<HTMLDivElement | null>(null)
  const lang = run.lang
  const en = lang === 'en'
  const [cell, setCell] = useState(MAX_CELL)
  const boardWidth = run.map.width * cell
  const boardHeight = run.map.height * cell
  const entitySize = cell

  useLayoutEffect(() => {
    const slot = boardSlotRef.current
    if (!slot) return
    const measure = () => {
      const available = slot.clientWidth
      if (!available) return
      const next = Math.min(
        MAX_CELL,
        Math.max(MIN_CELL, Math.floor((available - BOARD_BORDER) / run.map.width)),
      )
      setCell((current) => (current === next ? current : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(slot)
    return () => observer.disconnect()
  }, [run.map.width])

  const boss = run.enemies.find((enemy) => enemy.isBoss) ?? null

  const visible = useMemo(() => {
    if (run.revealMap) return () => true
    if (!leader) return () => false
    return (x: number, y: number) =>
      Math.max(Math.abs(x - leader.x), Math.abs(y - leader.y)) <= VIEW_RADIUS
  }, [run.revealMap, leader])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [run.log])

  const act = (mutator: (current: DungeonRun) => DungeonRun) => {
    onChange({ ...mutator(run) })
  }

  const move = (dx: number, dy: number) => {
    playClick()
    act((current) => moveLeader(current, dx, dy))
  }

  const attack = () => {
    playClick()
    act((current) => playerAttack(current))
  }

  const wait = () => {
    playClick()
    act((current) => waitTurn(current))
  }

  const consumeItem = (itemId: string) => {
    playClick()
    act((current) => consumeActiveItem(current, itemId))
  }

  const chooseMove = (index: number) => {
    playClick()
    act((current) => selectMove(current, index))
  }

  const changeLeader = (uid: string) => {
    if (uid === run.leaderUid) return
    playClick()
    act((current) => setLeader(current, uid))
  }

  const dismissDialogue = () => {
    playClick()
    act((current) => clearDialogue(current))
  }

  const descend = () => {
    playClick()
    act((current) => descendFloor(current))
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (run.dialogue.length > 0) {
        if (event.key === 'Enter' || event.key === 'Escape' || event.key === ' ') {
          event.preventDefault()
          dismissDialogue()
        }
        return
      }
      if (run.pendingFloor !== null) {
        if (event.key === 'Enter') {
          event.preventDefault()
          descend()
        }
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'arrowup' || key === 'w') { event.preventDefault(); move(0, -1) }
      else if (key === 'arrowdown' || key === 's') { event.preventDefault(); move(0, 1) }
      else if (key === 'arrowleft' || key === 'a') { event.preventDefault(); move(-1, 0) }
      else if (key === 'arrowright' || key === 'd') { event.preventDefault(); move(1, 0) }
      else if (key === 'q') { event.preventDefault(); move(-1, -1) }
      else if (key === 'e') { event.preventDefault(); move(1, -1) }
      else if (key === 'z') { event.preventDefault(); move(-1, 1) }
      else if (key === 'x') { event.preventDefault(); move(1, 1) }
      else if (key === ' ') { event.preventDefault(); wait() }
      else if (key === 'f') { event.preventDefault(); attack() }
      else if (['1', '2', '3', '4'].includes(key)) {
        event.preventDefault()
        chooseMove(Number(key) - 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const currentRoom = leader ? run.map.rooms.find((room) => leader.x >= room.x && leader.x < room.x + room.w && leader.y >= room.y && leader.y < room.y + room.h) : null
  const visibleEnemies = run.enemies.filter((enemy) => visible(enemy.x, enemy.y))
  const visibleItems = run.items.filter((item) => visible(item.x, item.y))
  const visibleChests = run.chests.filter((chest) => visible(chest.x, chest.y))
  const visibleTraps = run.traps.filter((trap) => trap.revealed && visible(trap.x, trap.y))
  const visibleTrees = (run.map.trees ?? [])
    .filter((tree) => !tree.broken && visible(tree.x, tree.y))
    .sort((a, b) => Number(Boolean(a.special)) - Number(Boolean(b.special)))
  const treeTiles = new Set(
    (run.map.trees ?? [])
      .filter((tree) => !tree.broken)
      .map((tree) => `${tree.x},${tree.y}`),
  )

  const moveList = leader?.p.moves.slice(0, 4) ?? []

  return (
    <div className="dungeon-run">
      <header className="dungeon-run-header">
        <div className="dungeon-run-title">
          <button className="dungeon-ghost-btn" type="button" onClick={() => { playClick(); onChange({ ...run, status: 'escaped' }) }}>
            ← {en ? 'Leave' : 'Abandonar'}
          </button>
          <div>
            <strong>{dungeon.icon} {en ? dungeon.nameEn : dungeon.name}</strong>
            <span className="dungeon-run-sub">
              {en ? 'Floor' : 'Piso'} {run.floor}/{run.totalFloors} · {en ? 'Turn' : 'Turno'} {run.turn}
            </span>
          </div>
        </div>
        <div className="dungeon-run-stats">
          <span className="dungeon-crystal-pill">💠 {run.crystalsEarned}</span>
          <span className="dungeon-stat">☠️ {run.enemiesDefeated}</span>
          <span className="dungeon-stat">🤝 {run.recruits}</span>
        </div>
      </header>

      <div className="dungeon-run-body">
        <section className="dungeon-map-panel">
          <div className="dungeon-board-slot" ref={boardSlotRef}>
            <div
              className={`dungeon-board${run.dungeonId === 'forest' ? ' dungeon-board--forest' : ''}`}
              style={{ width: boardWidth, height: boardHeight }}
            >
                {run.map.tiles.map((row, y) =>
                  row.map((tile, x) => {
                if (!visible(x, y)) {
                  return (
                    <div
                      key={`${x}-${y}`}
                      className="dungeon-tile dungeon-tile--hidden"
                      style={{ left: x * cell, top: y * cell, width: cell, height: cell }}
                    />
                  )
                }
                const isStairTile = tile === 2
                const isWall = tile === 0
                const isForest = run.dungeonId === 'forest'
                const hasTree = isWall && treeTiles.has(`${x},${y}`)
                const groundLike = !isWall || isForest
                const hash = tileHash(x, y)
                const decoRoll = hash % 100
                const wallAbove = !isWall && y > 0 && run.map.tiles[y - 1]?.[x] === 0
                const wallLeft = !isWall && x > 0 && run.map.tiles[y]?.[x - 1] === 0
                const showDeco = isForest && groundLike && !isStairTile && decoRoll < 34
                const decoKind = hash % 3 === 0 ? 'tuft' : hash % 3 === 1 ? 'pebbles' : 'flower'
                const showMoss = isForest && isWall && !hasTree && decoRoll < 22
                const tileClass = [
                  'dungeon-tile',
                  groundLike ? 'dungeon-tile--floor' : 'dungeon-tile--wall',
                  isStairTile ? 'dungeon-tile--stairs' : '',
                  wallAbove ? 'dungeon-tile--shadow-top' : '',
                  wallLeft ? 'dungeon-tile--shadow-left' : '',
                ].filter(Boolean).join(' ')
                return (
                  <div
                    key={`${x}-${y}`}
                    className={tileClass}
                    style={{
                      left: x * cell,
                      top: y * cell,
                      width: cell,
                      height: cell,
                      background: groundLike
                        ? `radial-gradient(circle at 28% 24%, rgba(255, 255, 255, 0.05), transparent 58%), ${(x + y) % 2 === 0 ? dungeon.palette.floor : dungeon.palette.floorAlt}`
                        : `repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.08) 0 1px, transparent 1px 7px), linear-gradient(160deg, ${dungeon.palette.wallTop}, ${dungeon.palette.wall})`,
                      borderTopColor: groundLike ? undefined : dungeon.palette.wallTop,
                    }}
                  >
                    {isStairTile && <span className="dungeon-stairs">🌀</span>}
                    {showDeco && (
                      <span
                        aria-hidden="true"
                        className={`dungeon-tile-deco dungeon-tile-deco--${decoKind}`}
                        style={{
                          left: `${20 + ((hash >>> 8) % 62)}%`,
                          top: `${22 + ((hash >>> 16) % 58)}%`,
                        }}
                      />
                    )}
                    {showMoss && (
                      <span
                        aria-hidden="true"
                        className="dungeon-tile-moss"
                        style={{
                          left: `${12 + ((hash >>> 12) % 68)}%`,
                          bottom: `${6 + ((hash >>> 20) % 16)}%`,
                        }}
                      />
                    )}
                  </div>
                )
              }),
            )}

            {visibleTrees.map((tree) => {
              const special = Boolean(tree.special)
              const width = Math.round(cell * (special ? 1.16 : tree.scale))
              const height = special ? width : Math.round(width * 1.5)
              const column = tree.frame % TREE_SHEET_COLUMNS
              const row = Math.floor(tree.frame / TREE_SHEET_COLUMNS)
              const left = Math.round(
                Math.min(
                  Math.max(0, tree.x * cell + (cell - width) / 2),
                  run.map.width * cell - width,
                ),
              )
              const top = Math.max(0, tree.y * cell + cell - height)
              return (
                <div
                  key={`tree-${tree.x}-${tree.y}`}
                  aria-hidden="true"
                  className={`dungeon-tree${special ? ' dungeon-tree--special' : ''}`}
                  title={special ? (en ? 'Breakable tree — Fire attack' : 'Árbol rompible — ataque de Fuego') : undefined}
                  style={{
                    left,
                    top,
                    width,
                    height,
                    backgroundImage: `url(${special ? specialTreeUrl : treeSheetUrl})`,
                    backgroundSize: special
                      ? '100% 100%'
                      : `${width * TREE_SHEET_COLUMNS}px ${height * TREE_SHEET_ROWS}px`,
                    backgroundPosition: special ? '0 0' : `${-column * width}px ${-row * height}px`,
                    transform: tree.flip ? 'scaleX(-1)' : undefined,
                  }}
                />
              )
            })}

            {currentRoom && (
              <div
                className="dungeon-room-glow"
                style={{
                  left: currentRoom.x * cell,
                  top: currentRoom.y * cell,
                  width: currentRoom.w * cell,
                  height: currentRoom.h * cell,
                  borderColor: dungeon.palette.accent,
                }}
              />
            )}

            {visibleChests.map((chest) => (
              <div
                key={`chest-${chest.x}-${chest.y}`}
                className="dungeon-ground-icon"
                style={{ left: chest.x * cell, top: chest.y * cell, width: cell, height: cell }}
              >
                {chest.opened ? '📭' : '📦'}
              </div>
            ))}

            {visibleItems.map((item) => {
              const definition = ACTIVE_BY_ID[item.itemId]
              return (
                <div
                  key={item.id}
                  className="dungeon-ground-icon dungeon-item-bob"
                  style={{ left: item.x * cell, top: item.y * cell, width: cell, height: cell }}
                  title={definition ? (en ? definition.nameEn : definition.name) : item.itemId}
                >
                  {definition ? (
                    <img
                      className="dungeon-item-sprite dungeon-ground-item-sprite"
                      src={definition.sprite}
                      alt=""
                      loading="lazy"
                      onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
                    />
                  ) : '🎁'}
                </div>
              )
            })}

            {visibleTraps.map((trap) => (
              <div
                key={`trap-${trap.x}-${trap.y}`}
                className="dungeon-ground-icon dungeon-trap"
                style={{ left: trap.x * cell, top: trap.y * cell, width: cell, height: cell }}
                title={trap.kind}
              >
                ⚠️
              </div>
            ))}

            {visibleEnemies.map((enemy) => (
              <div
                key={enemy.uid}
                className="dungeon-entity dungeon-entity--enemy"
                style={{ left: enemy.x * cell, top: enemy.y * cell, width: cell, height: cell }}
              >
                <PmdSprite sprites={enemy.pmd} facing={enemy.facing} animUntil={enemy.animUntil} size={entitySize} />
                <div className="dungeon-enemy-hp">
                  <div
                    className="dungeon-enemy-hp-fill"
                    style={{ width: `${Math.max(0, (enemy.p.hp / Math.max(1, enemy.p.maxHp)) * 100)}%` }}
                  />
                </div>
                {enemy.isBoss && <span className="dungeon-boss-crown">👑</span>}
              </div>
            ))}

            {run.party.map((member) => (
              <div
                key={member.uid}
                className={`dungeon-entity dungeon-entity--ally ${member.uid === run.leaderUid ? 'dungeon-entity--leader' : ''}`}
                style={{ left: member.x * cell, top: member.y * cell, width: cell, height: cell }}
              >
                <PmdSprite sprites={member.pmd} facing={member.facing} animUntil={member.animUntil} size={entitySize} />
              </div>
            ))}

            {run.floatTexts.map((floatText, index) => (
              <div
                key={`${floatText.born}-${index}`}
                className="dungeon-float-text"
                style={{
                  left: floatText.x * cell + cell / 2,
                  top: floatText.y * cell,
                  color: floatText.color,
                }}
              >
                {floatText.text}
              </div>
            ))}

            {run.dungeonId === 'forest' && (
              <div className="dungeon-fireflies" aria-hidden="true">
                {FIREFLIES.map((fly, index) => (
                  <span
                    key={index}
                    style={{
                      left: `${fly.left}%`,
                      top: `${fly.top}%`,
                      animationDelay: `${fly.delay}s`,
                      animationDuration: `${fly.duration}s`,
                    }}
                  />
                ))}
              </div>
            )}
            </div>
          </div>

          <div className="dungeon-controls">
            <div className="dungeon-dpad">
              <button type="button" className="dungeon-pad-btn" onMouseEnter={playHover} onClick={() => move(-1, -1)}>↖</button>
              <button type="button" className="dungeon-pad-btn" onMouseEnter={playHover} onClick={() => move(0, -1)}>↑</button>
              <button type="button" className="dungeon-pad-btn" onMouseEnter={playHover} onClick={() => move(1, -1)}>↗</button>
              <button type="button" className="dungeon-pad-btn" onMouseEnter={playHover} onClick={() => move(-1, 0)}>←</button>
              <button type="button" className="dungeon-pad-btn dungeon-pad-btn--wait" onMouseEnter={playHover} onClick={wait}>⏳</button>
              <button type="button" className="dungeon-pad-btn" onMouseEnter={playHover} onClick={() => move(1, 0)}>→</button>
              <button type="button" className="dungeon-pad-btn" onMouseEnter={playHover} onClick={() => move(-1, 1)}>↙</button>
              <button type="button" className="dungeon-pad-btn" onMouseEnter={playHover} onClick={() => move(0, 1)}>↓</button>
              <button type="button" className="dungeon-pad-btn" onMouseEnter={playHover} onClick={() => move(1, 1)}>↘</button>
            </div>
            <div className="dungeon-action-buttons">
              <button type="button" className="dungeon-action-btn dungeon-action-btn--attack" onClick={attack} onMouseEnter={playHover}>
                ⚔️ {en ? 'Attack' : 'Atacar'}
              </button>
              <button type="button" className="dungeon-action-btn" onClick={() => { playClick(); chooseMove(((run.selectedMove ?? 0) + 1) % Math.max(1, moveList.length)) }} onMouseEnter={playHover}>
                🎯 {en ? 'Move' : 'Movimiento'} {(run.selectedMove ?? 0) + 1}
              </button>
              <div className="dungeon-key-hint">WASD / flechas · Espacio esperar · F atacar</div>
            </div>
          </div>
        </section>

        <aside className="dungeon-side">
          {boss && (
            <section className="dungeon-panel dungeon-boss-panel">
              <h3>👑 {boss.p.name}</h3>
              <div className="dungeon-hp-track dungeon-hp-track--big">
                <div
                  className="dungeon-hp-fill"
                  style={{ width: `${Math.max(0, (boss.p.hp / Math.max(1, boss.p.maxHp)) * 100)}%`, background: '#e25555' }}
                />
              </div>
              <span className="dungeon-muted">{boss.p.hp}/{boss.p.maxHp} PS</span>
            </section>
          )}

          <section className="dungeon-panel">
            <h3>🧭 {en ? 'Team' : 'Equipo'}</h3>
            <p className="dungeon-party-hint">
              {en ? 'Click a Pokémon to make it leader.' : 'Haz clic en un Pokémon para hacerlo líder.'}
            </p>
            <div className="dungeon-party-list">
              {run.party.map((member) => (
                <div
                  key={member.uid}
                  role="button"
                  tabIndex={0}
                  aria-pressed={member.uid === run.leaderUid}
                  className={`dungeon-party-card ${member.uid === run.leaderUid ? 'is-leader' : ''}`}
                  title={member.uid === run.leaderUid
                    ? (en ? 'Current leader' : 'Líder actual')
                    : (en ? 'Click to make leader' : 'Clic para hacer líder')}
                  onClick={() => changeLeader(member.uid)}
                  onMouseEnter={playHover}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      changeLeader(member.uid)
                    }
                  }}
                >
                  <img
                    src={pmdPortraitUrl(member.p.id)}
                    alt=""
                    className="dungeon-party-portrait"
                    onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
                  />
                  <MonsterBadge monster={member} lang={lang} />
                </div>
              ))}
              {run.fallen.length > 0 && (
                <div className="dungeon-fallen">
                  {en ? 'Fallen: ' : 'Caídos: '}
                  {run.fallen.map((member) => member.p.name).join(', ')}
                </div>
              )}
            </div>
          </section>

          <section className="dungeon-panel">
            <h3>⚔️ {en ? 'Moves' : 'Movimientos'} · {leader?.p.name ?? ''}</h3>
            <div className="dungeon-move-list">
              {moveList.map((move, index) => (
                <button
                  key={`${move.name}-${index}`}
                  type="button"
                  className={`dungeon-move-btn ${run.selectedMove === index ? 'is-selected' : ''}`}
                  onClick={() => chooseMove(index)}
                  onMouseEnter={playHover}
                  title={move.description}
                >
                  <span className="dungeon-move-index">{index + 1}</span>
                  <span className="dungeon-move-name">{move.name}</span>
                  <span className={`dungeon-type dungeon-type--${move.type}`}>{move.type}</span>
                  <span className="dungeon-move-pp">{move.pp ?? '∞'}/{move.maxPp ?? '∞'}</span>
                </button>
              ))}
              {moveList.length === 0 && <span className="dungeon-muted">{en ? 'No moves.' : 'Sin movimientos.'}</span>}
            </div>
          </section>

          <section className="dungeon-panel">
            <h3>🎒 {en ? 'Bag' : 'Bolsa'} ({Object.values(run.bag).reduce((sum, n) => sum + n, 0)}/{run.bagCapacity})</h3>
            <div className="dungeon-bag-list">
              {Object.entries(run.bag).map(([itemId, count]) => {
                const definition = ACTIVE_BY_ID[itemId]
                if (!definition) return null
                return (
                  <div key={itemId} className="dungeon-bag-row">
                    <span className="dungeon-bag-icon">
                      <img
                        className="dungeon-item-sprite dungeon-bag-item-sprite"
                        src={definition.sprite}
                        alt=""
                        loading="lazy"
                        onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
                      />
                    </span>
                    <div className="dungeon-bag-info">
                      <strong>{en ? definition.nameEn : definition.name} ×{count}</strong>
                      <span>{en ? definition.descEn : definition.desc}</span>
                    </div>
                    <button
                      type="button"
                      className="dungeon-use-btn"
                      disabled={!canUseItem(run, itemId)}
                      onClick={() => consumeItem(itemId)}
                      onMouseEnter={playHover}
                    >
                      {en ? 'Use' : 'Usar'}
                    </button>
                  </div>
                )
              })}
              {Object.keys(run.bag).length === 0 && (
                <span className="dungeon-muted">{en ? 'Your bag is empty.' : 'La bolsa está vacía.'}</span>
              )}
            </div>
          </section>

          <section className="dungeon-panel dungeon-log-panel">
            <h3>📜 {en ? 'Journal' : 'Diario'}</h3>
            <div className="dungeon-log" ref={logRef}>
              {run.log.slice(-12).map((line, index) => (
                <div key={`${index}-${line}`} className="dungeon-log-line">{line}</div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {run.dialogue.length > 0 && (
        <div className="dungeon-dialogue-backdrop" onClick={dismissDialogue}>
          <div className="dungeon-dialogue" onClick={(event) => event.stopPropagation()}>
            {run.dialogue[0].speakerId && (
              <img
                src={pmdPortraitUrl(run.dialogue[0].speakerId, (run.dialogue[0].emotion ?? 'Normal') as PortraitEmotion)}
                alt=""
                className="dungeon-dialogue-portrait"
                onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
              />
            )}
            <div className="dungeon-dialogue-body">
              <strong>{run.dialogue[0].name}</strong>
              <p>{run.dialogue[0].text}</p>
              <button type="button" className="dungeon-primary-btn" onClick={dismissDialogue} onMouseEnter={playHover}>
                {en ? 'Continue' : 'Continuar'} ▸
              </button>
            </div>
          </div>
        </div>
      )}

      {run.pendingFloor !== null && (
        <div className="dungeon-dialogue-backdrop">
          <div className="dungeon-dialogue dungeon-dialogue--stairs">
            <div className="dungeon-dialogue-body">
              <strong>🌀 {en ? 'Stairs found' : 'Escaleras encontradas'}</strong>
              <p>
                {en
                  ? `Descend to floor ${run.pendingFloor}? Your team will recover a little, but new dangers await.`
                  : `¿Descender al piso ${run.pendingFloor}? El equipo descansará un poco, pero nuevos peligros aguardan.`}
              </p>
              <div className="dungeon-dialogue-actions">
                <button type="button" className="dungeon-primary-btn" onClick={descend} onMouseEnter={playHover}>
                  ↓ {en ? 'Descend' : 'Descender'}
                </button>
                <button
                  type="button"
                  className="dungeon-secondary-btn"
                  onClick={() => { playClick(); onChange({ ...run, pendingFloor: null }) }}
                >
                  {en ? 'Keep exploring' : 'Seguir explorando'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
