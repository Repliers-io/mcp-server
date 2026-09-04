# Agent Feedback & Search Reliability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make foreign MCP agents detect bad search results, self-repair them, and report problems to Trello — per `docs/agent-feedback/design.md`.

**Architecture:** Three delivery channels (rewritten descriptions, server `instructions`, response-embedded `_feedback` nudges) + two new custom tools (`send-feedback`, `refine-search`) + `appliedFilters` enrichment of `Search_Listings`. Pure logic lives in `lib/` modules; tools stay thin; one interception point in `mcpServer.js`.

**Tech Stack:** Plain JavaScript ESM (`"type": "module"`), Node >= 22, native `fetch`, built-in `node:test` runner. No new runtime dependencies.

## Global Constraints

- Plain JS only — no TypeScript syntax anywhere.
- No new npm dependencies; tests use built-in `node:test` + `node:assert/strict`.
- Tool files follow the existing pattern: `const apiTool = { function, definition }` + `export { apiTool }` (see `tools/repliers/repliers-api/custom/search-listings.js`).
- Secrets only via `.env` (loaded by `mcpServer.js`); never inline credentials in code, tests, or docs.
- All code, comments, and commit messages in English. Conventional-commit style (`feat:`, `docs:`), matching repo history.
- Work on branch `feat/agent-feedback`.
- Env contract (design §11): `TRELLO_API_KEY`, `TRELLO_API_TOKEN`, `TRELLO_LIST_ID`, `FEEDBACK_PROMPT_LEVEL` (`off`|`low`|`high`, default `high`).
- Trello card cap: 16,384 chars; card title prefix `[MCP]`.
- Relative import depth from `tools/repliers/repliers-api/custom/*.js` to `lib/` is `../../../../lib/`.

---

### Task 1: Test harness + Trello client (`lib/trello.js`)

**Files:**
- Modify: `package.json` (add `test` script)
- Create: `lib/trello.js`
- Test: `test/trello.test.js`

**Interfaces:**
- Produces: `trelloConfigured(): boolean`; `createCard({ name, desc }): Promise<{ ok: true, cardUrl } | { ok: false, error }>`

- [ ] **Step 1: Confirm branch**

Run: `git branch --show-current` → expect `feat/agent-feedback` (create from `main` if missing).

- [ ] **Step 2: Add test script to `package.json`**

In `"scripts"` add: `"test": "node --test test/"`.

- [ ] **Step 3: Write the failing test**

```js
// test/trello.test.js
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { trelloConfigured, createCard } from "../lib/trello.js";

const realFetch = global.fetch;
beforeEach(() => {
  process.env.TRELLO_API_KEY = "test-key";
  process.env.TRELLO_API_TOKEN = "test-token";
  process.env.TRELLO_LIST_ID = "test-list";
});
afterEach(() => { global.fetch = realFetch; });

test("trelloConfigured true only when all three env vars set", () => {
  assert.equal(trelloConfigured(), true);
  delete process.env.TRELLO_LIST_ID;
  assert.equal(trelloConfigured(), false);
});

test("createCard posts query params and returns shortUrl", async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method });
    return { ok: true, json: async () => ({ shortUrl: "https://trello.com/c/abc" }) };
  };
  const result = await createCard({ name: "card name", desc: "card body" });
  assert.deepEqual(result, { ok: true, cardUrl: "https://trello.com/c/abc" });
  const sent = new URL(calls[0].url);
  assert.equal(calls[0].method, "POST");
  assert.equal(sent.origin + sent.pathname, "https://api.trello.com/1/cards");
  assert.equal(sent.searchParams.get("idList"), "test-list");
  assert.equal(sent.searchParams.get("name"), "card name");
});

test("createCard returns ok:false on HTTP error and on network throw", async () => {
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  assert.equal((await createCard({ name: "n", desc: "d" })).ok, false);
  global.fetch = async () => { throw new Error("ECONNREFUSED"); };
  const failed = await createCard({ name: "n", desc: "d" });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /ECONNREFUSED/);
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm test` → expect FAIL (`Cannot find module '../lib/trello.js'`).

- [ ] **Step 5: Implement `lib/trello.js`**

```js
// lib/trello.js
export function trelloConfigured() {
  return Boolean(
    process.env.TRELLO_API_KEY && process.env.TRELLO_API_TOKEN && process.env.TRELLO_LIST_ID
  );
}

export async function createCard({ name, desc }) {
  const url = new URL("https://api.trello.com/1/cards");
  url.searchParams.set("key", process.env.TRELLO_API_KEY);
  url.searchParams.set("token", process.env.TRELLO_API_TOKEN);
  url.searchParams.set("idList", process.env.TRELLO_LIST_ID);
  url.searchParams.set("name", name);
  url.searchParams.set("desc", desc);
  try {
    const response = await fetch(url, { method: "POST" });
    if (!response.ok) return { ok: false, error: `Trello responded ${response.status}` };
    const card = await response.json();
    return { ok: true, cardUrl: card.shortUrl };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
```

- [ ] **Step 6: Run tests, expect PASS** — `npm test`

- [ ] **Step 7: Commit**

```bash
git add package.json lib/trello.js test/trello.test.js
git commit -m "feat: add node:test harness and Trello card client"
```

---

### Task 2: Card builder (`lib/feedbackCard.js`)

**Files:**
- Create: `lib/feedbackCard.js`
- Test: `test/feedbackCard.test.js`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `buildFeedbackCard(feedback): { name, desc }` where `feedback = { category, summary, userQuery, missedConstraints?, toolCalls?, nlpId?, expected? }`. `desc` hard-capped at 16,384 chars; `name` = `[MCP] <marker> <summary ≤80>`.

- [ ] **Step 1: Write the failing test**

