import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { structuredFacts, lifeTimeline, sessionVignettes, professionalRecords, users } from '../db/schema.js'

export interface ExportFiles {
  index: string
  l01Values: string
  l02Character: string
  l03LifeTimeline: string
  l04Professional: string
  l05Relationships: string
  l06Opinions: string
  l07Fears: string | null
  l08Patterns: string | null
  l09Goals: string
  l10Preferences: string
  lifeChapters: string
}

export async function exportToMarkdown(
  userId: string,
  includePrivate = false,
): Promise<ExportFiles> {
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  const userName = user?.name ?? 'Unknown'
  const now = new Date().toISOString().split('T')[0]

  const visFilter = includePrivate ? undefined : eq(structuredFacts.visibility, 'public')
  const tlFilter = includePrivate ? undefined : eq(lifeTimeline.visibility, 'public')
  const vgFilter = includePrivate ? undefined : eq(sessionVignettes.visibility, 'public')

  const [facts, timeline, vignettes, profRecords] = await Promise.all([
    db.select().from(structuredFacts)
      .where(and(eq(structuredFacts.userId, userId), visFilter))
      .orderBy(asc(structuredFacts.createdAt)),
    db.select().from(lifeTimeline)
      .where(and(eq(lifeTimeline.userId, userId), tlFilter))
      .orderBy(asc(lifeTimeline.eventYear), asc(lifeTimeline.eventMonth)),
    db.select().from(sessionVignettes)
      .where(and(eq(sessionVignettes.userId, userId), vgFilter))
      .orderBy(asc(sessionVignettes.createdAt)),
    db.select().from(professionalRecords)
      .where(eq(professionalRecords.userId, userId))
      .orderBy(asc(professionalRecords.startYear)),
  ])

  const byCategory = facts.reduce<Record<string, typeof facts>>((acc, f) => {
    acc[f.category] ??= []
    acc[f.category].push(f)
    return acc
  }, {})

  const factsFor = (category: string) => byCategory[category] ?? []

  return {
    index: buildIndex(userName, now, includePrivate),
    l01Values: buildFactLayer('L1: Values & Beliefs（価値観・信念）', 'CORE', factsFor('values')),
    l02Character: buildFactLayer('L2: Character & Talent（気質・才能）', 'CORE', factsFor('character')),
    l03LifeTimeline: buildLifeTimeline(
      timeline,
      [...factsFor('childhood'), ...factsFor('life_events')],
    ),
    l04Professional: buildProfessional(
      profRecords,
      [...factsFor('career'), ...factsFor('education'), ...factsFor('skills')],
    ),
    l05Relationships: buildFactLayer('L5: Relationships（人間関係）', 'SHAPE', factsFor('relationships')),
    l06Opinions: buildFactLayer('L6: Opinions & Stance（意見・スタンス）', 'SHAPE', factsFor('opinions')),
    l07Fears: includePrivate
      ? buildFactLayer('L7: Fears & Avoidances（恐れ・回避）', 'SHAPE', factsFor('fears'))
      : null,
    l08Patterns: includePrivate
      ? buildFactLayer('L8: Recurring Patterns（繰り返す癖）', 'SHAPE', factsFor('patterns'))
      : null,
    l09Goals: buildFactLayer('L9: Goals & Direction（目標・方向感）', 'STATE', factsFor('goals')),
    l10Preferences: buildFactLayer('L10: Preferences & Style（好み・スタイル）', 'STATE', factsFor('preferences')),
    lifeChapters: buildLifeChapters(vignettes),
  }
}

function buildIndex(userName: string, date: string, includePrivate: boolean): string {
  const visibility = includePrivate ? 'private (full)' : 'public'
  return `# Personal Context Index

> Subject: ${userName}
> Generated: ${date}
> Visibility: ${visibility}

## How to use this context

This file set is the structured knowledge base of ${userName}.
It was built through a series of interview sessions.

**Reading priority:**
1. \`life_chapters.md\` — Behavioral scenes. Read first; each scene reveals more than any self-reported value.
2. \`L01_values.md\` + \`L02_character.md\` — Core identity (CORE zone, always load).
3. SHAPE files (L03–L08) — Load selectively by topic.
4. STATE files (L09–L10) — Inject per task for current context.

**Interpretation rule:** Prioritize what they *did* over what they *said they value*. The gap is the most important signal.

## Files

| File | Zone | Content |
|---|---|---|
| \`_index.md\` | — | This file |
| \`life_chapters.md\` | CORE | Behavioral scenes (Vignettes) |
| \`L01_values.md\` | CORE | Values & beliefs |
| \`L02_character.md\` | CORE | Character & talent |
| \`L03_life_timeline.md\` | SHAPE | Life history & timeline |
| \`L04_professional.md\` | SHAPE | Career & skills |
| \`L05_relationships.md\` | SHAPE | Key relationships |
| \`L06_opinions.md\` | SHAPE | Opinions & stances |
| \`L07_fears.md\` | SHAPE | Fears & avoidances (private) |
| \`L08_patterns.md\` | SHAPE | Recurring patterns (private) |
| \`L09_goals.md\` | STATE | Current goals & direction |
| \`L10_preferences.md\` | STATE | Communication & work style |
`
}

