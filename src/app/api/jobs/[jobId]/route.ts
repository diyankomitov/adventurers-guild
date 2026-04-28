export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { jobQueue } from '@/lib/job-queue'
import { db } from '@/db'
import { characters } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    // Check in-memory queue first (most up-to-date)
    const job = jobQueue.getJob(jobId)
    if (job) {
      return NextResponse.json({
        status: job.status,
        progress: job.progress,
        stage: job.stage,
        error: job.error,
        characterId: job.characterId,
      })
    }

    // Job may have been cleaned from memory — check DB by jobId
    const character = await db.query.characters.findFirst({
      where: eq(characters.jobId, jobId),
    })

    if (!character) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      status: character.jobStatus,
      progress: character.frameCount,
      stage: character.jobStatus === 'complete' ? 'Done!' : character.jobStatus,
      error: character.jobError,
      characterId: character.id,
    })
  } catch (err) {
    console.error('[GET /api/jobs/[jobId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
