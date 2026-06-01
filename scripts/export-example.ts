// Usage: pnpm tsx scripts/export-example.ts [lang]
// lang: "ja" (default) | "en"
// Exports current DB contents to output_example/{lang}/

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { db, DEFAULT_USER_ID } from '../packages/server/src/db/client.js'
import { exportToMarkdown, type ExportFiles } from '../packages/server/src/export/markdown.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const FILE_MAP: Record<keyof ExportFiles, string> = {
  index: '_index.md',
  lifeChapters: 'life_chapters.md',
  l01Values: 'L01_values.md',
  l02Character: 'L02_character.md',
  l03LifeTimeline: 'L03_life_timeline.md',
  l04Professional: 'L04_professional.md',
  l05Relationships: 'L05_relationships.md',
  l06Opinions: 'L06_opinions.md',
  l07Fears: 'L07_fears.md',
  l08Patterns: 'L08_patterns.md',
  l09Goals: 'L09_goals.md',
  l10Preferences: 'L10_preferences.md',
}

async function main() {
  const lang = process.argv[2] ?? 'ja'
  const outputDir = join(__dirname, '..', 'output_example', lang)

  mkdirSync(outputDir, { recursive: true })

  const files = await exportToMarkdown(db, DEFAULT_USER_ID)

  let written = 0
  for (const [key, filename] of Object.entries(FILE_MAP) as [keyof ExportFiles, string][]) {
    const content = files[key]
    if (content?.trim()) {
      writeFileSync(join(outputDir, filename), content, 'utf-8')
      console.log(`✓ ${filename}`)
      written++
    }
  }

  if (written === 0) {
    console.log('No data found. Run some interview sessions first.')
  } else {
    console.log(`\nExported ${written} files to output_example/${lang}/`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
