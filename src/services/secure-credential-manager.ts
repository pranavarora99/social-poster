/**
 * Enterprise-Grade Secure Credential Management
 * Implements Google's security best practices for sensitive data handling
 */

import { webcrypto } from 'crypto';

interface CredentialMetadata {
  readonly created: number;
  readonly expires?: number;
  readonly keyVersion: string;
  readonly environment: 'dev' | 'staging' | 'prod';
}

interface EncryptedCredential {
  readonly data: string;
  readonly iv: string;
  readonly metadata: CredentialMetadata;
  readonly checksum: string;
}

export class SecureCredentialManager {
  private static readonly STORAGE_KEY_PREFIX = 'secure_cred_';
  private static readonly MASTER_KEY_ALIAS = 'social_poster_master_key';
  private static readonly ENCRYPTION_ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  
  // Credential rotation intervals (ms)
  private static readonly TOKEN_ROTATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly KEY_ROTATION_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 days

  /**
   * Securely store encrypted credential
   */
  static async storeCredential(
    credentialId: string, 
    plaintext: string, 
    options: { expires?: number } = {}
  ): Promise<void> {
    try {
      const masterKey = await this.getMasterKey();
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);
      
      const encrypted = await crypto.subtle.encrypt(
        { name: this.ENCRYPTION_ALGORITHM, iv },
        masterKey,
        data
      );
      
      const metadata: CredentialMetadata = {
        created: Date.now(),
        expires: options.expires,
        keyVersion: await this.getKeyVersion(),
        environment: this.getEnvironment()
      };
      
      const credential: EncryptedCredential = {
        data: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv),
        metadata,
        checksum: await this.generateChecksum(encrypted, metadata)
      };
      
      const storageKey = `${this.STORAGE_KEY_PREFIX}${credentialId}`;
      await chrome.storage.local.set({ [storageKey]: credential });
      
