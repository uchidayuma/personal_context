# L1-L10 全レイヤー対応 実装設計書

> ステータス: **部分実装済み・出力設計は別ドキュメントに移管**
> 作成日: 2026-05-23
>
> **注意**: DB スキーマ・LLM 抽出・インタビュー設計の部分は実装済み。  
> 出力ファイル設計（セクション 4-2 以降）は `docs/design/OUTPUT_DESIGN.md` に移管済みであり、  
> このドキュメントの出力ファイル記述（`identity_profile.md` など）は現在の設計と一致しない。  
> 出力設計の最新版は `OUTPUT_DESIGN.md` および `docs/output_template/` を参照。

---

## 背景と問題の整理

現状のシステムが収集できているレイヤーと、まだ収集できていないレイヤーを整理する。

| Layer | 名称 | 現状のカバー状況 |
|-------|------|----------------|
| L1 | 価値観・信念 | △ `structured_facts.category = 'values'` で部分収集済み |
| L2 | 気質・性格 | **✗ 未対応** — 質問もなく、カテゴリも存在しない |
| L3 | 人生年表 | ✓ `life_timeline` テーブルで専用収集済み |
| L4 | 職務詳細 | ✓ `professional_records` テーブルで専用収集済み |
| L5 | 関係性 | △ `structured_facts.category = 'relationships'` で部分収集。パターンは未収集 |
| L6 | 意見・スタンス | **✗ 未対応** — カテゴリなし、質問なし |
| L7 | 恐れ・回避パターン | **✗ 未対応** — カテゴリなし、質問なし |
| L8 | 繰り返す癖 | **✗ 未対応** — カテゴリなし、質問なし |
| L9 | 目標・方向感 | △ `structured_facts.category = 'goals'` で部分収集済み |
| L10 | 好み・スタイル | **✗ 未対応** — カテゴリなし、質問なし |

**本設計書が解決するギャップ**: L2、L5（パターン部分）、L6、L7、L8、L10

---

## 設計の基本方針

### なぜ専用テーブルを増やさないのか

L3（`life_timeline`）と L4（`professional_records`）が専用テーブルを持つ理由は明確だ。

- **L3**: 「年・月・日・年齢」という構造化フィールドが必要で、時系列ソートが本質的な操作
- **L4**: 「会社名・役職・在籍期間・スキル配列」という複雑な構造が必要で、インポート経路（履歴書）が別に存在する

L5〜L10（うち L4 を除く）は、本質的に「テキストによる表明」だ。  
構造化フィールドが必要な理由がない。`structured_facts` のカテゴリを拡張するのが適切。

**判断基準**: 「このレイヤーを検索・集計するとき、テキスト以外のフィールドが必要か？」  
L6〜L8、L10 は必要ない → `structured_facts` 拡張で対応。

---

## 1. DBスキーマ変更

### 1-1. `structured_facts.category` の拡張

**変更前のカテゴリ**（現状）:
```
childhood | education | career | values | goals | skills | life_events | relationships
```

**変更後のカテゴリ**（追加分のみ記載）:
```
character | opinions | fears | patterns | preferences
```

**全カテゴリ一覧（変更後）**:
```
childhood | education | career | values | goals | skills | life_events |
relationships | character | opinions | fears | patterns | preferences
```

### カテゴリとレイヤーのマッピング

| structured_facts カテゴリ | 対応レイヤー |
|--------------------------|-------------|
| `values` | L1 価値観・信念 |
| `character` | **NEW** L2 気質・性格 |
| `relationships` | L5 関係性（人物名・関係の事実） |
| `opinions` | **NEW** L6 意見・スタンス |
| `fears` | **NEW** L7 恐れ・回避パターン |
| `patterns` | **NEW** L8 繰り返す癖 |
| `goals` | L9 目標・方向感 |
| `preferences` | **NEW** L10 好み・スタイル |

### 1-2. スキーマ変更の実装

**`packages/server/src/db/schema.ts`** の変更:

