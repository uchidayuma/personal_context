import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { exportToMarkdown, type ExportFiles } from '../../server/src/export/markdown.js'
import { DEFAULT_USER_ID } from '../../server/src/db/client.js'

const includePrivate = process.env.MCP_INCLUDE_PRIVATE !== 'false'

type ResourceSlug =
  | 'index' | 'life-chapters'
  | 'values' | 'character' | 'life-timeline' | 'professional'
  | 'relationships' | 'opinions' | 'fears' | 'patterns'
  | 'goals' | 'preferences'

const RESOURCE_MAP: Record<ResourceSlug, { key: keyof ExportFiles; description: string }> = {
  'index': {
    key: 'index',
    description: 'Reading guide — lists all context files, their zones (CORE/SHAPE/STATE), and when to load each. Read this first.',
  },
  'life-chapters': {
    key: 'lifeChapters',
    description: 'Behavioral scenes extracted from interviews. The highest-signal resource — reveals character through action. Read before giving advice.',
  },
  'values': {
    key: 'l01Values',
    description: "Core values and beliefs. What this person won't compromise on. Use when helping with decisions or priorities.",
  },
  'character': {
    key: 'l02Character',
    description: 'Natural personality, talents, and energy patterns. Use when tailoring communication style or work approach.',
  },
  'life-timeline': {
    key: 'l03LifeTimeline',
    description: 'Life history from childhood to present, including turning points. Use for career or life context.',
  },
  'professional': {
    key: 'l04Professional',
    description: 'Career history, skills, and key projects. Use for work-related advice or technical context.',
  },
  'relationships': {
    key: 'l05Relationships',
    description: 'Key people and relationship patterns. Use when advice involves others or team dynamics.',
  },
  'opinions': {
    key: 'l06Opinions',
    description: 'Stances on work, society, and their field. Use when discussing strategy, industry, or worldview.',
  },
  'fears': {
    key: 'l07Fears',
    description: 'Fears and avoidance patterns (private). Relevant for understanding blockers or resistance.',
  },
  'patterns': {
    key: 'l08Patterns',
    description: 'Recurring behavioral patterns, positive and negative (private). Use when diagnosing repeated problems.',
  },
  'goals': {
    key: 'l09Goals',
    description: 'Current goals and direction. Use for any forward-looking advice or prioritization.',
  },
  'preferences': {
    key: 'l10Preferences',
    description: 'Communication style and work preferences. Use to tailor how you respond.',
  },
}

const CORE_LAYERS: ResourceSlug[] = ['life-chapters', 'values', 'character']

const server = new McpServer({
  name: 'personal_context',
  version: '0.1.0',
})

for (const [slug, meta] of Object.entries(RESOURCE_MAP) as [ResourceSlug, typeof RESOURCE_MAP[ResourceSlug]][]) {
  server.resource(
    slug,
    `context://${slug}`,
    { description: meta.description, mimeType: 'text/markdown' },
    async () => {
      const files = await exportToMarkdown(DEFAULT_USER_ID, includePrivate)
      const content = files[meta.key]
      return {
        contents: [{
          uri: `context://${slug}`,
          mimeType: 'text/markdown',
          text: content ?? '*This resource is not available (private content excluded).*',
        }],
      }
    },
  )
}

server.tool(
  'get_context',
  'Retrieve personal context as Markdown. Defaults to CORE layers (life-chapters, values, character). Specify layers for targeted context.',
  {
    layers: z.array(z.enum([
      'index', 'life-chapters',
      'values', 'character', 'life-timeline', 'professional',
      'relationships', 'opinions', 'fears', 'patterns',
      'goals', 'preferences',
    ])).optional().describe('Layers to include. Defaults to CORE set: life-chapters, values, character.'),
    include_private: z.boolean().optional().describe(
      'Include private layers (fears, patterns). Defaults to server MCP_INCLUDE_PRIVATE setting.',
    ),
  },
  async ({ layers, include_private }) => {
    const usePrivate = include_private ?? includePrivate
    const files = await exportToMarkdown(DEFAULT_USER_ID, usePrivate)
    const requested = (layers ?? CORE_LAYERS) as ResourceSlug[]

    const parts: string[] = []
    for (const slug of requested) {
      const meta = RESOURCE_MAP[slug]
      if (!meta) continue
      const content = files[meta.key]
      if (content) parts.push(content)
    }

    return {
      content: [{
        type: 'text' as const,
        text: parts.join('\n\n---\n\n') || '*No context available yet. Start an interview session first.*',
      }],
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
