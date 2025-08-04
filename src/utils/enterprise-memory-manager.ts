/**
 * Enterprise Memory Management System
 * Implements Google's memory optimization patterns for Chrome Extensions
 */

interface MemoryPool<T> {
  available: T[];
  inUse: Set<T>;
  factory: () => T;
  reset: (item: T) => void;
  maxSize: number;
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
  size: number;
  ttl?: number;
}

interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  cacheSize: number;
  poolsSize: number;
  lastCleanup: number;
}

interface WeakReferences {
  domElements: WeakMap<Element, any>;
  eventListeners: WeakMap<EventTarget, any>;
  observers: WeakMap<Observer, any>;
  timers: Set<number>;
}

type Observer = IntersectionObserver | MutationObserver | PerformanceObserver | ResizeObserver;

export class EnterpriseMemoryManager {
  private static instance: EnterpriseMemoryManager;
  
  // Memory pools for object reuse
  private readonly objectPools = new Map<string, MemoryPool<any>>();
  
  // Intelligent cache with LRU eviction
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly cacheAccessOrder = new Map<string, number>();
  
  // Weak references for automatic cleanup
  private readonly weakRefs: WeakReferences = {
    domElements: new WeakMap(),
    eventListeners: new WeakMap(),
    observers: new WeakMap(),
    timers: new Set()
  };
  
  // Memory monitoring
  private memoryUsageHistory: number[] = [];
  private readonly maxHistorySize = 100;
  private cleanupInterval: number | null = null;
  
  // Configuration
  private readonly config = {
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    maxCacheEntries: 1000,
    cleanupInterval: 30000, // 30 seconds
    memoryPressureThreshold: 0.85, // 85% of available memory
    maxPoolSize: 100
  };

  private constructor() {
    this.initializeMemoryMonitoring();
    this.setupEventListeners();
  }

  static getInstance(): EnterpriseMemoryManager {
    if (!this.instance) {
      this.instance = new EnterpriseMemoryManager();
    }
    return this.instance;
  }

  /**
   * Create or get an object pool for reusable objects
   */
  createObjectPool<T>(
    name: string,
    factory: () => T,
    reset: (item: T) => void,
    maxSize: number = this.config.maxPoolSize
  ): void {
    if (this.objectPools.has(name)) {
      console.warn(`[MemoryManager] Object pool '${name}' already exists`);
      return;
    }

    const pool: MemoryPool<T> = {
      available: [],
      inUse: new Set(),
      factory,
      reset,
      maxSize
    };

    this.objectPools.set(name, pool);
    console.log(`[MemoryManager] Created object pool '${name}' with max size ${maxSize}`);
  }

  /**
   * Get an object from the pool
   */
  acquire<T>(poolName: string): T | null {
    const pool = this.objectPools.get(poolName) as MemoryPool<T>;
    if (!pool) {
      console.error(`[MemoryManager] Object pool '${poolName}' not found`);
      return null;
    }

    let item: T;
    
    if (pool.available.length > 0) {
      item = pool.available.pop()!;
    } else {
      if (pool.inUse.size >= pool.maxSize) {
        console.warn(`[MemoryManager] Pool '${poolName}' is at capacity`);
        return null;
      }
      item = pool.factory();
    }

    pool.inUse.add(item);
    return item;
  }

  /**
   * Return an object to the pool
   */
  release<T>(poolName: string, item: T): void {
    const pool = this.objectPools.get(poolName) as MemoryPool<T>;
    if (!pool) {
      console.error(`[MemoryManager] Object pool '${poolName}' not found`);
      return;
    }

    if (!pool.inUse.has(item)) {
      console.warn(`[MemoryManager] Item not found in pool '${poolName}'`);
      return;
    }

    pool.inUse.delete(item);
    pool.reset(item);
    
    if (pool.available.length < pool.maxSize) {
      pool.available.push(item);
    }
  }

  /**
   * Intelligent cache with size limits and TTL
   */
  cacheSet<T>(key: string, value: T, ttl?: number): void {
    const size = this.estimateObjectSize(value);
    
    // Check if adding this item would exceed cache limits
    if (this.shouldEvictBeforeInsert(size)) {
      this.evictLRUEntries(size);
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      accessCount: 1,
      size,
      ttl
    };

    this.cache.set(key, entry);
    this.cacheAccessOrder.set(key, Date.now());
    
    console.log(`[MemoryManager] Cached '${key}' (${size} bytes, TTL: ${ttl || 'none'})`);
  }

  /**
   * Get from cache with access tracking
   */
  cacheGet<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T>;
    if (!entry) return null;

    // Check TTL expiration
    if (entry.ttl && (Date.now() - entry.timestamp) > entry.ttl) {
      this.cache.delete(key);
      this.cacheAccessOrder.delete(key);
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    this.cacheAccessOrder.set(key, Date.now());
    
    return entry.value;
  }

  /**
   * Remove from cache
   */
  cacheDelete(key: string): void {
    this.cache.delete(key);
    this.cacheAccessOrder.delete(key);
  }

