// Listing payloads are cut to the fields a portal listing card shows, so 100 listings fit an MCP
// client's tool-result limit (Claude Code saved a ~0.5 MB Search_Listings result to a file it could
// not read: query-battery-results.md run 11). The listing count is never cut.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { LISTING_FIELDS, compactListings, slimRequest, formatAddress } from "../lib/listingFields.js";
import { apiTool as searchListings } from "../tools/repliers/repliers-api/custom/search-listings.js";
import { apiTool as refineSearch } from "../tools/repliers/repliers-api/custom/refine-search.js";
import { apiTool as harViews } from "../tools/repliers/repliers-api/custom/har-listing-views.js";
import { callTool } from "../lib/toolCall.js";
import { fakeTool, fakeReporter } from "./helpers/toolDoubles.js";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

const fieldList = LISTING_FIELDS.split(",");

test("the field list is the portal card's, with one cover photo and no description, map or agents", () => {
  for (const field of ["mlsNumber", "status", "lastStatus", "type", "class", "listPrice", "soldPrice", "listDate",
    "address.streetNumber", "address.streetName", "address.city", "address.neighborhood", "address.zip",
    "details.numBedrooms", "details.numBathrooms", "details.sqft", "details.propertyType", "permissions"]) {
    assert.ok(fieldList.includes(field), `${field} is on the card`);
  }
  assert.ok(fieldList.includes("images[1]"), "one photo: every name costs ~30 tokens and 100 listings must fit");
  for (const field of ["images", "address", "details", "details.description", "map", "agents", "office", "timestamps", "imageInsights"]) {
    assert.ok(!fieldList.includes(field), `${field} is not requested`);
  }
});

test("compactListings drops nulls and empty objects inside listings and keeps everything else", () => {
  const out = compactListings({
    count: 2, numPages: 1,
    listings: [
      { mlsNumber: "A", soldPrice: null, openHouse: {}, lot: { acres: null }, details: { numBedrooms: "0", sqft: "" }, images: ["a.jpg"] },
      { mlsNumber: "B", status: "A", listPrice: 0 },
    ],
  });
  assert.deepEqual(out, {
    count: 2, numPages: 1,
    listings: [
      { mlsNumber: "A", details: { numBedrooms: "0" }, images: ["a.jpg"] },
      { mlsNumber: "B", status: "A", listPrice: 0 },
    ],
  });
  assert.equal(compactListings(undefined), undefined);
});

test("a listing's address is one line, its dates are days, and permissions appear only when restricted", () => {
  const [open, restricted] = compactListings({ listings: [
    { mlsNumber: "A", listDate: "2026-11-09T00:00:00.000Z", soldDate: "2026-10-01T04:00:00.000-00:00",
      address: { unitNumber: "1203", streetNumber: "33", streetName: "University", streetSuffix: "Ave", neighborhood: "Waterfront Communities C1", city: "Toronto", state: "Ontario", zip: "M5J 2S7", area: "Toronto" },
      permissions: { displayPublic: "Y", displayAddressOnInternet: "Y", displayInternetEntireListing: "Y" } },
    { mlsNumber: "B", address: { streetNumber: "5", streetDirectionPrefix: "N", streetName: "Main", streetSuffix: "St", streetDirection: "E", city: "Spring", state: "TX", zip: "77379" },
      permissions: { displayPublic: "Y", displayAddressOnInternet: "N" } },
  ] }).listings;
  assert.equal(open.address, "1203-33 University Ave, Waterfront Communities C1, Toronto, Ontario M5J 2S7");
  assert.equal(open.listDate, "2026-11-09");
  assert.equal(open.soldDate, "2026-10-01");
  assert.equal(open.permissions, undefined, "all-Y permissions say nothing a listing does not already imply");
  assert.equal(restricted.address, "5 N Main St E, Spring, TX 77379");
  assert.deepEqual(restricted.permissions, { displayPublic: "Y", displayAddressOnInternet: "N" }, "a restriction is kept whole");
});

test("slimRequest drops the boundary polygons from resolved locations", () => {
  const out = slimRequest({ url: "u", summary: "s", locations: [{ locationId: "L1", name: "Toronto", type: "city", map: { boundary: [[[1, 2]]] }, address: { city: "Toronto" } }] });
  assert.deepEqual(out, { url: "u", summary: "s", locations: [{ locationId: "L1", name: "Toronto", type: "city", address: { city: "Toronto" } }] });
  assert.equal(slimRequest(null), null);
});

