/**
 * Advanced Web Crawler with AI-Powered Content Analysis
 * Uses multiple extraction methods and AI processing
 */
export class AdvancedWebCrawler {
  private apiEndpoints = {
    jina: 'https://r.jina.ai/',  // AI-powered web reader - FREE
    readability: 'https://readability-api.onrender.com/extract', // Article extraction - FREE
    extract: 'https://extractorapi.com/api/v1/extractor', // Content extraction - FREE
    scrapfly: 'https://api.scrapfly.io/scrape', // Web scraping - FREE tier available
  };

  async analyzeURL(url: string): Promise<any> {
    console.log(`🔍 Starting comprehensive analysis of: ${url}`);
    
    // Run multiple extraction methods in parallel
    const extractionPromises = [
      this.extractWithJinaAI(url),
      this.extractWithBrowserAPI(url),
      this.extractWithFallbackMethod(url)
    ];

    const results = await Promise.allSettled(extractionPromises);
    const validResults = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(data => data && data.content && data.content.length > 100);

    if (validResults.length === 0) {
      throw new Error('All extraction methods failed');
    }

    // Merge and enhance results
    const mergedData = this.mergeExtractionResults(validResults);
    const enhancedData = await this.enhanceWithAIAnalysis(mergedData, url);
    
    console.log(`✅ Successfully analyzed ${url}:`, {
      contentLength: enhancedData.content?.length || 0,
      keyPoints: enhancedData.keyPoints?.length || 0,
      aiConfidence: enhancedData.aiAnalysis?.confidence || 0
    });

    return enhancedData;
  }

  private async extractWithJinaAI(url: string): Promise<any> {
    try {
      // Jina AI can extract and summarize web content with AI
      const response = await fetch(`${this.apiEndpoints.jina}${url}`, {
        headers: {
          'Accept': 'application/json',
          'X-With-Generated-Alt': 'true', // Get AI-generated alt text for images
          'X-With-Links-Summary': 'true', // Get summary of linked content
          'X-With-Images-Summary': 'true' // Get description of images
        }
      });

      if (!response.ok) throw new Error(`Jina AI failed: ${response.status}`);

      const data = await response.json();
      
      return {
        method: 'jina-ai',
        title: data.title,
        content: data.content,
        description: data.description,
        author: data.author,
        publishedTime: data.publishedTime,
        images: data.images,
        links: data.links,
        confidence: 0.9 // High confidence for AI extraction
      };
    } catch (error) {
      console.warn('Jina AI extraction failed:', error);
      throw error;
    }
  }

  private async extractWithBrowserAPI(url: string): Promise<any> {
    try {
      // Use Chrome's built-in fetch with CORS bypass
      const response = await chrome.runtime.sendMessage({
        action: 'fetchWithCORS',
        url: url
      });

      if (!response.success) throw new Error('Browser fetch failed');

      const parser = new DOMParser();
      const doc = parser.parseFromString(response.html, 'text/html');
      
      return {
        method: 'browser-api',
        title: this.extractTitleFromDOM(doc),
        content: this.extractMainContentFromDOM(doc),
        description: this.extractDescriptionFromDOM(doc),
        keyPoints: this.extractKeyPointsFromDOM(doc),
        images: this.extractImagesFromDOM(doc),
        confidence: 0.7
      };
    } catch (error) {
      console.warn('Browser API extraction failed:', error);
      throw error;
    }
  }

  private async extractWithFallbackMethod(url: string): Promise<any> {
    try {
      // Use free readability API for content extraction
      const response = await fetch(`${this.apiEndpoints.readability}?url=${encodeURIComponent(url)}`);
      
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      
      const data = await response.json();
      
      return {
        method: 'readability-fallback',
        title: data.title || data.heading || 'Extracted Content',
        content: data.content || data.text || data.body || '',
        description: data.excerpt || data.description || '',
        author: data.author || '',
        confidence: 0.6
      };
    } catch (error) {
      console.warn('Fallback extraction failed:', error);
      
      // Ultimate fallback - use a simple HTTP fetch
      try {
        const response = await fetch(url);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        return {
          method: 'basic-fetch',
          title: doc.title || 'Web Page',
          content: doc.body?.textContent?.substring(0, 5000) || '',
          description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          confidence: 0.3
        };
      } catch (finalError) {
        throw new Error('All extraction methods failed');
      }
    }
  }

