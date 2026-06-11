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

  // Get categories skipped in the last 24 hours
  const recentlySkippedRows = await db
    .select({ questionId: userQuestions.questionId })
    .from(userQuestions)
    .where(
      and(
        eq(userQuestions.userId, userId),
        sql`${userQuestions.skippedAt} IS NOT NULL`,
        sql`${userQuestions.skippedAt} > NOW() - INTERVAL '1 day'`,
      )
    )
  const recentlySkippedIds = recentlySkippedRows.map(r => r.questionId)

  // Get categories from recently skipped questions
  const skippedCategories = new Set<string>()
  if (recentlySkippedIds.length > 0) {
    const skippedQuestions = await db
      .select({ category: questions.category })
      .from(questions)
      .where(sql`${questions.id} IN (${sql.join(recentlySkippedIds.map(id => sql`${id}`), sql`, `)})`)
    skippedQuestions.forEach(q => skippedCategories.add(q.category))
  }

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

  let candidates = await db
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

  // Filter out questions from recently skipped categories
  if (skippedCategories.size > 0) {
    const beforeFilter = candidates.length
    candidates = candidates.filter(q => !skippedCategories.has(q.category))
    // If filtering removed all candidates, fall back to the original list
    if (candidates.length === 0) {
      candidates = await db
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
    }
  }

  if (candidates.length === 0) return null

  // 充足率（現在件数 / 閾値）が低いカテゴリの質問を優先し、同率なら priority 降順
  candidates.sort((a, b) => {
    const ratioA = (factCounts[a.category] ?? 0) / (CATEGORY_THRESHOLDS[a.category] ?? 3)
    const ratioB = (factCounts[b.category] ?? 0) / (CATEGORY_THRESHOLDS[b.category] ?? 3)
    if (ratioA !== ratioB) return ratioA - ratioB
    return b.priority - a.priority
  })

  // Add variety: pick randomly from top 3 candidates instead of always choosing #1
  // For deterministic testing, set DETERMINISTIC_QUESTION=true to always pick first
  const topN = Math.min(3, candidates.length)
  const randomIndex = process.env.DETERMINISTIC_QUESTION === 'true'
    ? 0
    : Math.floor(Math.random() * topN)
  return { id: candidates[randomIndex].id, content: candidates[randomIndex].content }
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
