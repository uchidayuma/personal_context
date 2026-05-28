import { Hono } from 'hono'
import * as schema from '../db/schema.js'
import { eq, desc, asc, sql } from 'drizzle-orm'
import type { AppVariables } from '../types.js'

const { structuredFacts, lifeTimeline, sessionVignettes } = schema

export const contextSummaryRoute = new Hono<{ Variables: AppVariables }>()

contextSummaryRoute.get('/', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')

  const ranked = db
    .select({
      category: structuredFacts.category,
      fact: structuredFacts.fact,
      rn: sql<number>`row_number() over (
        partition by ${structuredFacts.category}
        order by ${structuredFacts.createdAt} desc
      )`.as('rn'),
    })
    .from(structuredFacts)
    .where(eq(structuredFacts.userId, userId))
    .as('ranked')

  const [facts, timeline, vignettes] = await Promise.all([
    db.select({ category: ranked.category, fact: ranked.fact })
      .from(ranked)
      .where(sql`${ranked.rn} <= 2`),
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
