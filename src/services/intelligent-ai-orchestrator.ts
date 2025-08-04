/**
 * Intelligent AI Model Orchestrator
 * Replaces brute-force ensemble with smart model selection
 */

import type { AIGenerationParams, HuggingFaceResponse } from '../types/index';
import { TokenManager, APIError } from './api-service';

interface ModelCapability {
  readonly id: string;
  readonly name: string;
  readonly specialty: ModelSpecialty;
  readonly costPerToken: number;
  readonly avgLatency: number;
  readonly qualityScore: number;
  readonly contextWindow: number;
  readonly supportedLanguages: string[];
}

interface ModelPerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  avgResponseTime: number;
  avgQualityScore: number;
  costEfficiency: number;
  lastUpdated: number;
}

interface ContentContext {
  platform: string;
  contentType: string;
  targetAudience: string;
  complexity: number;
  urgency: 'low' | 'medium' | 'high';
  qualityRequirement: number;
  budgetConstraint?: number;
}

interface ModelSelectionResult {
  selectedModel: ModelCapability;
  confidence: number;
  reasoning: string[];
  alternativeModels: ModelCapability[];
}

type ModelSpecialty = 
  | 'conversational' 
  | 'instruction-following' 
  | 'creative-writing' 
  | 'technical-content' 
  | 'social-media' 
  | 'marketing-copy'
  | 'general-purpose';

export class IntelligentAIOrchestrator {
  private readonly modelRegistry: Map<string, ModelCapability> = new Map();
  private readonly performanceMetrics: Map<string, ModelPerformanceMetrics> = new Map();
  private readonly selectionCache: Map<string, ModelSelectionResult> = new Map();
  
  // Model configuration with real-world performance data
  private readonly models: ModelCapability[] = [
    {
      id: 'qwen-2.5-coder-32b',
      name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      specialty: 'instruction-following',
      costPerToken: 0.0015,
      avgLatency: 2800,
      qualityScore: 0.92,
      contextWindow: 32768,
      supportedLanguages: ['en', 'zh', 'es', 'fr', 'de']
    },
    {
      id: 'mixtral-8x7b',
      name: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      specialty: 'conversational',
      costPerToken: 0.0012,
      avgLatency: 2200,
      qualityScore: 0.88,
      contextWindow: 32768,
      supportedLanguages: ['en', 'fr', 'de', 'es', 'it']
    },
    {
      id: 'dialogpt-large',
      name: 'microsoft/DialoGPT-large',
      specialty: 'social-media',
      costPerToken: 0.0008,
      avgLatency: 1500,
      qualityScore: 0.78,
      contextWindow: 1024,
      supportedLanguages: ['en']
    },
    {
      id: 'zephyr-7b',
      name: 'HuggingFaceH4/zephyr-7b-beta',
      specialty: 'general-purpose',
      costPerToken: 0.0006,
      avgLatency: 1800,
      qualityScore: 0.82,
      contextWindow: 4096,
      supportedLanguages: ['en']
    },
    {
      id: 'llama-2-70b-chat',
      name: 'meta-llama/Llama-2-70b-chat-hf',
      specialty: 'creative-writing',
      costPerToken: 0.002,
      avgLatency: 3500,
      qualityScore: 0.90,
      contextWindow: 4096,
      supportedLanguages: ['en', 'es', 'fr', 'de']
    }
  ];

  constructor() {
    this.initializeModelRegistry();
    this.loadPerformanceHistory();
  }

  /**
   * Intelligently select the best model for given context
   */
  async selectOptimalModel(context: ContentContext): Promise<ModelSelectionResult> {
    const cacheKey = this.generateCacheKey(context);
    const cached = this.selectionCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    const candidates = this.filterCandidateModels(context);
    const scoredCandidates = await this.scoreModels(candidates, context);
    
    const selectedModel = scoredCandidates[0];
    const confidence = this.calculateSelectionConfidence(scoredCandidates);
    const reasoning = this.generateSelectionReasoning(selectedModel, context, scoredCandidates);

    const result: ModelSelectionResult = {
      selectedModel: selectedModel.model,
      confidence,
      reasoning,
      alternativeModels: scoredCandidates.slice(1, 3).map(s => s.model)
    };

    this.selectionCache.set(cacheKey, result);
    return result;
  }

