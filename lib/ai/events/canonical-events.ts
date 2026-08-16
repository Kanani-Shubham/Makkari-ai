// Built-in standard Web/Node crypto UUID helper
function generateEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `evt_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export interface ArtifactFileDTO {
  id?: string;
  filename: string;
  language: string;
  mimeType: string;
  sizeBytes: number;
  content?: string;
  isEntryFile?: boolean;
}

export interface ArtifactEventPayload {
  artifactId: string;
  title: string;
  artifactType: 'web' | 'code' | 'document' | 'svg' | 'sql' | 'data';
  version: number;
  files: ArtifactFileDTO[];
}

export interface ToolResultPayload {
  success: boolean;
  summary?: string;
  output?: Record<string, unknown> | string | number | boolean | null;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface ActionRequiredPayload {
  actionId: string;
  action: string;
  description: string;
  requiresConfirmation: boolean;
  displayArguments?: Record<string, string | number | boolean | null>;
}

export type MakkariEvent =
  | { type: 'STREAM_START'; timestamp?: number }
  | { type: 'THINKING_START'; timestamp?: number }
  | { type: 'THINKING_STATUS'; status: string; timestamp?: number }
  | { type: 'TEXT_DELTA'; delta: string; timestamp?: number }
  | { type: 'TOOL_CALL'; tool: string; callId: string; parameters: Record<string, unknown>; timestamp?: number }
  | { type: 'TOOL_RESULT'; callId: string; result: ToolResultPayload; timestamp?: number }
  | { type: 'MCP_CALL'; server: string; tool: string; callId: string; parameters: Record<string, unknown>; timestamp?: number }
  | { type: 'MCP_RESULT'; server: string; tool: string; callId: string; result: ToolResultPayload; timestamp?: number }
  | { type: 'ARTIFACT_CREATE'; artifact: ArtifactEventPayload; timestamp?: number }
  | { type: 'ARTIFACT_UPDATE'; artifactId: string; updates: Partial<ArtifactEventPayload>; timestamp?: number }
  | { type: 'ACTION_REQUIRED'; action: ActionRequiredPayload; timestamp?: number }
  | { type: 'DONE'; timestamp?: number }
  | { type: 'CANCELLED'; reason?: string; timestamp?: number }
  | { type: 'ERROR'; message: string; code?: string; retryable?: boolean; timestamp?: number };

export interface MakkariEventEnvelope {
  protocolVersion: 1;
  eventId: string;
  sequence: number;
  timestamp: number;
  conversationId: string;
  event: MakkariEvent;
}

export type StreamLifecycleState = 'idle' | 'started' | 'active' | 'terminal';

/**
 * Centralized Canonical Event Bus for Makkari AI.
 * Sole authority for assigning eventId, monotonic sequence (1..N), timestamp, and protocolVersion.
 * Guarantees exactly one STREAM_START and exactly one terminal event (DONE, CANCELLED, ERROR).
 */
export class CanonicalEventBus {
  private sequence = 0;
  private conversationId: string;
  private state: StreamLifecycleState = 'idle';
  private onEnvelopeCallback?: (envelope: MakkariEventEnvelope) => void;

  constructor(conversationId: string, onEnvelope?: (envelope: MakkariEventEnvelope) => void) {
    this.conversationId = conversationId;
    this.onEnvelopeCallback = onEnvelope;
  }

  public getState(): StreamLifecycleState {
    return this.state;
  }

  public isTerminal(): boolean {
    return this.state === 'terminal';
  }

  /**
   * Validates, wraps, sequences, and emits a canonical event.
   * Returns the MakkariEventEnvelope or null if rejected (e.g. stream already terminal).
   */
  public emit(event: MakkariEvent): MakkariEventEnvelope | null {
    if (this.state === 'terminal') {
      console.warn(`[CANONICAL_EVENT_BUS] Event ${event.type} rejected: stream is already in terminal state.`);
      return null;
    }

    if (event.type === 'STREAM_START') {
      if (this.state !== 'idle') {
        console.warn('[CANONICAL_EVENT_BUS] Duplicate STREAM_START rejected.');
        return null;
      }
      this.state = 'started';
    } else {
      if (this.state === 'idle') {
        // Auto-initialize started state if not explicitly emitted
        this.state = 'active';
      } else if (this.state === 'started') {
        this.state = 'active';
      }
    }

    const isTerminalEvent = event.type === 'DONE' || event.type === 'CANCELLED' || event.type === 'ERROR';
    if (isTerminalEvent) {
      this.state = 'terminal';
    }

    this.sequence++;
    const now = Date.now();

    const stampedEvent = {
      ...event,
      timestamp: event.timestamp || now,
    } as MakkariEvent;

    const envelope: MakkariEventEnvelope = {
      protocolVersion: 1,
      eventId: generateEventId(),
      sequence: this.sequence,
      timestamp: now,
      conversationId: this.conversationId,
      event: stampedEvent,
    };

    if (this.onEnvelopeCallback) {
      this.onEnvelopeCallback(envelope);
    }

    return envelope;
  }

  /**
   * Formats an envelope into Server-Sent Events (SSE) format.
   */
  public static formatSSE(envelope: MakkariEventEnvelope): string {
    return `data: ${JSON.stringify(envelope)}\n\n`;
  }
}
