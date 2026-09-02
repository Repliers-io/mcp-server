import { test } from "node:test";
import assert from "node:assert/strict";
import { toolAnnotations, discoverTools } from "../lib/tools.js";

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

// The rules match on the tool's name, not on what it does, so a future tool whose name fits no
// prefix silently ships with no hints at all — and a read-only consumer surface then decides for
// itself whether to expose it. Catch that here rather than in someone else's client.
test("every tool in the roster carries annotations", async () => {
  const tools = await discoverTools();
  const unannotated = tools
    .map((tool) => tool.definition.function.name)
    .filter((name) => !toolAnnotations(name));
  assert.deepEqual(unannotated, [], `add a rule in lib/tools.js for: ${unannotated.join(", ")}`);
});

// OpenAI's submission guidelines: tools that interact with external systems, accounts or public
// platforms must carry openWorldHint. Sending reaches a recipient or a third-party board; every
// other tool stays inside one fixed MLS dataset, which is a closed domain.
test("outbound tools are open-world, dataset-bound ones are not", () => {
  for (const name of ["send-message", "send-feedback"]) {
    assert.equal(toolAnnotations(name).openWorldHint, true, name);
    assert.equal(toolAnnotations(name).destructiveHint, false, `${name} adds, it does not overwrite`);
  }
  for (const name of ["create-client", "update-client", "delete-client", "get-listing"]) {
    assert.equal(toolAnnotations(name).openWorldHint, false, name);
  }
});
