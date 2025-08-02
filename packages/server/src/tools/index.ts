/**
 * MCPツール定義
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

export const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    name: 'getProjectContext',
    description: '現在のプロジェクトの状況とコンテキストを取得する',
    inputSchema: {
      type: 'object',
      properties: {
        includeFiles: { type: 'boolean', default: false },
        includeGitStatus: { type: 'boolean', default: true },
      },
    },
  },
  {
    name: 'searchDocuments',
    description: 'インデックスされたドキュメントとコードを検索する',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', default: 20 },
      },
      required: ['query'],
    },
  },
];

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  constructor() {
    // デフォルトツールを登録
    DEFAULT_TOOLS.forEach(tool => this.register(tool));
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}