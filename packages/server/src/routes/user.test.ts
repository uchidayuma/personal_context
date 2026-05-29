import { describe, it, expect, vi, beforeEach } from 'vitest'
import { userRoute } from './user.js'
import { createMockDb, createTestApp, req } from '../test/helpers.js'

vi.mock('../db/client.js', () => ({
  getUser: vi.fn().mockResolvedValue({
    name: 'Test User',
    language: 'ja',
    onboardingCompletedAt: null,
  }),
  updateUserLanguage: vi.fn().mockResolvedValue(undefined),
}))

describe('GET /api/user', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp(userRoute, '/api/user', createMockDb())
  })

  it('returns 200 with user object', async () => {
    const res = await req(app, 'GET', '/api/user')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      name: expect.any(String),
      language: expect.stringMatching(/^(ja|en)$/),
    })
    expect(res).toSatisfyApiSpec()
  })
})

describe('PATCH /api/user', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp(userRoute, '/api/user', createMockDb())
  })

  it('returns 200 with ok: true', async () => {
    const res = await req(app, 'PATCH', '/api/user', { language: 'en' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true })
    expect(res).toSatisfyApiSpec()
  })
})
