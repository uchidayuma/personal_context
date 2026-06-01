# 自分コンテキスト

**あなたという人間を、AIが本当に理解できる形で記録する。どのLLMにも使える、あなた専用のコンテキストエンジン**

自分コンテキストでは、2つの課題を解決します。

1. 自分自身を理解する
2. 特定のAIサービスに縛られない、**自分ファイル**を作る

毎日少しずつインタビューに答えるだけで、自分自身を理解できる。

エンジンが静かにあなたの構造化された知識ベースを育てていく。

Claude、Gemini、ChatGPT、Cursor、どのLLMにもプレーンなMarkdownでエクスポート可能。

> AIの回答の解像度を上げたい人、または自分という人間をまるっとMarkdown化したい人のために。

[![CI](https://github.com/uchidayuma/personal_context/actions/workflows/ci.yml/badge.svg)](https://github.com/uchidayuma/personal_context/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-required-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

*English README: [README.md](README.md)*

---

## ライブデモ

**インストール不要で試せます：** [personal-context.onrender.com](https://personal-context.onrender.com/)

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
# OLLAMA_BASE_URL=http://localhost:11434/v1  # 省略可能（これがデフォルト）
```

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
