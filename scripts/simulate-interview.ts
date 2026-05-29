#!/usr/bin/env node
/**
 * Interview simulation script.
 * Runs a full session against the local API server using an LLM persona.
 *
 * Usage:
 *   pnpm simulate [onboarding|regular] [options] [persona-dir]
 *
 * Provider for persona generation (user side):
 *   --claude     Use local Claude Code CLI (default — uses subscription, no extra cost)
 *   --deepseek   Use DeepSeek API (requires DEEPSEEK_API_KEY)
 *
 * Options:
 *   --turns N      Max conversation turns per session (default: 20)
 *   --sessions N   Number of sessions to run (default: 3)
 *
 * Env vars (persona generation only — separate from server's LLM_MODEL):
 *   SIMULATE_LLM_MODEL   Model for --deepseek persona (default: deepseek-chat)
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { spawnSync } from 'child_process'

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

loadEnv(join(process.cwd(), '.env'))

const args = process.argv.slice(2)
const PROVIDER: 'claude' | 'deepseek' = args.includes('--deepseek') ? 'deepseek' : 'claude'
const RESET_ONLY = args.includes('--reset-only')

const turnsArg = args.indexOf('--turns')
const MAX_TURNS = turnsArg >= 0 ? parseInt(args[turnsArg + 1] ?? '20', 10) : 20

const sessionsArg = args.indexOf('--sessions')
const SESSION_COUNT = sessionsArg >= 0 ? parseInt(args[sessionsArg + 1] ?? '3', 10) : 3

const PERSONA_DIR = args.find(a => !a.startsWith('--') && !['onboarding', 'regular'].includes(a) && !/^\d+$/.test(a))
  ?? join(homedir(), 'Dropbox/obsidian/escapejapan/input/context')

const API_BASE = process.env.API_BASE ?? 'http://localhost:3001'
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? ''
const SIMULATE_LLM_MODEL = process.env.SIMULATE_LLM_MODEL ?? 'deepseek-chat'

const SERVER_PROVIDER = process.env.LLM_PROVIDER ?? 'deepseek'
const SERVER_MODEL = process.env.LLM_MODEL ?? 'deepseek-chat'

function loadEnv(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const eq = line.indexOf('=')
    if (eq < 1 || line.trimStart().startsWith('#')) continue
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()
    process.env[key] ??= val
  }
}

// ---------------------------------------------------------------------------
// Persona loading
// ---------------------------------------------------------------------------

const PERSONA_FILES = [
  'プロフィール.md',
  '人生年表.md',
  '内面マップ.md',
  '好き・得意・価値観マップ.md',
]

function loadPersona(): string {
  const sections: string[] = []
  for (const file of PERSONA_FILES) {
    const path = join(PERSONA_DIR, file)
    if (existsSync(path)) {
      sections.push(`## ${file}\n\n${readFileSync(path, 'utf-8')}`)
    }
  }
  if (sections.length === 0) {
    throw new Error(`No persona files found in: ${PERSONA_DIR}`)
  }
  return sections.join('\n\n---\n\n')
}

// ---------------------------------------------------------------------------
// Persona response generation
// ---------------------------------------------------------------------------

type Turn = { role: 'coach' | 'user'; text: string }

function buildPersonaPrompt(history: Turn[], newCoachMessage: string, persona: string): string {
  const historyText = history
    .map(t => `${t.role === 'coach' ? 'インタビュアー' : 'あなた'}：${t.text}`)
    .join('\n')

  return `あなたは以下のプロフィールを持つ人物として、インタビューに自然に答えてください。

${persona}

## 回答のルール
- 文書を「読む」のではなく、その場で思い出しながら話すトーンで
- 100〜250文字程度の自然な口語
- 感情や身体感覚を交えると自然（「あの頃は本当につらかった」「なぜかその瞬間だけ妙に軽かった」など）
- プロフィール外のことは「そこはまだ整理できていないんですよね」などとかわす
- 日本語で答える
- 回答だけを出力する（前置きや説明は不要）

${historyText ? `## これまでの会話\n${historyText}\n\n` : ''}インタビュアー：${newCoachMessage}
あなた：`
}

function generateWithClaude(prompt: string): string {
  const result = spawnSync('claude', ['-p', prompt], {
    encoding: 'utf-8',
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
  })
  if (result.error) throw new Error(`claude CLI error: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`claude exited ${result.status}: ${result.stderr}`)
  return result.stdout.trim()
}

async function generateWithDeepSeek(prompt: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is not set')
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: SIMULATE_LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.8,
    }),
  })
  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices[0].message.content.trim()
}

async function generatePersonaResponse(history: Turn[], coachMessage: string, persona: string): Promise<string> {
  const prompt = buildPersonaPrompt(history, coachMessage, persona)
  return PROVIDER === 'claude'
    ? generateWithClaude(prompt)
    : generateWithDeepSeek(prompt)
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const SIM_HEADERS = { 'X-Simulate': 'true', 'Connection': 'close' }

async function resetSimulate() {
  const res = await fetch(`${API_BASE}/api/simulate`, { method: 'DELETE', headers: SIM_HEADERS })
  if (!res.ok) throw new Error(`Failed to reset simulate data: ${res.status} ${await res.text()}`)
}

async function startSession(mode: 'onboarding' | 'regular'): Promise<{ sessionId: string; message: string }> {
  const url = mode === 'onboarding'
    ? `${API_BASE}/api/sessions/onboarding`
    : `${API_BASE}/api/sessions`
  const res = await fetch(url, { method: 'POST', headers: SIM_HEADERS })
  if (!res.ok) throw new Error(`Failed to start session: ${res.status} ${await res.text()}`)
  return res.json()
}

async function chat(sessionId: string, message: string): Promise<{ response: string; shouldEnd: boolean }> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...SIM_HEADERS },
    body: JSON.stringify({ sessionId, message }),
  })
  if (!res.ok) throw new Error(`Chat error: ${res.status} ${await res.text()}`)
  return res.json()
}

async function fetchSummary() {
  const res = await fetch(`${API_BASE}/api/context-summary`, { headers: SIM_HEADERS })
  return res.json() as Promise<{
    facts: { category: string; fact: string }[]
    timeline: { year: number; month: number | null; description: string }[]
    vignette: { title: string; quote: string; scene: string } | null
  }>
}

async function hasSimulateData(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/progress`, { headers: SIM_HEADERS })
  if (!res.ok) return false
  const data = await res.json() as { totals: { facts: number; timeline: number; professional: number; vignettes: number } }
  const { facts, timeline, professional, vignettes } = data.totals
  return facts + timeline + professional + vignettes > 0
}

// ---------------------------------------------------------------------------
// Terminal helpers
// ---------------------------------------------------------------------------

const R = '\x1b[0m'
const B = '\x1b[1m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'

const log = {
  coach: (s: string) => console.log(`\n${CYAN}${B}[Coach]${R}\n${CYAN}${s}${R}`),
  user:  (s: string) => console.log(`\n${GREEN}${B}[User]${R}\n${GREEN}${s}${R}`),
  info:  (s: string) => console.log(`\n${YELLOW}${DIM}${s}${R}`),
  hr:    ()          => console.log(`\n${'─'.repeat(60)}`),
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runSession(sessionNum: number, persona: string, firstMode: 'onboarding' | 'regular'): Promise<void> {
  log.hr()
  const sessionMode = sessionNum === 1 ? firstMode : 'regular'
  log.info(`Session ${sessionNum} / ${SESSION_COUNT}  [${sessionMode}]`)

  const session = await startSession(sessionMode)
  log.coach(session.message)

  const history: Turn[] = []
  let coachMessage = session.message
  let turns = 0

  while (turns < MAX_TURNS) {
    const userResponse = await generatePersonaResponse(history, coachMessage, persona)
    log.user(userResponse)
    history.push({ role: 'coach', text: coachMessage })
    history.push({ role: 'user', text: userResponse })

    const result = await chat(session.sessionId, userResponse)
    coachMessage = result.response
    log.coach(result.response)
    turns++

    if (result.shouldEnd) break
  }

  if (turns >= MAX_TURNS) log.info(`Max turns (${MAX_TURNS}) reached.`)
}

async function main() {
  if (RESET_ONLY) {
    log.info('Resetting simulate DB...')
    await resetSimulate()
    log.info('Done.')
    return
  }

  const personaProvider = PROVIDER === 'claude' ? 'claude CLI' : `deepseek (${SIMULATE_LLM_MODEL})`
  log.info(`Sessions: ${SESSION_COUNT}  |  Max turns/session: ${MAX_TURNS}`)
  log.info(`Persona (user side): ${personaProvider}`)
  log.info(`Server (coach side): ${SERVER_PROVIDER} / ${SERVER_MODEL}`)
  log.info(`Persona dir: ${PERSONA_DIR}`)

  const persona = loadPersona()
  const loaded = PERSONA_FILES.filter(f => existsSync(join(PERSONA_DIR, f)))
  log.info(`Persona files: ${loaded.join(', ')}`)

  const hasData = await hasSimulateData()
  const firstMode: 'onboarding' | 'regular' = hasData ? 'regular' : 'onboarding'
  log.info(`Simulate DB: ${hasData ? 'has existing data → all sessions=regular' : 'empty → session1=onboarding, 2+=regular'}`)

  for (let i = 1; i <= SESSION_COUNT; i++) {
    await runSession(i, persona, firstMode)
  }

  log.info('All sessions complete. Fetching extracted context...')
  await new Promise(r => setTimeout(r, 2000))

  const summary = await fetchSummary()

  log.hr()
  console.log(`${B}EXTRACTED CONTEXT SUMMARY (${SESSION_COUNT} sessions)${R}`)
  log.hr()

  if (summary.timeline.length > 0) {
    console.log(`\n${B}Life Timeline${R}`)
    for (const e of summary.timeline) {
      const period = e.month ? `${e.year}/${e.month}` : String(e.year)
      console.log(`  ${YELLOW}${period}${R}  ${e.description}`)
    }
  }

  if (summary.facts.length > 0) {
    console.log(`\n${B}Key Facts${R}`)
    for (const f of summary.facts) {
      console.log(`  ${CYAN}[${f.category}]${R}  ${f.fact}`)
    }
  }

  if (summary.vignette) {
    console.log(`\n${B}Vignette — ${summary.vignette.title}${R}`)
    console.log(`  ${DIM}"${summary.vignette.quote}"${R}`)
    console.log(`  ${summary.vignette.scene}`)
  }

  console.log('')
}

main().catch(err => { console.error(err); process.exit(1) })