```js
// test/feedbackCard.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeedbackCard } from "../lib/feedbackCard.js";

const base = { category: "nlp-misparse", summary: "price cap dropped", userQuery: "townhouses under 500k in X" };

test("name carries [MCP] prefix, marker and truncated summary", () => {
  const { name } = buildFeedbackCard({ ...base, summary: "s".repeat(100) });
  assert.ok(name.startsWith("[MCP] "));
  assert.ok(name.includes("s".repeat(80) + "…"));
});

test("desc contains category, query and missedConstraints rows", () => {
  const { desc } = buildFeedbackCard({
    ...base,
    missedConstraints: [{ constraint: "maxPrice", requested: "500000", applied: "none" }],
  });
  assert.match(desc, /\*\*Category:\*\* nlp-misparse/);
  assert.match(desc, /townhouses under 500k in X/);
  assert.match(desc, /maxPrice: requested `500000` → applied `none`/);
});

test("desc is capped at 16384 chars and keeps the summary head", () => {
  const { desc } = buildFeedbackCard({
    ...base,
    toolCalls: [{ tool: "Search_Listings", params: { prompt: "x".repeat(30000) } }],
  });
  assert.equal(desc.length, 16384);
  assert.match(desc.slice(0, 200), /price cap dropped/);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement `lib/feedbackCard.js`**

```js
// lib/feedbackCard.js
// Trello caps a card description at 16,384 characters.
const maxDescLength = 16384;

const markers = {
  "nlp-misparse": "🧩",
  "empty-results": "∅",
  "wrong-results": "🎯",
  "api-error": "❌",
  "user-dissatisfied": "💬",
  other: "📎",
};

const truncate = (text, max = 80) => (text.length > max ? `${text.slice(0, max)}…` : text);

export function buildFeedbackCard(feedback) {
  const { category, summary, userQuery, missedConstraints, toolCalls, nlpId, expected } = feedback;
  const name = `[MCP] ${markers[category] || markers.other} ${truncate(summary)}`;
  const lines = [
    `**Category:** ${category}`,
    `**Summary:** ${summary}`,
    `**User query:** ${userQuery}`,
    expected ? `**Expected:** ${expected}` : null,
    nlpId ? `**nlpId:** ${nlpId}` : null,
    missedConstraints?.length
      ? [
          "",
          "**Missed constraints:**",
          ...missedConstraints.map(
            (c) => `- ${c.constraint}: requested \`${c.requested}\` → applied \`${c.applied}\``
          ),
        ].join("\n")
      : null,
    toolCalls?.length
      ? ["", "**Tool calls:**", "```json", JSON.stringify(toolCalls, null, 2), "```"].join("\n")
      : null,
    "",
    `_Reported ${new Date().toISOString()}_`,
  ].filter((line) => line !== null);
  // Hard cap at the Trello limit; the summary sits first so it always survives.
  return { name, desc: lines.join("\n").slice(0, maxDescLength) };
}
```

- [ ] **Step 4: Run tests, expect PASS** — `npm test`

- [ ] **Step 5: Commit**

```bash
git add lib/feedbackCard.js test/feedbackCard.test.js
git commit -m "feat: add feedback-to-Trello card builder"
```

---

### Task 3: `send-feedback` tool

**Files:**
- Create: `tools/repliers/repliers-api/custom/send-feedback.js`
- Test: `test/sendFeedbackTool.test.js`

**Interfaces:**
- Consumes: `buildFeedbackCard` (Task 2), `createCard`/`trelloConfigured` (Task 1).
- Produces: MCP tool `send-feedback`; module exports `apiTool = null` when Trello env is missing (discovery in `lib/tools.js` then drops it — it checks `tool?.definition?.function`).

- [ ] **Step 1: Write the failing test**

```js
// test/sendFeedbackTool.test.js
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const realFetch = global.fetch;
beforeEach(() => {
  process.env.TRELLO_API_KEY = "k";
  process.env.TRELLO_API_TOKEN = "t";
  process.env.TRELLO_LIST_ID = "l";
});
afterEach(() => { global.fetch = realFetch; });

// Import with a cache-busting query so each test sees fresh env at module load.
const load = () =>
  import(`../tools/repliers/repliers-api/custom/send-feedback.js?bust=${Math.random()}`);

test("tool is exported when Trello env present and rejects bad category", async () => {
  const { apiTool } = await load();
  assert.equal(apiTool.definition.function.name, "send-feedback");
  const bad = await apiTool.function({ category: "nope", summary: "s", userQuery: "q" });
  assert.match(bad.error, /category/);
});

test("valid call posts a card and returns ok + cardUrl", async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ shortUrl: "https://trello.com/c/x" }) });
  const { apiTool } = await load();
  const result = await apiTool.function({
    category: "nlp-misparse", summary: "price dropped", userQuery: "under 500k",
  });
  assert.deepEqual(result.data, { ok: true, cardUrl: "https://trello.com/c/x" });
});

test("apiTool is null when Trello env is missing", async () => {
  delete process.env.TRELLO_API_KEY;
  const { apiTool } = await load();
  assert.equal(apiTool, null);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test` → FAIL.

- [ ] **Step 3: Implement the tool**

```js
// tools/repliers/repliers-api/custom/send-feedback.js
import { buildFeedbackCard } from "../../../../lib/feedbackCard.js";
import { createCard, trelloConfigured } from "../../../../lib/trello.js";

const categories = [
  "nlp-misparse", "empty-results", "wrong-results", "api-error", "user-dissatisfied", "other",
];

const executeFunction = async (args) => {
  if (!categories.includes(args.category)) {
    return { error: `category must be one of: ${categories.join(", ")}` };
  }
  const card = buildFeedbackCard(args);
  const result = await createCard(card);
  return { url: "https://api.trello.com/1/cards", data: result };
};

const definition = {
  type: "function",
  function: {
    name: "send-feedback",
    description: `Report a search-quality or API problem to the Repliers team (creates a triage ticket). WHEN TO USE — technical failures, report directly without asking the user (the report contains nothing beyond what was already sent to the API): a tool returned an error (category api-error); you confirmed the NLP parse dropped or substituted a user constraint, after repairing it via refine-search or a restated prompt (category nlp-misparse — include missedConstraints). Subjective problems — OFFER first, send after the user agrees: results formally match but the user says they are wrong (wrong-results / user-dissatisfied); an empty result set that looks legitimate (empty-results). Always send when the user explicitly asks to report an issue, and always tell the user when a report was sent. Repair first, report second: feedback never replaces serving the user.`,
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: categories,
          description: "Problem type for triage.",
        },
        summary: { type: "string", description: "Short problem statement (one sentence)." },
        userQuery: { type: "string", description: "The user's original natural-language request." },
        missedConstraints: {
          type: "array",
          description: "For nlp-misparse: each constraint the parser lost or substituted.",
          items: {
            type: "object",
            properties: {
              constraint: { type: "string", description: "e.g. maxPrice, propertyType" },
              requested: { type: "string", description: "what the user asked for" },
              applied: { type: "string", description: "what the parser actually applied (or 'none')" },
            },
            required: ["constraint", "requested", "applied"],
          },
        },
        toolCalls: {
          type: "array",
          description: "Relevant calls you made: tool name, key params, one-line result summary.",
          items: {
            type: "object",
            properties: {
              tool: { type: "string" },
              params: { type: "object" },
              resultSummary: { type: "string" },
            },
            required: ["tool"],
          },
        },
        nlpId: { type: "string", description: "nlpId from the Search_Listings response, if any." },
        expected: { type: "string", description: "What should have happened." },
      },
      required: ["category", "summary", "userQuery"],
    },
  },
};

