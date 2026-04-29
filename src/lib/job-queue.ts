import { captureHeroForgeFrames } from './heroforge-capture'
import { db } from '@/db'
import { characters } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export interface Job {
  id: string
  characterId: string
  heroforgeUrl: string
  status: 'pending' | 'processing' | 'waiting_for_user' | 'complete' | 'error'
  progress: number // 0–36
  stage: string
  error?: string
  createdAt: Date
  // Set while status === 'waiting_for_user'; forwards clicks to the live browser
  _relayMouseEvent?: (x: number, y: number) => void
  // Callbacks receiving base64-JPEG screencast frames
  _frameSubscribers: Set<(frame: string) => void>
}

class JobQueue {
  private jobs = new Map<string, Job>()
  private queue: string[] = []
  private running = false

  enqueue(characterId: string, heroforgeUrl: string): string {
    const jobId = nanoid(12)
    const job: Job = {
      id: jobId,
      characterId,
      heroforgeUrl,
      status: 'pending',
      progress: 0,
      stage: 'Queued...',
      createdAt: new Date(),
      _frameSubscribers: new Set(),
    }
    this.jobs.set(jobId, job)
    this.queue.push(jobId)

    db.update(characters)
      .set({ jobId, jobStatus: 'pending' })
      .where(eq(characters.id, characterId))
      .run()

    void this.processNext()
    return jobId
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId)
  }

  /** Forwards a mouse click to the running Playwright page (called from the interact API). */
  relayClick(jobId: string, coords: { x: number; y: number }): boolean {
    const job = this.jobs.get(jobId)
    if (!job?._relayMouseEvent) return false
    job._relayMouseEvent(coords.x, coords.y)
    return true
  }

  /** Subscribe to live CDP screencast frames for a job. */
  subscribeFrames(jobId: string, cb: (frame: string) => void): void {
    this.jobs.get(jobId)?._frameSubscribers.add(cb)
  }

  /** Unsubscribe from screencast frames. */
  unsubscribeFrames(jobId: string, cb: (frame: string) => void): void {
    this.jobs.get(jobId)?._frameSubscribers.delete(cb)
  }

  private async processNext(): Promise<void> {
    if (this.running || this.queue.length === 0) return
    this.running = true

    const jobId = this.queue.shift()!
    const job = this.jobs.get(jobId)!
    job.status = 'processing'

    db.update(characters)
      .set({ jobStatus: 'processing', jobStartedAt: new Date() })
      .where(eq(characters.id, job.characterId))
      .run()

    try {
      await captureHeroForgeFrames(
        job.heroforgeUrl,
        job.characterId,
        (done, stage) => {
          job.progress = done
          job.stage = stage
        },
        {
          onScreencastFrame: (frame) => {
            job._frameSubscribers.forEach((cb) => cb(frame))
          },
          setRelayHandler: (handler) => {
            if (handler) {
              job.status = 'waiting_for_user'
              job._relayMouseEvent = handler
            } else {
              if (job.status === 'waiting_for_user') job.status = 'processing'
              delete job._relayMouseEvent
            }
          },
        },
      )

      job.status = 'complete'
      job.progress = 36

      db.update(characters)
        .set({
          jobStatus: 'complete',
          frameCount: 36,
          jobCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(characters.id, job.characterId))
        .run()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      job.status = 'error'
      job.error = msg

      db.update(characters)
        .set({ jobStatus: 'error', jobError: msg, updatedAt: new Date() })
        .where(eq(characters.id, job.characterId))
        .run()
    } finally {
      this.running = false
      setTimeout(() => this.jobs.delete(jobId), 10 * 60 * 1000)
      void this.processNext()
    }
  }
}

const globalForQueue = global as unknown as { _jobQueue?: JobQueue }
export const jobQueue = globalForQueue._jobQueue ?? new JobQueue()
if (process.env.NODE_ENV !== 'production') globalForQueue._jobQueue = jobQueue
