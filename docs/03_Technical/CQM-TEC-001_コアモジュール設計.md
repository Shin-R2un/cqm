---
document_id: CQM-TEC-001
version: v0.1-draft
created: 2025-08-02
updated: 2025-08-02
author: Claude Code
reviewer: 
status: draft
tags: #CQM/Project #CQM/Technical #CQM/Core
related_docs:
  - CQM-ARC-001
  - CQM-REQ-001
---

# CQM-TEC-001 コアモジュール設計

## 1. 概要

CQMシステムの中核となるコンポーネントの詳細設計。MCPサーバー、プラグインローダー、設定管理システム、イベントシステムの技術仕様を定義する。

### 1.1 設計目標
- **MCPプロトコル完全準拠**: 標準MCPプロトコルでの複数AIモデル対応
- **プラグイン拡張性**: 動的なプラグイン読み込みとライフサイクル管理
- **設定の柔軟性**: YAML/環境変数/暗号化シークレットの統一管理
- **堅牢なエラー処理**: 段階的フォールバックと詳細ログ
- **イベント駆動**: プラグイン間の疎結合通信

### 1.2 前提条件
- [CQM-ARC-001 システムアーキテクチャ](../02_Architecture/CQM-ARC-001_システムアーキテクチャ.md) の設計に準拠
- Node.js 20.x LTS, TypeScript 5.3+ 使用
- Ollama embeddingモデル対応

## 2. MCPサーバー設計

### 2.1 MCPサーバーコア

#### A. アーキテクチャ概要
```typescript
/**
 * CQM MCPサーバーのコアクラス
 * 複数AIモデルからの同時接続とツール提供を管理
 */
class MCPServerCore {
  private connectionManager: ConnectionManager;
  private requestRouter: RequestRouter;
  private toolRegistry: ToolRegistry;
  private pluginLoader: PluginLoader;
  private config: ServerConfig;
  private logger: ILogger;
  private eventBus: EventBus;

  constructor(config: ServerConfig) {
    this.config = config;
    this.logger = createLogger(config.logging);
    this.eventBus = new EventBus(this.logger);
    this.connectionManager = new ConnectionManager(this.eventBus, this.logger);
    this.requestRouter = new RequestRouter(this.eventBus, this.logger);
    this.toolRegistry = new ToolRegistry(this.eventBus, this.logger);
    this.pluginLoader = new PluginLoader(this.eventBus, this.logger);
  }

  /**
   * サーバー起動
   */
  async start(): Promise<void> {
    try {
      this.logger.info('CQM MCP Server starting...');
      
      // 1. プラグインシステム初期化
      await this.pluginLoader.initialize();
      
      // 2. コアプラグインの読み込み
      await this.loadCorePlugins();
      
      // 3. MCPサーバー開始
      await this.startMCPServer();
      
      // 4. ヘルスチェック開始
      await this.startHealthCheck();
      
      this.logger.info('CQM MCP Server started successfully', {
        port: this.config.transport.port,
        maxConnections: this.config.maxConnections,
        loadedPlugins: this.pluginLoader.getLoadedPlugins().length
      });
      
      await this.eventBus.publish({
        type: SystemEventType.SERVER_STARTED,
        timestamp: new Date(),
        data: { version: this.config.version }
      });
      
    } catch (error) {
      this.logger.error('Failed to start CQM MCP Server', error);
      throw error;
    }
  }

  /**
   * サーバー停止
   */
  async stop(): Promise<void> {
    this.logger.info('CQM MCP Server stopping...');
    
    // 1. 新規接続拒否
    await this.connectionManager.rejectNewConnections();
    
    // 2. 既存接続の優雅な切断
    await this.connectionManager.disconnectAll();
    
    // 3. プラグイン停止
    await this.pluginLoader.stopAll();
    
    // 4. システムリソース解放
    await this.cleanup();
    
    this.logger.info('CQM MCP Server stopped');
  }

  /**
   * MCP接続処理
   */
  async handleConnection(transport: MCPTransport): Promise<void> {
    const connectionId = await this.connectionManager.addConnection(transport);
    
    this.logger.info('New MCP client connected', { connectionId });
    
    // イベント通知
    await this.eventBus.publish({
      type: SystemEventType.CLIENT_CONNECTED,
      timestamp: new Date(),
      data: { connectionId, clientInfo: transport.clientInfo }
    });
  }

  private async loadCorePlugins(): Promise<void> {
    const corePlugins = [
      '@cqm/plugin-filesystem',
      '@cqm/plugin-github',
      '@cqm/plugin-obsidian'
    ];
    
    for (const pluginName of corePlugins) {
      if (this.config.plugins[pluginName]?.enabled) {
        await this.pluginLoader.loadPlugin(pluginName);
      }
    }
  }

  private async startMCPServer(): Promise<void> {
    // MCPプロトコル実装の詳細
    // TransportLayerの選択 (stdio, websocket, http)
    // Tool Registration
    // Request/Response handling
  }
}
```

