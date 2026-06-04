import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportRoute } from './export.js'
import { createMockDb, createTestApp, req } from '../test/helpers.js'

vi.mock('../export/markdown.js', () => ({
  exportToMarkdown: vi.fn().mockResolvedValue({
    files: {
      index: '# Index',
      l01Values: '# L1',
      l02Character: '# L2',
      l03LifeTimeline: '# L3',
      l04Professional: '# L4',
      l05Relationships: '# L5',
      l06Opinions: '# L6',
      l07Fears: null,
      l08Patterns: null,
      l09Goals: '# L9',
      l10Preferences: '# L10',
      lifeChapters: '# Chapters',
    },
    layers: [],
  }),
}))

vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    file: vi.fn(),
    generateAsync: vi.fn().mockResolvedValue(new Uint8Array([0x50, 0x4B, 0x03, 0x04])), // PK signature
  })),
}))

describe('GET /api/export', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp(exportRoute, '/api/export', createMockDb())
  })

  it('returns 200 with files object', async () => {
    const res = await req(app, 'GET', '/api/export')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('files')
    expect(res.body.files).toMatchObject({
      index: expect.any(String),
      l01Values: expect.any(String),
      lifeChapters: expect.any(String),
    })
    expect(res).toSatisfyApiSpec()
  })

  it('returns 200 with private files when visibility=all', async () => {
    const { exportToMarkdown } = await import('../export/markdown.js')
    vi.mocked(exportToMarkdown).mockResolvedValueOnce({
      files: {
        index: '# Index',
        l01Values: '# L1',
        l02Character: '# L2',
        l03LifeTimeline: '# L3',
        l04Professional: '# L4',
        l05Relationships: '# L5',
        l06Opinions: '# L6',
        l07Fears: '# L7',
        l08Patterns: '# L8',
        l09Goals: '# L9',
        l10Preferences: '# L10',
        lifeChapters: '# Chapters',
      },
      layers: [],
    })
    const res = await req(app, 'GET', '/api/export?visibility=all')
    expect(res.status).toBe(200)
    expect(res).toSatisfyApiSpec()
  })
})

describe('GET /api/export/download', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp(exportRoute, '/api/export', createMockDb())
  })

  it('returns 200 with application/zip content-type', async () => {
    const res = await req(app, 'GET', '/api/export/download')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/zip/)
    expect(res.headers['content-disposition']).toBe('attachment; filename="personal_context.zip"')
  })

  it('generates zip with markdown files', async () => {
    const JSZip = (await import('jszip')).default
    const res = await req(app, 'GET', '/api/export/download')
    expect(res.status).toBe(200)
    // Verify JSZip was instantiated
    expect(JSZip).toHaveBeenCalled()
  })
})
