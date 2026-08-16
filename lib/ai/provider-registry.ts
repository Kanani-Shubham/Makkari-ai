import { ProviderId, ProviderType, MakkariModel } from './types';
import { getProviderModels } from './discovery-service';

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  type: ProviderType;
  defaultModelId: string;
}

export const AI_PROVIDERS_CONFIG: Record<ProviderId, ProviderDefinition> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'cloud',
    defaultModelId: 'gemini-2.0-flash',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local AI)',
    type: 'local',
    defaultModelId: 'llama3.2',
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    type: 'cloud',
    defaultModelId: 'llama-3.3-70b-versatile',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'cloud',
    defaultModelId: 'anthropic/claude-3.5-sonnet',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    defaultModelId: 'gpt-4o',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'cloud',
    defaultModelId: 'claude-3-5-sonnet-latest',
  },
};

export function getProviderConfig(providerId: ProviderId): ProviderDefinition {
  const provider = AI_PROVIDERS_CONFIG[providerId];
  if (!provider) {
    throw new Error(`[PROVIDER_REGISTRY] Unknown provider ID: ${providerId}`);
  }
  return provider;
}

/**
 * Dynamically resolves model definition using live discovery cache rather than hardcoded arrays
 */
export async function resolveModelDefinition(
  providerId: ProviderId,
  modelId: string,
  apiKey?: string
): Promise<MakkariModel | null> {
  const models = await getProviderModels(providerId, apiKey);
  const matched = models.find((m) => m.id === modelId);
  if (matched) return matched;

  // Fallback to first available model from this provider
  return models[0] || null;
}
