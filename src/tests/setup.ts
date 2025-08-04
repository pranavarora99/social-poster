/**
 * Jest Test Setup Configuration
 * Global test environment setup for Social Poster Extension
 */

// Mock Chrome Extension APIs
const mockChrome = {
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined)
    }
  },
  runtime: {
    getManifest: jest.fn(() => ({ 
      version: '2.0.0-test',
      name: 'Social Poster Test'
    })),
    id: 'test-extension-id',
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn().mockResolvedValue([{
      id: 1,
      url: 'https://example.com',
      title: 'Test Page',
      active: true,
      currentWindow: true
    }]),
    create: jest.fn().mockResolvedValue({
      id: 2,
      url: 'https://example.com/new'
    })
  },
  scripting: {
    executeScript: jest.fn().mockResolvedValue([{ result: 'success' }])
  }
};

// Mock Web APIs
const mockWebAPIs = {
  fetch: jest.fn(),
  crypto: {
    getRandomValues: jest.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
    subtle: {
      generateKey: jest.fn().mockResolvedValue({} as CryptoKey),
      importKey: jest.fn().mockResolvedValue({} as CryptoKey),
      exportKey: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(64)),
      decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
    }
  },
  performance: {
    now: jest.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 10000000,
      totalJSHeapSize: 20000000,
      jsHeapSizeLimit: 100000000
    }
  },
  requestIdleCallback: jest.fn((callback) => {
    setTimeout(callback, 0);
    return 1;
  }),
  cancelIdleCallback: jest.fn()
};

