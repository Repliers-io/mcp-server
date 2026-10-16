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

// A throw escaping a tool is our own code failing on its input (network failures are caught inside
// the tools and arrive with status null), so it is a request error and not a Repliers outage.
test("a thrown tool is a request error, not a crash, and is not recorded", async () => {
  for (const thrown of [new URIError("URI malformed"), "boom"]) {
    const reporter = fakeReporter();
    const res = await callTool({
      tool: fakeTool("get-listing", async () => { throw thrown; }), toolName: "get-listing",
      args: {}, repliersApiKey: "rk-test-0001", reporter,
    });
    assert.equal(res.isError, true);
    assert.equal(payload(res)._notice.kind, "request");
    assert.equal(payload(res)._feedback, undefined);
    assert.equal(reporter.reports.length, 0);
  }
});

test("the error message the model sees is capped at 1000 characters", async () => {
  const res = await callTool({
    tool: fakeTool("get-listing", async () => ({ url: "u", error: "x", status: 500, body: { message: "m".repeat(5000) } })),
    toolName: "get-listing", args: {}, repliersApiKey: "rk-test-0001", reporter: fakeReporter(),
  });
  assert.ok(payload(res).error.message.length <= 1000);
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

test("createSessionState starts with an empty capture quota", () => {
  assert.equal(createSessionState().capture.count, 0);
  assert.equal(createSessionState().searches.size, 0);
});
