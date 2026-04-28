export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { characters } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    })

    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }

    return NextResponse.json(character)
  } catch (err) {
    console.error('[GET /api/characters/[characterId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
