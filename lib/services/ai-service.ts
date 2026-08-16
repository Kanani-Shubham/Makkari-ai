import { streamAIChat } from '@/lib/ai/adapter';
import { ChatRequest, ChatChunk } from '@/lib/ai/types';

export class AIService {
  static generateStream(options: ChatRequest): AsyncIterable<ChatChunk> {
    return streamAIChat(options);
  }
}
