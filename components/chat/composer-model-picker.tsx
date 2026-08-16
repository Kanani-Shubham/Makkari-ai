'use client';

import React, { useState } from 'react';
import { useModelStore, ReasoningEffort } from '@/lib/store/use-model-store';
import { ProviderId } from '@/lib/ai/types';
import { getModelCategories } from '@/lib/ai/discovery-service';
import { ChevronDown, Check, Server, Cpu, Zap, Brain, Sliders, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ComposerModelPicker() {
  const {
    selectedProvider,
    selectedModel,
    selectedEffort,
    providers,
    setSelectedProvider,
    setSelectedModel,
    setSelectedEffort,
    refreshAllModels,
    isLoadingDiscovery,
  } = useModelStore();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'models' | 'effort'>('models');

  const currentProvider = providers[selectedProvider];
  const currentModelSpec = currentProvider?.models.find((m) => m.id === selectedModel) || {
    id: selectedModel,
    name: selectedModel,
    capabilities: {
      reasoning: { supported: false, visible: false, configurable: false },
    },
  };

  const isReasoningConfigurable =
    'capabilities' in currentModelSpec &&
    currentModelSpec.capabilities &&
    currentModelSpec.capabilities.reasoning &&
    currentModelSpec.capabilities.reasoning.configurable;

  const effortLabels: Record<string, { title: string; desc: string }> = {
    low: { title: 'Low / Fast', desc: 'Minimal thinking tokens for rapid responses' },
    medium: { title: 'Medium / Balanced', desc: 'Standard reasoning depth for most tasks' },
    high: { title: 'High / Deep', desc: 'Extended reasoning chain for complex reasoning' },
    fast: { title: 'Fast', desc: 'Speed optimized for rapid tasks' },
    balanced: { title: 'Balanced', desc: 'Smart reasoning and fast responses' },
    deep: { title: 'Deep Thinking', desc: 'Extended reasoning chain for complex problems' },
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#EFECE6]/70 dark:bg-[#2A2A2A]/70 hover:bg-[#EFECE6] dark:hover:bg-[#2A2A2A] border border-[#E8E5E0] dark:border-[#2E2E2E] text-xs font-medium text-[#1A1A1A] dark:text-[#E5E5E5] transition-all cursor-pointer select-none"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
        <span className="font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] truncate max-w-[140px]">
          {currentModelSpec.name}
        </span>
        {isReasoningConfigurable && (
          <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E] border-l border-[#E8E5E0] dark:border-[#2E2E2E] pl-1.5 font-normal capitalize">
            {selectedEffort}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-[#6B6B6B] dark:text-[#9E9E9E]" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 bottom-full mb-2 w-80 sm:w-96 z-50 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8E5E0] dark:border-[#2E2E2E] shadow-xl p-3 animate-in fade-in zoom-in-95 duration-150 text-xs">
            {/* Header Tabs */}
            <div className="flex items-center justify-between border-b border-[#E8E5E0] dark:border-[#2E2E2E] pb-2 mb-2 px-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('models')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer',
                    activeTab === 'models'
                      ? 'bg-[#D97757]/10 text-[#D97757] font-semibold'
                      : 'text-[#6B6B6B] dark:text-[#9E9E9E] hover:bg-[#F7F6F3] dark:hover:bg-[#242424]'
                  )}
                >
                  Models
                </button>
                {isReasoningConfigurable && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('effort')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer',
                      activeTab === 'effort'
                        ? 'bg-[#D97757]/10 text-[#D97757] font-semibold'
                        : 'text-[#6B6B6B] dark:text-[#9E9E9E] hover:bg-[#F7F6F3] dark:hover:bg-[#242424]'
                    )}
                  >
                    Effort ({selectedEffort})
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => refreshAllModels()}
                disabled={isLoadingDiscovery}
                title="Refresh models"
                className="p-1 rounded-lg text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#242424] transition-colors cursor-pointer"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isLoadingDiscovery && 'animate-spin text-[#D97757]')} />
              </button>
            </div>

            {/* Tab 1: Models Picker */}
            {activeTab === 'models' && (
              <div className="max-h-80 overflow-y-auto pr-1 space-y-3">
                {(Object.keys(providers) as ProviderId[]).map((provId) => {
                  const prov = providers[provId];
                  return (
                    <div key={provId} className="space-y-1">
                      <div className="flex items-center justify-between px-1 py-0.5 text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          {prov.type === 'local' ? (
                            <Server className="w-3 h-3 text-[#A86A4A]" />
                          ) : (
                            <Cpu className="w-3 h-3 text-[#D97757]" />
                          )}
                          {prov.name}
                        </span>
                        <span className="font-normal lowercase">
                          {prov.type === 'local'
                            ? prov.status === 'connected'
                              ? 'online'
                              : 'unavailable'
                            : prov.hasKey
                            ? 'ready'
                            : 'key needed'}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        {prov.models.length === 0 ? (
                          <div className="px-2 py-1.5 text-[11px] text-[#9E9E9E] italic">
                            {prov.type === 'local' ? 'No local models found on 127.0.0.1' : 'No discovered models'}
                          </div>
                        ) : (
                          prov.models.map((model) => {
                            const isSelected = selectedProvider === provId && selectedModel === model.id;
                            const categories = getModelCategories(model);

                            return (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => {
                                  setSelectedProvider(provId);
                                  setSelectedModel(model.id);
                                  setIsOpen(false);
                                }}
                                className={cn(
                                  'w-full flex items-start justify-between p-2 rounded-xl text-left transition-all cursor-pointer',
                                  isSelected
                                    ? 'bg-[#D97757]/10 border border-[#D97757]/30 text-[#D97757]'
                                    : 'hover:bg-[#F7F6F3] dark:hover:bg-[#242424] text-[#1A1A1A] dark:text-[#E5E5E5] border border-transparent'
                                )}
                              >
                                <div className="space-y-0.5 min-w-0 pr-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-xs text-[#1A1A1A] dark:text-[#E5E5E5]">
                                      {model.name}
                                    </span>
                                    {model.badge && (
                                      <span className="text-[9px] px-1.5 py-0.2 bg-[#EFECE6] dark:bg-[#2A2A2A] text-[#D97757] rounded-full font-medium">
                                        {model.badge}
                                      </span>
                                    )}
                                  </div>
                                  {categories.length > 0 && (
                                    <div className="flex gap-1 flex-wrap pt-0.5">
                                      {categories.slice(0, 3).map((cat) => (
                                        <span
                                          key={cat}
                                          className="text-[9px] text-[#6B6B6B] dark:text-[#9E9E9E] bg-[#E8E5E0]/50 dark:bg-[#2E2E2E]/50 px-1.5 rounded"
                                        >
                                          {cat}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab 2: Effort Selector */}
            {activeTab === 'effort' && isReasoningConfigurable && (
              <div className="space-y-1.5 py-1">
                {(['low', 'medium', 'high'] as ReasoningEffort[]).map((effortKey) => {
                  const isEffortSelected = selectedEffort === effortKey;
                  const item = effortLabels[effortKey] || { title: effortKey, desc: 'Reasoning effort level' };
                  return (
                    <button
                      key={effortKey}
                      type="button"
                      onClick={() => {
                        setSelectedEffort(effortKey);
                        setIsOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer',
                        isEffortSelected
                          ? 'bg-[#D97757]/10 border border-[#D97757]/30 text-[#D97757]'
                          : 'hover:bg-[#F7F6F3] dark:hover:bg-[#242424] text-[#1A1A1A] dark:text-[#E5E5E5] border border-transparent'
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-[#EFECE6] dark:bg-[#2A2A2A] text-[#D97757] mt-0.5">
                          {effortKey === 'low' ? (
                            <Zap className="w-3.5 h-3.5" />
                          ) : effortKey === 'medium' ? (
                            <Sliders className="w-3.5 h-3.5" />
                          ) : (
                            <Brain className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-xs text-[#1A1A1A] dark:text-[#E5E5E5] block">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E] block mt-0.5">
                            {item.desc}
                          </span>
                        </div>
                      </div>
                      {isEffortSelected && <Check className="w-4 h-4 text-[#D97757] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
