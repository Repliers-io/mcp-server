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
