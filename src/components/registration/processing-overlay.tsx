'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, MousePointer2 } from 'lucide-react'

interface ProcessingOverlayProps {
  jobId: string
  heroforgeUrl: string
  onComplete: () => void
  onError: (message: string) => void
}

const TOTAL_FRAMES = 36
const VIEWPORT_W = 800
const VIEWPORT_H = 800

export function ProcessingOverlay({ jobId, heroforgeUrl, onComplete, onError }: ProcessingOverlayProps) {
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('Queued...')
  const [status, setStatus] = useState<'pending' | 'processing' | 'waiting_for_user' | 'complete' | 'error'>(
    'pending'
  )
  const [errorMsg, setErrorMsg] = useState('')
  const [characterId, setCharacterId] = useState<string | null>(null)
  const [liveTs, setLiveTs] = useState(0)
  const [displayedSrc, setDisplayedSrc] = useState<string | null>(null)
  const [clickSent, setClickSent] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Preload the next live screenshot off-screen; only swap the displayed src
  // once the new image is fully loaded — eliminates flicker and layout shifts.
  useEffect(() => {
    if (!characterId || !liveTs) return
    const url = `/api/frames/${characterId}/debug-live.png?t=${liveTs}`
    const img = new window.Image()
    img.onload = () => setDisplayedSrc(url)
    img.src = url
  }, [characterId, liveTs])

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        if (!res.ok) return
        const data = await res.json() as {
          status: string
          progress: number
          stage?: string
          error?: string
          characterId?: string
        }

        setStatus(data.status as typeof status)
        setProgress(data.progress ?? 0)
        if (data.stage) setStage(data.stage)
        if (data.characterId) {
          setCharacterId(data.characterId)
          setLiveTs(Date.now())
        }

        if (data.status === 'complete') {
          clearInterval(intervalRef.current!)
          onComplete()
        } else if (data.status === 'error') {
          clearInterval(intervalRef.current!)
          setErrorMsg(data.error ?? 'An unknown error occurred')
          onError(data.error ?? 'Unknown error')
        }
      } catch {
        // Network error — keep polling
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 2_000)
    return () => clearInterval(intervalRef.current!)
  }, [jobId, onComplete, onError])

  const handlePreviewClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (status !== 'waiting_for_user' || !characterId) return
    const rect = e.currentTarget.getBoundingClientRect()
    // Scale display coordinates to the 800×800 Playwright viewport
    const x = Math.round(((e.clientX - rect.left) / rect.width) * VIEWPORT_W)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * VIEWPORT_H)

    setClickSent(true)
    try {
      await fetch(`/api/jobs/${jobId}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      })
      setLiveTs(Date.now())
    } finally {
      setTimeout(() => setClickSent(false), 2_000)
    }
  }, [status, characterId, jobId])

  const pct = Math.round((progress / TOTAL_FRAMES) * 100)
  const isWaiting = status === 'waiting_for_user'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center py-12 px-8 text-center"
      >
        {/* Rune spinner — hide when waiting for user so attention goes to the preview */}
        {!isWaiting && (
          <div className="relative mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
              className="w-16 h-16 rounded-full border-2 border-gold-500/30 border-t-gold-400"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 4.5, ease: 'linear' }}
              className="absolute inset-2 rounded-full border border-dashed border-gold-500/20"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl">⚔</span>
            </div>
          </div>
        )}

        <h2 className="font-display text-2xl font-semibold text-gold-gradient mb-3">
          {isWaiting ? 'Verification Required' : 'Chronicling Your Hero'}
        </h2>

        {status === 'error' ? (
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="w-8 h-8 text-blood-400" />
            <p className="font-body text-sm text-parchment-300/70 whitespace-pre-wrap break-words max-w-sm">
              {errorMsg}
            </p>
          </div>
        ) : isWaiting ? (
          <>
            <p className="font-body text-sm text-parchment-300/70 mb-4 max-w-sm">
              Cloudflare is blocking the automated browser. Click the verification
              checkbox in the preview below to continue.
            </p>

            {displayedSrc && (
              <div className="w-full max-w-sm mb-4 relative">
                <div
                  className="relative cursor-crosshair rounded-lg overflow-hidden border-2 border-gold-400/60 animate-pulse-slow"
                  onClick={handlePreviewClick}
                >
                  <img
                    src={displayedSrc}
                    alt="Live browser view"
                    className="w-full block bg-obsidian-700"
                  />
                  {/* Click-here overlay */}
                  <div className="absolute inset-0 bg-black/10 flex items-end justify-center pb-3 pointer-events-none">
                    <span className="flex items-center gap-1.5 font-ui text-xs text-white/80 bg-black/50 px-2.5 py-1 rounded-full">
                      <MousePointer2 className="w-3 h-3" />
                      {clickSent ? 'Click sent — waiting...' : 'Click anywhere to relay to browser'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <p className="font-ui text-xs text-parchment-300/30 max-w-xs leading-relaxed">
              The preview updates every 2s. After clicking, wait a moment for the
              page to respond.
            </p>
          </>
        ) : (
          <>
            <p className="font-body text-sm text-parchment-300/70 mb-4 max-w-sm">
              {stage}
            </p>

            {/* Progress bar */}
            <div className="w-full max-w-xs mb-6">
              <div className="h-1.5 bg-obsidian-600 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-gold-500 to-gold-300 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.max(pct, status === 'processing' ? 5 : 0)}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
              <p className="font-ui text-xs text-parchment-300/40 mt-2 text-right">
                {pct}%
              </p>
            </div>

            {/* HeroForge iframe — try embedding first; falls back gracefully if blocked */}
            <div className="w-full max-w-sm mb-4">
              <p className="font-ui text-xs text-parchment-300/30 mb-2 text-left tracking-wider uppercase">
                HeroForge preview
              </p>
              <div className="relative w-full rounded-lg overflow-hidden border border-white/[0.08] bg-obsidian-700" style={{ aspectRatio: '1 / 1' }}>
                <iframe
                  src={heroforgeUrl}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; camera; gyroscope; xr-spatial-tracking"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  title="HeroForge 3D viewer"
                />
              </div>
            </div>

            {/* Screenshot-based live preview (server-side view) */}
            {displayedSrc && (
              <div className="w-full max-w-sm mb-4">
                <p className="font-ui text-xs text-parchment-300/30 mb-2 text-left tracking-wider uppercase">
                  Capture progress
                </p>
                <img
                  src={displayedSrc}
                  alt="Live capture preview"
                  className="w-full rounded-lg border border-white/[0.08] bg-obsidian-700"
                />
              </div>
            )}

            <p className="font-ui text-xs text-parchment-300/30 max-w-xs leading-relaxed">
              We&apos;re capturing 36 poses of your miniature. This may take up to a minute.
            </p>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
