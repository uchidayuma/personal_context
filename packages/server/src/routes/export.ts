import { Hono } from 'hono'
import { exportToMarkdown } from '../export/markdown.js'
import type { AppVariables } from '../types.js'

export const exportRoute = new Hono<{ Variables: AppVariables }>()

exportRoute.get('/', async (c) => {
  const includePrivate = c.req.query('visibility') === 'all'

  try {
    const files = await exportToMarkdown(c.get('db'), c.get('userId'), includePrivate)
    return c.json({ files })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to export' }, 500)
  }
})
