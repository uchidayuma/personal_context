import { Hono } from 'hono'
import { exportToMarkdown } from '../export/markdown.js'
import { DEFAULT_USER_ID } from '../db/client.js'

export const exportRoute = new Hono()

exportRoute.get('/', async (c) => {
  const includePrivate = c.req.query('visibility') === 'all'

  try {
    const files = await exportToMarkdown(DEFAULT_USER_ID, includePrivate)
    return c.json({ files })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to export' }, 500)
  }
})
