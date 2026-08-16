import { SupabaseClient } from '@supabase/supabase-js';
import {
  ConversationArtifact,
  ArtifactFile,
  CreateArtifactInput,
  MessageAttachmentItem,
} from './types';
import { detectFileInfo, computeContentHash } from '../files/file-type';

/**
 * Creates or updates an artifact with one or more files in Supabase
 */
export async function createConversationArtifact(
  supabase: SupabaseClient,
  userId: string,
  chatId: string,
  input: CreateArtifactInput
): Promise<ConversationArtifact> {
  const primaryFile = input.files[0];
  const fileInfo = primaryFile ? detectFileInfo(primaryFile.filename) : null;
  const artifactType = input.artifact_type || (fileInfo?.isLiveHtml ? 'web' : fileInfo?.isDocument ? 'document' : 'code');

  // 1. Insert or reuse artifact record
  const { data: artifactRecord, error: artErr } = await supabase
    .from('conversation_artifacts')
    .insert({
      user_id: userId,
      chat_id: chatId,
      title: input.title,
      description: input.description,
      artifact_type: artifactType,
    })
    .select('*')
    .single();

  if (artErr || !artifactRecord) {
    throw new Error(`Failed to create conversation artifact: ${artErr?.message || 'Unknown database error'}`);
  }

  // 2. Insert all artifact files
  const filesToInsert = input.files.map((f, idx) => {
    const fInfo = detectFileInfo(f.filename);
    const content = f.content || '';
    const hash = computeContentHash(content);

    return {
      artifact_id: artifactRecord.id,
      user_id: userId,
      chat_id: chatId,
      filename: f.filename,
      mime_type: fInfo.mimeType,
      language: f.language || fInfo.language,
      size_bytes: Buffer.byteLength(content, 'utf8'),
      content,
      content_hash: hash,
      version: 1,
      is_entry_file: f.is_entry_file ?? (idx === 0),
    };
  });

  const { data: insertedFiles, error: filesErr } = await supabase
    .from('artifact_files')
    .insert(filesToInsert)
    .select('*');

  if (filesErr) {
    console.error('[ARTIFACT_SERVICE] Error inserting artifact files:', filesErr);
  }

  return {
    ...artifactRecord,
    files: insertedFiles || [],
  };
}

/**
 * Retrieves an artifact and all associated files by ID
 */
export async function getArtifactById(
  supabase: SupabaseClient,
  userId: string,
  artifactId: string
): Promise<ConversationArtifact | null> {
  const { data: artifact, error: artErr } = await supabase
    .from('conversation_artifacts')
    .select('*')
    .eq('id', artifactId)
    .eq('user_id', userId)
    .maybeSingle();

  if (artErr || !artifact) return null;

  const { data: files } = await supabase
    .from('artifact_files')
    .select('*')
    .eq('artifact_id', artifactId)
    .eq('user_id', userId)
    .order('is_entry_file', { ascending: false })
    .order('created_at', { ascending: true });

  return {
    ...artifact,
    files: files || [],
  };
}

/**
 * Lists all artifacts created within a chat thread
 */
export async function listChatArtifacts(
  supabase: SupabaseClient,
  userId: string,
  chatId: string
): Promise<ConversationArtifact[]> {
  const { data: artifacts, error: artErr } = await supabase
    .from('conversation_artifacts')
    .select('*')
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (artErr || !artifacts) return [];

  const artifactIds = artifacts.map((a) => a.id);
  if (artifactIds.length === 0) return [];

  const { data: allFiles } = await supabase
    .from('artifact_files')
    .select('*')
    .in('artifact_id', artifactIds)
    .eq('user_id', userId);

  const filesByArtifact: Record<string, ArtifactFile[]> = {};
  for (const f of allFiles || []) {
    if (!filesByArtifact[f.artifact_id]) filesByArtifact[f.artifact_id] = [];
    filesByArtifact[f.artifact_id].push(f);
  }

  return artifacts.map((a) => ({
    ...a,
    files: filesByArtifact[a.id] || [],
  }));
}

/**
 * Updates an artifact file content and increments its version
 */
export async function updateArtifactFileContent(
  supabase: SupabaseClient,
  userId: string,
  fileId: string,
  newContent: string
): Promise<ArtifactFile | null> {
  // 1. Fetch current file
  const { data: existing, error: fetchErr } = await supabase
    .from('artifact_files')
    .select('*')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !existing) {
    throw new Error('Artifact file not found or unauthorized.');
  }

  const hash = computeContentHash(newContent);
  const nextVersion = (existing.version || 1) + 1;
  const sizeBytes = Buffer.byteLength(newContent, 'utf8');

  const { data: updated, error: updateErr } = await supabase
    .from('artifact_files')
    .update({
      content: newContent,
      content_hash: hash,
      version: nextVersion,
      size_bytes: sizeBytes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fileId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (updateErr) {
    throw new Error(`Failed to update artifact file: ${updateErr.message}`);
  }

  return updated;
}
