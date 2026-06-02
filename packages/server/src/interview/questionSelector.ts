import { eq, and, notInArray, count, sql, desc } from 'drizzle-orm'
import type { Db } from '../types.js'
import { questions, questionTranslations, userQuestions, structuredFacts } from '../db/schema.js'
import { LAYER_META } from '../export/layers.js'

// Thresholds for structuredFacts categories derived from LAYER_META,
// plus interview-only categories that have no dedicated L-layer.
export const CATEGORY_THRESHOLDS: Record<string, number> = {
  ...Object.fromEntries(
    LAYER_META
      .filter(l => l.table === 'structuredFacts')
      .map(l => [l.category, l.threshold])
  ),
  childhood: 3, life_events: 3, career: 4, education: 3, skills: 2,
}

export async function selectNextQuestion(db: Db, userId: string, language: string) {
  const answeredRows = await db
    .select({ questionId: userQuestions.questionId })
    .from(userQuestions)
    .where(eq(userQuestions.userId, userId))
  const answeredIds = answeredRows.map(r => r.questionId)

  const factCountRows = await db
    .select({ category: structuredFacts.category, cnt: count() })
    .from(structuredFacts)
    .where(eq(structuredFacts.userId, userId))
    .groupBy(structuredFacts.category)
  const factCounts: Record<string, number> = {}
  for (const row of factCountRows) factCounts[row.category] = row.cnt

  const whereClause = answeredIds.length > 0
    ? and(eq(questions.isActive, true), notInArray(questions.id, answeredIds))
    : eq(questions.isActive, true)

  const candidates = await db
    .select({
      id: questions.id,
      category: questions.category,
      priority: questions.priority,
      content: sql<string>`COALESCE(${questionTranslations.content}, ${questions.content})`,
    })
    .from(questions)
    .leftJoin(
      questionTranslations,
      and(
        eq(questionTranslations.questionId, questions.id),
        eq(questionTranslations.language, language),
      ),
    )
    .where(whereClause)

  if (candidates.length === 0) return null

  // 充足率（現在件数 / 閾値）が低いカテゴリの質問を優先し、同率なら priority 降順
  candidates.sort((a, b) => {
    const ratioA = (factCounts[a.category] ?? 0) / (CATEGORY_THRESHOLDS[a.category] ?? 3)
    const ratioB = (factCounts[b.category] ?? 0) / (CATEGORY_THRESHOLDS[b.category] ?? 3)
    if (ratioA !== ratioB) return ratioA - ratioB
    return b.priority - a.priority
  })

  return { id: candidates[0].id, content: candidates[0].content }
}

export async function getExistingFactsSummary(db: Db, userId: string, language = 'ja'): Promise<string> {
  const facts = await db
    .select()
    .from(structuredFacts)
    .where(eq(structuredFacts.userId, userId))
    .orderBy(desc(structuredFacts.createdAt))
    .limit(20)

  if (facts.length === 0) return language === 'en' ? 'none' : 'なし'
  return facts.map(f => `[${f.category}] ${f.fact}`).join('\n')
}
