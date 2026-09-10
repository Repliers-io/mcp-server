import test from "node:test";
import assert from "node:assert/strict";
import { createKeyResolver } from "../lib/repliersKey.js";

function resolverWith(handler) {
  return createKeyResolver({
    backendBaseUrl: "https://auth.test",
    apiKey: "propelauth-key",
    fetchImpl: handler,
  });
}

test("returns the key stored in PropelAuth user metadata", async () => {
  const seen = [];
  const resolve = resolverWith(async (url, init) => {
    seen.push({ url, auth: init.headers.Authorization });
    return { ok: true, json: async () => ({ metadata: { repliers_api_key: "KEY-1" } }) };
  });

  const result = await resolve("user-alice");

  assert.deepEqual(result, { key: "KEY-1", lookupFailed: false, reason: null });
  assert.equal(seen[0].url, "https://auth.test/api/backend/v1/user/user-alice");
  assert.equal(seen[0].auth, "Bearer propelauth-key");
});

// "The account has no key" is the account owner's problem; "we could not ask" is ours.
// Collapsing them sends the wrong person to investigate.
test("an account without a key is not a lookup failure", async () => {
  const resolve = resolverWith(async () => ({ ok: true, json: async () => ({ metadata: {} }) }));
  const result = await resolve("user-keyless");
  assert.equal(result.key, null);
  assert.equal(result.lookupFailed, false);
  assert.match(result.reason, /no repliers_api_key/);
});

// Both are lookup failures, but different people fix them, and the only place that distinction
// can be made is here: 401 is our credential being refused, 404 is the token's `sub` not being
// an id this API knows. A bare status leaves whoever reads the log on cutover day guessing.
test("a refused credential names PROPELAUTH_API_KEY", async () => {
  const resolve = resolverWith(async () => ({ ok: false, status: 401 }));
  const result = await resolve("user-alice");
  assert.equal(result.lookupFailed, true);
  assert.match(result.reason, /401/);
  assert.match(result.reason, /PROPELAUTH_API_KEY/);
  assert.match(result.reason, /environment/);
});

test("an unknown user points at the sub assumption, not at the key", async () => {
  const resolve = resolverWith(async () => ({ ok: false, status: 404 }));
  const result = await resolve("user-alice");
  assert.equal(result.lookupFailed, true);
  assert.match(result.reason, /404/);
  assert.match(result.reason, /Q5/);
  assert.doesNotMatch(result.reason, /rejected/);
});

test("a thrown fetch is a lookup failure, not a crash", async () => {
  const resolve = resolverWith(async () => {
    throw new Error("ECONNREFUSED");
  });
  const result = await resolve("user-alice");
  assert.equal(result.lookupFailed, true);
  assert.match(result.reason, /ECONNREFUSED/);
});

// The id comes from the authorization server, not the caller, but its shape is recorded as
// unverified (design.md Q5). If it ever arrives composite or pseudonymous, an unencoded value
// would silently retarget a request made with our own PropelAuth API key at a different endpoint
// instead of failing.
test("a user id with path characters cannot rewrite the backend URL", async () => {
  const seen = [];
  const resolve = resolverWith(async (url) => {
    seen.push(url);
    return { ok: true, json: async () => ({ metadata: {} }) };
  });

  await resolve("x/../../org/1?y=2");

  assert.equal(seen[0], "https://auth.test/api/backend/v1/user/x%2F..%2F..%2Forg%2F1%3Fy%3D2");
});

test("a missing PROPELAUTH_API_KEY is a lookup failure named as such", async () => {
  const resolve = createKeyResolver({ backendBaseUrl: "https://auth.test", apiKey: "" });
  const result = await resolve("user-alice");
  assert.equal(result.lookupFailed, true);
  assert.match(result.reason, /PROPELAUTH_API_KEY/);
});
