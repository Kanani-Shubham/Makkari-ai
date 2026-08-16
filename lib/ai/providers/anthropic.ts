import {
  MakkariModel,
  ProviderAdapter,
  ProviderHealth,
  ChatRequest,
  ChatChunk,
  AIError,
} from '../types';

export class AnthropicAdapter implements ProviderAdapter {
  providerKey = 'anthropic' as const;
  name = 'Anthropic';

  async discoverModels(apiKey?: string): Promise<MakkariModel[]> {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) return [];

    try {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return [];
      const data = await res.json();
      const rawList: Array<{ id: string; display_name?: string }> = data.data || [];

      return rawList.map((m) => ({
        id: m.id,
        providerId: 'anthropic',
        providerKey: 'anthropic',
        name: m.display_name || m.id,
        displayName: m.display_name || m.id,
        description: 'Anthropic Claude Model',
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
          reasoning: {
            supported: true,
            visible: true,
            configurable: true,
            supportedEfforts: ['low', 'medium', 'high'],
            defaultEffort: 'medium',
          },
        },
        contextWindow: 200000,
        maxOutputTokens: 8192,
        availability: 'available',
        badge: 'Flagship',
      }));
    } catch (err) {
      console.warn('[ANTHROPIC_DISCOVERY] Error:', err);
      return [];
    }
  }

  async healthCheck(apiKey?: string): Promise<ProviderHealth> {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) return { status: 'not_configured', message: 'Anthropic key not configured' };

    try {
      const startTime = Date.now();
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(4000),
      });

      const latencyMs = Date.now() - startTime;
      if (res.ok) return { status: 'connected', latencyMs };
      if (res.status === 401 || res.status === 403) return { status: 'invalid_key', message: 'Invalid Anthropic key' };
      return { status: 'unavailable', message: `Anthropic returned ${res.status}` };
    } catch (err) {
      return { status: 'unavailable', message: err instanceof Error ? err.message : 'Connection failed' };
    }
  }

  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const { modelId, messages, apiKey, systemPrompt, abortSignal } = request;
    const key = apiKey || process.env.ANTHROPIC_API_KEY;

    if (!key) {
      yield {
        type: 'error',
        error: {
          provider: 'anthropic',
          status: 401,
          message: 'Anthropic API key required',
          userMessage: 'Anthropic API key is missing.',
          retryable: false,
        },
      };
      return;
    }

    const formattedMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const bodyPayload: Record<string, unknown> = {
      model: modelId,
      messages: formattedMessages,
      max_tokens: 4096,
      stream: true,
    };

    if (systemPrompt) {
      bodyPayload.system = systemPrompt;
    }

    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(bodyPayload),
        signal: abortSignal,
      });
    } catch (err) {
      if (abortSignal?.aborted) return;
      yield { type: 'error', error: this.normalizeError(err) };
      return;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      yield {
        type: 'error',
        error: {
          provider: 'anthropic',
          status: response.status,
          modelUnavailable: response.status === 404,
          message: `Anthropic Error (${response.status}): ${errText}`,
          userMessage: response.status === 404 ? 'Anthropic model not found.' : 'Anthropic error.',
          retryable: response.status >= 500 || response.status === 429,
        },
      };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: { provider: 'anthropic', message: 'Empty stream', userMessage: 'Empty response', retryable: true } };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (abortSignal?.aborted) {
          await reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield { type: 'text', content: parsed.delta.text };
              }
              if (parsed.type === 'message_stop') {
                yield { type: 'done' };
                return;
              }
            } catch {
              // Ignore
            }
          }
        }
      }
      yield { type: 'done' };
    } catch (err) {
      if (abortSignal?.aborted) return;
      yield { type: 'error', error: this.normalizeError(err) };
    } finally {
      reader.releaseLock();
    }
  }

  supports(model: MakkariModel): boolean {
    return model.providerKey === 'anthropic';
  }

  normalizeError(error: unknown): AIError {
    const message = error instanceof Error ? error.message : 'Unknown Anthropic error';
    return {
      provider: 'anthropic',
      message,
      userMessage: 'Anthropic connection error.',
      retryable: true,
    };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    const health = await this.healthCheck(apiKey);
    return health.status === 'connected';
  }
}