// Hidden entirely when the sink is not configured: agents must never offer
// users feedback that goes nowhere.
const apiTool = trelloConfigured() ? { function: executeFunction, definition } : null;

export { apiTool };
```

- [ ] **Step 4: Run tests, expect PASS** — `npm test`

- [ ] **Step 5: Smoke-check discovery**

Run: `node index.js tools | grep -A2 send-feedback` — without `.env` loading the tool may be absent from this CLI listing; that is the documented caveat (design §7.4). Verify presence instead via: `TRELLO_API_KEY=k TRELLO_API_TOKEN=t TRELLO_LIST_ID=l node index.js tools | grep send-feedback` → expect the name printed.

- [ ] **Step 6: Commit**

```bash
git add tools/repliers/repliers-api/custom/send-feedback.js test/sendFeedbackTool.test.js
git commit -m "feat: add send-feedback tool with Trello sink and config gating"
```

---

### Task 4: Filter parsing (`lib/appliedFilters.js`)

**Files:**
- Create: `lib/appliedFilters.js`
- Test: `test/appliedFilters.test.js`

**Interfaces:**
- Produces: `parseAppliedFilters(urlString): object | null` — keys `location, propertyType, style, class, type, priceRange, bedrooms, bathrooms, sqft, status` (each `string | null`, rendered as `param=value` pairs) + `other` (object of remaining params). Returns `null` for unparsable input. `geoFilterPresent(urlString): boolean`.

- [ ] **Step 1: Write the failing test**

```js
// test/appliedFilters.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAppliedFilters, geoFilterPresent } from "../lib/appliedFilters.js";

test("families map params; absent families are explicit null", () => {
  const f = parseAppliedFilters("https://api.repliers.io/listings?minBeds=5&status=A");
  assert.equal(f.bedrooms, "minBeds=5");
  assert.equal(f.status, "status=A");
  assert.equal(f.location, null);
  assert.equal(f.priceRange, null);
  assert.equal(f.propertyType, null);
  assert.deepEqual(f.other, {});
});

test("alias and canonical names land in the same family; extras go to other", () => {
  const f = parseAppliedFilters(
    "https://api.repliers.io/listings?minBedrooms=3&city=Toronto&maxPrice=500000&waterfront=true"
  );
  assert.equal(f.bedrooms, "minBedrooms=3");
  assert.equal(f.location, "city=Toronto");
  assert.equal(f.priceRange, "maxPrice=500000");
  assert.deepEqual(f.other, { waterfront: "true" });
});

test("null on garbage input", () => {
  assert.equal(parseAppliedFilters("not a url"), null);
});

