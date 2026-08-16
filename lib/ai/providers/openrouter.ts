import {
  MakkariModel,
  ProviderAdapter,
  ProviderHealth,
  ChatRequest,
  ChatChunk,
  AIError,
} from '../types';

export class OpenRouterAdapter implements ProviderAdapter {
  providerKey = 'openrouter' as const;
  name = 'OpenRouter';

  async discoverModels(apiKey?: string): Promise<MakkariModel[]> {
    const key = apiKey || process.env.OPENROUTER_API_KEY;

    try {
      const headers: Record<string, string> = {
        'HTTP-Referer': 'https://makkari.ai',
        'X-Title': 'Makkari AI Workspace',
      };
      if (key) headers.Authorization = `Bearer ${key}`;

      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers,
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return [];
      const data = await res.json();
      const rawList: Array<{
        id: string;
        name: string;
        description?: string;
        context_length?: number;
        architecture?: {
          modality?: string;
          instruct_type?: string;
        };
        supported_parameters?: string[];
      }> = data.data || [];

      // Filter top accessible models (limit to top 40 for clean performance)
      const filtered = rawList.slice(0, 40);

      return filtered.map((m) => {
        const isReasoning =
          m.id.includes('r1') ||
          m.id.includes('thinking') ||
          m.id.includes('reason') ||
          m.id.includes('o1') ||
          m.id.includes('o3') ||
          (m.supported_parameters || []).includes('include_reasoning');

        const isVision =
          (m.architecture?.modality || '').includes('image') ||
          (m.architecture?.modality || '').includes('multimodal') ||
          m.id.includes('vision') ||
          m.id.includes('claude') ||
          m.id.includes('gpt-4');

        const contextLen = m.context_length || 128000;

        return {
          id: m.id,
          providerId: 'openrouter',
          providerKey: 'openrouter',
          name: m.name || m.id,
          displayName: m.name || m.id,
          description: m.description || `${contextLen.toLocaleString()} context tokens`,
          type: 'cloud',
          capabilities: {
            text: true,
            vision: isVision,
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
          contextWindow: contextLen,
          maxOutputTokens: 8192,
          availability: 'available',
          badge: isReasoning ? 'Reasoning' : isVision ? 'Multimodal' : 'Cloud AI',
        };
      });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Timeout';
      console.warn(`[OPENROUTER_DISCOVERY] Error discovering models (${msg}), using defaults.`);
      return [];
    }
  }

  async healthCheck(apiKey?: string): Promise<ProviderHealth> {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) {
      return { status: 'not_configured', message: 'OpenRouter API key not configured' };
    }

    try {
      const startTime = Date.now();
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(4000),
      });

      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        return { status: 'connected', latencyMs };
      }

      if (res.status === 401 || res.status === 403) {
        return { status: 'invalid_key', message: 'Invalid OpenRouter API Key' };
      }

      return { status: 'unavailable', message: `OpenRouter returned status ${res.status}` };
    } catch (err) {
      return {
        status: 'unavailable',
        message: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const { modelId, messages, apiKey, systemPrompt, temperature = 0.7, abortSignal } = request;

    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) {
      yield {
        type: 'error',
        error: {
          provider: 'openrouter',
          status: 401,
          message: 'OpenRouter API Key is required.',
          userMessage: 'OpenRouter API Key is missing. Please add your key in Settings or Model Hub.',
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
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'HTTP-Referer': 'https://makkari.ai',
          'X-Title': 'Makkari AI Workspace',
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
          provider: 'openrouter',
          status: response.status,
          modelUnavailable: response.status === 404,
          message: `OpenRouter API Error (${response.status}): ${errText}`,
          userMessage:
            response.status === 404
              ? `OpenRouter model "${modelId}" is currently unavailable.`
              : 'Error connecting to OpenRouter.',
          retryable: response.status >= 500 || response.status === 429,
        },
      };
      return;
    }

    if (!response.body) {
      yield {
        type: 'error',
        error: {
          provider: 'openrouter',
          message: 'Empty response stream from OpenRouter.',
          userMessage: 'OpenRouter returned an empty response.',
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

              // Normalized reasoning from OpenRouter
              if (delta?.reasoning || delta?.reasoning_content) {
                yield {
                  type: 'reasoning',
                  event: {
                    visibility: 'summary',
                    content: 'Analyzing request...',
                    summary: 'Synthesizing response...',
                    provider: 'openrouter',
                  },
                };
              }

              // Text content
              if (delta?.content) {
                yield {
                  type: 'text',
                  content: delta.content,
                };
              }
            } catch {
              // Ignore partial JSON chunks
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
    return model.providerKey === 'openrouter';
  }

  normalizeError(error: unknown): AIError {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      return {
        provider: 'openrouter',
        message: 'Request aborted by user.',
        userMessage: 'Generation stopped.',
        retryable: false,
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown OpenRouter error';
    const is404 = message.includes('404') || message.includes('not found');
    const is429 = message.includes('429') || message.includes('rate');

    return {
      provider: 'openrouter',
      status: is404 ? 404 : is429 ? 429 : 500,
      modelUnavailable: is404,
      message,
      userMessage: is404
        ? 'This OpenRouter model is currently unavailable.'
        : is429
        ? 'OpenRouter rate limit or credit quota exceeded.'
        : 'OpenRouter connection error.',
      retryable: is429 || !is404,
    };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    const health = await this.healthCheck(apiKey);
    return health.status === 'connected';
  }
}
