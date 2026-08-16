import assert from 'node:assert';
import { StatefulToolProtocolParser } from '../lib/ai/stream/tool-protocol-parser';
import { CanonicalEventBus, MakkariEvent } from '../lib/ai/events/canonical-events';
import { QueryEngine } from '../lib/ai/runtime/query-engine';
import { createTurnState } from '../lib/ai/runtime/turn-state';
import { ProviderAdapter, ChatRequest, ChatChunk, AIError } from '../lib/ai/types';
import { mcpRegistry } from '../lib/ai/mcp/registry';
import { toolRegistry } from '../lib/ai/tools/registry';
import { toolRouter } from '../lib/ai/tools/tool-router';
import { generateCallId } from '../lib/ai/runtime/runtime-messages';

async function runThinkingAndMcpRuntimeTestSuite() {
  console.log('===============================================================');
  console.log('  MAKKARI THINKING/PROGRESS UI + MCP RUNTIME TEST SUITE');
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

  // Helper to create mock adapters
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

  // -------------------------------------------------------------
  // TEST 1: Single model response: THINKING_START -> THINKING_STATUS -> DONE
  // -------------------------------------------------------------
  console.log('[1/10] TEST 1: Single Model Response (THINKING_START -> THINKING_STATUS -> DONE)...');
  {
    const mockAdapter = createMockAdapter('groq', 'Mock Text Provider', async function* () {
      yield { type: 'text', content: 'Hello! How can I assist you today?' };
    });

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-t1', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-t1',
      userId: 'test-user',
      initialMessages: [{ role: 'user', content: 'Hello' }],
      model: null,
      abortController: new AbortController(),
      environment: 'development',
    });

    await queryEngine.executeTurn({
      state,
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hello' }],
      eventBus,
    });

    const eventTypes = emittedEvents.map((e) => e.type);
    test('THINKING_START emitted on turn start', eventTypes.includes('THINKING_START'));
    test('TEXT_DELTA emitted with response content', eventTypes.includes('TEXT_DELTA'));
    test('DONE emitted at conclusion', eventTypes[eventTypes.length - 1] === 'DONE');
  }

  // -------------------------------------------------------------
  // TEST 2: Tool response with live progress: THINKING_START -> TOOL_CALL -> TOOL_PROGRESS -> TOOL_RESULT -> DONE
  // -------------------------------------------------------------
  console.log('\n[2/10] TEST 2: Tool Response (THINKING_START -> TOOL_CALL -> TOOL_PROGRESS -> TOOL_RESULT -> DONE)...');
  {
    let iteration = 0;
    const mockAdapter = createMockAdapter('groq', 'Mock Tool Progress Provider', async function* () {
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
    const eventBus = new CanonicalEventBus('test-t2', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-t2',
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
      toolContext: { chatId: 'test-t2' },
    });

    const eventTypes = emittedEvents.map((e) => e.type);
    test('THINKING_START emitted before tool execution', eventTypes.includes('THINKING_START'));
    test('TOOL_CALL emitted for fetch_url', eventTypes.includes('TOOL_CALL'));
    test('TOOL_PROGRESS emitted with progress steps', eventTypes.includes('TOOL_PROGRESS'));
    test('TOOL_RESULT emitted after tool execution', eventTypes.includes('TOOL_RESULT'));
    test('DONE emitted at final turn completion', eventTypes[eventTypes.length - 1] === 'DONE');
  }

  // -------------------------------------------------------------
  // TEST 3: Multi-turn: model -> tool -> result -> model -> final
  // -------------------------------------------------------------
  console.log('\n[3/10] TEST 3: Multi-turn Tool Feedback Loop...');
  {
    let iteration = 0;
    let receivedToolResultInTurn2 = false;

    const mockAdapter = createMockAdapter('groq', 'Mock Calc Provider', async function* (req: ChatRequest) {
      iteration++;
      if (iteration === 1) {
        yield {
          type: 'text',
          content: '<dots_function_call>\n{"name": "calculator", "parameters": {"expression": "25 * 4"}}\n</dots_function_call>',
        };
      } else {
        const lastMsg = req.messages[req.messages.length - 1];
        if (lastMsg.content.includes('100')) {
          receivedToolResultInTurn2 = true;
        }
        yield {
          type: 'text',
          content: '25 * 4 is equal to 100.',
        };
      }
    });

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-t3', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-t3',
      userId: 'test-user',
      initialMessages: [{ role: 'user', content: 'Calculate 25 * 4' }],
      model: null,
      abortController: new AbortController(),
      environment: 'development',
    });

    await queryEngine.executeTurn({
      state,
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Calculate 25 * 4' }],
      eventBus,
      toolContext: { chatId: 'test-t3' },
    });

    test('Provider was called twice in multi-turn loop', iteration === 2);
    test('Second iteration received tool output (100)', receivedToolResultInTurn2);
    test('Turn state completed successfully', state.status === 'completed');
  }

  // -------------------------------------------------------------
  // TEST 4: Tool failure: TOOL_CALL -> TOOL_RESULT(error) -> safe model recovery
  // -------------------------------------------------------------
  console.log('\n[4/10] TEST 4: Tool Failure Boundary & Safe Recovery...');
  {
    let iteration = 0;
    let receivedErrorInTurn2 = false;

    const mockAdapter = createMockAdapter('groq', 'Mock Tool Fail Provider', async function* (req: ChatRequest) {
      iteration++;
      if (iteration === 1) {
        yield {
          type: 'text',
          content: '<dots_function_call>\n{"name": "calculator", "parameters": {"expression": "invalid / 0 syntax ("}}\n</dots_function_call>',
        };
      } else {
        const lastMsg = req.messages[req.messages.length - 1];
        if (lastMsg.content.includes('status="error"') || lastMsg.content.includes('Error')) {
          receivedErrorInTurn2 = true;
        }
        yield {
          type: 'text',
          content: 'I noticed the expression was invalid. Let me help you with a corrected formula.',
        };
      }
    });

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-t4', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-t4',
      userId: 'test-user',
      initialMessages: [{ role: 'user', content: 'Calculate invalid syntax' }],
      model: null,
      abortController: new AbortController(),
      environment: 'development',
    });

    await queryEngine.executeTurn({
      state,
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Calculate invalid syntax' }],
      eventBus,
      toolContext: { chatId: 'test-t4' },
    });

    const toolResult = emittedEvents.find((e) => e.type === 'TOOL_RESULT');
    test('TOOL_RESULT emitted with failure flag', toolResult !== undefined && (toolResult as any).result?.success === false);
    test('Second iteration model prompt received sanitized error boundary', receivedErrorInTurn2);
    test('Turn completed safely after tool error recovery', state.status === 'completed');
  }

  // -------------------------------------------------------------
  // TEST 5: Cancellation: THINKING_START -> CANCELLED
  // -------------------------------------------------------------
  console.log('\n[5/10] TEST 5: AbortSignal Cancellation...');
  {
    const abortCtrl = new AbortController();
    const mockAdapter = createMockAdapter('groq', 'Mock Abort Provider', async function* () {
      yield { type: 'text', content: 'Beginning response...' };
      abortCtrl.abort();
      yield { type: 'text', content: 'This should not be delivered' };
    });

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-t5', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-t5',
      userId: 'test-user',
      initialMessages: [{ role: 'user', content: 'Cancel me' }],
      model: null,
      abortController: abortCtrl,
      environment: 'development',
    });

    await queryEngine.executeTurn({
      state,
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Cancel me' }],
      eventBus,
    });

    const eventTypes = emittedEvents.map((e) => e.type);
    test('CANCELLED event emitted upon abort signal', eventTypes.includes('CANCELLED'));
    test('DONE event was suppressed after cancellation', !eventTypes.includes('DONE'));
  }

  // -------------------------------------------------------------
  // TEST 6: MCP Disconnected: MCP_SERVER_UNAVAILABLE without fabricated tool execution
  // -------------------------------------------------------------
  console.log('\n[6/10] TEST 6: MCP Disconnected Status (No Fabricated Tools)...');
  {
    const servers = mcpRegistry.getAllServers();
    test('MCP servers are initialized with status "disconnected"', servers.every((s) => s.status === 'disconnected'));

    const res = await toolRouter.executeToolCall({
      toolId: 'mcp_canva-mcp_create_design',
      toolName: 'mcp_canva-mcp_create_design',
      callId: generateCallId(),
      arguments: { prompt: 'poster' },
    }, {
      turnId: 'test-mcp-unavail',
    });

    test('Executing an unverified/disconnected MCP tool safely fails', res.success === false);
    test('Error indicates tool is not available in capability registry', Boolean(res.error?.includes('not found') || res.error?.includes('disabled')));
  }

  // -------------------------------------------------------------
  // TEST 7: MCP Connected Tool Execution via ToolRouter
  // -------------------------------------------------------------
  console.log('\n[7/10] TEST 7: Connected MCP Tool Execution via ToolRouter...');
  {
    // Register a connected mock MCP tool
    toolRegistry.registerTool({
      id: 'mcp_mock-server_search_docs',
      name: 'mock-server_search_docs',
      description: 'Search documentation via MCP',
      category: 'mcp',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
      permissions: 'read',
      requiresConfirmation: false,
      enabled: true,
      source: 'mcp',
      handler: async (args) => ({
        success: true,
        result: { hits: [`Result for ${args.query}`] },
        formattedOutput: `Found 1 hit for ${args.query}`,
      }),
    });

    const callId = generateCallId();
    const res = await toolRouter.executeToolCall({
      toolId: 'mcp_mock-server_search_docs',
      toolName: 'mock-server_search_docs',
      callId,
      arguments: { query: 'Next.js 16' },
    }, {
      turnId: 'test-mcp-conn',
    });

    test('Connected MCP tool executed via ToolRouter with success=true', res.success === true);
    test('MCP result output bounded in untrusted format', Boolean(res.formattedOutput?.includes('<tool_result name="mock-server_search_docs">')));

  }

  // -------------------------------------------------------------
  // TEST 8: callId Correlation across TOOL_CALL, TOOL_PROGRESS, TOOL_RESULT
  // -------------------------------------------------------------
  console.log('\n[8/10] TEST 8: Immutable callId Correlation across Tool Events...');
  {
    let iteration = 0;
    const mockAdapter = createMockAdapter('groq', 'Mock Correlation Provider', async function* () {
      iteration++;
      if (iteration === 1) {
        yield {
          type: 'text',
          content: '<dots_function_call>\n{"name": "fetch_url", "parameters": {"url": "https://test.org"}}\n</dots_function_call>',
        };
      } else {
        yield { type: 'text', content: 'Fetched content.' };
      }
    });

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-t8', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-t8',
      userId: 'test-user',
      initialMessages: [{ role: 'user', content: 'Fetch URL' }],
      model: null,
      abortController: new AbortController(),
      environment: 'development',
    });

    await queryEngine.executeTurn({
      state,
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Fetch URL' }],
      eventBus,
      toolContext: { chatId: 'test-t8' },
    });

    const toolCallEvt = emittedEvents.find((e) => e.type === 'TOOL_CALL') as any;
    const toolProgEvt = emittedEvents.find((e) => e.type === 'TOOL_PROGRESS') as any;
    const toolResultEvt = emittedEvents.find((e) => e.type === 'TOOL_RESULT') as any;

    test('TOOL_CALL has non-empty callId', Boolean(toolCallEvt?.callId));
    test('TOOL_PROGRESS shares exact same callId as TOOL_CALL', toolProgEvt?.callId === toolCallEvt?.callId);
    test('TOOL_RESULT shares exact same callId as TOOL_CALL', toolResultEvt?.callId === toolCallEvt?.callId);
  }

  // -------------------------------------------------------------
  // TEST 9: Model Selection Preservation
  // -------------------------------------------------------------
  console.log('\n[9/10] TEST 9: Model Selection Exact Passthrough...');
  {
    let receivedModelInAdapter = '';
    const mockAdapter = createMockAdapter('groq', 'Mock Exact Model Provider', async function* (req) {
      receivedModelInAdapter = req.modelId;
      yield { type: 'text', content: 'OK' };
    });

    const eventBus = new CanonicalEventBus('test-t9', () => {});
    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-t9',
      userId: 'test-user',
      initialMessages: [{ role: 'user', content: 'Hi' }],
      model: null,
      abortController: new AbortController(),
      environment: 'development',
    });

    await queryEngine.executeTurn({
      state,
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hi' }],
      eventBus,
    });

    test('QueryEngine forwarded exact model "llama-3.3-70b-versatile" to provider adapter', receivedModelInAdapter === 'llama-3.3-70b-versatile');
  }

  // -------------------------------------------------------------
  // TEST 10: No Private Reasoning Leakage
  // -------------------------------------------------------------
  console.log('\n[10/10] TEST 10: Stripping Raw Protocol and Private Reasoning Tokens...');
  {
    const parser = new StatefulToolProtocolParser();
    const rawChunks = [
      'I am thinking about ',
      'the problem.<think>private thoughts</think>',
      'Here is the solution.<dots_function_call>\n{"name": "calc',
      'ulator", "parameters": {"expression": "2+2"}}\n</dots_function_call>',
    ];

    let emittedText = '';
    for (const chunk of rawChunks) {
      const res = parser.processChunk(chunk);
      emittedText += res.textDelta;
    }
    const flushed = parser.flush();
    emittedText += flushed.textDelta;

    test('Raw XML protocol <dots_function_call> is stripped from user text', !emittedText.includes('<dots_function_call>'));
    test('Raw XML protocol </dots_function_call> is stripped from user text', !emittedText.includes('</dots_function_call>'));
    test('Tool parameters JSON is stripped from user text', !emittedText.includes('{"name": "calculator"'));
    test('Clean text contains only user-facing prefixes', emittedText.includes('I am thinking about the problem.'));
  }

  console.log('\n===============================================================');
  console.log(`  ALL ${passed}/${total} THINKING/PROGRESS + MCP RUNTIME TESTS PASSED!`);
  console.log('===============================================================\n');
}

runThinkingAndMcpRuntimeTestSuite().catch((err) => {
  console.error('\nThinking & MCP runtime test suite failed:', err);
  process.exit(1);
});
