import { test } from "node:test";
import assert from "node:assert/strict";
import { createEntitlements } from "../lib/entitlements.js";

// A probe registry of one, answering with whatever verdict the test scripts. Counts calls so the
// cache can be observed from outside.
function scripted(...verdicts) {
  const seen = [];
  const probe = async ({ apiKey, userAgent }) => {
    seen.push({ apiKey, userAgent });
    const next = verdicts.length > 1 ? verdicts.shift() : verdicts[0];
    if (next instanceof Error) throw next;
    return next;
  };
  return { seen, probes: { har: probe } };
}

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

for (const [verdict, allowed] of [["yes", true], ["no", false], ["unknown", false], [200, false], [undefined, false]]) {
  test(`a probe answering ${JSON.stringify(verdict)} means ${allowed ? "access" : "no access"}`, async () => {
    const { probes } = scripted(verdict);
    const gate = createEntitlements({ probes });
    assert.equal(await gate.has("har", "KEY"), allowed);
  });
}

test("a probe that throws hides the tools", async () => {
  const { probes } = scripted(new Error("boom"));
  assert.equal(await createEntitlements({ probes }).has("har", "KEY"), false);
});

// A probe that settles before its first await used to store its verdict before the pending entry,
// which then overwrote it and was served forever.
test("a probe that throws synchronously is still retried once its verdict expires", async () => {
  let calls = 0;
  const probes = { har: () => { calls += 1; throw new Error("sync"); } };
  const time = clock();
  const gate = createEntitlements({ probes, now: time.now });
  assert.equal(await gate.has("har", "KEY"), false);
  time.advance(60_000);
  assert.equal(await gate.has("har", "KEY"), false);
  assert.equal(calls, 2);
});

test("a definite verdict is reused for 15 minutes, then probed again", async () => {
  const { seen, probes } = scripted("yes", "no");
  const time = clock();
  const gate = createEntitlements({ probes, now: time.now });
  assert.equal(await gate.has("har", "KEY"), true);
  time.advance(15 * 60_000 - 1);
  assert.equal(await gate.has("har", "KEY"), true);
  assert.equal(seen.length, 1);
  time.advance(1);
  assert.equal(await gate.has("har", "KEY"), false, "the expired verdict was served again");
  assert.equal(seen.length, 2);
});

test("an inconclusive verdict is retried after 60 seconds", async () => {
  const { seen, probes } = scripted("unknown", "yes");
  const time = clock();
  const gate = createEntitlements({ probes, now: time.now });
  assert.equal(await gate.has("har", "KEY"), false);
  time.advance(59_999);
  assert.equal(await gate.has("har", "KEY"), false);
  assert.equal(seen.length, 1);
  time.advance(1);
  assert.equal(await gate.has("har", "KEY"), true);
});

test("verdicts are kept per key", async () => {
  const probes = { har: async ({ apiKey }) => (apiKey === "HAR-KEY" ? "yes" : "no") };
  const gate = createEntitlements({ probes });
  assert.equal(await gate.has("har", "HAR-KEY"), true);
  assert.equal(await gate.has("har", "OTHER-KEY"), false);
  assert.equal(await gate.has("har", "HAR-KEY"), true);
});

test("concurrent lookups for one key share a single probe", async () => {
  let calls = 0;
  let release;
  const gateOpen = new Promise((r) => { release = r; });
  const probes = { har: async () => { calls += 1; await gateOpen; return "yes"; } };
  const gate = createEntitlements({ probes });
  const pending = [gate.has("har", "KEY"), gate.has("har", "KEY"), gate.has("har", "KEY")];
  release();
  assert.deepEqual(await Promise.all(pending), [true, true, true]);
  assert.equal(calls, 1);
});

test("the cache is bounded: the oldest key is probed again once evicted", async () => {
  const { seen, probes } = scripted("yes");
  const gate = createEntitlements({ probes, maxEntries: 2 });
  await gate.has("har", "A");
  await gate.has("har", "B");
  await gate.has("har", "C"); // evicts A
  await gate.has("har", "B");
  assert.equal(seen.length, 3);
  await gate.has("har", "A");
  assert.equal(seen.length, 4);
});

test("no key, or an entitlement nobody registered, is no access without a probe", async () => {
  const { seen, probes } = scripted("yes");
  const gate = createEntitlements({ probes });
  assert.equal(await gate.has("har", undefined), false);
  assert.equal(await gate.has("har", ""), false);
  assert.equal(await gate.has("mystery", "KEY"), false);
  assert.equal(seen.length, 0);
});

test("the probe receives the caller's key and User-Agent", async () => {
  const { seen, probes } = scripted("yes");
  const gate = createEntitlements({ probes });
  await gate.has("har", "KEY", { userAgent: "ua/1" });
  assert.deepEqual(seen, [{ apiKey: "KEY", userAgent: "ua/1" }]);
});

test("visible() drops gated tools the key lacks and keeps every ungated one", async () => {
  const tool = (name, entitlement) => ({ entitlement, definition: { function: { name } } });
  const tools = [tool("get-listing"), tool("get-har-a", "har"), tool("Search_Listings"), tool("get-har-b", "har")];
  const names = (list) => list.map((t) => t.definition.function.name);

  const denied = scripted("no");
  const without = await createEntitlements({ probes: denied.probes }).visible(tools, "KEY");
  assert.deepEqual(names(without), ["get-listing", "Search_Listings"]);

  const granted = scripted("yes");
  const withAccess = await createEntitlements({ probes: granted.probes }).visible(tools, "KEY");
  assert.deepEqual(names(withAccess), ["get-listing", "get-har-a", "Search_Listings", "get-har-b"]);
  assert.equal(granted.seen.length, 1, "one probe per entitlement, not per tool");
});
