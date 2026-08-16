'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Check, Wrench, Loader2, AlertCircle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ThinkingState = 'idle' | 'thinking' | 'streaming' | 'complete' | 'error';

export interface ThinkingEventItem {
  type: 'status' | 'tool' | 'skill' | 'mcp' | 'artifact';
  text: string;
  name?: string;
  status?: 'started' | 'completed' | 'failed';
  timestamp?: number;
}

interface ThinkingPanelProps {
  summary?: string;
  durationMs?: number;
  provider?: string;
  isStreaming?: boolean;
  hasContent?: boolean;
  hasArtifact?: boolean;
  hasToolCall?: boolean;
  error?: boolean;
  cancelled?: boolean;
  events?: ThinkingEventItem[];
}

export function ThinkingPanel({
  summary,
  durationMs,
  provider,
  isStreaming = false,
  hasContent = false,
  hasArtifact = false,
  hasToolCall = false,
  error = false,
  cancelled = false,
  events = [],
}: ThinkingPanelProps) {
  // Panel remains OPEN during thinking, tool calls, MCP calls, and artifact creation;
  // It collapses automatically on the first meaningful TEXT_DELTA (hasContent).
  const isThinkingOrExecuting = isStreaming && !hasContent;
  const hasStartedTextOutput = isStreaming && hasContent;

  const [isOpen, setIsOpen] = useState(isThinkingOrExecuting);

  useEffect(() => {
    if (isThinkingOrExecuting) {
      setIsOpen(true);
    } else if (hasStartedTextOutput) {
      setIsOpen(false);
    }
  }, [isThinkingOrExecuting, hasStartedTextOutput]);

  const durationSec = durationMs ? Math.max(1, Math.round(durationMs / 1000)) : null;

  // Dynamic header label
  let headerLabel = 'Thinking...';
  if (cancelled) {
    headerLabel = 'Generation stopped';
  } else if (error) {
    headerLabel = 'Generation interrupted';
  } else if (isThinkingOrExecuting) {
    headerLabel = 'Thinking...';
  } else if (durationSec) {
    headerLabel = `Thought for ${durationSec}s`;
  } else {
    headerLabel = 'Thought process';
  }

  // Deduplicate and filter runtime event items (no fake chain-of-thought)
  const renderedEvents = events.filter((e) => e && e.text && e.text.trim().length > 0);

  return (
    <div className="my-2.5 rounded-2xl border border-[#E8E5E0] dark:border-[#2A2A2A] bg-[#FAF9F6] dark:bg-[#1A1A1A] overflow-hidden text-xs transition-all duration-200 shadow-2xs">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-[#F4F1EA] dark:hover:bg-[#222222] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          {error ? (
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : isThinkingOrExecuting ? (
            <Sparkles className="w-3.5 h-3.5 text-[#D97757] animate-pulse shrink-0" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
          )}

          <span
            className={cn(
              'font-medium truncate',
              isThinkingOrExecuting
                ? 'text-[#1A1A1A] dark:text-[#E5E5E5]'
                : 'text-[#6B6B6B] dark:text-[#9E9E9E]'
            )}
          >
            {headerLabel}
          </span>

          {isThinkingOrExecuting && (
            <Loader2 className="w-3 h-3 text-[#D97757] animate-spin shrink-0 ml-0.5" />
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-[#9E9E9E]">
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Expanded System Execution Events Body */}
      {isOpen && (
        <div className="px-4 py-3 border-t border-[#E8E5E0] dark:border-[#2A2A2A] bg-white dark:bg-[#161616] space-y-2 text-[#4A4A4A] dark:text-[#B0B0B0] font-sans leading-relaxed animate-in fade-in duration-150">
          {renderedEvents.length > 0 ? (
            <div className="space-y-2">
              {renderedEvents.map((evt, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  {evt.status === 'failed' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  ) : evt.type === 'artifact' ? (
                    <Layers className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
                  ) : evt.status === 'completed' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : evt.type === 'tool' || evt.type === 'mcp' ? (
                    isThinkingOrExecuting && idx === renderedEvents.length - 1 ? (
                      <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
                    ) : (
                      <Wrench className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )
                  ) : isThinkingOrExecuting && idx === renderedEvents.length - 1 ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#D97757] animate-spin shrink-0" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                  <span className={cn(
                    'truncate',
                    isThinkingOrExecuting && idx === renderedEvents.length - 1
                      ? 'text-[#1A1A1A] dark:text-[#E5E5E5] font-medium'
                      : 'text-[#4A4A4A] dark:text-[#B0B0B0]'
                  )}>
                    {evt.text}
                  </span>
                </div>
              ))}
            </div>

          ) : summary && summary.trim().length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97757] animate-pulse shrink-0" />
              <span className="text-xs font-medium text-[#1A1A1A] dark:text-[#E5E5E5]">{summary}</span>
            </div>
          ) : isThinkingOrExecuting ? (
            <div className="flex items-center gap-2 text-[#6B6B6B] dark:text-[#9E9E9E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97757] animate-pulse shrink-0" />
              <span>Analyzing request & planning response...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#6B6B6B] dark:text-[#9E9E9E] text-[11px]">
              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>Response generated</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

