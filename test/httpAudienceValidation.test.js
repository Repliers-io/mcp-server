import test from "node:test";
import assert from "node:assert/strict";
import { INITIALIZE, mcpFetch, startFakePropelAuth, startMcpServer } from "./helpers/hostedMcpServer.js";

/**
 * A token minted for another resource on the same PropelAuth tenant introspects as perfectly
 * active. Before audience validation it therefore opened this server and spent the account's
 * Repliers key — the "access token privilege restriction" failure the MCP specification calls
 * out, and the reason it makes audience checking a MUST rather than a recommendation.
 */
test("a token issued for a different resource is refused", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  // startMcpServer aimed the fake at this server; aim it somewhere else instead.
  propelAuth.setAudience("https://someone-else.test/mcp");

  const res = await mcpFetch(mcp.port, { token: "alice-token", body: INITIALIZE });
  await res.text();

  assert.equal(res.status, 401);
  assert.match(res.headers.get("www-authenticate") ?? "", /resource_metadata=/);
});

test("a token issued for this resource is accepted", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const res = await mcpFetch(mcp.port, { token: "alice-token", body: INITIALIZE });
  await res.text();

  assert.equal(res.status, 200);
});

// The audience the server accepts comes from MCP_PUBLIC_URL, never from the request, so a
// caller cannot make a foreign token acceptable by claiming to be the host it was minted for.
test("a spoofed Host header cannot widen the accepted audience", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  propelAuth.setAudience("https://someone-else.test/mcp");

  const res = await fetch(`http://127.0.0.1:${mcp.port}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      authorization: "Bearer alice-token",
      host: "someone-else.test",
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify(INITIALIZE),
  });
  await res.text();

  assert.equal(res.status, 401);
});
