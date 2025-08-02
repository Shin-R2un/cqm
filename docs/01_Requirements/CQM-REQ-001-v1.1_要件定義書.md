---
document_id: CQM-REQ-001
version: v1.1
created: 2025-08-02
updated: 2025-08-02
author: Claude Code
reviewer: 
status: approved
tags: #CQM/Project #CQM/Requirements
related_docs:
  - CQM-POL-001
---

# CQM-REQ-001 要件定義書

## 1. プロジェクト概要

### 1.1 基本情報
- **プロジェクト名**: CQ Models!
- **CLIコマンド**: `cqm`
- **ライセンス**: MIT
- **コンセプト**: "CQ CQ CQ, calling all models!"

### 1.2 背景と目的
アマチュア無線の「CQ（各局呼び出し）」のメタファーで、複数のAIモデル（Claude, GPT, Gemini等）に統一的にコンテキストを提供する開発支援システムを構築する。

### 1.3 解決する課題
- 複数AIツール間でのコンテキスト断片化
- 開発状況の継続的な把握の困難さ
- AIツール切り替え時の情報喪失
- 個人開発における知識の蓄積不足

### 1.4 提供価値
- **統一コンテキスト**: どのAIモデルでも同じ開発コンテキストを参照
- **知識の永続化**: 開発履歴とパターンの蓄積
- **シームレスな切り替え**: AIツール間での自由な移動
- **プライバシー重視**: ローカル実行による完全な制御

## 2. ユースケース

### UC1: 新機能開発フロー

#### 1.1 アイデア・要件の壁打ち
**アクター**: 開発者、複数のAIモデル（Claude/Cursor/GPT等）  
**前提条件**: CQMサーバーが起動している

**基本フロー**:
1. 開発者が新機能のアイデアを任意のAIツールで相談開始
2. AIが `cqm` 経由で現在の開発状況を自動的に取得
   - 現在のプロジェクトフェーズ
   - 既存の技術スタックと実装パターン
   - 関連する過去のIssue/PR
   - 類似機能の実装履歴
3. どのAIモデルも同じコンテキストを基に最適な開発指針を提案
4. 開発者とAIの対話により要件を段階的に具体化
5. 対話の結果を要件仕様書として自動生成

**事後条件**: 要件仕様書がCQMのRAGシステムにインデックスされる

#### 1.2 Issue展開とProject作成
**アクター**: 開発者、AI、システム  
**前提条件**: 要件仕様書が作成されている

**基本フロー**:
1. 開発者がAIに「この要件をIssue化して」と依頼
2. AIが要件仕様書を解析し、機能単位でIssue案を生成
3. 開発者がIssue案をレビュー・承認
4. システムがGitHub APIを使用してIssueを一括作成
5. MCPサーバーがWebhook経由で変更を検知し、インデックスを更新

#### 1.3 設計・実装フロー
**アクター**: 開発者、AI  
**前提条件**: Issueが作成されている

**基本フロー**:
1. 開発者がIssueを選択し、作業開始を宣言
2. システムが自動的にブランチを作成
3. AIと協力して設計・実装を進める
4. 実装完了後、PRを発行

### UC2: GitHub統合経由でのコンテキスト共有

#### 2.1 Issueコンテキスト取得
1. 開発者がIssueを選択
2. CQMがGitHubプラグイン経由でIssue詳細を取得
3. 関連コードとドキュメントをRAGから検索し統合コンテキストを生成

#### 2.2 PRコンテキスト分析
1. PRが作成されるとWebhook経由でCQMに通知
2. 変更内容と関連ファイルを自動インデックス
3. AIクライアントが同期されたコンテキストでレビュー支援

### UC3: Issueステータス管理（共通）

**ステータス遷移**:
- todo → progress → in-review → done → cancelled

### UC4: バグ修正フロー

1. エラー内容をAIに報告
2. AIが類似エラーと解決策を検索
3. 修正方法を提案
4. バグ修正用Issueを作成

### UC5: 統合コンテキストベースの開発サポート

1. 開発者が「現在の状況は？」「次にすべきことは？」をAIに質問
2. CQMが現在のプロジェクト状態、未完了タスク、最近の変更を統合
3. AIが統一されたコンテキストを基に最適な作業提案を提供

### UC6: 技術的決定の記録と参照

1. アーキテクチャ決定をADRとして記録
2. 過去の決定理由を検索・参照

### UC7: マルチデバイス開発環境

1. 複数デバイスから同じコンテキストにアクセス
2. Obsidian連携でドキュメント同期

