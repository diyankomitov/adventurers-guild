export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { parties, characters } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { jobQueue } from '@/lib/job-queue'

const createCharacterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(1000).optional(),
  heroforgeUrl: z
    .string()
    .url()
    .refine(
      (url) => /heroforge\.com\/load_config[=%3D][\w-]+/i.test(url),
      'Must be a HeroForge share URL'
    ),
  partyName: z.string().min(1).max(100),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = createCharacterSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }

    const { name, description, heroforgeUrl, partyName } = parsed.data
    const now = new Date()

    // Find or create the party
    let party = await db.query.parties.findFirst({
      where: eq(parties.name, partyName),
    })

    if (!party) {
      const partyId = nanoid(10)
      await db.insert(parties).values({
        id: partyId,
        name: partyName,
        createdAt: now,
        updatedAt: now,
      })
      party = await db.query.parties.findFirst({ where: eq(parties.id, partyId) })
    }

    if (!party) {
      return NextResponse.json({ error: 'Failed to create party' }, { status: 500 })
    }

    // Create character
    const characterId = nanoid(10)
    await db.insert(characters).values({
      id: characterId,
      partyId: party.id,
      name,
      description,
      heroforgeUrl,
      jobStatus: 'pending',
      frameCount: 0,
      createdAt: now,
      updatedAt: now,
    })

    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    })

    // Enqueue screenshot job (non-blocking)
    const jobId = jobQueue.enqueue(characterId, heroforgeUrl)

    return NextResponse.json({ character, jobId }, { status: 202 })
  } catch (err) {
    console.error('[POST /api/characters]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
