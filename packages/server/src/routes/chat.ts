import { Hono } from 'hono'
import { processMessage } from '../interview/engine.js'
import { DEFAULT_USER_ID } from '../db/client.js'

export const chatRoute = new Hono()

chatRoute.post('/', async (c) => {
  const body = await c.req.json<{ sessionId: string; message: string }>()

  if (!body.sessionId || !body.message?.trim()) {
    return c.json({ error: 'sessionId and message are required' }, 400)
  }

  try {
    const { response, shouldEnd } = await processMessage(
      body.sessionId,
      body.message.trim(),
      DEFAULT_USER_ID,
    )
    return c.json({ response, shouldEnd })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to process message' }, 500)
  }
})
