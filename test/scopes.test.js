import test from "node:test";
import assert from "node:assert/strict";
import { SCOPE_READ, SCOPE_WRITE, requiredScope } from "../lib/scopes.js";

test("read-only tools need only the read scope", () => {
  assert.equal(requiredScope("Search_Listings"), SCOPE_READ);
  assert.equal(requiredScope("get-client"), SCOPE_READ);
  assert.equal(requiredScope("Market_Statistics"), SCOPE_READ);
  assert.equal(requiredScope("refine-search"), SCOPE_READ);
  assert.equal(requiredScope("Lookup_Possible_Values"), SCOPE_READ);
});

test("mutating tools need the write scope", () => {
  assert.equal(requiredScope("delete-client"), SCOPE_WRITE);
  assert.equal(requiredScope("create-agent"), SCOPE_WRITE);
  assert.equal(requiredScope("update-saved-search"), SCOPE_WRITE);
  assert.equal(requiredScope("send-feedback"), SCOPE_WRITE);
});

// The roster is regenerated from openapi.json, so a tool can appear that matches no
// annotation rule. It must not silently become readable-and-writable.
test("a tool matching no annotation rule fails closed", () => {
  assert.equal(requiredScope("frobnicate-listings"), SCOPE_WRITE);
});
