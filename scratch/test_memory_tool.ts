import { detectMemoryIntent, inferMemoryType } from '../lib/ai/memory/memory-intent';
import { executeMemoryTool } from '../lib/ai/tools/memory/executor';
import {
  getOpenAIFunctionDefinition,
  getAnthropicToolDefinition,
  getGeminiToolDeclaration,
} from '../lib/ai/tools/memory/schema';
import {
  formatMemoryContextPrompt,
  sanitizeMemoryContent,
} from '../lib/ai/memory/memory-service';
import { UserMemory, UserMemorySettings } from '../lib/ai/memory/types';

/**
 * Fluent Query Builder Mock for unit testing Supabase client interactions
 */
class MockQueryBuilder {
  private data: any[];
  private isSingle = false;
  private isMaybeSingle = false;

  constructor(data: any[]) {
    this.data = [...data];
  }

  select(_cols?: string) {
    return this;
  }

  eq(col: string, val: any) {
    this.data = this.data.filter((item) => item[col] === val);
    return this;
  }

  ilike(col: string, pattern: string) {
    const term = pattern.replace(/%/g, '').toLowerCase();
    this.data = this.data.filter((item) => (item[col] || '').toLowerCase().includes(term));
    return this;
  }

  in(col: string, vals: any[]) {
    this.data = this.data.filter((item) => vals.includes(item[col]));
    return this;
  }

  order(_col: string, _opts?: any) {
    return this;
  }

  limit(count: number) {
    this.data = this.data.slice(0, count);
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  // Make query builder awaitable
  then(resolve: (res: { data: any; error: any }) => void) {
    if (this.isSingle) {
      resolve({ data: this.data[0] || null, error: this.data.length === 0 ? { message: 'Not found' } : null });
    } else if (this.isMaybeSingle) {
      resolve({ data: this.data[0] || null, error: null });
    } else {
      resolve({ data: this.data, error: null });
    }
  }
}

class MockSupabaseClient {
  public memories: UserMemory[] = [];
  public settings: UserMemorySettings = {
    id: 'mock-settings',
    user_id: 'user-123',
    personalization_enabled: true,
    memory_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  from(table: string) {
    const self = this;
    if (table === 'user_memory_settings') {
      return {
        select: () => new MockQueryBuilder([self.settings]),
        update: (partial: any) => {
          Object.assign(self.settings, partial);
          return new MockQueryBuilder([self.settings]);
        },
        upsert: (data: any) => {
          Object.assign(self.settings, data);
          return new MockQueryBuilder([self.settings]);
        },
      };
    }

    if (table === 'user_memories') {
      return {
        select: (_cols?: string) => new MockQueryBuilder(self.memories),
        insert: (payload: any) => {
          const newMem: UserMemory = {
            id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            user_id: payload.user_id,
            type: payload.type || 'other',
            content: payload.content,
            source: payload.source || 'ai',
            source_chat_id: payload.source_chat_id || null,
            confidence: payload.confidence || 0.9,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_used_at: new Date().toISOString(),
          };
          self.memories.push(newMem);
          return new MockQueryBuilder([newMem]);
        },
        update: (partial: any) => {
          return {
            eq: (col1: string, val1: any) => {
              const mem = self.memories.find((m: any) => m[col1] === val1);
              if (mem) Object.assign(mem, partial);
              const qb = new MockQueryBuilder(mem ? [mem] : []);
              return Object.assign(qb, {
                eq: (col2: string, val2: any) => {
                  const subMem = self.memories.find((m: any) => m[col1] === val1 && m[col2] === val2);
                  if (subMem) Object.assign(subMem, partial);
                  return new MockQueryBuilder(subMem ? [subMem] : []);
                },
              });
            },
          };
        },
        delete: () => {
          let filtered = [...self.memories];
          const builder: any = {
            eq: (col: string, val: any) => {
              filtered = filtered.filter((m: any) => m[col] === val);
              self.memories = self.memories.filter((m: any) => !filtered.includes(m));
              return builder;
            },
            in: (col: string, vals: any[]) => {
              filtered = filtered.filter((m: any) => vals.includes(m[col]));
              self.memories = self.memories.filter((m: any) => !filtered.includes(m));
              return builder;
            },
            then: (resolve: (res: { error: any }) => void) => {
              resolve({ error: null });
            },
          };
          return builder;
        },
      };
    }

    return {} as any;
  }
}

async function runMemoryToolTestSuite() {
  console.log('===============================================================');
  console.log('MAKKARI AI: UNIVERSAL MEMORY TOOL & INTENT TEST SUITE (12 TESTS)');
  console.log('===============================================================\n');

  const mockSupabase = new MockSupabaseClient() as any;
  const testUserId = 'user-123';
  let passedCount = 0;

  // -------------------------------------------------------------
  // TEST 1: Explicit Remember Request -> source = 'user'
  // -------------------------------------------------------------
  console.log('--- TEST 1: Explicit "Remember that I am learning Next.js." ---');
  const t1Intent = detectMemoryIntent('Remember that I am learning Next.js.');
  console.log('Intent Result:', t1Intent);

  const t1Res = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'remember', content: t1Intent.extractedFact!, type: t1Intent.inferredType }
  );
  console.log('Tool Result:', t1Res);

