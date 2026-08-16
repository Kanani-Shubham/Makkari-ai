export interface PastedContentMetadata {
  isPastedContent: boolean;
  charCount: number;
  lineCount: number;
  sizeBytes: number;
  inferredFilename: string;
  inferredLanguage: string;
  previewSnippet: string;
}

const PASTED_CHAR_THRESHOLD = 8000;
const PASTED_LINE_THRESHOLD = 100;

/**
 * Detects if a text block qualifies as long pasted content
 */
export function analyzePastedContent(text: string): PastedContentMetadata {
  const charCount = text.length;
  const lines = text.split('\n');
  const lineCount = lines.length;
  const sizeBytes = new Blob([text]).size;

  const isPastedContent = charCount > PASTED_CHAR_THRESHOLD || lineCount > PASTED_LINE_THRESHOLD;

  // Infer language and filename
  let inferredLanguage = 'plaintext';
  let inferredFilename = 'pasted_content.txt';

  if (/CREATE\s+TABLE|SELECT\s+.*FROM|INSERT\s+INTO/i.test(text)) {
    inferredLanguage = 'sql';
    inferredFilename = 'query.sql';
  } else if (/<!DOCTYPE html>|<html|<div|<body/i.test(text)) {
    inferredLanguage = 'html';
    inferredFilename = 'document.html';
  } else if (/\{[\s\S]*\}|\[[\s\S]*\]/.test(text) && (text.startsWith('{') || text.startsWith('['))) {
    try {
      JSON.parse(text);
      inferredLanguage = 'json';
      inferredFilename = 'data.json';
    } catch {
      // Not JSON
    }
  } else if (/def\s+\w+\(|import\s+sys|import\s+os/i.test(text)) {
    inferredLanguage = 'python';
    inferredFilename = 'script.py';
  } else if (/function\s+\w+|const\s+\w+\s*=|import\s+React/i.test(text)) {
    inferredLanguage = 'typescript';
    inferredFilename = 'code.ts';
  }

  const previewSnippet = lines.slice(0, 4).join('\n');

  return {
    isPastedContent,
    charCount,
    lineCount,
    sizeBytes,
    inferredFilename,
    inferredLanguage,
    previewSnippet,
  };
}
