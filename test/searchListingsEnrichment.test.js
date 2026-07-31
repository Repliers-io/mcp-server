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
