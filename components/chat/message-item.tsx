'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '@/lib/ai/types';
import { CodeBlock } from './code-block';
import { MakkariLogo } from '@/components/brand/makkari-logo';
import { ThinkingPanel } from './thinking-panel';
import { ArtifactCard } from '@/components/artifacts/artifact-card';
import {
  MarkdownTable,
  MarkdownThead,
  MarkdownTbody,
  MarkdownTr,
  MarkdownTh,
  MarkdownTd,
} from '@/components/markdown/markdown-table';
import { Copy, Check, RefreshCw, Trash2, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { formatFileSize } from '@/lib/files/file-type';

interface MessageItemProps {
  message: ChatMessage;
  onRegenerate?: () => void;
  onDelete?: () => void;
  isStreaming?: boolean;
}

export function MessageItem({ message, onRegenerate, onDelete, isStreaming = false }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reasoningData = message.metadata?.reasoning;
  const messageArtifacts: any[] = (message.metadata?.artifacts as any[]) || [];

  // User Message — Compact Right-Aligned Soft Bubble with Attachments
  if (isUser) {
    return (
      <div className="w-full flex flex-col items-end my-3 select-text space-y-1.5">
        {/* User Attachments Strip */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end max-w-[85%]">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 p-2 bg-[#EFECE6] dark:bg-[#2A2A2A] border border-[#E8E5E0] dark:border-[#333] rounded-2xl text-xs text-[#1A1A1A] dark:text-[#E5E5E5] shadow-xs"
              >
                {att.kind === 'image' && att.url ? (
                  <img
                    src={att.url}
                    alt={att.name}
                    className="w-10 h-10 object-cover rounded-xl border border-[#E8E5E0] dark:border-[#333]"
                  />
                ) : att.kind === 'image' ? (
                  <div className="w-8 h-8 rounded-xl bg-[#D97757]/10 flex items-center justify-center text-[#D97757]">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-[#D97757]/10 flex items-center justify-center text-[#D97757]">
                    <FileText className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0 pr-1">
                  <div className="truncate max-w-[140px] font-medium">{att.name}</div>
                  <div className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E] font-mono">
                    {formatFileSize(att.size)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="max-w-[80%] bg-[#EFECE6] dark:bg-[#2A2A2A] border border-[#E8E5E0] dark:border-[#333333] text-[#1A1A1A] dark:text-[#E5E5E5] rounded-2xl rounded-tr-xs px-4 py-2.5 text-sm sm:text-base leading-relaxed shadow-2xs">
          <p className="whitespace-pre-wrap break-words font-sans">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant Message — Document Reading Experience with Reasoning & Artifacts
  return (
    <div className="group w-full my-6 select-text transition-all">
      <div className="flex items-start gap-3">
        {/* Animated Makkari Brand Emblem */}
        <div className="w-7 h-7 rounded-xl bg-[#D97757]/10 dark:bg-[#D97757]/20 flex items-center justify-center shrink-0 mt-1">
          <MakkariLogo variant="icon" size="sm" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">Makkari AI</span>
              {message.model_id && (
                <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E] bg-[#EFECE6] dark:bg-[#2A2A2A] px-2 py-0.5 rounded-full font-mono">
                  {message.model_id}
                </span>
              )}
            </div>
            {message.created_at && (
              <span className="text-[10px] text-[#9E9E9E]">{formatDate(message.created_at)}</span>
            )}
          </div>

          {/* Dynamic Provider-Driven Thinking Panel */}
          {((reasoningData?.available && (!!reasoningData?.summary?.trim() || (reasoningData?.events && reasoningData.events.length > 0))) ||
            (isStreaming && !message.content && reasoningData?.available)) && (
            <ThinkingPanel
              summary={reasoningData?.summary}
              durationMs={reasoningData?.durationMs}
              provider={reasoningData?.provider}
              isStreaming={isStreaming}
              hasContent={!!message.content && message.content.length > 0}
              hasArtifact={messageArtifacts.length > 0}
              hasToolCall={reasoningData?.events?.some((e) => e.type === 'tool')}
              events={reasoningData?.events}
            />
          )}



          {/* Associated Artifact Cards */}
          {messageArtifacts.map((art) => (
            <ArtifactCard key={art.id} artifact={art} />
          ))}

          {/* Markdown Body */}
          <div className="prose dark:prose-invert max-w-none text-sm sm:text-base text-[#1A1A1A] dark:text-[#E5E5E5] leading-relaxed font-sans">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ children }: any) => <MarkdownTable>{children}</MarkdownTable>,
                thead: ({ children }: any) => <MarkdownThead>{children}</MarkdownThead>,
                tbody: ({ children }: any) => <MarkdownTbody>{children}</MarkdownTbody>,
                tr: ({ children }: any) => <MarkdownTr>{children}</MarkdownTr>,
                th: ({ children }: any) => <MarkdownTh>{children}</MarkdownTh>,
                td: ({ children }: any) => <MarkdownTd>{children}</MarkdownTd>,
                code({ className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match && !String(children).includes('\n');

                  if (isInline) {
                    return (
                      <code
                        className="bg-[#EFECE6] dark:bg-[#2A2A2A] text-[#D97757] font-mono text-xs px-1.5 py-0.5 rounded-md"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }

                  return (
                    <CodeBlock
                      language={match ? match[1] : 'plaintext'}
                      value={String(children).replace(/\n$/, '')}
                    />
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors"
              title="Copy response"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors"
                title="Regenerate"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-red-600 hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors"
                title="Delete message"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
