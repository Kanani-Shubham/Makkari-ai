import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/auth/server-auth';
import { detectFileInfo, computeContentHash } from '@/lib/files/file-type';
import { ChatAttachment } from '@/lib/ai/types';
import crypto from 'crypto';

export const MAX_FILES_PER_MESSAGE = 20;
export const MAX_SINGLE_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: User authentication required.' }, { status: 401 });
    }

    const formData = await req.formData();
    const chatId = formData.get('chatId') as string | null;
    const isPasted = formData.get('isPasted') === 'true';

    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
    }

    // Extract all uploaded files
    const files: File[] = [];
    const entries = Array.from(formData.entries());
    for (const [key, val] of entries) {
      if (key === 'file' || key === 'files' || key.startsWith('file_')) {
        if (val instanceof File) {
          files.push(val);
        }
      }
    }

    // 1. Enforce hard 20-file limit server-side
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided for upload.' }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_MESSAGE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES_PER_MESSAGE} files per message allowed. Received ${files.length}.` },
        { status: 400 }
      );
    }

    const uploadedAttachments: ChatAttachment[] = [];

    for (const file of files) {
      // 2. Validate individual file size
      if (file.size > MAX_SINGLE_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds the maximum allowed size of 25MB.` },
          { status: 400 }
        );
      }

      const fileInfo = detectFileInfo(file.name, file.type);
      const attachmentId = crypto.randomUUID();
      const safeStoragePath = `${user.id}/chats/${chatId}/${attachmentId}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      let contentStr = '';
      if (!fileInfo.isImage && file.size < 2 * 1024 * 1024) {
        // Read text content for AI prompt consumption
        try {
          contentStr = await file.text();
        } catch {
          // Ignore binary read error
        }
      }

      // Record in message_attachments table
      await supabase.from('message_attachments').insert({
        id: attachmentId,
        chat_id: chatId,
        user_id: user.id,
        filename: file.name,
        mime_type: fileInfo.mimeType,
        size_bytes: file.size,
        content: contentStr || null,
        storage_path: safeStoragePath,
        is_pasted: isPasted,
      });

      const attachment: ChatAttachment = {
        id: attachmentId,
        name: file.name,
        mimeType: fileInfo.mimeType,
        size: file.size,
        storagePath: safeStoragePath,
        kind: fileInfo.isImage ? 'image' : fileInfo.isCode ? 'code' : 'file',
        status: 'uploaded',
        content: contentStr || undefined,
        processing: {
          status: 'ready',
          extracted: !!contentStr,
        },
      };

      uploadedAttachments.push(attachment);
    }

    return NextResponse.json({
      success: true,
      count: uploadedAttachments.length,
      attachments: uploadedAttachments,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    console.error('[ATTACHMENT_UPLOAD] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
