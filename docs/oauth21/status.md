# OAuth 2.1 migration — status

**Last updated:** 2026-09-09
**Branch:** `feat/oauth21-resource-server` (branched from `fix/mcp-oauth-discovery`)

## Phase A complete

Everything that does not depend on the PropelAuth dashboard is implemented and green.
`npm test` passes offline: 131 tests, no network required.

| Delivered | |
|---|---|
| `lib/scopes.js` | `mcp:read` / `mcp:write`, mapped per tool from the roster's existing `readOnlyHint` |
| `lib/protectedResource.js` | Canonical URI, accepted audiences, both RFC 9728 documents |
| `lib/repliersKey.js` | Repliers key lookup, quarantined because Q5 is unverified |
| `lib/oauthVerifier.js` | RFC 7662 introspection, audience binding, verdict cache |
| `mcpServer.js` | Resource server: `requireBearerAuth` + `requireRepliersKey`, scope check on tool calls, three endpoints deleted, fatal startup checks |
| `scripts/probe-propelauth.mjs` | The Q1–Q8 gate |

## Blocked on the PropelAuth dashboard

Nothing here has ever spoken to a real PropelAuth MCP authorization server. Re-measured
2026-09-09: the tenant still 404s on every `/oauth/2.1` address.

```
$ node scripts/probe-propelauth.mjs https://auth.repliers.com
FAIL  Q1  path-insertion 404, appended 404, oidc-appended 404

No authorization server metadata at any address. MCP Auth is not enabled on this
tenant -- stop here and see docs/oauth21/design.md §6 for the dashboard checklist.
```

The checklist for whoever owns the tenant is [design.md §6](design.md). MCP Auth is a
separate feature from the OIDC login the tenant already runs; a previous attempt enabled
something adjacent, which is why the probe exists.

## Resume point

1. Dashboard owner completes [design.md §6](design.md).
2. Run `node scripts/probe-propelauth.mjs https://auth.repliers.com` — Q1–Q4.
3. Log in once from an MCP client against a staging deployment, capture the access token,
   rerun the probe with it and the three PropelAuth secrets in the environment — Q5–Q8.
4. Paste the full output into this file.
5. **Stop if Q1, Q2, Q3 or `exp` failed.** Escalate; do not deploy. Publishing
   protected-resource metadata makes clients prefer PropelAuth's discovery over the shim
   that no longer exists, so a tenant that is not ready breaks the working claude.ai
   connector too.
6. Otherwise take the forks the verdicts select: [plan.md](plan.md) Tasks 11–14, then
   Task 15 for the cutover.

## Deviations from the plan

**The introspection cache holds only the verdict, not the key** (plan Task 4). As written,
the verifier cached the whole `AuthInfo`, which includes `repliersApiKey` — and that broke
`test/httpPerRequestApiKey.test.js`, which enforces an invariant this server already had:
the Repliers key is resolved per request so that a key rotated or revoked in PropelAuth
stops working on the very next call rather than at the end of a session. Caching it would
have kept a revoked key alive for up to a minute. The fix keeps the expensive, rate-limited
introspection cached and resolves the key every time; `design.md` §4.2 is amended and
`test/oauthVerifier.test.js` now guards the invariant at unit level too.

**Two suites were added that the plan did not list.** `test/httpStartupConfig.test.js`
covers the fail-fast behaviour, which replaced a warning and would otherwise regress back
into one unnoticed. `test/httpAudienceValidation.test.js` gained a third case: a spoofed
`Host` header must not widen the accepted audience, which is the concrete attack the
`MCP_PUBLIC_URL` decision exists to prevent.

**Harness migration was split differently.** The plan had one commit adding introspection to
the fake PropelAuth and a later one rewiring the server, which would have left the HTTP
suites red in between. The fake instead served introspection *and* userinfo for one commit,
so every commit on this branch is green and the history stays bisectable.
