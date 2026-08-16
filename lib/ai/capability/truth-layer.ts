import { toolRegistry } from '../tools/registry';
import { mcpRegistry } from '../mcp/registry';
import { ToolDefinition } from '../tools/types';
import { MCPServerConfig } from '../mcp/types';
import { ProviderId } from '../types';

export interface CapabilityDecision {
  tool: string;
  name: string;
  source: 'builtin' | 'mcp' | 'custom' | 'provider';
  exists: boolean;
  enabled: boolean;
  providerSupported: boolean;
  userAuthorized: boolean;
  connected: boolean;
  authenticated: boolean;
  executable: boolean;
  reason?: string;
}

export interface ModelCapabilityMatrix {
  chat: boolean;
  streaming: boolean;
  nativeTools: boolean;
  textToolProtocol: boolean;
  structuredOutput: boolean;
  vision: boolean;
  reasoning: boolean;
  artifacts: boolean;
}

export interface RuntimeCapabilityContext {
  modelId: string;
  providerId: ProviderId;
  userId?: string;
  chatId?: string;
  prompt: string;
  modelCapabilities?: Partial<ModelCapabilityMatrix>;
}

export interface RuntimeCapabilityResolution {
  executableTools: ToolDefinition[];
  disconnectedServices: Array<{ id: string; name: string; reason: string }>;
  decisions: CapabilityDecision[];
  promptManifest: string;
  supportsTools: boolean;
}

/**
 * Resolves the absolute runtime truth of available and executable tools for a session.
 * Evaluates: Tool Exists -> Enabled -> Model Supports -> User Authorized -> MCP Connected -> MCP Authenticated -> Executable.
 */
