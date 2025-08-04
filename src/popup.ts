/**
 * Social Poster Chrome Extension - Main Entry Point
 * AI-Powered Social Media Content Generator with Advanced Web Analysis
 */
/// <reference types="chrome"/>

import { AdvancedWebCrawler } from './services/advancedWebCrawler';
import { MCPWebAnalyzer } from './services/mcpWebAnalyzer';
import { AIEnsembleService } from './services/aiEnsemble';
import { ContentAnalyzer } from './services/contentAnalyzer';
import { PromptOptimizer } from './services/promptOptimizer';

console.log('🎨 Social Poster v1.2.0 loading...');

// Simple state management
const appState = {
  currentTab: 'home',
  isLoading: false,
  error: null as string | null,
  selectedPlatforms: ['linkedin', 'twitter'] as string[],
  userPreferences: {
    minWords: 10,
    maxWords: 50,
    contentTone: 'professional',
    engagementFocus: 'viral',
    contentContext: 'found-interesting',
    customContext: '',
    followPageTheme: false,
    includeAnalysis: true
  }
};

// Simple logger
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context),
};

// Main application class
class SocialPosterApp {
  private readonly version = '2.0.0';
  private webCrawler: AdvancedWebCrawler;
  private mcpAnalyzer: MCPWebAnalyzer;
  private aiEnsemble: AIEnsembleService;
  private contentAnalyzer: ContentAnalyzer;
  private promptOptimizer: PromptOptimizer;

  constructor() {
    this.webCrawler = new AdvancedWebCrawler();
    this.mcpAnalyzer = new MCPWebAnalyzer();
    this.aiEnsemble = new AIEnsembleService();
    this.contentAnalyzer = new ContentAnalyzer();
    this.promptOptimizer = new PromptOptimizer();
    this.init();
  }

