import { CanonicalEventBus } from '../lib/ai/events/canonical-events';

async function runTerminalStateTests() {
  console.log('===============================================================');
  console.log('MAKKARI AI: STREAM TERMINAL STATE TEST SUITE');
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

  // TEST 1: Standard stream completion
  console.log('\n--- TEST 1: Standard Completion (DONE) ---');
  const bus1 = new CanonicalEventBus('chat_1');
  assert(bus1.getState() === 'idle', 'Initial state is idle');
  bus1.emit({ type: 'STREAM_START' });
  assert(bus1.getState() === 'started', 'State is started');
  bus1.emit({ type: 'TEXT_DELTA', delta: 'Content' });
  assert(bus1.getState() === 'active', 'State is active');
  const doneEvt = bus1.emit({ type: 'DONE' });
  assert(doneEvt !== null, 'DONE emitted successfully');
  assert(bus1.isTerminal(), 'Bus is in terminal state');

  // Post-terminal rejection
  const rejected1 = bus1.emit({ type: 'TEXT_DELTA', delta: 'Late chunk' });
  assert(rejected1 === null, 'Post-terminal event rejected');
  const rejected2 = bus1.emit({ type: 'DONE' });
  assert(rejected2 === null, 'Duplicate DONE rejected');

  // TEST 2: Stream Cancellation
  console.log('\n--- TEST 2: Stream Cancellation (CANCELLED) ---');
  const bus2 = new CanonicalEventBus('chat_2');
  bus2.emit({ type: 'STREAM_START' });
  bus2.emit({ type: 'THINKING_START' });
  const cancelEvt = bus2.emit({ type: 'CANCELLED', reason: 'User clicked Stop' });
  assert(cancelEvt !== null, 'CANCELLED emitted successfully');
  assert(bus2.isTerminal(), 'Bus is in terminal state after cancel');
  assert(bus2.emit({ type: 'TEXT_DELTA', delta: 'Should not emit' }) === null, 'Post-cancel event rejected');

  // TEST 3: Stream Error
  console.log('\n--- TEST 3: Stream Error (ERROR) ---');
  const bus3 = new CanonicalEventBus('chat_3');
  bus3.emit({ type: 'STREAM_START' });
  const errorEvt = bus3.emit({ type: 'ERROR', message: 'API rate limit' });
  assert(errorEvt !== null, 'ERROR emitted successfully');
  assert(bus3.isTerminal(), 'Bus is in terminal state after error');
  assert(bus3.emit({ type: 'DONE' }) === null, 'DONE after ERROR is rejected');

  console.log('\n===============================================================');
  console.log(`STREAM TERMINAL STATE TEST COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runTerminalStateTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
