import { eq, asc } from 'drizzle-orm'
import type { Db } from '../types.js'
import { structuredFacts, lifeTimeline, sessionVignettes, professionalRecords, users } from '../db/schema.js'
import { LAYER_SECTIONS } from './layers.js'

export interface ExportFiles {
  index: string
  l01Values: string
  l02Character: string
  l03LifeTimeline: string
  l04Professional: string
  l05Relationships: string
  l06Opinions: string
  l07Fears: string
  l08Patterns: string
  l09Goals: string
  l10Preferences: string
  lifeChapters: string
}

export interface ExportSection {
  heading: string
  facts: string[]
}

export interface ExportLayer {
  key: string
  filename: string
  title: string
  zone: string
  sections: ExportSection[]
  other: string[]
  markdown: string
}

export interface ExportResult {
  files: ExportFiles
  layers: ExportLayer[]
}

type Fact = typeof structuredFacts.$inferSelect

export async function exportToMarkdown(
  db: Db,
  userId: string,
): Promise<ExportResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  const userName = user?.name ?? 'Unknown'
  const lang = user?.language ?? 'ja'
  const now = new Date().toISOString().split('T')[0]

  const [facts, timeline, vignettes, profRecords] = await Promise.all([
    db.select().from(structuredFacts)
      .where(eq(structuredFacts.userId, userId))
      .orderBy(asc(structuredFacts.createdAt)),
    db.select().from(lifeTimeline)
      .where(eq(lifeTimeline.userId, userId))
      .orderBy(asc(lifeTimeline.eventYear), asc(lifeTimeline.eventMonth)),
    db.select().from(sessionVignettes)
      .where(eq(sessionVignettes.userId, userId))
      .orderBy(asc(sessionVignettes.createdAt)),
    db.select().from(professionalRecords)
      .where(eq(professionalRecords.userId, userId))
      .orderBy(asc(professionalRecords.startYear)),
  ])

  const byCategory = facts.reduce<Record<string, Fact[]>>((acc, f) => {
    acc[f.category] ??= []
    acc[f.category].push(f)
    return acc
  }, {})

  const factsFor = (category: string) => byCategory[category] ?? []

  const files: ExportFiles = {
    index: buildIndex(userName, now),
    l01Values: buildSectionedLayer('values', factsFor('values'), lang),
    l02Character: buildSectionedLayer('character', factsFor('character'), lang),
    l03LifeTimeline: buildLifeTimeline(
      timeline,
      [...factsFor('childhood'), ...factsFor('life_events')],
      lang,
    ),
    l04Professional: buildProfessional(
      profRecords,
      [...factsFor('career'), ...factsFor('education'), ...factsFor('skills')],
      lang,
    ),
    l05Relationships: buildSectionedLayer('relationships', factsFor('relationships'), lang),
    l06Opinions: buildSectionedLayer('opinions', factsFor('opinions'), lang),
    l07Fears: buildSectionedLayer('fears', factsFor('fears'), lang),
    l08Patterns: buildSectionedLayer('patterns', factsFor('patterns'), lang),
    l09Goals: buildSectionedLayer('goals', factsFor('goals'), lang),
    l10Preferences: buildSectionedLayer('preferences', factsFor('preferences'), lang),
    lifeChapters: buildLifeChapters(vignettes),
  }

  const layers: ExportLayer[] = [
    buildLayerData('l01Values',       'L01_values.md',       'values',        factsFor('values'),        files.l01Values,       lang),
    buildLayerData('l02Character',    'L02_character.md',    'character',     factsFor('character'),     files.l02Character,    lang),
    buildLayerData('l05Relationships','L05_relationships.md','relationships', factsFor('relationships'), files.l05Relationships, lang),
    buildLayerData('l06Opinions',     'L06_opinions.md',     'opinions',      factsFor('opinions'),      files.l06Opinions,     lang),
    buildLayerData('l07Fears',        'L07_fears.md',        'fears',         factsFor('fears'),         files.l07Fears,        lang),
    buildLayerData('l08Patterns',     'L08_patterns.md',     'patterns',      factsFor('patterns'),      files.l08Patterns,     lang),
    buildLayerData('l09Goals',        'L09_goals.md',        'goals',         factsFor('goals'),         files.l09Goals,        lang),
    buildLayerData('l10Preferences',  'L10_preferences.md',  'preferences',   factsFor('preferences'),   files.l10Preferences,  lang),
  ]

  return { files, layers }
}