### UC8: 複数LLMからの統一アクセス

1. 状況に応じてAIツールを選択
2. どのツールからも同じコンテキストで作業

### UC9: 拡張可能な外部システム連携

1. WebhookProxyプラグイン経由での通知システム統合
2. プラグインシステムを通じた外部ツール連携（Obsidian、NotebookLM等）

## 3. 機能要件

### 3.1 コア機能

#### A. MCPサーバーコア
- 標準MCPプロトコル実装
- 複数AIモデルの同時接続対応
- プラグインローダー機構
- 設定管理システム

#### B. RAGエンジン
- ベクトルDB抽象化層（Qdrant対応）
- 埋め込みモデル抽象化
- インデックス管理
- カテゴリ別データ管理

#### C. CLI管理ツール (`cqm`)
```bash
# 基本コマンド
cqm start/stop/status/logs

# インデックス管理
cqm index list/stats/delete/rebuild

# プラグイン管理
cqm plugin list/install/enable/disable/config

# 接続管理
cqm connection list/stats/kick

# 設定管理
cqm config get/set/validate

# シークレット管理
cqm secret set/list/delete
```

#### D. プラグインシステム
- 統一プラグインインターフェース
- イベントシステム
- プラグイン間通信

### 3.2 公式プラグイン

1. **FileSystemプラグイン**（コア同梱）
   - ローカルファイル監視
   - 自動インデックス化

2. **GitHubプラグイン**
   - Issue/PR管理
   - Projects V2連携

3. **Obsidianプラグイン**
   - Vault監視
   - Markdown解析

4. **WebhookProxyプラグイン**
   - n8n連携
   - 通知機能

## 4. 非機能要件

### 4.1 パフォーマンス
- **コンテキスト取得**: < 100ms（通常）、< 500ms（初回/大容量）
- **インデックス更新**: < 500ms（ファイル単位）、< 30s（フルリビルド）
- **同時接続数**: 最大10クライアント
- **メモリ使用量**: < 1GB（基本）、< 2GB（大規模プロジェクト）

### 4.1.1 スケーラビリティ制限
- **ファイル数**: 10万ファイルまで（推奨）
- **総データ容量**: 50GBまで（推奨）
- **プラグイン数**: 20個まで（同時実行）
- **ベクトル次元**: 1536次元（OpenAI embedding）

### 4.2 可用性
- システム稼働率: 99.9%（ローカル）
- 自動復旧機能
- 日次バックアップ

### 4.3 セキュリティ
- シークレットの暗号化保存
- ローカル実行のみ
- アクセスログ記録

### 4.4 運用性
- 10分以内のセットアップ
- 設定ファイルによる管理
- ヘルスチェック機能
- 自動復旧とフォールバック機能

### 4.5 エラーハンドリング
- ベクトルDB接続失敗時のローカルファイル検索フォールバック
- プラグイン障害時の隔離機能
- 部分的サービス継続（コア機能のみ）
- エラー状態の自動診断とレポート

## 5. システムアーキテクチャ

### 5.1 全体構成
```
CQ Models! System
├── Core Components
│   ├── MCP Server (接続管理)
│   ├── RAG Engine (検索エンジン)
│   └── Plugin Loader (拡張機構)
├── Storage Layer
│   ├── Qdrant (ベクトルDB)
│   ├── SQLite (メタデータ)
│   └── File System (設定・ログ)
├── Adapters (各AIツール対応)
│   ├── Cursor Adapter
│   ├── Claude Adapter
│   └── Generic MCP Adapter
└── Plugins
    ├── FileSystem Plugin
    ├── GitHub Plugin
    └── Community Plugins
```

### 5.2 ディレクトリ構造
```
cq-models/
├── packages/
│   ├── core/           # MCPサーバーコア
│   ├── rag-engine/     # RAGエンジン
│   ├── cli/            # cqm CLI
│   └── plugins/        # 公式プラグイン
├── plugins/            # コミュニティプラグイン
├── examples/           # 設定例
├── docs/              # ドキュメント
└── docker/            # Docker設定
```

### 5.3 技術スタック
```yaml
言語/ランタイム:
  - TypeScript 5.3+
  - Node.js 20.x LTS

フレームワーク:
  - @modelcontextprotocol/sdk
  - Commander.js (CLI)
  - Fastify (API)

データストア:
  - Qdrant (ベクトルDB)
  - SQLite + Drizzle ORM
  - Redis (オプション)

ビルドツール:
  - Turborepo
  - tsup
  - Vitest
  - Biome
```

