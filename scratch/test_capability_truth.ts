import { resolveRuntimeCapabilities } from '../lib/ai/capability/truth-layer';
import { resolveTurnCapabilities } from '../lib/ai/capability/pipeline';

async function runCapabilityTruthTests() {
  console.log('===============================================================');
  console.log('MAKKARI AI: CAPABILITY & TOOL TRUTH LAYER TEST SUITE');
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

  // TEST 1: Canva disconnected truth
  console.log('\n--- TEST 1: Disconnected Canva MCP Handling ---');
  const res1 = await resolveRuntimeCapabilities({
    modelId: 'openai/gpt-oss-120b',
    providerId: 'groq',
    prompt: 'Create a 1080x1080 Canva poster for Shreeji E-Bike World',
  });

  assert(res1.disconnectedServices.some((s) => s.id === 'canva-mcp'), 'Canva MCP correctly classified as disconnected');
  assert(!res1.executableTools.some((t) => t.id.includes('canva')), 'Canva tools are NOT exposed as executable');
  assert(res1.promptManifest.includes('DISCONNECTED'), 'Prompt manifest contains explicit DISCONNECTED guidance');
  assert(res1.promptManifest.includes('Never pretend or hallucinate that you executed a Canva MCP tool'), 'Strict anti-hallucination instruction is present');

  // TEST 2: General tool question truth
  console.log('\n--- TEST 2: General Tool Question Capability Truth ---');
  const res2 = await resolveTurnCapabilities({
    userPrompt: 'which tool you know and also mcp canva',
    modelId: 'openai/gpt-oss-120b',
    providerId: 'groq',
  });

  assert(res2.activeTools.some((t) => t.name === 'makkari_artifact' || t.id === 'artifact'), 'Native makkari_artifact is active');
  assert(res2.activeTools.some((t) => t.id === 'calculator'), 'Native calculator is active');
  assert(!res2.activeTools.some((t) => t.id.includes('canva')), 'Canva is NOT in activeTools because status is disconnected');
  assert(res2.systemPromptAdditions.includes('DISCONNECTED'), 'System prompt clearly states disconnected services');

  // TEST 3: Text-only model disables executable tools
  console.log('\n--- TEST 3: Text-only Model Disables Executable Tools ---');
  const res3 = await resolveRuntimeCapabilities({
    modelId: 'simple-text-model',
    providerId: 'groq',
    prompt: 'Generate an artifact',
    modelCapabilities: {
      nativeTools: false,
      textToolProtocol: false,
    },
  });

  assert(res3.executableTools.length === 0, 'No tools exposed when model has no native or text tool capability');
  assert(!res3.supportsTools, 'supportsTools is false');
  assert(res3.promptManifest.includes('<available_executable_tools>NONE</available_executable_tools>'), 'Manifest reports NONE');

  console.log('\n===============================================================');
  console.log(`CAPABILITY TRUTH TEST SUITE COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runCapabilityTruthTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
