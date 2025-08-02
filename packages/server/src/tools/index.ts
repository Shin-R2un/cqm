/**
 * MCPツール定義とレジストリ
 * CQM-MCP-001設計に基づくコアツール実装
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';
import { execSync } from 'child_process';
import { ConfigManager } from '../config/index.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: ToolHandler;
}

export interface ToolHandler {
  (params: any, context: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
  sessionId: string;
  configManager: ConfigManager;
}

export interface ToolResult {
  content: Array<{
    type: 'text' | 'resource';
    text?: string;
    resource?: {
      uri: string;
      name?: string;
      description?: string;
    };
  }>;
  isError?: boolean;
  metadata?: Record<string, any>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  constructor() {
    this.setupCoreTools();
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

  async call(name: string, params: any, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      return await tool.handler(params, context);
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error executing tool ${name}: ${error}`
        }],
        isError: true
      };
    }
  }

  private setupCoreTools(): void {
    // getProjectContext ツール
    this.register({
      name: 'getProjectContext',
      description: '現在のプロジェクトの状況とコンテキストを取得する',
      inputSchema: {
        type: 'object',
        properties: {
          includeFiles: {
            type: 'boolean',
            description: 'ファイル一覧を含めるかどうか',
            default: false
          },
          includeGitStatus: {
            type: 'boolean',
            description: 'Git状態を含めるかどうか',
            default: true
          },
          includeIssues: {
            type: 'boolean',
            description: '関連するIssueを含めるかどうか',
            default: false
          },
          maxFiles: {
            type: 'number',
            description: '最大ファイル数',
            default: 50,
            minimum: 1,
            maximum: 500
          }
        },
        additionalProperties: false
      },
      handler: this.getProjectContextHandler.bind(this)
    });

    // searchDocuments ツール
    this.register({
      name: 'searchDocuments',
      description: 'プロジェクト内のドキュメントとコードを検索する',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '検索クエリ',
            minLength: 1,
            maxLength: 1000
          },
          fileTypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'ファイルタイプフィルタ（例: ["ts", "md"]）'
          },
          path: {
            type: 'string',
            description: '検索対象パス'
          },
          limit: {
            type: 'number',
            description: '最大結果数',
            default: 20,
            minimum: 1,
            maximum: 100
          }
        },
        required: ['query'],
        additionalProperties: false
      },
      handler: this.searchDocumentsHandler.bind(this)
    });

    // listFiles ツール
    this.register({
      name: 'listFiles',
      description: 'ディレクトリ内のファイル一覧を取得する',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '対象ディレクトリパス',
            default: '.'
          },
          recursive: {
            type: 'boolean',
            description: '再帰的に検索するかどうか',
            default: false
          },
          includeHidden: {
            type: 'boolean',
            description: '隠しファイルを含めるかどうか',
            default: false
          },
          maxDepth: {
            type: 'number',
            description: '最大階層数',
            default: 3,
            minimum: 1,
            maximum: 10
          }
        },
        additionalProperties: false
      },
      handler: this.listFilesHandler.bind(this)
    });

    // readFile ツール
    this.register({
      name: 'readFile',
      description: 'ファイルの内容を読み取る',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'ファイルパス'
          },
          encoding: {
            type: 'string',
            description: 'ファイルエンコーディング',
            default: 'utf-8',
            enum: ['utf-8', 'ascii', 'base64']
          },
          maxSize: {
            type: 'number',
            description: '最大ファイルサイズ（バイト）',
            default: 1048576, // 1MB
            maximum: 10485760 // 10MB
          }
        },
        required: ['path'],
        additionalProperties: false
      },
      handler: this.readFileHandler.bind(this)
    });
  }

  // ツールハンドラー実装
  private async getProjectContextHandler(params: any, context: ToolContext): Promise<ToolResult> {
    const { includeFiles, includeGitStatus, includeIssues, maxFiles } = params;
    const config = context.configManager.getConfig();
    
    const result: any = {
      project: {
        name: 'CQM',
        description: 'Contextual Query Manager - Unified context for AI models',
        version: '0.1.0',
        type: 'monorepo'
      },
      timestamp: new Date().toISOString(),
      session: context.sessionId
    };

    // Git状態の取得
    if (includeGitStatus) {
      try {
        const gitBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
        const gitLog = execSync('git log --oneline -5', { encoding: 'utf-8' }).trim();
        
        result.git = {
          branch: gitBranch,
          hasChanges: gitStatus.length > 0,
          changedFiles: gitStatus ? gitStatus.split('\n').length : 0,
          recentCommits: gitLog.split('\n').map(line => {
            const [hash, ...message] = line.split(' ');
            return { hash, message: message.join(' ') };
          })
        };
      } catch (error) {
        result.git = { error: 'Git information unavailable' };
      }
    }

    // ファイル情報の取得
    if (includeFiles) {
      const files = this.getProjectFiles('.', maxFiles);
      result.files = {
        total: files.length,
        byType: this.groupFilesByType(files),
        structure: files.slice(0, maxFiles)
      };
    }

    // プロジェクト構造
    result.structure = {
      packages: ['@cqm/shared', '@cqm/server', '@cqm/rag', '@cqm/cli'],
      architecture: 'monorepo with Turborepo',
      framework: 'TypeScript + Node.js',
      protocols: ['MCP v2024-11-05']
    };

    // 設定情報
    result.config = config;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }],
      metadata: {
        toolVersion: '1.0.0',
        executionTime: Date.now()
      }
    };
  }

  private async searchDocumentsHandler(params: any, context: ToolContext): Promise<ToolResult> {
    const { query, fileTypes, path = '.', limit } = params;
    
    const results: any[] = [];
    
    try {
      // 簡単な grep 実装
      const searchPath = path || '.';
      const extensions = fileTypes ? fileTypes.map((ext: string) => `.${ext}`) : ['.ts', '.js', '.md', '.txt', '.json'];
      
      const files = this.findFiles(searchPath, extensions);
      
      for (const file of files.slice(0, limit)) {
        try {
          const content = readFileSync(file, 'utf-8');
          const lines = content.split('\n');
          const matches: any[] = [];
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(query.toLowerCase())) {
              matches.push({
                lineNumber: i + 1,
                line: lines[i].trim(),
                context: lines.slice(Math.max(0, i - 1), i + 2)
              });
            }
          }
          
          if (matches.length > 0) {
            results.push({
              file: relative('.', file),
              matches: matches.slice(0, 5), // 最大5マッチ
              totalMatches: matches.length
            });
          }
        } catch (error) {
          // ファイル読み込みエラーはスキップ
        }
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Search error: ${error}`
        }],
        isError: true
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query,
          results: results.slice(0, limit),
          totalFiles: results.length,
          searchTime: Date.now()
        }, null, 2)
      }],
      metadata: {
        query,
        resultCount: results.length
      }
    };
  }

  private async listFilesHandler(params: any, context: ToolContext): Promise<ToolResult> {
    const { path = '.', recursive, includeHidden, maxDepth } = params;
    
    try {
      const files = this.getDirectoryContents(path, recursive, includeHidden, maxDepth);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            path,
            files: files.map(file => ({
              name: file.name,
              path: file.path,
              type: file.type,
              size: file.size,
              modified: file.modified
            }))
          }, null, 2)
        }],
        metadata: {
          path,
          fileCount: files.length
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error listing files: ${error}`
        }],
        isError: true
      };
    }
  }

  private async readFileHandler(params: any, context: ToolContext): Promise<ToolResult> {
    const { path, encoding = 'utf-8', maxSize } = params;
    
    try {
      if (!existsSync(path)) {
        throw new Error(`File not found: ${path}`);
      }
      
      const stats = statSync(path);
      if (stats.size > maxSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize})`);
      }
      
      const content = readFileSync(path, encoding);
      
      return {
        content: [{
          type: 'text',
          text: content
        }, {
          type: 'resource',
          resource: {
            uri: `file://${path}`,
            name: path,
            description: `File content (${stats.size} bytes)`
          }
        }],
        metadata: {
          path,
          size: stats.size,
          encoding,
          lastModified: stats.mtime.toISOString()
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error reading file: ${error}`
        }],
        isError: true
      };
    }
  }

  // ヘルパーメソッド
  private getProjectFiles(basePath: string, maxFiles: number): string[] {
    const files: string[] = [];
    const excludeDirs = ['node_modules', '.git', 'dist', '.next', 'coverage'];
    
    const scan = (dir: string, depth = 0) => {
      if (depth > 5 || files.length >= maxFiles) return;
      
      try {
        const entries = readdirSync(dir);
        
        for (const entry of entries) {
          if (files.length >= maxFiles) break;
          
          const fullPath = join(dir, entry);
          const stats = statSync(fullPath);
          
          if (stats.isDirectory()) {
            if (!excludeDirs.includes(entry) && !entry.startsWith('.')) {
              scan(fullPath, depth + 1);
            }
          } else {
            const ext = extname(entry);
            if (['.ts', '.js', '.md', '.json', '.yaml', '.yml'].includes(ext)) {
              files.push(relative(basePath, fullPath));
            }
          }
        }
      } catch (error) {
        // ディレクトリアクセスエラーはスキップ
      }
    };
    
    scan(basePath);
    return files;
  }

  private groupFilesByType(files: string[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    for (const file of files) {
      const ext = extname(file).slice(1) || 'no-extension';
      groups[ext] = (groups[ext] || 0) + 1;
    }
    
    return groups;
  }

  private findFiles(basePath: string, extensions: string[]): string[] {
    const files: string[] = [];
    const excludeDirs = ['node_modules', '.git', 'dist'];
    
    const scan = (dir: string, depth = 0) => {
      if (depth > 10) return;
      
      try {
        const entries = readdirSync(dir);
        
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stats = statSync(fullPath);
          
          if (stats.isDirectory()) {
            if (!excludeDirs.includes(entry) && !entry.startsWith('.')) {
              scan(fullPath, depth + 1);
            }
          } else {
            const ext = extname(entry);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // ディレクトリアクセスエラーはスキップ
      }
    };
    
    scan(basePath);
    return files;
  }

  private getDirectoryContents(path: string, recursive: boolean, includeHidden: boolean, maxDepth: number): any[] {
    const results: any[] = [];
    
    const scan = (dir: string, depth = 0) => {
      if (depth > maxDepth) return;
      
      try {
        const entries = readdirSync(dir);
        
        for (const entry of entries) {
          if (!includeHidden && entry.startsWith('.')) continue;
          
          const fullPath = join(dir, entry);
          const stats = statSync(fullPath);
          
          results.push({
            name: entry,
            path: relative('.', fullPath),
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime.toISOString()
          });
          
          if (recursive && stats.isDirectory()) {
            scan(fullPath, depth + 1);
          }
        }
      } catch (error) {
        // ディレクトリアクセスエラーはスキップ
      }
    };
    
    scan(path);
    return results;
  }
}