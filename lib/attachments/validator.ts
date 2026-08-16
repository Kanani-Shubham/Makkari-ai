export const MAX_FILES_PER_MESSAGE = 20;
export const MAX_SINGLE_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_TOTAL_UPLOAD_SIZE = 100 * 1024 * 1024; // 100 MB

export interface AttachmentValidationResult {
  valid: boolean;
  error?: string;
}

export function validateAttachmentList(
  files: Array<{ name: string; size: number; type?: string }>,
  existingCount: number = 0
): AttachmentValidationResult {
  const totalCount = existingCount + files.length;

  if (totalCount > MAX_FILES_PER_MESSAGE) {
    return {
      valid: false,
      error: `Maximum ${MAX_FILES_PER_MESSAGE} files allowed per message (attempted ${totalCount}).`,
    };
  }

  let totalSize = 0;
  for (const file of files) {
    if (file.size > MAX_SINGLE_FILE_SIZE) {
      return {
        valid: false,
        error: `File "${file.name}" exceeds the maximum single file size of 25MB.`,
      };
    }
    totalSize += file.size;
  }

  if (totalSize > MAX_TOTAL_UPLOAD_SIZE) {
    return {
      valid: false,
      error: `Total upload size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds the 100MB message limit.`,
    };
  }

  return { valid: true };
}
