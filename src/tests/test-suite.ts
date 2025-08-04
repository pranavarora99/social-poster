/**
 * Comprehensive Test Suite for Social Poster Extension
 * Implements Google's testing standards with Jest-compatible assertions
 */

// Mock Chrome APIs for testing
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  runtime: {
    getManifest: jest.fn(() => ({ version: '2.0.0-test' })),
    id: 'test-extension-id',
    onMessage: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn()
  }
};

// Setup global mocks
(global as any).chrome = mockChrome;
(global as any).fetch = jest.fn();
(global as any).crypto = require('crypto').webcrypto;
(global as any).DOMPurify = {
  sanitize: jest.fn((input) => input.replace(/<script.*?<\/script>/gi, ''))
};

// Import modules under test
import { SecureCredentialManager } from '../services/secure-credential-manager';
import { TokenManager, APIError } from '../services/api-service';
import { EnterpriseInputValidator } from '../utils/enterprise-input-validator';
import { OptimizedContentExtractor } from '../services/optimized-content-extractor';
import { IntelligentAIOrchestrator } from '../services/intelligent-ai-orchestrator';
import { memoryManager } from '../utils/enterprise-memory-manager';

describe('Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SecureCredentialManager', () => {
    test('should encrypt credentials before storage', async () => {
      const testCredential = 'hf_test_token_12345';
      mockChrome.storage.local.set.mockResolvedValue(undefined);

      await SecureCredentialManager.storeCredential('test_cred', testCredential);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'secure_cred_test_cred': expect.objectContaining({
            data: expect.any(String),
            iv: expect.any(String),
            metadata: expect.objectContaining({
              created: expect.any(Number),
              keyVersion: expect.any(String)
            }),
            checksum: expect.any(String)
          })
        })
      );
    });

    test('should validate credential format', () => {
      expect(SecureCredentialManager.validateCredential('hf_valid_token_123456789012345678901234567890')).toBe(true);
      expect(SecureCredentialManager.validateCredential('invalid_token')).toBe(false);
      expect(SecureCredentialManager.validateCredential('')).toBe(false);
      expect(SecureCredentialManager.validateCredential('javascript:alert(1)')).toBe(false);
    });

    test('should handle expired credentials', async () => {
      const expiredCredential = {
        data: 'encrypted_data',
        iv: 'initialization_vector',
        metadata: {
          created: Date.now() - 1000,
          expires: Date.now() - 500, // Expired 500ms ago
          keyVersion: 'v1',
          environment: 'test' as const
        },
        checksum: 'checksum'
      };

      mockChrome.storage.local.get.mockResolvedValue({
        'secure_cred_test_expired': expiredCredential
      });
      mockChrome.storage.local.remove.mockResolvedValue(undefined);

      await expect(SecureCredentialManager.getCredential('test_expired'))
        .rejects.toThrow('Credential expired');

      expect(mockChrome.storage.local.remove).toHaveBeenCalledWith(['secure_cred_test_expired']);
    });
  });

  describe('TokenManager with Circuit Breaker', () => {
    test('should handle API failures gracefully', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});

      await expect(TokenManager.getToken())
        .rejects.toThrow('API token not configured');
    });

    test('should validate token format before storage', async () => {
      await expect(TokenManager.setToken('invalid_token'))
        .rejects.toThrow('Invalid token format provided');
    });

    test('should implement circuit breaker pattern', async () => {
      // Mock network failures
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      mockChrome.storage.local.get.mockResolvedValue({
        'secure_cred_hf_access_token': {
          data: 'encrypted_token',
          iv: 'iv',
          metadata: { created: Date.now(), keyVersion: 'v1', environment: 'test' },
          checksum: 'checksum'
        }
      });

      // First few calls should fail and trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await TokenManager.validateToken('test_token');
        } catch (error) {
          // Expected failures
        }
      }

      // Circuit breaker should now be open
      const state = TokenManager.getCircuitBreakerState();
      expect(state).toContain('failures: 3');
    });
  });
});

