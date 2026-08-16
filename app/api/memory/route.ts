import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  listUserMemories,
  createUserMemory,
  clearUserMemories,
  clearAllPersonalization,
} from '@/lib/ai/memory/memory-service';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const memories = await listUserMemories(supabase, user.id);
    return NextResponse.json({ memories });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { type, content, sourceChatId } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Memory content is required' }, { status: 400 });
    }

    // Server strictly enforces source = 'user'
    const memory = await createUserMemory(supabase, user.id, {
      type: type || 'preference',
      content: content.trim(),
      sourceChatId,
    });

    return NextResponse.json({ success: true, memory });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode'); // 'all' for full personalization wipe, otherwise memories only

    if (mode === 'all') {
      await clearAllPersonalization(supabase, user.id);
      return NextResponse.json({ success: true, message: 'All personalization data cleared.' });
    }

    await clearUserMemories(supabase, user.id);
    return NextResponse.json({ success: true, message: 'User memories cleared.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
