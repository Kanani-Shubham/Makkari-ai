'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, ArrowUp, Mic, Square, X, FileText, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { ComposerModelPicker } from './composer-model-picker';
import { ChatAttachment } from '@/lib/ai/types';
import { formatFileSize, detectFileInfo } from '@/lib/files/file-type';
import { cn } from '@/lib/utils';

export const MAX_FILES_PER_MESSAGE = 20;

interface ChatBoxProps {
  onSendMessage: (message: string, attachments?: ChatAttachment[]) => void;
  isStreaming?: boolean;
  onStopStreaming?: () => void;
  placeholder?: string;
  initialValue?: string;
  chatId?: string;
}

export function ChatBox({
  onSendMessage,
  isStreaming = false,
  onStopStreaming,
  placeholder = 'Write a message to Makkari...',
  initialValue = '',
  chatId,
}: ChatBoxProps) {
  const [input, setInput] = useState(initialValue);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  }, [input]);

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    // Hard limit check (max 20 files)
    if (attachments.length + fileList.length > MAX_FILES_PER_MESSAGE) {
      setUploadError(`Maximum ${MAX_FILES_PER_MESSAGE} files per message allowed.`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      if (!chatId) {
        // Transient uploads before chat is created
        const newAtts: ChatAttachment[] = fileList.map((file) => {
          const info = detectFileInfo(file.name, file.type);
          return {
            id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            mimeType: info.mimeType,
            size: file.size,
            storagePath: `temp/${file.name}`,
            kind: info.isImage ? 'image' : info.isCode ? 'code' : 'file',
            status: 'uploaded',
          };
        });
        setAttachments((prev) => [...prev, ...newAtts]);
        return;
      }

      const formData = new FormData();
      formData.append('chatId', chatId);
      fileList.forEach((f, idx) => {
        formData.append(`file_${idx}`, f);
      });

      const res = await fetch('/api/attachments/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.attachments) {
          setAttachments((prev) => [...prev, ...data.attachments]);
        } else {
          setUploadError(data.error || 'Failed to upload attachments.');
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setUploadError(errJson.error || 'Upload failed.');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // 1. If file/image is pasted directly from clipboard
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      handleFileUpload(e.clipboardData.files);
      return;
    }

    // 2. Large text pasted content detection (>8000 chars or >100 lines)
    const text = e.clipboardData.getData('text');
    if (text && (text.length > 8000 || text.split('\n').length > 100)) {
      e.preventDefault();
      const pastedAtt: ChatAttachment = {
        id: `pasted-${Date.now()}`,
        name: 'Pasted content',
        mimeType: 'text/plain',
        size: Buffer.byteLength(text, 'utf8'),
        storagePath: `temp/pasted_${Date.now()}.txt`,
        kind: 'file',
        status: 'uploaded',
        content: text,
        processing: {
          status: 'ready',
          extracted: true,
        },
      };

      if (attachments.length < MAX_FILES_PER_MESSAGE) {
        setAttachments((prev) => [...prev, pastedAtt]);
      } else {
        setUploadError(`Maximum ${MAX_FILES_PER_MESSAGE} files per message reached.`);
      }
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (isStreaming) {
      onStopStreaming?.();
      return;
    }

    if (isSubmittingRef.current) return;

    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;

    isSubmittingRef.current = true;
    try {
      onSendMessage(trimmed, attachments.length > 0 ? attachments : undefined);
      setInput('');
      setAttachments([]);
      setUploadError(null);
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 300);
    }
  };


  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
          handleFileUpload(e.dataTransfer.files);
        }
      }}
      className={cn(
        'relative bg-white dark:bg-[#1E1E1E] rounded-3xl border border-[#E8E5E0] dark:border-[#2E2E2E] shadow-lg transition-all p-3',
        isDragging && 'border-[#D97757] ring-2 ring-[#D97757]/20 bg-[#D97757]/5'
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => {
          if (e.target.files) handleFileUpload(e.target.files);
        }}
        className="hidden"
      />

      {/* Attachment Preview Strip */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-1.5 bg-[#F7F6F3] dark:bg-[#181818] rounded-2xl">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group flex items-center gap-2 p-1.5 pr-2.5 bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#333] rounded-xl text-xs text-[#1A1A1A] dark:text-[#E5E5E5] shadow-xs"
            >
              <div className="w-6 h-6 rounded-lg bg-[#D97757]/10 flex items-center justify-center text-[#D97757] shrink-0">
                {att.kind === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-[11px] truncate max-w-[120px]">{att.name}</div>
                <div className="text-[9px] text-[#6B6B6B] dark:text-[#9E9E9E] font-mono">
                  {formatFileSize(att.size)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="text-[#9E9E9E] hover:text-red-500 transition-colors ml-1"
                title="Remove attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E] self-center px-1 font-mono">
            {attachments.length}/{MAX_FILES_PER_MESSAGE} files
          </div>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="flex items-center gap-2 px-3 py-1.5 mb-2 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        rows={1}
        className="w-full bg-transparent text-[#1A1A1A] dark:text-[#E5E5E5] placeholder-[#9E9E9E] text-sm focus:outline-none resize-none px-2 py-1 leading-relaxed"
      />

      {/* Bottom Controls */}
      <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#E8E5E0]/60 dark:border-[#2E2E2E]/60">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || attachments.length >= MAX_FILES_PER_MESSAGE}
            className="p-2 rounded-xl text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer disabled:opacity-50"
            title={`Attach files (up to ${MAX_FILES_PER_MESSAGE})`}
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-[#D97757]" /> : <Plus className="w-4 h-4" />}
          </button>

          <ComposerModelPicker chatId={chatId} />

        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isStreaming && !input.trim() && attachments.length === 0}
          className={cn(
            'p-2 rounded-2xl transition-all cursor-pointer shadow-xs',
            isStreaming
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : input.trim() || attachments.length > 0
              ? 'bg-[#D97757] hover:bg-[#C66345] text-white'
              : 'bg-[#EFECE6] dark:bg-[#2A2A2A] text-[#9E9E9E] cursor-not-allowed'
          )}
          title={isStreaming ? 'Stop Streaming' : 'Send Message'}
        >
          {isStreaming ? <Square className="w-4 h-4 fill-current" /> : <ArrowUp className="w-4 h-4 stroke-[2.5]" />}
        </button>
      </div>
    </div>
  );
}
