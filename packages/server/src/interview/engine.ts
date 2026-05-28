import { eq, and, notInArray, desc, asc, sql } from 'drizzle-orm'
import { db, DEFAULT_USER_ID, getUserLanguage } from '../db/client.js'
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
const MAX_FOLLOWUPS_PER_QUESTION = 2

async function selectNextQuestion(userId: string, language: string) {
  const answered = db
    .select({ questionId: userQuestions.questionId })
    .from(userQuestions)
    .where(eq(userQuestions.userId, userId))

  const coveredCategories = db
    .selectDistinct({ category: structuredFacts.category })
    .from(structuredFacts)
    .where(eq(structuredFacts.userId, userId))

  // 空カテゴリの質問を優先（1）、それ以外はpriority順
  const emptyFirst = sql<number>`CASE WHEN ${questions.category} NOT IN (${coveredCategories}) THEN 1 ELSE 0 END`

  // 翻訳があれば翻訳を、なければデフォルト(ja)の content を使う
  const [next] = await db
    .select({
      id: questions.id,
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
    .where(and(
      eq(questions.isActive, true),
      notInArray(questions.id, answered),
    ))
    .orderBy(desc(emptyFirst), desc(questions.priority))
    .limit(1)

  return next ?? null
}

async function getExistingFactsSummary(userId: string): Promise<string> {
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
2. If followup_count < ${MAX_ONBOARDING_FOLLOWUPS} AND gaps exist: ask ONE short, natural question about the most important gap (askedFollowup: true)
3. If followup_count >= ${MAX_ONBOARDING_FOLLOWUPS} OR all critical categories are covered: end warmly (shouldEndSession: true)
4. When ending: tell them this is a great start and that regular sessions will deepen the context over time
5. Respond in English. Your output must be a valid JSON object matching the provided schema.`
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
2. followup_count < ${MAX_ONBOARDING_FOLLOWUPS} かつ不足がある場合: 最も重要な不足に対して短く自然な質問を1つだけする（askedFollowup: true）
3. followup_count >= ${MAX_ONBOARDING_FOLLOWUPS} または全カテゴリがカバーされた場合: 温かく終了する（shouldEndSession: true）
4. 終了時: 骨格ができたこと、これからのセッションで深めていけることを伝える
5. 必ず日本語で返答してください。回答は必ず指定されたJSON形式で行い、日本語のメッセージは JSON の "response" フィールドに含めてください。`
}

function buildSystemPrompt(
  questionsAsked: number,
  followupCount: number,
  currentQuestion: string | null,
  existingFacts: string,
  language: string,
): string {
  if (language === 'en') {
    return `You are a warm, empathetic AI coach helping build a personal context database.

## Current Status
- Questions asked today: ${questionsAsked}/${MAX_QUESTIONS_PER_SESSION}
- Follow-ups for current topic: ${followupCount}/${MAX_FOLLOWUPS_PER_QUESTION}
- Current main question: ${currentQuestion ?? '(not set)'}

## What we know about the user
${existingFacts}

## Goal of follow-up
When the user gives an abstract statement ("it was hard", "I value X"), your goal is to reach the concrete scene behind it — a specific moment in time: what happened, what they chose, how it felt. Think of it as trying to gather enough for a Vignette (when / what happened / what they chose / what it revealed). How you get there is up to you — follow the natural flow of the conversation.

## Rules
1. Respond in English with warmth and empathy
2. If followup_count < ${MAX_FOLLOWUPS_PER_QUESTION}: ask ONE follow-up if a concrete scene hasn't emerged yet (askedFollowup: true)
3. If followup_count >= ${MAX_FOLLOWUPS_PER_QUESTION}: do not ask a follow-up (askedFollowup: false)
4. If questions_asked >= ${MAX_QUESTIONS_PER_SESSION}: close the session warmly (shouldEndSession: true)
5. If the user shows signs of wanting to stop: end the session (shouldEndSession: true)
6. When ending: express gratitude and anticipation for next time in the response
7. Your output must be a valid JSON object matching the provided schema.`
  }

  return `あなたは個人の人生コンテキストを構築するための温かいAIコーチです。

## 現在の状況
- 今日の質問数: ${questionsAsked}/${MAX_QUESTIONS_PER_SESSION}
- 現在のトピックへの深掘り回数: ${followupCount}/${MAX_FOLLOWUPS_PER_QUESTION}
- 現在のメイン質問: ${currentQuestion ?? '（未設定）'}

## ユーザーの既知のコンテキスト
${existingFacts}

## フォローアップの目的
ユーザーが抽象的な発言（「大変でした」「大切にしています」等）をしたとき、その裏にある具体的な場面まで辿り着くことがゴールです。「いつ・何が起きたか・何を選んだか・何を感じたか」が揃えば Vignette として記録できます。どう聞くかは会話の流れに任せてください。

## 行動ルール
1. 必ず日本語で、温かく共感的なトーンで返答してください。
2. followup_count < ${MAX_FOLLOWUPS_PER_QUESTION} の場合: 具体的な場面がまだ出ていなければフォローアップ質問をする（askedFollowup: true）
3. followup_count >= ${MAX_FOLLOWUPS_PER_QUESTION} の場合: フォローアップはしない（askedFollowup: false）
4. questions_asked >= ${MAX_QUESTIONS_PER_SESSION} の場合: セッションを温かく締める（shouldEndSession: true）
5. ユーザーが疲れた・やめたいサインを見せた場合: セッションを終了する（shouldEndSession: true）
6. shouldEndSession: true の場合は、感謝の言葉と次回への期待を伝える締めの言葉を response に入れる
7. 回答は必ず指定されたJSON形式で行い、日本語のメッセージは JSON の "response" フィールドに含めてください。`
}

export async function startOnboarding(userId = DEFAULT_USER_ID) {
  const language = await getUserLanguage(userId)
  const sessionId = crypto.randomUUID()
  await db.insert(sessions).values({ id: sessionId, userId, type: 'onboarding' })

  const opening = ONBOARDING_OPENING[language] ?? ONBOARDING_OPENING.ja
  await db.insert(rawLogs).values({
    id: crypto.randomUUID(), userId, sessionId, role: 'assistant', content: opening,
  })
  return { sessionId, message: opening }
}

export async function startSession(userId = DEFAULT_USER_ID) {
  const language = await getUserLanguage(userId)
  const question = await selectNextQuestion(userId, language)
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
  sessionId: string,
  userMessage: string,
  userId = DEFAULT_USER_ID,
) {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
  if (!session || session.status !== 'active') {
    throw new Error('Session not found or already ended')
  }

  const language = await getUserLanguage(userId)

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

  const { response, askedFollowup, shouldEndSession } = await generateInterviewResponse(
    systemPrompt,
    history
      .filter(log => log.role !== 'system')
      .map(log => ({ role: log.role as 'user' | 'assistant', content: log.content })),
  )

  await db.insert(rawLogs).values({
    id: crypto.randomUUID(),
    userId,
    sessionId,
    role: 'assistant',
    content: response,
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
      await extractAndSaveFacts(sessionId, userId, conversationText)
    } catch (err) {
      console.error('Failed to extract facts from conversation:', err)
    }
  } else if (!askedFollowup) {
    if (session.currentQuestionId) {
      await db.insert(userQuestions).values({ userId, questionId: session.currentQuestionId }).onConflictDoNothing()
    }
    const nextQuestion = await selectNextQuestion(userId, language)
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

  return { response, shouldEnd: shouldEndSession }
}

async function extractAndSaveFacts(sessionId: string, userId: string, conversation: string) {
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
      fact: fact.fact,
      confidenceScore: fact.confidence_score,
      visibility: fact.visibility,
    })
    for (const log of logIds) {
      await db.insert(factEvidences).values({ factId, logId: log.id }).onConflictDoNothing()
    }
  }

  for (const event of result.timeline) {
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
    })
  }
}
