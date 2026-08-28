# Agent Feedback — Status & Resume Point

**Updated:** 2026-08-28
**Branch:** `feat/agent-feedback` (pushed to origin; unit suite 37/37 green via `npm test`)

## Where we are

Implementation is **complete** per [design.md](./design.md):

- Three delivery channels: rewritten tool descriptions, conditional server `instructions`, response-embedded `_feedback` nudges (`lib/feedbackHints.js`, eagerness via `FEEDBACK_PROMPT_LEVEL`).
- `refine-search` — deterministic parse repair; requires a prior `Search_Listings` `request.url`, `remove` wins over `set` for the same param; union (`queries`) URLs flagged, not refined.
- `send-feedback` — Trello card intake; the tool and every mention of it are gated on `trelloConfigured()` (`lib/trello.js`).
- `Search_Listings` responses lead with `appliedFilters` + `complexQuery` (`lib/appliedFilters.js`).

**Part A (all green), Part B run 1, and the post-tweak re-runs (run 3) are done — 2026-08-28.** Fable: 8/8 PASS, plus S2 re-run PASS on the new code. Haiku after tweaks: S1 PASS (offers feedback), S2 still partial — happy-path reporting is a weak-tier discipline limit; the definitive fix is v2 server-side refine telemetry (recommended next). Results log: [test-results.md](./test-results.md).

Code delivered on top of the feature: `refined` signal in refine-search responses (`lib/feedbackHints.js`) and multi-value `propertyType`/`style` in refine-search (arrays → repeated params; both tiers adopt it from the schema alone). Unit suite 40/40.

Resume point: (1) v2 refine telemetry decision, (2) second consecutive Fable core run for exit criteria, (3) real-Trello A4 before merge, (4) report the discovered upstream API bug (parking/lockers leak through minBeds) to Repliers.

## Trello-less testing: `FEEDBACK_DRY_RUN`

Added 2026-08-28 to run the test plan without Trello credentials. `FEEDBACK_DRY_RUN=true` in `.env`:

- `trelloConfigured()` returns true → `send-feedback` appears in the roster, instructions and nudges mention it — the full "Trello ✓" behavior.
- `createCard` does NOT call Trello: it prints the card (name + desc) to the server **stderr** and returns `{ ok: true, dryRun: true }`.

Test-plan expectation changes under dry-run:

- A1/A2 "with keys" state = `FEEDBACK_DRY_RUN=true`, no Trello vars needed.
- A4 / Part B card checks: verify the `[feedback dry-run] Trello card:` dump in the server console instead of a Trello card; tool result has `dryRun: true` and no `cardUrl`.
- Part C "Trello ✗" rows still require unsetting BOTH the Trello vars and `FEEDBACK_DRY_RUN`.

## Next steps

1. ~~Part A technical checks~~ — **done 2026-08-28, all green** (see [test-results.md](./test-results.md), incl. tweak candidates). Pre-flight for every server start: kill any stale listener on port 3001 first (`netstat -ano | findstr :3001`) — a month-old instance silently invalidated one run.
2. Part B naive-agent eval (§4) — **headless mode**: each scenario = one cold `claude -p "<prompt>"` from `C:/Users/dark/Documents/repliers/mcp-eval` (`.mcp.json` → `repliers-local` @ `http://localhost:3001/mcp`); multi-turn scenarios (S6) via `--resume`. **Model matrix** (owner decision 2026-08-28): expected-strong tier (Fable/Opus) AND weak tier (Haiku) must both be tested — full S1–S8 on the primary model, at least core S1, S2, S4, S5 per additional model; log the model per run in §6.
3. Exit criteria: two consecutive all-PASS runs of S1, S2, S4, S5 with no wording changes between them.
4. Real-Trello delivery (original A4) before merge — the only check dry-run cannot cover.
