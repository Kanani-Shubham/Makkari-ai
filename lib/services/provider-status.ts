import { ProviderId } from '@/lib/ai/types';
import { createClient } from '@/lib/supabase/server';

export interface ProviderStatusInfo {
  providerId: ProviderId;
  name: string;
  type: 'local' | 'cloud';
  status: 'active' | 'configured' | 'missing' | 'invalid' | 'disabled';
  keyHint?: string;
  lastUpdated?: string;
}

/**
 * Audit and retrieve status configuration for a single AI provider or all providers.
 */
export async function getProviderStatus(userId?: string): Promise<Record<ProviderId, ProviderStatusInfo>> {
  const result: Record<ProviderId, ProviderStatusInfo> = {
    gemini: { providerId: 'gemini', name: 'Google Gemini', type: 'cloud', status: 'missing' },
    groq: { providerId: 'groq', name: 'Groq Cloud', type: 'cloud', status: 'missing' },
    ollama: { providerId: 'ollama', name: 'Ollama (Local AI)', type: 'local', status: 'active' },
    openai: { providerId: 'openai', name: 'OpenAI', type: 'cloud', status: 'missing' },
    anthropic: { providerId: 'anthropic', name: 'Anthropic', type: 'cloud', status: 'missing' },
    openrouter: { providerId: 'openrouter', name: 'OpenRouter', type: 'cloud', status: 'missing' },
  };

  // 1. Process Environment Variable Fallback check
  if (process.env.GROQ_API_KEY) {
    result.groq.status = 'active';
    result.groq.keyHint = 'env_var';
  }
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    result.gemini.status = 'active';
    result.gemini.keyHint = 'env_var';
  }
  if (process.env.OPENAI_API_KEY) {
    result.openai.status = 'active';
    result.openai.keyHint = 'env_var';
  }
  if (process.env.ANTHROPIC_API_KEY) {
    result.anthropic.status = 'active';
    result.anthropic.keyHint = 'env_var';
  }
  if (process.env.OPENROUTER_API_KEY) {
    result.openrouter.status = 'active';
    result.openrouter.keyHint = 'env_var';
  }

  // 2. Query Supabase User API Keys if userId is provided
  if (userId) {
    try {
      const supabase = await createClient();
      console.log(`[PROVIDER_STATUS] Auditing DB user_api_keys for user: ${userId}`);
      const { data: keys, error } = await supabase
        .from('user_api_keys')
        .select('provider, key_hint, updated_at, is_valid')
        .eq('user_id', userId);

      if (error) {
        console.error('[PROVIDER_STATUS] DB Query Error:', error.message);
      } else if (keys && keys.length > 0) {
        keys.forEach((key) => {
          const prov = key.provider as ProviderId;
          if (result[prov]) {
            result[prov].status = key.is_valid ? 'active' : 'invalid';
            result[prov].keyHint = key.key_hint;
            result[prov].lastUpdated = key.updated_at;
          }
        });
      }
    } catch (err) {
      console.error('[PROVIDER_STATUS] DB Connection Exception:', err);
    }
  }

  return result;
}
