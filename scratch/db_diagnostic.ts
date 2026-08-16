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

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('--- SUPABASE ENVIRONMENT AUDIT ---');
console.log('URL:', supabaseUrl);
console.log('Anon Key length:', supabaseAnonKey.length);
console.log('Service Key length:', supabaseServiceKey.length);

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = supabaseServiceKey && !supabaseServiceKey.includes('demo')
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

async function runDiagnostic() {
  console.log('\n--- TESTING DATABASE TABLES & SCHEMAS ---');

  const tables = [
    'profiles',
    'user_settings',
    'chats',
    'messages',
    'user_api_keys',
    'model_providers',
    'user_memory_settings',
    'conversation_summaries',
    'user_memories',
    'post_chat_jobs',
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabaseAnon
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ Table [${table}]: ERROR - ${error.code} | ${error.message}`);
      } else {
        console.log(`✅ Table [${table}]: EXISTS | Row count: ${count ?? 0}`);
      }
    } catch (e: any) {
      console.log(`❌ Table [${table}]: EXCEPTION - ${e.message}`);
    }
  }

  console.log('\n--- TESTING AUTH STATUS ---');
  try {
    const { data: authData, error: authError } = await supabaseAnon.auth.getSession();
    console.log('Session status:', authError ? `Error: ${authError.message}` : authData?.session ? 'Active session' : 'No active session (anonymous)');
  } catch (e: any) {
    console.log('Auth exception:', e.message);
  }
}

runDiagnostic().catch(console.error);
