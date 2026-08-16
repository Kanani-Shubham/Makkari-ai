import { ProviderId } from '../types';

export interface ModelCapabilities {
  text: boolean;
  streaming: boolean;
  vision: boolean;
  reasoning: boolean;
  tools: boolean;
  nativeToolCalls: boolean;
  structuredOutput: boolean;
}

export interface DiscoveredModel {
  id: string;
  provider: ProviderId;
  displayName: string;
  description?: string;
  capabilities: ModelCapabilities;
  contextWindow?: number;
  maxOutputTokens?: number;
  availability: 'available' | 'unavailable' | 'unknown';
  availabilityReason?: string;
  source: 'provider_api' | 'local_runtime' | 'static_fallback';
  badge?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

export interface DiscoveryContext {
  apiKey?: string;
  baseUrl?: string;
  forceRefresh?: boolean;
}

export interface ProviderModelDiscovery {
  providerId: ProviderId;
  discoverModels(context: DiscoveryContext): Promise<DiscoveredModel[]>;
}
