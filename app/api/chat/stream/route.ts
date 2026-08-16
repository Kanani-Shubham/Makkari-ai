import { NextRequest, NextResponse } from 'next/server';
import { ProviderId, ChatMessage } from '@/lib/ai/types';
import { decryptKey } from '@/lib/ai/encryption';
import { createClient } from '@/lib/supabase/server';
import { getRelevantMemoryContext, formatMemoryContextPrompt } from '@/lib/ai/memory/memory-service';
import { processPostChatJobs } from '@/lib/ai/memory/post-chat-worker';
import { detectMemoryIntent } from '@/lib/ai/memory/memory-intent';
import { resolveTurnCapabilities } from '@/lib/ai/capability/pipeline';
import { CanonicalEventBus } from '@/lib/ai/events/canonical-events';
import { PendingActionStore } from '@/lib/ai/actions/pending-action-store';
import { toolRouter } from '@/lib/ai/tools/tool-router';
import { generateCallId } from '@/lib/ai/runtime/runtime-messages';
import { createTurnState } from '@/lib/ai/runtime/turn-state';
import { queryEngine } from '@/lib/ai/runtime/query-engine';
import { ToolExecutionContext } from '@/lib/ai/tools/types';

/**
 * Chat Stream Route Handler
 *
 * ARCHITECTURAL CONTRACT:
 * Route authenticates, decrypts keys, resolves capabilities & memory,
 * constructs TurnState, and hands execution directly to QueryEngine.
 * QueryEngine is the ONLY place that invokes provider streaming and drives tool loops.
 */
const DEFAULT_PROVIDER_MODELS: Record<ProviderId, string> = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  ollama: 'llama3.2',
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-latest',
  openrouter: 'anthropic/claude-3.5-sonnet',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const providerId: ProviderId = (body.providerId || body.provider || 'gemini') as ProviderId;
    const rawModel: string = body.modelId || body.model || '';
    const modelId = (!rawModel || rawModel === 'default') ? (DEFAULT_PROVIDER_MODELS[providerId] || 'gemini-2.5-flash') : rawModel;
    const messages: ChatMessage[] = body.messages || [];
    const customApiKey: string | undefined = body.customApiKey || body.customKey;
    const {
      chatId = 'ephemeral',
      systemPrompt = '',
      temperature = 0.7,
      reasoningEffort,
    } = body;

    const lastMsg = messages[messages.length - 1];
    const safePreview = (lastMsg?.content || '').slice(0, 50).replace(/\n/g, ' ');

    console.log(
      `[CHAT_RUNTIME] chatId=${chatId} provider=${providerId} model=${modelId} messageCount=${messages.length} lastRole=${lastMsg?.role} preview="${safePreview}"`
    );

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

    // Shared ToolExecutionContext for this turn
    const toolContext: ToolExecutionContext = {
      userId: user?.id,
      chatId,
      providerId,
      modelId,
      supabaseClient: supabase,
    };

    // 3. Multi-turn Pending Action Confirmation
    if (user && chatId) {
      const isAffirmative = /^(yes|yeah|yep|sure|proceed|confirm|do it|create it|go ahead|please do)$/i.test(queryText);
      if (isAffirmative) {
        const activeAction = await PendingActionStore.getActiveActionForConversation(supabase, user.id, chatId);
        if (activeAction) {
          const execRes = await PendingActionStore.executeAction(
            supabase,
            user.id,
            activeAction.id,
            `exec_${generateCallId()}`,
            toolContext
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

    // 4. Memory Intent & Pre-Stream Execution (routed strictly through ToolRouter)
    if (user) {
      try {
        const intent = detectMemoryIntent(lastUserMsg?.content || '');
        let toolExecutionBlock = '';

        if (intent.category !== 'NONE') {
          if (intent.category === 'REMEMBER' && intent.extractedFact) {
            const memoryCallId = generateCallId();
            const memoryResult = await toolRouter.executeToolCall(
              {
                toolId: 'memory',
                toolName: 'makkari_memory',
                callId: memoryCallId,
                arguments: {
                  action: 'remember',
                  content: intent.extractedFact,
                  type: intent.inferredType,
                },
              },
              toolContext
            );

            if (memoryResult.success) {
              toolExecutionBlock = `\n\n<runtime_tool_execution>
Tool: memory
Operation: remember
Status: SUCCESS
Memory Content: "${intent.extractedFact}"
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

    // 5. Capability Resolution
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

    // 6. TurnState Initialization
    const abortController = new AbortController();
    req.signal.addEventListener('abort', () => abortController.abort());

    const turnState = createTurnState({
      conversationId: chatId,
      userId: user?.id,
      initialMessages: messages,
      model: null,
      abortController,
      environment: process.env.NODE_ENV === 'development' ? 'development' : 'production',
    });

    // Attach turnId to toolContext
    toolContext.turnId = turnState.turnId;

    const encoder = new TextEncoder();

    // 7. Hand off completely to QueryEngine inside the streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const eventBus = new CanonicalEventBus(chatId, (envelope) => {
          controller.enqueue(encoder.encode(CanonicalEventBus.formatSSE(envelope)));
        });

        eventBus.emit({ type: 'STREAM_START' });
        eventBus.emit({ type: 'THINKING_START' });

        try {
          await queryEngine.executeTurn({
            state: turnState,
            providerId,
            modelId,
            apiKey,
            temperature,
            reasoningEffort,
            systemPrompt: finalSystemPrompt,
            messages,
            eventBus,
            toolContext,
          });
        } catch (streamErr: any) {
          if (!eventBus.isTerminal()) {
            eventBus.emit({
              type: 'ERROR',
              message: streamErr.message || 'Stream execution failed',
            });
          }
        } finally {
          controller.close();

          // Background post-chat memory ingestion
          if (user) {
            processPostChatJobs(supabase).catch((err) =>
              console.error('[AI_STREAM] Post-chat worker background error:', err)
            );
          }
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
