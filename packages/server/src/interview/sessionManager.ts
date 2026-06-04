import { eq, sql, asc } from 'drizzle-orm'
import { DEFAULT_USER_ID, getUserLanguage } from '../db/client.js'
import type { Db } from '../types.js'
import { sessions, users, rawLogs, userQuestions } from '../db/schema.js'
import { transformToCoachingTone } from '../llm/provider.js'
import { selectNextQuestion, getExistingFactsSummary } from './questionSelector.js'
import { extractAndSaveFacts } from './factExtractor.js'
import { MAX_QUESTIONS_PER_SESSION, ONBOARDING_OPENING } from './prompts.js'

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

export async function startSession(db: Db, userId = DEFAULT_USER_ID, languageOverride?: string) {
  const language = languageOverride ?? await getUserLanguage(db, userId)
  const question = await selectNextQuestion(db, userId, language)
  const existingFacts = await getExistingFactsSummary(db, userId, language)

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

export async function endSession(db: Db, sessionId: string, userId = DEFAULT_USER_ID) {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
  if (!session || session.status !== 'active' || session.userId !== userId) {
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
    const language = await getUserLanguage(db, userId)
    await extractAndSaveFacts(db, sessionId, userId, conversationText, language)
  } catch (err) {
    console.error('Failed to extract facts from conversation:', err)
  }
}

export async function skipQuestion(db: Db, sessionId: string, userId = DEFAULT_USER_ID) {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
  if (!session || session.status !== 'active' || session.userId !== userId) {
    throw new Error('Session not found or already ended')
  }

  const language = await getUserLanguage(db, userId)

  if (session.currentQuestionId) {
    await db.insert(userQuestions)
      .values({ userId, questionId: session.currentQuestionId, skippedAt: sql`CURRENT_TIMESTAMP` })
      .onConflictDoUpdate({
        target: [userQuestions.userId, userQuestions.questionId],
        set: { skippedAt: sql`CURRENT_TIMESTAMP` }
      })
  }

  const nextQuestion = await selectNextQuestion(db, userId, language)
  const newQuestionsAsked = session.questionsAsked + 1

  await db.update(sessions)
    .set({ questionsAsked: newQuestionsAsked, followupCount: 0, currentQuestionId: nextQuestion?.id ?? null })
    .where(eq(sessions.id, sessionId))

  const existingFacts = await getExistingFactsSummary(db, userId, language)
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
