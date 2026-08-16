import { MakkariModel, ProviderId } from './types';
import { getAIProvider } from './adapter';

interface CacheEntry {
  models: MakkariModel[];
  timestamp: number;
}

const discoveryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache for optimal speed

export const CANONICAL_FALLBACK_MODELS: Record<ProviderId, MakkariModel[]> = {
  gemini: [
    {
      id: 'gemini-2.5-flash',
      providerId: 'gemini',
      providerKey: 'gemini',
      name: 'Gemini 2.5 Flash',
      displayName: 'Gemini 2.5 Flash',
      description: '1,048,576 context tokens • Fast, Multimodal Flagship with Native Function Calling',
      type: 'cloud',
      capabilities: {
        text: true,
        vision: true,
        imageGeneration: false,
        audioInput: true,
        audioOutput: false,
        videoInput: true,
        fileInput: true,
        streaming: true,
        tools: true,
        reasoning: { supported: true, visible: true, configurable: true, supportedEfforts: ['low', 'medium', 'high'], defaultEffort: 'medium' },
      },
      contextWindow: 1048576,
      maxOutputTokens: 8192,
      availability: 'available',
      badge: 'Fast & Smart',
    },
    {
      id: 'gemini-2.5-pro',
      providerId: 'gemini',
      providerKey: 'gemini',
      name: 'Gemini 2.5 Pro',
      displayName: 'Gemini 2.5 Pro',
      description: '2,097,152 context tokens • Deep Reasoning & Complex Problem Solving',
      type: 'cloud',
      capabilities: {
        text: true,
        vision: true,
        imageGeneration: false,
        audioInput: true,
        audioOutput: false,
        videoInput: true,
        fileInput: true,
        streaming: true,
        tools: true,
        reasoning: { supported: true, visible: true, configurable: true, supportedEfforts: ['low', 'medium', 'high'], defaultEffort: 'high' },
      },
      contextWindow: 2097152,
      maxOutputTokens: 8192,
      availability: 'available',
      badge: 'Deep Reasoning',
    },
    {
      id: 'gemini-2.5-flash-lite',
      providerId: 'gemini',
      providerKey: 'gemini',
      name: 'Gemini 2.5 Flash-Lite',
      displayName: 'Gemini 2.5 Flash-Lite',
      description: '1,048,576 context tokens • Cost-efficient and ultra-fast high throughput',
      type: 'cloud',
      capabilities: {
        text: true,
        vision: true,
        imageGeneration: false,
        audioInput: true,
        audioOutput: false,
        videoInput: true,
        fileInput: true,
        streaming: true,
        tools: true,
        reasoning: { supported: false, visible: false, configurable: false },
      },
      contextWindow: 1048576,
      maxOutputTokens: 8192,
      availability: 'available',
      badge: 'Ultra Fast',
    },
  ],

  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      providerId: 'groq',
      providerKey: 'groq',
      name: 'Llama 3.3 70B Versatile',
      displayName: 'Llama 3.3 70B',
      description: '128,000 context tokens • Ultra Fast LPU Inference',
      type: 'cloud',
      capabilities: {
        text: true,
        vision: false,
        imageGeneration: false,
        audioInput: false,
        audioOutput: false,
        videoInput: false,
        fileInput: true,
        streaming: true,
        tools: true,
        reasoning: { supported: false, visible: false, configurable: false },
      },
      contextWindow: 128000,
      maxOutputTokens: 8192,
      availability: 'available',
      badge: 'Ultra Fast',
    },
    {
      id: 'llama-3.1-8b-instant',
      providerId: 'groq',
      providerKey: 'groq',
      name: 'Llama 3.1 8B Instant',
      displayName: 'Llama 3.1 8B',
      description: '128,000 context tokens • Sub-second Latency',
      type: 'cloud',
      capabilities: {
        text: true,
        vision: false,
        imageGeneration: false,
        audioInput: false,
        audioOutput: false,
        videoInput: false,
        fileInput: true,
        streaming: true,
        tools: true,
        reasoning: { supported: false, visible: false, configurable: false },
      },
      contextWindow: 128000,
      maxOutputTokens: 8192,
      availability: 'available',
      badge: 'Instant',
    },
    {
      id: 'mixtral-8x7b-32768',
      providerId: 'groq',
      providerKey: 'groq',
      name: 'Mixtral 8x7B',
      displayName: 'Mixtral 8x7B',
      description: '32,768 context tokens • MoE Architecture',
      type: 'cloud',
      capabilities: {
        text: true,
        vision: false,
        imageGeneration: false,
        audioInput: false,
        audioOutput: false,
        videoInput: false,
        fileInput: true,
        streaming: true,
        tools: true,
        reasoning: { supported: false, visible: false, configurable: false },
      },
      contextWindow: 32768,
      maxOutputTokens: 8192,
      availability: 'available',
      badge: 'MoE',
    },
  ],
  openrouter: [
    {
      id: 'openai/gpt-4o',
      providerId: 'openrouter',
      providerKey: 'openrouter',
      name: 'GPT-4o (OpenRouter)',
      displayName: 'GPT-4o',
      description: '128,000 context tokens • Multimodal Flagship',
      type: 'cloud',
      capabilities: {
        text: true,
        vision: true,
        imageGeneration: false,
        audioInput: false,
        audioOutput: false,
        videoInput: false,
        fileInput: true,
        streaming: true,
        tools: true,
        reasoning: { supported: false, visible: false, configurable: false },
      },
      contextWindow: 128000,
      maxOutputTokens: 4096,
      availability: 'available',
      badge: 'Flagship',
    },
    {
      id: 'anthropic/claude-3.5-sonnet',
      providerId: 'openrouter',
      providerKey: 'openrouter',
      name: 'Claude 3.5 Sonnet (OpenRouter)',
      displayName: 'Claude 3.5 Sonnet',
      description: '200,000 context tokens • Premier Coding & Reasoning',
      type: 'cloud',
      capabilities: {
        text: true,
        vision: true,
        imageGeneration: false,
        audioInput: false,
        audioOutput: false,
        videoInput: false,
        fileInput: true,
        streaming: true,
        tools: true,
        reasoning: { supported: true, visible: true, configurable: true, supportedEfforts: ['low', 'medium', 'high'], defaultEffort: 'medium' },
      },
      contextWindow: 200000,
      maxOutputTokens: 8192,
      availability: 'available',
      badge: 'Coding Champion',
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      providerId: 'openrouter',
      providerKey: 'openrouter',
      name: 'Llama 3.3 70B Instruct',
      displayName: 'Llama 3.3 70B',
      description: '128,000 context tokens • Open Weights Powerhouse',
      type: 'cloud',
      capabilities: {
        text: true,
        vision: false,
        imageGeneration: false,
        audioInput: false,
        audioOutput: false,
        videoInput: false,
        fileInput: true,
        streaming: true,
        tools: true,
        reasoning: { supported: false, visible: false, configurable: false },
      },
      contextWindow: 128000,
      maxOutputTokens: 8192,
      availability: 'available',
      badge: 'Open Source',
    },
  ],
  openai: [
    {
      id: 'gpt-4o',
      providerId: 'openai',
      providerKey: 'openai',
      name: 'GPT-4o',
      displayName: 'GPT-4o',
      description: '128,000 context tokens • High-intelligence Flagship',
      type: 'cloud',
      capabilities: {
        text: true,
        vision: true,
        imageGeneration: false,
        audioInput: false,
        audioOutput: false,
        videoInput: false,
        fileInput: true,
        streaming: true,
        tools: true,
        reasoning: { supported: false, visible: false, configurable: false },
      },
      contextWindow: 128000,
      maxOutputTokens: 4096,
      availability: 'available',
      badge: 'Flagship',
    },
    {
      id: 'gpt-4o-mini',
      providerId: 'openai',
      providerKey: 'openai',
      name: 'GPT-4o Mini',
      displayName: 'GPT-4o Mini',
      description: '128,000 context tokens • Fast & Cost-efficient',
      type: 'cloud',
      capabilities: {
        text: true,
        vision: true,
        imageGeneration: false,
        audioInput: false,
        audioOutput: false,
        videoInput: false,
        fileInput: true,
        streaming: true,
        tools: true,
        reasoning: { supported: false, visible: false, configurable: false },
      },
      contextWindow: 128000,
      maxOutputTokens: 4096,
      availability: 'available',
      badge: 'Fast',
    },
  ],
  anthropic: [
    {
      id: 'claude-3-5-sonnet-20241022',
      providerId: 'anthropic',
      providerKey: 'anthropic',
      name: 'Claude 3.5 Sonnet',
      displayName: 'Claude 3.5 Sonnet',
      description: '200,000 context tokens • SOTA Reasoning & Code',
      type: 'cloud',
      capabilities: {
        text: true,
        vision: true,
        imageGeneration: false,
        audioInput: false,
        audioOutput: false,
        videoInput: false,
        fileInput: true,
        streaming: true,
        tools: true,
        reasoning: { supported: true, visible: true, configurable: true, supportedEfforts: ['low', 'medium', 'high'], defaultEffort: 'medium' },
      },
      contextWindow: 200000,
      maxOutputTokens: 8192,
      availability: 'available',
      badge: 'Recommended',
    },
  ],
  ollama: [],
};

