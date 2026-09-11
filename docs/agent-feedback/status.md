# Agent Feedback — Status & Resume Point

**Updated:** 2026-09-11
**Branch:** `feat/agent-feedback` (pushed to origin; unit suite 164/164 green via `npm test` on 2026-09-11)

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

Run 4 (2026-08-29): shipped three instruction fixes — role sentence, SCOPE boundary, and required parameters in the send-feedback description. **The SCOPE fix works on both tiers** (Sonnet's W11 fabrication is gone; Haiku now cites the real data scope), closing run 2's only FAIL. **The role fix is only partial**: Haiku decodes real-estate shorthand now but still answers W12 as "software engineering tasks in this repo" — MCP instructions carry facts about the data but do not override the host harness's persona on a weak model. On a realtor-facing surface the HOST must set the persona.

Resume point: (1) decide whether anything further is warranted for the persona limit (host-side, not server-side) (an explicit "listings/locations/stats only" clause in the server instructions vs. accepting harness-dependent behaviour) and hand the five defects above to Repliers, (2) second consecutive all-PASS Fable core run on the current wording → acceptance, (3) real-Trello A4 before merge, (4) report the discovered upstream API bug (parking/lockers leak through minBeds) to Repliers.

## ChatGPT / Codex track (opened 2026-09-11)

Harness: **Codex CLI 0.153.4**, headless `codex exec --json`, one cold session per query,
`codex exec resume` for the ↩ chains. Runner: `scripts/eval-codex.mjs`; prompts:
`scripts/eval-batteries/core.json` (core 15 = B1, B2, B10 · L1 · W3, W11, W12 · M1–M5 · S2,
S4-low, S5; L1 doubles as S1 and B10 as S4). Model matrix agreed with the owner:
`gpt-6-astra` at low **and** high effort, `gpt-5.6-sol` and `gpt-5.5` at medium. Server env
matches the Claude columns — `FEEDBACK_DRY_RUN=true`, `FEEDBACK_CONSENT=auto`,
`FEEDBACK_PROMPT_LEVEL=high` — because under `always-ask` (what `.env` currently carries) S5
inverts: reporting an api-error without asking becomes a FAIL instead of the PASS criterion.

**Finding before a single graded query — the Codex harness competes with the MCP server, and how
hard depends on the tier.** Tools are deferred behind Codex's `tool_search` (hardwired, no
toggle), which is survivable: models do find them. Built-in web search is the real competitor.
`condos for sale in Toronto` on `gpt-5.6-sol` was answered from realtor.ca with **zero** MCP
calls on two separate runs against a verified-healthy server; the same model and prompt with
`-c tools.web_search=false` made 12 MCP calls and independently re-found the `type=sale` upstream
defect (NLP drops the sale filter) through verify → `refine-search` → `send-feedback`. But
`gpt-6-astra` at high effort chose the MCP server on that prompt **with web search still
available**. Hence two profiles per model — `baseline` (real `~/.codex`) and `controlled`
(isolated `CODEX_HOME`, web off, realtor persona in `AGENTS.md`) — with the delta reported as the
harness's contribution, expected widest at the weak end. Details and commands:
[query-battery.md](./query-battery.md) §"Codex CLI: two profiles".

**Run 6 (2026-09-11, `gpt-6-astra`/high, 7 queries — runner-validation smoke, graded):** 6 ✅ /
1 🟡, full entry in [query-battery-results.md](./query-battery-results.md). Group M is clean on
this tier (no city bleed, asked which Rosedale instead of guessing) — the opposite of run 3's
weak-tier headline. **The one gap is reporting: 3 `refine-search` calls, 0 `send-feedback`, no
card written.** Not a delivery failure — the `refined` note arrives first in the payload with the
mandatory wording, `send-feedback` is in the roster, consent is `auto`; the model repairs,
presents, and skips the report. `gpt-5.6-sol` *did* report in the same situation, so this is not
a family trait yet. Decide after the weak tier whether the answer is wording, an annotation, or
accepting reporting as strong-tier behaviour. Cost to watch: 75k input tokens for a one-call
query, 182k for L1 (150k cached) — the deferred tool registry is pulled in per session.

