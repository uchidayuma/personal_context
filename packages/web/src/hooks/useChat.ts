import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const SESSION_KEY = 'chat_session'

export type Message = { role: 'assistant' | 'user'; content: string }
export type SessionSummary = { facts: Record<string, number>; timeline: number; vignettes: string[] }

export function useChat(refreshProgress: () => Promise<void>) {
  const { i18n } = useTranslation()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ended, setEnded] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)
  const [rateLimitHit, setRateLimitHit] = useState(false)
  const [remainingTurns, setRemainingTurns] = useState<number | null>(null)
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { sessionId: string; messages: Message[]; ended: boolean }
        setSessionId(parsed.sessionId)
        setMessages(parsed.messages)
        setEnded(parsed.ended)
      } catch {
        startSession()
      }
    } else {
      startSession()
    }
    refreshProgress()
  }, [])

  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ sessionId, messages, ended }))
    }
  }, [sessionId, messages, ended])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function startSession() {
    setLoading(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: i18n.language }),
      })
      if (res.status === 429) { setRateLimitHit(true); return }
      const data = await res.json() as { sessionId: string; message: string }
      setSessionId(data.sessionId)
      setMessages([{ role: 'assistant', content: data.message }])
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage(language?: string) {
    if (!input.trim() || !sessionId || loading || ended) return
    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMessage, language }),
      })
      const data = await res.json() as { response?: string; shouldEnd?: boolean; remainingTurns?: number | null; summary?: SessionSummary; error?: string; code?: string }
      if (!res.ok) {
        if (data.code === 'MODEL_NOT_SUPPORTED') setModelError(data.error ?? 'Model does not support structured output.')
        setMessages(prev => [...prev, { role: 'assistant', content: '...' }])
        return
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.response! }])
      if (data.shouldEnd) {
        setEnded(true)
        if (data.summary) {
          setSessionSummary(data.summary)
        } else {
          await fetchEndSummary(sessionId)
        }
      }
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
    await fetchEndSummary(sessionId)
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
    } finally {
      setLoading(false)
    }
  }

  function resetSession() {
    sessionStorage.removeItem(SESSION_KEY)
    setEnded(false)
    setMessages([])
    setSessionId(null)
    setRemainingTurns(null)
    setSessionSummary(null)
    startSession()
  }

  async function fetchEndSummary(sid: string) {
    try {
      const res = await fetch(`/api/sessions/${sid}/end`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as { ok: boolean; summary?: SessionSummary }
        if (data.summary) setSessionSummary(data.summary)
      }
    } catch (err) {
      console.error('[end] failed:', err)
    }
  }

  const lastCoachMessage = [...messages].reverse().find(m => m.role === 'assistant')?.content ?? ''

  function addMessages(userMsg: string, coachMsg: string) {
    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMsg },
      { role: 'assistant', content: coachMsg },
    ])
  }

  return {
    sessionId, messages, input, setInput,
    loading, ended, setEnded, voiceMode, setVoiceMode,
    modelError, rateLimitHit, remainingTurns, sessionSummary,
    bottomRef, lastCoachMessage,
    startSession, sendMessage, endSessionNow, skipQuestion, resetSession, addMessages,
  }
}
