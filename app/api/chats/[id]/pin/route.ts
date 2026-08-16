import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params;
    const body = await req.json().catch(() => ({}));
    const { pin } = body; // boolean or undefined to toggle

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // First fetch current chat status
    const { data: chat, error: fetchError } = await supabase
      .from('chats')
      .select('id, pinned_at, is_pinned')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !chat) {
      return NextResponse.json({ error: 'Chat not found or unauthorized' }, { status: 404 });
    }

    const shouldPin = pin !== undefined ? pin : chat.pinned_at === null;

    if (shouldPin) {
      // Check current pinned count for user (Max 10)
      const { count, error: countError } = await supabase
        .from('chats')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('pinned_at', 'is', null);

      if (countError) {
        console.error('[PIN_API] Error counting pinned chats:', countError);
      }

      if ((count || 0) >= 10) {
        return NextResponse.json(
          {
            success: false,
            error: 'MAX_PINS_REACHED',
            message: 'Maximum 10 pinned chats reached. Unpin a chat to pin another.',
          },
          { status: 400 }
        );
      }

      const { data: updated, error: updateError } = await supabase
        .from('chats')
        .update({
          pinned_at: new Date().toISOString(),
          is_pinned: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', chatId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, pinned: true, chat: updated });
    } else {
      const { data: updated, error: updateError } = await supabase
        .from('chats')
        .update({
          pinned_at: null,
          is_pinned: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', chatId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, pinned: false, chat: updated });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[PIN_API] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
