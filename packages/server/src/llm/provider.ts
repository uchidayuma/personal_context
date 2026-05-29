import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateObject, generateText } from 'ai'
import { z } from 'zod'
import { STRUCTURED_FACT_CATEGORIES } from '../db/schema.js'

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
  const instruction = language === 'en'
    ? `You are a warm, empathetic life coach. Transform the given question into a natural, conversational coaching style in English. Known context about the user: ${existingContext || 'none'}. Output only the transformed question.`
    : `あなたは温かく共感力のあるライフコーチです。与えられた質問を自然で親しみやすいコーチングスタイルに変換してください。ユーザーの既知情報: ${existingContext || 'なし'}。変換後の質問のみを出力してください。`

  const { text } = await generateText({
    model: getLLM(),
    abortSignal: AbortSignal.timeout(60_000),
    messages: [
      { role: 'system', content: instruction },
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
    fact: z.string(),
  })),
})

export type DocumentImportResult = z.infer<typeof DocumentImportSchema>

export async function extractFromDocument(text: string): Promise<DocumentImportResult> {
  const { object } = await wrapStructuredOutputError(() => generateObject({
    model: getLLM(),
    schema: DocumentImportSchema,
    abortSignal: AbortSignal.timeout(60_000),
    messages: [
      {
        role: 'system',
        content: `文書からコンテキスト情報を抽出してください。文書に明示されていない情報は推測しないでください。

## 抽出対象
1. timeline: 年単位のライフイベント（入社・退社・転居・進学・卒業など）
2. professional: 職務詳細（会社名・役職・在籍期間・仕事内容・スキル）
3. facts: その人に関する重要な事実（スキル・資格・使用技術など）

## ルール
- 文書に明記されていないことは書かない
- 同じ職歴をtimelineとprofessionalに重複して含めてよい
- skillsは短い単語の配列（例: ["React", "TypeScript", "AWS"]）
- 日付情報がない場合はnullを使う`,
      },
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
      {
        role: 'system',
        content: language === 'en'
          ? `You are a warm life coach seeing a client's career data for the first time. Write 2 sentences: one highlighting a specific strength or interesting pattern you notice, one inviting them to share more through an interview so you can understand the person behind the career. Be genuine and specific — reference actual details from the data. No negative labels, no flattery. Output only the comment, no preamble.`
          : `あなたは温かいライフコーチです。クライアントのキャリアデータを初めて見ました。2文で書いてください：①データの中で具体的に興味深いと思ったこと・強みを1つ（データの言葉を使って具体的に）、②インタビューでその人の内側をもっと知りたいという招待。ネガティブなラベル付け・空虚な称賛は禁止。コメント本文のみ出力、前置き不要。`,
      },
      { role: 'user', content: parts },
    ],
  })
  return text.trim()
}

const EXTRACTION_SYSTEM_PROMPT = `You are analyzing an interview conversation to extract structured information.
Lines are labeled [assistant] (interviewer) and [user] (interviewee).

## カテゴリ定義と抽出ルール

### facts（構造化ファクト）

各カテゴリの定義と、何を抽出するかの判断基準:

**childhood / education / career / life_events**
通常の事実記述。明示的に語られた客観的事実のみ。推測しない。

**values（L1: 価値観・信念）**
「何を大切にしているか」「何は絶対に曲げないか」
例: "自律的に働けない環境には対価関係なく入らない"

**character（L2: 気質・性格）**
生まれ持った傾向として読み取れるもの。「いつもそうなる」「昔からそうだった」という文脈で語られるもの。
例: "議論になると相手の立場に立って考えすぎて自分の意見を引っ込めることが多い"
※ visibility は 'private' 固定

**relationships（L5: 関係性）**
具体的な人物名・関係性の事実。合う人・合わない人のパターン。
例: "毎朝マイクロマネジメントしてくる上司には体が反応して出社できなくなった"

**opinions（L6: 意見・スタンス）**
技術・社会・ビジネス・働き方に対する具体的な立場。「過大評価」「間違っている」「好きではない」といった評価的な発言。
例: "アジャイルという言葉は便利に使われすぎで実態は単なるスプリント会議だと思っている"

**fears（L7: 恐れ・回避）**
重要: ユーザーが「怖い」「不安」と言わなくても、以下から逆算して抽出する:
- 「そこには行かなかった」「それは断った」という選択の理由に、損失回避・リスク回避が見える場合
- 「〜になりたくなかった」「〜だけは嫌だった」という否定形の動機
- 「気づいたら避けていた」「なんとなく近づかない」という無意識の回避行動
直接的な恐怖表明がない場合でも、行動パターンから読み取れれば抽出する。
※ visibility は 'private' 固定

**patterns（L8: 繰り返す癖）**
重要: 「繰り返す」という証拠が会話に含まれている場合のみ抽出する:
- 「前の職場でも同じだった」「またやってしまった」「いつも最後は〜になる」
- 複数の文脈で同じ行動が語られる場合（異なる仕事・関係性で同じパターン）
単発の行動をパターンと呼ばない。
※ visibility は 'private' 固定

**goals（L9: 目標・方向感）**
今取り組んでいること、向かっていること、離れようとしていること。
例: "今年中に副業の月収を30万円にする"

**preferences（L10: 好み・スタイル）**
作業スタイル、コミュニケーションのトーン好み、好きなもの・嫌いなものの傾向。
例: "仕様書より動くプロトタイプを先に見せてもらう方が理解が早い"

---

## visibility の判断基準

**public**: キャリア・スキル・目標など、第三者に見せても問題ない情報
**private**: 恐れ・性格の癖・否定的評価・回避パターンなど、本人以外には不要な情報

カテゴリ別のデフォルト:
- character → private
- fears → private
- patterns → private
- opinions → private（対外的に問題になり得る評価が多い）
- relationships → private（個人名が含まれる）
- それ以外 → 内容によって判断

---

## timeline
年が特定できる具体的なライフイベントのみ。facts と重複してよい。

## vignettes
会話の中で「その人の本質」が具体的な行動として現れた場面。
facts の補完ではなく、行動の痕跡を物語として記録する。
抽出ルールは既存の定義を踏襲する（0-3件、quality over quantity）。

---

## 抽出の鉄則
1. ユーザーが明示的に語ったことのみ。LLMの推測・補完は厳禁。
2. 1つのファクトは1文。複数の事実を1つのファクトに詰め込まない。
3. 会話の言語（日本語/英語）と同じ言語でファクトを書く。`

export async function extractFactsFromConversation(
  conversation: string,
): Promise<ExtractionResult> {
  const { object } = await wrapStructuredOutputError(() => generateObject({
    model: getLLM(),
    schema: ExtractionSchema,
    abortSignal: AbortSignal.timeout(60_000),
    messages: [
      {
        role: 'system',
        content: EXTRACTION_SYSTEM_PROMPT,
      },
      { role: 'user', content: conversation },
    ],
  }))
  return object
}
