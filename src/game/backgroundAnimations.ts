export interface BgState {
  [key: string]: unknown
}

export interface BgDrawOpts {
  lastRipple?: { current: number }
  autoRipple?: boolean
}

interface Star {
  x: number
  y: number
  r: number
  phase: number
  vy: number
}

interface Meteor {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
}

interface Flake {
  x: number
  y: number
  r: number
  vy: number
  sway: number
  phase: number
}

interface Drop {
  x: number
  y: number
  vy: number
  len: number
}

interface Bubble {
  x: number
  y: number
  r: number
  vy: number
  phase: number
}

interface MatrixCol {
  x: number
  y: number
  speed: number
}

interface FireParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  r: number
}

interface Pokeball {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rot: number
  vr: number
}

interface ConfettiPiece {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  color: string
  phase: number
}

interface Ripple {
  x: number
  y: number
  r: number
  vr: number
  alpha: number
}

function getState<T>(s: BgState, key: string, factory: () => T): T {
  if (!(key in s)) s[key] = factory()
  return s[key] as T
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

// Sprites de "glow" pre-renderizados: crear un gradiente radial por partícula y
// por frame es muy caro. Se genera una sola vez y se dibuja con drawImage.
const glowSpriteCache = new Map<string, HTMLCanvasElement>()
function glowSprite(size: number, stops: Array<[number, string]>): HTMLCanvasElement {
  const key = `${size}|${stops.map(([o, c]) => `${o}:${c}`).join(',')}`
  const cached = glowSpriteCache.get(key)
  if (cached) return cached
  const cv = document.createElement('canvas')
  cv.width = size
  cv.height = size
  const c = cv.getContext('2d')
  if (c) {
    const g = c.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2)
    for (const [off, col] of stops) g.addColorStop(off, col)
    c.fillStyle = g
    c.fillRect(0, 0, size, size)
  }
  glowSpriteCache.set(key, cv)
  return cv
}
const FIRE_SPRITE = glowSprite(96, [[0, 'rgba(255, 220, 120, 1)'], [0.5, 'rgba(255, 110, 40, 1)'], [1, 'rgba(200, 30, 10, 0)']])
const LAVA_SPRITE = glowSprite(96, [[0, 'rgba(255, 220, 140, 1)'], [0.4, 'rgba(255, 120, 40, 1)'], [1, 'rgba(180, 40, 10, 0)']])
const GHOST_SPRITE = glowSprite(96, [[0, 'rgba(190, 240, 255, 1)'], [0.5, 'rgba(100, 180, 255, 1)'], [1, 'rgba(40, 90, 200, 0)']])
const FIREFLY_SPRITE = glowSprite(48, [[0, 'rgba(255, 245, 170, 1)'], [0.5, 'rgba(255, 205, 80, 1)'], [1, 'rgba(255, 180, 40, 0)']])

// ---------------------------------------------------------------- stars
function stepStars(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, t: number): void {
  const stars = getState<Star[]>(s, 'stars', () =>
    Array.from({ length: Math.max(6, Math.floor((w * h) / 2600)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: rand(0.4, 1.6),
      phase: Math.random() * Math.PI * 2,
      vy: rand(1, 4),
    }))
  )
  ctx.fillStyle = '#ffffff'
  for (const st of stars) {
    st.y += st.vy * dt * 0.05
    if (st.y > h + 4) { st.y = -4; st.x = Math.random() * w }
    const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 + st.phase))
    ctx.globalAlpha = a
    ctx.beginPath()
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- shooting stars
function stepShooting(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, t: number): void {
  stepStars(ctx, s, dt, w, h, t)
  const meteors = getState<Meteor[]>(s, 'meteors', () => [])
  if (meteors.length < 3 && Math.random() < dt * 0.25) {
    meteors.push({
      x: Math.random() * w * 0.8,
      y: Math.random() * h * 0.3,
      vx: rand(-260, -140),
      vy: rand(120, 200),
      life: 1.4,
      maxLife: 1.4,
    })
  }
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i]
    m.x += m.vx * dt
    m.y += m.vy * dt
    m.life -= dt
    if (m.life <= 0) { meteors.splice(i, 1); continue }
    const a = m.life / m.maxLife
    const tail = 14
    ctx.globalAlpha = a
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(m.x, m.y)
    ctx.lineTo(m.x - m.vx * 0.06 * tail, m.y - m.vy * 0.06 * tail)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- snow
