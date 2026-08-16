import { CANONICAL_FALLBACK_MODELS, getProviderModels, getClosestFallbackModel } from '../lib/ai/discovery-service';
import { MakkariModel } from '../lib/ai/types';

async function runModelRegistryTests() {
  console.log('===============================================================');
  console.log('MAKKARI AI: MODEL REGISTRY & COMPATIBILITY TEST SUITE');
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

  // TEST 1: Fallback models are defined for all major cloud providers
  console.log('\n--- TEST 1: Canonical Fallback Catalog Presence ---');
  assert(CANONICAL_FALLBACK_MODELS.gemini.length > 0, 'Gemini fallback models present');
  assert(CANONICAL_FALLBACK_MODELS.groq.length > 0, 'Groq fallback models present');
  assert(CANONICAL_FALLBACK_MODELS.openrouter.length > 0, 'OpenRouter fallback models present');
  assert(CANONICAL_FALLBACK_MODELS.openai.length > 0, 'OpenAI fallback models present');
  assert(CANONICAL_FALLBACK_MODELS.anthropic.length > 0, 'Anthropic fallback models present');

  // TEST 2: Active model ID validation (No deprecated 2.5 flash in canonical catalog)
  console.log('\n--- TEST 2: Valid Active Model IDs ---');
  const geminiModels = CANONICAL_FALLBACK_MODELS.gemini;
  assert(!geminiModels.some((m) => m.id === 'gemini-2.5-flash'), 'Deprecated gemini-2.5-flash is not in catalog');
  assert(geminiModels.some((m) => m.id === 'gemini-2.0-flash'), 'Active gemini-2.0-flash is present');

  // TEST 3: Fallback selection resolver
  console.log('\n--- TEST 3: Fallback Selection Resolver ---');
  const fallback = getClosestFallbackModel('gemini-2.5-flash', geminiModels);
  assert(fallback !== null && fallback.id === 'gemini-2.0-flash', 'Deprecated gemini-2.5-flash falls back to gemini-2.0-flash');

  console.log('\n===============================================================');
  console.log(`MODEL REGISTRY TEST COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runModelRegistryTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
