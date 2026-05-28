import { Hono } from 'hono'
import { db, DEFAULT_USER_ID } from '../db/client.js'
import * as schema from '../db/schema.js'
import { eq, desc, asc } from 'drizzle-orm'

const { structuredFacts, lifeTimeline, sessionVignettes } = schema

export const contextSummaryRoute = new Hono()

contextSummaryRoute.get('/', async (c) => {
  const userId = DEFAULT_USER_ID

  const [facts, timeline, vignettes] = await Promise.all([
    db.select().from(structuredFacts)
      .where(eq(structuredFacts.userId, userId))
      .orderBy(desc(structuredFacts.createdAt))
      .limit(8),
    db.select().from(lifeTimeline)
      .where(eq(lifeTimeline.userId, userId))
      .orderBy(asc(lifeTimeline.eventYear)),
    db.select().from(sessionVignettes)
      .where(eq(sessionVignettes.userId, userId))
      .orderBy(desc(sessionVignettes.createdAt))
      .limit(1),
  ])

  return c.json({
    facts: facts.map(f => ({ category: f.category, fact: f.fact })),
    timeline: timeline.map(t => ({
      year: t.eventYear,
      month: t.eventMonth,
      description: t.eventDescription,
    })),
    vignette: vignettes[0] ?? null,
  })
})
