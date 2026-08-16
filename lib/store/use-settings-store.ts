import { create } from 'zustand';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
  developerMode: boolean;
  autoSave: boolean;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setFontSize: (fontSize: 'small' | 'medium' | 'large') => void;
  setReducedMotion: (reduced: boolean) => void;
  setDeveloperMode: (dev: boolean) => void;
  setAutoSave: (autoSave: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'light',
  fontSize: 'medium',
  reducedMotion: false,
  developerMode: false,
  autoSave: true,
  setTheme: (theme) => set({ theme }),
  setFontSize: (fontSize) => set({ fontSize }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setDeveloperMode: (developerMode) => set({ developerMode }),
  setAutoSave: (autoSave) => set({ autoSave }),
}));
