import { ProviderId, MakkariModel } from '../types';
import { DiscoveredModel, DiscoveryContext, ProviderModelDiscovery } from './types';
import { GeminiModelDiscovery } from './gemini-discovery';
import { OllamaModelDiscovery } from './ollama-discovery';
import { GroqModelDiscovery } from './groq-discovery';
import { OpenAIModelDiscovery } from './openai-discovery';
import { AnthropicModelDiscovery } from './anthropic-discovery';
import { OpenRouterModelDiscovery } from './openrouter-discovery';

interface RegistryCacheEntry {
  models: DiscoveredModel[];
  timestamp: number;
}

/**
 * ModelRegistry — Single Source of Truth for Model Discovery, Capabilities, and Availability
 */
export class ModelRegistry {
  private static instance: ModelRegistry;

  private discoveryAdapters: Map<ProviderId, ProviderModelDiscovery> = new Map();
  private cache: Map<string, RegistryCacheEntry> = new Map();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes cache

  private constructor() {
    this.discoveryAdapters.set('gemini', new GeminiModelDiscovery());
    this.discoveryAdapters.set('ollama', new OllamaModelDiscovery());
    this.discoveryAdapters.set('groq', new GroqModelDiscovery());
    this.discoveryAdapters.set('openai', new OpenAIModelDiscovery());
    this.discoveryAdapters.set('anthropic', new AnthropicModelDiscovery());
    this.discoveryAdapters.set('openrouter', new OpenRouterModelDiscovery());
  }

  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  private getCacheKey(provider: ProviderId, apiKey?: string, baseUrl?: string): string {
    const keyHint = apiKey ? apiKey.slice(-6) : 'env';
    return `${provider}:${keyHint}:${baseUrl || 'default'}`;
  }

  /**
   * Discovers models for a provider using live discovery adapters with caching
   */
  public async discover(provider: ProviderId, context: DiscoveryContext = {}): Promise<DiscoveredModel[]> {
    const cacheKey = this.getCacheKey(provider, context.apiKey, context.baseUrl);
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (!context.forceRefresh && cached && now - cached.timestamp < this.TTL_MS && cached.models.length > 0) {
      return cached.models;
    }

    const adapter = this.discoveryAdapters.get(provider);
    if (!adapter) {
      return [];
    }

    try {
      const models = await adapter.discoverModels(context);
      this.cache.set(cacheKey, { models, timestamp: now });
      return models;
    } catch (err: any) {
      console.warn(`[MODEL_REGISTRY] Discovery failed for ${provider}:`, err.message);
      if (cached && cached.models.length > 0) {
        return cached.models;
      }
      return [];
    }
  }

  /**
   * Retrieves a specific model's discovered specifications
   */
  public async get(provider: ProviderId, modelId: string, context: DiscoveryContext = {}): Promise<DiscoveredModel | null> {
    const models = await this.discover(provider, context);
    return models.find((m) => m.id === modelId) || null;
  }

  /**
   * Checks if a model is confirmed available for the configured credentials
   */
  public async isAvailable(provider: ProviderId, modelId: string, context: DiscoveryContext = {}): Promise<boolean> {
    const model = await this.get(provider, modelId, context);
    return model !== null && model.availability === 'available';
  }

  /**
   * Retrieves capabilities for a given model
   */
  public async getCapabilities(provider: ProviderId, modelId: string, context: DiscoveryContext = {}) {
    const model = await this.get(provider, modelId, context);
    if (model) {
      return model.capabilities;
    }
    // Default safe fallback capabilities
    return {
      text: true,
      streaming: true,
      vision: false,
      reasoning: false,
      tools: true,
      nativeToolCalls: false,
      structuredOutput: false,
    };
  }

  /**
   * Invalidates cached discovery results for a provider (e.g. after API key change or model pull)
   */
  public invalidate(provider?: ProviderId): void {
    if (provider) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${provider}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Force refreshes discovery for a provider
   */
  public async refresh(provider: ProviderId, context: DiscoveryContext = {}): Promise<DiscoveredModel[]> {
    this.invalidate(provider);
    return this.discover(provider, { ...context, forceRefresh: true });
  }
}

export const modelRegistry = ModelRegistry.getInstance();
