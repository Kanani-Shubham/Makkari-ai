import {
  MakkariModel,
  ProviderAdapter,
  ProviderHealth,
  ChatRequest,
  ChatChunk,
  AIError,
} from '../types';

export class GeminiAdapter implements ProviderAdapter {
  providerKey = 'gemini' as const;
  name = 'Google Gemini';

  async discoverModels(apiKey?: string): Promise<MakkariModel[]> {
    const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
      return [];
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        console.warn(`[GEMINI_DISCOVERY] Discovery failed with status ${res.status}`);
        return [];
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return [];
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

      // Filter models that support generation
      const validModels = rawModels.filter((m) => {
        const methods = m.supportedGenerationMethods || [];
        return (
          methods.includes('generateContent') ||
          methods.includes('bidiGenerateContent') ||
          m.name.includes('gemini')
        );
      });

      return validModels.map((m) => {
        const exactId = m.name.replace(/^models\//, '');
        const isThinkingCapable =
          exactId.includes('thinking') ||
          exactId.includes('2.5') ||
          exactId.includes('pro') ||
          exactId.includes('flash');

        const model: MakkariModel = {
          id: exactId,
          providerId: 'gemini',
          providerKey: 'gemini',
          name: m.displayName || exactId,
          displayName: m.displayName || exactId,
          description: m.description || `${(m.inputTokenLimit || 1048576).toLocaleString()} context tokens`,
          type: 'cloud',
          capabilities: {
            text: true,
            vision: true,
            imageGeneration: exactId.includes('imagen') || exactId.includes('image'),
            audioInput: true,
            audioOutput: false,
            videoInput: true,
            fileInput: true,
            streaming: true,
            tools: true,
            reasoning: {
              supported: isThinkingCapable,
              visible: isThinkingCapable,
              configurable: isThinkingCapable,
              supportedEfforts: ['low', 'medium', 'high'],
              defaultEffort: 'medium',
            },
          },
          contextWindow: m.inputTokenLimit || 1048576,
          maxOutputTokens: m.outputTokenLimit || 8192,
          availability: 'available',
          badge: exactId.includes('2.5')
            ? 'Next Gen'
            : exactId.includes('pro')
            ? 'Deep Reasoning'
            : 'Fast & Smart',
        };

        return model;
      });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Timeout';
      console.warn(`[GEMINI_DISCOVERY] Error fetching models from Google (${msg}), using defaults.`);
      return [];
    }
  }

  async healthCheck(apiKey?: string): Promise<ProviderHealth> {
    const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
      return { status: 'not_configured', message: 'API key not configured' };
    }

    try {
      const startTime = Date.now();
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=1`, {
        signal: AbortSignal.timeout(4000),
      });

      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        return { status: 'connected', latencyMs };
      }

      if (res.status === 401 || res.status === 403 || res.status === 400) {
        return { status: 'invalid_key', message: 'Invalid Google Gemini API key' };
      }

      return { status: 'unavailable', message: `Gemini API returned status ${res.status}` };
    } catch (err) {
      return {
        status: 'unavailable',
        message: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const { modelId, messages, apiKey, systemPrompt, temperature = 0.7, reasoningEffort, abortSignal } = request;

    const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
      yield {
        type: 'error',
        error: {
          provider: 'gemini',
          status: 401,
          message: 'Gemini API key is required.',
          userMessage: 'Google Gemini API key is missing. Please add your key in Settings or Model Hub.',
          retryable: false,
        },
      };
      return;
    }

    const contents = messages.map((m) => {
      const parts: Array<Record<string, unknown>> = [];

      // Text part
      if (m.content) {
        parts.push({ text: m.content });
      }

      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: parts.length > 0 ? parts : [{ text: ' ' }],
      };
    });

    const bodyPayload: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature,
      },
    };

    if (systemPrompt) {
      bodyPayload.systemInstruction = {
        parts: [{ text: systemPrompt }],
      };
    }

    let targetId = modelId.replace(/^models\//, '');
    // Normalize deprecated or unreleased model IDs to active official endpoints
    if (
      targetId.includes('gemini-2.5') ||
      targetId.includes('gemini-3.') ||
      targetId.includes('nano-banana') ||
      targetId === 'gemini-1.5-flash-8b'
    ) {
      targetId = 'gemini-2.0-flash';
    }

    // Thinking/Reasoning configuration if supported and effort specified
    const supportsThinking =
      targetId.includes('thinking') ||
      targetId === 'gemini-2.0-flash' ||
      targetId === 'gemini-2.0-flash-exp';

    if (reasoningEffort && supportsThinking) {
      (bodyPayload.generationConfig as Record<string, unknown>).thinkingConfig = {
        thinkingBudget: reasoningEffort === 'low' ? 1024 : reasoningEffort === 'high' ? 8192 : 4096,
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetId}:streamGenerateContent?alt=sse&key=${key}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: abortSignal,
      });

      // If 400 occurred because of thinking level/budget on a model, auto-retry without thinkingConfig
      if (response.status === 400 && (bodyPayload.generationConfig as any)?.thinkingConfig) {
        delete (bodyPayload.generationConfig as any).thinkingConfig;
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
          signal: abortSignal,
        });
      }
    } catch (err) {
      if (abortSignal?.aborted) return;
      yield {
        type: 'error',
        error: this.normalizeError(err),
      };
      return;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[GEMINI_STREAM] Error ${response.status}:`, errorText);
      const is404 = response.status === 404 || errorText.includes('no longer available') || errorText.includes('not found');
      const is401 = response.status === 401 || response.status === 403 || errorText.includes('API_KEY_INVALID');
      const is429 = response.status === 429 || errorText.includes('RESOURCE_EXHAUSTED');

