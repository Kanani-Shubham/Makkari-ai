'use client';

import React, { useEffect, useRef, useState, use } from 'react';
import { useChatStore, ChatThread } from '@/lib/store/use-chat-store';
import { useModelStore } from '@/lib/store/use-model-store';
import { useArtifactStore } from '@/lib/store/use-artifact-store';
import { MessageItem } from '@/components/chat/message-item';
import { ChatBox } from '@/components/chat/chat-box';
import { ArtifactWorkspace } from '@/components/artifacts/artifact-workspace';
import { ArtifactCard } from '@/components/artifacts/artifact-card';
import { ConversationArtifact, ArtifactFile } from '@/lib/artifacts/types';
import { ChatAttachment, ChatMessage, ProviderId } from '@/lib/ai/types';
import { ArrowLeft, Layers, Zap, AlertCircle, RefreshCw, Loader2, ArrowDown } from 'lucide-react';
import Link from 'next/link';
import { ThinkingEventItem } from '@/components/chat/thinking-panel';
import { ArtifactEventPayload } from '@/lib/ai/events/canonical-events';
import { cn } from '@/lib/utils';



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
    upsertMessage,
    updateStreamingMessage,
    saveAssistantMessage,
    deleteMessage,
    isStreaming,
    setIsStreaming,
    updateChatModel,
  } = useChatStore();

  const { providers, selectedProvider, selectedModel, setSelectedProvider, setSelectedModel } = useModelStore();

  const { artifacts, isWorkspaceOpen, openArtifact, addOrUpdateArtifact } = useArtifactStore();

  const [currentStreamingMsgId, setCurrentStreamingMsgId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<{ message: string; code?: string; retryable?: boolean } | null>(null);

  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [showNewResponseButton, setShowNewResponseButton] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const autoStreamTriggeredRef = useRef(false);
  const isNearBottomRef = useRef(true);

  const currentChat = chats.find((c: ChatThread) => c.id === chatId);
  const activeProvider = selectedProvider || currentChat?.providerId || 'gemini';
  const activeModel = selectedModel || currentChat?.modelId || 'gemini-2.5-flash';

  // Sync model store when opening an existing chat with custom model
  useEffect(() => {
    if (currentChat?.providerId && currentChat?.modelId) {
      if (currentChat.providerId !== selectedProvider || currentChat.modelId !== selectedModel) {
        setSelectedProvider(currentChat.providerId);
        setSelectedModel(currentChat.modelId);
      }
    }
  }, [currentChat?.id]);


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
  }, [chatMessages.length, isStreaming, streamError]);

  const executeStream = async (
    userContent?: string,
    attachments?: ChatAttachment[],
    explicitHistory?: ChatMessage[]
  ) => {
    if (isStreaming) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Single canonical assistant message identity for the entire turn
    const assistantMessageId = crypto.randomUUID();
    setCurrentStreamingMsgId(assistantMessageId);
    setIsStreaming(true);
    setStreamError(null);
    setShowNewResponseButton(false);

    // Initial placeholder in client messages
    upsertMessage(chatId, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      model_id: activeModel,
      provider_id: activeProvider,
      created_at: new Date().toISOString(),
      metadata: {
        reasoning: {
          available: false,
          summary: '',
          events: [],
        },
      },
    });

    const startTime = Date.now();
    let reasoningStartTime: number | null = null;
    let reasoningEndTime: number | null = null;
    let accumulatedText = '';
    let accumulatedReasoning = '';
    const turnArtifacts: ConversationArtifact[] = [];
    const accumulatedEvents: ThinkingEventItem[] = [];

    try {
      // 1. Build deterministic message history
      let historyToUse: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

      if (explicitHistory && explicitHistory.length > 0) {
        historyToUse = explicitHistory
          .filter((m) => m.id !== assistantMessageId)
          .map((m) => ({ role: m.role as any, content: m.content }));
      } else {
        const currentList = messages[chatId] || [];
        historyToUse = currentList
          .filter((m) => m.id !== assistantMessageId)
          .map((m) => ({ role: m.role as any, content: m.content }));
      }

      if (userContent && userContent.trim()) {
        const last = historyToUse[historyToUse.length - 1];
        if (!last || last.role !== 'user' || last.content !== userContent) {
          historyToUse.push({ role: 'user', content: userContent });
        }
      }

      if (historyToUse.length === 0) {
        console.warn('[CHAT_RUNTIME] Skip streaming: Message history is empty.');
        setIsStreaming(false);
        return;
      }

      const turnId = crypto.randomUUID();
      const lastMsg = historyToUse[historyToUse.length - 1];
      const preview = (lastMsg?.content || '').slice(0, 50).replace(/\n/g, ' ');

      console.log(
        `[CHAT_RUNTIME] chatId=${chatId} turnId=${turnId} msgId=${assistantMessageId} provider=${activeProvider} model=${activeModel} messageCount=${historyToUse.length} lastRole=${lastMsg?.role} preview="${preview}"`
      );

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          chatId,
          messages: historyToUse,
          providerId: activeProvider,
          modelId: activeModel,
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

                if (evt.type === 'STREAM_START') {
                  // Stream initialization
                } else if (evt.type === 'THINKING_START') {
                  if (reasoningStartTime === null) {
                    reasoningStartTime = Date.now();
                  }
                } else if (evt.type === 'THINKING_DELTA') {
                  if (reasoningStartTime === null) {
                    reasoningStartTime = Date.now();
                  }
                  accumulatedReasoning += evt.delta || '';
                } else if (evt.type === 'THINKING_STATUS') {
                  if (reasoningStartTime === null) {
                    reasoningStartTime = Date.now();
                  }
                  if (evt.status && evt.status.trim()) {
                    accumulatedReasoning = evt.status;
                  }
                } else if (evt.type === 'TOOL_CALL') {
                  const toolName = evt.tool || 'tool';
                  accumulatedEvents.push({
                    type: 'tool',
                    name: toolName,
                    text: `Using ${toolName}…`,
                    status: 'started',
                    timestamp: Date.now(),
                  });
                } else if (evt.type === 'TOOL_PROGRESS') {
                  const progressMsg = evt.message || `Running ${evt.tool || 'tool'}…`;
                  const lastToolIdx = [...accumulatedEvents]
                    .reverse()
                    .findIndex((e) => e.type === 'tool' && e.status === 'started');
                  if (lastToolIdx !== -1) {
                    const actualIdx = accumulatedEvents.length - 1 - lastToolIdx;
                    accumulatedEvents[actualIdx] = {
                      ...accumulatedEvents[actualIdx],
                      text: progressMsg,
                    };
                  } else {
                    accumulatedEvents.push({
                      type: 'tool',
                      name: evt.tool,
                      text: progressMsg,
                      status: 'started',
                      timestamp: Date.now(),
                    });
                  }
                } else if (evt.type === 'TOOL_RESULT') {
                  const resSuccess = evt.result?.success !== false;
                  const toolName = evt.tool || 'Tool';
                  const lastToolIdx = [...accumulatedEvents]
                    .reverse()
                    .findIndex((e) => e.type === 'tool' && e.status === 'started');
                  if (lastToolIdx !== -1) {
                    const actualIdx = accumulatedEvents.length - 1 - lastToolIdx;
                    accumulatedEvents[actualIdx] = {
                      ...accumulatedEvents[actualIdx],
                      text: `${accumulatedEvents[actualIdx].name || toolName} ${resSuccess ? 'completed' : 'failed'}`,
                      status: resSuccess ? 'completed' : 'failed',
                    };
                  } else {
                    accumulatedEvents.push({
                      type: 'tool',
                      name: toolName,
                      text: `${toolName} ${resSuccess ? 'completed' : 'failed'}`,
                      status: resSuccess ? 'completed' : 'failed',
                      timestamp: Date.now(),
                    });
                  }
                } else if (evt.type === 'TEXT_DELTA') {
                  if (reasoningStartTime !== null && reasoningEndTime === null && accumulatedReasoning.trim()) {
                    reasoningEndTime = Date.now();
                  }
                  accumulatedText += evt.delta || '';
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
                  addOrUpdateArtifact(chatId, newArt);
                  openArtifact(newArt);
                  accumulatedEvents.push({
                    type: 'artifact',
                    text: `Created artifact: ${artPayload.title}`,
                    status: 'completed',
                    timestamp: Date.now(),
                  });
                } else if (evt.type === 'CANCELLED') {
                  accumulatedEvents.push({
                    type: 'status',
                    text: 'Generation stopped',
                    status: 'failed',
                    timestamp: Date.now(),
                  });
                  break;
                } else if (evt.type === 'ERROR') {
                  accumulatedEvents.push({
                    type: 'status',
                    text: evt.message || 'Generation interrupted',
                    status: 'failed',
                    timestamp: Date.now(),
                  });
                  setStreamError({ message: evt.message, code: evt.code, retryable: evt.retryable });
                  break;
                } else if (evt.type === 'DONE') {
                  break;
                }
              }
              // 2. Legacy fallback
              else if (chunk.type === 'text') {
                accumulatedText += chunk.content || '';
              } else if (chunk.type === 'artifact' && chunk.artifact) {
                const newArt = chunk.artifact as ConversationArtifact;
                turnArtifacts.push(newArt);
                addOrUpdateArtifact(chatId, newArt);
                openArtifact(newArt);
              }

              // Update the single canonical assistant message in-place with real reasoning
              const hasReasoningData = accumulatedReasoning.trim().length > 0;
              const hasEventsData = accumulatedEvents.length > 0;
              const currentReasoningDuration = (reasoningStartTime && hasReasoningData)
                ? ((reasoningEndTime || Date.now()) - reasoningStartTime)
                : undefined;

              updateStreamingMessage(chatId, assistantMessageId, {
                content: accumulatedText,
                metadata: {
                  durationMs: Date.now() - startTime,
                  provider: activeProvider,
                  artifacts: turnArtifacts.length > 0 ? turnArtifacts : undefined,
                  reasoning: (hasReasoningData || hasEventsData)
                    ? {
                        available: true,
                        summary: hasReasoningData ? accumulatedReasoning : undefined,
                        provider: activeProvider,
                        events: hasEventsData ? accumulatedEvents : undefined,
                        durationMs: currentReasoningDuration,
                      }
                    : undefined,
                },
              });
            } catch {
              // Ignore partial JSON
            }
          }
        }
      }

      // Persist final assistant message authoritatively without adding a duplicate
      if (accumulatedText.trim().length > 0 || turnArtifacts.length > 0) {
        const hasFinalReasoning = accumulatedReasoning.trim().length > 0;
        const hasFinalEvents = accumulatedEvents.length > 0;
        const finalReasoningDuration = (reasoningStartTime && hasFinalReasoning)
          ? ((reasoningEndTime || Date.now()) - reasoningStartTime)
          : undefined;

        const finalMetadata = {
          durationMs: Date.now() - startTime,
          provider: activeProvider,
          artifacts: turnArtifacts.length > 0 ? turnArtifacts : undefined,
          reasoning: (hasFinalReasoning || hasFinalEvents) ? {
            available: true,
            summary: hasFinalReasoning ? accumulatedReasoning : undefined,
            provider: activeProvider,
            durationMs: finalReasoningDuration,
            events: hasFinalEvents ? accumulatedEvents : undefined,
          } : undefined,
        };

        await saveAssistantMessage(
          chatId,
          accumulatedText,
          activeProvider,
          activeModel,
          finalMetadata,
          assistantMessageId
        );
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
      setCurrentStreamingMsgId(null);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (content: string, attachments?: ChatAttachment[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content,
      attachments,
    };

    const currentMsgs = messages[chatId] || [];
    const nextHistory = [...currentMsgs, userMsg];

    // Optimistically add and stream immediately
    addMessage(chatId, userMsg);
    executeStream(content, attachments, nextHistory);
  };


  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setCurrentStreamingMsgId(null);
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
              <span className="capitalize">{activeProvider}</span>
              <span>/</span>
              <span className="truncate max-w-[140px]">{activeModel}</span>
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
              chatMessages.map((msg: ChatMessage, index: number) => {
                const isThisMsgStreaming = isStreaming && msg.id === currentStreamingMsgId;
                return (
                  <React.Fragment key={msg.id || index}>
                    <MessageItem
                      message={msg}
                      isStreaming={isThisMsgStreaming}
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
                );
              })
            )}

            {/* Bottom Sentinel for Intersection & Auto-scroll */}
            <div ref={bottomSentinelRef} className="h-px w-full" />

            {/* Error Banner */}
            {streamError && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">
                        {streamError.code === 'MODEL_NOT_AVAILABLE' ? 'Model Unavailable' : 'Generation Interrupted'}
                      </div>
                      <div className="mt-0.5 opacity-90">{streamError.message}</div>
                      {streamError.code && (
                        <div className="font-mono text-[10px] opacity-60 mt-0.5">Code: {streamError.code}</div>
                      )}
                    </div>
                  </div>
                  {streamError.retryable && (
                    <button
                      type="button"
                      onClick={() => {
                        const lastUserMsg = [...chatMessages].reverse().find((m: ChatMessage) => m.role === 'user');
                        if (lastUserMsg) executeStream(lastUserMsg.content, lastUserMsg.attachments);
                      }}
                      className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium cursor-pointer shadow-xs transition-colors shrink-0"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>

                {/* Available alternative model chips when model is unavailable */}
                {streamError.code === 'MODEL_NOT_AVAILABLE' && (
                  <div className="pt-2 border-t border-amber-500/20">
                    <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300 mb-1.5">
                      Choose an available {providers[activeProvider]?.name || activeProvider} model:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(providers[activeProvider]?.models || [])
                        .filter((m: any) => m.id !== activeModel && m.availability !== 'unavailable')
                        .map((m: any) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              updateChatModel(chatId, activeProvider, m.id);
                              setSelectedModel(m.id);
                              setStreamError(null);
                              const lastUserMsg = [...chatMessages].reverse().find((msg: ChatMessage) => msg.role === 'user');
                              if (lastUserMsg) {
                                executeStream(lastUserMsg.content, lastUserMsg.attachments);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-600/15 hover:bg-amber-600/25 text-amber-900 dark:text-amber-100 font-medium border border-amber-500/30 transition-colors cursor-pointer text-[11px]"
                          >
                            {m.name || m.id}
                          </button>
                        ))}
                    </div>
                  </div>
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
