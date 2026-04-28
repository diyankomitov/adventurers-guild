'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

const PIXELS_PER_FRAME = 8
const AUTO_PLAY_FPS = 12

export function useRotation(frameCount: number) {
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isDragging, setIsDragging] = useState(false)

  const dragStartX = useRef<number | null>(null)
  const dragStartFrame = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-play loop
  useEffect(() => {
    if (!isPlaying || isDragging || frameCount === 0) return
    intervalRef.current = setInterval(() => {
      setFrameIndex((i) => (i + 1) % frameCount)
    }, 1000 / AUTO_PLAY_FPS)
    return () => clearInterval(intervalRef.current!)
  }, [isPlaying, isDragging, frameCount])

  const startDrag = useCallback(
    (clientX: number) => {
      clearInterval(intervalRef.current!)
      setIsPlaying(false)
      setIsDragging(true)
      dragStartX.current = clientX
      dragStartFrame.current = frameIndex
    },
    [frameIndex]
  )

  const moveDrag = useCallback(
    (clientX: number) => {
      if (!isDragging || dragStartX.current === null || frameCount === 0) return
      const delta = clientX - dragStartX.current
      const frameDelta = Math.round(delta / PIXELS_PER_FRAME)
      const newFrame =
        ((dragStartFrame.current + frameDelta) % frameCount + frameCount) % frameCount
      setFrameIndex(newFrame)
    },
    [isDragging, frameCount]
  )

  const endDrag = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    dragStartX.current = null
    // Resume auto-play after a short delay
    const t = setTimeout(() => setIsPlaying(true), 800)
    return () => clearTimeout(t)
  }, [isDragging])

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p)
  }, [])

  return {
    frameIndex,
    isPlaying,
    isDragging,
    startDrag,
    moveDrag,
    endDrag,
    togglePlay,
    setFrameIndex,
  }
}
