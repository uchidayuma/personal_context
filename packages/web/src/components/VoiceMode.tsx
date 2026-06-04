import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useVoiceInput } from '../hooks/useVoiceInput.js'
import styles from './VoiceMode.module.css'

type Phase = 'ready' | 'idle' | 'listening' | 'processing' | 'speaking'

interface Props {
  sessionId: string
  language: string
  initialCoachMessage: string
  ended: boolean
  onClose: () => void
  onExchange: (userMsg: string, coachMsg: string) => void
  onEnd: () => void
}

export default function VoiceMode({
  sessionId, language, initialCoachMessage, ended,
  onClose, onExchange, onEnd,
}: Props) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('ready')
  const [coachText, setCoachText] = useState(initialCoachMessage)
  const [userText, setUserText] = useState('')
  const [fetchError, setFetchError] = useState<string | null>(null)

  const beginListeningRef = useRef(() => {})
  const sessionEndedRef = useRef(false)
  const hasSpokenInitial = useRef(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const vadDelayMs = Number(import.meta.env.VITE_VAD_DELAY_MS ?? 300)


  async function speak(text: string, onDone: () => void) {
    setPhase('speaking')

    // Stop any currently playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      })
      if (!res.ok) throw new Error(`TTS API error: ${res.status}`)

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      currentAudioRef.current = audio

      audio.onended = () => {
        URL.revokeObjectURL(url)
        currentAudioRef.current = null
        onDone()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        currentAudioRef.current = null
        onDone()
      }

      await audio.play()
    } catch (err) {
      console.error('[TTS] error:', err)
      onDone()
    }
  }

  const voice = useVoiceInput(async (text) => {
    // Discard if session already ended (e.g. VAD picked up TTS bleedthrough)
    if (sessionEndedRef.current) return
    // Empty transcription = false positive noise; restart listening
    if (!text.trim()) { beginListeningRef.current(); return }

    setUserText(text)
    setPhase('processing')
    setFetchError(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text, language }),
      })
      const data = await res.json() as { response: string; shouldEnd: boolean }
      onExchange(text, data.response)
      setCoachText(data.response)

      if (data.shouldEnd) {
        sessionEndedRef.current = true
        speak(data.response, async () => {
          await onEnd()
          onClose()
        })
      } else {
        speak(data.response, () => setTimeout(() => beginListeningRef.current(), vadDelayMs))
      }
    } catch {
      setFetchError(t('voice.networkError'))
      beginListeningRef.current()
    }
  })

  // Always up-to-date: start listening if session is still active
  beginListeningRef.current = () => {
    if (!ended && !sessionEndedRef.current) {
      setPhase('listening')
      void voice.startListening(language)
    } else {
      setPhase('idle')
    }
  }

  // Called from the "tap to start" button — must be a direct user gesture so that
  // Brave/Safari honour the Web Speech API autoplay policy.
  function startConversation() {
    if (hasSpokenInitial.current) return
    hasSpokenInitial.current = true
    if (initialCoachMessage) {
      speak(initialCoachMessage, () => setTimeout(() => beginListeningRef.current(), vadDelayMs))
    } else {
      beginListeningRef.current()
    }
  }

  useEffect(() => {
    return () => {
      if (currentAudioRef.current) currentAudioRef.current.pause()
      voice.stopListening()
    }
  }, [])

  const displayPhase: Phase =
    voice.isTranscribing || phase === 'processing' ? 'processing'
    : voice.isListening ? 'listening'
    : phase

  const PHASE_LABEL: Record<Phase, string> = {
    ready:      '',
    idle:       ended ? t('voice.sessionEnded') : '...',
    listening:  t('voice.listening'),
    processing: t('voice.processing'),
    speaking:   t('voice.speaking'),
  }

  return (
    <div className={styles.overlay}>
      <button
        className={styles.closeBtn}
        onClick={() => {
          if (currentAudioRef.current) currentAudioRef.current.pause()
          voice.stopListening()
          onClose()
        }}
      >
        {t('voice.backToText')}
      </button>

      <div className={styles.coachCard}>
        <div className={styles.coachLabel}>COACH</div>
        <p className={styles.coachText}>{coachText}</p>
      </div>

      {userText && (
        <div className={styles.userCard}>
          <div className={styles.userLabel}>YOU</div>
          <p className={styles.userText}>{userText}</p>
        </div>
      )}

      <div className={styles.micArea}>
        {displayPhase === 'ready' ? (
          <button className={styles.startBtn} onClick={startConversation}>
            {t('voice.tapToStart')}
          </button>
        ) : (
          <>
            <div className={`${styles.orb} ${styles[`orb_${displayPhase}`]}`} />
            <p className={styles.phaseLabel}>{PHASE_LABEL[displayPhase]}</p>
          </>
        )}
        {(voice.error || fetchError) && (
          <p className={styles.error}>{voice.error ?? fetchError}</p>
        )}
      </div>
    </div>
  )
}
