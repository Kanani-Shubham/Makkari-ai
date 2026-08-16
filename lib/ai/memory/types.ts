/**
 * Makkari AI: Memory & Personalization Normalized Types
 */

export type MemoryType =
  | 'preference'
  | 'profile'
  | 'project'
  | 'goal'
  | 'workflow'
  | 'technical_preference'
  | 'other';

export type MemorySource = 'ai' | 'user';

export type SummaryStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface UserMemorySettings {
  id: string;
  user_id: string;
  personalization_enabled: boolean;
  memory_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationSummary {
  id: string;
  user_id: string;
  chat_id: string;
  summary: string;
  importance: number;
  topics: string[];
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
}

export interface UserMemory {
  id: string;
  user_id: string;
  type: MemoryType;
  content: string;
  source: MemorySource;
  source_chat_id?: string | null;
  confidence: number;
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
}

export interface MemoryContext {
  recentSummaries: ConversationSummary[];
  persistentMemories: UserMemory[];
}

export interface PostChatJob {
  id: string;
  user_id: string;
  chat_id: string;
  job_type: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  available_at: string;
  locked_at?: string | null;
  last_error?: string | null;
  created_at: string;
  completed_at?: string | null;
}

// Strict context budget constraints
export const MAX_MEMORY_ITEMS = 5;
export const MAX_MEMORY_CHARS = 1200;
export const MAX_RECENT_SUMMARY_CHARS = 1000;
export const MAX_PINNED_CHATS = 10;
