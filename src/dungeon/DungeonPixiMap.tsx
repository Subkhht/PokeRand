import { useEffect, useRef } from 'react'
import { Application, Container, Sprite, Texture } from 'pixi.js'
import type { DungeonId } from './types'

interface DungeonPixiMapProps {
  dungeonId: DungeonId
  accent?: string
  leaderX: number
  leaderY: number
  cell: number
}

type ParticleKind = 'firefly' | 'pollen' | 'leaf' | 'mote' | 'spark' | 'sand' | 'ember' | 'glint'

interface MapParticle {
  sprite: Sprite
  kind: ParticleKind
  vx: number
  vy: number
  phase: number
  baseAlpha: number
}

interface MapFog {
  sprite: Sprite
  speed: number
}

interface MapState {
  width: number
  height: number
  reduced: boolean
  world: Container
  glowLayer: Container
  particleLayer: Container
  fogLayer: Container
  particles: MapParticle[]
  fog: MapFog[]
  leaderLight: Sprite | null
  leaderX: number
  leaderY: number
  cell: number
}

function makeSoftTexture(): Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.55)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  return Texture.from(canvas)
}

function clearLayer(layer: Container): void {
  for (const child of layer.removeChildren()) {
    child.destroy()
  }
}

function buildScene(
  app: Application,
  state: MapState,
  soft: Texture,
  dungeonId: DungeonId,
  accent: number,
): void {
  const width = Math.max(1, app.renderer.width / app.renderer.resolution)
  const height = Math.max(1, app.renderer.height / app.renderer.resolution)
  const compact = width < 720
  state.width = width
  state.height = height

  clearLayer(state.glowLayer)
  clearLayer(state.particleLayer)
  clearLayer(state.fogLayer)
  state.particles = []
  state.fog = []

  const addParticle = (
    kind: ParticleKind,
    count: number,
    tints: number[],
    options: { minScale: number; maxScale: number; speed: number; alpha: number },
  ) => {
    for (let index = 0; index < count; index += 1) {
      const sprite = new Sprite(soft)
      sprite.anchor.set(0.5)
      sprite.position.set(Math.random() * width, Math.random() * height)
      const scale = options.minScale + Math.random() * (options.maxScale - options.minScale)
      sprite.scale.set(kind === 'leaf' ? scale * 2.1 : scale, kind === 'leaf' ? scale * 1.05 : scale)
      sprite.tint = tints[Math.floor(Math.random() * tints.length)]
      sprite.alpha = options.alpha * (0.55 + Math.random() * 0.45)
      if (kind === 'leaf') sprite.rotation = Math.random() * Math.PI * 2
      state.particleLayer.addChild(sprite)
      state.particles.push({
        sprite,
        kind,
        vx: options.speed * (0.45 + Math.random()),
        vy: options.speed * (0.25 + Math.random() * 0.6),
        phase: Math.random() * Math.PI * 2,
        baseAlpha: sprite.alpha,
      })
    }
  }

  const addFog = (count: number, tint: number) => {
    for (let index = 0; index < count; index += 1) {
      const sprite = new Sprite(soft)
      sprite.anchor.set(0.5)
      sprite.position.set(Math.random() * width, height * (0.2 + Math.random() * 0.65))
      sprite.scale.set(width * (0.06 + Math.random() * 0.05))
      sprite.tint = tint
      sprite.alpha = 0.035 + Math.random() * 0.045
      state.fogLayer.addChild(sprite)
      state.fog.push({ sprite, speed: 0.05 + Math.random() * 0.08 })
    }
  }

  if (dungeonId === 'forest') {
    addParticle('firefly', compact ? 18 : 30, [0xd8f58a, 0xbff28a, 0xffe89a], { minScale: 0.025, maxScale: 0.055, speed: 0.1, alpha: 0.75 })
    addParticle('pollen', compact ? 8 : 14, [0xf0e08a, 0xd8f58a], { minScale: 0.018, maxScale: 0.035, speed: 0.07, alpha: 0.45 })
    addParticle('leaf', compact ? 4 : 8, [0x7da36b, 0x9ac17f, 0xb7d48f], { minScale: 0.035, maxScale: 0.075, speed: 0.18, alpha: 0.55 })
    addFog(2, 0x6a8a5a)
  } else if (dungeonId === 'cave') {
    addParticle('mote', compact ? 16 : 28, [0x7fd8ff, 0xc084fc, 0xb8f4ff], { minScale: 0.025, maxScale: 0.06, speed: 0.12, alpha: 0.8 })
    addParticle('glint', compact ? 8 : 14, [0xffffff, 0x7fd8ff, 0xc084fc], { minScale: 0.035, maxScale: 0.085, speed: 0.04, alpha: 0.65 })
    addFog(3, 0x7a5a9a)
  } else if (dungeonId === 'tower') {
    addParticle('spark', compact ? 16 : 28, [0x7fd8ff, 0xc084fc, 0xffe89a], { minScale: 0.03, maxScale: 0.07, speed: 0.2, alpha: 0.8 })
    addParticle('glint', compact ? 6 : 10, [0xffffff, 0x7fd8ff], { minScale: 0.03, maxScale: 0.07, speed: 0.05, alpha: 0.6 })
    addFog(2, 0x5a6aa0)
  } else if (dungeonId === 'desert') {
    addParticle('sand', compact ? 20 : 38, [0xd8b46a, 0xc9a76a, 0xf0d79a], { minScale: 0.018, maxScale: 0.04, speed: 0.5, alpha: 0.5 })
    addParticle('glint', compact ? 6 : 10, [0xffe89a, 0xffffff], { minScale: 0.03, maxScale: 0.06, speed: 0.04, alpha: 0.55 })
    addFog(3, 0xc9a76a)
  } else if (dungeonId === 'abyss') {
    addParticle('ember', compact ? 18 : 32, [0xff6a3c, 0xc084fc, 0xff9a5c], { minScale: 0.03, maxScale: 0.07, speed: 0.2, alpha: 0.8 })
    addParticle('mote', compact ? 8 : 14, [0xc084fc, 0x7fd8ff], { minScale: 0.025, maxScale: 0.05, speed: 0.1, alpha: 0.65 })
    addFog(3, 0x5a2a4a)
  } else {
    addParticle('mote', compact ? 10 : 18, [0x7fd8ff, 0xc084fc], { minScale: 0.025, maxScale: 0.06, speed: 0.12, alpha: 0.7 })
    addParticle('ember', compact ? 8 : 14, [0xff6a3c, 0xffd166], { minScale: 0.03, maxScale: 0.06, speed: 0.16, alpha: 0.7 })
    addParticle('glint', compact ? 5 : 9, [0xffffff, 0xffe89a], { minScale: 0.03, maxScale: 0.07, speed: 0.04, alpha: 0.55 })
    addFog(2, 0x6a4a8a)
  }

  // Luz del líder
  const leaderLight = new Sprite(soft)
  leaderLight.anchor.set(0.5)
  leaderLight.tint = accent
  leaderLight.alpha = 0.16
  leaderLight.scale.set(Math.max(1, state.cell * 0.03))
  leaderLight.position.set((state.leaderX + 0.5) * state.cell, (state.leaderY + 0.5) * state.cell)
  state.glowLayer.addChild(leaderLight)
  state.leaderLight = leaderLight

  const ambient = new Sprite(soft)
  ambient.anchor.set(0.5)
  ambient.position.set(width * 0.5, height * 0.5)
  ambient.scale.set(Math.max(4, width / 120))
  ambient.tint = accent
  ambient.alpha = 0.04
  state.glowLayer.addChild(ambient)
}

