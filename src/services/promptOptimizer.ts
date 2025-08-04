/**
 * Dynamic Prompt Optimization Engine
 */
export class PromptOptimizer {
  private performanceHistory: Map<string, { success: number; total: number; avgScore: number }> = new Map();

  generateOptimizedPrompt(pageData: any, platform: string, userPrefs: any): string {
    const analysis = pageData.enhancedAnalysis || {};
    const basePrompt = this.buildContextualPrompt(pageData, platform, userPrefs, analysis);
    const optimizations = this.getOptimizationsForContext(analysis, platform);
    
    return this.applyOptimizations(basePrompt, optimizations, userPrefs);
  }

  private buildContextualPrompt(pageData: any, platform: string, userPrefs: any, analysis: any): string {
    // Dynamic prompt based on content analysis
    const roleDefinition = this.getRoleForContent(analysis);
    const contentFraming = this.getContentFraming(analysis, pageData);
    const platformInstructions = this.getPlatformInstructions(platform, analysis);
    const wordCountStrategy = this.getWordCountStrategy(userPrefs, analysis);
    
    return `${roleDefinition}

${contentFraming}

CONTENT ANALYSIS:
- Topics: ${analysis.semanticTopics?.join(', ') || 'General'}
- Sentiment: ${analysis.sentimentScore?.label || 'neutral'}
- Audience: ${analysis.targetAudience || 'general'}
- Intent: ${analysis.contentIntent || 'informational'}
- Engagement Potential: ${Math.round((analysis.engagementPotential?.score || 0.5) * 100)}%

ARTICLE DETAILS:
- Title: "${pageData.title}"
- URL: ${pageData.url}
- Description: ${pageData.description}

KEY INSIGHTS:
${pageData.keyPoints?.slice(0, 5).map((point: string, i: number) => `${i + 1}. ${point}`).join('\n') || 'No specific insights extracted'}

${platformInstructions}

${wordCountStrategy}

Create an engaging ${platform} post that resonates with the identified audience and maximizes engagement potential.`;
  }

  private getRoleForContent(analysis: any): string {
    const roles = {
      'AI/ML': 'You are a tech thought leader specializing in AI and machine learning, known for breaking down complex concepts.',
      'SEO/Marketing': 'You are a digital marketing expert with deep SEO knowledge, focused on practical, actionable advice.',
      'Technology': 'You are a seasoned technology professional who makes complex tech topics accessible to everyone.',
      'Business': 'You are a business strategist who helps professionals make better decisions through insightful analysis.',
      'Education': 'You are an educational content creator who excels at making learning engaging and accessible.'
    };

    const primaryTopic = analysis.semanticTopics?.[0] || 'Technology';
    return roles[primaryTopic as keyof typeof roles] || roles.Technology;
  }

  private getContentFraming(analysis: any, pageData: any): string {
    const intent = analysis.contentIntent || 'informational';
    const sentiment = analysis.sentimentScore?.label || 'neutral';
    
    const framings = {
      'educational': {
        'positive': 'Share this valuable learning resource that offers clear, actionable insights.',
        'negative': 'Address this important learning gap with constructive analysis and solutions.',
        'neutral': 'Break down this educational content to help others understand the key concepts.'
      },
      'problem-solving': {
        'positive': 'Highlight this effective solution that others can benefit from.',
        'negative': 'Discuss this challenging problem and potential approaches to address it.',
        'neutral': 'Analyze this problem-solution dynamic with balanced perspective.'
      },
      'informational': {
        'positive': 'Share these exciting developments and insights with your network.',
        'negative': 'Provide balanced analysis of these concerning developments.',
        'neutral': 'Share this informative content with thoughtful commentary.'
      }
    };

    return framings[intent as keyof typeof framings]?.[sentiment as keyof any] || 
           'Share this valuable content with your professional network.';
  }

