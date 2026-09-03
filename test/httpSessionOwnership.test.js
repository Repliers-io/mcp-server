import test from "node:test";
import assert from "node:assert/strict";
import {
  startFakePropelAuth,
  startMcpServer,
  mcpFetch,
  openSession,
} from "./helpers/hostedMcpServer.js";

test("hosted mode binds MCP sessions to the authenticated caller", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuthPort: propelAuth.port });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const { port } = mcp;
  const aliceSession = await openSession(port, "alice-token");

  await t.test("rejects a foreign caller presenting another user's session id", async () => {
    const res = await mcpFetch(port, {
      token: "bob-token", // Bob's own valid token — he is authenticated, just not the owner
      sessionId: aliceSession,
      body: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    });
    const text = await res.text();
    assert.equal(
      res.status,
      404,
      `Bob rode Alice's session and would have used her Repliers key. Response: ${text}`
    );
  });

  await t.test("still serves the session to its rightful owner", async () => {
    const res = await mcpFetch(port, {
      token: "alice-token",
      sessionId: aliceSession,
      body: { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} },
    });
    const text = await res.text();
    assert.equal(res.status, 200, `owner was locked out of her own session: ${text}`);
    assert.match(text, /Search_Listings/, `expected a tool roster, got: ${text}`);
  });

  await t.test("refuses to let a foreign caller terminate the session", async () => {
    const attack = await mcpFetch(port, {
      token: "bob-token",
      sessionId: aliceSession,
      method: "DELETE",
    });
    await attack.text();
    assert.equal(attack.status, 404, "Bob was able to address Alice's session with DELETE");

    const survivor = await mcpFetch(port, {
      token: "alice-token",
      sessionId: aliceSession,
      body: { jsonrpc: "2.0", id: 4, method: "tools/list", params: {} },
    });
    await survivor.text();
    assert.equal(survivor.status, 200, "Alice's session did not survive Bob's DELETE");
  });

  await t.test("rejects an unknown session id", async () => {
    const res = await mcpFetch(port, {
      token: "alice-token",
      sessionId: "00000000-0000-4000-8000-000000000000",
      body: { jsonrpc: "2.0", id: 5, method: "tools/list", params: {} },
    });
    await res.text();
    assert.equal(res.status, 404);
  });
});
