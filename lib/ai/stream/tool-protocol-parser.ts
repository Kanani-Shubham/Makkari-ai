export interface ParsedToolCall {
  name: string;
  parameters: Record<string, any>;
  rawProtocol: string;
}

export interface StreamParserResult {
  textDelta: string;
  completedToolCalls: ParsedToolCall[];
}

/**
 * Stateful Tool Protocol Parser
 * Intercepts text-based XML and JSON tool calls (e.g. <dots_function_call>, <invoke>, <tool_call>)
 * across arbitrary SSE chunk boundaries without letting protocol tokens leak into TEXT_DELTA.
 */
export class StatefulToolProtocolParser {
  private buffer: string = '';
  private isInToolCall: boolean = false;
  private currentToolBuffer: string = '';
  private currentToolTag: string = '';

  // Recognized opening tool tags
  private static readonly OPEN_TAGS = [
    '<dots_function_call>',
    '<function_call>',
    '<tool_call>',
    '<invoke',
  ];

  /**
   * Processes a newly arrived text chunk
   */
  public processChunk(chunk: string): StreamParserResult {
    let textToEmit = '';
    const completedToolCalls: ParsedToolCall[] = [];

    this.buffer += chunk;

    while (this.buffer.length > 0) {
      if (!this.isInToolCall) {
        // Look for the start of a tool call
        let earliestMatchIndex = -1;
        let matchedTag = '';

        for (const tag of StatefulToolProtocolParser.OPEN_TAGS) {
          const idx = this.buffer.indexOf(tag);
          if (idx !== -1 && (earliestMatchIndex === -1 || idx < earliestMatchIndex)) {
            earliestMatchIndex = idx;
            matchedTag = tag;
          }
        }

        if (earliestMatchIndex === -1) {
          // Check for a potential partial tag at the end of the buffer (e.g. "<dots_func")
          const partialTagMatch = this.buffer.match(/<[a-zA-Z0-9_]*$/);
          if (partialTagMatch) {
            const safeLen = partialTagMatch.index!;
            textToEmit += this.buffer.slice(0, safeLen);
            this.buffer = this.buffer.slice(safeLen);
          } else {
            textToEmit += this.buffer;
            this.buffer = '';
          }
          break;
        } else {
          // Emit text before the tool tag
          textToEmit += this.buffer.slice(0, earliestMatchIndex);
          this.buffer = this.buffer.slice(earliestMatchIndex);
          this.isInToolCall = true;
          this.currentToolBuffer = '';
          this.currentToolTag = matchedTag;
        }
      }

      if (this.isInToolCall) {
        // Find closing tag corresponding to the active tool call
        let closingTag = '';
        if (this.currentToolTag === '<dots_function_call>') closingTag = '</dots_function_call>';
        else if (this.currentToolTag === '<function_call>') closingTag = '</function_call>';
        else if (this.currentToolTag === '<tool_call>') closingTag = '</tool_call>';
        else if (this.currentToolTag.startsWith('<invoke')) closingTag = '</invoke>';
        else closingTag = '</dots_function_call>';

        const closeIdx = this.buffer.indexOf(closingTag);
        if (closeIdx === -1) {
          // Tool call is still accumulating in flight across chunks
          this.currentToolBuffer += this.buffer;
          this.buffer = '';
          break;
        } else {
          // Completed tool call detected
          const completeRaw = this.currentToolBuffer + this.buffer.slice(0, closeIdx + closingTag.length);
          this.buffer = this.buffer.slice(closeIdx + closingTag.length);
          this.isInToolCall = false;
          this.currentToolBuffer = '';
          this.currentToolTag = '';

          const parsed = this.parseToolCallString(completeRaw);
          if (parsed) {
            completedToolCalls.push(parsed);
          }
        }
      }
    }

    return {
      textDelta: textToEmit,
      completedToolCalls,
    };
  }

  /**
   * Finalizes stream parsing and flushes any pending non-tool buffer
   */
  public flush(): StreamParserResult {
    let textDelta = '';
    const completedToolCalls: ParsedToolCall[] = [];

    if (this.currentToolBuffer.length > 0) {
      const parsed = this.parseToolCallString(this.currentToolBuffer);
      if (parsed) {
        completedToolCalls.push(parsed);
      } else {
        textDelta += this.currentToolBuffer;
      }
      this.currentToolBuffer = '';
    }

    if (this.buffer.length > 0) {
      textDelta += this.buffer;
      this.buffer = '';
    }

    return {
      textDelta,
      completedToolCalls,
    };
  }

  /**
   * Parses XML or JSON tool call string into structured tool name & parameters
   */
  private parseToolCallString(raw: string): ParsedToolCall | null {
    // 1. Check for XML format: <invoke name="..."> or <dots_function_call> ...
    const invokeNameMatch = raw.match(/<invoke\s+name=["']([^"']+)["']/i) || raw.match(/name=["']([^"']+)["']/i);
    const toolName = invokeNameMatch ? invokeNameMatch[1] : 'makkari_artifact';

    const parameters: Record<string, any> = {};

    // Extract all <parameter name="key">value</parameter>
    const paramRegex = /<parameter\s+name=["']([^"']+)["']>([\s\S]*?)<\/parameter>/gi;
    let paramMatch: RegExpExecArray | null;

    while ((paramMatch = paramRegex.exec(raw)) !== null) {
      const key = paramMatch[1].trim();
      const val = paramMatch[2].trim();
      parameters[key] = val;
    }

    // Normalize parameter aliases (file_name -> filename, etc.)
    if (parameters.file_name && !parameters.filename) {
      parameters.filename = parameters.file_name;
    }

    // Check if parameters was JSON inside <tool_call>{...}</tool_call> or <dots_function_call>{...}</dots_function_call>
    if (Object.keys(parameters).length === 0) {
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedJson = JSON.parse(jsonMatch[0]);
          const resolvedName = parsedJson.name || parsedJson.tool || toolName;
          const resolvedArgs = parsedJson.parameters || parsedJson.arguments || parsedJson;

          if (resolvedName && typeof resolvedArgs === 'object') {
            return {
              name: resolvedName,
              parameters: typeof resolvedArgs === 'string' ? JSON.parse(resolvedArgs) : resolvedArgs,
              rawProtocol: raw,
            };
          }
        }
      } catch {
        // Ignore JSON parse error
      }
    }


    if (Object.keys(parameters).length > 0 || raw.includes('makkari_artifact')) {
      // Default to action=create if content exists
      if (!parameters.action && parameters.content) {
        parameters.action = 'create';
      }
      if (!parameters.filename && parameters.content?.includes('<!DOCTYPE html>')) {
        parameters.filename = 'index.html';
        parameters.language = 'html';
      }

      return {
        name: toolName,
        parameters,
        rawProtocol: raw,
      };
    }

    return null;
  }
}
