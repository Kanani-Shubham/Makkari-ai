'use client';

import React, { useState } from 'react';
import { Menu, Plus, Search } from 'lucide-react';
import { MakkariLogo } from '@/components/brand/makkari-logo';
import { useAuthStore } from '@/lib/store/use-auth-store';
import { useChatStore } from '@/lib/store/use-chat-store';
import { useModelStore } from '@/lib/store/use-model-store';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { CommandPalette } from '@/components/layout/command-palette';
import Link from 'next/link';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { createNewChat, chats, activeChatId } = useChatStore();
  const { selectedProvider, selectedModel } = useModelStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleNewChat = async () => {
    const newId = await createNewChat(selectedProvider, selectedModel);
    router.push(`/chat/${newId}`);
  };

  const currentChat = chats.find((c) => c.id === activeChatId || pathname === `/chat/${c.id}`);

  return (
    <>
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      <header className="h-14 border-b border-[#E8E5E0] dark:border-[#2E2E2E] bg-[#F7F6F3]/90 dark:bg-[#121212]/90 backdrop-blur-xs flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle Navigation Sidebar"
            className="p-2 rounded-2xl border border-[#E8E5E0] dark:border-[#2E2E2E] bg-white dark:bg-[#1E1E1E] text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] md:hidden cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 truncate">
            {currentChat ? (
              <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] tracking-tight truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                {currentChat.title}
              </span>
            ) : (
              <MakkariLogo variant="horizontal" size="sm" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Search Button in Header */}
          <button
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search Chats (⌘K)"
            className="p-2 rounded-2xl border border-[#E8E5E0] dark:border-[#2E2E2E] bg-white dark:bg-[#1E1E1E] text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] shadow-2xs transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-[#E8E5E0] dark:border-[#2E2E2E] bg-white dark:bg-[#1E1E1E] text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] shadow-2xs transition-all cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4 text-[#D97757]" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          <Link href="/profile" className="ml-1 shrink-0" aria-label="User Profile">
            <Avatar src={user?.avatar_url} name={user?.full_name} size="sm" />
          </Link>
        </div>
      </header>
    </>
  );
}
