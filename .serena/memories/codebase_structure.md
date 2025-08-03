# CQM コードベース構造

## ルートディレクトリ構成
```
cqm/
├── packages/           # モノレポパッケージ
├── docs/              # 設計文書（Obsidian Vault）
├── examples/          # 設定例・サンプル
├── tests/             # 統合テスト
├── docker/            # Docker設定
├── .github/           # GitHub Actions
└── tools/             # 開発ツール
```

## packages/ 詳細構造

### packages/server/ - MCPサーバー実装
```
src/
├── server/           # MCPサーバーコア
├── tools/            # MCP Tools実装
├── connection/       # 接続管理
├── transport/        # トランスポート層
├── plugin/           # プラグインローダー
├── config/           # 設定管理
├── error/            # エラーハンドリング
└── cli.ts           # CLI エントリーポイント
```

### packages/rag/ - RAGエンジン
```
src/
├── engine/          # RAGエンジンコア
├── vector/          # ベクトルストア（Qdrant）
├── embedding/       # 埋め込みプロバイダー
├── chunking/        # 文書チャンク処理
├── index/           # インデックス管理
├── cache/           # キャッシュ機構
└── config/          # RAG設定管理
```

### packages/shared/ - 共通ライブラリ
```
src/
├── types/           # 共通型定義
├── schemas/         # Zodスキーマ
├── constants/       # 定数
└── utils/           # ユーティリティ関数
```

### packages/cli/ - CLI実装
```
src/
├── commands/        # CLIコマンド実装
├── config/          # CLI設定
├── utils/           # CLI用ユーティリティ
├── cli.ts          # CLI実装
└── cli-bin.ts      # 実行ファイル
```

## docs/ 文書構造（Obsidian Vault）
```
docs/
├── 00_Overview/      # プロジェクト概要
├── 01_Requirements/  # 要件定義
├── 02_Architecture/  # システム設計
├── 03_Technical/     # 技術仕様
├── 04_MCP/          # MCP関連仕様
├── 05_Implementation/# 実装詳細
├── 06_Development/   # 開発ガイド
├── 07_Examples/      # 使用例
├── 08_Reference/     # API仕様
├── 09_Tasks/         # タスク管理
├── 10_Decisions/     # 設計判断記録
├── 11_Testing/       # テスト仕様
└── 12_Policies/      # 開発ポリシー
```

## 設定ファイル
- `package.json` - ルートパッケージ設定
- `turbo.json` - Turborepoビルド設定
- `tsconfig.json` - TypeScript設定
- `biome.json` - リント・フォーマット設定
- `vitest.config.ts` - テスト設定
- `.mcp.json` - MCP サーバー設定