import { modelRegistry } from './discovery/model-registry';

export async function getProviderModels(
  providerId: ProviderId,
  apiKey?: string,
  forceRefresh = false
): Promise<MakkariModel[]> {
  try {
    const discovered = await modelRegistry.discover(providerId, { apiKey, forceRefresh });
    if (discovered && discovered.length > 0) {
      return discovered.map((d) => ({
        id: d.id,
        providerId: d.provider,
        providerKey: d.provider,
        name: d.displayName,
        displayName: d.displayName,
        description: d.description || `${d.contextWindow ? d.contextWindow.toLocaleString() + ' tokens' : 'Available'}`,
        type: d.provider === 'ollama' ? 'local' : 'cloud',
        capabilities: {
          text: d.capabilities.text,
          vision: d.capabilities.vision,
          imageGeneration: false,
          audioInput: false,
          audioOutput: false,
          videoInput: false,
          fileInput: true,
          streaming: d.capabilities.streaming,
          tools: d.capabilities.tools,
          reasoning: {
            supported: d.capabilities.reasoning,
            visible: d.capabilities.reasoning,
            configurable: d.capabilities.reasoning,
            supportedEfforts: ['low', 'medium', 'high'],
            defaultEffort: 'medium',
          },
        },
        contextWindow: d.contextWindow || 128000,
        maxOutputTokens: d.maxOutputTokens || 8192,
        availability: d.availability,
        badge: d.badge,
      }));
    }
  } catch (err: any) {
    console.warn(`[DISCOVERY_SERVICE] ModelRegistry discovery warning for ${providerId}:`, err.message);
  }

  // Fallback to canonical static models
  return CANONICAL_FALLBACK_MODELS[providerId] || [];
}


