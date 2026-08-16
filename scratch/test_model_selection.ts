import assert from 'node:assert';
import { GeminiAdapter } from '../lib/ai/providers/gemini';
import { GroqAdapter } from '../lib/ai/providers/groq';
import { OllamaAdapter } from '../lib/ai/providers/ollama';
import { OpenAIAdapter } from '../lib/ai/providers/openai';
import { AnthropicAdapter } from '../lib/ai/providers/anthropic';
import { OpenRouterAdapter } from '../lib/ai/providers/openrouter';

async function runModelSelectionTestSuite() {
  console.log('===============================================================');
  console.log('  MAKKARI MODEL SWITCHING & SELECTION PRESERVATION TEST SUITE');
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

  const originalFetch = globalThis.fetch;

  try {
    // 1. Gemini Switch Test
    console.log('[1/6] Testing Gemini Model Selection Passthrough...');
    let requestedGeminiUrl = '';
    globalThis.fetch = (async (url: any) => {
      requestedGeminiUrl = String(url);
      return new Response('data: {}\n\n', { status: 200 });
    }) as any;

    const gemini = new GeminiAdapter();
    const it1 = gemini.streamChat({
      chatId: 'test-gemini-select',
      modelId: 'gemini-2.5-pro',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }],
    });
    for await (const _ of it1) break;

    test('Gemini adapter sends exact requested model "gemini-2.5-pro"', requestedGeminiUrl.includes('models/gemini-2.5-pro:streamGenerateContent'));

    // 2. Groq Switch Test
    console.log('\n[2/6] Testing Groq Model Selection Passthrough...');
    let requestedGroqBody: any = null;
    globalThis.fetch = (async (_: any, opts: any) => {
      requestedGroqBody = JSON.parse(opts.body);
      return new Response('data: {}\n\n', { status: 200 });
    }) as any;

    const groq = new GroqAdapter();
    const it2 = groq.streamChat({
      chatId: 'test-groq-select',
      modelId: 'llama-3.1-8b-instant',
      apiKey: 'test-groq-key',
      messages: [{ role: 'user', content: 'hello' }],
    });
    for await (const _ of it2) break;

    test('Groq adapter sends exact requested model "llama-3.1-8b-instant"', requestedGroqBody?.model === 'llama-3.1-8b-instant');

    // 3. Ollama Switch Test
    console.log('\n[3/6] Testing Ollama Local Model Selection Passthrough...');
    let requestedOllamaBody: any = null;
    globalThis.fetch = (async (_: any, opts: any) => {
      requestedOllamaBody = JSON.parse(opts.body);
      return new Response('{"message": {"content": "ok"}, "done": true}\n', { status: 200 });
    }) as any;

    const ollama = new OllamaAdapter();
    const it3 = ollama.streamChat({
      chatId: 'test-ollama-select',
      modelId: 'qwen2.5:14b',
      messages: [{ role: 'user', content: 'hello' }],
    });
    for await (const _ of it3) break;

    test('Ollama adapter sends exact requested local model "qwen2.5:14b"', requestedOllamaBody?.model === 'qwen2.5:14b');

    // 4. OpenAI Switch Test
    console.log('\n[4/6] Testing OpenAI Model Selection Passthrough...');
    let requestedOpenAIBody: any = null;
    globalThis.fetch = (async (_: any, opts: any) => {
      requestedOpenAIBody = JSON.parse(opts.body);
      return new Response('data: {}\n\n', { status: 200 });
    }) as any;

    const openai = new OpenAIAdapter();
    const it4 = openai.streamChat({
      chatId: 'test-openai-select',
      modelId: 'gpt-4o-mini',
      apiKey: 'test-openai-key',
      messages: [{ role: 'user', content: 'hello' }],
    });
    for await (const _ of it4) break;

    test('OpenAI adapter sends exact requested model "gpt-4o-mini"', requestedOpenAIBody?.model === 'gpt-4o-mini');

    // 5. Anthropic Switch Test
    console.log('\n[5/6] Testing Anthropic Model Selection Passthrough...');
    let requestedAnthropicBody: any = null;
    globalThis.fetch = (async (_: any, opts: any) => {
      requestedAnthropicBody = JSON.parse(opts.body);
      return new Response('event: message_start\ndata: {}\n\n', { status: 200 });
    }) as any;

    const anthropic = new AnthropicAdapter();
    const it5 = anthropic.streamChat({
      chatId: 'test-anthropic-select',
      modelId: 'claude-3-5-haiku-latest',
      apiKey: 'test-anthropic-key',
      messages: [{ role: 'user', content: 'hello' }],
    });
    for await (const _ of it5) break;

    test('Anthropic adapter sends exact requested model "claude-3-5-haiku-latest"', requestedAnthropicBody?.model === 'claude-3-5-haiku-latest');

    // 6. OpenRouter Switch Test
    console.log('\n[6/6] Testing OpenRouter Model Selection Passthrough...');
    let requestedOpenRouterBody: any = null;
    globalThis.fetch = (async (_: any, opts: any) => {
      requestedOpenRouterBody = JSON.parse(opts.body);
      return new Response('data: {}\n\n', { status: 200 });
    }) as any;

    const openrouter = new OpenRouterAdapter();
    const it6 = openrouter.streamChat({
      chatId: 'test-openrouter-select',
      modelId: 'deepseek/deepseek-r1',
      apiKey: 'test-openrouter-key',
      messages: [{ role: 'user', content: 'hello' }],
    });
    for await (const _ of it6) break;

    test('OpenRouter adapter sends exact requested model "deepseek/deepseek-r1"', requestedOpenRouterBody?.model === 'deepseek/deepseek-r1');
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('\n===============================================================');
  console.log(`  ALL ${passed}/${total} MODEL SELECTION & SWITCHING TESTS PASSED!`);
  console.log('===============================================================\n');
}

runModelSelectionTestSuite().catch((err) => {
  console.error('\nModel selection test suite failed:', err);
  process.exit(1);
});
