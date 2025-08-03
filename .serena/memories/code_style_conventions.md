# CQM コードスタイル・規約

## TypeScript設定
- **strictモード**: 有効
- **ターゲット**: ES2022
- **モジュール**: ESNext
- **モジュール解決**: bundler

## Biome設定（フォーマット・リント）
- **インデント**: スペース2個
- **行幅**: 100文字
- **行終端**: LF
- **引用符**: シングルクォート
- **セミコロン**: 常に付与
- **トレイリングコンマ**: es5スタイル

## 命名規則
- **ファイル**: kebab-case（例: `github-plugin.ts`）
- **クラス**: PascalCase（例: `GitHubPlugin`）
- **インターフェース**: PascalCase + I接頭辞（例: `IPlugin`）
- **関数・変数**: camelCase
- **定数**: UPPER_SNAKE_CASE

## ディレクトリ構造
```
src/
├── types/          # 型定義
├── utils/          # ユーティリティ
├── config/         # 設定管理
├── plugins/        # プラグイン
└── __tests__/      # テスト
```

## import/export規約
- **絶対パス使用**: `@cqm/shared`等のエイリアス
- **名前付きexport優先**: default exportは最小限
- **自動import整理**: Biome enabled

## コメント・ドキュメント
- **JSDoc**: パブリックAPI必須
- **インライン**: 複雑なロジックのみ
- **言語**: 英語（技術文書）、日本語（ユーザー向け）

## エラーハンドリング
- **カスタム例外**: `CQMError`クラス使用
- **型安全**: `Result<T, E>`パターン推奨
- **ログ**: 構造化ログ + レベル分け