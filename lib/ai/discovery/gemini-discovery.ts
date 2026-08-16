import { ProviderModelDiscovery, DiscoveredModel, DiscoveryContext } from './types';

export class GeminiModelDiscovery implements ProviderModelDiscovery {
  providerId = 'gemini' as const;

  async discoverModels(context: DiscoveryContext): Promise<DiscoveredModel[]> {
    const key = context.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
      return this.getStaticFallbackModels('unavailable', 'API key not configured');
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        if (res.status === 400 || res.status === 403 || res.status === 401) {
          return this.getStaticFallbackModels('unavailable', 'Invalid Gemini API key or unauthorized project');
        }
        return this.getStaticFallbackModels('unknown', `Gemini API returned status ${res.status}`);
      }

      const data = await res.json();
      const rawModels: Array<{
        name: string;
        displayName?: string;
        description?: string;
        inputTokenLimit?: number;
        outputTokenLimit?: number;
        supportedGenerationMethods?: string[];
      }> = data.models || [];

      // Filter models that support content generation and are NOT deprecated
      const validModels = rawModels.filter((m) => {
        const exactId = m.name.replace(/^models\//, '');
        const methods = m.supportedGenerationMethods || [];
        const isGenerative = methods.includes('generateContent') || methods.includes('bidiGenerateContent');
        const isDeprecated = exactId.includes('gemini-2.0-flash') || exactId.includes('gemini-1.0');
        return isGenerative && !isDeprecated;
      });

      if (validModels.length === 0) {
        return this.getStaticFallbackModels('available');
      }

      return validModels.map((m) => {
        const exactId = m.name.replace(/^models\//, '');
        const isThinking = exactId.includes('2.5') || exactId.includes('pro') || exactId.includes('thinking');
        const isVision = true;
        const supportsTools = true;

        return {
          id: exactId,
          provider: 'gemini',
          displayName: m.displayName || exactId,
          description: m.description || `${(m.inputTokenLimit || 1048576).toLocaleString()} context tokens`,
          capabilities: {
            text: true,
            streaming: true,
            vision: isVision,
            reasoning: isThinking,
            tools: supportsTools,
            nativeToolCalls: true,
            structuredOutput: true,
          },
          contextWindow: m.inputTokenLimit || 1048576,
          maxOutputTokens: m.outputTokenLimit || 8192,
          availability: 'available',
          source: 'provider_api',
          badge: exactId.includes('pro') ? 'Deep Reasoning' : exactId.includes('flash-lite') ? 'Ultra Fast' : 'Fast & Smart',
        };
      });
    } catch (err: any) {
      console.warn('[GEMINI_DISCOVERY] Live discovery failed, using fallback:', err.message);
      return this.getStaticFallbackModels('unknown', err.message);
    }
  }

  getStaticFallbackModels(availability: 'available' | 'unavailable' | 'unknown' = 'available', reason?: string): DiscoveredModel[] {
    return [
      {
        id: 'gemini-1.5-flash',
        provider: 'gemini',
        displayName: 'Gemini 1.5 Flash',
        description: '1,048,576 context tokens • Fast, Multimodal Production Model',
        capabilities: {
          text: true,
          streaming: true,
          vision: true,
          reasoning: false,
          tools: true,
          nativeToolCalls: true,
          structuredOutput: true,
        },
        contextWindow: 1048576,
        maxOutputTokens: 8192,
        availability,
        availabilityReason: reason,
        source: 'static_fallback',
        badge: 'Fast & Smart',
      },
      {
        id: 'gemini-1.5-pro',
        provider: 'gemini',
        displayName: 'Gemini 1.5 Pro',
        description: '2,097,152 context tokens • Deep Reasoning & Long Context',
        capabilities: {
          text: true,
          streaming: true,
          vision: true,
          reasoning: true,
          tools: true,
          nativeToolCalls: true,
          structuredOutput: true,
        },
        contextWindow: 2097152,
        maxOutputTokens: 8192,
        availability,
        availabilityReason: reason,
        source: 'static_fallback',
        badge: 'Deep Reasoning',
      },
      {
        id: 'gemini-2.5-flash',
        provider: 'gemini',
        displayName: 'Gemini 2.5 Flash',
        description: '1,048,576 context tokens • Flagship with Native Function Calling',
        capabilities: {
          text: true,
          streaming: true,
          vision: true,
          reasoning: true,
          tools: true,
          nativeToolCalls: true,
          structuredOutput: true,
        },
        contextWindow: 1048576,
        maxOutputTokens: 8192,
        availability,
        availabilityReason: reason,
        source: 'static_fallback',
        badge: 'Next Gen',
      },
      {
        id: 'gemini-2.5-pro',
        provider: 'gemini',
        displayName: 'Gemini 2.5 Pro',
        description: '2,097,152 context tokens • Deep Reasoning & Complex Problem Solving',
        capabilities: {
          text: true,
          streaming: true,
          vision: true,
          reasoning: true,
          tools: true,
          nativeToolCalls: true,
          structuredOutput: true,
        },
        contextWindow: 2097152,
        maxOutputTokens: 8192,
        availability,
        availabilityReason: reason,
        source: 'static_fallback',
        badge: 'Deep Reasoning',
      },
    ];
  }
}

