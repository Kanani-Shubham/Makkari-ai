import { create } from 'zustand';
import { ConversationArtifact, ArtifactFile } from '../artifacts/types';

interface ArtifactState {
  artifacts: Record<string, ConversationArtifact[]>; // keyed by chatId
  activeArtifact: ConversationArtifact | null;
  activeFileId: string | null;
  viewMode: 'preview' | 'code';
  isWorkspaceOpen: boolean;
  isFullscreen: boolean;

  // Actions
  setChatArtifacts: (chatId: string, artifacts: ConversationArtifact[]) => void;
  addOrUpdateArtifact: (chatId: string, artifact: ConversationArtifact) => void;
  openArtifact: (artifact: ConversationArtifact, fileId?: string) => void;
  closeWorkspace: () => void;
  setActiveFileId: (fileId: string) => void;
  setViewMode: (mode: 'preview' | 'code') => void;
  toggleFullscreen: () => void;
  updateFileContent: (fileId: string, newContent: string) => void;
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  artifacts: {},
  activeArtifact: null,
  activeFileId: null,
  viewMode: 'preview',
  isWorkspaceOpen: false,
  isFullscreen: false,

  setChatArtifacts: (chatId, artifacts) =>
    set((state) => ({
      artifacts: { ...state.artifacts, [chatId]: artifacts },
    })),

  addOrUpdateArtifact: (chatId, artifact) =>
    set((state) => {
      const existing = state.artifacts[chatId] || [];
      const idx = existing.findIndex((a) => a.id === artifact.id);
      const updatedList = idx >= 0
        ? existing.map((a, i) => (i === idx ? artifact : a))
        : [artifact, ...existing];

      return {
        artifacts: { ...state.artifacts, [chatId]: updatedList },
        activeArtifact: state.activeArtifact?.id === artifact.id ? artifact : state.activeArtifact,
      };
    }),

  openArtifact: (artifact, fileId) => {
    const entryFile = artifact.files.find((f) => f.is_entry_file) || artifact.files[0];
    const initialFileId = fileId || entryFile?.id || null;
    const isHtml = entryFile?.language === 'html' || entryFile?.filename.endsWith('.html');

    set({
      activeArtifact: artifact,
      activeFileId: initialFileId,
      viewMode: isHtml ? 'preview' : 'code',
      isWorkspaceOpen: true,
    });
  },

  closeWorkspace: () =>
    set({
      isWorkspaceOpen: false,
      activeArtifact: null,
      activeFileId: null,
      isFullscreen: false,
    }),

  setActiveFileId: (fileId) =>
    set((state) => {
      const file = state.activeArtifact?.files.find((f) => f.id === fileId);
      const isHtml = file?.language === 'html' || file?.filename.endsWith('.html');
      return {
        activeFileId: fileId,
        viewMode: isHtml ? 'preview' : 'code',
      };
    }),

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),

  updateFileContent: (fileId, newContent) =>
    set((state) => {
      if (!state.activeArtifact) return state;

      const updatedFiles = state.activeArtifact.files.map((f) =>
        f.id === fileId ? { ...f, content: newContent, version: (f.version || 1) + 1 } : f
      );

      const updatedArtifact = { ...state.activeArtifact, files: updatedFiles };

      return {
        activeArtifact: updatedArtifact,
        artifacts: {
          ...state.artifacts,
          [updatedArtifact.chat_id]: (state.artifacts[updatedArtifact.chat_id] || []).map((a) =>
            a.id === updatedArtifact.id ? updatedArtifact : a
          ),
        },
      };
    }),
}));
