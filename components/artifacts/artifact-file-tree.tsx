'use client';

import React from 'react';
import { ArtifactFile } from '@/lib/artifacts/types';
import { useArtifactStore } from '@/lib/store/use-artifact-store';
import { FileCode, FileText, Globe, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { detectFileInfo } from '@/lib/files/file-type';
import { cn } from '@/lib/utils';

interface ArtifactFileTreeProps {
  files: ArtifactFile[];
}

export function ArtifactFileTree({ files }: ArtifactFileTreeProps) {
  const { activeFileId, setActiveFileId } = useArtifactStore();

  return (
    <div className="w-48 bg-[#F7F6F3] dark:bg-[#181818] border-r border-[#E8E5E0] dark:border-[#2E2E2E] flex flex-col h-full overflow-y-auto">
      <div className="px-3 py-2 text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] uppercase tracking-wider border-b border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center gap-1.5">
        <Folder className="w-3.5 h-3.5 text-[#D97757]" />
        <span>Project Files ({files.length})</span>
      </div>

      <div className="p-1 space-y-0.5">
        {files.map((file) => {
          const isSelected = file.id === activeFileId;
          const info = detectFileInfo(file.filename);

          return (
            <button
              key={file.id}
              type="button"
              onClick={() => setActiveFileId(file.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-mono text-left transition-colors cursor-pointer',
                isSelected
                  ? 'bg-white dark:bg-[#242424] text-[#D97757] font-semibold shadow-xs'
                  : 'text-[#1A1A1A] dark:text-[#CCCCCC] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A]'
              )}
            >
              {info.isLiveHtml ? (
                <Globe className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
              ) : info.isCode ? (
                <FileCode className="w-3.5 h-3.5 text-[#6B6B6B] dark:text-[#9E9E9E] shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-[#6B6B6B] dark:text-[#9E9E9E] shrink-0" />
              )}
              <span className="truncate">{file.filename}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
