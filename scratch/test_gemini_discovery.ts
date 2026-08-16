import { GeminiAdapter } from '../lib/ai/providers/gemini';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    envVars[key] = val;
  }
});

const geminiKey = envVars.GEMINI_API_KEY || envVars.GOOGLE_API_KEY || '';

async function testGemini() {
  console.log('Testing Gemini API key:', geminiKey ? `${geminiKey.slice(0, 8)}...` : '(NO KEY)');

  const adapter = new GeminiAdapter();
  const models = await adapter.discoverModels(geminiKey);

  console.log(`Discovered ${models.length} Gemini model(s):`);
  models.forEach((m) => {
    console.log(`- ID: "${m.id}", Display: "${m.displayName}", Capabilities:`, m.capabilities.reasoning?.supported ? 'Reasoning' : 'Standard');
  });

  // Also query Google models endpoint directly
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
      console.log('\nDirect API Status:', res.status);
      const json = await res.json();
      console.log('Direct API models count:', json.models?.length || 0);
      if (json.models) {
        console.log('Available models from Google:');
        json.models.slice(0, 15).forEach((m: any) => console.log('  *', m.name, '| methods:', m.supportedGenerationMethods?.join(', ')));
      }
    } catch (err) {
      console.error('Direct fetch error:', err);
    }
  }
}

testGemini().catch(console.error);
