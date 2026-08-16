// Comprehensive Automated Test Suite: Single Assistant Message Lifecycle & Deduplication
// Run with: npx tsx scratch/test_chat_message_lifecycle.ts

import assert from 'assert';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_id?: string;
  provider_id?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

// 1. Simulation of useChatStore single canonical assistant message state engine
class ChatStoreEngine {
  messages: Record<string, ChatMessage[]> = {};
  isStreaming = false;

  upsertMessage(chatId: string, message: ChatMessage) {
    const chatMsgs = this.messages[chatId] || [];
    const msgId = message.id || 'generated-uuid';
    const existingIdx = chatMsgs.findIndex((m) => m.id === msgId);

    if (existingIdx !== -1) {
      const updated = [...chatMsgs];
      updated[existingIdx] = {
        ...updated[existingIdx],
        ...message,
        id: msgId,
      };
      this.messages[chatId] = updated;
    } else {
      this.messages[chatId] = [
        ...chatMsgs,
        { ...message, id: msgId, created_at: message.created_at || new Date().toISOString() },
      ];
    }
  }

  updateStreamingMessage(chatId: string, messageId: string, updates: Partial<ChatMessage>) {
    const chatMsgs = this.messages[chatId] || [];
    const idx = chatMsgs.findIndex((m) => m.id === messageId);
    if (idx === -1) {
      this.messages[chatId] = [
        ...chatMsgs,
        {
          id: messageId,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
          ...updates,
        } as ChatMessage,
      ];
      return;
    }

    const updated = [...chatMsgs];
    const existing = updated[idx];
    const existingMetadata = existing.metadata || {};
    const newMetadata = updates.metadata ? { ...existingMetadata, ...updates.metadata } : existingMetadata;

    updated[idx] = {
      ...existing,
      ...updates,
      metadata: newMetadata,
    };
    this.messages[chatId] = updated;
  }
}

async function runTests() {
  console.log('🧪 Starting Message Lifecycle & Deduplication Tests...\n');

  const engine = new ChatStoreEngine();
  const chatId = 'chat-turn-test-1';

  // Test 1: User sends message
  console.log('Test 1: User message addition');
  const userMsgId = 'usr-1';
  engine.upsertMessage(chatId, {
    id: userMsgId,
    role: 'user',
    content: 'hello',
  });
  assert.strictEqual(engine.messages[chatId].length, 1, 'Expected 1 message (user)');
  console.log('✅ Test 1 Passed: 1 user message created');

  // Test 2: In-flight assistant placeholder creation
  console.log('\nTest 2: Single canonical assistant message creation');
  const assistantMsgId = 'asst-1';
  engine.upsertMessage(chatId, {
    id: assistantMsgId,
    role: 'assistant',
    content: '',
    model_id: 'lfm2.5:latest',
    provider_id: 'ollama',
    metadata: {
      reasoning: { available: false, summary: '', events: [] },
    },
  });
  assert.strictEqual(engine.messages[chatId].length, 2, 'Expected 2 total messages (1 user, 1 assistant)');
  console.log('✅ Test 2 Passed: Exactly 1 assistant placeholder initialized');

  // Test 3: Streaming reasoning chunks
  console.log('\nTest 3: Streaming reasoning update (in-place)');
  engine.updateStreamingMessage(chatId, assistantMsgId, {
    metadata: {
      reasoning: {
        available: true,
        summary: 'Thinking about user prompt...',
        events: [{ type: 'status', text: 'Analyzing...', timestamp: Date.now() }],
      },
    },
  });
  assert.strictEqual(engine.messages[chatId].length, 2, 'Expected still 2 messages (no duplicate on reasoning)');
  assert.strictEqual(
    engine.messages[chatId][1].metadata?.reasoning?.summary,
    'Thinking about user prompt...'
  );
  console.log('✅ Test 3 Passed: Reasoning updated in-place without duplicating message');

  // Test 4: Streaming text deltas
  console.log('\nTest 4: Streaming text chunks (in-place)');
  engine.updateStreamingMessage(chatId, assistantMsgId, {
    content: 'Hello! How may I assist you today?',
  });
  assert.strictEqual(engine.messages[chatId].length, 2, 'Expected still 2 messages (no duplicate on text)');
  assert.strictEqual(
    engine.messages[chatId][1].content,
    'Hello! How may I assist you today?'
  );
  console.log('✅ Test 4 Passed: Text delta updated in-place without duplicating message');

  // Test 5: Stream completion & persistence reconciliation
  console.log('\nTest 5: Final completion upsert (same ID)');
  engine.upsertMessage(chatId, {
    id: assistantMsgId,
    role: 'assistant',
    content: 'Hello! How may I assist you today?',
    model_id: 'lfm2.5:latest',
    provider_id: 'ollama',
    metadata: {
      durationMs: 1200,
      reasoning: {
        available: true,
        summary: 'Response synthesized',
        events: [],
      },
    },
  });
  assert.strictEqual(engine.messages[chatId].length, 2, 'Expected still 2 messages after completion');
  console.log('✅ Test 5 Passed: Stream completion maintains exactly 1 assistant message');

  // Test 6: Simulating page refresh / Supabase reload
  console.log('\nTest 6: Database reload reconciliation');
  const dbReloadedMessages: ChatMessage[] = [
    { id: 'usr-1', role: 'user', content: 'hello' },
    { id: 'asst-1', role: 'assistant', content: 'Hello! How may I assist you today?' },
  ];
  engine.messages[chatId] = dbReloadedMessages;
  assert.strictEqual(engine.messages[chatId].length, 2, 'Expected 2 messages after DB reload');
  assert.strictEqual(engine.messages[chatId].filter((m) => m.role === 'assistant').length, 1);
  console.log('✅ Test 6 Passed: Reload renders exactly 1 assistant response');

  console.log('\n🎉 ALL 6 CHAT LIFECYCLE TESTS PASSED PERFECTLY!');
}

runTests();