  private getPlatformInstructions(platform: string, analysis: any): string {
    const engagementScore = analysis.engagementPotential?.score || 0.5;
    const viralityScore = analysis.viralityFactors?.score || 0.3;
    
    const instructions = {
      linkedin: `
LINKEDIN STRATEGY:
- Professional tone with thought leadership angle
- Include 2-3 key insights in bullet format
- ${engagementScore > 0.7 ? 'End with thought-provoking question' : 'End with call for discussion'}
- ${viralityScore > 0.6 ? 'Use attention-grabbing opening hook' : 'Start with professional context'}
- Include relevant professional hashtags (3-5)`,

      twitter: `
TWITTER STRATEGY:
- Punchy, concise delivery under 280 characters
- ${viralityScore > 0.6 ? 'Lead with strong hook or controversial take' : 'Start with intriguing statement'}
- Use thread format if needed for word count
- Include 2-3 relevant hashtags
- ${engagementScore > 0.7 ? 'Include call-to-action for retweets' : 'Focus on shareability'}`,

      instagram: `
INSTAGRAM STRATEGY:
- Visual storytelling approach
- Use line breaks for readability
- ${viralityScore > 0.6 ? 'Start with attention-grabbing statement' : 'Begin with personal connection'}
- Include 8-12 relevant hashtags
- End with "Link in bio" reference`,

      facebook: `
FACEBOOK STRATEGY:
- Conversational, community-focused tone
- ${engagementScore > 0.7 ? 'Include discussion starters' : 'Focus on relatability'}
- Use personal anecdotes or experiences
- Encourage comments and shares
- ${viralityScore > 0.6 ? 'Include emotional hooks' : 'Keep tone authentic'}`
    };

    return instructions[platform as keyof typeof instructions] || instructions.linkedin;
  }

  private getWordCountStrategy(userPrefs: any, analysis: any): string {
    const contentDepth = analysis.contentDepth?.score || 0.5;
    const engagementPotential = analysis.engagementPotential?.score || 0.5;
    
    let strategy = `
WORD COUNT REQUIREMENTS:
- MANDATORY: ${userPrefs.minWords} to ${userPrefs.maxWords} words exactly
- Count every word before responding`;

    if (contentDepth > 0.7) {
      strategy += `
- Use rich detail and specific examples to meet word count
- Break down complex concepts into digestible parts`;
    } else {
      strategy += `
- Expand with relevant context and practical applications
- Add personal insights or industry perspective`;
    }

    if (engagementPotential > 0.7) {
      strategy += `
- Include engaging questions or conversation starters
- Add calls-to-action to increase interaction`;
    }

    return strategy;
  }

  private getOptimizationsForContext(analysis: any, platform: string): string[] {
    const optimizations: string[] = [];
    
    // Content-based optimizations
    if (analysis.viralityFactors?.score > 0.6) {
      optimizations.push('viral-potential');
    }
    
    if (analysis.engagementPotential?.score > 0.7) {
      optimizations.push('high-engagement');
    }
    
    if (analysis.contentDepth?.score > 0.8) {
      optimizations.push('deep-content');
    }
    
    // Platform-specific optimizations
    if (platform === 'linkedin' && analysis.targetAudience === 'professionals') {
      optimizations.push('professional-focus');
    }
    
    return optimizations;
  }

  private applyOptimizations(basePrompt: string, optimizations: string[], userPrefs: any): string {
    let optimizedPrompt = basePrompt;
    
    const optimizationInstructions = {
      'viral-potential': '\n\nVIRAL OPTIMIZATION: Use attention-grabbing hooks, emotional triggers, and shareable insights.',
      'high-engagement': '\n\nENGAGEMENT OPTIMIZATION: Include interactive elements, questions, and conversation starters.',
      'deep-content': '\n\nDEPTH OPTIMIZATION: Provide comprehensive analysis with specific examples and detailed insights.',
      'professional-focus': '\n\nPROFESSIONAL OPTIMIZATION: Use industry terminology, business context, and career-relevant framing.'
    };
    
    optimizations.forEach(opt => {
      if (optimizationInstructions[opt as keyof typeof optimizationInstructions]) {
        optimizedPrompt += optimizationInstructions[opt as keyof typeof optimizationInstructions];
      }
    });
    
    // Add final enforcement
    optimizedPrompt += `

CRITICAL SUCCESS METRICS:
1. Word count: EXACTLY ${userPrefs.minWords}-${userPrefs.maxWords} words
2. Platform appropriateness: 100% aligned with platform best practices
3. Engagement optimization: Maximum shareability and interaction potential
4. Content accuracy: Faithful to source material while adding value

Generate the post now with these exact specifications.`;
    
    return optimizedPrompt;
  }

  // Track performance for continuous improvement
  recordPerformance(promptType: string, success: boolean, qualityScore: number): void {
    const key = promptType;
    const current = this.performanceHistory.get(key) || { success: 0, total: 0, avgScore: 0 };
    
    current.total += 1;
    if (success) current.success += 1;
    current.avgScore = (current.avgScore * (current.total - 1) + qualityScore) / current.total;
    
    this.performanceHistory.set(key, current);
  }

  getPerformanceInsights(): any {
    const insights: any = {};
    
    this.performanceHistory.forEach((stats, promptType) => {
      insights[promptType] = {
        successRate: stats.success / stats.total,
        averageQuality: stats.avgScore,
        totalAttempts: stats.total
      };
    });
    
    return insights;
  }
}