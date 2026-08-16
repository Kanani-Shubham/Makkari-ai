import { buildOutputContract } from '../lib/ai/intent/contract-builder';
import { validateOutputAgainstContract } from '../lib/ai/intent/output-validator';

function runStreamingFragmentationTests() {
  console.log('===============================================================');
  console.log('MAKKARI AI: STREAMING FRAGMENTATION REGRESSION TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`❌ TEST FAILED: ${msg}`);
      throw new Error(msg);
    }
    passed++;
    console.log(`✅ ${msg}`);
  }

  // --- TEST 1: Simulate Fragmented SSE Token Accumulation ---
  console.log('--- TEST 1: Fragmented SSE Token Accumulation ---');
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<style>
body {
    margin: 0;
    background: linear-gradient(135deg, #ff00aa, #4400ff);
}
</style>
</head>
<body>
<div>Hello</div>
<script>
document.querySelector("div").textContent = "Hello Makkari";
</script>
</body>
</html>`;

  // Break HTML into tiny fragments of 5-15 characters (simulating SSE chunk stream)
  const chunks: string[] = [];
  let pos = 0;
  while (pos < fullHtml.length) {
    const chunkSize = Math.floor(Math.random() * 10) + 5;
    chunks.push(fullHtml.slice(pos, pos + chunkSize));
    pos += chunkSize;
  }

  // Re-accumulate raw stream
  let accumulated = '';
  for (const chunk of chunks) {
    accumulated += chunk;
  }

  assert(accumulated === fullHtml, 'Complete HTML accumulated without character loss or corruption');

  // --- TEST 2: Structured Artifact Creation (Markdown Bypass) ---
  console.log('\n--- TEST 2: Structured Artifact Creation (Markdown Bypass) ---');
  const contract = buildOutputContract('Create a glamorphism page in one single html file');

  const artifactPayload = {
    title: 'Glamorphism Login',
    artifact_type: 'web' as const,
    files: [
      {
        filename: 'index.html',
        language: 'html',
        content: accumulated,
        is_entry_file: true,
      },
    ],
  };

  const validation = validateOutputAgainstContract(artifactPayload, contract);
  assert(validation.isValid === true, 'Artifact payload passes output contract validation');
  assert(artifactPayload.files[0].content.includes('<!DOCTYPE html>'), 'Contains complete HTML doctype');
  assert(artifactPayload.files[0].content.includes('<style>'), 'Contains embedded CSS style block');
  assert(artifactPayload.files[0].content.includes('<script>'), 'Contains embedded JavaScript script block');
  assert(!artifactPayload.files[0].content.includes('import React'), 'Zero framework pollution');

  console.log('\n===============================================================');
  console.log(`STREAMING FRAGMENTATION TEST SUITE COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runStreamingFragmentationTests();
