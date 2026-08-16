'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/use-auth-store';
import { useModelStore } from '@/lib/store/use-model-store';
import { useChatStore } from '@/lib/store/use-chat-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import {
  User,
  Sliders,
  Sun,
  Moon,
  Monitor,
  Key,
  Shield,
  Code,
  Check,
  Camera,
  Search,
  Sparkles,
  Zap,
  HardDrive,
  AlertCircle,
  Loader2,
  Trash2,
  Edit2,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMemory, MemoryType, UserMemorySettings } from '@/lib/ai/memory/types';
import { SkillsToolsTab } from '@/components/settings/skills-tools-tab';

type SettingsTab =
  | 'general'
  | 'account'
  | 'personalization'
  | 'models'
  | 'skills'
  | 'storage'
  | 'developer'
  | 'apikeys';

function SettingsContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'general';

  const { user, updateProfile } = useAuthStore();
  const { providers, customKeys } = useModelStore();
  const { chats } = useChatStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'categories' | 'detail'>('categories');

  // General Form State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [preferredName, setPreferredName] = useState(user?.username || '');
  const [customInstructions, setCustomInstructions] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(user?.theme || 'system');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  // Personalization & Memory State
  const [memorySettings, setMemorySettings] = useState<UserMemorySettings>({
    id: '',
    user_id: '',
    personalization_enabled: true,
    memory_enabled: true,
    created_at: '',
    updated_at: '',
  });
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryType, setNewMemoryType] = useState<MemoryType>('preference');
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryContent, setEditingMemoryContent] = useState('');

  // Developer & Feedback State
  const [developerMode, setDeveloperMode] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // 1. Fetch memory settings and memory items
  const loadMemoryData = useCallback(async () => {
    setIsLoadingMemories(true);
    try {
      const [settingsRes, memoriesRes] = await Promise.all([
        fetch('/api/memory/settings'),
        fetch('/api/memory'),
      ]);

      if (settingsRes.ok && settingsRes.headers.get('content-type')?.includes('application/json')) {
        const settingsData = await settingsRes.json();
        if (settingsData.settings) {
          setMemorySettings(settingsData.settings);
        }
      }

      if (memoriesRes.ok && memoriesRes.headers.get('content-type')?.includes('application/json')) {
        const memoriesData = await memoriesRes.json();
        if (Array.isArray(memoriesData.memories)) {
          setMemories(memoriesData.memories);
        }
      }
    } catch (err) {
      console.error('[SETTINGS] Error loading memory data:', err);
    } finally {
      setIsLoadingMemories(false);
    }
  }, []);

  useEffect(() => {
    loadMemoryData();
  }, [loadMemoryData]);

  // Apply Theme class to document root with anti-flash consistency and persistent localStorage
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    const root = document.documentElement;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('makkari-theme', newTheme);
      } catch {
        // Ignore localStorage error
      }
    }

    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'light') {
      root.classList.remove('dark');
    } else {
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    updateProfile({ theme: newTheme });
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      full_name: fullName,
      username: preferredName,
      avatar_url: avatarUrl,
      theme,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success && data.avatarUrl) {
          setAvatarUrl(data.avatarUrl);
          await updateProfile({ avatar_url: data.avatarUrl });
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
          return;
        }
        setUploadError(data.error || 'Failed to upload avatar');
      } else {
        setUploadError('Failed to upload avatar. Server returned unexpected response.');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error uploading avatar.');
    } finally {
      setIsUploading(false);
    }
  };

  // Memory Toggles
  const handleTogglePersonalization = async () => {
    const newPersonalization = !memorySettings.personalization_enabled;
    setMemorySettings((prev) => ({ ...prev, personalization_enabled: newPersonalization }));
    try {
      await fetch('/api/memory/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalization_enabled: newPersonalization }),
      });
    } catch (err) {
      console.error('[SETTINGS] Error updating personalization toggle:', err);
    }
  };

  const handleToggleMemory = async () => {
    const newMemory = !memorySettings.memory_enabled;
    setMemorySettings((prev) => ({ ...prev, memory_enabled: newMemory }));
    try {
      await fetch('/api/memory/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memory_enabled: newMemory }),
      });
    } catch (err) {
      console.error('[SETTINGS] Error updating memory toggle:', err);
    }
  };

  // Add User Memory
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryContent.trim()) return;

    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newMemoryType,
          content: newMemoryContent.trim(),
        }),
      });

      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.memory) {
          setMemories((prev) => [data.memory, ...prev]);
          setNewMemoryContent('');
          setIsAddingMemory(false);
        }
      }
    } catch (err) {
      console.error('[SETTINGS] Error adding user memory:', err);
    }
  };

  // Edit User Memory
  const handleSaveMemoryEdit = async (memoryId: string) => {
    if (!editingMemoryContent.trim()) return;
    try {
      const res = await fetch(`/api/memory/${memoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingMemoryContent.trim() }),
      });

      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.memory) {
          setMemories((prev) => prev.map((m) => (m.id === memoryId ? data.memory : m)));
          setEditingMemoryId(null);
        }
      }
    } catch (err) {
      console.error('[SETTINGS] Error updating memory:', err);
    }
  };

  // Delete Single Memory
  const handleDeleteMemory = async (memoryId: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    try {
      await fetch(`/api/memory/${memoryId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('[SETTINGS] Error deleting memory:', err);
    }
  };

  // Clear Memories
  const handleClearMemories = async () => {
    if (!window.confirm('Are you sure you want to delete all saved memories? This action cannot be undone.')) {
      return;
    }
    setMemories([]);
    try {
      await fetch('/api/memory', { method: 'DELETE' });
    } catch (err) {
      console.error('[SETTINGS] Error clearing memories:', err);
    }
  };

  const navItems: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'account', label: 'Account', icon: User },
    { id: 'personalization', label: 'Personalization & Memory', icon: Sparkles },
    { id: 'models', label: 'Models', icon: Zap },
    { id: 'skills', label: 'Skills & Tools', icon: Shield },
    { id: 'storage', label: 'Storage & Usage', icon: HardDrive },
    { id: 'developer', label: 'Developer', icon: Code },
    { id: 'apikeys', label: 'API Keys', icon: Key },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-[#1A1A1A] dark:text-[#E5E5E5]">
          Settings
        </h1>
        <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-1">
          Customize your Makkari workspace, AI memory, appearance, and BYOK credentials.
        </p>
      </div>

      {/* Main Settings Container */}
      <div className="bg-white dark:bg-[#1C1C1C] border border-[#E8E5E0] dark:border-[#2E2E2E] rounded-3xl shadow-sm overflow-hidden min-h-[640px] grid grid-cols-1 md:grid-cols-4">
        {/* Left Sidebar Navigation */}
        <div
          className={cn(
            'p-4 border-r border-[#E8E5E0] dark:border-[#2E2E2E] bg-[#F7F6F3]/60 dark:bg-[#181818]/60 space-y-4',
            mobileView === 'detail' ? 'hidden md:block' : 'block'
          )}
        >
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#6B6B6B] dark:text-[#9E9E9E]" />
            <input
              type="text"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] rounded-2xl text-[#1A1A1A] dark:text-[#E5E5E5] placeholder-[#9E9E9E] focus:outline-none focus:border-[#D97757]"
            />
          </div>

          <div className="space-y-0.5">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileView('detail');
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-medium transition-all text-left cursor-pointer select-none min-h-[44px]',
                    isActive
                      ? 'bg-[#EFECE6] dark:bg-[#2A2A2A] text-[#D97757] font-semibold shadow-2xs'
                      : 'text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#EFECE6]/50 dark:hover:bg-[#242424]'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={cn(
                        'w-4 h-4',
                        isActive ? 'text-[#D97757]' : 'text-[#6B6B6B] dark:text-[#9E9E9E]'
                      )}
                    />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Main Content Panel */}
        <div
          className={cn(
            'md:col-span-3 p-4 sm:p-6 overflow-y-auto space-y-6',
            mobileView === 'categories' ? 'hidden md:block' : 'block'
          )}
        >
          {/* Mobile Back Button */}
          <div className="md:hidden pb-3 border-b border-[#E8E5E0] dark:border-[#2E2E2E]">
            <button
              onClick={() => setMobileView('categories')}
              className="flex items-center gap-2 text-xs font-semibold text-[#D97757] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Categories</span>
            </button>
          </div>

          {savedSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs rounded-2xl flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Settings updated successfully!</span>
            </div>
          )}

          {uploadError && (
            <div className="p-3 bg-[#C94B4B]/10 border border-[#C94B4B]/30 text-[#C94B4B] text-xs rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveGeneral} className="space-y-6">
              <div>
                <h2 className="text-base font-serif font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                  Profile & Identity
                </h2>
                <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-0.5">
                  Manage your avatar, displayed name, and system instructions.
                </p>
              </div>

              {/* Avatar Section */}
              <div className="flex items-center gap-5 p-4 rounded-2xl bg-[#F7F6F3] dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E]">
                <div className="relative group">
                  <Avatar src={avatarUrl} name={fullName} size="xl" />
                  <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] block">
                    Profile Picture
                  </span>
                  <label className="text-xs text-[#D97757] font-semibold hover:underline cursor-pointer">
                    {isUploading ? 'Uploading...' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[10px] text-[#9E9E9E] block">Supports JPG, PNG, WebP (Max 5MB)</span>
                </div>
              </div>

              {/* Name Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your Full Name"
                />
                <Input
                  label="What should Makkari call you?"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="Your preferred name"
                />
              </div>

              {/* Instructions for Makkari */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                  Instructions for Makkari
                </label>
                <p className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                  Makkari will keep these custom guidelines in mind across every conversation.
                </p>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g. Keep explanations concise, prioritize clean TypeScript code, and use structured headings."
                  rows={3}
                  className="w-full text-xs p-3 rounded-2xl bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] text-[#1A1A1A] dark:text-[#E5E5E5] placeholder-[#9E9E9E] focus:outline-none focus:border-[#D97757]"
                />
              </div>

              {/* Appearance & Theme Switcher */}
              <div className="space-y-3 pt-4 border-t border-[#E8E5E0] dark:border-[#2E2E2E]">
                <div>
                  <h3 className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">Appearance</h3>
                  <p className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                    Select your preferred interface color theme.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 max-w-md">
                  <button
                    type="button"
                    onClick={() => handleThemeChange('light')}
                    className={cn(
                      'flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-medium transition-all cursor-pointer min-h-[44px]',
                      theme === 'light'
                        ? 'border-[#D97757] bg-[#D97757]/10 text-[#D97757] font-semibold'
                        : 'border-[#E8E5E0] dark:border-[#2E2E2E] bg-white dark:bg-[#242424] text-[#1A1A1A] dark:text-[#E5E5E5]'
                    )}
                  >
                    <Sun className="w-4 h-4" />
                    <span>Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleThemeChange('dark')}
                    className={cn(
                      'flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-medium transition-all cursor-pointer min-h-[44px]',
                      theme === 'dark'
                        ? 'border-[#D97757] bg-[#D97757]/10 text-[#D97757] font-semibold'
                        : 'border-[#E8E5E0] dark:border-[#2E2E2E] bg-white dark:bg-[#242424] text-[#1A1A1A] dark:text-[#E5E5E5]'
                    )}
                  >
                    <Moon className="w-4 h-4" />
                    <span>Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleThemeChange('system')}
                    className={cn(
                      'flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-medium transition-all cursor-pointer min-h-[44px]',
                      theme === 'system'
                        ? 'border-[#D97757] bg-[#D97757]/10 text-[#D97757] font-semibold'
                        : 'border-[#E8E5E0] dark:border-[#2E2E2E] bg-white dark:bg-[#242424] text-[#1A1A1A] dark:text-[#E5E5E5]'
                    )}
                  >
                    <Monitor className="w-4 h-4" />
                    <span>System</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button variant="primary" type="submit">
                  Save General Settings
                </Button>
              </div>
            </form>
          )}

          {/* TAB 2: ACCOUNT */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-serif font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                  Account Details
                </h2>
                <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-0.5">
                  View your account credentials and subscription status.
                </p>
              </div>

              <Card className="space-y-4 bg-white dark:bg-[#242424] border-[#E8E5E0] dark:border-[#2E2E2E]">
                <Input
                  label="Email Address"
                  value={user?.email || ''}
                  disabled
                  className="bg-[#F7F6F3] dark:bg-[#181818] text-[#6B6B6B]"
                />
                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-[#6B6B6B] dark:text-[#9E9E9E]">Current Tier</span>
                  <span className="font-semibold text-[#D97757] bg-[#D97757]/10 px-2.5 py-1 rounded-full">
                    Free Tier • Personal
                  </span>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 3: PERSONALIZATION & MEMORY */}
          {activeTab === 'personalization' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-serif font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                  Personalization & Memory
                </h2>
                <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-0.5">
                  Control how Makkari remembers your preferences and projects to make future responses relevant.
                </p>
              </div>

              {/* Master Toggles */}
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[#F7F6F3] dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] block">
                      Enable Personalization
                    </span>
                    <span className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                      Makkari will inject relevant preferences and project context into future prompts.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTogglePersonalization}
                    className={cn(
                      'w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                      memorySettings.personalization_enabled ? 'bg-[#D97757]' : 'bg-[#E8E5E0] dark:bg-[#333333]'
                    )}
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded-full bg-white absolute top-1 transition-transform',
                        memorySettings.personalization_enabled ? 'left-6' : 'left-1'
                      )}
                    />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-[#F7F6F3] dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] block">
                      Enable AI Memory Updates
                    </span>
                    <span className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                      Automatically synthesize stable user preferences and project summaries from completed chats.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleMemory}
                    className={cn(
                      'w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                      memorySettings.memory_enabled ? 'bg-[#D97757]' : 'bg-[#E8E5E0] dark:bg-[#333333]'
                    )}
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded-full bg-white absolute top-1 transition-transform',
                        memorySettings.memory_enabled ? 'left-6' : 'left-1'
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Memory Management Section */}
              <div className="space-y-4 pt-4 border-t border-[#E8E5E0] dark:border-[#2E2E2E]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                      What Makkari Remembers ({memories.length})
                    </h3>
                    <p className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                      View, edit, or delete persistent knowledge about your workflow and preferences.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingMemory(!isAddingMemory)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#D97757] text-white text-xs font-semibold hover:bg-[#C66345] transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Memory</span>
                    </button>
                  </div>
                </div>

                {/* Add Memory Form Modal / Inline */}
                {isAddingMemory && (
                  <form
                    onSubmit={handleAddMemory}
                    className="p-4 rounded-2xl bg-white dark:bg-[#242424] border border-[#D97757] space-y-3 animate-in fade-in"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                        Add New Memory
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingMemory(false)}
                        className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A]"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] block mb-1">
                          Category Type
                        </label>
                        <select
                          value={newMemoryType}
                          onChange={(e) => setNewMemoryType(e.target.value as MemoryType)}
                          className="w-full text-xs p-2 rounded-xl bg-[#F7F6F3] dark:bg-[#181818] border border-[#E8E5E0] dark:border-[#2E2E2E] text-[#1A1A1A] dark:text-[#E5E5E5] focus:outline-none"
                        >
                          <option value="preference">Preference</option>
                          <option value="technical_preference">Technical Preference</option>
                          <option value="project">Project</option>
                          <option value="goal">Goal</option>
                          <option value="workflow">Workflow</option>
                          <option value="profile">Profile</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] block mb-1">
                        Memory Content
                      </label>
                      <input
                        type="text"
                        value={newMemoryContent}
                        onChange={(e) => setNewMemoryContent(e.target.value)}
                        placeholder="e.g. User prefers concise TypeScript examples without excessive boilerplate."
                        className="w-full text-xs p-2.5 rounded-xl bg-[#F7F6F3] dark:bg-[#181818] border border-[#E8E5E0] dark:border-[#2E2E2E] text-[#1A1A1A] dark:text-[#E5E5E5] placeholder-[#9E9E9E] focus:outline-none focus:border-[#D97757]"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="primary" size="sm" type="submit">
                        Save Memory
                      </Button>
                    </div>
                  </form>
                )}

                {/* Memory Items List */}
                {isLoadingMemories ? (
                  <div className="py-8 text-center text-xs text-[#6B6B6B] flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#D97757]" />
                    <span>Loading memories...</span>
                  </div>
                ) : memories.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#9E9E9E] italic rounded-2xl bg-[#F7F6F3] dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E]">
                    No saved memories yet. Makkari will learn preferences as you chat, or you can add one above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {memories.map((mem) => {
                      const isEditing = editingMemoryId === mem.id;
                      return (
                        <div
                          key={mem.id}
                          className="p-3.5 rounded-2xl bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          {isEditing ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="text"
                                value={editingMemoryContent}
                                onChange={(e) => setEditingMemoryContent(e.target.value)}
                                className="w-full text-xs p-2 rounded-xl bg-[#F7F6F3] dark:bg-[#181818] border border-[#D97757] text-[#1A1A1A] dark:text-[#E5E5E5] focus:outline-none"
                              />
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleSaveMemoryEdit(mem.id)}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setEditingMemoryId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-1">
                                <p className="text-xs text-[#1A1A1A] dark:text-[#E5E5E5] font-medium">
                                  {mem.content}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] bg-[#F7F6F3] dark:bg-[#181818] px-2 py-0.5 rounded-md border border-[#E8E5E0] dark:border-[#333333]">
                                    {mem.type.replace('_', ' ')}
                                  </span>
                                  <span
                                    className={cn(
                                      'text-[10px] font-semibold px-2 py-0.5 rounded-md',
                                      mem.source === 'user'
                                        ? 'bg-[#D97757]/10 text-[#D97757]'
                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    )}
                                  >
                                    {mem.source === 'user' ? 'Added by you' : 'Learned by Makkari'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMemoryId(mem.id);
                                    setEditingMemoryContent(mem.content);
                                  }}
                                  title="Edit memory"
                                  className="p-1.5 rounded-xl text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#181818] transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMemory(mem.id)}
                                  title="Delete memory"
                                  className="p-1.5 rounded-xl text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#C94B4B] hover:bg-[#C94B4B]/10 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Batch Clear Controls */}
                {memories.length > 0 && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleClearMemories}
                      className="text-xs text-[#C94B4B] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear All Memories</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MODELS */}
          {activeTab === 'models' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-serif font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                  AI Models & Providers
                </h2>
                <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-0.5">
                  Configure dynamic model providers, default models, and reasoning preferences.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {Object.keys(providers).map((provId) => {
                  const prov = providers[provId as keyof typeof providers];
                  return (
                    <div
                      key={provId}
                      className="p-4 rounded-2xl bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#D97757]/10 text-[#D97757] flex items-center justify-center font-bold">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] block">
                            {prov.name}
                          </span>
                          <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                            {prov.type === 'local' ? 'Local Ollama Node (127.0.0.1:11434)' : 'Cloud API Provider'}
                          </span>
                        </div>
                      </div>

                      {prov.status === 'connected' ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Connected ({prov.models.length} models)</span>
                        </span>
                      ) : prov.status === 'invalid_key' ? (
                        <span className="text-xs text-[#C94B4B] font-medium flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Invalid Key</span>
                        </span>
                      ) : prov.type === 'local' ? (
                        <span className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E]">
                          {prov.status === 'offline' ? 'Node Offline' : 'Unavailable'}
                        </span>
                      ) : (
                        <span className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E]">
                          {prov.hasKey || !!customKeys[provId] ? 'Configured' : 'Not Configured'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: SKILLS & TOOLS */}
          {activeTab === 'skills' && <SkillsToolsTab />}

          {/* TAB 6: STORAGE & USAGE */}
          {activeTab === 'storage' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-serif font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                  Storage & Usage Statistics
                </h2>
                <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-0.5">
                  Review real metrics for your active conversations, attachments, and memory items.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-[#F7F6F3] dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E]">
                  <span className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] block">Active Conversations</span>
                  <span className="text-xl font-bold font-serif text-[#1A1A1A] dark:text-[#E5E5E5] mt-1 block">
                    {chats.length}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#F7F6F3] dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E]">
                  <span className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] block">Saved Memories</span>
                  <span className="text-xl font-bold font-serif text-[#1A1A1A] dark:text-[#E5E5E5] mt-1 block">
                    {memories.length}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#F7F6F3] dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E]">
                  <span className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] block">Max Attachment Size</span>
                  <span className="text-xl font-bold font-serif text-[#1A1A1A] dark:text-[#E5E5E5] mt-1 block">
                    25 MB
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: API KEYS */}
          {activeTab === 'apikeys' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-serif font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                  API Keys & BYOK
                </h2>
                <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-0.5">
                  Manage your encrypted provider API keys stored securely with AES-256-GCM in Supabase.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {Object.keys(providers).map((provId) => {
                  const prov = providers[provId as keyof typeof providers];
                  const hasKey = prov.hasKey || !!customKeys[provId];
                  return (
                    <div
                      key={provId}
                      className="p-4 rounded-2xl bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#D97757]/10 text-[#D97757] flex items-center justify-center font-bold">
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] block">
                            {prov.name}
                          </span>
                          <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                            {prov.type === 'local' ? 'Local Ollama' : hasKey ? 'Key encrypted in DB' : 'No Key Configured'}
                          </span>
                        </div>
                      </div>

                      {hasKey ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E]">Optional</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 7: DEVELOPER MODE */}
          {activeTab === 'developer' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-serif font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                  Developer & Debug Mode
                </h2>
                <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-0.5">
                  Configure advanced streaming logs, raw prompt payloads, and experimental tools.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] block">
                    Developer Mode
                  </span>
                  <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                    Show token usage metrics, response latency, and stream trace logs.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDeveloperMode(!developerMode)}
                  className={cn(
                    'w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                    developerMode ? 'bg-[#D97757]' : 'bg-[#E8E5E0] dark:bg-[#333333]'
                  )}
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded-full bg-white absolute top-1 transition-transform',
                      developerMode ? 'left-6' : 'left-1'
                    )}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#6B6B6B]">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
