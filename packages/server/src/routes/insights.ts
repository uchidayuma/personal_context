import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, DEFAULT_USER_ID, getUserLanguage } from '../db/client.js'
import { generateInsights } from '../llm/provider.js'
import * as schema from '../db/schema.js'

const { structuredFacts, lifeTimeline } = schema

export const insightsRoute = new Hono()

insightsRoute.get('/', async (c) => {
  try {
    const [facts, timeline, language] = await Promise.all([
      db.select({ category: structuredFacts.category, fact: structuredFacts.fact })
        .from(structuredFacts)
        .where(eq(structuredFacts.userId, DEFAULT_USER_ID))
        .limit(30),
      db.select({
        year: lifeTimeline.eventYear,
        description: lifeTimeline.eventDescription,
      })
        .from(lifeTimeline)
        .where(eq(lifeTimeline.userId, DEFAULT_USER_ID))
        .orderBy(lifeTimeline.eventYear),
      getUserLanguage(DEFAULT_USER_ID),
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
