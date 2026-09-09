# Repliers MCP Server — Agent Instructions

MCP server exposing the Repliers MLS API to AI agents (claude.ai connectors, IDE agents, custom clients). Node.js 22+, ESM, `@modelcontextprotocol/sdk`. Two transports in one entry point: stdio (default) and Streamable HTTP.

## Commands

```sh
node mcpServer.js            # stdio transport
node mcpServer.js --http     # Streamable HTTP on PORT (default 3001), endpoint /mcp
npm test                     # node --test test/**/*.test.js
npm run list-tools           # print the tool roster (index.js CLI)
npm run generate             # regenerate tools/…/generated/ from openapi.json
```

## Architecture

| Path | Role |
|---|---|
| `mcpServer.js` | Server entry: both transports, session handling, attaches `_feedback` nudges to every tool response via `lib/feedbackHints.js`, serves `instructions` from `lib/serverInstructions.js` |
| `lib/tools.js` | `discoverTools()` — loads every `.js` from `tools/repliers/repliers-api/{generated,custom}/` exporting `apiTool` |
| `tools/repliers/repliers-api/generated/` | 39 tools generated from `openapi.json` (`npm run generate`) — CRM, estimates, locations, saved searches… Do not edit by hand |
| `tools/repliers/repliers-api/custom/` | 6 hand-written tools: `search-listings` (NLP search + `appliedFilters` enrichment), `refine-search`, `send-feedback`, `statistics`, `get-parameter-enumerations`, `get-listing-image` |
| `lib/apiBase.js` | `apiBaseUrl()` / `apiOrigin()` — the only place the API host is written. Generated tools import it (the codegen template emits the call, so regeneration preserves it); never hardcode the host anywhere else |
| `lib/appliedFilters.js` | Parses the NLP-built listing URL into the human-readable `appliedFilters` summary, and flags params the API discards in `appliedFilters.unrecognized` (checked against the `/listings` parameter set in `openapi.json`, read lazily — `/nlp` reports `unrecognizedParams: []` even when `/listings` rejects the param) |
| `lib/feedbackHints.js` | Failure detectors (no-location-filter, zero-results, api-error…) + eagerness levels → `_feedback` block |
| `lib/feedbackCard.js`, `lib/trello.js` | Feedback card formatting + Trello REST delivery |
| `test/` | Unit tests (`node:test`), one file per lib/tool module |

## Environment

| Var | Role |
|---|---|
| `REPLIERS_API_KEY` | Required. Demo key dataset = Ontario, Canada (TRREB vocabulary: townhouse = `Att/Row/Twnhouse`; Miami absent) |
| `REPLIERS_API_BASE_URL` | API host for **every** tool, generated and custom (default `https://api.repliers.io`). Points the whole roster at a staging deployment; `refine-search`'s host check follows it, so a production URL is foreign there |
| `TRELLO_API_KEY`, `TRELLO_API_TOKEN`, `TRELLO_LIST_ID` | Feedback intake. **Gate**: without them `send-feedback` is absent from the roster and from instructions/nudges. Obtaining them / switching account or board: [docs/agent-feedback/trello-setup.md](docs/agent-feedback/trello-setup.md) |
| `FEEDBACK_DRY_RUN` | `true` = feedback channel acts configured without Trello keys; cards are dumped to server stderr instead of posted (testing mode) |
| `FEEDBACK_DRY_RUN_LOG` | Path the dry-run cards are mirrored to; defaults to `feedback-cards.log` in the repo root (gitignored) |
| `FEEDBACK_PROMPT_LEVEL` | Nudge eagerness: `high` (default) / `low` / `off` |
| `FEEDBACK_CONSENT` | `auto` (default) = technical failures are reported without asking; `always-ask` = no report may be sent without the user's agreement, in every category. Rewrites golden rule 3, the send-feedback description, and every nudge note |
| `PORT`, `RESULTS_PER_PAGE` | HTTP port (3001), page size |
| `MCP_PUBLIC_URL` | Hosted only. This server's canonical URI, e.g. `https://mcp.repliers.io`. Access tokens are accepted only if their audience names it, so it must come from configuration and never from request headers. **Startup fails without it** |
| `OAUTH_BASE_URL` | Hosted only. PropelAuth auth URL, e.g. `https://auth.repliers.com`. **Startup fails without it** |
| `PROPELAUTH_MCP_INTROSPECT_CLIENT_ID`, `…_SECRET` | Hosted only. Created in PropelAuth's MCP → Request Validation section; used to introspect access tokens. **Startup fails without them** |
| `PROPELAUTH_API_KEY` | Hosted only. Reads `repliers_api_key` from PropelAuth user metadata via the backend user API |
| `OAUTH_MCP_ISSUER` | Hosted only. The authorization server named in protected-resource metadata (default `${OAUTH_BASE_URL}/oauth/2.1`) |
| `OAUTH_INTROSPECTION_ENDPOINT` | Hosted only. Default `${OAUTH_BASE_URL}/oauth/2.1/introspect` |
| `OAUTH_REQUIRE_AUDIENCE` | Escape hatch, default `true`. `false` accepts tokens whose audience does not name this server — read [docs/oauth21/design.md](docs/oauth21/design.md) Q7 before using it |
| `OAUTH_INTROSPECTION_CACHE_TTL_MS` | Default `60000`. Caps how long an introspection verdict is reused; never past the token's own `exp`. The Repliers key is resolved per request regardless |

Restart the server after every `.env` change.

## Current focus — agent-feedback feature

Branch `feat/agent-feedback`: verify/repair/report protocol for foreign agents. Implementation complete, unit suite green; **end-to-end testing not started**. See [docs/agent-feedback/status.md](docs/agent-feedback/status.md) for the exact resume point, [design.md](docs/agent-feedback/design.md) for the full design, [test-plan.md](docs/agent-feedback/test-plan.md) for the pending test procedure.

## Conventions

- English for all code, comments, commit messages, and docs.
- Tool description text is a delivery channel, not documentation — task-oriented summaries (what/when/when-not), never article dumps. See design.md §3.
- `send-feedback` and every mention of it must stay gated on Trello env keys — never let a nudge or instruction promise feedback when the tool is absent.
- `refine-search` never builds a query from scratch (requires a prior `Search_Listings` url) — NLP stays the only entry point for new searches. Do not weaken this.
- The user runs `git commit` themselves — prepare per-file `git add` commands and a message, never commit.