## 6. データモデル

### 6.1 バージョニングとマイグレーション

```typescript
// データスキーマバージョン管理
interface SchemaVersion {
  version: string;
  migrationRequired: boolean;
  backwardCompatible: boolean;
}

// マイグレーション定義
interface MigrationPlan {
  from: string;
  to: string;
  steps: MigrationStep[];
  rollbackSupported: boolean;
}
```

### 6.2 コアエンティティ

```typescript
// プロジェクトコンテキスト
interface ProjectContext {
  id: string;
  name: string;
  phase: 'idea' | 'requirements' | 'design' | 'development' | 'testing' | 'deployment';
  techStack: string[];
  currentTasks: Task[];
  metadata: Record<string, any>;
}

// インデックスメタデータ
interface IndexMetadata {
  id: string;
  category: string;
  source: {
    type: 'file' | 'github' | 'api' | 'manual';
    repository?: string;
    branch?: string;
    path?: string;
  };
  stats: {
    documentCount: number;
    totalTokens: number;
  };
}

// ドキュメント（RAG用）
interface Document {
  id: string;
  type: 'code' | 'doc' | 'issue' | 'pr' | 'comment';
  content: string;
  embedding: number[];
  metadata: DocumentMetadata;
}
```

### 6.2 設定ファイル仕様

```yaml
# cqm.yml
version: 1.0

core:
  name: "CQ Models!"
  logLevel: info
  port: 3000
  welcomeMessage: "CQ CQ CQ, calling all models!"

rag:
  vectorDB:
    type: qdrant
    config:
      url: http://localhost:6333
      collection: cqm
  
  embedding:
    type: openai
    config:
      model: text-embedding-3-small
      apiKey: ${OPENAI_API_KEY}

plugins:
  filesystem:
    enabled: true
    config:
      watchPaths: ["./src", "./docs"]
      ignore: ["node_modules", ".git"]
```

## 7. インターフェース仕様

### 7.1 Model Adapter Interface
```typescript
interface IModelAdapter {
  name: string;
  version: string;
  
  // 接続管理
  connect(config: AdapterConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // クエリ処理
  handleQuery(query: string, context?: QueryContext): Promise<Response>;
  
  // ツール登録
  getTools(): MCPTool[];
}
```

### 7.2 Plugin Interface
```typescript
interface IPlugin {
  metadata: PluginMetadata;
  
  // ライフサイクル
  initialize(context: PluginContext): Promise<void>;
  shutdown(): Promise<void>;
  
  // イベント処理
  onEvent(event: SystemEvent): Promise<void>;
  
  // 設定スキーマ
  getConfigSchema(): JSONSchema;
}
```

### 7.3 CLI Commands
```typescript
interface CLICommands {
  // サーバー管理
  start(options?: StartOptions): Promise<void>;
  stop(): Promise<void>;
  status(): Promise<ServerStatus>;
  
  // インデックス管理
  index: {
    list(filter?: IndexFilter): Promise<IndexInfo[]>;
    delete(criteria: DeleteCriteria): Promise<void>;
    stats(detailed?: boolean): Promise<IndexStats>;
  };
  
  // プラグイン管理
  plugin: {
    list(): Promise<PluginInfo[]>;
    install(name: string): Promise<void>;
    enable(name: string): Promise<void>;
    config(name: string, key: string, value: any): Promise<void>;
  };
}
```

## 8. セキュリティ仕様

### 8.1 シークレット管理
```yaml
優先順位:
  1. 環境変数（.env.local）
  2. OS Keychain
  3. 暗号化設定ファイル

実装:
  - dotenvサポート
  - keytar統合（オプション）
  - AES-256暗号化
```

### 8.2 アクセス制御
- **ネットワーク**: ローカルhost（127.0.0.1）のみバインド
- **認証**: APIトークンベース認証（プラグイン単位）
- **認可**: プラグイン別アクセス制御
- **監査**: 全接続とクエリのログ記録

### 8.3 データプライバシー
- **データ残存性**: 全データはローカル保存、外部送信なし
- **インデックス暗号化**: 機密ファイルの暗号化オプション
- **アクセスパターン**: クエリログの定期的なローテーション
- **メタデータ保護**: ファイルパス等の機密情報のハッシュ化

## 9. 実装計画

### Phase 0: Ultra-Minimal MVP（2週間）- "First Contact"

#### Week 1: 基礎実装
- 最小限のRAGエンジン（Qdrant + ローカルファイル）
- FileSystemプラグインのみ
- 基本的なCLI (`cqm start/stop/search/status`)

