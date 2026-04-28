'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { frameUrl } from '@/lib/utils'
import type { Character } from '@/db/schema'

interface CharacterCardProps {
  character: Character
}

export function CharacterCard({ character }: CharacterCardProps) {
  const isComplete = character.jobStatus === 'complete' && character.frameCount > 0
  const isProcessing =
    character.jobStatus === 'pending' || character.jobStatus === 'processing'
  const isError = character.jobStatus === 'error'

  return (
    <motion.div
      whileHover={isComplete ? { y: -4, scale: 1.02 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="relative"
    >
      <Link
        href={`/characters/${character.id}`}
        className="group block card-dark rounded-xl overflow-hidden hover:border-gold-500/30 hover:shadow-card-hover transition-all duration-300"
      >
        {/* Frame preview / placeholder */}
        <div className="relative aspect-square bg-obsidian-700 overflow-hidden">
          {isComplete ? (
            <img
              src={frameUrl(character.id, 0)}
              alt={character.name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isProcessing && (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
                  <span className="font-ui text-xs text-parchment-300/50">
                    Capturing...
                  </span>
                </div>
              )}
              {isError && (
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="w-8 h-8 text-blood-400" />
                  <span className="font-ui text-xs text-blood-400/70">Failed</span>
                </div>
              )}
            </div>
          )}

          {/* Gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-obsidian-800/90 to-transparent pointer-events-none" />

          {/* Status badge top-right */}
          {isComplete && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-obsidian-900/80 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-gold-400" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-display text-sm font-semibold text-parchment-100 truncate group-hover:text-gold-gradient transition-all duration-200">
            {character.name}
          </h3>
          {character.description && (
            <p className="font-body text-xs text-parchment-300/50 mt-1 line-clamp-2 leading-relaxed">
              {character.description}
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
