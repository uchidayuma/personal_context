import { useState, useRef, useCallback } from 'react'
import type { ProgressData } from '../components/ProgressHeader.js'

export function useProgress() {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [savedNotice, setSavedNotice] = useState<number | null>(null)
  const prevTotalRef = useRef<number>(0)

  const refreshProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/progress')
      if (!res.ok) return
      const data = await res.json() as ProgressData
      const newTotal = (data.totals?.facts ?? 0) + (data.totals?.timeline ?? 0) + (data.totals?.vignettes ?? 0)
      const diff = newTotal - prevTotalRef.current
      if (diff > 0 && prevTotalRef.current > 0) {
        setSavedNotice(diff)
        setTimeout(() => setSavedNotice(null), 3000)
      }
      prevTotalRef.current = newTotal
      setProgress(data)
    } catch { /* ignore */ }
  }, [])

  return { progress, savedNotice, refreshProgress }
}
