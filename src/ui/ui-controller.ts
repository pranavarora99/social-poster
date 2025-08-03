/**
 * UI Controller following Google's MVC patterns
 * Handles all UI interactions, state binding, and view updates
 */

import { logger } from '../core/logger';
import { stateManager, type AppState } from '../core/state-manager';
import { errorBoundary } from '../core/error-boundary';
import { Sanitizer } from '../utils/sanitization';
import type { Platform, GeneratedPost } from '../types/index';

export class UIController {
  private static instance: UIController;
  private readonly component = 'UIController';
  private unsubscribeCallbacks: Array<() => void> = [];
  private elements: Map<string, HTMLElement> = new Map();

  private constructor() {
    this.initializeElements();
    this.setupStateBindings();
    this.setupEventListeners();
  }

  static getInstance(): UIController {
    if (!UIController.instance) {
      UIController.instance = new UIController();
    }
    return UIController.instance;
  }

  private initializeElements(): void {
    const elementIds = [
      'loading', 'error', 'home-content', 'style-content', 'assets-content',
      'tab-home', 'tab-style', 'tab-assets',
      'url-input', 'current-page-btn', 'generate-btn',
      'progress-section', 'progress-bar', 'progress-text', 'progress-percentage', 'progress-details',
      'recent-urls', 'posts-container', 'generate-btn-text', 'generate-spinner'
    ];

    elementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.elements.set(id, element);
      } else {
        logger.warn(`Element not found: ${id}`, undefined, this.component);
      }
    });
  }

  private setupStateBindings(): void {
    // Subscribe to relevant state changes
    const unsubscribeLoading = stateManager.subscribeToSelector(
      state => ({ isLoading: state.isLoading, loadingMessage: state.loadingMessage, loadingProgress: state.loadingProgress }),
      (newValue) => this.updateLoadingState(newValue.isLoading, newValue.loadingMessage, newValue.loadingProgress)
    );

    const unsubscribeError = stateManager.subscribeToSelector(
      state => state.error,
      (error) => this.updateErrorState(error)
    );

    const unsubscribeTab = stateManager.subscribeToSelector(
      state => state.currentTab,
      (tab) => this.updateActiveTab(tab)
    );

    const unsubscribeGeneration = stateManager.subscribeToSelector(
      state => ({ isGenerating: state.isGenerating, step: state.generationStep, total: state.totalSteps }),
      (value) => this.updateGenerationState(value.isGenerating, value.step, value.total)
    );

    const unsubscribePosts = stateManager.subscribeToSelector(
      state => state.generatedPosts,
      (posts) => this.updatePostsDisplay(posts)
    );

    const unsubscribeRecentUrls = stateManager.subscribeToSelector(
      state => state.recentUrls,
      (urls) => this.updateRecentUrls(urls)
    );

    // Store unsubscribe callbacks
    this.unsubscribeCallbacks.push(
      unsubscribeLoading,
      unsubscribeError,
      unsubscribeTab,
      unsubscribeGeneration,
      unsubscribePosts,
      unsubscribeRecentUrls
    );
  }

  private setupEventListeners(): void {
    // Tab navigation
    this.addSafeEventListener('tab-home', 'click', () => stateManager.setCurrentTab('home'));
    this.addSafeEventListener('tab-style', 'click', () => stateManager.setCurrentTab('style'));
    this.addSafeEventListener('tab-assets', 'click', () => stateManager.setCurrentTab('assets'));

    // URL input
    this.addSafeEventListener('url-input', 'input', (e) => this.handleUrlInput(e));
    this.addSafeEventListener('current-page-btn', 'click', () => this.handleCurrentPageClick());

    // Generation
    this.addSafeEventListener('generate-btn', 'click', () => this.handleGenerateClick());
    
    // Retry button
    this.addSafeEventListener('retry-btn', 'click', () => this.handleRetryClick());

    // Platform selection
    this.setupPlatformSelection();

    // Content context
    this.setupContentContext();

    // Settings changes
    this.setupSettingsListeners();

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();

    logger.info('Event listeners setup completed', undefined, this.component);
  }

  private addSafeEventListener(elementId: string, event: string, handler: (e: Event) => void): void {
    const element = this.elements.get(elementId);
    if (element) {
      const safeHandler = errorBoundary.wrapSync(handler, `${this.component}.${elementId}.${event}`);
      element.addEventListener(event, safeHandler);
    }
  }

  private setupPlatformSelection(): void {
    const platformInputs = document.querySelectorAll('input[name="platform"]');
    platformInputs.forEach(input => {
      input.addEventListener('change', () => {
        const selectedPlatforms = Array.from(document.querySelectorAll('input[name="platform"]:checked'))
          .map(checkbox => (checkbox as HTMLInputElement).value as Platform);
        stateManager.setSelectedPlatforms(selectedPlatforms);
        this.updatePlatformCards();
      });
    });
  }

  private setupContentContext(): void {
    const contextInputs = document.querySelectorAll('input[name="content-context"]');
    contextInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        stateManager.setContentContext(target.value);
        this.toggleCustomContextSection(target.value === 'custom');
      });
    });

    const customTextarea = document.getElementById('custom-context-text') as HTMLTextAreaElement;
    if (customTextarea) {
      customTextarea.addEventListener('input', (e) => {
        const target = e.target as HTMLTextAreaElement;
        stateManager.setCustomContext(target.value);
        this.updateCustomContextCounter(target.value.length);
      });
    }
  }

  private setupSettingsListeners(): void {
    // Template selection
    const templateInputs = document.querySelectorAll('input[name="template"]');
    templateInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        stateManager.updateUserSettings({ template: target.value });
      });
    });

    // Color inputs
    const primaryColorInput = document.getElementById('primary-color') as HTMLInputElement;
    const secondaryColorInput = document.getElementById('secondary-color') as HTMLInputElement;

    if (primaryColorInput) {
      primaryColorInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const settings = stateManager.getState().userSettings;
        stateManager.updateUserSettings({
          brandColors: { ...settings.brandColors, primary: target.value }
        });
      });
    }

    if (secondaryColorInput) {
      secondaryColorInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const settings = stateManager.getState().userSettings;
        stateManager.updateUserSettings({
          brandColors: { ...settings.brandColors, secondary: target.value }
        });
      });
    }

    // Tone and engagement selects
    const toneSelect = document.getElementById('content-tone') as HTMLSelectElement;
    const engagementSelect = document.getElementById('engagement-focus') as HTMLSelectElement;

    if (toneSelect) {
      toneSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        stateManager.updateUserSettings({ contentTone: target.value });
      });
    }

    if (engagementSelect) {
      engagementSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        stateManager.updateUserSettings({ engagementFocus: target.value });
      });
    }
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Enter to generate
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.handleGenerateClick();
      }

      // Escape to clear error
      if (e.key === 'Escape') {
        stateManager.setError(null);
      }

      // Tab navigation with Alt + number
      if (e.altKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            stateManager.setCurrentTab('home');
            break;
          case '2':
            e.preventDefault();
            stateManager.setCurrentTab('style');
            break;
          case '3':
            e.preventDefault();
            stateManager.setCurrentTab('assets');
            break;
        }
      }
    });
  }

  // State update handlers
  private updateLoadingState(isLoading: boolean, message: string, progress: number): void {
    const loadingElement = this.elements.get('loading');
    const errorElement = this.elements.get('error');
    const contentElements = ['home-content', 'style-content', 'assets-content'];

    if (isLoading) {
      loadingElement?.classList.remove('hidden');
      errorElement?.classList.add('hidden');
      contentElements.forEach(id => this.elements.get(id)?.classList.add('hidden'));
      
      const messageElement = loadingElement?.querySelector('p');
      if (messageElement) {
        messageElement.textContent = message || 'Loading...';
      }
    } else {
      loadingElement?.classList.add('hidden');
      const currentTab = stateManager.getState().currentTab;
      this.showTabContent(currentTab);
    }
  }

  private updateErrorState(error: string | null): void {
    const errorElement = this.elements.get('error');
    
    if (error) {
      errorElement?.classList.remove('hidden');
      const messageElement = errorElement?.querySelector('p');
      if (messageElement) {
        messageElement.textContent = Sanitizer.sanitizeText(error);
      }
      
      // Hide other content
      ['loading', 'home-content', 'style-content', 'assets-content'].forEach(id => {
        this.elements.get(id)?.classList.add('hidden');
      });
    } else {
      errorElement?.classList.add('hidden');
      const currentTab = stateManager.getState().currentTab;
      this.showTabContent(currentTab);
    }
  }

  private updateActiveTab(tab: AppState['currentTab']): void {
    // Update tab buttons
    ['tab-home', 'tab-style', 'tab-assets'].forEach(id => {
      const button = this.elements.get(id);
      const isActive = id === `tab-${tab}`;
      
      if (button) {
        button.classList.toggle('active', isActive);
        button.classList.toggle('border-blue-500', isActive);
        button.classList.toggle('text-blue-600', isActive);
        button.classList.toggle('border-transparent', !isActive);
        button.classList.toggle('text-gray-500', !isActive);
      }
    });

    this.showTabContent(tab);
  }

  private showTabContent(tab: AppState['currentTab']): void {
    const { isLoading, error } = stateManager.getState();
    
    if (isLoading || error) return;

    ['home-content', 'style-content', 'assets-content'].forEach(id => {
      const element = this.elements.get(id);
      const shouldShow = id === `${tab}-content`;
      element?.classList.toggle('hidden', !shouldShow);
    });
  }

  private updateGenerationState(isGenerating: boolean, step: number, total: number): void {
    const generateBtn = this.elements.get('generate-btn');
    const generateText = this.elements.get('generate-btn-text');
    const generateSpinner = this.elements.get('generate-spinner');
    const progressSection = this.elements.get('progress-section');

    if (generateBtn) {
      generateBtn.classList.toggle('opacity-50', isGenerating);
      (generateBtn as HTMLButtonElement).disabled = isGenerating;
    }

    if (generateText && generateSpinner) {
      generateText.classList.toggle('hidden', isGenerating);
      generateSpinner.classList.toggle('hidden', !isGenerating);
    }

    if (progressSection) {
      progressSection.classList.toggle('hidden', !isGenerating);
      
      if (isGenerating) {
        const percentage = Math.round((step / total) * 100);
        this.updateProgressBar(percentage, `Step ${step} of ${total}`);
      }
    }
  }

  private updateProgressBar(percentage: number, message: string): void {
    const progressBar = this.elements.get('progress-bar');
    const progressText = this.elements.get('progress-text');
    const progressPercentage = this.elements.get('progress-percentage');

    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }

    if (progressText) {
      progressText.textContent = Sanitizer.sanitizeText(message);
    }

    if (progressPercentage) {
      progressPercentage.textContent = `${percentage}%`;
    }
  }

  private updatePostsDisplay(posts: GeneratedPost[]): void {
    const container = this.elements.get('posts-container');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    if (posts.length === 0) {
      const emptyState = errorBoundary.createSafeElement('div', {
        className: 'text-center py-8 text-gray-500',
        textContent: 'No posts generated yet. Click "Generate Social Posts" to get started!'
      });
      if (emptyState) container.appendChild(emptyState);
      return;
    }

    posts.forEach((post, index) => {
      const postElement = this.createPostElement(post, index);
      if (postElement) {
        container.appendChild(postElement);
      }
    });

    // Enable the assets tab
    const assetsTab = this.elements.get('tab-assets') as HTMLButtonElement;
    if (assetsTab) {
      assetsTab.disabled = false;
      assetsTab.classList.remove('opacity-50');
    }
  }

  private createPostElement(post: GeneratedPost, index: number): HTMLElement | null {
    const postDiv = errorBoundary.createSafeElement('div', {
      className: 'bg-white border border-gray-200 rounded-lg p-4 space-y-3'
    });

    if (!postDiv) return null;

    // Header
    const header = errorBoundary.createSafeElement('div', {
      className: 'flex items-center justify-between'
    });

    if (header) {
      const platformBadge = errorBoundary.createSafeElement('span', {
        className: `text-xs font-bold px-2 py-1 rounded ${this.getPlatformBadgeClass(post.platform)}`,
        textContent: post.platform.toUpperCase()
      });

      const actions = errorBoundary.createSafeElement('div', {
        className: 'flex gap-2'
      });

      if (platformBadge) header.appendChild(platformBadge);
      if (actions) {
        const copyBtn = this.createActionButton('Copy', () => this.copyToClipboard(post.content));
        if (copyBtn) actions.appendChild(copyBtn);
        header.appendChild(actions);
      }

      postDiv.appendChild(header);
    }

    // Content
    const content = errorBoundary.createSafeElement('div', {
      className: 'text-sm text-gray-800 whitespace-pre-wrap',
      textContent: post.content
    });

    if (content) postDiv.appendChild(content);

    // Stats
    const stats = errorBoundary.createSafeElement('div', {
      className: 'flex justify-between text-xs text-gray-500'
    });

    if (stats) {
      const charCount = errorBoundary.createSafeElement('span', {
        textContent: `${post.charCount} characters`
      });
      const wordCount = errorBoundary.createSafeElement('span', {
        textContent: `${post.wordCount} words`
      });

      if (charCount) stats.appendChild(charCount);
      if (wordCount) stats.appendChild(wordCount);
      postDiv.appendChild(stats);
    }

    return postDiv;
  }

  private createActionButton(text: string, onClick: () => void): HTMLElement | null {
    const button = errorBoundary.createSafeElement('button', {
      className: 'text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200',
      textContent: text
    });

    if (button) {
      button.addEventListener('click', errorBoundary.wrapSync(onClick, `${this.component}.ActionButton`));
    }

    return button;
  }

  private getPlatformBadgeClass(platform: string): string {
    const classes: Record<string, string> = {
      linkedin: 'bg-blue-100 text-blue-800',
      twitter: 'bg-sky-100 text-sky-800',
      instagram: 'bg-pink-100 text-pink-800',
      facebook: 'bg-indigo-100 text-indigo-800'
    };
    return classes[platform] || 'bg-gray-100 text-gray-800';
  }

  private updateRecentUrls(urls: AppState['recentUrls']): void {
    const container = this.elements.get('recent-urls');
    if (!container) return;

    container.innerHTML = '';

    if (urls.length === 0) {
      const emptyState = errorBoundary.createSafeElement('div', {
        className: 'text-sm text-gray-500 text-center py-2',
        textContent: 'No recent URLs'
      });
      if (emptyState) container.appendChild(emptyState);
      return;
    }

    urls.slice(0, 5).forEach(item => {
      const urlElement = this.createRecentUrlElement(item);
      if (urlElement) container.appendChild(urlElement);
    });
  }

  private createRecentUrlElement(item: { url: string; title: string; timestamp: number }): HTMLElement | null {
    const div = errorBoundary.createSafeElement('div', {
      className: 'flex items-center justify-between p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100'
    });

    if (!div) return null;

    div.addEventListener('click', () => this.useRecentUrl(item.url));

    const content = errorBoundary.createSafeElement('div', {
      className: 'flex-1 min-w-0'
    });

    if (content) {
      const title = errorBoundary.createSafeElement('div', {
        className: 'text-sm font-medium text-gray-900 truncate',
        textContent: Sanitizer.sanitizeText(item.title)
      });

      const url = errorBoundary.createSafeElement('div', {
        className: 'text-xs text-gray-500 truncate',
        textContent: Sanitizer.sanitizeUrl(item.url)
      });

      if (title) content.appendChild(title);
      if (url) content.appendChild(url);
      div.appendChild(content);
    }

    return div;
  }

  // Event handlers
  private handleUrlInput(e: Event): void {
    const target = e.target as HTMLInputElement;
    const url = target.value.trim();
    
    if (url && this.isValidUrl(url)) {
      target.classList.remove('border-red-300');
      target.classList.add('border-green-300');
    } else if (url) {
      target.classList.remove('border-green-300');
      target.classList.add('border-red-300');
    } else {
      target.classList.remove('border-red-300', 'border-green-300');
    }
  }

  private async handleCurrentPageClick(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab?.url && currentTab.title) {
        const urlInput = this.elements.get('url-input') as HTMLInputElement;
        if (urlInput) {
          urlInput.value = currentTab.url;
          this.handleUrlInput({ target: urlInput } as any);
        }
        
        stateManager.addRecentUrl(currentTab.url, currentTab.title);
        logger.info('Current page URL set', { url: currentTab.url }, this.component);
      }
    } catch (error) {
      errorBoundary.handleError(error, this.component, true);
    }
  }

  private async handleGenerateClick(): Promise<void> {
    const urlInput = this.elements.get('url-input') as HTMLInputElement;
    const url = urlInput?.value.trim();

    if (!url || !this.isValidUrl(url)) {
      stateManager.setError('Please enter a valid URL');
      return;
    }

    const selectedPlatforms = stateManager.getState().selectedPlatforms;
    if (selectedPlatforms.length === 0) {
      stateManager.setError('Please select at least one platform');
      return;
    }

    // Start generation process
    stateManager.setGenerationProgress(1, 5);
    logger.info('Generate button clicked', { url, platforms: selectedPlatforms }, this.component);
  }

  private handleRetryClick(): void {
    // Clear error and try again
    stateManager.setError(null);
    this.handleGenerateClick();
  }

  // Utility methods
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private updatePlatformCards(): void {
    const platformInputs = document.querySelectorAll('input[name="platform"]');
    platformInputs.forEach(input => {
      const card = input.closest('.platform-card');
      const isChecked = (input as HTMLInputElement).checked;
      
      if (card) {
        card.classList.toggle('active', isChecked);
        const cardDiv = card.querySelector('div');
        if (cardDiv) {
          cardDiv.classList.toggle('border-blue-200', isChecked);
          cardDiv.classList.toggle('bg-blue-50', isChecked);
          cardDiv.classList.toggle('border-gray-200', !isChecked);
          cardDiv.classList.toggle('bg-white', !isChecked);
        }
      }
    });
  }

  private toggleCustomContextSection(show: boolean): void {
    const section = document.getElementById('custom-context-section');
    section?.classList.toggle('hidden', !show);
  }

  private updateCustomContextCounter(length: number): void {
    const counter = document.getElementById('custom-context-count');
    if (counter) {
      counter.textContent = `${length}/300`;
    }
  }

  private useRecentUrl(url: string): void {
    const urlInput = this.elements.get('url-input') as HTMLInputElement;
    if (urlInput) {
      urlInput.value = url;
      this.handleUrlInput({ target: urlInput } as any);
    }
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      logger.info('Content copied to clipboard', { length: text.length }, this.component);
    } catch (error) {
      errorBoundary.handleError(error, this.component, true);
    }
  }

  /**
   * Initialize the UI controller
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing UI Controller', undefined, this.component);
      
      // Load persisted state
      await stateManager.loadPersistedState();
      
      // Set initial UI state based on current state
      const currentState = stateManager.getState();
      this.updateActiveTab(currentState.currentTab);
      this.updateLoadingState(currentState.isLoading, currentState.loadingMessage, currentState.loadingProgress);
      this.updateErrorState(currentState.error);
      
      logger.info('UI Controller initialized successfully', undefined, this.component);
    } catch (error) {
      errorBoundary.handleError(error, this.component, false);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
    this.unsubscribeCallbacks = [];
    this.elements.clear();
    logger.info('UI Controller destroyed', undefined, this.component);
  }
}

// Export singleton instance
export const uiController = UIController.getInstance();