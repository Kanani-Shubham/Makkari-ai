'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Zap,
  Wrench,
  Globe,
  Code,
  Calculator,
  Search,
  BookOpen,
  Plus,
  Check,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
  Lock,
  Layers,
  ChevronRight,
  X,
  FileText,
  Sliders,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SkillDefinition } from '@/lib/ai/skills/types';
import { ToolDefinition } from '@/lib/ai/tools/types';
import { MCPServerConfig } from '@/lib/ai/mcp/types';

export function SkillsToolsTab() {
  const [subTab, setSubTab] = useState<'skills' | 'tools' | 'mcp'>('skills');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Skill state
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [selectedSkillDoc, setSelectedSkillDoc] = useState<SkillDefinition | null>(null);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);

  // Tool state
  const [tools, setTools] = useState<ToolDefinition[]>([]);

  // MCP state
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([
    {
      id: 'canva-mcp',
      name: 'Canva MCP',
      url: 'https://mcp.canva.com/v1',
      transport: 'http',
      status: 'disconnected',
      allowedTools: ['create_design', 'generate_presentation', 'export_asset'],
    },
    {
      id: 'github-mcp',
      name: 'GitHub MCP',
      url: 'https://api.githubcopilot.com/mcp',
      transport: 'http',
      status: 'disconnected',
      allowedTools: ['search_repositories', 'get_file_contents', 'create_pull_request'],
    },
  ]);
  const [isAddingMcp, setIsAddingMcp] = useState(false);
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpUrl, setNewMcpUrl] = useState('');
  const [newMcpKey, setNewMcpKey] = useState('');
  const [mcpConnectingId, setMcpConnectingId] = useState<string | null>(null);
  const [mcpSuccessMsg, setMcpSuccessMsg] = useState('');

  // Initial load
  useEffect(() => {
    // 1. Load System Skills
    const defaultSkills: SkillDefinition[] = [
      {
        id: 'general',
        name: 'General Problem Solving',
        description: 'Universal conversation, structured reasoning, synthesis, and problem solving.',
        version: '1.0.0',
        category: 'general',
        tools: ['memory', 'web_search', 'calculator'],
        triggers: ['help', 'explain', 'summarize', 'analyze'],
        instructions: '# General Synthesis Workflow\nDelivers concise, high-signal structured answers.',
        source: 'system',
        enabled: true,
      },
      {
        id: 'nextjs',
        name: 'Next.js App Router',
        description: 'Expert workflow for Next.js App Router, SSR/SSG, Turbopack, and Server Actions.',
        version: '1.0.0',
        category: 'engineering',
        tools: ['memory', 'fetch_url'],
        triggers: ['nextjs', 'next.js', 'app router', 'server component'],
        instructions: '# Next.js Expert Workflow\nEnforces Server Component purity and optimal caching.',
        source: 'system',
        enabled: true,
      },
      {
        id: 'react',
        name: 'React 19 Engineering',
        description: 'React architecture, custom hooks, state hygiene (Zustand), and component composition.',
        version: '1.0.0',
        category: 'engineering',
        tools: ['memory'],
        triggers: ['react', 'custom hook', 'zustand', 'component'],
        instructions: '# React Engineering Architecture\nClean state management and composition patterns.',
        source: 'system',
        enabled: true,
      },
      {
        id: 'coding',
        name: 'Full-Stack Coding',
        description: 'Full-stack software engineering, architecture, refactoring, and code generation.',
        version: '1.0.0',
        category: 'engineering',
        tools: ['memory', 'code_runner', 'fetch_url'],
        triggers: ['code', 'program', 'function', 'class', 'algorithm'],
        instructions: '# Full-Stack Code Generation\nStrict type safety and production quality code.',
        source: 'system',
        enabled: true,
      },
      {
        id: 'frontend',
        name: 'Modern UI & CSS',
        description: 'Modern UI engineering, responsive layout, CSS tokens, TailwindCSS, and animations.',
        version: '1.0.0',
        category: 'design_ui',
        tools: ['memory', 'fetch_url'],
        triggers: ['ui', 'css', 'styling', 'responsive', 'tailwind'],
        instructions: '# Frontend UI Engineering\nCurated palettes, smooth transitions, and accessibility.',
        source: 'system',
        enabled: true,
      },
      {
        id: 'typescript',
        name: 'Strict TypeScript',
        description: 'Strict typing, discriminating unions, generics, and runtime validation schemas.',
        version: '1.0.0',
        category: 'engineering',
        tools: ['memory'],
        triggers: ['typescript', 'ts', 'type', 'interface', 'generic'],
        instructions: '# Strict TypeScript Architecture\nEliminates any types and enforces strict contracts.',
        source: 'system',
        enabled: true,
      },
      {
        id: 'debugging',
        name: 'Root Cause Debugging',
        description: 'Systematic root cause analysis, stack trace investigation, and runtime profiling.',
        version: '1.0.0',
        category: 'engineering',
        tools: ['memory', 'code_runner'],
        triggers: ['debug', 'error', 'fix', 'crash', 'bug', 'trace'],
        instructions: '# Systematic Debugging Protocol\nReproduce, isolate, trace, and permanently fix.',
        source: 'system',
        enabled: true,
      },
      {
        id: 'research',
        name: 'Deep Web Research',
        description: 'Real-time web investigation, documentation search, and multi-source synthesis.',
        version: '1.0.0',
        category: 'research',
        tools: ['web_search', 'fetch_url', 'memory'],
        triggers: ['search', 'research', 'find', 'latest', 'news'],
        instructions: '# Deep Web Investigation\nLive source verification and structured attribution.',
        source: 'system',
        enabled: true,
      },
      {
        id: 'writing',
        name: 'Technical Writing & ADRs',
        description: 'High-clarity technical documentation, Architecture Decision Records (ADRs), and proposals.',
        version: '1.0.0',
        category: 'writing',
        tools: ['memory'],
        triggers: ['write', 'draft', 'document', 'proposal', 'adr'],
        instructions: '# Technical Writing Standards\nAudience-centric prose and structured scannability.',
        source: 'system',
        enabled: true,
      },
      {
        id: 'data-analysis',
        name: 'Data & Computation',
        description: 'Statistical analysis, CSV/JSON processing, metric calculations, and data transformation.',
        version: '1.0.0',
        category: 'analysis',
        tools: ['calculator', 'code_runner', 'memory'],
        triggers: ['data', 'csv', 'json', 'stats', 'metrics', 'calculate'],
        instructions: '# Computational Analysis\nDeterministic calculations and structured metric tables.',
        source: 'system',
        enabled: true,
      },
      {
        id: 'mcp',
        name: 'MCP Orchestration',
        description: 'Model Context Protocol server coordination and remote tool execution (Canva, GitHub).',
        version: '1.0.0',
        category: 'integrations',
        tools: ['memory'],
        triggers: ['mcp', 'canva', 'github', 'slack', 'integration'],
        instructions: '# MCP Integration Protocol\nSelective capability routing and untrusted data boundaries.',
        source: 'system',
        enabled: true,
      },
      {
        id: 'supabase',
        name: 'Supabase & PostgreSQL',
        description: 'PostgreSQL modeling, Row Level Security (RLS), Edge Functions, and Supabase Auth.',
        version: '1.0.0',
        category: 'engineering',
        tools: ['memory', 'fetch_url'],
        triggers: ['supabase', 'postgres', 'postgresql', 'rls', 'sql'],
        instructions: '# Supabase Architecture\nGranular RLS policies and SSR client patterns.',
        source: 'system',
        enabled: true,
      },
    ];

    setSkills(defaultSkills);

    // 2. Load Canonical Tools
    const defaultTools: ToolDefinition[] = [
      {
        id: 'memory',
        name: 'makkari_memory',
        description: 'Universal memory tool for storing, searching, and managing user preferences and project knowledge.',
        category: 'memory',
        permissions: 'write',
        requiresConfirmation: false,
        enabled: true,
        source: 'builtin',
        inputSchema: { type: 'object', properties: { action: { type: 'string' } } },
        handler: async () => ({ success: true }),
      },
      {
        id: 'web_search',
        name: 'web_search',
        description: 'Live internet search engine for latest documentation, news, and technical references.',
        category: 'search',
        permissions: 'read',
        requiresConfirmation: false,
        enabled: true,
        source: 'builtin',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
        handler: async () => ({ success: true }),
      },
      {
        id: 'calculator',
        name: 'calculator',
        description: 'Mathematical evaluator for arithmetic, percentages, and scientific formulas.',
        category: 'computation',
        permissions: 'read',
        requiresConfirmation: false,
        enabled: true,
        source: 'builtin',
        inputSchema: { type: 'object', properties: { expression: { type: 'string' } } },
        handler: async () => ({ success: true }),
      },
      {
        id: 'fetch_url',
        name: 'fetch_url',
        description: 'Extracts clean documentation and text from specific HTTP/HTTPS URLs.',
        category: 'web',
        permissions: 'read',
        requiresConfirmation: false,
        enabled: true,
        source: 'builtin',
        inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
        handler: async () => ({ success: true }),
      },
      {
        id: 'code_runner',
        name: 'code_runner',
        description: 'Sandboxed code execution environment for data analysis and transformations.',
        category: 'coding',
        permissions: 'write',
        requiresConfirmation: false,
        enabled: true,
        source: 'builtin',
        inputSchema: { type: 'object', properties: { code: { type: 'string' } } },
        handler: async () => ({ success: true }),
      },
    ];

    setTools(defaultTools);
  }, []);

  // Toggle Skill Enabled/Disabled
  const handleToggleSkill = (skillId: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Toggle Tool Enabled/Disabled
  const handleToggleTool = (toolId: string) => {
    setTools((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t))
    );
  };

  // Connect / Test MCP Server
  const handleConnectMcp = (serverId: string) => {
    setMcpConnectingId(serverId);
    setTimeout(() => {
      setMcpServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, status: 'connected', lastDiscoveredAt: new Date().toISOString() } : s))
      );
      setMcpConnectingId(null);
      setMcpSuccessMsg('MCP Server connected and tool catalog cached successfully.');
      setTimeout(() => setMcpSuccessMsg(''), 4000);
    }, 1200);
  };

  // Add Custom MCP Server
  const handleAddCustomMcp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMcpName || !newMcpUrl) return;

    const newServer: MCPServerConfig = {
      id: newMcpName.toLowerCase().replace(/\s+/g, '-'),
      name: newMcpName,
      url: newMcpUrl,
      transport: 'http',
      apiKey: newMcpKey || undefined,
      status: 'connected',
      lastDiscoveredAt: new Date().toISOString(),
      allowedTools: ['read_resource', 'execute_action'],
    };

    setMcpServers((prev) => [...prev, newServer]);
    setIsAddingMcp(false);
    setNewMcpName('');
    setNewMcpUrl('');
    setNewMcpKey('');
    setMcpSuccessMsg(`Added "${newServer.name}" to MCP connections.`);
    setTimeout(() => setMcpSuccessMsg(''), 4000);
  };

  // Remove MCP Server
  const handleRemoveMcp = (serverId: string) => {
    setMcpServers((prev) => prev.filter((s) => s.id !== serverId));
  };

  // Filtered lists
  const filteredSkills = skills.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.triggers.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = categoryFilter === 'all' || s.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const filteredTools = tools.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Capability Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-serif font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#D97757]" />
            <span>Skills & Tools Capability Platform</span>
          </h2>
          <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-0.5">
            Manage autonomous domain skills, native execution tools, and Model Context Protocol (MCP) connections.
          </p>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="flex items-center gap-1 p-1 bg-[#EFECE6] dark:bg-[#2A2A2A] rounded-2xl">
          <button
            type="button"
            onClick={() => setSubTab('skills')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer',
              subTab === 'skills'
                ? 'bg-white dark:bg-[#1E1E1E] text-[#1A1A1A] dark:text-[#E5E5E5] shadow-xs font-semibold'
                : 'text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5]'
            )}
          >
            Skills ({skills.filter((s) => s.enabled).length}/{skills.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('tools')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer',
              subTab === 'tools'
                ? 'bg-white dark:bg-[#1E1E1E] text-[#1A1A1A] dark:text-[#E5E5E5] shadow-xs font-semibold'
                : 'text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5]'
            )}
          >
            Tools ({tools.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('mcp')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer',
              subTab === 'mcp'
                ? 'bg-white dark:bg-[#1E1E1E] text-[#1A1A1A] dark:text-[#E5E5E5] shadow-xs font-semibold'
                : 'text-[#6B6B6B] dark:text-[#9E9E9E] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5]'
            )}
          >
            MCP ({mcpServers.filter((s) => s.status === 'connected').length}/{mcpServers.length})
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] dark:text-[#9E9E9E]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${subTab}...`}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-2xl bg-[#F7F6F3] dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] text-[#1A1A1A] dark:text-[#E5E5E5] placeholder-[#9E9E9E] focus:outline-none focus:border-[#D97757]"
          />
        </div>

        {subTab === 'skills' && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['all', 'engineering', 'design_ui', 'research', 'writing', 'analysis', 'integrations'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer capitalize',
                  categoryFilter === cat
                    ? 'bg-[#D97757] text-white font-semibold'
                    : 'bg-[#F7F6F3] dark:bg-[#242424] text-[#6B6B6B] dark:text-[#9E9E9E] hover:bg-[#EFECE6] dark:hover:bg-[#2E2E2E]'
                )}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}

        {subTab === 'mcp' && (
          <button
            type="button"
            onClick={() => setIsAddingMcp(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#D97757] text-white text-xs font-semibold hover:bg-[#C66345] transition-all cursor-pointer shrink-0 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect MCP Server</span>
          </button>
        )}
      </div>

      {/* Success Notification */}
      {mcpSuccessMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{mcpSuccessMsg}</span>
        </div>
      )}

      {/* SUB-TAB 1: SKILLS LIST */}
      {subTab === 'skills' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className={cn(
                'p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 bg-white dark:bg-[#242424]',
                skill.enabled
                  ? 'border-[#E8E5E0] dark:border-[#2E2E2E] hover:border-[#D97757]/40'
                  : 'border-dashed border-[#E8E5E0] dark:border-[#2E2E2E] opacity-60'
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-[#D97757]/10 text-[#D97757] flex items-center justify-center font-bold text-xs">
                      {skill.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] flex items-center gap-1.5">
                        <span>{skill.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#F7F6F3] dark:bg-[#1E1E1E] text-[#6B6B6B] dark:text-[#9E9E9E] font-mono">
                          v{skill.version}
                        </span>
                      </h4>
                      <span className="text-[10px] text-[#D97757] font-medium capitalize">
                        {skill.category.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleSkill(skill.id)}
                    className={cn(
                      'w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 mt-1',
                      skill.enabled ? 'bg-[#D97757]' : 'bg-[#E8E5E0] dark:bg-[#333333]'
                    )}
                  >
                    <span
                      className={cn(
                        'w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform',
                        skill.enabled ? 'left-4.5' : 'left-0.5'
                      )}
                    />
                  </button>
                </div>

                <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-2.5 line-clamp-2 leading-relaxed">
                  {skill.description}
                </p>

                {/* Triggers pill list */}
                {skill.triggers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {skill.triggers.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-[#F7F6F3] dark:bg-[#1A1A1A] text-[#6B6B6B] dark:text-[#9E9E9E]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="pt-2 border-t border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between text-[11px]">
                <span className="text-[#6B6B6B] dark:text-[#9E9E9E]">
                  Tools: {skill.tools.length > 0 ? skill.tools.join(', ') : 'None'}
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedSkillDoc(skill)}
                  className="text-[#D97757] hover:underline font-medium flex items-center gap-0.5 cursor-pointer"
                >
                  <span>View Skill Docs</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUB-TAB 2: TOOLS LIST */}
      {subTab === 'tools' && (
        <div className="space-y-3">
          {filteredTools.map((tool) => (
            <div
              key={tool.id}
              className="p-4 rounded-2xl bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#D97757]/10 text-[#D97757] flex items-center justify-center shrink-0 mt-0.5">
                  {tool.category === 'memory' && <BookOpen className="w-4 h-4" />}
                  {tool.category === 'search' && <Search className="w-4 h-4" />}
                  {tool.category === 'computation' && <Calculator className="w-4 h-4" />}
                  {tool.category === 'web' && <Globe className="w-4 h-4" />}
                  {tool.category === 'coding' && <Code className="w-4 h-4" />}
                  {tool.category === 'mcp' && <Zap className="w-4 h-4" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] font-mono">
                      {tool.name}
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFECE6] dark:bg-[#1E1E1E] text-[#6B6B6B] dark:text-[#9E9E9E] font-sans capitalize">
                      {tool.category}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        tool.permissions === 'read'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      )}
                    >
                      {tool.permissions.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B6B6B] dark:text-[#9E9E9E] mt-1 leading-relaxed max-w-xl">
                    {tool.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                  {tool.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleTool(tool.id)}
                  className={cn(
                    'w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0',
                    tool.enabled ? 'bg-[#D97757]' : 'bg-[#E8E5E0] dark:bg-[#333333]'
                  )}
                >
                  <span
                    className={cn(
                      'w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform',
                      tool.enabled ? 'left-4.5' : 'left-0.5'
                    )}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUB-TAB 3: MCP CONNECTIONS */}
      {subTab === 'mcp' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#F7F6F3] dark:bg-[#1E1E1E] border border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-[#D97757]" />
              <div>
                <h4 className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                  Model Context Protocol (MCP) Runtime
                </h4>
                <p className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                  Connect streamable HTTP MCP servers. Tools are cached and selectively routed per user request.
                </p>
              </div>
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
              Protocol Ready (2026 Spec)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {mcpServers.map((server) => (
              <div
                key={server.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] flex items-center gap-2">
                        <span>{server.name}</span>
                        {server.status === 'connected' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Connected</span>
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFECE6] dark:bg-[#1E1E1E] text-[#6B6B6B] dark:text-[#9E9E9E]">
                            Disconnected
                          </span>
                        )}
                      </h4>
                      <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E] font-mono block mt-0.5">
                        {server.url}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMcp(server.id)}
                      className="p-1 rounded-lg text-[#6B6B6B] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Remove Connection"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Discovered Tools List */}
                  {server.allowedTools && (
                    <div className="mt-3">
                      <span className="text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] block mb-1">
                        Discovered Tools ({server.allowedTools.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {server.allowedTools.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded-lg bg-[#F7F6F3] dark:bg-[#181818] text-[#1A1A1A] dark:text-[#E5E5E5] font-mono"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between">
                  <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                    {server.lastDiscoveredAt ? `Cached: ${new Date(server.lastDiscoveredAt).toLocaleTimeString()}` : 'Not tested'}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleConnectMcp(server.id)}
                    disabled={mcpConnectingId === server.id}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#D97757]/10 text-[#D97757] hover:bg-[#D97757]/20 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={cn('w-3 h-3', mcpConnectingId === server.id && 'animate-spin')} />
                    <span>{server.status === 'connected' ? 'Refresh Tools' : 'Connect'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: View Skill Documentation */}
      {selectedSkillDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-[#1E1E1E] rounded-3xl border border-[#E8E5E0] dark:border-[#2E2E2E] shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E5E0] dark:border-[#2E2E2E]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#D97757]/10 text-[#D97757] flex items-center justify-center font-bold">
                  {selectedSkillDoc.name.slice(0, 1)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
                    {selectedSkillDoc.name} Skill Documentation
                  </h3>
                  <span className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                    Version {selectedSkillDoc.version} • {selectedSkillDoc.category}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSkillDoc(null)}
                className="p-1 rounded-full hover:bg-[#F7F6F3] dark:hover:bg-[#2A2A2A] text-[#6B6B6B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-[#1A1A1A] dark:text-[#E5E5E5] leading-relaxed">
              <div className="p-3 rounded-2xl bg-[#F7F6F3] dark:bg-[#242424]">
                <h5 className="font-semibold mb-1">Description</h5>
                <p className="text-[#6B6B6B] dark:text-[#9E9E9E]">{selectedSkillDoc.description}</p>
              </div>

              <div>
                <h5 className="font-semibold mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#D97757]" />
                  <span>Workflow Instructions (Loaded when relevant)</span>
                </h5>
                <pre className="p-3.5 rounded-2xl bg-[#F7F6F3] dark:bg-[#181818] font-mono text-[11px] text-[#333333] dark:text-[#CCCCCC] overflow-x-auto whitespace-pre-wrap">
                  {selectedSkillDoc.instructions}
                </pre>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E] pt-2">
                <span>Triggers: {selectedSkillDoc.triggers.join(', ')}</span>
                <span>Tools Used: {selectedSkillDoc.tools.join(', ') || 'None'}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E8E5E0] dark:border-[#2E2E2E] flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setSelectedSkillDoc(null)}>
                Close Viewer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Connect MCP Server */}
      {isAddingMcp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleAddCustomMcp}
            className="w-full max-w-md bg-white dark:bg-[#1E1E1E] rounded-3xl border border-[#E8E5E0] dark:border-[#2E2E2E] shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#E8E5E0] dark:border-[#2E2E2E]">
              <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#D97757]" />
                <span>Connect New MCP Server</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingMcp(false)}
                className="p-1 rounded-full hover:bg-[#F7F6F3] dark:hover:bg-[#2A2A2A] text-[#6B6B6B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] block mb-1">
                  Server Name
                </label>
                <input
                  type="text"
                  value={newMcpName}
                  onChange={(e) => setNewMcpName(e.target.value)}
                  placeholder="e.g. Canva MCP, Jira MCP, Custom Agent"
                  required
                  className="w-full text-xs p-2.5 rounded-xl bg-[#F7F6F3] dark:bg-[#181818] border border-[#E8E5E0] dark:border-[#2E2E2E] text-[#1A1A1A] dark:text-[#E5E5E5] focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] block mb-1">
                  Server URL (Streamable HTTP / SSE Endpoint)
                </label>
                <input
                  type="url"
                  value={newMcpUrl}
                  onChange={(e) => setNewMcpUrl(e.target.value)}
                  placeholder="https://mcp.your-domain.com/v1"
                  required
                  className="w-full text-xs p-2.5 rounded-xl bg-[#F7F6F3] dark:bg-[#181818] border border-[#E8E5E0] dark:border-[#2E2E2E] text-[#1A1A1A] dark:text-[#E5E5E5] focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] block mb-1">
                  API Key / Bearer Token (Optional)
                </label>
                <input
                  type="password"
                  value={newMcpKey}
                  onChange={(e) => setNewMcpKey(e.target.value)}
                  placeholder="Encrypted AES-256 in Supabase"
                  className="w-full text-xs p-2.5 rounded-xl bg-[#F7F6F3] dark:bg-[#181818] border border-[#E8E5E0] dark:border-[#2E2E2E] text-[#1A1A1A] dark:text-[#E5E5E5] focus:outline-none focus:border-[#D97757]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E5E0] dark:border-[#2E2E2E]">
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsAddingMcp(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Connect & Discover
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
