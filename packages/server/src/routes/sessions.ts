import { Hono } from 'hono'
import { startSession, startOnboarding } from '../interview/engine.js'
import { DEFAULT_USER_ID } from '../db/client.js'

export const sessionsRoute = new Hono()

sessionsRoute.post('/', async (c) => {
  try {
    const { sessionId, message } = await startSession(DEFAULT_USER_ID)
    return c.json({ sessionId, message })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to start session' }, 500)
  }
})

sessionsRoute.post('/onboarding', async (c) => {
  try {
    const { sessionId, message } = await startOnboarding(DEFAULT_USER_ID)
    return c.json({ sessionId, message })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to start onboarding' }, 500)
  }
})
