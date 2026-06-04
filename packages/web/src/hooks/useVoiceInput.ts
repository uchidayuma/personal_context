import { useState, useRef, useEffect } from 'react'

// Silence detection thresholds — tune if needed
const SILENCE_THRESHOLD = 12    // avg amplitude (0–255); raise if background noise triggers early
const SILENCE_DURATION_MS = 1000 // ms of silence after speech to trigger end
const MIN_SPEECH_MS = 300        // ignore sounds shorter than this (avoid false positives)

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false)   // auto VAD active
  const [isRecording, setIsRecording] = useState(false)   // manual recording active
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stopRef = useRef<(() => void) | null>(null)
  const isStartingRef = useRef(false)
  const manualRecorderRef = useRef<MediaRecorder | null>(null)
  const manualChunksRef = useRef<Blob[]>([])
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const isSupported = typeof window !== 'undefined' && !!window.MediaRecorder

  async function startListening(lang: string) {
    console.log('[VAD] startListening called', { isListening, isTranscribing, hasStopRef: !!stopRef.current, isStarting: isStartingRef.current })
    if (isListening || isTranscribing || stopRef.current || isStartingRef.current) {
      console.log('[VAD] BLOCKED - already active')
      return
    }
    isStartingRef.current = true
    setError(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      isStartingRef.current = false
      setError(lang === 'ja' ? 'マイクへのアクセスが拒否されました' : 'Microphone access denied')
      return
    }

    const audioCtx = new AudioContext()
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    audioCtx.createMediaStreamSource(stream).connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    let recorder: MediaRecorder | null = null
    let chunks: Blob[] = []
    let isCapturing = false
    let speechStartTime = 0
    let silenceStartTime = 0
    let done = false

    setIsListening(true)

    const intervalId = setInterval(() => {
      if (done) return

      analyser.getByteFrequencyData(dataArray)
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      const speaking = avg > SILENCE_THRESHOLD

      if (speaking) {
        silenceStartTime = 0
        if (!isCapturing) {
          isCapturing = true
          speechStartTime = Date.now()
          recorder = new MediaRecorder(stream)
          chunks = []
          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
          recorder.start()
        }
      } else if (isCapturing) {
        if (!silenceStartTime) silenceStartTime = Date.now()

        if (Date.now() - silenceStartTime >= SILENCE_DURATION_MS) {
          const speechDuration = silenceStartTime - speechStartTime

          if (speechDuration < MIN_SPEECH_MS) {
            // Too short — discard and keep listening
            const old = recorder!
            recorder = null
            chunks = []
            isCapturing = false
            speechStartTime = 0
            silenceStartTime = 0
            old.onstop = null
            old.stop()
          } else {
            // Valid utterance — finalize
            done = true
            clearInterval(intervalId)
            const r = recorder!
            const mimeType = r.mimeType
            r.onstop = async () => {
              console.log('[VAD] recorder stopped, cleaning up')
              stream.getTracks().forEach(t => t.stop())
              await audioCtx.close()
              stopRef.current = null
              isStartingRef.current = false
              setIsListening(false)
              console.log('[VAD] starting transcription')
              await transcribe(new Blob(chunks, { type: mimeType }), mimeType, lang)
            }
            r.stop()
          }
        }
      }
    }, 50)

    stopRef.current = () => {
      if (done) return
      done = true
      clearInterval(intervalId)
      recorder?.stop()
      stream.getTracks().forEach(t => t.stop())
      void audioCtx.close()
      setIsListening(false)
      stopRef.current = null
    }
    isStartingRef.current = false
  }

  function stopListening() {
    stopRef.current?.()
  }

  async function transcribe(blob: Blob, mimeType: string, lang: string) {
    console.log('[VAD] transcribe started', { blobSize: blob.size })
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
        console.log('[VAD] transcription success:', data.text)
        onTranscriptRef.current(data.text.trim())
      } else {
        throw new Error(data.error ?? 'empty response')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[VAD] transcription error:', msg)
      setError(lang === 'ja' ? `変換エラー: ${msg}` : `Transcription error: ${msg}`)
    } finally {
      console.log('[VAD] transcribe complete, resetting state')
      setIsTranscribing(false)
    }
  }

  // ── Manual push-to-talk (used by Chat / Onboarding) ─────────────────────
  async function start(lang: string) {
    if (isRecording || isTranscribing) return
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError(lang === 'ja' ? 'マイクへのアクセスが拒否されました' : 'Microphone access denied')
      return
    }
    const rec = new MediaRecorder(stream)
    manualChunksRef.current = []
    rec.ondataavailable = (e) => { if (e.data.size > 0) manualChunksRef.current.push(e.data) }
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(manualChunksRef.current, { type: rec.mimeType })
      await transcribe(blob, rec.mimeType, lang)
    }
    manualRecorderRef.current = rec
    rec.start()
    setIsRecording(true)
  }

  function stop() {
    manualRecorderRef.current?.stop()
    setIsRecording(false)
  }
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => () => {
    stopRef.current?.()
    manualRecorderRef.current?.stream?.getTracks().forEach(t => t.stop())
  }, [])

  return {
    isListening, isRecording, isTranscribing, isSupported,
    startListening, stopListening,   // auto VAD (VoiceMode)
    start, stop,                     // manual push-to-talk (Chat / Onboarding)
    error,
  }
}
