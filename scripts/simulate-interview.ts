#!/usr/bin/env node
/**
 * Interview simulation script.
 * Runs a full session against the local API server using an LLM persona.
 *
 * Usage:
 *   pnpm simulate [onboarding|regular] [--claude|--deepseek] [persona-dir]
 *
 * Provider:
 *   --claude    Use local Claude Code CLI (default — uses subscription, no extra cost)
 *   --deepseek  Use DeepSeek API (requires DEEPSEEK_API_KEY)
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
const MODE = (['onboarding', 'regular'].includes(args[0]) ? args[0] : 'onboarding') as 'onboarding' | 'regular'
const PROVIDER: 'claude' | 'deepseek' = args.includes('--deepseek') ? 'deepseek' : 'claude'
const PERSONA_DIR = args.find(a => !a.startsWith('--') && a !== MODE)
  ?? join(homedir(), 'Dropbox/obsidian/escapejapan/input/context')

const API_BASE = process.env.API_BASE ?? 'http://localhost:3001'
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? ''
const DEEPSEEK_MODEL = process.env.LLM_MODEL ?? 'deepseek-chat'
const MAX_TURNS = 20

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
      model: DEEPSEEK_MODEL,
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

async function startSession(mode: 'onboarding' | 'regular'): Promise<{ sessionId: string; message: string }> {
  const url = mode === 'onboarding'
    ? `${API_BASE}/api/sessions/onboarding`
    : `${API_BASE}/api/sessions`
  const res = await fetch(url, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to start session: ${res.status} ${await res.text()}`)
  return res.json()
}

async function chat(sessionId: string, message: string): Promise<{ response: string; shouldEnd: boolean }> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  })
  if (!res.ok) throw new Error(`Chat error: ${res.status} ${await res.text()}`)
  return res.json()
}

async function fetchSummary() {
  const res = await fetch(`${API_BASE}/api/context-summary`)
  return res.json() as Promise<{
    facts: { category: string; fact: string }[]
    timeline: { year: number; month: number | null; description: string }[]
    vignette: { title: string; quote: string; scene: string } | null
  }>
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
  coach: (s: string) => console.log(`\n${CYAN}${B}[🤖 Coach]${R}\n${CYAN}${s}${R}`),
  user:  (s: string) => console.log(`\n${GREEN}${B}[👤 User]${R}\n${GREEN}${s}${R}`),
  info:  (s: string) => console.log(`\n${YELLOW}${DIM}${s}${R}`),
  hr:    ()          => console.log(`\n${'─'.repeat(60)}`),
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log.info(`Mode: ${MODE}  |  Provider: ${PROVIDER}  |  Persona: ${PERSONA_DIR}`)

  const persona = loadPersona()
  const loaded = PERSONA_FILES.filter(f => existsSync(join(PERSONA_DIR, f)))
  log.info(`Persona files: ${loaded.join(', ')}`)

  const session = await startSession(MODE)
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

  if (turns >= MAX_TURNS) log.info('Max turns reached.')

  log.info('Fetching extracted context...')
  if (MODE === 'regular') await new Promise(r => setTimeout(r, 3000))

  const summary = await fetchSummary()

  log.hr()
  console.log(`${B}EXTRACTED CONTEXT SUMMARY${R}`)
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