function buildFactLayer(
  title: string,
  zone: string,
  facts: (typeof structuredFacts.$inferSelect)[],
): string {
  const lines: string[] = [`# ${title}\n`, `> Zone: **${zone}**\n`]

  if (facts.length === 0) {
    lines.push('*No data collected yet.*\n')
    return lines.join('\n')
  }

  lines.push('## 収集された情報\n')
  for (const f of facts) {
    lines.push(`- ${f.fact}`)
  }
  lines.push('')

  return lines.join('\n')
}

function buildLifeTimeline(
  timeline: (typeof lifeTimeline.$inferSelect)[],
  earlyFacts: (typeof structuredFacts.$inferSelect)[],
): string {
  const lines: string[] = ['# L3: Life Timeline（人生年表）\n', '> Zone: **SHAPE**\n']

  if (timeline.length === 0 && earlyFacts.length === 0) {
    lines.push('*No data collected yet.*\n')
    return lines.join('\n')
  }

  if (timeline.length > 0) {
    lines.push('## 年表\n')
    for (const event of timeline) {
      const dateStr = event.eventMonth
        ? `${event.eventYear}/${String(event.eventMonth).padStart(2, '0')}`
        : String(event.eventYear)
      const ageStr = event.ageAtEvent ? ` (${event.ageAtEvent}歳)` : ''
      lines.push(`- **${dateStr}${ageStr}**: ${event.eventDescription}`)
    }
    lines.push('')
  }

  if (earlyFacts.length > 0) {
    lines.push('## 収集された情報\n')
    for (const f of earlyFacts) {
      lines.push(`- ${f.fact}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function buildProfessional(
  records: (typeof professionalRecords.$inferSelect)[],
  facts: (typeof structuredFacts.$inferSelect)[],
): string {
  const lines: string[] = ['# L4: Professional（職歴・スキル）\n', '> Zone: **SHAPE**\n']

  if (records.length > 0) {
    lines.push('## 職務経歴\n')
    lines.push('| 期間 | 会社 | 役割 |')
    lines.push('|---|---|---|')
    for (const r of records) {
      const start = r.startMonth
        ? `${r.startYear}/${String(r.startMonth).padStart(2, '0')}`
        : String(r.startYear)
      const end = r.endYear
        ? r.endMonth
          ? `${r.endYear}/${String(r.endMonth).padStart(2, '0')}`
          : String(r.endYear)
        : '現在'
      lines.push(`| ${start} – ${end} | ${r.companyName} | ${r.role ?? ''} |`)
    }
    lines.push('')

    for (const r of records) {
      if (r.description || r.skills) {
        lines.push(`### ${r.companyName}\n`)
        if (r.description) lines.push(r.description)
        if (r.skills) lines.push(`\n**スキル:** ${r.skills}`)
        lines.push('')
      }
    }
  }

  if (facts.length > 0) {
    lines.push('## 収集された情報\n')
    for (const f of facts) {
      lines.push(`- ${f.fact}`)
    }
    lines.push('')
  }

  if (records.length === 0 && facts.length === 0) {
    lines.push('*No data collected yet.*\n')
  }

  return lines.join('\n')
}

function buildLifeChapters(
  vignettes: (typeof sessionVignettes.$inferSelect)[],
): string {
  const lines: string[] = [
    '# Life Chapters（Vignettes）\n',
    '> Zone: **横断** — どのレイヤーにも属さない行動の証拠集\n',
  ]

  if (vignettes.length === 0) {
    lines.push('*No vignettes collected yet. Start an interview session.*\n')
    return lines.join('\n')
  }

  lines.push('## Scenes\n')

  for (const v of vignettes) {
    lines.push(`### ${v.title}\n`)
    lines.push(`**period:** ${v.period}\n`)
    lines.push(`**quote:** "${v.quote}"\n`)
    lines.push(`**scene:** ${v.scene}\n`)
    lines.push(`**insight:** ${v.insight}`)
    if (v.selfGap) {
      lines.push(`\n**self_gap:** ${v.selfGap}`)
    }
    lines.push('\n---\n')
  }

  return lines.join('\n')
}