describe('Input Validation Tests', () => {
  describe('URL Validation', () => {
    test('should accept valid HTTPS URLs', () => {
      const result = EnterpriseInputValidator.validateURL('https://example.com/article');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject malicious URLs', () => {
      const maliciousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd'
      ];

      maliciousUrls.forEach(url => {
        const result = EnterpriseInputValidator.validateURL(url);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.rule === 'protocol' || e.rule === 'security')).toBe(true);
      });
    });

    test('should detect XSS in URLs', () => {
      const xssUrl = 'https://example.com/?q=<script>alert(1)</script>';
      const result = EnterpriseInputValidator.validateURL(xssUrl);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.rule === 'xss')).toBe(true);
    });

    test('should sanitize URLs properly', () => {
      const dirtyUrl = 'https://example.com/path?param=<>"\'&value';
      const result = EnterpriseInputValidator.validateURL(dirtyUrl);
      expect(result.sanitizedValue).not.toContain('<');
      expect(result.sanitizedValue).not.toContain('>');
    });
  });

  describe('Content Validation', () => {
    test('should validate text content length', () => {
      const shortContent = 'Hi';
      const result = EnterpriseInputValidator.validateTextContent(shortContent, 'content', {
        minLength: 10
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.rule === 'min_length')).toBe(true);
    });

    test('should detect SQL injection attempts', () => {
      const sqlContent = "'; DROP TABLE users; --";
      const result = EnterpriseInputValidator.validateTextContent(sqlContent, 'content', {
        strictMode: true
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.rule === 'sql_injection')).toBe(true);
    });

    test('should detect command injection attempts', () => {
      const cmdContent = 'content && rm -rf /';
      const result = EnterpriseInputValidator.validateTextContent(cmdContent, 'content', {
        strictMode: true
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.rule === 'command_injection')).toBe(true);
    });

    test('should sanitize HTML content', () => {
      const htmlContent = '<p>Good content</p><script>alert(1)</script>';
      const result = EnterpriseInputValidator.validateTextContent(htmlContent, 'content', {
        allowHTML: true
      });
      expect(result.sanitizedValue).toContain('<p>Good content</p>');
      expect(result.sanitizedValue).not.toContain('<script>');
    });
  });

  describe('Page Data Validation', () => {
    test('should validate complete page data structure', () => {
      const validPageData = {
        url: 'https://example.com/article',
        title: 'Test Article Title',
        description: 'This is a valid description for testing purposes.',
        keyPoints: [
          'First key point with sufficient length',
          'Second key point also with good content'
        ],
        images: ['https://example.com/image1.jpg'],
        brandColors: {
          primary: '#3366cc',
          secondary: '#6699ff'
        }
      };

      const result = EnterpriseInputValidator.validatePageData(validPageData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid page data', () => {
      const invalidPageData = {
        url: 'not-a-url',
        title: 'Hi', // Too short
        description: '', // Empty
        keyPoints: 'not-an-array',
        images: [123], // Invalid image URLs
        brandColors: {
          primary: 'not-a-color',
          secondary: '#invalid'
        }
      };

      const result = EnterpriseInputValidator.validatePageData(invalidPageData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Performance Tests', () => {
  describe('OptimizedContentExtractor', () => {
    // Mock DOM for testing
    beforeEach(() => {
      const mockDocument = {
        body: {
          querySelector: jest.fn(),
          querySelectorAll: jest.fn(() => []),
          createTreeWalker: jest.fn(() => ({
            nextNode: jest.fn().mockReturnValue(null)
          }))
        },
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        createTreeWalker: jest.fn(() => ({
          nextNode: jest.fn().mockReturnValue(null)
        })),
        title: 'Test Page Title'
      };

      (global as any).document = mockDocument;
      (global as any).window = {
        location: { href: 'https://example.com/test' },
        getComputedStyle: jest.fn(() => ({}))
      };
      (global as any).NodeFilter = {
        SHOW_ELEMENT: 1,
        SHOW_TEXT: 4,
        FILTER_ACCEPT: 1,
        FILTER_REJECT: 2
      };
      (global as any).Node = {
        ELEMENT_NODE: 1,
        TEXT_NODE: 3
      };
    });

    test('should extract page data efficiently', async () => {
      const extractor = new OptimizedContentExtractor();
      const startTime = performance.now();
      
      const result = await extractor.extractPageData();
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('keyPoints');
      expect(result).toHaveProperty('images');
      expect(result).toHaveProperty('brandColors');

      // Performance assertion - should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });

    test('should handle extraction errors gracefully', async () => {
      // Mock error in DOM traversal
      (global as any).document.createTreeWalker = jest.fn(() => {
        throw new Error('DOM traversal failed');
      });

      const extractor = new OptimizedContentExtractor();
      const result = await extractor.extractPageData();

      // Should return fallback data instead of crashing
      expect(result.title).toBeDefined();
      expect(result.url).toBeDefined();
    });
  });

  describe('IntelligentAIOrchestrator', () => {
    test('should select optimal model based on context', async () => {
      const orchestrator = new IntelligentAIOrchestrator();
      
      const context = {
        platform: 'linkedin',
        contentType: 'professional',
        targetAudience: 'business',
        complexity: 0.8,
        urgency: 'medium' as const,
        qualityRequirement: 0.9
      };

      const selection = await orchestrator.selectOptimalModel(context);
      
      expect(selection.selectedModel).toBeDefined();
      expect(selection.confidence).toBeGreaterThan(0);
      expect(selection.reasoning).toBeInstanceOf(Array);
      expect(selection.reasoning.length).toBeGreaterThan(0);
    });

    test('should handle model selection errors', async () => {
      const orchestrator = new IntelligentAIOrchestrator();
      
      const invalidContext = {
        platform: 'invalid-platform',
        contentType: 'unknown',
        targetAudience: 'none',
        complexity: -1,
        urgency: 'invalid' as any,
        qualityRequirement: 2.0 // Invalid quality requirement
      };

      const selection = await orchestrator.selectOptimalModel(invalidContext);
      
      // Should still return a valid selection (fallback)
      expect(selection.selectedModel).toBeDefined();
      expect(selection.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Memory Management Tests', () => {
  test('should create and manage object pools', () => {
    const poolName = 'test-pool';
    
    memoryManager.createObjectPool(
      poolName,
      () => ({ value: 0 }),
      (obj) => { obj.value = 0; },
      10
    );

    const obj1 = memoryManager.acquire(poolName);
    const obj2 = memoryManager.acquire(poolName);

    expect(obj1).toBeDefined();
    expect(obj2).toBeDefined();
    expect(obj1).not.toBe(obj2);

    // Modify objects
    if (obj1) obj1.value = 42;
    if (obj2) obj2.value = 84;

    // Release objects back to pool
    if (obj1) memoryManager.release(poolName, obj1);
    if (obj2) memoryManager.release(poolName, obj2);

    // Acquire again - should get reset objects
    const obj3 = memoryManager.acquire(poolName);
    expect(obj3?.value).toBe(0); // Should be reset
  });

  test('should implement intelligent caching', () => {
    const testKey = 'test-cache-key';
    const testValue = { data: 'test data', timestamp: Date.now() };

    // Set cache value
    memoryManager.cacheSet(testKey, testValue);

    // Retrieve cache value
    const retrieved = memoryManager.cacheGet(testKey);
    expect(retrieved).toEqual(testValue);

    // Test cache miss
    const nonExistent = memoryManager.cacheGet('non-existent-key');
    expect(nonExistent).toBeNull();
  });

  test('should handle TTL expiration', (done) => {
    const testKey = 'ttl-test-key';
    const testValue = { data: 'temporary data' };
    const ttl = 100; // 100ms TTL

    memoryManager.cacheSet(testKey, testValue, ttl);

    // Should be available immediately
    expect(memoryManager.cacheGet(testKey)).toEqual(testValue);

    // Should expire after TTL
    setTimeout(() => {
      expect(memoryManager.cacheGet(testKey)).toBeNull();
      done();
    }, ttl + 50);
  });

  test('should provide memory metrics', () => {
    const metrics = memoryManager.getMemoryMetrics();
    
    expect(metrics).toHaveProperty('heapUsed');
    expect(metrics).toHaveProperty('heapTotal');
    expect(metrics).toHaveProperty('cacheSize');
    expect(metrics).toHaveProperty('poolsSize');
    expect(metrics).toHaveProperty('lastCleanup');
    
    expect(typeof metrics.cacheSize).toBe('number');
    expect(typeof metrics.poolsSize).toBe('number');
  });

  test('should perform forced cleanup', async () => {
    // Add some cache entries
    memoryManager.cacheSet('cleanup-test-1', { data: 'test1' });
    memoryManager.cacheSet('cleanup-test-2', { data: 'test2' }, 1); // 1ms TTL

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 10));

    // Force cleanup
    await memoryManager.forceCleanup();

    // Expired entries should be cleaned up
    expect(memoryManager.cacheGet('cleanup-test-2')).toBeNull();
    
    // Non-expired entries should remain
    expect(memoryManager.cacheGet('cleanup-test-1')).toBeDefined();
  });
});

describe('Integration Tests', () => {
  test('should integrate all components for content generation', async () => {
    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{
        generated_text: 'This is a test generated social media post about the article content. It demonstrates the integration of all components working together.'
      }])
    });

    // Mock page data
    const pageData = {
      url: 'https://example.com/test-article',
      title: 'Test Article: AI Integration',
      description: 'A comprehensive test article about AI integration in social media tools.',
      keyPoints: [
        'AI models can intelligently select optimal parameters',
        'Security validation prevents malicious content',
        'Memory management ensures optimal performance'
      ],
      images: ['https://example.com/test-image.jpg'],
      brandColors: { primary: '#3366cc', secondary: '#6699ff' }
    };

    // Validate inputs
    const validation = EnterpriseInputValidator.validatePageData(pageData);
    expect(validation.isValid).toBe(true);

    // Test AI orchestrator
    const orchestrator = new IntelligentAIOrchestrator();
    const context = {
      platform: 'linkedin',
      contentType: 'article',
      targetAudience: 'professionals',
      complexity: 0.7,
      urgency: 'medium' as const,
      qualityRequirement: 0.85
    };

    const result = await orchestrator.generateWithOptimalModel(
      'Generate a LinkedIn post about this article...',
      context
    );

    expect(result.content).toBeDefined();
    expect(result.modelUsed).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.metrics.confidence).toBeGreaterThan(0);
  });

  test('should handle complete workflow errors gracefully', async () => {
    // Mock API failure
    (global.fetch as jest.Mock).mockRejectedValue(new Error('API unavailable'));

    const orchestrator = new IntelligentAIOrchestrator();
    const context = {
      platform: 'twitter',
      contentType: 'news',
      targetAudience: 'general',
      complexity: 0.5,
      urgency: 'high' as const,
      qualityRequirement: 0.7
    };

    await expect(orchestrator.generateWithOptimalModel('Test prompt', context))
      .rejects.toThrow('AI generation failed');
  });
});

// Performance benchmarks
describe('Performance Benchmarks', () => {
  test('content extraction should complete under performance threshold', async () => {
    const iterations = 10;
    const maxTimePerIteration = 50; // 50ms max
    
    const extractor = new OptimizedContentExtractor();
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await extractor.extractPageData();
      const end = performance.now();
      times.push(end - start);
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxTime = Math.max(...times);

    console.log(`Content extraction - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    
    expect(avgTime).toBeLessThan(maxTimePerIteration);
    expect(maxTime).toBeLessThan(maxTimePerIteration * 2); // Allow some variance
  });

  test('memory operations should be efficient', () => {
    const iterations = 1000;
    const maxTimeTotal = 100; // 100ms for 1000 operations
    
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      memoryManager.cacheSet(`perf-test-${i}`, { value: i });
      memoryManager.cacheGet(`perf-test-${i}`);
    }
    
    const end = performance.now();
    const totalTime = end - start;
    
    console.log(`Memory operations (${iterations}x) - Total: ${totalTime.toFixed(2)}ms`);
    
    expect(totalTime).toBeLessThan(maxTimeTotal);
  });
});

export default {
  // Export test configuration
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**',
    '!src/**/*.test.ts'
  ]
};