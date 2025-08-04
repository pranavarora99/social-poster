/**
 * Enterprise-Grade Input Validation and Sanitization
 * Implements OWASP security guidelines and Google's secure coding standards
 */

import DOMPurify from 'isomorphic-dompurify';

interface ValidationRule {
  name: string;
  validate: (value: any) => boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface SanitizationConfig {
  allowedTags: string[];
  allowedAttributes: Record<string, string[]>;
  stripIgnoreTag: boolean;
  stripIgnoreTagBody: string[];
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitizedValue?: any;
}

interface ValidationError {
  field: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  value?: any;
}

interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export class EnterpriseInputValidator {
  private static readonly MAX_STRING_LENGTH = 10000;
  private static readonly MAX_ARRAY_LENGTH = 100;
  private static readonly MAX_OBJECT_DEPTH = 10;
  
  // URL validation patterns
  private static readonly URL_PROTOCOLS = ['http:', 'https:'];
  private static readonly SUSPICIOUS_URL_PATTERNS = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /file:/i,
    /ftp:/i
  ];

  // Content security patterns
  private static readonly XSS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi
  ];

  private static readonly SQL_INJECTION_PATTERNS = [
    /('|(\\')|(;)|(\|\|)|(--)|(%27)|(%3B)|(%3D)/i,
    /(union\s+select)/i,
    /(drop\s+table)/i,
    /(insert\s+into)/i,
    /(delete\s+from)/i
  ];

  // Command injection patterns
  private static readonly COMMAND_INJECTION_PATTERNS = [
    /[;&|`$(){}[\]]/,
    /\.\.\//,
    /\/etc\/passwd/i,
    /\/bin\//i,
    /cmd\.exe/i,
    /powershell/i
  ];

  /**
   * Validate URL input with comprehensive security checks
   */
  static validateURL(url: string, field: string = 'url'): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Basic format validation
      if (!url || typeof url !== 'string') {
        errors.push({
          field,
          rule: 'required',
          message: 'URL is required and must be a string',
          severity: 'error'
        });
        return { isValid: false, errors, warnings };
      }

      // Length validation
      if (url.length > 2048) {
        errors.push({
          field,
          rule: 'max_length',
          message: 'URL exceeds maximum length of 2048 characters',
          severity: 'error',
          value: url.length
        });
      }

      // URL format validation
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        errors.push({
          field,
          rule: 'format',
          message: 'Invalid URL format',
          severity: 'error',
          value: url
        });
        return { isValid: false, errors, warnings };
      }

      // Protocol validation
      if (!this.URL_PROTOCOLS.includes(parsedUrl.protocol)) {
        errors.push({
          field,
          rule: 'protocol',
          message: `Unsupported protocol: ${parsedUrl.protocol}. Only HTTP/HTTPS allowed.`,
          severity: 'error',
          value: parsedUrl.protocol
        });
      }

      // Suspicious pattern detection
      this.SUSPICIOUS_URL_PATTERNS.forEach(pattern => {
        if (pattern.test(url)) {
          errors.push({
            field,
            rule: 'security',
            message: 'URL contains potentially malicious content',
            severity: 'error',
            value: url
          });
        }
      });

      // Domain validation
      if (parsedUrl.hostname.includes('localhost') || 
          parsedUrl.hostname.includes('127.0.0.1') ||
          parsedUrl.hostname.includes('0.0.0.0')) {
        warnings.push({
          field,
          message: 'Local/internal URLs may not be accessible',
          suggestion: 'Use publicly accessible URLs for better results'
        });
      }

      // XSS pattern detection in URL
      this.XSS_PATTERNS.forEach(pattern => {
        if (pattern.test(url)) {
          errors.push({
            field,
            rule: 'xss',
            message: 'URL contains potential XSS payload',
            severity: 'error'
          });
        }
      });

      const sanitizedUrl = this.sanitizeURL(url);
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitizedValue: sanitizedUrl
      };

    } catch (error) {
      errors.push({
        field,
        rule: 'validation_error',
        message: `URL validation failed: ${error.message}`,
        severity: 'error'
      });
      
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Validate and sanitize text content
   */
  static validateTextContent(
    content: string, 
    field: string = 'content',
    options: { 
      maxLength?: number;
      minLength?: number;
      allowHTML?: boolean;
      strictMode?: boolean;
    } = {}
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const { maxLength = 5000, minLength = 1, allowHTML = false, strictMode = true } = options;

    if (!content || typeof content !== 'string') {
      errors.push({
        field,
        rule: 'required',
        message: 'Content is required and must be a string',
        severity: 'error'
      });
      return { isValid: false, errors, warnings };
    }

    // Length validation
    if (content.length < minLength) {
      errors.push({
        field,
        rule: 'min_length',
        message: `Content must be at least ${minLength} characters`,
        severity: 'error',
        value: content.length
      });
    }

    if (content.length > maxLength) {
      errors.push({
        field,
        rule: 'max_length',
        message: `Content exceeds maximum length of ${maxLength} characters`,
        severity: 'error',
        value: content.length
      });
    }

    // Security validation
    if (strictMode) {
      // XSS detection
      this.XSS_PATTERNS.forEach(pattern => {
        if (pattern.test(content)) {
          errors.push({
            field,
            rule: 'xss',
            message: 'Content contains potential XSS payload',
            severity: 'error'
          });
        }
      });

      // SQL injection detection
      this.SQL_INJECTION_PATTERNS.forEach(pattern => {
        if (pattern.test(content)) {
          errors.push({
            field,
            rule: 'sql_injection',
            message: 'Content contains potential SQL injection payload',
            severity: 'error'
          });
        }
      });

      // Command injection detection
      this.COMMAND_INJECTION_PATTERNS.forEach(pattern => {
        if (pattern.test(content)) {
          errors.push({
            field,
            rule: 'command_injection',
            message: 'Content contains potential command injection payload',
            severity: 'error'
          });
        }
      });
    }

    // Sanitize content
    const sanitizedContent = allowHTML 
      ? this.sanitizeHTML(content)
      : this.sanitizePlainText(content);

    // Content quality warnings
    if (content.includes('�')) {
      warnings.push({
        field,
        message: 'Content contains invalid UTF-8 characters',
        suggestion: 'Check content encoding'
      });
    }

    if (content.trim().length !== content.length) {
      warnings.push({
        field,
        message: 'Content has leading/trailing whitespace',
        suggestion: 'Trim whitespace for consistency'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedValue: sanitizedContent
    };
  }

  /**
   * Validate page data structure
   */
  static validatePageData(pageData: any, field: string = 'pageData'): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!pageData || typeof pageData !== 'object') {
      errors.push({
        field,
        rule: 'required',
        message: 'Page data is required and must be an object',
        severity: 'error'
      });
      return { isValid: false, errors, warnings };
    }

    // Validate required fields
    const requiredFields = ['url', 'title', 'description'];
    requiredFields.forEach(requiredField => {
      if (!pageData[requiredField]) {
        errors.push({
          field: `${field}.${requiredField}`,
          rule: 'required',
          message: `${requiredField} is required`,
          severity: 'error'
        });
      }
    });

    // Validate URL
    if (pageData.url) {
      const urlValidation = this.validateURL(pageData.url, `${field}.url`);
      errors.push(...urlValidation.errors);
      warnings.push(...urlValidation.warnings);
    }

    // Validate title
    if (pageData.title) {
      const titleValidation = this.validateTextContent(
        pageData.title, 
        `${field}.title`,
        { maxLength: 200, minLength: 5 }
      );
      errors.push(...titleValidation.errors);
      warnings.push(...titleValidation.warnings);
    }

    // Validate description
    if (pageData.description) {
      const descValidation = this.validateTextContent(
        pageData.description,
        `${field}.description`,
        { maxLength: 1000, minLength: 10 }
      );
      errors.push(...descValidation.errors);
      warnings.push(...descValidation.warnings);
    }

    // Validate keyPoints array
    if (pageData.keyPoints) {
      if (!Array.isArray(pageData.keyPoints)) {
        errors.push({
          field: `${field}.keyPoints`,
          rule: 'type',
          message: 'keyPoints must be an array',
          severity: 'error'
        });
      } else {
        if (pageData.keyPoints.length > this.MAX_ARRAY_LENGTH) {
          errors.push({
            field: `${field}.keyPoints`,
            rule: 'max_length',
            message: `keyPoints array exceeds maximum length of ${this.MAX_ARRAY_LENGTH}`,
            severity: 'error'
          });
        }

        pageData.keyPoints.forEach((point: any, index: number) => {
          if (typeof point !== 'string') {
            errors.push({
              field: `${field}.keyPoints[${index}]`,
              rule: 'type',
              message: 'Each key point must be a string',
              severity: 'error'
            });
          } else {
            const pointValidation = this.validateTextContent(
              point,
              `${field}.keyPoints[${index}]`,
              { maxLength: 300, minLength: 5 }
            );
            errors.push(...pointValidation.errors);
          }
        });
      }
    }

    // Validate images array
    if (pageData.images) {
      if (!Array.isArray(pageData.images)) {
        errors.push({
          field: `${field}.images`,
          rule: 'type',
          message: 'images must be an array',
          severity: 'error'
        });
      } else {
        pageData.images.forEach((imageUrl: any, index: number) => {
          if (typeof imageUrl !== 'string') {
            errors.push({
              field: `${field}.images[${index}]`,
              rule: 'type',
              message: 'Each image URL must be a string',
              severity: 'error'
            });
          } else {
            const imageValidation = this.validateURL(imageUrl, `${field}.images[${index}]`);
            errors.push(...imageValidation.errors);
          }
        });
      }
    }

    // Sanitize the page data
    const sanitizedPageData = this.sanitizePageData(pageData);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedValue: sanitizedPageData
    };
  }

  /**
   * Validate user preferences
   */
  static validateUserPreferences(prefs: any, field: string = 'preferences'): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!prefs || typeof prefs !== 'object') {
      errors.push({
        field,
        rule: 'required',
        message: 'User preferences must be an object',
        severity: 'error'
      });
      return { isValid: false, errors, warnings };
    }

    // Validate word counts
    if (prefs.minWords !== undefined) {
      if (!Number.isInteger(prefs.minWords) || prefs.minWords < 1 || prefs.minWords > 1000) {
        errors.push({
          field: `${field}.minWords`,
          rule: 'range',
          message: 'minWords must be an integer between 1 and 1000',
          severity: 'error',
          value: prefs.minWords
        });
      }
    }

    if (prefs.maxWords !== undefined) {
      if (!Number.isInteger(prefs.maxWords) || prefs.maxWords < 1 || prefs.maxWords > 2000) {
        errors.push({
          field: `${field}.maxWords`,
          rule: 'range',
          message: 'maxWords must be an integer between 1 and 2000',
          severity: 'error',
          value: prefs.maxWords
        });
      }
    }

    if (prefs.minWords && prefs.maxWords && prefs.minWords >= prefs.maxWords) {
      errors.push({
        field: `${field}.wordRange`,
        rule: 'logic',
        message: 'minWords must be less than maxWords',
        severity: 'error'
      });
    }

    // Validate enum fields
    const validTones = ['professional', 'casual', 'witty', 'educational'];
    if (prefs.contentTone && !validTones.includes(prefs.contentTone)) {
      errors.push({
        field: `${field}.contentTone`,
        rule: 'enum',
        message: `contentTone must be one of: ${validTones.join(', ')}`,
        severity: 'error',
        value: prefs.contentTone
      });
    }

    const validEngagementFocus = ['viral', 'saves', 'comments', 'shares'];
    if (prefs.engagementFocus && !validEngagementFocus.includes(prefs.engagementFocus)) {
      errors.push({
        field: `${field}.engagementFocus`,
        rule: 'enum',
        message: `engagementFocus must be one of: ${validEngagementFocus.join(', ')}`,
        severity: 'error',
        value: prefs.engagementFocus
      });
    }

    // Validate custom context if provided
    if (prefs.customContext) {
      const contextValidation = this.validateTextContent(
        prefs.customContext,
        `${field}.customContext`,
        { maxLength: 500, minLength: 1 }
      );
      errors.push(...contextValidation.errors);
      warnings.push(...contextValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedValue: this.sanitizeUserPreferences(prefs)
    };
  }

  /**
   * Sanitize URL by removing dangerous components
   */
  private static sanitizeURL(url: string): string {
    try {
      const parsed = new URL(url);
      
      // Remove dangerous fragments
      parsed.hash = '';
      
      // Encode potentially dangerous characters in query params
      const sanitizedSearch = parsed.search.replace(/[<>"'&]/g, (match) => {
        const entityMap: Record<string, string> = {
          '<': '%3C',
          '>': '%3E',
          '"': '%22',
          "'": '%27',
          '&': '%26'
        };
        return entityMap[match] || match;
      });
      
      parsed.search = sanitizedSearch;
      
      return parsed.toString();
    } catch {
      // If URL parsing fails, return empty string
      return '';
    }
  }

  /**
   * Sanitize HTML content using DOMPurify
   */
  private static sanitizeHTML(content: string): string {
    const config: SanitizationConfig = {
      allowedTags: ['p', 'br', 'strong', 'em', 'u', 'span', 'div'],
      allowedAttributes: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style']
    };

    return DOMPurify.sanitize(content, config);
  }

  /**
   * Sanitize plain text content
   */
  private static sanitizePlainText(content: string): string {
    return content
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Sanitize page data object
   */
  private static sanitizePageData(pageData: any): any {
    const sanitized: any = {};

    if (pageData.url) {
      sanitized.url = this.sanitizeURL(pageData.url);
    }

    if (pageData.title) {
      sanitized.title = this.sanitizePlainText(pageData.title);
    }

    if (pageData.description) {
      sanitized.description = this.sanitizePlainText(pageData.description);
    }

    if (Array.isArray(pageData.keyPoints)) {
      sanitized.keyPoints = pageData.keyPoints
        .filter((point: any) => typeof point === 'string')
        .map((point: string) => this.sanitizePlainText(point))
        .slice(0, this.MAX_ARRAY_LENGTH);
    }

    if (Array.isArray(pageData.images)) {
      sanitized.images = pageData.images
        .filter((url: any) => typeof url === 'string')
        .map((url: string) => this.sanitizeURL(url))
        .filter((url: string) => url.length > 0)
        .slice(0, 10);
    }

    if (pageData.brandColors && typeof pageData.brandColors === 'object') {
      sanitized.brandColors = {
        primary: this.sanitizeColor(pageData.brandColors.primary),
        secondary: this.sanitizeColor(pageData.brandColors.secondary)
      };
    }

    return sanitized;
  }

  /**
   * Sanitize user preferences
   */
  private static sanitizeUserPreferences(prefs: any): any {
    const sanitized: any = {};

    if (typeof prefs.minWords === 'number') {
      sanitized.minWords = Math.max(1, Math.min(1000, Math.floor(prefs.minWords)));
    }

    if (typeof prefs.maxWords === 'number') {
      sanitized.maxWords = Math.max(1, Math.min(2000, Math.floor(prefs.maxWords)));
    }

    const validTones = ['professional', 'casual', 'witty', 'educational'];
    if (validTones.includes(prefs.contentTone)) {
      sanitized.contentTone = prefs.contentTone;
    }

    const validEngagementFocus = ['viral', 'saves', 'comments', 'shares'];
    if (validEngagementFocus.includes(prefs.engagementFocus)) {
      sanitized.engagementFocus = prefs.engagementFocus;
    }

    if (typeof prefs.customContext === 'string') {
      sanitized.customContext = this.sanitizePlainText(prefs.customContext).slice(0, 500);
    }

    if (typeof prefs.followPageTheme === 'boolean') {
      sanitized.followPageTheme = prefs.followPageTheme;
    }

    if (typeof prefs.includeAnalysis === 'boolean') {
      sanitized.includeAnalysis = prefs.includeAnalysis;
    }

    return sanitized;
  }

  /**
   * Sanitize color values
   */
  private static sanitizeColor(color: any): string {
    if (typeof color !== 'string') return '#667eea';
    
    // Validate hex color format
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (hexPattern.test(color)) {
      return color.toLowerCase();
    }
    
    // Validate rgb format
    const rgbPattern = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
    const rgbMatch = color.match(rgbPattern);
    if (rgbMatch) {
      const r = Math.min(255, parseInt(rgbMatch[1]));
      const g = Math.min(255, parseInt(rgbMatch[2]));
      const b = Math.min(255, parseInt(rgbMatch[3]));
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
    
    // Return default if invalid
    return '#667eea';
  }

  /**
   * Comprehensive validation for all inputs
   */
  static validateAllInputs(data: {
    url?: string;
    pageData?: any;
    userPrefs?: any;
    content?: string;
  }): ValidationResult {
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];

    if (data.url) {
      const urlResult = this.validateURL(data.url);
      allErrors.push(...urlResult.errors);
      allWarnings.push(...urlResult.warnings);
    }

    if (data.pageData) {
      const pageDataResult = this.validatePageData(data.pageData);
      allErrors.push(...pageDataResult.errors);
      allWarnings.push(...pageDataResult.warnings);
    }

    if (data.userPrefs) {
      const prefsResult = this.validateUserPreferences(data.userPrefs);
      allErrors.push(...prefsResult.errors);
      allWarnings.push(...prefsResult.warnings);
    }

    if (data.content) {
      const contentResult = this.validateTextContent(data.content);
      allErrors.push(...contentResult.errors);
      allWarnings.push(...contentResult.warnings);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }
}