# Feedback v2 — Status & Resume Point

**Updated:** 2026-10-15
**Branch:** `develop`, uncommitted (the owner commits)

## Where we are

Implemented on `develop`, uncommitted; verification below. Design: [design.md](./design.md) (approved
2026-10-14); plan: [plan.md](./plan.md). **Pending:** the code-reviewer and security-reviewer passes, the eval re-run against the baseline
(design.md §10.2) and the manual ChatGPT check (owner, after deploy).

What each task shipped:

1. `lib/apiRequest.js`: shared headers, User-Agent (from `clientInfo`, sanitised) and failure reading.
2. `lib/apiErrors.js`: `classifyError` by who can fix the failure, with `forUser` texts and dashboard links.
3. Codegen: generated tools return `{ url, error, status, body }` on failure and send the User-Agent (39 tools regenerated).
4. The five custom tools share the same failure contract; `refine-search` success returns `changed: { set, remove }`.
5. `lib/trello.js`: `createCard` returns the card id; new `addComment`; dry-run mirrors both.
6. `lib/autoReport.js`: deduplicated reporter (24 h per key, capped comments, hourly breaker) and signal builders.
7. `lib/toolCall.js`: tool calls return classified `_notice` errors with `isError`; `mcpServer.js` delegates to it.
8. `lib/boardId.js`: `boardId` resolution for multi-board accounts.
9. Capture wired into the call path: key redaction, recording, per-session search memory.
10. `repairsNlpId` on `Search_Listings` marks a restated search for capture; never sent to `/nlp`.
11. Neutral `_feedback` notes, instructions and `send-feedback` result; `FEEDBACK_CONSENT` retired (startup notice only).
12. Neutral tool descriptions; the "recorded for the Repliers team" sentence gated on Trello config.
13. Docs (this change): CLAUDE.md, KB article, agent-feedback status, S5 eval expectation.

### Verification — 2026-10-15

- `npm test`: **261 tests, 261 pass, 0 fail** (offline).
- Live stdio probe, random key: all 3 calls `isError=true`, payload leads with an `account` `_notice`
  whose `forUser` links https://login.repliers.com/dashboard/apikeys, `retry: false`, no `_feedback`.
- Live stdio probe, demo key: "pets + virtual tour" `Search_Listings` reports `unrecognized: []`;
  `get-address-listing-history` without `zip` returns `{ found: false, reason }` instead of an error.
- Pending: eval re-run (repairs to cards, duplicates collapsed, S5 relays `forUser` with no report, false
  api-error cards) and the manual ChatGPT check (no "Suspicious Instruction" card, no safety block).

### Final reviews — 2026-10-15

Code review (opus) and security review found no Critical issues. This wave fixed every finding:

