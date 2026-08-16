'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, ArrowRight, Clock } from 'lucide-react';
import { MakkariLogo } from '@/components/brand/makkari-logo';
import { useAuthStore } from '@/lib/store/use-auth-store';
import { useChatStore } from '@/lib/store/use-chat-store';
import { useModelStore } from '@/lib/store/use-model-store';
import { ChatBox } from '@/components/chat/chat-box';
import { ActionPills } from '@/components/chat/action-pills';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { chats, createNewChat, addMessage, loadChatsFromSupabase } = useChatStore();
  const { selectedProvider, selectedModel } = useModelStore();

  const [initialPrompt, setInitialPrompt] = useState('');

  useEffect(() => {
    loadChatsFromSupabase();
  }, [loadChatsFromSupabase]);

  const getGreetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleStartChat = async (promptText: string) => {
    const newId = await createNewChat(selectedProvider, selectedModel);
    await addMessage(newId, {
      role: 'user',
      content: promptText,
    });
    router.push(`/chat/${newId}`);
  };

  const recentChats = chats.slice(0, 4);

  return (
    <div className="min-h-full flex flex-col justify-between px-4 py-8 max-w-[800px] mx-auto">
      {/* Greeting Banner */}
      <div className="text-center my-auto space-y-6 pt-6">
        <div className="inline-flex items-center justify-center p-3 rounded-3xl bg-[#D97757]/10 mb-2">
          <MakkariLogo variant="icon" size="lg" />
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[#1A1A1A] dark:text-[#E5E5E5] tracking-tight font-medium">
          {getGreetingTime()}
          {user?.full_name ? (
            <>
              , <span className="text-[#D97757] font-semibold">{user.full_name}</span>
            </>
          ) : null}
        </h1>

        <p className="text-sm text-[#6B6B6B] dark:text-[#9E9E9E] max-w-md mx-auto leading-relaxed font-sans">
          Move at the speed of thought. What would you like to explore today?
        </p>

        {/* Input Box */}
        <div className="pt-2">
          <ChatBox
            onSendMessage={handleStartChat}
            initialValue={initialPrompt}
            placeholder="Ask anything or choose a prompt below..."
          />
        </div>

        {/* Quick Action Pills */}
        <div className="max-w-2xl mx-auto pt-2">
          <ActionPills onSelectPrompt={(p) => setInitialPrompt(p)} />
        </div>
      </div>

      {/* Recent Activity Grid */}
      {recentChats.length > 0 && (
        <div className="mt-12 pt-6 border-t border-[#E8E5E0] dark:border-[#2E2E2E]">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-xs font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#D97757]" />
              Recent Conversations
            </h2>
            {recentChats[0] && (
              <Link
                href={`/chat/${recentChats[0].id}`}
                className="text-xs text-[#D97757] font-medium hover:underline flex items-center gap-1"
              >
                <span>View latest</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentChats.map((chat) => (
              <Card
                key={chat.id}
                onClick={() => router.push(`/chat/${chat.id}`)}
                className="cursor-pointer hover:border-[#D97757]/40 transition-all p-4 flex items-start gap-3 group"
              >
                <div className="p-2.5 rounded-xl bg-[#EFECE6] dark:bg-[#2A2A2A] text-[#6B6B6B] dark:text-[#9E9E9E] group-hover:bg-[#D97757] group-hover:text-white transition-colors shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] truncate group-hover:text-[#D97757] transition-colors">
                    {chat.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E] font-mono">
                      {chat.modelId}
                    </span>
                    <span className="text-[10px] text-[#9E9E9E]">•</span>
                    <span className="text-[10px] text-[#9E9E9E]">{formatDate(chat.updatedAt)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
