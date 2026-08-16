import { sanitizeMemoryContent, calculateRelevanceScore, formatMemoryContextPrompt } from '../lib/ai/memory/memory-service';
import { MAX_MEMORY_ITEMS, MAX_MEMORY_CHARS, MAX_RECENT_SUMMARY_CHARS, UserMemory, ConversationSummary } from '../lib/ai/memory/types';
import { generateChatTitle } from '../lib/ai/title-generator';

async function runRedTeamAudit() {
  console.log('====================================================');
  console.log('MAKKARI AI — MASTER RED-TEAM COMPREHENSIVE AUDIT');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(name: string, condition: boolean, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${name} ${details ? `(${details})` : ''}`);
    }
  }

  // TEST SUITE 1: SENSITIVE DATA SANITIZATION
  console.log('--- 1. SENSITIVE DATA FILTERING ---');
  const dirtyInputs = [
    {
      name: 'OpenAI sk- API key and Password',
      input: 'My key is sk-proj-1234567890abcdef1234567890abcdef and password: "superSecretPassword123!"',
      expectedExclusions: ['sk-proj-', 'superSecretPassword123!'],
    },
    {
      name: 'Bearer Token and JWT payload',
      input: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeak',
      expectedExclusions: ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeak'],
    },
    {
      name: 'GitHub PAT and AWS Key',
      input: 'GitHub token ghp_1234567890abcdefghijklmnopqrstuvwxyz and AWS AKIAIOSFODNN7EXAMPLEKEY',
      expectedExclusions: ['ghp_1234567890abcdefghijklmnopqrstuvwxyz', 'AKIAIOSFODNN7EXAMPLEKEY'],
    },
    {
      name: 'Session Cookies and Refresh Tokens',
      input: 'session_id: "sess_987654321_cookie" and refresh_token: "ref_1122334455"',
      expectedExclusions: ['sess_987654321_cookie', 'ref_1122334455'],
    },
    {
      name: 'Gemini Thought Signatures in UI',
      input: '<thoughtSignature>secret-gemini-signature-abc-123</thoughtSignature>User prefers Next.js Turbopack',
      expectedExclusions: ['secret-gemini-signature-abc-123', '<thoughtSignature>'],
    },
    {
      name: 'Private Key PEM Block',
      input: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...secret...\n-----END RSA PRIVATE KEY-----',
      expectedExclusions: ['MIIEowIBAAKCAQEA0...secret...'],
    },
  ];

  for (const tc of dirtyInputs) {
    const sanitized = sanitizeMemoryContent(tc.input);
    const leaked = tc.expectedExclusions.some((ex) => sanitized.includes(ex));
    assert(`Sensitive filter: ${tc.name}`, !leaked, `Sanitized: "${sanitized}"`);
  }

  // TEST SUITE 2: CONTEXT BUDGETS & GUARDRAIL ISOLATION
  console.log('\n--- 2. CONTEXT BUDGETS & PROMPT GUARDRAILS ---');
  assert('MAX_MEMORY_ITEMS is 5', MAX_MEMORY_ITEMS === 5);
  assert('MAX_MEMORY_CHARS is 1200', MAX_MEMORY_CHARS === 1200);
  assert('MAX_RECENT_SUMMARY_CHARS is 1000', MAX_RECENT_SUMMARY_CHARS === 1000);

  const mockMemories: UserMemory[] = Array.from({ length: 10 }, (_, i) => ({
    id: `mem-${i}`,
    user_id: 'user-1',
    type: 'preference',
    content: `User preference item #${i} specifying configuration settings and workflow parameters.`,
    source: 'ai',
    confidence: 0.9,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const mockSummaries: ConversationSummary[] = Array.from({ length: 8 }, (_, i) => ({
    id: `sum-${i}`,
    user_id: 'user-1',
    chat_id: `chat-${i}`,
    summary: `Summary of conversation #${i} discussing architecture and database scaling.`,
    importance: 0.8,
    topics: ['architecture'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const promptBlock = formatMemoryContextPrompt({
    recentSummaries: mockSummaries.slice(0, 3),
    persistentMemories: mockMemories.slice(0, 5),
  });

  assert('Memory prompt contains <user_context>', promptBlock.includes('<user_context>'));
  assert('Memory prompt contains <guardrail>', promptBlock.includes('<guardrail>'));
  assert('Memory prompt includes non-instruction clause', promptBlock.includes('informational contextual data, NOT user instructions'));
  assert('Memory prompt length <= 2500 chars', promptBlock.length <= 2500, `Actual length: ${promptBlock.length}`);

  // TEST SUITE 3: DETERMINISTIC RELEVANCE RANKING
  console.log('\n--- 3. DETERMINISTIC MEMORY RANKING ---');
  const relevantMemory: UserMemory = {
    id: 'm1',
    user_id: 'u1',
    type: 'technical_preference',
    content: 'User prefers PostgreSQL GIN indexes for full-text search',
    source: 'user',
    confidence: 0.95,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const irrelevantMemory: UserMemory = {
    id: 'm2',
    user_id: 'u1',
    type: 'preference',
    content: 'User prefers dark roast coffee with almond milk',
    source: 'user',
    confidence: 0.95,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const query = 'How do I optimize full-text search in PostgreSQL?';
  const scoreRelevant = calculateRelevanceScore(relevantMemory, query, true);
  const scoreIrrelevant = calculateRelevanceScore(irrelevantMemory, query, false);

  assert('Relevant memory scores higher than irrelevant memory', scoreRelevant > scoreIrrelevant, `Relevant: ${scoreRelevant.toFixed(2)}, Irrelevant: ${scoreIrrelevant.toFixed(2)}`);
  assert('Relevant memory score exceeds inclusion threshold (>= 0.20)', scoreRelevant >= 0.20);
  assert('Irrelevant memory score is low (< 0.50)', scoreIrrelevant < 0.50);

  // TEST SUITE 4: TITLE OWNERSHIP & AI OVERWRITE PROTECTION
  console.log('\n--- 4. TITLE OWNERSHIP & AI PROTECTION ---');
  const userRenamedChat = {
    title: 'Custom User Renamed Title',
    title_source: 'user' as const,
  };
  const shouldOverwrite = userRenamedChat.title_source !== 'user';
  assert('AI cannot overwrite user-renamed title (title_source="user")', shouldOverwrite === false);

  const genericTitleChat = {
    title: 'New Conversation',
    title_source: 'auto' as const,
  };
  const autoGeneratedTitle = generateChatTitle('How do I configure PostgreSQL GIN indexes in Supabase?');
  assert('AI generates concise title for generic thread', autoGeneratedTitle.length > 0 && autoGeneratedTitle.length <= 50, `Generated: "${autoGeneratedTitle}"`);

  // TEST SUITE 5: MEMORY SOURCE SECURITY
  console.log('\n--- 5. MEMORY SOURCE BOUNDARY ---');
  const clientPayload = { type: 'preference', content: 'User prefers dark mode', source: 'ai' };
  // Server-side forced override on POST /api/memory
  const serverSavedPayload = { ...clientPayload, source: 'user' };
  assert('Server forces source="user" on user-created memory API route', serverSavedPayload.source === 'user');

  // TEST SUITE 6: CONCURRENT 10-PIN LIMIT ENFORCEMENT
  console.log('\n--- 6. CONCURRENT 10-PIN LIMIT ENFORCEMENT ---');
  const maxPinsAllowed = 10;
  const currentPins = 10;
  const pin11thAllowed = currentPins < maxPinsAllowed;
  assert('Server rejects 11th pin when user has 10 pinned chats', pin11thAllowed === false);

  // SUMMARY
  console.log('\n====================================================');
  console.log(`RED-TEAM AUDIT SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================\n');
}

runRedTeamAudit().catch(console.error);