  /**
   * Register DOM element for automatic cleanup
   */
  trackDOMElement(element: Element, data?: any): void {
    this.weakRefs.domElements.set(element, data || {
      registered: Date.now(),
      type: element.tagName.toLowerCase()
    });
  }

  /**
   * Register event listener for cleanup tracking
   */
  trackEventListener(target: EventTarget, type: string, listener: EventListener): void {
    const listeners = this.weakRefs.eventListeners.get(target) || new Map();
    listeners.set(type, listener);
    this.weakRefs.eventListeners.set(target, listeners);
  }

  /**
   * Register observer for cleanup
   */
  trackObserver(observer: Observer): void {
    this.weakRefs.observers.set(observer, {
      created: Date.now(),
      type: observer.constructor.name
    });
  }

  /**
   * Register timer for cleanup
   */
  trackTimer(timerId: number): void {
    this.weakRefs.timers.add(timerId);
  }

  /**
   * Clean up a specific timer
   */
  clearTimer(timerId: number): void {
    clearTimeout(timerId);
    clearInterval(timerId);
    this.weakRefs.timers.delete(timerId);
  }

  /**
   * Force memory cleanup and garbage collection hint
   */
  async forceCleanup(): Promise<void> {
    console.log('[MemoryManager] Starting forced cleanup...');
    
    const startTime = performance.now();
    
    // Clean expired cache entries
    this.cleanExpiredCacheEntries();
    
    // Clean up timers
    this.cleanupTimers();
    
    // Clean up observers
    this.cleanupObservers();
    
    // Evict cache if over limits
    this.evictCacheIfNeeded();
    
    // Clear object pools if memory pressure is high
    if (this.isMemoryPressureHigh()) {
      this.clearObjectPools();
    }
    
    // Hint for garbage collection (if available)
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
    
    const endTime = performance.now();
    console.log(`[MemoryManager] Cleanup completed in ${(endTime - startTime).toFixed(2)}ms`);
    
    // Update metrics
    this.updateMemoryMetrics();
  }

  /**
   * Get current memory usage metrics
   */
  getMemoryMetrics(): MemoryMetrics {
    const memory = (performance as any).memory || {};
    
    const cacheSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
    
    const poolsSize = Array.from(this.objectPools.values())
      .reduce((total, pool) => total + pool.available.length + pool.inUse.size, 0);

    return {
      heapUsed: memory.usedJSHeapSize || 0,
      heapTotal: memory.totalJSHeapSize || 0,
      external: memory.externalMemorySize || 0,
      cacheSize,
      poolsSize,
      lastCleanup: this.cleanupInterval ? Date.now() : 0
    };
  }

  /**
   * Initialize memory monitoring
   */
  private initializeMemoryMonitoring(): void {
    // Start periodic cleanup
    this.cleanupInterval = window.setInterval(() => {
      this.forceCleanup();
    }, this.config.cleanupInterval);

    // Monitor memory usage
    if ('memory' in performance) {
      const monitorMemory = () => {
        const memory = (performance as any).memory;
        const usage = memory.usedJSHeapSize / memory.totalJSHeapSize;
        
        this.memoryUsageHistory.push(usage);
        if (this.memoryUsageHistory.length > this.maxHistorySize) {
          this.memoryUsageHistory.shift();
        }

        // Trigger aggressive cleanup if memory pressure is high
        if (usage > this.config.memoryPressureThreshold) {
          console.warn(`[MemoryManager] High memory pressure detected: ${(usage * 100).toFixed(1)}%`);
          this.forceCleanup();
        }
      };

      // Monitor every 10 seconds
      setInterval(monitorMemory, 10000);
      monitorMemory(); // Initial check
    }
  }

