import { useEffect, useRef, useState } from 'react'
import { DungeonPortrait } from '../dungeon/DungeonPortrait'
import { getCachedSprites, loadPmdSprites } from '../dungeon/pmdAssets'
import type { PmdSprites } from '../dungeon/types'

interface PokestPmdSpriteProps {
  id: number
  size?: number
  className?: string
}

export function PokestPmdSprite({ id, size = 76, className }: PokestPmdSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [sprites, setSprites] = useState<PmdSprites | null>(() => getCachedSprites(id))

  useEffect(() => {
    let cancelled = false
    const cached = getCachedSprites(id)
    if (cached) {
      setSprites(cached)
      return () => { cancelled = true }
    }
    setSprites(null)
    loadPmdSprites(id).then((loaded) => {
      if (!cancelled) setSprites(loaded)
    })
    return () => { cancelled = true }
  }, [id])

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

      const source = sprites.idle ?? sprites.walk
      if (!source) {
        frameId = requestAnimationFrame(draw)
        return
      }

      if (sprites.isFallback) {
        const ratio = Math.min(canvas.width / source.naturalWidth, canvas.height / source.naturalHeight)
        const width = source.naturalWidth * ratio
        const height = source.naturalHeight * ratio
        ctx.drawImage(source, (canvas.width - width) / 2, canvas.height - height, width, height)
        frameId = requestAnimationFrame(draw)
        return
      }

      const frames = sprites.idleFrames
      const frameW = sprites.idleFrameW
      const frameH = sprites.idleFrameH
      const durations = sprites.idleDurations
      if (frames <= 0 || frameW <= 0 || frameH <= 0) {
        frameId = requestAnimationFrame(draw)
        return
      }

      const totalTicks = durations.length
        ? durations.reduce((sum, tick) => sum + Math.max(1, tick), 0)
        : frames * 8
      const elapsedTicks = ((now - start) / (1000 / 60)) % totalTicks
      let acc = 0
      let frame = 0
      for (let index = 0; index < (durations.length || frames); index += 1) {
        acc += Math.max(1, durations[index] ?? 8)
        if (elapsedTicks < acc) {
          frame = index
          break
        }
      }
      frame = Math.min(frame, frames - 1)

      const sx = frame * frameW
      const ratio = Math.min(canvas.width / frameW, canvas.height / frameH)
      const width = frameW * ratio
      const height = frameH * ratio
      ctx.drawImage(source, sx, 0, frameW, frameH, (canvas.width - width) / 2, canvas.height - height, width, height)
      frameId = requestAnimationFrame(draw)
    }

    frameId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameId)
  }, [sprites])

  const showFallback = !sprites || sprites.isFallback

  return (
    <span className={`pokest-pmd-wrap${className ? ` ${className}` : ''}`}>
      {showFallback && <DungeonPortrait id={id} className="pokest-pmd-fallback" alt="" />}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="pokest-pmd-sprite"
        aria-hidden="true"
      />
    </span>
  )
}
