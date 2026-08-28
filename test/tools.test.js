import { test } from "node:test";
import assert from "node:assert/strict";
import { toolAnnotations } from "../lib/tools.js";

test("read tools: readOnlyHint true, idempotent, closed world", () => {
  for (const name of ["Search_Listings", "get-listing", "refine-search", "Market_Statistics", "Lookup_Possible_Values", "list-favorites", "autocomplete-location-search", "search-clients"]) {
    const a = toolAnnotations(name);
    assert.equal(a.readOnlyHint, true, name);
    assert.equal(a.destructiveHint, false, name);
    assert.equal(a.idempotentHint, true, name);
    assert.equal(a.openWorldHint, false, name);
  }
});

test("delete/remove/update tools: destructiveHint true", () => {
  for (const name of ["delete-agent", "remove-favorite", "update-client"]) {
    const a = toolAnnotations(name);
    assert.equal(a.readOnlyHint, false, name);
    assert.equal(a.destructiveHint, true, name);
  }
});

test("create/send tools: additive writes, not destructive", () => {
  for (const name of ["send-feedback", "send-message", "create-client"]) {
    const a = toolAnnotations(name);
    assert.equal(a.readOnlyHint, false, name);
    assert.equal(a.destructiveHint, false, name);
    assert.equal(a.idempotentHint, false, name);
  }
});

test("unknown names get no annotations", () => {
  assert.equal(toolAnnotations("mystery-tool"), undefined);
});
