# Agent Feedback — Status & Resume Point

**Updated:** 2026-08-28
**Branch:** `feat/agent-feedback` (pushed to origin; unit suite 37/37 green via `npm test`)

## Where we are

Implementation is **complete** per [design.md](./design.md):

- Three delivery channels: rewritten tool descriptions, conditional server `instructions`, response-embedded `_feedback` nudges (`lib/feedbackHints.js`, eagerness via `FEEDBACK_PROMPT_LEVEL`).
- `refine-search` — deterministic parse repair; requires a prior `Search_Listings` `request.url`, `remove` wins over `set` for the same param; union (`queries`) URLs flagged, not refined.
- `send-feedback` — Trello card intake; the tool and every mention of it are gated on `trelloConfigured()` (`lib/trello.js`).
- `Search_Listings` responses lead with `appliedFilters` + `complexQuery` (`lib/appliedFilters.js`).

**End-to-end testing per [test-plan.md](./test-plan.md) has NOT started** — the results log (§6) is empty. That is the resume point.

## Trello-less testing: `FEEDBACK_DRY_RUN`

Added 2026-08-28 to run the test plan without Trello credentials. `FEEDBACK_DRY_RUN=true` in `.env`:

- `trelloConfigured()` returns true → `send-feedback` appears in the roster, instructions and nudges mention it — the full "Trello ✓" behavior.
- `createCard` does NOT call Trello: it prints the card (name + desc) to the server **stderr** and returns `{ ok: true, dryRun: true }`.

Test-plan expectation changes under dry-run:

- A1/A2 "with keys" state = `FEEDBACK_DRY_RUN=true`, no Trello vars needed.
- A4 / Part B card checks: verify the `[feedback dry-run] Trello card:` dump in the server console instead of a Trello card; tool result has `dryRun: true` and no `cardUrl`.
- Part C "Trello ✗" rows still require unsetting BOTH the Trello vars and `FEEDBACK_DRY_RUN`.

## Next steps

1. Part A technical checks (test-plan §3) — A1–A3, A5, A6 as written; A4 via the dry-run console dump.
2. Part B naive-agent eval (§4): cold Claude Code sessions in `C:/Users/dark/Documents/repliers/mcp-eval` (`.mcp.json` → `repliers-local` @ `http://localhost:3001/mcp` — already in place), scenarios S1–S8, log results per §6.
3. Exit criteria: two consecutive all-PASS runs of S1, S2, S4, S5 with no wording changes between them.
4. Real-Trello delivery (original A4) before merge — the only check dry-run cannot cover.
