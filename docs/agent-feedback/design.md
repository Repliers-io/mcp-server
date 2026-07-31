# Agent Feedback & Search Reliability — Design

**Date:** 2026-07-31
**Status:** approved in discussion, pending written-spec review
**Scope:** Repliers MCP server (`mcp-server` repo) only. NLP engine improvements are explicitly out of scope (tracked separately, later).

## 1. Context & Problems

The Repliers MCP server exposes ~43 tools (NLP listings search, locations, CRM, estimates, messages…) to third-party agents (claude.ai connectors, IDE agents, custom clients). Field testing with live audiences surfaced three problems:

1. **Agents miss critical usage knowledge.** Tool descriptions total ~103,000 characters (~26K tokens) for 43 tools; several embed entire knowledge-base articles with frontend JS examples (`search-locations` — 16K chars, `autocomplete-location-search` — 9K). The signal (when to use, how to verify results) drowns in article dumps. Meanwhile the most important tool, `Search_Listings`, has a 2-line description that says nothing about the response shape or how to validate the parse.
2. **NLP search misparses queries.** The `/nlp` engine frequently drops or substitutes constraints (e.g. "townhouses under 500k in district X" → `style=semi-detached&district=X` with no price cap; "Miami" location silently dropped, returning the whole dataset). Fixing the NLP itself is out of scope here — but the MCP layer must expose the parse for verification and give agents a deterministic repair path.
3. **No feedback channel.** Neither agents nor end users can report bad results. We need a feedback intake (an MCP tool) that routes reports to our triage system (Trello for v1).

The hard part of problem 3: **making foreign agents actually use the feedback tool** — autonomously for technical failures, and as an offer to the user for subjective dissatisfaction. We do not control those agents' system prompts.

## 2. Goals

- Agents reliably detect the three failure types (see §4) and either self-repair or report.
- Feedback lands in Trello as structured, triage-ready cards; misparse reports carry machine-usable `missedConstraints` that will later feed NLP improvement work.
- Every mechanism works on any MCP client: we rely only on tool schemas, tool descriptions, server `instructions`, and tool *responses* — no client-specific features.
- Configurable "eagerness" of feedback prompting (env-tunable, default maximally proactive).

### Non-goals (v1)

- Fixing the NLP parser itself.
- Server-side silent telemetry (auto-filing cards without agent participation) — deferred to v2.
- Card deduplication, rate limiting, database persistence.
- Patching POST-body union queries (`queries`) in `refine-search` — flagged, not refined (see §6.4).

## 3. Solution Overview

Three delivery channels, ordered by reliability (least → most):

| Channel | When the agent reads it | Role |
|---|---|---|
| Rewritten tool descriptions | Once, when selecting a tool | Baseline knowledge: what/when/when-not |
| Server `instructions` (MCP initialize) | Session start | Global policy: verification protocol, remediation ladder, feedback rules |
| **Response-embedded nudges (`_feedback`)** | **At the exact moment of deciding the next step** | **Primary trigger — does not depend on the agent's memory or client's prompt handling** |

Plus two new custom tools (`send-feedback`, `refine-search`) and one response enrichment (`appliedFilters` in `Search_Listings`).

### 3.1 Failure taxonomy — "what counts as failure"

| Type | Example | Who can detect | Mechanism |
|---|---|---|---|
| **Objective / technical** | API error; 0 results; no geo filter applied at all; oversized response | **Server** | detectors → `_feedback.signals` |
| **Semantic misparse** | price cap dropped; "townhouse" → `semi-detached` substitution | **Agent only** — intent lives solely in the conversation | `appliedFilters` + mandatory verify protocol in the nudge |
| **Subjective dissatisfaction** | filters correct, user still unhappy | **User** | agent offers `send-feedback` |

The server cannot judge semantic misparse (it has no access to user intent) — but it can make the agent's judgement mechanical: pre-digest both sides of the comparison (`appliedFilters` vs. the user's request the agent already knows) and instruct the diff in the nudge.

### 3.2 Remediation ladder

Repair always precedes reporting — feedback is never *instead of* serving the user.

