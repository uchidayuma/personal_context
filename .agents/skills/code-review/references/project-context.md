# プロジェクトコンテキスト：Sales Management Laravel

このファイルは、本プロジェクト固有の設計ルールを定義します。
Claude はレビュー時、必ず以下のルールを最優先で適用してください。

---

## 1. プロジェクト構造

Laravel の標準構成に従い、責務を明確に分離します。

-   **`app/Http/Controllers/`**: リクエストの制御のみ。ビジネスロジックは書かない。
-   **`app/Models/`**: データの構造とリレーションを定義。
-   **`app/Services/`**: 複雑なビジネスロジックを集約（Service レイヤーの採用）。
-   **`app/Http/Requests/`**: バリデーションルールを定義。
-   **`resources/views/`**: Blade テンプレートによるフロントエンド表示。

## 2. ファイル命名規則

統一感を保つため、以下の命名を徹底します。

-   **コントローラー**: `PascalCaseController.php`（例: `OrderController.php`）
-   **モデル**: `PascalCase.php` / 単数形（例: `Product.php`）
-   **サービス**: `PascalCaseService.php`（例: `SalesCalculationService.php`）
-   **マイグレーション**: `YYYY_MM_DD_HHMMSS_create_table_name.php` / スネークケース（例: `create_orders_table.php`）
-   **テスト**: `PascalCaseTest.php`（例: `OrderTest.php`）

## 3. ロジック分離の原則

「Fat Controller」を避け、メンテナンス性の高いコードを維持します。

-   **バリデーション**: コントローラー内には書かず、FormRequest を使用します。
-   **ビジネスロジック**: 複数のモデルにまたがる処理や複雑な計算は、必ず `app/Services/` に記述します。
-   **データベース操作**: Eloquent を基本とし、クエリビルダを使用する場合は理由を明記します。

## 4. エラーハンドリングとログ

予期せぬエラーを防ぎ、追跡可能にします。

-   **例外処理**: 外部 API 連携や複雑な DB 操作には必ず `try-catch` を使用します。
-   **ログ出力**: 重要なエラーは `Log::error()` で詳細（スタックトレース等）を記録します。
-   **ユーザー通知**: 適切な例外をスローし、共通の例外ハンドラで処理します。

```php
// 良い例
public function store(StoreOrderRequest $request, OrderService $service)
{
    try {
        $service->createOrder($request->validated());
        return redirect()->route('orders.index')->with('success', '注文を作成しました');
    } catch (\Exception $e) {
        Log::error('注文作成失敗: ' . $e->getMessage());
        return back()->withInput()->withErrors('注文の作成に失敗しました');
    }
}

```

## 5. テスト要件

品質保証のため、以下の基準でテストを作成します。

-   **Feature テスト**: 主要なユースケース（CRUD 操作等）は必ず網羅します。
-   **Unit テスト**: Service クラスの複雑なロジックに対して作成します。
-   **日本語表記**: テストメソッド名、または `@test` アノテーションを用いて、テスト内容を日本語で記述することを推奨します。

## 6. 既存パターンの参照

新しいコードを追加する際は、以下のディレクトリの実装パターンを参考にしてください。

-   `app/Services/`: 既存のサービス実装パターン。
-   `database/factories/`: テストデータの生成パターン。
-   `tests/Feature/`: 既存の機能テストの記述方法。

**重要**: レビュー時に「Laravel のベストプラクティス」や「既存の Service パターン」から逸脱している場合は、修正を強く提案してください。
