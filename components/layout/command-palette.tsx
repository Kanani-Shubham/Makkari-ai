'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MessageSquare, Pin, Loader2, X, ArrowRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchItem } from '@/app/api/chats/search/route';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search fetch
  const fetchSearchResults = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/chats/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (data.results) {
            setResults(data.results);
          }
        }
      }
    } catch (err) {
      console.error('[COMMAND_PALETTE] Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    // Auto-focus input when opened
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    fetchSearchResults('');
  }, [isOpen, fetchSearchResults]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        fetchSearchResults(query);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen, fetchSearchResults]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const handleSelect = (item: SearchItem) => {
    router.push(`/chat/${item.chatId}`);
    onClose();
  };

  if (!isOpen) return null;

  const pinnedResults = results.filter((r) => r.isPinned);
  const chatResults = results.filter((r) => !r.isPinned && r.type === 'chat');
  const messageResults = results.filter((r) => r.type === 'message');

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl bg-white dark:bg-[#1C1C1C] border border-[#E8E5E0] dark:border-[#2E2E2E] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[520px] transition-all"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E8E5E0] dark:border-[#2E2E2E]">
          <Search className="w-4 h-4 text-[#6B6B6B] dark:text-[#9E9E9E] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search conversations, project topics, and messages..."
            className="w-full text-xs sm:text-sm bg-transparent border-none text-[#1A1A1A] dark:text-[#E5E5E5] placeholder-[#9E9E9E] focus:outline-none"
          />
          {isLoading && <Loader2 className="w-4 h-4 text-[#D97757] animate-spin shrink-0" />}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {results.length === 0 && !isLoading ? (
            <div className="py-12 text-center text-xs text-[#6B6B6B] dark:text-[#9E9E9E] space-y-1">
              <p className="font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">No matching conversations found</p>
              <p className="text-[11px]">Try searching for project topics, technical questions, or titles.</p>
            </div>
          ) : (
            <>
              {/* Pinned Section */}
              {pinnedResults.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] uppercase tracking-wider flex items-center gap-1.5">
                    <Pin className="w-3 h-3 text-[#D97757]" />
                    <span>Pinned Conversations</span>
                  </div>
                  <div className="space-y-0.5">
                    {pinnedResults.map((item) => {
                      const globalIdx = results.indexOf(item);
                      const isSelected = selectedIndex === globalIdx;
                      return (
                        <div
                          key={`pinned-${item.chatId}-${globalIdx}`}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            'flex items-center justify-between px-3 py-2 rounded-2xl text-xs cursor-pointer transition-all',
                            isSelected
                              ? 'bg-[#EFECE6] dark:bg-[#2A2A2A] text-[#1A1A1A] dark:text-[#E5E5E5] font-semibold'
                              : 'text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6]/50 dark:hover:bg-[#242424]'
                          )}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Pin className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
                            <span className="truncate">{item.title}</span>
                          </div>
                          {isSelected && <ArrowRight className="w-3.5 h-3.5 text-[#D97757] shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chat Title Matches */}
              {chatResults.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3 text-[#6B6B6B] dark:text-[#9E9E9E]" />
                    <span>Conversations</span>
                  </div>
                  <div className="space-y-0.5">
                    {chatResults.map((item) => {
                      const globalIdx = results.indexOf(item);
                      const isSelected = selectedIndex === globalIdx;
                      return (
                        <div
                          key={`chat-${item.chatId}-${globalIdx}`}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            'flex items-center justify-between px-3 py-2 rounded-2xl text-xs cursor-pointer transition-all',
                            isSelected
                              ? 'bg-[#EFECE6] dark:bg-[#2A2A2A] text-[#1A1A1A] dark:text-[#E5E5E5] font-semibold'
                              : 'text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6]/50 dark:hover:bg-[#242424]'
                          )}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <MessageSquare className="w-3.5 h-3.5 text-[#6B6B6B] dark:text-[#9E9E9E] shrink-0" />
                            <span className="truncate">{item.title}</span>
                          </div>
                          {isSelected && <ArrowRight className="w-3.5 h-3.5 text-[#D97757] shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Message Snippet Matches */}
              {messageResults.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-[#6B6B6B] dark:text-[#9E9E9E]" />
                    <span>Matching Messages</span>
                  </div>
                  <div className="space-y-1">
                    {messageResults.map((item) => {
                      const globalIdx = results.indexOf(item);
                      const isSelected = selectedIndex === globalIdx;
                      return (
                        <div
                          key={`msg-${item.chatId}-${globalIdx}`}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            'flex flex-col gap-0.5 px-3 py-2 rounded-2xl text-xs cursor-pointer transition-all',
                            isSelected
                              ? 'bg-[#EFECE6] dark:bg-[#2A2A2A] text-[#1A1A1A] dark:text-[#E5E5E5]'
                              : 'text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6]/50 dark:hover:bg-[#242424]'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-[#1A1A1A] dark:text-[#E5E5E5] truncate">
                              {item.title}
                            </span>
                            {isSelected && <ArrowRight className="w-3 h-3 text-[#D97757] shrink-0" />}
                          </div>
                          {item.snippet && (
                            <span className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E] line-clamp-1 italic">
                              &ldquo;{item.snippet}&rdquo;
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-4 py-2 border-t border-[#E8E5E0] dark:border-[#2E2E2E] bg-[#F7F6F3]/50 dark:bg-[#181818]/50 flex items-center justify-between text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#2A2A2A] border border-[#E8E5E0] dark:border-[#333333] font-mono text-[10px]">
                ↑
              </kbd>{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#2A2A2A] border border-[#E8E5E0] dark:border-[#333333] font-mono text-[10px]">
                ↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#2A2A2A] border border-[#E8E5E0] dark:border-[#333333] font-mono text-[10px]">
                ↵
              </kbd>{' '}
              Open
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#2A2A2A] border border-[#E8E5E0] dark:border-[#333333] font-mono text-[10px]">
                Esc
              </kbd>{' '}
              Close
            </span>
          </div>
          <span className="text-[10px] font-semibold text-[#D97757]">Makkari Search</span>
        </div>
      </div>
    </div>
  );
}
