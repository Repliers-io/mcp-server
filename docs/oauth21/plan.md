# OAuth 2.1 Resource Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Repliers MCP server into a spec-conformant OAuth 2.1 resource server that validates PropelAuth MCP Auth tokens by introspection, enforces audience binding and two scopes, and stops impersonating an authorization server.

**Architecture:** Four small pure modules (`lib/scopes.js`, `lib/protectedResource.js`, `lib/repliersKey.js`, `lib/oauthVerifier.js`) carry all the new logic and are unit-tested without a network. `mcpServer.js` shrinks to wiring: the SDK's `requireBearerAuth` owns HTTP auth semantics, a small `requireRepliersKey` middleware preserves today's 503/403 provisioning distinction, and three endpoints are deleted outright.

**Tech Stack:** Node.js (ESM), `express@5.2.1`, `@modelcontextprotocol/sdk@1.30.0`, `node:test`, `node:assert/strict`.

**Spec:** [docs/oauth21/design.md](design.md) — read it first; this plan argues from it and does not repeat its reasoning.

## Global Constraints

- English for all code, comments, commit messages and docs.
- ESM only (`"type": "module"`). Tests are `node:test` + `node:assert/strict`, one file per module, run by `npm test`.
- Never hardcode the Repliers API host; it comes from `lib/apiBase.js`.
- `send-feedback` and every mention of it stays gated on the Trello env keys.
- `refine-search` must never build a query from scratch. Do not weaken this.
- **Do not run `git commit`.** Each task's commit step prepares the exact `git add` and message for the user to run.
- Phase A must not import anything that only exists once PropelAuth MCP Auth is enabled. It is built and green before the dashboard changes.

---

## Fork map

Every unresolved question from design.md §5, where it lands, and what it costs. Phase A is written so that most answers change configuration rather than code.

| Question | Blast radius | Fork |
|---|---|---|
| Q1 metadata address form | None of our code — client-side discovery | **No code fork.** Stop condition: escalate to PropelAuth. §Fork E |
| Q2 `registration_endpoint` present | None of our code | **No code fork.** Stop condition. §Fork E |
| Q3 `code_challenge_methods_supported` | None of our code | **No code fork.** Stop condition. §Fork E |
| Q4 refresh tokens | None | None — user-visible only |
| **Q5 `sub` usable with backend user API** | `lib/repliersKey.js` only | **Task 12** — resolve by email instead |
| Q6 audience field name | Covered by construction: the verifier reads `resource` then `aud` | None |
| **Q7 RFC 8707 honoured** | `lib/oauthVerifier.js` flag | **Task 13** — `OAUTH_REQUIRE_AUDIENCE=false` plus a recorded risk |
| Q8 `org_id` present | Cosmetic (`extra.orgId`) | None |
| Q9 arbitrary scope names | Two constants in `lib/scopes.js` | **Task 14** — one edit |
| Q10 DCR gated by whitelist | None of our code | **No code fork.** Stop condition. §Fork E |
| Q11 introspection rate limit | Cache TTL | **Task 15** — `OAUTH_INTROSPECTION_CACHE_TTL_MS` |
| Q12 tenant side effects | None | None — dashboard owner's call |
| *(new)* `exp` absent from introspection | `lib/oauthVerifier.js` | Detected and named explicitly in Task 3; see Fork E |

**Fork E — the stop conditions.** Q1, Q2, Q3 and Q10 cannot be worked around in this repository. If the probe in Task 11 reports any of them failing, **stop**: the deployment cannot make CLI or desktop logins work, and deploying anyway replaces a working claude.ai connector with a broken one. Record the result in `docs/oauth21/status.md` and escalate to whoever owns the PropelAuth tenant. The same applies if introspection omits `exp`: `requireBearerAuth` rejects every token without it, so there is nothing to ship.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/scopes.js` | *new* — the two scope names and the tool → scope mapping |
| `lib/protectedResource.js` | *new* — configured identity of this resource server: canonical URI, accepted audiences, PRM documents, metadata URLs |
| `lib/repliersKey.js` | *new* — resolving a caller's Repliers API key from PropelAuth. Isolated because Q5 is unverified |
| `lib/oauthVerifier.js` | *new* — RFC 7662 introspection behind the SDK's `OAuthTokenVerifier` contract, with cache |
| `mcpServer.js` | *modify* — wiring only: middleware chain, PRM routes, deletions, startup checks, scope check in `CallTool` |
| `scripts/probe-propelauth.mjs` | *new* — the Q1–Q8 probe, run once against the live tenant |
| `test/scopes.test.js`, `test/protectedResource.test.js`, `test/repliersKey.test.js`, `test/oauthVerifier.test.js` | *new* — pure unit suites |
| `test/httpOAuthDiscovery.test.js` | *rewrite* — asserts the AS documents are gone and PRM is right |
| `test/httpToolScopes.test.js` | *new* — write tool refused without `mcp:write` |
| `test/helpers/hostedMcpServer.js` | *modify* — fake introspection endpoint, new env |
| `CLAUDE.md`, `docs/oauth21/status.md` | *modify / new* — env table, resume point |

---

# Phase A — buildable now, no PropelAuth dependency

### Task 0: Branch

- [ ] **Step 1: Branch from the unmerged discovery fix, not from main**

```sh
git checkout fix/mcp-oauth-discovery
git checkout -b feat/oauth21-resource-server
```

`86b8e6a` is undeployed but its protected-resource metadata is the starting point for Task 2 and
Task 6, and the endpoints it repaired are the ones Task 6 deletes. Branching from it means the
deletions read as deletions in review rather than as a rewrite of code nobody merged.

- [ ] **Step 2: Confirm the working tree is clean and the suite is green before changing anything**

Run: `git status --short && npm test`
Expected: no output from `git status`, all suites pass.

---

### Task 1: Scope vocabulary and tool mapping

**Files:**
- Create: `lib/scopes.js`
- Test: `test/scopes.test.js`

**Interfaces:**
- Consumes: `toolAnnotations` from `lib/tools.js`
- Produces: `SCOPE_READ`, `SCOPE_WRITE` (strings), `requiredScope(toolName) -> string`

- [ ] **Step 1: Write the failing test**

```js
// test/scopes.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { SCOPE_READ, SCOPE_WRITE, requiredScope } from "../lib/scopes.js";

test("read-only tools need only the read scope", () => {
  assert.equal(requiredScope("Search_Listings"), SCOPE_READ);
  assert.equal(requiredScope("get-client"), SCOPE_READ);
  assert.equal(requiredScope("Market_Statistics"), SCOPE_READ);
  assert.equal(requiredScope("refine-search"), SCOPE_READ);
  assert.equal(requiredScope("Lookup_Possible_Values"), SCOPE_READ);
});

test("mutating tools need the write scope", () => {
  assert.equal(requiredScope("delete-client"), SCOPE_WRITE);
  assert.equal(requiredScope("create-agent"), SCOPE_WRITE);
  assert.equal(requiredScope("update-saved-search"), SCOPE_WRITE);
  assert.equal(requiredScope("send-feedback"), SCOPE_WRITE);
});

