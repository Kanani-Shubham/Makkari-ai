/**
 * Generates an intelligent, clean chat title from the user's first prompt message.
 * Max length: 40 characters.
 */
export function generateChatTitle(firstPrompt: string): string {
  if (!firstPrompt || !firstPrompt.trim()) {
    return 'New Conversation';
  }

  // Clean and normalize prompt text
  let cleaned = firstPrompt
    .replace(/["'""'']/g, '') // remove quotes
    .replace(/^(please|can you|help me|how to|i want to|could you)\s+/i, '')
    .trim();

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Truncate to 40 characters cleanly at word boundary
  if (cleaned.length > 40) {
    const truncated = cleaned.slice(0, 37);
    const lastSpace = truncated.lastIndexOf(' ');
    cleaned = (lastSpace > 10 ? truncated.slice(0, lastSpace) : truncated) + '...';
  }

  return cleaned || 'New Conversation';
}
