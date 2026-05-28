import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { initDatabase, ensureDefaultUser } from './db/client.js'
import { seedQuestions } from './db/seed.js'
import { sessionsRoute } from './routes/sessions.js'
import { chatRoute } from './routes/chat.js'
import { exportRoute } from './routes/export.js'
import { userRoute } from './routes/user.js'
import { transcribeRoute } from './routes/transcribe.js'
import { contextSummaryRoute } from './routes/contextSummary.js'
import { importRoute } from './routes/import.js'
import { progressRoute } from './routes/progress.js'
import { insightsRoute } from './routes/insights.js'

async function bootstrap() {
  await initDatabase()
  await ensureDefaultUser()
  await seedQuestions()

  const app = new Hono()

  app.use(logger())
  app.use('/api/*', cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  }))

  app.route('/api/sessions', sessionsRoute)
  app.route('/api/chat', chatRoute)
  app.route('/api/export', exportRoute)
  app.route('/api/user', userRoute)
  app.route('/api/transcribe', transcribeRoute)
  app.route('/api/context-summary', contextSummaryRoute)
  app.route('/api/import', importRoute)
  app.route('/api/progress', progressRoute)
  app.route('/api/insights', insightsRoute)

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
