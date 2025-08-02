---
document_id: CQM-REQ-002
version: v1.0
created: 2025-08-02
updated: 2025-08-02
author: Claude Code
reviewer: 
status: draft
tags: #CQM/Project #CQM/Requirements
related_docs:
  - CQM-REQ-001
  - CQM-ARC-001
  - CQM-POL-001
---

# CQM-REQ-002 ユースケース仕様書

## 1. 概要

### 1.1 目的
CQMシステムのユースケースを詳細に定義し、実装フェーズで参照すべき具体的な動作仕様を提供する。

### 1.2 対象ユースケース
- **Phase 0対応**: Ultra-Minimal MVP実装に必要な基本フロー
- **基本RAG検索フロー**: ファイルシステム監視とコンテキスト検索
- **Cursor統合フロー**: Cursor Composerからのコンテキスト取得
- **エラーハンドリング**: 障害時の動作とフォールバック

### 1.3 前提条件
- Node.js 20.x LTS環境
- Qdrant 1.7+が稼働
- CQMサーバーが起動済み
- 対象プロジェクトフォルダに有効なコードが存在

## 2. Phase 0: Ultra-Minimal MVP ユースケース

### UC-001: 基本RAG検索フロー

#### UC-001-1: 初回セットアップとインデックス作成

**アクター**: 開発者  
**前提条件**: CQMがインストール済み、Qdrantが起動済み  
**トリガー**: `cqm start` コマンド実行

**基本フロー**:
```bash
1. 開発者: cqm start
2. システム: 設定ファイル (cqm.yml) を読み込み
3. システム: Qdrant接続確認
4. システム: FileSystemプラグイン初期化
5. システム: 監視対象ディレクトリをスキャン
   - デフォルト: ./src, ./docs, ./README.md
6. システム: ファイル種別判定 (.ts, .js, .md, .json等)
7. システム: 各ファイルのコンテンツを読み込み
8. システム: OpenAI Embedding生成 (text-embedding-3-small)
9. システム: Qdrantにベクトルとメタデータを保存
10. システム: MCPサーバー起動 (stdio)
11. システム: "CQ CQ CQ, calling all models! Ready." メッセージ表示
```

**成功時後処理**:
- ファイル監視が開始される
- MCPサーバーがクライアント接続を待機
- インデックス統計がログに出力される

**エラーハンドリング**:
```bash
# Qdrant接続失敗時
Error: Cannot connect to Qdrant at http://localhost:6333
Suggestion: 
  1. Start Qdrant: docker run -p 6333:6333 qdrant/qdrant
  2. Check connection: curl http://localhost:6333/health

# OpenAI API キー未設定時
Error: OpenAI API key not found
Suggestion:
  1. Set environment variable: export OPENAI_API_KEY=your_key
  2. Or add to .env file: OPENAI_API_KEY=your_key
```

**パフォーマンス要件**:
- 1,000ファイル以下: < 30秒
- 10,000ファイル以下: < 5分
- メモリ使用量: < 500MB

#### UC-001-2: リアルタイムファイル変更検知

**アクター**: 開発者、FileSystemプラグイン  
**前提条件**: CQMサーバーが起動済み、ファイル監視中  
**トリガー**: 監視対象ファイルの変更

**基本フロー**:
```bash
1. 開発者: エディタでsrc/utils.tsを編集・保存
2. FileSystemプラグイン: chokidar経由で変更検知
3. プラグイン: debounce処理 (500ms待機)
4. プラグイン: ファイル内容読み込み
5. プラグイン: 言語別パーサーで解析
   - TypeScript: AST解析、関数/クラス抽出
   - Markdown: セクション分割
   - JSON: 構造化データ抽出
6. プラグイン: チャンク分割 (最大1000トークン)
7. プラグイン: 埋め込み生成
8. プラグイン: Qdrantに更新 (upsert)
9. システム: EventBusに FILE_CHANGED イベント発行
10. システム: 接続中のMCPクライアントに変更通知 (オプション)
```

