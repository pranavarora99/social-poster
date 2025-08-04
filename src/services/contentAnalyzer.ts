/**
 * Advanced Content Analysis Pipeline
 */
export class ContentAnalyzer {
  private readonly semanticKeywords = {
    'AI/ML': ['artificial intelligence', 'machine learning', 'neural network', 'deep learning', 'algorithm', 'model training', 'data science'],
    'SEO/Marketing': ['search engine', 'keyword', 'backlink', 'ranking', 'seo', 'digital marketing', 'content strategy', 'ahrefs', 'semrush'],
    'Technology': ['software', 'development', 'programming', 'code', 'tech', 'digital', 'platform', 'api', 'framework'],
    'Business': ['revenue', 'profit', 'strategy', 'growth', 'market', 'customer', 'sales', 'roi', 'business model'],
    'Education': ['learn', 'tutorial', 'guide', 'course', 'teaching', 'education', 'training', 'skill', 'knowledge']
  };

  private readonly sentimentPatterns = {
    positive: /\b(excellent|amazing|great|fantastic|wonderful|outstanding|impressive|brilliant)\b/gi,
    negative: /\b(terrible|awful|bad|horrible|disappointing|frustrating|useless|waste)\b/gi,
    neutral: /\b(okay|average|standard|typical|normal|reasonable|adequate)\b/gi
  };

  analyzeContent(pageData: any): any {
    const fullText = `${pageData.title} ${pageData.description} ${pageData.keyPoints?.join(' ') || ''}`.toLowerCase();
    
    return {
      ...pageData,
      enhancedAnalysis: {
        semanticTopics: this.extractSemanticTopics(fullText),
        sentimentScore: this.analyzeSentiment(fullText),
        contentDepth: this.assessContentDepth(pageData),
        readabilityScore: this.calculateReadability(fullText),
        keywordsExtracted: this.extractKeywords(fullText),
        contentStructure: this.analyzeStructure(pageData),
        engagementPotential: this.predictEngagement(fullText, pageData),
        targetAudience: this.identifyAudience(fullText),
        contentIntent: this.identifyIntent(fullText),
        viralityFactors: this.assessViralityFactors(fullText, pageData)
      }
    };
  }

  private extractSemanticTopics(text: string): string[] {
    const topics: string[] = [];
    
    Object.entries(this.semanticKeywords).forEach(([topic, keywords]) => {
      const matchCount = keywords.filter(keyword => text.includes(keyword)).length;
      const relevanceScore = matchCount / keywords.length;
      
      if (relevanceScore > 0.2) { // 20% keyword match threshold
        topics.push(topic);
      }
    });

    return topics;
  }

  private analyzeSentiment(text: string): { score: number; label: string } {
    let score = 0;
    
    const positiveMatches = (text.match(this.sentimentPatterns.positive) || []).length;
    const negativeMatches = (text.match(this.sentimentPatterns.negative) || []).length;
    const neutralMatches = (text.match(this.sentimentPatterns.neutral) || []).length;
    
    score = (positiveMatches - negativeMatches) / Math.max(1, positiveMatches + negativeMatches + neutralMatches);
    
    let label = 'neutral';
    if (score > 0.2) label = 'positive';
    else if (score < -0.2) label = 'negative';
    
    return { score, label };
  }

  private assessContentDepth(pageData: any): { score: number; factors: string[] } {
    let score = 0;
    const factors: string[] = [];
    
    // Length indicators
    if (pageData.description?.length > 200) {
      score += 0.3;
      factors.push('comprehensive-description');
    }
    
    if (pageData.keyPoints?.length > 5) {
      score += 0.3;
      factors.push('multiple-key-points');
    }
    
    // Quality indicators
    const hasNumbers = /\d+/.test(pageData.description || '');
    if (hasNumbers) {
      score += 0.2;
      factors.push('data-driven');
    }
    
    const hasSpecificTerms = /\b(specifically|exactly|precisely|detailed|comprehensive)\b/i.test(pageData.description || '');
    if (hasSpecificTerms) {
      score += 0.2;
      factors.push('specific-language');
    }
    
    return { score: Math.min(score, 1), factors };
  }

  private calculateReadability(text: string): number {
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const syllables = this.countSyllables(text);
    
    // Simplified Flesch Reading Ease
    const flesch = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
    return Math.max(0, Math.min(100, flesch)) / 100; // Normalize to 0-1
  }

  private countSyllables(text: string): number {
    return text.toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace(/[aeiouy]+/g, 'a')
      .replace(/a$/, '')
      .length || 1;
  }

