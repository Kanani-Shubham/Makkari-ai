import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/chats/[id]/messages — Load messages for specific chat thread
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const chatId = resolvedParams.id;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ messages: [] });
    }

    const { data, error } = await supabase
      .from('messages')
      .select('id, chat_id, role, content, model_id, provider_id, created_at')
      .eq('chat_id', chatId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[MESSAGES_GET] Supabase messages query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[MESSAGES_GET] Loaded ${data.length} messages for chat:`, chatId);

    const messages = data.map((m) => ({
      id: m.id,
      chat_id: m.chat_id,
      role: m.role,
      content: m.content,
      model_id: m.model_id,
      provider_id: m.provider_id,
      created_at: m.created_at,
    }));

    return NextResponse.json({ messages });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[MESSAGES_GET] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/chats/[id]/messages — Insert user/assistant message into Supabase
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const chatId = resolvedParams.id;

    const body = await req.json();
    const { role, content, modelId, providerId } = body;

    if (!role || content === undefined) {
      return NextResponse.json({ error: 'Role and content are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('[MESSAGES_POST] Saving message for chat:', chatId, 'Role:', role);

    // Ensure parent chat row exists in public.chats before inserting message
    const { data: existingChat } = await supabase
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existingChat) {
      console.log('[MESSAGES_POST] Auto-creating parent chat row for id:', chatId);
      await supabase.from('chats').upsert(
        {
          id: chatId,
          user_id: user.id,
          title: 'New Conversation',
          title_source: 'auto',
          provider_id: providerId || 'gemini',
          model_id: modelId || 'gemini-2.0-flash',
          pinned_at: null,
          is_pinned: false,
          is_archived: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }

    const insertPayload = {
      chat_id: chatId,
      user_id: user.id,
      role,
      content,
      model_id: modelId || null,
      provider_id: providerId || null,
      token_count: { prompt: 0, completion: 0, total: 0 },
      attachments: [],
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('messages').insert(insertPayload).select().single();

    if (error) {
      console.error('[MESSAGES_POST] Supabase insert message error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also update parent chat updated_at timestamp
    await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId)
      .eq('user_id', user.id);

    console.log('[MESSAGES_POST] Saved message successfully:', data.id);

    return NextResponse.json({ message: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[MESSAGES_POST] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/chats/[id]/messages — Delete message from Supabase
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID required' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('[MESSAGES_DELETE] Deleting message:', messageId);

    const { error } = await supabase.from('messages').delete().eq('id', messageId).eq('user_id', user.id);

    if (error) {
      console.error('[MESSAGES_DELETE] Supabase message delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[MESSAGES_DELETE] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
