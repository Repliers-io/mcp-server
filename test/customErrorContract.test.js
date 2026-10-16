import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiTool as search } from "../tools/repliers/repliers-api/custom/search-listings.js";
import { apiTool as refine } from "../tools/repliers/repliers-api/custom/refine-search.js";
import { apiTool as stats } from "../tools/repliers/repliers-api/custom/statistics.js";
import { apiTool as lookup } from "../tools/repliers/repliers-api/custom/get-parameter-enumerations.js";
import { apiTool as image } from "../tools/repliers/repliers-api/custom/get-listing-image.js";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

const calls = [
  ["Search_Listings", () => search.function({ prompt: "condos", _repliersApiKey: "k", _userAgent: "ua/1" })],
  ["refine-search", () => refine.function({ url: "https://api.repliers.io/listings?city=X", status: "A", _repliersApiKey: "k", _userAgent: "ua/1" })],
  ["Market_Statistics", () => stats.function({ _repliersApiKey: "k", _userAgent: "ua/1" })],
  ["Lookup_Possible_Values", () => lookup.function({ aggregates: "details.style", listings: false, _repliersApiKey: "k", _userAgent: "ua/1" })],
  ["Get_Listing_Image", () => image.function({ mlsNumber: "N1", _repliersApiKey: "k", _userAgent: "ua/1" })],
];

for (const [name, call] of calls) {
  test(`${name}: an HTTP failure keeps status and body, and the request carried the User-Agent`, async () => {
    let headers;
    global.fetch = async (url, init) => {
      headers = init.headers;
      return new Response('{"message":"Your account does not have access to this feature"}', { status: 403 });
    };
    const result = await call();
    assert.equal(result.status, 403);
    assert.deepEqual(result.body, { message: "Your account does not have access to this feature" });
    assert.equal(result.error, "Your account does not have access to this feature");
    assert.equal(headers["User-Agent"], "ua/1");
  });

  test(`${name}: a network failure is status null`, async () => {
    global.fetch = async () => { throw new TypeError("fetch failed"); };
    const result = await call();
    assert.equal(result.status, null);
  });
}
