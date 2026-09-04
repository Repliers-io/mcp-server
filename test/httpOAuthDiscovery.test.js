import test from "node:test";
import assert from "node:assert/strict";
import { startFakePropelAuth, startMcpServer } from "./helpers/hostedMcpServer.js";

/**
 * RFC 8414 §3.3: the `issuer` in the metadata must be identical to the origin the document
 * was fetched from, and a client that finds otherwise MUST discard the document. Codex
 * enforces this ("OAuth authorization server issuer does not match authorization metadata
 * origin") and refuses to log in; claude.ai happens not to, which is why this went unnoticed.
 */
test("the OAuth discovery document is valid for the origin it is served from", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuthPort: propelAuth.port });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const origin = `http://127.0.0.1:${mcp.port}`;
  const discovery = `${origin}/.well-known/oauth-authorization-server`;

  await t.test("issuer names this server, not the upstream identity provider", async () => {
    const doc = await (await fetch(discovery)).json();
    assert.equal(
      doc.issuer,
      origin,
      `issuer must equal the origin the document came from, got ${doc.issuer}`
    );
  });

  await t.test("every endpoint we host belongs to that same issuer", async () => {
    const doc = await (await fetch(discovery)).json();
    assert.equal(new URL(doc.registration_endpoint).origin, doc.issuer);
  });

  await t.test("authorize and token still point at PropelAuth", async () => {
    // Guards the scope of the fix: only the issuer identity moves to this host. The actual
    // authorization still happens upstream, so nothing about the live flow changes.
    const doc = await (await fetch(discovery)).json();
    const upstream = `http://127.0.0.1:${propelAuth.port}`;
    assert.equal(new URL(doc.authorization_endpoint).origin, upstream);
    assert.equal(new URL(doc.token_endpoint).origin, upstream);
  });

  await t.test("honours the scheme a TLS-terminating proxy reports", async () => {
    // In production Heroku terminates TLS and forwards plain HTTP, so the scheme has to come
    // from x-forwarded-proto or the issuer would read http:// on an https:// deployment.
    const doc = await (
      await fetch(discovery, { headers: { "x-forwarded-proto": "https" } })
    ).json();
    assert.equal(doc.issuer, `https://127.0.0.1:${mcp.port}`);
  });
});

/**
 * RFC 9728 / MCP authorization: this server is a *resource* server, not an authorization
 * server. Clients look for that first — Codex tries all three protected-resource paths before
 * it ever falls back to the authorization-server document — and the 401 is supposed to carry a
 * pointer to it. Without both, a client has no way to learn that PropelAuth is where it should
 * be authenticating.
 */
test("the server advertises itself as an OAuth protected resource", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuthPort: propelAuth.port });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const origin = `http://127.0.0.1:${mcp.port}`;
  const upstream = `http://127.0.0.1:${propelAuth.port}`;

  await t.test("names this resource and the upstream authorization server", async () => {
    const doc = await (await fetch(`${origin}/.well-known/oauth-protected-resource`)).json();
    assert.equal(doc.resource, `${origin}/`);
    assert.deepEqual(doc.authorization_servers, [upstream]);
  });

  await t.test("covers the /mcp endpoint under its path-aware address", async () => {
    // RFC 9728 §3.1: metadata for the resource https://host/mcp lives at
    // https://host/.well-known/oauth-protected-resource/mcp, not under /mcp.
    const doc = await (await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`)).json();
    assert.equal(doc.resource, `${origin}/mcp`);
    assert.deepEqual(doc.authorization_servers, [upstream]);
  });

  await t.test("401 on /mcp points at the matching metadata document", async () => {
    const res = await fetch(`${origin}/mcp`, { method: "POST" });
    assert.equal(res.status, 401);
    assert.match(
      res.headers.get("www-authenticate") || "",
      new RegExp(`resource_metadata="${origin}/\.well-known/oauth-protected-resource/mcp"`)
    );
  });

  await t.test("401 on / points at the root metadata document", async () => {
    const res = await fetch(`${origin}/`, { method: "POST" });
    assert.equal(res.status, 401);
    assert.match(
      res.headers.get("www-authenticate") || "",
      new RegExp(`resource_metadata="${origin}/\.well-known/oauth-protected-resource"`)
    );
  });

  await t.test("a rejected token gets the challenge too, tagged invalid_token", async () => {
    const res = await fetch(`${origin}/mcp`, {
      method: "POST",
      headers: { authorization: "Bearer not-a-real-token" },
    });
    assert.equal(res.status, 401);
    const challenge = res.headers.get("www-authenticate") || "";
    assert.match(challenge, /error="invalid_token"/);
    assert.match(challenge, /resource_metadata="/);
  });
});

test("a self-hosted server advertises no authorization server", async (t) => {
  // With its own REPLIERS_API_KEY there is no OAuth in the chain at all. Publishing protected
  // resource metadata there would send clients off on a login flow this server never asked for.
  const mcp = await startMcpServer({
    propelAuthPort: 1,
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

/**
 * /oauth/register cannot actually register anything: it hands back one pre-existing PropelAuth
 * client whose redirect URIs are fixed in that dashboard. Answering 201 to a client that asked
 * for a different URI tells it registration succeeded, so it authorizes with its own loopback
 * address — which PropelAuth refuses by rendering a bare 404, two hops later and on another
 * domain. Claude Desktop and Codex allocate a fresh port and path per login, so they always
 * land there; claude.ai has one fixed callback that is registered, so it never does.
 */
test("registration refuses redirect URIs that PropelAuth would reject", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({
    propelAuthPort: propelAuth.port,
    env: {
      OAUTH_CLIENT_ID: "test-client-id",
      OAUTH_CLIENT_SECRET: "test-client-secret",
      OAUTH_REDIRECT_URIS: "https://claude.ai/api/mcp/auth_callback",
    },
  });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const register = (body) =>
    fetch(`http://127.0.0.1:${mcp.port}/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  await t.test("a fresh loopback callback is rejected, not silently accepted", async () => {
    const res = await register({
      client_name: "claude-desktop",
      redirect_uris: ["http://127.0.0.1:63825/callback/vLtCNl7yDCBq"],
    });
    const body = await res.json();

    assert.equal(
      res.status,
      400,
      `registration was faked for an unusable redirect_uri, which dead-ends at PropelAuth: ${JSON.stringify(body)}`
    );
    assert.equal(body.error, "invalid_redirect_uri", "RFC 7591 §3.2.2 names this error");
    assert.match(
      body.error_description,
      /127\.0\.0\.1:63825/,
      "the error must name the URI that was refused"
    );
    assert.ok(!body.client_secret, "a refused registration must not hand out the client secret");
  });

  await t.test("the registered callback still gets the pre-configured client", async () => {
    // Guards the one flow that works today: breaking it to fix the broken ones is not a fix.
    const res = await register({
      client_name: "claude-ai",
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
    });
    const body = await res.json();

    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(body.client_id, "test-client-id");
    assert.equal(body.client_secret, "test-client-secret");
  });

  await t.test("a request naming no redirect_uri keeps its previous behaviour", async () => {
    const res = await register({ client_name: "unspecified" });
    assert.equal(res.status, 201);
  });
});

test("registration stays unsupported when no client is configured", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({
    propelAuthPort: propelAuth.port,
    env: { OAUTH_CLIENT_ID: "" },
  });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const res = await fetch(`http://127.0.0.1:${mcp.port}/oauth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ redirect_uris: ["https://example.test/cb"] }),
  });
  assert.equal(res.status, 501);
  assert.equal((await res.json()).error, "registration_not_supported");
});
