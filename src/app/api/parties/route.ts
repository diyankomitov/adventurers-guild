import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { parties, characters } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'

export async function GET() {
  try {
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
      .orderBy(parties.name)

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/parties]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const createPartySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = createPartySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const { name, description } = parsed.data
    const id = nanoid(10)
    const now = new Date()

    await db.insert(parties).values({ id, name, description, createdAt: now, updatedAt: now })

    const party = await db.query.parties.findFirst({ where: eq(parties.id, id) })
    return NextResponse.json(party, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'A party with that name already exists' }, { status: 409 })
    }
    console.error('[POST /api/parties]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