```typescript
// 変更前
export const structuredFacts = sqliteTable('structured_facts', {
  // ...
  category: text('category').notNull(),
  // ...
})

// 変更後 — category に enum を追加（Drizzle ORM での型安全化）
export const STRUCTURED_FACT_CATEGORIES = [
  'childhood', 'education', 'career', 'values', 'goals', 'skills',
  'life_events', 'relationships',
  'character', 'opinions', 'fears', 'patterns', 'preferences',   // NEW
] as const

export type StructuredFactCategory = typeof STRUCTURED_FACT_CATEGORIES[number]

export const structuredFacts = sqliteTable('structured_facts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').$type<StructuredFactCategory>().notNull(),
  fact: text('fact').notNull(),
  confidenceScore: real('confidence_score').notNull().default(0.8),
  visibility: text('visibility', { enum: ['public', 'private'] }).notNull().default('private'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})
```

**DBマイグレーション**: `structured_facts` は TEXT 型でカテゴリを保存しているため、テーブル構造変更は不要。新カテゴリ名で INSERT するだけで動作する。`initDatabase()` への変更も不要。

---

## 2. LLM抽出プロンプト変更

### 2-1. 変更ファイル

`packages/server/src/llm/provider.ts` の `ExtractionSchema` と `extractFactsFromConversation()` のシステムプロンプト。

### 2-2. 拡張後の `ExtractionSchema`

```typescript
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
    event_year: z.number(),
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
```

### 2-3. 拡張後のシステムプロンプト（日本語版）

`extractFactsFromConversation()` のシステムプロンプトを以下に置き換える。

**設計の核心: L7・L8の扱い方**

L7（恐れ・回避）と L8（繰り返す癖）は、直接「あなたは何が怖いですか」と聞いても本音が出ない。  
このシステムの哲学（PHILOSOPHY.md）に従い、**行動の痕跡から逆算する**形でプロンプトを構成する。

```typescript
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

```

---

## 3. 質問シードデータの追加

### 3-1. 追加する質問（`packages/server/src/db/seed.ts`）

以下を `SEED_QUESTIONS` 配列に追加する。

```typescript
// L2: 気質・性格
{ id: 'q25', category: 'character', content: '子供の頃から「昔からそういう人だね」と言われてきたことはありますか？', priority: 8 },
{ id: 'q26', category: 'character', content: '決断を迫られたとき、最終的に「体」が先に答えを出すことがありますか？どんな感覚ですか？', priority: 7 },
{ id: 'q27', category: 'character', content: '他の人が平気なのに、自分だけがどうしても嫌だと感じることはありますか？', priority: 8 },

// L5: 関係性パターン
{ id: 'q28', category: 'relationships', content: '今まで「この人とは合わなかった」と感じた人には、共通点がありましたか？', priority: 7 },
{ id: 'q29', category: 'relationships', content: '自然と長く付き合いが続く人と、なぜか疎遠になってしまう人の違いは何だと思いますか？', priority: 7 },

// L6: 意見・スタンス
{ id: 'q30', category: 'opinions', content: '「世の中的には正しいとされているけど、自分は懐疑的だ」と思っていることはありますか？', priority: 8 },
{ id: 'q31', category: 'opinions', content: '今の仕事や業界で「これは過大評価されている」と思うものがあれば教えてください。', priority: 7 },
{ id: 'q32', category: 'opinions', content: '会議・採用・評価など、職場の慣行で「これは本当に必要なのか」と思ったことはありますか？', priority: 7 },

// L7: 恐れ・回避（間接的アプローチ）
// ※ 「怖い」という言葉を使わず、行動・選択の理由として引き出す
{ id: 'q33', category: 'fears', content: '声をかけられたのに断ったこと、または最後まで踏み込めなかったことはありますか？そのときどんな気持ちでしたか？', priority: 8 },
{ id: 'q34', category: 'fears', content: '「絶対にこういう立場や状況にはなりたくない」と強く思った経験はありますか？', priority: 9 },
{ id: 'q35', category: 'fears', content: '誰かや何かの「なれの果て」を見て、こうなりたくないと思ったことはありますか？', priority: 8 },

// L8: 繰り返す癖（間接的アプローチ）
// ※ 「あなたの癖は？」という直接質問を避け、複数の文脈で同じ行動が出るよう誘導する
{ id: 'q36', category: 'patterns', content: '仕事でもプライベートでも「またこのパターンになってしまった」と気づいたことはありますか？', priority: 9 },
{ id: 'q37', category: 'patterns', content: '人間関係で繰り返してきた「困ったな」というパターンがあれば教えてください。', priority: 8 },
{ id: 'q38', category: 'patterns', content: '締め切り・プレッシャー・対立が生じたとき、自分はどう反応することが多いですか？', priority: 8 },

// L10: 好み・スタイル
{ id: 'q39', category: 'preferences', content: '仕事の進め方で「これが自分のリズムだ」と感じるやり方はありますか？', priority: 8 },
{ id: 'q40', category: 'preferences', content: '他の人のプレゼンや文章で「読みやすい・伝わりやすい」と感じるのはどういうスタイルですか？', priority: 7 },
{ id: 'q41', category: 'preferences', content: '一番集中できる環境・時間帯・状況を教えてください。', priority: 7 },
```

