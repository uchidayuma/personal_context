import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { eq, sql } from 'drizzle-orm'
import * as schema from './schema.js'
import type { Db } from '../types.js'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'personal_context.db')
const SIMULATE_DB_PATH = process.env.SIMULATE_DB_PATH ?? path.join(process.cwd(), 'data', 'simulate.db')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const client = createClient({ url: `file:${DB_PATH}` })
const simulateClient = createClient({ url: `file:${SIMULATE_DB_PATH}` })

export const db = drizzle(client, { schema })
export const simulateDb = drizzle(simulateClient, { schema })

const CREATE_TABLES_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    language TEXT NOT NULL DEFAULT 'ja',
    onboarding_completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'regular',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'abandoned')),
    questions_asked INTEGER NOT NULL DEFAULT 0,
    followup_count INTEGER NOT NULL DEFAULT 0,
    current_question_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS raw_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('system', 'assistant', 'user')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS question_translations (
    question_id TEXT NOT NULL,
    language TEXT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (question_id, language),
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS user_questions (
    user_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, question_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS structured_facts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    fact TEXT NOT NULL,
    confidence_score REAL NOT NULL DEFAULT 0.8,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public', 'private')),
    source TEXT NOT NULL DEFAULT 'interview' CHECK(source IN ('import', 'interview')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS fact_evidences (
    fact_id TEXT NOT NULL,
    log_id TEXT NOT NULL,
    PRIMARY KEY (fact_id, log_id),
    FOREIGN KEY (fact_id) REFERENCES structured_facts(id) ON DELETE CASCADE,
    FOREIGN KEY (log_id) REFERENCES raw_logs(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS life_timeline (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_year INTEGER NOT NULL,
    event_month INTEGER,
    event_day INTEGER,
    age_at_event INTEGER,
    event_description TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public', 'private')),
    source TEXT NOT NULL DEFAULT 'interview' CHECK(source IN ('import', 'interview')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS timeline_evidences (
    timeline_id TEXT NOT NULL,
    log_id TEXT NOT NULL,
    PRIMARY KEY (timeline_id, log_id),
    FOREIGN KEY (timeline_id) REFERENCES life_timeline(id) ON DELETE CASCADE,
    FOREIGN KEY (log_id) REFERENCES raw_logs(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS professional_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    role TEXT,
    start_year INTEGER NOT NULL,
    start_month INTEGER,
    end_year INTEGER,
    end_month INTEGER,
    description TEXT,
    skills TEXT,
    source TEXT NOT NULL DEFAULT 'import',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS session_vignettes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    title TEXT NOT NULL,
    period TEXT NOT NULL,
    quote TEXT NOT NULL,
    scene TEXT NOT NULL,
    insight TEXT NOT NULL,
    self_gap TEXT,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public', 'private')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
`

export async function initDatabase() {
  await client.executeMultiple(CREATE_TABLES_SQL)
  await simulateClient.executeMultiple(CREATE_TABLES_SQL)
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
