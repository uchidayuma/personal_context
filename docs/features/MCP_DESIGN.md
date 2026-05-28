# MCP Server 設計

## Why

personal_context が蓄積したコンテキストを、Claude Code・Codex CLI などの外部LLMツールから直接取得できるようにする。  
インタビューで育てたコンテキストが、日常のコーディング・思考整理・意思決定の場面でも自動的に活きるようにすることが目的。

---

## アーキテクチャ

### 新パッケージ: `packages/mcp/`

```
packages/mcp/
  src/
    index.ts        # MCPサーバーのエントリポイント
  package.json
  tsconfig.json
```

### 通信方式: stdio

Claude Code・Codex CLIはいずれもstdio transportを標準サポートしている。  
HTTP/SSEは不要（ローカル専用ツールのため）。

### DBアクセス方式: 直接import

`packages/server/src/export/markdown.ts` の `exportToMarkdown()` を直接importする。  
Webサーバーが起動していなくても動作するため、Claude Codeの起動時などに依存関係が生じない。

---

## 公開リソース（Resources）

LLMが `list_resources` で発見し、`read_resource(uri)` で取得する。

| URI | 説明 | 対応レイヤー |
|---|---|---|
| `context://index` | 全ファイルの読み方ガイド。最初に読む。 | `_index.md` |
| `context://life-chapters` | インタビューから抽出した行動シーン集。人物理解の最優先資料。 | `life_chapters.md` |
| `context://values` | 価値観・信念・譲れないこと | L1 |
| `context://character` | 気質・才能・自然な行動傾向 | L2 |
| `context://life-timeline` | 幼少期〜現在の人生年表と転換点 | L3 |
| `context://professional` | 職歴・スキル・代表プロジェクト | L4 |
| `context://relationships` | 重要な人間関係とそのパターン | L5 |
| `context://opinions` | 仕事・社会・業界への意見・スタンス | L6 |
| `context://fears` | 恐れ・回避パターン（private） | L7 |
| `context://patterns` | 繰り返す行動癖（private） | L8 |
| `context://goals` | 現在の目標・方向感 | L9 |
| `context://preferences` | 作業スタイル・コミュニケーション好み | L10 |

**privateリソース（fears / patterns）について**  
デフォルトでは返す。ユーザーが環境変数 `MCP_INCLUDE_PRIVATE=false` を設定した場合は除外する。

---

## 公開ツール（Tools）

### `get_context`

```typescript
get_context(options?: {
  layers?: string[]         // 取得するリソース名（省略時はCOREセット）
  include_private?: boolean // デフォルト: true
})
```

**layersのデフォルト（省略時）**: `["life-chapters", "values", "character"]`  
→ 最も重要なCOREコンテキストを1回の呼び出しで返す。

**返り値**: 各レイヤーのMarkdownを結合した文字列。

**使用例**（LLMが自律的に呼ぶイメージ）:
```
// コーディング支援時
get_context({ layers: ["preferences", "goals"] })

// キャリア相談時  
get_context({ layers: ["values", "life-chapters", "professional"] })

// フルコンテキスト取得
get_context({ layers: ["index", "life-chapters", "values", "character"] })
```

---

## ツール設定ガイド（README記載用）

### Claude Code

```json
// .claude/settings.json（プロジェクトルートに追加）
{
  "mcpServers": {
    "personal_context": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"]
    }
  }
}
```

### Claude Desktop

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "personal_context": {
      "command": "node",
      "args": ["/path/to/personal_context/packages/mcp/dist/index.js"]
    }
  }
}
```

### Cursor

```json
// ~/.cursor/mcp.json（グローバル）
// または .cursor/mcp.json（プロジェクト）
{
  "mcpServers": {
    "personal_context": {
      "command": "node",
      "args": ["/path/to/personal_context/packages/mcp/dist/index.js"]
    }
  }
}
```

### Cline（VS Code拡張）

VS Code の設定（`settings.json`）に追加：

```json
{
  "cline.mcpServers": {
    "personal_context": {
      "command": "node",
      "args": ["/path/to/personal_context/packages/mcp/dist/index.js"]
    }
  }
}
```

### Codex CLI

```json
// ~/.codex/config.json
{
  "mcpServers": {
    "personal_context": {
      "command": "node",
      "args": ["/path/to/personal_context/packages/mcp/dist/index.js"]
    }
  }
}
```

### 環境変数

| 変数 | デフォルト | 説明 |
|---|---|---|
| `DB_PATH` | `./data/personal_context.db` | SQLiteファイルのパス |
| `MCP_INCLUDE_PRIVATE` | `true` | fears/patternsを含むか |

---

## 依存パッケージ

```json
// packages/mcp/package.json（追加するもの）
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.x"
  }
}
```

`@modelcontextprotocol/sdk` はAnthropic公式のMCP TypeScript SDK。

---

## CLAUDE.md への追記

ドキュメント一覧に以下を追加:

```
| `docs/features/MCP_DESIGN.md` | MCPサーバーの設計（Claude Code / Codex連携） |
```
