export type SectionDef = { subcategory: string; heading: string; headingEn: string }

export type LayerTable = 'structuredFacts' | 'lifeTimeline' | 'professionalRecords'

export type LayerMeta = {
  id: string
  name: string
  zone: 'CORE' | 'SHAPE' | 'STATE'
  category: string
  threshold: number
  table: LayerTable
}

// Single source of truth for L1–L10 metadata.
// Consumed by questionSelector.ts (thresholds) and progress.ts (layer definitions).
export const LAYER_META: LayerMeta[] = [
  { id: 'L1',  name: '価値観・信念',   zone: 'CORE',  category: 'values',        threshold: 5, table: 'structuredFacts'      },
  { id: 'L2',  name: '気質・才能',     zone: 'CORE',  category: 'character',     threshold: 3, table: 'structuredFacts'      },
  { id: 'L3',  name: '人生年表',       zone: 'SHAPE', category: 'life_timeline', threshold: 8, table: 'lifeTimeline'         },
  { id: 'L4',  name: '職務詳細',       zone: 'SHAPE', category: 'professional',  threshold: 3, table: 'professionalRecords'  },
  { id: 'L5',  name: '関係性',         zone: 'SHAPE', category: 'relationships', threshold: 5, table: 'structuredFacts'      },
  { id: 'L6',  name: '意見・スタンス', zone: 'SHAPE', category: 'opinions',      threshold: 5, table: 'structuredFacts'      },
  { id: 'L7',  name: '恐れ・回避',     zone: 'SHAPE', category: 'fears',         threshold: 3, table: 'structuredFacts'      },
  { id: 'L8',  name: '繰り返す癖',     zone: 'SHAPE', category: 'patterns',      threshold: 3, table: 'structuredFacts'      },
  { id: 'L9',  name: '目標・方向感',   zone: 'STATE', category: 'goals',         threshold: 3, table: 'structuredFacts'      },
  { id: 'L10', name: '好み・スタイル', zone: 'STATE', category: 'preferences',   threshold: 3, table: 'structuredFacts'      },
]

// Single source of truth for category → sections mapping.
// Used by both the extraction prompt (provider.ts) and the markdown export (markdown.ts).
export const LAYER_SECTIONS: Record<string, SectionDef[]> = {
  values: [
    { subcategory: 'core_values',       heading: '譲れない価値観',              headingEn: 'Core Values' },
    { subcategory: 'consistent_values', heading: '一貫して大事にしてきたこと',  headingEn: 'Consistently Valued Things' },
    { subcategory: 'anti_values',       heading: '逆引き：嫌いなもの・許せないこと', headingEn: 'What I Dislike / Cannot Tolerate' },
    { subcategory: 'admired_people',    heading: '価値観を体現している人',      headingEn: 'People Who Embody My Values' },
    { subcategory: 'worldview',         heading: '信念・世界観',                headingEn: 'Beliefs & Worldview' },
    { subcategory: 'priorities',        heading: '選択の優先順位',              headingEn: 'Decision Priorities' },
  ],
  character: [
    { subcategory: 'temperament',       heading: '基本的な気質',                headingEn: 'Basic Temperament' },
    { subcategory: 'natural_actions',   heading: '自然にやってしまうこと',      headingEn: 'What I Do Naturally' },
    { subcategory: 'motivation_types',  heading: '充実したときの動機の種類',    headingEn: 'Motivations When Fulfilled' },
    { subcategory: 'thinking_patterns', heading: '思考のクセ',                  headingEn: 'Thinking Patterns' },
    { subcategory: 'energizing',        heading: '気分が上がる状況',            headingEn: 'What Energizes Me' },
    { subcategory: 'draining',          heading: '気分が下がる状況',            headingEn: 'What Drains Me' },
    { subcategory: 'body_signals',      heading: '体のシグナル',                headingEn: 'Body Signals' },
    { subcategory: 'communication',     heading: 'コミュニケーションの特徴',    headingEn: 'Communication Style' },
  ],
  relationships: [
    { subcategory: 'key_people',    heading: '重要な人物',              headingEn: 'Key People' },
    { subcategory: 'compatible',    heading: '合う人のパターン',        headingEn: 'Types I Get Along With' },
    { subcategory: 'incompatible',  heading: '合わない人のパターン',    headingEn: "Types I Don't Get Along With" },
    { subcategory: 'influential',   heading: '影響を受け続けている人',  headingEn: 'People Who Continue to Influence Me' },
    { subcategory: 'community',     heading: 'コミュニティ・所属',      headingEn: 'Community & Belonging' },
  ],
  opinions: [
    { subcategory: 'overrated',     heading: '過大評価されているもの',  headingEn: 'Overrated Things' },
    { subcategory: 'underrated',    heading: '過小評価されているもの',  headingEn: 'Underrated Things' },
    { subcategory: 'work_style',    heading: '仕事・働き方',            headingEn: 'Work & Work Style' },
    { subcategory: 'society',       heading: '社会・ビジネス',          headingEn: 'Society & Business' },
    { subcategory: 'frustrations',  heading: '怒り・違和感',            headingEn: 'Frustrations & Discomfort' },
  ],
  fears: [
    { subcategory: 'fears',       heading: '恐れていること',              headingEn: 'Fears' },
    { subcategory: 'avoidances',  heading: '避けていること・避けてきたこと', headingEn: 'Avoidances' },
    { subcategory: 'feared_self', heading: 'なりたくない自分像',          headingEn: "Who I Don't Want to Become" },
    { subcategory: 'fear_roots',  heading: '恐れの根っこ',               headingEn: 'Roots of Fear' },
  ],
  patterns: [
    { subcategory: 'positive',  heading: 'ポジティブなパターン（強み）',        headingEn: 'Positive Patterns (Strengths)' },
    { subcategory: 'negative',  heading: 'ネガティブなパターン（繰り返す失敗）', headingEn: 'Negative Patterns (Recurring Failures)' },
    { subcategory: 'handling',  heading: '現在の向き合い方',                    headingEn: 'Current Approach' },
  ],
  goals: [
    { subcategory: 'main_goals', heading: '今期のメインゴール',        headingEn: 'Current Main Goals' },
    { subcategory: 'direction',  heading: '向かっている方向',          headingEn: 'Direction I\'m Heading' },
    { subcategory: 'leaving',    heading: '離れようとしているもの',    headingEn: 'What I\'m Moving Away From' },
    { subcategory: 'issues',     heading: '直近の悩み・未解決問題',    headingEn: 'Current Issues & Unresolved Problems' },
    { subcategory: 'focus',      heading: '今週・今月のフォーカス',    headingEn: "This Week / Month's Focus" },
  ],
  preferences: [
    { subcategory: 'ai_style',   heading: 'AIとの会話スタイル',      headingEn: 'AI Conversation Style' },
    { subcategory: 'work_style', heading: '作業スタイル',            headingEn: 'Work Style' },
    { subcategory: 'likes',      heading: '好きなもの',              headingEn: 'Likes' },
    { subcategory: 'dislikes',   heading: '嫌いなもの・苦手なもの',  headingEn: 'Dislikes' },
  ],
}

// Generates the subcategory guidance block for the extraction prompt.
export function buildSubcategoryPrompt(language = 'ja'): string {
  return Object.entries(LAYER_SECTIONS)
    .map(([category, sections]) => {
      const options = language === 'en'
        ? sections.map(s => `${s.subcategory} (${s.headingEn})`).join(' / ')
        : sections.map(s => `${s.subcategory}（${s.heading}）`).join(' / ')
      return `${category}: ${options}`
    })
    .join('\n\n')
}
