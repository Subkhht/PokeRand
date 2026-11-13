import { useEffect, useRef } from 'react'
import { Application, Assets, Container, FillGradient, Graphics, Sprite, Texture } from 'pixi.js'
import treeUrl from '../assets/Dungeon/arbol.png?inline'

interface PokestPixiSceneProps {
  pulse: number
  accent?: string
}

interface FogSprite {
  sprite: Sprite
  speed: number
}

interface EmberSprite {
  sprite: Sprite
  vx: number
  vy: number
  phase: number
}

interface FlameSprite {
  sprite: Sprite
  baseScale: number
  phase: number
}

interface StarSprite {
  sprite: Sprite
  baseAlpha: number
  phase: number
}

interface BurstSprite {
  sprite: Sprite
  vx: number
  vy: number
  life: number
}

interface SceneState {
  width: number
  height: number
  reduced: boolean
  world: Container
  skyLayer: Container
  farLayer: Container
  cryptLayer: Container
  fogLayer: Container
  emberLayer: Container
  burstLayer: Container
  flash: Graphics
  fog: FogSprite[]
  embers: EmberSprite[]
  flames: FlameSprite[]
  stars: StarSprite[]
  bursts: BurstSprite[]
  shakeUntil: number
  flashUntil: number
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
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)')
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
  state: SceneState,
  soft: Texture,
  tree: Texture | null,
  accent: number,
): void {
  const width = Math.max(1, app.renderer.width / app.renderer.resolution)
  const height = Math.max(1, app.renderer.height / app.renderer.resolution)
  const compact = width < 720
  state.width = width
  state.height = height

  clearLayer(state.skyLayer)
  clearLayer(state.farLayer)
  clearLayer(state.cryptLayer)
  clearLayer(state.fogLayer)
  clearLayer(state.emberLayer)
  clearLayer(state.burstLayer)
  state.fog = []
  state.embers = []
  state.flames = []
  state.stars = []
  state.bursts = []

  // Cielo
  const sky = new Graphics()
  sky.rect(0, 0, width, height).fill(new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: '#1b0806' },
      { offset: 0.5, color: '#0d0504' },
      { offset: 1, color: '#050302' },
    ],
  }))
  state.skyLayer.addChild(sky)

  const redGlow = new Graphics()
  redGlow.circle(width * 0.5, height * 0.24, Math.min(width * 0.34, height * 0.4)).fill({ color: 0x6b1f12, alpha: 0.16 })
  state.skyLayer.addChild(redGlow)

  // Luna
  const moonGlow = new Sprite(soft)
  moonGlow.anchor.set(0.5)
  moonGlow.position.set(width * 0.82, height * 0.14)
  moonGlow.scale.set(Math.min(width * 0.012, 6))
  moonGlow.tint = 0xd8b46a
  moonGlow.alpha = 0.28
  state.skyLayer.addChild(moonGlow)

  const moon = new Graphics()
  moon.circle(width * 0.82, height * 0.14, Math.max(24, Math.min(width * 0.04, 58))).fill({ color: 0xd8b46a, alpha: 0.9 })
  state.skyLayer.addChild(moon)

  // Estrellas
  for (let index = 0; index < (compact ? 38 : 70); index += 1) {
    const star = new Sprite(soft)
    star.anchor.set(0.5)
    star.position.set(Math.random() * width, Math.random() * height * 0.55)
    star.scale.set(0.035 + Math.random() * 0.04)
    star.tint = index % 3 === 0 ? 0xd8b46a : 0xffffff
    star.alpha = 0.15 + Math.random() * 0.45
    state.skyLayer.addChild(star)
    state.stars.push({ sprite: star, baseAlpha: star.alpha, phase: Math.random() * Math.PI * 2 })
  }

  // Colinas
  const hills = new Graphics()
  hills.poly([0, height * 0.82, width * 0.18, height * 0.66, width * 0.38, height * 0.8, width * 0.6, height * 0.7, width * 0.82, height * 0.81, width, height * 0.68, width, height, 0, height]).fill({ color: 0x0d0705 })
  state.farLayer.addChild(hills)

  // Árboles de PMD como siluetas
  if (tree) {
    const targetHeight = Math.min(height * 0.46, 340)
    const treeScale = targetHeight / tree.height
    const leftTree = new Sprite(tree)
    leftTree.anchor.set(0.5, 1)
    leftTree.position.set(width * 0.1, height * 0.87)
    leftTree.scale.set(treeScale)
    leftTree.tint = 0x000000
    leftTree.alpha = 0.68
    state.farLayer.addChild(leftTree)

    const rightTree = new Sprite(tree)
    rightTree.anchor.set(0.5, 1)
    rightTree.position.set(width * 0.9, height * 0.87)
    rightTree.scale.set(-treeScale, treeScale)
    rightTree.tint = 0x000000
    rightTree.alpha = 0.68
    state.farLayer.addChild(rightTree)
  }

  // Cripta central
  const cryptWidth = Math.min(width * 0.34, 430)
  const cryptHeight = Math.min(height * 0.56, 480)
  const cx = width * 0.5
  const baseY = height * 0.86
  const topY = baseY - cryptHeight
  const arch = new Graphics()
  arch.moveTo(cx - cryptWidth / 2, baseY)
  arch.lineTo(cx - cryptWidth / 2, baseY - cryptHeight * 0.52)
  arch.arc(cx, baseY - cryptHeight * 0.52, cryptWidth / 2, Math.PI, 0, false)
  arch.lineTo(cx + cryptWidth / 2, baseY)
  arch.closePath()
  arch.fill({ color: 0x2a1a12 })
  arch.stroke({ color: 0x0a0503, width: 5 })
  state.cryptLayer.addChild(arch)

  const stoneLines = new Graphics()
  for (let index = 1; index < 6; index += 1) {
    const y = topY + (cryptHeight / 6) * index
    stoneLines.moveTo(cx - cryptWidth / 2 + 8, y)
    stoneLines.lineTo(cx + cryptWidth / 2 - 8, y)
  }
  stoneLines.stroke({ color: 0x1a0f0a, width: 2, alpha: 0.7 })
  state.cryptLayer.addChild(stoneLines)

  const door = new Graphics()
  door.roundRect(cx - cryptWidth * 0.28, baseY - cryptHeight * 0.44, cryptWidth * 0.56, cryptHeight * 0.44, 4).fill({ color: 0x0f0805 })
  door.rect(cx - cryptWidth * 0.25, baseY - cryptHeight * 0.39, cryptWidth * 0.2, cryptHeight * 0.3).stroke({ color: 0x2a1a12, width: 2, alpha: 0.7 })
  door.rect(cx + cryptWidth * 0.05, baseY - cryptHeight * 0.39, cryptWidth * 0.2, cryptHeight * 0.3).stroke({ color: 0x2a1a12, width: 2, alpha: 0.7 })
  state.cryptLayer.addChild(door)

  const steps = new Graphics()
  steps.rect(cx - cryptWidth * 0.58, baseY, cryptWidth * 1.16, cryptHeight * 0.035).fill({ color: 0x1a0f0a })
  steps.rect(cx - cryptWidth * 0.64, baseY + cryptHeight * 0.035, cryptWidth * 1.28, cryptHeight * 0.03).fill({ color: 0x120a07 })
  state.cryptLayer.addChild(steps)

  // Antorchas
  const createTorch = (x: number, y: number) => {
    const pole = new Graphics()
    pole.rect(x - 4, y - cryptHeight * 0.08, 8, cryptHeight * 0.22).fill({ color: 0x1a0f0a })
    pole.rect(x - 9, y - cryptHeight * 0.1, 18, 7).fill({ color: 0x3a2418 })
    state.cryptLayer.addChild(pole)

    const glow = new Sprite(soft)
    glow.anchor.set(0.5)
    glow.position.set(x, y - cryptHeight * 0.12)
    glow.scale.set(Math.min(width * 0.008, 2.4))
    glow.tint = 0xff7a2a
    glow.alpha = 0.42
    state.cryptLayer.addChild(glow)

    const flame = new Sprite(soft)
    flame.anchor.set(0.5, 1)
    flame.position.set(x, y - cryptHeight * 0.1)
    flame.scale.set(0.35)
    flame.tint = 0xffd166
    flame.alpha = 0.9
    state.cryptLayer.addChild(flame)
    state.flames.push({ sprite: flame, baseScale: 0.35, phase: Math.random() * Math.PI * 2 })
  }

  createTorch(cx - cryptWidth * 0.64, baseY - cryptHeight * 0.12)
  createTorch(cx + cryptWidth * 0.64, baseY - cryptHeight * 0.12)

  // Suelo
  const floor = new Graphics()
  floor.rect(0, height * 0.78, width, height * 0.22).fill({ color: 0x050302, alpha: 0.92 })
  floor.ellipse(width * 0.5, height * 0.9, width * 0.42, height * 0.1).fill({ color: accent, alpha: 0.08 })
  state.farLayer.addChild(floor)

  // Niebla
  for (let index = 0; index < 4; index += 1) {
    const fog = new Sprite(soft)
    fog.anchor.set(0.5)
    fog.position.set(Math.random() * width, height * (0.68 + Math.random() * 0.16))
    fog.scale.set(width * (0.04 + Math.random() * 0.04))
    fog.tint = 0x8a6a5a
    fog.alpha = 0.06 + Math.random() * 0.06
    state.fogLayer.addChild(fog)
    state.fog.push({ sprite: fog, speed: 0.08 + Math.random() * 0.14 })
  }

  // Brasas
  for (let index = 0; index < (compact ? 20 : 36); index += 1) {
    const ember = new Sprite(soft)
    ember.anchor.set(0.5)
    ember.position.set(Math.random() * width, height * (0.55 + Math.random() * 0.4))
    ember.scale.set(0.03 + Math.random() * 0.05)
    ember.tint = index % 4 === 0 ? 0xffd166 : 0xff7a3c
    ember.alpha = 0.18 + Math.random() * 0.4
    state.emberLayer.addChild(ember)
    state.embers.push({
      sprite: ember,
      vx: 0.1 + Math.random() * 0.28,
      vy: 0.18 + Math.random() * 0.52,
      phase: Math.random() * Math.PI * 2,
    })
  }

  // Partículas de impacto
  for (let index = 0; index < (compact ? 10 : 18); index += 1) {
    const burst = new Sprite(soft)
    burst.anchor.set(0.5)
    burst.scale.set(0.08)
    burst.tint = index % 2 === 0 ? 0xffd166 : 0xff6a3c
    burst.alpha = 0
    state.burstLayer.addChild(burst)
    state.bursts.push({ sprite: burst, vx: 0, vy: 0, life: 0 })
  }

  // Flash de impacto
  state.flash.clear()
  state.flash.rect(0, 0, width, height).fill({ color: 0xff6a3c })
  state.flash.alpha = 0
}

