import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { and, eq, sql } from 'drizzle-orm'
import * as schema from './schema.js'
import type { Db } from '../types.js'
import path from 'path'
import fs from 'fs'
import { migrate } from 'drizzle-orm/libsql/migrator'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'personal_context.db')
const SIMULATE_DB_PATH = process.env.SIMULATE_DB_PATH ?? path.join(process.cwd(), 'data', 'simulate.db')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const client = createClient({ url: `file:${DB_PATH}` })
const simulateClient = createClient({ url: `file:${SIMULATE_DB_PATH}` })

export const db = drizzle(client, { schema })
export const simulateDb = drizzle(simulateClient, { schema })

const DRIZZLE_FOLDER = new URL('../../drizzle', import.meta.url).pathname

export async function initDatabase() {
  await migrate(db, { migrationsFolder: DRIZZLE_FOLDER })
  await migrate(simulateDb, { migrationsFolder: DRIZZLE_FOLDER })
}

export const DEFAULT_USER_ID = 'local_default_user'

export async function ensureDefaultUser(targetDb: Db = db) {
  const result = await targetDb
    .select({ id: schema.users.id, onboardingCompletedAt: schema.users.onboardingCompletedAt })
    .from(schema.users)
    .where(eq(schema.users.id, DEFAULT_USER_ID))
  if (result.length === 0) {
    console.log('[DEBUG ensureDefaultUser] user not found, inserting...')
    await targetDb.insert(schema.users).values({ id: DEFAULT_USER_ID, name: 'Local User', language: 'ja' })
  } else {
    console.log('[DEBUG ensureDefaultUser] user exists, onboarding_completed_at =', result[0].onboardingCompletedAt)
  }
}

export async function clearSimulateData() {
  await simulateClient.executeMultiple(`
    DELETE FROM session_vignettes;
    DELETE FROM fact_evidences;
    DELETE FROM timeline_evidences;
    DELETE FROM user_questions;
    DELETE FROM structured_facts;
    DELETE FROM life_timeline;
    DELETE FROM professional_records;
    DELETE FROM raw_logs;
    DELETE FROM sessions;
    DELETE FROM users;
  `)
  await ensureDefaultUser(simulateDb)
}

export async function getUser(targetDb: Db, userId: string): Promise<{ name: string | null; language: string; onboardingCompletedAt: string | null }> {
  const [row] = await targetDb
    .select({
      name: schema.users.name,
      language: schema.users.language,
      onboardingCompletedAt: schema.users.onboardingCompletedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
  return {
    name: row?.name ?? null,
    language: row?.language ?? 'ja',
    onboardingCompletedAt: row?.onboardingCompletedAt ?? null,
  }
}

export async function ensureDemoUser(targetDb: Db, userId: string): Promise<void> {
  await targetDb
    .insert(schema.users)
    .values({ id: userId, name: null, language: 'ja', onboardingCompletedAt: new Date().toISOString() })
    .onConflictDoNothing()
}

export async function checkDemoRateLimit(targetDb: Db, ip: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)
  const existing = await targetDb
    .select({ sessionCount: schema.demoRateLimit.sessionCount })
    .from(schema.demoRateLimit)
    .where(and(eq(schema.demoRateLimit.ip, ip), eq(schema.demoRateLimit.date, today)))
  if (existing.length > 0 && existing[0].sessionCount >= 1) return false
  await targetDb
    .insert(schema.demoRateLimit)
    .values({ ip, date: today, sessionCount: 1 })
    .onConflictDoUpdate({
      target: [schema.demoRateLimit.ip, schema.demoRateLimit.date],
      set: { sessionCount: sql`session_count + 1` },
    })
  return true
}

export async function cleanupDemoData(targetDb: Db): Promise<void> {
  await targetDb
    .delete(schema.users)
    .where(and(
      sql`datetime(created_at) < datetime('now', '-2 hours')`,
      sql`id != ${DEFAULT_USER_ID}`,
    ))
  await targetDb
    .delete(schema.demoRateLimit)
    .where(sql`date < date('now')`)
}

export async function getUserLanguage(targetDb: Db, userId: string): Promise<string> {
  const [row] = await targetDb
    .select({ language: schema.users.language })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
  return row?.language ?? 'ja'
}

export async function updateUserLanguage(targetDb: Db, userId: string, language: string): Promise<void> {
  await targetDb
    .update(schema.users)
    .set({ language, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(schema.users.id, userId))
}
