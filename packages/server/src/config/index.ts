/**
 * 設定管理
 * 環境変数、設定ファイル、動的設定の統合管理
 */
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { mkdir } from 'fs/promises';
import { CQMConfig, deepMerge } from '@cqm/shared';

export interface MCPServerConfig extends CQMConfig {
  mcp: {
    enableWebSocket: boolean;
    enableStdio: boolean;
    maxConnections: number;
    timeout: number;
    heartbeatInterval: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
    console: boolean;
    structured: boolean;
  };
  security: {
    allowedOrigins: string[];
    rateLimiting: {
      enabled: boolean;
      maxRequestsPerMinute: number;
      maxRequestsPerHour: number;
    };
  };
}

const DEFAULT_CONFIG: MCPServerConfig = {
  server: {
    port: 3000,
    host: 'localhost'
  },
  rag: {
    provider: 'openai',
    model: 'text-embedding-3-small'
  },
  plugins: {
    enabled: ['filesystem']
  },
  mcp: {
    enableWebSocket: true,
    enableStdio: true,
    maxConnections: 10,
    timeout: 30000,
    heartbeatInterval: 15000
  },
  logging: {
    level: 'info',
    console: true,
    structured: false
  },
  security: {
    allowedOrigins: ['*'],
    rateLimiting: {
      enabled: true,
      maxRequestsPerMinute: 120,
      maxRequestsPerHour: 3600
    }
  }
};

export class ConfigManager {
  private config: MCPServerConfig;
  private readonly configPath: string;
  private watchers: Array<(config: MCPServerConfig) => void> = [];

  constructor(configPath = './cqm.config.json') {
    this.configPath = configPath;
    this.config = this.loadConfig();
  }

  private loadConfig(): MCPServerConfig {
    let fileConfig: Partial<MCPServerConfig> = {};
    
    // 設定ファイルの読み込み
    if (existsSync(this.configPath)) {
      try {
        const fileContent = readFileSync(this.configPath, 'utf-8');
        fileConfig = JSON.parse(fileContent);
        console.log(`📋 Loaded config from: ${this.configPath}`);
      } catch (error) {
        console.warn(`⚠️  Failed to load config from ${this.configPath}:`, error);
      }
    } else {
      console.log(`📋 Using default config (${this.configPath} not found)`);
    }

    // 環境変数の読み込み
    const envConfig = this.loadFromEnvironment();
    
    // 設定をマージ（環境変数 > ファイル > デフォルト）
    return deepMerge(
      deepMerge(DEFAULT_CONFIG, fileConfig),
      envConfig
    );
  }

  private loadFromEnvironment(): Partial<MCPServerConfig> {
    const envConfig: Partial<MCPServerConfig> = {};

    // サーバー設定
    if (process.env.CQM_PORT) {
      envConfig.server = { 
        ...envConfig.server,
        port: parseInt(process.env.CQM_PORT, 10) 
      };
    }
    
    if (process.env.CQM_HOST) {
      envConfig.server = { 
        ...envConfig.server,
        host: process.env.CQM_HOST 
      };
    }

    // RAG設定
    if (process.env.CQM_RAG_PROVIDER) {
      envConfig.rag = {
        ...envConfig.rag,
        provider: process.env.CQM_RAG_PROVIDER as 'openai' | 'ollama'
      };
    }
    
    if (process.env.CQM_RAG_MODEL) {
      envConfig.rag = {
        ...envConfig.rag,
        model: process.env.CQM_RAG_MODEL
      };
    }

    // MCP設定
    if (process.env.CQM_MAX_CONNECTIONS) {
      envConfig.mcp = {
        ...envConfig.mcp,
        maxConnections: parseInt(process.env.CQM_MAX_CONNECTIONS, 10)
      };
    }

    // ログ設定
    if (process.env.CQM_LOG_LEVEL) {
      envConfig.logging = {
        ...envConfig.logging,
        level: process.env.CQM_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error'
      };
    }
    
    if (process.env.CQM_LOG_FILE) {
      envConfig.logging = {
        ...envConfig.logging,
        file: process.env.CQM_LOG_FILE
      };
    }

    // プラグイン設定
    if (process.env.CQM_PLUGINS) {
      envConfig.plugins = {
        enabled: process.env.CQM_PLUGINS.split(',').map(p => p.trim())
      };
    }

    return envConfig;
  }

  getConfig(): MCPServerConfig {
    return { ...this.config };
  }

  get<T = any>(path: string): T | undefined {
    const keys = path.split('.');
    let current: any = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  set(path: string, value: any): void {
    const keys = path.split('.');
    let current: any = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    this.notifyWatchers();
  }

  update(updates: Partial<MCPServerConfig>): void {
    this.config = deepMerge(this.config, updates);
    this.notifyWatchers();
  }

  async saveConfig(path?: string): Promise<void> {
    const targetPath = path || this.configPath;
    
    try {
      // ディレクトリが存在しない場合は作成
      const dir = dirname(targetPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      
      const configJson = JSON.stringify(this.config, null, 2);
      writeFileSync(targetPath, configJson, 'utf-8');
      
      console.log(`💾 Config saved to: ${targetPath}`);
    } catch (error) {
      console.error(`❌ Failed to save config to ${targetPath}:`, error);
      throw error;
    }
  }

  reload(): void {
    console.log('🔄 Reloading configuration...');
    this.config = this.loadConfig();
    this.notifyWatchers();
  }

  // 設定変更の監視
  watch(callback: (config: MCPServerConfig) => void): () => void {
    this.watchers.push(callback);
    
    // unwatch関数を返す
    return () => {
      const index = this.watchers.indexOf(callback);
      if (index > -1) {
        this.watchers.splice(index, 1);
      }
    };
  }

  private notifyWatchers(): void {
    for (const watcher of this.watchers) {
      try {
        watcher(this.config);
      } catch (error) {
        console.error('Config watcher error:', error);
      }
    }
  }

  // バリデーション
  validate(): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // ポート番号チェック
    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('server.port must be between 1 and 65535');
    }

    // 最大接続数チェック
    if (this.config.mcp.maxConnections < 1) {
      errors.push('mcp.maxConnections must be at least 1');
    }

    // タイムアウトチェック
    if (this.config.mcp.timeout < 1000) {
      errors.push('mcp.timeout must be at least 1000ms');
    }

    // RAGプロバイダーチェック
    const validProviders = ['openai', 'ollama'];
    if (!validProviders.includes(this.config.rag.provider)) {
      errors.push(`rag.provider must be one of: ${validProviders.join(', ')}`);
    }

    // ログレベルチェック
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(this.config.logging.level)) {
      errors.push(`logging.level must be one of: ${validLogLevels.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 設定の概要表示
  getSummary(): {
    server: string;
    rag: string;
    mcp: string;
    plugins: string[];
    logging: string;
  } {
    return {
      server: `${this.config.server.host}:${this.config.server.port}`,
      rag: `${this.config.rag.provider}:${this.config.rag.model}`,
      mcp: `WebSocket:${this.config.mcp.enableWebSocket} Stdio:${this.config.mcp.enableStdio} MaxConn:${this.config.mcp.maxConnections}`,
      plugins: this.config.plugins.enabled,
      logging: `${this.config.logging.level}${this.config.logging.file ? ` -> ${this.config.logging.file}` : ''}`
    };
  }
}