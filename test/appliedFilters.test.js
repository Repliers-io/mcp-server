import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAppliedFilters, geoFilterPresent } from "../lib/appliedFilters.js";

test("families map params; absent families are explicit null", () => {
  const f = parseAppliedFilters("https://api.repliers.io/listings?minBeds=5&status=A");
  assert.equal(f.bedrooms, "minBeds=5");
  assert.equal(f.status, "status=A");
  assert.equal(f.location, null);
  assert.equal(f.priceRange, null);
  assert.equal(f.propertyType, null);
  assert.deepEqual(f.other, {});
});

test("alias and canonical names land in the same family; extras go to other", () => {
  const f = parseAppliedFilters(
    "https://api.repliers.io/listings?minBedrooms=3&city=Toronto&maxPrice=500000&waterfront=true"
  );
  assert.equal(f.bedrooms, "minBedrooms=3");
  assert.equal(f.location, "city=Toronto");
  assert.equal(f.priceRange, "maxPrice=500000");
  assert.deepEqual(f.other, { waterfront: "true" });
});

test("null on garbage input", () => {
  assert.equal(parseAppliedFilters("not a url"), null);
});

// The API accepts minBaths; the NLP sometimes emits minBathrooms, which /listings discards.
// Reporting it under `other` would read as an applied filter — the one misparse class that
// survives a correct appliedFilters check.
test("a param the listings API does not accept is flagged, not reported as applied", () => {
  const f = parseAppliedFilters("https://api.repliers.io/listings?class=condo&minBathrooms=2");
  assert.deepEqual(f.unrecognized, ["minBathrooms"]);
  assert.deepEqual(f.other, {}, "a rejected param must not sit in other");
  assert.equal(f.class, "class=condo");
});

test("unrecognizedParams reported by the API are surfaced, query. prefix stripped", () => {
  const f = parseAppliedFilters("https://api.repliers.io/listings?city=Toronto&fooBar=1", [
    "query.fooBar",
  ]);
  assert.deepEqual(f.unrecognized, ["fooBar"]);
  assert.deepEqual(f.other, {});
  assert.equal(f.location, "city=Toronto");
});

test("live aliases absent from openapi.json are not flagged", () => {
  // minBeds/maxBeds are undocumented but accepted — the families table is the second source of truth
  const f = parseAppliedFilters("https://api.repliers.io/listings?minBeds=5&maxBeds=7&waterfront=true");
  assert.deepEqual(f.unrecognized, []);
  assert.equal(f.bedrooms, "minBeds=5 maxBeds=7");
  assert.deepEqual(f.other, { waterfront: "true" });
});

test("unrecognized is always an array, so agents can rely on the key", () => {
  assert.deepEqual(parseAppliedFilters("https://api.repliers.io/listings?city=Toronto").unrecognized, []);
});

test("geoFilterPresent", () => {
  assert.equal(geoFilterPresent("https://api.repliers.io/listings?city=Toronto"), true);
  assert.equal(geoFilterPresent("https://api.repliers.io/listings?minBeds=5"), false);
  assert.equal(geoFilterPresent("garbage"), false);
});