#### B. サーバー設定
```typescript
interface ServerConfig {
  version: string;
  name: string;
  
  transport: {
    type: 'stdio' | 'websocket' | 'http';
    port?: number;
    host?: string;
    ssl?: SSLConfig;
  };
  
  connection: {
    maxConnections: number;
    timeout: number;
    heartbeatInterval: number;
    keepAlive: boolean;
  };
  
  logging: LogConfig;
  plugins: Record<string, PluginConfig>;
  security: SecurityConfig;
}

interface SSLConfig {
  enabled: boolean;
  cert?: string;
  key?: string;
  ca?: string;
}

interface SecurityConfig {
  authentication: {
    enabled: boolean;
    method: 'token' | 'certificate' | 'none';
    tokenSecret?: string;
  };
  
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  
  cors: {
    enabled: boolean;
    origins: string[];
  };
}
```

### 2.2 接続管理システム

#### A. ConnectionManager
```typescript
class ConnectionManager {
  private connections: Map<string, MCPConnection> = new Map();
  private heartbeat: HeartbeatManager;
  private eventBus: EventBus;
  private logger: ILogger;
  private isAcceptingConnections = true;

  constructor(eventBus: EventBus, logger: ILogger) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.heartbeat = new HeartbeatManager(this.eventBus, this.logger);
  }

  /**
   * 新規接続追加
   */
  async addConnection(transport: MCPTransport): Promise<string> {
    if (!this.isAcceptingConnections) {
      throw new Error('Server is shutting down, not accepting new connections');
    }

    const connectionId = generateConnectionId();
    const connection: MCPConnection = {
      id: connectionId,
      transport,
      clientInfo: transport.clientInfo,
      connectedAt: new Date(),
      lastActivity: new Date(),
      capabilities: await this.negotiateCapabilities(transport),
      status: 'connected'
    };

    this.connections.set(connectionId, connection);
    this.heartbeat.startMonitoring(connectionId);

    this.logger.info('Connection added', {
      connectionId,
      clientType: connection.clientInfo.name,
      totalConnections: this.connections.size
    });

    return connectionId;
  }

  /**
   * 接続削除
   */
  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.heartbeat.stopMonitoring(connectionId);
    
    try {
      await connection.transport.close();
    } catch (error) {
      this.logger.warn('Error closing transport', { connectionId, error });
    }

    this.connections.delete(connectionId);

    this.logger.info('Connection removed', {
      connectionId,
      totalConnections: this.connections.size
    });

    await this.eventBus.publish({
      type: SystemEventType.CLIENT_DISCONNECTED,
      timestamp: new Date(),
      data: { connectionId }
    });
  }

  /**
   * 全接続に対するイベント配信
   */
  async broadcastEvent(event: SystemEvent): Promise<void> {
    const promises = Array.from(this.connections.values()).map(async (connection) => {
      try {
        await connection.transport.sendNotification('system/event', event);
      } catch (error) {
        this.logger.warn('Failed to broadcast event to connection', {
          connectionId: connection.id,
          eventType: event.type,
          error
        });
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * 接続統計情報
   */
  getConnectionStats(): ConnectionStats {
    const connections = Array.from(this.connections.values());
    
    return {
      total: connections.length,
      byClientType: this.groupBy(connections, c => c.clientInfo.name),
      byStatus: this.groupBy(connections, c => c.status),
      averageUptime: this.calculateAverageUptime(connections),
      oldestConnection: this.findOldestConnection(connections)
    };
  }

  private async negotiateCapabilities(transport: MCPTransport): Promise<ClientCapabilities> {
    // MCP capability negotiation
    const clientCapabilities = await transport.getCapabilities();
    
    return {
      maxContextWindow: clientCapabilities.maxContextWindow || 100000,
      supportsStreaming: clientCapabilities.supportsStreaming || false,
      supportedTools: clientCapabilities.supportedTools || [],
      preferredChunkSize: clientCapabilities.preferredChunkSize || 2000
    };
  }
}

interface MCPConnection {
  id: string;
  transport: MCPTransport;
  clientInfo: ClientInfo;
  connectedAt: Date;
  lastActivity: Date;
  capabilities: ClientCapabilities;
  status: 'connected' | 'disconnecting' | 'error';
}

interface ClientInfo {
  name: string;
  version: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

interface ClientCapabilities {
  maxContextWindow: number;
  supportsStreaming: boolean;
  supportedTools: string[];
  preferredChunkSize: number;
}
```

