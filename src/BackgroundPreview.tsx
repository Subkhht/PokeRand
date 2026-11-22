import { useEffect, useRef, type JSX } from 'react'
import { BACKGROUNDS } from './game/backgrounds'
import { drawBackground, type BgState } from './game/backgroundAnimations'
import { subscribeBackgroundFrame } from './game/backgroundTicker'

interface BackgroundPreviewProps {
  backgroundId: string
  width?: number
  height?: number
}

export default function BackgroundPreview({ backgroundId, width = 210, height = 60 }: BackgroundPreviewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef<BgState>({})

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    stateRef.current = {}

    const FRAME = 1 / 30
    let acc = 0
    let unsubscribe: (() => void) | null = null

    const draw = (dt: number, t: number): void => {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#0b1120'
      ctx.fillRect(0, 0, width, height)
      drawBackground(ctx, stateRef.current, backgroundId, dt, width, height, t, null, { autoRipple: true })
    }

    const start = (): void => {
      if (unsubscribe) return
      unsubscribe = subscribeBackgroundFrame((dt, t) => {
        acc += dt
        if (acc < FRAME) return
        draw(acc, t)
        acc = 0
      })
    }
    const stop = (): void => {
      if (!unsubscribe) return
      unsubscribe()
      unsubscribe = null
    }

    // Con "Reducir animaciones" las miniaturas se quedan en un frame estático.
    if (document.documentElement.getAttribute('data-reduce-animations') === 'true' || document.documentElement.getAttribute('data-low-performance') === 'true') {
      draw(0.016, 0)
      return () => stop()
    }

    // Solo animamos las miniaturas visibles. En la Tienda Meta hay muchas y
    // mantenerlas todas dibujando a la vez provoca tirones.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) start()
      else stop()
    }, { threshold: 0.01 })
    observer.observe(canvas)

    return () => {
      observer.disconnect()
      stop()
    }
  }, [backgroundId, width, height])

  const def = BACKGROUNDS.find(b => b.id === backgroundId)

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: `${height}px`,
        borderRadius: '6px',
        display: 'block',
      }}
      title={def ? `${def.name} — ${def.desc}` : undefined}
    />
  )
}
