'use client'

import { frameUrl } from '@/lib/utils'

interface FramePreloaderProps {
  characterId: string
  frameCount: number
}

// Renders hidden <img> tags to warm the browser's HTTP cache for all frames
export function FramePreloader({ characterId, frameCount }: FramePreloaderProps) {
  return (
    <div aria-hidden="true" className="sr-only">
      {Array.from({ length: frameCount }, (_, i) => (
        <img
          key={i}
          src={frameUrl(characterId, i)}
          alt=""
          loading="eager"
          decoding="async"
        />
      ))}
    </div>
  )
}
