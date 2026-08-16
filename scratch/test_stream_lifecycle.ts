import { GeminiAdapter } from '../lib/ai/providers/gemini';
import { OpenAIAdapter } from '../lib/ai/providers/openai';
import { getProviderModels, getClosestFallbackModel } from '../lib/ai/discovery-service';
import { MakkariModel, ChatMessage } from '../lib/ai/types';
import { getRelevantMemoryContext, formatMemoryContextPrompt } from '../lib/ai/memory/memory-service';

class MockResponse {
  public ok: boolean;
  public status: number;
  private bodyText: string;

  constructor(status: number, bodyText: string) {
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this.bodyText = bodyText;
  }

  async text() {
    return this.bodyText;
  }

  async json() {
    return JSON.parse(this.bodyText);
  }
}

class MockSupabaseDB {
  public chats: any[] = [];
  public messages: any[] = [];
  public postChatJobs: any[] = [];
  public userMemories: any[] = [
    {
      id: 'mem-1',
      user_id: 'test-user',
      type: 'technical_preference',
      content: 'User prefers Next.js and TypeScript.',
      source: 'user',
      confidence: 1.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    },
  ];
  public settings = {
    id: 'set-1',
    user_id: 'test-user',
    personalization_enabled: true,
    memory_enabled: true,
  };

  from(table: string) {
    const self = this;
    if (table === 'chats') {
      return {
        insert: (row: any) => {
          self.chats.push(row);
          return { select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) };
        },
        select: () => ({
          eq: (col: string, val: any) => ({
            single: () => Promise.resolve({ data: self.chats.find((c) => c[col] === val) || null, error: null }),
          }),
        }),
      };
    }

    if (table === 'messages') {
      return {
        insert: (row: any) => {
          const full = { id: `msg-${Date.now()}`, ...row };
          self.messages.push(full);
          return { select: () => ({ single: () => Promise.resolve({ data: full, error: null }) }) };
        },
        select: () => ({
          eq: (col: string, val: any) => Promise.resolve({ data: self.messages.filter((m) => m[col] === val), error: null }),
        }),
      };
    }

    if (table === 'post_chat_jobs') {
      return {
        insert: (row: any) => {
          const full = { id: `job-${Date.now()}`, ...row };
          self.postChatJobs.push(full);
          return Promise.resolve({ data: full, error: null });
        },
        select: () => ({
          eq: (col: string, val: any) => ({
            in: (col2: string, vals: any[]) => ({
              maybeSingle: () => Promise.resolve({ data: self.postChatJobs.find((j) => j[col] === val && vals.includes(j[col2])) || null, error: null }),
            }),
          }),
        }),
      };
    }

    const createQueryBuilder = (items: any[]) => {
      let filtered = [...items];
      const qb: any = {
        select: () => qb,
        eq: (col: string, val: any) => {
          filtered = filtered.filter((i) => i[col] === val);
          return qb;
        },
        in: (col: string, vals: any[]) => {
          filtered = filtered.filter((i) => vals.includes(i[col]));
          return qb;
        },
        update: () => qb,
        order: () => qb,
        limit: (n: number) => {
          filtered = filtered.slice(0, n);
          return qb;
        },
        single: () => Promise.resolve({ data: filtered[0] || null, error: null }),
        maybeSingle: () => Promise.resolve({ data: filtered[0] || null, error: null }),
        then: (resolve: (res: { data: any; error: any }) => void) => {
          resolve({ data: filtered, error: null });
        },
      };
      return qb;
    };

    if (table === 'conversation_summaries') {
      return createQueryBuilder([]);
    }

    if (table === 'user_memories') {
      return createQueryBuilder(self.userMemories);
    }

    if (table === 'user_memory_settings') {
      return createQueryBuilder([self.settings]);
    }

    return {} as any;
  }
}

/**
 * Simulates the hardened /api/chat/stream pre-flight and response lifecycle
 */
