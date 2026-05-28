import { useState, useRef, useEffect } from 'react'

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const langRef = useRef('ja')
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const isSupported = typeof window !== 'undefined' && !!window.MediaRecorder

  async function start(lang: string) {
    if (isRecording || isTranscribing) return
    setError(null)
    langRef.current = lang

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError(lang === 'ja' ? 'マイクへのアクセスが拒否されました' : 'Microphone access denied')
      return
    }

    const rec = new MediaRecorder(stream)
    chunksRef.current = []

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunksRef.current, { type: rec.mimeType })
      await transcribe(blob, rec.mimeType, langRef.current)
    }

    mediaRecorderRef.current = rec
    rec.start()
    setIsRecording(true)
  }

  function stop() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  async function transcribe(blob: Blob, mimeType: string, lang: string) {
    setIsTranscribing(true)
    try {
      const ext = mimeType.split(';')[0].split('/')[1] ?? 'webm'
      const formData = new FormData()
      formData.append('audio', blob, `recording.${ext}`)
      formData.append('lang', lang)

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { text?: string; error?: string }
      if (data.text) {
        onTranscriptRef.current(data.text.trim())
      } else {
        throw new Error(data.error ?? 'empty response')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(lang === 'ja' ? `変換エラー: ${msg}` : `Transcription error: ${msg}`)
    } finally {
      setIsTranscribing(false)
    }
  }

  useEffect(() => () => { mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop()) }, [])

  return { isRecording, isTranscribing, isSupported, start, stop, error }
}
