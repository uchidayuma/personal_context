import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { ttsRoute } from './tts.js'

describe('ttsRoute', () => {
  let app: Hono
  let originalEnv: string | undefined

  beforeEach(() => {
    app = new Hono()
    app.route('/api/tts', ttsRoute)
    originalEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = originalEnv
    } else {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS
    }
  })

  describe('GET /api/tts/health', () => {
    it('returns available: true when GOOGLE_APPLICATION_CREDENTIALS is set', async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/key.json'

      const res = await app.request('/api/tts/health')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toEqual({ available: true })
    })

    it('returns available: false when GOOGLE_APPLICATION_CREDENTIALS is not set', async () => {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS

      const res = await app.request('/api/tts/health')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toEqual({ available: false })
    })
  })

  describe('POST /api/tts', () => {
    it('returns 400 when request body is invalid JSON', async () => {
      const res = await app.request('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json',
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })

    it('returns 400 when text is missing', async () => {
      const res = await app.request('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'ja' }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('text is required')
    })

    it('returns 400 when text is empty string', async () => {
      const res = await app.request('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '   ', language: 'ja' }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('text is required')
    })
  })
})
