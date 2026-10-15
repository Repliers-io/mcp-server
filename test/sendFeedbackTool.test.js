import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const realFetch = global.fetch;
const realEnv = {
  TRELLO_API_KEY: process.env.TRELLO_API_KEY,
  TRELLO_API_TOKEN: process.env.TRELLO_API_TOKEN,
  TRELLO_LIST_ID: process.env.TRELLO_LIST_ID,
  TRELLO_AUTO_LIST_ID: process.env.TRELLO_AUTO_LIST_ID,
  FEEDBACK_CONSENT: process.env.FEEDBACK_CONSENT,
};
beforeEach(() => {
  process.env.TRELLO_API_KEY = "k";
  process.env.TRELLO_API_TOKEN = "t";
  process.env.TRELLO_LIST_ID = "l";
  process.env.TRELLO_AUTO_LIST_ID = "a";
  delete process.env.FEEDBACK_CONSENT;
});
afterEach(() => {
  global.fetch = realFetch;
  for (const [key, value] of Object.entries(realEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// Import with a cache-busting query so each test sees fresh env at module load.
const load = () =>
  import(`../tools/repliers/repliers-api/custom/send-feedback.js?bust=${Math.random()}`);

test("tool is exported when Trello env present and rejects bad category", async () => {
  const { apiTool } = await load();
  assert.equal(apiTool.definition.function.name, "send-feedback");
  const bad = await apiTool.function({ category: "nope", summary: "s", userQuery: "q" });
  assert.match(bad.error, /category/);
});

// The card sits on an internal triage board. The person in the conversation cannot open it, and an
// agent handed a link treats it as proof and relays it — so the link must not reach the agent.
test("apiTool is null when Trello env is missing", async () => {
  delete process.env.TRELLO_API_KEY;
  const { apiTool } = await load();
  assert.equal(apiTool, null);
});

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

test("description lists the reports it carries and no longer claims refine or restated captures", async () => {
  const { apiTool } = await load();
  const description = apiTool.definition.function.description;
  assert.match(description, /a report the user asks for/);
  assert.match(description, /results the user considers wrong/);
  assert.match(description, /a parse correction the user agreed to report/);
  assert.doesNotMatch(description, /refine-search|restated|repairsNlpId/);
});

test("without TRELLO_AUTO_LIST_ID the tool is present and does not claim automatic recording", async () => {
  delete process.env.TRELLO_AUTO_LIST_ID;
  const { apiTool } = await load();
  assert.equal(apiTool.definition.function.name, "send-feedback");
  assert.doesNotMatch(apiTool.definition.function.description, /recorded automatically/);
  assert.match(apiTool.definition.function.description, /a parse correction the user agreed to report/);
});

// Only Repliers service errors are recorded; an account or request error is not, so "API errors"
// would tell the model a rejected key had been reported.
test("description names Repliers service errors as the recorded kind, not every API error", async () => {
  const { apiTool } = await load();
  const description = apiTool.definition.function.description;
  assert.match(description, /Repliers service errors/);
  assert.doesNotMatch(description, /\bAPI errors\b/);
});
