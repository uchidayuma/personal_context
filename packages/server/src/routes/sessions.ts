import { Hono } from 'hono'

import { startSession, startOnboarding, endSession, skipQuestion, buildSessionSummary } from '../interview/engine.js'
import { checkDemoRateLimit } from '../db/client.js'
import type { AppVariables } from '../types.js'

export const sessionsRoute = new Hono<{ Variables: AppVariables }>()

sessionsRoute.post('/', async (c) => {
  if (process.env.DEMO_MODE === 'true') {
    const ip = c.req.header('X-Forwarded-For')?.split(',')[0].trim()
      ?? c.req.header('X-Real-IP')
      ?? 'unknown'
    const allowed = await checkDemoRateLimit(c.get('db'), ip)
    if (!allowed) return c.json({ error: '1日3セッションまでです。明日またお試しください。' }, 429)
  }
  try {
    const body: { language?: string } = await c.req.json<{ language?: string }>().catch(() => ({}))
    const { sessionId, message } = await startSession(c.get('db'), c.get('userId'), body.language)
    return c.json({ sessionId, message })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to start session' }, 500)
  }
})

sessionsRoute.post('/onboarding', async (c) => {
  try {
    const { sessionId, message } = await startOnboarding(c.get('db'), c.get('userId'))
    return c.json({ sessionId, message })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to start onboarding' }, 500)
  }
})


sessionsRoute.post('/:id/end', async (c) => {
  const sessionId = c.req.param('id')
  const db = c.get('db')
  try {
    await endSession(db, sessionId, c.get('userId'))
  } catch (err) {
    if (err instanceof Error && err.message.includes('Session not found')) {
      return c.json({ error: err.message }, 404)
    }
    // セッションが既に completed の場合（shouldEnd による自動終了済み）はサマリーだけ返す
    if (err instanceof Error && err.message.includes('already ended')) {
      try {
        const summary = await buildSessionSummary(db, sessionId)
        return c.json({ ok: true, summary })
      } catch {
        return c.json({ ok: true, summary: { facts: {}, timeline: 0, vignettes: [] } })
      }
    }
    console.error(err)
    return c.json({ error: 'Failed to end session' }, 500)
  }

  try {
    const summary = await buildSessionSummary(db, sessionId)
    return c.json({ ok: true, summary })
  } catch (err) {
    console.error(err)
    return c.json({ ok: true, summary: { facts: {}, timeline: 0, vignettes: [] } })
  }
})

sessionsRoute.post('/:id/skip', async (c) => {
  const sessionId = c.req.param('id')
  try {
    const { message, remainingTurns } = await skipQuestion(c.get('db'), sessionId, c.get('userId'))
    return c.json({ message, remainingTurns })
  } catch (err) {
    if (err instanceof Error && err.message.includes('Session not found')) {
      return c.json({ error: err.message }, 404)
    }
    console.error(err)
    return c.json({ error: 'Failed to skip question' }, 500)
  }
})
