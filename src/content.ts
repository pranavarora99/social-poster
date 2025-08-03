// Content Script for Social Poster Extension
/// <reference types="chrome"/>

import type { PageData, ChromeMessage } from './types/index';
import { PerformanceUtils } from './utils/performance';

class WebpageExtractor {
  private pageData: PageData | null = null;

  extractPageData(): PageData {
    const data: PageData = {
      url: window.location.href,
      title: this.extractTitle(),
      description: this.extractDescription(),
      keyPoints: this.extractKeyPoints(),
      images: this.extractAllImages(),
      brandColors: this.extractBrandColors()
    };

    this.pageData = data;
    return data;
  }

  private extractTitle(): string {
    const h1Element = document.querySelector('h1');
    const titleElement = document.querySelector('title');
    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
    
    return h1Element?.textContent?.trim() ||
           titleElement?.textContent?.trim() ||
           ogTitle?.content ||
           'Untitled Page';
  }

  private extractDescription(): string {
    const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement;
    const firstP = document.querySelector('p');
    
    return metaDesc?.content ||
           ogDesc?.content ||
           firstP?.textContent?.substring(0, 200) ||
           'No description available';
  }

  private extractAllImages(): string[] {
    const images: string[] = [];
    
    // Get Open Graph image first
    const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
    if (ogImage?.content) {
      images.push(this.makeAbsoluteUrl(ogImage.content));
    }

    // Get other prominent images
    const imgElements = document.querySelectorAll('img');
    imgElements.forEach((img: HTMLImageElement) => {
      if (img.src && 
          img.offsetWidth > 200 && 
          img.offsetHeight > 200 && 
          !img.src.toLowerCase().includes('icon') && 
          !img.src.toLowerCase().includes('logo') &&
          !img.src.toLowerCase().includes('avatar')) {
        images.push(this.makeAbsoluteUrl(img.src));
      }
    });

    return [...new Set(images)].slice(0, 5);
  }

  private extractKeyPoints(): string[] {
    const points: string[] = [];
    
    // Extract from headings (h2, h3, h4)
    const headings = document.querySelectorAll('h2, h3, h4');
    headings.forEach(heading => {
      const text = heading.textContent?.trim();
      if (text && text.length > 10 && text.length < 120) {
        points.push(text);
      }
    });

    // Extract from list items
    const listItems = document.querySelectorAll('li');
    listItems.forEach(item => {
      const text = item.textContent?.trim();
      if (text && text.length > 15 && text.length < 150 && !this.isNavItem(item)) {
        points.push(text);
      }
    });

    // Extract from bold/strong text
    const strongElements = document.querySelectorAll('strong, b');
    strongElements.forEach(element => {
      const text = element.textContent?.trim();
      if (text && text.length > 10 && text.length < 100) {
        points.push(text);
      }
    });

    // Extract from paragraph sentences
    const paragraphs = document.querySelectorAll('p');
    paragraphs.forEach(p => {
      const text = p.textContent?.trim();
      if (text && text.length > 20) {
        // Split into sentences and get meaningful ones
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
        sentences.slice(0, 2).forEach(sentence => {
          if (sentence.trim().length < 150) {
            points.push(sentence.trim());
          }
        });
      }
    });

    // Return unique points, prioritizing headings
    const uniquePoints = [...new Set(points)];
    return uniquePoints.slice(0, 8);
  }

  private extractBrandColors(): { primary: string; secondary: string } {
    const defaultColors = { primary: '#667eea', secondary: '#764ba2' };
    
    try {
      // Try theme color meta tag
      const themeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
      if (themeColor?.content) {
        return {
          primary: themeColor.content,
          secondary: this.generateSecondaryColor(themeColor.content)
        };
      }

      // Try CSS custom properties on root
      const rootStyles = getComputedStyle(document.documentElement);
      const primaryColor = rootStyles.getPropertyValue('--primary-color')?.trim() || 
                         rootStyles.getPropertyValue('--main-color')?.trim() ||
                         rootStyles.getPropertyValue('--brand-color')?.trim() ||
                         rootStyles.getPropertyValue('--accent-color')?.trim();
      
      if (primaryColor && primaryColor !== '') {
        return {
          primary: primaryColor,
          secondary: this.generateSecondaryColor(primaryColor)
        };
      }

      // Try to extract from prominent elements
      const header = document.querySelector('header');
      const nav = document.querySelector('nav');
      const button = document.querySelector('button, .btn');
      
      for (const element of [header, nav, button]) {
        if (element) {
          const styles = getComputedStyle(element);
          const bgColor = styles.backgroundColor;
          const color = styles.color;
          
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            const hexColor = this.rgbToHex(bgColor);
            return {
              primary: hexColor,
              secondary: this.generateSecondaryColor(hexColor)
            };
          }
          
          if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
            const hexColor = this.rgbToHex(color);
            return {
              primary: hexColor,
              secondary: this.generateSecondaryColor(hexColor)
            };
          }
        }
      }

      return defaultColors;
    } catch (error) {
      console.warn('Error extracting brand colors:', error);
      return defaultColors;
    }
  }

  private isNavItem(element: Element): boolean {
    const navSelectors = ['nav', '.nav', '.menu', '.navigation', 'header', 'footer'];
    let parent = element.parentElement;
    
    while (parent) {
      if (navSelectors.some(selector => 
        parent!.matches(selector) || parent!.classList.contains(selector.replace('.', ''))
      )) {
        return true;
      }
      parent = parent.parentElement;
    }
    
    return false;
  }

  private makeAbsoluteUrl(url: string): string {
    try {
      return new URL(url, window.location.href).href;
    } catch {
      return url;
    }
  }

  private generateSecondaryColor(primaryColor: string): string {
    // Simple color variation - lighten or shift hue
    if (primaryColor.startsWith('#')) {
      const num = parseInt(primaryColor.slice(1), 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      
      // Shift hue slightly and adjust brightness
      const newR = Math.min(255, Math.max(0, r + 30));
      const newG = Math.min(255, Math.max(0, g + 20));
      const newB = Math.min(255, Math.max(0, b + 40));
      
      return `#${((newR << 16) | (newG << 8) | newB).toString(16).padStart(6, '0')}`;
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
}

// Message listener for content script
chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
  if (message.action === 'extractPageData') {
    try {
      const extractor = new WebpageExtractor();
      const data = extractor.extractPageData();
      sendResponse({ success: true, data });
    } catch (error) {
      console.error('Error extracting page data:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    return true; // Keep the message channel open
  }
  
  return false; // Default return for other message types
});

// Auto-extraction when script loads (optional)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Page is ready for extraction
  });
} else {
  // Page already loaded
}