**後処理**:
- インデックス統計の更新
- 変更ログの記録
- キャッシュのクリア

**エラーハンドリング**:
```bash
# ファイル読み込みエラー
Warning: Cannot read file: src/large-binary.exe (binary file ignored)

# パーサーエラー
Warning: Failed to parse TypeScript file: src/broken.ts
  Syntax error at line 42
  File indexed as plain text

# 埋め込み生成エラー
Error: OpenAI API rate limit exceeded
  Retrying in 60 seconds... (1/3)
```

**パフォーマンス要件**:
- 単一ファイル更新: < 500ms
- 大容量ファイル (>100KB): < 2秒
- 同時変更 (10ファイル): < 5秒

#### UC-001-3: コンテキスト検索とレスポンス

**アクター**: AIモデル (Cursor)、MCPサーバー  
**前提条件**: インデックスが存在、MCPクライアント接続済み  
**トリガー**: MCPクライアントからのsearchDocumentsツール呼び出し

**基本フロー**:
```bash
1. Cursor: MCP searchDocuments ツール呼び出し
   {
     "query": "ユーザー認証の実装方法",
     "limit": 5,
     "threshold": 0.7
   }

2. MCPサーバー: リクエスト受信・バリデーション
3. サーバー: RAGEngineにクエリ転送
4. RAGEngine: クエリテキストの埋め込み生成
5. RAGEngine: Qdrantでベクトル類似検索
   - 類似度 > 0.7 の結果を取得
   - 最大5件取得
6. RAGEngine: メタデータフィルタリング
   - ファイル種別: .ts, .js, .md
   - 更新日時: 30日以内優先
7. RAGEngine: コンテキスト統合
   - 検索結果のマージ
   - 重複排除
   - 関連度スコア計算
8. RAGEngine: レスポンス生成
9. MCPサーバー: 構造化レスポンス返却
```

**レスポンス例**:
```json
{
  "results": [
    {
      "content": "export class AuthService {\n  async authenticate(token: string): Promise<User> {\n    // JWT検証とユーザー取得\n  }\n}",
      "metadata": {
        "file_path": "src/services/auth.ts",
        "type": "code",
        "language": "typescript",
        "functions": ["authenticate"],
        "score": 0.89,
        "updated_at": "2025-08-01T10:30:00Z"
      }
    },
    {
      "content": "# 認証システム\n\n## 概要\nJWTベースの認証システムを実装...",
      "metadata": {
        "file_path": "docs/auth-design.md",
        "type": "documentation",
        "section": "認証システム",
        "score": 0.85,
        "updated_at": "2025-07-30T15:20:00Z"
      }
    }
  ],
  "query_metadata": {
    "query": "ユーザー認証の実装方法",
    "total_results": 2,
    "search_time_ms": 45,
    "embedding_time_ms": 120
  }
}
```

**パフォーマンス要件**:
- 検索応答時間: < 100ms
- 埋め込み生成: < 200ms
- 総応答時間: < 300ms

### UC-002: Cursor統合フロー

#### UC-002-1: Cursor Composer連携

**アクター**: 開発者、Cursor、CQMサーバー  
**前提条件**: CursorのMCP設定完了、CQMサーバー起動済み  
**トリガー**: Cursor Composerでの質問入力

**基本フロー**:
```bash
1. 開発者: Cursor Composerを開き質問入力
   "このプロジェクトでAPIエラーハンドリングはどう実装されている？"

2. Cursor: MCP経由でCQMに接続確認
3. Cursor: getProjectContext ツール呼び出し
   {
     "query": "APIエラーハンドリング 実装",
     "include_recent_changes": true,
     "context_window_limit": 150000
   }

4. CQMサーバー: ProjectContextManager呼び出し
5. ContextManager: 複数ソースから情報収集
   - RAG検索: "error handling API"
   - FileSystem: 最近変更されたファイル (24時間以内)
   - プロジェクトメタデータ: 技術スタック情報

6. ContextManager: コンテキスト統合
   - コード例の抽出
   - 関連ドキュメントの収集
   - 実装パターンの分析

7. CQMサーバー: Cursor向け最適化
   - コンテキストウィンドウ制限 (150K tokens)
   - コードブロックの整形
   - 優先度による情報並び替え

8. Cursor: 統合されたコンテキストを受信
9. Cursor: AI responseに コンテキストを含めて回答生成
```

