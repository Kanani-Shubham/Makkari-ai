import { ProviderModelDiscovery, DiscoveredModel, DiscoveryContext } from './types';

export const OLLAMA_DEFAULT_URLS = ['http://127.0.0.1:11434', 'http://localhost:11434'];

export class OllamaModelDiscovery implements ProviderModelDiscovery {
  providerId = 'ollama' as const;

  async getWorkingBaseUrl(configuredUrl?: string): Promise<string | null> {
    const urlsToTry = configuredUrl ? [configuredUrl, ...OLLAMA_DEFAULT_URLS] : OLLAMA_DEFAULT_URLS;
    for (const url of urlsToTry) {
      try {
        const res = await fetch(`${url}/api/tags`, {
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) return url;
      } catch {
        // try next
      }
    }
    return null;
  }

  async discoverModels(context: DiscoveryContext): Promise<DiscoveredModel[]> {
    try {
      const baseUrl = await this.getWorkingBaseUrl(context.baseUrl);
      if (!baseUrl) {
        return [];
      }

      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      const rawList: Array<{
        name: string;
        model?: string;
        size?: number;
        digest?: string;
        details?: {
          family?: string;
          parameter_size?: string;
          quantization_level?: string;
        };
      }> = data.models || [];

      return rawList.map((item) => {
        const modelName = item.name;
        const details = item.details || {};
        const family = (details.family || '').toLowerCase();
        const nameLower = modelName.toLowerCase();

        const isVision =
          family.includes('vision') ||
          family.includes('mllama') ||
          family.includes('clip') ||
          nameLower.includes('vision') ||
          nameLower.includes('llava');

        const isThinking =
          family.includes('deepseek') ||
          nameLower.includes('r1') ||
          nameLower.includes('qwen3') ||
          nameLower.includes('reason');

        const supportsTools =
          family.includes('llama3') ||
          family.includes('qwen2') ||
          family.includes('mistral') ||
          family.includes('command-r') ||
          nameLower.includes('llama3') ||
          nameLower.includes('qwen2.5') ||
          nameLower.includes('mistral') ||
          nameLower.includes('tools') ||
          nameLower.includes('function');

        return {
          id: modelName,
          provider: 'ollama',
          displayName: modelName,
          description: `Local • ${details.parameter_size || 'Installed'} • ${details.quantization_level || 'Quantized'}`,
          capabilities: {
            text: true,
            streaming: true,
            vision: isVision,
            reasoning: isThinking,
            tools: supportsTools,
            nativeToolCalls: supportsTools,
            structuredOutput: true,
          },
          contextWindow: 131072,
          maxOutputTokens: 8192,
          availability: 'available',
          source: 'local_runtime',
          badge: isThinking ? 'Local Reasoning' : isVision ? 'Local Vision' : supportsTools ? 'Local Tools' : 'Local Model',
        };
      });
    } catch (err: any) {
      console.warn('[OLLAMA_DISCOVERY] Failed to connect to local Ollama:', err.message);
      return [];
    }
  }
}
