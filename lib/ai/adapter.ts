import { ProviderAdapter, ProviderId, ChatRequest, ChatChunk, LocalProviderAdapter } from './types';
import { OllamaAdapter } from './providers/ollama';
import { GeminiAdapter } from './providers/gemini';
import { GroqAdapter } from './providers/groq';
import { OpenRouterAdapter } from './providers/openrouter';
import { OpenAIAdapter } from './providers/openai';
import { AnthropicAdapter } from './providers/anthropic';

const adapters: Record<ProviderId, ProviderAdapter> = {
  ollama: new OllamaAdapter(),
  gemini: new GeminiAdapter(),
  groq: new GroqAdapter(),
  openrouter: new OpenRouterAdapter(),
  openai: new OpenAIAdapter(),
  anthropic: new AnthropicAdapter(),
};

export function getAIProvider(providerId: ProviderId): ProviderAdapter {
  const adapter = adapters[providerId];
  if (!adapter) {
    throw new Error(`Unsupported AI Provider: "${providerId}"`);
  }
  return adapter;
}

export function getLocalProvider(): LocalProviderAdapter {
  return adapters.ollama as LocalProviderAdapter;
}

export function streamAIChat(request: ChatRequest): AsyncIterable<ChatChunk> {
  const provider = getAIProvider(request.messages[0]?.provider_id || 'gemini');
  return provider.streamChat(request);
}
