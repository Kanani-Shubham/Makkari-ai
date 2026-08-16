'use client';

import React, { useState } from 'react';
import { ChevronDown, Sparkles, Server, Check } from 'lucide-react';
import { useModelStore } from '@/lib/store/use-model-store';
import { ProviderId } from '@/lib/ai/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function ModelSelector() {
  const { selectedProvider, selectedModel, providers, setSelectedProvider, setSelectedModel } = useModelStore();
  const [isOpen, setIsOpen] = useState(false);

  const currentProvider = providers[selectedProvider];
  const currentModelSpec = currentProvider?.models.find((m) => m.id === selectedModel) || {
    name: selectedModel,
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E8E5E0] bg-white text-sm font-medium text-[#1A1A1A] hover:bg-[#F7F6F3] shadow-2xs transition-all cursor-pointer"
      >
        <span className="w-2 h-2 rounded-full bg-[#D97757]" />
        <span>{currentModelSpec.name}</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {currentProvider?.name}
        </Badge>
        <ChevronDown className="w-4 h-4 text-[#6B6B6B]" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-80 z-50 rounded-2xl bg-white border border-[#E8E5E0] shadow-lg p-2 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-[#E8E5E0] mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider">
                Select Model & Provider
              </span>
              <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
            </div>

            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {(Object.keys(providers) as ProviderId[]).map((provId) => {
                const prov = providers[provId];
                return (
                  <div key={provId} className="mb-2">
                    <div className="px-2 py-1 flex items-center justify-between text-xs font-medium text-[#6B6B6B]">
                      <span className="flex items-center gap-1.5">
                        <Server className="w-3 h-3 text-[#A86A4A]" />
                        {prov.name}
                      </span>
                      {prov.type === 'local' ? (
                        <Badge variant={prov.status === 'connected' ? 'success' : 'secondary'} className="text-[9px]">
                          {prov.status === 'connected' ? 'Local Online' : 'Local Offline'}
                        </Badge>
                      ) : (
                        <Badge variant={prov.hasKey ? 'primary' : 'warning'} className="text-[9px]">
                          {prov.hasKey ? 'Ready' : 'BYOK Needed'}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-0.5 mt-1">
                      {prov.models.map((model) => {
                        const isSelected = selectedProvider === provId && selectedModel === model.id;
                        return (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedProvider(provId);
                              setSelectedModel(model.id);
                              setIsOpen(false);
                            }}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl text-left transition-colors cursor-pointer',
                              isSelected
                                ? 'bg-[#D97757]/10 text-[#D97757] font-semibold'
                                : 'text-[#1A1A1A] hover:bg-[#F7F6F3]'
                            )}
                          >
                            <div className="flex flex-col">
                              <span>{model.name}</span>
                              {model.badge && (
                                <span className="text-[10px] text-[#6B6B6B] font-normal">{model.badge}</span>
                              )}
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#D97757]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
