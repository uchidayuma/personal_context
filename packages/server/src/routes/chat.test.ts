import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chatRoute } from './chat.js'
import { createMockDb, createTestApp, req } from '../test/helpers.js'

vi.mock('../interview/engine.js', () => ({
  processMessage: vi.fn().mockResolvedValue({ response: 'コーチの返答', shouldEnd: false }),
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

  it('returns 200 with response and shouldEnd', async () => {
    const res = await req(app, 'POST', '/api/chat', {
      sessionId: 'sess-1',
      message: 'こんにちは',
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      response: expect.any(String),
      shouldEnd: expect.any(Boolean),
    })
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
