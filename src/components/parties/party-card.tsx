'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Users, ChevronRight } from 'lucide-react'
import type { Party } from '@/db/schema'

interface PartyCardProps {
  party: Party & { characterCount: number }
}

export function PartyCard({ party }: PartyCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Link
        href={`/parties/${party.id}`}
        className="group block card-dark p-6 rounded-xl hover:border-gold-500/30 hover:shadow-glow-gold transition-all duration-300"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-obsidian-600 to-obsidian-700 border border-white/[0.1] flex items-center justify-center flex-shrink-0 group-hover:border-gold-500/40 transition-colors duration-300">
                <Users className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-parchment-100 group-hover:text-gold-gradient transition-all duration-200 truncate">
                  {party.name}
                </h3>
                <p className="font-ui text-xs text-parchment-300/50 mt-0.5">
                  {party.characterCount} {party.characterCount === 1 ? 'adventurer' : 'adventurers'}
                </p>
              </div>
            </div>

            {party.description && (
              <p className="font-body text-sm text-parchment-300/60 line-clamp-2 leading-relaxed">
                {party.description}
              </p>
            )}
          </div>

          <ChevronRight className="w-5 h-5 text-parchment-300/30 group-hover:text-gold-400 flex-shrink-0 mt-1 transition-colors duration-200" />
        </div>

        {/* Gold shimmer border on hover */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute inset-0 rounded-xl ring-1 ring-gold-500/20" />
        </div>
      </Link>
    </motion.div>
  )
}
