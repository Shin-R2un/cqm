/**
 * CLI コマンド定義
 */

export interface CommandOptions {
  [key: string]: any;
}

export interface CommandHandler {
  (options: CommandOptions): Promise<void>;
}

export interface CommandDefinition {
  name: string;
  description: string;
  handler: CommandHandler;
  options?: Array<{
    flags: string;
    description: string;
    defaultValue?: string;
  }>;
}

// 基本コマンド
export const COMMANDS: CommandDefinition[] = [
  {
    name: 'start',
    description: 'Start CQM MCP server',
    handler: async (options) => {
      console.log('Starting server with options:', options);
    },
    options: [
      { flags: '-p, --port <port>', description: 'Port number', defaultValue: '3000' },
      { flags: '-h, --host <host>', description: 'Host address', defaultValue: 'localhost' },
    ],
  },
  {
    name: 'stop',
    description: 'Stop CQM MCP server',
    handler: async () => {
      console.log('Stopping server...');
    },
  },
  {
    name: 'status',
    description: 'Show system status',
    handler: async () => {
      console.log('System status: Running');
    },
  },
];