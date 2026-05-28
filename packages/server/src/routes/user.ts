import { Hono } from 'hono'
import { getUser, updateUserLanguage } from '../db/client.js'
import type { AppVariables } from '../types.js'

export const userRoute = new Hono<{ Variables: AppVariables }>()

userRoute.get('/', async (c) => {
  const user = await getUser(c.get('db'), c.get('userId'))
  console.log('[DEBUG /api/user]', JSON.stringify(user))
  return c.json(user)
})

userRoute.patch('/', async (c) => {
  const body = await c.req.json<{ language?: string }>()
  if (body.language) {
    await updateUserLanguage(c.get('db'), c.get('userId'), body.language)
  }
  return c.json({ ok: true })
})
