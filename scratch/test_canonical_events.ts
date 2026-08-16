import { CanonicalEventBus } from '../lib/ai/events/canonical-events';

async function runCanonicalEventTests() {
  console.log('===============================================================');
  console.log('MAKKARI AI: CANONICAL EVENT BUS TEST SUITE');
  console.log('===============================================================');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, label: string) {
    total++;
    if (condition) {
      console.log(`✅ ${label}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${label}`);
      process.exitCode = 1;
    }
  }

  const envelopes: any[] = [];
  const bus = new CanonicalEventBus('chat_test_123', (env) => {
    envelopes.push(env);
  });

  // TEST 1: Stream start and monotonic sequencing
  console.log('\n--- TEST 1: Monotonic Sequencing & Envelope ---');
  const e1 = bus.emit({ type: 'STREAM_START' });
  const e2 = bus.emit({ type: 'THINKING_START' });
  const e3 = bus.emit({ type: 'THINKING_STATUS', status: 'Creating artifact...' });
  const e4 = bus.emit({ type: 'TEXT_DELTA', delta: 'Hello world' });

  assert(e1?.sequence === 1, 'Event 1 sequence is 1');
  assert(e2?.sequence === 2, 'Event 2 sequence is 2');
  assert(e3?.sequence === 3, 'Event 3 sequence is 3');
  assert(e4?.sequence === 4, 'Event 4 sequence is 4');
  assert(e1?.protocolVersion === 1, 'Protocol version is 1');
  assert(e1?.conversationId === 'chat_test_123', 'Conversation ID is attached');
  assert(typeof e1?.eventId === 'string' && e1.eventId.startsWith('evt_'), 'Unique event ID is generated');

  // TEST 2: Validated DTOs for Artifact & Tool Result
  console.log('\n--- TEST 2: Validated DTO Payloads ---');
  const e5 = bus.emit({
    type: 'ARTIFACT_CREATE',
    artifact: {
      artifactId: 'art_123',
      title: 'Interactive Dashboard',
      artifactType: 'web',
      version: 1,
      files: [
        {
          filename: 'index.html',
          language: 'html',
          mimeType: 'text/html',
          sizeBytes: 512,
          content: '<h1>Dashboard</h1>',
        },
      ],
    },
  });

  assert(e5?.event.type === 'ARTIFACT_CREATE', 'ARTIFACT_CREATE event type preserved');
  assert((e5?.event as any).artifact.title === 'Interactive Dashboard', 'Artifact DTO title validated');

  const e6 = bus.emit({
    type: 'TOOL_RESULT',
    callId: 'call_999',
    result: {
      success: true,
      summary: 'Calculation complete',
      output: { value: 42 },
    },
  });

  assert(e6?.event.type === 'TOOL_RESULT', 'TOOL_RESULT event type preserved');
  assert((e6?.event as any).result.success === true, 'Tool result success flag validated');

  // TEST 3: SSE formatting
  console.log('\n--- TEST 3: SSE Formatting ---');
  const sseFormatted = CanonicalEventBus.formatSSE(e4!);
  assert(sseFormatted.startsWith('data: {'), 'SSE formatted starts with data:');
  assert(sseFormatted.endsWith('\n\n'), 'SSE formatted ends with double newline');

  console.log('\n===============================================================');
  console.log(`CANONICAL EVENT BUS TEST COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runCanonicalEventTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