### 3-2. 英語翻訳の追加

```typescript
// EN_TRANSLATIONS 配列に追加
{ questionId: 'q25', content: 'Have people been telling you "that\'s just how you are" since childhood?' },
{ questionId: 'q26', content: 'When forced to make a decision, does your body sometimes give you the answer before your head does? What does that feel like?' },
{ questionId: 'q27', content: 'Is there something that others seem fine with but that you genuinely can\'t stand?' },
{ questionId: 'q28', content: 'Looking back at people you\'ve worked or lived with, were there common traits among those who just didn\'t click with you?' },
{ questionId: 'q29', content: 'What\'s the difference between people you naturally stay close to over the years, and those you drift apart from?' },
{ questionId: 'q30', content: 'Is there something widely accepted as right or true that you\'re quietly skeptical about?' },
{ questionId: 'q31', content: 'In your work or field, is there something you think is overrated or overhyped?' },
{ questionId: 'q32', content: 'Have you ever thought about a common workplace practice — meetings, hiring, reviews — and wondered if it\'s really necessary?' },
{ questionId: 'q33', content: 'Have you ever been invited into something but stepped back — or got close and couldn\'t quite go through with it? What was going on for you then?' },
{ questionId: 'q34', content: 'Has there been a situation or role you felt very strongly you never wanted to be in?' },
{ questionId: 'q35', content: 'Have you ever seen what someone or something became over time and felt strongly: I don\'t want to end up like that?' },
{ questionId: 'q36', content: 'Have you ever caught yourself thinking "here I go again" — a pattern repeating across work and personal life?' },
{ questionId: 'q37', content: 'Is there a recurring pattern in your relationships that you\'ve found difficult or frustrating?' },
{ questionId: 'q38', content: 'When deadlines, pressure, or conflict come up, how do you tend to respond?' },
{ questionId: 'q39', content: 'Do you have a rhythm or way of working that feels distinctly yours?' },
{ questionId: 'q40', content: 'When someone else\'s presentation or writing feels easy to follow, what is it about their style that works for you?' },
{ questionId: 'q41', content: 'What environment, time of day, or situation helps you concentrate best?' },
```

### 3-3. L7・L8の質問設計の思想

L7（恐れ・回避）と L8（繰り返す癖）に直接的な質問（「何が怖いですか」「あなたの欠点は？」）を使わない理由:

1. **防衛反応を引き起こす**: 直接質問は自己開示コストが高く、表面的な答え（「失敗が怖いです」）しか返ってこない
2. **行動ログから逆算する**: このシステムの哲学に従い、「実際にどう動いたか」から恐れやパターンを引き出す
3. **LLMが構造化する**: ユーザーは「断った経験」を語るだけでよい。恐れのカテゴリへの分類は LLM が行う

---

## 4. エクスポート（Markdown）変更

### 4-1. 現状の出力ファイル構成

| ファイル | 内容 |
|---------|------|
| `_index.md` | 読み方ガイド |
| `life_chapters.md` | vignettes + life_timeline（蓄積型） |
| `current_context.md` | 直近3vignette + 直近10facts（スナップショット型） |
| `professional_profile.md` | 職歴・学歴・スキル（SPEC.md に定義済み、未実装） |

### 4-2. 新規ファイルの追加: `identity_profile.md`

新レイヤー（L2、L5、L6、L7、L8、L10）のデータは、既存ファイルのどれにも自然に収まらない。  
「その人が誰であるか（CORE + SHAPE の主観的側面）」を1ファイルにまとめる `identity_profile.md` を追加する。

**設計根拠**:  
- `life_chapters.md` は時系列の「出来事」が主役。性格や意見は時系列に乗らない。
- `current_context.md` は「今」のスナップショット。恐れや性格は変化頻度が低く、常時含まれるべきではない。
- 独立ファイルにすることで、LLM へのコンテキスト投入を選択的にできる（例: キャリア相談には不要、メンタル系の相談には必須）。