function buildIndex(userName: string, date: string): string {
  return `# Personal Context Index

> Subject: ${userName}
> Generated: ${date}

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

// Groups facts by subcategory; returns map of subcategory → facts
function bySubcat(facts: Fact[]): Map<string | null, Fact[]> {
  const m = new Map<string | null, Fact[]>()
  for (const f of facts) {
    const key = f.subcategory ?? null
    if (!m.has(key)) m.set(key, [])
    m.get(key)!.push(f)
  }
  return m
}

// Renders a named section if there are any facts for that subcategory
function section(heading: string, subcategory: string, map: Map<string | null, Fact[]>): string {
  const items = map.get(subcategory)
  if (!items || items.length === 0) return ''
  return `## ${heading}\n\n${items.map(f => `- ${f.fact}`).join('\n')}\n\n`
}

// Any facts with null or unrecognized subcategory go here
function fallbackSection(known: string[], map: Map<string | null, Fact[]>, lang: string): string {
  const knownSet = new Set(known)
  const leftover: Fact[] = []
  for (const [k, facts] of map) {
    if (k === null || !knownSet.has(k)) leftover.push(...facts)
  }
  if (leftover.length === 0) return ''
  const heading = lang === 'en' ? 'Other' : 'その他の情報'
  return `## ${heading}\n\n${leftover.map(f => `- ${f.fact}`).join('\n')}\n\n`
}

// Layer metadata: title, zone, and subtitle per language
const LAYER_META: Record<string, { title: string; titleEn: string; zone: string; note?: string; noteEn?: string }> = {
  values:        { title: 'L1: Values & Beliefs（価値観・信念）',       titleEn: 'L1: Values & Beliefs',        zone: 'CORE',  note: '変わらない自己\n> 何を大切にするか。人生の選択の根拠になっている軸。',  noteEn: 'Unchanging self\n> What you value. The foundation of life decisions.' },
  character:     { title: 'L2: Character & Talent（気質・才能）',       titleEn: 'L2: Character & Talent',      zone: 'CORE',  note: '変わらない自己\n> 生まれ持った傾向。経験で変化しにくい気質レベルの特性。', noteEn: 'Unchanging self\n> Innate tendencies that are hard to change through experience.' },
  relationships: { title: 'L5: Relationships（人間関係）',              titleEn: 'L5: Relationships',           zone: 'SHAPE', note: '経験が形作ったもの\n> 重要な人物・関係性のパターン。',               noteEn: 'Shaped by experience\n> Key people and relationship patterns.' },
  opinions:      { title: 'L6: Opinions & Stance（意見・スタンス）',    titleEn: 'L6: Opinions & Stance',       zone: 'SHAPE', note: '経験が形作ったもの\n> 技術・社会・ビジネス・働き方に対する具体的な立場。', noteEn: 'Shaped by experience\n> Specific stances on tech, society, business, and work.' },
  fears:         { title: 'L7: Fears & Avoidances（恐れ・回避）',       titleEn: 'L7: Fears & Avoidances',     zone: 'SHAPE', note: '経験が形作ったもの',   noteEn: 'Shaped by experience' },
  patterns:      { title: 'L8: Recurring Patterns（繰り返す癖）',       titleEn: 'L8: Recurring Patterns',     zone: 'SHAPE', note: '経験が形作ったもの',   noteEn: 'Shaped by experience' },
  goals:         { title: 'L9: Goals & Direction（目標・方向感）',       titleEn: 'L9: Goals & Direction',      zone: 'STATE', note: '今この瞬間の文脈',     noteEn: 'Current context' },
  preferences:   { title: 'L10: Preferences & Style（好み・スタイル）', titleEn: 'L10: Preferences & Style',   zone: 'STATE', note: '今この瞬間の文脈',     noteEn: 'Current context' },
}

function buildLayerData(
  key: string,
  filename: string,
  category: string,
  facts: Fact[],
  markdown: string,
  lang: string,
): ExportLayer {
  const meta = LAYER_META[category]!
  const sections = LAYER_SECTIONS[category] ?? []
  const known = new Set(sections.map(s => s.subcategory))
  const m = bySubcat(facts)
  const isEn = lang === 'en'

  const structuredSections: ExportSection[] = sections
    .map(s => ({
      heading: isEn ? s.headingEn : s.heading,
      facts: (m.get(s.subcategory) ?? []).map(f => f.fact),
    }))
    .filter(s => s.facts.length > 0)

  const other: string[] = []
  for (const [k, fs] of m) {
    if (k === null || !known.has(k)) other.push(...fs.map(f => f.fact))
  }

  const title = isEn ? meta.titleEn : meta.title
  return { key, filename, title, zone: meta.zone, sections: structuredSections, other, markdown }
}

