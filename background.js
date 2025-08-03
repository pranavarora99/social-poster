// Background Service Worker for Social Poster Extension

class BackgroundService {
  constructor() {
    this.setupMessageHandlers();
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'analyzeExternalUrl') {
        this.analyzeExternalUrl(message.url)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep the message channel open for async response
      }

      if (message.action === 'createTabAndAnalyze') {
        this.createTabAndAnalyze(message.url)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      }
    });
  }

  async analyzeExternalUrl(url) {
    try {
      // Validate URL
      new URL(url);
      
      // Create a new tab to load the URL
      const tab = await chrome.tabs.create({ 
        url: url, 
        active: false // Don't switch to the tab
      });

      // Wait for the tab to finish loading
      await this.waitForTabToLoad(tab.id);

      // Inject content script and extract data
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: this.extractPageDataFunction
      });

      // Close the temporary tab
      await chrome.tabs.remove(tab.id);

      if (results && results[0] && results[0].result) {
        return results[0].result;
      } else {
        throw new Error('Failed to extract page data');
      }

    } catch (error) {
      console.error('Error analyzing external URL:', error);
      throw new Error(`Failed to analyze URL: ${error.message}`);
    }
  }

  async createTabAndAnalyze(url) {
    try {
      // Create tab and keep it open for user to see
      const tab = await chrome.tabs.create({ 
        url: url, 
        active: true 
      });

      // Wait for the tab to finish loading
      await this.waitForTabToLoad(tab.id);

      // Extract data from the new tab
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: this.extractPageDataFunction
      });

      if (results && results[0] && results[0].result) {
        return results[0].result;
      } else {
        throw new Error('Failed to extract page data');
      }

    } catch (error) {
      console.error('Error creating tab and analyzing:', error);
      throw new Error(`Failed to analyze URL: ${error.message}`);
    }
  }

  waitForTabToLoad(tabId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tab loading timeout'));
      }, 15000); // 15 second timeout

      const checkTab = (tabIdChanged, changeInfo, tab) => {
        if (tabIdChanged === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(checkTab);
          
          // Additional delay to ensure content is fully loaded
          setTimeout(() => resolve(), 2000);
        }
      };

      chrome.tabs.onUpdated.addListener(checkTab);
    });
  }

  // This function will be injected into the target page
  extractPageDataFunction() {
    try {
      // Use the same extraction logic as content.js
      const extractor = {
        extractPageData() {
          const title = document.title || 
                       document.querySelector('meta[property="og:title"]')?.content ||
                       document.querySelector('h1')?.textContent ||
                       'Untitled';

          const description = document.querySelector('meta[name="description"]')?.content ||
                             document.querySelector('meta[property="og:description"]')?.content ||
                             document.querySelector('p')?.textContent?.substring(0, 200) ||
                             '';

          const mainImage = document.querySelector('meta[property="og:image"]')?.content ||
                           document.querySelector('img')?.src ||
                           null;

          const keyPoints = this.extractKeyPoints();
          const brandColors = this.extractBrandColors();
          const logos = this.extractLogos();

          return {
            title: title.trim(),
            description: description.trim(),
            mainImage,
            keyPoints,
            brandColors,
            logos,
            url: window.location.href,
            timestamp: Date.now()
          };
        },

        extractKeyPoints() {
          const points = [];
          
          // Extract from headings
          document.querySelectorAll('h2, h3, h4').forEach(heading => {
            const text = heading.textContent.trim();
            if (text.length > 10 && text.length < 100) {
              points.push(text);
            }
          });

          // Extract from list items
          document.querySelectorAll('li').forEach(item => {
            const text = item.textContent.trim();
            if (text.length > 20 && text.length < 150) {
              points.push(text);
            }
          });

          // Extract from paragraphs with strong indicators
          document.querySelectorAll('p').forEach(p => {
            const text = p.textContent.trim();
            if (text.match(/^(Key|Important|Note|Remember|Tip|Pro tip|Best practice)/i)) {
              points.push(text.substring(0, 150));
            }
          });

          return points.slice(0, 8);
        },

        extractBrandColors() {
          const colors = new Set();
          const styles = document.querySelectorAll('[style*="color"], [style*="background"]');
          
          styles.forEach(el => {
            const style = el.getAttribute('style');
            const colorMatches = style.match(/#[0-9a-fA-F]{6}|rgb\(\d+,\s*\d+,\s*\d+\)/g);
            if (colorMatches) {
              colorMatches.forEach(color => colors.add(color));
            }
          });

          return Array.from(colors).slice(0, 5);
        },

        extractLogos() {
          const logos = [];
          const logoSelectors = [
            'img[alt*="logo" i]',
            'img[src*="logo" i]',
            'img[class*="logo" i]',
            '.logo img',
            'header img',
            '.header img'
          ];

          logoSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(img => {
              if (img.src && img.width > 50 && img.height > 20) {
                logos.push(img.src);
              }
            });
          });

          return logos.slice(0, 3);
        }
      };

      return extractor.extractPageData();
    } catch (error) {
      console.error('Error extracting page data:', error);
      return {
        title: document.title || 'Error extracting title',
        description: 'Failed to extract page content',
        mainImage: null,
        keyPoints: [],
        brandColors: [],
        logos: [],
        url: window.location.href,
        timestamp: Date.now(),
        error: error.message
      };
    }
  }
}

// Initialize the background service
new BackgroundService();