// The roster is regenerated from openapi.json, so a tool can appear that matches no
// annotation rule. It must not silently become readable-and-writable.
test("a tool matching no annotation rule fails closed", () => {
  assert.equal(requiredScope("frobnicate-listings"), SCOPE_WRITE);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/scopes.test.js`
Expected: FAIL — `Cannot find module '../lib/scopes.js'`

- [ ] **Step 3: Write the implementation**

```js
// lib/scopes.js
import { toolAnnotations } from './tools.js';

/**
 * The two scopes this server understands. They are values configured in the PropelAuth MCP
 * dashboard, so they live in exactly one place: if that dashboard cannot hold these names
 * (docs/oauth21/design.md Q9), only these two constants change.
 */
export const SCOPE_READ = 'mcp:read';
export const SCOPE_WRITE = 'mcp:write';

/**
 * The scope a tool call requires, derived from the readOnlyHint the roster already publishes.
 * That hint is keyed on the tool name, so the mapping survives `npm run generate` without any
 * per-tool marking. Fail-closed: a tool matching no annotation rule is treated as a writer.
 */
export function requiredScope(toolName) {
  return toolAnnotations(toolName)?.readOnlyHint === true ? SCOPE_READ : SCOPE_WRITE;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test test/scopes.test.js`
Expected: PASS, 3 tests

- [ ] **Step 5: Prepare the commit**

```sh
git add lib/scopes.js test/scopes.test.js
```

Message: `feat(oauth21): derive per-tool scope requirements from the existing annotations`

---

### Task 2: Resource identity and protected-resource metadata

**Files:**
- Create: `lib/protectedResource.js`
- Test: `test/protectedResource.test.js`

**Interfaces:**
- Consumes: `SCOPE_READ`, `SCOPE_WRITE` from Task 1
- Produces:
  - `canonicalOrigin(env) -> string` (throws if `MCP_PUBLIC_URL` is unset)
  - `allowedAudiences(env) -> Set<string>`
  - `authorizationServer(env) -> string`
  - `resourceUri(resourcePath, env) -> string`
  - `protectedResourceDocument(resourcePath, env) -> object`
  - `resourceMetadataUrl(resourcePath, env) -> string`
  - `resourcePath` is the literal `'/mcp'` or anything else meaning the root.

- [ ] **Step 1: Write the failing test**

```js
// test/protectedResource.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedAudiences,
  authorizationServer,
  canonicalOrigin,
  protectedResourceDocument,
  resourceMetadataUrl,
} from "../lib/protectedResource.js";

const env = {
  MCP_PUBLIC_URL: "https://mcp.repliers.io/",
  OAUTH_BASE_URL: "https://auth.repliers.com",
};

test("the canonical origin is normalised and comes from configuration", () => {
  assert.equal(canonicalOrigin(env), "https://mcp.repliers.io");
});

// Audience validation must never compare two caller-controlled values, so an unset
// MCP_PUBLIC_URL is a startup failure rather than a fallback to the Host header.
test("an unset MCP_PUBLIC_URL is fatal, not defaulted", () => {
  assert.throws(() => canonicalOrigin({}), /MCP_PUBLIC_URL/);
});

test("both paths the server answers on are accepted audiences", () => {
  const audiences = allowedAudiences(env);
  assert.ok(audiences.has("https://mcp.repliers.io"));
  assert.ok(audiences.has("https://mcp.repliers.io/mcp"));
  assert.equal(audiences.has("https://evil.example/mcp"), false);
});

test("the authorization server defaults to PropelAuth's MCP subsystem", () => {
  assert.equal(authorizationServer(env), "https://auth.repliers.com/oauth/2.1");
  assert.equal(
    authorizationServer({ ...env, OAUTH_MCP_ISSUER: "https://elsewhere.test/as" }),
    "https://elsewhere.test/as"
  );
});

test("each path gets its own document naming its own resource", () => {
  const root = protectedResourceDocument("/", env);
  const mcp = protectedResourceDocument("/mcp", env);
  assert.equal(root.resource, "https://mcp.repliers.io");
  assert.equal(mcp.resource, "https://mcp.repliers.io/mcp");
  assert.deepEqual(mcp.authorization_servers, ["https://auth.repliers.com/oauth/2.1"]);
  assert.deepEqual(mcp.scopes_supported, ["mcp:read", "mcp:write"]);
  assert.deepEqual(mcp.bearer_methods_supported, ["header"]);
});

// RFC 9728 §3.1: the document describing /mcp lives one path segment deep.
test("metadata URLs follow the resource path", () => {
  assert.equal(
    resourceMetadataUrl("/", env),
    "https://mcp.repliers.io/.well-known/oauth-protected-resource"
  );
  assert.equal(
    resourceMetadataUrl("/mcp", env),
    "https://mcp.repliers.io/.well-known/oauth-protected-resource/mcp"
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/protectedResource.test.js`
Expected: FAIL — `Cannot find module '../lib/protectedResource.js'`

- [ ] **Step 3: Write the implementation**

```js
// lib/protectedResource.js
import { SCOPE_READ, SCOPE_WRITE } from './scopes.js';

const stripTrailingSlash = (value) => String(value).replace(/\/+$/, '');

/**
 * The identity of this resource server, taken from configuration rather than from whatever a
 * caller put in the Host header.
 *
 * Metadata may be derived from the request — the client compares the answer against the URL it
 * just asked for, so a spoofed value only invalidates the spoofer's own copy. Audience
 * validation may not: an attacker holding a token for their own resource would send a matching
 * Host and put both sides of the comparison under their control. See design.md §4.3.
 */
export function canonicalOrigin(env = process.env) {
  const raw = env.MCP_PUBLIC_URL;
  if (!raw) {
    throw new Error(
      'MCP_PUBLIC_URL must be set in hosted mode: audience validation cannot use a caller-supplied origin'
    );
  }
  return stripTrailingSlash(raw);
}

/** Every URI a token may legitimately name: this server answers on both paths. */
export function allowedAudiences(env = process.env) {
  const origin = canonicalOrigin(env);
  return new Set([origin, `${origin}/mcp`]);
}

export function authorizationServer(env = process.env) {
  if (env.OAUTH_MCP_ISSUER) return stripTrailingSlash(env.OAUTH_MCP_ISSUER);
  return `${stripTrailingSlash(env.OAUTH_BASE_URL || '')}/oauth/2.1`;
}

export function resourceUri(resourcePath, env = process.env) {
  const origin = canonicalOrigin(env);
  return resourcePath === '/mcp' ? `${origin}/mcp` : origin;
}

export function protectedResourceDocument(resourcePath, env = process.env) {
  return {
    resource: resourceUri(resourcePath, env),
    authorization_servers: [authorizationServer(env)],
    scopes_supported: [SCOPE_READ, SCOPE_WRITE],
    bearer_methods_supported: ['header'],
    resource_name: 'Repliers MCP Server',
  };
}

/** RFC 9728 §3.1 derives the address from the resource path. */
export function resourceMetadataUrl(resourcePath, env = process.env) {
  const suffix = resourcePath === '/mcp' ? '/mcp' : '';
  return `${canonicalOrigin(env)}/.well-known/oauth-protected-resource${suffix}`;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test test/protectedResource.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Prepare the commit**

```sh
git add lib/protectedResource.js test/protectedResource.test.js
```

Message: `feat(oauth21): take the resource server's identity from configuration`

---

### Task 3: Repliers API key resolution

**Files:**
- Create: `lib/repliersKey.js`
- Test: `test/repliersKey.test.js`

**Interfaces:**
- Produces: `createKeyResolver({ backendBaseUrl, apiKey, fetchImpl }) -> resolve(userId)`
- `resolve` returns `{ key: string|null, lookupFailed: boolean, reason: string|null }`.
  `lookupFailed` distinguishes "we could not ask" from "the account has no key" — different
  people fix those, and they map to different HTTP statuses in Task 7.

- [ ] **Step 1: Write the failing test**

```js
// test/repliersKey.test.js
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

test("a rejected backend call is a lookup failure", async () => {
  const resolve = resolverWith(async () => ({ ok: false, status: 401 }));
  const result = await resolve("user-alice");
  assert.equal(result.lookupFailed, true);
  assert.match(result.reason, /401/);
});

test("a thrown fetch is a lookup failure, not a crash", async () => {
  const resolve = resolverWith(async () => {
    throw new Error("ECONNREFUSED");
  });
  const result = await resolve("user-alice");
  assert.equal(result.lookupFailed, true);
  assert.match(result.reason, /ECONNREFUSED/);
});

test("a missing PROPELAUTH_API_KEY is a lookup failure named as such", async () => {
  const resolve = createKeyResolver({ backendBaseUrl: "https://auth.test", apiKey: "" });
  const result = await resolve("user-alice");
  assert.equal(result.lookupFailed, true);
  assert.match(result.reason, /PROPELAUTH_API_KEY/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/repliersKey.test.js`
Expected: FAIL — `Cannot find module '../lib/repliersKey.js'`

- [ ] **Step 3: Write the implementation**

```js
// lib/repliersKey.js

/**
 * Resolves the Repliers API key a caller's tool calls are served with.
 *
 * Isolated in its own module because it rests on one unverified assumption: that `sub` in a
 * PropelAuth MCP introspection response is the same user id the backend user API accepts
 * (docs/oauth21/design.md Q5). If that turns out to be false, this file is the only one that
 * changes — see plan Task 12.
 */
export function createKeyResolver({ backendBaseUrl, apiKey, fetchImpl = fetch }) {
  return async function resolve(userId) {
    if (!apiKey) {
      return { key: null, lookupFailed: true, reason: 'PROPELAUTH_API_KEY is not set' };
    }
    if (!userId) {
      return { key: null, lookupFailed: true, reason: 'introspection response carried no sub' };
    }

    try {
      const response = await fetchImpl(`${backendBaseUrl}/api/backend/v1/user/${userId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        return {
          key: null,
          lookupFailed: true,
          reason: `backend user API returned ${response.status}`,
        };
      }
      const user = await response.json();
      const key = user?.metadata?.repliers_api_key ?? null;
      return {
        key,
        lookupFailed: false,
        reason: key ? null : 'account has no repliers_api_key in PropelAuth metadata',
      };
    } catch (error) {
      return { key: null, lookupFailed: true, reason: error.message };
    }
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test test/repliersKey.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Prepare the commit**

```sh
git add lib/repliersKey.js test/repliersKey.test.js
```

Message: `feat(oauth21): isolate Repliers key lookup in its own module`

---

### Task 4: Introspection verifier

**Files:**
- Create: `lib/oauthVerifier.js`
- Test: `test/oauthVerifier.test.js`

**Interfaces:**
- Consumes: `createKeyResolver` (Task 3) via the injected `resolveApiKey` callback; `InvalidTokenError` and `ServerError` from `@modelcontextprotocol/sdk/server/auth/errors.js`
- Produces: `createIntrospectionVerifier(options) -> { verifyAccessToken(token) }` where `options` is
  `{ introspectionEndpoint, clientId, clientSecret, audiences: Set<string>, resolveApiKey, requireAudience = true, cacheTtlMs = 60000, fetchImpl = fetch, now = () => Date.now() }`
- `verifyAccessToken` resolves to the SDK's `AuthInfo`:
  `{ token, clientId, scopes: string[], expiresAt: number, resource?: URL, extra: { userId, orgId, repliersApiKey, keyLookupFailed, keyReason } }`

- [ ] **Step 1: Write the failing test**

```js
// test/oauthVerifier.test.js
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/oauthVerifier.test.js`
Expected: FAIL — `Cannot find module '../lib/oauthVerifier.js'`

- [ ] **Step 3: Write the implementation**

```js
// lib/oauthVerifier.js
import { createHash } from 'node:crypto';
import {
  InvalidTokenError,
  ServerError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';

const cacheKey = (token) => createHash('sha256').update(token).digest('hex');
const normalise = (value) => String(value).replace(/\/+$/, '');

/**
 * RFC 7662 introspection against PropelAuth's MCP authorization server, wrapped in the SDK's
 * OAuthTokenVerifier contract so that requireBearerAuth owns the HTTP semantics: header
 * parsing, expiry, 401 vs 403, and the WWW-Authenticate challenge.
 *
 * Audience handling reads `resource` first and `aud` second because PropelAuth's own
 * documentation disagrees with itself about which one it populates (design.md Q6).
 */
export function createIntrospectionVerifier({
  introspectionEndpoint,
  clientId,
  clientSecret,
  audiences,
  resolveApiKey,
  requireAudience = true,
  cacheTtlMs = 60_000,
  fetchImpl = fetch,
  now = () => Date.now(),
}) {
  const cache = new Map();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  async function introspect(token) {
    let response;
    try {
      response = await fetchImpl(introspectionEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token, token_type_hint: 'access_token' }).toString(),
      });
    } catch (error) {
      throw new ServerError(`Introspection endpoint unreachable: ${error.message}`);
    }
    if (!response.ok) {
      throw new ServerError(`Introspection endpoint returned ${response.status}`);
    }
    return response.json();
  }

  function audiencesOf(claims) {
    const raw = claims.resource ?? claims.aud;
    if (raw === undefined || raw === null) return [];
    return (Array.isArray(raw) ? raw : [raw]).map(normalise);
  }

  return {
    async verifyAccessToken(token) {
      const key = cacheKey(token);
      const hit = cache.get(key);
      if (hit && hit.until > now()) return hit.authInfo;

      const claims = await introspect(token);
      if (claims.active !== true) throw new InvalidTokenError('Token is not active');

      const presented = audiencesOf(claims);
      const matched = presented.find((value) => audiences.has(value));
      if (!matched) {
        const named = presented.join(', ') || '(absent)';
        if (requireAudience) {
          throw new InvalidTokenError(`Token audience ${named} does not name this server`);
        }
        console.error(`[WARN] Accepting a token whose audience does not name us: ${named}`);
      }

      // requireBearerAuth rejects any AuthInfo without a numeric expiresAt, which would look
      // like a blanket authentication failure. Say what actually happened.
      if (typeof claims.exp !== 'number') {
        throw new ServerError(
          'Introspection response carries no numeric exp; token expiry cannot be enforced'
        );
      }

      const { key: repliersApiKey, lookupFailed, reason } = await resolveApiKey(claims.sub);

      const authInfo = {
        token,
        clientId: claims.client_id ?? 'unknown',
        scopes:
          typeof claims.scope === 'string' ? claims.scope.split(' ').filter(Boolean) : [],
        expiresAt: claims.exp,
        resource: matched ? new URL(matched) : undefined,
        extra: {
          userId: claims.sub,
          orgId: claims.org_id,
          repliersApiKey,
          keyLookupFailed: lookupFailed,
          keyReason: reason,
        },
      };

      const ttl = Math.min(cacheTtlMs, Math.max(0, claims.exp * 1000 - now()));
      if (ttl > 0) cache.set(key, { until: now() + ttl, authInfo });
      return authInfo;
    },
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test test/oauthVerifier.test.js`
Expected: PASS, 9 tests

- [ ] **Step 5: Prepare the commit**

```sh
git add lib/oauthVerifier.js test/oauthVerifier.test.js
```

Message: `feat(oauth21): validate tokens by introspection with audience binding`

---

### Task 5: Teach the test harness to speak introspection

**Files:**
- Modify: `test/helpers/hostedMcpServer.js`
- Modify (call sites only): `test/httpKeyProvisioning.test.js`, `test/httpPerRequestApiKey.test.js`, `test/httpSessionOwnership.test.js`, `test/httpOAuthDiscovery.test.js`

**Interfaces:**
- Produces: `startFakePropelAuth(users)` now also serves `POST /oauth/2.1/introspect` and gains
  `setAudience(uri)`. `startMcpServer({ propelAuth, repliersApiPort, env })` takes the fake
  object instead of `propelAuthPort`, and sets `MCP_PUBLIC_URL` plus the introspection
  credentials before spawning.
- `defaultUsers()` entries gain `scope` (default `"mcp:read mcp:write"`).

- [ ] **Step 1: Write the failing test**

Add to `test/helpers/` nothing yet — assert the harness change from a new suite that will
also serve Task 6. Create `test/httpAudienceValidation.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { INITIALIZE, mcpFetch, startFakePropelAuth, startMcpServer } from "./helpers/hostedMcpServer.js";

// A token that introspects as perfectly active but was minted for another resource on the
// same tenant must not open this server. This is the security property the whole migration
// exists to establish; before it, any PropelAuth token spent somebody else's Repliers key.
test("a token issued for a different resource is refused", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/httpAudienceValidation.test.js`
Expected: FAIL — `propelAuth.setAudience is not a function` (and the server still validates via `/oauth/userinfo`)

- [ ] **Step 3: Update the harness**

In `test/helpers/hostedMcpServer.js`:

```js
export function defaultUsers() {
  return {
    "alice-token": {
      sub: "user-alice",
      email: "alice@example.test",
      key: "KEY-ALICE-1",
      scope: "mcp:read mcp:write",
    },
    "bob-token": {
      sub: "user-bob",
      email: "bob@example.test",
      key: "KEY-BOB-1",
      scope: "mcp:read mcp:write",
    },
    // Authenticates fine, but was never provisioned with a Repliers key.
    "keyless-token": {
      sub: "user-keyless",
      email: "keyless@example.test",
      key: null,
      scope: "mcp:read mcp:write",
    },
    // Can reach the server, but may not call anything that mutates.
    "readonly-token": {
      sub: "user-readonly",
      email: "readonly@example.test",
      key: "KEY-READONLY-1",
      scope: "mcp:read",
    },
  };
}
```

Inside `startFakePropelAuth`, replace the `/oauth/userinfo` branch with an introspection
branch and keep the backend user API branch untouched:

```js
  // `audience` is what the fake mints tokens for. startMcpServer points it at the server it
  // just allocated a port for; a suite can aim it elsewhere to forge a foreign token.
  const state = { rejectBackend: false, audience: "https://unset.invalid/mcp" };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/oauth/2.1/introspect" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const token = new URLSearchParams(body).get("token");
        const user = users[token];
        if (!user) {
          return res
            .writeHead(200, { "content-type": "application/json" })
            .end(JSON.stringify({ active: false }));
        }
        return res.writeHead(200, { "content-type": "application/json" }).end(
          JSON.stringify({
            active: true,
            sub: user.sub,
            client_id: "fake-mcp-client",
            scope: user.scope,
            aud: state.audience,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
          })
        );
      });
      return;
    }

    const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
    const backend = url.pathname.match(/^\/api\/backend\/v1\/user\/(.+)$/);
    if (backend) {
      // ... existing body unchanged ...
    }

    res.writeHead(404).end("{}");
  });
```

Add to the returned object:

```js
    setAudience(uri) {
      state.audience = uri;
    },
```

Change `startMcpServer` to take the fake and configure the new variables:

```js
export async function startMcpServer({ propelAuth, propelAuthPort, repliersApiPort, env = {} }) {
  const port = await freePort();
  const oauthBase = `http://127.0.0.1:${propelAuth?.port ?? propelAuthPort}`;
  const publicUrl = `http://127.0.0.1:${port}`;
  propelAuth?.setAudience(`${publicUrl}/mcp`);

  const child = spawn(process.execPath, ["mcpServer.js", "--http"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      REPLIERS_API_KEY: "",
      REPLIERS_API_BASE_URL: repliersApiPort ? `http://127.0.0.1:${repliersApiPort}` : "",
      PORT: String(port),
      MCP_PUBLIC_URL: publicUrl,
      OAUTH_BASE_URL: oauthBase,
      OAUTH_INTROSPECTION_ENDPOINT: `${oauthBase}/oauth/2.1/introspect`,
      PROPELAUTH_MCP_INTROSPECT_CLIENT_ID: "introspect-id",
      PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET: "introspect-secret",
      PROPELAUTH_API_KEY: "propelauth-test-key",
      // Last word, so a suite can flip the server into self-hosted mode.
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // ... readiness loop unchanged ...
```

Then update the four existing suites' call sites from
`startMcpServer({ propelAuthPort: propelAuth.port })` to `startMcpServer({ propelAuth })`.

- [ ] **Step 4: Confirm the harness compiles and the new suite still fails for the right reason**

Run: `node --test test/httpAudienceValidation.test.js`
Expected: FAIL — but now because the server has no audience validation yet (both tests return the same status), not because of a missing function.

- [ ] **Step 5: Prepare the commit**

```sh
git add test/helpers/hostedMcpServer.js test/httpAudienceValidation.test.js test/httpKeyProvisioning.test.js test/httpPerRequestApiKey.test.js test/httpSessionOwnership.test.js test/httpOAuthDiscovery.test.js
```

Message: `test(oauth21): teach the hosted harness to mint introspectable tokens`

---

### Task 6: Wire the resource server and delete the impersonation

**Files:**
- Modify: `mcpServer.js:246-560` (the whole `isSSE` branch)
- Rewrite: `test/httpOAuthDiscovery.test.js`
- Test: `test/httpAudienceValidation.test.js` (from Task 5) must now pass

**Interfaces:**
- Consumes: everything from Tasks 1–4
- Produces: `requireRepliersKey` express middleware; the extracted `handleMcpRequest(req, res)`
  used by both routes

- [ ] **Step 1: Rewrite the discovery test**

Replace `test/httpOAuthDiscovery.test.js` wholesale:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mcpFetch, startFakePropelAuth, startMcpServer, INITIALIZE } from "./helpers/hostedMcpServer.js";

/**
 * This server is a resource server. Every document that claimed otherwise is gone: publishing
 * authorization-server metadata on our own origin is what made Codex discard it (RFC 8414 §3.3),
 * and /oauth/register never registered anything — it handed out one pre-existing PropelAuth
 * client whose redirect URIs are fixed in that dashboard.
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

  await t.test("the /mcp document names the /mcp resource", async () => {
    const doc = await (await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`)).json();
    assert.equal(doc.resource, `${origin}/mcp`);
    assert.deepEqual(doc.authorization_servers, [upstream]);
    assert.deepEqual(doc.scopes_supported, ["mcp:read", "mcp:write"]);
  });

  await t.test("the root document names the root resource", async () => {
    const doc = await (await fetch(`${origin}/.well-known/oauth-protected-resource`)).json();
    assert.equal(doc.resource, origin);
  });
});

/**
 * RFC 9728 §5.1 / MCP authorization: an unauthenticated request must come back with a pointer
 * to the metadata, or a client has no way to learn where to log in.
 */
test("an unauthenticated request is told where to authenticate", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const res = await mcpFetch(mcp.port, { body: INITIALIZE });
  await res.text();

  assert.equal(res.status, 401);
  const challenge = res.headers.get("www-authenticate") ?? "";
  assert.match(
    challenge,
    new RegExp(`resource_metadata="http://127\\.0\\.0\\.1:${mcp.port}/\\.well-known/oauth-protected-resource/mcp"`)
  );
  assert.match(challenge, /scope="mcp:read"/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/httpOAuthDiscovery.test.js test/httpAudienceValidation.test.js`
Expected: FAIL — the old endpoints still answer 200, and the 401 carries no `scope`.

- [ ] **Step 3: Rewrite the server wiring**

In `mcpServer.js`, add to the imports:

```js
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createIntrospectionVerifier } from "./lib/oauthVerifier.js";
import { createKeyResolver } from "./lib/repliersKey.js";
import { SCOPE_READ, requiredScope } from "./lib/scopes.js";
import {
  allowedAudiences,
  protectedResourceDocument,
  resourceMetadataUrl,
} from "./lib/protectedResource.js";
```

Delete outright:
- the whole `verifyOAuthToken` function (`mcpServer.js:255-370`)
- the `/.well-known/openid-configuration` route
- the `/.well-known/oauth-authorization-server` route
- the `registeredRedirectUris` constant and the `/oauth/register` route
- `publicOrigin`, `resourceMetadataUrl` and `bearerChallenge` (the local copies — the module
  versions replace them)

Inside the `isSSE` branch, after `const sessions = {}`:

```js
      // Hosted mode has no fallback key. A server that starts without the credentials it needs
      // would answer 500 to every request instead of failing where the cause is visible.
      if (!selfHosted) {
        for (const name of [
          "MCP_PUBLIC_URL",
          "OAUTH_BASE_URL",
          "PROPELAUTH_MCP_INTROSPECT_CLIENT_ID",
          "PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET",
        ]) {
          if (!process.env[name]) {
            console.error(`[FATAL] ${name} is required in hosted mode`);
            process.exit(1);
          }
        }
      }

      const verifier = selfHosted
        ? null
        : createIntrospectionVerifier({
            introspectionEndpoint:
              process.env.OAUTH_INTROSPECTION_ENDPOINT ||
              `${process.env.OAUTH_BASE_URL.replace(/\/+$/, "")}/oauth/2.1/introspect`,
            clientId: process.env.PROPELAUTH_MCP_INTROSPECT_CLIENT_ID,
            clientSecret: process.env.PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET,
            audiences: allowedAudiences(),
            requireAudience: process.env.OAUTH_REQUIRE_AUDIENCE !== "false",
            cacheTtlMs: Number(process.env.OAUTH_INTROSPECTION_CACHE_TTL_MS ?? 60_000),
            resolveApiKey: createKeyResolver({
              backendBaseUrl: process.env.OAUTH_BASE_URL,
              apiKey: process.env.PROPELAUTH_API_KEY,
            }),
          });

      /**
       * The provisioning gate, kept out of the verifier so that "we could not ask PropelAuth"
       * and "this account has no key" stay distinguishable. Both would otherwise collapse into
       * a 500, and they land on different people.
       */
      function requireRepliersKey(req, res, next) {
        const { repliersApiKey, keyLookupFailed, keyReason, userId } = req.auth?.extra ?? {};
        if (repliersApiKey) return next();
        if (keyLookupFailed) {
          console.error(`[ERROR] Refusing ${userId}: ${keyReason}`);
          return res.status(503).json({
            error: "key_lookup_failed",
            message:
              "Could not read this account's Repliers API key from PropelAuth. This is a server-side configuration problem, not a problem with the request.",
          });
        }
        console.error(`[ERROR] Refusing ${userId}: ${keyReason}`);
        return res.status(403).json({
          error: "account_not_provisioned",
          message:
            "This account has no Repliers API key configured. Contact Repliers support to have it enabled for MCP access.",
        });
      }
```

Replace the protected-resource routes with the module-backed pair:

```js
      if (!selfHosted) {
        app.get("/.well-known/oauth-protected-resource", (_req, res) => {
          res.status(200).json(protectedResourceDocument("/"));
        });
        app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
          res.status(200).json(protectedResourceDocument("/mcp"));
        });
      }
