import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type * as schema from './db/schema.js'

export type Db = LibSQLDatabase<typeof schema>
export type AppVariables = { userId: string; db: Db }
