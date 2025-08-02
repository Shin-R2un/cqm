/**
 * CLI 設定管理
 */
import { CQMConfig } from '@cqm/shared';

export interface CliConfig extends CQMConfig {
  cli: {
    verbose: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

export const DEFAULT_CLI_CONFIG: CliConfig = {
  server: {
    port: 3000,
    host: 'localhost',
  },
  rag: {
    provider: 'openai',
    model: 'text-embedding-3-small',
  },
  plugins: {
    enabled: ['filesystem'],
  },
  cli: {
    verbose: false,
    logLevel: 'info',
  },
};

export class ConfigManager {
  private config: CliConfig;

  constructor(configPath?: string) {
    this.config = { ...DEFAULT_CLI_CONFIG };
    // 設定ファイル読み込み処理（実装予定）
  }

  getConfig(): CliConfig {
    return this.config;
  }

  updateConfig(updates: Partial<CliConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  saveConfig(): void {
    // 設定ファイル保存処理（実装予定）
    console.log('Configuration saved');
  }
}