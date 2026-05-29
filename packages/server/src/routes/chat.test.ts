import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chatRoute } from './chat.js'
import { createMockDb, createTestApp, req } from '../test/helpers.js'

vi.mock('../interview/engine.js', () => ({
  processMessage: vi.fn().mockResolvedValue({ response: 'コーチの返答', shouldEnd: false, remainingTurns: 2 }),
}))

vi.mock('../llm/provider.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm/provider.js')>()
  return { ...actual }
})

describe('POST /api/chat', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp(chatRoute, '/api/chat', createMockDb())
  })

  it('returns 200 with response, shouldEnd, and remainingTurns', async () => {
    const res = await req(app, 'POST', '/api/chat', {
      sessionId: 'sess-1',
      message: 'こんにちは',
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      response: expect.any(String),
      shouldEnd: expect.any(Boolean),
      remainingTurns: expect.any(Number),
    })
    expect(res).toSatisfyApiSpec()
  })

  it('returns 200 with remainingTurns null for onboarding', async () => {
    const { processMessage } = await import('../interview/engine.js')
    vi.mocked(processMessage).mockResolvedValueOnce({ response: 'コーチの返答', shouldEnd: false, remainingTurns: null })
    const res = await req(app, 'POST', '/api/chat', {
      sessionId: 'sess-onboarding',
      message: 'はじめまして',
    })
    expect(res.status).toBe(200)
    expect(res.body.remainingTurns).toBeNull()
    expect(res).toSatisfyApiSpec()
  })

  it('returns 400 when sessionId is missing', async () => {
    const res = await req(app, 'POST', '/api/chat', { message: 'hello' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: expect.any(String) })
    expect(res).toSatisfyApiSpec()
  })

  it('returns 400 when message is missing', async () => {
    const res = await req(app, 'POST', '/api/chat', { sessionId: 'sess-1' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: expect.any(String) })
    expect(res).toSatisfyApiSpec()
  })

  it('returns 400 when message is blank', async () => {
    const res = await req(app, 'POST', '/api/chat', { sessionId: 'sess-1', message: '   ' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: expect.any(String) })
    expect(res).toSatisfyApiSpec()
  })
})