**`identity_profile.md` の構成**:

```markdown
# Identity Profile

> Subject: {userName}
> Generated: {date}

## Core Character (L2)

（character カテゴリの facts を列挙）

## How I Work (L10)

（preferences カテゴリの facts を列挙）

## What I Believe (L1 deep cuts)

（values カテゴリの facts — current_context にも出るが、こちらは全件）

## Stances & Opinions (L6)

（opinions カテゴリの facts を列挙）

## Key Relationships (L5)

（relationships カテゴリの facts を列挙）

## Fears & Avoidances (L7)

（fears カテゴリの facts を列挙）
※ この section は visibility: private のデータのみ含む

## Recurring Patterns (L8)

（patterns カテゴリの facts を列挙）
※ この section は visibility: private のデータのみ含む

```

**実装箇所**: `packages/server/src/export/markdown.ts`

`ExportFiles` インターフェースに `identityProfile: string` を追加する:

```typescript
export interface ExportFiles {
  index: string
  lifeChapters: string
  currentContext: string
  identityProfile: string   // NEW
}
```

`buildIdentityProfile()` 関数を追加し、以下のカテゴリから `structuredFacts` を取得:
```typescript
const IDENTITY_CATEGORIES = ['character', 'preferences', 'values', 'opinions', 'relationships', 'fears', 'patterns']
```

### 4-3. `_index.md` の更新

ファイル一覧テーブルに `identity_profile.md` を追加し、使い方の優先順位を更新する:

```markdown
**Priority order for understanding this person:**
1. `life_chapters.md` — 行動の痕跡（vignette）と年表。まずここから。
2. `identity_profile.md` — 気質・意見・恐れ・癖。人物理解の核心。
3. `current_context.md` — 今どこにいるか。目標・直近の動き。
4. `professional_profile.md` — 客観的な職歴・スキル。アドバイスの現実的制約。
```

### 4-4. `current_context.md` の更新

直近10factsの表示に新カテゴリが含まれるようになる。  
コード上の変更は不要（カテゴリ名でグルーピングされるため、新カテゴリは自動的に表示される）。

---

## 5. `GET /api/progress` エンドポイント設計

### 5-1. レイヤーごとのDBクエリと閾値

`docs/CONTEXT_DASHBOARD_DESIGN.md` に定義されているダッシュボード仕様に合わせて実装する。

```typescript
// packages/server/src/routes/progress.ts（新規ファイル）

const LAYER_DEFINITIONS = [
  {
    id: 'L1',
    name: '価値観・信念',
    zone: 'CORE',
    threshold: 5,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['values']),
      )),
  },
  {
    id: 'L2',
    name: '気質・性格',
    zone: 'CORE',
    threshold: 3,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['character']),
      )),
  },
  {
    id: 'L3',
    name: '人生年表',
    zone: 'SHAPE',
    threshold: 10,
    query: () => db.select({ count: count() }).from(lifeTimeline)
      .where(eq(lifeTimeline.userId, userId)),
  },
  {
    id: 'L4',
    name: '職務詳細',
    zone: 'SHAPE',
    threshold: 3,
    query: () => db.select({ count: count() }).from(professionalRecords)
      .where(eq(professionalRecords.userId, userId)),
  },
  {
    id: 'L5',
    name: '関係性',
    zone: 'SHAPE',
    threshold: 5,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['relationships']),
      )),
  },
  {
    id: 'L6',
    name: '意見・スタンス',
    zone: 'SHAPE',
    threshold: 5,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['opinions']),
      )),
  },
  {
    id: 'L7',
    name: '恐れ・回避',
    zone: 'SHAPE',
    threshold: 3,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['fears']),
      )),
  },
  {
    id: 'L8',
    name: '繰り返す癖',
    zone: 'SHAPE',
    threshold: 3,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['patterns']),
      )),
  },
  {
    id: 'L9',
    name: '目標・方向感',
    zone: 'STATE',
    threshold: 3,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['goals']),
      )),
  },
  {
    id: 'L10',
    name: '好み・スタイル',
    zone: 'STATE',
    threshold: 3,
    query: () => db.select({ count: count() }).from(structuredFacts)
      .where(and(
        eq(structuredFacts.userId, userId),
        inArray(structuredFacts.category, ['preferences']),
      )),
  },
] as const
```

### 5-2. レスポンス形式

