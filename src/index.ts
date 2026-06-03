interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Exa MCP — neural/semantic web search + content retrieval (exa.ai)
 *
 * Tools:
 * - search: neural/semantic web search — find pages by meaning, not keywords
 * - get_contents: retrieve clean, parsed page contents for result IDs or URLs
 * - find_similar: find pages similar to a given URL
 *
 * Dual-key model: pass your own Exa key via _apiKey (OPTIONAL) for higher
 * limits, or omit it to use the shared Pipeworx key. Auth is the x-api-key
 * header on POST requests with a JSON body.
 */


const BASE_URL = 'https://api.exa.ai';

const tools: McpToolExport['tools'] = [
  {
    name: 'search',
    description:
      'Neural/semantic web search — find pages by meaning, not just keywords. Returns title, URL, published date, author, and relevance score. Optionally retrieve clean page text inline. Example: search({ query: "startups building AI agents for customer support", num_results: 10, type: "neural" })',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query — describe what you want by meaning, e.g. "recent research on protein folding with diffusion models"',
        },
        num_results: {
          type: 'number',
          description: 'Number of results to return (default 10, max 25)',
        },
        type: {
          type: 'string',
          description: "Search mode: 'neural' (semantic/meaning-based), 'keyword' (traditional), or 'auto' (Exa picks). Default 'auto'.",
        },
        include_text: {
          type: 'boolean',
          description: 'If true, include the clean parsed page text (up to 2000 chars) for each result. Default false.',
        },
        category: {
          type: 'string',
          description: "Optional focus category, e.g. 'company', 'research paper', 'news', 'pdf', 'github', 'tweet'.",
        },
        _apiKey: {
          type: 'string',
          description: 'Optional — your own Exa API key for higher limits; omit to use the shared Pipeworx key.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_contents',
    description:
      'Retrieve clean, parsed page contents (text) for one or more Exa result IDs or URLs. Use after search to read the full content of pages. Example: get_contents({ ids: ["https://example.com/article"] })',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: ['string', 'array'],
          items: { type: 'string' },
          description: 'An Exa result ID or URL, or an array of them.',
        },
        _apiKey: {
          type: 'string',
          description: 'Optional — your own Exa API key for higher limits; omit to use the shared Pipeworx key.',
        },
      },
      required: ['ids'],
    },
  },
  {
    name: 'find_similar',
    description:
      'Find pages similar to a given URL using neural/semantic matching. Returns title, URL, relevance score, and published date. Example: find_similar({ url: "https://example.com/great-article", num_results: 10 })',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to find semantically similar pages for.',
        },
        num_results: {
          type: 'number',
          description: 'Number of results to return (default 10, max 25)',
        },
        _apiKey: {
          type: 'string',
          description: 'Optional — your own Exa API key for higher limits; omit to use the shared Pipeworx key.',
        },
      },
      required: ['url'],
    },
  },
];

async function exaPost(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: any } | { ok: false; error: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: { error: res.status, message: text } };
  }

  return { ok: true, data: await res.json() };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = args._apiKey as string;
  delete args._apiKey;

  if (!apiKey) {
    return { error: 'api_key_required', message: 'No Exa key available.' };
  }

  switch (name) {
    case 'search':
      return search(args, apiKey);
    case 'get_contents':
      return getContents(args, apiKey);
    case 'find_similar':
      return findSimilar(args, apiKey);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function clampResults(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : fallback;
  return Math.min(25, Math.max(1, v));
}

async function search(args: Record<string, unknown>, apiKey: string) {
  const query = args.query as string;
  const num_results = clampResults(args.num_results, 10);
  const type = (args.type as string) ?? 'auto';
  const include_text = args.include_text === true;
  const category = args.category as string | undefined;

  const body: Record<string, unknown> = {
    query,
    numResults: num_results,
    type,
    ...(category ? { category } : {}),
    ...(include_text ? { contents: { text: { maxCharacters: 2000 } } } : {}),
  };

  const resp = await exaPost(apiKey, '/search', body);
  if (!resp.ok) return resp.error;

  const data = resp.data as {
    results?: Array<{
      title?: string; url?: string; publishedDate?: string;
      author?: string; score?: number; text?: string;
    }>;
    autopromptString?: string;
  };

  const results = (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    publishedDate: r.publishedDate,
    author: r.author,
    score: r.score,
    ...(r.text ? { text: r.text } : {}),
  }));

  return { results, autopromptString: data.autopromptString };
}

async function getContents(args: Record<string, unknown>, apiKey: string) {
  const rawIds = args.ids;
  const ids = Array.isArray(rawIds) ? rawIds : [rawIds];

  const resp = await exaPost(apiKey, '/contents', {
    ids,
    text: { maxCharacters: 5000 },
  });
  if (!resp.ok) return resp.error;

  const data = resp.data as {
    results?: Array<{ id?: string; url?: string; title?: string; text?: string }>;
  };

  const results = (data.results ?? []).map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    text: (r.text || '').slice(0, 5000),
  }));

  return { results };
}

async function findSimilar(args: Record<string, unknown>, apiKey: string) {
  const url = args.url as string;
  const num_results = clampResults(args.num_results, 10);

  const resp = await exaPost(apiKey, '/findSimilar', {
    url,
    numResults: num_results,
  });
  if (!resp.ok) return resp.error;

  const data = resp.data as {
    results?: Array<{ title?: string; url?: string; score?: number; publishedDate?: string }>;
  };

  const results = (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    score: r.score,
    publishedDate: r.publishedDate,
  }));

  return { results };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
