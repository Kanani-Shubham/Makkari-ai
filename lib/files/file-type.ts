import crypto from 'crypto';

export type FileCategory = 'image' | 'code' | 'document' | 'web' | 'data' | 'other';

export interface FileTypeInfo {
  filename: string;
  category: FileCategory;
  language: string;
  mimeType: string;
  isImage: boolean;
  isCode: boolean;
  isDocument: boolean;
  isPreviewable: boolean;
  isLiveHtml: boolean;
}

const EXTENSION_MAP: Record<string, { language: string; mimeType: string; category: FileCategory }> = {
  // Web & UI
  html: { language: 'html', mimeType: 'text/html', category: 'web' },
  htm: { language: 'html', mimeType: 'text/html', category: 'web' },
  css: { language: 'css', mimeType: 'text/css', category: 'code' },
  scss: { language: 'scss', mimeType: 'text/x-scss', category: 'code' },
  sass: { language: 'sass', mimeType: 'text/x-sass', category: 'code' },
  js: { language: 'javascript', mimeType: 'text/javascript', category: 'code' },
  jsx: { language: 'javascript', mimeType: 'text/javascript', category: 'code' },
  ts: { language: 'typescript', mimeType: 'text/typescript', category: 'code' },
  tsx: { language: 'typescript', mimeType: 'text/typescript', category: 'code' },
  vue: { language: 'html', mimeType: 'text/x-vue', category: 'code' },
  svelte: { language: 'html', mimeType: 'text/x-svelte', category: 'code' },

  // Programming languages
  py: { language: 'python', mimeType: 'text/x-python', category: 'code' },
  java: { language: 'java', mimeType: 'text/x-java', category: 'code' },
  c: { language: 'c', mimeType: 'text/x-c', category: 'code' },
  cpp: { language: 'cpp', mimeType: 'text/x-c++src', category: 'code' },
  cs: { language: 'csharp', mimeType: 'text/x-csharp', category: 'code' },
  go: { language: 'go', mimeType: 'text/x-go', category: 'code' },
  rs: { language: 'rust', mimeType: 'text/x-rustsrc', category: 'code' },
  php: { language: 'php', mimeType: 'application/x-httpd-php', category: 'code' },
  rb: { language: 'ruby', mimeType: 'text/x-ruby', category: 'code' },
  swift: { language: 'swift', mimeType: 'text/x-swift', category: 'code' },
  kt: { language: 'kotlin', mimeType: 'text/x-kotlin', category: 'code' },
  sql: { language: 'sql', mimeType: 'text/x-sql', category: 'code' },
  sh: { language: 'bash', mimeType: 'application/x-sh', category: 'code' },
  bash: { language: 'bash', mimeType: 'application/x-sh', category: 'code' },
  yaml: { language: 'yaml', mimeType: 'text/yaml', category: 'code' },
  yml: { language: 'yaml', mimeType: 'text/yaml', category: 'code' },

  // Documents & Data
  md: { language: 'markdown', mimeType: 'text/markdown', category: 'document' },
  markdown: { language: 'markdown', mimeType: 'text/markdown', category: 'document' },
  txt: { language: 'plaintext', mimeType: 'text/plain', category: 'document' },
  json: { language: 'json', mimeType: 'application/json', category: 'data' },
  csv: { language: 'csv', mimeType: 'text/csv', category: 'data' },
  tsv: { language: 'tsv', mimeType: 'text/tab-separated-values', category: 'data' },
  xml: { language: 'xml', mimeType: 'application/xml', category: 'document' },
  pdf: { language: 'pdf', mimeType: 'application/pdf', category: 'document' },
  docx: { language: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'document' },

  // Images
  png: { language: 'png', mimeType: 'image/png', category: 'image' },
  jpg: { language: 'jpg', mimeType: 'image/jpeg', category: 'image' },
  jpeg: { language: 'jpeg', mimeType: 'image/jpeg', category: 'image' },
  webp: { language: 'webp', mimeType: 'image/webp', category: 'image' },
  gif: { language: 'gif', mimeType: 'image/gif', category: 'image' },
  svg: { language: 'svg', mimeType: 'image/svg+xml', category: 'image' },
  ico: { language: 'ico', mimeType: 'image/x-icon', category: 'image' },
};

/**
 * Detects comprehensive file metadata from filename and optional MIME type
 */
export function detectFileInfo(filename: string, fallbackMime?: string): FileTypeInfo {
  const cleanName = filename.trim();
  const ext = cleanName.includes('.') ? cleanName.split('.').pop()!.toLowerCase() : '';
  const mapped = EXTENSION_MAP[ext];

  const category = mapped?.category || (fallbackMime?.startsWith('image/') ? 'image' : 'other');
  const language = mapped?.language || (category === 'image' ? 'image' : 'plaintext');
  const mimeType = mapped?.mimeType || fallbackMime || 'application/octet-stream';

  const isImg = category === 'image' || mimeType.startsWith('image/');
  const isCod = category === 'code' || category === 'web';
  const isDoc = category === 'document' || category === 'data';
  const isLive = ext === 'html' || ext === 'htm';
  const isPrev = isLive || ext === 'md' || ext === 'json' || ext === 'csv' || isImg;

  return {
    filename: cleanName,
    category,
    language,
    mimeType,
    isImage: isImg,
    isCode: isCod,
    isDocument: isDoc,
    isPreviewable: isPrev,
    isLiveHtml: isLive,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}