**統合コンテキスト例**:
```markdown
## CQM Project Context: API Error Handling

### Current Implementation Patterns

#### 1. Express Error Middleware (src/middleware/error.ts)
```typescript
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message });
  }
  // Global error handling
}
```

#### 2. Service Layer Error Handling (src/services/api.ts)
```typescript
class APIService {
  async fetchData(url: string): Promise<Data> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new APIError(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      this.logger.error('API fetch failed', { url, error });
      throw error;
    }
  }
}
```

#### 3. Related Documentation
- [Error Handling Strategy](docs/error-handling.md)
- [API Design Guidelines](docs/api-design.md)

### Recent Changes (Last 24h)
- Updated error middleware to include request ID tracking
- Added custom APIError class for better error categorization
```

**エラーハンドリング**:
```bash
# Cursor接続エラー
Error: MCP client connection failed
Suggestion: Check Cursor MCP configuration in settings.json

# コンテキストサイズ超過
Warning: Context size (200K tokens) exceeds Cursor limit (150K)
Auto-trimming to fit within limits...

# 検索結果なし
Info: No relevant context found for query "APIエラーハンドリング"
Consider:
  1. Check if files are properly indexed
  2. Try broader search terms
  3. Verify file monitoring is active
```

#### UC-002-2: インクリメンタルコンテキスト更新

**アクター**: Cursor、CQMサーバー、FileSystemプラグイン  
**前提条件**: Cursor作業セッション継続中  
**トリガー**: ファイル変更 + Cursor内での追加質問

**基本フロー**:
```bash
1. 開発者: Cursorで src/services/auth.ts を編集
2. FileSystemプラグイン: 変更検知 → インデックス更新
3. 開発者: Cursor Composerで追加質問
   "今変更したAuthServiceのテストはありますか？"

4. CQMサーバー: セッションコンテキスト確認
   - 前回の検索キーワード: "APIエラーハンドリング"
   - 現在の質問: "AuthService テスト"
   - 最近の変更: auth.ts (30秒前)

5. ContextManager: 関連性分析
   - 変更されたファイルとの関連度
   - 前回コンテキストとの継続性
   - テストファイルの検索

6. RAGEngine: 拡張検索
   - "AuthService test" キーワード検索
   - auth.ts と関連するテストファイル検索
   - __tests__/, *.test.ts, *.spec.ts パターン検索

7. CQMサーバー: 差分コンテキスト生成
   - 新規情報のみを抽出
   - 重複排除
   - セッション継続性を保持

8. Cursor: 効率的なコンテキスト更新で応答
```

**差分コンテキスト例**:
```markdown
## Updated Context: AuthService Testing

### Test Files Found
#### 1. Unit Tests (src/services/__tests__/auth.test.ts)
```typescript
describe('AuthService', () => {
  test('should authenticate valid token', async () => {
    const authService = new AuthService();
    const user = await authService.authenticate(validToken);
    expect(user).toBeDefined();
  });
});
```

#### 2. Integration Tests (tests/integration/auth.integration.ts)
```typescript
describe('Auth Integration', () => {
  test('should handle authentication flow', async () => {
    // End-to-end authentication test
  });
});
```

### Recent Changes Impact
- ✅ Unit tests exist and are up-to-date
- ⚠️ Integration tests may need updating after your auth.ts changes
- 💡 Consider adding tests for new error handling logic
```

### UC-003: システム管理フロー

#### UC-003-1: 状態監視と診断

