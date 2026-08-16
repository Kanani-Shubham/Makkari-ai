import * as fs from 'fs';
import * as path from 'path';

async function runChatScrollContainerTests() {
  console.log('===============================================================');
  console.log('MAKKARI AI: CHAT SCROLL CONTAINER TEST SUITE');
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

  const pagePath = path.join(process.cwd(), 'app/(dashboard)/chat/[id]/page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // TEST 1: Single primary vertical scroll owner
  console.log('\n--- TEST 1: Single Primary Scroll Owner ---');
  assert(pageContent.includes('ref={scrollRef}') && pageContent.includes('overflow-y-auto'), 'scrollRef container has overflow-y-auto');
  assert(pageContent.includes('h-[calc(100vh-3.5rem)] overflow-hidden'), 'Outer shell has overflow-hidden preventing double scrollbars');

  // TEST 2: Bottom sentinel
  console.log('\n--- TEST 2: Bottom Sentinel Implementation ---');
  assert(pageContent.includes('ref={bottomSentinelRef}'), 'bottomSentinelRef element is present');

  // TEST 3: Intelligent auto-scroll distance calculation
  console.log('\n--- TEST 3: Distance Calculation & New Response Button ---');
  assert(pageContent.includes('distanceFromBottom = scrollHeight - scrollTop - clientHeight'), 'Distance from bottom calculation is implemented');
  assert(pageContent.includes('distanceFromBottom <= 60'), '60px threshold is used for near-bottom detection');
  assert(pageContent.includes('showNewResponseButton'), 'showNewResponseButton state is managed');
  assert(pageContent.includes('New response'), '"New response" floating button UI is rendered');

  console.log('\n===============================================================');
  console.log(`CHAT SCROLL CONTAINER TEST COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runChatScrollContainerTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
