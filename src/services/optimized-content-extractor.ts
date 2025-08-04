/**
 * High-Performance Single-Pass Content Extraction Engine
 * Optimized for O(n) complexity and minimal DOM reflow
 */

import type { PageData } from '../types/index';
import { PerformanceUtils } from '../utils/performance';

interface ExtractionContext {
  title: string;
  description: string;
  keyPoints: string[];
  images: string[];
  brandColors: { primary: string; secondary: string };
  metadata: {
    wordCount: number;
    readabilityScore: number;
    semanticDensity: number;
    extractionTime: number;
  };
}

interface ElementMetrics {
  visible: boolean;
  importance: number;
  semanticValue: number;
  position: { x: number; y: number; width: number; height: number };
}

export class OptimizedContentExtractor {
  private readonly navigationTerms = new Set([
    'menu', 'navigation', 'nav', 'home', 'about', 'contact', 'login', 'signin', 'signup',
    'search', 'close', 'open', 'toggle', 'skip', 'breadcrumb', 'sidebar', 'footer', 'header'
  ]);

  private readonly qualityFilters = {
    minWordCount: 3,
    maxLength: 300,
    minLength: 10,
    excludePatterns: [
      /^(skip|menu|nav|home|about|contact|login|sign)/i,
      /^(more|read more|click here|learn more)$/i,
      /^(yes|no|ok|cancel|submit|close)$/i,
      /^[0-9]+$/,
      /^[a-z]{1,3}$/,
      /cookie|privacy|terms|disclaimer/i
    ]
  };

  private performanceMetrics = {
    domQueries: 0,
    elementsProcessed: 0,
    extractionTime: 0
  };

  /**
   * Single-pass content extraction with performance optimization
   */
  async extractPageData(): Promise<PageData> {
    const startTime = performance.now();
    this.resetMetrics();

    try {
      const context = await this.performSinglePassExtraction();
      
      const endTime = performance.now();
      context.metadata.extractionTime = endTime - startTime;
      
      console.log(`[OptimizedExtractor] Performance: ${context.metadata.extractionTime.toFixed(2)}ms, ${this.performanceMetrics.elementsProcessed} elements, ${this.performanceMetrics.domQueries} queries`);
      
      return {
        url: window.location.href,
        title: context.title,
        description: context.description,
        keyPoints: context.keyPoints,
        images: context.images,
        brandColors: context.brandColors
      };

    } catch (error) {
      console.error('[OptimizedExtractor] Extraction failed:', error);
      return this.getFallbackData();
    }
  }

  /**
   * Core single-pass extraction algorithm
   */
  private async performSinglePassExtraction(): Promise<ExtractionContext> {
    // Initialize context
    const context: ExtractionContext = {
      title: '',
      description: '',
      keyPoints: [],
      images: [],
      brandColors: { primary: '#667eea', secondary: '#764ba2' },
      metadata: {
        wordCount: 0,
        readabilityScore: 0,
        semanticDensity: 0,
        extractionTime: 0
      }
    };

    // Single DOM traversal with TreeWalker for optimal performance
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip hidden elements and scripts early
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (this.isHiddenElement(element) || this.isNonContentElement(element)) {
              return NodeFilter.FILTER_REJECT;
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    // Process elements in document order (single pass)
    const processedElements = new WeakSet<Element>();
    const textNodes: Text[] = [];
    const headingElements: Element[] = [];
    const imageElements: HTMLImageElement[] = [];
    const listElements: Element[] = [];
    const emphasisElements: Element[] = [];

    let currentNode = walker.nextNode();
    while (currentNode) {
      this.performanceMetrics.elementsProcessed++;

      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const element = currentNode as Element;
        
        if (!processedElements.has(element)) {
          processedElements.add(element);
          
          // Categorize elements by type for batch processing
          const tagName = element.tagName.toLowerCase();
          switch (tagName) {
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
              headingElements.push(element);
              break;
            case 'img':
              imageElements.push(element as HTMLImageElement);
              break;
            case 'li':
              listElements.push(element);
              break;
            case 'strong':
            case 'b':
            case 'em':
            case 'i':
              emphasisElements.push(element);
              break;
          }
        }
      } else if (currentNode.nodeType === Node.TEXT_NODE) {
        const textNode = currentNode as Text;
        if (textNode.textContent && textNode.textContent.trim().length > 5) {
          textNodes.push(textNode);
        }
      }

      currentNode = walker.nextNode();
    }

    // Batch process categorized elements
    await Promise.allSettled([
      this.extractTitle(context, headingElements),
      this.extractDescription(context),
      this.extractKeyPoints(context, headingElements, listElements, emphasisElements),
      this.extractImages(context, imageElements),
      this.extractBrandColors(context),
      this.calculateMetrics(context, textNodes)
    ]);

    return context;
  }

