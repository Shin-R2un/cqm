/**
 * 共通定数定義
 */

// MCPプロトコル関連
export const MCP_PROTOCOL_VERSION = '2024-11-05';

// エラーコード
export const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // CQM固有エラー
  PLUGIN_ERROR: -32000,
  RAG_ERROR: -32001,
  CONFIG_ERROR: -32002,
  CONNECTION_LIMIT: -32003,
} as const;

// デフォルト設定値
export const DEFAULT_CONFIG = {
  server: {
    port: 3000,
    host: 'localhost',
  },
  rag: {
    provider: 'openai' as const,
    model: 'text-embedding-3-small',
  },
  plugins: {
    enabled: ['filesystem'],
  },
} as const;

// ファイルタイプ
export const SUPPORTED_FILE_TYPES = [
  '.ts',
  '.js',
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
] as const;

// 埋め込みモデル情報
export const EMBEDDING_MODELS = {
  openai: {
    'text-embedding-3-small': { dimensions: 1536, maxTokens: 8191 },
    'text-embedding-3-large': { dimensions: 3072, maxTokens: 8191 },
  },
  ollama: {
    'nomic-embed-text': { dimensions: 768, maxTokens: 8192 },
    'mxbai-embed-large': { dimensions: 1024, maxTokens: 512 },
  },
} as const;