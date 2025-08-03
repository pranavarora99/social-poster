// AI Service Integration for Social Poster
class AIContentGenerator {
  constructor() {
    // You can use OpenAI, Claude, or any AI API
    // For MVP, we'll use structured generation without API calls
    // In production, integrate with AI APIs
    this.apiKey = null; // Set via settings
    this.aiProvider = 'openai'; // or 'claude', 'gemini'
  }

  // Main generation method
  async generateContent(pageData, platform, style, userSettings) {
    try {
      // For MVP - using template-based generation
      // In production - replace with actual AI API calls
      
      if (this.apiKey) {
        // Production: Call AI API
        return await this.callAIAPI(pageData, platform, style, userSettings);
      } else {
        // MVP: Enhanced template generation
        return this.enhancedTemplateGeneration(pageData, platform, style, userSettings);
      }
    } catch (error) {
      console.error('AI generation failed:', error);
      // Fallback to template generation
      return this.enhancedTemplateGeneration(pageData, platform, style, userSettings);
    }
  }

  // Enhanced template generation with AI-like intelligence
  enhancedTemplateGeneration(pageData, platform, style, userSettings) {
    const { title, description, keyPoints, url } = pageData;
    
    // Analyze content type
    const contentType = this.detectContentType(title, description);
    
    // Generate optimized content
    const hook = this.generateSmartHook(title, description, contentType);
    const points = this.optimizeKeyPoints(keyPoints, platform);
    const hashtags = this.generatePlatformHashtags(title, description, platform);
    const cta = this.generateEngagingCTA(platform, contentType);
    
    // Platform-specific formatting
    switch (platform) {
      case 'linkedin':
        return this.formatLinkedInPost(hook, points, hashtags, cta, url, style);
      case 'twitter':
        return this.formatTwitterThread(hook, points, hashtags, cta, url, style);
      case 'instagram':
        return this.formatInstagramPost(hook, points, hashtags, cta, style);
      case 'facebook':
        return this.formatFacebookPost(hook, description, points, cta, url, style);
      default:
        return hook + '\n\n' + points.join('\n') + '\n\n' + cta;
    }
  }

