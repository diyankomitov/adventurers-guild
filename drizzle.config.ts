import type { Config } from 'drizzle-kit'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(DATA_DIR, 'guild.db'),
  },
} satisfies Config
