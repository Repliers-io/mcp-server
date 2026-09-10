Repliers MCP connects the Repliers API to AI assistants like ChatGPT, Claude, Claude Code and Codex, enabling you to leverage all of Repliers' features through natural language — including property searches, market analytics, listing history, and more.

||| ⚠️ **Disclaimer:** Repliers is MLS-agnostic technology. It is the responsibility of each Repliers user to ensure that their use case is in accordance with their MLS policies.

There are two ways to use Repliers MCP:

* **Hosted MCP** *(recommended)* — connect directly to Repliers' MCP Server at `https://mcp.repliers.io` and sign in with your Repliers account. No server setup, and no API key ever goes into your client configuration.
* **Open Source / Self-hosted** *(for technical users)* — run your own instance using the [Repliers MCP Server on GitHub](https://github.com/Repliers-io/mcp-server) with your API key in the environment. Recommended for developers who want full control over their environment or need a customized setup.

---

## Step 1: Link Your API Key to MCP

Before connecting any MCP client to the hosted server, you need to authorize a Repliers API key for use with MCP. (Self-hosters skip this step — your key goes in a `.env` file instead, see Option B.)

1. Sign in to the [Repliers Developer Portal](https://login.repliers.com/dashboard/apikeys)
2. Find the API key you want to use and click the **MCP icon** next to it
3. That key is now linked to Repliers MCP

|| **Note:** Only one API key can be linked to Repliers MCP at a time. Linking a new key will unlink the previous one. You do not need to reconnect or sign in again after changing the linked key.

---

## Step 2: Configure NLP for Listing Search

The `Search_Listings` tool works differently from most MCP tools — instead of relying on the AI assistant to structure the API request, it passes your natural language query directly to Repliers' own NLP endpoint. This approach was chosen because it produces significantly more accurate results: Repliers' NLP layer understands MLS-specific terminology, normalizes values to match MLS® standards, and supports context-aware conversational searches.

Because the NLP endpoint is powered by OpenAI, **you must link a valid OpenAI API key to your Repliers API key before `Search_Listings` will work.** Every other tool works without it.

### How to Enable NLP Search

1. Sign in to the [Repliers Developer Portal](https://login.repliers.com/dashboard/apikeys)
2. Select the API key you have linked to MCP
3. Edit the key settings and locate the **NLP Search** option
4. Enter your **OpenAI API key** and save

Once configured, the `Search_Listings` tool will accept natural language queries and automatically convert them into structured Repliers API requests. Full guide: [Utilizing AI-Powered NLP for Real Estate Listing Searches](https://help.repliers.com/en/article/utilizing-ai-powered-nlp-for-real-estate-listing-searches-1fvddra/#3-how-to-enable-nlp-search).

|| ⚠️ **Cost note:** Using NLP search will incur OpenAI API fees based on your usage volume. We recommend monitoring your usage and setting up billing alerts in your OpenAI account. See [OpenAI's API pricing page](https://openai.com/api/pricing/) for details.

### What NLP Search Can Do

* **Natural language to structured queries** — "Find me a condo in Toronto with at least 1 bedroom in the Annex with underground parking" is automatically converted into the correct Repliers API parameters
* **Context-aware conversations** — follow-up prompts refine the previous search without starting over (e.g., "Also, my budget is $500k and I need at least 1 parking spot")
* **AI image search integration** — visual preferences like "white kitchen" or "open concept living room" are incorporated into the search
* **MLS® data normalization** — user-friendly terms are mapped to valid MLS® values (e.g., "enclosed balcony" → `balcony=encl`)

### How the assistant keeps searches honest

Every `Search_Listings` response leads with an `appliedFilters` block that shows which filters were actually applied — location, property type, style, price range, bedrooms and so on. The assistant is instructed to compare that block against your request before presenting results, because the NLP parser occasionally drops or substitutes a constraint. When it finds a mismatch it fixes it with `refine-search`, which re-runs the previous search with only the named parameters corrected, and can report the misparse to the Repliers team with `send-feedback` so the parser improves over time. You will always be told when a report is sent.

---

## Option A: Hosted MCP Server *(Recommended)*

The hosted MCP server is the fastest and easiest way to get started — no installation or local server required. It runs at:

```
https://mcp.repliers.io
```

Both `https://mcp.repliers.io` and `https://mcp.repliers.io/mcp` are accepted; use whichever your client prefers. The server speaks Streamable HTTP and authenticates with **OAuth 2.1**: your client opens a browser window, you sign in with your Repliers account, and the client is returned an access token. The API key you linked in Step 1 is then used for every request — it never appears in your client's configuration.

### Connecting via Claude (claude.ai and Claude Desktop)

1. In Claude, open **Settings → Connectors**
2. Choose **Add custom connector**
3. Enter the hosted MCP URL: https://mcp.repliers.io
4. Save the connector
5. When prompted, sign in to your Repliers account to authorize the connection

Once connected, Claude will have access to all Repliers MCP tools in your conversations. Connectors added on claude.ai are available in the Claude desktop and mobile apps too.

### Connecting via ChatGPT

1. In ChatGPT, go to **Settings → Connectors** (or your workspace's app/plugin management area)
2. Select **Add a custom connector** or **MCP Server**
3. Enter the hosted MCP URL: https://mcp.repliers.io
4. Save the configuration
5. When prompted, sign in to your Repliers account to complete authorization

#### Watch The Video!

Our Co-Founder, Patrick Arlia recorded a video that shows you how to connect ChatGPT to Repliers. [Click here to view it on YouTube](https://youtu.be/qsKQWsjFDw4?si=FiM44M1Dq-28yUk7).

### Connecting via Claude Code

```bash
claude mcp add --transport http repliers https://mcp.repliers.io/mcp
```

Then run `/mcp` inside Claude Code and choose **Authenticate** next to `repliers`. A browser window opens for the Repliers sign-in; once it completes, the tools are available in your session.

### Connecting via Codex, Cursor and other MCP clients

Any client that supports remote MCP servers over Streamable HTTP with OAuth 2.1 can connect. Add a remote (HTTP) server with the URL `https://mcp.repliers.io/mcp`, leave authentication set to OAuth, and complete the browser sign-in when the client prompts for it.

|| **First-time sign-in:** On your first connection from any client, you will be redirected to sign in to Repliers if you are not already authenticated. Complete the sign-in flow and you will be returned to your client automatically.

|| **Upgraded from an earlier version?** The hosted server moved to OAuth 2.1. Connectors created before the change will ask you to sign in once more; nothing else about them changes, and your linked API key does not need to be re-issued.

---

## Option B: Open Source / Self-Hosted MCP Server *(For Technical Users)*

If you prefer to run your own MCP server — for example, in a production environment or to customize the toolset — you can use the open source version. This option is recommended for developers comfortable with the command line.

A self-hosted server has no user accounts or OAuth: it authenticates to Repliers with the API key in its environment, so it should only be exposed to people you trust with that key. It is ideal for personal use and internal tools.

### Prerequisites

* [Node.js](https://nodejs.org/) — the version pinned in the repository's `.nvmrc` file (currently 26.x). The project enables `engine-strict`, so `npm install` refuses other major versions. If you use a version manager such as `nvm` or `fnm`, run `nvm use` / `fnm use` in the project directory first.
* npm (included with Node.js)
* A Repliers API key

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/Repliers-io/mcp-server.git
cd mcp-server
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure your API key**

Create a `.env` file in the project root:

```
REPLIERS_API_KEY=your-repliers-api-key
PORT=3001
```

`PORT` only matters for the HTTP transport (below) and defaults to 3001.

**4. Start the server**

The server supports two transports from one entry point:

```bash
node mcpServer.js          # stdio — for Claude Desktop, Postman, and other local clients
node mcpServer.js --http   # Streamable HTTP on http://localhost:3001/mcp (and /) — for remote-MCP clients
```

|| **Note:** Earlier versions were started with `--sse`. That flag is still accepted as an alias, but the transport is now Streamable HTTP, served at both `/mcp` and `/`. Point clients at `http://localhost:3001/mcp`.

### Testing with Postman (Optional but Recommended)

Before connecting to an AI client, you can verify your server is working using the Postman Desktop App.

1. Download [Postman Desktop](https://www.postman.com/downloads/)
2. Create a new **MCP Request**
3. Set the type to `STDIO` and the command to:

```bash
node /absolute/path/to/mcpServer.js
```

   To find the absolute path, run:

```bash
realpath mcpServer.js
```

4. Click **Connect** — you should see a list of available Repliers tools

### Connecting to Claude Desktop

1. Get the absolute paths to your `node` binary and `mcpServer.js`:

```bash
which node
realpath mcpServer.js
```

2. Open Claude Desktop → **Settings → Developers → Edit Config** and add:

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

3. Save and restart Claude Desktop
4. Confirm the Repliers server has a green indicator under **Settings → Developers**

|| **Tip:** Always use the absolute path to `node`. Claude Desktop does not inherit your shell's `PATH`, so a bare `node` may resolve to an older install than the one the server requires. You can check your version with `node --version`.

### Connecting to Claude Code

```bash
claude mcp add --transport http repliers http://localhost:3001/mcp
```

with the server running as `node mcpServer.js --http`. No sign-in is needed for a self-hosted server.

### Docker Deployment (Production)

For production use, Docker is recommended for reliability and isolation. One image serves both transports; the default command is Streamable HTTP.

**1. Build the image**

```bash
docker build -t repliers-mcp .
```

**2. Run it**

```bash
# Streamable HTTP (default) — endpoint http://localhost:3001/mcp (and /)
docker run --rm --env-file .env -p 3001:3001 repliers-mcp

# stdio — override the command, keep stdin open, no TTY, no port
docker run -i --rm --env-file .env repliers-mcp node mcpServer.js
```

**3. For a stdio client such as Claude Desktop**, point the client at `docker`:

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

Make sure your `.env` file contains your `REPLIERS_API_KEY`. `-i` is required (without it stdin closes and the server exits); `-t` must **not** be set (a TTY corrupts the JSON-RPC stream). The image runs as the unprivileged `node` user and excludes `.env`, `node_modules`, `.git`, `docs` and `test` — configuration comes only from `--env-file` or `-e`.

### Optional configuration

| Variable | Effect |
| --- | --- |
| `REPLIERS_API_BASE_URL` | Points every tool at a different Repliers deployment (default `https://api.repliers.io`) |
| `TRELLO_API_KEY`, `TRELLO_API_TOKEN`, `TRELLO_LIST_ID` | Enables the `send-feedback` tool, which files search-quality reports as Trello cards on your own board. Without all three, the tool is hidden and the assistant is never asked to report anything |
| `FEEDBACK_DRY_RUN` | `true` enables `send-feedback` without Trello keys; reports are written to the server's log instead of posted |
| `FEEDBACK_PROMPT_LEVEL` | How eagerly the server nudges the assistant to verify results and report problems: `high` (default), `low` (only on detected problems) or `off` |
| `FEEDBACK_CONSENT` | `auto` (default) reports technical failures without asking the user; `always-ask` requires the user's agreement before any report is sent |

Restart the server after every `.env` change.

---

## Available Tools

Once connected, your AI assistant can use the full suite of Repliers tools, organized by category:

### Listings
| Tool | Description |
| ---- | ---- |
| `Search_Listings` | Natural-language search of active, sold or leased listings via Repliers NLP — the entry point for every new search. Requires NLP to be enabled (Step 2). Responses lead with `appliedFilters`, the ground truth of what was searched |
| `refine-search` | Surgically corrects a previous `Search_Listings` result when a constraint was dropped or substituted, re-running it with only the named parameters changed. Never starts a search from scratch |
| `get-listing` | Fetch detailed information for a specific listing by MLS number |
| `Get_Listing_Image` | Download a listing's photo (cover image by default, or the Nth photo) and return it as viewable image data — useful when the assistant cannot load image URLs directly |
| `get-similar-listings` | Return listings similar to a given property by location, price, or type |
| `get-address-listing-history` | Retrieve full MLS listing history for a specific address |
| `Lookup_Possible_Values` | Retrieve the exact values your board uses for listing fields (property types, styles, neighborhoods, etc.) — used before statistics queries and refinements so filter values are valid |
| `Market_Statistics` | Market statistics and reports — averages, medians, days on market — filtered by property attributes and grouped by time or geography |

### Locations & Buildings
| Tool | Description |
| ---- | ---- |
| `search-locations` | Search geographic locations supported by the Repliers API |
| `autocomplete-location-search` | Autocomplete location queries for search inputs |
| `search-buildings` | Search building-level data for condos, apartments, and complexes |
| `get-building` | Fetch detailed information about a specific building |

### Agents, Members & Brokerages
| Tool | Description |
| ---- | ---- |
| `search-agents` | Search for agents |
| `get-agent` | Retrieve details for a specific agent |
| `create-agent` | Create a new agent record |
| `update-agent` | Update an existing agent record |
| `delete-agent` | Delete an agent record |
| `search-members` | Search for MLS members |
| `search-brokerages` | Search for brokerages |
| `search-offices` | Search for offices |

### Clients
| Tool | Description |
| ---- | ---- |
| `search-clients` | Search for clients |
| `get-client` | Retrieve details for a specific client |
| `create-client` | Create a new client record |
| `update-client` | Update an existing client record |
| `delete-client` | Delete a client record |

### Saved Searches
| Tool | Description |
| ---- | ---- |
| `list-saved-searches` | List all saved searches |
| `get-saved-search` | Retrieve a specific saved search |
| `create-saved-search` | Create a new saved search |
| `update-saved-search` | Update an existing saved search |
| `delete-saved-search` | Delete a saved search |
| `list-saved-search-matches` | List listings matching a saved search |
| `get-saved-search-match` | Retrieve a specific saved search match |
| `update-saved-search-match` | Update a saved search match |

### Favorites
| Tool | Description |
| ---- | ---- |
| `list-favorites` | List favorited listings |
| `remove-favorite` | Remove a listing from favorites |

### Estimates
| Tool | Description |
| ---- | ---- |
| `list-estimates` | List property estimates |
| `create-estimate` | Create a new property estimate |
| `update-estimate` | Update an existing estimate |
| `delete-estimate` | Delete an estimate |

### Messaging & NLP
| Tool | Description |
| ---- | ---- |
| `list-messages` | List messages |
| `get-message` | Retrieve a specific message |
| `send-message` | Send a message |
| `list-nlp-chat-sessions` | List NLP chat sessions |
| `list-nlp-search-history` | Retrieve NLP search history |

### Feedback
| Tool | Description |
| ---- | ---- |
| `send-feedback` | Report a search-quality or API problem to the Repliers team (an NLP misparse, an API error, wrong or empty results). Available on the hosted server; on a self-hosted server only when Trello keys are configured |

Every tool is annotated as read-only or mutating, so clients that hide write operations (for example read-only ChatGPT connectors) filter the list automatically.

### Example Prompts

* *"Find 3-bedroom apartments in San Francisco under $1 million listed in the last week"*
* *"Show me the cover photo of the first one"*
* *"Send listing alerts to my client john doe when 4 bedroom homes in austin hit the market"*
* *"Give me the listing history for 123 Main St, San Francisco"*
* *"What's the median list price for residential homes in Austin, aggregated by month over the last 18 months?"*

|| **Scope note:** The assistant only answers from the data these tools return — listings, locations, market statistics and CRM records for your MLS dataset. It has no mortgage-rate, tax, financing or legal data and will say so rather than guess.

---

## Troubleshooting

**The hosted MCP server isn't showing as connected**
Make sure you've linked an API key in the Repliers Developer Portal (Step 1 above). Only one key can be active at a time. If you signed in but every tool call fails with "account not provisioned", the account you signed in with has no linked key.

**I'm being asked to sign in again after an update**
Expected once: the hosted server moved to OAuth 2.1 and existing connectors must re-authorize. Complete the sign-in and it will not ask again until the token expires.

**I'm being asked to sign in on every connection**
Ensure you're completing the Repliers sign-in flow fully. If the issue persists, remove and re-add the connector, or unlink and re-link your API key in the Developer Portal.

**`Search_Listings` fails but other tools work**
NLP is not enabled on the linked API key. Follow Step 2.

**`npm install` refuses to run (self-hosted)**
Your Node.js version does not match `.nvmrc`. Install the pinned version (or run `nvm use` / `fnm use`) and try again.

**Claude Desktop falls back to an old Node version**
Use the absolute path to your Node binary (from `which node`) rather than just `node` in your config.

**Tools aren't appearing in Claude**
Restart Claude Desktop after editing the config file. Confirm the server has a green status indicator under Settings → Developers. For the hosted connector, check that the connector is enabled for the current conversation.

**My client connects but reports the wrong endpoint (self-hosted)**
The HTTP transport is served at `/mcp` (and `/`) on the configured `PORT`. The old `--sse` flag now starts the same Streamable HTTP server.

---

## Additional Resources

* [Repliers Developer Portal](https://login.repliers.com/dashboard/apikeys)
* [Repliers MCP Server on GitHub](https://github.com/Repliers-io/mcp-server)
* [Enabling NLP Search](https://help.repliers.com/en/article/utilizing-ai-powered-nlp-for-real-estate-listing-searches-1fvddra/)
* [Repliers API Documentation](https://repliers.com/developer-agencies/)
* [Create a Repliers Account](https://auth.repliers.com/en/signup)