  /**
   * Generate content using the selected optimal model
   */
  async generateWithOptimalModel(
    prompt: string, 
    context: ContentContext,
    overrideModel?: string
  ): Promise<{ content: string; modelUsed: string; metrics: any }> {
    
    const startTime = performance.now();
    
    try {
      // Select model intelligently unless overridden
      const modelResult = overrideModel 
        ? { selectedModel: this.modelRegistry.get(overrideModel)!, confidence: 1, reasoning: ['Manual override'], alternativeModels: [] }
        : await this.selectOptimalModel(context);

      const model = modelResult.selectedModel;
      
      console.log(`[AIOrchestrator] Selected ${model.name} (confidence: ${(modelResult.confidence * 100).toFixed(1)}%)`);
      console.log(`[AIOrchestrator] Reasoning: ${modelResult.reasoning.join(', ')}`);

      // Generate content with selected model
      const content = await this.callModel(model, prompt, context);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Update performance metrics
      await this.updateModelMetrics(model.id, responseTime, content.length > 50);
      
      return {
        content,
        modelUsed: model.name,
        metrics: {
          responseTime,
          confidence: modelResult.confidence,
          reasoning: modelResult.reasoning,
          costEstimate: this.estimateCost(prompt.length + content.length, model.costPerToken)
        }
      };

    } catch (error) {
      console.error('[AIOrchestrator] Generation failed:', error);
      throw new APIError(`AI generation failed: ${error.message}`, true);
    }
  }

  /**
   * Get model performance analytics
   */
  getModelAnalytics(): any {
    const analytics: any = {};
    
    this.performanceMetrics.forEach((metrics, modelId) => {
      const model = this.modelRegistry.get(modelId);
      if (model) {
        analytics[modelId] = {
          name: model.name,
          specialty: model.specialty,
          successRate: metrics.successfulRequests / metrics.totalRequests,
          avgResponseTime: metrics.avgResponseTime,
          avgQualityScore: metrics.avgQualityScore,
          costEfficiency: metrics.costEfficiency,
          totalRequests: metrics.totalRequests
        };
      }
    });
    
    return analytics;
  }

  /**
   * Initialize model registry
   */
  private initializeModelRegistry(): void {
    this.models.forEach(model => {
      this.modelRegistry.set(model.id, model);
      
      // Initialize performance metrics if not exists
      if (!this.performanceMetrics.has(model.id)) {
        this.performanceMetrics.set(model.id, {
          totalRequests: 0,
          successfulRequests: 0,
          avgResponseTime: model.avgLatency,
          avgQualityScore: model.qualityScore,
          costEfficiency: 1.0,
          lastUpdated: Date.now()
        });
      }
    });
  }

  /**
   * Filter candidate models based on context requirements
   */
  private filterCandidateModels(context: ContentContext): ModelCapability[] {
    return this.models.filter(model => {
      // Language support check
      if (!model.supportedLanguages.includes('en')) return false;
      
      // Budget constraint check
      if (context.budgetConstraint && model.costPerToken > context.budgetConstraint) return false;
      
      // Context window check (estimate prompt length)
      const estimatedTokens = context.platform === 'twitter' ? 500 : 2000;
      if (model.contextWindow < estimatedTokens) return false;
      
      // Urgency-based latency filtering
      if (context.urgency === 'high' && model.avgLatency > 2500) return false;
      
      return true;
    });
  }

