import { ToolDefinition } from './types';
import { calculatorTool } from './builtin/calculator';
import { webSearchTool } from './builtin/web-search';
import { fetchUrlTool } from './builtin/fetch-url';
import { codeEvalTool } from './builtin/code-eval';
import { makkariMemoryTool } from './builtin/memory-tool';
import { makkariArtifactTool } from './builtin/artifact-tool';

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolDefinition> = new Map();

  private constructor() {
    this.registerDefaultTools();
  }

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  private registerDefaultTools() {
    this.registerTool(makkariMemoryTool);
    this.registerTool(makkariArtifactTool);
    this.registerTool(calculatorTool);
    this.registerTool(webSearchTool);
    this.registerTool(fetchUrlTool);
    this.registerTool(codeEvalTool);
  }

  public registerTool(tool: ToolDefinition) {
    this.tools.set(tool.id.toLowerCase(), tool);
    this.tools.set(tool.name.toLowerCase(), tool);
  }

  public unregisterTool(toolId: string) {
    this.tools.delete(toolId.toLowerCase());
  }

  public getTool(toolIdentifier: string): ToolDefinition | undefined {
    return this.tools.get(toolIdentifier.toLowerCase());
  }

  public getAllTools(): ToolDefinition[] {
    const uniqueTools = new Set(this.tools.values());
    return Array.from(uniqueTools);
  }

  public getEnabledTools(): ToolDefinition[] {
    return this.getAllTools().filter((t) => t.enabled);
  }
}

export const toolRegistry = ToolRegistry.getInstance();
