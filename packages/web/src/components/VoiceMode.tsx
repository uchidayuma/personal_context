import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useVoiceInput } from '../hooks/useVoiceInput.js'
import styles from './VoiceMode.module.css'

type Phase = 'idle' | 'listening' | 'processing' | 'speaking'

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
  const [phase, setPhase] = useState<Phase>('idle')
  const [coachText, setCoachText] = useState(initialCoachMessage)
  const [userText, setUserText] = useState('')
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('')
  const langCode = language === 'ja' ? 'ja-JP' : 'en-US'

  const beginListeningRef = useRef(() => {})
  const sessionEndedRef = useRef(false)
  // Guard: speak initial message only once, after voices are ready
  const hasSpokenInitial = useRef(false)

  useEffect(() => {
    function loadVoices() {
      const all = window.speechSynthesis.getVoices()
      const filtered = all.filter(v => v.lang.startsWith(language === 'ja' ? 'ja' : 'en'))
      setVoices(filtered)
      if (filtered.length > 0 && !selectedVoiceName) setSelectedVoiceName(filtered[0].name)
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [language])

  function speak(text: string, onDone: () => void) {
    setPhase('speaking')
    const synth = window.speechSynthesis
    synth.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = langCode
    utter.rate = 1.1
    const selectedVoice = voices.find(v => v.name === selectedVoiceName)
    if (selectedVoice) utter.voice = selectedVoice
    utter.onend = onDone
    utter.onerror = () => onDone()
    synth.speak(utter)
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
        speak(data.response, () => { onEnd(); onClose() })
      } else {
        speak(data.response, () => beginListeningRef.current())
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

  // Speak initial message once voices are ready (voices=[] at mount → TTS fails silently)
  useEffect(() => {
    if (voices.length === 0 || hasSpokenInitial.current) return
    hasSpokenInitial.current = true
    if (initialCoachMessage) {
      speak(initialCoachMessage, () => beginListeningRef.current())
    } else {
      beginListeningRef.current()
    }
  }, [voices])

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
      voice.stopListening()
    }
  }, [])

  const displayPhase: Phase =
    voice.isTranscribing || phase === 'processing' ? 'processing'
    : voice.isListening ? 'listening'
    : phase

  const PHASE_LABEL: Record<Phase, string> = {
    idle:       ended ? t('voice.sessionEnded') : '...',
    listening:  t('voice.listening'),
    processing: t('voice.processing'),
    speaking:   t('voice.speaking'),
  }

  return (
    <div className={styles.overlay}>
      <button
        className={styles.closeBtn}
        onClick={() => { window.speechSynthesis.cancel(); voice.stopListening(); onClose() }}
      >
        {t('voice.backToText')}
      </button>

      {voices.length > 0 && (
        <div className={styles.voiceSelector}>
          <span className={styles.voiceSelectorLabel}>🔊</span>
          <select
            className={styles.voiceSelect}
            value={selectedVoiceName}
            onChange={e => setSelectedVoiceName(e.target.value)}
          >
            {voices.map(v => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
        </div>
      )}

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
        <div className={`${styles.orb} ${styles[`orb_${displayPhase}`]}`} />
        <p className={styles.phaseLabel}>{PHASE_LABEL[displayPhase]}</p>
        {(voice.error || fetchError) && (
          <p className={styles.error}>{voice.error ?? fetchError}</p>
        )}
      </div>
    </div>
  )
}
