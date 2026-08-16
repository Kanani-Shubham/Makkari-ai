import { ToolDefinition } from '../types';

export const webSearchTool: ToolDefinition = {
  id: 'web_search',
  name: 'web_search',
  description: 'Searches the web for up-to-date documentation, real-time facts, news, and technical references.',
  category: 'search',
  permissions: 'read',
  requiresConfirmation: false,
  enabled: true,
  source: 'builtin',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the web (e.g. "Next.js 16 breaking changes")',
      },
      numResults: {
        type: 'number',
        description: 'Maximum number of results to return (1-5, default: 3)',
      },
    },
    required: ['query'],
  },
  handler: async (args, context) => {
    const query = String(args.query || '').trim();
    if (!query) return { success: false, error: 'Search query is required.' };

    const limit = Math.min(Math.max(1, Number(args.numResults) || 3), 5);

    try {
      context?.onProgress?.(0.2, `Executing web search for: "${query}"`);

      // Use DuckDuckGo HTML API or standard public search endpoint
      const encodedQuery = encodeURIComponent(query);
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodedQuery}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      context?.onProgress?.(0.6, 'Parsing search results...');


      if (!res.ok) {
        return {
          success: true,
          result: [],
          formattedOutput: `Search query completed for "${query}". No direct results returned.`,
        };
      }

      const html = await res.text();
      const results: Array<{ title: string; snippet: string; url: string }> = [];

      // Extract result snippets via regex
      const regex = /<a class="result__snippet[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      while ((match = regex.exec(html)) !== null && results.length < limit) {
        const rawUrl = match[1];
        const snippet = match[2].replace(/<[^>]+>/g, '').trim();
        results.push({
          title: `Result for: ${query}`,
          snippet,
          url: rawUrl,
        });
      }

      const formatted = results
        .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nSummary: ${r.snippet}`)
        .join('\n\n');

      return {
        success: true,
        result: results,
        formattedOutput: formatted || `Web search executed for "${query}".`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Web search error';
      return { success: false, error: msg };
    }
  },
};