  private mergeExtractionResults(results: any[]): any {
    // Sort by confidence and merge data
    results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    const primary = results[0];
    const merged = { ...primary };

    // Enhance with data from other sources
    results.slice(1).forEach(result => {
      if (!merged.title && result.title) merged.title = result.title;
      if (!merged.description && result.description) merged.description = result.description;
      if (!merged.content && result.content) merged.content = result.content;
      
      // Merge key points
      if (result.keyPoints && Array.isArray(result.keyPoints)) {
        merged.keyPoints = [...(merged.keyPoints || []), ...result.keyPoints];
      }
      
      // Merge images
      if (result.images && Array.isArray(result.images)) {
        merged.images = [...(merged.images || []), ...result.images];
      }
    });

    // Deduplicate arrays
    if (merged.keyPoints) {
      merged.keyPoints = [...new Set(merged.keyPoints)].slice(0, 10);
    }
    if (merged.images) {
      merged.images = [...new Set(merged.images)].slice(0, 5);
    }

    return merged;
  }

  private async enhanceWithAIAnalysis(data: any, url: string): Promise<any> {
    try {
      const analysisPrompt = `Analyze this web content and provide structured insights:

URL: ${url}
Title: ${data.title}
Content: ${data.content?.substring(0, 2000)}...

Provide analysis in this JSON format:
{
  "mainTopic": "primary topic category",
  "contentType": "article/tutorial/review/news/listicle",
  "targetAudience": "beginners/professionals/developers/marketers/general",
  "emotionalTone": "positive/negative/neutral/excited",
  "keyInsights": ["insight1", "insight2", "insight3"],
  "practicalValue": "high/medium/low",
  "viralityFactors": ["factor1", "factor2"],
  "industryRelevance": "high/medium/low",
  "actionability": "high/medium/low"
}`;

      // Call AI analysis service
      const aiResponse = await this.callAIForAnalysis(analysisPrompt);
      
      return {
        ...data,
        aiAnalysis: aiResponse,
        extractionMethods: data.method,
        analysisTimestamp: new Date().toISOString(),
        confidence: (data.confidence + (aiResponse.confidence || 0.8)) / 2
      };
    } catch (error) {
      console.warn('AI analysis enhancement failed:', error);
      return data; // Return without AI enhancement
    }
  }

