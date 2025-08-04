/**
 * AI Ensemble Service - Multi-model approach with quality scoring
 */
export class AIEnsembleService {
  private models = [
    { 
      name: 'Qwen/Qwen2.5-Coder-32B-Instruct', 
      weight: 0.4, 
      specialty: 'instruction-following',
      maxTokens: 4000 
    },
    { 
      name: 'mistralai/Mixtral-8x7B-Instruct-v0.1', 
      weight: 0.3, 
      specialty: 'conversational',
      maxTokens: 3000 
    },
    { 
      name: 'microsoft/DialoGPT-large', 
      weight: 0.2, 
      specialty: 'social-media',
      maxTokens: 2000 
    },
    { 
      name: 'HuggingFaceH4/zephyr-7b-beta', 
      weight: 0.1, 
      specialty: 'general',
      maxTokens: 1500 
    }
  ];

  async generateWithEnsemble(prompt: string, options: any): Promise<string> {
    // Run multiple models in parallel
    const promises = this.models.map(model => 
      this.callModelWithTimeout(model, prompt, options)
    );

    const results = await Promise.allSettled(promises);
    const validResults = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(content => content && content.length > 20);

    if (validResults.length === 0) {
      throw new Error('All models failed to generate content');
    }

    // Score and select best result
    const scoredResults = validResults.map(content => ({
      content,
      score: this.scoreContent(content, options)
    }));

    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults[0].content;
  }

  private async callModelWithTimeout(model: any, prompt: string, options: any): Promise<string> {
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Model timeout')), 15000)
    );

    const apiCall = fetch(`https://api-inference.huggingface.co/models/${model.name}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAPIToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: Math.min(options.maxWords * 8, model.maxTokens),
          min_length: options.minWords * 4,
          temperature: 0.7,
          do_sample: true,
          top_p: 0.9
        }
      })
    });

    const response = await Promise.race([apiCall, timeout]) as Response;
    const result = await response.json();
    return result[0]?.generated_text || '';
  }

  private scoreContent(content: string, options: any): number {
    let score = 0;
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Word count accuracy (40% of score)
    const targetRange = options.maxWords - options.minWords;
    const wordCountScore = Math.max(0, 1 - Math.abs(wordCount - (options.minWords + targetRange/2)) / targetRange);
    score += wordCountScore * 0.4;

    // Content quality (30% of score)
    const qualityScore = this.assessContentQuality(content);
    score += qualityScore * 0.3;

    // Platform appropriateness (20% of score)
    const platformScore = this.assessPlatformFit(content, options.platform);
    score += platformScore * 0.2;

    // Engagement potential (10% of score)
    const engagementScore = this.assessEngagementPotential(content);
    score += engagementScore * 0.1;

    return score;
  }

  private assessContentQuality(content: string): number {
    let score = 0;
    
    // Check for variety in sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 3) score += 0.3;
    
    // Check for specific details vs generic content
    const specificityKeywords = ['specific', 'exactly', 'precisely', 'detailed', 'comprehensive'];
    if (specificityKeywords.some(word => content.toLowerCase().includes(word))) score += 0.2;
    
    // Check for actionability
    const actionWords = ['implement', 'try', 'consider', 'apply', 'use', 'adopt'];
    if (actionWords.some(word => content.toLowerCase().includes(word))) score += 0.3;
    
    // Check for balanced tone
    if (!content.includes('!!!') && !content.includes('amazing!!!')) score += 0.2;
    
    return Math.min(score, 1);
  }

  private assessPlatformFit(content: string, platform: string): number {
    const platformRequirements = {
      linkedin: {
        professional: /\b(insights?|perspectives?|approaches?|strategies?|professional)\b/i,
        networking: /\b(thoughts|experience|colleagues|network|community)\b/i,
        questionEnd: /\?\s*$/
      },
      twitter: {
        brevity: content.length < 280,
        hashtags: /#\w+/g,
        punchiness: /\b(must|essential|key|critical|important)\b/i
      },
      instagram: {
        hashtags: /#\w+/g,
        visual: /\b(visual|image|photo|see|look|watch)\b/i
      }
    };

    const reqs = platformRequirements[platform as keyof typeof platformRequirements];
    if (!reqs) return 0.5;

    let score = 0;
    Object.values(reqs).forEach(req => {
      if (typeof req === 'boolean' && req) score += 0.33;
      else if (req instanceof RegExp && req.test(content)) score += 0.33;
    });

    return Math.min(score, 1);
  }

  private assessEngagementPotential(content: string): number {
    let score = 0;
    
    // Questions encourage engagement
    if (content.includes('?')) score += 0.4;
    
    // Call-to-action phrases
    const ctaWords = ['share', 'comment', 'thoughts', 'experience', 'agree', 'disagree'];
    if (ctaWords.some(word => content.toLowerCase().includes(word))) score += 0.3;
    
    // Emotional hooks
    const emotionalWords = ['excited', 'fascinated', 'surprised', 'impressed', 'concerned'];
    if (emotionalWords.some(word => content.toLowerCase().includes(word))) score += 0.3;
    
    return Math.min(score, 1);
  }

  private async getAPIToken(): Promise<string> {
    const result = await chrome.storage.local.get(['hf_api_token']);
    return result.hf_api_token || '';
  }
}