import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { INITIALIZE, mcpFetch, startFakePropelAuth, startMcpServer } from "./helpers/hostedMcpServer.js";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url)));

/**
 * Claude.ai does not read `serverInfo.icons` for custom connectors yet — it resolves a
 * connector's picture by fetching a favicon from the connector's own host, and mcp.repliers.io
 * answered 404 to every path a resolver probes. These routes are the fallback that makes that
 * lookup succeed, so they have to sit outside the bearer-auth chain: a favicon fetcher carries
 * no token and would otherwise be handed a 401 and a WWW-Authenticate challenge.
 */
test("the connector's icon is served to callers that carry no token", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const origin = `http://127.0.0.1:${mcp.port}`;

  for (const path of [
    "/favicon.ico",
    "/favicon.png",
    "/icon.png",
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
  ]) {
    await t.test(`${path} is public`, async () => {
      const res = await fetch(`${origin}${path}`);
      assert.equal(res.status, 200, `${path} must be reachable unauthenticated`);
      assert.match(res.headers.get("content-type") ?? "", /^image\//, "must be served as an image");
      assert.ok((await res.arrayBuffer()).byteLength > 0, `${path} served nothing`);
    });
  }
});

/**
 * The spec-blessed half of the same problem: a client that does read MCP metadata gets the icon
 * and the website out of the initialize result, with nothing left to fetch. Asserted through a
 * real server rather than against lib/serverIdentity.js, because what matters is that it reaches
 * the wire — and stdio builds its Implementation from the same function.
 */
test("initialize hands the client the server's identity", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const res = await mcpFetch(mcp.port, { token: "alice-token", body: INITIALIZE });
  const text = await res.text();
  assert.equal(res.status, 200, `initialize failed: ${text}`);

  const [, payload] = text.match(/^data: (.+)$/m) ?? [];
  assert.ok(payload, `no SSE payload in: ${text}`);
  const { serverInfo } = JSON.parse(payload).result;

  // The version used to be a literal at both `new Server` call sites and again in /health, and
  // all three said 0.1.0 while the package said 0.0.1. This is what keeps the one copy honest.
  assert.equal(serverInfo.version, pkg.version);
  assert.equal(serverInfo.websiteUrl, "https://repliers.io");
  assert.ok(serverInfo.icons?.length, "no icons advertised");
  for (const icon of serverInfo.icons) {
    assert.match(icon.src, /^data:image\/png;base64,/, "icons must survive JSON transport intact");
  }
});
