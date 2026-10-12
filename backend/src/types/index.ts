/**
 * Core types for AI Portfolio Platform
 */

export interface ContentManifest {
  userId: string;
  version: string;
  lastUpdated: string;
  profile: Profile;
  about: About;
  experience: Experience[];
  awards: Award[];
  boards: BoardPosition[];
  philanthropy: Philanthropy;
  media: MediaMention[];
  contact: Contact;
  template: Template;
  metadata: Metadata;
}

export interface Profile {
  name: string;
  headline: string;
  tagline?: string;
  photo?: MediaAsset;
}

export interface MediaAsset {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface About {
  summary: string;
  highlights: string[];
  sourceFiles: string[];
}

export interface Experience {
  id: string;
  role: string;
  company: string;
  period: string;
  current: boolean;
  description: string;
  achievements: string[];
  sourceFiles: string[];
}

export interface Award {
  id: string;
  title: string;
  issuer: string;
  date: string;
  description?: string;
  sourceFiles: string[];
}

export interface BoardPosition {
  id: string;
  organization: string;
  role: string;
  period: string;
  current: boolean;
}

export interface Philanthropy {
  summary?: string;
  causes?: string[];
  initiatives?: Initiative[];
}

export interface Initiative {
  title: string;
  description: string;
  impact?: string;
}

export interface MediaMention {
  id: string;
  title: string;
  publication: string;
  date: string;
  url?: string;
  thumbnail?: string;
}

export interface Contact {
  email?: string;
  phone?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  website?: string;
}

export interface Template {
  name: string;
  colorScheme: ColorScheme;
  sections: string[];
}

export interface ColorScheme {
  primary: string;
  accent: string;
  background: string;
  text?: string;
}

export interface Metadata {
  createdAt: string;
  publishedAt?: string;
  draftVersion: number;
  liveVersion: number;
}

/**
 * Bedrock API types
 */

export interface BedrockRequest {
  modelId: string;
  body: {
    anthropic_version: string;
    max_tokens: number;
    messages: BedrockMessage[];
    temperature?: number;
  };
}

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BedrockResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  stop_reason: string;
}

/**
 * Lambda event types
 */

export interface S3Event {
  Records: S3Record[];
}

export interface S3Record {
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
      size: number;
    };
  };
}

export interface ChatRequest {
  userId: string;
  message: string;
  conversationHistory?: BedrockMessage[];
}

export interface ChatResponse {
  message: string;
  previewUrl?: string;
  action: 'updated' | 'error' | 'clarification_needed';
}

export interface PublishRequest {
  userId: string;
}

export interface PublishResponse {
  success: boolean;
  liveUrl: string;
  publishedAt: string;
}

/**
 * Content extraction types
 */

export interface ExtractedContent {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount?: number;
    language?: string;
  };
  classifications: ContentClassification[];
}

export interface ContentClassification {
  type: 'bio' | 'experience' | 'award' | 'education' | 'skill' | 'contact';
  confidence: number;
  content: string;
  sourceLocation: {
    page?: number;
    line?: number;
  };
}

/**
 * HTML Generation types
 */

export interface HTMLGenerationRequest {
  manifest: ContentManifest;
  template: string;
  options?: HTMLGenerationOptions;
}

export interface HTMLGenerationOptions {
  includeAnalytics?: boolean;
  customCSS?: string;
  seo?: SEOOptions;
}

export interface SEOOptions {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
}

export interface HTMLGenerationResponse {
  html: string;
  size: number;
  generatedAt: string;
}
