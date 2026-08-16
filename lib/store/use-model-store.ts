import { create } from 'zustand';
import { ProviderId, MakkariModel, ProviderStatus } from '@/lib/ai/types';
import { OllamaAdapter } from '@/lib/ai/providers/ollama';

export type ReasoningEffort = 'fast' | 'balanced' | 'deep' | 'low' | 'medium' | 'high' | string;

export interface ProviderState {
  id: ProviderId;
  name: string;
  type: 'local' | 'cloud';
  status: ProviderStatus;
  defaultModel: string;
  hasKey: boolean;
  keyHint?: string;
  models: MakkariModel[];
}

interface ModelStoreState {
  selectedProvider: ProviderId;
  selectedModel: string;
  selectedEffort: string;
  providers: Record<ProviderId, ProviderState>;
  customKeys: Record<string, string>;
  isLoadingDiscovery: boolean;
  lastSyncedAt: number | null;
  setSelectedProvider: (provider: ProviderId) => void;
  setSelectedModel: (model: string) => void;
  setSelectedEffort: (effort: string) => void;
  setCustomKey: (provider: ProviderId, key: string, hint: string) => void;
  removeCustomKey: (provider: ProviderId) => void;
  scanLocalOllama: () => Promise<void>;
  syncCloudModels: () => Promise<void>;
  refreshAllModels: () => Promise<void>;
  syncProviderStatus: () => Promise<void>;
}

export const INITIAL_PROVIDERS_STATE: Record<ProviderId, ProviderState> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'cloud',
    status: 'not_configured',
    defaultModel: 'gemini-1.5-flash',
    hasKey: true,
    keyHint: 'API Key / Cloud',
    models: [],
  },

  ollama: {
    id: 'ollama',
    name: 'Ollama (Local AI)',
    type: 'local',
    status: 'unavailable',
    defaultModel: 'llama3.2',
    hasKey: true,
    models: [],
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    type: 'cloud',
    status: 'not_configured',
    defaultModel: 'llama-3.3-70b-versatile',
    hasKey: false,
    models: [],
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'cloud',
    status: 'not_configured',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    hasKey: false,
    models: [],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    status: 'not_configured',
    defaultModel: 'gpt-4o',
    hasKey: false,
    models: [],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'cloud',
    status: 'not_configured',
    defaultModel: 'claude-3-5-sonnet-latest',
    hasKey: false,
    models: [],
  },
};

const ollamaAdapter = new OllamaAdapter();

export const useModelStore = create<ModelStoreState>((set, get) => ({
  selectedProvider: 'gemini',
  selectedModel: 'gemini-1.5-flash',


  selectedEffort: 'medium',
  providers: INITIAL_PROVIDERS_STATE,
  customKeys: {},
  isLoadingDiscovery: false,
  lastSyncedAt: null,

  setSelectedProvider: (provider) =>
    set((state) => {
      const targetProv = state.providers[provider];
      const availableModels = targetProv?.models || [];
      const fallbackModel = availableModels[0]?.id || targetProv?.defaultModel || state.selectedModel;

      return {
        selectedProvider: provider,
        selectedModel: fallbackModel,
      };
    }),

  setSelectedModel: (model) => set({ selectedModel: model }),
  setSelectedEffort: (effort) => set({ selectedEffort: effort }),

  setCustomKey: (provider, key, hint) =>
    set((state) => ({
      customKeys: { ...state.customKeys, [provider]: key },
      providers: {
        ...state.providers,
        [provider]: {
          ...state.providers[provider],
          hasKey: true,
          keyHint: hint,
          status: 'connected',
        },
      },
    })),

  removeCustomKey: (provider) =>
    set((state) => {
      const newKeys = { ...state.customKeys };
      delete newKeys[provider];
      return {
        customKeys: newKeys,
        providers: {
          ...state.providers,
          [provider]: {
            ...state.providers[provider],
            hasKey: false,
            keyHint: undefined,
            status: 'not_configured',
          },
        },
      };
    }),

  // Client-side local Ollama scan (127.0.0.1:11434)
  scanLocalOllama: async () => {
    try {
      const health = await ollamaAdapter.getLocalStatus();
      if (health.status === 'connected') {
        const models = await ollamaAdapter.listInstalledModels();
        set((state) => ({
          providers: {
            ...state.providers,
            ollama: {
              ...state.providers.ollama,
              status: 'connected',
              models: models.length > 0 ? models : state.providers.ollama.models,
            },
          },
        }));
      } else {
        set((state) => ({
          providers: {
            ...state.providers,
            ollama: {
              ...state.providers.ollama,
              status: 'unavailable',
            },
          },
        }));
      }
    } catch {
      set((state) => ({
        providers: {
          ...state.providers,
          ollama: {
            ...state.providers.ollama,
            status: 'unavailable',
          },
        },
      }));
    }
  },

  // Server-side cloud models discovery
  syncCloudModels: async () => {
    try {
      const res = await fetch('/api/models/discovery');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();

      if (data.success) {
        set((state) => {
          const updated = { ...state.providers };

          Object.keys(data.models || {}).forEach((key) => {
            const pId = key as ProviderId;
            const modelsList = data.models[pId] as MakkariModel[];
            const status = data.statuses?.[pId] as ProviderStatus;

            if (updated[pId]) {
              updated[pId] = {
                ...updated[pId],
                models: modelsList && modelsList.length > 0 ? modelsList : updated[pId].models,
                status: status || updated[pId].status,
                hasKey: status === 'connected',
              };
            }
          });

          // Auto-fallback check for currently selected model
          const currentProv = updated[state.selectedProvider];
          const hasCurrentModel = currentProv?.models.some((m) => m.id === state.selectedModel);
          let newSelectedModel = state.selectedModel;

          if (!hasCurrentModel && currentProv?.models && currentProv.models.length > 0) {
            newSelectedModel = currentProv.models[0].id;
          }

          return {
            providers: updated,
            selectedModel: newSelectedModel,
            lastSyncedAt: data.timestamp || Date.now(),
          };
        });
      }
    } catch (err) {
      console.warn('[MODEL_STORE] Cloud discovery sync warning:', err);
    }
  },

  refreshAllModels: async () => {
    set({ isLoadingDiscovery: true });
    try {
      await Promise.all([get().scanLocalOllama(), get().syncCloudModels()]);
    } finally {
      set({ isLoadingDiscovery: false });
    }
  },

  syncProviderStatus: async () => {
    await get().refreshAllModels();
  },
}));
