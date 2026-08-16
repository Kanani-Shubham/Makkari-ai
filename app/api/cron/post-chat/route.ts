import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processPostChatJobs } from '@/lib/ai/memory/post-chat-worker';

/**
 * GET /api/cron/post-chat
 * Dedicated endpoint for external crons (Vercel Cron, pg_cron webhook, or detached daemon)
 * to reliably process queued post-chat jobs independent of browser lifecycle.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Validate cron secret if configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
    }

    const supabase = await createClient();
    const processedCount = await processPostChatJobs(supabase);

    return NextResponse.json({
      success: true,
      processedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown cron error';
    console.error('[CRON_POST_CHAT] Processing failure:', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
