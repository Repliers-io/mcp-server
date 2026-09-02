# Trello live delivery — verification procedure (test-plan A4, expanded)

**Purpose:** prove that a real feedback report reaches a real Trello board, in the shape the
triage team expects, through the real transport an agent uses. This is the one check
`FEEDBACK_DRY_RUN` cannot cover, and it gates the merge of `feat/agent-feedback`.

**Status:** not yet run. Log results in §Results at the bottom.

**Scope:** T1–T8 below. T1–T5 are mechanical (no LLM). T6 is one cold agent session. T7 is the
negative gate. T8 is cleanup.

---

## Phase 0 — Credentials and board (owner action, ~10 min)

The three values go into `.env`. Nothing else in this document can run without them.

> **This sink is shared.** `lib/feedbackCard.js` and `lib/trello.js` are a port of tasks B2/B3 of
> `portal-monorepo/docs/superpowers/plans/2026-07-14-ai-chat-feedback.md` — same `buildFeedbackCard`
> name, same 16 384-char cap, same env trio. The portal backend posts **human** feedback (👍/👎 from
> AI Chat) to the same Trello board; this server posts **agent** feedback. The `[MCP]` prefix in the
> card name is the only thing separating the two streams in one list — treat it as load-bearing.
> If the portal's feedback is live in production, its cards (which embed a whole chat transcript)
> already prove the query-string transport survives large descriptions — see T3.

- [ ] **0.1 Board and list.** Use the existing **`NLP Feedback Reporting`** board, but create a
  dedicated list on it — `MCP test` — and point the run at that. T1/T3/T5 create junk and oversized
  cards on purpose; they must not land in the triage list. After acceptance, switching to the real
  list is one line in `.env`.

- [ ] **0.2 API key.** If `portal-backend/.env` already carries `TRELLO_API_KEY` /
  `TRELLO_API_TOKEN` (task B2 of the plan above defined them), **reuse those values** — same
  account, same board, nothing to issue. Otherwise: https://trello.com/apps/admin → create a
  Power-Up → **API Key** tab → generate. This is `TRELLO_API_KEY`.

- [ ] **0.3 Token.** On the same page follow the manual token link, or open:

```
https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=Repliers%20MCP&key=<API_KEY>
```

  Approve → the page shows the token. This is `TRELLO_API_TOKEN`. `write` scope is required to
  create cards; `read` is required by T2 (reading the card back) — a reused portal token was issued
  for writing, so if T2 comes back `401 invalid token` while T1 succeeded, the token lacks `read`
  and must be reissued with `scope=read,write`.

- [ ] **0.4 List ID.** With the key and token in hand:

```sh
curl -s "https://api.trello.com/1/boards/<boardShortLink>/lists?key=<KEY>&token=<TOKEN>" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>JSON.parse(s).forEach(l=>console.log(l.id,l.name)))"
```

  `<boardShortLink>` is the segment in the board URL: `https://trello.com/b/<shortLink>/<name>`.
  The 24-hex id of the `Inbox` row is `TRELLO_LIST_ID`.

**PASS 0:** three values collected, none of them pasted into a file that is not `.env`
(`.env` is gitignored — verify with `git check-ignore -v .env`).

---

## Phase 1 — Credentials work, before the server is involved

Isolating auth from server behaviour first means a later failure has exactly one possible cause.

- [ ] **1.1 Token identity + list reachable.**

```sh
curl -s "https://api.trello.com/1/members/me?key=$K&token=$T" | head -c 200; echo
curl -s "https://api.trello.com/1/lists/$L?key=$K&token=$T" | head -c 200; echo
```

**PASS 1:** first call returns a member object (not `invalid key`/`invalid token`); second returns
the list object with the expected `name` and `idBoard`. A `401`/`invalid token` here means the
token was created without `write` scope or for a different key — redo 0.3.

---

## Phase 2 — Switch the server to real delivery

- [ ] **2.1 Kill the stale listener.** A month-old instance silently invalidated an earlier run;
  one is running right now (started 2026-08-31 19:09).

```sh
netstat -ano | grep ":3001" | head -3
powershell.exe -NoProfile -Command "Stop-Process -Id <PID> -Force"
```