**アクター**: 開発者  
**前提条件**: CQMシステム起動済み  
**トリガー**: `cqm status` コマンド実行

**基本フロー**:
```bash
1. 開発者: cqm status
2. CLIツール: 各コンポーネントの健全性チェック
   - MCPサーバー稼働状況
   - Qdrant接続状態
   - プラグイン動作状況
   - インデックス統計
   - メモリ使用量
   - アクティブな接続

3. CLIツール: 診断結果の統合
4. CLIツール: 構造化された状態レポート表示
```

**状態レポート例**:
```bash
CQ Models! Status Report
========================

🟢 System Status: Healthy
📡 MCP Server: Running (PID: 12345)
   ├─ Uptime: 2h 34m 12s
   ├─ Active Connections: 1 (Cursor)
   └─ Memory Usage: 256 MB / 1 GB

🔍 RAG Engine: Operational
   ├─ Vector DB: Connected (Qdrant 1.7.3)
   ├─ Indexed Documents: 1,234
   ├─ Last Index Update: 2 minutes ago
   └─ Search Performance: 45ms avg

🔌 Plugins Status:
   ├─ 🟢 filesystem (v1.0.0): Active, monitoring 3 directories
   ├─ 🟡 github (v1.0.0): Configured but not connected
   └─ 🔴 obsidian (v1.0.0): Disabled

📊 Performance Metrics:
   ├─ Total Queries Today: 67
   ├─ Average Response Time: 89ms
   ├─ Cache Hit Rate: 78%
   └─ Embeddings Generated: 45 (today)

⚡ Quick Actions:
   cqm logs          - View recent logs
   cqm index stats   - Detailed index information
   cqm plugin list   - Manage plugins
```

#### UC-003-2: インデックス管理

**アクター**: 開発者  
**前提条件**: CQMシステム起動済み  
**トリガー**: `cqm index list` コマンド実行

**基本フロー**:
```bash
1. 開発者: cqm index list
2. CLIツール: IndexManagerから統計取得
3. CLIツール: カテゴリ別インデックス情報表示

4. 開発者: cqm index stats --detailed
5. CLIツール: 詳細な統計情報取得・表示

6. 開発者: cqm index rebuild --category code
7. CLIツール: 指定カテゴリのインデックス再構築実行
```

**インデックス情報例**:
```bash
CQM Index Overview
==================

📂 Categories:
   ├─ code: 1,234 documents (156.2 MB)
   │   ├─ TypeScript: 567 files
   │   ├─ JavaScript: 234 files
   │   ├─ JSON: 123 files
   │   └─ Last updated: 2 minutes ago
   │
   ├─ docs: 56 documents (12.3 MB)
   │   ├─ Markdown: 45 files
   │   ├─ Text: 11 files
   │   └─ Last updated: 1 hour ago
   │
   └─ github: 234 documents (45.6 MB)
       ├─ Issues: 123 items
       ├─ Pull Requests: 67 items
       ├─ Comments: 44 items
       └─ Last updated: 30 minutes ago

🔍 Index Health:
   ├─ Total Vectors: 2,567
   ├─ Storage Used: 234.5 MB
   ├─ Fragmentation: 12% (Good)
   └─ Search Performance: 45ms avg

📊 Usage Statistics (24h):
   ├─ Queries Executed: 234
   ├─ Documents Added: 12
   ├─ Documents Updated: 45
   └─ Cache Hit Rate: 78%
```

### UC-004: エラーハンドリングとフォールバック

#### UC-004-1: Qdrant接続障害時のフォールバック

**アクター**: システム、開発者  
**前提条件**: CQMサーバー稼働中、Qdrantが停止  
**トリガー**: ベクトル検索クエリ実行