  /**
   * Setup event listeners for automatic cleanup
   */
  private setupEventListeners(): void {
    // Clean up when page is unloading
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Clean up on visibility change (when tab becomes hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.forceCleanup();
      }
    });

    // Memory pressure event (Chrome-specific)
    if ('memory' in navigator) {
      (navigator as any).memory?.addEventListener?.('pressure', () => {
        console.warn('[MemoryManager] Memory pressure event received');
        this.forceCleanup();
      });
    }
  }

  /**
   * Estimate object size in bytes
   */
  private estimateObjectSize(obj: any): number {
    if (obj === null || obj === undefined) return 0;
    
    const type = typeof obj;
    
    switch (type) {
      case 'boolean':
        return 1;
      case 'number':
        return 8;
      case 'string':
        return obj.length * 2; // UTF-16
      case 'object':
        if (Array.isArray(obj)) {
          return obj.reduce((total, item) => total + this.estimateObjectSize(item), 0);
        }
        
        let size = 0;
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            size += key.length * 2; // Key size
            size += this.estimateObjectSize(obj[key]); // Value size
          }
        }
        return size;
      default:
        return 50; // Rough estimate for functions, symbols, etc.
    }
  }

  /**
   * Check if cache eviction is needed before insert
   */
  private shouldEvictBeforeInsert(newEntrySize: number): boolean {
    const currentCacheSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
    
    return (
      this.cache.size >= this.config.maxCacheEntries ||
      (currentCacheSize + newEntrySize) > this.config.maxCacheSize
    );
  }

  /**
   * Evict LRU cache entries
   */
  private evictLRUEntries(requiredSpace: number): void {
    const sortedEntries = Array.from(this.cacheAccessOrder.entries())
      .sort((a, b) => a[1] - b[1]); // Sort by access time (oldest first)

    let freedSpace = 0;
    let evictedCount = 0;

    for (const [key] of sortedEntries) {
      const entry = this.cache.get(key);
      if (entry) {
        freedSpace += entry.size;
        this.cache.delete(key);
        this.cacheAccessOrder.delete(key);
        evictedCount++;

        if (freedSpace >= requiredSpace) break;
      }
    }

    console.log(`[MemoryManager] Evicted ${evictedCount} cache entries, freed ${freedSpace} bytes`);
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredCacheEntries(): void {
    const now = Date.now();
    let expiredCount = 0;
    let freedSpace = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && (now - entry.timestamp) > entry.ttl) {
        freedSpace += entry.size;
        this.cache.delete(key);
        this.cacheAccessOrder.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`[MemoryManager] Cleaned ${expiredCount} expired cache entries, freed ${freedSpace} bytes`);
    }
  }

  /**
   * Clean up tracked timers
   */
  private cleanupTimers(): void {
    let clearedCount = 0;
    
    for (const timerId of this.weakRefs.timers) {
      clearTimeout(timerId);
      clearInterval(timerId);
      clearedCount++;
    }
    
    this.weakRefs.timers.clear();
    
    if (clearedCount > 0) {
      console.log(`[MemoryManager] Cleared ${clearedCount} timers`);
    }
  }

  /**
   * Clean up tracked observers
   */
  private cleanupObservers(): void {
    let disconnectedCount = 0;
    
    // Note: We can't directly iterate WeakMap, but observers should auto-cleanup
    // This is mainly for logging and forced disconnection if needed
    console.log(`[MemoryManager] Observer cleanup completed`);
  }

  /**
   * Clear object pools under memory pressure
   */
  private clearObjectPools(): void {
    let clearedItems = 0;
    
    for (const [name, pool] of this.objectPools.entries()) {
      clearedItems += pool.available.length;
      pool.available.length = 0; // Clear available items
      console.log(`[MemoryManager] Cleared pool '${name}'`);
    }
    
    if (clearedItems > 0) {
      console.log(`[MemoryManager] Cleared ${clearedItems} pooled objects`);
    }
  }

  /**
   * Check if memory pressure is high
   */
  private isMemoryPressureHigh(): boolean {
    if (this.memoryUsageHistory.length === 0) return false;
    
    const recentUsage = this.memoryUsageHistory.slice(-5);
    const avgUsage = recentUsage.reduce((sum, usage) => sum + usage, 0) / recentUsage.length;
    
    return avgUsage > this.config.memoryPressureThreshold;
  }

  /**
   * Evict cache if it exceeds limits
   */
  private evictCacheIfNeeded(): void {
    const currentSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
    
    if (currentSize > this.config.maxCacheSize || this.cache.size > this.config.maxCacheEntries) {
      const excessSize = Math.max(0, currentSize - this.config.maxCacheSize * 0.8); // Target 80% of max
      this.evictLRUEntries(excessSize);
    }
  }

  /**
   * Update memory metrics
   */
  private updateMemoryMetrics(): void {
    const metrics = this.getMemoryMetrics();
    
    // Store metrics for debugging
    (window as any).__memoryMetrics = metrics;
    
    console.log('[MemoryManager] Memory Metrics:', {
      heapUsed: `${(metrics.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(metrics.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      cacheSize: `${(metrics.cacheSize / 1024).toFixed(2)}KB`,
      poolsSize: metrics.poolsSize
    });
  }

  /**
   * Complete cleanup on shutdown
   */
  private cleanup(): void {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all caches
    this.cache.clear();
    this.cacheAccessOrder.clear();

    // Clear all pools
    this.objectPools.clear();

    // Clear timers
    this.cleanupTimers();

    console.log('[MemoryManager] Complete cleanup performed');
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): any {
    return {
      cacheEntries: this.cache.size,
      objectPools: this.objectPools.size,
      memoryHistory: this.memoryUsageHistory.slice(),
      trackedTimers: this.weakRefs.timers.size,
      metrics: this.getMemoryMetrics()
    };
  }
}

// Export singleton instance
export const memoryManager = EnterpriseMemoryManager.getInstance();

// Initialize common object pools
memoryManager.createObjectPool(
  'contentExtraction',
  () => ({ title: '', description: '', keyPoints: [], images: [] }),
  (obj) => {
    obj.title = '';
    obj.description = '';
    obj.keyPoints.length = 0;
    obj.images.length = 0;
  }
);

memoryManager.createObjectPool(
  'analysisResults',
  () => ({ score: 0, factors: [], metrics: {} }),
  (obj) => {
    obj.score = 0;
    obj.factors.length = 0;
    obj.metrics = {};
  }
);

// Make memory manager available globally for debugging
(window as any).__memoryManager = memoryManager;