#### Week 2: Cursor統合
- Cursorアダプター実装
- 動作検証とドキュメント作成

**成果物**: Cursorから実際にコンテキスト検索できるシステム

### Phase 0.1: コンテキスト品質向上（2週間）- "Signal Enhancement"
- AST解析導入
- 時間的コンテキスト
- 検索アルゴリズム改善

### Phase 0.2: 複数モデル対応（2週間）- "Frequency Expansion"
- アダプターシステム確立
- Claude Desktop対応
- 接続管理機能

### Phase 1: 公式プラグイン（3週間）- "Plugin Wave"
- GitHubプラグイン（最小限）
- プラグインシステム整備
- ドキュメント充実

### Phase 2: エコシステム構築（4週間）- "Community Frequency"
- プラグイン開発キット
- GitHub完全統合
- Obsidianプラグイン

### リリースマイルストーン
- **v0.0.1** (2週間): Ultra-Minimal MVP
- **v0.1.0** (6週間): 実用最小版
- **v0.2.0** (9週間): プラグイン版
- **v0.5.0** (3ヶ月): エコシステム版
- **v1.0.0** (6ヶ月): 安定版

## 10. 成功指標

### 10.1 技術指標
- **コンテキスト検索精度**: 90%以上（関連度スコア0.8以上）
- **平均応答時間**: < 100ms（検索）、< 500ms（インデックス更新）
- **システム稼働率**: 99.9%（月次ベース）
- **メモリ効率**: < 1GB（1万ファイルインデックス時）
- **プラグイン起動時間**: < 5秒
- **インデックス精度**: false positive < 5%

### 10.2 採用指標
- GitHub Stars: 1,000+ (6ヶ月)
- npm週間DL: 1,000+ (6ヶ月)
- 対応AIモデル: 10+ (1年)

### 10.3 コミュニティ指標
- Discord参加者: 500+ (1年)
- プラグイン数: 20+ (1年)
- コントリビューター: 10+ (6ヶ月)

## 11. リスクと対策

### 11.1 技術リスク
| リスク | 影響度 | 対策 |
|--------|--------|------|
| MCPプロトコル変更 | 高 | アダプター層で吸収 |
| AIモデルAPI変更 | 中 | バージョニング対応 |
| スケーラビリティ | 中 | 段階的最適化 |

### 11.2 プロジェクトリスク
| リスク | 影響度 | 対策 |
|--------|--------|------|
| スコープクリープ | 高 | MVP優先、段階的拡張 |
| コミュニティ分散 | 中 | 明確なビジョン維持 |
| 品質のばらつき | 低 | レビューガイドライン |

### 11.3 品質保証戦略
- **自動テスト**: ユニット・統合・E2Eテストカバレッジ80%以上
- **プラグインテスト**: サンドボックス環境での隔離テスト
- **パフォーマンステスト**: ベンチマーク自動化
- **互換性テスト**: 複数OS・Node.jsバージョン対応
- **ユーザビリティテスト**: 開発者フィードバック統合

## 12. 付録

### 12.1 用語集
- **CQ**: アマチュア無線の呼び出し信号
- **MCP**: Model Context Protocol
- **RAG**: Retrieval-Augmented Generation
- **AST**: Abstract Syntax Tree

### 12.2 参考資料
- [MCP公式ドキュメント](https://modelcontextprotocol.io)
- [Qdrantドキュメント](https://qdrant.tech/documentation/)
- [TypeScript AST Viewer](https://ts-ast-viewer.com/)

### 12.3 開発環境要件

#### 最小要件
- **OS**: Linux, macOS, Windows (WSL2推奨)
- **Node.js**: 20.x LTS以上
- **メモリ**: 4GB以上（開発時8GB推奨）
- **ストレージ**: 10GB以上の空き容量

#### 推奨ツール
- **IDE**: VS Code + TypeScript/Node.js拡張
- **コンテナ**: Docker Desktop
- **バージョン管理**: Git 2.30+

### 12.4 MVP完了チェックリスト

#### Week 1
- [ ] Qdrant Docker起動確認
- [ ] 基本的なRAGエンジン動作
- [ ] FileSystemプラグイン完成
- [ ] cqm基本コマンド動作
- [ ] エラーハンドリング基礎実装

#### Week 2
- [ ] Cursorアダプター完成
- [ ] エンドツーエンド動作確認
- [ ] 基本的なテストスイート
- [ ] README.md作成
- [ ] デモ動画作成

---

*"CQ Models! - Your context, on air for all AI"*