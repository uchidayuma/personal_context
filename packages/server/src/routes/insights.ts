import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getUserLanguage } from '../db/client.js'
import { generateInsights } from '../llm/provider.js'
import * as schema from '../db/schema.js'
import type { AppVariables } from '../types.js'

const { structuredFacts, lifeTimeline } = schema

export const insightsRoute = new Hono<{ Variables: AppVariables }>()

insightsRoute.get('/', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  try {
    const [facts, timeline, language] = await Promise.all([
      db.select({ category: structuredFacts.category, fact: structuredFacts.fact })
        .from(structuredFacts)
        .where(eq(structuredFacts.userId, userId))
        .limit(30),
      db.select({
        year: lifeTimeline.eventYear,
        description: lifeTimeline.eventDescription,
      })
        .from(lifeTimeline)
        .where(eq(lifeTimeline.userId, userId))
        .orderBy(lifeTimeline.eventYear),
      getUserLanguage(db, userId),
    ])

    if (facts.length === 0 && timeline.length === 0) {
      return c.json({ comment: null })
    }

    const comment = await generateInsights(facts, timeline, language)
    return c.json({ comment })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to generate insights' }, 500)
  }
})