- [ ] **2.2 Edit `.env`** — add the three Trello vars and **turn dry-run off**:

```
REPLIERS_API_KEY=<unchanged>
FEEDBACK_PROMPT_LEVEL=high
FEEDBACK_DRY_RUN=false
TRELLO_API_KEY=<KEY>
TRELLO_API_TOKEN=<TOKEN>
TRELLO_LIST_ID=<LIST_ID>
```

  Leave `FEEDBACK_CONSENT` unset — `auto` is the shipped default and the mode A4 describes.

- [ ] **2.3 Restart and confirm the mode.**

```sh
node mcpServer.js --http
```

**PASS 2:** server starts (no `does not provide an export named` error — see the HEAD note below),
and the sanity check below prints `dryRun false / configured true`:

```sh
node -e "import('dotenv').then(d=>{d.default.config();return import('./lib/trello.js')}).then(t=>console.log('dryRun',process.env.FEEDBACK_DRY_RUN==='true','/ configured',t.trelloConfigured()))"
```

> **Blocker if it fails:** HEAD currently does not load — `lib/serverInstructions.js` imports
> `consentMode` from `lib/feedbackHints.js`, which is only exported in the uncommitted working
> tree. Run this procedure on the working tree, or commit the consent change first.

---

## Phase 3 — T1: the A4 card (direct tool call)

The canonical A4 row from [test-plan.md](./test-plan.md), executed against the tool function
itself so a failure points at `createCard`, not at the transport.

- [ ] **3.1 Send it.**

```sh
node -e "
import('dotenv').then(d=>{d.default.config();return import('./tools/repliers/repliers-api/custom/send-feedback.js')}).then(async m=>{
  const r = await m.apiTool.function({
    category: 'nlp-misparse',
    summary: 'test card — ignore',
    userQuery: 'test',
    missedConstraints: [{ constraint: 'maxPrice', requested: '500000', applied: 'none' }],
  });
  console.log(JSON.stringify(r, null, 2));
})"
```

**PASS T1:**
- result is `{ url: 'https://api.trello.com/1/cards', data: { ok: true, cardUrl: 'https://trello.com/c/...' } }`;
- `data.dryRun` is **absent** (its presence means dry-run is still on — go back to 2.2);
- the card exists in the `Inbox` list, titled `[MCP] 🧩 test card — ignore` — with the emoji
  rendered, not `??` or mojibake;
- description contains the **Category / Summary / User query** lines and a `Missed constraints`
  bullet reading ``- maxPrice: requested `500000` → applied `none` ``;
- `feedback-cards.log` gained **no** new entry (real mode must not also write the dry-run log).

---

## Phase 4 — T2: card fidelity (what the triage team actually receives)

- [ ] **4.1 Read the card back and diff it against what the formatter produced.**

```sh
node -e "
import('dotenv').then(d=>{d.default.config();return Promise.all([import('./lib/feedbackCard.js'),Promise.resolve()])}).then(async ([fc])=>{
  const expected = fc.buildFeedbackCard({
    category:'nlp-misparse', summary:'test card — ignore', userQuery:'test',
    missedConstraints:[{constraint:'maxPrice',requested:'500000',applied:'none'}],
  });
  const id = '<cardShortLink from T1>';
  const u = new URL('https://api.trello.com/1/cards/'+id);
  u.searchParams.set('key',process.env.TRELLO_API_KEY); u.searchParams.set('token',process.env.TRELLO_API_TOKEN);
  const card = await (await fetch(u)).json();
  console.log('name match:', card.name === expected.name);
  // the timestamp line differs by construction — compare everything above it
  const strip = s => s.split('_Reported')[0];
  console.log('desc match:', strip(card.desc) === strip(expected.desc));
  console.log('--- trello desc ---\n'+card.desc);
})"
```

**PASS T2:** `name match: true`, `desc match: true`. A mismatch in `desc` that is only whitespace
or escaping is still a FAIL to investigate — Markdown that Trello re-encodes changes what the
triage team reads.

- [ ] **4.2 Coexistence check.** Open the board and look at an MCP card next to a portal AI-Chat
  card. **PASS:** the `[MCP]` prefix makes the source obvious at a glance in the list view, and the
  two body layouts (Rating/Comment/Transcript vs Category/Summary/Missed constraints) are both
  legible without opening the card. This is the only check that the shared-sink decision holds.