test("formatAddress prints what a card prints, falling back to the area when there is no city", () => {
  assert.equal(
    formatAddress({ streetNumber: "1", streetName: "Main", city: "Spring", zip: "77379", state: "TX", country: "US", addressKey: "1mainspring", communityCode: null, majorIntersection: "A & B", district: null, unitNumber: null }),
    "1 Main, Spring, TX 77379",
  );
  assert.equal(formatAddress({ streetNumber: "9", streetName: "Bay", area: "Peel" }), "9 Bay, Peel");
  assert.equal(formatAddress(null), null);
  assert.equal(formatAddress("already a line"), "already a line");
});

test("Search_Listings asks /nlp for the card fields and slims the response", async () => {
  let sent, sentUrl;
  global.fetch = async (url, init) => {
    sentUrl = new URL(String(url));
    sent = JSON.parse(init.body);
    return Response.json({
      request: { url: "https://api.repliers.io/listings?city=Toronto", locations: [{ name: "Toronto", type: "city", map: { boundary: [[[1, 2]]] } }] },
      listings: { count: 1, unrecognizedParams: [], listings: [{ mlsNumber: "C1", soldPrice: null, openHouse: {} }] },
    });
  };
  const result = await searchListings.function({ prompt: "condos in Toronto", _repliersApiKey: "k" });
  assert.equal(sentUrl.pathname, "/nlp");
  assert.equal(sentUrl.search, "", "no nlpVersion (or any query): the API then serves its latest NLP version");
  assert.equal(new URL(result.url).search, "");
  assert.deepEqual(sent, { prompt: "condos in Toronto", listings: true, fields: LISTING_FIELDS });
  assert.deepEqual(result.data.listings.listings, [{ mlsNumber: "C1" }]);
  assert.equal(result.data.request.locations[0].map, undefined);
  assert.equal(result.data.request.url, "https://api.repliers.io/listings?city=Toronto");
  assert.equal(result.data.appliedFilters.type, null, "null means 'not applied' in appliedFilters and stays");
});

test("refine-search fetches the card fields when neither the url nor the caller names fields", async () => {
  let fetched;
  global.fetch = async (url) => { fetched = new URL(String(url)); return Response.json({ count: 1, listings: [{ mlsNumber: "C1", soldPrice: null }] }); };
  const result = await refineSearch.function({ url: "https://api.repliers.io/listings?city=Toronto", maxPrice: 500000, _repliersApiKey: "k" });
  assert.equal(fetched.searchParams.get("fields"), LISTING_FIELDS);
  assert.equal(new URL(result.url).searchParams.get("fields"), null, "the returned url stays the caller's, so the next refine starts from it");
  assert.deepEqual(result.changed.set, { maxPrice: 500000 }, "a default is not a change the caller made");
  assert.equal(result.constraintPatch, true);
  assert.deepEqual(result.data.listings, [{ mlsNumber: "C1" }]);
});

test("refine-search keeps fields the caller or the url already chose", async () => {
  const seen = [];
  global.fetch = async (url) => { seen.push(new URL(String(url)).searchParams.get("fields")); return Response.json({ count: 0, listings: [] }); };
  await refineSearch.function({ url: "https://api.repliers.io/listings?city=Toronto", fields: "mlsNumber,listPrice", _repliersApiKey: "k" });
  await refineSearch.function({ url: "https://api.repliers.io/listings?city=Toronto&fields=mlsNumber", _repliersApiKey: "k" });
  assert.deepEqual(seen, ["mlsNumber,listPrice", "mlsNumber"]);
});

test("HAR rows keep every HAR field; the listing enrichment gets the one-line address and day dates", async () => {
  global.fetch = async () => Response.json({ success: true, total: 1, data: [{
    mlsNumber: "1", dateTracked: "2026-11-08T00:00:00.000Z", webView: 3, mobileView: null, images: ["har/a.jpg"],
    listDate: "2026-10-16T00:00:00.000-00:00", soldDate: null,
    address: { streetNumber: "1", streetName: "Main", city: "Spring", country: "US", addressKey: "k", district: null },
  }] });
  const result = await harViews.function({ _repliersApiKey: "k" });
  const [row] = result.data.data;
  assert.equal(row.mobileView, null, "HAR's own fields pass through untouched");
  assert.equal(row.dateTracked, "2026-11-08T00:00:00.000Z", "HAR's own dates too");
  assert.equal(row.soldDate, null);
  assert.deepEqual(row.images, ["har/a.jpg"]);
  assert.equal(row.address, "1 Main, Spring");
  assert.equal(row.listDate, "2026-10-16");
});

test("tool results are compact JSON", async () => {
  const res = await callTool({
    tool: fakeTool("x", async () => ({ url: "u", data: { a: { b: 1 } } })), toolName: "x",
    args: {}, repliersApiKey: "k", reporter: fakeReporter(),
  });
  assert.doesNotMatch(res.content[1].text, /\n/);
  assert.deepEqual(JSON.parse(res.content[1].text).a, { b: 1 });
});
