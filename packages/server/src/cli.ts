#!/usr/bin/env node
/**
 * CQM MCP Server CLI実行可能ファイル
 */
import { Command } from 'commander';
import { MCPServerCore } from './server/index.js';
import { ConfigManager } from './config/index.js';

const program = new Command();

program
  .name('cqm-server')
  .description('CQM MCP Server - Unified context manager for AI models')
  .version('0.1.0');

program
  .command('start')
  .description('Start the CQM MCP Server')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('-h, --host <host>', 'Host address', 'localhost')
  .option('--max-connections <max>', 'Maximum connections', '10')
  .option('--config <path>', 'Configuration file path', './cqm.config.json')
  .option('--stdio-only', 'Enable only stdio transport')
  .option('--websocket-only', 'Enable only WebSocket transport')
  .option('--log-level <level>', 'Log level (debug|info|warn|error)', 'info')
  .action(async (options) => {
    try {
      console.log('🚀 Starting CQM MCP Server...');
      
      const server = new MCPServerCore({
        port: parseInt(options.port),
        host: options.host,
        maxConnections: parseInt(options.maxConnections),
        configPath: options.config,
        enableStdio: !options.websocketOnly,
        enableWebSocket: !options.stdioOnly
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await server.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        await server.stop();
        process.exit(0);
      });

      await server.start();
      
      // Keep process alive
      process.stdin.resume();
      
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Configuration management')
  .option('--path <path>', 'Configuration file path', './cqm.config.json')
  .option('--show', 'Show current configuration')
  .option('--validate', 'Validate configuration')
  .option('--create-default', 'Create default configuration file')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager(options.path);
      
      if (options.show) {
        console.log('📋 Current Configuration:');
        console.log(JSON.stringify(configManager.getConfig(), null, 2));
        return;
      }
      
      if (options.validate) {
        const validation = configManager.validate();
        if (validation.valid) {
          console.log('✅ Configuration is valid');
        } else {
          console.log('❌ Configuration has errors:');
          validation.errors.forEach(error => console.log(`   - ${error}`));
          process.exit(1);
        }
        return;
      }
      
      if (options.createDefault) {
        await configManager.saveConfig(options.path);
        console.log(`✅ Default configuration created: ${options.path}`);
        return;
      }
      
      // Default: show summary
      const summary = configManager.getSummary();
      console.log('📋 Configuration Summary:');
      console.log(`   Server: ${summary.server}`);
      console.log(`   RAG: ${summary.rag}`);
      console.log(`   MCP: ${summary.mcp}`);
      console.log(`   Plugins: ${summary.plugins.join(', ')}`);
      console.log(`   Logging: ${summary.logging}`);
      
    } catch (error) {
      console.error('❌ Configuration error:', error);
      process.exit(1);
    }
  });

program
  .command('tools')
  .description('List available tools')
  .action(() => {
    try {
      const server = new MCPServerCore();
      const tools = server.getToolRegistry().list();
      
      console.log(`🔧 Available Tools (${tools.length}):`);
      tools.forEach(tool => {
        console.log(`\n📋 ${tool.name}`);
        console.log(`   Description: ${tool.description}`);
        console.log(`   Schema: ${JSON.stringify(tool.inputSchema, null, 4)}`);
      });
      
    } catch (error) {
      console.error('❌ Error listing tools:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show server status')
  .option('--host <host>', 'Server host', 'localhost')
  .option('--port <port>', 'Server port', '3000')
  .action(async (options) => {
    try {
      // 簡単なヘルスチェック
      const response = await fetch(`http://${options.host}:${options.port}/health`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Server is running');
        console.log(`   Status: ${data.status}`);
        console.log(`   Uptime: ${data.uptime}`);
        console.log(`   Connections: ${data.connections}`);
      } else {
        console.log('❌ Server is not responding');
        process.exit(1);
      }
    } catch (error) {
      console.log('❌ Server is not reachable');
      console.log(`   Error: ${error.message}`);
      process.exit(1);
    }
  });

// メインエントリーポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}