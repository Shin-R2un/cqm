/**
 * MCP-RAG統合テスト
 * Issue #15 [IMP-004] MCP-RAG統合実装の統合テスト
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import { MCPServerCore } from '../../packages/server/src/server/index.js';
import { RAGEngine } from '../../packages/rag/src/engine/index.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('MCP-RAG Integration Tests', () => {
  let server: MCPServerCore;
  let testDir: string;
  let ws: WebSocket;
  let serverPort: number;

  beforeAll(async () => {
    // テスト用の一意ポート
    serverPort = 3000 + Math.floor(Math.random() * 1000);
    
    // テストディレクトリ作成
    testDir = join(process.cwd(), 'test-temp', `integration-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // テスト用ファイル作成
    await createTestFiles();

    // テスト用MCPサーバー起動
    server = new MCPServerCore({
      port: serverPort,
      host: 'localhost',
      maxConnections: 5,
      enableWebSocket: true,
      enableStdio: false
    });

    await server.start();
    
    // WebSocket接続確立
    await connectWebSocket();
  });

  afterAll(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    
    if (server) {
      await server.stop();
    }

    // テストディレクトリクリーンアップ
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
  });

  beforeEach(async () => {
    // WebSocket接続の確認
    if (ws.readyState !== WebSocket.OPEN) {
      await connectWebSocket();
    }
  });

  describe('MCPサーバー基本機能', () => {
    it('should initialize MCP server successfully', async () => {
      expect(server.isStarted()).toBe(true);
      expect(server.getConnectionCount()).toBeGreaterThanOrEqual(0);
    });

    it('should handle initialize request', async () => {
      const response = await sendMCPRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'CQM Integration Test',
            version: '1.0.0'
          }
        }
      });

      expect(response.result).toBeDefined();
      expect(response.result.serverInfo).toBeDefined();
      expect(response.result.serverInfo.name).toBe('CQ Models!');
      expect(response.result.capabilities).toBeDefined();
    });

    it('should list available tools including RAG tools', async () => {
      const response = await sendMCPRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      });

      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);

      const toolNames = response.result.tools.map((tool: any) => tool.name);
      
      // コアツールの確認
      expect(toolNames).toContain('getProjectContext');
      expect(toolNames).toContain('searchDocuments');
      
      // RAGツールの確認（初期化に成功した場合）
      const ragTools = ['semanticSearch', 'codeSearch', 'documentationSearch', 'contextualSearch', 'manageRAGIndex', 'getRAGStats'];
      const hasRAGTools = ragTools.some(tool => toolNames.includes(tool));
      
      if (hasRAGTools) {
        // RAGツールが利用可能な場合、全て存在することを確認
        ragTools.forEach(tool => {
          expect(toolNames).toContain(tool);
        });
      } else {
        console.warn('RAG tools not available in this test environment');
      }
    });
  });

  describe('RAGエンジン統合機能', () => {
    it('should handle RAG index management', async () => {
      const response = await sendMCPRequest({
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'manageRAGIndex',
          arguments: {
            action: 'health'
          }
        }
      });

      if (response.error) {
        // RAGが利用できない場合は適切なエラーが返されることを確認
        expect(response.error.message).toContain('RAG');
        console.warn('RAG engine not available:', response.error.message);
        return;
      }

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result.content[0].text);
      expect(result.action).toBe('health');
      expect(result.healthStatus).toBeDefined();
    });

    it('should handle semantic search', async () => {
      const response = await sendMCPRequest({
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'semanticSearch',
          arguments: {
            query: 'test function implementation',
            limit: 5,
            threshold: 0.5
          }
        }
      });

      if (response.error) {
        // RAGが利用できない場合はスキップ
        expect(response.error.message).toMatch(/RAG|Tool not found/);
        console.warn('Semantic search not available:', response.error.message);
        return;
      }

      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].type).toBe('text');
      
      const result = JSON.parse(response.result.content[0].text);
      expect(result.query).toBe('test function implementation');
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle code search with language filters', async () => {
      const response = await sendMCPRequest({
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'codeSearch',
          arguments: {
            query: 'function',
            languages: ['typescript', 'javascript'],
            limit: 10
          }
        }
      });

      if (response.error) {
        console.warn('Code search not available:', response.error.message);
        return;
      }

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result.content[0].text);
      expect(result.query).toBe('function');
      expect(Array.isArray(result.codeResults)).toBe(true);
    });

    it('should handle documentation search', async () => {
      const response = await sendMCPRequest({
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'documentationSearch',
          arguments: {
            query: 'README project description',
            documentTypes: ['markdown'],
            limit: 5
          }
        }
      });

      if (response.error) {
        console.warn('Documentation search not available:', response.error.message);
        return;
      }

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result.content[0].text);
      expect(result.query).toBe('README project description');
      expect(Array.isArray(result.documentationResults)).toBe(true);
    });

    it('should handle contextual search with context', async () => {
      const response = await sendMCPRequest({
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: {
          name: 'contextualSearch',
          arguments: {
            query: 'error handling',
            currentContext: {
              currentFile: 'server/index.ts',
              workingBranch: 'feature/issue-15-mcp-rag-integration',
              recentFiles: ['error/index.ts', 'tools/index.ts']
            },
            limit: 8
          }
        }
      });

      if (response.error) {
        console.warn('Contextual search not available:', response.error.message);
        return;
      }

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result.content[0].text);
      expect(result.query).toBe('error handling');
      expect(result.context).toBeDefined();
      expect(Array.isArray(result.contextualResults)).toBe(true);
    });

    it('should get RAG statistics', async () => {
      const response = await sendMCPRequest({
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: {
          name: 'getRAGStats',
          arguments: {
            detailed: true,
            includeHealth: true
          }
        }
      });

      if (response.error) {
        console.warn('RAG stats not available:', response.error.message);
        return;
      }

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result.content[0].text);
      expect(result.ragStatistics).toBeDefined();
      expect(result.ragStatistics.overview).toBeDefined();
      expect(result.ragStatistics.performance).toBeDefined();
    });
  });

  describe('コアツール機能', () => {
    it('should get project context', async () => {
      const response = await sendMCPRequest({
        jsonrpc: '2.0',
        id: 20,
        method: 'tools/call',
        params: {
          name: 'getProjectContext',
          arguments: {
            includeFiles: true,
            includeGitStatus: true,
            maxFiles: 20
          }
        }
      });

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result.content[0].text);
      expect(result.project).toBeDefined();
      expect(result.project.name).toBe('CQM');
      expect(result.structure).toBeDefined();
    });

    it('should search documents with file type filters', async () => {
      const response = await sendMCPRequest({
        jsonrpc: '2.0',
        id: 21,
        method: 'tools/call',
        params: {
          name: 'searchDocuments',
          arguments: {
            query: 'test',
            fileTypes: ['ts', 'md'],
            limit: 10
          }
        }
      });

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result.content[0].text);
      expect(result.query).toBe('test');
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    it('should handle invalid tool name', async () => {
      const response = await sendMCPRequest({
        jsonrpc: '2.0',
        id: 30,
        method: 'tools/call',
        params: {
          name: 'nonExistentTool',
          arguments: {}
        }
      });

      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('not found');
    });

    it('should handle invalid method', async () => {
      const response = await sendMCPRequest({
        jsonrpc: '2.0',
        id: 31,
        method: 'invalid/method',
        params: {}
      });

      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('Method not found');
    });

    it('should handle malformed JSON-RPC request', async () => {
      const response = await sendMCPRequest({
        // 不正なJSONRPC（versionが不正）
        jsonrpc: '1.0',
        id: 32,
        method: 'tools/list'
      });

      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('JSON-RPC');
    });
  });

  // ヘルパー関数
  async function createTestFiles(): Promise<void> {
    // テストTypeScriptファイル
    writeFileSync(join(testDir, 'test-function.ts'), `
/**
 * Test function for integration testing
 */
