import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from './db/schema.js'

export type Db = PostgresJsDatabase<typeof schema>
export type AppVariables = { userId: string; db: Db; userType?: string }
