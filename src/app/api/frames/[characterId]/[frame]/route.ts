import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ characterId: string; frame: string }> }
) {
  const { characterId, frame } = await params

  // Strict sanitization: only allow alphanumeric IDs and frame-NNN.png filenames
  if (!/^[\w-]{1,20}$/.test(characterId)) {
    return new NextResponse('Not Found', { status: 404 })
  }
  if (!/^frame-\d{3}\.png$/.test(frame)) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const filePath = path.join(process.cwd(), 'data', 'characters', characterId, frame)

  try {
    const buffer = await fs.readFile(filePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Not Found', { status: 404 })
  }
}
