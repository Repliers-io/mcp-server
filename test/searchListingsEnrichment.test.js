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
  assert.deepEqual(Object.keys(result.data).slice(0, 2), ["appliedFilters", "complexQuery"]);
});

test("computed keys win over appliedFilters/complexQuery present in the NLP payload", async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      appliedFilters: "raw-garbage",
      complexQuery: "yes",
      request: { url: "https://api.repliers.io/listings?minBeds=5", body: null, summary: "s", locations: [] },
      nlpId: "id-1",
      listings: { count: 2, listings: [] },
    }),
  });
  const result = await apiTool.function({ prompt: "5 bed homes", _repliersApiKey: "k" });
  assert.deepEqual(Object.keys(result.data).slice(0, 2), ["appliedFilters", "complexQuery"]);
  assert.equal(typeof result.data.appliedFilters, "object");
  assert.equal(result.data.appliedFilters.bedrooms, "minBeds=5");
  assert.equal(result.data.complexQuery, false);
});

test("prompt description forbids inventing a parent location and says why", async () => {
  const { apiTool } = await import("../tools/repliers/repliers-api/custom/search-listings.js");
  const prompt = apiTool.definition.function.parameters.properties.prompt.description;
  assert.match(prompt, /do not add|never add/i);
  assert.match(prompt, /city, area, state or country|parent/i);
  assert.match(prompt, /repeat across/i, "must give the factual reason, not just the prohibition");
  assert.match(prompt, /search-locations/, "must name the tool that resolves a place properly");
});

test("golden rules stay free of the location prohibition (it belongs on the tool)", async () => {
  const { buildServerInstructions } = await import("../lib/serverInstructions.js");
  assert.doesNotMatch(buildServerInstructions(), /Location words are the user/,
    "a global prohibition block made weak models refuse the whole domain — keep it scoped to the tool");
});
