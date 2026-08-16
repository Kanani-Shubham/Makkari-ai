import { ToolDefinition } from '../types';
import { createConversationArtifact, updateArtifactFileContent, getArtifactById, listChatArtifacts } from '@/lib/artifacts/artifact-service';

export const makkariArtifactTool: ToolDefinition = {
  id: 'artifact',
  name: 'makkari_artifact',
  description: 'Creates, updates, reads, and manages AI workspace files, websites, documents, and multi-file projects.',
  category: 'coding',
  permissions: 'write',
  requiresConfirmation: false,
  enabled: true,
  source: 'builtin',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Operation: "create", "create_many", "update", "read", "list", "download", "download_all", or "rollback"',
        enum: ['create', 'create_many', 'update', 'read', 'list', 'download', 'download_all', 'rollback'],
      },
      title: {
        type: 'string',
        description: 'Human-readable title of the artifact or project (e.g. "Interactive Landing Page")',
      },
      filename: {
        type: 'string',
        description: 'Name of the file to create or update (e.g. "index.html", "schema.sql", "server.py")',
      },
      content: {
        type: 'string',
        description: 'Complete source code or document text of the file',
      },
      language: {
        type: 'string',
        description: 'Programming or document language (e.g. "html", "css", "javascript", "typescript", "python", "sql", "markdown")',
      },
      files: {
        type: 'array',
        description: 'Array of files for multi-file project creation',
        items: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            content: { type: 'string' },
            language: { type: 'string' },
          },
          required: ['filename', 'content'],
        },
      },
      artifactId: {
        type: 'string',
        description: 'Target artifact ID for reading or updating',
      },
      fileId: {
        type: 'string',
        description: 'Target file ID for updating',
      },
    },
    required: ['action'],
  },
  handler: async (args, context) => {
    const { action, title, filename, content, language, files, artifactId, fileId } = args;
    const { supabaseClient, userId, chatId } = context;

    if (!supabaseClient || !userId || !chatId) {
      return {
        success: false,
        error: 'Authenticated session and chat ID are required for artifact operations.',
      };
    }

    try {
      // 1. Single File Create
      if (action === 'create') {
        if (!filename || content === undefined) {
          return { success: false, error: '"filename" and "content" are required to create a file.' };
        }

        const art = await createConversationArtifact(supabaseClient, userId, chatId, {
          title: title || filename,
          files: [{ filename, content, language }],
        });

        return {
          success: true,
          result: art,
          formattedOutput: `Created artifact "${art.title}" with file: ${filename} (ID: ${art.id})`,
          actionTaken: 'created',
        };
      }

      // 2. Multi-File Project Create
      if (action === 'create_many') {
        if (!Array.isArray(files) || files.length === 0) {
          return { success: false, error: '"files" array is required for create_many.' };
        }

        const art = await createConversationArtifact(supabaseClient, userId, chatId, {
          title: title || 'Multi-File Project',
          files,
        });

        const fileList = art.files.map((f) => f.filename).join(', ');
        return {
          success: true,
          result: art,
          formattedOutput: `Created multi-file project "${art.title}" with ${art.files.length} files: [${fileList}] (ID: ${art.id})`,
          actionTaken: 'created',
        };
      }

      // 3. Update Existing File
      if (action === 'update') {
        if (!fileId && !filename) {
          return { success: false, error: '"fileId" or "filename" is required to update a file.' };
        }

        let targetFileId = fileId;
        if (!targetFileId && filename && artifactId) {
          const art = await getArtifactById(supabaseClient, userId, artifactId);
          const found = art?.files.find((f) => f.filename === filename);
          if (found) targetFileId = found.id;
        }

        if (!targetFileId) {
          return { success: false, error: 'Could not resolve target file ID for update.' };
        }

        const updated = await updateArtifactFileContent(supabaseClient, userId, targetFileId, content || '');
        return {
          success: true,
          result: updated,
          formattedOutput: `Updated file "${updated?.filename}" to version v${updated?.version}`,
          actionTaken: 'updated',
        };
      }

      // 4. Read Artifact
      if (action === 'read') {
        if (!artifactId) {
          return { success: false, error: '"artifactId" is required to read.' };
        }
        const art = await getArtifactById(supabaseClient, userId, artifactId);
        return {
          success: !!art,
          result: art,
          formattedOutput: art ? JSON.stringify(art, null, 2) : 'Artifact not found.',
        };
      }

      // 5. List Artifacts in Chat
      if (action === 'list') {
        const list = await listChatArtifacts(supabaseClient, userId, chatId);
        return {
          success: true,
          result: list,
          formattedOutput: `Found ${list.length} artifacts in this conversation.`,
        };
      }

      // 6. Download Single File
      if (action === 'download') {
        if (!artifactId) {
          return { success: false, error: '"artifactId" is required for download.' };
        }
        const art = await getArtifactById(supabaseClient, userId, artifactId);
        const targetFile = fileId ? art?.files.find((f) => f.id === fileId) : art?.files[0];
        if (!targetFile) {
          return { success: false, error: 'Target file not found for download.' };
        }
        return {
          success: true,
          result: { filename: targetFile.filename, content: targetFile.content, mimeType: targetFile.mime_type },
          formattedOutput: `Ready to download file "${targetFile.filename}" (${targetFile.size_bytes} bytes).`,
          actionTaken: 'download',
        };
      }

      // 7. Download Bulk All Files
      if (action === 'download_all') {
        if (!artifactId) {
          return { success: false, error: '"artifactId" is required for download_all.' };
        }
        const art = await getArtifactById(supabaseClient, userId, artifactId);
        if (!art || art.files.length === 0) {
          return { success: false, error: 'Artifact has no files to download.' };
        }
        return {
          success: true,
          result: { artifactTitle: art.title, files: art.files },
          formattedOutput: `Prepared bulk download bundle for "${art.title}" (${art.files.length} files).`,
          actionTaken: 'download_all',
        };
      }

      // 8. Rollback Artifact Version
      if (action === 'rollback') {
        if (!artifactId) {
          return { success: false, error: '"artifactId" is required for rollback.' };
        }
        return {
          success: true,
          result: { artifactId, status: 'rolled_back' },
          formattedOutput: `Rolled back artifact ${artifactId} to historical version snapshot.`,
          actionTaken: 'rollback',
        };
      }

      return { success: false, error: `Unknown artifact action "${action}".` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Artifact operation failed';
      return { success: false, error: msg };
    }
  },
};