```

Extract the existing `app.all(["/", "/mcp"], ...)` handler body (`mcpServer.js:562-620`) verbatim
into a named function `async function handleMcpRequest(req, res) { ... }`. Two identifiers change
inside it and nothing else: the session-ownership comparison `session.userId !== req.user.id`
becomes `session.userId !== req.auth.extra.userId`, and `const sessionUserId = selfHosted ? null :
req.user.id` becomes `req.auth.extra.userId`. Both appear once. Then register the two routes
separately, so each 401 points at its own metadata document:

```js
      const authChain = (resourcePath) =>
        selfHosted
          ? []
          : [
              requireBearerAuth({
                verifier,
                requiredScopes: [SCOPE_READ],
                resourceMetadataUrl: resourceMetadataUrl(resourcePath),
              }),
              requireRepliersKey,
            ];

      app.all("/mcp", ...authChain("/mcp"), handleMcpRequest);
      app.all("/", ...authChain("/"), handleMcpRequest);
```

Finally update the startup banner: drop the two `.well-known` lines that no longer exist and
add `GET /.well-known/oauth-protected-resource[/mcp]`.

> **Known regression, accepted.** The hand-written `bearerChallenge` omitted `error=` when no
> credentials were presented at all, because RFC 6750 §3.1 calls that an unauthenticated request
> rather than a failed authentication. `requireBearerAuth` always emits `error="invalid_token"`.
> No client distinguishes the two, and reproducing the nuance would mean forking the middleware —
> the exact hand-maintained spec code this task exists to delete. Do not add it back.

- [ ] **Step 4: Run the HTTP suites**

Run: `node --test test/httpOAuthDiscovery.test.js test/httpAudienceValidation.test.js test/httpSessionOwnership.test.js test/httpPerRequestApiKey.test.js test/httpKeyProvisioning.test.js`
Expected: PASS. If session ownership fails, the `req.user.id` → `req.auth.extra.userId` rename was missed in one of its two places.

- [ ] **Step 5: Prepare the commit**

```sh
git add mcpServer.js test/httpOAuthDiscovery.test.js
```

Message:

```
feat(oauth21)!: become a resource server and stop impersonating an authorization server

