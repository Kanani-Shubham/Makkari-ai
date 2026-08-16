'use client';

import React, { useState } from 'react';
import { FileText, Eye, Copy, Check, X } from 'lucide-react';
import { formatFileSize } from '@/lib/files/file-type';
import { cn } from '@/lib/utils';

interface PastedContentCardProps {
  title?: string;
  sizeBytes: number;
  content: string;
  language?: string;
}

export function PastedContentCard({
  title = 'pasted_content.txt',
  sizeBytes,
  content,
  language = 'plaintext',
}: PastedContentCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Compact Reference Card in Chat */}
      <div className="my-2 inline-flex items-center gap-3 p-3 rounded-2xl border border-[#E8E5E0] dark:border-[#2E2E2E] bg-[#FAF9F6] dark:bg-[#1E1E1E] shadow-2xs max-w-sm">
        <div className="w-9 h-9 rounded-xl bg-[#D97757]/10 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-[#D97757]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] truncate">{title}</div>
          <div className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E]">
            {formatFileSize(sizeBytes)} • <span className="uppercase">{language}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer"
          title="View Content"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* Full Modal Viewer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-[#1C1C1C] rounded-3xl border border-[#E8E5E0] dark:border-[#2E2E2E] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#D97757]" />
                <span className="text-sm font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">{title}</span>
                <span className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E]">({formatFileSize(sizeBytes)})</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#FAF9F6] dark:bg-[#262626] border border-[#E8E5E0] dark:border-[#383838] text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#333333] transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#FAF9F6] dark:hover:bg-[#262626] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Code Body */}
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-[#2A2A2A] dark:text-[#D5D5D5] bg-[#F7F6F3] dark:bg-[#141414] whitespace-pre-wrap select-text">
              {content}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