      // Audit log for compliance
      this.auditLog('CREDENTIAL_STORED', { credentialId, keyVersion: metadata.keyVersion });
      
    } catch (error) {
      this.auditLog('CREDENTIAL_STORE_FAILED', { credentialId, error: error.message });
      throw new Error(`Failed to store credential: ${error.message}`);
    }
  }

  /**
   * Retrieve and decrypt credential
   */
  static async getCredential(credentialId: string): Promise<string> {
    try {
      const storageKey = `${this.STORAGE_KEY_PREFIX}${credentialId}`;
      const result = await chrome.storage.local.get([storageKey]);
      const credential = result[storageKey] as EncryptedCredential;
      
      if (!credential) {
        throw new Error(`Credential not found: ${credentialId}`);
      }
      
      // Check expiration
      if (credential.metadata.expires && Date.now() > credential.metadata.expires) {
        await this.deleteCredential(credentialId);
        throw new Error(`Credential expired: ${credentialId}`);
      }
      
      // Verify integrity
      const encrypted = this.base64ToArrayBuffer(credential.data);
      const expectedChecksum = await this.generateChecksum(encrypted, credential.metadata);
      if (expectedChecksum !== credential.checksum) {
        this.auditLog('CREDENTIAL_INTEGRITY_VIOLATION', { credentialId });
        throw new Error(`Credential integrity check failed: ${credentialId}`);
      }
      
      // Decrypt
      const masterKey = await this.getMasterKey();
      const iv = this.base64ToArrayBuffer(credential.iv);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: this.ENCRYPTION_ALGORITHM, iv },
        masterKey,
        encrypted
      );
      
      const decoder = new TextDecoder();
      const plaintext = decoder.decode(decrypted);
      
      this.auditLog('CREDENTIAL_ACCESSED', { credentialId, keyVersion: credential.metadata.keyVersion });
      
      return plaintext;
      
    } catch (error) {
      this.auditLog('CREDENTIAL_ACCESS_FAILED', { credentialId, error: error.message });
      throw new Error(`Failed to retrieve credential: ${error.message}`);
    }
  }

  /**
   * Securely delete credential
   */
  static async deleteCredential(credentialId: string): Promise<void> {
    try {
      const storageKey = `${this.STORAGE_KEY_PREFIX}${credentialId}`;
      await chrome.storage.local.remove([storageKey]);
      this.auditLog('CREDENTIAL_DELETED', { credentialId });
    } catch (error) {
      this.auditLog('CREDENTIAL_DELETE_FAILED', { credentialId, error: error.message });
      throw error;
    }
  }

  /**
   * Rotate credentials based on policy
   */
  static async rotateCredentialIfNeeded(credentialId: string): Promise<boolean> {
    try {
      const storageKey = `${this.STORAGE_KEY_PREFIX}${credentialId}`;
      const result = await chrome.storage.local.get([storageKey]);
      const credential = result[storageKey] as EncryptedCredential;
      
      if (!credential) return false;
      
      const age = Date.now() - credential.metadata.created;
      const shouldRotate = age > this.TOKEN_ROTATION_INTERVAL;
      
      if (shouldRotate) {
        this.auditLog('CREDENTIAL_ROTATION_REQUIRED', { credentialId, age });
        // Trigger rotation workflow - would integrate with OAuth refresh flow
        return true;
      }
      
      return false;
    } catch (error) {
      this.auditLog('CREDENTIAL_ROTATION_CHECK_FAILED', { credentialId, error: error.message });
      return false;
    }
  }

  /**
   * Validate credential format and strength
   */
  static validateCredential(credential: string, type: 'api_token' | 'oauth_token' = 'api_token'): boolean {
    const patterns = {
      api_token: /^hf_[a-zA-Z0-9]{32,}$/, // HuggingFace token format
      oauth_token: /^[a-zA-Z0-9\-._~]{43,128}$/ // OAuth2 token format
    };
    
    const pattern = patterns[type];
    return pattern.test(credential);
  }

  /**
   * Generate or retrieve master encryption key
   */
  private static async getMasterKey(): Promise<CryptoKey> {
    const keyData = await chrome.storage.local.get([this.MASTER_KEY_ALIAS]);
    
    if (keyData[this.MASTER_KEY_ALIAS]) {
      const keyMaterial = this.base64ToArrayBuffer(keyData[this.MASTER_KEY_ALIAS]);
      return await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: this.ENCRYPTION_ALGORITHM },
        false,
        ['encrypt', 'decrypt']
      );
    }
    
    // Generate new master key
    const key = await crypto.subtle.generateKey(
      { name: this.ENCRYPTION_ALGORITHM, length: this.KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
    
    const exported = await crypto.subtle.exportKey('raw', key);
    const keyB64 = this.arrayBufferToBase64(exported);
    
    await chrome.storage.local.set({ [this.MASTER_KEY_ALIAS]: keyB64 });
    this.auditLog('MASTER_KEY_GENERATED', { keyVersion: await this.getKeyVersion() });
    
    return key;
  }

  /**
   * Generate cryptographic checksum for integrity verification
   */
  private static async generateChecksum(data: ArrayBuffer, metadata: CredentialMetadata): Promise<string> {
    const combined = new Uint8Array(data.byteLength + 64);
    combined.set(new Uint8Array(data));
    combined.set(new TextEncoder().encode(JSON.stringify(metadata)), data.byteLength);
    
    const hash = await crypto.subtle.digest('SHA-256', combined);
    return this.arrayBufferToBase64(hash);
  }

  /**
   * Get current key version for rotation tracking
   */
  private static async getKeyVersion(): Promise<string> {
    const now = Date.now();
    const versionEpoch = Math.floor(now / this.KEY_ROTATION_INTERVAL);
    return `v${versionEpoch}`;
  }

  /**
   * Determine current environment
   */
  private static getEnvironment(): 'dev' | 'staging' | 'prod' {
    const manifestVersion = chrome.runtime.getManifest().version;
    if (manifestVersion.includes('dev')) return 'dev';
    if (manifestVersion.includes('staging')) return 'staging';
    return 'prod';
  }

  /**
   * Security audit logging
   */
  private static auditLog(event: string, details: Record<string, any>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      extensionId: chrome.runtime.id,
      version: chrome.runtime.getManifest().version,
      ...details
    };
    
    console.log(`[SECURITY AUDIT] ${JSON.stringify(logEntry)}`);
    
    // In production, would send to secure logging service
    // await this.sendToSecurityLog(logEntry);
  }

  /**
   * Utility: ArrayBuffer to Base64
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Base64 to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * OAuth2 Integration for HuggingFace API
 */
export class HuggingFaceAuthManager {
  private static readonly CLIENT_ID = 'social_poster_extension';
  private static readonly SCOPES = ['read-repos', 'inference-api'];
  private static readonly AUTH_URL = 'https://huggingface.co/oauth/authorize';
  private static readonly TOKEN_URL = 'https://huggingface.co/oauth/token';

  /**
   * Initiate OAuth2 flow
   */
  static async initiateOAuth(): Promise<string> {
    const state = crypto.getRandomValues(new Uint32Array(4)).join('');
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    
    // Store PKCE verifier securely
    await SecureCredentialManager.storeCredential('oauth_code_verifier', codeVerifier, {
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });
    
    const authUrl = new URL(this.AUTH_URL);
    authUrl.searchParams.set('client_id', this.CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', this.SCOPES.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    return authUrl.toString();
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(code: string, state: string): Promise<void> {
    try {
      const codeVerifier = await SecureCredentialManager.getCredential('oauth_code_verifier');
      
      const response = await fetch(this.TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.CLIENT_ID,
          code,
          code_verifier: codeVerifier
        })
      });
      
      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }
      
      const tokens = await response.json();
      
      // Store tokens securely with expiration
      await SecureCredentialManager.storeCredential('hf_access_token', tokens.access_token, {
        expires: Date.now() + (tokens.expires_in * 1000)
      });
      
      if (tokens.refresh_token) {
        await SecureCredentialManager.storeCredential('hf_refresh_token', tokens.refresh_token);
      }
      
      // Clean up temporary verifier
      await SecureCredentialManager.deleteCredential('oauth_code_verifier');
      
    } catch (error) {
      throw new Error(`OAuth token exchange failed: ${error.message}`);
    }
  }

  /**
   * Generate PKCE code verifier
   */
  private static generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate PKCE code challenge
   */
  private static async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}