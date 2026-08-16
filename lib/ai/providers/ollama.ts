import {
  MakkariModel,
  LocalProviderAdapter,
  ProviderHealth,
  ChatRequest,
  ChatChunk,
  PullProgress,
  AIError,
} from '../types';

export const OLLAMA_PRIMARY_URL = 'http://127.0.0.1:11434';
export const OLLAMA_FALLBACK_URL = 'http://localhost:11434';

export class OllamaAdapter implements LocalProviderAdapter {
  providerKey = 'ollama' as const;
  name = 'Ollama (Local AI)';

  private activeBaseUrl = OLLAMA_PRIMARY_URL;

  private async getWorkingBaseUrl(): Promise<string> {
    const customUrl = process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL;
    if (customUrl && customUrl.trim() !== '') {
      return customUrl.replace(/\/+$/, '');
    }

    const isCloudServerless =
      process.env.VERCEL === '1' ||
      process.env.NEXT_PUBLIC_APP_URL?.includes('vercel.app');

    if (isCloudServerless) {
      return OLLAMA_PRIMARY_URL;
    }

    try {
      const res = await fetch(`${OLLAMA_PRIMARY_URL}/api/tags`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) {
        this.activeBaseUrl = OLLAMA_PRIMARY_URL;
        return OLLAMA_PRIMARY_URL;
      }
    } catch {
      // Try localhost fallback
      try {
        const fallbackRes = await fetch(`${OLLAMA_FALLBACK_URL}/api/tags`, {
          signal: AbortSignal.timeout(1000),
        });
        if (fallbackRes.ok) {
          this.activeBaseUrl = OLLAMA_FALLBACK_URL;
          return OLLAMA_FALLBACK_URL;
        }
      } catch {
        // Both failed
      }
    }
    return this.activeBaseUrl;
  }

