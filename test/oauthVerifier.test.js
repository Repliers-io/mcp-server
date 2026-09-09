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

// PropelAuth's own documentation disagrees with itself about which field carries the audience,
// so both are read — and a token that names us in either one is for us. Picking whichever field
// happens to be populated first would reject a token whose `resource` holds something else.
test("both aud and resource are consulted, not whichever comes first", async () => {
  const { verifier } = verifierWith({
    active: true,
    sub: "user-alice",
    scope: "mcp:read",
    resource: "urn:propelauth:internal-id",
    aud: "https://mcp.test/mcp",
    exp: future(),
  });
  const info = await verifier.verifyAccessToken("tok");
  assert.equal(info.resource.href, "https://mcp.test/mcp");
});

// Several authorization servers return scope as an array rather than the space-delimited string
// RFC 7662 specifies. Reading only the string shape would leave every user with no scopes at all.
test("a scope array is understood as well as a scope string", async () => {
  const { verifier } = verifierWith({
    active: true,
    sub: "user-alice",
    scope: ["mcp:read", "mcp:write"],
    aud: "https://mcp.test/mcp",
    exp: future(),
  });
  const info = await verifier.verifyAccessToken("tok");
  assert.deepEqual(info.scopes, ["mcp:read", "mcp:write"]);
});

// RFC 7662 answers for any token type; token_type_hint is only a hint. If the authorization
// server tells us this credential is not an access token, believe it.
test("a credential the authorization server does not call an access token is refused", async () => {
  const { verifier } = verifierWith({
    active: true,
    sub: "user-alice",
    scope: "mcp:read",
    aud: "https://mcp.test/mcp",
    token_type: "refresh_token",
    exp: future(),
  });
  await assert.rejects(() => verifier.verifyAccessToken("tok"), /not an access token/i);
});

