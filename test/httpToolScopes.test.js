import test from "node:test";
import assert from "node:assert/strict";
import {
  callTool,
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
