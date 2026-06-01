import { eq, and, notInArray, inArray, desc, asc, sql, count } from 'drizzle-orm'
import { DEFAULT_USER_ID, getUserLanguage } from '../db/client.js'
import type { Db } from '../types.js'
import {
  sessions, users, rawLogs, questions, questionTranslations,
  userQuestions, structuredFacts, lifeTimeline,
  factEvidences, timelineEvidences, sessionVignettes,
} from '../db/schema.js'
import {
  generateInterviewResponse,
  transformToCoachingTone,
  extractFactsFromConversation,
} from '../llm/provider.js'

const MAX_QUESTIONS_PER_SESSION = 3
const MAX_FOLLOWUPS_PER_QUESTION = 1

// L1〜L10 各カテゴリの充足閾値（progress.ts と揃える）
const CATEGORY_THRESHOLDS: Record<string, number> = {
  values: 5, character: 3, relationships: 5, opinions: 5,
  fears: 3, patterns: 3, goals: 3, preferences: 3,
  childhood: 3, life_events: 3, career: 4, education: 3, skills: 2,
}

async function selectNextQuestion(db: Db, userId: string, language: string) {
  // 回答済み質問ID
  const answeredRows = await db
    .select({ questionId: userQuestions.questionId })
    .from(userQuestions)
    .where(eq(userQuestions.userId, userId))
  const answeredIds = answeredRows.map(r => r.questionId)

  // カテゴリ別の現在件数
  const factCountRows = await db
    .select({ category: structuredFacts.category, cnt: count() })
    .from(structuredFacts)
    .where(eq(structuredFacts.userId, userId))
    .groupBy(structuredFacts.category)
  const factCounts: Record<string, number> = {}
  for (const row of factCountRows) factCounts[row.category] = row.cnt

  // 候補質問を全取得（翻訳あれば翻訳を使用）
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

async function getExistingFactsSummary(db: Db, userId: string): Promise<string> {
  const facts = await db
    .select()
    .from(structuredFacts)
    .where(eq(structuredFacts.userId, userId))
    .orderBy(desc(structuredFacts.createdAt))
    .limit(20)

  if (facts.length === 0) return 'none / なし'
  return facts.map(f => `[${f.category}] ${f.fact}`).join('\n')
}

const MAX_ONBOARDING_FOLLOWUPS = 3

const ONBOARDING_OPENING: Record<string, string> = {
  ja: 'あなたの人生で転機になったできごとを教えてください。複数あれば全部話してください。',
  en: 'Please tell me about the turning points in your life. Share as many as you\'d like.',
}

function buildOnboardingSystemPrompt(followupCount: number, language: string): string {
  if (language === 'en') {
    return `You are conducting a one-time onboarding interview to build a personal context skeleton.

## Your job
Analyze the conversation so far and identify which categories are still uncovered:
- life_timeline: at least 2–3 events with rough dates mentioned?
- career: current or most recent role mentioned?
- education: any educational background mentioned?
- turning_point_scene: at least one moment with emotional texture (how they felt)?
- current_chapter: what are they focused on right now?

## Rules
1. NEVER ask about something the user already mentioned
2. Ask EXACTLY ONE question per response — never combine multiple questions
3. If followup_count < ${MAX_ONBOARDING_FOLLOWUPS} AND gaps exist: ask ONE short question about the most important gap (askedFollowup: true)
4. If followup_count >= ${MAX_ONBOARDING_FOLLOWUPS} OR all critical categories are covered: end briefly (shouldEndSession: true)
5. When ending: one short sentence only.
6. Respond in English. Your output must be a valid JSON object matching the provided schema.`
  }

  return `あなたは初回オンボーディングインタビューを担当するAIコーチです。

## あなたの仕事
会話全体を分析し、まだカバーされていないカテゴリを特定してください：
- life_timeline: 大まかな時期のある出来事が2〜3個以上言及されているか？
- career: 現在または直近の仕事・活動が言及されているか？
- education: 学歴・学んだことが言及されているか？
- turning_point_scene: 感情的な手触りのある場面（そのとき何を感じたか）が1つ以上あるか？
- current_chapter: 今、何に取り組んでいるか・考えているかが分かるか？

## 行動ルール
1. ユーザーがすでに話した内容について絶対に再度聞かない
2. **1つの返答の中で質問は必ず1つだけ**。複数聞きたくても最重要の1つだけ選ぶ
3. followup_count < ${MAX_ONBOARDING_FOLLOWUPS} かつ不足がある場合: 最も重要な不足に対して短い質問を1つだけする（askedFollowup: true）
4. followup_count >= ${MAX_ONBOARDING_FOLLOWUPS} または全カテゴリがカバーされた場合: 短く終了する（shouldEndSession: true）
5. 終了時: 1文だけ。長い締めの言葉は不要。
6. 必ず日本語で返答してください。回答は必ず指定されたJSON形式で行い、日本語のメッセージは JSON の "response" フィールドに含めてください。`
}

function buildSystemPrompt(
  questionsAsked: number,
  followupCount: number,
  currentQuestion: string | null,
  existingFacts: string,
  language: string,
): string {
  if (language === 'en') {
    return `You are a concise AI coach helping build a personal context database.

## Current Status
- Questions asked today: ${questionsAsked}/${MAX_QUESTIONS_PER_SESSION}
- Follow-ups for current topic: ${followupCount}/${MAX_FOLLOWUPS_PER_QUESTION}
- Current main question: ${currentQuestion ?? '(not set)'}

## What we know about the user
${existingFacts}

## Goal of follow-up
This is a context-building tool, not a therapy session. When the user's answer is vague, ask ONE short clarifying question to record a specific data point (a role, a year, a concrete action). Once you have something recordable, move on — do not explore motivations or feelings further.

## Rules
1. Respond in English. Keep your response SHORT — one brief acknowledgment sentence, then move on.
2. NEVER ask more than ONE question per response. If you want to ask multiple things, pick the single most important one.
3. Keep empathy brief — one short sentence max. Do not over-validate.
4. If followup_count < ${MAX_FOLLOWUPS_PER_QUESTION}: ask ONE follow-up to get a concrete detail (askedFollowup: true)
5. If followup_count >= ${MAX_FOLLOWUPS_PER_QUESTION}: do not ask a follow-up (askedFollowup: false)
6. If questions_asked >= ${MAX_QUESTIONS_PER_SESSION}: close the session warmly (shouldEndSession: true)
7. If the user shows signs of wanting to stop: end the session (shouldEndSession: true)
8. When ending: one short sentence of thanks, then done.
9. Your output must be a valid JSON object matching the provided schema.`
  }

  return `あなたは個人の人生コンテキストを構築するための簡潔なAIコーチです。

## 現在の状況
- 今日の質問数: ${questionsAsked}/${MAX_QUESTIONS_PER_SESSION}
- 現在のトピックへの深掘り回数: ${followupCount}/${MAX_FOLLOWUPS_PER_QUESTION}
- 現在のメイン質問: ${currentQuestion ?? '（未設定）'}

## ユーザーの既知のコンテキスト
${existingFacts}

## フォローアップの目的
これはセラピーではなくコンテキスト収集ツールです。ユーザーの答えが曖昧な場合、記録できる具体的なデータ（役職・時期・具体的な行動など）を1つ引き出す短い質問をする。記録できるものが取れたら、動機や感情の深掘りは一切せず次に進む。

## 行動ルール
1. 必ず日本語で返答してください。返答は**短く**——共感1文＋次のアクション。
2. **1つの返答の中で質問は必ず1つだけ**。複数聞きたいことがあっても、最も重要な1つだけ選ぶ。
3. 共感の前置きは1文以内で短く。長い賞賛や「その言葉に〜がにじみ出ています」のような過剰な共感は不要。
4. followup_count < ${MAX_FOLLOWUPS_PER_QUESTION} の場合: 具体的なディテールを1つ引き出すフォローアップ質問を1つする（askedFollowup: true）
5. followup_count >= ${MAX_FOLLOWUPS_PER_QUESTION} の場合: フォローアップはしない（askedFollowup: false）
6. questions_asked >= ${MAX_QUESTIONS_PER_SESSION} の場合: セッションを短く締める（shouldEndSession: true）
7. ユーザーが疲れた・やめたいサインを見せた場合: セッションを終了する（shouldEndSession: true）
8. shouldEndSession: true の場合: 感謝を1文だけ伝えて終わる。長い締めの言葉は不要。
9. 回答は必ず指定されたJSON形式で行い、日本語のメッセージは JSON の "response" フィールドに含めてください。`
}

export async function startOnboarding(db: Db, userId = DEFAULT_USER_ID) {
  const language = await getUserLanguage(db, userId)
  const sessionId = crypto.randomUUID()
  await db.insert(sessions).values({ id: sessionId, userId, type: 'onboarding' })

  const opening = ONBOARDING_OPENING[language] ?? ONBOARDING_OPENING.ja
  await db.insert(rawLogs).values({
    id: crypto.randomUUID(), userId, sessionId, role: 'assistant', content: opening,
  })
  return { sessionId, message: opening }
}

export async function startSession(db: Db, userId = DEFAULT_USER_ID) {
  const language = await getUserLanguage(db, userId)
  const question = await selectNextQuestion(db, userId, language)
  const existingFacts = await (async () => {
    const facts = await db
      .select()
      .from(structuredFacts)
      .where(eq(structuredFacts.userId, userId))
      .orderBy(desc(structuredFacts.createdAt))
      .limit(20)
    if (facts.length === 0) return language === 'en' ? 'none' : 'なし'
    return facts.map(f => `[${f.category}] ${f.fact}`).join('\n')
  })()

  const sessionId = crypto.randomUUID()
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    currentQuestionId: question?.id ?? null,
  })

  const fallbackMessage = language === 'en'
    ? "Hello! Let's start building your personal context together. What are you putting the most energy into right now?"
    : 'こんにちは！今日から一緒にあなたの人生コンテキストを作っていきましょう。今、どんなことに一番力を入れていますか？'

  const initialMessage = question
    ? await transformToCoachingTone(question.content, existingFacts, language)
    : fallbackMessage

  await db.insert(rawLogs).values({
    id: crypto.randomUUID(),
    userId,
    sessionId,
    role: 'assistant',
    content: initialMessage,
  })

  return { sessionId, message: initialMessage }
}

