'use client'

import { useRouter } from 'next/navigation'
import { ProcessingOverlay } from '@/components/registration/processing-overlay'

interface Props {
  characterId: string
  jobId: string | null
  heroforgeUrl: string
}

export function CharacterStatusClient({ characterId, jobId, heroforgeUrl }: Props) {
  const router = useRouter()

  if (!jobId) {
    return (
      <div className="card-dark rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">⏳</div>
        <p className="font-body text-parchment-300/60">
          Miniature capture is queued...
        </p>
      </div>
    )
  }

  return (
    <div className="card-dark rounded-2xl overflow-hidden">
      <ProcessingOverlay
        jobId={jobId}
        heroforgeUrl={heroforgeUrl}
        onComplete={() => router.refresh()}
        onError={() => router.refresh()}
      />
    </div>
  )
}