`docs/CONTEXT_DASHBOARD_DESIGN.md` で定義されたレスポンス形式をそのまま使用:

```typescript
// GET /api/progress のレスポンス型
interface ProgressResponse {
  overall: number       // 全体充足度 0-100（全レイヤーの percent の平均）
  layers: Array<{
    id: string          // 'L1' - 'L10'
    name: string        // 日本語レイヤー名
    zone: 'CORE' | 'SHAPE' | 'STATE'
    percent: number     // min(count / threshold, 1.0) × 100
    count: number       // 実件数
    threshold: number   // 完了とみなす件数
  }>
  totals: {
    facts: number
    timeline: number
    professional: number
    vignettes: number
  }
}
```

### 5-3. 充足度の計算ロジック

```typescript
// 各レイヤー
const percent = Math.min(count / threshold, 1.0) * 100

// 全体充足度: 全レイヤーの単純平均
const overall = layers.reduce((sum, l) => sum + l.percent, 0) / layers.length
```

### 5-4. サーバー登録

`packages/server/src/index.ts` に追加:
```typescript
import { progressRoute } from './routes/progress.js'
// ...
app.route('/api/progress', progressRoute)
```

---

## 6. 実装の優先順位（インクリメンタル計画）

全て一度に実装する必要はない。以下の順序で段階的に進める。

### Phase 1（最小変更でL2-L10収集可能にする）

変更ファイル数: 2

1. **`packages/server/src/llm/provider.ts`**  
   - `ExtractionSchema` のカテゴリ enum に 5 カテゴリを追加
   - システムプロンプトを更新（新カテゴリの抽出指示を追加）

2. **`packages/server/src/db/seed.ts`**  
   - q25〜q41 の質問とその英語翻訳を追加

これだけで、次のインタビューから新レイヤーのデータが `structured_facts` に入り始める。  
既存の DB 構造変更は不要。

### Phase 2（Progress API）

変更ファイル数: 2

3. **`packages/server/src/routes/progress.ts`**（新規）  
   - `GET /api/progress` エンドポイントを実装

4. **`packages/server/src/index.ts`**  
   - progress ルートを登録

### Phase 3（エクスポート拡張）

変更ファイル数: 1-2

5. **`packages/server/src/export/markdown.ts`**  
   - `buildIdentityProfile()` 関数を追加
   - `ExportFiles` に `identityProfile` フィールドを追加
   - `_index.md` のファイル一覧を更新

6. **`packages/server/src/routes/export.ts`**（対応する変更が必要な場合）

### Phase 4（Drizzle 型安全化）

変更ファイル数: 1

7. **`packages/server/src/db/schema.ts`**  
   - `STRUCTURED_FACT_CATEGORIES` const array を export
   - `StructuredFactCategory` 型を export
   - `structuredFacts.category` に `.$type<StructuredFactCategory>()` を追加

---

## 7. 設計の補足と判断記録

### なぜ `opinions` と `fears` は visibility: private デフォルトなのか

`opinions` に含まれる「〇〇は過大評価だと思う」「〇〇のやり方は間違っている」は、第三者が読んだ場合に問題になりうる内容を含む可能性がある。公開用 Gem（GPT）には含まれるべきでない。

`fears` と `patterns` はより明白だ。弱みや失敗パターンをパブリックな AI エージェントに渡すケースはほぼない。

### なぜ L7・L8 に専用テーブルを作らないのか

「恐れ・回避」と「繰り返す癖」はいずれも **テキストの命題**として表現される（例: "完成直前でプロジェクトを放棄するパターンがある"）。  
`life_timeline` のように「年・月」が必要なわけでも、`professional_records` のように「会社名・期間・スキル配列」が必要なわけでもない。  
`structured_facts.category` のカテゴリを増やすだけで十分だ。

### `opinions` を structured_facts に入れることへの懸念

意見はファクトではない、という指摘はあり得る。  
しかしこのシステムにおける `structured_facts` は「その人について構造化して記録する命題」であり、「客観的事実」とは定義されていない。  
`values` カテゴリも既に「価値観（主観的立場）」を格納している。`opinions` も同様の扱いで一貫している。

### 既存カテゴリ名との整合性

既存の `childhood`、`education`、`career`、`life_events` は L3 の年表データとして `life_timeline` に重複するケースがある（設計意図通り）。  
これらカテゴリを削除・統合すると既存データに影響するため、本設計では触れない。
