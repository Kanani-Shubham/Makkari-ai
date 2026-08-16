'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Settings,
  Sparkles,
  Cpu,
  LogOut,
  ChevronUp,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/use-auth-store';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface AccountMenuProps {
  onNavigate?: () => void;
}

export function AccountMenu({ onNavigate }: AccountMenuProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    router.push('/login');
  };

  const handleLinkClick = () => {
    setIsOpen(false);
    onNavigate?.();
  };

  return (
    <div ref={menuRef} className="relative select-none">
      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-[#1E1E1E] border border-[#E8E5E0] dark:border-[#2E2E2E] rounded-3xl shadow-xl overflow-hidden z-50 p-2 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* User Info Header */}
          <div className="px-3 py-2.5 bg-[#F7F6F3]/70 dark:bg-[#252525]/70 rounded-2xl mb-1 flex items-center gap-3">
            <Avatar src={user?.avatar_url} name={user?.full_name} size="md" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] truncate">
                {user?.full_name || 'Makkari User'}
              </span>
              <span className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E] truncate">
                {user?.email || 'Personal Account'}
              </span>
              <span className="text-[10px] text-[#D97757] font-semibold mt-0.5">
                Free Tier • Personal Plan
              </span>
            </div>
          </div>

          <div className="space-y-0.5 text-xs">
            <Link
              href="/settings?tab=personalization"
              onClick={handleLinkClick}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
              <span>Personalization & Memory</span>
            </Link>

            <Link
              href="/profile"
              onClick={handleLinkClick}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors"
            >
              <User className="w-3.5 h-3.5 text-[#6B6B6B] dark:text-[#9E9E9E]" />
              <span>Profile Details</span>
            </Link>

            <Link
              href="/settings"
              onClick={handleLinkClick}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-[#6B6B6B] dark:text-[#9E9E9E]" />
              <span>Settings</span>
            </Link>

            <Link
              href="/models"
              onClick={handleLinkClick}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-[#D97757]" />
              <span>Model Hub & BYOK</span>
            </Link>
          </div>

          <div className="pt-1 mt-1 border-t border-[#E8E5E0] dark:border-[#2E2E2E]">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#C94B4B] hover:bg-[#C94B4B]/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Profile Trigger Card */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between p-2 rounded-2xl transition-all cursor-pointer border',
          isOpen
            ? 'bg-white dark:bg-[#242424] border-[#D97757]/40 shadow-xs'
            : 'bg-white/60 dark:bg-[#202020]/60 border-[#E8E5E0] dark:border-[#2E2E2E] hover:bg-white dark:hover:bg-[#242424]'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar src={user?.avatar_url} name={user?.full_name} size="sm" />
          <div className="flex flex-col text-left min-w-0">
            <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] truncate max-w-[130px]">
              {user?.full_name || 'Makkari User'}
            </span>
            <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E]">Free Plan</span>
          </div>
        </div>

        <ChevronUp
          className={cn(
            'w-4 h-4 text-[#6B6B6B] dark:text-[#9E9E9E] transition-transform duration-200 shrink-0',
            isOpen ? 'rotate-180 text-[#D97757]' : ''
          )}
        />
      </button>
    </div>
  );
}
