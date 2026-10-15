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

// The path can carry caller-supplied ids (/clients/{clientId}); the user text names the feature only.
test("a feature error names only the first path segment", () => {
  const got = classifyError({ toolName: "get-client", url: "https://api.repliers.io/clients/12345/searches?x=1", status: 403, body: null });
  assert.match(got.forUser, /this API feature \(\/clients\)/);
  assert.doesNotMatch(got.forUser, /12345|searches/);
});

// errorMessage flattens array bodies with "; ", so a pattern spanning entries pairs words that
// belong to different parameters.
test("boardId is needs-board only when one error entry says boardId is required", () => {
  const split = classifyError({ toolName: "get-listing", url: listing, status: 400,
    body: [{ param: "boardId", msg: "must be a number" }, { param: "fields", msg: "is required" }] });
  assert.equal(split.reason, "validation");
  const needs = classifyError({ toolName: "get-listing", url: listing, status: 400,
    body: [{ param: "fields", msg: "is invalid" }, { msg: "boardId is required" }] });
  assert.equal(needs.reason, "needs-board");
  assert.match(needs.forAgent, /boardId is required/, "the API's own message is handed on");
});

test("a service error on a non-idempotent tool does not advise repeating the call", () => {
  for (const [toolName, status] of [["send-message", 502], ["create-client", null]]) {
    const got = classifyError({ toolName, url: "https://api.repliers.io/messages", status, body: null, error: "fetch failed" });
    assert.equal(got.kind, "upstream");
    assert.equal(got.capture, true);
    assert.equal(got.retry, false, toolName);
    assert.equal(got.forAgent, "A Repliers service error occurred; the call may or may not have taken effect, so repeating it could duplicate it.");
  }
  assert.equal(classifyError({ toolName: "get-listing", url: listing, status: 502, body: null }).retry, true);
});

test("the classified message is capped at 1000 characters, thrown text included", () => {
  assert.ok(classifyError({ toolName: "x", status: undefined, error: "e".repeat(5000) }).message.length <= 1000);
  assert.ok(classifyError({ toolName: "get-listing", url: listing, status: 500, body: { message: "m".repeat(5000) } }).message.length <= 1000);
});

test("validation and input errors hand the agent the API's own words", () => {
  assert.match(classifyError(cases[7][1]).forAgent, /resultsPerPage: must be a number/);
  assert.match(classifyError(cases[10][1]).forAgent, /url must be a valid request\.url/);
});