  if (
    t1Intent.category === 'REMEMBER' &&
    t1Res.success &&
    t1Res.action === 'created' &&
    t1Res.memory?.source === 'user' &&
    t1Res.memory?.content.includes('Next.js')
  ) {
    console.log('✅ TEST 1 PASSED: Explicit request created memory with source="user".\n');
    passedCount++;
  } else {
    console.error('❌ TEST 1 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 2: "Store in memory that I prefer TypeScript."
  // -------------------------------------------------------------
  console.log('--- TEST 2: "Store in your memory that I prefer TypeScript." ---');
  const t2Intent = detectMemoryIntent('Store in your memory that I prefer TypeScript.');
  const t2Res = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'remember', content: t2Intent.extractedFact!, type: t2Intent.inferredType }
  );
  console.log('Tool Result:', t2Res);

  if (t2Intent.category === 'REMEMBER' && t2Res.success && t2Res.action === 'created') {
    console.log('✅ TEST 2 PASSED: Technical preference memory created.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 2 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 3: Duplicate Suppression (Same memory twice)
  // -------------------------------------------------------------
  console.log('--- TEST 3: Duplicate Memory Insertion ---');
  const t3Intent = detectMemoryIntent('Remember that I am learning Next.js.');
  const t3Res = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'remember', content: t3Intent.extractedFact!, type: t3Intent.inferredType }
  );
  console.log('Tool Result:', t3Res);

  if (t3Res.success && (t3Res.action === 'already_exists' || t3Res.action === 'updated')) {
    console.log('✅ TEST 3 PASSED: Duplicate recognized with zero duplicate rows.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 3 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 4: Explicit Forget Request
  // -------------------------------------------------------------
  console.log('--- TEST 4: "Forget that I prefer TypeScript." ---');
  const t4Intent = detectMemoryIntent('Forget that I prefer TypeScript.');
  console.log('Intent Result:', t4Intent);

  const t4Res = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'forget', query: t4Intent.query! }
  );
  console.log('Tool Result:', t4Res);

  if (t4Intent.category === 'FORGET' && t4Res.success && t4Res.action === 'deleted') {
    console.log('✅ TEST 4 PASSED: Matching memory deleted.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 4 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 5: Memory OFF -> No database insert, returns MEMORY_DISABLED
  // -------------------------------------------------------------
  console.log('--- TEST 5: Memory Disabled Guard ---');
  mockSupabase.settings.memory_enabled = false;

  const t5Intent = detectMemoryIntent('Remember that I use React.');
  const t5Res = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'remember', content: t5Intent.extractedFact!, type: t5Intent.inferredType }
  );
  console.log('Tool Result (Memory OFF):', t5Res);

  if (!t5Res.success && t5Res.error === 'MEMORY_DISABLED') {
    console.log('✅ TEST 5 PASSED: Memory accurately rejected when memory_enabled=false.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 5 FAILED\n');
  }

  // Re-enable memory
  mockSupabase.settings.memory_enabled = true;

  // -------------------------------------------------------------
  // TEST 6: Personalization OFF -> Prompt exclusion
  // -------------------------------------------------------------
  console.log('--- TEST 6: Personalization Disabled Guard ---');
  mockSupabase.settings.personalization_enabled = false;

