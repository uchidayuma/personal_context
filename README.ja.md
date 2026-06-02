# 自分コンテキスト

**あなたという人間を、AIが本当に理解できる形で記録する。どのLLMにも使える、あなた専用のコンテキストエンジン**

![alt](https://github.com/user-attachments/assets/3dda5660-8ac2-44ef-9a59-acd3a1c0f7e4)

自分コンテキストでは、2つの課題を解決します。

1. 自分自身を理解する
2. 特定のAIサービスに縛られない、**自分ファイル**を作る

[最終アウトプット例はこちら](https://github.com/uchidayuma/personal_context/tree/main/output_example/ja)

毎日少しずつインタビューに答えるだけで、自分自身を理解できる。

エンジンが静かにあなたの構造化された知識ベースを育てていく。

Claude、Gemini、ChatGPT、Cursor、どのLLMにもプレーンなMarkdownでエクスポート可能。

https://github.com/user-attachments/assets/f1423bed-72e4-48d6-916a-8123d4bdfe38

> AIの回答の解像度を上げたい人、または自分という人間をまるっとMarkdown化したい人のために。

[![CI](https://github.com/uchidayuma/personal_context/actions/workflows/ci.yml/badge.svg)](https://github.com/uchidayuma/personal_context/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-required-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

*English README: [README.md](README.md)*

---

## 自分コンテキストの3コアモデル
![image](https://github.com/user-attachments/assets/dcbec033-1b1d-4910-93d2-addddd3fe231)

| レイヤー | 深さ | 表現するもの | 出力ファイル |
| :--- | :--- | :--- | :--- |
| CORE | 最深部 | 不変の価値観、核心にある信念、生まれ持った気質。あなたという存在の土台。 | `L01`, `L02` |
| SHAPE | 中等度 | 獲得した経験、行動パターン、人間関係、明確なスタンス（立場）。 | `L03` - `L08` |
| STATE | 表面層 | 現在の目標、進行中のプロジェクト、セッションにおける直近の好み。 | `L09`, `L10` |

## ライブデモ

**インストール不要で試せます：** [personal-context-demo.fly.dev/](https://personal-context-demo.fly.dev/)

> **注意：** デモはRenderの無料プランで動いています。しばらくアクセスがなかった場合、初回表示まで **約30秒** かかることがあります。これは正常な動作です。
>
> デモセッションは揮発性です。タブを閉じるとデータが消えます。1IPあたり1日1セッションまで。

---

## 2つの課題

### LLMのメモリ機能は閉じられている

主要なLLMプラットフォームにはそれぞれメモリ機能があります。

でも、あなたのコンテキストはそれぞれの中に閉じ込められている。

ClaudeのメモリをChatGPTに持ち込めないし、ChatGPTの履歴をCursorに持ち込めない。

### あなた自身も本当の自分を知らない

メモリがあっても、ほとんどのLLMはあなたのことを本当には*知らない*。

あなたが「言ったこと」は保存するが、あなたが「どういう人間か」は捉えられない。

それどころか、あなた自身も社会やSNSの声によって本当の自分を見失っている。

**自分について語ること**と**実際の行動**のギャップ——そこに最も重要なシグナルが眠っています。

## 解決策

自分コンテキストは、あなたのコンテキストを*外側から内側へ*組み立てる：

1. **パッシブ・インタビュー** — システムが質問する。あなたはただ答えるだけ。フォームを埋める必要も、ドキュメントを書く必要もない。
2. **行動からの抽出** — 質問は「考えていること」ではなく「していること」を引き出すために設計されている。お金と時間の使い方。体が軽くなる瞬間。うまくいっても消耗すること。
3. **ヴィネット優先の出力** — `"価値観: 自由"` というラベルではなく、場面を捉える：*「昇進を断った。理由を聞かれて『月曜の全体会議がなんか違う気がした』と言った。」* — 箇条書き十個より、この一文のほうがLLMに伝わる。
4. **ポータブルMarkdown** — コンテキストをプレーンなMarkdownファイルでエクスポート。コンテキスト層ごとに1ファイル。どのGem、GPT、システムプロンプトにも貼り付けられる。あなたのコンテキスト、あなたのルール。クラウドロックインなし、プラットフォーム依存なし。

---

## クイックスタート

**必要なもの**：Docker + Docker Compose

```bash
git clone https://github.com/uchidayuma/personal_context
cd personal_context

cp .env.example .env
```

`.env` を編集してLLMプロバイダーを選ぶ：

```bash
# 1つ選んで、対応するAPIキーをコメント解除：

LLM_PROVIDER=ollama
# LLM_PROVIDER=openai
# LLM_PROVIDER=anthropic
# LLM_PROVIDER=deepseek

# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# DEEPSEEK_API_KEY=sk-...
# OLLAMA_BASE_URL=http://host.docker.internal:11434/v1  # Docker経由の場合（Docker使用時のデフォルト）
```

**コンテキストが揃うまでの目安料金**（L1〜L10全レイヤー、約30〜50セッション）：

| プロバイダー | モデル | 目安料金 |
|---|---|---|
| Ollama | ローカルモデル（任意） | **無料** |
| OpenAI | gpt-4o-mini | 約$1 |
| DeepSeek | deepseek-chat | 約$1.5 |
| Anthropic | claude-haiku-3-5 | 約$5 |
| OpenAI | gpt-4o | 約$15 |
| Anthropic | claude-sonnet-3-5 | 約$20 |

> 実際の使用量に基づく推定値。セッションの長さや言語設定によって変動します。Ollamaはローカル実行のためAPIキー不要。

```bash
docker compose up
```

`http://localhost:5173` を開く — 最初のインタビューセッションを始めよう。

---

## 仕組み

```
インタビューセッション
    ↓
生の会話ログ（SQLite）
    ↓
LLMが抽出：事実 + 年表 + ヴィネット
    ↓
エクスポート：コンテキスト層ごとに1ファイル
    ↓
必要な層だけ選んでLLMに貼り付ける
```

**出力ファイル — コンテキスト層ごとに1ファイル：**

| ファイル | ゾーン | いつ使う |
|---|---|---|
| `_index.md` | — | 常に — LLM向けの読み方ガイド |
| `L01_values.md` | CORE | 常に |
| `L02_character.md` | CORE | 常に |
| `L03_life_timeline.md` | SHAPE | 人生の決断・転機の話題 |
| `L04_professional.md` | SHAPE | キャリアの話題 |
| `L05_relationships.md` | SHAPE | 人間関係の話題 |
| `L06_opinions.md` | SHAPE | 議論・意思決定 |
| `L07_fears.md` | SHAPE | 深い内省（非公開） |
| `L08_patterns.md` | SHAPE | 行動パターン（非公開） |
| `L09_goals.md` | STATE | 現在のタスクと方向性 |
| `L10_preferences.md` | STATE | セッション設定 |
| `life_chapters.md` | — | 常に — 行動シーン集 |

COREファイルはすべてのシステムプロンプトに入れる。SHAPEとSTATEは選択的に——その会話に必要なものだけ渡す。

→ 実際のエクスポートサンプルは [`output_example/`](output_example/) を参照。

---

## ヴィネットとは？

ヴィネットとは「行動シーン」です。その人の本質が、具体的な行動として現れた瞬間を記録します。

抽象的なラベルではなく：
```
価値観: 自由・自律
```

場面を切り取る：
```
title:   「羽が生えた」——成田空港での瞬間
quote:   「体がすごく軽くて、足に羽が生えたみたいだった。
          これが自分の生き方だと思った。あの瞬間に決めた。」
scene:   バックパック一つでベトナムへ向かう途中、成田空港を歩いていた。
         体の軽さが「こう生きたい」という確信になり、海外移住の起点になった。
insight: この人は身体感覚を人生の重大な決断の羅針盤として使っている。
         身体の判断が、論理的な熟考を上回る。
```

このような1つのヴィネットは、10個の特性リストよりもLLMに多くを伝えます。
ヴィネットは `life_chapters.md` に保存され、すべてのエクスポートに含まれます。

---

## MCPサーバー — どのAIツールからでも使える

コンテキストを一度育てたら、**MCPサーバー**経由でどのAIツールにも接続できます。

```bash
# MCPサーバーをビルド
pnpm --filter @personal-context/mcp build
```

### Claude Code

プロジェクトの `.claude/settings.json` に追加：

```json
{
  "mcpServers": {
    "personal_context": {
      "command": "node",
      "args": ["/path/to/personal_context/packages/mcp/dist/index.js"]
    }
  }
}
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` に追加：

```json
{
  "mcpServers": {
    "personal_context": {
      "command": "node",
      "args": ["/path/to/personal_context/packages/mcp/dist/index.js"]
    }
  }
}
```

### Cursor / Cline / Codex CLI

```json
{
  "mcpServers": {
    "personal_context": {
      "command": "node",
      "args": ["/path/to/personal_context/packages/mcp/dist/index.js"]
    }
  }
}
```

接続後、AIツールは `get_context` を呼び出してあなたのコンテキストを取得します。COREレイヤーは自動的に読み込まれ、SHAPE/STATEレイヤーは必要に応じて取得されます。

---

## 設計哲学

**「どう感じたか」は「どう考えたか」よりも多くの真実を語る**

合理的な説明は、すでに社会的期待や自己イメージによってフィルタリングされています。

体の反応——体が軽くなった瞬間、日曜の憂鬱、予期しない興奮——それが生のシグナルです。

だからすべてのインタビュー質問は、内省ではなく、行動と感覚に根ざしています。

→ 設計の確信の全文は [docs/vision/PHILOSOPHY.md](docs/vision/PHILOSOPHY.md) を参照。

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| ランタイム | Node.js 22、TypeScript、pnpm monorepo |
| データベース | SQLite（`@libsql/client` + Drizzle ORM） |
| LLM | Vercel AI SDK — Ollama / OpenAI / Anthropic / DeepSeek |
| サーバー | Hono |
| フロントエンド | React + Vite |
| コンテナ | Docker (node:22-alpine) |

---

## プロジェクト構成

```
packages/
  server/   # Hono APIサーバー — DB、LLM、インタビューエンジン、エクスポート
  web/      # React + Viteフロントエンド
  mcp/      # MCPサーバー — Claude Code / Codex連携
docs/
  vision/          # PHILOSOPHY.md、PRD.md、CONTEXT_LAYERS.md
  spec/            # SPEC.md、openapi.yml、TESTING_DESIGN.md
  design/          # OUTPUT_DESIGN.md、INTERVIEW_POLICY.md
  features/        # 機能ごとの設計ドキュメント
  output_template/ # Markdown出力テンプレート（L01〜L10）
```

---

## コントリビューション

コントリビュートする前に [docs/vision/PHILOSOPHY.md](docs/vision/PHILOSOPHY.md) と [docs/design/OUTPUT_DESIGN.md](docs/design/OUTPUT_DESIGN.md) をお読みください。

このプロジェクトには強い思想があります——「何を作るか」より「なぜそう設計するか」を先に理解して欲しい。

---

## ライセンス

MIT — [LICENSE](LICENSE) を参照
