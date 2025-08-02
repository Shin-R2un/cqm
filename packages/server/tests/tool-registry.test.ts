/**
 * ToolRegistry テストスイート
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry } from '../src/tools/index.js';
import { ConfigManager } from '../src/config/index.js';

describe('ToolRegistry', () => {
  let toolRegistry: ToolRegistry;
  let configManager: ConfigManager;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    configManager = new ConfigManager();
  });

  describe('ツール登録と一覧', () => {
    it('コアツールが正しく登録されている', () => {
      const tools = toolRegistry.list();
      
      expect(tools.length).toBe(4);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('getProjectContext');
      expect(toolNames).toContain('searchDocuments');
      expect(toolNames).toContain('listFiles');
      expect(toolNames).toContain('readFile');
    });

    it('ツール情報が正しい形式で返される', () => {
      const tools = toolRegistry.list();
      
      tools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      });
    });

    it('特定のツールが存在するか確認できる', () => {
      expect(toolRegistry.get('getProjectContext')).toBeDefined();
      expect(toolRegistry.get('nonExistentTool')).toBeUndefined();
    });
  });

  describe('getProjectContext ツール', () => {
    it('基本プロジェクト情報を取得できる', async () => {
      const result = await toolRegistry.call('getProjectContext', {
        includeFiles: false,
        includeGitStatus: false
      }, {
        sessionId: 'test-session',
        configManager
      });
      
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('CQM');
      expect(result.isError).toBeFalsy();
    });

    it('ファイル情報を含むプロジェクト情報を取得できる', async () => {
      const result = await toolRegistry.call('getProjectContext', {
        includeFiles: true,
        includeGitStatus: false
      }, {
        sessionId: 'test-session',
        configManager
      });
      
      expect(result.content[0].text).toContain('files');
    });

    it('Git状態を含むプロジェクト情報を取得できる', async () => {
      const result = await toolRegistry.call('getProjectContext', {
        includeFiles: false,
        includeGitStatus: true
      }, {
        sessionId: 'test-session',
        configManager
      });
      
      expect(result.content[0].text).toContain('git');
    });
  });

  describe('searchDocuments ツール', () => {
    it('基本的な検索を実行できる', async () => {
      const result = await toolRegistry.call('searchDocuments', {
        query: 'CQM',
        limit: 5
      }, {
        sessionId: 'test-session',
        configManager
      });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeFalsy();
    });

    it('ファイルタイプ指定で検索できる', async () => {
      const result = await toolRegistry.call('searchDocuments', {
        query: 'test',
        fileTypes: ['ts', 'js'],
        limit: 10
      }, {
        sessionId: 'test-session',
        configManager
      });
      
      expect(result.isError).toBeFalsy();
    });

    it('パス指定で検索できる', async () => {
      const result = await toolRegistry.call('searchDocuments', {
        query: 'import',
        path: './src',
        limit: 5
      }, {
        sessionId: 'test-session',
        configManager
      });
      
      expect(result.isError).toBeFalsy();
    });
  });

  describe('listFiles ツール', () => {
    it('カレントディレクトリのファイル一覧を取得できる', async () => {
      const result = await toolRegistry.call('listFiles', {
        path: '.',
        recursive: false
      }, {
        sessionId: 'test-session',
        configManager
      });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeFalsy();
    });

    it('再帰的にファイル一覧を取得できる', async () => {
      const result = await toolRegistry.call('listFiles', {
        path: './src',
        recursive: true
      }, {
        sessionId: 'test-session',
        configManager
      });
      
      expect(result.isError).toBeFalsy();
    });

    it('特定のファイルタイプでフィルタリングできる', async () => {
      const result = await toolRegistry.call('listFiles', {
        path: '.',
        recursive: true,
        filter: '\\.ts$'
      }, {
        sessionId: 'test-session',
        configManager
      });
      
      expect(result.isError).toBeFalsy();
    });
  });

  describe('readFile ツール', () => {
    it('存在するファイルを読み込める', async () => {
      const result = await toolRegistry.call('readFile', {
        path: './package.json'
      }, {
        sessionId: 'test-session',
        configManager
      });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('"name"');
      expect(result.isError).toBeFalsy();
    });

    it('存在しないファイルでエラーを返す', async () => {
      const result = await toolRegistry.call('readFile', {
        path: './nonexistent-file.txt'
      }, {
        sessionId: 'test-session',
        configManager
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('File not found');
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しないツールでエラーを発生させる', async () => {
      await expect(
        toolRegistry.call('nonExistentTool', {}, {
          sessionId: 'test-session',
          configManager
        })
      ).rejects.toThrow('Tool not found: nonExistentTool');
    });
  });

  describe('ツール登録と解除', () => {
    it('カスタムツールを登録できる', () => {
      const customTool = {
        name: 'customTool',
        description: 'A custom test tool',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        handler: async (args: any) => ({
          content: [{ type: 'text', text: `Custom: ${args.message}` }],
          isError: false
        })
      };
      
      toolRegistry.register(customTool);
      
      expect(toolRegistry.get('customTool')).toBeDefined();
      expect(toolRegistry.list().length).toBe(5); // 4コア + 1カスタム
    });
  });
});