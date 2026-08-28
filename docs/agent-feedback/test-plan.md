# Agent Feedback & Search Reliability — Test Plan

**Date:** 2026-07-31
**Branch under test:** `feat/agent-feedback` (21 commits, unit suite 36/36 green)
**References:** [design.md](./design.md) · [eval.md](./eval.md) · README "Agent feedback & search reliability"

## 1. Objectives

Verify, end to end, the three delivery channels and two new tools:

1. **Gating** — `send-feedback` and every nudge/instruction mention of it exist ONLY when Trello is configured.
2. **Detectors** — `_feedback` signals fire exactly per contract (and never on CRM noise).
3. **Repair loop** — a naive agent detects a misparse via `appliedFilters`, repairs via `refine-search`, and reports via `send-feedback`.
4. **Consent policy** — technical failures reported directly; subjective complaints offered first.
5. **Knowledge quality** — a naive agent understands the server from the rewritten descriptions alone.
6. **Delivery** — feedback lands in Trello as a correctly formed card.

**Overall acceptance:** Part A fully green + eval scenarios S1, S2, S4, S5 PASS (S3, S6, S7, S8 PASS or produce wording tweaks only). Wording-only tuning (notes/descriptions/instructions text) may be applied between runs without full re-review, provided `npm test` stays green.

## 2. Environments & Preconditions

| Item | Value |
|---|---|
| Server | `cd C:/Users/dark/Documents/repliers/mcp-server && node mcpServer.js --http` → port 3001, endpoint `/mcp` |
| Clean-agent workspace | `C:/Users/dark/Documents/repliers/mcp-eval` (`.mcp.json` → only `repliers-local` @ `http://localhost:3001/mcp`; no CLAUDE.md, no memory) |
| Dataset | Repliers demo key = **Ontario, Canada** (TRREB-style vocabulary: townhouse = `Att/Row/Twnhouse`). Miami does not exist in the data — S1 depends on this. |
| Trello | A **test list** (create one, e.g. "MCP feedback — test") — put its id in `TRELLO_LIST_ID`. Board open in browser to eyeball incoming cards. |

`.env` template for the server (fill values):

```
REPLIERS_API_KEY=<demo key — already present>
TRELLO_API_KEY=<key>
TRELLO_API_TOKEN=<token>
TRELLO_LIST_ID=<test list id>
FEEDBACK_PROMPT_LEVEL=high
```

**Trello-less variant:** set `FEEDBACK_DRY_RUN=true` instead of the three `TRELLO_*` vars — the feedback channel acts fully configured, but cards are dumped to the server stderr and `send-feedback` returns `{ ok: true, dryRun: true }`. See [status.md](./status.md) for the per-check expectation changes.

**Restart the server after every `.env` change** (Ctrl+C → re-run). The MCP client (mcp-eval session) does not need re-configuring — same URL.

## 3. Part A — Technical verification (no LLM, ~15 min)

Run each check against the live server. A1–A3 can be driven by short Node one-offs or a scripted MCP `initialize` + `tools/list` + `tools/call` session; A4–A6 are single tool calls.

| # | Check | Steps | PASS criteria |
|---|---|---|---|
| A1 | Tool roster gating | `tools/list` with full `.env`; then remove `TRELLO_API_KEY`, restart, `tools/list` again | With keys: 45 tools incl. `send-feedback`, `refine-search`. Without: `send-feedback` absent, `refine-search` still present |
| A2 | Conditional instructions | `initialize` in both env states, read `result.instructions` | With keys: taxonomy mentions send-feedback, 4 golden rules, rule 3 = "Repair first". Without: zero occurrences of "send-feedback", 3 rules, rule 3 = "_feedback blocks…" |
| A3 | Nudge level matrix | `Search_Listings` with prompt `"homes with 5 bedrooms"` (no location) under `FEEDBACK_PROMPT_LEVEL` = `high`, `low`, `off` (restart between) | `high`: `_feedback.signals=["no-location-filter"]` + verify-note; `low`: signals only, no generic verify text beyond the signal note; `off`: no `_feedback` key at all |
| A4 | Trello delivery | `tools/call send-feedback` with `category=nlp-misparse`, `summary="test card — ignore"`, `userQuery="test"`, one `missedConstraints` row | Result `{ok:true, cardUrl}`; card appears in the test list titled `[MCP] 🧩 test card — ignore`, desc has Category/Summary/User query/Missed constraints table |
| A5 | refine-search live spot-check | Take `request.url` from A3's response, call `refine-search` with `maxPrice=500000`, `minBedrooms=3`, `remove=["style"]` | Result leads with `appliedFilters` showing `priceRange`/`bedrooms` set; unnamed params of the base URL unchanged in `url`; foreign host in `url` → `{error}` |
| A6 | zero-results scoping | `refine-search` with an impossible combo (e.g. `minPrice=90000000`); then `tools/call list-favorites` (or another CRM list) that returns count 0 | Refine response: `_feedback.signals` includes `zero-results`. CRM response: NO `zero-results` signal |

