# Feedback v2 — Server-side Capture, Actionable Errors, Neutral Tool Text

**Date:** 2026-10-14
**Status:** design agreed section by section in chat (2026-10-12 – 2026-10-14); written spec awaiting owner review.
**Trello:** [nLD4VjI9 — ChatGPT 5.6 Medium doesn't follow feedback prompt](https://trello.com/c/nLD4VjI9),
[7EBCpT7L — report from Customer, fresh ChatGPT](https://trello.com/c/7EBCpT7L). Folds in
[HAZH3Bng](https://trello.com/c/HAZH3Bng), [XN2CebHn](https://trello.com/c/XN2CebHn),
[ivpX9K36](https://trello.com/c/ivpX9K36) and [fGkfFd1U — User-Agent](https://trello.com/c/fGkfFd1U).
**Prerequisite:** the OpenAPI sync in §9 ships first.
**Builds on:** [../agent-feedback/design.md](../agent-feedback/design.md) (v1: `_feedback` nudges,
`refine-search`, `send-feedback`).

---

## 1. Summary

v1 made reporting a model behaviour: the server detects a problem, tells the model in increasingly
emphatic words to call `send-feedback`, and hopes. Two field reports show both ends of that design
failing on ChatGPT:

- the model repairs every problem and never reports one (card nLD4VjI9), and
- when it does try, ChatGPT's safety layer blocks the call, because the very wording we hardened to
  force compliance reads to it as a tool steering its own approval (card 7EBCpT7L).

v2 stops depending on the model for anything the server can see itself. The server records the
failures it observes, classifies every API error by **who can fix it**, and hands the model
ready-made text instead of instructions. `send-feedback` shrinks to what only the conversation
reveals.

Three parts, one shared module (`lib/apiErrors.js`):

1. **Error classification** (§5) — account problems go to the user with a way to fix them, request
   problems go to the agent with a way to fix them, "not found" stops being an error, and only
   Repliers-side defects are recorded.
2. **Server-side capture** (§6) — refine corrections, discarded parameters, restated searches and
   upstream errors become Trello cards without a model call, deduplicated.
3. **Neutral tool text** (§7) — descriptions say what a tool does, in the third person; workflow
   stays in `instructions`; every `send-feedback` mention is gated; a test enforces both.

---

## 2. Problems, with evidence

### 2.1 Card nLD4VjI9 — the model does not report (2026-09-10, ChatGPT, GPT-5.6 Medium)

One long session ("Count Newmarket Listings") hit five problems: a dropped `L3Y` postal prefix,
"Roeder Court" parsed as a street suffix, a failed address-history lookup, an omitted active-status
filter, and a `/nlp` rejection of the word "count". The model repaired each and offered no report.
Asked why, it answered: *"I treated the feedback instructions as secondary. They weren't."* The five
cards (T95POMCU, lj9USTeh, KSbZrtAZ, JlKjD2FW, XN2CebHn) landed at 21:18 that day — after the user
pushed. One of them, KSbZrtAZ, was itself wrong: a 404 from `/listings/history` means "no history
for this address", which the team closed as not an error.

Two of the five repairs (L3Y, Roeder) were done by **restating the prompt**, which the server cannot
observe today.

### 2.2 Card 7EBCpT7L — a customer's first ChatGPT session

| | What happened | Root cause in this server |
|---|---|---|
| A | `Search_Listings` → "Your account does not have access to this feature" | The account's plan lacks NLP. Nothing tells the agent that new searches are impossible, or the user how to get access |
| B | `get-listing` / `get-similar-listings` for N13549286 → "boardId is required" | Multi-board account. The agent cannot tell which board holds the listing |
| C | The user said "send error log to repliers"; ChatGPT blocked `send-feedback` with **"Suspicious Instruction: Tool description prescribes consent and reporting behavior for this classifier"**, later "This tool call was blocked by OpenAI's safety checks" | The `always-ask` description of `send-feedback` begins `CONSENT REQUIRED … call this tool only after the user says yes` |

Moreover, the agent only wanted to send that report because **our own** `api-error` nudge told it to
report every failed call — including an entitlement problem that no Repliers engineer can fix.

The same card pattern has been reported against other MCP servers on ChatGPT: approval-steering
phrases in write-tool descriptions ("only after the person says yes", "call again with confirm
true") trigger the card, and rewriting descriptions as neutral third-person statements with the
workflow moved into server instructions or skills made it disappear
([the-vault#221](https://github.com/colombod-personal/the-vault/issues/221)). Imperative
"PRIMARY TOOL" / "CRITICAL RULE" wording triggers the same confirmable dialog
([DesktopCommanderMCP#682](https://github.com/wonderwhy-er/DesktopCommanderMCP/issues/682)); a
separate non-confirmable hard block exists with no established cause
([DesktopCommanderMCP#712](https://github.com/wonderwhy-er/DesktopCommanderMCP/issues/712)). OpenAI
has not documented either; this is field evidence, not a specification.

### 2.3 The two cards pull in opposite directions

Card 1 asks for stronger compliance; card 2 shows that the words we used to get it (`MUST`,
`REQUIRED step`, `no need to ask the user first`, `report directly without asking`) are what
ChatGPT's safety layer flags. Hardening the wording further is therefore ruled out. The fix has to
remove the dependency on the model, not argue harder with it.

---

## 3. Measured baseline (2026-10-12)

Current code, Codex CLI 0.153.0, `gpt-5.6-sol` at medium effort, `controlled` profile — the same
harness as runs 6–9 in [../agent-feedback/query-battery-results.md](../agent-feedback/query-battery-results.md).
Raw runs: `mcp-eval/runs/2026-10-12-gpt-5.6-sol-medium-controlled{,-part2,-always-ask}`.

**`FEEDBACK_CONSENT=auto`, full core battery (15 queries):**

| Metric | Value |
|---|---|
| `refine-search` repairs | 16 |
| repairs followed by a report | 14 (the two misses: S4-low, i.e. `FEEDBACK_PROMPT_LEVEL=low`) |
| distinct defects among the 14 nlp-misparse cards | 7 — M1 alone filed three "omitted sale type" cards |
| false api-error cards | 2 — an image that would not render (M4), and the user's own invalid key (S5) |
| internal detail leaked to the user | S5: "the connector recorded it in dry-run mode" |

**`FEEDBACK_CONSENT=always-ask`, subset B1 L1 W3 M1–M4 S5:**

| Metric | Value |
|---|---|
| `refine-search` repairs | 11 |
| repaired queries where the model asked to report | 5 of 5 (B1, L1, W3, M1, M3) |
| cards that reached Trello | **0** — every report waits for a "yes" a real user may never give |
| S5, invalid key | "Would you like me to report this connection error?" — offers to report the user's own key, gives no way to fix it |

**Card 1 did not reproduce on this harness in either mode.** Cold single-query sessions report or
ask after every repair. The field failure differed in three ways at once — the real ChatGPT surface,
a long multi-task session, and the instruction text before the 2026-09-17 reshape — and this harness
cannot say which mattered. v2 does not need the answer: it removes the step the model skipped.

**Server-level probe, random API key** (stdio, no model): every failed call returns
`isError=false`; the payload carries `_feedback: "Report this via send-feedback (category api-error)
— no need to ask the user first"`; `Search_Listings` additionally appends the verify nudge ("compare
appliedFilters…") to a response that has no `appliedFilters`; the cause is buried as an escaped
string, `"[{\"msg\":\"Invalid API key\"}]"`.

**Live API error shapes** (demo key, 2026-10-12):

| Case | Status | Body |
|---|---|---|
| invalid key | 401 | `[{"msg":"Invalid API key"}]` |
| validation | 400 | `[{"param":"resultsPerPage","msg":"must be a number"}]` |
| unknown listing / no history | 404 | empty |
| `/nlp` non-listing intent | 406 | `{"request":{"error":"Currently this NLP endpoint is designed to search listings only. "}}` |
| board of an MLS number | 200 | `/listings?mlsNumber=N13549286&listings=false&aggregates=boardId` → `{"aggregates":{"boardId":{"2":1}}}` |

Not observable with the demo key: the entitlement error of card 7EBCpT7L (status and body unknown,
text known from the screenshot) and the OpenAI-key 401 of HAZH3Bng (body unknown).

---

## 4. Decisions (owner, 2026-10-12 – 2026-10-14)

1. The server records the failures it observes **in every consent mode**.
2. Account and access errors are **told to the user**, never recorded. The user-facing text points to
   the Repliers dashboard with a general phrase; no support channel is named.
3. Capture runs in one central post-call hook (approach A), not inside each tool and not as an
   out-of-process log pipeline.
4. Recorded signals: refine constraint patches, `appliedFilters.unrecognized`, upstream errors,
   searches restated with `repairsNlpId`.
5. `boardId` for multi-board accounts is resolved by the server, not by the agent.
6. Tool descriptions become neutral; `FEEDBACK_CONSENT` is retired.
7. Verification compares against the §3 baseline on the same model and harness, plus a manual
   ChatGPT check that no local harness can replace.
8. OpenAPI sync is a separate task that ships before capture (§9); new upstream endpoints are not
   added in it.

---

## 5. Error classification — `lib/apiErrors.js`

### 5.1 Contract

Every tool returns failures as `{ url, error, status, body }`: `status` is the HTTP status or `null`
for a network failure, `body` the parsed response body (or raw text, or `null` when empty). Today the
status is lost — `codegen/generate.js` throws `new Error(JSON.stringify(err))` and the custom tools do
the same. The codegen template changes once and `npm run generate` carries it to every generated
tool; the five custom tools are edited by hand.

`classifyError({ toolName, url, status, body })` returns
`{ kind, reason, forUser?, forAgent, retry, capture }`. The central `CallTool` handler calls it
before `augmentResult`.

### 5.2 Kinds — split by who can fix the problem

| Kind | Who fixes it | Detection, in order | `isError` | Recorded |
|---|---|---|---|---|
| `upstream` | Repliers team | `status === null` (network); 5xx | yes | **yes** |
| `account` | the user's account admin | 401 (see §5.3 for which key); 403; body matches `/does not have access/i` | yes | no |
| `not-found` | nobody — it is an answer | 404 | **no** | no |
| `request` | the agent | body matches `/boardId.*required/i` (→ §5.4); 400/422; other 4xx outside `/nlp` | yes | no |
| `nlp-scope` | the agent now, the NLP team later | `/nlp` 406 | yes | **yes** |
| `upstream` | Repliers team | any other 4xx from `/nlp` | yes | **yes** |

`nlp-scope` exists because the 406 has two causes: a genuine non-listing request ("count all…",
XN2CebHn) and a misclassified listing request ("Sold detached homes in Newmarket", ivpX9K36). The
agent gets a rephrasing hint either way, and the prompt is recorded so the NLP team sees both kinds.

Detection is by status first and text second. API messages are not a contract, so every text pattern
is pinned by an offline test built on the real bodies in §3.

### 5.3 User-facing text

Written in the third person, as a finished sentence the model can relay, never as an instruction to
the model. Dashboard links only (decision 2).

| Reason | `forUser` |
|---|---|
| Repliers key rejected (401, body `Invalid API key`) | "The Repliers API key used by this connection was rejected. The account administrator can review API keys in the Repliers dashboard: https://login.repliers.com/dashboard/apikeys" |
| OpenAI key rejected (`/nlp` 401 whose body names OpenAI or `invalid_api_key`, HAZH3Bng) | "Natural-language search could not run because the OpenAI API key configured for this Repliers account was rejected. The account administrator can update it in the Repliers dashboard: https://login.repliers.com/dashboard" |
| feature not in plan (403 / "does not have access") | "This Repliers account does not include {feature}. The account administrator can request access from Repliers; account settings are in the Repliers dashboard: https://login.repliers.com/dashboard" |

`{feature}` comes from the tool: `Search_Listings` and `refine-search` → "natural-language listing
search"; any other tool → "this API feature (`<path>`)".

`forAgent` states consequences, not commands. For NLP access: "Search_Listings and refine-search
cannot run with this API key. Lookups by MLS number, locations and statistics may still work." For
`request`: the API's own `param: msg` pairs. For `nlp-scope`: "The NLP endpoint interprets listing
searches only. A listing search returns a count; Market_Statistics returns aggregate figures." For
`upstream`: "A Repliers service error occurred and was recorded for the Repliers team."

### 5.4 `boardId` resolution

When `get-listing` or `get-similar-listings` fail with `boardId is required` and the call carried an
`mlsNumber` but no `boardId`, the handler queries
`/listings?mlsNumber=<n>&listings=false&aggregates=boardId`:

- one board → the tool is re-invoked with that `boardId`; the response gains
  `boardIdResolved: <id>` so the agent knows what was assumed;
- several boards → `_notice` of kind `request` listing the candidates, with the hint that the same
  MLS number exists on more than one MLS and the user can say which;
- none → `not-found`.

The lookup uses the caller's own key, so it can only ever see boards that key already sees.

### 5.5 Response shape

The block leads the payload, for the same reason `_feedback` does: clients truncate head-first.

```json
{
  "_notice": {
    "kind": "account",
    "forUser": "This Repliers account does not include natural-language listing search. …",
    "forAgent": "Search_Listings and refine-search cannot run with this API key. …",
    "retry": false
  },
  "error": { "status": 403, "message": "Your account does not have access to this feature" }
}
```

`not-found` returns `{ "found": false, "reason": "No record matches these parameters." }` with no
`_notice` and `isError` unset. The `api-error` nudge in `lib/feedbackHints.js` is removed: errors
carry `_notice` only, and the generic verify nudge is no longer attached to an error response.

### 5.6 Missing required parameters

`mcpServer.js` checks `required` before calling a tool and throws `McpError(InvalidParams)`: a
JSON-RPC error, not a tool result, so the model never sees it the way it sees `_notice`. MCP
2025-11-25 recommends tool-execution errors for input validation precisely so the model can correct
itself. The check also throws a `TypeError` when a client omits `arguments` (`requiredParameter in
undefined`). The 2026-10-08 spec made three parameters newly required (`create-estimate` `address`
and `details`, `send-message` `content`), and clients holding cached schemas will hit this path. v2
returns it as a `request` result — `isError: true`, the missing names in `forAgent` — and treats an
absent `arguments` as `{}`. (Found by the review of the §9 sync.)

---

## 6. Server-side capture — `lib/autoReport.js`

### 6.1 Placement

One function, `captureFromResult({ toolName, args, result, classification, session })`, called from
the `CallTool` handler next to `augmentResult`. Tools stay unaware of it. `session` is a small object
created in `setupServerHandlers`, which already runs once per HTTP session (`new Server` per
initialize) and once for stdio. It holds `searches: Map<request.url | nlpId, { nlpId, prompt, url,
appliedFilters }>`, filled by every successful `Search_Listings` response.

### 6.2 Signals

> **Owner decision 2026-10-15.** Automatic refine-search capture would flood the board, so capture is
> narrowed to deterministic defects. The refine-correction and restated-search signals, the
> `repairsNlpId` parameter and the session search memory are removed. A parse correction is instead
> offered to the user (`refined` note in `_feedback`) and reported with `send-feedback`
> (`nlp-misparse`) once they agree.

| Signal | Source | Card content |
|---|---|---|
| discarded parameter | `Search_Listings` result with non-empty `appliedFilters.unrecognized` | 🧩 prompt, nlpId, URL, the discarded names |
| upstream / nlp-scope error | classification `capture === true` | ❌ tool, status, body, URL, prompt when the tool is `Search_Listings` |

**Modes (`FEEDBACK_AUTO_CAPTURE`).** `narrow` is the default, and any unknown value means narrow: the two
signals above are all that is captured, which is the owner decision of 2026-10-15. `full` restores the
original behaviour: refine corrections (`refine:` key, prompt tied back through the session search
memory) and restated searches (`restated:` key, driven by `repairsNlpId`, which `Search_Listings`
exposes only in this mode) are captured as well, and instructions rules 2 and 3 and the refine-search,
search-listings and send-feedback descriptions use the pre-change wording. In `full` the `recorded`
note replaces the `refined` offer. The mode is read per call; tool-description gating is read at
import. Redaction, quoting, quotas, both breaker budgets and the `repairsNlpId` pattern check apply in
both modes, and the auto list (§6.6) gates capture in both.

In narrow mode `session` holds only the per-session capture quota. Capture never blocks or alters the tool
response.

### 6.3 Deduplication

In-memory, per process, 24-hour TTL. Keys use parameter **names**, not values, so one defect is one
card however many places it occurs in:

| Signal | Key |
|---|---|
| discarded parameter | `unrecognized:` + sorted names |
| upstream | `upstream:<tool>:<status>:<first 80 chars of message>` |
| nlp-scope | `nlp-scope:<message>` |

The first occurrence creates a card. Later occurrences in the window add a Trello comment carrying
that instance's prompt, nlpId and values — at most 10 comments per key per window — because every
distinct prompt is a test case the NLP team can use. Name-set keys are deliberately coarse, not a
root-cause match. (The refine and restated keys of the original design were removed on 2026-10-15,
see §6.2.)

A circuit breaker caps new cards at 20 per process per hour; overflow is logged to stderr and
dropped, so an upstream outage cannot flood the board.

Multiple dynos deduplicate independently. A shared store is out of scope until it proves to matter.

### 6.4 Card format

Name prefix `[MCP·auto]` (model-written cards keep `[MCP]`), then the existing category marker and a
one-line summary generated from the signal. Body: signal, tool, prompt, nlpId, URLs, changed or
discarded parameters, error status and body, ISO timestamp. Never included: API keys, user identity,
OAuth claims. Everything in a card is data the Repliers API already received in that request.

Personal data: error cards carry the request path and parameter names, not values, and response
bodies only for the listing-search tools; CRM and message tools never put client data on the board.

### 6.5 What the model sees

`_feedback` gains a `recorded` signal with a factual note, e.g. *"Recorded for the Repliers team: the
API discarded zeta from an NLP-built search."* After a refine-search call that changed a constraint
it carries a `refined` signal instead: *"This call changed type, which the original parse missed or
mis-mapped. send-feedback (category nlp-misparse, missedConstraints) can report it to the Repliers
team if the user agrees."* Neither uses "REQUIRED … as your NEXT tool call" wording.

### 6.6 Gating

Auto cards go to their own Trello list, `TRELLO_AUTO_LIST_ID`, apart from model-written `[MCP]` cards
(`createCard(card, { listId })`). Capture runs only when `autoCaptureConfigured()`: `FEEDBACK_DRY_RUN`,
or `TRELLO_API_KEY` + `TRELLO_API_TOKEN` + `TRELLO_AUTO_LIST_ID`. Dry-run writes cards and comments to
the dry-run log as today. With Trello configured but no `TRELLO_AUTO_LIST_ID`, capture is off,
`run()` logs `[CONFIG] TRELLO_AUTO_LIST_ID is not set: server-side capture is off; send-feedback still
works.` once, and no tool text, instruction or `recorded` note claims recording; `send-feedback`
stays gated on `trelloConfigured()` alone. Without Trello, nothing is captured and no text mentions
recording (§7.4).

---

## 7. Neutral tool text

### 7.1 Inventory (scan of the live roster, 2026-10-12)

10 of 45 tools carry approval-steering wording or an ungated `send-feedback` mention:

| Where | Today | v2 |
|---|---|---|
| 7 generated tools (`autocomplete-location-search`, `get-address-listing-history`, `get-similar-listings`, `search-brokerages`, `search-locations`, `search-members`, `search-offices`) | "If results look wrong or incomplete — see send-feedback." — from `codegen/overrides.json`, ungated | removed; capture makes it unnecessary |
| `refine-search` | `ONLY`, "you MUST follow it with send-feedback … the task is unfinished" | "Each call that changes a filter is recorded for the Repliers team as a probable NLP parse gap." — only when Trello is configured |
| `Search_Listings` | `ALWAYS verify`, "include it in send-feedback reports", "see send-feedback" | neutral statement of the response contract; `repairsNlpId` documented; recording sentence gated |
| `send-feedback` | `CONSENT REQUIRED … only after the user says yes` / `report directly without asking … (the report contains nothing beyond …)` | §7.2 |

### 7.2 `send-feedback`

> Creates a triage ticket for the Repliers team about a search-quality or service problem. Failures
> the server observes itself — API errors, refine-search corrections, parameters the API discarded,
> searches restated with repairsNlpId — are recorded automatically and need no ticket. This tool
> covers what only the conversation shows: a report the user asks for, or results the user considers
> wrong.

The result changes from `{ ok: true, dryRun: true }` to
`{ recorded: true, forUser: "The report was sent to the Repliers team." }`. Three answers in past
runs, and S5 in §3, relayed `dryRun` to the end user.

### 7.3 `instructions` and nudges

Rule 3 becomes: *"Report: failures the server observes (API errors, refine-search corrections,
discarded parameters, searches restated with repairsNlpId) are recorded automatically; _feedback and
_notice blocks say when. send-feedback covers what only the conversation shows: sent when the user
asks, offered when the user is dissatisfied with results."* Rule 2 gains "when restating, pass the
earlier search's nlpId as repairsNlpId". The follow-feedback rule adds that a `_notice` `forUser`
text is written for the end user. The verify rule keeps its place inside the first 512 characters.

`_feedback` notes are rewritten as statements: `verify` → "appliedFilters shows what was actually
searched; a constraint missing from it was not applied…", `zero-results` and `no-location-filter`
likewise. No note contains `MUST`, `REQUIRED`, or advice about asking or not asking the user.

### 7.4 `FEEDBACK_CONSENT` retired

With server-observed failures captured, the model is left with two cases: the user asks for a report
(consent is the request itself) and the user is dissatisfied (offer first). That rule is the same in
`auto` and `always-ask`, so the switch no longer changes anything. The variable is still read so a
deployment that sets it does not fail; startup logs one line saying it is ignored and why.
`consentMode()` and both text variants are deleted. `CLAUDE.md`, the KB article
(`docs/kb-articles/setting-up-repliers-mcp.md`) and `../agent-feedback/status.md` are updated.

### 7.5 Enforcement — `test/toolDescriptionTone.test.js`

Over the full roster (tool descriptions and every parameter description), in both Trello states.
Upper-case words match case-sensitively (so "Required parameters:" and "(required if multi-board
account)" pass); phrases match case-insensitively.

- fails on `MUST`, `REQUIRED`, `MANDATORY`, `CRITICAL`, `only after`, `without asking`,
  `no need to ask`, `consent`, `says yes`, `unfinished`;
- custom tools additionally fail on `ALWAYS`, `NEVER`, `ONLY`. Generated tool-selection hints such as
  "NOT for browsing — use Search_Listings" are left alone: they have not been implicated in any
  report;
- with Trello unconfigured, fails if any text mentions `send-feedback` or "recorded for the
  Repliers team".

The existing pins in `test/serverInstructions.test.js` (no `send-feedback` without Trello; the skill
never mentions it) stay.

---

## 8. User-Agent (card fGkfFd1U)

Every outbound API call sends `User-Agent: repliers-mcp-server/<version>`, with
` (client <name>/<version>)` appended when the MCP client announced itself. Version comes from
`lib/serverIdentity.js` (itself from `package.json`); client from `server.getClientVersion()`.
`clientInfo` is client-controlled, so it is reduced to printable ASCII and capped at 64 characters
before it reaches a header. Injected next to `_repliersApiKey` as `_userAgent`; a helper in
`lib/apiBase.js` builds the headers for the codegen template and the custom tools. This lets
Repliers attribute API traffic to Claude, ChatGPT and other clients.

---

## 9. Prerequisite — OpenAPI sync (separate bounded task)

**Done 2026-10-14, uncommitted** — what shipped and how it was verified is in [status.md](./status.md).

`openapi.json` dated from 2026-05-07. Upstream `Repliers-io/api-docs` `bundled_docs/repliers.json`
(2026-10-08) adds 8 operations, moves 2, and changes parameters on 15 — `POST /listings` gained 29.
This is a correctness problem, not hygiene: `lib/appliedFilters.js` reads `/listings` parameter names
from `openapi.json` to decide what the API discarded. Verified live on 2026-10-14:

```
"condos in Toronto that allow pets with a virtual tour"
→ /listings?class=condo&pets=yes-with%20restrictions&hasVirtualTour=true&city=Toronto
   appliedFilters.unrecognized: ["pets","hasVirtualTour"]   ← both valid upstream
```

Today that produces false repair-and-report advice; under §6 it would produce false cards
automatically. Hence the ordering.

Scope: an `npm run sync-spec` script that fetches `bundled_docs/repliers.json` at a pinned commit
(not a git submodule — 4.1 MB of documentation for one JSON file); `codegen` learns to resolve
`$ref`s whose JSON-pointer segments are percent-encoded (`~1listings~1%7BmlsNumber%7D`), which today
yields `items: {}` and drops the location-type enum from 4 parameters — the gap that let an agent
pass `type: street` (tizUYBN5); regenerate; review `codegen/overrides.json` against the new text;
upstream-only operations stay excluded in `codegen/config.js` until the roster-size question
(45 tools on registry-truncating clients) is decided.

---

## 10. Verification

### 10.1 Offline (`npm test`, `fetch` mocked)

- `apiErrors`: each §3 body classifies to its kind; the 403 and OpenAI-key cases by text; 404 is not
  an error.
- The random-key probe as a test: same call → `isError: true`, `_notice.kind === "account"`,
  dashboard link present, no reporting nudge.
- `boardId`: one board → transparent retry with `boardIdResolved`; several → candidates; none →
  `not-found`.
- `autoReport`: each signal writes a card; a duplicate within the TTL writes a comment; the 11th
  duplicate writes nothing; the circuit breaker trips at 21; no Trello → nothing; a Trello failure
  leaves the tool response intact.
- `repairsNlpId` with and without a session entry.
- `toolDescriptionTone` (§7.5); User-Agent header present and sanitised.

### 10.2 Eval — same model, harness and queries as §3

| Metric | Before (§3) | Expected after |
|---|---|---|
| repairs that reach Trello, `auto` | 14/16, 7 distinct among 14 | all, one card per distinct defect |
| repairs that reach Trello, consent-sensitive surface | 0/11 | same as `auto` |
| S5 invalid key | false report or offer to report; no fix path | `forUser` relayed with the dashboard link; no report |
| false api-error cards | 2 | 0 |
| `dryRun` relayed to the user | 1 | 0 |

### 10.3 Manual, ChatGPT — the only check for §2.2 C

ChatGPT keeps a snapshot of tool metadata taken when the connector is added or scanned. After deploy:
rescan or re-add the Repliers connector, then repeat the customer scenario including "send error log
to repliers". Pass: no "Suspicious Instruction" card and no safety block.

---

## 11. Rollout

1. OpenAPI sync (§9) merged and deployed.
2. v2 merged and deployed (Heroku).
3. Rescan/re-add the connector in ChatGPT for every published or dev plugin, then §10.3.
4. Tell the triage side: `[MCP·auto]` cards, one per defect per day, instances as comments.

## 12. Out of scope

- Oversized `Search_Listings` payloads. In B2 and B10 the model re-ran the identical prompt 6–7
  times against 3–4 MB responses; the known `resultsPerPage`/`fields` gap. Its own card.
- Exposing the 8 new upstream operations (roster size).
- NLP-side fixes behind the recorded signals; consuming `not_understood` (MQGKaWyl) once it ships.
- Cross-dyno deduplication.

## 13. Open questions

1. Exact status and body of the entitlement error ("does not have access to this feature") — needs a
   key without NLP.
2. Exact body of the OpenAI-key 401 (HAZH3Bng), and where that key is configured, so the dashboard
   link in §5.3 points at the right page.
3. Whether to attempt a long-session reproduction of card nLD4VjI9 in real ChatGPT before and after.
4. Who performs §10.3 and on which deployment (the dev plugin "Repliers v3" in the screenshots).
