import { Hono } from 'hono'
import JSZip from 'jszip'
import { exportToMarkdown } from '../export/markdown.js'
import type { AppVariables } from '../types.js'

export const exportRoute = new Hono<{ Variables: AppVariables }>()

exportRoute.get('/', async (c) => {
  try {
    const { files, layers } = await exportToMarkdown(c.get('db'), c.get('userId'))
    return c.json({ files, layers })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to export' }, 500)
  }
})

exportRoute.get('/download', async (c) => {
  try {
    const { files } = await exportToMarkdown(c.get('db'), c.get('userId'))

    // Create a new JSZip instance
    const zip = new JSZip()

    // Map of ExportFiles keys to filenames
    const fileMap: Record<keyof typeof files, string> = {
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

    // Add each markdown file to the zip
    for (const [key, filename] of Object.entries(fileMap)) {
      const content = files[key as keyof typeof files]
      if (content) {
        zip.file(filename, content)
      }
    }

    // Generate the zip file as an ArrayBuffer
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })

    // Return the zip file
    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="personal_context.zip"',
      },
    })
  } catch (err) {
    console.error('[export/download] error:', err)
    return c.json({ error: 'Failed to generate ZIP' }, 500)
  }
})
