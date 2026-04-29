'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle } from 'lucide-react'

interface ProcessingOverlayProps {
  jobId: string
  heroforgeUrl?: string
  onComplete: () => void
  onError: (message: string) => void
}

const TOTAL_FRAMES = 36
const VIEWPORT_W = 800
const VIEWPORT_H = 800
// Show "connecting…" badge if no frame received within this many ms
const STALE_THRESHOLD_MS = 6_000

export function ProcessingOverlay({ jobId, onComplete, onError }: ProcessingOverlayProps) {
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('Queued...')
  const [status, setStatus] = useState<'pending' | 'processing' | 'waiting_for_user' | 'complete' | 'error'>(
    'pending'
  )
  const [errorMsg, setErrorMsg] = useState('')
  const [lastFrameTs, setLastFrameTs] = useState(0)
  const [lastPingTs, setLastPingTs] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const esRef = useRef<EventSource | null>(null)
  const statusRef = useRef(status)
  statusRef.current = status

  // Poll job status
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
        }

        setStatus(data.status as typeof status)
        setProgress(data.progress ?? 0)
        if (data.stage) setStage(data.stage)

        if (data.status === 'complete') {
          clearInterval(intervalRef.current!)
          onComplete()
        } else if (data.status === 'error') {
          clearInterval(intervalRef.current!)
          setErrorMsg(data.error ?? 'An unknown error occurred')
          onError(data.error ?? 'Unknown error')
        }
      } catch { /* network error — keep polling */ }
    }

    poll()
    intervalRef.current = setInterval(poll, 2_000)
    return () => clearInterval(intervalRef.current!)
  }, [jobId, onComplete, onError])

  // CDP screencast via SSE — connect once per jobId, auto-reconnect on error.
  // Does NOT reconnect on status changes to avoid dropping frames mid-capture.
  useEffect(() => {
    let destroyed = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (destroyed) return
      const es = new EventSource(`/api/jobs/${jobId}/screencast`)
      esRef.current = es

      es.onmessage = (e) => {
        setLastFrameTs(Date.now())
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const img = new window.Image()
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        img.src = `data:image/jpeg;base64,${e.data}`
      }

      // Heartbeat: server sends a ping every 10s so we can tell
      // "connected but page is loading" from "actually disconnected"
      es.addEventListener('ping', () => setLastPingTs(Date.now()))

      es.onerror = () => {
        es.close()
        esRef.current = null
        // Only retry if job is still active
        if (!destroyed && statusRef.current !== 'complete' && statusRef.current !== 'error') {
          retryTimer = setTimeout(connect, 3_000)
        }
      }
    }

    connect()

    return () => {
      destroyed = true
      if (retryTimer) clearTimeout(retryTimer)
      esRef.current?.close()
      esRef.current = null
    }
  }, [jobId])

  // Tick every 2s to keep the stale badge accurate
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 2_000)
    return () => clearInterval(t)
  }, [])

  // Close SSE once job reaches a terminal state
  useEffect(() => {
    if (status === 'complete' || status === 'error') {
      esRef.current?.close()
      esRef.current = null
    }
  }, [status])

  // Forward pointer events on the canvas to the Playwright browser
  const handleCanvasPointer = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * VIEWPORT_W)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * VIEWPORT_H)
    await fetch(`/api/jobs/${jobId}/interact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    })
  }, [jobId])

  const pct = Math.round((progress / TOTAL_FRAMES) * 100)
  const isWaiting = status === 'waiting_for_user'

  // Three badge states:
  // 'live'        — frames arriving (green)
  // 'loading'     — connected (ping received) but page not rendering yet (amber)
  // 'connecting'  — no heartbeat either, SSE is down (grey pulse)
  const hasRecentFrame = lastFrameTs > 0 && now - lastFrameTs < STALE_THRESHOLD_MS
  const hasRecentPing  = lastPingTs > 0  && now - lastPingTs  < 25_000
  const badgeState = hasRecentFrame ? 'live' : hasRecentPing ? 'loading' : 'connecting'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center py-12 px-8 text-center"
      >
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

        ) : (
          <>
            {isWaiting ? (
              <p className="font-body text-sm text-parchment-300/60 mb-4 max-w-sm">
                Click the verification checkbox below. Your clicks go directly to the browser.
              </p>
            ) : (
              <>
                <p className="font-body text-sm text-parchment-300/70 mb-4 max-w-sm">
                  {stage}
                </p>
                <div className="w-full max-w-xs mb-5">
                  <div className="h-1.5 bg-obsidian-600 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-gold-500 to-gold-300 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.max(pct, status === 'processing' ? 5 : 0)}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="font-ui text-xs text-parchment-300/40 mt-2 text-right">{pct}%</p>
                </div>
              </>
            )}

            {/* Live canvas — CDP screencast frames via SSE */}
            <div className="relative w-full max-w-sm mb-3">
              <canvas
                ref={canvasRef}
                width={VIEWPORT_W}
                height={VIEWPORT_H}
                onClick={isWaiting ? handleCanvasPointer : undefined}
                className={`w-full rounded-lg border bg-obsidian-700 ${
                  isWaiting
                    ? 'border-2 border-gold-400/50 cursor-crosshair'
                    : 'border-white/[0.08] cursor-default'
                }`}
                style={{ aspectRatio: '1 / 1' }}
              />

              {/* Connection status badge */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-obsidian-900/80 backdrop-blur-sm border border-white/[0.08]">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                  badgeState === 'live'
                    ? 'bg-green-400'
                    : badgeState === 'loading'
                      ? 'bg-gold-400 animate-pulse'
                      : 'bg-parchment-300/30 animate-pulse'
                }`} />
                <span className="font-ui text-[10px] text-parchment-300/40">
                  {badgeState === 'live' ? 'live' : badgeState === 'loading' ? 'loading…' : 'connecting…'}
                </span>
              </div>
            </div>

            <p className="font-ui text-xs text-parchment-300/30 max-w-xs leading-relaxed">
              {isWaiting
                ? 'Live browser view · clicks are forwarded in real time'
                : 'Live browser view · capturing 36 poses of your miniature'}
            </p>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
