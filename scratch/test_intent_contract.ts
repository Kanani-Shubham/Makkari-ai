import { buildOutputContract, formatOutputContractPrompt } from '../lib/ai/intent/contract-builder';
import { validateOutputAgainstContract } from '../lib/ai/intent/output-validator';
import { resolveTurnCapabilities } from '../lib/ai/capability/pipeline';

async function runIntentContractTests() {
  console.log('===============================================================');
  console.log('MAKKARI AI: INTENT & OUTPUT CONTRACT TEST SUITE');
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

  // --- TEST 1: Single HTML Prompt Extraction ---
  console.log('--- TEST 1: Single HTML Prompt Extraction ---');
  const userPrompt = 'create a glamorphim cartoon type color full login page use skill if you need and also show me preview in one single html file using html css js';
  const contract = buildOutputContract(userPrompt);

  assert(contract.fileMode === 'single-file', 'Contract correctly resolved fileMode to single-file');
  assert(contract.primaryFilename === 'index.html', 'Primary filename resolved to index.html');
  assert(contract.explicitFramework === 'none', 'Explicit framework resolved to none');
  assert(contract.forbiddenSkills.includes('nextjs'), 'nextjs skill is in forbiddenSkills');
  assert(contract.forbiddenSkills.includes('react'), 'react skill is in forbiddenSkills');
  assert(contract.requiresPreview === true, 'Preview is required');

  // --- TEST 2: System Prompt Output Contract Formatting ---
  console.log('\n--- TEST 2: Output Contract Formatting ---');
  const contractPrompt = formatOutputContractPrompt(contract);
  assert(contractPrompt.includes('<output_contract>'), '<output_contract> tag generated');
  assert(contractPrompt.includes('EXACTLY ONE SINGLE FILE: "index.html"'), 'Single file directive included');
  assert(contractPrompt.includes('DO NOT use Next.js, React, TypeScript, Tailwind'), 'Framework restriction included');

  // --- TEST 3: Capability Pipeline Skill Blocking ---
  console.log('\n--- TEST 3: Capability Pipeline Skill Blocking ---');
  const capabilities = await resolveTurnCapabilities({
    userPrompt,
  });
  assert(!capabilities.activeSkillNames.includes('nextjs'), 'nextjs skill is blocked from active skills');
  assert(!capabilities.activeSkillNames.includes('react'), 'react skill is blocked from active skills');
  assert(capabilities.systemPromptAdditions.includes('<output_contract>'), 'Output contract prepended to capabilities');

  // --- TEST 4: Output Validator Bounded Auto-Repair ---
  console.log('\n--- TEST 4: Output Validator Bounded Auto-Repair ---');
  const multiFileAttempt = {
    chatId: 'chat_test',
    title: 'Login Page',
    files: [
      { filename: 'index.html', language: 'html', content: '<html><head></head><body><h1>Login</h1></body></html>' },
      { filename: 'style.css', language: 'css', content: 'body { background: pink; }' },
      { filename: 'script.js', language: 'javascript', content: 'console.log("ready");' },
    ],
  };

  const validation = validateOutputAgainstContract(multiFileAttempt, contract);
  assert(validation.isValid === false, 'Detected violation for 3 files when 1 was requested');
  assert(validation.canAutoRepair === true, 'Can deterministically auto-repair');
  assert(validation.repairedArtifact !== undefined, 'Repaired artifact generated');
  assert(validation.repairedArtifact!.files[0].content.includes('<style>\nbody { background: pink; }\n  </style>'), 'CSS inlined into <style>');
  assert(validation.repairedArtifact!.files[0].content.includes('<script>\nconsole.log("ready");\n  </script>'), 'JS inlined into <script>');

  console.log('\n===============================================================');
  console.log(`INTENT CONTRACT TEST SUITE COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runIntentContractTests();
