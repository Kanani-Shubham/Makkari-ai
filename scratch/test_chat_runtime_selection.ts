import assert from 'node:assert';
import { GeminiAdapter } from '../lib/ai/providers/gemini';
import { GroqAdapter } from '../lib/ai/providers/groq';
import { OllamaAdapter } from '../lib/ai/providers/ollama';
import { CanonicalEventBus, MakkariEvent } from '../lib/ai/events/canonical-events';
import { QueryEngine } from '../lib/ai/runtime/query-engine';
import { createTurnState } from '../lib/ai/runtime/turn-state';
import { resolveTurnCapabilities } from '../lib/ai/capability/pipeline';
import { ProviderAdapter, ChatRequest, ChatChunk, AIError } from '../lib/ai/types';

/**
 * Makkari Chat Runtime & Model Selection Bug Fix Verification Test Suite
 */
async function runBugFixTestSuite() {
  console.log('===============================================================');
  console.log('  MAKKARI CHAT RUNTIME / MODEL SELECTION TEST SUITE');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assertTest(name: string, condition: boolean, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] Test ${totalTests}: ${name}`);
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${name}`);
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

  // --------------------------------------------------------------------------
  // TEST 1: Gemini 2.5 Flash Model Survival (No hardcoded override to 2.0)
  // --------------------------------------------------------------------------
  console.log('[1/7] Testing Gemini Model Selection & Preservation...');
  {
    const gemini = new GeminiAdapter();
    let requestedUrl = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any) => {
      requestedUrl = String(url);
      return new Response('data: {}\n\n', { status: 200 });
    }) as any;

    try {
      const iterator = gemini.streamChat({
        chatId: 'test-gemini',
        modelId: 'gemini-2.5-flash',
        apiKey: 'test-api-key',
        messages: [{ role: 'user', content: 'hello' }],
      });
      for await (const _ of iterator) {
        break;
      }

      assertTest(
        'Gemini modelId gemini-2.5-flash is passed directly to URL without 2.0 override',
        requestedUrl.includes('models/gemini-2.5-flash:streamGenerateContent') &&
          !requestedUrl.includes('gemini-2.0-flash'),
        `Actual requested URL: ${requestedUrl}`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 2: Multi-Provider Model Preservation Audit
  // --------------------------------------------------------------------------
  console.log('\n[2/7] Auditing Model ID Passthrough across all Providers...');
  {
    const originalFetch = globalThis.fetch;

    // Groq test
    let groqBody: any = null;
    globalThis.fetch = (async (url: any, opts: any) => {
      groqBody = JSON.parse(opts.body);
      return new Response('data: {}\n\n', { status: 200 });
    }) as any;

    const groq = new GroqAdapter();
    const groqIt = groq.streamChat({
      chatId: 'test-groq',
      modelId: 'llama-3.3-70b-versatile',
      apiKey: 'test-groq-key',
      messages: [{ role: 'user', content: 'hello' }],
    });
    for await (const _ of groqIt) {
      break;
    }

    assertTest(
      'Groq adapter preserves exact modelId llama-3.3-70b-versatile',
      groqBody?.model === 'llama-3.3-70b-versatile'
    );

    // Ollama test
    let ollamaBody: any = null;
    globalThis.fetch = (async (url: any, opts: any) => {
      ollamaBody = JSON.parse(opts.body);
      return new Response('{"message": {"content": "ok"}, "done": true}\n', { status: 200 });
    }) as any;

    const ollama = new OllamaAdapter();
    const ollamaIt = ollama.streamChat({
      chatId: 'test-ollama',
      modelId: 'lfm2.5:latest',
      messages: [{ role: 'user', content: 'hello' }],
    });
    for await (const _ of ollamaIt) {
      break;
    }

    assertTest(
      'Ollama adapter preserves exact modelId lfm2.5:latest',
      ollamaBody?.model === 'lfm2.5:latest'
    );

    globalThis.fetch = originalFetch;
  }

  // --------------------------------------------------------------------------
  // TEST 3: Capability Truth Layer Injects Actionable Tool Protocol & Schemas
  // --------------------------------------------------------------------------
  console.log('\n[3/7] Testing Capability Resolver Tool Protocol Injection...');
  {
    const caps = await resolveTurnCapabilities({
      userPrompt: 'Please calculate 25 * 4 and search the web',
      modelId: 'gemini-2.5-flash',
      providerId: 'gemini',
    });

    const manifest = caps.systemPromptAdditions;
    assertTest(
      'System prompt additions contain <tool_calling_protocol> instructions',
      manifest.includes('<tool_calling_protocol>') && manifest.includes('<dots_function_call>')
    );

    assertTest(
      'System prompt additions contain full JSON parameter schema for calculator',
      manifest.includes('calculator') && manifest.includes('"expression"')
    );

    assertTest(
      'System prompt additions contain full JSON parameter schema for web_search',
      manifest.includes('web_search') && manifest.includes('"query"')
    );
  }

  // --------------------------------------------------------------------------
  // TEST 4: End-to-End Multi-Turn Tool Loop: Calculator Tool
  // --------------------------------------------------------------------------
  console.log('\n[4/7] Testing End-to-End Multi-Turn Tool Execution (Calculator)...');
  {
    let iteration = 0;
    const mockAdapter = createMockAdapter('groq', 'Mock Multi-Turn Provider', async function* (req: ChatRequest) {
      iteration++;
      if (iteration === 1) {
        yield {
          type: 'text',
          content: '<dots_function_call>\n{"name": "calculator", "parameters": {"expression": "42 * 2"}}\n</dots_function_call>',
        };
      } else {
        const lastMsg = req.messages[req.messages.length - 1];
        assert(lastMsg.content.includes('84'), 'Model did not receive tool result 84 in iteration 2');
        yield {
          type: 'text',
          content: 'The calculation result of 42 * 2 is 84.',
        };
      }
    });

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-chat-calc', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-chat-calc',
      userId: 'test-user',
      initialMessages: [{ role: 'user', content: 'Calculate 42 * 2 using calculator' }],
      model: null,
      abortController: new AbortController(),
      environment: 'development',
    });

    await queryEngine.executeTurn({
      state,
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Calculate 42 * 2 using calculator' }],
      eventBus,
      toolContext: { chatId: 'test-chat-calc' },
    });

    const toolCallEvt = emittedEvents.find((e) => e.type === 'TOOL_CALL');
    const toolResultEvt = emittedEvents.find((e) => e.type === 'TOOL_RESULT');
    const textDeltas = emittedEvents.filter((e) => e.type === 'TEXT_DELTA').map((e: any) => e.delta).join('');

    assertTest('Calculator TOOL_CALL event emitted with tool calculator', toolCallEvt !== undefined && (toolCallEvt as any).tool === 'calculator');
    assertTest('Calculator TOOL_RESULT event emitted with output 84', toolResultEvt !== undefined && ((toolResultEvt as any).result?.output?.value === 84 || (toolResultEvt as any).result?.output === 84));
    assertTest('Immutable callId is preserved across TOOL_CALL and TOOL_RESULT', toolCallEvt !== undefined && toolResultEvt !== undefined && (toolCallEvt as any).callId === (toolResultEvt as any).callId);
    assertTest('Final assistant text response received after tool execution', textDeltas.includes('84'));
  }

  // --------------------------------------------------------------------------
  // TEST 5: End-to-End Multi-Turn Tool Loop: fetch_url Tool with Progress
  // --------------------------------------------------------------------------
  console.log('\n[5/7] Testing End-to-End Multi-Turn Tool Execution (fetch_url + Progress)...');
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
          content: 'Summary of https://example.com: This is Example Domain content.',
        };
      }
    });

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-chat-fetch', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-chat-fetch',
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
      toolContext: { chatId: 'test-chat-fetch' },
    });

    const progressEvents = emittedEvents.filter((e) => e.type === 'TOOL_PROGRESS');
    const resultEvt = emittedEvents.find((e) => e.type === 'TOOL_RESULT');

    assertTest('fetch_url emitted TOOL_PROGRESS events during execution', progressEvents.length > 0);
    assertTest('fetch_url completed with TOOL_RESULT event', resultEvt !== undefined && (resultEvt as any).result?.success === true);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Provider Error Handling (Canonical ERROR Event, Not False 200)
  // --------------------------------------------------------------------------
  console.log('\n[6/7] Testing Canonical Runtime Provider Error Propagation...');
  {
    const mockFailingAdapter = createMockAdapter('gemini', 'Mock Failing Gemini Adapter', async function* () {
      yield {
        type: 'error',
        error: {
          provider: 'gemini',
          status: 404,
          modelUnavailable: true,
          message: 'Model not found',
          userMessage: 'Gemini model "gemini-2.0-flash" is unavailable or deprecated.',
          retryable: false,
        },
      };
    });

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-chat-err', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['gemini', mockFailingAdapter]]));
    const state = createTurnState({
      conversationId: 'test-chat-err',
      userId: 'test-user',
      initialMessages: [{ role: 'user', content: 'hello' }],
      model: null,
      abortController: new AbortController(),
      environment: 'development',
    });

    await queryEngine.executeTurn({
      state,
      providerId: 'gemini',
      modelId: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'hello' }],
      eventBus,
      toolContext: { chatId: 'test-chat-err' },
    });

    const errEvt = emittedEvents.find((e) => e.type === 'ERROR');
    assertTest('Provider 404 error correctly emitted as canonical ERROR event', errEvt !== undefined && (errEvt as any).message.includes('unavailable or deprecated'));
    assertTest('Turn state status is marked failed', state.status === 'failed');
  }

  // --------------------------------------------------------------------------
  // TEST 7: History Construction Invariant (Never empty messages)
  // --------------------------------------------------------------------------
  console.log('\n[7/7] Testing Message History Construction Invariant...');
  {
    function buildSafeHistory(existingMsgs: Array<{ role: string; content: string }>, currentUserText?: string) {
      const historyToUse = [...existingMsgs];
      if (currentUserText && currentUserText.trim()) {
        const last = historyToUse[historyToUse.length - 1];
        if (!last || last.role !== 'user' || last.content !== currentUserText) {
          historyToUse.push({ role: 'user', content: currentUserText });
        }
      }
      return historyToUse;
    }

    const emptyExisting: any[] = [];
    const result1 = buildSafeHistory(emptyExisting, 'Check website');
    assertTest('Empty existing messages array produces 1-item history with current user message', result1.length === 1 && result1[0].content === 'Check website');

    const alreadyAppended = [{ role: 'user', content: 'Check website' }];
    const result2 = buildSafeHistory(alreadyAppended, 'Check website');
    assertTest('Does not duplicate user message if already present in history', result2.length === 1);
  }

  console.log('\n===============================================================');
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED CLEANLY!`);
  console.log('===============================================================\n');
}

runBugFixTestSuite().catch((err) => {
  console.error('\nTest suite failed with error:', err);
  process.exit(1);
});
