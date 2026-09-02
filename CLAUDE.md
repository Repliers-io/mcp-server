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
| `lib/appliedFilters.js` | Parses the NLP-built listing URL into the human-readable `appliedFilters` summary, and flags params the API discards in `appliedFilters.unrecognized` (checked against the `/listings` parameter set in `openapi.json`, read lazily — `/nlp` reports `unrecognizedParams: []` even when `/listings` rejects the param) |
| `lib/feedbackHints.js` | Failure detectors (no-location-filter, zero-results, api-error…) + eagerness levels → `_feedback` block |
| `lib/feedbackCard.js`, `lib/trello.js` | Feedback card formatting + Trello REST delivery |
| `test/` | Unit tests (`node:test`), one file per lib/tool module |

## Environment

| Var | Role |
|---|---|
| `REPLIERS_API_KEY` | Required. Demo key dataset = Ontario, Canada (TRREB vocabulary: townhouse = `Att/Row/Twnhouse`; Miami absent) |
| `TRELLO_API_KEY`, `TRELLO_API_TOKEN`, `TRELLO_LIST_ID` | Feedback intake. **Gate**: without them `send-feedback` is absent from the roster and from instructions/nudges |
| `FEEDBACK_DRY_RUN` | `true` = feedback channel acts configured without Trello keys; cards are dumped to server stderr instead of posted (testing mode) |
| `FEEDBACK_DRY_RUN_LOG` | Path the dry-run cards are mirrored to; defaults to `feedback-cards.log` in the repo root (gitignored) |
| `FEEDBACK_PROMPT_LEVEL` | Nudge eagerness: `high` (default) / `low` / `off` |
| `FEEDBACK_CONSENT` | `auto` (default) = technical failures are reported without asking; `always-ask` = no report may be sent without the user's agreement, in every category. Rewrites golden rule 3, the send-feedback description, and every nudge note |
| `PORT`, `RESULTS_PER_PAGE` | HTTP port (3001), page size |
| `OAUTH_*`, `PROPELAUTH_API_KEY` | Hosted-deployment auth only; irrelevant locally |

Restart the server after every `.env` change.

## Current focus — agent-feedback feature

Branch `feat/agent-feedback`: verify/repair/report protocol for foreign agents. Implementation complete, unit suite green; **end-to-end testing not started**. See [docs/agent-feedback/status.md](docs/agent-feedback/status.md) for the exact resume point, [design.md](docs/agent-feedback/design.md) for the full design, [test-plan.md](docs/agent-feedback/test-plan.md) for the pending test procedure.

## Conventions

- English for all code, comments, commit messages, and docs.
- Tool description text is a delivery channel, not documentation — task-oriented summaries (what/when/when-not), never article dumps. See design.md §3.
- `send-feedback` and every mention of it must stay gated on Trello env keys — never let a nudge or instruction promise feedback when the tool is absent.
- `refine-search` never builds a query from scratch (requires a prior `Search_Listings` url) — NLP stays the only entry point for new searches. Do not weaken this.
- The user runs `git commit` themselves — prepare per-file `git add` commands and a message, never commit.
