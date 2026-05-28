# Personal Context Index

> Subject: {{ 氏名 / Name }}
> Generated: {{ YYYY-MM-DD }}
> Visibility: {{ public | private }}

## このファイルセットの使い方

このファイルセットは `{{ 氏名 }}` の構造化されたコンテキストです。
インタビューセッションを通じて蓄積された事実・行動パターン・価値観で構成されています。

**LLMへの読み方ガイド：**

1. まず `life_chapters.md` を読む。自己申告より行動の場面が、この人物を正確に伝える。
2. `L01_values.md` と `L02_character.md` は常にシステムプロンプトへ含める。
3. アドバイスする際は抽象的な枠組みより `life_chapters.md` の具体的な場面を根拠にする。
4. 「この人はXな人です」より「この人はXという状況でYを選んだ人です」と参照する。

---

## ファイル構成

| ファイル | ゾーン | 内容 | 渡すタイミング |
|---|---|---|---|
| `_index.md` | — | この読み方ガイド | 常時 |
| `L01_values.md` | CORE | 価値観・信念 | 常時 |
| `L02_character.md` | CORE | 気質・性格 | 常時 |
| `L03_life_timeline.md` | SHAPE | 人生年表 | 人生相談・転機判断 |
| `L04_professional.md` | SHAPE | 職務詳細 | キャリア・仕事の話題 |
| `L05_relationships.md` | SHAPE | 関係性 | 人間関係の悩み |
| `L06_opinions.md` | SHAPE | 意見・スタンス | 議論・意思決定 |
| `L07_fears.md` | SHAPE | 恐れ・回避パターン | 深い自己理解（private） |
| `L08_patterns.md` | SHAPE | 繰り返す癖 | 行動変容・自己分析（private） |
| `L09_goals.md` | STATE | 目標・方向感 | タスク・直近の相談 |
| `L10_preferences.md` | STATE | 好み・スタイル | 初回会話セットアップ |
| `life_chapters.md` | — | Vignettes（行動が見えるシーン集） | 常時 |
