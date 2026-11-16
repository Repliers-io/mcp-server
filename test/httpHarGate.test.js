// HAR partner tools exist only for keys the API grants HAR access (har-partner design.md §4.2).
// A real `--http` server against a fake Repliers API that grants HAR to one key.
import test from "node:test";
import assert from "node:assert/strict";
import {
  startFakePropelAuth,
  startFakeRepliersApi,
  startMcpServer,
  openSession,
  callTool,
  listTools,
} from "./helpers/hostedMcpServer.js";

const HAR_TOOLS = ["get-har-listing-reviews", "get-har-listing-views", "get-har-showings"];
const harIn = (names) => names.filter((name) => name.startsWith("get-har-")).sort();

test("hosted mode: the HAR tools follow the caller's own key", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const repliers = await startFakeRepliersApi({ harKeys: ["KEY-ALICE-1"] });
  let mcp;
  t.after(async () => {
    mcp?.close();
    await Promise.all([propelAuth.close(), repliers.close()]);
  });
  mcp = await startMcpServer({ propelAuth, repliersApiPort: repliers.port });
  const { port } = mcp;
  const alice = await openSession(port, "alice-token");
  const bob = await openSession(port, "bob-token");

  await t.test("a key with HAR access sees the three HAR tools next to the rest", async () => {
    const { status, names, text } = await listTools(port, { token: "alice-token", sessionId: alice });
    assert.equal(status, 200, text);
    assert.deepEqual(harIn(names), HAR_TOOLS);
    assert.ok(names.includes("Search_Listings"));
  });

  await t.test("a key without HAR access sees no HAR tool and no mention of HAR", async () => {
    const { status, names, text } = await listTools(port, { token: "bob-token", sessionId: bob });
    assert.equal(status, 200, text);
    assert.deepEqual(harIn(names), []);
    assert.ok(names.includes("Search_Listings"), "the rest of the roster went missing too");
    assert.doesNotMatch(text, /\bHAR\b/);
  });

  await t.test("calling a HAR tool without access answers like an unknown tool, without reaching the route", async () => {
    const before = repliers.received.filter((r) => r.key === "KEY-BOB-1" && r.url.startsWith("/partners/har/listings/views?mlsNumber")).length;
    const { text } = await callTool(port, { token: "bob-token", sessionId: bob, name: "get-har-listing-views", args: { mlsNumber: "1" } });
    assert.match(text, /Unknown tool: get-har-listing-views/);
    const after = repliers.received.filter((r) => r.key === "KEY-BOB-1" && r.url.startsWith("/partners/har/listings/views?mlsNumber")).length;
    assert.equal(after, before);
  });

  await t.test("a key with access reaches the HAR route with its own key", async () => {
    const { text } = await callTool(port, { token: "alice-token", sessionId: alice, name: "get-har-showings", args: { mlsNumber: "77241710" } });
    assert.match(text, /receivedKey/, text);
    const last = repliers.received.at(-1);
    assert.equal(last.key, "KEY-ALICE-1");
    assert.match(last.url, /^\/partners\/har\/showingsmart\/logs\?mlsNumber=77241710&limit=50$/);
  });

  await t.test("the access probe is cached: listing again does not probe again", async () => {
    const probes = () => repliers.received.filter((r) => r.url === "/accounts").length;
    assert.ok(probes() >= 2, "the access check never read the accounts");
    const before = probes();
    await listTools(port, { token: "alice-token", sessionId: alice });
    await listTools(port, { token: "bob-token", sessionId: bob });
    assert.equal(probes(), before);
  });
});

test("self-hosted mode: the environment key decides", async (t) => {
  const repliers = await startFakeRepliersApi({ harKeys: ["SELF-HAR-KEY"] });
  const servers = [];
  // Registered before anything can throw, so a server that fails to start cannot leave the fake
  // API listening and the run hanging.
  t.after(async () => {
    for (const server of servers) server.close();
    await repliers.close();
  });
  const selfHosted = async (key) => {
    const server = await startMcpServer({
      repliersApiPort: repliers.port,
      env: {
        REPLIERS_API_KEY: key,
        MCP_PUBLIC_URL: "",
        PROPELAUTH_MCP_INTROSPECT_CLIENT_ID: "",
        PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET: "",
        PROPELAUTH_API_KEY: "",
      },
    });
    servers.push(server);
    return server;
  };
  const withHar = await selfHosted("SELF-HAR-KEY");
  const withoutHar = await selfHosted("SELF-PLAIN-KEY");

  const granted = await listTools(withHar.port, { sessionId: await openSession(withHar.port) });
  assert.deepEqual(harIn(granted.names), HAR_TOOLS, granted.text);

  const denied = await listTools(withoutHar.port, { sessionId: await openSession(withoutHar.port) });
  assert.deepEqual(harIn(denied.names), [], denied.text);
});
