'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useAuthStore } from '@/lib/store/use-auth-store';
import { useModelStore } from '@/lib/store/use-model-store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loadUserProfileFromSupabase } = useAuthStore();
  const { syncProviderStatus } = useModelStore();

  useEffect(() => {
    loadUserProfileFromSupabase();
    syncProviderStatus();
  }, [loadUserProfileFromSupabase, syncProviderStatus]);

  return (
    <div
      suppressHydrationWarning
      className="flex h-screen w-full bg-[#F7F6F3] dark:bg-[#121212] overflow-hidden text-[#1A1A1A] dark:text-[#E5E5E5]"
    >
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col h-full overflow-hidden" suppressHydrationWarning>
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto" suppressHydrationWarning>
          {children}
        </main>
      </div>
    </div>
  );

}
