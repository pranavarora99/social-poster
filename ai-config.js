// Hugging Face AI Configuration for Social Poster
const AI_CONFIG = {
  // Hugging Face Inference Provider Settings
  huggingFace: {
    baseUrl: 'https://router.huggingface.co/v1',
    providers: {
      // Fast & Free options
      free: {
        model: 'meta-llama/Llama-3.2-3B-Instruct', // Fast, good quality
        provider: 'hf-inference-api'
      },
      // High quality options
      premium: {
        model: 'moonshotai/Kimi-K2-Instruct', // Your suggested model
        provider: 'together'
      },
      // Ultra fast for real-time
      speed: {
        model: 'Qwen/Qwen2.5-7B-Instruct', // Groq for speed
        provider: 'groq'
      }
    }
  },

  // Model selection based on use case
  modelSelection: {
    linkedin: 'moonshotai/Kimi-K2-Instruct', // Professional content
    twitter: 'meta-llama/Llama-3.2-3B-Instruct', // Quick & witty
    instagram: 'moonshotai/Kimi-K2-Instruct', // Creative captions
    facebook: 'meta-llama/Llama-3.2-3B-Instruct' // Conversational
  },

  // System prompts optimized for each model
  systemPrompts: {
    'moonshotai/Kimi-K2-Instruct': {
      temperature: 0.7,
      max_tokens: 500,
      style: 'Professional and comprehensive'
    },
    'meta-llama/Llama-3.2-3B-Instruct': {
      temperature: 0.8,
      max_tokens: 400,
      style: 'Conversational and engaging'
    },
    'Qwen/Qwen2.5-7B-Instruct': {
      temperature: 0.7,
      max_tokens: 300,
      style: 'Concise and impactful'
    }
  },

  // Image generation for future features
  imageGeneration: {
    model: 'black-forest-labs/FLUX.1-dev',
    provider: 'together',
    settings: {
      width: 1024,
      height: 1024,
      num_inference_steps: 25
    }
  }
};

// API Integration Class
class HuggingFaceAI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = AI_CONFIG.huggingFace.baseUrl;
  }

  async generateContent(prompt, platform = 'linkedin', style = 'professional') {
    try {
      const model = AI_CONFIG.modelSelection[platform];
      const settings = AI_CONFIG.systemPrompts[model];

      const response = await fetch(this.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(platform, style)
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: settings.temperature,
          max_tokens: settings.max_tokens
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;

    } catch (error) {
      console.error('HuggingFace AI Error:', error);
      throw error;
    }
  }

  getSystemPrompt(platform, style) {
    const prompts = {
      linkedin: {
        professional: `You are a LinkedIn content expert. Create professional, engaging posts that:
- Start with a compelling hook
- Use numbered insights or bullet points
- Include relevant industry keywords and hashtags
- End with a thought-provoking question
- Maintain an authoritative yet approachable tone
- Optimize for engagement and shares`,
        
        modern: `You are a LinkedIn influencer creating viral content. Your posts:
- Start with personal stories or bold statements
- Use short paragraphs and strategic line breaks
- Include emotional triggers and relatability
- Create curiosity gaps
- Focus on transformation and results`
      },
      
      twitter: {
        professional: `You are a Twitter thread expert. Create educational threads that:
- Hook with bold claims or surprising facts
- Use numbered tweets for easy following
- Include actionable takeaways
- Keep each part under 280 characters
- Optimize for retweets and bookmarks`,
        
        modern: `You are a viral Twitter personality. Create threads that:
- Start with spicy or controversial takes
- Use conversational, punchy language
- Include strategic emojis
- Create FOMO and urgency
- End with engagement calls`
      },
      
      instagram: {
        professional: `You are an Instagram business content creator. Create captions that:
- Lead with value propositions
- Use line breaks for readability
- Include relevant emojis
- Add 20-30 strategic hashtags
- Optimize for saves and shares`
      },
      
      facebook: {
        professional: `You are a Facebook content strategist. Create posts that:
- Tell relatable stories
- Build emotional connections
- Encourage community engagement
- Include clear CTAs
- Optimize for shares and comments`
      }
    };

    return prompts[platform]?.[style] || prompts.linkedin.professional;
  }

  // Generate image for visual content (future feature)
  async generateImage(prompt, platform = 'instagram') {
    const settings = platform === 'instagram' 
      ? { width: 1080, height: 1080 } // Square for Instagram
      : { width: 1200, height: 630 }; // Landscape for others

    try {
      const response = await fetch('https://api-inference.huggingface.co/models/' + AI_CONFIG.imageGeneration.model, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            ...AI_CONFIG.imageGeneration.settings,
            ...settings
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Image generation failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);

    } catch (error) {
      console.error('Image generation error:', error);
      throw error;
    }
  }

  // Enhance content with AI
  async enhanceContent(content, enhancementType = 'hooks') {
    const enhancementPrompts = {
      hooks: `Generate 5 compelling hooks for this content: "${content}"
Include: curiosity gap, statistical, contrarian, personal story, and prediction hooks.`,
      
      hashtags: `Generate 10 optimal hashtags for this social media content: "${content}"
Mix high-volume and niche tags. Include trending topics.`,
      
      cta: `Create 5 different call-to-action options for this post: "${content}"
Vary between engagement types: likes, comments, shares, saves, follows.`
    };

    return this.generateContent(
      enhancementPrompts[enhancementType],
      'linkedin',
      'professional'
    );
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AI_CONFIG, HuggingFaceAI };
}