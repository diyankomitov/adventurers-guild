export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { jobQueue } from '@/lib/job-queue'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const { x, y } = await req.json() as { x: number; y: number }

  if (typeof x !== 'number' || typeof y !== 'number') {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  const ok = jobQueue.relayClick(jobId, { x, y })
  if (!ok) {
    return NextResponse.json({ error: 'No pending interaction for this job' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
