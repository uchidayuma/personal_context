import { Hono } from 'hono'
import { count, and, eq, inArray } from 'drizzle-orm'
import { db, DEFAULT_USER_ID } from '../db/client.js'
import * as schema from '../db/schema.js'

const { structuredFacts, lifeTimeline, professionalRecords, sessionVignettes } = schema

export const progressRoute = new Hono()

const userId = DEFAULT_USER_ID

const LAYER_DEFINITIONS = [
  {
    id: 'L1',
    name: '価値観・信念',
    zone: 'CORE' as const,
    threshold: 5,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['values']),
      )),
  },
  {
    id: 'L2',
    name: '気質・性格',
    zone: 'CORE' as const,
    threshold: 3,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['character']),
      )),
  },
  {
    id: 'L3',
    name: '人生年表',
    zone: 'SHAPE' as const,
    // TODO: threshold:10 は職務経歴書インポートだけで超えてしまう。
    // 人生年表は幼少期〜現在まで網羅するものなのでthreshold引き上げ or source別カウントを検討。
    // 参照: TODO.md「L3 人生年表バーが職務経歴書だけで満杯になる問題」
    threshold: 10,
    query: () => db.select({ count: count() }).from(lifeTimeline)
      .where(eq(lifeTimeline.userId, userId)),
  },
  {
    id: 'L4',
    name: '職務詳細',
    zone: 'SHAPE' as const,
    threshold: 3,
    query: () => db.select({ count: count() }).from(professionalRecords)
      .where(eq(professionalRecords.userId, userId)),
  },
  {
    id: 'L5',
    name: '関係性',
    zone: 'SHAPE' as const,
    threshold: 5,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['relationships']),
      )),
  },
  {
    id: 'L6',
    name: '意見・スタンス',
    zone: 'SHAPE' as const,
    threshold: 5,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['opinions']),
      )),
  },
  {
    id: 'L7',
    name: '恐れ・回避',
    zone: 'SHAPE' as const,
    threshold: 3,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['fears']),
      )),
  },
  {
    id: 'L8',
    name: '繰り返す癖',
    zone: 'SHAPE' as const,
    threshold: 3,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['patterns']),
      )),
  },
  {
    id: 'L9',
    name: '目標・方向感',
    zone: 'STATE' as const,
    threshold: 3,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['goals']),
      )),
  },
  {
    id: 'L10',
    name: '好み・スタイル',
    zone: 'STATE' as const,
    threshold: 3,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['preferences']),
      )),
  },
]

progressRoute.get('/', async (c) => {
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
