import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateObject, generateText } from 'ai'
import { z } from 'zod'
import { STRUCTURED_FACT_CATEGORIES } from '../db/schema.js'
import {
  buildCoachingToneInstruction,
  buildDocumentImportSystemPrompt,
  buildInsightsSystemPrompt,
  buildExtractionSystemPrompt,
} from './prompts.js'

export class ModelStructuredOutputError extends Error {
  readonly code = 'MODEL_NOT_SUPPORTED' as const
  constructor(modelId: string) {
    super(
      `Structured output failed for model "${modelId}" after retrying. ` +
      `If this keeps happening, ensure your LLM_MODEL supports structured output. ` +
      `Compatible models: deepseek-chat, gpt-4o, claude-3-haiku-*, etc. ` +
      `Known incompatible: deepseek-v4-flash.`,
    )
    this.name = 'ModelStructuredOutputError'
  }
}

async function wrapStructuredOutputError<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof Error && err.name === 'AI_NoObjectGeneratedError') {
        console.warn(`[LLM] generateObject failed (attempt ${attempt}):`, JSON.stringify({
          message: err.message,
          cause: (err as any).cause,
          text: (err as any).text,
        }, null, 2))
        if (attempt < 2) {
          continue
        }
        const modelId = process.env.LLM_MODEL ?? '(default)'
        throw new ModelStructuredOutputError(modelId)
      }
      throw err
    }
  }
  throw new Error('unreachable')
}

export function getLLM() {
  const provider = process.env.LLM_PROVIDER ?? 'deepseek'
  const model = process.env.LLM_MODEL

  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(model ?? 'gpt-4o-mini')

    case 'anthropic':
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(model ?? 'claude-haiku-4-5-20251001')

    case 'ollama':
      // Ollama の OpenAI 互換エンドポイントを使用
      return createOpenAI({
        baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
        apiKey: 'ollama',
      })(model ?? 'llama3.2')

    default: // deepseek — use OpenAI-compatible endpoint for reliable generateObject (tool mode)
      return createOpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1',
      })(model ?? 'deepseek-chat')
  }
}

const InterviewResponseSchema = z.object({
  response: z.string().describe('Response to the user in their language, warm coaching tone'),
  askedFollowup: z.boolean().describe('Whether this response asks a follow-up question'),
  shouldEndSession: z.boolean().describe('Whether the session should end'),
})

export type InterviewResponse = z.infer<typeof InterviewResponseSchema>

// DeepSeek sometimes encodes boolean fields as DSML tags instead of JSON.
// Pattern: </string>\n<｜｜DSML｜｜parameter name="askedFollowup" string="false">false
function recoverFromDSML(partial: unknown): InterviewResponse | null {
  if (!partial || typeof partial !== 'object') return null
  const p = partial as Record<string, unknown>
  if (typeof p.response !== 'string') return null

  const splitAt = p.response.indexOf('</string>')
  const cleanResponse = (splitAt >= 0 ? p.response.slice(0, splitAt) : p.response).trim()
  if (!cleanResponse) return null

  const dsmlTail = splitAt >= 0 ? p.response.slice(splitAt) : ''
  const dsmlBooleans: Record<string, boolean> = {}
  const dsmlRe = /<[^>]*parameter name="(\w+)" string="(true|false)">/g
  let m: RegExpExecArray | null
  while ((m = dsmlRe.exec(dsmlTail)) !== null) {
    dsmlBooleans[m[1]] = m[2] === 'true'
  }

  return {
    response: cleanResponse,
    askedFollowup: typeof p.askedFollowup === 'boolean' ? p.askedFollowup : (dsmlBooleans.askedFollowup ?? false),
    shouldEndSession: typeof p.shouldEndSession === 'boolean' ? p.shouldEndSession : (dsmlBooleans.shouldEndSession ?? false),
  }
}

export async function generateInterviewResponse(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<InterviewResponse> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: getLLM(),
        schema: InterviewResponseSchema,
        abortSignal: AbortSignal.timeout(60_000),
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      })
      return object
    } catch (err) {
      if (!(err instanceof Error) || err.name !== 'AI_NoObjectGeneratedError') throw err
      console.warn(`[LLM] generateInterviewResponse failed (attempt ${attempt}):`, JSON.stringify({
        message: err.message,
        cause: (err as any).cause,
        text: (err as any).text,
      }, null, 2))
      const recovered = recoverFromDSML((err as any).cause?.value)
      if (recovered) {
        console.warn('[LLM] Recovered interview response from DSML output')
        return recovered
      }
      if (attempt < 2) continue
      throw new ModelStructuredOutputError(process.env.LLM_MODEL ?? '(default)')
    }
  }
  throw new Error('unreachable')
}

