import { Hono } from 'hono'
import { count, and, eq } from 'drizzle-orm'
import type { Db } from '../types.js'
import * as schema from '../db/schema.js'
import type { StructuredFactCategory } from '../db/schema.js'
import type { AppVariables } from '../types.js'
import { LAYER_META, type LayerMeta } from '../export/layers.js'

const { structuredFacts, lifeTimeline, professionalRecords, sessionVignettes } = schema

export const progressRoute = new Hono<{ Variables: AppVariables }>()

function buildLayerQuery(db: Db, userId: string, layer: LayerMeta) {
  if (layer.table === 'lifeTimeline') {
    return db.select({ count: count() }).from(lifeTimeline)
      .where(and(eq(lifeTimeline.userId, userId), eq(lifeTimeline.source, 'interview')))
  }
  if (layer.table === 'professionalRecords') {
    return db.select({ count: count() }).from(professionalRecords)
      .where(eq(professionalRecords.userId, userId))
  }
  return db.select({ count: count() }).from(structuredFacts)
    .where(and(eq(structuredFacts.userId, userId), eq(structuredFacts.category, layer.category as StructuredFactCategory)))
}

function buildLayerDefinitions(db: Db, userId: string) {
  return LAYER_META.map(layer => ({
    id: layer.id,
    name: layer.name,
    zone: layer.zone,
    threshold: layer.threshold,
    query: () => buildLayerQuery(db, userId, layer),
  }))
}

progressRoute.get('/', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const LAYER_DEFINITIONS = buildLayerDefinitions(db, userId)
  try {
    const [layerResults, factsTotal, timelineTotal, professionalTotal, vignetteTotal] =
      await Promise.all([
        Promise.all(LAYER_DEFINITIONS.map(async (layer) => {
          const result = await layer.query()
          const itemCount = result[0]?.count ?? 0
          const percent = Math.min(itemCount / layer.threshold, 1.0) * 100
          return {
            id: layer.id,
            name: layer.name,
            zone: layer.zone,
            percent,
            count: itemCount,
            threshold: layer.threshold,
          }
        })),
        db.select({ count: count() }).from(structuredFacts).where(eq(structuredFacts.userId, userId)),
        db.select({ count: count() }).from(lifeTimeline).where(eq(lifeTimeline.userId, userId)),
        db.select({ count: count() }).from(professionalRecords).where(eq(professionalRecords.userId, userId)),
        db.select({ count: count() }).from(sessionVignettes).where(eq(sessionVignettes.userId, userId)),
      ])

    const overall = layerResults.reduce((sum, l) => sum + l.percent, 0) / layerResults.length

    return c.json({
      overall,
      layers: layerResults,
      totals: {
        facts: factsTotal[0]?.count ?? 0,
        timeline: timelineTotal[0]?.count ?? 0,
        professional: professionalTotal[0]?.count ?? 0,
        vignettes: vignetteTotal[0]?.count ?? 0,
      },
    })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to fetch progress' }, 500)
  }
})
