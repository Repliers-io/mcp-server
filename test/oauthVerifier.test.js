import test from "node:test";
import assert from "node:assert/strict";
import { createIntrospectionVerifier } from "../lib/oauthVerifier.js";

const AUDIENCES = new Set(["https://mcp.test", "https://mcp.test/mcp"]);
const future = () => Math.floor(Date.now() / 1000) + 3600;

function verifierWith(claims, overrides = {}) {
  const calls = [];
  const verifier = createIntrospectionVerifier({
    introspectionEndpoint: "https://auth.test/oauth/2.1/introspect",
    clientId: "introspect-id",
    clientSecret: "introspect-secret",
    audiences: AUDIENCES,
    resolveApiKey: async (sub) => ({ key: `KEY-${sub}`, lookupFailed: false, reason: null }),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => claims };
    },
    ...overrides,
  });
  return { verifier, calls };
}

test("an active token becomes AuthInfo carrying scopes, identity and key", async () => {
  const { verifier, calls } = verifierWith({
    active: true,
    sub: "user-alice",
    client_id: "client-1",
    scope: "mcp:read mcp:write",
    aud: "https://mcp.test/mcp",
    org_id: "org-7",
    exp: future(),
  });

  const info = await verifier.verifyAccessToken("tok");

  assert.deepEqual(info.scopes, ["mcp:read", "mcp:write"]);
  assert.equal(info.clientId, "client-1");
  assert.equal(info.extra.userId, "user-alice");
  assert.equal(info.extra.orgId, "org-7");
  assert.equal(info.extra.repliersApiKey, "KEY-user-alice");
  assert.equal(info.resource.href, "https://mcp.test/mcp");

  // RFC 7662: the resource server authenticates to the introspection endpoint.
  const basic = Buffer.from("introspect-id:introspect-secret").toString("base64");
  assert.equal(calls[0].init.headers.Authorization, `Basic ${basic}`);
  assert.match(calls[0].init.body, /token=tok/);
});

test("an inactive token is rejected as an invalid token", async () => {
  const { verifier } = verifierWith({ active: false });
  await assert.rejects(() => verifier.verifyAccessToken("tok"), /not active/i);
});

// The whole point of the migration: a token minted for somebody else's resource on the same
// tenant must not open this server, even though it introspects as perfectly active.
test("a token issued for another resource is rejected", async () => {
  const { verifier } = verifierWith({
    active: true,
    sub: "user-alice",
    scope: "mcp:read",
    aud: "https://someone-else.test/mcp",
    exp: future(),
  });
  await assert.rejects(() => verifier.verifyAccessToken("tok"), /does not name this server/);
});

test("the resource claim is read when aud is absent, and trailing slashes do not matter", async () => {
  const { verifier } = verifierWith({
    active: true,
    sub: "user-alice",
    scope: "mcp:read",
    resource: "https://mcp.test/mcp/",
    exp: future(),
  });
  const info = await verifier.verifyAccessToken("tok");
  assert.equal(info.resource.href, "https://mcp.test/mcp");
});

test("requireAudience:false accepts a token with no audience at all", async () => {
  const { verifier } = verifierWith(
    { active: true, sub: "user-alice", scope: "mcp:read", exp: future() },
    { requireAudience: false }
  );
  const info = await verifier.verifyAccessToken("tok");
  assert.equal(info.resource, undefined);
});

// requireBearerAuth rejects any AuthInfo without a numeric expiresAt, which would surface as a
// blanket 401 with no cause. Name the cause here instead.
test("introspection without exp is a server error, not a 401", async () => {
  const { verifier } = verifierWith({
    active: true,
    sub: "user-alice",
    scope: "mcp:read",
    aud: "https://mcp.test/mcp",
  });
  await assert.rejects(() => verifier.verifyAccessToken("tok"), /exp/);
});

test("a second call inside the TTL does not hit the endpoint again", async () => {
  const { verifier, calls } = verifierWith({
    active: true,
    sub: "user-alice",
    scope: "mcp:read",
    aud: "https://mcp.test/mcp",
    exp: future(),
  });

  await verifier.verifyAccessToken("tok");
  await verifier.verifyAccessToken("tok");

  assert.equal(calls.length, 1);
});

// The introspection verdict may be cached; the Repliers key may not. This server resolves the
// key per request so that a key revoked or rotated in PropelAuth stops working on the very next
// call, and caching it alongside the verdict would quietly keep a revoked key alive for a minute.
test("the key is resolved on every call even when the verdict is cached", async () => {
  const resolved = [];
  let key = "KEY-1";
  const { verifier, calls } = verifierWith(
    {
      active: true,
      sub: "user-alice",
      scope: "mcp:read",
      aud: "https://mcp.test/mcp",
      exp: future(),
    },
    {
      resolveApiKey: async (sub) => {
        resolved.push(sub);
        return { key, lookupFailed: false, reason: null };
      },
    }
  );

  const first = await verifier.verifyAccessToken("tok");
  key = "KEY-2";
  const second = await verifier.verifyAccessToken("tok");

  assert.equal(calls.length, 1, "the introspection verdict should still be cached");
  assert.deepEqual(resolved, ["user-alice", "user-alice"]);
  assert.equal(first.extra.repliersApiKey, "KEY-1");
  assert.equal(second.extra.repliersApiKey, "KEY-2");
});

test("the cache never outlives the token", async () => {
  let clock = 1_000_000;
  const exp = Math.floor(clock / 1000) + 5; // five seconds of life left
  const { verifier, calls } = verifierWith(
    { active: true, sub: "user-alice", scope: "mcp:read", aud: "https://mcp.test/mcp", exp },
    { cacheTtlMs: 60_000, now: () => clock }
  );

  await verifier.verifyAccessToken("tok");
  clock += 6_000;
  await verifier.verifyAccessToken("tok");

  assert.equal(calls.length, 2);
});

test("an unreachable introspection endpoint is a server error, not a 401", async () => {
  const { verifier } = verifierWith(null, {
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  await assert.rejects(() => verifier.verifyAccessToken("tok"), /ECONNREFUSED/);
});