**基本フロー**:
```bash
1. AI Model: searchDocuments ツール呼び出し
2. RAGEngine: Qdrantへのクエリ送信試行
3. RAGEngine: 接続エラー検知 (Connection refused)
4. RAGEngine: 自動フォールバック開始
   
   # フォールバック検索ステップ
   a. ローカルファイル検索に切り替え
   b. テキストベースの類似検索実行
   c. TF-IDF または Levenshtein距離で類似度計算
   d. ファイルメタデータのみでのフィルタリング

5. RAGEngine: フォールバック結果を返却
6. システム: ログに警告記録
7. システム: 自動復旧試行開始
   
   # 復旧処理
   a. 30秒後にQdrant接続再試行
   b. 接続成功時はフォールバックモード解除
   c. 失敗時は指数バックオフで再試行継続

8. AI Model: フォールバック結果を受信 (品質は低下)
```

**フォールバックレスポンス例**:
```json
{
  "results": [
    {
      "content": "export class AuthService {...}",
      "metadata": {
        "file_path": "src/services/auth.ts",
        "type": "code",
        "score": 0.65,
        "search_method": "text_similarity",
        "fallback": true
      }
    }
  ],
  "warnings": [
    "Vector database unavailable. Using text-based fallback search.",
    "Search quality may be reduced. Please check Qdrant connection."
  ],
  "search_metadata": {
    "fallback_mode": true,
    "search_time_ms": 150,
    "method": "tf_idf"
  }
}
```

#### UC-004-2: プラグイン障害時の隔離

**アクター**: システム  
**前提条件**: CQMサーバー稼働中、GitHubプラグインでエラー発生  
**トリガー**: プラグインでの未処理例外

**基本フロー**:
```bash
1. GitHubPlugin: API呼び出しで例外発生 (Rate limit exceeded)
2. PluginLoader: 例外をキャッチ
3. PluginLoader: プラグイン障害レベル判定
   
   # 障害レベル分類
   - Level 1 (一時的): API rate limit, network timeout
   - Level 2 (設定): Invalid token, permission denied  
   - Level 3 (致命的): Syntax error, memory leak

4. PluginLoader: Level 1 → 一時的無効化
   - プラグインを60秒間無効化
   - 他プラグインへの影響なし
   - 自動復旧試行

5. PluginLoader: 障害プラグインの隔離
   - イベント購読の一時停止
   - リソースのクリーンアップ
   - メモリリークの防止

6. システム: 部分サービス継続
   - コアRAG機能は正常動作
   - FileSystemプラグインは継続動作
   - MCPサーバーは正常応答

7. システム: 自動回復試行
   - 60秒後にプラグイン再初期化
   - 成功時は正常動作復帰
   - 3回失敗時は完全無効化
```

**障害時ログ例**:
```bash
[2025-08-02 14:30:15] WARN: Plugin 'github' encountered error
  Error: Rate limit exceeded (403)
  Action: Temporarily disabled for 60 seconds
  Impact: GitHub integration unavailable, core search functional

[2025-08-02 14:31:15] INFO: Attempting to recover plugin 'github'
  Retry attempt: 1/3

[2025-08-02 14:31:16] INFO: Plugin 'github' successfully recovered
  Status: Fully operational
  Queued operations: 3 (will be processed)
```

## 3. パフォーマンス仕様

### 3.1 応答時間要件

| 操作 | 目標時間 | 最大許容時間 | 測定条件 |
|------|----------|--------------|----------|
| 基本検索 | < 100ms | < 300ms | 1,000ファイル、クエリ長50文字 |
| 初回インデックス | < 30秒 | < 60秒 | 1,000ファイル、平均5KB |
| ファイル更新 | < 500ms | < 1秒 | 単一ファイル、10KB以下 |
| プラグイン起動 | < 5秒 | < 10秒 | 全プラグイン同時起動 |
| コンテキスト統合 | < 200ms | < 500ms | 5つのソースから統合 |

### 3.2 スループット要件

