# Repliers MCP Server

An MCP (Model Context Protocol) server that gives AI assistants like ChatGPT, Claude, Claude Code and Codex access to real-time MLS data via the [Repliers API](https://repliers.com/developer-agencies/).

Use natural language to search listings, pull market statistics, and look up properties:

- "Find me 3 bedroom condos in Los Angeles under $800k listed in the last week"
- "What's the average sold price for detached homes in Boston grouped by month over the last year?"
- "Get me the details for MLS number X12345678"

---

## Tools

| Tool | Description |
|---|---|
| `Search_Listings` | Search listings on the MLS |
| `refine-search` | Correct a previous `Search_Listings` result when a constraint was dropped or substituted, re-running it with only the named parameters changed |
| `get-listing` | Fetch a single listing by MLS number |
| `Get_Listing_Image` | Download a listing's photo and return it as viewable image data |
| `get-similar-listings` | Listings similar to a given property by location, price, or type |
| `get-address-listing-history` | Full MLS listing history for a specific address |
| `Market_Statistics` | Market stats — averages, medians, days on market, grouped by time or geography |
| `Lookup_Possible_Values` | Enumerate valid filter values (property types, neighborhoods, etc.) before running a statistics query or a refinement |

Beyond listings, the server also exposes tools for locations and buildings, agents, members and brokerages, clients, saved searches, favorites, estimates, messaging and feedback. The full roster is in [Setting up Repliers MCP](https://help.repliers.com/en/article/setting-up-repliers-mcp-8mi5t5/#available-tools).

---

## Before You Start

### Repliers API Key

You'll need a Repliers API key. If you don't have an account, sign up at [repliers.com](https://auth.repliers.com/en/signup). You can find your API key in the [Repliers dashboard](https://login.repliers.com/dashboard/apikeys).

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
| Clients | Claude, ChatGPT, Claude Code, Codex, Cursor and other [supported remote-MCP clients](https://help.repliers.com/en/article/setting-up-repliers-mcp-8mi5t5/#supported-mcp-clients) | Claude Desktop, Claude Code, Postman, any stdio/HTTP client |

---

### Option 1 — Repliers Hosted MCP (recommended)

Repliers runs this server at **`https://mcp.repliers.io`**. Nothing to install; you link an API key to it and sign in from your client.

**1. Link your API key to MCP** (self-serve, no support ticket needed):

1. Sign in to the [Repliers Developer Portal](https://login.repliers.com/dashboard/apikeys).
2. Find your API key and click the **MCP** icon next to it.

Only one API key can be linked to Repliers MCP at a time. Linking a new key unlinks the previous one; you do not need to reconnect or sign in again after changing it.

**2. Add the server in your client.** Both `https://mcp.repliers.io` and `https://mcp.repliers.io/mcp` are accepted. The server speaks Streamable HTTP and authenticates with OAuth 2.1.

- **Claude (claude.ai and Claude Desktop):** **Settings** → **Connectors** → **Add custom connector** → URL `https://mcp.repliers.io` → Save.
- **ChatGPT** (set up from the web app at chatgpt.com, not the desktop apps): **Plugins** → **Add** → **Add Custom MCP Server** → name it, URL `https://mcp.repliers.io/mcp`, leave **Authentication** on **OAuth** → **Create as a plugin**. If you added Repliers to ChatGPT before, uninstall the old plugin first — two plugins offering the same tools make every request fail.
- **Claude Code:** `claude mcp add --transport http repliers https://mcp.repliers.io/mcp`, then run `/mcp` and choose **Authenticate** next to `repliers`.
- **Codex, Cursor and other MCP clients:** add a remote (HTTP) server with the URL `https://mcp.repliers.io/mcp` and leave authentication set to OAuth.

**3. Sign in** with your Repliers account when the client prompts you. After that the linked API key is used for every request; no key ever goes into the client config.

> **Upgraded from an earlier version?** The hosted server moved to OAuth 2.1. Connectors created
> before the change will ask you to sign in once more; nothing else about them changes, and your
> linked API key does not need to be re-issued.

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

#### Claude Code (HTTP)

With the server running as `node mcpServer.js --http`:

```sh
claude mcp add --transport http repliers http://localhost:3001/mcp
```

No sign-in is needed for a self-hosted server.

#### Postman (stdio, quick tool check)

In [Postman Desktop](https://www.postman.com/downloads/) create a new **MCP Request**, set the type to **STDIO** and the command to `node /absolute/path/to/mcpServer.js`, then **Connect** to browse the tool roster.

#### Troubleshooting

| Symptom | Fix |
| --- | --- |
| Hosted: "MCP server not connected" | Link an API key in the Developer Portal — only one key can be linked at a time |
| Hosted: asked to sign in on every connection | Finish the sign-in flow fully; if it persists, remove and re-add the connector, or unlink and re-link the API key |
| Hosted: sign-in fails with an OAuth redirect/callback error | The client is probably not on the [supported clients list](https://help.repliers.com/en/article/setting-up-repliers-mcp-8mi5t5/#supported-mcp-clients) — contact Repliers support to have it added |
| ChatGPT desktop app shows no option to add a plugin | Set it up from the web app at chatgpt.com; it then appears in the desktop and mobile apps |
| `npm install` refuses to run | Your Node.js version does not match `.nvmrc` — install the pinned version or run `nvm use` / `fnm use` |
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

The server nudges agents to verify search results against the request, and files problem reports as
Trello cards on your own board.

| Env var | Default | Effect |
|---|---|---|
| `TRELLO_API_KEY` / `TRELLO_API_TOKEN` / `TRELLO_LIST_ID` | unset | Feedback sink. All three set → the `send-feedback` tool is registered and `_feedback` nudges are emitted. Any missing → the tool is hidden, nudges are suppressed and nothing is recorded. |
| `TRELLO_AUTO_LIST_ID` | unset | A second Trello list for automatic `[MCP·auto]` cards: defects the server detects itself (parameters the API discarded, Repliers service errors), deduplicated and rate-limited. Without it automatic capture is off and a startup line says so; `send-feedback` still works. |
| `FEEDBACK_AUTO_CAPTURE` | `narrow` | `narrow` — capture only discarded parameters and service errors; `full` — also capture `refine-search` corrections and restated searches. `full` needs `TRELLO_AUTO_LIST_ID` (or dry-run). |
| `FEEDBACK_DRY_RUN` | unset | `true` — the feedback channel acts configured without Trello keys; cards are written to the server's log instead of posted. |
| `FEEDBACK_PROMPT_LEVEL` | `high` | `off` — no nudges; `low` — nudges only on detected problems (zero results, missing location filter, oversized responses, a `refine-search` correction); `high` — also a verify note on every search response. |

Note: `node index.js tools` does not load `.env`, so `send-feedback` may be absent from that CLI
listing while still being served — check via a real MCP session.