export function DungeonPixiMap({ dungeonId, accent = '#7fd8ff', leaderX, leaderY, cell }: DungeonPixiMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef<MapState | null>(null)
  const propsRef = useRef({ leaderX, leaderY, cell })
  propsRef.current = { leaderX, leaderY, cell }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let app: Application | null = null
    let initialized = false
    let softTexture: Texture | null = null
    let observer: ResizeObserver | null = null

    const init = async () => {
      try {
        app = new Application()
        await app.init({
          width: Math.max(1, host.clientWidth),
          height: Math.max(1, host.clientHeight),
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 1.5),
          autoDensity: true,
          preference: 'webgl',
        })
        initialized = true
        if (cancelled) {
          app.destroy(true, { children: true })
          return
        }

        app.canvas.style.width = '100%'
        app.canvas.style.height = '100%'
        app.canvas.style.display = 'block'
        host.appendChild(app.canvas)

        const soft = makeSoftTexture()
        softTexture = soft
        const world = new Container()
        const glowLayer = new Container()
        const particleLayer = new Container()
        const fogLayer = new Container()
        world.addChild(glowLayer, fogLayer, particleLayer)
        app.stage.addChild(world)

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const numericAccent = Number.parseInt(accent.replace('#', ''), 16) || 0x7fd8ff
        const latest = propsRef.current
        const state: MapState = {
          width: Math.max(1, host.clientWidth),
          height: Math.max(1, host.clientHeight),
          reduced,
          world,
          glowLayer,
          particleLayer,
          fogLayer,
          particles: [],
          fog: [],
          leaderLight: null,
          leaderX: latest.leaderX,
          leaderY: latest.leaderY,
          cell: latest.cell,
        }
        stateRef.current = state

        const rebuild = () => {
          if (!app) return
          app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight))
          buildScene(app, state, soft, dungeonId, numericAccent)
        }

        rebuild()
        observer = new ResizeObserver(() => rebuild())
        observer.observe(host)

        app.ticker.maxFPS = host.clientWidth < 720 ? 45 : 60
        app.ticker.add((ticker) => {
          const dt = Math.min(ticker.deltaTime, 2.5)
          const now = performance.now()
          if (state.reduced) return

          for (const fog of state.fog) {
            fog.sprite.x += fog.speed * dt
            if (fog.sprite.x - fog.sprite.width / 2 > state.width) {
              fog.sprite.x = -fog.sprite.width / 2
            }
          }

          for (const particle of state.particles) {
            const sprite = particle.sprite
            if (particle.kind === 'leaf') {
              sprite.x += particle.vx * dt
              sprite.y += Math.sin(now / 900 + particle.phase) * 0.25 * dt
              sprite.rotation += 0.015 * dt
              if (sprite.x > state.width + 30) sprite.x = -30
            } else if (particle.kind === 'sand') {
              sprite.x -= particle.vx * dt
              sprite.y += Math.sin(now / 700 + particle.phase) * 0.08 * dt
              if (sprite.x < -30) {
                sprite.x = state.width + 30
                sprite.y = Math.random() * state.height
              }
            } else if (particle.kind === 'mote' || particle.kind === 'spark' || particle.kind === 'ember') {
              sprite.y -= particle.vy * dt
              sprite.x += Math.sin(now / 800 + particle.phase) * 0.2 * dt
              if (sprite.y < -30) {
                sprite.y = state.height + 30
                sprite.x = Math.random() * state.width
              }
            } else {
              sprite.x += Math.sin(now / 1100 + particle.phase) * 0.14 * dt
              sprite.y += Math.cos(now / 1300 + particle.phase) * 0.1 * dt
            }

            if (!state.reduced) {
              const wave = Math.sin(now / 600 + particle.phase)
              sprite.alpha = particle.baseAlpha * (particle.kind === 'glint' ? 0.45 + Math.abs(wave) * 0.55 : 0.65 + wave * 0.35)
            }
          }

          if (state.leaderLight && !state.reduced) {
            const wave = Math.sin(now / 700)
            state.leaderLight.alpha = 0.13 + wave * 0.035
            const baseScale = Math.max(1, state.cell * 0.03)
            state.leaderLight.scale.set(baseScale * (0.96 + wave * 0.04))
          }
        })
      } catch {
        // La cuadrícula DOM sigue funcionando aunque WebGL no esté disponible.
      }
    }

    void init()

    return () => {
      cancelled = true
      observer?.disconnect()
      stateRef.current = null
      if (app && initialized) {
        try {
          app.destroy(true, { children: true })
        } catch {
          // La escena ya puede estar destruida.
        }
      }
      softTexture?.destroy(true)
    }
  }, [dungeonId, accent])

  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    state.leaderX = leaderX
    state.leaderY = leaderY
    state.cell = cell
    if (state.leaderLight) {
      state.leaderLight.position.set((leaderX + 0.5) * cell, (leaderY + 0.5) * cell)
      state.leaderLight.scale.set(Math.max(1, cell * 0.03))
    }
  }, [leaderX, leaderY, cell])

  return <div ref={hostRef} className="dungeon-pixi-map" aria-hidden="true" />
}
