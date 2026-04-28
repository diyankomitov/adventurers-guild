import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'guild.db')

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>
const globalForDb = global as unknown as { _db?: DrizzleDB }

function createDb(): DrizzleDB {
  const sqlite = new Database(DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema })
}

export const db = globalForDb._db ?? createDb()
if (process.env.NODE_ENV !== 'production') globalForDb._db = db