1. **Deterministic patch** — a basic constraint (price, type/style, location, beds/baths…) was dropped/substituted → `refine-search`.
2. **Re-prompt NLP** — a *semantic* constraint only NLP can express (e.g. "waterfront with a pool") was missed → repeat `Search_Listings` with the constraint restated emphatically. This is the legitimate place for a second NLP iteration.
3. **Report** — not fixable / not expressible → `send-feedback`.

NLP remains the **only** entry point for new searches: `refine-search` requires a `url` from a prior `Search_Listings` response and cannot build a query from scratch. This structurally prevents agents from degrading to the curated filter subset and bypassing NLP's expressiveness.

## 4. `Search_Listings` response enrichment: `appliedFilters`

**File:** `tools/repliers/repliers-api/custom/search-listings.js` (modify).

The `/nlp` response already contains `request.url` (e.g. `?minBeds=5`), `request.body`, `request.summary`, `nlpId`, and `listings`. Agents do not parse raw query strings — in testing they simply don't notice dropped filters. The tool will therefore parse `request.url` itself and prepend a human-readable summary **before** the listings blob (so it survives client-side truncation of huge responses):

```json
{
  "appliedFilters": {
    "location": null,
    "propertyType": null,
    "style": "Semi-Detached",
    "priceRange": null,
    "bedrooms": ">= 5",
    "other": { "status": "A" }
  },
  "complexQuery": false,
  "nlpId": "…",
  "request": { "url": "…", "summary": "…" },
  "listings": { … },
  "_feedback": { … }
}
```

- Filter families mapped to labels: `location` (city/area/neighborhood/district/zip/locationId/map/radius), `propertyType`, `style`, `class`, `type` (sale/lease), `priceRange` (minPrice/maxPrice), `bedrooms`, `bathrooms`, `sqft`, `status`, everything else → `other` (raw pass-through).
- Families with no parameter present are rendered as explicit `null` — an absent filter must be *visible*, not merely missing.
- `complexQuery: true` when `request.body` contains `queries` (POST union search). In that case `appliedFilters` summarises what it can and flags: *"complex multi-query search — refine-search is not applicable; use a refined NLP prompt instead"*.

## 5. Response nudges: the `_feedback` field

**Files:** new `lib/feedbackHints.js` (detectors + hint text), wired in `mcpServer.js` `setupServerHandlers` — a single interception point wrapping every tool result before serialization. Individual tools stay untouched (except `search-listings.js` per §4).

### 5.1 Detectors (server-side, data-only, no AI)

| Signal | Condition | Applies to |
|---|---|---|
| `api-error` | tool result contains `{ error }` | all tools |
| `zero-results` | `count === 0` / empty result array | search-type tools |
| `no-location-filter` | no geo param (`city`, `area`, `neighborhood`, `district`, `zip`, `locationId`, `map`, `lat`/`long`/`radius`) in the parsed URL **and** `locations: []` | `Search_Listings` |
| `oversized-result` | serialized result > 1 MB | all tools |

`no-location-filter` deliberately does **not** try to guess whether the user mentioned a place (that requires NLP); it states the objective fact "no geo filter was applied" and lets the agent — who knows the request — judge.

### 5.2 Hint format

Appended to the result object (underscore prefix = meta, no collision with API fields):

```json
"_feedback": {
  "signals": ["no-location-filter"],
  "note": "No location filter was applied to this search. Compare appliedFilters against the user's request, constraint by constraint (location, property type, price, beds…). If any constraint the user stated is missing or was substituted: (1) fix it via refine-search for basic filters, or re-run Search_Listings with the constraint restated for semantic ones; (2) after serving corrected results, report the parse gap via send-feedback (category nlp-misparse). If the user seems unsatisfied with the results, offer to send feedback on their behalf."
}
```

Notes are written per-signal + one generic verify-protocol note for `Search_Listings` / `refine-search` responses.

### 5.3 Eagerness — `FEEDBACK_PROMPT_LEVEL`

| Level | Behaviour |
|---|---|
| `off` | no `_feedback` blocks at all (tools stay registered) |
| `low` | `_feedback` only when a detector fires |
| `high` (**default**) | detectors + the generic verify/offer note on every search-tool response |

If the feedback sink is not configured (§7.4), nudges are suppressed regardless of level — never point agents at a tool that does not exist.

## 6. New tool: `refine-search`

**File:** `tools/repliers/repliers-api/custom/refine-search.js`.

