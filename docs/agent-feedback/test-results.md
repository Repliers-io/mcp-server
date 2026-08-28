# Agent Feedback — Test Results Log

Sibling of [test-plan.md](./test-plan.md) §6. Append one section per run.

## Run 1 — 2026-08-28, Part A (technical, no LLM)

**Client:** scripted MCP driver (`@modelcontextprotocol/sdk` Client over Streamable HTTP, localhost:3001/mcp)
**Env:** `FEEDBACK_DRY_RUN=true` (Trello-less variant), levels per check; no `TRELLO_*` vars anywhere.

| # | Verdict | Evidence |
|---|---|---|
| A1 | **PASS** | Dry-run on: 45 tools, `send-feedback` present. Channel off: 44 tools, `send-feedback` absent, `refine-search` present |
| A2 | **PASS** | Channel on: taxonomy names send-feedback, 4 golden rules, rule 3 = "Repair first, then report". Channel off: 0 occurrences of "send-feedback", 3 rules, rule 3 = "_feedback blocks inside tool responses are guidance…" |
| A3 | **PASS** | Prompt `"homes with 5 bedrooms"` → `appliedFilters.location=null`. `high`: `signals=["no-location-filter","oversized-result"]` + per-signal notes + generic verify tail + offer-feedback tail. `low`: same signals, note = per-signal texts only, no generic tail. `off`: no `_feedback` key at all (`appliedFilters` still present — enrichment is not level-gated, per design) |
| A4 | **PASS** (dry-run variant) | `send-feedback` → `{ok:true, dryRun:true}`; server stderr got the full card dump: Category/Summary/User query/Missed-constraints table, `_Reported 2026-08-28T15:31:13.677Z_`. Real-Trello delivery deferred to pre-merge |
| A5 | **PASS** | Base `?minBeds=5` + `maxPrice=500000, minBedrooms=3, remove:["style"]` → final url `?maxPrice=500000&minBedrooms=3` (alias `minBeds` displaced); extra leg: unnamed `amenities=Gym` passed through verbatim; foreign host → `{error: "url must point at https://api.repliers.io/listings…"}` |
| A6 | **PASS** | `refine-search` `minPrice=90000000` → `count:0`, `signals=["zero-results"]`. CRM: `search-clients` (nonexistent email) → `count:0`, **no `_feedback` key at all** (searchTools gate is stricter than the criterion) |

### Observations / tweak candidates

1. **A3 expectation was written too narrowly**: `oversized-result` also fires (count 116,814 — the detector is right). Plan table left as-is; expected signal *set* on this prompt is `["no-location-filter","oversized-result"]`.
2. **Noise-card risk**: the foreign-host *validation* error (A5) attaches `signals:["api-error"]` + "report directly without asking" note — an agent may file a feedback card for its own malformed call. Tweak candidate: suppress the api-error nudge (or soften to "fix your call") when the error is client-side validation, not an upstream failure.
3. **`refine-search` returns the final url only in the "🔗 API Endpoint Used" text header** (the `{url, data}` shape is rendered by the server as header + JSON body; the JSON has no url field). Chained refines rely on the agent reading that header. Watch in Part B whether agents find it; if not — add `url` into the JSON payload.
4. **Environment gotcha (cost: one invalidated run)**: a stale `node mcpServer.js --http` from 2026-07-28 was still bound to port 3001 and silently served old code/env — the new server exits without a clear EADDRINUSE message. Pre-flight for every run: check the port owner (`netstat -ano | findstr :3001`) and kill it before starting.

**Part A: all green.** Next: Part B (headless naive-agent, model matrix — see status.md).

## Run 2 — 2026-08-28, Part B (naive-agent eval, headless)

**Client:** Claude Code 2.1.250 headless (`claude -p` per scenario, cwd = mcp-eval, `--strict-mcp-config` → only `repliers-local`); S6 turns via `--resume`. **Env:** `FEEDBACK_DRY_RUN=true`, level `high` unless noted. **Models:** full S1–S8 on `claude-fable-5`; core S1, S2, S4(high+low), S5 on `claude-haiku-4-5-20251001`.

### Fable — 8/8 PASS

