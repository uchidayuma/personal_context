import { Hono } from 'hono'
import { exportToMarkdown } from '../export/markdown.js'
import type { AppVariables } from '../types.js'

export const exportRoute = new Hono<{ Variables: AppVariables }>()

exportRoute.get('/', async (c) => {
  try {
    const { files, layers } = await exportToMarkdown(c.get('db'), c.get('userId'))
    return c.json({ files, layers })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to export' }, 500)
  }
})