**Run 7 (2026-09-11, `gpt-5.5`/medium, full core, both profiles): controlled 15 ✅, baseline
14 ✅ / 1 ❌.** The oldest model in the matrix is the strongest column so far — it reported every
repair (9 cards per profile, 1:1 with `refine-search`), kept Group M clean, and refused W11/W12.
**This inverts run 6's conclusion:** skipping the mandatory report is specific to
`gpt-6-astra`/high, not a weak-tier trait. Re-test astra at **low** effort before treating it as
a product problem.

**Mechanism finding that outgrew the eval — Codex delivers tools through a searchable JS registry,
and our `instructions` are what breaks it.** Codex composes every registry entry as
`[server instructions] + [our description] + [TS declaration]`, so the 2303-char `instructions`
we send **once** are duplicated across all 45 tools (~103 KB). The model's own filtered query came
back at 41,935 tokens, was truncated by the sandbox, and yielded **9 of 45 tools**;
`send-feedback` was missing from the visible slice in 2 of 4 sessions. And a question that needs
no tools never loads the registry at all: W11 made zero loads in both profiles, so the SCOPE rule
never arrived — `controlled` refused only thanks to its two-sentence `AGENTS.md`, `baseline`
web-searched and quoted mortgage rates. Details: [query-battery.md](./query-battery.md) §"Why
`instructed` exists".

Two things shipped from that: a third runner profile, `instructed`, which puts the server's own
generated instructions into `AGENTS.md` up front (the ChatGPT connector's instruction box,
emulated), and `scripts/print-instructions.mjs`, which prints that same text for pasting into such
a field so the channels cannot drift. A one-query probe already shows the trade-off: under
`instructed`, B10 — the no-spam baseline — turned into a repair plus a card for `status=A` not
being explicit. **Open question for the next run: does host-level delivery buy more than it costs
in over-reporting?**

**Runs 8 and 9 answered the open question: host-level delivery fixes both ChatGPT-column failures,
and costs nothing.**

- **Run 8** (`gpt-5.5` medium, `instructed`): 15 ✅, same as its controlled column, with **17% fewer
  input tokens** (2,054k vs 2,488k) and one fewer card. The instructions did not cause more
  reporting — they caused fewer defects to report: with the golden rules in context the model wrote
  `condos in Willowdale under 700k **for sale**` instead of `condos in Willowdale under 700k`, and
  the parser stopped dropping `type=sale`. The over-reporting seen in a one-query probe did not
  reproduce.
- **Run 9** (`gpt-6-astra` high, `instructed`): 15 ✅ and **9 cards — every repair reported**, against
  run 6's 3 repairs / 0 reports on the same byte-identical instruction text. The variable is where
  the text is delivered, not how it is worded.

**What this means for the product:** on a surface that exposes MCP tools through a searchable
registry (ChatGPT/Codex code mode), the `instructions` we return from `initialize` are the wrong
channel — duplicated onto all 45 tool entries, truncated, and never loaded at all for a question
that needs no tool. The connector's own instruction field is where this text belongs.
`scripts/print-instructions.mjs` emits it, gated correctly for Trello-less deployments.

**Next: the tool descriptions themselves.** Run 9 produced a false-positive `api-error` card
claiming our schema does not cap `resultsPerPage` — it does (`maximum: 10`), but Codex shows the
model TypeScript, and `minimum`/`maximum`/`default`/`format` do not survive that projection
(`enum`, required-vs-optional, nested shapes and descriptions do). **Any bound or default we rely on
has to be in the description prose.** That, plus trimming the 45-tool roster for consumer surfaces,
is the remaining half of the truncation problem.

Resume point for this track: (1) tool-description pass per the table in
[query-battery-results.md](./query-battery-results.md) run 9; (2) `gpt-6-astra` at **low** effort, to
check whether effort alone changes reporting without the instructions; (3) `gpt-5.6-sol`, the only
model observed preferring web search over the MCP server; (4) make `send-feedback`'s result a
user-safe acknowledgement — three answers relayed the `dryRun` flag to the end user verbatim.

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
