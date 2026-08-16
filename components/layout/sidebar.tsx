'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  MessageSquare,
  Plus,
  Pin,
  Cpu,
  Settings,
  Search,
  Trash2,
  Edit2,
  X,
  FolderKanban,
  Loader2,
  MoreHorizontal,
  AlertCircle,
} from 'lucide-react';
import { MakkariLogo } from '@/components/brand/makkari-logo';
import { useChatStore, ChatThread, groupChatsByTimeline } from '@/lib/store/use-chat-store';
import { useModelStore } from '@/lib/store/use-model-store';
import { AccountMenu } from '@/components/layout/account-menu';
import { CommandPalette } from '@/components/layout/command-palette';
import { useAuthStore } from '@/lib/store/use-auth-store';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    chats,
    activeChatId,
    setActiveChat,
    createNewChat,
    togglePinChat,
    deleteChat,
    renameChat,
    loadChatsFromSupabase,
    isLoadingChats,
    pinErrorMessage,
    setPinErrorMessage,
  } = useChatStore();
  const { selectedProvider, selectedModel } = useModelStore();

  const [isSearchPaletteOpen, setIsSearchPaletteOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    loadChatsFromSupabase();
  }, [loadChatsFromSupabase]);

  // Global Cmd+K keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleNewChat = async () => {
    const newId = await createNewChat(selectedProvider, selectedModel);
    router.push(`/chat/${newId}`);
    onClose();
  };

  const handleSaveRename = (chatId: string) => {
    if (editingTitle.trim()) {
      renameChat(chatId, editingTitle.trim());
    }
    setEditingChatId(null);
  };

  const timelineGroups = groupChatsByTimeline(chats);
  const pinnedCount = timelineGroups.pinned.length;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-2xs md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Global Command Palette Search */}
      <CommandPalette
        isOpen={isSearchPaletteOpen}
        onClose={() => setIsSearchPaletteOpen(false)}
      />

      <aside
        suppressHydrationWarning
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 w-72 sm:w-80 bg-[#F7F6F3] dark:bg-[#181818] border-r border-[#E8E5E0] dark:border-[#2E2E2E] flex flex-col justify-between transition-transform duration-300 ease-in-out select-none',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Top Header & New Chat Bar */}
        <div className="p-3.5 flex flex-col gap-3" suppressHydrationWarning>
          <div className="flex items-center justify-between">
            <Link href="/" className="px-1 group">
              <MakkariLogo variant="horizontal" size="md" />
            </Link>
            <button
              suppressHydrationWarning
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] md:hidden cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            suppressHydrationWarning
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#D97757] text-white text-xs sm:text-sm font-semibold hover:bg-[#C66345] shadow-xs hover:shadow-sm transition-all active:scale-[0.98] cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Chat</span>
          </button>

          {/* Search Trigger Button with ⌘K Badge */}
          <button
            suppressHydrationWarning
            onClick={() => setIsSearchPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs bg-white dark:bg-[#222222] border border-[#E8E5E0] dark:border-[#2E2E2E] rounded-2xl text-[#6B6B6B] dark:text-[#9E9E9E] hover:border-[#D97757]/40 hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] transition-all cursor-pointer min-h-[38px]"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#6B6B6B] dark:text-[#9E9E9E]" />
              <span>Search chats...</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded-md bg-[#F7F6F3] dark:bg-[#2E2E2E] border border-[#E8E5E0] dark:border-[#3A3A3A] font-mono text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E]">
              ⌘K
            </kbd>

          </button>

          {/* 10-Pin Limit Warning Toast */}
          {pinErrorMessage && (
            <div className="p-2.5 bg-[#D97757]/10 border border-[#D97757]/30 text-[#D97757] text-[11px] rounded-2xl flex items-start justify-between gap-2 animate-in fade-in duration-200">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{pinErrorMessage}</span>
              </div>
              <button
                onClick={() => setPinErrorMessage(null)}
                className="text-[#D97757] hover:opacity-80 shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Chat Threads List with Timeline Buckets */}
        <div className="flex-1 overflow-y-auto px-3 space-y-4">
          {/* Workspaces Block */}
          <div>
            <div className="px-3 text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-[#D97757]" />
              Workspace
            </div>
            <div className="px-3 py-2 rounded-2xl bg-white/60 dark:bg-[#222222]/60 border border-[#E8E5E0] dark:border-[#2E2E2E] text-xs text-[#6B6B6B] dark:text-[#9E9E9E] flex items-center justify-between">
              <span className="truncate font-medium">
                {user?.full_name ? `${user.full_name}'s Space` : 'Personal Space'}
              </span>
              <span className="text-[10px] text-[#D97757] font-semibold bg-[#D97757]/10 px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
          </div>

          {isLoadingChats ? (
            <div className="px-4 py-8 text-center text-xs text-[#6B6B6B] dark:text-[#9E9E9E] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#D97757]" />
              <span>Loading conversations...</span>
            </div>
          ) : (
            <>
              {/* PINNED SECTION (Max 10) */}
              {pinnedCount > 0 && (
                <div>
                  <div className="px-3 text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Pin className="w-3 h-3 text-[#D97757]" />
                      Pinned
                    </span>
                    <span className="text-[9px] text-[#9E9E9E] font-mono">{pinnedCount}/10</span>
                  </div>
                  <div className="space-y-0.5">
                    {timelineGroups.pinned.map((chat) => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isActive={activeChatId === chat.id || pathname === `/chat/${chat.id}`}
                        editingChatId={editingChatId}
                        editingTitle={editingTitle}
                        setEditingTitle={setEditingTitle}
                        onSelect={() => {
                          setActiveChat(chat.id);
                          router.push(`/chat/${chat.id}`);
                          onClose();
                        }}
                        onPin={() => togglePinChat(chat.id)}
                        onDelete={() => deleteChat(chat.id)}
                        onStartRename={() => {
                          setEditingChatId(chat.id);
                          setEditingTitle(chat.title);
                        }}
                        onSaveRename={() => handleSaveRename(chat.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* TIMELINE GROUP: TODAY */}
              {timelineGroups.today.length > 0 && (
                <div>
                  <div className="px-3 text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] uppercase tracking-wider mb-1">
                    Today
                  </div>
                  <div className="space-y-0.5">
                    {timelineGroups.today.map((chat) => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isActive={activeChatId === chat.id || pathname === `/chat/${chat.id}`}
                        editingChatId={editingChatId}
                        editingTitle={editingTitle}
                        setEditingTitle={setEditingTitle}
                        onSelect={() => {
                          setActiveChat(chat.id);
                          router.push(`/chat/${chat.id}`);
                          onClose();
                        }}
                        onPin={() => togglePinChat(chat.id)}
                        onDelete={() => deleteChat(chat.id)}
                        onStartRename={() => {
                          setEditingChatId(chat.id);
                          setEditingTitle(chat.title);
                        }}
                        onSaveRename={() => handleSaveRename(chat.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* TIMELINE GROUP: YESTERDAY */}
              {timelineGroups.yesterday.length > 0 && (
                <div>
                  <div className="px-3 text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] uppercase tracking-wider mb-1">
                    Yesterday
                  </div>
                  <div className="space-y-0.5">
                    {timelineGroups.yesterday.map((chat) => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isActive={activeChatId === chat.id || pathname === `/chat/${chat.id}`}
                        editingChatId={editingChatId}
                        editingTitle={editingTitle}
                        setEditingTitle={setEditingTitle}
                        onSelect={() => {
                          setActiveChat(chat.id);
                          router.push(`/chat/${chat.id}`);
                          onClose();
                        }}
                        onPin={() => togglePinChat(chat.id)}
                        onDelete={() => deleteChat(chat.id)}
                        onStartRename={() => {
                          setEditingChatId(chat.id);
                          setEditingTitle(chat.title);
                        }}
                        onSaveRename={() => handleSaveRename(chat.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* TIMELINE GROUP: PREVIOUS 7 DAYS */}
              {timelineGroups.previous7Days.length > 0 && (
                <div>
                  <div className="px-3 text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] uppercase tracking-wider mb-1">
                    Previous 7 Days
                  </div>
                  <div className="space-y-0.5">
                    {timelineGroups.previous7Days.map((chat) => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isActive={activeChatId === chat.id || pathname === `/chat/${chat.id}`}
                        editingChatId={editingChatId}
                        editingTitle={editingTitle}
                        setEditingTitle={setEditingTitle}
                        onSelect={() => {
                          setActiveChat(chat.id);
                          router.push(`/chat/${chat.id}`);
                          onClose();
                        }}
                        onPin={() => togglePinChat(chat.id)}
                        onDelete={() => deleteChat(chat.id)}
                        onStartRename={() => {
                          setEditingChatId(chat.id);
                          setEditingTitle(chat.title);
                        }}
                        onSaveRename={() => handleSaveRename(chat.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* TIMELINE GROUP: OLDER */}
              {timelineGroups.older.length > 0 && (
                <div>
                  <div className="px-3 text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] uppercase tracking-wider mb-1">
                    Older
                  </div>
                  <div className="space-y-0.5">
                    {timelineGroups.older.map((chat) => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isActive={activeChatId === chat.id || pathname === `/chat/${chat.id}`}
                        editingChatId={editingChatId}
                        editingTitle={editingTitle}
                        setEditingTitle={setEditingTitle}
                        onSelect={() => {
                          setActiveChat(chat.id);
                          router.push(`/chat/${chat.id}`);
                          onClose();
                        }}
                        onPin={() => togglePinChat(chat.id)}
                        onDelete={() => deleteChat(chat.id)}
                        onStartRename={() => {
                          setEditingChatId(chat.id);
                          setEditingTitle(chat.title);
                        }}
                        onSaveRename={() => handleSaveRename(chat.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* EMPTY STATE */}
              {chats.length === 0 && (
                <div className="px-3 py-6 text-xs text-[#9E9E9E] italic text-center">
                  No conversations yet. Start a new chat above.
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Section: Model Hub, Settings & Account Popover */}
        <div className="p-3 border-t border-[#E8E5E0] dark:border-[#2E2E2E] space-y-1.5">
          <Link
            href="/models"
            onClick={onClose}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-2xl transition-colors min-h-[38px]',
              pathname === '/models'
                ? 'bg-white dark:bg-[#242424] text-[#D97757] font-semibold border border-[#E8E5E0] dark:border-[#2E2E2E]'
                : 'text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#242424]'
            )}
          >
            <Cpu className="w-4 h-4 text-[#D97757]" />
            <span>Model Hub & BYOK</span>
          </Link>

          <Link
            href="/settings"
            onClick={onClose}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-2xl transition-colors min-h-[38px]',
              pathname === '/settings'
                ? 'bg-white dark:bg-[#242424] text-[#D97757] font-semibold border border-[#E8E5E0] dark:border-[#2E2E2E]'
                : 'text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#242424]'
            )}
          >
            <Settings className="w-4 h-4 text-[#6B6B6B] dark:text-[#9E9E9E]" />
            <span>Settings</span>
          </Link>

          {/* Account Popover Menu */}
          <AccountMenu onNavigate={onClose} />
        </div>
      </aside>
    </>
  );
}

interface ChatItemProps {
  chat: ChatThread;
  isActive: boolean;
  editingChatId: string | null;
  editingTitle: string;
  setEditingTitle: (t: string) => void;
  onSelect: () => void;
  onPin: () => void;
  onDelete: () => void;
  onStartRename: () => void;
  onSaveRename: () => void;
}

function ChatItem({
  chat,
  isActive,
  editingChatId,
  editingTitle,
  setEditingTitle,
  onSelect,
  onPin,
  onDelete,
  onStartRename,
  onSaveRename,
}: ChatItemProps) {
  const [showTouchMenu, setShowTouchMenu] = useState(false);
  const isEditing = editingChatId === chat.id;
  const isPinned = chat.pinnedAt !== null || chat.isPinned;

  if (isEditing) {
    return (
      <div className="px-2.5 py-1.5 flex items-center gap-1.5 bg-white dark:bg-[#242424] border border-[#D97757] rounded-2xl shadow-2xs">
        <input
          type="text"
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSaveRename();
            if (e.key === 'Escape') setEditingTitle(chat.title);
          }}
          autoFocus
          className="w-full text-xs bg-transparent focus:outline-none text-[#1A1A1A] dark:text-[#E5E5E5]"
        />
        <button
          onClick={onSaveRename}
          className="text-xs text-[#D97757] font-semibold px-1.5 py-0.5 hover:underline cursor-pointer"
        >
          Save
        </button>
      </div>
    );
  }

  return (
    <div className="relative group">
      <div
        onClick={onSelect}
        className={cn(
          'flex items-center justify-between px-3 py-2 text-xs rounded-2xl transition-all cursor-pointer select-none min-h-[38px]',
          isActive
            ? 'bg-white dark:bg-[#242424] text-[#1A1A1A] dark:text-[#E5E5E5] font-semibold border border-[#E8E5E0] dark:border-[#2E2E2E] shadow-2xs'
            : 'text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6]/70 dark:hover:bg-[#242424]/70'
        )}
      >
        <div className="flex items-center gap-2.5 truncate pr-2">
          {isPinned ? (
            <Pin className="w-3.5 h-3.5 shrink-0 text-[#D97757]" />
          ) : (
            <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[#6B6B6B] dark:text-[#9E9E9E] group-hover:text-[#D97757]" />
          )}
          <span className="truncate">{chat.title}</span>
        </div>

        {/* Desktop Hover Actions Menu */}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            title={isPinned ? 'Unpin' : 'Pin (Max 10)'}
            className="p-1 rounded-lg text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#D97757] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Pin className={cn('w-3 h-3', isPinned && 'fill-[#D97757] text-[#D97757]')} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartRename();
            }}
            title="Rename"
            className="p-1 rounded-lg text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
            className="p-1 rounded-lg text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#C94B4B] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Mobile Touch Three-Dots Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowTouchMenu(!showTouchMenu);
          }}
          className="md:hidden p-1 rounded-lg text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#1A1A1A] shrink-0"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile Touch Action Popover */}
      {showTouchMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="md:hidden absolute right-2 top-full mt-1 bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] rounded-2xl shadow-lg p-1.5 z-40 flex items-center gap-2"
        >
          <button
            onClick={() => {
              setShowTouchMenu(false);
              onPin();
            }}
            className="p-2 text-xs flex items-center gap-1 text-[#1A1A1A] dark:text-[#E5E5E5]"
          >
            <Pin className="w-3.5 h-3.5 text-[#D97757]" />
            <span>{isPinned ? 'Unpin' : 'Pin'}</span>
          </button>
          <button
            onClick={() => {
              setShowTouchMenu(false);
              onStartRename();
            }}
            className="p-2 text-xs flex items-center gap-1 text-[#1A1A1A] dark:text-[#E5E5E5]"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Rename</span>
          </button>
          <button
            onClick={() => {
              setShowTouchMenu(false);
              onDelete();
            }}
            className="p-2 text-xs flex items-center gap-1 text-[#C94B4B]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
