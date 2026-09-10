# OAuth 2.1 Cutover — Test Plan and Rollback

**Date:** 2026-09-09
**Branch under test:** `feat/oauth21-resource-server` (14 commits, unit suite 144/144 green offline)
**References:** [design.md](./design.md) · [plan.md](./plan.md) · [status.md](./status.md)

## 1. What this covers

The offline suite already proves our half of the contract, including a complete login driven by
the SDK's own OAuth client (`test/oauthLoginRehearsal.test.js`): discovery, dynamic registration
with a fresh loopback callback, PKCE, the resource parameter, introspection and a tool
call. **Do not re-verify those here.**

This plan covers only what a fake authorization server cannot answer:

1. PropelAuth's actual behaviour (design.md §5 — Q1 through Q11).
2. Real clients other than the SDK's: claude.ai and Codex, which have their own implementations.
3. That the one flow working today does not silently break.

## 2. Preconditions

| Item | Value |
|---|---|
| Dashboard | [design.md §6](./design.md) complete, in the environment being cut over |
| Gate | `node scripts/probe-propelauth.mjs https://auth.repliers.com` exits 0 |
| Deployment | `feat/oauth21-resource-server` merged, **not yet deployed** |

## 3. Part A — the probe (5 min, no client)

```sh
node scripts/probe-propelauth.mjs https://auth.repliers.com
# then, after one real login, with the token and the three PropelAuth secrets in the environment:
node scripts/probe-propelauth.mjs https://auth.repliers.com "<access-token>"
```

| Verdict | Meaning | Action |
|---|---|---|
| Q1, Q2, Q3, `exp` fail | The tenant is not usable | **Stop.** Do not deploy. Escalate |
| Q5 fails | `sub` is not the backend user id | Take [plan.md](./plan.md) Task 12 before deploying — nobody can be served otherwise |
| Q6/Q7 fail | No audience binding | Take Task 13, and record the accepted risk |
| Q11 shows a tight rate limit | | Take Task 14 |

Paste the full output into [status.md](./status.md) either way.

## 4. Part B — after deploying (15 min)

### B1. The server describes itself correctly

```sh
curl -s https://mcp.repliers.io/health | jq .
curl -s https://mcp.repliers.io/.well-known/oauth-protected-resource/mcp | jq .
curl -s https://mcp.repliers.io/.well-known/oauth-protected-resource | jq .
curl -sI https://mcp.repliers.io/.well-known/oauth-authorization-server   # expect 404
curl -sI https://mcp.repliers.io/.well-known/openid-configuration          # expect 404
curl -si -X POST https://mcp.repliers.io/oauth/register                    # expect 404
```

Expected: `oauth_enabled: true`; `resource` exactly `https://mcp.repliers.io/mcp` and
`https://mcp.repliers.io`; `authorization_servers` naming `https://auth.repliers.com/oauth/2.1`;
three 404s.

### B2. The challenge points somewhere useful

```sh
curl -si -X POST https://mcp.repliers.io/mcp -H 'content-type: application/json' -d '{}' | grep -i www-authenticate
```

Expected: `Bearer error="invalid_token", …, resource_metadata="https://mcp.repliers.io/.well-known/oauth-protected-resource/mcp"` — and no `scope`, which this server does not define.

### B3. A foreign token is refused

Take any access token issued by this PropelAuth tenant for a *different* application and present
it. Expected: **401**, not a served request. If it succeeds, audience validation is not working
and the migration's central guarantee is absent — treat as a rollback trigger.

### B4. Real client logins

| Client | Why it is here | Expected |
|---|---|---|
| **Claude Code** (`claude mcp add --transport http repliers https://mcp.repliers.io/mcp`) | Fresh loopback port *and* path per login — the case that is broken today | Browser login completes, `search-listings` returns data |
| **claude.ai connector** | The only flow that works today; must be re-authorized once | Reconnect prompts a login, then a search returns data |
| **Codex CLI** | Rust implementation, not covered by any test we have; it is what rejected our metadata before | Login completes without "issuer does not match" |

For each: one `search-listings` call, then one CRM read, then one write (`create-client` or
`send-feedback`).

### B5. Provisioning still behaves

| Case | Expected |
|---|---|
| Account with no `repliers_api_key` in PropelAuth metadata | **403** `account_not_provisioned` |
| Wrong `PROPELAUTH_API_KEY` on the server | **503** `key_lookup_failed`, never 403 |
| Key rotated in PropelAuth mid-session | Next tool call uses the new key, within the introspection TTL at worst |

## 5. Acceptance

Part A exits 0, B1–B3 as specified, and **at least Claude Code and claude.ai green in B4**. Codex
failing is not a rollback trigger on its own — record what it reported and open a follow-up, since
its objection is likely to be about PropelAuth's documents rather than ours.

## 6. Rollback

**To roll back:**

1. Redeploy the commit that was live before the cutover (`86b8e6a` or whatever `main` pointed at).
2. Restore the environment configuration that was live before the cutover. `MCP_PUBLIC_URL` and
   the introspection credentials can stay; the old code ignores them.
3. Re-authorize the claude.ai connector again — it will be holding a token from the new
   authorization server, which the old code cannot validate.

**What rollback does not undo:** tokens already issued by PropelAuth's MCP authorization server.
They simply stop being accepted, which is the correct outcome. Sessions are in-memory and are lost
on any redeploy in either direction, so clients reconnect regardless.

**What cannot be rolled back:** the dashboard. Leaving MCP Auth enabled is harmless to the old
code — it uses a different PropelAuth subsystem — but confirm this is true rather than assuming it
(design.md Q12) before reporting the rollback complete.

## 7. Recording the result

Update [status.md](./status.md) with: the probe output, which clients logged in, anything B4
turned up. That file is the resume point for whoever picks
this up next.
