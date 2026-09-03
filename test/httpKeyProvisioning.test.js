import test from "node:test";
import assert from "node:assert/strict";
import {
  startFakePropelAuth,
  startFakeRepliersApi,
  startMcpServer,
  mcpFetch,
  openSession,
  callTool,
  INITIALIZE,
} from "./helpers/hostedMcpServer.js";

const TOOL = { name: "autocomplete-location-search", args: { search: "tor" } };

test("hosted mode refuses to open a session it cannot serve", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const repliers = await startFakeRepliersApi();
  const mcp = await startMcpServer({
    propelAuthPort: propelAuth.port,
    repliersApiPort: repliers.port,
  });

  t.after(async () => {
    mcp.close();
    await Promise.all([propelAuth.close(), repliers.close()]);
  });

  const { port } = mcp;

  await t.test("a user with no Repliers key in their metadata gets no session", async () => {
    const res = await mcpFetch(port, { token: "keyless-token", body: INITIALIZE });
    const text = await res.text();

    assert.equal(
      res.status,
      403,
      `an unprovisioned user was handed a working session: ${text}`
    );
    assert.equal(
      res.headers.get("mcp-session-id"),
      null,
      "a session id was issued for a caller whose tool calls cannot be served"
    );
    assert.equal(repliers.received.length, 0, "nothing should have reached the API");
  });

  await t.test("our own PropelAuth key being rejected fails loudly, not silently", async () => {
    propelAuth.setBackendRejects(true);

    const res = await mcpFetch(port, { token: "alice-token", body: INITIALIZE });
    const text = await res.text();

    assert.equal(
      res.status,
      503,
      `a server-side misconfiguration was served as a working session: ${text}`
    );
    assert.equal(res.headers.get("mcp-session-id"), null, "a session id was issued anyway");
    assert.equal(repliers.received.length, 0, "nothing should have reached the API");
  });

  await t.test("a provisioned user is unaffected once the backend recovers", async () => {
    propelAuth.setBackendRejects(false);

    const session = await openSession(port, "alice-token");
    const { status } = await callTool(port, { token: "alice-token", sessionId: session, ...TOOL });

    assert.equal(status, 200);
    assert.equal(repliers.lastKey(), "KEY-ALICE-1", "the provisioned key stopped flowing");
  });

  await t.test("a key that disappears mid-session stops the session, not the API", async () => {
    const session = await openSession(port, "alice-token");
    propelAuth.rotateKey("user-alice", null);

    const before = repliers.received.length;
    const res = await mcpFetch(port, {
      token: "alice-token",
      sessionId: session,
      body: { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: TOOL.name, arguments: TOOL.args } },
    });
    await res.text();

    assert.equal(res.status, 403, "a deprovisioned caller kept being served");
    assert.equal(
      repliers.received.length,
      before,
      "the tool still called the API, which would arrive as REPLIERS-API-KEY: undefined"
    );
  });
});