---

## Phase 5 — T3: an oversized, realistic card (the untested path)

`buildFeedbackCard` caps `desc` at 16 384 chars, and `createCard` sends it as a **URL query
parameter**. Dry-run never exercised that. Long URLs are a routine 414/400 source.

The portal backend inherits the same transport and embeds a full chat transcript in `desc`, so it
hits the cap far more often than this server will. **Check first whether portal feedback is live in
production:** if it is, large cards are already proven in the field and T3 is a formality. If it is
not, T3 is the only place this path gets exercised for either codebase — and a failure here is a
defect to file against both.

- [ ] **5.1 Send a card with a `toolCalls` blob that reaches the cap.**

```sh
node -e "
import('dotenv').then(d=>{d.default.config();return import('./tools/repliers/repliers-api/custom/send-feedback.js')}).then(async m=>{
  const filler = 'x'.repeat(400);
  const toolCalls = Array.from({length: 40}, (_,i) => ({
    tool: 'Search_Listings', params: { prompt: 'condos in Mississauga under 600k '+i },
    resultSummary: filler,
  }));
  const r = await m.apiTool.function({
    category:'nlp-misparse', summary:'test card — oversized payload, ignore',
    userQuery:'test', toolCalls,
  });
  console.log(JSON.stringify(r, null, 2));
})"
```

**PASS T3:** `ok: true` and the card opens in Trello with the JSON block present (truncation at
16 384 chars is expected and acceptable — silent loss of the card is not).
**If it FAILS** (`Trello responded 414` / `400`): that is a real defect, not a test artifact — the
fix is to move `name`/`desc` from the query string into a POST body in
[lib/trello.js](../../lib/trello.js), and a regression test for the cap belongs in
`test/trello.test.js`. File it before merge.

---

## Phase 6 — T4: the failure path an agent will actually hit

- [ ] **6.1 Break the token deliberately and call again.**

```sh
node -e "
import('dotenv').then(d=>{d.default.config();process.env.TRELLO_API_TOKEN='deadbeef';return import('./tools/repliers/repliers-api/custom/send-feedback.js')}).then(async m=>{
  const r = await m.apiTool.function({category:'api-error',summary:'auth failure probe',userQuery:'test'});
  console.log(JSON.stringify(r, null, 2));
})"
```

**PASS T4:**
- result is `{ data: { ok: false, error: 'Trello responded 401' } }` — the tool returns a value, it
  does not throw (a throw would surface to the agent as a tool error and could trigger an
  `api-error` report about the feedback channel itself);
- **no credential appears anywhere in the result** — grep the printed JSON for the first 8 chars of
  the real key and token; both must be absent. `createCard` puts them in the request URL, so this
  is the one place a leak could reach an LLM transcript.

- [ ] **6.2 Invalid category** (guard before any network call):

```sh
node -e "import('dotenv').then(d=>{d.default.config();return import('./tools/repliers/repliers-api/custom/send-feedback.js')}).then(async m=>console.log(await m.apiTool.function({category:'banana',summary:'s',userQuery:'q'})))"
```

**PASS 6.2:** `{ error: 'category must be one of: …' }`, and no card appears in Trello.

---

## Phase 7 — T5: through the MCP transport, as a client sees it

T1–T4 bypass the server. This one goes through `initialize` → `tools/call` on `:3001`, which is
what any real agent does.

- [ ] **7.1 Save the driver** to the scratchpad as `mcp-call.mjs`:

```js
const ENDPOINT = "http://localhost:3001/mcp";
const HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream" };
const parse = async (res) => {
  const text = await res.text();
  // the transport may answer as SSE; take the last data: line
  const line = text.includes("data:") ? text.split("\n").filter(l => l.startsWith("data:")).pop().slice(5) : text;
  return JSON.parse(line);
};
const init = await fetch(ENDPOINT, { method: "POST", headers: HEADERS, body: JSON.stringify({
  jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "a4-check", version: "1" } },
})});
const sid = init.headers.get("mcp-session-id");
console.log("session:", sid);
console.log("instructions mention send-feedback:", JSON.stringify(await parse(init)).includes("send-feedback"));
const H = { ...HEADERS, "mcp-session-id": sid };
await fetch(ENDPOINT, { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });

const list = await parse(await fetch(ENDPOINT, { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) }));
const names = list.result.tools.map(t => t.name);
console.log("tools:", names.length, "| send-feedback present:", names.includes("send-feedback"));

const call = await parse(await fetch(ENDPOINT, { method: "POST", headers: H, body: JSON.stringify({
  jsonrpc: "2.0", id: 3, method: "tools/call",
  params: { name: "send-feedback", arguments: {
    category: "nlp-misparse", summary: "test card — over MCP transport, ignore", userQuery: "test",
    missedConstraints: [{ constraint: "city", requested: "Mississauga", applied: "none" }],
  }},
})}));
console.log(JSON.stringify(call.result, null, 2));
```

- [ ] **7.2 Run it:** `node <scratchpad>/mcp-call.mjs`

**PASS T5:** session id returned; `send-feedback present: true`; roster is 45 tools; the call
result contains `"ok": true` and a `cardUrl`; a third card appears in `Inbox`.

---

## Phase 8 — T6: agent-driven, cold session (the end-to-end that matters)

Everything above proves the plumbing. This proves an agent reaches for it unprompted and the card
that lands is legible to a human triager.

- [ ] **8.1** From `C:/Users/dark/Documents/repliers/mcp-eval`, one cold session on the primary
  model, using the S1-style prompt that reliably produces a misparse:

```sh
claude -p --allowedTools "mcp__repliers-local" "find me listings with 5+ bedrooms in Miami"
```

  **The `--allowedTools` flag is required.** `mcp-eval/.claude/settings.local.json` enables the
  server but grants no tool permissions, and a headless session has no way to approve them: every
  call fails with `permission not granted` and the run dies before the first search. Naming the
  server also keeps the agent off the hosted `claude.ai Repliers MCP` connector, which points at a
  different deployment and would make the card land somewhere else — or nowhere.

**PASS T6:**
- the agent verifies `appliedFilters`, discovers the dropped location, repairs or explains, and
  calls `send-feedback` **without being asked**;
- the card in Trello carries a real `summary` (not a placeholder), the user's actual query, and a
  `Missed constraints` row naming the location;
- the agent tells the user a report was sent;
- exactly one card per real problem — no duplicate spam.

- [ ] **8.2** Repeat once with a control query that must produce **no** card.

  **Do not pick the control query by intuition — screen it first.** Run 1 burned three candidates
  this way, and the parser broke all three (city dropped; `propertyType` dropped; `minBathrooms`
  rejected outright), so each run produced a legitimate card and the guard was never exercised.
  Assume no query parses cleanly until proven otherwise.

  Screen a candidate mechanically before spending an agent session on it — call `Search_Listings`
  through the transport driver from 7.1 and read `appliedFilters` plus `unrecognizedParams` yourself:

```sh
node <scratchpad>/mcp-call.mjs   # with the tools/call params swapped for Search_Listings
```

  A candidate qualifies as a control only when every constraint the user stated appears in
  `appliedFilters`, `unrecognizedParams` is empty, and `type` is set if the phrasing implies a
  purchase. Then hand that exact prompt to a cold agent.

  **PASS:** no card is created. Prefer a screened query that names no location: the absent location
  makes the `no-location-filter` nudge fire, so the agent is actively pushed to report while the
  user named no place at all — precisely the false positive the guard exists to prevent.

---

## Phase 9 — T7: the negative gate

- [ ] **9.1** Comment out all three `TRELLO_*` vars, keep `FEEDBACK_DRY_RUN=false`, restart, and
  re-run the T5 driver (steps 7.1–7.2, stopping after `tools/list`).

**PASS T7:** roster is 44 tools, `send-feedback present: false`, and the `initialize`
instructions contain zero occurrences of `send-feedback`. This is the promise the project must
never break: no channel advertised that goes nowhere.

---

## Phase 10 — T8: restore and record

- [ ] **10.1** Archive the T1/T3/T5/T6 test cards in Trello (or delete the throwaway board).
- [ ] **10.2** Restore `.env` to the eval configuration: `FEEDBACK_DRY_RUN=true`, Trello vars
  removed or kept — dry-run wins either way, which is exactly why 2.2 exists.