function buildSectionedLayer(category: string, facts: Fact[], lang: string): string {
  const meta = LAYER_META[category]!
  const isEn = lang === 'en'
  const title = isEn ? meta.titleEn : meta.title
  if (facts.length === 0) return emptyLayer(title, meta.zone)

  const sections = LAYER_SECTIONS[category] ?? []
  const known = sections.map(s => s.subcategory)
  const m = bySubcat(facts)
  const content = sections.map(s => section(isEn ? s.headingEn : s.heading, s.subcategory, m)).join('')
  const note = isEn ? meta.noteEn : meta.note
  const zoneBlock = note
    ? `> Zone: **${meta.zone}** — ${note}`
    : `> Zone: **${meta.zone}**`

  return `# ${title}\n\n${zoneBlock}\n\n---\n\n${content}${fallbackSection(known, m, lang)}`
}

function emptyLayer(title: string, zone: string): string {
  return `# ${title}\n\n> Zone: **${zone}**\n\n*No data collected yet.*\n`
}

function buildLifeTimeline(
  timeline: (typeof lifeTimeline.$inferSelect)[],
  earlyFacts: Fact[],
  lang: string,
): string {
  const isEn = lang === 'en'
  const title = isEn ? 'L3: Life Timeline' : 'L3: Life Timeline（人生年表）'
  const lines: string[] = [`# ${title}\n`, '> Zone: **SHAPE**\n']

  if (timeline.length === 0 && earlyFacts.length === 0) {
    lines.push('*No data collected yet.*\n')
    return lines.join('\n')
  }

  if (timeline.length > 0) {
    lines.push(`## ${isEn ? 'Timeline' : '年表'}\n`)
    for (const event of timeline) {
      const dateStr = event.eventMonth
        ? `${event.eventYear}/${String(event.eventMonth).padStart(2, '0')}`
        : String(event.eventYear)
      const ageStr = event.ageAtEvent
        ? isEn ? ` (age ${event.ageAtEvent})` : ` (${event.ageAtEvent}歳)`
        : ''
      lines.push(`- **${dateStr}${ageStr}**: ${event.eventDescription}`)
    }
    lines.push('')
  }

  if (earlyFacts.length > 0) {
    lines.push(`## ${isEn ? 'Collected Information' : '収集された情報'}\n`)
    for (const f of earlyFacts) {
      lines.push(`- ${f.fact}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function buildProfessional(
  records: (typeof professionalRecords.$inferSelect)[],
  facts: Fact[],
  lang: string,
): string {
  const isEn = lang === 'en'
  const title = isEn ? 'L4: Professional' : 'L4: Professional（職歴・スキル）'
  const lines: string[] = [`# ${title}\n`, '> Zone: **SHAPE**\n']

  if (records.length > 0) {
    lines.push(`## ${isEn ? 'Work History' : '職務経歴'}\n`)
    if (isEn) {
      lines.push('| Period | Company | Role |')
    } else {
      lines.push('| 期間 | 会社 | 役割 |')
    }
    lines.push('|---|---|---|')
    for (const r of records) {
      const start = r.startMonth
        ? `${r.startYear}/${String(r.startMonth).padStart(2, '0')}`
        : String(r.startYear)
      const end = r.endYear
        ? r.endMonth
          ? `${r.endYear}/${String(r.endMonth).padStart(2, '0')}`
          : String(r.endYear)
        : isEn ? 'Present' : '現在'
      lines.push(`| ${start} – ${end} | ${r.companyName} | ${r.role ?? ''} |`)
    }
    lines.push('')

    for (const r of records) {
      if (r.description || r.skills) {
        lines.push(`### ${r.companyName}\n`)
        if (r.description) lines.push(r.description)
        if (r.skills) lines.push(`\n**${isEn ? 'Skills' : 'スキル'}:** ${r.skills}`)
        lines.push('')
      }
    }
  }

  if (facts.length > 0) {
    lines.push(`## ${isEn ? 'Collected Information' : '収集された情報'}\n`)
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
