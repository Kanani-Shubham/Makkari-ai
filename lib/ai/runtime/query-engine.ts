/**
 * MAKKARI AI — QueryEngine (Multi-Turn State Machine Orchestrator)
 *
 * ARCHITECTURE CONTRACT:
 * The QueryEngine is the ONLY place that orchestrates multi-turn tool loops.
 * route.ts calls QueryEngine; the engine drives the full turn lifecycle.
 *
 * State Machine:
 *   initializing → generating → executing_tools → generating → ... → completed
 *                                                             ↘ budget_exceeded
 *                            ↘ cancelled (AbortSignal)
 *                            ↘ failed (unrecoverable provider error)
 *
 * Acceptance Tests (8):
 * T1 — Single-turn no-tool response completes in 1 iteration
 * T2 — Tool call executes and result is appended before next provider call
 * T3 — Second iteration receives tool results and produces final answer
 * T4 — AbortSignal cancels the loop mid-turn
 * T5 — budget.maxIterations enforced — loop stops, DONE emitted, no crash
 * T6 — budget.maxToolCalls enforced — tool call blocked after limit
 * T7 — Duplicate tool+args triggers loop detection, returns error result
 * T8 — Provider error mid-loop is caught, FAILED status set, loop exits
 */

import { CanonicalEventBus } from '@/lib/ai/events/canonical-events';
import { getAIProvider } from '@/lib/ai/adapter';
import { ChatMessage, ChatRequest, ProviderId, ProviderAdapter } from '@/lib/ai/types';
import { StatefulToolProtocolParser } from '@/lib/ai/stream/tool-protocol-parser';
import { toolRouter } from '@/lib/ai/tools/tool-router';
import { ToolExecutionContext } from '@/lib/ai/tools/types';
import { generateCallId } from './runtime-messages';
import { TurnState, isTurnCancelled, isTurnTerminal } from './turn-state';
import { checkBudgetExhausted } from './turn-limits';

// ---------------------------------------------------------------
// QueryEngineOptions
// ---------------------------------------------------------------

export interface QueryEngineOptions {
  /** Turn state — single source of truth, mutated in place. */
  state: TurnState;
  /** Provider identifier. */
  providerId: ProviderId;
  /** Model identifier. */
  modelId: string;
  /** Provider API key. */
  apiKey?: string;
  /** Temperature for generation. */
  temperature?: number;
  /** Reasoning effort (for models that support it). */
  reasoningEffort?: string;
  /** Fully resolved system prompt (capabilities, memory, etc. already injected). */
  systemPrompt?: string;
  /** Initial message history (user + prior turns). Adapters accept ChatMessage[] in Phase 3. */
  messages: ChatMessage[];
  /** Canonical event bus — receives all TOOL_CALL, TOOL_RESULT, TEXT_DELTA, DONE etc. */
  eventBus: CanonicalEventBus;
  /** Tool execution context — passed through to ToolRouter. */
  toolContext?: ToolExecutionContext;
}


// ---------------------------------------------------------------
// QueryEngine
// ---------------------------------------------------------------

/**
 * Drives a single user turn to completion.
 * Runs a state-machine while-loop: generate → execute tools → generate → ...
 * Terminates on: final answer, budget exhausted, cancellation, or provider error.
 */
export class QueryEngine {
  constructor(private customAdapters?: Map<string, ProviderAdapter>) {}

