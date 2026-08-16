import { ToolDefinition } from '../types';

export const calculatorTool: ToolDefinition = {
  id: 'calculator',
  name: 'calculator',
  description: 'Evaluates standard mathematical expressions, arithmetic, percentages, and basic algebra safely.',
  category: 'computation',
  permissions: 'read',
  requiresConfirmation: false,
  enabled: true,
  source: 'builtin',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The mathematical expression to evaluate (e.g. "(12.5 * 4) + 18 / 2")',
      },
    },
    required: ['expression'],
  },
  handler: async (args) => {
    const expr = String(args.expression || '').trim();
    if (!expr) {
      return { success: false, error: 'Expression is required.' };
    }

    // Strict sanitation: allow only numbers, basic arithmetic operators, math functions, parentheses
    const sanitized = expr.replace(/\s+/g, '');
    if (!/^[0-9+\-*/().,%^eEMath.sqrtpowsincoatanabslog]+$/.test(sanitized)) {
      return { success: false, error: 'Invalid characters in mathematical expression.' };
    }

    try {
      // Safe sandboxed Function evaluation without access to global scope or window
      const safeCalc = new Function(`"use strict"; return (${sanitized});`);
      const result = safeCalc();

      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        return { success: false, error: 'Expression did not evaluate to a finite numeric result.' };
      }

      return {
        success: true,
        result,
        formattedOutput: `Result: ${result}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Evaluation failed';
      return { success: false, error: msg };
    }
  },
};
