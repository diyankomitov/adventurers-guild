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
      const onFrame = (frame: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${frame}\n\n`))
        } catch {
          // Client disconnected — will be cleaned up by abort signal
        }
      }

      jobQueue.subscribeFrames(jobId, onFrame)

      req.signal.addEventListener('abort', () => {
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
