# テスト設計

## 方針

テストを3層に分ける。

| 層 | ファイル命名 | DB | LLM | 目的 |
|---|---|---|---|---|
| Unit | `*.test.ts` | vi.mock | vi.mock | ルートのレスポンス形状・ステータスコード検証 |
| Feature | `*.feature.test.ts` | :memory: SQLite | vi.mock | DB操作を含む実際のデータフロー検証 |
| E2E | `e2e/*.spec.ts` | 実DB（テスト用） | 実LLM or モック | ユーザー操作を通じたシナリオ検証 |

このドキュメントはUnitテストの設計を主に対象とする。FeatureテストとE2Eは別途。

---

## サーバー (packages/server)

### ツール

| パッケージ | 用途 |
|---|---|
| `vitest` | テストランナー |
| `jest-openapi` | `openapi.yml` に基づくレスポンス自動検証 |

### テスト方針

- Honoの `app.request()` を使い、実HTTPサーバーを起動しない
- `vi.mock('../db/client.js')` でDB操作をモック
- `vi.mock('../llm/provider.js')` でLLM呼び出しをモック
- `expect(res).toSatisfyApiSpec()` で `docs/spec/openapi.yml` のschemaに対して自動検証

### テスト対象ルートと主なケース

**POST /api/sessions**
- 200: `{ sessionId: string, message: string }` を返す

**POST /api/sessions/onboarding**
- 200: `{ sessionId: string, message: string }` を返す

**POST /api/chat**
- 200: `{ response: string, shouldEnd: boolean }` を返す
- 400: `sessionId` または `message` が空のとき

**GET /api/user**
- 200: `{ name, language, onboardingCompletedAt }` を返す

**PATCH /api/user**
- 200: `{ ok: true }` を返す

**POST /api/import**
- 200: `{ imported, preview }` を返す
- 400: ファイルなし / サイズ超過 / 未対応拡張子

**GET /api/export**
- 200: `{ files: { index, lifeChapters, currentContext, identityProfile } }` を返す

**GET /api/progress**
- 200: レイヤーごとのカウントを返す

### ファイル構成

```
packages/server/src/
  routes/
    sessions.test.ts
    chat.test.ts
    user.test.ts
    import.test.ts
    export.test.ts
  test/
    setup.ts          # jest-openapi セットアップ
```

---

## フロントエンド (packages/web)

### ツール

| パッケージ | 用途 |
|---|---|
| `vitest` | テストランナー |
| `jsdom` | DOM環境 |
| `@testing-library/react` | コンポーネントテスト |
| `@testing-library/user-event` | ユーザー操作シミュレーション |
| `msw` | APIモック（Service Worker不使用、`msw/node` ハンドラ） |

### テスト対象コンポーネントと主なケース

**Chat**
- メッセージ送信でAPIが呼ばれること
- `shouldEnd: true` のとき入力が無効になること

**Onboarding**
- 完了時に `onComplete` コールバックが呼ばれること

**ImportUpload**
- ファイル選択でプレビューが表示されること
- インポート成功後に件数が表示されること

### ファイル構成

```
packages/web/src/
  components/
    Chat.test.tsx
    Onboarding.test.tsx
    ImportUpload.test.tsx
  test/
    setup.ts      # @testing-library/jest-dom セットアップ
    handlers.ts   # MSW ハンドラ定義
```

---

## E2E (packages/e2e) ※将来フェーズ

### ツール

| パッケージ | 用途 |
|---|---|
| `@playwright/test` | ブラウザ自動操作 |

### 方針

- `packages/e2e/` を独立パッケージとして作成
- docker compose でサーバー・フロントを起動した状態でテスト実行
- LLMはモックサーバー（MSW or Playwright route intercept）で差し替え、テストの安定性を確保
- 実DBを使うが、テスト前に専用のDB（`data/test.db`）を初期化

### 主なシナリオ候補

- オンボーディング完了フロー
- ファイルインポート → ダッシュボード反映
- チャットでメッセージ送受信 → エクスポートに反映

---

## openapi.yml との関係

`jest-openapi` はサーバーUnitテストのみで使用。フロントテストはMSWがAPIをモックするためopenapi.ymlは参照しない。

openapi.ymlに定義されていないエンドポイント（`/api/insights`, `/api/progress`など）はレスポンス形状をテスト内にインラインで定義する。
