'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle } from 'lucide-react'

interface ProcessingOverlayProps {
  jobId: string
  onComplete: () => void
  onError: (message: string) => void
}

const TOTAL_FRAMES = 36

export function ProcessingOverlay({ jobId, onComplete, onError }: ProcessingOverlayProps) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'pending' | 'processing' | 'complete' | 'error'>(
    'pending'
  )
  const [errorMsg, setErrorMsg] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        if (!res.ok) return
        const data = await res.json() as { status: string; progress: number; error?: string }

        setStatus(data.status as typeof status)
        setProgress(data.progress ?? 0)

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

  const pct = Math.round((progress / TOTAL_FRAMES) * 100)
  const statusText =
    status === 'pending'
      ? 'Preparing the ritual...'
      : progress > 0
        ? `Capturing pose ${progress} of ${TOTAL_FRAMES}...`
        : 'Summoning your adventurer...'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center py-20 px-8 text-center"
      >
        {/* Rune spinner */}
        <div className="relative mb-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            className="w-20 h-20 rounded-full border-2 border-gold-500/30 border-t-gold-400"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 4.5, ease: 'linear' }}
            className="absolute inset-2 rounded-full border border-dashed border-gold-500/20"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">⚔</span>
          </div>
        </div>

        <h2 className="font-display text-2xl font-semibold text-gold-gradient mb-3">
          Chronicling Your Hero
        </h2>

        {status === 'error' ? (
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="w-8 h-8 text-blood-400" />
            <p className="font-body text-base text-parchment-300/70">{errorMsg}</p>
          </div>
        ) : (
          <>
            <p className="font-body text-base text-parchment-300/70 mb-8 max-w-sm">
              {statusText}
            </p>

            {/* Progress bar */}
            <div className="w-full max-w-xs">
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

            <p className="font-ui text-xs text-parchment-300/30 mt-6 max-w-xs leading-relaxed">
              We&apos;re capturing 36 poses of your miniature. This may take up to a minute.
            </p>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
