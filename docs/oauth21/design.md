# OAuth 2.1 Migration — Repliers MCP Server

**Date:** 2026-09-08
**Status:** design agreed; implementation blocked on PropelAuth dashboard changes owned by another person.
**Proposed branch:** `feat/oauth21-resource-server`
**Spec target:** MCP Authorization, revision `2025-11-25` (the revision `@modelcontextprotocol/sdk@1.30.0` already speaks).

---

## 1. Summary

The server currently authenticates by calling PropelAuth's `/userinfo` endpoint and, where clients
demand dynamic registration, by pretending to be an authorization server itself. Both halves are
dead ends. This migration turns the server into what the MCP specification says it must be — a plain
OAuth 2.1 **resource server** — and moves authorization onto PropelAuth's separate **MCP Auth**
subsystem, which is a different feature from the OIDC login the tenant uses today.

Two things must happen, in this order:

1. **PropelAuth dashboard** — enable MCP Auth, DCR, scopes, and introspection credentials (§6).
2. **MCP server** — replace the token path, delete the authorization-server impersonation (§4).

Deploying step 2 before step 1 breaks the one client that works today.

---

## 2. Measured baseline (2026-09-08)

Everything in this section was verified against the live tenant, not inferred.

**PropelAuth MCP Auth is not enabled.** Every OAuth 2.1 address returns 404:

```
/.well-known/oauth-authorization-server            404
/.well-known/oauth-authorization-server/oauth/2.1  404
/oauth/2.1/.well-known/oauth-authorization-server  404
/oauth/2.1/register                                404
/oauth/2.1/introspect                              404
```

**The legacy OIDC provider is alive and structurally cannot serve MCP clients.**
`https://auth.repliers.com/.well-known/openid-configuration` returns 200 with:

- `grant_types_supported: ["authorization_code"]` — no refresh tokens
- `token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"]` — no `none`,
  therefore **no public clients**, which is what every MCP client is
- no `registration_endpoint` — no DCR
- endpoints under `/propelauth/oauth/*`

**The MCP server's protected-resource metadata is not in production.**
`https://mcp.repliers.io/.well-known/oauth-protected-resource` → 404 while `/health` → 200. Commit
`86b8e6a` (branch `fix/mcp-oauth-discovery`) is unmerged and undeployed.

**Consequence.** claude.ai works only because it has one fixed HTTPS callback that was registered by
hand once. Claude Code, Claude Desktop and Codex allocate a fresh loopback port *and path* per login,
which cannot be pre-registered — so they cannot log in at all, and no code change can alter that.

---

## 3. Decisions taken

| Decision | Choice | Rationale |
|---|---|---|
| Compatibility | **Hard cutover** | One validation path, no legacy branch. The audience requirement is met without exceptions. Cost: the claude.ai connector must be re-authorized once. |
| Architecture | **Thin resource server on the SDK** | `requireBearerAuth` plus a custom `OAuthTokenVerifier`. Header parsing, expiry, 401/403 and `WWW-Authenticate` come from the SDK instead of being reproduced from memory. |
| Scopes | **None** | Every tool acts as the authenticated user with that user's own Repliers key, so a scope divides nothing the account does not already hold. Clients request everything a server advertises anyway. |
| Rejected | Own authorization server proxying PropelAuth | Removes the dashboard dependency but is the confused-deputy pattern the spec warns against, needs its own client and token storage, and still hits the legacy provider's lack of public-client support. |

---

## 4. Target design

### 4.1 HTTP surface

| Endpoint | Fate |
|---|---|
| `/mcp`, `/` | Kept, behind `requireBearerAuth` |
| `/health` | Unchanged |
| `/.well-known/oauth-protected-resource[/mcp]` | The single source of truth for where to authenticate |
| `/.well-known/openai-apps-challenge` | Unchanged |
| `/oauth/register` | **Deleted** |
| `/.well-known/oauth-authorization-server` | **Deleted** |
| `/.well-known/openid-configuration` | **Deleted** |

Protected resource metadata (RFC 9728), served by our own code. Two documents, because the server
answers on two paths and RFC 9728 §3.1 derives the metadata address from the resource path: the root
document declares `resource` as the origin, the `/mcp` one declares origin + `/mcp`. Everything else
is identical, and `authorization_servers` comes from `OAUTH_MCP_ISSUER`:

```json
{
  "resource": "https://mcp.repliers.io/mcp",
  "authorization_servers": ["https://auth.repliers.com/oauth/2.1"],
  "bearer_methods_supported": ["header"],
  "resource_name": "Repliers MCP Server"
}
```

> **Do not use the SDK's `mcpAuthMetadataRouter`.** Line 99 of
> `node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/router.js` unconditionally publishes
> `/.well-known/oauth-authorization-server` carrying the upstream issuer on *our* origin. RFC 8414 §3.3
> requires `issuer` to match the origin the document was fetched from; violating it is exactly why
> Codex refused to log in before commit `86b8e6a`. The helper would reintroduce a bug we already fixed.
> `requireBearerAuth` is safe — it is pure resource-server code.