  /**
   * Extract title with priority-based selection
   */
  private async extractTitle(context: ExtractionContext, headingElements: Element[]): Promise<void> {
    this.performanceMetrics.domQueries++;

    // Priority order: og:title > title > h1 > h2
    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
    if (ogTitle?.content && this.isQualityText(ogTitle.content)) {
      context.title = ogTitle.content;
      return;
    }

    const titleElement = document.querySelector('title');
    if (titleElement?.textContent) {
      const cleanTitle = this.cleanTitle(titleElement.textContent.trim());
      if (this.isQualityText(cleanTitle)) {
        context.title = cleanTitle;
        return;
      }
    }

    // Use pre-collected heading elements
    for (const heading of headingElements) {
      const text = heading.textContent?.trim();
      if (text && this.isQualityText(text) && this.isMainContent(heading)) {
        context.title = text;
        return;
      }
    }

    context.title = 'Content Page';
  }

  /**
   * Extract description with fallback chain
   */
  private async extractDescription(context: ExtractionContext): Promise<void> {
    this.performanceMetrics.domQueries += 2;

    const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement;

    if (metaDesc?.content && metaDesc.content.length > 20) {
      context.description = metaDesc.content;
      return;
    }

    if (ogDesc?.content && ogDesc.content.length > 20) {
      context.description = ogDesc.content;
      return;
    }

    // Find first substantial paragraph
    const paragraphs = document.querySelectorAll('main p, article p, .content p, p');
    for (const p of paragraphs) {
      const text = p.textContent?.trim();
      if (text && text.length > 50 && text.length < 500 && this.isMainContent(p)) {
        context.description = text.substring(0, 300);
        return;
      }
    }

    context.description = 'No description available';
  }

  /**
   * Extract key points with intelligent deduplication
   */
  private async extractKeyPoints(
    context: ExtractionContext,
    headingElements: Element[],
    listElements: Element[],
    emphasisElements: Element[]
  ): Promise<void> {
    const keyPoints = new Set<string>();
    const processedText = new Set<string>();

    // Process headings (h2-h4)
    for (const heading of headingElements) {
      if (!['H1'].includes(heading.tagName)) {
        const text = heading.textContent?.trim();
        if (text && this.isQualityKeyPoint(text) && this.isMainContent(heading)) {
          const normalized = text.toLowerCase();
          if (!processedText.has(normalized)) {
            keyPoints.add(text);
            processedText.add(normalized);
          }
        }
      }
    }

    // Process list items
    for (const item of listElements) {
      const text = item.textContent?.trim();
      if (text && this.isQualityKeyPoint(text) && !this.isNavigationItem(item)) {
        const normalized = text.toLowerCase();
        if (!processedText.has(normalized)) {
          const sentences = text.split(/[.!?]+/);
          const firstSentence = sentences[0]?.trim();
          if (firstSentence && firstSentence.length < 150) {
            keyPoints.add(firstSentence);
            processedText.add(normalized);
          }
        }
      }
    }

    // Process emphasis elements
    for (const element of emphasisElements) {
      const text = element.textContent?.trim();
      if (text && this.isQualityKeyPoint(text) && this.isMainContent(element)) {
        const normalized = text.toLowerCase();
        if (!processedText.has(normalized)) {
          keyPoints.add(text);
          processedText.add(normalized);
        }
      }
    }

    // Convert to array and rank by importance
    context.keyPoints = Array.from(keyPoints)
      .slice(0, 8)
      .sort((a, b) => this.calculateTextImportance(b) - this.calculateTextImportance(a));
  }

  /**
   * Extract images with performance filtering
   */
  private async extractImages(context: ExtractionContext, imageElements: HTMLImageElement[]): Promise<void> {
    const images = new Set<string>();

    // Check Open Graph image first
    this.performanceMetrics.domQueries++;
    const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
    if (ogImage?.content) {
      images.add(this.makeAbsoluteUrl(ogImage.content));
    }

    // Process pre-collected image elements
    for (const img of imageElements) {
      if (this.isQualityImage(img)) {
        images.add(this.makeAbsoluteUrl(img.src));
      }
    }

    context.images = Array.from(images).slice(0, 5);
  }

