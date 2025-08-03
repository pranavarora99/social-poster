/**
 * Main Application Controller
 * Orchestrates all business logic, data flow, and coordinates between services
 */

import { logger } from '../core/logger';
import { stateManager } from '../core/state-manager';
import { errorBoundary } from '../core/error-boundary';
import { uiController } from '../ui/ui-controller';
import { HuggingFaceService, TokenManager, APIError } from '../services/api-service';
import { MemoryManager } from '../utils/memory-manager';
import { PerformanceUtils } from '../utils/performance';
import { telemetry } from '../utils/telemetry';
import { Sanitizer } from '../utils/sanitization';
import type { 
  PageData, 
  UserContext, 
  GeneratedPost, 
  Platform, 
  AIGenerationParams,
  ChromeMessage 
} from '../types/index';

export class AppController {
  private static instance: AppController;
  private readonly component = 'AppController';
  private readonly version = '1.2.0';
  private isInitialized = false;

  private readonly progressSteps = [
    { key: 'analyzing', text: '🔍 Analyzing content...', details: 'Extracting webpage content and key insights...', progress: 20 },
    { key: 'extracting', text: '📄 Extracting key points...', details: 'Finding the most engaging elements...', progress: 40 },
    { key: 'personalizing', text: '🎯 Personalizing content...', details: 'Applying your unique context and style...', progress: 60 },
    { key: 'optimizing', text: '⚡ Optimizing for platforms...', details: 'Tailoring content for each social platform...', progress: 80 },
    { key: 'generating', text: '✨ Generating posts...', details: 'Creating engaging social media content...', progress: 100 }
  ];

  private constructor() {
    logger.info(`Social Poster v${this.version} initializing`, undefined, this.component);
  }

  static getInstance(): AppController {
    if (!AppController.instance) {
      AppController.instance = new AppController();
    }
    return AppController.instance;
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('App already initialized', undefined, this.component);
      return;
    }

