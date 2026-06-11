import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { fileURLToPath } from 'url'
import * as schema from '../../db/schema.js'
import type { Db } from '../../types.js'

// src/test/helpers/ → ../../.. → packages/server/drizzle
const DRIZZLE_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url))

// テスト用PostgreSQL接続（環境変数 TEST_DATABASE_URL または Docker上のデフォルト）
export async function createTestDb(): Promise<{ db: Db; teardown: () => Promise<void> }> {
  const connectionString = process.env.TEST_DATABASE_URL
    ?? 'postgresql://personal_context:personal_context@localhost:5432/personal_context_test'

  const client = postgres(connectionString, { max: 1 })
  const db = drizzle(client, { schema })

  // マイグレーション実行
  await migrate(db, { migrationsFolder: DRIZZLE_FOLDER })

  // テスト開始時に全データをクリア（CASCADE で外部キー制約を無視）
  await client.unsafe(`
    TRUNCATE TABLE users CASCADE
  `)

  return {
    db,
    teardown: async () => {
      // DB接続を閉じる
      await client.end()
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