// The audience is echoed into an error message that the SDK writes verbatim into the
// WWW-Authenticate header. RFC 8707 makes `resource` client-supplied, so an authorization server
// that echoes it into `aud` would let a caller inject quotes or CRLF into our own response header.
test("a hostile audience claim cannot be injected into the challenge", async () => {
  const { verifier } = verifierWith({
    active: true,
    sub: "user-alice",
    scope: "mcp:read",
    aud: 'https://evil.test/"\r\nX-Injected: yes',
    exp: future(),
  });
  await assert.rejects(
    () => verifier.verifyAccessToken("tok"),
    (error) => {
      assert.doesNotMatch(error.message, /[\r\n"]/, `unescaped in: ${error.message}`);
      return true;
    }
  );
});

// A misconfigured TTL used to disable caching silently: Number("") is 0, Number("60s") is NaN,
// and both fail the ttl > 0 guard, so every request hit the rate-limited endpoint with no log.
test("an unusable cache TTL falls back to the default instead of disabling the cache", async () => {
  for (const bad of ["", "60s", undefined, -1]) {
    const { verifier, calls } = verifierWith(
      {
        active: true,
        sub: "user-alice",
        scope: "mcp:read",
        aud: "https://mcp.test/mcp",
        exp: future(),
      },
      { cacheTtlMs: bad === undefined ? undefined : Number(bad) }
    );
    await verifier.verifyAccessToken("tok");
    await verifier.verifyAccessToken("tok");
    assert.equal(calls.length, 1, `cache was disabled by TTL ${JSON.stringify(bad)}`);
  }
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

// An MCP client opens several connections at once, all carrying the same freshly issued token,
// and none of them find anything in the cache. Without in-flight deduplication that burst turns
// into one introspection call per request against an endpoint whose rate limits are unknown.
test("concurrent requests with one cold token cause a single introspection", async () => {
  let open;
  const gate = new Promise((resolve) => (open = resolve));
  const calls = [];
  const claims = {
    active: true,
    sub: "user-alice",
    scope: "mcp:read",
    aud: "https://mcp.test/mcp",
    exp: future(),
  };

  const verifier = createIntrospectionVerifier({
    introspectionEndpoint: "https://auth.test/oauth/2.1/introspect",
    clientId: "introspect-id",
    clientSecret: "introspect-secret",
    audiences: AUDIENCES,
    resolveApiKey: async (sub) => ({ key: `KEY-${sub}`, lookupFailed: false, reason: null }),
    fetchImpl: async () => {
      calls.push(1);
      await gate;
      return { ok: true, json: async () => claims };
    },
  });

  const inFlight = Promise.all([
    verifier.verifyAccessToken("tok"),
    verifier.verifyAccessToken("tok"),
    verifier.verifyAccessToken("tok"),
  ]);
  open();
  const results = await inFlight;

  assert.equal(calls.length, 1);
  assert.deepEqual(
    results.map((r) => r.extra.userId),
    ["user-alice", "user-alice", "user-alice"]
  );
});

// A failed introspection must not be remembered as an answer: the next request has to ask again.
test("a failed introspection is not left behind as a pending answer", async () => {
  let attempt = 0;
  const { verifier } = verifierWith(null, {
    fetchImpl: async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("ECONNREFUSED");
      return {
        ok: true,
        json: async () => ({
          active: true,
          sub: "user-alice",
          scope: "mcp:read",
          aud: "https://mcp.test/mcp",
          exp: future(),
        }),
      };
    },
  });

  await assert.rejects(() => verifier.verifyAccessToken("tok"), /ECONNREFUSED/);
  const info = await verifier.verifyAccessToken("tok");
  assert.equal(info.extra.userId, "user-alice");
});

// Without a deadline a half-open connection to PropelAuth stalls for undici's default of five
// minutes, and in-flight deduplication makes every request carrying that token join the same
// hung promise rather than retry.
test("the introspection request carries a deadline", async () => {
  let seen;
  const { verifier } = verifierWith(
    { active: true, sub: "user-alice", scope: "mcp:read", aud: "https://mcp.test/mcp", exp: future() },
    {
      fetchImpl: async (url, init) => {
        seen = init.signal;
        return { ok: true, json: async () => ({ active: false }) };
      },
    }
  );

  await assert.rejects(() => verifier.verifyAccessToken("tok"));
  assert.ok(seen instanceof AbortSignal, "no abort signal was attached to the introspection call");
});

// Tokens rotate on every refresh, so a long-running process would otherwise accumulate one
// permanent cache entry per token per user per refresh interval.
test("the verdict cache is bounded", async () => {
  const calls = [];
  const claims = (sub) => ({
    active: true,
    sub,
    scope: "mcp:read",
    aud: "https://mcp.test/mcp",
    exp: future(),
  });

  const verifier = createIntrospectionVerifier({
    introspectionEndpoint: "https://auth.test/oauth/2.1/introspect",
    clientId: "introspect-id",
    clientSecret: "introspect-secret",
    audiences: AUDIENCES,
    maxCacheEntries: 3,
    resolveApiKey: async (sub) => ({ key: `KEY-${sub}`, lookupFailed: false, reason: null }),
    fetchImpl: async (url, init) => {
      const token = new URLSearchParams(init.body).get("token");
      calls.push(token);
      return { ok: true, json: async () => claims(`user-${token}`) };
    },
  });

  for (const token of ["a", "b", "c", "d", "e"]) await verifier.verifyAccessToken(token);
  const beforeReplay = calls.length;

  // The most recent entries are still cached; the oldest have been evicted rather than kept.
  await verifier.verifyAccessToken("e");
  assert.equal(calls.length, beforeReplay, "the newest entry should still be cached");

  await verifier.verifyAccessToken("a");
  assert.equal(calls.length, beforeReplay + 1, "the oldest entry should have been evicted");
});

test("an unreachable introspection endpoint is a server error, not a 401", async () => {
  const { verifier } = verifierWith(null, {
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  await assert.rejects(() => verifier.verifyAccessToken("tok"), /ECONNREFUSED/);
});

// A bare status number is unreadable on cutover day: three new secrets are in play and none of
// them is named. 401 is ours, 404 is the tenant's.
test("a refused introspection names the introspection credentials", async () => {
  const { verifier } = verifierWith(null, {
    fetchImpl: async () => ({ ok: false, status: 401 }),
  });
  await assert.rejects(() => verifier.verifyAccessToken("tok"), /PROPELAUTH_MCP_INTROSPECT_CLIENT_ID/);
});

test("a missing introspection endpoint points at MCP Auth, not at our credentials", async () => {
  const { verifier } = verifierWith(null, {
    fetchImpl: async () => ({ ok: false, status: 404 }),
  });
  await assert.rejects(() => verifier.verifyAccessToken("tok"), /MCP Auth is not enabled/);
});