### 2.3 リクエストルーティング

#### A. RequestRouter
```typescript
class RequestRouter {
  private toolHandlers: Map<string, ToolHandler> = new Map();
  private middleware: Middleware[] = [];
  private eventBus: EventBus;
  private logger: ILogger;

  constructor(eventBus: EventBus, logger: ILogger) {
    this.eventBus = eventBus;
    this.logger = logger;
  }

  /**
   * MCPリクエストのルーティング
   */
  async routeRequest(request: MCPRequest, connectionId: string): Promise<MCPResponse> {
    const startTime = Date.now();
    
    try {
      // 1. リクエスト前処理（ミドルウェア）
      const processedRequest = await this.applyMiddleware(request, connectionId);
      
      // 2. ツールハンドラーの特定
      const handler = this.toolHandlers.get(processedRequest.method);
      if (!handler) {
        throw new MCPError(
          MCPErrorCode.METHOD_NOT_FOUND,
          `Tool '${processedRequest.method}' not found`
        );
      }

      // 3. パラメータ検証
      await this.validateParameters(processedRequest, handler);

      // 4. 認可チェック
      await this.authorizeRequest(processedRequest, connectionId);

      // 5. ツール実行
      const result = await handler.execute(processedRequest.params, {
        connectionId,
        clientInfo: await this.getClientInfo(connectionId)
      });

      // 6. レスポンス作成
      const response: MCPResponse = {
        jsonrpc: '2.0',
        id: request.id,
        result
      };

      // 7. 実行ログ
      const duration = Date.now() - startTime;
      this.logger.info('Request processed successfully', {
        method: request.method,
        connectionId,
        duration,
        resultSize: JSON.stringify(result).length
      });

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Request processing failed', {
        method: request.method,
        connectionId,
        duration,
        error: error.message
      });

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: error.code || MCPErrorCode.INTERNAL_ERROR,
          message: error.message,
          data: error.data
        }
      };
    }
  }

  /**
   * ツールハンドラー登録
   */
  async registerTool(tool: MCPTool, handler: ToolHandler): Promise<void> {
    // 重複チェック
    if (this.toolHandlers.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }

    // スキーマ検証
    await this.validateToolSchema(tool);

    this.toolHandlers.set(tool.name, handler);

    this.logger.info('Tool registered', {
      toolName: tool.name,
      description: tool.description
    });

    // イベント通知
    await this.eventBus.publish({
      type: SystemEventType.TOOL_REGISTERED,
      timestamp: new Date(),
      data: { toolName: tool.name, tool }
    });
  }

  private async applyMiddleware(request: MCPRequest, connectionId: string): Promise<MCPRequest> {
    let processedRequest = request;

    for (const middleware of this.middleware) {
      processedRequest = await middleware.process(processedRequest, connectionId);
    }

    return processedRequest;
  }

  private async validateParameters(request: MCPRequest, handler: ToolHandler): Promise<void> {
    const schema = handler.getParameterSchema();
    const validation = schema.safeParse(request.params);
    
    if (!validation.success) {
      throw new MCPError(
        MCPErrorCode.INVALID_PARAMS,
        'Parameter validation failed',
        validation.error.errors
      );
    }
  }
}

interface ToolHandler {
  execute(params: any, context: ExecutionContext): Promise<any>;
  getParameterSchema(): ZodSchema;
  getDescription(): string;
}

interface ExecutionContext {
  connectionId: string;
  clientInfo: ClientInfo;
  timestamp?: Date;
}
```

## 3. プラグインローダー設計

### 3.1 プラグインシステム アーキテクチャ

