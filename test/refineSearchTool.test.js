import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiTool } from "../tools/repliers/repliers-api/custom/refine-search.js";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

const base = "https://api.repliers.io/listings?minBeds=5&style=Semi-Detached&waterfront=true";

test("rejects foreign hosts and garbage urls", async () => {
  assert.match((await apiTool.function({ url: "https://evil.example/listings" })).error, /api\.repliers\.io/);
  assert.match((await apiTool.function({ url: "not a url" })).error, /valid/);
});

test("patches named params, preserves everything else verbatim, removes aliases", async () => {
  let fetched;
  global.fetch = async (url) => {
    fetched = new URL(String(url));
    return { ok: true, json: async () => ({ count: 1, listings: [] }) };
  };
  const result = await apiTool.function({
    url: base,
    maxPrice: 500000,
    propertyType: "Att/Row/Twnhouse",
    minBedrooms: 3,
    remove: ["style"],
    _repliersApiKey: "k",
  });
  assert.equal(fetched.searchParams.get("maxPrice"), "500000");
  assert.equal(fetched.searchParams.get("propertyType"), "Att/Row/Twnhouse");
  assert.equal(fetched.searchParams.get("minBedrooms"), "3");
  assert.equal(fetched.searchParams.get("minBeds"), null); // alias displaced by patch
  assert.equal(fetched.searchParams.get("style"), null); // removed
  assert.equal(fetched.searchParams.get("waterfront"), "true"); // untouched pass-through
  assert.equal(Object.keys(result.data)[0], "appliedFilters");
});

test("remove wins when the same param is both set and removed", async () => {
  let fetched;
  global.fetch = async (url) => {
    fetched = new URL(String(url));
    return { ok: true, json: async () => ({}) };
  };
  await apiTool.function({ url: base, maxPrice: 500000, remove: ["maxPrice"], _repliersApiKey: "k" });
  assert.equal(fetched.searchParams.get("maxPrice"), null);
});

test("array propertyType writes repeated params; array style replaces the existing value", async () => {
  let fetched;
  global.fetch = async (url) => {
    fetched = new URL(String(url));
    return { ok: true, json: async () => ({}) };
  };
  await apiTool.function({
    url: base,
    propertyType: ["Att/Row/Twnhouse", "Condo Townhouse"],
    _repliersApiKey: "k",
  });
  assert.deepEqual(fetched.searchParams.getAll("propertyType"), ["Att/Row/Twnhouse", "Condo Townhouse"]);
  assert.equal(fetched.searchParams.get("waterfront"), "true"); // pass-through intact
  await apiTool.function({ url: base, style: ["2-Storey", "3-Storey"], _repliersApiKey: "k" });
  assert.deepEqual(fetched.searchParams.getAll("style"), ["2-Storey", "3-Storey"]); // Semi-Detached replaced
});

test("unknown patch args are ignored, not interpolated", async () => {
  let fetched;
  global.fetch = async (url) => {
    fetched = new URL(String(url));
    return { ok: true, json: async () => ({}) };
  };
  await apiTool.function({ url: base, evilParam: "x", _repliersApiKey: "k" });
  assert.equal(fetched.searchParams.get("evilParam"), null);
});
