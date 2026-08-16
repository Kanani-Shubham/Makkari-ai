import assert from 'node:assert';
import { resolveTurnCapabilities } from '../lib/ai/capability/pipeline';
import { CanonicalEventBus, MakkariEvent } from '../lib/ai/events/canonical-events';
import { QueryEngine } from '../lib/ai/runtime/query-engine';
import { createTurnState } from '../lib/ai/runtime/turn-state';
import { ProviderAdapter, ChatRequest, ChatChunk, AIError } from '../lib/ai/types';

async function runToolCapabilitiesTestSuite() {
  console.log('===============================================================');
  console.log('  MAKKARI TOOL CAPABILITY & EXECUTION TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function test(name: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] Test ${total}: ${name}`);
    } else {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      if (details) console.error(`         Detail: ${details}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  // Helper for mock adapters
  const createMockAdapter = (
    providerKey: 'groq' | 'gemini',
    name: string,
    streamFn: (req: ChatRequest) => AsyncIterable<ChatChunk>
  ): ProviderAdapter => ({
    providerKey,
    name,
    async discoverModels() { return []; },
    async healthCheck() { return { status: 'connected' }; },
    streamChat: streamFn,
    supports: () => true,
    normalizeError: (err: any): AIError => ({
      provider: providerKey,
      status: 500,
      message: String(err),
      userMessage: 'An error occurred',
      retryable: false,
    }),
  });

  // 1. Tool Capability Gating: Enabled for Tool-Capable Models
  console.log('[1/4] Testing Tool Capability Gating for Capable Models...');
  {
    const caps = await resolveTurnCapabilities({
      userPrompt: 'Please calculate 50 + 50',
      providerId: 'gemini',
      modelId: 'gemini-2.5-flash',
    });

    test('Gemini 2.5 Flash receives tool calling protocol manifest', caps.systemPromptAdditions.includes('<tool_calling_protocol>'));
    test('Gemini 2.5 Flash manifest contains calculator tool schema', caps.systemPromptAdditions.includes('calculator'));
    test('Active tools list contains builtin tools', caps.activeTools.length > 0);
  }

  // 2. Tool Capability Gating: Disabled for Models with tools: false
  console.log('\n[2/4] Testing Tool Capability Suppression for Models with tools=false...');
  {
    const caps = await resolveTurnCapabilities({
      userPrompt: 'Please calculate 50 + 50',
      providerId: 'ollama',
      modelId: 'non-tool-model',
      modelCapabilities: {
        nativeTools: false,
        textToolProtocol: false,
      },
    });

    test('Non-tool model does NOT receive <tool_calling_protocol>', !caps.systemPromptAdditions.includes('<tool_calling_protocol>'));
    test('Non-tool model does NOT receive tool schemas', !caps.systemPromptAdditions.includes('<dots_function_call>'));
    test('Active tools list is empty for non-tool model', caps.activeTools.length === 0);
  }

  // 3. Calculator Multi-Turn Execution
  console.log('\n[3/4] Testing Calculator Multi-Turn Tool Execution...');
  {
    let iteration = 0;
    const mockAdapter = createMockAdapter('groq', 'Mock Calc Provider', async function* (req: ChatRequest) {
      iteration++;
      if (iteration === 1) {
        yield {
          type: 'text',
          content: '<dots_function_call>\n{"name": "calculator", "parameters": {"expression": "42 * 2"}}\n</dots_function_call>',
        };
      } else {
        const lastMsg = req.messages[req.messages.length - 1];
        assert(lastMsg.content.includes('84'), 'Iteration 2 did not receive calculator output 84');
        yield {
          type: 'text',
          content: 'The answer is 84.',
        };
      }
    });

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-calc-e2e', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-calc-e2e',
      userId: 'test-user',
      initialMessages: [{ role: 'user', content: 'Calculate 42 * 2' }],
      model: null,
      abortController: new AbortController(),
      environment: 'development',
    });

    await queryEngine.executeTurn({
      state,
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Calculate 42 * 2' }],
      eventBus,
      toolContext: { chatId: 'test-calc-e2e' },
    });

    const toolCall = emittedEvents.find((e) => e.type === 'TOOL_CALL');
    const toolResult = emittedEvents.find((e) => e.type === 'TOOL_RESULT');
    const textDelta = emittedEvents.filter((e) => e.type === 'TEXT_DELTA').map((e: any) => e.delta).join('');

    test('Calculator TOOL_CALL event emitted', toolCall !== undefined && (toolCall as any).tool === 'calculator');
    test('Calculator TOOL_RESULT event emitted with output 84', toolResult !== undefined && ((toolResult as any).result?.output?.value === 84 || (toolResult as any).result?.output === 84));
    test('Assistant text response received with 84', textDelta.includes('84'));
  }

  // 4. Fetch URL Multi-Turn Execution
  console.log('\n[4/4] Testing fetch_url Multi-Turn Tool Execution...');
  {
    let iteration = 0;
    const mockAdapter = createMockAdapter('groq', 'Mock Fetch Provider', async function* () {
      iteration++;
      if (iteration === 1) {
        yield {
          type: 'text',
          content: '<dots_function_call>\n{"name": "fetch_url", "parameters": {"url": "https://example.com"}}\n</dots_function_call>',
        };
      } else {
        yield {
          type: 'text',
          content: 'Here is the summary of Example Domain.',
        };
      }
    });

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-fetch-e2e', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-fetch-e2e',
      userId: 'test-user',
      initialMessages: [{ role: 'user', content: 'Fetch https://example.com' }],
      model: null,
      abortController: new AbortController(),
      environment: 'development',
    });

    await queryEngine.executeTurn({
      state,
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Fetch https://example.com' }],
      eventBus,
      toolContext: { chatId: 'test-fetch-e2e' },
    });

    const toolCall = emittedEvents.find((e) => e.type === 'TOOL_CALL');
    const toolProgress = emittedEvents.filter((e) => e.type === 'TOOL_PROGRESS');
    const toolResult = emittedEvents.find((e) => e.type === 'TOOL_RESULT');

    test('fetch_url TOOL_CALL event emitted', toolCall !== undefined && (toolCall as any).tool === 'fetch_url');
    test('fetch_url emitted real-time TOOL_PROGRESS events', toolProgress.length > 0);
    test('fetch_url completed with TOOL_RESULT success', toolResult !== undefined && (toolResult as any).result?.success === true);
  }

  console.log('\n===============================================================');
  console.log(`  ALL ${passed}/${total} TOOL CAPABILITY & EXECUTION TESTS PASSED!`);
  console.log('===============================================================\n');
}

runToolCapabilitiesTestSuite().catch((err) => {
  console.error('\nTool capability test suite failed:', err);
  process.exit(1);
});
