import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testJobEnqueue() {
  console.log('Testing post_chat_jobs insert/upsert query on remote Supabase...');

  const dummyChatId = '00000000-0000-0000-0000-000000000001';
  
  // Test SELECT on post_chat_jobs
  const { data, error } = await supabase
    .from('post_chat_jobs')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error selecting post_chat_jobs:', error);
  } else {
    console.log('Successfully queried post_chat_jobs, rows:', data);
  }
}

testJobEnqueue().catch(console.error);
