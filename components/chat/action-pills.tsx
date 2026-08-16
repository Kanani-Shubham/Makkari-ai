'use client';

import React from 'react';
import { PenTool, Code, Search, GraduationCap, Sparkles, BarChart2 } from 'lucide-react';

interface ActionPillsProps {
  onSelectPrompt: (promptText: string) => void;
}

export function ActionPills({ onSelectPrompt }: ActionPillsProps) {
  const pills = [
    {
      icon: PenTool,
      label: 'Write',
      prompt: 'Help me draft an engaging article about ',
    },
    {
      icon: Code,
      label: 'Code',
      prompt: 'Write clean, robust code for ',
    },
    {
      icon: Search,
      label: 'Research',
      prompt: 'Conduct a thorough research overview of ',
    },
    {
      icon: GraduationCap,
      label: 'Learn',
      prompt: 'Explain the core principles of ',
    },
    {
      icon: Sparkles,
      label: 'Create',
      prompt: 'Brainstorm creative concepts and ideas for ',
    },
    {
      icon: BarChart2,
      label: 'Analyze',
      prompt: 'Analyze the trade-offs and structural aspects of ',
    },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar scroll-smooth">
      {pills.map((pill) => {
        const IconComponent = pill.icon;
        return (
          <button
            key={pill.label}
            onClick={() => onSelectPrompt(pill.prompt)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-[#E8E5E0] text-xs font-medium text-[#1A1A1A] hover:bg-[#EFECE6] hover:border-[#D97757]/40 shadow-2xs transition-all active:scale-[0.97] shrink-0 cursor-pointer"
          >
            <IconComponent className="w-3.5 h-3.5 text-[#D97757]" />
            <span>{pill.label}</span>
          </button>
        );
      })}
    </div>
  );
}
