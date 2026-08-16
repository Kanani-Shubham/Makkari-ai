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
  Key,
  Layers,
  ChevronRight,
  X,
  FileText,
  Sliders,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SkillDefinition } from '@/lib/ai/skills/types';
import { ToolDefinition } from '@/lib/ai/tools/types';
import { MCPServerConfig } from '@/lib/ai/mcp/types';

export function SkillsToolsTab() {
  const searchParams = useSearchParams();
  const [subTab, setSubTab] = useState<'skills' | 'tools' | 'mcp'>('skills');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [mcpErrorMsg, setMcpErrorMsg] = useState<string>('');


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
      url: 'https://mcp.canva.com/mcp',
      transport: 'streamable-http',
      status: 'disconnected',
      toolCatalog: [],
    },
    {
      id: 'github-mcp',
      name: 'GitHub MCP',
      url: 'https://api.githubcopilot.com/mcp',
      transport: 'streamable-http',
      status: 'disconnected',
      toolCatalog: [],
    },
  ]);

  const [isAddingMcp, setIsAddingMcp] = useState(false);
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpUrl, setNewMcpUrl] = useState('');
  const [newMcpKey, setNewMcpKey] = useState('');
  const [mcpConnectingId, setMcpConnectingId] = useState<string | null>(null);
  const [mcpSuccessMsg, setMcpSuccessMsg] = useState('');
  const [tokenInputs, setTokenInputs] = useState<Record<string, string>>({});
  const [tokenInputVisible, setTokenInputVisible] = useState<Record<string, boolean>>({});

  // Initial load
  useEffect(() => {
    // 1. Fetch real persisted MCP connections from backend
    async function loadMcpConnections() {
      try {
        const res = await fetch('/api/mcp/connections');
        if (res.ok) {
          const data = await res.json();
          if (data.servers && Array.isArray(data.servers)) {
            setMcpServers(data.servers);
          }
        }
      } catch (err) {
        console.error('Failed to load persisted MCP servers:', err);
      }
    }

    loadMcpConnections();

    // Handle OAuth Redirect Status Params
    const mcpParam = searchParams?.get('mcp');
    const statusParam = searchParams?.get('status');
    const errorParam = searchParams?.get('error');
    const toolsCount = searchParams?.get('tools');

    if (mcpParam) {
      setSubTab('mcp');
      if (statusParam === 'connected') {
        setMcpSuccessMsg(
          `Successfully connected Canva MCP! (${toolsCount || 0} tools discovered)`
        );
      } else if (statusParam === 'error' && errorParam) {
        setMcpErrorMsg(
          errorParam.includes('invalid_request')
            ? 'Canva rejected authorization request. Check PKCE, scopes, and redirect URI in Canva Developer Portal.'
            : decodeURIComponent(errorParam)
        );
      }
    }

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

  // Direct Canva OAuth Flow Launch
  const handleLaunchCanvaOAuth = async (serverId: string) => {
    setMcpConnectingId(serverId);
    try {
      const authRes = await fetch('/api/mcp/auth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: 'canva-mcp' }),
      });

      const authData = await authRes.json();
      if (authData.authUrl) {
        window.location.href = authData.authUrl;
        return;
      }
      alert(authData.message || 'Canva OAuth initiation failed');
    } catch (err: any) {
      console.error('Error starting Canva OAuth:', err);
      alert('Failed to start Canva OAuth: ' + err.message);
    } finally {
      setMcpConnectingId(null);
    }
  };

  // Connect MCP Server via Real Backend Handshake & OAuth
  const handleConnectMcp = async (serverId: string, directKey?: string) => {
    setMcpConnectingId(serverId);
    setMcpSuccessMsg('');

    try {
      const server = mcpServers.find((s) => s.id === serverId);
      const keyToUse = directKey || tokenInputs[serverId] || server?.apiKey;

      const isCanvaServer =
        serverId === 'canva-mcp' ||
        serverId?.toLowerCase().includes('canva') ||
        server?.name?.toLowerCase().includes('canva') ||
        server?.url?.includes('canva.com');

      const isGithubServer =
        serverId === 'github-mcp' ||
        serverId?.toLowerCase().includes('github') ||
        server?.name?.toLowerCase().includes('github') ||
        server?.url?.includes('githubcopilot.com');

      // If connecting Canva or GitHub without any direct token, launch official OAuth
      if (!keyToUse && isCanvaServer) {
        await handleLaunchCanvaOAuth(serverId);
        return;
      }

      if (!keyToUse && isGithubServer) {
        try {
          const authRes = await fetch('/api/mcp/auth/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverId: 'github-mcp' }),
          });

          const authData = await authRes.json();
          if (authData.mode === 'oauth_redirect' && authData.authUrl) {
            window.location.href = authData.authUrl;
            return;
          }

          setTokenInputVisible((prev) => ({ ...prev, [serverId]: true }));
          setMcpServers((prev) =>
            prev.map((s) =>
              s.id === serverId
                ? {
                    ...s,
                    status: 'auth_required',
                    errorMessage:
                      authData.message ||
                      `Authentication required for ${server?.name}. Enter your access token below.`,
                  }
                : s
            )
          );
          setMcpConnectingId(null);
          return;
        } catch (authErr) {
          console.error('[MCP_AUTH_START] Failed:', authErr);
        }
      }



      const res = await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          url: server?.url,
          name: server?.name,
          apiKey: keyToUse,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMcpServers((prev) =>
          prev.map((s) =>
            s.id === serverId
              ? {
                  ...s,
                  status: 'connected',
                  apiKey: keyToUse,
                  toolCatalog: data.tools || [],
                  lastDiscoveredAt: new Date().toISOString(),
                  lastConnectedAt: new Date().toISOString(),
                  errorMessage: undefined,
                }
              : s
          )
        );
        setTokenInputVisible((prev) => ({ ...prev, [serverId]: false }));
        setMcpSuccessMsg(
          `Connected to ${server?.name || 'MCP Server'} (${data.tools?.length || 0} tools discovered).`
        );
        setTimeout(() => setMcpSuccessMsg(''), 4000);
      } else {
        const errMsg = data.error || 'Connection failed';
        const isAuth =
          data.status === 'auth_required' ||
          res.status === 401 ||
          errMsg.includes('Authentication required') ||
          errMsg.includes('401');

        if (isAuth) {
          setTokenInputVisible((prev) => ({ ...prev, [serverId]: true }));
        }

        setMcpServers((prev) =>
          prev.map((s) =>
            s.id === serverId
              ? {
                  ...s,
                  status: isAuth ? 'auth_required' : 'error',
                  errorMessage: errMsg,
                }
              : s
          )
        );
      }
    } catch (err: any) {
      setMcpServers((prev) =>
        prev.map((s) =>
          s.id === serverId
            ? {
                ...s,
                status: 'error',
                errorMessage: err.message || 'Network error',
              }
            : s
        )
      );
    } finally {
      setMcpConnectingId(null);
    }
  };


  // Disconnect MCP Server
  const handleDisconnectMcp = async (serverId: string) => {
    try {
      await fetch('/api/mcp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId }),
      });

      setMcpServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, status: 'disconnected', errorMessage: undefined } : s))
      );
    } catch (err) {
      console.error('Error disconnecting MCP server:', err);
    }
  };

  // Refresh Discovered Tools
  const handleRefreshMcpTools = async (serverId: string) => {
    setMcpConnectingId(serverId);
    try {
      const res = await fetch('/api/mcp/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMcpServers((prev) =>
          prev.map((s) =>
            s.id === serverId
              ? {
                  ...s,
                  status: 'connected',
                  toolCatalog: data.tools || [],
                  lastDiscoveredAt: new Date().toISOString(),
                  errorMessage: undefined,
                }
              : s
          )
        );
        setMcpSuccessMsg(`Discovered ${data.tools?.length || 0} tools from ${data.server?.name || serverId}.`);
        setTimeout(() => setMcpSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      console.error('Failed to refresh MCP tools:', err);
    } finally {
      setMcpConnectingId(null);
    }
  };

  // Add Custom MCP Server
  const handleAddCustomMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMcpName || !newMcpUrl) return;

    const serverId = newMcpName.toLowerCase().replace(/\s+/g, '-');
    setMcpConnectingId(serverId);

    try {
      const res = await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          name: newMcpName,
          url: newMcpUrl,
          apiKey: newMcpKey || undefined,
          transport: 'streamable-http',
        }),
      });

      const data = await res.json();

      const newServer: MCPServerConfig = {
        id: serverId,
        name: newMcpName,
        url: newMcpUrl,
        transport: 'streamable-http',
        apiKey: newMcpKey || undefined,
        status: res.ok && data.success ? 'connected' : 'error',
        lastDiscoveredAt: new Date().toISOString(),
        toolCatalog: data.tools || [],
        errorMessage: data.error,
      };

      setMcpServers((prev) => [...prev.filter((s) => s.id !== serverId), newServer]);
      setIsAddingMcp(false);
      setNewMcpName('');
      setNewMcpUrl('');
      setNewMcpKey('');

      if (res.ok && data.success) {
        setMcpSuccessMsg(`Added and connected "${newServer.name}".`);
      } else {
        setMcpSuccessMsg(`Saved "${newServer.name}" (Status: ${newServer.errorMessage || 'Disconnected'}).`);
      }
      setTimeout(() => setMcpSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Error adding MCP server:', err);
    } finally {
      setMcpConnectingId(null);
    }
  };

  // Remove MCP Server
  const handleRemoveMcp = (serverId: string) => {
    handleDisconnectMcp(serverId);
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

          {/* Success Banner */}
          {mcpSuccessMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{mcpSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setMcpSuccessMsg('')}
                className="text-emerald-700 dark:text-emerald-400 hover:opacity-75 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Error Banner */}
          {mcpErrorMsg && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center justify-between text-xs text-red-800 dark:text-red-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>{mcpErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setMcpErrorMsg('')}
                className="text-red-700 dark:text-red-400 hover:opacity-75 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">

            {mcpServers.map((server) => {
              const discoveredTools = server.toolCatalog || [];
              const hasTools = discoveredTools.length > 0;
              const isCanva =
                server.id === 'canva-mcp' ||
                server.name.toLowerCase().includes('canva') ||
                server.url.includes('canva.com');
              const isAuthReq = server.status === 'auth_required' || server.status === 'auth_expired';
              const showTokenInput = tokenInputVisible[server.id] && !isCanva;
              const isConnecting = mcpConnectingId === server.id;

              return (
                <div
                  key={server.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#2E2E2E] flex flex-col justify-between gap-3 shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] flex items-center gap-2 flex-wrap">
                          <span>{server.name}</span>
                          {server.status === 'connected' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>Connected</span>
                            </span>
                          ) : server.status === 'authorizing' || server.status === 'connecting' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Connecting...</span>
                            </span>
                          ) : server.status === 'auth_required' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              <span>Auth Required</span>
                            </span>
                          ) : server.status === 'auth_expired' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Auth Expired</span>
                            </span>
                          ) : server.status === 'error' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Error</span>
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFECE6] dark:bg-[#1E1E1E] text-[#6B6B6B] dark:text-[#9E9E9E]">
                              Disconnected
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E] mt-1">
                          {isCanva
                            ? 'Create, edit, search and export your Canva designs directly from Makkari.'
                            : 'Connect streamable HTTP MCP servers. Tools are cached and selectively routed.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        {!isCanva && (
                          <button
                            type="button"
                            onClick={() =>
                              setTokenInputVisible((prev) => ({
                                ...prev,
                                [server.id]: !prev[server.id],
                              }))
                            }
                            className="p-1 rounded-lg text-[#6B6B6B] hover:text-[#D97757] hover:bg-[#F7F6F3] dark:hover:bg-[#1E1E1E] transition-colors cursor-pointer"
                            title="Enter Token / Key"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveMcp(server.id)}
                          className="p-1 rounded-lg text-[#6B6B6B] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                          title="Remove Server"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Auth Guidance or Error Banner */}
                    {server.errorMessage && (
                      <div
                        className={cn(
                          'mt-2.5 p-2 rounded-xl border text-[11px] flex items-start gap-1.5',
                          isAuthReq
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
                            : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300'
                        )}
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="break-all">{server.errorMessage}</span>
                      </div>
                    )}

                    {/* Manual Token Input (Only for custom/other servers) */}
                    {showTokenInput && server.status !== 'connected' && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-[#F7F6F3] dark:bg-[#181818] border border-[#E8E5E0] dark:border-[#2E2E2E] space-y-1.5">
                        <label className="text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] block">
                          Personal Access Token / API Key:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            placeholder="Paste token (e.g. ghp_...)"
                            value={tokenInputs[server.id] || ''}
                            onChange={(e) =>
                              setTokenInputs((prev) => ({
                                ...prev,
                                [server.id]: e.target.value,
                              }))
                            }
                            className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-[#E8E5E0] dark:border-[#2E2E2E] bg-white dark:bg-[#242424] text-[#1A1A1A] dark:text-[#E5E5E5] font-mono focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => handleConnectMcp(server.id, tokenInputs[server.id])}
                            disabled={isConnecting}
                            className="px-2.5 py-1 text-xs rounded-lg bg-[#D97757] text-white font-medium hover:bg-[#C26243] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Authenticate
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Discovered Tools List */}
                    <div className="mt-3">
                      <span className="text-[10px] font-semibold text-[#6B6B6B] dark:text-[#9E9E9E] block mb-1">
                        Discovered Tools ({discoveredTools.length}):
                      </span>
                      {hasTools ? (
                        <div className="flex flex-wrap gap-1">
                          {discoveredTools.map((t) => (
                            <span
                              key={t.name}
                              title={t.description}
                              className="text-[10px] px-2 py-0.5 rounded-lg bg-[#F7F6F3] dark:bg-[#181818] text-[#1A1A1A] dark:text-[#E5E5E5] font-mono"
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#9E9E9E] italic">
                          {server.status === 'connected'
                            ? 'No tools discovered from endpoint.'
                            : 'Connect to discover tools automatically.'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E]">
                      {server.status === 'connected'
                        ? 'Canva account: Connected securely'
                        : server.lastDiscoveredAt
                        ? `Cached: ${new Date(server.lastDiscoveredAt).toLocaleTimeString()}`
                        : '○ Not connected'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {server.status === 'connected' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDisconnectMcp(server.id)}
                            className="px-2.5 py-1 rounded-xl text-xs text-[#6B6B6B] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer font-medium"
                          >
                            Disconnect
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRefreshMcpTools(server.id)}
                            disabled={isConnecting}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#D97757]/10 text-[#D97757] hover:bg-[#D97757]/20 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw
                              className={cn('w-3 h-3', isConnecting && 'animate-spin')}
                            />
                            <span>Refresh Tools</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            isCanva
                              ? handleLaunchCanvaOAuth(server.id)
                              : handleConnectMcp(server.id)
                          }
                          disabled={isConnecting}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#D97757] hover:bg-[#C26243] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isConnecting ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Connecting to Canva...</span>
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>{isCanva ? 'Connect Canva' : 'Connect Account'}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}


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
