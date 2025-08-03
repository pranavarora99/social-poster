// Performance optimization utilities
export class PerformanceUtils {
  /**
   * Debounce function calls to prevent excessive execution
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: number;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => func.apply(null, args), delay);
    };
  }
  
  /**
   * Throttle function calls to limit execution frequency
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastExecution = 0;
    
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastExecution >= delay) {
        lastExecution = now;
        func.apply(null, args);
      }
    };
  }
  
  /**
   * Execute task during browser idle time
   */
  static runOnIdle<T>(
    task: () => T | Promise<T>,
    options: { timeout?: number } = {}
  ): Promise<T> {
    const { timeout = 5000 } = options;
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Task timeout exceeded'));
      }, timeout);
      
      if ('requestIdleCallback' in window) {
        requestIdleCallback(
          async () => {
            try {
              clearTimeout(timeoutId);
              const result = await task();
              resolve(result);
            } catch (error) {
              reject(error);
            }
          },
          { timeout: timeout / 2 }
        );
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(async () => {
          try {
            clearTimeout(timeoutId);
            const result = await task();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, 0);
      }
    });
  }
  
  /**
   * Process array in chunks to avoid blocking the main thread
   */
  static async processInChunks<T, R>(
    array: T[],
    processor: (item: T, index: number) => R | Promise<R>,
    chunkSize: number = 50,
    delay: number = 0
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < array.length; i += chunkSize) {
      const chunk = array.slice(i, i + chunkSize);
      
      // Process chunk
      const chunkResults = await Promise.all(
        chunk.map((item, index) => processor(item, i + index))
      );
      
      results.push(...chunkResults);
      
      // Yield control to browser if there are more chunks
      if (i + chunkSize < array.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return results;
  }
  
  /**
   * Memoize function results with LRU cache
   */
  static memoize<T extends (...args: any[]) => any>(
    func: T,
    cacheSize: number = 100
  ): T {
    const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();
    
    return ((...args: Parameters<T>): ReturnType<T> => {
      const key = JSON.stringify(args);
      const cached = cache.get(key);
      
      if (cached) {
        // Move to end (LRU)
        cache.delete(key);
        cache.set(key, cached);
        return cached.value;
      }
      
      const result = func.apply(null, args);
      
      // Remove oldest entry if cache is full
      if (cache.size >= cacheSize) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
          cache.delete(firstKey);
        }
      }
      
      cache.set(key, { value: result, timestamp: Date.now() });
      return result;
    }) as T;
  }
  
  /**
   * Measure and log performance metrics
   */
  static measurePerformance<T>(
    name: string,
    task: () => T | Promise<T>
  ): Promise<{ result: T; duration: number; memory?: number }> {
    return new Promise(async (resolve, reject) => {
      const startTime = performance.now();
      const startMemory = (performance as any).memory?.usedJSHeapSize;
      
      try {
        const result = await task();
        const endTime = performance.now();
        const endMemory = (performance as any).memory?.usedJSHeapSize;
        
        const duration = endTime - startTime;
        const memoryDelta = startMemory && endMemory ? endMemory - startMemory : undefined;
        
        console.log(`Performance [${name}]: ${duration.toFixed(2)}ms`, {
          memoryDelta: memoryDelta ? `${(memoryDelta / 1024 / 1024).toFixed(2)}MB` : 'N/A'
        });
        
        resolve({
          result,
          duration,
          ...(memoryDelta !== undefined ? { memory: memoryDelta } : {})
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Create a performance observer for monitoring
   */
  static createPerformanceObserver(
    entryTypes: string[],
    callback: (entries: PerformanceEntry[]) => void
  ): PerformanceObserver | null {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      
      observer.observe({ entryTypes });
      return observer;
    }
    
    return null;
  }
}

// Intersection Observer for lazy loading
export class LazyLoader {
  private observer: IntersectionObserver;
  private elements: Map<Element, () => void> = new Map();
  
  constructor(options: IntersectionObserverInit = {}) {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const callback = this.elements.get(entry.target);
          if (callback) {
            callback();
            this.unobserve(entry.target);
          }
        }
      });
    }, {
      rootMargin: '50px',
      threshold: 0.1,
      ...options
    });
  }
  
  observe(element: Element, callback: () => void): void {
    this.elements.set(element, callback);
    this.observer.observe(element);
  }
  
  unobserve(element: Element): void {
    this.elements.delete(element);
    this.observer.unobserve(element);
  }
  
  disconnect(): void {
    this.observer.disconnect();
    this.elements.clear();
  }
}

// Web Worker manager for CPU-intensive tasks
export class WorkerManager {
  private workers: Map<string, Worker> = new Map();
  
  createWorker(name: string, script: string): Worker {
    if (this.workers.has(name)) {
      this.workers.get(name)!.terminate();
    }
    
    const blob = new Blob([script], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    
    this.workers.set(name, worker);
    return worker;
  }
  
  terminateWorker(name: string): void {
    const worker = this.workers.get(name);
    if (worker) {
      worker.terminate();
      this.workers.delete(name);
    }
  }
  
  terminateAll(): void {
    this.workers.forEach(worker => worker.terminate());
    this.workers.clear();
  }
  
  async runTask<T>(
    name: string,
    script: string,
    data: any,
    timeout: number = 10000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = this.createWorker(name, script);
      
      const timeoutId = setTimeout(() => {
        this.terminateWorker(name);
        reject(new Error('Worker task timeout'));
      }, timeout);
      
      worker.onmessage = (event) => {
        clearTimeout(timeoutId);
        this.terminateWorker(name);
        resolve(event.data);
      };
      
      worker.onerror = (error) => {
        clearTimeout(timeoutId);
        this.terminateWorker(name);
        reject(error);
      };
      
      worker.postMessage(data);
    });
  }
}