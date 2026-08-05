type FrameCallback = (dt: number, t: number) => void

const subscribers = new Set<FrameCallback>()
let running = false
let last = 0

function tick(now: number): void {
  if (subscribers.size === 0) {
    running = false
    return
  }
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  const t = now / 1000
  for (const cb of subscribers) {
    cb(dt, t)
  }
  requestAnimationFrame(tick)
}

// Un único requestAnimationFrame para TODOS los fondos y miniaturas, evitando
// que cada canvas lance su propio bucle (que ralentizaba la página).
export function subscribeBackgroundFrame(cb: FrameCallback): () => void {
  subscribers.add(cb)
  if (!running) {
    running = true
    last = performance.now()
    requestAnimationFrame(tick)
  }
  return () => {
    subscribers.delete(cb)
  }
}
