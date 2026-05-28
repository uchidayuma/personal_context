import { Hono } from 'hono'
import Groq from 'groq-sdk'

export const transcribeRoute = new Hono()

transcribeRoute.post('/', async (c) => {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return c.json({ error: 'GROQ_API_KEY is not set' }, 503)
  }

  const formData = await c.req.formData()
  const audio = formData.get('audio') as File | null
  const lang = (formData.get('lang') as string | null) ?? 'ja'

  if (!audio) {
    return c.json({ error: 'audio field is required' }, 400)
  }

  try {
    const groq = new Groq({ apiKey })
    const result = await groq.audio.transcriptions.create({
      file: audio,
      model: 'whisper-large-v3-turbo',
      language: lang,
      response_format: 'json',
    })
    return c.json({ text: result.text })
  } catch (err) {
    console.error('Transcription error:', err)
    return c.json({ error: 'Transcription failed' }, 500)
  }
})
