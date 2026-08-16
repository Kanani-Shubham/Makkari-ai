// MAKKARI AI — Unified Type Definitions

export type ProviderType = 'local' | 'cloud';

export type ProviderId = 'gemini' | 'ollama' | 'groq' | 'openrouter' | 'openai' | 'anthropic';

export type ProviderStatus =
  | 'connected'
  | 'invalid_key'
  | 'offline'
  | 'unavailable'
  | 'not_configured';

export type ModelAvailability =
  | 'available'
  | 'verified'
  | 'unverified'
  | 'deprecated'
  | 'unavailable'
  | 'unknown';


export type ModelVerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'DEPRECATED'
  | 'UNAVAILABLE';

export type LocalModelState =
  | 'installed'
  | 'downloading'
  | 'not_present';

export interface ModelCapabilities {
  text: boolean;
  vision: boolean;
  imageGeneration: boolean;
  audioInput: boolean;
  audioOutput: boolean;
  videoInput: boolean;
  fileInput: boolean;
  streaming: boolean;
  tools: boolean;
  nativeTools?: boolean;
  textToolProtocol?: boolean;
  artifacts?: boolean;
  reasoning: {
    supported: boolean;
    visible: boolean;
    configurable: boolean;
    supportedEfforts?: string[]; // e.g. ['low', 'medium', 'high']
    defaultEffort?: string;
    mandatory?: boolean;
  };
}

export interface MakkariModel {
  id: string;
  providerId: ProviderId;
  providerKey: string;
  name: string;
  displayName: string;
  description?: string;
  type: ProviderType;
  capabilities: ModelCapabilities;
  contextWindow?: number;
  maxOutputTokens?: number;
  availability: ModelAvailability;
  verificationStatus?: ModelVerificationStatus;
  lastCheckedAt?: string;
  unavailabilityReason?: string;
  localState?: LocalModelState;
  sizeBytes?: number;
  parameterSize?: string;
  quantization?: string;
  family?: string;
  metadata?: Record<string, unknown>;
  badge?: string;
}

// -------------------------------------------------------------
// Stream Events & Reasoning
// -------------------------------------------------------------

export type ReasoningVisibility = 'summary' | 'text' | 'encrypted' | 'hidden';

export interface ProviderReasoningMetadata {
  provider: string;
  signature?: string;
}

export interface ReasoningEvent {
  visibility: ReasoningVisibility;
  content?: string;
  summary?: string;
  provider: string;
  metadata?: Record<string, unknown>;
}

export interface AIError {
  provider: string;
  code?: string;
  status?: number;
  message: string;
  userMessage: string;
  retryable: boolean;
  modelUnavailable?: boolean;
}

export type ChatChunk =
  | {
      type: 'reasoning';
      event: ReasoningEvent;
    }
  | {
      type: 'text';
      content: string;
    }
  | {
      type: 'tool_call';
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'tool_result';
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'error';
      error: AIError;
    }
  | {
      type: 'done';
      metadata?: Record<string, unknown>;
    };

// -------------------------------------------------------------
// Attachments
// -------------------------------------------------------------

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string; // ${userId}/chats/${chatId}/${attachmentId}
  url?: string;
  content?: string;
  width?: number;
  height?: number;
  kind: 'image' | 'file' | 'code' | 'spreadsheet';
  status: 'uploading' | 'uploaded' | 'error';
  processing?: {
    status: 'pending' | 'processing' | 'ready' | 'error';
    extracted: boolean;
  };
}

// -------------------------------------------------------------
// Chat Messages & Requests
// -------------------------------------------------------------

export interface ChatMessage {
  id?: string;
  chat_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_id?: string;
  provider_id?: ProviderId;
  attachments?: ChatAttachment[];
  metadata?: {
    reasoning?: {
      available: boolean;
      durationMs?: number;
      provider?: string;
      summary?: string;
      events?: Array<{
        type: 'status' | 'tool' | 'skill' | 'mcp' | 'artifact';
        text: string;
        name?: string;
        status?: 'started' | 'completed' | 'failed';
        timestamp?: number;
      }>;
    };
    [key: string]: unknown;
  };

  created_at?: string;
}

export interface ChatRequest {
  chatId: string;
  modelId: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  apiKey?: string;
  temperature?: number;
  reasoningEffort?: string;
  abortSignal?: AbortSignal;
}

// -------------------------------------------------------------
// Provider Adapter Contracts
// -------------------------------------------------------------

export interface ProviderHealth {
  status: ProviderStatus;
  message?: string;
  latencyMs?: number;
}

export interface PullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percent?: number;
}

export interface ProviderAdapter {
  providerKey: ProviderId;
  name: string;
  discoverModels(apiKey?: string): Promise<MakkariModel[]>;
  healthCheck(apiKey?: string): Promise<ProviderHealth>;
  streamChat(request: ChatRequest): AsyncIterable<ChatChunk>;
  supports(model: MakkariModel): boolean;
  normalizeError(error: unknown): AIError;
}

export interface LocalProviderAdapter extends ProviderAdapter {
  getLocalStatus(): Promise<ProviderHealth>;
  listInstalledModels(): Promise<MakkariModel[]>;
  pullModel(modelId: string, onProgress: (progress: PullProgress) => void): Promise<boolean>;
}

// -------------------------------------------------------------
// Backward-Compatibility Helpers (Used during migration)
// -------------------------------------------------------------

export interface ModelSpec {
  id: string;
  name: string;
  context?: number;
  tag?: string;
  description?: string;
  capabilities?: ModelCapabilities;
}

export interface ProviderMetadata {
  id: ProviderId;
  name: string;
  type: ProviderType;
  status: 'active' | 'inactive' | 'degraded';
  defaultModel: string;
  enabledByDefault: boolean;
  models: ModelSpec[];
  requiresApiKey: boolean;
}

export interface StreamOptions {
  providerId: ProviderId;
  modelId: string;
  messages: ChatMessage[];
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  reasoningEffort?: string;
  abortSignal?: AbortSignal;
}

export interface AIProviderAdapter {
  id: ProviderId;
  name: string;
  streamChat(options: StreamOptions): Promise<ReadableStream<Uint8Array>> | AsyncIterable<ChatChunk>;
  validateKey?(apiKey: string): Promise<boolean>;
}
