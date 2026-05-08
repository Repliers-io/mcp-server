# Repliers MCP Server

An MCP (Model Context Protocol) server that gives AI assistants like Claude access to real-time MLS data via the [Repliers API](https://repliers.com/developer-agencies/).

Use natural language to search listings, pull market statistics, and look up properties:

- "Find me 3 bedroom condos in Toronto under $800k listed in the last week"
- "What's the average sold price for detached homes in Boston grouped by month over the last year?"
- "Get me the details for MLS number X12345678"

---

## Tools

| Tool | Description |
|---|---|
| `Search_Listings` | Natural language listing search powered by Repliers NLP — requires NLP to be enabled on your Repliers account (see below) |
| `get_listing` | Fetch a single listing by MLS number |
| `Market_Statistics` | Market stats — averages, medians, days on market, grouped by time or geography |
| `Lookup_Possible_Values` | Enumerate valid filter values (property types, neighborhoods, etc.) before running a statistics query |

---

## Before You Start

### Repliers API Key

You'll need a Repliers API key. If you don't have an account, sign up at [repliers.com](https://auth.repliers.com/en/signup). You can find your API key in the [Repliers dashboard](https://login.repliers.com/dashboard/apikeys).

### Enabling NLP for Search_Listings

The `Search_Listings` tool uses Repliers' AI-powered NLP search, which translates natural language queries into listing results. This requires:

1. An **OpenAI API key** linked to your Repliers account
2. NLP enabled on your account

Follow the setup guide here: [Utilizing AI-Powered NLP for Real Estate Listing Searches](https://help.repliers.com/en/article/utilizing-ai-powered-nlp-for-real-estate-listing-searches-1fvddra/#3-how-to-enable-nlp-search)

If NLP isn't enabled, the other three tools (`get_listing`, `Market_Statistics`, `Lookup_Possible_Values`) will still work fine.

---

## Prerequisites

- [Node.js v22+](https://nodejs.org/)

```sh
npm install
```

---

## Deployment Options

There are three ways to use this MCP server. Pick the one that fits your setup.

---

### Option 1 — Repliers Hosted MCP (simplest)

Repliers runs a hosted version of this MCP server. You just point your MCP client at our endpoint — no server to run, no infrastructure to manage.

**To get access:** contact [Repliers support](https://repliers.com) to have your account configured for the hosted MCP. We'll set up your API key on our end.

Once your account is enabled, connect your MCP client to:

```
https://mcp.repliers.io
```

When you connect for the first time you'll be prompted to log in via your Repliers account. After that, your API key is automatically used for all requests.

---

### Option 2 — Self-Hosted (simple, no auth)

Run the server yourself with your Repliers API key in the environment. No OAuth, no user accounts — just a direct connection.

**1. Create a `.env` file in the project root:**

```
REPLIERS_API_KEY=your-repliers-api-key
PORT=3001
```

**2. Start the server:**

```sh
node mcpServer.js --http
```

**3. Connect your MCP client to:**

```
http://localhost:3001
```

This mode is ideal for personal use or internal tools where you don't need per-user authentication.

**To use with Claude Desktop (stdio mode):**

```sh
node mcpServer.js
```

Add to Claude Desktop → Settings → Developers → Edit Config:

```json
{
  "mcpServers": {
    "repliers": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/mcpServer.js"],
      "env": {
        "REPLIERS_API_KEY": "your-repliers-api-key"
      }
    }
  }
}
```

---

## Tool Generation

Tools are generated from an OpenAPI spec. When the spec changes, re-run the generator to pick up new endpoints, updated descriptions, and parameter changes — without touching custom tools.

---

### How it works

There are two kinds of tools, each in their own directory:

| Directory | Purpose |
|---|---|
| `tools/repliers/repliers-api/generated/` | Auto-generated from the OpenAPI spec. Safe to regenerate at any time. |
| `tools/repliers/repliers-api/custom/` | Hand-written tools (multi-step flows, custom logic). Never touched by the generator. |

Both directories are auto-discovered at server startup — no manifest to maintain.

---

### Generating tools

Place your OpenAPI spec at `openapi.json` in the project root (or configure a different path — see below), then run:

```sh
npm run generate
```

The generator will:
- Write one `.js` file per endpoint into `generated/`
- Fetch and embed external documentation content into each tool's description (see below)
- Remove any stale files from previous runs that are no longer in the spec
- Skip any excluded endpoints

#### External documentation

If an endpoint in the spec has an `externalDocs` field, the generator fetches that URL at generate time, strips the HTML to plain text, and appends the full article content to the tool's description. This gives the LLM substantially more context about when and how to use the tool correctly — including implementation guides, usage examples, and edge cases that aren't captured in the spec itself.

All doc pages are fetched in parallel. If a fetch fails, the tool is still generated using the spec description alone.

---

### Configuration — `codegen/config.js`

```js
export default {
  specPath: './openapi.json',   // path to your OpenAPI spec
  outputDir: './tools/repliers/repliers-api/generated',

  // Endpoints to skip — use operationId OR "METHOD /path"
  exclude: [
    'some-operation-id',
    'DELETE /some/path',
  ],
};
```

---

### Overrides — `codegen/overrides.json`

Keyed by `operationId`, or `"METHOD /path"` for operations without one. All fields are optional and survive every regeneration.

```json
{
  "some-operation-id": {
    "name": "my-tool-name",
    "description": "Fully replaces the auto-generated description.",
    "additionalContext": "Appended to the auto-generated description. Use this to preserve custom guidance without losing spec content.",
    "filename": "my-tool-name.js",
    "forcedQueryParams": {
      "listings": "false"
    },
    "excludeFromSchema": ["internalParam"],
    "parameterDescriptions": {
      "someParam": "Override description for this parameter."
    }
  }
}
```

| Field | Effect |
|---|---|
| `name` | Tool name shown to the LLM. Also used as the filename unless `filename` is set. |
| `description` | Fully replaces the auto-generated description (spec + fetched docs). |
| `additionalContext` | Appended to the auto-generated description. Preferred over `description` when you want to add guidance without losing spec content. |
| `filename` | Output filename. Defaults to `<name>.js`. |
| `forcedQueryParams` | Key/value pairs always appended to the request URL. Excluded from the tool's input schema. |
| `excludeFromSchema` | Parameter names to omit from the tool's input schema entirely. |
| `parameterDescriptions` | Per-parameter description overrides. |

---

### Custom tools

Custom tools live in `tools/repliers/repliers-api/custom/` and are never touched by the generator. Use this directory for multi-step tools, tools that stitch together multiple API calls, or any tool with logic that goes beyond a direct API call.

Each file must export an `apiTool` object:

```js
export const apiTool = {
  function: async (args) => {
    // your implementation
  },
  definition: {
    type: 'function',
    function: {
      name: 'my-custom-tool',
      description: 'What this tool does.',
      parameters: {
        type: 'object',
        properties: {
          myParam: { type: 'string', description: 'Description.' },
        },
        required: ['myParam'],
      },
    },
  },
};
```

Drop the file in `custom/` and it will be picked up automatically on the next server start — no registration required.

---

## Docker

```sh
docker build -t repliers-mcp .
docker run --env-file .env -p 3001:3001 repliers-mcp --sse
```
