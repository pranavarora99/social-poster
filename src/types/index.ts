// TypeScript interfaces for Social Poster Chrome Extension

export interface PageData {
  title: string;
  description: string;
  keyPoints: string[];
  url: string;
  images?: string[];
  brandColors?: { primary: string; secondary: string };
}

export interface UserContext {
  relationship: string;
  personalStory: string;
  tone: string;
  engagementFocus: string;
  brandColors: { primary: string; secondary: string };
  companyName: string;
}

export interface UserSettings {
  brandColors: { primary: string; secondary: string };
  companyName: string;
  logo: string | null;
  template: string;
  contentTone: string;
  engagementFocus: string;
  followPageTheme: boolean;
  autoSave: boolean;
  contentContext?: string;
  customContext?: string;
}

export interface GeneratedPost {
  platform: string;
  content: string;
  charCount: number;
  wordCount: number;
  hashtags: string[];
  engagement: number;
  qualityScore?: number;
  image?: ImageData;
  source: 'ai' | 'template';
}

export interface ImageData {
  url: string;
  prompt: string;
  dimensions: {
    width: number;
    height: number;
  };
}

export interface ContentValidation {
  valid: boolean;
  reason?: string;
  wordCount?: number;
  qualityScore?: number;
  hasHashtags?: boolean;
  hasQuestion?: boolean;
  hasEngagement?: boolean;
}

export interface PlatformSpec {
  tone: string;
  structure: string;
  example: string;
}

export interface WordLimits {
  min: number;
  max: number;
}

export interface ProgressStep {
  key: string;
  text: string;
  details: string;
  progress: number;
}

export interface EngagementHooks {
  [key: string]: string;
}

export interface PersonalAngles {
  [key: string]: string;
}

export interface PlatformSpecs {
  [key: string]: PlatformSpec;
}

export interface HuggingFaceResponse {
  generated_text?: string;
  [key: string]: any;
}

export interface AIGenerationParams {
  inputs: string;
  parameters: {
    max_new_tokens?: number;
    temperature?: number;
    top_p?: number;
    do_sample?: boolean;
    repetition_penalty?: number;
    return_full_text?: boolean;
    guidance_scale?: number;
    num_inference_steps?: number;
    width?: number;
    height?: number;
  };
}

// Chrome Extension specific types
export interface ChromeTab {
  id?: number;
  url?: string;
  active: boolean;
  currentWindow: boolean;
}

export interface ChromeMessage {
  action: string;
  data?: any;
}

export interface StorageData {
  userSettings?: UserSettings;
  recentUrls?: string[];
  generatedPosts?: GeneratedPost[];
}

// Platform-specific types
export type Platform = 'linkedin' | 'twitter' | 'instagram' | 'facebook';

export type ContentTone = 'professional' | 'casual' | 'witty' | 'educational';

export type EngagementFocus = 'viral' | 'saves' | 'comments' | 'shares';

export type Template = 'professional' | 'modern' | 'minimal';

export type ContentRelationship = 
  | 'own-work' 
  | 'completed-project' 
  | 'work-showcase' 
  | 'found-interesting' 
  | 'learning-resource' 
  | 'client-work' 
  | 'custom';