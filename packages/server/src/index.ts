import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sql } from 'drizzle-orm'
import { initDatabase, ensureDefaultUser, ensureDemoUser, cleanupDemoData, clearSimulateData, DEFAULT_USER_ID, db, simulateDb } from './db/client.js'
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
  await ensureDefaultUser(simulateDb)
  await seedQuestions(db)
  await seedQuestions(simulateDb)

  // Graceful shutdown: flush WAL on SIGTERM/SIGINT
  const gracefulShutdown = async () => {
    console.log('[shutdown] Flushing database...')
    try {
      await db.$client.execute('PRAGMA wal_checkpoint(TRUNCATE);')
      await simulateDb.$client.execute('PRAGMA wal_checkpoint(TRUNCATE);')
    } catch (e) {
      console.error('[shutdown] WAL flush failed:', e)
      process.exit(1)
    }
    process.exit(0)
  }
  process.on('SIGTERM', gracefulShutdown)
  process.on('SIGINT', gracefulShutdown)

  const app = new Hono<{ Variables: AppVariables }>()

  app.use(logger())
  app.use('/api/*', cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }))

  app.use('/api/*', async (c, next) => {
    const isSimulate = c.req.header('X-Simulate') === 'true'
    const targetDb = isSimulate ? simulateDb : db
    c.set('db', targetDb)
    const isDemo = process.env.DEMO_MODE === 'true'
    const xUserId = c.req.header('X-User-Id')
    const userId = isDemo && xUserId ? xUserId : DEFAULT_USER_ID
    if (isDemo && xUserId) await ensureDemoUser(targetDb, userId)
    c.set('userId', userId)
    await next()
  })

  app.delete('/api/simulate', async (c) => {
    await clearSimulateData()
    return c.json({ ok: true })
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

  if (process.env.DEMO_MODE === 'true') {
    setInterval(() => cleanupDemoData(db), 60 * 60 * 1000)
    console.log('[demo] cleanup job started (interval: 1h)')
  }

  if (process.env.NODE_ENV === 'production') {
    app.use('/*', serveStatic({ root: './public' }))
    app.get('*', serveStatic({ path: './public/index.html' }))
  }

  const PORT = Number(process.env.PORT ?? 3001)
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
