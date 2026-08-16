import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 1. GET /api/chats — Fetch user's chats from Supabase
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[CHATS_GET] No authenticated user found.');
      return NextResponse.json({ chats: [] });
    }

    const { data, error } = await supabase
      .from('chats')
      .select('id, title, provider_id, model_id, pinned_at, is_pinned, title_source, is_archived, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[CHATS_GET] Supabase query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[CHATS_GET] Loaded ${data.length} chats for user:`, user.id);

    const chatsMap = data.map((c) => ({
      id: c.id,
      title: c.title,
      providerId: c.provider_id,
      modelId: c.model_id,
      pinnedAt: c.pinned_at,
      isPinned: c.pinned_at !== null || !!c.is_pinned,
      titleSource: c.title_source || 'auto',
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return NextResponse.json({ chats: chatsMap });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[CHATS_GET] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// 2. POST /api/chats — Create new chat in Supabase
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title = 'New Conversation', providerId = 'gemini', modelId = 'gemini-1.5-flash' } = body;



    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[CHATS_POST] Auth required to create chat.');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('[CHATS_POST] Creating chat for user:', user.id, 'Title:', title);

    const isValidUuid = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const chatId = isValidUuid ? id : crypto.randomUUID();

    const insertPayload = {
      id: chatId,
      user_id: user.id,
      title,
      title_source: 'auto',
      provider_id: providerId,
      model_id: modelId,
      pinned_at: null,
      is_pinned: false,
      is_archived: false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('chats').upsert(insertPayload).select().single();

    if (error) {
      console.error('[CHATS_POST] Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[CHATS_POST] Created chat successfully:', data.id);

    return NextResponse.json({
      chat: {
        id: data.id,
        title: data.title,
        providerId: data.provider_id,
        modelId: data.model_id,
        pinnedAt: data.pinned_at,
        isPinned: data.pinned_at !== null || !!data.is_pinned,
        titleSource: data.title_source,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[CHATS_POST] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// 3. PATCH /api/chats — Update chat title or pinned status in Supabase
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, title_source, isPinned, pinnedAt, providerId, modelId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Chat ID required' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) updatePayload.title = title;
    if (title_source !== undefined) updatePayload.title_source = title_source;
    if (providerId !== undefined) updatePayload.provider_id = providerId;
    if (modelId !== undefined) updatePayload.model_id = modelId;
    if (pinnedAt !== undefined) {
      updatePayload.pinned_at = pinnedAt;
      updatePayload.is_pinned = pinnedAt !== null;
    } else if (isPinned !== undefined) {
      updatePayload.is_pinned = isPinned;
      updatePayload.pinned_at = isPinned ? new Date().toISOString() : null;
    }


    console.log('[CHATS_PATCH] Updating chat:', id, updatePayload);

    const { data, error } = await supabase
      .from('chats')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[CHATS_PATCH] Supabase update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, chat: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[CHATS_PATCH] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// 4. DELETE /api/chats — Delete chat from Supabase
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Chat ID required' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('[CHATS_DELETE] Deleting chat:', id, 'User:', user.id);

    const { error } = await supabase.from('chats').delete().eq('id', id).eq('user_id', user.id);

    if (error) {
      console.error('[CHATS_DELETE] Supabase delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[CHATS_DELETE] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
