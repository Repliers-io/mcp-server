# Repliers MCP Server

An MCP (Model Context Protocol) server that gives AI assistants like Claude access to real-time MLS data via the [Repliers API](https://repliers.com/developer-agencies/).

Use natural language to search listings, pull market statistics, and look up properties:

- "Find me 3 bedroom condos in Toronto under $800k listed in the last week"
- "What's the average sold price for detached homes in Boston grouped by month over the last year?"
- "Get me the details for MLS number X12345678"

## Tools

| Tool | Description |
|---|---|
| `Search_Listings` | Natural language listing search powered by Repliers NLP |
| `get_listing` | Fetch a single listing by MLS number |
| `Market_Statistics` | Market stats — averages, medians, days on market, grouped by time or geography |
| `Lookup_Possible_Values` | Enumerate valid filter values (property types, neighborhoods, etc.) before running a statistics query |

## Prerequisites

- [Node.js v22+](https://nodejs.org/)

```sh
npm install
```

## Running the Server

The server supports two modes depending on how you're deploying it.

### Stdio (local use with Claude Desktop)

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

### SSE (remote/hosted use)

```sh
node mcpServer.js --sse
```

Starts an HTTP server on the port defined in `.env` (default: `3001`). Connect any MCP client to:

```
https://yourdomain.com/sse
```

## Authentication

The server has two modes depending on whether `REPLIERS_API_KEY` is set in your `.env`.

### Self-hosted mode

Set `REPLIERS_API_KEY` in your `.env`. No OAuth required — the key is used directly for all requests.

```
REPLIERS_API_KEY=your-repliers-api-key
```

### Hosted mode (PropelAuth)

Omit `REPLIERS_API_KEY`. The server uses PropelAuth OAuth to authenticate users and reads each user's Repliers API key from their PropelAuth user metadata (`repliers_api_key`).

Set the following in your `.env`:

```
OAUTH_BASE_URL=https://your-propelauth-domain.propelauthtest.com
OAUTH_AUTHORIZATION_ENDPOINT=https://your-propelauth-domain.propelauthtest.com/propelauth/oauth/authorize
OAUTH_TOKEN_ENDPOINT=https://your-propelauth-domain.propelauthtest.com/propelauth/oauth/token
OAUTH_USERINFO_ENDPOINT=https://your-propelauth-domain.propelauthtest.com/propelauth/oauth/userinfo
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
PROPELAUTH_API_KEY=your-propelauth-backend-api-key
```

In PropelAuth, set each user's metadata to:

```json
{
  "repliers_api_key": "their-repliers-api-key"
}
```

## Docker

```sh
docker build -t repliers-mcp .
```

The Dockerfile uses `node mcpServer.js` as the entrypoint. Pass environment variables via `--env-file .env` or your container orchestration config.
