export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import path from 'path'
import fs from 'fs/promises'
import { db } from '@/db'
import { characters, parties } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { PageContainer } from '@/components/layout/page-container'
import { RotationViewer } from '@/components/rotation-viewer/rotation-viewer'
import { CharacterStatusClient } from './character-status-client'
import { ChevronLeft, Scroll, Users, ExternalLink, Download } from 'lucide-react'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')

async function getDebugScreenshots(characterId: string): Promise<string[]> {
  const dir = path.join(DATA_DIR, 'characters', characterId)
  try {
    const files = await fs.readdir(dir)
    return files.filter((f) => f.startsWith('debug-') && f.endsWith('.png'))
  } catch {
    return []
  }
}

interface Props {
  params: Promise<{ characterId: string }>
}

async function getCharacterWithParty(characterId: string) {
  const char = await db.query.characters.findFirst({
    where: eq(characters.id, characterId),
  })
  if (!char) return null

  const party = await db.query.parties.findFirst({
    where: eq(parties.id, char.partyId),
  })

  return { character: char, party }
}

export default async function CharacterDetailPage({ params }: Props) {
  const { characterId } = await params
  const data = await getCharacterWithParty(characterId)
  if (!data) notFound()

  const { character, party } = data
  const isComplete = character.jobStatus === 'complete' && character.frameCount > 0
  const isPending =
    character.jobStatus === 'pending' || character.jobStatus === 'processing'
  const isError = character.jobStatus === 'error'
  const debugScreenshots = isError ? await getDebugScreenshots(characterId) : []

  return (
    <PageContainer>
      {/* Back link */}
      {party && (
        <Link
          href={`/parties/${party.id}`}
          className="inline-flex items-center gap-1.5 font-ui text-sm text-parchment-300/50 hover:text-gold-400 transition-colors duration-150 mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          {party.name}
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* Rotation viewer / processing state */}
        <div>
          {isComplete ? (
            <RotationViewer
              characterId={character.id}
              frameCount={character.frameCount}
            />
          ) : isPending ? (
            <CharacterStatusClient characterId={character.id} jobId={character.jobId} />
          ) : (
            /* Error state */
            <div className="space-y-4">
              <div className="card-dark rounded-2xl p-8 text-center">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="font-display text-lg text-parchment-200 mb-2">
                  Capture Failed
                </h3>
                <p className="font-body text-sm text-parchment-300/60 mb-6 leading-relaxed whitespace-pre-wrap break-words">
                  {character.jobError ?? 'An error occurred while capturing the miniature.'}
                </p>
                <Link
                  href="/characters/new"
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  Try Again
                </Link>
              </div>

              {debugScreenshots.length > 0 && (
                <div className="card-dark rounded-2xl p-5 space-y-4">
                  <p className="font-display text-sm tracking-widest uppercase text-parchment-300/40">
                    Debug Screenshots
                  </p>
                  {debugScreenshots.map((filename) => {
                    const url = `/api/frames/${characterId}/${filename}`
                    return (
                      <div key={filename} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-ui text-xs text-parchment-300/50">{filename}</span>
                          <a
                            href={`${url}?download=1`}
                            download={filename}
                            className="inline-flex items-center gap-1.5 font-ui text-xs text-parchment-300/50 hover:text-gold-400 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </a>
                        </div>
                        <img
                          src={url}
                          alt={filename}
                          className="w-full rounded-lg border border-white/[0.08]"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Character info */}
        <div className="space-y-6">
          {/* Name + party */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              {party && (
                <Link
                  href={`/parties/${party.id}`}
                  className="inline-flex items-center gap-1.5 font-ui text-xs text-parchment-300/50 hover:text-gold-400 transition-colors bg-obsidian-700 px-2.5 py-1 rounded-full border border-white/[0.08]"
                >
                  <Users className="w-3 h-3" />
                  {party.name}
                </Link>
              )}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-gold-gradient leading-tight">
              {character.name}
            </h1>
          </div>

          {/* Description */}
          {character.description && (
            <div className="card-dark rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Scroll className="w-4 h-4 text-gold-400/60" />
                <span className="font-display text-xs tracking-widest uppercase text-parchment-300/40">
                  Lore
                </span>
              </div>
              <p className="font-body text-base text-parchment-300/80 leading-relaxed">
                {character.description}
              </p>
            </div>
          )}

          {/* HeroForge link */}
          <a
            href={character.heroforgeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-ui text-sm text-parchment-300/50 hover:text-gold-400 transition-colors duration-150"
          >
            <ExternalLink className="w-4 h-4" />
            View in HeroForge
          </a>

          {/* Status indicator */}
          {isPending && (
            <div className="flex items-center gap-2 font-ui text-sm text-parchment-300/40">
              <span className="inline-block w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
              Miniature capture in progress...
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
