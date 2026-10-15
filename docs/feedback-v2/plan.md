# Feedback v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make reporting independent of the model. The server records the failures it observes, gives every API error a reader-specific `_notice`, and the tool text contains nothing ChatGPT's safety layer reads as approval steering.

**Architecture:** Tool-call handling moves out of the closure in `mcpServer.js` into a testable `lib/toolCall.js`. Every tool returns failures as `{ url, error, status, body }`. `lib/apiErrors.js` classifies a failure by who can fix it, and `lib/autoReport.js` turns server-observable signals into deduplicated Trello cards. Text channels (descriptions, nudges, instructions) become neutral statements, and a roster-wide test enforces that.

**Tech Stack:** Node (version pinned in `.nvmrc`), ESM, `@modelcontextprotocol/sdk` 1.30.0, `node:test`. The global `fetch` is mocked in tests, and failure responses are built with the global `Response`.

**Spec:** [docs/feedback-v2/design.md](./design.md). Read it first; this plan argues from it. Prerequisite §9 (OpenAPI sync) is already done.

## Global Constraints

- English for all code, comments, docs and test names.
- The API host is written only in `lib/apiBase.js` (`apiBaseUrl()`); never hardcode it.
- Every mention of `send-feedback`, and every "recorded for the Repliers team" sentence, is gated on `trelloConfigured()`.
- `refine-search` never builds a query from scratch; it requires a prior `Search_Listings` `request.url`.
- `tools/repliers/repliers-api/generated/` is never edited by hand; change `codegen/` and run `npm run generate`.
- `npm test` stays fully offline. Mock `fetch`, and build failure responses with `new Response(body, { status })`.
- The owner commits. Each task ends by listing `git add` commands and a message. **Never run `git commit`.**
- When behaviour changes, `docs/feedback-v2/status.md` is updated in the same change.
- User-facing dashboard links are exactly `https://login.repliers.com/dashboard` and `https://login.repliers.com/dashboard/apikeys`.
- Auto-captured card names start with `[MCP·auto] `. Model-written cards keep `[MCP] `.

## Review Focus

1. **The customer's entitlement error arrives with an unexpected status.** Example: a 401 whose body says "does not have access". It must still classify as `account`/`feature`, not as a rejected key. Pinned in Task 2.
2. **Strict function calling sends `null` for omitted optional fields.** `repairsNlpId: null` must not produce a restated card. `boardId: null` must still trigger board resolution. Pinned in Tasks 6 and 8.
3. **Trello is slow or down.** A tool response must never wait on Trello. A failed card creation must not hide the defect for 24 h. Pinned in Tasks 6 and 9.
4. **Two identical signals in flight at once** (parallel tool calls) produce one card, not two. Pinned in Task 6.
5. **The caller's API key never appears in a card**, whatever the tool returned. Pinned in Task 9.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/apiRequest.js` (new) | How tools talk to the API: `userAgent`, `apiHeaders`, `readFailure`, `errorMessage` |
| `lib/apiErrors.js` (new) | `classifyError`: failure → `{ kind, reason, message, status, forUser?, forAgent, retry, capture }` |
| `lib/boardId.js` (new) | `boardsForMlsNumber`: which boards hold an MLS number, using the caller's key |
| `lib/autoReport.js` (new) | `createReporter` (dedup, comments, circuit breaker), `captureSignals` (signal builders), process-wide `reporter` |
| `lib/toolCall.js` (new) | `callTool`, `createSessionState`: one tool call end to end |
| `lib/trello.js` | + `cardId` in `createCard` results, + `addComment` |
| `lib/feedbackHints.js` | Neutral notes; no `api-error`, `refined` or consent logic |
| `lib/serverInstructions.js` | Rule 2 mentions `repairsNlpId`, rule 3 rewritten, no consent logic |
| `mcpServer.js` | Handler delegates to `callTool`; per-session state; User-Agent from `getClientVersion()`; `FEEDBACK_CONSENT` notice |
| `codegen/generate.js`, `codegen/overrides.json` | Error contract and headers in the template; "see send-feedback" removed |
| `tools/.../custom/*.js` | Error contract and headers; neutral descriptions; `repairsNlpId`; `refine-search` returns `changed` |

---

### Task 1: `lib/apiRequest.js` — headers, User-Agent, reading failures

**Files:**
- Create: `lib/apiRequest.js`
- Test: `test/apiRequest.test.js`

**Interfaces:**
- Consumes: `SERVER_VERSION` from `lib/serverIdentity.js`
- Produces:
  - `userAgent(clientInfo?: {name?, version?}) → string`
  - `apiHeaders(args?: object, opts?: { json?: boolean, accept?: string|null }) → Record<string,string>`
  - `readFailure(response: Response) → Promise<{ status: number, body: any|null }>`
  - `errorMessage(body: any) → string`

- [ ] **Step 1: Write the failing test**

```js
// test/apiRequest.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { userAgent, apiHeaders, readFailure, errorMessage } from "../lib/apiRequest.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("User-Agent names this server, and the MCP client when it announced itself", () => {
  assert.equal(userAgent(), `repliers-mcp-server/${version}`);
  assert.equal(userAgent({ name: "ChatGPT", version: "1.2" }), `repliers-mcp-server/${version} (client ChatGPT/1.2)`);
  assert.equal(userAgent({ name: "codex" }), `repliers-mcp-server/${version} (client codex)`);
});

// clientInfo is client-controlled JSON; a header must not carry control characters or unbounded text.
test("client-controlled clientInfo is reduced to printable ASCII and capped at 64 characters", () => {
  const ua = userAgent({ name: "Evil\r\nX-Injected: 1" + "a".repeat(200), version: "1" });
  assert.doesNotMatch(ua, /[\r\n]/);
  const name = ua.match(/\(client (.*)\/1\)$/)[1];
  assert.ok(name.length <= 64, `name was ${name.length} chars`);
});

test("apiHeaders carries key, User-Agent, Accept, and Content-Type only for JSON bodies", () => {
  assert.deepEqual(apiHeaders({ _repliersApiKey: "k", _userAgent: "ua/1" }, { json: true }), {
    "REPLIERS-API-KEY": "k", "User-Agent": "ua/1", Accept: "application/json", "Content-Type": "application/json",
  });
  const noAccept = apiHeaders({ _repliersApiKey: "k" }, { accept: null });
  assert.equal(noAccept.Accept, undefined);
  assert.equal(noAccept["User-Agent"], `repliers-mcp-server/${version}`);
});

test("readFailure keeps the status and parses JSON, text, or nothing", async () => {
  assert.deepEqual(await readFailure(new Response('[{"msg":"Invalid API key"}]', { status: 401 })),
    { status: 401, body: [{ msg: "Invalid API key" }] });
  assert.deepEqual(await readFailure(new Response("", { status: 404 })), { status: 404, body: null });
  assert.deepEqual(await readFailure(new Response("<html>bad gateway</html>", { status: 502 })),
    { status: 502, body: "<html>bad gateway</html>" });
});

test("errorMessage flattens every error body shape the API uses", () => {
  assert.equal(errorMessage([{ msg: "Invalid API key" }]), "Invalid API key");
  assert.equal(errorMessage([{ param: "resultsPerPage", msg: "must be a number" }]), "resultsPerPage: must be a number");
  assert.equal(errorMessage({ request: { error: "Currently this NLP endpoint is designed to search listings only. " } }),
    "Currently this NLP endpoint is designed to search listings only.");
  assert.equal(errorMessage({ message: "Your account does not have access to this feature" }),
    "Your account does not have access to this feature");
  assert.equal(errorMessage(null), "");
  assert.equal(errorMessage("plain text"), "plain text");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/apiRequest.test.js`
Expected: FAIL with `Cannot find module '…/lib/apiRequest.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// lib/apiRequest.js
// How every tool talks to the Repliers API: request headers, and reading a failed response into
// the one error contract the server classifies — { status, body } (docs/feedback-v2/design.md §5.1).
import { SERVER_VERSION } from "./serverIdentity.js";

// clientInfo is client-controlled; only printable ASCII reaches a header, capped.
const headerSafe = (value) => String(value ?? "").replace(/[^\x20-\x7e]/g, "").trim().slice(0, 64);

export function userAgent(clientInfo) {
  const base = `repliers-mcp-server/${SERVER_VERSION}`;
  const name = headerSafe(clientInfo?.name);
  if (!name) return base;
  const version = headerSafe(clientInfo?.version);
  return `${base} (client ${version ? `${name}/${version}` : name})`;
}

export function apiHeaders(args = {}, { json = false, accept = "application/json" } = {}) {
  const headers = {
    "REPLIERS-API-KEY": args._repliersApiKey || process.env.REPLIERS_API_KEY,
    "User-Agent": args._userAgent || userAgent(),
  };
  if (accept) headers.Accept = accept;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

export async function readFailure(response) {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return { status: response.status, body: null };
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: text };
  }
}

export function errorMessage(body) {
  if (body == null) return "";
  if (typeof body === "string") return body.trim();
  if (Array.isArray(body)) {
    return body
      .map((entry) => (entry?.param ? `${entry.param}: ${entry.msg}` : entry?.msg ?? JSON.stringify(entry)))
      .join("; ");
  }
  const candidate = [body.request?.error, body.error, body.message, body.msg]
    .find((value) => typeof value === "string" && value.trim());
  return (candidate ?? JSON.stringify(body)).trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/apiRequest.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Stage for the owner**

```
git add lib/apiRequest.js test/apiRequest.test.js
# message: feat(api): shared request headers, User-Agent and failure reading
```

---

### Task 2: `lib/apiErrors.js` — classify a failure by who can fix it

**Files:**
- Create: `lib/apiErrors.js`
- Test: `test/apiErrors.test.js`

**Interfaces:**
- Consumes: `errorMessage` (Task 1)
- Produces: `classifyError({ toolName: string, url?: string, status?: number|null, body?: any, error?: string }) → { kind: "upstream"|"account"|"not-found"|"request"|"nlp-scope", reason: string, message: string, status: number|null|undefined, forUser?: string, forAgent: string, retry: boolean, capture: boolean }`
  - `status === undefined` means the tool rejected the input itself and no request was made.
  - `status === null` means a network failure or an exception.

- [ ] **Step 1: Write the failing test**

```js
// test/apiErrors.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyError } from "../lib/apiErrors.js";

const nlp = "https://api.repliers.io/nlp?nlpVersion=3";
const listing = "https://api.repliers.io/listings/N13549286";

// Bodies are the live shapes recorded on 2026-10-12 (design.md §3), plus the screenshot text of
// card 7EBCpT7L for the entitlement error.
const cases = [
  ["invalid Repliers key", { toolName: "get-listing", url: listing, status: 401, body: [{ msg: "Invalid API key" }] },
    { kind: "account", reason: "repliers-key", capture: false, retry: false }],
  ["OpenAI key behind NLP (HAZH3Bng)", { toolName: "Search_Listings", url: nlp, status: 401, body: { error: "Incorrect API key provided. code: invalid_api_key" } },
    { kind: "account", reason: "openai-key", capture: false, retry: false }],
  ["feature not in plan, 403", { toolName: "Search_Listings", url: nlp, status: 403, body: { message: "Your account does not have access to this feature" } },
    { kind: "account", reason: "feature", capture: false, retry: false }],
  ["feature not in plan, arriving as 401", { toolName: "Search_Listings", url: nlp, status: 401, body: { message: "Your account does not have access to this feature" } },
    { kind: "account", reason: "feature", capture: false, retry: false }],
  ["no history for this address", { toolName: "get-address-listing-history", url: "https://api.repliers.io/listings/history", status: 404, body: null },
    { kind: "not-found", reason: "not-found", capture: false, retry: false }],
  ["multi-board account", { toolName: "get-listing", url: listing, status: 400, body: [{ msg: "boardId is required" }] },
    { kind: "request", reason: "needs-board", capture: false, retry: true }],
  ["NLP non-listing intent", { toolName: "Search_Listings", url: nlp, status: 406, body: { request: { error: "Currently this NLP endpoint is designed to search listings only. " } } },
    { kind: "nlp-scope", reason: "nlp-scope", capture: true, retry: true }],
  ["validation", { toolName: "search-members", url: "https://api.repliers.io/members", status: 400, body: [{ param: "resultsPerPage", msg: "must be a number" }] },
    { kind: "request", reason: "validation", capture: false, retry: true }],
  ["server error", { toolName: "get-listing", url: listing, status: 502, body: "<html>bad gateway</html>" },
    { kind: "upstream", reason: "server", capture: true, retry: true }],
  ["network failure", { toolName: "get-listing", url: listing, status: null, body: null, error: "fetch failed" },
    { kind: "upstream", reason: "network", capture: true, retry: true }],
  ["tool rejected its own input", { toolName: "refine-search", status: undefined, error: "url must be a valid request.url from a previous Search_Listings response." },
    { kind: "request", reason: "input", capture: false, retry: true }],
  ["other 4xx from NLP", { toolName: "Search_Listings", url: nlp, status: 409, body: { message: "conflict" } },
    { kind: "upstream", reason: "nlp", capture: true, retry: true }],
  ["other 4xx elsewhere", { toolName: "get-listing", url: listing, status: 409, body: { message: "conflict" } },
    { kind: "request", reason: "other", capture: false, retry: true }],
];

