// Telemetry and monitoring system
import type { Platform } from '../types/index';

export interface TelemetryEvent {
  eventType: string;
  timestamp: number;
  sessionId: string;
  userId?: string;
  platform?: Platform;
  duration?: number;
  success?: boolean;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  memoryUsage?: number;
  executionTime: number;
  networkLatency?: number;
  cacheHitRate?: number;
}

export class TelemetryService {
  private static instance: TelemetryService;
  private sessionId: string;
  private userId?: string;
  private events: TelemetryEvent[] = [];
  private performanceEntries: Map<string, number> = new Map();
  private isEnabled: boolean = true;
  private batchSize: number = 10;
  private flushInterval: number = 30000; // 30 seconds
  private flushTimer?: number;
  
  private constructor() {
    this.sessionId = this.generateSessionId();
    this.loadSettings();
    this.startAutoFlush();
  }
  
  static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['telemetry_enabled', 'user_id']);
      this.isEnabled = result.telemetry_enabled !== false; // Default to enabled
      this.userId = result.user_id;
    } catch (error) {
      console.warn('Failed to load telemetry settings:', error);
    }
  }
  
  async setUserId(userId: string): Promise<void> {
    this.userId = userId;
    await chrome.storage.local.set({ user_id: userId });
  }
  
  async setEnabled(enabled: boolean): Promise<void> {
    this.isEnabled = enabled;
    await chrome.storage.local.set({ telemetry_enabled: enabled });
    
    if (!enabled) {
      this.events = []; // Clear pending events
    }
  }
  
  // High-level event tracking
  trackGeneration(platform: Platform, success: boolean, duration: number, metadata?: Record<string, any>): void {
    this.track({
      eventType: 'content_generation',
      platform,
      success,
      duration,
      ...(metadata !== undefined ? { metadata } : {})
    });
  }
  
  trackImageGeneration(platform: Platform, success: boolean, duration: number, metadata?: Record<string, any>): void {
    this.track({
      eventType: 'image_generation',
      platform,
      success,
      duration,
      ...(metadata !== undefined ? { metadata } : {})
    });
  }
  
  trackError(errorType: string, errorMessage: string, context?: Record<string, any>): void {
    this.track({
      eventType: 'error',
      success: false,
      errorCode: errorType,
      errorMessage,
      ...(context !== undefined ? { metadata: context } : {})
    });
  }
  
  trackUserAction(action: string, metadata?: Record<string, any>): void {
    this.track({
      eventType: 'user_action',
      metadata: { action, ...metadata }
    });
  }
  
  trackPerformance(operation: string, metrics: PerformanceMetrics): void {
    this.track({
      eventType: 'performance',
      duration: metrics.executionTime,
      metadata: {
        operation,
        memoryUsage: metrics.memoryUsage,
        networkLatency: metrics.networkLatency,
        cacheHitRate: metrics.cacheHitRate
      }
    });
  }
  
  // Core tracking method
  private track(event: Partial<TelemetryEvent>): void {
    if (!this.isEnabled) return;
    
    const fullEvent: TelemetryEvent = {
      eventType: event.eventType || 'unknown',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      ...(this.userId ? { userId: this.userId } : {}),
      ...event
    };
    
    this.events.push(fullEvent);
    
    // Auto-flush if batch size reached
    if (this.events.length >= this.batchSize) {
      this.flush();
    }
  }
  
  // Performance timing helpers
  startTiming(operation: string): void {
    this.performanceEntries.set(operation, performance.now());
  }
  
  endTiming(operation: string, metadata?: Record<string, any>): number {
    const startTime = this.performanceEntries.get(operation);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operation}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.performanceEntries.delete(operation);
    
    this.trackPerformance(operation, {
      executionTime: duration,
      ...metadata
    });
    
    return duration;
  }
  
  // Batch processing and sending
  private async flush(): Promise<void> {
    if (this.events.length === 0) return;
    
    const eventsToSend = [...this.events];
    this.events = [];
    
    try {
      await this.sendEvents(eventsToSend);
    } catch (error) {
      console.error('Failed to send telemetry events:', error);
      // Re-queue events for retry (with limit to prevent memory leaks)
      if (this.events.length < 100) {
        this.events.unshift(...eventsToSend);
      }
    }
  }
  
  private async sendEvents(events: TelemetryEvent[]): Promise<void> {
    // In a real implementation, this would send to your analytics service
    // For now, we'll store locally and optionally send to a webhook
    
    const result = await chrome.storage.local.get(['analytics_endpoint', 'telemetry_data']);
    const endpoint = result.analytics_endpoint;
    const existingData = result.telemetry_data || [];
    
    // Store locally
    const updatedData = [...existingData, ...events].slice(-1000); // Keep last 1000 events
    await chrome.storage.local.set({ telemetry_data: updatedData });
    
    // Send to remote endpoint if configured
    if (endpoint) {
      try {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'SocialPoster/1.2.0'
          },
          body: JSON.stringify({
            events,
            version: '1.2.0',
            timestamp: Date.now()
          })
        });
      } catch (error) {
        console.warn('Failed to send events to remote endpoint:', error);
      }
    }
  }
  
  private startAutoFlush(): void {
    this.flushTimer = window.setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }
  
  async getStoredEvents(): Promise<TelemetryEvent[]> {
    const result = await chrome.storage.local.get(['telemetry_data']);
    return result.telemetry_data || [];
  }
  
  async clearStoredEvents(): Promise<void> {
    await chrome.storage.local.remove(['telemetry_data']);
  }
  
  async exportData(): Promise<string> {
    const events = await this.getStoredEvents();
    return JSON.stringify({
      sessionId: this.sessionId,
      userId: this.userId,
      exportedAt: new Date().toISOString(),
      events
    }, null, 2);
  }
  
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

// Error handling with automatic telemetry
export class ErrorHandler {
  private telemetry: TelemetryService;
  
  constructor() {
    this.telemetry = TelemetryService.getInstance();
    this.setupGlobalErrorHandling();
  }
  
  private setupGlobalErrorHandling(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'unhandled_promise_rejection', {
        promise: event.promise
      });
    });
    
    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, 'javascript_error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: event.message
      });
    });
  }
  
  handleError(error: any, type: string = 'unknown', context?: Record<string, any>): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[${type}]:`, error);
    
    this.telemetry.trackError(type, errorMessage, {
      stack,
      ...context
    });
  }
  
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: Record<string, any>
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, 'async_function_error', {
          functionName: fn.name,
          arguments: args,
          ...context
        });
        throw error;
      }
    }) as T;
  }
  
  wrapSync<T extends (...args: any[]) => any>(
    fn: T,
    context?: Record<string, any>
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handleError(error, 'sync_function_error', {
          functionName: fn.name,
          arguments: args,
          ...context
        });
        throw error;
      }
    }) as T;
  }
}

// Initialize global error handler
export const errorHandler = new ErrorHandler();
export const telemetry = TelemetryService.getInstance();