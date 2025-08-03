/**
 * MCPサーバーコア実装
 * CQM-TEC-001, CQM-MCP-001設計に基づく本格的なMCPサーバー
 */
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import { MCPRequest, MCPResponse, CQMError, MCP_PROTOCOL_VERSION, ERROR_CODES } from '@cqm/shared';
import { ConnectionManager } from '../connection/index.js';
import { ToolRegistry } from '../tools/index.js';
import { ErrorHandler } from '../error/index.js';
import { ConfigManager } from '../config/index.js';

export interface MCPServerOptions {
  port?: number;
  host?: string;
  maxConnections?: number;
  enableWebSocket?: boolean;
  enableStdio?: boolean;
  configPath?: string;
}

export interface ServerInfo {
  name: string;
  version: string;
  description: string;
  protocolVersion: string;
  capabilities: ServerCapabilities;
}

export interface ServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: {};
}

export class MCPServerCore {
  private readonly options: Required<MCPServerOptions>;
  private readonly connectionManager: ConnectionManager;
  private readonly toolRegistry: ToolRegistry;
  private readonly errorHandler: ErrorHandler;
  private readonly configManager: ConfigManager;
  
  private httpServer?: Server;
  private wsServer?: WebSocketServer;
  private isRunning = false;
  
  private readonly serverInfo: ServerInfo = {
    name: 'CQ Models!',
    version: '0.1.0',
    description: 'Unified context manager for AI models',
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true },
      logging: {}
    }
  };

  constructor(options: MCPServerOptions = {}) {
    this.options = {
      port: options.port || 3000,
      host: options.host || 'localhost',
      maxConnections: options.maxConnections || 10,
      enableWebSocket: options.enableWebSocket ?? true,
      enableStdio: options.enableStdio ?? true,
      configPath: options.configPath || './cqm.config.json'
    };

    this.configManager = new ConfigManager(this.options.configPath);
    this.connectionManager = new ConnectionManager(this.options.maxConnections);
    this.toolRegistry = new ToolRegistry(this.configManager);
    this.errorHandler = new ErrorHandler();
    
    this.setupCoreTools();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new CQMError('Server is already running', 'SERVER_ALREADY_RUNNING');
    }

    console.log(`🚀 Starting CQM MCP Server...`);
    console.log(`   Protocol: MCP ${this.serverInfo.protocolVersion}`);
    console.log(`   Host: ${this.options.host}:${this.options.port}`);
    console.log(`   Max Connections: ${this.options.maxConnections}`);

    // RAGツールの初期化
    try {
      await this.toolRegistry.setupRAGTools();
    } catch (error) {
      console.warn('⚠️  RAG tools initialization failed, continuing without RAG features:', error);
    }

    if (this.options.enableWebSocket) {
      await this.startWebSocketServer();
    }

    if (this.options.enableStdio) {
      this.startStdioServer();
    }

    this.isRunning = true;
    console.log(`✅ CQM MCP Server started successfully`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping CQM MCP Server...');

    if (this.wsServer) {
      this.wsServer.close();
    }

    if (this.httpServer) {
      this.httpServer.close();
    }

    // クライアント接続をクリーンアップ
    this.connectionManager.closeAllConnections();

    this.isRunning = false;
    console.log('✅ CQM MCP Server stopped');
  }

  private async startWebSocketServer(): Promise<void> {
    this.httpServer = createServer();
    this.wsServer = new WebSocketServer({ 
      server: this.httpServer,
      path: '/mcp'
    });

    this.wsServer.on('connection', (ws: WebSocket, request) => {
      this.handleWebSocketConnection(ws, request);
    });

    return new Promise((resolve, reject) => {
      this.httpServer!.listen(this.options.port, this.options.host, () => {
        console.log(`🔌 WebSocket server listening on ws://${this.options.host}:${this.options.port}/mcp`);
        resolve();
      });

      this.httpServer!.on('error', reject);
    });
  }

  private startStdioServer(): void {
    console.log('📡 Stdio server ready for MCP connections');
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      this.handleStdioInput(chunk);
    });
  }

  private handleWebSocketConnection(ws: WebSocket, request: any): void {
    try {
      const sessionId = this.connectionManager.addConnection({
        type: 'websocket',
        transport: ws,
        clientInfo: {
          userAgent: request.headers['user-agent'] || 'unknown',
          origin: request.headers.origin || 'unknown'
        }
      });

      console.log(`📱 New WebSocket connection: ${sessionId}`);

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          const response = await this.handleMCPMessage(message, sessionId);
          if (response) {
            ws.send(JSON.stringify(response));
          }
        } catch (error) {
          const errorResponse = this.errorHandler.handleError(error, { sessionId, method: 'unknown' });
          ws.send(JSON.stringify(errorResponse));
        }
      });

      ws.on('close', () => {
        console.log(`📱 WebSocket connection closed: ${sessionId}`);
        this.connectionManager.removeConnection(sessionId);
      });

      ws.on('error', (error) => {
        console.error(`📱 WebSocket error for ${sessionId}:`, error);
        this.connectionManager.removeConnection(sessionId);
      });

    } catch (error) {
      console.error('Failed to handle WebSocket connection:', error);
      ws.close();
    }
  }

  private async handleStdioInput(chunk: string): Promise<void> {
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          const response = await this.handleMCPMessage(message, 'stdio');
          if (response) {
            process.stdout.write(JSON.stringify(response) + '\n');
          }
        } catch (error) {
          const errorResponse = this.errorHandler.handleError(error, { sessionId: 'stdio', method: 'unknown' });
          process.stdout.write(JSON.stringify(errorResponse) + '\n');
        }
      }
    }
  }

  private async handleMCPMessage(message: any, sessionId: string): Promise<MCPResponse | null> {
    // MCPプロトコル基本検証
    if (!message.jsonrpc || message.jsonrpc !== '2.0') {
      throw new CQMError('Invalid JSON-RPC version', 'INVALID_REQUEST', ERROR_CODES.INVALID_REQUEST);
    }

    const method = message.method;
    const id = message.id;
    const params = message.params || {};

    try {
      // セッション更新
      this.connectionManager.updateActivity(sessionId);

      // MCPメソッド処理
      switch (method) {
        case 'initialize':
          return await this.handleInitialize(params, id);
        
        case 'initialized':
          // クライアント初期化完了通知
          return null;
        
        case 'tools/list':
          return await this.handleToolsList(id);
        
        case 'tools/call':
          return await this.handleToolsCall(params, id, sessionId);
        
        case 'resources/list':
          return await this.handleResourcesList(id);
        
        case 'prompts/list':
          return await this.handlePromptsList(id);
        
        case 'ping':
          return {
            jsonrpc: '2.0',
            id,
            result: { message: 'pong' }
          };
        
        default:
          throw new CQMError(
            `Method not found: ${method}`,
            'METHOD_NOT_FOUND',
            ERROR_CODES.METHOD_NOT_FOUND
          );
      }
    } catch (error) {
      return this.errorHandler.handleError(error, { sessionId, method, requestId: id });
    }
  }

  private async handleInitialize(params: any, id: string | number): Promise<MCPResponse> {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        serverInfo: this.serverInfo,
        capabilities: this.serverInfo.capabilities
      }
    };
  }

  private async handleToolsList(id: string | number): Promise<MCPResponse> {
    const tools = this.toolRegistry.list().map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    return {
      jsonrpc: '2.0',
      id,
      result: { tools }
    };
  }

  private async handleToolsCall(params: any, id: string | number, sessionId: string): Promise<MCPResponse> {
    const { name, arguments: args } = params;
    
    const result = await this.toolRegistry.call(name, args, {
      sessionId,
      configManager: this.configManager
    });

    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }

  private async handleResourcesList(id: string | number): Promise<MCPResponse> {
    return {
      jsonrpc: '2.0',
      id,
      result: { resources: [] }
    };
  }

  private async handlePromptsList(id: string | number): Promise<MCPResponse> {
    return {
      jsonrpc: '2.0',
      id,
      result: { prompts: [] }
    };
  }

  private setupCoreTools(): void {
    console.log('🔧 Setting up core tools...');
    
    // ツールレジストリは既にコンストラクタで初期化され、
    // 自動的にコアツールがセットアップされる
    const toolCount = this.toolRegistry.list().length;
    console.log(`📋 Registered ${toolCount} core tools`);
    
    for (const tool of this.toolRegistry.list()) {
      console.log(`   - ${tool.name}: ${tool.description}`);
    }
  }

  // Public API
  isStarted(): boolean {
    return this.isRunning;
  }

  getServerInfo(): ServerInfo {
    return this.serverInfo;
  }

  getConnectionCount(): number {
    return this.connectionManager.getActiveConnectionCount();
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }
}

// 後方互換性のため
export { MCPServerCore as MCPServer };