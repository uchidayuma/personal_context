import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sessionsRoute } from './sessions.js'
import { createMockDb, createTestApp, req } from '../test/helpers.js'

vi.mock('../interview/engine.js', () => ({
  startSession: vi.fn().mockResolvedValue({ sessionId: 'sess-1', message: 'こんにちは' }),
  startOnboarding: vi.fn().mockResolvedValue({ sessionId: 'sess-2', message: 'はじめまして' }),
  endSession: vi.fn().mockResolvedValue(undefined),
  skipQuestion: vi.fn().mockResolvedValue({ message: '次の質問です', remainingTurns: 1 }),
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

describe('POST /api/sessions/:id/end', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp(sessionsRoute, '/api/sessions', createMockDb())
  })

  it('returns 200 with ok: true', async () => {
    const res = await req(app, 'POST', '/api/sessions/sess-1/end')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true })
    expect(res).toSatisfyApiSpec()
  })

  it('returns 404 when endSession throws session not found', async () => {
    const { endSession } = await import('../interview/engine.js')
    vi.mocked(endSession).mockRejectedValueOnce(new Error('Session not found or already ended'))
    const res = await req(app, 'POST', '/api/sessions/not-found/end')
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: expect.any(String) })
    expect(res).toSatisfyApiSpec()
  })
})

describe('POST /api/sessions/:id/skip', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp(sessionsRoute, '/api/sessions', createMockDb())
  })

  it('returns 200 with message and remainingTurns', async () => {
    const res = await req(app, 'POST', '/api/sessions/sess-1/skip')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      message: expect.any(String),
      remainingTurns: expect.any(Number),
    })
    expect(res).toSatisfyApiSpec()
  })

  it('returns 200 with remainingTurns null for onboarding', async () => {
    const { skipQuestion } = await import('../interview/engine.js')
    vi.mocked(skipQuestion).mockResolvedValueOnce({ message: '次の質問です', remainingTurns: null })
    const res = await req(app, 'POST', '/api/sessions/sess-onboarding/skip')
    expect(res.status).toBe(200)
    expect(res.body.remainingTurns).toBeNull()
    expect(res).toSatisfyApiSpec()
  })

  it('returns 404 when skipQuestion throws session not found', async () => {
    const { skipQuestion } = await import('../interview/engine.js')
    vi.mocked(skipQuestion).mockRejectedValueOnce(new Error('Session not found or already ended'))
    const res = await req(app, 'POST', '/api/sessions/not-found/skip')
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: expect.any(String) })
    expect(res).toSatisfyApiSpec()
  })
})
