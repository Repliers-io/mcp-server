Repliers MCP connects the Repliers API to AI assistants like ChatGPT and Claude, enabling you to leverage all of Repliers' features through natural language — including property searches, market analytics, listing history, and more.

||| ⚠️ **Disclaimer:** Repliers is MLS-agnostic technology. It is the responsibility of each Repliers user to ensure that their use case is in accordance with their MLS policies.

There are two ways to use Repliers MCP:

* **Hosted MCP** *(recommended)* — connect directly to Repliers' MCP Server with no server setup required. This is the easiest way to get started.
* **Open Source / Self-hosted** *(for technical users)* — run your own instance using the [Repliers MCP Server on GitHub](https://github.com/Repliers-io/mcp-server). Recommended for developers who want full control over their environment or need a customized setup.

---

## Step 1: Link Your API Key to MCP

Before connecting any MCP client, you need to authorize a Repliers API key for use with MCP.

1. Sign in to the [Repliers Developer Portal](https://login.repliers.com/dashboard/apikeys)
2. Find the API key you want to use and click the **MCP icon** next to it
3. That key is now linked to Repliers MCP

|| **Note:** Only one API key can be linked to Repliers MCP at a time. Linking a new key will unlink the previous one.

---

## Step 2: Configure NLP for Listing Search

The `search-listings` tool works differently from most MCP tools — instead of relying on the AI assistant to structure the API request, it passes your natural language query directly to Repliers' own NLP endpoint. This approach was chosen because it produces significantly more accurate results: Repliers' NLP layer understands MLS-specific terminology, normalizes values to match MLS® standards, and supports context-aware conversational searches.

Because the NLP endpoint is powered by OpenAI, **you must link a valid OpenAI API key to your Repliers API key before `search-listings` will work.**

### How to Enable NLP Search

1. Sign in to the [Repliers Developer Portal](https://login.repliers.com/dashboard/apikeys)
2. Select the API key you have linked to MCP
3. Edit the key settings and locate the **NLP Search** option
4. Enter your **OpenAI API key** and save

Once configured, the `search-listings` tool will accept natural language queries and automatically convert them into structured Repliers API requests.

|| ⚠️ **Cost note:** Using NLP search will incur OpenAI API fees based on your usage volume. We recommend monitoring your usage and setting up billing alerts in your OpenAI account. See [OpenAI's API pricing page](https://openai.com/api/pricing/) for details.

### What NLP Search Can Do

* **Natural language to structured queries** — "Find me a condo in Toronto with at least 1 bedroom in the Annex with underground parking" is automatically converted into the correct Repliers API parameters
* **Context-aware conversations** — follow-up prompts refine the previous search without starting over (e.g., "Also, my budget is $500k and I need at least 1 parking spot")
* **AI image search integration** — visual preferences like "white kitchen" or "open concept living room" are incorporated into the search
* **MLS® data normalization** — user-friendly terms are mapped to valid MLS® values (e.g., "enclosed balcony" → `balcony=encl`)

---

## Option A: Hosted MCP Server *(Recommended)*

The hosted MCP server is the fastest and easiest way to get started — no installation or local server required.

### Connecting via Claude

1. In Claude, open the menu and navigate to **Customize**
2. Under the **Connectors** section, choose **Add connector**
3. Enter the hosted MCP URL: https://mcp.repliers.io
4. Save the connector
5. When prompted, sign in to your Repliers account to authorize the connection

Once connected, Claude will have access to all Repliers MCP tools in your conversations.

### Connecting via ChatGPT

1. In ChatGPT, go to **Settings → Connectors** (or your workspace's app/plugin management area)
2. Select **Add a custom connector** or **MCP Server**
3. Enter the hosted MCP URL: https://mcp.repliers.io
4. Save the configuration
5. When prompted, sign in to your Repliers account to complete authorization

|| **First-time sign-in:** On your first connection from any client, you may be redirected to sign in to Repliers if you are not already authenticated. Complete the sign-in flow and you will be returned to your client automatically.

#### Watch The Video!

Our Co-Founder, Patrick Arlia recorded a video that shows you how to connect ChatGPT to Repliers. [Click here to view it on YouTube](https://youtu.be/qsKQWsjFDw4?si=FiM44M1Dq-28yUk7).

---

## Option B: Open Source / Self-Hosted MCP Server *(For Technical Users)*

If you prefer to run your own MCP server — for example, in a production environment or to customize the toolset — you can use the open source version. This option is recommended for developers comfortable with the command line.

### Prerequisites

* [Node.js v18 or higher](https://nodejs.org/) (v22+ recommended)
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
```

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

|| **Tip:** Always use the absolute path to `node` to ensure Claude Desktop uses Node v18+. You can check your version with `node --version`.

### Docker Deployment (Production)

For production use, Docker is recommended for reliability and isolation.

**1. Build the image**

```bash
docker build -t repliers-mcp .
```

**2. Add to Claude Desktop config**

```json
{
  "mcpServers": {
    "repliers-mcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--env-file=.env",
        "repliers-mcp"
      ]
    }
  }
}
```

Make sure your `.env` file contains your `REPLIERS_API_KEY`.

### Running with SSE Support

To run the server with Server-Sent Events (SSE) instead of STDIO:

```bash
node mcpServer.js --sse
```

---

## Available Tools

Once connected, your AI assistant can use the full suite of Repliers tools, organized by category:

### Listings
| Tool | Description |
| ---- |
| `search-listings` | Search active, sold, or leased listings with flexible filters (price, location, type, beds/baths, keywords, and more) |
| `get-listing` | Fetch detailed information for a specific listing by MLS number |
| `get-similar-listings` | Return listings similar to a given property by location, price, or type |
| `get-address-listing-history` | Retrieve full MLS listing history for a specific address |
| `get-parameter-enumerations` | Retrieve valid values for listing search parameters |
| `statistics` | Access market statistics and analytics |

### Locations & Buildings
| Tool | Description |
| ---- |
| `search-locations` | Search geographic locations supported by the Repliers API |
| `autocomplete-location-search` | Autocomplete location queries for search inputs |
| `search-buildings` | Search building-level data for condos, apartments, and complexes |
| `get-building` | Fetch detailed information about a specific building |

### Agents, Members & Brokerages
| Tool | Description |
| ---- |
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
| ---- |
| `search-clients` | Search for clients |
| `get-client` | Retrieve details for a specific client |
| `create-client` | Create a new client record |
| `update-client` | Update an existing client record |
| `delete-client` | Delete a client record |

### Saved Searches
| Tool | Description |
| ---- |
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
| ---- |
| `list-favorites` | List favorited listings |
| `remove-favorite` | Remove a listing from favorites |

### Estimates
| Tool | Description |
| ---- |
| `list-estimates` | List property estimates |
| `create-estimate` | Create a new property estimate |
| `update-estimate` | Update an existing estimate |
| `delete-estimate` | Delete an estimate |

### Messaging & NLP
| Tool | Description |
| ---- |
| `list-messages` | List messages |
| `get-message` | Retrieve a specific message |
| `send-message` | Send a message |
| `list-nlp-chat-sessions` | List NLP chat sessions |
| `list-nlp-search-history` | Retrieve NLP search history |

### Example Prompts

* *"Find 3-bedroom apartments in San Francisco under $1 million listed in the last week"*
* *"Send listing alerts to my client john doe when 4 bedroom homes in austin hit the market"*
* *"Give me the listing history for 123 Main St, San Francisco"*
* *"What's the median list price for residential homes in Austin, aggregated by month over the last 18 months?"*

---

## Troubleshooting

**The MCP server isn't showing as connected**
Make sure you've linked an API key in the Repliers Developer Portal (Step 1 above). Only one key can be active at a time.

**Claude Desktop falls back to an old Node version**
Use the absolute path to your Node binary (from `which node`) rather than just `node` in your config.

**I'm being asked to sign in on every connection**
Ensure you're completing the Repliers sign-in flow fully. If the issue persists, try unlinking and re-linking your API key in the Developer Portal.

**Tools aren't appearing in Claude**
Restart Claude Desktop after editing the config file. Confirm the server has a green status indicator under Settings → Developers.

---

## Additional Resources

* [Repliers Developer Portal](https://login.repliers.com/dashboard/apikeys)
* [Repliers MCP Server on GitHub](https://github.com/Repliers-io/mcp-server)
* [Repliers API Documentation](https://repliers.com/developer-agencies/)
* [Create a Repliers Account](https://auth.repliers.com/en/signup)