    try {
      const endTimer = logger.time('App initialization', this.component);

      // Initialize core systems
      await this.initializeCoreServices();
      
      // Initialize UI
      await uiController.initialize();
      
      // Setup business logic handlers
      this.setupBusinessLogicHandlers();
      
      // Setup chrome extension message handlers
      this.setupChromeMessageHandlers();
      
      // Initial state setup
      await this.setupInitialState();

      this.isInitialized = true;
      endTimer();
      
      logger.info(`Social Poster v${this.version} initialized successfully`, undefined, this.component);
      telemetry.trackUserAction('app_initialized', { version: this.version });
      
    } catch (error) {
      errorBoundary.handleError(error, this.component, false);
      stateManager.setError('Failed to initialize application. Please refresh and try again.');
    }
  }

  private async initializeCoreServices(): Promise<void> {
    // Setup memory management cleanup
    MemoryManager.cleanup();
    
    // Initialize telemetry
    telemetry.trackUserAction('app_start', { 
      version: this.version,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    });
  }

  private setupBusinessLogicHandlers(): void {
    // Listen for generation requests
    stateManager.subscribeToSelector(
      state => ({ isGenerating: state.isGenerating, step: state.generationStep }),
      async (value, prevValue) => {
        if (value.isGenerating && !prevValue.isGenerating) {
          await this.handleGenerationStart();
        }
      }
    );
  }

  private setupChromeMessageHandlers(): void {
    chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
      this.handleChromeMessage(message, sender, sendResponse);
      return true; // Keep the message channel open for async responses
    });
  }

  private async setupInitialState(): Promise<void> {
    // Auto-fill current page URL if available
    await this.autoFillCurrentPage();
  }

  private async autoFillCurrentPage(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab?.url && currentTab.title && this.isValidContentUrl(currentTab.url)) {
        logger.debug('Auto-filling current page', { 
          url: currentTab.url, 
          title: currentTab.title 
        }, this.component);
        
        // Update URL input in UI
        const urlInput = document.getElementById('url-input') as HTMLInputElement;
        if (urlInput) {
          urlInput.value = currentTab.url;
        }
      }
    } catch (error) {
      logger.warn('Failed to auto-fill current page', undefined, this.component);
    }
  }

  private isValidContentUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Exclude extension pages, chrome pages, etc.
      return !['chrome:', 'chrome-extension:', 'about:', 'moz-extension:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Handle generation start
   */
  private async handleGenerationStart(): Promise<void> {
    const state = stateManager.getState();
    const urlInput = document.getElementById('url-input') as HTMLInputElement;
    const url = urlInput?.value.trim();

    if (!url || !this.isValidUrl(url)) {
      stateManager.setError('Please enter a valid URL');
      return;
    }

    if (state.selectedPlatforms.length === 0) {
      stateManager.setError('Please select at least one platform');
      return;
    }

    try {
      await this.generateSocialPosts(url, state.selectedPlatforms);
    } catch (error) {
      errorBoundary.handleError(error, this.component, true);
    }
  }

  /**
   * Main generation workflow
   */
  private async generateSocialPosts(url: string, platforms: Platform[]): Promise<void> {
    const operationId = `generation_${Date.now()}`;
    telemetry.startTiming(operationId);

    try {
      logger.info('Starting social post generation', { url, platforms }, this.component);
      
      // Step 1: Analyze content
      stateManager.setGenerationProgress(1, this.progressSteps.length);
      stateManager.setLoading(true, this.progressSteps[0]!.text, this.progressSteps[0]!.progress);
      
      const pageData = await this.extractPageData(url);
      if (!pageData) {
        throw new Error('Failed to extract page data');
      }
      
      stateManager.setPageData(pageData);

      // Step 2: Extract key points
      stateManager.setGenerationProgress(2, this.progressSteps.length);
      stateManager.setLoading(true, this.progressSteps[1]!.text, this.progressSteps[1]!.progress);
      
      await this.delay(500); // UX: Let user see the progress

      // Step 3: Personalize content
      stateManager.setGenerationProgress(3, this.progressSteps.length);
      stateManager.setLoading(true, this.progressSteps[2]!.text, this.progressSteps[2]!.progress);
      
      const userContext = this.gatherUserContext();

      // Step 4: Optimize for platforms
      stateManager.setGenerationProgress(4, this.progressSteps.length);
      stateManager.setLoading(true, this.progressSteps[3]!.text, this.progressSteps[3]!.progress);
      
      await this.delay(500);

      // Step 5: Generate posts
      stateManager.setGenerationProgress(5, this.progressSteps.length);
      stateManager.setLoading(true, this.progressSteps[4]!.text, this.progressSteps[4]!.progress);
      
      const posts = await this.generatePostsForPlatforms(pageData, userContext, platforms);
      
      // Complete generation
      stateManager.setGeneratedPosts(posts);
      stateManager.setGenerationProgress(0, this.progressSteps.length);
      stateManager.setLoading(false);
      stateManager.setCurrentTab('assets');

      // Save to recent URLs
      stateManager.addRecentUrl(url, pageData.title);

      // Track success
      const duration = telemetry.endTiming(operationId);
      telemetry.trackGeneration(platforms[0] || 'linkedin', true, duration, {
        platforms: platforms.length,
        postsGenerated: posts.length,
        url
      });

      logger.info('Social post generation completed', { 
        postsGenerated: posts.length,
        platforms: platforms.length,
        duration
      }, this.component);

    } catch (error) {
      const duration = telemetry.endTiming(operationId);
      telemetry.trackGeneration(platforms[0] || 'linkedin', false, duration, {
        platforms: platforms.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      stateManager.setGenerationProgress(0, this.progressSteps.length);
      stateManager.setLoading(false);
      
      const errorMessage = error instanceof APIError 
        ? error.message 
        : 'Failed to generate social posts. Please try again.';
      
      stateManager.setError(errorMessage);
      
      errorBoundary.handleError(error, this.component, true);
    }
  }

  /**
   * Extract page data from URL
   */
  private async extractPageData(url: string): Promise<PageData | null> {
    try {
      return await logger.wrapAsync(async () => {
        // First try to extract from current tab if it's the same URL
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        if (currentTab?.url === url) {
          // Extract from current tab
          const results = await chrome.scripting.executeScript({
            target: { tabId: currentTab.id! },
            func: this.extractPageContentScript
          });
          
          if (results?.[0]?.result) {
            return results[0].result as PageData;
          }
        }
        
        // Fallback: analyze external URL through background script
        const response = await chrome.runtime.sendMessage({
          action: 'analyzeExternalUrl',
          data: { url }
        });
        
        if (response.success) {
          return response.data as PageData;
        } else {
          throw new Error(response.error || 'Failed to analyze URL');
        }
      }, 'extractPageData', this.component);
    } catch (error) {
      logger.error('Page data extraction failed', { url }, this.component, error as Error);
      return null;
    }
  }

  /**
   * Content script function for extracting page data
   */
  private extractPageContentScript(): PageData {
    const getTitle = (): string => {
      const h1 = document.querySelector('h1')?.textContent?.trim();
      const title = document.querySelector('title')?.textContent?.trim();
      const ogTitle = (document.querySelector('meta[property="og:title"]') as HTMLMetaElement)?.content;
      
      return h1 || ogTitle || title || 'Untitled Page';
    };

    const getDescription = (): string => {
      const metaDesc = (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content;
      const ogDesc = (document.querySelector('meta[property="og:description"]') as HTMLMetaElement)?.content;
      const firstP = document.querySelector('p')?.textContent?.substring(0, 200);
      
      return metaDesc || ogDesc || firstP || 'No description available';
    };

    const getKeyPoints = (): string[] => {
      const points: string[] = [];
      
      // Extract from headings
      document.querySelectorAll('h2, h3, h4').forEach(heading => {
        const text = heading.textContent?.trim();
        if (text && text.length > 10 && text.length < 120) {
          points.push(text);
        }
      });

      // Extract from list items (content areas only)
      document.querySelectorAll('article li, main li, .content li').forEach(item => {
        const text = item.textContent?.trim();
        if (text && text.length > 15 && text.length < 150) {
          points.push(text);
        }
      });

      return [...new Set(points)].slice(0, 8);
    };

    const getBrandColors = (): { primary: string; secondary: string } => {
      const defaultColors = { primary: '#667eea', secondary: '#764ba2' };
      
      try {
        // Try theme color meta tag
        const themeColor = (document.querySelector('meta[name="theme-color"]') as HTMLMetaElement)?.content;
        if (themeColor) {
          return { primary: themeColor, secondary: defaultColors.secondary };
        }

        // Try CSS custom properties
        const rootStyles = getComputedStyle(document.documentElement);
        const primaryColor = rootStyles.getPropertyValue('--primary-color')?.trim() || 
                           rootStyles.getPropertyValue('--main-color')?.trim();
        
        if (primaryColor) {
          return { primary: primaryColor, secondary: defaultColors.secondary };
        }

        return defaultColors;
      } catch {
        return defaultColors;
      }
    };

    return {
      title: getTitle(),
      description: getDescription(),
      keyPoints: getKeyPoints(),
      url: window.location.href,
      images: [],
      brandColors: getBrandColors()
    };
  }

  /**
   * Gather user context from UI
   */
  private gatherUserContext(): UserContext {
    const state = stateManager.getState();
    const settings = state.userSettings;
    
    const contentContext = (document.querySelector('input[name="content-context"]:checked') as HTMLInputElement)?.value || 'found-interesting';
    const customContext = (document.getElementById('custom-context-text') as HTMLTextAreaElement)?.value || '';
    
    return {
      relationship: contentContext,
      personalStory: customContext,
      tone: settings.contentTone || 'professional',
      engagementFocus: settings.engagementFocus || 'viral',
      brandColors: settings.brandColors || { primary: '#667eea', secondary: '#764ba2' },
      companyName: settings.companyName || ''
    };
  }

  /**
   * Generate posts for all selected platforms
   */
  private async generatePostsForPlatforms(
    pageData: PageData, 
    context: UserContext, 
    platforms: Platform[]
  ): Promise<GeneratedPost[]> {
    const posts: GeneratedPost[] = [];

    for (const platform of platforms) {
      try {
        const post = await this.generatePostForPlatform(pageData, context, platform);
        if (post) {
          posts.push(post);
        }
      } catch (error) {
        logger.error(`Failed to generate post for ${platform}`, { platform }, this.component, error as Error);
        // Continue with other platforms
      }
    }

    return posts;
  }

  /**
   * Generate post for a specific platform
   */
  private async generatePostForPlatform(
    pageData: PageData,
    context: UserContext,
    platform: Platform
  ): Promise<GeneratedPost | null> {
    try {
      const prompt = this.createAIPrompt(pageData, context, platform);
      
      const params: AIGenerationParams = {
        inputs: prompt,
        parameters: {
          max_new_tokens: platform === 'twitter' ? 280 : 500,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
          repetition_penalty: 1.1,
          return_full_text: false
        }
      };

      // Check if we have a valid API token
      try {
        await TokenManager.getToken();
      } catch (error) {
        // For demo purposes, generate template content if no API token
        return this.generateTemplatePost(pageData, context, platform);
      }

      const content = await HuggingFaceService.generateText(prompt, params);
      const sanitizedContent = Sanitizer.sanitizePostContent(content, platform);
      
      if (!sanitizedContent) {
        throw new Error('Generated content was empty or invalid');
      }

      const post: GeneratedPost = {
        platform,
        content: sanitizedContent,
        charCount: sanitizedContent.length,
        wordCount: sanitizedContent.split(/\s+/).filter(word => word.length > 0).length,
        hashtags: this.extractHashtags(sanitizedContent),
        engagement: this.calculateEngagementScore(sanitizedContent, platform),
        source: 'ai'
      };

      logger.debug(`Generated post for ${platform}`, { 
        charCount: post.charCount, 
        wordCount: post.wordCount 
      }, this.component);

      return post;
    } catch (error) {
      logger.error(`Failed to generate AI post for ${platform}, falling back to template`, undefined, this.component, error as Error);
      return this.generateTemplatePost(pageData, context, platform);
    }
  }

  /**
   * Generate template post as fallback
   */
  private generateTemplatePost(
    pageData: PageData,
    context: UserContext,
    platform: Platform
  ): GeneratedPost {
    const templates = {
      linkedin: `🚀 Just discovered something fascinating: "${pageData.title}"

${pageData.description}

Key takeaways:
${pageData.keyPoints.slice(0, 3).map(point => `• ${point}`).join('\n')}

What are your thoughts on this? Have you experienced something similar?

#${platform} #innovation #insights

Read more: ${pageData.url}`,

      twitter: `🔥 Mind-blown by this: "${pageData.title}"

${pageData.keyPoints[0] || pageData.description.substring(0, 100)}...

Thoughts? 🤔

${pageData.url}`,

      instagram: `✨ Found something amazing today!

"${pageData.title}"

${pageData.description}

This really got me thinking about ${pageData.keyPoints[0] || 'innovation'}...

What's your take? Drop a comment! 👇

#inspiration #discovery #mindful

Link in bio: ${pageData.url}`,

      facebook: `Hey friends! 👋

I just came across this incredible piece: "${pageData.title}"

${pageData.description}

The main points that stood out to me:
${pageData.keyPoints.slice(0, 2).map(point => `• ${point}`).join('\n')}

I'd love to hear your thoughts on this! What do you think?

Read the full article: ${pageData.url}`
    };

    const content = templates[platform] || templates.linkedin;
    
    return {
      platform,
      content,
      charCount: content.length,
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
      hashtags: this.extractHashtags(content),
      engagement: this.calculateEngagementScore(content, platform),
      source: 'template'
    };
  }

  /**
   * Create AI prompt for content generation
   */
  private createAIPrompt(pageData: PageData, context: UserContext, platform: Platform): string {
    const platformSpecs = {
      linkedin: {
        tone: 'Professional but personal, thought-provoking',
        maxLength: '1300 characters',
        structure: 'Hook → Personal story → Key insights → Question for engagement → Hashtags'
      },
      twitter: {
        tone: 'Conversational, punchy, quotable',
        maxLength: '280 characters',
        structure: 'Strong hook → Key insight → Call to action'
      },
      instagram: {
        tone: 'Visual storytelling, inspirational',
        maxLength: '2200 characters',
        structure: 'Storytelling hook → Visual description → Lesson learned → Hashtags'
      },
      facebook: {
        tone: 'Conversational, community-focused',
        maxLength: '500 words',
        structure: 'Personal story → Broader implications → Question for community'
      }
    };

    const spec = platformSpecs[platform];
    const relationshipContext = {
      'own-work': 'I just published this and here\'s why it matters',
      'completed-project': 'Just wrapped up this project and the results are amazing',
      'work-showcase': 'Proud to share something I\'ve been working on',
      'found-interesting': 'This completely changed how I think about the topic',
      'learning-resource': 'I\'ve been diving deep into this and discovered something surprising',
      'client-work': 'Working with an amazing client taught me this valuable lesson',
      'custom': context.personalStory || 'Found something that challenged my assumptions'
    };

    const personalAngle = relationshipContext[context.relationship as keyof typeof relationshipContext] || relationshipContext['found-interesting'];

    return `Create a ${platform} social media post about: "${pageData.title}"

Content Summary: ${pageData.description}
Key Points: ${pageData.keyPoints.slice(0, 3).join(', ')}

Personal Context: ${personalAngle}
Content Tone: ${spec.tone} and ${context.tone}
Engagement Goal: ${context.engagementFocus}

Requirements:
- Maximum length: ${spec.maxLength}
- Include personal perspective and story
- Add specific actionable takeaway
- End with engaging question to spark discussion
- Include 2-3 relevant hashtags
- Include source link: ${pageData.url}
- Structure: ${spec.structure}

Write an engaging ${platform} post that follows these guidelines:`;
  }

  /**
   * Extract hashtags from content
   */
  private extractHashtags(content: string): string[] {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const matches = content.match(hashtagRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Calculate engagement score
   */
  private calculateEngagementScore(content: string, platform: Platform): number {
    let score = 0;

    // Length scoring
    const idealLengths = { linkedin: 150, twitter: 100, instagram: 300, facebook: 200 };
    const actualLength = content.length;
    const idealLength = idealLengths[platform];
    const lengthScore = Math.max(0, 100 - Math.abs(actualLength - idealLength) / idealLength * 100);
    score += lengthScore * 0.3;

    // Content features
    if (content.includes('?')) score += 20; // Questions
    if (/#\w+/.test(content)) score += 15; // Hashtags
    if (/\b(you|your|we|let's)\b/i.test(content)) score += 15; // Personal pronouns
    if (/[🎉🚀✨💡🔥👏💪🌟]/g.test(content)) score += 10; // Emojis

    return Math.min(100, Math.round(score));
  }

  /**
   * Handle Chrome extension messages
   */
  private async handleChromeMessage(
    message: ChromeMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      switch (message.action) {
        case 'generatePosts':
          // Trigger generation through UI
          const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
          if (generateBtn && !generateBtn.disabled) {
            generateBtn.click();
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Generation already in progress' });
          }
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      logger.error('Chrome message handler error', { action: message.action }, this.component, error as Error);
      sendResponse({ success: false, error: 'Internal error' });
    }
  }

  /**
   * Utility methods
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    MemoryManager.cleanup();
    uiController.destroy();
    logger.info('App controller destroyed', undefined, this.component);
  }
}

// Export singleton instance
export const appController = AppController.getInstance();