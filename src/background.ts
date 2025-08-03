// Background Service Worker for Social Poster Extension
/// <reference types="chrome"/>

class BackgroundService {
  constructor() {
    this.setupMessageHandlers();
  }

  setupMessageHandlers(): void {
    chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
      if (message.action === 'analyzeExternalUrl') {
        this.analyzeExternalUrl(message.data.url)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep the message channel open for async response
      }

      if (message.action === 'createTabAndAnalyze') {
        this.createTabAndAnalyze(message.data.url)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      }

      return false; // Default return for other message types
    });
  }

  async analyzeExternalUrl(url: string): Promise<any> {
    try {
      // Validate URL
      new URL(url);
      
      // Create a temporary tab to analyze the content
      const tab = await chrome.tabs.create({ 
        url: url, 
        active: false 
      });

      // Wait for the tab to load
      await this.waitForTabLoad(tab.id!);

      // Inject content script and extract data
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: this.extractPageContent
      });

      // Close the temporary tab
      await chrome.tabs.remove(tab.id!);

      if (results && results[0] && results[0].result) {
        return results[0].result;
      } else {
        throw new Error('Failed to extract page content');
      }
    } catch (error) {
      console.error('Error analyzing external URL:', error);
      throw error;
    }
  }

  async createTabAndAnalyze(url: string): Promise<any> {
    try {
      // Create a new tab and analyze it
      const tab = await chrome.tabs.create({ 
        url: url, 
        active: true 
      });

      // Wait for the tab to load
      await this.waitForTabLoad(tab.id!);

      // Extract content from the new tab
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: this.extractPageContent
      });

      if (results && results[0] && results[0].result) {
        return results[0].result;
      } else {
        throw new Error('Failed to extract page content');
      }
    } catch (error) {
      console.error('Error creating tab and analyzing:', error);
      throw error;
    }
  }

  private async waitForTabLoad(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkTab = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (tab.status === 'complete') {
            // Add a small delay to ensure content is fully loaded
            setTimeout(() => resolve(), 1000);
          } else {
            setTimeout(checkTab, 100);
          }
        });
      };
      
      checkTab();
      
      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Tab load timeout'));
      }, 30000);
    });
  }

  // This function will be injected into the webpage
  private extractPageContent(): any {
    // Create a new instance of the WebpageExtractor
    class WebpageExtractor {
      extractContent(): any {
        const pageData: any = {
          title: this.getTitle(),
          description: this.getDescription(),
          keyPoints: this.getKeyPoints(),
          url: window.location.href,
          images: this.getImages(),
          brandColors: this.getBrandColors()
        };

        return pageData;
      }

      private getTitle(): string {
        const titleElement = document.querySelector('title');
        const h1Element = document.querySelector('h1');
        const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
        
        return ogTitle?.content || 
               titleElement?.textContent || 
               h1Element?.textContent || 
               'Untitled Page';
      }

      private getDescription(): string {
        const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
        const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement;
        const firstP = document.querySelector('p');
        
        return metaDesc?.content || 
               ogDesc?.content || 
               firstP?.textContent?.substring(0, 200) || 
               'No description available';
      }

      private getKeyPoints(): string[] {
        const points: string[] = [];
        
        // Extract from headings
        const headings = document.querySelectorAll('h2, h3, h4');
        headings.forEach(heading => {
          const text = heading.textContent?.trim();
          if (text && text.length > 10 && text.length < 100) {
            points.push(text);
          }
        });

        // Extract from list items
        const listItems = document.querySelectorAll('li');
        listItems.forEach(item => {
          const text = item.textContent?.trim();
          if (text && text.length > 15 && text.length < 150) {
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

        // Return up to 5 unique points
        return [...new Set(points)].slice(0, 5);
      }

      private getImages(): string[] {
        const images: string[] = [];
        
        // Get Open Graph image
        const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
        if (ogImage?.content) {
          images.push(ogImage.content);
        }

        // Get other prominent images
        const imgElements = document.querySelectorAll('img');
        imgElements.forEach(img => {
          if (img.src && 
              img.offsetWidth > 200 && 
              img.offsetHeight > 200 && 
              !img.src.includes('icon') && 
              !img.src.includes('logo')) {
            images.push(img.src);
          }
        });

        return images.slice(0, 3);
      }

      private getBrandColors(): { primary: string; secondary: string } {
        const defaultColors = { primary: '#667eea', secondary: '#764ba2' };
        
        try {
          // Try to extract theme color from meta tag
          const themeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
          if (themeColor?.content) {
            return {
              primary: themeColor.content,
              secondary: this.lightenColor(themeColor.content, 20)
            };
          }

          // Try to get colors from CSS variables
          const rootStyles = getComputedStyle(document.documentElement);
          const primaryColor = rootStyles.getPropertyValue('--primary-color') || 
                             rootStyles.getPropertyValue('--main-color') ||
                             rootStyles.getPropertyValue('--brand-color');
          
          if (primaryColor) {
            return {
              primary: primaryColor.trim(),
              secondary: this.lightenColor(primaryColor.trim(), 20)
            };
          }

          return defaultColors;
        } catch (error) {
          return defaultColors;
        }
      }

      private lightenColor(color: string, percent: number): string {
        // Simple color lightening function
        if (color.startsWith('#')) {
          const num = parseInt(color.slice(1), 16);
          const amt = Math.round(2.55 * percent);
          const R = (num >> 16) + amt;
          const G = (num >> 8 & 0x00FF) + amt;
          const B = (num & 0x0000FF) + amt;
          return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
        }
        return color;
      }
    }

    const extractor = new WebpageExtractor();
    return extractor.extractContent();
  }
}

// Initialize the background service
new BackgroundService();