  private async init(): Promise<void> {
    try {
      logger.info(`Social Poster v${this.version} initializing`);
      
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
      }

      // Setup event listeners
      this.setupEventListeners();
      
      // Initialize UI
      this.initializeUI();
      
      // Initialize API token if not already set
      await this.initializeAPIToken();
      
      // Auto-fill current page
      await this.autoFillCurrentPage();
      
      logger.info(`Social Poster v${this.version} ready`);
      
    } catch (error) {
      logger.error('Failed to initialize', error);
      this.showError('Failed to initialize the extension. Please try refreshing.');
    }
  }

  private async initializeAPIToken(): Promise<void> {
    try {
      // Check if secure token already exists
      const { TokenManager } = await import('./services/api-service');
      
      try {
        await TokenManager.getToken();
        logger.info('Secure API token already configured');
      } catch (error) {
        // No token found - user needs to authenticate via OAuth
        logger.info('No API token found - OAuth authentication required');
        this.showAuthenticationRequired();
      }
    } catch (error) {
      logger.error('Failed to initialize API token system', error);
      this.showError('Authentication system initialization failed. Please reload the extension.');
    }
  }

  private showAuthenticationRequired(): void {
    const authSection = document.getElementById('auth-section');
    if (authSection) {
      authSection.classList.remove('hidden');
      authSection.innerHTML = `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-yellow-800">Authentication Required</h3>
              <div class="mt-2 text-sm text-yellow-700">
                <p>Please authenticate with HuggingFace to use AI features.</p>
              </div>
              <div class="mt-4">
                <button id="oauth-login-btn" class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
                  Connect HuggingFace Account
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Setup OAuth login handler
      const oauthBtn = document.getElementById('oauth-login-btn');
      oauthBtn?.addEventListener('click', () => this.initiateOAuthFlow());
    }
  }

  private async initiateOAuthFlow(): Promise<void> {
    try {
      const { HuggingFaceAuthManager } = await import('./services/secure-credential-manager');
      const authUrl = await HuggingFaceAuthManager.initiateOAuth();
      
      // Open OAuth flow in new tab
      chrome.tabs.create({ url: authUrl });
      
      logger.info('OAuth flow initiated');
    } catch (error) {
      logger.error('Failed to initiate OAuth flow', error);
      this.showError('Failed to start authentication. Please try again.');
    }
  }

  private setupEventListeners(): void {
    // Tab navigation
    const homeTab = document.getElementById('tab-home');
    const styleTab = document.getElementById('tab-style');
    const assetsTab = document.getElementById('tab-assets');

    homeTab?.addEventListener('click', () => this.switchTab('home'));
    styleTab?.addEventListener('click', () => this.switchTab('style'));
    assetsTab?.addEventListener('click', () => this.switchTab('assets'));

    // Current page button
    const currentPageBtn = document.getElementById('current-page-btn');
    currentPageBtn?.addEventListener('click', () => this.useCurrentPage());

    // Generate button
    const generateBtn = document.getElementById('generate-btn');
    generateBtn?.addEventListener('click', () => this.handleGenerate());

    // URL input validation
    const urlInput = document.getElementById('url-input') as HTMLInputElement;
    urlInput?.addEventListener('input', () => this.validateUrl());

    // Platform selection
    const platformInputs = document.querySelectorAll('input[name="platform"]');
    platformInputs.forEach(input => {
      input.addEventListener('change', () => this.updateSelectedPlatforms());
    });

    // Retry button
    const retryBtn = document.getElementById('retry-btn');
    retryBtn?.addEventListener('click', () => this.clearError());

    // API token management
    const saveTokenBtn = document.getElementById('save-token-btn');
    const testTokenBtn = document.getElementById('test-token-btn');
    
    saveTokenBtn?.addEventListener('click', () => this.saveAPIToken());
    testTokenBtn?.addEventListener('click', () => this.testAPIToken());
  }

  private initializeUI(): void {
    // Show home tab by default
    this.switchTab('home');
    
    // Update platform selection
    this.updateSelectedPlatforms();
  }

  private switchTab(tab: string): void {
    appState.currentTab = tab;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
      btn.classList.add('border-transparent', 'text-gray-500');
    });

    const activeTab = document.getElementById(`tab-${tab}`);
    if (activeTab) {
      activeTab.classList.add('active', 'border-blue-500', 'text-blue-600');
      activeTab.classList.remove('border-transparent', 'text-gray-500');
    }

    // Show corresponding content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });

    const content = document.getElementById(`${tab}-content`);
    if (content) {
      content.classList.remove('hidden');
    }

    // Hide loading and error states when switching tabs
    if (!appState.isLoading && !appState.error) {
      document.getElementById('loading')?.classList.add('hidden');
      document.getElementById('error')?.classList.add('hidden');
    }
  }

  private async useCurrentPage(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab?.url && currentTab.title) {
        const urlInput = document.getElementById('url-input') as HTMLInputElement;
        if (urlInput) {
          urlInput.value = currentTab.url;
          this.validateUrl();
        }
        logger.info('Current page URL set', { url: currentTab.url });
      }
    } catch (error) {
      logger.error('Failed to get current page', error);
      this.showError('Could not access current page. Please enter URL manually.');
    }
  }

  private validateUrl(): void {
    const urlInput = document.getElementById('url-input') as HTMLInputElement;
    const url = urlInput?.value.trim();
    
    if (url && this.isValidUrl(url)) {
      urlInput.classList.remove('border-red-300');
      urlInput.classList.add('border-green-300');
    } else if (url) {
      urlInput.classList.remove('border-green-300');
      urlInput.classList.add('border-red-300');
    } else {
      urlInput.classList.remove('border-red-300', 'border-green-300');
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private updateSelectedPlatforms(): void {
    const selected: string[] = [];
    document.querySelectorAll('input[name="platform"]:checked').forEach(input => {
      selected.push((input as HTMLInputElement).value);
    });
    appState.selectedPlatforms = selected;

    // Update platform card styling
    document.querySelectorAll('.platform-card').forEach(card => {
      const input = card.querySelector('input') as HTMLInputElement;
      const isChecked = input?.checked;
      
      card.classList.toggle('active', isChecked);
      const cardDiv = card.querySelector('div');
      if (cardDiv) {
        cardDiv.classList.toggle('border-blue-200', isChecked);
        cardDiv.classList.toggle('bg-blue-50', isChecked);
        cardDiv.classList.toggle('border-gray-200', !isChecked);
        cardDiv.classList.toggle('bg-white', !isChecked);
      }
    });
  }

  private async handleGenerate(): Promise<void> {
    const urlInput = document.getElementById('url-input') as HTMLInputElement;
    const url = urlInput?.value.trim();

    if (!url || !this.isValidUrl(url)) {
      this.showError('Please enter a valid URL');
      return;
    }

    if (appState.selectedPlatforms.length === 0) {
      this.showError('Please select at least one platform');
      return;
    }

    try {
      // Collect user preferences from UI
      this.collectUserPreferences();
      
      this.showLoading('Extracting page content...');
      
      // Extract page data
      const pageData = await this.extractPageData(url);
      
      this.showLoading('Analyzing content...');
      
      // Analyze the content with user preferences
      const analyzedData = await this.analyzePageContent(pageData);
      
      this.showLoading('Generating AI content...');
      
      // Generate content for each platform with analysis
      const generatedPosts = await this.generateContentForPlatforms(analyzedData, appState.selectedPlatforms);
      
      this.hideLoading();
      
      // Show results
      this.displayResults(generatedPosts);
      this.switchTab('assets');
      
      logger.info('Generation completed', { 
        url, 
        platforms: appState.selectedPlatforms, 
        postsGenerated: generatedPosts.length,
        preferences: appState.userPreferences
      });
      
    } catch (error) {
      this.hideLoading();
      logger.error('Generation failed', error);
      this.showError(error instanceof Error ? error.message : 'Failed to generate posts. Please try again.');
    }
  }

  private collectUserPreferences(): void {
    // Word limits
    const minWordsInput = document.getElementById('min-words') as HTMLInputElement;
    const maxWordsInput = document.getElementById('max-words') as HTMLInputElement;
    
    appState.userPreferences.minWords = parseInt(minWordsInput?.value || '10');
    appState.userPreferences.maxWords = parseInt(maxWordsInput?.value || '50');
    
    // Content tone and engagement
    const contentToneSelect = document.getElementById('content-tone') as HTMLSelectElement;
    const engagementFocusSelect = document.getElementById('engagement-focus') as HTMLSelectElement;
    
    appState.userPreferences.contentTone = contentToneSelect?.value || 'professional';
    appState.userPreferences.engagementFocus = engagementFocusSelect?.value || 'viral';
    
    // Content context
    const contextRadio = document.querySelector('input[name="content-context"]:checked') as HTMLInputElement;
    appState.userPreferences.contentContext = contextRadio?.value || 'found-interesting';
    
    const customContextText = document.getElementById('custom-context-text') as HTMLTextAreaElement;
    appState.userPreferences.customContext = customContextText?.value || '';
    
    // Options
    const followThemeCheckbox = document.getElementById('follow-page-theme') as HTMLInputElement;
    const includeAnalysisCheckbox = document.getElementById('include-analysis') as HTMLInputElement;
    
    appState.userPreferences.followPageTheme = followThemeCheckbox?.checked || false;
    appState.userPreferences.includeAnalysis = includeAnalysisCheckbox?.checked || true;
    
    logger.info('User preferences collected', appState.userPreferences);
  }

  private async analyzePageContent(pageData: any): Promise<any> {
    // Enhanced content analysis based on user preferences
    const analysis = {
      ...pageData,
      contentAnalysis: {
        mainTopic: this.extractMainTopic(pageData),
        contentType: this.determineContentType(pageData),
        keyInsights: this.extractKeyInsights(pageData),
        targetAudience: this.inferTargetAudience(pageData),
        emotionalTone: this.analyzeEmotionalTone(pageData),
        technicalLevel: this.assessTechnicalLevel(pageData)
      },
      userContext: appState.userPreferences
    };
    
    logger.info('Content analysis completed', analysis.contentAnalysis);
    return analysis;
  }

  private extractMainTopic(pageData: any): string {
    const title = pageData.title?.toLowerCase() || '';
    const description = pageData.description?.toLowerCase() || '';
    const text = title + ' ' + description;
    
    // Topic detection based on keywords
    const topics = {
      'AI/Machine Learning': ['ai', 'artificial intelligence', 'machine learning', 'neural', 'algorithm', 'deep learning'],
      'Technology': ['tech', 'software', 'programming', 'development', 'code', 'digital'],
      'Business': ['business', 'startup', 'entrepreneur', 'strategy', 'growth', 'revenue'],
      'Science': ['research', 'study', 'scientific', 'data', 'analysis', 'experiment'],
      'Education': ['learning', 'education', 'tutorial', 'guide', 'course', 'teach'],
      'Design': ['design', 'ui', 'ux', 'visual', 'creative', 'interface']
    };
    
    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return topic;
      }
    }
    
    return 'General';
  }

  private determineContentType(pageData: any): string {
    const title = pageData.title?.toLowerCase() || '';
    const keyPoints = pageData.keyPoints || [];
    
    if (title.includes('tutorial') || title.includes('guide') || title.includes('how to')) {
      return 'Tutorial/Guide';
    }
    if (keyPoints.length > 5 || title.includes('tips') || title.includes('best practices')) {
      return 'Listicle/Tips';
    }
    if (title.includes('review') || title.includes('comparison')) {
      return 'Review/Analysis';
    }
    if (title.includes('news') || title.includes('announcement') || title.includes('update')) {
      return 'News/Update';
    }
    
    return 'Article/Blog Post';
  }

  private extractKeyInsights(pageData: any): string[] {
    const keyPoints = this.filterValidKeyPoints(pageData.keyPoints || []);
    const description = pageData.description || '';
    
    // Extract insights from description if key points are limited
    if (keyPoints.length < 2 && description.length > 100) {
      const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 20);
      return sentences.slice(0, 3).map(s => s.trim()).concat(keyPoints).slice(0, 5);
    }
    
    return keyPoints;
  }

  private inferTargetAudience(pageData: any): string {
    const text = ((pageData.title || '') + ' ' + (pageData.description || '')).toLowerCase();
    
    if (text.match(/beginner|basic|introduction|getting started|101/)) {
      return 'Beginners';
    }
    if (text.match(/advanced|expert|professional|enterprise|senior/)) {
      return 'Advanced/Professional';
    }
    if (text.match(/developer|programmer|engineer|technical/)) {
      return 'Technical/Developers';
    }
    if (text.match(/business|executive|manager|leadership/)) {
      return 'Business/Leadership';
    }
    
    return 'General Audience';
  }

  private analyzeEmotionalTone(pageData: any): string {
    const text = ((pageData.title || '') + ' ' + (pageData.description || '')).toLowerCase();
    
    if (text.match(/amazing|incredible|revolutionary|breakthrough|game.?changer/)) {
      return 'Excited/Amazed';
    }
    if (text.match(/problem|issue|challenge|difficult|struggle/)) {
      return 'Problem-focused';
    }
    if (text.match(/solution|solve|fix|improve|better/)) {
      return 'Solution-oriented';
    }
    if (text.match(/future|trend|prediction|upcoming|next/)) {
      return 'Future-focused';
    }
    
    return 'Informative';
  }

  private assessTechnicalLevel(pageData: any): string {
    const text = ((pageData.title || '') + ' ' + (pageData.description || '')).toLowerCase();
    const technicalTerms = ['api', 'algorithm', 'framework', 'architecture', 'implementation', 'optimization'];
    
    const technicalCount = technicalTerms.filter(term => text.includes(term)).length;
    
    if (technicalCount >= 3) return 'High';
    if (technicalCount >= 1) return 'Medium';
    return 'Low';
  }

  private async extractPageData(url: string): Promise<any> {
    try {
      logger.info(`🚀 Using advanced MCP web analysis for: ${url}`);
      
      // Use advanced MCP analyzer for comprehensive content extraction
      const mcpResult = await this.mcpAnalyzer.processWebContent(url, {
        depth: 'comprehensive',
        platforms: appState.selectedPlatforms
      });
      
      if (mcpResult && mcpResult.content) {
        logger.info(`✅ MCP analysis successful:`, {
          confidence: mcpResult.confidence_score,
          wordCount: mcpResult.content.word_count,
          topics: mcpResult.semantics.topics?.primary_topic
        });
        
        return this.transformMCPResult(mcpResult);
      }
      
      // Fallback to advanced web crawler
      logger.warn('MCP analysis failed, trying advanced web crawler');
      const crawlerResult = await this.webCrawler.analyzeURL(url);
      
      if (crawlerResult && crawlerResult.content) {
        return this.transformCrawlerResult(crawlerResult);
      }
      
      // Final fallback to original method
      logger.warn('Advanced methods failed, using original extraction');
      return await this.originalExtractPageData(url);
      
    } catch (error) {
      logger.error('All advanced extraction methods failed', error);
      // Use original method as final fallback
      return await this.originalExtractPageData(url);
    }
  }

  private transformMCPResult(mcpResult: any): any {
    return {
      url: mcpResult.url,
      title: mcpResult.content.title,
      description: mcpResult.content.description || mcpResult.content.excerpt,
      keyPoints: mcpResult.content.keyPoints || [],
      images: mcpResult.content.images || [],
      brandColors: { primary: '#667eea', secondary: '#764ba2' },
      contentAnalysis: {
        mainTopic: mcpResult.semantics.topics?.primary_topic || 'Technology',
        contentType: this.mapContentType(mcpResult.semantics.intent?.primary),
        keyInsights: mcpResult.content.keyPoints || [],
        targetAudience: mcpResult.semantics.audience?.primary || 'general',
        emotionalTone: mcpResult.semantics.sentiment?.label || 'neutral',
        technicalLevel: mcpResult.semantics.semantic_features?.complexity_score > 0.7 ? 'High' : 'Medium',
        engagementPotential: mcpResult.semantics.semantic_features?.engagement_potential || 0.5,
        viralityFactors: mcpResult.social_insights?.linkedin?.virality_factors || []
      },
      mcpAnalysis: mcpResult, // Keep full MCP data for advanced features
      extractionMethod: 'mcp-advanced'
    };
  }

  private transformCrawlerResult(crawlerResult: any): any {
    return {
      url: crawlerResult.url || '',
      title: crawlerResult.title,
      description: crawlerResult.description,
      keyPoints: crawlerResult.keyPoints || [],
      images: crawlerResult.images || [],
      brandColors: { primary: '#667eea', secondary: '#764ba2' },
      contentAnalysis: crawlerResult.aiAnalysis || {
        mainTopic: 'Technology',
        contentType: 'Article',
        keyInsights: crawlerResult.keyPoints || [],
        targetAudience: 'general',
        emotionalTone: 'neutral'
      },
      extractionMethod: 'crawler-advanced'
    };
  }

  private mapContentType(intent: string): string {
    const mapping: { [key: string]: string } = {
      'educational': 'Tutorial/Guide',
      'promotional': 'Promotional',
      'informational': 'Article',
      'problem_solving': 'Solution/Guide',
      'entertainment': 'Entertainment'
    };
    return mapping[intent] || 'Article';
  }

  private async originalExtractPageData(url: string): Promise<any> {
    try {
      // Original extraction logic as fallback
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab?.url === url && currentTab.id) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            files: ['dist/content.js']
          });
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'extractPageData' });
          if (response?.success) {
            return response.data;
          }
        } catch (contentError) {
          logger.warn('Content script extraction failed', contentError);
        }
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeExternalUrl',
        data: { url }
      });
      
      if (response?.success) {
        return response.data;
      }
      
      throw new Error('Failed to extract page content');
    } catch (error) {
      logger.error('Original extraction failed', error);
      throw new Error('Could not analyze the webpage. Please try again.');
    }
  }

  private async generateContentForPlatforms(pageData: any, platforms: string[]): Promise<any[]> {
    const posts = [];
    
    for (const platform of platforms) {
      try {
        const content = await this.generatePlatformContent(pageData, platform);
        posts.push({
          platform,
          content,
          wordCount: content.split(' ').length,
          charCount: content.length
        });
      } catch (error) {
        logger.error(`Failed to generate content for ${platform}`, error);
        posts.push({
          platform,
          content: `Error generating content for ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          wordCount: 0,
          charCount: 0,
          error: true
        });
      }
    }
    
    return posts;
  }

  private async generatePlatformContent(pageData: any, platform: string): Promise<string> {
    try {
      logger.info(`🤖 Generating ${platform} content using AI ensemble approach`);
      
      // Use prompt optimizer to create the best possible prompt
      const optimizedPrompt = this.promptOptimizer.generateOptimizedPrompt(pageData, platform, appState.userPreferences);
      
      // Use AI ensemble for better reliability and quality
      const aiContent = await this.aiEnsemble.generateWithEnsemble(optimizedPrompt, {
        minWords: appState.userPreferences.minWords,
        maxWords: appState.userPreferences.maxWords,
        platform: platform,
        temperature: 0.8
      });
      
      if (aiContent && aiContent.length > 20) {
        // Record performance for continuous improvement
        const wordCount = aiContent.split(/\s+/).length;
        const isSuccessful = wordCount >= appState.userPreferences.minWords && wordCount <= appState.userPreferences.maxWords;
        this.promptOptimizer.recordPerformance(platform, isSuccessful, this.scoreContentQuality(aiContent));
        
        logger.info(`✅ AI ensemble generated ${platform} content:`, {
          wordCount,
          targetRange: `${appState.userPreferences.minWords}-${appState.userPreferences.maxWords}`,
          success: isSuccessful
        });
        
        return this.postProcessAIContent(aiContent, pageData, platform);
      }
      
      throw new Error('AI ensemble returned insufficient content');
      
    } catch (error) {
      logger.warn(`AI ensemble failed for ${platform}, using enhanced fallback`, error);
      
      // Use enhanced content analyzer for better fallback
      const enhancedData = this.contentAnalyzer.analyzeContent(pageData);
      const fallbackContent = await this.generateWithAdvancedAnalysis(enhancedData, platform);
      
      logger.info(`Enhanced fallback used for ${platform}, word count: ${fallbackContent.split(/\s+/).length}`);
      return fallbackContent;
    }
  }

  private scoreContentQuality(content: string): number {
    let score = 0;
    
    // Word count appropriateness
    const words = content.split(/\s+/).length;
    if (words >= appState.userPreferences.minWords && words <= appState.userPreferences.maxWords) {
      score += 0.4;
    }
    
    // Content variety
    const sentences = content.split(/[.!?]+/).length;
    if (sentences > 3) score += 0.2;
    
    // Engagement elements
    if (content.includes('?')) score += 0.2;
    if (/\b(insights?|key|important|valuable)\b/i.test(content)) score += 0.2;
    
    return Math.min(score, 1);
  }

  private async generateWithAdvancedAnalysis(enhancedData: any, platform: string): Promise<string> {
    // Use the enhanced analysis for much better fallback generation
    const analysis = enhancedData.enhancedAnalysis || enhancedData.contentAnalysis || {};
    const userPrefs = appState.userPreferences;
    
    logger.info(`🧠 Using advanced analysis for ${platform}:`, {
      topics: analysis.semanticTopics,
      sentiment: analysis.sentimentScore?.label,
      engagement: analysis.engagementPotential?.score
    });
    
    return this.createAdvancedAnalyzedPost(enhancedData, analysis, userPrefs, platform);
  }

  private createAdvancedAnalyzedPost(pageData: any, analysis: any, userPrefs: any, platform: string): string {
    const title = pageData.title || 'Interesting Content';
    const description = pageData.description || '';
    const insights = analysis.keyInsights || pageData.keyPoints || [];
    const url = pageData.url;
    
    // Use semantic topics for better content framing
    const semanticTopics = analysis.semanticTopics || ['Technology'];
    const primaryTopic = semanticTopics[0] || 'Technology';
    
    // Use sentiment analysis for appropriate tone
    const sentiment = analysis.sentimentScore?.label || 'neutral';
    const engagementScore = analysis.engagementPotential?.score || 0.5;
    
    logger.info(`Creating advanced post for ${platform}:`, {
      primaryTopic,
      sentiment,
      engagementScore,
      insightCount: insights.length
    });
    
    let post = this.getContextualOpening(userPrefs.contentContext, sentiment);
    post += ` ${title}\n\n${description}`;
    
    // Add comprehensive insights with semantic understanding
    if (insights.length > 0) {
      post += this.formatInsightsAdvanced(insights, platform, primaryTopic);
    }
    
    // Add semantic-aware commentary
    post += this.generateSemanticCommentary(analysis, platform, primaryTopic);
    
    // Add engagement-optimized question
    post += this.generateEngagementQuestion(analysis, platform);
    
    // Add semantic hashtags
    const hashtags = this.generateSemanticHashtags(analysis, title, description);
    post += `\n\n${hashtags}`;
    
    // Add URL with platform-specific formatting
    post += this.formatURLForPlatform(platform, url);
    
    // Enforce word count with intelligent expansion/trimming
    return this.enforceWordCountAdvanced(post, userPrefs, analysis, platform);
  }

  private getContextualOpening(context: string, sentiment: string): string {
    const openings = {
      'own-work': {
        'positive': 'Excited to share my latest work:',
        'negative': 'Lessons learned from my recent project:',
        'neutral': 'I recently completed:'
      },
      'found-interesting': {
        'positive': 'This completely fascinated me:',
        'negative': 'This raised important concerns:',
        'neutral': 'This caught my attention:'
      },
      'learning-resource': {
        'positive': 'Amazing learning resource:',
        'negative': 'Critical learning from this:',
        'neutral': 'Valuable educational content:'
      }
    };
    
    return openings[context as keyof typeof openings]?.[sentiment as keyof any] || 'This caught my attention:';
  }

  private formatInsightsAdvanced(insights: string[], platform: string, topic: string): string {
    const validInsights = insights
      .filter(insight => insight && insight.length > 10 && insight.length < 300)
      .map(insight => insight.trim())
      .filter(insight => !insight.includes('ReviewThe First') && !insight.includes('Site Explorer'))
      .slice(0, 5);
    
    if (validInsights.length === 0) return '';
    
    let section = '\n\n🎯 ';
    
    // Topic-specific framing
    if (topic.includes('SEO') || topic.includes('Marketing')) {
      section += 'Marketing insights from this analysis:\n';
    } else if (topic.includes('AI') || topic.includes('Technology')) {
      section += 'Technical insights worth noting:\n';
    } else if (topic.includes('Business')) {
      section += 'Business implications to consider:\n';
    } else {
      section += 'Key takeaways from this content:\n';
    }
    
    validInsights.forEach((insight, i) => {
      section += `${i + 1}️⃣ ${insight}\n`;
    });
    
    return section;
  }

  private generateSemanticCommentary(analysis: any, platform: string, topic: string): string {
    const contentDepth = analysis.contentDepth?.score || 0.5;
    const readability = analysis.readabilityScore || 0.5;
    const viralityFactors = analysis.viralityFactors?.factors || [];
    
    let commentary = '\n\n';
    
    if (contentDepth > 0.7) {
      commentary += `The depth of analysis in this ${topic.toLowerCase()} piece is particularly impressive. `;
    }
    
    if (readability > 0.7) {
      commentary += `Despite covering complex topics, it remains highly accessible and actionable. `;
    }
    
    if (viralityFactors.includes('data-driven')) {
      commentary += `The data-driven approach adds significant credibility to the insights presented. `;
    }
    
    if (platform === 'linkedin') {
      commentary += `This type of content demonstrates the evolution in ${topic.toLowerCase()} thinking and offers practical value for professionals in the field.`;
    } else if (platform === 'twitter') {
      commentary += `Essential reading for anyone working in ${topic.toLowerCase()}.`;
    } else {
      commentary += `The practical applications of these insights make this a valuable resource.`;
    }
    
    return commentary;
  }

  private generateEngagementQuestion(analysis: any, platform: string): string {
    const contentType = analysis.contentType || 'article';
    const targetAudience = analysis.targetAudience || 'general';
    const engagementPotential = analysis.engagementPotential?.score || 0.5;
    
    const questions = {
      'linkedin': {
        'high_engagement': [
          'What\'s been your experience with approaches like this?',
          'How do you see this impacting our industry moving forward?',
          'Which of these insights aligns most with your professional experience?'
        ],
        'medium_engagement': [
          'What are your thoughts on this perspective?',
          'Have you encountered similar challenges in your work?',
          'How does this compare to your experience in the field?'
        ]
      },
      'twitter': {
        'high_engagement': [
          'Thoughts? 👇',
          'Anyone else seeing this trend?',
          'What\'s your take on this?'
        ],
        'medium_engagement': [
          'Agree or disagree?',
          'Your thoughts?',
          'Worth discussing?'
        ]
      }
    };
    
    const platformQuestions = questions[platform as keyof typeof questions] || questions.linkedin;
    const engagementLevel = engagementPotential > 0.6 ? 'high_engagement' : 'medium_engagement';
    const questionSet = platformQuestions[engagementLevel as keyof typeof platformQuestions] || platformQuestions.medium_engagement;
    
    const randomQuestion = questionSet[Math.floor(Math.random() * questionSet.length)];
    
    return `\n\n💬 ${randomQuestion}`;
  }

  private generateSemanticHashtags(analysis: any, title: string, description: string): string {
    const content = (title + ' ' + description).toLowerCase();
    const semanticTopics = analysis.semanticTopics || [];
    const hashtags = new Set<string>();
    
    // Topic-based hashtags
    if (semanticTopics.includes('SEO/Marketing') || content.includes('seo') || content.includes('ahrefs')) {
      hashtags.add('#SEO');
      hashtags.add('#DigitalMarketing');
      hashtags.add('#ContentStrategy');
      if (content.includes('ahrefs')) hashtags.add('#Ahrefs');
    }
    
    if (semanticTopics.includes('AI/ML') || content.includes('ai') || content.includes('machine learning')) {
      hashtags.add('#AI');
      hashtags.add('#MachineLearning');
      hashtags.add('#ArtificialIntelligence');
    }
    
    if (semanticTopics.includes('Technology')) {
      hashtags.add('#Technology');
      hashtags.add('#TechTrends');
      hashtags.add('#Innovation');
    }
    
    if (semanticTopics.includes('Business')) {
      hashtags.add('#Business');
      hashtags.add('#Strategy');
      hashtags.add('#Growth');
    }
    
    // Content type specific
    if (content.includes('review')) hashtags.add('#ProductReview');
    if (content.includes('tutorial') || content.includes('guide')) hashtags.add('#Tutorial');
    if (content.includes('tips')) hashtags.add('#Tips');
    
    // Always add professional hashtags
    hashtags.add('#ProfessionalDevelopment');
    hashtags.add('#Learning');
    
    return Array.from(hashtags).slice(0, 8).join(' ');
  }

  private enforceWordCountAdvanced(content: string, userPrefs: any, analysis: any, platform: string): string {
    let words = content.split(/\s+/).filter(w => w.length > 0);
    let wordCount = words.length;
    
    logger.info(`Advanced word count enforcement:`, {
      current: wordCount,
      target: `${userPrefs.minWords}-${userPrefs.maxWords}`,
      platform
    });
    
    // If too short, add intelligent expansions based on analysis
    if (wordCount < userPrefs.minWords) {
      const wordsNeeded = userPrefs.minWords - wordCount;
      content = this.expandWithSemanticContent(content, analysis, platform, wordsNeeded);
      words = content.split(/\s+/).filter(w => w.length > 0);
      wordCount = words.length;
    }
    
    // If still too short, add professional context
    if (wordCount < userPrefs.minWords) {
      content = this.addProfessionalContext(content, analysis, platform);
      words = content.split(/\s+/).filter(w => w.length > 0);
      wordCount = words.length;
    }
    
    // If too long, trim intelligently
    if (wordCount > userPrefs.maxWords) {
      content = this.trimContentAdvanced(content, userPrefs.maxWords, analysis);
    }
    
    const finalWordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    logger.info(`Final word count: ${finalWordCount} (target: ${userPrefs.minWords}-${userPrefs.maxWords})`);
    
    return content;
  }

  private expandWithSemanticContent(content: string, analysis: any, platform: string, wordsNeeded: number): string {
    const semanticTopics = analysis.semanticTopics || [];
    const primaryTopic = semanticTopics[0] || 'Technology';
    
    const expansions = {
      'SEO/Marketing': [
        'The SEO landscape continues to evolve rapidly, making insights like these crucial for staying competitive.',
        'Understanding these marketing dynamics is essential for anyone building an online presence.',
        'These strategies reflect current best practices in digital marketing and content optimization.'
      ],
      'AI/ML': [
        'The artificial intelligence field is advancing at an unprecedented pace, making this analysis particularly timely.',
        'Machine learning applications continue to transform industries, and understanding these trends is vital.',
        'The implications of AI development extend far beyond technology into business strategy and innovation.'
      ],
      'Technology': [
        'Technology trends like these shape how we approach innovation and digital transformation.',
        'The rapid pace of technological change makes staying informed about developments like this essential.',
        'Understanding these technological shifts helps professionals adapt and thrive in evolving markets.'
      ],
      'Business': [
        'Business strategies that incorporate these insights often outperform traditional approaches.',
        'The business implications of these findings extend across multiple industries and sectors.',
        'Strategic thinking around these concepts can drive significant competitive advantages.'
      ]
    };
    
    const topicExpansions = expansions[primaryTopic as keyof typeof expansions] || expansions.Technology;
    
    let addedWords = 0;
    for (const expansion of topicExpansions) {
      if (addedWords >= wordsNeeded) break;
      
      const expansionWordCount = expansion.split(/\s+/).length;
      if (addedWords + expansionWordCount <= wordsNeeded + 10) {
        content += `\n\n${expansion}`;
        addedWords += expansionWordCount;
      }
    }
    
    return content;
  }

  private addProfessionalContext(content: string, analysis: any, platform: string): string {
    const targetAudience = analysis.targetAudience || 'general';
    
    const contexts = {
      'professionals': 'This type of professional insight drives informed decision-making and strategic planning across organizations.',
      'developers': 'Technical professionals will find these insights particularly valuable for their development practices and architectural decisions.',
      'marketers': 'Marketing professionals can leverage these insights to enhance their campaign effectiveness and audience engagement strategies.',
      'general': 'These insights offer valuable perspectives that can inform better decision-making across various professional contexts.'
    };
    
    const context = contexts[targetAudience as keyof typeof contexts] || contexts.general;
    
    return content + `\n\n${context}`;
  }

  private trimContentAdvanced(content: string, maxWords: number, analysis: any): string {
    // Smart trimming that preserves key insights and engagement elements
    const sections = content.split('\n\n');
    let trimmedContent = '';
    let wordCount = 0;
    
    // Always keep title and description
    if (sections.length > 0) {
      trimmedContent = sections[0];
      wordCount = trimmedContent.split(/\s+/).length;
    }
    
    // Add sections in order of importance
    const sectionPriority = [
      { pattern: /🎯.*insights?/i, weight: 1.0 },
      { pattern: /💬/i, weight: 0.8 },
      { pattern: /#\w+/i, weight: 0.6 },
      { pattern: /🔗/i, weight: 0.9 }
    ];
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const sectionWords = section.split(/\s+/).length;
      
      if (wordCount + sectionWords <= maxWords - 5) {
        trimmedContent += `\n\n${section}`;
        wordCount += sectionWords;
      }
    }
    
    return trimmedContent.trim();
  }

  private createIntelligentPrompt(pageData: any, platform: string): string {
    const analysis = pageData.contentAnalysis || {};
    const userPrefs = pageData.userContext || appState.userPreferences;
    
    const platformSpecs = {
      twitter: { limit: 280, style: 'concise, punchy, attention-grabbing' },
      linkedin: { limit: 1300, style: 'professional, insightful, thought-leadership' },
      instagram: { limit: 2200, style: 'visual, engaging, lifestyle-oriented' },
      facebook: { limit: 2000, style: 'conversational, story-driven, community-focused' }
    };
    
    const spec = platformSpecs[platform as keyof typeof platformSpecs] || platformSpecs.twitter;
    
    const contextualPrompt = this.getContextualPrompt(userPrefs.contentContext, userPrefs.customContext);
    
    // Filter out duplicate or navigation-like insights
    const cleanInsights = this.filterValidKeyPoints(analysis.keyInsights || pageData.keyPoints || []);
    
    return `You are an expert social media content creator specialized in creating engaging, authentic posts.

Create a ${platform} post about this article:

ARTICLE DETAILS:
- Title: "${pageData.title}"
- Topic: ${analysis.mainTopic || 'Technology'}
- Type: ${analysis.contentType || 'Article'}
- URL: ${pageData.url}

CONTENT SUMMARY:
${pageData.description || 'No description available'}

KEY INSIGHTS:
${cleanInsights.length > 0 ? cleanInsights.slice(0, 5).map((insight: string, i: number) => `${i + 1}. ${insight}`).join('\n') : '1. Main topic discussed in the article'}

CONTEXT: ${contextualPrompt}

CRITICAL REQUIREMENTS:
1. WORD COUNT: Your response must be exactly ${userPrefs.minWords} to ${userPrefs.maxWords} words. This is mandatory.
2. TONE: Write in ${userPrefs.contentTone} tone
3. FOCUS: Emphasize ${userPrefs.engagementFocus === 'viral' ? 'shareable, viral content' : userPrefs.engagementFocus}
4. PLATFORM: For ${platform}, use ${spec.style} writing style
5. CHARACTER LIMIT: Stay under ${spec.limit} characters total
6. URL: Include the URL at the end
${platform === 'linkedin' ? '7. Add a thought-provoking question to encourage discussion' : ''}
${platform === 'instagram' ? '7. Include relevant hashtags at the end' : ''}
${platform === 'twitter' ? '7. Make it punchy and shareable with impact' : ''}

Write the post now. Make it sound authentic and human, as if genuinely excited to share this valuable content:`;
  }

  private getContextualPrompt(contentContext: string, customContext: string): string {
    if (contentContext === 'custom' && customContext) {
      return customContext;
    }
    
    const contextMap = {
      'own-work': 'This is my own work that I want to share with my network',
      'completed-project': 'This is a project I recently completed and want to showcase',
      'work-showcase': 'This represents work I want to highlight in my portfolio',
      'found-interesting': 'I found this content valuable and want to share insights with my network',
      'learning-resource': 'I learned something new from this and want to share the knowledge',
      'client-work': 'This is work done for a client/team that I want to highlight'
    };
    
    return contextMap[contentContext as keyof typeof contextMap] || contextMap['found-interesting'];
  }

  private async callImprovedHuggingFaceAPI(prompt: string, platform: string): Promise<string> {
    try {
      const hasToken = await this.checkAPIToken();
      if (!hasToken) {
        throw new Error('HuggingFace API token not configured');
      }

      const userPrefs = appState.userPreferences;
      
      // Enhanced prompt with stronger word count enforcement
      const enhancedPrompt = `${prompt}

CRITICAL WORD COUNT REQUIREMENT:
- Your response MUST contain exactly ${userPrefs.minWords} to ${userPrefs.maxWords} words
- Count each word carefully before responding
- If your response has fewer than ${userPrefs.minWords} words, add more relevant content
- If your response has more than ${userPrefs.maxWords} words, trim it down
- Do not include word count explanations in your response
- This requirement is mandatory and non-negotiable`;

      // Try different models with better instruction following
      const models = [
        'Qwen/Qwen2.5-Coder-32B-Instruct',
        'mistralai/Mixtral-8x7B-Instruct-v0.1', 
        'microsoft/DialoGPT-large',
        'HuggingFaceH4/zephyr-7b-beta'
      ];

      for (let i = 0; i < models.length; i++) {
        const model = models[i];
        try {
          logger.info(`Trying model: ${model}`);
          
          const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${await this.getAPIToken()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: enhancedPrompt,
              parameters: {
                max_new_tokens: Math.min(userPrefs.maxWords * 8, 3000), // More tokens for better control
                min_length: userPrefs.minWords * 4, // Minimum tokens to encourage longer responses
                temperature: 0.7,
                do_sample: true,
                top_p: 0.9,
                top_k: 40,
                repetition_penalty: 1.05,
                return_full_text: false,
                stop: ['<|endoftext|>', '\n\n---', 'Human:', 'Assistant:']
              }
            })
          });

          if (response.ok) {
            const result = await response.json();
            let content = '';
            
            if (Array.isArray(result) && result[0]?.generated_text) {
              content = result[0].generated_text;
            } else if (result.generated_text) {
              content = result.generated_text;
            }

            if (content && content.length > 20) {
              // Clean and validate content
              content = this.cleanAIResponse(content, enhancedPrompt);
              const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
              
              logger.info(`Model ${model} generated content:`, { 
                wordCount, 
                charCount: content.length,
                target: `${userPrefs.minWords}-${userPrefs.maxWords} words`
              });

              // Check if word count is acceptable (allow some tolerance) 
              if (wordCount >= userPrefs.minWords * 0.6 && wordCount <= userPrefs.maxWords * 1.5) {
                return content;
              } else {
                logger.warn(`Word count ${wordCount} outside acceptable range (${userPrefs.minWords}-${userPrefs.maxWords}), trying next model`);
              }
            }
          } else {
            logger.warn(`Model ${model} failed:`, response.status);
          }
        } catch (modelError) {
          logger.warn(`Model ${model} error:`, modelError);
          continue;
        }
      }

      throw new Error('All models failed to generate acceptable content');
    } catch (error) {
      logger.error('Improved HuggingFace API failed:', error);
      throw error;
    }
  }

  private cleanAIResponse(content: string, originalPrompt: string): string {
    // Remove the original prompt if it was accidentally included
    if (content.includes('CRITICAL WORD COUNT REQUIREMENT')) {
      const lines = content.split('\n');
      const cleanLines = [];
      let skipMode = false;
      
      for (const line of lines) {
        if (line.includes('CRITICAL WORD COUNT REQUIREMENT') || 
            line.includes('Your response MUST contain') ||
            line.includes('Count each word carefully')) {
          skipMode = true;
          continue;
        }
        if (skipMode && line.trim() === '') {
          skipMode = false;
          continue;
        }
        if (!skipMode) {
          cleanLines.push(line);
        }
      }
      
      content = cleanLines.join('\n').trim();
    }

    // Remove system markers and artifacts
    content = content.replace(/<\|system\|>|<\|user\|>|<\|assistant\|>/g, '');
    content = content.replace(/^(Human:|Assistant:|User:|AI:|Bot:).*$/gm, '');
    content = content.replace(/^\s*[-*]\s*/gm, ''); // Remove bullet points at start
    
    // Clean up extra whitespace
    content = content.replace(/\n{3,}/g, '\n\n');
    content = content.replace(/\s+/g, ' ');
    
    return content.trim();
  }

  private async callHuggingFaceAPI(prompt: string, platform: string): Promise<string> {
    try {
      // Check if we have API token configured
      const hasToken = await this.checkAPIToken();
      if (!hasToken) {
        throw new Error('HuggingFace API token not configured');
      }
      
      // Use a better model for content generation
      const modelUrl = 'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1';
      
      // Calculate appropriate max_new_tokens based on word limits
      const userPrefs = appState.userPreferences;
      const avgCharsPerWord = 5;
      const maxChars = userPrefs.maxWords * avgCharsPerWord * 1.5; // Buffer for variance
      
      const response = await fetch(modelUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAPIToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: Math.min(maxChars, 1000),
            temperature: 0.8,
            do_sample: true,
            top_p: 0.95,
            repetition_penalty: 1.1,
            return_full_text: false
          }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('API response error', { status: response.status, error: errorText });
        
        // Try fallback model if main model fails
        if (response.status === 503 || response.status === 500) {
          return this.callFallbackModel(prompt, platform);
        }
        
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const result = await response.json();
      return result[0]?.generated_text || '';
      
    } catch (error) {
      logger.error('HuggingFace API call failed', error);
      throw error;
    }
  }
  
  private async callFallbackModel(prompt: string, platform: string): Promise<string> {
    try {
      // Fallback to a simpler model
      const response = await fetch('https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAPIToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            do_sample: true,
            top_p: 0.9
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Fallback API failed: ${response.status}`);
      }
      
      const result = await response.json();
      return result[0]?.generated_text || '';
    } catch (error) {
      logger.error('Fallback model also failed', error);
      throw error;
    }
  }

  private async checkAPIToken(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(['hf_api_token']);
      return !!result.hf_api_token;
    } catch {
      return false;
    }
  }

  private async getAPIToken(): Promise<string> {
    try {
      const result = await chrome.storage.local.get(['hf_api_token']);
      return result.hf_api_token || '';
    } catch {
      return '';
    }
  }

  private postProcessAIContent(aiContent: string, pageData: any, platform: string): string {
    // Clean up AI generated content
    let content = aiContent.trim();
    
    // Remove any system/user/assistant markers if present
    content = content.replace(/<\|system\|>|<\|user\|>|<\|assistant\|>/g, '').trim();
    
    // Remove the prompt if accidentally included
    if (content.includes('Create a') && content.includes('post')) {
      const postStartIndex = content.indexOf('\n');
      if (postStartIndex > 0) {
        content = content.substring(postStartIndex + 1).trim();
      }
    }
    
    // Ensure URL is included properly
    const url = pageData.url;
    const urlText = this.formatURLForPlatform(platform, url);
    
    // Remove existing URL if present to avoid duplication
    const urlPattern = new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    content = content.replace(urlPattern, '').trim();
    
    // Enforce word count limits STRICTLY
    const userPrefs = appState.userPreferences;
    content = this.enforceWordLimits(content, userPrefs, pageData, platform);
    
    // Add URL at the end
    content += `\n\n${urlText}`;
    
    // Final cleanup
    content = content.replace(/\n{3,}/g, '\n\n'); // Remove excessive line breaks
    content = content.replace(/\s+/g, ' '); // Normalize spaces except newlines
    content = content.replace(/\n /g, '\n'); // Remove space after newlines
    content = content.trim();
    
    return content;
  }

  private enforceWordLimits(content: string, userPrefs: any, pageData: any, platform: string): string {
    let words = content.split(/\s+/).filter(word => word.length > 0);
    let wordCount = words.length;
    
    logger.info(`Current word count: ${wordCount}, target: ${userPrefs.minWords}-${userPrefs.maxWords}`);
    
    // If too short, expand with meaningful content
    if (wordCount < userPrefs.minWords) {
      const wordsNeeded = userPrefs.minWords - wordCount;
      content = this.expandContent(content, pageData, platform, wordsNeeded);
      words = content.split(/\s+/).filter(word => word.length > 0);
      wordCount = words.length;
    }
    
    // If still too short after expansion, add more context
    if (wordCount < userPrefs.minWords) {
      const extraWordsNeeded = userPrefs.minWords - wordCount;
      content = this.addContextualExpansion(content, pageData, platform, extraWordsNeeded);
      words = content.split(/\s+/).filter(word => word.length > 0);
      wordCount = words.length;
    }
    
    // If too long, trim intelligently
    if (wordCount > userPrefs.maxWords) {
      content = this.trimContent(content, userPrefs.maxWords);
    }
    
    return content;
  }

  private expandContent(content: string, pageData: any, platform: string, wordsNeeded: number): string {
    const insights = pageData.contentAnalysis?.keyInsights || pageData.keyPoints || [];
    const description = pageData.description || '';
    
    let expansion = '';
    
    if (platform === 'linkedin' && insights.length > 0) {
      expansion = '\n\nWhat makes this particularly compelling:\n';
      insights.slice(0, 3).forEach((insight: string, i: number) => {
        expansion += `• ${insight}\n`;
      });
    } else if (platform === 'twitter' && description.length > 50) {
      const shortDesc = description.substring(0, Math.min(100, wordsNeeded * 6));
      expansion = `\n\nKey insight: ${shortDesc}${shortDesc.length < description.length ? '...' : ''}`;
    } else if (insights.length > 0) {
      expansion = '\n\nCore insights: ';
      expansion += insights.slice(0, Math.min(3, Math.ceil(wordsNeeded / 15))).join('. ') + '.';
    } else if (description.length > 50) {
      const descWords = description.split(' ').slice(0, wordsNeeded).join(' ');
      expansion = `\n\nThis explores ${descWords}${description.split(' ').length > wordsNeeded ? '...' : ''}`;
    }
    
    return content + expansion;
  }

  private addContextualExpansion(content: string, pageData: any, platform: string, wordsNeeded: number): string {
    const expansions = {
      linkedin: [
        'This approach addresses critical challenges in the current landscape and offers practical solutions.',
        'The methodology presented here represents a significant advancement in industry best practices.',
        'What\'s particularly noteworthy is how this framework can be adapted across different organizational contexts.',
        'The implications of this strategy extend far beyond immediate applications to long-term strategic planning.'
      ],
      twitter: [
        'This is exactly the kind of insight the industry needs right now.',
        'Game-changing perspective that challenges conventional thinking.',
        'Must-read for anyone serious about staying ahead of the curve.',
        'The data behind this conclusion is absolutely compelling.'
      ],
      instagram: [
        'This completely changed how I think about the subject and opened up new possibilities.',
        'The visual representation of these concepts makes complex ideas incredibly accessible.',
        'Saving this for future reference because the actionable insights are pure gold.',
        'The storytelling approach here makes difficult concepts easy to understand and apply.'
      ],
      facebook: [
        'This resonated deeply with my own experiences and challenges in this area.',
        'The community discussion around this topic has been incredibly enlightening and thought-provoking.',
        'What started as curiosity turned into a comprehensive understanding of the subject.',
        'The practical applications of this knowledge are immediately apparent and highly valuable.'
      ]
    };
    
    const platformExpansions = expansions[platform as keyof typeof expansions] || expansions.linkedin;
    
    let expansion = '';
    let addedWords = 0;
    
    for (const exp of platformExpansions) {
      if (addedWords >= wordsNeeded) break;
      const expWords = exp.split(' ').length;
      if (addedWords + expWords <= wordsNeeded + 5) { // Small buffer
        expansion += `\n\n${exp}`;
        addedWords += expWords;
      }
    }
    
    return content + expansion;
  }

  private trimContent(content: string, maxWords: number): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let trimmedContent = '';
    let wordCount = 0;
    
    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 0);
      if (wordCount + sentenceWords.length <= maxWords - 5) { // Leave room for final punctuation
        trimmedContent += sentence.trim() + '. ';
        wordCount += sentenceWords.length;
      } else {
        // Try to fit partial sentence if we're very close to limit
        const remainingWords = maxWords - wordCount - 2;
        if (remainingWords >= 5) {
          const partialSentence = sentenceWords.slice(0, remainingWords).join(' ');
          trimmedContent += partialSentence + '...';
        }
        break;
      }
    }
    
    return trimmedContent.trim();
  }

  private formatURLForPlatform(platform: string, url: string): string {
    const symbols = {
      twitter: '🔗',
      linkedin: '🔗 Read more:',
      instagram: '🔗 Link in bio for full article',
      facebook: '📖 Full article:'
    };
    
    const symbol = symbols[platform as keyof typeof symbols] || '🔗';
    return `${symbol} ${url}`;
  }

  private async generateWithAnalysis(pageData: any, platform: string): Promise<string> {
    // Enhanced generation using the content analysis instead of basic templates
    const analysis = pageData.contentAnalysis || {};
    const userPrefs = pageData.userContext || appState.userPreferences;
    
    return this.createAnalyzedPost(pageData, analysis, userPrefs, platform);
  }

  private createAnalyzedPost(pageData: any, analysis: any, userPrefs: any, platform: string): string {
    const title = pageData.title || 'Interesting Content';
    const description = pageData.description || '';
    const insights = analysis.keyInsights || [];
    const url = pageData.url;
    
    // Customize based on content analysis
    const toneMap = {
      'Excited/Amazed': ['🤯', '🚀', '🔥'],
      'Problem-focused': ['⚠️', '🎯', '💡'],
      'Solution-oriented': ['✅', '🛠️', '💡'],
      'Future-focused': ['🔮', '📈', '🚀'],
      'Informative': ['📚', '💡', '🧠']
    };
    
    const emojis = toneMap[analysis.emotionalTone as keyof typeof toneMap] || ['💡'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    // Create contextual opening based on user's relationship to content
    const contextOpenings = {
      'own-work': ['Just published:', 'Excited to share:', 'I wrote about:'],
      'completed-project': ['Project complete!', 'Just finished:', 'Proud to share:'],
      'work-showcase': ['Portfolio highlight:', 'Work showcase:', 'Recent project:'],
      'found-interesting': ['Fascinating read:', 'This caught my attention:', 'Worth sharing:'],
      'learning-resource': ['Great learning:', 'TIL from this:', 'Educational content:'],
      'client-work': ['Client work highlight:', 'Team project:', 'Collaborative work:']
    };
    
    const openings = contextOpenings[userPrefs.contentContext as keyof typeof contextOpenings] || contextOpenings['found-interesting'];
    const opening = openings[Math.floor(Math.random() * openings.length)];
    
    // Generate platform-specific content with analysis
    switch (platform) {
      case 'twitter':
        return this.createAnalyzedTwitterPost(title, description, insights, url, randomEmoji, opening, userPrefs);
      case 'linkedin':
        return this.createAnalyzedLinkedInPost(title, description, insights, url, analysis, opening, userPrefs);
      case 'instagram':
        return this.createAnalyzedInstagramPost(title, description, insights, url, analysis, randomEmoji, userPrefs);
      case 'facebook':
        return this.createAnalyzedFacebookPost(title, description, insights, url, analysis, userPrefs);
      default:
        return `${opening} ${title}\n\n${description}\n\n🔗 ${url}`;
    }
  }

  private createAnalyzedTwitterPost(title: string, description: string, insights: string[], url: string, emoji: string, opening: string, userPrefs: any): string {
    let post = `${emoji} ${opening} ${title}`;
    
    const remainingChars = 280 - post.length - url.length - 10; // Buffer for spacing
    
    if (insights.length > 0 && remainingChars > 50) {
      const insight = insights[0];
      const maxInsightLength = Math.min(remainingChars - 10, insight.length);
      post += `\n\n${insight.substring(0, maxInsightLength)}${insight.length > maxInsightLength ? '...' : ''}`;
    } else if (remainingChars > 30) {
      const maxDescLength = Math.min(remainingChars - 10, description.length);
      post += `\n\n${description.substring(0, maxDescLength)}${description.length > maxDescLength ? '...' : ''}`;
    }
    
    post += `\n\n🔗 ${url}`;
    return post;
  }

  private createAnalyzedLinkedInPost(title: string, description: string, insights: string[], url: string, analysis: any, opening: string, userPrefs: any): string {
    let post = `${opening} ${title}\n\n${description}`;
    
    // Add comprehensive insights if available
    if (insights.length > 0) {
      post += '\n\n🎯 Key takeaways from this article:\n';
      // Show insights with proper validation and cleaning
      const validInsights = insights
        .filter((insight, i) => i < 5 && insight && insight.length > 10 && insight.length < 300)
        .map(insight => insight.trim())
        .filter(insight => !insight.includes('ReviewThe First') && !insight.includes('Site Explorer')); // Filter corrupted content
      
      validInsights.forEach((insight, i) => {
        post += `${i + 1}️⃣ ${insight}\n`;
      });
    }
    
    // Add meaningful analysis-based commentary to increase word count
    const contentType = analysis.contentType || 'review';
    const topic = analysis.mainTopic || 'SEO and digital marketing';
    
    post += `\n\nWhat makes this ${contentType.toLowerCase()} particularly valuable is its practical approach to ${topic.toLowerCase()}. `;
    
    if (title.toLowerCase().includes('ahrefs')) {
      post += `For anyone considering Ahrefs as their SEO tool, this analysis cuts through the marketing hype to show real pros and cons. `;
    } else if (analysis.targetAudience && analysis.targetAudience !== 'General Audience') {
      post += `The insights are especially relevant for ${analysis.targetAudience.toLowerCase()} looking to make informed decisions. `;
    }
    
    // Add substantive reflection to meet word count
    const reflections = {
      'Review/Analysis': 'What struck me most about this analysis is how it challenges conventional thinking while providing practical, actionable insights. The comprehensive approach to evaluating both strengths and limitations makes this an essential read for anyone serious about making informed decisions in this space.',
      'Tutorial/Guide': 'This guide breaks down complex concepts into manageable steps that anyone can follow. The practical examples and clear explanations make it accessible even for beginners, while the advanced tips provide value for experienced practitioners looking to refine their approach.',
      'Listicle/Tips': 'These insights represent years of accumulated wisdom distilled into actionable advice. Each point builds upon the previous one, creating a comprehensive framework for success. The real-world applications of these tips can lead to significant improvements in outcomes.',
      'News/Update': 'This development signals an important shift in the industry landscape. Understanding these changes and their implications is crucial for staying ahead of the curve. The ripple effects of this update will likely influence strategies and decision-making across the sector.'
    };
    
    const reflection = reflections[analysis.contentType as keyof typeof reflections] || 
      'The depth of analysis presented here offers valuable perspectives that challenge our assumptions and expand our understanding. This is the kind of content that drives meaningful conversations and inspires innovative thinking.';
    
    post += `\n\n${reflection}`;
    
    // Add engagement question based on content type
    const questions = {
      'Tutorial/Guide': 'Have you implemented similar approaches in your work? What challenges did you face?',
      'Review/Analysis': 'Based on your experience, how do these findings align with what you\'ve observed?',
      'News/Update': 'How do you see this development impacting your strategy going forward?',
      'Listicle/Tips': 'Which of these insights resonates most with your current challenges?'
    };
    
    const question = questions[analysis.contentType as keyof typeof questions] || 'What\'s your take on this? I\'d love to hear your perspective.';
    post += `\n\n💬 ${question}`;
    
    // Add relevant hashtags based on content
    const topicHashtags = this.generateTopicHashtags(analysis, title, description);
    post += `\n\n${topicHashtags}`;
    
    post += `\n\n🔗 Read the full article: ${url}`;
    
    // Final word count enforcement
    const wordCount = post.split(/\s+/).filter(w => w.length > 0).length;
    logger.info(`LinkedIn post word count: ${wordCount} (target: ${userPrefs.minWords}-${userPrefs.maxWords})`);
    
    // If still too short, add more context
    if (wordCount < userPrefs.minWords) {
      const additionalContext = '\n\nI encourage you to read the full piece and share your thoughts. These conversations help us all grow and learn from each other\'s experiences. Looking forward to your insights!';
      post += additionalContext;
    }
    
    // If too long, trim intelligently
    if (wordCount > userPrefs.maxWords) {
      post = this.trimContent(post, userPrefs.maxWords);
      post += `\n\n🔗 ${url}`; // Re-add URL after trimming
    }
    
    return post;
  }

  private generateTopicHashtags(analysis: any, title: string, description: string): string {
    const content = (title + ' ' + description).toLowerCase();
    const hashtags = [];
    
    // Topic-specific hashtags
    if (analysis.mainTopic === 'AI/Machine Learning') {
      hashtags.push('#AI', '#MachineLearning', '#ArtificialIntelligence', '#TechInnovation');
    } else if (analysis.mainTopic === 'Technology') {
      hashtags.push('#Technology', '#TechTrends', '#DigitalTransformation', '#Innovation');
    } else if (analysis.mainTopic === 'Business') {
      hashtags.push('#Business', '#Entrepreneurship', '#Strategy', '#Leadership');
    }
    
    // Content-specific hashtags
    if (content.includes('seo') || content.includes('keyword')) {
      hashtags.push('#SEO', '#DigitalMarketing', '#ContentStrategy');
    }
    if (content.includes('ahrefs')) {
      hashtags.push('#Ahrefs', '#SEOTools', '#MarketingTools');
    }
    if (content.includes('review')) {
      hashtags.push('#ProductReview', '#ToolReview');
    }
    
    // Always add some general professional hashtags
    hashtags.push('#ProfessionalDevelopment', '#Learning');
    
    return [...new Set(hashtags)].slice(0, 8).join(' ');
  }

  private createAnalyzedInstagramPost(title: string, description: string, insights: string[], url: string, analysis: any, emoji: string, userPrefs: any): string {
    let post = `${emoji} ${title}\n\n${description}`;
    
    if (insights.length > 0) {
      post += '\n\n✨ Highlights:\n';
      post += insights.slice(0, 4).map(insight => `• ${insight}`).join('\n');
    }
    
    // Generate smart hashtags based on analysis
    const hashtags = this.generateSmartHashtags(analysis, title, description);
    post += `\n\n${hashtags}\n\n🔗 Link in bio for full article`;
    
    return post;
  }

  private createAnalyzedFacebookPost(title: string, description: string, insights: string[], url: string, analysis: any, userPrefs: any): string {
    const reactions = {
      'Excited/Amazed': ['This blew my mind! 🤯', 'Incredible discovery! 🚀'],
      'Problem-focused': ['Important issue to discuss 🎯', 'This needs attention 💡'],
      'Solution-oriented': ['Great solution here! ✅', 'This could help many! 🛠️'],
      'Future-focused': ['The future is exciting! 🔮', 'Things are changing fast! 📈']
    };
    
    const reactionOptions = reactions[analysis.emotionalTone as keyof typeof reactions] || ['Worth sharing! 📚'];
    const reaction = reactionOptions[Math.floor(Math.random() * reactionOptions.length)];
    
    let post = `${reaction}\n\n📰 ${title}\n\n${description}`;
    
    if (insights.length > 0) {
      post += '\n\n🔍 What caught my attention:\n';
      post += insights.slice(0, 4).map(insight => `▶️ ${insight}`).join('\n');
    }
    
    post += '\n\n👆 What do you think? Share your thoughts in the comments!';
    post += `\n\n📖 Full article: ${url}`;
    
    return post;
  }

  private generateSmartHashtags(analysis: any, title: string, description: string): string {
    const text = (title + ' ' + description).toLowerCase();
    const baseTags = ['insights', 'learning', 'growth'];
    
    // Topic-specific hashtags
    const topicTags = {
      'AI/Machine Learning': ['ai', 'machinelearning', 'artificialintelligence', 'tech', 'innovation'],
      'Technology': ['technology', 'tech', 'digital', 'innovation', 'future'],
      'Business': ['business', 'entrepreneur', 'startup', 'strategy', 'leadership'],
      'Science': ['science', 'research', 'data', 'analysis', 'discovery'],
      'Education': ['education', 'learning', 'knowledge', 'teaching', 'skills'],
      'Design': ['design', 'creativity', 'ui', 'ux', 'visual']
    };
    
    const relevantTags = topicTags[analysis.mainTopic as keyof typeof topicTags] || ['content'];
    
    // Audience-specific hashtags
    const audienceTags = {
      'Beginners': ['beginner', 'basics', 'getstarted'],
      'Advanced/Professional': ['advanced', 'professional', 'expert'],
      'Technical/Developers': ['developer', 'programming', 'coding'],
      'Business/Leadership': ['business', 'leadership', 'management']
    };
    
    const audienceSpecific = audienceTags[analysis.targetAudience as keyof typeof audienceTags] || [];
    
    const allTags = [...baseTags, ...relevantTags.slice(0, 3), ...audienceSpecific.slice(0, 2)];
    return allTags.slice(0, 8).map(tag => `#${tag}`).join(' ');
  }

  private createPromptForPlatform(pageData: any, platform: string): string {
    const platformLimits = {
      twitter: '280 characters',
      linkedin: '1300 characters',
      instagram: '2200 characters',
      facebook: '63206 characters'
    };
    
    return `Create a ${platform} post about: ${pageData.title}
Description: ${pageData.description}
Key points: ${pageData.keyPoints?.join(', ') || 'None'}
Limit: ${platformLimits[platform as keyof typeof platformLimits] || '500 characters'}
Make it engaging and professional.`;
  }

  private async generateWithPrompt(pageData: any, platform: string): Promise<string> {
    const title = pageData.title || 'Interesting Article';
    const description = pageData.description || '';
    const keyPoints = this.filterValidKeyPoints(pageData.keyPoints || []);
    const url = pageData.url;

    // Generate more intelligent, varied content based on platform
    switch (platform) {
      case 'twitter':
        return this.generateTwitterPost(title, description, keyPoints, url);
      
      case 'linkedin':
        return this.generateLinkedInPost(title, description, keyPoints, url);
      
      case 'instagram':
        return this.generateInstagramPost(title, description, keyPoints, url);
      
      case 'facebook':
        return this.generateFacebookPost(title, description, keyPoints, url);
      
      default:
        return this.generateGenericPost(title, description, url);
    }
  }

  private filterValidKeyPoints(keyPoints: string[]): string[] {
    const invalidPatterns = [
      /share\s+this/i,
      /follow\s+us/i,
      /subscribe/i,
      /newsletter/i,
      /cookie/i,
      /privacy\s+policy/i,
      /terms\s+of\s+service/i,
      /sign\s+up/i,
      /log\s+in/i,
      /menu/i,
      /navigation/i,
      /home/i,
      /about\s+us/i,
      /contact/i,
      /more\s+posts/i,
      /related\s+articles/i,
      /advertisement/i,
      /sponsored/i
    ];

    return keyPoints.filter(point => {
      if (!point || point.length < 10 || point.length > 200) return false;
      return !invalidPatterns.some(pattern => pattern.test(point));
    }).slice(0, 5);
  }

  private generateTwitterPost(title: string, description: string, keyPoints: string[], url: string): string {
    const hooks = [
      '🧵 Thread:',
      '💡 Quick insight:',
      '🔥 Hot take:',
      '📊 Data shows:',
      '🚀 Game changer:',
      '💯 This is huge:'
    ];
    
    const hook = hooks[Math.floor(Math.random() * hooks.length)];
    const shortTitle = title.length > 50 ? title.substring(0, 47) + '...' : title;
    
    if (keyPoints.length > 0) {
      const mainPoint = keyPoints[0].length > 80 ? keyPoints[0].substring(0, 77) + '...' : keyPoints[0];
      return `${hook} ${shortTitle}\n\n${mainPoint}\n\n🔗 ${url}`;
    }
    
    const shortDesc = description.length > 100 ? description.substring(0, 97) + '...' : description;
    return `${hook} ${shortTitle}\n\n${shortDesc}\n\n🔗 ${url}`;
  }

  private generateLinkedInPost(title: string, description: string, keyPoints: string[], url: string): string {
    const openings = [
      'I just discovered something fascinating:',
      'This article completely changed my perspective on',
      'Here\'s what I learned from diving deep into',
      'The future is here, and it looks like this:',
      'Breaking down the key insights from',
      'What caught my attention about this:'
    ];

    const opening = openings[Math.floor(Math.random() * openings.length)];
    let post = `${opening} ${title}\n\n${description}`;

    if (keyPoints.length > 0) {
      post += '\n\n📋 Key takeaways:\n';
      post += keyPoints.slice(0, 3).map((point, i) => `${i + 1}️⃣ ${point}`).join('\n');
    }

    post += '\n\n💭 What are your thoughts on this?\n\n🔗 Read more: ' + url;
    
    return post;
  }

  private generateInstagramPost(title: string, description: string, keyPoints: string[], url: string): string {
    const emojis = ['✨', '🌟', '💡', '🚀', '🎯', '🔥', '💯', '📈'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    let post = `${randomEmoji} ${title}\n\n${description}`;
    
    if (keyPoints.length > 0) {
      post += '\n\n🎯 Key highlights:\n';
      post += keyPoints.slice(0, 4).map(point => `• ${point}`).join('\n');
    }

    const hashtags = this.generateHashtags(title, description);
    post += `\n\n${hashtags}\n\n🔗 Link in bio for full article`;
    
    return post;
  }

  private generateFacebookPost(title: string, description: string, keyPoints: string[], url: string): string {
    const reactions = [
      'This is incredible! 🤯',
      'Mind = blown 🤯',
      'Had to share this with you all! 👇',
      'This got me thinking... 🤔',
      'Absolutely fascinating read! 📚'
    ];

    const reaction = reactions[Math.floor(Math.random() * reactions.length)];
    let post = `${reaction}\n\n📰 ${title}\n\n${description}`;

    if (keyPoints.length > 0) {
      post += '\n\n🔍 What stood out to me:\n';
      post += keyPoints.slice(0, 4).map(point => `▶️ ${point}`).join('\n');
    }

    post += '\n\n👆 What do you think about this? Let me know in the comments!\n\n📖 Full article: ' + url;
    
    return post;
  }

  private generateGenericPost(title: string, description: string, url: string): string {
    return `📄 ${title}\n\n${description}\n\n🔗 Read more: ${url}`;
  }

  private generateHashtags(title: string, description: string): string {
    const text = (title + ' ' + description).toLowerCase();
    const possibleTags = [
      'ai', 'machinelearning', 'technology', 'innovation', 'future',
      'business', 'startup', 'entrepreneur', 'productivity', 'growth',
      'learning', 'insights', 'research', 'data', 'science',
      'development', 'programming', 'design', 'creativity', 'inspiration'
    ];

    const relevantTags = possibleTags.filter(tag => text.includes(tag));
    const selectedTags = relevantTags.slice(0, 5);
    
    if (selectedTags.length < 3) {
      selectedTags.push('innovation', 'insights', 'learning');
    }

    return selectedTags.slice(0, 6).map(tag => `#${tag}`).join(' ');
  }

  private createStructuredPost(pageData: any, platform: string): string {
    // Fallback method - simpler but still better than before
    const title = pageData.title || 'Interesting Article';
    const description = pageData.description || 'Check out this content';
    const keyPoints = this.filterValidKeyPoints(pageData.keyPoints || []);
    const url = pageData.url;
    
    switch (platform) {
      case 'twitter':
        return `🔥 ${title.length > 50 ? title.substring(0, 47) + '...' : title}\n\n${description.substring(0, 120)}...\n\n🔗 ${url}`;
      
      case 'linkedin':
        let linkedinPost = `💡 ${title}\n\n${description}`;
        if (keyPoints.length > 0) {
          linkedinPost += '\n\n📌 Key points:\n' + keyPoints.slice(0, 3).map((point: string, i: number) => `${i + 1}. ${point}`).join('\n');
        }
        return linkedinPost + `\n\n🔗 ${url}`;
      
      case 'instagram':
        return `✨ ${title}\n\n${description}\n\n${keyPoints.slice(0, 4).map((point: string) => `• ${point}`).join('\n')}\n\n#content #insights #learning\n\n🔗 Link in bio`;
      
      case 'facebook':
        return `${title}\n\n${description}\n\n${keyPoints.slice(0, 4).map((point: string) => `✅ ${point}`).join('\n')}\n\nRead more: ${url}`;
      
      default:
        return `${title}\n\n${description}\n\n${url}`;
    }
  }

  private displayResults(posts: any[]): void {
    const container = document.getElementById('posts-container');
    const totalPostsCount = document.getElementById('total-posts-count');
    const totalWordCount = document.getElementById('total-word-count');
    
    if (!container) return;
    
    // Update counters
    const totalWords = posts.reduce((sum, post) => sum + (post.wordCount || 0), 0);
    if (totalPostsCount) totalPostsCount.textContent = `${posts.length} posts`;
    if (totalWordCount) totalWordCount.textContent = `${totalWords} words`;
    
    // Clear existing content
    container.innerHTML = '';
    
    // Generate post cards
    posts.forEach((post, index) => {
      const postCard = this.createPostCard(post, index);
      container.appendChild(postCard);
    });
  }

  private createPostCard(post: any, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bg-white border border-gray-200 rounded-lg p-4';
    
    const platformIcon = this.getPlatformIcon(post.platform);
    const platformColor = this.getPlatformColor(post.platform);
    
    card.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-lg">${platformIcon}</span>
          <span class="font-semibold capitalize" style="color: ${platformColor}">${post.platform}</span>
        </div>
        <div class="text-xs text-gray-500">
          ${post.charCount} chars • ${post.wordCount} words
        </div>
      </div>
      
      <div class="bg-gray-50 p-3 rounded-lg mb-3 text-sm whitespace-pre-wrap ${post.error ? 'text-red-600 bg-red-50' : ''}">${post.content}</div>
      
      <div class="flex gap-2">
        <button class="copy-post-btn text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg" data-content="${post.content.replace(/"/g, '&quot;')}">
          Copy
        </button>
        <button class="edit-post-btn text-xs px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg" data-index="${index}">
          Edit
        </button>
      </div>
    `;
    
    // Add event listeners
    const copyBtn = card.querySelector('.copy-post-btn') as HTMLButtonElement;
    copyBtn?.addEventListener('click', () => this.copyToClipboard(post.content));
    
    return card;
  }

  private getPlatformIcon(platform: string): string {
    const icons = {
      twitter: '🐦',
      linkedin: '💼',
      instagram: '📷',
      facebook: '👥'
    };
    return icons[platform as keyof typeof icons] || '📝';
  }

  private getPlatformColor(platform: string): string {
    const colors = {
      twitter: '#1DA1F2',
      linkedin: '#0077B5',
      instagram: '#E4405F',
      facebook: '#1877F2'
    };
    return colors[platform as keyof typeof colors] || '#666666';
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      // Show brief success feedback
      logger.info('Content copied to clipboard');
    } catch (error) {
      logger.error('Failed to copy to clipboard', error);
    }
  }

  private async saveAPIToken(): Promise<void> {
    const tokenInput = document.getElementById('hf-api-token') as HTMLInputElement;
    const statusDiv = document.getElementById('token-status');
    
    const token = tokenInput?.value.trim();
    
    if (!token) {
      this.showTokenStatus('Please enter a valid token', 'error');
      return;
    }
    
    if (!token.startsWith('hf_')) {
      this.showTokenStatus('Invalid token format. Token should start with "hf_"', 'error');
      return;
    }
    
    try {
      await chrome.storage.local.set({ hf_api_token: token });
      this.showTokenStatus('Token saved successfully!', 'success');
      logger.info('API token saved');
    } catch (error) {
      logger.error('Failed to save token', error);
      this.showTokenStatus('Failed to save token', 'error');
    }
  }

  private async testAPIToken(): Promise<void> {
    const tokenInput = document.getElementById('hf-api-token') as HTMLInputElement;
    let token = tokenInput?.value.trim();
    
    if (!token) {
      // Try to get saved token
      try {
        const result = await chrome.storage.local.get(['hf_api_token']);
        token = result.hf_api_token;
      } catch (error) {
        this.showTokenStatus('No token found. Please enter and save a token first.', 'error');
        return;
      }
    }
    
    if (!token) {
      this.showTokenStatus('No token found. Please enter and save a token first.', 'error');
      return;
    }
    
    this.showTokenStatus('Testing connection...', 'info');
    
    try {
      const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: 'test' })
      });
      
      if (response.ok || response.status === 503) {
        // 503 means model is loading, which is also a valid response indicating token works
        this.showTokenStatus('✅ Connection successful! Token is valid.', 'success');
      } else if (response.status === 401) {
        this.showTokenStatus('❌ Invalid token. Please check your HuggingFace token.', 'error');
      } else {
        this.showTokenStatus(`⚠️ Unexpected response: ${response.status}. Token may be valid.`, 'warning');
      }
    } catch (error) {
      logger.error('Token test failed', error);
      this.showTokenStatus('❌ Connection failed. Please check your internet connection.', 'error');
    }
  }

  private showTokenStatus(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    const statusDiv = document.getElementById('token-status');
    if (!statusDiv) return;
    
    statusDiv.classList.remove('hidden');
    statusDiv.textContent = message;
    
    // Reset classes
    statusDiv.classList.remove('text-green-600', 'text-red-600', 'text-yellow-600', 'text-blue-600');
    
    // Apply appropriate color
    switch (type) {
      case 'success':
        statusDiv.classList.add('text-green-600');
        break;
      case 'error':
        statusDiv.classList.add('text-red-600');
        break;
      case 'warning':
        statusDiv.classList.add('text-yellow-600');
        break;
      case 'info':
        statusDiv.classList.add('text-blue-600');
        break;
    }
    
    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 5000);
    }
  }

  private showLoading(message: string): void {
    appState.isLoading = true;
    appState.error = null;

    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.classList.remove('hidden');
      const messageElement = loadingElement.querySelector('p');
      if (messageElement) {
        messageElement.textContent = message;
      }
    }

    // Hide other content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    document.getElementById('error')?.classList.add('hidden');
  }

  private hideLoading(): void {
    appState.isLoading = false;
    
    document.getElementById('loading')?.classList.add('hidden');
    
    // Show current tab content
    const content = document.getElementById(`${appState.currentTab}-content`);
    if (content) {
      content.classList.remove('hidden');
    }
  }

  private showError(message: string): void {
    appState.error = message;
    appState.isLoading = false;

    const errorElement = document.getElementById('error');
    if (errorElement) {
      errorElement.classList.remove('hidden');
      const messageElement = errorElement.querySelector('p');
      if (messageElement) {
        messageElement.textContent = message;
      }
    }

    // Hide other content
    document.getElementById('loading')?.classList.add('hidden');
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
  }

  private clearError(): void {
    appState.error = null;
    document.getElementById('error')?.classList.add('hidden');
    
    // Show current tab content
    const content = document.getElementById(`${appState.currentTab}-content`);
    if (content) {
      content.classList.remove('hidden');
    }
  }

  private async autoFillCurrentPage(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab?.url && currentTab.title && this.isValidContentUrl(currentTab.url)) {
        const urlInput = document.getElementById('url-input') as HTMLInputElement;
        if (urlInput && !urlInput.value) {
          urlInput.value = currentTab.url;
          this.validateUrl();
        }
      }
    } catch (error) {
      // Silently fail - this is just a convenience feature
      logger.warn('Could not auto-fill current page', error);
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SocialPosterApp();
  });
} else {
  new SocialPosterApp();
}