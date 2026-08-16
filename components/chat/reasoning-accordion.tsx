'use client';

import React, { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReasoningAccordionProps {
  summary?: string;
  durationMs?: number;
  isStreaming?: boolean;
  provider?: string;
}

export function ReasoningAccordion({
  summary,
  durationMs,
  isStreaming = false,
  provider,
}: ReasoningAccordionProps) {
  // If no reasoning text exists and not actively streaming reasoning, render nothing
  if (!summary && !isStreaming) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);

  // Compute duration label
  const durationLabel = durationMs
    ? durationMs >= 1000
      ? `Thought for ${Math.round(durationMs / 1000)}s`
      : `Thought for ${durationMs}s`
    : 'Reasoning';

  return (
    <div className="my-2 select-text">
      <div className="rounded-xl border border-[#E8E5E0] dark:border-[#2E2E2E] bg-[#F7F6F3]/70 dark:bg-[#1A1A1A]/70 overflow-hidden transition-all">
        {/* Accordion Header */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#D97757] animate-pulse" />
                <span className="font-medium text-[#D97757]">Thinking...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#6B6B6B] dark:text-[#9E9E9E]" />
                <span className="font-medium">{durationLabel}</span>
              </>
            )}
            {provider && (
              <span className="text-[10px] text-[#9E9E9E] dark:text-[#6B6B6B] uppercase font-mono">
                • {provider}
              </span>
            )}
          </div>

          <ChevronDown
            className={cn('w-3.5 h-3.5 transition-transform duration-200', isOpen && 'transform rotate-180')}
          />
        </button>

        {/* Collapsible Content */}
        {isOpen && summary && (
          <div className="px-3.5 pb-3 pt-1 border-t border-[#E8E5E0]/60 dark:border-[#2E2E2E]/60 text-xs text-[#6B6B6B] dark:text-[#9E9E9E] leading-relaxed font-sans whitespace-pre-wrap animate-in fade-in duration-150">
            {summary}
          </div>
        )}
      </div>
    </div>
  );
}
