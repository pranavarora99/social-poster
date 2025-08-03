// HTML sanitization utilities for security
export class Sanitizer {
  /**
   * Escape HTML characters to prevent XSS attacks
   */
  static escapeHtml(unsafe: string): string {
    if (!unsafe) return '';
    
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Sanitize text for safe insertion into DOM
   */
  static sanitizeText(text: string): string {
    if (!text) return '';
    
    // Remove any HTML tags and escape remaining content
    return this.escapeHtml(text.replace(/<[^>]*>/g, ''));
  }

  /**
   * Validate and sanitize URLs
   */
  static sanitizeUrl(url: string): string {
    if (!url) return '';
    
    try {
      const parsedUrl = new URL(url);
      
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return '';
      }
      
      return parsedUrl.href;
    } catch {
      return '';
    }
  }

  /**
   * Create safe DOM element with escaped content
   */
  static createSafeElement(tagName: string, content: string, attributes?: Record<string, string>): HTMLElement {
    const element = document.createElement(tagName);
    
    // Set text content safely (no HTML interpretation)
    element.textContent = content;
    
    // Add attributes if provided (with basic validation)
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        // Only allow certain safe attributes
        const safeAttributes = ['class', 'id', 'data-', 'aria-'];
        const isSafe = safeAttributes.some(safe => key.startsWith(safe) || key === safe.replace('-', ''));
        
        if (isSafe && value) {
          element.setAttribute(key, this.escapeHtml(value));
        }
      });
    }
    
    return element;
  }

  /**
   * Safely set innerHTML using DOM manipulation instead
   */
  static setSafeContent(element: HTMLElement, content: string): void {
    // Clear existing content
    element.textContent = '';
    
    // Create text node for safe insertion
    const textNode = document.createTextNode(content);
    element.appendChild(textNode);
  }

  /**
   * Validate JSON input for API calls
   */
  static validateJsonInput(input: unknown): boolean {
    try {
      // Check if it's a valid object
      if (typeof input !== 'object' || input === null) {
        return false;
      }

      // Check for potentially dangerous properties
      const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
      const inputObj = input as Record<string, unknown>;
      
      for (const key of Object.keys(inputObj)) {
        if (dangerousKeys.includes(key)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean and validate platform names
   */
  static validatePlatform(platform: string): boolean {
    const validPlatforms = ['linkedin', 'twitter', 'instagram', 'facebook'];
    return validPlatforms.includes(platform.toLowerCase());
  }

  /**
   * Sanitize content for different platforms
   */
  static sanitizePostContent(content: string, platform: string): string {
    if (!content || !this.validatePlatform(platform)) return '';
    
    // Remove potentially harmful content
    let sanitized = content
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframes
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers
    
    // Trim and normalize whitespace
    sanitized = sanitized.trim().replace(/\s+/g, ' ');
    
    return this.escapeHtml(sanitized);
  }
}