#### A. PluginLoader
```typescript
class PluginLoader {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private dependencies: DependencyGraph;
  private lifecycle: PluginLifecycleManager;
  private sandboxes: Map<string, PluginSandbox> = new Map();
  private eventBus: EventBus;
  private logger: ILogger;

  constructor(eventBus: EventBus, logger: ILogger) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.dependencies = new DependencyGraph();
    this.lifecycle = new PluginLifecycleManager(eventBus, logger);
  }

  /**
   * プラグイン読み込み
   */
  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      // 1. プラグインメタデータ読み込み
      const manifest = await this.loadPluginManifest(pluginPath);
      
      // 2. 依存関係チェック
      await this.validateDependencies(manifest);
      
      // 3. サンドボックス環境作成
      const sandbox = await this.createSandbox(manifest);
      
      // 4. プラグイン初期化
      const plugin = await this.initializePlugin(pluginPath, sandbox);
      
      // 5. ライフサイクル管理開始
      await this.lifecycle.register(manifest.name, plugin);
      
      // 6. 依存関係グラフに追加
      this.dependencies.addNode(manifest.name, manifest.dependencies);
      
      // 7. 読み込み完了記録
      this.plugins.set(manifest.name, {
        manifest,
        plugin,
        sandbox,
        loadedAt: new Date(),
        status: 'loaded'
      });

      this.logger.info('Plugin loaded successfully', {
        pluginName: manifest.name,
        version: manifest.version,
        dependencies: manifest.dependencies.length
      });

      await this.eventBus.publish({
        type: SystemEventType.PLUGIN_LOADED,
        timestamp: new Date(),
        data: { pluginName: manifest.name, manifest }
      });

    } catch (error) {
      this.logger.error('Failed to load plugin', {
        pluginPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * プラグイン有効化
   */
  async enablePlugin(pluginName: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginName);
    if (!loadedPlugin) {
      throw new Error(`Plugin '${pluginName}' not found`);
    }

    if (loadedPlugin.status === 'enabled') {
      return; // 既に有効化済み
    }

    try {
      // 1. 依存関係の有効化
      await this.enableDependencies(pluginName);
      
      // 2. プラグイン開始
      await loadedPlugin.plugin.start();
      
      // 3. ツール登録
      await this.registerPluginTools(loadedPlugin);
      
      // 4. イベントリスナー登録
      await this.registerEventListeners(loadedPlugin);
      
      loadedPlugin.status = 'enabled';
      loadedPlugin.enabledAt = new Date();

      this.logger.info('Plugin enabled', { pluginName });

    } catch (error) {
      loadedPlugin.status = 'error';
      this.logger.error('Failed to enable plugin', {
        pluginName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * プラグイン無効化
   */
  async disablePlugin(pluginName: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginName);
    if (!loadedPlugin || loadedPlugin.status !== 'enabled') {
      return;
    }

    try {
      // 1. イベントリスナー解除
      await this.unregisterEventListeners(loadedPlugin);
      
      // 2. ツール登録解除
      await this.unregisterPluginTools(loadedPlugin);
      
      // 3. プラグイン停止
      await loadedPlugin.plugin.stop();
      
      loadedPlugin.status = 'loaded';
      loadedPlugin.disabledAt = new Date();

      this.logger.info('Plugin disabled', { pluginName });

    } catch (error) {
      this.logger.error('Failed to disable plugin', {
        pluginName,
        error: error.message
      });
    }
  }

  private async createSandbox(manifest: PluginManifest): Promise<PluginSandbox> {
    return new PluginSandbox({
      name: manifest.name,
      permissions: manifest.permissions,
      isolationLevel: manifest.security?.isolationLevel || 'standard'
    });
  }

  private async initializePlugin(pluginPath: string, sandbox: PluginSandbox): Promise<IPlugin> {
    // 動的インポートとサンドボックス内実行
    const module = await sandbox.importModule(pluginPath);
    const PluginClass = module.default || module[Object.keys(module)[0]];
    
    if (!PluginClass || typeof PluginClass !== 'function') {
      throw new Error('Plugin must export a default class');
    }

    const context: PluginContext = {
      logger: this.logger.child({ plugin: path.basename(pluginPath) }),
      eventBus: this.eventBus,
      sandbox
    };

    const plugin = new PluginClass();
    await plugin.initialize(context);
    
    return plugin;
  }
}

interface LoadedPlugin {
  manifest: PluginManifest;
  plugin: IPlugin;
  sandbox: PluginSandbox;
  loadedAt: Date;
  enabledAt?: Date;
  disabledAt?: Date;
  status: 'loaded' | 'enabled' | 'disabled' | 'error';
}

interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  
  main: string;
  dependencies: string[];
  peerDependencies?: string[];
  
  permissions: PluginPermission[];
  security?: PluginSecurityConfig;
  
  mcpTools?: MCPToolDefinition[];
  eventHandlers?: EventHandlerDefinition[];
}
```

