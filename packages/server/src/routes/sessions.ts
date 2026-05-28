import { Hono } from 'hono'
import { startSession, startOnboarding } from '../interview/engine.js'
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
