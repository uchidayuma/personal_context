# インタビュー疲れ対策 UX 設計書

## 問題

インタビューが深掘り連続で疲れる。「終わりが見えない」「やめたくても止め方がわからない」体験がモチベーション低下を招く。

実際のセッション計測では、`MAX_FOLLOWUPS_PER_QUESTION = 2` の設定があるにもかかわらず、AIが8回以上フォローアップを続けたケースが確認された。現在の実装は **AIへの指示（ソフト制約）** に過ぎず、AIが無視しても止める仕組みがない。

---

## 解決策：フォローアップ上限の強制（根本対策）+ 3機能の UX 改善

### 根本対策：サーバー側でフォローアップ上限を強制

**現状の問題**: `MAX_FOLLOWUPS_PER_QUESTION = 2` はシステムプロンプトへの「お願い」に過ぎない。AIが守らなくてもサーバーは止めない。

**対策**: `processMessage` 内で、AIのレスポンスを受け取った**後**にサーバー側で判定を上書きする。

```typescript
// engine.ts の processMessage 内
const { response, askedFollowup, shouldEndSession } = await generateInterviewResponse(...)

// サーバー側で強制上書き
const effectiveAskedFollowup =
  session.followupCount >= MAX_FOLLOWUPS_PER_QUESTION
    ? false          // AIがtrueを返しても強制的にfalseにする
    : askedFollowup
```

`effectiveAskedFollowup` を以降の処理（followupCount更新・次の質問選択）に使うことで、AIの判断に依存せずターン数を管理する。

**影響**: `MAX_FOLLOWUPS_PER_QUESTION = 2` なら、1トピックあたり最大3ターン（初回回答 + フォローアップ2回）で必ず次の質問へ進む。セッション全体では最大 `3 × (2+1) = 9ターン`。

---

## UX改善：3機能の同時実装

### 機能2：中断ボタン（セッションを今すぐ終了）

インタビュー中いつでも終了できる。押した時点の会話からファクト抽出を実行する。

**UI**: 入力エリアの左端に「終了」ボタンを追加（セッション active 中のみ表示）

```
[ 🎧 ][ 🎤 ][ textarea              ][ 送信 ]
[終了]
```

**API**: `POST /api/sessions/:id/end`
- セッションを `completed` に更新
- `extractAndSaveFacts` を実行してDBに保存
- 返却: `{ ok: true }`

---

### 機能4：あと何問表示

今のセッションで残り何問あるかを常時表示。終わりが見えることで安心感を作る。

**UI**: ProgressHeader の右端（パーセント表示の隣）に常時表示

```
コンテキスト充足度  ████░░  47%   あと2問  [▾]
```

- オンボーディング中は非表示（ターン数の概念が異なるため）
- セッションがない（新規）場合は非表示

**API**: `/api/chat` のレスポンスに `remainingTurns: number | null` を追加

```json
{
  "response": "...",
  "shouldEnd": false,
  "remainingTurns": 2
}
```

`remainingTurns = MAX_QUESTIONS_PER_SESSION - session.questionsAsked`（残り主質問数）

根本対策（フォローアップ上限の強制）により、残り主質問数 × 最大3ターンが実際の上限になるため、この数値は信頼できる指標になる。

セッションタイプが `onboarding` の場合は `null` を返す。

---

### 機能5：パスボタン（この質問をスキップ）

今の質問に答えたくないとき、ペナルティなく次の質問へ進める。

**UI**: AIが新しい主質問を出した直後（フォローアップでないとき）にのみ表示

```
[ この質問をパス → ]
```

フォローアップ中（`askedFollowup: true` の直後）は非表示。

**API**: `POST /api/sessions/:id/skip`
- 現在の question を `userQuestions` に記録（再出題されないよう）
- 次の質問を `selectNextQuestion` で取得
- 次の質問の opening メッセージを AI で生成して返却
- 返却: `{ message: string, remainingTurns: number | null }`

---

## API 変更まとめ

| エンドポイント | 変更種別 | 内容 |
|---|---|---|
| `POST /api/sessions/:id/end` | **新規** | セッションを即終了・ファクト抽出 |
| `POST /api/sessions/:id/skip` | **新規** | 現在の質問をスキップし次の質問を返す |
| `POST /api/chat` response | **変更** | `remainingTurns: number \| null` を追加 |

→ `docs/spec/openapi.yml` を先に更新する。

---

## フロントエンド変更まとめ

| ファイル | 変更内容 |
|---|---|
| `Chat.tsx` | 中断ボタン・パスボタンの追加、`remainingTurns` state 管理 |
| `ProgressHeader.tsx` | `remainingTurns` prop を受け取り「あと○問」表示 |
| `i18n/ja.json`, `en.json` | 新しいラベルの追加 |

---

## 実装順序

1. サーバー：`processMessage` にフォローアップ上限の強制を追加（根本対策・最優先）
2. `docs/spec/openapi.yml` 更新
3. サーバー：`/api/chat` に `remainingTurns` 追加
4. サーバー：`POST /api/sessions/:id/end` 実装
5. サーバー：`POST /api/sessions/:id/skip` 実装
6. サーバーテスト追加
7. フロントエンド：3機能の UI 実装

---

## 対象外

- `MAX_QUESTIONS_PER_SESSION` の変更（現在は 3。別途チューニング可能）
- オンボーディングフローへの影響なし（パス・残り問数は非表示）