export async function transformToCoachingTone(
  question: string,
  existingContext: string,
  language: string,
): Promise<string> {
  const { text } = await generateText({
    model: getLLM(),
    abortSignal: AbortSignal.timeout(60_000),
    messages: [
      { role: 'system', content: buildCoachingToneInstruction(existingContext, language) },
      { role: 'user', content: question },
    ],
  })
  return text
}

const ExtractionSchema = z.object({
  facts: z.array(z.object({
    category: z.enum([
      'childhood', 'education', 'career', 'values', 'goals', 'skills',
      'life_events', 'relationships',
      'character',     // NEW: 気質・性格
      'opinions',      // NEW: 意見・スタンス
      'fears',         // NEW: 恐れ・回避パターン
      'patterns',      // NEW: 繰り返す癖
      'preferences',   // NEW: 好み・スタイル
    ]).describe('カテゴリ'),
    subcategory: z.string().optional().describe('カテゴリ内のセクション（後述のリストから選ぶ）'),
    fact: z.string().describe('1文の事実記述'),
    confidence_score: z.number().min(0).max(1),
    visibility: z.enum(['public', 'private']),
  })),
  timeline: z.array(z.object({
    event_year: z.number().nullable(),
    event_month: z.number().nullable(),
    age_at_event: z.number().nullable(),
    event_description: z.string(),
    visibility: z.enum(['public', 'private']),
  })),
  vignettes: z.array(z.object({
    title: z.string().describe('Short scene title, 5-10 words'),
    period: z.string().describe('When this happened, e.g. "2022-03" or "2019". Use "unknown" if not mentioned.'),
    quote: z.string().describe('1-2 sentences quoted directly from the [user] lines in the conversation. Must be their actual words.'),
    scene: z.string().describe('3-5 sentences: what happened, what was chosen or avoided, how they acted'),
    insight: z.string().describe('One assertive sentence revealing a behavioral pattern or value'),
    self_gap: z.string().nullable().describe('If there is a gap between stated self-image and actual behavior, describe it in one sentence. Otherwise null.'),
  })).describe('0-3 vignettes per session. Only extract scenes where the person\'s character genuinely becomes visible. Quality over quantity.'),
})

export type ExtractionResult = z.infer<typeof ExtractionSchema>

const DocumentImportSchema = z.object({
  timeline: z.array(z.object({
    year: z.number().int(),
    month: z.number().int().nullable(),
    description: z.string(),
  })),
  professional: z.array(z.object({
    companyName: z.string(),
    role: z.string().nullable(),
    startYear: z.number().int(),
    startMonth: z.number().int().nullable(),
    endYear: z.number().int().nullable(),
    endMonth: z.number().int().nullable(),
    description: z.string().nullable(),
    skills: z.array(z.string()),
  })),
  facts: z.array(z.object({
    category: z.enum(STRUCTURED_FACT_CATEGORIES),
    subcategory: z.string().optional(),
    fact: z.string(),
  })),
})

export type DocumentImportResult = z.infer<typeof DocumentImportSchema>

export async function extractFromDocument(text: string, language = 'ja'): Promise<DocumentImportResult> {
  const { object } = await wrapStructuredOutputError(() => generateObject({
    model: getLLM(),
    schema: DocumentImportSchema,
    abortSignal: AbortSignal.timeout(60_000),
    messages: [
      { role: 'system', content: buildDocumentImportSystemPrompt(language) },
      { role: 'user', content: text.slice(0, 8000) },
    ],
  }))
  return object
}

export async function generateInsights(
  facts: { category: string; fact: string }[],
  timeline: { year: number; description: string }[],
  language: string = 'ja',
): Promise<string> {
  const parts = [
    facts.length > 0
      ? `## Facts\n${facts.map(f => `[${f.category}] ${f.fact}`).join('\n')}`
      : '',
    timeline.length > 0
      ? `## Timeline\n${timeline.map(t => `${t.year}: ${t.description}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n')

  const { text } = await generateText({
    model: getLLM(),
    abortSignal: AbortSignal.timeout(60_000),
    messages: [
      { role: 'system', content: buildInsightsSystemPrompt(language) },
      { role: 'user', content: parts },
    ],
  })
  return text.trim()
}

export async function extractFactsFromConversation(
  conversation: string,
  language = 'ja',
): Promise<ExtractionResult> {
  const { object } = await wrapStructuredOutputError(() => generateObject({
    model: getLLM(),
    schema: ExtractionSchema,
    abortSignal: AbortSignal.timeout(60_000),
    messages: [
      { role: 'system', content: buildExtractionSystemPrompt(language) },
      { role: 'user', content: conversation },
    ],
  }))
  return object
}
