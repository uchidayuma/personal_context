import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useVoiceInput } from '../hooks/useVoiceInput.js'
import styles from './VoiceMode.module.css'

type Phase = 'idle' | 'recording' | 'processing' | 'speaking'

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

  useEffect(() => {
    function loadVoices() {
      const all = window.speechSynthesis.getVoices()
      const filtered = all.filter(v => v.lang.startsWith(language === 'ja' ? 'ja' : 'en'))
      setVoices(filtered)
      if (filtered.length > 0 && !selectedVoiceName) {
        setSelectedVoiceName(filtered[0].name)
      }
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
    if (!text.trim()) { setPhase('idle'); return }
    setUserText(text)
    setPhase('processing')
    setFetchError(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      })
      const data = await res.json() as { response: string; shouldEnd: boolean }
      onExchange(text, data.response)
      setCoachText(data.response)

      if (data.shouldEnd) {
        speak(data.response, () => { onEnd(); onClose() })
      } else {
        speak(data.response, () => setPhase('idle'))
      }
    } catch {
      setFetchError(t('voice.networkError'))
      setPhase('idle')
    }
  })

  useEffect(() => {
    if (initialCoachMessage) speak(initialCoachMessage, () => setPhase('idle'))
    return () => { window.speechSynthesis.cancel() }
  }, [])

  const displayPhase: Phase =
    voice.isRecording ? 'recording'
    : voice.isTranscribing || phase === 'processing' ? 'processing'
    : phase

  const canRecord = displayPhase === 'idle' && !ended

  const PHASE_LABEL: Record<Phase, string> = {
    idle: ended ? t('voice.sessionEnded') : t('voice.pressToSpeak'),
    recording: t('voice.listening'),
    processing: t('voice.processing'),
    speaking: t('voice.speaking'),
  }

  const MIC_ICON: Record<Phase, string> = {
    idle: '🎤',
    recording: '⏹',
    processing: '⏳',
    speaking: '🔊',
  }

  return (
    <div className={styles.overlay}>
      <button
        className={styles.closeBtn}
        onClick={() => { window.speechSynthesis.cancel(); onClose() }}
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
        <p className={styles.phaseLabel}>{PHASE_LABEL[displayPhase]}</p>

        <button
          className={`${styles.micBtn} ${styles[`micBtn_${displayPhase}`]}`}
          onPointerDown={() => canRecord && voice.start(language)}
          onPointerUp={() => voice.isRecording && voice.stop()}
          onPointerLeave={() => voice.isRecording && voice.stop()}
          disabled={!canRecord}
        >
          {MIC_ICON[displayPhase]}
        </button>

        {(voice.error || fetchError) && (
          <p className={styles.error}>{voice.error ?? fetchError}</p>
        )}
      </div>
    </div>
  )
}