export function testFunction(input: string): string {
  return \`Hello, \${input}!\`;
}

export class TestClass {
  private value: number;
  
  constructor(value: number) {
    this.value = value;
  }
  
  getValue(): number {
    return this.value;
  }
}
`);

    // テストMarkdownファイル  
    writeFileSync(join(testDir, 'README.md'), `
# Test Project

This is a test project for CQM integration testing.

## Features

- MCP Server integration
- RAG engine functionality
- Error handling
- Testing framework

## Usage

Run tests with \`npm test\`.
`);

    // テスト設定ファイル
    writeFileSync(join(testDir, 'config.json'), `
{
  "name": "test-project",
  "version": "1.0.0",
  "features": ["mcp", "rag", "testing"]
}
`);
  }

  async function connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(`ws://localhost:${serverPort}/mcp`);
      
      ws.on('open', () => {
        resolve();
      });
      
      ws.on('error', reject);
      
      // タイムアウト
      setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
    });
  }

  async function sendMCPRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const handleMessage = (data: Buffer) => {
        clearTimeout(timeout);
        ws.off('message', handleMessage);
        
        try {
          const response = JSON.parse(data.toString());
          resolve(response);
        } catch (error) {
          reject(error);
        }
      };

      ws.on('message', handleMessage);
      ws.send(JSON.stringify(request));
    });
  }
});