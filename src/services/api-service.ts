// Enterprise API Service with secure token management and circuit breakers
import type { AIGenerationParams, HuggingFaceResponse } from '../types/index';
import { SecureCredentialManager } from './secure-credential-manager';

export class APIError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean = false,
    public readonly statusCode?: number,
    public readonly originalError?: Error,
    public readonly circuitBreakerTripped: boolean = false
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Circuit Breaker Pattern Implementation
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly monitor: string = 'default'
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new APIError(`Circuit breaker OPEN for ${this.monitor}`, false, undefined, undefined, true);
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
  
  getState(): string {
    return `${this.state} (failures: ${this.failures})`;
  }
}

/**
 * Enhanced Token Manager with secure storage
 */
export class TokenManager {
  private static readonly CREDENTIAL_ID = 'hf_access_token';
  private static circuitBreaker = new CircuitBreaker(3, 30000, 'TokenManager');
  
  static async getToken(): Promise<string> {
    return this.circuitBreaker.execute(async () => {
      try {
        const token = await SecureCredentialManager.getCredential(this.CREDENTIAL_ID);
        
        if (!token) {
          throw new APIError('API token not configured. Please authenticate via OAuth.', false);
        }
        
        // Validate token format
        if (!SecureCredentialManager.validateCredential(token, 'api_token')) {
          throw new APIError('Invalid token format detected.', false);
        }
        
        // Check if rotation is needed
        const rotationNeeded = await SecureCredentialManager.rotateCredentialIfNeeded(this.CREDENTIAL_ID);
        if (rotationNeeded) {
          console.warn('[TokenManager] Token rotation recommended');
        }
        
        return token;
        
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError('Failed to retrieve API token', false, undefined, error as Error);
      }
    });
  }
  
  static async setToken(token: string, expiryMs?: number): Promise<void> {
    try {
      // Validate token before storing
      if (!SecureCredentialManager.validateCredential(token, 'api_token')) {
        throw new APIError('Invalid token format provided', false);
      }
      
      const options = expiryMs ? { expires: Date.now() + expiryMs } : {};
      await SecureCredentialManager.storeCredential(this.CREDENTIAL_ID, token, options);
      
    } catch (error) {
      throw new APIError('Failed to store API token', false, undefined, error as Error);
    }
  }
  
  static async clearToken(): Promise<void> {
    try {
      await SecureCredentialManager.deleteCredential(this.CREDENTIAL_ID);
    } catch (error) {
      throw new APIError('Failed to clear API token', false, undefined, error as Error);
    }
  }
  
  static async validateToken(token: string): Promise<{ valid: boolean; details?: any }> {
    return this.circuitBreaker.execute(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('https://api-inference.huggingface.co/whoami', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'SocialPoster/2.0.0'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const details = await response.json();
          return { valid: true, details };
        }
        
        return { valid: false, details: { status: response.status, statusText: response.statusText } };
        
      } catch (error) {
        return { valid: false, details: { error: error.message } };
      }
    });
  }
  
  static getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
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