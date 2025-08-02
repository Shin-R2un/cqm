/**
 * Zodバリデーションスキーマ
 */
import { z } from 'zod';

// 設定スキーマ
export const CQMConfigSchema = z.object({
  server: z.object({
    port: z.number().min(1).max(65535),
    host: z.string(),
  }),
  rag: z.object({
    provider: z.enum(['openai', 'ollama']),
    model: z.string(),
  }),
  plugins: z.object({
    enabled: z.array(z.string()),
  }),
});

// MCPリクエストスキーマ
export const MCPRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.any().optional(),
});

// ドキュメントスキーマ
export const DocumentSchema = z.object({
  id: z.string(),
  content: z.string(),
  metadata: z.object({
    source: z.string(),
    type: z.string(),
    lastModified: z.date(),
  }),
  embedding: z.array(z.number()).optional(),
});

// プラグインスキーマ
export const PluginSchema = z.object({
  name: z.string(),
  version: z.string(),
  enabled: z.boolean(),
  config: z.record(z.any()),
});

// 型エクスポート（既にtypes/index.tsで定義済みのため削除）
// export type CQMConfig = z.infer<typeof CQMConfigSchema>;
// export type MCPRequest = z.infer<typeof MCPRequestSchema>;
// export type Document = z.infer<typeof DocumentSchema>;
// export type Plugin = z.infer<typeof PluginSchema>;