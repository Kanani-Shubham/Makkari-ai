'use client';

import React from 'react';
import { FileCode, FileText, Globe, Layers, Download, ExternalLink, ChevronRight, Copy, Check } from 'lucide-react';
import { ConversationArtifact, ArtifactFile } from '@/lib/artifacts/types';
import { formatFileSize, detectFileInfo } from '@/lib/files/file-type';
import { useArtifactStore } from '@/lib/store/use-artifact-store';
import { cn } from '@/lib/utils';

interface ArtifactCardProps {
  artifact: ConversationArtifact;
  isPasted?: boolean;
  className?: string;
}

export function ArtifactCard({ artifact, isPasted = false, className }: ArtifactCardProps) {
  const { openArtifact } = useArtifactStore();
  const fileCount = artifact.files.length;
  const primaryFile = artifact.files[0];
  const fileInfo = primaryFile ? detectFileInfo(primaryFile.filename) : null;
  const totalSizeBytes = artifact.files.reduce((acc, f) => acc + (f.size_bytes || 0), 0);

  const [copied, setCopied] = React.useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (primaryFile?.content) {
      navigator.clipboard.writeText(primaryFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      onClick={() => openArtifact(artifact)}
      className={cn(
        'group relative my-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none',
        'bg-white dark:bg-[#1E1E1E] border-[#E8E5E0] dark:border-[#2E2E2E]',
        'hover:border-[#D97757] hover:shadow-md dark:hover:border-[#D97757]/60',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#D97757]/10 text-[#D97757] flex items-center justify-center shrink-0">
            {fileCount > 1 ? (
              <Layers className="w-5 h-5" />
            ) : fileInfo?.isLiveHtml ? (
              <Globe className="w-5 h-5" />
            ) : fileInfo?.isCode ? (
              <FileCode className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] truncate group-hover:text-[#D97757] transition-colors">
              {artifact.title || (primaryFile ? primaryFile.filename : 'Workspace Artifact')}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E]">
              <span className="font-mono uppercase font-medium">
                {fileCount > 1 ? `${fileCount} files` : fileInfo?.language || 'file'}
              </span>
              <span>•</span>
              <span>{formatFileSize(totalSizeBytes)}</span>
              {isPasted && (
                <>
                  <span>•</span>
                  <span className="text-[#D97757] font-medium">PASTED</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy Content"
            className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#2A2A2A] transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <div className="flex items-center text-xs font-medium text-[#D97757] pl-1">
            <span>Open</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* Multi-file preview sub-list if project contains 2+ files */}
      {fileCount > 1 && (
        <div className="mt-2.5 pt-2 border-t border-[#E8E5E0] dark:border-[#2E2E2E] flex flex-wrap gap-1.5">
          {artifact.files.slice(0, 5).map((f) => (
            <span
              key={f.id}
              className="text-[10px] px-2 py-0.5 rounded-md bg-[#F7F6F3] dark:bg-[#181818] text-[#1A1A1A] dark:text-[#E5E5E5] font-mono"
            >
              {f.filename}
            </span>
          ))}
          {fileCount > 5 && (
            <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E]">+{fileCount - 5} more</span>
          )}
        </div>
      )}
    </div>
  );
}
