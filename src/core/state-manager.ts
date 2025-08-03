/**
 * State management system following Google's patterns
 * Provides centralized state with reactive updates and persistence
 */

import { logger } from './logger';
import type { 
  UserSettings, 
  PageData, 
  GeneratedPost, 
  Platform 
} from '../types/index';

export interface AppState {
  // UI State
  currentTab: 'home' | 'style' | 'assets';
  isLoading: boolean;
  loadingProgress: number;
  loadingMessage: string;
  error: string | null;
  
  // Data State
  pageData: PageData | null;
  generatedPosts: GeneratedPost[];
  recentUrls: Array<{ url: string; title: string; timestamp: number }>;
  userSettings: UserSettings;
  
  // Form State
  selectedPlatforms: Platform[];
  contentContext: string;
  customContext: string;
  
  // Generation State
  isGenerating: boolean;
  generationStep: number;
  totalSteps: number;
}

type StateListener<T = AppState> = (newState: T, previousState: T) => void;
type StateSelector<T> = (state: AppState) => T;

export class StateManager {
  private static instance: StateManager;
  private state: AppState;
  private listeners: Set<StateListener> = new Set();
  private selectorListeners: Map<StateSelector<any>, Set<StateListener<any>>> = new Map();

  private constructor() {
    this.state = this.getInitialState();
    this.setupStoragePersistence();
  }

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  private getInitialState(): AppState {
    return {
      currentTab: 'home',
      isLoading: false,
      loadingProgress: 0,
      loadingMessage: '',
      error: null,
      pageData: null,
      generatedPosts: [],
      recentUrls: [],
      userSettings: {
        brandColors: { primary: '#667eea', secondary: '#764ba2' },
        companyName: '',
        logo: null,
        template: 'professional',
        contentTone: 'professional',
        engagementFocus: 'viral',
        followPageTheme: false,
        autoSave: true
      },
      selectedPlatforms: ['linkedin', 'twitter'],
      contentContext: 'found-interesting',
      customContext: '',
      isGenerating: false,
      generationStep: 0,
      totalSteps: 5
    };
  }

  private setupStoragePersistence(): void {
    // Listen to settings changes and persist them
    this.subscribe((newState, prevState) => {
      if (newState.userSettings !== prevState.userSettings) {
        this.persistUserSettings(newState.userSettings);
      }
      if (newState.recentUrls !== prevState.recentUrls) {
        this.persistRecentUrls(newState.recentUrls);
      }
    });
  }

  private async persistUserSettings(settings: UserSettings): Promise<void> {
    try {
      await chrome.storage.sync.set({ userSettings: settings });
      logger.debug('User settings persisted', { settings }, 'StateManager');
    } catch (error) {
      logger.error('Failed to persist user settings', undefined, 'StateManager', error as Error);
    }
  }

  private async persistRecentUrls(urls: AppState['recentUrls']): Promise<void> {
    try {
      await chrome.storage.local.set({ recentUrls: urls });
      logger.debug('Recent URLs persisted', { count: urls.length }, 'StateManager');
    } catch (error) {
      logger.error('Failed to persist recent URLs', undefined, 'StateManager', error as Error);
    }
  }

