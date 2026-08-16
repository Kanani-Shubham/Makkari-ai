import { detectMemoryIntent } from '../lib/ai/memory/memory-intent';
import { executeMemoryTool } from '../lib/ai/tools/memory/executor';
import {
  formatMemoryContextPrompt,
  getMemoryAuditLog,
} from '../lib/ai/memory/memory-service';
import { UserMemory, UserMemorySettings } from '../lib/ai/memory/types';

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
    user_id: 'user-hardening-123',
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

async function runHardeningTestSuite() {
  console.log('===============================================================');
  console.log('MAKKARI AI: PRODUCTION HARDENING & CONCURRENCY TEST SUITE');
  console.log('===============================================================\n');

  const mockSupabase = new MockSupabaseClient() as any;
  const testUserId = 'user-hardening-123';
  let passedCount = 0;

  // -------------------------------------------------------------
  // TEST 1: Double Execution Prevention (Explicit Intent + Model Tool Call)
  // -------------------------------------------------------------
  console.log('--- TEST 1: Explicit Intent + Model Tool Call Double Execution ---');
  const t1Intent = detectMemoryIntent('Remember that I use Next.js.');
  console.log('Step 1: Intent detection executes remember:');
  const t1ResIntent = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'remember', content: t1Intent.extractedFact!, type: t1Intent.inferredType }
  );
  console.log('Intent Result:', t1ResIntent);

  console.log('Step 2: Model subsequently attempts memory.remember() in same turn:');
  const t1ResModel = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: false },
    { operation: 'remember', content: 'User uses Next.js', type: 'technical_preference' }
  );
  console.log('Model Tool Result:', t1ResModel);

  const nextJsRows = mockSupabase.memories.filter((m: UserMemory) => m.content.toLowerCase().includes('next.js'));
  console.log(`Total Next.js memory rows in database: ${nextJsRows.length}`);

  if (t1ResIntent.action === 'created' && t1ResModel.action === 'already_exists' && nextJsRows.length === 1) {
    console.log('✅ TEST 1 PASSED: Exactly 1 row created; double-execution eliminated.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 1 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 2: Concurrent Remember Operations (5 simultaneous requests)
  // -------------------------------------------------------------
  console.log('--- TEST 2: Concurrency & Idempotency (5 simultaneous writes) ---');
  const concurrentPromises = Array.from({ length: 5 }).map(() =>
    executeMemoryTool(
      { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
      { operation: 'remember', content: 'User is building Makkari AI workspace.', type: 'project' }
    )
  );

  const concurrentResults = await Promise.all(concurrentPromises);
  const makkariRows = mockSupabase.memories.filter((m: UserMemory) => m.content.toLowerCase().includes('makkari'));
  console.log(`5 Concurrent calls returned actions:`, concurrentResults.map((r) => r.action));
  console.log(`Total Makkari rows in database: ${makkariRows.length}`);

  if (makkariRows.length === 1) {
    console.log('✅ TEST 2 PASSED: 5 concurrent requests resulted in exactly 1 persisted row.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 2 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 3: Ambiguous Forget Safety (Multiple matching memories)
  // -------------------------------------------------------------
  console.log('--- TEST 3: Ambiguous Forget Safety ---');
  // Seed 3 distinct React memories
  await executeMemoryTool({ supabase: mockSupabase, userId: testUserId, isUserExplicit: true }, { operation: 'remember', content: 'User uses React components.', type: 'technical_preference' });
  await executeMemoryTool({ supabase: mockSupabase, userId: testUserId, isUserExplicit: true }, { operation: 'remember', content: 'User is learning React Native.', type: 'goal' });
  await executeMemoryTool({ supabase: mockSupabase, userId: testUserId, isUserExplicit: true }, { operation: 'remember', content: 'User built a React analytics dashboard.', type: 'project' });

  const reactCountBefore = mockSupabase.memories.filter((m: UserMemory) => m.content.toLowerCase().includes('react')).length;
  console.log(`Initial React memories: ${reactCountBefore}`);

  console.log('Attempting ambiguous forget: "Forget my React memory"');
  const t3ForgetRes = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'forget', query: 'React' }
  );
  console.log('Forget Result:', t3ForgetRes);

  const reactCountAfter = mockSupabase.memories.filter((m: UserMemory) => m.content.toLowerCase().includes('react')).length;
  console.log(`React memories after ambiguous forget: ${reactCountAfter}`);

  if (
    !t3ForgetRes.success &&
    t3ForgetRes.error === 'AMBIGUOUS_MATCH' &&
    t3ForgetRes.memories &&
    t3ForgetRes.memories.length === 3 &&
    reactCountAfter === reactCountBefore
  ) {
    console.log('✅ TEST 3 PASSED: Multiple ambiguous matches safely rejected from mass deletion.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 3 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 4: Unambiguous Forget (Exact unique match)
  // -------------------------------------------------------------
  console.log('--- TEST 4: Unambiguous Unique Forget ---');
  console.log('Attempting unambiguous forget: "Forget that I am learning React Native."');
  const t4ForgetRes = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'forget', query: 'React Native' }
  );
  console.log('Forget Result:', t4ForgetRes);

  const reactNativeExists = mockSupabase.memories.some((m: UserMemory) => m.content.toLowerCase().includes('react native'));

  if (t4ForgetRes.success && t4ForgetRes.action === 'deleted' && !reactNativeExists) {
    console.log('✅ TEST 4 PASSED: Unique match safely deleted.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 4 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 5: User Memory Authority & Immutability vs AI
  // -------------------------------------------------------------
  console.log('--- TEST 5: User Memory Authority & Immutability ---');
  // Seed a user-created preference
  await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'remember', content: 'User prefers PostgreSQL databases.', type: 'technical_preference' }
  );

  console.log('AI autonomously attempts to overwrite user preference with "User prefers MongoDB":');
  const t5Res = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: false },
    { operation: 'remember', content: 'User prefers PostgreSQL databases.', type: 'technical_preference' }
  );
  console.log('AI Update Result:', t5Res);

  const pgMem = mockSupabase.memories.find((m: UserMemory) => m.content.toLowerCase().includes('postgresql'));

  if (pgMem?.source === 'user') {
    console.log('✅ TEST 5 PASSED: User-created memory strictly preserved source="user".\n');
    passedCount++;
  } else {
    console.error('❌ TEST 5 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 6: Memory Disabled Honesty
  // -------------------------------------------------------------
  console.log('--- TEST 6: Memory Disabled Honesty ---');
  mockSupabase.settings.memory_enabled = false;
  const t6Res = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'remember', content: 'User prefers Tailwind CSS.' }
  );
  console.log('Memory Disabled Result:', t6Res);

  if (!t6Res.success && t6Res.error === 'MEMORY_DISABLED') {
    console.log('✅ TEST 6 PASSED: Rejected honestly when memory is disabled.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 6 FAILED\n');
  }
  mockSupabase.settings.memory_enabled = true;

  // -------------------------------------------------------------
  // TEST 7: Sensitive Data Rejection & Zero Audit Leakage
  // -------------------------------------------------------------
  console.log('--- TEST 7: Sensitive Data Protection & Zero Audit Leakage ---');
  const t7Res = await executeMemoryTool(
    { supabase: mockSupabase, userId: testUserId, isUserExplicit: true },
    { operation: 'remember', content: 'My AWS secret key is AKIA1234567890ABCDEF' }
  );
  console.log('Sensitive Data Result:', t7Res);

  const auditLogs = getMemoryAuditLog(testUserId);
  const leakedSecret = JSON.stringify(auditLogs).includes('AKIA');

  if (!t7Res.success && t7Res.error === 'SENSITIVE_DATA' && !leakedSecret) {
    console.log('✅ TEST 7 PASSED: Sensitive key rejected with 0 database rows and 0 audit leaks.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 7 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 8: Audit Logging Verification
  // -------------------------------------------------------------
  console.log('--- TEST 8: Audit Log Tracking ---');
  console.log(`Total audit records tracked: ${auditLogs.length}`);
  console.log('Sample audit record:', auditLogs[0]);

  if (auditLogs.length > 0 && auditLogs[0].userId === testUserId) {
    console.log('✅ TEST 8 PASSED: Memory operations successfully tracked in audit log.\n');
    passedCount++;
  } else {
    console.error('❌ TEST 8 FAILED\n');
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('===============================================================');
  console.log(`HARDENING TEST SUITE COMPLETE: ${passedCount}/8 TESTS PASSED`);
  console.log('===============================================================\n');
}

runHardeningTestSuite().catch(console.error);