  /**
   * Executes a full turn. Returns when the turn reaches a terminal state.
   * Emits canonical events to the provided eventBus.
   */
  public async executeTurn(options: QueryEngineOptions): Promise<void> {
    const {
      state,
      providerId,
      modelId,
      apiKey,
      temperature = 0.7,
      reasoningEffort,
      systemPrompt,
      messages,
      eventBus,
      toolContext,
    } = options;

    state.status = 'generating';

    // Conversation message list across iterations
    let conversationMessages = [...messages];

    const adapter = this.customAdapters?.get(providerId) || getAIProvider(providerId);

    // ---------------------------------------------------------------
    // Main State-Machine Loop
    // ---------------------------------------------------------------
    while (!isTurnTerminal(state) && !isTurnCancelled(state)) {
      // --- Budget Check (before every iteration) ---
      const budgetError = checkBudgetExhausted(state.budget);
      if (budgetError) {
        state.status = 'budget_exceeded';
        eventBus.emit({
          type: 'THINKING_STATUS',
          status: `Turn stopped: ${budgetError}`,
        });
        break;
      }

      // --- Increment Iteration ---
      state.iteration++;
      state.budget.iterationsRemaining--;

      // --- Emit iteration status for turns ---
      if (state.iteration === 1) {
        eventBus.emit({ type: 'THINKING_START' });
      } else {
        eventBus.emit({
          type: 'THINKING_STATUS',
          status: `Iteration ${state.iteration} — processing tool results...`,
        });
      }


      // --- Build provider request ---
      const chatReq: ChatRequest = {
        chatId: state.conversationId,
        modelId,
        messages: conversationMessages,
        systemPrompt,
        apiKey,
        temperature,
        reasoningEffort,
        abortSignal: state.abortController.signal,
      };

      // --- Stream provider response ---
      let fullText = '';
      const toolCallsThisIteration: Array<{ name: string; parameters: Record<string, unknown> }> = [];
      const parser = new StatefulToolProtocolParser();

      try {
        state.status = 'generating';
        const streamIterator = adapter.streamChat(chatReq);

        for await (const chunk of streamIterator) {
          // Cancellation check inside stream
          if (isTurnCancelled(state)) {
            eventBus.emit({ type: 'CANCELLED', reason: 'Client cancelled request' });
            return;
          }

          if (chunk.type === 'error') {
            state.status = 'failed';
            eventBus.emit({
              type: 'ERROR',
              message: chunk.error.userMessage || chunk.error.message,
              code: chunk.error.code,
              retryable: chunk.error.retryable,
            });
            return;
          }

          if (chunk.type === 'text' && chunk.content) {
            const parseRes = parser.processChunk(chunk.content);

            if (parseRes.textDelta) {
              fullText += parseRes.textDelta;
              eventBus.emit({ type: 'TEXT_DELTA', delta: parseRes.textDelta });
            }

            for (const tc of parseRes.completedToolCalls) {
              toolCallsThisIteration.push({ name: tc.name, parameters: tc.parameters });
            }
          }
        }

        // Flush parser after stream ends
        const flushed = parser.flush();
        if (flushed.textDelta) {
          fullText += flushed.textDelta;
          eventBus.emit({ type: 'TEXT_DELTA', delta: flushed.textDelta });
        }
        for (const tc of flushed.completedToolCalls) {
          toolCallsThisIteration.push({ name: tc.name, parameters: tc.parameters });
        }
      } catch (streamErr: any) {
        state.status = 'failed';
        eventBus.emit({
          type: 'ERROR',
          message: streamErr.message || 'Provider stream error',
        });
        return;
      }

      // --- If no tool calls: this is the final answer ---
      if (toolCallsThisIteration.length === 0) {
        // Append assistant message to conversation (for future turns)
        conversationMessages.push({ role: 'assistant', content: fullText });
        state.status = 'completed';
        break;
      }

      // --- Execute all tool calls for this iteration ---
      state.status = 'executing_tools';

      // Build tool result content to append to conversation
      const toolResultParts: string[] = [];

      for (const tc of toolCallsThisIteration) {
        // Cancellation check before each tool
        if (isTurnCancelled(state)) {
          eventBus.emit({ type: 'CANCELLED', reason: 'Client cancelled during tool execution' });
          return;
        }

        // Budget check before each tool call
        if (state.budget.toolCallsRemaining <= 0) {
          state.status = 'budget_exceeded';
          eventBus.emit({
            type: 'THINKING_STATUS',
            status: `Tool call blocked: maximum tool calls per turn reached (${state.limits.maxToolCalls})`,
          });
          break;
        }

        // Loop detection: same tool+args called 2+ times
        const callSignature = `${tc.name}:${JSON.stringify(tc.parameters)}`;
        const duplicateCount = state.budget.callHistory.filter((c) => c === callSignature).length;
        if (duplicateCount >= 2) {
          // Emit an error tool result and continue — don't crash the turn
          const callId = generateCallId();
          eventBus.emit({
            type: 'TOOL_CALL',
            tool: tc.name,
            callId,
            parameters: tc.parameters,
          });
          eventBus.emit({
            type: 'TOOL_RESULT',
            callId,
            result: {
              success: false,
              error: {
                code: 'TOOL_LOOP_DETECTED',
                message: `Recursive loop detected for tool "${tc.name}". Execution halted.`,
                retryable: false,
              },
            },
          });
          toolResultParts.push(
            `<tool_result tool="${tc.name}" status="error">\nError: Recursive loop detected. This tool with these arguments was already called.\n</tool_result>`
          );
          continue;
        }

        // Generate stable, immutable callId for this tool invocation
        const callId = generateCallId();

        // Track budget
        state.budget.toolCallsRemaining--;
        state.budget.callHistory.push(callSignature);
        state.toolCallsThisTurn++;

        // Emit TOOL_CALL
        eventBus.emit({
          type: 'TOOL_CALL',
          tool: tc.name,
          callId,
          parameters: tc.parameters,
        });

        eventBus.emit({
          type: 'THINKING_STATUS',
          status: `Running ${tc.name}...`,
        });

        // Construct ToolExecutionContext with onProgress callback for real-time progress events
        const executionContext: ToolExecutionContext = {
          ...toolContext,
          turnId: state.turnId,
          callId,
          onProgress: (progress, message) => {
            eventBus.emit({
              type: 'TOOL_PROGRESS',
              callId,
              progress,
              message,
            });
          },
        };

        // Execute via ToolRouter (budget, schema, audit, enabled check)
        const result = await toolRouter.executeToolCall(
          {
            toolId: tc.name,
            toolName: tc.name,
            callId,
            arguments: tc.parameters as Record<string, any>,
          },
          executionContext
        );

        // Emit ARTIFACT_CREATE for artifact tool (SEC-001 fix — now through ToolRouter)
        if (tc.name === 'makkari_artifact' && result.success && result.result && typeof result.result === 'object') {
          const art = result.result as any;
          if (art.id && art.files) {
            eventBus.emit({
              type: 'ARTIFACT_CREATE',
              artifact: {
                artifactId: art.id,
                title: art.title,
                artifactType: art.artifact_type as any,
                version: 1,
                files: art.files.map((f: any) => ({
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
          }
        }

        // Emit TOOL_RESULT with same callId (SEC-008 fix)
        eventBus.emit({
          type: 'TOOL_RESULT',
          callId,
          result: {
            success: result.success,
            summary: result.formattedOutput || (result.error ?? 'Tool executed'),
            output: result.success
              ? (typeof result.result === 'object'
                  ? (result.result as Record<string, unknown>)
                  : { value: result.result })
              : undefined,
            error: result.success
              ? undefined
              : {
                  code: 'TOOL_EXECUTION_FAILED',
                  message: result.error || 'Unknown error',
                  retryable: false,
                },
          },
        });

        // Collect result content for next provider call
        toolResultParts.push(result.formattedOutput || `<tool_result tool="${tc.name}">\n${result.error || 'No output'}\n</tool_result>`);
      }

      if (state.status === 'budget_exceeded') break;

      // --- Append assistant message + tool results to conversation ---
      conversationMessages.push({ role: 'assistant', content: fullText });

      // Append tool results as a user message (text protocol)
      if (toolResultParts.length > 0) {
        conversationMessages.push({
          role: 'user',
          content: toolResultParts.join('\n\n'),
        });
      }

      // Continue loop — next iteration will call the provider again with tool results
    }

    // --- Terminal emission ---
    if (!eventBus.isTerminal()) {
      eventBus.emit({ type: 'DONE' });
    }
  }
}

export const queryEngine = new QueryEngine();
