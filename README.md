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

- [Node.js](https://nodejs.org/) — the version in `.nvmrc` (`engine-strict` is enabled, so `npm install` refuses other majors)

```sh
npm install
```

---

## Deployment Options

There are two ways to use this MCP server. Full walkthrough with screenshots: [Setting up Repliers MCP](https://help.repliers.com/en/article/setting-up-repliers-mcp-8mi5t5/) ([video](https://youtu.be/qsKQWsjFDw4)).

| | Hosted (recommended) | Self-hosted |
| --- | --- | --- |
| Server to run | none | yours (Node or [Docker](#docker)) |
| Auth | sign in with your Repliers account | none — API key in the environment |
| Clients | claude.ai, ChatGPT, any remote-MCP client | Claude Desktop, Postman, any stdio/HTTP client |

---

### Option 1 — Repliers Hosted MCP (recommended)

Repliers runs this server at **`https://mcp.repliers.io`**. Nothing to install; you link an API key to it and sign in from your client.

**1. Link your API key to MCP** (self-serve, no support ticket needed):

1. Sign in to the [Repliers Developer Portal](https://login.repliers.com/dashboard/apikeys).
2. Find your API key and click the **MCP** icon next to it.

Only one API key can be linked to Repliers MCP at a time. For `Search_Listings` the linked key must also have NLP enabled — see [Enabling NLP](#enabling-nlp-for-search_listings).

**2. Add the connector in your client:**

- **Claude (claude.ai):** menu → **Customize** → **Connectors** → **Add connector** → URL `https://mcp.repliers.io` → Save.
- **ChatGPT:** **Settings** → **Connectors** → **Add a custom connector / MCP server** → URL `https://mcp.repliers.io` → Save.

**3. Sign in** with your Repliers account when the client prompts you. After that the linked API key is used for every request; no key ever goes into the client config.

> **One-time re-login when the hosted server moves to OAuth 2.1.** The login flow is changing so
> that command-line and desktop clients — Claude Code, Claude Desktop, Codex — can sign in at all,
> which they currently cannot. Existing connectors will ask you to log in once more after the
> change; nothing else about them changes, and no API key needs re-issuing.

---

### Option 2 — Self-Hosted (no auth)

Run the server yourself with your Repliers API key in the environment. No OAuth, no user accounts — just a direct connection. Ideal for personal use and internal tools where you don't need per-user authentication.

**1. Clone and install:**

```sh
git clone https://github.com/Repliers-io/mcp-server.git
cd mcp-server
npm install
```

**2. Create a `.env` file in the project root:**

```
REPLIERS_API_KEY=your-repliers-api-key
PORT=3001
```

To run against a deployment other than production, add `REPLIERS_API_BASE_URL` (default
`https://api.repliers.io`). It repoints every tool at once, generated and hand-written alike, and
`refine-search`'s host check moves with it.

**3. Start the server** in one of two transports:

```sh
node mcpServer.js          # stdio — for Claude Desktop, Postman, and other local clients
node mcpServer.js --http   # Streamable HTTP on http://localhost:3001/mcp (and /) — for remote-MCP clients
```

#### Claude Desktop (stdio)

Get the absolute paths — Claude Desktop does not inherit your shell's `PATH`, so a relative `node` may resolve to an older install:

```sh
which node
realpath mcpServer.js
```

Add to **Claude Desktop → Settings → Developers → Edit Config**:

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

Restart Claude Desktop and confirm the green indicator under **Settings → Developers**. To run the same thing from a container instead, see [Docker](#docker).

#### Postman (stdio, quick tool check)

In [Postman Desktop](https://www.postman.com/downloads/) create a new **MCP Request**, set the type to **STDIO** and the command to `node /absolute/path/to/mcpServer.js`, then **Connect** to browse the tool roster.

#### Troubleshooting

| Symptom | Fix |
| --- | --- |
| Hosted: "MCP server not connected" | Link an API key in the Developer Portal — only one key can be linked at a time |
| Hosted: asked to sign in on every connection | Finish the sign-in flow fully; if it persists, unlink and re-link the API key |
| Claude Desktop runs an old Node | Use the absolute path from `which node` in `command` |
| Tools don't appear after editing the config | Restart Claude Desktop; check for the green status under **Settings → Developers** |

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

One image serves both transports; the default command is Streamable HTTP.

```sh
docker build -t repliers-mcp .

# Streamable HTTP (default) — endpoint http://localhost:3001/mcp (and /)
docker run --rm --env-file .env -p 3001:3001 repliers-mcp

# stdio — override the command, keep stdin open, no TTY, no port
docker run -i --rm --env-file .env repliers-mcp node mcpServer.js
```

For a stdio MCP client (Claude Desktop, Cursor, …) point the client at `docker`:

```json
{
  "mcpServers": {
    "repliers": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--env-file", "/absolute/path/to/.env", "repliers-mcp", "node", "mcpServer.js"]
    }
  }
}
```

`-i` is required (without it stdin closes and the server exits); `-t` must **not** be set (a TTY corrupts the JSON-RPC stream). The image runs as the unprivileged `node` user and excludes `.env`, `node_modules`, `.git`, `docs` and `test` via `.dockerignore` — configuration comes only from `--env-file` or `-e`.

---

## Agent feedback & search reliability

The server nudges agents to verify NLP search results and report problems (design:
`docs/agent-feedback/design.md`).

| Env var | Default | Effect |
|---|---|---|
| `TRELLO_API_KEY` / `TRELLO_API_TOKEN` / `TRELLO_LIST_ID` | unset | Feedback sink. All three set → the `send-feedback` tool is registered and `_feedback` nudges are emitted. Any missing → the tool is hidden and nudges are suppressed. |
| `FEEDBACK_PROMPT_LEVEL` | `high` | `off` — no nudges; `low` — nudges only on detected problems (zero results, missing location filter, API errors, oversized responses); `high` — also a verify/offer note on every search response. |

Note: `node index.js tools` does not load `.env`, so `send-feedback` may be absent from that CLI
listing while still being served — check via a real MCP session.

To obtain those three values, or to point the sink at a different Trello account, board or list, see
[docs/agent-feedback/trello-setup.md](docs/agent-feedback/trello-setup.md).
