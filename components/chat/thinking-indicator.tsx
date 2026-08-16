'use client';

import React from 'react';
import { Sparkles, Loader2, Wrench, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThinkingIndicatorProps {
  activity?: string;
  toolName?: string;
  isCompleted?: boolean;
}

export function ThinkingIndicator({ activity, toolName, isCompleted = false }: ThinkingIndicatorProps) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8E5E0] dark:border-[#2E2E2E] shadow-xs text-xs text-[#1A1A1A] dark:text-[#E5E5E5] animate-in fade-in my-2">
      {toolName ? (
        <Wrench className="w-3.5 h-3.5 text-[#D97757]" />
      ) : (
        <Sparkles className="w-3.5 h-3.5 text-[#D97757] animate-pulse" />
      )}

      <span className="font-medium text-[11px]">
        {toolName ? `Using ${toolName}` : activity || 'Thinking...'}
      </span>

      {isCompleted ? (
        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
      ) : (
        <Loader2 className="w-3 h-3 text-[#D97757] animate-spin shrink-0 ml-1" />
      )}
    </div>
  );
}