async function simulateStreamRoute(
  requestBody: {
    chatId: string;
    providerId: string;
    modelId: string;
    messages: ChatMessage[];
    apiKey?: string;
  },
  db: MockSupabaseDB,
  mockFetchFn: (url: string, opts?: any) => Promise<any>
) {
  const { chatId, providerId, modelId, messages, apiKey } = requestBody;

  // 1. Memory Context Injection
  const memoryContext = await getRelevantMemoryContext(db as any, 'test-user', messages[messages.length - 1]?.content || '');
  const memoryPromptBlock = formatMemoryContextPrompt(memoryContext);

  // 2. Select Adapter
  let adapter: any;
  if (providerId === 'gemini') adapter = new GeminiAdapter();
  else adapter = new OpenAIAdapter();

  // Override global fetch for adapter stream
  const originalFetch = global.fetch;
  global.fetch = mockFetchFn as any;

  try {
    const chunkIterable = adapter.streamChat({
      chatId,
      modelId,
      messages,
      systemPrompt: memoryPromptBlock,
      apiKey: apiKey || 'test-key',
    });

    const iterator = chunkIterable[Symbol.asyncIterator]();
    let firstResult: IteratorResult<any>;
    try {
      firstResult = await iterator.next();
    } catch (err: any) {
      const normalized = adapter.normalizeError(err);
      const is404 = normalized.status === 404 || normalized.modelUnavailable;
      const status = is404 ? 404 : 502;
      const code = is404 ? 'MODEL_NOT_AVAILABLE' : 'PROVIDER_ERROR';
      return {
        status,
        ok: false,
        json: {
          error: 'PROVIDER_ERROR',
          provider: providerId,
          code,
          message: normalized.userMessage || normalized.message,
        },
        memoryInjected: memoryPromptBlock.includes('<user_context>'),
      };
    }

    if (!firstResult || firstResult.done) {
      return {
        status: 502,
        ok: false,
        json: { error: 'PROVIDER_ERROR', code: 'EMPTY_RESPONSE', message: 'Empty response stream' },
        memoryInjected: memoryPromptBlock.includes('<user_context>'),
      };
    }

    const firstChunk = firstResult.value;
    if (firstChunk.type === 'error') {
      const err = firstChunk.error;
      const is404 = err.status === 404 || err.modelUnavailable || err.code === 'MODEL_NOT_AVAILABLE' || err.code === 'MODEL_NOT_FOUND';
      const status = is404 ? 404 : err.status || 502;
      const code = is404 ? 'MODEL_NOT_AVAILABLE' : err.code || 'PROVIDER_ERROR';

      return {
        status,
        ok: false,
        json: {
          error: 'PROVIDER_ERROR',
          provider: providerId,
          code,
          message: err.userMessage || err.message,
        },
        memoryInjected: memoryPromptBlock.includes('<user_context>'),
      };
    }

    // Streaming succeeded!
    let accumulatedContent = firstChunk.type === 'text' ? firstChunk.content : '';
    while (true) {
      const next = await iterator.next();
      if (next.done) break;
      if (next.value.type === 'text') accumulatedContent += next.value.content;
    }

    // Persist completed assistant message and post_chat_job
    if (accumulatedContent.trim().length > 0) {
      await db.from('messages').insert({
        chat_id: chatId,
        role: 'assistant',
        content: accumulatedContent,
      });

      await db.from('post_chat_jobs').insert({
        chat_id: chatId,
        user_id: 'test-user',
        status: 'pending',
      });
    }

    return {
      status: 200,
      ok: true,
      content: accumulatedContent,
      memoryInjected: memoryPromptBlock.includes('<user_context>'),
    };
  } finally {
    global.fetch = originalFetch;
  }
}

