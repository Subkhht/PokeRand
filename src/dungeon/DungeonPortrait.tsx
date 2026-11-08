import { pmdPortraitUrl } from './pmdAssets'
import type { PortraitEmotion } from './pmdAssets'

interface DungeonPortraitProps {
  id: number
  emotion?: PortraitEmotion
  className?: string
  alt?: string
}

function fallbackPortraitUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
}

export function DungeonPortrait({
  id,
  emotion = 'Normal',
  className,
  alt = '',
}: DungeonPortraitProps) {
  return (
    <img
      src={pmdPortraitUrl(id, emotion)}
      alt={alt}
      className={className}
      loading="lazy"
      onError={(event) => {
        const image = event.currentTarget
        if (image.dataset.fallback === '1') {
          image.style.visibility = 'hidden'
          return
        }
        image.dataset.fallback = '1'
        image.src = fallbackPortraitUrl(id)
      }}
    />
  )
}