### 4.2 Token validation — new module `lib/oauthVerifier.js`

A factory returning an object with `verifyAccessToken(token)`, i.e. the SDK's `OAuthTokenVerifier`
contract. It plugs straight into `requireBearerAuth` and is unit-testable without a network.

1. `POST {AUTH_URL}/oauth/2.1/introspect`, HTTP Basic with the introspection credentials,
   form body `token=<token>&token_type_hint=access_token`.
2. `active !== true` → `InvalidTokenError` → **401**.
3. Audience (`aud` / `resource`) not in our allow-list → **401**, not 403. The token is not
   insufficiently privileged; it was never issued for us.
4. Build `AuthInfo`:

```
{ token, clientId, scopes, expiresAt: exp, resource,
  extra: { userId: sub, orgId: org_id, repliersApiKey } }
```

**Cache:** `Map` keyed by SHA-256 of the token, TTL `min(exp - now, 60s)`. Without it every MCP
request costs a round trip to PropelAuth — MCP clients send the header on *every* request,
including SSE reconnects.

Only the introspection verdict is cached. The Repliers API key is resolved on every request,
because this server already guarantees that a key rotated or revoked upstream takes effect on the
next call rather than at the end of a session — `mcpServer.js` documents it and
`test/httpPerRequestApiKey.test.js` enforces it. Caching the key alongside the verdict would
quietly keep a revoked key alive for the length of the TTL.

### 4.3 Canonical resource URI

`MCP_PUBLIC_URL` (e.g. `https://mcp.repliers.io`) defines the accepted audiences:
`{origin, origin + "/mcp"}`, trailing slash normalised. Two values because the server listens on both
paths and the spec tells clients to send the most specific URI they can.

> **Security note.** `publicOrigin(req)` derives the origin from `Host` and `X-Forwarded-Proto`, both
> caller-controlled. That is harmless for metadata — the client compares the result against the URL it
> just requested, so a spoofed value only invalidates the spoofer's own copy. It **must not** be used
> for audience validation: an attacker holding a token for their own resource would simply send a
> matching `Host`, putting both sides of the comparison under their control and reducing the check to
> an identity. The canonical URI must come from configuration.

### 4.4 Scopes

**None.** Authentication is the only boundary: a token that proves who the user is may call every
tool, because every tool already acts as that user, with that user's own Repliers key. There is
nothing a scope could protect that the account does not already own.

An earlier revision defined `mcp:read` / `mcp:write` and enforced them per tool call. It bought
no protection in practice — clients request every scope a server advertises, so every real login
carried both — while costing a dashboard step, an open question, a plan fork, and one bug that
made every mutating tool permanently uncallable. Removed.

The metadata therefore publishes no `scopes_supported`, and the 401 challenge names no `scope`,
which leaves a client asking for the authorization server's default.

### 4.5 Repliers API key

The logic in `mcpServer.js:306-352` moves into the verifier essentially unchanged: `sub` from
introspection → PropelAuth backend user API → `metadata.repliers_api_key`. The existing distinction
between "could not ask" (503) and "account has no key" (403) is kept — it is already correct. The
`/userinfo` call disappears; introspection carries everything it provided.

### 4.6 Configuration

| New | Removed |
|---|---|
| `MCP_PUBLIC_URL` | `OAUTH_AUTHORIZATION_ENDPOINT` |
| `PROPELAUTH_MCP_INTROSPECT_CLIENT_ID` | `OAUTH_TOKEN_ENDPOINT` |
| `PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET` | `OAUTH_USERINFO_ENDPOINT` |
| `OAUTH_INTROSPECTION_ENDPOINT` (default `${OAUTH_BASE_URL}/oauth/2.1/introspect`) | `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET` |
| `OAUTH_MCP_ISSUER` (default `${OAUTH_BASE_URL}/oauth/2.1`) | `OAUTH_REDIRECT_URIS` |

In hosted mode, missing introspection credentials must **abort startup**, not print a warning as
`mcpServer.js:87-90` does today. A server that starts and then answers 500 to every request is the
worst available failure mode. The environment table in `CLAUDE.md` needs the same edit.

### 4.7 Tests

| File | Action |
|---|---|
| `test/oauthVerifier.test.js` | New — introspection, audience, cache, expiry |
| `test/httpAudienceValidation.test.js` | New — a token with a foreign `aud` gets 401 |
| `test/httpOAuthDiscovery.test.js` | Rewrite — AS documents absent (404), PRM present, 401 carries `resource_metadata` and `scope` |
| `test/helpers/hostedMcpServer.js` | Add a fake introspection endpoint |
| `httpSessionOwnership`, `httpPerRequestApiKey`, `httpKeyProvisioning` | Adapt to the new auth path |

---

## 5. Open questions — blocking

None of these can be answered while MCP Auth is off. Ranked by what they can destroy.

### 5.1 One request answers four

Run immediately after enabling MCP Auth:

```sh
curl -s https://auth.repliers.com/.well-known/oauth-authorization-server/oauth/2.1 | jq .
```

