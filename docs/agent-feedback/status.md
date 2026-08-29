# Agent Feedback — Status & Resume Point

**Updated:** 2026-08-28
**Branch:** `feat/agent-feedback` (pushed to origin; unit suite 47/47 green via `npm test`)

## Where we are

Implementation is **complete** per [design.md](./design.md):

- Three delivery channels: rewritten tool descriptions, conditional server `instructions`, response-embedded `_feedback` nudges (`lib/feedbackHints.js`, eagerness via `FEEDBACK_PROMPT_LEVEL`).
- `refine-search` — deterministic parse repair; requires a prior `Search_Listings` `request.url`, `remove` wins over `set` for the same param; union (`queries`) URLs flagged, not refined.
- `send-feedback` — Trello card intake; the tool and every mention of it are gated on `trelloConfigured()` (`lib/trello.js`).
- `Search_Listings` responses lead with `appliedFilters` + `complexQuery` (`lib/appliedFilters.js`).

**Part A (all green), Part B run 1, and the post-tweak re-runs (run 3) are done — 2026-08-28.** Fable: 8/8 PASS, plus S2 re-run PASS on the new code. Haiku after tweaks: S1 PASS (offers feedback), S2 still partial — happy-path reporting is a weak-tier discipline limit; the definitive fix is v2 server-side refine telemetry (recommended next). Results log: [test-results.md](./test-results.md).

Code delivered on top of the feature: `refined` signal in refine-search responses (`lib/feedbackHints.js`) and multi-value `propertyType`/`style` in refine-search (arrays → repeated params; both tiers adopt it from the schema alone). Unit suite 40/40.

Run 5 (2026-08-28): the weak-generation reporting skip was a **payload-truncation artifact** — `_feedback` serialized after the listings blob and head-first readers never saw it. Fixed by serializing `_feedback` FIRST in the payload (plus hardened mandatory-report wording in all three channels). Haiku and Sonnet 4.6 S2 now PASS incl. the report; no-spam guard clean. v2 telemetry downgraded to optional.

Run 6: strict wording KEPT (decision recorded in test-results.md) + `refined` signal scoped in code to constraint patches only (`constraintPatch` flag; presentation-only refines no longer nudge a report). Fable core run 1/2 on current wording: ALL PASS.

MCP tool annotations (`readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint`) are now emitted for every tool (`lib/tools.js` → `transformTools`), so read-only consumer surfaces (ChatGPT Plus connectors) filter the roster correctly. Query battery: run 1 (Fable) was **quota-aborted after 5 queries**; **run 2 on `claude-sonnet-5` completed all 28 — 27 PASS / 1 FAIL** (see [query-battery-results.md](./query-battery-results.md)). The battery's real output is a filed set of upstream defects: `type=sale` never inferred for purchase queries (7 cards), locations dropped (6), relative dates resolved to the wrong year, `minBeds` not excluding parking/lockers, and a `Market_Statistics` 400. The one FAIL (W11) is a product decision, not a bug: the agent answered an out-of-scope mortgage-rate question with invented current figures and named sources after zero tool calls. **Run 3 (`claude-haiku-4-5`, all 28): 22 ✅ / 4 🟡 / 3 ❌** — and it surfaced a server-side gap rather than a model one: the `instructions` never state a **role**, so the weak tier stays in the host harness's persona (answered a realtor's relocation brief with "Classification: Spike", declined W11/W12 as "outside software engineering"). Verification also collapses (3/28 explicit appliedFilters checks vs Sonnet's 12/28) while reporting still works (10 cards, incl. an independent catch of the date-epoch bug).

Resume point: (1) add a role sentence to the server instructions (run-3 finding) and decide the W11 out-of-scope policy (an explicit "listings/locations/stats only" clause in the server instructions vs. accepting harness-dependent behaviour) and hand the five defects above to Repliers, (2) second consecutive all-PASS Fable core run on the current wording → acceptance, (3) real-Trello A4 before merge, (4) report the discovered upstream API bug (parking/lockers leak through minBeds) to Repliers.

## Consent policy: `FEEDBACK_CONSENT`

`auto` (default) keeps the shipped behaviour: technical failures (api-error, a confirmed misparse) are reported without asking, subjective complaints are offered first.

`always-ask` makes consent mandatory for **every** category. It is a single switch that rewrites all three delivery channels at once, so they can never disagree:

- **Golden rule 3** (`lib/serverInstructions.js`) — "never send feedback without the user's explicit consent … including technical failures".
- **`send-feedback` description** — opens with `CONSENT REQUIRED`, drops the report-directly clause.
- **Every `_feedback` note** (`lib/feedbackHints.js`) — the shared "then report" clause becomes "then ask … only after they agree"; api-error and refined get their own consent-first wording.

Use it for consumer surfaces where an unattended report would surprise the end user (e.g. a realtor's own chat), and keep `auto` for eval/staging where reports are the point.

## Trello-less testing: `FEEDBACK_DRY_RUN`

Added 2026-08-28 to run the test plan without Trello credentials. `FEEDBACK_DRY_RUN=true` in `.env`:

- `trelloConfigured()` returns true → `send-feedback` appears in the roster, instructions and nudges mention it — the full "Trello ✓" behavior.
- `createCard` does NOT call Trello: it prints the card (name + desc) to the server **stderr**, mirrors the same text to a log file, and returns `{ ok: true, dryRun: true }`.
- The log file is `FEEDBACK_DRY_RUN_LOG`, defaulting to `feedback-cards.log` in the mcp-server root (gitignored). Append-only, so a headless eval can read every card back after the run instead of scraping server stderr. A write failure is warned about and never breaks the tool result.

Test-plan expectation changes under dry-run:

- A1/A2 "with keys" state = `FEEDBACK_DRY_RUN=true`, no Trello vars needed.
- A4 / Part B card checks: verify the `[feedback dry-run] Trello card:` dump in the server console instead of a Trello card; tool result has `dryRun: true` and no `cardUrl`.
- Part C "Trello ✗" rows still require unsetting BOTH the Trello vars and `FEEDBACK_DRY_RUN`.

## Next steps

1. ~~Part A technical checks~~ — **done 2026-08-28, all green** (see [test-results.md](./test-results.md), incl. tweak candidates). Pre-flight for every server start: kill any stale listener on port 3001 first (`netstat -ano | findstr :3001`) — a month-old instance silently invalidated one run.
2. Part B naive-agent eval (§4) — **headless mode**: each scenario = one cold `claude -p "<prompt>"` from `C:/Users/dark/Documents/repliers/mcp-eval` (`.mcp.json` → `repliers-local` @ `http://localhost:3001/mcp`); multi-turn scenarios (S6) via `--resume`. **Model matrix** (owner decision 2026-08-28): expected-strong tier (Fable/Opus) AND weak tier (Haiku) must both be tested — full S1–S8 on the primary model, at least core S1, S2, S4, S5 per additional model; log the model per run in §6.
3. Exit criteria: two consecutive all-PASS runs of S1, S2, S4, S5 with no wording changes between them.
4. Real-Trello delivery (original A4) before merge — the only check dry-run cannot cover.
