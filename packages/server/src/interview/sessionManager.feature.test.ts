import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb, seedUser, seedSession } from '../test/helpers/createTestDb.js'
import { endSession, skipQuestion } from './sessionManager.js'
import * as schema from '../db/schema.js'
import type { Db } from '../types.js'

vi.mock('../llm/provider.js', () => ({
  transformToCoachingTone: vi.fn().mockResolvedValue('次の質問です'),
  extractFactsFromConversation: vi.fn().mockResolvedValue({ facts: [], timeline: [], vignettes: [] }),
}))

describe('sessionManager (feature)', () => {
  let db: Db
  let teardown: () => void

  beforeEach(async () => {
    ({ db, teardown } = await createTestDb())
    await seedUser(db, 'user-a')
    await seedUser(db, 'user-b')
  })

  afterEach(() => teardown())

  describe('endSession', () => {
    it('throws when userId does not match session owner', async () => {
      const sessionId = crypto.randomUUID()
      await seedSession(db, sessionId, 'user-a')

      await expect(endSession(db, sessionId, 'user-b'))
        .rejects.toThrow('Session not found or already ended')
    })

    it('marks session as completed for the correct owner', async () => {
      const sessionId = crypto.randomUUID()
      await seedSession(db, sessionId, 'user-a')

      await endSession(db, sessionId, 'user-a')

      const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId))
      expect(session.status).toBe('completed')
      expect(session.endedAt).not.toBeNull()
    })

    it('throws if session is already completed', async () => {
      const sessionId = crypto.randomUUID()
      await seedSession(db, sessionId, 'user-a')
      await endSession(db, sessionId, 'user-a')

      await expect(endSession(db, sessionId, 'user-a'))
        .rejects.toThrow('Session not found or already ended')
    })
  })

  describe('skipQuestion', () => {
    it('throws when userId does not match session owner', async () => {
      const sessionId = crypto.randomUUID()
      await seedSession(db, sessionId, 'user-a')

      await expect(skipQuestion(db, sessionId, 'user-b'))
        .rejects.toThrow('Session not found or already ended')
    })

    it('increments questionsAsked for the correct owner', async () => {
      const sessionId = crypto.randomUUID()
      await seedSession(db, sessionId, 'user-a')

      await skipQuestion(db, sessionId, 'user-a')

      const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId))
      expect(session.questionsAsked).toBe(1)
    })
  })
})
