import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptKey } from '@/lib/ai/encryption';
import { getProviderModels } from '@/lib/ai/discovery-service';
import { getAIProvider } from '@/lib/ai/adapter';
import { ProviderId, MakkariModel, ProviderStatus } from '@/lib/ai/types';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const providerKeys: Partial<Record<ProviderId, string>> = {};

    // 1. Check server environment variables first
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      providerKeys.gemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    }
    if (process.env.GROQ_API_KEY) {
      providerKeys.groq = process.env.GROQ_API_KEY;
    }
    if (process.env.OPENROUTER_API_KEY) {
      providerKeys.openrouter = process.env.OPENROUTER_API_KEY;
    }
    if (process.env.OPENAI_API_KEY) {
      providerKeys.openai = process.env.OPENAI_API_KEY;
    }
    if (process.env.ANTHROPIC_API_KEY) {
      providerKeys.anthropic = process.env.ANTHROPIC_API_KEY;
    }

    // 2. If user is authenticated, check encrypted user_api_keys from Supabase
    if (user) {
      const { data: dbKeys } = await supabase
        .from('user_api_keys')
        .select('provider, encrypted_key, iv, is_valid')
        .eq('user_id', user.id);

      if (dbKeys && Array.isArray(dbKeys)) {
        for (const record of dbKeys) {
          const pId = record.provider as ProviderId;
          if (record.is_valid && record.encrypted_key && record.iv) {
            try {
              const decrypted = await decryptKey(record.encrypted_key, record.iv);
              providerKeys[pId] = decrypted;
            } catch (err) {
              console.warn(`[DISCOVERY_API] Could not decrypt key for provider: ${pId}`, err);
            }
          }
        }
      }
    }

    // 3. Discover models & health for all cloud providers in parallel with independent timeouts
    const cloudProviders: ProviderId[] = ['gemini', 'groq', 'openrouter', 'openai', 'anthropic'];
    const modelsResult: Partial<Record<ProviderId, MakkariModel[]>> = {};
    const statusResult: Partial<Record<ProviderId, ProviderStatus>> = {};

    const startTime = Date.now();

    const results = await Promise.allSettled(
      cloudProviders.map(async (pId) => {
        const apiKey = providerKeys[pId];
        const adapter = getAIProvider(pId);

        // Independent 2.5s timeout per provider
        const timeoutPromise = new Promise<{ models: MakkariModel[]; health: { status: ProviderStatus } }>((_, reject) =>
          setTimeout(() => reject(new Error('Provider discovery timeout')), 2500)
        );

        const discoveryPromise = (async () => {
          // Cache-first discovery: if fresh cache exists, returns in <10ms
          const [discoveredModels, health] = await Promise.all([
            getProviderModels(pId, apiKey, false),
            adapter.healthCheck(apiKey),
          ]);
          return { models: discoveredModels, health };
        })();

        return Promise.race([discoveryPromise, timeoutPromise]).then(({ models, health }) => {
          modelsResult[pId] = models;
          statusResult[pId] = health.status;
        });
      })
    );

    const duration = Date.now() - startTime;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PERF][DISCOVERY] Completed in ${duration}ms`);
    }

    return NextResponse.json({
      success: true,
      models: modelsResult,
      statuses: statusResult,
      timestamp: Date.now(),
      durationMs: duration,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown discovery error';
    console.error('[DISCOVERY_API] Exception:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
