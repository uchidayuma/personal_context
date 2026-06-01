import { useTranslation } from 'react-i18next'
import { useVoiceInput } from '../hooks/useVoiceInput.js'
import { useProgress } from '../hooks/useProgress.js'
import { useChat } from '../hooks/useChat.js'
import { CATEGORY_TO_LAYER } from '../constants/layers.js'
import VoiceMode from './VoiceMode.js'
import ProgressHeader from './ProgressHeader.js'
import styles from './Chat.module.css'

export default function Chat() {
  const { t, i18n } = useTranslation()
  const { progress, savedNotice, refreshProgress } = useProgress()
  const {
    sessionId, messages, input, setInput,
    loading, ended, voiceMode, setVoiceMode,
    modelError, rateLimitHit, remainingTurns, sessionSummary,
    bottomRef, lastCoachMessage,
    sendMessage, endSessionNow, skipQuestion, resetSession, addMessages, setEnded,
  } = useChat(refreshProgress)
  const voice = useVoiceInput((text) => setInput(text))

  if (rateLimitHit) {
    return (
      <div className={styles.container}>
        <div className={styles.rateLimitBanner}>
          <p className={styles.rateLimitTitle}>{t('demo.rateLimitTitle')}</p>
          <p className={styles.rateLimitBody}>{t('demo.rateLimitBody')}</p>
          <p className={styles.rateLimitBody}>
            {t('demo.rateLimitSelfHost')}
            <a href="https://github.com/uchidayuma/personal_context" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {voiceMode && sessionId && (
        <VoiceMode
          sessionId={sessionId}
          language={i18n.language}
          initialCoachMessage={lastCoachMessage}
          ended={ended}
          onClose={() => { setVoiceMode(false); refreshProgress() }}
          onExchange={(userMsg, coachMsg) => { addMessages(userMsg, coachMsg); refreshProgress() }}
          onEnd={() => setEnded(true)}
        />
      )}
      <ProgressHeader data={progress} remainingTurns={remainingTurns} />
      {savedNotice !== null && (
        <div className={styles.savedNotice}>+{savedNotice}</div>
      )}

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
        {ended && (
          <div className={styles.sessionEndedBar}>
            {t('chat.sessionEnded')}
            <button className={styles.newSessionBtn} onClick={resetSession}>
              {t('chat.newSession')}
            </button>
          </div>
        )}
        {ended && sessionSummary && (
          <div className={styles.sessionSummary}>
            <div className={styles.sessionSummaryTitle}>{t('chat.summaryTitle')}</div>
            {Object.keys(sessionSummary.facts).length > 0 && (
              <div className={styles.sessionSummaryRow}>
                {Object.entries(sessionSummary.facts).map(([cat, n]) => (
                  <span key={cat} className={styles.summaryTag}>
                    <span className={styles.summaryTagLayer}>{CATEGORY_TO_LAYER[cat] ?? '?'}</span>
                    {cat} ×{n}
                  </span>
                ))}
              </div>
            )}
            {sessionSummary.timeline > 0 && (
              <div className={styles.sessionSummaryRow}>
                <span className={styles.summaryTag}>
                  <span className={styles.summaryTagLayer}>L3</span>
                  timeline ×{sessionSummary.timeline}
                </span>
              </div>
            )}
            {sessionSummary.vignettes.length > 0 && (
              <div className={styles.sessionSummaryRow}>
                {sessionSummary.vignettes.map((title, i) => (
                  <span key={i} className={`${styles.summaryTag} ${styles.summaryTagVignette}`}>
                    <span className={styles.summaryTagLayer}>life_chapters</span>
                    📖 {title}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        {!ended && messages.length >= 1 && sessionId && (
          <div className={styles.skipRow}>
            <button className={styles.skipBtn} onClick={skipQuestion} disabled={loading}>
              {t('chat.skip')}
            </button>
          </div>
        )}
        {modelError && (
          <div className={styles.modelErrorBanner}>
            <strong>{t('chat.modelError')}</strong><br />
            {modelError}
          </div>
        )}
        {voice.error && <div className={styles.errorMsg}>{voice.error}</div>}
        <div className={styles.inputRow}>
          {sessionId && !ended && (
            <button
              onClick={endSessionNow}
              data-tooltip={t('chat.endSessionTooltip')}
              className={styles.endBtn}
            >
              {t('chat.endSession')}
            </button>
          )}
          {sessionId && !ended && (
            <button
              onClick={() => setVoiceMode(true)}
              data-tooltip={t('chat.voiceMode')}
              className={styles.voiceModeBtn}
            >
              🎧
            </button>
          )}
          {voice.isSupported && (
            <button
              onClick={() => voice.isRecording ? voice.stop() : voice.start(i18n.language)}
              disabled={loading || ended || voice.isTranscribing}
              data-tooltip={voice.isRecording ? t('chat.recordStop') : voice.isTranscribing ? t('chat.transcribing') : t('chat.voiceInput')}
              className={`${styles.micBtn} ${voice.isRecording ? styles.micBtnRecording : ''}`}
            >
              {voice.isTranscribing ? '⏳' : voice.isRecording ? '⏹' : '🎤'}
            </button>
          )}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendMessage(i18n.language) } }}
            disabled={loading || ended}
            placeholder={ended ? t('chat.placeholderEnded') : t('chat.placeholder')}
            rows={2}
            className={styles.textarea}
          />
          <button
            onClick={() => sendMessage(i18n.language)}
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
