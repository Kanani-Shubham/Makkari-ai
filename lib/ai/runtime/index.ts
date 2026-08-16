/**
 * MAKKARI AI — Runtime Module (Phase 1-3 Exports)
 *
 * Public API surface for the Makkari AI runtime.
 * Import from '@/lib/ai/runtime' to access all runtime contracts.
 */

// Phase 1: Runtime Contracts
export * from './runtime-types';
export * from './turn-limits';
export * from './turn-state';

// runtime-messages exports (except RuntimeToolCall which is defined locally in turn-state for Phase 3)
export type {
  RuntimeMessage,
  RuntimeUserMessage,
  RuntimeAssistantMessage,
  RuntimeToolResultMessage,
  RuntimeToolResult,
} from './runtime-messages';
export { generateCallId, createErrorToolResult, createSuccessToolResult } from './runtime-messages';


// Phase 3: QueryEngine
export * from './query-engine';

