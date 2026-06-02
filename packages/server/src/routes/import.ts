import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import { createRequire } from 'module'
import { eq, and, sql, isNull } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { extractFromDocument, ModelStructuredOutputError } from '../llm/provider.js'
import { getUserLanguage } from '../db/client.js'
import type { AppVariables } from '../types.js'

// pdf-parse and xlsx are CJS modules; use createRequire for ESM compatibility
const require = createRequire(import.meta.url)

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.xlsx', '.xls', '.csv', '.txt', '.md'])
const SIZE_LIMIT = 5 * 1024 * 1024 // 5MB

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')

  if (ext === '.pdf') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const data = await pdfParse(buffer)
    return data.text
  }

  if (ext === '.xlsx' || ext === '.xls') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const XLSX = require('xlsx') as any
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const lines: string[] = []
    for (const sheetName of wb.SheetNames as string[]) {
      lines.push(XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]))
    }
    return lines.join('\n')
  }

  return buffer.toString('utf-8')
}

export const importRoute = new Hono<{ Variables: AppVariables }>()

importRoute.post('/', async (c) => {
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'invalid form data' }, 400)
  }

  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'no file provided' }, 400)
  if (file.size > SIZE_LIMIT) return c.json({ error: 'file too large (max 5MB)' }, 400)

  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return c.json({ error: `unsupported file type: ${ext}` }, 400)
  }

  let text: string
  try {
    text = await extractText(file)
  } catch (err) {
    return c.json({ error: `parse failed: ${(err as Error).message}` }, 400)
  }

  if (!text.trim()) return c.json({ error: 'no text could be extracted from this file' }, 400)

  const db = c.get('db')
  const userId = c.get('userId')
  const language = await getUserLanguage(db, userId)

  let result: Awaited<ReturnType<typeof extractFromDocument>>
  try {
    result = await extractFromDocument(text, language)
  } catch (err) {
    if (err instanceof ModelStructuredOutputError) {
      return c.json({ error: err.message, code: err.code }, 422)
    }
    throw err
  }

  const imported = { timeline: 0, professional: 0, facts: 0 }

  await db.transaction(async (tx) => {
    // Replace-on-reimport: clear previous import data before inserting new records
    await Promise.all([
      tx.delete(schema.lifeTimeline).where(and(eq(schema.lifeTimeline.userId, userId), eq(schema.lifeTimeline.source, 'import'))),
      tx.delete(schema.professionalRecords).where(and(eq(schema.professionalRecords.userId, userId), eq(schema.professionalRecords.source, 'import'))),
      tx.delete(schema.structuredFacts).where(and(eq(schema.structuredFacts.userId, userId), eq(schema.structuredFacts.source, 'import'))),
    ])

    if (result.timeline.length > 0) {
      await tx.insert(schema.lifeTimeline).values(
        result.timeline.map(event => ({
          id: randomUUID(),
          userId,
          eventYear: event.year,
          eventMonth: event.month,
          eventDescription: event.description,
          visibility: 'private' as const,
          source: 'import' as const,
        }))
      )
      imported.timeline = result.timeline.length
    }

    if (result.professional.length > 0) {
      await tx.insert(schema.professionalRecords).values(
        result.professional.map(job => ({
          id: randomUUID(),
          userId,
          companyName: job.companyName,
          role: job.role,
          startYear: job.startYear,
          startMonth: job.startMonth,
          endYear: job.endYear,
          endMonth: job.endMonth,
          description: job.description,
          skills: JSON.stringify(job.skills),
          source: 'import' as const,
        }))
      )
      imported.professional = result.professional.length
    }

    if (result.facts.length > 0) {
      await tx.insert(schema.structuredFacts).values(
        result.facts.map(fact => ({
          id: randomUUID(),
          userId,
          category: fact.category,
          subcategory: fact.subcategory ?? null,
          fact: fact.fact,
          confidenceScore: 0.7,
          visibility: 'private' as const,
          source: 'import' as const,
        }))
      )
      imported.facts = result.facts.length
    }

    // インポート成功 = オンボーディング完了扱い
    await tx.update(schema.users)
      .set({ onboardingCompletedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(schema.users.id, userId), isNull(schema.users.onboardingCompletedAt)))
  })

  return c.json({
    imported,
    preview: {
      timeline: result.timeline,
      professional: result.professional.map(p => ({
        companyName: p.companyName,
        role: p.role,
        startYear: p.startYear,
        endYear: p.endYear,
      })),
      facts: result.facts,
    },
  })
})
