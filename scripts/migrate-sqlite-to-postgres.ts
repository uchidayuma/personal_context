#!/usr/bin/env tsx

import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import postgres from 'postgres'
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import * as schema from '../packages/server/src/db/schema.js'
import path from 'path'

// SQLite source database
const SQLITE_PATH = process.env.SQLITE_PATH ?? path.join(process.cwd(), 'data', 'personal_context.db')
const sqliteClient = createClient({ url: `file:${SQLITE_PATH}` })
const sqliteDb = drizzle(sqliteClient, { schema })

// PostgreSQL target database
const PG_URL = process.env.DATABASE_URL ?? 'postgresql://personal_context:personal_context@localhost:5432/personal_context'
const pgClient = postgres(PG_URL)
const pgDb = drizzlePg(pgClient, { schema })

async function migrateData() {
  console.log('🔄 Starting migration from SQLite to PostgreSQL...')
  console.log(`📁 SQLite: ${SQLITE_PATH}`)
  console.log(`🐘 PostgreSQL: ${PG_URL}`)

  try {
    // 1. Migrate users
    console.log('\n👥 Migrating users...')
    // SQLite has old schema (no clerk_id, userType, email)
    const users = await sqliteDb.select({
      id: schema.users.id,
      name: schema.users.name,
      language: schema.users.language,
      onboardingCompletedAt: schema.users.onboardingCompletedAt,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    }).from(schema.users)

    for (const user of users) {
      await pgDb.insert(schema.users).values({
        id: user.id,
        name: user.name,
        language: user.language,
        clerkId: null, // New field: null for local users
        userType: 'free', // New field: default to free
        email: null, // New field: null for local users
        onboardingCompletedAt: user.onboardingCompletedAt ? new Date(user.onboardingCompletedAt) : null,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      }).onConflictDoNothing()
    }
    console.log(`✅ Migrated ${users.length} users`)

    // 2. Migrate questions
    console.log('\n❓ Migrating questions...')
    const questions = await sqliteDb.select({
      id: schema.questions.id,
      category: schema.questions.category,
      content: schema.questions.content,
      priority: schema.questions.priority,
      isActive: schema.questions.isActive,
    }).from(schema.questions)

    for (const question of questions) {
      await pgDb.insert(schema.questions).values({
        id: question.id,
        category: question.category,
        content: question.content,
        priority: question.priority,
        isActive: Boolean(question.isActive), // Convert integer to boolean
      }).onConflictDoNothing()
    }
    console.log(`✅ Migrated ${questions.length} questions`)

    // 3. Migrate question translations
    console.log('\n🌐 Migrating question translations...')
    const translations = await sqliteDb.select().from(schema.questionTranslations)
    for (const translation of translations) {
      await pgDb.insert(schema.questionTranslations).values(translation).onConflictDoNothing()
    }
    console.log(`✅ Migrated ${translations.length} translations`)

    // 4. Migrate sessions
    console.log('\n📝 Migrating sessions...')
    const sessions = await sqliteDb.select().from(schema.sessions)
    for (const session of sessions) {
      await pgDb.insert(schema.sessions).values({
        ...session,
        createdAt: new Date(session.createdAt),
        endedAt: session.endedAt ? new Date(session.endedAt) : null,
      }).onConflictDoNothing()
    }
    console.log(`✅ Migrated ${sessions.length} sessions`)

    // 5. Migrate raw logs
    console.log('\n💬 Migrating raw logs...')
    const logs = await sqliteDb.select().from(schema.rawLogs)
    for (const log of logs) {
      await pgDb.insert(schema.rawLogs).values({
        ...log,
        createdAt: new Date(log.createdAt),
      }).onConflictDoNothing()
    }
    console.log(`✅ Migrated ${logs.length} raw logs`)

    // 6. Migrate user questions
    console.log('\n📋 Migrating user questions...')
    const userQuestions = await sqliteDb.select().from(schema.userQuestions)
    for (const uq of userQuestions) {
      await pgDb.insert(schema.userQuestions).values({
        ...uq,
        answeredAt: new Date(uq.answeredAt),
        skippedAt: uq.skippedAt ? new Date(uq.skippedAt) : null,
      }).onConflictDoNothing()
    }
    console.log(`✅ Migrated ${userQuestions.length} user questions`)

    // 7. Migrate structured facts
    console.log('\n📊 Migrating structured facts...')
    const facts = await sqliteDb.select().from(schema.structuredFacts)
    for (const fact of facts) {
      await pgDb.insert(schema.structuredFacts).values({
        ...fact,
        createdAt: new Date(fact.createdAt),
        updatedAt: new Date(fact.updatedAt),
      }).onConflictDoNothing()
    }
    console.log(`✅ Migrated ${facts.length} structured facts`)

    // 8. Migrate fact evidences
    console.log('\n🔗 Migrating fact evidences...')
    const factEvidences = await sqliteDb.select().from(schema.factEvidences)
    let evidenceCount = 0
    let skippedEvidences = 0
    for (const evidence of factEvidences) {
      try {
        await pgDb.insert(schema.factEvidences).values(evidence).onConflictDoNothing()
        evidenceCount++
      } catch (error: any) {
        if (error.code === '23503') {
          // Foreign key constraint violation - skip this record
          skippedEvidences++
        } else {
          throw error
        }
      }
    }
    console.log(`✅ Migrated ${evidenceCount} fact evidences (skipped ${skippedEvidences} orphaned records)`)

    // 9. Migrate life timeline
    console.log('\n📅 Migrating life timeline...')
    const timeline = await sqliteDb.select().from(schema.lifeTimeline)
    for (const event of timeline) {
      await pgDb.insert(schema.lifeTimeline).values({
        ...event,
        createdAt: new Date(event.createdAt),
        updatedAt: new Date(event.updatedAt),
      }).onConflictDoNothing()
    }
    console.log(`✅ Migrated ${timeline.length} timeline events`)

    // 10. Migrate timeline evidences
    console.log('\n🔗 Migrating timeline evidences...')
    const timelineEvidences = await sqliteDb.select().from(schema.timelineEvidences)
    let timelineEvidenceCount = 0
    let skippedTimelineEvidences = 0
    for (const evidence of timelineEvidences) {
      try {
        await pgDb.insert(schema.timelineEvidences).values(evidence).onConflictDoNothing()
        timelineEvidenceCount++
      } catch (error: any) {
        if (error.code === '23503') {
          // Foreign key constraint violation - skip this record
          skippedTimelineEvidences++
        } else {
          throw error
        }
      }
    }
    console.log(`✅ Migrated ${timelineEvidenceCount} timeline evidences (skipped ${skippedTimelineEvidences} orphaned records)`)

    // 11. Migrate professional records
    console.log('\n💼 Migrating professional records...')
    const professionalRecords = await sqliteDb.select().from(schema.professionalRecords)
    for (const record of professionalRecords) {
      await pgDb.insert(schema.professionalRecords).values({
        ...record,
        createdAt: new Date(record.createdAt),
      }).onConflictDoNothing()
    }
    console.log(`✅ Migrated ${professionalRecords.length} professional records`)

    // 12. Migrate session vignettes
    console.log('\n✨ Migrating session vignettes...')
    const vignettes = await sqliteDb.select().from(schema.sessionVignettes)
    for (const vignette of vignettes) {
      await pgDb.insert(schema.sessionVignettes).values({
        ...vignette,
        createdAt: new Date(vignette.createdAt),
      }).onConflictDoNothing()
    }
    console.log(`✅ Migrated ${vignettes.length} session vignettes`)

    console.log('\n🎉 Migration completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`   Users: ${users.length}`)
    console.log(`   Questions: ${questions.length}`)
    console.log(`   Sessions: ${sessions.length}`)
    console.log(`   Raw logs: ${logs.length}`)
    console.log(`   Structured facts: ${facts.length}`)
    console.log(`   Fact evidences: ${evidenceCount}/${factEvidences.length} (${skippedEvidences} orphaned)`)
    console.log(`   Timeline events: ${timeline.length}`)
    console.log(`   Timeline evidences: ${timelineEvidenceCount}/${timelineEvidences.length} (${skippedTimelineEvidences} orphaned)`)
    console.log(`   Professional records: ${professionalRecords.length}`)
    console.log(`   Session vignettes: ${vignettes.length}`)

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    throw error
  } finally {
    await pgClient.end()
  }
}

migrateData().catch(console.error)
