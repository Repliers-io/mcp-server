# Repliers MCP Server — Agent Instructions

MCP server exposing the Repliers MLS API to AI agents (claude.ai connectors, IDE agents, custom clients). ESM, `@modelcontextprotocol/sdk`. One entry point, two transports: stdio (default) and Streamable HTTP (`node mcpServer.js --http`, endpoint `/mcp` on `PORT`, default 3001). Node version is pinned in `.nvmrc` and `package.json#engines`; `.npmrc` sets `engine-strict`, `ignore-scripts`, `save-exact` and `min-release-age=7`, so lifecycle scripts never run on install and new dependencies get exact versions.

Scripts are in `package.json`. `npm test` is fully offline — `fetch` is mocked and `test/helpers/` runs a fake authorization server and a hosted-mode server in-process — so a red suite is never "the API is down".

## Where work is tracked

Each feature has `docs/<feature>/{design,plan,status,test-plan}.md`. **`status.md` is the resume point — read the newest one before starting anything.** Currently: [docs/oauth21/status.md](docs/oauth21/status.md) (OAuth 2.1 resource server; blocked on the PropelAuth dashboard) and [docs/agent-feedback/status.md](docs/agent-feedback/status.md) (shipped; open items listed there). Upstream API defects found by the eval battery: [docs/repliers-defects-2026-08-29.md](docs/repliers-defects-2026-08-29.md).

Known gap in this server: `Search_Listings` sets no `resultsPerPage`/`fields` on the `/nlp` call and returns the payload verbatim; responses of several MB have exceeded MCP clients' tool-result limits. The 1 MB check in `lib/feedbackHints.js` only appends a nudge, it does not truncate.

## Architecture — the non-obvious parts

| Path | What you need to know |
| --- | --- |
| `mcpServer.js` | Both transports, session ownership, bearer-auth + Repliers-key gates on the HTTP path, `_feedback` nudges attached to every tool response, `instructions` from `lib/serverInstructions.js` |
| `tools/repliers/repliers-api/generated/` | Generated from `openapi.json` by `npm run generate` (`codegen/`, overrides in `codegen/overrides.json`). **Never edit by hand** |
| `tools/repliers/repliers-api/custom/` | Hand-written: `search-listings` (NLP entry point + `appliedFilters` enrichment), `refine-search`, `send-feedback`, `statistics`, `get-parameter-enumerations`, `get-listing-image` |
| `lib/apiBase.js` | The only place the API host is written. The codegen template emits the call, so regeneration preserves it — never hardcode the host anywhere else |
| `lib/appliedFilters.js` | Flags params the API discards in `appliedFilters.unrecognized`, checked against `/listings` in `openapi.json` — because `/nlp` reports `unrecognizedParams: []` even when `/listings` rejects the param |
| `lib/feedbackHints.js` | Failure detectors → `_feedback` block. `_feedback` is serialized **first** in the payload on purpose: head-first readers on small models never saw it after the listings blob |
| `lib/protectedResource.js`, `lib/oauthVerifier.js`, `lib/repliersKey.js` | Hosted-mode auth: RFC 9728 metadata + audience binding, RFC 7662 introspection with a bounded verdict cache, per-user Repliers key from PropelAuth user metadata. Design and open questions: [docs/oauth21/design.md](docs/oauth21/design.md) |
| `scripts/probe-propelauth.mjs` | Answers design.md §5 Q1–Q8 against a live PropelAuth tenant. Run it before touching anything OAuth-related on a hosted deployment |
| `.claude/agents/code-reviewer.md` | Project reviewer agent; use it after changing tools, lib, transport/session or OAuth code |

## Deployment

- **Hosted = Heroku**, buildpack deploy: `Procfile` (`web: node mcpServer.js --http`) is what runs. The `Dockerfile` mirrors it for self-hosters and is not used by Heroku.
- **PropelAuth environments (Test / Staging / Prod) are separate projects with separate auth hosts.** `OAUTH_BASE_URL` must name the environment the OAuth client and introspection credentials were created in; `auth.repliers.com` is the production custom domain. A mismatch fails at token validation, not at startup.
- Per-user Repliers API keys live in PropelAuth user metadata (`repliers_api_key`) and are read through the backend user API with `PROPELAUTH_API_KEY` — "works locally, 401s hosted" usually means that field is missing for the user.