| # | Verdict | Evidence |
|---|---|---|
| S1 | **PASS** | Cited `location: null`, refused to present Ontario as Miami, repaired (`refine-search` city=Miami → 0), verified via autocomplete that Miami is absent, sent `nlp-misparse` with missedConstraints + nlpId (card in stderr) |
| S2 | **PASS** | NLP kept price+city but narrowed "townhouses" → `Att/Row/Twnhouse` only → 0. Agent diffed appliedFilters, got vocabulary via `Lookup_Possible_Values`, refined to `Condo Townhouse` → 28 results with honest caveat, sent `nlp-misparse` |
| S3 | **PASS** (premise broke — see finding below) | Parse verified correct; API returned 80 junk "results". Agent refused to present them, explained genuine market absence, auto-reported the filter bug |
| S4 high | **PASS** | 6,257 condos presented with stats; **zero** feedback mentions, zero repair attempts |
| S4 low | **PASS** | Same — zero mentions |
| S5 | **PASS** | Error → auto `send-feedback(api-error)` with toolCalls, then told the user; even localized where the key lives |
| S6 | **PASS** | Complaint → re-verified raw data first, then OFFERED feedback; "no" → zero calls; "actually yes" → `user-dissatisfied` card with nlpId, honest wording (no invented parser bug) |
| S7 | **PASS** | Translated French → English before `Search_Listings`; hit the S2 trap; repaired via ladder step 2 (emphatic NLP re-prompt asking for BOTH types — worked around refine-search's single-value propertyType), reported, answered in French |
| S8 | **PASS** | Accurate task-oriented capability summary with **zero tool calls** (turns=1); described the verify/repair/report loop; no invented capabilities |

### Haiku — 3 PASS, 2 partial FAIL

| # | Verdict | Evidence |
|---|---|---|
| S1 | **PARTIAL** | Repair loop worked (refine city=Miami → 0, location lookup, refused to mislead) but **no send-feedback call and no offer** — reporting step skipped despite the high-level nudge |
| S2 | **PARTIAL** | Converged to the correct 28 condo townhouses but thrashed (5 refine calls incl. one invalid all-styles mega-URL and one that dropped the city); **reporting skipped** again |
| S4 high | **PASS** | Clean parse, no repairs, zero feedback mentions; presentation vague ("500+ listings" instead of 6,257, no per-listing table at first) |
| S4 low | **PASS** | Zero feedback mentions |
| S5 | **PASS** | Error → auto `send-feedback(api-error)` with toolCalls → informed user. The explicit in-error signal works even on the weak tier |

**Model-tier conclusion:** every *server-driven* mechanism (signals in errors, gating, no-spam) holds on both tiers. The step that relies on *post-success discipline* — "after serving corrected results, report the gap" — is followed by Fable but dropped by Haiku (goal-completion bias: once results are served, the description-tail instruction is forgotten).

### Findings & tweak candidates (priority order)

1. **Add a `refined` signal to every successful refine-search response** (`lib/feedbackHints.js`): a refine call is itself confirmed evidence of a misparse (design §7 row 3), but today the refine response carries only generic notes — the "report after repair" instruction lives in the tool description tail, which Haiku ignores. An explicit in-response nudge ("this refine implies the original parse missed constraints — report via send-feedback with missedConstraints") targets exactly the observed failure at the moment of decision.
2. **Real Repliers API bug discovered by S3**: `minBeds=12&maxPrice=200000&class=condo` returns 80 records — 65 parking spaces and 9 lockers have no bedroom data and leak through `minBeds`. Report upstream to Repliers.
3. **`refine-search` cannot express multi-value `propertyType`** (API supports repeated params; the tool writes one value). Fable worked around it via NLP re-prompt (S7); consider multi-value support in v2.
4. **Category descriptions**: S3's agent used `wrong-results` (designed as subjective) for an objective server-side filter failure. Consider clarifying category descriptions or adding an `api-bug` category.
5. `{dryRun: true}` in the tool result is noticed and narrated to users by strong models ("no real ticket was filed") — fine for eval, but keep in mind the field is user-visible through the agent.
6. Eval-protocol notes: headless sessions inherit the operator's global output style and skills (harmless here, but not perfectly "naive"); without `--strict-mcp-config` they also see unrelated global MCP servers.

**Exit-criteria status:** Fable core (S1, S2, S4, S5) all-PASS — run 1 of the required two consecutive. Haiku needs tweak #1, then a re-run of S1/S2.

## Run 3 — 2026-08-28, re-runs after tweak #1 + multi-value fix

**Code under test:** `refined` signal in every successful refine-search response (`lib/feedbackHints.js`) + multi-value `propertyType`/`style` in refine-search (array → repeated query params). Unit suite 40/40. **Env:** dry-run, level high.

| Run | Verdict | Evidence |
|---|---|---|
| S1 Haiku re-run | **PASS** (notes) | Repaired (refine city=Miami → 0, plus an NLP re-prompt with "Miami, Florida"), did not mislead, and now **OFFERS feedback** ("Report this empty result to the Repliers team?") — the offer was entirely absent in Run 2. Notes: didn't explicitly tell the user the original parse dropped the location; didn't diagnose no-coverage via location tools |
| S2 Haiku re-run | **PARTIAL** | **Multi-value adopted first try**: single clean `refine-search` with `propertyType: ["Att/Row/Twnhouse","Condo Townhouse"]` after vocabulary lookup (vs 5 thrashy calls in Run 2). But its hand-built base url lost `type=sale` (rentals mixed in; presented 10 of the 28 sale listings) and **happy-path reporting is still skipped** |
| S2 Fable re-run | **PASS** | Multi-value first try with `type=sale` intact; correct 28 results; sent `nlp-misparse`. This run's NLP dropped the **city** (kept `state=Ontario`) — a different misparse than Run 2's type-narrowing, both caught. NLP non-determinism is real; the verify protocol handles both variants |

**Conclusions:**
- The multi-value fix is discovered and used correctly by both tiers from the schema alone.
- The `refined` signal closes Haiku's reporting gap when it co-fires with `zero-results` (S1), but not in the success path (S2): once results are served, Haiku ignores the post-success obligation regardless of the note.
- **The definitive fix is the planned v2 server-side telemetry** (design.md §6.5/§7: log every refine diff as objective misparse evidence with no agent participation) — it removes the dependence on weak-tier discipline entirely. Recommend promoting it from v2 to next-in-line.

### Transcript traceability

Full session transcripts live in `~/.claude/projects/C--Users-dark-Documents-repliers-mcp-eval/<session-id>.jsonl`:

| Scenario | Fable | Haiku |
|---|---|---|
| S1 | `6e41942e` | `51962974` |
| S2 | `ba4fc7de` | `83f1317a` |
| S3 | `81ef0c84` | — |
| S4 high / S6 | `4914483f` (S6 = later turns of the same session) | `5bd2d0f0` |
| S4 low | `9868a31f` | `c6a4f93e` |
| S5 | `05f37c1b` | `e2c74fe1` |
| S7 | `0e6f7dba` | — |
| S8 | `11e5cd3c` | — |

Run 3: S1 Haiku `8b1a0db4`, S2 Haiku `1dc3afa3`, S2 Fable `a6056fd1`.