  async getLocalStatus(): Promise<ProviderHealth> {
    const isCloudServerless =
      process.env.VERCEL === '1' ||
      process.env.NEXT_PUBLIC_APP_URL?.includes('vercel.app');

    const customUrl = process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL;

    if (isCloudServerless && !customUrl) {
      return {
        status: 'unavailable',
        message: 'Ollama is local-only. Running Makkari locally connects to localhost:11434, or configure a remote URL.',
      };
    }

    try {
      const startTime = Date.now();
      const baseUrl = await this.getWorkingBaseUrl();
      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });

      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        return { status: 'connected', latencyMs };
      }
      return { status: 'unavailable', message: 'Ollama is unreachable' };
    } catch (err) {
      return {
        status: 'unavailable',
        message: err instanceof Error ? err.message : 'Ollama local connection failed',
      };
    }
  }


  async healthCheck(): Promise<ProviderHealth> {
    return this.getLocalStatus();
  }

  async listInstalledModels(): Promise<MakkariModel[]> {
    try {
      const baseUrl = await this.getWorkingBaseUrl();
      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2500),
      });

      if (!res.ok) {
        return [];
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return [];
      }

      const data = await res.json();
      const rawList: Array<{
        name: string;
        model?: string;
        size?: number;
        digest?: string;
        details?: {
          family?: string;
          parameter_size?: string;
          quantization_level?: string;
        };
      }> = data.models || [];

      const models: MakkariModel[] = [];

      for (const item of rawList) {
        const modelName = item.name;
        const details = item.details || {};
        const isVision =
          (details.family || '').includes('vision') ||
          (details.family || '').includes('mllama') ||
          (details.family || '').includes('clip') ||
          modelName.includes('vision') ||
          modelName.includes('llava');

        const isThinking =
          (details.family || '').includes('deepseek') ||
          modelName.includes('r1') ||
          modelName.includes('qwen3') ||
          modelName.includes('reason');

        models.push({
          id: modelName,
          providerId: 'ollama',
          providerKey: 'ollama',
          name: modelName,
          displayName: modelName,
          description: `${details.parameter_size || 'Local'} • ${details.quantization_level || 'Quantized'}`,
          type: 'local',
          capabilities: {
            text: true,
            vision: isVision,
            imageGeneration: false,
            audioInput: false,
            audioOutput: false,
            videoInput: false,
            fileInput: true,
            streaming: true,
            tools: false,
            reasoning: {
              supported: isThinking,
              visible: isThinking,
              configurable: false,
            },
          },
          contextWindow: 131072,
          maxOutputTokens: 8192,
          availability: 'available',
          localState: 'installed',
          sizeBytes: item.size,
          parameterSize: details.parameter_size,
          quantization: details.quantization_level,
          family: details.family,
          badge: isThinking ? 'Local Reasoning' : isVision ? 'Local Vision' : 'Local Model',
        });
      }

      return models;
    } catch (err) {
      console.warn('[OLLAMA_DISCOVERY] Error listing models:', err);
      return [];
    }
  }

  async discoverModels(): Promise<MakkariModel[]> {
    return this.listInstalledModels();
  }

  async pullModel(modelId: string, onProgress: (progress: PullProgress) => void): Promise<boolean> {
    try {
      const baseUrl = await this.getWorkingBaseUrl();
      const res = await fetch(`${baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelId, stream: true }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Failed to pull model ${modelId}: HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const percent =
              parsed.total && parsed.completed && parsed.total > 0
                ? Math.min(100, Math.round((parsed.completed / parsed.total) * 100))
                : undefined;

            onProgress({
              status: parsed.status || 'downloading',
              digest: parsed.digest,
              total: parsed.total,
              completed: parsed.completed,
              percent,
            });
          } catch {
            // Ignore parse errors on chunks
          }
        }
      }

      onProgress({ status: 'success', percent: 100 });
      return true;
    } catch (err) {
      console.error(`[OLLAMA_PULL] Error downloading ${modelId}:`, err);
      onProgress({ status: 'error', percent: 0 });
      return false;
    }
  }

  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const { modelId, messages, systemPrompt, temperature = 0.7, abortSignal } = request;

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (systemPrompt) {
      formattedMessages.unshift({ role: 'system', content: systemPrompt });
    }

    const baseUrl = await this.getWorkingBaseUrl();
    let response: Response;

    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: formattedMessages,
          stream: true,
          options: { temperature },
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
      const errorText = await response.text().catch(() => 'Connection error');
      yield {
        type: 'error',
        error: {
          provider: 'ollama',
          status: response.status,
          message: `Ollama error (${response.status}): ${errorText}`,
          userMessage:
            response.status === 404
              ? `Model "${modelId}" is not installed in local Ollama.`
              : 'Ollama connection error. Verify Ollama is running locally.',
          retryable: true,
        },
      };
      return;
    }

    if (!response.body) {
      yield {
        type: 'error',
        error: {
          provider: 'ollama',
          message: 'Empty response stream from Ollama.',
          userMessage: 'Ollama returned an empty response.',
          retryable: true,
        },
      };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let inThinkTag = false;

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
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);

            // 1. Structured thinking / reasoning_content field from Ollama API
            const thinkingChunk = parsed.message?.thinking || parsed.message?.reasoning_content;
            if (thinkingChunk) {
              yield {
                type: 'reasoning',
                event: {
                  visibility: 'summary',
                  content: thinkingChunk,
                  summary: thinkingChunk,
                  provider: 'ollama',
                },
              };
            }

            // 2. Text response with inline <think> tag handling
            if (parsed.message?.content) {
              let textChunk = parsed.message.content;

              if (!inThinkTag && textChunk.includes('<think>')) {
                inThinkTag = true;
                const parts = textChunk.split('<think>');
                if (parts[0]) {
                  yield { type: 'text', content: parts[0] };
                }
                textChunk = parts.slice(1).join('<think>');
              }

              if (inThinkTag) {
                if (textChunk.includes('</think>')) {
                  inThinkTag = false;
                  const parts = textChunk.split('</think>');
                  if (parts[0]) {
                    yield {
                      type: 'reasoning',
                      event: {
                        visibility: 'summary',
                        content: parts[0],
                        summary: parts[0],
                        provider: 'ollama',
                      },
                    };
                  }
                  if (parts[1]) {
                    yield { type: 'text', content: parts[1] };
                  }
                } else {
                  yield {
                    type: 'reasoning',
                    event: {
                      visibility: 'summary',
                      content: textChunk,
                      summary: textChunk,
                      provider: 'ollama',
                    },
                  };
                }
              } else if (textChunk) {
                yield {
                  type: 'text',
                  content: textChunk,
                };
              }
            }

            if (parsed.done) {
              yield { type: 'done' };
              return;
            }
          } catch {
            // Ignore parse errors on partial JSON chunks
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
    return model.providerKey === 'ollama';
  }

  normalizeError(error: unknown): AIError {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      return {
        provider: 'ollama',
        message: 'Request aborted by user.',
        userMessage: 'Generation stopped.',
        retryable: false,
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown Ollama error';
    return {
      provider: 'ollama',
      message,
      userMessage: 'Could not connect to local Ollama. Please ensure Ollama is running on 127.0.0.1:11434.',
      retryable: true,
    };
  }

  // Static helper for legacy callers
  static async getTags(): Promise<{ online: boolean; models: { id: string; name: string }[] }> {
    const adapter = new OllamaAdapter();
    const health = await adapter.getLocalStatus();
    if (health.status !== 'connected') {
      return { online: false, models: [] };
    }
    const models = await adapter.listInstalledModels();
    return {
      online: true,
      models: models.map((m) => ({ id: m.id, name: m.displayName })),
    };
  }
}
