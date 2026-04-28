export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ characterId: string; frame: string }> }
) {
  const { characterId, frame } = await params

  // Strict sanitization: only allow alphanumeric IDs and known filename patterns
  if (!/^[\w-]{1,20}$/.test(characterId)) {
    return new NextResponse('Not Found', { status: 404 })
  }
  // Allow frame-NNN.png and debug-*.png (label is alphanumeric+hyphens, max 40 chars)
  if (!/^frame-\d{3}\.png$/.test(frame) && !/^debug-[\w-]{1,40}\.png$/.test(frame)) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const filePath = path.join(DATA_DIR, 'characters', characterId, frame)

  const isDebug = frame.startsWith('debug-')
  const dl = req.nextUrl.searchParams.get('download') === '1'

  try {
    const buffer = await fs.readFile(filePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': isDebug ? 'no-store' : 'public, max-age=31536000, immutable',
        ...(dl ? { 'Content-Disposition': `attachment; filename="${frame}"` } : {}),
      },
    })
  } catch {
    return new NextResponse('Not Found', { status: 404 })
  }
}

