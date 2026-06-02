import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlinkSync } from 'fs'
import * as schema from '../../db/schema.js'
import type { Db } from '../../types.js'

// src/test/helpers/ → ../../.. → packages/server/drizzle
const DRIZZLE_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url))

// libsql の :memory: URL は接続ごとに独立した DB を持つため、
// db.transaction() が別接続を使うとテーブルが見えなくなる。
// 一時ファイルを使うことでこの問題を回避する。
export async function createTestDb(): Promise<{ db: Db; teardown: () => void }> {
  const tmpPath = join(tmpdir(), `pc-test-${crypto.randomUUID()}.db`)
  const client = createClient({ url: `file:${tmpPath}` })
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: DRIZZLE_FOLDER })
  return {
    db,
    teardown: () => {
      client.close()
      try { unlinkSync(tmpPath) } catch {}
      try { unlinkSync(`${tmpPath}-wal`) } catch {}
      try { unlinkSync(`${tmpPath}-shm`) } catch {}
    },
  }
}

export async function seedUser(db: Db, userId: string, language = 'ja') {
  await db.insert(schema.users).values({ id: userId, name: 'Test User', language })
}

export async function seedSession(db: Db, sessionId: string, userId: string, opts: { type?: 'regular' | 'onboarding' } = {}) {
  await db.insert(schema.sessions).values({
    id: sessionId,
    userId,
    type: opts.type ?? 'regular',
  })
}
