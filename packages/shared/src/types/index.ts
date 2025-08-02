/**
 * 共通型定義
 */

// 基本型定義
export interface CQMConfig {
  server: {
    port: number;
    host: string;
  };
  rag: {
    provider: 'openai' | 'ollama';
    model: string;
  };
  plugins: {
    enabled: string[];
  };
}

// MCPプロトコル関連型
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// RAGエンジン関連型
export interface Document {
  id: string;
  content: string;
  metadata: {
    source: string;
    type: string;
    lastModified: Date;
  };
  embedding?: number[];
}

export interface SearchResult {
  document: Document;
  score: number;
  highlights?: string[];
}

// プラグイン関連型
export interface Plugin {
  name: string;
  version: string;
  enabled: boolean;
  config: Record<string, any>;
}

// エラー型
export class CQMError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CQMError';
  }
}