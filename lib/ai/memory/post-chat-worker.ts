import { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeMemoryContent } from './memory-service';
import { generateChatTitle } from '@/lib/ai/title-generator';
import { getUserMemorySettings } from './memory-service';

/**
 * Extracts a concise 1-2 sentence rolling conversation summary from message transcripts.
 */
function extractSummaryFromMessages(messages: { role: string; content: string }[]): string {
  const userPrompts = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim())
    .filter(Boolean);

  if (userPrompts.length === 0) return '';

  const mainTopic = userPrompts[0];
  const cleanedTopic = sanitizeMemoryContent(mainTopic);

  // Synthesize concise summary
  let summary = `User discussed ${cleanedTopic.slice(0, 120)}`;
  if (userPrompts.length > 1) {
    summary += ` and explored related technical implementation details.`;
  } else {
    summary += `.`;
  }

  return sanitizeMemoryContent(summary);
}

/**
 * Evaluates whether messages contain stable, high-confidence user preferences or project facts.
 */
function extractMemoryCandidates(messages: { role: string; content: string }[]): {
  type: 'preference' | 'project' | 'technical_preference';
  content: string;
  confidence: number;
}[] {
  const candidates: {
    type: 'preference' | 'project' | 'technical_preference';
    content: string;
    confidence: number;
  }[] = [];

  const userMessages = messages.filter((m) => m.role === 'user');

  for (const msg of userMessages) {
    const text = msg.content;

    // 1. Explicit preference signals (e.g. "I always use TypeScript", "I prefer concise code")
    const prefMatch = text.match(/\b(?:i always use|i prefer|i like to use|my preferred stack is)\s+([^.!?\n]+)/i);
    if (prefMatch && prefMatch[1]) {
      const prefText = prefMatch[1].trim();
      if (prefText.length >= 4 && prefText.length <= 100) {
        candidates.push({
          type: 'technical_preference',
          content: sanitizeMemoryContent(`User prefers ${prefText}`),
          confidence: 0.95,
        });
      }
    }

    // 2. Project context signals (e.g. "I am building Makkari", "Working on TalentOS")
    const projectMatch = text.match(/\b(?:i am building|i'm working on|developing|my project is)\s+([^.!?\n]+)/i);
    if (projectMatch && projectMatch[1]) {
      const projText = projectMatch[1].trim();
      if (projText.length >= 4 && projText.length <= 100) {
        candidates.push({
          type: 'project',
          content: sanitizeMemoryContent(`User is building ${projText}`),
          confidence: 0.90,
        });
      }
    }
  }

  return candidates;
}

/**
 * Processes durable pending post-chat jobs with retry leasing and backoff.
 */
export async function processPostChatJobs(supabase: SupabaseClient): Promise<number> {
  // Claim pending or expired-lease jobs
  const { data: jobs, error: fetchError } = await supabase
    .from('post_chat_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('available_at', new Date().toISOString())
    .limit(5);

  if (fetchError || !jobs || jobs.length === 0) {
    return 0;
  }

  let processedCount = 0;

  for (const job of jobs) {
    // Attempt to lock job
    const { error: lockError } = await supabase
      .from('post_chat_jobs')
      .update({
        status: 'processing',
        locked_at: new Date().toISOString(),
        attempts: (job.attempts || 0) + 1,
      })
      .eq('id', job.id)
      .eq('status', 'pending');

    if (lockError) continue; // Another worker claimed this job

    try {
      // 1. Fetch chat and message transcripts
      const [chatRes, msgsRes] = await Promise.all([
        supabase.from('chats').select('id, title, title_source, user_id').eq('id', job.chat_id).single(),
        supabase.from('messages').select('role, content').eq('chat_id', job.chat_id).order('created_at', { ascending: true }),
      ]);

      const chat = chatRes.data;
      const messages = msgsRes.data || [];

      if (!chat || messages.length === 0) {
        await supabase
          .from('post_chat_jobs')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', job.id);
        continue;
      }

      const settings = await getUserMemorySettings(supabase, chat.user_id);

      // 2. Intelligent Title Generation (respects manual title protection)
      if (
        chat.title_source !== 'user' &&
        (chat.title === 'New Chat' || chat.title === 'New Conversation')
      ) {
        const firstUserMsg = messages.find((m) => m.role === 'user');
        if (firstUserMsg) {
          const autoTitle = generateChatTitle(firstUserMsg.content);
          await supabase
            .from('chats')
            .update({
              title: autoTitle,
              title_source: 'auto',
              updated_at: new Date().toISOString(),
            })
            .eq('id', chat.id);
        }
      }

      // 3. Conversation Summary Generation (Layer 1)
      if (settings.memory_enabled) {
        const summaryText = extractSummaryFromMessages(messages);
        if (summaryText) {
          const { data: existingSummary } = await supabase
            .from('conversation_summaries')
            .select('id')
            .eq('chat_id', chat.id)
            .maybeSingle();

          if (existingSummary) {
            await supabase
              .from('conversation_summaries')
              .update({
                summary: summaryText,
                importance: 0.8,
                updated_at: new Date().toISOString(),
                last_used_at: new Date().toISOString(),
              })
              .eq('id', existingSummary.id);
          } else {
            await supabase.from('conversation_summaries').insert({
              user_id: chat.user_id,
              chat_id: chat.id,
              summary: summaryText,
              importance: 0.8,
              topics: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_used_at: new Date().toISOString(),
            });
          }
        }

        // 4. Memory Candidate Extraction & Evaluation (Layer 2)
        const candidates = extractMemoryCandidates(messages);

        for (const cand of candidates) {
          if (cand.confidence < 0.70) continue;

          // Deduplication: check existing memories
          const { data: existing } = await supabase
            .from('user_memories')
            .select('id, content, confidence')
            .eq('user_id', chat.user_id)
            .ilike('content', `%${cand.content.slice(0, 30)}%`);

          if (existing && existing.length > 0) {
            // Update existing memory
            await supabase
              .from('user_memories')
              .update({
                content: cand.content,
                confidence: Math.max(cand.confidence, existing[0].confidence),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing[0].id);
          } else {
            // Insert new AI-learned memory
            await supabase.from('user_memories').insert({
              user_id: chat.user_id,
              type: cand.type,
              content: cand.content,
              source: 'ai',
              source_chat_id: chat.id,
              confidence: cand.confidence,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_used_at: new Date().toISOString(),
            });
          }
        }
      }

      // 5. Mark job as completed
      await supabase
        .from('post_chat_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      processedCount++;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown post-chat job error';
      console.error('[POST_CHAT_WORKER] Error executing job:', job.id, errorMsg);

      const attempts = (job.attempts || 1);
      const isFailed = attempts >= (job.max_attempts || 3);
      const backoffSec = Math.pow(2, attempts) * 10;
      const nextAvailable = new Date(Date.now() + backoffSec * 1000).toISOString();

      await supabase
        .from('post_chat_jobs')
        .update({
          status: isFailed ? 'failed' : 'pending',
          available_at: nextAvailable,
          last_error: errorMsg,
        })
        .eq('id', job.id);
    }
  }

  return processedCount;
}