export async function resolveRuntimeCapabilities(
  ctx: RuntimeCapabilityContext
): Promise<RuntimeCapabilityResolution> {
  const decisions: CapabilityDecision[] = [];
  const executableTools: ToolDefinition[] = [];
  const disconnectedServices: Array<{ id: string; name: string; reason: string }> = [];

  const modelCaps: ModelCapabilityMatrix = {
    chat: true,
    streaming: true,
    nativeTools: true,
    textToolProtocol: true,
    structuredOutput: true,
    vision: false,
    reasoning: false,
    artifacts: true,
    ...ctx.modelCapabilities,
  };

  const modelAllowsTools = modelCaps.nativeTools || modelCaps.textToolProtocol;

  // 1. Evaluate Built-in Native Tools
  const allBuiltin = toolRegistry.getAllTools().filter((t) => t.source === 'builtin');
  for (const tool of allBuiltin) {
    const isEnabled = tool.enabled;
    const isModelSupported = modelAllowsTools;
    const isUserAuth = true; // Builtin tools are authorized for authenticated users

    const isExec = isEnabled && isModelSupported && isUserAuth;
    const reason = !isEnabled
      ? 'Tool is disabled in configuration'
      : !isModelSupported
      ? 'Selected model does not support tool execution'
      : undefined;

    decisions.push({
      tool: tool.id,
      name: tool.name,
      source: 'builtin',
      exists: true,
      enabled: isEnabled,
      providerSupported: isModelSupported,
      userAuthorized: isUserAuth,
      connected: true,
      authenticated: true,
      executable: isExec,
      reason,
    });

    if (isExec) {
      executableTools.push(tool);
    }
  }

  // 2. Evaluate MCP Servers & Lazy Tool Discovery
  const allMcpServers = mcpRegistry.getAllServers();
  const promptLower = ctx.prompt.toLowerCase();

  for (const server of allMcpServers) {
    const isConnected = server.status === 'connected';

    if (!isConnected) {
      disconnectedServices.push({
        id: server.id,
        name: server.name,
        reason: `${server.name} is not connected in this workspace.`,
      });

      decisions.push({
        tool: `mcp.${server.id}`,
        name: server.name,
        source: 'mcp',
        exists: true,
        enabled: false,
        providerSupported: modelAllowsTools,
        userAuthorized: true,
        connected: false,
        authenticated: false,
        executable: false,
        reason: `${server.name} is currently disconnected.`,
      });
      continue;
    }

    // Check if user intent matches this connected server
    let matched = false;
    if (
      server.id === 'canva-mcp' &&
      (promptLower.includes('canva') ||
        promptLower.includes('presentation') ||
        promptLower.includes('design') ||
        promptLower.includes('slide') ||
        promptLower.includes('poster'))
    ) {
      matched = true;
    } else if (
      server.id === 'github-mcp' &&
      (promptLower.includes('github') ||
        promptLower.includes('repo') ||
        promptLower.includes('commit') ||
        promptLower.includes('pull request') ||
        promptLower.includes('pr'))
    ) {
      matched = true;
    } else if (
      promptLower.includes(server.id.toLowerCase()) ||
      promptLower.includes(server.name.toLowerCase())
    ) {
      matched = true;
    }

    if (matched) {
      try {
        const discovered = await mcpRegistry.discoverServerTools(server.id);
        for (const t of discovered) {
          const registered =
            toolRegistry.getTool(t.name) ||
            toolRegistry.getTool(`mcp_${server.id}_${t.name}`) ||
            toolRegistry.getTool(`mcp:${server.id}:${t.name}`);
          const isExec = modelAllowsTools && (registered ? registered.enabled : true);


          decisions.push({
            tool: `mcp.${server.id}.${t.name}`,
            name: t.name,
            source: 'mcp',
            exists: true,
            enabled: registered ? registered.enabled : true,
            providerSupported: modelAllowsTools,
            userAuthorized: true,
            connected: true,
            authenticated: true,
            executable: isExec,
          });

          if (isExec && registered) {
            executableTools.push(registered);
          }
        }
      } catch (err: any) {
        decisions.push({
          tool: `mcp.${server.id}`,
          name: server.name,
          source: 'mcp',
          exists: true,
          enabled: false,
          providerSupported: modelAllowsTools,
          userAuthorized: true,
          connected: true,
          authenticated: false,
          executable: false,
          reason: `MCP discovery error: ${err.message || 'Unknown'}`,
        });
      }
    }
  }

  // 3. Build Capability Truth Prompt Manifest
  const manifestBlocks: string[] = [];

  manifestBlocks.push('<capability_truth>');
  if (executableTools.length > 0) {
    manifestBlocks.push('<available_executable_tools>');
    for (const t of executableTools) {
      manifestBlocks.push(
        `- **tool**: "${t.name}"\n  **description**: ${t.description}\n  **parameters**: ${JSON.stringify(t.inputSchema)}`
      );
    }
    manifestBlocks.push('</available_executable_tools>');

    manifestBlocks.push(`<tool_calling_protocol>
You have access to the executable tools listed above.
CRITICAL INSTRUCTION:
When the user asks you to perform a task that a tool can perform (e.g. calculate an expression, fetch a URL, search the web, create an artifact, store a memory):
1. DO NOT describe what you will do or explain that you have access to tools.
2. Immediately INVOKE the tool by outputting the following exact XML block:

<dots_function_call>
{"name": "tool_name", "parameters": {"param_name": "param_value"}}
</dots_function_call>

3. Stop generating after the closing </dots_function_call> tag. The system will execute the tool and provide the <tool_result> in the next turn so you can formulate your answer.
</tool_calling_protocol>`);
  } else {
    manifestBlocks.push('<available_executable_tools>NONE</available_executable_tools>');
  }

  // Explicitly list disconnected services so the model never claims they are available
  if (disconnectedServices.length > 0) {
    manifestBlocks.push('<disconnected_services_guidance>');
    for (const d of disconnectedServices) {
      manifestBlocks.push(`- **${d.name}**: DISCONNECTED. If the user asks you to use or create something with ${d.name}, inform them that ${d.name} is currently disconnected in this workspace and can be connected in Settings → Skills & Tools. Never fabricate tool execution, never invent fake design IDs/URLs, and never output placeholder command previews like "undefined".`);
    }
    manifestBlocks.push('</disconnected_services_guidance>');

  }

  manifestBlocks.push('</capability_truth>');


  return {
    executableTools,
    disconnectedServices,
    decisions,
    promptManifest: manifestBlocks.join('\n'),
    supportsTools: executableTools.length > 0,
  };
}
