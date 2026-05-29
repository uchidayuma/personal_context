import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useVoiceInput } from '../hooks/useVoiceInput.js'
import VoiceMode from './VoiceMode.js'
import ProgressHeader, { type ProgressData } from './ProgressHeader.js'
import styles from './Chat.module.css'

type Message = { role: 'assistant' | 'user'; content: string }

export default function Chat() {
  const { t, i18n } = useTranslation()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ended, setEnded] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [remainingTurns, setRemainingTurns] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const voice = useVoiceInput((text) => setInput(text))

  async function refreshProgress() {
    try {
      const res = await fetch('/api/progress')
      if (res.ok) setProgress(await res.json() as ProgressData)
    } catch { /* ignore */ }
  }

  useEffect(() => { startSession(); refreshProgress() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function startSession() {
    setLoading(true)
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      const data = await res.json() as { sessionId: string; message: string }
      setSessionId(data.sessionId)
      setMessages([{ role: 'assistant', content: data.message }])
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    if (!input.trim() || !sessionId || loading || ended) return
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
      const data = await res.json() as { response?: string; shouldEnd?: boolean; remainingTurns?: number | null; error?: string; code?: string }
      if (!res.ok) {
        if (data.code === 'MODEL_NOT_SUPPORTED') {
          setModelError(data.error ?? 'Model does not support structured output.')
        }
        setMessages(prev => [...prev, { role: 'assistant', content: '...' }])
        return
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.response! }])
      if (data.shouldEnd) setEnded(true)
      if (data.remainingTurns !== undefined) setRemainingTurns(data.remainingTurns)
      refreshProgress()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '...' }])
    } finally {
      setLoading(false)
    }
  }

  async function endSessionNow() {
    if (!sessionId || ended) return
    try {
      await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' })
    } catch (err) {
      console.error('[end] failed:', err)
      // サーバー側の失敗でもクライアントは終了状態にする（UIの整合性優先）
    }
    setEnded(true)
    refreshProgress()
  }

  async function skipQuestion() {
    if (!sessionId || ended) return
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/skip`, { method: 'POST' })
      const data = await res.json() as { message: string; remainingTurns: number | null }
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      if (data.remainingTurns !== undefined) setRemainingTurns(data.remainingTurns)
    } catch (err) {
      console.error('[skip] failed:', err)
      // loading=false は finally で復帰するので、ユーザーはボタンを再試行できる
    } finally {
      setLoading(false)
    }
  }

  const lastCoachMessage = [...messages].reverse().find(m => m.role === 'assistant')?.content ?? ''

  return (
    <div className={styles.container}>
      {voiceMode && sessionId && (
        <VoiceMode
          sessionId={sessionId}
          language={i18n.language}
          initialCoachMessage={lastCoachMessage}
          ended={ended}
          onClose={() => { setVoiceMode(false); refreshProgress() }}
          onExchange={(userMsg, coachMsg) => {
            setMessages(prev => [
              ...prev,
              { role: 'user', content: userMsg },
              { role: 'assistant', content: coachMsg },
            ])
            refreshProgress()
          }}
          onEnd={() => setEnded(true)}
        />
      )}
      <ProgressHeader data={progress} remainingTurns={remainingTurns} />
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
        {!ended && !loading && messages.length >= 1 && sessionId && (
          <div className={styles.skipRow}>
            <button className={styles.skipBtn} onClick={skipQuestion}>
              {t('chat.skip')}
            </button>
          </div>
        )}
        {ended && (
          <div className={styles.sessionEndedBar}>
            {t('chat.sessionEnded')}
            <button
              className={styles.newSessionBtn}
              onClick={() => { setEnded(false); setMessages([]); setSessionId(null); setRemainingTurns(null); startSession() }}
            >
              {t('chat.newSession')}
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        {modelError && (
          <div className={styles.modelErrorBanner}>
            <strong>モデル設定エラー</strong><br />
            {modelError}
          </div>
        )}
        {voice.error && <div className={styles.errorMsg}>{voice.error}</div>}
        <div className={styles.inputRow}>
          {sessionId && !ended && (
            <button
              onClick={endSessionNow}
              title={t('chat.endSession')}
              className={styles.endBtn}
            >
              {t('chat.endSession')}
            </button>
          )}
          {sessionId && !ended && (
            <button
              onClick={() => setVoiceMode(true)}
              title="音声対話モード"
              className={styles.voiceModeBtn}
            >
              🎧
            </button>
          )}
          {voice.isSupported && (
            <button
              onClick={() => voice.isRecording ? voice.stop() : voice.start(i18n.language)}
              disabled={loading || ended || voice.isTranscribing}
              title={voice.isRecording ? '録音停止' : voice.isTranscribing ? '変換中...' : '音声入力'}
              className={`${styles.micBtn} ${voice.isRecording ? styles.micBtnRecording : ''}`}
            >
              {voice.isTranscribing ? '⏳' : voice.isRecording ? '⏹' : '🎤'}
            </button>
          )}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendMessage() } }}
            disabled={loading || ended}
            placeholder={ended ? t('chat.placeholderEnded') : t('chat.placeholder')}
            rows={2}
            className={styles.textarea}
          />
          <button
            onClick={sendMessage}
            disabled={loading || ended || !input.trim()}
            className={styles.sendBtn}
          >
            {t('chat.send')}
          </button>
        </div>
      </div>
    </div>
  )
}
