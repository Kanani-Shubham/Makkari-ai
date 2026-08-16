import { create } from 'zustand';
import { ChatMessage, ProviderId } from '@/lib/ai/types';
import { generateChatTitle } from '@/lib/ai/title-generator';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface ChatThread {
  id: string;
  title: string;
  providerId: ProviderId;
  modelId: string;
  pinnedAt: string | null;
  isPinned: boolean; // Computed or legacy compatibility
  titleSource?: 'auto' | 'user';
  createdAt: string;
  updatedAt: string;
}

export interface TimelineGroupedChats {
  pinned: ChatThread[];
  today: ChatThread[];
  yesterday: ChatThread[];
  previous7Days: ChatThread[];
  older: ChatThread[];
}

/**
 * Categorizes chat threads into temporal timeline buckets.
 */
export function groupChatsByTimeline(chats: ChatThread[]): TimelineGroupedChats {
  const pinned: ChatThread[] = [];
  const today: ChatThread[] = [];
  const yesterday: ChatThread[] = [];
  const previous7Days: ChatThread[] = [];
  const older: ChatThread[] = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOf7DaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

  for (const chat of chats) {
    if (chat.pinnedAt !== null || chat.isPinned) {
      pinned.push(chat);
      continue;
    }

    const chatTime = new Date(chat.updatedAt || chat.createdAt).getTime();

    if (chatTime >= startOfToday) {
      today.push(chat);
    } else if (chatTime >= startOfYesterday) {
      yesterday.push(chat);
    } else if (chatTime >= startOf7DaysAgo) {
      previous7Days.push(chat);
    } else {
      older.push(chat);
    }
  }

  return { pinned, today, yesterday, previous7Days, older };
}