### 3.2 プラグインインターフェース

#### A. IPlugin基底インターフェース
```typescript
interface IPlugin {
  metadata: PluginMetadata;
  
  // ライフサイクル
  initialize(context: PluginContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  shutdown(): Promise<void>;
  
  // 機能提供
  getTools(): MCPTool[];
  getEventHandlers(): EventHandler[];
  
  // 設定管理
  getConfigSchema(): JSONSchema;
  validateConfig(config: any): ValidationResult;
  updateConfig(config: any): Promise<void>;
  
  // ヘルスチェック
  healthCheck(): Promise<HealthStatus>;
}

interface PluginContext {
  logger: ILogger;
  eventBus: EventBus;
  sandbox: PluginSandbox;
  config?: any;
}

interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  capabilities: PluginCapability[];
}

enum PluginCapability {
  FILE_SYSTEM_ACCESS = 'filesystem',
  NETWORK_ACCESS = 'network',
  SYSTEM_COMMANDS = 'system',
  DATABASE_ACCESS = 'database',
  EXTERNAL_API = 'external-api'
}
```

## 4. 設定管理システム

### 4.1 統合設定管理

#### A. ConfigManager
```typescript
class ConfigManager {
  private config: ReloadableConfig;
  private watchers: ConfigWatcher[] = [];
  private validators: Map<string, ConfigValidator> = new Map();
  private encryptor: ConfigEncryptor;
  private eventBus: EventBus;
  private logger: ILogger;

  constructor(eventBus: EventBus, logger: ILogger) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.encryptor = new ConfigEncryptor();
  }

  /**
   * 設定読み込み（優先度順）
   */
  async loadConfig(): Promise<CQMConfig> {
    const configSources: ConfigSource[] = [
      new EnvironmentVariableSource(),
      new FileSource('.env.local'),
      new FileSource('cqm.yml'),
      new FileSource(path.join(os.homedir(), '.cqm/config.yml')),
      new FileSource('/etc/cqm/config.yml'),
      new DefaultConfigSource()
    ];

    let mergedConfig = {};

    // 優先度の低い順から読み込み、マージ
    for (const source of configSources.reverse()) {
      try {
        const config = await source.load();
        mergedConfig = deepMerge(mergedConfig, config);
      } catch (error) {
        if (source.required) {
          throw error;
        }
        this.logger.debug('Optional config source not found', {
          source: source.name
        });
      }
    }

    // 設定検証
    const validationResult = await this.validateConfig(mergedConfig);
    if (!validationResult.valid) {
      throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`);
    }

    // 暗号化された値の復号化
    const decryptedConfig = await this.decryptSecrets(mergedConfig as CQMConfig);

    this.config = new ReloadableConfig(decryptedConfig);
    
    this.logger.info('Configuration loaded successfully', {
      sources: configSources.filter(s => s.loaded).length,
      plugins: Object.keys(decryptedConfig.plugins || {}).length
    });

    return decryptedConfig;
  }

  /**
   * 設定値取得
   */
  get<T>(path: string, defaultValue?: T): T {
    return this.config.get(path, defaultValue);
  }

  /**
   * 設定値更新
   */
  async set(path: string, value: any): Promise<void> {
    // 1. 値の検証
    await this.validateConfigPath(path, value);
    
    // 2. 更新実行
    this.config.set(path, value);
    
    // 3. 永続化
    await this.persistConfig();
    
    // 4. 変更通知
    await this.notifyConfigChange(path, value);
    
    this.logger.info('Configuration updated', { path });
  }

  /**
   * 秘密情報の暗号化保存
   */
  async setSecret(key: string, value: string): Promise<void> {
    const encryptedValue = await this.encryptor.encrypt(value);
    await this.set(`secrets.${key}`, encryptedValue);
  }

  /**
   * 設定ファイル監視開始
   */
  async startWatching(): Promise<void> {
    const configFiles = [
      'cqm.yml',
      '.env.local',
      path.join(os.homedir(), '.cqm/config.yml')
    ];

    for (const file of configFiles) {
      if (await fs.pathExists(file)) {
        const watcher = new ConfigWatcher(file, async () => {
          try {
            await this.reloadConfig();
          } catch (error) {
            this.logger.error('Failed to reload configuration', {
              file,
              error: error.message
            });
          }
        });
        
        await watcher.start();
        this.watchers.push(watcher);
      }
    }
  }

  private async validateConfig(config: any): Promise<ValidationResult> {
    const schema = getCQMConfigSchema();
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    
    const valid = validate(config);
    
    return {
      valid,
      errors: validate.errors?.map(error => 
        `${error.instancePath}: ${error.message}`
      ) || []
    };
  }

  private async decryptSecrets(config: CQMConfig): Promise<CQMConfig> {
    if (!config.secrets) return config;

    const decryptedSecrets: Record<string, string> = {};
    
    for (const [key, encryptedValue] of Object.entries(config.secrets)) {
      try {
        decryptedSecrets[key] = await this.encryptor.decrypt(encryptedValue);
      } catch (error) {
        this.logger.warn('Failed to decrypt secret', { key });
        decryptedSecrets[key] = encryptedValue; // フォールバック
      }
    }

    return {
      ...config,
      secrets: decryptedSecrets
    };
  }
}

