# 残タスク

## UI / UX

- [ ] **L1〜L10ラベルの説明画像**  
  初見ユーザーにL1〜L10の概念が伝わらない。ImportUploadのプレビュー画面やオンボーディングに、レイヤー構造のコンセプト画像（またはインライン説明テキスト）を追加する。  
  対象: `ImportUpload.tsx` のプレビューセクション上部

- [ ] **L3 人生年表バーが職務経歴書だけで満杯になる問題**  
  現在 `threshold: 10`（`progress.ts:39`）のため、職歴18件でバーが100%を超える。  
  人生年表は幼少期〜現在まで網羅するものであり、職務経歴書だけでは完成しない。  
  対応案:  
  - thresholdを引き上げる（例: 30件）  
  - または `source = 'import'` のイベントは「インポート済み」として別表示し、インタビューで埋めた件数を別カウントする  
  対象: `packages/server/src/routes/progress.ts:39`

## テスト

- [ ] **サーバーUnitテスト実装**  
  設計: `docs/spec/TESTING_DESIGN.md`  
  ツール: Vitest + jest-openapi + Hono app.request()  
  対象ルート: sessions / chat / user / import / export / progress

- [ ] **フロントUnitテスト実装**  
  設計: `docs/spec/TESTING_DESIGN.md`  
  ツール: Vitest + jsdom + @testing-library/react + MSW

- [ ] **E2Eテスト実装（将来フェーズ）**  
  設計: `docs/spec/TESTING_DESIGN.md`  
  ツール: Playwright  
  シナリオ: オンボーディング完了 / インポート→ダッシュボード反映 / チャット→エクスポート

## インフラ / 運用

- [ ] **LLMプロバイダー切替UX**  
  現状: DeepSeek APIが東南アジアから繋がらない場合に無限待ち（60秒タイムアウト追加済み）  
  UIまたはドキュメントでOpenAI/Anthropicへの切替手順を案内する

## 完了済み

- [x] VoiceMode コンポーネント実装
- [x] AIコメントのトーン修正（温かいライフコーチ調）
- [x] ImportUpload プレビューをレイヤー進捗バー + life_chapters.md に変更
- [x] Dockerfileから packages/core 参照を削除
- [x] Docker BuildKitキャッシュマウント追加
- [x] DB_PATHを絶対パスに修正（packages/server/data → /app/data）
- [x] reset-dbスクリプトにDockerサーバー再起動を追加
- [x] インポート重複問題: source フィールド追加 + replace-on-reimport実装
- [x] オンボーディングサーバークラッシュ修正（DEFAULT_USER_ID import先変更）
- [x] インポート成功時にオンボーディング完了扱いにする
- [x] LLM呼び出し全箇所に60秒タイムアウト追加
