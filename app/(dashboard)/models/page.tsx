'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useModelStore } from '@/lib/store/use-model-store';
import { ProviderId } from '@/lib/ai/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  Cpu,
  RefreshCw,
  Server,
  Trash2,
  Check,
  AlertCircle,
} from 'lucide-react';

export default function ModelHubPage() {
  const {
    providers,
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
    setCustomKey,
    removeCustomKey,
    scanLocalOllama,
    refreshAllModels,
    isLoadingDiscovery,
  } = useModelStore();

  const [activeModalProvider, setActiveModalProvider] = useState<ProviderId | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Initial sync on mount
  useEffect(() => {
    refreshAllModels().catch((err) => console.error('[MODEL_HUB] Status sync error:', err));
  }, [refreshAllModels]);

  const handleRefresh = useCallback(async () => {
    await refreshAllModels();
  }, [refreshAllModels]);

  // Save API key to Supabase
  const handleSaveKey = async () => {
    if (!activeModalProvider || !apiKeyInput.trim()) return;

    setIsValidating(true);
    setValidationError('');

    try {
      // 1. Validate Key
      const valRes = await fetch('/api/keys/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeModalProvider,
          apiKey: apiKeyInput.trim(),
        }),
      });

      if (valRes.ok && valRes.headers.get('content-type')?.includes('application/json')) {
        const valData = await valRes.json();
        if (!valData.valid) {
          setValidationError(valData.message || valData.error || 'Validation failed. Check API key.');
          setIsValidating(false);
          return;
        }
      } else {
        setValidationError('Validation service returned unexpected response.');
        setIsValidating(false);
        return;
      }

      // 2. Encrypt & Save to Supabase DB
      const saveRes = await fetch('/api/keys/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeModalProvider,
          apiKey: apiKeyInput.trim(),
        }),
      });

      if (saveRes.ok && saveRes.headers.get('content-type')?.includes('application/json')) {
        const saveData = await saveRes.json();
        if (!saveData.success) {
          setValidationError(saveData.error || 'Failed to save encrypted key in database.');
          setIsValidating(false);
          return;
        }
        setCustomKey(activeModalProvider, apiKeyInput.trim(), saveData.keyHint);
      } else {
        setValidationError('Failed to save key. Server returned unexpected response.');
        setIsValidating(false);
        return;
      }
      setActiveModalProvider(null);
      setApiKeyInput('');
      setSuccessMsg(`Successfully saved and encrypted ${providers[activeModalProvider]?.name} API key.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await refreshAllModels();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save API Key.');
    } finally {
      setIsValidating(false);
    }
  };

  // Delete API key from Supabase
  const handleDeleteKey = async (provId: ProviderId) => {
    try {
      const res = await fetch(`/api/keys/delete?provider=${provId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        removeCustomKey(provId);
        setSuccessMsg(`Removed API key for ${providers[provId]?.name}.`);
        setTimeout(() => setSuccessMsg(''), 3000);
        await refreshAllModels();
      }
    } catch (err) {
      console.error('[MODEL_HUB] Failed to delete API key:', err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#1A1A1A] dark:text-[#E5E5E5]">Model Hub & BYOK</h1>
          <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-1">
            Live discovery for cloud models (Gemini, Groq, OpenRouter) and client-side Ollama integration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoadingDiscovery}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiscovery ? 'animate-spin' : ''}`} />
            <span>Refresh Models</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => scanLocalOllama()} disabled={isLoadingDiscovery}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiscovery ? 'animate-spin' : ''}`} />
            <span>Scan Ollama (127.0.0.1)</span>
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid of Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(providers) as ProviderId[]).map((provId) => {
          const prov = providers[provId];
          const isCurrentProvider = selectedProvider === provId;

          return (
            <Card
              key={provId}
              className={`space-y-4 transition-all border ${
                isCurrentProvider ? 'border-[#D97757] ring-1 ring-[#D97757]/30 shadow-md' : 'border-[#E8E5E0] dark:border-[#2E2E2E]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D97757]/10 flex items-center justify-center text-[#D97757]">
                    {prov.type === 'local' ? <Server className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] flex items-center gap-2">
                      {prov.name}
                      {isCurrentProvider && (
                        <Badge variant="primary" className="text-[9px]">
                          Active Default
                        </Badge>
                      )}
                    </h3>
                    <span className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                      {prov.type === 'local' ? 'Runs on 127.0.0.1:11434' : 'Cloud Provider (BYOK / Env)'}
                    </span>
                  </div>
                </div>

                {prov.type === 'local' ? (
                  <Badge variant={prov.status === 'connected' ? 'success' : 'secondary'}>
                    {prov.status === 'connected' ? 'Online' : 'Unavailable'}
                  </Badge>
                ) : prov.hasKey ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="secondary">Optional</Badge>
                )}
              </div>

              {/* Models List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] tracking-wider">
                    Discovered Models ({prov.models.length})
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {prov.models.length === 0 ? (
                    <div className="p-3 text-center text-xs text-[#6B6B6B] dark:text-[#9E9E9E] bg-[#F7F6F3] dark:bg-[#1A1A1A] rounded-xl border border-dashed border-[#E8E5E0] dark:border-[#2E2E2E]">
                      {prov.type === 'local'
                        ? 'Ollama not detected on 127.0.0.1:11434 or no models pulled yet.'
                        : 'No models discovered. Click Refresh or configure an API key.'}
                    </div>
                  ) : (
                    prov.models.map((model) => {
                      const isSelected = isCurrentProvider && selectedModel === model.id;
                      return (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedProvider(provId);
                            setSelectedModel(model.id);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all text-xs cursor-pointer ${
                            isSelected
                              ? 'border-[#D97757] bg-[#D97757]/5 text-[#D97757] font-semibold'
                              : 'border-[#E8E5E0] dark:border-[#2E2E2E] bg-white dark:bg-[#1E1E1E] text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#242424]'
                          }`}
                        >
                          <div className="truncate">
                            <span>{model.name}</span>
                            {model.badge && (
                              <span className="ml-1.5 text-[9px] bg-[#EFECE6] dark:bg-[#2A2A2A] text-[#D97757] px-1.5 py-0.5 rounded-full font-medium">
                                {model.badge}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[9px] text-[#6B6B6B] dark:text-[#9E9E9E] truncate ml-2">
                            {model.id}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* API Key management for cloud providers */}
              {prov.type === 'cloud' && (
                <div className="pt-3 border-t border-[#E8E5E0]/60 dark:border-[#2E2E2E]/60 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                      {prov.hasKey ? `Key hint: ${prov.keyHint || '••••'}` : 'No API key configured'}
                    </span>
                    <span className="text-[9px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                      {prov.hasKey ? 'Key encrypted in DB' : 'Will fallback to server configuration'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {prov.hasKey && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteKey(provId)}
                        className="text-[#C94B4B] hover:bg-[#C94B4B]/10 hover:text-[#C94B4B]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setActiveModalProvider(provId)}>
                      {prov.hasKey ? 'Change Key' : 'Configure'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* API Key Config Modal */}
      <Modal
        isOpen={activeModalProvider !== null}
        onClose={() => {
          setActiveModalProvider(null);
          setApiKeyInput('');
          setValidationError('');
        }}
        title={activeModalProvider ? `Configure ${providers[activeModalProvider]?.name} Key` : ''}
        description="Your API key will be encrypted with Web Crypto AES-256-GCM and saved securely in Supabase."
      >
        <div className="space-y-4 pt-2">
          {validationError && (
            <div className="p-3 text-xs bg-[#C94B4B]/10 border border-[#C94B4B]/30 text-[#C94B4B] rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <Input
            label="API Key"
            type="password"
            placeholder={activeModalProvider ? `Enter ${providers[activeModalProvider]?.name} key` : ''}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveModalProvider(null);
                setApiKeyInput('');
                setValidationError('');
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveKey} disabled={isValidating}>
              {isValidating ? 'Validating...' : 'Validate & Encrypt Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