interface CQMConfig {
  version: string;
  server: ServerConfig;
  plugins: Record<string, PluginConfig>;
  logging: LogConfig;
  rag: RAGConfig;
  secrets?: Record<string, string>;
}

interface RAGConfig {
  vectorDB: {
    type: 'qdrant';
    config: QdrantConfig;
  };
  embedding: {
    type: 'ollama';
    config: OllamaConfig;
  };
}

interface OllamaConfig {
  host: string;
  model: string;
  timeout: number;
  retries: number;
}
```

## 5. イベントシステム設計

### 5.1 EventBus アーキテクチャ

#### A. EventBus実装
```typescript
class EventBus {
  private subscribers: Map<string, EventSubscription[]> = new Map();
  private eventHistory: CircularBuffer<SystemEvent>;
  private middleware: EventMiddleware[] = [];
  private logger: ILogger;

  constructor(logger: ILogger, historySize = 1000) {
    this.logger = logger;
    this.eventHistory = new CircularBuffer(historySize);
  }

  /**
   * イベント発行
   */
  async publish(event: SystemEvent): Promise<void> {
    const publishId = generateId();
    const startTime = Date.now();

    try {
      // 1. イベント履歴に記録
      this.eventHistory.push(event);

      // 2. ミドルウェア適用
      const processedEvent = await this.applyMiddleware(event);

      // 3. 購読者への配信
      const subscribers = this.subscribers.get(event.type) || [];
      
      const promises = subscribers.map(async (subscription) => {
        try {
          await subscription.handler(processedEvent);
          
          this.logger.debug('Event delivered', {
            publishId,
            eventType: event.type,
            subscriberId: subscription.id
          });
          
        } catch (error) {
          this.logger.error('Event handler failed', {
            publishId,
            eventType: event.type,
            subscriberId: subscription.id,
            error: error.message
          });
          
          // エラーハンドラが設定されている場合は実行
          if (subscription.errorHandler) {
            try {
              await subscription.errorHandler(error, processedEvent);
            } catch (errorHandlerError) {
              this.logger.error('Error handler failed', {
                subscriberId: subscription.id,
                error: errorHandlerError.message
              });
            }
          }
        }
      });

      await Promise.allSettled(promises);

      const duration = Date.now() - startTime;
      this.logger.info('Event published', {
        publishId,
        eventType: event.type,
        subscribers: subscribers.length,
        duration
      });

    } catch (error) {
      this.logger.error('Failed to publish event', {
        publishId,
        eventType: event.type,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * イベント購読
   */
  subscribe(
    eventType: string, 
    handler: EventHandler,
    options: SubscriptionOptions = {}
  ): string {
    const subscriptionId = generateId();
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler,
      errorHandler: options.errorHandler,
      filter: options.filter,
      priority: options.priority || 0,
      createdAt: new Date()
    };

    // 優先度順でソート
    const subscribers = this.subscribers.get(eventType) || [];
    subscribers.push(subscription);
    subscribers.sort((a, b) => b.priority - a.priority);
    
    this.subscribers.set(eventType, subscribers);

    this.logger.debug('Event subscription added', {
      subscriptionId,
      eventType,
      priority: subscription.priority
    });

    return subscriptionId;
  }

  /**
   * 購読解除
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [eventType, subscribers] of this.subscribers.entries()) {
      const index = subscribers.findIndex(sub => sub.id === subscriptionId);
      if (index >= 0) {
        subscribers.splice(index, 1);
        
        if (subscribers.length === 0) {
          this.subscribers.delete(eventType);
        }
        
        this.logger.debug('Event subscription removed', {
          subscriptionId,
          eventType
        });
        
        return true;
      }
    }
    
    return false;
  }

  /**
   * イベント履歴取得
   */
  getEventHistory(filter?: EventFilter): SystemEvent[] {
    let events = this.eventHistory.toArray();

    if (filter) {
      events = events.filter(event => {
        if (filter.type && event.type !== filter.type) return false;
        if (filter.since && event.timestamp < filter.since) return false;
        if (filter.until && event.timestamp > filter.until) return false;
        return true;
      });
    }

    return events;
  }

  private async applyMiddleware(event: SystemEvent): Promise<SystemEvent> {
    let processedEvent = event;

    for (const middleware of this.middleware) {
      processedEvent = await middleware.process(processedEvent);
    }

    return processedEvent;
  }
}

interface SystemEvent {
  type: string;
  timestamp: Date;
  data: any;
  source?: string;
  metadata?: Record<string, any>;
}

interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  errorHandler?: EventErrorHandler;
  filter?: EventPredicate;
  priority: number;
  createdAt: Date;
}

type EventHandler = (event: SystemEvent) => Promise<void>;
type EventErrorHandler = (error: Error, event: SystemEvent) => Promise<void>;
type EventPredicate = (event: SystemEvent) => boolean;
```

## 6. エラー処理とログ管理

### 6.1 エラーハンドリング戦略

#### A. 階層的エラー処理
```typescript
enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}

class ErrorHandler {
  private eventBus: EventBus;
  private logger: ILogger;
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();