- [ ] **10.3** Restart the server and confirm `dryRun true`.
- [ ] **10.4** Record the outcome in §Results below and in
  [status.md](./status.md) (A4 is a merge gate — it must show as done there, not only here).
- [ ] **10.5** Commit:

```sh
git add docs/agent-feedback/trello-live-check.md docs/agent-feedback/status.md
```

> `docs: log the real-Trello delivery check (A4) and its procedure`

---

## Results

### Run 1 — 2026-09-02, board `Repliers NLP & MCP`, list `MCP test`

Credentials: the Power-Up API key was recovered from `portal-backend/1.env` (a scratch note holding
the key and the Power-Up **secret** — the secret is not a token, only the key was reusable); the
token was issued fresh with `scope=read,write`. The board named in planning
(`NLP Feedback Reporting`) does not exist under this account — not open, not closed, not in any of
the three workspaces, and search returns nothing. Cards went to a dedicated `MCP test` list created
on `Repliers NLP & MCP`, whose working columns are the production destination.

| Check | Verdict | Evidence |
|---|---|---|
| Phase 1 credentials | ✅ | authenticated as `alexstrelets`; list reachable |
| T1 A4 card | ✅ | `{ok:true, cardUrl:.../c/vuPdXNMt}`, no `dryRun` field, dry-run log did not grow |
| T2 fidelity | ✅ | `name match: true`, `desc match: true`, landed in `MCP test`; emoji and `—`/backticks intact |
| T2 4.2 coexistence | ⏭ | **not testable** — the portal has never posted: its `.env` carries no `TRELLO_*`, so `config.feedback.enabled` is false there. No human-feedback card exists to compare against |
| T3 oversized | ❌→✅ | **414 URI Too Long** at a 20.8 KB URL. Bisected: 8 210 B URL passes, 10 211 B fails — a ~8 KB server cap against a 16 KB `desc` limit. Fixed (below); re-run stores all 16 384 chars |
| T4 failure path | ✅ | `{ok:false, error:"Trello responded 401"}`, returned not thrown; key and token absent from the result; invalid category rejected before any network call |
| T5 over MCP | ✅ | session ok, instructions mention send-feedback, roster 45, card `.../c/p79wZriN` |
| T6 agent-driven | ✅ | card [`/c/eCjd3blo`](https://trello.com/c/eCjd3blo) filed unprompted, with `nlpId`, `missedConstraints` and `toolCalls`; agent told the user and refused to substitute general knowledge. First two attempts died on harness arguments, not on the server — see 8.1 |
| T6 8.2 no-spam | ⚠ **not testable** | three control queries tried, all three misparsed, three legitimate cards filed. `3 bedroom condos in Mississauga under 700k` → city, `type`, `status` all dropped. `3 bedroom houses under 900k` → `propertyType` and `type` dropped (84,665 results incl. vacant land). `condos under 500k with 2 bathrooms` → `minBathrooms` rejected by `/listings` as unrecognized, `type` dropped. **No clean control query could be constructed** — see below |
| T7 negative gate | ✅ | roster 44, `send-feedback` absent, zero mentions in instructions |

**Defect found and fixed — `createCard` sent the card in the URL.** `name` and `desc` were query
parameters, so any description past ~8 KB died with a 414 while `buildFeedbackCard` happily
produced up to 16 384 chars. Dry-run could never surface this: it returns before the fetch. The fix
moves `idList`/`name`/`desc` into a JSON body, leaving only `key`/`token` in the query
([lib/trello.js](../../lib/trello.js)); `test/trello.test.js` gained a regression test asserting a
16 KB description keeps the URL under 500 chars.

**The same defect exists in portal-backend.** Task B2 of
`portal-monorepo/docs/superpowers/plans/2026-07-14-ai-chat-feedback.md` specifies
`axios.post("https://api.trello.com/1/cards", null, { params })` — the identical query-string
transport, and its cards embed a whole chat transcript, so it would hit the cap far more often than
this server does. It has never run with credentials, so nobody has seen it fail yet. Worth porting
the same fix before that feature is switched on.
