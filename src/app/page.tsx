import Link from 'next/link'
import { db } from '@/db'
import { parties, characters } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { PageContainer } from '@/components/layout/page-container'
import { PartyCard } from '@/components/parties/party-card'
import { Scroll, Plus } from 'lucide-react'

async function getPartiesWithCount() {
  const rows = await db
    .select({
      id: parties.id,
      name: parties.name,
      description: parties.description,
      createdAt: parties.createdAt,
      updatedAt: parties.updatedAt,
      characterCount: sql<number>`count(${characters.id})`,
    })
    .from(parties)
    .leftJoin(characters, eq(characters.partyId, parties.id))
    .groupBy(parties.id)
    .orderBy(parties.createdAt)

  return rows
}

export default async function HomePage() {
  const partiesWithCount = await getPartiesWithCount()

  return (
    <PageContainer>
      {/* Hero section */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-obsidian-700 border border-white/[0.08] mb-6">
          <Scroll className="w-3.5 h-3.5 text-gold-400" />
          <span className="font-ui text-xs tracking-widest uppercase text-parchment-300/60">
            The Registry
          </span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-gold-gradient mb-4 leading-tight">
          Adventurer&apos;s Guild
        </h1>
        <p className="font-body text-lg sm:text-xl text-parchment-300/60 max-w-2xl mx-auto leading-relaxed">
          A chronicle of heroes, villains, and wanderers from across the realms.
          Browse the parties, or add your own adventurer to the rolls.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/characters/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Register Your Character
          </Link>
        </div>
      </div>

      {/* Divider */}
      <div className="divider-rune mb-10">Parties &amp; Campaigns</div>

      {/* Parties grid */}
      {partiesWithCount.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🏰</div>
          <h2 className="font-display text-xl text-parchment-300/50 mb-3">
            No Parties Yet
          </h2>
          <p className="font-body text-parchment-300/40 mb-8">
            Be the first to join the guild and register your character.
          </p>
          <Link href="/characters/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Register First Character
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative">
          {partiesWithCount.map((party) => (
            <PartyCard key={party.id} party={party} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
