# Query Battery — Results Log

Runs of [query-battery.md](./query-battery.md). Feedback-loop scenarios (S1–S8) live in
[test-results.md](./test-results.md); this file is the search/stats/detail surface.

## Run 1 — 2026-08-28, client: Claude Code CLI 2.1.250 (headless), model: `claude-fable-5`

**Setup:** cold `claude -p` per query from `mcp-eval` (`--strict-mcp-config`, only `repliers-local`
@ `http://localhost:3001/mcp`); server `FEEDBACK_DRY_RUN=true`, `FEEDBACK_PROMPT_LEVEL=high`;
tool annotations live (this run is the first with `readOnlyHint`/`destructiveHint` exposed).

**⚠️ Run aborted by quota after 5 queries.** The Claude Code session limit (resets 12am
Europe/Kyiv) was reached partway through B3. Every later session started and immediately
returned "You've hit your session limit" with zero MCP calls — B4–B6, B8, B10, all of L, all of W
are **not run**, not failed. Graded below: B1, B2 (complete), B3, B7, B9 (partial — tool calls
observed, final answer cut).

| Q | Verdict | Evidence / notes |
|---|---|---|
| B1 | ✅ PASS | Full verify→repair→report on a *plain* query: NLP dropped **both** city and propertyType (searched all-Ontario residential); agent diffed appliedFilters, looked up vocabulary, refined to `city=Mississauga&propertyType=Detached&maxBeds=3`, sent `nlp-misparse`. 170 listings, clean table |
| B2 | ✅ PASS | Both price bounds + parking applied in one parse; agent explicitly verified each filter and named the downtown neighbourhoods it resolved (Waterfront C1, Bay St Corridor, Church-Yonge). No repair needed, no feedback noise |
| B3 | ⏸ INCOMPLETE | Two search attempts observed: first plain, then an explicit restatement with a computed date (`list date on or after 2026-08-25`) — i.e. it did NOT silently drop the date constraint. Cut by quota before an answer; re-run needed for a verdict |
| B7 ↩ | ✅ PASS (mechanism) | Resolved "the second one" from B1's answer correctly → 1117 Sherwood Mills Blvd, MLS W13718148 (row 2 of B1's table), then `get-listing` + `Get_Listing_Image` ×8. Final summary cut by quota; tool selection and context carry-over are confirmed |
| B9 | ⏸ INCOMPLETE | Correct tool first try (`get-address-listing-history` with parsed street number/name/city), retried without the empty `zip`, then fell back to `Search_Listings` for the address — a sensible escalation. Cut before the answer |
| B4–B6, B8, B10, L1–L6, W1–W12 | — | **Not run** (quota) |

### Findings

1. **Quota, not capability, is the binding constraint on this battery.** 28 cold Fable sessions
   exceed a single Claude Code session window. For the re-run: use a cheaper model for the sweep
   (Haiku/Sonnet columns are wanted anyway), or split the battery across two quota windows
   (B+L, then W), or run it via the Copilot CLI "model lab" track from
   [mcp-client-research.md](./mcp-client-research.md) §2.3.
2. **B1 is a stronger misparse case than S2.** A completely ordinary realtor query
   ("3 bedroom detached houses in Mississauga under $1.2M") lost *two* constraints. The
   verify/repair/report loop caught it unprompted — evidence the protocol matters on daily
   queries, not just adversarial ones.
3. **Follow-up context resolution works** (B7): "the second one" mapped to the right MLS number
   across a `--resume` turn, with no re-search.
4. **Runner bug fixed mid-run:** extracting a session id inside `node -e` with a Windows path
   silently produced an empty `--resume` target (B7/B8 died in 2s). Pass paths via `argv`, never
   interpolate them into the script string. B7 was re-run correctly; B8 fell to the quota.

### Cross-client summary

| Client / model | B (10) | L (6) | W (12) | S1–S8 | Worst failure mode observed |
|---|---|---|---|---|---|
| Claude Code / `claude-fable-5` | 3✅ / 2⏸ / 5 not run | not run | not run | 8/8 ✅ (see test-results.md) | none observed in graded queries |
