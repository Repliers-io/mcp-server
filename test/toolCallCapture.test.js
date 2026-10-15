// test/toolCallCapture.test.js
import { test, beforeEach, afterEach } from "node:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { callTool, createSessionState } from "../lib/toolCall.js";
import { createReporter } from "../lib/autoReport.js";
import { fakeTool, fakeReporter } from "./helpers/toolDoubles.js";

const realEnv = { ...process.env };
beforeEach(() => {
  process.env.TRELLO_API_KEY = "k"; process.env.TRELLO_API_TOKEN = "t"; process.env.TRELLO_LIST_ID = "l";
  process.env.TRELLO_AUTO_LIST_ID = "auto";
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

test("a refine correction is not captured; the model is told it can offer the report instead", async () => {
  const session = createSessionState();
  const reporter = fakeReporter();
  await callTool({ tool: search, toolName: "Search_Listings", args: { prompt: "condos in Cooksville" }, repliersApiKey: "rk-test-0001", session, reporter });
  const res = await callTool({ tool: refine(`${U}&type=sale`), toolName: "refine-search", args: { url: U, type: "sale" }, repliersApiKey: "rk-test-0001", session, reporter });
  assert.equal(reporter.reports.length, 0);
  const body = payload(res);
  assert.equal(Object.keys(body)[0], "_feedback");
  assert.ok(body._feedback.signals.includes("refined"));
  assert.ok(!body._feedback.signals.includes("recorded"));
  assert.match(body._feedback.note, /changed type/);
});

test("a restated search is not captured, and the session keeps no search memory in narrow mode", async () => {
  const session = createSessionState();
  const reporter = fakeReporter();
  const res = await callTool({ tool: search, toolName: "Search_Listings", args: { prompt: "p", repairsNlpId: "n0" }, repliersApiKey: "rk-test-0001", session, reporter });
  assert.equal(reporter.reports.length, 0);
  assert.ok(!(payload(res)._feedback?.signals ?? []).includes("recorded"));
  assert.equal(session.searches.size, 0);
});

// ---- per-session quota (security S1)

const discarding = fakeTool("Search_Listings", async () => ({
  url: "https://api.repliers.io/nlp?nlpVersion=3",
  data: { appliedFilters: { location: "city=Cooksville", unrecognized: ["zeta"] }, request: { url: U }, nlpId: "n1", listings: { count: 3 } },
}));
const failing = (message) => fakeTool("get-listing", async () => ({ url: "https://api.repliers.io/listings/N1", error: message, status: 502, body: null }));

test("one session records at most 5 signals an hour, across error and success paths", async () => {
  const session = createSessionState();
  const reporter = fakeReporter();
  let time = 0;
  const errors = [];
  const realError = console.error;
  console.error = (line) => errors.push(String(line));
  try {
    const call = (overrides) => callTool({ args: {}, repliersApiKey: "rk-test-0001", session, reporter, now: () => time, ...overrides });
    for (let i = 0; i < 3; i += 1) await call({ tool: failing(`e${i}`), toolName: "get-listing" });
    for (let i = 0; i < 2; i += 1) await call({ tool: discarding, toolName: "Search_Listings", args: { prompt: `p${i}` } });
    const sixth = await call({ tool: failing("e6"), toolName: "get-listing" });
    await call({ tool: failing("e7"), toolName: "get-listing" });
    assert.equal(reporter.reports.length, 5);
    assert.equal(payload(sixth)._feedback, undefined, "an unreported signal is not announced");
    assert.equal(errors.filter((line) => line === "[auto-report] session quota reached").length, 1, "logged once per window");
    // Another session has its own quota; the next hour opens a new window.
    await callTool({ tool: failing("other"), toolName: "get-listing", args: {}, repliersApiKey: "rk-test-0001", session: createSessionState(), reporter, now: () => time });
    assert.equal(reporter.reports.length, 6);
    time = 60 * 60 * 1000;
    await call({ tool: failing("e8"), toolName: "get-listing" });
    assert.equal(reporter.reports.length, 7);
  } finally {
    console.error = realError;
  }
});

// ---- the caller's key across the 1000-character message cap (security S3)

const KEY = "ZQXJ/live+key=7f3a9c2e5b81d4";
const leakedPrefix = (text) => {
  for (const form of [KEY, encodeURIComponent(KEY)]) {
    for (let n = form.length; n >= 6; n -= 1) if (text.includes(form.slice(0, n))) return form.slice(0, n);
  }
  return null;
};

test("a key echoed across the 1000-character message cap never reaches a card, even in part", async () => {
  const reporter = fakeReporter();
  await callTool({
    tool: fakeTool("Search_Listings", async () => ({ url: "https://api.repliers.io/nlp?nlpVersion=3", error: "x", status: 500, body: { message: `${"y".repeat(990)}${KEY}` } })),
    toolName: "Search_Listings", args: { prompt: "p" }, repliersApiKey: KEY, reporter,
  });
  assert.equal(reporter.reports.length, 1);
  assert.equal(leakedPrefix(JSON.stringify(reporter.reports)), null);
});

test("a URL-encoded key echo never reaches a card", async () => {
  const reporter = fakeReporter();
  await callTool({
    tool: fakeTool("Search_Listings", async (args) => ({
      url: `https://api.repliers.io/nlp?k=${encodeURIComponent(args._repliersApiKey)}`, error: "x", status: 500,
      body: { echo: encodeURIComponent(args._repliersApiKey), raw: args._repliersApiKey },
    })),
    toolName: "Search_Listings", args: { prompt: "p" }, repliersApiKey: KEY, reporter,
  });
  assert.equal(reporter.reports.length, 1);
  assert.equal(leakedPrefix(JSON.stringify(reporter.reports)), null);
});

test("an upstream error is recorded and says so; an account error is not recorded", async () => {
  const reporter = fakeReporter();
  const upstream = await callTool({
    tool: fakeTool("get-listing", async () => ({ url: "u", error: "bad gateway", status: 502, body: "bad gateway" })),
    toolName: "get-listing", args: {}, repliersApiKey: "rk-test-0001", reporter,
  });
  assert.deepEqual(Object.keys(payload(upstream)).slice(0, 2), ["_notice", "_feedback"]);
  const account = await callTool({
    tool: fakeTool("get-listing", async () => ({ url: "u", error: "Invalid API key", status: 401, body: [{ msg: "Invalid API key" }] })),
    toolName: "get-listing", args: {}, repliersApiKey: "rk-test-0001", reporter,
  });
  assert.equal(reporter.reports.length, 1);
  assert.equal(payload(account)._feedback, undefined);
});

test("a signal the reporter does not accept is not announced as recorded", async () => {
  const reporter = { reports: [], report: () => ({ accepted: false, done: Promise.resolve("dropped") }) };
  const res = await callTool({
    tool: fakeTool("get-listing", async () => ({ url: "u", error: "x", status: 503, body: null })),
    toolName: "get-listing", args: {}, repliersApiKey: "rk-test-0001", reporter,
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
    toolName: "get-listing", args: {}, repliersApiKey: "rk-test-0001", reporter,
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

test("a search that discards a parameter is recorded and says so", async () => {
  const reporter = fakeReporter();
  const res = await callTool({ tool: discarding, toolName: "Search_Listings", args: { prompt: "p" }, repliersApiKey: "rk-test-0001", reporter });
  assert.equal(reporter.reports.length, 1);
  assert.equal(reporter.reports[0].key, "unrecognized:zeta");
  assert.ok(reporter.reports[0].lines.every((line) => typeof line === "string"));
  assert.ok(payload(res)._feedback.signals.includes("recorded"));
});

test("a reporter that throws leaves the success payload untouched", async () => {
  const reporter = { report: () => { throw new Error("boom"); } };
  const res = await callTool({ tool: search, toolName: "Search_Listings", args: { prompt: "p" }, repliersApiKey: "rk-test-0001", reporter });
  assert.equal(res.isError, undefined);
  assert.ok(!(payload(res)._feedback?.signals ?? []).includes("recorded"));
  assert.equal(payload(res).nlpId, "n1");
});

test("a reporter that throws leaves the error notice untouched", async () => {
  const reporter = { report: () => { throw new Error("boom"); } };
  const res = await callTool({
    tool: fakeTool("get-listing", async () => ({ url: "u", error: "x", status: 503, body: null })),
    toolName: "get-listing", args: {}, repliersApiKey: "rk-test-0001", reporter,
  });
  assert.equal(res.isError, true);
  assert.ok(payload(res)._notice);
  assert.equal(payload(res)._feedback, undefined);
});

// ---- the default reporter follows autoCaptureConfigured (owner change 2026-10-15)

test("Trello configured but no TRELLO_AUTO_LIST_ID: nothing is captured and nothing is announced as recorded", async () => {
  delete process.env.TRELLO_AUTO_LIST_ID;
  const res = await callTool({
    tool: fakeTool("get-listing", async () => ({ url: "u", error: "bad gateway no-auto-list", status: 502, body: null })),
    toolName: "get-listing", args: {}, repliersApiKey: "rk-test-0001",
  });
  assert.ok(payload(res)._notice);
  assert.equal(payload(res)._feedback, undefined);
});

test("dry-run captures through the default reporter and announces it", async () => {
  for (const key of ["TRELLO_API_KEY", "TRELLO_API_TOKEN", "TRELLO_LIST_ID", "TRELLO_AUTO_LIST_ID"]) delete process.env[key];
  process.env.FEEDBACK_DRY_RUN = "true";
  process.env.FEEDBACK_DRY_RUN_LOG = join(tmpdir(), `capture-dry-run-${process.pid}.log`);
  const realError = console.error;
  console.error = () => {};
  try {
    const res = await callTool({
      tool: fakeTool("get-listing", async () => ({ url: "u", error: "bad gateway dry-run", status: 502, body: null })),
      toolName: "get-listing", args: {}, repliersApiKey: "rk-test-0001",
    });
    assert.ok(payload(res)._feedback.signals.includes("recorded"));
  } finally {
    console.error = realError;
  }
});
