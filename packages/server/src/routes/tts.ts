import { Hono } from 'hono'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'

export const ttsRoute = new Hono()

// Health check endpoint — returns 200 if GCP credentials are available
ttsRoute.get('/health', async (c) => {
  const hasCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS
  return c.json({ available: hasCredentials })
})

ttsRoute.post('/', async (c) => {
  let text: string
  let language: string
  try {
    const body = await c.req.json<{ text: string; language?: string }>()
    text = body.text
    language = body.language ?? 'ja'
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400)
  }

  if (!text?.trim()) return c.json({ error: 'text is required' }, 400)

  try {
    const client = new TextToSpeechClient()

    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: language === 'en' ? 'en-US' : 'ja-JP',
        name: language === 'en' ? 'en-US-Journey-D' : 'ja-JP-Neural2-B',
      },
      audioConfig: { audioEncoding: 'MP3' },
    })

    if (!response.audioContent) {
      throw new Error('No audio content returned')
    }

    const buffer = Buffer.from(response.audioContent as Uint8Array)
    return new Response(buffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (err) {
    console.error('[TTS] Google Cloud TTS error:', err)
    return c.json({ error: 'TTS failed' }, 500)
  }
})
