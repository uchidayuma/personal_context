import { useState, useEffect } from 'react'
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
  const [phase, setPhase] = useState<Phase>('idle')
  const [coachText, setCoachText] = useState(initialCoachMessage)
  const [userText, setUserText] = useState('')
  const [fetchError, setFetchError] = useState<string | null>(null)

  function speak(text: string, onDone: () => void) {
    setPhase('speaking')
    const synth = window.speechSynthesis
    synth.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = language === 'ja' ? 'ja-JP' : 'en-US'
    utter.rate = 1.05
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
      setFetchError('通信エラーが発生しました')
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
    idle: ended ? 'セッション終了' : '押して話す',
    recording: '話してください...',
    processing: '処理中...',
    speaking: 'コーチが話しています',
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
        ✕ テキストモードに戻る
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