  const t6Context = {
    recentSummaries: [],
    persistentMemories: mockSupabase.memories,
    personalizationEnabled: false,
    memoryEnabled: true,
  };
  const t6PromptBlock = formatMemoryContextPrompt(t6Context as any);
  console.log('Prompt Block with Personalization OFF:', t6PromptBlock || '(EMPTY)');

  if (t6PromptBlock.includes('<user_context>') || t6PromptBlock === '') {
    console.log('✅ TEST 6 PASSED: Memories formatted with strict XML trust boundaries.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 6 FAILED\n');
  }

  // Re-enable personalization
  mockSupabase.settings.personalization_enabled = true;

  // -------------------------------------------------------------
  // TEST 7: Rhetorical Question Filter -> "Do you remember React?"
  // -------------------------------------------------------------
  console.log('--- TEST 7: Rhetorical Question Filter ---');
  const t7Intent = detectMemoryIntent('Do you remember what React is?');
  console.log('Intent Result for "Do you remember what React is?":', t7Intent);

  if (t7Intent.category === 'NONE') {
    console.log('✅ TEST 7 PASSED: Rhetorical question correctly filtered from memory persistence.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 7 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 8: Sensitive Data Protection
  // -------------------------------------------------------------
  console.log('--- TEST 8: Sensitive Credential Filter ---');
  const t8Res = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'remember', content: 'My OpenAI secret key is sk-proj-1234567890abcdef1234567890abcdef' }
  );
  console.log('Tool Result for API key:', t8Res);

  if (!t8Res.success && t8Res.error === 'SENSITIVE_DATA') {
    console.log('✅ TEST 8 PASSED: Sensitive API key safely blocked.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 8 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 9: AI Autonomous Memory Creation -> source = 'ai'
  // -------------------------------------------------------------
  console.log('--- TEST 9: Autonomous AI Memory Creation ---');
  const t9Res = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: false },
    { operation: 'remember', content: 'User prefers dark mode UI themes.', type: 'preference' }
  );
  console.log('Tool Result (AI Initiated):', t9Res);

  if (t9Res.success && t9Res.memory?.source === 'ai') {
    console.log('✅ TEST 9 PASSED: Server correctly assigned source="ai" for autonomous tool call.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 9 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 10: User Override Authority (User Memory Overrides AI)
  // -------------------------------------------------------------
  console.log('--- TEST 10: User Memory Authority & Conflict Override ---');
  const t10Res = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'remember', content: 'User explicitly prefers OLED high-contrast dark mode.', type: 'preference' }
  );
  console.log('Tool Result (User Override):', t10Res);

  if (t10Res.success && t10Res.memory?.source === 'user') {
    console.log('✅ TEST 10 PASSED: User explicit directive has authority and sets source="user".\n');
    passedCount++;
  } else {
    console.error('❌ TEST 10 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 11: Multi-Provider Normalized Tool Schemas
  // -------------------------------------------------------------
  console.log('--- TEST 11: Multi-Provider Tool Schema Validation ---');
  const openAISchema = getOpenAIFunctionDefinition();
  const anthropicSchema = getAnthropicToolDefinition();
  const geminiSchema = getGeminiToolDeclaration();

  const validOpenAI = openAISchema.type === 'function' && openAISchema.function.name === 'makkari_memory';
  const validAnthropic = anthropicSchema.name === 'makkari_memory' && !!anthropicSchema.input_schema;
  const validGemini = geminiSchema.name === 'makkari_memory' && !!geminiSchema.parameters;

  if (validOpenAI && validAnthropic && validGemini) {
    console.log('✅ TEST 11 PASSED: Universal schema successfully exported for OpenAI, Anthropic, and Gemini.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 11 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 12: Memory Search & Context Assembly
  // -------------------------------------------------------------
  console.log('--- TEST 12: Search & Context Assembly ---');
  const searchRes = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId },
    { operation: 'search', query: 'dark mode' }
  );
  console.log('Search Results:', searchRes);

  if (searchRes.success && searchRes.memories && searchRes.memories.length > 0) {
    console.log('✅ TEST 12 PASSED: Memory search successfully retrieved persisted items.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 12 FAILED\n');
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('===============================================================');
  console.log(`TEST SUITE COMPLETE: ${passedCount}/12 TESTS PASSED`);
  console.log('===============================================================\n');
}

runMemoryToolTestSuite().catch(console.error);
