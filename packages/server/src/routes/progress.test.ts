import { describe, it, expect, beforeEach } from 'vitest'
import { progressRoute } from './progress.js'
import { createMockDb, createTestApp, req } from '../test/helpers.js'

describe('GET /api/progress', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp(progressRoute, '/api/progress', createMockDb(3))
  })

  it('returns 200 with overall, layers, and totals', async () => {
    const res = await req(app, 'GET', '/api/progress')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      overall: expect.any(Number),
      layers: expect.any(Array),
      totals: expect.objectContaining({
        facts: expect.any(Number),
        timeline: expect.any(Number),
        professional: expect.any(Number),
        vignettes: expect.any(Number),
      }),
    })
    expect(res).toSatisfyApiSpec()
  })

  it('layers array has correct shape', async () => {
    const res = await req(app, 'GET', '/api/progress')
    expect(res.status).toBe(200)
    const { layers } = res.body
    expect(layers.length).toBe(10)
    for (const layer of layers) {
      expect(layer).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        zone: expect.stringMatching(/^(CORE|SHAPE|STATE)$/),
        percent: expect.any(Number),
        count: expect.any(Number),
        threshold: expect.any(Number),
      })
    }
  })
})