  // Content type detection
  detectContentType(title, description) {
    const patterns = {
      tutorial: /how to|guide|tutorial|step-by-step|learn/i,
      news: /announces|launches|reveals|breaking|new/i,
      opinion: /why|should|must|opinion|thinks/i,
      case_study: /case study|success story|achieved|results/i,
      product: /introducing|features|benefits|pricing/i,
      list: /\d+\s+(ways|tips|reasons|things|steps)/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(title + ' ' + description)) {
        return type;
      }
    }
    return 'general';
  }

  // Smart hook generation
  generateSmartHook(title, description, contentType) {
    const hooks = {
      tutorial: [
        `Stop struggling with ${this.extractTopic(title)}. Here's the exact method that works:`,
        `I just discovered the simplest way to ${this.extractAction(title)}:`,
        `The step-by-step guide to ${this.extractAction(title)} that actually works:`
      ],
      news: [
        `BREAKING: ${title}`,
        `🚨 This changes everything: ${this.extractKeyPoint(title)}`,
        `Just announced: ${title}`
      ],
      opinion: [
        `Unpopular opinion: ${this.extractContrarian(title)}`,
        `We need to talk about ${this.extractTopic(title)}`,
        `The truth about ${this.extractTopic(title)} that no one tells you:`
      ],
      case_study: [
        `How we ${this.extractResult(title)} (real numbers inside):`,
        `From 0 to ${this.extractNumber(title)} in record time:`,
        `The exact strategy behind ${this.extractResult(title)}:`
      ],
      list: [
        title, // Lists often work best with original title
        `Everyone should know these ${this.extractNumber(title)} ${this.extractTopic(title)}:`,
        `I tested ${this.extractNumber(title)} ${this.extractTopic(title)}. Here are the winners:`
      ],
      general: [
        `💡 ${title}`,
        `Here's what you need to know about ${this.extractTopic(title)}:`,
        `${title} (and why it matters):`
      ]
    };

    const typeHooks = hooks[contentType] || hooks.general;
    return typeHooks[Math.floor(Math.random() * typeHooks.length)];
  }

  // Key points optimization
  optimizeKeyPoints(points, platform) {
    const platformLimits = {
      linkedin: 5,
      twitter: 4,
      instagram: 4,
      facebook: 3
    };

    const limit = platformLimits[platform] || 5;
    const optimized = points.slice(0, limit);

    // Add emojis and formatting
    return optimized.map((point, index) => {
      const emojis = ['🎯', '💡', '🚀', '⚡', '🔥', '✨', '📈', '🎨'];
      const emoji = emojis[index % emojis.length];
      
      if (platform === 'linkedin' || platform === 'facebook') {
        return `${index + 1}. ${point}`;
      } else if (platform === 'twitter') {
        return `${emoji} ${point}`;
      } else {
        return `• ${point}`;
      }
    });
  }

  // Platform-specific hashtag generation
  generatePlatformHashtags(title, description, platform) {
    const content = (title + ' ' + description).toLowerCase();
    const hashtags = new Set();

    // Common tech/business hashtags
    const techTerms = {
      'ai': ['#AI', '#ArtificialIntelligence', '#MachineLearning'],
      'neural': ['#DeepLearning', '#NeuralNetworks', '#AI'],
      'javascript': ['#JavaScript', '#WebDev', '#Programming'],
      'python': ['#Python', '#Programming', '#DataScience'],
      'react': ['#ReactJS', '#Frontend', '#WebDev'],
      'startup': ['#Startup', '#Entrepreneurship', '#Business'],
      'growth': ['#Growth', '#GrowthHacking', '#Business'],
      'marketing': ['#Marketing', '#DigitalMarketing', '#ContentMarketing']
    };

    // Add relevant hashtags
    for (const [term, tags] of Object.entries(techTerms)) {
      if (content.includes(term)) {
        tags.forEach(tag => hashtags.add(tag));
      }
    }

    // Platform-specific hashtags
    const platformTags = {
      linkedin: ['#LinkedInLearning', '#ProfessionalDevelopment'],
      twitter: ['#TechTwitter', '#100DaysOfCode'],
      instagram: ['#TechCommunity', '#CodeLife'],
      facebook: ['#TechTips', '#LearnToCode']
    };

    if (platformTags[platform]) {
      platformTags[platform].forEach(tag => {
        if (hashtags.size < 7) hashtags.add(tag);
      });
    }

    // Add trending hashtags (in production, fetch from API)
    const trending = ['#Innovation', '#FutureOfWork', '#TechTrends2024'];
    trending.forEach(tag => {
      if (hashtags.size < 10) hashtags.add(tag);
    });

    return Array.from(hashtags).slice(0, platform === 'instagram' ? 30 : 7).join(' ');
  }

  // Engaging CTA generation
  generateEngagingCTA(platform, contentType) {
    const ctas = {
      linkedin: {
        tutorial: "What's your favorite method? Share in the comments!",
        news: "How will this impact your industry? Let's discuss 👇",
        opinion: "Agree or disagree? I'd love to hear your perspective!",
        case_study: "What's been your experience? Share your story below!",
        general: "What are your thoughts on this? Join the conversation!"
      },
      twitter: {
        tutorial: "Drop a 🔥 if this helped!\n\nRT to help others!",
        news: "RT if you think this is game-changing!",
        opinion: "QT with your take! Let's debate 🧵",
        case_study: "Have you tried this? Share your results below!",
        general: "Bookmark this thread!\n\nFollow for more insights 🚀"
      },
      instagram: {
        tutorial: "Save this for later! ⚡\n\nWhich tip will you try first?",
        news: "Double tap if you're excited about this! ❤️",
        opinion: "Drop your thoughts in the comments! 💭",
        case_study: "Tag someone who needs to see this! 🏷️",
        general: "Follow for more content like this! 🔔"
      },
      facebook: {
        tutorial: "Which step was most helpful? Comment below!",
        news: "Share this with your network!",
        opinion: "What's your take? Let's discuss!",
        case_study: "Has anyone else experienced this?",
        general: "Like and share if you found this valuable!"
      }
    };

    return ctas[platform]?.[contentType] || ctas[platform]?.general || "Share your thoughts!";
  }

  // Platform formatters
  formatLinkedInPost(hook, points, hashtags, cta, url, style) {
    const formats = {
      professional: `${hook}

${points.join('\n\n')}

${cta}

${hashtags}

Full article → ${url}`,
      
      modern: `${hook}

Here's what I learned:

${points.join('\n\n')}

The biggest surprise? 

Number ${Math.floor(Math.random() * points.length) + 1}.

${cta}

${hashtags}

🔗 ${url}`,

      minimal: `${hook}

${points.slice(0, 3).join('\n')}

${url}

${hashtags}`
    };

    return formats[style] || formats.professional;
  }

  formatTwitterThread(hook, points, hashtags, cta, url, style) {
    const formats = {
      professional: [
        `${hook}\n\nA thread 🧵\n\n1/`,
        ...points.map((point, i) => `${i + 2}/ ${point}`),
        `${points.length + 2}/ ${cta}\n\n${url}\n\n${hashtags}`
      ],
      
      modern: [
        `${hook}\n\nLet me explain 👇\n\n1/`,
        ...points.map((point, i) => `${i + 2}/ ${point}\n\n(this is important)`),
        `${points.length + 2}/ If you found this valuable:\n\n${cta}\n\n${url}`
      ],

      minimal: [
        `${hook}`,
        ...points.slice(0, 2),
        `${url}`
      ]
    };

    return (formats[style] || formats.professional).join('\n\n');
  }

  formatInstagramPost(hook, points, hashtags, cta, style) {
    const formats = {
      professional: `${hook}

${points.map(p => p + ' ✓').join('\n\n')}

${cta}

•
•
•

${hashtags}`,

      modern: `${hook} 🔥

${points.join('\n\n✨ ')}

${cta}

-
${hashtags}`,

      minimal: `${hook}

${points.slice(0, 3).join('\n')}

${hashtags.split(' ').slice(0, 10).join(' ')}`
    };

    return formats[style] || formats.professional;
  }

  formatFacebookPost(hook, description, points, cta, url, style) {
    const formats = {
      professional: `${hook}

${description}

Key takeaways:
${points.join('\n')}

${cta}

Read more: ${url}`,

      modern: `${hook}

Here's the deal 👇

${points.join('\n\n💡 ')}

${cta}

Full story → ${url}`,

      minimal: `${hook}

${points[0]}

${url}`
    };

    return formats[style] || formats.professional;
  }

  // Helper methods
  extractTopic(text) {
    // Remove common words and extract main topic
    const cleaned = text.toLowerCase()
      .replace(/how to|guide to|tutorial|the|a|an/gi, '')
      .trim();
    return cleaned.split(' ').slice(0, 3).join(' ');
  }

  extractAction(text) {
    const match = text.match(/to\s+(\w+\s+\w+)/i);
    return match ? match[1] : this.extractTopic(text);
  }

  extractNumber(text) {
    const match = text.match(/\d+/);
    return match ? match[0] : '5';
  }

  extractResult(text) {
    const cleaned = text.toLowerCase()
      .replace(/how we|case study|achieved/gi, '')
      .trim();
    return cleaned;
  }

  extractKeyPoint(text) {
    return text.split(/[:.!?]/)[0];
  }

  extractContrarian(text) {
    return text.toLowerCase().includes('not') || text.includes("n't") 
      ? text 
      : text.replace(/is|are|will/i, "isn't actually");
  }

  // Future: Actual AI API integration
  async callAIAPI(pageData, platform, style, userSettings) {
    // This would integrate with OpenAI, Claude, etc.
    // Example structure:
    
    const endpoint = this.getAIEndpoint();
    const prompt = this.buildAIPrompt(pageData, platform, style);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: AI_PROMPTS[platform][style].system },
          { role: 'user', content: AI_PROMPTS[platform][style].user(pageData) }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }

  getAIEndpoint() {
    const endpoints = {
      openai: 'https://api.openai.com/v1/chat/completions',
      claude: 'https://api.anthropic.com/v1/messages',
      gemini: 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent'
    };
    return endpoints[this.aiProvider];
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIContentGenerator;
}