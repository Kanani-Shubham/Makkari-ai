import { ChatAttachment, MakkariModel, MAX_ATTACHMENT_SIZE } from './types';

export const ALLOWED_MIME_TYPES: Record<string, 'image' | 'file' | 'code' | 'spreadsheet'> = {
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'image/svg+xml': 'image',

  // Documents & Text
  'application/pdf': 'file',
  'text/plain': 'file',
  'text/markdown': 'file',
  'text/csv': 'spreadsheet',
  'application/json': 'code',

  // Code
  'text/javascript': 'code',
  'text/typescript': 'code',
  'text/html': 'code',
  'text/css': 'code',
  'application/x-python-code': 'code',
  'text/x-python': 'code',
};

export const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.pdf',
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.html',
  '.css',
];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  kind?: 'image' | 'file' | 'code' | 'spreadsheet';
}

/**
 * Validates file size, extension, and MIME type
 */
export function validateAttachment(file: { name: string; size: number; type: string }): FileValidationResult {
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the 25 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
    };
  }

  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file extension: ${ext}`,
    };
  }

  const kind = ALLOWED_MIME_TYPES[file.type] || (ext === '.csv' ? 'spreadsheet' : ext === '.pdf' ? 'file' : 'file');

  return {
    valid: true,
    kind,
  };
}

/**
 * Transiently prepares attachments for model consumption according to model capabilities
 */
export function formatAttachmentsForModel(
  attachments: ChatAttachment[] | undefined,
  model: MakkariModel
): {
  appendedTextPrompt: string;
  multimodalAttachments: ChatAttachment[];
} {
  if (!attachments || attachments.length === 0) {
    return { appendedTextPrompt: '', multimodalAttachments: [] };
  }

  const multimodal: ChatAttachment[] = [];
  const textSummaries: string[] = [];

  for (const att of attachments) {
    if (att.kind === 'image' && model.capabilities.vision) {
      multimodal.push(att);
    } else {
      textSummaries.push(
        `[Attached File: ${att.name} (${(att.size / 1024).toFixed(1)} KB, type: ${att.mimeType})]`
      );
    }
  }

  const appendedTextPrompt = textSummaries.length > 0 ? `\n\n${textSummaries.join('\n')}` : '';

  return {
    appendedTextPrompt,
    multimodalAttachments: multimodal,
  };
}
