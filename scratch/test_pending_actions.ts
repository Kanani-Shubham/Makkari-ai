import { PendingActionStore } from '../lib/ai/actions/pending-action-store';

async function runPendingActionTests() {
  console.log('===============================================================');
  console.log('MAKKARI AI: PENDING ACTION STATE MACHINE TEST SUITE');
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

  const userId = 'user_test_999';
  const conversationId = 'conv_test_888';

  // TEST 1: Creation & Sanitized Payload
  console.log('\n--- TEST 1: Action Creation & Sanitized Payload ---');
  const { actionId, payload } = await PendingActionStore.createPendingAction(
    null,
    userId,
    conversationId,
    'calculator',
    { expression: '2 + 2', internalSecretToken: 'SECRET_DO_NOT_LEAK' },
    'Calculate expression 2 + 2',
    { expression: '2 + 2' }
  );

  assert(typeof actionId === 'string' && actionId.startsWith('act_'), 'Action ID generated');
  assert(payload.action === 'calculator', 'Action name matches');
  assert(payload.displayArguments?.expression === '2 + 2', 'displayArguments sanitized and present');
  assert((payload as any).arguments === undefined, 'Raw sensitive arguments are omitted from frontend payload');

  // TEST 2: Multi-turn Retrieval
  console.log('\n--- TEST 2: Active Action Retrieval ---');
  const activeAction = await PendingActionStore.getActiveActionForConversation(null, userId, conversationId);
  assert(activeAction !== null, 'Active action retrieved');
  assert(activeAction?.id === actionId, 'Active action ID matches');
  assert(activeAction?.status === 'pending', 'Action status is pending');

  // TEST 3: Idempotent Execution
  console.log('\n--- TEST 3: Idempotent Execution ---');
  const exec1 = await PendingActionStore.executeAction(null, userId, actionId, 'exec_001');
  assert(exec1.success === true, 'First execution succeeded');

  const exec2 = await PendingActionStore.executeAction(null, userId, actionId, 'exec_002');
  assert(exec2.success === true, 'Second execution handled safely');
  assert((exec2.result as any).idempotencySkipped === true, 'Duplicate execution skipped idempotently');

  // TEST 4: Disconnected MCP Service Execution Re-validation
  console.log('\n--- TEST 4: Disconnected Service Re-validation ---');
  const { actionId: canvaActId } = await PendingActionStore.createPendingAction(
    null,
    userId,
    conversationId,
    'mcp.canva.create_design',
    { title: 'Test Poster' },
    'Create Canva Poster'
  );

  const canvaExec = await PendingActionStore.executeAction(null, userId, canvaActId, 'exec_canva');
  assert(canvaExec.success === false, 'Disconnected MCP execution rejected at execution time');
  assert(canvaExec.error?.includes('offline or disconnected') === true, 'Correct disconnected error returned');

  console.log('\n===============================================================');
  console.log(`PENDING ACTION TEST COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runPendingActionTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
