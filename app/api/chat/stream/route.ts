import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/adapter';
import { ProviderId, ChatMessage, ChatRequest } from '@/lib/ai/types';
import { decryptKey } from '@/lib/ai/encryption';
import { createClient } from '@/lib/supabase/server';
import { getRelevantMemoryContext, formatMemoryContextPrompt } from '@/lib/ai/memory/memory-service';
import { processPostChatJobs } from '@/lib/ai/memory/post-chat-worker';
import { detectMemoryIntent } from '@/lib/ai/memory/memory-intent';
import { executeMemoryTool } from '@/lib/ai/tools/memory';
import { resolveTurnCapabilities } from '@/lib/ai/capability/pipeline';
import { StatefulToolProtocolParser, ParsedToolCall } from '@/lib/ai/stream/tool-protocol-parser';
import { createConversationArtifact } from '@/lib/artifacts/artifact-service';
import { CanonicalEventBus } from '@/lib/ai/events/canonical-events';
import { PendingActionStore } from '@/lib/ai/actions/pending-action-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const providerId: ProviderId = (body.providerId || body.provider || 'groq') as ProviderId;
    const modelId: string = body.modelId || body.model || 'openai/gpt-oss-120b';
    const messages: ChatMessage[] = body.messages || [];
    const customApiKey: string | undefined = body.customApiKey || body.customKey;
    const {
      chatId = 'ephemeral',
      systemPrompt = '',
      temperature = 0.7,
      reasoningEffort,
    } = body;

    console.log(`[AI_STREAM] Request for Provider: "${providerId}", Model: "${modelId}", Messages: ${messages.length}`);

    if (!providerId || !modelId || messages.length === 0) {
      return NextResponse.json(
        { error: 'Missing required parameters: providerId, modelId, messages' },
        { status: 400 }
      );
    }

    let apiKey = customApiKey;

    // 1. Environment variable key fallback
    if (!apiKey) {
      if (providerId === 'groq' && process.env.GROQ_API_KEY) {
        apiKey = process.env.GROQ_API_KEY;
      } else if (providerId === 'gemini' && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
        apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      } else if (providerId === 'openrouter' && process.env.OPENROUTER_API_KEY) {
        apiKey = process.env.OPENROUTER_API_KEY;
      } else if (providerId === 'openai' && process.env.OPENAI_API_KEY) {
        apiKey = process.env.OPENAI_API_KEY;
      } else if (providerId === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
        apiKey = process.env.ANTHROPIC_API_KEY;
      }
    }

    // 2. Derive authenticated user and fetch stored encrypted key if needed
    const streamStartTime = Date.now();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (providerId !== 'ollama' && !apiKey && user) {
      try {
        const { data: keyRecord } = await supabase
          .from('user_api_keys')
          .select('encrypted_key, iv')
          .eq('user_id', user.id)
          .eq('provider', providerId)
          .single();

        if (keyRecord) {
          apiKey = await decryptKey(keyRecord.encrypted_key, keyRecord.iv);
        }
      } catch (err) {
        console.warn('[AI_STREAM] Warning fetching stored API key:', err);
      }
    }

    let finalSystemPrompt = systemPrompt;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const queryText = (lastUserMsg?.content || '').trim().toLowerCase();

    // 3. Multi-turn Pending Action Confirmation Check ("yes", "sure", "proceed", "create")
    if (user && chatId) {
      const isAffirmative = /^(yes|yeah|yep|sure|proceed|confirm|do it|create it|go ahead|please do)$/i.test(queryText);
      if (isAffirmative) {
        const activeAction = await PendingActionStore.getActiveActionForConversation(supabase, user.id, chatId);
        if (activeAction) {
          const execRes = await PendingActionStore.executeAction(
            supabase,
            user.id,
            activeAction.id,
            `exec_${Date.now()}`
          );

          finalSystemPrompt += `\n\n<runtime_action_execution>
Action: ${activeAction.tool}
Status: ${execRes.success ? 'SUCCESS' : 'FAILED'}
${execRes.error ? `Error: ${execRes.error}` : `Result: ${JSON.stringify(execRes.result)}`}
Directive: The pending action execution has ALREADY completed. Acknowledge and explain the result directly to the user.
</runtime_action_execution>`;
        }
      }
    }

    // 4. Memory Intent & Retrieval
    if (user) {
      try {
        const intent = detectMemoryIntent(lastUserMsg?.content || '');
        let toolExecutionBlock = '';

        if (intent.category !== 'NONE') {
          if (intent.category === 'REMEMBER' && intent.extractedFact) {
            const result = await executeMemoryTool(
              {
                supabase,
                userId: user.id,
                isUserExplicit: true,
                sourceChatId: chatId,
              },
              {
                operation: 'remember',
                content: intent.extractedFact,
                type: intent.inferredType,
              }
            );

            if (result.success) {
              toolExecutionBlock = `\n\n<runtime_tool_execution>
Tool: memory
Operation: remember
Status: SUCCESS
Action: ${result.action}
Memory Content: "${result.memory?.content || intent.extractedFact}"
Directive: Memory persistence has ALREADY completed successfully for this fact. Do NOT call the memory tool again in this response. Acknowledge naturally and concisely that you have saved/updated this in memory.
</runtime_tool_execution>`;
            }
          }
        }

        const memContext = await getRelevantMemoryContext(
          supabase,
          user.id,
          lastUserMsg?.content || ''
        );

        if (memContext && (memContext.recentSummaries.length > 0 || memContext.persistentMemories.length > 0)) {
          finalSystemPrompt += '\n\n' + formatMemoryContextPrompt(memContext);
        }

        if (toolExecutionBlock) {
          finalSystemPrompt += toolExecutionBlock;
        }
      } catch (memErr) {
        console.warn('[AI_STREAM] Memory retrieval error:', memErr);
      }
    }

    // 5. Capability Resolution with Output Contract
    const resolvedCaps = await resolveTurnCapabilities({
      userId: user?.id,
      chatId,
      userPrompt: lastUserMsg?.content || '',
      modelId,
      providerId,
    });

    if (resolvedCaps.systemPromptAdditions) {
      finalSystemPrompt += '\n\n' + resolvedCaps.systemPromptAdditions;
    }

    const adapter = getAIProvider(providerId);

    const chatReq: ChatRequest = {
      chatId,
      modelId,
      messages,
      systemPrompt: finalSystemPrompt,
      apiKey,
      temperature,
      reasoningEffort,
      abortSignal: req.signal,
    };

    const streamIterator = adapter.streamChat(chatReq);
    const iterator = streamIterator[Symbol.asyncIterator]();
    let firstResult: IteratorResult<any>;

    try {
      firstResult = await iterator.next();
    } catch (err: unknown) {
      console.error('[AI_STREAM] Upstream initialization error:', err);
      const normalized = adapter.normalizeError(err);
      return NextResponse.json(
        {
          error: 'PROVIDER_ERROR',
          provider: providerId,
          code: normalized.code || 'PROVIDER_ERROR',
          message: normalized.userMessage || normalized.message,
          retryable: normalized.retryable ?? false,
        },
        { status: normalized.status && normalized.status >= 400 && normalized.status < 600 ? normalized.status : 502 }
      );
    }

    if (!firstResult || firstResult.done) {
      return NextResponse.json(
        {
          error: 'PROVIDER_ERROR',
          provider: providerId,
          code: 'EMPTY_RESPONSE',
          message: 'The AI provider returned an empty response.',
          retryable: true,
        },
        { status: 502 }
      );
    }

    const firstChunk = firstResult.value;
    if (firstChunk.type === 'error') {
      const err = firstChunk.error;
      return NextResponse.json(
        {
          error: 'PROVIDER_ERROR',
          provider: providerId,
          code: err.code || 'PROVIDER_ERROR',
          message: err.userMessage || err.message,
          retryable: err.retryable ?? false,
        },
        { status: err.status && err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }

    const encoder = new TextEncoder();
    const parser = new StatefulToolProtocolParser();
    let accumulatedContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        // Initialize Centralized Canonical Event Bus
        const eventBus = new CanonicalEventBus(chatId, (envelope) => {
          controller.enqueue(encoder.encode(CanonicalEventBus.formatSSE(envelope)));
        });

        // 1. Emit stream & thinking start
        eventBus.emit({ type: 'STREAM_START' });
        eventBus.emit({ type: 'THINKING_START' });

        // Helper to execute and emit parsed tool calls
        async function handleToolCall(tc: ParsedToolCall) {
          if (tc.name === 'makkari_artifact' || tc.rawProtocol.includes('makkari_artifact')) {
            const filename = tc.parameters.filename || tc.parameters.file_name || 'index.html';
            const content = tc.parameters.content || '';
            const title = tc.parameters.title || 'Interactive Web Page';
            const language = tc.parameters.language || (filename.endsWith('.html') ? 'html' : 'plaintext');

            eventBus.emit({
              type: 'TOOL_CALL',
              tool: 'makkari_artifact',
              callId: `call_${Date.now()}`,
              parameters: tc.parameters,
            });

            eventBus.emit({
              type: 'THINKING_STATUS',
              status: `Creating artifact: ${filename}...`,
            });

            if (user && chatId && content) {
              try {
                const createdArtifact = await createConversationArtifact(supabase, user.id, chatId, {
                  title,
                  artifact_type: filename.endsWith('.html') ? 'web' : 'code',
                  files: [
                    {
                      filename,
                      content,
                      language,
                      is_entry_file: true,
                    },
                  ],
                });

                // Emit structured canonical ARTIFACT_CREATE event
                eventBus.emit({
                  type: 'ARTIFACT_CREATE',
                  artifact: {
                    artifactId: createdArtifact.id,
                    title: createdArtifact.title,
                    artifactType: createdArtifact.artifact_type as any,
                    version: 1,
                    files: createdArtifact.files.map((f: any) => ({
                      id: f.id,
                      filename: f.filename,
                      language: f.language,
                      mimeType: f.mime_type,
                      sizeBytes: f.size_bytes,
                      content: f.content,
                      isEntryFile: f.is_entry_file,
                    })),
                  },
                });

                eventBus.emit({
                  type: 'TOOL_RESULT',
                  callId: `call_${Date.now()}`,
                  result: {
                    success: true,
                    summary: `Created artifact ${createdArtifact.title}`,
                    output: { artifactId: createdArtifact.id },
                  },
                });
              } catch (artErr: any) {
                console.error('[AI_STREAM] Error creating artifact:', artErr);
                eventBus.emit({
                  type: 'TOOL_RESULT',
                  callId: `call_${Date.now()}`,
                  result: {
                    success: false,
                    error: {
                      code: 'ARTIFACT_CREATION_FAILED',
                      message: artErr.message || 'Failed to save artifact',
                      retryable: true,
                    },
                  },
                });
              }
            }
          }
        }

        try {
          // Process first chunk
          if (firstChunk.type === 'text' && firstChunk.content) {
            const parseRes = parser.processChunk(firstChunk.content);
            if (parseRes.textDelta) {
              accumulatedContent += parseRes.textDelta;
              eventBus.emit({ type: 'TEXT_DELTA', delta: parseRes.textDelta });
            }
            for (const tc of parseRes.completedToolCalls) {
              await handleToolCall(tc);
            }
          }

          // Process subsequent chunks
          while (true) {
            if (req.signal.aborted) {
              eventBus.emit({ type: 'CANCELLED', reason: 'Client cancelled request' });
              break;
            }

            const next = await iterator.next();
            if (next.done) break;

            const chunk = next.value;

            if (chunk.type === 'error') {
              eventBus.emit({
                type: 'ERROR',
                message: chunk.error.userMessage || chunk.error.message,
                code: chunk.error.code,
                retryable: chunk.error.retryable,
              });
              break;
            }

            if (chunk.type === 'text' && chunk.content) {
              const parseRes = parser.processChunk(chunk.content);
              if (parseRes.textDelta) {
                accumulatedContent += parseRes.textDelta;
                eventBus.emit({ type: 'TEXT_DELTA', delta: parseRes.textDelta });
              }
              for (const tc of parseRes.completedToolCalls) {
                await handleToolCall(tc);
              }
            }
          }

          // Flush parser buffer
          const flushed = parser.flush();
          if (flushed.textDelta) {
            accumulatedContent += flushed.textDelta;
            eventBus.emit({ type: 'TEXT_DELTA', delta: flushed.textDelta });
          }
          for (const tc of flushed.completedToolCalls) {
            await handleToolCall(tc);
          }

          // Emit single terminal DONE event if not already terminal
          if (!eventBus.isTerminal()) {
            eventBus.emit({ type: 'DONE' });
          }

          controller.close();

          // Background post-chat memory ingestion
          if (user) {
            processPostChatJobs(supabase).catch((err) =>
              console.error('[AI_STREAM] Post-chat worker background error:', err)
            );
          }
        } catch (streamErr: any) {
          if (!eventBus.isTerminal()) {
            eventBus.emit({
              type: 'ERROR',
              message: streamErr.message || 'Stream processing interrupted',
            });
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: unknown) {
    console.error('[AI_STREAM] Fatal route error:', err);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
