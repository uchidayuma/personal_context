import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardAction, CardContent, CardFooter } from '@/components/ui/card'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

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

const ZONE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  CORE: 'default',
  SHAPE: 'secondary',
  STATE: 'outline',
}

const ZONES: Array<'CORE' | 'SHAPE' | 'STATE'> = ['CORE', 'SHAPE', 'STATE']

export default function ContextDashboard({ onStartInterview }: Props) {
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
        setProgress(await progressRes.json() as ProgressData)
        setSummary(await summaryRes.json() as ContextSummary)
      } catch {
        // leave null — show empty state
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const sortedTimeline = summary
    ? [...summary.timeline].sort((a, b) => a.year !== b.year ? a.year - b.year : (a.month ?? 0) - (b.month ?? 0))
    : []

  const groupedFacts: Record<string, { category: string; fact: string }[]> = {}
  if (summary) {
    for (const f of summary.facts) {
      if (!groupedFacts[f.category]) groupedFacts[f.category] = []
      groupedFacts[f.category].push(f)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl w-full mx-auto flex flex-col gap-6 pb-12">
        <Card>
          <CardHeader className="border-b">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-16" />
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  const overall = progress ? Math.round(progress.overall) : 0

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col gap-6 pb-12">

      {/* Section 1: Progress */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-semibold text-muted-foreground tracking-wide">
            コンテキスト充足度
          </CardTitle>
          <CardAction>
            <span className="text-4xl font-bold tabular-nums">{overall}</span>
            <span className="text-lg font-semibold text-muted-foreground">%</span>
          </CardAction>
        </CardHeader>

        <CardContent className="pt-5 flex flex-col gap-6">
          {ZONES.map(zone => {
            const layers = progress ? progress.layers.filter(l => l.zone === zone) : []
            return (
              <div key={zone}>
                <Badge variant={ZONE_BADGE_VARIANT[zone]} className="mb-3">
                  {zone}
                </Badge>
                <div className="flex flex-col gap-3">
                  {layers.map(layer => (
                    <Progress key={layer.id} value={Math.min(layer.percent, 100)}>
                      <ProgressLabel>
                        <span className="text-muted-foreground mr-1.5">{layer.id}</span>
                        {layer.name}
                      </ProgressLabel>
                      <ProgressValue>{layer.count}/{layer.threshold}</ProgressValue>
                    </Progress>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>

        <CardFooter className="border-t pt-4">
          <Button onClick={onStartInterview} className="w-full">
            インタビューを続ける
          </Button>
        </CardFooter>
      </Card>

      {/* Section 2: Collected data */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-semibold text-muted-foreground tracking-wide">
            収集済みデータ
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-5 flex flex-col gap-8">

          {/* Timeline */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold tracking-widest text-muted-foreground">LIFE TIMELINE</span>
              {progress && (
                <Badge variant="outline">{progress.totals.timeline}件</Badge>
              )}
            </div>
            {sortedTimeline.length === 0 ? (
              <p className="text-xs text-muted-foreground">まだデータがありません</p>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedTimeline.map((e, i) => (
                  <div key={i} className="flex gap-3 items-baseline">
                    <span className="text-xs tabular-nums text-muted-foreground w-14 shrink-0">
                      {e.year}{e.month ? `/${e.month}` : ''}
                    </span>
                    <span className="text-xs leading-relaxed">{e.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Facts */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold tracking-widest text-muted-foreground">KEY FACTS</span>
              {progress && (
                <Badge variant="outline">{progress.totals.facts}件</Badge>
              )}
            </div>
            {Object.keys(groupedFacts).length === 0 ? (
              <p className="text-xs text-muted-foreground">まだデータがありません</p>
            ) : (
              <div className="flex flex-col gap-2">
                {Object.entries(groupedFacts).map(([, facts]) =>
                  facts.map((f, i) => (
                    <div key={i} className="flex gap-3 items-baseline">
                      <Badge variant="secondary" className="shrink-0">{f.category}</Badge>
                      <span className="text-xs leading-relaxed">{f.fact}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </CardContent>
      </Card>

    </div>
  )
}
