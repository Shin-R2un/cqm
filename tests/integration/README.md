# CQM統合テスト

このディレクトリには、CQMプロジェクトの統合テストが含まれています。

## MCP-RAG統合テスト

### 概要

`mcp-rag-integration.test.ts`は、MCPサーバーとRAGエンジンの統合機能をテストするためのファイルです。

### テスト対象

1. **MCPサーバー基本機能**
   - サーバー初期化
   - ツール一覧取得
   - MCP initialize リクエスト処理

2. **RAGエンジン統合機能**
   - セマンティック検索
   - コード検索
   - ドキュメント検索  
   - コンテキスト検索
   - インデックス管理
   - 統計情報取得

3. **エラーハンドリング**
   - 無効なツール名
   - 無効なメソッド
   - JSON-RPC仕様違反

### 実行方法

```bash
# 統合テストのみ実行
npm test -- tests/integration/mcp-rag-integration.test.ts

# 詳細ログ付きで実行
npx vitest run tests/integration/mcp-rag-integration.test.ts --reporter=verbose
```

### 前提条件

- Node.js 18以上
- WebSocket対応
- RAGエンジンの依存関係（Qdrant、Ollama）は任意

## MCPツール使用例

### 1. セマンティック検索

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "semanticSearch",
    "arguments": {
      "query": "エラーハンドリングの実装方法",
      "limit": 10,
      "threshold": 0.7,
      "includeContent": true
    }
  }
}
```

**レスポンス例**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"query\":\"エラーハンドリングの実装方法\",\"results\":[{\"source\":\"packages/server/src/error/index.ts\",\"score\":0.89,\"type\":\"typescript\",\"highlights\":[\"エラーハンドリング\",\"実装\"]}],\"totalResults\":5}"
    }]
  }
}
```

### 2. コード検索

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "codeSearch",
    "arguments": {
      "query": "async function initialize",
      "languages": ["typescript"],
      "limit": 15
    }
  }
}
```

### 3. ドキュメント検索

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call", 
  "params": {
    "name": "documentationSearch",
    "arguments": {
      "query": "MCPプロトコルの使用方法",
      "documentTypes": ["markdown"],
      "limit": 5
    }
  }
}
```

### 4. コンテキスト検索

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "contextualSearch",
    "arguments": {
      "query": "関連する設定方法",
      "currentContext": {
        "currentFile": "packages/server/src/config/index.ts",
        "workingBranch": "feature/issue-15",
        "recentFiles": ["packages/server/src/tools/rag-tools.ts"]
      },
      "limit": 8
    }
  }
}
```

### 5. インデックス管理

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "manageRAGIndex",
    "arguments": {
      "action": "initialize",
      "filePaths": ["packages/server/src/", "docs/"]
    }
  }
}
```

### 6. 統計情報取得

```json
{
  "jsonrpc": "2.0", 
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "getRAGStats",
    "arguments": {
      "detailed": true,
      "includeHealth": true
    }
  }
}
```

## フォールバック機能

RAGエンジンが利用できない環境では、以下のような適切なメッセージが返されます：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Tool not found: semanticSearch",
    "data": {
      "type": "TOOL_NOT_FOUND",
      "severity": "medium"
    }
  }
}
```

## 期待される結果

- ✅ **14/14 テストパス**: 全ての統合テストが成功
- ✅ **RAGフォールバック**: 依存関係が利用できない場合の適切な処理
- ✅ **MCP準拠**: JSON-RPC 2.0とMCPプロトコルへの完全準拠
- ✅ **エラーハンドリング**: 各種エラーシナリオでの適切な応答

## トラブルシューティング

### WebSocket接続エラー

```
Error: WebSocket connection timeout
```

**解決方法**: MCPサーバーが正常に起動していることを確認。ポート競合がないかチェック。

### RAGツール利用不可

```
RAG tools not available in this test environment
```

**解決方法**: これは正常な動作です。RAG依存関係（Ollama、Qdrant）がない環境では、コアツールのみでテストが実行されます。

### テストタイムアウト

個別のテストタイムアウトを10秒に設定していますが、重いRAG処理では延長が必要な場合があります。