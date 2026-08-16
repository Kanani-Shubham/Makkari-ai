export type ArtifactType = 'code' | 'web' | 'document' | 'svg' | 'sql' | 'data' | 'other';

export interface ArtifactFile {
  id: string;
  artifact_id: string;
  user_id: string;
  chat_id: string;
  filename: string;
  mime_type: string;
  language: string;
  size_bytes: number;
  content: string;
  storage_path?: string;
  content_hash: string;
  version: number;
  is_entry_file: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationArtifact {
  id: string;
  user_id: string;
  chat_id: string;
  title: string;
  description?: string;
  artifact_type: ArtifactType;
  files: ArtifactFile[];
  created_at: string;
  updated_at: string;
}

export interface CreateArtifactFileInput {
  filename: string;
  content: string;
  language?: string;
  is_entry_file?: boolean;
}

export interface CreateArtifactInput {
  title: string;
  description?: string;
  artifact_type?: ArtifactType;
  files: CreateArtifactFileInput[];
}

export interface MessageAttachmentItem {
  id: string;
  message_id?: string;
  chat_id: string;
  user_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  content?: string;
  storage_path?: string;
  is_pasted?: boolean;
  created_at: string;
}

export interface PastedReferenceCard {
  id: string;
  title: string;
  detectedType: string;
  sizeBytes: number;
  content: string;
  lineCount: number;
}
