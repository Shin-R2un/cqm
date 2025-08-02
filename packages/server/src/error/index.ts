/**
 * エラーハンドリング
 * CQM-MCP-001設計に基づく階層的エラー処理システム
 */
import { MCPResponse, MCPError, CQMError, ERROR_CODES } from '@cqm/shared';

export interface ErrorContext {
  sessionId: string;
  method?: string;
  requestId?: string | number;
  timestamp?: Date;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorLog {
  id: string;
  error: Error;
  context: ErrorContext;
  severity: ErrorSeverity;
  timestamp: Date;
  handled: boolean;
}

export class ErrorHandler {
  private errorLog: ErrorLog[] = [];
  private readonly maxLogSize = 1000;

  handleError(error: unknown, context: ErrorContext): MCPResponse {
    const normalizedError = this.normalizeError(error);
    const severity = this.classifyError(normalizedError);
    
    // エラーログに記録
    this.logError(normalizedError, context, severity);
    
    // 重要度に応じたアラート処理
    if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
      this.sendAlert(normalizedError, context, severity);
    }

    // MCPエラーレスポンス生成
    return this.createMCPErrorResponse(normalizedError, context);
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    
    if (typeof error === 'string') {
      return new Error(error);
    }
    
    if (typeof error === 'object' && error !== null) {
      return new Error(JSON.stringify(error));
    }
    
    return new Error('Unknown error occurred');
  }

  private classifyError(error: Error): ErrorSeverity {
    // CQMErrorの場合、コードに基づいて分類
    if (error instanceof CQMError) {
      switch (error.code) {
        case 'CONFIG_ERROR':
        case 'PLUGIN_ERROR':
          return ErrorSeverity.HIGH;
        case 'RAG_ERROR':
          return ErrorSeverity.MEDIUM;
        case 'CONNECTION_LIMIT':
          return ErrorSeverity.MEDIUM;
        default:
          return ErrorSeverity.LOW;
      }
    }

    // 一般的なエラーの分類
    const message = error.message.toLowerCase();
    
    if (message.includes('cannot find module') || message.includes('no such file')) {
      return ErrorSeverity.HIGH;
    }
    
    if (message.includes('timeout') || message.includes('network')) {
      return ErrorSeverity.MEDIUM;
    }
    
    if (message.includes('permission denied') || message.includes('access denied')) {
      return ErrorSeverity.HIGH;
    }
    
    if (message.includes('out of memory') || message.includes('maximum call stack')) {
      return ErrorSeverity.CRITICAL;
    }
    
    return ErrorSeverity.LOW;
  }

  private logError(error: Error, context: ErrorContext, severity: ErrorSeverity): void {
    const logEntry: ErrorLog = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      error,
      context: {
        ...context,
        timestamp: context.timestamp || new Date()
      },
      severity,
      timestamp: new Date(),
      handled: true
    };

    this.errorLog.push(logEntry);

    // ログサイズ制限
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // コンソールログ
    this.logToConsole(logEntry);
  }

  private logToConsole(logEntry: ErrorLog): void {
    const { error, context, severity } = logEntry;
    
    const prefix = this.getSeverityPrefix(severity);
    const sessionInfo = context.sessionId === 'stdio' ? 'STDIO' : `WS:${context.sessionId.slice(-8)}`;
    
    console.error(
      `${prefix} [${sessionInfo}] ${context.method || 'unknown'}: ${error.message}`
    );
    
    if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
      console.error('Stack:', error.stack);
    }
  }

  private getSeverityPrefix(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.LOW:
        return '⚠️ ';
      case ErrorSeverity.MEDIUM:
        return '🔴';
      case ErrorSeverity.HIGH:
        return '💥';
      case ErrorSeverity.CRITICAL:
        return '🚨';
      default:
        return '❓';
    }
  }

  private sendAlert(error: Error, context: ErrorContext, severity: ErrorSeverity): void {
    // 本格的な実装では、Discord/Slack/Email等への通知
    console.warn(`🚨 ALERT [${severity.toUpperCase()}]: ${error.message}`);
    console.warn(`Session: ${context.sessionId}, Method: ${context.method}`);
  }

  private createMCPErrorResponse(error: Error, context: ErrorContext): MCPResponse {
    let mcpError: MCPError;

    if (error instanceof CQMError) {
      mcpError = {
        code: this.mapCQMErrorToMCP(error),
        message: this.sanitizeErrorMessage(error.message),
        data: {
          type: error.code,
          severity: this.classifyError(error),
          timestamp: new Date().toISOString(),
          requestId: context.requestId
        }
      };
    } else {
      mcpError = {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: this.sanitizeErrorMessage(error.message),
        data: {
          type: 'INTERNAL_ERROR',
          severity: this.classifyError(error),
          timestamp: new Date().toISOString(),
          requestId: context.requestId
        }
      };
    }

    return {
      jsonrpc: '2.0',
      id: context.requestId || null,
      error: mcpError
    };
  }

  private mapCQMErrorToMCP(error: CQMError): number {
    switch (error.code) {
      case 'INVALID_REQUEST':
        return ERROR_CODES.INVALID_REQUEST;
      case 'METHOD_NOT_FOUND':
        return ERROR_CODES.METHOD_NOT_FOUND;
      case 'INVALID_PARAMS':
        return ERROR_CODES.INVALID_PARAMS;
      case 'PLUGIN_ERROR':
        return ERROR_CODES.PLUGIN_ERROR;
      case 'RAG_ERROR':
        return ERROR_CODES.RAG_ERROR;
      case 'CONFIG_ERROR':
        return ERROR_CODES.CONFIG_ERROR;
      case 'CONNECTION_LIMIT':
        return ERROR_CODES.CONNECTION_LIMIT;
      default:
        return ERROR_CODES.INTERNAL_ERROR;
    }
  }

  private sanitizeErrorMessage(message: string): string {
    // センシティブ情報の除去
    return message
      .replace(/\/[a-zA-Z0-9\/_-]+\/[a-zA-Z0-9\/_.-]+/g, '[PATH]') // ファイルパス
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]') // メールアドレス
      .replace(/(?:password|token|key|secret)[:=]\s*\S+/gi, '[CREDENTIALS]'); // 認証情報
  }

  // Public API
  getRecentErrors(limit = 50): ErrorLog[] {
    return this.errorLog.slice(-limit);
  }

  getErrorStats(): {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    recentCount: number;
  } {
    const now = new Date();
    const recentThreshold = now.getTime() - 300000; // 5分前
    
    const bySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
      acc[severity] = 0;
      return acc;
    }, {} as Record<ErrorSeverity, number>);
    
    let recentCount = 0;
    
    for (const log of this.errorLog) {
      bySeverity[log.severity]++;
      
      if (log.timestamp.getTime() > recentThreshold) {
        recentCount++;
      }
    }
    
    return {
      total: this.errorLog.length,
      bySeverity,
      recentCount
    };
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }
}