  /**
   * Score models based on context suitability
   */
  private async scoreModels(
    candidates: ModelCapability[], 
    context: ContentContext
  ): Promise<Array<{ model: ModelCapability; score: number }>> {
    
    const scoredModels = candidates.map(model => {
      let score = 0;
      
      // Specialty alignment (40% of score)
      score += this.calculateSpecialtyScore(model.specialty, context) * 0.4;
      
      // Quality requirement matching (25% of score)
      const qualityScore = Math.min(model.qualityScore / context.qualityRequirement, 1);
      score += qualityScore * 0.25;
      
      // Performance history (20% of score)
      const metrics = this.performanceMetrics.get(model.id);
      if (metrics && metrics.totalRequests > 0) {
        const performanceScore = (metrics.avgQualityScore * metrics.costEfficiency) / 
                               (metrics.avgResponseTime / 1000); // Normalize latency
        score += Math.min(performanceScore, 1) * 0.2;
      } else {
        score += model.qualityScore * 0.2; // Fallback to base quality
      }
      
      // Cost efficiency (15% of score)
      const maxCost = Math.max(...candidates.map(m => m.costPerToken));
      const costScore = (maxCost - model.costPerToken) / maxCost;
      score += costScore * 0.15;
      
      return { model, score };
    });
    
    return scoredModels.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate specialty alignment score
   */
  private calculateSpecialtyScore(specialty: ModelSpecialty, context: ContentContext): number {
    const alignmentMatrix: Record<string, Record<ModelSpecialty, number>> = {
      'linkedin': {
        'instruction-following': 0.9,
        'conversational': 0.8,
        'social-media': 0.7,
        'marketing-copy': 0.8,
        'technical-content': 0.6,
        'creative-writing': 0.5,
        'general-purpose': 0.6
      },
      'twitter': {
        'social-media': 1.0,
        'conversational': 0.9,
        'creative-writing': 0.8,
        'marketing-copy': 0.7,
        'instruction-following': 0.6,
        'technical-content': 0.4,
        'general-purpose': 0.5
      },
      'instagram': {
        'creative-writing': 1.0,
        'social-media': 0.9,
        'marketing-copy': 0.8,
        'conversational': 0.7,
        'instruction-following': 0.5,
        'technical-content': 0.3,
        'general-purpose': 0.4
      }
    };

    const platformMatrix = alignmentMatrix[context.platform] || alignmentMatrix['linkedin'];
    return platformMatrix[specialty] || 0.5;
  }

  /**
   * Calculate selection confidence
   */
  private calculateSelectionConfidence(scoredCandidates: Array<{ model: ModelCapability; score: number }>): number {
    if (scoredCandidates.length < 2) return 1.0;
    
    const topScore = scoredCandidates[0].score;
    const secondScore = scoredCandidates[1].score;
    
    // Confidence is the gap between top and second choice
    const gap = topScore - secondScore;
    return Math.min(0.5 + gap, 1.0); // Base confidence of 50%
  }

  /**
   * Generate human-readable selection reasoning
   */
  private generateSelectionReasoning(
    selected: { model: ModelCapability; score: number },
    context: ContentContext,
    alternatives: Array<{ model: ModelCapability; score: number }>
  ): string[] {
    const reasons: string[] = [];
    
    reasons.push(`Specialty match: ${selected.model.specialty} aligns with ${context.platform} content needs`);
    
    if (selected.model.qualityScore >= context.qualityRequirement) {
      reasons.push(`Quality score ${selected.model.qualityScore} meets requirement ${context.qualityRequirement}`);
    }
    
    if (context.urgency === 'high' && selected.model.avgLatency <= 2000) {
      reasons.push(`Low latency (${selected.model.avgLatency}ms) suitable for high urgency`);
    }
    
    if (alternatives.length > 0) {
      const gap = selected.score - alternatives[0].score;
      if (gap > 0.2) {
        reasons.push(`Significantly outperformed alternatives (score gap: ${gap.toFixed(2)})`);
      }
    }
    
    const metrics = this.performanceMetrics.get(selected.model.id);
    if (metrics && metrics.totalRequests > 10) {
      const successRate = metrics.successfulRequests / metrics.totalRequests;
      if (successRate > 0.95) {
        reasons.push(`High historical success rate: ${(successRate * 100).toFixed(1)}%`);
      }
    }
    
    return reasons;
  }

  /**
   * Call the selected model
   */
  private async callModel(model: ModelCapability, prompt: string, context: ContentContext): Promise<string> {
    const token = await TokenManager.getToken();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${model.name}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'SocialPoster-AIOrchestrator/2.0.0'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: this.getOptimalParameters(model, context)
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new APIError(
          `Model ${model.name} failed: ${response.statusText}`,
          response.status >= 500,
          response.status
        );
      }
      
      const result: HuggingFaceResponse[] = await response.json();
      return result[0]?.generated_text || '';
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Get optimal parameters for model based on context
   */
  private getOptimalParameters(model: ModelCapability, context: ContentContext): any {
    const baseParams = {
      max_new_tokens: context.platform === 'twitter' ? 100 : 250,
      temperature: 0.7,
      top_p: 0.9,
      do_sample: true,
      repetition_penalty: 1.1
    };

    // Adjust based on model specialty
    switch (model.specialty) {
      case 'creative-writing':
        return { ...baseParams, temperature: 0.8, top_p: 0.95 };
      case 'instruction-following':
        return { ...baseParams, temperature: 0.6, repetition_penalty: 1.15 };
      case 'social-media':
        return { ...baseParams, temperature: 0.75, max_new_tokens: 150 };
      default:
        return baseParams;
    }
  }

  /**
   * Update model performance metrics
   */
  private async updateModelMetrics(modelId: string, responseTime: number, success: boolean): Promise<void> {
    const metrics = this.performanceMetrics.get(modelId);
    if (!metrics) return;

    metrics.totalRequests++;
    if (success) metrics.successfulRequests++;
    
    // Exponential moving average for response time
    const alpha = 0.1;
    metrics.avgResponseTime = alpha * responseTime + (1 - alpha) * metrics.avgResponseTime;
    
    // Update cost efficiency (requests per dollar estimate)
    const model = this.modelRegistry.get(modelId);
    if (model) {
      const estimatedCost = 500 * model.costPerToken; // Estimate 500 tokens per request
      metrics.costEfficiency = metrics.successfulRequests / (metrics.totalRequests * estimatedCost);
    }
    
    metrics.lastUpdated = Date.now();
    
    // Persist metrics to storage periodically
    if (metrics.totalRequests % 10 === 0) {
      await this.persistMetrics();
    }
  }

  /**
   * Generate cache key for model selection
   */
  private generateCacheKey(context: ContentContext): string {
    return `${context.platform}_${context.contentType}_${context.targetAudience}_${context.complexity}_${context.urgency}`;
  }

  /**
   * Check if cached selection is still valid
   */
  private isCacheValid(cached: ModelSelectionResult): boolean {
    // Cache valid for 1 hour
    return Date.now() - (cached as any).timestamp < 3600000;
  }

  /**
   * Estimate generation cost
   */
  private estimateCost(tokenCount: number, costPerToken: number): number {
    return tokenCount * costPerToken;
  }

  /**
   * Load performance history from storage
   */
  private async loadPerformanceHistory(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['ai_model_metrics']);
      if (result.ai_model_metrics) {
        const stored = JSON.parse(result.ai_model_metrics);
        Object.entries(stored).forEach(([modelId, metrics]) => {
          this.performanceMetrics.set(modelId, metrics as ModelPerformanceMetrics);
        });
      }
    } catch (error) {
      console.warn('[AIOrchestrator] Failed to load performance history:', error);
    }
  }

  /**
   * Persist metrics to storage
   */
  private async persistMetrics(): Promise<void> {
    try {
      const metricsObj: any = {};
      this.performanceMetrics.forEach((metrics, modelId) => {
        metricsObj[modelId] = metrics;
      });
      
      await chrome.storage.local.set({
        ai_model_metrics: JSON.stringify(metricsObj)
      });
    } catch (error) {
      console.warn('[AIOrchestrator] Failed to persist metrics:', error);
    }
  }
}