/**
 * Computes dynamic categorical tags for any MakkariModel
 */
export function getModelCategories(model: MakkariModel): string[] {
  const categories: string[] = [];

  if (model.type === 'local') {
    categories.push('🏠 Local');
  }

  if (model.capabilities.reasoning.supported) {
    categories.push('🧠 Reasoning');
  }

  if (model.capabilities.vision) {
    categories.push('👁 Vision');
  }

  const idLower = model.id.toLowerCase();
  if (
    idLower.includes('flash') ||
    idLower.includes('instant') ||
    idLower.includes('mini') ||
    idLower.includes('8b') ||
    idLower.includes('haiku')
  ) {
    categories.push('⚡ Fast');
  }

  if (
    idLower.includes('coder') ||
    idLower.includes('sonnet') ||
    idLower.includes('pro') ||
    idLower.includes('gpt-4') ||
    idLower.includes('70b')
  ) {
    categories.push('💻 Coding');
  }

  if (
    model.badge?.includes('Flagship') ||
    model.badge?.includes('Next Gen') ||
    model.badge?.includes('Recommended') ||
    categories.length >= 2
  ) {
    categories.unshift('Recommended');
  }

  return Array.from(new Set(categories));
}

/**
 * Finds the closest compatible fallback model when a requested model is unavailable
 */
export function getClosestFallbackModel(requestedId: string, availableModels: MakkariModel[]): MakkariModel | null {
  if (!availableModels || availableModels.length === 0) return null;

  const exact = availableModels.find((m) => m.id === requestedId);
  if (exact) return exact;

  const reqLower = requestedId.toLowerCase();

  const familyMatch = availableModels.find((m) => {
    const idLower = m.id.toLowerCase();
    if (reqLower.includes('flash') && idLower.includes('flash')) return true;
    if (reqLower.includes('pro') && idLower.includes('pro')) return true;
    if (reqLower.includes('llama') && idLower.includes('llama')) return true;
    if (reqLower.includes('claude') && idLower.includes('claude')) return true;
    if (reqLower.includes('gpt') && idLower.includes('gpt')) return true;
    return false;
  });

  return familyMatch || availableModels[0] || null;
}
