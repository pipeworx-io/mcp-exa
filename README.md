# mcp-exa

Exa MCP — neural/semantic web search + content retrieval (exa.ai)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search` | Neural/semantic web search — find pages by meaning, not just keywords. Returns title, URL, published date, author, and relevance score. Optionally retrieve clean page text inline. Example: search({ query: "startups building AI agents for customer support", num_results: 10, type: "neural" }) |
| `get_contents` | Retrieve clean, parsed page contents (text) for one or more Exa result IDs or URLs. Use after search to read the full content of pages. Example: get_contents({ ids: ["https://example.com/article"] }) |
| `find_similar` | Find pages similar to a given URL using neural/semantic matching. Returns title, URL, relevance score, and published date. Example: find_similar({ url: "https://example.com/great-article", num_results: 10 }) |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "exa": {
      "url": "https://gateway.pipeworx.io/exa/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Exa data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
