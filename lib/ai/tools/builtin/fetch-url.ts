import { ToolDefinition } from '../types';

export const fetchUrlTool: ToolDefinition = {
  id: 'fetch_url',
  name: 'fetch_url',
  description: 'Fetches and extracts clean, readable text content or documentation from a specific web URL.',
  category: 'web',
  permissions: 'read',
  requiresConfirmation: false,
  enabled: true,
  source: 'builtin',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The HTTP/HTTPS URL to fetch and read',
      },
    },
    required: ['url'],
  },
  handler: async (args, context) => {
    const rawUrl = String(args.url || '').trim();
    if (!rawUrl) return { success: false, error: 'URL is required.' };

    try {
      context?.onProgress?.(0.1, `Validating URL: ${rawUrl}`);

      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { success: false, error: 'Only http and https protocols are supported.' };
      }

      context?.onProgress?.(0.3, `Connecting to ${parsed.hostname}...`);

      const res = await fetch(rawUrl, {
        headers: {
          'User-Agent': 'MakkariBot/1.0 (Mozilla/5.0 web fetcher)',
        },
      });

      if (!res.ok) {
        return { success: false, error: `Failed to fetch URL: HTTP status ${res.status}` };
      }

      context?.onProgress?.(0.7, 'Reading and parsing response content...');

      const text = await res.text();


      // Clean HTML tags and scripts
      const cleaned = text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Truncate to safe context budget
      const truncated = cleaned.slice(0, 4000);

      return {
        success: true,
        result: { url: rawUrl, content: truncated },
        formattedOutput: `[Extracted from ${rawUrl}]\n${truncated}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'URL fetch error';
      return { success: false, error: msg };
    }
  },
};
