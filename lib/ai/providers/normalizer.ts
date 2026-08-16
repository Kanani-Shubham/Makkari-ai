/**
 * MAKKARI AI — Provider Normalizer (Phase 4 Stub)
 *
 * Phase 3: No normalization needed — all providers use text tool protocol.
 * Tool results sent as role:'user' messages with <tool_result> XML.
 *
 * Phase 4.5: This module will convert RuntimeMessage[] into provider-native formats:
 *   - OpenAI/Groq:    role:'tool' + tool_call_id
 *   - Anthropic:      role:'user' + content:[{type:'tool_result', tool_use_id}]
 *   - Gemini:         role:'function' + functionResponse parts
 *   - OpenRouter:     pass-through to underlying model
 *   - Ollama:         text protocol fallback
 */

import { ProviderId } from '@/lib/ai/types';

/**
 * Phase 3 stub — returns messages unchanged.
 * Phase 4.5: converts RuntimeMessage[] to provider-native format.
 */
export function normalizeMessagesForProvider(
  _providerId: ProviderId,
  messages: any[]
): any[] {
  // Phase 3: pass-through (text protocol works for all providers)
  return messages;
}

/**
 * Returns the tool result message format for a provider.
 * Phase 3: All providers receive tool results as role:'user' text.
 * Phase 4.5: Returns provider-native format.
 */
export function getToolResultRole(_providerId: ProviderId): 'user' | 'tool' {
  // Phase 3: always 'user' (text protocol)
  return 'user';
}
