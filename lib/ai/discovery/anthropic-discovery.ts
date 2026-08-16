import { ProviderModelDiscovery, DiscoveredModel, DiscoveryContext } from './types';

export class AnthropicModelDiscovery implements ProviderModelDiscovery {
  providerId = 'anthropic' as const;

  async discoverModels(context: DiscoveryContext): Promise<DiscoveredModel[]> {
    const key = context.apiKey || process.env.ANTHROPIC_API_KEY;
    const availability = key ? 'available' : 'unavailable';
    const reason = key ? undefined : 'API key not configured';

    // Anthropic official flagship models
    return [
      {
        id: 'claude-3-5-sonnet-latest',
        provider: 'anthropic',
        displayName: 'Claude 3.5 Sonnet',
        description: '200,000 context tokens • Frontier intelligence for coding and multi-step reasoning',
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
        source: 'provider_api',
        badge: 'Premier Coder',
      },
      {
        id: 'claude-3-5-haiku-latest',
        provider: 'anthropic',
        displayName: 'Claude 3.5 Haiku',
        description: '200,000 context tokens • Blazing fast execution with near-Sonnet intelligence',
        capabilities: {
          text: true,
          streaming: true,
          vision: true,
          reasoning: false,
          tools: true,
          nativeToolCalls: true,
          structuredOutput: true,
        },
        contextWindow: 200000,
        maxOutputTokens: 8192,
        availability,
        availabilityReason: reason,
        source: 'provider_api',
        badge: 'Instant & Smart',
      },
      {
        id: 'claude-3-opus-latest',
        provider: 'anthropic',
        displayName: 'Claude 3 Opus',
        description: '200,000 context tokens • Deep analytical reasoning for complex writing',
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
        maxOutputTokens: 4096,
        availability,
        availabilityReason: reason,
        source: 'provider_api',
        badge: 'Deep Analytical',
      },
    ];
  }
}
