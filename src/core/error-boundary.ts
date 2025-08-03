/**
 * Error boundary and error handling utilities
 * Provides comprehensive error handling following Google's reliability patterns
 */

import { logger } from './logger';
import { stateManager } from './state-manager';

export interface ErrorInfo {
  message: string;
  stack?: string;
  component?: string;
  context?: Record<string, unknown>;
  timestamp: number;
  userAgent: string;
  url: string;
  recoverable: boolean;
}

export class ErrorBoundary {
  private static instance: ErrorBoundary;
  private readonly maxRetries = 3;
  private readonly retryDelays = [1000, 2000, 5000]; // Progressive delays
  private retryCount = new Map<string, number>();

  private constructor() {
    this.setupGlobalHandlers();
  }

  static getInstance(): ErrorBoundary {
    if (!ErrorBoundary.instance) {
      ErrorBoundary.instance = new ErrorBoundary();
    }
    return ErrorBoundary.instance;
  }

  private setupGlobalHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'UnhandledPromiseRejection', false);
      event.preventDefault(); // Prevent the default browser behavior
    });

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      const errorInfo: ErrorInfo = {
        message: event.message,
        stack: event.error?.stack,
        component: 'Global',
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        },
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        recoverable: false
      };

      this.handleError(event.error || new Error(event.message), 'JavaScriptError', false, errorInfo);
    });
  }

  /**
   * Handle errors with context and recovery options
   */
  handleError(
    error: Error | unknown,
    component: string = 'Unknown',
    recoverable: boolean = true,
    additionalInfo?: Partial<ErrorInfo>
  ): void {
    const errorInfo: ErrorInfo = {
      message: error instanceof Error ? error.message : String(error),
      component,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      recoverable,
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
      ...additionalInfo
    };

    // Log the error
    logger.error(`Error in ${component}`, {
      errorInfo,
      error: error instanceof Error ? error : undefined
    }, component, error instanceof Error ? error : undefined);

    // Update UI state
    if (!recoverable) {
      stateManager.setError(`An error occurred in ${component}: ${errorInfo.message}`);
    } else {
      stateManager.setLoading(false);
    }

    // Send to analytics/monitoring if configured
    this.reportError(errorInfo);
  }

  /**
   * Wrap async functions with error handling
   */
  wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    component: string,
    recoverable: boolean = true
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, component, recoverable, {
          context: { functionName: fn.name, arguments: args }
        });
        throw error;
      }
    };
  }

  /**
   * Wrap sync functions with error handling
   */
  wrapSync<T extends any[], R>(
    fn: (...args: T) => R,
    component: string,
    recoverable: boolean = true
  ): (...args: T) => R | undefined {
    return (...args: T): R | undefined => {
      try {
        return fn(...args);
      } catch (error) {
        this.handleError(error, component, recoverable, {
          context: { functionName: fn.name, arguments: args }
        });
        return undefined;
      }
    };
  }

  /**
   * Retry mechanism for failed operations
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    operationKey: string,
    component: string = 'Unknown'
  ): Promise<T> {
    const currentRetries = this.retryCount.get(operationKey) || 0;

    try {
      const result = await operation();
      // Reset retry count on success
      this.retryCount.delete(operationKey);
      return result;
    } catch (error) {
      if (currentRetries < this.maxRetries) {
        const delay = this.retryDelays[currentRetries] || this.retryDelays[this.retryDelays.length - 1]!;
        this.retryCount.set(operationKey, currentRetries + 1);

        logger.warn(`Retrying operation ${operationKey}`, {
          attempt: currentRetries + 1,
          maxRetries: this.maxRetries,
          delay
        }, component);

        await this.delay(delay);
        return this.withRetry(operation, operationKey, component);
      } else {
        // Max retries exceeded
        this.retryCount.delete(operationKey);
        this.handleError(error, component, false, {
          context: { operationKey, retriesExhausted: true }
        });
        throw error;
      }
    }
  }

  /**
   * Circuit breaker pattern for external services
   */
  createCircuitBreaker<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    options: {
      failureThreshold: number;
      recoveryTime: number;
      component: string;
    }
  ): (...args: T) => Promise<R> {
    let failures = 0;
    let lastFailureTime = 0;
    let isOpen = false;

    return async (...args: T): Promise<R> => {
      // Check if circuit is open and if recovery time has passed
      if (isOpen) {
        if (Date.now() - lastFailureTime > options.recoveryTime) {
          isOpen = false;
          failures = 0;
          logger.info('Circuit breaker reset', { component: options.component });
        } else {
          throw new Error(`Circuit breaker is open for ${options.component}`);
        }
      }

      try {
        const result = await fn(...args);
        if (failures > 0) {
          failures = 0;
          logger.info('Circuit breaker reset after success', { component: options.component });
        }
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = Date.now();

        if (failures >= options.failureThreshold) {
          isOpen = true;
          logger.error('Circuit breaker opened', {
            component: options.component,
            failures,
            threshold: options.failureThreshold
          });
        }

        throw error;
      }
    };
  }

  /**
   * Safe DOM manipulation with error handling
   */
  safeDOM(operation: () => void, component: string = 'DOM'): void {
    try {
      operation();
    } catch (error) {
      this.handleError(error, component, true, {
        context: { operation: 'DOM manipulation' }
      });
    }
  }

  /**
   * Report error to external monitoring service
   */
  private async reportError(errorInfo: ErrorInfo): Promise<void> {
    try {
      // In a real implementation, this would send to your error reporting service
      // For now, we'll store it locally
      const existingErrors = await this.getStoredErrors();
      const updatedErrors = [errorInfo, ...existingErrors].slice(0, 100); // Keep last 100 errors
      
      await chrome.storage.local.set({ errorReports: updatedErrors });
    } catch (error) {
      logger.warn('Failed to report error', { originalError: errorInfo }, 'ErrorBoundary');
    }
  }

  /**
   * Get stored error reports
   */
  async getStoredErrors(): Promise<ErrorInfo[]> {
    try {
      const result = await chrome.storage.local.get(['errorReports']);
      return result.errorReports || [];
    } catch (error) {
      logger.warn('Failed to retrieve stored errors', undefined, 'ErrorBoundary');
      return [];
    }
  }

  /**
   * Clear stored error reports
   */
  async clearStoredErrors(): Promise<void> {
    try {
      await chrome.storage.local.remove(['errorReports']);
    } catch (error) {
      logger.warn('Failed to clear stored errors', undefined, 'ErrorBoundary');
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create error-safe element creation
   */
  createSafeElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    options?: {
      className?: string;
      textContent?: string;
      attributes?: Record<string, string>;
    }
  ): HTMLElementTagNameMap[K] | null {
    try {
      const element = document.createElement(tagName);
      
      if (options?.className) {
        element.className = options.className;
      }
      
      if (options?.textContent) {
        element.textContent = options.textContent;
      }
      
      if (options?.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
      }
      
      return element;
    } catch (error) {
      this.handleError(error, 'DOM', true);
      return null;
    }
  }
}

// Export singleton instance
export const errorBoundary = ErrorBoundary.getInstance();