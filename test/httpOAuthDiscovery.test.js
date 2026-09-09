import test from "node:test";
import assert from "node:assert/strict";
import { INITIALIZE, mcpFetch, startFakePropelAuth, startMcpServer } from "./helpers/hostedMcpServer.js";

/**
 * This server is a resource server. Every document that claimed otherwise is gone.
 *
 * /.well-known/oauth-authorization-server described a server we are not: RFC 8414 §3.3 makes
 * `issuer` the identity of whoever served the document, so naming ourselves there was the only
 * legal answer and also a lie, while naming PropelAuth made Codex discard it outright.
 * /oauth/register registered nothing — it handed back one pre-existing PropelAuth client whose
 * redirect URIs are fixed in that dashboard. Both are replaced by protected resource metadata
 * pointing at PropelAuth's own MCP authorization server, which is where authorization belongs.
 */
test("the server no longer claims to be an authorization server", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const origin = `http://127.0.0.1:${mcp.port}`;

  for (const path of [
    "/.well-known/oauth-authorization-server",
    "/.well-known/openid-configuration",
  ]) {
    const res = await fetch(`${origin}${path}`);
    assert.equal(res.status, 404, `${path} must be gone`);
  }

  const register = await fetch(`${origin}/oauth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ redirect_uris: ["http://127.0.0.1:51000/callback"] }),
  });
  assert.equal(register.status, 404, "/oauth/register must be gone");
});

test("protected resource metadata points at PropelAuth's MCP authorization server", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const origin = `http://127.0.0.1:${mcp.port}`;
  const upstream = `http://127.0.0.1:${propelAuth.port}/oauth/2.1`;

  // RFC 9728 §3.1: metadata for the resource https://host/mcp lives one path segment deep at
  // /.well-known/oauth-protected-resource/mcp, not under /mcp itself.
  await t.test("the /mcp document names the /mcp resource", async () => {
    const doc = await (await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`)).json();
    assert.equal(doc.resource, `${origin}/mcp`);
    assert.deepEqual(doc.authorization_servers, [upstream]);
    assert.deepEqual(doc.bearer_methods_supported, ["header"]);
  });

  await t.test("the root document names the root resource", async () => {
    const doc = await (await fetch(`${origin}/.well-known/oauth-protected-resource`)).json();
    assert.equal(doc.resource, origin);
    assert.deepEqual(doc.authorization_servers, [upstream]);
  });
});

/**
 * RFC 9728 §5.1: an unauthenticated request must come back with a pointer to the metadata, or a
 * client has no way to learn where to log in.
 *
 * The challenge names no `scope`, because this server defines none: a token that opens it can
 * call anything on it. A client asks for whatever the challenge advertises, so naming one here
 * would send it looking for a scope the authorization server has never heard of.
 */
test("an unauthenticated request is told where to authenticate", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const origin = `http://127.0.0.1:${mcp.port}`;

  await t.test("401 on /mcp points at the matching metadata document", async () => {
    const res = await mcpFetch(mcp.port, { body: INITIALIZE });
    await res.text();

    assert.equal(res.status, 401);
    const challenge = res.headers.get("www-authenticate") ?? "";
    assert.match(
      challenge,
      new RegExp(`resource_metadata="${origin}/\\.well-known/oauth-protected-resource/mcp"`)
    );
    assert.doesNotMatch(challenge, /scope=/);
  });

  await t.test("401 on / points at the root metadata document", async () => {
    const res = await fetch(`${origin}/`, { method: "POST" });
    await res.text();

    assert.equal(res.status, 401);
    assert.match(
      res.headers.get("www-authenticate") ?? "",
      new RegExp(`resource_metadata="${origin}/\\.well-known/oauth-protected-resource"`)
    );
  });

  await t.test("a rejected token gets the challenge too, tagged invalid_token", async () => {
    const res = await mcpFetch(mcp.port, { token: "not-a-real-token", body: INITIALIZE });
    await res.text();

    assert.equal(res.status, 401);
    const challenge = res.headers.get("www-authenticate") ?? "";
    assert.match(challenge, /error="invalid_token"/);
    assert.match(challenge, /resource_metadata="/);
  });
});

test("a self-hosted server advertises no authorization server", async (t) => {
  // With its own REPLIERS_API_KEY there is no OAuth in the chain at all. Publishing protected
  // resource metadata there would send clients off on a login flow this server never asked for.
  const mcp = await startMcpServer({
    env: { REPLIERS_API_KEY: "self-hosted-key" },
  });
  t.after(() => mcp.close());

  const origin = `http://127.0.0.1:${mcp.port}`;
  for (const path of [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
  ]) {
    const res = await fetch(`${origin}${path}`);
    assert.equal(res.status, 404, `${path} must not be served in self-hosted mode`);
  }
});
