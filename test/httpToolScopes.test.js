import test from "node:test";
import assert from "node:assert/strict";
import {
  callTool,
  mcpFetch,
  openSession,
  startFakePropelAuth,
  startFakeRepliersApi,
  startMcpServer,
} from "./helpers/hostedMcpServer.js";

/**
 * Scopes are checked where the tool name is known, not at the HTTP layer: reaching the server
 * needs mcp:read, but calling anything that mutates needs mcp:write on top. The read/write split
 * comes from the readOnlyHint the roster already publishes, so a regenerated roster carries it
 * automatically and an unrecognised tool fails closed.
 */
test("scopes gate mutating tools", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const repliers = await startFakeRepliersApi();
  const mcp = await startMcpServer({ propelAuth, repliersApiPort: repliers.port });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
    await repliers.close();
  });

  // Offering a capability that cannot be used is worse than not offering it: the agent picks the
  // tool, gathers arguments from the user, and only then learns it was never callable.
  await t.test("a read-only token is not shown tools it cannot call", async () => {
    const session = await openSession(mcp.port, "readonly-token");
    const res = await mcpFetch(mcp.port, {
      token: "readonly-token",
      sessionId: session,
      body: { jsonrpc: "2.0", id: 7, method: "tools/list", params: {} },
    });
    const text = await res.text();

    assert.match(text, /search-locations/, "read tools must still be listed");
    assert.doesNotMatch(text, /delete-client/, "a write tool was offered to a read-only token");
  });

  await t.test("a full token is shown the whole roster", async () => {
    const session = await openSession(mcp.port, "alice-token");
    const res = await mcpFetch(mcp.port, {
      token: "alice-token",
      sessionId: session,
      body: { jsonrpc: "2.0", id: 8, method: "tools/list", params: {} },
    });
    const text = await res.text();

    assert.match(text, /search-locations/);
    assert.match(text, /delete-client/);
  });

  await t.test("a read-only token may search", async () => {
    const session = await openSession(mcp.port, "readonly-token");
    const { text } = await callTool(mcp.port, {
      token: "readonly-token",
      sessionId: session,
      name: "search-locations",
      args: {},
    });
    assert.doesNotMatch(text, /mcp:write/, text);
  });

  await t.test("a read-only token may not delete", async () => {
    const session = await openSession(mcp.port, "readonly-token");
    const { text } = await callTool(mcp.port, {
      token: "readonly-token",
      sessionId: session,
      name: "delete-client",
      args: { clientId: "1" },
    });
    assert.match(text, /mcp:write/, text);
  });

  await t.test("the refusal happens before the tool runs", async () => {
    // A scope failure that still reached the Repliers API would have spent the account's key
    // on a call the authorization did not permit.
    const before = repliers.received.length;
    const session = await openSession(mcp.port, "readonly-token");
    await callTool(mcp.port, {
      token: "readonly-token",
      sessionId: session,
      name: "delete-client",
      args: { clientId: "1" },
    });
    assert.equal(repliers.received.length, before, "the upstream API must not have been called");
  });

  await t.test("a full token may delete", async () => {
    const session = await openSession(mcp.port, "alice-token");
    const { text } = await callTool(mcp.port, {
      token: "alice-token",
      sessionId: session,
      name: "delete-client",
      args: { clientId: "1" },
    });
    assert.doesNotMatch(text, /mcp:write/, text);
  });
});

/**
 * Self-hosted and stdio deployments have no per-user identity: the environment key is the only
 * authority and there are no scopes to check. The whole path hangs on the scope check being
 * skipped when authInfo is absent, so it gets a test — otherwise the failure mode is that every
 * tool call in every self-hosted deployment is refused, and nothing here would notice.
 */
test("a self-hosted server enforces no scopes", async (t) => {
  const repliers = await startFakeRepliersApi();
  const mcp = await startMcpServer({
    repliersApiPort: repliers.port,
    env: { REPLIERS_API_KEY: "self-hosted-key" },
  });

  t.after(async () => {
    mcp.close();
    await repliers.close();
  });

  const session = await openSession(mcp.port);
  const { text } = await callTool(mcp.port, {
    sessionId: session,
    name: "delete-client",
    args: { clientId: "1" },
  });

  assert.doesNotMatch(text, /scope/, text);
  assert.equal(repliers.lastKey(), "self-hosted-key");
});
