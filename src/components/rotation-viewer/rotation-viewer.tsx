'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { useRotation } from './use-rotation'
import { FramePreloader } from './frame-preloader'
import { frameUrl } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface RotationViewerProps {
  characterId: string
  frameCount: number
}

export function RotationViewer({ characterId, frameCount }: RotationViewerProps) {
  const { frameIndex, isPlaying, isDragging, startDrag, moveDrag, endDrag, togglePlay } =
    useRotation(frameCount)

  const containerRef = useRef<HTMLDivElement>(null)

  // Prevent default touch behavior on the viewer to avoid scroll interference
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const prevent = (e: TouchEvent) => {
      if (isDragging) e.preventDefault()
    }
    el.addEventListener('touchmove', prevent, { passive: false })
    return () => el.removeEventListener('touchmove', prevent)
  }, [isDragging])

  const currentFrame = frameUrl(characterId, frameIndex)

  return (
    <div className="w-full">
      <FramePreloader characterId={characterId} frameCount={frameCount} />

      {/* Viewer container */}
      <div
        ref={containerRef}
        className={cn(
          'relative w-full max-w-lg mx-auto aspect-square rounded-2xl overflow-hidden',
          'bg-obsidian-700 border border-white/[0.08]',
          'select-none touch-none',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
          'shadow-card'
        )}
        onMouseDown={(e) => startDrag(e.clientX)}
        onMouseMove={(e) => moveDrag(e.clientX)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={(e) => startDrag(e.touches[0].clientX)}
        onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
        onTouchEnd={endDrag}
        onTouchCancel={endDrag}
      >
        {/* Frame image */}
        <motion.img
          key={currentFrame}
          src={currentFrame}
          alt={`Character rotation frame ${frameIndex}`}
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.04 }}
        />

        {/* Subtle vignette overlay */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_60px_rgba(0,0,0,0.5)]" />

        {/* Drag hint */}
        <div
          className={cn(
            'absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none',
            'font-ui text-xs text-parchment-300/40 tracking-wider whitespace-nowrap',
            'transition-opacity duration-500',
            isDragging ? 'opacity-0' : 'opacity-100'
          )}
        >
          ← drag to rotate →
        </div>

        {/* Frame counter */}
        <div className="absolute top-3 right-3 pointer-events-none">
          <span className="font-ui text-xs text-parchment-300/30 bg-obsidian-900/60 px-2 py-1 rounded-md">
            {frameIndex + 1}/{frameCount}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <button
          onClick={togglePlay}
          className="flex items-center gap-2 font-ui text-sm text-parchment-300/60 hover:text-gold-400 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-white/[0.05]"
          aria-label={isPlaying ? 'Pause rotation' : 'Play rotation'}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Auto-rotate</span>
            </>
          )}
        </button>

        <div className="w-px h-4 bg-white/10" />

        {/* Rotation progress dots */}
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 12 }, (_, i) => {
            const active = Math.floor((frameIndex / frameCount) * 12) === i
            return (
              <div
                key={i}
                className={cn(
                  'w-1 h-1 rounded-full transition-all duration-100',
                  active ? 'bg-gold-400 w-2' : 'bg-parchment-300/20'
                )}
              />
            )
          })}
        </div>

        <div className="w-px h-4 bg-white/10" />

        <button
          onClick={() => {}}
          className="flex items-center gap-2 font-ui text-sm text-parchment-300/60 hover:text-gold-400 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-white/[0.05]"
          aria-label="Reset rotation"
          title="Reset to front"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