| # | Assumption | If wrong |
|---|---|---|
| Q1 | Metadata lives at the **path-insertion** address above, not the appended form | Spec-conformant clients try three addresses, and the appended `oauth-authorization-server` form is **not** among them. Nobody can log in, and it looks like our fault |
| Q2 | `registration_endpoint` is present | No DCR — CLI and desktop clients hit the same wall this migration exists to remove |
| Q3 | `code_challenge_methods_supported` is present | The spec requires clients to **refuse to proceed** without it. Login never starts |
| Q4 | `grant_types_supported` includes `refresh_token` | Users re-authenticate when the token expires. Survivable, but plan for it |

Also check `client_id_metadata_document_supported`: in the 2025-11-25 spec, Client ID Metadata
Documents take **priority over DCR**. If PropelAuth supports CIMD, Q2 stops being critical.

### 5.2 Answerable only with a live token

Requires one real login (e.g. from Claude Code) plus one introspection response. Highest risk.

| # | Assumption | Why it matters |
|---|---|---|
| **Q5** | `sub` in the introspection response is the PropelAuth `user_id` accepted by `/api/backend/v1/user/{id}` | The entire "logged in → fetch `repliers_api_key` from metadata" chain rests on it. If MCP tokens carry a pseudonymous or per-client `sub`, **no user** can be served — and it surfaces on rollout day |
| Q6 | The audience arrives in a field we read | The docs contradict themselves: the overview shows `aud`, the Go example checks `Resource`. We will accept both, but need to know which is populated and with what value — origin, origin + `/mcp`, or an echo of the client's `resource` |
| Q7 | PropelAuth honours RFC 8707: accepts `resource` on authorize and token requests, and binds the token to it | If it is ignored, audience binding is physically impossible and the spec's MUST cannot be satisfied. The fallback — "this AS serves only us" — must then be recorded as an accepted risk |
| Q8 | `org_id` is present | Not blocking; decides whether the API key can later move from user metadata to org metadata |

### 5.3 Visible only in the dashboard

| # | Question | Why |
|---|---|---|
| **Q10** | Is DCR open or gated by an initial access token — and do dynamically registered clients still have to pass the redirect-URI whitelist? | If the whitelist also applies to DCR, loopback callbacks with a random port *and* path fail again, i.e. we land back in today's breakage by a new route. Second-highest risk after Q5 |
| Q11 | Is there a rate limit on `/oauth/2.1/introspect`? | The 60-second cache TTL is a guess, not a calculation |
| Q12 | Does enabling MCP Auth disturb the existing OIDC login used by other Repliers applications on this tenant? | We are changing a shared tenant |

**Gate.** Q5 and Q10 can invalidate the design. Both are only answerable after the feature is on, and
both fail in the same shape as the breakage we just spent a commit making legible. The rollout
therefore has a mandatory step between "enabled" and "deployed": one live login and one introspection
response, printed and read.

---

## 6. PropelAuth dashboard checklist

For whoever owns the tenant; [propelauth-handoff.md](propelauth-handoff.md) is this section
rewritten as a self-contained page to send them. A previous attempt enabled something adjacent
— plain OIDC login is a different feature from MCP Auth, and the verification in §6.1 is what
distinguishes them.

1. **MCP → Enable MCP** for the Prod environment (and Test/Staging if they exist — prefer testing there first).
2. **Enable Dynamic Client Registration.** Without it, CLI and desktop MCP clients still cannot log in.
3. Whitelist MCP clients: the Claude / ChatGPT / Cursor templates plus loopback `http://127.0.0.1:*/callback`.
5. **Request Validation → Create Credentials** — hand the introspection Client ID and Secret to the server team.
6. Set the session duration policy.
7. **Rotate the old `OAUTH_CLIENT_SECRET` — but only after the cutover is confirmed.** The
   server's `/oauth/register` shim served it publicly to anyone naming a registered redirect URI,
   so treat it as leaked. It is nonetheless the last step, not an early one: the old deployment
   needs that secret to serve claude.ai, so rotating it before the new flow is verified destroys
   the rollback path. See [test-plan.md §6](test-plan.md).

### 6.1 Verification — both must return 200 and a non-empty match

```sh
curl -sI https://auth.repliers.com/.well-known/oauth-authorization-server/oauth/2.1

curl -s https://auth.repliers.com/.well-known/oauth-authorization-server/oauth/2.1 | jq .registration_endpoint
```

If the first is 404, MCP Auth is not on — regardless of what the dashboard shows.

---

## 7. Rollout order

```
dashboard → §6.1 verification → live login + introspection dump (Q5–Q8) → deploy → re-authorize claude.ai
```

Never the other way round. The moment the server publishes protected-resource metadata, clients
prefer PropelAuth's own discovery over our shim; if that still 404s, the working claude.ai connector
breaks along with everything else.

---

## 8. Branch strategy

Branch `feat/oauth21-resource-server`. The undeployed `fix/mcp-oauth-discovery` (commit `86b8e6a`) is
largely absorbed: its protected-resource metadata moves over as-is, while the `/oauth/register` shim
and the authorization-server document it repaired are deleted. Merging it separately buys nothing —
fold it in as the starting point instead.
