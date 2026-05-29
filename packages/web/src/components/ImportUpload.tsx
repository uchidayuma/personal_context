import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './ImportUpload.module.css'

interface ImportResult {
  imported: { timeline: number; professional: number; facts: number }
}

interface ProgressLayer {
  id: string
  name: string
  zone: 'CORE' | 'SHAPE' | 'STATE'
  percent: number
  count: number
  threshold: number
}

interface Preview {
  layers: ProgressLayer[]
  lifeChaptersMd: string
  comment: string | null
}

interface Props {
  onComplete: () => void
  onSkip: () => void
}

export default function ImportUpload({ onComplete, onSkip }: Props) {
  const { t } = useTranslation()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function loadPreview() {
    setPreviewLoading(true)
    try {
      const [exportRes, insightsRes, progressRes] = await Promise.all([
        fetch('/api/export?visibility=all'),
        fetch('/api/insights'),
        fetch('/api/progress'),
      ])
      const exportData = await exportRes.json() as { files: { lifeChapters: string } }
      const insightsData = await insightsRes.json() as { comment: string | null }
      const progressData = await progressRes.json() as { layers: ProgressLayer[] }
      setPreview({
        layers: progressData.layers ?? [],
        lifeChaptersMd: exportData.files.lifeChapters ?? '',
        comment: insightsData.comment ?? null,
      })
    } catch {
      setPreview({ layers: [], lifeChaptersMd: '', comment: null })
    } finally {
      setPreviewLoading(false)
    }
  }

  async function upload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/import', { method: 'POST', body: fd })
      const data = await res.json() as ImportResult & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'upload failed')
      setResult(data)
      loadPreview()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  if (result) {
    const { imported } = result
    return (
      <div className={styles.resultContainer}>
        <div className={styles.resultHeader}>
          <div className={styles.successIcon}>✓</div>
          <h3 className={styles.successTitle}>{t('import.complete')}</h3>
          <div className={styles.counts}>
            <div className={styles.count}>
              <span className={styles.countNum}>{imported.professional}</span>
              <span className={styles.countLabel}>{t('import.professional')}</span>
            </div>
            <div className={styles.count}>
              <span className={styles.countNum}>{imported.timeline}</span>
              <span className={styles.countLabel}>{t('import.timeline')}</span>
            </div>
            <div className={styles.count}>
              <span className={styles.countNum}>{imported.facts}</span>
              <span className={styles.countLabel}>{t('import.skills')}</span>
            </div>
          </div>
        </div>

        {/* AI comment */}
        <div className={styles.insightCard}>
          <div className={styles.insightHeader}>{t('import.aiComment')}</div>
          {previewLoading || !preview ? (
            <div className={styles.insightLoading}>
              <div className={styles.spinnerSmall} />
              <span>{t('import.analyzing')}</span>
            </div>
          ) : preview.comment ? (
            <p className={styles.insightText}>{preview.comment}</p>
          ) : (
            <p className={styles.insightEmpty}>{t('import.tooFewData')}</p>
          )}
        </div>

        {preview && preview.layers.length > 0 && (
          <div className={styles.layersSection}>
            <div className={styles.layersSectionTitle}>{t('import.contextCompleteness')}</div>
            <p className={styles.layersSectionDesc}>{t('import.contextDesc')}</p>
            {(['CORE', 'SHAPE', 'STATE'] as const).map(zone => {
              const zoneLayers = preview.layers.filter(l => l.zone === zone)
              if (zoneLayers.length === 0) return null
              const zoneDesc = t(`import.zones.${zone}`)
              return (
                <div key={zone} className={styles.layerZone}>
                  <div className={styles.layerZoneLabel}>{zone} <span className={styles.layerZoneDesc}>{zoneDesc}</span></div>
                  {zoneLayers.map(layer => (
                    <div key={layer.id} className={styles.layerRow}>
                      <span className={styles.layerId}>{layer.id}</span>
                      <span className={styles.layerName}>{layer.name}</span>
                      <div className={styles.layerBarWrap}>
                        <div
                          className={`${styles.layerBar} ${layer.count > 0 ? styles.layerBarFilled : ''}`}
                          style={{ width: `${Math.min(layer.percent, 100)}%` }}
                        />
                      </div>
                      <span className={`${styles.layerCount} ${layer.count === 0 ? styles.layerCountLocked : ''}`}>
                        {layer.count > 0 ? t('import.countItems', { count: layer.count }) : t('import.locked')}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* B: life_chapters.md collapsible */}
        {preview && preview.lifeChaptersMd && !preview.lifeChaptersMd.includes('No context') && (
          <div className={styles.profileSection}>
            <button
              className={styles.profileToggle}
              onClick={() => setProfileOpen(o => !o)}
            >
              <span>life_chapters.md</span>
              <span className={styles.profileToggleIcon}>{profileOpen ? '▲' : '▼'}</span>
            </button>
            {profileOpen && (
              <pre className={styles.profileContent}>{preview.lifeChaptersMd}</pre>
            )}
          </div>
        )}

        <button className={styles.primaryBtn} onClick={onComplete}>
          {t('import.toInterview')}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>{t('import.uploadHeading')}</h3>
      <p className={styles.desc}>{t('import.uploadDesc')}</p>

      <div
        className={`${styles.dropzone} ${dragging ? styles.dropzoneDragging : ''} ${uploading ? styles.dropzoneUploading : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,.txt,.md"
          onChange={handleChange}
          className={styles.fileInput}
        />
        {uploading ? (
          <>
            <div className={styles.spinner} />
            <p className={styles.uploadingText}>{t('import.uploading')}</p>
          </>
        ) : (
          <>
            <p className={styles.dropzoneIcon}>📄</p>
            <p className={styles.dropzoneText} style={{ whiteSpace: 'pre-line' }}>{t('import.dropzone')}</p>
          </>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.skipBtn} onClick={onSkip}>
        {t('import.skip')}
      </button>
    </div>
  )
}
