import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiTool } from "../tools/repliers/repliers-api/generated/search-members.js";
import { apiTool as createSavedSearch } from "../tools/repliers/repliers-api/generated/create-saved-search.js";
import { apiTool as updateSavedSearch } from "../tools/repliers/repliers-api/generated/update-saved-search.js";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

function captureUrl() {
  const seen = {};
  global.fetch = async (url) => {
    seen.url = new URL(String(url));
    return { ok: true, json: async () => ({ members: [] }) };
  };
  return seen;
}

// The 2026-10-08 spec turned agentName (and ten other parameters) from a string into an array.
// ChatGPT keeps the tool schemas it scanned until the connector is rescanned, so callers will keep
// sending a plain string for a while; that must still reach the API as one value.
test("a scalar passed for an array parameter is sent as a single value", async () => {
  const seen = captureUrl();
  const result = await apiTool.function({ agentName: "Smith", _repliersApiKey: "k" });
  assert.equal(result.error, undefined);
  assert.deepEqual(seen.url.searchParams.getAll("agentName"), ["Smith"]);
});

test("an array parameter repeats the query key once per value", async () => {
  const seen = captureUrl();
  await apiTool.function({ agentName: ["Smith", "Jones"], _repliersApiKey: "k" });
  assert.deepEqual(seen.url.searchParams.getAll("agentName"), ["Smith", "Jones"]);
});

// OpenAI strict function calling makes optional fields nullable and models fill them with null.
// A query string has no null; "null" would be sent as a literal filter value.
test("a null query parameter is left out instead of being sent as the string 'null'", async () => {
  const seen = captureUrl();
  await apiTool.function({ agentName: null, resultsPerPage: null, officeId: "X1", _repliersApiKey: "k" });
  assert.deepEqual([...seen.url.searchParams.keys()], ["officeId"]);
});

function captureBody() {
  const seen = {};
  global.fetch = async (url, init) => {
    seen.body = JSON.parse(init.body);
    return { ok: true, json: async () => ({}) };
  };
  return seen;
}

test("a scalar passed for an array body property is sent as a one-element array", async () => {
  const seen = captureBody();
  await createSavedSearch.function({
    clientId: 1, class: ["residential"], type: "sale", minPrice: 1, maxPrice: 2, pets: "yes", _repliersApiKey: "k",
  });
  assert.deepEqual(seen.body.pets, ["yes"]);
  assert.deepEqual(seen.body.class, ["residential"]);
});

// On PATCH a null is how a caller clears a field; wrapping it would send [null] instead.
test("a null array body property on an update stays null", async () => {
  const seen = captureBody();
  await updateSavedSearch.function({ searchId: 7, pets: null, _repliersApiKey: "k" });
  assert.equal(seen.body.pets, null);
});
