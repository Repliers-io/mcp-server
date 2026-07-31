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
