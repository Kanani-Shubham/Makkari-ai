import { ProviderModelDiscovery, DiscoveredModel, DiscoveryContext } from './types';

export class GroqModelDiscovery implements ProviderModelDiscovery {
  providerId = 'groq' as const;

  async discoverModels(context: DiscoveryContext): Promise<DiscoveredModel[]> {
    const key = context.apiKey || process.env.GROQ_API_KEY;
    if (!key) {
      return this.getStaticFallbackModels('unavailable', 'API key not configured');
    }

    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return this.getStaticFallbackModels('unavailable', 'Invalid Groq API key');
        }
        return this.getStaticFallbackModels('unknown', `Groq API returned status ${res.status}`);
      }

      const data = await res.json();
      const rawList: Array<{ id: string; owned_by?: string; active?: boolean }> = data.data || [];

      // Filter text/chat models
      const valid = rawList.filter((m) => {
        const idLower = m.id.toLowerCase();
        return (
          !idLower.includes('whisper') &&
          !idLower.includes('embed') &&
          !idLower.includes('guard') &&
          !idLower.includes('distil')
        );
      });

      if (valid.length === 0) {
        return this.getStaticFallbackModels('available');
      }

      return valid.map((m) => {
        const idLower = m.id.toLowerCase();
        const supportsTools = idLower.includes('llama-3.3') || idLower.includes('llama-3.1') || idLower.includes('mixtral') || idLower.includes('gemma2');
        const isThinking = idLower.includes('r1') || idLower.includes('reason');

        return {
          id: m.id,
          provider: 'groq',
          displayName: m.id,
          description: `Groq LPU Inference • Ultra-low latency`,
          capabilities: {
            text: true,
            streaming: true,
            vision: idLower.includes('vision') || idLower.includes('mllama'),
            reasoning: isThinking,
            tools: supportsTools,
            nativeToolCalls: supportsTools,
            structuredOutput: true,
          },
          contextWindow: idLower.includes('3.3') || idLower.includes('3.1') ? 128000 : 32768,
          maxOutputTokens: 8192,
          availability: 'available',
          source: 'provider_api',
          badge: idLower.includes('70b') ? 'Ultra Fast' : 'Instant',
        };
      });
    } catch (err: any) {
      console.warn('[GROQ_DISCOVERY] Live discovery failed, using fallback:', err.message);
      return this.getStaticFallbackModels('unknown', err.message);
    }
  }

  getStaticFallbackModels(availability: 'available' | 'unavailable' | 'unknown' = 'available', reason?: string): DiscoveredModel[] {
    return [
      {
        id: 'llama-3.3-70b-versatile',
        provider: 'groq',
        displayName: 'Llama 3.3 70B Versatile',
        description: '128,000 context tokens • Ultra Fast LPU Inference with Tool Calling',
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
        badge: 'Ultra Fast',
      },
      {
        id: 'llama-3.1-8b-instant',
        provider: 'groq',
        displayName: 'Llama 3.1 8B Instant',
        description: '128,000 context tokens • Sub-second Latency',
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
        badge: 'Instant',
      },
      {
        id: 'mixtral-8x7b-32768',
        provider: 'groq',
        displayName: 'Mixtral 8x7B',
        description: '32,768 context tokens • MoE Architecture',
        capabilities: {
          text: true,
          streaming: true,
          vision: false,
          reasoning: false,
          tools: true,
          nativeToolCalls: true,
          structuredOutput: true,
        },
        contextWindow: 32768,
        maxOutputTokens: 8192,
        availability,
        availabilityReason: reason,
        source: 'static_fallback',
        badge: 'MoE',
      },
    ];
  }
}
