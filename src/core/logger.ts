/**
 * Logger utility following Google's logging best practices
 * Provides structured logging with context and performance tracking
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
  stack?: string;
  sessionId: string;
  component?: string;
}

export class Logger {
  private static instance: Logger;
  private readonly sessionId: string;
  private readonly logLevel: LogLevel;
  private readonly maxLogEntries = 1000;
  private readonly logEntries: LogEntry[] = [];

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.logLevel = this.getLogLevel();
    this.setupGlobalErrorHandling();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private generateSessionId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLogLevel(): LogLevel {
    // In Chrome extension environment, default to INFO level for performance
    return LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private addLogEntry(entry: LogEntry): void {
    this.logEntries.push(entry);
    
    // Keep only the most recent entries
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries.shift();
    }

    // Store in chrome storage for debugging
    this.persistLogs();
  }

  private async persistLogs(): Promise<void> {
    try {
      const recentLogs = this.logEntries.slice(-100); // Keep last 100 entries
      await chrome.storage.local.set({ 
        debugLogs: recentLogs 
      });
    } catch (error) {
      console.error('Failed to persist logs:', error);
    }
  }

  private setupGlobalErrorHandling(): void {
    window.addEventListener('error', (event) => {
      this.error('Global error caught', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', {
        reason: event.reason,
        promise: event.promise
      });
    });
  }

  debug(message: string, context?: Record<string, unknown>, component?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: LogLevel.DEBUG,
      message,
      sessionId: this.sessionId,
      ...(context !== undefined ? { context } : {}),
      ...(component !== undefined ? { component } : {})
    };

    this.addLogEntry(entry);
    console.debug(`[DEBUG] ${component ? `[${component}] ` : ''}${message}`, context);
  }

  info(message: string, context?: Record<string, unknown>, component?: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: LogLevel.INFO,
      message,
      sessionId: this.sessionId,
      ...(context !== undefined ? { context } : {}),
      ...(component !== undefined ? { component } : {})
    };

    this.addLogEntry(entry);
    console.info(`[INFO] ${component ? `[${component}] ` : ''}${message}`, context);
  }

  warn(message: string, context?: Record<string, unknown>, component?: string): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: LogLevel.WARN,
      message,
      sessionId: this.sessionId,
      ...(context !== undefined ? { context } : {}),
      ...(component !== undefined ? { component } : {})
    };

    this.addLogEntry(entry);
    console.warn(`[WARN] ${component ? `[${component}] ` : ''}${message}`, context);
  }

  error(message: string, context?: Record<string, unknown>, component?: string, error?: Error): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: LogLevel.ERROR,
      message,
      sessionId: this.sessionId,
      ...(context !== undefined ? { context } : {}),
      ...(component !== undefined ? { component } : {}),
      ...(error !== undefined ? { error } : {}),
      ...(error?.stack !== undefined ? { stack: error.stack } : {})
    };

    this.addLogEntry(entry);
    console.error(`[ERROR] ${component ? `[${component}] ` : ''}${message}`, context, error);
  }

  async getLogs(): Promise<LogEntry[]> {
    return [...this.logEntries];
  }

  async exportLogs(): Promise<string> {
    const logs = await this.getLogs();
    return JSON.stringify({
      sessionId: this.sessionId,
      exportTime: new Date().toISOString(),
      logs
    }, null, 2);
  }

  async clearLogs(): Promise<void> {
    this.logEntries.length = 0;
    await chrome.storage.local.remove(['debugLogs']);
  }

  /**
   * Performance timing helper
   */
  time(label: string, component?: string): () => void {
    const startTime = performance.now();
    this.debug(`Timer started: ${label}`, undefined, component);
    
    return () => {
      const duration = performance.now() - startTime;
      this.info(`Timer ended: ${label}`, { duration: `${duration.toFixed(2)}ms` }, component);
    };
  }

  /**
   * Async operation wrapper with automatic logging
   */
  async wrapAsync<T>(
    operation: () => Promise<T>,
    operationName: string,
    component?: string
  ): Promise<T> {
    const endTimer = this.time(operationName, component);
    
    try {
      this.debug(`Starting operation: ${operationName}`, undefined, component);
      const result = await operation();
      this.info(`Operation completed: ${operationName}`, undefined, component);
      return result;
    } catch (error) {
      this.error(`Operation failed: ${operationName}`, undefined, component, error as Error);
      throw error;
    } finally {
      endTimer();
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();