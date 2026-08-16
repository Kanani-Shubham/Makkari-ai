import { ToolDefinition } from '../types';

export const codeEvalTool: ToolDefinition = {
  id: 'code_runner',
  name: 'code_runner',
  description: 'Executes sandboxed computational JavaScript/TypeScript code snippets for data transformations and simulations.',
  category: 'coding',
  permissions: 'write',
  /**
   * SEC-003: DANGEROUS — uses new Function() (server-side arbitrary JS execution).
   * Disabled until Phase 10 implements a proper V8 Isolate / WASM sandbox.
   * DO NOT re-enable in production without a real sandbox.
   */
  enabled: false,
  requiresConfirmation: true,
  source: 'builtin',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The JavaScript code snippet to execute (must return a value or log output)',
      },
    },
    required: ['code'],
  },
  handler: async (args) => {
    const rawCode = String(args.code || '').trim();
    if (!rawCode) return { success: false, error: 'Code is required.' };

    // Strict blacklisting for sandbox security
    if (
      /process\.|require\(|import\(|child_process|fs\.|fetch\(|global\.|window\.|localStorage|sessionStorage|indexedDB/i.test(
        rawCode
      )
    ) {
      return { success: false, error: 'Access to system environment, I/O, or network is blocked in sandbox.' };
    }

    try {
      const logs: string[] = [];
      const mockConsole = {
        log: (...items: any[]) => logs.push(items.map((i) => (typeof i === 'object' ? JSON.stringify(i) : String(i))).join(' ')),
        error: (...items: any[]) => logs.push(`[ERR] ${items.join(' ')}`),
      };

      const runner = new Function('console', `"use strict"; ${rawCode}`);
      const returnedVal = runner(mockConsole);

      const outputParts: string[] = [];
      if (logs.length > 0) outputParts.push(`Logs:\n${logs.join('\n')}`);
      if (returnedVal !== undefined) outputParts.push(`Return: ${typeof returnedVal === 'object' ? JSON.stringify(returnedVal) : String(returnedVal)}`);

      return {
        success: true,
        result: { logs, returnedVal },
        formattedOutput: outputParts.join('\n\n') || 'Execution finished with no output.',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution error';
      return { success: false, error: msg };
    }
  },
};
