/**
 * MCPServerCore テストスイート
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPServerCore } from '../src/server/index.js';
import { ConfigManager } from '../src/config/index.js';
import { ToolRegistry } from '../src/tools/index.js';

describe('MCPServerCore', () => {
  let server: MCPServerCore;

  beforeEach(() => {
    server = new MCPServerCore({
      port: 3001, // テスト用ポート
      enableWebSocket: false, // テストでは無効
      enableStdio: false
    });
  });

  afterEach(async () => {
    if (server.isStarted()) {
      await server.stop();
    }
  });

  describe('基本機能', () => {
    it('サーバーが正しく初期化される', () => {
      expect(server).toBeDefined();
      expect(server.isStarted()).toBe(false);
    });

    it('サーバー情報が正しく取得される', () => {
      const serverInfo = server.getServerInfo();
      
      expect(serverInfo.name).toBe('CQ Models!');
      expect(serverInfo.version).toBe('0.1.0');
      expect(serverInfo.protocolVersion).toBe('2024-11-05');
      expect(serverInfo.capabilities).toBeDefined();
    });

    it('接続数が正しく取得される', () => {
      expect(server.getConnectionCount()).toBe(0);
    });

    it('ツールレジストリが正しく初期化される', () => {
      const toolRegistry = server.getToolRegistry();
      expect(toolRegistry).toBeInstanceOf(ToolRegistry);
      
      const tools = toolRegistry.list();
      expect(tools.length).toBeGreaterThan(0);
      
      // コアツールの確認
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('getProjectContext');
      expect(toolNames).toContain('searchDocuments');
      expect(toolNames).toContain('listFiles');
      expect(toolNames).toContain('readFile');
    });
  });

  describe('設定管理', () => {
    it('デフォルト設定が正しく設定される', () => {
      const configManager = new ConfigManager();
      const config = configManager.getConfig();
      
      expect(config.server.port).toBe(3000);
      expect(config.server.host).toBe('localhost');
      expect(config.mcp.maxConnections).toBe(10);
      expect(config.mcp.enableWebSocket).toBe(true);
      expect(config.mcp.enableStdio).toBe(true);
    });

    it('環境変数が正しく反映される', () => {
      // 環境変数をモック
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        CQM_PORT: '4000',
        CQM_HOST: 'test-host',
        CQM_MAX_CONNECTIONS: '20'
      };

      const configManager = new ConfigManager();
      const config = configManager.getConfig();
      
      expect(config.server.port).toBe(4000);
      expect(config.server.host).toBe('test-host');
      expect(config.mcp.maxConnections).toBe(20);

      // 環境変数を復元
      process.env = originalEnv;
    });

    it('設定の検証が正しく動作する', () => {
      const configManager = new ConfigManager();
      
      // 正常な設定
      const validationResult = configManager.validate();
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      
      // 不正な設定
      configManager.set('server.port', -1);
      const invalidResult = configManager.validate();
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('ツール機能', () => {
    let toolRegistry: ToolRegistry;

    beforeEach(() => {
      toolRegistry = server.getToolRegistry();
    });

    it('getProjectContext ツールが正しく動作する', async () => {
      const result = await toolRegistry.call('getProjectContext', {
        includeFiles: false,
        includeGitStatus: false
      }, {
        sessionId: 'test-session',
        configManager: new ConfigManager()
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('CQM');
      expect(result.isError).toBeFalsy();
    });

    it('searchDocuments ツールが正しく動作する', async () => {
      const result = await toolRegistry.call('searchDocuments', {
        query: 'test',
        limit: 5
      }, {
        sessionId: 'test-session',
        configManager: new ConfigManager()
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeFalsy();
    });

    it('listFiles ツールが正しく動作する', async () => {
      const result = await toolRegistry.call('listFiles', {
        path: '.',
        recursive: false
      }, {
        sessionId: 'test-session',
        configManager: new ConfigManager()
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeFalsy();
    });

    it('存在しないツールでエラーが発生する', async () => {
      await expect(
        toolRegistry.call('nonExistentTool', {}, {
          sessionId: 'test-session',
          configManager: new ConfigManager()
        })
      ).rejects.toThrow('Tool not found: nonExistentTool');
    });
  });

  describe('エラーハンドリング', () => {
    it('重複起動でエラーが発生する', async () => {
      const testServer = new MCPServerCore({
        port: 3002,
        enableWebSocket: false,
        enableStdio: false
      });

      await testServer.start();
      
      await expect(testServer.start()).rejects.toThrow('Server is already running');
      
      await testServer.stop();
    });
  });

  describe('MCPプロトコル', () => {
    it('初期化レスポンスが正しい形式である', async () => {
      const server = new MCPServerCore();
      
      // プライベートメソッドにアクセスするためのハック
      const handleInitialize = (server as any).handleInitialize.bind(server);
      
      const response = await handleInitialize({}, 'test-id');
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-id');
      expect(response.result.serverInfo).toBeDefined();
      expect(response.result.capabilities).toBeDefined();
    });

    it('ツール一覧レスポンスが正しい形式である', async () => {
      const server = new MCPServerCore();
      
      const handleToolsList = (server as any).handleToolsList.bind(server);
      const response = await handleToolsList('test-id');
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-id');
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      expect(response.result.tools.length).toBeGreaterThan(0);
    });
  });
});