  private async callAIForAnalysis(prompt: string): Promise<any> {
    try {
      // Use HuggingFace for content analysis
      const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-large', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAPIToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.3, // Lower temperature for more consistent analysis
            do_sample: true
          }
        })
      });

      const result = await response.json();
      
      try {
        return JSON.parse(result[0]?.generated_text || '{}');
      } catch {
        // Fallback to basic analysis if AI doesn't return valid JSON
        return this.generateBasicAnalysis(prompt);
      }
    } catch (error) {
      console.warn('AI analysis call failed:', error);
      return this.generateBasicAnalysis(prompt);
    }
  }

  private generateBasicAnalysis(content: string): any {
    const lowerContent = content.toLowerCase();
    
    return {
      mainTopic: this.detectTopic(lowerContent),
      contentType: this.detectContentType(lowerContent),
      targetAudience: this.detectAudience(lowerContent),
      emotionalTone: this.detectEmotion(lowerContent),
      keyInsights: this.extractBasicInsights(content),
      confidence: 0.6
    };
  }

  private detectTopic(content: string): string {
    const topics = {
      'SEO/Marketing': ['seo', 'keyword', 'ranking', 'backlink', 'ahrefs', 'marketing'],
      'AI/ML': ['artificial intelligence', 'machine learning', 'ai', 'neural', 'algorithm'],
      'Technology': ['software', 'programming', 'development', 'tech', 'code'],
      'Business': ['business', 'revenue', 'profit', 'strategy', 'growth']
    };

    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return topic;
      }
    }
    return 'General';
  }

  private detectContentType(content: string): string {
    if (content.includes('review') || content.includes('pros') || content.includes('cons')) return 'review';
    if (content.includes('how to') || content.includes('tutorial') || content.includes('guide')) return 'tutorial';
    if (content.includes('tips') || content.includes('ways to') || content.includes('best practices')) return 'listicle';
    if (content.includes('news') || content.includes('announcement') || content.includes('update')) return 'news';
    return 'article';
  }

  private detectAudience(content: string): string {
    if (content.includes('beginner') || content.includes('getting started')) return 'beginners';
    if (content.includes('professional') || content.includes('enterprise')) return 'professionals';
    if (content.includes('developer') || content.includes('programming')) return 'developers';
    if (content.includes('marketing') || content.includes('seo')) return 'marketers';
    return 'general';
  }

  private detectEmotion(content: string): string {
    const positive = ['excellent', 'amazing', 'great', 'fantastic', 'love'];
    const negative = ['terrible', 'awful', 'bad', 'hate', 'disappointing'];
    
    const positiveCount = positive.filter(word => content.includes(word)).length;
    const negativeCount = negative.filter(word => content.includes(word)).length;
    
    if (positiveCount > negativeCount && positiveCount > 0) return 'positive';
    if (negativeCount > positiveCount && negativeCount > 0) return 'negative';
    return 'neutral';
  }

  private extractBasicInsights(content: string): string[] {
    // Extract sentences that look like insights
    const sentences = content.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 200)
      .filter(s => 
        s.includes('important') || 
        s.includes('key') || 
        s.includes('essential') ||
        s.includes('recommend') ||
        s.includes('should')
      );
    
    return sentences.slice(0, 5);
  }

  // DOM extraction helpers
  private extractTitleFromDOM(doc: Document): string {
    const selectors = [
      'meta[property="og:title"]',
      'title',
      'h1',
      '[role="heading"][aria-level="1"]'
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const content = element.getAttribute('content') || element.textContent;
        if (content && content.trim().length > 5) {
          return content.trim();
        }
      }
    }

    return 'Untitled';
  }

  private extractMainContentFromDOM(doc: Document): string {
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.post-content',
      '.entry-content',
      '#main-content'
    ];

    for (const selector of contentSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        return this.cleanTextContent(element.textContent || '');
      }
    }

    // Fallback: get all paragraphs
    const paragraphs = Array.from(doc.querySelectorAll('p'));
    const content = paragraphs
      .map(p => p.textContent || '')
      .filter(text => text.length > 50)
      .join('\n\n');

    return this.cleanTextContent(content);
  }

  private extractDescriptionFromDOM(doc: Document): string {
    const selectors = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]'
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector) as HTMLMetaElement;
      if (element?.content && element.content.length > 10) {
        return element.content;
      }
    }

    return '';
  }

  private extractKeyPointsFromDOM(doc: Document): string[] {
    const points: string[] = [];
    
    // Extract from headings
    const headings = doc.querySelectorAll('h2, h3, h4, h5');
    headings.forEach(h => {
      const text = h.textContent?.trim();
      if (text && text.length > 10 && text.length < 200) {
        points.push(text);
      }
    });

    // Extract from lists
    const listItems = doc.querySelectorAll('li');
    listItems.forEach(li => {
      const text = li.textContent?.trim();
      if (text && text.length > 20 && text.length < 300) {
        points.push(text);
      }
    });

    return [...new Set(points)].slice(0, 8);
  }

  private extractImagesFromDOM(doc: Document): string[] {
    const images: string[] = [];
    
    // Get og:image first
    const ogImage = doc.querySelector('meta[property="og:image"]') as HTMLMetaElement;
    if (ogImage?.content) {
      images.push(ogImage.content);
    }

    // Get other images
    const imgElements = doc.querySelectorAll('img');
    imgElements.forEach(img => {
      if (img.src && !img.src.includes('icon') && !img.src.includes('logo')) {
        images.push(img.src);
      }
    });

    return [...new Set(images)].slice(0, 5);
  }

  private cleanTextContent(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n\n') // Clean up line breaks
      .trim();
  }

  private async getAPIToken(): Promise<string> {
    const result = await chrome.storage.local.get(['hf_api_token']);
    return result.hf_api_token || '';
  }
}