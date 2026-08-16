import {
  MakkariModel,
  ProviderAdapter,
  ProviderHealth,
  ChatRequest,
  ChatChunk,
  AIError,
} from '../types';

export class GroqAdapter implements ProviderAdapter {
  providerKey = 'groq' as const;
  name = 'Groq Cloud';

  async discoverModels(apiKey?: string): Promise<MakkariModel[]> {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) return [];

    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return [];
      const data = await res.json();
      const rawList: Array<{ id: string; context_window?: number; owned_by?: string }> = data.data || [];

      // Filter active chat models
      const valid = rawList.filter(
        (m) =>
          !m.id.includes('whisper') &&
          !m.id.includes('guard') &&
          !m.id.includes('tts')
      );

      return valid.map((m) => {
        const isReasoning = m.id.includes('r1') || m.id.includes('deepseek') || m.id.includes('reasoning');
        const contextWin = m.context_window || 128000;

        return {
          id: m.id,
          providerId: 'groq',
          providerKey: 'groq',
          name: m.id,
          displayName: m.id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          description: `${contextWin.toLocaleString()} context tokens • Ultra Fast LPU`,
          type: 'cloud',
          capabilities: {
            text: true,
            vision: m.id.includes('vision') || m.id.includes('vl'),
            imageGeneration: false,
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
          contextWindow: contextWin,
          maxOutputTokens: 8192,
          availability: 'available',
          badge: isReasoning ? 'Fast Reasoning' : m.id.includes('70b') ? 'Flagship' : 'Ultra Fast',
        };
      });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Timeout';
      console.warn(`[GROQ_DISCOVERY] Error discovering Groq models (${msg}), using defaults.`);
      return [];
    }
  }

  async healthCheck(apiKey?: string): Promise<ProviderHealth> {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) {
      return { status: 'not_configured', message: 'Groq API key not configured' };
    }

    try {
      const startTime = Date.now();
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(4000),
      });

      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        return { status: 'connected', latencyMs };
      }

      if (res.status === 401 || res.status === 403) {
        return { status: 'invalid_key', message: 'Invalid Groq API Key' };
      }

      return { status: 'unavailable', message: `Groq returned status ${res.status}` };
    } catch (err) {
      return {
        status: 'unavailable',
        message: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const { modelId, messages, apiKey, systemPrompt, temperature = 0.7, abortSignal } = request;

    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) {
      yield {
        type: 'error',
        error: {
          provider: 'groq',
          status: 401,
          message: 'Groq API Key is required.',
          userMessage: 'Groq API Key is missing. Please add your key in Settings or Model Hub.',
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
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
      yield {
        type: 'error',
        error: this.normalizeError(err),
      };
      return;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      yield {
        type: 'error',
        error: {
          provider: 'groq',
          status: response.status,
          modelUnavailable: response.status === 404,
          message: `Groq API Error (${response.status}): ${errText}`,
          userMessage:
            response.status === 404
              ? `Groq model "${modelId}" is unavailable.`
              : 'Error connecting to Groq Cloud.',
          retryable: response.status >= 500 || response.status === 429,
        },
      };
      return;
    }

    if (!response.body) {
      yield {
        type: 'error',
        error: {
          provider: 'groq',
          message: 'Empty response stream from Groq.',
          userMessage: 'Groq returned an empty response.',
          retryable: true,
        },
      };
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

              // Reasoning delta
              if (delta?.reasoning_content || delta?.reasoning) {
                const reasoningText = delta.reasoning_content || delta.reasoning;
                yield {
                  type: 'reasoning',
                  event: {
                    visibility: 'summary',
                    content: reasoningText,
                    summary: reasoningText,
                    provider: 'groq',
                  },
                };
              }


              // Text content delta
              if (delta?.content) {
                yield {
                  type: 'text',
                  content: delta.content,
                };
              }
            } catch {
              // Ignore partial chunk JSON parse errors
            }
          }
        }
      }

      yield { type: 'done' };
    } catch (err) {
      if (abortSignal?.aborted) return;
      yield {
        type: 'error',
        error: this.normalizeError(err),
      };
    } finally {
      reader.releaseLock();
    }
  }

  supports(model: MakkariModel): boolean {
    return model.providerKey === 'groq';
  }

  normalizeError(error: unknown): AIError {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      return {
        provider: 'groq',
        message: 'Request aborted by user.',
        userMessage: 'Generation stopped.',
        retryable: false,
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown Groq error';
    const is404 = message.includes('404') || message.includes('not found');
    const is429 = message.includes('429') || message.includes('rate');

    return {
      provider: 'groq',
      status: is404 ? 404 : is429 ? 429 : 500,
      modelUnavailable: is404,
      message,
      userMessage: is404
        ? 'This Groq model is currently unavailable.'
        : is429
        ? 'Groq rate limit exceeded. Please wait a moment.'
        : 'Groq connection error.',
      retryable: is429 || !is404,
    };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    const health = await this.healthCheck(apiKey);
    return health.status === 'connected';
  }
}