  constructor(eventBus: EventBus, logger: ILogger) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.initializeRecoveryStrategies();
  }

  async handleError(error: Error, context: ErrorContext): Promise<void> {
    const severity = this.determineSeverity(error, context);
    const errorId = generateErrorId();

    // エラーログ
    this.logger.log(severity, 'Error occurred', {
      errorId,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date()
    });

    // 重要度に応じた処理
    switch (severity) {
      case ErrorSeverity.INFO:
        // 情報レベル：ログのみ
        break;

      case ErrorSeverity.WARNING:
        // 警告レベル：ログ + メトリクス
        await this.recordMetrics(error, context);
        break;

      case ErrorSeverity.ERROR:
        // エラーレベル：ログ + 復旧試行
        await this.recordMetrics(error, context);
        await this.attemptRecovery(error, context);
        break;

      case ErrorSeverity.FATAL:
        // 致命的レベル：ログ + 緊急停止
        await this.recordMetrics(error, context);
        await this.gracefulShutdown(error, context);
        break;
    }

    // エラーイベント発行
    await this.eventBus.publish({
      type: SystemEventType.ERROR_OCCURRED,
      timestamp: new Date(),
      data: {
        errorId,
        severity,
        message: error.message,
        context
      }
    });
  }

  private determineSeverity(error: Error, context: ErrorContext): ErrorSeverity {
    // エラータイプベースの判定
    if (error instanceof ConnectionError && context.component === 'mcp-server') {
      return ErrorSeverity.ERROR;
    }
    
    if (error instanceof PluginError && error.isRecoverable) {
      return ErrorSeverity.WARNING;
    }
    
    if (error instanceof SystemError) {
      return ErrorSeverity.FATAL;
    }

    // デフォルト判定
    return ErrorSeverity.ERROR;
  }

  private async attemptRecovery(error: Error, context: ErrorContext): Promise<void> {
    const strategy = this.recoveryStrategies.get(error.constructor.name);
    
    if (strategy) {
      try {
        await strategy.recover(error, context);
        this.logger.info('Error recovery successful', {
          errorType: error.constructor.name,
          strategy: strategy.name
        });
      } catch (recoveryError) {
        this.logger.error('Error recovery failed', {
          originalError: error.message,
          recoveryError: recoveryError.message
        });
      }
    }
  }
}

interface ErrorContext {
  component: string;
  operation: string;
  connectionId?: string;
  pluginName?: string;
  metadata?: Record<string, any>;
}

interface RecoveryStrategy {
  name: string;
  recover(error: Error, context: ErrorContext): Promise<void>;
}
```

### 6.2 構造化ログシステム

#### A. Logger実装
```typescript
class StructuredLogger implements ILogger {
  private transports: LogTransport[] = [];
  private config: LogConfig;
  private context: LogContext;