function stepSnow(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, t: number): void {
  const flakes = getState<Flake[]>(s, 'flakes', () =>
    Array.from({ length: Math.max(5, Math.floor((w * h) / 4200)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: rand(1, 3.5),
      vy: rand(18, 55),
      sway: rand(8, 26),
      phase: Math.random() * Math.PI * 2,
    }))
  )
  ctx.fillStyle = '#ffffff'
  for (const f of flakes) {
    f.y += f.vy * dt
    f.x += Math.sin(t * 1.4 + f.phase) * f.sway * dt * 0.4
    if (f.y > h + 6) { f.y = -6; f.x = Math.random() * w }
    ctx.globalAlpha = 0.75
    ctx.beginPath()
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- rain
function stepRain(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, _t: number): void {
  const drops = getState<Drop[]>(s, 'drops', () =>
    Array.from({ length: Math.max(6, Math.floor((w * h) / 2600)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vy: rand(420, 720),
      len: rand(10, 22),
    }))
  )
  ctx.strokeStyle = 'rgba(150, 190, 255, 0.55)'
  ctx.lineWidth = 1
  for (const d of drops) {
    d.y += d.vy * dt
    if (d.y > h + d.len) { d.y = -d.len; d.x = Math.random() * w }
    ctx.beginPath()
    ctx.moveTo(d.x, d.y)
    ctx.lineTo(d.x - 2, d.y + d.len)
    ctx.stroke()
  }
}

// ---------------------------------------------------------------- bubbles
function stepBubbles(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, t: number): void {
  const bubbles = getState<Bubble[]>(s, 'bubbles', () =>
    Array.from({ length: Math.max(3, Math.floor((w * h) / 9000)) }, () => ({
      x: Math.random() * w,
      y: h + 20,
      r: rand(3, 12),
      vy: rand(18, 42),
      phase: Math.random() * Math.PI * 2,
    }))
  )
  for (const b of bubbles) {
    b.y -= b.vy * dt
    b.x += Math.sin(t * 2 + b.phase) * 10 * dt
    if (b.y < -20) { b.y = h + 20; b.x = Math.random() * w }
    const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r)
    g.addColorStop(0, 'rgba(220, 250, 255, 0.9)')
    g.addColorStop(0.5, 'rgba(120, 200, 255, 0.35)')
    g.addColorStop(1, 'rgba(60, 140, 220, 0.15)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(200, 240, 255, 0.5)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

// ---------------------------------------------------------------- matrix
const MATRIX_CHARS = '01アイウエオカキクケコサシスセソ0123456789'
function stepMatrix(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, _t: number): void {
  const cell = 26
  const cols = getState<MatrixCol[]>(s, 'matrixCols', () => {
    const n = Math.max(2, Math.ceil(w / cell))
    return Array.from({ length: n }, (_, i) => ({
      x: i * cell + cell / 2,
      y: Math.random() * h,
      speed: rand(45, 130),
    }))
  })
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const c of cols) {
    c.y += c.speed * dt
    if (c.y - 8 * cell > h) { c.y = Math.random() * -h * 0.5 }
    for (let i = 0; i < 8; i++) {
      const yy = c.y - i * cell
      if (yy < 0 || yy > h) continue
      const a = i === 0 ? 1 : Math.max(0.08, 0.85 - i * 0.13)
      ctx.globalAlpha = a
      ctx.font = i === 0 ? `bold ${cell - 6}px monospace` : `${cell - 8}px monospace`
      ctx.fillStyle = i === 0 ? '#d6ffd6' : '#22ff22'
      const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
      ctx.fillText(char, c.x, yy)
    }
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

// ---------------------------------------------------------------- neon grid
function drawNeon(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const horizon = h * 0.52
  const sunR = Math.min(w, h) * 0.16 * (1 + Math.sin(t * 0.5) * 0.03)
  const sun = ctx.createRadialGradient(w / 2, horizon, 10, w / 2, horizon, sunR * 2)
  sun.addColorStop(0, 'rgba(255, 190, 90, 0.9)')
  sun.addColorStop(0.4, 'rgba(255, 90, 180, 0.6)')
  sun.addColorStop(1, 'rgba(255, 90, 180, 0)')
  ctx.fillStyle = sun
  ctx.fillRect(w / 2 - sunR * 2, horizon - sunR * 2, sunR * 4, sunR * 4)

  ctx.strokeStyle = 'rgba(240, 107, 219, 0.7)'
  ctx.lineWidth = 2
  const scroll = (t * 70) % (h * 0.3)
  for (let i = 0; i < 20; i++) {
    const off = (i * (h * 0.012) + scroll) % (h - horizon)
    const y = horizon + off
    const k = Math.pow((y - horizon) / Math.max(1, h - horizon), 1.5)
    const x1 = w / 2 - k * (w / 2)
    const x2 = w / 2 + k * (w / 2)
    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(180, 90, 240, 0.45)'
  for (let i = -9; i <= 9; i++) {
    ctx.beginPath()
    ctx.moveTo(w / 2 + i * (w / 12), horizon)
    ctx.lineTo(w / 2 + i * (w / 2), h)
    ctx.stroke()
  }
}

// ---------------------------------------------------------------- fire
function stepFire(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, _t: number): void {
  const parts = getState<FireParticle[]>(s, 'fire', () => [])
  if (parts.length < Math.max(4, Math.floor(w / 40)) && Math.random() < dt * 30) {
    parts.push({
      x: Math.random() * w,
      y: h + 10,
      vx: rand(-20, 20),
      vy: rand(-160, -70),
      life: rand(1.2, 2.4),
      maxLife: 2.4,
      r: rand(6, 18),
    })
  }
  ctx.globalCompositeOperation = 'lighter'
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    p.y += p.vy * dt
    p.x += (p.vx + Math.sin(p.y * 0.05 + p.maxLife * 3) * 30) * dt
    p.vy *= 1 + dt * 0.6
    p.life -= dt
    if (p.life <= 0) { parts.splice(i, 1); continue }
    const k = p.life / p.maxLife
    const r = p.r * (0.6 + k * 0.6) * 2
    ctx.globalAlpha = 0.7 * k
    ctx.drawImage(FIRE_SPRITE, p.x - r / 2, p.y - r / 2, r, r)
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- lava
function stepLava(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, t: number): void {
  const blobs = getState<Array<{ x: number; y: number; r: number; vy: number; phase: number }>>(s, 'lava', () =>
    Array.from({ length: Math.max(3, Math.floor(w / 60)) }, () => ({
      x: Math.random() * w,
      y: h + rand(10, 80),
      r: rand(14, 34),
      vy: rand(12, 30),
      phase: Math.random() * Math.PI * 2,
    }))
  )
  ctx.globalCompositeOperation = 'lighter'
  for (const b of blobs) {
    b.y -= b.vy * dt
    b.x += Math.sin(t * 1.2 + b.phase) * 14 * dt
    if (b.y < -40) { b.y = h + 40; b.x = Math.random() * w }
    const r = b.r * 2
    ctx.globalAlpha = 0.7
    ctx.drawImage(LAVA_SPRITE, b.x - r / 2, b.y - r / 2, r, r)
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- aurora
function drawAurora(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const bands = [
    { color: 'rgba(77, 255, 194, ALPHA)', speed: 0.3, amp: 0.06, y: 0.5 },
    { color: 'rgba(160, 100, 255, ALPHA)', speed: 0.22, amp: 0.08, y: 0.42 },
    { color: 'rgba(90, 200, 255, ALPHA)', speed: 0.36, amp: 0.05, y: 0.58 },
  ]
  for (const band of bands) {
    const cy = h * band.y
    const amp = h * band.amp
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += 12) {
      const y = cy + Math.sin(x / w * Math.PI * 4 + t * band.speed * 6) * amp
        + Math.sin(x / w * Math.PI * 9 + t * band.speed * 3) * amp * 0.4
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, cy - amp * 2, 0, h)
    grad.addColorStop(0, band.color.replace('ALPHA', '0.5'))
    grad.addColorStop(1, band.color.replace('ALPHA', '0'))
    ctx.fillStyle = grad
    ctx.fill()
  }
}

// ---------------------------------------------------------------- pokeballs
function stepPokeballs(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, _t: number): void {
  const balls = getState<Pokeball[]>(s, 'pokeballs', () =>
    Array.from({ length: Math.max(2, Math.floor((w * h) / 28000)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: rand(-14, 14),
      vy: rand(-10, 10),
      size: rand(10, 22),
      rot: Math.random() * Math.PI * 2,
      vr: rand(-0.6, 0.6),
    }))
  )
  for (const b of balls) {
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.rot += b.vr * dt
    if (b.x < -30) b.x = w + 30
    if (b.x > w + 30) b.x = -30
    if (b.y < -30) b.y = h + 30
    if (b.y > h + 30) b.y = -30
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.rotate(b.rot)
    ctx.globalAlpha = 0.7
    const r = b.size
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 0, r, Math.PI, 0)
    ctx.fillStyle = '#ee2b2b'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.strokeStyle = '#0f0f0f'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#0f0f0f'
    ctx.fillRect(-r, -1.5, r * 2, 3)
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- confetti
const CONFETTI_COLORS = ['#ff5a5a', '#ffd166', '#4dffc2', '#7aa2ff', '#ff77dd', '#a3e635']
function stepConfetti(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, t: number): void {
  const pieces = getState<ConfettiPiece[]>(s, 'confetti', () =>
    Array.from({ length: Math.max(4, Math.floor((w * h) / 9000)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.4,
      vx: rand(-14, 14),
      vy: rand(30, 70),
      rot: Math.random() * Math.PI * 2,
      vr: rand(-3, 3),
      size: rand(4, 8),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      phase: Math.random() * Math.PI * 2,
    }))
  )
  for (const p of pieces) {
    p.y += p.vy * dt
    p.x += (p.vx + Math.sin(t * 2 + p.phase) * 20) * dt
    p.rot += p.vr * dt
    if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w }
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.globalAlpha = 0.8
    ctx.fillStyle = p.color
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- ghost flames
function stepGhost(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, _t: number): void {
  const flames = getState<FireParticle[]>(s, 'ghost', () => [])
  if (flames.length < Math.max(4, Math.floor(w / 50)) && Math.random() < dt * 20) {
    flames.push({
      x: Math.random() * w,
      y: h + 10,
      vx: rand(-8, 8),
      vy: rand(-70, -30),
      life: rand(2, 3.5),
      maxLife: 3.5,
      r: rand(5, 14),
    })
  }
  ctx.globalCompositeOperation = 'lighter'
  for (let i = flames.length - 1; i >= 0; i--) {
    const p = flames[i]
    p.y += p.vy * dt
    p.x += (p.vx + Math.sin(p.y * 0.08 + p.maxLife * 4) * 18) * dt
    p.life -= dt
    if (p.life <= 0) { flames.splice(i, 1); continue }
    const k = p.life / p.maxLife
    const r = p.r * (0.7 + k * 0.7) * 2
    ctx.globalAlpha = 0.6 * k
    ctx.drawImage(GHOST_SPRITE, p.x - r / 2, p.y - r / 2, r, r)
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- interactive ripples
function stepRipples(  ctx: CanvasRenderingContext2D,
  s: BgState,
  dt: number,
  w: number,
  h: number,
  _t: number,
  mouse: { x: number; y: number } | null,
  opts?: BgDrawOpts
): void {
  const base = ctx.createLinearGradient(0, 0, 0, h)
  base.addColorStop(0, 'rgba(0, 90, 140, 0)')
  base.addColorStop(1, 'rgba(0, 90, 140, 0.25)')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  const ripples = getState<Ripple[]>(s, 'ripples', () => [])
  const now = performance.now()
  if (opts?.autoRipple && Math.random() < dt * 2.5) {
    ripples.push({ x: rand(0, w), y: rand(0, h), r: 2, vr: 70, alpha: 0.4 })
  }
  if (mouse && opts?.lastRipple && now - opts.lastRipple.current > 70) {
    opts.lastRipple.current = now
    ripples.push({ x: mouse.x, y: mouse.y, r: 2, vr: 90, alpha: 0.45 })
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const rp = ripples[i]
    rp.r += rp.vr * dt
    rp.alpha -= dt * 0.4
    if (rp.alpha <= 0) { ripples.splice(i, 1); continue }
    ctx.strokeStyle = `rgba(150, 220, 255, ${rp.alpha})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
    ctx.stroke()
  }
  if (mouse) {
    const g = ctx.createRadialGradient(mouse.x, mouse.y, 2, mouse.x, mouse.y, 90)
    g.addColorStop(0, 'rgba(150, 220, 255, 0.14)')
    g.addColorStop(1, 'rgba(150, 220, 255, 0)')
    ctx.fillStyle = g
    ctx.fillRect(mouse.x - 90, mouse.y - 90, 180, 180)
  }
}

// ---------------------------------------------------------------- leaves
interface Leaf {
  x: number
  y: number
  r: number
  vy: number
  vx: number
  rot: number
  vr: number
  phase: number
  color: string
}

const LEAF_COLORS = ['#8fbf5a', '#c98a3d', '#8a5a2a', '#5a9a4a']
function stepLeaves(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, t: number): void {
  const leaves = getState<Leaf[]>(s, 'leaves', () =>
    Array.from({ length: Math.max(5, Math.floor((w * h) / 4200)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: rand(4, 9),
      vy: rand(24, 60),
      vx: rand(-18, 18),
      rot: Math.random() * Math.PI * 2,
      vr: rand(-2, 2),
      phase: Math.random() * Math.PI * 2,
      color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
    }))
  )
  for (const lf of leaves) {
    lf.y += lf.vy * dt
    lf.x += (lf.vx + Math.sin(t * 1.5 + lf.phase) * 24) * dt
    lf.rot += lf.vr * dt
    if (lf.y > h + 12) { lf.y = -12; lf.x = Math.random() * w }
    ctx.save()
    ctx.translate(lf.x, lf.y)
    ctx.rotate(lf.rot)
    ctx.globalAlpha = 0.85
    ctx.fillStyle = lf.color
    ctx.beginPath()
    ctx.ellipse(0, 0, lf.r, lf.r * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-lf.r, 0)
    ctx.lineTo(lf.r, 0)
    ctx.stroke()
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- sakura petals
interface Petal {
  x: number
  y: number
  r: number
  vy: number
  vx: number
  rot: number
  vr: number
  phase: number
}

const SAKURA_COLORS = ['#ffb7d5', '#ff8fc0', '#ffd1e3']
function stepSakura(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, t: number): void {
  const petals = getState<Petal[]>(s, 'sakura', () =>
    Array.from({ length: Math.max(6, Math.floor((w * h) / 3600)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: rand(3, 7),
      vy: rand(22, 52),
      vx: rand(-16, 16),
      rot: Math.random() * Math.PI * 2,
      vr: rand(-2.4, 2.4),
      phase: Math.random() * Math.PI * 2,
    }))
  )
  for (const p of petals) {
    p.y += p.vy * dt
    p.x += (p.vx + Math.sin(t * 1.8 + p.phase) * 26) * dt
    p.rot += p.vr * dt
    if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w }
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.globalAlpha = 0.8
    ctx.fillStyle = SAKURA_COLORS[Math.floor(Math.random() * SAKURA_COLORS.length)]
    ctx.beginPath()
    ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- fireflies
interface Firefly {
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  size: number
}
function stepFireflies(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, t: number): void {
  const flies = getState<Firefly[]>(s, 'fireflies', () =>
    Array.from({ length: Math.max(4, Math.floor((w * h) / 9000)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: rand(-10, 10),
      vy: rand(-10, 10),
      phase: Math.random() * Math.PI * 2,
      size: rand(3, 7),
    }))
  )
  ctx.globalCompositeOperation = 'lighter'
  for (const f of flies) {
    f.x += (f.vx + Math.sin(t * 0.8 + f.phase) * 12) * dt
    f.y += (f.vy + Math.cos(t * 0.7 + f.phase) * 10) * dt
    if (f.x < -20) f.x = w + 20
    if (f.x > w + 20) f.x = -20
    if (f.y < -20) f.y = h + 20
    if (f.y > h + 20) f.y = -20
    const a = 0.25 + 0.75 * Math.abs(Math.sin(t * 1.8 + f.phase))
    const r = f.size * 3
    ctx.globalAlpha = a
    ctx.drawImage(FIREFLY_SPRITE, f.x - r / 2, f.y - r / 2, r, r)
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- thunderstorm
function stepThunder(ctx: CanvasRenderingContext2D, s: BgState, dt: number, w: number, h: number, _t: number): void {
  const drops = getState<Drop[]>(s, 'thunderRain', () =>
    Array.from({ length: Math.max(8, Math.floor((w * h) / 1800)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vy: rand(480, 760),
      len: rand(12, 24),
    }))
  )
  ctx.strokeStyle = 'rgba(170, 200, 255, 0.5)'
  ctx.lineWidth = 1
  for (const d of drops) {
    d.y += d.vy * dt
    if (d.y > h + d.len) { d.y = -d.len; d.x = Math.random() * w }
    ctx.beginPath()
    ctx.moveTo(d.x, d.y)
    ctx.lineTo(d.x - 2, d.y + d.len)
    ctx.stroke()
  }
  const flash = getState<{ a: number }>(s, 'thunderFlash', () => ({ a: 0 }))
  if (Math.random() < dt * 0.14) flash.a = 0.85
  flash.a -= dt * 1.8
  if (flash.a > 0) {
    ctx.fillStyle = `rgba(215, 225, 255, ${Math.max(0, flash.a)})`
    ctx.fillRect(0, 0, w, h)
  }
}

// ---------------------------------------------------------------- galaxy
interface GalaxyStar {
  angle: number
  dist: number
  size: number
  phase: number
}
function stepGalaxy(ctx: CanvasRenderingContext2D, s: BgState, _dt: number, w: number, h: number, t: number): void {
  const stars = getState<GalaxyStar[]>(s, 'galaxy', () => {
    const n = Math.max(60, Math.floor((w * h) / 260))
    const golden = Math.PI * (3 - Math.sqrt(5))
    return Array.from({ length: n }, (_, i) => ({
      angle: i * golden,
      dist: Math.sqrt(Math.random()) * Math.min(w, h) * 0.48,
      size: rand(0.6, 2.2),
      phase: Math.random() * Math.PI * 2,
    }))
  })
  const cx = w / 2
  const cy = h / 2
  ctx.globalCompositeOperation = 'lighter'
  for (const st of stars) {
    const a = st.angle + t * 0.16
    const x = cx + Math.cos(a) * st.dist
    const y = cy + Math.sin(a) * st.dist * 0.72
    const alpha = 0.2 + 0.8 * Math.abs(Math.sin(t * 1.2 + st.phase))
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x, y, st.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- dispatcher
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  s: BgState,
  id: string,
  dt: number,
  w: number,
  h: number,
  t: number,
  mouse: { x: number; y: number } | null,
  opts?: BgDrawOpts
): void {
  switch (id) {
    case 'stars': stepStars(ctx, s, dt, w, h, t); break
    case 'shooting': stepShooting(ctx, s, dt, w, h, t); break
    case 'snow': stepSnow(ctx, s, dt, w, h, t); break
    case 'rain': stepRain(ctx, s, dt, w, h, t); break
    case 'bubbles': stepBubbles(ctx, s, dt, w, h, t); break
    case 'matrix': stepMatrix(ctx, s, dt, w, h, t); break
    case 'neon': drawNeon(ctx, w, h, t); break
    case 'fire': stepFire(ctx, s, dt, w, h, t); break
    case 'lava': stepLava(ctx, s, dt, w, h, t); break
    case 'aurora': drawAurora(ctx, w, h, t); break
    case 'pokeballs': stepPokeballs(ctx, s, dt, w, h, t); break
    case 'confetti': stepConfetti(ctx, s, dt, w, h, t); break
    case 'ghost': stepGhost(ctx, s, dt, w, h, t); break
    case 'ripples': stepRipples(ctx, s, dt, w, h, t, mouse, opts); break
    case 'leaves': stepLeaves(ctx, s, dt, w, h, t); break
    case 'sakura': stepSakura(ctx, s, dt, w, h, t); break
    case 'fireflies': stepFireflies(ctx, s, dt, w, h, t); break
    case 'thunder': stepThunder(ctx, s, dt, w, h, t); break
    case 'galaxy': stepGalaxy(ctx, s, dt, w, h, t); break
    default: break
  }
}