interface ChatStoreState {
  activeChatId: string | null;
  chats: ChatThread[];
  messages: Record<string, ChatMessage[]>;
  isStreaming: boolean;
  streamingContent: string;
  streamingReasoning: string;
  reasoningStartTime: number | null;
  reasoningDurationMs: number | null;
  systemPrompt: string;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  activeAbortController: AbortController | null;
  pinErrorMessage: string | null;
  setPinErrorMessage: (msg: string | null) => void;
  setActiveChat: (chatId: string | null) => void;
  loadChatsFromSupabase: () => Promise<void>;
  loadMessagesFromSupabase: (chatId: string) => Promise<void>;
  createNewChat: (providerId: ProviderId, modelId: string, initialTitle?: string) => Promise<string>;
  addMessage: (chatId: string, message: ChatMessage) => Promise<string>;
  upsertMessage: (chatId: string, message: ChatMessage) => void;
  updateStreamingMessage: (chatId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  saveAssistantMessage: (
    chatId: string,
    content: string,
    providerId?: ProviderId,
    modelId?: string,
    metadata?: Record<string, unknown>,
    messageId?: string
  ) => Promise<void>;
  updateLastAssistantMessage: (chatId: string, content: string, reasoning?: string, durationMs?: number) => void;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  togglePinChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  renameChat: (chatId: string, newTitle: string) => Promise<void>;
  updateChatModel: (chatId: string, providerId: ProviderId, modelId: string) => Promise<void>;
  setIsStreaming: (streaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  setStreamingReasoning: (reasoning: string) => void;
  setSystemPrompt: (prompt: string) => void;
  abortCurrentStream: () => void;
  setActiveAbortController: (ctrl: AbortController | null) => void;
}



export const useChatStore = create<ChatStoreState>((set, get) => ({
  activeChatId: null,
  chats: [],
  messages: {},
  isStreaming: false,
  streamingContent: '',
  streamingReasoning: '',
  reasoningStartTime: null,
  reasoningDurationMs: null,
  systemPrompt: '',
  isLoadingChats: false,
  isLoadingMessages: false,
  activeAbortController: null,
  pinErrorMessage: null,

  setPinErrorMessage: (msg) => set({ pinErrorMessage: msg }),

  setActiveChat: (chatId) => set({ activeChatId: chatId }),

  abortCurrentStream: () => {
    const { activeAbortController } = get();
    if (activeAbortController) {
      activeAbortController.abort();
      set({ activeAbortController: null, isStreaming: false });
    }
  },

  setActiveAbortController: (ctrl) => set({ activeAbortController: ctrl }),

  // 1. Fetch all chats from Supabase
  loadChatsFromSupabase: async () => {
    set({ isLoadingChats: true });
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.chats)) {
            const normalizedChats: ChatThread[] = data.chats.map((c: { id: string; title: string; providerId: ProviderId; modelId: string; pinnedAt?: string | null; isPinned?: boolean; titleSource?: 'auto' | 'user'; createdAt: string; updatedAt: string }) => ({
              ...c,
              pinnedAt: c.pinnedAt ?? (c.isPinned ? new Date().toISOString() : null),
              isPinned: c.pinnedAt !== null || !!c.isPinned,
              titleSource: c.titleSource || 'auto',
            }));
            set({ chats: normalizedChats });
          }
        }
      }
    } catch (err) {
      console.error('[CHAT_STORE] Error loading conversations from Supabase:', err);
    } finally {
      set({ isLoadingChats: false });
    }
  },

  // 2. Fetch messages for thread from Supabase
  loadMessagesFromSupabase: async (chatId: string) => {
    if (!chatId) return;
    set({ isLoadingMessages: true });
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.messages)) {
            set((state) => ({
              messages: { ...state.messages, [chatId]: data.messages },
            }));
          }
        }
      }
    } catch (err) {
      console.error('[CHAT_STORE] Error loading messages for chat:', chatId, err);
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  // 3. Create new chat thread in Supabase
  createNewChat: async (providerId, modelId, initialTitle = 'New Conversation') => {
    const tempId = generateUUID();
    const newChat: ChatThread = {
      id: tempId,
      title: initialTitle,
      providerId,
      modelId,
      pinnedAt: null,
      isPinned: false,
      titleSource: 'auto',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic UI update
    set((state) => ({
      chats: [newChat, ...state.chats],
      activeChatId: tempId,
      messages: { ...state.messages, [tempId]: [] },
    }));

    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tempId,
          title: initialTitle,
          providerId,
          modelId,
        }),
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (data.chat) {
            set((state) => ({
              chats: state.chats.map((c) => (c.id === tempId ? {
                ...data.chat,
                pinnedAt: data.chat.pinnedAt ?? null,
                isPinned: data.chat.pinnedAt !== null || !!data.chat.isPinned,
              } : c)),
              activeChatId: data.chat.id,
            }));
            return data.chat.id;
          }
        }
      }
    } catch (err) {
      console.error('[CHAT_STORE] Failed to insert new chat in Supabase:', err);
    }

    return tempId;
  },

  // 4. Upsert Message in client state (ID-based reconciliation)
  upsertMessage: (chatId, message) => {
    set((state) => {
      const chatMsgs = state.messages[chatId] || [];
      const msgId = message.id || generateUUID();
      const existingIdx = chatMsgs.findIndex((m) => m.id === msgId);

      if (existingIdx !== -1) {
        const updated = [...chatMsgs];
        updated[existingIdx] = {
          ...updated[existingIdx],
          ...message,
          id: msgId,
        };
        return { messages: { ...state.messages, [chatId]: updated } };
      }

      return {
        messages: {
          ...state.messages,
          [chatId]: [
            ...chatMsgs,
            { ...message, id: msgId, created_at: message.created_at || new Date().toISOString() },
          ],
        },
      };
    });
  },

  // 5. Update streaming message in-place by exact message ID
  updateStreamingMessage: (chatId, messageId, updates) => {
    set((state) => {
      const chatMsgs = state.messages[chatId] || [];
      const idx = chatMsgs.findIndex((m) => m.id === messageId);
      if (idx === -1) {
        return {
          messages: {
            ...state.messages,
            [chatId]: [
              ...chatMsgs,
              {
                id: messageId,
                role: 'assistant',
                content: '',
                created_at: new Date().toISOString(),
                ...updates,
              } as ChatMessage,
            ],
          },
        };
      }

      const updated = [...chatMsgs];
      const existing = updated[idx];
      const existingMetadata = existing.metadata || {};
      const newMetadata = updates.metadata ? { ...existingMetadata, ...updates.metadata } : existingMetadata;

      updated[idx] = {
        ...existing,
        ...updates,
        metadata: newMetadata,
      };

      return { messages: { ...state.messages, [chatId]: updated } };
    });
  },

  // 6. Add User/Assistant Message and persist to Supabase
  addMessage: async (chatId, message) => {
    const tempMsgId = message.id || generateUUID();
    const fullMsg: ChatMessage = { ...message, id: tempMsgId, created_at: new Date().toISOString() };

    // Optimistic update using ID-based upsert
    set((state) => {
      const chatMsgs = state.messages[chatId] || [];
      const existingIdx = chatMsgs.findIndex((m) => m.id === tempMsgId);
      if (existingIdx !== -1) {
        const updated = [...chatMsgs];
        updated[existingIdx] = fullMsg;
        return { messages: { ...state.messages, [chatId]: updated } };
      }
      return {
        messages: {
          ...state.messages,
          [chatId]: [...chatMsgs, fullMsg],
        },
      };
    });

    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tempMsgId,
          role: message.role,
          content: message.content,
          modelId: message.model_id,
          providerId: message.provider_id,
          attachments: message.attachments,
          metadata: message.metadata,
        }),
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (data.message) {
            const realId = data.message.id;
            set((state) => ({
              messages: {
                ...state.messages,
                [chatId]: (state.messages[chatId] || []).map((m) =>
                  m.id === tempMsgId ? { ...m, id: realId } : m
                ),
              },
            }));

            // Automatic title generation only if titleSource is 'auto'
            const currentChat = get().chats.find((c) => c.id === chatId);
            if (
              currentChat &&
              currentChat.titleSource !== 'user' &&
              (currentChat.title === 'New Chat' || currentChat.title === 'New Conversation') &&
              message.role === 'user'
            ) {
              const autoTitle = generateChatTitle(message.content);
              get().renameChat(chatId, autoTitle);
            }

            return realId;
          }
        }
      }
    } catch (err) {
      console.error('[CHAT_STORE] Failed to persist message in Supabase:', err);
    }

    return tempMsgId;
  },

  // 7. Update last assistant message during stream with reasoning and content
  updateLastAssistantMessage: (chatId, content, reasoning, durationMs) => {
    set((state) => {
      const chatMsgs = state.messages[chatId] || [];
      if (chatMsgs.length === 0) return state;

      const lastIndex = chatMsgs.length - 1;
      const lastMsg = chatMsgs[lastIndex];

      if (lastMsg.role === 'assistant') {
        const updatedMsgs = [...chatMsgs];
        const existingMetadata = lastMsg.metadata || {};

        updatedMsgs[lastIndex] = {
          ...lastMsg,
          content,
          metadata: reasoning
            ? {
                ...existingMetadata,
                reasoning: {
                  available: true,
                  summary: reasoning,
                  durationMs: durationMs || existingMetadata.reasoning?.durationMs,
                  provider: lastMsg.provider_id,
                },
              }
            : existingMetadata,
        };

        return { messages: { ...state.messages, [chatId]: updatedMsgs } };
      }

      return state;
    });
  },

  // 8. Save Assistant Message into Supabase after stream completes
  saveAssistantMessage: async (chatId, content, providerId, modelId, metadata, messageId) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: messageId,
          role: 'assistant',
          content,
          providerId,
          modelId,
          metadata,
        }),
      });

      if (res.ok && messageId) {
        const data = await res.json().catch(() => ({}));
        if (data.message?.id && data.message.id !== messageId) {
          set((state) => ({
            messages: {
              ...state.messages,
              [chatId]: (state.messages[chatId] || []).map((m) =>
                m.id === messageId ? { ...m, id: data.message.id } : m
              ),
            },
          }));
        }
      }
    } catch (err) {
      console.error('[CHAT_STORE] Error saving assistant response to Supabase:', err);
    }
  },


  // 7. Delete Message from Supabase
  deleteMessage: async (chatId, messageId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).filter((m) => m.id !== messageId),
      },
    }));

    try {
      await fetch(`/api/chats/${chatId}/messages?messageId=${messageId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('[CHAT_STORE] Failed to delete message from Supabase:', err);
    }
  },

  // 8. Toggle Pin Chat with Server 10-Pin Validation
  togglePinChat: async (chatId) => {
    const currentChat = get().chats.find((c) => c.id === chatId);
    if (!currentChat) return;

    const isCurrentlyPinned = currentChat.pinnedAt !== null || currentChat.isPinned;
    const optimisticPinnedAt = isCurrentlyPinned ? null : new Date().toISOString();

    // Optimistic update
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, pinnedAt: optimisticPinnedAt, isPinned: !isCurrentlyPinned } : c
      ),
    }));

    try {
      const res = await fetch(`/api/chats/${chatId}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: !isCurrentlyPinned }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // Revert optimistic update
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId ? { ...c, pinnedAt: currentChat.pinnedAt, isPinned: isCurrentlyPinned } : c
          ),
          pinErrorMessage: data.message || 'Maximum 10 pinned chats reached. Unpin a chat to pin another.',
        }));

        // Auto-dismiss warning after 4s
        setTimeout(() => {
          set({ pinErrorMessage: null });
        }, 4000);
        return;
      }

      set((state) => ({
        chats: state.chats.map((c) =>
          c.id === chatId
            ? { ...c, pinnedAt: data.pinned ? new Date().toISOString() : null, isPinned: data.pinned }
            : c
        ),
      }));
    } catch (err) {
      console.error('[CHAT_STORE] Failed to toggle pin on server:', err);
      // Revert on network failure
      set((state) => ({
        chats: state.chats.map((c) =>
          c.id === chatId ? { ...c, pinnedAt: currentChat.pinnedAt, isPinned: isCurrentlyPinned } : c
        ),
      }));
    }
  },

  // 9. Delete Chat from Supabase
  deleteChat: async (chatId) => {
    set((state) => {
      const remainingChats = state.chats.filter((c) => c.id !== chatId);
      const nextActiveId = state.activeChatId === chatId ? (remainingChats[0]?.id || null) : state.activeChatId;
      const updatedMessages = { ...state.messages };
      delete updatedMessages[chatId];

      return {
        chats: remainingChats,
        activeChatId: nextActiveId,
        messages: updatedMessages,
      };
    });

    try {
      await fetch(`/api/chats?id=${chatId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('[CHAT_STORE] Failed to delete chat from Supabase:', err);
    }
  },

  // 10. Rename Chat with Title Ownership Rule
  renameChat: async (chatId, newTitle) => {
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, title: newTitle, titleSource: 'user' } : c
      ),
    }));

    try {
      await fetch('/api/chats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: chatId,
          title: newTitle,
          title_source: 'user', // Protect user-renamed title from AI overwrite
        }),
      });
    } catch (err) {
      console.error('[CHAT_STORE] Failed to rename chat in Supabase:', err);
    }
  },

  updateChatModel: async (chatId: string, providerId: ProviderId, modelId: string) => {
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, providerId, modelId, updatedAt: new Date().toISOString() } : c
      ),
    }));

    try {
      await fetch('/api/chats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: chatId,
          providerId,
          modelId,
        }),
      });
    } catch (err) {
      console.error('[CHAT_STORE] Failed to update chat model in Supabase:', err);
    }
  },

  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setStreamingContent: (streamingContent) => set({ streamingContent }),
  setStreamingReasoning: (streamingReasoning) => set({ streamingReasoning }),
  setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
}));
