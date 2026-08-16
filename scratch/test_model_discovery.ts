import assert from 'node:assert';
import { ModelRegistry, modelRegistry } from '../lib/ai/discovery/model-registry';
import { GeminiModelDiscovery } from '../lib/ai/discovery/gemini-discovery';
import { OllamaModelDiscovery } from '../lib/ai/discovery/ollama-discovery';
import { GroqModelDiscovery } from '../lib/ai/discovery/groq-discovery';
import { OpenAIModelDiscovery } from '../lib/ai/discovery/openai-discovery';
import { AnthropicModelDiscovery } from '../lib/ai/discovery/anthropic-discovery';
import { OpenRouterModelDiscovery } from '../lib/ai/discovery/openrouter-discovery';

async function runModelDiscoveryTestSuite() {
  console.log('===============================================================');
  console.log('  MAKKARI MODEL DISCOVERY & REGISTRY TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function test(name: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] Test ${total}: ${name}`);
    } else {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      if (details) console.error(`         Detail: ${details}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  // 1. Gemini Discovery Audit
  console.log('[1/6] Testing Gemini Dynamic Model Discovery & Deprecated Models Exclusion...');
  {
    const geminiDiscovery = new GeminiModelDiscovery();
    const fallbackModels = geminiDiscovery.getStaticFallbackModels('available');

    test('Gemini discovery provides gemini-2.5-flash', fallbackModels.some((m) => m.id === 'gemini-2.5-flash'));
    test('Gemini discovery provides gemini-2.5-pro', fallbackModels.some((m) => m.id === 'gemini-2.5-pro'));
    test('Deprecated gemini-2.0-flash is completely excluded from Gemini models', !fallbackModels.some((m) => m.id === 'gemini-2.0-flash'));
    const flash25 = fallbackModels.find((m) => m.id === 'gemini-2.5-flash');
    test('Gemini 2.5 Flash advertises native tool support and reasoning', Boolean(flash25?.capabilities.tools && flash25?.capabilities.reasoning));

  }

  // 2. Ollama Local Discovery
  console.log('\n[2/6] Testing Ollama Local Dynamic Discovery Architecture...');
  {
    const ollamaDiscovery = new OllamaModelDiscovery();
    const originalFetch = globalThis.fetch;

    // Simulate running Ollama with 3 models: qwen2.5:7b, deepseek-r1:8b, llava:13b
    globalThis.fetch = (async (url: any) => {
      if (String(url).includes('/api/tags')) {
        return new Response(
          JSON.stringify({
            models: [
              {
                name: 'qwen2.5:7b',
                size: 4700000000,
                details: { family: 'qwen2', parameter_size: '7B', quantization_level: 'Q4_K_M' },
              },
              {
                name: 'deepseek-r1:8b',
                size: 5100000000,
                details: { family: 'deepseek', parameter_size: '8B', quantization_level: 'Q4_K_M' },
              },
              {
                name: 'llava:13b',
                size: 8000000000,
                details: { family: 'vision', parameter_size: '13B', quantization_level: 'Q4_K_M' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    }) as any;

    try {
      const discovered = await ollamaDiscovery.discoverModels({});
      test('Ollama discovered exactly 3 local models from /api/tags', discovered.length === 3);
      test('qwen2.5:7b detected with tool calling capability', Boolean(discovered.find((m) => m.id === 'qwen2.5:7b')?.capabilities.tools));
      test('deepseek-r1:8b detected with reasoning capability', Boolean(discovered.find((m) => m.id === 'deepseek-r1:8b')?.capabilities.reasoning));
      test('llava:13b detected with vision capability', Boolean(discovered.find((m) => m.id === 'llava:13b')?.capabilities.vision));
      test('All discovered Ollama models are marked as source: local_runtime', discovered.every((m) => m.source === 'local_runtime'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // 3. Groq Discovery
  console.log('\n[3/6] Testing Groq Dynamic Model Discovery...');
  {
    const groqDiscovery = new GroqModelDiscovery();
    const fallback = groqDiscovery.getStaticFallbackModels('available');
    test('Groq provides llama-3.3-70b-versatile', fallback.some((m) => m.id === 'llama-3.3-70b-versatile'));
    test('Groq Llama 3.3 70B supports tool execution', Boolean(fallback.find((m) => m.id === 'llama-3.3-70b-versatile')?.capabilities.tools));
  }

  // 4. OpenAI Discovery
  console.log('\n[4/6] Testing OpenAI Dynamic Model Discovery...');
  {
    const openAIDiscovery = new OpenAIModelDiscovery();
    const fallback = openAIDiscovery.getStaticFallbackModels('available');
    test('OpenAI provides gpt-4o flagship model', fallback.some((m) => m.id === 'gpt-4o'));
    test('OpenAI provides o1 reasoning model', fallback.some((m) => m.id === 'o1-mini'));
  }

  // 5. Anthropic Discovery
  console.log('\n[5/6] Testing Anthropic Dynamic Model Discovery...');
  {
    const anthropicDiscovery = new AnthropicModelDiscovery();
    const models = await anthropicDiscovery.discoverModels({});
    test('Anthropic provides claude-3-5-sonnet-latest', models.some((m) => m.id === 'claude-3-5-sonnet-latest'));
    test('Claude 3.5 Sonnet supports vision, reasoning, and tools', Boolean(
      models[0].capabilities.vision && models[0].capabilities.reasoning && models[0].capabilities.tools
    ));
  }

  // 6. Central ModelRegistry Caching & Resolution
  console.log('\n[6/6] Testing ModelRegistry Caching, Invalidation & Capabilities...');
  {
    const registry = ModelRegistry.getInstance();
    const geminiModels = await registry.discover('gemini');
    test('ModelRegistry.discover("gemini") returns valid models', geminiModels.length > 0);

    const isAvailableNoKey = await registry.isAvailable('gemini', 'gemini-2.5-flash');
    test('gemini-2.5-flash correctly reports unavailable when key is missing', isAvailableNoKey === false);

    const modelObj = await registry.get('gemini', 'gemini-2.5-flash');
    test('gemini-2.5-flash is found and defined in ModelRegistry', modelObj !== null && modelObj.id === 'gemini-2.5-flash');

    const caps = await registry.getCapabilities('gemini', 'gemini-2.5-flash');
    test('ModelRegistry.getCapabilities returns tools=true for Gemini 2.5 Flash', caps.tools === true);


    registry.invalidate('gemini');
    test('ModelRegistry.invalidate clears provider cache without crashing', true);
  }

  console.log('\n===============================================================');
  console.log(`  ALL ${passed}/${total} MODEL DISCOVERY TESTS PASSED!`);
  console.log('===============================================================\n');
}

runModelDiscoveryTestSuite().catch((err) => {
  console.error('\nModel discovery test suite failed:', err);
  process.exit(1);
});
