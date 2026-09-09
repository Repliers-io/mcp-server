import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  startFakePropelAuth,
  startFakeRepliersApi,
  startMcpServer,
} from "./helpers/hostedMcpServer.js";

/**
 * A full login, driven by the SDK's own client-side OAuth implementation — the same code Claude
 * Code and Claude Desktop use — against a fake authorization server.
 *
 * Every other suite checks our half of the contract against assertions we wrote. This one checks
 * it against a real client's parser, which is the half that has broken twice: documents that were
 * defensible on their own terms and that no client would accept. It cannot prove anything about
 * PropelAuth's behaviour, and Codex has its own implementation in Rust, but everything between
 * "client is handed a URL" and "tool call returns data" is exercised for real.
 */

/** The loopback callback shape that cannot be pre-registered — a fresh port *and* path per login. */
const REDIRECT_URI = `http://127.0.0.1:${49152 + Math.floor(Math.random() * 16000)}/callback/${randomUUID()}`;

/** The smallest OAuthClientProvider that satisfies the SDK: everything in memory, no browser. */
class RehearsalOAuthProvider {
  constructor(redirectUrl) {
    this._redirectUrl = redirectUrl;
    this.authorizationUrl = undefined;
  }

  get redirectUrl() {
    return this._redirectUrl;
  }

  get clientMetadata() {
    return {
      client_name: "oauth21 rehearsal",
      redirect_uris: [this._redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }

  clientInformation() {
    return this._client;
  }
  saveClientInformation(info) {
    this._client = info;
  }
  tokens() {
    return this._tokens;
  }
  saveTokens(tokens) {
    this._tokens = tokens;
  }
  saveCodeVerifier(verifier) {
    this._verifier = verifier;
  }
  codeVerifier() {
    return this._verifier;
  }

  /** Where a real client would open a browser. Here the URL is captured and followed by hand. */
  redirectToAuthorization(url) {
    this.authorizationUrl = url;
  }
}

test("a real MCP client can discover, register, log in and call a tool", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const repliers = await startFakeRepliersApi();
  const mcp = await startMcpServer({ propelAuth, repliersApiPort: repliers.port });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
    await repliers.close();
  });

  const serverUrl = new URL(`http://127.0.0.1:${mcp.port}/mcp`);
  const provider = new RehearsalOAuthProvider(REDIRECT_URI);

  // 1. The client connects with no credentials. Our 401 has to carry a pointer the client can
  //    parse, or discovery never starts and the user sees an unexplained failure.
  const firstAttempt = new Client({ name: "rehearsal", version: "1.0.0" });
  await assert.rejects(
    () => firstAttempt.connect(new StreamableHTTPClientTransport(serverUrl, { authProvider: provider })),
    "an unauthenticated connect must fail rather than proceed"
  );

  assert.ok(
    provider.authorizationUrl,
    "the client never reached the authorization step, so discovery failed somewhere"
  );

  // 2. Registration happened dynamically, with the loopback callback that cannot be
  //    pre-registered. This is exactly what fails against the tenant today.
  assert.equal(propelAuth.seen.register.length, 1);
  assert.deepEqual(propelAuth.seen.register[0].redirect_uris, [REDIRECT_URI]);

  // 3. Follow the authorization URL the way a browser would.
  const authorized = await fetch(provider.authorizationUrl, { redirect: "manual" });
  assert.equal(authorized.status, 302, await authorized.text());
  const callback = new URL(authorized.headers.get("location"));
  const code = callback.searchParams.get("code");
  assert.ok(code, `no authorization code in ${callback.href}`);

  // 4. Exchange the code and reconnect with the token the client now holds.
  const authedTransport = new StreamableHTTPClientTransport(serverUrl, { authProvider: provider });
  await authedTransport.finishAuth(code);

  const client = new Client({ name: "rehearsal", version: "1.0.0" });
  await client.connect(authedTransport);
  t.after(() => client.close());

  await t.test("the client asked for a token bound to this server", async () => {
    // The audience our server accepts is a decision we made by reading the specification. This
    // is the only place that checks it against what a client actually sends: selectResourceURL
    // returns the `resource` from our own protected-resource metadata, so a mismatch here would
    // surface in production as "audience does not name this server" and look like PropelAuth's
    // fault.
    const authorize = propelAuth.seen.authorize.at(-1);
    const token = propelAuth.seen.token.at(-1);

    assert.equal(authorize.resource, `http://127.0.0.1:${mcp.port}/mcp`);
    assert.equal(token.resource, `http://127.0.0.1:${mcp.port}/mcp`);
    assert.equal(authorize.code_challenge_method, "S256");
  });

  await t.test("the roster is visible", async () => {
    const { tools } = await client.listTools();
    assert.ok(tools.length > 40, `expected the full roster, got ${tools.length}`);
  });

  await t.test("a tool call is served with this user's Repliers key", async () => {
    await client.callTool({ name: "search-locations", arguments: {} });
    assert.equal(repliers.lastKey(), "KEY-ALICE-1");
  });

  await t.test("a mutating tool is callable after a normal login", async () => {
    const result = await client.callTool({ name: "delete-client", arguments: { clientId: "1" } });
    assert.ok(result, "a normal login must be able to call a mutating tool");
  });
});
