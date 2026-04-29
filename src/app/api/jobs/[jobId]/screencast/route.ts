export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { jobQueue } from '@/lib/job-queue'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  if (!jobQueue.getJob(jobId)) {
    return new Response('Job not found', { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (chunk: string) => {
        try { controller.enqueue(encoder.encode(chunk)) } catch { /* client disconnected */ }
      }

      const onFrame = (frame: string) => enqueue(`data: ${frame}\n\n`)
      jobQueue.subscribeFrames(jobId, onFrame)

      // Heartbeat: lets the client distinguish "connected, page is loading"
      // from "actually disconnected" when no screencast frames are coming
      const pingInterval = setInterval(() => enqueue('event: ping\ndata: \n\n'), 10_000)

      req.signal.addEventListener('abort', () => {
        clearInterval(pingInterval)
        jobQueue.unsubscribeFrames(jobId, onFrame)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering on Railway
    },
  })
}
