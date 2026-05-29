import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Chat from './components/Chat.js'
import Onboarding from './components/Onboarding.js'
import ContextDashboard from './components/ContextDashboard.js'
import styles from './App.module.css'

type View = 'onboarding' | 'chat' | 'export' | 'dashboard'

interface ExportFiles {
  index: string
  l01Values: string
  l02Character: string
  l03LifeTimeline: string
  l04Professional: string
  l05Relationships: string
  l06Opinions: string
  l07Fears: string | null
  l08Patterns: string | null
  l09Goals: string
  l10Preferences: string
  lifeChapters: string
}

const FILE_LABELS: { key: keyof ExportFiles; name: string }[] = [
  { key: 'index', name: '_index.md' },
  { key: 'lifeChapters', name: 'life_chapters.md' },
  { key: 'l01Values', name: 'L01_values.md' },
  { key: 'l02Character', name: 'L02_character.md' },
  { key: 'l03LifeTimeline', name: 'L03_life_timeline.md' },
  { key: 'l04Professional', name: 'L04_professional.md' },
  { key: 'l05Relationships', name: 'L05_relationships.md' },
  { key: 'l06Opinions', name: 'L06_opinions.md' },
  { key: 'l07Fears', name: 'L07_fears.md' },
  { key: 'l08Patterns', name: 'L08_patterns.md' },
  { key: 'l09Goals', name: 'L09_goals.md' },
  { key: 'l10Preferences', name: 'L10_preferences.md' },
]

export default function App() {
  const { t, i18n } = useTranslation()
  const [view, setView] = useState<View>('chat')
  const [exportFiles, setExportFiles] = useState<ExportFiles | null>(null)
  const [copiedKey, setCopiedKey] = useState<keyof ExportFiles | null>(null)

  useEffect(() => {
    fetch('/api/user')
      .then(r => r.json())
      .then((data: { language: string; onboardingCompletedAt: string | null }) => {
        console.log('[DEBUG /api/user response]', data)
        if (data.language && data.language !== i18n.language) {
          i18n.changeLanguage(data.language)
        }
        if (!data.onboardingCompletedAt) {
          setView('onboarding')
        }
      })
      .catch(() => {})
  }, [])

  async function switchLanguage(lang: string) {
    await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang }),
    })
    i18n.changeLanguage(lang)
  }

  async function handleExport(includePrivate: boolean) {
    const res = await fetch(`/api/export?visibility=${includePrivate ? 'all' : 'public'}`)
    const data = await res.json() as { files: ExportFiles }
    setExportFiles(data.files)
    setView('export')
  }

  async function copyFile(key: keyof ExportFiles) {
    if (!exportFiles) return
    const content = exportFiles[key]
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const onboarding = view === 'onboarding'

  return (
    <div className={styles.app}>
      {import.meta.env.VITE_DEMO_MODE === 'true' && (
        <div style={{ background: '#1a1a2e', color: '#aaa', fontSize: 12, textAlign: 'center', padding: '6px 16px' }}>
          デモ版：タブを閉じるとデータが消えます。続けて使うには
          {' '}<a href="https://github.com/uchidayuma/personal_context" target="_blank" rel="noopener noreferrer" style={{ color: '#e94560' }}>セルフホスト版</a>
          {' '}をお試しください。
        </div>
      )}
      <header className={styles.header}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <nav className={styles.nav}>
          <button
            onClick={() => setView('chat')}
            disabled={onboarding}
            className={`${styles.navBtn} ${view === 'chat' ? styles.navBtnActive : ''}`}
          >
            {t('app.nav.interview')}
          </button>
          <button
            onClick={() => setView('dashboard')}
            disabled={onboarding}
            className={`${styles.navBtn} ${view === 'dashboard' ? styles.navBtnActive : ''}`}
          >
            マイコンテキスト
          </button>
          <button
            onClick={() => handleExport(false)}
            disabled={onboarding}
            className={styles.navBtn}
          >
            {t('app.nav.exportPublic')}
          </button>
          <button
            onClick={() => handleExport(true)}
            disabled={onboarding}
            className={styles.navBtn}
          >
            {t('app.nav.exportAll')}
          </button>
          <div className={styles.langGroup}>
            {['ja', 'en'].map(lang => (
              <button
                key={lang}
                onClick={() => switchLanguage(lang)}
                className={`${styles.langBtn} ${i18n.language === lang ? styles.langBtnActive : ''}`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className={styles.main}>
        {view === 'onboarding' && <Onboarding onComplete={() => setView('chat')} />}
        {view === 'chat' && <Chat />}
        {view === 'dashboard' && <ContextDashboard onStartInterview={() => setView('chat')} />}
        {view === 'export' && exportFiles && (
          <div className={styles.exportGrid}>
            {FILE_LABELS.filter(({ key }) => exportFiles[key] !== null).map(({ key, name }) => (
              <div key={key} className={styles.exportCard}>
                <div className={styles.exportCardHeader}>
                  <span className={styles.exportFilename}>{name}</span>
                  <button
                    onClick={() => copyFile(key)}
                    className={`${styles.copyBtn} ${copiedKey === key ? styles.copyBtnSuccess : ''}`}
                  >
                    {copiedKey === key ? '✓ Copied' : t('export.copy')}
                  </button>
                </div>
                <pre className={styles.exportContent}>{exportFiles[key]}</pre>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
