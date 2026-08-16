import { execSync } from 'child_process';

const testSuites = [
  'scratch/test_capability_truth.ts',
  'scratch/test_canonical_events.ts',
  'scratch/test_stream_terminal_state.ts',
  'scratch/test_pending_actions.ts',
  'scratch/test_chat_scroll_container.ts',
  'scratch/test_model_registry.ts',
  'scratch/test_intent_contract.ts',
  'scratch/test_preview_security.ts',
  'scratch/test_streaming_fragmentation.ts',
  'scratch/test_artifacts_platform.ts',
  'scratch/test_markdown_tables.ts',
  'scratch/test_golden_e2e.ts',
];

console.log('===============================================================');
console.log('MAKKARI AI: MASTER AUTOMATED REGRESSION TEST MATRIX');
console.log('===============================================================');

let allPassed = true;

for (const suite of testSuites) {
  try {
    console.log(`\n▶ Running ${suite}...`);
    const output = execSync(`npx tsx ${suite}`, { encoding: 'utf8' });
    console.log(output.trim());
    console.log(`✔ ${suite} PASSED`);
  } catch (err: any) {
    console.error(`✖ ${suite} FAILED:`, err.stdout || err.message);
    allPassed = false;
    process.exitCode = 1;
    break;
  }
}

if (allPassed) {
  console.log('\n===============================================================');
  console.log('ALL 12 TEST SUITES PASSED PERFECTLY!');
  console.log('===============================================================');
}
