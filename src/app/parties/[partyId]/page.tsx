import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/db'
import { parties, characters } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { PageContainer } from '@/components/layout/page-container'
import { CharacterCard } from '@/components/characters/character-card'
import { ChevronLeft, Plus, Users } from 'lucide-react'

interface Props {
  params: Promise<{ partyId: string }>
}

async function getPartyWithCharacters(partyId: string) {
  const party = await db.query.parties.findFirst({
    where: eq(parties.id, partyId),
  })
  if (!party) return null

  const chars = await db.query.characters.findMany({
    where: eq(characters.partyId, partyId),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  })

  return { party, characters: chars }
}

export default async function PartyPage({ params }: Props) {
  const { partyId } = await params
  const data = await getPartyWithCharacters(partyId)
  if (!data) notFound()

  const { party, characters: chars } = data

  return (
    <PageContainer>
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 font-ui text-sm text-parchment-300/50 hover:text-gold-400 transition-colors duration-150 mb-8"
      >
        <ChevronLeft className="w-4 h-4" />
        All Parties
      </Link>

      {/* Party header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-obsidian-600 border border-gold-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-gold-400" />
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-gold-gradient">
              {party.name}
            </h1>
          </div>
          {party.description && (
            <p className="font-body text-base text-parchment-300/60 mt-2 max-w-xl leading-relaxed">
              {party.description}
            </p>
          )}
          <p className="font-ui text-sm text-parchment-300/40 mt-2">
            {chars.length} {chars.length === 1 ? 'adventurer' : 'adventurers'} enrolled
          </p>
        </div>

        <Link
          href={`/characters/new?party=${encodeURIComponent(party.name)}`}
          className="btn-primary inline-flex items-center gap-2 self-start sm:self-end whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Character
        </Link>
      </div>

      <div className="divider-rune mb-8">The Roster</div>

      {/* Characters grid */}
      {chars.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">⚔️</div>
          <h2 className="font-display text-xl text-parchment-300/50 mb-3">
            No Characters Yet
          </h2>
          <p className="font-body text-parchment-300/40 mb-6">
            This party awaits its first adventurer.
          </p>
          <Link
            href={`/characters/new?party=${encodeURIComponent(party.name)}`}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Register First Character
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {chars.map((char) => (
            <CharacterCard key={char.id} character={char} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