function triggerImpact(state: SceneState | null): void {
  if (!state || state.reduced) return
  const now = performance.now()
  state.shakeUntil = now + 280
  state.flashUntil = now + 190
  for (const burst of state.bursts) {
    burst.life = 1
    burst.sprite.alpha = 1
    burst.sprite.scale.set(0.08)
    burst.sprite.position.set(
      state.width * (0.28 + Math.random() * 0.44),
      state.height * (0.42 + Math.random() * 0.28),
    )
    burst.vx = (Math.random() - 0.5) * 6
    burst.vy = -1.2 - Math.random() * 3.4
  }
}

export function PokestPixiScene({ pulse, accent = '#d8b46a' }: PokestPixiSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef<SceneState | null>(null)

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
        const tree = await Assets.load(treeUrl).catch(() => null)
        if (cancelled) {
          app.destroy(true, { children: true })
          softTexture?.destroy(true)
          return
        }

        const world = new Container()
        const skyLayer = new Container()
        const farLayer = new Container()
        const cryptLayer = new Container()
        const fogLayer = new Container()
        const emberLayer = new Container()
        const burstLayer = new Container()
        const flash = new Graphics()
        world.addChild(skyLayer, farLayer, cryptLayer, fogLayer, emberLayer, burstLayer, flash)
        app.stage.addChild(world)

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const numericAccent = Number.parseInt(accent.replace('#', ''), 16) || 0xd8b46a
        const state: SceneState = {
          width: Math.max(1, host.clientWidth),
          height: Math.max(1, host.clientHeight),
          reduced,
          world,
          skyLayer,
          farLayer,
          cryptLayer,
          fogLayer,
          emberLayer,
          burstLayer,
          flash,
          fog: [],
          embers: [],
          flames: [],
          stars: [],
          bursts: [],
          shakeUntil: 0,
          flashUntil: 0,
        }
        stateRef.current = state

        const rebuild = () => {
          if (!app) return
          const width = Math.max(1, host.clientWidth)
          const height = Math.max(1, host.clientHeight)
          app.renderer.resize(width, height)
          buildScene(app, state, soft, tree as Texture | null, numericAccent)
        }

        rebuild()
        observer = new ResizeObserver(() => rebuild())
        observer.observe(host)

        app.ticker.maxFPS = host.clientWidth < 720 ? 45 : 60
        app.ticker.add((ticker) => {
          const dt = Math.min(ticker.deltaTime, 2.5)
          const now = performance.now()

          if (now < state.shakeUntil && !state.reduced) {
            state.world.position.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8)
          } else {
            state.world.position.set(0, 0)
          }

          state.flash.alpha = now < state.flashUntil
            ? Math.max(0, (state.flashUntil - now) / 190) * 0.16
            : 0

          if (!state.reduced) {
          for (const fog of state.fog) {
            fog.sprite.x += fog.speed * dt
            if (fog.sprite.x - fog.sprite.width / 2 > state.width) {
              fog.sprite.x = -fog.sprite.width / 2
            }
          }

          for (const ember of state.embers) {
            ember.sprite.y -= ember.vy * dt
            ember.sprite.x += Math.sin(now / 900 + ember.phase) * ember.vx * dt
            ember.sprite.alpha = 0.16 + Math.abs(Math.sin(now / 600 + ember.phase)) * 0.34
            if (ember.sprite.y < -20) {
              ember.sprite.y = state.height * (0.8 + Math.random() * 0.18)
              ember.sprite.x = Math.random() * state.width
            }
          }

          for (const flame of state.flames) {
            const wave = now / 170 + flame.phase
            flame.sprite.scale.set(
              flame.baseScale * (0.9 + Math.sin(wave) * 0.08),
              flame.baseScale * (1 + Math.cos(wave * 1.2) * 0.12),
            )
            flame.sprite.alpha = 0.75 + Math.sin(wave * 1.7) * 0.15
          }

          for (const star of state.stars) {
            star.sprite.alpha = star.baseAlpha * (0.6 + Math.sin(now / 700 + star.phase) * 0.4)
          }

          for (const burst of state.bursts) {
            if (burst.life <= 0) continue
            burst.life -= dt * 0.022
            burst.sprite.x += burst.vx * dt
            burst.sprite.y += burst.vy * dt
            burst.sprite.alpha = Math.max(0, burst.life)
            burst.sprite.scale.set(0.08 + (1 - burst.life) * 0.08)
          }
          }
        })
      } catch {
        // Si WebGL falla, la escena CSS de respaldo sigue visible.
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
          // La escena ya puede estar destruida por el cierre del modo.
        }
      }
      softTexture?.destroy(true)
    }
  }, [accent])

  useEffect(() => {
    triggerImpact(stateRef.current)
  }, [pulse])

  return <div ref={hostRef} className="pokest-pixi-scene" aria-hidden="true" />
}