// Mock DOM APIs
const mockDOMAPIs = {
  document: {
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    createElement: jest.fn(() => ({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(),
        toggle: jest.fn()
      },
      style: {},
      innerHTML: '',
      textContent: '',
      onclick: null
    })),
    createTreeWalker: jest.fn(() => ({
      nextNode: jest.fn().mockReturnValue(null),
      currentNode: null
    })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: 'complete',
    hidden: false,
    title: 'Test Document',
    body: {
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      appendChild: jest.fn(),
      removeChild: jest.fn()
    }
  },
  window: {
    location: {
      href: 'https://example.com/test',
      hostname: 'example.com',
      protocol: 'https:',
      pathname: '/test'
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    setTimeout: jest.fn((callback) => {
      callback();
      return 1;
    }),
    clearTimeout: jest.fn(),
    setInterval: jest.fn(() => 1),
    clearInterval: jest.fn(),
    getComputedStyle: jest.fn(() => ({
      getPropertyValue: jest.fn(),
      backgroundColor: 'rgb(255, 255, 255)',
      color: 'rgb(0, 0, 0)',
      display: 'block',
      visibility: 'visible',
      opacity: '1'
    })),
    btoa: jest.fn((str) => Buffer.from(str, 'binary').toString('base64')),
    atob: jest.fn((str) => Buffer.from(str, 'base64').toString('binary'))
  },
  NodeFilter: {
    SHOW_ELEMENT: 1,
    SHOW_TEXT: 4,
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3
  },
  Node: {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9
  }
};

// Mock third-party libraries
const mockLibraries = {
  DOMPurify: {
    sanitize: jest.fn((input) => {
      if (typeof input === 'string') {
        return input.replace(/<script[^>]*>.*?<\/script>/gi, '');
      }
      return input;
    }),
    isValidAttribute: jest.fn(() => true)
  }
};

// Console utilities for tests
const originalConsole = global.console;
const mockConsole = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Setup global mocks
beforeAll(() => {
  // Chrome APIs
  (global as any).chrome = mockChrome;
  
  // Web APIs
  global.fetch = mockWebAPIs.fetch as any;
  (global as any).crypto = mockWebAPIs.crypto;
  (global as any).performance = mockWebAPIs.performance;
  (global as any).requestIdleCallback = mockWebAPIs.requestIdleCallback;
  (global as any).cancelIdleCallback = mockWebAPIs.cancelIdleCallback;
  
  // DOM APIs
  (global as any).document = mockDOMAPIs.document;
  (global as any).window = mockDOMAPIs.window;
  (global as any).NodeFilter = mockDOMAPIs.NodeFilter;
  (global as any).Node = mockDOMAPIs.Node;
  
  // Third-party libraries
  (global as any).DOMPurify = mockLibraries.DOMPurify;
  
  // Mock console in tests (optional - can be enabled for cleaner test output)
  if (process.env.JEST_SILENT === 'true') {
    global.console = mockConsole as any;
  }
  
  // Mock TextEncoder/TextDecoder for Node.js environment
  (global as any).TextEncoder = TextEncoder;
  (global as any).TextDecoder = TextDecoder;
  
  // Mock URL constructor
  if (typeof URL === 'undefined') {
    (global as any).URL = class MockURL {
      constructor(public href: string, base?: string) {
        if (base && !href.startsWith('http')) {
          this.href = new URL(href, base).href;
        }
        const url = new URL(this.href);
        this.protocol = url.protocol;
        this.hostname = url.hostname;
        this.pathname = url.pathname;
        this.search = url.search;
        this.hash = url.hash;
      }
      
      protocol: string = 'https:';
      hostname: string = 'example.com';
      pathname: string = '/';
      search: string = '';
      hash: string = '';
      
      toString() {
        return this.href;
      }
    };
  }
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  
  // Reset DOM state
  if (mockDOMAPIs.document.body) {
    mockDOMAPIs.document.body.innerHTML = '';
  }
  
  // Reset Chrome storage mock
  mockChrome.storage.local.get.mockResolvedValue({});
});

// Restore original console after all tests
afterAll(() => {
  if (process.env.JEST_SILENT === 'true') {
    global.console = originalConsole;
  }
});

// Utility functions for tests
export const testUtils = {
  // Helper to mock Chrome storage data
  mockChromeStorage: (data: Record<string, any>) => {
    mockChrome.storage.local.get.mockImplementation((keys) => {
      if (Array.isArray(keys)) {
        const result: Record<string, any> = {};
        keys.forEach(key => {
          if (data[key] !== undefined) {
            result[key] = data[key];
          }
        });
        return Promise.resolve(result);
      } else if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: data[keys] });
      } else if (typeof keys === 'object' && keys !== null) {
        const result: Record<string, any> = {};
        Object.keys(keys).forEach(key => {
          result[key] = data[key] !== undefined ? data[key] : keys[key];
        });
        return Promise.resolve(result);
      }
      return Promise.resolve(data);
    });
  },
  
  // Helper to mock fetch responses
  mockFetchResponse: (data: any, ok: boolean = true, status: number = 200) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
      blob: () => Promise.resolve(new Blob([JSON.stringify(data)])),
      headers: new Map([['content-type', 'application/json']])
    });
  },
  
  // Helper to mock DOM elements
  mockDOMElement: (tagName: string, attributes: Record<string, any> = {}) => {
    const element = {
      tagName: tagName.toUpperCase(),
      ...attributes,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      setAttribute: jest.fn(),
      getAttribute: jest.fn((attr: string) => attributes[attr]),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(),
        toggle: jest.fn()
      },
      style: {},
      innerHTML: attributes.innerHTML || '',
      textContent: attributes.textContent || attributes.innerHTML || '',
      offsetWidth: attributes.offsetWidth || 100,
      offsetHeight: attributes.offsetHeight || 100,
      hidden: attributes.hidden || false,
      closest: jest.fn(),
      matches: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn()
    };
    
    return element;
  },
  
  // Helper to create mock page data
  createMockPageData: (overrides: Partial<any> = {}) => ({
    url: 'https://example.com/test-article',
    title: 'Test Article Title',
    description: 'This is a test article description for testing purposes.',
    keyPoints: [
      'First key point with sufficient length for testing',
      'Second key point also with good content for validation'
    ],
    images: ['https://example.com/image1.jpg'],
    brandColors: {
      primary: '#3366cc',
      secondary: '#6699ff'
    },
    ...overrides
  }),
  
  // Helper to wait for async operations
  waitFor: (ms: number = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to simulate user interactions
  simulateClick: (element: any) => {
    if (element.onclick) {
      element.onclick();
    }
    if (element.addEventListener.mock.calls.length > 0) {
      const clickHandler = element.addEventListener.mock.calls
        .find(([event]: [string]) => event === 'click')?.[1];
      if (clickHandler) {
        clickHandler();
      }
    }
  },
  
  // Helper to check if object matches expected shape
  expectObjectShape: (obj: any, shape: Record<string, string>) => {
    Object.keys(shape).forEach(key => {
      expect(obj).toHaveProperty(key);
      expect(typeof obj[key]).toBe(shape[key]);
    });
  }
};

// Make test utils available globally
(global as any).testUtils = testUtils;

// Custom matchers
expect.extend({
  toBeValidURL(received: string) {
    try {
      new URL(received);
      return {
        message: () => `expected ${received} not to be a valid URL`,
        pass: true
      };
    } catch {
      return {
        message: () => `expected ${received} to be a valid URL`,
        pass: false
      };
    }
  },
  
  toHaveValidTimestamp(received: any) {
    const timestamp = typeof received === 'object' ? received.timestamp : received;
    const isValid = typeof timestamp === 'number' && 
                   timestamp > 0 && 
                   timestamp <= Date.now();
    
    return {
      message: () => isValid 
        ? `expected ${timestamp} not to be a valid timestamp`
        : `expected ${timestamp} to be a valid timestamp`,
      pass: isValid
    };
  }
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidURL(): R;
      toHaveValidTimestamp(): R;
    }
  }
}

export default mockChrome;