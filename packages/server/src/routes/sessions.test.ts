import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sessionsRoute } from './sessions.js'
import { createMockDb, createTestApp, req } from '../test/helpers.js'

vi.mock('../interview/engine.js', () => ({
  startSession: vi.fn().mockResolvedValue({ sessionId: 'sess-1', message: 'こんにちは' }),
  startOnboarding: vi.fn().mockResolvedValue({ sessionId: 'sess-2', message: 'はじめまして' }),
}))

describe('POST /api/sessions', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp(sessionsRoute, '/api/sessions', createMockDb())
  })

  it('returns 200 with sessionId and message', async () => {
    const res = await req(app, 'POST', '/api/sessions')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ sessionId: expect.any(String), message: expect.any(String) })
    expect(res).toSatisfyApiSpec()
  })
})

describe('POST /api/sessions/onboarding', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp(sessionsRoute, '/api/sessions', createMockDb())
  })

  it('returns 200 with sessionId and message', async () => {
    const res = await req(app, 'POST', '/api/sessions/onboarding')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ sessionId: expect.any(String), message: expect.any(String) })
    expect(res).toSatisfyApiSpec()
  })
})
