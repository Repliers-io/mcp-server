import test from "node:test";
import assert from "node:assert/strict";
import {
  startFakePropelAuth,
  startFakeRepliersApi,
  startMcpServer,
  openSession,
  callTool,
} from "./helpers/hostedMcpServer.js";

const TOOL = { name: "autocomplete-location-search", args: { search: "tor" } };

test("hosted mode resolves the Repliers key per request, not per session", async (t) => {
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
  const aliceSession = await openSession(port, "alice-token");

  await t.test("a tool call reaches the API with the caller's own key", async () => {
    const { status, text } = await callTool(port, {
      token: "alice-token",
      sessionId: aliceSession,
      ...TOOL,
    });
    assert.equal(status, 200, text);
    assert.match(text, /receivedKey/, `tool never reached the stub API: ${text}`);
    assert.equal(repliers.lastKey(), "KEY-ALICE-1");
  });

  await t.test("a key rotated mid-session takes effect on the next call", async () => {
    // The operator revokes Alice's key and issues a new one. Nothing about her MCP session
    // changes — same session id, same transport, same server instance.
    propelAuth.rotateKey("user-alice", "KEY-ALICE-2");

    const { status, text } = await callTool(port, {
      token: "alice-token",
      sessionId: aliceSession,
      ...TOOL,
    });
    assert.equal(status, 200, text);
    assert.equal(
      repliers.lastKey(),
      "KEY-ALICE-2",
      "the session kept serving the key captured when it was opened, so a revoked key stays live"
    );
  });

  await t.test("each session's calls carry that session owner's key", async () => {
    const bobSession = await openSession(port, "bob-token");

    await callTool(port, { token: "bob-token", sessionId: bobSession, ...TOOL });
    assert.equal(repliers.lastKey(), "KEY-BOB-1");

    await callTool(port, { token: "alice-token", sessionId: aliceSession, ...TOOL });
    assert.equal(repliers.lastKey(), "KEY-ALICE-2");
  });
});