for (const [name, input, want] of cases) {
  test(`classifies: ${name}`, () => {
    const got = classifyError(input);
    assert.deepEqual({ kind: got.kind, reason: got.reason, capture: got.capture, retry: got.retry }, want);
    assert.equal(typeof got.forAgent, "string");
  });
}

test("account errors carry a user-facing text with the right dashboard link; nothing else does", () => {
  const key = classifyError(cases[0][1]);
  assert.match(key.forUser, /https:\/\/login\.repliers\.com\/dashboard\/apikeys/);
  const feature = classifyError(cases[2][1]);
  assert.match(feature.forUser, /does not include natural-language listing search/);
  assert.match(feature.forUser, /https:\/\/login\.repliers\.com\/dashboard\b/);
  assert.equal(classifyError(cases[8][1]).forUser, undefined);
});

test("a feature error on a non-NLP tool names the endpoint path", () => {
  const got = classifyError({ toolName: "search-members", url: "https://api.repliers.io/members?x=1", status: 403, body: null });
  assert.match(got.forUser, /this API feature \(\/members\)/);
});

test("validation and input errors hand the agent the API's own words", () => {
  assert.match(classifyError(cases[7][1]).forAgent, /resultsPerPage: must be a number/);
  assert.match(classifyError(cases[10][1]).forAgent, /url must be a valid request\.url/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/apiErrors.test.js`
Expected: FAIL with `Cannot find module '…/lib/apiErrors.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// lib/apiErrors.js
// Classifies a failed call by who can fix it (docs/feedback-v2/design.md §5.2): the user's account
// admin (account), the agent (request, nlp-scope), nobody because it is an answer (not-found), or
// the Repliers team (upstream). Status first, text second — API messages are not a contract, so
// every pattern here is pinned by test/apiErrors.test.js on recorded bodies.
import { errorMessage } from "./apiRequest.js";

const DASHBOARD = "https://login.repliers.com/dashboard";
const NLP_TOOLS = new Set(["Search_Listings", "refine-search"]);

function feature(toolName, url) {
  if (NLP_TOOLS.has(toolName)) return "natural-language listing search";
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    // no usable url
  }
  return `this API feature (${path || toolName})`;
}

export function classifyError({ toolName, url, status, body, error }) {
  const message = errorMessage(body) || String(error ?? "").trim();
  const nlp = toolName === "Search_Listings";
  const base = { message, status };
  const make = (kind, reason, retry, capture, forAgent, forUser) =>
    ({ ...base, kind, reason, retry, capture, forAgent, ...(forUser && { forUser }) });

  if (status === undefined) {
    return make("request", "input", true, false, message || "The tool rejected its arguments.");
  }
  if (status === null || status >= 500) {
    return make("upstream", status === null ? "network" : "server", true, true,
      "A Repliers service error occurred; the same call may succeed later.");
  }
  if (status === 403 || /does not have access/i.test(message)) {
    return make("account", "feature", false, false,
      NLP_TOOLS.has(toolName)
        ? "Search_Listings and refine-search cannot run with this API key. Lookups by MLS number, locations and statistics may still work."
        : `${toolName} is not available with this API key.`,
      `This Repliers account does not include ${feature(toolName, url)}. The account administrator can request access from Repliers; account settings are in the Repliers dashboard: ${DASHBOARD}`);
  }
  if (status === 401) {
    if (nlp && /openai|invalid_api_key/i.test(message)) {
      return make("account", "openai-key", false, false,
        "Search_Listings cannot run until the account's OpenAI key is replaced. Tools that do not use natural language may still work.",
        `Natural-language search could not run because the OpenAI API key configured for this Repliers account was rejected. The account administrator can update it in the Repliers dashboard: ${DASHBOARD}`);
    }
    return make("account", "repliers-key", false, false,
      "Every call with this API key will fail until the key is replaced.",
      `The Repliers API key used by this connection was rejected. The account administrator can review API keys in the Repliers dashboard: ${DASHBOARD}/apikeys`);
  }
  if (status === 404) {
    return make("not-found", "not-found", false, false, "No record matches these parameters.");
  }
  if (/boardId.*required/i.test(message)) {
    return make("request", "needs-board", true, false,
      "This account covers several MLS boards and this call needs a boardId. Lookup_Possible_Values with aggregates=boardId lists the boards this key can see.");
  }
  if (nlp && status === 406) {
    return make("nlp-scope", "nlp-scope", true, true,
      "The NLP endpoint interprets listing searches only. A listing search returns a count; Market_Statistics returns aggregate figures.");
  }
  if (status === 400 || status === 422) {
    return make("request", "validation", true, false, `The API rejected the request: ${message || `HTTP ${status}`}.`);
  }
  if (nlp) {
    return make("upstream", "nlp", true, true,
      "The natural-language search service returned an error; the same call may succeed later.");
  }
  return make("request", "other", true, false, `The API rejected the request (${status}): ${message || "no detail given"}.`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/apiErrors.test.js`
Expected: PASS (16 tests).

- [ ] **Step 5: Stage for the owner**

```
git add lib/apiErrors.js test/apiErrors.test.js
# message: feat(errors): classify API failures by who can fix them
```

---

### Task 3: Error contract and User-Agent in generated tools

**Files:**
- Modify: `codegen/generate.js` (the template inside `generateToolFile`)
- Regenerate: `tools/repliers/repliers-api/generated/*.js` via `npm run generate`
- Test: `test/generatedErrorContract.test.js`

**Interfaces:**
- Consumes: `apiHeaders`, `readFailure`, `errorMessage` (Task 1)
- Produces: every generated tool returns `{ url, error, status, body }` on failure (`status: null, body: null` on a thrown error) and `{ url, data }` on success

- [ ] **Step 1: Write the failing test**

```js
// test/generatedErrorContract.test.js
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiTool } from "../tools/repliers/repliers-api/generated/get-listing.js";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

test("an HTTP failure keeps its status and parsed body", async () => {
  global.fetch = async () => new Response('[{"msg":"Invalid API key"}]', { status: 401 });
  const result = await apiTool.function({ mlsNumber: "N1", _repliersApiKey: "k" });
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, [{ msg: "Invalid API key" }]);
  assert.equal(result.error, "Invalid API key");
});

test("an empty-body 404 is still distinguishable from a network failure", async () => {
  global.fetch = async () => new Response("", { status: 404 });
  const notFound = await apiTool.function({ mlsNumber: "N1", _repliersApiKey: "k" });
  assert.equal(notFound.status, 404);
  assert.equal(notFound.body, null);

  global.fetch = async () => { throw new TypeError("fetch failed"); };
  const network = await apiTool.function({ mlsNumber: "N1", _repliersApiKey: "k" });
  assert.equal(network.status, null);
  assert.equal(network.error, "fetch failed");
});

test("requests carry the caller's key and User-Agent", async () => {
  let headers;
  global.fetch = async (url, init) => { headers = init.headers; return new Response("{}", { status: 200 }); };
  await apiTool.function({ mlsNumber: "N1", _repliersApiKey: "k1", _userAgent: "repliers-mcp-server/9 (client x/1)" });
  assert.equal(headers["REPLIERS-API-KEY"], "k1");
  assert.equal(headers["User-Agent"], "repliers-mcp-server/9 (client x/1)");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/generatedErrorContract.test.js`
Expected: FAIL. `result.status` is `undefined`, because today's template throws `new Error(JSON.stringify(err))` and returns only `error`.

- [ ] **Step 3: Change the template**

In `codegen/generate.js`, delete the `contentTypeHeader` line (`const contentTypeHeader = hasBody ? …`).

In the template string, replace:

```js
import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;
```

with:

```js
import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
```

Replace:

```js
      headers: {
        Accept: 'application/json',${contentTypeHeader}
        'REPLIERS-API-KEY': apiKey,
      }${fetchBody},
```

with:

```js
      headers: apiHeaders(args${hasBody ? ', { json: true }' : ''})${fetchBody},
```

Replace:

```js
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(JSON.stringify(err));
    }

    const data = await response.json();
    return { url: finalUrl, data };
  } catch (error) {
    return { url: finalUrl, error: error.message };
  }
```

with this text, written exactly so inside the template literal (the backslashes escape the inner backtick and `${`):

```js
    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return { url: finalUrl, error: errorMessage(body) || \`HTTP \${status}\`, status, body };
    }

    const data = await response.json();
    return { url: finalUrl, data };
  } catch (error) {
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
```

- [ ] **Step 4: Regenerate and run the tests**

Run: `npm run generate && node --test test/generatedErrorContract.test.js test/generatedArrayParams.test.js`
Expected: PASS. Then run `git diff --stat -- tools/repliers/repliers-api/generated/`. Every generated file changes, and no file is added or removed (`git status --short -- tools/` shows only ` M`).

- [ ] **Step 5: Stage for the owner**

```
git add codegen/generate.js test/generatedErrorContract.test.js tools/repliers/repliers-api/generated/
# message: feat(codegen): generated tools return status and body on failure, send User-Agent
```

---

### Task 4: Error contract and User-Agent in the custom tools

**Files:**
- Modify: `tools/repliers/repliers-api/custom/search-listings.js`, `refine-search.js`, `statistics.js`, `get-parameter-enumerations.js`, `get-listing-image.js`
- Test: `test/customErrorContract.test.js`, `test/refineSearchTool.test.js` (one new case)

**Interfaces:**
- Consumes: `apiHeaders`, `readFailure`, `errorMessage` (Task 1)
- Produces:
  - The same `{ url, error, status, body }` contract as Task 3.
  - `refine-search` success results gain `changed: { set: Record<string, unknown>, remove: string[] }`. Task 6 reads it. It sits beside `data`, so it is not serialized to the model.

- [ ] **Step 1: Write the failing tests**

```js
// test/customErrorContract.test.js
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiTool as search } from "../tools/repliers/repliers-api/custom/search-listings.js";
import { apiTool as refine } from "../tools/repliers/repliers-api/custom/refine-search.js";
import { apiTool as stats } from "../tools/repliers/repliers-api/custom/statistics.js";
import { apiTool as lookup } from "../tools/repliers/repliers-api/custom/get-parameter-enumerations.js";
import { apiTool as image } from "../tools/repliers/repliers-api/custom/get-listing-image.js";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

const calls = [
  ["Search_Listings", () => search.function({ prompt: "condos", _repliersApiKey: "k", _userAgent: "ua/1" })],
  ["refine-search", () => refine.function({ url: "https://api.repliers.io/listings?city=X", status: "A", _repliersApiKey: "k", _userAgent: "ua/1" })],
  ["Market_Statistics", () => stats.function({ _repliersApiKey: "k", _userAgent: "ua/1" })],
  ["Lookup_Possible_Values", () => lookup.function({ aggregates: "details.style", listings: false, _repliersApiKey: "k", _userAgent: "ua/1" })],
  ["Get_Listing_Image", () => image.function({ mlsNumber: "N1", _repliersApiKey: "k", _userAgent: "ua/1" })],
];

for (const [name, call] of calls) {
  test(`${name}: an HTTP failure keeps status and body, and the request carried the User-Agent`, async () => {
    let headers;
    global.fetch = async (url, init) => {
      headers = init.headers;
      return new Response('{"message":"Your account does not have access to this feature"}', { status: 403 });
    };
    const result = await call();
    assert.equal(result.status, 403);
    assert.deepEqual(result.body, { message: "Your account does not have access to this feature" });
    assert.equal(result.error, "Your account does not have access to this feature");
    assert.equal(headers["User-Agent"], "ua/1");
  });

  test(`${name}: a network failure is status null`, async () => {
    global.fetch = async () => { throw new TypeError("fetch failed"); };
    const result = await call();
    assert.equal(result.status, null);
  });
}
```

Append to `test/refineSearchTool.test.js`:

```js
// autoReport keys a refine correction on what was changed; it must not re-derive that from URLs.
test("a successful refine reports which parameters it set and removed", async () => {
  global.fetch = async () => new Response('{"count":1,"listings":[]}', { status: 200 });
  const result = await apiTool.function({
    url: "https://api.repliers.io/listings?class=condo&city=Toronto", status: "A", remove: ["class"], _repliersApiKey: "k",
  });
  assert.deepEqual(result.changed, { set: { status: "A" }, remove: ["class"] });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/customErrorContract.test.js test/refineSearchTool.test.js`
Expected: FAIL. `status` is `undefined` for all five tools, `User-Agent` is missing, and `result.changed` is `undefined`.

- [ ] **Step 3: Implement**

`search-listings.js`:
- Add `import { apiHeaders, readFailure, errorMessage } from "../../../../lib/apiRequest.js";`.
- Delete the `apiKey` line and the `headers` object.
- Use `headers: apiHeaders(args, { json: true })` in `fetch`.
- Replace the `!response.ok` block and the `catch` with:

```js
    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return { url: finalUrl, error: errorMessage(body) || `HTTP ${status}`, status, body };
    }
```

```js
  } catch (error) {
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
```

`refine-search.js`:
- Add the same import and delete the `apiKey` line.
- Use `headers: apiHeaders(args)`.
- Replace the `changed` computation, the fetch block and the catch with:

```js
  const set = Object.fromEntries(
    patchParams.filter((name) => args[name] !== undefined && args[name] !== null).map((name) => [name, args[name]])
  );
  const remove = (args.remove || []).filter((name) => removablePattern.test(name));
  const constraintPatch = [...Object.keys(set), ...remove].some((name) => !presentationParams.has(name));
  try {
    const response = await fetch(finalUrl, { headers: apiHeaders(args) });
    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return { url: finalUrl, error: errorMessage(body) || `HTTP ${status}`, status, body };
    }
    const data = await response.json();
    return {
      url: finalUrl,
      constraintPatch,
      changed: { set, remove },
      data: { appliedFilters: parseAppliedFilters(finalUrl, data.unrecognizedParams), ...data },
    };
  } catch (error) {
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
```

The two early `url must …` returns keep no `status`. That is deliberate: `status === undefined` is the "input" class in Task 2.

`statistics.js`:
- Add the import and delete the `apiKey` line.
- Replace the `// Set headers` block through the `Content-Type` `if` with:

```js
    const hasBodyParams = Object.keys(bodyParams).length > 0;
    const headers = apiHeaders(args, { json: hasBodyParams });
```

- Replace the `!response.ok` return and the catch return with:

```js
    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return { url: finalUrl, method: hasBodyParams ? "POST" : "GET", status, body, error: errorMessage(body) || `HTTP ${status}` };
    }
```

```js
  } catch (error) {
    console.error("Repliers API error:", error);
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
```

`get-parameter-enumerations.js`:
- Add `import { apiHeaders, readFailure, errorMessage } from "../../../../lib/apiRequest.js";`.
- Delete the `apiKey` line and the `headers` object.
- Pass `headers: apiHeaders(args)` to `fetch`.
- Replace the `!response.ok` block with:

```js
    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return { url: finalUrl, error: errorMessage(body) || `HTTP ${status}`, status, body };
    }
```

- Replace the `catch` block with:

```js
  } catch (error) {
    console.error("Error getting the enumerated values:", error);
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
```

`get-listing-image.js`:
- Same import.
- Headers: `const headers = apiHeaders(args, { accept: null });`. The endpoint returns bytes; no `Accept` header, as today.
- Failure and catch:

```js
    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return {
        url: finalUrl,
        error: errorMessage(body) || `Failed to download image ${imageNumber} for listing ${mlsNumber}: HTTP ${status}`,
        status,
        body,
      };
    }
```

```js
  } catch (error) {
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
```

Leave its hardcoded `https://dev.repliers.io` alone; that is out of scope (see Task 13).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/customErrorContract.test.js test/refineSearchTool.test.js test/searchListingsEnrichment.test.js`
Expected: PASS.

- [ ] **Step 5: Stage for the owner**

```
git add tools/repliers/repliers-api/custom/search-listings.js tools/repliers/repliers-api/custom/refine-search.js tools/repliers/repliers-api/custom/statistics.js tools/repliers/repliers-api/custom/get-parameter-enumerations.js tools/repliers/repliers-api/custom/get-listing-image.js test/customErrorContract.test.js test/refineSearchTool.test.js
# message: feat(tools): custom tools share the failure contract and User-Agent
```

---

### Task 5: Trello — card ids and comments

**Files:**
- Modify: `lib/trello.js`
- Test: `test/trello.test.js` (new cases)

**Interfaces:**
- Produces:
  - `createCard(card) → { ok: true, cardId: string, cardUrl?: string } | { ok: true, dryRun: true, cardId: string } | { ok: false, error: string }`
  - `addComment(cardId: string, text: string) → { ok: true, dryRun?: true } | { ok: false, error: string }`

- [ ] **Step 1: Write the failing tests** (append to `test/trello.test.js`)

```js
import { addComment } from "../lib/trello.js"; // add to the existing import line instead

test("createCard returns the card id, which comments are attached to", async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ id: "c123", shortUrl: "https://trello.com/c/x" }) });
  const result = await createCard({ name: "n", desc: "d" });
  assert.equal(result.cardId, "c123");
});

test("addComment posts the text in the body to the card's comments endpoint", async () => {
  let call;
  global.fetch = async (url, init) => { call = { url: new URL(String(url)), init }; return { ok: true }; };
  const result = await addComment("c123", "seen again");
  assert.equal(result.ok, true);
  assert.equal(call.url.pathname, "/1/cards/c123/actions/comments");
  assert.equal(call.url.searchParams.get("key"), "test-key");
  assert.deepEqual(JSON.parse(call.init.body), { text: "seen again" });
});

test("addComment reports HTTP and network failures instead of throwing", async () => {
  global.fetch = async () => ({ ok: false, status: 429 });
  assert.match((await addComment("c1", "t")).error, /429/);
  global.fetch = async () => { throw new Error("offline"); };
  assert.match((await addComment("c1", "t")).error, /offline/);
});

test("dry-run: cards get an id and comments go to the log, not to Trello", async () => {
  process.env.FEEDBACK_DRY_RUN = "true";
  const log = join(tmpdir(), `comments-${Date.now()}.log`);
  process.env.FEEDBACK_DRY_RUN_LOG = log;
  global.fetch = async () => { throw new Error("must not be called"); };
  const card = await createCard({ name: "n", desc: "d" });
  assert.match(card.cardId, /^dry-run-\d+$/);
  await addComment(card.cardId, "seen again");
  assert.match(readFileSync(log, "utf8"), new RegExp(`Trello comment on ${card.cardId}:\\nseen again`));
  rmSync(log, { force: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/trello.test.js`
Expected: FAIL. `addComment` is not exported, and `cardId` is `undefined`.

- [ ] **Step 3: Implement** (in `lib/trello.js`)

Three edits. First, add a dry-run log helper and a counter above `createCard`:

```js
let dryRunCards = 0;

function logDryRun(entry) {
  // stderr: stdout carries the JSON-RPC stream on the stdio transport
  console.error(entry);
  // Mirrored to a file so a headless eval can read cards back after the run.
  try {
    appendFileSync(dryRunLogPath(), `${entry}\n\n`);
  } catch (error) {
    console.error(`[feedback dry-run] could not write ${dryRunLogPath()}: ${error.message}`);
  }
}
```

Second, in `createCard`, replace the whole `if (dryRun()) { … }` block with:

```js
  if (dryRun()) {
    logDryRun(`[feedback dry-run] Trello card:\n--- name ---\n${name}\n--- desc ---\n${desc}`);
    dryRunCards += 1;
    return { ok: true, dryRun: true, cardId: `dry-run-${dryRunCards}` };
  }
```

and replace `return { ok: true, cardUrl: card.shortUrl };` with:

```js
    return { ok: true, cardId: card.id, cardUrl: card.shortUrl };
```

Everything else in `createCard` stays as it is.

Third, append `addComment`:

```js
export async function addComment(cardId, text) {
  if (dryRun()) {
    logDryRun(`[feedback dry-run] Trello comment on ${cardId}:\n${text}`);
    return { ok: true, dryRun: true };
  }
  const url = new URL(`https://api.trello.com/1/cards/${encodeURIComponent(cardId)}/actions/comments`);
  url.searchParams.set("key", process.env.TRELLO_API_KEY);
  url.searchParams.set("token", process.env.TRELLO_API_TOKEN);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return response.ok ? { ok: true } : { ok: false, error: `Trello responded ${response.status}` };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/trello.test.js test/sendFeedbackTool.test.js`
Expected: PASS. The existing dry-run test still finds `[feedback dry-run] Trello card:` on stderr and in the log.

- [ ] **Step 5: Stage for the owner**

```
git add lib/trello.js test/trello.test.js
# message: feat(trello): return card ids and add comments
```

---

### Task 6: `lib/autoReport.js` — reporter and signal builders

**Files:**
- Create: `lib/autoReport.js`
- Test: `test/autoReport.test.js`

**Interfaces:**
- Consumes: `createCard`, `addComment`, `trelloConfigured` (Task 5). `result.changed` from refine-search (Task 4).
- Produces:
  - `createReporter({ trello?, enabled?, now? }) → { report(signal) → { accepted: boolean, done: Promise<"card"|"comment"|"suppressed"|"dropped"|"off"|"failed"> } }`
  - `reporter`: the process-wide instance
  - `captureSignals({ toolName, args, result, classification?, session? }) → Signal[]`, where `Signal = { key: string, marker: string, summary: string, lines: string[] }`

- [ ] **Step 1: Write the failing tests**

```js
// test/autoReport.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createReporter, captureSignals } from "../lib/autoReport.js";

function fakeTrello({ failFirst = false, hang = false } = {}) {
  const calls = { cards: [], comments: [] };
  let n = 0;
  return {
    calls,
    createCard: async (card) => {
      calls.cards.push(card);
      if (hang) return new Promise(() => {});
      n += 1;
      if (failFirst && n === 1) return { ok: false, error: "Trello responded 500" };
      return { ok: true, cardId: `c${n}` };
    },
    addComment: async (cardId, text) => { calls.comments.push({ cardId, text }); return { ok: true }; },
  };
}
const signal = (key) => ({ key, marker: "🧩", summary: `summary ${key}`, lines: [`line ${key}`] });

test("first occurrence creates one card; repeats in the window become comments on it", async () => {
  const trello = fakeTrello();
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  await report(signal("refine:type")).done;
  await report(signal("refine:type")).done;
  assert.equal(trello.calls.cards.length, 1);
  assert.match(trello.calls.cards[0].name, /^\[MCP·auto\] 🧩 summary refine:type$/);
  assert.deepEqual(trello.calls.comments, [{ cardId: "c1", text: "line refine:type" }]);
});

test("at most 10 comments per key per window; the rest are suppressed but still count as recorded", async () => {
  const trello = fakeTrello();
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  const outcomes = [];
  for (let i = 0; i < 12; i += 1) outcomes.push(report(signal("k")));
  await Promise.all(outcomes.map((o) => o.done));
  assert.equal(trello.calls.cards.length, 1);
  assert.equal(trello.calls.comments.length, 10);
  assert.ok(outcomes.every((o) => o.accepted));
});

test("after 24 hours the same key opens a new card", async () => {
  const trello = fakeTrello();
  let time = 0;
  const { report } = createReporter({ trello, enabled: () => true, now: () => time });
  await report(signal("k")).done;
  time = 24 * 60 * 60 * 1000;
  await report(signal("k")).done;
  assert.equal(trello.calls.cards.length, 2);
});

test("the circuit breaker allows 20 new cards per hour and drops the 21st", async () => {
  const trello = fakeTrello();
  let time = 0;
  const { report } = createReporter({ trello, enabled: () => true, now: () => time });
  for (let i = 0; i < 20; i += 1) await report(signal(`k${i}`)).done;
  const dropped = report(signal("k20"));
  assert.equal(dropped.accepted, false);
  assert.equal(await dropped.done, "dropped");
  time = 60 * 60 * 1000;
  assert.equal(report(signal("k21")).accepted, true);
});

test("disabled (no Trello) records nothing", async () => {
  const trello = fakeTrello();
  const { report } = createReporter({ trello, enabled: () => false, now: () => 0 });
  const outcome = report(signal("k"));
  assert.equal(outcome.accepted, false);
  assert.equal(await outcome.done, "off");
  assert.equal(trello.calls.cards.length, 0);
});

test("a failed card does not hide the defect: the next occurrence tries again", async () => {
  const trello = fakeTrello({ failFirst: true });
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  assert.equal(await report(signal("k")).done, "failed");
  assert.equal(await report(signal("k")).done, "card");
  assert.equal(trello.calls.cards.length, 2);
});

test("two identical signals in flight at once create one card", async () => {
  const trello = fakeTrello();
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  await Promise.all([report(signal("k")).done, report(signal("k")).done]);
  assert.equal(trello.calls.cards.length, 1);
});

test("report() returns before Trello answers", () => {
  const trello = fakeTrello({ hang: true });
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  assert.equal(report(signal("k")).accepted, true);
});

test("card descriptions are capped at Trello's 16384 characters", async () => {
  const trello = fakeTrello();
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  await report({ ...signal("big"), lines: ["x".repeat(20000)] }).done;
  assert.ok(trello.calls.cards[0].desc.length <= 16384);
});

// ---- signal builders

const session = () => ({ searches: new Map() });

test("refine correction: keyed on changed names, carries the origin prompt and nlpId", () => {
  const s = session();
  s.searches.set("https://api.repliers.io/listings?class=condo", { nlpId: "n1", prompt: "condos in Cooksville", url: "u", appliedFilters: {} });
  const [sig] = captureSignals({
    toolName: "refine-search",
    args: { url: "https://api.repliers.io/listings?class=condo" },
    result: { url: "https://api.repliers.io/listings?city=Cooksville&type=sale", constraintPatch: true,
      changed: { set: { type: "sale", city: "Cooksville", resultsPerPage: 5 }, remove: ["class"] }, data: {} },
    session: s,
  });
  assert.equal(sig.key, "refine:-class,city,type");
  assert.match(sig.lines.join("\n"), /condos in Cooksville/);
  assert.match(sig.lines.join("\n"), /n1/);
});

test("presentation-only refines produce no signal", () => {
  const signals = captureSignals({
    toolName: "refine-search", args: { url: "u" },
    result: { url: "u2", constraintPatch: false, changed: { set: { pageNum: 2 }, remove: [] }, data: {} },
    session: session(),
  });
  assert.deepEqual(signals, []);
});

test("discarded parameters: keyed on sorted names", () => {
  const [sig] = captureSignals({
    toolName: "Search_Listings", args: { prompt: "p" },
    result: { data: { nlpId: "n2", request: { url: "u" }, appliedFilters: { unrecognized: ["zeta", "alpha"] } } },
    session: session(),
  });
  assert.equal(sig.key, "unrecognized:alpha,zeta");
});

test("restated search: keyed on the filter families the new parse gained", () => {
  const s = session();
  s.searches.set("n1", { nlpId: "n1", prompt: "first", url: "u1", appliedFilters: { location: "city=Newmarket", postalCode: null } });
  const [sig] = captureSignals({
    toolName: "Search_Listings", args: { prompt: "second", repairsNlpId: "n1" },
    result: { data: { nlpId: "n2", request: { url: "u2" },
      appliedFilters: { location: "city=Newmarket", postalCode: "zip=L3Y", unrecognized: [], other: {} } } },
    session: s,
  });
  assert.equal(sig.key, "restated:postalCode");
  assert.match(sig.lines.join("\n"), /first/);
});

test("restated search with an unknown earlier nlpId is still recorded", () => {
  const [sig] = captureSignals({
    toolName: "Search_Listings", args: { prompt: "second", repairsNlpId: "gone" },
    result: { data: { nlpId: "n2", request: { url: "u2" }, appliedFilters: { unrecognized: [] } } },
    session: session(),
  });
  assert.equal(sig.key, "restated:unknown");
});

test("repairsNlpId null (strict function calling) is not a restated search", () => {
  const signals = captureSignals({
    toolName: "Search_Listings", args: { prompt: "p", repairsNlpId: null },
    result: { data: { nlpId: "n2", request: { url: "u" }, appliedFilters: { unrecognized: [] } } },
    session: session(),
  });
  assert.deepEqual(signals, []);
});

test("captured errors: upstream and nlp-scope keys; non-captured kinds produce nothing", () => {
  const upstream = captureSignals({
    toolName: "get-listing", args: {}, result: { url: "u", status: 502, body: "bad" },
    classification: { kind: "upstream", status: 502, message: "bad gateway", capture: true },
  });
  assert.equal(upstream[0].key, "upstream:get-listing:502:bad gateway");
  const scope = captureSignals({
    toolName: "Search_Listings", args: { prompt: "count homes" }, result: { url: "u", status: 406 },
    classification: { kind: "nlp-scope", status: 406, message: "listings only", capture: true },
  });
  assert.equal(scope[0].key, "nlp-scope:listings only");
  assert.match(scope[0].lines.join("\n"), /count homes/);
  assert.deepEqual(captureSignals({
    toolName: "get-listing", args: {}, result: { url: "u", status: 401 },
    classification: { kind: "account", status: 401, message: "Invalid API key", capture: false },
  }), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/autoReport.test.js`
Expected: FAIL with `Cannot find module '…/lib/autoReport.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// lib/autoReport.js
// Server-side capture (docs/feedback-v2/design.md §6): failures this server observes itself become
// Trello cards without a model call. One card per defect key per 24 h; later instances become
// comments (each prompt is a test case for the NLP team), capped; a breaker caps new cards per hour.
import { createCard, addComment, trelloConfigured } from "./trello.js";

const TTL_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_COMMENTS = 10;
const MAX_CARDS_PER_HOUR = 20;
const MAX_DESC = 16384;
const PRESENTATION = new Set(["resultsPerPage", "pageNum", "sortBy", "fields"]);

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max)}…` : text);

function card(signal) {
  return {
    name: `[MCP·auto] ${signal.marker} ${truncate(signal.summary, 80)}`,
    desc: [...signal.lines, "", `_Recorded ${new Date().toISOString()}_`].join("\n").slice(0, MAX_DESC),
  };
}

export function createReporter({ trello = { createCard, addComment }, enabled = trelloConfigured, now = Date.now } = {}) {
  const entries = new Map();
  let windowStart = -Infinity;
  let cardsInWindow = 0;

  function report(signal) {
    if (!enabled()) return { accepted: false, done: Promise.resolve("off") };
    const time = now();
    const existing = entries.get(signal.key);
    if (existing && existing.expires > time) {
      if (existing.comments >= MAX_COMMENTS) return { accepted: true, done: Promise.resolve("suppressed") };
      existing.comments += 1;
      const done = existing.cardId.then((id) =>
        id ? trello.addComment(id, signal.lines.join("\n")).then(() => "comment") : "suppressed"
      ).catch(() => "failed");
      return { accepted: true, done };
    }
    if (time - windowStart >= HOUR_MS) {
      windowStart = time;
      cardsInWindow = 0;
    }
    if (cardsInWindow >= MAX_CARDS_PER_HOUR) {
      console.error(`[auto-report] circuit breaker open, dropped ${signal.key}`);
      return { accepted: false, done: Promise.resolve("dropped") };
    }
    cardsInWindow += 1;
    for (const [key, entry] of entries) if (entry.expires <= time) entries.delete(key);
    const entry = { comments: 0, expires: time + TTL_MS };
    entry.cardId = trello.createCard(card(signal))
      .then((result) => {
        if (result?.ok && result.cardId) return result.cardId;
        console.error(`[auto-report] card for ${signal.key} failed: ${result?.error ?? "no card id"}`);
        return null;
      })
      .catch((error) => {
        console.error(`[auto-report] card for ${signal.key} failed: ${error.message}`);
        return null;
      })
      .then((id) => {
        // A failed card must not mute the defect for 24 h: forget it so the next instance retries.
        if (!id && entries.get(signal.key) === entry) entries.delete(signal.key);
        return id;
      });
    entries.set(signal.key, entry);
    return { accepted: true, done: entry.cardId.then((id) => (id ? "card" : "failed")) };
  }

  return { report };
}

export const reporter = createReporter();

// ---- signal builders

const families = (appliedFilters) => new Set(
  Object.entries(appliedFilters ?? {})
    .filter(([name, value]) => !["unrecognized", "other"].includes(name) && value != null)
    .map(([name]) => name)
);

const compact = (lines) => lines.filter((line) => line != null && line !== false);

function errorSignal({ toolName, args, result, classification }) {
  const status = classification.status ?? "network error";
  return {
    key: classification.kind === "nlp-scope"
      ? `nlp-scope:${classification.message}`
      : `upstream:${toolName}:${classification.status ?? "network"}:${classification.message.slice(0, 80)}`,
    marker: "❌",
    summary: `${toolName} failed: ${classification.message || `HTTP ${status}`}`,
    lines: compact([
      `**Signal:** ${classification.kind}`,
      `**Tool:** ${toolName}`,
      `**Status:** ${status}`,
      `**Message:** ${classification.message || "(empty)"}`,
      `**URL:** ${result.url ?? "(none)"}`,
      toolName === "Search_Listings" && args.prompt && `**Prompt:** ${args.prompt}`,
      result.body != null && `**Body:** \`${truncate(JSON.stringify(result.body), 2000)}\``,
    ]),
  };
}

function refineSignal({ args, result, session }) {
  const origin = session?.searches.get(args.url);
  const set = Object.entries(result.changed.set).filter(([name]) => !PRESENTATION.has(name));
  const names = [...set.map(([name]) => name), ...result.changed.remove.map((name) => `-${name}`)].sort();
  return {
    key: `refine:${names.join(",")}`,
    marker: "🧩",
    summary: `refine-search corrected ${names.join(", ")}; the original parse missed or mis-mapped it`,
    lines: compact([
      "**Signal:** refine-search correction (probable NLP parse gap)",
      origin?.prompt && `**Prompt:** ${origin.prompt}`,
      origin?.nlpId && `**nlpId:** ${origin.nlpId}`,
      `**URL before:** ${args.url}`,
      `**URL after:** ${result.url}`,
      ...set.map(([name, value]) => `- set ${name} = ${JSON.stringify(value)}`),
      ...result.changed.remove.map((name) => `- removed ${name}`),
    ]),
  };
}

function unrecognizedSignal({ args, data }) {
  const names = [...data.appliedFilters.unrecognized].sort();
  return {
    key: `unrecognized:${names.join(",")}`,
    marker: "🧩",
    summary: `the API discarded ${names.join(", ")} from an NLP-built search`,
    lines: compact([
      "**Signal:** parameters discarded by /listings",
      `**Prompt:** ${args.prompt}`,
      data.nlpId && `**nlpId:** ${data.nlpId}`,
      `**URL:** ${data.request?.url}`,
      `**Discarded:** ${names.join(", ")}`,
    ]),
  };
}

function restatedSignal({ args, data, session }) {
  const origin = session?.searches.get(args.repairsNlpId);
  const before = families(origin?.appliedFilters);
  const gained = origin ? [...families(data.appliedFilters)].filter((name) => !before.has(name)).sort() : [];
  return {
    key: `restated:${gained.length ? gained.join(",") : "unknown"}`,
    marker: "🧩",
    summary: gained.length
      ? `a restated prompt recovered ${gained.join(", ")} that the first parse missed`
      : "a search was restated because its first parse missed a constraint",
    lines: compact([
      "**Signal:** restated search (repairsNlpId)",
      origin ? `**First prompt:** ${origin.prompt}` : `**First nlpId:** ${args.repairsNlpId} (not in this session)`,
      origin?.url && `**First URL:** ${origin.url}`,
      `**Restated prompt:** ${args.prompt}`,
      `**Restated URL:** ${data.request?.url}`,
      data.nlpId && `**Restated nlpId:** ${data.nlpId}`,
      gained.length && `**Families gained:** ${gained.join(", ")}`,
    ]),
  };
}

export function captureSignals({ toolName, args = {}, result, classification, session }) {
  if (classification) return classification.capture ? [errorSignal({ toolName, args, result, classification })] : [];
  const signals = [];
  if (toolName === "refine-search" && result.constraintPatch !== false && result.changed) {
    signals.push(refineSignal({ args, result, session }));
  }
  const data = result.data;
  if (toolName === "Search_Listings" && data && typeof data === "object") {
    if (data.appliedFilters?.unrecognized?.length) signals.push(unrecognizedSignal({ args, data }));
    if (args.repairsNlpId != null && args.repairsNlpId !== "") signals.push(restatedSignal({ args, data, session }));
  }
  return signals;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/autoReport.test.js`
Expected: PASS (17 tests).

- [ ] **Step 5: Stage for the owner**

```
git add lib/autoReport.js test/autoReport.test.js
# message: feat(capture): deduplicated server-side reporter and signal builders
```

---

### Task 7: `lib/toolCall.js` — the call path, errors as `_notice`, `mcpServer.js` delegates

**Files:**
- Create: `lib/toolCall.js`, `test/helpers/toolDoubles.js`
- Modify: `mcpServer.js:159-258` (`setupServerHandlers`)
- Test: `test/toolCall.test.js`

**Interfaces:**
- Consumes: `classifyError` (Task 2); `augmentResult` (existing); `reporter`, `captureSignals` (Task 6, wired in Task 9); `userAgent` (Task 1)
- Produces:
  - `createSessionState() → { searches: Map<string, { nlpId, prompt, url, appliedFilters }> }`
  - `callTool({ tool, toolName, args, repliersApiKey, userAgent, session?, reporter? }) → Promise<CallToolResult>`

- [ ] **Step 1: Write the test doubles and the failing tests**

The doubles live in `test/helpers/` (not a `*.test.js` file), so Tasks 8–10 can import them without re-running this file's tests:

```js
// test/helpers/toolDoubles.js
// A tool shaped like discoverTools() entries, and a reporter that records instead of posting.
export const fakeTool = (name, fn, required = []) => ({
  definition: { function: { name, parameters: { type: "object", properties: {}, required } } },
  function: fn,
});

export const fakeReporter = () => {
  const reports = [];
  return { reports, report: (signal) => { reports.push(signal); return { accepted: true, done: Promise.resolve("card") }; } };
};
```

```js
// test/toolCall.test.js
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { callTool, createSessionState } from "../lib/toolCall.js";
import { fakeTool, fakeReporter } from "./helpers/toolDoubles.js";
import { apiTool as getListing } from "../tools/repliers/repliers-api/generated/get-listing.js";

const realFetch = global.fetch;
const realEnv = { ...process.env };
beforeEach(() => {
  process.env.TRELLO_API_KEY = "k";
  process.env.TRELLO_API_TOKEN = "t";
  process.env.TRELLO_LIST_ID = "l";
  process.env.FEEDBACK_PROMPT_LEVEL = "high";
});
afterEach(() => {
  global.fetch = realFetch;
  for (const key of Object.keys(process.env)) if (!(key in realEnv)) delete process.env[key];
  Object.assign(process.env, realEnv);
});

const payload = (res) => JSON.parse(res.content[1].text);

test("a missing required parameter is a tool error the model can read, and the tool is not called", async () => {
  let called = false;
  const res = await callTool({
    tool: fakeTool("send-message", () => { called = true; }, ["content"]), toolName: "send-message",
    args: { sender: "agent" }, repliersApiKey: "k", reporter: fakeReporter(),
  });
  assert.equal(res.isError, true);
  assert.equal(payload(res)._notice.kind, "request");
  assert.match(payload(res)._notice.forAgent, /content/);
  assert.equal(called, false);
});

test("absent arguments are treated as an empty object", async () => {
  const res = await callTool({
    tool: fakeTool("x", async () => ({ url: "u", data: { ok: 1 } })), toolName: "x",
    args: undefined, repliersApiKey: "k", reporter: fakeReporter(),
  });
  assert.equal(res.isError, undefined);
  assert.deepEqual(payload(res), { ok: 1 });
});

// The random-key probe of 2026-10-12, as a test (design.md §3).
test("an invalid key yields an account _notice for the user, isError, and no reporting nudge", async () => {
  global.fetch = async () => new Response('[{"msg":"Invalid API key"}]', { status: 401 });
  const res = await callTool({
    tool: getListing, toolName: "get-listing", args: { mlsNumber: "N13549286" },
    repliersApiKey: "random", reporter: fakeReporter(),
  });
  const body = payload(res);
  assert.equal(res.isError, true);
  assert.equal(Object.keys(body)[0], "_notice");
  assert.equal(body._notice.kind, "account");
  assert.match(body._notice.forUser, /https:\/\/login\.repliers\.com\/dashboard\/apikeys/);
  assert.equal(body._notice.retry, false);
  assert.equal(body._feedback, undefined);
  assert.doesNotMatch(res.content[1].text, /send-feedback/);
});

test("a 404 is an answer, not an error", async () => {
  global.fetch = async () => new Response("", { status: 404 });
  const res = await callTool({
    tool: getListing, toolName: "get-listing", args: { mlsNumber: "X0" }, repliersApiKey: "k", reporter: fakeReporter(),
  });
  assert.equal(res.isError, undefined);
  assert.deepEqual(payload(res), { found: false, reason: "No record matches these parameters." });
});

test("a thrown tool is an upstream error, not a crash", async () => {
  const res = await callTool({
    tool: fakeTool("x", async () => { throw new Error("boom"); }), toolName: "x",
    args: {}, repliersApiKey: "k", reporter: fakeReporter(),
  });
  assert.equal(res.isError, true);
  assert.equal(payload(res)._notice.kind, "upstream");
});

test("the tool receives the caller's key and User-Agent; success passes through unchanged", async () => {
  let seen;
  const res = await callTool({
    tool: fakeTool("x", async (args) => { seen = args; return { url: "https://api.repliers.io/x", data: { a: 1 } }; }),
    toolName: "x", args: { q: 1 }, repliersApiKey: "k1", userAgent: "ua/1", reporter: fakeReporter(),
  });
  assert.equal(seen._repliersApiKey, "k1");
  assert.equal(seen._userAgent, "ua/1");
  assert.match(res.content[0].text, /https:\/\/api\.repliers\.io\/x/);
  assert.deepEqual(payload(res), { a: 1 });
});

// The probe also showed the verify nudge glued onto an error that has no appliedFilters.
test("a failed Search_Listings gets no verify nudge", async () => {
  const res = await callTool({
    tool: fakeTool("Search_Listings", async () => ({ url: "u", error: "Invalid API key", status: 401, body: [{ msg: "Invalid API key" }] })),
    toolName: "Search_Listings", args: { prompt: "p" }, repliersApiKey: "k", reporter: fakeReporter(),
  });
  assert.doesNotMatch(res.content[1].text, /Compare appliedFilters|appliedFilters shows/);
});

test("image results keep the image content shape", async () => {
  const res = await callTool({
    tool: fakeTool("Get_Listing_Image", async () => ({ url: "u", image: { data: "AAA", mimeType: "image/png" } })),
    toolName: "Get_Listing_Image", args: {}, repliersApiKey: "k", reporter: fakeReporter(),
  });
  assert.deepEqual(res.content, [{ type: "image", data: "AAA", mimeType: "image/png" }]);
});

test("createSessionState starts empty", () => {
  assert.equal(createSessionState().searches.size, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/toolCall.test.js`
Expected: FAIL with `Cannot find module '…/lib/toolCall.js'`.

- [ ] **Step 3: Implement `lib/toolCall.js`**

```js
// lib/toolCall.js
// One tool call end to end: argument check, the call, error classification into a _notice,
// nudges, and (Task 9) server-side capture. mcpServer.js only routes requests here.
import { apiBaseUrl } from "./apiBase.js";
import { classifyError } from "./apiErrors.js";
import { augmentResult } from "./feedbackHints.js";
import { reporter as processReporter } from "./autoReport.js";

const SESSION_SEARCH_LIMIT = 200;

export function createSessionState() {
  return { searches: new Map() };
}

export function remember(session, key, entry) {
  if (!key || !entry) return;
  session.searches.delete(key);
  session.searches.set(key, entry);
  while (session.searches.size > SESSION_SEARCH_LIMIT) {
    session.searches.delete(session.searches.keys().next().value);
  }
}

function toContent(endpoint, payload, isError) {
  const result = {
    content: [
      { type: "text", text: `🔗 **API Endpoint Used**\n\`\`\`\n${endpoint}\n\`\`\`\n` },
      { type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) },
    ],
  };
  if (isError) result.isError = true;
  return result;
}

async function invoke(tool, args) {
  try {
    return await tool.function(args);
  } catch (error) {
    return { url: undefined, error: error.message, status: null, body: null };
  }
}

function noticeFor(classification) {
  return {
    kind: classification.kind,
    ...(classification.forUser && { forUser: classification.forUser }),
    forAgent: classification.forAgent,
    retry: classification.retry,
    ...(classification.candidates && { candidates: classification.candidates }),
  };
}

export async function callTool({
  tool, toolName, args, repliersApiKey, userAgent, session = createSessionState(), reporter = processReporter,
}) {
  const input = args ?? {};
  const fallbackEndpoint = `${apiBaseUrl()}/${toolName}`;
  const required = tool.definition?.function?.parameters?.required || [];
  const missing = required.filter((name) => !(name in input));
  if (missing.length) {
    return toContent(fallbackEndpoint, {
      _notice: {
        kind: "request",
        forAgent: `Missing required parameter${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
        retry: true,
      },
    }, true);
  }

  const callArgs = { ...input, _repliersApiKey: repliersApiKey, _userAgent: userAgent };
  const result = await invoke(tool, callArgs);

  if (result.image) {
    return { content: [{ type: "image", data: result.image.data, mimeType: result.image.mimeType }] };
  }

  if (result.error) {
    const classification = classifyError({
      toolName, url: result.url, status: result.status, body: result.body, error: result.error,
    });
    if (classification.kind === "not-found") {
      return toContent(result.url || fallbackEndpoint, { found: false, reason: classification.forAgent }, false);
    }
    return toContent(result.url || fallbackEndpoint, {
      _notice: noticeFor(classification),
      error: { status: classification.status ?? null, message: classification.message },
    }, true);
  }

  augmentResult(toolName, result);
  return toContent(
    result.url || fallbackEndpoint,
    typeof result.data === "string" ? result.data : result.data || result,
    false,
  );
}
```

- [ ] **Step 4: Wire `mcpServer.js`**

Add the imports:

```js
import { callTool, createSessionState } from "./lib/toolCall.js";
import { userAgent } from "./lib/apiRequest.js";
```

Inside `setupServerHandlers(server, tools)`, after the `ListToolsRequestSchema` handler, replace the whole `CallToolRequestSchema` handler body with:

```js
  // Per-session memory of searches, so capture can tie a refine back to the prompt it corrects.
  const session = createSessionState();

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const toolName = request.params.name;
    console.error(`[DEBUG] Tool call requested: ${toolName}`);
    const tool = tools.find((t) => t.definition.function.name === toolName);
    if (!tool) {
      console.error(`[ERROR] Tool not found: ${toolName}`);
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }
    // The Repliers key is resolved per request, from the identity verifyOAuthToken proved
    // for this very call, rather than captured when the session was opened. A key that is
    // rotated or revoked upstream therefore takes effect on the next call instead of living
    // on for the lifetime of the session. Absent in self-hosted and stdio mode, where there
    // is no per-user identity and the environment key is the only one.
    const repliersApiKey = extra?.authInfo?.extra?.repliersApiKey ?? process.env.REPLIERS_API_KEY;
    return callTool({
      tool,
      toolName,
      args: request.params.arguments,
      repliersApiKey,
      userAgent: userAgent(server.getClientVersion()),
      session,
    });
  });
```

Remove the now-unused `augmentResult` import from `mcpServer.js` if nothing else uses it (`grep -n augmentResult mcpServer.js`).

- [ ] **Step 5: Run the suite**

Run: `node --test test/toolCall.test.js && npm test`
Expected: PASS. The HTTP tests (`test/http*.test.js`) spawn the real server and must stay green; they exercise the rewired handler through the transport.

- [ ] **Step 6: Stage for the owner**

```
git add lib/toolCall.js mcpServer.js test/toolCall.test.js test/helpers/toolDoubles.js
# message: feat(server): tool calls return classified _notice errors with isError
```

---

### Task 8: `boardId` resolution for multi-board accounts

**Files:**
- Create: `lib/boardId.js`
- Modify: `lib/toolCall.js`
- Test: `test/boardId.test.js`

**Interfaces:**
- Consumes: `apiHeaders` (Task 1), `apiBaseUrl`
- Produces: `boardsForMlsNumber(mlsNumber: string, args: object) → Promise<number[] | null>`, where `null` means the lookup itself failed

- [ ] **Step 1: Write the failing tests**

```js
// test/boardId.test.js
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { callTool } from "../lib/toolCall.js";
import { fakeTool, fakeReporter } from "./helpers/toolDoubles.js";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

const payload = (res) => JSON.parse(res.content[1].text);
const needsBoard = { url: "https://api.repliers.io/listings/N1", error: "boardId is required", status: 400, body: [{ msg: "boardId is required" }] };

function boardLookup(boards) {
  const seen = [];
  global.fetch = async (url) => {
    seen.push(new URL(String(url)));
    return new Response(JSON.stringify({ aggregates: { boardId: boards } }), { status: 200 });
  };
  return seen;
}

test("one board: the call is retried with it and the response says what was assumed", async () => {
  const lookups = boardLookup({ 2: 1 });
  const calls = [];
  const tool = fakeTool("get-listing", async (args) => {
    calls.push(args);
    return args.boardId == null ? needsBoard : { url: "u", data: { mlsNumber: "N1" } };
  });
  const res = await callTool({ tool, toolName: "get-listing", args: { mlsNumber: "N1" }, repliersApiKey: "k", reporter: fakeReporter() });
  assert.equal(res.isError, undefined);
  assert.deepEqual(payload(res), { boardIdResolved: 2, mlsNumber: "N1" });
  assert.equal(calls[1].boardId, 2);
  assert.equal(lookups[0].searchParams.get("mlsNumber"), "N1");
  assert.equal(lookups[0].searchParams.get("aggregates"), "boardId");
});

test("several boards: candidates go back to the agent", async () => {
  boardLookup({ 2: 1, 16: 1 });
  const tool = fakeTool("get-similar-listings", async () => needsBoard);
  const res = await callTool({ tool, toolName: "get-similar-listings", args: { mlsNumber: "N1" }, repliersApiKey: "k", reporter: fakeReporter() });
  assert.equal(res.isError, true);
  assert.deepEqual(payload(res)._notice.candidates, [2, 16]);
});

test("no board holds it: not found", async () => {
  boardLookup({});
  const tool = fakeTool("get-listing", async () => needsBoard);
  const res = await callTool({ tool, toolName: "get-listing", args: { mlsNumber: "N1" }, repliersApiKey: "k", reporter: fakeReporter() });
  assert.deepEqual(payload(res), { found: false, reason: "No record matches these parameters." });
});

test("boardId: null (strict function calling) still triggers resolution", async () => {
  boardLookup({ 2: 1 });
  const tool = fakeTool("get-listing", async (args) => (args.boardId == null ? needsBoard : { url: "u", data: {} }));
  const res = await callTool({ tool, toolName: "get-listing", args: { mlsNumber: "N1", boardId: null }, repliersApiKey: "k", reporter: fakeReporter() });
  assert.equal(payload(res).boardIdResolved, 2);
});

test("a failed lookup leaves the needs-board hint; other tools never trigger a lookup", async () => {
  global.fetch = async () => new Response("", { status: 500 });
  const res = await callTool({
    tool: fakeTool("get-listing", async () => needsBoard), toolName: "get-listing",
    args: { mlsNumber: "N1" }, repliersApiKey: "k", reporter: fakeReporter(),
  });
  assert.match(payload(res)._notice.forAgent, /Lookup_Possible_Values/);

  let fetched = false;
  global.fetch = async () => { fetched = true; return new Response("{}", { status: 200 }); };
  await callTool({ tool: fakeTool("search-members", async () => needsBoard), toolName: "search-members", args: {}, repliersApiKey: "k", reporter: fakeReporter() });
  assert.equal(fetched, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/boardId.test.js`
Expected: FAIL. The first test gets `isError: true` and a `needs-board` notice instead of a retried success.

- [ ] **Step 3: Implement**

```js
// lib/boardId.js
// Which MLS boards hold an MLS number, asked with the caller's own key — so the lookup can only
// ever see boards that key already sees. null when the lookup itself fails.
import { apiBaseUrl } from "./apiBase.js";
import { apiHeaders } from "./apiRequest.js";

export async function boardsForMlsNumber(mlsNumber, args) {
  const url = new URL(`${apiBaseUrl()}/listings`);
  url.searchParams.set("mlsNumber", String(mlsNumber));
  url.searchParams.set("listings", "false");
  url.searchParams.set("aggregates", "boardId");
  try {
    const response = await fetch(url, { headers: apiHeaders(args) });
    if (!response.ok) return null;
    const data = await response.json();
    return Object.keys(data.aggregates?.boardId ?? {}).map(Number).filter(Number.isFinite);
  } catch {
    return null;
  }
}
```

In `lib/toolCall.js`:
- Add `import { boardsForMlsNumber } from "./boardId.js";` and `const BOARD_TOOLS = new Set(["get-listing", "get-similar-listings"]);`.
- Make `result` a `let`.
- Inside `if (result.error) { … }`, change `const classification` to `let classification` and insert this block directly after it, before the `not-found` check:

```js
    if (classification.reason === "needs-board" && BOARD_TOOLS.has(toolName)
        && input.mlsNumber != null && input.boardId == null) {
      const boards = await boardsForMlsNumber(input.mlsNumber, callArgs);
      if (boards?.length === 1) {
        const retried = await invoke(tool, { ...callArgs, boardId: boards[0] });
        if (!retried.error) {
          retried.data = { boardIdResolved: boards[0], ...retried.data };
          augmentResult(toolName, retried);
          return toContent(retried.url || fallbackEndpoint, retried.data, false);
        }
        result = retried;
        classification = classifyError({ toolName, url: retried.url, status: retried.status, body: retried.body, error: retried.error });
      } else if (boards?.length > 1) {
        classification = {
          ...classification,
          candidates: boards,
          forAgent: `MLS number ${input.mlsNumber} exists on more than one MLS (boardId ${boards.join(", ")}); passing boardId selects one, and the user can say which MLS they mean.`,
        };
      } else if (boards?.length === 0) {
        classification = classifyError({ toolName, url: result.url, status: 404, body: null });
      }
    }
```

Task 9 replaces the success return here with the shared `succeed()` helper.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/boardId.test.js test/toolCall.test.js`
Expected: PASS.

- [ ] **Step 5: Stage for the owner**

```
git add lib/boardId.js lib/toolCall.js test/boardId.test.js
# message: feat(server): resolve boardId for multi-board accounts
```

---

### Task 9: Wire capture into the call path

**Files:**
- Modify: `lib/toolCall.js`
- Test: `test/toolCallCapture.test.js`

**Interfaces:**
- Consumes: `captureSignals`, `reporter` (Task 6); `remember`, `createSessionState` (Task 7)
- Produces: success and error payloads gain `_feedback: { signals: ["recorded", …], note }` when a signal was accepted. `_feedback` stays the first key (after `_notice` on errors).

- [ ] **Step 1: Write the failing tests**

```js
// test/toolCallCapture.test.js
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { callTool, createSessionState } from "../lib/toolCall.js";
import { createReporter } from "../lib/autoReport.js";
import { fakeTool, fakeReporter } from "./helpers/toolDoubles.js";

const realEnv = { ...process.env };
beforeEach(() => {
  process.env.TRELLO_API_KEY = "k"; process.env.TRELLO_API_TOKEN = "t"; process.env.TRELLO_LIST_ID = "l";
  process.env.FEEDBACK_PROMPT_LEVEL = "high";
});
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in realEnv)) delete process.env[key];
  Object.assign(process.env, realEnv);
});
const payload = (res) => JSON.parse(res.content[1].text);
const U = "https://api.repliers.io/listings?class=condo&city=Cooksville";

const search = fakeTool("Search_Listings", async () => ({
  url: "https://api.repliers.io/nlp?nlpVersion=3",
  data: { appliedFilters: { location: "city=Cooksville", type: null, unrecognized: [] }, request: { url: U }, nlpId: "n1", listings: { count: 3 } },
}));
const refine = (to) => fakeTool("refine-search", async () => ({
  url: to, constraintPatch: true, changed: { set: { type: "sale" }, remove: [] }, data: { count: 2 },
}));

test("a refine correction is recorded, tied to the prompt it corrects, and the model is told", async () => {
  const session = createSessionState();
  const reporter = fakeReporter();
  await callTool({ tool: search, toolName: "Search_Listings", args: { prompt: "condos in Cooksville" }, repliersApiKey: "k", session, reporter });
  const res = await callTool({ tool: refine(`${U}&type=sale`), toolName: "refine-search", args: { url: U, type: "sale" }, repliersApiKey: "k", session, reporter });
  assert.equal(reporter.reports.length, 1);
  assert.equal(reporter.reports[0].key, "refine:type");
  assert.match(reporter.reports[0].lines.join("\n"), /condos in Cooksville/);
  const body = payload(res);
  assert.equal(Object.keys(body)[0], "_feedback");
  assert.ok(body._feedback.signals.includes("recorded"));
  assert.match(body._feedback.note, /Recorded for the Repliers team/);
});

test("a refine of an already refined URL still finds the original prompt", async () => {
  const session = createSessionState();
  const reporter = fakeReporter();
  await callTool({ tool: search, toolName: "Search_Listings", args: { prompt: "condos in Cooksville" }, repliersApiKey: "k", session, reporter });
  await callTool({ tool: refine(`${U}&type=sale`), toolName: "refine-search", args: { url: U, type: "sale" }, repliersApiKey: "k", session, reporter });
  await callTool({ tool: refine(`${U}&type=sale&status=A`), toolName: "refine-search", args: { url: `${U}&type=sale`, status: "A" }, repliersApiKey: "k", session, reporter });
  assert.match(reporter.reports[1].lines.join("\n"), /nlpId:\*\* n1/);
});

test("an upstream error is recorded and says so; an account error is not recorded", async () => {
  const reporter = fakeReporter();
  const upstream = await callTool({
    tool: fakeTool("get-listing", async () => ({ url: "u", error: "bad gateway", status: 502, body: "bad gateway" })),
    toolName: "get-listing", args: {}, repliersApiKey: "k", reporter,
  });
  assert.deepEqual(Object.keys(payload(upstream)).slice(0, 2), ["_notice", "_feedback"]);
  const account = await callTool({
    tool: fakeTool("get-listing", async () => ({ url: "u", error: "Invalid API key", status: 401, body: [{ msg: "Invalid API key" }] })),
    toolName: "get-listing", args: {}, repliersApiKey: "k", reporter,
  });
  assert.equal(reporter.reports.length, 1);
  assert.equal(payload(account)._feedback, undefined);
});

test("a signal the reporter does not accept is not announced as recorded", async () => {
  const reporter = { reports: [], report: () => ({ accepted: false, done: Promise.resolve("dropped") }) };
  const res = await callTool({
    tool: fakeTool("get-listing", async () => ({ url: "u", error: "x", status: 503, body: null })),
    toolName: "get-listing", args: {}, repliersApiKey: "k", reporter,
  });
  assert.equal(payload(res)._feedback, undefined);
});

test("a tool call never waits for Trello", async () => {
  const reporter = createReporter({
    trello: { createCard: () => new Promise(() => {}), addComment: () => new Promise(() => {}) },
    enabled: () => true,
  });
  const res = await callTool({
    tool: fakeTool("get-listing", async () => ({ url: "u", error: "x", status: 503, body: null })),
    toolName: "get-listing", args: {}, repliersApiKey: "k", reporter,
  });
  assert.equal(res.isError, true);
});

test("the caller's API key never reaches a card", async () => {
  const reporter = fakeReporter();
  await callTool({
    tool: fakeTool("Search_Listings", async (args) => ({ url: `https://api.repliers.io/nlp?k=${args._repliersApiKey}`, error: "x", status: 500, body: { echo: args._repliersApiKey } })),
    toolName: "Search_Listings", args: { prompt: "p" }, repliersApiKey: "SECRET-KEY-123", reporter,
  });
  assert.equal(reporter.reports.length, 1);
  assert.doesNotMatch(JSON.stringify(reporter.reports), /SECRET-KEY-123/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/toolCallCapture.test.js`
Expected: FAIL. `reporter.reports` is empty, because nothing calls the reporter yet.

- [ ] **Step 3: Implement** (in `lib/toolCall.js`)

Add `import { captureSignals } from "./autoReport.js";` (alongside the `reporter` import). Then add the helpers:

```js
// The key must never reach Trello, even when a tool or the API echoes it into a URL or body.
// Applied to the finished signal text, not to the result: listing payloads run to megabytes.
function redact(signals, secret) {
  if (!secret) return signals;
  const scrub = (text) => text.split(secret).join("[redacted]");
  return signals.map((signal) => ({
    ...signal, key: scrub(signal.key), summary: scrub(signal.summary), lines: signal.lines.map(scrub),
  }));
}

function record(reporter, signals) {
  return signals.filter((signal) => reporter.report(signal).accepted);
}

function withRecorded(payload, recorded) {
  if (!recorded.length || !payload || typeof payload !== "object") return payload;
  const note = recorded.map((signal) => `Recorded for the Repliers team: ${signal.summary}.`).join(" ");
  const { _notice, _feedback, ...rest } = payload;
  const merged = _feedback
    ? { signals: ["recorded", ..._feedback.signals], note: `${note} ${_feedback.note}` }
    : { signals: ["recorded"], note };
  return { ...(_notice && { _notice }), _feedback: merged, ...rest };
}

function rememberSearch(session, toolName, input, result) {
  const data = result.data;
  if (toolName === "Search_Listings" && data?.request?.url) {
    const entry = { nlpId: data.nlpId ?? null, prompt: input.prompt, url: data.request.url, appliedFilters: data.appliedFilters ?? null };
    remember(session, data.request.url, entry);
    if (entry.nlpId) remember(session, entry.nlpId, entry);
  } else if (toolName === "refine-search" && result.url) {
    remember(session, result.url, session.searches.get(input.url));
  }
}

function succeed({ toolName, input, result, session, reporter, repliersApiKey, fallbackEndpoint }) {
  augmentResult(toolName, result);
  const signals = redact(captureSignals({ toolName, args: input, result, session }), repliersApiKey);
  const recorded = record(reporter, signals);
  rememberSearch(session, toolName, input, result);
  const data = typeof result.data === "string" ? result.data : withRecorded(result.data || result, recorded);
  return toContent(result.url || fallbackEndpoint, data, false);
}
```

Replace the final success return of `callTool`, and the success return inside the Task 8 retry block, with calls to `succeed(...)`:

```js
  return succeed({ toolName, input, result, session, reporter, repliersApiKey, fallbackEndpoint });
```

Retry block: `return succeed({ toolName, input, result: retried, session, reporter, repliersApiKey, fallbackEndpoint });`. Delete the `augmentResult` line there, because `succeed` calls it.

In the error branch, after the `not-found` return, build the payload through capture:

```js
    const signals = redact(captureSignals({ toolName, args: input, result, classification }), repliersApiKey);
    const recorded = record(reporter, signals);
    return toContent(result.url || fallbackEndpoint, withRecorded({
      _notice: noticeFor(classification),
      error: { status: classification.status ?? null, message: classification.message },
    }, recorded), true);
```

`input` is the caller's arguments without `_repliersApiKey`. Never pass `callArgs` to `captureSignals`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/toolCallCapture.test.js test/toolCall.test.js test/boardId.test.js`
Expected: PASS.

- [ ] **Step 5: Stage for the owner**

```
git add lib/toolCall.js test/toolCallCapture.test.js
# message: feat(capture): record server-observed failures from the call path
```

---

### Task 10: `repairsNlpId` on `Search_Listings`

**Files:**
- Modify: `tools/repliers/repliers-api/custom/search-listings.js`
- Test: `test/searchListingsEnrichment.test.js` (new cases), `test/toolCallCapture.test.js` (one case)

**Interfaces:**
- Consumes: the restated signal (Task 6), session memory (Task 9)
- Produces: a new optional `Search_Listings` parameter, `repairsNlpId: string`. It is never sent to `/nlp`.

- [ ] **Step 1: Write the failing tests**

Append to `test/searchListingsEnrichment.test.js`:

```js
test("repairsNlpId is part of the schema and is never sent to the NLP endpoint", async () => {
  const schema = apiTool.definition.function.parameters.properties.repairsNlpId;
  assert.equal(schema.type, "string");
  let sent;
  global.fetch = async (url, init) => { sent = JSON.parse(init.body); return new Response('{"request":{"url":"https://api.repliers.io/listings?city=X"},"listings":{"count":0}}', { status: 200 }); };
  await apiTool.function({ prompt: "p", repairsNlpId: "n1", _repliersApiKey: "k" });
  assert.deepEqual(Object.keys(sent).sort(), ["listings", "prompt"]);
});
```

Append to `test/toolCallCapture.test.js`:

```js
test("a restated search names the families the first parse missed", async () => {
  const session = createSessionState();
  const reporter = fakeReporter();
  await callTool({ tool: search, toolName: "Search_Listings", args: { prompt: "condos in Cooksville" }, repliersApiKey: "k", session, reporter });
  const restated = fakeTool("Search_Listings", async () => ({
    url: "u", data: { appliedFilters: { location: "city=Cooksville", type: "type=sale", unrecognized: [] }, request: { url: `${U}&type=sale` }, nlpId: "n2", listings: { count: 1 } },
  }));
  await callTool({ tool: restated, toolName: "Search_Listings", args: { prompt: "condos FOR SALE in Cooksville", repairsNlpId: "n1" }, repliersApiKey: "k", session, reporter });
  assert.equal(reporter.reports.at(-1).key, "restated:type");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/searchListingsEnrichment.test.js test/toolCallCapture.test.js`
Expected: FAIL. `schema` is `undefined`. (The capture case passes already if Tasks 6 and 9 are in; that is fine, because it pins the integration.)

- [ ] **Step 3: Implement**

In `search-listings.js`, add to `parameters.properties`:

```js
          repairsNlpId: {
            type: "string",
            description: "nlpId of an earlier Search_Listings call that this call restates because its parse missed a constraint. Omit for a new search.",
          },
```

The request body is already built from `prompt` and `listings` only; keep it that way.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/searchListingsEnrichment.test.js test/toolCallCapture.test.js`
Expected: PASS.

- [ ] **Step 5: Stage for the owner**

```
git add tools/repliers/repliers-api/custom/search-listings.js test/searchListingsEnrichment.test.js test/toolCallCapture.test.js
# message: feat(search): repairsNlpId marks a restated search for capture
```

---

### Task 11: Neutral nudges and instructions; retire `FEEDBACK_CONSENT`

**Files:**
- Modify: `lib/feedbackHints.js`, `lib/serverInstructions.js`, `tools/repliers/repliers-api/custom/send-feedback.js`, `mcpServer.js` (startup notice), `scripts/print-instructions.mjs`
- Test: `test/feedbackHints.test.js`, `test/serverInstructions.test.js`, `test/sendFeedbackTool.test.js` (rewrites listed below)

**Interfaces:**
- Produces: `consentMode` is removed from `lib/feedbackHints.js`. `augmentResult` ignores error results. `send-feedback` returns `data: { recorded: true, forUser } | { recorded: false, error }`.

- [ ] **Step 1: Rewrite the tests first**

`test/feedbackHints.test.js`:
- Drop `consentMode` from the import and `FEEDBACK_CONSENT` from `realEnv`/`beforeEach`.
- Delete these tests:
  - "api-error results get _feedback on the result itself"
  - "error with data object attaches _feedback to data…"
  - "refined signal fires…"
  - "refined signal suppressed…"
  - "refined signal absent…"
  - "consentMode defaults…"
  - "auto mode: api-error note…"
  - "always-ask mode: every note…"
- Add:

```js
test("errors get no _feedback: they carry a _notice from the call path instead", () => {
  const result = { error: "boom", status: 500, data: { count: 5 } };
  augmentResult("Search_Listings", result);
  assert.equal(result._feedback, undefined);
  assert.equal(result.data._feedback, undefined);
});

test("refine-search results get no refined nudge: capture records the correction", () => {
  const result = { constraintPatch: true, data: { count: 28 } };
  augmentResult("refine-search", result);
  assert.ok(!(result.data._feedback?.signals ?? []).includes("refined"));
});

// ChatGPT's safety layer flags approval-steering wording (design.md §2.2); notes are statements.
test("no note uses imperative or approval-steering wording", () => {
  const results = [
    ["Search_Listings", { data: { request: { url: "https://api.repliers.io/listings?minBeds=5" }, listings: { count: 0 } } }],
    ["Search_Listings", { data: { request: { url: "https://api.repliers.io/listings?city=X" }, listings: { count: 3 }, big: "x".repeat(1_000_001) } }],
  ];
  for (const [tool, result] of results) {
    augmentResult(tool, result);
    assert.doesNotMatch(result.data._feedback.note, /\bMUST\b|\bREQUIRED\b|no need to ask|without asking|only after|NEXT tool call/);
  }
});
```

`test/serverInstructions.test.js`:
- **Keep** `FEEDBACK_CONSENT` in `realEnv`/`beforeEach`: the new "no longer changes the text" test sets it, and the restore loop is what stops it leaking into the next test.
- Delete "auto mode: rule 3 …" and "always-ask mode: rule 3 …".
- Add:

```js
test("rule 3 says server-observed failures are recorded and send-feedback covers the rest", () => {
  withTrello();
  const rule3 = buildServerInstructions().split("\n").find((line) => line.startsWith("3."));
  assert.match(rule3, /recorded automatically/);
  assert.match(rule3, /send-feedback covers what only the conversation shows/);
  assert.doesNotMatch(rule3, /MUST|without asking|consent/i);
});

test("FEEDBACK_CONSENT no longer changes the text", () => {
  withTrello();
  const before = buildServerInstructions();
  process.env.FEEDBACK_CONSENT = "always-ask";
  assert.equal(buildServerInstructions(), before);
});

test("rule 2 tells the agent how to mark a restated search", () => {
  assert.match(buildServerInstructions(), /repairsNlpId/);
});
```

`test/sendFeedbackTool.test.js`:
- **Keep** `FEEDBACK_CONSENT` in `realEnv`/`beforeEach`: the new description test sets it.
- Delete "auto mode: description …", "always-ask mode: description …" and "description names the required parameters in both consent modes".
- Change the two result tests to the new shape:

```js
test("valid call posts a card and returns a user-safe acknowledgement, with no link or dry-run flag", async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ id: "c1", shortUrl: "https://trello.com/c/x" }) });
  const { apiTool } = await load();
  const result = await apiTool.function({ category: "nlp-misparse", summary: "price dropped", userQuery: "under 500k" });
  assert.deepEqual(result.data, { recorded: true, forUser: "The report was sent to the Repliers team." });
  assert.doesNotMatch(JSON.stringify(result), /trello\.com\/c\/|dryRun/);
});

test("a failed send still tells the agent it failed", async () => {
  global.fetch = async () => ({ ok: false, status: 401 });
  const { apiTool } = await load();
  const result = await apiTool.function({ category: "api-error", summary: "s", userQuery: "q" });
  assert.equal(result.data.recorded, false);
  assert.match(result.data.error, /401/);
});

test("description is a neutral statement that names the required parameters", async () => {
  process.env.FEEDBACK_CONSENT = "always-ask";
  const { apiTool } = await load();
  const description = apiTool.definition.function.description;
  for (const param of ["category", "summary", "userQuery"]) assert.match(description, new RegExp(param));
  assert.match(description, /recorded automatically/);
  assert.doesNotMatch(description, /CONSENT|only after|without asking|says yes/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/feedbackHints.test.js test/serverInstructions.test.js test/sendFeedbackTool.test.js`
Expected: FAIL. Errors still get `_feedback`, and the `refined` note is present. Rule 3 lacks "recorded automatically". The consent text varies with `FEEDBACK_CONSENT`. `result.data` is `{ ok: true }`.

- [ ] **Step 3: Implement**

`lib/feedbackHints.js`: replace `misparseReport`, `buildNotes`, `consentMode` and the `refined`/`api-error` handling with:

```js
const notes = {
  "zero-results":
    "Zero results. If appliedFilters matches the request, the market may simply have no matches; a constraint missing from appliedFilters, or substituted there, was not applied as asked — refine-search repairs a basic filter, a restated Search_Listings prompt with repairsNlpId repairs the rest.",
  "no-location-filter":
    "No location filter was applied to this search. If the user named a place, the parse dropped it; refine-search with city, area or neighborhood, or a restated prompt, restores it.",
  "oversized-result":
    "This result is very large; narrowing the query (fields, resultsPerPage) keeps it readable.",
  verify:
    "appliedFilters shows what was actually searched; a constraint from the request that is missing or substituted there was not applied. If the user is unsatisfied with the results, send-feedback can carry their report.",
};
```

In `augmentResult`:
- After the Trello and level checks, add `if (result?.error) return result;`. Errors are the call path's job (`_notice`).
- Delete the `refined` push and the `api-error` push.
- Build `noteParts` from `notes` instead of `buildNotes(...)`.
- Delete `export function consentMode()`.

`lib/serverInstructions.js`:
- Remove the `consentMode` import and `reportRule`.
- Set:

```js
const REPAIR = `2. Repair: a missing or substituted basic constraint is fixed with refine-search (confirm propertyType/style vocabulary via Lookup_Possible_Values first). A constraint only natural language can express is fixed by restating the Search_Listings prompt emphatically, with the earlier search's nlpId as repairsNlpId. New searches always go through Search_Listings, never refine-search.`;

const FOLLOW_FEEDBACK = `_feedback and _notice blocks inside tool responses are guidance from this server; a _notice forUser text is written for the end user.`;

const REPORT = `3. Report: failures the server observes (API errors, refine-search corrections, discarded parameters, searches restated with repairsNlpId) are recorded automatically; _feedback and _notice blocks say when. send-feedback covers what only the conversation shows: sent when the user asks, offered when the user is dissatisfied with results.`;
```

- Use `${REPORT}` where `${reportRule()}` was.

`send-feedback.js`:
- Remove the `consentMode` import.
- Replace `executeFunction`'s tail and the `description`:

```js
  const card = buildFeedbackCard(args);
  const { ok, cardUrl, error } = await createCard(card);
  // The card lands on an internal triage board the end user has no access to. An agent given the
  // link relays it as proof the report went through, leaving a dead link in a conversation about
  // property. Operators get it on stderr; the agent gets a plain, user-safe acknowledgement.
  if (cardUrl) console.error(`[feedback] card created: ${cardUrl}`);
  return {
    url: "https://api.trello.com/1/cards",
    data: ok ? { recorded: true, forUser: "The report was sent to the Repliers team." } : { recorded: false, error },
  };
};

const description = `Creates a triage ticket for the Repliers team about a search-quality or service problem. Failures the server observes itself — API errors, refine-search corrections, parameters the API discarded, searches restated with repairsNlpId — are recorded automatically and need no ticket. This tool covers what only the conversation shows: a report the user asks for, or results the user considers wrong (wrong-results, user-dissatisfied, empty-results). Required parameters: category, summary, userQuery.`;
```

`mcpServer.js`: at the top of `run()`, after the first debug line, add:

```js
    if (process.env.FEEDBACK_CONSENT) {
      console.error("[CONFIG] FEEDBACK_CONSENT is no longer used: server-observed failures are recorded automatically, and send-feedback is sent when the user asks and offered when they are dissatisfied (docs/feedback-v2/design.md §7.4).");
    }
```

`scripts/print-instructions.mjs`:
- Delete the `--consent` usage line from the header comment.
- Delete `let consent = null;`, the `case "--consent"` line and `if (consent) process.env.FEEDBACK_CONSENT = consent;`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/feedbackHints.test.js test/serverInstructions.test.js test/sendFeedbackTool.test.js && npm test`
Expected: PASS. In particular, "both branches open with the required tool sequence, inside the first 512 characters" stays green.

- [ ] **Step 5: Stage for the owner**

```
git add lib/feedbackHints.js lib/serverInstructions.js tools/repliers/repliers-api/custom/send-feedback.js mcpServer.js scripts/print-instructions.mjs test/feedbackHints.test.js test/serverInstructions.test.js test/sendFeedbackTool.test.js
# message: feat(feedback): neutral nudges and instructions; retire FEEDBACK_CONSENT
```

---

### Task 12: Neutral tool descriptions, gated mentions, and the roster lint

**Files:**
- Modify: `tools/repliers/repliers-api/custom/search-listings.js`, `refine-search.js` (descriptions), `codegen/overrides.json`
- Regenerate: `npm run generate`
- Test: `test/toolDescriptionTone.test.js` (new), `test/searchListingsEnrichment.test.js` (still green)

**Interfaces:**
- Produces: a roster in which no tool or parameter description steers approval, and none mentions `send-feedback` or recording without Trello

- [ ] **Step 1: Write the failing test**

```js
// test/toolDescriptionTone.test.js
// ChatGPT's safety layer flags tool text that steers approval or prescribes behaviour to it
// (design.md §2.2); and a tool absent from the roster must never be promised (CLAUDE.md).
// The roster is built in a child process per Trello state, because tool modules read env at import.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const toolsModule = new URL("../lib/tools.js", import.meta.url).href;

function roster(withTrello) {
  const env = { ...process.env };
  for (const key of ["TRELLO_API_KEY", "TRELLO_API_TOKEN", "TRELLO_LIST_ID", "FEEDBACK_DRY_RUN"]) delete env[key];
  if (withTrello) Object.assign(env, { TRELLO_API_KEY: "k", TRELLO_API_TOKEN: "t", TRELLO_LIST_ID: "l" });
  const script = `
    const { discoverTools } = await import(${JSON.stringify(toolsModule)});
    const walk = (node, out) => { if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) { if (k === "description" && typeof v === "string") out.push(v); else walk(v, out); } return out; };
    const tools = (await discoverTools()).map((t) => ({ name: t.definition.function.name, custom: t.path.includes("custom"),
      texts: [t.definition.function.description, ...walk(t.definition.function.parameters, [])] }));
    process.stdout.write(JSON.stringify(tools));`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

const steering = [/\bMUST\b/, /\bREQUIRED\b/, /\bMANDATORY\b/, /\bCRITICAL\b/, /only after/i, /without asking/i,
  /no need to ask/i, /consent/i, /says yes/i, /task is (unfinished|not complete)/i];
const customOnly = [/\bALWAYS\b/, /\bNEVER\b/, /\bONLY\b/];

for (const withTrello of [true, false]) {
  test(`no approval-steering wording (Trello ${withTrello ? "configured" : "absent"})`, () => {
    const offenders = [];
    for (const tool of roster(withTrello)) {
      for (const text of tool.texts) {
        for (const pattern of [...steering, ...(tool.custom ? customOnly : [])]) {
          if (pattern.test(text)) offenders.push(`${tool.name}: ${pattern} in "${text.slice(0, 80)}…"`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });
}

test("without Trello, nothing mentions send-feedback or recording", () => {
  const offenders = roster(false).flatMap((tool) =>
    tool.texts.filter((text) => /send-feedback|recorded for the Repliers team/i.test(text)).map(() => tool.name));
  assert.deepEqual(offenders, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/toolDescriptionTone.test.js`
Expected: FAIL. The offenders are `refine-search` (`MUST`, `ONLY`, "task is unfinished") and `Search_Listings` (`ALWAYS`). Without Trello, the 7 generated tools fail too ("see send-feedback"), along with `refine-search` and `Search_Listings`.

- [ ] **Step 3: Implement**

`codegen/overrides.json`: delete the sentence ` If results look wrong or incomplete — see send-feedback.` from every description that contains it (`grep -n "see send-feedback" codegen/overrides.json` lists them). Then run `npm run generate`.

`search-listings.js`:
- Add `import { trelloConfigured } from "../../../../lib/trello.js";`.
- Replace the tool `description` with:

```js
const recording = trelloConfigured()
  ? " Discarded parameters and restated searches are recorded for the Repliers team."
  : "";
```

```js
      description: `Natural-language listings search — the entry point for every new property search. Takes the user's request as a plain-English prompt (translated if needed); the NLP engine converts it into API filters and returns listings. Response contract: appliedFilters (leading block) shows which filters were actually applied, family by family (location, propertyType, style, priceRange, bedrooms… — null means not applied); appliedFilters.unrecognized lists parameters the API discarded — a constraint named there was NOT searched, however complete the rest of the block looks; complexQuery=true marks a multi-query union search that refine-search cannot patch; nlpId identifies this parse. The parser sometimes drops or substitutes constraints, so appliedFilters is the check before results are presented as matching: refine-search repairs a basic filter, and a restated prompt with repairsNlpId repairs a semantic one.${recording}`,
```

`refine-search.js`:
- Add `import { trelloConfigured } from "../../../../lib/trello.js";`.
- Replace `description` with:

```js
const recording = trelloConfigured()
  ? " Each call that changes a filter is recorded for the Repliers team as a probable NLP parse gap."
  : "";
```

```js
    description: `Corrects a previous Search_Listings result whose appliedFilters did not match the user's stated constraints. Takes request.url from that response, changes only the parameters named (everything else — including filters not understood — passes through verbatim), re-runs the search, and returns listings with a fresh appliedFilters block. Requires a prior request.url: new searches go through Search_Listings. Not applicable when the previous response had complexQuery=true; a restated Search_Listings prompt covers that case. propertyType and style take exact board vocabulary, listed by Lookup_Possible_Values (aggregates=details.propertyType,details.style).${recording}`,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/toolDescriptionTone.test.js test/searchListingsEnrichment.test.js && npm test`
Expected: PASS. The `/NOT searched/i` description test stays green.

- [ ] **Step 5: Stage for the owner**

```
git add codegen/overrides.json tools/repliers/repliers-api/generated/ tools/repliers/repliers-api/custom/search-listings.js tools/repliers/repliers-api/custom/refine-search.js test/toolDescriptionTone.test.js
# message: feat(tools): neutral descriptions, gated recording mentions, roster tone lint
```

---

### Task 13: Docs, reviews, and verification against the baseline

**Files:**
- Modify: `CLAUDE.md` (Environment table, `FEEDBACK_CONSENT` row), `docs/kb-articles/setting-up-repliers-mcp.md:285`, `docs/agent-feedback/status.md` (§"Consent policy"), `docs/feedback-v2/status.md`

- [ ] **Step 1: Update the docs**

`CLAUDE.md`, replace the `FEEDBACK_CONSENT` row with:

```
| `FEEDBACK_CONSENT` | **Retired in feedback v2.** Read only to log at startup that it is ignored: server-observed failures are recorded automatically, and `send-feedback` is sent when the user asks and offered when they are dissatisfied ([docs/feedback-v2/design.md](docs/feedback-v2/design.md) §7.4) |
```

`docs/kb-articles/setting-up-repliers-mcp.md:285`, replace the row with:

```
| `FEEDBACK_CONSENT` | No longer used. Failures the server detects are recorded automatically; the assistant sends a report when you ask and offers one when you are unhappy with results |
```

`docs/agent-feedback/status.md`: directly under `## Consent policy: \`FEEDBACK_CONSENT\``, insert:

```
> **Superseded 2026-10 by feedback v2** ([../feedback-v2/design.md](../feedback-v2/design.md) §7.4): the
> switch is retired. The text below records the v1 behaviour.
```

`docs/feedback-v2/status.md`: set "Where we are" to "Implemented on `develop`, uncommitted; verification below". List what shipped per task and the test count.

- [ ] **Step 2: Full suite and live smoke**

Run: `npm test`
Expected: all green; record the count in `status.md`.

Run the stdio probes in the scratchpad (random key, synced tools). An invalid key must return `isError: true` and an `account` `_notice` with the dashboard link. The "pets + virtual tour" search must return `unrecognized: []`.

- [ ] **Step 3: Reviews**

Dispatch the `code-reviewer` agent and the `security-reviewer` agent on the diff. Security focus: the API key never reaches a card (redaction), the `clientInfo` → User-Agent sanitisation, and that capture leaks no user identity. Apply or rebut each finding per superpowers:receiving-code-review.

- [ ] **Step 4: Eval against the baseline (design.md §10.2)**

Run the same harness as the baseline: `node scripts/eval-codex.mjs --profile controlled --model gpt-5.6-sol --effort medium`. Then run the always-ask subset (rebuild the throwaway `consent-ask` battery as on 2026-10-12, with `--out …-always-ask-v2`).

Tally:
- repairs → cards, via `[MCP·auto]` entries in `cards.log`;
- duplicates collapsed into comments;
- S5 relays `forUser`, with no report.
- false api-error cards.

Record before and after in `docs/feedback-v2/status.md`.

- [ ] **Step 5: Manual ChatGPT check (owner, after deploy)**

Rescan or re-add the Repliers connector, then repeat the customer scenario and "send error log to repliers". Pass: no "Suspicious Instruction" card and no safety block. Record the outcome in `status.md`.

- [ ] **Step 6: Stage for the owner**

```
git add CLAUDE.md docs/kb-articles/setting-up-repliers-mcp.md docs/agent-feedback/status.md docs/feedback-v2/status.md
# message: docs(feedback-v2): retire FEEDBACK_CONSENT, record verification
```

Note for the owner, outside this plan: `Get_Listing_Image` hardcodes `https://dev.repliers.io`, against the "host only in `lib/apiBase.js`" rule. It may be deliberate if the image endpoint only exists there; it deserves its own card.