Deterministic, surgical patch on top of the NLP's product. Takes the exact `request.url` from a prior `Search_Listings` response, applies named parameter changes, executes the patched query against `/listings`, returns results in the same shape as §4 (including `appliedFilters` and `_feedback`).

### 6.1 Semantics

- **Verbatim pass-through:** every parameter of the base URL that is not explicitly named in the call is preserved untouched — including exotic ones the agent doesn't understand (`waterfront`, `amenities`, `search` keywords…). Refine cannot simplify a query; it can only patch named params.
- **Patch params use `openapi.json` names** (verified against the spec: `minBedrooms`/`maxBedrooms`, not `minBeds`). The API accepts aliases in NLP-built URLs (`minBeds=5` was observed live); existing base-URL params are never rewritten to canonical names — left as-is.
- The curated schema doubles as a **server-side allowlist**: only schema-declared params are accepted; nothing arbitrary is interpolated into the URL (values are set via `URLSearchParams`).

### 6.2 Input schema (curated subset of `POST /listings`'s 130 params)

| Group | Params (openapi-verified names) |
|---|---|
| Price | `minPrice`, `maxPrice` |
| Type/style | `propertyType`, `style`, `class`, `type` (sale/lease) |
| Location | `city`, `area`, `neighborhood`, `district`, `zip`, `locationId` |
| Rooms | `minBedrooms`, `maxBedrooms`, `minBaths`, `maxBaths` |
| Size/age | `minSqft`, `maxSqft`, `minYearBuilt`, `maxYearBuilt` |
| Status | `status`, `lastStatus` |
| Frequent extras | `minParkingSpaces`, `minGarageSpaces`, `swimmingPool`, `waterfront` |
| Output control | `resultsPerPage`, `pageNum`, `sortBy`, `fields` |
| Removal | `remove: string[]` (enum of the same names) — filters the NLP applied that the user did not ask for |
| Base | `url: string` (**required**) — `request.url` from the `Search_Listings` response |

Param descriptions instruct: for `propertyType`/`style` values, verify the board vocabulary via `Lookup_Possible_Values` (`aggregates=details.propertyType,details.style`) first — boards use exact strings like `Att/Row/Twnhouse`, not colloquial "Townhouse".

### 6.3 Tool description (key content)

Use ONLY to correct a previous Search_Listings result whose `appliedFilters` did not match the user's stated constraints. Not a general search tool — new searches always go through `Search_Listings`. States the remediation ladder and the post-refine reporting rule.

### 6.4 Boundary: complex queries

If the base search had `complexQuery: true` (POST-body `queries` union), `refine-search` returns a structured refusal: `{ refinable: false, reason: "complex multi-query search", next: "re-prompt Search_Listings or send-feedback" }`. Patching union structures is v2, if feedback shows real demand.

### 6.5 Refine as implicit misparse evidence

Every `refine-search` call is objective evidence of an NLP gap ("agent added maxPrice ⇒ NLP dropped maxPrice"). v1: the `_feedback` note in the refine response instructs filing `send-feedback` with `missedConstraints`. v2: the server logs refine diffs as automatic telemetry with no agent participation.

## 7. New tool: `send-feedback`

**File:** `tools/repliers/repliers-api/custom/send-feedback.js`.

### 7.1 Input schema

| Param | Type | Req | Purpose |
|---|---|---|---|
| `category` | enum: `nlp-misparse` \| `empty-results` \| `wrong-results` \| `api-error` \| `user-dissatisfied` \| `other` | ✅ | triage bucket |
| `summary` | string | ✅ | short problem statement |
| `userQuery` | string | ✅ | the user's original natural-language request |
| `missedConstraints` | array of `{ constraint, requested, applied }` | — | structured parse gaps (the future NLP-improvement dataset); expected for `nlp-misparse` |
| `toolCalls` | array of `{ tool, params, resultSummary }` | — | what was called, what came back |
| `nlpId` | string | — | correlation with Repliers NLP logs |
| `expected` | string | — | what should have happened |

### 7.2 Consent policy (embedded in the description)

Technical failures (`api-error`, confirmed `nlp-misparse` after repair) — report directly, no need to ask the user; the report contains nothing beyond what was already sent to the API. Subjective reports (`wrong-results`, `user-dissatisfied`) — offer first, send after user consent. Always tell the user when a report was sent.

