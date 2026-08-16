import {
  MakkariModel,
  ProviderAdapter,
  ProviderHealth,
  ChatRequest,
  ChatChunk,
  AIError,
} from '../types';

export class OpenAIAdapter implements ProviderAdapter {
  providerKey = 'openai' as const;
  name = 'OpenAI';

  async discoverModels(apiKey?: string): Promise<MakkariModel[]> {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) return [];

    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return [];
      const data = await res.json();
      const rawList: Array<{ id: string }> = data.data || [];

      const valid = rawList.filter(
        (m) =>
          (m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3')) &&
          !m.id.includes('instruct') &&
          !m.id.includes('realtime') &&
          !m.id.includes('audio')
      );

      return valid.slice(0, 20).map((m) => {
        const isReasoning = m.id.startsWith('o1') || m.id.startsWith('o3');
        return {
          id: m.id,
          providerId: 'openai',
          providerKey: 'openai',
          name: m.id.toUpperCase(),
          displayName: m.id,
          description: isReasoning ? 'Advanced Reasoning Model' : 'General Intelligence Model',
          type: 'cloud',
          capabilities: {
            text: true,
            vision: true,
            imageGeneration: m.id.includes('dall-e'),
            audioInput: false,
            audioOutput: false,
            videoInput: false,
            fileInput: true,
            streaming: true,
            tools: true,
            reasoning: {
              supported: isReasoning,
              visible: isReasoning,
              configurable: isReasoning,
              supportedEfforts: isReasoning ? ['low', 'medium', 'high'] : undefined,
              defaultEffort: isReasoning ? 'medium' : undefined,
            },
          },
          contextWindow: 128000,
          maxOutputTokens: 16384,
          availability: 'available',
          badge: isReasoning ? 'Reasoning' : 'Flagship',
        };
      });
    } catch (err) {
      console.warn('[OPENAI_DISCOVERY] Error:', err);
      return [];
    }
  }

  async healthCheck(apiKey?: string): Promise<ProviderHealth> {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) return { status: 'not_configured', message: 'OpenAI API key not configured' };

    try {
      const startTime = Date.now();
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(4000),
      });

      const latencyMs = Date.now() - startTime;
      if (res.ok) return { status: 'connected', latencyMs };
      if (res.status === 401) return { status: 'invalid_key', message: 'Invalid OpenAI API key' };
      return { status: 'unavailable', message: `OpenAI returned ${res.status}` };
    } catch (err) {
      return { status: 'unavailable', message: err instanceof Error ? err.message : 'Connection failed' };
    }
  }

  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const { modelId, messages, apiKey, systemPrompt, temperature = 0.7, abortSignal } = request;
    const key = apiKey || process.env.OPENAI_API_KEY;

    if (!key) {
      yield {
        type: 'error',
        error: {
          provider: 'openai',
          status: 401,
          message: 'OpenAI API key required',
          userMessage: 'OpenAI API key is missing.',
          retryable: false,
        },
      };
      return;
    }

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (systemPrompt) {
      formattedMessages.unshift({ role: 'system', content: systemPrompt });
    }

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: formattedMessages,
          temperature,
          stream: true,
        }),
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
          provider: 'openai',
          status: response.status,
          modelUnavailable: response.status === 404,
          message: `OpenAI Error (${response.status}): ${errText}`,
          userMessage: response.status === 404 ? 'OpenAI model not found.' : 'OpenAI request error.',
          retryable: response.status >= 500 || response.status === 429,
        },
      };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: { provider: 'openai', message: 'Empty stream', userMessage: 'Empty response', retryable: true } };
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
            if (dataStr === '[DONE]') {
              yield { type: 'done' };
              return;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.content) {
                yield { type: 'text', content: delta.content };
              }
            } catch {
              // Ignore partial JSON
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
    return model.providerKey === 'openai';
  }

  normalizeError(error: unknown): AIError {
    const message = error instanceof Error ? error.message : 'Unknown OpenAI error';
    return {
      provider: 'openai',
      message,
      userMessage: 'OpenAI connection error.',
      retryable: true,
    };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    const health = await this.healthCheck(apiKey);
    return health.status === 'connected';
  }
}
