import { Hono } from 'hono'
import { DEFAULT_USER_ID, getUser, updateUserLanguage } from '../db/client.js'

export const userRoute = new Hono()

userRoute.get('/', async (c) => {
  const user = await getUser(DEFAULT_USER_ID)
  console.log('[DEBUG /api/user]', JSON.stringify(user))
  return c.json(user)
})

userRoute.patch('/', async (c) => {
  const body = await c.req.json<{ language?: string }>()
  if (body.language) {
    await updateUserLanguage(DEFAULT_USER_ID, body.language)
  }
  return c.json({ ok: true })
})
