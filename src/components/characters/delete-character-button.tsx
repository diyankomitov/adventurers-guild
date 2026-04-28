'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface Props {
  characterId: string
  characterName: string
  partyId: string
}

export function DeleteCharacterButton({ characterId, characterName, partyId }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/characters/${characterId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push(`/parties/${partyId}`)
      }
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-ui text-sm text-parchment-300/60">Delete "{characterName}"?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="font-ui text-sm text-blood-400 hover:text-blood-300 transition-colors px-2 py-1 rounded hover:bg-blood-400/10 disabled:opacity-50"
        >
          {loading ? 'Deleting...' : 'Yes, delete'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="font-ui text-sm text-parchment-300/40 hover:text-parchment-300/70 transition-colors px-2 py-1 rounded hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 font-ui text-sm text-parchment-300/30 hover:text-blood-400 transition-colors duration-150 px-2 py-1 rounded hover:bg-blood-400/10"
    >
      <Trash2 className="w-3.5 h-3.5" />
      Delete
    </button>
  )
}
