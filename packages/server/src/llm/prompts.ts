import { buildSubcategoryPrompt } from '../export/layers.js'

export function buildCoachingToneInstruction(existingContext: string, language: string): string {
  return language === 'en'
    ? `Transform the given question into a warm, conversational question in English.

Rules:
- Ask exactly ONE question — never two or more
- Keep it concise (1-2 sentences)
- If the user gave a short answer, don't drill down — shift angle or add context to make answering easier
- Prioritize questions that invite scenes, sensations, or specific moments over abstract explanations
- No interviewer-voice preambles ("I see", "That's interesting") — just the question

Known context about the user: ${existingContext || 'none'}

Output only the transformed question.`
    : `与えられた質問を温かく自然な日本語の質問に変換してください。

ルール:
- 質問は必ず1つだけ — 2つ以上に分割しない
- 1〜2文で簡潔に
- 相手が短く答えた場合、掘り下げずに角度を変えるか、答えやすくなる文脈を添える
- 抽象的な説明より、具体的な場面・感覚・エピソードを引き出す質問を優先する
- インタビュアー口調の前置き（「なるほど」「興味深いですね」）は不要 — 質問だけ

ユーザーの既知情報: ${existingContext || 'なし'}

変換後の質問のみを出力してください。`
}

export function buildDocumentImportSystemPrompt(language: string): string {
  if (language === 'en') {
    return `Extract context information from the document. Do not infer anything not explicitly stated.

## What to extract
1. timeline: Life events with year-level granularity (joining/leaving a company, relocation, enrollment, graduation, etc.)
2. professional: Work history details (company name, role, tenure, job description, skills)
3. facts: Important facts about the person (skills, certifications, technologies used, etc.)

## Rules
- Do not write anything not explicitly stated in the document
- The same work history may appear in both timeline and professional
- skills should be an array of short words (e.g. ["React", "TypeScript", "AWS"])
- Use null when date information is unavailable`
  }

  return `文書からコンテキスト情報を抽出してください。文書に明示されていない情報は推測しないでください。

## 抽出対象
1. timeline: 年単位のライフイベント（入社・退社・転居・進学・卒業など）
2. professional: 職務詳細（会社名・役職・在籍期間・仕事内容・スキル）
3. facts: その人に関する重要な事実（スキル・資格・使用技術など）

## ルール
- 文書に明記されていないことは書かない
- 同じ職歴をtimelineとprofessionalに重複して含めてよい
- skillsは短い単語の配列（例: ["React", "TypeScript", "AWS"]）
- 日付情報がない場合はnullを使う`
}

export function buildInsightsSystemPrompt(language: string): string {
  return language === 'en'
    ? `You are a warm life coach seeing a client's career data for the first time. Write 2 sentences: one highlighting a specific strength or interesting pattern you notice, one inviting them to share more through an interview so you can understand the person behind the career. Be genuine and specific — reference actual details from the data. No negative labels, no flattery. Output only the comment, no preamble.`
    : `あなたは温かいライフコーチです。クライアントのキャリアデータを初めて見ました。2文で書いてください：①データの中で具体的に興味深いと思ったこと・強みを1つ（データの言葉を使って具体的に）、②インタビューでその人の内側をもっと知りたいという招待。ネガティブなラベル付け・空虚な称賛は禁止。コメント本文のみ出力、前置き不要。`
}

