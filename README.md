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
https://mcp.repliers.io/sse
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
node mcpServer.js --sse
```

**3. Connect your MCP client to:**

```
http://localhost:3001/sse
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

## Docker

```sh
docker build -t repliers-mcp .
docker run --env-file .env -p 3001:3001 repliers-mcp --sse
```
