import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const realFetch = global.fetch;
const realEnv = {
  TRELLO_API_KEY: process.env.TRELLO_API_KEY,
  TRELLO_API_TOKEN: process.env.TRELLO_API_TOKEN,
  TRELLO_LIST_ID: process.env.TRELLO_LIST_ID,
  FEEDBACK_CONSENT: process.env.FEEDBACK_CONSENT,
};
beforeEach(() => {
  process.env.TRELLO_API_KEY = "k";
  process.env.TRELLO_API_TOKEN = "t";
  process.env.TRELLO_LIST_ID = "l";
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

test("auto mode: description reports technical failures without asking", async () => {
  const { apiTool } = await load();
  assert.match(apiTool.definition.function.description, /without asking/i);
});

test("always-ask mode: description demands consent for every category", async () => {
  process.env.FEEDBACK_CONSENT = "always-ask";
  const { apiTool } = await load();
  const description = apiTool.definition.function.description;
  assert.doesNotMatch(description, /report directly without asking/i);
  assert.match(description, /only after|explicit consent|ask the user first/i);
  assert.match(description, /every category|including api-error/i);
});

test("description names the required parameters in both consent modes", async () => {
  for (const mode of [undefined, "always-ask"]) {
    if (mode) process.env.FEEDBACK_CONSENT = mode;
    else delete process.env.FEEDBACK_CONSENT;
    const { apiTool } = await load();
    const description = apiTool.definition.function.description;
    for (const param of ["category", "summary", "userQuery"]) {
      assert.match(description, new RegExp(param), `${mode ?? "auto"} mode must name ${param}`);
    }
    assert.match(description, /required/i);
  }
});
