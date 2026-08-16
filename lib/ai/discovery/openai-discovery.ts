import { ProviderModelDiscovery, DiscoveredModel, DiscoveryContext } from './types';

export class OpenAIModelDiscovery implements ProviderModelDiscovery {
  providerId = 'openai' as const;

  async discoverModels(context: DiscoveryContext): Promise<DiscoveredModel[]> {
    const key = context.apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      return this.getStaticFallbackModels('unavailable', 'API key not configured');
    }

    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return this.getStaticFallbackModels('unavailable', 'Invalid OpenAI API key');
        }
        return this.getStaticFallbackModels('unknown', `OpenAI API returned status ${res.status}`);
      }

      const data = await res.json();
      const rawList: Array<{ id: string; owned_by?: string }> = data.data || [];

      // Filter only current chat/instruction models
      const valid = rawList.filter((m) => {
        const idLower = m.id.toLowerCase();
        return (
          (idLower.startsWith('gpt-4') || idLower.startsWith('o1') || idLower.startsWith('o3') || idLower.startsWith('gpt-3.5')) &&
          !idLower.includes('realtime') &&
          !idLower.includes('audio') &&
          !idLower.includes('instruct')
        );
      });

      if (valid.length === 0) {
        return this.getStaticFallbackModels('available');
      }

      return valid.map((m) => {
        const idLower = m.id.toLowerCase();
        const isReasoning = idLower.startsWith('o1') || idLower.startsWith('o3');

        return {
          id: m.id,
          provider: 'openai',
          displayName: m.id,
          description: `OpenAI Flagship Model`,
          capabilities: {
            text: true,
            streaming: true,
            vision: idLower.includes('4o') || idLower.includes('vision'),
            reasoning: isReasoning,
            tools: true,
            nativeToolCalls: true,
            structuredOutput: true,
          },
          contextWindow: 128000,
          maxOutputTokens: 16384,
          availability: 'available',
          source: 'provider_api',
          badge: isReasoning ? 'Deep Reasoning' : idLower.includes('mini') ? 'Fast' : 'Flagship',
        };
      });
    } catch (err: any) {
      console.warn('[OPENAI_DISCOVERY] Live discovery failed, using fallback:', err.message);
      return this.getStaticFallbackModels('unknown', err.message);
    }
  }

  getStaticFallbackModels(availability: 'available' | 'unavailable' | 'unknown' = 'available', reason?: string): DiscoveredModel[] {
    return [
      {
        id: 'gpt-4o',
        provider: 'openai',
        displayName: 'GPT-4o',
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
        maxOutputTokens: 16384,
        availability,
        availabilityReason: reason,
        source: 'static_fallback',
        badge: 'Flagship',
      },
      {
        id: 'gpt-4o-mini',
        provider: 'openai',
        displayName: 'GPT-4o Mini',
        description: '128,000 context tokens • Fast and lightweight for everyday tasks',
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
        maxOutputTokens: 16384,
        availability,
        availabilityReason: reason,
        source: 'static_fallback',
        badge: 'Fast',
      },
      {
        id: 'o1-mini',
        provider: 'openai',
        displayName: 'o1 Mini',
        description: '128,000 context tokens • Reasoning model for math and code',
        capabilities: {
          text: true,
          streaming: true,
          vision: false,
          reasoning: true,
          tools: true,
          nativeToolCalls: true,
          structuredOutput: true,
        },
        contextWindow: 128000,
        maxOutputTokens: 65536,
        availability,
        availabilityReason: reason,
        source: 'static_fallback',
        badge: 'Deep Reasoning',
      },
    ];
  }
}