  constructor(config: LogConfig, context: LogContext = {}) {
    this.config = config;
    this.context = context;
    this.initializeTransports();
  }

  info(message: string, metadata?: any): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: any): void {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error | any, metadata?: any): void {
    const errorMetadata = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error;

    this.log('error', message, {
      ...metadata,
      error: errorMetadata
    });
  }

  debug(message: string, metadata?: any): void {
    if (this.config.level === 'debug') {
      this.log('debug', message, metadata);
    }
  }

  private log(level: LogLevel, message: string, metadata?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      ...this.context,
      ...metadata,
      pid: process.pid,
      hostname: os.hostname()
    };

    // すべてのトランスポートに送信
    for (const transport of this.transports) {
      if (this.shouldLog(level, transport.minLevel)) {
        transport.write(logEntry);
      }
    }
  }

  child(context: LogContext): ILogger {
    return new StructuredLogger(this.config, {
      ...this.context,
      ...context
    });
  }

  private initializeTransports(): void {
    // コンソール出力
    if (this.config.console?.enabled) {
      this.transports.push(new ConsoleTransport(this.config.console));
    }

    // ファイル出力
    if (this.config.file?.enabled) {
      this.transports.push(new FileTransport(this.config.file));
    }

    // 外部ログシステム連携
    if (this.config.external?.enabled) {
      this.transports.push(new ExternalTransport(this.config.external));
    }
  }
}

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  pid: number;
  hostname: string;
  [key: string]: any;
}

interface LogConfig {
  level: LogLevel;
  format: 'json' | 'text';
  
  console?: {
    enabled: boolean;
    colors: boolean;
  };
  
  file?: {
    enabled: boolean;
    path: string;
    maxSize: string;
    maxFiles: number;
    rotation: 'daily' | 'size';
  };
  
  external?: {
    enabled: boolean;
    type: 'elasticsearch' | 'splunk' | 'datadog';
    config: Record<string, any>;
  };
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, any>;
```

## 7. 統合テスト戦略

### 7.1 テスト設計

#### A. テスト構成
```typescript
describe('CQM Core Module Integration', () => {
  let mcpServer: MCPServerCore;
  let configManager: ConfigManager;
  let pluginLoader: PluginLoader;
  let testConfig: CQMConfig;

  beforeAll(async () => {
    // テスト用設定準備
    testConfig = createTestConfig();
    
    // コンポーネント初期化
    configManager = new ConfigManager(new EventBus(), createTestLogger());
    await configManager.loadConfig(testConfig);
    
    pluginLoader = new PluginLoader(new EventBus(), createTestLogger());
    mcpServer = new MCPServerCore(testConfig.server);
  });

  describe('Server Lifecycle', () => {
    test('should start and stop gracefully', async () => {
      await expect(mcpServer.start()).resolves.toBeUndefined();
      await expect(mcpServer.stop()).resolves.toBeUndefined();
    });

    test('should handle multiple concurrent connections', async () => {
      await mcpServer.start();
      
      const connections = await Promise.all([
        createMockMCPConnection('cursor'),
        createMockMCPConnection('claude'),
        createMockMCPConnection('generic')
      ]);

      expect(connections).toHaveLength(3);
      
      await mcpServer.stop();
    });
  });

  describe('Plugin System', () => {
    test('should load and enable filesystem plugin', async () => {
      await pluginLoader.loadPlugin('@cqm/plugin-filesystem');
      await pluginLoader.enablePlugin('@cqm/plugin-filesystem');
      
      const plugins = pluginLoader.getLoadedPlugins();
      expect(plugins).toContainEqual(
        expect.objectContaining({ name: '@cqm/plugin-filesystem' })
      );
    });
  });

  describe('Error Handling', () => {
    test('should recover from plugin failures', async () => {
      // プラグインエラーシミュレーション
      const mockPlugin = createMockPlugin({ shouldFail: true });
      await pluginLoader.loadPlugin(mockPlugin);
      
      // エラー発生
      await expect(pluginLoader.enablePlugin(mockPlugin.name)).rejects.toThrow();
      
      // システムは継続動作
      expect(mcpServer.isRunning()).toBe(true);
    });
  });
});
```

## 8. 変更履歴

| バージョン | 日付 | 変更内容 | 作成者 |
|-----------|------|----------|--------|
| v0.1-draft | 2025-08-02 | 初版作成、基本設計完了 | Claude Code |

---

*"Connecting All Models on the Same Frequency - CQM Core Team"*