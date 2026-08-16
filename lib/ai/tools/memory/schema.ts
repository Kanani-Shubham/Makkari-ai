/**
 * Makkari AI — Universal Memory Tool Schema
 * Provider-neutral definition with format converters for Gemini, OpenAI, Anthropic, Groq, OpenRouter, Ollama.
 */

export const MEMORY_TOOL_NAME = 'makkari_memory';

export const MEMORY_TOOL_DESCRIPTION =
  'Store, update, forget, search, or list long-term persistent user memories, preferences, and project context. Use "remember" when the user explicitly asks to save something or when you learn a stable, important personal/project fact. Use "forget" when the user asks to delete a memory. Use "search" to look up saved memories.';

export const MEMORY_TOOL_JSON_SCHEMA = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      enum: ['remember', 'forget', 'update', 'search', 'list'],
      description: 'The memory operation to execute.',
    },
    content: {
      type: 'string',
      description: 'The memory text to persist or update. Keep it concise, stable, and factual.',
    },
    type: {
      type: 'string',
      enum: ['preference', 'profile', 'project', 'goal', 'workflow', 'technical_preference', 'other'],
      description: 'The category classification of the memory.',
    },
    memoryId: {
      type: 'string',
      description: 'The specific UUID of the memory to update or forget.',
    },
    query: {
      type: 'string',
      description: 'The search term to look up or match memories to forget.',
    },
    reason: {
      type: 'string',
      description: 'Brief explanation of why this memory is worth saving for future conversations.',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of memories to return (default 5, max 20).',
    },
  },
  required: ['operation'],
} as const;

/**
 * Returns OpenAI / Groq / OpenRouter / Ollama function definition format
 */
export function getOpenAIFunctionDefinition() {
  return {
    type: 'function',
    function: {
      name: MEMORY_TOOL_NAME,
      description: MEMORY_TOOL_DESCRIPTION,
      parameters: MEMORY_TOOL_JSON_SCHEMA,
    },
  };
}

/**
 * Returns Anthropic tool definition format
 */
export function getAnthropicToolDefinition() {
  return {
    name: MEMORY_TOOL_NAME,
    description: MEMORY_TOOL_DESCRIPTION,
    input_schema: MEMORY_TOOL_JSON_SCHEMA,
  };
}

/**
 * Returns Google Gemini FunctionDeclaration format
 */
export function getGeminiToolDeclaration() {
  return {
    name: MEMORY_TOOL_NAME,
    description: MEMORY_TOOL_DESCRIPTION,
    parameters: {
      type: 'OBJECT',
      properties: {
        operation: {
          type: 'STRING',
          enum: ['remember', 'forget', 'update', 'search', 'list'],
          description: 'The memory operation to execute.',
        },
        content: {
          type: 'STRING',
          description: 'The memory text to persist or update.',
        },
        type: {
          type: 'STRING',
          enum: ['preference', 'profile', 'project', 'goal', 'workflow', 'technical_preference', 'other'],
          description: 'Category classification.',
        },
        memoryId: {
          type: 'STRING',
          description: 'UUID of memory to update or forget.',
        },
        query: {
          type: 'STRING',
          description: 'Search query or matching term.',
        },
        reason: {
          type: 'STRING',
          description: 'Rationale for saving memory.',
        },
        limit: {
          type: 'INTEGER',
          description: 'Max records to return.',
        },
      },
      required: ['operation'],
    },
  };
}
