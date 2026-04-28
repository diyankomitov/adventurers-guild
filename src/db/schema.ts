import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const parties = sqliteTable('parties', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  partyId: text('party_id')
    .notNull()
    .references(() => parties.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  heroforgeUrl: text('heroforge_url').notNull(),
  frameCount: integer('frame_count').notNull().default(0),
  jobId: text('job_id'),
  jobStatus: text('job_status', {
    enum: ['pending', 'processing', 'complete', 'error'],
  })
    .notNull()
    .default('pending'),
  jobError: text('job_error'),
  jobStartedAt: integer('job_started_at', { mode: 'timestamp' }),
  jobCompletedAt: integer('job_completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export type Party = typeof parties.$inferSelect
export type NewParty = typeof parties.$inferInsert
export type Character = typeof characters.$inferSelect
export type NewCharacter = typeof characters.$inferInsert
export type JobStatus = 'pending' | 'processing' | 'complete' | 'error'
