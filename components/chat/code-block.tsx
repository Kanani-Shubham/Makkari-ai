'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  value: string;
}

export function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-[#2E2E2E] bg-[#1E1E1E] text-[#E5E5E5] shadow-sm font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#2E2E2E]">
        <span className="text-[#A0A0A0] text-[11px] font-sans font-medium uppercase tracking-wider">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[#A0A0A0] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-sans font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[11px] font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-[#E5E5E5] leading-relaxed font-mono selection:bg-[#D97757]/30 selection:text-white">
        <pre className="whitespace-pre">{value}</pre>
      </div>
    </div>
  );
}