## Environment

| Var | Role |
| --- | --- |
| `REPLIERS_API_KEY` | Required. Demo key dataset = Ontario, Canada (TRREB vocabulary: townhouse = `Att/Row/Twnhouse`; Miami absent) |
| `REPLIERS_API_BASE_URL` | API host for **every** tool, generated and custom (default `https://api.repliers.io`). Points the whole roster at a staging deployment; `refine-search`'s host check follows it, so a production URL is foreign there |
| `TRELLO_API_KEY`, `TRELLO_API_TOKEN`, `TRELLO_LIST_ID` | Feedback intake. **Gate**: without them `send-feedback` is absent from the roster and from instructions/nudges. Obtaining them / switching account or board: [docs/agent-feedback/trello-setup.md](docs/agent-feedback/trello-setup.md) |
| `FEEDBACK_DRY_RUN` | `true` = feedback channel acts configured without Trello keys; cards are dumped to server stderr instead of posted (testing mode) |
| `FEEDBACK_DRY_RUN_LOG` | Path the dry-run cards are mirrored to; defaults to `feedback-cards.log` in the repo root (gitignored) |
| `FEEDBACK_PROMPT_LEVEL` | Nudge eagerness: `high` (default) / `low` / `off` |
| `FEEDBACK_CONSENT` | `auto` (default) = technical failures are reported without asking; `always-ask` = no report may be sent without the user's agreement, in every category. Rewrites golden rule 3, the send-feedback description, and every nudge note |
| `PORT`, `RESULTS_PER_PAGE` | HTTP port (3001), page size |
| `MCP_PUBLIC_URL` | Hosted only. This server's canonical URI, e.g. `https://mcp.repliers.io`. Access tokens are accepted only if their audience names it, so it must come from configuration and never from request headers. **Startup fails without it** |
| `OAUTH_BASE_URL` | Hosted only. PropelAuth auth URL of the matching environment (see Deployment). **Startup fails without it** |
| `PROPELAUTH_MCP_INTROSPECT_CLIENT_ID`, `…_SECRET` | Hosted only. Created in PropelAuth's MCP → Request Validation section; used to introspect access tokens. **Startup fails without them** |
| `PROPELAUTH_API_KEY` | Hosted only. Reads `repliers_api_key` from PropelAuth user metadata via the backend user API |
| `OAUTH_MCP_ISSUER` | Hosted only. The authorization server named in protected-resource metadata (default `${OAUTH_BASE_URL}/oauth/2.1`) |
| `OAUTH_INTROSPECTION_ENDPOINT` | Hosted only. Default `${OAUTH_BASE_URL}/oauth/2.1/introspect` |
| `OAUTH_REQUIRE_AUDIENCE` | Escape hatch, default `true`. `false` accepts tokens whose audience does not name this server — read [docs/oauth21/design.md](docs/oauth21/design.md) Q7 before using it |
| `OAUTH_INTROSPECTION_CACHE_TTL_MS` | Default `60000`. Caps how long an introspection verdict is reused; never past the token's own `exp`. The Repliers key is resolved per request regardless |

Restart the server after every `.env` change.

## Conventions

- English for all code, comments, commit messages, and docs.
- Tool description text is a delivery channel, not documentation — task-oriented summaries (what/when/when-not), never article dumps. See [docs/agent-feedback/design.md](docs/agent-feedback/design.md) §3.
- `send-feedback` and every mention of it must stay gated on Trello env keys — never let a nudge or instruction promise feedback when the tool is absent.
- `refine-search` never builds a query from scratch (requires a prior `Search_Listings` url) — NLP stays the only entry point for new searches. Do not weaken this.
- When a feature's behaviour changes, update its `docs/<feature>/status.md` in the same change — it is the only place the resume point lives.
- The user runs `git commit` themselves — prepare per-file `git add` commands and a message, never commit.
