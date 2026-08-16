import { buildOutputContract, formatOutputContractPrompt } from '../lib/ai/intent/contract-builder';
import { skillRegistry } from '../lib/ai/skills/registry';
import { StatefulToolProtocolParser } from '../lib/ai/stream/tool-protocol-parser';
import { CanonicalEventBus } from '../lib/ai/events/canonical-events';
import { resolveTurnCapabilities } from '../lib/ai/capability/pipeline';

async function runGoldenE2ETest() {
  console.log('===============================================================');
  console.log('MAKKARI AI: #1 GOLDEN END-TO-END REGRESSION TEST');
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

  const userPrompt = 'create a glamorphism cartoon type colorful login page in one single html file using html css js and show preview';

  // STEP 1: Intent & Output Contract
  console.log('\n--- STEP 1: Intent & Output Contract Extraction ---');
  const contract = buildOutputContract(userPrompt);
  assert(contract.fileMode === 'single-file', 'File mode is single-file');
  assert(contract.explicitFramework === 'none', 'Explicit framework is none');
  assert(contract.forbiddenSkills.includes('nextjs'), 'nextjs skill is forbidden');
  assert(contract.forbiddenSkills.includes('react'), 'react skill is forbidden');
  assert(contract.requiresPreview === true, 'Preview is required');

  // STEP 2: Capability Resolution & Skill Conflict Blocking
  console.log('\n--- STEP 2: Capability Resolution & Skill Blocking ---');
  const resolved = await resolveTurnCapabilities({
    userPrompt,
    modelId: 'openai/gpt-oss-120b',
    providerId: 'groq',
  });

  assert(!resolved.activeSkillNames.includes('nextjs'), 'nextjs is blocked from active skills');
  assert(!resolved.activeSkillNames.includes('react'), 'react is blocked from active skills');
  assert(resolved.systemPromptAdditions.includes('<output_contract>'), 'Output contract is in system prompt');

  // STEP 3: Stateful Tool Protocol Interception (0% Leakage)
  console.log('\n--- STEP 3: Stateful Tool Protocol Interception ---');
  const parser = new StatefulToolProtocolParser();
  const rawProviderOutput = `Here is your login page:
<dots_function_call>
<invoke name="makkari_artifact">
<parameter name="action">create</parameter>
<parameter name="title">Glamorphism Cartoon Login</parameter>
<parameter name="filename">index.html</parameter>
<parameter name="content"><!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cartoon Login</title>
  <style>
    body { background: linear-gradient(135deg, #FF6B6B, #4ECDC4); }
    .glass { background: rgba(255,255,255,0.25); backdrop-filter: blur(10px); border-radius: 24px; }
  </style>
</head>
<body>
  <div class="glass">
    <h2>Welcome Back!</h2>
    <input type="text" placeholder="Username" />
    <button id="btn">Login</button>
  </div>
  <script>
    document.getElementById('btn').addEventListener('click', () => alert('Welcome!'));
  </script>
</body>
</html></parameter>
</invoke>
</dots_function_call>
Enjoy your colorful login page!`;

  const parseRes = parser.processChunk(rawProviderOutput);
  const flushed = parser.flush();

  const totalText = (parseRes.textDelta || '') + (flushed.textDelta || '');
  const allToolCalls = [...parseRes.completedToolCalls, ...flushed.completedToolCalls];

  assert(!totalText.includes('<dots_function_call>'), 'Zero <dots_function_call> in visible text');
  assert(!totalText.includes('<invoke'), 'Zero <invoke> in visible text');
  assert(!totalText.includes('<!DOCTYPE'), 'HTML code not dumped as raw text');
  assert(allToolCalls.length === 1, 'Exactly one completed tool call captured');
  assert(allToolCalls[0].name === 'makkari_artifact', 'Tool call is makkari_artifact');
  assert(allToolCalls[0].parameters.filename === 'index.html', 'Filename normalized to index.html');

  // STEP 4: Canonical Event Bus Emission & Sequencing
  console.log('\n--- STEP 4: Canonical Event Bus Emission ---');
  const envelopes: any[] = [];
  const eventBus = new CanonicalEventBus('chat_golden_test', (env) => envelopes.push(env));

  eventBus.emit({ type: 'STREAM_START' });
  eventBus.emit({ type: 'THINKING_START' });
  eventBus.emit({ type: 'THINKING_STATUS', status: 'Creating workspace artifact...' });
  eventBus.emit({
    type: 'ARTIFACT_CREATE',
    artifact: {
      artifactId: 'art_golden',
      title: 'Glamorphism Cartoon Login',
      artifactType: 'web',
      version: 1,
      files: [
        {
          filename: 'index.html',
          language: 'html',
          mimeType: 'text/html',
          sizeBytes: (allToolCalls[0].parameters.content as string).length,
          content: allToolCalls[0].parameters.content as string,
          isEntryFile: true,
        },
      ],
    },
  });
  eventBus.emit({ type: 'TEXT_DELTA', delta: 'Enjoy your colorful login page!' });
  eventBus.emit({ type: 'DONE' });

  assert(envelopes.length === 6, 'Exactly 6 canonical envelopes emitted');
  assert(envelopes.every((e, i) => e.sequence === i + 1), 'Strict monotonic sequence (1..6) verified');
  assert(envelopes[0].event.type === 'STREAM_START', 'First event is STREAM_START');
  assert(envelopes[envelopes.length - 1].event.type === 'DONE', 'Terminal event is DONE');
  assert(eventBus.isTerminal(), 'Event bus is in terminal state');

  console.log('\n===============================================================');
  console.log(`GOLDEN E2E TEST COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runGoldenE2ETest().catch((err) => {
  console.error(err);
  process.exit(1);
});
