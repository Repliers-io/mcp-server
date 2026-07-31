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

test("geoFilterPresent", () => {
  assert.equal(geoFilterPresent("https://api.repliers.io/listings?city=Toronto"), true);
  assert.equal(geoFilterPresent("https://api.repliers.io/listings?minBeds=5"), false);
  assert.equal(geoFilterPresent("garbage"), false);
});
