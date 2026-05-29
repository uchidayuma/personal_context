import { Hono } from 'hono'
import { startSession, startOnboarding, endSession, skipQuestion } from '../interview/engine.js'
import type { AppVariables } from '../types.js'

export const sessionsRoute = new Hono<{ Variables: AppVariables }>()

sessionsRoute.post('/', async (c) => {
  try {
    const { sessionId, message } = await startSession(c.get('db'), c.get('userId'))
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
  try {
    await endSession(c.get('db'), sessionId, c.get('userId'))
    return c.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message.includes('Session not found')) {
      return c.json({ error: err.message }, 404)
    }
    console.error(err)
    return c.json({ error: 'Failed to end session' }, 500)
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