test("geoFilterPresent", () => {
  assert.equal(geoFilterPresent("https://api.repliers.io/listings?city=Toronto"), true);
  assert.equal(geoFilterPresent("https://api.repliers.io/listings?minBeds=5"), false);
  assert.equal(geoFilterPresent("garbage"), false);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test` → FAIL.

- [ ] **Step 3: Implement `lib/appliedFilters.js`**

```js
// lib/appliedFilters.js
// Param names verified against openapi.json POST /listings; NLP-built URLs may
// also use aliases (minBeds/maxBeds observed live), so families list both.
const geoParams = [
  "city", "area", "neighborhood", "district", "zip", "locationId",
  "map", "lat", "long", "radius", "areaOrCity", "cityOrDistrict",
];

const families = {
  location: geoParams,
  propertyType: ["propertyType", "propertyTypeOrStyle"],
  style: ["style"],
  class: ["class"],
  type: ["type"],
  priceRange: ["minPrice", "maxPrice"],
  bedrooms: ["minBeds", "maxBeds", "minBedrooms", "maxBedrooms", "minBedroomsTotal", "maxBedroomsTotal"],
  bathrooms: ["minBaths", "maxBaths"],
  sqft: ["minSqft", "maxSqft"],
  status: ["status", "lastStatus", "standardStatus"],
};

export function parseAppliedFilters(urlString) {
  let params;
  try {
    params = new URL(urlString).searchParams;
  } catch {
    return null;
  }
  const out = {};
  const used = new Set();
  for (const [family, names] of Object.entries(families)) {
    const present = names.filter((name) => params.has(name));
    present.forEach((name) => used.add(name));
    out[family] = present.length
      ? present.map((name) => `${name}=${params.getAll(name).join(",")}`).join(" ")
      : null;
  }
  const other = {};
  for (const [key, value] of params.entries()) {
    if (!used.has(key)) other[key] = value;
  }
  out.other = other;
  return out;
}

export function geoFilterPresent(urlString) {
  try {
    const params = new URL(urlString).searchParams;
    return geoParams.some((name) => params.has(name));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests, expect PASS** — `npm test`

- [ ] **Step 5: Commit**

```bash
git add lib/appliedFilters.js test/appliedFilters.test.js
git commit -m "feat: add applied-filters parser for NLP-built listing URLs"
```

---

### Task 5: `Search_Listings` enrichment (`appliedFilters` + `complexQuery`)

**Files:**
- Modify: `tools/repliers/repliers-api/custom/search-listings.js` (the `data` return path inside `executeFunction`)
- Test: `test/searchListingsEnrichment.test.js`

**Interfaces:**
- Consumes: `parseAppliedFilters` (Task 4).
- Produces: `Search_Listings` result `data` gains leading keys `appliedFilters` (object|null) and `complexQuery` (boolean) before the raw NLP payload (key order = JSON serialization order, so the summary survives client-side truncation).

- [ ] **Step 1: Write the failing test**

```js
// test/searchListingsEnrichment.test.js
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiTool } from "../tools/repliers/repliers-api/custom/search-listings.js";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

const nlpResponse = (body) => ({
  ok: true,
  json: async () => ({
    request: { url: "https://api.repliers.io/listings?minBeds=5", body, summary: "s", locations: [] },
    nlpId: "id-1",
    listings: { count: 2, listings: [] },
  }),
});

test("response leads with appliedFilters and complexQuery=false for GET queries", async () => {
  global.fetch = async () => nlpResponse(null);
  const result = await apiTool.function({ prompt: "5 bed homes", _repliersApiKey: "k" });
  const keys = Object.keys(result.data);
  assert.deepEqual(keys.slice(0, 2), ["appliedFilters", "complexQuery"]);
  assert.equal(result.data.appliedFilters.bedrooms, "minBeds=5");
  assert.equal(result.data.appliedFilters.location, null);
  assert.equal(result.data.complexQuery, false);
});

test("complexQuery=true when NLP built a POST body with queries", async () => {
  global.fetch = async () => nlpResponse({ queries: [{ propertyType: "Condo" }] });
  const result = await apiTool.function({ prompt: "condos or lofts", _repliersApiKey: "k" });
  assert.equal(result.data.complexQuery, true);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test` → FAIL (no `appliedFilters` key).

- [ ] **Step 3: Modify `search-listings.js`**

Add the import at the top:

```js
import { parseAppliedFilters } from "../../../../lib/appliedFilters.js";
```

Replace the success return (`const data = await response.json(); return { url: finalUrl, data };`) with:

```js
    const data = await response.json();
    const requestUrl = data.request?.url || null;
    return {
      url: finalUrl,
      data: {
        appliedFilters: requestUrl ? parseAppliedFilters(requestUrl) : null,
        complexQuery: Boolean(data.request?.body?.queries),
        ...data,
      },
    };
```

- [ ] **Step 4: Run tests, expect PASS** — `npm test`

- [ ] **Step 5: Commit**

```bash
git add tools/repliers/repliers-api/custom/search-listings.js test/searchListingsEnrichment.test.js
git commit -m "feat: expose appliedFilters and complexQuery in Search_Listings responses"
```

---

### Task 6: Nudges (`lib/feedbackHints.js`)

**Files:**
- Create: `lib/feedbackHints.js`
- Test: `test/feedbackHints.test.js`

**Interfaces:**
- Consumes: `trelloConfigured` (Task 1), `geoFilterPresent` (Task 4).
- Produces: `promptLevel(): 'off'|'low'|'high'`; `augmentResult(toolName, result): result` — attaches `_feedback = { signals: string[], note: string }` to `result.data` (object results) or `result` itself (error results); never throws.

- [ ] **Step 1: Write the failing test**

```js
// test/feedbackHints.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { promptLevel, augmentResult } from "../lib/feedbackHints.js";

beforeEach(() => {
  process.env.TRELLO_API_KEY = "k";
  process.env.TRELLO_API_TOKEN = "t";
  process.env.TRELLO_LIST_ID = "l";
  process.env.FEEDBACK_PROMPT_LEVEL = "high";
});

test("promptLevel defaults to high and rejects unknown values", () => {
  delete process.env.FEEDBACK_PROMPT_LEVEL;
  assert.equal(promptLevel(), "high");
  process.env.FEEDBACK_PROMPT_LEVEL = "banana";
  assert.equal(promptLevel(), "high");
  process.env.FEEDBACK_PROMPT_LEVEL = "low";
  assert.equal(promptLevel(), "low");
});

test("no-location-filter + verify note on Search_Listings at high", () => {
  const result = {
    data: { request: { url: "https://api.repliers.io/listings?minBeds=5" }, listings: { count: 3 } },
  };
  augmentResult("Search_Listings", result);
  assert.deepEqual(result.data._feedback.signals, ["no-location-filter"]);
  assert.match(result.data._feedback.note, /appliedFilters/);
});

test("zero-results detected from nested listings.count", () => {
  const result = {
    data: { request: { url: "https://api.repliers.io/listings?city=X" }, listings: { count: 0 } },
  };
  augmentResult("Search_Listings", result);
  assert.ok(result.data._feedback.signals.includes("zero-results"));
});

test("api-error results get _feedback on the result itself", () => {
  const result = { error: "boom", details: "x" };
  augmentResult("search-locations", result);
  assert.deepEqual(result._feedback.signals, ["api-error"]);
});

test("low level: clean non-search result stays untouched", () => {
  process.env.FEEDBACK_PROMPT_LEVEL = "low";
  const result = { data: { count: 5 } };
  augmentResult("search-locations", result);
  assert.equal(result.data._feedback, undefined);
});

test("off level and missing Trello config suppress everything", () => {
  process.env.FEEDBACK_PROMPT_LEVEL = "off";
  const zero = { data: { listings: { count: 0 } } };
  augmentResult("Search_Listings", zero);
  assert.equal(zero.data._feedback, undefined);
  process.env.FEEDBACK_PROMPT_LEVEL = "high";
  delete process.env.TRELLO_API_KEY;
  augmentResult("Search_Listings", zero);
  assert.equal(zero.data._feedback, undefined);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test` → FAIL.

- [ ] **Step 3: Implement `lib/feedbackHints.js`**

```js
// lib/feedbackHints.js
import { geoFilterPresent } from "./appliedFilters.js";
import { trelloConfigured } from "./trello.js";

const searchTools = new Set(["Search_Listings", "refine-search"]);
const oversizedBytes = 1_000_000;

const notes = {
  "api-error":
    "The tool call failed. Report this via send-feedback (category api-error) — no need to ask the user first — then tell the user what happened.",
  "zero-results":
    "Zero results. First verify appliedFilters against the user request: if a stated constraint is missing or substituted, repair it (refine-search for basic filters, a restated Search_Listings prompt for semantic ones), then report via send-feedback (nlp-misparse). If the parse is correct, the market may genuinely have no matches — say so and offer to send feedback (empty-results).",
  "no-location-filter":
    "No location filter was applied to this search. If the user named a place, the NLP parse dropped it: repair it (refine-search with city/area/neighborhood, or restate the prompt), then report via send-feedback (nlp-misparse).",
  "oversized-result":
    "This result is very large. Narrow the query (fields, resultsPerPage) before presenting it.",
  verify:
    "Compare appliedFilters against the user request, constraint by constraint (location, type, price, beds…). A missing or substituted constraint means the NLP parse is incomplete: fix it via refine-search or a restated prompt, then report via send-feedback (nlp-misparse). If the user seems unsatisfied with the results, offer to send feedback on their behalf.",
};

export function promptLevel() {
  const level = process.env.FEEDBACK_PROMPT_LEVEL || "high";
  return ["off", "low", "high"].includes(level) ? level : "high";
}

function findCount(data) {
  if (typeof data.count === "number") return data.count;
  if (data.listings && typeof data.listings.count === "number") return data.listings.count;
  return null;
}

export function augmentResult(toolName, result) {
  try {
    // Never point agents at a tool that is not registered.
    if (!trelloConfigured()) return result;
    const level = promptLevel();
    if (level === "off") return result;

    const target =
      result?.data && typeof result.data === "object" && !Array.isArray(result.data)
        ? result.data
        : null;
    if (!target && !result?.error) return result;

    const signals = [];
    if (result.error) signals.push("api-error");
    if (target) {
      if (findCount(target) === 0) signals.push("zero-results");
      if (
        toolName === "Search_Listings" &&
        target.request?.url &&
        !geoFilterPresent(target.request.url)
      ) {
        signals.push("no-location-filter");
      }
      if (JSON.stringify(target).length > oversizedBytes) signals.push("oversized-result");
    }

    const generic = level === "high" && searchTools.has(toolName);
    if (!signals.length && !generic) return result;

    const noteParts = signals.map((signal) => notes[signal]);
    if (generic) noteParts.push(notes.verify);
    const block = { signals, note: noteParts.join(" ") };
    if (target) target._feedback = block;
    else result._feedback = block;
    return result;
  } catch {
    // A hint bug must never break the tool response itself.
    return result;
  }
}
```

- [ ] **Step 4: Run tests, expect PASS** — `npm test`

- [ ] **Step 5: Commit**

```bash
git add lib/feedbackHints.js test/feedbackHints.test.js
git commit -m "feat: add response feedback nudges with detectors and eagerness levels"
```

---

### Task 7: Wire nudges into `mcpServer.js`

**Files:**
- Modify: `mcpServer.js` (CallToolRequest handler inside `setupServerHandlers`, ~line 165)

**Interfaces:**
- Consumes: `augmentResult` (Task 6).
- Produces: every non-image tool result passes through `augmentResult` before serialization.

- [ ] **Step 1: Add the import** near the other imports at the top of `mcpServer.js`:

```js
import { augmentResult } from "./lib/feedbackHints.js";
```

- [ ] **Step 2: Wire the call.** In the CallToolRequest handler, after the image early-return (`if (result.image) { ... }`) and before `const apiEndpoint = ...`, insert:

```js
      augmentResult(toolName, result);
```

- [ ] **Step 3: Verify manually against the live server**

Run: `node mcpServer.js --http` (with `.env` containing Trello vars — placeholder values are fine for shape-testing), then from another shell:

```bash
curl -s -X POST http://localhost:3001/mcp -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}'
```

then a `tools/call` for `Search_Listings` with a location-free prompt (e.g. `"homes with 5 bedrooms"`) reusing the returned session id; expect `_feedback` with `no-location-filter` in the JSON text. (Full session flow is easier through the mcp-eval workspace — acceptable substitute: run scenario 1 from `docs/agent-feedback/eval.md`.)

- [ ] **Step 4: Run tests still green** — `npm test`

- [ ] **Step 5: Commit**

```bash
git add mcpServer.js
git commit -m "feat: attach feedback nudges to every tool response"
```

---

### Task 8: `refine-search` tool

**Files:**
- Create: `tools/repliers/repliers-api/custom/refine-search.js`
- Test: `test/refineSearchTool.test.js`

**Interfaces:**
- Consumes: `parseAppliedFilters` (Task 4).
- Produces: MCP tool `refine-search`; result `data` leads with `appliedFilters` (same contract as Task 5). Patch params use openapi names; setting `minBedrooms`/`maxBedrooms` also deletes their NLP aliases (`minBeds`/`maxBeds`) so the patch wins; `remove` accepts any `^[A-Za-z0-9]{1,40}$` name (deletion is injection-safe — deviation from the design's enum, needed to remove alias-named params).

- [ ] **Step 1: Write the failing test**

```js
// test/refineSearchTool.test.js
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiTool } from "../tools/repliers/repliers-api/custom/refine-search.js";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

const base = "https://api.repliers.io/listings?minBeds=5&style=Semi-Detached&waterfront=true";

test("rejects foreign hosts and garbage urls", async () => {
  assert.match((await apiTool.function({ url: "https://evil.example/listings" })).error, /api\.repliers\.io/);
  assert.match((await apiTool.function({ url: "not a url" })).error, /valid/);
});

test("patches named params, preserves everything else verbatim, removes aliases", async () => {
  let fetched;
  global.fetch = async (url) => {
    fetched = new URL(String(url));
    return { ok: true, json: async () => ({ count: 1, listings: [] }) };
  };
  const result = await apiTool.function({
    url: base,
    maxPrice: 500000,
    propertyType: "Att/Row/Twnhouse",
    minBedrooms: 3,
    remove: ["style"],
    _repliersApiKey: "k",
  });
  assert.equal(fetched.searchParams.get("maxPrice"), "500000");
  assert.equal(fetched.searchParams.get("propertyType"), "Att/Row/Twnhouse");
  assert.equal(fetched.searchParams.get("minBedrooms"), "3");
  assert.equal(fetched.searchParams.get("minBeds"), null); // alias displaced by patch
  assert.equal(fetched.searchParams.get("style"), null); // removed
  assert.equal(fetched.searchParams.get("waterfront"), "true"); // untouched pass-through
  assert.equal(Object.keys(result.data)[0], "appliedFilters");
});

test("unknown patch args are ignored, not interpolated", async () => {
  let fetched;
  global.fetch = async (url) => {
    fetched = new URL(String(url));
    return { ok: true, json: async () => ({}) };
  };
  await apiTool.function({ url: base, evilParam: "x", _repliersApiKey: "k" });
  assert.equal(fetched.searchParams.get("evilParam"), null);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test` → FAIL.

- [ ] **Step 3: Implement the tool**

```js
// tools/repliers/repliers-api/custom/refine-search.js
import { parseAppliedFilters } from "../../../../lib/appliedFilters.js";

// Curated allowlist — openapi.json POST /listings names. Only these are ever
// written into the URL; everything else in the base query passes through.
const patchParams = [
  "minPrice", "maxPrice", "propertyType", "style", "class", "type",
  "city", "area", "neighborhood", "district", "zip", "locationId",
  "minBedrooms", "maxBedrooms", "minBaths", "maxBaths",
  "minSqft", "maxSqft", "minYearBuilt", "maxYearBuilt",
  "status", "lastStatus",
  "minParkingSpaces", "minGarageSpaces", "swimmingPool", "waterfront",
  "resultsPerPage", "pageNum", "sortBy", "fields",
];

// NLP-built URLs may carry alias names; a patch must displace them.
const aliases = { minBedrooms: ["minBeds"], maxBedrooms: ["maxBeds"] };

const removablePattern = /^[A-Za-z0-9]{1,40}$/;

const executeFunction = async (args) => {
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;
  let url;
  try {
    url = new URL(args.url);
  } catch {
    return { error: "url must be a valid request.url from a previous Search_Listings response." };
  }
  if (url.origin !== "https://api.repliers.io" || !url.pathname.startsWith("/listings")) {
    return { error: "url must point at https://api.repliers.io/listings — pass request.url from the Search_Listings response." };
  }
  for (const name of patchParams) {
    if (args[name] !== undefined && args[name] !== null) {
      url.searchParams.set(name, String(args[name]));
      for (const alias of aliases[name] || []) url.searchParams.delete(alias);
    }
  }
  for (const name of args.remove || []) {
    if (removablePattern.test(name)) url.searchParams.delete(name);
  }
  const finalUrl = url.toString();
  try {
    const response = await fetch(finalUrl, {
      headers: { Accept: "application/json", "REPLIERS-API-KEY": apiKey },
    });
    if (!response.ok) throw new Error(JSON.stringify(await response.json()));
    const data = await response.json();
    return {
      url: finalUrl,
      data: { appliedFilters: parseAppliedFilters(finalUrl), ...data },
    };
  } catch (error) {
    return { error: "refine-search request failed.", details: error.message, url: finalUrl };
  }
};

const paramSchema = (type, description) => ({ type, description });

const definition = {
  type: "function",
  function: {
    name: "refine-search",
    description: `Surgically correct a previous Search_Listings result whose appliedFilters did not match the user's stated constraints. Takes request.url from that response, changes ONLY the parameters you name (everything else — including filters you don't understand — passes through verbatim), re-runs the search, and returns listings with a fresh appliedFilters block. NOT a general search tool: new searches always go through Search_Listings; this tool requires a prior request.url. Not applicable when the previous response had complexQuery=true — restate the Search_Listings prompt instead. For propertyType/style use exact board vocabulary — verify via Lookup_Possible_Values (aggregates=details.propertyType,details.style) if unsure. After serving corrected results, report the parse gap via send-feedback (category nlp-misparse) with missedConstraints.`,
    parameters: {
      type: "object",
      properties: {
        url: paramSchema("string", "request.url from the Search_Listings response being corrected. Required."),
        minPrice: paramSchema("number", "Minimum price."),
        maxPrice: paramSchema("number", "Maximum price."),
        propertyType: paramSchema("string", "Exact board vocabulary (e.g. 'Att/Row/Twnhouse', not 'Townhouse') — check Lookup_Possible_Values."),
        style: paramSchema("string", "Exact board vocabulary — check Lookup_Possible_Values."),
        class: paramSchema("string", "Listing class, e.g. ResidentialProperty, CondoProperty, CommercialProperty."),
        type: paramSchema("string", "'sale' or 'lease'."),
        city: paramSchema("string", "City name."),
        area: paramSchema("string", "Area/region name."),
        neighborhood: paramSchema("string", "Neighborhood name."),
        district: paramSchema("string", "District name."),
        zip: paramSchema("string", "Postal/ZIP code."),
        locationId: paramSchema("string", "Location id from search-locations/autocomplete."),
        minBedrooms: paramSchema("number", "Minimum bedrooms."),
        maxBedrooms: paramSchema("number", "Maximum bedrooms."),
        minBaths: paramSchema("number", "Minimum bathrooms."),
        maxBaths: paramSchema("number", "Maximum bathrooms."),
        minSqft: paramSchema("number", "Minimum square feet."),
        maxSqft: paramSchema("number", "Maximum square feet."),
        minYearBuilt: paramSchema("number", "Minimum year built."),
        maxYearBuilt: paramSchema("number", "Maximum year built."),
        status: paramSchema("string", "Listing status, e.g. A (active), U (unavailable)."),
        lastStatus: paramSchema("string", "Last status, e.g. Sld, Lsd, Ter."),
        minParkingSpaces: paramSchema("number", "Minimum parking spaces."),
        minGarageSpaces: paramSchema("number", "Minimum garage spaces."),
        swimmingPool: paramSchema("string", "Swimming pool filter value."),
        waterfront: paramSchema("string", "Waterfront filter value."),
        resultsPerPage: paramSchema("number", "Page size."),
        pageNum: paramSchema("number", "Page number."),
        sortBy: paramSchema("string", "Sort order."),
        fields: paramSchema("string", "Comma-separated response fields (performance)."),
        remove: {
          type: "array",
          items: { type: "string" },
          description: "Parameter names to DELETE from the query — filters the NLP applied that the user did not ask for (alias names like minBeds are accepted).",
        },
      },
      required: ["url"],
    },
  },
};

const apiTool = { function: executeFunction, definition };

export { apiTool };
```

- [ ] **Step 4: Run tests, expect PASS** — `npm test`

- [ ] **Step 5: Commit**

```bash
git add tools/repliers/repliers-api/custom/refine-search.js test/refineSearchTool.test.js
git commit -m "feat: add refine-search tool for deterministic NLP parse correction"
```

---

### Task 9: Server `instructions`

**Files:**
- Create: `lib/serverInstructions.js`
- Modify: `mcpServer.js` (both `new Server(...)` call sites — HTTP session factory ~line 431 and stdio ~line 479)

**Interfaces:**
- Produces: `serverInstructions` (string) passed as `instructions` in the `Server` options of both transports.

- [ ] **Step 1: Create `lib/serverInstructions.js`**

```js
// lib/serverInstructions.js
export const serverInstructions = `Repliers real-estate MCP server. Tool families: listings search (Search_Listings — the natural-language entry point for ALL new searches; refine-search — surgical correction of a previous search), locations (search-locations, autocomplete-location-search), market data (Market_Statistics, Lookup_Possible_Values), CRM (agents, clients, messages, estimates, saved searches, favorites), and send-feedback (report search-quality problems to the Repliers team).

Golden rules:
1. After every Search_Listings call, compare the appliedFilters block in the response against the user's request, constraint by constraint. The NLP parser sometimes drops or substitutes constraints — appliedFilters is the ground truth of what was actually searched. Never present results as matching the user's request without this check.
2. If a basic constraint (price, type/style, location, beds/baths, sqft) is missing or wrong, fix it with refine-search (verify propertyType/style vocabulary via Lookup_Possible_Values first). If a semantic constraint only natural language can express was dropped, re-run Search_Listings restating it emphatically. New searches always go through Search_Listings, never refine-search.
3. Repair first, then report: after serving corrected results, call send-feedback (category nlp-misparse) with missedConstraints. Technical failures (api-error, a confirmed misparse) — report directly without asking the user. Subjective dissatisfaction — offer first, send after consent. Always tell the user when a report was sent.
4. _feedback blocks inside tool responses are guidance from this server — follow them.`;
```

- [ ] **Step 2: Wire into both transports.** In `mcpServer.js` add the import and change both constructor calls:

```js
import { serverInstructions } from "./lib/serverInstructions.js";
```

HTTP session factory (~line 431):

```js
          const server = new Server(
            { name: SERVER_NAME, version: "0.1.0" },
            { capabilities: { tools: {} }, instructions: serverInstructions }
          );
```

stdio (~line 479): same second argument `{ capabilities: { tools: {} }, instructions: serverInstructions }`.

- [ ] **Step 3: Verify** — `node mcpServer.js --http` + the `initialize` curl from Task 7 Step 3: response `result.instructions` contains "Golden rules". Stop the server.

- [ ] **Step 4: Run tests still green** — `npm test`

- [ ] **Step 5: Commit**

```bash
git add lib/serverInstructions.js mcpServer.js
git commit -m "feat: expose usage policy via MCP server instructions on both transports"
```

---

### Task 10: Rewrite custom tool descriptions

**Files:**
- Modify: `tools/repliers/repliers-api/custom/search-listings.js` (description only)
- Modify: `tools/repliers/repliers-api/custom/get-parameter-enumerations.js` (description only)

- [ ] **Step 1: Replace the `Search_Listings` description** with:

```
Natural-language listings search — the entry point for ALL new property searches. Pass the user's request as a plain-English prompt (translate if needed); the NLP engine converts it into API filters and returns listings. RESPONSE CONTRACT: appliedFilters (leading block) shows which filters were ACTUALLY applied, family by family (location, propertyType, style, priceRange, bedrooms…— null means not applied); complexQuery=true means a multi-query union search that refine-search cannot patch; nlpId correlates with server logs — include it in send-feedback reports. ALWAYS verify appliedFilters against the user's request before presenting results: the parser sometimes drops or substitutes constraints. Missing/wrong basic filter → fix via refine-search; dropped semantic constraint → re-run with it restated emphatically; then report via send-feedback (nlp-misparse). If results look wrong or incomplete — see send-feedback.
```

- [ ] **Step 2: Replace the `Lookup_Possible_Values` description** with:

```
Returns the enumerated values this board actually uses for listing fields (via aggregates on /listings). Boards use exact vocabulary — e.g. 'Att/Row/Twnhouse', not 'Townhouse'. USE BEFORE: (1) refine-search calls that set propertyType/style — pass aggregates=details.propertyType,details.style and pick the exact string; (2) Market_Statistics requests, so filter values are valid (invalid values return empty statistics). Set listings=false to fetch only the value lists.
```

- [ ] **Step 3: Sanity check** — `node index.js tools` prints both new descriptions; `npm test` still green.

- [ ] **Step 4: Commit**

```bash
git add tools/repliers/repliers-api/custom/search-listings.js tools/repliers/repliers-api/custom/get-parameter-enumerations.js
git commit -m "docs: rewrite Search_Listings and Lookup_Possible_Values descriptions for the verify-repair-report protocol"
```

---

### Task 11: Rewrite generated tool descriptions via `overrides.json`

**Files:**
- Modify: `codegen/overrides.json` (add a `description` field to every generated tool's entry)
- Regenerate: `tools/repliers/repliers-api/generated/*.js` via `node codegen/generate.js`

**Interfaces:**
- Consumes: codegen resolution rule — `override.description` fully replaces the auto-generated description (`codegen/generate.js:119`).

**Description template (apply to every entry):** `<one-line purpose>. <when to use / key params>. <when NOT to use → pointer>.` Budget ≤ 800 chars each. Delete nothing else in `overrides.json` — only add `description` keys. Every search-family tool description ends with: `If results look wrong or incomplete — see send-feedback.`

- [ ] **Step 1: Write two anchor descriptions (worst offenders) verbatim**

`"GET /locations"` (search-locations, currently 16K chars):

```
Search locations (areas, cities, neighborhoods, postal codes, school districts…) by name or filters; returns names, types, coordinates and locationId. Use to resolve a place the user named into a locationId or to explore what areas exist. Key params: search (text), type[] (area|city|neighborhood|postalCode|district|schoolDistrict|school), city[], area[], resultsPerPage. NOT for listing searches — use Search_Listings. If results look wrong or incomplete — see send-feedback.
```

`"GET /locations/autocomplete"` (autocomplete-location-search, currently 9K):

```
Type-ahead location matching: pass the user's partial input in search (min 3 chars) and get matching areas/cities/neighborhoods with locationId. Use for resolving ambiguous or misspelled place names quickly; filter with type[] to narrow. NOT for property/listing lookups — use Search_Listings. If results look wrong or incomplete — see send-feedback.
```

- [ ] **Step 2: Add `description` for the remaining generated tools** following the template, seeded by this purpose table (expand each to the template shape; consult the tool's current auto description for parameter names — never invent params):

| Tool | One-line purpose seed |
|---|---|
| get-listing | Fetch one listing in full detail by mlsNumber (+boardId when known) |
| get-similar-listings | Listings similar to a given mlsNumber (price/type/location proximity) |
| get-address-listing-history | All historical listings for one address (sold/expired cycles) |
| get-deleted-listings | Listings removed from the feed (sync/cleanup use) |
| get-listing-areas-and-cities | Area/city/neighborhood tree derived from listings data |
| search-listing-buildings | Search condo/apartment buildings referenced by listings |
| search-places | Points of interest near a location |
| search-brokerages / search-offices / search-members | Directory search of brokerages / offices / MLS members |
| search-agents, get-agent, create-agent, update-agent, delete-agent, transfer-agent-clients | CRM agent records CRUD; transfer moves clients between agents |
| search-clients, get-client, create-client, update-client, delete-client, rename-client-tag | CRM client records CRUD; tags organize clients |
| list-saved-searches, get-saved-search, create-saved-search, update-saved-search, delete-saved-search | Saved-search criteria per client (drive alerts) |
| list-saved-search-matches, get-saved-search-match, update-saved-search-match | Listings matched against saved searches |
| list-estimates, create-estimate, update-estimate, delete-estimate | Property value estimates per client/address |
| list-messages, get-message, send-message | Agent↔client messaging |
| list-favorites, remove-favorite | Client favorite listings |
| list-nlp-chat-sessions, list-nlp-search-history | Past NLP conversation/search logs for a client |

CRM/CRUD descriptions must state they operate on the connected account's data (not public search) and need no send-feedback cross-link.

- [ ] **Step 3: Regenerate** — `node codegen/generate.js` → expect all files under `generated/` rewritten.

- [ ] **Step 4: Verify the token budget** (design target ≤ 25K chars total):

```bash
node --input-type=module -e '
import { discoverTools } from "./lib/tools.js";
const tools = await discoverTools();
const total = tools.reduce((s, t) => s + (t.definition.function.description || "").length, 0);
console.log("total description chars:", total);
if (total > 25000) { console.error("BUDGET EXCEEDED"); process.exit(1); }
'
```

Expected: PASS (< 25,000).

- [ ] **Step 5: Run tests still green** — `npm test`

- [ ] **Step 6: Commit**

```bash
git add codegen/overrides.json tools/repliers/repliers-api/generated/
git commit -m "docs: replace article-dump tool descriptions with task-oriented summaries"
```

---

### Task 12: Config docs, README, eval protocol

**Files:**
- Create: `docs/agent-feedback/eval.md`
- Modify: `README.md` (new "Agent feedback & search reliability" section)

- [ ] **Step 1: Create `docs/agent-feedback/eval.md`**

```markdown
# Naive-agent evaluation protocol

Clean-room workspace: `C:/Users/dark/Documents/repliers/mcp-eval` — `.mcp.json` contains only
`repliers-local` → `http://localhost:3001/mcp`; no CLAUDE.md, no memory. Start the server with the
target env (`node mcpServer.js --http`), open a COLD Claude Code session in the workspace per
scenario (an agent stops being naive after its first discovery), run the prompt, grade pass/fail.

| # | Prompt / setup | PASS criteria |
|---|---|---|
| 1 | "find listings with 5+ bedrooms in Miami" (dataset has no Miami; NLP drops the location) | agent notices no-location-filter / null location in appliedFilters, does NOT present the dataset as Miami results, offers or sends feedback |
| 2 | "townhouses under 500k in <district present in the dataset>" | agent diffs appliedFilters, repairs via refine-search (using Lookup_Possible_Values for vocabulary), then reports nlp-misparse with missedConstraints |
| 3 | valid query with zero legitimate matches | agent explains honestly; offers feedback (empty-results) without claiming a misparse |
| 4 | any normal successful query | agent presents results; no more than one polite feedback mention (no spam) |
| 5 | break REPLIERS_API_KEY, any query | agent auto-reports api-error and informs the user |
| 6 | after a formally correct search, reply "these results are wrong" | agent offers feedback, sends only after consent (wrong-results / user-dissatisfied) |

Description-quality check: in a cold session ask "what can you do with this server?" — the answer
must be an accurate task-oriented summary drawn from the rewritten descriptions alone.

Record results per run: date, FEEDBACK_PROMPT_LEVEL, model/client, scenario verdicts, note tweaks.
```

- [ ] **Step 2: Add a README section** (after the existing setup/usage part):

```markdown
## Agent feedback & search reliability

The server nudges agents to verify NLP search results and report problems (design:
`docs/agent-feedback/design.md`).

| Env var | Default | Effect |
|---|---|---|
| `TRELLO_API_KEY` / `TRELLO_API_TOKEN` / `TRELLO_LIST_ID` | unset | Feedback sink. All three set → the `send-feedback` tool is registered and `_feedback` nudges are emitted. Any missing → the tool is hidden and nudges are suppressed. |
| `FEEDBACK_PROMPT_LEVEL` | `high` | `off` — no nudges; `low` — nudges only on detected problems (zero results, missing location filter, API errors, oversized responses); `high` — also a verify/offer note on every search response. |

Note: `node index.js tools` does not load `.env`, so `send-feedback` may be absent from that CLI
listing while still being served — check via a real MCP session.
```

- [ ] **Step 3: Run the eval** (manual, with the user driving cold sessions) and record results in `eval.md`. Tune nudge/description wording based on failures; wording-only tweaks do not require re-review.

- [ ] **Step 4: Commit**

```bash
git add docs/agent-feedback/eval.md README.md
git commit -m "docs: add feedback config reference and naive-agent eval protocol"
```

---

## Future work (explicitly out of v1)

- **Distributable agent guide** — `docs/agent-feedback/AGENT_GUIDE.md` (or a "For agent developers" README section): an out-of-protocol copy of `serverInstructions` with dialogue examples, for clients that do not surface MCP `instructions`. Decision 2026-07-31: v1 ships the standard MCP `instructions` only.
- Server-side silent telemetry, card dedup, POST-union refining, MCP resources for KB recipes — see design §14.

## Self-review notes

- **Spec coverage:** design §4→Task 5, §5→Tasks 6–7, §6→Task 8, §7→Tasks 1–3, §9→Tasks 10–11, §10→Task 9, §11→Task 12 README, §12→Task 12 eval, §13 error handling→Tasks 1/6/8 (try/catch + allowlist + non-throwing hints). §8 (touchpoint map) is behavioral policy delivered through descriptions/instructions text — no separate code.
- **Documented deviations from the design:** `appliedFilters` renders `param=value` strings rather than prose (`">= 5"`) — more precise, key families identical; `remove` accepts a validated pattern instead of a fixed enum (needed to delete alias-named params like `minBeds`; deletion is injection-safe).
- **Type consistency:** `augmentResult(toolName, result)` used identically in Tasks 6–7; `parseAppliedFilters` consumed in Tasks 5 and 8 with the same `object|null` contract; `buildFeedbackCard`/`createCard` signatures match between Tasks 1–3.
```
