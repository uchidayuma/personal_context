import { eq, inArray } from 'drizzle-orm'
import type { Db } from '../types.js'
import {
  rawLogs, structuredFacts, factEvidences, lifeTimeline,
  timelineEvidences, sessionVignettes,
} from '../db/schema.js'
import { extractFactsFromConversation } from '../llm/provider.js'

export type SessionSummary = { facts: Record<string, number>; timeline: number; vignettes: string[] }

export async function buildSessionSummary(db: Db, sessionId: string): Promise<SessionSummary> {
  const logs = await db.select({ id: rawLogs.id }).from(rawLogs).where(eq(rawLogs.sessionId, sessionId))
  const logIds = logs.map(l => l.id)

  const [savedFacts, savedTimeline, savedVignettes] = await Promise.all([
    logIds.length === 0 ? [] : db
      .selectDistinct({ id: structuredFacts.id, category: structuredFacts.category })
      .from(structuredFacts)
      .innerJoin(factEvidences, eq(factEvidences.factId, structuredFacts.id))
      .where(inArray(factEvidences.logId, logIds)),
    logIds.length === 0 ? [] : db
      .selectDistinct({ id: lifeTimeline.id })
      .from(lifeTimeline)
      .innerJoin(timelineEvidences, eq(timelineEvidences.timelineId, lifeTimeline.id))
      .where(inArray(timelineEvidences.logId, logIds)),
    db.select({ title: sessionVignettes.title }).from(sessionVignettes).where(eq(sessionVignettes.sessionId, sessionId)),
  ])

  const facts = savedFacts.reduce<Record<string, number>>((acc, f) => {
    acc[f.category] = (acc[f.category] ?? 0) + 1
    return acc
  }, {})

  return { facts, timeline: savedTimeline.length, vignettes: savedVignettes.map(v => v.title) }
}

export async function extractAndSaveFacts(db: Db, sessionId: string, userId: string, conversation: string, language = 'ja') {
  const result = await extractFactsFromConversation(conversation, language)

  const logIds = await db
    .select({ id: rawLogs.id })
    .from(rawLogs)
    .where(eq(rawLogs.sessionId, sessionId))

  await db.transaction(async (tx) => {
    if (result.facts.length > 0) {
      const factIds = result.facts.map(() => crypto.randomUUID())
      await tx.insert(structuredFacts).values(
        result.facts.map((fact, i) => ({
          id: factIds[i], userId,
          category: fact.category,
          subcategory: fact.subcategory ?? null,
          fact: fact.fact,
          confidenceScore: fact.confidence_score,
          visibility: fact.visibility,
        }))
      )
      if (logIds.length > 0) {
        await tx.insert(factEvidences)
          .values(factIds.flatMap(factId => logIds.map(log => ({ factId, logId: log.id }))))
          .onConflictDoNothing()
      }
    }

    const validEvents = result.timeline.filter(e => e.event_year !== null)
    if (validEvents.length > 0) {
      const timelineIds = validEvents.map(() => crypto.randomUUID())
      await tx.insert(lifeTimeline).values(
        validEvents.map((event, i) => ({
          id: timelineIds[i], userId,
          eventYear: event.event_year!,
          eventMonth: event.event_month ?? undefined,
          ageAtEvent: event.age_at_event ?? undefined,
          eventDescription: event.event_description,
          visibility: event.visibility,
        }))
      )
      if (logIds.length > 0) {
        await tx.insert(timelineEvidences)
          .values(timelineIds.flatMap(timelineId => logIds.map(log => ({ timelineId, logId: log.id }))))
          .onConflictDoNothing()
      }
    }

    if (result.vignettes.length > 0) {
      await tx.insert(sessionVignettes).values(
        result.vignettes.map(vignette => ({
          id: crypto.randomUUID(),
          userId,
          sessionId,
          title: vignette.title,
          period: vignette.period,
          quote: vignette.quote,
          scene: vignette.scene,
          insight: vignette.insight,
          selfGap: vignette.self_gap ?? undefined,
          visibility: 'public' as const,
        }))
      )
    }
  })
}
