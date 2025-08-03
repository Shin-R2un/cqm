/**
 * RAGエンジン統合ツール
 * CQM Issue #15 [IMP-004] MCP-RAG統合実装
 */
import { RAGEngine, RAGEngineOptions, RAGSearchOptions } from '@cqm/rag';
import { ToolDefinition, ToolHandler, ToolContext, ToolResult } from './index.js';
import { ConfigManager } from '../config/index.js';
import { join } from 'path';

export class RAGToolsManager {
  private ragEngine: RAGEngine | null = null;
  private isInitialized = false;
  private indexingInProgress = false;
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 設定から RAG エンジンオプションを取得
      const ragConfig = this.configManager.getConfig().rag;
      
      console.log(`🚀 Initializing RAG Engine with config: ${ragConfig.provider}:${ragConfig.model}`);
      
      // RAGエンジンの初期化
      this.ragEngine = new RAGEngine({
        provider: ragConfig.provider as 'openai' | 'ollama',
        model: ragConfig.model,
        vectorDbUrl: process.env.QDRANT_URL || 'http://localhost:6333',
        vectorDbApiKey: process.env.QDRANT_API_KEY,
        indexOptions: {
          basePaths: ['.'],
          includePatterns: ['**/*.ts', '**/*.js', '**/*.md', '**/*.json'],
          excludePatterns: ['node_modules/**', 'dist/**', '.git/**', '**/*.test.*', '**/*.spec.*'],
          maxFileSize: 1024 * 1024, // 1MB
          enableIncremental: true
        },
        performance: {
          maxSearchResults: 20,
          searchThreshold: 0.7,
          chunkOverlap: 50,
          maxConcurrentOperations: 3
        }
      });

      await this.ragEngine.initialize();
      this.isInitialized = true;
      
