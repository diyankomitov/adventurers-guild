export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { db } from '@/db'
import { characters } from '@/db/schema'
import { eq } from 'drizzle-orm'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')

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

export async function DELETE(
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

    await db.delete(characters).where(eq(characters.id, characterId))

    // Best-effort: remove captured frames from disk
    const framesDir = path.join(DATA_DIR, 'characters', characterId)
    await fs.rm(framesDir, { recursive: true, force: true }).catch(() => {})

    return NextResponse.json({ ok: true, partyId: character.partyId })
  } catch (err) {
    console.error('[DELETE /api/characters/[characterId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

