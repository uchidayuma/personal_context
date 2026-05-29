import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './ContextDashboard.module.css'

interface LayerProgress {
  id: string
  name: string
  zone: 'CORE' | 'SHAPE' | 'STATE'
  percent: number
  count: number
  threshold: number
}

interface ProgressData {
  overall: number
  layers: LayerProgress[]
  totals: {
    facts: number
    timeline: number
    professional: number
    vignettes: number
  }
}

interface ContextSummary {
  facts: { category: string; fact: string }[]
  timeline: { year: number; month: number | null; description: string }[]
  vignette: { title: string; quote: string; scene: string } | null
}

interface Props {
  onStartInterview: () => void
}

export default function ContextDashboard({ onStartInterview }: Props) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [summary, setSummary] = useState<ContextSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [progressRes, summaryRes] = await Promise.all([
          fetch('/api/progress'),
          fetch('/api/context-summary'),
        ])
        const progressData = await progressRes.json() as ProgressData
        const summaryData = await summaryRes.json() as ContextSummary
        setProgress(progressData)
        setSummary(summaryData)
      } catch {
        // leave null — show empty state
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>{t('dashboard.loading')}</div>
      </div>
    )
  }

  const zones: Array<'CORE' | 'SHAPE' | 'STATE'> = ['CORE', 'SHAPE', 'STATE']

  const sortedTimeline = summary
    ? [...summary.timeline].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return (a.month ?? 0) - (b.month ?? 0)
      })
    : []

  const groupedFacts: Record<string, { category: string; fact: string }[]> = {}
  if (summary) {
    for (const f of summary.facts) {
      if (!groupedFacts[f.category]) groupedFacts[f.category] = []
      groupedFacts[f.category].push(f)
    }
  }

  return (
    <div className={styles.page}>
      {/* Section 1: Progress */}
      <div className={styles.overallCard}>
        <div className={styles.overallHeader}>
          <span className={styles.overallTitle}>{t('dashboard.completeness')}</span>
          <div className={styles.overallBadge}>
            <span className={styles.overallNum}>{progress ? Math.round(progress.overall) : 0}</span>
            <span className={styles.overallPct}>%</span>
          </div>
        </div>

        {zones.map(zone => {
          const layers = progress
            ? progress.layers.filter(l => l.zone === zone)
            : []
          return (
            <div key={zone} className={styles.zoneSection}>
              <div className={styles.zoneLabel}>{zone}</div>
              {layers.map(layer => (
                <div key={layer.id} className={styles.layerRow}>
                  <span className={styles.layerName}>
                    <span className={styles.layerId}>{layer.id}</span>
                    {t(`dashboard.layers.${layer.id}`, { defaultValue: layer.name })}
                  </span>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${Math.min(layer.percent, 100)}%` }}
                    />
                  </div>
                  <span className={styles.layerMeta}>
                    {Math.round(layer.percent)}%&nbsp;&nbsp;{layer.count}/{layer.threshold}
                  </span>
                </div>
              ))}
            </div>
          )
        })}

        <div className={styles.startBtnWrapper}>
          <button className={styles.startBtn} onClick={onStartInterview}>
            {t('dashboard.continueInterview')}
          </button>
        </div>
      </div>

      {/* Section 2: Collected data */}
      <div className={styles.dataCard}>
        <div className={styles.dataCardHeader}>{t('dashboard.collectedData')}</div>

        {/* Timeline */}
        <div className={styles.dataSection}>
          <div className={styles.dataSectionTitle}>
            LIFE TIMELINE
            {progress && (
              <span className={styles.dataSectionCount}>{t('dashboard.countItems', { count: progress.totals.timeline })}</span>
            )}
          </div>
          {sortedTimeline.length === 0 ? (
            <p className={styles.emptyNote}>{t('dashboard.noData')}</p>
          ) : (
            <div className={styles.dataSectionBody}>
              {sortedTimeline.map((e, i) => (
                <div key={i} className={styles.timelineRow}>
                  <span className={styles.timelineYear}>
                    {e.year}{e.month ? `/${e.month}` : ''}
                  </span>
                  <span className={styles.timelineDesc}>{e.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Facts */}
        <div className={styles.dataSection}>
          <div className={styles.dataSectionTitle}>
            KEY FACTS
            {progress && (
              <span className={styles.dataSectionCount}>{t('dashboard.countItems', { count: progress.totals.facts })}</span>
            )}
          </div>
          {Object.keys(groupedFacts).length === 0 ? (
            <p className={styles.emptyNote}>{t('dashboard.noData')}</p>
          ) : (
            Object.entries(groupedFacts).map(([category, facts]) => (
              <div key={category} className={styles.dataSectionBody}>
                {facts.map((f, i) => (
                  <div key={i} className={styles.factRow}>
                    <span className={styles.factCategory}>{f.category}</span>
                    <span className={styles.factText}>{f.fact}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