export async function processMessage(
  db: Db,
  sessionId: string,
  userId = DEFAULT_USER_ID,
  userMessage: string,
  languageOverride?: string,
) {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
  if (!session || session.status !== 'active') {
    throw new Error('Session not found or already ended')
  }

  const language = languageOverride ?? await getUserLanguage(db, userId)

  await db.insert(rawLogs).values({
    id: crypto.randomUUID(),
    userId,
    sessionId,
    role: 'user',
    content: userMessage,
  })

  const history = await db
    .select()
    .from(rawLogs)
    .where(eq(rawLogs.sessionId, sessionId))
    .orderBy(asc(rawLogs.createdAt))

  let currentQuestionText: string | null = null
  if (session.currentQuestionId) {
    const [row] = await db
      .select({
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
      .where(eq(questions.id, session.currentQuestionId))
    currentQuestionText = row?.content ?? null
  }

  const existingFacts = await (async () => {
    const facts = await db
      .select()
      .from(structuredFacts)
      .where(eq(structuredFacts.userId, userId))
      .orderBy(desc(structuredFacts.createdAt))
      .limit(20)
    if (facts.length === 0) return language === 'en' ? 'none' : 'なし'
    return facts.map(f => `[${f.category}] ${f.fact}`).join('\n')
  })()

  const systemPrompt = session.type === 'onboarding'
    ? buildOnboardingSystemPrompt(session.followupCount, language)
    : buildSystemPrompt(
        session.questionsAsked,
        session.followupCount,
        currentQuestionText,
        existingFacts,
        language,
      )

  const { response, askedFollowup: rawAskedFollowup, shouldEndSession } = await generateInterviewResponse(
    systemPrompt,
    history
      .filter(log => log.role !== 'system')
      .map(log => ({ role: log.role as 'user' | 'assistant', content: log.content })),
  )

  // Server-side enforcement: ignore AI's askedFollowup when the limit is already reached
  const askedFollowup =
    session.type !== 'onboarding' && session.followupCount >= MAX_FOLLOWUPS_PER_QUESTION
      ? false
      : rawAskedFollowup

  // When moving to the next question, append it to the response so the user
  // sees the actual question rather than just a transition phrase.
  let finalResponse = response
  let nextQuestion: { id: string; content: string } | null = null

  if (!shouldEndSession && !askedFollowup) {
    nextQuestion = await selectNextQuestion(db, userId, language)
    if (nextQuestion) {
      const nextMsg = await transformToCoachingTone(nextQuestion.content, existingFacts, language)
      finalResponse = response + '\n\n' + nextMsg
    }
  }

  await db.insert(rawLogs).values({
    id: crypto.randomUUID(),
    userId,
    sessionId,
    role: 'assistant',
    content: finalResponse,
  })

  if (shouldEndSession) {
    await db.transaction(async (tx) => {
      await tx.update(sessions)
        .set({ status: 'completed', endedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(sessions.id, sessionId))

      if (session.type === 'onboarding') {
        await tx.update(users)
          .set({ onboardingCompletedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(users.id, userId))
      }

      if (session.currentQuestionId) {
        await tx.insert(userQuestions).values({ userId, questionId: session.currentQuestionId }).onConflictDoNothing()
      }
    })

    const conversationText = history.map(l => `[${l.role}]: ${l.content}`).join('\n\n')
    try {
      await extractAndSaveFacts(db, sessionId, userId, conversationText)
    } catch (err) {
      console.error('Failed to extract facts from conversation:', err)
    }

    const summary = await buildSessionSummary(db, sessionId).catch(() => ({ facts: {}, timeline: 0, vignettes: [] as string[] }))
    const remainingTurns = session.type === 'onboarding' ? null : MAX_QUESTIONS_PER_SESSION - session.questionsAsked
    return { response: finalResponse, shouldEnd: true, remainingTurns, summary }
  } else if (!askedFollowup) {
    if (session.currentQuestionId) {
      await db.insert(userQuestions).values({ userId, questionId: session.currentQuestionId }).onConflictDoNothing()
    }
    await db.update(sessions)
      .set({
        questionsAsked: session.questionsAsked + 1,
        followupCount: 0,
        currentQuestionId: nextQuestion?.id ?? null,
      })
      .where(eq(sessions.id, sessionId))
  } else {
    await db.update(sessions)
      .set({ followupCount: session.followupCount + 1 })
      .where(eq(sessions.id, sessionId))
  }

  const remainingTurns = session.type === 'onboarding'
    ? null
    : MAX_QUESTIONS_PER_SESSION - session.questionsAsked

  return { response: finalResponse, shouldEnd: shouldEndSession, remainingTurns }
}

export async function endSession(db: Db, sessionId: string, userId = DEFAULT_USER_ID) {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
  if (!session || session.status !== 'active') {
    throw new Error('Session not found or already ended')
  }

  await db.transaction(async (tx) => {
    await tx.update(sessions)
      .set({ status: 'completed', endedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(sessions.id, sessionId))

    if (session.type === 'onboarding') {
      await tx.update(users)
        .set({ onboardingCompletedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(users.id, userId))
    }

    if (session.currentQuestionId) {
      await tx.insert(userQuestions)
        .values({ userId, questionId: session.currentQuestionId })
        .onConflictDoNothing()
    }
  })

  const history = await db
    .select()
    .from(rawLogs)
    .where(eq(rawLogs.sessionId, sessionId))
    .orderBy(asc(rawLogs.createdAt))

  const conversationText = history.map(l => `[${l.role}]: ${l.content}`).join('\n\n')
  try {
    await extractAndSaveFacts(db, sessionId, userId, conversationText)
  } catch (err) {
    console.error('Failed to extract facts from conversation:', err)
  }
}

export async function skipQuestion(db: Db, sessionId: string, userId = DEFAULT_USER_ID) {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
  if (!session || session.status !== 'active') {
    throw new Error('Session not found or already ended')
  }

  const language = await getUserLanguage(db, userId)

  if (session.currentQuestionId) {
    await db.insert(userQuestions)
      .values({ userId, questionId: session.currentQuestionId })
      .onConflictDoNothing()
  }

  const nextQuestion = await selectNextQuestion(db, userId, language)
  const newQuestionsAsked = session.questionsAsked + 1

  await db.update(sessions)
    .set({ questionsAsked: newQuestionsAsked, followupCount: 0, currentQuestionId: nextQuestion?.id ?? null })
    .where(eq(sessions.id, sessionId))

  const existingFacts = await getExistingFactsSummary(db, userId)
  const fallbackMessage = language === 'en'
    ? "Let's move on to a new topic. What experience from your work or life are you most proud of?"
    : '次のトピックに移りましょう。これまでの経験の中で、一番誇りに思っていることを教えてください。'

  const message = nextQuestion
    ? await transformToCoachingTone(nextQuestion.content, existingFacts, language)
    : fallbackMessage

  await db.insert(rawLogs).values({
    id: crypto.randomUUID(), userId, sessionId, role: 'assistant', content: message,
  })

  const remainingTurns = session.type === 'onboarding'
    ? null
    : MAX_QUESTIONS_PER_SESSION - newQuestionsAsked

  return { message, remainingTurns }
}

async function extractAndSaveFacts(db: Db, sessionId: string, userId: string, conversation: string) {
  const result = await extractFactsFromConversation(conversation)

  const logIds = await db
    .select({ id: rawLogs.id })
    .from(rawLogs)
    .where(eq(rawLogs.sessionId, sessionId))

  for (const fact of result.facts) {
    const factId = crypto.randomUUID()
    await db.insert(structuredFacts).values({
      id: factId, userId,
      category: fact.category,
      subcategory: fact.subcategory ?? null,
      fact: fact.fact,
      confidenceScore: fact.confidence_score,
      visibility: fact.visibility,
    })
    for (const log of logIds) {
      await db.insert(factEvidences).values({ factId, logId: log.id }).onConflictDoNothing()
    }
  }

  for (const event of result.timeline) {
    if (event.event_year === null) continue
    const timelineId = crypto.randomUUID()
    await db.insert(lifeTimeline).values({
      id: timelineId, userId,
      eventYear: event.event_year,
      eventMonth: event.event_month ?? undefined,
      ageAtEvent: event.age_at_event ?? undefined,
      eventDescription: event.event_description,
      visibility: event.visibility,
    })
    for (const log of logIds) {
      await db.insert(timelineEvidences).values({ timelineId, logId: log.id }).onConflictDoNothing()
    }
  }

  for (const vignette of result.vignettes) {
    await db.insert(sessionVignettes).values({
      id: crypto.randomUUID(),
      userId,
      sessionId,
      title: vignette.title,
      period: vignette.period,
      quote: vignette.quote,
      scene: vignette.scene,
      insight: vignette.insight,
      selfGap: vignette.self_gap ?? undefined,
      visibility: 'public',
    })
  }
}
