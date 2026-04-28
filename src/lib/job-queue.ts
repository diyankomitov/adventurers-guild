import { captureHeroForgeFrames } from './heroforge-capture'
import { db } from '@/db'
import { characters } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export interface Job {
  id: string
  characterId: string
  heroforgeUrl: string
  status: 'pending' | 'processing' | 'complete' | 'error'
  progress: number // 0–36
  stage: string
  error?: string
  createdAt: Date
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
    }
    this.jobs.set(jobId, job)
    this.queue.push(jobId)

    db.update(characters)
      .set({ jobId, jobStatus: 'pending' })
      .where(eq(characters.id, characterId))
      .run()

    // Fire and forget — do not await
    void this.processNext()
    return jobId
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId)
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
      await captureHeroForgeFrames(job.heroforgeUrl, job.characterId, (done, stage) => {
        job.progress = done
        job.stage = stage
      })

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
      // Clean up job from memory after 10 minutes
      setTimeout(() => this.jobs.delete(jobId), 10 * 60 * 1000)
      void this.processNext()
    }
  }
}

const globalForQueue = global as unknown as { _jobQueue?: JobQueue }
export const jobQueue = globalForQueue._jobQueue ?? new JobQueue()
if (process.env.NODE_ENV !== 'production') globalForQueue._jobQueue = jobQueue
