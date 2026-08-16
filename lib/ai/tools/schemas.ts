import { ToolDefinition } from './types';

/**
 * Converts Canonical ToolDefinition to Google Gemini FunctionDeclaration
 */
export function convertToGeminiFunction(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'OBJECT',
      properties: Object.entries(tool.inputSchema.properties).reduce((acc, [key, prop]) => {
        acc[key] = {
          type: prop.type.toUpperCase(),
          description: prop.description,
          enum: prop.enum,
        };
        return acc;
      }, {} as Record<string, any>),
      required: tool.inputSchema.required || [],
    },
  };
}

/**
 * Converts Canonical ToolDefinition to OpenAI / Groq / OpenRouter tool schema
 */
export function convertToOpenAITool(tool: ToolDefinition) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

/**
 * Converts Canonical ToolDefinition to Anthropic tool schema
 */
export function convertToAnthropicTool(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}

/**
 * Normalizes tool definitions for any requested provider
 */
export function getProviderToolSchemas(providerId: string, tools: ToolDefinition[]) {
  if (providerId === 'gemini') {
    return [{ functionDeclarations: tools.map(convertToGeminiFunction) }];
  }
  if (providerId === 'anthropic') {
    return tools.map(convertToAnthropicTool);
  }
  // OpenAI, Groq, OpenRouter, Ollama
  return tools.map(convertToOpenAITool);
}
