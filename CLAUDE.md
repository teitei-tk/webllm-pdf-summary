# CLAUDE.md

## プロジェクト概要
**webllm‑pdf‑summary** は契約書などの日本語 PDF をアップロードし、サーバーサイド（Next.js API）でテキスト抽出、クライアントサイド（WebLLM）で要約する PoC です。要約処理をローカルに閉じることで機密保持を検証します。

---

## 技術スタック
| レイヤ         | 技術・ライブラリ                             | 備考                                                                  |
| -------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| フロント       | Next.js 15 / React 19 / Material‑UI (v6)     | 画面は `/` のみ                                                       |
| LLM(ブラウザ)  | WebLLM (wasm + WebGPU)                       | M2 Pro 36 GB RAM 向けモデル：`phi‑3‑mini`、`llama‑3‑instruct‑8B‑Q4_0` |
| サーバ API     | Next.js API Route `/api/parse-pdf`           | `pdf-parse` または `pdfjs`、画像 PDF は `tesseract.js` で OCR 可      |
| 一時ストレージ | OS の `tmp` ディレクトリ                     | 処理後に削除                                                          |
| テスト         | **Vitest + Testing Library**                 | *TDD 徹底*                                                            |
| 静的解析       | **ESLint (`eslint:recommended`) + Prettier** | ―                                                                     |

---

## 機能要件

### UI / UX
- `/` 画面のみ：PDF 選択 ▶ スピナー ▶ 要約結果カード＋コピー
- 履歴・複数ファイル・認証なし
- `npm run dev` で即利用

### PDF 抽出（サーバ）
- 日本語フォント・表（改行＋タブ区切り）対応
- 画像 PDF なら `{ ocr: true }` を含めて JSON 返却
- エラー時は `{ "error": "message" }`

### 要約処理（クライアント）
- 4 000 文字／チャンクで分割 → 部分要約 → マージ要約
- 要約プロンプト
  ```text
  与えられた文章を日本語で 10 行以内に要約し、重要語に ★ を付与してください。
  ```
- 失敗時はトースト「要約に失敗しました」＋ `status` 保持

---

## 非機能・セキュリティ
| 項目             | 要件                                                     |
| ---------------- | -------------------------------------------------------- |
| 機密保持         | 抽出テキストのみフロント転送。PDF 本体・要約は保存しない |
| 性能目標         | 10 MB／200 ページ PDF を 30 秒以内に要約                 |
| アクセシビリティ | キーボード操作・`aria-label` 最低限                      |
| ロギング         | 開発時のみ `console.debug`、本番ビルドでは除去           |

---

## 🧑‍💻 開発ルール

### 1. TDD（テスト駆動開発）を実施する
コードを生成するときは必ず対応するユニットテストを生成し、`npm test` がパスすることを確認する。

```ts
// 例 – 足し算関数とテスト
function add(a: number, b: number) {
  return a + b;
}

test('1+2=3', () => {
  expect(add(1, 2)).toBe(3);
});
```

### 2. 各ファイルの冒頭に仕様コメントを記述する

```ts
/**
 * 2 点間のユークリッド距離を計算する
 */
type Point = { x: number; y: number };
export function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
```

### 3. Vitest で実装と同じファイルにユニットテストを書く

```ts
export function distance(a: Point, b: Point): number {
  /* ... */
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;
  test('ユークリッド距離を計算する', () => {
    const result = distance({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(result).toBe(5);
  });
}
```

### 4. コミットメッセージは Conventional Commits 形式
- `feat:` - 新機能
- `fix:` - バグ修正
- `docs:` - ドキュメント更新
- `style:` - コードフォーマット
- `refactor:` - リファクタリング
- `test:` - テスト追加・修正
- `chore:` - ビルド・設定関連

### 5. 品質チェックの必須実行
**すべてのタスク・コード編集完了後は必ず以下を実行し、エラーなしであることを確認する：**

```bash
npm run test          # テストの実行
npm run lint          # ESLintによる静的解析
npm run format:check  # Prettierによるフォーマットチェック
```

---

## ディレクトリ構成（案）

```text
webllm-pdf-summary/
├── app/
│   ├── page.tsx                 # ルート UI (PDF アップロード & 要約表示)
│   └── api/
│       └── parse-pdf/route.ts   # Edge/API Route – PDF→テキスト抽出
├── lib/
│   ├── pdf/
│   │   └── extract.ts           # サーバー側抽出ロジック
│   └── llm/
│       ├── chunk.ts             # 分割ユーティリティ
│       └── summarize.ts         # WebLLM 呼び出し
├── components/
│   └── SummaryCard.tsx          # プレゼンテーションコンポーネント
├── __tests__/                   # 統合テスト・E2Eテスト
├── docs/                        # 追加ドキュメント
│   ├── api.md                   # API仕様
│   └── deployment.md            # デプロイメント手順
├── package.json
├── vitest.config.ts
├── eslint.config.js
├── prettier.config.js
└── README.md
```

---

## 開発フロー

### 1. 機能開発時
1. 要件を明確化
2. テストケースを先に作成（TDD）
3. 実装
4. 品質チェック実行
5. コミット

### 2. プルリクエスト前
```bash
# 必須チェック項目
npm run test
npm run lint
npm run format:check
npm run build  # ビルドエラーがないことを確認
```

### 3. 定期的なメンテナンス
- 依存関係の更新
- テストカバレッジの確認
- パフォーマンス測定

---

## 今後の拡張アイデア

### 短期（v1.1）
- 画像 PDF 用 OCR パイプライン
- エラーハンドリングの強化
- ユーザビリティの改善

### 中期（v2.0）
- Cloudflare R2 + 署名付き URL で一時保存
- モデル選択 UI（phi‑3／llama‑3 etc.）
- SSE で要約進捗ストリーミング

### 長期（v3.0）
- 複数言語対応
- 要約設定のカスタマイズ
- API化・外部連携

---

## トラブルシューティング

### よくある問題
1. **WebLLMが動作しない**
   - WebGPU対応ブラウザの確認
   - メモリ不足の場合はモデルサイズを調整

2. **PDF抽出が失敗する**
   - ファイルサイズ制限の確認
   - 日本語フォントの埋め込み確認

3. **テストが失敗する**
   - 依存関係の更新
   - 環境変数の設定確認

### デバッグ方法
```bash
# 詳細ログ出力
DEBUG=true npm run dev

# テスト単体実行
npm run test -- --reporter=verbose

# 静的解析詳細
npm run lint -- --verbose