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
