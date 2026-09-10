# OAuth 2.1 migration — status

**Last updated:** 2026-09-09 (post-review)
**Branch:** `feat/oauth21-resource-server` (branched from `fix/mcp-oauth-discovery`)

## Phase A complete

Everything that does not depend on the PropelAuth dashboard is implemented and green.
`npm test` passes offline: 158 tests, no network required.

| Delivered | |
|---|---|
| `lib/protectedResource.js` | Canonical URI, accepted audiences, both RFC 9728 documents |
| `lib/repliersKey.js` | Repliers key lookup, quarantined because Q5 is unverified |
| `lib/oauthVerifier.js` | RFC 7662 introspection, audience binding, verdict cache |
| `mcpServer.js` | Resource server: `requireBearerAuth` + `requireRepliersKey`, scope check on tool calls, three endpoints deleted, fatal startup checks |
| `scripts/probe-propelauth.mjs` | The Q1–Q8 gate |
| `test/oauthLoginRehearsal.test.js` | A complete login driven by the SDK's own OAuth client against a fake authorization server |

## Blocked on the PropelAuth dashboard

Nothing here has ever spoken to a real PropelAuth MCP authorization server. Re-measured
2026-09-09: the tenant still 404s on every `/oauth/2.1` address.

```
$ node scripts/probe-propelauth.mjs https://auth.repliers.com
FAIL  Q1  path-insertion 404, appended 404, oidc-appended 404

No authorization server metadata at any address. MCP Auth is not enabled on this
tenant -- stop here and see docs/oauth21/design.md §6 for the dashboard checklist.
```

The checklist for whoever owns the tenant is [design.md §6](design.md), packaged for sending
as [propelauth-handoff.md](propelauth-handoff.md). MCP Auth is a
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
7. Run [test-plan.md](test-plan.md) — the day-of procedure, including the rollback and the
   reason `OAUTH_CLIENT_SECRET` must be rotated last rather than first.

## Review outcome

**Security review: no HIGH or MEDIUM findings.** An independent pass read the diff, the SDK's
`requireBearerAuth`, and both Streamable HTTP transports, then ran adversarial probes against a
live server: another user's session id, `__proto__` as a session id, a tool call smuggled inside a
JSON-RPC batch, a token with no `sub`, a multi-audience token, trailing-slash variants. All three
central properties held — a foreign audience cannot open the server, one user cannot drive
another's session, a read-only token cannot mutate.

**Code review found one break that would have reached production.** `requireBearerAuth` uses its
`requiredScopes` list both to enforce and to advertise, and a client treats the advertised `scope`
as the set to request. Asking for `mcp:read` — the minimum needed to connect — meant every user
received a read-only token and every mutating tool was permanently uncallable, with no recovery
path because our insufficient-scope refusal travels inside a JSON-RPC response rather than a 403.
Fixed in `93b7399`. The login rehearsal had missed it because it only called a read-only tool; it
now asserts the requested scope and calls a mutating one.

Ten smaller findings were fixed in `6ad9d00` and `39a7abb`: audience read from `aud` and
`resource` together rather than whichever came first, scope arrays understood, non-access tokens
refused, the audience escaped before it reaches a response header, an unusable cache TTL no longer
disabling the cache silently, `MCP_PUBLIC_URL` validated as a URL, `PROPELAUTH_API_KEY` made fatal
at startup, `sub` encoded into the backend URL, deadlines on both upstream calls, the verdict cache
bounded, and `tools/list` filtered to what the token can call.

One finding was **rejected**: hoisting `discoverTools()` out of the per-session path. It is a real
improvement but identical on `main` — pre-existing, and not this branch's business.

## Residual risks

**Resolved: the suite runs against the pinned SDK.** It briefly ran against a stale
`node_modules` holding 1.29.0 while `package.json` pins 1.30.0. `npm install --engine-strict=false`
fixed it — `engines` is a declaration, not a technical incompatibility, and this machine's Node
26.7.0 has no bearing on whether the tests are valid. `package.json` and `package-lock.json` were
already correct and are unchanged; only the installed tree was stale. All 158 tests pass against
1.30.0, so the scope fix is measured against the client code that will actually ship rather than
argued from it.

**A stray `REPLIERS_API_KEY` in the hosted environment silently disables everything.**
`selfHosted` is derived from it, and it gates the auth chain *and* the new fatal startup checks.
This is unchanged from `main`, and [test-plan.md](test-plan.md) B1 catches it — `/health` must
report `oauth_enabled: true` — but it is worth knowing that the check exists for this reason.

## Deviations from the plan

**Scopes were removed after Phase A.** `mcp:read` / `mcp:write` divided nothing: every tool acts
as the authenticated user with that user's own Repliers key, and clients request every scope a
server advertises, so every real login carried both. They cost a dashboard step, question Q9, plan
Task 11, and the bug in `93b7399`. `lib/scopes.js`, `test/scopes.test.js` and
`test/httpToolScopes.test.js` are deleted; the metadata publishes no `scopes_supported` and the
challenge names no `scope`. **Plan Task 11 is void** — ignore it if the probe still prints Q9.


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
