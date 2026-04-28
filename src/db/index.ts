import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

// DATA_DIR can be overridden via env var — set it to the Railway volume mount path
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'guild.db')
type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>

const globalForDb = global as unknown as { _db?: DrizzleDB }

function createDb(): DrizzleDB {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const sqlite = new Database(DB_PATH)
  sqlite.pragma('busy_timeout = 10000') // wait up to 10s if locked
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema })
}

function getDb(): DrizzleDB {
  if (!globalForDb._db) {
    globalForDb._db = createDb()
  }
  return globalForDb._db
}

// Lazy proxy: importing this module does NOT open the DB file.
// The connection is created only when the first query is made.
export const db = new Proxy({} as DrizzleDB, {
  get(_target, prop) {
    const d = getDb()
    const val = Reflect.get(d, prop)
    return typeof val === 'function'
      ? (val as (...args: unknown[]) => unknown).bind(d)
      : val
  },
})