- S1: refine-search lists only effective changes (a remove of an absent param or a same-value set is no change); at most 5 auto signals per session per hour; separate 20/hour breaker budgets for error and parse signals (this replaces design.md §6.3's single breaker).
- S2: caller text on cards is single-line inline code (backticks → `'`, `@` → `＠`), the prompt is capped at 500 characters, URLs are normalised, and a repairsNlpId counts only if it is a plain id.
- S3/H3: the key (verbatim, URL-encoded, JSON-escaped) is scrubbed from raw inputs before any cut, and from failures before classification; the post-build redact is kept.
- S4: error cards carry path + sorted parameter names only; bodies only for Search_Listings / refine-search (design.md §6.4).
- H1: a throw escaping a tool is a `request` error and is not captured.
- H2/F6: errorMessage is capped at 1000 characters; feature text names the first path segment only; the summary message is capped at 200.
- F1: the instructions headline has no "→ report it" step in either branch.
- F2: KB article and CLAUDE.md describe v2 capture and its Trello gate.
- F3: generated tools treat a 2xx with an empty body as `{ ok: true }` and a non-JSON body as text (39 tools regenerated).
- F4: needs-board matches within one error entry and hands on the API's message.
- F5: upstream errors on non-idempotent tools (create/send) give `retry: false` and warn that a repeat could duplicate the call.
- F7: removed presentation params stay out of refine keys and lines.
- F8: send-feedback says "Repliers service errors".
- F9: the restored comment in test/serverInstructions.test.js.

`npm test`: **289 tests, 289 pass, 0 fail**.

### Owner change 2026-10-15 (B + D)

Refine-search auto-reporting would flood Trello, so:

- **B, separate list.** Auto cards go to `TRELLO_AUTO_LIST_ID` (`createCard(card, { listId })`). `autoCaptureConfigured()` = dry-run, or the two Trello keys + the auto list. The reporter, the "recorded for the Repliers team" tool text, the send-feedback "recorded automatically" sentence, rule 3's automatic-recording sentence and the `recorded` note all follow it. Trello configured without the auto list: capture is off, `run()` logs one `[CONFIG]` line, `send-feedback` still works (gated on `trelloConfigured()`).
- **D, deterministic defects only.** Captured: `unrecognized` on Search_Listings and `upstream` / `nlp-scope` errors. Removed: the refine and restated signals, `repairsNlpId` (schema, description, capture), and the session search memory (`remember`, `session.searches`). `createSessionState()` keeps the per-session quota. Redaction, quoting, quotas and the two breaker budgets are unchanged.
- **Parse corrections are offered.** After a refine-search call that changed a non-presentation constraint, `_feedback` carries a `refined` signal naming the changed parameters and saying `send-feedback` (nlp-misparse, missedConstraints) can report it if the user agrees. Instructions rule 3 and the send-feedback description say the same; rule 2 lost the `repairsNlpId` clause.
- **Flag `FEEDBACK_AUTO_CAPTURE` = `narrow` (default, unknown values too) | `full`.** `full` restores the pre-change behaviour behind the flag: refine and restated signals, session search memory, `repairsNlpId` on Search_Listings, the `recorded` note after a refine, and the old instruction/tool wording. B applies in both modes; all hardening applies in both. Covered by `test/autoCaptureFull.test.js`, per-mode instruction tests, and the tone lint across mode x Trello state.
- Docs: design.md §6.2/§6.3/§6.5/§6.6, CLAUDE.md env table, KB article.

`npm test`: **327 tests, 327 pass, 0 fail**.

## Prerequisite done (committed as 7cc51ca): OpenAPI sync — 2026-10-14

[design.md §9](./design.md#9-prerequisite--openapi-sync-separate-bounded-task). It had to land before
capture of `unrecognized` parameters, or the server would file false cards for valid parameters.

- `npm run sync-spec` (`scripts/sync-spec.mjs`) fetches `bundled_docs/repliers.json` at the commit
  pinned in `codegen/config.js` → `upstreamSpec` (`be440f9`, 2026-10-08) and refuses anything that is
  not an OpenAPI document with POST /listings parameters. `openapi.json` is now byte-identical to it.
- `codegen/refs.js`: `$ref` segments are percent-decoded before JSON-pointer unescaping. Restores the
  location-type and source enums on `autocomplete-location-search` and `search-locations`
  (they were `items: {}`, which let an agent pass `type: street` — tizUYBN5).
- Array query params are generated as `[args.x].flat()`: the new spec turned 11 params from string
  into array, and ChatGPT keeps the old schemas until the connector is rescanned.
- The 8 new upstream operations are excluded in `codegen/config.js` pending the roster-size decision.
  No existing tool was added, removed or renamed; 28 generated files changed (new params, enums,
  required-sets — `create-estimate` now requires `address`+`details`, `send-message` `content`;
  `get-address-listing-history` no longer requires the address parts).
- Hardened after the code-reviewer pass (verdict: approve with nits): an unresolvable `$ref` now
  throws instead of becoming `{}`; `sync-spec` refuses nameless POST /listings params and any
  unresolvable or non-local `$ref`, has a fetch timeout, and prints operations and listings params
  added/removed; array **body** properties wrap a scalar too (null passes through — it clears a field
  on PATCH); null query params are omitted instead of sent as `"null"`; dead `locations`/`buildings`
  entries removed from config and overrides; override text fixed (`search-locations` takes `name[]`,
  not `search`; `content` and `details` marked required). The reviewer's pre-existing finding about
  the required-param check is in [design.md §5.6](./design.md#56-missing-required-parameters).
- Verified on 2026-10-14 (at that point): `npm test` 181/181; live through the stdio server, the "pets + virtual tour" search now
  reports `unrecognized: []` (was `["pets","hasVirtualTour"]`); scalar and array `type` both reach
  autocomplete. `get-address-listing-history` without `zip` now reaches the API and gets the empty-body
  404 that §5 turns into `not-found`.

## Baseline

Measured 2026-10-12 on current code, recorded in [design.md §3](./design.md#3-measured-baseline-2026-10-12).
Raw runs in `mcp-eval/runs/2026-10-12-gpt-5.6-sol-medium-controlled{,-part2,-always-ask}`. The first
attempt of that run failed on an expired eval login (`…-authfail`, not a result); the eval
`CODEX_HOME` login was refreshed from `~/.codex/auth.json`, previous copy kept as
`mcp-eval/.codex-eval/auth.json.bak-2026-09-17`.

Card nLD4VjI9 did **not** reproduce on the Codex harness in either consent mode; v2 removes the step
the model skipped rather than relying on a reproduction.

## Open questions

See [design.md §13](./design.md#13-open-questions): entitlement-error body, OpenAI-key 401 body and
where that key lives, a real-ChatGPT long-session reproduction, and who runs the manual ChatGPT check.
