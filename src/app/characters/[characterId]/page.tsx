import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/db'
import { characters, parties } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { PageContainer } from '@/components/layout/page-container'
import { RotationViewer } from '@/components/rotation-viewer/rotation-viewer'
import { ProcessingOverlay } from '@/components/registration/processing-overlay'
import { CharacterStatusClient } from './character-status-client'
import { ChevronLeft, Scroll, Users, ExternalLink } from 'lucide-react'

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
            <div className="card-dark rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="font-display text-lg text-parchment-200 mb-2">
                Capture Failed
              </h3>
              <p className="font-body text-sm text-parchment-300/60 mb-6 leading-relaxed">
                {character.jobError ?? 'An error occurred while capturing the miniature.'}
              </p>
              <Link
                href="/characters/new"
                className="btn-secondary inline-flex items-center gap-2"
              >
                Try Again
              </Link>
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
