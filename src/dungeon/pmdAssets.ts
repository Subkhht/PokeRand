import type { PmdSprites } from './types'

const SPRITE_BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite'
const PORTRAIT_BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait'

export type PortraitEmotion =
  | 'Normal'
  | 'Happy'
  | 'Joyous'
  | 'Inspired'
  | 'Determined'
  | 'Surprised'
  | 'Worried'
  | 'Sad'
  | 'Pain'
  | 'Angry'
  | 'Crying'
  | 'Shouting'
  | 'Teary-Eyed'
  | 'Sigh'
  | 'Dizzy'
  | 'Stunned'

const assetCache = new Map<number, PmdSprites>()
const pendingLoads = new Map<number, Promise<PmdSprites>>()

export function pmdFolder(id: number): string {
  return String(id).padStart(4, '0')
}

export function pmdSpriteUrl(id: number, action: 'Walk' | 'Idle' | 'Sleep' | string): string {
  return `${SPRITE_BASE}/${pmdFolder(id)}/${action}-Anim.png`
}

export function pmdPortraitUrl(id: number, emotion: PortraitEmotion = 'Normal'): string {
  return `${PORTRAIT_BASE}/${pmdFolder(id)}/${emotion}.png`
}

interface AnimInfo {
  frameW: number
  frameH: number
  durations: number[]
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

function directChildText(element: Element, tag: string): string | null {
  for (const child of Array.from(element.children)) {
    if (child.tagName === tag) return child.textContent
  }
  return null
}

function parseAnimData(text: string): Map<string, AnimInfo> {
  const result = new Map<string, AnimInfo>()
  try {
    const doc = new DOMParser().parseFromString(text, 'text/xml')
    for (const anim of Array.from(doc.getElementsByTagName('Anim'))) {
      const name = directChildText(anim, 'Name')?.trim()
      if (!name) continue
      const frameW = Number(directChildText(anim, 'FrameWidth') ?? 0)
      const frameH = Number(directChildText(anim, 'FrameHeight') ?? 0)
      const durations: number[] = []
      const durationBox = Array.from(anim.children).find((child) => child.tagName === 'Durations')
      if (durationBox) {
        for (const child of Array.from(durationBox.children)) {
          const value = Number(child.textContent ?? 0)
          if (Number.isFinite(value) && value > 0) durations.push(value)
        }
      }
      if (frameW > 0 && frameH > 0) {
        result.set(name, { frameW, frameH, durations })
      }
    }
  } catch {
    // XML corrupto o no disponible: se usará la estimación por dimensiones.
  }
  return result
}

async function fetchAnimData(id: number): Promise<Map<string, AnimInfo>> {
  try {
    const response = await fetch(`${SPRITE_BASE}/${pmdFolder(id)}/AnimData.xml`)
    if (!response.ok) return new Map()
    return parseAnimData(await response.text())
  } catch {
    return new Map()
  }
}

function estimateFrame(image: HTMLImageElement): { w: number; h: number; frames: number } {
  const h = Math.max(1, Math.round(image.naturalHeight / 8))
  const w = h
  const frames = Math.max(1, Math.round(image.naturalWidth / w))
  return { w, h, frames }
}

async function buildSprites(id: number, fallbackUrl?: string): Promise<PmdSprites> {
  const [animData, walkImage, idleImage] = await Promise.all([
    fetchAnimData(id),
    loadImage(pmdSpriteUrl(id, 'Walk')),
    loadImage(pmdSpriteUrl(id, 'Idle')),
  ])

  const fallback = async (): Promise<PmdSprites> => {
    const image = fallbackUrl ? await loadImage(fallbackUrl) : null
    if (!image) {
      return {
        walk: null,
        idle: null,
        walkFrames: 1,
        walkFrameW: 1,
        walkFrameH: 1,
        idleFrames: 1,
        idleFrameW: 1,
        idleFrameH: 1,
        walkDurations: [10],
        idleDurations: [10],
        isFallback: true,
      }
    }
    return {
      walk: image,
      idle: image,
      walkFrames: 1,
      walkFrameW: image.naturalWidth,
      walkFrameH: image.naturalHeight,
      idleFrames: 1,
      idleFrameW: image.naturalWidth,
      idleFrameH: image.naturalHeight,
      walkDurations: [10],
      idleDurations: [10],
      isFallback: true,
    }
  }

  const walkSource = walkImage ?? idleImage
  if (!walkSource) return fallback()

  const walkInfo = animData.get('Walk')
  const idleInfo = animData.get('Idle')
  const walkEstimate = estimateFrame(walkSource)
  const walkFrameW = walkInfo?.frameW ?? walkEstimate.w
  const walkFrameH = walkInfo?.frameH ?? walkEstimate.h
  const walkFrames = Math.max(1, Math.round(walkSource.naturalWidth / walkFrameW))

  let idleFrameW = idleInfo?.frameW ?? walkFrameW
  let idleFrameH = idleInfo?.frameH ?? walkFrameH
  let idleFrames = 1
  if (idleImage) {
    const estimate = estimateFrame(idleImage)
    if (!idleInfo) {
      idleFrameW = estimate.w
      idleFrameH = estimate.h
    }
    idleFrames = Math.max(1, Math.round(idleImage.naturalWidth / idleFrameW))
  }

  return {
    walk: walkSource,
    idle: idleImage ?? walkSource,
    walkFrames,
    walkFrameW,
    walkFrameH,
    idleFrames,
    idleFrameW,
    idleFrameH,
    walkDurations: walkInfo?.durations?.length ? walkInfo.durations : Array.from({ length: walkFrames }, () => 8),
    idleDurations: idleInfo?.durations?.length ? idleInfo.durations : Array.from({ length: idleFrames }, () => 10),
    isFallback: false,
  }
}

export function getCachedSprites(id: number): PmdSprites | null {
  return assetCache.get(id) ?? null
}

export function loadPmdSprites(id: number, fallbackUrl?: string): Promise<PmdSprites> {
  const cached = assetCache.get(id)
  if (cached) return Promise.resolve(cached)
  const pending = pendingLoads.get(id)
  if (pending) return pending
  const promise = buildSprites(id, fallbackUrl)
    .then((sprites) => {
      assetCache.set(id, sprites)
      pendingLoads.delete(id)
      return sprites
    })
    .catch(() => {
      const empty: PmdSprites = {
        walk: null,
        idle: null,
        walkFrames: 1,
        walkFrameW: 1,
        walkFrameH: 1,
        idleFrames: 1,
        idleFrameW: 1,
        idleFrameH: 1,
        walkDurations: [10],
        idleDurations: [10],
        isFallback: true,
      }
      assetCache.set(id, empty)
      pendingLoads.delete(id)
      return empty
    })
  pendingLoads.set(id, promise)
  return promise
}

export async function loadPmdAssets(
  entries: Array<{ id: number; fallbackUrl?: string }>,
): Promise<Record<number, PmdSprites>> {
  const unique = new Map<number, string | undefined>()
  for (const entry of entries) {
    if (!unique.has(entry.id)) unique.set(entry.id, entry.fallbackUrl)
  }
  const ids = Array.from(unique.keys())
  const sprites = await Promise.all(
    ids.map((id) => loadPmdSprites(id, unique.get(id))),
  )
  const result: Record<number, PmdSprites> = {}
  ids.forEach((id, index) => {
    result[id] = sprites[index]
  })
  return result
}

export type { AnimInfo }