async function runStreamLifecycleTestSuite() {
  console.log('===============================================================');
  console.log('MAKKARI AI: STREAM LIFECYCLE & GEMINI DISCOVERY VERIFICATION');
  console.log('===============================================================\n');

  let passed = 0;
  const db = new MockSupabaseDB();
  const testChatId = 'chat-lifecycle-101';

  // Seed chat
  db.chats.push({ id: testChatId, user_id: 'test-user', title: 'Test Thread' });
  db.messages.push({ chat_id: testChatId, role: 'user', content: 'Hello, what model are you?' });

  // -------------------------------------------------------------
  // TEST 1 & 2: Gemini 404 Model Unavailable -> Returns 404 JSON, NOT 200
  // -------------------------------------------------------------
  console.log('--- TEST 1: Gemini 404 Model Unavailable Propagation ---');
  const mock404Fetch = async () =>
    new MockResponse(404, 'This model models/gemini-2.5-flash is no longer available to new users.');

  const res1 = await simulateStreamRoute(
    {
      chatId: testChatId,
      providerId: 'gemini',
      modelId: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'Hello' }],
    },
    db,
    mock404Fetch
  );

  console.log('Response Status:', res1.status, '| Ok:', res1.ok);
  console.log('Response JSON:', res1.json);

  if (res1.status === 404 && res1.ok === false && res1.json?.code === 'MODEL_NOT_AVAILABLE') {
    console.log('✅ TEST 1 PASSED: Gemini 404 returns HTTP 404 with MODEL_NOT_AVAILABLE.\n');
    passed++;
  } else {
    console.error('❌ TEST 1 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 3 & 4: Failed Stream does NOT create Assistant Message in DB
  // -------------------------------------------------------------
  console.log('--- TEST 2: Database Consistency on Stream Failure ---');
  const assistantMsgsAfter404 = db.messages.filter((m) => m.chat_id === testChatId && m.role === 'assistant');
  const postJobsAfter404 = db.postChatJobs.filter((j) => j.chat_id === testChatId);

  console.log(`Assistant messages in DB: ${assistantMsgsAfter404.length}`);
  console.log(`Post-chat jobs in DB: ${postJobsAfter404.length}`);

  if (assistantMsgsAfter404.length === 0 && postJobsAfter404.length === 0) {
    console.log('✅ TEST 2 PASSED: Zero orphaned assistant messages and zero post_chat_jobs created on failure.\n');
    passed++;
  } else {
    console.error('❌ TEST 2 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 5 & 6: Chat State Preservation & Single Chat Identity
  // -------------------------------------------------------------
  console.log('--- TEST 3: Chat State & Identity Stability ---');
  const totalChats = db.chats.length;
  console.log(`Total chats in DB: ${totalChats}`);

  if (totalChats === 1 && db.chats[0].id === testChatId) {
    console.log('✅ TEST 3 PASSED: Chat ID preserved; no accidental secondary chat created.\n');
    passed++;
  } else {
    console.error('❌ TEST 3 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 7 & 8: Retry with Valid Gemini Model Succeeds with 200 & SSE
  // -------------------------------------------------------------
  console.log('--- TEST 4: Retry with Valid Gemini Model ---');
  const sseBody = `data: {"candidates":[{"content":{"parts":[{"text":"Hello! I am Makkari powered by Gemini 2.0."}]}}]}\n\n`;

  const mockSuccessFetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    body: {
      getReader: () => {
        let sent = false;
        return {
          read: async () => {
            if (!sent) {
              sent = true;
              return { done: false, value: Buffer.from(sseBody) };
            }
            return { done: true, value: undefined };
          },
          releaseLock: () => {},
        };
      },
    },
  });

  const res2 = await simulateStreamRoute(
    {
      chatId: testChatId,
      providerId: 'gemini',
      modelId: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'Hello' }],
    },
    db,
    mockSuccessFetch
  );

  console.log('Retry Status:', res2.status, '| Content:', res2.content);
  const assistantMsgsAfterSuccess = db.messages.filter((m) => m.chat_id === testChatId && m.role === 'assistant');
  const postJobsAfterSuccess = db.postChatJobs.filter((j) => j.chat_id === testChatId);

  if (
    res2.status === 200 &&
    res2.ok &&
    assistantMsgsAfterSuccess.length === 1 &&
    postJobsAfterSuccess.length === 1
  ) {
    console.log('✅ TEST 4 PASSED: Valid Gemini request returns 200, saves assistant message, and enqueues post_chat_jobs.\n');
    passed++;
  } else {
    console.error('❌ TEST 4 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 9 & 10: Memory Context Layer Injected
  // -------------------------------------------------------------
  console.log('--- TEST 5: Memory Context Layer Injection ---');
  console.log('Memory injected into prompt during stream:', res2.memoryInjected);

  if (res2.memoryInjected) {
    console.log('✅ TEST 5 PASSED: Memory context <user_context> preserved in prompt pipeline.\n');
    passed++;
  } else {
    console.error('❌ TEST 5 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 11: Dynamic Fallback Selection for Model Discovery
  // -------------------------------------------------------------
  console.log('--- TEST 6: Dynamic Model Fallback Selection ---');
  const availableModels: MakkariModel[] = [
    {
      id: 'gemini-2.0-flash',
      providerId: 'gemini',
      providerKey: 'gemini',
      name: 'Gemini 2.0 Flash',
      displayName: 'Gemini 2.0 Flash',
      type: 'cloud',
      capabilities: { text: true, vision: true, imageGeneration: false, audioInput: false, audioOutput: false, videoInput: false, fileInput: true, streaming: true, tools: true, reasoning: { supported: true, visible: true, configurable: true } },
      availability: 'available',
    },
    {
      id: 'gemini-1.5-pro',
      providerId: 'gemini',
      providerKey: 'gemini',
      name: 'Gemini 1.5 Pro',
      displayName: 'Gemini 1.5 Pro',
      type: 'cloud',
      capabilities: { text: true, vision: true, imageGeneration: false, audioInput: false, audioOutput: false, videoInput: false, fileInput: true, streaming: true, tools: true, reasoning: { supported: true, visible: true, configurable: true } },
      availability: 'available',
    },
  ];

  const fallback = getClosestFallbackModel('gemini-2.5-flash', availableModels);
  console.log('Requested: "gemini-2.5-flash" -> Fallback selected:', fallback?.id);

  if (fallback?.id === 'gemini-2.0-flash') {
    console.log('✅ TEST 6 PASSED: Dynamic discovery correctly re-maps unavailable model to active alternative.\n');
    passed++;
  } else {
    console.error('❌ TEST 6 FAILED\n');
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('===============================================================');
  console.log(`LIFECYCLE TEST SUITE COMPLETE: ${passed}/6 TESTS PASSED`);
  console.log('===============================================================\n');
}

runStreamLifecycleTestSuite().catch(console.error);
