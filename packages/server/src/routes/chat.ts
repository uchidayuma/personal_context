import { Hono } from 'hono'
import { processMessage } from '../interview/engine.js'
import { ModelStructuredOutputError } from '../llm/provider.js'
import type { AppVariables } from '../types.js'

export const chatRoute = new Hono<{ Variables: AppVariables }>()

chatRoute.post('/', async (c) => {
  const body = await c.req.json<{ sessionId: string; message: string }>()

  if (!body.sessionId || !body.message?.trim()) {
    return c.json({ error: 'sessionId and message are required' }, 400)
  }

  try {
    const { response, shouldEnd, remainingTurns } = await processMessage(
      c.get('db'),
      body.sessionId,
      c.get('userId'),
      body.message.trim(),
    )
    return c.json({ response, shouldEnd, remainingTurns })
  } catch (err) {
    console.error('[chat] error:', err)
    if (err instanceof ModelStructuredOutputError) {
      return c.json({ error: err.message, code: err.code }, 422)
    }
    return c.json({ error: 'Failed to process message' }, 500)
  }
})