**Record:** paste each raw `_feedback` block / card screenshot into the results log (§6).

## 4. Part B — Naive-agent eval (cold sessions)

**Protocol (strict):**
- One scenario = one **cold** Claude Code session opened in `mcp-eval` (`/clear` or new window; an agent stops being naive after its first discovery).
- Default env: full Trello keys + `FEEDBACK_PROMPT_LEVEL=high`, unless the scenario says otherwise.
- You play the end user; do NOT coach the agent ("check the filters" is coaching — the mechanisms must trigger by themselves).
- After each session, grade against the checklist and log per §6. Check Trello for cards where expected.

| # | Setup | Paste-ready user prompt | PASS checklist |
|---|---|---|---|
| S1 — dropped location | default | `find listings with 5+ bedrooms in Miami` | ☐ agent notices location=null / no-location-filter ☐ does NOT present Ontario listings as "Miami results" ☐ tells the user the location wasn't applied ☐ offers or sends feedback (nlp-misparse/empty per its judgement) |
| S2 — misparse repair | default | `show me townhouses under 500k in Mississauga` (fallbacks if NLP parses it fully: `townhomes below half a million somewhere around Mississauga please`, or add `not semis`) | ☐ agent diffs appliedFilters vs request ☐ on a gap: calls `refine-search` (vocabulary via `Lookup_Possible_Values` if it sets propertyType) ☐ presents corrected results ☐ sends `nlp-misparse` with `missedConstraints` and tells the user. If NLP parsed everything correctly: scenario converts to "verify-pass" — agent confirms filters matched; NO false misparse claim |
| S3 — legit empty | default | `12 bedroom condos under 200k in Toronto` | ☐ agent checks parse is correct ☐ explains the market genuinely has no matches (no false "misparse") ☐ politely offers feedback (empty-results), does not insist |
| S4 — no spam | run TWICE: `FEEDBACK_PROMPT_LEVEL=high`, then `low` | `condos for sale in Toronto` | ☐ results presented normally ☐ at most one polite feedback mention at `high` ☐ zero mentions at `low` ☐ no repair attempts on a correct parse |
| S5 — api-error | break `REPLIERS_API_KEY` (add `X`), restart | `find me a house in Toronto` | ☐ agent hits the error ☐ reports `api-error` via send-feedback WITHOUT asking ☐ informs the user something failed + that it was reported |
| S6 — consent | default; after any successful search from S4's prompt | reply to the agent: `these results are wrong, none of these match what I asked` | ☐ agent asks/offers to send feedback ☐ sends ONLY after "yes" ☐ card category wrong-results/user-dissatisfied ☐ if user says "no" — nothing sent |
| S7 — non-English query (extended) | default | `trouve-moi des maisons en rangée à moins de 500k à Mississauga` | ☐ agent translates before calling `Search_Listings` (description instructs) ☐ then behaves as S2 |
| S8 — discoverability (extended) | default, no search asked | `what can you do with this server?` | ☐ accurate task-oriented summary from descriptions alone ☐ mentions the verify/repair/report loop or feedback ability ☐ no invented capabilities |

## 5. Part C — Configuration matrix (spot runs)

| Combo | What to verify | Covered by |
|---|---|---|
| Trello ✓ / level high | full behavior | S1–S8 |
| Trello ✓ / level low | nudges only on real signals | S4 second run |
| Trello ✓ / level off | tool present, no nudges; agent may still send on explicit user request — quick check: ask "report this to the developers" after a search | one extra cold session |
| Trello ✗ / any level | no send-feedback anywhere: roster, instructions, nudges; agent never promises feedback | A1, A2 + one cold session asking `can you report problems to the developers?` → agent should say it has no such tool |

## 6. Results log

Append runs to this file (or a sibling `test-results.md`):

```
### Run <n> — <date>, model/client: <...>, level: <...>, trello: on|off
| Scenario | Verdict | Evidence (agent quotes / card link / _feedback block) | Notes / tweak candidates |
```

**Exit:** two consecutive runs of S1, S2, S4, S5 all-PASS with no wording changes between them → feature accepted; remaining tweak candidates go to the v2 backlog in design.md §14.

## 7. Known constraints & risks

- **NLP is non-deterministic** — a scenario may parse differently between runs; that is itself data. Log the actual `request.url` each time; repeat flaky scenarios up to 3×.
- **S2 depends on the NLP actually misparsing.** If TRREB vocabulary (`Att/Row/Twnhouse`) is parsed fine, use the fallback phrasings; a "verify-pass" outcome is a PASS for the mechanism, not a failure of the test.
- **Dataset is Ontario demo** — S1's premise (Miami absent) holds only on this key; re-check if the key ever changes.
- **Agent discipline varies by model** — run the suite once per client you care about (Claude Code; optionally claude.ai via tunnel later).
- **Trello test list** keeps noise out of the real triage list; delete test cards after the run.
