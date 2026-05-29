import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './ProgressHeader.module.css'

interface LayerProgress {
  id: string
  name: string
  zone: 'CORE' | 'SHAPE' | 'STATE'
  percent: number
  count: number
  threshold: number
}

export interface ProgressData {
  overall: number
  layers: LayerProgress[]
}

interface Props {
  data: ProgressData | null
  remainingTurns?: number | null
}

const ZONES: Array<'CORE' | 'SHAPE' | 'STATE'> = ['CORE', 'SHAPE', 'STATE']

function dotClass(layer: LayerProgress, s: typeof styles): string {
  if (layer.percent >= 100) return `${s.dot} ${s.dotDone}`
  if (layer.count > 0) return `${s.dot} ${s.dotPartial}`
  return `${s.dot} ${s.dotEmpty}`
}

export default function ProgressHeader({ data, remainingTurns }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  if (!data) return null

  const overall = Math.round(data.overall)

  return (
    <div className={styles.panel}>
      <div className={styles.summary} onClick={() => setExpanded(e => !e)}>
        <span className={styles.label}>{t('progress.label')}</span>
        <div className={styles.barWrap}>
          <div className={styles.bar}>
            <div className={styles.barFill} style={{ width: `${Math.min(overall, 100)}%` }} />
          </div>
          <span className={styles.pct}>{overall}%</span>
        </div>
        {remainingTurns != null && (
          <span className={styles.remaining}>{t('progress.remaining', { count: remainingTurns })}</span>
        )}
        <button className={styles.toggle} aria-label={t('progress.toggleLabel')}>
          {expanded ? '▴' : '▾'}
        </button>
      </div>

      <div className={styles.dots}>
        {data.layers.map(layer => (
          <span key={layer.id} className={dotClass(layer, styles)} title={`${layer.id} ${layer.name}: ${layer.count}/${layer.threshold}`}>
            {layer.id}
          </span>
        ))}
      </div>

      {expanded && (
        <div className={styles.detail}>
          {ZONES.map(zone => {
            const layers = data.layers.filter(l => l.zone === zone)
            return (
              <div key={zone} className={styles.zone}>
                <div className={styles.zoneLabel}>{t(`progress.zones.${zone}`)}</div>
                {layers.map(layer => (
                  <div key={layer.id} className={styles.layerRow}>
                    <span className={styles.layerName}>
                      <span className={styles.layerId}>{layer.id}</span>
                      {layer.name}
                    </span>
                    <div className={styles.layerBar}>
                      <div
                        className={styles.layerFill}
                        style={{ width: `${Math.min(layer.percent, 100)}%` }}
                      />
                    </div>
                    <span className={styles.layerMeta}>{layer.count}/{layer.threshold}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