      yield {
        type: 'error',
        error: {
          provider: 'gemini',
          status: response.status,
          code: is404 ? 'MODEL_NOT_AVAILABLE' : is401 ? 'INVALID_API_KEY' : is429 ? 'RATE_LIMITED' : 'PROVIDER_ERROR',
          modelUnavailable: is404,
          message: `Gemini API Error (${response.status}): ${errorText}`,
          userMessage: is404
            ? 'The selected Gemini model is unavailable for this API key. Please choose another model.'
            : is401
            ? 'Invalid Google Gemini API key. Please check your key in Settings.'
            : is429
            ? 'Gemini quota or rate limit exceeded. Please wait a moment.'
            : 'Error communicating with Google Gemini.',
          retryable: is429 || (!is404 && !is401 && response.status >= 500),
        },
      };
      return;
    }

    if (!response.body) {
      yield {
        type: 'error',
        error: {
          provider: 'gemini',
          message: 'Empty response body from Gemini API.',
          userMessage: 'Gemini returned an empty response stream.',
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
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const candidate = parsed.candidates?.[0];
              const parts = candidate?.content?.parts;

              if (Array.isArray(parts)) {
                for (const part of parts) {
                  // 1. Thought Summary (User-visible reasoning)
                  if (part.thought_summary || part.thoughtSummary) {
                    const summaryText = String(part.thought_summary || part.thoughtSummary);
                    yield {
                      type: 'reasoning',
                      event: {
                        visibility: 'summary',
                        summary: summaryText,
                        provider: 'gemini',
                        metadata: part.thoughtSignature ? { signature: part.thoughtSignature } : undefined,
                      },
                    };
                  }

                  // 2. Normal text response
                  if (part.text) {
                    yield {
                      type: 'text',
                      content: part.text,
                    };
                  }
                }
              }
            } catch {
              // Ignore partial JSON parse errors in SSE stream
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
    return model.providerKey === 'gemini';
  }

  normalizeError(error: unknown): AIError {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      return {
        provider: 'gemini',
        message: 'Request aborted by user.',
        userMessage: 'Generation stopped.',
        retryable: false,
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown Gemini error';
    const is404 = message.includes('404') || message.includes('not found');
    const is429 = message.includes('429') || message.includes('quota') || message.includes('rate');

    return {
      provider: 'gemini',
      status: is404 ? 404 : is429 ? 429 : 500,
      modelUnavailable: is404,
      message,
      userMessage: is404
        ? 'This Gemini model is no longer available. Makkari will select a valid alternative.'
        : is429
        ? 'Gemini rate limit exceeded. Please wait a moment and retry.'
        : 'Gemini request failed. Please check your connection or API key.',
      retryable: is429 || !is404,
    };
  }

  // Legacy helper
  async validateKey(apiKey: string): Promise<boolean> {
    const health = await this.healthCheck(apiKey);
    return health.status === 'connected';
  }
}
