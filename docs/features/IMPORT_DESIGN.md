# Document Import 設計書

## 目的

職務経歴書・CV・LinkedInエクスポートなどのドキュメントをアップロードし、  
L3（人生年表）・L4（職務詳細）・structuredFacts を一括でデータベースに投入する。

インタビューの前に骨格データを用意することで、以降のインタビューを「深掘り」に集中させる。

---

## 対応フォーマット

| フォーマット | パーサー | 用途例 |
|---|---|---|
| PDF | `pdf-parse` | 職務経歴書PDF、履歴書 |
| CSV | Node.js 組み込み | LinkedInエクスポート |
| Excel (.xlsx) | `xlsx`（SheetJS） | 自作スプレッドシート |
| プレーンテキスト (.txt / .md) | そのまま使用 | Obsidianノート等 |

---

## アーキテクチャ

```
[Web UI]
  ↓ multipart/form-data (file)
POST /api/import
  ↓ ファイルタイプ判定
  ↓ テキスト抽出（pdf-parse / xlsx / csv / txt）
  ↓ LLM抽出プロンプト
  ↓ JSON: { timeline[], professional[], facts[] }
  ↓ DB保存（lifeTimeline / professionalRecords / structuredFacts）
  → { imported: { timeline: N, professional: N, facts: N } }
```

---

## 新規DBテーブル：professional_records（L4）

```sql
CREATE TABLE professional_records (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  role         TEXT,
  start_year   INTEGER NOT NULL,
  start_month  INTEGER,
  end_year     INTEGER,        -- NULL = 在職中
  end_month    INTEGER,
  description  TEXT,           -- 仕事内容・実績の詳細
  skills       TEXT,           -- JSON配列: ["React", "AWS", ...]
  source       TEXT NOT NULL DEFAULT 'import',  -- 'import' | 'interview'
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

既存の `lifeTimeline` と `structuredFacts` は変更なし。

---

## LLM抽出プロンプト設計

テキストを渡してJSONを返させる。ハルシネーションを防ぐため**文書に明示されていない情報は推測しない**ルールを明示する。

```
以下の文書から構造化データを抽出してください。
文書に書かれていないことは推測しないでください。

## 抽出対象

1. **timeline**: 年・月・出来事（転職、転居、進学、病気など年単位のイベント）
2. **professional**: 会社名、役職、在籍期間、仕事内容
3. **facts**: その人に関する重要な事実（スキル、資格、使用技術など）

## 出力形式（JSON）
{
  "timeline": [
    { "year": 2019, "month": 4, "description": "○○株式会社に入社" }
  ],
  "professional": [
    {
      "companyName": "○○株式会社",
      "role": "エンジニア",
      "startYear": 2019, "startMonth": 4,
      "endYear": 2022, "endMonth": 3,
      "description": "Reactを使ったフロントエンド開発、チームリード",
      "skills": ["React", "TypeScript"]
    }
  ],
  "facts": [
    { "category": "スキル", "fact": "TypeScript 5年以上の経験" }
  ]
}

## 文書
{document_text}
```

---

## APIエンドポイント

```
POST /api/import
Content-Type: multipart/form-data

Fields:
  file: File (PDF / CSV / XLSX / TXT / MD)

Response 200:
  {
    imported: {
      timeline: number,
      professional: number,
      facts: number
    },
    preview: {
      timeline: { year, month, description }[],
      professional: { companyName, role, startYear, endYear }[],
      facts: { category, fact }[]
    }
  }

Response 400:
  { error: "unsupported file type" | "parse failed" | ... }
```

ファイルサイズ上限：5MB

---

## Web UI

### アップロードコンポーネント（ImportUpload）

- オンボーディング開始画面の前に配置（スプラッシュ画面の次）
- ドラッグ＆ドロップ + ファイル選択ボタン
- アップロード後：インポート結果プレビュー（何件取り込まれたか）
- スキップボタン（CVがない人向け）

```
┌────────────────────────────────────────────────────┐
│  職務経歴書をアップロード（任意）                     │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  PDF / Excel / CSV をここにドロップ           │  │
│  │  または クリックして選択                      │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  [スキップしてインタビューへ]                        │
└────────────────────────────────────────────────────┘

↓ アップロード後

┌────────────────────────────────────────────────────┐
│  ✓ インポート完了                                   │
│                                                    │
│  職務履歴   5件                                     │
│  年表イベント  8件                                  │
│  スキル・事実  12件                                 │
│                                                    │
│  [インタビューを始める]                              │
└────────────────────────────────────────────────────┘
```

---

## 依存ライブラリ（server）

```json
"pdf-parse": "^1.1.1",
"xlsx": "^0.18.5"
```

CSV はNode.js標準の `readline` で処理する（追加ライブラリ不要）。

---

## 実装スコープ（今回）

- [ ] `professional_records` テーブル追加（マイグレーション）
- [ ] `POST /api/import` ルート実装
- [ ] テキスト抽出ユーティリティ（PDF・XLSX・CSV・TXT）
- [ ] LLM抽出関数
- [ ] `ImportUpload` コンポーネント（Web）
- [ ] オンボーディングフローへの組み込み（スプラッシュ → インポート → インタビュー）

---

## スコープ外（今回やらない）

- 既存データとの重複チェック・マージ（初回インポートのみ想定）
- 複数ファイルの同時インポート
- インポート済みレコードの編集UI
- LinkedIn URL からの自動スクレイピング
