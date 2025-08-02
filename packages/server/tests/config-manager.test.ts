/**
 * ConfigManager テストスイート
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from '../src/config/index.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const testConfigPath = join(process.cwd(), 'test-config.json');
  const originalEnv = process.env;

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  afterEach(() => {
    // テスト設定ファイルをクリーンアップ
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
    
    // 環境変数を復元
    process.env = originalEnv;
  });

  describe('基本設定', () => {
    it('デフォルト設定が正しく読み込まれる', () => {
      const config = configManager.getConfig();
      
      expect(config.server.port).toBe(3000);
      expect(config.server.host).toBe('localhost');
      expect(config.mcp.maxConnections).toBe(10);
      expect(config.mcp.enableWebSocket).toBe(true);
      expect(config.mcp.enableStdio).toBe(true);
      expect(config.rag.provider).toBe('openai');
      expect(config.rag.model).toBe('text-embedding-3-small');
    });

    it('特定の設定値を取得できる', () => {
      expect(configManager.get('server.port')).toBe(3000);
      expect(configManager.get('mcp.maxConnections')).toBe(10);
      expect(configManager.get('rag.provider')).toBe('openai');
    });

    it('存在しないキーでundefinedを返す', () => {
      expect(configManager.get('nonexistent.key')).toBeUndefined();
    });
  });

  describe('設定更新', () => {
    it('設定値を更新できる', () => {
      configManager.set('server.port', 4000);
      expect(configManager.get('server.port')).toBe(4000);
    });

    it('ネストされた設定値を更新できる', () => {
      configManager.set('rag.model', 'text-embedding-3-large');
      expect(configManager.get('rag.model')).toBe('text-embedding-3-large');
    });

    it('設定全体を更新できる', () => {
      const newConfig = {
        server: { port: 5000, host: 'test-host' },
        mcp: { maxConnections: 20, enableWebSocket: false, enableStdio: true, timeout: 30000, heartbeatInterval: 15000 },
        rag: {
          provider: 'ollama' as const,
          model: 'test-model'
        },
        plugins: { enabled: ['filesystem'] },
        logging: { level: 'debug' as const, console: true, structured: false },
        security: {
          allowedOrigins: ['*'],
          rateLimiting: {
            enabled: true,
            maxRequestsPerMinute: 120,
            maxRequestsPerHour: 3600
          }
        }
      };
      
      configManager.update(newConfig);
      
      expect(configManager.get('server.port')).toBe(5000);
      expect(configManager.get('server.host')).toBe('test-host');
      expect(configManager.get('rag.provider')).toBe('ollama');
    });
  });

  describe('環境変数対応', () => {
    it('環境変数が正しく反映される', () => {
      process.env = {
        ...originalEnv,
        CQM_PORT: '8080',
        CQM_HOST: 'production-host',
        CQM_MAX_CONNECTIONS: '50',
        CQM_LOG_LEVEL: 'debug'
      };
      
      const envConfigManager = new ConfigManager();
      
      expect(envConfigManager.get('server.port')).toBe(8080);
      expect(envConfigManager.get('server.host')).toBe('production-host');
      expect(envConfigManager.get('mcp.maxConnections')).toBe(50);
      expect(envConfigManager.get('logging.level')).toBe('debug');
    });

    it('環境変数の型変換が正しく動作する', () => {
      process.env = {
        ...originalEnv,
        CQM_RAG_PROVIDER: 'ollama',
        CQM_RAG_MODEL: 'llama2'
      };
      
      const envConfigManager = new ConfigManager();
      
      expect(envConfigManager.get('rag.provider')).toBe('ollama');
      expect(envConfigManager.get('rag.model')).toBe('llama2');
    });
  });

  describe('設定ファイル操作', () => {
    it('設定ファイルから読み込みできる', () => {
      const testConfig = {
        server: { port: 9000, host: 'file-host' },
        mcp: { maxConnections: 30, enableWebSocket: true, enableStdio: false, timeout: 30000, heartbeatInterval: 15000 },
        rag: {
          provider: 'openai',
          model: 'text-embedding-3-large'
        },
        plugins: { enabled: ['filesystem'] },
        logging: { level: 'info', console: true, structured: false },
        security: {
          allowedOrigins: ['*'],
          rateLimiting: {
            enabled: true,
            maxRequestsPerMinute: 120,
            maxRequestsPerHour: 3600
          }
        }
      };
      
      writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
      
      const fileConfigManager = new ConfigManager(testConfigPath);
      
      expect(fileConfigManager.get('server.port')).toBe(9000);
      expect(fileConfigManager.get('server.host')).toBe('file-host');
      expect(fileConfigManager.get('rag.model')).toBe('text-embedding-3-large');
    });

    it('設定ファイルを保存できる', async () => {
      configManager.set('server.port', 7000);
      configManager.set('server.host', 'save-test');
      
      await configManager.saveConfig(testConfigPath);
      
      expect(existsSync(testConfigPath)).toBe(true);
      
      const savedConfigManager = new ConfigManager(testConfigPath);
      expect(savedConfigManager.get('server.port')).toBe(7000);
      expect(savedConfigManager.get('server.host')).toBe('save-test');
    });
  });

  describe('設定検証', () => {
    it('有効な設定で検証が成功する', () => {
      const result = configManager.validate();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('無効なポート番号で検証が失敗する', () => {
      configManager.set('server.port', -1);
      
      const result = configManager.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('port'))).toBe(true);
    });

    it('無効な最大接続数で検証が失敗する', () => {
      configManager.set('mcp.maxConnections', 0);
      
      const result = configManager.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maxConnections'))).toBe(true);
    });

    it('無効なログレベルで検証が失敗する', () => {
      configManager.set('logging.level', 'invalid-level');
      
      const result = configManager.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('logging.level'))).toBe(true);
    });
  });

  describe('設定サマリー', () => {
    it('設定の要約を正しく生成する', () => {
      // 新しいConfigManagerインスタンスでテスト
      const freshConfigManager = new ConfigManager();
      const summary = freshConfigManager.getSummary();
      
      expect(summary.server).toBe('localhost:3000');
      expect(summary.mcp).toBe('WebSocket:true Stdio:true MaxConn:10');
      expect(summary.rag).toBe('openai:text-embedding-3-small');
      expect(summary.plugins).toEqual(['filesystem']);
      expect(summary.logging).toBe('info');
    });
  });

  describe('設定監視', () => {
    it('設定変更を監視できる', () => {
      let callbackCalled = false;
      let receivedConfig: any = null;
      
      const unwatch = configManager.watch((config) => {
        callbackCalled = true;
        receivedConfig = config;
      });
      
      configManager.set('server.port', 9999);
      
      expect(callbackCalled).toBe(true);
      expect(receivedConfig.server.port).toBe(9999);
      
      unwatch();
    });
  });
});