  private extractKeywords(text: string): string[] {
    const words = text.split(/\s+/)
      .map(w => w.replace(/[^\w]/g, '').toLowerCase())
      .filter(w => w.length > 3);
    
    const frequency: { [key: string]: number } = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .filter(([_, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private analyzeStructure(pageData: any): { type: string; score: number } {
    const keyPoints = pageData.keyPoints || [];
    const description = pageData.description || '';
    
    // Detect list-based content
    if (keyPoints.length > 3 && keyPoints.some((point: string) => /^\d+\./.test(point))) {
      return { type: 'numbered-list', score: 0.9 };
    }
    
    // Detect tutorial/guide structure
    if (description.includes('how to') || description.includes('step') || description.includes('guide')) {
      return { type: 'tutorial', score: 0.8 };
    }
    
    // Detect review structure
    if (description.includes('review') || description.includes('pros') || description.includes('cons')) {
      return { type: 'review', score: 0.8 };
    }
    
    return { type: 'general', score: 0.5 };
  }

  private predictEngagement(text: string, pageData: any): { score: number; factors: string[] } {
    let score = 0;
    const factors: string[] = [];
    
    // Question-based content drives engagement
    if (text.includes('?')) {
      score += 0.2;
      factors.push('contains-questions');
    }
    
    // Controversial or opinion-based content
    const opinionWords = ['believe', 'think', 'opinion', 'disagree', 'controversial'];
    if (opinionWords.some(word => text.includes(word))) {
      score += 0.3;
      factors.push('opinion-based');
    }
    
    // Practical/actionable content
    const actionWords = ['how to', 'tips', 'guide', 'tutorial', 'steps'];
    if (actionWords.some(word => text.includes(word))) {
      score += 0.3;
      factors.push('actionable-content');
    }
    
    // Trending topics (simplified)
    const trendingWords = ['ai', '2025', 'new', 'latest', 'trending', 'viral'];
    if (trendingWords.some(word => text.includes(word))) {
      score += 0.2;
      factors.push('trending-topic');
    }
    
    return { score: Math.min(score, 1), factors };
  }

  private identifyAudience(text: string): string {
    const audienceIndicators = {
      'beginners': ['beginner', 'start', 'basic', 'introduction', 'new to', 'getting started'],
      'professionals': ['professional', 'enterprise', 'advanced', 'expert', 'industry', 'business'],
      'developers': ['code', 'programming', 'development', 'api', 'technical', 'software'],
      'marketers': ['marketing', 'seo', 'content', 'strategy', 'audience', 'engagement'],
      'entrepreneurs': ['business', 'startup', 'entrepreneur', 'growth', 'revenue', 'profit']
    };
    
    let maxScore = 0;
    let primaryAudience = 'general';
    
    Object.entries(audienceIndicators).forEach(([audience, keywords]) => {
      const score = keywords.filter(keyword => text.includes(keyword)).length;
      if (score > maxScore) {
        maxScore = score;
        primaryAudience = audience;
      }
    });
    
    return primaryAudience;
  }

  private identifyIntent(text: string): string {
    const intentPatterns = {
      'educational': /\b(learn|teach|explain|understand|knowledge|education)\b/i,
      'promotional': /\b(buy|purchase|discount|offer|deal|price)\b/i,
      'informational': /\b(news|update|announce|report|information)\b/i,
      'entertainment': /\b(fun|funny|entertaining|amusing|interesting)\b/i,
      'problem-solving': /\b(problem|solution|fix|solve|troubleshoot|help)\b/i
    };
    
    for (const [intent, pattern] of Object.entries(intentPatterns)) {
      if (pattern.test(text)) {
        return intent;
      }
    }
    
    return 'general';
  }

  private assessViralityFactors(text: string, pageData: any): { score: number; factors: string[] } {
    let score = 0;
    const factors: string[] = [];
    
    // Emotional triggers
    const emotionalTriggers = ['shocking', 'amazing', 'unbelievable', 'secret', 'insider', 'exclusive'];
    if (emotionalTriggers.some(trigger => text.includes(trigger))) {
      score += 0.3;
      factors.push('emotional-triggers');
    }
    
    // Numbers and statistics
    if (/\d+%|\d+x|#\d+/.test(text)) {
      score += 0.2;
      factors.push('data-driven');
    }
    
    // Curiosity gaps
    const curiosityWords = ['secret', 'hidden', 'unknown', 'revealed', 'exposed'];
    if (curiosityWords.some(word => text.includes(word))) {
      score += 0.2;
      factors.push('curiosity-gap');
    }
    
    // Social proof indicators
    const socialProofWords = ['everyone', 'millions', 'popular', 'trending', 'viral'];
    if (socialProofWords.some(word => text.includes(word))) {
      score += 0.3;
      factors.push('social-proof');
    }
    
    return { score: Math.min(score, 1), factors };
  }
}