| 指標 | 目標値 | 測定条件 |
|------|--------|----------|
| 同時検索 | 10 req/sec | 複数MCPクライアント |
| ファイル処理 | 50 files/sec | 一括インデックス時 |
| 埋め込み生成 | 20 docs/sec | OpenAI API制限内 |
| メモリ使用量 | < 1GB | 10,000ファイル処理時 |

### 3.3 品質メトリクス

| 指標 | 目標値 | 測定方法 |
|------|--------|----------|
| 検索精度 | > 85% | 関連度スコア0.7以上の適合率 |
| 偽陽性率 | < 10% | 無関係結果の割合 |
| 可用性 | > 99% | 月次稼働時間 |
| データ整合性 | 100% | インデックスと実ファイルの同期率 |

## 4. セキュリティ要件

### 4.1 データプライバシー
- **ローカル実行原則**: 全データはローカルマシンで処理
- **外部送信制限**: 埋め込み生成API以外への送信禁止
- **一時ファイル管理**: 処理中の一時ファイルの適切な削除

### 4.2 アクセス制御
- **MCPクライアント認証**: クライアント別アクセストークン
- **プラグイン権限**: プラグイン別のリソースアクセス制限
- **ファイルアクセス**: 指定ディレクトリ外へのアクセス禁止

### 4.3 監査ログ
- **アクセスログ**: 全MCPリクエストの記録
- **変更ログ**: インデックス変更の追跡
- **エラーログ**: セキュリティ関連エラーの記録

## 5. テスト観点

### 5.1 ユニットテスト観点
- RAGEngine検索アルゴリズムの精度
- プラグインのライフサイクル管理
- エラーハンドリング機能
- 設定管理機能

### 5.2 統合テスト観点
- MCPプロトコル準拠性
- Qdrant連携の正確性
- プラグイン間の相互作用
- フォールバック機構の動作

### 5.3 E2Eテスト観点
- Cursor統合の完全性
- ファイル変更からインデックス更新までの流れ
- 障害復旧の自動化
- パフォーマンス要件の達成

### 5.4 受け入れテスト観点
- 開発者の実際の作業フローでの有効性
- レスポンス品質の主観的評価
- ドキュメントとのギャップ確認

## 6. 制約事項

### 6.1 技術制約
- Node.js 20.x LTS 必須
- OpenAI API依存（埋め込み生成）
- Qdrant 1.7+ 必須
- メモリ4GB以上推奨

### 6.2 機能制約
- Phase 0では GitHub統合は最小限
- Obsidian連携は Phase 1で実装
- リアルタイム協調編集は対象外
- 分散デプロイメントは対象外

### 6.3 運用制約
- 24時間稼働を前提としない
- クラスタリングは対象外
- 自動バックアップは対象外
- 高可用性構成は対象外

---

## 付録

### A. MCPツール仕様
```typescript
// CQM提供のMCPツール一覧
interface CQMTools {
  searchDocuments(params: SearchParams): Promise<SearchResult[]>;
  getProjectContext(params: ContextParams): Promise<ProjectContext>;
  indexFile(params: IndexParams): Promise<void>;
  getIndexStats(): Promise<IndexStats>;
  rebuildIndex(params: RebuildParams): Promise<void>;
}
```

### B. 設定ファイル例
```yaml
# cqm.yml - Phase 0 設定例
version: 1.0

core:
  name: "CQ Models!"
  logLevel: info
  maxConnections: 5

rag:
  vectorDB:
    type: qdrant
    config:
      url: http://localhost:6333
      collection: cqm_dev
  
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
      ignore: ["node_modules", ".git", "*.log"]
      debounceMs: 500
```

### C. パフォーマンステストシナリオ
```bash
# 基本性能テスト
1. 1,000ファイルのプロジェクトでの初回起動時間測定
2. 100回の連続検索での平均応答時間測定
3. 同時10接続での検索負荷テスト
4. 大容量ファイル（1MB）の処理時間測定
5. メモリリーク検証（24時間連続稼働）
```

---

*"Clear specifications lead to clear implementations - CQM Requirements Team"*