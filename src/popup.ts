/**
 * Social Poster Chrome Extension - Main Entry Point
 * Simple, working Chrome extension popup
 */
/// <reference types="chrome"/>

console.log('🎨 Social Poster v1.2.0 loading...');

// Simple state management
const appState = {
  currentTab: 'home',
  isLoading: false,
  error: null as string | null,
  selectedPlatforms: ['linkedin', 'twitter'] as string[],
};

// Simple logger
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context),
};

// Main application class
class SocialPosterApp {
  private readonly version = '1.2.0';

  constructor() {
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
      
      // Auto-fill current page
      await this.autoFillCurrentPage();
      
      logger.info(`Social Poster v${this.version} ready`);
      
    } catch (error) {
      logger.error('Failed to initialize', error);
      this.showError('Failed to initialize the extension. Please try refreshing.');
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
      this.showLoading('Extracting page content...');
      
      // Extract page data
      const pageData = await this.extractPageData(url);
      
      this.showLoading('Generating AI content...');
      
      // Generate content for each platform
      const generatedPosts = await this.generateContentForPlatforms(pageData, appState.selectedPlatforms);
      
      this.hideLoading();
      
      // Show results
      this.displayResults(generatedPosts);
      this.switchTab('assets');
      
      logger.info('Generation completed', { url, platforms: appState.selectedPlatforms, postsGenerated: generatedPosts.length });
      
    } catch (error) {
      this.hideLoading();
      logger.error('Generation failed', error);
      this.showError(error instanceof Error ? error.message : 'Failed to generate posts. Please try again.');
    }
  }

  private async extractPageData(url: string): Promise<any> {
    try {
      // Try to extract from current tab if it matches the URL
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab?.url === url && currentTab.id) {
        try {
          // First, inject the content script to ensure it's available
          await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            files: ['dist/content.js']
          });
          
          // Small delay to ensure script is loaded
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Extract from current tab
          const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'extractPageData' });
          if (response?.success) {
            return response.data;
          }
        } catch (contentError) {
          logger.warn('Content script extraction failed, falling back to background service', contentError);
        }
      }
      
      // Fallback: use background service to analyze external URL
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeExternalUrl',
        data: { url }
      });
      
      if (response?.success) {
        return response.data;
      }
      
      throw new Error('Failed to extract page content');
    } catch (error) {
      logger.error('Page extraction failed', error);
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
    // Create platform-specific prompt
    const prompt = this.createPromptForPlatform(pageData, platform);
    
    // For now, create a structured post based on the page data
    // This can be enhanced with actual AI generation later
    return this.createStructuredPost(pageData, platform);
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

  private createStructuredPost(pageData: any, platform: string): string {
    const title = pageData.title || 'Interesting Article';
    const description = pageData.description || 'Check out this content';
    const keyPoints = pageData.keyPoints || [];
    const url = pageData.url;
    
    switch (platform) {
      case 'twitter':
        return `🔥 ${title}\n\n${description.substring(0, 150)}...\n\n${url}`;
      
      case 'linkedin':
        const linkedinPost = `💡 ${title}\n\n${description}\n\n`;
        if (keyPoints.length > 0) {
          const points = keyPoints.slice(0, 3).map((point: string, i: number) => `${i + 1}. ${point}`).join('\n');
          return linkedinPost + `Key insights:\n${points}\n\n🔗 ${url}`;
        }
        return linkedinPost + `🔗 ${url}`;
      
      case 'instagram':
        return `✨ ${title}\n\n${description}\n\n${keyPoints.slice(0, 5).map((point: string) => `• ${point}`).join('\n')}\n\n#content #insights\n\n🔗 Link in bio`;
      
      case 'facebook':
        return `${title}\n\n${description}\n\n${keyPoints.slice(0, 5).map((point: string) => `✓ ${point}`).join('\n')}\n\nRead more: ${url}`;
      
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