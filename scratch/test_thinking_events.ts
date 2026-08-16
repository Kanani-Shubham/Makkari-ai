import assert from 'node:assert';
import { StatefulToolProtocolParser } from '../lib/ai/stream/tool-protocol-parser';
import { CanonicalEventBus, MakkariEvent } from '../lib/ai/events/canonical-events';
import { QueryEngine } from '../lib/ai/runtime/query-engine';
import { createTurnState } from '../lib/ai/runtime/turn-state';
import { ProviderAdapter, ChatRequest, ChatChunk, AIError } from '../lib/ai/types';

async function runThinkingEventsTestSuite() {
  console.log('===============================================================');
  console.log('  MAKKARI THINKING UI & STATUS EVENTS TEST SUITE');
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

  // 1. Normal Turn Thinking Status Flow
  console.log('[1/3] Testing Normal Response Thinking Status Events Flow...');
  {
    const mockAdapter = createMockAdapter('groq', 'Mock Generation Provider', async function* () {
      yield { type: 'text', content: 'Hello, how can I help you today?' };
    });

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-thinking-normal', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-thinking-normal',
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
    test('THINKING_START emitted on turn start', eventTypes[0] === 'THINKING_START');
    test('TEXT_DELTA emitted with content', eventTypes.includes('TEXT_DELTA'));
    test('DONE emitted at conclusion', eventTypes[eventTypes.length - 1] === 'DONE');
    test('No undefined or null values in emitted events', emittedEvents.every((e) => e !== null && e !== undefined));

  }

  // 2. Multi-turn Tool Call Thinking Flow with Safe Progress Status
  console.log('\n[2/3] Testing Tool Call Thinking Flow with Safe Progress Status...');
  {
    let iteration = 0;
    const mockAdapter = createMockAdapter('groq', 'Mock Tool Provider', async function* (req: ChatRequest) {
      iteration++;
      if (iteration === 1) {
        yield {
          type: 'text',
          content: '<dots_function_call>\n{"name": "calculator", "parameters": {"expression": "100 + 20"}}\n</dots_function_call>',
        };
      } else {
        yield {
          type: 'text',
          content: 'The total is 120.',
        };
      }
    });

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-thinking-tools', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['groq', mockAdapter]]));
    const state = createTurnState({
      conversationId: 'test-thinking-tools',
      userId: 'test-user',
      initialMessages: [{ role: 'user', content: 'Calculate 100 + 20' }],
      model: null,
      abortController: new AbortController(),
      environment: 'development',
    });

    await queryEngine.executeTurn({
      state,
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Calculate 100 + 20' }],
      eventBus,
      toolContext: { chatId: 'test-thinking-tools' },
    });

    const thinkingStatuses = emittedEvents
      .filter((e) => e.type === 'THINKING_STATUS')
      .map((e: any) => e.status);

    test('THINKING_STATUS contains running tool step "Running calculator..."', thinkingStatuses.some((s) => s.includes('Running calculator')));
    test('THINKING_STATUS contains tool result processing step', thinkingStatuses.some((s) => s.includes('processing tool results')));
    test('TOOL_CALL event precedes TOOL_RESULT event', (() => {
      const callIdx = emittedEvents.findIndex((e) => e.type === 'TOOL_CALL');
      const resultIdx = emittedEvents.findIndex((e) => e.type === 'TOOL_RESULT');
      return callIdx !== -1 && resultIdx !== -1 && callIdx < resultIdx;
    })());

  }

  // 3. Stateful Protocol Parser XML & Protocol Tokens Boundary Invariant
  console.log('\n[3/3] Testing StatefulToolProtocolParser Strips Raw Protocol Tokens...');
  {
    const parser = new StatefulToolProtocolParser();
    const chunk1 = 'Here is the result: <dots_function_call>\n{"name": "fetch_';
    const chunk2 = 'url", "parameters": {"url": "https://test.com"}}\n</dots_function_call>';

    const res1 = parser.processChunk(chunk1);
    const res2 = parser.processChunk(chunk2);
    const flushed = parser.flush();

    const fullEmittedText = res1.textDelta + res2.textDelta + flushed.textDelta;
    const completedCalls = [...res1.completedToolCalls, ...res2.completedToolCalls, ...flushed.completedToolCalls];

    test('Raw XML protocol <dots_function_call> is completely stripped from emitted text', !fullEmittedText.includes('<dots_function_call>'));
    test('Raw XML protocol </dots_function_call> is completely stripped from emitted text', !fullEmittedText.includes('</dots_function_call>'));
    test('Emitted text contains only user-facing prefix "Here is the result: "', fullEmittedText === 'Here is the result: ');
    test('Tool call parsed with exact name fetch_url', completedCalls.length === 1 && completedCalls[0].name === 'fetch_url');
    test('Tool call parsed with exact url parameter https://test.com', completedCalls[0].parameters?.url === 'https://test.com');
  }

  console.log('\n===============================================================');
  console.log(`  ALL ${passed}/${total} THINKING & STATUS EVENT TESTS PASSED!`);
  console.log('===============================================================\n');
}

runThinkingEventsTestSuite().catch((err) => {
  console.error('\nThinking events test suite failed:', err);
  process.exit(1);
});
