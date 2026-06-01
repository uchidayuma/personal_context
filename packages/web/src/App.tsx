import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import SimpleMarkdown from './components/SimpleMarkdown.js'
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
  l07Fears: string
  l08Patterns: string
  l09Goals: string
  l10Preferences: string
  lifeChapters: string
}

interface ExportSection {
  heading: string
  facts: string[]
}

interface ExportLayer {
  key: string
  filename: string
  title: string
  zone: string
  sections: ExportSection[]
  other: string[]
  markdown: string
}

const ZONE_COLORS: Record<string, string> = {
  CORE: '#e94560',
  SHAPE: '#0f6',
  STATE: '#4af',
}

type ExportItemDef =
  | { type: 'special'; key: keyof ExportFiles; name: string }
  | { type: 'layer'; key: string }

const EXPORT_ORDER: ExportItemDef[] = [
  { type: 'special', key: 'index',           name: '_index.md' },
  { type: 'special', key: 'lifeChapters',    name: 'life_chapters.md' },
  { type: 'layer',   key: 'l01Values' },
  { type: 'layer',   key: 'l02Character' },
  { type: 'special', key: 'l03LifeTimeline', name: 'L03_life_timeline.md' },
  { type: 'special', key: 'l04Professional', name: 'L04_professional.md' },
  { type: 'layer',   key: 'l05Relationships' },
  { type: 'layer',   key: 'l06Opinions' },
  { type: 'layer',   key: 'l07Fears' },
  { type: 'layer',   key: 'l08Patterns' },
  { type: 'layer',   key: 'l09Goals' },
  { type: 'layer',   key: 'l10Preferences' },
]

export default function App() {
  const { t, i18n } = useTranslation()
  const [view, setView] = useState<View>('chat')
  const [exportFiles, setExportFiles] = useState<ExportFiles | null>(null)
  const [exportLayers, setExportLayers] = useState<ExportLayer[]>([])
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/user')
      .then(r => r.json())
      .then((data: { language: string; onboardingCompletedAt: string | null }) => {
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

  async function handleExport() {
    const res = await fetch('/api/export')
    const data = await res.json() as { files: ExportFiles; layers: ExportLayer[] }
    setExportFiles(data.files)
    setExportLayers(data.layers ?? [])
    setView('export')
  }

  async function copyContent(key: string, content: string) {
    await navigator.clipboard.writeText(content)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const onboarding = view === 'onboarding'

  return (
    <div className={styles.app}>
      {import.meta.env.VITE_DEMO_MODE === 'true' && (
        <div style={{ background: '#1a1a2e', color: '#aaa', fontSize: 12, textAlign: 'center', padding: '6px 16px' }}>
          {t('app.demo.notice')}
          {' '}<a href="https://github.com/uchidayuma/personal_context" target="_blank" rel="noopener noreferrer" style={{ color: '#e94560' }}>{t('app.demo.selfHost')}</a>
          {t('app.demo.noticeSuffix')}
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
            {t('app.nav.myContext')}
          </button>
          <button
            onClick={() => handleExport()}
            disabled={onboarding}
            className={`${styles.navBtn} ${view === 'export' ? styles.navBtnActive : ''}`}
          >
            {t('app.nav.export')}
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
            {(() => {
              const layerMap = Object.fromEntries(exportLayers.map(l => [l.key, l]))
              return EXPORT_ORDER.map((item) => {
                if (item.type === 'special') {
                  return (
                    <div key={item.key} className={styles.exportCard}>
                      <div className={styles.exportCardHeader}>
                        <span className={styles.exportFilename}>{item.name}</span>
                        <button
                          onClick={() => copyContent(item.key, exportFiles[item.key])}
                          className={`${styles.copyBtn} ${copiedKey === item.key ? styles.copyBtnSuccess : ''}`}
                        >
                          {copiedKey === item.key ? '✓ Copied' : t('export.copy')}
                        </button>
                      </div>
                      <div className={styles.exportContent}>
                    <SimpleMarkdown>{exportFiles[item.key]}</SimpleMarkdown>
                  </div>
                    </div>
                  )
                }
                const layer = layerMap[item.key]
                if (!layer) return null
                const isEmpty = layer.sections.length === 0 && layer.other.length === 0
                return (
                  <div key={layer.key} className={styles.exportCard}>
                    <div className={styles.exportCardHeader}>
                      <span className={styles.exportFilename}>{layer.filename}</span>
                      <span
                        className={styles.zoneTag}
                        style={{ background: ZONE_COLORS[layer.zone] ?? '#888' }}
                      >
                        {layer.zone}
                      </span>
                      <button
                        onClick={() => copyContent(layer.key, layer.markdown)}
                        className={`${styles.copyBtn} ${copiedKey === layer.key ? styles.copyBtnSuccess : ''}`}
                      >
                        {copiedKey === layer.key ? '✓ Copied' : t('export.copy')}
                      </button>
                    </div>
                    <div className={styles.layerBody}>
                      {isEmpty ? (
                        <p className={styles.emptyNote}>No data collected yet.</p>
                      ) : (
                        <>
                          {layer.sections.map((sec) => (
                            <div key={sec.heading} className={styles.layerSection}>
                              <h3 className={styles.sectionHeading}>{sec.heading}</h3>
                              <ul className={styles.factList}>
                                {sec.facts.map((fact, i) => (
                                  <li key={i}>{fact}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                          {layer.other.length > 0 && (
                            <div className={styles.layerSection}>
                              <h3 className={styles.sectionHeading}>その他</h3>
                              <ul className={styles.factList}>
                                {layer.other.map((fact, i) => (
                                  <li key={i}>{fact}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        )}
      </main>
    </div>
  )
}