      console.log('✅ RAG Tools Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize RAG Tools Manager:', error);
      throw error;
    }
  }

  getTools(): ToolDefinition[] {
    return [
      this.createSemanticSearchTool(),
      this.createCodeSearchTool(),
      this.createDocumentationSearchTool(),
      this.createContextualSearchTool(),
      this.createIndexManagementTool(),
      this.createRAGStatsTool()
    ];
  }

  private createSemanticSearchTool(): ToolDefinition {
    return {
      name: 'semanticSearch',
      description: 'プロジェクト全体に対するセマンティック検索を実行する',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '検索クエリ（自然言語で記述可能）',
            minLength: 1,
            maxLength: 500
          },
          limit: {
            type: 'number',
            description: '最大結果数',
            default: 10,
            minimum: 1,
            maximum: 50
          },
          threshold: {
            type: 'number',
            description: '関連度の閾値（0.0-1.0）',
            default: 0.7,
            minimum: 0.0,
            maximum: 1.0
          },
          categories: {
            type: 'array',
            items: { 
              type: 'string',
              enum: ['source', 'documentation', 'configuration', 'test', 'example']
            },
            description: 'カテゴリフィルタ'
          },
          includeContent: {
            type: 'boolean',
            description: 'コンテンツ全文を含めるか',
            default: true
          }
        },
        required: ['query'],
        additionalProperties: false
      },
      handler: this.createSemanticSearchHandler()
    };
  }

  private createCodeSearchTool(): ToolDefinition {
    return {
      name: 'codeSearch',
      description: 'コード特化検索（関数、クラス、インターフェース等の検索）',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '検索クエリ（関数名、クラス名、実装内容等）',
            minLength: 1,
            maxLength: 500
          },
          languages: {
            type: 'array',
            items: { 
              type: 'string',
              enum: ['typescript', 'javascript', 'json', 'yaml']
            },
            description: 'プログラミング言語フィルタ'
          },
          codeTypes: {
            type: 'array',
            items: { 
              type: 'string',
              enum: ['function', 'class', 'interface', 'type', 'variable']
            },
            description: 'コード要素タイプフィルタ'
          },
          limit: {
            type: 'number',
            description: '最大結果数',
            default: 15,
            minimum: 1,
            maximum: 50
          }
        },
        required: ['query'],
        additionalProperties: false
      },
      handler: this.createCodeSearchHandler()
    };
  }

  private createDocumentationSearchTool(): ToolDefinition {
    return {
      name: 'documentationSearch',
      description: 'ドキュメント特化検索（README、設計書、コメント等）',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '検索クエリ',
            minLength: 1,
            maxLength: 500
          },
          documentTypes: {
            type: 'array',
            items: { 
              type: 'string',
              enum: ['markdown', 'readme', 'api-docs', 'comments', 'specifications']
            },
            description: 'ドキュメントタイプフィルタ'
          },
          limit: {
            type: 'number',
            description: '最大結果数',
            default: 10,
            minimum: 1,
            maximum: 30
          }
        },
        required: ['query'],
        additionalProperties: false
      },
      handler: this.createDocumentationSearchHandler()
    };
  }

  private createContextualSearchTool(): ToolDefinition {
    return {
      name: 'contextualSearch',
      description: 'コンテキストを考慮した高度検索（現在の作業内容に基づく関連情報検索）',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '検索クエリ',
            minLength: 1,
            maxLength: 500
          },
          currentContext: {
            type: 'object',
            properties: {
              currentFile: { type: 'string', description: '現在編集中のファイル' },
              recentFiles: { 
                type: 'array', 
                items: { type: 'string' },
                description: '最近編集したファイル一覧'
              },
              workingBranch: { type: 'string', description: '作業中のブランチ' },
              lastCommits: {
                type: 'array',
                items: { type: 'string' },
                description: '最近のコミットメッセージ'
              }
            },
            description: '現在の作業コンテキスト'
          },
          limit: {
            type: 'number',
            description: '最大結果数',
            default: 12,
            minimum: 1,
            maximum: 30
          }
        },
        required: ['query'],
        additionalProperties: false
      },
      handler: this.createContextualSearchHandler()
    };
  }

  private createIndexManagementTool(): ToolDefinition {
    return {
      name: 'manageRAGIndex',
      description: 'RAGインデックスの管理（初期化、再構築、統計情報取得）',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['initialize', 'rebuild', 'stats', 'health'],
            description: '実行するアクション'
          },
          filePaths: {
            type: 'array',
            items: { type: 'string' },
            description: '特定ファイルのインデックス化（initialize/rebuildの場合）'
          },
          includeProgress: {
            type: 'boolean',
            description: '進捗情報を含めるか',
            default: true
          }
        },
        required: ['action'],
        additionalProperties: false
      },
      handler: this.createIndexManagementHandler()
    };
  }

  private createRAGStatsTool(): ToolDefinition {
    return {
      name: 'getRAGStats',
      description: 'RAGエンジンの統計情報とパフォーマンス指標を取得する',
      inputSchema: {
        type: 'object',
        properties: {
          detailed: {
            type: 'boolean',
            description: '詳細な統計情報を含めるか',
            default: false
          },
          includeHealth: {
            type: 'boolean',
            description: 'ヘルスチェック結果を含めるか',
            default: true
          }
        },
        additionalProperties: false
      },
      handler: this.createRAGStatsHandler()
    };
  }

  // ハンドラー実装
  private createSemanticSearchHandler(): ToolHandler {
    return async (params: any): Promise<ToolResult> => {
      // インデックス作成中の場合の処理
      if (this.indexingInProgress) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'indexing_in_progress',
              message: 'RAGインデックス作成中のため、検索は一時的に利用できません。少々お待ちください。',
              suggestion: 'manageRAGIndexツールでインデックス作成状況を確認できます。'
            }, null, 2)
          }],
          metadata: {
            toolName: 'semanticSearch',
            status: 'temporarily_unavailable'
          }
        };
      }

      if (!this.ragEngine) {
        await this.initialize();
      }

      try {
        const { query, limit, threshold, categories, includeContent } = params;
        
        const searchOptions: RAGSearchOptions = {
          query,
          limit,
          threshold,
          filters: categories ? { category: categories } : undefined,
          includeContent,
          includeHighlights: true
        };

        const results = await this.ragEngine!.search(searchOptions);

        const formattedResults = results.map(result => ({
          source: result.metadata.source,
          score: Math.round(result.score * 100) / 100,
          type: result.metadata.type,
          category: result.metadata.category,
          content: includeContent ? result.content : undefined,
          highlights: result.highlights,
          chunk: result.chunk ? {
            title: result.chunk.title,
            startLine: result.chunk.startLine,
            endLine: result.chunk.endLine
          } : undefined
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query,
              results: formattedResults,
              totalResults: results.length,
              searchTime: Date.now(),
              threshold
            }, null, 2)
          }],
          metadata: {
            toolName: 'semanticSearch',
            resultCount: results.length,
            query
          }
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Semantic search error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    };
  }

  private createCodeSearchHandler(): ToolHandler {
    return async (params: any): Promise<ToolResult> => {
      // インデックス作成中チェック
      if (this.indexingInProgress) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'indexing_in_progress',
              message: 'RAGインデックス作成中のため、コード検索は一時的に利用できません。'
            }, null, 2)
          }],
          metadata: { toolName: 'codeSearch', status: 'temporarily_unavailable' }
        };
      }

      if (!this.ragEngine) {
        await this.initialize();
      }

      try {
        const { query, languages, limit } = params;
        
        const searchOptions: RAGSearchOptions = {
          query: `code: ${query}`, // コード検索のプレフィックス
          limit,
          filters: {
            language: languages,
            // codeTypesは将来的にチャンクメタデータで対応
          },
          threshold: 0.6, // コード検索は少し低い閾値
          includeContent: true,
          includeHighlights: true
        };

        const results = await this.ragEngine!.search(searchOptions);

        // コード特化の結果フォーマット
        const codeResults = results
          .filter(result => ['typescript', 'javascript'].includes(result.metadata.language || ''))
          .map(result => ({
            file: result.metadata.source,
            score: Math.round(result.score * 100) / 100,
            language: result.metadata.language,
            function: result.chunk?.title,
            lineRange: result.chunk ? `${result.chunk.startLine}-${result.chunk.endLine}` : undefined,
            code: result.content.length > 500 ? result.content.substring(0, 500) + '...' : result.content,
            symbols: result.chunk?.symbols
          }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query,
              codeResults,
              totalMatches: codeResults.length,
              languages: languages || 'all',
              searchTime: Date.now()
            }, null, 2)
          }],
          metadata: {
            toolName: 'codeSearch',
            resultCount: codeResults.length,
            query
          }
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Code search error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    };
  }

  private createDocumentationSearchHandler(): ToolHandler {
    return async (params: any, context: ToolContext): Promise<ToolResult> => {
      if (!this.ragEngine) {
        await this.initialize();
      }

      try {
        const { query, documentTypes, limit } = params;
        
        const searchOptions: RAGSearchOptions = {
          query,
          limit,
          filters: {
            category: ['documentation'],
            fileType: documentTypes?.includes('markdown') ? ['.md'] : undefined
          },
          threshold: 0.65,
          includeContent: true,
          includeHighlights: true
        };

        const results = await this.ragEngine!.search(searchOptions);

        const docResults = results.map(result => ({
          document: result.metadata.source,
          score: Math.round(result.score * 100) / 100,
          section: result.chunk?.title,
          excerpt: result.content.length > 300 ? result.content.substring(0, 300) + '...' : result.content,
          highlights: result.highlights?.slice(0, 3), // 最大3つのハイライト
          lastModified: result.metadata.lastModified
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query,
              documentationResults: docResults,
              totalDocuments: docResults.length,
              documentTypes: documentTypes || 'all',
              searchTime: Date.now()
            }, null, 2)
          }],
          metadata: {
            toolName: 'documentationSearch',
            resultCount: docResults.length,
            query
          }
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Documentation search error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    };
  }

  private createContextualSearchHandler(): ToolHandler {
    return async (params: any, context: ToolContext): Promise<ToolResult> => {
      if (!this.ragEngine) {
        await this.initialize();
      }

      try {
        const { query, currentContext, limit } = params;
        
        // コンテキスト情報を検索クエリに含める
        let enhancedQuery = query;
        if (currentContext?.currentFile) {
          enhancedQuery += ` (関連ファイル: ${currentContext.currentFile})`;
        }
        if (currentContext?.workingBranch) {
          enhancedQuery += ` (ブランチ: ${currentContext.workingBranch})`;
        }

        const searchOptions: RAGSearchOptions = {
          query: enhancedQuery,
          limit,
          threshold: 0.6, // コンテキスト検索は幅広く候補を取得
          includeContent: true,
          includeHighlights: true
        };

        const results = await this.ragEngine!.search(searchOptions);

        // コンテキストスコアリング（現在のファイルや最近のファイルに関連するものを優先）
        const contextualResults = results.map(result => {
          let contextScore = result.score;
          
          // 現在のファイルとの関連度ボーナス
          if (currentContext?.currentFile && result.metadata.source.includes(currentContext.currentFile)) {
            contextScore += 0.2;
          }
          
          // 最近のファイルとの関連度ボーナス
          if (currentContext?.recentFiles?.some((file: string) => result.metadata.source.includes(file))) {
            contextScore += 0.1;
          }

          return {
            ...result,
            contextScore: Math.min(contextScore, 1.0)
          };
        }).sort((a, b) => b.contextScore - a.contextScore);

        const formattedResults = contextualResults.map(result => ({
          source: result.metadata.source,
          score: Math.round(result.score * 100) / 100,
          contextScore: Math.round(result.contextScore * 100) / 100,
          type: result.metadata.type,
          excerpt: result.content.length > 250 ? result.content.substring(0, 250) + '...' : result.content,
          relevanceReason: this.getRelevanceReason(result, currentContext),
          chunk: result.chunk
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query,
              contextualResults: formattedResults,
              context: currentContext,
              totalResults: formattedResults.length,
              searchTime: Date.now()
            }, null, 2)
          }],
          metadata: {
            toolName: 'contextualSearch',
            resultCount: formattedResults.length,
            query,
            contextFile: currentContext?.currentFile
          }
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Contextual search error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    };
  }

  private createIndexManagementHandler(): ToolHandler {
    return async (params: any, context: ToolContext): Promise<ToolResult> => {
      if (!this.ragEngine) {
        await this.initialize();
      }

      try {
        const { action, filePaths } = params;

        switch (action) {
          case 'initialize':
            if (this.indexingInProgress) {
              return {
                content: [{
                  type: 'text',
                  text: 'インデックス化は既に進行中です'
                }],
                isError: true
              };
            }

            this.indexingInProgress = true;
            try {
              const progress = await this.ragEngine!.indexDocuments(filePaths);
              this.indexingInProgress = false;

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    action: 'initialize',
                    status: 'completed',
                    results: {
                      total: progress.total,
                      successful: progress.successful,
                      failed: progress.failed,
                      errors: progress.errors
                    }
                  }, null, 2)
                }],
                metadata: {
                  toolName: 'manageRAGIndex',
                  action: 'initialize',
                  indexedFiles: progress.successful
                }
              };
            } catch (error) {
              this.indexingInProgress = false;
              throw error;
            }

          case 'rebuild':
            await this.ragEngine!.rebuild();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  action: 'rebuild',
                  status: 'completed',
                  timestamp: new Date().toISOString()
                }, null, 2)
              }]
            };

          case 'stats':
            const stats = await this.ragEngine!.getStats();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  action: 'stats',
                  statistics: stats
                }, null, 2)
              }]
            };

          case 'health':
            const health = await this.ragEngine!.healthCheck();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  action: 'health',
                  healthStatus: health
                }, null, 2)
              }]
            };

          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Index management error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    };
  }

  private createRAGStatsHandler(): ToolHandler {
    return async (params: any, context: ToolContext): Promise<ToolResult> => {
      if (!this.ragEngine) {
        await this.initialize();
      }

      try {
        const { detailed, includeHealth } = params;

        const stats = await this.ragEngine!.getStats();
        let health = null;

        if (includeHealth) {
          health = await this.ragEngine!.healthCheck();
        }

        const result: any = {
          overview: {
            documentsIndexed: stats.documents.total,
            chunksGenerated: stats.chunks.total,
            vectorsStored: stats.vectors.total,
            indexSize: `${Math.round(stats.vectors.indexSize / 1024 / 1024 * 100) / 100} MB`
          },
          performance: {
            averageSearchTime: `${stats.performance.averageSearchTime}ms`,
            searchAccuracy: `${stats.performance.searchAccuracy}%`,
            lastSearchTime: stats.performance.lastSearchTime ? `${stats.performance.lastSearchTime}ms` : 'N/A'
          }
        };

        if (detailed) {
          result.detailed = {
            documents: stats.documents,
            chunks: stats.chunks,
            vectors: stats.vectors,
            providers: stats.providers
          };
        }

        if (health) {
          result.health = health;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ragStatistics: result,
              timestamp: new Date().toISOString(),
              engine: 'CQM RAG Engine v0.1.0'
            }, null, 2)
          }],
          metadata: {
            toolName: 'getRAGStats',
            documentsIndexed: stats.documents.total,
            healthStatus: health?.status || 'unknown'
          }
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `RAG stats error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    };
  }

  // ヘルパーメソッド
  private getRelevanceReason(result: any, context: any): string {
    const reasons: string[] = [];

    if (context?.currentFile && result.metadata.source.includes(context.currentFile)) {
      reasons.push('現在編集中のファイルに関連');
    }

    if (context?.recentFiles?.some((file: string) => result.metadata.source.includes(file))) {
      reasons.push('最近編集したファイルに関連');
    }

    if (result.metadata.type === 'typescript' || result.metadata.type === 'javascript') {
      reasons.push('コード実装に関連');
    }

    if (result.metadata.category === 'documentation') {
      reasons.push('ドキュメントに関連');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'セマンティック類似性';
  }

  // 公開メソッド
  async isReady(): Promise<boolean> {
    return this.isInitialized && this.ragEngine?.isReady() === true;
  }

  async shutdown(): Promise<void> {
    // RAGエンジンのクリーンアップ（必要に応じて）
    this.isInitialized = false;
    this.ragEngine = null;
  }
}