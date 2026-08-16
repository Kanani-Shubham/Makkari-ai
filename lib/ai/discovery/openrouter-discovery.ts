import { ProviderModelDiscovery, DiscoveredModel, DiscoveryContext } from './types';

export class OpenRouterModelDiscovery implements ProviderModelDiscovery {
  providerId = 'openrouter' as const;

  async discoverModels(context: DiscoveryContext): Promise<DiscoveredModel[]> {
    const key = context.apiKey || process.env.OPENROUTER_API_KEY;

    try {
      const headers: Record<string, string> = {};
      if (key) {
        headers['Authorization'] = `Bearer ${key}`;
      }

      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers,
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        return this.getStaticFallbackModels(key ? 'available' : 'unavailable');
      }

      const data = await res.json();
      const rawList: Array<{
        id: string;
        name?: string;
        description?: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string };
        top_provider?: { max_completion_tokens?: number };
        architecture?: { modality?: string; instruct_type?: string };
      }> = data.data || [];

      // Filter text-compatible top models
      const curatedPrefixes = [
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3.5-haiku',
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
        'openai/o1',
        'meta-llama/llama-3.3-70b-instruct',
        'meta-llama/llama-3.1-8b-instruct',
        'google/gemini-2.5-flash',
        'google/gemini-2.5-pro',
        'deepseek/deepseek-r1',
        'deepseek/deepseek-chat',
        'qwen/qwen-2.5-72b-instruct',
        'mistralai/mistral-large-2407',
      ];

      const topModels = rawList.filter((m) => {
        return curatedPrefixes.some((p) => m.id.startsWith(p));
      });

      if (topModels.length === 0) {
        return this.getStaticFallbackModels(key ? 'available' : 'unavailable');
      }

      return topModels.map((m) => {
        const idLower = m.id.toLowerCase();
        const isVision = idLower.includes('4o') || idLower.includes('vision') || idLower.includes('sonnet') || idLower.includes('gemini');
        const isThinking = idLower.includes('r1') || idLower.includes('o1') || idLower.includes('reason');

        return {
          id: m.id,
          provider: 'openrouter',
          displayName: m.name || m.id,
          description: m.description || `${((m.context_length || 128000) / 1000).toFixed(0)}k context tokens • OpenRouter Universal Gateway`,
          capabilities: {
            text: true,
            streaming: true,
            vision: isVision,
            reasoning: isThinking,
            tools: true,
            nativeToolCalls: true,
            structuredOutput: true,
          },
          contextWindow: m.context_length || 128000,
          maxOutputTokens: m.top_provider?.max_completion_tokens || 8192,
          availability: key ? 'available' : 'unavailable',
          availabilityReason: key ? undefined : 'API key not configured',
          source: 'provider_api',
          badge: isThinking ? 'Deep Reasoning' : idLower.includes('sonnet') ? 'Flagship' : undefined,
          pricing: m.pricing,
        };
      });
    } catch (err: any) {
      console.warn('[OPENROUTER_DISCOVERY] Live discovery failed, using fallback:', err.message);
      return this.getStaticFallbackModels(key ? 'available' : 'unavailable', err.message);
    }
  }

  getStaticFallbackModels(availability: 'available' | 'unavailable' | 'unknown' = 'available', reason?: string): DiscoveredModel[] {
    return [
      {
        id: 'anthropic/claude-3.5-sonnet',
        provider: 'openrouter',
        displayName: 'Claude 3.5 Sonnet (OpenRouter)',
        description: '200,000 context tokens • Premier Coding & Multi-step Reasoning',
        capabilities: {
          text: true,
          streaming: true,
          vision: true,
          reasoning: true,
          tools: true,
          nativeToolCalls: true,
          structuredOutput: true,
        },
        contextWindow: 200000,
        maxOutputTokens: 8192,
        availability,
        availabilityReason: reason,
        source: 'static_fallback',
        badge: 'Premier Coder',
      },
      {
        id: 'openai/gpt-4o',
        provider: 'openrouter',
        displayName: 'GPT-4o (OpenRouter)',
        description: '128,000 context tokens • High-intelligence Flagship',
        capabilities: {
          text: true,
          streaming: true,
          vision: true,
          reasoning: false,
          tools: true,
          nativeToolCalls: true,
          structuredOutput: true,
        },
        contextWindow: 128000,
        maxOutputTokens: 4096,
        availability,
        availabilityReason: reason,
        source: 'static_fallback',
        badge: 'Flagship',
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct',
        provider: 'openrouter',
        displayName: 'Llama 3.3 70B (OpenRouter)',
        description: '128,000 context tokens • Open Weights Powerhouse',
        capabilities: {
          text: true,
          streaming: true,
          vision: false,
          reasoning: false,
          tools: true,
          nativeToolCalls: true,
          structuredOutput: true,
        },
        contextWindow: 128000,
        maxOutputTokens: 8192,
        availability,
        availabilityReason: reason,
        source: 'static_fallback',
        badge: 'Open Weights',
      },
    ];
  }
}
