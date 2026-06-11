import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { and, eq, sql } from 'drizzle-orm'
import * as schema from './schema.js'
import type { Db } from '../types.js'
import { fileURLToPath } from 'url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

// PostgreSQL connection from DATABASE_URL environment variable
const connectionString = process.env.DATABASE_URL ?? 'postgresql://personal_context:personal_context@localhost:5432/personal_context'

// Create PostgreSQL client
const client = postgres(connectionString, { max: 10 })

export const db = drizzle(client, { schema })

// Migrations folder path
const DRIZZLE_FOLDER = process.env.NODE_ENV === 'production'
  ? fileURLToPath(new URL('../drizzle', import.meta.url))
  : fileURLToPath(new URL('../../drizzle', import.meta.url))

export async function initDatabase() {
  console.log('[initDatabase] Running PostgreSQL migrations...')
  try {
    await migrate(db, { migrationsFolder: DRIZZLE_FOLDER })
  } catch (e) {
    console.error('[initDatabase] Migration failed:', e)
    throw e
  }
}

export async function clearSimulateData() {
  // REMOVED: simulate database feature removed for simplicity
  // Tests should use transactions with rollback instead
  throw new Error('clearSimulateData is deprecated - use test transactions instead')
}

// User management helpers
export const DEFAULT_USER_ID = 'local_default_user'

export async function ensureDefaultUser(targetDb: Db = db) {
  const result = await targetDb
    .select({ id: schema.users.id, onboardingCompletedAt: schema.users.onboardingCompletedAt })
    .from(schema.users)
    .where(eq(schema.users.id, DEFAULT_USER_ID))
  if (result.length === 0) {
    console.log('[DEBUG ensureDefaultUser] user not found, inserting...')
    await targetDb.insert(schema.users).values({
      id: DEFAULT_USER_ID,
      name: 'Local User',
      language: 'ja',
      userType: 'free',
    })
  } else {
    console.log('[DEBUG ensureDefaultUser] user exists, onboarding_completed_at =', result[0].onboardingCompletedAt)
  }
}

export async function getUser(targetDb: Db, userId: string): Promise<{ name: string | null; language: string; onboardingCompletedAt: Date | null }> {
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
    .values({
      id: userId,
      name: null,
      language: 'ja',
      onboardingCompletedAt: new Date(),
      userType: 'anonymous',
    })
    .onConflictDoNothing()
}

export async function ensureAnonymousUser(targetDb: Db, userId: string): Promise<void> {
  await targetDb
    .insert(schema.users)
    .values({
      id: userId,
      name: null,
      language: 'ja',
      onboardingCompletedAt: new Date(),
      userType: 'anonymous',
    })
    .onConflictDoNothing()
}

export async function getOrCreateUserFromClerk(
  targetDb: Db,
  clerkId: string,
  email: string | null,
  name: string | null,
): Promise<{ id: string; userType: string }> {
  // Check if user exists by clerkId
  const [existing] = await targetDb
    .select({ id: schema.users.id, userType: schema.users.userType })
    .from(schema.users)
    .where(eq(schema.users.clerkId, clerkId))

  if (existing) {
    return existing
  }

  // Create new user
  const userId = crypto.randomUUID()
  await targetDb.insert(schema.users).values({
    id: userId,
    clerkId,
    email,
    name,
    language: 'ja',
    userType: 'free',
    onboardingCompletedAt: null, // New users need to complete onboarding
  })

  return { id: userId, userType: 'free' }
}

export async function checkDemoRateLimit(targetDb: Db, ip: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)
  const existing = await targetDb
    .select({ sessionCount: schema.demoRateLimit.sessionCount })
    .from(schema.demoRateLimit)
    .where(and(eq(schema.demoRateLimit.ip, ip), eq(schema.demoRateLimit.date, today)))
  if (existing.length > 0 && existing[0].sessionCount >= 3) return false
  await targetDb
    .insert(schema.demoRateLimit)
    .values({ ip, date: today, sessionCount: 1 })
    .onConflictDoUpdate({
      target: [schema.demoRateLimit.ip, schema.demoRateLimit.date],
      set: { sessionCount: sql`demo_rate_limit.session_count + 1` },
    })
  return true
}

export async function checkAnonymousRateLimit(targetDb: Db, ip: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)
  const existing = await targetDb
    .select({ sessionCount: schema.anonymousRateLimit.sessionCount })
    .from(schema.anonymousRateLimit)
    .where(and(eq(schema.anonymousRateLimit.ip, ip), eq(schema.anonymousRateLimit.date, today)))

  if (existing.length > 0 && existing[0].sessionCount >= 3) return false

  await targetDb
    .insert(schema.anonymousRateLimit)
    .values({ ip, date: today, sessionCount: 1 })
    .onConflictDoUpdate({
      target: [schema.anonymousRateLimit.ip, schema.anonymousRateLimit.date],
      set: { sessionCount: sql`anonymous_rate_limit.session_count + 1` },
    })
  return true
}

export async function checkFreeUserRateLimit(targetDb: Db, userId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)
  const existing = await targetDb
    .select({ sessionCount: schema.sessionQuota.sessionCount })
    .from(schema.sessionQuota)
    .where(and(eq(schema.sessionQuota.userId, userId), eq(schema.sessionQuota.date, today)))

  if (existing.length > 0 && existing[0].sessionCount >= 3) return false

  await targetDb
    .insert(schema.sessionQuota)
    .values({ userId, date: today, sessionCount: 1 })
    .onConflictDoUpdate({
      target: [schema.sessionQuota.userId, schema.sessionQuota.date],
      set: { sessionCount: sql`session_quota.session_count + 1` },
    })
  return true
}

export async function cleanupDemoData(targetDb: Db): Promise<void> {
  // Delete anonymous users older than 20 minutes
  await targetDb
    .delete(schema.users)
    .where(and(
      eq(schema.users.userType, 'anonymous'),
      sql`${schema.users.createdAt} < NOW() - INTERVAL '20 minutes'`,
    ))

  // Delete old rate limit records
  await targetDb
    .delete(schema.demoRateLimit)
    .where(sql`${schema.demoRateLimit.date} < CURRENT_DATE`)

  await targetDb
    .delete(schema.anonymousRateLimit)
    .where(sql`${schema.anonymousRateLimit.date} < CURRENT_DATE`)

  await targetDb
    .delete(schema.sessionQuota)
    .where(sql`${schema.sessionQuota.date} < CURRENT_DATE - INTERVAL '7 days'`)
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
    .set({ language, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
}
