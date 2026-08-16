'use client';

import React, { useState, useEffect } from 'react';
import { ArtifactFile } from '@/lib/artifacts/types';
import { useArtifactStore } from '@/lib/store/use-artifact-store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Download, Edit2, Save, X, FileText, Code2 } from 'lucide-react';
import { formatFileSize } from '@/lib/files/file-type';
import { cn } from '@/lib/utils';

interface ArtifactCodeViewerProps {
  file: ArtifactFile;
}

export function ArtifactCodeViewer({ file }: ArtifactCodeViewerProps) {
  const { updateFileContent } = useArtifactStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(file.content || '');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [docView, setDocView] = useState<'preview' | 'source'>('preview');

  useEffect(() => {
    setEditContent(file.content || '');
    setIsEditing(false);
  }, [file.id, file.content]);

  const isMarkdown = file.language === 'markdown' || file.filename.endsWith('.md');
  const isJson = file.language === 'json' || file.filename.endsWith('.json');
  const isCsv = file.language === 'csv' || file.filename.endsWith('.csv');

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([file.content || ''], { type: file.mime_type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/artifacts/${file.artifact_id}/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });

      if (res.ok) {
        updateFileContent(file.id, editContent);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('[ARTIFACT_CODE_VIEWER] Error saving file:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const lines = (file.content || '').split('\n');

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#181818] text-[#1A1A1A] dark:text-[#E5E5E5] overflow-hidden">
      {/* File Header Bar */}
      <div className="px-4 py-2 bg-[#F7F6F3] dark:bg-[#1E1E1E] border-b border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] truncate">
            {file.filename}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFECE6] dark:bg-[#2A2A2A] text-[#6B6B6B] dark:text-[#9E9E9E] font-mono uppercase">
            {file.language}
          </span>
          <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E]">
            v{file.version || 1} • {formatFileSize(file.size_bytes)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isMarkdown && !isEditing && (
            <div className="flex items-center bg-[#EFECE6] dark:bg-[#2A2A2A] p-0.5 rounded-xl mr-2">
              <button
                type="button"
                onClick={() => setDocView('preview')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors',
                  docView === 'preview' && 'bg-white dark:bg-[#181818] text-[#1A1A1A] dark:text-[#E5E5E5] shadow-xs'
                )}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setDocView('source')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors',
                  docView === 'source' && 'bg-white dark:bg-[#181818] text-[#1A1A1A] dark:text-[#E5E5E5] shadow-xs'
                )}
              >
                Source
              </button>
            </div>
          )}

          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 rounded-xl text-xs text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1 px-3 py-1 rounded-xl bg-[#D97757] text-white text-xs font-semibold hover:bg-[#C66345] transition-all cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors"
                title="Edit File"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors"
                title="Copy Code"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors"
                title="Download File"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full bg-transparent font-mono text-xs text-[#1A1A1A] dark:text-[#E5E5E5] focus:outline-none resize-none leading-relaxed"
            spellCheck={false}
          />
        ) : isMarkdown && docView === 'preview' ? (
          <div className="prose dark:prose-invert max-w-none text-xs font-sans leading-relaxed space-y-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {file.content || ''}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex font-mono text-xs leading-6">
            {/* Line Numbers */}
            <div className="select-none pr-4 text-right text-[#9E9E9E] dark:text-[#555555] border-r border-[#E8E5E0] dark:border-[#2E2E2E]">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Code Content */}
            <div className="pl-4 overflow-x-auto flex-1 whitespace-pre text-[#1A1A1A] dark:text-[#E5E5E5]">
              {file.content || ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
