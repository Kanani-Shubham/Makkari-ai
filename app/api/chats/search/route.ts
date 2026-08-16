import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface SearchItem {
  type: 'chat' | 'message';
  chatId: string;
  title: string;
  snippet?: string;
  isPinned: boolean;
  updatedAt: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim() || '';

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!query) {
      // If query is empty, return top 10 recent chats
      const { data: recentChats } = await supabase
        .from('chats')
        .select('id, title, pinned_at, is_pinned, updated_at')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })
        .limit(10);

      const results: SearchItem[] = (recentChats || []).map((c) => ({
        type: 'chat',
        chatId: c.id,
        title: c.title || 'Untitled Conversation',
        isPinned: c.pinned_at !== null || !!c.is_pinned,
        updatedAt: c.updated_at,
      }));

      return NextResponse.json({ results });
    }

    // 1. Search Chat Titles using full-text and pattern matching
    const { data: matchingChats, error: chatError } = await supabase
      .from('chats')
      .select('id, title, pinned_at, is_pinned, updated_at')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .ilike('title', `%${query}%`)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (chatError) {
      console.error('[SEARCH_API] Error searching chat titles:', chatError);
    }

    // 2. Search Message Content with user ownership validation
    const { data: matchingMessages, error: msgError } = await supabase
      .from('messages')
      .select('id, chat_id, content, created_at, chats!inner(id, title, pinned_at, is_pinned, user_id)')
      .eq('chats.user_id', user.id)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(15);

    if (msgError) {
      console.error('[SEARCH_API] Error searching messages:', msgError);
    }

    const results: SearchItem[] = [];
    const seenChatIds = new Set<string>();

    // Add matching chat titles
    if (matchingChats) {
      for (const c of matchingChats) {
        results.push({
          type: 'chat',
          chatId: c.id,
          title: c.title,
          isPinned: c.pinned_at !== null || !!c.is_pinned,
          updatedAt: c.updated_at,
        });
        seenChatIds.add(c.id);
      }
    }

    // Add matching message snippets
    if (matchingMessages) {
      for (const m of matchingMessages) {
        const chat = Array.isArray(m.chats) ? m.chats[0] : m.chats;
        if (!chat) continue;

        // Generate snippet around match
        const contentStr = m.content || '';
        const matchIdx = contentStr.toLowerCase().indexOf(query.toLowerCase());
        let snippet = contentStr;
        if (matchIdx !== -1) {
          const start = Math.max(0, matchIdx - 40);
          const end = Math.min(contentStr.length, matchIdx + query.length + 60);
          snippet = (start > 0 ? '...' : '') + contentStr.slice(start, end).trim() + (end < contentStr.length ? '...' : '');
        } else {
          snippet = contentStr.slice(0, 100) + '...';
        }

        results.push({
          type: 'message',
          chatId: chat.id,
          title: chat.title || 'Conversation',
          snippet,
          isPinned: chat.pinned_at !== null || !!chat.is_pinned,
          updatedAt: m.created_at,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SEARCH_API] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
