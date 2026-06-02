import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb, seedUser, seedSession } from '../test/helpers/createTestDb.js'
import { extractAndSaveFacts, buildSessionSummary } from './factExtractor.js'
import { extractFactsFromConversation } from '../llm/provider.js'
import * as schema from '../db/schema.js'
import type { Db } from '../types.js'

vi.mock('../llm/provider.js', () => ({
  extractFactsFromConversation: vi.fn(),
}))

describe('factExtractor (feature)', () => {
  let db: Db
  let teardown: () => void
  const userId = 'test-user'
  let sessionId: string

  beforeEach(async () => {
    ({ db, teardown } = await createTestDb())
    await seedUser(db, userId)
    sessionId = crypto.randomUUID()
    await seedSession(db, sessionId, userId)

    await db.insert(schema.rawLogs).values([
      { id: crypto.randomUUID(), userId, sessionId, role: 'assistant', content: 'こんにちは' },
      { id: crypto.randomUUID(), userId, sessionId, role: 'user', content: '自律を大事にしています' },
    ])
  })

  afterEach(() => teardown())

  describe('extractAndSaveFacts', () => {
    it('facts と factEvidences を正しくリンクして保存する', async () => {
      vi.mocked(extractFactsFromConversation).mockResolvedValueOnce({
        facts: [
          { category: 'values', subcategory: 'core_values', fact: '自律を大事にしている', confidence_score: 0.9, visibility: 'public' },
        ],
        timeline: [],
        vignettes: [],
      })

      await extractAndSaveFacts(db, sessionId, userId, '[user]: 自律を大事にしています')

      const facts = await db.select().from(schema.structuredFacts).where(eq(schema.structuredFacts.userId, userId))
      expect(facts).toHaveLength(1)
      expect(facts[0].fact).toBe('自律を大事にしている')
      expect(facts[0].category).toBe('values')

      const evidences = await db.select().from(schema.factEvidences).where(eq(schema.factEvidences.factId, facts[0].id))
      expect(evidences).toHaveLength(2) // 2 rawLogs
    })

    it('timeline と timelineEvidences を正しくリンクして保存する', async () => {
      vi.mocked(extractFactsFromConversation).mockResolvedValueOnce({
        facts: [],
        timeline: [
          { event_year: 2016, event_month: 9, age_at_event: null, event_description: '起業した', visibility: 'public' },
        ],
        vignettes: [],
      })

      await extractAndSaveFacts(db, sessionId, userId, '[user]: 2016年9月に起業しました')

      const events = await db.select().from(schema.lifeTimeline).where(eq(schema.lifeTimeline.userId, userId))
      expect(events).toHaveLength(1)
      expect(events[0].eventYear).toBe(2016)

      const evidences = await db.select().from(schema.timelineEvidences).where(eq(schema.timelineEvidences.timelineId, events[0].id))
      expect(evidences).toHaveLength(2)
    })

    it('event_year が null のタイムラインエントリはスキップする', async () => {
      vi.mocked(extractFactsFromConversation).mockResolvedValueOnce({
        facts: [],
        timeline: [{ event_year: null, event_month: null, age_at_event: null, event_description: '不明な時期', visibility: 'public' }],
        vignettes: [],
      })

      await extractAndSaveFacts(db, sessionId, userId, 'test')

      const events = await db.select().from(schema.lifeTimeline).where(eq(schema.lifeTimeline.userId, userId))
      expect(events).toHaveLength(0)
    })

    it('LLM が空結果を返したときはDBに何も書き込まない', async () => {
      vi.mocked(extractFactsFromConversation).mockResolvedValueOnce({ facts: [], timeline: [], vignettes: [] })

      await extractAndSaveFacts(db, sessionId, userId, '')

      const facts = await db.select().from(schema.structuredFacts).where(eq(schema.structuredFacts.userId, userId))
      expect(facts).toHaveLength(0)
    })
  })

  describe('buildSessionSummary', () => {
    it('factEvidences 経由で正しくカテゴリ別カウントを返す', async () => {
      vi.mocked(extractFactsFromConversation).mockResolvedValueOnce({
        facts: [
          { category: 'values', subcategory: undefined, fact: 'fact-1', confidence_score: 0.9, visibility: 'public' },
          { category: 'values', subcategory: undefined, fact: 'fact-2', confidence_score: 0.8, visibility: 'public' },
          { category: 'goals',  subcategory: undefined, fact: 'fact-3', confidence_score: 0.7, visibility: 'public' },
        ],
        timeline: [
          { event_year: 2020, event_month: null, age_at_event: null, event_description: 'イベント', visibility: 'public' },
        ],
        vignettes: [
          { title: '転機', period: '2020', quote: '...' , scene: '...', insight: '...', self_gap: null },
        ],
      })

      await extractAndSaveFacts(db, sessionId, userId, 'conversation')
      const summary = await buildSessionSummary(db, sessionId)

      expect(summary.facts['values']).toBe(2)
      expect(summary.facts['goals']).toBe(1)
      expect(summary.timeline).toBe(1)
      expect(summary.vignettes).toEqual(['転機'])
    })

    it('ログが存在しないセッションでは空のサマリーを返す', async () => {
      const emptySessionId = crypto.randomUUID()
      await seedSession(db, emptySessionId, userId)

      const summary = await buildSessionSummary(db, emptySessionId)

      expect(summary.facts).toEqual({})
      expect(summary.timeline).toBe(0)
      expect(summary.vignettes).toEqual([])
    })
  })
})