### 7.3 Trello delivery

Adapted from the proven `portal-backend` implementation (branch `feat/ai-chat-feedback`: `src/services/trello/trello.ts`, `src/services/feedback/card.ts`) — ported to plain ESM + native `fetch`, no DI:

- `POST https://api.trello.com/1/cards` with query params `key`, `token`, `idList`, `name`, `desc` — no request body; credentials never appear in the card.
- Card `name`: `[MCP] <category marker> <summary truncated to 80 chars>` — the `[MCP]` prefix separates this stream from AI-Chat portal feedback (target list decided at deploy time).
- Card `desc` (Markdown): category, summary, user query, `missedConstraints` table, `nlpId`, tool calls as fenced JSON, ISO timestamp. Hard cap 16,384 chars (Trello limit); summary sits first and always survives.
- The tool awaits the Trello call and returns `{ ok: true, cardUrl }` (Trello's `shortUrl`) or `{ ok: false, error }` — the agent always has something concrete to tell the user. No retry in v1.

### 7.4 Config gating

Env in mcp-server `.env`: `TRELLO_API_KEY`, `TRELLO_API_TOKEN`, `TRELLO_LIST_ID`. Enablement is derived: all three present → active. Any missing → **the module exports no tool** (discovery in `lib/tools.js` filters it out) and nudges are suppressed (§5.3). Rationale: a hidden tool beats a no-op — agents must never offer users feedback that goes nowhere. Caveat: `node index.js tools` (CLI listing) does not load `.env`, so the listing may omit the tool — acceptable; documented in the README section.

## 8. Feedback touchpoint map

| # | Moment | Trigger | Mode | Category |
|---|---|---|---|---|
| 1 | any tool response | `{ error }` from API | **auto** | `api-error` |
| 2 | `Search_Listings` response | agent-confirmed diff between `appliedFilters` and user's request | **auto, after repair** (see #3) | `nlp-misparse` |
| 3 | `refine-search` response | the refine call itself = confirmed misparse; nudge prompts the report with `missedConstraints` | **auto** | `nlp-misparse` |
| 4 | ladder step 2 | repeat NLP prompt still fails to express a constraint | **auto** | `nlp-misparse` |
| 5 | `zero-results` with a *correct* parse | possibly legitimate (nothing matches) — agent judges by context | **offered** | `empty-results` |
| 6 | any results | user unhappy though filters look right | **offered** ("want me to report this to the developers?") | `wrong-results` / `user-dissatisfied` |
| 7 | any moment | user explicitly asks to report | direct | any |
| 8 | `oversized-result` | huge payload | no feedback in v1 — narrowing hint only; server telemetry in v2 | — |

"Auto" means "the agent sends without asking the user, then informs them" — the executor is still a foreign agent we cannot force, only instruct through all three channels. Actual compliance is measured by the eval (§12).

## 9. Tool description rewrite

**Mechanism:** `codegen/overrides.json` (`description`, `parameterDescriptions` fields) + `node codegen/generate.js` regeneration for the 39 generated tools; direct edits for the 4 custom tools. Overrides survive regens — this is the sustainable path.

**Rules for every description:**

1. Structure: one-line purpose → when to use → when NOT to use (pointer to the right tool) → key params → response shape notes → pitfalls.
2. Budget: ≤ 800 chars for typical tools; ≤ 1,500 for the three central ones (`Search_Listings`, `refine-search`, `send-feedback`). Target total: ~103K chars → **≤ 25K**.
3. Embedded KB articles are deleted, not trimmed. (If recipes prove necessary later, they become MCP resources — out of scope v1.)
4. Every search-family description ends with one cross-link line: *"If results look wrong or incomplete — see `send-feedback`."*
5. `Lookup_Possible_Values` description is generalized: currently it mentions only statistics; it must cover the refine flow (verifying `propertyType`/`style` board vocabulary before patching).
6. `Search_Listings` description documents the response contract: `appliedFilters`, `nlpId`, `complexQuery`, the verify protocol, and the remediation ladder.

## 10. Server `instructions`

`mcpServer.js` currently passes no `instructions` to `new Server(...)`. Add the same ~1.5K-char English instruction block to **both** transports (stdio and Streamable HTTP session factory):

- Server purpose, tool taxonomy in one paragraph (search / locations / CRM / meta).
- The golden rules: always verify `appliedFilters` after `Search_Listings`; the remediation ladder; the feedback policy (auto vs. offered, consent).
- Note that `_feedback` blocks in responses are server guidance, to be followed.

Clients that surface `instructions` get the policy up front; clients that don't still get the response nudges — this channel is reinforcement, not the backbone.

## 11. Configuration summary

| Env var | Default | Effect |
|---|---|---|
| `REPLIERS_API_KEY` | — (existing) | API auth; also flips HTTP mode to self-hosted |
| `TRELLO_API_KEY` | unset | feedback sink credential |
| `TRELLO_API_TOKEN` | unset | feedback sink credential |
| `TRELLO_LIST_ID` | unset | target list; `[MCP]` card prefix keeps streams separable if shared |
| `FEEDBACK_PROMPT_LEVEL` | `high` | `off` \| `low` \| `high` — nudge eagerness (§5.3) |

All secrets live in `.env` (already gitignored); nothing is inlined in code or docs.

## 12. Verification — naive-agent eval

Clean-room workspace already prepared: `C:/Users/dark/Documents/repliers/mcp-eval` (`.mcp.json` with only `repliers-local` → `http://localhost:3001/mcp`; no CLAUDE.md, no memory). Protocol: cold session per scenario (an agent stops being naive after its first discovery), manual pass/fail.

| # | Scenario | Pass criteria |
|---|---|---|
| 1 | "find listings with 5+ bedrooms in Miami" (location will be dropped by NLP) | agent notices `no-location-filter`/null location in `appliedFilters`, tells the user, does NOT present the unfiltered dataset as Miami results, offers/sends feedback |
| 2 | "townhouses under 500k in <district>" (price/type misparse) | agent diffs `appliedFilters`, repairs via `refine-search` (with `Lookup_Possible_Values` for vocabulary), then reports `nlp-misparse` with `missedConstraints` |
| 3 | valid query, zero legitimate results | agent explains honestly; offers feedback without false "misparse" claims |
| 4 | normal successful query | agent does not spam feedback offers beyond the configured level |
| 5 | API error (broken key) | agent auto-reports `api-error`, informs the user |
| 6 | user says "these results are wrong" after a formally correct search | agent offers feedback, sends only after consent |

Description-quality check (problem 1): in a cold session, ask the naive agent "what can you do with this server?" — it should produce an accurate task-oriented summary from the rewritten descriptions alone.

## 13. Error handling & safety

- Trello call failure → `{ ok: false, error }`; no retry, no queue (v1). The agent apologises and continues serving the user.
- `refine-search` validates `url` starts with `https://api.repliers.io/listings` (allowlist host+path) — refuses anything else; only schema-declared params are patched.
- Detector/nudge code wraps in try/catch: a hint-computation bug must never break the tool response itself (hints degrade to absent).
- No PII is collected beyond what the conversation already sent to the API; consent policy per §7.2.
- Oversized-result guard (§5.1) doubles as self-protection for agents' context windows.

## 14. Out of scope / v2 candidates

- Server-side silent telemetry: auto-filing refine diffs, oversized events, error spikes (needs dedup + rate limiting).
- Card deduplication / one-card-per-session aggregation.
- Refining POST-body union queries.
- MCP resources with full API recipes (relocated KB articles).
- Alternative sinks (database, Repliers endpoint) — the Trello client is isolated in its own module so a sink swap is additive.

## 15. Implementation phases (detailed plan to follow via writing-plans)

1. **P1 — Feedback core:** Trello client + card builder + `send-feedback` tool + config gating. Testable immediately via mcp-eval.
2. **P2 — Parse visibility:** `appliedFilters` + `complexQuery` in `search-listings.js`.
3. **P3 — Nudges:** `lib/feedbackHints.js` detectors + `FEEDBACK_PROMPT_LEVEL` + wiring in `setupServerHandlers`.
4. **P4 — Repair:** `refine-search` tool.
5. **P5 — Knowledge:** overrides.json description rewrite (39 tools) + custom tool descriptions + server `instructions`.
6. **P6 — Eval:** run the §12 scenario suite on the naive agent, tune wording of notes/descriptions by results.

Each phase is independently shippable; P1 alone already delivers the user-visible feedback channel.
