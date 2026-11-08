import { createSeededRandom } from '../game/engine'
import type { DungeonId, DungeonMap, MapTree, Rect, TileKind } from './types'

const WALL: TileKind = 0
const FLOOR: TileKind = 1
const STAIRS: TileKind = 2

const TREE_FRAME_COUNT = 15

export interface MapGenOptions {
  width?: number
  height?: number
  dungeonId?: DungeonId
}

function makeGrid(width: number, height: number): TileKind[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => WALL))
}

function center(rect: Rect): { x: number; y: number } {
  return {
    x: Math.floor(rect.x + rect.w / 2),
    y: Math.floor(rect.y + rect.h / 2),
  }
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x - 1 < b.x + b.w &&
    a.x + a.w + 1 > b.x &&
    a.y - 1 < b.y + b.h &&
    a.y + a.h + 1 > b.y
  )
}

function carveRoom(tiles: TileKind[][], rect: Rect): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (tiles[y]?.[x] !== undefined) tiles[y][x] = FLOOR
    }
  }
}

function carveCorridor(tiles: TileKind[][], from: { x: number; y: number }, to: { x: number; y: number }, rng: () => number): void {
  let x = from.x
  let y = from.y
  const horizontalFirst = rng() > 0.5
  const carveX = () => {
    while (x !== to.x) {
      x += x < to.x ? 1 : -1
      if (tiles[y]?.[x] !== undefined) tiles[y][x] = FLOOR
    }
  }
  const carveY = () => {
    while (y !== to.y) {
      y += y < to.y ? 1 : -1
      if (tiles[y]?.[x] !== undefined) tiles[y][x] = FLOOR
    }
  }
  if (horizontalFirst) {
    carveX()
    carveY()
  } else {
    carveY()
    carveX()
  }
}

const SPECIAL_TREE_CHANCE = 0.035

function forestTrees(
  tiles: TileKind[][],
  width: number,
  height: number,
  seed: string,
): MapTree[] {
  const rng = createSeededRandom(`${seed}-forest-trees`)
  const trees: MapTree[] = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y]?.[x] !== WALL) continue
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1
      const nearFloor =
        tiles[y - 1]?.[x] === FLOOR ||
        tiles[y + 1]?.[x] === FLOOR ||
        tiles[y]?.[x - 1] === FLOOR ||
        tiles[y]?.[x + 1] === FLOOR ||
        tiles[y - 1]?.[x] === STAIRS ||
        tiles[y + 1]?.[x] === STAIRS ||
        tiles[y]?.[x - 1] === STAIRS ||
        tiles[y]?.[x + 1] === STAIRS

      trees.push({
        x,
        y,
        frame: Math.floor(rng() * TREE_FRAME_COUNT),
        flip: rng() < 0.5,
        scale: border ? 0.88 + rng() * 0.2 : 0.7 + rng() * 0.16,
        special: nearFloor && rng() < SPECIAL_TREE_CHANCE,
        broken: false,
      })
    }
  }
  return trees
}

export function generateDungeonMap(
  seed: string,
  { width = 19, height = 13, dungeonId }: MapGenOptions = {},
): DungeonMap {
  const rng = createSeededRandom(seed)
  const tiles = makeGrid(width, height)
  const rooms: Rect[] = []
  const targetRooms = 5 + Math.floor(rng() * 2)

  for (let attempt = 0; attempt < 90 && rooms.length < targetRooms; attempt++) {
    const w = 3 + Math.floor(rng() * 4)
    const h = 3 + Math.floor(rng() * 3)
    const x = 1 + Math.floor(rng() * Math.max(1, width - w - 2))
    const y = 1 + Math.floor(rng() * Math.max(1, height - h - 2))
    const rect: Rect = { x, y, w, h }
    if (rooms.some((room) => overlaps(room, rect))) continue
    rooms.push(rect)
    carveRoom(tiles, rect)
  }

  if (rooms.length < 2) {
    const rect: Rect = { x: 2, y: 2, w: Math.max(5, width - 4), h: Math.max(4, height - 4) }
    rooms.length = 0
    rooms.push(rect)
    carveRoom(tiles, rect)
  }

  for (let index = 1; index < rooms.length; index++) {
    carveCorridor(tiles, center(rooms[index - 1]), center(rooms[index]), rng)
  }

  // Pasillos extra para que el mapa no sea un árbol perfecto.
  for (let index = 0; index + 2 < rooms.length; index++) {
    if (rng() < 0.45) {
      carveCorridor(tiles, center(rooms[index]), center(rooms[index + 2]), rng)
    }
  }

  const start = center(rooms[0])
  const lastRoom = rooms[rooms.length - 1]
  let stairs = center(lastRoom)
  if (stairs.x === start.x && stairs.y === start.y && rooms.length > 1) {
    stairs = center(rooms[rooms.length - 2])
  }
  tiles[stairs.y][stairs.x] = STAIRS

  return {
    width,
    height,
    tiles,
    rooms,
    start,
    stairs,
    trees: dungeonId === 'forest' ? forestTrees(tiles, width, height, seed) : [],
  }
}

export function isWalkable(map: DungeonMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false
  return map.tiles[y][x] !== WALL
}

export function isStairs(map: DungeonMap, x: number, y: number): boolean {
  return map.tiles[y]?.[x] === STAIRS
}

export function roomIndexAt(map: DungeonMap, x: number, y: number): number {
  return map.rooms.findIndex(
    (room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h,
  )
}

export function roomCenter(room: Rect): { x: number; y: number } {
  return center(room)
}

export function randomFloorInRoom(
  map: DungeonMap,
  room: Rect,
  rng: () => number,
  occupied: Set<string>,
): { x: number; y: number } {
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = room.x + Math.floor(rng() * room.w)
    const y = room.y + Math.floor(rng() * room.h)
    const key = `${x},${y}`
    if (isWalkable(map, x, y) && !occupied.has(key) && !isStairs(map, x, y)) {
      occupied.add(key)
      return { x, y }
    }
  }
  const fallback = center(room)
  occupied.add(`${fallback.x},${fallback.y}`)
  return fallback
}

export function randomFloorTile(
  map: DungeonMap,
  rng: () => number,
  occupied: Set<string>,
): { x: number; y: number } {
  for (let attempt = 0; attempt < 120; attempt++) {
    const x = 1 + Math.floor(rng() * (map.width - 2))
    const y = 1 + Math.floor(rng() * (map.height - 2))
    const key = `${x},${y}`
    if (isWalkable(map, x, y) && !occupied.has(key) && !isStairs(map, x, y)) {
      occupied.add(key)
      return { x, y }
    }
  }
  return map.start
}
