'use client';

import React, { useEffect, useRef, useState, use } from 'react';
import { useChatStore, ChatThread } from '@/lib/store/use-chat-store';
import { useArtifactStore } from '@/lib/store/use-artifact-store';
import { MessageItem } from '@/components/chat/message-item';
import { ChatBox } from '@/components/chat/chat-box';
import { ArtifactWorkspace } from '@/components/artifacts/artifact-workspace';
import { ArtifactCard } from '@/components/artifacts/artifact-card';
import { ConversationArtifact, ArtifactFile } from '@/lib/artifacts/types';
import { ChatAttachment, ChatMessage } from '@/lib/ai/types';
import { ArrowLeft, Layers, Zap, AlertCircle, RefreshCw, Loader2, ArrowDown } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArtifactEventPayload } from '@/lib/ai/events/canonical-events';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ChatDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const chatId = resolvedParams.id;

  const {
    chats,
    messages,
    loadMessagesFromSupabase,
    addMessage,
    deleteMessage,
    isStreaming,
    setIsStreaming,
  } = useChatStore();

  const { artifacts, isWorkspaceOpen, openArtifact, addOrUpdateArtifact } = useArtifactStore();

  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [streamingArtifacts, setStreamingArtifacts] = useState<ConversationArtifact[]>([]);
  const [streamError, setStreamError] = useState<{ message: string; code?: string; retryable?: boolean } | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [showNewResponseButton, setShowNewResponseButton] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const autoStreamTriggeredRef = useRef(false);
  const isNearBottomRef = useRef(true);

  const currentChat = chats.find((c: ChatThread) => c.id === chatId);
  const selectedProvider = currentChat?.providerId || 'groq';
  const selectedModel = currentChat?.modelId || 'openai/gpt-oss-120b';

  const chatMessages: ChatMessage[] = messages[chatId] || [];
  const chatArtifacts: ConversationArtifact[] = artifacts[chatId] || [];

  useEffect(() => {
    let mounted = true;
    setIsLoadingMessages(true);
    loadMessagesFromSupabase(chatId).finally(() => {
      if (mounted) {
        setIsLoadingMessages(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [chatId, loadMessagesFromSupabase]);

  // Track bottom distance on scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNear = distanceFromBottom <= 60;
    isNearBottomRef.current = isNear;

    if (isNear) {
      setShowNewResponseButton(false);
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
      setShowNewResponseButton(false);
      isNearBottomRef.current = true;
    }
  };

  // Auto-stream first user message if coming from new chat composer
  useEffect(() => {
    if (
      !autoStreamTriggeredRef.current &&
      !isLoadingMessages &&
      chatMessages.length === 1 &&
      chatMessages[0].role === 'user' &&
      !isStreaming &&
      !streamError
    ) {
      autoStreamTriggeredRef.current = true;
      executeStream(chatMessages[0].content, chatMessages[0].attachments);
    }
  }, [chatMessages, isLoadingMessages, isStreaming, streamError]);

  // Intelligent Auto-scroll
  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } else if (isStreaming && !isNearBottomRef.current) {
      setShowNewResponseButton(true);
    }
  }, [chatMessages.length, isStreaming, streamingContent, streamError]);

  const executeStream = async (userContent: string, attachments?: ChatAttachment[]) => {
    if (isStreaming) return;

    setIsStreaming(true);
    setStreamingContent('');
    setStreamingReasoning('');
    setStreamingArtifacts([]);
    setStreamError(null);
    setShowNewResponseButton(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const startTime = Date.now();
    let accumulatedText = '';
    let accumulatedReasoning = '';
    const turnArtifacts: ConversationArtifact[] = [];

    try {
      const history = (messages[chatId] || []).map((m: ChatMessage) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          chatId,
          messages: history,
          providerId: selectedProvider,
          modelId: selectedModel,
          attachments,
        }),
      });

      if (!response.ok) {
        let errJson: any = null;
        try {
          errJson = await response.json();
        } catch {}
        const errorText = errJson?.message || errJson?.error?.userMessage || errJson?.error?.message || `Stream failed: ${response.statusText}`;
        setStreamError({
          message: errorText,
          code: errJson?.code || errJson?.error?.code,
          retryable: response.status === 429 || response.status >= 500,
        });
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No readable stream available.');

      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const chunk = JSON.parse(dataStr);

              // 1. Process Canonical MakkariEventEnvelope format
              if (chunk.protocolVersion === 1 && chunk.event) {
                const evt = chunk.event;

                if (evt.type === 'THINKING_STATUS') {
                  accumulatedReasoning = evt.status;
                  setStreamingReasoning(accumulatedReasoning);
                } else if (evt.type === 'TEXT_DELTA') {
                  accumulatedText += evt.delta || '';
                  setStreamingContent(accumulatedText);
                } else if (evt.type === 'ARTIFACT_CREATE' && evt.artifact) {
                  const artPayload = evt.artifact as ArtifactEventPayload;
                  const newArt: ConversationArtifact = {
                    id: artPayload.artifactId,
                    user_id: '',
                    chat_id: chatId,
                    title: artPayload.title,
                    artifact_type: artPayload.artifactType,
                    files: artPayload.files.map((f, i): ArtifactFile => ({
                      id: f.id || `file_${i}`,
                      artifact_id: artPayload.artifactId,
                      user_id: '',
                      chat_id: chatId,
                      filename: f.filename,
                      language: f.language,
                      mime_type: f.mimeType,
                      size_bytes: f.sizeBytes,
                      content: f.content || '',
                      content_hash: '',
                      is_entry_file: f.isEntryFile ?? (i === 0),
                      version: artPayload.version || 1,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    })),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };

                  turnArtifacts.push(newArt);
                  setStreamingArtifacts((prev) => [...prev.filter((a) => a.id !== newArt.id), newArt]);
                  addOrUpdateArtifact(chatId, newArt);
                  openArtifact(newArt);
                } else if (evt.type === 'CANCELLED') {
                  setStreamingReasoning('Generation stopped');
                  break;
                } else if (evt.type === 'ERROR') {
                  setStreamError({ message: evt.message, code: evt.code, retryable: evt.retryable });
                  break;
                }
              }
              // 2. Legacy fallback
              else if (chunk.type === 'text') {
                accumulatedText += chunk.content || '';
                setStreamingContent(accumulatedText);
              } else if (chunk.type === 'artifact' && chunk.artifact) {
                const newArt = chunk.artifact as ConversationArtifact;
                turnArtifacts.push(newArt);
                setStreamingArtifacts((prev) => [...prev.filter((a) => a.id !== newArt.id), newArt]);
                addOrUpdateArtifact(chatId, newArt);
                openArtifact(newArt);
              }
            } catch {
              // Ignore partial JSON
            }
          }
        }
      }

      // Persist final assistant message
      if (accumulatedText.trim().length > 0 || turnArtifacts.length > 0) {
        await addMessage(chatId, {
          role: 'assistant',
          content: accumulatedText,
          model_id: selectedModel,
          metadata: {
            durationMs: Date.now() - startTime,
            provider: selectedProvider,
            artifacts: turnArtifacts.length > 0 ? turnArtifacts : undefined,
          },
        });
      }
    } catch (err: any) {
      if (controller.signal.aborted) {
        console.log('[AI_STREAM] Generation cancelled by user.');
      } else {
        console.error('[AI_STREAM] Stream error:', err);
        setStreamError({ message: err.message || 'Stream processing failed' });
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingReasoning('');
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (content: string, attachments?: ChatAttachment[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;

    await addMessage(chatId, {
      role: 'user',
      content,
      attachments,
    });

    executeStream(content, attachments);
  };

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-3.5rem)] overflow-hidden bg-[#FBF9F5] dark:bg-[#121212]">
      {/* Left / Main Chat Thread Container */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-all duration-200 relative',
          isWorkspaceOpen && 'hidden lg:flex'
        )}
      >
        {/* Sticky Thread Header */}
        <div className="h-12 border-b border-[#E8E5E0] dark:border-[#2E2E2E] px-4 flex items-center justify-between bg-[#FBF9F5]/90 dark:bg-[#121212]/90 backdrop-blur-md shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/chat"
              className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors md:hidden"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h2 className="text-xs sm:text-sm font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] truncate">
              {currentChat?.title || 'Conversation'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {chatArtifacts.length > 0 && !isWorkspaceOpen && (
              <button
                type="button"
                onClick={() => openArtifact(chatArtifacts[0])}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#D97757]/10 hover:bg-[#D97757]/20 text-[#D97757] text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Artifacts ({chatArtifacts.length})</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFECE6] dark:bg-[#2A2A2A] text-[11px] font-mono text-[#6B6B6B] dark:text-[#9E9E9E]">
              <Zap className="w-3 h-3 text-[#D97757]" />
              <span className="capitalize">{selectedProvider}</span>
              <span>/</span>
              <span className="truncate max-w-[120px]">{selectedModel}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Message List */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 relative"
        >
          <div className="max-w-3xl mx-auto space-y-4">
            {isLoadingMessages ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-xs text-[#6B6B6B] dark:text-[#9E9E9E]">
                <Loader2 className="w-5 h-5 animate-spin text-[#D97757]" />
                <span>Loading conversation history...</span>
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="text-center py-20 text-xs text-[#6B6B6B] dark:text-[#9E9E9E]">
                Send a message to start this conversation.
              </div>
            ) : (
              chatMessages.map((msg: ChatMessage, index: number) => (
                <React.Fragment key={msg.id || index}>
                  <MessageItem
                    message={msg}
                    onDelete={() => msg.id && deleteMessage(chatId, msg.id)}
                  />
                  {msg.role === 'assistant' && index === chatMessages.length - 1 && chatArtifacts.length > 0 && (
                    <div className="pl-10">
                      {chatArtifacts.map((art: ConversationArtifact) => (
                        <ArtifactCard key={art.id} artifact={art} />
                      ))}
                    </div>
                  )}
                </React.Fragment>
              ))
            )}

            {/* In-Flight Streaming Message */}
            {isStreaming && (
              <MessageItem
                message={{
                  role: 'assistant',
                  content: streamingContent,
                  model_id: selectedModel,
                  metadata: {
                    reasoning: streamingReasoning
                      ? {
                          available: true,
                          summary: streamingReasoning,
                          provider: selectedProvider,
                        }
                      : undefined,
                    artifacts: streamingArtifacts.length > 0 ? streamingArtifacts : undefined,
                  },
                }}
                isStreaming={true}
              />
            )}

            {/* Bottom Sentinel for Intersection & Auto-scroll */}
            <div ref={bottomSentinelRef} className="h-px w-full" />

            {/* Error Banner */}
            {streamError && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{streamError.message}</div>
                  {streamError.code && (
                    <div className="font-mono text-[10px] opacity-75 mt-0.5">Code: {streamError.code}</div>
                  )}
                </div>
                {streamError.retryable && (
                  <button
                    type="button"
                    onClick={() => {
                      const lastUserMsg = [...chatMessages].reverse().find((m: ChatMessage) => m.role === 'user');
                      if (lastUserMsg) executeStream(lastUserMsg.content, lastUserMsg.attachments);
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium cursor-pointer shadow-xs transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Floating "↓ New response" button */}
        {showNewResponseButton && (
          <div className="absolute bottom-24 right-8 z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#D97757] hover:bg-[#c2684b] text-white text-xs font-semibold shadow-md transition-transform hover:scale-105 cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>New response</span>
            </button>
          </div>
        )}

        {/* Bottom Sticky Composer */}
        <div className="border-t border-[#E8E5E0] dark:border-[#2E2E2E] p-4 bg-[#FBF9F5]/90 dark:bg-[#121212]/90 backdrop-blur-md">
          <div className="max-w-3xl mx-auto">
            <ChatBox
              chatId={chatId}
              isStreaming={isStreaming}
              onSendMessage={handleSendMessage}
              onStopStreaming={handleStopStream}
            />
          </div>
        </div>
      </div>

      {/* Right / Split Screen Artifact Workspace */}
      <ArtifactWorkspace />
    </div>
  );
}
