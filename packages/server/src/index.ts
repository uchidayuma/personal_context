import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { sql } from 'drizzle-orm'
import { initDatabase, ensureDefaultUser, ensureAnonymousUser, getOrCreateUserFromClerk, cleanupDemoData, DEFAULT_USER_ID, db } from './db/client.js'
import { seedQuestions } from './db/seed.js'
import type { AppVariables } from './types.js'
import { sessionsRoute } from './routes/sessions.js'
import { chatRoute } from './routes/chat.js'
import { exportRoute } from './routes/export.js'
import { userRoute } from './routes/user.js'
import { transcribeRoute } from './routes/transcribe.js'
import { contextSummaryRoute } from './routes/contextSummary.js'
import { importRoute } from './routes/import.js'
import { progressRoute } from './routes/progress.js'
import { insightsRoute } from './routes/insights.js'
import { ttsRoute } from './routes/tts.js'

async function bootstrap() {
  await initDatabase()
  await ensureDefaultUser(db)
  await seedQuestions(db)

  // Graceful shutdown: close database connections
  const gracefulShutdown = async () => {
    console.log('[shutdown] Closing database connections...')
    try {
      // PostgreSQL: connections are managed by the pool, just exit cleanly
      process.exit(0)
    } catch (e) {
      console.error('[shutdown] Shutdown failed:', e)
      process.exit(1)
    }
  }
  process.on('SIGTERM', gracefulShutdown)
  process.on('SIGINT', gracefulShutdown)

  const app = new Hono<{ Variables: AppVariables }>()

  app.use(logger())
  app.use('/api/*', cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }))

  // Clerk authentication (optional - only if CLERK_SECRET_KEY is set)
  if (process.env.CLERK_SECRET_KEY) {
    app.use('/api/*', clerkMiddleware())
  }

  // User context extraction
  app.use('/api/*', async (c, next) => {
    c.set('db', db)

    const auth = getAuth(c)

    // Registered user (has Clerk session)
    if (auth?.userId) {
      const clerkUser = auth.sessionClaims
      const email = (clerkUser?.email as string) ?? null
      const name = (clerkUser?.name as string) ?? null

      const user = await getOrCreateUserFromClerk(db, auth.userId, email, name)
      c.set('userId', user.id)
      c.set('userType', user.userType)
    }
    // Anonymous user (X-User-Id header)
    else {
      const xUserId = c.req.header('X-User-Id')
      if (xUserId) {
        await ensureAnonymousUser(db, xUserId)
        c.set('userId', xUserId)
        c.set('userType', 'anonymous')
      } else {
        // Local development: use default user
        c.set('userId', DEFAULT_USER_ID)
        c.set('userType', 'free')
      }
    }

    await next()
  })

  app.route('/api/sessions', sessionsRoute)
  app.route('/api/chat', chatRoute)
  app.route('/api/export', exportRoute)
  app.route('/api/user', userRoute)
  app.route('/api/transcribe', transcribeRoute)
  app.route('/api/context-summary', contextSummaryRoute)
  app.route('/api/import', importRoute)
  app.route('/api/progress', progressRoute)
  app.route('/api/insights', insightsRoute)
  app.route('/api/tts', ttsRoute)

  // Cleanup job: run every 5 minutes to delete old anonymous users
  setInterval(() => cleanupDemoData(db), 5 * 60 * 1000)
  console.log('[cleanup] cleanup job started (interval: 5min)')

  if (process.env.NODE_ENV === 'production') {
    app.use('/*', serveStatic({ root: './public' }))
    app.get('*', serveStatic({ path: './public/index.html' }))
  }

  const PORT = Number(process.env.PORT ?? 3001)
  const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'
  serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
    console.log(`Server running on http://${HOST}:${PORT}`)
  })
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