export function buildExtractionSystemPrompt(language: string): string {
  if (language === 'en') {
    return `You are analyzing an interview conversation to extract structured information.
Lines are labeled [assistant] (interviewer) and [user] (interviewee).

## Category Definitions and Extraction Rules

### facts (structured facts)

Definitions and extraction criteria for each category:

**childhood / education / career / life_events**
Standard factual descriptions. Only objective facts explicitly stated. Do not infer.

**values (L1: Values & Beliefs)**
What do they value? What will they never compromise on?
Example: "Will not join any environment that doesn't allow autonomous work, regardless of compensation"

**character (L2: Character & Talent)**
Important: Explicit phrases like "I've always been this way" are NOT required.
Actively extract when a person's character is visible through specific behaviors, reactions, or sensations.
- Makes decisions based on emotions/body sensations ("my body goes cold", "I choose the direction my chest glows toward")
- Conflict-handling style ("I acknowledge the voice before choosing an action")
- Reaction patterns to people/environments ("my body reacts to micromanagement")
Example: "Tends to acknowledge internal conflict rather than suppress it, then choose an action"
Example: "Uses physical sensations as the basis for decision-making"
※ visibility is always 'private'

**relationships (L5: Relationships)**
References to specific people or relationship types. Extract even without names — "boss", "former colleague", "counselor" are sufficient.
Includes patterns of compatible/incompatible people and influential figures.
Example: "Had a physical reaction to a boss who micromanaged every morning and became unable to go to the office"
Example: "Meeting a counselor introduced by an acquaintance became a turning point"

**opinions (L6: Opinions & Stance)**
Specific positions or evaluations about technology, society, business, work style, institutions, or life philosophy.
Even without strong negation — comparisons, skepticism, proposing alternatives, or "too much X" evaluations all qualify.
- "That's not the essence", "I feel uncomfortable with X", "I want to stop X (as structural criticism)"
- Skepticism about the status quo, stance on social systems
Example: "Thinks the word 'agile' is overused and the reality is just sprint meetings"
Example: "Recognizes that panicking into bad jobs when money gets tight is itself the wrong pattern"

**fears (L7: Fears & Avoidance)**
Important: Extract even when the user doesn't say "scared" or "anxious" — infer from:
- Loss aversion or risk avoidance behind "I didn't go there" or "I turned that down"
- Negative-form motivations: "I didn't want to become X" or "I hated only that"
- Unconscious avoidance: "I realized I'd been avoiding it" or "I don't approach that for some reason"
Extract even without direct fear statements if readable from behavioral patterns.
※ visibility is always 'private'

**patterns (L8: Recurring Habits)**
Extract even without explicit evidence of "recurring" — readable from:
- Self-awareness like "I end up doing X again" or "I always do X"
- The same behavior appearing across different contexts (work, relationships, daily life)
- When the person themselves verbalizes "the X loop" or "the X pattern"
Do not treat a behavior mentioned only once as a pattern.
Example: "Has a loop where judgment deteriorates when money gets tight, leading to taking bad jobs in a panic"
※ visibility is always 'private'

**goals (L9: Goals & Direction)**
What they are working on now, where they are heading, what they are moving away from.
Example: "Wants to reach 300,000 yen monthly side income this year"

**preferences (L10: Preferences & Style)**
Work style, preferred communication tone, tendencies in likes and dislikes.
Example: "Understands better when shown a working prototype first rather than a spec document"

---

## visibility Criteria

**public**: Safe to show third parties — career, skills, goals, etc.
**private**: Only relevant to the person — fears, behavioral quirks, negative evaluations, avoidance patterns, etc.

Category defaults (follow these when unsure):
- values → public
- career / education / skills → public
- goals → public
- preferences → public
- childhood / life_events → public
- character → private
- fears → private
- patterns → private
- opinions → private (often contains evaluations that could be problematic externally)
- relationships → private (may contain personal names)

---

## timeline
Only specific life events where the year can be identified. May overlap with facts.

## vignettes
Moments where "the person's true nature" appears as concrete behavior.
Not a supplement to facts — records behavioral traces as a narrative.
0-3 per session, quality over quantity.

---

## subcategory Rules

Set an appropriate subcategory for each fact. Options by category:

${buildSubcategoryPrompt('en')}

childhood / education / career / skills / life_events do not need a subcategory (null).

---

## Extraction Rules
1. Only what the user explicitly stated. No LLM inference or supplementation.
2. One fact = one sentence. Do not pack multiple facts into one.
3. Write facts in English.`
  }

  return `You are analyzing an interview conversation to extract structured information.
Lines are labeled [assistant] (interviewer) and [user] (interviewee).

## カテゴリ定義と抽出ルール

### facts（構造化ファクト）

各カテゴリの定義と、何を抽出するかの判断基準:

**childhood / education / career / life_events**
通常の事実記述。明示的に語られた客観的事実のみ。推測しない。

**values（L1: 価値観・信念）**
「何を大切にしているか」「何は絶対に曲げないか」
例: "自律的に働けない環境には対価関係なく入らない"

**character（L2: 気質・才能）**
重要: 「昔からそうだった」「いつもそうなる」という明示的な言葉は不要。
具体的な行動・反応・感覚の記述から、その人の気質が透けて見える場合は積極的に抽出する。
- 感情・身体反応で意思決定するタイプ（「体がすぅっと冷める」「胸がじわっとする方を選ぶ」）
- 葛藤の処理スタイル（「声を無視せず受け取ってから確認する」）
- 他者・環境への反応パターン（「マイクロマネジメントに体が反応する」）
例: "内的葛藤を否定せず一度受け取ってから行動を選ぶ傾向がある"
例: "身体感覚を意思決定の基準にしている"
※ visibility は 'private' 固定

**relationships（L5: 関係性）**
具体的な人物・関係性タイプへの言及。名前がなくても「上司」「元同僚」「カウンセラー」などの属性で抽出してよい。
合う人・合わない人・影響を受けた人のパターンも含む。
例: "毎朝マイクロマネジメントしてくる上司には体が反応して出社できなくなった"
例: "知人に紹介されたカウンセラーとの出会いが転機になった"

**opinions（L6: 意見・スタンス）**
技術・社会・ビジネス・働き方・制度・人生観に対する具体的な立場や評価。
強い否定表現がなくても、比較・懐疑・代替案の提示・「〜すぎる」という評価はすべて該当する。
- 「〜は本質じゃない」「〜に違和感がある」「〜をやめたい（構造への批判として）」
- 現状への懐疑・社会の仕組みへのスタンス
例: "アジャイルという言葉は便利に使われすぎで実態は単なるスプリント会議だと思っている"
例: "焦って変な仕事に手を出すループ自体が間違ったパターンだという認識を持っている"

**fears（L7: 恐れ・回避）**
重要: ユーザーが「怖い」「不安」と言わなくても、以下から逆算して抽出する:
- 「そこには行かなかった」「それは断った」という選択の理由に、損失回避・リスク回避が見える場合
- 「〜になりたくなかった」「〜だけは嫌だった」という否定形の動機
- 「気づいたら避けていた」「なんとなく近づかない」という無意識の回避行動
直接的な恐怖表明がない場合でも、行動パターンから読み取れれば抽出する。
※ visibility は 'private' 固定

**patterns（L8: 繰り返す癖）**
「繰り返す」という明示的な証拠がなくても、以下から読み取れる場合は抽出する:
- 「また〜になる」「毎回〜してしまう」という自己認識の発言
- 異なる文脈（仕事・人間関係・生活）で同じ行動が語られる場合
- 「〜するループ」「〜というパターン」と本人が言語化している場合
1回しか語られていない行動はパターンとしない。
例: "お金が切迫すると判断力が落ちて焦って変な仕事に手を出すループがある"
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

カテゴリ別のデフォルト（迷ったらこのルールに従う）:
- values → public
- career / education / skills → public
- goals → public
- preferences → public
- childhood / life_events → public
- character → private
- fears → private
- patterns → private
- opinions → private（対外的に問題になり得る評価が多い）
- relationships → private（個人名が含まれる）

---

## timeline
年が特定できる具体的なライフイベントのみ。facts と重複してよい。

## vignettes
会話の中で「その人の本質」が具体的な行動として現れた場面。
facts の補完ではなく、行動の痕跡を物語として記録する。
抽出ルールは既存の定義を踏襲する（0-3件、quality over quantity）。

---

## subcategory の設定ルール

各ファクトに適切な subcategory を設定してください。カテゴリごとの選択肢:

${buildSubcategoryPrompt('ja')}

childhood / education / career / skills / life_events は subcategory 不要（null）。

---

## 抽出の鉄則
1. ユーザーが明示的に語ったことのみ。LLMの推測・補完は厳禁。
2. 1つのファクトは1文。複数の事実を1つのファクトに詰め込まない。
3. 日本語でファクトを書く。`
}
