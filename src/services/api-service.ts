// API Service with secure token management
import type { AIGenerationParams, HuggingFaceResponse } from '../types/index';

export class APIError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean = false,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class TokenManager {
  private static readonly TOKEN_KEY = 'hf_api_token';
  private static readonly TOKEN_EXPIRY_KEY = 'hf_token_expiry';
  
  static async getToken(): Promise<string> {
    try {
      const result = await chrome.storage.local.get([this.TOKEN_KEY, this.TOKEN_EXPIRY_KEY]);
      const token = result[this.TOKEN_KEY];
      const expiry = result[this.TOKEN_EXPIRY_KEY];
      
      if (!token) {
        throw new APIError('API token not configured. Please set up your Hugging Face token in settings.', false);
      }
      
      // Check if token is expired (if expiry is set)
      if (expiry && Date.now() > expiry) {
        throw new APIError('API token has expired. Please refresh your token.', false);
      }
      
      return token;
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError('Failed to retrieve API token', false, undefined, error as Error);
    }
  }
  
  static async setToken(token: string, expiryDays?: number): Promise<void> {
    const storage: Record<string, any> = { [this.TOKEN_KEY]: token };
    
    if (expiryDays) {
      storage[this.TOKEN_EXPIRY_KEY] = Date.now() + (expiryDays * 24 * 60 * 60 * 1000);
    }
    
    await chrome.storage.local.set(storage);
  }
  
  static async clearToken(): Promise<void> {
    await chrome.storage.local.remove([this.TOKEN_KEY, this.TOKEN_EXPIRY_KEY]);
  }
  
  static async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: 'test' })
      });
      
      return response.status !== 401;
    } catch {
      return false;
    }
  }
}

export class HuggingFaceService {
  private static readonly BASE_URL = 'https://api-inference.huggingface.co';
  private static readonly RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff
  
  static async generateText(prompt: string, params: AIGenerationParams): Promise<string> {
    const token = await TokenManager.getToken();
    
    return this.retryWithBackoff(async () => {
      const response = await fetch(`${this.BASE_URL}/models/microsoft/DialoGPT-large`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'SocialPoster/1.2.0'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: params.parameters
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new APIError(
          `Text generation failed: ${errorText}`,
          response.status >= 500, // Server errors are retryable
          response.status
        );
      }
      
      const result: HuggingFaceResponse[] = await response.json();
      return result[0]?.generated_text || '';
    });
  }
  
  static async generateImage(prompt: string, params: AIGenerationParams): Promise<Blob> {
    const token = await TokenManager.getToken();
    
    return this.retryWithBackoff(async () => {
      const response = await fetch(`${this.BASE_URL}/models/stabilityai/stable-diffusion-2-1`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'SocialPoster/1.2.0'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: params.parameters
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new APIError(
          `Image generation failed: ${errorText}`,
          response.status >= 500,
          response.status
        );
      }
      
      return response.blob();
    });
  }
  
  private static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof APIError && 
        error.retryable && 
        retryCount < this.RETRY_DELAYS.length
      ) {
        await this.delay(this.RETRY_DELAYS[retryCount]!);
        return this.retryWithBackoff(operation, retryCount + 1);
      }
      throw error;
    }
  }
  
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}