import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url?: string;
  theme: 'light' | 'dark' | 'system';
  preferred_model_id: string;
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  loadUserProfileFromSupabase: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
}

function applyThemeToDOM(theme: 'light' | 'dark' | 'system') {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => {
    if (user?.theme) applyThemeToDOM(user.theme);
    set({ user, isAuthenticated: !!user, isLoading: false });
  },

  // Load real profile from Supabase & Apply theme
  loadUserProfileFromSupabase: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (data.profile) {
            if (data.profile.theme) {
              applyThemeToDOM(data.profile.theme);
            }
            set({ user: data.profile, isAuthenticated: true });
            return;
          }
        }
      }
      set({ user: null, isAuthenticated: false });
    } catch (err) {
      console.error('[AUTH_STORE] Error loading profile from Supabase:', err);
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  // Update profile in Supabase & Zustand
  updateProfile: async (data) => {
    if (data.theme) {
      applyThemeToDOM(data.theme);
    }

    set((state) => ({
      user: state.user ? { ...state.user, ...data } : null,
    }));

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const resData = await res.json();
          if (resData.profile) {
            if (resData.profile.theme) applyThemeToDOM(resData.profile.theme);
            set({ user: resData.profile });
          }
        }
      }
    } catch (err) {
      console.error('[AUTH_STORE] Error updating profile in Supabase:', err);
    }
  },

  logout: async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AUTH_STORE] Error signing out:', err);
    }
    set({ user: null, isAuthenticated: false });
  },
}));