  /**
   * Subscribe to all state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to specific state slice changes
   */
  subscribeToSelector<T>(
    selector: StateSelector<T>,
    listener: StateListener<T>
  ): () => void {
    if (!this.selectorListeners.has(selector)) {
      this.selectorListeners.set(selector, new Set());
    }
    this.selectorListeners.get(selector)!.add(listener);

    return () => {
      const listeners = this.selectorListeners.get(selector);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.selectorListeners.delete(selector);
        }
      }
    };
  }

  /**
   * Get current state (immutable)
   */
  getState(): Readonly<AppState> {
    return { ...this.state };
  }

  /**
   * Get specific state slice
   */
  select<T>(selector: StateSelector<T>): T {
    return selector(this.state);
  }

  /**
   * Update state with partial changes
   */
  setState(partialState: Partial<AppState>): void {
    const previousState = { ...this.state };
    this.state = { ...this.state, ...partialState };

    logger.debug('State updated', { 
      changes: Object.keys(partialState),
      previousState: this.getChangedKeys(previousState, this.state) 
    }, 'StateManager');

    // Notify global listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.state, previousState);
      } catch (error) {
        logger.error('State listener error', undefined, 'StateManager', error as Error);
      }
    });

    // Notify selector listeners
    this.selectorListeners.forEach((listeners, selector) => {
      try {
        const newValue = selector(this.state);
        const prevValue = selector(previousState);
        
        if (newValue !== prevValue) {
          listeners.forEach(listener => {
            try {
              listener(newValue, prevValue);
            } catch (error) {
              logger.error('Selector listener error', undefined, 'StateManager', error as Error);
            }
          });
        }
      } catch (error) {
        logger.error('Selector evaluation error', undefined, 'StateManager', error as Error);
      }
    });
  }

  private getChangedKeys(prev: AppState, next: AppState): Record<string, any> {
    const changes: Record<string, any> = {};
    Object.keys(next).forEach(key => {
      const k = key as keyof AppState;
      if (prev[k] !== next[k]) {
        changes[key] = { from: prev[k], to: next[k] };
      }
    });
    return changes;
  }

  /**
   * Reset state to initial values
   */
  reset(): void {
    this.setState(this.getInitialState());
    logger.info('State reset to initial values', undefined, 'StateManager');
  }

  /**
   * Load persisted state from storage
   */
  async loadPersistedState(): Promise<void> {
    try {
      const [settingsResult, urlsResult] = await Promise.all([
        chrome.storage.sync.get(['userSettings']),
        chrome.storage.local.get(['recentUrls'])
      ]);

      const updates: Partial<AppState> = {};

      if (settingsResult.userSettings) {
        updates.userSettings = { ...this.state.userSettings, ...settingsResult.userSettings };
      }

      if (urlsResult.recentUrls) {
        updates.recentUrls = urlsResult.recentUrls;
      }

      if (Object.keys(updates).length > 0) {
        this.setState(updates);
        logger.info('Persisted state loaded', { keys: Object.keys(updates) }, 'StateManager');
      }
    } catch (error) {
      logger.error('Failed to load persisted state', undefined, 'StateManager', error as Error);
    }
  }

  // Convenience methods for common state updates
  setLoading(isLoading: boolean, message: string = '', progress: number = 0): void {
    this.setState({ 
      isLoading, 
      loadingMessage: message, 
      loadingProgress: progress,
      error: isLoading ? null : this.state.error // Clear error when starting to load
    });
  }

  setError(error: string | null): void {
    this.setState({ 
      error, 
      isLoading: false,
      isGenerating: false 
    });
  }

  setCurrentTab(tab: AppState['currentTab']): void {
    this.setState({ currentTab: tab });
  }

  setPageData(pageData: PageData | null): void {
    this.setState({ pageData });
  }

  addGeneratedPost(post: GeneratedPost): void {
    this.setState({ 
      generatedPosts: [...this.state.generatedPosts, post] 
    });
  }

  setGeneratedPosts(posts: GeneratedPost[]): void {
    this.setState({ generatedPosts: posts });
  }

  addRecentUrl(url: string, title: string): void {
    const newUrl = { url, title, timestamp: Date.now() };
    const filtered = this.state.recentUrls.filter(item => item.url !== url);
    const updated = [newUrl, ...filtered].slice(0, 10);
    this.setState({ recentUrls: updated });
  }

  setSelectedPlatforms(platforms: Platform[]): void {
    this.setState({ selectedPlatforms: platforms });
  }

  setContentContext(context: string): void {
    this.setState({ contentContext: context });
  }

  setCustomContext(context: string): void {
    this.setState({ customContext: context });
  }

  setGenerationProgress(step: number, totalSteps: number = 5): void {
    this.setState({ 
      generationStep: step, 
      totalSteps, 
      isGenerating: step > 0 && step < totalSteps 
    });
  }

  updateUserSettings(updates: Partial<UserSettings>): void {
    this.setState({ 
      userSettings: { ...this.state.userSettings, ...updates } 
    });
  }
}

// Export singleton instance
export const stateManager = StateManager.getInstance();