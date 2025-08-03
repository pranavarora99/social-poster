// Memory management utilities for Chrome extension
export class MemoryManager {
  private static objectUrls: Set<string> = new Set();
  private static canvasElements: Set<HTMLCanvasElement> = new Set();
  private static intervals: Set<number> = new Set();
  private static timeouts: Set<number> = new Set();
  
  /**
   * Create and track an object URL for cleanup
   */
  static createObjectURL(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.objectUrls.add(url);
    return url;
  }
  
  /**
   * Revoke a specific object URL
   */
  static revokeObjectURL(url: string): void {
    if (this.objectUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(url);
    }
  }
  
  /**
   * Create and track a canvas element
   */
  static createCanvas(width?: number, height?: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    if (width) canvas.width = width;
    if (height) canvas.height = height;
    this.canvasElements.add(canvas);
    return canvas;
  }
  
  /**
   * Clean up a canvas element
   */
  static destroyCanvas(canvas: HTMLCanvasElement): void {
    if (this.canvasElements.has(canvas)) {
      // Clear the canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      // Remove from DOM if attached
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      
      // Set dimensions to 0 to free memory
      canvas.width = 0;
      canvas.height = 0;
      
      this.canvasElements.delete(canvas);
    }
  }
  
  /**
   * Track intervals for cleanup
   */
  static setInterval(callback: () => void, delay: number): number {
    const id = window.setInterval(callback, delay);
    this.intervals.add(id);
    return id;
  }
  
  /**
   * Track timeouts for cleanup
   */
  static setTimeout(callback: () => void, delay: number): number {
    const id = window.setTimeout(() => {
      this.timeouts.delete(id);
      callback();
    }, delay);
    this.timeouts.add(id);
    return id;
  }
  
  /**
   * Clear a specific interval
   */
  static clearInterval(id: number): void {
    if (this.intervals.has(id)) {
      window.clearInterval(id);
      this.intervals.delete(id);
    }
  }
  
  /**
   * Clear a specific timeout
   */
  static clearTimeout(id: number): void {
    if (this.timeouts.has(id)) {
      window.clearTimeout(id);
      this.timeouts.delete(id);
    }
  }
  
  /**
   * Clean up all tracked resources
   */
  static cleanup(): void {
    // Revoke all object URLs
    this.objectUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.objectUrls.clear();
    
    // Destroy all canvas elements
    this.canvasElements.forEach(canvas => {
      this.destroyCanvas(canvas);
    });
    
    // Clear all intervals
    this.intervals.forEach(id => {
      window.clearInterval(id);
    });
    this.intervals.clear();
    
    // Clear all timeouts
    this.timeouts.forEach(id => {
      window.clearTimeout(id);
    });
    this.timeouts.clear();
  }
  
  /**
   * Get memory usage statistics
   */
  static getStats(): {
    objectUrls: number;
    canvasElements: number;
    intervals: number;
    timeouts: number;
  } {
    return {
      objectUrls: this.objectUrls.size,
      canvasElements: this.canvasElements.size,
      intervals: this.intervals.size,
      timeouts: this.timeouts.size
    };
  }
}

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    MemoryManager.cleanup();
  });
}

// ResourcePool for reusing expensive objects
export class ResourcePool<T> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private readonly maxSize: number;
  
  constructor(
    private factory: () => T,
    private destroyer: (item: T) => void,
    maxSize: number = 10
  ) {
    this.maxSize = maxSize;
  }
  
  acquire(): T {
    let item = this.available.pop();
    
    if (!item) {
      item = this.factory();
    }
    
    this.inUse.add(item);
    return item;
  }
  
  release(item: T): void {
    if (this.inUse.has(item)) {
      this.inUse.delete(item);
      
      if (this.available.length < this.maxSize) {
        this.available.push(item);
      } else {
        this.destroyer(item);
      }
    }
  }
  
  cleanup(): void {
    this.available.forEach(item => this.destroyer(item));
    this.available = [];
    this.inUse.forEach(item => this.destroyer(item));
    this.inUse.clear();
  }
}

// Canvas pool for image operations
export const canvasPool = new ResourcePool<HTMLCanvasElement>(
  () => MemoryManager.createCanvas(),
  (canvas) => MemoryManager.destroyCanvas(canvas),
  5
);