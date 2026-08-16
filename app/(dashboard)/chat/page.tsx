'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/store/use-chat-store';
import { useModelStore } from '@/lib/store/use-model-store';

export default function ChatIndexPage() {
  const router = useRouter();
  const { createNewChat } = useChatStore();
  const { selectedProvider, selectedModel } = useModelStore();

  useEffect(() => {
    let mounted = true;
    async function initChat() {
      const newId = await createNewChat(selectedProvider, selectedModel);
      if (mounted) {
        router.replace(`/chat/${newId}`);
      }
    }
    initChat();
    return () => {
      mounted = false;
    };
  }, [createNewChat, selectedProvider, selectedModel, router]);

  return (
    <div className="h-full flex items-center justify-center p-8 text-[#6B6B6B]">
      <span className="text-xs animate-pulse">Initializing new chat session...</span>
    </div>
  );
}