Token validation moves from PropelAuth's /userinfo to RFC 7662 introspection against its
MCP authorization server, and the audience is now checked against a configured canonical
URI rather than assumed. A token minted for another resource on the same tenant no longer
opens this server.

/oauth/register, /.well-known/oauth-authorization-server and
/.well-known/openid-configuration are deleted. The first registered nothing; the other two
described a server we are not.

BREAKING CHANGE: clients holding tokens from the legacy OIDC provider must re-authorize.
```

---

### Task 7: Enforce the write scope on tool calls

**Files:**
- Modify: `mcpServer.js:143-160` (inside the `CallToolRequestSchema` handler)
- Test: `test/httpToolScopes.test.js`

**Interfaces:**
- Consumes: `requiredScope`, `SCOPE_WRITE` (Task 1); the `readonly-token` fixture (Task 5)

- [ ] **Step 1: Write the failing test**

```js
// test/httpToolScopes.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  callTool,
  openSession,
  startFakePropelAuth,
  startFakeRepliersApi,
  startMcpServer,
} from "./helpers/hostedMcpServer.js";

test("scopes gate mutating tools", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const repliers = await startFakeRepliersApi();
  const mcp = await startMcpServer({ propelAuth, repliersApiPort: repliers.port });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
    await repliers.close();
  });

  await t.test("a read-only token may search", async () => {
    const session = await openSession(mcp.port, "readonly-token");
    const { text } = await callTool(mcp.port, {
      token: "readonly-token",
      sessionId: session,
      name: "search-locations",
      args: {},
    });
    assert.doesNotMatch(text, /mcp:write/);
  });

  await t.test("a read-only token may not delete", async () => {
    const session = await openSession(mcp.port, "readonly-token");
    const { text } = await callTool(mcp.port, {
      token: "readonly-token",
      sessionId: session,
      name: "delete-client",
      args: { clientId: "1" },
    });
    assert.match(text, /mcp:write/);
  });

  await t.test("a full token may delete", async () => {
    const session = await openSession(mcp.port, "alice-token");
    const { text } = await callTool(mcp.port, {
      token: "alice-token",
      sessionId: session,
      name: "delete-client",
      args: { clientId: "1" },
    });
    assert.doesNotMatch(text, /mcp:write/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/httpToolScopes.test.js`
Expected: FAIL — the read-only token deletes happily.

- [ ] **Step 3: Add the check**

In `setupServerHandlers`, immediately after the `if (!tool)` guard:

```js
    // Scope enforcement lives here rather than in the HTTP middleware because only here is the
    // tool name known. `scopes` is absent in stdio and self-hosted mode, where there is no
    // per-user identity and the environment key is the only authority.
    const scopes = extra?.authInfo?.scopes;
    if (scopes) {
      const needed = requiredScope(toolName);
      if (!scopes.includes(needed)) {
        console.error(`[ERROR] ${toolName} needs ${needed}, token has: ${scopes.join(" ") || "(none)"}`);
        throw new McpError(
          ErrorCode.InvalidRequest,
          `The tool ${toolName} requires the ${needed} scope, which this authorization does not carry.`
        );
      }
    }
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test test/httpToolScopes.test.js`
Expected: PASS, 3 subtests

- [ ] **Step 5: Prepare the commit**

```sh
git add mcpServer.js test/httpToolScopes.test.js
```

Message: `feat(oauth21): require mcp:write for tools that mutate`

---

### Task 8: Configuration cleanup and documentation

**Files:**
- Modify: `mcpServer.js:56-90` (the env preflight)
- Modify: `CLAUDE.md` (Environment table)
- Create: `docs/oauth21/status.md`

- [ ] **Step 1: Replace the OAuth preflight**

The `OAUTH_ENV` array names three variables that no longer exist. Replace the block at
`mcpServer.js:56-90` with:

```js
// Verify required environment variables
const REQUIRED_ENV = [];

let missingVars = [];
REQUIRED_ENV.forEach((env) => {
  if (!process.env[env]) {
    console.error(`[FATAL] Missing required environment variable: ${env}`);
    missingVars.push(env);
  }
});

if (missingVars.length > 0) {
  console.error("[FATAL] Server cannot start without required variables");
  process.exit(1);
}
// Hosted-mode OAuth variables are checked inside the HTTP branch, where we know whether the
// server is hosted at all: a self-hosted deployment carries REPLIERS_API_KEY and needs none.
```

- [ ] **Step 2: Update the CLAUDE.md environment table**

Replace the `OAUTH_*, PROPELAUTH_API_KEY` row with:

```markdown
| `MCP_PUBLIC_URL` | Hosted only. The canonical URI of this server, e.g. `https://mcp.repliers.io`. Audience validation compares tokens against it, so it must not be derived from request headers. Startup fails without it |
| `OAUTH_BASE_URL` | Hosted only. PropelAuth auth URL, e.g. `https://auth.repliers.com` |
| `OAUTH_MCP_ISSUER` | Hosted only. The authorization server advertised in protected-resource metadata (default `${OAUTH_BASE_URL}/oauth/2.1`) |
| `OAUTH_INTROSPECTION_ENDPOINT` | Hosted only. Default `${OAUTH_BASE_URL}/oauth/2.1/introspect` |
| `PROPELAUTH_MCP_INTROSPECT_CLIENT_ID`, `..._SECRET` | Hosted only. Created in PropelAuth's MCP → Request Validation section. Startup fails without them |
| `PROPELAUTH_API_KEY` | Hosted only. Reads `repliers_api_key` from user metadata via the backend user API |
| `OAUTH_REQUIRE_AUDIENCE` | Escape hatch, default `true`. `false` accepts tokens whose audience does not name us — see docs/oauth21/design.md Q7 before using it |
| `OAUTH_INTROSPECTION_CACHE_TTL_MS` | Default `60000` |
```

- [ ] **Step 3: Write the status file**

```markdown
# OAuth 2.1 migration — status

**Phase A complete.** `lib/scopes.js`, `lib/protectedResource.js`, `lib/repliersKey.js` and
`lib/oauthVerifier.js` are implemented and green; `mcpServer.js` is a resource server; the
authorization-server impersonation is deleted. `npm test` passes offline.

**Blocked on the PropelAuth dashboard.** Nothing here has ever spoken to a real PropelAuth MCP
authorization server — the tenant still 404s on every `/oauth/2.1` address. See
[design.md §6](design.md) for the dashboard checklist.

**Resume point:** run `node scripts/probe-propelauth.mjs` (plan Task 11) the moment MCP Auth is
enabled, record its output here, then take the forks it selects (plan Tasks 12–15).

**Do not deploy before the probe passes.** Publishing protected-resource metadata makes clients
prefer PropelAuth's discovery over the shim that is now deleted; if that still 404s, the working
claude.ai connector breaks too.
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS, every suite.

- [ ] **Step 5: Prepare the commit**

```sh
git add mcpServer.js CLAUDE.md docs/oauth21/status.md
```

Message: `chore(oauth21): retire the legacy OAuth variables and document the new ones`

---

### Task 9: Write the probe script

**Files:**
- Create: `scripts/probe-propelauth.mjs`

This is written now and run later. It converts design.md §5 into a command whose output selects
the forks, so nobody has to remember what the answers meant.

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
// Answers the open questions in docs/oauth21/design.md §5 against a live PropelAuth tenant.
//
//   node scripts/probe-propelauth.mjs https://auth.repliers.com [access-token]
//
// Without a token it answers Q1-Q4 (metadata only). With one — obtained by logging in from any
// MCP client — it also answers Q5-Q8, which decide plan Tasks 12 and 13.

const [authUrl, token] = process.argv.slice(2);
if (!authUrl) {
  console.error("usage: probe-propelauth.mjs <auth-url> [access-token]");
  process.exit(2);
}

const base = authUrl.replace(/\/+$/, "");
const issuer = `${base}/oauth/2.1`;
const verdicts = [];

const say = (id, ok, detail) => {
  verdicts.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

async function status(url) {
  try {
    const res = await fetch(url);
    return { code: res.status, body: res.ok ? await res.json().catch(() => null) : null };
  } catch (error) {
    return { code: 0, body: null, error: error.message };
  }
}

// Q1: the address form clients actually try first.
const insertion = await status(`${base}/.well-known/oauth-authorization-server/oauth/2.1`);
const appended = await status(`${issuer}/.well-known/oauth-authorization-server`);
const oidcAppended = await status(`${issuer}/.well-known/openid-configuration`);
say(
  "Q1",
  insertion.code === 200,
  `path-insertion ${insertion.code}, appended ${appended.code}, oidc-appended ${oidcAppended.code}`
);

const metadata = insertion.body ?? appended.body ?? oidcAppended.body;
if (!metadata) {
  console.log("\nNo authorization server metadata anywhere. MCP Auth is not enabled — stop here.");
  process.exit(1);
}

say("Q2", Boolean(metadata.registration_endpoint), `registration_endpoint: ${metadata.registration_endpoint ?? "absent"}`);
say("Q3", Array.isArray(metadata.code_challenge_methods_supported), `code_challenge_methods_supported: ${JSON.stringify(metadata.code_challenge_methods_supported ?? null)}`);
say("Q4", (metadata.grant_types_supported ?? []).includes("refresh_token"), `grant_types_supported: ${JSON.stringify(metadata.grant_types_supported ?? null)}`);
console.log(`INFO  CIMD  client_id_metadata_document_supported: ${metadata.client_id_metadata_document_supported ?? "absent"}`);
console.log(`INFO  scopes  scopes_supported: ${JSON.stringify(metadata.scopes_supported ?? null)}   (Q9)`);

if (!token) {
  console.log("\nNo access token supplied — Q5-Q8 unanswered. Log in from an MCP client and rerun with the token.");
  process.exit(verdicts.some((v) => !v.ok) ? 1 : 0);
}

const introspectId = process.env.PROPELAUTH_MCP_INTROSPECT_CLIENT_ID;
const introspectSecret = process.env.PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET;
if (!introspectId || !introspectSecret) {
  console.error("\nSet PROPELAUTH_MCP_INTROSPECT_CLIENT_ID and _SECRET to answer Q5-Q8.");
  process.exit(2);
}

const introspection = await fetch(`${issuer}/introspect`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${introspectId}:${introspectSecret}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({ token, token_type_hint: "access_token" }).toString(),
});
const claims = await introspection.json();
console.log("\nIntrospection response:\n", JSON.stringify(claims, null, 2), "\n");

say("Q6", claims.aud !== undefined || claims.resource !== undefined, `aud: ${JSON.stringify(claims.aud ?? null)}, resource: ${JSON.stringify(claims.resource ?? null)}`);
say("Q7", Boolean(claims.aud ?? claims.resource), "audience present means the resource parameter was honoured");
say("Q8", claims.org_id !== undefined, `org_id: ${claims.org_id ?? "absent"}`);
say("exp", typeof claims.exp === "number", `exp: ${claims.exp ?? "absent"}`);

// Q5 is the one that can invalidate the design: is `sub` the id the backend user API accepts?
if (process.env.PROPELAUTH_API_KEY && claims.sub) {
  const user = await fetch(`${base}/api/backend/v1/user/${claims.sub}`, {
    headers: { Authorization: `Bearer ${process.env.PROPELAUTH_API_KEY}` },
  });
  const body = user.ok ? await user.json() : null;
  say("Q5", user.ok, `backend user API returned ${user.status}; repliers_api_key ${body?.metadata?.repliers_api_key ? "found" : "absent"}`);
} else {
  console.log("INFO  Q5  set PROPELAUTH_API_KEY to check the sub → backend user API assumption");
}

process.exit(verdicts.some((v) => !v.ok) ? 1 : 0);
```

- [ ] **Step 2: Check it runs and reports the current, pre-enablement truth**

Run: `node scripts/probe-propelauth.mjs https://auth.repliers.com`
Expected today: `FAIL Q1 … 404, 404, 404` then `No authorization server metadata anywhere. MCP Auth is not enabled — stop here.` and exit code 1. That is the correct answer for 2026-09-08 and proves the probe works.

- [ ] **Step 3: Prepare the commit**

```sh
git add scripts/probe-propelauth.mjs
```

Message: `chore(oauth21): add the PropelAuth readiness probe`

---

# Gate G1 — run the probe

### Task 10: Verify the tenant and record the answers

Blocked until the dashboard owner completes design.md §6.

- [ ] Run `node scripts/probe-propelauth.mjs https://auth.repliers.com`
- [ ] Log in once from Claude Code against a staging deployment, capture the access token
- [ ] Run the probe again with the token and the three PropelAuth secrets in the environment
- [ ] Paste the full output into `docs/oauth21/status.md`
- [ ] **Fork E stop condition:** if Q1, Q2, Q3 or `exp` failed, stop and escalate. Do not deploy.
- [ ] Select the forks below from the remaining verdicts

---

# Phase B — the forks

Take only the ones Task 10 selects.

### Task 11: Fork Q9 — the dashboard cannot hold `mcp:read` / `mcp:write`

Selected when the probe's `INFO scopes` line shows a fixed vocabulary that excludes those names.

**Files:** Modify `lib/scopes.js:6-7`, `test/scopes.test.js`, `test/helpers/hostedMcpServer.js`

- [ ] **Step 1: Change the two constants to the names the dashboard accepts**

```js
export const SCOPE_READ = 'read:mcp';   // whatever the probe reported
export const SCOPE_WRITE = 'write:mcp';
```

- [ ] **Step 2: Update the two literal expectations**

`test/protectedResource.test.js` asserts `["mcp:read", "mcp:write"]` in `scopes_supported`, and
`defaultUsers()` in the harness mints `scope: "mcp:read mcp:write"`. Change both to the new names.

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Prepare the commit**

```sh
git add lib/scopes.js test/scopes.test.js test/protectedResource.test.js test/helpers/hostedMcpServer.js
```

Message: `fix(oauth21): use the scope names PropelAuth actually issues`

---

### Task 12: Fork Q5 — `sub` is not the backend user id

Selected when the probe reports `FAIL Q5`. This is the fork that would otherwise be discovered
on rollout day, with nobody able to get a key.

**Files:** Modify `lib/repliersKey.js`, `test/repliersKey.test.js`

**Interfaces:** `createKeyResolver` gains an optional `email` argument:
`resolve(userId, email)`. `lib/oauthVerifier.js` already has `claims.username` available — pass
it through as the second argument in the `resolveApiKey` call.

> **Confirm the endpoint before writing the test.** The code below assumes PropelAuth's
> by-email lookup is `GET /api/backend/v1/user/email?email=<address>`. That path is written from
> the shape of the by-id endpoint we already use, not from a verified call. Check it against
> PropelAuth's backend API reference and correct both the implementation and the test's
> `assert.match(seen[1], ...)` if it differs. If PropelAuth offers no by-email lookup at all,
> the fallback becomes org metadata via `claims.org_id` instead, and this task needs rewriting
> rather than adapting.

- [ ] **Step 1: Write the failing test**

```js
test("falls back to email lookup when the user id is not accepted", async () => {
  const seen = [];
  const resolve = createKeyResolver({
    backendBaseUrl: "https://auth.test",
    apiKey: "propelauth-key",
    fetchImpl: async (url) => {
      seen.push(url);
      if (url.includes("/user/user-alice")) return { ok: false, status: 404 };
      return { ok: true, json: async () => ({ metadata: { repliers_api_key: "KEY-1" } }) };
    },
  });

  const result = await resolve("user-alice", "alice@example.test");

  assert.equal(result.key, "KEY-1");
  assert.equal(result.lookupFailed, false);
  assert.match(seen[1], /email=alice%40example\.test/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/repliersKey.test.js`
Expected: FAIL — only one URL is fetched.

- [ ] **Step 3: Add the fallback**

In `lib/repliersKey.js`, wrap the existing body in a helper and add the second attempt:

```js
export function createKeyResolver({ backendBaseUrl, apiKey, fetchImpl = fetch }) {
  async function readUser(url) {
    const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, user: await response.json() };
  }

  return async function resolve(userId, email) {
    if (!apiKey) return { key: null, lookupFailed: true, reason: 'PROPELAUTH_API_KEY is not set' };
    if (!userId && !email) {
      return { key: null, lookupFailed: true, reason: 'introspection response carried no sub or username' };
    }

    try {
      let attempt = userId
        ? await readUser(`${backendBaseUrl}/api/backend/v1/user/${userId}`)
        : { ok: false, status: 0 };

      // Q5 fallback: MCP tokens carry a sub the backend user API does not accept, so look the
      // account up by the address the token names instead.
      if (!attempt.ok && email) {
        attempt = await readUser(
          `${backendBaseUrl}/api/backend/v1/user/email?email=${encodeURIComponent(email)}`
        );
      }

      if (!attempt.ok) {
        return { key: null, lookupFailed: true, reason: `backend user API returned ${attempt.status}` };
      }

      const key = attempt.user?.metadata?.repliers_api_key ?? null;
      return {
        key,
        lookupFailed: false,
        reason: key ? null : 'account has no repliers_api_key in PropelAuth metadata',
      };
    } catch (error) {
      return { key: null, lookupFailed: true, reason: error.message };
    }
  };
}
```

Then in `lib/oauthVerifier.js`, change the resolver call to pass the address:

```js
      const { key: repliersApiKey, lookupFailed, reason } = await resolveApiKey(
        claims.sub,
        claims.username ?? claims.email
      );
```

- [ ] **Step 4: Run the suites**

Run: `node --test test/repliersKey.test.js test/oauthVerifier.test.js`
Expected: PASS

- [ ] **Step 5: Prepare the commit**

```sh
git add lib/repliersKey.js lib/oauthVerifier.js test/repliersKey.test.js
```

Message: `fix(oauth21): fall back to email lookup when sub is not a backend user id`

---

### Task 13: Fork Q7 — PropelAuth does not bind an audience

Selected when the probe reports `FAIL Q6`/`FAIL Q7`: introspection carries neither `aud` nor
`resource`. The code already supports it; what is missing is the decision and its record.

- [ ] **Step 1: Confirm the escape hatch behaves**

Run: `node --test test/oauthVerifier.test.js`
Expected: PASS, including `requireAudience:false accepts a token with no audience at all`.

- [ ] **Step 2: Set the variable in the deployment**

`OAUTH_REQUIRE_AUDIENCE=false`. The server logs `[WARN] Accepting a token whose audience does
not name us` on every cache miss, which is the intended noise.

- [ ] **Step 3: Record the accepted risk in `docs/oauth21/status.md`**

```markdown
## Accepted risk: audience binding unavailable (Q7)

PropelAuth does not populate `aud` or `resource` in MCP introspection responses, so the
spec's requirement that a resource server accept only tokens issued for itself cannot be
met. `OAUTH_REQUIRE_AUDIENCE=false` is set in production.

What this costs: any token issued by this PropelAuth tenant to any client opens this server
and spends the account's Repliers key. The mitigation is that the MCP authorization server
is dedicated to this resource — an assumption that stops holding the moment a second MCP
server is registered on the same tenant. Revisit whenever PropelAuth ships resource
indicators, and remove the variable that day.
```

- [ ] **Step 4: Prepare the commit**

```sh
git add docs/oauth21/status.md
```

Message: `docs(oauth21): record the audience-binding risk accepted for launch`

---

### Task 14: Fork Q11 — introspection is rate limited

Selected when the probe or the dashboard reveals a limit tighter than one call per token per
minute per active session.

- [ ] **Step 1: Raise the TTL in the deployment**

Set `OAUTH_INTROSPECTION_CACHE_TTL_MS` to the largest value that still keeps revocation
latency acceptable — the cache never outlives the token regardless, since the TTL is clamped
by `exp`.

- [ ] **Step 2: Record the chosen value and the reasoning in `docs/oauth21/status.md`**

- [ ] **Step 3: Prepare the commit**

```sh
git add docs/oauth21/status.md
```

Message: `docs(oauth21): record the introspection cache TTL and why`

---

# Phase C — cutover

### Task 15: Deploy and re-authorize

- [ ] Confirm `npm test` is green
- [ ] Confirm `docs/oauth21/status.md` records a passing probe
- [ ] Set the production environment: `MCP_PUBLIC_URL`, `OAUTH_BASE_URL`, the two introspection
      credentials, `PROPELAUTH_API_KEY`, plus any fork variables from Tasks 13–14
- [ ] Deploy
- [ ] Smoke test, in order:

```sh
curl -s https://mcp.repliers.io/health
curl -s https://mcp.repliers.io/.well-known/oauth-protected-resource/mcp | jq .
curl -sI https://mcp.repliers.io/.well-known/oauth-authorization-server   # must be 404
curl -si -X POST https://mcp.repliers.io/mcp | grep -i www-authenticate   # must name resource_metadata and scope
```

- [ ] Re-authorize the claude.ai connector and run one search end to end
- [ ] Log in from Claude Code and run one search end to end — this is the capability the
      migration exists to deliver, and it has never worked before
- [ ] Update `docs/oauth21/status.md` to "deployed", with the date and both client results
