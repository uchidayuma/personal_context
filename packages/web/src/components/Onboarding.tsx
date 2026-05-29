import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useVoiceInput } from '../hooks/useVoiceInput.js'
import ImportUpload from './ImportUpload.js'
import styles from './Onboarding.module.css'

type Phase = 'splash' | 'import' | 'chat' | 'preview'
type Message = { role: 'assistant' | 'user'; content: string }

interface ContextSummary {
  facts: { category: string; fact: string }[]
  timeline: { year: number; month: number | null; description: string }[]
  vignette: { title: string; quote: string; scene: string } | null
}

interface Props {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: Props) {
  const { t, i18n } = useTranslation()
  const [phase, setPhase] = useState<Phase>('splash')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<ContextSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const voice = useVoiceInput((text) => setInput(text))

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function beginInterview() {
    setPhase('chat')
    setLoading(true)
    try {
      const res = await fetch('/api/sessions/onboarding', { method: 'POST' })
      const data = await res.json() as { sessionId: string; message: string }
      setSessionId(data.sessionId)
      setMessages([{ role: 'assistant', content: data.message }])
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    if (!input.trim() || !sessionId || loading || phase !== 'chat') return
    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMessage }),
      })
      const data = await res.json() as { response: string; shouldEnd: boolean }
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      if (data.shouldEnd) {
        setPhase('preview')
        fetchSummary()
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '...' }])
    } finally {
      setLoading(false)
    }
  }

  async function fetchSummary() {
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/context-summary')
      const data = await res.json() as ContextSummary
      setSummary(data)
    } finally {
      setSummaryLoading(false)
    }
  }

  if (phase === 'splash') {
    return (
      <div className={styles.splash}>
        <div className={styles.splashIcon}>🌱</div>
        <h2 className={styles.splashTitle}>{t('onboarding.title')}</h2>
        <p className={styles.splashDesc}>{t('onboarding.description')}</p>
        <button className={styles.startBtn} onClick={() => setPhase('import')}>
          {t('onboarding.start')}
        </button>
      </div>
    )
  }

  if (phase === 'import') {
    return <ImportUpload onComplete={beginInterview} onSkip={beginInterview} />
  }

  if (phase === 'preview') {
    if (summaryLoading || !summary) {
      return (
        <div className={styles.previewLoading}>
          {t('onboarding.generating')}
        </div>
      )
    }

    return (
      <div className={styles.preview}>
        <div>
          <h2 className={styles.previewHeading}>{t('onboarding.skeletonTitle')}</h2>
          <p className={styles.previewSubheading}>{t('onboarding.skeletonSubtitle')}</p>
        </div>

        {summary.timeline.length > 0 && (
          <div className={styles.previewCard}>
            <div className={styles.previewCardTitle}>LIFE TIMELINE</div>
            <div className={styles.previewCardBody}>
              {summary.timeline.map((e, i) => (
                <div key={i} className={styles.timelineRow}>
                  <span className={styles.timelineYear}>
                    {e.year}{e.month ? `/${e.month}` : ''}
                  </span>
                  <span className={styles.timelineDesc}>{e.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.facts.length > 0 && (
          <div className={styles.previewCard}>
            <div className={styles.previewCardTitle}>KEY FACTS</div>
            <div className={styles.previewCardBody}>
              {summary.facts.map((f, i) => (
                <div key={i} className={styles.factRow}>
                  <span className={styles.factCategory}>{f.category}</span>
                  <span className={styles.factText}>{f.fact}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.vignette && (
          <div className={styles.previewCard}>
            <div className={styles.previewCardTitle}>VIGNETTE — {summary.vignette.title}</div>
            <div className={styles.previewCardBody}>
              <p className={styles.vignetteQuote}>"{summary.vignette.quote}"</p>
              <p className={styles.vignetteScene}>{summary.vignette.scene}</p>
            </div>
          </div>
        )}

        <div className={styles.previewActions}>
          <button className={styles.toInterviewLarge} onClick={onComplete}>
            {t('onboarding.toInterview')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.messageRow} ${msg.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant}`}
          >
            <div className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className={styles.messageRowAssistant}>
            <div className={styles.typing}>{t('chat.typing')}</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        {voice.error && <div className={styles.errorMsg}>{voice.error}</div>}
        <div className={styles.inputRow}>
          {voice.isSupported && (
            <button
              onClick={() => voice.isRecording ? voice.stop() : voice.start(i18n.language)}
              disabled={loading || voice.isTranscribing}
              title={voice.isRecording ? t('chat.recordStop') : voice.isTranscribing ? t('chat.transcribing') : t('chat.voiceInput')}
              className={`${styles.micBtn} ${voice.isRecording ? styles.micBtnRecording : ''}`}
            >
              {voice.isTranscribing ? '⏳' : voice.isRecording ? '⏹' : '🎤'}
            </button>
          )}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendMessage() } }}
            disabled={loading}
            placeholder={t('chat.placeholder')}
            rows={2}
            className={styles.textarea}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className={styles.sendBtn}
          >
            {t('chat.send')}
          </button>
        </div>
      </div>
    </div>
  )
}
