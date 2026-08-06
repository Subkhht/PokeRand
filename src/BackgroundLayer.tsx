import { useEffect, useRef, type JSX } from 'react'
import { BACKGROUNDS } from './game/backgrounds'
import { drawBackground, type BgState } from './game/backgroundAnimations'
import { subscribeBackgroundFrame } from './game/backgroundTicker'

export default function BackgroundLayer({ backgroundId }: { backgroundId: string }): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef<BgState>({})
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
  const lastRippleRef = useRef(0)

  useEffect(() => {
    const def = BACKGROUNDS.find(b => b.id === backgroundId)
    const canvas = canvasRef.current
    if (!canvas || !def) return
    // Fondo "Ninguno": hay que LIMPIAR el canvas (si no, el último frame de la
    // animación anterior se queda congelado) y ocultarlo.
    if (def.id === 'none') {
      canvas.style.opacity = '0'
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    canvas.style.opacity = String(def.opacity)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stateRef.current = {}
    }
    resize()
    window.addEventListener('resize', resize)

    const onMove = (e: MouseEvent): void => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    const onClick = (e: MouseEvent): void => {
      if (backgroundId !== 'ripples') return
      const ripples = getRipples()
      ripples.push({ x: e.clientX, y: e.clientY, r: 2, vr: 120, alpha: 0.8 })
      if (ripples.length > 60) ripples.shift()
    }
    const getRipples = (): Array<{ x: number; y: number; r: number; vr: number; alpha: number }> => {
      const s = stateRef.current
      if (!('ripples' in s)) s.ripples = []
      return s.ripples as Array<{ x: number; y: number; r: number; vr: number; alpha: number }>
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('click', onClick)

    // El fondo no necesita 60fps: se dibuja a ~30fps para aligerar la página.
    const FRAME = 1 / 30
    let acc = 0
    const unsubscribe = subscribeBackgroundFrame((dt, t) => {
      acc += dt
      if (acc < FRAME) return
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)
      drawBackground(ctx, stateRef.current, backgroundId, acc, w, h, t, mouseRef.current, { lastRipple: lastRippleRef })
      acc = 0
    })

    return () => {
      unsubscribe()
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('click', onClick)
    }
  }, [backgroundId])

  return (
    <canvas
      ref={canvasRef}
      className="bg-layer"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
      }}
    />
  )
}