  /**
   * Extract brand colors with caching
   */
  private async extractBrandColors(context: ExtractionContext): Promise<void> {
    try {
      this.performanceMetrics.domQueries++;
      
      // Check theme color meta tag
      const themeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
      if (themeColor?.content && this.isValidColor(themeColor.content)) {
        context.brandColors = {
          primary: themeColor.content,
          secondary: this.generateSecondaryColor(themeColor.content)
        };
        return;
      }

      // Sample prominent elements for colors
      const sampleElements = ['header', 'nav', '.navbar', '.header', 'button', '.btn'];
      for (const selector of sampleElements) {
        const element = document.querySelector(selector);
        if (element) {
          const styles = getComputedStyle(element);
          const bgColor = styles.backgroundColor;
          
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            const hexColor = this.rgbToHex(bgColor);
            if (hexColor !== '#000000' && hexColor !== '#ffffff') {
              context.brandColors = {
                primary: hexColor,
                secondary: this.generateSecondaryColor(hexColor)
              };
              return;
            }
          }
        }
      }
    } catch (error) {
      console.warn('[OptimizedExtractor] Brand color extraction failed:', error);
    }
  }

  /**
   * Calculate content metrics
   */
  private async calculateMetrics(context: ExtractionContext, textNodes: Text[]): Promise<void> {
    const allText = textNodes.map(node => node.textContent || '').join(' ');
    
    context.metadata.wordCount = allText.split(/\s+/).filter(word => word.length > 0).length;
    context.metadata.readabilityScore = this.calculateReadabilityScore(allText);
    context.metadata.semanticDensity = this.calculateSemanticDensity(allText);
  }

  /**
   * Performance-optimized utility methods
   */
  private isHiddenElement(element: Element): boolean {
    const style = getComputedStyle(element);
    return style.display === 'none' || 
           style.visibility === 'hidden' || 
           style.opacity === '0' ||
           element.hidden;
  }

  private isNonContentElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    return ['script', 'style', 'noscript', 'iframe', 'embed', 'object'].includes(tagName);
  }

  private isQualityText(text: string): boolean {
    if (!text || text.length < this.qualityFilters.minLength || text.length > this.qualityFilters.maxLength) {
      return false;
    }

    return !this.qualityFilters.excludePatterns.some(pattern => pattern.test(text)) &&
           text.split(/\s+/).length >= this.qualityFilters.minWordCount &&
           !this.navigationTerms.has(text.toLowerCase());
  }

  private isQualityKeyPoint(text: string): boolean {
    return this.isQualityText(text) && text.length >= 15 && text.length <= 200;
  }

  private isMainContent(element: Element): boolean {
    return !!element.closest('main, article, .content, .main, #content, #main, .post, .article') ||
           !element.closest('nav, header, footer, .nav, .menu, .navigation, .sidebar, aside');
  }

  private isNavigationItem(element: Element): boolean {
    return !!element.closest('nav, .nav, .menu, .navigation, header, footer');
  }

  private isQualityImage(img: HTMLImageElement): boolean {
    return img.offsetWidth > 150 && 
           img.offsetHeight > 150 && 
           !img.src.toLowerCase().includes('icon') && 
           !img.src.toLowerCase().includes('logo') &&
           !img.src.toLowerCase().includes('avatar');
  }

  private calculateTextImportance(text: string): number {
    let score = text.length * 0.1; // Base length score
    
    // Bonus for numbers and data
    if (/\d+/.test(text)) score += 10;
    
    // Bonus for question marks (engagement)
    if (text.includes('?')) score += 15;
    
    // Bonus for actionable language
    const actionWords = ['how', 'why', 'what', 'when', 'guide', 'tips', 'step'];
    if (actionWords.some(word => text.toLowerCase().includes(word))) score += 20;
    
    return score;
  }

  private calculateReadabilityScore(text: string): number {
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const syllables = this.countSyllables(text);
    
    if (sentences === 0 || words === 0) return 0;
    
    // Simplified Flesch Reading Ease
    const flesch = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
    return Math.max(0, Math.min(100, flesch)) / 100;
  }

  private calculateSemanticDensity(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    return uniqueWords.size / words.length;
  }

  private countSyllables(text: string): number {
    return text.toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace(/[aeiouy]+/g, 'a')
      .replace(/a$/, '')
      .length || 1;
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/\s*[-|]\s*.+$/, '')
      .replace(/\s*:\s*.+$/, '')
      .trim();
  }

  private makeAbsoluteUrl(url: string): string {
    try {
      return new URL(url, window.location.href).href;
    } catch {
      return url;
    }
  }

  private isValidColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color) ||
           /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color);
  }

  private generateSecondaryColor(primaryColor: string): string {
    if (primaryColor.startsWith('#')) {
      const num = parseInt(primaryColor.slice(1), 16);
      const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + 30));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + 20));
      const b = Math.min(255, Math.max(0, (num & 255) + 40));
      
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
    
    return primaryColor;
  }

  private rgbToHex(rgb: string): string {
    const match = rgb.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0] || '0');
      const g = parseInt(match[1] || '0');
      const b = parseInt(match[2] || '0');
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
    return rgb;
  }

  private resetMetrics(): void {
    this.performanceMetrics = {
      domQueries: 0,
      elementsProcessed: 0,
      extractionTime: 0
    };
  }

  private getFallbackData(): PageData {
    return {
      url: window.location.href,
      title: document.title || 'Unknown Page',
      description: 'Content extraction failed',
      keyPoints: [],
      images: [],
      brandColors: { primary: '#667eea', secondary: '#764ba2' }
    };
  }
}